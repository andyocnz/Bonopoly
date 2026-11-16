// ── Minsky Economic Modeler Type Definitions ──

export type VariableType = 'stock' | 'flow' | 'parameter' | 'constant'
export type AssetClass = 'asset' | 'liability' | 'equity' | 'none'
export type OperationType =
  | 'add'
  | 'subtract'
  | 'multiply'
  | 'divide'
  | 'negate'
  | 'integrate'

export interface MinskyVariable {
  id: string
  name: string
  type: VariableType
  value: number
  initialValue: number
  unit?: string
  description?: string
  // Position on wiring canvas (for ReactFlow)
  position?: { x: number; y: number }
}

export interface MinskyOperation {
  id: string
  type: OperationType
  inputs: string[]   // variable IDs
  output: string     // variable ID
  position?: { x: number; y: number }
}

export interface MinskyWire {
  id: string
  from: string       // variable or operation ID
  to: string         // variable or operation ID
  fromPort: string   // port identifier (e.g., 'output', 'input-0')
  toPort: string
}

export interface GodleyColumn {
  name: string
  variableId: string   // links to a stock variable
  assetClass: AssetClass
}

export interface GodleyRow {
  label: string
  cells: string[]      // expressions like "0.5Spend", "-IntDebt", "SellBonds"
}

export interface GodleyTableData {
  id: string
  title: string
  columns: GodleyColumn[]
  rows: GodleyRow[]
}

export interface ChartConfig {
  id: string
  title: string
  variables: string[]     // variable IDs to plot
  yAxisLabel?: string
  colors?: string[]
}

export interface MinskyModel {
  metadata: {
    name: string
    description: string
    author?: string
    version?: string
  }
  variables: Record<string, MinskyVariable>
  operations: Record<string, MinskyOperation>
  wires: MinskyWire[]
  godleyTables: GodleyTableData[]
  chartConfigs: ChartConfig[]
}

export interface TimeSeriesPoint {
  t: number
  values: Record<string, number>
}

export interface SimulationState {
  t: number
  dt: number
  running: boolean
  speed: number          // multiplier: 1 = normal, 2 = 2x, etc.
  stockValues: Map<string, number>
  flowValues: Map<string, number>
  history: TimeSeriesPoint[]
  maxHistory: number     // rolling buffer size
}

// Parsed flow expression: coefficient * variableName
export interface FlowCoefficient {
  coefficient: number
  variableName: string | null  // null for pure constants
}

// Evaluation order entry
export interface EvalStep {
  operationId: string
  type: OperationType
  inputIds: string[]
  outputId: string
}
