// ── Minsky Economic Modeler Lab ──
// Standalone teaching sandbox page: Godley Tables + Charts + Wiring Diagram + Controls

import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { getDefaultModel, KEEN_PARAMETER_CONFIGS } from '../engine/minskyModels'
import {
  resetSimulation,
  stepSimulation,
  buildEvaluationOrder,
  serializeModel,
  deserializeModel,
  getVariableValue,
} from '../engine/minskyEngine'
import type { MinskyModel, SimulationState, EvalStep } from '../types/minsky'
import { GodleyTable } from '../components/minsky/GodleyTable'
import { SimulationCharts } from '../components/minsky/SimulationCharts'
import { ParameterPanel } from '../components/minsky/ParameterPanel'
import { SimulationControls } from '../components/minsky/SimulationControls'
import { ValidationPanel } from '../components/minsky/ValidationPanel'
import { WiringCanvas } from '../components/minsky/WiringCanvas'
import './MinskyLabPage.css'

export default function MinskyLabPage() {
  // ── Model & Simulation State ──
  const [model, setModel] = useState<MinskyModel>(() => getDefaultModel())
  const [simState, setSimState] = useState<SimulationState>(() => resetSimulation(model))
  const [evalOrder, setEvalOrder] = useState<EvalStep[]>(() => buildEvaluationOrder(model))

  // Rebuild eval order when model operations change
  useEffect(() => {
    setEvalOrder(buildEvaluationOrder(model))
  }, [model])

  // ── Simulation Loop ──
  const animRef = useRef<number | null>(null)
  const modelRef = useRef(model)
  const evalOrderRef = useRef(evalOrder)
  const simStateRef = useRef(simState)
  const loopRef = useRef<() => void>()

  useEffect(() => {
    modelRef.current = model
  }, [model])
  useEffect(() => {
    evalOrderRef.current = evalOrder
  }, [evalOrder])
  useEffect(() => {
    simStateRef.current = simState
  }, [simState])
  useEffect(() => {
    loopRef.current = () => {
      const state = simStateRef.current
      if (!state.running) return

      const stepsPerFrame = state.speed
      for (let i = 0; i < stepsPerFrame; i++) {
        stepSimulation(modelRef.current, evalOrderRef.current, state)
      }
      setSimState({ ...state })

      animRef.current = requestAnimationFrame(() => loopRef.current?.())
    }
  })

  const handlePlay = useCallback(() => {
    setSimState(prev => {
      const next = { ...prev, running: true }
      simStateRef.current = next
      animRef.current = requestAnimationFrame(() => loopRef.current?.())
      return next
    })
  }, [])

  const handlePause = useCallback(() => {
    if (animRef.current) cancelAnimationFrame(animRef.current)
    setSimState(prev => ({ ...prev, running: false }))
  }, [])

  const handleStep = useCallback(() => {
    setSimState(prev => {
      const next = { ...prev }
      stepSimulation(modelRef.current, evalOrderRef.current, next)
      return next
    })
  }, [])

  const handleReset = useCallback(() => {
    if (animRef.current) cancelAnimationFrame(animRef.current)
    setSimState(resetSimulation(model))
  }, [model])

  const handleSpeedChange = useCallback((speed: number) => {
    setSimState(prev => ({ ...prev, speed }))
  }, [])

  // Cleanup animation on unmount
  useEffect(() => {
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current)
    }
  }, [])

  // ── Parameter Changes ──
  const handleParameterChange = useCallback((id: string, value: number) => {
    setModel(prev => ({
      ...prev,
      variables: {
        ...prev.variables,
        [id]: { ...prev.variables[id], value },
      },
    }))
  }, [])

  const handleResetParameter = useCallback((id: string) => {
    setModel(prev => ({
      ...prev,
      variables: {
        ...prev.variables,
        [id]: { ...prev.variables[id], value: prev.variables[id].initialValue },
      },
    }))
  }, [])

  // ── Godley Table Editing ──
  const handleCellChange = useCallback((tableId: string, rowIndex: number, colIndex: number, value: string) => {
    setModel(prev => ({
      ...prev,
      godleyTables: prev.godleyTables.map(t =>
        t.id === tableId
          ? {
              ...t,
              rows: t.rows.map((r, ri) =>
                ri === rowIndex
                  ? { ...r, cells: r.cells.map((c, ci) => (ci === colIndex ? value : c)) }
                  : r
              ),
            }
          : t
      ),
    }))
  }, [])

  const handleRowAdd = useCallback((tableId: string) => {
    setModel(prev => ({
      ...prev,
      godleyTables: prev.godleyTables.map(t =>
        t.id === tableId
          ? {
              ...t,
              rows: [
                ...t.rows,
                { label: 'New Flow', cells: t.columns.map(() => '') },
              ],
            }
          : t
      ),
    }))
  }, [])

  const handleRowRemove = useCallback((tableId: string, rowIndex: number) => {
    setModel(prev => ({
      ...prev,
      godleyTables: prev.godleyTables.map(t =>
        t.id === tableId
          ? { ...t, rows: t.rows.filter((_, ri) => ri !== rowIndex) }
          : t
      ),
    }))
  }, [])

  const handleRowLabelChange = useCallback((tableId: string, rowIndex: number, label: string) => {
    setModel(prev => ({
      ...prev,
      godleyTables: prev.godleyTables.map(t =>
        t.id === tableId
          ? {
              ...t,
              rows: t.rows.map((r, ri) => (ri === rowIndex ? { ...r, label } : r)),
            }
          : t
      ),
    }))
  }, [])

  // ── Wiring Canvas ──
  const handleModelChange = useCallback((updater: (model: MinskyModel) => MinskyModel) => {
    setModel(updater)
  }, [])

  // ── Current Values Map (for all components) ──
  const allValues = useMemo(() => {
    const map = new Map<string, number>()
    for (const v of Object.values(model.variables)) {
      map.set(v.id, getVariableValue(v.id, model, simState))
    }
    return map
  }, [model, simState])

  // ── Variable name lookup for charts ──
  const variableNames = useMemo(() => {
    const names: Record<string, string> = {}
    for (const v of Object.values(model.variables)) {
      names[v.id] = v.name
    }
    return names
  }, [model])

  // ── Parameter variables ──
  const parameterVars = useMemo(
    () =>
      Object.values(model.variables).filter(v => v.type === 'parameter' && !v.id.startsWith('_')),
    [model]
  )

  // ── Save / Load ──
  const handleSave = useCallback(() => {
    const json = serializeModel(model)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${model.metadata.name.replace(/\s+/g, '_')}.minsky.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [model])

  const handleLoad = useCallback(() => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      const text = await file.text()
      try {
        const loaded = deserializeModel(text)
        setModel(loaded)
        setSimState(resetSimulation(loaded))
      } catch (err) {
        console.error('Failed to load model:', err)
      }
    }
    input.click()
  }, [])

  // ── Active Tab (for tables section) ──
  const [activeView, setActiveView] = useState<'wiring' | 'tables' | 'validate'>('wiring')

  return (
    <div className="minsky-lab" data-theme="dark">
      {/* ── Header ── */}
      <header className="minsky-lab-header">
        <div className="minsky-lab-title-section">
          <h1 className="minsky-lab-title">Minsky Economic Modeler</h1>
          <span className="minsky-lab-model-name">{model.metadata.name}</span>
        </div>
        <div className="minsky-lab-actions">
          <button className="minsky-action-btn" onClick={handleSave}>Save Model</button>
          <button className="minsky-action-btn" onClick={handleLoad}>Load Model</button>
        </div>
      </header>

      {/* ── Parameters + Controls ── */}
      <div className="minsky-lab-controls-bar">
        <ParameterPanel
          parameters={parameterVars}
          configs={KEEN_PARAMETER_CONFIGS}
          onParameterChange={handleParameterChange}
          onResetParameter={handleResetParameter}
        />
        <SimulationControls
          running={simState.running}
          t={simState.t}
          speed={simState.speed}
          onPlay={handlePlay}
          onPause={handlePause}
          onStep={handleStep}
          onReset={handleReset}
          onSpeedChange={handleSpeedChange}
        />
      </div>

      {/* ── Main Content: Wiring/Tables + Charts ── */}
      <div className="minsky-lab-main">
        {/* Left panel: Wiring or Tables */}
        <div className="minsky-lab-left">
          <div className="minsky-lab-view-tabs">
            <button
              className={`minsky-view-tab ${activeView === 'wiring' ? 'active' : ''}`}
              onClick={() => setActiveView('wiring')}
            >
              Wiring Diagram
            </button>
            <button
              className={`minsky-view-tab ${activeView === 'tables' ? 'active' : ''}`}
              onClick={() => setActiveView('tables')}
            >
              Godley Tables
            </button>
            <button
              className={`minsky-view-tab ${activeView === 'validate' ? 'active' : ''}`}
              onClick={() => setActiveView('validate')}
            >
              Sanity Checks
            </button>
          </div>

          {activeView === 'wiring' && (
            <WiringCanvas
              model={model}
              currentValues={allValues}
              onModelChange={handleModelChange}
            />
          )}
          {activeView === 'tables' && (
            <div className="minsky-lab-tables">
              {model.godleyTables.map(table => (
                <GodleyTable
                  key={table.id}
                  table={table}
                  allValues={allValues}
                  onCellChange={handleCellChange}
                  onRowAdd={handleRowAdd}
                  onRowRemove={handleRowRemove}
                  onRowLabelChange={handleRowLabelChange}
                />
              ))}
            </div>
          )}
          {activeView === 'validate' && (
            <div className="minsky-lab-tables">
              <ValidationPanel model={model} state={simState} allValues={allValues} />
            </div>
          )}
        </div>

        {/* Right panel: Charts */}
        <div className="minsky-lab-right">
          <SimulationCharts
            chartConfigs={model.chartConfigs}
            history={simState.history}
            variableNames={variableNames}
          />
        </div>
      </div>

      {/* ── Footer Info ── */}
      <footer className="minsky-lab-footer">
        <span>Based on Steve Keen's Post-Keynesian Macroeconomic Framework</span>
        <span>Stock-Flow Consistent Modeling with Endogenous Money</span>
      </footer>
    </div>
  )
}
