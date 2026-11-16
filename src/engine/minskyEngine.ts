// ── Minsky Simulation Engine ──
// Stock-flow consistent macroeconomic simulator with RK4 ODE solver,
// Godley table evaluation, and DAG-based equation ordering.

import type {
  MinskyModel,
  FlowCoefficient,
  EvalStep,
  SimulationState,
  TimeSeriesPoint,
} from '../types/minsky'

// ─── Expression Parser ───────────────────────────────────────────

/**
 * Parse a Godley cell expression into coefficient × variable.
 * Examples:
 *   "0.5Spend"  → { coefficient: 0.5, variableName: "Spend" }
 *   "-IntDebt"  → { coefficient: -1, variableName: "IntDebt" }
 *   "SellBonds" → { coefficient: 1, variableName: "SellBonds" }
 *   "100"       → { coefficient: 100, variableName: null }
 *   "-0.5Tax"   → { coefficient: -0.5, variableName: "Tax" }
 *   ""          → { coefficient: 0, variableName: null }
 */
export function parseFlowExpression(expr: string): FlowCoefficient {
  const s = expr.trim()
  if (!s) return { coefficient: 0, variableName: null }

  // Match optional sign, optional number (int or float), optional variable name
  const match = s.match(/^([+-]?)(\d+\.?\d*)?([A-Za-z_]\w*)?$/)
  if (!match) return { coefficient: 0, variableName: null }

  const [, sign, numStr, varName] = match
  const signMul = sign === '-' ? -1 : 1

  if (varName) {
    const coeff = numStr ? parseFloat(numStr) : 1
    return { coefficient: signMul * coeff, variableName: varName }
  } else if (numStr) {
    return { coefficient: signMul * parseFloat(numStr), variableName: null }
  }

  return { coefficient: 0, variableName: null }
}

/**
 * Evaluate a Godley cell expression given current variable values.
 */
export function evaluateFlowExpression(
  expr: string,
  values: Map<string, number>
): number {
  const { coefficient, variableName } = parseFlowExpression(expr)
  if (variableName) {
    return coefficient * (values.get(variableName) ?? 0)
  }
  return coefficient
}

// ─── Godley Table Evaluation ─────────────────────────────────────

/**
 * Compute the derivative (rate of change) for each stock column in a Godley table.
 * Returns a Map of stockVariableId → dStock/dt.
 *
 * For asset columns, positive entries increase the stock.
 * For liability columns, the sign convention is reversed (positive entry = increase in liability).
 */
export function evaluateGodleyTable(
  table: GodleyTableData,
  allValues: Map<string, number>
): Map<string, number> {
  const derivatives = new Map<string, number>()

  for (const col of table.columns) {
    derivatives.set(col.variableId, 0)
  }

  // Skip row 0 (initial conditions) — those are handled at reset
  for (let r = 1; r < table.rows.length; r++) {
    const row = table.rows[r]
    for (let c = 0; c < table.columns.length; c++) {
      const cell = row.cells[c] ?? ''
      if (!cell.trim()) continue

      const flowValue = evaluateFlowExpression(cell, allValues)
      const col = table.columns[c]
      const current = derivatives.get(col.variableId) ?? 0

      // Signs are already encoded in the cell expressions (e.g. "-0.5Tax")
      // No additional sign multiplier needed — the Godley table entries
      // carry the correct sign convention for all asset classes.
      derivatives.set(col.variableId, current + flowValue)
    }
  }

  return derivatives
}

/**
 * Validate a Godley table: each row should sum to zero (double-entry compliance).
 * Returns an array of { rowIndex, sum, valid } for each non-header row.
 */
export function validateGodleyTable(
  table: GodleyTableData,
  allValues: Map<string, number>
): Array<{ rowIndex: number; label: string; sum: number; valid: boolean }> {
  const results: Array<{ rowIndex: number; label: string; sum: number; valid: boolean }> = []

  for (let r = 0; r < table.rows.length; r++) {
    const row = table.rows[r]

    // Special handling for "Initial Conditions" row (balance sheet)
    if (r === 0 && row.label.toLowerCase().includes('initial')) {
      let assets = 0
      let liabilities = 0
      for (let c = 0; c < table.columns.length; c++) {
        const cell = row.cells[c] ?? ''
        if (!cell.trim()) continue
        const value = evaluateFlowExpression(cell, allValues)
        if (table.columns[c].assetClass === 'asset') {
          assets += value
        } else if (table.columns[c].assetClass === 'liability') {
          liabilities += value
        }
      }
      const balanceSheetCheck = assets - liabilities
      results.push({
        rowIndex: r,
        label: row.label,
        sum: balanceSheetCheck,
        valid: Math.abs(balanceSheetCheck) < 1e-9,
      })
    } else {
      // Flow rows: must sum to zero (double-entry)
      let sum = 0
      for (let c = 0; c < table.columns.length; c++) {
        const cell = row.cells[c] ?? ''
        if (!cell.trim()) continue
        sum += evaluateFlowExpression(cell, allValues)
      }
      results.push({
        rowIndex: r,
        label: row.label,
        sum,
        valid: Math.abs(sum) < 1e-9,
      })
    }
  }

  return results
}

// ─── DAG Evaluation Order ────────────────────────────────────────

/**
 * Build a topological evaluation order for operations.
 * Operations must be evaluated so that all inputs are computed before the operation runs.
 */
export function buildEvaluationOrder(model: MinskyModel): EvalStep[] {
  const ops = Object.values(model.operations)
  if (ops.length === 0) return []

  // Build adjacency: which operations depend on which?
  // An operation depends on another if one of its inputs is the output of that other operation.
  const outputToOp = new Map<string, string>()
  for (const op of ops) {
    outputToOp.set(op.output, op.id)
  }

  const adjList = new Map<string, string[]>()
  const inDegree = new Map<string, number>()

  for (const op of ops) {
    adjList.set(op.id, [])
    inDegree.set(op.id, 0)
  }

  for (const op of ops) {
    for (const inputId of op.inputs) {
      const producerOpId = outputToOp.get(inputId)
      if (producerOpId && producerOpId !== op.id) {
        adjList.get(producerOpId)!.push(op.id)
        inDegree.set(op.id, (inDegree.get(op.id) ?? 0) + 1)
      }
    }
  }

  // Kahn's algorithm (topological sort)
  const queue: string[] = []
  for (const op of ops) {
    if ((inDegree.get(op.id) ?? 0) === 0) {
      queue.push(op.id)
    }
  }

  const order: EvalStep[] = []
  while (queue.length > 0) {
    const opId = queue.shift()!
    const op = model.operations[opId]
    order.push({
      operationId: op.id,
      type: op.type,
      inputIds: op.inputs,
      outputId: op.output,
    })

    for (const neighbor of adjList.get(opId) ?? []) {
      const deg = (inDegree.get(neighbor) ?? 1) - 1
      inDegree.set(neighbor, deg)
      if (deg === 0) queue.push(neighbor)
    }
  }

  // Detect cycles
  if (order.length < ops.length) {
    console.warn('Minsky engine: algebraic loop detected in operation graph')
  }

  return order
}

// ─── Equation Evaluation ─────────────────────────────────────────

/**
 * Execute all operations in topological order to compute flow values from stock + parameter values.
 */
export function evaluateEquations(
  model: MinskyModel,
  evalOrder: EvalStep[],
  values: Map<string, number>
): void {
  for (const step of evalOrder) {
    const inputs = step.inputIds.map(id => values.get(id) ?? 0)

    let result: number
    switch (step.type) {
      case 'add':
        result = inputs.reduce((a, b) => a + b, 0)
        break
      case 'subtract':
        result = inputs.length >= 2 ? inputs[0] - inputs[1] : -(inputs[0] ?? 0)
        break
      case 'multiply':
        result = inputs.reduce((a, b) => a * b, 1)
        break
      case 'divide':
        result = inputs.length >= 2 && inputs[1] !== 0
          ? inputs[0] / inputs[1]
          : 0
        break
      case 'negate':
        result = -(inputs[0] ?? 0)
        break
      case 'integrate':
        // Integration is handled by the ODE solver, not here.
        // This just passes through the current stock value.
        result = values.get(step.outputId) ?? 0
        return
      default:
        result = 0
    }

    values.set(step.outputId, result)
  }
}

// ─── ODE Solver (Runge-Kutta 4th Order) ──────────────────────────

/**
 * Compute derivatives for all stock variables.
 * This combines Godley table flows and any explicit integration operations.
 */
function computeDerivatives(
  model: MinskyModel,
  evalOrder: EvalStep[],
  currentValues: Map<string, number>
): Map<string, number> {
  // 1. Evaluate all equations to get flow values
  const values = new Map(currentValues)
  evaluateEquations(model, evalOrder, values)

  // 2. Sum Godley table column flows for each stock
  const derivatives = new Map<string, number>()
  for (const table of model.godleyTables) {
    const tableDerivs = evaluateGodleyTable(table, values)
    for (const [stockId, dv] of tableDerivs) {
      derivatives.set(stockId, (derivatives.get(stockId) ?? 0) + dv)
    }
  }

  return derivatives
}

/**
 * Apply a set of derivatives scaled by a factor to stock values.
 */
function applyDerivatives(
  stockValues: Map<string, number>,
  derivatives: Map<string, number>,
  scale: number
): Map<string, number> {
  const result = new Map(stockValues)
  for (const [id, dv] of derivatives) {
    result.set(id, (result.get(id) ?? 0) + dv * scale)
  }
  return result
}

/**
 * Perform one RK4 integration step.
 */
export function rk4Step(
  model: MinskyModel,
  evalOrder: EvalStep[],
  state: SimulationState,
  dt: number
): void {
  // Build a combined value map (stocks + flows + params)
  const allValues = new Map<string, number>()
  for (const v of Object.values(model.variables)) {
    if (v.type === 'stock') {
      allValues.set(v.id, state.stockValues.get(v.id) ?? v.initialValue)
    } else if (v.type === 'parameter' || v.type === 'constant') {
      allValues.set(v.id, v.value)
    }
  }
  // Copy current flow values
  for (const [k, v] of state.flowValues) {
    allValues.set(k, v)
  }

  // k1
  const k1 = computeDerivatives(model, evalOrder, allValues)

  // k2: half-step with k1
  const valuesK2 = applyDerivatives(allValues, k1, dt / 2)
  const k2 = computeDerivatives(model, evalOrder, valuesK2)

  // k3: half-step with k2
  const valuesK3 = applyDerivatives(allValues, k2, dt / 2)
  const k3 = computeDerivatives(model, evalOrder, valuesK3)

  // k4: full step with k3
  const valuesK4 = applyDerivatives(allValues, k3, dt)
  const k4 = computeDerivatives(model, evalOrder, valuesK4)

  // Combine: stockValues += (dt/6)(k1 + 2k2 + 2k3 + k4)
  for (const [stockId] of k1) {
    const current = state.stockValues.get(stockId) ?? 0
    const dk1 = k1.get(stockId) ?? 0
    const dk2 = k2.get(stockId) ?? 0
    const dk3 = k3.get(stockId) ?? 0
    const dk4 = k4.get(stockId) ?? 0
    state.stockValues.set(stockId, current + (dt / 6) * (dk1 + 2 * dk2 + 2 * dk3 + dk4))
  }

  // Update flow values with final evaluation
  const finalValues = new Map<string, number>()
  for (const v of Object.values(model.variables)) {
    if (v.type === 'stock') {
      finalValues.set(v.id, state.stockValues.get(v.id) ?? v.initialValue)
    } else if (v.type === 'parameter' || v.type === 'constant') {
      finalValues.set(v.id, v.value)
    }
  }
  for (const [k, v] of state.flowValues) {
    finalValues.set(k, v)
  }
  evaluateEquations(model, evalOrder, finalValues)
  // Write back computed flow values
  for (const v of Object.values(model.variables)) {
    if (v.type === 'flow') {
      state.flowValues.set(v.id, finalValues.get(v.id) ?? 0)
    }
  }

  state.t += dt
}

// ─── Simulation Lifecycle ────────────────────────────────────────

/**
 * Initialize simulation state from a model.
 * Computes initial flow values from the initialized stocks and parameters.
 */
export function resetSimulation(model: MinskyModel): SimulationState {
  const stockValues = new Map<string, number>()
  const flowValues = new Map<string, number>()

  for (const v of Object.values(model.variables)) {
    if (v.type === 'stock') {
      stockValues.set(v.id, v.initialValue)
    } else if (v.type === 'flow') {
      flowValues.set(v.id, 0)
    }
  }

  // Initialize Godley table initial condition rows
  for (const table of model.godleyTables) {
    if (table.rows.length > 0) {
      const initRow = table.rows[0]
      for (let c = 0; c < table.columns.length; c++) {
        const cell = initRow.cells[c] ?? ''
        if (!cell.trim()) continue
        const val = parseFloat(cell)
        if (!isNaN(val)) {
          stockValues.set(table.columns[c].variableId, val)
        }
      }
    }
  }

  // ── Compute initial flow values from initialized stocks and parameters ──
  const evalOrder = buildEvaluationOrder(model)
  const allValues = new Map<string, number>()

  // Populate with stocks and parameters
  for (const v of Object.values(model.variables)) {
    if (v.type === 'stock') {
      allValues.set(v.id, stockValues.get(v.id) ?? v.initialValue)
    } else if (v.type === 'parameter' || v.type === 'constant') {
      allValues.set(v.id, v.value)
    } else if (v.type === 'flow') {
      allValues.set(v.id, 0)
    }
  }

  // Evaluate equations to compute initial flows (GDP, GovSpend, Tax, etc.)
  evaluateEquations(model, evalOrder, allValues)

  // Write computed flow values back
  for (const v of Object.values(model.variables)) {
    if (v.type === 'flow') {
      flowValues.set(v.id, allValues.get(v.id) ?? 0)
    }
  }

  return {
    t: 0,
    dt: 0.1,
    running: false,
    speed: 1,
    stockValues,
    flowValues,
    history: [],
    maxHistory: 500,
  }
}

/**
 * Perform one simulation step and record history.
 */
export function stepSimulation(
  model: MinskyModel,
  evalOrder: EvalStep[],
  state: SimulationState
): void {
  rk4Step(model, evalOrder, state, state.dt)

  // Record history point
  const point: TimeSeriesPoint = {
    t: Math.round(state.t * 1000) / 1000,
    values: {},
  }
  for (const [id, val] of state.stockValues) {
    point.values[id] = val
  }
  for (const [id, val] of state.flowValues) {
    point.values[id] = val
  }
  // Also include parameter values for charting
  for (const v of Object.values(model.variables)) {
    if (v.type === 'parameter' || v.type === 'constant') {
      point.values[v.id] = v.value
    }
  }

  state.history.push(point)
  if (state.history.length > state.maxHistory) {
    state.history.shift()
  }
}

/**
 * Run multiple simulation steps (for batch advancement).
 */
export function runSimulationSteps(
  model: MinskyModel,
  evalOrder: EvalStep[],
  state: SimulationState,
  steps: number
): void {
  for (let i = 0; i < steps; i++) {
    stepSimulation(model, evalOrder, state)
  }
}

// ─── Model Serialization ─────────────────────────────────────────

export function serializeModel(model: MinskyModel): string {
  return JSON.stringify(model, null, 2)
}

export function deserializeModel(json: string): MinskyModel {
  return JSON.parse(json) as MinskyModel
}

/**
 * Get all variable names from model for autocomplete in Godley cells.
 */
export function getVariableNames(model: MinskyModel): string[] {
  return Object.values(model.variables).map(v => v.name)
}

/**
 * Get current value of any variable (stock, flow, or parameter).
 */
export function getVariableValue(
  variableId: string,
  model: MinskyModel,
  state: SimulationState
): number {
  const v = model.variables[variableId]
  if (!v) return 0
  if (v.type === 'stock') return state.stockValues.get(variableId) ?? v.initialValue
  if (v.type === 'flow') return state.flowValues.get(variableId) ?? 0
  return v.value
}
