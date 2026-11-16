import { useState, useEffect, Fragment, useRef, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useTheme } from '../context/ThemeContext'
import { educatorApi, gameApi, authApi, tournamentApi } from '../api/client'
import type { EducatorMiniGameSession } from '../api/client'
import { useGame } from '../context/GameContext'
import { SidebarFooter } from '../components/SidebarFooter'
import { MINI_GAME_LIBRARY } from '../features/minigames/catalog'
import { MiniGameSvg } from '../features/minigames/MiniGameSvg'
import { educatorMiniGamesApi } from '../features/minigames/api'

import {
  DEFAULT_COMPANY_NAMES,
  DEFAULT_DEMAND_MULTIPLIERS,
  generateRandomGameName,
  getGameConfigForIndustry,
  TEAM_NAMES,
  INDUSTRIES
} from '../utils/gameCreationHelpers'
import { calculateRoundMinus1, getBalancedStartingFinancials } from '../engine/gameEngine'
import { calculateStartingFinancials } from '../utils/financialCalculations'
import { FinancialReport } from '../components/FinancialReport'
import type { FinancialTeamRow } from '../components/FinancialStatements'
import { normalizeTeamRow } from '../utils/normalizeTeamRow'
import type { TeamRow } from '../utils/normalizeTeamRow'
import { getRegionLabels } from '../utils/regionLabels'
import { MarketEconomicsSection } from '../components/MarketEconomicsSection'
import './DashboardModernPage.css'
import './DecisionsModernPage.css'

const NAV_CATEGORIES = [
  {
    id: 'business-sim',
    label: '💼 Business Simulation',
    items: [
      { id: 'games', label: 'My Games', path: '/educator-dashboard' },
      { id: 'tournaments', label: 'Tournaments', path: '/educator-dashboard/tournaments', beta: true },
      { id: 'strategy-lab', label: 'Strategy Lab', path: '/strategy-lab', beta: true },
      { id: 'student-strategy-lab', label: 'Student Strategy Lab', path: '/student-strategy-lab', beta: true },
      { id: 'weights-lab', label: 'Weights Lab', path: '/weights-lab', external: true },
    ]
  },
  {
    id: 'mini-games',
    label: '🎮 Mini Games',
    items: [
      { id: 'mini-game-sessions', label: 'Classroom Experiments', path: '/educator-dashboard', scrollTo: 'mini-game-sessions' },
    ]
  },
  {
    id: 'teaching-tools',
    label: '🎓 Teaching Tools',
    items: [
      { id: 'teaching-material', label: 'Teaching Material', path: '/educator-dashboard', scrollTo: 'teaching-material' },
      { id: 'minsky-lab', label: 'Minsky Economic Modeler', path: '/minsky-lab', external: true, beta: true },
    ]
  },
]

import EMAIL_TEMPLATES from '../data/emailTemplates.json'

const DEFAULT_REGION_SPLIT = { us: 0.22, asia: 0.60, europe: 0.18 }
const PREF_KEYS = ['priceWeight', 'qualityWeight', 'featuresWeight', 'promotionWeight', 'csrWeight', 'trainingWeight'] as const
type PrefKey = typeof PREF_KEYS[number]
type RegionKey = 'us' | 'asia' | 'europe'
type RegionPreferences = Record<RegionKey, Record<PrefKey, number>>
type GrowthWeights = { capacity: number; share: number; brand: number; cash: number }
const GROWTH_KEYS: Array<keyof GrowthWeights> = ['capacity', 'share', 'brand', 'cash']

const cloneRegionPreferences = (prefs: RegionPreferences): RegionPreferences => ({
  us: { ...prefs.us },
  asia: { ...prefs.asia },
  europe: { ...prefs.europe },
})

const normalizeWeights = (weights: Record<string, number>) => {
  const sum = Object.values(weights).reduce((acc, value) => acc + value, 0)
  if (sum <= 0) return weights
  const normalized: Record<string, number> = {}
  Object.entries(weights).forEach(([key, value]) => {
    normalized[key] = value / sum
  })
  return normalized
}

export function EducatorDashboardPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { theme, toggleTheme } = useTheme()
  const { game: contextGame } = useGame()
  const [games, setGames] = useState<unknown[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showCreateGame, setShowCreateGame] = useState(false)
  const [showCreateMiniGame, setShowCreateMiniGame] = useState(false)
  const [showAddGame, setShowAddGame] = useState(false)
  const [showTeachingMaterial, setShowTeachingMaterial] = useState(false)
  const [teachingGameId, setTeachingGameId] = useState('')
  const [teachingTeamId, setTeachingTeamId] = useState('')
  const [teachingLoading, setTeachingLoading] = useState(false)
  const [teachingError, setTeachingError] = useState('')
  const [sessionOpen, setSessionOpen] = useState(false)
  const [expandedGameIds, setExpandedGameIds] = useState<Set<string>>(new Set())
  const [teamLoginLoadingId, setTeamLoginLoadingId] = useState<string | null>(null)
  const [selectedFinancialRounds, setSelectedFinancialRounds] = useState<Record<string, number>>({})
  const [expandedFinancialReports, setExpandedFinancialReports] = useState<Record<string, boolean>>({})
  const [gameResults, setGameResults] = useState<Record<string, unknown[]>>({})
  const [educatorProfile, setEducatorProfile] = useState<{ credits: number; email: string; role: string } | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  const [activeTeamTabIndex, setActiveTeamTabIndex] = useState(0)
  const [copyStatus, setCopyStatus] = useState('')
  const [expandedNavCategories, setExpandedNavCategories] = useState<Set<string>>(new Set(['business-sim', 'mini-games', 'teaching-tools']))
  const [activeContentSection, setActiveContentSection] = useState<'simulations' | 'mini-games'>('simulations')
  const [miniGameSessions, setMiniGameSessions] = useState<EducatorMiniGameSession[]>([])
  const [, setMiniGameCreateMsg] = useState('')
  const [miniGameListLoading, setMiniGameListLoading] = useState(false)
  const [miniGameLinksLoadingId, setMiniGameLinksLoadingId] = useState<string | null>(null)
  const [expandedMiniGameSessionId, setExpandedMiniGameSessionId] = useState<string | null>(null)
  const [miniGameLinksBySession, setMiniGameLinksBySession] = useState<Record<string, {
    hostLink: string
    joinByCodeLink?: string
    roomCode?: string | null
    links: Array<{ teamLabel: string; playLink: string }>
  }>>({})
  const accountMenuRef = useRef<HTMLButtonElement>(null)

  // Advanced Create Game State
  const [gameName, setGameName] = useState(generateRandomGameName())
  const [companyName, setCompanyName] = useState(DEFAULT_COMPANY_NAMES['Oil & Energy'])
  const [companyNameTouched] = useState(false)
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
  const [showAdvancedEngineConfig, setShowAdvancedEngineConfig] = useState(false)
  const [teamCount, setTeamCount] = useState(4)
  const [teams, setTeams] = useState<Array<{ name: string; isAI: boolean; aiDifficulty: 'easy' | 'medium' | 'hard' }>>(
    TEAM_NAMES.slice(0, 4).map(name => ({ name, isAI: false, aiDifficulty: 'medium' }))
  )
  const [gameCreationMsg, setGameCreationMsg] = useState('')
  const [engineConfigError, setEngineConfigError] = useState('')
  const [createdGameInfo, setCreatedGameInfo] = useState<{
    gameCode: string
    gamePin: string
    teams: Array<{ name: string; teamCode: string; teamPin: string }>
  } | null>(null)

  const baseEngineConfig = useMemo(
    () => getGameConfigForIndustry(industry, { capacityPerPlant }),
    [industry, capacityPerPlant]
  )
  const [baselinePrices, setBaselinePrices] = useState<Record<RegionKey, number>>({
    us: baseEngineConfig.priceDemand.baselinePriceByRegion.us,
    asia: baseEngineConfig.priceDemand.baselinePriceByRegion.asia,
    europe: baseEngineConfig.priceDemand.baselinePriceByRegion.europe,
  })
  const [marketPreferences, setMarketPreferences] = useState<RegionPreferences>(
    cloneRegionPreferences(baseEngineConfig.marketPreferences as RegionPreferences)
  )
  const [growthPremiumWeights, setGrowthPremiumWeights] = useState<GrowthWeights>({
    capacity: baseEngineConfig.financial.growthPremiumWeights.capacity,
    share: baseEngineConfig.financial.growthPremiumWeights.share,
    brand: baseEngineConfig.financial.growthPremiumWeights.brand,
    cash: baseEngineConfig.financial.growthPremiumWeights.cash,
  })

  // Tournament State
  const [tournaments, setTournaments] = useState<unknown[]>([])
  const [showCreateTournament, setShowCreateTournament] = useState(false)
  const [tournamentName, setTournamentName] = useState('')
  const [tournamentTeams, setTournamentTeams] = useState<Array<{ name: string; isAI: boolean }>>(
    Array.from({ length: 16 }, (_, i) => ({ name: `Team ${i + 1}`, isAI: false }))
  )
  const [tournamentIndustry, setTournamentIndustry] = useState('Electronics')
  const [tournamentRounds, setTournamentRounds] = useState(3)
  const [tournamentTimeLimit, setTournamentTimeLimit] = useState<number>(1)
  const [tournamentLoading, setTournamentLoading] = useState(false)
  const [expandedTournamentId, setExpandedTournamentId] = useState<string | null>(null)
  const [showArchivedTournaments, setShowArchivedTournaments] = useState(false)
  const [currentTime, setCurrentTime] = useState(new Date())

  // Update current time every 30 seconds for countdown display
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date())
    }, 30000) // Update every 30 seconds
    return () => clearInterval(interval)
  }, [])

  const loadTournaments = async () => {
    setTournamentLoading(true)
    try {
      const { tournaments } = await tournamentApi.list()
      setTournaments(tournaments)
    } catch (e) {
      console.error(e)
    } finally {
      setTournamentLoading(false)
    }
  }

  useEffect(() => {
    if (location.pathname.includes('/tournaments')) {
      loadTournaments()
    }
  }, [location.pathname])

  const handleCreateTournament = async (e: React.FormEvent) => {
    e.preventDefault()
    if (tournamentTeams.some(t => !t.name.trim())) {
      alert('All 16 team names are required.')
      return
    }
    setTournamentLoading(true)
    try {
      await tournamentApi.create(tournamentName, tournamentTeams.map(t => t.name), {
        industry: tournamentIndustry,
        totalRounds: tournamentRounds,
        hoursPerRound: tournamentTimeLimit
      })
      setShowCreateTournament(false)
      setTournamentName('')
      setTournamentTeams(Array.from({ length: 16 }, (_, i) => ({ name: `Team ${i + 1}`, isAI: false })))
      setTournamentIndustry('Electronics')
      setTournamentRounds(3)
      setTournamentTimeLimit(1)
      loadTournaments()
      loadProfile()
      alert('Tournament created!')
    } catch (err: unknown) {
      alert(err.message || 'Failed')
    } finally {
      setTournamentLoading(false)
    }
  }

  const handleCreateFinal = async (id: string, name: string) => {
    if (!confirm(`Create final round for ${name}?`)) return
    try {
      await tournamentApi.createFinal(id)
      loadTournaments()
      alert('Final round created!')
    } catch (e: unknown) {
      alert(e.message || 'Failed')
    }
  }

  const handleLoginAsTeam = async (team: unknown) => {
    if (team?.isComputer) return
    if (!team?.teamCode || !team?.teamPin) {
      alert('Missing team code or PIN for this team.')
      return
    }
    setTeamLoginLoadingId(team.id)
    try {
      const params = new URLSearchParams({
        teamCode: String(team.teamCode),
        teamPin: String(team.teamPin),
        autologin: '1',
      })
      const loginUrl = `${window.location.origin}/team-login?${params.toString()}`
      const popup = window.open(loginUrl, '_blank', 'noopener,noreferrer')
      if (!popup) {
        alert('Popup blocked. Please allow popups for this site and try again.')
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to login as team')
    } finally {
      setTeamLoginLoadingId(null)
    }
  }

  useEffect(() => {
    if (companyNameTouched) return
    setCompanyName(DEFAULT_COMPANY_NAMES[industry] || companyName)
  }, [industry, companyNameTouched])

  useEffect(() => {
    if (capacityPerPlantTouched) return
    setCapacityPerPlant(getGameConfigForIndustry(industry).capacityPerPlant)
  }, [industry, capacityPerPlantTouched])

  useEffect(() => {
    setBaselinePrices({
      us: baseEngineConfig.priceDemand.baselinePriceByRegion.us,
      asia: baseEngineConfig.priceDemand.baselinePriceByRegion.asia,
      europe: baseEngineConfig.priceDemand.baselinePriceByRegion.europe,
    })
    setMarketPreferences(cloneRegionPreferences(baseEngineConfig.marketPreferences as RegionPreferences))
    setGrowthPremiumWeights({
      capacity: baseEngineConfig.financial.growthPremiumWeights.capacity,
      share: baseEngineConfig.financial.growthPremiumWeights.share,
      brand: baseEngineConfig.financial.growthPremiumWeights.brand,
      cash: baseEngineConfig.financial.growthPremiumWeights.cash,
    })
    setEngineConfigError('')
  }, [baseEngineConfig])

  const handleTeamCountChange = (count: number) => {
    setTeamCount(count)
    const newTeams = [...teams]
    while (newTeams.length < count) {
      newTeams.push({ name: TEAM_NAMES[newTeams.length] || `Team ${newTeams.length + 1}`, isAI: false, aiDifficulty: 'medium' })
    }
    setTeams(newTeams.slice(0, count))
  }
  // Add game state
  const [addGameCode, setAddGameCode] = useState('')
  const [addGamePin, setAddGamePin] = useState('')
  const [addGameMsg, setAddGameMsg] = useState('')

  const activeGames = games.filter(g => g.status !== 'COMPLETED' && g.status !== 'ARCHIVED')
  const archivedGames = games
    .filter(g => g.status === 'COMPLETED' || g.status === 'ARCHIVED')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  const teachingGame = useMemo(
    () => archivedGames.find((g) => g.id === teachingGameId) ?? null,
    [archivedGames, teachingGameId]
  )

  const teachingModel = useMemo(() => {
    if (!teachingGameId) return null
    const raw = gameResults[teachingGameId]
    if (!raw || raw.length === 0) return null

    const selectedGame = teachingGame ?? games.find((g) => g.id === teachingGameId) ?? null
    const roundsMap = new Map<number, { roundNumber: number; teams: TeamRow[]; marketDemand?: { us: number; asia: number; europe: number } }>()

    raw.forEach((entry: unknown) => {
      const roundNumber = Number(entry.roundNumber)
      if (!Number.isFinite(roundNumber)) return

      const teamId = entry.team?.id ?? entry.teamId
      const teamFromGame = selectedGame?.teams?.find((t: unknown) => t.id === teamId)
      const teamName = teamFromGame?.name ?? entry.team?.name ?? entry.teamName ?? 'Team'
      const normalized = normalizeTeamRow(
        { ...entry, teamId, teamName },
        teamName,
        entry.fullResults?.marketDemand ?? null,
        100,
        1,
      )

      const existing = roundsMap.get(roundNumber) ?? {
        roundNumber,
        teams: [],
      }
      existing.teams.push(normalized)
      if (!existing.marketDemand && entry.fullResults?.marketDemand) {
        existing.marketDemand = entry.fullResults.marketDemand
      }
      roundsMap.set(roundNumber, existing)
    })

    const allRounds = Array.from(roundsMap.values()).sort((a, b) => a.roundNumber - b.roundNumber)
    if (allRounds.length === 0) return null

    const selectedRound = allRounds[allRounds.length - 1]
    const currentTeamData = selectedRound.teams.find((t) => t.teamId === teachingTeamId) ?? selectedRound.teams[0] ?? null
    const labels = getRegionLabels(selectedGame ?? {})

    return {
      allRounds,
      selectedRound: selectedRound.roundNumber,
      currentTeamData,
      regionLabels: labels,
      teamOptions: selectedRound.teams.map((t) => ({ teamId: t.teamId, teamName: t.teamName })),
    }
  }, [gameResults, games, teachingGame, teachingGameId, teachingTeamId])

  useEffect(() => {
    loadGames()
  }, [])

  useEffect(() => {
    if (!showTeachingMaterial) return
    if (teachingGameId) return
    if (archivedGames.length === 0) return
    setTeachingGameId(archivedGames[0].id)
  }, [showTeachingMaterial, teachingGameId, archivedGames])

  useEffect(() => {
    if (!showTeachingMaterial || !teachingGameId) return
    if (gameResults[teachingGameId]) return

    let cancelled = false
    setTeachingLoading(true)
    setTeachingError('')

    educatorApi.getGameResults(teachingGameId)
      .then(({ results }) => {
        if (cancelled) return
        setGameResults(prev => ({ ...prev, [teachingGameId]: Array.isArray(results) ? results : [] }))
      })
      .catch((err) => {
        if (cancelled) return
        setTeachingError(err instanceof Error ? err.message : 'Failed to load teaching data')
      })
      .finally(() => {
        if (!cancelled) setTeachingLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [showTeachingMaterial, teachingGameId, gameResults])

  useEffect(() => {
    if (!teachingModel) return
    const hasTeam = teachingModel.teamOptions.some((team) => team.teamId === teachingTeamId)
    if (!hasTeam && teachingModel.teamOptions.length > 0) {
      setTeachingTeamId(teachingModel.teamOptions[0].teamId)
    }
  }, [teachingModel, teachingTeamId])

  const toggleFinancialReport = async (gameId: string) => {
    const isCurrentlyExpanded = expandedFinancialReports[gameId] ?? false
    if (isCurrentlyExpanded) {
      setExpandedFinancialReports(prev => ({ ...prev, [gameId]: false }))
      return
    }
    // Fetch results on first expand
    if (!gameResults[gameId]) {
      try {
        const { results } = await educatorApi.getGameResults(gameId)
        // Merge fullResults into game teams for the financial report
        setGames(prev => prev.map(g => {
          if (g.id !== gameId) return g
          const resultsByTeam = new Map<string, unknown[]>()
          results.forEach((r: unknown) => {
            const tid = r.team?.id ?? r.teamId
            if (!resultsByTeam.has(tid)) resultsByTeam.set(tid, [])
            resultsByTeam.get(tid)!.push(r)
          })
          return {
            ...g,
            teams: g.teams.map((t: unknown) => ({
              ...t,
              results: resultsByTeam.get(t.id) ?? t.results,
            })),
          }
        }))
        setGameResults(prev => ({ ...prev, [gameId]: results }))
      } catch (err) {
        console.error('Failed to fetch game results:', err)
        return
      }
    }
    setExpandedFinancialReports(prev => ({ ...prev, [gameId]: true }))
  }

  const loadGames = async () => {
    setLoading(true)
    try {
      const { games: data } = await educatorApi.listMyGames()
      setGames(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load games')
    } finally {
      setLoading(false)
    }
  }

  const loadMiniGameSessions = async () => {
    setMiniGameListLoading(true)
    try {
      const sessions = await educatorMiniGamesApi.listSessions()
      setMiniGameSessions(sessions)
    } catch (err) {
      console.error('Failed to load mini-game sessions', err)
    } finally {
      setMiniGameListLoading(false)
    }
  }

  const loadProfile = async () => {
    try {
      const res = (await authApi.me('educator')) as unknown
      if (res.success && (res.role === 'educator' || res.role === 'admin')) {
        setEducatorProfile({
          credits: res.credits ?? 0,
          email: res.email,
          role: res.role
        })
      }
    } catch (err) {
      console.error("Failed to load profile", err)
    }
  }

  useEffect(() => {
    loadProfile()
  }, [])

  useEffect(() => {
    if (!showCreateMiniGame) return
    setActiveContentSection('mini-games')
    void loadMiniGameSessions()
    setTimeout(() => document.getElementById('mini-game-sessions')?.scrollIntoView({ behavior: 'smooth' }), 50)
  }, [showCreateMiniGame])

  useEffect(() => {
    if (location.pathname.includes('/tournaments')) return
    void loadMiniGameSessions()
  }, [location.pathname])

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

  const marketPreferenceSums = useMemo(() => ({
    us: PREF_KEYS.reduce((sum, key) => sum + (marketPreferences.us[key] ?? 0), 0),
    asia: PREF_KEYS.reduce((sum, key) => sum + (marketPreferences.asia[key] ?? 0), 0),
    europe: PREF_KEYS.reduce((sum, key) => sum + (marketPreferences.europe[key] ?? 0), 0),
  }), [marketPreferences])
  const growthWeightSum = useMemo(
    () => growthPremiumWeights.capacity + growthPremiumWeights.share + growthPremiumWeights.brand + growthPremiumWeights.cash,
    [growthPremiumWeights]
  )
  const configOverrides = useMemo(() => ({
    priceDemand: {
      baselinePriceByRegion: {
        us: baselinePrices.us,
        asia: baselinePrices.asia,
        europe: baselinePrices.europe,
      },
    },
    marketPreferences: {
      us: { ...marketPreferences.us },
      asia: { ...marketPreferences.asia },
      europe: { ...marketPreferences.europe },
    },
    financial: {
      growthPremiumWeights: {
        ...growthPremiumWeights,
      },
    },
  }), [baselinePrices, marketPreferences, growthPremiumWeights])

  const effectiveConfigPreview = useMemo(() => {
    const merged: unknown = JSON.parse(JSON.stringify(baseEngineConfig))
    merged.priceDemand.baselinePriceByRegion = { ...configOverrides.priceDemand.baselinePriceByRegion }
    merged.marketPreferences = cloneRegionPreferences(configOverrides.marketPreferences as RegionPreferences)
    merged.financial.growthPremiumWeights = { ...configOverrides.financial.growthPremiumWeights }
    return merged
  }, [baseEngineConfig, configOverrides])

  const configPreview = JSON.stringify(effectiveConfigPreview, null, 2)

  const [advancingGameId, setAdvancingGameId] = useState<string | null>(null)
  const [advanceSuccess, setAdvanceSuccess] = useState<string | null>(null)

  const handleQuickAdvance = async (game: unknown) => {
    if (advancingGameId) return

    const isFinalRound = game.currentRound >= game.totalRounds
    const confirmMsg = isFinalRound
      ? `Finalize "${game.name}" and generate final results?`
      : `Are you sure you want to advance "${game.name}" to the next round?`
    if (!window.confirm(confirmMsg)) return

    setAdvancingGameId(game.id)
    try {
      await gameApi.advance(game.id)
      loadGames() // Refresh list to show new round status
      loadTournaments() // Refresh tournaments to show new round status

      // Show success message
      const successMsg = isFinalRound ? `"${game.name}" finalized successfully!` : `"${game.name}" advanced to Round ${game.currentRound + 1}!`
      setAdvanceSuccess(successMsg)
      setTimeout(() => setAdvanceSuccess(null), 3000)
    } catch (err: unknown) {
      // Handle unsubmitted teams warning if available in error
      const msg = err?.response?.data?.message || err.message || 'Failed to advance'
      if (err?.response?.data?.unsubmittedTeams) {
        if (window.confirm(`Cannot advance: Teams have not submitted: ${err.response.data.unsubmittedTeams.join(', ')}\n\nForce advance anyway? (Default decisions will be used for missing teams)`)) {
          try {
            await gameApi.advance(game.id, true)
            loadGames()
            loadTournaments()

            // Show success message for force advance
            const successMsg = isFinalRound ? `"${game.name}" finalized successfully (forced)!` : `"${game.name}" advanced to Round ${game.currentRound + 1} (forced)!`
            setAdvanceSuccess(successMsg)
            setTimeout(() => setAdvanceSuccess(null), 3000)
          } catch (forceErr: unknown) {
            alert(`Force advance failed: ${forceErr.message}`)
          }
        }
      } else {
        alert(`Error: ${msg}`)
      }
    } finally {
      setAdvancingGameId(null)
    }
  }

  const handleCreateGame = async (e: React.FormEvent) => {
    e.preventDefault()
    setGameCreationMsg('')
    setEngineConfigError('')

    for (const region of ['us', 'asia', 'europe'] as const) {
      const value = Number(baselinePrices[region])
      const min = Number(baseEngineConfig?.priceDemand?.minPriceByRegion?.[region])
      const max = Number(baseEngineConfig?.priceDemand?.maxPriceByRegion?.[region])
      if (!Number.isFinite(value) || value <= 0) {
        setEngineConfigError(`Baseline ${region.toUpperCase()} price must be a positive number.`)
        return
      }
      if (Number.isFinite(min) && value < min) {
        setEngineConfigError(`Baseline ${region.toUpperCase()} price must be >= ${min}.`)
        return
      }
      if (Number.isFinite(max) && value > max) {
        setEngineConfigError(`Baseline ${region.toUpperCase()} price must be <= ${max}.`)
        return
      }
    }

    for (const region of ['us', 'asia', 'europe'] as const) {
      const sum = marketPreferenceSums[region]
      if (Math.abs(sum - 1) > 0.001) {
        setEngineConfigError(`${region.toUpperCase()} market preference weights must sum to 1.00.`)
        return
      }
    }

    if (growthWeightSum < 0.1 || growthWeightSum > 1.0) {
      setEngineConfigError('Growth premium weights must sum between 0.10 and 1.00.')
      return
    }

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
        configOverrides,
        timezone,
        regionLabels,
        teams: teams.slice(0, teamCount).map(t => ({
          name: t.name,
          isAI: t.isAI,
          aiDifficulty: t.isAI ? t.aiDifficulty : undefined
        }))
      })

      setGameCreationMsg(`Game created! Code: ${result.game.gameCode}, PIN: ${result.game.gamePin}`)
      if (typeof result.creditsRemaining === 'number') {
        setEducatorProfile((prev) => (prev ? { ...prev, credits: result.creditsRemaining as number } : prev))
      }
      setCreatedGameInfo({
        gameCode: result.game.gameCode,
        gamePin: result.game.gamePin,
        teams: result.game.teams.map((team) => ({
          name: team.name,
          teamCode: team.teamCode,
          teamPin: team.teamPin,
        })),
      })
      setActiveTeamTabIndex(0)

      // Reset form defaults
      setGameName(generateRandomGameName())
      // Keep industry and other settings as per last choice for convenience, or reset? Let's keep them.

      // Refresh list
      loadGames()
      loadProfile()
    } catch (err) {
      setGameCreationMsg(`Error: ${err instanceof Error ? err.message : 'Failed to create game'}`)
    } finally {
      setLoading(false)
    }
  }

  const handleLoadMiniGameLinks = async (session: EducatorMiniGameSession) => {
    if (expandedMiniGameSessionId === session.id) {
      setExpandedMiniGameSessionId(null)
      return
    }

    const existing = miniGameLinksBySession[session.id]
    if (existing) {
      setExpandedMiniGameSessionId(session.id)
      return
    }

    setMiniGameLinksLoadingId(session.id)
    try {
      const { session: latest, links } = await educatorMiniGamesApi.getSessionLinks(session.id)
      setMiniGameLinksBySession((prev) => ({
        ...prev,
        [session.id]: {
          hostLink: latest.hostLink,
          joinByCodeLink: latest.joinByCodeLink,
          roomCode: latest.roomCode,
          links: links.map((link) => ({ teamLabel: link.teamLabel, playLink: link.playLink })),
        },
      }))
      setExpandedMiniGameSessionId(session.id)
      setMiniGameCreateMsg(`Loaded links for ${latest.title || latest.gameType}`)
    } catch (err) {
      setMiniGameCreateMsg(`Error: ${err instanceof Error ? err.message : 'Failed to load links'}`)
    } finally {
      setMiniGameLinksLoadingId(null)
    }
  }

  const handleAddExistingGame = async (e: React.FormEvent) => {
    e.preventDefault()
    setAddGameMsg('')
    setLoading(true)

    try {
      const { message, credits } = await educatorApi.addExistingGame(addGameCode, addGamePin)
      setAddGameMsg(`✓ ${message}`)
      if (typeof credits === 'number') {
        setEducatorProfile((prev) => (prev ? { ...prev, credits } : prev))
      }
      setCreatedGameInfo(null)
      setAddGameCode('')
      setAddGamePin('')
      setShowAddGame(false)
      loadGames()
    } catch (err) {
      setAddGameMsg(`✗ ${err instanceof Error ? err.message : 'Failed to add game'}`)
    } finally {
      setLoading(false)
    }
  }

  const handleResetPin = async () => {
    const newPin = prompt('Enter new PIN (minimum 4 characters):')
    if (!newPin || newPin.length < 4) {
      alert('PIN must be at least 4 characters')
      return
    }

    try {
      await educatorApi.updateMyPin(newPin)
      alert('PIN updated successfully! Please use it on your next login.')
    } catch (err) {
      alert(`Failed to update PIN: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  const buildTeamShareText = () => {
    if (!createdGameInfo) return ''
    const header = `Game Code: ${createdGameInfo.gameCode}\nGame PIN: ${createdGameInfo.gamePin}`
    const lines = createdGameInfo.teams.map(
      (team, index) => `${index + 1}. ${team.name} - Code: ${team.teamCode} | PIN: ${team.teamPin}`
    )
    return [header, '', 'Teams:', ...lines].join('\n')
  }

  const buildTeamEmail = (team: unknown) => {
    if (!team) return ''
    const loginUrl = window.location.origin + '/team-login'
    const subject = EMAIL_TEMPLATES.teamInvitation.subject.replace(/{{teamName}}/g, team.name)
    const body = EMAIL_TEMPLATES.teamInvitation.body
      .replace(/{{teamName}}/g, team.name)
      .replace(/{{teamCode}}/g, team.teamCode)
      .replace(/{{teamPin}}/g, team.teamPin)
      .replace(/{{loginUrl}}/g, loginUrl)

    return `Subject: ${subject}\n\n${body}`
  }

  const handleLogout = async () => {
    await authApi.logout('educator')
    navigate('/educator-login')
  }

  // Helper: Check if current user is admin (bypass credit checks)
  const isAdmin = educatorProfile?.role === 'admin'
  const hasCredits = isAdmin || (educatorProfile?.credits ?? 0) >= 1

  const handleStartGame = async (gameId: string) => {
    if (!confirm('Start the game? This will release the first scenario to teams.')) return
    try {
      await gameApi.start(gameId)
      alert('Game started!')
      window.location.reload()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to start game')
    }
  }


  const handleArchiveGame = async (gameId: string, gameName: string) => {
    if (!confirm(`Are you sure you want to archive "${gameName}"? It will be moved to the Archived section.`)) return
    try {
      await gameApi.archive(gameId)
      loadGames()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to archive game')
    }
  }

  const handleUnarchiveGame = async (gameId: string, gameName: string) => {
    if (!confirm(`Restoring "${gameName}" to active list?`)) return
    try {
      await gameApi.unarchive(gameId)
      loadGames()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to unarchive game')
    }
  }



  return (
    <div className="decisions-modern dashboard-modern-scoped">
      <div className="dm-shell">
        <aside className="dm-sidebar">
          {/* ... sidebar ... */}
          <div className="dm-company">
            <div className="dm-company-logo">🎓</div>
            <div>
              <div className="dm-company-name">Educator Portal</div>
              <div className="dm-company-meta">Simulation Management</div>
            </div>
          </div>

          <nav className="dm-nav">
            {NAV_CATEGORIES.map((category) => (
              <div key={category.id} className="dm-nav-category">
                <button
                  type="button"
                  className="dm-nav-category-header"
                  onClick={() => {
                    const newExpanded = new Set(expandedNavCategories)
                    if (newExpanded.has(category.id)) {
                      newExpanded.delete(category.id)
                    } else {
                      newExpanded.add(category.id)
                    }
                    setExpandedNavCategories(newExpanded)
                  }}
                >
                  <span className="dm-nav-category-label">{category.label}</span>
                  <span className="dm-nav-category-chevron">
                    {expandedNavCategories.has(category.id) ? '▼' : '▶'}
                  </span>
                </button>
                {expandedNavCategories.has(category.id) && (
                  <div className="dm-nav-category-items">
                    {category.items.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className={`dm-nav-item ${location.pathname === item.path && !item.scrollTo ? 'active' : ''}`}
                        onClick={() => {
                          if (item.external) {
                            window.open(item.path, '_blank')
                            return
                          }
                          navigate(item.path)
                          setShowCreateGame(false)
                          setShowCreateMiniGame(false)
                          setShowAddGame(false)
                          if (item.id === 'teaching-material') {
                            setShowTeachingMaterial(true)
                          }
                          if (item.id === 'games') {
                            setActiveContentSection('simulations')
                            setTimeout(() => document.getElementById('my-simulations')?.scrollIntoView({ behavior: 'smooth' }), 50)
                          }
                          if (item.id === 'mini-game-sessions') {
                            setActiveContentSection('mini-games')
                          }
                          if (item.scrollTo) {
                            setTimeout(() => document.getElementById(item.scrollTo)?.scrollIntoView({ behavior: 'smooth' }), 50)
                          }
                        }}
                      >
                        <span className="dm-nav-label">{item.label}</span>
                        {item.beta && <span className="dm-nav-beta">Beta</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </nav>

          <div className="dm-subnav">
            <div className="dm-subnav-title">Quick Actions</div>
            <button className={`dm-subnav-item ${showCreateGame ? 'active' : ''}`} onClick={() => { setShowCreateGame(!showCreateGame); setShowCreateMiniGame(false); setShowAddGame(false); setShowTeachingMaterial(false); }}>
              <span className="dm-subnav-icon">+</span>
              <span className="dm-subnav-label">Create New Game</span>
            </button>
            <button className={`dm-subnav-item ${showCreateMiniGame ? 'active' : ''}`} onClick={() => {
              const next = !showCreateMiniGame
              setShowCreateMiniGame(next)
              setShowCreateGame(false)
              setShowAddGame(false)
              setShowTeachingMaterial(false)
              if (next) {
                setActiveContentSection('mini-games')
              }
            }}>
              <span className="dm-subnav-icon">🎮</span>
              <span className="dm-subnav-label">Create Classroom Experiment</span>
            </button>
            <button className={`dm-subnav-item ${showAddGame ? 'active' : ''}`} onClick={() => { setShowAddGame(!showAddGame); setShowCreateMiniGame(false); setShowCreateGame(false); setShowTeachingMaterial(false); }}>
              <span className="dm-subnav-icon">🔗</span>
              <span className="dm-subnav-label">Add Existing Game</span>
            </button>
            <button className={`dm-subnav-item ${showTeachingMaterial ? 'active' : ''}`} onClick={() => { setShowTeachingMaterial(!showTeachingMaterial); setShowCreateMiniGame(false); setShowCreateGame(false); setShowAddGame(false); }}>
              <span className="dm-subnav-icon">T</span>
              <span className="dm-subnav-label">Teaching Material</span>
            </button>
            <button className="dm-subnav-item" onClick={() => navigate('/demo-game')}>
              <span className="dm-subnav-icon">▶</span>
              <span className="dm-subnav-label">Launch Demo</span>
            </button>
          </div>
          <SidebarFooter />
        </aside>

        <main className="dm-main">
          <header className="dm-header">
            <div>
              <h1>Educator Dashboard</h1>
              <p>Welcome back, Educator</p>
            </div>
            <div className="dm-header-controls" style={{ display: 'flex', alignItems: 'center' }}>
              {/* Single top notification bar */}
              {gameCreationMsg && gameCreationMsg.startsWith('Game created') ? (
                <span style={{ fontSize: '0.85rem', color: '#065f46', fontWeight: 600, marginRight: '1rem' }}>
                  ✓ Game created successfully!
                </span>
              ) : !gameCreationMsg && !isAdmin && educatorProfile?.credits === 0 ? (
                <span style={{ fontSize: '0.85rem', color: '#dc2626', fontWeight: 600, marginRight: '1rem' }}>
                  You are out of game credit, please contact our sales to continue create game
                </span>
              ) : null}

              {educatorProfile?.credits !== undefined && !isAdmin && (
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
                  }}
                  title="Total Game Credits Remaining"
                >
                  <span className="dm-session-round dm-session-small" style={{ color: 'inherit' }}>
                    Game Credits: {educatorProfile.credits}
                  </span>
                </div>
              )}
              <button ref={accountMenuRef} type="button" className="dm-session" onClick={() => setSessionOpen(!sessionOpen)}>
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
                      <button type="button" className="dm-logout" style={{ background: 'var(--bg-input)', color: 'var(--text-primary)', marginBottom: '4px' }} onClick={handleResetPin}>Reset PIN</button>
                    </span>
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
                style={{ marginLeft: '1rem' }}
              >
                {theme === 'dark' ? '☀️' : '🌙'}
              </button>
            </div>
          </header>

          <div className="dm-workspace dm-no-impact">
            <section className="dm-content">
              <div className="dm-scroll" style={{ padding: '2rem' }}>

                {/* Status/Banner if needed */}
                {/* Status/Banner if needed */}
                {!location.pathname.includes('/tournaments') && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                    <div>
                      <h1 className="dm-title">My Games</h1>
                      {(educatorProfile?.credits !== undefined) && (
                        <div style={{ fontSize: '0.9rem', color: '#64748b', marginTop: '0.25rem' }}>
                          Credits: <strong style={{ color: educatorProfile.credits > 0 ? '#10b981' : '#ef4444' }}>{educatorProfile.credits}</strong>
                          <span style={{ margin: '0 0.5rem' }}>•</span>
                          <a href="mailto:support@aidecisionlab.global?subject=Purchase%20Credits" style={{ color: '#60a5fa', textDecoration: 'none', fontWeight: 500 }}>Get More Credits</a>
                        </div>
                      )}
                      {(gameCreationMsg || addGameMsg || advanceSuccess) && (
                        <div className="hero-title" style={{ color: (gameCreationMsg?.startsWith('✓') || gameCreationMsg?.startsWith('Game created') || addGameMsg?.startsWith('✓') || advanceSuccess) ? '#065f46' : '#991b1b', marginTop: '0.5rem' }}>
                          {advanceSuccess || gameCreationMsg || addGameMsg}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Active Game Management card removed - handled by EducatorGameView full page redirect */}

                {showCreateGame && (
                  <div className="card" style={{ marginBottom: '2rem' }}>
                    <div className="card-header">
                      <h2 className="card-title">Create New Game</h2>
                    </div>
                    <div className="card-body" style={{ padding: '1.5rem' }}>
                      <form onSubmit={handleCreateGame} style={{ display: 'grid', gap: '1.25rem', maxWidth: '800px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
                          <div className="form-group">
                            <label className="dm-label">Game Name</label>
                            <input
                              type="text"
                              className="input-field"
                              value={gameName}
                              onChange={(e) => setGameName(e.target.value)}
                              placeholder="Auto-generated if left blank"
                            />
                          </div>

                          <div className="form-group">
                            <label className="dm-label">Industry</label>
                            <select value={industry} onChange={(e) => setIndustry(e.target.value)} className="input-field" style={{ appearance: 'auto' }}>
                              <option value="Oil & Energy">Oil & Energy</option>
                              <option value="Electronics">Electronics</option>
                              <option value="Automotive">Automotive</option>
                            </select>
                          </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' }}>
                          <div className="form-group">
                            <label className="dm-label">Total Rounds</label>
                            <select
                              value={totalRounds}
                              onChange={(e) => setTotalRounds(Number(e.target.value))}
                              className="input-field"
                              style={{ appearance: 'auto' }}
                            >
                              {[2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                                <option key={n} value={n}>{n} Rounds</option>
                              ))}
                            </select>
                          </div>
                          <div className="form-group">
                            <label className="dm-label">Time Per Round</label>
                            <select
                              value={hoursPerRound ?? 0}
                              onChange={(e) => setHoursPerRound(Number(e.target.value) || null)}
                              className="input-field"
                              style={{ appearance: 'auto' }}
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

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' }}>
                          <div className="form-group">
                            <label className="dm-label">Number of Teams</label>
                            <select
                              value={teamCount}
                              onChange={(e) => handleTeamCountChange(Number(e.target.value))}
                              className="input-field"
                              style={{ appearance: 'auto' }}
                            >
                              {[2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                                <option key={n} value={n}>{n} Teams</option>
                              ))}
                            </select>
                          </div>
                          <div className="form-group">
                            <label className="dm-label">Market Demand Mode</label>
                            <select
                              value={marketDemandMode}
                              onChange={(e) => {
                                const mode = e.target.value as 'balanced' | 'high_competition' | 'blue_ocean'
                                setMarketDemandMode(mode)
                                setDemandMultiplier(DEFAULT_DEMAND_MULTIPLIERS[mode])
                              }}
                              className="input-field"
                              style={{ appearance: 'auto' }}
                            >
                              <option value="high_competition">High Competition (lower growth)</option>
                              <option value="balanced">Balanced (default)</option>
                              <option value="blue_ocean">Blue Ocean (higher growth)</option>
                            </select>
                          </div>
                        </div>

                        <div style={{ padding: '1rem', background: 'var(--bg-subtle)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                          <div
                            style={{ cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#475569', fontSize: '0.9rem' }}
                            onClick={() => setShowAdvancedDemand(!showAdvancedDemand)}
                          >
                            <span>{showAdvancedDemand ? '▼' : '▶'} Advanced Settings</span>
                          </div>

                          {showAdvancedDemand && (
                            <div style={{ marginTop: '1rem', display: 'grid', gap: '1rem' }}>
                              <div className="form-group">
                                <label className="dm-label">Capacity Per Plant (units)</label>
                                <input
                                  type="number"
                                  min={100000}
                                  step={10000}
                                  value={capacityPerPlant}
                                  onChange={(e) => {
                                    setCapacityPerPlantTouched(true)
                                    const next = Number(e.target.value)
                                    if (!Number.isFinite(next)) return
                                    setCapacityPerPlant(Math.max(0, Math.round(next)))
                                  }}
                                  className="input-field"
                                />
                              </div>
                              <div className="form-group">
                                <label className="dm-label">
                                  Scenario Growth Amplifier: {demandMultiplier.toFixed(2)}x
                                  <span style={{ fontWeight: 400, marginLeft: '0.5rem', color: '#64748b' }}>
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

                              <div style={{ marginTop: '0.5rem' }}>
                                <label className="dm-label">Region Demand Split (must sum to 100%)</label>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem', background: '#e2e8f0', padding: '1rem', borderRadius: '8px' }}>
                                  <div className="form-group">
                                    <label className="dm-label" style={{ fontSize: '0.7rem' }}>Americas: {(regionDemandSplit.us * 100).toFixed(0)}%</label>
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
                                    <label className="dm-label" style={{ fontSize: '0.7rem' }}>Asia: {(regionDemandSplit.asia * 100).toFixed(0)}%</label>
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
                                    <label className="dm-label" style={{ fontSize: '0.7rem' }}>Europe: {(regionDemandSplit.europe * 100).toFixed(0)}%</label>
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
                                  style={{ marginTop: '0.5rem', fontSize: '0.75rem', padding: '0.25rem 0.5rem', background: '#cbd5e1', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                                >
                                  Reset to Default
                                </button>
                              </div>

                              <div className="form-group">
                                <label className="dm-label">Timezone</label>
                                <select value={timezone} onChange={(e) => setTimezone(e.target.value)} className="input-field" style={{ appearance: 'auto' }}>
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

                        <div style={{ padding: '1rem', background: 'var(--bg-subtle)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                          <div
                            style={{ cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#475569', fontSize: '0.9rem' }}
                            onClick={() => setShowRegionLabels(!showRegionLabels)}
                          >
                            <span>{showRegionLabels ? '▼' : '▶'} Region Labels (Optional)</span>
                          </div>

                          {showRegionLabels && (
                            <div style={{ marginTop: '1rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' }}>
                              <div className="form-group">
                                <label className="dm-label">Americas/US Label</label>
                                <input
                                  type="text"
                                  value={regionLabels.us}
                                  onChange={(e) => setRegionLabels(prev => ({ ...prev, us: e.target.value }))}
                                  className="input-field"
                                  placeholder="Americas"
                                />
                              </div>
                              <div className="form-group">
                                <label className="dm-label">Asia Label</label>
                                <input
                                  type="text"
                                  value={regionLabels.asia}
                                  onChange={(e) => setRegionLabels(prev => ({ ...prev, asia: e.target.value }))}
                                  className="input-field"
                                  placeholder="Asia"
                                />
                              </div>
                              <div className="form-group">
                                <label className="dm-label">Europe Label</label>
                                <input
                                  type="text"
                                  value={regionLabels.europe}
                                  onChange={(e) => setRegionLabels(prev => ({ ...prev, europe: e.target.value }))}
                                  className="input-field"
                                  placeholder="Europe"
                                />
                              </div>
                            </div>
                          )}
                        </div>

                        <div style={{ padding: '1rem', background: 'var(--bg-subtle)', borderRadius: '8px', border: '1px solid var(--border-color)', marginTop: '1rem' }}>
                          <div
                            style={{ cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#475569', fontSize: '0.9rem' }}
                            onClick={() => setShowAdvancedEngineConfig(!showAdvancedEngineConfig)}
                          >
                            <span>{showAdvancedEngineConfig ? '▼' : '▶'} Advanced Engine Parameters</span>
                          </div>
                          {showAdvancedEngineConfig && (
                            <div style={{ marginTop: '1rem', display: 'grid', gap: '1rem' }}>
                              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                Snapshot these values into this game only. They will not change if global defaults change later.
                              </div>

                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem' }}>
                                {(['us', 'asia', 'europe'] as const).map((region) => (
                                  <div className="form-group" key={region}>
                                    <label className="dm-label">
                                      Baseline Price ({region.toUpperCase()})
                                      <span style={{ fontWeight: 400, marginLeft: '0.4rem', color: '#64748b' }}>
                                        {Number(baseEngineConfig?.priceDemand?.minPriceByRegion?.[region] ?? 0)} - {Number(baseEngineConfig?.priceDemand?.maxPriceByRegion?.[region] ?? 999)}
                                      </span>
                                    </label>
                                    <input
                                      type="number"
                                      min={Number(baseEngineConfig?.priceDemand?.minPriceByRegion?.[region] ?? 1)}
                                      max={Number(baseEngineConfig?.priceDemand?.maxPriceByRegion?.[region] ?? 999)}
                                      step={0.01}
                                      value={baselinePrices[region]}
                                      onChange={(e) => {
                                        const next = Number(e.target.value)
                                        if (!Number.isFinite(next)) return
                                        setBaselinePrices((prev) => ({ ...prev, [region]: next }))
                                        setEngineConfigError('')
                                      }}
                                      className="input-field"
                                    />
                                  </div>
                                ))}
                              </div>

                              <div style={{ display: 'grid', gap: '0.75rem' }}>
                                <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.85rem' }}>
                                  Market Preference Weights (each region must sum to 1.00)
                                </div>
                                {(['us', 'asia', 'europe'] as const).map((region) => (
                                  <div key={region} style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.75rem', background: 'var(--bg-card)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                      <div style={{ fontWeight: 600, fontSize: '0.8rem', color: 'var(--text-main)' }}>{region.toUpperCase()}</div>
                                      <div style={{ fontSize: '0.75rem', color: Math.abs(marketPreferenceSums[region] - 1) <= 0.001 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                                        sum: {marketPreferenceSums[region].toFixed(3)}
                                      </div>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(135px, 1fr))', gap: '0.5rem' }}>
                                      {PREF_KEYS.map((key) => (
                                        <div className="form-group" key={`${region}-${key}`}>
                                          <label className="dm-label" style={{ fontSize: '0.65rem' }}>{key.replace('Weight', '')}</label>
                                          <input
                                            type="number"
                                            min={0}
                                            max={1}
                                            step={0.01}
                                            value={marketPreferences[region][key]}
                                            onChange={(e) => {
                                              const next = Number(e.target.value)
                                              if (!Number.isFinite(next)) return
                                              setMarketPreferences((prev) => ({
                                                ...prev,
                                                [region]: {
                                                  ...prev[region],
                                                  [key]: Math.max(0, Math.min(1, next)),
                                                },
                                              }))
                                              setEngineConfigError('')
                                            }}
                                            className="input-field"
                                          />
                                        </div>
                                      ))}
                                    </div>
                                    <div style={{ marginTop: '0.5rem', display: 'flex', justifyContent: 'flex-end' }}>
                                      <button
                                        type="button"
                                        className="btn btn-outline"
                                        style={{ fontSize: '0.7rem', padding: '0.25rem 0.5rem' }}
                                        onClick={() => {
                                          const normalized = normalizeWeights(marketPreferences[region] as unknown as Record<string, number>) as Record<PrefKey, number>
                                          setMarketPreferences((prev) => ({ ...prev, [region]: normalized }))
                                          setEngineConfigError('')
                                        }}
                                      >
                                        Normalize {region.toUpperCase()}
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>

                              <div style={{ display: 'grid', gap: '0.5rem' }}>
                                <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.85rem' }}>
                                  Share Price Growth Premium Weights
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem' }}>
                                  {GROWTH_KEYS.map((key) => (
                                    <div className="form-group" key={key}>
                                      <label className="dm-label">{key}</label>
                                      <input
                                        type="number"
                                        min={0}
                                        max={1}
                                        step={0.01}
                                        value={growthPremiumWeights[key]}
                                        onChange={(e) => {
                                          const next = Number(e.target.value)
                                          if (!Number.isFinite(next)) return
                                          setGrowthPremiumWeights((prev) => ({ ...prev, [key]: Math.max(0, Math.min(1, next)) }))
                                          setEngineConfigError('')
                                        }}
                                        className="input-field"
                                      />
                                    </div>
                                  ))}
                                </div>
                                <div style={{ fontSize: '0.75rem', color: growthWeightSum >= 0.1 && growthWeightSum <= 1.0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                                  sum: {growthWeightSum.toFixed(3)} (required 0.10 - 1.00)
                                </div>
                                <div>
                                  <button
                                    type="button"
                                    className="btn btn-outline"
                                    style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                                    onClick={() => {
                                      const normalized = normalizeWeights(growthPremiumWeights as unknown as Record<string, number>)
                                      setGrowthPremiumWeights({
                                        capacity: normalized.capacity,
                                        share: normalized.share,
                                        brand: normalized.brand,
                                        cash: normalized.cash,
                                      })
                                      setEngineConfigError('')
                                    }}
                                  >
                                    Normalize Growth Weights
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                        <div style={{ padding: '1rem', background: 'var(--bg-subtle)', borderRadius: '8px', border: '1px solid var(--border-color)', marginTop: '1rem' }}>
                          <div
                            style={{ cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#475569', fontSize: '0.9rem' }}
                            onClick={() => setShowConfigPreview(!showConfigPreview)}
                          >
                            <span>{showConfigPreview ? '▼' : '▶'} Game Config Preview</span>
                          </div>
                          {showConfigPreview && (
                            <div style={{ marginTop: '1rem', background: 'var(--bg-page)', padding: '1rem', borderRadius: '6px', overflowX: 'auto', border: '1px solid var(--border-color)' }}>
                              <div style={{ marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.75rem', color: 'var(--text-muted)' }}>Config used for {industry}</div>
                              <pre style={{ margin: 0, fontSize: '0.75rem', fontFamily: 'monospace', color: 'var(--text-main)' }}>{configPreview}</pre>
                            </div>
                          )}
                        </div>

                        <div className="dm-label" style={{ marginTop: '0.5rem' }}>Team Configuration</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '300px', overflowY: 'auto', padding: '0.5rem', background: 'var(--bg-hover)', borderRadius: '8px' }}>
                          {teams.slice(0, teamCount).map((team, idx) => (
                            <div key={idx} style={{ padding: '0.75rem', background: 'var(--bg-card)', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                              <input
                                type="text"
                                value={team.name}
                                onChange={(e) => {
                                  const newTeams = [...teams]
                                  newTeams[idx] = { ...newTeams[idx], name: e.target.value }
                                  setTeams(newTeams)
                                }}
                                className="input-field"
                                style={{
                                  margin: 0,
                                  padding: '4px 8px',
                                  fontSize: '0.9rem',
                                  fontWeight: 600,
                                  width: '240px',
                                  background: 'var(--bg-subtle)'
                                }}
                                placeholder="Team Name"
                                onClick={(e) => e.stopPropagation()}
                              />
                              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.8rem' }}>
                                  <input
                                    type="checkbox"
                                    checked={team.isAI}
                                    onChange={(e) => {
                                      const newTeams = [...teams]
                                      newTeams[idx] = { ...newTeams[idx], isAI: e.target.checked }
                                      setTeams(newTeams)
                                    }}
                                  />
                                  Computer Controlled
                                </label>
                                {team.isAI && (
                                  <select
                                    value={team.aiDifficulty}
                                    onChange={(e) => {
                                      const newTeams = [...teams]
                                      newTeams[idx] = { ...newTeams[idx], aiDifficulty: e.target.value as unknown }
                                      setTeams(newTeams)
                                    }}
                                    style={{ padding: '0.2rem', fontSize: '0.8rem', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-main)' }}
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

                        <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: 'fit-content', marginTop: '0.5rem' }}>
                          {loading ? 'Creating...' : 'Launch Simulation →'}
                        </button>

                        {engineConfigError && (
                          <div style={{ color: 'var(--color-danger)', fontWeight: 600, fontSize: '0.85rem' }}>
                            {engineConfigError}
                          </div>
                        )}

                        {createdGameInfo && (
                          <div style={{
                            marginTop: '1.5rem',
                            padding: '1.5rem',
                            background: 'var(--bg-subtle)',
                            borderRadius: '12px',
                            border: '2px solid var(--color-success)',
                            animation: 'slideUp 0.4s ease-out'
                          }}>
                            <div style={{
                              fontSize: '1rem',
                              fontWeight: 800,
                              color: 'var(--color-success)',
                              marginBottom: '1rem',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.5rem'
                            }}>
                              <span>🎉</span> Simulation Ready!
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                              <div style={{ background: 'var(--bg-card)', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                                <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '0.25rem' }}>Game Code</div>
                                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '0.05em' }}>{createdGameInfo.gameCode}</div>
                              </div>
                              <div style={{ background: 'var(--bg-card)', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                                <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '0.25rem' }}>Game PIN</div>
                                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '0.05em' }}>{createdGameInfo.gamePin}</div>
                              </div>
                            </div>

                            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.5rem' }}>
                              Team Access Details
                            </div>

                            <div style={{ display: 'flex', gap: '0.35rem', marginBottom: '0.75rem', overflowX: 'auto', paddingBottom: '0.25rem', scrollbarWidth: 'none' }}>
                              {createdGameInfo.teams.map((team, idx) => (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={() => setActiveTeamTabIndex(idx)}
                                  style={{
                                    padding: '0.4rem 0.8rem',
                                    fontSize: '0.75rem',
                                    borderRadius: '6px',
                                    border: '1px solid',
                                    borderColor: activeTeamTabIndex === idx ? 'var(--text-accent)' : 'var(--border-color)',
                                    background: activeTeamTabIndex === idx ? 'var(--bg-hover)' : 'var(--bg-card)',
                                    color: activeTeamTabIndex === idx ? 'var(--text-accent)' : 'var(--text-muted)',
                                    fontWeight: activeTeamTabIndex === idx ? 700 : 500,
                                    whiteSpace: 'nowrap',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                  }}
                                >
                                  {team.name}
                                </button>
                              ))}
                            </div>

                            <textarea
                              readOnly
                              className="dm-email-textarea"
                              value={buildTeamEmail(createdGameInfo.teams[activeTeamTabIndex])}
                            />
                            <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.75rem' }}>
                              <button
                                type="button"
                                className="btn btn-primary"
                                onClick={() => {
                                  const text = buildTeamEmail(createdGameInfo.teams[activeTeamTabIndex])
                                  navigator.clipboard.writeText(text)
                                    .then(() => {
                                      setCopyStatus(`✓ Email for ${createdGameInfo.teams[activeTeamTabIndex].name} copied`)
                                      setTimeout(() => setCopyStatus(''), 3000)
                                    })
                                    .catch(() => setCopyStatus('✗ Failed to copy email'))
                                }}
                              >
                                Copy Current Email
                              </button>
                              <button
                                type="button"
                                className="btn btn-outline"
                                onClick={() => {
                                  const text = buildTeamShareText()
                                  navigator.clipboard.writeText(text)
                                    .then(() => {
                                      setCopyStatus('✓ All team codes copied to clipboard')
                                      setTimeout(() => setCopyStatus(''), 3000)
                                    })
                                    .catch(() => setCopyStatus('✗ Failed to copy team codes'))
                                }}
                              >
                                Copy All Codes
                              </button>

                              {copyStatus && (
                                <span style={{
                                  marginLeft: 'auto',
                                  fontSize: '0.8rem',
                                  fontWeight: 600,
                                  color: copyStatus.startsWith('✓') ? 'var(--color-success)' : 'var(--color-danger)',
                                  animation: 'fadeIn 0.3s ease-out'
                                }}>
                                  {copyStatus}
                                </span>
                              )}
                            </div>
                          </div>
                        )}

                      </form>
                      <style>{`
                        .dm-label { display: block; margin-bottom: 0.4rem; font-weight: 700; font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; }
                      `}</style>
                    </div>
                  </div>
                )}

                {showCreateMiniGame && (
                  <div className="card" style={{ marginBottom: '2rem' }}>
                    <div className="card-header">
                      <h2 className="card-title">Create Classroom Experiment</h2>
                    </div>
                    <div className="card-body" style={{ padding: '1.5rem' }}>
                      <div style={{ display: 'grid', gap: '1rem', maxWidth: '1000px' }}>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                          Use existing mini-game setup pages. Pick a game and continue in its native flow.
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
                          {MINI_GAME_LIBRARY.map((item) => (
                            <article
                              key={item.type}
                              className="mini-game-card"
                              style={{
                                border: '1px solid var(--border-color)',
                                borderRadius: '10px',
                                padding: '0.9rem',
                                background: 'var(--bg-card)',
                                display: 'grid',
                                gridTemplateRows: 'auto auto 1fr auto',
                                gap: '0.6rem',
                                minHeight: '290px',
                              }}
                            >
                              <div style={{
                                width: '100%', height: '70px', borderRadius: '6px',
                                background: 'var(--bg-subtle, #f1f5f9)', overflow: 'hidden', flexShrink: 0,
                              }}>
                                <MiniGameSvg
                                  type={item.type}
                                  style={{ width: '100%', height: '100%', display: 'block' }}
                                />
                              </div>
                              <div style={{ display: 'grid', gap: '0.22rem', minWidth: 0 }}>
                                <strong style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: 0 }}>
                                  <span className="mini-game-title">{item.title}</span>
                                  {item.beta && (
                                    <span style={{
                                      border: '1px solid #f59e0b',
                                      background: 'rgba(245, 158, 11, 0.12)',
                                      color: '#b45309',
                                      borderRadius: '999px',
                                      fontSize: '0.62rem',
                                      fontWeight: 700,
                                      letterSpacing: '0.03em',
                                      padding: '0.06rem 0.32rem',
                                      textTransform: 'uppercase',
                                      flexShrink: 0,
                                    }}>
                                      Beta
                                    </span>
                                  )}
                                </strong>
                                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{item.difficulty}</span>
                              </div>
                              <p className="mini-game-blurb" style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                                {item.blurb}
                              </p>
                              <button
                                type="button"
                                className="btn btn-primary mini-game-cta"
                                onClick={() => window.open(`/mini-games/${item.type}`, '_blank')}
                                aria-label={`Open ${item.title} setup`}
                              >
                                Open Setup
                              </button>
                            </article>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {showAddGame && (
                  <div className="card" style={{ marginBottom: '2rem' }}>
                    <div className="card-header">
                      <h2 className="card-title">Add Existing Game</h2>
                    </div>
                    <div className="card-body" style={{ padding: '1.5rem' }}>
                      <form onSubmit={handleAddExistingGame} style={{ display: 'grid', gap: '1.25rem', maxWidth: '400px' }}>
                        <div className="form-group">
                          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 700, fontSize: '0.85rem', color: '#64748b', textTransform: 'uppercase' }}>Game Code</label>
                          <input
                            type="text"
                            className="input-field"
                            value={addGameCode}
                            onChange={(e) => setAddGameCode(e.target.value.toUpperCase())}
                            placeholder="BONO-XXXX"
                            required
                          />
                        </div>
                        <div className="form-group">
                          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 700, fontSize: '0.85rem', color: '#64748b', textTransform: 'uppercase' }}>Game PIN</label>
                          <input
                            type="password"
                            className="input-field"
                            value={addGamePin}
                            onChange={(e) => setAddGamePin(e.target.value)}
                            placeholder="******"
                            required
                          />
                        </div>
                        <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: 'fit-content' }}>
                          {loading ? 'Adding...' : 'Verify & Add Game'}
                        </button>
                      </form>
                    </div>
                  </div>
                )}

                {showTeachingMaterial && !location.pathname.includes('/tournaments') && (
                  <div className="card" id="teaching-material" style={{ marginBottom: '2rem' }}>
                    <div className="card-header">
                      <h2 className="card-title">Teaching Material</h2>
                    </div>
                    <div className="card-body" style={{ padding: '1.5rem' }}>
                      {archivedGames.length === 0 ? (
                        <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
                          No completed games available yet.
                        </p>
                      ) : (
                        <div style={{ display: 'grid', gap: '1rem' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                            <div className="form-group">
                              <label className="dm-label">Completed Game</label>
                              <select
                                value={teachingGameId}
                                onChange={(e) => {
                                  setTeachingGameId(e.target.value)
                                  setTeachingTeamId('')
                                }}
                                className="input-field"
                                style={{ appearance: 'auto' }}
                              >
                                {archivedGames.map((game) => (
                                  <option key={game.id} value={game.id}>
                                    {game.name} ({game.status})
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div className="form-group">
                              <label className="dm-label">Team</label>
                              <select
                                value={teachingModel?.currentTeamData?.teamId ?? teachingTeamId}
                                onChange={(e) => setTeachingTeamId(e.target.value)}
                                className="input-field"
                                style={{ appearance: 'auto' }}
                                disabled={!teachingModel || teachingModel.teamOptions.length === 0}
                              >
                                {(teachingModel?.teamOptions ?? []).map((team) => (
                                  <option key={team.teamId} value={team.teamId}>
                                    {team.teamName}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>

                          {teachingLoading && (
                            <div className="dm-loading-chart">Loading teaching material...</div>
                          )}

                          {!teachingLoading && teachingError && (
                            <div style={{ color: '#b91c1c', fontWeight: 600 }}>{teachingError}</div>
                          )}

                          {!teachingLoading && !teachingError && teachingModel && teachingModel.currentTeamData && (
                            <MarketEconomicsSection
                              currentTeamData={teachingModel.currentTeamData}
                              allRoundsData={teachingModel.allRounds}
                              roundNumber={teachingModel.selectedRound}
                              regionLabels={teachingModel.regionLabels}
                            />
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {location.pathname.includes('/tournaments') && !showAddGame && (
                  <div style={{ marginBottom: '2rem' }}>
                    {showCreateTournament && (
                      <div className="card" style={{ marginBottom: '2rem' }}>
                        <div className="card-header">
                          <h2 className="card-title">Create Tournament</h2>
                        </div>
                        <div className="card-body" style={{ padding: '1.5rem' }}>
                          <form onSubmit={handleCreateTournament}>
                            <div className="form-group" style={{ marginBottom: '1rem' }}>
                              <label className="dm-label">Tournament Name</label>
                              <input
                                value={tournamentName}
                                onChange={e => setTournamentName(e.target.value)}
                                className="input-field"
                                placeholder="Enter generic name (e.g. Spring Cup)"
                                required
                              />
                            </div>

                            {/* Game Configuration */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
                              <div className="form-group">
                                <label className="dm-label">Industry</label>
                                <select
                                  value={tournamentIndustry}
                                  onChange={e => setTournamentIndustry(e.target.value)}
                                  className="input-field"
                                >
                                  {INDUSTRIES.map((ind) => (
                                    <option key={ind} value={ind}>{ind}</option>
                                  ))}
                                </select>
                              </div>
                              <div className="form-group">
                                <label className="dm-label">Total Rounds</label>
                                <select
                                  value={tournamentRounds}
                                  onChange={e => setTournamentRounds(Number(e.target.value))}
                                  className="input-field"
                                >
                                  {[2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                                    <option key={n} value={n}>{n} Rounds</option>
                                  ))}
                                </select>
                              </div>
                              <div className="form-group">
                                <label className="dm-label">Time Per Round</label>
                                <select
                                  value={tournamentTimeLimit}
                                  onChange={e => setTournamentTimeLimit(Number(e.target.value))}
                                  className="input-field"
                                >
                                  <option value={1}>1 hour</option>
                                  <option value={2}>2 hours</option>
                                  <option value={4}>4 hours</option>
                                  <option value={24}>1 day</option>
                                  <option value={48}>2 days</option>
                                  <option value={168}>1 week</option>
                                </select>
                              </div>
                            </div>

                            <div className="form-group">
                              <label className="dm-label">Teams (16 Required)</label>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
                                {tournamentTeams.map((team, idx) => (
                                  <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <input
                                      placeholder={`Team ${idx + 1}`}
                                      value={team.name}
                                      onChange={e => {
                                        const newTeams = [...tournamentTeams]
                                        newTeams[idx] = { ...newTeams[idx], name: e.target.value }
                                        setTournamentTeams(newTeams)
                                      }}
                                      className="input-field"
                                      style={{ fontSize: '0.8rem', padding: '6px' }}
                                    />
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem', cursor: 'pointer', color: 'var(--text-muted)' }}>
                                      <input
                                        type="checkbox"
                                        checked={team.isAI}
                                        onChange={e => {
                                          const newTeams = [...tournamentTeams]
                                          newTeams[idx] = { ...newTeams[idx], isAI: e.target.checked }
                                          setTournamentTeams(newTeams)
                                        }}
                                      />
                                      AI
                                    </label>
                                  </div>
                                ))}
                              </div>
                              <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.5rem' }}>
                                * This will create 4 games (Group A-D) with 4 teams each. Teams will be randomly assigned to groups.
                              </div>
                            </div>
                            <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem' }}>
                              <button type="submit" className="btn btn-primary" disabled={tournamentLoading}>
                                {tournamentLoading ? 'Creating...' : 'Create Tournament'}
                              </button>
                              <button type="button" className="btn btn-outline" onClick={() => setShowCreateTournament(false)}>
                                Cancel
                              </button>
                            </div>
                          </form>
                        </div>
                      </div>
                    )}

                    <div className="card">
                      <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h2 className="card-title">Active Tournaments</h2>
                        {!showCreateTournament && (
                          <button className="btn btn-primary btn-sm" onClick={() => setShowCreateTournament(true)} style={{ whiteSpace: 'nowrap', minWidth: 'fit-content' }}>
                            + New Tournament
                          </button>
                        )}
                      </div>
                      <div className="card-body" style={{ padding: '1.5rem' }}>
                        {tournamentLoading && !tournaments.length && <div>Loading...</div>}
                        {!tournamentLoading && tournaments.filter(t => t.status !== 'ARCHIVED').length === 0 && (
                          <div style={{ textAlign: 'center', color: '#64748b', padding: '2rem' }}>No active tournaments found. Create one to get started.</div>
                        )}
                        {tournaments.filter(t => t.status !== 'ARCHIVED').map(t => {
                          const groups = t.games.filter((g: unknown) => !g.isFinal).sort((a: unknown, b: unknown) => a.groupName.localeCompare(b.groupName))
                          const finalGame = t.games.find((g: unknown) => g.isFinal)
                          const canCreateFinal = !finalGame && groups.every((g: unknown) => g.game.status === 'COMPLETED')

                          return (
                            <div key={t.id} style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '1rem', marginBottom: '1rem', background: 'var(--bg-card)' }}>
                              <div
                                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                                onClick={() => setExpandedTournamentId(expandedTournamentId === t.id ? null : t.id)}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                  <span style={{
                                    transform: expandedTournamentId === t.id ? 'rotate(90deg)' : 'none',
                                    transition: 'transform 0.2s',
                                    fontSize: '0.9rem',
                                    color: 'var(--text-muted)'
                                  }}>▶</span>
                                  <h3 style={{ margin: 0, fontSize: '1.1rem' }}>{t.name}</h3>
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }} onClick={e => e.stopPropagation()}>
                                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginRight: '1rem' }}>
                                    {new Date(t.createdAt).toLocaleDateString()}
                                  </div>
                                  {canCreateFinal && (
                                    <button className="btn btn-success btn-sm" onClick={() => handleCreateFinal(t.id, t.name)}>
                                      🏆 Create Final Round
                                    </button>
                                  )}
                                  <button
                                    className="btn btn-sm btn-outline-danger"
                                    onClick={async () => {
                                      if (confirm('Archive this tournament?')) {
                                        await tournamentApi.archive(t.id)
                                        loadTournaments()
                                      }
                                    }}
                                  >
                                    Archive
                                  </button>
                                </div>
                              </div>

                              {expandedTournamentId === t.id && (
                                <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border-color)' }}>

                                  {/* Bracket Graph Visualization */}
                                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '2rem 0', borderRadius: '8px', background: 'var(--bg-subtle)' }}>

                                    {/* TOP: THE FINAL */}
                                    <div style={{
                                      border: '2px solid gold',
                                      padding: '1rem',
                                      borderRadius: '8px',
                                      width: '240px',
                                      background: finalGame ? 'var(--bg-card)' : 'var(--bg-input)',
                                      color: 'var(--text-main)',
                                      opacity: finalGame ? 1 : 0.5,
                                      marginBottom: '1rem',
                                      position: 'relative',
                                      zIndex: 2
                                    }}>
                                      <div style={{
                                        fontWeight: 700,
                                        fontSize: '0.9rem',
                                        color: theme === 'dark' ? '#fbbf24' : '#b45309',
                                        borderBottom: '1px solid var(--border-color)',
                                        paddingBottom: '0.25rem',
                                        marginBottom: '0.5rem',
                                        textAlign: 'center'
                                      }}>THE FINAL</div>
                                      {finalGame ? (
                                        <>
                                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                            {finalGame.game.teams?.map((t: unknown) => {
                                              const isSubmitted = t.isComputer || t.decisions?.some((d: unknown) => d.roundNumber === finalGame.game.currentRound && d.isSubmitted)
                                              const statusColor = t.isComputer ? '#3b82f6' : (isSubmitted ? '#10b981' : '#f59e0b')
                                              return (
                                                <div key={t.id} style={{ fontSize: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: statusColor }} title={t.isComputer ? 'AI Team' : (isSubmitted ? 'Submitted' : 'Pending')}></div>
                                                    <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{t.name}</span>
                                                  </div>
                                                  <span style={{ fontSize: '0.7rem', fontFamily: 'monospace', color: 'var(--text-muted)' }}>{t.teamPin}</span>
                                                </div>
                                              )
                                            })}
                                          </div>
                                          {finalGame.game.status === 'COMPLETED' && (() => {
                                            const winner = finalGame.game.teams?.find((t: unknown) => t.results?.[0]?.rank === 1)
                                            return winner ? (
                                              <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border-color)', fontSize: '0.75rem', color: '#059669', fontWeight: 800, textAlign: 'center' }}>
                                                🏆 Winner: {winner.name}
                                              </div>
                                            ) : null
                                          })()}
                                        </>
                                      ) : (
                                        <div style={{ fontStyle: 'italic', fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center', padding: '1rem 0' }}>Waiting for finalists...</div>
                                      )}

                                      {/* Downward connector from Final */}
                                      <div style={{ position: 'absolute', bottom: '-1rem', left: '50%', width: '2px', height: '1rem', background: 'var(--border-color)' }}></div>
                                    </div>

                                    {/* Connector Bracket */}
                                    <div style={{ position: 'relative', width: '80%', height: '20px', marginBottom: '0' }}>
                                      {/* Horizontal line */}
                                      <div style={{ position: 'absolute', top: '0', left: '10%', right: '10%', height: '2px', background: 'var(--border-color)' }}></div>
                                      {/* Vertical lines to groups */}
                                      <div style={{ display: 'flex', justifyContent: 'space-between', height: '20px', padding: '0 10%' }}>
                                        <div style={{ width: '2px', background: 'var(--border-color)' }}></div>
                                        <div style={{ width: '2px', background: 'var(--border-color)' }}></div>
                                        <div style={{ width: '2px', background: 'var(--border-color)' }}></div>
                                        <div style={{ width: '2px', background: 'var(--border-color)' }}></div>
                                      </div>
                                    </div>

                                    {/* BOTTOM: GROUPS */}
                                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center', width: '100%' }}>
                                      {groups.map((g: unknown) => (
                                        <div key={g.id} style={{
                                          border: '1px solid var(--border-color)',
                                          padding: '0.75rem',
                                          borderRadius: '6px',
                                          width: '200px',
                                          background: g.game.status === 'COMPLETED'
                                            ? (theme === 'dark' ? 'rgba(16, 185, 129, 0.15)' : '#f0fdf4')
                                            : 'var(--bg-card)',
                                          color: 'var(--text-main)',
                                          position: 'relative',
                                          flex: '1 1 200px',
                                          maxWidth: '220px'
                                        }}>
                                          {/* Upward connector */}
                                          <div style={{ position: 'absolute', top: '-22px', left: '50%', width: '2px', height: '22px', background: 'var(--border-color)' }}></div>

                                          <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-main)', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.25rem', marginBottom: '0.5rem', textAlign: 'center' }}>{g.groupName}</div>
                                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                            {g.game.teams?.map((t: unknown) => {
                                              const isSubmitted = t.isComputer || t.decisions?.some((d: unknown) => d.roundNumber === g.game.currentRound && d.isSubmitted)
                                              const statusColor = t.isComputer ? '#3b82f6' : (isSubmitted ? '#10b981' : '#f59e0b')
                                              return (
                                                <div key={t.id} style={{ fontSize: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: statusColor }} title={t.isComputer ? 'AI' : (isSubmitted ? 'Submitted' : 'Pending')}></div>
                                                    <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{t.name}</span>
                                                  </div>
                                                </div>
                                              )
                                            })}
                                          </div>
                                          {g.game.status === 'COMPLETED' && (() => {
                                            const winner = g.game.teams?.find((t: unknown) => t.results?.[0]?.rank === 1)
                                            return winner ? (
                                              <div style={{
                                                marginTop: '0.5rem',
                                                paddingTop: '0.5rem',
                                                borderTop: '1px solid var(--border-color)',
                                                fontSize: '0.75rem',
                                                color: theme === 'dark' ? '#34d399' : '#059669',
                                                fontWeight: 800,
                                                textAlign: 'center'
                                              }}>
                                                🏆 Winner: {winner.name}
                                              </div>
                                            ) : null
                                          })()}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                  {/* Game List for Management */}
                                  <div style={{ marginTop: '1rem' }}>
                                    <div className="dm-label" style={{ color: 'var(--text-muted)' }}>Games Management</div>
                                    <table style={{ width: '100%', fontSize: '0.85rem', marginTop: '0.5rem', borderCollapse: 'collapse', color: 'var(--text-main)' }}>
                                      <thead>
                                        <tr style={{ background: 'var(--bg-input)', color: 'var(--text-muted)' }}>
                                          <th style={{ width: '40px', padding: '0.5rem' }}></th>
                                          <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>Group</th>
                                          <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>Game Status</th>
                                          <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>Teams & Codes</th>
                                          <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>Time Remaining</th>
                                          <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>Action</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {[...groups, finalGame].filter(Boolean).map((g: unknown) => {
                                          const currentRoundData = g.game.rounds?.find((r: unknown) => r.roundNumber === g.game.currentRound)
                                          const isCompleted = g.game.status === 'COMPLETED'
                                          const startedAt = currentRoundData?.startedAt ? new Date(currentRoundData.startedAt) : null
                                          const hoursPerRound = g.game.hoursPerRound || 24
                                          const endTime = startedAt ? new Date(startedAt.getTime() + hoursPerRound * 60 * 60 * 1000) : null
                                          const remainingMs = endTime ? endTime.getTime() - currentTime.getTime() : 0
                                          const isExpired = !isCompleted && startedAt && remainingMs <= 0

                                          const humanTeams = g.game.teams?.filter((t: unknown) => !t.isComputer) || []
                                          const totalHuman = humanTeams.length
                                          const submittedHuman = humanTeams.filter((t: unknown) => {
                                            const currentRoundDecision = t.decisions?.find((d: unknown) => d.roundNumber === g.game.currentRound)
                                            return currentRoundDecision?.isSubmitted === true
                                          }).length
                                          const allSubmitted = totalHuman > 0 ? (submittedHuman === totalHuman) : true
                                          const canAdvance = (isExpired || allSubmitted) && !isCompleted && g.game.status !== 'PENDING'

                                          return (
                                            <Fragment key={g.id}>
                                              <tr style={{ borderBottom: expandedGameIds.has(g.game.id) ? 'none' : '1px solid var(--border-color)' }}>
                                                <td style={{ padding: '0.5rem', verticalAlign: 'top', textAlign: 'center' }}>
                                                  <button
                                                    onClick={() => {
                                                      const next = new Set(expandedGameIds)
                                                      if (next.has(g.game.id)) next.delete(g.game.id)
                                                      else next.add(g.game.id)
                                                      setExpandedGameIds(next)
                                                    }}
                                                    style={{
                                                      background: 'none',
                                                      border: 'none',
                                                      cursor: 'pointer',
                                                      fontSize: '0.8rem',
                                                      color: 'var(--text-muted)',
                                                      transform: expandedGameIds.has(g.game.id) ? 'rotate(90deg)' : 'none',
                                                      transition: 'transform 0.2s'
                                                    }}
                                                  >
                                                    ▶
                                                  </button>
                                                </td>
                                                <td style={{ padding: '0.75rem 0.5rem', verticalAlign: 'top', fontWeight: 700 }}>{g.groupName}</td>
                                                <td style={{ padding: '0.75rem 0.5rem', verticalAlign: 'top' }}>
                                                  <div style={{ marginBottom: '0.25rem' }}>{g.game.status}</div>
                                                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Round {g.game.currentRound}/{g.game.totalRounds}</div>
                                                </td>
                                                <td style={{ padding: '0.75rem 0.5rem', verticalAlign: 'top' }}>
                                                  <div style={{ display: 'grid', gridTemplateColumns: 'minmax(120px, 1fr) auto auto', gap: '0.5rem 1rem', fontSize: '0.8rem' }}>
                                                    {g.game.teams?.map((team: unknown) => (
                                                      <Fragment key={team.id}>
                                                        <div style={{ fontWeight: 500 }}>{team.name}</div>
                                                        <div style={{ fontFamily: 'monospace', color: 'var(--text-secondary)' }}>Code: {team.teamCode || '-'}</div>
                                                        <div style={{ fontFamily: 'monospace', color: 'var(--text-secondary)' }}>PIN: {team.teamPin || '-'}</div>
                                                      </Fragment>
                                                    ))}
                                                  </div>
                                                </td>
                                                <td style={{ padding: '0.75rem 0.5rem', verticalAlign: 'top' }}>
                                                  {!startedAt || isCompleted ? (
                                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>-</span>
                                                  ) : isExpired ? (
                                                    <span style={{ fontSize: '0.75rem', color: '#ef4444', fontWeight: 600 }}>Expired</span>
                                                  ) : (
                                                    <div style={{ fontSize: '0.75rem' }}>
                                                      <div style={{ fontWeight: 600, color: (remainingMs / (1000 * 60 * 60)) < 2 ? '#f59e0b' : 'var(--text-main)' }}>
                                                        {Math.floor(remainingMs / (1000 * 60 * 60))}h {Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60))}m
                                                      </div>
                                                    </div>
                                                  )}
                                                </td>
                                                <td style={{ padding: '0.75rem 0.5rem', verticalAlign: 'top' }}>
                                                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                                    <button
                                                      className="btn btn-sm btn-outline"
                                                      onClick={() => {
                                                        const url = `${window.location.origin}/educator-dev?gameId=${g.game.id}`
                                                        window.open(url, '_blank')
                                                      }}
                                                    >
                                                      Manage
                                                    </button>
                                                    {canAdvance && (
                                                      <button
                                                        className="btn btn-sm btn-primary"
                                                        onClick={() => handleQuickAdvance(g.game)}
                                                        disabled={advancingGameId === g.game.id}
                                                        style={{
                                                          background: allSubmitted && !isExpired ? '#10b981' : undefined,
                                                          borderColor: allSubmitted && !isExpired ? '#059669' : undefined,
                                                        }}
                                                      >
                                                        {advancingGameId === g.game.id ? '...' : (g.game.currentRound >= g.game.totalRounds ? (allSubmitted ? 'Finalize' : 'Finish') : 'Advance')}
                                                      </button>
                                                    )}
                                                    {!isCompleted && !allSubmitted && !isExpired && g.game.status !== 'PENDING' && (
                                                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', alignSelf: 'center' }}>
                                                        ({submittedHuman}/{totalHuman})
                                                      </span>
                                                    )}
                                                  </div>
                                                </td>
                                              </tr>
                                              {expandedGameIds.has(g.game.id) && (
                                                <tr style={{ background: 'var(--bg-input)', borderBottom: '1px solid var(--border-color)' }}>
                                                  <td colSpan={6} style={{ padding: '1rem', width: '100%' }}>
                                                    <div style={{ marginBottom: '0.5rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Registered Teams</div>
                                                    <table style={{ width: '100%', background: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.85rem', borderCollapse: 'separate', borderSpacing: 0, overflow: 'hidden' }}>
                                                      <thead>
                                                        <tr style={{ background: 'var(--bg-input)', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                                                          <th style={{ padding: '0.5rem 1rem', textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>Team Name</th>
                                                          <th style={{ padding: '0.5rem 1rem', textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>Code</th>
                                                          <th style={{ padding: '0.5rem 1rem', textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>PIN</th>
                                                          <th style={{ padding: '0.5rem 1rem', textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>Type</th>
                                                          <th style={{ padding: '0.5rem 1rem', textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>Status</th>
                                                          <th style={{ padding: '0.5rem 1rem', textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>Login</th>
                                                        </tr>
                                                      </thead>
                                                      <tbody>
                                                        {g.game.teams?.slice().sort((a: unknown, b: unknown) => a.name.localeCompare(b.name)).map((team: unknown) => {
                                                          const currentRoundDecision = team.decisions?.find((d: unknown) => d.roundNumber === g.game.currentRound)
                                                          const isSubmitted = team.isComputer || currentRoundDecision?.isSubmitted === true
                                                          return (
                                                            <tr key={team.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                                              <td style={{ padding: '0.5rem 1rem', fontWeight: 600, color: 'var(--text-primary)', borderBottom: '1px solid var(--border-color)' }}>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: team.color }}></div>
                                                                  {team.name}
                                                                </div>
                                                              </td>
                                                              <td style={{ padding: '0.5rem 1rem', fontFamily: 'monospace', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-color)' }}>{team.teamCode}</td>
                                                              <td style={{ padding: '0.5rem 1rem', fontFamily: 'monospace', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-color)' }}>{team.teamPin || '-'}</td>
                                                              <td style={{ padding: '0.5rem 1rem', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-color)' }}>{team.isComputer ? `AI` : 'Human'}</td>
                                                              <td style={{ padding: '0.5rem 1rem', borderBottom: '1px solid var(--border-color)' }}>
                                                                {team.isComputer ? (
                                                                  <span style={{ color: '#3b82f6', fontWeight: 600, fontSize: '0.75rem', background: 'var(--bg-info-subtle, #dbeafe)', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>Auto</span>
                                                                ) : isSubmitted ? (
                                                                  <span style={{ color: '#059669', fontWeight: 600, fontSize: '0.75rem', background: 'var(--bg-success-subtle, #d1fae5)', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>Submitted</span>
                                                                ) : (
                                                                  <span style={{ color: '#d97706', fontWeight: 600, fontSize: '0.75rem', background: 'var(--bg-warning-subtle, #fef3c7)', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>Pending</span>
                                                                )}
                                                              </td>
                                                              <td style={{ padding: '0.5rem 1rem', borderBottom: '1px solid var(--border-color)' }}>
                                                                {team.isComputer ? (
                                                                  <span style={{ color: 'var(--text-muted)' }}>-</span>
                                                                ) : (
                                                                  <button
                                                                    className="btn btn-sm btn-outline"
                                                                    onClick={() => handleLoginAsTeam(team)}
                                                                    disabled={teamLoginLoadingId === team.id}
                                                                  >
                                                                    {teamLoginLoadingId === team.id ? '...' : 'Login'}
                                                                  </button>
                                                                )}
                                                              </td>
                                                            </tr>
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
                                  </div>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    {/* Archived Tournaments Section */}
                    {/* Archived Tournaments Section */}
                    {tournaments.filter(t => t.status === 'ARCHIVED').length > 0 && (
                      <div className="card" style={{ marginTop: '2rem', opacity: 0.8 }}>
                        <div
                          className="card-header"
                          style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', justifyContent: 'space-between' }}
                          onClick={() => setShowArchivedTournaments(!showArchivedTournaments)}
                        >
                          <h2 className="card-title">Archived Tournaments ({tournaments.filter(t => t.status === 'ARCHIVED').length})</h2>
                          <span style={{
                            transform: showArchivedTournaments ? 'rotate(180deg)' : 'none',
                            transition: 'transform 0.2s',
                            fontSize: '0.9rem',
                            color: 'var(--text-muted)'
                          }}>▼</span>
                        </div>
                        {showArchivedTournaments && (
                          <div className="card-body" style={{ padding: '1rem' }}>
                            <table style={{ width: '100%', fontSize: '0.9rem' }}>
                              <thead>
                                <tr style={{ background: 'var(--bg-input)', color: 'var(--text-muted)' }}>
                                  <th style={{ padding: '0.5rem', textAlign: 'left' }}>Name</th>
                                  <th style={{ padding: '0.5rem', textAlign: 'left' }}>Created Date</th>
                                  <th style={{ padding: '0.5rem', textAlign: 'left' }}>Action</th>
                                </tr>
                              </thead>
                              <tbody>
                                {tournaments.filter(t => t.status === 'ARCHIVED').map(t => (
                                  <tr key={t.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                    <td style={{ padding: '0.5rem' }}>{t.name}</td>
                                    <td style={{ padding: '0.5rem' }}>{new Date(t.createdAt).toLocaleDateString()}</td>
                                    <td style={{ padding: '0.5rem' }}>
                                      <button
                                        className="btn btn-sm btn-outline"
                                        onClick={async (e) => {
                                          e.stopPropagation()
                                          if (confirm('Restore this tournament?')) {
                                            await tournamentApi.unarchive(t.id)
                                            loadTournaments()
                                          }
                                        }}
                                      >
                                        Restore
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <div className="card" id="mini-game-sessions" style={{ display: location.pathname.includes('/tournaments') || activeContentSection !== 'mini-games' || showCreateMiniGame ? 'none' : 'block', marginBottom: '1.25rem' }}>
                  <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2 className="card-title">My Classroom Experiments</h2>
                    <button
                      className="btn btn-outline btn-sm"
                      onClick={() => void loadMiniGameSessions()}
                      disabled={miniGameListLoading}
                    >
                      {miniGameListLoading ? 'Refreshing...' : 'Refresh'}
                    </button>
                  </div>
                  <div className="card-body" style={{ padding: 0 }}>
                    {miniGameListLoading && miniGameSessions.length === 0 ? (
                      <div className="dm-loading-chart">Loading classroom experiments...</div>
                    ) : miniGameSessions.length === 0 ? (
                      <div className="dm-loading-chart">No classroom experiments yet. Use "Create Classroom Experiment" to start one.</div>
                    ) : (
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr style={{ background: 'var(--bg-input)', borderBottom: '1px solid var(--border-color)' }}>
                              <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Game</th>
                              <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Title</th>
                              <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Game Code</th>
                              <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Created</th>
                              <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Teams</th>
                              <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Status</th>
                              <th style={{ padding: '1rem', textAlign: 'right', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', minWidth: '160px' }}>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {miniGameSessions.map((session) => {
                              const gameMeta = MINI_GAME_LIBRARY.find((item) => item.type === session.gameType)
                              const title = session.title || gameMeta?.title || session.gameType
                              const expanded = expandedMiniGameSessionId === session.id
                              const loadedLinks = miniGameLinksBySession[session.id]
                              return (
                                <Fragment key={session.id}>
                                  <tr style={{ borderBottom: expanded ? 'none' : '1px solid var(--border-color)' }}>
                                    <td style={{ padding: '1rem', fontWeight: 700 }}>{gameMeta?.title || session.gameType}</td>
                                    <td style={{ padding: '1rem', color: 'var(--text-secondary)' }}>{title}</td>
                                    <td style={{ padding: '1rem', color: 'var(--text-main)', fontFamily: 'monospace', fontWeight: 700 }}>
                                      {session.roomCode || 'Pending'}
                                    </td>
                                    <td style={{ padding: '1rem', color: 'var(--text-muted)' }}>
                                      {new Date(session.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                    </td>
                                    <td style={{ padding: '1rem', color: 'var(--text-secondary)' }}>
                                      {typeof session.joinedCount === 'number' ? `${session.joinedCount} joined` : '0 joined'}
                                      {session.teamCount > 0 ? ` / ${session.teamCount} slots` : ''}
                                    </td>
                                    <td style={{ padding: '1rem' }}>
                                      <span style={{
                                        padding: '0.2rem 0.6rem',
                                        borderRadius: '6px',
                                        fontSize: '0.65rem',
                                        fontWeight: 800,
                                        background: session.status === 'ACTIVE' ? '#dbeafe' : session.status === 'COMPLETED' ? '#d1fae5' : 'var(--bg-input)',
                                        color: session.status === 'ACTIVE' ? '#2563eb' : session.status === 'COMPLETED' ? '#059669' : 'var(--text-secondary)'
                                      }}>
                                        {session.status}
                                      </span>
                                    </td>
                                    <td style={{ padding: '1rem', textAlign: 'right' }}>
                                      <button
                                        type="button"
                                        className="btn btn-outline btn-sm"
                                        onClick={() => void handleLoadMiniGameLinks(session)}
                                        disabled={miniGameLinksLoadingId === session.id}
                                      >
                                        {miniGameLinksLoadingId === session.id ? 'Loading...' : expanded ? 'Hide Links' : 'Load Links'}
                                      </button>
                                    </td>
                                  </tr>
                                  {expanded && loadedLinks && (
                                    <tr style={{ borderBottom: '1px solid var(--border-color)', background: 'var(--bg-subtle)' }}>
                                      <td colSpan={7} style={{ padding: '1rem' }}>
                                        <div style={{ display: 'grid', gap: '0.65rem' }}>
                                          <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr auto', gap: '0.5rem', alignItems: 'center' }}>
                                            <div style={{ fontSize: '0.8rem', fontWeight: 700 }}>Game Code</div>
                                            <input className="input-field" readOnly value={loadedLinks.roomCode || session.roomCode || ''} />
                                            <button
                                              type="button"
                                              className="btn btn-outline btn-sm"
                                              onClick={() => navigator.clipboard.writeText(loadedLinks.roomCode || session.roomCode || '')}
                                            >
                                              Copy
                                            </button>
                                          </div>
                                          <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr auto', gap: '0.5rem', alignItems: 'center' }}>
                                            <div style={{ fontSize: '0.8rem', fontWeight: 700 }}>Join Link</div>
                                            <input className="input-field" readOnly value={loadedLinks.joinByCodeLink || `${window.location.origin}/mini-games/join${session.roomCode ? `?code=${encodeURIComponent(session.roomCode)}` : ''}`} />
                                            <button
                                              type="button"
                                              className="btn btn-outline btn-sm"
                                              onClick={() => navigator.clipboard.writeText(loadedLinks.joinByCodeLink || `${window.location.origin}/mini-games/join${session.roomCode ? `?code=${encodeURIComponent(session.roomCode)}` : ''}`)}
                                            >
                                              Copy
                                            </button>
                                          </div>
                                          <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr auto', gap: '0.5rem', alignItems: 'center' }}>
                                            <div style={{ fontSize: '0.8rem', fontWeight: 700 }}>Host Link</div>
                                            <input className="input-field" readOnly value={loadedLinks.hostLink} />
                                            <button
                                              type="button"
                                              className="btn btn-outline btn-sm"
                                              onClick={() => navigator.clipboard.writeText(loadedLinks.hostLink)}
                                            >
                                              Copy
                                            </button>
                                          </div>
                                          {loadedLinks.links.map((link) => (
                                            <div key={link.playLink} style={{ display: 'grid', gridTemplateColumns: '120px 1fr auto', gap: '0.5rem', alignItems: 'center' }}>
                                              <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>{link.teamLabel}</div>
                                              <input className="input-field" readOnly value={link.playLink} />
                                              <button
                                                type="button"
                                                className="btn btn-outline btn-sm"
                                                onClick={() => navigator.clipboard.writeText(link.playLink)}
                                              >
                                                Copy
                                              </button>
                                            </div>
                                          ))}
                                        </div>
                                      </td>
                                    </tr>
                                  )}
                                </Fragment>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>

                <div
                  className="card"
                  id="my-simulations"
                  style={{ display: location.pathname.includes('/tournaments') || showCreateMiniGame || activeContentSection !== 'simulations' ? 'none' : 'block' }}
                >
                  <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2 className="card-title">My Simulations</h2>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => {
                        if (hasCredits) {
                          setShowCreateGame(true)
                          // Scroll to top to see the form
                          window.scrollTo({ top: 0, behavior: 'smooth' })
                        }
                      }}
                      disabled={!hasCredits}
                      style={{ opacity: !hasCredits ? 0.5 : 1, cursor: !hasCredits ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap', minWidth: 'fit-content' }}
                      title={!hasCredits ? 'No credits remaining' : 'Create a new simulation'}
                    >
                      + Create New Game
                    </button>
                  </div>
                  <div className="card-body" style={{ padding: 0 }}>
                    {error && !contextGame && (
                      <div style={{ padding: '1rem 1.5rem', background: '#fee2e2', color: '#991b1b', fontSize: '0.85rem', borderBottom: '1px solid #fecaca' }}>
                        Error: {error}
                      </div>
                    )}
                    {loading && games.length === 0 ? (
                      <div className="dm-loading-chart">Loading simulations...</div>
                    ) : games.length === 0 ? (
                      <div className="dm-loading-chart">No simulations active. Use the sidebar to create your first game.</div>
                    ) : (
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr style={{ background: 'var(--bg-input)', borderBottom: '1px solid var(--border-color)' }}>
                              <th style={{ width: '40px', padding: '1rem' }}></th>
                              <th style={{ padding: '1rem 1rem 1rem 0', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Game Code</th>
                              <th style={{ padding: '1rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>PIN</th>
                              <th style={{ padding: '1rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Created</th>
                              <th style={{ padding: '1rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Structure</th>
                              <th style={{ padding: '1rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Status</th>
                              <th style={{ padding: '1rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Round Progress</th>
                              <th style={{ padding: '1rem 1rem', textAlign: 'right', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', minWidth: '180px' }}>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {activeGames.map((game) => (
                              <Fragment key={game.id}>
                                <tr className="competitor-row" style={{ display: 'table-row', borderBottom: expandedGameIds.has(game.id) ? 'none' : '1px solid #f1f5f9' }}>
                                  <td style={{ padding: '1rem', verticalAlign: 'middle', textAlign: 'center' }}>
                                    <button
                                      onClick={() => {
                                        const next = new Set(expandedGameIds)
                                        if (next.has(game.id)) next.delete(game.id)
                                        else next.add(game.id)
                                        setExpandedGameIds(next)
                                      }}
                                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', color: '#64748b', transition: 'transform 0.2s', transform: expandedGameIds.has(game.id) ? 'rotate(90deg)' : 'none', padding: '4px' }}
                                    >
                                      ▶
                                    </button>
                                  </td>
                                  <td style={{ padding: '1rem 1rem 1rem 0' }}>
                                    <div style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '1rem', letterSpacing: '0.05em' }}>{game.gameCode}</div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{game.name}</div>
                                  </td>
                                  <td style={{ padding: '1rem 1rem' }}>
                                    <div style={{ fontFamily: 'monospace', fontWeight: 700, background: 'var(--bg-input)', color: 'var(--text-primary)', padding: '2px 6px', borderRadius: '4px', width: 'fit-content' }}>{game.gamePin}</div>
                                  </td>
                                  <td style={{ padding: '1rem 1rem' }}>
                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                      {new Date(game.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                    </div>
                                  </td>
                                  <td style={{ padding: '1rem 1rem' }}>
                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{game.industry}</div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{game.teams?.length || 0} Teams</div>
                                  </td>
                                  <td style={{ padding: '1rem 1rem' }}>
                                    <span style={{
                                      padding: '0.2rem 0.6rem',
                                      borderRadius: '6px',
                                      fontSize: '0.65rem',
                                      fontWeight: 800,
                                      background: game.status === 'ACTIVE' ? '#dbeafe' : game.status === 'COMPLETED' ? '#d1fae5' : 'var(--bg-input)',
                                      color: game.status === 'ACTIVE' ? '#2563eb' : game.status === 'COMPLETED' ? '#059669' : 'var(--text-secondary)'
                                    }}>
                                      {game.status}
                                    </span>
                                    {game.status !== 'ACTIVE' && game.status !== 'COMPLETED' && (
                                      <button
                                        onClick={() => handleStartGame(game.id)}
                                        title="Start Game"
                                        style={{
                                          marginLeft: '0.5rem',
                                          padding: '0.2rem 0.4rem',
                                          fontSize: '0.8rem',
                                          background: 'transparent',
                                          border: '1px solid #10b981',
                                          borderRadius: '4px',
                                          color: '#10b981',
                                          cursor: 'pointer',
                                          verticalAlign: 'middle'
                                        }}
                                      >
                                        ▶️
                                      </button>
                                    )}
                                  </td>
                                  <td style={{ padding: '1rem 1rem' }}>
                                    <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>R{game.currentRound} / {game.totalRounds}</div>
                                    <div className="hero-prog-track" style={{ height: '4px', maxWidth: '100px', marginTop: '4px' }}>
                                      <div className="hero-prog-fill" style={{ width: `${(game.currentRound / game.totalRounds) * 100}%` }}></div>
                                    </div>
                                  </td>
                                  <td style={{ padding: '1rem 1rem', textAlign: 'right' }}>
                                    {(() => {
                                      const humanTeams = game.teams.filter((t: unknown) => !t.isComputer)
                                      const totalHuman = humanTeams.length
                                      // Find decision for current round (decisions array may not be sorted)
                                      const submittedHuman = humanTeams.filter((t: unknown) => {
                                        const currentRoundDecision = t.decisions?.find((d: unknown) => d.roundNumber === game.currentRound)
                                        return currentRoundDecision?.isSubmitted === true
                                      }).length



                                      // If no human teams, check all teams (e.g. AI only game)
                                      if (totalHuman === 0 && game.teams.length > 0) {
                                        if (game.status === 'COMPLETED') {
                                          return (
                                            <button
                                              className="btn btn-secondary btn-sm"
                                              disabled
                                              style={{
                                                padding: '0.4rem 0.8rem',
                                                fontSize: '0.75rem',
                                                marginRight: '0.5rem',
                                                background: '#e2e8f0',
                                                color: '#94a3b8',
                                                border: '1px solid #cbd5e1',
                                                cursor: 'not-allowed'
                                              }}
                                            >
                                              Completed
                                            </button>
                                          )
                                        }
                                        return (
                                          <button
                                            className="btn btn-primary btn-sm"
                                            onClick={() => handleQuickAdvance(game)}
                                            disabled={!!advancingGameId}
                                            style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem', marginRight: '0.5rem', fontWeight: 600 }}
                                          >
                                            {advancingGameId === game.id ? 'Running...' : 'Run Auto-Round'}
                                          </button>
                                        )
                                      }

                                      if (submittedHuman === totalHuman) {
                                        if (game.status === 'COMPLETED') {
                                          return (
                                            <button
                                              className="btn btn-secondary btn-sm"
                                              disabled
                                              style={{
                                                padding: '0.4rem 0.8rem',
                                                fontSize: '0.75rem',
                                                marginRight: '0.5rem',
                                                background: '#e2e8f0',
                                                color: '#94a3b8',
                                                border: '1px solid #cbd5e1',
                                                cursor: 'not-allowed'
                                              }}
                                            >
                                              Completed
                                            </button>
                                          )
                                        }
                                        const isFinalRound = game.currentRound >= game.totalRounds
                                        return (
                                          <button
                                            className="btn btn-success btn-sm"
                                            onClick={() => handleQuickAdvance(game)}
                                            disabled={!!advancingGameId}
                                            style={{
                                              padding: '0.4rem 0.8rem',
                                              fontSize: '0.75rem',
                                              marginRight: '0.5rem',
                                              fontWeight: 600,
                                              background: '#10b981',
                                              borderColor: '#059669',
                                              color: '#fff',
                                              opacity: advancingGameId === game.id ? 0.7 : 1,
                                              cursor: advancingGameId === game.id ? 'not-allowed' : 'pointer'
                                            }}
                                          >
                                            {advancingGameId === game.id ? (
                                              <>
                                                <span style={{ display: 'inline-block', marginRight: '6px' }}>⏳</span>
                                                Advancing...
                                              </>
                                            ) : isFinalRound ? (
                                              'Finalize Results'
                                            ) : (
                                              'Advance Round'
                                            )}
                                          </button>
                                        )
                                      }

                                      return (
                                        <button
                                          className="btn btn-secondary btn-sm"
                                          disabled
                                          style={{
                                            padding: '0.4rem 0.8rem',
                                            fontSize: '0.75rem',
                                            marginRight: '0.5rem',
                                            background: '#f1f5f9',
                                            color: '#64748b',
                                            border: '1px solid #cbd5e1',
                                            cursor: 'not-allowed'
                                          }}
                                        >
                                          Waiting ({submittedHuman}/{totalHuman})
                                        </button>
                                      )
                                    })()}
                                    <button
                                      className="btn btn-light btn-sm"
                                      onClick={() => {
                                        const url = `${window.location.origin}/educator-dev?gameId=${game.id}`
                                        window.open(url, '_blank')
                                      }}
                                      title="Manage Simulation"
                                      style={{
                                        padding: '0.4rem',
                                        fontSize: '1rem',
                                        background: 'transparent',
                                        border: '1px solid #e2e8f0',
                                        color: '#64748b',
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                        marginRight: '0.5rem'
                                      }}
                                    >
                                      ⚙️
                                    </button>
                                    <button
                                      onClick={() => handleArchiveGame(game.id, game.name)}
                                      title="Archive Game"
                                      className="btn btn-sm"
                                      style={{
                                        padding: '0.4rem 0.6rem',
                                        fontSize: '0.8rem',
                                        background: 'transparent',
                                        border: '1px solid #cbd5e1',
                                        borderRadius: '6px',
                                        color: '#64748b',
                                        cursor: 'pointer'
                                      }}
                                    >
                                      🗑️
                                    </button>
                                  </td>
                                </tr>
                                {expandedGameIds.has(game.id) && (
                                  <tr style={{ background: 'var(--bg-input)', borderBottom: '1px solid var(--border-color)' }}>
                                    <td colSpan={7} style={{ padding: '0 2rem 1.5rem 3.5rem', width: '100%' }}>
                                      <div style={{ marginBottom: '0.5rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Registered Teams</div>
                                      <table style={{ width: '100%', background: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.85rem', borderCollapse: 'separate', borderSpacing: 0, overflow: 'hidden' }}>
                                        <thead>
                                          <tr style={{ background: 'var(--bg-input)', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                                            <th style={{ padding: '0.5rem 1rem', textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>Team Name</th>
                                            <th style={{ padding: '0.5rem 1rem', textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>Code</th>
                                            <th style={{ padding: '0.5rem 1rem', textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>PIN</th>
                                            <th style={{ padding: '0.5rem 1rem', textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>Type</th>
                                            <th style={{ padding: '0.5rem 1rem', textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>Status</th>
                                            <th style={{ padding: '0.5rem 1rem', textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>Login</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {game.teams?.slice().sort((a: unknown, b: unknown) => a.name.localeCompare(b.name)).map((team: unknown) => {
                                            // Find the decision for the current round (decisions array may not be sorted)
                                            const currentRoundDecision = team.decisions?.find((d: unknown) => d.roundNumber === game.currentRound)
                                            const isSubmitted = currentRoundDecision?.isSubmitted === true
                                            return (
                                              <tr key={team.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                                <td style={{ padding: '0.5rem 1rem', fontWeight: 600, color: 'var(--text-primary)', borderBottom: '1px solid var(--border-color)' }}>
                                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: team.color }}></div>
                                                    {team.name}
                                                  </div>
                                                </td>
                                                <td style={{ padding: '0.5rem 1rem', fontFamily: 'monospace', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-color)' }}>{team.teamCode}</td>
                                                <td style={{ padding: '0.5rem 1rem', fontFamily: 'monospace', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-color)' }}>{team.teamPin || '-'}</td>
                                                <td style={{ padding: '0.5rem 1rem', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-color)' }}>{team.isComputer ? `AI (${team.aiDifficulty})` : 'Human'}</td>
                                                <td style={{ padding: '0.5rem 1rem', borderBottom: '1px solid var(--border-color)' }}>
                                                  {team.isComputer ? (
                                                    <span style={{ color: '#3b82f6', fontWeight: 600, fontSize: '0.75rem', background: '#dbeafe', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>Auto</span>
                                                  ) : isSubmitted ? (
                                                    <span style={{ color: '#059669', fontWeight: 600, fontSize: '0.75rem', background: '#d1fae5', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>Submitted</span>
                                                  ) : (
                                                    <span style={{ color: '#d97706', fontWeight: 600, fontSize: '0.75rem', background: '#fef3c7', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>Pending</span>
                                                  )}
                                                </td>
                                                <td style={{ padding: '0.5rem 1rem', borderBottom: '1px solid var(--border-color)' }}>
                                                  {team.isComputer ? (
                                                    <span style={{ color: 'var(--text-muted)' }}>-</span>
                                                  ) : (
                                                    <button
                                                      className="btn btn-sm btn-outline"
                                                      onClick={() => handleLoginAsTeam(team)}
                                                      disabled={teamLoginLoadingId === team.id}
                                                    >
                                                      {teamLoginLoadingId === team.id ? '...' : 'Login'}
                                                    </button>
                                                  )}
                                                </td>
                                              </tr>
                                            )
                                          })}
                                          {(!game.teams || game.teams.length === 0) && (
                                            <tr>
                                              <td colSpan={6} style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic' }}>No teams registered</td>
                                            </tr>
                                          )}
                                        </tbody>
                                      </table>

                                      {/* Financial Report Section */}
                                      <div style={{ marginTop: '1.5rem', width: '100%' }}>
                                        {(() => {
                                          const isFinancialExpanded = expandedFinancialReports[game.id] ?? false

                                          const gameConfig = (game.gameConfig && typeof game.gameConfig === 'object')
                                            ? game.gameConfig
                                            : getGameConfigForIndustry(
                                              game.industry,
                                              game.capacityPerFactory ? { capacityPerPlant: game.capacityPerFactory } : undefined
                                            )
                                          const startingBalanceSheet = (() => {
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
                                          })()
                                          const regionLabels = getRegionLabels(game)
                                          const allRounds = new Set<number>()
                                          if (game.teams) {
                                            game.teams.forEach((t: unknown) => {
                                              t.results?.forEach((r: unknown) => allRounds.add(r.roundNumber))
                                            })
                                          }
                                          if (allRounds.size === 0 && game.currentRound > 0) {
                                            allRounds.add(-1)
                                          }
                                          const startingSharePrice = gameConfig.financial?.startingSharePrice ?? 10
                                          const parValuePerShare = gameConfig.financial?.parValuePerShare ?? 10
                                          const roundMinus1 = calculateRoundMinus1(
                                            game.totalTeams ?? game.teams?.length ?? 1,
                                            gameConfig,
                                            game.scenarioSequence ?? [0],
                                            game.marketDemandMultiplier ?? 1,
                                            game.regionDemandSplit
                                          )
                                          const roundMinus1Team = roundMinus1.teams?.[0] ?? null

                                          const sortedRounds = Array.from(allRounds).sort((a, b) => b - a)
                                          const defaultRound = sortedRounds.length > 0 ? sortedRounds[0] : (game.currentRound > 0 ? game.currentRound - 1 : -1)
                                          const selectedRound = selectedFinancialRounds[game.id] ?? defaultRound
                                          const asOfLabel = selectedRound === -1 ? 'Starting Position' : `Round ${selectedRound}`

                                          if (sortedRounds.length === 0 && selectedRound === -1 && game.currentRound === 0) {
                                            return (
                                              <div style={{ padding: '1rem', textAlign: 'center', color: '#94a3b8', fontStyle: 'italic' }}>
                                                Financial results will appear after Round 1
                                              </div>
                                            )
                                          }

                                          const buildStartingRow = (team: unknown): FinancialTeamRow => {
                                            if (roundMinus1Team) {
                                              return normalizeTeamRow(
                                                { ...roundMinus1Team, teamId: team.id, teamName: team.name },
                                                team.name,
                                                roundMinus1.marketDemand,
                                                startingSharePrice,
                                                parValuePerShare
                                              )
                                            }
                                            const baseline = startingBalanceSheet
                                            const financials = calculateStartingFinancials(game, gameConfig)
                                            const revenue = financials?.revenue ?? 0
                                            const grossProfit = financials?.grossProfit ?? 0
                                            const netProfit = financials?.netProfit ?? 0
                                            const cogs = financials?.cogs ?? 0
                                            return {
                                              teamId: team.id,
                                              teamName: team.name,
                                              revenue,
                                              revenueUS: 0,
                                              revenueAsia: 0,
                                              revenueEurope: 0,
                                              cogs,
                                              materials: 0,
                                              labor: 0,
                                              logistics: 0,
                                              outsourcing: 0,
                                              grossProfit,
                                              grossMargin: revenue > 0 ? (grossProfit / revenue) * 100 : 0,
                                              operatingExpenses: financials?.operatingExpenses ?? 0,
                                              rnd: 0,
                                              marketing: 0,
                                              admin: 0,
                                              ebitda: financials?.ebitda ?? 0,
                                              depreciation: financials?.depreciation ?? 0,
                                              ebit: financials?.ebit ?? 0,
                                              interestExpense: financials?.interestExpense ?? 0,
                                              tax: financials?.tax ?? 0,
                                              taxLossCarryforward: 0,
                                              netProfit,
                                              netMargin: revenue > 0 ? (netProfit / revenue) * 100 : 0,
                                              fixedAssets: baseline.fixedAssets,
                                              inventory: baseline.inventory,
                                              receivables: 0,
                                              cash: baseline.cash,
                                              totalAssets: baseline.fixedAssets + baseline.inventory + baseline.cash,
                                              longTermDebt: baseline.longTermDebt,
                                              shortTermLoans: 0,
                                              payables: 0,
                                              totalLiabilities: baseline.longTermDebt,
                                              shareCapital: baseline.shareCapital,
                                              retainedEarnings: 0,
                                              totalEquity: baseline.shareCapital,
                                              marketShareUS: 0,
                                              marketShareAsia: 0,
                                              marketShareEurope: 0,
                                              unitsSold: 0,
                                              unitsSoldUS: 0,
                                              unitsSoldAsia: 0,
                                              unitsSoldEurope: 0,
                                              sharePrice: startingSharePrice,
                                              eps: 0,
                                              roe: 0,
                                              tsr: 0,
                                              dividendYield: 0,
                                              sharesOutstanding: Math.round((baseline.shareCapital ?? 0) / parValuePerShare),
                                              dividends: 0,
                                              sharePriceTrace: null,
                                            }
                                          }

                                          const buildFinancialRow = (team: unknown, result?: unknown): FinancialTeamRow => {
                                            if (!result || !result.fullResults) return buildStartingRow(team)
                                            return normalizeTeamRow(
                                              { ...result, teamId: team.id, teamName: team.name },
                                              team.name,
                                              result.fullResults?.marketDemand ?? null,
                                              startingSharePrice,
                                              parValuePerShare
                                            )
                                          }

                                          const resultsByTeam = new Map<string, unknown>()
                                          game.teams?.forEach((team: unknown) => {
                                            const result = team.results?.find((r: unknown) => r.roundNumber === selectedRound)
                                            if (result) {
                                              resultsByTeam.set(team.id, result)
                                            }
                                          })

                                          const financialTeams = (game.teams ?? []).map((team: unknown) =>
                                            selectedRound === -1
                                              ? buildStartingRow(team)
                                              : buildFinancialRow(team, resultsByTeam.get(team.id))
                                          )

                                          const previousTeams = new Map<string, FinancialTeamRow>()
                                          if (selectedRound > -1) {
                                            const prevRound = selectedRound - 1
                                            game.teams?.forEach((team: unknown) => {
                                              if (prevRound === -1) {
                                                previousTeams.set(team.id, buildStartingRow(team))
                                                return
                                              }
                                              const prevResult = team.results?.find((r: unknown) => r.roundNumber === prevRound)
                                              if (prevResult) {
                                                previousTeams.set(team.id, buildFinancialRow(team, prevResult))
                                              }
                                            })
                                          }

                                          const exportRounds = sortedRounds.map((roundNumber) => {
                                            const resultsByTeamForRound = new Map<string, unknown>()
                                            game.teams?.forEach((team: unknown) => {
                                              const result = team.results?.find((r: unknown) => r.roundNumber === roundNumber)
                                              if (result) {
                                                resultsByTeamForRound.set(team.id, result)
                                              }
                                            })
                                            const teamsForRound = (game.teams ?? []).map((team: unknown) =>
                                              roundNumber === -1
                                                ? buildStartingRow(team)
                                                : buildFinancialRow(team, resultsByTeamForRound.get(team.id))
                                            )
                                            return {
                                              roundNumber,
                                              label: roundNumber === -1
                                                ? 'Starting Position'
                                                : (roundNumber === 0 ? 'Trial Round' : `Round ${roundNumber}`),
                                              teams: teamsForRound,
                                            }
                                          })

                                          const exportRoundMap = new Map<number, { roundNumber: number; teams: FinancialTeamRow[] }>()
                                          exportRounds.forEach((round) => exportRoundMap.set(round.roundNumber, round))
                                          const exportRoundsWithPrev = exportRounds.map((round) => {
                                            if (round.roundNumber <= 1) return round
                                            const prev = exportRoundMap.get(round.roundNumber - 1)
                                            if (!prev) return round
                                            const prevMap = new Map<string, FinancialTeamRow>()
                                            prev.teams.forEach((team) => prevMap.set(team.teamId, team))
                                            return { ...round, previousTeams: prevMap }
                                          })

                                          return (
                                            <>
                                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                                                  Financial Report ({asOfLabel})
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                  {sortedRounds.length > 0 && (
                                                    <select
                                                      value={selectedRound}
                                                      onChange={(e) => setSelectedFinancialRounds(prev => ({ ...prev, [game.id]: Number(e.target.value) }))}
                                                      style={{
                                                        fontSize: '0.75rem',
                                                        padding: '2px 8px',
                                                        borderRadius: '4px',
                                                        border: '1px solid var(--border-color)',
                                                        color: 'var(--text-main)',
                                                        background: 'var(--bg-card)'
                                                      }}
                                                    >
                                                      {sortedRounds.map(r => (
                                                        <option key={r} value={r}>
                                                          {r === -1 ? 'Starting Position' : `Round ${r}`}
                                                        </option>
                                                      ))}
                                                    </select>
                                                  )}
                                                  <button
                                                    type="button"
                                                    onClick={() => toggleFinancialReport(game.id)}
                                                    className="btn btn-light btn-sm"
                                                    style={{
                                                      padding: '0.35rem 0.6rem',
                                                      fontSize: '0.75rem',
                                                      borderRadius: '6px'
                                                    }}
                                                  >
                                                    {isFinancialExpanded ? 'Hide Report' : 'Show Report'}
                                                  </button>
                                                </div>
                                              </div>
                                              {isFinancialExpanded && (
                                                <div style={{ width: '100%' }}>
                                                  <FinancialReport
                                                    title={`${game.name} Financial Report`}
                                                    subtitle={game.companyName ? `${game.companyName} • ${game.industry}` : undefined}
                                                    asOf={asOfLabel}
                                                    teams={financialTeams}
                                                    previousTeams={previousTeams}
                                                    exportRounds={exportRoundsWithPrev}
                                                    emphasis="bold"
                                                    allowSummaryBreakdown={false}
                                                    regionLabels={regionLabels}
                                                    startingBalanceSheet={startingBalanceSheet}
                                                    currentRound={selectedRound}
                                                  />
                                                </div>
                                              )}
                                            </>
                                          )
                                        })()}
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </Fragment>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>

              </div>
            </section>

            {
              archivedGames.length > 0 && !location.pathname.includes('/tournaments') && activeContentSection === 'simulations' && (
                <section className="dm-content" style={{ marginTop: '2rem' }}>
                  <div style={{ padding: '0 2rem' }}>
                    <button
                      onClick={() => setShowArchived(!showArchived)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#64748b',
                        fontSize: '0.9rem',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        cursor: 'pointer',
                        marginBottom: '1rem'
                      }}
                    >
                      <span>{showArchived ? '▼' : '▶'}</span>
                      Archived / Completed ({archivedGames.length})
                    </button>

                    {showArchived && (
                      <div className="card">
                        <div style={{ overflowX: 'auto' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                              <tr style={{ background: 'var(--bg-input)', borderBottom: '1px solid var(--border-color)' }}>
                                <th style={{ width: '40px', padding: '1rem' }}></th>
                                <th style={{ padding: '1rem 1rem 1rem 0', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Game Code</th>
                                <th style={{ padding: '1rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Structure</th>
                                <th style={{ padding: '1rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Status</th>
                                <th style={{ padding: '1rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Round Progress</th>
                                <th style={{ padding: '1rem 1rem', textAlign: 'right', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', minWidth: '120px' }}>Actions</th>
                              </tr>
                            </thead>
                            <tbody style={{ opacity: 0.7 }}>
                              {archivedGames.map(game => (
                                <Fragment key={game.id}>
                                  <tr key={game.id} style={{ borderBottom: expandedGameIds.has(game.id) ? 'none' : '1px solid var(--border-color)' }}>
                                    <td style={{ padding: '1rem', verticalAlign: 'middle', textAlign: 'center' }}>
                                      <button
                                        onClick={() => {
                                          const next = new Set(expandedGameIds)
                                          if (next.has(game.id)) next.delete(game.id)
                                          else next.add(game.id)
                                          setExpandedGameIds(next)
                                        }}
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', color: '#64748b', transition: 'transform 0.2s', transform: expandedGameIds.has(game.id) ? 'rotate(90deg)' : 'none', padding: '4px' }}
                                      >
                                        ▶
                                      </button>
                                    </td>
                                    <td style={{ padding: '1rem 1rem 1rem 0' }}>
                                      <div style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '1rem', letterSpacing: '0.05em' }}>{game.gameCode}</div>
                                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{game.name}</div>
                                    </td>
                                    <td style={{ padding: '1rem 1rem' }}>
                                      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{game.industry}</div>
                                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{game.teams?.length || 0} Teams</div>
                                    </td>
                                    <td style={{ padding: '1rem 1rem' }}>
                                      <span style={{ padding: '0.2rem 0.6rem', borderRadius: '6px', fontSize: '0.65rem', fontWeight: 800, background: 'var(--bg-subtle)', color: 'var(--text-secondary)' }}>
                                        ARCHIVED
                                      </span>
                                    </td>

                                    <td style={{ padding: '1rem 1rem' }}>
                                      <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>R{game.currentRound} / {game.totalRounds}</div>
                                    </td>
                                    <td style={{ padding: '1rem 1rem', textAlign: 'right' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.5rem' }}>
                                        <button
                                          className="btn btn-light btn-sm"
                                          onClick={() => {
                                            const url = `${window.location.origin}/educator-dev?gameId=${game.id}`
                                            window.open(url, '_blank')
                                          }}
                                          title="Manage Simulation"
                                          style={{
                                            padding: '0.4rem',
                                            fontSize: '1rem',
                                            background: 'transparent',
                                            border: '1px solid var(--border-color)',
                                            color: '#64748b',
                                            borderRadius: '6px',
                                            cursor: 'pointer'
                                          }}
                                        >
                                          ⚙️
                                        </button>
                                        <button
                                          onClick={() => handleUnarchiveGame(game.id, game.name)}
                                          title="Unarchive / Restore Game"
                                          className="btn btn-sm"
                                          style={{
                                            padding: '0.3rem 0.5rem',
                                            fontSize: '1rem',
                                            background: 'transparent',
                                            border: '1px solid var(--border-color)',
                                            borderRadius: '6px',
                                            color: '#10b981',
                                            cursor: 'pointer'
                                          }}
                                        >
                                          ↩️
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                  {expandedGameIds.has(game.id) && (
                                    <tr style={{ background: 'var(--bg-input)', borderBottom: '1px solid var(--border-color)' }}>
                                      <td colSpan={7} style={{ padding: '0 2rem 1.5rem 3.5rem', width: '100%' }}>
                                        <div style={{ marginBottom: '0.5rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Registered Teams</div>
                                        <table style={{ width: '100%', background: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.85rem', borderCollapse: 'separate', borderSpacing: 0, overflow: 'hidden' }}>
                                          <thead>
                                            <tr style={{ background: 'var(--bg-input)', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                                              <th style={{ padding: '0.5rem 1rem', textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>Team Name</th>
                                              <th style={{ padding: '0.5rem 1rem', textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>Code</th>
                                              <th style={{ padding: '0.5rem 1rem', textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>PIN</th>
                                              <th style={{ padding: '0.5rem 1rem', textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>Type</th>
                                              <th style={{ padding: '0.5rem 1rem', textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>Status</th>
                                              <th style={{ padding: '0.5rem 1rem', textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>Login</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {game.teams?.slice().sort((a: unknown, b: unknown) => a.name.localeCompare(b.name)).map((team: unknown) => {
                                              // Find the decision for the current round (decisions array may not be sorted)
                                              const currentRoundDecision = team.decisions?.find((d: unknown) => d.roundNumber === game.currentRound)
                                              const isSubmitted = currentRoundDecision?.isSubmitted === true
                                              return (
                                                <tr key={team.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                                  <td style={{ padding: '0.5rem 1rem', fontWeight: 600, color: 'var(--text-primary)', borderBottom: '1px solid var(--border-color)' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                      <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: team.color }}></div>
                                                      {team.name}
                                                    </div>
                                                  </td>
                                                  <td style={{ padding: '0.5rem 1rem', fontFamily: 'monospace', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-color)' }}>{team.teamCode}</td>
                                                  <td style={{ padding: '0.5rem 1rem', fontFamily: 'monospace', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-color)' }}>{team.teamPin || '-'}</td>
                                                  <td style={{ padding: '0.5rem 1rem', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-color)' }}>{team.isComputer ? `AI (${team.aiDifficulty})` : 'Human'}</td>
                                                  <td style={{ padding: '0.5rem 1rem', borderBottom: '1px solid var(--border-color)' }}>
                                                    {team.isComputer ? (
                                                      <span style={{ color: '#3b82f6', fontWeight: 600, fontSize: '0.75rem', background: '#dbeafe', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>Auto</span>
                                                    ) : isSubmitted ? (
                                                      <span style={{ color: '#059669', fontWeight: 600, fontSize: '0.75rem', background: '#d1fae5', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>Submitted</span>
                                                    ) : (
                                                      <span style={{ color: '#d97706', fontWeight: 600, fontSize: '0.75rem', background: '#fef3c7', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>Pending</span>
                                                    )}
                                                  </td>
                                                  <td style={{ padding: '0.5rem 1rem', borderBottom: '1px solid var(--border-color)' }}>
                                                    {team.isComputer ? (
                                                      <span style={{ color: 'var(--text-muted)' }}>-</span>
                                                    ) : (
                                                      <button
                                                        className="btn btn-sm btn-outline"
                                                        onClick={() => handleLoginAsTeam(team)}
                                                        disabled={teamLoginLoadingId === team.id}
                                                      >
                                                        {teamLoginLoadingId === team.id ? '...' : 'Login'}
                                                      </button>
                                                    )}
                                                  </td>
                                                </tr>
                                              )
                                            })}
                                          </tbody>
                                        </table>

                                        {/* Financial Report Section */}
                                        <div style={{ marginTop: '1.5rem', width: '100%' }}>
                                          {(() => {
                                            const isFinancialExpanded = expandedFinancialReports[game.id] ?? false
  
                                            const gameConfig = (game.gameConfig && typeof game.gameConfig === 'object')
                                              ? game.gameConfig
                                              : getGameConfigForIndustry(
                                                game.industry,
                                                game.capacityPerFactory ? { capacityPerPlant: game.capacityPerFactory } : undefined
                                              )
                                            const startingBalanceSheet = (() => {
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
                                            })()
                                            const regionLabels = getRegionLabels(game)
                                            const allRounds = new Set<number>()
                                            if (game.teams) {
                                              game.teams.forEach((t: unknown) => {
                                                t.results?.forEach((r: unknown) => allRounds.add(r.roundNumber))
                                              })
                                            }
                                            if (allRounds.size === 0 && game.currentRound > 0) {
                                              allRounds.add(-1)
                                            }
                                            const startingSharePrice = gameConfig.financial?.startingSharePrice ?? 10
                                            const parValuePerShare = gameConfig.financial?.parValuePerShare ?? 10
                                            const roundMinus1 = calculateRoundMinus1(
                                              game.totalTeams ?? game.teams?.length ?? 1,
                                              gameConfig,
                                              game.scenarioSequence ?? [0],
                                              game.marketDemandMultiplier ?? 1,
                                              game.regionDemandSplit
                                            )
                                            const roundMinus1Team = roundMinus1.teams?.[0] ?? null

                                            const sortedRounds = Array.from(allRounds).sort((a, b) => b - a)
                                            const defaultRound = sortedRounds.length > 0 ? sortedRounds[0] : (game.currentRound > 0 ? game.currentRound - 1 : -1)
                                            const selectedRound = selectedFinancialRounds[game.id] ?? defaultRound
                                            const asOfLabel = selectedRound === -1 ? 'Starting Position' : `Round ${selectedRound}`

                                            if (sortedRounds.length === 0 && selectedRound === -1 && game.currentRound === 0) {
                                              return (
                                                <div style={{ padding: '1rem', textAlign: 'center', color: '#94a3b8', fontStyle: 'italic' }}>
                                                  Financial results will appear after Round 1
                                                </div>
                                              )
                                            }

                                            const buildStartingRow = (team: unknown): FinancialTeamRow => {
                                              if (roundMinus1Team) {
                                                return normalizeTeamRow(
                                                  { ...roundMinus1Team, teamId: team.id, teamName: team.name },
                                                  team.name,
                                                  roundMinus1.marketDemand,
                                                  startingSharePrice,
                                                  parValuePerShare
                                                )
                                              }
                                              const baseline = startingBalanceSheet
                                              const financials = calculateStartingFinancials(game, gameConfig)
                                              const revenue = financials?.revenue ?? 0
                                              const grossProfit = financials?.grossProfit ?? 0
                                              const netProfit = financials?.netProfit ?? 0
                                              const cogs = financials?.cogs ?? 0
                                              return {
                                                teamId: team.id,
                                                teamName: team.name,
                                                revenue,
                                                revenueUS: 0,
                                                revenueAsia: 0,
                                                revenueEurope: 0,
                                                cogs,
                                                materials: 0,
                                                labor: 0,
                                                logistics: 0,
                                                outsourcing: 0,
                                                grossProfit,
                                                grossMargin: revenue > 0 ? (grossProfit / revenue) * 100 : 0,
                                                operatingExpenses: financials?.operatingExpenses ?? 0,
                                                rnd: 0,
                                                marketing: 0,
                                                admin: 0,
                                                ebitda: financials?.ebitda ?? 0,
                                                depreciation: financials?.depreciation ?? 0,
                                                ebit: financials?.ebit ?? 0,
                                                interestExpense: financials?.interestExpense ?? 0,
                                                tax: financials?.tax ?? 0,
                                                taxLossCarryforward: 0,
                                                netProfit,
                                                netMargin: revenue > 0 ? (netProfit / revenue) * 100 : 0,
                                                fixedAssets: baseline.fixedAssets,
                                                inventory: baseline.inventory,
                                                receivables: 0,
                                                cash: baseline.cash,
                                                totalAssets: baseline.fixedAssets + baseline.inventory + baseline.cash,
                                                longTermDebt: baseline.longTermDebt,
                                                shortTermLoans: 0,
                                                payables: 0,
                                                totalLiabilities: baseline.longTermDebt,
                                                shareCapital: baseline.shareCapital,
                                                retainedEarnings: 0,
                                                totalEquity: baseline.shareCapital,
                                                marketShareUS: 0,
                                                marketShareAsia: 0,
                                                marketShareEurope: 0,
                                                unitsSold: 0,
                                                unitsSoldUS: 0,
                                                unitsSoldAsia: 0,
                                                unitsSoldEurope: 0,
                                                sharePrice: startingSharePrice,
                                                eps: 0,
                                                roe: 0,
                                                tsr: 0,
                                                dividendYield: 0,
                                                sharesOutstanding: Math.round((baseline.shareCapital ?? 0) / parValuePerShare),
                                                dividends: 0,
                                                sharePriceTrace: null,
                                              }
                                            }

                                            const buildFinancialRow = (team: unknown, result?: unknown): FinancialTeamRow => {
                                              if (!result || !result.fullResults) return buildStartingRow(team)
                                              return normalizeTeamRow(
                                                { ...result, teamId: team.id, teamName: team.name },
                                                team.name,
                                                result.fullResults?.marketDemand ?? null,
                                                startingSharePrice,
                                                parValuePerShare
                                              )
                                            }

                                            const resultsByTeam = new Map<string, unknown>()
                                            game.teams?.forEach((team: unknown) => {
                                              const result = team.results?.find((r: unknown) => r.roundNumber === selectedRound)
                                              if (result) {
                                                resultsByTeam.set(team.id, result)
                                              }
                                            })

                                            const financialTeams = (game.teams ?? []).map((team: unknown) =>
                                              selectedRound === -1
                                                ? buildStartingRow(team)
                                                : buildFinancialRow(team, resultsByTeam.get(team.id))
                                            )

                                            const previousTeams = new Map<string, FinancialTeamRow>()
                                            if (selectedRound > -1) {
                                              const prevRound = selectedRound - 1
                                              game.teams?.forEach((team: unknown) => {
                                                if (prevRound === -1) {
                                                  previousTeams.set(team.id, buildStartingRow(team))
                                                  return
                                                }
                                                const prevResult = team.results?.find((r: unknown) => r.roundNumber === prevRound)
                                                if (prevResult) {
                                                  previousTeams.set(team.id, buildFinancialRow(team, prevResult))
                                                }
                                              })
                                            }

                                            const exportRounds = sortedRounds.map((roundNumber) => {
                                              const resultsByTeamForRound = new Map<string, unknown>()
                                              game.teams?.forEach((team: unknown) => {
                                                const result = team.results?.find((r: unknown) => r.roundNumber === roundNumber)
                                                if (result) {
                                                  resultsByTeamForRound.set(team.id, result)
                                                }
                                              })
                                              const teamsForRound = (game.teams ?? []).map((team: unknown) =>
                                                roundNumber === -1
                                                  ? buildStartingRow(team)
                                                  : buildFinancialRow(team, resultsByTeamForRound.get(team.id))
                                              )
                                              return {
                                                roundNumber,
                                                label: roundNumber === -1
                                                  ? 'Starting Position'
                                                  : (roundNumber === 0 ? 'Trial Round' : `Round ${roundNumber}`),
                                                teams: teamsForRound,
                                              }
                                            })

                                            const exportRoundMap = new Map<number, { roundNumber: number; teams: FinancialTeamRow[] }>()
                                            exportRounds.forEach((round) => exportRoundMap.set(round.roundNumber, round))
                                            const exportRoundsWithPrev = exportRounds.map((round) => {
                                              if (round.roundNumber <= 1) return round
                                              const prev = exportRoundMap.get(round.roundNumber - 1)
                                              if (!prev) return round
                                              const prevMap = new Map<string, FinancialTeamRow>()
                                              prev.teams.forEach((team) => prevMap.set(team.teamId, team))
                                              return { ...round, previousTeams: prevMap }
                                            })

                                            return (
                                              <>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                                                    Financial Report ({asOfLabel})
                                                  </div>
                                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                    {sortedRounds.length > 0 && (
                                                      <select
                                                        value={selectedRound}
                                                        onChange={(e) => setSelectedFinancialRounds(prev => ({ ...prev, [game.id]: Number(e.target.value) }))}
                                                        style={{
                                                          fontSize: '0.75rem',
                                                          padding: '2px 8px',
                                                          borderRadius: '4px',
                                                          border: '1px solid var(--border-color)',
                                                          color: 'var(--text-main)',
                                                          background: 'var(--bg-card)'
                                                        }}
                                                      >
                                                        {sortedRounds.map(r => (
                                                          <option key={r} value={r}>
                                                            {r === -1 ? 'Starting Position' : `Round ${r}`}
                                                          </option>
                                                        ))}
                                                      </select>
                                                    )}
                                                    <button
                                                      type="button"
                                                      onClick={() => toggleFinancialReport(game.id)}
                                                      className="btn btn-light btn-sm"
                                                      style={{
                                                        padding: '0.35rem 0.6rem',
                                                        fontSize: '0.75rem',
                                                        borderRadius: '6px'
                                                      }}
                                                    >
                                                      {isFinancialExpanded ? 'Hide Report' : 'Show Report'}
                                                    </button>
                                                  </div>
                                                </div>
                                                {isFinancialExpanded && (
                                                  <div style={{ width: '100%' }}>
                                                    <FinancialReport
                                                      title={`${game.name} Financial Report`}
                                                      subtitle={game.companyName ? `${game.companyName} • ${game.industry}` : undefined}
                                                      asOf={asOfLabel}
                                                      teams={financialTeams}
                                                      previousTeams={previousTeams}
                                                      exportRounds={exportRoundsWithPrev}
                                                      emphasis="bold"
                                                      allowSummaryBreakdown={false}
                                                      regionLabels={regionLabels}
                                                      startingBalanceSheet={startingBalanceSheet}
                                                      currentRound={selectedRound}
                                                    />
                                                  </div>
                                                )}
                                              </>
                                            )
                                          })()}
                                        </div>
                                      </td>
                                    </tr>
                                  )}
                                </Fragment>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                </section>
              )
            }
          </div >
        </main >
      </div >

      <style>{`
         .dashboard-modern-scoped .dm-shell {
           min-height: 100vh;
           height: auto;
           overflow: visible;
         }
         .dashboard-modern-scoped .dm-sidebar {
           border-right: 1px solid var(--border-color) !important;
           height: auto;
           overflow: visible !important;
         }
         .dashboard-modern-scoped .dm-main {
           overflow: visible !important;
         }
         .dashboard-modern-scoped .dm-header { border-bottom: 1px solid var(--border-color) !important; }
         .dashboard-modern-scoped .dm-session { border: 1px solid var(--border-color) !important; background: var(--bg-card) !important; }
         .dashboard-modern-scoped .card { background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 12px; }
         .dashboard-modern-scoped .card-header { padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--border-color); }
         .dashboard-modern-scoped .card-title { font-size: 1.1rem; font-weight: 800; color: var(--text-main); margin: 0; }
         .dashboard-modern-scoped .dm-nav-item {
           font-size: 0.9rem;
           padding: 0.66rem 0.85rem;
           gap: 0.4rem;
         }
         .dashboard-modern-scoped .dm-subnav {
           order: 1;
         }
         .dashboard-modern-scoped .dm-nav {
           order: 2;
         }
         .dashboard-modern-scoped .dm-sidebar-footer {
           order: 3;
         }
         .dashboard-modern-scoped .dm-nav-category-items {
           gap: 0.12rem;
           padding-left: 0.55rem;
         }
         .dashboard-modern-scoped .dm-nav-category-items .dm-nav-item {
           padding-top: 0.2rem;
           padding-bottom: 0.2rem;
         }
         .dashboard-modern-scoped .dm-nav-label {
           min-width: 0;
           overflow: hidden;
           text-overflow: ellipsis;
           white-space: nowrap;
         }
         .dashboard-modern-scoped .dm-nav-beta {
           margin-left: auto;
           flex-shrink: 0;
           font-size: 0.43rem;
           padding: 0.08rem 0.22rem;
           letter-spacing: 0.01em;
         }
         .dashboard-modern-scoped .mini-game-card {
           overflow: hidden;
         }
         .dashboard-modern-scoped .mini-game-title {
           min-width: 0;
           overflow: hidden;
           text-overflow: ellipsis;
           white-space: nowrap;
         }
         .dashboard-modern-scoped .mini-game-blurb {
           overflow: hidden;
           display: -webkit-box;
           -webkit-line-clamp: 3;
           -webkit-box-orient: vertical;
         }
         .dashboard-modern-scoped .mini-game-cta {
           width: 100% !important;
           max-width: 100% !important;
           box-sizing: border-box !important;
           margin-top: auto !important;
           padding: 0.72rem 0.85rem !important;
           white-space: nowrap !important;
           overflow: hidden !important;
           text-overflow: ellipsis !important;
         }
         .dashboard-modern-scoped .input-field { 
           width: 100%; border: 1px solid var(--border-color); border-radius: 8px; padding: 0.6rem 0.75rem; 
           background: var(--bg-card); color: var(--text-main);
           font-family: inherit; font-size: 0.9rem; transition: all 0.2s;
         }
         .dashboard-modern-scoped .input-field:focus { border-color: var(--text-accent); box-shadow: 0 0 0 2px var(--bg-hover); outline: none; }
         .dashboard-modern-scoped .input-field option { background: var(--bg-card); color: var(--text-main); }
         
         [data-theme='dark'] .dashboard-modern-scoped .input-field {
           background: var(--bg-page);
           color: var(--text-main);
           border-color: var(--border-color);
         }
         
         [data-theme='dark'] .dashboard-modern-scoped .input-field option {
           background: var(--bg-page);
           color: var(--text-main);
         }
        

        .btn-primary {
          background-color: #2563eb;
          color: white;
          border: 1px solid #2563eb;
          width: fit-content;
        }

        .btn-primary:hover {
          background-color: #1d4ed8 !important;
          color: white !important;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(37, 99, 235, 0.2);
        }

        .btn-secondary:hover {
          background-color: #f1f5f9 !important;
          color: #0f172a !important;
        }

        .dashboard-modern-scoped .btn-light {
          background: var(--bg-card) !important;
          color: var(--text-main) !important;
          border: 1px solid var(--border-color) !important;
        }

        .dashboard-modern-scoped .btn-light:hover {
          background: var(--bg-hover) !important;
          color: var(--text-main) !important;
          border-color: var(--border-dark) !important;
        }

        .dashboard-modern-scoped .btn-light:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .dm-session:hover {
          background-color: var(--bg-hover) !important;
          border-color: var(--text-main) !important;
        }

        .dm-theme-toggle {
          background: transparent;
          border: 1px solid var(--border-color);
          color: var(--text-main);
          width: 38px;
          height: 38px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          font-size: 1.1rem;
          transition: all 0.2s ease;
          padding: 0;
        }
        .dm-theme-toggle:hover {
          background: var(--bg-hover);
          border-color: var(--text-main);
          transform: translateY(-1px);
        }

        .dm-loading-chart {
          display: flex;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 4rem 2rem;
          min-height: 200px;
          color: #94a3b8;
          font-size: 0.95rem;
          line-height: 1.5;
        }

        .dm-email-textarea {
          width: 100%;
          min-height: 200px;
          padding: 12px;
          border-radius: 8px;
          border: 1px solid var(--border-color);
          font-size: 0.85rem;
          color: var(--text-main);
          background: var(--bg-card);
          resize: vertical;
          font-family: monospace;
          line-height: 1.4;
          scrollbar-width: thin;
          scrollbar-color: var(--border-dark) transparent;
        }
        .dm-email-textarea::-webkit-scrollbar {
          width: 8px;
        }
        .dm-email-textarea::-webkit-scrollbar-track {
          background: transparent;
        }
        .dm-email-textarea::-webkit-scrollbar-thumb {
          background: var(--border-dark);
          border-radius: 20px;
          border: 2px solid var(--bg-card);
        }
        .dm-email-textarea::-webkit-scrollbar-thumb:hover {
          background: var(--text-muted);
        }
      `}</style>
    </div >
  )
}




