/**
 * Strategy Configuration Panel
 *
 * Handles all simulation configuration: teams, rounds, scenarios, strategies
 */

import { SIMULATION_CONFIG, generateSeed } from '../../engine/simulationConfig'
import { getAllStrategies } from '../../engine/strategyEngine'
import type { RoundScenario } from '../../engine/gameEngine'

interface StrategyConfigPanelProps {
  // Mode
  mode: 'visualizer' | 'experiment'
  experimentType: string
  setExperimentType: (type: string) => void
  gamesCount: number
  setGamesCount: (count: number) => void

  // Basic config
  teamCount: number
  setTeamCount: (count: number) => void
  rounds: number
  setRounds: (rounds: number) => void
  simulationSeed: number
  setSimulationSeed: (seed: number) => void

  // Scenario config
  scenarioMode: 'single' | 'random' | 'custom'
  setScenarioMode: (mode: 'single' | 'random' | 'custom') => void
  singleScenarioId: number
  setSingleScenarioId: (id: number) => void
  scenarioSequence: number[]
  setScenarioSequence: (sequence: number[]) => void
  availableScenarios: RoundScenario[]

  // Strategy config
  selectedStrategies: string[]
  setSelectedStrategies: (strategies: string[]) => void

  // Advanced config
  showAdvancedConfig: boolean
  setShowAdvancedConfig: (show: boolean) => void
  advConfig: {
    capacityPerPlant: number
    startingCash: number
    plantCostUS: number
    plantCostAsia: number
    globalElasticity: number
    globalDemand: number
  }
  setAdvConfig: (config: StrategyConfigPanelProps['advConfig']) => void

  // Actions
  onRun: () => void
  isRunning: boolean
  currentProgress?: number
  error: string | null

  // Team colors
  teamColors: string[]
}

export function StrategyConfigPanel(props: StrategyConfigPanelProps) {
  const availableStrategies = getAllStrategies()

  return (
    <aside className="sl-sidebar">
      <div className="sl-card">
        <div className="sl-card-title">{props.mode === 'experiment' ? 'Experiment Setup' : 'Configuration'}</div>

        {/* Experiment Type Selector */}
        {props.mode === 'experiment' && (
          <div className="sl-form-group">
            <label className="sl-label">Research Question</label>
            <select
              className="sl-select"
              value={props.experimentType}
              onChange={(e) => props.setExperimentType(e.target.value)}
              disabled={props.isRunning}
            >
              <option value="price_war">Do price wars reduce industry profit?</option>
              <option value="innovator_advantage">Does first-mover R&D pay off?</option>
              <option value="esg_long_term">Is ESG profitable in long run?</option>
              <option value="nash_equilibrium">Do rational agents converge to Nash Eq?</option>
              <option value="green_haven">Green Haven: Can CSR insure against crashes?</option>
              <option value="fast_follower_trap">Fast-Follower Trap: Is entering late safe?</option>
              <option value="endogenous_fragility">Endogenous Fragility: Can one error crash the market?</option>
              <option value="custom">Custom Experiment</option>
            </select>
          </div>
        )}

        {/* Batch Size */}
        {props.mode === 'experiment' && (
          <div className="sl-form-group">
            <label className="sl-label">Sample Size (Games)</label>
            <select
              className="sl-select"
              value={props.gamesCount}
              onChange={(e) => props.setGamesCount(Number(e.target.value))}
              disabled={props.isRunning}
            >
              <option value="10">10 (Quick Test)</option>
              <option value="50">50 (Standard)</option>
              <option value="100">100 (Robust)</option>
              <option value="500">500 (Research Grade)</option>
            </select>
          </div>
        )}

        {/* Team Count */}
        <div className="sl-form-group">
          <label className="sl-label">Team Count</label>
          <select
            className="sl-select"
            value={props.teamCount}
            onChange={(e) => props.setTeamCount(parseInt(e.target.value))}
            disabled={props.isRunning}
          >
            {[2, 3, 4, 5, 6, 7, 8].map(n => <option key={n} value={n}>{n} Teams</option>)}
          </select>
        </div>

        {/* Rounds */}
        <div className="sl-form-group">
          <label className="sl-label">Simulation Rounds</label>
          <input
            type="number"
            className="sl-input"
            value={props.rounds}
            onChange={(e) => props.setRounds(parseInt(e.target.value) || SIMULATION_CONFIG.DEFAULTS.ROUNDS)}
            disabled={props.isRunning}
            min={SIMULATION_CONFIG.LIMITS.MIN_ROUNDS}
            max={SIMULATION_CONFIG.LIMITS.MAX_ROUNDS}
          />
        </div>

        {/* Simulation Seed */}
        <div className="sl-form-group">
          <label className="sl-label">Simulation Seed (Reproducibility)</label>
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            <input
              type="number"
              className="sl-input"
              value={props.simulationSeed}
              onChange={(e) => props.setSimulationSeed(parseInt(e.target.value) || 0)}
              disabled={props.isRunning}
            />
            <button
              className="sl-btn-nav"
              onClick={() => props.setSimulationSeed(generateSeed())}
              title="Generate New Seed"
              disabled={props.isRunning}
            >
              🎲
            </button>
          </div>
        </div>

        {/* Scenario Mode */}
        <div className="sl-form-group">
          <label className="sl-label">Market Scenario</label>
          <select
            className="sl-select"
            value={props.scenarioMode}
            onChange={(e) => props.setScenarioMode(e.target.value as StrategyConfigPanelProps['scenarioMode'])}
            disabled={props.isRunning}
          >
            <option value="single">Single Scenario</option>
            <option value="random">Randomization</option>
            <option value="custom">Custom Sequence</option>
          </select>
        </div>

        {/* Single Scenario Selector */}
        {props.scenarioMode === 'single' && (
          <div className="sl-form-group">
            <select
              className="sl-select"
              value={props.singleScenarioId}
              onChange={(e) => props.setSingleScenarioId(parseInt(e.target.value))}
              disabled={props.isRunning}
            >
              {props.availableScenarios.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        )}

        {/* Custom Scenario Sequence */}
        {props.scenarioMode === 'custom' && (
          <div className="sl-form-group">
            <label className="sl-label" style={{ fontSize: '0.85rem', marginBottom: '0.5rem' }}>
              Scenario Sequence ({props.scenarioSequence.length} rounds configured)
            </label>
            <div style={{
              maxHeight: '200px',
              overflowY: 'auto',
              border: '1px solid var(--border-color)',
              borderRadius: '6px',
              padding: '0.5rem',
              background: 'var(--bg-subtle)'
            }}>
              {props.scenarioSequence.map((scenarioId, idx) => {
                return (
                  <div key={idx} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    marginBottom: '0.5rem',
                    padding: '0.4rem',
                    background: 'var(--bg-card)',
                    borderRadius: '4px'
                  }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', minWidth: '30px' }}>
                      R{idx + 1}:
                    </span>
                    <select
                      className="sl-select"
                      style={{ flex: 1, padding: '0.3rem', fontSize: '0.85rem' }}
                      value={scenarioId}
                      onChange={(e) => {
                        const newSeq = [...props.scenarioSequence]
                        newSeq[idx] = parseInt(e.target.value)
                        props.setScenarioSequence(newSeq)
                      }}
                      disabled={props.isRunning}
                    >
                      {props.availableScenarios.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                    <button
                      className="sl-btn-nav"
                      style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                      onClick={() => {
                        const newSeq = props.scenarioSequence.filter((_, i) => i !== idx)
                        props.setScenarioSequence(newSeq.length > 0 ? newSeq : [SIMULATION_CONFIG.DEFAULTS.SCENARIO_ID])
                      }}
                      disabled={props.isRunning || props.scenarioSequence.length <= 1}
                      title="Remove round"
                    >
                      ✕
                    </button>
                  </div>
                )
              })}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
              <button
                className="sl-btn-nav"
                style={{ flex: 1 }}
                onClick={() => props.setScenarioSequence([...props.scenarioSequence, props.singleScenarioId])}
                disabled={props.isRunning}
              >
                + Add Round
              </button>
              <button
                className="sl-btn-nav"
                onClick={() => {
                  const seq = []
                  for (let i = 0; i < props.rounds; i++) {
                    seq.push(props.scenarioSequence[i % props.scenarioSequence.length] || SIMULATION_CONFIG.DEFAULTS.SCENARIO_ID)
                  }
                  props.setScenarioSequence(seq)
                }}
                disabled={props.isRunning}
                title="Fill to match round count"
              >
                Fill {props.rounds} Rounds
              </button>
            </div>
          </div>
        )}

        {/* Team Strategies */}
        <div className="sl-form-group">
          <label className="sl-label">Team Strategies</label>
          <div className="sl-strategy-list">
            {Array.from({ length: props.teamCount }).map((_, idx) => (
              <div key={idx} className="sl-strategy-row">
                <div className="sl-team-dot" style={{ background: props.teamColors[idx] }} />
                <span className="sl-team-name">Team {idx + 1}</span>
                <select
                  className="sl-select"
                  style={{ padding: '0.4rem' }}
                  value={props.selectedStrategies[idx]}
                  onChange={(e) => {
                    const ns = [...props.selectedStrategies]
                    ns[idx] = e.target.value
                    props.setSelectedStrategies(ns)
                  }}
                  disabled={props.isRunning}
                >
                  {availableStrategies.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            ))}
          </div>
        </div>

        {/* Advanced Configuration */}
        <div className="sl-form-group" style={{ marginTop: '1rem', borderTop: '1px solid var(--border-main)', paddingTop: '1rem' }}>
          <button
            className="sl-btn-nav"
            style={{ width: '100%', justifyContent: 'space-between', padding: '0.6rem' }}
            onClick={() => props.setShowAdvancedConfig(!props.showAdvancedConfig)}
          >
            <span>⚙️ Advanced Factory Config</span>
            <span>{props.showAdvancedConfig ? '−' : '+'}</span>
          </button>

          {props.showAdvancedConfig && (
            <div style={{ marginTop: '1rem', background: 'rgba(0,0,0,0.05)', padding: '0.8rem', borderRadius: '8px' }}>
              <div className="sl-form-group">
                <label className="sl-label" style={{ fontSize: '0.75rem' }}>Capacity per Plant</label>
                <input
                  type="number"
                  className="sl-input"
                  value={props.advConfig.capacityPerPlant}
                  onChange={e => props.setAdvConfig({ ...props.advConfig, capacityPerPlant: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="sl-form-group">
                <label className="sl-label" style={{ fontSize: '0.75rem' }}>Starting Cash ($)</label>
                <input
                  type="number"
                  className="sl-input"
                  value={props.advConfig.startingCash}
                  onChange={e => props.setAdvConfig({ ...props.advConfig, startingCash: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="sl-form-group" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <div>
                  <label className="sl-label" style={{ fontSize: '0.75rem' }}>US Plant Cost</label>
                  <input
                    type="number"
                    className="sl-input"
                    value={props.advConfig.plantCostUS}
                    onChange={e => props.setAdvConfig({ ...props.advConfig, plantCostUS: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <label className="sl-label" style={{ fontSize: '0.75rem' }}>Asia Plant Cost</label>
                  <input
                    type="number"
                    className="sl-input"
                    value={props.advConfig.plantCostAsia}
                    onChange={e => props.setAdvConfig({ ...props.advConfig, plantCostAsia: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>
              <div className="sl-form-group" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '0.5rem' }}>
                <div>
                  <label className="sl-label" style={{ fontSize: '0.75rem' }}>Global Demand</label>
                  <input
                    type="number"
                    step="0.1"
                    className="sl-input"
                    value={props.advConfig.globalDemand}
                    onChange={e => props.setAdvConfig({ ...props.advConfig, globalDemand: parseFloat(e.target.value) || 1.0 })}
                  />
                </div>
                <div>
                  <label className="sl-label" style={{ fontSize: '0.75rem' }}>Price Elasticity</label>
                  <input
                    type="number"
                    step="0.1"
                    className="sl-input"
                    value={props.advConfig.globalElasticity}
                    onChange={e => props.setAdvConfig({ ...props.advConfig, globalElasticity: parseFloat(e.target.value) || 1.0 })}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Run Button */}
        {props.mode === 'experiment' ? (
          <button
            className="sl-btn-run"
            onClick={props.onRun}
            disabled={props.isRunning}
            style={{ background: props.isRunning ? 'var(--text-muted)' : 'var(--text-accent)' }}
          >
            {props.isRunning ? `Running ${props.currentProgress || 0}%...` : 'Run Experiment Batch'}
          </button>
        ) : (
          <button
            className="sl-btn-run"
            onClick={props.onRun}
            disabled={props.isRunning}
          >
            {props.isRunning ? `Simulating...` : 'Launch Simulation'}
          </button>
        )}

        {/* Error Display */}
        {props.error && (
          <div style={{ marginTop: '1rem', color: 'var(--pro-danger)', fontSize: '0.85rem', fontWeight: 600 }}>
            {props.error}
          </div>
        )}
      </div>
    </aside>
  )
}
