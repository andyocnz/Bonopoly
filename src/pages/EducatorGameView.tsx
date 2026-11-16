import { useEffect, useState, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useGame } from '../context/GameContext'
import { gameApi, teamApi } from '../api/client'
import { formatCurrency, formatPercent, calculateRound, createInitialGameState, getGameConfigForIndustry, getBalancedStartingFinancials } from '../engine/gameEngine'
import type { TeamResults, TeamGameState as EngineTeamState } from '../engine/gameEngine'
import type { TeamDecisions as EngineDecisions } from '../components/DecisionSimulator'
import { FinancialReport } from '../components/FinancialReport'
import type { FinancialTeamRow } from '../components/FinancialStatements'
import { getRegionLabels } from '../utils/regionLabels'

type RecordAny = Record<string, unknown>
type EducatorViewGame = {
  id: string
  status?: string
  currentRound?: number
  scenarioSequence?: number[]
  marketDemandMultiplier?: number
  regionDemandSplit?: { us?: number; asia?: number; europe?: number }
  roundDeadline?: string | null
  timezone?: string
  gamePin?: string
  gameConfig?: RecordAny
  industry?: string
  capacityPerFactory?: number
  teams?: Array<{
    id: string
    teamCode: string
    teamPin?: string
    name: string
    color: string
    isComputer: boolean
    decisions?: Array<DecisionRoundPayload>
    gameStates?: Array<RecordAny>
  }>
  [key: string]: unknown
}

type DecisionRoundPayload = {
  roundNumber: number
  isSubmitted?: boolean
  production?: RecordAny
  marketing?: RecordAny
  hr?: RecordAny
  rnd?: RecordAny
  finance?: RecordAny
  [key: string]: unknown
}

type CompletedTeamResult = {
  teamId?: string
  id?: string
  rank?: number
  fullResults?: RecordAny
  decisions?: RecordAny
  [key: string]: unknown
}

type CompletedRoundResult = {
  roundNumber: number
  teams: CompletedTeamResult[]
}

type ResultMapRow = RecordAny & {
  rank?: number
  sharePrice?: number
  decisions?: RecordAny
  production?: RecordAny
  availableFeatures?: number
  rndProgress?: RecordAny
  unlockedFeatureCount?: number
}

// Legacy types for UI decision format (different from engine types)
interface LegacyTeamDecisions {
  production: {
    usUnits: number
    asiaUnits: number
    overtime: number
    supplierUS: number
    supplierAsia: number
  }
  hr: {
    training: 'basic' | 'standard' | 'advanced'
    workforce: 'reduce' | 'maintain' | 'expand'
  }
  rnd: RecordAny
  marketing: {
    usBudget: number
    asiaBudget: number
    europeBudget: number
    priceUS: number
    priceAsia: number
    priceEurope: number
  }
  finance: {
    borrowing: number
    repayment: number
    shareIssue: number
    shareBuyback: number
    dividend: number
  }
}

interface LegacyTeamState {
  factoriesUS: number
  factoriesAsia: number
  capacityPerFactory: number
  unlockedTechLevel: number
  unlockedFeatures: number
  cumulativeResearchHours: number
  brandReputation: number
  inventory: number
  cashBalance: number
  longTermDebt: number
  shareCapital: number
  retainedEarnings: number
  totalAssets: number
  totalEquity: number
  sharesOutstanding: number
  sharePrice: number
}

// Helper to convert supplier ID to name
const SUPPLIER_NAMES: Record<number, string> = {
  1: 'Budget',
  2: 'Standard',
  3: 'Eco-Friendly',
  4: 'Premium',
}
const getSupplierName = (id: number) => SUPPLIER_NAMES[id] || 'Unknown'

const getDefaultUiDecisions = (gameConfig: ReturnType<typeof getGameConfigForIndustry>): LegacyTeamDecisions => {
  const defaults = gameConfig.defaults
  const baseline = gameConfig.priceDemand.baselinePriceByRegion
  const allocationPct = defaults.production.allocationPct / 100
  const usUnits = Math.round(gameConfig.initialFactories.us * gameConfig.capacityPerPlant * allocationPct)
  const asiaUnits = Math.round(gameConfig.initialFactories.asia * gameConfig.capacityPerPlant * allocationPct)

  return {
    production: {
      usUnits,
      asiaUnits,
      overtime: defaults.production.overtimePct,
      supplierUS: defaults.production.supplierUS,
      supplierAsia: defaults.production.supplierAsia,
    },
    hr: {
      training: defaults.rnd.trainingLevel,
      workforce: 'maintain',
    },
    rnd: {},
    marketing: {
      usBudget: 0,
      asiaBudget: 0,
      europeBudget: 0,
      priceUS: baseline.us,
      priceAsia: baseline.asia,
      priceEurope: baseline.europe,
    },
    finance: {
      borrowing: 0,
      repayment: 0,
      shareIssue: 0,
      shareBuyback: 0,
      dividend: 0,
    },
  }
}

const toEngineTrainingCost = (
  level: string | undefined,
  region: 'us' | 'asia',
  gameConfig: ReturnType<typeof getGameConfigForIndustry>
) => {
  const trainingLevel = (level || gameConfig.defaults.rnd.trainingLevel) as 'basic' | 'standard' | 'advanced'
  const baseCost = gameConfig.hr.trainingCostPerStaff[trainingLevel]
  return baseCost * gameConfig.hr.trainingCostMultiplierByRegion[region]
}

const mapDbDecisionToEngine = (decision: RecordAny | undefined, gameConfig: ReturnType<typeof getGameConfigForIndustry>): EngineDecisions => {
  const defaults = gameConfig.defaults
  const baseline = gameConfig.priceDemand.baselinePriceByRegion
  const capacityPerPlant = gameConfig.capacityPerPlant
  if (!decision) {
    return {
      production: {
        demandForecast: { us: 0, asia: 0, europe: 0 },
        productionLines: {
          us1: { techLevel: 1, supplierId: defaults.production.supplierUS as 1 | 2 | 3 | 4, units: defaults.production.allocationPct },
          us2: { techLevel: 1, supplierId: defaults.production.supplierUS as 1 | 2 | 3 | 4, units: defaults.production.allocationPct },
          asia1: { techLevel: 1, supplierId: defaults.production.supplierAsia as 1 | 2 | 3 | 4, units: 0 },
          asia2: { techLevel: 1, supplierId: defaults.production.supplierAsia as 1 | 2 | 3 | 4, units: 0 },
        },
        outsource: { techLevel: 1, supplierId: defaults.production.outsourceSupplier as 1 | 2 | 3 | 4, units: 0 },
        overtime: defaults.production.overtimePct,
      },
      hr: {
        us: { ...defaults.hr.us },
        asia: { ...defaults.hr.asia },
      },
      rnd: {},
      investment: { newPlantsUS: 0, newPlantsAsia: 0 },
      logistics: {
        usPriority: defaults.logistics.usPriority,
        asiaPriority: defaults.logistics.asiaPriority,
      },
      marketing: {
        us: { price: baseline.us, features: defaults.marketing.featuresUsed, promotionPct: defaults.marketing.promotionPctByRegion.us },
        asia: { price: baseline.asia, features: defaults.marketing.featuresUsed, promotionPct: defaults.marketing.promotionPctByRegion.asia },
        europe: { price: baseline.europe, features: defaults.marketing.featuresUsed, promotionPct: defaults.marketing.promotionPctByRegion.europe },
      },
      finance: {
        transferPricing: { ...defaults.finance.transferPricing },
        longTermDebt: 0,
        shareIssuance: 0,
        dividends: 0,
      },
    }
  }

  const prod = decision.production || {}
  const hr = decision.hr || {}
  const rnd = decision.rnd || {}
  const inv = decision.investment || {}
  const fin = decision.finance || {}
  const mkt = decision.marketing || {}

  // Handle both old format (hr: { trainingLevel: string }) and new format (hr: { us: { training: number } })
  let usTraining = 0
  let asiaTraining = 0
  let usEmployees = defaults.hr.us.employees
  let asiaEmployees = defaults.hr.asia.employees

  // Try new format first (from DecisionsPage.tsx saves: hr.us.training and hr.asia.training)
  if (hr.us && typeof hr.us === 'object' && 'training' in hr.us) {
    usTraining = hr.us.training ?? 0
    usEmployees = hr.us.employees || rnd.researchStaff || defaults.hr.us.employees
  }
  if (hr.asia && typeof hr.asia === 'object' && 'training' in hr.asia) {
    asiaTraining = hr.asia.training ?? 0
    asiaEmployees = hr.asia.employees || rnd.researchStaff || defaults.hr.asia.employees
  }

  // Fall back to old format (hr: { trainingLevel: string, researchStaff: number })
  if (usTraining === 0 && asiaTraining === 0 && hr.trainingLevel) {
    usTraining = toEngineTrainingCost(hr.trainingLevel, 'us', gameConfig)
    asiaTraining = toEngineTrainingCost(hr.trainingLevel, 'asia', gameConfig)
    usEmployees = rnd.researchStaff || hr.researchStaff || defaults.hr.us.employees
    asiaEmployees = rnd.researchStaff || hr.researchStaff || defaults.hr.asia.employees
  }

  // Also check rnd.trainingLevel for compatibility
  if (usTraining === 0 && asiaTraining === 0 && rnd.trainingLevel) {
    usTraining = toEngineTrainingCost(rnd.trainingLevel, 'us', gameConfig)
    asiaTraining = toEngineTrainingCost(rnd.trainingLevel, 'asia', gameConfig)
    usEmployees = rnd.researchStaff || defaults.hr.us.employees
    asiaEmployees = rnd.researchStaff || defaults.hr.asia.employees
  }

  return {
    production: {
      demandForecast: { us: 0, asia: 0, europe: 0 },
      productionLines: {
        us1: { techLevel: 1, supplierId: (prod.supplierUS ?? defaults.production.supplierUS) as 1 | 2 | 3 | 4, units: prod.usUnits ? (prod.usUnits / (capacityPerPlant / 100)) : defaults.production.allocationPct },
        us2: { techLevel: 1, supplierId: (prod.supplierUS ?? defaults.production.supplierUS) as 1 | 2 | 3 | 4, units: prod.usUnits ? (prod.usUnits / (capacityPerPlant / 100)) : defaults.production.allocationPct },
        asia1: { techLevel: 1, supplierId: (prod.supplierAsia ?? defaults.production.supplierAsia) as 1 | 2 | 3 | 4, units: prod.asiaUnits ? (prod.asiaUnits / (capacityPerPlant / 100)) : 0 },
        asia2: { techLevel: 1, supplierId: (prod.supplierAsia ?? defaults.production.supplierAsia) as 1 | 2 | 3 | 4, units: 0 },
      },
      outsource: { techLevel: 1, supplierId: defaults.production.outsourceSupplier as 1 | 2 | 3 | 4, units: (prod.outsourceUS || 0) + (prod.outsourceAsia || 0) },
      overtime: prod.overtime || 0,
    },
    hr: {
      us: {
        employees: usEmployees,
        wage: defaults.hr.us.wage,
        training: usTraining,
      },
      asia: {
        employees: asiaEmployees,
        wage: defaults.hr.asia.wage,
        training: asiaTraining,
      },
    },
    rnd: {},
    investment: {
      newPlantsUS: inv.newPlantsUS || fin.newPlantsUS || 0,
      newPlantsAsia: inv.newPlantsAsia || fin.newPlantsAsia || 0,
    },
    logistics: {
      usPriority: defaults.logistics.usPriority,
      asiaPriority: defaults.logistics.asiaPriority,
    },
    marketing: {
      us: { price: mkt.priceUS ?? baseline.us, features: defaults.marketing.featuresUsed, promotionPct: mkt.promoUS ?? defaults.marketing.promotionPctByRegion.us },
      asia: { price: mkt.priceAsia ?? baseline.asia, features: defaults.marketing.featuresUsed, promotionPct: mkt.promoAsia ?? defaults.marketing.promotionPctByRegion.asia },
      europe: { price: mkt.priceEurope ?? baseline.europe, features: defaults.marketing.featuresUsed, promotionPct: mkt.promoEurope ?? defaults.marketing.promotionPctByRegion.europe },
    },
    finance: {
      transferPricing: { ...defaults.finance.transferPricing },
      longTermDebt: (fin.borrowing || 0) - (fin.repayment || 0),
      shareIssuance: (fin.shareIssue || 0) - (fin.shareBuyback || 0),
      dividends: fin.dividend || 0,
    },
  }
}

const mapDbStateToLegacy = (
  state: RecordAny | undefined,
  gameConfig: ReturnType<typeof getGameConfigForIndustry>
): LegacyTeamState => {
  // SINGLE SOURCE OF TRUTH: Use getBalancedStartingFinancials for fallback values
  const startingFinancials = getBalancedStartingFinancials(gameConfig)
  return {
    factoriesUS: state?.factoriesUS ?? gameConfig.initialFactories.us,
    factoriesAsia: state?.factoriesAsia ?? gameConfig.initialFactories.asia,
    capacityPerFactory: state?.capacityPerFactory ?? gameConfig.capacityPerPlant,
    unlockedTechLevel: state?.unlockedTechLevel ?? gameConfig.defaults.initialTechLevel,
    unlockedFeatures: state?.unlockedFeatures ?? gameConfig.defaults.initialFeatures,
    cumulativeResearchHours: state?.cumulativeResearchHours ?? gameConfig.defaults.initialResearchHours,
    brandReputation: state?.brandReputation ?? gameConfig.defaults.brandReputation,
    inventory: state?.inventory ?? 0,
    cashBalance: state?.cashBalance ?? startingFinancials.startingCash,
    longTermDebt: state?.longTermDebt ?? startingFinancials.startingDebt,
    shareCapital: state?.shareCapital ?? startingFinancials.startingShareCapital,
    retainedEarnings: state?.retainedEarnings ?? 0,
    totalAssets: state?.totalAssets ?? 0,
    totalEquity: state?.totalEquity ?? 0,
    sharesOutstanding: state?.sharesOutstanding ?? 0,
    sharePrice: state?.sharePrice ?? gameConfig.financial.startingSharePrice,
  }
}

const mapDbStateToEngine = (
  state: RecordAny | undefined,
  gameConfig: ReturnType<typeof getGameConfigForIndustry>
): EngineTeamState => ({
  factories: {
    us: state?.factoriesUS ?? gameConfig.initialFactories.us,
    asia: state?.factoriesAsia ?? gameConfig.initialFactories.asia,
  },
  pendingInvestments: state?.pendingInvestments || [],
  rndProgress: {
    unlockedTechLevel: state?.unlockedTechLevel ?? gameConfig.defaults.initialTechLevel,
    unlockedFeatureCount: state?.unlockedFeatures ?? gameConfig.defaults.initialFeatures,
    cumulativeResearchHours: state?.cumulativeResearchHours ?? gameConfig.defaults.initialResearchHours,
  }, cumulativeProduction: 0,
  brandReputation: state?.brandReputation ?? gameConfig.defaults.brandReputation,
  inventory: state?.inventory ?? 0,
})

interface TeamInfo {
  id: string
  name: string
  teamCode: string
  teamPin?: string
  color: string
  isComputer: boolean
  hasSubmitted: boolean
  decisions: LegacyTeamDecisions
  state: LegacyTeamState
  engineDecisions: EngineDecisions
  engineState: EngineTeamState
  rawDecision?: DecisionRoundPayload
  rawDecisions?: DecisionRoundPayload[]
}

type TabType = 'overview' | 'decisions' | 'results'

export function EducatorGameView({ game: propGame }: { game?: EducatorViewGame }) {
  const navigate = useNavigate()
  const location = useLocation()
  const stateGame = location.state?.game
  const { game: contextGame, setGame: setContextGame, isEducator, isAdmin, logout, authReady } = useGame()

  const [localGame, setLocalGame] = useState<EducatorViewGame | null>((propGame as EducatorViewGame) || (stateGame as EducatorViewGame) || (contextGame as EducatorViewGame) || null)

  // Sync if context updates and no prop/state provided
  useEffect(() => {
    if (!propGame && !stateGame && contextGame && !localGame) {
      setLocalGame(contextGame)
    }
  }, [contextGame, propGame, stateGame, localGame])

  // NOTE: This effect is new - it handles loading by gameId from URL (for new tab support)
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const gameId = params.get('gameId')

    if (gameId && !localGame && !propGame && !stateGame) {
      setLoading(true)
      gameApi.get(gameId)
        .then(({ game }) => {
          setLocalGame(game as EducatorViewGame)
          // Also set context if appropriate, though context might be session-bound
          if (setContextGame) setContextGame(game as EducatorViewGame)
        })
        .catch(err => setError(err.message))
        .finally(() => setLoading(false))
    }
  }, [location.search, localGame, propGame, stateGame, setContextGame])

  // Internal setGame wrapper
  const setGame = (newGame: EducatorViewGame) => {
    setLocalGame(newGame)
    if (contextGame && !propGame && setContextGame) {
      setContextGame(newGame)
    }
  }

  const game = localGame
  const gameConfig = useMemo(
    () => (game?.gameConfig && typeof game.gameConfig === 'object'
      ? game.gameConfig
      : getGameConfigForIndustry(
        game?.industry,
        game?.capacityPerFactory ? { capacityPerPlant: game.capacityPerFactory } : undefined
      )),
    [game?.gameConfig, game?.industry, game?.capacityPerFactory]
  )
  const startingBalanceSheet = useMemo(() => {
    const baseline = getBalancedStartingFinancials(gameConfig)
    return {
      cash: baseline.startingCash,
      receivables: 0,
      inventory: baseline.inventoryValue,
      payables: 0,
      fixedAssets: baseline.fixedAssets,
      longTermDebt: baseline.startingDebt,
      shortTermLoans: 0,
      shareCapital: baseline.startingShareCapital,
      retainedEarnings: 0,
    }
  }, [gameConfig])
  const [teams, setTeams] = useState<TeamInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<TabType>('overview')
  const [devMode, setDevMode] = useState(false)
  const showLegacyDetailedResults = false
  const [isCalculating, setIsCalculating] = useState(false)
  const [roundCalculated, setRoundCalculated] = useState(false)
  const [teamsDataRound, setTeamsDataRound] = useState<number | null>(null) // Track which round teams data is for
  const [gamePin, setGamePin] = useState<string>('')
  const [completedResults, setCompletedResults] = useState<CompletedRoundResult[]>([])
  const [selectedResultsRound, setSelectedResultsRound] = useState<'live' | number>('live')
  const [selectedDecisionRound, setSelectedDecisionRound] = useState<number | null>(null)
  const [now, setNow] = useState(Date.now())

  const deadline = useMemo(() => (game?.roundDeadline ? new Date(game.roundDeadline) : null), [game?.roundDeadline])
  const timeZone = useMemo(() => {
    const candidate = game?.timezone || 'Pacific/Auckland'
    const intlWithSupportedValues = Intl as typeof Intl & { supportedValuesOf?: (key: 'timeZone') => string[] }
    if (typeof intlWithSupportedValues.supportedValuesOf === 'function') {
      const supported = intlWithSupportedValues.supportedValuesOf('timeZone')
      return supported.includes(candidate) ? candidate : 'Pacific/Auckland'
    }
    try {
      new Intl.DateTimeFormat('en-NZ', { timeZone: candidate }).format(new Date())
      return candidate
    } catch {
      return 'Pacific/Auckland'
    }
  }, [game?.timezone])

  useEffect(() => {
    if (!deadline) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [deadline])

  const deadlineLabel = useMemo(() => {
    if (!deadline) return '---'
    try {
      return new Intl.DateTimeFormat('en-NZ', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone,
        timeZoneName: 'short',
      }).format(deadline)
    } catch {
      return deadline.toLocaleString('en-NZ')
    }
  }, [deadline, timeZone])

  const timeRemainingLabel = useMemo(() => {
    if (game?.status === 'COMPLETED') return 'Complete'
    if (!deadline) return 'No time limit'
    const remainingMs = deadline.getTime() - now
    if (remainingMs <= 0) return 'Time expired'
    const totalSeconds = Math.floor(remainingMs / 1000)
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60
    return `${hours}h ${minutes}m ${seconds}s`
  }, [deadline, now, game?.status])

  const isExpired = useMemo(() => !!deadline && (deadline.getTime() - now <= 0), [deadline, now])

  const regionLabels = useMemo(() => getRegionLabels(game ?? undefined), [game?.regionLabels])

  useEffect(() => {
    if (propGame) return // Allow if explicit game provided
    if (!authReady) return

    // If we have a gameId in URL, we can fetch it even if context game is null
    const urlParams = new URLSearchParams(window.location.search)
    const hasGameIdParam = !!urlParams.get('gameId')

    if (!isEducator && !isAdmin) {
      navigate('/')
      return
    }

    if (!game && !hasGameIdParam) {
      navigate('/')
      return
    }

    // Fetch full game data
    const fetchGame = async () => {
      try {
        const targetGameId = game?.id || new URLSearchParams(window.location.search).get('gameId')
        if (!targetGameId) throw new Error('No game ID found')
        const { game: fullGame } = await gameApi.get(targetGameId)
        const gameData = fullGame as EducatorViewGame

        // Extract gamePin from the fetched game data
        if (gameData.gamePin) {
          setGamePin(gameData.gamePin)
        }

        setTeams(
          gameData.teams.map((t) => {
            const currentDecision = t.decisions?.find(
              (d) => d.roundNumber === gameData.currentRound
            )
            const defaultState = mapDbStateToLegacy(t.gameStates?.[0], gameConfig)

            // Transform database decision format to UI format
            let decisions: LegacyTeamDecisions
            if (currentDecision) {
              const dbProd = currentDecision.production || {}
              const dbMkt = currentDecision.marketing || {}
              const dbHr = currentDecision.hr || {}
              const dbFin = currentDecision.finance || {}
              const defaults = gameConfig.defaults
              const baseline = gameConfig.priceDemand.baselinePriceByRegion
              const allocationPct = defaults.production.allocationPct / 100
              const defaultUsUnits = Math.round(gameConfig.initialFactories.us * gameConfig.capacityPerPlant * allocationPct)

              decisions = {
                production: {
                  usUnits: dbProd.usUnits ?? defaultUsUnits,
                  asiaUnits: dbProd.asiaUnits ?? 0,
                  overtime: dbProd.overtime ?? 0,
                  supplierUS: dbProd.supplierUS ?? defaults.production.supplierUS,
                  supplierAsia: dbProd.supplierAsia ?? defaults.production.supplierAsia,
                },
                hr: {
                  training: (dbHr.trainingLevel as 'basic' | 'standard' | 'advanced') ?? defaults.rnd.trainingLevel,
                  workforce: 'maintain',
                },
                rnd: {},
                marketing: {
                  usBudget: (dbMkt.promoUS ?? defaults.marketing.promotionPctByRegion.us) * 100000,
                  asiaBudget: (dbMkt.promoAsia ?? defaults.marketing.promotionPctByRegion.asia) * 100000,
                  europeBudget: (dbMkt.promoEurope ?? defaults.marketing.promotionPctByRegion.europe) * 100000,
                  priceUS: dbMkt.priceUS ?? baseline.us,
                  priceAsia: dbMkt.priceAsia ?? baseline.asia,
                  priceEurope: dbMkt.priceEurope ?? baseline.europe,
                },
                finance: {
                  borrowing: dbFin.borrowing ?? 0,
                  repayment: dbFin.repayment ?? 0,
                  shareIssue: dbFin.shareIssue ?? 0,
                  shareBuyback: dbFin.shareBuyback ?? 0,
                  dividend: dbFin.dividend ?? 0,
                },
              }
            } else {
              decisions = { ...getDefaultUiDecisions(gameConfig) }
            }

            return {
              id: t.id,
              name: t.name,
              teamCode: t.teamCode,
              teamPin: t.teamPin,
              color: t.color,
              isComputer: t.isComputer,
              hasSubmitted: t.isComputer ? true : (currentDecision?.isSubmitted ?? false),
              decisions,
              state: defaultState,
              engineDecisions: mapDbDecisionToEngine(currentDecision, gameConfig),
              engineState: mapDbStateToEngine(t.gameStates?.[0], gameConfig),
              rawDecision: currentDecision,
              rawDecisions: t.decisions,
            }
          })
        )
        // Mark which round this teams data is for (to prevent stale data issues)
        setTeamsDataRound(gameData.currentRound)

        // Update game state including teams from API
        const apiTeams = gameData.teams.map(t => ({
          id: t.id,
          teamCode: t.teamCode,
          name: t.name,
          color: t.color,
          isComputer: t.isComputer,
          teamPin: t.teamPin,
        }))

        // Use fullGame data to construct the new game state instead of merging with potentially stale 'game'
        // This allows us to remove 'game' from the dependency array to prevent infinite loops
        setGame({
          ...(fullGame as EducatorViewGame),
          // Ensure compatibility with Context Game type
          roundDeadline: (fullGame as EducatorViewGame).roundDeadline ? new Date((fullGame as EducatorViewGame).roundDeadline as string).toISOString() : null,
          teams: apiTeams
        })
      } catch (err) {
        console.error('Error fetching game:', err)
      }
    }

    fetchGame()

    const gameCompleted = (game?.status || '').toUpperCase() === 'COMPLETED'
    let interval: ReturnType<typeof setInterval> | null = null
    const handleVisibilityChange = () => {
      if (!gameCompleted && document.visibilityState === 'visible') {
        fetchGame()
      }
    }

    if (!gameCompleted) {
      // Reduced polling from 2s to 30s and added visibility check to save 93% database bandwidth
      interval = setInterval(() => {
        if (document.visibilityState === 'visible') {
          fetchGame()
        }
      }, 30000) // Poll every 30 seconds (reduced from 2s)

      // Poll immediately when page becomes visible
      document.addEventListener('visibilitychange', handleVisibilityChange)
    }

    return () => {
      if (interval) clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [game?.id, game?.status, isEducator, isAdmin, navigate, setGame, authReady])

  useEffect(() => {
    const seedTeamId = teams[0]?.id
    if (!seedTeamId) {
      setCompletedResults([])
      return
    }

    let isActive = true

    const fetchCompletedResults = async () => {
      try {
        const data = await teamApi.getResults(seedTeamId, 'full', 'educator-game-view')
        if (!isActive) return
        setCompletedResults((data.results ?? []) as CompletedRoundResult[])
      } catch (err) {
        console.error('Error fetching completed results:', err)
      }
    }

    fetchCompletedResults()
    return () => {
      isActive = false
    }
  }, [teams])

  useEffect(() => {
    if (selectedResultsRound === 'live') {
      return
    }
    const hasRound = completedResults.some((round) => round.roundNumber === selectedResultsRound)
    if (!hasRound) {
      setSelectedResultsRound('live')
    }
  }, [completedResults, selectedResultsRound])

  const handleStartGame = async () => {
    if (!game) return

    setLoading(true)
    setError('')

    try {
      await gameApi.start(game.id)
      setGame({ ...game, status: 'ACTIVE' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start game')
    } finally {
      setLoading(false)
    }
  }

  const handleAdvanceRound = async () => {
    if (!game) return

    // Determine if we need to force because of unsubmitted teams or early advance
    const needsForce = !allSubmitted || !!(deadline && deadline.getTime() > Date.now());

    if (deadline && deadline.getTime() > Date.now()) {
      const confirmAdvance = window.confirm(
        `The round deadline has not passed.\n\nRound ends: ${deadlineLabel}\nTime remaining: ${timeRemainingLabel}\n\nAdvance anyway and lock all current decisions?`
      )
      if (!confirmAdvance) return
    } else if (!allSubmitted) {
      const confirmForce = window.confirm(
        `Some teams have not submitted their decisions.\n\nAdvance anyway? (Default decisions will be used for missing teams)`
      )
      if (!confirmForce) return
    }

    setLoading(true)
    setError('')

    try {
      // Pass force=true if we have unsubmitted teams or are advancing early
      const result = await gameApi.advance(game.id, needsForce)
      if (result.completed) {
        setGame({ ...game, status: 'COMPLETED' })
      } else if (result.currentRound !== undefined) {
        setGame({ ...game, currentRound: result.currentRound })
        // Reset for next round
        setRoundCalculated(false)
      }
    } catch (err: unknown) {
      // Handle specific error for unsubmitted teams
      const errWithResponse = err as { response?: { data?: { unsubmittedTeams?: string[] } } }
      if (errWithResponse?.response?.data?.unsubmittedTeams) {
        const unsubmitted = errWithResponse.response.data.unsubmittedTeams
        setError(`Cannot advance: ${unsubmitted.length} team(s) have not submitted their decisions: ${unsubmitted.join(', ')}`)
      } else {
        setError(err instanceof Error ? err.message : 'Failed to advance round')
      }
    } finally {
      setLoading(false)
    }
  }

  // Calculate live results based on current decisions
  const liveResults = useMemo(() => {
    if (teams.length === 0) return new Map<string, TeamResults>()

    const prevRoundResultsMap = new Map<string, RecordAny | null>()
    if (game?.currentRound && game.currentRound > 1) {
      const prevRoundData = completedResults.find((round) => round.roundNumber === game.currentRound - 1)
      prevRoundData?.teams?.forEach((teamResult) => {
        if (teamResult?.teamId) {
          prevRoundResultsMap.set(teamResult.teamId, teamResult.fullResults || null)
        }
      })
    }

    const teamsWithData = teams.map((t, index) => ({
      id: index,
      name: t.name,
      originalId: t.id,
      decisions: t.engineDecisions,
      engineState: {
        ...(t.engineState ?? createInitialGameState(gameConfig)),
        previousRoundResults: prevRoundResultsMap.get(t.id) ?? t.engineState?.previousRoundResults,
      },
    }))

    const previousGameStates = new Map<number, EngineTeamState>()
    teamsWithData.forEach((t) => {
      previousGameStates.set(t.id, t.engineState)
    })

    const roundResults = calculateRound(
      teamsWithData.map((t) => ({ id: t.id, name: t.name, decisions: t.decisions })),
      game?.currentRound ?? 0,
      previousGameStates,
      game?.scenarioSequence,
      game?.marketDemandMultiplier ?? 1,
      gameConfig,
      game?.regionDemandSplit
    )

    const results = new Map<string, ResultMapRow>()
    roundResults.teams.forEach((teamResult) => {
      const original = teamsWithData.find((t) => t.id === teamResult.teamId)
      if (!original) return

      results.set(original.originalId, {
        rank: 0,
        salesUnitsUS: teamResult.sales.us.units,
        salesUnitsAsia: teamResult.sales.asia.units,
        salesUnitsEurope: teamResult.sales.europe.units,
        totalUnitsSold: teamResult.sales.total.units,
        revenueUS: teamResult.sales.us.revenue,
        revenueAsia: teamResult.sales.asia.revenue,
        revenueEurope: teamResult.sales.europe.revenue,
        totalRevenue: teamResult.pnl.revenue,
        cogs: teamResult.pnl.cogs,
        productionCost: teamResult.costs.production,
        materialsCost: teamResult.costs.materials,
        laborCost: teamResult.costs.labor,
        logisticsCost: teamResult.costs.logistics,
        outsourcingCost: teamResult.costs.outsourcing,
        marketingCost: teamResult.costs.marketing,
        rdCost: teamResult.costs.rnd,
        adminCost: teamResult.costs.admin,
        operatingExpenses: teamResult.pnl.operatingExpenses,
        ebitda: teamResult.pnl.ebitda,
        depreciation: teamResult.pnl.depreciation,
        ebit: teamResult.pnl.ebit,
        interestCost: teamResult.costs.interest,
        profitBeforeTax: teamResult.pnl.profitBeforeTax,
        tax: teamResult.pnl.tax,
        totalCost: teamResult.costs.totalCost,
        grossProfit: teamResult.pnl.grossProfit,
        operatingProfit: teamResult.pnl.ebit,
        netProfit: teamResult.pnl.netProfit,
        fixedAssets: teamResult.balanceSheet.fixedAssets,
        inventory: teamResult.balanceSheet.inventory,
        inventoryUnits: teamResult.gameState?.inventory ?? 0,
        receivables: teamResult.balanceSheet.receivables,
        cash: teamResult.balanceSheet.cash,
        totalAssets: teamResult.balanceSheet.totalAssets,
        longTermDebt: teamResult.balanceSheet.longTermDebt,
        shortTermLoans: teamResult.balanceSheet.shortTermLoans,
        payables: teamResult.balanceSheet.payables,
        totalLiabilities: teamResult.balanceSheet.totalLiabilities,
        shareCapital: teamResult.balanceSheet.shareCapital,
        retainedEarnings: teamResult.balanceSheet.retainedEarnings,
        totalEquity: teamResult.balanceSheet.totalEquity,
        marketShareUS: teamResult.marketShare.us / 100,
        marketShareAsia: teamResult.marketShare.asia / 100,
        marketShareEurope: teamResult.marketShare.europe / 100,
        sharePrice: teamResult.kpis.sharePrice,
        eps: teamResult.kpis.eps,
        roe: teamResult.ratios.roe / 100,
        tsr: teamResult.kpis.tsr / 100,
        dividendYield: teamResult.kpis.dividendYield ?? 0,
        sharesOutstanding: teamResult.kpis.sharesOutstanding ?? 0,
        dividends: teamResult.decisions?.finance?.dividends ?? 0,
        sharePriceTrace: teamResult.kpis.sharePriceTrace ?? null,
        availableFeatures: teamResult.availableFeatures,
        availableTechLevel: teamResult.availableTechLevel,
        rndProgress: teamResult.gameState.rndProgress,
        researchHoursThisRound: teamResult.researchHoursThisRound,
        unlockedFeatureCount: teamResult.availableFeatures,
      })
    })

    const ranked = [...results.entries()].sort((a, b) => b[1].sharePrice - a[1].sharePrice)
    ranked.forEach(([key], index) => {
      const row = results.get(key)
      if (row) row.rank = index + 1
    })

    return results
  }, [teams, game?.scenarioSequence, game?.currentRound])

  const completedRoundNumbers = useMemo(() => {
    const uniqueRounds = new Set(completedResults.map((round) => round.roundNumber))
    return Array.from(uniqueRounds).sort((a, b) => a - b)
  }, [completedResults])

  const selectableCompletedRounds = useMemo(() => {
    if (game?.currentRound === undefined) {
      return completedRoundNumbers
    }
    return completedRoundNumbers.filter((roundNumber) => roundNumber < game.currentRound)
  }, [completedRoundNumbers, game?.currentRound])

  const buildResultsMap = (roundData?: { teams?: CompletedTeamResult[] }) => {
    if (!roundData?.teams) {
      return new Map<string, ResultMapRow>()
    }

    const map = new Map<string, ResultMapRow>()
    roundData.teams.forEach((teamResult) => {
      const full = teamResult.fullResults || {}
      const sales = full.sales || {}
      const pnl = full.pnl || {}
      const costs = full.costs || {}
      const marketShare = full.marketShare || {}
      const kpis = full.kpis || {}
      const ratios = full.ratios || {}
      const balanceSheet = full.balanceSheet || {}
      const decisions = full.decisions || teamResult.decisions || {}
      const production = decisions.production || {}
      const auditInventory = full.audit?.trace?.inventory || {}

      const salesUnitsUS = sales.us?.units ?? 0
      const salesUnitsAsia = sales.asia?.units ?? 0
      const salesUnitsEurope = sales.europe?.units ?? 0

      map.set(teamResult.teamId, {
        rank: teamResult.rank ?? 0,
        salesUnitsUS,
        salesUnitsAsia,
        salesUnitsEurope,
        totalUnitsSold: salesUnitsUS + salesUnitsAsia + salesUnitsEurope,
        revenueUS: sales.us?.revenue ?? 0,
        revenueAsia: sales.asia?.revenue ?? 0,
        revenueEurope: sales.europe?.revenue ?? 0,
        totalRevenue: pnl.revenue ?? 0,
        cogs: pnl.cogs ?? 0,
        productionCost: costs.production ?? 0,
        materialsCost: costs.materials ?? 0,
        laborCost: costs.labor ?? 0,
        logisticsCost: costs.logistics ?? 0,
        outsourcingCost: costs.outsourcing ?? 0,
        marketingCost: costs.marketing ?? 0,
        rdCost: costs.rnd ?? 0,
        adminCost: costs.admin ?? 0,
        operatingExpenses: pnl.operatingExpenses ?? 0,
        ebitda: pnl.ebitda ?? 0,
        depreciation: pnl.depreciation ?? 0,
        ebit: pnl.ebit ?? 0,
        interestCost: costs.interest ?? 0,
        profitBeforeTax: pnl.profitBeforeTax ?? 0,
        tax: pnl.tax ?? 0,
        totalCost: costs.totalCost ?? 0,
        grossProfit: pnl.grossProfit ?? 0,
        operatingProfit: pnl.ebit ?? 0,
        netProfit: pnl.netProfit ?? 0,
        fixedAssets: balanceSheet.fixedAssets ?? 0,
        inventory: balanceSheet.inventory ?? 0,
        inventoryUnits: full.gameState?.inventory ?? 0,
        inventoryStartUnits: auditInventory.startingUnits ?? 0,
        inventoryEndUnits: auditInventory.endingUnits ?? (full.gameState?.inventory ?? 0),
        receivables: balanceSheet.receivables ?? 0,
        cash: balanceSheet.cash ?? 0,
        totalAssets: balanceSheet.totalAssets ?? 0,
        longTermDebt: balanceSheet.longTermDebt ?? 0,
        shortTermLoans: balanceSheet.shortTermLoans ?? 0,
        payables: balanceSheet.payables ?? 0,
        totalLiabilities: balanceSheet.totalLiabilities ?? 0,
        shareCapital: balanceSheet.shareCapital ?? 0,
        retainedEarnings: balanceSheet.retainedEarnings ?? 0,
        totalEquity: balanceSheet.totalEquity ?? 0,
        marketShareUS: (marketShare.us ?? 0) / 100,
        marketShareAsia: (marketShare.asia ?? 0) / 100,
        marketShareEurope: (marketShare.europe ?? 0) / 100,
        sharePrice: kpis.sharePrice ?? 0,
        eps: kpis.eps ?? 0,
        roe: (ratios.roe ?? 0) / 100,
        tsr: (kpis.tsr ?? 0) / 100,
        dividendYield: kpis.dividendYield ?? 0,
        sharesOutstanding: kpis.sharesOutstanding ?? 0,
        dividends: full.decisions?.finance?.dividends ?? teamResult.decisions?.finance?.dividends ?? 0,
        sharePriceTrace: kpis.sharePriceTrace ?? null,
        availableFeatures: full.availableFeatures ?? 0,
        availableTechLevel: full.availableTechLevel ?? 1,
        decisions,
        production,
      })
    })

    return map
  }

  useEffect(() => {
    if (selectedResultsRound === 'live') return
    if (game?.currentRound === undefined) return
    if (selectedResultsRound >= game.currentRound) {
      setSelectedResultsRound('live')
    }
  }, [selectedResultsRound, game?.currentRound])

  const completedResultsMap = useMemo(() => {
    if (selectedResultsRound === 'live') {
      return null
    }
    const roundData = completedResults.find((round) => round.roundNumber === selectedResultsRound)
    if (!roundData) {
      return null
    }

    return buildResultsMap(roundData)
  }, [completedResults, selectedResultsRound])

  const resultsForView = useMemo(() => {
    if (selectedResultsRound === 'live') {
      return liveResults
    }
    return completedResultsMap ?? new Map<string, ResultMapRow>()
  }, [selectedResultsRound, liveResults, completedResultsMap])

  const prevResultsForView = useMemo(() => {
    const prevRound =
      selectedResultsRound === 'live'
        ? ((game?.currentRound ?? 0) - 1)
        : (selectedResultsRound - 1)

    if (prevRound < 0) {
      return new Map<string, ResultMapRow>()
    }

    const roundData = completedResults.find((round) => round.roundNumber === prevRound)
    if (!roundData) {
      return new Map<string, ResultMapRow>()
    }

    return buildResultsMap(roundData)
  }, [selectedResultsRound, completedResults, game?.currentRound])

  const rankedTeamsForResults = useMemo(() => {
    return [...teams].sort((a, b) => a.name.localeCompare(b.name))
  }, [teams])

  const buildFinancialRow = (team: TeamInfo, result?: ResultMapRow): FinancialTeamRow => {
    const revenue = result?.totalRevenue ?? 0
    const grossProfit = result?.grossProfit ?? 0
    const netProfit = result?.netProfit ?? 0
    const cogs = result?.cogs ?? 0
    const operatingExpenses = result?.operatingExpenses ?? 0
    const production = result?.decisions?.production ?? result?.production
    const marketingDecision = result?.decisions?.marketing ?? {}
    const hrDecision = result?.decisions?.hr ?? {}
    const inventoryUnits = result?.inventoryUnits ?? result?.inventoryEndUnits ?? 0
    const csrScore = result?.attractivenessBreakdown?.us?.csrScore ?? result?.attractivenessBreakdown?.asia?.csrScore ?? 0
    const csrRating = csrScore > 0 ? csrScore / 25 : (result?.csrRating ?? 0)
    const features = result?.availableFeatures ?? result?.rndProgress?.unlockedFeatureCount ?? 0
    const trainingBudget =
      (hrDecision?.us?.training ?? hrDecision?.trainingUS ?? 0) +
      (hrDecision?.asia?.training ?? hrDecision?.trainingAsia ?? 0) +
      (hrDecision?.europe?.training ?? hrDecision?.trainingEurope ?? 0)
    return {
      teamId: team.id,
      teamName: team.name,
      revenue,
      revenueUS: result?.revenueUS ?? 0,
      revenueAsia: result?.revenueAsia ?? 0,
      revenueEurope: result?.revenueEurope ?? 0,
      priceUS: result?.priceUS ?? result?.sales?.us?.price ?? 0,
      priceAsia: result?.priceAsia ?? result?.sales?.asia?.price ?? 0,
      priceEurope: result?.priceEurope ?? result?.sales?.europe?.price ?? 0,
      promoUS: marketingDecision?.us?.promotionPct ?? marketingDecision?.promoUS ?? marketingDecision?.promotionUS ?? 0,
      promoAsia: marketingDecision?.asia?.promotionPct ?? marketingDecision?.promoAsia ?? marketingDecision?.promotionAsia ?? 0,
      promoEurope: marketingDecision?.europe?.promotionPct ?? marketingDecision?.promoEurope ?? marketingDecision?.promotionEurope ?? 0,
      features,
      csrRating,
      trainingBudget,
      cogs,
      materials: result?.materialsCost ?? 0,
      labor: result?.laborCost ?? 0,
      logistics: result?.logisticsCost ?? 0,
      outsourcing: result?.outsourcingCost ?? 0,
      grossProfit,
      grossMargin: revenue > 0 ? (grossProfit / revenue) * 100 : 0,
      operatingExpenses,
      rnd: result?.rdCost ?? 0,
      marketing: result?.marketingCost ?? 0,
      admin: result?.adminCost ?? 0,
      ebitda: result?.ebitda ?? 0,
      depreciation: result?.depreciation ?? 0,
      ebit: result?.ebit ?? 0,
      interestExpense: result?.interestCost ?? 0,
      tax: result?.tax ?? 0,
      taxLossCarryforward: result?.gameState?.taxLossCarryforward ?? result?.taxLossCarryforwardEnd ?? 0,
      netProfit,
      netMargin: revenue > 0 ? (netProfit / revenue) * 100 : 0,
      fixedAssets: result?.fixedAssets ?? 0,
      inventory: result?.inventory ?? 0,
      receivables: result?.receivables ?? 0,
      cash: result?.cash ?? 0,
      totalAssets: result?.totalAssets ?? 0,
      longTermDebt: result?.longTermDebt ?? 0,
      shortTermLoans: result?.shortTermLoans ?? 0,
      payables: result?.payables ?? 0,
      totalLiabilities: result?.totalLiabilities ?? 0,
      shareCapital: result?.shareCapital ?? 0,
      retainedEarnings: result?.retainedEarnings ?? 0,
      totalEquity: result?.totalEquity ?? 0,
      marketShareUS: result?.marketShareUS ?? 0,
      marketShareAsia: result?.marketShareAsia ?? 0,
      marketShareEurope: result?.marketShareEurope ?? 0,
      unitsSold: result?.totalUnitsSold ?? 0,
      unitsSoldUS: result?.salesUnitsUS ?? 0,
      unitsSoldAsia: result?.salesUnitsAsia ?? 0,
      unitsSoldEurope: result?.salesUnitsEurope ?? 0,
      productionUS: production?.usUnits ?? 0,
      productionAsia: production?.asiaUnits ?? 0,
      outsourceUS: production?.outsourceUS ?? 0,
      outsourceAsia: production?.outsourceAsia ?? 0,
      inventoryStartUnits: result?.inventoryStartUnits ?? 0,
      inventoryEndUnits: inventoryUnits,
      sharePrice: result?.sharePrice ?? 0,
      eps: result?.eps ?? 0,
      roe: result?.roe ?? 0,
      tsr: result?.tsr ?? 0,
      dividendYield: result?.dividendYield ?? 0,
      sharesOutstanding: result?.sharesOutstanding ?? 0,
      dividends: result?.dividends ?? 0,
      sharePriceTrace: result?.sharePriceTrace ?? null,
    }
  }

  const financialTeamsForResults = useMemo(
    () => rankedTeamsForResults.map((team) => buildFinancialRow(team, resultsForView.get(team.id))),
    [rankedTeamsForResults, resultsForView]
  )

  const previousTeamsForResults = useMemo(() => {
    const prevRound = selectedResultsRound === 'live'
      ? (game?.currentRound ?? 0) - 1
      : (typeof selectedResultsRound === 'number' ? selectedResultsRound - 1 : -1)
    if (prevRound < 1) {
      return new Map<string, FinancialTeamRow>()
    }
    const prevData = completedResults.find((round) => round.roundNumber === prevRound)
    if (!prevData) {
      return new Map<string, FinancialTeamRow>()
    }
    const prevMap = buildResultsMap(prevData)
    const map = new Map<string, FinancialTeamRow>()
    rankedTeamsForResults.forEach((team) => {
      map.set(team.id, buildFinancialRow(team, prevMap.get(team.id)))
    })
    return map
  }, [selectedResultsRound, game?.currentRound, completedResults, rankedTeamsForResults])

  const exportRounds = useMemo(() => {
    const rounds = completedResults
      .filter((round) => typeof round.roundNumber === 'number')
      .map((round) => {
        const resultsMap = buildResultsMap(round)
        const teamsForRound = rankedTeamsForResults.map((team) =>
          buildFinancialRow(team, resultsMap.get(team.id))
        )
        return {
          roundNumber: round.roundNumber,
          label: round.roundNumber === 0 ? 'Trial Round' : `Round ${round.roundNumber}`,
          teams: teamsForRound,
        }
      })

    const roundMap = new Map<number, { roundNumber: number; teams: FinancialTeamRow[] }>()
    rounds.forEach((round) => roundMap.set(round.roundNumber, round))

    return rounds.map((round) => {
      if (round.roundNumber <= 1) return round
      const prev = roundMap.get(round.roundNumber - 1)
      if (!prev) return round
      const prevMap = new Map<string, FinancialTeamRow>()
      prev.teams.forEach((team) => prevMap.set(team.teamId, team))
      return { ...round, previousTeams: prevMap }
    })
  }, [completedResults, rankedTeamsForResults, buildResultsMap, buildFinancialRow])

  const [expandedPnlRow, setExpandedPnlRow] = useState<string | null>(null)

  const togglePnlRow = (key: string) => {
    setExpandedPnlRow((current) => (current === key ? null : key))
  }

  const formatMaybeCurrency = (value?: number) => {
    if (!Number.isFinite(value)) return '-'
    return formatCurrency(value as number)
  }

  const formatMoney2 = (value?: number) => {
    if (!Number.isFinite(value)) return '-'
    return `$${(value as number).toFixed(2)}`
  }

  const formatMaybePercent = (value?: number) => {
    if (!Number.isFinite(value)) return '-'
    return formatPercent(value as number)
  }

  const renderBreakdownRow = (
    label: string,
    getValue: (result: ResultMapRow | undefined) => number | undefined
  ) => (
    <tr>
      <td className="breakdown-label">{label}</td>
      {rankedTeamsForResults.map((team) => (
        <td key={team.id} className="breakdown-value">
          {formatMaybeCurrency(getValue(resultsForView.get(team.id)))}
        </td>
      ))}
    </tr>
  )

  const resultsRoundLabel = selectedResultsRound === 'live'
    ? (game?.currentRound === 0 ? 'Trial' : game?.currentRound)
    : (selectedResultsRound === 0 ? 'Trial' : selectedResultsRound)

  const decisionRoundNumbers = useMemo(() => {
    const rounds = new Set<number>()
    teams.forEach((team) => {
      team.rawDecisions?.forEach((decision) => {
        if (typeof decision.roundNumber === 'number') {
          rounds.add(decision.roundNumber)
        }
      })
    })
    return Array.from(rounds).sort((a, b) => a - b)
  }, [teams])

  const decisionsRoundLabel = selectedDecisionRound === null
    ? (game?.currentRound === 0 ? 'Trial' : game?.currentRound)
    : (selectedDecisionRound === 0 ? 'Trial' : selectedDecisionRound)

  const getDecisionForTeam = (team: TeamInfo) => {
    if (selectedDecisionRound === null) {
      return team.rawDecision
    }
    return team.rawDecisions?.find((decision) => decision.roundNumber === selectedDecisionRound)
  }

  const getFeaturesForTeam = (team: TeamInfo, canView: boolean) => {
    if (!canView) return '-'
    const isLive = selectedDecisionRound === null || selectedDecisionRound === game?.currentRound
    if (isLive) {
      return `${liveResults.get(team.id)?.availableFeatures ?? team.state?.unlockedFeatures ?? 0}`
    }
    const roundData = completedResults.find((round) => round.roundNumber === selectedDecisionRound)
    const teamResult = roundData?.teams?.find((t) => t.teamId === team.id)
    return `${teamResult?.fullResults?.availableFeatures ?? team.state?.unlockedFeatures ?? 0}`
  }

  useEffect(() => {
    if (selectedDecisionRound === null) {
      return
    }
    if (!decisionRoundNumbers.includes(selectedDecisionRound)) {
      setSelectedDecisionRound(null)
    }
  }, [decisionRoundNumbers, selectedDecisionRound])

  useEffect(() => {
    if (selectedDecisionRound === null && typeof game?.currentRound === 'number') {
      setSelectedDecisionRound(game.currentRound)
    }
  }, [game?.currentRound, selectedDecisionRound])

  // Count only human teams for submission tracking
  const humanTeams = teams.filter((t) => !t.isComputer)
  const submittedHumanCount = humanTeams.filter((t) => t.hasSubmitted).length
  const totalHumanTeams = humanTeams.length
  // All submitted if: no human teams (all AI) OR all humans have submitted
  const allSubmitted = teams.length > 0 && (totalHumanTeams === 0 || submittedHumanCount >= totalHumanTeams)

  // Auto-calculate when all teams have submitted
  // CRITICAL: Only auto-calculate if teams data is fresh (matches current round)
  // This prevents a race condition where stale submission data from a previous round
  // triggers premature calculation before the human team has made decisions
  const teamsDataIsFresh = teamsDataRound === game?.currentRound

  useEffect(() => {
    if (
      game?.status === 'ACTIVE' &&
      allSubmitted &&
      teamsDataIsFresh && // CRITICAL: Ensure teams data is for current round
      !isCalculating &&
      !roundCalculated
    ) {
      setIsCalculating(true)

      const autoCalculate = async () => {
        try {
          await gameApi.calculateRound(game.id)
          setRoundCalculated(true)
        } catch (err) {
          console.error('Auto-calculate failed:', err)
          setError(err instanceof Error ? err.message : 'Failed to calculate round')
          setRoundCalculated(false)
        } finally {
          setIsCalculating(false)
        }
      }

      autoCalculate()
    }
  }, [game?.status, game?.id, allSubmitted, teamsDataIsFresh, isCalculating, roundCalculated])

  // Reset roundCalculated when round changes
  useEffect(() => {
    setRoundCalculated(false)
  }, [game?.currentRound])

  if (!authReady) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
          color: '#64748b',
          fontSize: '1rem',
        }}
      >
        Restoring session...
      </div>
    )
  }

  if (!game) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
        color: '#64748b',
        fontSize: '1rem'
      }}>
        Redirecting to login...
      </div>
    )
  }

  return (
    <div className="educator-page">
      <header className="edu-header">
        <div className="header-left">
          <h1>{game.name || game.gameCode}</h1>
          <span className="game-code">{game.gameCode}</span>
          {gamePin && <span className="game-pin">PIN: {gamePin}</span>}
        </div>
        <div className="header-center">
          <div className="deadline-pill">
            <span className="deadline-label">Round ends</span>
            <span className="deadline-time">{deadlineLabel}</span>
            <span className="deadline-countdown">{timeRemainingLabel}</span>
          </div>
        </div>
        <div className="header-right">
          <span className={`status-badge ${game.status.toLowerCase()}`}>
            {game.status}
          </span>
          {isAdmin && (
            <label className="dev-toggle">
              <input
                type="checkbox"
                checked={devMode}
                onChange={(e) => setDevMode(e.target.checked)}
              />
              Dev Mode
            </label>
          )}
          <button className="btn-logout" onClick={logout}>
            Exit
          </button>
        </div>
      </header>

      <nav className="edu-tabs">
        <button
          className={`tab ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button
          className={`tab ${activeTab === 'decisions' ? 'active' : ''}`}
          onClick={() => setActiveTab('decisions')}
        >
          All Decisions
        </button>
        {isAdmin && (
          <button
            className={`tab ${activeTab === 'results' ? 'active' : ''}`}
            onClick={() => setActiveTab('results')}
          >
            Results
          </button>
        )}
      </nav>

      <main className="edu-main">
        {error && <div className="error-message">{error}</div>}

        {/* Control panel - always visible */}
        <div className="control-panel">
          <div className="round-info">
            <span className="label">Current Round</span>
            <span className="value">
              {game.currentRound === 0 ? 'Trial' : game.currentRound} / {game.totalRounds}
            </span>
          </div>

          <div className="submission-status">
            <span className="label">Submissions</span>
            <span className="value">
              {submittedHumanCount} / {totalHumanTeams} human{totalHumanTeams !== 1 ? 's' : ''}
              {teams.length - totalHumanTeams > 0 && ` + ${teams.length - totalHumanTeams} AI`}
            </span>
          </div>

          <div className="actions">
            {game.status === 'SETUP' && (
              <button
                className="btn-primary"
                onClick={handleStartGame}
                disabled={loading}
              >
                {loading ? 'Starting...' : 'Start Game'}
              </button>
            )}
            {game.status === 'ACTIVE' && (
              <>
                {(!allSubmitted && !isExpired) ? (
                  <span className="waiting-status">
                    Waiting for {totalHumanTeams - submittedHumanCount} team{totalHumanTeams - submittedHumanCount !== 1 ? 's' : ''} to submit...
                  </span>
                ) : isCalculating ? (
                  <span className="calculating-status">
                    Calculating results...
                  </span>
                ) : (roundCalculated || isExpired || allSubmitted) ? (
                  <button
                    className="btn-primary"
                    onClick={handleAdvanceRound}
                    disabled={loading}
                    style={{
                      background: (allSubmitted && !isExpired) ? '#10b981' : undefined,
                      borderColor: (allSubmitted && !isExpired) ? '#059669' : undefined,
                    }}
                  >
                    {loading
                      ? 'Processing...'
                      : game.currentRound === game.totalRounds
                        ? 'End Game'
                        : isExpired ? 'Advance Round (Expired)' : 'Advance Round'}
                  </button>
                ) : (
                  <span className="waiting-status">
                    Waiting for submissions...
                  </span>
                )}
              </>
            )}
          </div>
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <>
            {/* Login Codes Section */}
            <div className="codes-section">
              <h2>Login Codes</h2>
              <p className="codes-hint">Share these codes with participants to join the game</p>

              <div className="game-code-box">
                <span className="code-label">Educator Login (Game Code + PIN)</span>
                <div className="code-display">
                  <span className="code-value">{game.gameCode}</span>
                  {gamePin && <span className="pin-value">PIN: {gamePin}</span>}
                  <button
                    className="copy-btn"
                    onClick={() => navigator.clipboard.writeText(game.gameCode)}
                    title="Copy game code"
                  >
                    Copy
                  </button>
                </div>
              </div>

              <div className="team-codes-box">
                <span className="code-label">Team Login Codes</span>
                <div className="team-codes-list">
                  {teams.map((team) => (
                    <div key={team.id} className="team-code-row" style={{ borderLeftColor: team.color }}>
                      <span className="team-name">{team.name}</span>
                      <span className="team-code-value">{team.teamCode}</span>
                      {team.teamPin && <span className="team-pin-value">PIN {team.teamPin}</span>}
                      <button
                        className="copy-btn small"
                        onClick={() => navigator.clipboard.writeText(team.teamCode)}
                        title={`Copy ${team.name} code`}
                      >
                        Copy
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="teams-section">
              <h2>Team Status</h2>
              <div className="teams-grid">
                {teams.map((team) => (
                  <div
                    key={team.id}
                    className={`team-card ${team.hasSubmitted ? 'submitted' : ''}`}
                    style={{ borderColor: team.color }}
                  >
                    <div className="team-header">
                      <span className="team-name">{team.name}</span>
                      {team.isComputer && <span className="ai-badge">AI</span>}
                    </div>
                    <div className="team-code">{team.teamCode}</div>
                    {team.teamPin && <div className="team-pin">PIN {team.teamPin}</div>}
                    <div className="team-status">
                      {team.isComputer ? (
                        <span className="status ai">Auto</span>
                      ) : team.hasSubmitted ? (
                        <span className="status submitted">&#10003; Submitted</span>
                      ) : (
                        <span className="status pending">Pending</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="info-section">
              <h2>Game Settings</h2>
              <div className="info-grid">
                <div className="info-item">
                  <span className="label">Company</span>
                  <span className="value">{game.companyName}</span>
                </div>
                <div className="info-item">
                  <span className="label">Industry</span>
                  <span className="value">{game.industry}</span>
                </div>
                <div className="info-item">
                  <span className="label">Total Rounds</span>
                  <span className="value">{game.totalRounds}</span>
                </div>
                <div className="info-item">
                  <span className="label">Deadline</span>
                  <span className="value">
                    {deadlineLabel}
                  </span>
                </div>
              </div>

              <h2 style={{ marginTop: '2rem' }}>Advanced Game Settings</h2>
              <div className="info-grid">
                <div className="info-item">
                  <span className="label">Calculated Capacity</span>
                  <span className="value">{((game.capacityPerFactory || gameConfig.capacityPerPlant) * (teams.length)).toLocaleString()} units</span>
                </div>
                <div className="info-item">
                  <span className="label">Capacity Per Plant</span>
                  <span className="value">{(game.capacityPerFactory || gameConfig.capacityPerPlant).toLocaleString()} units</span>
                </div>
                <div className="info-item">
                  <span className="label">Region Demand Split</span>
                  <span className="value">
                    US: {((game.regionDemandSplit?.us ?? 0.22) * 100).toFixed(0)}% |
                    Asia: {((game.regionDemandSplit?.asia ?? 0.60) * 100).toFixed(0)}% |
                    Europe: {((game.regionDemandSplit?.europe ?? 0.18) * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="info-item">
                  <span className="label">Market Config</span>
                  <span className="value">
                    {game.marketDemandMode === 'blue_ocean' ? 'Blue Ocean' :
                      game.marketDemandMode === 'high_competition' ? 'High Competition' : 'Balanced'}
                    ({game.marketDemandMultiplier?.toFixed(1) || '1.0'}x)
                  </span>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Decisions Tab - Debug View */}
        {activeTab === 'decisions' && (
          <div className="decisions-debug">
            <div className="debug-header">
              <h2>All Team Decisions - Round {decisionsRoundLabel}</h2>
              <p className="info-note">
                AI teams always visible. Player teams: {devMode ? 'All visible (Dev Mode)' : 'Visible after submission'}
              </p>
            </div>

            {/* All Decisions - Complete audit view with demand factors highlighted */}
            <div className="demand-factors-section">
              <h3>All Decisions <span className="demand-legend">(green = affects demand)</span></h3>
              <div className="results-round-selector">
                {decisionRoundNumbers.map((roundNumber) => (
                  <button
                    key={`decision-round-${roundNumber}`}
                    className={`round-pill ${selectedDecisionRound === roundNumber ? 'active' : ''}`}
                    onClick={() => setSelectedDecisionRound(roundNumber)}
                  >
                    {roundNumber === 0 ? 'Trial Round' : `Round ${roundNumber}`}
                    {roundNumber === game?.currentRound ? ' (Current)' : ''}
                  </button>
                ))}
              </div>
              <div className="decisions-table-wrapper">
                <table className="decisions-table">
                  <thead>
                    <tr>
                      <th className="category-header">Decision</th>
                      {teams.map((team) => (
                        <th
                          key={team.id}
                          className="team-header-cell"
                          style={{ borderTopColor: team.color }}
                        >
                          {team.name}
                          {getDecisionForTeam(team)?.isSubmitted && <span className="check">&#10003;</span>}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {/* Pricing - AFFECTS DEMAND */}
                    <tr className="section-row demand-section">
                      <td colSpan={teams.length + 1}>Pricing (lower price = higher demand)</td>
                    </tr>
                    <tr className="demand-row">
                      <td className="label-cell">Price {regionLabels.us}</td>
                      {teams.map((team) => {
                        const decision = getDecisionForTeam(team)
                        const canView = devMode || team.isComputer || decision?.isSubmitted
                        return (
                          <td key={team.id} className={`value-cell ${canView ? '' : 'hidden'}`}>
                            {canView && decision
                              ? `$${decision?.marketing?.priceUS ?? '-'}`
                              : '-'}
                          </td>
                        )
                      })}
                    </tr>
                    <tr className="demand-row">
                      <td className="label-cell">Price {regionLabels.asia}</td>
                      {teams.map((team) => {
                        const decision = getDecisionForTeam(team)
                        const canView = devMode || team.isComputer || decision?.isSubmitted
                        return (
                          <td key={team.id} className={`value-cell ${canView ? '' : 'hidden'}`}>
                            {canView && decision
                              ? `$${decision?.marketing?.priceAsia ?? '-'}`
                              : '-'}
                          </td>
                        )
                      })}
                    </tr>
                    <tr className="demand-row">
                      <td className="label-cell">Price {regionLabels.europe}</td>
                      {teams.map((team) => {
                        const decision = getDecisionForTeam(team)
                        const canView = devMode || team.isComputer || decision?.isSubmitted
                        return (
                          <td key={team.id} className={`value-cell ${canView ? '' : 'hidden'}`}>
                            {canView && decision
                              ? `$${decision?.marketing?.priceEurope ?? '-'}`
                              : '-'}
                          </td>
                        )
                      })}
                    </tr>

                    {/* Marketing - AFFECTS DEMAND */}
                    <tr className="section-row demand-section">
                      <td colSpan={teams.length + 1}>Marketing (higher budget = higher demand)</td>
                    </tr>
                    <tr className="demand-row">
                      <td className="label-cell">Promo % {regionLabels.us}</td>
                      {teams.map((team) => {
                        const decision = getDecisionForTeam(team)
                        const canView = devMode || team.isComputer || decision?.isSubmitted
                        return (
                          <td key={team.id} className={`value-cell ${canView ? '' : 'hidden'}`}>
                            {canView && decision
                              ? `${decision?.marketing?.promoUS ?? '-'}`
                              : '-'}
                          </td>
                        )
                      })}
                    </tr>
                    <tr className="demand-row">
                      <td className="label-cell">Promo % {regionLabels.asia}</td>
                      {teams.map((team) => {
                        const decision = getDecisionForTeam(team)
                        const canView = devMode || team.isComputer || decision?.isSubmitted
                        return (
                          <td key={team.id} className={`value-cell ${canView ? '' : 'hidden'}`}>
                            {canView && decision
                              ? `${decision?.marketing?.promoAsia ?? '-'}`
                              : '-'}
                          </td>
                        )
                      })}
                    </tr>
                    <tr className="demand-row">
                      <td className="label-cell">Promo % {regionLabels.europe}</td>
                      {teams.map((team) => {
                        const decision = getDecisionForTeam(team)
                        const canView = devMode || team.isComputer || decision?.isSubmitted
                        return (
                          <td key={team.id} className={`value-cell ${canView ? '' : 'hidden'}`}>
                            {canView && decision
                              ? `${decision?.marketing?.promoEurope ?? '-'}`
                              : '-'}
                          </td>
                        )
                      })}
                    </tr>
                    {/* Production - Supplier affects CSR/demand */}
                    <tr className="section-row">
                      <td colSpan={teams.length + 1}>Production (supplier CSR to demand)</td>
                    </tr>
                    <tr>
                      <td className="label-cell">Production US</td>
                      {teams.map((team) => {
                        const decision = getDecisionForTeam(team)
                        const canView = devMode || team.isComputer || decision?.isSubmitted
                        return (
                          <td key={team.id} className={`value-cell ${canView ? '' : 'hidden'}`}>
                            {canView && decision
                              ? decision?.production?.usUnits?.toLocaleString() ?? '-'
                              : '-'}
                          </td>
                        )
                      })}
                    </tr>
                    <tr>
                      <td className="label-cell">Production Asia</td>
                      {teams.map((team) => {
                        const decision = getDecisionForTeam(team)
                        const canView = devMode || team.isComputer || decision?.isSubmitted
                        return (
                          <td key={team.id} className={`value-cell ${canView ? '' : 'hidden'}`}>
                            {canView && decision
                              ? decision?.production?.asiaUnits?.toLocaleString() ?? '-'
                              : '-'}
                          </td>
                        )
                      })}
                    </tr>
                    <tr>
                      <td className="label-cell">Overtime %</td>
                      {teams.map((team) => {
                        const decision = getDecisionForTeam(team)
                        const canView = devMode || team.isComputer || decision?.isSubmitted
                        return (
                          <td key={team.id} className={`value-cell ${canView ? '' : 'hidden'}`}>
                            {canView && decision
                              ? `${decision?.production?.overtime ?? 0}%`
                              : '-'}
                          </td>
                        )
                      })}
                    </tr>
                    <tr className="demand-row">
                      <td className="label-cell">Supplier US (CSR)</td>
                      {teams.map((team) => {
                        const decision = getDecisionForTeam(team)
                        const canView = devMode || team.isComputer || decision?.isSubmitted
                        return (
                          <td key={team.id} className={`value-cell ${canView ? '' : 'hidden'}`}>
                            {canView && decision
                              ? getSupplierName(decision?.production?.supplierUS ?? 0)
                              : '-'}
                          </td>
                        )
                      })}
                    </tr>
                    <tr className="demand-row">
                      <td className="label-cell">Supplier Asia (CSR)</td>
                      {teams.map((team) => {
                        const decision = getDecisionForTeam(team)
                        const canView = devMode || team.isComputer || decision?.isSubmitted
                        return (
                          <td key={team.id} className={`value-cell ${canView ? '' : 'hidden'}`}>
                            {canView && decision
                              ? getSupplierName(decision?.production?.supplierAsia ?? 0)
                              : '-'}
                          </td>
                        )
                      })}
                    </tr>
                    <tr>
                      <td className="label-cell">Outsource US</td>
                      {teams.map((team) => {
                        const decision = getDecisionForTeam(team)
                        const canView = devMode || team.isComputer || decision?.isSubmitted
                        return (
                          <td key={team.id} className={`value-cell ${canView ? '' : 'hidden'}`}>
                            {canView && decision
                              ? decision?.production?.outsourceUS ?? 0
                              : '-'}
                          </td>
                        )
                      })}
                    </tr>
                    <tr>
                      <td className="label-cell">Outsource Asia</td>
                      {teams.map((team) => {
                        const decision = getDecisionForTeam(team)
                        const canView = devMode || team.isComputer || decision?.isSubmitted
                        return (
                          <td key={team.id} className={`value-cell ${canView ? '' : 'hidden'}`}>
                            {canView && decision
                              ? decision?.production?.outsourceAsia ?? 0
                              : '-'}
                          </td>
                        )
                      })}
                    </tr>

                    {/* HR */}
                    <tr className="section-row">
                      <td colSpan={teams.length + 1}>Human Resources</td>
                    </tr>
                    <tr>
                      <td className="label-cell">Training</td>
                      {teams.map((team) => {
                        const decision = getDecisionForTeam(team)
                        const canView = devMode || team.isComputer || decision?.isSubmitted
                        return (
                          <td key={team.id} className={`value-cell ${canView ? '' : 'hidden'}`}>
                            {canView && decision
                              ? decision?.rnd?.trainingLevel ?? decision?.hr?.trainingLevel ?? '-'
                              : '-'}
                          </td>
                        )
                      })}
                    </tr>
                    <tr>
                      <td className="label-cell">Research Staff</td>
                      {teams.map((team) => {
                        const decision = getDecisionForTeam(team)
                        const canView = devMode || team.isComputer || decision?.isSubmitted
                        return (
                          <td key={team.id} className={`value-cell ${canView ? '' : 'hidden'}`}>
                            {canView && decision
                              ? decision?.rnd?.researchStaff ?? decision?.hr?.researchStaff ?? '-'
                              : '-'}
                          </td>
                        )
                      })}
                    </tr>

                    {/* R&D - Features affect demand */}
                    <tr className="section-row demand-section">
                      <td colSpan={teams.length + 1}>R&D (more features = higher demand)</td>
                    </tr>
                    <tr className="demand-row">
                      <td className="label-cell">Features Unlocked</td>
                      {teams.map((team) => {
                        const decision = getDecisionForTeam(team)
                        const canView = devMode || team.isComputer || decision?.isSubmitted
                        return (
                          <td key={team.id} className={`value-cell ${canView ? '' : 'hidden'}`}>
                            {getFeaturesForTeam(team, canView)}
                          </td>
                        )
                      })}
                    </tr>
                    <tr className="section-row">
                      <td colSpan={teams.length + 1}>Investment</td>
                    </tr>
                    <tr>
                      <td className="label-cell">New Plants (US)</td>
                      {teams.map((team) => {
                        const decision = getDecisionForTeam(team)
                        const canView = devMode || team.isComputer || decision?.isSubmitted
                        return (
                          <td key={team.id} className={`value-cell ${canView ? '' : 'hidden'}`}>
                            {canView && decision
                              ? decision?.investment?.newPlantsUS ?? decision?.finance?.newPlantsUS ?? 0
                              : '-'}
                          </td>
                        )
                      })}
                    </tr>
                    <tr>
                      <td className="label-cell">New Plants (Asia)</td>
                      {teams.map((team) => {
                        const decision = getDecisionForTeam(team)
                        const canView = devMode || team.isComputer || decision?.isSubmitted
                        return (
                          <td key={team.id} className={`value-cell ${canView ? '' : 'hidden'}`}>
                            {canView && decision
                              ? decision?.investment?.newPlantsAsia ?? decision?.finance?.newPlantsAsia ?? 0
                              : '-'}
                          </td>
                        )
                      })}
                    </tr>

                    <tr className="section-row">
                      <td colSpan={teams.length + 1}>Logistics Priority</td>
                    </tr>
                    <tr>
                      <td className="label-cell">US Local</td>
                      {teams.map((team) => {
                        const decision = getDecisionForTeam(team)
                        const canView = devMode || team.isComputer || decision?.isSubmitted
                        return (
                          <td key={team.id} className={`value-cell ${canView ? '' : 'hidden'}`}>
                            {canView && decision
                              ? decision?.logistics?.allocation?.us?.local ?? '-'
                              : '-'}
                          </td>
                        )
                      })}
                    </tr>
                    <tr>
                      <td className="label-cell">US From Asia</td>
                      {teams.map((team) => {
                        const decision = getDecisionForTeam(team)
                        const canView = devMode || team.isComputer || decision?.isSubmitted
                        return (
                          <td key={team.id} className={`value-cell ${canView ? '' : 'hidden'}`}>
                            {canView && decision
                              ? decision?.logistics?.allocation?.us?.fromAsia ?? '-'
                              : '-'}
                          </td>
                        )
                      })}
                    </tr>
                    <tr>
                      <td className="label-cell">Asia Local</td>
                      {teams.map((team) => {
                        const decision = getDecisionForTeam(team)
                        const canView = devMode || team.isComputer || decision?.isSubmitted
                        return (
                          <td key={team.id} className={`value-cell ${canView ? '' : 'hidden'}`}>
                            {canView && decision
                              ? decision?.logistics?.allocation?.asia?.local ?? '-'
                              : '-'}
                          </td>
                        )
                      })}
                    </tr>
                    <tr>
                      <td className="label-cell">Asia From US</td>
                      {teams.map((team) => {
                        const decision = getDecisionForTeam(team)
                        const canView = devMode || team.isComputer || decision?.isSubmitted
                        return (
                          <td key={team.id} className={`value-cell ${canView ? '' : 'hidden'}`}>
                            {canView && decision
                              ? decision?.logistics?.allocation?.asia?.fromUS ?? '-'
                              : '-'}
                          </td>
                        )
                      })}
                    </tr>
                    <tr>
                      <td className="label-cell">Europe From US</td>
                      {teams.map((team) => {
                        const decision = getDecisionForTeam(team)
                        const canView = devMode || team.isComputer || decision?.isSubmitted
                        return (
                          <td key={team.id} className={`value-cell ${canView ? '' : 'hidden'}`}>
                            {canView && decision
                              ? decision?.logistics?.allocation?.europe?.fromUS ?? '-'
                              : '-'}
                          </td>
                        )
                      })}
                    </tr>
                    <tr>
                      <td className="label-cell">Europe From Asia</td>
                      {teams.map((team) => {
                        const decision = getDecisionForTeam(team)
                        const canView = devMode || team.isComputer || decision?.isSubmitted
                        return (
                          <td key={team.id} className={`value-cell ${canView ? '' : 'hidden'}`}>
                            {canView && decision
                              ? decision?.logistics?.allocation?.europe?.fromAsia ?? '-'
                              : '-'}
                          </td>
                        )
                      })}
                    </tr>

                    {/* Finance */}
                    <tr className="section-row">
                      <td colSpan={teams.length + 1}>Finance</td>
                    </tr>
                    <tr>
                      <td className="label-cell">Borrowing</td>
                      {teams.map((team) => {
                        const decision = getDecisionForTeam(team)
                        const canView = devMode || team.isComputer || decision?.isSubmitted
                        return (
                          <td key={team.id} className={`value-cell ${canView ? '' : 'hidden'}`}>
                            {canView && decision
                              ? formatCurrency(decision?.finance?.borrowing ?? 0)
                              : '-'}
                          </td>
                        )
                      })}
                    </tr>
                    <tr>
                      <td className="label-cell">Repayment</td>
                      {teams.map((team) => {
                        const decision = getDecisionForTeam(team)
                        const canView = devMode || team.isComputer || decision?.isSubmitted
                        return (
                          <td key={team.id} className={`value-cell ${canView ? '' : 'hidden'}`}>
                            {canView && decision
                              ? formatCurrency(decision?.finance?.repayment ?? 0)
                              : '-'}
                          </td>
                        )
                      })}
                    </tr>
                    <tr>
                      <td className="label-cell">Share Issue</td>
                      {teams.map((team) => {
                        const decision = getDecisionForTeam(team)
                        const canView = devMode || team.isComputer || decision?.isSubmitted
                        return (
                          <td key={team.id} className={`value-cell ${canView ? '' : 'hidden'}`}>
                            {canView && decision
                              ? formatCurrency(decision?.finance?.shareIssue ?? 0)
                              : '-'}
                          </td>
                        )
                      })}
                    </tr>
                    <tr>
                      <td className="label-cell">Share Buyback</td>
                      {teams.map((team) => {
                        const decision = getDecisionForTeam(team)
                        const canView = devMode || team.isComputer || decision?.isSubmitted
                        return (
                          <td key={team.id} className={`value-cell ${canView ? '' : 'hidden'}`}>
                            {canView && decision
                              ? formatCurrency(decision?.finance?.shareBuyback ?? 0)
                              : '-'}
                          </td>
                        )
                      })}
                    </tr>
                    <tr>
                      <td className="label-cell">Dividend</td>
                      {teams.map((team) => {
                        const decision = getDecisionForTeam(team)
                        const canView = devMode || team.isComputer || decision?.isSubmitted
                        return (
                          <td key={team.id} className={`value-cell ${canView ? '' : 'hidden'}`}>
                            {canView && decision
                              ? formatCurrency(decision?.finance?.dividend ?? 0)
                              : '-'}
                          </td>
                        )
                      })}
                    </tr>

                    {/* Current State (for reference) - Always visible to educators */}
                    <tr className="section-row">
                      <td colSpan={teams.length + 1}>Current State (Opening Position)</td>
                    </tr>
                    <tr>
                      <td className="label-cell">Factories US</td>
                      {teams.map((team) => (
                        <td key={team.id} className="value-cell">
                          {team.engineState?.factories?.us ?? team.state?.factoriesUS ?? 2}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="label-cell">Factories Asia</td>
                      {teams.map((team) => (
                        <td key={team.id} className="value-cell">
                          {team.engineState?.factories?.asia ?? team.state?.factoriesAsia ?? 0}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="label-cell">Features Unlocked</td>
                      {teams.map((team) => (
                        <td key={team.id} className="value-cell">
                          {team.engineState?.rndProgress?.unlockedFeatureCount ?? team.state?.unlockedFeatures ?? 0}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="label-cell">Cash Balance</td>
                      {teams.map((team) => (
                        <td key={team.id} className="value-cell">
                          {formatCurrency(team.state?.cashBalance ?? 30000000)}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="label-cell">Long-term Debt</td>
                      {teams.map((team) => (
                        <td key={team.id} className="value-cell">
                          {formatCurrency(team.state?.longTermDebt ?? 30000000)}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Results Tab */}
        {activeTab === 'results' && (
          <div className="results-section">
            <div className="results-header">
              <h2>Results - Round {resultsRoundLabel}</h2>
              <p className="results-note">
                {selectedResultsRound === 'live'
                  ? 'Results update in real-time as teams change their decisions.'
                  : 'Completed round results (frozen at round close).'}
                {selectedResultsRound === 'live' && game.currentRound === 0 && " (Trial round - results don't count)"}
              </p>
            </div>

            <div className="results-round-selector">
              <button
                className={`round-pill ${selectedResultsRound === 'live' ? 'active' : ''}`}
                onClick={() => setSelectedResultsRound('live')}
              >
                Live (Current)
              </button>
              {selectableCompletedRounds.map((roundNumber) => (
                <button
                  key={`round-${roundNumber}`}
                  className={`round-pill ${selectedResultsRound === roundNumber ? 'active' : ''}`}
                  onClick={() => setSelectedResultsRound(roundNumber)}
                >
                  {roundNumber === 0 ? 'Trial Round' : `Round ${roundNumber}`}
                </button>
              ))}
            </div>

            {selectedResultsRound !== 'live' && !completedResultsMap && (
              <div className="results-empty">No results saved for that round yet.</div>
            )}

            {selectedResultsRound === 'live' ? (
              <>
                {/* Decision Inputs - Key factors affecting demand */}
                <div className="decisions-inputs-section">
                  <h3>Decision Inputs (Submitted)</h3>
                  <div className="inputs-table-wrapper">
                    <table className="inputs-table">
                      <thead>
                        <tr>
                          <th>Team</th>
                          <th>Price {regionLabels.us}</th>
                          <th>Price {regionLabels.asia}</th>
                          <th>Price EU</th>
                          <th>Promo US</th>
                          <th>Promo Asia</th>
                          <th>Promo EU</th>
                          <th>Units US</th>
                          <th>Units Asia</th>
                          <th>Overtime</th>
                          <th>Supplier US</th>
                          <th>Supplier Asia</th>
                          <th>Outsource US</th>
                          <th>Outsource Asia</th>
                          <th>Training</th>
                          <th>Research Staff</th>
                          <th>New Plants</th>
                          <th>Logistics (US/Asia/EU)</th>
                          <th>Features Unlocked</th>
                        </tr>
                      </thead>
                      <tbody>
                        {teams.map(team => (
                          <tr key={team.id} style={{ borderLeftColor: team.color }}>
                            <td className="team-cell">
                              {team.name}
                              {team.isComputer && <span className="ai-tag">AI</span>}
                            </td>
                            <td>${team.rawDecision?.marketing?.priceUS ?? '-'}</td>
                            <td>${team.rawDecision?.marketing?.priceAsia ?? '-'}</td>
                            <td>${team.rawDecision?.marketing?.priceEurope ?? '-'}</td>
                            <td>{team.rawDecision?.marketing?.promoUS ?? '-'}</td>
                            <td>{team.rawDecision?.marketing?.promoAsia ?? '-'}</td>
                            <td>{team.rawDecision?.marketing?.promoEurope ?? '-'}</td>
                            <td>{team.rawDecision?.production?.usUnits?.toLocaleString() ?? '-'}</td>
                            <td>{team.rawDecision?.production?.asiaUnits?.toLocaleString() ?? '-'}</td>
                            <td>{team.rawDecision?.production?.overtime ?? 0}%</td>
                            <td>{getSupplierName(team.rawDecision?.production?.supplierUS ?? 0)}</td>
                            <td>{getSupplierName(team.rawDecision?.production?.supplierAsia ?? 0)}</td>
                            <td>{team.rawDecision?.production?.outsourceUS ?? 0}</td>
                            <td>{team.rawDecision?.production?.outsourceAsia ?? 0}</td>
                            <td>{team.rawDecision?.hr?.trainingLevel ?? '-'}</td>
                            <td>{team.rawDecision?.hr?.researchStaff ?? '-'}</td>
                            <td>
                              US {team.rawDecision?.investment?.newPlantsUS ?? team.rawDecision?.finance?.newPlantsUS ?? 0}
                              {' / Asia '}
                              {team.rawDecision?.investment?.newPlantsAsia ?? team.rawDecision?.finance?.newPlantsAsia ?? 0}
                            </td>
                            <td>
                              US {team.rawDecision?.logistics?.allocation?.us?.local ?? '-'}%
                              {' / Asia '}
                              {team.rawDecision?.logistics?.allocation?.asia?.local ?? '-'}%
                              {' / EU '}
                              {team.rawDecision?.logistics?.allocation?.europe?.fromUS ?? '-'}%
                            </td>
                            <td>{getFeaturesForTeam(team, true)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="decisions-inputs-section">
                  <h3>All Decisions (Raw Submission)</h3>
                  <div className="inputs-table-wrapper">
                    <table className="inputs-table">
                      <thead>
                        <tr>
                          <th>Team</th>
                          <th>Production</th>
                          <th>HR</th>
                          <th>R&D</th>
                          <th>Investment</th>
                          <th>Logistics</th>
                          <th>Marketing</th>
                          <th>Finance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {teams.map((team) => (
                          <tr key={`${team.id}-raw`} style={{ borderLeftColor: team.color }}>
                            <td className="team-cell">
                              {team.name}
                              {team.isComputer && <span className="ai-tag">AI</span>}
                            </td>
                            <td>
                              <div>US Units: {team.rawDecision?.production?.usUnits ?? '-'}</div>
                              <div>Asia Units: {team.rawDecision?.production?.asiaUnits ?? '-'}</div>
                              <div>Overtime: {team.rawDecision?.production?.overtime ?? 0}%</div>
                              <div>Supplier US: {getSupplierName(team.rawDecision?.production?.supplierUS ?? 0)}</div>
                              <div>Supplier Asia: {getSupplierName(team.rawDecision?.production?.supplierAsia ?? 0)}</div>
                              <div>Outsource US: {team.rawDecision?.production?.outsourceUS ?? 0}</div>
                              <div>Outsource Asia: {team.rawDecision?.production?.outsourceAsia ?? 0}</div>
                            </td>
                            <td>
                              <div>Training: {team.rawDecision?.hr?.trainingLevel ?? '-'}</div>
                              <div>Research Staff: {team.rawDecision?.hr?.researchStaff ?? '-'}</div>
                            </td>
                            <td>
                              <div>Feature Unlocks: {getFeaturesForTeam(team, true)}</div>
                            </td>
                            <td>
                              <div>New Plants US: {team.rawDecision?.investment?.newPlantsUS ?? team.rawDecision?.finance?.newPlantsUS ?? 0}</div>
                              <div>New Plants Asia: {team.rawDecision?.investment?.newPlantsAsia ?? team.rawDecision?.finance?.newPlantsAsia ?? 0}</div>
                            </td>
                            <td>
                              <div>Allocation: {team.rawDecision?.logistics?.allocation ? 'Custom' : 'Default'}</div>
                              <div>US Local: {team.rawDecision?.logistics?.allocation?.us?.local ?? '-'}</div>
                              <div>US From Asia: {team.rawDecision?.logistics?.allocation?.us?.fromAsia ?? '-'}</div>
                              <div>Asia Local: {team.rawDecision?.logistics?.allocation?.asia?.local ?? '-'}</div>
                              <div>Asia From US: {team.rawDecision?.logistics?.allocation?.asia?.fromUS ?? '-'}</div>
                              <div>EU From US: {team.rawDecision?.logistics?.allocation?.europe?.fromUS ?? '-'}</div>
                              <div>EU From Asia: {team.rawDecision?.logistics?.allocation?.europe?.fromAsia ?? '-'}</div>
                            </td>
                            <td>
                              <div>Price {regionLabels.us}: {team.rawDecision?.marketing?.priceUS ?? '-'}</div>
                              <div>Price {regionLabels.asia}: {team.rawDecision?.marketing?.priceAsia ?? '-'}</div>
                              <div>Price EU: {team.rawDecision?.marketing?.priceEurope ?? '-'}</div>
                              <div>Promo US: {team.rawDecision?.marketing?.promoUS ?? '-'}</div>
                              <div>Promo Asia: {team.rawDecision?.marketing?.promoAsia ?? '-'}</div>
                              <div>Promo EU: {team.rawDecision?.marketing?.promoEurope ?? '-'}</div>
                            </td>
                            <td>
                              <div>Borrowing: {team.rawDecision?.finance?.borrowing ?? 0}</div>
                              <div>Repayment: {team.rawDecision?.finance?.repayment ?? 0}</div>
                              <div>Share Issue: {team.rawDecision?.finance?.shareIssue ?? 0}</div>
                              <div>Share Buyback: {team.rawDecision?.finance?.shareBuyback ?? 0}</div>
                              <div>Dividend: {team.rawDecision?.finance?.dividend ?? 0}</div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            ) : (
              <div className="results-empty">Decision inputs are shown for the current round only.</div>
            )}

            {/* Rankings Table */}
            <div className="rankings-section">
              <h3>Team Rankings</h3>
              <div className="rankings-table-wrapper">
                <table className="rankings-table">
                  <thead>
                    <tr>
                      <th>Rank</th>
                      <th>Team</th>
                      <th>Units Sold</th>
                      <th>Mkt Share US</th>
                      <th>Mkt Share Asia</th>
                      <th>Mkt Share EU</th>
                      <th>Revenue</th>
                      <th>Net Profit</th>
                      <th>Share Price</th>
                      <th>TSR</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teams
                      .map(team => ({ team, results: resultsForView.get(team.id) }))
                      .sort((a, b) => (a.results?.rank ?? 99) - (b.results?.rank ?? 99))
                      .map(({ team, results }) => {
                        const sharePrice = results?.sharePrice

                        return (
                          <tr key={team.id} style={{ borderLeftColor: team.color }}>
                            <td className="rank-cell">#{results?.rank ?? '-'}</td>
                            <td className="team-cell">
                              {team.name}
                              {team.isComputer && <span className="ai-tag">AI</span>}
                            </td>
                            <td className="value-cell">{results?.totalUnitsSold?.toLocaleString() ?? '-'}</td>
                            <td className="value-cell">{results ? formatPercent(results.marketShareUS) : '-'}</td>
                            <td className="value-cell">{results ? formatPercent(results.marketShareAsia) : '-'}</td>
                            <td className="value-cell">{results ? formatPercent(results.marketShareEurope) : '-'}</td>
                            <td className="value-cell">{results ? formatCurrency(results.totalRevenue) : '-'}</td>
                            <td className={`value-cell ${(results?.netProfit ?? 0) >= 0 ? 'positive' : 'negative'}`}>
                              {results ? formatCurrency(results.netProfit) : '-'}
                            </td>
                            <td className="value-cell">
                              {Number.isFinite(sharePrice) ? `$${sharePrice.toFixed(2)}` : '-'}
                            </td>
                            <td className={`value-cell ${(results?.tsr ?? 0) >= 0 ? 'positive' : 'negative'}`}>
                              {results ? formatPercent(results.tsr) : '-'}
                            </td>
                            <td className="status-cell">
                              {selectedResultsRound === 'live' ? (
                                team.isComputer ? (
                                  <span className="status-badge auto">Auto</span>
                                ) : team.hasSubmitted ? (
                                  <span className="status-badge submitted">Submitted</span>
                                ) : (
                                  <span className="status-badge pending">In Progress</span>
                                )
                              ) : (
                                <span className="status-badge completed">Completed</span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="financial-results">
              <FinancialReport
                title="AIgopoly Consolidated Financials"
                subtitle={game?.currentRound === 0 ? 'Trial Round' : `Round ${resultsRoundLabel}`}
                asOf={new Date().toLocaleDateString()}
                teams={financialTeamsForResults}
                previousTeams={previousTeamsForResults}
                exportRounds={exportRounds}
                startingBalanceSheet={startingBalanceSheet}
                currentRound={selectedResultsRound === 'live' ? (game?.currentRound ?? 0) : selectedResultsRound}
              />
            </div>

            {showLegacyDetailedResults && (
              <>
                {/* Detailed Results per Team */}
                <div className="detailed-results">
                  <h3>Detailed P&L</h3>
                  <div className="results-table-wrapper">
                    <table className="results-table">
                      <thead>
                        <tr>
                          <th className="metric-header">Metric</th>
                          {rankedTeamsForResults.map(team => (
                            <th key={team.id} className="team-col" style={{ borderTopColor: team.color }}>
                              {team.name}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="section-row">
                          <td colSpan={rankedTeamsForResults.length + 1}>Sales</td>
                        </tr>
                        <tr>
                          <td>Units Sold ({regionLabels.us})</td>
                          {rankedTeamsForResults.map(team => (
                            <td key={team.id}>{resultsForView.get(team.id)?.salesUnitsUS.toLocaleString() ?? '-'}</td>
                          ))}
                        </tr>
                        <tr>
                          <td>Units Sold ({regionLabels.asia})</td>
                          {rankedTeamsForResults.map(team => (
                            <td key={team.id}>{resultsForView.get(team.id)?.salesUnitsAsia.toLocaleString() ?? '-'}</td>
                          ))}
                        </tr>
                        <tr>
                          <td>Units Sold ({regionLabels.europe})</td>
                          {rankedTeamsForResults.map(team => (
                            <td key={team.id}>{resultsForView.get(team.id)?.salesUnitsEurope.toLocaleString() ?? '-'}</td>
                          ))}
                        </tr>
                        <tr className="highlight-row">
                          <td
                            className="expandable-cell"
                            onClick={() => togglePnlRow('revenue')}
                          >
                            Total Revenue
                            <span className="expand-indicator">{expandedPnlRow === 'revenue' ? '-' : '+'}</span>
                          </td>
                          {rankedTeamsForResults.map(team => (
                            <td key={team.id}>{resultsForView.get(team.id) ? formatCurrency(resultsForView.get(team.id)!.totalRevenue) : '-'}</td>
                          ))}
                        </tr>
                        {expandedPnlRow === 'revenue' && (
                          <tr className="breakdown-row">
                            <td colSpan={rankedTeamsForResults.length + 1}>
                              <div className="breakdown-table">
                                <table>
                                  <tbody>
                                    {renderBreakdownRow('US revenue', (r) => r?.revenueUS)}
                                    {renderBreakdownRow('Asia revenue', (r) => r?.revenueAsia)}
                                    {renderBreakdownRow('Europe revenue', (r) => r?.revenueEurope)}
                                    {renderBreakdownRow('Total revenue = US + Asia + Europe', (r) => r?.totalRevenue)}
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        )}

                        <tr className="section-row">
                          <td colSpan={rankedTeamsForResults.length + 1}>Costs</td>
                        </tr>
                        <tr>
                          <td>Production Cost</td>
                          {rankedTeamsForResults.map(team => (
                            <td key={team.id}>{resultsForView.get(team.id) ? formatCurrency(resultsForView.get(team.id)!.productionCost) : '-'}</td>
                          ))}
                        </tr>
                        <tr>
                          <td>Labor Cost</td>
                          {rankedTeamsForResults.map(team => (
                            <td key={team.id}>{resultsForView.get(team.id) ? formatCurrency(resultsForView.get(team.id)!.laborCost) : '-'}</td>
                          ))}
                        </tr>
                        <tr>
                          <td>Materials</td>
                          {rankedTeamsForResults.map(team => (
                            <td key={team.id}>{resultsForView.get(team.id) ? formatCurrency(resultsForView.get(team.id)!.materialsCost) : '-'}</td>
                          ))}
                        </tr>
                        <tr>
                          <td>Logistics</td>
                          {rankedTeamsForResults.map(team => (
                            <td key={team.id}>{resultsForView.get(team.id) ? formatCurrency(resultsForView.get(team.id)!.logisticsCost) : '-'}</td>
                          ))}
                        </tr>
                        <tr>
                          <td>Outsourcing</td>
                          {rankedTeamsForResults.map(team => (
                            <td key={team.id}>{resultsForView.get(team.id) ? formatCurrency(resultsForView.get(team.id)!.outsourcingCost) : '-'}</td>
                          ))}
                        </tr>
                        <tr>
                          <td>Marketing Cost</td>
                          {rankedTeamsForResults.map(team => (
                            <td key={team.id}>{resultsForView.get(team.id) ? formatCurrency(resultsForView.get(team.id)!.marketingCost) : '-'}</td>
                          ))}
                        </tr>
                        <tr>
                          <td>R&D Cost</td>
                          {rankedTeamsForResults.map(team => (
                            <td key={team.id}>{resultsForView.get(team.id) ? formatCurrency(resultsForView.get(team.id)!.rdCost) : '-'}</td>
                          ))}
                        </tr>
                        <tr>
                          <td>Admin Cost</td>
                          {rankedTeamsForResults.map(team => (
                            <td key={team.id}>{resultsForView.get(team.id) ? formatCurrency(resultsForView.get(team.id)!.adminCost) : '-'}</td>
                          ))}
                        </tr>
                        <tr>
                          <td>Depreciation</td>
                          {rankedTeamsForResults.map(team => (
                            <td key={team.id}>{resultsForView.get(team.id) ? formatCurrency(resultsForView.get(team.id)!.depreciation) : '-'}</td>
                          ))}
                        </tr>
                        <tr>
                          <td>Interest Cost</td>
                          {rankedTeamsForResults.map(team => (
                            <td key={team.id}>{resultsForView.get(team.id) ? formatCurrency(resultsForView.get(team.id)!.interestCost) : '-'}</td>
                          ))}
                        </tr>

                        <tr className="section-row">
                          <td colSpan={rankedTeamsForResults.length + 1}>P&L Summary</td>
                        </tr>
                        <tr>
                          <td
                            className="expandable-cell"
                            onClick={() => togglePnlRow('cogs')}
                          >
                            COGS
                            <span className="expand-indicator">{expandedPnlRow === 'cogs' ? '-' : '+'}</span>
                          </td>
                          {rankedTeamsForResults.map(team => (
                            <td key={team.id}>{resultsForView.get(team.id) ? formatCurrency(resultsForView.get(team.id)!.cogs) : '-'}</td>
                          ))}
                        </tr>
                        {expandedPnlRow === 'cogs' && (
                          <tr className="breakdown-row">
                            <td colSpan={rankedTeamsForResults.length + 1}>
                              <div className="breakdown-table">
                                <table>
                                  <tbody>
                                    {renderBreakdownRow('Materials', (r) => r?.materialsCost)}
                                    {renderBreakdownRow('Labor (incl. training)', (r) => r?.laborCost)}
                                    {renderBreakdownRow('Logistics', (r) => r?.logisticsCost)}
                                    {renderBreakdownRow('Outsourcing', (r) => r?.outsourcingCost)}
                                    {renderBreakdownRow('COGS = Materials + Labor + Logistics + Outsourcing', (r) => r?.cogs)}
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        )}
                        <tr>
                          <td
                            className="expandable-cell"
                            onClick={() => togglePnlRow('grossProfit')}
                          >
                            Gross Profit
                            <span className="expand-indicator">{expandedPnlRow === 'grossProfit' ? '-' : '+'}</span>
                          </td>
                          {rankedTeamsForResults.map(team => {
                            const r = resultsForView.get(team.id)
                            return (
                              <td key={team.id} className={(r?.grossProfit ?? 0) >= 0 ? 'positive' : 'negative'}>
                                {r ? formatCurrency(r.grossProfit) : '-'}
                              </td>
                            )
                          })}
                        </tr>
                        {expandedPnlRow === 'grossProfit' && (
                          <tr className="breakdown-row">
                            <td colSpan={rankedTeamsForResults.length + 1}>
                              <div className="breakdown-table">
                                <table>
                                  <tbody>
                                    {renderBreakdownRow('Revenue', (r) => r?.totalRevenue)}
                                    {renderBreakdownRow('COGS', (r) => r?.cogs)}
                                    {renderBreakdownRow('Gross Profit = Revenue - COGS', (r) => r?.grossProfit)}
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        )}
                        <tr>
                          <td
                            className="expandable-cell"
                            onClick={() => togglePnlRow('operatingExpenses')}
                          >
                            Operating Expenses
                            <span className="expand-indicator">{expandedPnlRow === 'operatingExpenses' ? '-' : '+'}</span>
                          </td>
                          {rankedTeamsForResults.map(team => {
                            const r = resultsForView.get(team.id)
                            return (
                              <td key={team.id} className={(r?.operatingExpenses ?? 0) >= 0 ? 'positive' : 'negative'}>
                                {r ? formatCurrency(r.operatingExpenses) : '-'}
                              </td>
                            )
                          })}
                        </tr>
                        {expandedPnlRow === 'operatingExpenses' && (
                          <tr className="breakdown-row">
                            <td colSpan={rankedTeamsForResults.length + 1}>
                              <div className="breakdown-table">
                                <table>
                                  <tbody>
                                    {renderBreakdownRow('R&D', (r) => r?.rdCost)}
                                    {renderBreakdownRow('Marketing', (r) => r?.marketingCost)}
                                    {renderBreakdownRow('Admin', (r) => r?.adminCost)}
                                    {renderBreakdownRow('Operating Expenses = R&D + Marketing + Admin', (r) => r?.operatingExpenses)}
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        )}
                        <tr>
                          <td
                            className="expandable-cell"
                            onClick={() => togglePnlRow('ebitda')}
                          >
                            EBITDA
                            <span className="expand-indicator">{expandedPnlRow === 'ebitda' ? '-' : '+'}</span>
                          </td>
                          {rankedTeamsForResults.map(team => {
                            const r = resultsForView.get(team.id)
                            return (
                              <td key={team.id} className={(r?.ebitda ?? 0) >= 0 ? 'positive' : 'negative'}>
                                {r ? formatCurrency(r.ebitda) : '-'}
                              </td>
                            )
                          })}
                        </tr>
                        {expandedPnlRow === 'ebitda' && (
                          <tr className="breakdown-row">
                            <td colSpan={rankedTeamsForResults.length + 1}>
                              <div className="breakdown-table">
                                <table>
                                  <tbody>
                                    {renderBreakdownRow('Gross Profit', (r) => r?.grossProfit)}
                                    {renderBreakdownRow('Operating Expenses', (r) => r?.operatingExpenses)}
                                    {renderBreakdownRow('EBITDA = Gross Profit - Operating Expenses', (r) => r?.ebitda)}
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        )}
                        <tr>
                          <td
                            className="expandable-cell"
                            onClick={() => togglePnlRow('ebit')}
                          >
                            EBIT
                            <span className="expand-indicator">{expandedPnlRow === 'ebit' ? '-' : '+'}</span>
                          </td>
                          {rankedTeamsForResults.map(team => {
                            const r = resultsForView.get(team.id)
                            return (
                              <td key={team.id} className={(r?.ebit ?? 0) >= 0 ? 'positive' : 'negative'}>
                                {r ? formatCurrency(r.ebit) : '-'}
                              </td>
                            )
                          })}
                        </tr>
                        {expandedPnlRow === 'ebit' && (
                          <tr className="breakdown-row">
                            <td colSpan={rankedTeamsForResults.length + 1}>
                              <div className="breakdown-table">
                                <table>
                                  <tbody>
                                    {renderBreakdownRow('EBITDA', (r) => r?.ebitda)}
                                    {renderBreakdownRow('Depreciation', (r) => r?.depreciation)}
                                    {renderBreakdownRow('EBIT = EBITDA - Depreciation', (r) => r?.ebit)}
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        )}
                        <tr>
                          <td
                            className="expandable-cell"
                            onClick={() => togglePnlRow('profitBeforeTax')}
                          >
                            Profit Before Tax
                            <span className="expand-indicator">{expandedPnlRow === 'profitBeforeTax' ? '-' : '+'}</span>
                          </td>
                          {rankedTeamsForResults.map(team => {
                            const r = resultsForView.get(team.id)
                            return (
                              <td key={team.id} className={(r?.profitBeforeTax ?? 0) >= 0 ? 'positive' : 'negative'}>
                                {r ? formatCurrency(r.profitBeforeTax) : '-'}
                              </td>
                            )
                          })}
                        </tr>
                        {expandedPnlRow === 'profitBeforeTax' && (
                          <tr className="breakdown-row">
                            <td colSpan={rankedTeamsForResults.length + 1}>
                              <div className="breakdown-table">
                                <table>
                                  <tbody>
                                    {renderBreakdownRow('EBIT', (r) => r?.ebit)}
                                    {renderBreakdownRow('Interest', (r) => r?.interestCost)}
                                    {renderBreakdownRow('Profit Before Tax = EBIT - Interest', (r) => r?.profitBeforeTax)}
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        )}
                        <tr>
                          <td
                            className="expandable-cell"
                            onClick={() => togglePnlRow('tax')}
                          >
                            Tax
                            <span className="expand-indicator">{expandedPnlRow === 'tax' ? '-' : '+'}</span>
                          </td>
                          {rankedTeamsForResults.map(team => (
                            <td key={team.id}>{resultsForView.get(team.id) ? formatCurrency(resultsForView.get(team.id)!.tax) : '-'}</td>
                          ))}
                        </tr>
                        {expandedPnlRow === 'tax' && (
                          <tr className="breakdown-row">
                            <td colSpan={rankedTeamsForResults.length + 1}>
                              <div className="breakdown-table">
                                <table>
                                  <tbody>
                                    {renderBreakdownRow('Profit Before Tax', (r) => r?.profitBeforeTax)}
                                    {renderBreakdownRow('Tax (rate applied if profit > 0)', (r) => r?.tax)}
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        )}
                        <tr className="highlight-row">
                          <td
                            className="expandable-cell"
                            onClick={() => togglePnlRow('netProfit')}
                          >
                            Net Profit
                            <span className="expand-indicator">{expandedPnlRow === 'netProfit' ? '-' : '+'}</span>
                          </td>
                          {rankedTeamsForResults.map(team => {
                            const r = resultsForView.get(team.id)
                            return (
                              <td key={team.id} className={(r?.netProfit ?? 0) >= 0 ? 'positive' : 'negative'}>
                                {r ? formatCurrency(r.netProfit) : '-'}
                              </td>
                            )
                          })}
                        </tr>
                        {expandedPnlRow === 'netProfit' && (
                          <tr className="breakdown-row">
                            <td colSpan={rankedTeamsForResults.length + 1}>
                              <div className="breakdown-table">
                                <table>
                                  <tbody>
                                    {renderBreakdownRow('Profit Before Tax', (r) => r?.profitBeforeTax)}
                                    {renderBreakdownRow('Tax', (r) => r?.tax)}
                                    {renderBreakdownRow('Net Profit = Profit Before Tax - Tax', (r) => r?.netProfit)}
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        )}

                        <tr className="section-row">
                          <td colSpan={rankedTeamsForResults.length + 1}>Market Share</td>
                        </tr>
                        <tr>
                          <td>{regionLabels.us} Market Share</td>
                          {rankedTeamsForResults.map(team => (
                            <td key={team.id}>{resultsForView.get(team.id) ? formatPercent(resultsForView.get(team.id)!.marketShareUS) : '-'}</td>
                          ))}
                        </tr>
                        <tr>
                          <td>{regionLabels.asia} Market Share</td>
                          {rankedTeamsForResults.map(team => (
                            <td key={team.id}>{resultsForView.get(team.id) ? formatPercent(resultsForView.get(team.id)!.marketShareAsia) : '-'}</td>
                          ))}
                        </tr>
                        <tr>
                          <td>{regionLabels.europe} Market Share</td>
                          {rankedTeamsForResults.map(team => (
                            <td key={team.id}>{resultsForView.get(team.id) ? formatPercent(resultsForView.get(team.id)!.marketShareEurope) : '-'}</td>
                          ))}
                        </tr>

                        <tr className="section-row">
                          <td colSpan={rankedTeamsForResults.length + 1}>KPIs</td>
                        </tr>
                        <tr className="highlight-row">
                          <td>Share Price</td>
                          {rankedTeamsForResults.map(team => {
                            const sharePrice = resultsForView.get(team.id)?.sharePrice
                            const prevSharePrice = prevResultsForView.get(team.id)?.sharePrice
                            const hasPrev = Number.isFinite(prevSharePrice) && Number.isFinite(sharePrice) && (prevSharePrice as number) !== 0
                            const deltaPct = hasPrev ? ((sharePrice as number) - (prevSharePrice as number)) / (prevSharePrice as number) : null
                            const deltaLabel = deltaPct === null ? '' : `${deltaPct >= 0 ? '^' : 'v'} ${formatPercent(Math.abs(deltaPct))}`
                            const deltaColor = deltaPct !== null && deltaPct < 0 ? 'var(--color-danger)' : 'var(--color-success)'
                            return (
                              <td key={team.id}>
                                {Number.isFinite(sharePrice) ? `$${sharePrice.toFixed(2)}` : '-'}
                                {deltaPct !== null && (
                                  <span style={{ marginLeft: '8px', fontSize: '0.75rem', color: deltaColor }}>
                                    {deltaLabel}
                                  </span>
                                )}
                              </td>
                            )
                          })}
                        </tr>
                        <tr>
                          <td>EPS</td>
                          {rankedTeamsForResults.map(team => {
                            const eps = resultsForView.get(team.id)?.eps
                            return (
                              <td key={team.id}>
                                {Number.isFinite(eps) ? `$${eps.toFixed(2)}` : '-'}
                              </td>
                            )
                          })}
                        </tr>
                        <tr>
                          <td>ROE</td>
                          {rankedTeamsForResults.map(team => (
                            <td key={team.id}>{resultsForView.get(team.id) ? formatPercent(resultsForView.get(team.id)!.roe) : '-'}</td>
                          ))}
                        </tr>
                        <tr className="section-row">
                          <td colSpan={rankedTeamsForResults.length + 1}>Share Price &amp; TSR Breakdown</td>
                        </tr>
                        <tr>
                          <td>Base Price (TSR base)</td>
                          {rankedTeamsForResults.map(team => {
                            const trace = resultsForView.get(team.id)?.sharePriceTrace
                            return (
                              <td key={team.id}>{formatMoney2(trace?.basePrice)}</td>
                            )
                          })}
                        </tr>
                        <tr>
                          <td>Previous Share Price</td>
                          {rankedTeamsForResults.map(team => {
                            const trace = resultsForView.get(team.id)?.sharePriceTrace
                            return (
                              <td key={team.id}>{formatMoney2(trace?.prevSharePrice)}</td>
                            )
                          })}
                        </tr>
                        <tr>
                          <td>EPS</td>
                          {rankedTeamsForResults.map(team => {
                            const trace = resultsForView.get(team.id)?.sharePriceTrace
                            return (
                              <td key={team.id}>{formatMoney2(trace?.eps)}</td>
                            )
                          })}
                        </tr>
                        <tr>
                          <td>Base P/E Ratio</td>
                          {rankedTeamsForResults.map(team => {
                            const trace = resultsForView.get(team.id)?.sharePriceTrace
                            return (
                              <td key={team.id}>{Number.isFinite(trace?.basePERatio) ? (trace.basePERatio as number).toFixed(2) : '-'}</td>
                            )
                          })}
                        </tr>
                        <tr>
                          <td>Growth Premium</td>
                          {rankedTeamsForResults.map(team => {
                            const trace = resultsForView.get(team.id)?.sharePriceTrace
                            return (
                              <td key={team.id}>{formatMaybePercent(trace?.growthPremium)}</td>
                            )
                          })}
                        </tr>
                        <tr>
                          <td>P/E Ratio (base * (1 + premium))</td>
                          {rankedTeamsForResults.map(team => {
                            const trace = resultsForView.get(team.id)?.sharePriceTrace
                            return (
                              <td key={team.id}>{Number.isFinite(trace?.peRatio) ? (trace.peRatio as number).toFixed(2) : '-'}</td>
                            )
                          })}
                        </tr>
                        <tr>
                          <td>Model Share Price (EPS * P/E)</td>
                          {rankedTeamsForResults.map(team => {
                            const trace = resultsForView.get(team.id)?.sharePriceTrace
                            return (
                              <td key={team.id}>{formatMoney2(trace?.sharePriceBase)}</td>
                            )
                          })}
                        </tr>
                        <tr>
                          <td>Smoothed Price</td>
                          {rankedTeamsForResults.map(team => {
                            const trace = resultsForView.get(team.id)?.sharePriceTrace
                            return (
                              <td key={team.id}>{formatMoney2(trace?.smoothedPrice)}</td>
                            )
                          })}
                        </tr>
                        <tr>
                          <td>Protected Floor</td>
                          {rankedTeamsForResults.map(team => {
                            const trace = resultsForView.get(team.id)?.sharePriceTrace
                            return (
                              <td key={team.id}>{formatMoney2(trace?.protectedFloor)}</td>
                            )
                          })}
                        </tr>
                        <tr className="highlight-row">
                          <td>Final Share Price</td>
                          {rankedTeamsForResults.map(team => {
                            const trace = resultsForView.get(team.id)?.sharePriceTrace
                            return (
                              <td key={team.id}>{formatMoney2(trace?.finalSharePrice ?? resultsForView.get(team.id)?.sharePrice)}</td>
                            )
                          })}
                        </tr>
                        <tr>
                          <td>Shares Outstanding</td>
                          {rankedTeamsForResults.map(team => {
                            const shares = resultsForView.get(team.id)?.sharesOutstanding
                            return (
                              <td key={team.id}>{Number.isFinite(shares) ? (shares as number).toLocaleString() : '-'}</td>
                            )
                          })}
                        </tr>
                        <tr>
                          <td>Dividends Paid</td>
                          {rankedTeamsForResults.map(team => {
                            const dividends = resultsForView.get(team.id)?.dividends
                            return (
                              <td key={team.id}>{formatMoney2(dividends)}</td>
                            )
                          })}
                        </tr>
                        <tr>
                          <td>Dividend / Share</td>
                          {rankedTeamsForResults.map(team => {
                            const dividends = resultsForView.get(team.id)?.dividends ?? 0
                            const shares = resultsForView.get(team.id)?.sharesOutstanding ?? 0
                            const perShare = shares > 0 ? dividends / shares : 0
                            return (
                              <td key={team.id}>{formatMoney2(perShare)}</td>
                            )
                          })}
                        </tr>
                        <tr className="highlight-row">
                          <td>TSR</td>
                          {rankedTeamsForResults.map(team => (
                            <td key={team.id}>{resultsForView.get(team.id) ? formatPercent(resultsForView.get(team.id)!.tsr) : '-'}</td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </main>

      {/* Debug Panel - Show when Dev Mode is enabled - inside main content */}
      {devMode && (
        <div className="debug-panel-inline">
          <div className="debug-header">
            <h3>Debug Data - All Rounds</h3>
          </div>
          <div className="debug-content">
            <div className="debug-section">
              <h4>Current Round ({game?.currentRound ?? 0}) - Raw Engine Decisions & R&D Progress</h4>
              <div className="debug-table">
                <table>
                  <thead>
                    <tr>
                      <th>Team</th>
                      <th>RND.researchStaff</th>
                      <th>RND.trainingLevel</th>
                      <th>HR.us.employees</th>
                      <th>HR.us.training</th>
                      <th>HR.asia.employees</th>
                      <th>HR.asia.training</th>
                      <th>ResearchHours (this)</th>
                      <th>ResearchHours (cum)</th>
                      <th>UnlockedFeatures</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teams.map(team => {
                      const result = liveResults.get(team.id)
                      const rnd = (team.engineDecisions.rnd as RecordAny) || {}
                      const hr = (team.engineDecisions.hr as RecordAny) || {}
                      const usEmp = hr.us?.employees ?? '-'
                      const usTraining = hr.us?.training ?? '-'
                      const asiaEmp = hr.asia?.employees ?? '-'
                      const asiaTraining = hr.asia?.training ?? '-'

                      return (
                        <tr key={team.id}>
                          <td><strong>{team.name}</strong></td>
                          <td>{rnd.researchStaff ?? '-'}</td>
                          <td>{rnd.trainingLevel ?? '-'}</td>
                          <td>{usEmp}</td>
                          <td>{usTraining}</td>
                          <td>{asiaEmp}</td>
                          <td>{asiaTraining}</td>
                          <td><strong>{result?.rndProgress?.researchHoursThisRound ?? 0}</strong></td>
                          <td><strong>{result?.rndProgress?.cumulativeResearchHours ?? 0}</strong></td>
                          <td><strong style={{ color: (result?.unlockedFeatureCount ?? 0) > 0 ? '#22c55e' : '#ef4444' }}>{result?.unlockedFeatureCount ?? 0}</strong></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {completedResults.length > 0 && (
              <div className="debug-section">
                <h4>Completed Rounds History</h4>
                <div className="debug-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Team</th>
                        <th>Round</th>
                        <th>ResearchHours (this)</th>
                        <th>ResearchHours (cum)</th>
                        <th>UnlockedFeatures</th>
                      </tr>
                    </thead>
                    <tbody>
                      {completedResults.flatMap(roundData =>
                        roundData.teams.map(teamResult => (
                          <tr key={`${teamResult.teamId}-${roundData.roundNumber}`}>
                            <td><strong>{teamResult.teamName}</strong></td>
                            <td>{roundData.roundNumber}</td>
                            <td><strong>{teamResult.rndProgress?.researchHoursThisRound ?? 0}</strong></td>
                            <td><strong>{teamResult.rndProgress?.cumulativeResearchHours ?? 0}</strong></td>
                            <td><strong style={{ color: (teamResult.unlockedFeatureCount ?? 0) > 0 ? '#22c55e' : '#ef4444' }}>{teamResult.unlockedFeatureCount ?? 0}</strong></td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="debug-section">
              <h4>Feature Thresholds & Formula</h4>
              <div className="debug-info">
                <p><strong>Feature 1:</strong> 50,000 cumulative research hours</p>
                <p><strong>Feature 2:</strong> 100,000 cumulative research hours</p>
                <p><strong>Feature 3:</strong> 150,000 cumulative research hours</p>
                <p><strong>Training Efficiency:</strong> basic=1.0x, standard=1.1x, advanced=1.2x</p>
                <p><strong>Formula:</strong> (US employees * 1500 * US efficiency) + (Asia employees * 1500 * Asia efficiency)</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .educator-page {
          min-height: 100vh;
          background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
        }

        .edu-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1.5rem 2rem;
          background: rgba(0, 0, 0, 0.2);
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }

        .header-left h1 {
          color: #fff;
          margin: 0;
          font-size: 1.5rem;
        }

        .game-code {
          color: #4facfe;
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.875rem;
        }

        .game-pin {
          color: #fbbf24;
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.875rem;
          margin-left: 1rem;
          padding: 0.25rem 0.5rem;
          background: rgba(251, 191, 36, 0.15);
          border-radius: 4px;
        }

        .header-right {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .header-center {
          display: flex;
          justify-content: center;
          flex: 1;
        }

        .deadline-pill {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.1rem;
          padding: 0.35rem 0.85rem;
          border-radius: 999px;
          background: rgba(79, 172, 254, 0.12);
          border: 1px solid rgba(255, 255, 255, 0.12);
          min-width: 220px;
        }

        .deadline-label {
          font-size: 0.7rem;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: rgba(255, 255, 255, 0.6);
        }

        .deadline-time {
          font-size: 0.8rem;
          color: #fff;
          font-weight: 600;
        }

        .deadline-countdown {
          font-size: 0.85rem;
          color: #4facfe;
          font-weight: 600;
        }

        .status-badge {
          padding: 0.25rem 0.75rem;
          border-radius: 20px;
          font-size: 0.75rem;
          font-weight: 600;
          text-transform: uppercase;
        }

        .status-badge.setup {
          background: rgba(251, 191, 36, 0.2);
          color: #fbbf24;
        }

        .status-badge.active {
          background: rgba(16, 185, 129, 0.2);
          color: #10b981;
        }

        .status-badge.completed {
          background: rgba(79, 172, 254, 0.2);
          color: #4facfe;
        }

        .btn-logout {
          background: rgba(255, 255, 255, 0.1);
          border: none;
          color: #94a3b8;
          padding: 0.5rem 1rem;
          border-radius: 6px;
          cursor: pointer;
        }

        .edu-main {
          max-width: 1000px;
          margin: 0 auto;
          padding: 2rem;
        }

        .error-message {
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.3);
          color: #fca5a5;
          padding: 1rem;
          border-radius: 8px;
          margin-bottom: 1rem;
        }

        .control-panel {
          display: flex;
          align-items: center;
          gap: 2rem;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 16px;
          padding: 1.5rem 2rem;
          margin-bottom: 2rem;
        }

        .round-info,
        .submission-status {
          text-align: center;
        }

        .round-info .label,
        .submission-status .label {
          display: block;
          color: #64748b;
          font-size: 0.75rem;
          text-transform: uppercase;
          margin-bottom: 0.25rem;
        }

        .round-info .value,
        .submission-status .value {
          color: #fff;
          font-size: 1.5rem;
          font-weight: 600;
        }

        .actions {
          margin-left: auto;
        }

        .btn-primary {
          background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
          border: none;
          color: #1a1a2e;
          font-size: 1rem;
          font-weight: 600;
          padding: 0.875rem 2rem;
          border-radius: 8px;
          cursor: pointer;
        }

        .btn-primary:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .waiting-status {
          color: #f59e0b;
          font-size: 0.9rem;
          padding: 0.875rem 1.5rem;
          background: rgba(245, 158, 11, 0.1);
          border-radius: 8px;
          border: 1px solid rgba(245, 158, 11, 0.2);
        }

        .calculating-status {
          color: #4facfe;
          font-size: 0.9rem;
          padding: 0.875rem 1.5rem;
          background: rgba(79, 172, 254, 0.1);
          border-radius: 8px;
          border: 1px solid rgba(79, 172, 254, 0.2);
          animation: pulse 1.5s infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }

        .teams-section,
        .info-section {
          margin-bottom: 2rem;
        }

        .teams-section h2,
        .info-section h2 {
          color: #fff;
          font-size: 1.25rem;
          margin: 0 0 1rem 0;
        }

        .teams-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 1rem;
        }

        .team-card {
          background: rgba(255, 255, 255, 0.05);
          border: 2px solid;
          border-radius: 12px;
          padding: 1rem;
          transition: all 0.3s ease;
        }

        .team-card.submitted {
          background: rgba(16, 185, 129, 0.05);
        }

        .team-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.25rem;
        }

        .team-name {
          color: #fff;
          font-weight: 600;
        }

        .ai-badge {
          background: rgba(79, 172, 254, 0.2);
          color: #4facfe;
          padding: 0.125rem 0.5rem;
          border-radius: 4px;
          font-size: 0.625rem;
          font-weight: 600;
        }

        .team-code {
          color: #64748b;
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.75rem;
          margin-bottom: 0.75rem;
        }

        .team-pin {
          color: #fbbf24;
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.75rem;
          margin-bottom: 0.75rem;
        }

        .team-status .status {
          font-size: 0.75rem;
          font-weight: 500;
        }

        .status.submitted {
          color: #10b981;
        }

        .status.pending {
          color: #fbbf24;
        }

        .status.ai {
          color: #4facfe;
        }

        .info-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 1rem;
        }

        .info-item {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 8px;
          padding: 1rem;
        }

        .info-item .label {
          display: block;
          color: #64748b;
          font-size: 0.75rem;
          margin-bottom: 0.25rem;
        }

        .info-item .value {
          color: #fff;
          font-weight: 500;
        }

        /* Login Codes Section */
        .codes-section {
          background: rgba(79, 172, 254, 0.05);
          border: 1px solid rgba(79, 172, 254, 0.2);
          border-radius: 16px;
          padding: 1.5rem;
          margin-bottom: 2rem;
        }

        .codes-section h2 {
          color: #fff;
          font-size: 1.25rem;
          margin: 0 0 0.25rem 0;
        }

        .codes-hint {
          color: #64748b;
          font-size: 0.875rem;
          margin: 0 0 1.5rem 0;
        }

        .game-code-box {
          margin-bottom: 1.5rem;
        }

        .code-label {
          display: block;
          color: #94a3b8;
          font-size: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 0.5rem;
        }

        .code-display {
          display: flex;
          align-items: center;
          gap: 1rem;
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          padding: 1rem;
        }

        .code-value {
          color: #4facfe;
          font-family: 'JetBrains Mono', monospace;
          font-size: 1.5rem;
          font-weight: 600;
          letter-spacing: 0.1em;
        }

        .pin-value {
          color: #fbbf24;
          font-family: 'JetBrains Mono', monospace;
          font-size: 1.25rem;
          font-weight: 600;
          padding: 0.25rem 0.75rem;
          background: rgba(251, 191, 36, 0.15);
          border-radius: 6px;
          margin-left: 0.5rem;
        }

        .copy-btn {
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.2);
          color: #94a3b8;
          padding: 0.5rem 1rem;
          border-radius: 6px;
          font-size: 0.875rem;
          cursor: pointer;
          transition: all 0.2s;
        }

        .copy-btn:hover {
          background: rgba(255, 255, 255, 0.15);
          color: #fff;
        }

        .copy-btn.small {
          padding: 0.25rem 0.5rem;
          font-size: 0.75rem;
        }

        .team-codes-box .code-label {
          margin-bottom: 0.75rem;
        }

        .team-codes-list {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .team-code-row {
          display: flex;
          align-items: center;
          gap: 1rem;
          background: rgba(0, 0, 0, 0.2);
          border-left: 3px solid;
          border-radius: 6px;
          padding: 0.75rem 1rem;
        }

        .team-code-row .team-name {
          color: #fff;
          font-weight: 500;
          min-width: 120px;
        }

        .team-code-value {
          color: #4facfe;
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.875rem;
          letter-spacing: 0.05em;
          flex: 1;
        }

        .team-pin-value {
          color: #fbbf24;
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.75rem;
          letter-spacing: 0.05em;
        }

        /* Dev mode toggle */
        .dev-toggle {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          color: #94a3b8;
          font-size: 0.875rem;
          cursor: pointer;
        }

        .dev-toggle input {
          cursor: pointer;
        }

        /* Tabs */
        .edu-tabs {
          display: flex;
          gap: 0.5rem;
          padding: 0 2rem;
          background: rgba(0, 0, 0, 0.1);
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }

        .tab {
          background: none;
          border: none;
          color: #64748b;
          padding: 1rem 1.5rem;
          font-size: 0.875rem;
          font-weight: 500;
          cursor: pointer;
          position: relative;
          transition: color 0.2s;
        }

        .tab:hover {
          color: #94a3b8;
        }

        .tab.active {
          color: #4facfe;
        }

        .tab.active::after {
          content: '';
          position: absolute;
          bottom: -1px;
          left: 0;
          right: 0;
          height: 2px;
          background: linear-gradient(90deg, #4facfe 0%, #00f2fe 100%);
        }

        /* Decisions Debug Table */
        .decisions-debug {
          margin-top: 1.5rem;
        }

        .debug-header {
          margin-bottom: 1rem;
        }

        .debug-header h2 {
          color: #fff;
          font-size: 1.25rem;
          margin: 0 0 0.25rem 0;
        }

        .warning-note {
          color: #fbbf24;
          font-size: 0.875rem;
          margin: 0;
        }

        .info-note {
          color: #64748b;
          font-size: 0.875rem;
          margin: 0;
        }

        .decisions-table-wrapper {
          overflow-x: auto;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
        }

        .decisions-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.875rem;
        }

        .decisions-table th,
        .decisions-table td {
          padding: 0.75rem 1rem;
          text-align: left;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        }

        .category-header {
          color: #64748b;
          font-weight: 500;
          min-width: 140px;
        }

        .team-header-cell {
          color: #fff;
          font-weight: 600;
          text-align: center;
          min-width: 120px;
          border-top: 3px solid;
          background: rgba(0, 0, 0, 0.2);
        }

        .team-header-cell .check {
          color: #10b981;
          margin-left: 0.5rem;
        }

        .section-row td {
          background: rgba(79, 172, 254, 0.1);
          color: #4facfe;
          font-weight: 600;
          text-transform: uppercase;
          font-size: 0.75rem;
          letter-spacing: 0.05em;
          padding: 0.5rem 1rem;
        }

        /* Demand-affecting section headers */
        .section-row.demand-section td {
          background: rgba(34, 197, 94, 0.15);
          color: #22c55e;
          border-left: 3px solid #22c55e;
        }

        /* Demand-affecting rows - highlighted */
        .demand-row {
          background: rgba(34, 197, 94, 0.05);
        }

        .demand-row .label-cell {
          background: rgba(34, 197, 94, 0.1);
          color: #22c55e;
          font-weight: 500;
        }

        .demand-row .value-cell {
          color: #86efac;
        }

        /* Demand factors section styling */
        .demand-factors-section {
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          padding: 1.5rem;
          margin-bottom: 1.5rem;
        }

        .demand-factors-section h3 {
          color: #fff;
          font-size: 1.125rem;
          margin: 0 0 1rem 0;
        }

        .demand-legend {
          color: #22c55e;
          font-size: 0.75rem;
          font-weight: normal;
        }

        .label-cell {
          color: #94a3b8;
          background: rgba(0, 0, 0, 0.1);
        }

        .value-cell {
          color: #fff;
          text-align: center;
          font-family: 'JetBrains Mono', monospace;
        }

        .value-cell.hidden {
          color: #475569;
        }

        /* Results Section - use .educator-page prefix to override DecisionSimulator.css */
        .educator-page .results-section {
          display: flex;
          flex-direction: column;
          gap: 2rem;
          margin-top: 1.5rem;
          padding: 0;
          background: transparent !important;
          box-shadow: none !important;
        }

        .educator-page .results-header h2 {
          color: #fff;
          font-size: 1.5rem;
          margin: 0 0 0.5rem 0;
        }

        .educator-page .results-note {
          color: #64748b;
          font-size: 0.875rem;
          margin: 0;
        }

        .educator-page .results-round-selector {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          margin: 0.5rem 0 0;
        }

        .educator-page .round-pill {
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.15);
          color: #94a3b8;
          padding: 0.35rem 0.9rem;
          border-radius: 999px;
          font-size: 0.75rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .educator-page .round-pill:hover {
          color: #e2e8f0;
          border-color: rgba(255, 255, 255, 0.3);
        }

        .educator-page .round-pill.active {
          color: #0f172a;
          background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
          border-color: transparent;
        }

        .educator-page .results-empty {
          color: #94a3b8;
          font-size: 0.85rem;
          padding: 0.75rem 1rem;
          background: rgba(255, 255, 255, 0.04);
          border: 1px dashed rgba(255, 255, 255, 0.15);
          border-radius: 10px;
        }

        .educator-page .decisions-inputs-section,
        .educator-page .rankings-section,
        .educator-page .detailed-results {
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          padding: 1.5rem;
        }

        .educator-page .decisions-inputs-section h3,
        .educator-page .rankings-section h3,
        .educator-page .detailed-results h3 {
          color: #fff;
          font-size: 1.125rem;
          margin: 0 0 1rem 0;
        }

        .educator-page .inputs-table-wrapper {
          overflow-x: auto;
          background: rgba(0, 0, 0, 0.2);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
        }

        .educator-page .inputs-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.8rem;
        }

        .educator-page .inputs-table th,
        .educator-page .inputs-table td {
          padding: 0.6rem 0.75rem;
          text-align: center;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          white-space: nowrap;
        }

        .educator-page .inputs-table th {
          color: #94a3b8;
          font-weight: 600;
          background: rgba(0, 0, 0, 0.3);
          text-transform: uppercase;
          font-size: 0.7rem;
          letter-spacing: 0.03em;
        }

        .educator-page .inputs-table td {
          color: #e2e8f0;
          font-family: 'JetBrains Mono', monospace;
        }

        .educator-page .inputs-table td.team-cell {
          text-align: left;
          font-family: inherit;
          font-weight: 500;
          color: #fff;
        }

        .educator-page .inputs-table tbody tr {
          border-left: 3px solid transparent;
        }

        .educator-page .inputs-table tbody tr:hover {
          background: rgba(255, 255, 255, 0.05);
        }

        .educator-page .rankings-table-wrapper,
        .educator-page .results-table-wrapper {
          overflow-x: auto;
          background: rgba(0, 0, 0, 0.2);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
        }

        .educator-page .rankings-table,
        .educator-page .results-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.875rem;
          background: transparent;
        }

        .educator-page .rankings-table th,
        .educator-page .rankings-table td,
        .educator-page .results-table th,
        .educator-page .results-table td {
          padding: 0.75rem 1rem;
          text-align: left;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          background: transparent;
        }

        .educator-page .rankings-table th,
        .educator-page .results-table th {
          color: #94a3b8;
          font-weight: 600;
          background: rgba(0, 0, 0, 0.3);
          text-transform: uppercase;
          font-size: 0.75rem;
          letter-spacing: 0.05em;
        }

        .educator-page .rankings-table tbody tr {
          border-left: 3px solid transparent;
          transition: background 0.2s ease;
          background: transparent;
        }

        .educator-page .rankings-table tbody tr:hover {
          background: rgba(255, 255, 255, 0.05);
        }

        .educator-page .rank-cell {
          font-size: 1.25rem;
          font-weight: 700;
          color: #4facfe;
        }

        .educator-page .team-cell {
          color: #fff;
          font-weight: 500;
        }

        .educator-page .value-cell {
          color: #e2e8f0;
          font-family: 'JetBrains Mono', monospace;
        }

        .educator-page .ai-tag {
          background: rgba(139, 92, 246, 0.2);
          color: #a78bfa;
          padding: 0.125rem 0.5rem;
          border-radius: 4px;
          font-size: 0.625rem;
          margin-left: 0.5rem;
          text-transform: uppercase;
        }

        .educator-page .status-badge {
          display: inline-block;
          padding: 0.25rem 0.75rem;
          border-radius: 12px;
          font-size: 0.75rem;
          font-weight: 500;
        }

        .educator-page .status-badge.auto {
          background: rgba(139, 92, 246, 0.2);
          color: #a78bfa;
        }

        .educator-page .status-badge.submitted {
          background: rgba(16, 185, 129, 0.2);
          color: #10b981;
        }

        .educator-page .status-badge.pending {
          background: rgba(251, 191, 36, 0.2);
          color: #fbbf24;
        }

        /* Detailed Results Table */
        .educator-page .results-table .metric-header {
          color: #fff;
          font-weight: 600;
        }

        .educator-page .results-table .team-col {
          border-top: 3px solid;
          text-align: center;
          min-width: 120px;
          color: #fff;
          font-weight: 600;
        }

        .educator-page .results-table tbody tr {
          background: transparent;
          transition: background 0.2s ease;
        }

        .educator-page .results-table tbody tr:hover {
          background: rgba(255, 255, 255, 0.05);
        }

        .educator-page .results-table td {
          color: #e2e8f0;
          background: transparent;
        }

        .educator-page .results-table td:first-child {
          color: #cbd5e1;
          font-weight: 500;
        }

        .educator-page .results-table td:not(:first-child) {
          text-align: center;
          color: #fff;
          font-family: 'JetBrains Mono', monospace;
        }

        .educator-page .results-table .section-row td {
          background: rgba(79, 172, 254, 0.15);
          color: #4facfe;
          font-weight: 700;
          text-transform: uppercase;
          font-size: 0.75rem;
          letter-spacing: 0.05em;
          padding: 0.5rem 1rem;
        }

        .educator-page .results-table .highlight-row td {
          background: rgba(79, 172, 254, 0.08);
          font-weight: 600;
        }

        .educator-page .results-table .total-row td {
          background: rgba(16, 185, 129, 0.15);
          font-weight: 700;
          color: #fff;
          border-top: 2px solid rgba(16, 185, 129, 0.3);
        }

        .educator-page .results-table .expandable-cell {
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.5rem;
        }

        .educator-page .results-table .expand-indicator {
          font-weight: 700;
          font-size: 0.9rem;
          color: #4facfe;
        }

        .educator-page .results-table .breakdown-row td {
          background: rgba(15, 23, 42, 0.35);
          padding: 0.75rem 1rem;
        }

        .educator-page .breakdown-table table {
          width: 100%;
          border-collapse: collapse;
          color: #e2e8f0;
        }

        .educator-page .breakdown-table td {
          padding: 0.4rem 0.6rem;
          border-bottom: 1px solid rgba(148, 163, 184, 0.15);
          font-size: 0.85rem;
        }

        .educator-page .breakdown-table tr:last-child td {
          border-bottom: none;
        }

        .educator-page .breakdown-label {
          color: #cbd5f5;
          font-weight: 500;
        }

        .educator-page .breakdown-value {
          text-align: right;
          font-family: 'JetBrains Mono', monospace;
        }

        .educator-page .positive {
          color: #10b981 !important;
        }

        .educator-page .negative {
          color: #ef4444 !important;
        }

        /* Debug Panel Styles - Inline in main content */
        .debug-panel-inline {
          background: rgba(0, 0, 0, 0.3);
          border: 2px solid #4facfe;
          border-radius: 12px;
          margin: 2rem 0;
          overflow: auto;
        }

        .debug-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1rem 2rem;
          background: rgba(79, 172, 254, 0.1);
          border-bottom: 1px solid rgba(79, 172, 254, 0.3);
          position: sticky;
          top: 0;
        }

        .debug-header h3 {
          margin: 0;
          color: #4facfe;
          font-size: 1rem;
        }

        .debug-round {
          color: #94a3b8;
          font-size: 0.875rem;
          font-weight: 500;
        }

        .debug-content {
          padding: 2rem;
          color: #e2e8f0;
          font-size: 0.875rem;
        }

        .debug-section {
          margin-bottom: 2rem;
        }

        .debug-section:last-child {
          margin-bottom: 0;
        }

        .debug-content h4 {
          margin: 0 0 1rem 0;
          color: #4facfe;
          text-transform: uppercase;
          font-size: 0.75rem;
          letter-spacing: 0.05em;
          font-weight: 600;
        }

        .debug-table {
          overflow-x: auto;
          border: 1px solid rgba(79, 172, 254, 0.2);
          border-radius: 8px;
        }

        .debug-table table {
          width: 100%;
          border-collapse: collapse;
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.75rem;
        }

        .debug-table th {
          text-align: left;
          padding: 0.75rem 1rem;
          background: rgba(0, 0, 0, 0.4);
          color: #4facfe;
          border-bottom: 2px solid rgba(79, 172, 254, 0.3);
          font-weight: 600;
          white-space: nowrap;
        }

        .debug-table td {
          padding: 0.75rem 1rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          color: #cbd5e0;
        }

        .debug-table tbody tr:hover {
          background: rgba(79, 172, 254, 0.08);
        }

        .debug-info {
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(79, 172, 254, 0.2);
          border-radius: 8px;
          padding: 1.5rem;
        }

        .debug-info p {
          margin: 0.75rem 0;
          color: #cbd5e0;
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.8rem;
        }

        .debug-info p:first-child {
          margin-top: 0;
        }

        .debug-info p:last-child {
          margin-bottom: 0;
        }
      `}</style>
    </div>
  )
}
