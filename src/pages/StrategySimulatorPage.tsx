/**
 * AI Strategy Simulation Lab - Interactive Web Interface
 */

import { useState, useEffect, useRef } from 'react'
import { runStrategySimulation, runBatchSimulation, runTournament, type StrategySimulationConfig, type BatchSimulationConfig, type TournamentResult, type SimulationRoundResult, type TeamFinalStanding, type SimulationInsights, type BatchSimulationResult } from '../engine/strategySimulation'
import { analyzeExperiment, type ExperimentAnalysis } from '../engine/experimentAnalysis'
import { clearCustomStrategies, getAllStrategies, registerCustomStrategy, unregisterCustomStrategy, type StrategyContext } from '../engine/strategyEngine'
import { GAME_CONFIG, type RoundScenario } from '../engine/gameEngine'
import { ExperimentAudit } from '../components/ExperimentAudit'
import scenariosData from '../engine/scenarios.json'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { useLocation, useNavigate } from 'react-router-dom'
import { SIMULATION_CONFIG, validateSimulationConfig, generateSeed } from '../engine/simulationConfig'
import { authApi } from '../api/client'
import { InfoTooltip } from '../components/InfoTooltip'
import { ScenarioBuilder } from '../components/ScenarioBuilder'
import { CalculationAuditPanel } from '../components/CalculationAuditPanel'
import { generateCalculationAudit, type CalculationAudit } from '../engine/calculationAudit'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { SidebarFooter } from '../components/SidebarFooter'
import { RoundDataViewer } from '../components/RoundDataViewer'
import { buildCustomStrategy, parseStudentStrategyFile, type ParsedStudentStrategy } from '../engine/studentStrategyParser'
import { runStudentStrategyInWorkerDetailed } from '../engine/studentStrategyRuntime'
import './DashboardModernPage.css'
import './DecisionsModernPage.css'
import './StrategySimulatorPage.css'

const TEAM_COLORS = SIMULATION_CONFIG.CHARTS.TEAM_COLORS
type AdvancedConfig = {
  capacityPerPlant: number
  startingCash: number
  plantCostUS: number
  plantCostAsia: number
  globalElasticity: number
  globalDemand: number
}
type EducatorSession = {
  success?: boolean
  role?: string
  credits?: number
  email?: string
}

export default function StrategySimulatorPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const isStudentStrategyRoute = location.pathname === '/student-strategy-lab'

  // Theme state
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (document.documentElement.getAttribute('data-theme') as 'light' | 'dark') || 'dark'
  })
  const isDarkMode = theme === 'dark'

  // Configuration state
  const [teamCount, setTeamCount] = useState<number>(SIMULATION_CONFIG.DEFAULTS.TEAM_COUNT)
  const [selectedStrategies, setSelectedStrategies] = useState<string[]>([...SIMULATION_CONFIG.DEFAULT_STRATEGIES])
  const [rounds, setRounds] = useState<number>(SIMULATION_CONFIG.DEFAULTS.ROUNDS)
  const [scenarioMode, setScenarioMode] = useState<'single' | 'random' | 'custom'>('random') // Default to randomization
  const [singleScenarioId, setSingleScenarioId] = useState<number>(SIMULATION_CONFIG.DEFAULTS.SCENARIO_ID)
  const [scenarioSequence, setScenarioSequence] = useState<number[]>([SIMULATION_CONFIG.DEFAULTS.SCENARIO_ID])
  const [simulationSeed, setSimulationSeed] = useState<number>(generateSeed)

  // Simulation state
  const [isRunning, setIsRunning] = useState<boolean>(false)
  const [currentRound, setCurrentRound] = useState<number>(0)
  const [roundResults, setRoundResults] = useState<SimulationRoundResult[]>([])
  const [finalStandings, setFinalStandings] = useState<TeamFinalStanding[]>([])
  const [insights, setInsights] = useState<SimulationInsights | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Advanced Config state
  const [showAdvancedConfig, setShowAdvancedConfig] = useState<boolean>(false)
  const [advConfig, setAdvConfig] = useState<AdvancedConfig>({
    capacityPerPlant: SIMULATION_CONFIG.ADVANCED_DEFAULTS.CAPACITY_PER_PLANT,
    startingCash: SIMULATION_CONFIG.ADVANCED_DEFAULTS.STARTING_CASH,
    plantCostUS: SIMULATION_CONFIG.ADVANCED_DEFAULTS.PLANT_COST_US,
    plantCostAsia: SIMULATION_CONFIG.ADVANCED_DEFAULTS.PLANT_COST_ASIA,
    globalElasticity: SIMULATION_CONFIG.ADVANCED_DEFAULTS.GLOBAL_ELASTICITY,
    globalDemand: SIMULATION_CONFIG.ADVANCED_DEFAULTS.GLOBAL_DEMAND
  })

  // Chart selection state
  // Chart selection state
  const [selectedMetric, setSelectedMetric] = useState<'sharePrice' | 'revenue' | 'profit' | 'production' | 'inventory' | 'unitsSold' | 'marketShare'>('sharePrice')
  const [breakdownViewMode, setBreakdownViewMode] = useState<'percentage' | 'value'>('value')
  const [breakdownMetric, setBreakdownMetric] = useState<'financial' | 'market' | 'operational'>('financial')

  // Experiment state
  const [mode, setMode] = useState<'visualizer' | 'experiment' | 'tournament'>('visualizer') // Default to Visualizer
  const [experimentType, setExperimentType] = useState<string>('price_war')
  const [gamesCount, setGamesCount] = useState<number>(SIMULATION_CONFIG.DEFAULTS.BATCH_GAMES_COUNT)
  const [experimentProgress, setExperimentProgress] = useState<number>(0)
  const [experimentResults, setExperimentResults] = useState<BatchSimulationResult | null>(null)
  const [experimentAnalysis, setExperimentAnalysis] = useState<ExperimentAnalysis | null>(null)
  const [showAudit, setShowAudit] = useState<boolean>(false)
  const [calculationAudits, setCalculationAudits] = useState<CalculationAudit[]>([])
  const [showCalculationAudit, setShowCalculationAudit] = useState<boolean>(false)
  const [showExportMenu, setShowExportMenu] = useState<boolean>(false)

  // Tournament state
  const [tournamentResults, setTournamentResults] = useState<TournamentResult | null>(null)
  const [tournamentProgress, setTournamentProgress] = useState<number>(0)
  const [selectedTournamentStrategies, setSelectedTournamentStrategies] = useState<string[]>([
    'tit-for-tat', 'predatory-pricing', 'premium', 'capacity-leader', 'regional-asia', 'innovator'
  ])
  const [gamesPerMatchup, setGamesPerMatchup] = useState<number>(10)

  // Scenario Builder state
  const [showScenarioBuilder, setShowScenarioBuilder] = useState<boolean>(false)
  const [customScenarios, setCustomScenarios] = useState<RoundScenario[]>([])
  const [uploadedStrategies, setUploadedStrategies] = useState<ParsedStudentStrategy[]>([])
  const [uploadErrors, setUploadErrors] = useState<string[]>([])
  const [strategyTestResults, setStrategyTestResults] = useState<Record<string, { ok: boolean; runtimeMs: number; output: unknown; message: string }>>({})
  const [testingStrategyId, setTestingStrategyId] = useState<string | null>(null)
  const [copiedGuideLink, setCopiedGuideLink] = useState(false)
  const [showStudentGuideModal, setShowStudentGuideModal] = useState<boolean>(false)
  const [studentGuideText, setStudentGuideText] = useState<string>('')
  const [educatorProfile, setEducatorProfile] = useState<{ credits: number; email: string; role: string } | null>(null)
  const [sessionOpen, setSessionOpen] = useState<boolean>(false)
  const accountMenuRef = useRef<HTMLButtonElement>(null)
  const strategyFileInputRef = useRef<HTMLInputElement>(null)


  // Apply theme change
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light')
  }

  const loadProfile = async () => {
    try {
      const res = (await authApi.me('educator')) as EducatorSession
      if (res.success && (res.role === 'educator' || res.role === 'admin')) {
        setEducatorProfile({
          credits: res.credits ?? 0,
          email: res.email,
          role: res.role
        })
      }
    } catch (err) {
      console.error('Failed to load profile', err)
    }
  }

  const handleLogout = async () => {
    await authApi.logout('educator')
    navigate('/educator-login')
  }

  // Available strategies and scenarios
  const availableStrategies = getAllStrategies()
  const uploadedStrategyIdSet = new Set(uploadedStrategies.map((s) => s.id))
  const uploadedStrategyOptions = availableStrategies.filter((s) => uploadedStrategyIdSet.has(s.id))
  const builtInStrategyOptions = availableStrategies.filter((s) => !uploadedStrategyIdSet.has(s.id))
  const availableScenarios = Object.values(scenariosData) as RoundScenario[]

  // Generate scenario sequence based on mode
  const getScenarioSequence = (): number[] => {
    if (scenarioMode === 'single') {
      return Array(rounds).fill(singleScenarioId)
    } else if (scenarioMode === 'random') {
      const seq: number[] = []
      const availableIds = availableScenarios.map(s => s.id)
      for (let i = 0; i < rounds; i++) {
        // Simple sin-based deterministic PRNG
        const val = Math.sin(simulationSeed + i) * 10000
        const randIndex = Math.floor((val - Math.floor(val)) * availableIds.length)
        seq.push(availableIds[randIndex])
      }
      return seq
    } else {
      const seq = [...scenarioSequence]
      while (seq.length < rounds) {
        seq.push(seq[seq.length - 1] || 1)
      }
      return seq.slice(0, rounds)
    }
  }

  // Update selected strategies when team count changes
  useEffect(() => {
    setSelectedStrategies(prev => {
      if (prev.length === teamCount) return prev

      const newStrategies = [...prev]
      // Fill missing slots with default strategies
      while (newStrategies.length < teamCount) {
        const idx = newStrategies.length
        const defaultStrategy = SIMULATION_CONFIG.DEFAULT_STRATEGIES[idx % SIMULATION_CONFIG.DEFAULT_STRATEGIES.length]
        newStrategies.push(defaultStrategy)
      }
      return newStrategies.slice(0, teamCount)
    })
  }, [teamCount])

  useEffect(() => {
    loadProfile()
  }, [])

  useEffect(() => {
    return () => {
      clearCustomStrategies()
    }
  }, [])

  useEffect(() => {
    if (isStudentStrategyRoute && mode !== 'visualizer') {
      setMode('visualizer')
    }
  }, [isStudentStrategyRoute, mode])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (accountMenuRef.current && !accountMenuRef.current.contains(event.target as Node)) {
        setSessionOpen(false)
      }
    }

    if (sessionOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [sessionOpen])

  // ============================================================================
  // EXPERIMENT PERSISTENCE
  // ============================================================================

  interface SavedExperiment {
    name: string
    timestamp: number
    config: {
      mode: 'visualizer' | 'experiment' | 'tournament'
      experimentType?: string
      teamCount: number
      selectedStrategies: string[]
      rounds: number
      scenarioMode: 'single' | 'random' | 'custom'
      singleScenarioId: number
      scenarioSequence: number[]
      gamesCount: number
      advConfig: typeof advConfig
      selectedTournamentStrategies?: string[]
      gamesPerMatchup?: number
    }
  }

  const [savedExperiments, setSavedExperiments] = useState<SavedExperiment[]>(() => {
    const saved = localStorage.getItem('bonopoly_saved_experiments')
    return saved ? JSON.parse(saved) : []
  })

  const saveCurrentExperiment = (name: string) => {
    const experiment: SavedExperiment = {
      name,
      timestamp: Date.now(),
      config: {
        mode,
        experimentType,
        teamCount,
        selectedStrategies,
        rounds,
        scenarioMode,
        singleScenarioId,
        scenarioSequence,
        gamesCount,
        advConfig,
        selectedTournamentStrategies,
        gamesPerMatchup
      }
    }

    const updated = [...savedExperiments, experiment]
    setSavedExperiments(updated)
    localStorage.setItem('bonopoly_saved_experiments', JSON.stringify(updated))
  }

  const loadExperiment = (experiment: SavedExperiment) => {
    setMode(experiment.config.mode)
    if (experiment.config.experimentType) setExperimentType(experiment.config.experimentType)
    setTeamCount(experiment.config.teamCount)
    setSelectedStrategies(experiment.config.selectedStrategies)
    setRounds(experiment.config.rounds)
    setScenarioMode(experiment.config.scenarioMode)
    setSingleScenarioId(experiment.config.singleScenarioId)
    setScenarioSequence(experiment.config.scenarioSequence)
    setGamesCount(experiment.config.gamesCount)
    setAdvConfig(experiment.config.advConfig)
    if (experiment.config.selectedTournamentStrategies) {
      setSelectedTournamentStrategies(experiment.config.selectedTournamentStrategies)
    }
    if (experiment.config.gamesPerMatchup) {
      setGamesPerMatchup(experiment.config.gamesPerMatchup)
    }
  }

  const deleteExperiment = (timestamp: number) => {
    const updated = savedExperiments.filter(e => e.timestamp !== timestamp)
    setSavedExperiments(updated)
    localStorage.setItem('bonopoly_saved_experiments', JSON.stringify(updated))
  }

  const exportExperiment = (experiment: SavedExperiment) => {
    const json = JSON.stringify(experiment, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${experiment.name.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const importExperiment = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = (e: Event) => {
      const target = e.target as HTMLInputElement
      const file = target.files?.[0]
      if (!file) return

      const reader = new FileReader()
      reader.onload = (event) => {
        try {
          const experiment = JSON.parse(event.target?.result as string) as SavedExperiment
          const updated = [...savedExperiments, experiment]
          setSavedExperiments(updated)
          localStorage.setItem('bonopoly_saved_experiments', JSON.stringify(updated))
        } catch {
          setError('Failed to import experiment: Invalid JSON file')
        }
      }
      reader.readAsText(file)
    }
    input.click()
  }

  const handleStrategyUploadClick = () => {
    strategyFileInputRef.current?.click()
  }

  const handleStrategyFilesSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    const nextErrors: string[] = []
    const parsedItems: ParsedStudentStrategy[] = []

    for (const file of Array.from(files as FileList)) {
      try {
        const parsed = await parseStudentStrategyFile(file)
        registerCustomStrategy(buildCustomStrategy(parsed))
        parsedItems.push(parsed)
      } catch (err) {
        const fileName = (file as File).name || 'uploaded file'
        nextErrors.push(err instanceof Error ? err.message : `Failed to parse ${fileName}`)
      }
    }

    if (parsedItems.length > 0) {
      setUploadedStrategies((prev) => {
        const map = new Map(prev.map((item) => [item.id, item]))
        parsedItems.forEach((item) => map.set(item.id, item))
        return Array.from(map.values())
      })
    }

    setUploadErrors(nextErrors)
    event.target.value = ''
  }

  const handleRemoveUploadedStrategy = (strategyId: string) => {
    unregisterCustomStrategy(strategyId)
    setUploadedStrategies((prev) => prev.filter((s) => s.id !== strategyId))
    setStrategyTestResults((prev) => {
      const next = { ...prev }
      delete next[strategyId]
      return next
    })
    setSelectedStrategies((prev) => prev.map((id) => (id === strategyId ? 'tit-for-tat' : id)))
    setSelectedTournamentStrategies((prev) => prev.filter((id) => id !== strategyId))
  }

  const handleClearUploadedStrategies = () => {
    clearCustomStrategies()
    setUploadedStrategies([])
    setUploadErrors([])
    setStrategyTestResults({})
    setSelectedStrategies((prev) => prev.map((id) => (id.startsWith('student-') ? 'tit-for-tat' : id)))
    setSelectedTournamentStrategies((prev) => prev.filter((id) => !id.startsWith('student-')))
  }

  const openStudentGuideModal = async () => {
    setShowStudentGuideModal(true)
    if (studentGuideText) return

    try {
      const response = await fetch('/strategy-lab/Strategy_Lab_Student_Guide.md')
      const text = await response.text()
      setStudentGuideText(text)
    } catch {
      setStudentGuideText('Unable to load full guide. Please use the standalone guide link.')
    }
  }

  const handleCopyGuideLink = () => {
    const url = `${window.location.origin}/strategy-lab/student-guide`
    navigator.clipboard.writeText(url).then(() => {
      setCopiedGuideLink(true)
      setTimeout(() => setCopiedGuideLink(false), 2000)
    })
  }

  const buildDryRunContext = (): StrategyContext => ({
    round: 3,
    totalRounds: 20,
    scenarioId: 1,
    myTeam: {
      id: 1,
      name: 'Team Alpha',
      cash: 25_000_000,
      debt: 8_000_000,
      sharePrice: 126,
      marketCap: 126_000_000,
      factories: { us: 1, asia: 1 },
      inventory: { us: 14000, asia: 18000 },
      production: { us: 120000, asia: 140000 },
      marketShare: { us: 0.24, asia: 0.22, europe: 0.2 },
      sales: { us: 110000, asia: 130000, europe: 90000 },
      prices: { us: 126, asia: 112, europe: 131 },
    },
    competitors: [
      {
        id: 2,
        name: 'Team Beta',
        cash: 20_000_000,
        debt: 10_000_000,
        sharePrice: 118,
        marketCap: 118_000_000,
        factories: { us: 1, asia: 1 },
        inventory: { us: 12000, asia: 22000 },
        production: { us: 115000, asia: 145000 },
        marketShare: { us: 0.23, asia: 0.25, europe: 0.21 },
        sales: { us: 108000, asia: 136000, europe: 94000 },
        prices: { us: 121, asia: 108, europe: 127 },
        previousPrices: { us: 124, asia: 110, europe: 129 },
      },
      {
        id: 3,
        name: 'Team Gamma',
        cash: 31_000_000,
        debt: 5_000_000,
        sharePrice: 134,
        marketCap: 134_000_000,
        factories: { us: 2, asia: 1 },
        inventory: { us: 19000, asia: 9000 },
        production: { us: 150000, asia: 100000 },
        marketShare: { us: 0.27, asia: 0.18, europe: 0.23 },
        sales: { us: 123000, asia: 97000, europe: 98000 },
        prices: { us: 132, asia: 118, europe: 136 },
        previousPrices: { us: 130, asia: 116, europe: 134 },
      }
    ],
    marketData: {
      avgPrice: { us: 126, asia: 112, europe: 131 },
      avgMarketShare: 0.25,
      totalDemand: { us: 520000, asia: 1220000, europe: 360000 },
      competitorCount: 4,
      priceRange: { min: 95, max: 170 },
    },
    history: [
      { round: 1, myDecision: {}, myResults: {}, marketSnapshot: {} },
      { round: 2, myDecision: {}, myResults: {}, marketSnapshot: {} },
    ],
    strategyState: {},
  })

  const handleDryRunStrategy = async (strategy: ParsedStudentStrategy) => {
    setTestingStrategyId(strategy.id)
    const start = performance.now()
    try {
      const runResult = await runStudentStrategyInWorkerDetailed(strategy.source, buildDryRunContext())
      const runtimeMs = Math.round((performance.now() - start) * 100) / 100
      const output = runResult.modifiers || {}
      const hasOutput = output && typeof output === 'object' && Object.keys(output as Record<string, unknown>).length > 0

      let message = ''
      let ok = false
      if (runResult.timedOut) {
        message = runResult.error || 'Execution timeout'
      } else if (!runResult.ok) {
        message = runResult.error || 'Execution error'
      } else if (!hasOutput) {
        message = 'No valid strategy fields returned (empty after validation)'
      } else {
        message = 'Dry run passed'
        ok = true
      }

      setStrategyTestResults((prev) => ({
        ...prev,
        [strategy.id]: {
          ok,
          runtimeMs,
          output,
          message,
        },
      }))
    } catch (error) {
      const runtimeMs = Math.round((performance.now() - start) * 100) / 100
      setStrategyTestResults((prev) => ({
        ...prev,
        [strategy.id]: {
          ok: false,
          runtimeMs,
          output: {},
          message: error instanceof Error ? error.message : 'Dry run failed',
        },
      }))
    } finally {
      setTestingStrategyId(null)
    }
  }

  const handleOpenGuideNewTab = () => {
    window.open(`${window.location.origin}/strategy-lab/student-guide`, '_blank')
  }

  const renderStudentStrategyPanel = () => (
    <div className="sl-card ssp-panel" style={{ marginBottom: '1rem' }}>
      <div className="sl-card-title">Student Strategies</div>
      <input
        ref={strategyFileInputRef}
        type="file"
        accept=".js,.mjs"
        multiple
        style={{ display: 'none' }}
        onChange={handleStrategyFilesSelected}
        disabled={isRunning}
      />

      {/* Top bar: Upload left, Resources right */}
      <div className="ssp-topbar">
        <div className="ssp-topbar-left">
          <button className="sl-btn-nav ssp-btn-primary" type="button" onClick={handleStrategyUploadClick} disabled={isRunning}>
            Upload .js Files
          </button>
          {uploadedStrategies.length > 0 && (
            <button className="sl-btn-nav ssp-btn-danger ssp-btn-sm" type="button" onClick={handleClearUploadedStrategies} disabled={isRunning}>
              Clear All
            </button>
          )}
        </div>
        <div className="ssp-topbar-right">
          <a className="sl-btn-nav ssp-btn-sm" href="/strategy-lab/student_strategy_template.js" download>Template ⭳</a>
          <a className="sl-btn-nav ssp-btn-sm" href="/strategy-lab/samples/sample_cost_guard.js" download>Sample 1 ⭳</a>
          <a className="sl-btn-nav ssp-btn-sm" href="/strategy-lab/samples/sample_share_chaser.js" download>Sample 2 ⭳</a>
          <span className="ssp-divider" />
          <button className="sl-btn-nav ssp-btn-sm" type="button" onClick={openStudentGuideModal}>Read Guide</button>
          <button className="sl-btn-nav ssp-btn-sm" type="button" onClick={handleOpenGuideNewTab}>Open Guide &#8599;</button>
          <button className="ssp-copy-icon" type="button" onClick={handleCopyGuideLink} title="Copy guide link">
            {copiedGuideLink ? '✓' : '⧉'}
          </button>
        </div>
      </div>

      {/* Uploaded strategies list — expands below when files are added */}
      {uploadedStrategies.length > 0 && (
        <div className="ssp-uploaded-list">
          {uploadedStrategies.map((item) => (
            <div key={item.id} className="ssp-uploaded-item">
              <div style={{ minWidth: 0 }}>
                <div className="ssp-uploaded-name">{item.name}</div>
                <div className="ssp-uploaded-author">by {item.author}</div>
              </div>
              <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                <button
                  className="sl-btn-nav ssp-btn-sm"
                  type="button"
                  onClick={() => handleDryRunStrategy(item)}
                  disabled={isRunning || testingStrategyId === item.id}
                >
                  {testingStrategyId === item.id ? 'Testing...' : 'Test'}
                </button>
                <button
                  className="sl-btn-nav ssp-btn-sm"
                  type="button"
                  onClick={() => handleRemoveUploadedStrategy(item.id)}
                  disabled={isRunning}
                >
                  Remove
                </button>
              </div>
              {strategyTestResults[item.id] && (
                <div style={{ width: '100%', marginTop: '0.45rem' }}>
                  <div style={{ fontSize: '0.72rem', color: strategyTestResults[item.id].ok ? '#16a34a' : '#f59e0b', marginBottom: '0.35rem' }}>
                    {strategyTestResults[item.id].message} ({strategyTestResults[item.id].runtimeMs}ms)
                  </div>
                  <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: '0.7rem', lineHeight: 1.35, border: '1px solid var(--border-color)', borderRadius: '6px', padding: '0.45rem', background: 'var(--bg-card)' }}>
                    {JSON.stringify(strategyTestResults[item.id].output, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {uploadErrors.length > 0 && (
        <div className="ssp-errors">
          {uploadErrors.map((msg, idx) => (
            <div key={`${msg}-${idx}`}>{msg}</div>
          ))}
        </div>
      )}
    </div>
  )

  // ============================================================================
  // SIMULATION RUNNERS
  // ============================================================================

  // Run simulation
  const handleRunSimulation = async () => {
    // Validate configuration before running
    const validation = validateSimulationConfig({
      teamCount,
      rounds,
      capacityPerPlant: advConfig.capacityPerPlant,
      startingCash: advConfig.startingCash,
      plantCostUS: advConfig.plantCostUS,
      plantCostAsia: advConfig.plantCostAsia,
    })

    if (!validation.valid) {
      setError(validation.errors.join('; '))
      return
    }

    setIsRunning(true)
    setCurrentRound(0)
    setRoundResults([])
    setFinalStandings([])
    setInsights(null)
    setError(null)

    try {
      const scenarioSeq = getScenarioSequence()

      const config: StrategySimulationConfig = {
        teamCount,
        strategies: selectedStrategies,
        rounds,
        scenarioId: scenarioSeq[0],
        scenarioSequence: scenarioSeq,
        simulationSeed,
        marketDemandMultiplier: advConfig.globalDemand,
        gameConfigOverrides: {
          capacityPerPlant: advConfig.capacityPerPlant,
          financial: { ...GAME_CONFIG.financial, startingCash: advConfig.startingCash },
          investment: { ...GAME_CONFIG.investment, plantCostUS: advConfig.plantCostUS, plantCostAsia: advConfig.plantCostAsia },
          priceDemand: {
            ...GAME_CONFIG.priceDemand,
            elasticityByRegion: {
              us: GAME_CONFIG.priceDemand.elasticityByRegion.us * advConfig.globalElasticity,
              asia: GAME_CONFIG.priceDemand.elasticityByRegion.asia * advConfig.globalElasticity,
              europe: GAME_CONFIG.priceDemand.elasticityByRegion.europe * advConfig.globalElasticity
            }
          }
        }
      }

      const results = await runSimulationWithProgress(config, scenarioSeq)

      setFinalStandings(results.finalStandings)
      setInsights(results.insights)

      // Generate calculation audits for each round
      const audits: CalculationAudit[] = []
      const scenarios = scenariosData as Record<string, RoundScenario>

      for (let i = 0; i < results.rounds.length; i++) {
        const round = results.rounds[i]
        const scenarioId = scenarioSeq[i] || scenarioSeq[0]

        // scenarios.json is an object, not an array, so access by key
        const scenario = scenarios[scenarioId] || scenarios[0] || {
          id: scenarioId,
          name: `Scenario ${scenarioId}`,
          demandModifier: { us: 0, asia: 0, europe: 0 },
          priceElasticityModifier: 1,
          csrImportanceModifier: 1,
          marketingEffectModifier: 1,
          costInflation: 1,
          investmentCostMultiplier: 1,
          interestRateSpread: 0
        }

        const prevRound = i > 0 ? results.rounds[i - 1] : undefined

        try {
          const audit = generateCalculationAudit(
            round,
            i + 1,
            scenario,
            config.gameConfigOverrides || GAME_CONFIG,
            prevRound
          )
          audits.push(audit)
        } catch (auditErr) {
          console.error('Error generating audit for round', i + 1, auditErr)
        }
      }

      console.log('Generated audits:', audits.length, 'for', results.rounds.length, 'rounds')
      setCalculationAudits(audits)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Simulation failed')
      console.error('Simulation error:', err)
    } finally {
      setIsRunning(false)
    }
  }

  // Run Experiment (Batch)
  const handleRunExperiment = async () => {
    // Validate configuration before running
    const validation = validateSimulationConfig({
      teamCount,
      rounds,
      capacityPerPlant: advConfig.capacityPerPlant,
      startingCash: advConfig.startingCash,
      plantCostUS: advConfig.plantCostUS,
      plantCostAsia: advConfig.plantCostAsia,
    })

    if (!validation.valid) {
      setError(validation.errors.join('; '))
      return
    }

    if (gamesCount < SIMULATION_CONFIG.LIMITS.MIN_BATCH_SIZE ||
        gamesCount > SIMULATION_CONFIG.LIMITS.MAX_BATCH_SIZE) {
      setError(`Batch size must be between ${SIMULATION_CONFIG.LIMITS.MIN_BATCH_SIZE} and ${SIMULATION_CONFIG.LIMITS.MAX_BATCH_SIZE}`)
      return
    }

    setIsRunning(true)
    setExperimentProgress(0)
    setExperimentResults(null)
    setExperimentAnalysis(null)
    setError(null)

    try {
      const config: BatchSimulationConfig = {
        teamCount,
        strategies: selectedStrategies,
        rounds,
        scenarioId: singleScenarioId, // Improve to handle random scenario properly if needed
        scenarioSequence: getScenarioSequence(), // Ensure random sequence is used if 'random' mode
        gamesCount,
        experimentName: experimentType,
        silent: true,
        simulationSeed,
        marketDemandMultiplier: advConfig.globalDemand,
        gameConfigOverrides: {
          capacityPerPlant: advConfig.capacityPerPlant,
          financial: { ...GAME_CONFIG.financial, startingCash: advConfig.startingCash },
          investment: { ...GAME_CONFIG.investment, plantCostUS: advConfig.plantCostUS, plantCostAsia: advConfig.plantCostAsia },
          priceDemand: {
            ...GAME_CONFIG.priceDemand,
            elasticityByRegion: {
              us: GAME_CONFIG.priceDemand.elasticityByRegion.us * advConfig.globalElasticity,
              asia: GAME_CONFIG.priceDemand.elasticityByRegion.asia * advConfig.globalElasticity,
              europe: GAME_CONFIG.priceDemand.elasticityByRegion.europe * advConfig.globalElasticity
            }
          }
        }
      }

      const results = await runBatchSimulation(config, (completed, total) => {
        setExperimentProgress(Math.round((completed / total) * 100))
      })

      setExperimentResults(results)
      setExperimentAnalysis(analyzeExperiment(results))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Experiment failed')
      console.error('Experiment error:', err)
    } finally {
      setIsRunning(false)
    }
  }

  // Run Tournament
  const handleRunTournament = async () => {
    // Validate configuration
    const validation = validateSimulationConfig({
      teamCount: 2, // Tournament is always 2-player matchups
      rounds,
      capacityPerPlant: advConfig.capacityPerPlant,
      startingCash: advConfig.startingCash,
      plantCostUS: advConfig.plantCostUS,
      plantCostAsia: advConfig.plantCostAsia,
    })

    if (!validation.valid) {
      setError(validation.errors.join('; '))
      return
    }

    setIsRunning(true)
    setTournamentProgress(0)
    setTournamentResults(null)
    setError(null)

    try {
      const tournamentConfig = {
        strategies: selectedTournamentStrategies,
        rounds,
        gamesPerMatchup,
        scenarioMode: scenarioMode === 'random' ? 'random' as const : 'single' as const,
        scenarioId: singleScenarioId,
        simulationSeed,
        marketDemandMultiplier: advConfig.globalDemand,
        gameConfigOverrides: {
          capacityPerPlant: advConfig.capacityPerPlant,
          financial: { ...GAME_CONFIG.financial, startingCash: advConfig.startingCash },
          investment: { ...GAME_CONFIG.investment, plantCostUS: advConfig.plantCostUS, plantCostAsia: advConfig.plantCostAsia },
          priceDemand: {
            ...GAME_CONFIG.priceDemand,
            elasticityByRegion: {
              us: GAME_CONFIG.priceDemand.elasticityByRegion.us * advConfig.globalElasticity,
              asia: GAME_CONFIG.priceDemand.elasticityByRegion.asia * advConfig.globalElasticity,
              europe: GAME_CONFIG.priceDemand.elasticityByRegion.europe * advConfig.globalElasticity
            }
          }
        }
      }

      const results = await runTournament(tournamentConfig, (completed, total) => {
        setTournamentProgress(Math.round((completed / total) * 100))
      })

      setTournamentResults(results)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tournament failed')
      console.error('Tournament error:', err)
    } finally {
      setIsRunning(false)
    }
  }

  // Preset Experiments Configuration
  useEffect(() => {
    if (mode === 'experiment') {
      if (experimentType === 'price_war') {
        setTeamCount(4)
        setSelectedStrategies(['predatory-pricing', 'predatory-pricing', 'predatory-pricing', 'tit-for-tat'])
        setRounds(12)
        setScenarioMode('random')
        setAdvConfig({ ...advConfig, globalElasticity: 1.5, globalDemand: 0.9 })
      } else if (experimentType === 'innovator_advantage') {
        setTeamCount(4)
        setSelectedStrategies(['premium', 'tit-for-tat', 'tit-for-tat', 'tit-for-tat'])
        setRounds(20)
        setScenarioMode('single')
        setSingleScenarioId(1) // Asia Boom
        setAdvConfig({ ...advConfig, startingCash: 80000000 })
      } else if (experimentType === 'esg_long_term') {
        setTeamCount(4)
        setSelectedStrategies(['premium', 'premium', 'capacity-leader', 'capacity-leader'])
        setRounds(25)
        setScenarioMode('random')
        setAdvConfig({ ...advConfig, globalDemand: 1.2 })
      } else if (experimentType === 'nash_equilibrium') {
        setTeamCount(4)
        setSelectedStrategies(['tit-for-tat', 'tit-for-tat', 'tit-for-tat', 'tit-for-tat'])
        setRounds(30)
        setScenarioMode('single')
        setSingleScenarioId(0) // Stable
      } else if (experimentType === 'green_haven') {
        setTeamCount(4)
        setSelectedStrategies(['premium', 'capacity-leader', 'capacity-leader', 'capacity-leader'])
        setRounds(20)
        setScenarioMode('custom')
        // Scenario 1 (Normal) for 10 rounds, Scenario 11 (Recession) for Round 11, then back.
      } else if (experimentType === 'fast_follower_trap') {
        setTeamCount(4)
        setSelectedStrategies(['innovator', 'tit-for-tat', 'tit-for-tat', 'tit-for-tat'])
        setRounds(15)
        setScenarioMode('single')
        setSingleScenarioId(1)
      } else if (experimentType === 'endogenous_fragility') {
        setTeamCount(4)
        setSelectedStrategies(['tit-for-tat', 'tit-for-tat', 'tit-for-tat', 'tit-for-tat'])
        setRounds(20)
        setScenarioMode('single')
        setSingleScenarioId(0)
      }
    }
  }, [experimentType, mode])

  async function runSimulationWithProgress(config: StrategySimulationConfig, scenarioSeq: number[]): Promise<Awaited<ReturnType<typeof runStrategySimulation>>> {
    void scenarioSeq
    const results = await runStrategySimulation(config)
    for (let i = 0; i < results.rounds.length; i++) {
      await new Promise(resolve => setTimeout(resolve, SIMULATION_CONFIG.ANIMATION.ROUND_DELAY))
      setCurrentRound(i + 1)
      setRoundResults(prev => [...prev, results.rounds[i]])
    }
    return results
  }

  // Data Export Logic
  const handleExportData = (format: 'json' | 'csv') => {
    const data = mode === 'visualizer' ? roundResults : experimentResults;
    if (!data) return;

    if (format === 'json') {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bonopoly_research_${mode}_${simulationSeed}.json`;
      a.click();
    } else {
      // Basic CSV for Visualizer
      if (mode === 'visualizer') {
        let csv = 'Round,Team,Strategy,SharePrice,MarketShare,Profit\n';
        roundResults.forEach((r, idx) => {
          r.teams.forEach(t => {
            csv += `${idx + 1},${t.teamName},${t.strategyId},${t.sharePrice},${t.avgMarketShare},${t.profit}\n`;
          });
        });
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `bonopoly_research_rounds_${simulationSeed}.csv`;
        a.click();
      }
    }
  }

  const getChartData = (metric: 'sharePrice' | 'revenue' | 'profit' | 'production' | 'inventory' | 'unitsSold' | 'marketShare') => {
    if (roundResults.length === 0) return []
    const teamNames = roundResults[0]?.teams.map(t => t.teamName) || []

    return roundResults.map((round, idx) => {
      const dataPoint: Record<string, string | number> = { round: `R${idx + 1}` }

      teamNames.forEach((teamName, teamIndex) => {

        const team = round.teams[teamIndex]
        let value = 0

        if (metric === 'sharePrice') value = team?.sharePrice || 0
        else if (metric === 'profit') value = (team?.profit || 0) / 1000000
        else if (metric === 'revenue') value = (team?.revenue || 0) / 1000000
        else if (metric === 'production') {
          const usProduction = team?.production?.us || 0
          const asiaProduction = team?.production?.asia || 0
          value = (usProduction + asiaProduction) / 1000
        }
        else if (metric === 'inventory') {
          const usInv = team?.inventory?.us || 0
          const asiaInv = team?.inventory?.asia || 0
          value = (usInv + asiaInv) / 1000
        }
        else if (metric === 'marketShare') {
          value = (team?.avgMarketShare || 0) * 100
        }
        else if (metric === 'unitsSold') {
          const totalDemand = (round.marketData.totalDemand.us + round.marketData.totalDemand.asia + round.marketData.totalDemand.europe) || 0
          value = (totalDemand * (team?.avgMarketShare || 0)) / 1000
        }

        dataPoint[teamName] = value
      })

      return dataPoint
    })
  }

  const getMetricLabel = (metric: string) => {
    const labels = {
      sharePrice: 'Share Price ($)',
      revenue: 'Revenue ($M)',
      profit: 'Net Profit ($M)',
      production: 'Total Production (K units)',
      inventory: 'Ending Inventory (K units)',
      unitsSold: 'Units Sold (K units)',
      marketShare: 'Market Share (%)'
    }
    return labels[metric as keyof typeof labels] || metric
  }

  const getTeamNames = () => {
    if (roundResults.length === 0) return []
    return roundResults[0]?.teams.map(t => t.teamName) || []
  }

  const renderHistogramLegend = (props: { payload?: Array<{ value?: string; color?: string }> }) => {
    const payload = props.payload ?? []
    if (!payload || payload.length === 0) return null
    return (
      <div className="sl-legend-wrap">
        {payload.map((entry, idx: number) => (
          <div key={idx} className="sl-legend-item">
            <span className="sl-legend-swatch" style={{ background: entry.color }} />
            <span className="sl-legend-text">{entry.value}</span>
          </div>
        ))}
      </div>
    )
  }

  const NAV_ITEMS = [
    { id: 'visualizer', label: 'Visualizer', mode: 'visualizer' },
    { id: 'experiment', label: 'Research Lab', mode: 'experiment' },
    { id: 'tournament', label: 'Tournament', mode: 'tournament' },
  ]

  return (
    <div className="dm-shell">
      <aside className="dm-sidebar">
        <div className="dm-company">
          <div className="dm-company-logo">🧪</div>
          <div>
            <div className="dm-company-name">{isStudentStrategyRoute ? 'Student Strategy Lab' : 'Strategy Lab'}</div>
            <div className="dm-company-meta">{isStudentStrategyRoute ? 'Student Upload + Visualizer' : 'Game Theory Sandbox'}</div>
          </div>
        </div>

        <nav className="dm-nav">
          <button className="dm-nav-item" onClick={() => navigate('/educator-dashboard')}>
            Educator Dashboard
          </button>
          {isStudentStrategyRoute ? (
            <button type="button" className="dm-nav-item active" onClick={() => setMode('visualizer')}>
              Student Run
            </button>
          ) : (
            NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`dm-nav-item ${mode === item.mode ? 'active' : ''}`}
                onClick={() => setMode(item.mode as 'visualizer' | 'experiment' | 'tournament')}
              >
                {item.label}
              </button>
            ))
          )}
        </nav>

        <div className="dm-subnav">
          <div className="dm-subnav-title">Quick Actions</div>
          <button className="dm-subnav-item" onClick={() => setShowAudit(true)}>
            <span className="dm-subnav-icon">📋</span>
            <span className="dm-subnav-label">Audit Config</span>
          </button>
        </div>
        <SidebarFooter />
      </aside>

      <main className="dm-main">
        <header className="dm-header">
          <div>
            <h1>{isStudentStrategyRoute ? 'Student Strategy Lab' : 'Strategy Lab'}</h1>
            <p>
              {isStudentStrategyRoute && 'Student Strategy Upload + Visualizer'}
              {!isStudentStrategyRoute && mode === 'visualizer' && 'Live Strategy Simulation Visualizer'}
              {!isStudentStrategyRoute && mode === 'experiment' && 'Batch Experiment Research Lab'}
              {!isStudentStrategyRoute && mode === 'tournament' && 'Round-Robin Tournament Mode'}
            </p>
          </div>
          <div className="dm-header-controls" style={{ display: 'flex', alignItems: 'center' }}>
            {educatorProfile?.credits !== undefined && educatorProfile?.role !== 'admin' && (
              <div
                className="dm-session"
                style={{
                  cursor: 'default',
                  border: '1px solid',
                  borderColor: educatorProfile.credits === 0 ? 'var(--color-danger)' : educatorProfile.credits <= 5 ? 'var(--color-warning)' : 'var(--color-success)',
                  background: theme === 'dark'
                    ? (educatorProfile.credits === 0 ? 'rgba(239, 68, 68, 0.2)' : educatorProfile.credits <= 5 ? 'rgba(251, 191, 36, 0.2)' : 'rgba(16, 185, 129, 0.2)')
                    : (educatorProfile.credits === 0 ? '#fef2f2' : educatorProfile.credits <= 5 ? '#fffbeb' : '#f0fdf4'),
                  color: educatorProfile.credits === 0 ? 'var(--color-danger)' : educatorProfile.credits <= 5 ? 'var(--color-warning)' : 'var(--color-success)',
                  marginRight: '0.75rem'
                }}
                title="Total Game Credits Remaining"
              >
                <span className="dm-session-round dm-session-small" style={{ color: 'inherit' }}>
                  Game Credits: {educatorProfile.credits}
                </span>
              </div>
            )}
            <button ref={accountMenuRef} type="button" className="dm-session" onClick={() => setSessionOpen(!sessionOpen)} style={{ marginRight: '0.75rem' }}>
              <span className="dm-session-round dm-session-small" style={{ color: 'var(--text-accent)' }}>Account</span>
              <span className="dm-session-caret">▾</span>
              {sessionOpen && (
                <span className="dm-session-menu" onClick={(e) => e.stopPropagation()}>
                  {educatorProfile?.email && (
                    <span className="dm-menu-row">
                      <span className="dm-menu-value">{educatorProfile.email}</span>
                    </span>
                  )}
                  <span className="dm-menu-row">
                    <button type="button" className="dm-logout" onClick={handleLogout}>Log Out</button>
                  </span>
                </span>
              )}
            </button>
            <button
              type="button"
              className="dm-theme-toggle"
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
          </div>
        </header>

        <div className="dm-workspace dm-no-impact">
          <section className="dm-content">
            <div className="dm-scroll" style={{ padding: '2rem' }}>
              <div style={{ display: 'flex', gap: '2rem', alignItems: 'flex-start' }}>
                <div style={{ flex: '1', minWidth: 0 }}>
          {isStudentStrategyRoute && renderStudentStrategyPanel()}
          {mode === 'experiment' && experimentResults && (
            <div className="sl-card">
              <div style={{ marginBottom: '1rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                Research Lab runs many simulations to compare strategies statistically and report aggregated results.
              </div>
              {experimentAnalysis && (
                <div style={{ marginBottom: '2rem', padding: '1.5rem', background: theme === 'dark' ? 'rgba(59, 130, 246, 0.1)' : '#eff6ff', borderRadius: '12px', border: '1px solid var(--text-accent)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                    <div>
                      <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-accent)', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.05em' }}>Analysis Report</h4>
                      <h2 style={{ margin: 0, fontSize: '1.5rem', color: 'var(--text-main)' }}>{experimentAnalysis.title}</h2>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <div style={{
                        background: experimentAnalysis.integrity.passed ? 'var(--bg-subtle)' : 'var(--pro-danger)',
                        color: experimentAnalysis.integrity.passed ? 'var(--text-success)' : '#fff',
                        border: experimentAnalysis.integrity.passed ? '1px solid var(--pro-success)' : 'none',
                        padding: '0.4rem 1rem',
                        borderRadius: '99px',
                        fontWeight: 700,
                        fontSize: '0.85rem',
                        display: 'flex', alignItems: 'center', gap: '0.25rem'
                      }}>
                        {experimentAnalysis.integrity.passed ? '✓ PHYSICS VALID' : '⚠️ PHYSICS VIOLATION'}
                      </div>
                      <div style={{
                        background: experimentAnalysis.result === 'confirmed' ? 'var(--pro-success)' : experimentAnalysis.result === 'rejected' ? 'var(--pro-danger)' : '#94a3b8',
                        color: '#fff',
                        padding: '0.4rem 1rem',
                        borderRadius: '99px',
                        fontWeight: 700,
                        fontSize: '0.85rem'
                      }}>
                        HYPOTHESIS: {experimentAnalysis.result.toUpperCase()}
                      </div>
                    </div>
                  </div>

                  <p style={{ fontSize: '1rem', lineHeight: '1.6', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                    {experimentAnalysis.summary}
                  </p>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                    {experimentAnalysis.keyFindings.map((finding, idx) => (
                      <div key={idx} style={{ background: 'var(--bg-card)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem', textTransform: 'uppercase', fontWeight: 600 }}>{finding.label}</div>
                        <div style={{
                          fontSize: '1.25rem',
                          fontWeight: 800,
                          color: finding.trend === 'positive' ? 'var(--pro-success)' : finding.trend === 'negative' ? 'var(--pro-danger)' : 'var(--text-main)'
                        }}>
                          {finding.value}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border-color)' }}>
                    <h5 style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', color: 'var(--text-main)' }}>Statistical Validation</h5>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', fontSize: '0.85rem' }}>
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>Test Type:</span> <br />
                        <strong>{experimentAnalysis.statistics.testType}</strong>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>T-Statistic:</span> <br />
                        <strong>{experimentAnalysis.statistics.tValue.toFixed(4)}</strong>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>P-Value:</span> <br />
                        <strong style={{ color: experimentAnalysis.statistics.significant ? 'var(--pro-success)' : 'var(--text-main)' }}>
                          {experimentAnalysis.statistics.pValue < 0.001 ? '< 0.001' : experimentAnalysis.statistics.pValue.toFixed(4)}
                        </strong>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>Significance:</span> <br />
                        <strong>{experimentAnalysis.statistics.significant ? 'Significant (p < 0.05)' : 'Not Significant'}</strong>
                      </div>
                    </div>
                    {experimentAnalysis.statistics.effectSize !== undefined && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', fontSize: '0.85rem', marginTop: '1rem' }}>
                        <div>
                          <span style={{ color: 'var(--text-muted)' }}>Effect Size (Cohen's d):</span> <br />
                          <strong>{experimentAnalysis.statistics.effectSize.toFixed(3)}</strong>
                          <span style={{ fontSize: '0.75rem', marginLeft: '0.5rem', color: 'var(--text-muted)' }}>
                            ({Math.abs(experimentAnalysis.statistics.effectSize) > 0.8 ? 'Large' : Math.abs(experimentAnalysis.statistics.effectSize) > 0.5 ? 'Medium' : 'Small'})
                          </span>
                        </div>
                        {experimentAnalysis.statistics.confidenceInterval && (
                          <div>
                            <span style={{ color: 'var(--text-muted)' }}>95% Confidence Interval:</span> <br />
                            <strong>
                              [{experimentAnalysis.statistics.confidenceInterval.lower.toFixed(2)}, {experimentAnalysis.statistics.confidenceInterval.upper.toFixed(2)}]
                            </strong>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="sl-card-title">Raw Simulation Data</div>

              <div className="kpi-grid">
                <div className="kpi-card" style={{ padding: '1rem' }}>
                  <div className="kpi-label">Simulations Run</div>
                  <div className="kpi-value">{experimentResults.gamesPlayed}</div>
                </div>
                <div className="kpi-card" style={{ padding: '1rem' }}>
                  <div className="kpi-label">Avg Share Price</div>
                  <div className="kpi-value">${(experimentResults.aggregatedResults.priceConvergence[experimentResults.aggregatedResults.priceConvergence.length - 1] || 0).toFixed(2)}</div>
                </div>
              </div>

              <div className="sl-card-title" style={{ marginTop: '2rem', fontSize: '1rem' }}>Team Performance Averages</div>
              <table className="sl-table sl-table-compact">
                <thead>
                  <tr>
                    <th>Strategy</th>
                    <th>Avg Share Price</th>
                    <th>Avg Market Share</th>
                    <th>Win Rate</th>
                    <th>Bankruptcies</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.values(experimentResults.aggregatedResults.teamStats).map((stat, idx) => (
                    <tr key={idx}>
                      <td><strong>{stat.teamName}</strong> <span style={{ fontSize: '0.8em', color: 'var(--text-muted)' }}>({stat.strategyId})</span></td>
                      <td>${stat.avgSharePrice.toFixed(2)}</td>
                      <td>{(stat.avgMarketShare * 100).toFixed(1)}%</td>
                      <td>{(stat.winRate * 100).toFixed(1)}%</td>
                      <td>{stat.bankruptcies}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="sl-card-title" style={{ marginTop: '2rem', fontSize: '1rem' }}>{experimentAnalysis?.chartConfig?.title || 'Price Convergence Trend'}</div>
              <div style={{ height: '300px', width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  {experimentAnalysis?.chartConfig?.type === 'bar' ? (
                    <BarChart data={experimentAnalysis.chartConfig.data}>
                      <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'} />
                      <XAxis dataKey="name" stroke={theme === 'dark' ? '#94a3b8' : '#64748b'} />
                      <YAxis stroke={theme === 'dark' ? '#94a3b8' : '#64748b'} label={{ value: experimentAnalysis.chartConfig.yAxisLabel, angle: -90, position: 'insideLeft', style: { fill: theme === 'dark' ? '#94a3b8' : '#64748b' } }} />
                      <Tooltip contentStyle={{ backgroundColor: theme === 'dark' ? '#1e293b' : '#fff' }} />
                      <Bar dataKey="value" fill="#8884d8" />
                    </BarChart>
                  ) : (
                    <LineChart data={experimentAnalysis?.chartConfig?.data || experimentResults.aggregatedResults.priceConvergence.map((p: number, i: number) => ({ round: `R${i + 1}`, price: p }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'} />
                      <XAxis dataKey="round" stroke={theme === 'dark' ? '#94a3b8' : '#64748b'} />
                      <YAxis stroke={theme === 'dark' ? '#94a3b8' : '#64748b'} label={{ value: experimentAnalysis?.chartConfig?.yAxisLabel || 'Avg Price ($)', angle: -90, position: 'insideLeft', style: { fill: theme === 'dark' ? '#94a3b8' : '#64748b' } }} />
                      <Tooltip contentStyle={{ backgroundColor: theme === 'dark' ? '#1e293b' : '#fff' }} />
                      <Legend />
                      {(experimentAnalysis?.chartConfig?.lines || [{ key: 'price', color: '#8884d8', name: 'Avg Price' }]).map((line, i: number) => (
                        <Line key={i} type="monotone" dataKey={line.key} stroke={line.color} name={line.name} strokeWidth={3} dot={false} />
                      ))}
                    </LineChart>
                  )}
                </ResponsiveContainer>
              </div>

              {/* Distribution Chart */}
              {experimentAnalysis?.distributionChart && (
                <>
                  <div className="sl-card-title" style={{ marginTop: '2rem', fontSize: '1rem' }}>
                    {experimentAnalysis.distributionChart.title}
                  </div>

                  {/* Histogram */}
                  <div style={{ height: '350px', width: '100%', marginBottom: '2rem' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={experimentAnalysis.distributionChart.histogram}>
                        <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'} />
                        <XAxis
                          dataKey="bin"
                          stroke={theme === 'dark' ? '#94a3b8' : '#64748b'}
                          label={{ value: experimentAnalysis.distributionChart.xAxisLabel, position: 'insideBottom', offset: -5, style: { fill: theme === 'dark' ? '#94a3b8' : '#64748b' } }}
                        />
                        <YAxis
                          stroke={theme === 'dark' ? '#94a3b8' : '#64748b'}
                          label={{ value: experimentAnalysis.distributionChart.yAxisLabel, angle: -90, position: 'insideLeft', style: { fill: theme === 'dark' ? '#94a3b8' : '#64748b' } }}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: theme === 'dark' ? '#1e293b' : '#fff',
                            borderColor: theme === 'dark' ? '#334155' : '#e2e8f0'
                          }}
                        />
                        <Legend content={renderHistogramLegend} />
                        <Bar
                          dataKey="groupA"
                          fill="#10b981"
                          name={experimentAnalysis.distributionChart.groupNames.groupA}
                          opacity={0.8}
                        />
                        <Bar
                          dataKey="groupB"
                          fill="#ef4444"
                          name={experimentAnalysis.distributionChart.groupNames.groupB}
                          opacity={0.8}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Box Plot Statistics */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '1.5rem',
                    marginTop: '1rem',
                    marginBottom: '2rem'
                  }}>
                    {/* Group A Box Plot Stats */}
                    <div style={{
                      padding: '1rem',
                      background: theme === 'dark' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(16, 185, 129, 0.05)',
                      border: `1px solid ${theme === 'dark' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(16, 185, 129, 0.2)'}`,
                      borderRadius: '0.5rem'
                    }}>
                      <h4 style={{
                        margin: '0 0 0.75rem 0',
                        color: '#10b981',
                        fontSize: '0.9rem',
                        fontWeight: 600
                      }}>
                        {experimentAnalysis.distributionChart.groupNames.groupA} Distribution
                      </h4>
                      <div style={{ fontSize: '0.85rem', lineHeight: '1.6' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                          <span style={{ color: 'var(--text-muted)' }}>Mean:</span>
                          <strong>${experimentAnalysis.distributionChart.boxPlot.groupA.mean.toFixed(2)}</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                          <span style={{ color: 'var(--text-muted)' }}>Median:</span>
                          <strong>${experimentAnalysis.distributionChart.boxPlot.groupA.median.toFixed(2)}</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                          <span style={{ color: 'var(--text-muted)' }}>Range:</span>
                          <span>${experimentAnalysis.distributionChart.boxPlot.groupA.min.toFixed(2)} - ${experimentAnalysis.distributionChart.boxPlot.groupA.max.toFixed(2)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                          <span style={{ color: 'var(--text-muted)' }}>IQR (Q1-Q3):</span>
                          <span>${experimentAnalysis.distributionChart.boxPlot.groupA.q1.toFixed(2)} - ${experimentAnalysis.distributionChart.boxPlot.groupA.q3.toFixed(2)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                          <span style={{ color: 'var(--text-muted)' }}>Variance:</span>
                          <span>{(experimentAnalysis.distributionChart.boxPlot.groupA.q3 - experimentAnalysis.distributionChart.boxPlot.groupA.q1).toFixed(2)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--text-muted)' }}>Outliers:</span>
                          <span>{experimentAnalysis.distributionChart.boxPlot.groupA.outliers.length}</span>
                        </div>
                      </div>
                    </div>

                    {/* Group B Box Plot Stats */}
                    <div style={{
                      padding: '1rem',
                      background: theme === 'dark' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(239, 68, 68, 0.05)',
                      border: `1px solid ${theme === 'dark' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(239, 68, 68, 0.2)'}`,
                      borderRadius: '0.5rem'
                    }}>
                      <h4 style={{
                        margin: '0 0 0.75rem 0',
                        color: '#ef4444',
                        fontSize: '0.9rem',
                        fontWeight: 600
                      }}>
                        {experimentAnalysis.distributionChart.groupNames.groupB} Distribution
                      </h4>
                      <div style={{ fontSize: '0.85rem', lineHeight: '1.6' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                          <span style={{ color: 'var(--text-muted)' }}>Mean:</span>
                          <strong>${experimentAnalysis.distributionChart.boxPlot.groupB.mean.toFixed(2)}</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                          <span style={{ color: 'var(--text-muted)' }}>Median:</span>
                          <strong>${experimentAnalysis.distributionChart.boxPlot.groupB.median.toFixed(2)}</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                          <span style={{ color: 'var(--text-muted)' }}>Range:</span>
                          <span>${experimentAnalysis.distributionChart.boxPlot.groupB.min.toFixed(2)} - ${experimentAnalysis.distributionChart.boxPlot.groupB.max.toFixed(2)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                          <span style={{ color: 'var(--text-muted)' }}>IQR (Q1-Q3):</span>
                          <span>${experimentAnalysis.distributionChart.boxPlot.groupB.q1.toFixed(2)} - ${experimentAnalysis.distributionChart.boxPlot.groupB.q3.toFixed(2)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                          <span style={{ color: 'var(--text-muted)' }}>Variance:</span>
                          <span>{(experimentAnalysis.distributionChart.boxPlot.groupB.q3 - experimentAnalysis.distributionChart.boxPlot.groupB.q1).toFixed(2)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--text-muted)' }}>Outliers:</span>
                          <span>{experimentAnalysis.distributionChart.boxPlot.groupB.outliers.length}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Statistical Interpretation */}
                  <div style={{
                    padding: '1rem',
                    background: theme === 'dark' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(59, 130, 246, 0.05)',
                    border: `1px solid ${theme === 'dark' ? 'rgba(59, 130, 246, 0.3)' : 'rgba(59, 130, 246, 0.2)'}`,
                    borderRadius: '0.5rem',
                    fontSize: '0.85rem',
                    lineHeight: '1.6',
                    marginBottom: '1rem'
                  }}>
                    <div style={{ fontWeight: 600, marginBottom: '0.5rem', color: '#3b82f6' }}>
                      📊 Distribution Insights
                    </div>
                    <div style={{ color: 'var(--text-main)' }}>
                      <strong>Shape:</strong> {Math.abs(experimentAnalysis.distributionChart.boxPlot.groupA.mean - experimentAnalysis.distributionChart.boxPlot.groupA.median) < 5 ? 'Approximately normal distribution' : 'Skewed distribution'}
                      <br />
                      <strong>Spread:</strong> Group A has IQR of {(experimentAnalysis.distributionChart.boxPlot.groupA.q3 - experimentAnalysis.distributionChart.boxPlot.groupA.q1).toFixed(2)} vs Group B IQR of {(experimentAnalysis.distributionChart.boxPlot.groupB.q3 - experimentAnalysis.distributionChart.boxPlot.groupB.q1).toFixed(2)}
                      <br />
                      <strong>Overlap:</strong> {experimentAnalysis.distributionChart.boxPlot.groupA.q1 > experimentAnalysis.distributionChart.boxPlot.groupB.q3 || experimentAnalysis.distributionChart.boxPlot.groupB.q1 > experimentAnalysis.distributionChart.boxPlot.groupA.q3 ? 'No overlap in interquartile ranges - strong separation' : 'Some overlap in distributions'}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {mode === 'visualizer' && (
            <>
              <div className="sl-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <div className="sl-card-title" style={{ marginBottom: 0 }}>
                    {isRunning && <span className="sl-pulse" />}
                    Performance Trajectory
                  </div>
                  {roundResults.length > 0 && (
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        className="sl-btn-nav sl-btn-compact"
                        onClick={() => {
                          const newValue = !showCalculationAudit
                          console.log('Toggle audit panel:', newValue, 'audits:', calculationAudits.length)
                          setShowCalculationAudit(newValue)
                        }}
                        style={{
                          marginRight: '1rem',
                          background: showCalculationAudit ? 'var(--pro-primary)' : 'var(--bg-card)',
                          color: showCalculationAudit ? '#0f172a' : 'var(--text-main)'
                        }}
                        title="Show Calculation Audit Trail"
                      >
                        {showCalculationAudit ? 'Hide' : 'Show'} Audit ({calculationAudits.length})
                      </button>
                      <div className="sl-export" style={{ marginRight: '1rem' }}>
                        <button
                          className="sl-btn-nav sl-btn-compact"
                          onClick={() => setShowExportMenu(prev => !prev)}
                          title="Export"
                          type="button"
                        >
                          Export
                        </button>
                        {showExportMenu && (
                          <div className="sl-export-menu">
                            <button
                              className="sl-btn-nav sl-btn-compact"
                              onClick={() => { handleExportData('json'); setShowExportMenu(false) }}
                              title="Export for Academic Review (JSON)"
                              type="button"
                            >
                              JSON
                            </button>
                            <button
                              className="sl-btn-nav sl-btn-compact"
                              onClick={() => { handleExportData('csv'); setShowExportMenu(false) }}
                              title="Export for Spreadsheet Analysis (CSV)"
                              type="button"
                            >
                              CSV
                            </button>
                          </div>
                        )}
                      </div>
                      <select
                        className="sl-select"
                        style={{ width: 'auto', padding: '0.5rem' }}
                        value={selectedMetric}
                        onChange={(e) => setSelectedMetric(e.target.value as typeof selectedMetric)}
                      >
                        <option value="sharePrice">Share Price</option>
                        <option value="revenue">Revenue</option>
                        <option value="profit">Net Profit</option>
                        <option value="production">Total Production</option>
                        <option value="inventory">Ending Inventory</option>
                        <option value="unitsSold">Units Sold</option>
                        <option value="marketShare">Market Share (%)</option>
                      </select>
                    </div>
                  )}
                </div>
                <div className="sl-chart-container">
                  {roundResults.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={getChartData(selectedMetric)} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'} />
                        <XAxis
                          dataKey="round"
                          stroke={theme === 'dark' ? '#94a3b8' : '#64748b'}
                          tick={{ fill: theme === 'dark' ? '#94a3b8' : '#64748b' }}
                        />
                        <YAxis
                          stroke={theme === 'dark' ? '#94a3b8' : '#64748b'}
                          tick={{ fill: theme === 'dark' ? '#94a3b8' : '#64748b' }}
                          label={{
                            value: getMetricLabel(selectedMetric),
                            angle: -90,
                            position: 'insideLeft',
                            style: { fill: theme === 'dark' ? '#94a3b8' : '#64748b', fontWeight: 'bold' }
                          }}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: theme === 'dark' ? '#1e293b' : '#fff',
                            borderColor: theme === 'dark' ? '#334155' : '#e2e8f0',
                            color: theme === 'dark' ? '#f8fafc' : '#0f172a'
                          }}
                          labelStyle={{ color: theme === 'dark' ? '#f8fafc' : '#0f172a' }}
                          itemStyle={{ color: theme === 'dark' ? '#cbd5e1' : '#334155' }}
                        />
                        <Legend
                          wrapperStyle={{
                            paddingTop: '20px',
                            color: theme === 'dark' ? '#94a3b8' : '#64748b'
                          }}
                        />
                        {getTeamNames().map((teamName, idx) => (
                          <Line
                            key={teamName}
                            type="monotone"
                            dataKey={teamName}
                            stroke={TEAM_COLORS[idx]}
                            strokeWidth={3}
                            dot={{ r: 2, fill: TEAM_COLORS[idx] }}
                            activeDot={{ r: 8 }}
                          />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div style={{
                      height: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--text-muted)'
                    }}>
                      <div style={{
                        width: '100%',
                        padding: '3rem 2rem',
                        borderRadius: '16px',
                        border: '1px solid var(--border-color)',
                        background: 'var(--bg-card)',
                        textAlign: 'center'
                      }}>
                        <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🎯</div>
                        <h2 style={{ margin: 0, fontSize: '1.75rem', color: 'var(--text-main)' }}>Visualizer</h2>
                        <p style={{ margin: '1rem auto 0', maxWidth: '720px', lineHeight: 1.5 }}>
                          Run a single multi-team simulation to watch strategy decisions evolve round by round.
                          Select strategies, set rounds and scenario mode, then click <strong>Run Simulation</strong>.
                          You’ll see trends for share price, profit, production, inventory, units sold, and market share.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {roundResults.length > 0 && !isRunning && (
                <div className="sl-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <div className="sl-card-title" style={{ marginBottom: 0 }}>Scenario Impact Breakdown</div>
                    <div className="sl-toggle-group">
                      <button
                        className={`sl-toggle-btn ${breakdownViewMode === 'percentage' ? 'active' : ''}`}
                        onClick={() => setBreakdownViewMode('percentage')}
                      >
                        % Impact
                      </button>
                      <button
                        className={`sl-toggle-btn ${breakdownViewMode === 'value' ? 'active' : ''}`}
                        onClick={() => setBreakdownViewMode('value')}
                      >
                        Final Value
                      </button>
                    </div>
                  </div>
                  <div className="sl-table-wrapper">
                    <table className="sl-table sl-breakdown-table">
                      <thead>
                        <tr>
                          <th>Round</th>
                          <th>Scenario</th>
                          <th>Market Demand</th>
                          <th>Price Elasticity</th>
                          <th>CSR Weight</th>
                          <th>Marketing</th>
                          <th>Inflation</th>
                          <th>Invest Cost</th>
                          <th>Interest</th>
                        </tr>
                      </thead>
                      <tbody>
                        {getScenarioSequence().map((scenarioId, idx) => {
                          const scenario = availableScenarios.find(s => s.id === scenarioId) || availableScenarios[0]
                          const isValueMode = breakdownViewMode === 'value'

                          const formatValue = (key: keyof RoundScenario) => {
                            const val = scenario[key]

                            if (key === 'demandModifier' && val) {
                              const avg = (val.us + val.asia + val.europe) / 3
                              if (!isValueMode) return <span style={{ color: avg > 0 ? 'var(--pro-success)' : avg < 0 ? 'var(--pro-danger)' : '' }}>{avg > 0 ? '+' : ''}{avg.toFixed(1)}%</span>
                              return (avg / 100 + 1).toFixed(2) + 'x'
                            }

                            // Delta fields (Raw values are the changes)
                            if (key === 'interestRateSpread') {
                              const pct = val * 100
                              if (!isValueMode) {
                                return <span style={{ color: pct <= 0 ? 'var(--pro-success)' : 'var(--pro-danger)' }}>
                                  {pct > 0 ? '+' : ''}{pct.toFixed(2)}%
                                </span>
                              }
                              return (val > 0 ? '+' : '') + (val * 100).toFixed(2) + '%'
                            }

                            // Multiplier fields (1.0 = baseline)
                            if (typeof val === 'number') {
                              if (!isValueMode) {
                                const pct = (val - 1) * 100
                                if (Math.abs(pct) < 0.01) return '0%'
                                // Special handling for CSR where higher is often better/different
                                const goodIfPositive = key !== 'costInflation' && key !== 'investmentCostMultiplier' && key !== 'priceElasticityModifier';
                                return <span style={{ color: pct >= 0 ? (goodIfPositive ? 'var(--pro-success)' : 'var(--pro-danger)') : (goodIfPositive ? 'var(--pro-danger)' : 'var(--pro-success)') }}>
                                  {pct > 0 ? '+' : ''}{pct.toFixed(1)}%
                                </span>
                              }
                              return val.toFixed(2) + 'x'
                            }
                            return 'N/A'
                          }

                          const getHeat = (key: keyof RoundScenario) => {
                            const val = scenario[key]
                            let pct = 0
                            let goodIfPositive = key !== 'costInflation' && key !== 'investmentCostMultiplier' && key !== 'priceElasticityModifier'

                            if (key === 'demandModifier' && val) {
                              pct = (val.us + val.asia + val.europe) / 3
                            } else if (key === 'interestRateSpread') {
                              pct = val * 100
                              goodIfPositive = false
                            } else if (typeof val === 'number') {
                              pct = (val - 1) * 100
                            }

                            const magnitude = Math.min(1, Math.abs(pct) / 20)
                            const alpha = 0.08 + (magnitude * 0.22)
                            const isPositive = pct >= 0
                            const isGood = goodIfPositive ? isPositive : !isPositive
                            const color = isGood ? `rgba(16, 185, 129, ${alpha})` : `rgba(239, 68, 68, ${alpha})`
                            return pct === 0 ? 'transparent' : color
                          }

                          return (
                            <tr key={idx}>
                              <td><strong>R{idx + 1}</strong></td>
                              <td style={{ fontSize: '0.8rem', maxWidth: '120px' }}>{scenario.name}</td>
                              <td style={{ background: getHeat('demandModifier') }}>{formatValue('demandModifier')}</td>
                              <td style={{ background: getHeat('priceElasticityModifier') }}>{formatValue('priceElasticityModifier')}</td>
                              <td style={{ background: getHeat('csrImportanceModifier') }}>{formatValue('csrImportanceModifier')}</td>
                              <td style={{ background: getHeat('marketingEffectModifier') }}>{formatValue('marketingEffectModifier')}</td>
                              <td style={{ background: getHeat('costInflation') }}>{formatValue('costInflation')}</td>
                              <td style={{ background: getHeat('investmentCostMultiplier') }}>{formatValue('investmentCostMultiplier')}</td>
                              <td style={{ background: getHeat('interestRateSpread') }}>{formatValue('interestRateSpread')}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {roundResults.length > 0 && !isRunning && (
                <div className="sl-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <div className="sl-card-title" style={{ marginBottom: 0 }}>Round-by-Round Breakdown</div>
                    <div className="sl-toggle-group">
                      <button
                        className={`sl-toggle-btn ${breakdownMetric === 'financial' ? 'active' : ''}`}
                        onClick={() => setBreakdownMetric('financial')}
                      >
                        Financials
                      </button>
                      <button
                        className={`sl-toggle-btn ${breakdownMetric === 'market' ? 'active' : ''}`}
                        onClick={() => setBreakdownMetric('market')}
                      >
                        Market
                      </button>
                      <button
                        className={`sl-toggle-btn ${breakdownMetric === 'operational' ? 'active' : ''}`}
                        onClick={() => setBreakdownMetric('operational')}
                      >
                        Operations
                      </button>
                    </div>
                  </div>
                  <div className="sl-table-wrapper">
                    <table className="sl-table">
                      <thead>
                        <tr>
                          <th>Round</th>
                          <th>Scenario</th>
                          {roundResults[0]?.teams.map((team, idx) => (
                            <th key={idx} style={{ color: TEAM_COLORS[idx] }}>
                              {team.teamName}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {roundResults.map((round, roundIdx) => {
                          const scenarioName = availableScenarios.find(s => s.id === round.scenarioId)?.name || `Scenario ${round.scenarioId}`
                          return (
                            <tr key={roundIdx}>
                              <td><strong>R{roundIdx + 1}</strong></td>
                              <td style={{ fontSize: '0.85rem' }}>{scenarioName}</td>
                              {round.teams.map((team, teamIdx) => {
                                let primaryValue: string | number = ''
                                let secondaryValue: string | number = ''

                                if (breakdownMetric === 'financial') {
                                  primaryValue = `$${team.sharePrice.toFixed(2)}`
                                  secondaryValue = `P: $${(team.profit / 1000000).toFixed(1)}M`
                                } else if (breakdownMetric === 'market') {
                                  primaryValue = `${(team.avgMarketShare * 100).toFixed(1)}%`
                                  const totalDemand = (round.marketData.totalDemand.us + round.marketData.totalDemand.asia + round.marketData.totalDemand.europe) || 0
                                  const unitsSold = (totalDemand * (team.avgMarketShare || 0)) / 1000
                                  secondaryValue = `Vol: ${unitsSold.toFixed(0)}K`
                                } else if (breakdownMetric === 'operational') {
                                  const totalInv = (team.inventory.us + team.inventory.asia) / 1000
                                  const totalFactories = (team.factories?.us || 0) + (team.factories?.asia || 0)
                                  primaryValue = `Inv: ${totalInv.toFixed(0)}K`
                                  secondaryValue = `Fact: ${totalFactories}`
                                }

                                return (
                                  <td key={teamIdx}>
                                    <div style={{ fontSize: '0.9rem' }}>
                                      <div><strong>{primaryValue}</strong></div>
                                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                        {secondaryValue}
                                      </div>
                                    </div>
                                  </td>
                                )
                              })}
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {finalStandings.length > 0 && !isRunning && (
                <div className="sl-card">
                  <div className="sl-card-title">Leaderboard Standings</div>
                  <table className="sl-table sl-leaderboard-table">
                    <thead>
                      <tr>
                        <th>Rank</th>
                        <th>Team</th>
                        <th>Strategy</th>
                        <th>Final Share Price</th>
                        <th>Growth</th>
                        <th>Mkt Share</th>
                      </tr>
                    </thead>
                    <tbody>
                      {finalStandings.map((standing, idx) => (
                        <tr key={idx}>
                          <td>
                            <div className={`sl-rank-badge sl-rank-${(standing.rank || 99) <= 3 ? standing.rank : 'other'}`}>
                              {standing.rank || '-'}
                            </div>
                          </td>
                          <td><strong>{standing.teamName}</strong></td>
                          <td>{standing.strategyName}</td>
                          <td><strong>${standing.finalSharePrice.toFixed(2)}</strong></td>
                          <td style={{ color: standing.sharePriceGrowth >= 0 ? 'var(--pro-success)' : 'var(--pro-danger)', fontWeight: 700 }}>
                            {standing.sharePriceGrowth >= 0 ? '+' : ''}{standing.sharePriceGrowth.toFixed(1)}%
                          </td>
                          <td>{standing.avgMarketShare.toFixed(1)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {insights && !isRunning && (
                <div className="sl-card">
                  <div className="sl-card-title">Strategy Analysis</div>
                  {insights.summary.map((insight: string, idx: number) => (
                    <div key={idx} className="sl-insight-item">{insight}</div>
                  ))}

                  <div className="sl-winner-card">
                    <div className="sl-winner-icon">🏆</div>
                    <div className="sl-winner-info">
                      <h3>Dominant Strategy: {insights.winner?.strategy}</h3>
                      <p>Highest TSR achieved by <strong>{insights.winner?.teamName}</strong> with a final price of <strong>${insights.winner?.finalSharePrice?.toFixed(2)}</strong></p>
                    </div>
                  </div>
                </div>
              )}

              {/* Calculation Audit Panel */}
              {showCalculationAudit && calculationAudits.length > 0 && !isRunning && (
                <CalculationAuditPanel audits={calculationAudits} theme={theme} />
              )}
              {showCalculationAudit && calculationAudits.length === 0 && !isRunning && (
                <div className="sl-card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>📊</div>
                  <div>No audit data available. Run a simulation to generate calculation audits.</div>
                </div>
              )}
            </>
          )}

          {mode === 'tournament' && tournamentResults && (
            <div className="sl-card">
              <div className="sl-card-title">🏆 Tournament Results</div>
              <div style={{ marginBottom: '1rem', color: 'var(--text-secondary)' }}>
                {tournamentResults.totalGames} games played across {tournamentResults.matchups.length} matchups
              </div>
              <div style={{ marginBottom: '1rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                Tournament mode runs head-to-head (2-team) matchups between strategies. The Round-by-Round inspector shows the last matchup game.
              </div>

              {/* Leaderboard */}
              <div className="sl-card-title" style={{ marginTop: '1.5rem', fontSize: '1rem' }}>Final Leaderboard</div>
              <table className="sl-table sl-leaderboard-table">
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Strategy</th>
                    <th>Points</th>
                    <th>W-D-L</th>
                    <th>Win Rate</th>
                    <th>Avg Share Price</th>
                    <th>Avg Market Share</th>
                  </tr>
                </thead>
                <tbody>
                  {tournamentResults.leaderboard.map((entry, idx) => (
                    <tr key={idx}>
                      <td>
                        <div className={`sl-rank-badge sl-rank-${idx < 3 ? idx + 1 : 'other'}`}>
                          {idx + 1}
                        </div>
                      </td>
                      <td><strong>{entry.strategyName}</strong></td>
                      <td><strong>{entry.points}</strong></td>
                      <td>{entry.totalWins}-{entry.totalDraws}-{entry.totalLosses}</td>
                      <td style={{ color: entry.winRate >= 0.5 ? 'var(--pro-success)' : 'var(--text-main)' }}>
                        {(entry.winRate * 100).toFixed(1)}%
                      </td>
                      <td>${entry.avgSharePrice.toFixed(2)}</td>
                      <td>{(entry.avgMarketShare * 100).toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Strategy Performance Heatmap */}
              <div className="sl-card-title" style={{ marginTop: '2rem', fontSize: '1rem' }}>🔥 Strategy Performance Heatmap</div>
              <div style={{ marginBottom: '1rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                Win rate matrix: Each cell shows row strategy's win percentage against column strategy
              </div>
              <div style={{ overflowX: 'auto', marginBottom: '2rem' }}>
                <table style={{
                  borderCollapse: 'collapse',
                  fontSize: '0.85rem',
                  width: '100%',
                  maxWidth: '800px',
                  margin: '0 auto'
                }}>
                  <thead>
                    <tr>
                      <th style={{
                        padding: '0.75rem',
                        textAlign: 'left',
                        borderBottom: '2px solid var(--border-main)',
                        background: theme === 'dark' ? 'rgba(15, 23, 42, 0.5)' : 'rgba(248, 250, 252, 0.8)',
                        fontWeight: 600,
                        fontSize: '0.75rem',
                        color: 'var(--text-muted)'
                      }}>
                        VS →
                      </th>
                      {tournamentResults.heatmap.strategies.map((stratId, idx) => {
                        const strategy = availableStrategies.find(s => s.id === stratId)
                        return (
                          <th key={idx} style={{
                            padding: '0.75rem 0.5rem',
                            textAlign: 'center',
                            borderBottom: '2px solid var(--border-main)',
                            background: theme === 'dark' ? 'rgba(15, 23, 42, 0.5)' : 'rgba(248, 250, 252, 0.8)',
                            fontWeight: 600,
                            fontSize: '0.75rem',
                            color: 'var(--text-main)',
                            minWidth: '70px',
                            maxWidth: '100px',
                            wordWrap: 'break-word'
                          }}>
                            {strategy?.name || stratId}
                          </th>
                        )
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {tournamentResults.heatmap.strategies.map((stratId, rowIdx) => {
                      const strategy = availableStrategies.find(s => s.id === stratId)
                      return (
                        <tr key={rowIdx}>
                          <td style={{
                            padding: '0.75rem',
                            fontWeight: 600,
                            background: theme === 'dark' ? 'rgba(15, 23, 42, 0.5)' : 'rgba(248, 250, 252, 0.8)',
                            borderRight: '2px solid var(--border-main)',
                            fontSize: '0.8rem',
                            color: 'var(--text-main)'
                          }}>
                            {strategy?.name || stratId}
                          </td>
                          {tournamentResults.heatmap.matrix[rowIdx].map((winRate, colIdx) => {
                            // Color coding: green for high win rate, red for low
                            const isDiagonal = rowIdx === colIdx
                            let bgColor: string
                            let textColor: string

                            if (isDiagonal) {
                              bgColor = theme === 'dark' ? 'rgba(100, 116, 139, 0.2)' : 'rgba(226, 232, 240, 0.5)'
                              textColor = 'var(--text-muted)'
                            } else if (winRate >= 70) {
                              bgColor = theme === 'dark' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(16, 185, 129, 0.15)'
                              textColor = '#10b981'
                            } else if (winRate >= 55) {
                              bgColor = theme === 'dark' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(16, 185, 129, 0.08)'
                              textColor = theme === 'dark' ? '#34d399' : '#059669'
                            } else if (winRate >= 45) {
                              bgColor = theme === 'dark' ? 'rgba(100, 116, 139, 0.1)' : 'rgba(148, 163, 184, 0.08)'
                              textColor = 'var(--text-secondary)'
                            } else if (winRate >= 30) {
                              bgColor = theme === 'dark' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(239, 68, 68, 0.08)'
                              textColor = theme === 'dark' ? '#f87171' : '#dc2626'
                            } else {
                              bgColor = theme === 'dark' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(239, 68, 68, 0.15)'
                              textColor = '#ef4444'
                            }

                            return (
                              <td key={colIdx} style={{
                                padding: '0.75rem 0.5rem',
                                textAlign: 'center',
                                background: bgColor,
                                color: textColor,
                                fontWeight: isDiagonal ? 'normal' : 600,
                                fontSize: isDiagonal ? '0.75rem' : '0.85rem',
                                border: `1px solid ${theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'}`,
                                transition: 'all 0.2s'
                              }}>
                                {isDiagonal ? '—' : `${winRate}%`}
                              </td>
                            )
                          })}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Legend */}
              <div style={{
                display: 'flex',
                justifyContent: 'center',
                gap: '1.5rem',
                marginBottom: '2rem',
                fontSize: '0.75rem',
                color: 'var(--text-muted)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{
                    width: '20px',
                    height: '20px',
                    background: theme === 'dark' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(16, 185, 129, 0.15)',
                    border: `1px solid ${theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
                    borderRadius: '3px'
                  }} />
                  <span>Strong (≥70%)</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{
                    width: '20px',
                    height: '20px',
                    background: theme === 'dark' ? 'rgba(100, 116, 139, 0.1)' : 'rgba(148, 163, 184, 0.08)',
                    border: `1px solid ${theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
                    borderRadius: '3px'
                  }} />
                  <span>Even (45-55%)</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{
                    width: '20px',
                    height: '20px',
                    background: theme === 'dark' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(239, 68, 68, 0.15)',
                    border: `1px solid ${theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
                    borderRadius: '3px'
                  }} />
                  <span>Weak (≤30%)</span>
                </div>
              </div>

              {/* Head-to-Head Matrix */}
              <div className="sl-card-title" style={{ marginTop: '2rem', fontSize: '1rem' }}>Head-to-Head Results</div>
              <div className="sl-table-wrapper">
                <table className="sl-table sl-table-compact">
                  <thead>
                    <tr>
                      <th>Matchup</th>
                      <th>Team 1 Wins</th>
                      <th>Draws</th>
                      <th>Team 2 Wins</th>
                      <th>Avg SP (T1 vs T2)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tournamentResults.matchups.map((matchup, idx) => {
                      const strat1 = availableStrategies.find(s => s.id === matchup.team1Strategy)
                      const strat2 = availableStrategies.find(s => s.id === matchup.team2Strategy)
                      return (
                        <tr key={idx}>
                          <td>
                            <strong>{strat1?.name || matchup.team1Strategy}</strong> vs <strong>{strat2?.name || matchup.team2Strategy}</strong>
                          </td>
                          <td style={{ color: matchup.team1Wins > matchup.team2Wins ? 'var(--pro-success)' : '' }}>
                            {matchup.team1Wins}
                          </td>
                          <td>{matchup.draws}</td>
                          <td style={{ color: matchup.team2Wins > matchup.team1Wins ? 'var(--pro-success)' : '' }}>
                            {matchup.team2Wins}
                          </td>
                          <td>
                            ${matchup.avgTeam1SharePrice.toFixed(2)} vs ${matchup.avgTeam2SharePrice.toFixed(2)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {mode === 'tournament' && tournamentResults?.lastGameTrace && (
            <RoundDataViewer
              results={{
                rounds: tournamentResults.lastGameTrace.rounds,
                finalStandings: tournamentResults.lastGameTrace.finalStandings,
                config: {} as StrategySimulationConfig,
                insights: null as unknown as SimulationInsights
              }}
              isDarkMode={isDarkMode}
            />
          )}

          {mode === 'tournament' && !tournamentResults && !isRunning && (
            <div className="sl-card" style={{ minHeight: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
              <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🏆</div>
              <h2 style={{ color: 'var(--text-main)' }}>Tournament Mode</h2>
              <p style={{ color: 'var(--text-muted)', maxWidth: '500px', textAlign: 'center' }}>
                Run round-robin tournament where each strategy competes against every other strategy.
                Select strategies from the sidebar and click "Run Tournament" to begin.
              </p>
            </div>
          )}

          {mode === 'tournament' && isRunning && (
            <div className="sl-card" style={{ minHeight: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
              <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>⚔️</div>
              <h2 style={{ color: 'var(--text-main)' }}>Tournament in Progress...</h2>
              <div style={{ width: '300px', marginTop: '2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: 600 }}>
                  <span>Running Matchups...</span>
                  <span>{tournamentProgress}%</span>
                </div>
                <div className="hero-prog-track">
                  <div className="hero-prog-fill" style={{ width: `${tournamentProgress}%` }}></div>
                </div>
              </div>
            </div>
          )}

          {mode === 'visualizer' ? null : mode === 'experiment' && !experimentResults && (
            <div className="sl-card" style={{ minHeight: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
              <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🧪</div>
              <h2 style={{ color: 'var(--text-main)' }}>Research Lab</h2>
              <p style={{ color: 'var(--text-muted)', maxWidth: '500px', textAlign: 'center' }}>
                Select a research question from the sidebar to configure a batch simulation experiment.
                Run hundreds of games to validate game theory concepts with statistical significance.
              </p>
              {isRunning && (
                <div style={{ width: '300px', marginTop: '2rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: 600 }}>
                    <span>Running Simulation...</span>
                    <span>{experimentProgress}%</span>
                  </div>
                  <div className="hero-prog-track">
                    <div className="hero-prog-fill" style={{ width: `${experimentProgress}%` }}></div>
                  </div>
                  <div style={{ textAlign: 'center', marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Simulating {gamesCount} parallel universes
                  </div>
                </div>
              )}
            </div>
          )}
                </div>

                <div className="sl-sidebar" style={{ width: '380px', flexShrink: 0 }}>
          <div className="sl-card">
            <div className="sl-card-title">
              {mode === 'experiment' ? 'Experiment Setup' : mode === 'tournament' ? 'Tournament Setup' : 'Configuration'}
            </div>

            {/* Tournament Strategy Selection */}
            {mode === 'tournament' && (
              <div className="sl-form-group">
                <label className="sl-label">
                  Competing Strategies
                  <InfoTooltip content="Select which strategies will compete in the tournament. Each strategy will play against every other strategy in head-to-head matches." />
                </label>
                <div className="sl-tournament-list" style={{
                  maxHeight: '200px',
                  overflowY: 'auto',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  padding: '0.5rem',
                  background: 'var(--bg-subtle)'
                }}>
                  {uploadedStrategyOptions.map(strategy => (
                    <div key={strategy.id} style={{ marginBottom: '0.5rem' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={selectedTournamentStrategies.includes(strategy.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedTournamentStrategies([...selectedTournamentStrategies, strategy.id])
                            } else {
                              setSelectedTournamentStrategies(selectedTournamentStrategies.filter(id => id !== strategy.id))
                            }
                          }}
                          disabled={isRunning}
                        />
                        <span style={{ fontSize: '0.9rem', color: '#0ea5e9', fontWeight: 600 }}>💻 {strategy.name}</span>
                      </label>
                    </div>
                  ))}
                  {uploadedStrategyOptions.length > 0 && builtInStrategyOptions.length > 0 && (
                    <div style={{ margin: '0.4rem 0 0.6rem', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      ---------------- built-in strategies ----------------
                    </div>
                  )}
                  {builtInStrategyOptions.map(strategy => (
                    <div key={strategy.id} style={{ marginBottom: '0.5rem' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={selectedTournamentStrategies.includes(strategy.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedTournamentStrategies([...selectedTournamentStrategies, strategy.id])
                            } else {
                              setSelectedTournamentStrategies(selectedTournamentStrategies.filter(id => id !== strategy.id))
                            }
                          }}
                          disabled={isRunning}
                        />
                        <span style={{ fontSize: '0.9rem' }}>{strategy.name}</span>
                      </label>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                  {selectedTournamentStrategies.length} strategies selected • {(selectedTournamentStrategies.length * (selectedTournamentStrategies.length + 1)) / 2} matchups
                </div>
              </div>
            )}

            {mode === 'tournament' && (
              <div className="sl-form-group">
                <label className="sl-label">
                  Games per Matchup
                  <InfoTooltip content="Number of games to run for each unique strategy pairing. More games provide more reliable results but take longer to complete." />
                </label>
                <select
                  className="sl-select"
                  value={gamesPerMatchup}
                  onChange={(e) => setGamesPerMatchup(Number(e.target.value))}
                  disabled={isRunning}
                >
                  <option value="5">5 (Quick)</option>
                  <option value="10">10 (Standard)</option>
                  <option value="25">25 (Robust)</option>
                  <option value="50">50 (Research Grade)</option>
                </select>
              </div>
            )}

            {mode === 'experiment' && (
              <div className="sl-form-group">
                <label className="sl-label">Research Question</label>
                <select
                  className="sl-select"
                  value={experimentType}
                  onChange={(e) => setExperimentType(e.target.value)}
                  disabled={isRunning}
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

            {/* Saved Experiments */}
            {(mode === 'experiment' || mode === 'visualizer' || mode === 'tournament') && (
              <div className="sl-form-group" style={{ borderTop: '1px solid var(--border-main)', paddingTop: '1rem', marginTop: '1rem' }}>
                <label className="sl-label">
                  💾 Saved Experiments
                  <InfoTooltip content="Save your current configuration for reuse, or load a previously saved experiment. Export configurations to share with colleagues or import setups from others." />
                </label>

                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  <button
                    className="sl-btn sl-btn-sm"
                    onClick={() => {
                      const name = prompt('Enter a name for this experiment:')
                      if (name) saveCurrentExperiment(name)
                    }}
                    disabled={isRunning}
                    style={{ flex: 1, fontSize: '0.85rem', padding: '0.4rem 0.8rem' }}
                  >
                    💾 Save Current
                  </button>
                  <button
                    className="sl-btn sl-btn-sm"
                    onClick={importExperiment}
                    disabled={isRunning}
                    style={{ flex: 1, fontSize: '0.85rem', padding: '0.4rem 0.8rem' }}
                  >
                    📥 Import JSON
                  </button>
                </div>

                {savedExperiments.length > 0 && (
                  <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--border-main)', borderRadius: '6px', padding: '0.5rem' }}>
                    {savedExperiments.map((exp) => (
                      <div key={exp.timestamp} style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.5rem',
                        marginBottom: '0.5rem',
                        background: 'var(--bg-subtle)',
                        borderRadius: '4px',
                        fontSize: '0.85rem'
                      }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{exp.name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {new Date(exp.timestamp).toLocaleDateString()} • {exp.config.mode}
                          </div>
                        </div>
                        <button
                          onClick={() => loadExperiment(exp)}
                          disabled={isRunning}
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', cursor: 'pointer' }}
                          title="Load this experiment"
                        >
                          📂 Load
                        </button>
                        <button
                          onClick={() => exportExperiment(exp)}
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', cursor: 'pointer' }}
                          title="Export as JSON"
                        >
                          📤
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Delete "${exp.name}"?`)) deleteExperiment(exp.timestamp)
                          }}
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', cursor: 'pointer', color: '#ef4444' }}
                          title="Delete"
                        >
                          🗑️
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {savedExperiments.length === 0 && (
                  <div style={{
                    padding: '1rem',
                    textAlign: 'center',
                    fontSize: '0.85rem',
                    color: 'var(--text-muted)',
                    border: '1px dashed var(--border-main)',
                    borderRadius: '4px'
                  }}>
                    No saved experiments yet
                  </div>
                )}
              </div>
            )}

            {mode === 'experiment' && (
              <div className="sl-form-group">
                <label className="sl-label">
                  Sample Size (Games)
                  <InfoTooltip content="Number of complete games to run for statistical analysis. Larger samples provide more reliable results but take longer. 100+ recommended for publishable research, 50 for classroom demonstrations." />
                </label>
                <select
                  className="sl-select"
                  value={gamesCount}
                  onChange={(e) => setGamesCount(Number(e.target.value))}
                  disabled={isRunning}
                >
                  <option value="10">10 (Quick Test)</option>
                  <option value="50">50 (Standard)</option>
                  <option value="100">100 (Robust)</option>
                  <option value="500">500 (Research Grade)</option>
                </select>
              </div>
            )}

            {mode !== 'tournament' && (
              <div className="sl-form-group">
                <label className="sl-label">
                  Team Count
                  <InfoTooltip content="Number of competing AI teams in the simulation. More teams create more complex market dynamics but may reduce individual strategy visibility." />
                </label>
                <select className="sl-select" value={teamCount} onChange={(e) => setTeamCount(parseInt(e.target.value))} disabled={isRunning}>
                  {[2, 3, 4, 5, 6, 7, 8].map(n => <option key={n} value={n}>{n} Teams</option>)}
                </select>
              </div>
            )}

            <div className="sl-form-group">
              <label className="sl-label">
                Simulation Rounds
                <InfoTooltip content="Number of decision-making rounds in the game. More rounds allow strategies to adapt and react, revealing long-term performance patterns. 20-30 rounds typical for meaningful results." />
              </label>
              <input type="number" className="sl-input" value={rounds} onChange={(e) => setRounds(parseInt(e.target.value) || 20)} disabled={isRunning} min={5} max={100} />
            </div>

            <div className="sl-form-group">
              <label className="sl-label">
                Simulation Seed
                <InfoTooltip content="Controls random scenario selection for reproducibility. Same seed = identical scenario sequence. Use this to compare strategies under identical market conditions, or change seed to test robustness across different conditions." />
              </label>
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <input
                  type="number"
                  className="sl-input"
                  value={simulationSeed}
                  onChange={(e) => setSimulationSeed(parseInt(e.target.value) || 0)}
                  disabled={isRunning}
                />
                <button
                  className="sl-btn-nav"
                  onClick={() => setSimulationSeed(generateSeed())}
                  title="Generate New Seed"
                  disabled={isRunning}
                >
                  🎲
                </button>
              </div>
            </div>

            <div className="sl-form-group">
              <label className="sl-label">
                Market Scenario
                <InfoTooltip content="Single: Same economic conditions every round. Random: Different scenarios each round for varied market testing. Custom: Design your own scenario progression (e.g., boom → recession)." position="right" />
              </label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <select className="sl-select" style={{ flex: 1 }} value={scenarioMode} onChange={(e) => setScenarioMode(e.target.value as 'single' | 'random' | 'custom')} disabled={isRunning}>
                  <option value="single">Single Scenario</option>
                  <option value="random">Randomization</option>
                  <option value="custom">Custom Sequence</option>
                </select>
                <button
                  className="sl-btn-nav"
                  onClick={() => setShowScenarioBuilder(true)}
                  title="Create Custom Scenario"
                  style={{ padding: '0.5rem' }}
                >
                  +
                </button>
              </div>
            </div>

            {scenarioMode === 'single' && (
              <div className="sl-form-group">
                <select className="sl-select" value={singleScenarioId} onChange={(e) => setSingleScenarioId(parseInt(e.target.value))} disabled={isRunning}>
                  {availableScenarios.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            )}

            {scenarioMode === 'custom' && (
              <div className="sl-form-group">
                <label className="sl-label" style={{ fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                  Scenario Sequence ({scenarioSequence.length} rounds configured)
                </label>
                <div style={{
                  maxHeight: '200px',
                  overflowY: 'auto',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  padding: '0.5rem',
                  background: 'var(--bg-subtle)'
                }}>
                  {scenarioSequence.map((scenarioId, idx) => {
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
                            const newSeq = [...scenarioSequence]
                            newSeq[idx] = parseInt(e.target.value)
                            setScenarioSequence(newSeq)
                          }}
                          disabled={isRunning}
                        >
                          {availableScenarios.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                        <button
                          className="sl-btn-nav"
                          style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                          onClick={() => {
                            const newSeq = scenarioSequence.filter((_, i) => i !== idx)
                            setScenarioSequence(newSeq.length > 0 ? newSeq : [SIMULATION_CONFIG.DEFAULTS.SCENARIO_ID])
                          }}
                          disabled={isRunning || scenarioSequence.length <= 1}
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
                    onClick={() => setScenarioSequence([...scenarioSequence, singleScenarioId])}
                    disabled={isRunning}
                  >
                    + Add Round
                  </button>
                  <button
                    className="sl-btn-nav"
                    onClick={() => {
                      const seq = []
                      for (let i = 0; i < rounds; i++) {
                        seq.push(scenarioSequence[i % scenarioSequence.length] || SIMULATION_CONFIG.DEFAULTS.SCENARIO_ID)
                      }
                      setScenarioSequence(seq)
                    }}
                    disabled={isRunning}
                    title="Fill to match round count"
                  >
                    Fill {rounds} Rounds
                  </button>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                  Configure each round's economic scenario. Use "Fill Rounds" to repeat pattern.
                </div>
              </div>
            )}

            {mode !== 'tournament' && (
              <div className="sl-form-group">
                <label className="sl-label">Team Strategies</label>
                <div className="sl-strategy-list">
                  {Array.from({ length: teamCount }).map((_, idx) => (
                    <div key={idx} className="sl-strategy-row">
                      <div className="sl-team-dot" style={{ background: TEAM_COLORS[idx] }} />
                      <span className="sl-team-name">Team {idx + 1}</span>
                      <select className="sl-select" style={{ padding: '0.4rem' }} value={selectedStrategies[idx]} onChange={(e) => {
                        const ns = [...selectedStrategies]; ns[idx] = e.target.value; setSelectedStrategies(ns);
                      }} disabled={isRunning}>
                        {uploadedStrategyOptions.length > 0 && (
                          <optgroup label="Uploaded Strategies">
                            {uploadedStrategyOptions.map((s) => (
                              <option key={s.id} value={s.id}>💻 {s.name}</option>
                            ))}
                          </optgroup>
                        )}
                        {uploadedStrategyOptions.length > 0 && builtInStrategyOptions.length > 0 && (
                          <option value="" disabled>----------------</option>
                        )}
                        <optgroup label="Built-in Strategies">
                          {builtInStrategyOptions.map((s) => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </optgroup>
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="sl-form-group sl-advanced-group" style={{ marginTop: '1rem', borderTop: '1px solid var(--border-main)', paddingTop: '1rem' }}>
              <button
                className="sl-btn-nav"
                style={{ width: '100%', justifyContent: 'space-between', padding: '0.6rem' }}
                onClick={() => setShowAdvancedConfig(!showAdvancedConfig)}
              >
                <span>⚙️ Advanced Factory Config</span>
                <span>{showAdvancedConfig ? '−' : '+'}</span>
              </button>

              {showAdvancedConfig && (
                <div className="sl-advanced-panel">
                  <div className="sl-form-group">
                    <label className="sl-label" style={{ fontSize: '0.75rem' }}>Capacity per Plant</label>
                    <input
                      type="number" className="sl-input" value={advConfig.capacityPerPlant}
                      onChange={e => setAdvConfig({ ...advConfig, capacityPerPlant: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="sl-form-group">
                    <label className="sl-label" style={{ fontSize: '0.75rem' }}>Starting Cash ($)</label>
                    <input
                      type="number" className="sl-input" value={advConfig.startingCash}
                      onChange={e => setAdvConfig({ ...advConfig, startingCash: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="sl-form-group" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                    <div>
                      <label className="sl-label" style={{ fontSize: '0.75rem' }}>US Plant Cost</label>
                      <input
                        type="number" className="sl-input" value={advConfig.plantCostUS}
                        onChange={e => setAdvConfig({ ...advConfig, plantCostUS: parseInt(e.target.value) || 0 })}
                      />
                    </div>
                    <div>
                      <label className="sl-label" style={{ fontSize: '0.75rem' }}>Asia Plant Cost</label>
                      <input
                        type="number" className="sl-input" value={advConfig.plantCostAsia}
                        onChange={e => setAdvConfig({ ...advConfig, plantCostAsia: parseInt(e.target.value) || 0 })}
                      />
                    </div>
                  </div>
                  <div className="sl-form-group" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '0.5rem' }}>
                    <div>
                      <label className="sl-label" style={{ fontSize: '0.75rem' }}>Global Demand</label>
                      <input
                        type="number" step="0.1" className="sl-input" value={advConfig.globalDemand}
                        onChange={e => setAdvConfig({ ...advConfig, globalDemand: parseFloat(e.target.value) || 1.0 })}
                      />
                    </div>
                    <div>
                      <label className="sl-label" style={{ fontSize: '0.75rem' }}>Price Elasticity</label>
                      <input
                        type="number" step="0.1" className="sl-input" value={advConfig.globalElasticity}
                        onChange={e => setAdvConfig({ ...advConfig, globalElasticity: parseFloat(e.target.value) || 1.0 })}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {mode === 'experiment' ? (
              <button
                className="sl-btn-run"
                onClick={handleRunExperiment}
                disabled={isRunning}
              >
                {isRunning ? `Running ${experimentProgress}%...` : 'Run Experiment Batch'}
              </button>
            ) : mode === 'tournament' ? (
              <button
                className="sl-btn-run"
                onClick={handleRunTournament}
                disabled={isRunning || selectedTournamentStrategies.length < 2}
              >
                {isRunning ? `Tournament ${tournamentProgress}%...` : 'Run Tournament'}
              </button>
            ) : (
              <button className="sl-btn-run" onClick={handleRunSimulation} disabled={isRunning}>
                {isRunning ? `Simulating R${currentRound}...` : 'Launch Simulation'}
              </button>
            )}

            {error && (
              <div style={{ marginTop: '1rem', color: 'var(--pro-danger)', fontSize: '0.85rem', fontWeight: 600 }}>
                {error}
              </div>
            )}
          </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>

      {showAudit && (
        <ExperimentAudit config={GAME_CONFIG} onClose={() => setShowAudit(false)} />
      )}

      {showStudentGuideModal && (
        <div className="sl-modal-overlay" onClick={() => setShowStudentGuideModal(false)}>
          <div
            className="sl-modal-content sl-scenario-modal"
            style={{ maxWidth: '980px' }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="sl-modal-header">
              <h3>Student Strategy Guide</h3>
              <button className="sl-btn-nav" type="button" onClick={() => setShowStudentGuideModal(false)}>
                Close
              </button>
            </div>
            <div className="slg-modal-body" style={{ padding: '1.5rem 2rem' }}>
              {studentGuideText ? (
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{studentGuideText}</ReactMarkdown>
              ) : (
                <p style={{ color: 'var(--text-muted)' }}>Loading guide...</p>
              )}
            </div>
          </div>
        </div>
      )}

      {showScenarioBuilder && (
        <ScenarioBuilder
          onClose={() => setShowScenarioBuilder(false)}
          onSave={(scenario) => {
            // Add custom scenario to the list
            const newScenario = {
              ...scenario,
              id: 100 + customScenarios.length, // Custom IDs start at 100
            }
            setCustomScenarios([...customScenarios, newScenario])
            setShowScenarioBuilder(false)
            // Optionally switch to that scenario
            setSingleScenarioId(newScenario.id)
          }}
        />
      )}
    </div>
  )
}
