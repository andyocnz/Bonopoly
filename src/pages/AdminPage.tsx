import { Fragment, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGame } from '../context/GameContext'
import { adminApi, authApi, gameApi } from '../api/client'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import {
  GAME_CONFIG,
  SCENARIOS,
  calculateMarketDemand,
  calculateRoundMinus1,
  getScenarioGrowthRateForRound,
  getScenarioEffectsForRound,
} from '../engine/gameEngine'
import type { RoundScenario } from '../engine/gameEngine'
import {

  DEFAULT_DEMAND_MULTIPLIERS,
  DEFAULT_REGION_SPLIT,
  generateRandomGameName,
  getGameConfigForIndustry,
  TEAM_NAMES
} from '../utils/gameCreationHelpers'
import { generateLocalScenario } from '../engine/localAi'
import EMAIL_TEMPLATES from '../data/emailTemplates.json'
import COMPANY_DETAILS from '../data/companyDetails.json'
import { encryptInvoiceData } from '../utils/crypto'

type AdminGame = {
  id: string
  gameCode: string
  gamePin: string
  name: string
  status: string
  currentRound: number
  totalRounds: number
  companyName?: string
  industry?: string
  timezone?: string
  hoursPerRound?: number | null
  marketDemandMode?: string
  marketDemandMultiplier?: number
  capacityPerFactory?: number
  totalTeams?: number
  regionDemandSplit?: { us: number; asia: number; europe: number }
  decisionStatus?: {
    totalHumans: number
    submittedHumans: number
    pendingHumans: number
    allHumanSubmitted: boolean
  }
  regionLabels?: { us: string; asia: string; europe: string }
  createdAt: string
  scenarioSequence: number[]
  teams: Array<{
    id: string
    name: string
    teamCode: string
    teamPin: string
    color: string
    isComputer?: boolean
  }>
  educators?: Array<{
    educator: {
      email: string
    }
  }>
}

type AuditResult = {
  id: string
  teamId: string
  gameId: string
  roundNumber: number
  fullResults: unknown
  team: {
    id: string
    name: string
    teamCode: string
    teamPin: string
  }
}

type ConsistencySummaryRow = {
  gameId: string
  gameName: string
  gameCreatedAt?: string | null
  roundNumber: number
  totalTeams: number
  issueCount: number
}

type ConsistencyReport = {
  generatedAt: string
  summary: ConsistencySummaryRow[]
  issues: Array<{
    gameId: string
    gameName: string
    roundNumber: number
    teamId?: string
    teamName?: string
    check: string
    severity: 'warning' | 'error'
    message: string
    baselineRoundMinus1State?: unknown
  }>
  rawRounds: Array<{
    gameId: string
    rounds: Array<{
      roundNumber: number
      teams: Array<{
        teamId: string
        teamName: string
        roundMinus1: {
          gameState: unknown | null
          teamRoundResult: unknown | null
        }
        roundData: {
          gameState: unknown | null
          teamRoundResult: unknown | null
        }
      }>
    }>
  }>
}

type TransferEndpointRow = {
  method: string
  endpoint: string
  requests: number
  bytesOut: number
  bytesIn: number
  avgBytesOut: number
  avgMs: number
  p95Ms: number
  lastStatus: number
  lastSeenAt: string
}

type TransferSummary = {
  generatedAt: string
  since: string
  totals: {
    requests: number
    bytesOut: number
    bytesIn: number
  }
  endpointCount: number
  topEndpoints: TransferEndpointRow[]
}

type MiniGameInsightsSession = {
  id: string
  gameType: string
  title: string | null
  status: string
  teamCount: number
  roomCode: string | null
  createdAt: string
}

type MiniGameInsights = {
  sessions: MiniGameInsightsSession[]
  totalSessions: number
  includesAll: boolean
  hasMore: boolean
  byType: Array<{
    gameType: string
    count: number
  }>
}

type AdminUser = {
  id: string
  username: string
  createdAt?: string
}

type EducatorUser = {
  id: string
  email: string
  credits?: number
  pin?: string
}

type EducatorTransaction = {
  id: string
  createdAt: string
  type: string
  amount: number
  balanceAfter: number
  adminUser?: string | null
}

export function AdminPage() {
  const navigate = useNavigate()
  const { setGame, setIsEducator, setTeam } = useGame()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [isAuthed, setIsAuthed] = useState(false)
  const [authReady, setAuthReady] = useState(false)
  const [loading, setLoading] = useState(false)
  const [games, setGames] = useState<AdminGame[]>([])
  const [error, setError] = useState('')
  const [auditResults, setAuditResults] = useState<Record<string, AuditResult[]>>({})
  const [auditLoading, setAuditLoading] = useState<Record<string, boolean>>({})
  const [auditDetailLoading, setAuditDetailLoading] = useState(false)
  const [recalcLoading, setRecalcLoading] = useState<Record<string, boolean>>({})
  const [advanceLoading, setAdvanceLoading] = useState<Record<string, boolean>>({})
  const [archiveLoading, setArchiveLoading] = useState<Record<string, boolean>>({})
  const [activeSection, setActiveSection] = useState<
    'config' | 'admin' | 'educators' | 'games' | 'create' | 'login' | 'insights' | 'consistency' | null
  >(null)
  const [auditModal, setAuditModal] = useState<{
    gameId: string
    gameName: string
    roundNumber: number
  } | null>(null)
  const [auditPayload, setAuditPayload] = useState<string>('')
  const [teamDecisionsPayload, setTeamDecisionsPayload] = useState('')
  const [teamDecisionsLoading, setTeamDecisionsLoading] = useState(false)
  const [auditMsg, setAuditMsg] = useState('')
  const [timelineModal, setTimelineModal] = useState<{
    gameId: string
    gameName: string
  } | null>(null)
  const [statusFilter, setStatusFilter] = useState<'all' | 'ACTIVE' | 'COMPLETED' | 'SETUP' | 'ARCHIVED'>('all')
  const [educatorFilter, setEducatorFilter] = useState<'all' | 'none' | string>('all')
  const [demoFilter, setDemoFilter] = useState<'all' | 'demo' | 'regular'>('all')
  const [scenarioModal, setScenarioModal] = useState<typeof SCENARIOS[0] | null>(null)
  const [scenarioSeed, setScenarioSeed] = useState('')
  const [scenarioFocus, setScenarioFocus] = useState<'global' | 'us' | 'asia' | 'europe'>('global')
  const [generatedScenario, setGeneratedScenario] = useState<RoundScenario | null>(null)
  const [configModal, setConfigModal] = useState<AdminGame | null>(null)
  const [consistencyLoadingByGame, setConsistencyLoadingByGame] = useState<Record<string, boolean>>({})
  const [consistencyReportsByGame, setConsistencyReportsByGame] = useState<Record<string, ConsistencyReport>>({})
  const [consistencyErrorByGame, setConsistencyErrorByGame] = useState<Record<string, string>>({})
  const [expandedConsistencyGames, setExpandedConsistencyGames] = useState<Record<string, boolean>>({})
  const [expandedConsistencyRounds, setExpandedConsistencyRounds] = useState<Record<string, boolean>>({})
  const [showArchivedGames, setShowArchivedGames] = useState(false)
  const [bulkArchiveLoading, setBulkArchiveLoading] = useState(false)
  const [gameCounts, setGameCounts] = useState<{ active: number; archived: number } | null>(null)
  const [gamesMsg, setGamesMsg] = useState('')
  const [insightsByDay, setInsightsByDay] = useState<Array<{ date: string; active: number; archived: number }>>([])
  const [miniGameInsights, setMiniGameInsights] = useState<MiniGameInsights>({
    sessions: [],
    totalSessions: 0,
    includesAll: false,
    hasMore: false,
    byType: [],
  })
  const [showAllMiniGameSessions, setShowAllMiniGameSessions] = useState(false)
  const [loadingAllMiniGameSessions, setLoadingAllMiniGameSessions] = useState(false)
  const [transferSummary, setTransferSummary] = useState<TransferSummary | null>(null)
  const [transferSummaryLoading, setTransferSummaryLoading] = useState(false)
  const [transferSummaryError, setTransferSummaryError] = useState('')

  // Admin Management State
  const [newAdminUsername, setNewAdminUsername] = useState('')
  const [newAdminPassword, setNewAdminPassword] = useState('')


  const [adminMsg, setAdminMsg] = useState('')
  const [admins, setAdmins] = useState<AdminUser[]>([])


  // Educator Management State
  const [educators, setEducators] = useState<EducatorUser[]>([])
  const [newEducatorEmail, setNewEducatorEmail] = useState('')
  const [newEducatorPin, setNewEducatorPin] = useState('')
  const [newEducatorCredits, setNewEducatorCredits] = useState(0)
  const [expandedEducatorIds, setExpandedEducatorIds] = useState<Set<string>>(new Set())
  const [educatorTransactions, setEducatorTransactions] = useState<Record<string, EducatorTransaction[]>>({})
  const [txLoading, setTxLoading] = useState<Record<string, boolean>>({})
  const [expandedTxIds, setExpandedTxIds] = useState<Set<string>>(new Set())
  const [txDetails, setTxDetails] = useState<Record<string, { unitPrice: number; discount: number; name: string; phone: string }>>({})

  const showConfigSnapshot = activeSection === 'config'
  const showAdminTools = activeSection === 'admin'
  const showEducatorTools = activeSection === 'educators'
  const showGames = activeSection === 'games'
  const showCreateGame = activeSection === 'create'
  const showGameLogin = activeSection === 'login'
  const showInsights = activeSection === 'insights'
  const showConsistency = activeSection === 'consistency'

  // Game Access State
  const [accessGameCode, setAccessGameCode] = useState('')
  const [accessGamePin, setAccessGamePin] = useState('')

  // Game Creation State
  // Game Creation State
  const [gameName, setGameName] = useState(generateRandomGameName())
  const [industry, setIndustry] = useState('Oil & Energy')
  const [totalRounds, setTotalRounds] = useState(3)
  const [hoursPerRound, setHoursPerRound] = useState<number | null>(null)
  const [marketDemandMode, setMarketDemandMode] = useState<'high_competition' | 'balanced' | 'blue_ocean'>('balanced')
  const [demandMultiplier, setDemandMultiplier] = useState(DEFAULT_DEMAND_MULTIPLIERS.balanced)
  const [regionDemandSplit, setRegionDemandSplit] = useState({ ...DEFAULT_REGION_SPLIT })
  const [showAdvancedDemand, setShowAdvancedDemand] = useState(false)
  const [capacityPerPlant, setCapacityPerPlant] = useState(
    getGameConfigForIndustry(industry).capacityPerPlant
  )
  const [capacityPerPlantTouched, setCapacityPerPlantTouched] = useState(false)
  const [timezone, setTimezone] = useState('Pacific/Auckland')
  const [regionLabels, setRegionLabels] = useState({ us: 'Americas', asia: 'Asia', europe: 'Europe' })
  const [showRegionLabels, setShowRegionLabels] = useState(false)
  const [showConfigPreview, setShowConfigPreview] = useState(false)

  const configPreview = JSON.stringify(getGameConfigForIndustry(industry, { capacityPerPlant }), null, 2)
  const [teamCount, setTeamCount] = useState(4)
  const [teams, setTeams] = useState<Array<{ name: string; isAI: boolean; aiDifficulty: 'easy' | 'medium' | 'hard' }>>(
    TEAM_NAMES.slice(0, 4).map(name => ({ name, isAI: false, aiDifficulty: 'medium' }))
  )
  const [gameCreationMsg, setGameCreationMsg] = useState('')
  const maxScenarioId = useMemo(
    () => Object.values(SCENARIOS).reduce((max, scenario) => Math.max(max, scenario.id), 0),
    []
  )

  const handleAccessGame = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const { game } = await gameApi.login(accessGameCode, accessGamePin)
      setGame({
        id: game.id,
        gameCode: game.gameCode,
        name: game.name,
        status: game.status,
        companyName: game.companyName,
        industry: game.industry,
        totalRounds: game.totalRounds,
        currentRound: game.currentRound,
        roundDeadline: game.roundDeadline ?? null,
        timezone: game.timezone,
        regionLabels: game.regionLabels,
        marketDemandMode: game.marketDemandMode,
        marketDemandMultiplier: game.marketDemandMultiplier,
        regionDemandSplit: game.regionDemandSplit,
        scenarioSequence: game.scenarioSequence ?? [],
        teams: game.teams,
      })
      setTeam(null)
      setIsEducator(true)
      navigate('/educator-dev')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  const handleTeamCountChange = (count: number) => {
    setTeamCount(count)
    const newTeams = [...teams]
    while (newTeams.length < count) {
      newTeams.push({ name: TEAM_NAMES[newTeams.length] || `Team ${newTeams.length + 1}`, isAI: false, aiDifficulty: 'medium' })
    }
    setTeams(newTeams.slice(0, count))
  }

  const handleGenerateScenario = () => {
    const config = getGameConfigForIndustry(industry, { capacityPerPlant })
    const scenario = generateLocalScenario(
      {
        seed: scenarioSeed || undefined,
        regionFocus: scenarioFocus,
        baseId: maxScenarioId + 1,
        labels: { ...regionLabels, global: 'Global' }
      },
      config
    )
    setGeneratedScenario(scenario)
    setScenarioModal(scenario)
  }

  const handleCopyGeneratedScenario = () => {
    if (!generatedScenario) return
    navigator.clipboard.writeText(JSON.stringify(generatedScenario, null, 2))
      .then(() => alert('Generated scenario JSON copied to clipboard.'))
      .catch(() => undefined)
  }



  const configSnapshot = JSON.stringify(GAME_CONFIG, null, 2)
  const industryConfigLibrary = [
    { label: 'Oil & Energy', key: 'Oil & Energy' },
    { label: 'Electronics & Technology', key: 'Electronics & Technology' },
    { label: 'Automotive', key: 'Automotive' },
  ]
  const auditData = (() => {
    if (!auditPayload) return null
    try {
      return JSON.parse(auditPayload)
    } catch {
      return null
    }
  })()
  // const auditRegionLabels = (() => {
  //   if (!auditModal) return getRegionLabels()
  //   const game = games.find((entry) => entry.id === auditModal.gameId)
  //   return getRegionLabels(game)
  // })()
  // const auditSummary = (() => {
  //   if (!auditData) return null
  //   const regionOrder = ['us', 'asia', 'europe'] as const
  //   const csrByTeam = new Map<number, number>()
  //   const csrSource = auditData.idealShares?.us?.teams ?? []
  //   csrSource.forEach((teamRow: any) => {
  //     if (typeof teamRow.teamId === 'number') {
  //       csrByTeam.set(teamRow.teamId, teamRow.breakdown?.csrScore ?? 0)
  //     }
  //   })
  //   return { regionOrder, csrByTeam }
  // })()
  const formatNumber = (value: number) => value.toLocaleString()
  const formatCurrency = (value: number) => `$${value.toLocaleString()}`
  const formatPercent = (value: number) => `${value.toFixed(2)}%`
  const formatBytes = (value: number) => {
    if (!Number.isFinite(value) || value < 0) return '0 B'
    if (value < 1024) return `${value} B`
    if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
    if (value < 1024 * 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MB`
    return `${(value / (1024 * 1024 * 1024)).toFixed(2)} GB`
  }
  const formatMiniGameType = (value: string) =>
    value
      .toLowerCase()
      .split('_')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ')
  // const formatScore = (value: number) => (Number.isFinite(value) ? value.toFixed(2) : '0.00')
  // const toShareFraction = (value: number | undefined | null): number => {
  //   if (!value || Number.isNaN(value)) return 0
  //   return value > 1 ? value / 100 : value
  // }
  const getGameCreatorEmails = (game: AdminGame) => {
    return (game.educators ?? [])
      .map((entry) => entry.educator?.email)
      .filter((email): email is string => Boolean(email))
  }
  const handleRunConsistencyForGame = async (gameId: string) => {
    setConsistencyLoadingByGame((prev) => ({ ...prev, [gameId]: true }))
    setConsistencyErrorByGame((prev) => ({ ...prev, [gameId]: '' }))
    try {
      const report = await adminApi.getConsistencyReport(gameId)
      setConsistencyReportsByGame((prev) => ({
        ...prev,
        [gameId]: {
          generatedAt: report.generatedAt,
          summary: report.summary,
          issues: report.issues,
          rawRounds: report.rawRounds,
        },
      }))
      setExpandedConsistencyGames((prev) => ({ ...prev, [gameId]: true }))
    } catch (err) {
      setConsistencyErrorByGame((prev) => ({
        ...prev,
        [gameId]: err instanceof Error ? err.message : 'Failed to run checks',
      }))
    } finally {
      setConsistencyLoadingByGame((prev) => ({ ...prev, [gameId]: false }))
    }
  }
  const educatorOptions = useMemo(() => {
    const emails = new Set<string>()
    games.forEach((game) => {
      getGameCreatorEmails(game).forEach((email) => emails.add(email))
    })
    return Array.from(emails).sort((a, b) => a.localeCompare(b))
  }, [games])
  const filteredGames = useMemo(() => {
    const normalizedFilter = educatorFilter.toLowerCase()
    const filtered = games.filter((game) => {
      // Status filter
      if (statusFilter !== 'all') {
        if (statusFilter === 'ARCHIVED') {
          if (game.status !== 'ARCHIVED' && game.status !== 'COMPLETED') return false
        } else if (game.status !== statusFilter) {
          return false
        }
      }

      // Demo filter (check if game name starts with "Demo Game")
      const isDemoGame = game.name.toLowerCase().startsWith('demo game')
      if (demoFilter === 'demo' && !isDemoGame) return false
      if (demoFilter === 'regular' && isDemoGame) return false

      // Educator filter
      if (normalizedFilter === 'all') return true
      const creatorEmails = getGameCreatorEmails(game).map((email) => email.toLowerCase())
      if (normalizedFilter === 'none') {
        return !game.educators || game.educators.length === 0
      }
      return creatorEmails.includes(normalizedFilter)
    })
    return filtered.sort((a, b) => {
      const aTime = new Date(a.createdAt).getTime()
      const bTime = new Date(b.createdAt).getTime()
      if (Number.isNaN(aTime) || Number.isNaN(bTime)) return 0
      return bTime - aTime
    })
  }, [games, statusFilter, educatorFilter, demoFilter])
  const activeGames = useMemo(() => {
    return filteredGames.filter((game) => game.status !== 'ARCHIVED' && game.status !== 'COMPLETED')
  }, [filteredGames])
  const archivedGames = useMemo(() => {
    return filteredGames.filter((game) => game.status === 'ARCHIVED' || game.status === 'COMPLETED')
  }, [filteredGames])
  const demoArchiveCandidates = useMemo(() => {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000
    return games.filter((game) => {
      if (game.status === 'ARCHIVED' || game.status === 'COMPLETED') return false
      if (!game.name || !game.name.toLowerCase().startsWith('demo game')) return false
      const createdAt = new Date(game.createdAt).getTime()
      return Number.isFinite(createdAt) && createdAt <= cutoff
    })
  }, [games])
  const getConsistencyReportForGame = (gameId: string) => consistencyReportsByGame[gameId]
  const gamesByDay = useMemo(() => {
    return [...insightsByDay]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((row) => {
        const label = new Date(`${row.date}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        return { date: label, active: row.active, archived: row.archived }
      })
  }, [insightsByDay])
  const educatorSummary = useMemo(() => {
    const counts = new Map<string, number>()
    games.forEach((game) => {
      game.educators?.forEach((entry) => {
        const email = entry.educator?.email
        if (!email) return
        counts.set(email, (counts.get(email) ?? 0) + 1)
      })
    })
    return educators
      .map((educator) => ({
        id: educator.id,
        email: educator.email,
        credits: educator.credits ?? 0,
        gamesCreated: counts.get(educator.email) ?? 0,
      }))
      .sort((a, b) => a.email.localeCompare(b.email))
  }, [educators, games])
  const visibleMiniGameSessions = useMemo(() => (
    showAllMiniGameSessions ? miniGameInsights.sessions : miniGameInsights.sessions.slice(0, 5)
  ), [miniGameInsights.sessions, showAllMiniGameSessions])
  // const buildAuditFinancialTeams = (audit?: any): FinancialTeamRow[] => {
  //   if (!audit?.teams) return []
  //   return [...audit.teams].sort((a: any, b: any) => (a.teamName ?? '').localeCompare(b.teamName ?? '')).map((teamRow: any) => {
  //     const pnl = teamRow.pnl || {}
  //     const costs = teamRow.costs || {}
  //     const balance = teamRow.balanceSheet || {}
  //     const sales = teamRow.sales || {}
  //     const kpis = teamRow.kpis || {}
  //     const ratios = teamRow.ratios || {}
  //     const revenue = pnl.revenue ?? 0
  //     const grossProfit = pnl.grossProfit ?? 0
  //     const netProfit = pnl.netProfit ?? 0
  //     return {
  //       teamId: String(teamRow.teamId),
  //       teamName: teamRow.teamName ?? 'Team',
  //       revenue,
  //       revenueUS: sales.us?.revenue ?? 0,
  //       revenueAsia: sales.asia?.revenue ?? 0,
  //       revenueEurope: sales.europe?.revenue ?? 0,
  //       cogs: pnl.cogs ?? 0,
  //       materials: costs.materials ?? 0,
  //       labor: costs.labor ?? 0,
  //       logistics: costs.logistics ?? 0,
  //       outsourcing: costs.outsourcing ?? 0,
  //       grossProfit,
  //       grossMargin: pnl.grossMargin ?? (revenue > 0 ? (grossProfit / revenue) * 100 : 0),
  //       operatingExpenses: pnl.operatingExpenses ?? 0,
  //       rnd: costs.rnd ?? 0,
  //       marketing: costs.marketing ?? 0,
  //       admin: costs.admin ?? 0,
  //       ebitda: pnl.ebitda ?? 0,
  //       depreciation: pnl.depreciation ?? 0,
  //         ebit: pnl.ebit ?? 0,
  //         interestExpense: pnl.interestExpense ?? costs.interest ?? 0,
  //         tax: pnl.tax ?? 0,
  //         taxLossCarryforward: teamRow.gameState?.taxLossCarryforward ?? pnl.taxLossCarryforwardEnd ?? 0,
  //         netProfit,
  //       netMargin: pnl.netMargin ?? (revenue > 0 ? (netProfit / revenue) * 100 : 0),
  //       fixedAssets: balance.fixedAssets ?? 0,
  //       inventory: balance.inventory ?? 0,
  //       receivables: balance.receivables ?? 0,
  //       cash: balance.cash ?? 0,
  //       totalAssets: balance.totalAssets ?? 0,
  //       longTermDebt: balance.longTermDebt ?? 0,
  //       shortTermLoans: balance.shortTermLoans ?? 0,
  //       payables: balance.payables ?? 0,
  //       totalLiabilities: balance.totalLiabilities ?? 0,
  //       shareCapital: balance.shareCapital ?? 0,
  //       retainedEarnings: balance.retainedEarnings ?? 0,
  //       totalEquity: balance.totalEquity ?? 0,
  //       marketShareUS: toShareFraction(teamRow.marketShare?.us ?? 0),
  //       marketShareAsia: toShareFraction(teamRow.marketShare?.asia ?? 0),
  //       marketShareEurope: toShareFraction(teamRow.marketShare?.europe ?? 0),
  //       unitsSold: sales.total?.units ?? 0,
  //       sharePrice: kpis.sharePrice ?? 0,
  //       eps: kpis.eps ?? 0,
  //       roe: toShareFraction(ratios.roe ?? 0),
  //       tsr: toShareFraction(kpis.tsr ?? 0),
  //       dividendYield: kpis.dividendYield ?? 0,
  //     }
  //   })
  // }
  // const auditScenario = (() => {
  //   if (!auditModal) return null
  //   const game = games.find((entry) => entry.id === auditModal.gameId)
  //   const roundNumber = auditModal.roundNumber
  //   const scenarioId = game?.scenarioSequence?.[Math.max(0, roundNumber)] ?? 0
  //   const scenario = SCENARIOS[scenarioId] ?? SCENARIOS[0]
  //   return { game, roundNumber, scenarioId, scenario }
  // })()
  // const auditGameConfig = auditScenario
  //   ? getGameConfigForIndustry(
  //     auditScenario.game?.industry || 'Oil & Energy',
  //     auditScenario.game?.capacityPerFactory
  //       ? { capacityPerPlant: auditScenario.game.capacityPerFactory }
  //       : undefined
  //   )
  //   : GAME_CONFIG
  // const scenarioSnapshot = (() => {
  //   if (!auditScenario) return null
  //   const round = auditScenario.roundNumber
  //   const sequence = auditScenario.game?.scenarioSequence ?? []
  //   const multiplier = auditScenario.game?.marketDemandMultiplier ?? 1
  //   const config = getGameConfigForIndustry(
  //     auditScenario.game?.industry || 'Oil & Energy',
  //     auditScenario.game?.capacityPerFactory
  //       ? { capacityPerPlant: auditScenario.game.capacityPerFactory }
  //       : undefined
  //   )
  //   const teamCount = auditScenario.game?.teams?.length ?? auditScenario.game?.totalTeams ?? 0
  //   const regionSplit = auditScenario.game?.regionDemandSplit
  //   const roundMinus1Results = calculateRoundMinus1(teamCount, config, sequence, multiplier, regionSplit)
  //   const roundMinus1TotalSold = roundMinus1Results.teams.reduce((sum, team) => sum + (team.sales?.total?.units ?? 0), 0)
  //   const getTotalSoldForRound = (roundNumber: number) => {
  //     if (roundNumber < 0) return roundMinus1TotalSold
  //     const rows = auditResults[auditScenario.game?.id || ''] || []
  //     return rows
  //       .filter((entry) => entry.roundNumber === roundNumber)
  //       .reduce((sum, entry) => {
  //         const units = (entry.fullResults as any)?.sales?.total?.units ?? 0
  //         return sum + units
  //       }, 0)
  //   }
  //   const getBaseDemandTotalForRound = (roundNumber: number) => {
  //     if (roundNumber <= 1) {
  //       return roundMinus1TotalSold || undefined
  //     }
  //     const priorSold = getTotalSoldForRound(roundNumber - 1)
  //     return priorSold > 0 ? priorSold : undefined
  //   }
  //   const priorRound = round <= 1 ? -1 : round - 1
  //   const priorBase = getBaseDemandTotalForRound(priorRound)
  //   const priorDemand = calculateMarketDemand(priorRound, sequence, multiplier, config, teamCount, regionSplit, priorBase)
  //   const scenarioGrowth = getScenarioGrowthRateForRound(round <= 0 ? 0 : round, sequence, config)
  //   const currentBase = getBaseDemandTotalForRound(round)
  //   const scenarioDemandRound = calculateMarketDemand(round, sequence, multiplier, config, teamCount, regionSplit, currentBase)
  //   const effects = getScenarioEffectsForRound(round <= 0 ? 0 : round, sequence)
  //   return { priorDemand, scenarioGrowth, scenarioDemandRound, effects }
  // })()
  const buildScenarioTimeline = (game: AdminGame) => {
    const sequence = game.scenarioSequence ?? []
    const rounds = [-1, ...sequence.map((_, idx) => idx)]
    const multiplier = game.marketDemandMultiplier ?? 1
    const config = getGameConfigForIndustry(
      game.industry || 'Oil & Energy',
      game.capacityPerFactory ? { capacityPerPlant: game.capacityPerFactory } : undefined
    )
    const teamCount = game.teams?.length ?? game.totalTeams ?? 0
    const regionSplit = game.regionDemandSplit
    const roundMinus1Results = calculateRoundMinus1(teamCount, config, sequence, multiplier, regionSplit)
    const roundMinus1TotalSold = roundMinus1Results.teams.reduce((sum, team) => sum + (team.sales?.total?.units ?? 0), 0)
    const getTotalSoldForRound = (roundNumber: number) => {
      if (roundNumber < 0) return roundMinus1TotalSold
      const rows = auditResults[game.id] || []
      return rows
        .filter((entry) => entry.roundNumber === roundNumber)
        .reduce((sum, entry) => {
          const units = (entry.fullResults as { sales?: { total?: { units?: number } } })?.sales?.total?.units ?? 0
          return sum + units
        }, 0)
    }
    const getBaseDemandTotalForRound = (roundNumber: number) => {
      if (roundNumber <= 1) {
        return roundMinus1TotalSold || undefined
      }
      const priorSold = getTotalSoldForRound(roundNumber - 1)
      return priorSold > 0 ? priorSold : undefined
    }
    return rounds.map((roundNumber) => {
      const scenarioId = sequence[Math.max(roundNumber, 0)] ?? 0
      const scenario = SCENARIOS[scenarioId] ?? SCENARIOS[0]
      const effects = getScenarioEffectsForRound(roundNumber <= 0 ? 0 : roundNumber, sequence)
      const growth = getScenarioGrowthRateForRound(roundNumber <= 0 ? 0 : roundNumber, sequence, config)
      const priorBase = getBaseDemandTotalForRound(roundNumber - 1)
      const priorDemand = calculateMarketDemand(roundNumber - 1, sequence, multiplier, config, teamCount, regionSplit, priorBase)
      const currentBase = getBaseDemandTotalForRound(roundNumber)
      const demand = calculateMarketDemand(roundNumber, sequence, multiplier, config, teamCount, regionSplit, currentBase)
      const tariffs = { ...config.logisticsTariff, ...(scenario.logisticsTariff || {}) }
      return {
        roundNumber,
        scenarioId,
        scenarioName: scenario.name,
        priorDemand,
        demand,
        growth,
        effects,
        tariffs,
      }
    })
  }

  useEffect(() => {
    const hydrateAdmin = async () => {
      try {
        const session = await authApi.me('admin')
        if (session.success && session.role === 'admin') {
          setIsAuthed(true)
        }
      } catch (err) {
        console.error('Failed to hydrate admin session', err)
      } finally {
        setAuthReady(true)
      }
    }

    hydrateAdmin()
  }, [])

  useEffect(() => {
    if (isAuthed && !activeSection) {
      setActiveSection('insights')
    }
  }, [isAuthed, activeSection])



  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault()
    setAdminMsg('')
    setLoading(true)
    try {
      const { admin } = await adminApi.createAdmin(newAdminUsername, newAdminPassword)
      setAdminMsg(`Created admin user: ${admin.username}`)
      setNewAdminUsername('')
      setNewAdminPassword('')
      fetchAdmins()
    } catch (err) {
      setAdminMsg(`Error: ${err instanceof Error ? err.message : 'Failed'}`)
    } finally {
      setLoading(false)
    }
  }

  const fetchAdmins = async () => {
    try {
      const { admins: data } = await adminApi.listAdmins()
      setAdmins(data as AdminUser[])
    } catch (err) {
      console.error('Failed to list admins', err)
    }
  }

  useEffect(() => {
    if (showAdminTools && isAuthed) {
      fetchAdmins()
    }
  }, [showAdminTools, isAuthed])




  const fetchEducators = async () => {
    try {
      const { educators: data } = await adminApi.listEducators()
      setEducators(data as EducatorUser[])
    } catch (err) {
      console.error('Failed to list educators', err)
    }
  }

  useEffect(() => {
    if ((showEducatorTools || showInsights) && isAuthed) {
      fetchEducators()
    }
  }, [showEducatorTools, showInsights, isAuthed])

  useEffect(() => {
    if (!showInsights || !isAuthed) return
    adminApi.getGameInsights({ includeAllMiniSessions: false })
      .then((data) => {
        setInsightsByDay(data.byDay ?? [])
        setMiniGameInsights({
          sessions: data.miniGames?.sessions ?? [],
          totalSessions: data.miniGames?.totalSessions ?? 0,
          includesAll: data.miniGames?.includesAll ?? false,
          hasMore: data.miniGames?.hasMore ?? false,
          byType: data.miniGames?.byType ?? [],
        })
        setShowAllMiniGameSessions(false)
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load insights'))
  }, [showInsights, isAuthed])

  const handleToggleMiniGameSessions = async () => {
    if (showAllMiniGameSessions) {
      setShowAllMiniGameSessions(false)
      return
    }
    if (miniGameInsights.includesAll || !miniGameInsights.hasMore) {
      setShowAllMiniGameSessions(true)
      return
    }
    setLoadingAllMiniGameSessions(true)
    try {
      const data = await adminApi.getGameInsights({ includeAllMiniSessions: true })
      setMiniGameInsights({
        sessions: data.miniGames?.sessions ?? [],
        totalSessions: data.miniGames?.totalSessions ?? 0,
        includesAll: data.miniGames?.includesAll ?? true,
        hasMore: data.miniGames?.hasMore ?? false,
        byType: data.miniGames?.byType ?? [],
      })
      setShowAllMiniGameSessions(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load all mini-game sessions')
    } finally {
      setLoadingAllMiniGameSessions(false)
    }
  }

  useEffect(() => {
    if (!showInsights || !isAuthed) return
    setTransferSummaryLoading(true)
    setTransferSummaryError('')
    adminApi.getTransferSummary()
      .then((data) => setTransferSummary(data.summary ?? null))
      .catch((err) => {
        setTransferSummaryError(err instanceof Error ? err.message : 'Failed to load transfer summary')
      })
      .finally(() => setTransferSummaryLoading(false))
  }, [showInsights, isAuthed])

  const handleCreateEducator = async (e: React.FormEvent) => {
    e.preventDefault()
    setAdminMsg('')
    setLoading(true)
    try {
      await adminApi.createEducator(newEducatorEmail, newEducatorPin, newEducatorCredits)
      setAdminMsg(`Created educator: ${newEducatorEmail}`)
      setNewEducatorEmail('')
      setNewEducatorPin('')
      setNewEducatorCredits(0)
      fetchEducators()
    } catch (err) {
      setAdminMsg(`Error: ${err instanceof Error ? err.message : 'Failed'}`)
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateEducatorPin = async (id: string, newPin: string) => {
    try {
      await adminApi.updateEducatorPin(id, newPin)
      fetchEducators()
      setAdminMsg('PIN updated')
    } catch {
      setAdminMsg('Failed to update PIN')
    }
  }

  const handleAddCredits = async (id: string, amount: number) => {
    try {
      await adminApi.updateEducatorCredits(id, amount, 'add')
      fetchEducators()
      setAdminMsg('Credits added')
    } catch {
      setAdminMsg('Failed to add credits')
    }
  }

  const handleDeleteAdmin = async (id: string, username: string) => {
    if (!window.confirm(`Are you sure you want to delete admin "${username}"?`)) return
    setLoading(true)
    try {
      await adminApi.deleteAdmin(id)
      setAdminMsg(`Deleted admin: ${username}`)
      fetchAdmins()
    } catch (err) {
      setAdminMsg(`Error: ${err instanceof Error ? err.message : 'Failed to delete'}`)
    } finally {
      setLoading(false)
    }
  }

  const handleFetchEducatorTx = async (id: string) => {
    setTxLoading(prev => ({ ...prev, [id]: true }))
    try {
      const res = await adminApi.getEducatorTransactions(id)
      if (res.success) {
        setEducatorTransactions(prev => ({ ...prev, [id]: res.transactions as EducatorTransaction[] }))
      }
    } catch (err) {
      console.error('Failed to fetch tx', err)
    } finally {
      setTxLoading(prev => ({ ...prev, [id]: false }))
    }
  }

  const handleDeleteEducator = async (id: string, email: string) => {
    if (!window.confirm(`Are you sure you want to delete educator "${email}"? This will NOT delete their games.`)) return
    try {
      await adminApi.deleteEducator(id)
      fetchEducators()
      setAdminMsg(`Deleted educator: ${email}`)
    } catch {
      setAdminMsg('Failed to delete educator')
    }
  }

  const buildEducatorWelcomeEmail = (educator: EducatorUser | null | undefined) => {
    if (!educator) return ''
    const loginUrl = window.location.origin + '/educator-login'

    // We try to find the pin from the raw list if possible, or if it's passed in
    const pin = educator.pin || '****' // If backend doesn't return pin, we show masked

    const subject = EMAIL_TEMPLATES.educatorWelcome.subject
    const body = EMAIL_TEMPLATES.educatorWelcome.body
      .replace(/{{email}}/g, educator.email)
      .replace(/{{pin}}/g, pin)
      .replace(/{{loginUrl}}/g, loginUrl)

    return `Subject: ${subject}\n\n${body}`
  }

  const buildCreditPurchaseEmail = (tx: EducatorTransaction | null | undefined) => {
    if (!tx) return ''
    const details = txDetails[tx.id] || {
      unitPrice: COMPANY_DETAILS.creditUnitPrice,
      discount: 0,
      name: '',
      phone: ''
    }

    // Encrypt the dynamic data
    const secureData = encryptInvoiceData({
      up: details.unitPrice,
      ds: details.discount,
      nm: details.name,
      ph: details.phone
    })

    const invoiceUrl = window.location.origin + `/invoice/${tx.id}?d=${secureData}`

    const subject = EMAIL_TEMPLATES.creditPurchase.subject
    const body = EMAIL_TEMPLATES.creditPurchase.body
      .replace(/{{amount}}/g, Math.abs(tx.amount).toString())
      .replace(/{{balance}}/g, tx.balanceAfter.toString())
      .replace(/{{invoiceUrl}}/g, invoiceUrl)

    return `Subject: ${subject}\n\n${body}`
  }

  const handleCreateGame = async (e: React.FormEvent) => {
    e.preventDefault()
    setGameCreationMsg('')
    setLoading(true)
    try {
      const result = await gameApi.create({
        name: gameName,
        industry,
        totalRounds,
        hoursPerRound: hoursPerRound ?? undefined,
        marketDemandMode,
        marketDemandMultiplier: demandMultiplier,
        regionDemandSplit: showAdvancedDemand ? regionDemandSplit : undefined,
        capacityPerFactory: capacityPerPlant,
        timezone,
        regionLabels,
        teams: teams.slice(0, teamCount).map(t => ({
          name: t.name,
          isAI: t.isAI,
          aiDifficulty: t.isAI ? t.aiDifficulty : undefined
        }))
      })

      setGameCreationMsg(`Game created! Code: ${result.game.gameCode}, PIN: ${result.game.gamePin}`)
      setGameName(generateRandomGameName())

      // Refresh games list
      await fetchGames(showArchivedGames)
    } catch (err) {
      setGameCreationMsg(`Error: ${err instanceof Error ? err.message : 'Failed to create game'}`)
    } finally {
      setLoading(false)
    }
  }


  useEffect(() => {
    if (!isAuthed) return

    fetchGames(false)
  }, [isAuthed])

  useEffect(() => {
    if (capacityPerPlantTouched) return
    setCapacityPerPlant(getGameConfigForIndustry(industry).capacityPerPlant)
  }, [industry, capacityPerPlantTouched])

  useEffect(() => {
    if (games.length === 0) return
    games.forEach((game) => {
      if (!auditResults[game.id] && !auditLoading[game.id]) {
        handleLoadAudit(game.id)
      }
    })
  }, [games])

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    authApi
      .adminLogin(username.trim(), password)
      .then(() => {
        setIsAuthed(true)
        setActiveSection('insights')
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Login failed')
      })
  }

  const handleLogout = () => {
    setIsAuthed(false)
    setActiveSection(null)
    setUsername('')
    setPassword('')
    setGames([])
    authApi.logout('admin').catch(() => undefined)
  }

  const fetchGames = async (includeArchived: boolean) => {
    setLoading(true)
    setError('')
    try {
      const { games: data, counts } = await adminApi.listGames({ includeArchived, includeCounts: true })
      setGames(data)
      if (counts) {
        setGameCounts(counts)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load games')
    } finally {
      setLoading(false)
    }
  }

  const handleToggleArchivedGames = async () => {
    const nextShow = !showArchivedGames
    setShowArchivedGames(nextShow)
    await fetchGames(nextShow)
  }

  const handleArchiveGame = async (game: AdminGame) => {
    if (!window.confirm(`Archive ${game.name || game.gameCode}?`)) return
    setArchiveLoading((current) => ({ ...current, [game.id]: true }))
    setError('')
    try {
      await gameApi.archive(game.id)
      await fetchGames(showArchivedGames)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to archive game')
    } finally {
      setArchiveLoading((current) => ({ ...current, [game.id]: false }))
    }
  }

  const handleArchiveOldDemoGames = async () => {
    if (demoArchiveCandidates.length === 0) {
      window.alert('No demo games older than 1 day to archive.')
      return
    }
    const confirmed = window.confirm(`Archive ${demoArchiveCandidates.length} demo game(s) older than 1 day?`)
    if (!confirmed) return
    setBulkArchiveLoading(true)
    setError('')
    setGamesMsg('')
    try {
      for (const game of demoArchiveCandidates) {
        await gameApi.archive(game.id)
      }
      await fetchGames(showArchivedGames)
      setGamesMsg(`Archived ${demoArchiveCandidates.length} demo game(s).`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to archive demo games')
    } finally {
      setBulkArchiveLoading(false)
    }
  }

  const handleLoadAudit = async (gameId: string) => {
    setAuditLoading((current) => ({ ...current, [gameId]: true }))
    setError('')
    try {
      const { results } = await adminApi.getGameResults(gameId)
      setAuditResults((current) => ({ ...current, [gameId]: results }))
      return results
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load audit results')
    } finally {
      setAuditLoading((current) => ({ ...current, [gameId]: false }))
    }
    return []
  }

  const handleOpenAudit = async (game: AdminGame, roundNumber: number) => {
    if (!auditResults[game.id] && !auditLoading[game.id]) {
      await handleLoadAudit(game.id)
    }
    setAuditPayload('')
    setTeamDecisionsPayload('')
    setAuditMsg('')
    setAuditModal({ gameId: game.id, gameName: game.name, roundNumber })

    setAuditDetailLoading(true)
    try {
      const { audit } = await adminApi.getRoundAudit(game.id, roundNumber)
      setAuditPayload(JSON.stringify(audit, null, 2))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load audit details')
    } finally {
      setAuditDetailLoading(false)
    }
  }

  const handleRecalculateAuditRound = async () => {
    if (!auditModal) return
    if (auditModal.roundNumber < -1) return
    setRecalcLoading((current) => ({ ...current, [auditModal.gameId]: true }))
    setError('')
    setAuditMsg('')
    try {
      await adminApi.recalculateRound(auditModal.gameId, auditModal.roundNumber)
      await handleLoadAudit(auditModal.gameId)
      const { audit } = await adminApi.getRoundAudit(auditModal.gameId, auditModal.roundNumber)
      setAuditPayload(JSON.stringify(audit, null, 2))
      setAuditMsg(`Recalculated Round ${auditModal.roundNumber} successfully.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to recalculate round')
      setAuditMsg(`Error: ${err instanceof Error ? err.message : 'Failed to recalculate round'}`)
    } finally {
      setRecalcLoading((current) => ({ ...current, [auditModal.gameId]: false }))
    }
  }

  const handleLoadTeamDecisions = async () => {
    if (!auditModal) return
    setTeamDecisionsLoading(true)
    setAuditMsg('')
    try {
      const { decisions } = await adminApi.getRoundDecisions(auditModal.gameId, auditModal.roundNumber)
      setTeamDecisionsPayload(JSON.stringify(decisions, null, 2))
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load team decisions'
      setAuditMsg(`Error: ${message}`)
    } finally {
      setTeamDecisionsLoading(false)
    }
  }



  const handleAdvanceRound = async (game: AdminGame) => {
    const confirmed = window.confirm(`Advance ${game.name || game.gameCode} to the next round?`)
    if (!confirmed) return
    setAdvanceLoading((current) => ({ ...current, [game.id]: true }))
    setError('')
    try {
      await gameApi.advance(game.id)
      await fetchGames(showArchivedGames)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to advance round')
    } finally {
      setAdvanceLoading((current) => ({ ...current, [game.id]: false }))
    }
  }

  const handleStartGame = async (gameId: string) => {
    if (!window.confirm('Start the game? This will release the first scenario to teams.')) return
    setAdvanceLoading((current) => ({ ...current, [gameId]: true }))
    try {
      await gameApi.start(gameId)
      await fetchGames(showArchivedGames)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start game')
    } finally {
      setAdvanceLoading((current) => ({ ...current, [gameId]: false }))
    }
  }



  const handleResetRound = async () => {
    if (!auditModal) return
    if (auditModal.roundNumber < 0) return
    const confirmReset = window.confirm('This will clear all decisions and results from this round onward. Continue?')
    if (!confirmReset) return
    setRecalcLoading((current) => ({ ...current, [auditModal.gameId]: true }))
    setError('')
    setAuditMsg('')
    try {
      await adminApi.resetGameFromRound(auditModal.gameId, auditModal.roundNumber)
      await fetchGames(showArchivedGames)
      setAuditMsg(`Successfully reset game to Round ${auditModal.roundNumber}`)
      // Refresh audit data after 1 second to show the reset
      setTimeout(async () => {
        await handleLoadAudit(auditModal.gameId)
        setAuditModal(null)
      }, 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset game')
      setAuditMsg('')
    } finally {
      setRecalcLoading((current) => ({ ...current, [auditModal.gameId]: false }))
    }
  }

  const toggleSection = (section: typeof activeSection) => {
    setActiveSection((prev) => (prev === section ? null : section))
  }

  const renderGameCards = (gamesToRender: AdminGame[], emptyMessage: string) => {
    if (gamesToRender.length === 0) {
      return loading ? null : <div className="empty-state">{emptyMessage}</div>
    }

    return (
      <div className="games-list">
        {gamesToRender.map((game) => (
          <div key={game.id} className="game-card">
            <div className="game-header">
              <div>
                <div className="game-title-row">
                  <div className="game-title clickable" onClick={() => setConfigModal(game)}>
                    {game.name || 'Untitled Game'}
                  </div>
                  {game.status !== 'ARCHIVED' && (
                    <button
                      className="btn-secondary btn-archive"
                      type="button"
                      onClick={() => handleArchiveGame(game)}
                      disabled={archiveLoading[game.id]}
                    >
                      {archiveLoading[game.id] ? 'Archiving...' : 'Archive'}
                    </button>
                  )}
                </div>
                <div className="game-meta">
                  <span className="game-code">{game.gameCode}</span>
                  <span className="game-pin">PIN {game.gamePin}</span>
                  {game.educators && game.educators.length > 0 && (
                    <span className="game-detail" style={{ color: '#0ea5e9', fontWeight: 600 }}>
                      Created by: {getGameCreatorEmails(game)[0]}
                    </span>
                  )}
                  <span className={`status-badge ${game.status.toLowerCase()}`}>
                    {game.status}
                  </span>
                  {game.industry && (
                    <span className="game-detail">Industry: {game.industry}</span>
                  )}
                  {game.timezone && (
                    <span className="game-detail">TZ: {game.timezone}</span>
                  )}
                  <span className="game-detail">
                    Round time: {game.hoursPerRound ? `${game.hoursPerRound}h` : 'No limit'}
                  </span>
                  {game.regionLabels && (
                    <span className="game-detail">
                      Regions: {game.regionLabels.us} / {game.regionLabels.asia} / {game.regionLabels.europe}
                    </span>
                  )}
                  <span className="game-demand">
                    Growth Amplifier: {game.marketDemandMode || 'balanced'} x{(game.marketDemandMultiplier ?? 1).toFixed(2)}
                  </span>
                </div>
              </div>
              <div className="game-rounds">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                  <div>
                    Round {game.currentRound} / {game.totalRounds}
                    {game.decisionStatus && (
                      <span className="game-detail game-decision-status" style={{ marginLeft: '0.75rem', color: game.decisionStatus.pendingHumans > 0 ? '#f59e0b' : '#10b981' }}>
                        {game.decisionStatus.pendingHumans > 0
                          ? `Pending: ${game.decisionStatus.pendingHumans} team(s)`
                          : 'All teams submitted'}
                      </span>
                    )}
                  </div>

                  <div className="game-rounds-actions" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    {game.status === 'SETUP' && (
                      <button
                        className="btn-primary"
                        style={{ background: '#10b981', border: 'none', padding: '0.5rem 1rem', fontSize: '0.75rem', fontWeight: 600, borderRadius: '6px', cursor: 'pointer', color: '#fff' }}
                        onClick={() => handleStartGame(game.id)}
                        disabled={advanceLoading[game.id]}
                      >
                        {advanceLoading[game.id] ? 'Starting...' : 'ƒ- Start Game'}
                      </button>
                    )}

                    {game.status === 'ACTIVE' && (
                      (() => {
                        const isFinalRound = game.currentRound >= game.totalRounds
                        const isAdvancing = advanceLoading[game.id]
                        const totalH = game.decisionStatus?.totalHumans ?? 0
                        const submittedH = game.decisionStatus?.submittedHumans ?? 0
                        const allSubmitted = game.decisionStatus?.allHumanSubmitted ?? false

                        if (totalH === 0) {
                          return (
                            <button
                              className="btn-primary"
                              style={{ background: '#3b82f6', border: 'none', padding: '0.5rem 1rem', fontSize: '0.75rem', fontWeight: 600, borderRadius: '6px', cursor: 'pointer', color: '#fff' }}
                              onClick={() => handleAdvanceRound(game)}
                              disabled={isAdvancing}
                            >
                              {isAdvancing ? 'Running...' : 'Run Auto-Round'}
                            </button>
                          )
                        }

                        if (allSubmitted) {
                          return (
                            <button
                              className="btn-primary"
                              style={{ background: '#10b981', border: 'none', padding: '0.5rem 1rem', fontSize: '0.75rem', fontWeight: 600, borderRadius: '6px', cursor: 'pointer', color: '#fff' }}
                              onClick={() => handleAdvanceRound(game)}
                              disabled={isAdvancing}
                            >
                              {isAdvancing ? 'Advancing...' : (isFinalRound ? 'Finalize Results' : 'Advance Round')}
                            </button>
                          )
                        }

                        return (
                          <button
                            className="btn-secondary"
                            style={{ padding: '0.5rem 1rem', fontSize: '0.75rem', fontWeight: 600, borderRadius: '6px', cursor: 'not-allowed', color: '#64748b', background: '#f1f5f9', border: '1px solid #cbd5e1' }}
                            disabled
                            title={`Waiting for ${totalH - submittedH} more team(s)`}
                          >
                            Waiting ({submittedH}/{totalH})
                          </button>
                        )
                      })()
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="scenario-sequence">
              <div className="section-title">Round Scenarios</div>
              <div className="sequence-grid">
                <button
                  className="sequence-card assumptions has-results"
                  onClick={() => handleOpenAudit(game, -1)}
                >
                  <div className="sequence-round">Round -1</div>
                  <div className="sequence-name">Assumptions</div>
                </button>
                {(game.scenarioSequence || []).map((scenarioId, index) => {
                  const scenario = SCENARIOS[scenarioId]
                  const hasResults = (auditResults[game.id] || []).some((entry) => entry.roundNumber === index)
                  return (
                    <button
                      key={`${game.id}-round-${index}`}
                      className={`sequence-card ${hasResults ? 'has-results' : 'no-results'}`}
                      onClick={() => handleOpenAudit(game, index)}
                      aria-disabled={!hasResults}
                    >
                      <div className="sequence-round">Round {index}</div>
                      <div className="sequence-name">
                        {scenario ? scenario.name : `Scenario ${scenarioId}`}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="teams-section">
              <div className="section-title">Teams</div>
              <div className="team-list">
                {[...game.teams].sort((a, b) => a.name.localeCompare(b.name)).map((team) => (
                  <div
                    key={team.id}
                    className="team-row"
                    style={{ borderLeftColor: team.color }}
                  >
                    <span className="team-name">
                      {team.name}
                      {team.isComputer && <span className="ai-tag">AI</span>}
                    </span>
                    <span className="team-code">{team.teamCode}</span>
                    <span className="team-pin">PIN {team.teamPin}</span>
                    <button
                      className="copy-btn"
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
        ))}
      </div>
    )
  }

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

  return (
    <div className="admin-page">
      <div className="admin-container">
        <header className="admin-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, letterSpacing: '-0.02em', background: 'linear-gradient(to right, #e2e8f0, #94a3b8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              [AI] Modlab Admin
            </h1>
          </div>
        </header>

        {isAuthed && (
          <div className="admin-nav">
            <button
              className={`admin-nav-btn ${showInsights ? 'active' : ''}`}
              type="button"
              onClick={() => toggleSection('insights')}
            >
              Insights
            </button>
            <button
              className={`admin-nav-btn ${showGames ? 'active' : ''}`}
              type="button"
              onClick={() => toggleSection('games')}
            >
              Manage Games
            </button>
            <button
              className={`admin-nav-btn ${showConsistency ? 'active' : ''}`}
              type="button"
              onClick={() => toggleSection('consistency')}
            >
              Data Consistency
            </button>
            <button
              className={`admin-nav-btn ${showCreateGame ? 'active' : ''}`}
              type="button"
              onClick={() => toggleSection('create')}
            >
              + Create Game
            </button>
            <button
              className={`admin-nav-btn ${showEducatorTools ? 'active' : ''}`}
              type="button"
              onClick={() => toggleSection('educators')}
            >
              Educator Tools
            </button>
            <button
              className={`admin-nav-btn ${showAdminTools ? 'active' : ''}`}
              type="button"
              onClick={() => toggleSection('admin')}
            >
              Admin Tools
            </button>
            <button
              className={`admin-nav-btn ${showGameLogin ? 'active' : ''}`}
              type="button"
              onClick={() => toggleSection('login')}
            >
              Game Login
            </button>
            <button
              className={`admin-nav-btn ${showConfigSnapshot ? 'active' : ''}`}
              type="button"
              onClick={() => toggleSection('config')}
            >
              Config
            </button>
            <button className="btn-logout" onClick={handleLogout}>
              Log out
            </button>
          </div>
        )
        }

        {
          !isAuthed ? (
            <div className="login-card">
              <h2>Modlab Login</h2>
              <form onSubmit={handleLogin}>
                <div className="form-group">
                  <label htmlFor="admin-user">Username</label>
                  <input
                    id="admin-user"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter username"
                    autoComplete="off"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="admin-pass">Password</label>
                  <input
                    id="admin-pass"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                  />
                </div>
                {error && <div className="error-message">{error}</div>}
                <button type="submit" className="btn-primary">
                  Log in
                </button>
              </form>
            </div>
          ) : (
            <main className="games-panel">
              <div className="panel-header">
                <h2>All Games</h2>
                <div className="panel-actions">
                  <button
                    className="btn-secondary"
                    onClick={() => {
                      fetchGames(showArchivedGames)
                    }}
                    disabled={loading}
                  >
                    {loading ? 'Refreshing...' : 'Refresh'}
                  </button>
                  <select
                    className="filter-select"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                  >
                    <option value="all">All statuses</option>
                    <option value="ACTIVE">Active</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="SETUP">Setup</option>
                    <option value="ARCHIVED">Archived</option>
                  </select>
                  <select
                    className="filter-select"
                    value={educatorFilter}
                    onChange={(e) => setEducatorFilter(e.target.value as typeof educatorFilter)}
                  >
                    <option value="all">All creators</option>
                    <option value="none">System / Unknown</option>
                    {educatorOptions.map((email: string) => (
                      <option key={email} value={email}>
                        {email}
                      </option>
                    ))}
                  </select>
                  <select
                    className="filter-select"
                    value={demoFilter}
                    onChange={(e) => setDemoFilter(e.target.value as typeof demoFilter)}
                  >
                    <option value="all">All games</option>
                    <option value="demo">Demo games only</option>
                    <option value="regular">Regular games only</option>
                  </select>
                </div>
              </div>

              {error && <div className="error-message">{error}</div>}

              {showInsights && (
                <div className="insights-grid">
                  <div className="insights-card">
                    <h3>API Transfer Summary</h3>
                    {transferSummaryLoading ? (
                      <div className="insights-empty">Loading transfer summary...</div>
                    ) : transferSummaryError ? (
                      <div className="error-message">{transferSummaryError}</div>
                    ) : !transferSummary ? (
                      <div className="insights-empty">No transfer data yet.</div>
                    ) : (
                      <>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(120px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
                          <div style={{ background: 'rgba(15, 23, 42, 0.4)', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 8, padding: '0.65rem' }}>
                            <div style={{ color: '#94a3b8', fontSize: '0.7rem', textTransform: 'uppercase' }}>Requests</div>
                            <div style={{ color: '#e2e8f0', fontWeight: 700, fontSize: '1rem' }}>{formatNumber(transferSummary.totals.requests)}</div>
                          </div>
                          <div style={{ background: 'rgba(15, 23, 42, 0.4)', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 8, padding: '0.65rem' }}>
                            <div style={{ color: '#94a3b8', fontSize: '0.7rem', textTransform: 'uppercase' }}>Response</div>
                            <div style={{ color: '#e2e8f0', fontWeight: 700, fontSize: '1rem' }}>{formatBytes(transferSummary.totals.bytesOut)}</div>
                          </div>
                          <div style={{ background: 'rgba(15, 23, 42, 0.4)', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 8, padding: '0.65rem' }}>
                            <div style={{ color: '#94a3b8', fontSize: '0.7rem', textTransform: 'uppercase' }}>Request</div>
                            <div style={{ color: '#e2e8f0', fontWeight: 700, fontSize: '1rem' }}>{formatBytes(transferSummary.totals.bytesIn)}</div>
                          </div>
                        </div>
                        <div style={{ color: '#94a3b8', fontSize: '0.75rem', marginBottom: '0.6rem' }}>
                          Tracking since {new Date(transferSummary.since).toLocaleString()} ({transferSummary.endpointCount} endpoints)
                        </div>
                        <table className="insights-table">
                          <thead>
                            <tr>
                              <th>Endpoint</th>
                              <th>Requests</th>
                              <th>Bytes Out</th>
                              <th>P95 ms</th>
                            </tr>
                          </thead>
                          <tbody>
                            {transferSummary.topEndpoints.slice(0, 8).map((row) => (
                              <tr key={`${row.method}-${row.endpoint}`}>
                                <td>
                                  <code>{row.method} {row.endpoint}</code>
                                </td>
                                <td>{formatNumber(row.requests)}</td>
                                <td>{formatBytes(row.bytesOut)}</td>
                                <td>{Math.round(row.p95Ms)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </>
                    )}
                  </div>
                  <div className="insights-column">
                    <div className="insights-card">
                      <h3>Games Created by Day</h3>
                      <div className="insights-chart">
                        {gamesByDay.length === 0 ? (
                          <div className="insights-empty">No games created yet.</div>
                        ) : (
                          <ResponsiveContainer width="100%" height={260}>
                            <BarChart data={gamesByDay} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                              <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                              <YAxis allowDecimals={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                              <Tooltip
                                contentStyle={{ background: '#0f172a', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 8 }}
                                labelStyle={{ color: '#e2e8f0' }}
                              />
                              <Legend wrapperStyle={{ color: '#94a3b8', fontSize: 12 }} />
                              <Bar dataKey="active" stackId="games" fill="#38bdf8" name="Active" radius={[6, 6, 0, 0]} />
                              <Bar dataKey="archived" stackId="games" fill="#f97316" name="Archived" radius={[6, 6, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        )}
                      </div>
                    </div>
                    <div className="insights-card">
                      <h3>Educator Games & Credits</h3>
                      {educatorSummary.length === 0 ? (
                        <div className="insights-empty">No educators found.</div>
                      ) : (
                        <table className="insights-table">
                          <thead>
                            <tr>
                              <th>Educator</th>
                              <th>Games Created</th>
                              <th>Credits</th>
                            </tr>
                          </thead>
                          <tbody>
                            {educatorSummary.map((row) => (
                              <tr key={row.id}>
                                <td>{row.email}</td>
                                <td>{row.gamesCreated}</td>
                                <td>{row.credits}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>
                  <div className="insights-card" style={{ gridColumn: '1 / -1' }}>
                    <h3>Mini-Game Sessions</h3>
                    {miniGameInsights.totalSessions === 0 ? (
                      <div className="insights-empty">No mini-game sessions yet.</div>
                    ) : (
                      <>
                        <div style={{ color: '#94a3b8', fontSize: '0.75rem', marginBottom: '0.6rem' }}>
                          Showing {visibleMiniGameSessions.length} of {miniGameInsights.totalSessions} sessions
                        </div>
                        <table className="insights-table">
                          <thead>
                            <tr>
                              <th>Created</th>
                              <th>Game</th>
                              <th>Title</th>
                              <th>Status</th>
                              <th>Teams</th>
                            </tr>
                          </thead>
                          <tbody>
                            {visibleMiniGameSessions.map((row) => (
                              <tr key={row.id}>
                                <td>{new Date(row.createdAt).toLocaleString()}</td>
                                <td>{formatMiniGameType(row.gameType)}</td>
                                <td>{row.title || 'Untitled'}</td>
                                <td>{row.status}</td>
                                <td>{row.teamCount}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {miniGameInsights.totalSessions > 5 && (
                          <button
                            type="button"
                            className="btn-primary"
                            style={{ marginTop: '0.75rem' }}
                            onClick={handleToggleMiniGameSessions}
                            disabled={loadingAllMiniGameSessions}
                          >
                            {loadingAllMiniGameSessions
                              ? 'Loading...'
                              : showAllMiniGameSessions
                                ? 'Show Last 5'
                                : 'Show All'}
                          </button>
                        )}
                        <h3 style={{ marginTop: '1.1rem', marginBottom: '0.6rem' }}>Most Played Mini-Games</h3>
                        <table className="insights-table">
                          <thead>
                            <tr>
                              <th>Game</th>
                              <th>Sessions Created</th>
                            </tr>
                          </thead>
                          <tbody>
                            {miniGameInsights.byType.length === 0 ? (
                              <tr>
                                <td colSpan={2} style={{ color: '#94a3b8' }}>No mini-game play counts yet.</td>
                              </tr>
                            ) : (
                              miniGameInsights.byType.map((row) => (
                                <tr key={row.gameType}>
                                  <td>{formatMiniGameType(row.gameType)}</td>
                                  <td>{row.count}</td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </>
                    )}
                  </div>
                </div>
              )}

              {showConsistency && (
                <div className="config-library">
                  <div className="section-title">Data Consistency Checks</div>
                  <p className="audit-note">
                    Compares TeamRoundResult vs GameState after each round and flags potential data issues.
                  </p>
                  <div className="consistency-summary">
                    <div className="section-title">Games</div>
                    {filteredGames.length === 0 ? (
                      <div className="audit-note">No games found.</div>
                    ) : (
                      <table className="consistency-table summary-table">
                        <thead>
                          <tr>
                            <th>Game</th>
                            <th>Created</th>
                            <th>Status</th>
                            <th>Educator</th>
                            <th>Audit</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredGames.map((game) => {
                            const report = getConsistencyReportForGame(game.id)
                            const isExpanded = expandedConsistencyGames[game.id]
                            const isLoading = consistencyLoadingByGame[game.id]
                            const creatorEmails = getGameCreatorEmails(game)
                            const gameError = consistencyErrorByGame[game.id]
                            return (
                              <Fragment key={game.id}>
                                <tr className={isExpanded ? 'active-row' : ''}>
                                  <td>{game.name || 'Untitled Game'}</td>
                                  <td>{game.createdAt ? new Date(game.createdAt).toLocaleDateString() : '-'}</td>
                                  <td>{game.status}</td>
                                  <td>{creatorEmails.length > 0 ? creatorEmails.join(', ') : 'System / Unknown'}</td>
                                  <td>
                                    <div className="consistency-game-actions">
                                      <button
                                        className="btn-secondary"
                                        type="button"
                                        onClick={() => handleRunConsistencyForGame(game.id)}
                                        disabled={isLoading}
                                      >
                                        {isLoading ? 'Auditing...' : 'Audit'}
                                      </button>
                                      {report && (
                                        <button
                                          className="btn-primary"
                                          type="button"
                                          onClick={() =>
                                            setExpandedConsistencyGames((prev) => ({
                                              ...prev,
                                              [game.id]: !isExpanded,
                                            }))
                                          }
                                        >
                                          {isExpanded ? 'Collapse' : 'Expand'}
                                        </button>
                                      )}
                                    </div>
                                    {gameError && (
                                      <div className="audit-note" style={{ color: '#ef4444', marginTop: '0.35rem' }}>
                                        {gameError}
                                      </div>
                                    )}
                                    {!gameError && report && (
                                      <div className="consistency-meta" style={{ marginTop: '0.35rem' }}>
                                        Last run: {new Date(report.generatedAt).toLocaleString()}
                                      </div>
                                    )}
                                  </td>
                                </tr>
                                {isExpanded && report && (
                                  <tr className="consistency-issues-row">
                                    <td colSpan={5}>
                                      <table className="consistency-table summary-table">
                                        <thead>
                                          <tr>
                                            <th>Round</th>
                                            <th>Teams</th>
                                            <th>Issues</th>
                                            <th>Status</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {(report.rawRounds.find((entry) => entry.gameId === game.id)?.rounds ?? [])
                                            .slice()
                                            .sort((a, b) => a.roundNumber - b.roundNumber)
                                            .map((round) => {
                                              const roundKey = `${game.id}:${round.roundNumber}`
                                              const roundExpanded = expandedConsistencyRounds[roundKey]
                                              const roundIssues = report.issues.filter(
                                                (issue) => issue.roundNumber === round.roundNumber
                                              )
                                              return (
                                                <Fragment key={roundKey}>
                                                  <tr
                                                    className={roundExpanded ? 'active-row' : ''}
                                                    onClick={() =>
                                                      setExpandedConsistencyRounds((prev) => ({
                                                        ...prev,
                                                        [roundKey]: !roundExpanded,
                                                      }))
                                                    }
                                                  >
                                                    <td>{round.roundNumber}</td>
                                                    <td>{round.teams.length}</td>
                                                    <td>{roundIssues.length}</td>
                                                    <td>{roundIssues.length === 0 ? 'OK' : 'Needs Review'}</td>
                                                  </tr>
                                                  {roundExpanded && (
                                                    <tr className="consistency-issues-row">
                                                      <td colSpan={4}>
                                                        <table className="consistency-issues-table">
                                                          <thead>
                                                            <tr>
                                                              <th>Team</th>
                                                              {round.roundNumber <= 1 && <th>Round -1 JSON</th>}
                                                              <th>Round {round.roundNumber} JSON</th>
                                                            </tr>
                                                          </thead>
                                                          <tbody>
                                                            {round.teams.map((teamRow) => (
                                                              <tr key={`${roundKey}-${teamRow.teamId}`}>
                                                                <td>{teamRow.teamName}</td>
                                                                {round.roundNumber <= 1 && (
                                                                  <td>
                                                                    <details>
                                                                      <summary>View</summary>
                                                                      <pre>{JSON.stringify(teamRow.roundMinus1, null, 2)}</pre>
                                                                    </details>
                                                                  </td>
                                                                )}
                                                                <td>
                                                                  <details>
                                                                    <summary>View</summary>
                                                                    <pre>{JSON.stringify(teamRow.roundData, null, 2)}</pre>
                                                                  </details>
                                                                </td>
                                                              </tr>
                                                            ))}
                                                          </tbody>
                                                        </table>
                                                        {roundIssues.length > 0 && (
                                                          <table className="consistency-issues-table" style={{ marginTop: '0.75rem' }}>
                                                            <thead>
                                                              <tr>
                                                                <th>Team</th>
                                                                <th>Check</th>
                                                                <th>Severity</th>
                                                                <th>Detail</th>
                                                              </tr>
                                                            </thead>
                                                            <tbody>
                                                              {roundIssues.map((issue, idx) => (
                                                                <tr key={`${roundKey}-issue-${issue.teamId ?? 'all'}-${idx}`}>
                                                                  <td>{issue.teamName ?? 'All Teams'}</td>
                                                                  <td>{issue.check}</td>
                                                                  <td>{issue.severity}</td>
                                                                  <td>{issue.message}</td>
                                                                </tr>
                                                              ))}
                                                            </tbody>
                                                          </table>
                                                        )}
                                                      </td>
                                                    </tr>
                                                  )}
                                                </Fragment>
                                              )
                                            })}
                                        </tbody>
                                      </table>
                                    </td>
                                  </tr>
                                )}
                              </Fragment>
                            )
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              )}

              {showConfigSnapshot && (
                <div className="config-library">
                  <div className="section-title">Game Config Snapshot</div>
                  <pre className="config-json">{configSnapshot}</pre>
                </div>
              )}

              {showAdminTools && (
                <div className="config-library">
                  <div className="section-title">Admin Management</div>
                  {adminMsg && <div className="audit-note" style={{ color: adminMsg.startsWith('Error') ? '#ef4444' : '#10b981', marginBottom: '1rem' }}>{adminMsg}</div>}

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                    <div className="card" style={{ padding: '1.5rem' }}>
                      <h3 style={{ marginTop: 0 }}>Create New Admin</h3>
                      <form onSubmit={handleCreateAdmin}>
                        <div className="form-group">
                          <label>Username</label>
                          <input
                            type="text"
                            value={newAdminUsername}
                            onChange={(e) => setNewAdminUsername(e.target.value)}
                            placeholder="New username"
                            required
                          />
                        </div>
                        <div className="form-group">
                          <label>Password</label>
                          <input
                            type="password"
                            value={newAdminPassword}
                            onChange={(e) => setNewAdminPassword(e.target.value)}
                            placeholder="New password"
                            required
                          />
                        </div>
                        <button type="submit" className="btn-primary" disabled={loading}>
                          Create Admin
                        </button>
                      </form>
                    </div>

                    <div className="card" style={{ padding: '1.5rem', marginTop: '1rem', gridColumn: '1 / -1' }}>
                      <h3 style={{ marginTop: 0 }}>Existing Admins</h3>
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', color: '#cbd5e1' }}>
                          <thead>
                            <tr style={{ borderBottom: '1px solid #334155', textAlign: 'left' }}>
                              <th style={{ padding: '0.5rem' }}>Username</th>
                              <th style={{ padding: '0.5rem' }}>Created</th>
                              <th style={{ padding: '0.5rem' }}>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {admins.map((admin) => (
                              <tr key={admin.id} style={{ borderBottom: '1px solid #1e293b' }}>
                                <td style={{ padding: '0.75rem 0.5rem' }}>{admin.username}</td>
                                <td style={{ padding: '0.75rem 0.5rem' }}>
                                  {admin.createdAt ? new Date(admin.createdAt).toLocaleDateString() : '-'}
                                </td>
                                <td style={{ padding: '0.75rem 0.5rem' }}>
                                  <button
                                    className="btn-secondary"
                                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                                    onClick={async () => {
                                      const newPw = window.prompt(`Enter new password for ${admin.username}:`)
                                      if (!newPw) return
                                      setLoading(true)
                                      try {
                                        await adminApi.changeAdminPassword(admin.username, newPw)
                                        setAdminMsg(`Updated password for ${admin.username}`)
                                      } catch (err) {
                                        setAdminMsg(`Error: ${err instanceof Error ? err.message : 'Failed'}`)
                                      } finally {
                                        setLoading(false)
                                      }
                                    }}
                                  >
                                    Reset PW
                                  </button>
                                  <button
                                    className="btn-danger"
                                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem', marginLeft: '0.5rem', background: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                                    onClick={() => handleDeleteAdmin(admin.id, admin.username)}
                                  >
                                    Delete
                                  </button>
                                </td>
                              </tr>
                            ))}
                            {admins.length === 0 && (
                              <tr>
                                <td colSpan={3} style={{ padding: '1rem', textAlign: 'center', color: '#64748b' }}>
                                  No admins found (using fallback?).
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {showEducatorTools && (
                <div className="config-library">
                  <div className="section-title">Educator Management</div>
                  {adminMsg && <div className="audit-note" style={{ color: adminMsg.startsWith('Error') ? '#ef4444' : '#10b981', marginBottom: '1rem' }}>{adminMsg}</div>}

                  <div className="card" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
                    <h3 style={{ marginTop: 0 }}>Create New Educator</h3>
                    <form onSubmit={handleCreateEducator} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '1rem', alignItems: 'end' }}>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label>Email</label>
                        <input
                          type="email"
                          value={newEducatorEmail}
                          onChange={(e) => setNewEducatorEmail(e.target.value)}
                          placeholder="email@example.com"
                          required
                        />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label>PIN</label>
                        <input
                          type="text"
                          value={newEducatorPin}
                          onChange={(e) => setNewEducatorPin(e.target.value)}
                          placeholder="1234"
                          required
                        />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label>Initial Credits</label>
                        <input
                          type="number"
                          value={newEducatorCredits}
                          onChange={(e) => setNewEducatorCredits(Number(e.target.value))}
                          min="0"
                        />
                      </div>
                      <button type="submit" className="btn-primary" disabled={loading}>
                        Create
                      </button>
                    </form>
                  </div>

                  <div className="card" style={{ padding: '1.5rem' }}>
                    <h3 style={{ marginTop: 0 }}>Existing Educators</h3>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', color: '#cbd5e1' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid #334155', textAlign: 'left' }}>
                            <th style={{ padding: '0.5rem' }}>Email</th>
                            <th style={{ padding: '0.5rem' }}>Credits</th>
                            <th style={{ padding: '0.5rem' }}>Created</th>
                            <th style={{ padding: '0.5rem' }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {educators.map((edu) => {
                            const isExpanded = expandedEducatorIds.has(edu.id)
                            return (
                              <Fragment key={edu.id}>
                                <tr
                                  style={{ borderBottom: '1px solid #1e293b', cursor: 'pointer' }}
                                  onClick={() => {
                                    const next = new Set(expandedEducatorIds)
                                    if (next.has(edu.id)) {
                                      next.delete(edu.id)
                                    } else {
                                      next.add(edu.id)
                                      handleFetchEducatorTx(edu.id)
                                    }
                                    setExpandedEducatorIds(next)
                                  }}
                                >
                                  <td style={{ padding: '0.75rem 0.5rem' }}>
                                    <span style={{ marginRight: '0.5rem', opacity: 0.5 }}>{isExpanded ? '▼' : '▶'}</span>
                                    {edu.email}
                                  </td>
                                  <td style={{ padding: '0.75rem 0.5rem' }}>{edu.credits}</td>
                                  <td style={{ padding: '0.75rem 0.5rem' }}>{new Date(edu.createdAt).toLocaleDateString()}</td>
                                  <td style={{ padding: '0.75rem 0.5rem', display: 'flex', gap: '0.5rem' }}>
                                    <button
                                      className="btn-secondary btn-sm"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        const amt = prompt('Amount of credits to ADD (e.g. 5):')
                                        if (amt && !isNaN(Number(amt))) handleAddCredits(edu.id, Number(amt))
                                      }}
                                    >
                                      + Credits
                                    </button>
                                    <button
                                      className="btn-secondary btn-sm"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        const p = prompt('New PIN:')
                                        if (p) handleUpdateEducatorPin(edu.id, p)
                                      }}
                                    >
                                      Change PIN
                                    </button>
                                    <button
                                      className="btn-danger btn-sm"
                                      style={{ background: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handleDeleteEducator(edu.id, edu.email)
                                      }}
                                    >
                                      Delete
                                    </button>
                                  </td>
                                </tr>
                                {isExpanded && (
                                  <tr>
                                    <td colSpan={4} style={{ padding: '1rem', background: 'rgba(0,0,0,0.2)' }}>
                                      <div style={{ padding: '1rem', background: '#0f172a', borderRadius: '8px', border: '1px solid #334155' }}>
                                        <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#e2e8f0', marginBottom: '0.75rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                          <span>Welcome Email Template</span>
                                          <span
                                            title="Copy Welcome Email"
                                            style={{ cursor: 'pointer', fontSize: '1rem', opacity: 0.8 }}
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              const text = buildEducatorWelcomeEmail(edu)
                                              navigator.clipboard.writeText(text)
                                                .then(() => alert(`✓ Welcome email for ${edu.email} copied`))
                                                .catch(() => alert('✗ Failed to copy email'))
                                            }}
                                          >
                                            📋
                                          </span>
                                        </div>
                                        <textarea
                                          readOnly
                                          onClick={(e) => e.stopPropagation()}
                                          value={buildEducatorWelcomeEmail(edu)}
                                          style={{
                                            width: '100%',
                                            minHeight: '180px',
                                            padding: '12px',
                                            borderRadius: '6px',
                                            border: '1px solid #1e293b',
                                            fontSize: '0.85rem',
                                            color: '#cbd5e1',
                                            background: '#020617',
                                            resize: 'vertical',
                                            fontFamily: 'monospace',
                                            lineHeight: '1.4',
                                            marginBottom: '1.5rem'
                                          }}
                                        />

                                        <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#e2e8f0', marginBottom: '0.75rem' }}>
                                          Credit Transaction Ledger
                                        </div>
                                        <div style={{ background: '#020617', borderRadius: '6px', border: '1px solid #1e293b', overflow: 'hidden' }}>
                                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                                            <thead>
                                              <tr style={{ background: '#1e293b', textAlign: 'left', color: '#94a3b8' }}>
                                                <th style={{ padding: '0.5rem' }}>Date</th>
                                                <th style={{ padding: '0.5rem' }}>Type</th>
                                                <th style={{ padding: '0.5rem' }}>Change</th>
                                                <th style={{ padding: '0.5rem' }}>Balance</th>
                                                <th style={{ padding: '0.5rem' }}>Admin</th>
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {txLoading[edu.id] ? (
                                                <tr><td colSpan={5} style={{ padding: '1rem', textAlign: 'center', color: '#64748b' }}>Loading ledger...</td></tr>
                                              ) : (educatorTransactions[edu.id] ?? []).length === 0 ? (
                                                <tr><td colSpan={5} style={{ padding: '1rem', textAlign: 'center', color: '#64748b' }}>No transactions recorded.</td></tr>
                                              ) : educatorTransactions[edu.id].map((tx: EducatorTransaction) => {
                                                const txExpanded = expandedTxIds.has(tx.id)
                                                return (
                                                  <Fragment key={tx.id}>
                                                    <tr
                                                      style={{ borderBottom: '1px solid #1e293b', cursor: 'pointer' }}
                                                      onClick={(e) => {
                                                        e.stopPropagation()
                                                        const next = new Set(expandedTxIds)
                                                        if (next.has(tx.id)) next.delete(tx.id)
                                                        else next.add(tx.id)
                                                        setExpandedTxIds(next)
                                                      }}
                                                    >
                                                      <td style={{ padding: '0.5rem', color: '#94a3b8' }}>
                                                        <span style={{ marginRight: '0.4rem', opacity: 0.5, fontSize: '0.6rem' }}>{txExpanded ? '▼' : '▶'}</span>
                                                        {new Date(tx.createdAt).toLocaleString()}
                                                      </td>
                                                      <td style={{ padding: '0.5rem', fontWeight: 600 }}>{tx.type}</td>
                                                      <td style={{ padding: '0.5rem', color: tx.amount > 0 ? '#10b981' : '#ef4444' }}>
                                                        {tx.amount > 0 ? '+' : ''}{tx.amount}
                                                      </td>
                                                      <td style={{ padding: '0.5rem', fontWeight: 700 }}>{tx.balanceAfter}</td>
                                                      <td style={{ padding: '0.5rem', color: '#64748b' }}>{tx.adminUser || '-'}</td>
                                                    </tr>
                                                    {txExpanded && (
                                                      <tr style={{ background: 'rgba(59, 130, 246, 0.05)' }}>
                                                        <td colSpan={5} style={{ padding: '1rem' }}>
                                                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem', background: 'rgba(0,0,0,0.1)', padding: '1rem', borderRadius: '6px' }}>
                                                            <div className="form-group" style={{ marginBottom: 0 }}>
                                                              <label style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Unit Price (NZD)</label>
                                                              <input
                                                                type="number"
                                                                style={{ padding: '0.25rem', fontSize: '0.8rem', background: '#0f172a', color: 'white', border: '1px solid #1e293b', borderRadius: '4px', width: '100%' }}
                                                                value={txDetails[tx.id]?.unitPrice ?? COMPANY_DETAILS.creditUnitPrice}
                                                                onChange={(e) => setTxDetails(prev => ({ ...prev, [tx.id]: { ...(prev[tx.id] || { unitPrice: COMPANY_DETAILS.creditUnitPrice, discount: 0, name: '', phone: '' }), unitPrice: Number(e.target.value) } }))}
                                                              />
                                                            </div>
                                                            <div className="form-group" style={{ marginBottom: 0 }}>
                                                              <label style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Discount (%)</label>
                                                              <input
                                                                type="number"
                                                                style={{ padding: '0.25rem', fontSize: '0.8rem', background: '#0f172a', color: 'white', border: '1px solid #1e293b', borderRadius: '4px', width: '100%' }}
                                                                value={txDetails[tx.id]?.discount ?? 0}
                                                                onChange={(e) => setTxDetails(prev => ({ ...prev, [tx.id]: { ...(prev[tx.id] || { unitPrice: COMPANY_DETAILS.creditUnitPrice, discount: 0, name: '', phone: '' }), discount: Number(e.target.value) } }))}
                                                              />
                                                            </div>
                                                            <div className="form-group" style={{ marginBottom: 0 }}>
                                                              <label style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Recipient Name</label>
                                                              <input
                                                                type="text"
                                                                placeholder="Full Name"
                                                                style={{ padding: '0.25rem', fontSize: '0.8rem', background: '#0f172a', color: 'white', border: '1px solid #1e293b', borderRadius: '4px', width: '100%' }}
                                                                value={txDetails[tx.id]?.name ?? ''}
                                                                onChange={(e) => setTxDetails(prev => ({ ...prev, [tx.id]: { ...(prev[tx.id] || { unitPrice: COMPANY_DETAILS.creditUnitPrice, discount: 0, name: '', phone: '' }), name: e.target.value } }))}
                                                              />
                                                            </div>
                                                            <div className="form-group" style={{ marginBottom: 0 }}>
                                                              <label style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Recipient Phone</label>
                                                              <input
                                                                type="text"
                                                                placeholder="+64 ..."
                                                                style={{ padding: '0.25rem', fontSize: '0.8rem', background: '#0f172a', color: 'white', border: '1px solid #1e293b', borderRadius: '4px', width: '100%' }}
                                                                value={txDetails[tx.id]?.phone ?? ''}
                                                                onChange={(e) => setTxDetails(prev => ({ ...prev, [tx.id]: { ...(prev[tx.id] || { unitPrice: COMPANY_DETAILS.creditUnitPrice, discount: 0, name: '', phone: '' }), phone: e.target.value } }))}
                                                              />
                                                            </div>
                                                          </div>

                                                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                                            <span style={{ fontWeight: 700, fontSize: '0.75rem', color: '#94a3b8' }}>Purchase Email Preview</span>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                                              <a
                                                                href="#"
                                                                onClick={(e) => {
                                                                  e.preventDefault();
                                                                  e.stopPropagation();
                                                                  const emailText = buildCreditPurchaseEmail(tx);
                                                                  const match = emailText.match(/https?:\/\/[^\s]+/);
                                                                  if (match) {
                                                                    window.open(match[0], '_blank');
                                                                  } else {
                                                                    alert('Could not find invoice URL in email body');
                                                                  }
                                                                }}
                                                                style={{
                                                                  fontSize: '0.75rem',
                                                                  color: '#3b82f6',
                                                                  textDecoration: 'none',
                                                                  fontWeight: 600
                                                                }}
                                                              >
                                                                Preview Invoice ↗
                                                              </a>
                                                              <span
                                                                title="Copy Purchase Email"
                                                                style={{ cursor: 'pointer', fontSize: '1rem', opacity: 0.8 }}
                                                                onClick={(e) => {
                                                                  e.stopPropagation()
                                                                  const text = buildCreditPurchaseEmail(tx)
                                                                  navigator.clipboard.writeText(text)
                                                                    .then(() => alert(`✓ Purchase email copied`))
                                                                    .catch(() => alert('✗ Failed to copy email'))
                                                                }}
                                                              >
                                                                📋
                                                              </span>
                                                            </div>
                                                          </div>
                                                          <textarea
                                                            readOnly
                                                            onClick={(e) => e.stopPropagation()}
                                                            value={buildCreditPurchaseEmail(tx)}
                                                            style={{
                                                              width: '100%',
                                                              minHeight: '130px',
                                                              padding: '10px',
                                                              borderRadius: '4px',
                                                              border: '1px solid #1e293b',
                                                              fontSize: '0.75rem',
                                                              color: '#94a3b8',
                                                              background: '#020617',
                                                              resize: 'vertical',
                                                              fontFamily: 'monospace',
                                                              lineHeight: '1.4'
                                                            }}
                                                          />
                                                        </td>
                                                      </tr>
                                                    )}
                                                  </Fragment>
                                                )
                                              })}
                                            </tbody>
                                          </table>
                                        </div>
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </Fragment>
                            )
                          })}
                          {educators.length === 0 && (
                            <tr>
                              <td colSpan={4} style={{ padding: '1rem', textAlign: 'center', color: '#64748b' }}>
                                No educators found.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {showGameLogin && (
                <div className="config-library">
                  <div className="section-title">Access Legacy Game</div>
                  <form onSubmit={handleAccessGame} style={{ maxWidth: '400px' }}>
                    <div className="form-group">
                      <label>Game Code</label>
                      <input
                        type="text"
                        className="input-field"
                        value={accessGameCode}
                        onChange={(e) => setAccessGameCode(e.target.value.toUpperCase())}
                        placeholder="e.g. BONO-XXXX"
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>Game PIN</label>
                      <input
                        type="password"
                        className="input-field"
                        value={accessGamePin}
                        onChange={(e) => setAccessGamePin(e.target.value)}
                        placeholder="4-digit PIN"
                        required
                      />
                    </div>
                    <button type="submit" className="btn-primary" disabled={loading}>
                      {loading ? 'Logging in...' : 'Access Game'}
                    </button>
                  </form>
                </div>
              )}

              {showCreateGame && (
                <div className="config-library">
                  <div className="section-title">Create New Game</div>
                  {gameCreationMsg && <div className="audit-note" style={{ color: gameCreationMsg.startsWith('Error') ? '#ef4444' : '#10b981', marginBottom: '1rem' }}>{gameCreationMsg}</div>}

                  <form onSubmit={handleCreateGame} style={{ maxWidth: '800px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
                      <div className="form-group">
                        <label>Game Name</label>
                        <input
                          type="text"
                          value={gameName}
                          onChange={(e) => setGameName(e.target.value)}
                          placeholder="Auto-generated if left blank"
                        />
                      </div>

                      <div className="form-group">
                        <label>Industry</label>
                        <select value={industry} onChange={(e) => setIndustry(e.target.value)}>
                          <option value="Oil & Energy">Oil & Energy</option>
                          <option value="Electronics">Electronics</option>
                          <option value="Automotive">Automotive</option>
                        </select>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
                      <div className="form-group">
                        <label>Total Rounds</label>
                        <select value={totalRounds} onChange={(e) => setTotalRounds(Number(e.target.value))}>
                          {[2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                            <option key={n} value={n}>{n} Rounds</option>
                          ))}
                        </select>
                      </div>
                      <div className="form-group">
                        <label>Time Per Round</label>
                        <select
                          value={hoursPerRound ?? 0}
                          onChange={(e) => setHoursPerRound(Number(e.target.value) || null)}
                        >
                          <option value={0}>No time limit</option>
                          <option value={1}>1 hour</option>
                          <option value={2}>2 hours</option>
                          <option value={4}>4 hours</option>
                          <option value={24}>1 day</option>
                          <option value={48}>2 days</option>
                          <option value={168}>1 week</option>
                        </select>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
                      <div className="form-group">
                        <label>Number of Teams</label>
                        <select value={teamCount} onChange={(e) => handleTeamCountChange(Number(e.target.value))}>
                          {[2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                            <option key={n} value={n}>{n} Teams</option>
                          ))}
                        </select>
                      </div>
                      <div className="form-group">
                        <label>Market Demand Mode</label>
                        <select
                          value={marketDemandMode}
                          onChange={(e) => {
                            const mode = e.target.value as 'balanced' | 'high_competition' | 'blue_ocean'
                            setMarketDemandMode(mode)
                            setDemandMultiplier(DEFAULT_DEMAND_MULTIPLIERS[mode])
                          }}
                        >
                          <option value="high_competition">High Competition (lower growth)</option>
                          <option value="balanced">Balanced (default)</option>
                          <option value="blue_ocean">Blue Ocean (higher growth)</option>
                        </select>
                      </div>
                    </div>

                    <div className="form-group" style={{ marginTop: '1rem' }}>
                      <div
                        style={{ cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#94a3b8' }}
                        onClick={() => setShowAdvancedDemand(!showAdvancedDemand)}
                      >
                        <span>{showAdvancedDemand ? '▼' : '▶'} Advanced Settings</span>
                      </div>

                      {showAdvancedDemand && (
                        <div style={{
                          marginTop: '1rem',
                          padding: '1rem',
                          background: 'rgba(255,255,255,0.05)',
                          borderRadius: '0.5rem',
                          display: 'grid',
                          gap: '1rem'
                        }}>
                          <div className="form-group">
                            <label>Capacity Per Plant (units)</label>
                            <input
                              type="number"
                              min="100000"
                              step="10000"
                              value={capacityPerPlant}
                              onChange={(e) => {
                                setCapacityPerPlantTouched(true)
                                const next = Number(e.target.value)
                                if (!Number.isFinite(next)) return
                                setCapacityPerPlant(Math.max(0, Math.round(next)))
                              }}
                            />
                          </div>
                          <div className="form-group">
                            <label>
                              Scenario Growth Amplifier: {demandMultiplier.toFixed(2)}x
                              <span style={{ fontWeight: 400, marginLeft: '0.5rem', opacity: 0.7 }}>
                                {marketDemandMode === 'balanced' && '(2.0 = doubles scenario growth)'}
                                {marketDemandMode === 'blue_ocean' && '(3.0 = faster market growth)'}
                                {marketDemandMode === 'high_competition' && '(1.0 = base scenario growth)'}
                              </span>
                            </label>
                            <input
                              type="range"
                              min="0.5"
                              max="3.0"
                              step="0.05"
                              value={demandMultiplier}
                              onChange={(e) => setDemandMultiplier(parseFloat(e.target.value))}
                              style={{ width: '100%', cursor: 'pointer' }}
                            />
                          </div>

                          <div className="form-group">
                            <label>Region Demand Split (must sum to 100%)</label>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem', background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '8px' }}>
                              <div className="form-group">
                                <label style={{ fontSize: '0.8rem' }}>Americas: {(regionDemandSplit.us * 100).toFixed(0)}%</label>
                                <input
                                  type="range"
                                  min="0"
                                  max="100"
                                  step="1"
                                  style={{ width: '100%' }}
                                  value={regionDemandSplit.us * 100}
                                  onChange={(e) => {
                                    const newUs = parseFloat(e.target.value) / 100
                                    const remaining = 1 - newUs
                                    const ratio = regionDemandSplit.asia / (regionDemandSplit.asia + regionDemandSplit.europe) || 0.5
                                    setRegionDemandSplit({
                                      us: newUs,
                                      asia: remaining * ratio,
                                      europe: remaining * (1 - ratio),
                                    })
                                  }}
                                />
                              </div>
                              <div className="form-group">
                                <label style={{ fontSize: '0.8rem' }}>Asia: {(regionDemandSplit.asia * 100).toFixed(0)}%</label>
                                <input
                                  type="range"
                                  min="0"
                                  max="100"
                                  step="1"
                                  style={{ width: '100%' }}
                                  value={regionDemandSplit.asia * 100}
                                  onChange={(e) => {
                                    const newAsia = parseFloat(e.target.value) / 100
                                    const remaining = 1 - newAsia
                                    const ratio = regionDemandSplit.us / (regionDemandSplit.us + regionDemandSplit.europe) || 0.5
                                    setRegionDemandSplit({
                                      us: remaining * ratio,
                                      asia: newAsia,
                                      europe: remaining * (1 - ratio),
                                    })
                                  }}
                                />
                              </div>
                              <div className="form-group">
                                <label style={{ fontSize: '0.8rem' }}>Europe: {(regionDemandSplit.europe * 100).toFixed(0)}%</label>
                                <input
                                  type="range"
                                  min="0"
                                  max="100"
                                  step="1"
                                  style={{ width: '100%' }}
                                  value={regionDemandSplit.europe * 100}
                                  onChange={(e) => {
                                    const newEurope = parseFloat(e.target.value) / 100
                                    const remaining = 1 - newEurope
                                    const ratio = regionDemandSplit.us / (regionDemandSplit.us + regionDemandSplit.asia) || 0.5
                                    setRegionDemandSplit({
                                      us: remaining * ratio,
                                      asia: remaining * (1 - ratio),
                                      europe: newEurope,
                                    })
                                  }}
                                />
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => setRegionDemandSplit({ ...DEFAULT_REGION_SPLIT })}
                              style={{ marginTop: '0.5rem', fontSize: '0.75rem', padding: '0.25rem 0.5rem', background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '4px', cursor: 'pointer', color: 'inherit' }}
                            >
                              Reset to Default
                            </button>
                          </div>

                          <div className="form-group">
                            <label>Timezone</label>
                            <select value={timezone} onChange={(e) => setTimezone(e.target.value)}>
                              <option value="Pacific/Auckland">Pacific/Auckland (NZT)</option>
                              <option value="Australia/Sydney">Australia/Sydney (AEST)</option>
                              <option value="Asia/Tokyo">Asia/Tokyo (JST)</option>
                              <option value="Asia/Singapore">Asia/Singapore (SGT)</option>
                              <option value="Europe/London">Europe/London (GMT)</option>
                              <option value="America/New_York">America/New_York (EST)</option>
                              <option value="America/Los_Angeles">America/Los_Angeles (PST)</option>
                            </select>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="form-group" style={{ marginTop: '1rem' }}>
                      <div
                        style={{ cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#94a3b8' }}
                        onClick={() => setShowRegionLabels(!showRegionLabels)}
                      >
                        <span>{showRegionLabels ? '▼' : '▶'} Region Labels (Optional)</span>
                      </div>

                      {showRegionLabels && (
                        <div style={{
                          marginTop: '1rem',
                          padding: '1rem',
                          background: 'rgba(255,255,255,0.05)',
                          borderRadius: '0.5rem',
                        }}>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' }}>
                            <div className="form-group">
                              <label>Americas/US Label</label>
                              <input
                                type="text"
                                value={regionLabels.us}
                                onChange={(e) => setRegionLabels(prev => ({ ...prev, us: e.target.value }))}
                                placeholder="Americas"
                              />
                            </div>
                            <div className="form-group">
                              <label>Asia Label</label>
                              <input
                                type="text"
                                value={regionLabels.asia}
                                onChange={(e) => setRegionLabels(prev => ({ ...prev, asia: e.target.value }))}
                                placeholder="Asia"
                              />
                            </div>
                            <div className="form-group">
                              <label>Europe Label</label>
                              <input
                                type="text"
                                value={regionLabels.europe}
                                onChange={(e) => setRegionLabels(prev => ({ ...prev, europe: e.target.value }))}
                                placeholder="Europe"
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="form-group" style={{ marginTop: '1rem' }}>
                      <label style={{ display: 'block', marginBottom: '0.5rem' }}>Team Configuration</label>
                      <div style={{
                        display: 'grid',
                        gap: '0.8rem',
                        maxHeight: '300px',
                        overflowY: 'auto',
                        padding: '0.5rem',
                        background: 'rgba(255,255,255,0.05)',
                        borderRadius: '0.5rem'
                      }}>
                        {teams.slice(0, teamCount).map((team, idx) => (
                          <div key={idx} style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '0.75rem',
                            background: 'rgba(0,0,0,0.3)',
                            borderRadius: '4px',
                            borderLeft: `4px solid ${['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#d946ef'][idx % 8]}`
                          }}>
                            <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{team.name}</div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', cursor: 'pointer' }}>
                                <input
                                  type="checkbox"
                                  checked={team.isAI}
                                  onChange={(e) => {
                                    const newTeams = [...teams]
                                    newTeams[idx] = { ...newTeams[idx], isAI: e.target.checked }
                                    setTeams(newTeams)
                                  }}
                                  style={{ width: '16px', height: '16px' }}
                                />
                                Computer Controlled
                              </label>

                              {team.isAI && (
                                <select
                                  value={team.aiDifficulty}
                                  onChange={(e) => {
                                    const newTeams = [...teams]
                                    newTeams[idx] = { ...newTeams[idx], aiDifficulty: e.target.value as 'easy' | 'medium' | 'hard' }
                                    setTeams(newTeams)
                                  }}
                                  style={{
                                    padding: '0.25rem',
                                    fontSize: '0.8rem',
                                    borderRadius: '4px',
                                    background: '#334155',
                                    color: '#fff',
                                    border: '1px solid #475569'
                                  }}
                                >
                                  <option value="easy">Easy</option>
                                  <option value="medium">Medium</option>
                                  <option value="hard">Hard</option>
                                  <option value="expert">Expert</option>
                                </select>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="form-group" style={{ marginTop: '1rem' }}>
                      <div
                        style={{ cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#94a3b8' }}
                        onClick={() => setShowConfigPreview(!showConfigPreview)}
                      >
                        <span>{showConfigPreview ? '▼' : '▶'} Game Config Preview</span>
                      </div>
                      {showConfigPreview && (
                        <div style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(255,255,255,0.05)', borderRadius: '0.5rem' }}>
                          <div style={{ marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.75rem', color: '#94a3b8' }}>Config used for {industry}</div>
                          <pre style={{ margin: 0, fontSize: '0.75rem', fontFamily: 'monospace', overflowX: 'auto', color: '#e2e8f0' }}>{configPreview}</pre>
                        </div>
                      )}
                    </div>

                    <button type="submit" className="btn-primary" disabled={loading} style={{ marginTop: '1rem' }}>
                      {loading ? 'Creating...' : 'Create Game'}
                    </button>
                  </form>
                </div>
              )}


              {showConfigSnapshot && (
                <>
                  <div className="config-library">
                    <div className="section-title">Industry Config Library</div>
                    <div className="scenario-list">
                      {industryConfigLibrary.map((entry) => {
                        const snapshot = JSON.stringify(getGameConfigForIndustry(entry.key), null, 2)
                        return (
                          <div key={entry.key} className="scenario-card">
                            <div className="scenario-title">{entry.label}</div>
                            <pre className="config-json">{snapshot}</pre>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  <div className="scenario-generator-card scenario-card">
                    <div className="scenario-title">AI Scenario Generator</div>
                    <div className="scenario-desc">Seed-based, deterministic scenario creation without external APIs.</div>
                    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                      <label style={{ flex: '1 1 220px', display: 'flex', flexDirection: 'column' }}>
                        Seed
                        <input
                          type="text"
                          value={scenarioSeed}
                          onChange={(e) => setScenarioSeed(e.target.value)}
                          placeholder="Optional text"
                          style={{ marginTop: '0.25rem' }}
                        />
                      </label>
                      <label style={{ flex: '1 1 180px', display: 'flex', flexDirection: 'column' }}>
                        Region focus
                        <select
                          value={scenarioFocus}
                          onChange={(e) => setScenarioFocus(e.target.value as 'global' | 'us' | 'asia' | 'europe')}
                          style={{ marginTop: '0.25rem' }}
                        >
                          <option value="global">Global</option>
                          <option value="us">US</option>
                          <option value="asia">Asia</option>
                          <option value="europe">Europe</option>
                        </select>
                      </label>
                    </div>
                    <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem' }}>
                      <button type="button" className="btn-primary" onClick={handleGenerateScenario}>
                        Generate
                      </button>
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={handleCopyGeneratedScenario}
                        disabled={!generatedScenario}
                      >
                        Copy JSON
                      </button>
                    </div>
                    {generatedScenario && (
                      <div className="scenario-metrics" style={{ marginTop: '1rem', gap: '0.25rem' }}>
                        <div>#{generatedScenario.id} {generatedScenario.name}</div>
                        <div>{generatedScenario.description}</div>
                        <div>
                          Demand: US {generatedScenario.demandModifier.us}% | Asia {generatedScenario.demandModifier.asia}% | EU {generatedScenario.demandModifier.europe}%
                        </div>
                        <div>Price elasticity: {generatedScenario.priceElasticityModifier.toFixed(2)}x</div>
                        <div>CSR importance: {generatedScenario.csrImportanceModifier.toFixed(2)}x</div>
                        <div>Marketing effect: {generatedScenario.marketingEffectModifier.toFixed(2)}x</div>
                      </div>
                    )}
                  </div>

                  <div className="scenario-library">
                    <div className="section-title">Scenario Library</div>
                    <div className="scenario-list">
                      {Object.values(SCENARIOS).map((scenario) => (
                        <div key={scenario.id} className="scenario-card">
                          <div
                            className="scenario-title"
                            style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                            onClick={() => setScenarioModal(scenario)}
                          >
                            <span>#{scenario.id} {scenario.name}</span>
                            <span style={{ fontSize: '0.8rem', color: '#64748b' }}>🔍 View JSON</span>
                          </div>
                          <div className="scenario-desc">{scenario.description}</div>
                          <div className="scenario-metrics">
                            <div>Demand: US {scenario.demandModifier.us}% | Asia {scenario.demandModifier.asia}% | EU {scenario.demandModifier.europe}%</div>
                            <div>Price elasticity: {scenario.priceElasticityModifier.toFixed(2)}x</div>
                            <div>Marketing effect: {scenario.marketingEffectModifier.toFixed(2)}x</div>
                            <div>CSR importance: {scenario.csrImportanceModifier.toFixed(2)}x</div>
                            <div>Cost inflation: {scenario.costInflation.toFixed(2)}x</div>
                            <div>Investment cost: {scenario.investmentCostMultiplier.toFixed(2)}x</div>
                            <div>Interest spread: {(scenario.interestRateSpread * 100).toFixed(2)}%</div>
                            <div>Tax delta: US {(scenario.taxRateDeltaByRegion.us * 100).toFixed(2)}% Asia {(scenario.taxRateDeltaByRegion.asia * 100).toFixed(2)}% EU {(scenario.taxRateDeltaByRegion.europe * 100).toFixed(2)}%</div>
                            <div>Working capital: Inv {(scenario.workingCapitalDelta.inventory * 100).toFixed(2)}% Rec {(scenario.workingCapitalDelta.receivable * 100).toFixed(2)}% Pay {(scenario.workingCapitalDelta.payable * 100).toFixed(2)}%</div>
                            {scenario.logisticsTariff && (
                              <div>
                                Tariffs: US to Asia {scenario.logisticsTariff.usToAsia ?? '-'} | US to EU {scenario.logisticsTariff.usToEurope ?? '-'} | Asia to US {scenario.logisticsTariff.asiaToUs ?? '-'} | Asia to EU {scenario.logisticsTariff.asiaToEurope ?? '-'}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {showGames && (
                <>
                  <div className="games-bulk-actions">
                    <button
                      className="btn-secondary"
                      type="button"
                      onClick={handleArchiveOldDemoGames}
                      disabled={bulkArchiveLoading}
                    >
                      {bulkArchiveLoading
                        ? 'Archiving demo games...'
                        : `Archive demo games older than 1 day${demoArchiveCandidates.length > 0 ? ` (${demoArchiveCandidates.length})` : ''}`}
                    </button>
                  </div>
                  {gamesMsg && <div className="success-message">{gamesMsg}</div>}
                  <div className="games-section">
                    <div className="games-section-header">
                      <div className="section-title">Active Games ({gameCounts?.active ?? activeGames.length})</div>
                    </div>
                    {renderGameCards(activeGames, 'No active games found.')}
                  </div>
                  <div className="games-section">
                    <div className="games-section-header">
                      <div className="section-title">Archived Games</div>
                      <button
                        className="btn-secondary"
                        type="button"
                        onClick={handleToggleArchivedGames}
                      >
                        {showArchivedGames
                          ? 'Hide archived'
                          : `Show archived (${gameCounts?.archived ?? archivedGames.length})`}
                      </button>
                    </div>
                    {showArchivedGames && renderGameCards(archivedGames, 'No archived games found.')}
                  </div>
                </>
              )}

            </main>
          )
        }
      </div >

      {auditModal && (
        <div className="audit-modal">
          <div className="audit-modal-card">
            <div className="audit-modal-header">
              <div>
                <div className="audit-title">Audit: {auditModal.gameName}</div>
                <div className="audit-subtitle">Round {auditModal.roundNumber}</div>
              </div>
              <div className="audit-actions">
                <button
                  className="btn-primary"
                  onClick={handleLoadTeamDecisions}
                  disabled={teamDecisionsLoading}
                >
                  {teamDecisionsLoading ? 'Loading...' : 'View Decisions'}
                </button>
                <button
                  className="btn-secondary"
                  onClick={handleRecalculateAuditRound}
                  disabled={(!auditData && auditModal.roundNumber !== -1) || auditModal.roundNumber < -1 || recalcLoading[auditModal.gameId]}
                >
                  {auditModal.roundNumber === -1 ? 'Reset Starting Position' : 'Recalculate & Save Round'}
                </button>
                <button
                  className="btn-danger"
                  onClick={handleResetRound}
                  disabled={auditModal.roundNumber < 0 || recalcLoading[auditModal.gameId]}
                >
                  Reset From This Round
                </button>
                <button className="btn-logout" onClick={() => setAuditModal(null)}>
                  Close
                </button>
              </div>
            </div>
            {auditMsg && (
              <div className="audit-note audit-status" style={{ color: auditMsg.startsWith('Error') ? '#ef4444' : '#10b981' }}>
                {auditMsg}
              </div>
            )}
            <div className="audit-modal-body">
              {auditDetailLoading ? (
                <div className="audit-empty">Loading audit details...</div>
              ) : teamDecisionsPayload ? (
                <div className="audit-json-view">
                  <div className="audit-json-actions">
                    <button
                      className="btn-primary"
                      onClick={() => {
                        navigator.clipboard.writeText(teamDecisionsPayload)
                          .then(() => alert('Decisions JSON copied to clipboard!'))
                          .catch(() => alert('Failed to copy'))
                      }}
                    >
                      Copy to Clipboard
                    </button>
                  </div>
                  <pre className="audit-json">{teamDecisionsPayload}</pre>
                </div>
              ) : (
                <div className="audit-empty">Click "View Decisions" to see all team decisions for this round in raw JSON format.</div>
              )}
            </div>
          </div>
        </div>
      )
      }

      {
        timelineModal && (() => {
          const game = games.find((entry) => entry.id === timelineModal.gameId)
          if (!game) return null
          const timeline = buildScenarioTimeline(game)
          return (
            <div className="audit-modal">
              <div className="audit-modal-card timeline-card">
                <div className="audit-modal-header">
                  <div>
                    <div className="audit-title">Scenario Timeline: {timelineModal.gameName}</div>
                    <div className="audit-subtitle">Market demand + scenario parameters by round</div>
                  </div>
                  <div className="audit-actions">
                    <button className="btn-logout" onClick={() => setTimelineModal(null)}>
                      Close
                    </button>
                  </div>
                </div>
                <div className="timeline-table-wrap">
                  <table className="timeline-table">
                    <thead>
                      <tr>
                        <th>Metric</th>
                        {timeline.map((row) => (
                          <th key={row.roundNumber}>
                            {row.roundNumber < 0 ? 'Round -1' : `Round ${row.roundNumber}`}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="section-label" colSpan={timeline.length + 1}>Scenario</td>
                      </tr>
                      <tr>
                        <td>Scenario Name</td>
                        {timeline.map((row) => (
                          <td key={row.roundNumber}>{row.scenarioName}</td>
                        ))}
                      </tr>
                      <tr>
                        <td className="section-label" colSpan={timeline.length + 1}>Market Demand (Compounds by Round)</td>
                      </tr>
                      <tr>
                        <td>Prior Demand US</td>
                        {timeline.map((row) => (
                          <td key={row.roundNumber}>{formatNumber(row.priorDemand.us)}</td>
                        ))}
                      </tr>
                      <tr>
                        <td>Prior Demand Asia</td>
                        {timeline.map((row) => (
                          <td key={row.roundNumber}>{formatNumber(row.priorDemand.asia)}</td>
                        ))}
                      </tr>
                      <tr>
                        <td>Prior Demand Europe</td>
                        {timeline.map((row) => (
                          <td key={row.roundNumber}>{formatNumber(row.priorDemand.europe)}</td>
                        ))}
                      </tr>
                      <tr>
                        <td>Growth % (Base + Scenario, pre-amplifier)</td>
                        {timeline.map((row) => (
                          <td key={row.roundNumber}>
                            US {formatPercent(row.growth.us)} / Asia {formatPercent(row.growth.asia)} / EU {formatPercent(row.growth.europe)}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td>Demand After Growth US</td>
                        {timeline.map((row) => (
                          <td key={row.roundNumber}>{formatNumber(row.demand.us)}</td>
                        ))}
                      </tr>
                      <tr>
                        <td>Demand After Growth Asia</td>
                        {timeline.map((row) => (
                          <td key={row.roundNumber}>{formatNumber(row.demand.asia)}</td>
                        ))}
                      </tr>
                      <tr>
                        <td>Demand After Growth Europe</td>
                        {timeline.map((row) => (
                          <td key={row.roundNumber}>{formatNumber(row.demand.europe)}</td>
                        ))}
                      </tr>
                      <tr>
                        <td>Demand After Growth Total</td>
                        {timeline.map((row) => (
                          <td key={row.roundNumber}>{formatNumber(row.demand.total)}</td>
                        ))}
                      </tr>
                      <tr>
                        <td className="section-label" colSpan={timeline.length + 1}>Scenario Effects</td>
                      </tr>
                      <tr>
                        <td>Cost Inflation</td>
                        {timeline.map((row) => (
                          <td key={row.roundNumber}>{row.effects.costInflation.toFixed(2)}x</td>
                        ))}
                      </tr>
                      <tr>
                        <td>Investment Cost</td>
                        {timeline.map((row) => (
                          <td key={row.roundNumber}>{row.effects.investmentCostMultiplier.toFixed(2)}x</td>
                        ))}
                      </tr>
                      <tr>
                        <td>Marketing Effect</td>
                        {timeline.map((row) => (
                          <td key={row.roundNumber}>{row.effects.marketingEffectModifier.toFixed(2)}x</td>
                        ))}
                      </tr>
                      <tr>
                        <td>CSR Importance</td>
                        {timeline.map((row) => (
                          <td key={row.roundNumber}>{row.effects.csrImportanceModifier.toFixed(2)}x</td>
                        ))}
                      </tr>
                      <tr>
                        <td>Price Elasticity</td>
                        {timeline.map((row) => (
                          <td key={row.roundNumber}>{row.effects.priceElasticityModifier.toFixed(2)}x</td>
                        ))}
                      </tr>
                      <tr>
                        <td>Interest Rate Spread</td>
                        {timeline.map((row) => (
                          <td key={row.roundNumber}>{formatPercent(row.effects.interestRateSpread * 100)}</td>
                        ))}
                      </tr>
                      <tr>
                        <td>Tax Rate Delta US</td>
                        {timeline.map((row) => (
                          <td key={row.roundNumber}>{formatPercent(row.effects.taxRateDeltaByRegion.us * 100)}</td>
                        ))}
                      </tr>
                      <tr>
                        <td>Tax Rate Delta Asia</td>
                        {timeline.map((row) => (
                          <td key={row.roundNumber}>{formatPercent(row.effects.taxRateDeltaByRegion.asia * 100)}</td>
                        ))}
                      </tr>
                      <tr>
                        <td>Tax Rate Delta Europe</td>
                        {timeline.map((row) => (
                          <td key={row.roundNumber}>{formatPercent(row.effects.taxRateDeltaByRegion.europe * 100)}</td>
                        ))}
                      </tr>
                      <tr>
                        <td>Working Capital Delta Inventory</td>
                        {timeline.map((row) => (
                          <td key={row.roundNumber}>{formatPercent(row.effects.workingCapitalDelta.inventory * 100)}</td>
                        ))}
                      </tr>
                      <tr>
                        <td>Working Capital Delta Receivable</td>
                        {timeline.map((row) => (
                          <td key={row.roundNumber}>{formatPercent(row.effects.workingCapitalDelta.receivable * 100)}</td>
                        ))}
                      </tr>
                      <tr>
                        <td>Working Capital Delta Payable</td>
                        {timeline.map((row) => (
                          <td key={row.roundNumber}>{formatPercent(row.effects.workingCapitalDelta.payable * 100)}</td>
                        ))}
                      </tr>
                      <tr>
                        <td className="section-label" colSpan={timeline.length + 1}>Logistics Tariffs</td>
                      </tr>
                      <tr>
                        <td>US to Asia</td>
                        {timeline.map((row) => (
                          <td key={row.roundNumber}>{formatCurrency(row.tariffs.usToAsia)}</td>
                        ))}
                      </tr>
                      <tr>
                        <td>US to Europe</td>
                        {timeline.map((row) => (
                          <td key={row.roundNumber}>{formatCurrency(row.tariffs.usToEurope)}</td>
                        ))}
                      </tr>
                      <tr>
                        <td>Asia to US</td>
                        {timeline.map((row) => (
                          <td key={row.roundNumber}>{formatCurrency(row.tariffs.asiaToUs)}</td>
                        ))}
                      </tr>
                      <tr>
                        <td>Asia to Europe</td>
                        {timeline.map((row) => (
                          <td key={row.roundNumber}>{formatCurrency(row.tariffs.asiaToEurope)}</td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )
        })()
      }

      <style>{`
        .admin-page {
          min-height: 100vh;
          background: linear-gradient(135deg, #0f172a 0%, #0b1120 100%);
          padding: 2rem;
          color: #e2e8f0;
        }

        .admin-container {
          width: 100%;
          max-width: 100%;
          margin: 0;
        }

        .admin-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 1.5rem;
        }

        .admin-nav {
          width: 100%;
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          align-items: center;
          background: rgba(15, 23, 42, 0.6);
          padding: 0.5rem;
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.05);
          margin-bottom: 2rem;
        }

        .admin-nav-btn {
          flex: 1;
          display: flex;
          justify-content: center;
          align-items: center;
          border: none;
          background: transparent;
          color: #94a3b8;
          padding: 0.5rem 1rem;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          font-weight: 500;
          font-size: 0.9rem;
          white-space: nowrap;
        }

        .admin-nav-btn:hover {
          background: rgba(255, 255, 255, 0.05);
          color: #e2e8f0;
        }

        .admin-nav-btn.active {
          background: rgba(56, 189, 248, 0.1);
          color: #38bdf8;
          box-shadow: 0 0 0 1px rgba(56, 189, 248, 0.2);
        }

        .admin-header h1 {
          margin: 0;
          font-size: 2rem;
          color: #f8fafc;
        }

        .admin-header p {
          margin: 0.25rem 0 0 0;
          color: #94a3b8;
        }

        .login-card {
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 16px;
          padding: 2rem;
          max-width: 420px;
        }

        .login-card h2 {
          margin: 0 0 1.5rem 0;
          color: #f8fafc;
        }

        .form-group {
          margin-bottom: 1rem;
        }

        .form-group label {
          display: block;
          color: #94a3b8;
          margin-bottom: 0.5rem;
          font-size: 0.875rem;
        }

        .form-group input {
          width: 100%;
          padding: 0.75rem 1rem;
          border-radius: 10px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(0, 0, 0, 0.3);
          color: #f8fafc;
          font-size: 1rem;
        }

        .admin-page input::placeholder,
        .admin-page textarea::placeholder {
          color: rgba(148, 163, 184, 0.8);
        }

        .admin-page select,
        .admin-page textarea,
        .admin-page .input-field {
          width: 100%;
          padding: 0.75rem 1rem;
          border-radius: 10px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(0, 0, 0, 0.3);
          color: #f8fafc;
          font-size: 1rem;
        }

        .admin-page .card {
          background: rgba(15, 23, 42, 0.6);
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: #e2e8f0;
        }

        .admin-page .card h3 {
          color: #f8fafc;
        }

        .btn-primary {
          width: 100%;
          padding: 0.45rem 0.7rem;
          border: none;
          border-radius: 10px;
          background: linear-gradient(135deg, #38bdf8 0%, #3b82f6 100%);
          color: #0f172a;
          font-weight: 600;
          font-size: 0.78rem;
          cursor: pointer;
        }

        .btn-secondary {
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(255, 255, 255, 0.08);
          color: #f8fafc;
          padding: 0.35rem 0.7rem;
          border-radius: 8px;
          font-size: 0.78rem;
          cursor: pointer;
        }

        .btn-danger {
          border: 1px solid rgba(239, 68, 68, 0.6);
          background: rgba(239, 68, 68, 0.15);
          color: #fecaca;
          padding: 0.35rem 0.7rem;
          border-radius: 8px;
          font-size: 0.78rem;
          cursor: pointer;
        }

        .btn-logout {
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(255, 255, 255, 0.08);
          color: #f8fafc;
          padding: 0.35rem 0.7rem;
          border-radius: 8px;
          font-size: 0.78rem;
          cursor: pointer;
        }

        .audit-actions .btn-primary {
          width: auto;
        }

        .games-panel {
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 16px;
          padding: 1.5rem;
        }

        .panel-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 1.5rem;
        }

        .panel-header h2 {
          margin: 0;
          color: #f8fafc;
        }

        .panel-actions {
          display: flex;
          gap: 0.5rem;
          align-items: center;
        }

        .filter-group {
          display: flex;
          flex-wrap: wrap;
          gap: 0.35rem;
        }

        .filter-btn {
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(15, 23, 42, 0.6);
          color: #cbd5f5;
          padding: 0.35rem 0.65rem;
          border-radius: 8px;
          cursor: pointer;
          font-size: 0.75rem;
        }

        .filter-btn.active {
          background: linear-gradient(135deg, #38bdf8 0%, #3b82f6 100%);
          color: #0f172a;
          border-color: transparent;
          font-weight: 600;
        }

        .filter-select {
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(15, 23, 42, 0.6);
          color: #e2e8f0;
          padding: 0.4rem 0.6rem;
          border-radius: 8px;
          font-size: 0.8rem;
        }

        .insights-grid {
          display: grid;
          grid-template-columns: minmax(300px, 1fr) minmax(520px, 2fr);
          gap: 1rem;
          margin-bottom: 1.5rem;
        }

        .insights-column {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .insights-card {
          background: rgba(15, 23, 42, 0.6);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 14px;
          padding: 1rem;
        }

        .insights-card h3 {
          margin: 0 0 0.75rem 0;
          color: #f8fafc;
          font-size: 1rem;
        }

        .insights-chart {
          min-height: 260px;
        }

        .insights-empty {
          color: #94a3b8;
          padding: 1.5rem 0;
          text-align: center;
        }

        .insights-table {
          width: 100%;
          border-collapse: collapse;
        }

        .insights-table th,
        .insights-table td {
          text-align: left;
          padding: 0.5rem 0.25rem;
          border-bottom: 1px solid rgba(148, 163, 184, 0.2);
          color: #e2e8f0;
          font-size: 0.85rem;
        }

        .insights-table th {
          color: #94a3b8;
          font-weight: 600;
        }

        @media (max-width: 1100px) {
          .insights-grid {
            grid-template-columns: 1fr;
          }
        }

        .error-message {
          background: rgba(239, 68, 68, 0.15);
          border: 1px solid rgba(239, 68, 68, 0.3);
          color: #fecaca;
          padding: 0.75rem 1rem;
          border-radius: 10px;
          margin-bottom: 1rem;
        }

        .success-message {
          background: rgba(34, 197, 94, 0.12);
          border: 1px solid rgba(34, 197, 94, 0.35);
          color: #bbf7d0;
          padding: 0.75rem 1rem;
          border-radius: 10px;
          margin-bottom: 1rem;
        }

        .empty-state {
          color: #94a3b8;
          padding: 2rem;
          text-align: center;
        }

        .games-list {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .games-section {
          margin-bottom: 2rem;
        }

        .games-bulk-actions {
          display: flex;
          justify-content: flex-end;
          margin-bottom: 1rem;
        }

        .games-section-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 0.75rem;
          gap: 1rem;
        }

        .games-count {
          color: #94a3b8;
          font-size: 0.7rem;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .game-demand {
          background: rgba(56, 189, 248, 0.12);
          color: #7dd3fc;
          border: 1px solid rgba(56, 189, 248, 0.3);
          padding: 0.2rem 0.6rem;
          border-radius: 999px;
          font-size: 0.75rem;
        }

        .btn-timeline {
          margin-left: 0.5rem;
        }

        .config-library {
          margin-bottom: 1.5rem;
        }

        .config-json {
          background: rgba(15, 23, 42, 0.7);
          border: 1px solid rgba(148, 163, 184, 0.2);
          border-radius: 12px;
          padding: 1rem;
          color: #e2e8f0;
          font-size: 0.75rem;
          line-height: 1.4;
          overflow: auto;
          max-height: 320px;
        }

        .scenario-library {
          margin-bottom: 1.5rem;
        }

        .scenario-list {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 1rem;
        }

        .scenario-card {
          background: rgba(15, 23, 42, 0.6);
          border: 1px solid rgba(148, 163, 184, 0.2);
          border-radius: 12px;
          padding: 0.9rem 1rem;
        }

        .scenario-title {
          color: #f8fafc;
          font-weight: 600;
          margin-bottom: 0.35rem;
        }

        .scenario-desc {
          color: #94a3b8;
          font-size: 0.8rem;
        }

        .scenario-metrics {
          margin-top: 0.5rem;
          color: #cbd5f5;
          font-size: 0.75rem;
          line-height: 1.4;
        }

        .game-card {
          background: rgba(15, 23, 42, 0.7);
          border: 1px solid rgba(148, 163, 184, 0.15);
          border-radius: 14px;
          padding: 1.5rem;
        }

        .game-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1rem;
        }

        .game-title {
          font-size: 1.25rem;
          font-weight: 600;
          color: #f8fafc;
        }

        .game-title-row {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          flex-wrap: wrap;
        }

        .btn-archive {
          padding: 0.25rem 0.6rem;
          font-size: 0.7rem;
        }

        .game-title.clickable {
          cursor: pointer;
          transition: color 0.2s;
        }

        .game-title.clickable:hover {
          color: #38bdf8;
          text-decoration: underline;
        }

        .game-meta {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin-top: 0.35rem;
          flex-wrap: wrap;
        }

        .game-code {
          font-family: 'JetBrains Mono', monospace;
          color: #38bdf8;
          font-size: 0.85rem;
          letter-spacing: 0.1em;
        }

        .game-pin {
          font-family: 'JetBrains Mono', monospace;
          color: #fbbf24;
          font-size: 0.85rem;
          letter-spacing: 0.1em;
        }

        .status-badge {
          padding: 0.2rem 0.6rem;
          border-radius: 999px;
          font-size: 0.7rem;
          text-transform: uppercase;
          font-weight: 600;
        }

        .game-detail {
          font-size: 0.75rem;
          color: #cbd5f5;
          background: rgba(148, 163, 184, 0.12);
          border: 1px solid rgba(148, 163, 184, 0.25);
          padding: 0.15rem 0.5rem;
          border-radius: 999px;
        }

        .status-badge.setup {
          background: rgba(251, 191, 36, 0.2);
          color: #fbbf24;
        }

        .status-badge.active {
          background: rgba(16, 185, 129, 0.2);
          color: #10b981;
        }

        .status-badge.paused {
          background: rgba(248, 113, 113, 0.2);
          color: #f87171;
        }

        .status-badge.completed {
          background: rgba(79, 172, 254, 0.2);
          color: #4facfe;
        }

        .game-rounds {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 0.5rem;
          color: #94a3b8;
          font-size: 0.9rem;
        }

        .btn-recalc {
          font-size: 0.75rem;
          padding: 0.4rem 0.75rem;
        }

        .teams-section {
          margin-top: 1rem;
        }

        .scenario-sequence {
          margin-top: 1rem;
        }

        .sequence-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
          gap: 0.75rem;
        }

        .sequence-card {
          background: rgba(255, 255, 255, 0.04);
          border-radius: 10px;
          padding: 0.75rem;
          border: 1px solid rgba(148, 163, 184, 0.15);
          color: inherit;
          text-align: left;
          cursor: pointer;
        }

        .sequence-card.assumptions {
          border-style: dashed;
        }

        .sequence-card.has-results {
          border-color: rgba(34, 197, 94, 0.6);
          box-shadow: 0 0 0 1px rgba(34, 197, 94, 0.35);
          background: rgba(34, 197, 94, 0.08);
        }

        .sequence-card.no-results {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .sequence-round {
          color: #94a3b8;
          font-size: 0.7rem;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .sequence-name {
          color: #f8fafc;
          font-weight: 600;
          margin-top: 0.25rem;
        }

        .section-title {
          color: #94a3b8;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          font-size: 0.7rem;
          margin-bottom: 0.75rem;
        }

        .team-list {
          display: flex;
          flex-direction: column;
          gap: 0.6rem;
        }

        .team-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: rgba(255, 255, 255, 0.04);
          border-left: 3px solid transparent;
          border-radius: 10px;
          padding: 0.75rem 1rem;
        }

        .team-name {
          color: #f8fafc;
          font-weight: 500;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .team-code {
          font-family: 'JetBrains Mono', monospace;
          color: #38bdf8;
          font-size: 0.8rem;
          letter-spacing: 0.08em;
        }

        .team-pin {
          font-family: 'JetBrains Mono', monospace;
          color: #fbbf24;
          font-size: 0.75rem;
          letter-spacing: 0.08em;
        }

        .audit-actions {
          display: flex;
          gap: 0.5rem;
        }

        .audit-modal {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.8);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 2rem;
          z-index: 1000;
        }

        .audit-modal-card {
          background: #0f172a;
          border: 1px solid rgba(148, 163, 184, 0.2);
          border-radius: 16px;
          width: min(100%, 960px);
          max-height: 90vh;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .audit-modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1rem 1.25rem;
          border-bottom: 1px solid rgba(148, 163, 184, 0.2);
        }

        .audit-modal-body {
          flex: 1;
          overflow: auto;
        }

        .audit-title {
          color: #f8fafc;
          font-weight: 600;
        }

        .audit-subtitle {
          color: #94a3b8;
          font-size: 0.8rem;
        }

        .audit-json {
          padding: 1rem 1.25rem;
          margin: 0;
          overflow: auto;
          max-height: 60vh;
          font-size: 0.75rem;
          line-height: 1.4;
          color: #e2e8f0;
          background: #0b1120;
        }

        .audit-json.claude-audit {
          font-size: 0.8rem;
          line-height: 1.5;
          white-space: pre-wrap;
          word-wrap: break-word;
        }

        .audit-json-view {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          padding: 1rem 1.25rem;
          overflow: auto;
        }

        .audit-json-actions {
          display: flex;
          justify-content: flex-end;
        }

        .timeline-card {
          max-width: 1200px;
        }

        .game-decision-status {
          min-width: 170px;
          display: inline-flex;
          justify-content: center;
        }

        .timeline-table-wrap {
          max-height: 70vh;
          overflow: auto;
          padding: 1rem 0;
        }

        .timeline-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.85rem;
        }

        .timeline-table th,
        .timeline-table td {
          padding: 0.5rem 0.75rem;
          border-bottom: 1px solid rgba(148, 163, 184, 0.2);
          text-align: right;
          white-space: nowrap;
        }

        .timeline-table th:first-child,
        .timeline-table td:first-child {
          text-align: left;
          color: #cbd5f5;
          font-weight: 600;
        }

        .timeline-table .section-label {
          text-align: left;
          font-weight: 700;
          color: #f8fafc;
          background: rgba(148, 163, 184, 0.12);
        }

        .audit-empty {
          padding: 2rem;
          color: #94a3b8;
          font-size: 0.85rem;
        }

        .audit-breakdown {
          padding: 1rem 1.25rem;
          overflow: auto;
          display: flex;
          flex-direction: column;
          gap: 1rem;
          color: #e2e8f0;
          background: #0b1120;
        }

        .audit-section-block h4 {
          margin: 0 0 0.5rem 0;
          font-size: 0.85rem;
          color: #f8fafc;
        }

        .audit-section-block pre {
          margin: 0;
          background: rgba(15, 23, 42, 0.6);
          border: 1px solid rgba(148, 163, 184, 0.15);
          border-radius: 10px;
          padding: 0.75rem;
          font-size: 0.75rem;
          line-height: 1.4;
          overflow: auto;
        }

        .audit-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 0.75rem;
          font-size: 0.75rem;
        }

        .audit-table th,
        .audit-table td {
          padding: 0.5rem;
          border-bottom: 1px solid rgba(148, 163, 184, 0.15);
          text-align: left;
        }

        .audit-table th {
          color: #94a3b8;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          font-size: 0.65rem;
        }

        .consistency-actions {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 0.75rem;
          margin-bottom: 1rem;
        }

        .consistency-meta {
          color: #94a3b8;
          font-size: 0.85rem;
        }

        .consistency-summary {
          margin-top: 1.5rem;
        }

        .consistency-game {
          border: 1px solid rgba(148, 163, 184, 0.2);
          border-radius: 12px;
          padding: 1rem;
          margin-top: 1rem;
          background: rgba(15, 23, 42, 0.35);
        }

        .consistency-game-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
        }

        .consistency-game-title {
          font-weight: 700;
          color: #e2e8f0;
          font-size: 1.05rem;
        }

        .consistency-game-meta {
          color: #94a3b8;
          font-size: 0.85rem;
          margin-top: 0.25rem;
        }

        .consistency-game-actions {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .consistency-table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 0.5rem;
          font-size: 0.85rem;
        }

        .consistency-table th,
        .consistency-table td {
          padding: 0.6rem 0.5rem;
          border-bottom: 1px solid rgba(148, 163, 184, 0.2);
          text-align: left;
        }

        .consistency-table th {
          color: #94a3b8;
          font-weight: 600;
        }

        .summary-table tbody tr {
          cursor: pointer;
          transition: background 0.2s ease;
        }

        .summary-table tbody tr:hover {
          background: rgba(56, 189, 248, 0.08);
        }

        .summary-table .active-row {
          background: rgba(56, 189, 248, 0.18);
        }

        .consistency-issues-row td {
          padding: 0;
          border-bottom: none;
        }

        .consistency-issues-table {
          width: 100%;
          border-collapse: collapse;
          background: rgba(15, 23, 42, 0.35);
          font-size: 0.8rem;
        }

        .consistency-issues-table th,
        .consistency-issues-table td {
          padding: 0.5rem 0.5rem;
          border-bottom: 1px solid rgba(148, 163, 184, 0.15);
          text-align: left;
          vertical-align: top;
        }

        .consistency-issues-table th {
          color: #94a3b8;
          font-weight: 600;
        }

        .consistency-issues-table details {
          cursor: pointer;
        }

        .consistency-issues-table pre {
          margin: 0.35rem 0 0;
          white-space: pre-wrap;
          word-break: break-word;
          color: #e2e8f0;
        }

        .audit-list {
          margin: 0;
          padding-left: 1.1rem;
          color: #cbd5f5;
          font-size: 0.75rem;
        }

        .audit-note {
          color: #94a3b8;
          font-size: 0.7rem;
          margin-top: 0.5rem;
        }

        .audit-trace {
          margin-top: 1rem;
          padding-top: 0.5rem;
          border-top: 1px solid rgba(148, 163, 184, 0.2);
        }

        .audit-trace-title {
          font-weight: 600;
          font-size: 0.85rem;
          margin-bottom: 0.5rem;
          color: #f8fafc;
        }

        .audit-trace-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 0.75rem;
        }

        .audit-trace-section {
          background: rgba(15, 23, 42, 0.6);
          border: 1px solid rgba(148, 163, 184, 0.15);
          border-radius: 10px;
          padding: 0.75rem;
        }

        .audit-trace-heading {
          font-weight: 600;
          font-size: 0.8rem;
          margin-bottom: 0.35rem;
          color: #e2e8f0;
        }

        .audit-trace-formula {
          font-size: 0.7rem;
          color: #94a3b8;
          margin-bottom: 0.5rem;
        }

        .audit-trace-list {
          margin: 0.25rem 0 0 0;
          padding-left: 1.1rem;
          color: #cbd5f5;
          font-size: 0.7rem;
          line-height: 1.4;
        }

        .audit-team-block {
          padding: 0.75rem;
          border: 1px solid rgba(148, 163, 184, 0.12);
          border-radius: 10px;
          background: rgba(15, 23, 42, 0.4);
          margin-bottom: 1rem;
        }

        .audit-team-title {
          font-weight: 600;
          margin-bottom: 0.5rem;
        }

        .ai-tag {
          background: rgba(148, 163, 184, 0.2);
          color: #cbd5f5;
          font-size: 0.65rem;
          padding: 0.1rem 0.4rem;
          border-radius: 6px;
          text-transform: uppercase;
        }

        .copy-btn {
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(255, 255, 255, 0.08);
          color: #e2e8f0;
          padding: 0.35rem 0.75rem;
          border-radius: 8px;
          cursor: pointer;
          font-size: 0.75rem;
        }

        @media (max-width: 720px) {
          .admin-page {
            padding: 1rem;
          }

          .admin-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 1rem;
          }

          .game-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 0.75rem;
          }

          .team-row {
            flex-direction: column;
            align-items: flex-start;
            gap: 0.5rem;
          }
        }
      `}</style>

      {/* Scenario JSON Modal */}
      {scenarioModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '2rem',
          }}
          onClick={() => setScenarioModal(null)}
        >
          <div
            style={{
              background: 'white',
              borderRadius: '12px',
              maxWidth: '900px',
              width: '100%',
              maxHeight: '90vh',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                padding: '1.5rem',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#1e293b' }}>
                  Scenario #{scenarioModal.id}: {scenarioModal.name}
                </h2>
                <p style={{ margin: '0.5rem 0 0 0', color: '#64748b', fontSize: '0.9rem' }}>
                  {scenarioModal.description}
                </p>
              </div>
              <button
                onClick={() => setScenarioModal(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '1.5rem',
                  cursor: 'pointer',
                  color: '#64748b',
                  padding: '0.5rem',
                }}
              >
                ×
              </button>
            </div>
            <div style={{ padding: '1.5rem', overflow: 'auto', flex: 1 }}>
              <pre
                style={{
                  background: '#1e293b',
                  color: '#e2e8f0',
                  padding: '1.5rem',
                  borderRadius: '8px',
                  fontSize: '0.85rem',
                  overflow: 'auto',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  margin: 0,
                }}
              >
                {JSON.stringify(scenarioModal, null, 2)}
              </pre>
            </div>
            <div
              style={{
                padding: '1rem 1.5rem',
                borderTop: '1px solid #e2e8f0',
                display: 'flex',
                gap: '1rem',
                justifyContent: 'flex-end',
              }}
            >
              <button
                onClick={() => {
                  navigator.clipboard.writeText(JSON.stringify(scenarioModal, null, 2))
                    .then(() => alert('Scenario JSON copied to clipboard!'))
                    .catch(() => alert('Failed to copy'))
                }}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  fontWeight: 500,
                }}
              >
                📋 Copy JSON
              </button>
              <button
                onClick={() => setScenarioModal(null)}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: '#e2e8f0',
                  color: '#475569',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  fontWeight: 500,
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Game Config Modal */}
      {configModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '2rem',
          }}
          onClick={() => setConfigModal(null)}
        >
          <div
            style={{
              background: '#0f172a',
              borderRadius: '16px',
              maxWidth: '650px',
              width: '100%',
              maxHeight: '85vh',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                padding: '1.5rem',
                background: 'linear-gradient(to right, #1e293b, #0f172a)',
                borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#f8fafc' }}>
                  Game Configuration
                </h2>
                <p style={{ margin: '0.25rem 0 0 0', color: '#94a3b8', fontSize: '0.85rem' }}>
                  {configModal.name} ({configModal.gameCode})
                </p>
              </div>
              <button
                onClick={() => setConfigModal(null)}
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: 'none',
                  fontSize: '1.25rem',
                  cursor: 'pointer',
                  color: '#94a3b8',
                  padding: '0.5rem',
                  borderRadius: '8px',
                  width: '36px',
                  height: '36px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                ×
              </button>
            </div>

            <div style={{ padding: '1.5rem', overflow: 'auto', flex: 1 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                <div className="modal-config-section">
                  <label style={{ display: 'block', color: '#38bdf8', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem', fontWeight: 700 }}>Basic Info</label>
                  <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                    <div style={{ marginBottom: '0.5rem' }}><span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>PIN:</span> <span style={{ color: '#fbbf24', fontFamily: 'monospace' }}>{configModal.gamePin}</span></div>
                    <div style={{ marginBottom: '0.5rem' }}><span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>Company:</span> <span style={{ color: '#f8fafc' }}>{configModal.companyName || '-'}</span></div>
                    <div style={{ marginBottom: '0.5rem' }}><span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>Industry:</span> <span style={{ color: '#f8fafc' }}>{configModal.industry || 'Oil & Energy'}</span></div>
                    <div><span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>Rounds:</span> <span style={{ color: '#f8fafc' }}>{configModal.totalRounds}</span></div>
                  </div>
                </div>

                <div className="modal-config-section">
                  <label style={{ display: 'block', color: '#38bdf8', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem', fontWeight: 700 }}>Market & Demand</label>
                  <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                    <div style={{ marginBottom: '0.5rem' }}><span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>Demand Mode:</span> <span style={{ color: '#f8fafc' }}>{configModal.marketDemandMode || 'balanced'}</span></div>
                    <div style={{ marginBottom: '0.5rem' }}><span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>Multiplier:</span> <span style={{ color: '#f8fafc' }}>{configModal.marketDemandMultiplier || 1}x</span></div>
                    <div><span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>Created:</span> <span style={{ color: '#f8fafc', fontSize: '0.8rem' }}>{new Date(configModal.createdAt).toLocaleDateString()}</span></div>
                  </div>
                </div>

                <div className="modal-config-section" style={{ gridColumn: '1 / -1' }}>
                  <label style={{ display: 'block', color: '#38bdf8', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem', fontWeight: 700 }}>Regional Labels</label>
                  <div style={{ display: 'flex', gap: '1rem', background: 'rgba(255, 255, 255, 0.03)', padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                    <div><span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>Americas:</span> <span style={{ color: '#f8fafc' }}>{configModal.regionLabels?.us || 'Americas'}</span></div>
                    <div><span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>Asia:</span> <span style={{ color: '#f8fafc' }}>{configModal.regionLabels?.asia || 'Asia'}</span></div>
                    <div><span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>Europe:</span> <span style={{ color: '#f8fafc' }}>{configModal.regionLabels?.europe || 'Europe'}</span></div>
                  </div>
                </div>

                <div className="modal-config-section" style={{ gridColumn: '1 / -1' }}>
                  <label style={{ display: 'block', color: '#38bdf8', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem', fontWeight: 700 }}>Teams ({configModal.teams?.length || 0})</label>
                  <div style={{ background: 'rgba(255, 255, 255, 0.03)', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.05)', overflow: 'hidden' }}>
                    {configModal.teams?.map((team, idx) => (
                      <div key={team.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0.75rem', borderBottom: idx === configModal.teams.length - 1 ? 'none' : '1px solid rgba(255, 255, 255, 0.05)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: team.color }}></div>
                          <span style={{ color: '#f8fafc', fontSize: '0.9rem' }}>{team.name}</span>
                        </div>
                        <div style={{ color: '#94a3b8', fontSize: '0.8rem', fontFamily: 'monospace' }}>{team.teamCode} | {team.teamPin}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="modal-config-section" style={{ gridColumn: '1 / -1' }}>
                  <label style={{ display: 'block', color: '#38bdf8', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem', fontWeight: 700 }}>Settings</label>
                  <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      <div>
                        <div style={{ marginBottom: '0.5rem' }}><span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>Timezone:</span> <span style={{ color: '#f8fafc' }}>{configModal.timezone || 'Pacific/Auckland'}</span></div>
                        <div><span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>Round Deadline:</span> <span style={{ color: '#f8fafc' }}>{configModal.hoursPerRound ? `${configModal.hoursPerRound} hours` : 'No limit'}</span></div>
                      </div>
                      <div>
                        <div style={{ marginBottom: '0.5rem' }}>
                          <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>Capacity per Plant:</span>{' '}
                          <span style={{ color: '#f8fafc' }}>
                            {configModal.capacityPerFactory ? configModal.capacityPerFactory.toLocaleString() : 'Default (500)'}
                          </span>
                        </div>
                        {configModal.regionDemandSplit && (
                          <div>
                            <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>Demand Split:</span>
                            <div style={{ fontSize: '0.75rem', color: '#f8fafc', marginTop: '0.2rem' }}>
                              US: {configModal.regionDemandSplit.us * 100}% | Asia: {configModal.regionDemandSplit.asia * 100}% | EU: {configModal.regionDemandSplit.europe * 100}%
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div
              style={{
                padding: '1rem 1.5rem',
                borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                display: 'flex',
                justifyContent: 'flex-end',
                background: 'rgba(255, 255, 255, 0.02)',
              }}
            >
              <button
                onClick={() => setConfigModal(null)}
                style={{
                  padding: '0.6rem 1.5rem',
                  background: '#334155',
                  color: '#f8fafc',
                  border: 'none',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  transition: 'background 0.2s',
                }}
                onMouseOver={(e) => e.currentTarget.style.background = '#475569'}
                onMouseOut={(e) => e.currentTarget.style.background = '#334155'}
              >
                Close Configuration
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
