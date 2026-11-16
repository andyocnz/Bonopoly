import { useCallback, useEffect, useMemo, useRef, useState, Fragment, memo, lazy, Suspense } from 'react'
import { ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList } from 'recharts'
import { useLocation, useNavigate } from 'react-router-dom'
import { SidebarFooter } from '../components/SidebarFooter'
import { useGame } from '../context/GameContext'
import { authApi, teamApi } from '../api/client'
import { useTheme } from '../context/ThemeContext'
import { FinancialReport } from '../components/FinancialReport'
import { AuditStage3Table } from '../components/AuditPhase2Table'
import { AuditStage2Table } from '../components/AuditPhase1Table'
import { calculateRoundMinus1, formatCurrency, formatPercent, formatUnits, getBalancedStartingFinancials, getGameConfigForIndustry, getScenarioEffectsForRound } from '../engine/gameEngine'
import { generateLocalCoachInsights } from '../engine/localAi'
import { getRegionLabels } from '../utils/regionLabels'
import { applyLogisticsTariffModifiers, calculateLogisticsAllocation, calculateTotalLogisticsCost } from '../utils/logisticsAllocation'
import { useReviewData } from '../hooks/useReviewData'
import { Fireworks } from '../components/Fireworks'
import { normalizeTeamRow } from '../utils/normalizeTeamRow'
import type { TeamRow } from '../utils/normalizeTeamRow'
import { CliPhaseLoader } from '../components/CliPhaseLoader'
import './DecisionsModernPage.css'
import './DashboardModernPage.css'

// --- Helper Types ---

type NormalizedRound = {
  roundNumber: number
  teams: TeamRow[]
  marketDemand?: { us: number; asia: number; europe: number }
}
type ResultsTab = 'leaderboard' | 'summary' | 'highlights' | 'market-economics' | 'financials'
type MetricRoundPoint = { round: string } & Record<string, number | string>
type RawRoundEntry = {
  roundNumber?: number
  round?: number
  teams?: Array<Record<string, unknown>>
  marketDemand?: { us?: number; asia?: number; europe?: number }
}

type FinancialTeamRow = TeamRow
type RankMetric = 'sharePrice' | 'netProfit' | 'unitsSold' | 'marketShare' | 'eps'

const MarketEconomicsSection = lazy(() =>
  import('../components/MarketEconomicsSection').then((module) => ({ default: module.MarketEconomicsSection }))
)

// --- Round Analysis helpers ---
type AnalysisMetric = { key: keyof TeamRow; label: string; icon: string }
const ANALYSIS_METRICS: AnalysisMetric[] = [
  { key: 'sharePrice', label: 'Share Price', icon: '📈' },
  { key: 'netProfit', label: 'Net Profit', icon: '💰' },
  { key: 'revenue', label: 'Revenue', icon: '📊' },
  { key: 'unitsSold', label: 'Units Sold', icon: '📦' },
  { key: 'grossMargin', label: 'Gross Margin', icon: '🎯' },
  { key: 'netMargin', label: 'Net Margin', icon: '📉' },
  { key: 'eps', label: 'EPS', icon: '💲' },
  { key: 'roe', label: 'ROE', icon: '🔄' },
  { key: 'tsr', label: 'TSR', icon: '🚀' },
]

function buildRoundAnalysis(teams: TeamRow[]) {
  const n = teams.length
  if (n < 2) return []
  return teams.map((team) => {
    const ranked = ANALYSIS_METRICS
      .map((m) => {
        const val = team[m.key] as number
        if (val === 0 || val == null) return null
        const sorted = [...teams].sort((a, b) => (b[m.key] as number) - (a[m.key] as number))
        const rank = sorted.findIndex((t) => t.teamId === team.teamId) + 1
        return { ...m, rank }
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
    const strengths = ranked
      .filter((m) => m.rank === 1)
      .concat(ranked.filter((m) => m.rank <= Math.ceil(n * 0.35) && m.rank !== 1))
      .slice(0, 3)
    const weaknesses = ranked
      .filter((m) => m.rank === n)
      .concat(ranked.filter((m) => m.rank >= Math.ceil(n * 0.65) && m.rank !== n))
      .slice(0, 2)
    const avg = (key: keyof TeamRow) => teams.reduce((s, t) => s + (t[key] as number), 0) / n
    let insight = ''
    if (team.netMargin < avg('netMargin') * 0.8 && team.revenue > avg('revenue') * 1.1) {
      insight = 'High volume but thin margins — focus on cost control or pricing power.'
    } else if (team.netMargin > avg('netMargin') * 1.2 && team.revenue < avg('revenue') * 0.9) {
      insight = 'Excellent margins on a smaller base — scale up while protecting quality.'
    } else if (team.tsr < 0) {
      insight = 'Negative shareholder return this round — review pricing and cost structure.'
    } else if (team.sharePrice > avg('sharePrice') * 1.15) {
      insight = 'Strong share price — investors are backing your strategy.'
    } else if (team.roe < avg('roe') * 0.8) {
      insight = 'ROE below class average — capital is not being deployed efficiently.'
    } else if (team.unitsSold < avg('unitsSold') * 0.8) {
      insight = 'Below-average sales volume — review pricing and market coverage.'
    }
    return { team, strengths, weaknesses, insight }
  })
}

// --- Main Component ---

const MAIN_NAV = [
  { id: 'mission', label: 'Mission', path: '/mission' },
  { id: 'results', label: 'Results', path: '/results' },
  { id: 'decisions', label: 'Decisions ⚡', path: '/decisions' },
]

const StepProgress = ({ value, max, color = 'var(--text-accent)' }: { value: number, max: number, color?: string }) => {
  const segments = 10;
  const activeCount = Math.min(segments, Math.max(0, Math.round((value / max) * segments)));
  return (
    <div style={{ display: 'flex', gap: '2px', alignItems: 'center', justifyContent: 'center', width: '100%', maxWidth: '120px' }}>
      {Array.from({ length: segments }).map((_, i) => (
        <div
          key={i}
          style={{
            flex: 1,
            height: '8px',
            borderRadius: '1px',
            backgroundColor: i < activeCount ? color : 'var(--text-main)',
            opacity: i < activeCount ? 1 : 0.08,
            transition: 'all 0.3s ease'
          }}
        />
      ))}
    </div>
  );
};

const LeafProgress = ({ value, max, color = '#10b981' }: { value: number, max: number, color?: string }) => {
  const segments = 5;
  const activeCount = Math.min(segments, Math.max(0, Math.round((value / max) * segments)));
  return (
    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
      {Array.from({ length: segments }).map((_, i) => (
        <svg key={i} width="16" height="16" viewBox="0 0 24 24" style={{
          color: i < activeCount ? color : 'var(--text-main)',
          opacity: i < activeCount ? 1 : 0.08,
          transition: 'all 0.2s ease'
        }}>
          <path fill="currentColor" d="M17,8C8,10 5.9,16.17 3.82,21.34L5.71,22L6.66,19.7C7.14,19.87 7.64,20 8.16,20C12.35,20 16,16.35 16,12.16C16,11.03 15.75,9.96 15.3,9C15.75,9 16.19,9.08 16.61,9.23C18.15,9.74 19.33,11.07 19.81,12.71L21.74,12.14C21.05,9.75 19.34,7.85 17,7.07V3H15V7.1C14.04,7.03 13.04,7.1 12.04,7.34C11.38,7.5 10.74,7.74 10.14,8.04C6.54,9.84 5,14 5,14L3,14L1,18H5.16C5.5,18 5.86,18.12 6.18,18.33C6.46,18.5 6.75,18.7 7.04,18.91C7.32,19.12 7.6,19.33 7.89,19.54C11.52,22.14 16,22 16,22H21V20H16C16,20 12.56,20.1 10.45,18.59L9.13,17.65C8.82,17.42 8.52,17.18 8.24,16.92C7.96,16.67 7.69,16.42 7.42,16.16L6.5,15.25C9,12 13,10 17,8Z" />
        </svg>
      ))}
    </div>
  );
};

const PillProgress = ({ value, max, color = '#10b981' }: { value: number, max: number, color?: string }) => {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div style={{
      width: '100%',
      maxWidth: '120px',
      height: '8px',
      backgroundColor: 'rgba(100, 116, 139, 0.12)',
      borderRadius: '4px',
      position: 'relative',
      overflow: 'hidden'
    }}>
      <div style={{
        position: 'absolute',
        left: 0,
        top: 0,
        height: '100%',
        width: `${percentage}%`,
        backgroundColor: color,
        borderRadius: '4px',
        boxShadow: `0 0 12px ${color}66`,
        transition: 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1)'
      }} />
    </div>
  );
};

// Unused for now - may be needed for future UI enhancements
// const RecordRow = ({ label, graphic, value, isSub = false }: { label: string, graphic: React.ReactNode, value: string | number, isSub?: boolean }) => (
//   <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
//     <td style={{ padding: '12px 0', fontSize: '0.8rem', color: isSub ? 'var(--text-secondary)' : 'var(--text-main)', fontWeight: isSub ? 500 : 700, width: '100px' }}>
//       <div style={{ paddingLeft: isSub ? '16px' : '0' }}>{label}</div>
//     </td>
//     <td style={{ padding: '12px 16px', height: '44px', display: 'flex', alignItems: 'center' }}>
//       {graphic}
//     </td>
//     <td style={{ textAlign: 'right', verticalAlign: 'middle', fontWeight: 700, fontSize: '0.75rem', color: 'var(--text-main)', width: '60px' }}>
//       {value}
//     </td>
//   </tr>
// );

// Memoized chart component to prevent unnecessary re-renders
const PerformanceChart = memo<{
  metricByRound: MetricRoundPoint[]
  metricView: 'revenue' | 'units' | 'netProfit' | 'sharePrice'
  regionLabels: { us: string; asia: string; europe: string }
}>(({ metricByRound, metricView, regionLabels }) => {
  const showRegions = metricView === 'revenue' || metricView === 'units'

  const formatMetricValue = (value: number) => {
    if (metricView === 'units') return formatUnits(value)
    if (metricView === 'sharePrice') return formatCurrency(value)
    return formatCurrency(value)
  }

  const formatYAxis = (value: number) => {
    if (metricView === 'units') return formatUnits(value)
    if (metricView === 'sharePrice') return `$${value.toFixed(0)}`
    return `$${(value / 1000000).toFixed(0)}M`
  }

  if (metricByRound.length === 0) {
    return (
      <div className="revenue-empty">
        No round data available yet
      </div>
    )
  }

  return (
    <div style={{ width: '100%', height: 320 }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={metricByRound}
          margin={{ top: 20, right: 30, left: 10, bottom: 20 }}
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" opacity={0.5} />
          <XAxis
            dataKey="name"
            axisLine={false}
            tickLine={false}
            tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
            dy={10}
          />
          <YAxis
            hide={false}
            axisLine={false}
            tickLine={false}
            tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
            tickFormatter={formatYAxis}
            domain={metricView === 'sharePrice' ? ['auto', 'auto'] : ['dataMin * 0.5', 'auto']}
          />
          <Tooltip
            cursor={{ fill: 'var(--bg-hover)', opacity: 0.4 }}
            contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 8, boxShadow: 'var(--shadow-card)' }}
            formatter={(value: number) => [formatMetricValue(value), '']}
          />
          <Legend iconType="circle" />

          {metricView === 'units' ? (
            <>
              <Bar dataKey="unitsSold" fill="#3b82f6" name="Units Sold" barSize={40} />
              <Bar dataKey="inventory" fill="#f59e0b" name="Ending Inventory" barSize={40} />
            </>
          ) : showRegions ? (
            <>
              <Bar dataKey={regionLabels.us} stackId="a" fill="#3b82f6" name={regionLabels.us} barSize={60} />
              <Bar dataKey={regionLabels.asia} stackId="a" fill="#10b981" name={regionLabels.asia} barSize={60} />
              <Bar dataKey={regionLabels.europe} stackId="a" fill="#f59e0b" name={regionLabels.europe} barSize={60} />
            </>
          ) : (
            <Bar dataKey="total" fill="#2563eb" name="Total" barSize={60} />
          )}

          {/* Trend Line for Total */}
          <Line
            type="monotone"
            dataKey="total"
            stroke="var(--text-accent)"
            strokeWidth={3}
            dot={{ r: 4, fill: 'var(--text-accent)', strokeWidth: 2, stroke: 'var(--bg-card)' }}
            activeDot={{ r: 6 }}
            name="Total Trend"
          >
            <LabelList
              dataKey="total"
              position="top"
              offset={10}
              formatter={(val: number | string) => formatMetricValue(Number(val))}
              style={{ fill: 'var(--text-secondary)', fontSize: '12px', fontWeight: 600 }}
            />
          </Line>
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
})

PerformanceChart.displayName = 'PerformanceChart'

export function ResultsModernPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { team, game, setGame, gameState, authReady, logout, isAdmin } = useGame()
  const { theme, toggleTheme } = useTheme()
  const [sessionOpen, setSessionOpen] = useState(false)
  const [rawResults, setRawResults] = useState<RawRoundEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedRound, setSelectedRound] = useState<number>(-1)
  const [showResultsNotice, setShowResultsNotice] = useState(false)
  const [metricView, setMetricView] = useState<'revenue' | 'units' | 'netProfit' | 'sharePrice'>('revenue')
  const [financialRound, setFinancialRound] = useState<number>(-1)
  const hasSetFinancialRound = useRef(false)
  const [showFullValues, setShowFullValues] = useState(false)
  const [, setSelectedHighlightTeamId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<ResultsTab>('leaderboard')
  const [resultsDataMode, setResultsDataMode] = useState<'summary' | 'full'>('summary')
  const hasInitializedRoundSelection = useRef(false)
  const handledRefreshKeyRef = useRef<number | null>(null)
  const hasLoadedOnceRef = useRef(false)
  const isFetchInFlightRef = useRef(false)
  const gameRef = useRef(game)
  const rawResultsRef = useRef<RawRoundEntry[]>([])
  const [leaderboardView, setLeaderboardView] = useState<'financial' | 'operational'>('financial')
  const [rankMetric, setRankMetric] = useState<RankMetric>('sharePrice')
  const [auditOpen, setAuditOpen] = useState(true)
  const [auditCopied, setAuditCopied] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const isDevParam = useMemo(
    () => new URLSearchParams(window.location.search).get('dev') === 'admin',
    []
  )
  const [adminSessionOk, setAdminSessionOk] = useState(false)
  const isDevAdmin = useMemo(
    () => isDevParam && (isAdmin || adminSessionOk),
    [isDevParam, isAdmin, adminSessionOk]
  )

  useEffect(() => {
    gameRef.current = game
  }, [game])

  useEffect(() => {
    rawResultsRef.current = rawResults
  }, [rawResults])

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
    const teamCount = game?.teams?.length ?? rawResults?.[0]?.teams?.length ?? 1
    const scenarioSequence = game?.scenarioSequence ?? [0]
    const marketDemandMultiplier = game?.marketDemandMultiplier ?? 1
    const regionDemandSplit = game?.regionDemandSplit
    try {
      const roundMinus1 = calculateRoundMinus1(
        teamCount,
        gameConfig,
        scenarioSequence,
        marketDemandMultiplier,
        regionDemandSplit
      )
      const teamResult = roundMinus1.teams?.[0]
      const balanceSheet = teamResult?.balanceSheet
      if (balanceSheet) {
        return {
          cash: balanceSheet.cash ?? baseline.startingCash,
          receivables: balanceSheet.receivables ?? 0,
          inventory: balanceSheet.inventory ?? baseline.inventoryValue,
          payables: balanceSheet.payables ?? 0,
          fixedAssets: balanceSheet.fixedAssets ?? baseline.fixedAssets,
          longTermDebt: balanceSheet.longTermDebt ?? baseline.startingDebt,
          shortTermLoans: balanceSheet.shortTermLoans ?? 0,
          shareCapital: balanceSheet.shareCapital ?? baseline.startingShareCapital,
          retainedEarnings: balanceSheet.retainedEarnings ?? 0,
        }
      }
    } catch {
      // Fall back to baseline if round -1 calc fails.
    }
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
  }, [gameConfig, game?.marketDemandMultiplier, game?.regionDemandSplit, game?.scenarioSequence, game?.teams?.length, rawResults])

  // --- Data Fetching Logic ---
  const {
    prevRoundData: startingPositionData,
    reviewMarketDemand: startingMarketDemand,
  } = useReviewData({
    game,
    gameState,
    team,
    fetchedResults: [],
    gameConfig,
  })

  const fetchResults = useCallback(async (isSilent = false, forcedMode?: 'summary' | 'full') => {
    if (!team) return
    if (isFetchInFlightRef.current) return
    isFetchInFlightRef.current = true
    if (!isSilent && !hasLoadedOnceRef.current) setLoading(true)

    try {
      const resultsMode: 'summary' | 'full' = forcedMode ?? (isDevAdmin ? 'full' : resultsDataMode)
      const stateResponse = await teamApi.getState(team.id)
      const resultsVersion = stateResponse?.game?.resultsVersion ?? 0
      const resultsResponse = await teamApi.getResults(team.id, resultsMode, 'results-modern', {
        version: resultsVersion,
      })

      const { results } = resultsResponse
      setRawResults(Array.isArray(results) ? results : [])
      setResultsDataMode(resultsMode)

      // Update game context if it exists and has changed
      const currentGame = gameRef.current
      if (stateResponse.success && stateResponse.game && currentGame) {
        if (stateResponse.game.currentRound !== currentGame.currentRound || stateResponse.game.status !== currentGame.status) {
          setGame({
            ...currentGame,
            currentRound: stateResponse.game.currentRound,
            status: stateResponse.game.status,
            roundDeadline: stateResponse.game.roundDeadline
          })
        }
      }
    } catch (err) {
      console.error('Error fetching results:', err)
    } finally {
      hasLoadedOnceRef.current = true
      setLoading(false)
      isFetchInFlightRef.current = false
    }
  }, [team, setGame, isDevAdmin, resultsDataMode])

  const fetchResultsRef = useRef(fetchResults)
  useEffect(() => {
    fetchResultsRef.current = fetchResults
  }, [fetchResults])

  useEffect(() => {
    if (!authReady) return
    if (!team) {
      navigate('/')
      return
    }
    fetchResultsRef.current()
  }, [team?.id, navigate, authReady])

  useEffect(() => {
    const refreshKey = (location.state as { refreshKey?: number } | null)?.refreshKey
    if (!refreshKey || handledRefreshKeyRef.current === refreshKey) return
    handledRefreshKeyRef.current = refreshKey
    fetchResultsRef.current()
    // Consume one-shot navigation state so subsequent re-renders don't retrigger refresh.
    navigate(`${location.pathname}${location.search}${location.hash}`, { replace: true, state: null })
  }, [location.state, navigate, location.pathname, location.search, location.hash])

  useEffect(() => {
    if (!authReady || !team || !isDevAdmin || resultsDataMode === 'full') return
    fetchResults(true, 'full')
  }, [authReady, team, isDevAdmin, fetchResults, resultsDataMode])

  const handleTabChange = useCallback((nextTab: ResultsTab) => {
    setActiveTab(nextTab)
    if (nextTab === 'financials' && resultsDataMode !== 'full') {
      fetchResults(true, 'full')
    }
  }, [fetchResults, resultsDataMode])

  useEffect(() => {
    if (!isDevParam || isAdmin) return
    let active = true
    authApi.me('admin')
      .then((session) => {
        if (!active) return
        setAdminSessionOk(Boolean(session?.success && session.role === 'admin'))
      })
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [isDevParam, isAdmin])

  // --- Normalization Logic ---
  const startingPositionRound = useMemo<NormalizedRound | null>(() => {
    if (!startingPositionData || !team) return null

    // Manual mapping for starting position to ensure structure matches useReviewData output
    // This fixes the issue where normalizeTeamRow expects different field nesting
    const baseRow: TeamRow = {
      teamId: team.id,
      teamName: team.name,
      sharePrice: startingPositionData.sharePrice ?? gameConfig.financial.startingSharePrice,
      sharesOutstanding: startingPositionData.sharesOutstanding ?? 0,
      dividends: 0,
      sharePriceTrace: null,
      priceUS: startingPositionData.salesByRegion?.us?.price ?? gameConfig.priceDemand.baselinePriceByRegion.us,
      priceAsia: startingPositionData.salesByRegion?.asia?.price ?? gameConfig.priceDemand.baselinePriceByRegion.asia,
      priceEurope: startingPositionData.salesByRegion?.europe?.price ?? gameConfig.priceDemand.baselinePriceByRegion.europe,
      promoUS: 0,
      promoAsia: 0,
      promoEurope: 0,
      features: 0,
      csrRating: 0,
      trainingBudget: 0,
      revenueUS: startingPositionData.salesByRegion?.us?.revenue ?? 0,
      revenueAsia: startingPositionData.salesByRegion?.asia?.revenue ?? 0,
      revenueEurope: startingPositionData.salesByRegion?.europe?.revenue ?? 0,
      materials: startingPositionData.materials ?? 0,
      labor: startingPositionData.labor ?? 0,
      logistics: startingPositionData.logistics ?? 0,
      outsourcing: startingPositionData.outsourcing ?? 0,
      marketing: startingPositionData.marketing ?? 0,
      rnd: startingPositionData.rnd ?? 0,
      admin: startingPositionData.admin ?? 0,
      inventoryHolding: startingPositionData.inventoryHolding ?? 0,
      revenue: startingPositionData.revenue ?? 0,
      cogs: startingPositionData.cogs ?? 0,
      grossProfit: startingPositionData.grossProfit ?? 0,
      grossMargin: (startingPositionData.grossMargin ?? 0) * 100,
      operatingExpenses: startingPositionData.operatingExpenses ?? 0,
      ebitda: startingPositionData.ebitda ?? 0,
      depreciation: startingPositionData.depreciation ?? 0,
      ebit: startingPositionData.ebit ?? 0,
      interestExpense: startingPositionData.interest ?? 0,
      tax: startingPositionData.tax ?? 0,
      taxLossCarryforward: startingPositionData.taxLossCarryforward ?? 0,
      netProfit: startingPositionData.netProfit ?? 0,
      netMargin: (startingPositionData.netMargin ?? 0) * 100,
      fixedAssets: startingPositionData.fixedAssets ?? 0,
      inventory: startingPositionData.inventory ?? startingBalanceSheet.inventory ?? 0,
      receivables: startingPositionData.receivables ?? startingBalanceSheet.receivables ?? 0,
      cash: startingPositionData.cashBalance ?? 0,
      totalAssets: startingPositionData.totalAssets ?? 0,
      longTermDebt: startingPositionData.longTermDebt ?? 0,
      shortTermLoans: 0,
      payables: startingPositionData.payables ?? startingBalanceSheet.payables ?? 0,
      totalLiabilities: startingPositionData.totalLiabilities ?? 0,
      shareCapital: startingPositionData.shareCapital ?? 0,
      retainedEarnings: startingPositionData.retainedEarnings ?? 0,
      totalEquity: startingPositionData.totalEquity ?? 0,
      inventoryUnits: startingPositionData.inventoryUnits ?? 0,
      inventoryStartUnits: startingPositionData.inventoryUnits ?? 0,
      inventoryEndUnits: startingPositionData.inventoryUnits ?? 0,
      unitsSold: startingPositionData.unitsSold?.total ?? 0,
      unitsSoldUS: startingPositionData.unitsSold?.us ?? 0,
      unitsSoldAsia: startingPositionData.unitsSold?.asia ?? 0,
      unitsSoldEurope: startingPositionData.unitsSold?.europe ?? 0,
      productionUS: startingPositionData.productionUS ?? startingPositionData.unitsProduced ?? 0,
      productionAsia: startingPositionData.productionAsia ?? 0,
      outsourceUS: startingPositionData.outsourceUS ?? 0,
      outsourceAsia: startingPositionData.outsourceAsia ?? 0,
      unitsProduced: startingPositionData.unitsProduced ?? 0,
      marketShareUS: (startingPositionData.marketShare?.us ?? 0) * 100,
      marketShareAsia: (startingPositionData.marketShare?.asia ?? 0) * 100,
      marketShareEurope: (startingPositionData.marketShare?.europe ?? 0) * 100,
      roe: (startingPositionData.roe ?? 0) * 100,
      roce: 0,
      ros: (startingPositionData.ros ?? 0) * 100,
      eps: startingPositionData.eps ?? 0,
      tsr: 0,
      dividendYield: 0,
    }

    // Create starting rows for all teams in the game
    // Consolidate all known teams from game definition AND historical results to ensure Leaderboard is populated
    const knownTeamsMap = new Map<string, { id: string, name: string }>()

    if (team) knownTeamsMap.set(team.id, { id: team.id, name: team.name })

    if (game?.teams) {
      game.teams.forEach(t => knownTeamsMap.set(t.id, { id: t.id, name: t.name }))
    }

    if (Array.isArray(rawResults)) {
      rawResults.forEach(r => {
        if (Array.isArray(r.teams)) {
          r.teams.forEach((t) => {
            const id = t.teamId || t.id
            const name = t.teamName || t.name
            if (id && name) knownTeamsMap.set(id, { id, name })
          })
        }
      })
    }

    // Fallback: If we still only have 1 team (ourselves) but the game says there are more,
    // generate placeholder teams for the Starting Position simulation.
    // This addresses the user's request to "list all team" even if we don't have their data yet.
    if (game?.totalTeams && knownTeamsMap.size < game.totalTeams) {
      const needed = game.totalTeams - knownTeamsMap.size
      for (let i = 0; i < needed; i++) {
        // Use a fake ID and Name for visual representation in Round -1
        const fakeId = `sim-team-${i}`
        const fakeName = `Team ${knownTeamsMap.size + 1}`
        knownTeamsMap.set(fakeId, { id: fakeId, name: fakeName })
      }
    }

    const teamsList = Array.from(knownTeamsMap.values())
    const teams = teamsList.map(t => ({
      ...baseRow,
      teamId: t.id,
      teamName: t.name,
    }))

    return {
      roundNumber: -1,
      teams,
      marketDemand: startingMarketDemand,
    }
  }, [startingPositionData, startingMarketDemand, team, game, gameConfig])

  const normalizedRounds = useMemo<NormalizedRound[]>(() => {
    const rounds: NormalizedRound[] = []
    const seenRounds = new Set<number>()

    rawResults.forEach((entry) => {
      const roundNumber = entry?.roundNumber ?? entry?.round ?? 0
      if (seenRounds.has(roundNumber)) return

      if (Array.isArray(entry?.teams)) {
        const rows = entry.teams.map((t) => {
          const data = t?.fullResults || t
          const merged = { ...data, teamId: t?.teamId ?? data?.teamId ?? data?.id, teamName: t?.teamName ?? data?.teamName ?? data?.name, decisions: t?.fullResults?.decisions ?? t?.decisions ?? data?.decisions, audit: t?.fullResults?.audit ?? data?.audit, gameState: data?.gameState ?? t?.gameState }
          return normalizeTeamRow(merged, t?.teamName ?? t?.name ?? 'Team', entry?.marketDemand, gameConfig.financial.startingSharePrice, gameConfig.financial.parValuePerShare)
        })
        rounds.push({ roundNumber, teams: rows, marketDemand: entry?.marketDemand })
        seenRounds.add(roundNumber)
      }
    })

    if (startingPositionRound && !seenRounds.has(-1)) {
      rounds.push(startingPositionRound)
    }

    return rounds.sort((a, b) => b.roundNumber - a.roundNumber)
  }, [rawResults, startingPositionRound, gameConfig])

  const visibleRounds = useMemo(() => {
    const currentRoundNum = game?.currentRound
    if (game?.status === 'COMPLETED' || currentRoundNum === undefined) {
      return normalizedRounds
    }

    // Safety check: if we HAVE results for a round, it should be visible
    // even if our currentRound state is stale.
    const latestRawRound = (rawResults && rawResults.length > 0)
      ? Math.max(...rawResults.map((r) => r.roundNumber ?? r.round ?? 0))
      : -1

    const effectiveCurrentRound = Math.max(currentRoundNum, latestRawRound + 1)

    // Round -1 is always visible. Rounds >= 0 are visible if they are less than effective current round
    return normalizedRounds.filter((r) => r.roundNumber < effectiveCurrentRound || r.roundNumber === -1)
  }, [normalizedRounds, game?.currentRound, game?.status, rawResults])


  const preRoundMinus1State = useMemo(() => {
    const baseline = getBalancedStartingFinancials(gameConfig)
    const zeroInventoryAssets = baseline.fixedAssets + baseline.startingCash
    const zeroInventoryDebt = Math.round(zeroInventoryAssets * 0.25)
    const zeroInventoryShareCapital = zeroInventoryAssets - zeroInventoryDebt

    return {
      cash: baseline.startingCash,
      receivables: 0,
      inventory: 0,
      fixedAssets: baseline.fixedAssets,
      payables: 0,
      shortTermLoans: 0,
      longTermDebt: zeroInventoryDebt,
      shareCapital: zeroInventoryShareCapital,
      retainedEarnings: 0,
      totalAssets: zeroInventoryAssets,
      totalLiabilities: zeroInventoryDebt,
      totalEquity: zeroInventoryShareCapital,
    }
  }, [gameConfig])

  const exportRounds = useMemo(() => {
    const roundMap = new Map<number, NormalizedRound>()
    visibleRounds.forEach((round) => roundMap.set(round.roundNumber, round))

    return visibleRounds.map((round) => {
      const label = round.roundNumber === -1
        ? 'Starting Position'
        : (round.roundNumber === 0 ? 'Trial Round' : `Round ${round.roundNumber}`)

      const roundEntry = rawResults.find((entry) => (entry?.roundNumber ?? entry?.round) === round.roundNumber) || null
      const firstTeam = roundEntry?.teams?.[0] ?? null
      const scenarioSnapshot = firstTeam?.fullResults?.scenarioSnapshot ?? firstTeam?.scenarioSnapshot ?? null
      const effects = round.roundNumber < 0
        ? undefined
        : (
          scenarioSnapshot
            ? {
              priceElasticityModifier: scenarioSnapshot.priceElasticityModifier ?? 1,
              csrImportanceModifier: scenarioSnapshot.csrImportanceModifier ?? 1,
              marketingEffectModifier: scenarioSnapshot.marketingEffectModifier ?? 1,
              costInflation: scenarioSnapshot.costInflation ?? 1,
              investmentCostMultiplier: scenarioSnapshot.investmentCostMultiplier ?? 1,
              interestRateSpread: scenarioSnapshot.interestRateSpread ?? 0,
              taxRateDeltaByRegion: scenarioSnapshot.taxRateDeltaByRegion ?? { us: 0, asia: 0, europe: 0 },
              workingCapitalDelta: scenarioSnapshot.workingCapitalDelta ?? { inventory: 0, receivable: 0, payable: 0 },
              demandGrowthModifier: scenarioSnapshot.demandModifier ?? { us: 0, asia: 0, europe: 0 },
            }
            : getScenarioEffectsForRound(round.roundNumber, game?.scenarioSequence)
        )

      const baseTax = gameConfig.financial.taxRate
      const baseInterest = gameConfig.financial.interestRate
      const interestSpread = effects?.interestRateSpread ?? 0

      const entry = {
        roundNumber: round.roundNumber,
        label,
        teams: round.teams as FinancialTeamRow[],
        taxRate: baseTax,
        interestRate: baseInterest + interestSpread,
        inventoryHoldingRate: 0.05,
      }
      if (round.roundNumber === -1) {
        const prevMap = new Map<string, FinancialTeamRow>()
        round.teams.forEach((team) => {
          prevMap.set(team.teamId, {
            ...team,
            ...preRoundMinus1State,
          } as unknown as TeamRow)
        })
        return { ...entry, previousTeams: prevMap }
      }
      const prevNumber = round.roundNumber <= 1 ? -1 : round.roundNumber - 1
      const prev = roundMap.get(prevNumber)
      if (prev) {
        const prevMap = new Map<string, FinancialTeamRow>()
        prev.teams.forEach((team) => prevMap.set(team.teamId, team))
        return { ...entry, previousTeams: prevMap }
      }
      return entry
    })
  }, [preRoundMinus1State, visibleRounds, gameConfig, game?.scenarioSequence, rawResults])

  // Auto-select latest round when results are loaded
  useEffect(() => {
    if (visibleRounds.length === 0) return
    if (!hasInitializedRoundSelection.current) {
      const latestRound = visibleRounds[0]
      if (latestRound) setSelectedRound(latestRound.roundNumber)
      hasInitializedRoundSelection.current = true
      return
    }

    const selectedRoundStillVisible = visibleRounds.some((round) => round.roundNumber === selectedRound)
    if (!selectedRoundStillVisible) {
      const latestRound = visibleRounds[0]
      if (latestRound) setSelectedRound(latestRound.roundNumber)
    }
  }, [visibleRounds, selectedRound])

  // Sync financial round with selected round initially
  useEffect(() => {
    if (hasSetFinancialRound.current || visibleRounds.length === 0) return
    const latestRound = visibleRounds[0]
    if (latestRound) {
      setFinancialRound(latestRound.roundNumber)
      hasSetFinancialRound.current = true
    }
  }, [visibleRounds])

  // --- Derived State for View ---
  const activeRound = visibleRounds.find((r) => r.roundNumber === selectedRound) || visibleRounds[0]
  const currentTeamId = team?.id
  const activeTeams = activeRound?.teams ?? []
  const currentTeamData = activeTeams.find((t) => t.teamId === currentTeamId) || activeTeams[0]

  // Unused for now - may be needed for future highlight features
  // const highlightTeamId = selectedHighlightTeamId || currentTeamId
  // const highlightTeamData = activeTeams.find(t => t.teamId === highlightTeamId) || currentTeamData

  // Update selected highlight team when team ID changes
  useEffect(() => {
    if (currentTeamId) {
      setSelectedHighlightTeamId(currentTeamId)
    }
  }, [currentTeamId])

  // Financial report uses its own round selection
  const financialActiveRound = visibleRounds.find((r) => r.roundNumber === financialRound) || visibleRounds[0]
  const financialTeams = useMemo(() => {
    const teams = financialActiveRound?.teams ?? []
    return [...teams].sort((a, b) => a.teamName.localeCompare(b.teamName))
  }, [financialActiveRound])
  const financialPreviousRound = useMemo(() => {
    if (!financialActiveRound) return null
    const prevNumber = financialActiveRound.roundNumber <= 1
      ? -1
      : financialActiveRound.roundNumber - 1
    if (prevNumber < -1) return null
    return visibleRounds.find((r) => r.roundNumber === prevNumber) || null
  }, [financialActiveRound, visibleRounds])
  const financialPreviousTeams = useMemo(() => {
    const map = new Map<string, TeamRow>()
    if (!financialPreviousRound) return map
    if (financialActiveRound?.roundNumber === -1) {
      financialTeams.forEach((teamRow) => {
        map.set(teamRow.teamId, {
          ...teamRow,
          ...preRoundMinus1State,
        })
      })
      return map
    }
    const prevTeams = financialPreviousRound.teams ?? []
    financialTeams.forEach((teamRow) => {
      const prev = prevTeams.find((p) => p.teamId === teamRow.teamId)
      if (prev) {
        if (teamRow.inventoryStartUnits === undefined) {
          teamRow.inventoryStartUnits = prev.inventoryUnits
        }
        map.set(teamRow.teamId, prev)
      }
    })
    return map
  }, [financialActiveRound?.roundNumber, financialTeams, financialPreviousRound, preRoundMinus1State])

  const formatCurrencyFull = (value: number) => `$${value.toFixed(2)}`
  const baselineStartState = useMemo(() => {
    const baselineCash = startingBalanceSheet.cash
    const baselineReceivables = startingBalanceSheet.receivables ?? 0
    const baselineInventory = startingBalanceSheet.inventory ?? 0
    const baselineFixedAssets = startingBalanceSheet.fixedAssets
    const baselinePayables = startingBalanceSheet.payables ?? 0
    const baselineShortTermLoans = startingBalanceSheet.shortTermLoans ?? 0
    const baselineLongTermDebt = startingBalanceSheet.longTermDebt
    const baselineShareCapital = startingBalanceSheet.shareCapital
    const baselineRetainedEarnings = startingBalanceSheet.retainedEarnings ?? 0
    const baselineTotalAssets = baselineCash + baselineReceivables + baselineInventory + baselineFixedAssets
    const baselineTotalLiabilities = baselineLongTermDebt + baselineShortTermLoans + baselinePayables
    const baselineTotalEquity = baselineShareCapital + baselineRetainedEarnings

    return {
      cash: baselineCash,
      receivables: baselineReceivables,
      inventory: baselineInventory,
      fixedAssets: baselineFixedAssets,
      payables: baselinePayables,
      shortTermLoans: baselineShortTermLoans,
      longTermDebt: baselineLongTermDebt,
      shareCapital: baselineShareCapital,
      retainedEarnings: baselineRetainedEarnings,
      totalAssets: baselineTotalAssets,
      totalLiabilities: baselineTotalLiabilities,
      totalEquity: baselineTotalEquity,
    }
  }, [startingBalanceSheet])
  const auditScenarioLines = (
    auditRoundLabel: string,
    effects: ReturnType<typeof getScenarioEffectsForRound> | undefined
  ) => {
    const baseTax = gameConfig.financial.taxRate
    const baseInterest = gameConfig.financial.interestRate
    const taxDelta = effects?.taxRateDeltaByRegion ?? { us: 0, asia: 0, europe: 0 }
    const effectiveTax = {
      us: baseTax + taxDelta.us,
      asia: baseTax + taxDelta.asia,
      europe: baseTax + taxDelta.europe,
    }
    const workingCapital = effects?.workingCapitalDelta ?? { inventory: 0, receivable: 0, payable: 0 }
    const interestSpread = effects?.interestRateSpread ?? 0

    return [
      `Scenario: ${auditRoundLabel}`,
      `Price elasticity modifier: ${(effects?.priceElasticityModifier ?? 1).toFixed(2)}`,
      `Marketing effect modifier: ${(effects?.marketingEffectModifier ?? 1).toFixed(2)}`,
      `CSR importance modifier: ${(effects?.csrImportanceModifier ?? 1).toFixed(2)}`,
      `Cost inflation: ${(effects?.costInflation ?? 1).toFixed(2)}`,
      `Investment cost multiplier: ${(effects?.investmentCostMultiplier ?? 1).toFixed(2)}`,
      `Interest rate: ${(baseInterest * 100).toFixed(2)}% + ${(interestSpread * 100).toFixed(2)}% = ${((baseInterest + interestSpread) * 100).toFixed(2)}%`,
      `Tax rate (US/Asia/Europe): ${(effectiveTax.us * 100).toFixed(2)}% | ${(effectiveTax.asia * 100).toFixed(2)}% | ${(effectiveTax.europe * 100).toFixed(2)}%`,
      `Working capital delta (inv/recv/pay): ${(workingCapital.inventory * 100).toFixed(1)}% | ${(workingCapital.receivable * 100).toFixed(1)}% | ${(workingCapital.payable * 100).toFixed(1)}%`,
      `Demand growth modifier (US/Asia/Europe): ${(effects?.demandGrowthModifier?.us ?? 0).toFixed(2)} | ${(effects?.demandGrowthModifier?.asia ?? 0).toFixed(2)} | ${(effects?.demandGrowthModifier?.europe ?? 0).toFixed(2)}`,
    ]
  }
  const effectsFromScenarioSnapshot = (scenarioSnapshot: unknown) => {
    if (!scenarioSnapshot || typeof scenarioSnapshot !== 'object') return undefined
    return {
      priceElasticityModifier: scenarioSnapshot.priceElasticityModifier ?? 1,
      csrImportanceModifier: scenarioSnapshot.csrImportanceModifier ?? 1,
      marketingEffectModifier: scenarioSnapshot.marketingEffectModifier ?? 1,
      costInflation: scenarioSnapshot.costInflation ?? 1,
      investmentCostMultiplier: scenarioSnapshot.investmentCostMultiplier ?? 1,
      interestRateSpread: scenarioSnapshot.interestRateSpread ?? 0,
      taxRateDeltaByRegion: scenarioSnapshot.taxRateDeltaByRegion ?? { us: 0, asia: 0, europe: 0 },
      workingCapitalDelta: scenarioSnapshot.workingCapitalDelta ?? { inventory: 0, receivable: 0, payable: 0 },
      demandGrowthModifier: scenarioSnapshot.demandModifier ?? { us: 0, asia: 0, europe: 0 },
      logisticsTariff: scenarioSnapshot.logisticsTariff,
    } as ReturnType<typeof getScenarioEffectsForRound>
  }
  const auditLogisticsLines = (
    effects: ReturnType<typeof getScenarioEffectsForRound> | undefined,
    teamRow: TeamRow | null,
    teamData: Record<string, unknown> | null
  ) => {
    if (!teamData || !teamRow) return ['No logistics data available.']
    const auditSales = teamData?.sales ?? {}
    const auditProduction = teamData?.production ?? {}
    const auditProductionDecision = teamData?.decisions?.production ?? {}
    const auditLogisticsDecision = teamData?.decisions?.logistics ?? {}
    const auditInventory = teamData?.audit?.trace?.inventory ?? teamData?.inventoryTrace ?? {}
    const demandUS = auditSales.us?.units ?? teamRow.unitsSoldUS ?? 0
    const demandAsia = auditSales.asia?.units ?? teamRow.unitsSoldAsia ?? 0
    const demandEurope = auditSales.europe?.units ?? teamRow.unitsSoldEurope ?? 0
    const usFactoryUnits = auditProduction.usFactoryUnits ?? auditProductionDecision.usFactoryUnits ?? auditProductionDecision.usUnits ?? 0
    const asiaFactoryUnits = auditProduction.asiaFactoryUnits ?? auditProductionDecision.asiaFactoryUnits ?? auditProductionDecision.asiaUnits ?? 0
    const outsourceUS = auditProductionDecision.outsourceUS ?? 0
    const outsourceAsia = auditProductionDecision.outsourceAsia ?? 0
    const startingInventoryUS = auditInventory.startingUnitsUS ?? 0
    const startingInventoryAsia = auditInventory.startingUnitsAsia ?? 0
    const usSupply = usFactoryUnits + outsourceUS + startingInventoryUS
    const asiaSupply = asiaFactoryUnits + outsourceAsia + startingInventoryAsia
    const defaultLogistics = gameConfig.defaults?.logistics ?? {
      usPriority: ['us', 'europe', 'asia'],
      asiaPriority: ['asia', 'europe', 'us'],
    }
    const usPriority = Array.isArray(auditLogisticsDecision.usPriority)
      ? auditLogisticsDecision.usPriority
      : defaultLogistics.usPriority
    const asiaPriority = Array.isArray(auditLogisticsDecision.asiaPriority)
      ? auditLogisticsDecision.asiaPriority
      : defaultLogistics.asiaPriority
    const allocation = calculateLogisticsAllocation({
      usSupply,
      asiaSupply,
      demands: { us: demandUS, asia: demandAsia, europe: demandEurope },
      usPriority,
      asiaPriority,
    })
    const baseTariffs = gameConfig.logisticsTariff
    const scenarioTariffs = effects?.logisticsTariff ?? {}
    const resolvedTariffs = applyLogisticsTariffModifiers(baseTariffs, scenarioTariffs)
    const baseCost = calculateTotalLogisticsCost(allocation, resolvedTariffs)
    const inflation = effects?.costInflation ?? 1
    const finalCost = baseCost * inflation
    const storedCost = teamData?.costs?.logistics ?? teamData?.logistics ?? teamRow.logistics ?? 0
    return [
      `Demand units (US/Asia/Europe): ${formatUnits(demandUS)} | ${formatUnits(demandAsia)} | ${formatUnits(demandEurope)}`,
      `Supply US/Asia: ${formatUnits(usSupply)} | ${formatUnits(asiaSupply)}`,
      `Priorities US/Asia: ${usPriority.join(' > ')} | ${asiaPriority.join(' > ')}`,
      `Tariffs resolved (US->Asia/US->Europe/Asia->US/Asia->Europe): ${formatCurrencyFull(resolvedTariffs.usToAsia)} | ${formatCurrencyFull(resolvedTariffs.usToEurope)} | ${formatCurrencyFull(resolvedTariffs.asiaToUs)} | ${formatCurrencyFull(resolvedTariffs.asiaToEurope)}`,
      `Base logistics cost: ${formatCurrency(baseCost)}`,
      `Cost inflation: ${inflation.toFixed(2)}`,
      `Final logistics cost (calc): ${formatCurrency(finalCost)}`,
      `Stored logistics cost: ${formatCurrency(storedCost)}`,
    ]
  }
  const auditCsrLines = (
    effects: ReturnType<typeof getScenarioEffectsForRound> | undefined,
    teamRow: TeamRow | null,
    teamData: Record<string, unknown> | null
  ) => {
    if (!teamRow) return ['No CSR data available.']
    const csrImportance = effects?.csrImportanceModifier ?? 1
    const weightedCSRRating =
      teamData?.attractivenessInputs?.weightedCSRRating ??
      teamData?.weightedCSRRating ??
      teamRow.csrRating ??
      0
    const csrScoreFromBreakdown =
      teamData?.attractivenessBreakdown?.us?.csrScore ??
      teamData?.attractivenessBreakdown?.asia?.csrScore ??
      teamData?.attractivenessBreakdown?.europe?.csrScore ??
      0
    const computedScore = weightedCSRRating * 25 * csrImportance
    const scoreUsed = csrScoreFromBreakdown || computedScore
    return [
      `Weighted CSR rating (0-4): ${weightedCSRRating.toFixed(2)}`,
      `CSR importance modifier: ${csrImportance.toFixed(2)}`,
      `CSR score (rating x 25 x modifier): ${scoreUsed.toFixed(2)}`,
      `Reported CSR rating: ${(teamRow.csrRating ?? weightedCSRRating).toFixed(2)}`,
    ]
  }
  const auditRndLines = (teamRow: TeamRow | null, teamData: Record<string, unknown> | null) => {
    const rndDecision = teamData?.decisions?.rnd ?? {}
    const researchStaff = rndDecision.researchStaff ?? 0
    const trainingLevel = rndDecision.trainingLevel ?? gameConfig.defaults?.rnd?.trainingLevel ?? 'basic'
    const trainingCostPerStaff = gameConfig.hr.trainingCostPerStaff?.[trainingLevel as 'basic' | 'standard' | 'advanced'] ?? 0
    const trainingCost = researchStaff * trainingCostPerStaff
    const rndCostStored = teamData?.costs?.rnd ?? teamRow?.rnd ?? 0
    const hrCostStored = teamData?.costs?.hr ?? 0
    return [
      `Research staff: ${formatUnits(researchStaff)}`,
      `Training level: ${trainingLevel}`,
      `Training cost per staff: ${formatCurrencyFull(trainingCostPerStaff)}`,
      `Training cost (estimate): ${formatCurrency(trainingCost)}`,
      `Stored R&D cost: ${formatCurrency(rndCostStored)}`,
      `Stored HR cost: ${formatCurrency(hrCostStored)}`,
      'Note: Engine sets R&D cost equal to HR cost.',
    ]
  }
  const auditBlocks = useMemo(() => {
    if (!isDevAdmin) return []
    const rounds = [...visibleRounds].sort((a, b) => a.roundNumber - b.roundNumber)
    return rounds.map((round) => {
      const roundNumber = round.roundNumber
      const roundLabel = roundNumber === -1 ? 'Starting Position' : roundNumber === 0 ? 'Trial Round' : `Round ${roundNumber}`
      const phase1Label = roundNumber === -1 ? 'Day 0' : `Beginning of ${roundLabel}`
      const phase2Label = roundNumber === -1 ? 'End of Round -1' : `End of ${roundLabel}`
      const teams = [...(round.teams ?? [])].sort((a, b) => a.teamName.localeCompare(b.teamName))
      const teamRow = teams.find((team) => team.teamId === currentTeamId) || teams[0] || null
      const prevNumber = roundNumber <= 1 ? -1 : roundNumber - 1
      const prevRound = visibleRounds.find((r) => r.roundNumber === prevNumber) || null
      const prevTeams = prevRound?.teams ?? []
      const prevTeamRow = teamRow ? prevTeams.find((p) => p.teamId === teamRow.teamId) || null : null
      const startState = roundNumber === -1
        ? preRoundMinus1State
        : prevTeamRow
          ? {
            cash: prevTeamRow.cash,
            receivables: prevTeamRow.receivables,
            inventory: prevTeamRow.inventory,
            fixedAssets: prevTeamRow.fixedAssets,
            payables: prevTeamRow.payables,
            shortTermLoans: prevTeamRow.shortTermLoans,
            longTermDebt: prevTeamRow.longTermDebt,
            shareCapital: prevTeamRow.shareCapital,
            retainedEarnings: prevTeamRow.retainedEarnings,
            totalAssets: prevTeamRow.totalAssets
              ?? (prevTeamRow.cash + prevTeamRow.receivables + prevTeamRow.inventory + prevTeamRow.fixedAssets),
            totalLiabilities: prevTeamRow.totalLiabilities
              ?? (prevTeamRow.longTermDebt + prevTeamRow.shortTermLoans + prevTeamRow.payables),
            totalEquity: prevTeamRow.totalEquity
              ?? (prevTeamRow.shareCapital + prevTeamRow.retainedEarnings),
          }
          : baselineStartState
      const roundEntry = rawResults.find((entry) => (entry?.roundNumber ?? entry?.round) === roundNumber) || null
      const teamEntry = roundEntry?.teams?.find((t) => (t?.teamId ?? t?.id) === currentTeamId) || roundEntry?.teams?.[0] || null
      const teamData = teamEntry?.fullResults ?? teamEntry ?? null
      const effects = roundNumber < 0
        ? undefined
        : (
          effectsFromScenarioSnapshot(teamData?.scenarioSnapshot)
          ?? getScenarioEffectsForRound(roundNumber <= 0 ? 0 : roundNumber, game?.scenarioSequence)
        )
      const balanceDelta = teamRow ? (() => {
        const assets = teamRow.totalAssets ?? (teamRow.cash + teamRow.receivables + teamRow.inventory + teamRow.fixedAssets)
        const liabilities = teamRow.totalLiabilities ?? (teamRow.longTermDebt + teamRow.shortTermLoans + teamRow.payables)
        const equity = teamRow.totalEquity ?? (teamRow.shareCapital + teamRow.retainedEarnings)
        return { assets, liabilities, equity, delta: assets - (liabilities + equity) }
      })() : null
      const scenarioLines = auditScenarioLines(roundLabel, effects)
      const logisticsLines = auditLogisticsLines(effects, teamRow, teamData)
      const csrLines = auditCsrLines(effects, teamRow, teamData)
      const rndLines = auditRndLines(teamRow, teamData)
      const splitText = teamRow && startState ? [
        `Audit Round: ${roundLabel}`,
        '',
        `Phase 1: ${phase1Label}`,
        JSON.stringify(startState, null, 2),
        '',
        `Phase 2: ${phase2Label}`,
        JSON.stringify(teamRow, null, 2),
        '',
        'Scenario Effects',
        ...scenarioLines,
        '',
        'Logistics Cost Audit',
        ...logisticsLines,
        '',
        'CSR Rating Audit',
        ...csrLines,
        '',
        'R&D Cost Audit',
        ...rndLines,
        '',
        'End of Audit.',
      ].join('\n') : `No audit data available for ${roundLabel}.`
      return {
        roundNumber,
        roundLabel,
        phase1Label,
        phase2Label,
        teamRow,
        startState,
        balanceDelta,
        scenarioLines,
        logisticsLines,
        csrLines,
        rndLines,
        splitText,
      }
    })
  }, [auditCsrLines, auditLogisticsLines, auditRndLines, auditScenarioLines, baselineStartState, currentTeamId, game?.scenarioSequence, rawResults, visibleRounds])

  const handleAuditCopy = () => {
    if (!auditBlocks.length) return
    const combined = auditBlocks.map((block) => block.splitText).join('\n\n')
    navigator.clipboard.writeText(combined)
      .then(() => {
        setAuditCopied(true)
        window.setTimeout(() => setAuditCopied(false), 1500)
      })
      .catch(() => undefined)
  }

  const isStartingPosition = selectedRound === -1
  const isCompletedRound = selectedRound >= 1 && (game?.status === 'COMPLETED' || selectedRound < (game?.currentRound ?? 0))
  const regionLabels = useMemo(() => getRegionLabels(game ?? undefined), [game?.regionLabels])

  // Dynamic sections - only show Market Economics when game is completed
  const sections = useMemo(() => {
    const baseSections: Array<{ id: ResultsTab; label: string; icon: string }> = [
      { id: 'leaderboard', label: 'Leaderboard', icon: '🏆' },
      { id: 'summary', label: 'Summary', icon: '📖' },
      { id: 'highlights', label: 'Team Highlights', icon: '✨' },
    ]

    if (game?.status === 'COMPLETED') {
      baseSections.push({ id: 'market-economics', label: 'Market Economics', icon: '📈' })
    }

    baseSections.push({ id: 'financials', label: 'Financials', icon: '💰' })

    return baseSections
  }, [game?.status])

  const showCoachInsights = false
  const coachInsights = useMemo(() => {
    if (!showCoachInsights || !currentTeamData) return []
    const prevRoundNumber = selectedRound <= 0 ? -1 : selectedRound - 1
    const prevRound = visibleRounds.find((r) => r.roundNumber === prevRoundNumber)
    const prevTeam = prevRound?.teams?.find((t) => t.teamId === currentTeamData.teamId) ?? null
    return generateLocalCoachInsights({
      currentTeam: currentTeamData,
      previousTeam: prevTeam ?? undefined,
      regionLabels: regionLabels ?? undefined,
      roundLabel: selectedRound === -1 ? 'Trial Round' : `Round ${selectedRound}`,
    })
  }, [currentTeamData, regionLabels, selectedRound, showCoachInsights, visibleRounds])

  const reviewGrossMargin = currentTeamData?.grossMargin ?? 0
  const reviewNetMargin = currentTeamData?.netMargin ?? 0
  const selectedRoundSubtitle = selectedRound === -1
    ? 'Starting Position'
    : selectedRound === 0
      ? 'Round Trial'
      : `Round ${selectedRound}`
  const reviewAvgShare = ((currentTeamData?.marketShareUS ?? 0) + (currentTeamData?.marketShareAsia ?? 0) + (currentTeamData?.marketShareEurope ?? 0)) / 3
  const reviewAvgSharePct = Math.max(0, Math.min(100, reviewAvgShare))
  const reviewAvgShareDisplay = formatPercent(reviewAvgShare)
  const reviewTotalAvailable = (currentTeamData?.unitsSold ?? 0) + (currentTeamData?.inventoryUnits ?? 0)
  const reviewSoldPct = reviewTotalAvailable > 0 ? ((currentTeamData?.unitsSold ?? 0) / reviewTotalAvailable) * 100 : 0
  const reviewInventoryPct = reviewTotalAvailable > 0 ? ((currentTeamData?.inventoryUnits ?? 0) / reviewTotalAvailable) * 100 : 0
  const reviewShareUSPct = currentTeamData?.marketShareUS ?? 0
  const reviewShareAsiaPct = currentTeamData?.marketShareAsia ?? 0
  const reviewShareEuropePct = currentTeamData?.marketShareEurope ?? 0
  const reviewUtilizationDisplay = formatPercent((currentTeamData?.utilization ?? 0) * 100)

  const producedByRegion = (region: 'us' | 'asia' | 'europe') => {
    if (!currentTeamData) return 0
    if (region === 'us') return (currentTeamData.productionUS ?? 0) + (currentTeamData.outsourceUS ?? 0)
    if (region === 'asia') return (currentTeamData.productionAsia ?? 0) + (currentTeamData.outsourceAsia ?? 0)
    return 0
  }

  const regionMarginDisplay = (region: 'us' | 'asia' | 'europe') => {
    if (!currentTeamData) return '-'
    const rev = region === 'us' ? currentTeamData.revenueUS : region === 'asia' ? currentTeamData.revenueAsia : currentTeamData.revenueEurope
    const units = region === 'us' ? currentTeamData.unitsSoldUS : region === 'asia' ? currentTeamData.unitsSoldAsia : currentTeamData.unitsSoldEurope
    if (rev <= 0 || units <= 0) return '-'
    const unitPrice = rev / units
    const unitCost = (currentTeamData.unitsSold && currentTeamData.unitsSold > 0) ? currentTeamData.cogs / currentTeamData.unitsSold : 0
    if (unitPrice <= 0) return '-'
    const margin = (unitPrice - unitCost) / unitPrice
    const marginPct = Math.max(0, Math.min(100, margin * 100))
    const getMarginColor = (pct: number) => {
      if (pct >= 40) return '#22c55e'
      if (pct >= 25) return '#eab308'
      if (pct >= 15) return '#f97316'
      return '#ef4444'
    }
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: '110px', justifyContent: 'flex-end' }}>
        <div style={{ flex: 1, height: '6px', background: 'var(--bg-page)', borderRadius: '3px', overflow: 'hidden', border: '1px solid var(--border-color)', maxWidth: '50px' }}>
          <div style={{ width: `${marginPct}%`, height: '100%', background: getMarginColor(marginPct) }} />
        </div>
        <span style={{ fontSize: '0.8rem', minWidth: '40px' }}>{formatPercent(margin * 100)}</span>
      </div>
    )
  }
  const completedSummary = useMemo(() => {
    if (!currentTeamId || game?.status !== 'COMPLETED') return null
    const completedRounds = normalizedRounds.filter((round) => round.roundNumber >= 1)
    if (completedRounds.length === 0) return null
    let totalRevenue = 0
    let totalUnits = 0
    let highestShare = 0
    let highestRegion = regionLabels.us
    completedRounds.forEach((round) => {
      const teamRow = round.teams.find((t) => t.teamId === currentTeamId)
      if (!teamRow) return
      totalRevenue += teamRow.revenue || 0
      totalUnits += teamRow.unitsSold || 0
      const shares = [
        { value: teamRow.marketShareUS ?? 0, label: regionLabels.us },
        { value: teamRow.marketShareAsia ?? 0, label: regionLabels.asia },
        { value: teamRow.marketShareEurope ?? 0, label: regionLabels.europe },
      ]
      shares.forEach((entry) => {
        if (entry.value > highestShare) {
          highestShare = entry.value
          highestRegion = entry.label
        }
      })
    })
    return {
      totalRevenue,
      totalUnits,
      highestShare,
      highestRegion,
    }
  }, [currentTeamId, game?.status, normalizedRounds, regionLabels])

  // --- Header/Nav Helpers ---
  const companyName = game?.companyName || 'TechCorp'
  const teamNameDisplay = team?.name || 'Team'
  const teamCode = team?.teamCode || '---'
  const gameName = game?.name || 'AIgopoly'
  const gameCode = game?.gameCode || '---'
  const currentRoundNum = game?.currentRound ?? 0
  const roundLabel = currentRoundNum === 0 ? 'Trial Round' : `Round ${currentRoundNum} / ${game?.totalRounds || '-'}`
  const latestResultsRound = useMemo(() => {
    if (!Array.isArray(rawResults) || rawResults.length === 0) return null
    const rounds = rawResults
      .map((entry) => entry?.roundNumber)
      .filter((value) => typeof value === 'number')
    if (rounds.length === 0) return null
    const latest = Math.max(...rounds)
    return latest >= 0 ? latest : null
  }, [rawResults])
  const resultsNoticeKey = useMemo(() => {
    if (!team?.id || !game?.id || latestResultsRound === null) return null
    return `results-notice-seen-${game.id}-${team.id}-${latestResultsRound}`
  }, [game?.id, team?.id, latestResultsRound])
  const resultsNoticeLabel = latestResultsRound === 0
    ? 'Trial results available - click to view'
    : latestResultsRound !== null
      ? `Round ${latestResultsRound} results available - click to view`
      : ''

  const industryKey = (game?.industry || '').trim().toLowerCase()
  const industryIcon = useMemo(() => {
    const icons: Record<string, string> = {
      'oil': new URL('../../icons/oil factory.png', import.meta.url).href,
      'oil & energy': new URL('../../icons/oil factory.png', import.meta.url).href,
      'electronics': new URL('../../icons/electrics factory.png', import.meta.url).href,
      'automotive': new URL('../../icons/car factory.png', import.meta.url).href,
    }
    return icons[industryKey] || icons['electronics']
  }, [industryKey])

  const timeRemainingLabel = useMemo(() => {
    if (game?.status === 'COMPLETED') return 'Complete'
    const deadline = game?.roundDeadline ? new Date(game.roundDeadline) : null
    if (!deadline) return 'No time limit'
    const remainingMs = deadline.getTime() - now
    if (remainingMs <= 0) return 'Time expired'
    const totalSeconds = Math.floor(remainingMs / 1000)
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60
    return `${hours}h ${minutes}m ${seconds}s`
  }, [game?.roundDeadline, game?.status, now])

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(intervalId)
  }, [])

  useEffect(() => {
    if (!resultsNoticeKey) {
      setShowResultsNotice(false)
      return
    }
    let seen = false
    try {
      seen = localStorage.getItem(resultsNoticeKey) === 'true'
    } catch {
      seen = false
    }
    if (seen) {
      setShowResultsNotice(false)
      return
    }
    setShowResultsNotice(true)
    try {
      localStorage.setItem(resultsNoticeKey, 'true')
    } catch {
      // ignore storage failures
    }
    const timeout = window.setTimeout(() => setShowResultsNotice(false), 8000)
    return () => window.clearTimeout(timeout)
  }, [resultsNoticeKey])



  // --- Visualization Helpers ---
  const rankMetricLabel = useMemo(() => {
    if (rankMetric === 'netProfit') return 'Net Profit'
    if (rankMetric === 'unitsSold') return 'Units Sold'
    if (rankMetric === 'marketShare') return 'Market Share'
    if (rankMetric === 'eps') return 'EPS'
    return 'Share Price'
  }, [rankMetric])
  const getRankMetricValue = useCallback((teamRow: TeamRow) => {
    if (rankMetric === 'netProfit') return teamRow.netProfit ?? 0
    if (rankMetric === 'unitsSold') return teamRow.unitsSold ?? 0
    if (rankMetric === 'marketShare') return ((teamRow.marketShareUS ?? 0) + (teamRow.marketShareAsia ?? 0) + (teamRow.marketShareEurope ?? 0)) / 3
    if (rankMetric === 'eps') return teamRow.eps ?? 0
    return teamRow.sharePrice ?? 0
  }, [rankMetric])
  const formatRankMetricValue = useCallback((teamRow: TeamRow) => {
    const value = getRankMetricValue(teamRow)
    if (rankMetric === 'unitsSold') return formatUnits(value)
    if (rankMetric === 'marketShare') return `${value.toFixed(1)}%`
    return formatCurrency(value)
  }, [getRankMetricValue, rankMetric])
  const formatRankMetricGap = useCallback((gap: number) => {
    if (rankMetric === 'unitsSold') return formatUnits(gap)
    if (rankMetric === 'marketShare') return `${gap.toFixed(1)} pp`
    return formatCurrency(gap)
  }, [rankMetric])
  const sortedByRank = [...activeTeams].sort((a, b) => {
    const metricDelta = getRankMetricValue(b) - getRankMetricValue(a)
    if (metricDelta !== 0) return metricDelta
    return (b.sharePrice ?? 0) - (a.sharePrice ?? 0)
  })
  const sortedByName = [...activeTeams].sort((a, b) => a.teamName.localeCompare(b.teamName))
  const priceMaxByRegion = {
    us: Math.max(1, ...sortedByName.map((team) => team.priceUS)),
    asia: Math.max(1, ...sortedByName.map((team) => team.priceAsia)),
    europe: Math.max(1, ...sortedByName.map((team) => team.priceEurope)),
  }
  const operationalMax = {
    production: Math.max(1, ...sortedByName.map((team) => (team.productionUS ?? 0) + (team.productionAsia ?? 0))),
    unitsSold: Math.max(1, ...sortedByName.map((team) => team.unitsSold)),
    inventory: Math.max(1, ...sortedByName.map((team) => team.inventoryUnits)),
    promo: 20, // Promo is typically 0-20%
    features: Math.max(1, ...sortedByName.map((team) => team.features ?? 0)),
    training: Math.max(1, ...sortedByName.map((team) => team.trainingBudget ?? 0)),
    csr: 4, // CSR rating is typically 0-4
  }
  const myRank = sortedByRank.findIndex(t => t.teamId === currentTeamId) + 1
  const isLeader = myRank === 1 || isStartingPosition
  const currentTeamMetricValue = currentTeamData ? getRankMetricValue(currentTeamData) : 0
  const leaderMetricValue = sortedByRank[0] ? getRankMetricValue(sortedByRank[0]) : 0
  const metricGapToLeader = Math.max(0, leaderMetricValue - currentTeamMetricValue)
  const roundAnalysis = useMemo(
    () => (isStartingPosition ? [] : buildRoundAnalysis(sortedByRank)),
    [sortedByRank, isStartingPosition]
  )

  return (
    <div className="decisions-modern results-modern-scoped">
      <div className="dm-shell">
        <aside className="dm-sidebar">
          <a className="dm-company dm-company-link" href="/landing" target="_blank" rel="noreferrer">
            <div className="dm-company-logo">
              {industryIcon && <img src={industryIcon} alt="Industry logo" />}
            </div>
            <div>
              <div className="dm-company-name">{teamNameDisplay}</div>
              <div className="dm-company-meta">{game?.industry || 'Industry'}</div>
            </div>
          </a>

          <nav className="dm-nav">
            {MAIN_NAV.map((item) => {
              const isActive = item.path === '/results'
              return (
                <Fragment key={item.id}>
                  <button
                    type="button"
                    className={`dm-nav-item ${isActive ? 'active' : ''}`}
                    onClick={() => navigate(item.path)}
                  >
                    {item.label}
                  </button>
                  {isActive && (
                    <div className="dm-subnav">
                      {sections.map((section) => {
                        const isSectionActive = activeTab === section.id
                        return (
                          <button
                            key={section.id}
                            type="button"
                            className={`dm-subnav-item ${isSectionActive ? 'active' : ''}`}
                            onClick={() => handleTabChange(section.id as ResultsTab)}
                          >
                            <span className="dm-subnav-icon">{section.icon}</span>
                            <span className="dm-subnav-label">{section.label}</span>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </Fragment>
              )
            })}
          </nav>

          <SidebarFooter />
        </aside>

        <main className="dm-main">
          <header className="dm-header">
            <div>
              <h1>Round Results</h1>
              <p>{companyName}</p>
            </div>
            <div className="dm-header-controls">
              {showResultsNotice && (
                <button
                  type="button"
                  className="dm-results-cta"
                  onClick={() => {
                    fetchResults()
                    setShowResultsNotice(false)
                  }}
                >
                  {resultsNoticeLabel}
                </button>
              )}
              {game?.status === 'COMPLETED' ? (
                <div className="dm-timer dm-timer-complete">
                  <span>Completed</span>
                </div>
              ) : (
                <div className="dm-timer">
                  <span>Time</span>
                  {timeRemainingLabel}
                </div>
              )}
              <button
                type="button"
                className="dm-session"
                onClick={() => setSessionOpen((open) => !open)}
              >
                <span className="dm-session-round dm-session-small">{roundLabel}</span>
                <span className="dm-session-scenario dm-session-small">{gameName}</span>
                <span className="dm-session-caret">▾</span>
                {sessionOpen && (
                  <span className="dm-session-menu" onClick={(event) => event.stopPropagation()}>
                    <span className="dm-menu-row"><span className="dm-menu-label">Game Code</span><span className="dm-menu-value">{gameCode}</span></span>
                    <span className="dm-menu-row"><span className="dm-menu-label">Team</span><span className="dm-menu-value">{teamNameDisplay}</span></span>
                    <span className="dm-menu-row"><span className="dm-menu-label">Team Code</span><span className="dm-menu-value">{teamCode}</span></span>
                    <span className="dm-menu-row">
                      <button type="button" className="dm-logout" onClick={() => { logout(); navigate('/'); }}>Log Out</button>
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
              <div className="dm-scroll">

                {/* Timeline Round Selector */}
                <div className="dm-timeline-container" style={{ display: (activeTab === 'market-economics' || activeTab === 'leaderboard') ? 'none' : undefined }}>
                  <div className="dm-timeline-track">
                    {(() => {
                      const totalRounds = game?.totalRounds || 6
                      const roundSteps = [
                        { id: -1, label: 'Starting Position' },
                        { id: 0, label: 'Round Trial' },
                        ...Array.from({ length: totalRounds }, (_, i) => ({ id: i + 1, label: `Round ${i + 1}` }))
                      ]

                      return roundSteps.map((step, index) => {
                        // Check if this round data is available in visibleRounds
                        const isAvailable = visibleRounds.some(r => r.roundNumber === step.id)
                        const isFuture = !isAvailable
                        const isActive = selectedRound === step.id
                        const isCompleted = isAvailable && !isActive && step.id < (selectedRound === -1 ? 999 : selectedRound) // Visually complete if before current selection

                        return (
                          <Fragment key={step.id}>
                            {index > 0 && (
                              <div className={`dm-timeline-line ${isAvailable ? 'completed' : ''}`} />
                            )}
                            <div
                              className={`dm-timeline-step ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''} ${isFuture ? 'disabled' : ''}`}
                              onClick={() => isAvailable && setSelectedRound(step.id)}
                            >
                              {isActive && <div className="dm-step-pointer">▼</div>}
                              <div className="dm-step-circle">
                                {isCompleted ? '✓' : index === 0 ? 'S' : step.id === 0 ? 'T' : step.id}
                              </div>
                              <div className="dm-step-label">{step.label}</div>
                            </div>
                          </Fragment>
                        )
                      })
                    })()}
                  </div>
                </div>

                {/* Tab Switcher removed as sidebar handles navigation */}


                {loading ? (
                  <CliPhaseLoader className="dm-loading dm-loading-cli" />
                ) : !activeRound || !currentTeamData ? (
                  <div className="dm-loading">No results available for this round.</div>
                ) : (
                  <Fragment>
                    <div style={{ paddingBottom: '3rem' }}>

                      {/* 1. Overview Section - Podium Ranking */}
                      {activeTab === 'leaderboard' && (
                        <>
                          <div id="overview" className="result-banner">
                            <div className="dm-timeline-container dm-timeline-banner">
                              <div className="dm-timeline-track dm-timeline-banner-track">
                                {(() => {
                                  const totalRounds = game?.totalRounds || 6
                                  const roundSteps = [
                                    { id: -1, label: 'Starting Position' },
                                    { id: 0, label: 'Round Trial' },
                                    ...Array.from({ length: totalRounds }, (_, i) => ({ id: i + 1, label: `Round ${i + 1}` }))
                                  ]

                                  return roundSteps.map((step, index) => {
                                    const isAvailable = visibleRounds.some(r => r.roundNumber === step.id)
                                    const isFuture = !isAvailable
                                    const isActive = selectedRound === step.id
                                    const isCompleted = isAvailable && !isActive && step.id < (selectedRound === -1 ? 999 : selectedRound)

                                    return (
                                      <Fragment key={`banner-${step.id}`}>
                                        {index > 0 && (
                                          <div className={`dm-timeline-line ${isAvailable ? 'completed' : ''}`} />
                                        )}
                                        <div
                                          className={`dm-timeline-step ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''} ${isFuture ? 'disabled' : ''}`}
                                          onClick={() => isAvailable && setSelectedRound(step.id)}
                                        >
                                          {isActive && <div className="dm-step-pointer">▼</div>}
                                          <div className="dm-step-circle">
                                            {isCompleted ? '✓' : index === 0 ? 'S' : step.id === 0 ? 'T' : step.id}
                                          </div>
                                          <div className="dm-step-label">{step.label}</div>
                                        </div>
                                      </Fragment>
                                    )
                                  })
                                })()}
                              </div>
                            </div>
                            <h1 style={{ color: '#fbbf24', fontSize: '2.5rem', fontWeight: 800, margin: '0.2rem 0 0.8rem 0', lineHeight: 1.05, position: 'relative', zIndex: 20 }}>
                              {selectedRound === -1 ? 'Starting Position' : selectedRound === 0 ? 'Round Trial Result' : `Round ${selectedRound} Result`}
                            </h1>
                            <div className="dm-rank-banner-control">
                              <span>Ranked by:</span>
                              <select
                                className="dm-rank-banner-select"
                                value={rankMetric}
                                onChange={(event) => setRankMetric(event.target.value as RankMetric)}
                              >
                                <option value="sharePrice">Share Price</option>
                                <option value="netProfit">Net Profit</option>
                                <option value="unitsSold">Units Sold</option>
                                <option value="marketShare">Market Share</option>
                                <option value="eps">EPS</option>
                              </select>
                            </div>
                            <Fireworks isActive={Boolean(isCompletedRound && myRank <= 3 && selectedRound === game?.totalRounds)} />

                            <div className="ranking-row" style={{ minHeight: myRank > 3 ? '280px' : '240px', paddingTop: '0.75rem', marginTop: '0' }}>

                              {/* Rank 2 */}
                              {sortedByRank[1] && (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}
                                  className={`rank-2-lift ${myRank > 3 ? 'super-lift' : ''}`}>
                                  <div className="trophy-icon" style={myRank > 3 ? { opacity: 0.2, filter: 'grayscale(1)' } : {}}>🥈</div>
                                  <div className={`rank-card rank-2 ${myRank > 3 ? 'faded' : sortedByRank[1].teamId === currentTeamId ? 'is-me' : ''}`}>
                                    <div className="rank-badge-num">2</div>
                                    <div className="team-name-small">{sortedByRank[1].teamName}</div>
                                    <div className="team-metric-small">{rankMetricLabel}: <strong>{formatRankMetricValue(sortedByRank[1])}</strong></div>
                                    {sortedByRank[1].teamId === currentTeamId && (
                                      <div style={{ position: 'absolute', bottom: '-12px', zIndex: 30, background: 'var(--text-accent)', color: '#0f172a', fontSize: '0.6rem', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>YOU</div>
                                    )}
                                  </div>
                                </div>
                              )}

                              {/* Rank 1 */}
                              {sortedByRank[0] && (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}
                                  className={`rank-1-lift ${myRank > 3 ? 'super-lift' : ''}`}>
                                  <div className="trophy-wrap">
                                    <div className="trophy-icon" style={myRank > 3 ? { opacity: 0.2, filter: 'grayscale(1)' } : {}}>🏆</div>
                                  </div>
                                  <div className={`rank-card rank-1 ${myRank > 3 ? 'faded' : sortedByRank[0].teamId === currentTeamId ? 'is-me' : ''}`}>
                                    <div className="rank-badge-num">1</div>
                                    <div className="team-name-small">{sortedByRank[0].teamName}</div>
                                    <div className="team-metric-small">{rankMetricLabel}: <strong>{formatRankMetricValue(sortedByRank[0])}</strong></div>
                                    {sortedByRank[0].teamId === currentTeamId && (
                                      <div style={{ position: 'absolute', bottom: '-12px', zIndex: 30, background: 'var(--text-accent)', color: '#0f172a', fontSize: '0.6rem', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>YOU</div>
                                    )}
                                  </div>
                                </div>
                              )}

                              {/* Rank 3 */}
                              {sortedByRank[2] && (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}
                                  className={`rank-3-lift ${myRank > 3 ? 'super-lift' : ''}`}>
                                  <div className="trophy-icon" style={myRank > 3 ? { opacity: 0.2, filter: 'grayscale(1)' } : {}}>🥉</div>
                                  <div className={`rank-card rank-3 ${myRank > 3 ? 'faded' : sortedByRank[2].teamId === currentTeamId ? 'is-me' : ''}`}>
                                    <div className="rank-badge-num">3</div>
                                    <div className="team-name-small">{sortedByRank[2].teamName}</div>
                                    <div className="team-metric-small">{rankMetricLabel}: <strong>{formatRankMetricValue(sortedByRank[2])}</strong></div>
                                    {sortedByRank[2].teamId === currentTeamId && (
                                      <div style={{ position: 'absolute', bottom: '-12px', zIndex: 30, background: 'var(--text-accent)', color: '#0f172a', fontSize: '0.6rem', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>YOU</div>
                                    )}
                                  </div>
                                </div>
                              )}

                              {/* Scenario B: User Card (Outside Top 3) */}
                              {myRank > 3 && (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginLeft: '1rem' }} className="rank-floor">
                                  <div className="rank-card is-me">
                                    <div style={{ position: 'absolute', bottom: '-12px', zIndex: 30, background: 'var(--text-accent)', color: '#0f172a', fontSize: '0.6rem', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>YOU</div>
                                    <div className="rank-badge-num" style={{ background: 'var(--bg-page)', color: 'var(--text-muted)', border: '1px solid var(--border-color)' }}>{myRank}</div>
                                    <div className="team-name-small">{currentTeamData.teamName}</div>
                                    <div className="team-metric-small">{rankMetricLabel}: <strong>{formatRankMetricValue(currentTeamData)}</strong></div>
                                    <div style={{ marginTop: '0.5rem', fontSize: '0.7rem', color: 'var(--color-danger)' }}>
                                      -{formatRankMetricGap(metricGapToLeader)} to Leader
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>

                            <p className="banner-sub" style={{ marginTop: '1.5rem' }}>
                              {isStartingPosition
                                ? 'This is your company\'s baseline financial position before the competition begins. All teams start with identical resources.'
                                : game?.status === 'COMPLETED' && completedSummary
                                  ? (
                                    myRank <= 3
                                      ? <span>Congratulations! You finished <span className="banner-highlight">#{myRank}</span> overall. You sold <span className="banner-highlight">{formatUnits(completedSummary.totalUnits)}</span> units and generated <span className="banner-highlight">{formatCurrency(completedSummary.totalRevenue)}</span> in total revenue. Your highest market share was <span className="banner-highlight">{formatPercent(completedSummary.highestShare)}</span> in {completedSummary.highestRegion}.</span>
                                      : <span>Nice effort! You finished <span className="banner-highlight">#{myRank}</span> overall. You sold <span className="banner-highlight">{formatUnits(completedSummary.totalUnits)}</span> units and generated <span className="banner-highlight">{formatCurrency(completedSummary.totalRevenue)}</span> in total revenue. Your highest market share was <span className="banner-highlight">{formatPercent(completedSummary.highestShare)}</span> in {completedSummary.highestRegion}.</span>
                                  )
                                  : isLeader
                                    ? <span>You have the highest {rankMetricLabel.toLowerCase()} (<span className="banner-highlight">{formatRankMetricValue(currentTeamData)}</span>) this round.</span>
                                    : <span>Your {rankMetricLabel.toLowerCase()} is <span className="banner-highlight">{formatRankMetricValue(currentTeamData)}</span>. You are currently ranked <span className="banner-highlight">#{myRank}</span> by {rankMetricLabel}.</span>}
                            </p>
                          </div>

                        </>
                      )}

                      <div className="main-grid-replacement">
                        {activeTab === 'summary' && (
                          <div className="summary-tab-content" style={{ display: 'flex', flexDirection: 'column', gap: '2rem', maxWidth: '1200px', margin: '0 auto' }}>

                            {/* Performance Summary - Key Cards */}
                            <div className="dm-review-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                              {/* Line 1 */}
                              <div className="dm-review-card" style={{ background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)', color: 'white', position: 'relative', overflow: 'hidden', minHeight: '160px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                <div style={{ position: 'absolute', top: '-10%', right: '-5%', fontSize: '6rem', opacity: 0.1, pointerEvents: 'none' }}>💰</div>
                                <div className="dm-review-summary-label" style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.9rem' }}>Total Revenue</div>
                                <div className="dm-review-card-subtitle" style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.7rem' }}>{selectedRoundSubtitle}</div>
                                <div className="dm-review-summary-value" style={{ fontSize: '2rem', margin: '0.25rem 0', color: 'white', fontWeight: 800 }}>{formatCurrency(currentTeamData.revenue)}</div>
                                <div className="dm-review-summary-delta" style={{ color: 'rgba(255,255,255,0.9)', background: 'rgba(255,255,255,0.15)', display: 'inline-block', padding: '4px 10px', borderRadius: '6px', width: 'fit-content', backdropFilter: 'blur(4px)', fontSize: '0.75rem' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                    <div style={{ width: '40px', height: '4px', background: 'rgba(255,255,255,0.3)', borderRadius: '2px', overflow: 'hidden' }}>
                                      <div style={{ width: `${Math.max(0, Math.min(100, reviewGrossMargin * 100))}%`, height: '100%', background: 'white' }} />
                                    </div>
                                    <span style={{ fontWeight: 700 }}>GM {formatPercent(reviewGrossMargin)}</span>
                                  </div>
                                </div>
                              </div>

                              <div className="dm-review-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: '160px' }}>
                                <div className="dm-review-summary-label" style={{ fontSize: '1rem', color: '#2563eb' }}>Net Profit</div>
                                <div className="dm-review-card-subtitle">{selectedRoundSubtitle}</div>
                                <div className="dm-review-summary-value">{formatCurrency(currentTeamData.netProfit)}</div>
                                <div className="dm-review-summary-delta">
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.25rem' }}>
                                    <div style={{ flex: 1, height: '5px', background: 'var(--bg-page)', borderRadius: '2.5px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                                      <div style={{ width: `${Math.max(0, Math.min(100, reviewNetMargin * 100))}%`, height: '100%', background: '#10b981' }} />
                                    </div>
                                    <span style={{ fontWeight: 700 }}>{formatPercent(reviewNetMargin)}</span>
                                  </div>
                                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, marginTop: '2px' }}>Net profit margin</div>
                                </div>
                              </div>

                              <div className="dm-review-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: '160px' }}>
                                <div className="dm-review-summary-label" style={{ fontSize: '1rem', color: '#2563eb' }}>Total Units Sold</div>
                                <div className="dm-review-card-subtitle">{selectedRoundSubtitle}</div>
                                <div className="dm-review-summary-value">{formatUnits(currentTeamData.unitsSold)}</div>
                                <div className="dm-review-summary-delta neutral">
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.25rem' }}>
                                    <div style={{ flex: 1, height: '5px', background: 'var(--bg-page)', borderRadius: '2.5px', overflow: 'hidden', border: '1px solid var(--border-color)', display: 'flex' }}>
                                      <div style={{ width: `${reviewSoldPct}%`, height: '100%', background: '#3b82f6' }} title="Sold" />
                                      <div style={{ width: `${reviewInventoryPct}%`, height: '100%', background: '#f59e0b' }} title="Inventory" />
                                    </div>
                                    <span style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.75rem' }}>{reviewSoldPct.toFixed(0)}% Sold</span>
                                  </div>
                                  <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, marginTop: '2px', display: 'flex', justifyContent: 'space-between' }}>
                                    <span>Sold vs Inventory</span>
                                    <span>Stock: {formatUnits(currentTeamData.inventoryUnits)}</span>
                                  </div>
                                </div>
                              </div>

                              {/* Line 2 */}
                              <div className="dm-review-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: '160px' }}>
                                <div className="dm-review-summary-label" style={{ fontSize: '1rem', color: '#2563eb' }}>Total Production</div>
                                <div className="dm-review-card-subtitle">{selectedRoundSubtitle}</div>
                                <div className="dm-review-summary-value">{formatUnits(currentTeamData.unitsProduced)}</div>
                                <div className="dm-review-summary-delta neutral">
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.25rem' }}>
                                    <div style={{ flex: 1, height: '5px', background: 'var(--bg-page)', borderRadius: '2.5px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                                      <div style={{ width: `${Math.max(0, Math.min(100, (currentTeamData?.utilization ?? 0) * 100))}%`, height: '100%', background: '#8b5cf6' }} />
                                    </div>
                                    <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>{reviewUtilizationDisplay}</span>
                                  </div>
                                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, marginTop: '2px' }}>Capacity utilization</div>
                                </div>
                              </div>

                              <div className="dm-review-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: '160px' }}>
                                <div className="dm-review-summary-label" style={{ fontSize: '1rem', color: '#2563eb' }}>Total Inventory</div>
                                <div className="dm-review-card-subtitle">{selectedRoundSubtitle}</div>
                                <div className="dm-review-summary-value">{formatUnits(currentTeamData.inventoryUnits)}</div>
                                <div className="dm-review-summary-delta neutral">
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.25rem' }}>
                                    <div style={{ flex: 1, height: '5px', background: 'var(--bg-page)', borderRadius: '2.5px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                                      <div style={{ width: `${Math.min(100, (currentTeamData.inventoryUnits / (currentTeamData.unitsProduced || 1)) * 100)}%`, height: '100%', background: '#f59e0b' }} />
                                    </div>
                                    <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>{formatCurrency(currentTeamData.inventory)}</span>
                                  </div>
                                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, marginTop: '2px' }}>Inventory value at cost</div>
                                </div>
                              </div>

                              <div className="dm-review-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: '180px', padding: '1.25rem' }}>
                                <div className="dm-review-summary-label" style={{ fontSize: '1rem', color: '#2563eb', marginBottom: '0.25rem' }}>Market Share by Region</div>
                                <div className="dm-review-card-subtitle" style={{ marginBottom: '1rem' }}>{selectedRoundSubtitle}</div>
                                <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
                                  <div
                                    style={{
                                      width: '100px',
                                      height: '100px',
                                      borderRadius: '50%',
                                      background: `conic-gradient(var(--text-accent) 0% ${reviewAvgSharePct}%, var(--bg-page) ${reviewAvgSharePct}% 100%)`,
                                      border: 'none',
                                      display: 'grid',
                                      placeItems: 'center',
                                      flexShrink: 0,
                                      position: 'relative',
                                      boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'
                                    }}
                                  >
                                    <div style={{
                                      width: '65px',
                                      height: '65px',
                                      background: 'var(--bg-card)',
                                      borderRadius: '50%',
                                      display: 'grid',
                                      placeItems: 'center',
                                      fontWeight: 800,
                                      color: 'var(--text-main)',
                                      fontSize: '1rem',
                                      zIndex: 2
                                    }}>
                                      {reviewAvgShareDisplay}
                                    </div>
                                  </div>
                                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 600 }}>
                                        <span style={{ color: 'var(--text-secondary)' }}>{regionLabels.us}</span>
                                        <span>{formatPercent(reviewShareUSPct)}</span>
                                      </div>
                                      <div style={{ width: '100%', height: '6px', background: 'var(--bg-page)', borderRadius: '3px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                                        <div style={{ width: `${reviewShareUSPct}%`, height: '100%', background: '#3b82f6' }} />
                                      </div>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 600 }}>
                                        <span style={{ color: 'var(--text-secondary)' }}>{regionLabels.asia}</span>
                                        <span>{formatPercent(reviewShareAsiaPct)}</span>
                                      </div>
                                      <div style={{ width: '100%', height: '6px', background: 'var(--bg-page)', borderRadius: '3px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                                        <div style={{ width: `${reviewShareAsiaPct}%`, height: '100%', background: '#10b981' }} />
                                      </div>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 600 }}>
                                        <span style={{ color: 'var(--text-secondary)' }}>{regionLabels.europe}</span>
                                        <span>{formatPercent(reviewShareEuropePct)}</span>
                                      </div>
                                      <div style={{ width: '100%', height: '6px', background: 'var(--bg-page)', borderRadius: '3px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                                        <div style={{ width: `${reviewShareEuropePct}%`, height: '100%', background: '#f59e0b' }} />
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Regional Sales Performance table */}
                            <div className="dm-review-card">
                              <div className="dm-review-section-title">Regional Sales Performance</div>
                              <div className="dm-review-card-subtitle">{selectedRoundSubtitle}</div>
                              <div style={{ marginTop: '1rem', overflowX: 'auto' }}>
                                <table className="comparison-table">
                                  <thead>
                                    <tr>
                                      <th>Market</th>
                                      <th style={{ textAlign: 'right' }}>Units Sold</th>
                                      <th style={{ textAlign: 'right' }}>Produced</th>
                                      <th style={{ textAlign: 'right' }}>Inventory</th>
                                      <th style={{ textAlign: 'right' }}>Price</th>
                                      <th style={{ textAlign: 'right' }}>Margin</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    <tr>
                                      <td style={{ fontWeight: 600 }}>🇺🇸 {regionLabels.us}</td>
                                      <td style={{ textAlign: 'right' }}>{formatUnits(currentTeamData.unitsSoldUS)}</td>
                                      <td style={{ textAlign: 'right' }}>{formatUnits(producedByRegion('us'))}</td>
                                      <td style={{ textAlign: 'right' }}>{formatUnits(currentTeamData.inventoryUnitsUS ?? 0)}</td>
                                      <td style={{ textAlign: 'right' }}>{formatCurrency(currentTeamData.priceUS ?? 0)}</td>
                                      <td style={{ textAlign: 'right' }}>{regionMarginDisplay('us')}</td>
                                    </tr>
                                    <tr>
                                      <td style={{ fontWeight: 600 }}>🌏 {regionLabels.asia}</td>
                                      <td style={{ textAlign: 'right' }}>{formatUnits(currentTeamData.unitsSoldAsia)}</td>
                                      <td style={{ textAlign: 'right' }}>{formatUnits(producedByRegion('asia'))}</td>
                                      <td style={{ textAlign: 'right' }}>{formatUnits(currentTeamData.inventoryUnitsAsia ?? 0)}</td>
                                      <td style={{ textAlign: 'right' }}>{formatCurrency(currentTeamData.priceAsia ?? 0)}</td>
                                      <td style={{ textAlign: 'right' }}>{regionMarginDisplay('asia')}</td>
                                    </tr>
                                    <tr>
                                      <td style={{ fontWeight: 600 }}>🇪🇺 {regionLabels.europe}</td>
                                      <td style={{ textAlign: 'right' }}>{formatUnits(currentTeamData.unitsSoldEurope)}</td>
                                      <td style={{ textAlign: 'right' }}>{formatUnits(producedByRegion('europe'))}</td>
                                      <td style={{ textAlign: 'right' }}>{formatUnits(currentTeamData.inventoryUnitsEurope ?? 0)}</td>
                                      <td style={{ textAlign: 'right' }}>{formatCurrency(currentTeamData.priceEurope ?? 0)}</td>
                                      <td style={{ textAlign: 'right' }}>{regionMarginDisplay('europe')}</td>
                                    </tr>
                                    <tr className="total-row" style={{ borderTop: '2px solid var(--border-color)', fontWeight: 800, background: 'var(--bg-page)' }}>
                                      <td>Total</td>
                                      <td style={{ textAlign: 'right' }}>{formatUnits(currentTeamData.unitsSold)}</td>
                                      <td style={{ textAlign: 'right' }}>{formatUnits(currentTeamData.unitsProduced)}</td>
                                      <td style={{ textAlign: 'right' }}>{formatUnits(currentTeamData.inventoryUnits)}</td>
                                      <td style={{ textAlign: 'right' }} colSpan={2} />
                                    </tr>
                                  </tbody>
                                </table>
                              </div>
                            </div>


                            {/* 2. Performance by Round */}
                            <div id="profit" className="card">
                              <div className="card-header">
                                <div>
                                  <h2 className="card-title">Performance by Round</h2>
                                  <span className="card-subtitle-round">
                                    {metricView === 'revenue' && 'Revenue (regional breakdown)'}
                                    {metricView === 'units' && 'Units Sold (regional breakdown)'}
                                    {metricView === 'netProfit' && 'Net Profit'}
                                    {metricView === 'sharePrice' && 'Share Price'}
                                  </span>
                                </div>
                                <div className="metric-toggle">
                                  {([
                                    { key: 'revenue', label: 'Revenue' },
                                    { key: 'units', label: 'Units Sold' },
                                    { key: 'netProfit', label: 'Net Profit' },
                                    { key: 'sharePrice', label: 'Share Price' },
                                  ] as const).map((option) => (
                                    <button
                                      key={option.key}
                                      type="button"
                                      onClick={() => setMetricView(option.key)}
                                      style={{
                                        background: metricView === option.key ? '#3b82f6' : theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                                        color: metricView === option.key ? '#ffffff' : 'var(--text-main)',
                                        border: `1px solid ${metricView === option.key ? '#3b82f6' : 'var(--border-color)'}`,
                                        padding: '0.5rem 1rem',
                                        fontSize: '0.75rem',
                                        fontWeight: 600,
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s'
                                      }}
                                    >
                                      {option.label}
                                    </button>
                                  ))}
                                </div>
                              </div>
                              <div className="card-body">
                                {(() => {
                                  const metricByRound = visibleRounds
                                    .filter(r => r.roundNumber >= -1) // Include starting position (-1)
                                    .sort((a, b) => a.roundNumber - b.roundNumber)
                                    .map(round => {
                                      const teamData = round.teams.find(t => t.teamId === currentTeamId) || round.teams[0]
                                      const totalValue = (() => {
                                        if (!teamData) return 0
                                        if (metricView === 'units') return teamData.unitsSold || 0
                                        if (metricView === 'netProfit') return teamData.netProfit || 0
                                        if (metricView === 'sharePrice') return teamData.sharePrice || 0
                                        return teamData.revenue || 0
                                      })()
                                      return {
                                        name: round.roundNumber === -1 ? 'Start' : round.roundNumber === 0 ? 'Trial' : `R${round.roundNumber}`,
                                        total: totalValue,
                                        unitsSold: (teamData?.unitsSold || 0),
                                        inventory: (teamData?.inventoryUnits || 0),
                                        [regionLabels.us]: metricView === 'units' ? (teamData?.unitsSoldUS || 0) : (teamData?.revenueUS || 0),
                                        [regionLabels.asia]: metricView === 'units' ? (teamData?.unitsSoldAsia || 0) : (teamData?.revenueAsia || 0),
                                        [regionLabels.europe]: metricView === 'units' ? (teamData?.unitsSoldEurope || 0) : (teamData?.revenueEurope || 0),
                                      }
                                    })

                                  return <PerformanceChart
                                    metricByRound={metricByRound}
                                    metricView={metricView}
                                    regionLabels={regionLabels}
                                  />
                                })()}
                              </div>
                            </div>




                          </div>
                        )}

                        {/* 4. Leaderboard - Only active in leaderboard tab */}
                        {activeTab === 'leaderboard' && (
                          <div className="leaderboard-tab-content" style={{ width: '100%', margin: '0 auto' }}>
                            {/* 4. Leaderboard */}
                            <div id="leaderboard" className="card">
                              <div className="card-header">
                                <div>
                                  <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    🏆 Leaderboard
                                  </h2>
                                  <span className="card-subtitle-round" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                    {activeRound.roundNumber === -1 ? 'Starting Position' : activeRound.roundNumber === 0 ? 'Trial Round' : `Round ${activeRound.roundNumber}`}
                                  </span>
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                  <button
                                    onClick={() => setLeaderboardView('financial')}
                                    style={{
                                      background: leaderboardView === 'financial' ? '#3b82f6' : theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                                      color: leaderboardView === 'financial' ? '#ffffff' : 'var(--text-main)',
                                      border: `1px solid ${leaderboardView === 'financial' ? '#3b82f6' : 'var(--border-color)'}`,
                                      padding: '0.5rem 1rem',
                                      fontSize: '0.75rem',
                                      fontWeight: 600,
                                      borderRadius: '6px',
                                      cursor: 'pointer',
                                      transition: 'all 0.2s'
                                    }}
                                  >
                                    💰 Financial
                                  </button>
                                  <button
                                    onClick={() => setLeaderboardView('operational')}
                                    style={{
                                      background: leaderboardView === 'operational' ? '#3b82f6' : theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                                      color: leaderboardView === 'operational' ? '#ffffff' : 'var(--text-main)',
                                      border: `1px solid ${leaderboardView === 'operational' ? '#3b82f6' : 'var(--border-color)'}`,
                                      padding: '0.5rem 1rem',
                                      fontSize: '0.75rem',
                                      fontWeight: 600,
                                      borderRadius: '6px',
                                      cursor: 'pointer',
                                      transition: 'all 0.2s'
                                    }}
                                  >
                                    📊 Operational
                                  </button>
                                </div>
                              </div>
                              <div className="card-body" style={{ padding: 0 }}>
                                {leaderboardView === 'financial' ? (
                                  <>
                                    {/* Financial View - Header Row */}
                                    <div style={{
                                      display: 'grid',
                                      gridTemplateColumns: 'minmax(200px, 1.5fr) 1fr 1fr 1fr 1.2fr 1.2fr 1.2fr 1.2fr', // Updated column widths
                                      padding: '0.75rem 1rem',
                                      borderBottom: '1px solid var(--border-color)',
                                      fontSize: '0.7rem',
                                      fontWeight: 700,
                                      textTransform: 'uppercase',
                                      color: 'var(--text-secondary)',
                                      letterSpacing: '0.05em',
                                      alignItems: 'center'
                                    }}>
                                      <div>Team</div>
                                      <div style={{ textAlign: 'right' }}>{rankMetricLabel}</div>
                                      <div style={{ textAlign: 'right' }}>Revenue</div>
                                      <div style={{ textAlign: 'right' }}>Dividend</div>
                                      <div style={{ textAlign: 'right' }}>Shares Out.</div>
                                      <div style={{ textAlign: 'right' }}>TSR</div>
                                      <div style={{ textAlign: 'right' }}>EPS</div>
                                      <div style={{ textAlign: 'right' }}>ROE</div>
                                    </div>
                                    {sortedByRank.map((t, i) => (
                                      <div key={t.teamId} className="leaderboard-row" style={{
                                        background: t.teamId === currentTeamId ? 'var(--bg-hover)' : 'transparent',
                                        borderLeft: t.teamId === currentTeamId ? '4px solid var(--text-accent)' : '4px solid transparent',
                                        display: 'grid',
                                        gridTemplateColumns: 'minmax(200px, 1.5fr) 1fr 1fr 1fr 1.2fr 1.2fr 1.2fr 1.2fr', // Matching columns
                                        alignItems: 'center',
                                        padding: '0.75rem 1rem',
                                        gap: '0.5rem'
                                      }}>
                                        <div style={{ fontSize: '0.85rem' }}>
                                          <strong>{isStartingPosition ? '-' : i + 1}. {t.teamName}</strong>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                          <strong style={{ color: 'var(--text-accent)' }}>{formatRankMetricValue(t)}</strong>
                                        </div>
                                        <div style={{ textAlign: 'right', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                          ${(t.revenue / 1000000).toFixed(1)}M
                                        </div>
                                        <div style={{ textAlign: 'right', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                          {formatCurrency(t.dividends ?? 0)}
                                        </div>
                                        <div style={{ textAlign: 'right', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                          {formatUnits(t.sharesOutstanding ?? 0)}
                                        </div>
                                        <div style={{ textAlign: 'right', fontSize: '0.85rem', color: t.tsr >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                                          {formatPercent(t.tsr)}
                                        </div>
                                        <div style={{ textAlign: 'right', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                          {formatCurrency(t.eps)}
                                        </div>
                                        <div style={{ textAlign: 'right', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                          {formatPercent(t.roe)}
                                        </div>
                                      </div>
                                    ))}
                                  </>
                                ) : (
                                  <>
                                    {/* Operational View - Header Row */}
                                    <div style={{
                                      display: 'grid',
                                      gridTemplateColumns: 'minmax(200px, 1.5fr) 1fr 1fr 1fr 1.2fr 1.2fr 1.2fr 1.2fr 1fr',
                                      padding: '0.75rem 1rem',
                                      borderBottom: '1px solid var(--border-color)',
                                      fontSize: '0.7rem',
                                      fontWeight: 700,
                                      textTransform: 'uppercase',
                                      color: 'var(--text-secondary)',
                                      letterSpacing: '0.05em',
                                      alignItems: 'center'
                                    }}>
                                      <div>Team</div>
                                      <div style={{ textAlign: 'right' }}>Production</div>
                                      <div style={{ textAlign: 'right' }}>Units Sold</div>
                                      <div style={{ textAlign: 'right' }}>Inventory</div>
                                      <div style={{ textAlign: 'center' }}>Promo</div>
                                      <div style={{ textAlign: 'center' }}>Avg Price</div>
                                      <div style={{ textAlign: 'center' }}>Features</div>
                                      <div style={{ textAlign: 'center' }}>Training</div>
                                      <div style={{ textAlign: 'center' }}>CSR</div>
                                    </div>
                                    {sortedByRank.map((t, i) => {
                                      const totalProduction = (t.productionUS ?? 0) + (t.productionAsia ?? 0);
                                      const avgPrice = ((t.priceUS + t.priceAsia + t.priceEurope) / 3);
                                      const avgPromo = ((t.promoUS ?? 0) + (t.promoAsia ?? 0) + (t.promoEurope ?? 0)) / 3;
                                      return (
                                        <div key={t.teamId} className="leaderboard-row" style={{
                                          background: t.teamId === currentTeamId ? 'var(--bg-hover)' : 'transparent',
                                          borderLeft: t.teamId === currentTeamId ? '4px solid var(--text-accent)' : '4px solid transparent',
                                          display: 'grid',
                                          gridTemplateColumns: 'minmax(200px, 1.5fr) 1fr 1fr 1fr 1.2fr 1.2fr 1.2fr 1.2fr 1fr',
                                          alignItems: 'center',
                                          padding: '0.75rem 1rem',
                                          gap: '0.5rem'
                                        }}>
                                          <div style={{ fontSize: '0.85rem' }}>
                                            <strong>{isStartingPosition ? '-' : i + 1}. {t.teamName}</strong>
                                          </div>
                                          <div style={{ textAlign: 'right', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                            {formatUnits(totalProduction)}
                                          </div>
                                          <div style={{ textAlign: 'right', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                            {formatUnits(t.unitsSold)}
                                          </div>
                                          <div style={{ textAlign: 'right', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                            {formatUnits(t.inventoryUnits)}
                                          </div>
                                          <div style={{ display: 'flex', justifyContent: 'center' }}>
                                            <PillProgress value={avgPromo} max={operationalMax.promo} color="#10b981" />
                                          </div>
                                          <div style={{ display: 'flex', justifyContent: 'center' }}>
                                            <PillProgress value={avgPrice} max={priceMaxByRegion.us} color="#6366f1" />
                                          </div>
                                          <div style={{ display: 'flex', justifyContent: 'center' }}>
                                            <PillProgress value={t.features ?? 0} max={operationalMax.features} color="#f59e0b" />
                                          </div>
                                          <div style={{ display: 'flex', justifyContent: 'center' }}>
                                            <PillProgress value={t.trainingBudget ?? 0} max={operationalMax.training} color="#8b5cf6" />
                                          </div>
                                          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '2px' }}>
                                            {Array.from({ length: 4 }).map((_, idx) => (
                                              <span key={idx} style={{
                                                fontSize: '1rem',
                                                opacity: idx < (t.csrRating ?? 0) ? 1 : 0.15,
                                                transition: 'opacity 0.2s'
                                              }}>
                                                🌿
                                              </span>
                                            ))}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </>
                                )}
                              </div>
                            </div>

                            {/* Round Analysis — strengths & weaknesses per team */}
                            {roundAnalysis.length >= 2 && (
                              <div className="card" style={{ marginTop: '1.25rem' }}>
                                <div className="card-header">
                                  <div>
                                    <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                      📊 Round Analysis
                                    </h2>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                                      Relative strengths and improvement areas — {activeRound.roundNumber === 0 ? 'Trial Round' : `Round ${activeRound.roundNumber}`}
                                    </div>
                                  </div>
                                </div>
                                <div className="card-body" style={{ padding: '1rem' }}>
                                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '0.85rem' }}>
                                    {roundAnalysis.map(({ team, strengths, weaknesses, insight }) => {
                                      const isMe = team.teamId === currentTeamId
                                      return (
                                        <div
                                          key={team.teamId}
                                          style={{
                                            border: `1px solid ${isMe ? 'var(--text-accent)' : 'var(--border-color)'}`,
                                            borderRadius: '12px',
                                            padding: '0.9rem',
                                            background: isMe ? 'var(--bg-hover)' : 'var(--bg-card)',
                                            position: 'relative',
                                          }}
                                        >
                                          {isMe && (
                                            <span style={{ position: 'absolute', top: '-0.55rem', right: '0.75rem', fontSize: '0.6rem', fontWeight: 700, background: 'var(--text-accent)', color: '#0f172a', padding: '1px 6px', borderRadius: '4px', textTransform: 'uppercase' }}>
                                              YOU
                                            </span>
                                          )}
                                          <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.65rem', color: 'var(--text-main)' }}>
                                            {team.teamName}
                                          </div>
                                          {strengths.length > 0 && (
                                            <div style={{ marginBottom: '0.45rem' }}>
                                              <div style={{ fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#10b981', marginBottom: '0.3rem' }}>
                                                Strengths
                                              </div>
                                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                                                {strengths.map((s) => (
                                                  <span key={s.label} style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981', border: '1px solid rgba(16,185,129,0.25)', borderRadius: '999px', fontSize: '0.7rem', fontWeight: 600, padding: '0.15rem 0.5rem' }}>
                                                    {s.icon} {s.label}
                                                  </span>
                                                ))}
                                              </div>
                                            </div>
                                          )}
                                          {weaknesses.length > 0 && (
                                            <div style={{ marginBottom: '0.45rem' }}>
                                              <div style={{ fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#ef4444', marginBottom: '0.3rem' }}>
                                                Needs Attention
                                              </div>
                                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                                                {weaknesses.map((w) => (
                                                  <span key={w.label} style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '999px', fontSize: '0.7rem', fontWeight: 600, padding: '0.15rem 0.5rem' }}>
                                                    {w.icon} {w.label}
                                                  </span>
                                                ))}
                                              </div>
                                            </div>
                                          )}
                                          {insight && (
                                            <div style={{ marginTop: '0.5rem', fontSize: '0.76rem', color: 'var(--text-secondary)', lineHeight: 1.5, borderTop: '1px solid var(--border-color)', paddingTop: '0.45rem' }}>
                                              💡 {insight}
                                            </div>
                                          )}
                                        </div>
                                      )
                                    })}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                        {showCoachInsights && (
                        <div className="card" style={{ marginTop: '1.25rem' }}>
                          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <span>🤖</span> AI Coach Insights
                            </h2>
                          </div>
                          <div className="card-body" style={{ minHeight: '80px' }}>
                            {coachInsights.length > 0 ? (
                              coachInsights.map((line, index) => (
                                <div key={`coach-${index}`} style={{ padding: '0.25rem 0', borderBottom: index < coachInsights.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                                  {line}
                                </div>
                              ))
                            ) : (
                              <div style={{ color: '#94a3b8' }}>Waiting for data to generate insights. Complete a round to see recommendations.</div>
                            )}
                          </div>
                        </div>
                        )}

                        {/* 5. Team Highlights - Only active in highlights tab */}
                        {activeTab === 'highlights' && (
                          <div className="highlights-tab-content" style={{ maxWidth: '1200px', margin: '0 auto' }}>

                            {/* Comparative Highlight Card */}
                            <div className="card">
                              <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                  <span>✨</span> Team Highlights
                                </h2>
                              </div>
                              <div className="card-body" style={{ padding: 0, overflowX: 'auto' }}>
                                <table className="comparison-table" style={{ width: '100%', minWidth: '1000px', tableLayout: 'fixed' }}>
                                  <thead>
                                    <tr>
                                      <th style={{ width: '240px', position: 'sticky', left: 0, zIndex: 10, background: 'var(--bg-page)', boxShadow: '2px 0 5px rgba(0,0,0,0.05)' }}>Metric</th>
                                      {sortedByName.map(t => (
                                        <th key={t.teamId} style={{ textAlign: 'center', width: '160px' }}>
                                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                                            <span>{t.teamName}</span>
                                            {t.teamId === currentTeamId && <span style={{ fontSize: '0.6rem', background: 'var(--text-accent)', color: '#0f172a', padding: '1px 6px', borderRadius: '4px' }}>YOU</span>}
                                          </div>
                                        </th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {/* Pricing Strategy */}
                                    <tr className="section-header" style={{ background: 'var(--bg-hover)' }}>
                                      <td colSpan={sortedByName.length + 1} style={{ fontWeight: 800, textTransform: 'uppercase', fontSize: '0.7rem', color: 'var(--text-secondary)', padding: '10px 16px' }}>🏷️ Pricing Strategy</td>
                                    </tr>
                                    <tr>
                                      <td colSpan={sortedByName.length + 1} style={{ padding: '12px 16px', fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-main)', background: 'var(--bg-hover)' }}>Price</td>
                                    </tr>
                                    <tr>
                                      <td style={{ fontWeight: 600, position: 'sticky', left: 0, background: 'var(--bg-card)', zIndex: 5, verticalAlign: 'middle', paddingLeft: '2rem' }}>
                                        🇺🇸 {regionLabels.us}
                                      </td>
                                      {sortedByName.map(t => (
                                        <td key={t.teamId} style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                                            <PillProgress value={t.priceUS} max={priceMaxByRegion.us} color="#6366f1" />
                                          </div>
                                        </td>
                                      ))}
                                    </tr>
                                    <tr>
                                      <td style={{ fontWeight: 600, position: 'sticky', left: 0, background: 'var(--bg-card)', zIndex: 5, verticalAlign: 'middle', paddingLeft: '2rem' }}>
                                        🌏 {regionLabels.asia}
                                      </td>
                                      {sortedByName.map(t => (
                                        <td key={t.teamId} style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                                            <PillProgress value={t.priceAsia} max={priceMaxByRegion.asia} color="#6366f1" />
                                          </div>
                                        </td>
                                      ))}
                                    </tr>
                                    <tr>
                                      <td style={{ fontWeight: 600, position: 'sticky', left: 0, background: 'var(--bg-card)', zIndex: 5, verticalAlign: 'middle', paddingLeft: '2rem' }}>
                                        🇪🇺 {regionLabels.europe}
                                      </td>
                                      {sortedByName.map(t => (
                                        <td key={t.teamId} style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                                            <PillProgress value={t.priceEurope} max={priceMaxByRegion.europe} color="#6366f1" />
                                          </div>
                                        </td>
                                      ))}
                                    </tr>

                                    {/* Promotion */}
                                    <tr className="section-header" style={{ background: 'var(--bg-hover)' }}>
                                      <td colSpan={sortedByName.length + 1} style={{ fontWeight: 800, textTransform: 'uppercase', fontSize: '0.7rem', color: 'var(--text-secondary)', padding: '10px 16px' }}>📢 Promotion Investment</td>
                                    </tr>
                                    <tr>
                                      <td colSpan={sortedByName.length + 1} style={{ padding: '12px 16px', fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-main)', background: 'var(--bg-hover)' }}>Promo</td>
                                    </tr>
                                    <tr>
                                      <td style={{ fontWeight: 600, position: 'sticky', left: 0, background: 'var(--bg-card)', zIndex: 5, verticalAlign: 'middle', paddingLeft: '2rem' }}>
                                        🇺🇸 {regionLabels.us}
                                      </td>
                                      {sortedByName.map(t => (
                                        <td key={t.teamId} style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                                            <PillProgress value={t.promoUS ?? 0} max={20} color="#10b981" />
                                          </div>
                                        </td>
                                      ))}
                                    </tr>
                                    <tr>
                                      <td style={{ fontWeight: 600, position: 'sticky', left: 0, background: 'var(--bg-card)', zIndex: 5, verticalAlign: 'middle', paddingLeft: '2rem' }}>
                                        🌏 {regionLabels.asia}
                                      </td>
                                      {sortedByName.map(t => (
                                        <td key={t.teamId} style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                                            <PillProgress value={t.promoAsia ?? 0} max={20} color="#10b981" />
                                          </div>
                                        </td>
                                      ))}
                                    </tr>
                                    <tr>
                                      <td style={{ fontWeight: 600, position: 'sticky', left: 0, background: 'var(--bg-card)', zIndex: 5, verticalAlign: 'middle', paddingLeft: '2rem' }}>
                                        🇪🇺 {regionLabels.europe}
                                      </td>
                                      {sortedByName.map(t => (
                                        <td key={t.teamId} style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                                            <PillProgress value={t.promoEurope ?? 0} max={20} color="#10b981" />
                                          </div>
                                        </td>
                                      ))}
                                    </tr>

                                    {/* Product & Integrity */}
                                    <tr className="section-header" style={{ background: 'var(--bg-hover)' }}>
                                      <td colSpan={sortedByName.length + 1} style={{ fontWeight: 800, textTransform: 'uppercase', fontSize: '0.7rem', color: 'var(--text-secondary)', padding: '8px 16px' }}>🛠️ Product & Integrity</td>
                                    </tr>
                                    <tr>
                                      <td style={{ fontWeight: 600, position: 'sticky', left: 0, background: 'var(--bg-card)', zIndex: 5 }}>Features</td>
                                      {sortedByName.map(t => (
                                        <td key={t.teamId} style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                                            <StepProgress value={t.features ?? 0} max={10} color="#3b82f6" />
                                          </div>
                                        </td>
                                      ))}
                                    </tr>
                                    <tr>
                                      <td style={{ fontWeight: 600, position: 'sticky', left: 0, background: 'var(--bg-card)', zIndex: 5 }}>CSR Rating</td>
                                      {sortedByName.map(t => (
                                        <td key={t.teamId} style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                                            <LeafProgress value={t.csrRating ?? 0} max={5} />
                                          </div>
                                        </td>
                                      ))}
                                    </tr>
                                    <tr>
                                      <td style={{ fontWeight: 600, position: 'sticky', left: 0, background: 'var(--bg-card)', zIndex: 5 }}>Training Budget</td>
                                      {sortedByName.map(t => (
                                        <td key={t.teamId} style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                                            <StepProgress value={t.trainingBudget ?? 0} max={3000000} color="#f59e0b" />
                                          </div>
                                        </td>
                                      ))}
                                    </tr>

                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </div>
                        )}


                        {/* Market Economics - Only in market-economics tab */}
                        {
                          activeTab === 'market-economics' && (
                            <Suspense
                              fallback={(
                                <div style={{
                                  padding: '24px',
                                  border: '1px solid var(--border-color)',
                                  borderRadius: '8px',
                                  color: 'var(--text-secondary)',
                                }}>
                                  Loading market economics...
                                </div>
                              )}
                            >
                              <MarketEconomicsSection
                                currentTeamData={currentTeamData}
                                allRoundsData={visibleRounds}
                                roundNumber={selectedRound}
                                regionLabels={regionLabels}
                              />
                            </Suspense>
                          )
                        }


                        {/* Financial Report - Full Width - Only in financials tab */}
                        {
                          activeTab === 'financials' && (
                            <div id="financials" style={{ marginTop: '2rem' }}>
                              <FinancialReport
                                title="Comprehensive Financial Report"
                                subtitle="Detailed multi-round financial performance analysis"
                                asOf={activeRound.roundNumber === -1 ? 'Starting Position' : activeRound.roundNumber === 0 ? 'Trial Round' : `Round ${activeRound.roundNumber}`}
                                teams={financialTeams}
                                previousTeams={financialPreviousTeams}
                                exportRounds={exportRounds}
                                emphasis="bold"
                                highlightTeamId={currentTeamData.teamId}
                                allowSummaryBreakdown={true}
                                regionLabels={regionLabels}
                                compactNumbers={!showFullValues}
                                startingBalanceSheet={startingBalanceSheet}
                                industryConfig={gameConfig}
                                onRoundChange={(round) => setFinancialRound(round)}
                                currentRound={financialRound}
                                availableRounds={visibleRounds.map(r => ({
                                  roundNumber: r.roundNumber,
                                  label: r.roundNumber === -1 ? 'Starting Position' : r.roundNumber === 0 ? 'Trial Round' : `Round ${r.roundNumber}`
                                }))}
                                colorMode={theme}
                                onPrecisionToggle={() => setShowFullValues(!showFullValues)}
                              />
                            </div>
                          )
                        }
                      </div>
                    </div>

                    {isDevAdmin && (
                      <div style={{ marginTop: '1.5rem' }}>
                        <div className="dm-audit-panel">
                          <div className="dm-audit-panel-head">
                            <div className="dm-audit-panel-title">Command Prompt - audit.exe</div>
                            <div className="dm-audit-panel-actions">
                              <div className="dm-cmd-windows-btns">
                                <span className="dm-cmd-win-btn" onClick={() => setAuditOpen(!auditOpen)}>-</span>
                              </div>
                              <button
                                type="button"
                                className="dm-audit-btn"
                                onClick={handleAuditCopy}
                              >
                                {auditCopied ? 'Copied' : 'Copy'}
                              </button>
                            </div>
                          </div>
                          {auditOpen && (
                            <div style={{
                              margin: 0,
                              padding: '1.25rem',
                              fontFamily: "'Consolas', 'Monaco', 'Courier New', monospace",
                              fontSize: '0.75rem',
                              lineHeight: '1.5',
                              color: '#ffffff',
                              background: '#0c0c0c',
                              overflow: 'auto'
                            }}>
                              <div style={{ color: '#10b981', fontWeight: 700, marginBottom: '0.75rem' }}>
                                C:\Andy\Bonopoly\Audit&gt; session --debug-round all --split-view
                              </div>
                              {auditBlocks.map((block) => (
                                <div key={block.roundNumber} style={{ marginBottom: '2rem', borderBottom: '1px dashed #333', paddingBottom: '1.5rem' }}>
                                  {block.teamRow && block.startState ? (
                                    <>
                                      <div style={{ color: '#fbbf24', fontWeight: 700, marginBottom: '0.75rem', fontSize: '0.7rem' }}>
                                        {block.roundLabel.toUpperCase()}
                                      </div>
                                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                                        <div style={{ paddingRight: '0.75rem', borderRight: '1px dashed #333' }}>
                                          <div style={{ color: '#fbbf24', fontWeight: 700, marginBottom: '0.5rem', paddingBottom: '0.5rem', borderBottom: '1px solid #333', fontSize: '0.65rem' }}>
                                            PHASE 1: BEGINNING OF {block.roundLabel.toUpperCase()} <span style={{ color: '#94a3b8' }}>[Computed]</span>
                                          </div>
                                          <div style={{ color: '#888', marginBottom: '1rem', fontSize: '0.65rem', minHeight: '2.5rem' }}>
                                            Action: Carry forward prior ending balances.
                                          </div>
                                          <AuditStage2Table startState={block.startState} phaseLabel={block.phase1Label} />
                                        </div>
                                        <div>
                                          <div style={{ color: '#10b981', fontWeight: 700, marginBottom: '0.5rem', paddingBottom: '0.5rem', borderBottom: '1px solid #333', fontSize: '0.65rem' }}>
                                            PHASE 2: END OF {block.roundLabel.toUpperCase()} <span style={{ color: '#94a3b8' }}>[Results]</span>
                                          </div>
                                          <div style={{ color: '#888', marginBottom: '1rem', fontSize: '0.65rem', minHeight: '2.5rem' }}>
                                            Action: Apply operations and finance results.
                                          </div>
                                          <AuditStage3Table teamRow={block.teamRow} startState={block.startState} phaseLabel={block.phase2Label} />
                                          {block.balanceDelta && (
                                            <div style={{ marginTop: '0.75rem', color: '#e2e8f0', fontSize: '0.7rem', borderTop: '1px dashed #333', paddingTop: '0.5rem' }}>
                                              <div style={{ fontWeight: 700, color: '#fbbf24', marginBottom: '0.25rem' }}>BALANCE DELTA CHECK</div>
                                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                <span>Total Assets:</span>
                                                <span>{formatCurrency(block.balanceDelta.assets)}</span>
                                              </div>
                                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                <span>Total Liabilities + Equity:</span>
                                                <span>{formatCurrency(block.balanceDelta.liabilities + block.balanceDelta.equity)}</span>
                                              </div>
                                              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.25rem' }}>
                                                <span>Delta:</span>
                                                <span style={{ color: Math.abs(block.balanceDelta.delta) < 1 ? '#10b981' : '#ef4444', fontWeight: 700 }}>
                                                  {formatCurrency(block.balanceDelta.delta)} {Math.abs(block.balanceDelta.delta) < 1 ? 'OK' : 'FAIL'}
                                                </span>
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                      <div style={{ marginTop: '1rem', borderTop: '1px dashed #333', paddingTop: '0.75rem' }}>
                                        <div style={{ color: '#fbbf24', fontWeight: 700, marginBottom: '0.5rem', fontSize: '0.65rem' }}>
                                          SCENARIO & PARAMETER IMPACTS
                                        </div>
                                        <div style={{ color: '#e2e8f0', fontSize: '0.7rem', lineHeight: '1.6' }}>
                                          {block.scenarioLines.map((line, index) => (
                                            <div key={`${block.roundNumber}-scenario-${index}`}>{line}</div>
                                          ))}
                                        </div>
                                      </div>
                                      <div style={{ marginTop: '0.75rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                        <div style={{ borderTop: '1px dashed #333', paddingTop: '0.5rem' }}>
                                          <div style={{ color: '#10b981', fontWeight: 700, marginBottom: '0.5rem', fontSize: '0.65rem' }}>
                                            LOGISTICS COST AUDIT
                                          </div>
                                          <div style={{ color: '#e2e8f0', fontSize: '0.7rem', lineHeight: '1.6' }}>
                                            {block.logisticsLines.map((line, index) => (
                                              <div key={`${block.roundNumber}-logistics-${index}`}>{line}</div>
                                            ))}
                                          </div>
                                        </div>
                                        <div style={{ borderTop: '1px dashed #333', paddingTop: '0.5rem' }}>
                                          <div style={{ color: '#10b981', fontWeight: 700, marginBottom: '0.5rem', fontSize: '0.65rem' }}>
                                            CSR RATING AUDIT
                                          </div>
                                          <div style={{ color: '#e2e8f0', fontSize: '0.7rem', lineHeight: '1.6' }}>
                                            {block.csrLines.map((line, index) => (
                                              <div key={`${block.roundNumber}-csr-${index}`}>{line}</div>
                                            ))}
                                          </div>
                                        </div>
                                        <div style={{ borderTop: '1px dashed #333', paddingTop: '0.5rem' }}>
                                          <div style={{ color: '#10b981', fontWeight: 700, marginBottom: '0.5rem', fontSize: '0.65rem' }}>
                                            R&D COST AUDIT
                                          </div>
                                          <div style={{ color: '#e2e8f0', fontSize: '0.7rem', lineHeight: '1.6' }}>
                                            {block.rndLines.map((line, index) => (
                                              <div key={`${block.roundNumber}-rnd-${index}`}>{line}</div>
                                            ))}
                                          </div>
                                        </div>
                                      </div>
                                    </>
                                  ) : (
                                    <div style={{ color: '#94a3b8' }}>
                                      No audit data available for {block.roundLabel}.
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </Fragment>
                )}
              </div>
            </section>
          </div>
        </main>
      </div>

      <style>{`
        /* Results Scoped Styles - Matching results_report.html exactly but using Theme Tokens */
        .results-modern-scoped .dm-sidebar { border-right: 1px solid var(--border-color) !important; background: var(--bg-sidebar) !important; }
        .results-modern-scoped .dm-header { border-bottom: 1px solid var(--border-color) !important; background: var(--bg-page) !important; }
        
        .result-banner {
          background: linear-gradient(135deg, #1e3a5f 0%, #0f172a 100%);
          color: white;
          padding: 3rem 2rem 3rem 2rem;
          border-radius: 16px;
          margin-bottom: 2rem;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          border: 1px solid #0f172a;
          overflow: hidden;
        }
        
        .result-banner h1 {
          color: #fbbf24 !important;
          text-shadow: 0 2px 4px rgba(0,0,0,0.3);
        }

        /* Podium Styles */
        .ranking-row {
          display: flex;
          align-items: flex-end;
          gap: 1rem;
          justify-content: center;
          padding: 0.6rem 0 0 0;
          min-height: 240px;
          transition: all 0.5s ease;
        }

        .rank-card {
          background: var(--bg-card);
          border-radius: 16px;
          padding: 1.25rem;
          width: 160px;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3);
          position: relative;
          border: 1px solid var(--border-color);
          color: var(--text-main);
          transition: all 0.3s ease;
        }

        .rank-card.is-me {
          border: 3px solid var(--text-accent);
          box-shadow: 0 20px 25px -5px rgba(37, 99, 235, 0.3);
          transform: scale(1.05);
          z-index: 10;
        }

        .rank-card.faded {
          opacity: 0.3;
          filter: grayscale(0.8);
          transform: scale(0.9);
        }

        .rank-1-lift { margin-bottom: 25px; z-index: 5; }
        .rank-2-lift { margin-bottom: 10px; z-index: 4; }
        .rank-3-lift { margin-bottom: 0; z-index: 3; }
        .rank-floor { margin-bottom: 0; z-index: 1; }

        /* Scenario B Super Lifts */
        .super-lift.rank-1-lift { margin-bottom: 40px; }
        .super-lift.rank-2-lift { margin-bottom: 30px; }
        .super-lift.rank-3-lift { margin-bottom: 20px; }

        .trophy-icon {
          font-size: 2.5rem;
          margin-bottom: -1rem;
          z-index: 20;
          filter: drop-shadow(0 4px 6px rgba(0,0,0,0.4));
        }

        .trophy-wrap {
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
        }

        .rank-badge-num {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          display: grid;
          place-items: center;
          font-weight: 700;
          color: white;
          background: #475569; /* Default rank */
          margin-bottom: 0.5rem;
          font-size: 0.9rem;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }

        .rank-card.rank-1 { background: var(--bg-card) !important; color: var(--text-main); border: 1px solid var(--border-color); }
        .rank-card.rank-2 { background: var(--bg-card) !important; color: var(--text-main); border: 1px solid var(--border-color); }
        .rank-card.rank-3 { background: var(--bg-card) !important; color: var(--text-main); border: 1px solid var(--border-color); }

        /* Restore colored badges for Original Look */
        .rank-1 .rank-badge-num { background: linear-gradient(135deg, #fbbf24 0%, #d97706 100%); color: white; }
        .rank-2 .rank-badge-num { background: linear-gradient(135deg, #e2e8f0 0%, #94a3b8 100%); color: #334155; }
        .rank-3 .rank-badge-num { background: linear-gradient(135deg, #fdba74 0%, #ea580c 100%); color: white; }

        .rank-team-name {
          font-weight: 700;
          font-size: 0.95rem;
          line-height: 1.2;
          margin-bottom: 0.25rem;
          color: var(--text-main);
        }

        .rank-shares {
          color: var(--text-muted);
          font-size: 0.7rem;
          font-weight: 600;
          text-transform: uppercase;
          margin-bottom: 0.25rem;
        }

        .rank-value {
          font-size: 1.25rem;
          font-weight: 800;
          color: var(--text-accent);
        }

        /* Revenue Breakdown Visuals */
        .revenue-stack {
          display: flex;
          flex-direction: column;
          width: 100%;
          height: 80px;
          border-radius: 8px;
          overflow: hidden;
          background: var(--bg-hover);
        }

        .rev-segment {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 0.7rem;
          font-weight: 700;
          text-shadow: 0 1px 2px rgba(0,0,0,0.3);
          transition: height 0.5s ease;
        }

        .rev-segment-us { background: #3b82f6; }
        .rev-segment-asia { background: #10b981; }
        .rev-segment-europe { background: #f59e0b; }

        .rev-segment:first-child { border-radius: 0 0 0 0; }
        .rev-segment:last-child { border-radius: 4px 4px 0 0; }

        .rev-legend {
          display: flex;
          justify-content: center;
          gap: 1.5rem;
          margin-top: 1rem;
          font-size: 0.75rem;
          color: var(--text-muted);
        }

        .rev-legend-item {
          display: flex;
          align-items: center;
          gap: 0.4rem;
        }

        .rev-legend-color {
          width: 12px;
          height: 12px;
          border-radius: 3px;
        }

        .rev-label {
          margin-top: 0.75rem;
          font-size: 0.75rem;
          color: var(--text-muted);
          text-align: center;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.025em;
        }

        .rev-value {
          margin-bottom: 0.5rem;
          font-size: 0.75rem;
          font-weight: 700;
          color: var(--text-secondary);
          white-space: nowrap;
        }

        .dm-workspace .dm-content { padding: 0 !important; }
        .dm-scroll { padding: 1.5rem 2rem !important; }

        .dm-tabs-container {
          display: flex;
          gap: 0.5rem;
          margin: 1.5rem 0 2rem 0;
          border-bottom: 1px solid var(--border-color);
          padding-bottom: 0.5rem;
        }

        /* Tabs removed - classes kept for reference if needed but container hidden */

        .comparison-table {
          width: 100%;
          border-collapse: collapse;
          background: var(--bg-card) !important;
        }

        .comparison-table th {
          text-align: left;
          padding: 1.25rem 1rem;
          border-bottom: 2px solid var(--border-color);
          background: var(--bg-page);
          color: var(--text-secondary);
          font-size: 0.75rem;
          text-transform: uppercase;
          font-weight: 800;
          letter-spacing: 0.05em;
        }

        .comparison-table td {
          padding: 1.25rem 1rem;
          border-bottom: 1px solid var(--border-color);
          font-size: 0.95rem;
          background: var(--bg-card);
          color: var(--text-main);
        }

        .comparison-table tr:last-child td {
          border-bottom: none;
        }

        .metric-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 0.5rem;
          font-size: 0.875rem;
        }

        .leaderboard-row {
          padding: 1.25rem 1rem;
          border-bottom: 1px solid var(--border-color);
          background: var(--bg-card);
        }

        .health-bar-bg {
          height: 8px;
          background: var(--bg-hover);
          border-radius: 4px;
          margin: 0.5rem 0 1.25rem 0;
          overflow: hidden;
          border: 1px solid var(--border-color);
        }

        .card {
          background: var(--bg-card) !important;
          border: 1px solid var(--border-color) !important;
          box-shadow: var(--shadow-card) !important;
          border-radius: 16px !important;
          overflow: hidden;
        }

        .card-header {
          background: var(--bg-card) !important;
          border-bottom: 1px solid var(--border-color) !important;
          padding: 1.25rem 1.5rem !important;
          color: var(--text-main);
        }
        
        .card-header h3 {
          color: var(--text-main);
        }

        .metric-toggle {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          margin-top: 0.75rem;
        }

        .metric-btn {
          border: 1px solid var(--border-color);
          background: var(--bg-page);
          color: var(--text-secondary);
          padding: 0.35rem 0.75rem;
          border-radius: 999px;
          font-size: 0.75rem;
          font-weight: 600;
          cursor: pointer;
        }

        .metric-btn:hover {
          background: var(--bg-hover);
        }

        .metric-btn.active {
          background: var(--text-accent);
          border-color: var(--text-accent);
          color: white;
        }

        .card-body {
          background: var(--bg-card) !important;
          color: var(--text-main);
        }


        /* Timeline Styles */
        .dm-timeline-container {
          display: flex;
          align-items: center;
          justify-content: flex-start;
          margin-bottom: 2rem;
          position: relative;
          padding: 1rem 1rem 0.5rem 1rem;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: none;
        }
        
        .dm-timeline-container::-webkit-scrollbar {
          display: none;
        }

        .dm-timeline-track {
          display: flex;
          align-items: center;
          position: relative;
          gap: 0;
          margin: 0 auto;
          min-width: min-content;
        }
        .dm-timeline-banner {
          margin-bottom: 1rem;
          padding-top: 0.95rem;
          padding-bottom: 0.55rem;
          background: rgba(15, 23, 42, 0.28);
          border: 1px solid rgba(148, 163, 184, 0.18);
          border-radius: 14px;
        }
        .dm-timeline-banner-track {
          padding: 0 0.35rem;
        }
        .dm-timeline-banner .dm-step-label {
          color: rgba(226, 232, 240, 0.74);
          font-weight: 600;
        }
        .dm-timeline-banner .dm-timeline-step.active .dm-step-label {
          color: #f8fafc;
        }
        .dm-timeline-banner .dm-timeline-step .dm-step-circle {
          border-color: rgba(148, 163, 184, 0.4);
          background: rgba(148, 163, 184, 0.34);
          color: #0f172a;
        }
        .dm-timeline-banner .dm-timeline-step.active .dm-step-circle {
          background: #2563eb;
          border-color: #60a5fa;
          color: #e2e8f0;
        }
        .dm-timeline-banner .dm-timeline-line {
          background: rgba(226, 232, 240, 0.65);
        }
        .dm-rank-banner-control {
          margin-top: 0.25rem;
          margin-bottom: 0.55rem;
          color: rgba(255,255,255,0.95);
          font-size: 0.92rem;
          font-weight: 700;
          letter-spacing: 0.02em;
          display: flex;
          align-items: center;
          gap: 0.6rem;
          justify-content: center;
        }
        .dm-rank-banner-select {
          appearance: none;
          -webkit-appearance: none;
          -moz-appearance: none;
          background: rgba(15, 23, 42, 0.66);
          color: #fbbf24;
          border: 1px solid rgba(251, 191, 36, 0.5);
          padding: 0.32rem 1.95rem 0.32rem 0.62rem;
          font-size: 0.88rem;
          font-weight: 700;
          border-radius: 10px;
          cursor: pointer;
          line-height: 1.1;
          box-shadow: inset 0 0 0 1px rgba(15, 23, 42, 0.25);
          background-image: linear-gradient(45deg, transparent 50%, #fbbf24 50%), linear-gradient(135deg, #fbbf24 50%, transparent 50%);
          background-position: calc(100% - 15px) calc(50% - 1px), calc(100% - 9px) calc(50% - 1px);
          background-size: 6px 6px, 6px 6px;
          background-repeat: no-repeat;
        }
        .dm-rank-banner-select:focus {
          outline: none;
          border-color: #fcd34d;
          box-shadow: 0 0 0 3px rgba(251, 191, 36, 0.2);
        }
        .dm-rank-banner-select option {
          background: #1e293b;
          color: #fbbf24;
        }

        .dm-timer-complete {
          color: var(--color-success);
          font-weight: 700;
        }

        /* Connecting Line */
        .dm-timeline-line {
          height: 2px;
          background: var(--border-color);
          width: 60px;
          margin: 0 8px;
          flex-shrink: 0;
          transition: background 0.3s;
        }
        .dm-timeline-line.completed { background: var(--text-accent); }

        @media (max-width: 768px) {
          .dm-timeline-line {
            width: 30px;
            margin: 0 4px;
          }
          .dm-step-label {
            font-size: 0.7rem;
            max-width: 60px;
            overflow: hidden;
            text-overflow: ellipsis;
          }
        }

        .dm-timeline-step {
          display: flex;
          flex-direction: column;
          align-items: center;
          cursor: pointer;
          position: relative;
          z-index: 1;
          min-width: 80px;
        }

        .dm-step-pointer {
          position: absolute;
          top: -18px;
          color: var(--text-accent);
          font-size: 0.95rem;
          line-height: 1;
          font-weight: 800;
          filter: drop-shadow(0 2px 4px rgba(37, 99, 235, 0.35));
        }

        .dm-timeline-step.disabled {
          cursor: not-allowed;
          opacity: 0.5;
        }

        .dm-step-circle {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: var(--bg-card);
          border: 2px solid var(--border-color);
          display: grid;
          place-items: center;
          font-weight: 600;
          font-size: 0.85rem;
          color: var(--text-muted);
          transition: all 0.2s;
          margin-bottom: 0.5rem;
        }

        .dm-timeline-step.active .dm-step-circle {
          background: var(--text-accent);
          border-color: var(--text-accent);
          color: #0f172a;
          box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.2);
          transform: scale(1.1);
        }

        .dm-timeline-step.completed .dm-step-circle {
          background: var(--bg-hover);
          border-color: var(--text-accent);
          color: var(--text-accent);
        }

        .dm-step-label {
          font-size: 0.75rem;
          color: var(--text-muted);
          font-weight: 500;
          white-space: nowrap;
        }

        .dm-timeline-step.active .dm-step-label {
          color: var(--text-main);
          font-weight: 700;
        }

        /* Review Styles Bridge */
        .dm-review-card {
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: 16px;
          padding: 1.5rem;
          box-shadow: var(--shadow-card);
        }
        .dm-review-summary-label {
          font-size: 0.7rem;
          font-weight: 700;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 0.25rem;
        }
        .dm-review-card-subtitle {
          font-size: 0.75rem;
          color: var(--text-muted);
          margin-bottom: 0.75rem;
        }
        .dm-review-summary-value {
          font-size: 1.75rem;
          font-weight: 800;
          color: var(--text-main);
          line-height: 1.2;
          margin-bottom: 0.5rem;
        }
        .dm-review-summary-delta {
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--color-success);
        }
        .dm-review-summary-delta.neutral {
          color: var(--text-muted);
        }
        .dm-review-section-title {
          font-size: 1rem;
          font-weight: 700;
          color: var(--text-main);
          margin-bottom: 0.25rem;
        }
        .dm-review-progress-fill {
          transition: width 1s ease-out;
        }
        /* Themed Scrollbar Utility */
        .dm-scroll-themed::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        .dm-scroll-themed::-webkit-scrollbar-thumb {
          background: var(--scrollbar-thumb-bg);
          border-radius: 999px;
          border: 2px solid var(--scrollbar-thumb-border);
        }
        .dm-scroll-themed::-webkit-scrollbar-track {
          background: var(--scrollbar-track-bg);
          border-radius: 999px;
        }
      `}</style>
    </div >
  )
}

export default ResultsModernPage
