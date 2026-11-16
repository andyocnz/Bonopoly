
import { Fragment, useEffect, useMemo, useRef, useState, useId, memo, useCallback } from 'react'
import { useTheme } from '../context/ThemeContext'
import { Navigate, useNavigate, useLocation } from 'react-router-dom'
import { SidebarFooter } from '../components/SidebarFooter'
import { useGame } from '../context/GameContext'
import { authApi, teamApi, gameApi } from '../api/client'
import { useVisibilityPolling } from '../hooks/useVisibilityPolling'
// Chart.js is no longer used in this page
import {
  SCENARIOS,
  calculateMarketDemand,
  calculateMarketDemandMultiplier,
  calculateCapacity,
  calculateUnitCost,
  calculateAttractivenessBreakdown,
  calculateRoundMinus1,
  formatCurrency,
  formatPercent,
  formatUnits,
  createInitialGameState,
  getBalancedStartingFinancials,
  getGameConfigForIndustry,
  getScenarioEffectsForRound,
  getScenarioGrowthRateForRound,
  normalizeProductionLines,
  updateRnDProgress,
} from '../engine/gameEngine'
import {
  calculateLogisticsAllocation,
} from '../utils/logisticsAllocation'
import { HelpWidget } from '../components/HelpWidget'
import { useReviewData } from '../hooks/useReviewData'
import { getDefaultDecisions, transformDecisionFromDb } from '../utils/mappings'
import { AuditStage3Table } from '../components/AuditPhase2Table'
import { AuditStage2Table } from '../components/AuditPhase1Table'
import { calculateCashflowStatement } from '../utils/financialCashflow'
import { CliPhaseLoader } from '../components/CliPhaseLoader'
import './DecisionsModernPage.css'
import './DashboardModernPage.css'


const InfoTooltip = memo(({ text, label }: { text: string; label?: string }) => {
  const tooltipId = useId()
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 })
  const tipRef = useRef<HTMLSpanElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const show = useCallback(() => setOpen(true), [])
  const hide = useCallback(() => setOpen(false), [])
  const toggle = useCallback(() => setOpen((prev) => !prev), [])

  useEffect(() => {
    if (!open) return
    const handleAlign = () => {
      const tip = tipRef.current
      const button = buttonRef.current
      if (!tip || !button) return
      const buttonRect = button.getBoundingClientRect()
      const rect = tip.getBoundingClientRect()
      const padding = 10
      const desiredLeft = buttonRect.left + (buttonRect.width / 2) - (rect.width / 2)
      const left = Math.min(
        Math.max(desiredLeft, padding),
        window.innerWidth - rect.width - padding
      )
      const top = buttonRect.bottom + 6
      setPos({ top, left })
    }
    const id = window.requestAnimationFrame(handleAlign)
    return () => window.cancelAnimationFrame(id)
  }, [open])

  return (
    <span
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', marginLeft: '0.5rem' }}
      onMouseEnter={show}
      onMouseLeave={hide}
    >
      <button
        type="button"
        ref={buttonRef}
        aria-label={label || 'More info'}
        aria-describedby={open ? tooltipId : undefined}
        onFocus={show}
        onBlur={hide}
        onClick={(event) => {
          event.stopPropagation()
          toggle()
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') hide()
        }}
        style={{
          background: 'transparent',
          border: 'none',
          padding: 0,
          fontSize: '0.9rem',
          color: 'var(--text-muted)',
          opacity: open ? 1 : 0.7,
          cursor: 'help',
          lineHeight: 1,
        }}
      >
        ℹ️
      </button>
      {open && (
        <span
          ref={tipRef}
          id={tooltipId}
          role="tooltip"
          style={{
            position: 'fixed',
            top: pos.top,
            left: pos.left,
            background: 'var(--bg-card)',
            color: 'var(--text-main)',
            border: '1px solid var(--border-color)',
            padding: '0.45rem 0.6rem',
          borderRadius: '6px',
          fontSize: '0.7rem',
          fontWeight: 500,
          textTransform: 'none',
          letterSpacing: 'normal',
          textAlign: 'left',
          lineHeight: 1.35,
          minWidth: '160px',
          maxWidth: '220px',
          boxShadow: '0 8px 20px rgba(0,0,0,0.15)',
          zIndex: 20,
          whiteSpace: 'normal',
        }}
        >
          {text}
        </span>
      )}
    </span>
  )
})

type RangeWithButtonsProps = {
  min: number
  max: number
  step?: number
  buttonStep?: number
  value: number
  disabled?: boolean
  className?: string
  ariaLabel?: string
  onChange: (nextValue: number) => void
}

const RangeWithButtons = ({
  min,
  max,
  step = 1,
  buttonStep,
  value,
  disabled = false,
  className,
  ariaLabel = 'Range control',
  onChange,
}: RangeWithButtonsProps) => {
  const increment = buttonStep ?? step
  const canDecrement = !disabled && value > min
  const canIncrement = !disabled && value < max
  const applyDelta = (delta: number) => {
    if (disabled) return
    const next = Math.min(max, Math.max(min, value + delta))
    if (next !== value) onChange(next)
  }

  return (
    <div className="dm-range-control">
      <button
        type="button"
        className="dm-range-btn"
        aria-label={`${ariaLabel} decrease`}
        onClick={() => applyDelta(-increment)}
        disabled={!canDecrement}
      >
        -
      </button>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        className={className}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <button
        type="button"
        className="dm-range-btn"
        aria-label={`${ariaLabel} increase`}
        onClick={() => applyDelta(increment)}
        disabled={!canIncrement}
      >
        +
      </button>
    </div>
  )
}

// Helper function to generate market intelligence summaries from config
const getMarketIntelligence = (scenario?: unknown, demandMods?: unknown, interestSpread?: number, csrMod?: number, tariffMods?: unknown) => {
  // Helper to get qualitative magnitude for multipliers (1.0 is baseline)
  const getMagnitudeForMultiplier = (modifier: number): string => {
    const delta = Math.abs(modifier - 1)
    if (delta < 0.05) return 'slightly'
    if (delta < 0.10) return 'moderately'
    if (delta < 0.20) return 'significantly'
    return 'dramatically'
  }

  // Helper to get qualitative magnitude for absolute changes
  const getMagnitudeForDelta = (delta: number): string => {
    const absDelta = Math.abs(delta)
    if (absDelta < 0.03) return 'slightly'
    if (absDelta < 0.08) return 'moderately'
    if (absDelta < 0.15) return 'significantly'
    return 'dramatically'
  }

  // Build scenario-specific additions
  const scenarioNotes = {
    us: '',
    asia: '',
    europe: '',
    financial: '',
    global: [] as string[], // Global effects that apply to all markets
  }

  // === REGION-SPECIFIC MODIFIERS ===

  // Demand modifiers (region-specific)
  if (demandMods) {
    if (demandMods.us > 0.05) scenarioNotes.us = ` 🔥 THIS ROUND: Strong demand surge expected - market is booming.`
    else if (demandMods.us < -0.05) scenarioNotes.us = ` ⚠️ THIS ROUND: Demand weakening - expect tougher sales conditions.`

    if (demandMods.asia > 0.05) scenarioNotes.asia = ` 🔥 THIS ROUND: High-growth momentum accelerating - volume opportunity is exceptional.`
    else if (demandMods.asia < -0.05) scenarioNotes.asia = ` ⚠️ THIS ROUND: Market cooling - buyers more price-sensitive than usual.`

    if (demandMods.europe > 0.05) scenarioNotes.europe = ` 🔥 THIS ROUND: Premium buyers are spending - strong market conditions.`
    else if (demandMods.europe < -0.05) scenarioNotes.europe = ` ⚠️ THIS ROUND: Economic caution prevails - even premium buyers pulling back.`
  }

  // CSR importance modifier (mainly affects Europe)
  if (csrMod !== undefined && csrMod !== 1) {
    if (csrMod > 1.2) {
      scenarioNotes.europe += ` 🌿 THIS ROUND: Sustainability is front-page news - CSR investment will pay dividends.`
    } else if (csrMod < 0.8) {
      scenarioNotes.europe += ` THIS ROUND: CSR taking a back seat to economic concerns this round.`
    }
  }

  // Tariff changes (region-specific logistics)
  if (tariffMods) {
    const usToAsiaChange = (tariffMods.usToAsia || 0)
    const usToEuropeChange = (tariffMods.usToEurope || 0)

    if (usToAsiaChange > 0.1) {
      const magnitude = getMagnitudeForDelta(usToAsiaChange)
      scenarioNotes.asia += ` 🚢 THIS ROUND: Shipping tariffs to Asia increased ${magnitude} - logistics costs are higher.`
    } else if (usToAsiaChange < -0.1) {
      const magnitude = getMagnitudeForDelta(usToAsiaChange)
      scenarioNotes.asia += ` 🚢 THIS ROUND: Shipping tariffs to Asia reduced ${magnitude} - logistics costs are lower.`
    }

    if (usToEuropeChange > 0.1) {
      const magnitude = getMagnitudeForDelta(usToEuropeChange)
      scenarioNotes.europe += ` 🚢 THIS ROUND: Trade friction increasing ${magnitude} - shipping to Europe more expensive.`
    } else if (usToEuropeChange < -0.1) {
      const magnitude = getMagnitudeForDelta(usToEuropeChange)
      scenarioNotes.europe += ` 🚢 THIS ROUND: Trade facilitation improving ${magnitude} - shipping to Europe more affordable.`
    }
  }

  // Tax rate changes (region-specific)
  if (scenario?.taxRateDeltaByRegion) {
    const taxDeltas = scenario.taxRateDeltaByRegion
    if (taxDeltas.us && Math.abs(taxDeltas.us) > 0.01) {
      const magnitude = getMagnitudeForDelta(taxDeltas.us)
      scenarioNotes.us += ` 💼 THIS ROUND: Corporate tax ${taxDeltas.us > 0 ? 'increase' : 'relief'} ${magnitude} - affects profitability.`
    }
    if (taxDeltas.asia && Math.abs(taxDeltas.asia) > 0.01) {
      const magnitude = getMagnitudeForDelta(taxDeltas.asia)
      scenarioNotes.asia += ` 💼 THIS ROUND: Tax policy ${taxDeltas.asia > 0 ? 'tightening' : 'easing'} ${magnitude} - impacts net margins.`
    }
    if (taxDeltas.europe && Math.abs(taxDeltas.europe) > 0.01) {
      const magnitude = getMagnitudeForDelta(taxDeltas.europe)
      scenarioNotes.europe += ` 💼 THIS ROUND: Tax ${taxDeltas.europe > 0 ? 'burden increasing' : 'relief granted'} ${magnitude} - changes take-home profit.`
    }
  }

  // === GLOBAL MODIFIERS (apply to all markets) ===

  // Price elasticity modifier
  if (scenario?.priceElasticityModifier !== undefined && scenario.priceElasticityModifier !== 1) {
    const modifier = scenario.priceElasticityModifier
    const magnitude = getMagnitudeForMultiplier(modifier)
    if (modifier > 1.05) {
      scenarioNotes.global.push(`📊 Price Sensitivity Increased ${magnitude}: Customers are more price-conscious - price increases will hurt sales more than usual across all markets.`)
    } else if (modifier < 0.95) {
      scenarioNotes.global.push(`📊 Price Sensitivity Decreased ${magnitude}: Customers less focused on price - you have more pricing power across all markets.`)
    }
  }

  // Cost inflation
  if (scenario?.costInflation !== undefined && scenario.costInflation !== 1) {
    const modifier = scenario.costInflation
    const magnitude = getMagnitudeForMultiplier(modifier)
    if (modifier > 1.02) {
      scenarioNotes.global.push(`📈 Supply Chain Inflation: Material and production costs rising ${magnitude} - your unit costs are higher this round.`)
    } else if (modifier < 0.98) {
      scenarioNotes.global.push(`📉 Deflation: Material costs falling ${magnitude} - your production expenses are lower this round.`)
    }
  }

  // Marketing effectiveness
  if (scenario?.marketingEffectModifier !== undefined && scenario.marketingEffectModifier !== 1) {
    const modifier = scenario.marketingEffectModifier
    const magnitude = getMagnitudeForMultiplier(modifier)
    if (modifier > 1.05) {
      scenarioNotes.global.push(`📢 Marketing Boost: Advertising is ${magnitude} more effective - marketing budgets deliver better reach and impact.`)
    } else if (modifier < 0.95) {
      scenarioNotes.global.push(`📢 Marketing Headwind: Ad fatigue or market saturation - marketing spend ${magnitude} less effective this round.`)
    }
  }

  // Investment cost multiplier
  if (scenario?.investmentCostMultiplier !== undefined && scenario.investmentCostMultiplier !== 1) {
    const modifier = scenario.investmentCostMultiplier
    const magnitude = getMagnitudeForMultiplier(modifier)
    if (modifier > 1.03) {
      scenarioNotes.global.push(`🏗️ Investment Costs Increased ${magnitude}: R&D staff, factory expansions, and capital investments are more expensive.`)
    } else if (modifier < 0.97) {
      scenarioNotes.global.push(`🏗️ Investment Costs Reduced ${magnitude}: R&D staff, factory expansions, and capital investments are cheaper.`)
    }
  }

  // Interest rate spread
  if (interestSpread !== undefined && Math.abs(interestSpread) > 0.002) {
    const magnitude = getMagnitudeForDelta(interestSpread)
    if (interestSpread > 0) {
      scenarioNotes.financial += ` 📈 THIS ROUND: Interest rates rising ${magnitude} - borrowing costs are increasing.`
    } else {
      scenarioNotes.financial += ` 📉 THIS ROUND: Interest rates falling ${magnitude} - cheaper financing available.`
    }
  }

  // Working capital changes
  if (scenario?.workingCapitalDelta) {
    const wc = scenario.workingCapitalDelta
    if (wc.inventory && Math.abs(wc.inventory) > 0.01) {
      const magnitude = getMagnitudeForDelta(wc.inventory)
      scenarioNotes.global.push(`💰 Inventory Holding Costs ${wc.inventory > 0 ? 'Increased' : 'Decreased'} ${magnitude}: ${wc.inventory > 0 ? 'More cash tied up in stock' : 'Better inventory turnover'}.`)
    }
  }

  return {
    global: scenarioNotes.global,
    us: {
      character: 'Mature, innovation-driven market with balanced demand',
      salesDrivers: 'North America customers value cutting-edge features and product quality above all else. Price matters, but they\'re willing to pay more for superior innovation. This is your R&D showcase market - invest heavily in features to capture premium revenue. CSR (Corporate Social Responsibility) practices matter moderately here.',
      strategy: 'Premium innovation positioning. Lead with technology, support with quality.' + scenarioNotes.us,
    },
    asia: {
      character: 'High-growth, volume-focused, price-competitive market',
      salesDrivers: 'Price is king in Asia-Pacific. Customers are highly cost-conscious and will switch to competitors for better value. This market also appreciates innovation, but won\'t pay premium prices for it. CSR (Corporate Social Responsibility) investment yields minimal returns here. This is your volume play - maximize production capacity and compete on cost efficiency.',
      strategy: 'Cost leadership and operational excellence. Win through volume and efficiency.' + scenarioNotes.asia,
    },
    europe: {
      character: 'Premium, sustainability-conscious, quality-focused market',
      salesDrivers: 'European customers prioritize sustainability and ethical business practices above all. They care deeply about CSR (Corporate Social Responsibility) ratings and will reward responsible companies with loyalty and premium pricing. Quality and features also matter, but sustainability is your competitive edge here. Marketing spend is highly effective in this market.',
      strategy: 'Sustainability leadership. Invest in high-CSR suppliers and emphasize ethical operations.' + scenarioNotes.europe,
    },
    financial: {
      summary: 'Long-term borrowing is manageable, but short-term debt carries significant interest penalties. Tax burden varies by region - Asia offers the most favorable tax environment, Europe the highest. Maintain healthy reserves to avoid expensive short-term financing.' + scenarioNotes.financial,
    },
  }
}

const STEPS = [
  { id: 'review', label: 'Review' },
  { id: 'forecast', label: 'Forecast' },
  { id: 'production', label: 'Production' },
  { id: 'logistics', label: 'Logistics' },
  { id: 'rnd', label: 'R&D' },
  { id: 'marketing', label: 'Marketing' },
  { id: 'finance', label: 'Finance' },
  { id: 'submit', label: 'Submit' },
]

const MAIN_NAV = [
  { id: 'mission', label: 'Mission', path: '/mission' },
  { id: 'results', label: 'Results', path: '/results' },
  { id: 'decisions', label: 'Decisions ⚡', path: '/decisions' },
]

const SCENARIO_IMAGES: Record<number, string> = {
  0: 'stablemarket.jpg',
  1: 'asiaboom.jpg',
  2: 'greenwave.jpg',
  3: 'pricewar.jpg',
  4: 'recession.jpg',
  5: 'tradewar.jpg',
  6: 'pandemic.jpg',
  7: 'regional conflig.jpg',
  8: 'productivityboom.jpg',
  9: 'energyshock.jpg',
  10: 'recoveryrally.jpg'
}
export function DecisionsModernPage() {
  const navigate = useNavigate()
  const { theme, toggleTheme } = useTheme()
  const { team, game, gameState, isAdmin, authReady, logout, setGame } = useGame()
  const gameConfig = useMemo(
    () => (game?.gameConfig && typeof game.gameConfig === 'object'
      ? game.gameConfig
      : getGameConfigForIndustry(
        game?.industry,
        game?.capacityPerFactory ? { capacityPerPlant: game.capacityPerFactory } : undefined
      )),
    [game?.gameConfig, game?.industry, game?.capacityPerFactory]
  )
  const GAME_CONFIG = gameConfig
  const defaults = GAME_CONFIG.defaults
  const [activeStepIndex, setActiveStepIndex] = useState(0)
  const [visitedSteps, setVisitedSteps] = useState<Set<number>>(new Set([0]))
  const [sessionOpen, setSessionOpen] = useState(false)
  const sessionMenuRef = useRef<HTMLButtonElement>(null)
  const location = useLocation()
  const isDevParam = useMemo(
    () => new URLSearchParams(location.search).get('dev') === 'admin',
    [location.search]
  )
  const [adminSessionOk, setAdminSessionOk] = useState(false)
  const isDevAdmin = useMemo(
    () => isDevParam && (isAdmin || adminSessionOk),
    [isDevParam, isAdmin, adminSessionOk]
  )
  const [debugOpen] = useState(false)
  const [auditOpen, setAuditOpen] = useState(true)
  const [auditVisible, setAuditVisible] = useState(() => isDevAdmin)
  const [auditCopied, setAuditCopied] = useState(false)
  const [selectedRegion, setSelectedRegion] = useState<'us' | 'asia' | 'europe'>('us')
  const [now, setNow] = useState(() => Date.now())
  const [fetchedResults, setFetchedResults] = useState<unknown[]>([])
  const [currentDecision, setCurrentDecision] = useState<Record<string, unknown> | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [localSubmittedAt, setLocalSubmittedAt] = useState<string | null>(null)
  const [serverSubmittedAt, setServerSubmittedAt] = useState<string | null>(null)
  const [forecastTargets, setForecastTargets] = useState({ us: 0, asia: 0, europe: 0 })
  const forecastInitializedRef = useRef(false)
  const [shareActionMode, setShareActionMode] = useState<'issue' | 'buyback' | null>(null)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const autoAdvancePollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const saveStatusTimeout = useRef<number | null>(null)
  const [prevRoundDecision, setPrevRoundDecision] = useState<Record<string, unknown> | null>(null)
  const [balanceView, setBalanceView] = useState<'chart' | 'summary'>('summary')
  const [selectedRegionTab, setSelectedRegionTab] = useState<'us' | 'asia' | 'europe'>('us')
  const currentRound = game?.currentRound ?? 0
  const scenarioId = game?.scenarioSequence?.[currentRound] ?? 0
  const scenario = SCENARIOS[scenarioId] || SCENARIOS[0]
  const isGameComplete = game?.status === 'COMPLETED'
  const isDemoGame = useMemo(() => {
    const autoAdvance = sessionStorage.getItem('autoAdvance')
    const demoGameId = sessionStorage.getItem('demoGameId')
    return autoAdvance === 'true' && demoGameId === String(game?.id)
  }, [game?.id])
  const visibleSteps = useMemo(
    () => STEPS,
    []
  )
  const activeVisibleStep = visibleSteps[activeStepIndex] ?? visibleSteps[0]
  const activeStep = activeVisibleStep

  const roundLabel = currentRound === 0 ? 'Trial Round' : `Round ${currentRound} / ${game?.totalRounds || '-'}`
  const scenarioLabel = scenario?.name || 'Stable Market'
  const scenarioDemandModifiers = scenario?.demandModifier || { us: 0, asia: 0, europe: 0 }
  const briefingDate = useMemo(
    () => new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    []
  )

  const teamName = team?.name || 'Team'
  const gameCode = game?.gameCode || '---'
  const gameName = game?.name || 'AIgopoly'
  const teamCode = team?.teamCode || '---'
  const submittedAt = serverSubmittedAt
    ? new Date(serverSubmittedAt)
    : localSubmittedAt
      ? new Date(localSubmittedAt)
      : null
  const submittedAtLabel = submittedAt
    ? submittedAt.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
    : ''
  const isSubmitted = Boolean(submittedAt || currentDecision?.isSubmitted || submitted)
  const isLocked = Boolean(currentDecision?.isLocked || isSubmitted)
  const impactStatusLabelLive = isGameComplete
    ? 'Completed'
    : isSubmitted
      ? 'Submitted'
      : isLocked
        ? 'Locked'
        : 'Live'
  const impactStatusLabelActive = isGameComplete
    ? 'Completed'
    : isSubmitted
      ? 'Submitted'
      : isLocked
        ? 'Locked'
        : 'Active'
  const impactStatusStyle = isGameComplete
    ? { color: '#22c55e' }
    : isSubmitted || isLocked
      ? { color: '#f59e0b' }
      : { color: '#10b981' }
  const impactPulseStyle = isGameComplete
    ? { background: '#22c55e', boxShadow: '0 0 0 0 rgba(34, 197, 94, 0.7)' }
    : isSubmitted || isLocked
      ? { background: '#f59e0b', boxShadow: '0 0 0 0 rgba(245, 158, 11, 0.7)' }
      : { background: '#10b981', boxShadow: '0 0 0 0 rgba(16, 185, 129, 0.7)' }
  const renderImpactStatus = (label: string, showPulse = true) => (
    <>
      {showPulse && <span className="status-pulse" style={impactPulseStyle}></span>}
      <span>{label}</span>
    </>
  )
  const regionLabels = game?.regionLabels || {
    us: 'United States',
    asia: 'Asia Pacific',
    europe: 'Europe',
  }
  const regionTooltipText = {
    us: 'Mature, innovation-driven market with balanced demand. Customers value cutting-edge features and product quality above all else.',
    asia: 'High-growth, volume-focused, price-competitive market. Customers are highly cost-conscious and will switch to competitors for better value.',
    europe: 'Premium, sustainability-conscious, quality-focused market. Customers prioritize sustainability and ethical business practices above all.',
  }
  const formatPriorityLabel = (priority: Array<'us' | 'asia' | 'europe'>) =>
    priority
      .map((region) => (region === 'us' ? 'Americas' : region === 'asia' ? 'Asia-Pacific' : 'Europe'))
      .join(' → ')
  const tooltipCopy = {
    growthTarget: 'Set your expected sales growth relative to last round. This target determines your planned unit sales for the upcoming round.',
    shiftStrategy: 'Increase production by adding extra shifts when factory capacity cannot meet demand. Additional shifts raise output but increase unit production cost.',
    supplier: 'Supplier tiers trade off cost and sustainability. Lower tiers are cheaper. Higher tiers increase manufacturing input cost but improve CSR standing, which can help demand in CSR-sensitive markets.',
    inHouse: 'Units produced in your own factory at lower variable cost but limited by installed capacity.',
    outsource: 'Outsource production to meet excess demand. Outsourced units have higher unit costs but no capacity constraints.',
    factoryEfficiency: 'Represents how effectively your factory operates. Efficiency close to the optimal level minimizes unit cost, while over- or under-utilization increases costs. Operating too far above or below the optimal efficiency increases waste, overtime, or idle capacity costs.',
    rndHeadcount: 'Set the number of R&D staff. Larger teams increase research output and reduce the time required to unlock new features.',
    training: 'Invest in staff training to improve productivity and efficiency. Higher training levels increase research effectiveness and accelerate feature development. Training improves output per researcher but comes at higher short-term cost.',
    unitPrice: 'Set the selling price of your product in each region. Price affects demand, revenue, and competitive positioning.',
    promotion: 'Allocate your marketing and advertising spend as a percentage of revenue. Higher promotion increases product attractiveness but reduces short-term profit.',
    debt: 'Borrow new debt or repay existing loans. Debt increases available cash but raises interest expense and financial risk.',
    shareholder: 'Manage equity by paying dividends, issuing new shares to raise capital, or buying back shares to reduce share count.',
    capex: 'Invest in new factory capacity. Investments made this round become available in the next round and increase future production capacity.',
    features: 'Product features improve how attractive your product is to customers. More features can increase demand, but require time and R&D investment to develop.',
  }
  const industryKey = (game?.industry || '').trim().toLowerCase()
  const industryIcon = useMemo(() => {
    const icons: Record<string, string> = {
      'oil': new URL('../../icons/oil factory.png', import.meta.url).href,
      'oil & energy': new URL('../../icons/oil factory.png', import.meta.url).href,
      'oil and energy': new URL('../../icons/oil factory.png', import.meta.url).href,
      'electronics': new URL('../../icons/electrics factory.png', import.meta.url).href,
      'electronics & technology': new URL('../../icons/electrics factory.png', import.meta.url).href,
      'electronics and technology': new URL('../../icons/electrics factory.png', import.meta.url).href,
      'automotive': new URL('../../icons/car factory.png', import.meta.url).href,
      'auto': new URL('../../icons/car factory.png', import.meta.url).href,
      'automobile': new URL('../../icons/car factory.png', import.meta.url).href,
    }
    return icons[industryKey]
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
    if (!team?.id || game?.currentRound === undefined || !game?.id) return
    const key = `decisions-modern-submitted-${game.id}-${team.id}-${game.currentRound}`
    try {
      setLocalSubmittedAt(localStorage.getItem(key))
    } catch {
      setLocalSubmittedAt(null)
    }
  }, [team?.id, game?.id, game?.currentRound])

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

  useEffect(() => {
    if (isDevAdmin) {
      setAuditVisible(true)
    }
  }, [isDevAdmin])

  useEffect(() => {
    if (!game?.id) return
    const storedAutoAdvance = sessionStorage.getItem('autoAdvance')
    const storedDemoGameId = sessionStorage.getItem('demoGameId')
    if (storedAutoAdvance === 'true' && storedDemoGameId === String(game.id)) {
      return
    }

    let active = true
    const syncDemoFlags = async () => {
      try {
        const response = await gameApi.get(game.id, { mode: 'lite' })
        if (!active) return
        const freshGame = response.game as unknown
        const teams = freshGame?.teams || []
        const humanTeams = teams.filter((t: unknown) => !t.isComputer)
        const aiTeams = teams.filter((t: unknown) => t.isComputer)
        const isOneHumanVsAI = humanTeams.length === 1 && aiTeams.length > 0

        if (isOneHumanVsAI) {
          sessionStorage.setItem('demoMode', 'true')
          sessionStorage.setItem('autoAdvance', 'true')
          sessionStorage.setItem('demoGameId', String(freshGame.id))
        }
      } catch (err) {
        console.warn('[DecisionsModern] Failed to sync demo flags', err)
      }
    }

    syncDemoFlags()
    return () => {
      active = false
    }
  }, [game?.id])

  // Restart demo auto-calculator if needed
  useEffect(() => {
    console.log('[DecisionsModern] Checking for demo game...')
    const autoAdvance = sessionStorage.getItem('autoAdvance')
    const demoGameId = sessionStorage.getItem('demoGameId')
    const isCurrentDemoGame = demoGameId === String(game?.id)
    let ownedIntervalId: ReturnType<typeof setInterval> | null = null

    console.log('[DecisionsModern] autoAdvance:', autoAdvance, 'demoGameId:', demoGameId, 'game?.id:', game?.id)

    if (autoAdvance === 'true' && demoGameId && isCurrentDemoGame) {
      const existingInterval = (window as unknown).demoAutoCalculatorInterval
      console.log('[DecisionsModern] Existing interval:', existingInterval)

      if (!existingInterval) {
        console.log('[DecisionsModern] Starting demo auto-calculator for game', demoGameId)

        const startAutoCalc = () => {
          const checkInterval = 30000
          console.log(`[DemoAutoCalc] Starting auto-calculator for game ${demoGameId}`)

          ownedIntervalId = setInterval(async () => {
            if (document.visibilityState !== 'visible') return

            try {
              const response = await gameApi.get(demoGameId, { mode: 'lite' })
              const freshGame = response.game as unknown
              console.log(`[DemoAutoCalc] Poll - Round ${freshGame.currentRound}, Status: ${freshGame.status}`)

              if (String(freshGame.status || '').toUpperCase() === 'COMPLETED') {
                console.log('[DemoAutoCalc] Game completed, stopping auto-calculator')
                if (ownedIntervalId) {
                  clearInterval(ownedIntervalId)
                  ownedIntervalId = null
                }
                ;(window as unknown).demoAutoCalculatorInterval = undefined
                return
              }

              if (freshGame.status === 'ACTIVE' && freshGame.teams) {
                const teams = freshGame.teams
                const humanTeams = teams.filter((t: unknown) => !t.isComputer)
                const aiTeams = teams.filter((t: unknown) => t.isComputer)

                const submittedHumans = humanTeams.filter((t: unknown) => {
                  const currentDecision = t.decisions?.find((d: unknown) => d.roundNumber === freshGame.currentRound)
                  return currentDecision?.isSubmitted === true
                })

                console.log(`[DemoAutoCalc] Teams - Human: ${humanTeams.length}, AI: ${aiTeams.length}, Submitted: ${submittedHumans.length}`)

                const isOneHumanVsAI = humanTeams.length === 1 && aiTeams.length > 0
                console.log(`[DemoAutoCalc] Is 1vAI: ${isOneHumanVsAI}, All submitted: ${submittedHumans.length >= humanTeams.length}`)

                if (isOneHumanVsAI && submittedHumans.length >= humanTeams.length) {
                  try {
                    console.log(`[DemoAutoCalc] Triggering calculateRound for round ${freshGame.currentRound}`)
                    await gameApi.advance(demoGameId)
                    console.log(`[DemoAutoCalc] Advanced from round ${freshGame.currentRound}`)
                  } catch (err) {
                    console.error('[DemoAutoCalc] Auto-advance failed:', err)
                  }
                }
              }
            } catch (err) {
              console.error('[DemoAutoCalc] Demo auto-calculator error:', err)
            }
          }, checkInterval)

          ;(window as unknown).demoAutoCalculatorInterval = ownedIntervalId
          console.log('[DemoAutoCalc] Interval ID stored:', ownedIntervalId)
        }

        startAutoCalc()
      } else {
        console.log('[DecisionsModern] Demo auto-calculator already running with interval:', existingInterval)
      }
    } else {
      console.log('[DecisionsModern] Not a demo game or auto-advance disabled')
    }

    return () => {
      if (!ownedIntervalId) return
      clearInterval(ownedIntervalId)
      if ((window as unknown).demoAutoCalculatorInterval === ownedIntervalId) {
        ;(window as unknown).demoAutoCalculatorInterval = undefined
      }
      ownedIntervalId = null
    }
  }, [game?.id])

  // Close session menu when clicking outside
  useEffect(() => {
    if (!sessionOpen) return
    const handleClickOutside = (event: MouseEvent) => {
      if (sessionMenuRef.current && !sessionMenuRef.current.contains(event.target as Node)) {
        setSessionOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [sessionOpen])

  // Full results are immutable within a round, so fetch once and refresh only when round/status changes.
  const fetchResultsData = useCallback(async (knownResultsVersion?: number) => {
    if (!team?.id) return
    try {
      const stateResponse = knownResultsVersion === undefined
        ? await teamApi.getState(team.id)
        : null
      const resultsVersion = knownResultsVersion
        ?? stateResponse?.game?.resultsVersion
        ?? 0
      const response = await teamApi.getResults(team.id!, 'summary', 'decisions-modern', {
        version: resultsVersion,
      })
      if (response.results) {
        setFetchedResults(response.results as unknown[])
      }
    } catch {
      // Silently fail
    }
  }, [team?.id])

  useEffect(() => {
    fetchResultsData()
  }, [fetchResultsData, game?.currentRound])

  // Poll lightweight game state and refresh full results only when a new round/status arrives.
  const pollGameState = useCallback(async () => {
    if (!team?.id || !game?.id) return
    try {
      const stateResponse = await teamApi.getState(team.id)
      if (!stateResponse?.success || !stateResponse.game) return

      const nextRound = stateResponse.game.currentRound
      const nextStatus = String(stateResponse.game.status || '')
      const currentRoundValue = game?.currentRound
      const currentStatusValue = String(game?.status || '')
      const roundChanged = typeof currentRoundValue === 'number' && nextRound !== currentRoundValue
      const statusChanged = nextStatus !== currentStatusValue

      if (!roundChanged && !statusChanged) return

      setGame({
        ...(game as unknown),
        currentRound: nextRound,
        status: nextStatus as unknown,
        roundDeadline: stateResponse.game.roundDeadline,
      })

      await fetchResultsData(stateResponse.game.resultsVersion)
    } catch {
      // Silently fail
    }
  }, [team?.id, game?.id, game?.currentRound, game?.status, setGame, fetchResultsData, game])

  useVisibilityPolling(
    pollGameState,
    60000, // Poll every 60 seconds (increased from 30s)
    !!team?.id && !!game?.id && submitted && !isGameComplete && isDemoGame
  )


  useEffect(() => {
    forecastInitializedRef.current = false
  }, [game?.id, currentRound])

  const fallbackDecision = useMemo(() => getDefaultDecisions(GAME_CONFIG), [GAME_CONFIG])

  useEffect(() => {
    if (!team?.id) return
    if (game?.currentRound === undefined) return
    let active = true
    teamApi.getDecision(team.id, currentRound)
      .then((response) => {
        if (!active) return
        const decisionPayload = response.decision as unknown
        const mapped = transformDecisionFromDb(decisionPayload ?? null, GAME_CONFIG)
        const submittedStamp = decisionPayload?.submittedAt
        const submittedFlag = decisionPayload?.isSubmitted
        const submittedKey = game?.id
          ? `decisions-modern-submitted-${game.id}-${team.id}-${currentRound}`
          : null
        const savedForecast = decisionPayload?.production?.demandForecast
        if (savedForecast && mapped.production) {
          mapped.production = {
            ...mapped.production,
            demandForecast: {
              us: savedForecast.us ?? 0,
              asia: savedForecast.asia ?? 0,
              europe: savedForecast.europe ?? 0,
            },
          }
        }
        if (submittedFlag) {
          setSubmitted(true)
          if (submittedStamp) {
            const normalized = new Date(submittedStamp).toISOString()
            setServerSubmittedAt(normalized)
            setLocalSubmittedAt(normalized)
          }
        } else {
          setSubmitted(false)
          setServerSubmittedAt(null)
          setLocalSubmittedAt(null)
          if (submittedKey) {
            try {
              localStorage.removeItem(submittedKey)
            } catch {
              // ignore local storage errors
            }
          }
        }
        setCurrentDecision(mapped)
      })
      .catch(() => {
        if (!active) return
        setCurrentDecision(fallbackDecision)
      })
    return () => {
      active = false
    }
  }, [team?.id, currentRound, GAME_CONFIG, fallbackDecision])

  // Fetch previous round's decision from database for debugging
  useEffect(() => {
    if (!team?.id) return
    if (game?.currentRound === undefined) return
    const prevRound = currentRound - 1
    if (prevRound < 0) {
      setPrevRoundDecision(null)
      return
    }
    let active = true
    teamApi.getDecision(team.id, prevRound)
      .then((response) => {
        if (!active) return
        setPrevRoundDecision(response.decision ?? null)
      })
      .catch(() => {
        if (!active) return
        setPrevRoundDecision(null)
      })
    return () => {
      active = false
    }
  }, [team?.id, currentRound, game?.currentRound])


  useEffect(() => {
    return () => {
      if (saveStatusTimeout.current) {
        window.clearTimeout(saveStatusTimeout.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!game?.id || !team?.id || game.currentRound === undefined) return
    if (isGameComplete) {
      setActiveStepIndex(0)
      setVisitedSteps(new Set([0]))
      return
    }

    // Load active step for this specific round
    const stepKey = `decisions-modern-active-step-${game.id}-${team.id}-${game.currentRound}`
    const stored = localStorage.getItem(stepKey)
    if (stored) {
      const parsed = Number(stored)
      if (!Number.isNaN(parsed)) {
        const clamped = Math.max(0, Math.min(STEPS.length - 1, parsed))
        setActiveStepIndex(clamped)
      }
    } else {
      // New round - reset to step 0
      setActiveStepIndex(0)
    }

    // Load visited steps for this specific round
    const visitedKey = `decisions-modern-visited-steps-${game.id}-${team.id}-${game.currentRound}`
    const visitedStored = localStorage.getItem(visitedKey)
    if (visitedStored) {
      try {
        const visitedArray = JSON.parse(visitedStored) as number[]
        setVisitedSteps(new Set(visitedArray))
      } catch {
        setVisitedSteps(new Set([0]))
      }
    } else {
      // New round - only step 0 visited initially
      setVisitedSteps(new Set([0]))
    }
  }, [game?.id, team?.id, game?.currentRound, isGameComplete])

  useEffect(() => {
    if (!game?.id || !team?.id || game.currentRound === undefined || isGameComplete) return

    // Save active step for this specific round
    const stepKey = `decisions-modern-active-step-${game.id}-${team.id}-${game.currentRound}`
    localStorage.setItem(stepKey, String(activeStepIndex))

    // Save visited steps for this specific round
    const visitedKey = `decisions-modern-visited-steps-${game.id}-${team.id}-${game.currentRound}`
    localStorage.setItem(visitedKey, JSON.stringify(Array.from(visitedSteps)))
  }, [activeStepIndex, visitedSteps, game?.id, team?.id, game?.currentRound, isGameComplete])

  // Mark current step as visited
  useEffect(() => {
    setVisitedSteps(prev => new Set([...prev, activeStepIndex]))
  }, [activeStepIndex])

  const markSaving = () => {
    if (saveStatusTimeout.current) {
      window.clearTimeout(saveStatusTimeout.current)
    }
    setSaveStatus('saving')
  }

  const markSaved = () => {
    if (saveStatusTimeout.current) {
      window.clearTimeout(saveStatusTimeout.current)
    }
    setSaveStatus('saved')
    saveStatusTimeout.current = window.setTimeout(() => {
      setSaveStatus('idle')
    }, 1500)
    try {
      localStorage.setItem('decisions-modern-saved', Date.now().toString())
      window.dispatchEvent(new Event('decisions-modern-saved'))
    } catch {
      // Ignore storage errors.
    }
  }

  const markSaveError = () => {
    if (saveStatusTimeout.current) {
      window.clearTimeout(saveStatusTimeout.current)
    }
    setSaveStatus('error')
    saveStatusTimeout.current = window.setTimeout(() => {
      setSaveStatus('idle')
    }, 2500)
  }

  const formatRatio = (value: number) => `${(value * 100).toFixed(1)}%`

  const {
    reviewMarketDemand,
    prevRoundData,
    reviewTeams,
    reviewIndustryAverages,
    calculatedMarketDemand,
  } = useReviewData({
    game,
    gameState,
    team,
    fetchedResults,
    gameConfig: GAME_CONFIG,
    selectedReviewRound: null,
  })
  const debugTeamId = team?.id ?? reviewTeams?.[0]?.id
  const debugTeamName = useMemo(
    () => reviewTeams.find((t: unknown) => t.id === debugTeamId)?.name ?? 'Team',
    [reviewTeams, debugTeamId]
  )
  const findTeamResultForRound = (roundNumber: number | null) => {
    if (roundNumber === null || roundNumber === undefined) return null
    const roundResult = fetchedResults.find((r: unknown) => r.roundNumber === roundNumber)
    if (!roundResult?.teams?.length) return null
    return (
      roundResult.teams.find((t: unknown) => (t.teamId ?? t.id) === debugTeamId) ||
      roundResult.teams[0]
    )
  }
  const deriveCashflow = (pnl: unknown, bs: unknown, prevBs?: unknown) => {
    const receivablesChange = (bs?.receivables ?? 0) - (prevBs?.receivables ?? 0)
    const inventoryChange = (bs?.inventory ?? 0) - (prevBs?.inventory ?? 0)
    const payablesChange = (bs?.payables ?? 0) - (prevBs?.payables ?? 0)
    const ebitda = pnl?.ebitda ?? ((pnl?.grossProfit ?? 0) - (pnl?.operatingExpenses ?? 0))
    const interest = pnl?.interestExpense ?? pnl?.interest ?? 0
    const tax = pnl?.tax ?? 0
    const operating = ebitda - receivablesChange - inventoryChange + payablesChange - interest - tax
    const depreciation = pnl?.depreciation ?? 0
    const fixedAssets = bs?.fixedAssets ?? 0
    const prevFixed = prevBs?.fixedAssets ?? 0
    const delta = fixedAssets - prevFixed + depreciation
    const investing = delta > 0 ? -delta : 0
    const longTermDebt = bs?.longTermDebt ?? 0
    const shortTermLoans = bs?.shortTermLoans ?? bs?.shortTermDebt ?? 0
    const prevLongTermDebt = prevBs?.longTermDebt ?? 0
    const prevShortTermLoans = prevBs?.shortTermLoans ?? prevBs?.shortTermDebt ?? 0
    const financing = (longTermDebt - prevLongTermDebt) + (shortTermLoans - prevShortTermLoans)
    return { operating, investing, financing, netChange: operating + investing + financing }
  }
  const debugSnapshots = useMemo(() => {
    if (!isDevAdmin) return { phase1: '', phase2: '' }
    const round0 = fetchedResults.find((r: unknown) => r.roundNumber === 0) ? 0 : null
    const round1 = fetchedResults.find((r: unknown) => r.roundNumber === 1) ? 1 : null
    const phase1Result = findTeamResultForRound(round0)
    const phase2Result = findTeamResultForRound(round1)
    const phase1Full = phase1Result?.fullResults ?? {}
    const phase2Full = phase2Result?.fullResults ?? {}
    const phase1Pnl = phase1Full.pnl ?? phase1Result?.pnl ?? null
    const phase1Bs = phase1Full.balanceSheet ?? phase1Result?.balanceSheet ?? null
    const phase2Pnl = phase2Full.pnl ?? phase2Result?.pnl ?? null
    const phase2Bs = phase2Full.balanceSheet ?? phase2Result?.balanceSheet ?? null
    const starting = getBalancedStartingFinancials(GAME_CONFIG)
    const phase1Fallback = {
      pnl: {
        revenue: 0,
        cogs: 0,
        grossProfit: 0,
        operatingExpenses: 0,
        ebitda: 0,
        depreciation: 0,
        ebit: 0,
        interest: 0,
        tax: 0,
        netProfit: 0,
      },
      balanceSheet: {
        cash: starting.startingCash,
        inventory: 0,
        receivables: 0,
        fixedAssets: starting.fixedAssets,
        totalAssets: starting.totalAssets,
        longTermDebt: starting.startingDebt,
        shortTermLoans: 0,
        payables: 0,
        shareCapital: starting.startingShareCapital,
        retainedEarnings: 0,
        totalLiabilities: starting.startingDebt,
        totalEquity: starting.startingShareCapital,
      },
    }
    const phase1CashflowEngine = phase1Full.cashflow ?? phase1Full.cashFlow ?? phase1Result?.cashflow ?? phase1Result?.cashFlow ?? null
    const phase2CashflowEngine = phase2Full.cashflow ?? phase2Full.cashFlow ?? phase2Result?.cashflow ?? phase2Result?.cashFlow ?? null
    const phase1CashflowDerived = deriveCashflow(phase1Pnl ?? phase1Fallback.pnl, phase1Bs ?? phase1Fallback.balanceSheet)
    const phase2CashflowDerived = deriveCashflow(phase2Pnl, phase2Bs, phase1Bs ?? phase1Fallback.balanceSheet)
    const phase1Data = {
      phase: `Stage 2: Capitalization (Day 0)`,
      team: debugTeamName,
      source: phase1Result ? 'engine' : 'starting-fallback',
      pnl: phase1Pnl ?? phase1Fallback.pnl,
      balanceSheet: phase1Bs ?? phase1Fallback.balanceSheet,
      cashflow: phase1CashflowEngine ?? phase1CashflowDerived,
      cashflowSource: phase1CashflowEngine ? 'engine' : 'derived',
    }
    const phase2Data = phase2Result ? {
      phase: 'Stage 3: Operations (End of Round 1)',
      team: debugTeamName,
      source: 'engine',
      pnl: phase2Pnl ?? null,
      balanceSheet: phase2Bs ?? null,
      cashflow: phase2CashflowEngine ?? phase2CashflowDerived,
      cashflowSource: phase2CashflowEngine ? 'engine' : 'derived',
    } : {
      phase: 'Stage 3: Operations (End of Round 1)',
      team: debugTeamName,
      error: 'Round 1 results not available in fetchedResults.',
    }
    const formatMoney = (value: number) => formatCurrency(value)
    const formatMoneySigned = (value: number) => (
      value < 0 ? `(${formatCurrency(Math.abs(value))})` : formatCurrency(value)
    )
    const padLabel = (value: string, width: number = 36) => value.padEnd(width, ' ')
    const buildBalanceSheetLines = (bs: unknown) => {
      const totalAssets = bs?.totalAssets ?? 0
      const totalLiabilities = bs?.totalLiabilities ?? 0
      const totalEquity = bs?.totalEquity ?? 0
      const delta = totalAssets - (totalLiabilities + totalEquity)
      const status = Math.abs(delta) < 1 ? 'OK' : 'FAIL'
      return [
        'BALANCE SHEET',
        'ASSETS',
        `${padLabel('Cash:')}${formatMoney(bs?.cash ?? 0)}`,
        `${padLabel('Receivables:')}${formatMoney(bs?.receivables ?? 0)}`,
        `${padLabel('Inventory:')}${formatMoney(bs?.inventory ?? 0)}`,
        `${padLabel('Fixed Assets:')}${formatMoney(bs?.fixedAssets ?? 0)}`,
        `${padLabel('Total Assets:')}${formatMoney(totalAssets)}`,
        '',
        'LIABILITIES',
        `${padLabel('Payables:')}${formatMoney(bs?.payables ?? 0)}`,
        `${padLabel('Short-Term Debt:')}${formatMoney(bs?.shortTermLoans ?? 0)}`,
        `${padLabel('Long-Term Debt:')}${formatMoney(bs?.longTermDebt ?? 0)}`,
        `${padLabel('Total Liabilities:')}${formatMoney(totalLiabilities)}`,
        '',
        'EQUITY',
        `${padLabel('Share Capital:')}${formatMoney(bs?.shareCapital ?? 0)}`,
        `${padLabel('Retained Earnings:')}${formatMoney(bs?.retainedEarnings ?? 0)}`,
        `${padLabel('Total Equity:')}${formatMoney(totalEquity)}`,
        '',
        `${padLabel('CHECK (L+E):')}${formatMoneySigned(delta)} ${status}`,
      ].join('\n')
    }
    const buildPnlLines = (pnl: unknown) => {
      const revenue = pnl?.revenue ?? 0
      const cogs = pnl?.cogs ?? 0
      const grossProfit = pnl?.grossProfit ?? (revenue - cogs)
      const operatingExpenses = pnl?.operatingExpenses ?? 0
      const depreciation = pnl?.depreciation ?? 0
      const ebit = pnl?.ebit ?? (grossProfit - operatingExpenses - depreciation)
      const interest = pnl?.interestExpense ?? pnl?.interest ?? 0
      const tax = pnl?.tax ?? 0
      const netProfit = pnl?.netProfit ?? (ebit - interest - tax)
      return [
        'INCOME STATEMENT',
        `${padLabel('Sales Revenue:')}${formatMoney(revenue)}`,
        `${padLabel('COGS:')}${formatMoneySigned(-cogs)}`,
        `${padLabel('Gross Profit:')}${formatMoney(grossProfit)}`,
        `${padLabel('Operating Expenses:')}${formatMoneySigned(-operatingExpenses)}`,
        `${padLabel('Depreciation:')}${formatMoneySigned(-depreciation)}`,
        `${padLabel('EBIT:')}${formatMoney(ebit)}`,
        `${padLabel('Interest:')}${formatMoneySigned(-interest)}`,
        `${padLabel('Tax:')}${formatMoneySigned(-tax)}`,
        `${padLabel('Net Profit:')}${formatMoney(netProfit)}`,
      ].join('\n')
    }
    const buildCashflowLines = (pnl: unknown, bs: unknown, prevBs: unknown, cashflow: unknown) => {
      const statement = calculateCashflowStatement(
        {
          netProfit: pnl?.netProfit ?? 0,
          depreciation: pnl?.depreciation ?? 0,
          inventory: bs?.inventory ?? 0,
          receivables: bs?.receivables ?? 0,
          payables: bs?.payables ?? 0,
          fixedAssets: bs?.fixedAssets ?? 0,
          longTermDebt: bs?.longTermDebt ?? 0,
          shortTermLoans: bs?.shortTermLoans ?? bs?.shortTermDebt ?? 0,
          shareCapital: bs?.shareCapital ?? 0,
          dividends: pnl?.dividends ?? 0,
          cash: bs?.cash ?? 0,
          netChangeOverride: cashflow?.netChange ?? null,
        },
        prevBs ? {
          netProfit: pnl?.netProfit ?? 0,
          depreciation: pnl?.depreciation ?? 0,
          inventory: prevBs?.inventory ?? 0,
          receivables: prevBs?.receivables ?? 0,
          payables: prevBs?.payables ?? 0,
          fixedAssets: prevBs?.fixedAssets ?? 0,
          longTermDebt: prevBs?.longTermDebt ?? 0,
          shortTermLoans: prevBs?.shortTermLoans ?? prevBs?.shortTermDebt ?? 0,
          shareCapital: prevBs?.shareCapital ?? 0,
          cash: prevBs?.cash ?? 0,
        } : undefined
      )
      const cashDelta = statement.endingCash - (statement.startingCash + statement.netChange)
      const status = Math.abs(cashDelta) < 1 ? 'OK' : 'FAIL'
      return [
        'CASHFLOW STATEMENT',
        `${padLabel('Net Profit:')}${formatMoney(statement.netProfit)}`,
        `${padLabel('+ Depreciation:')}${formatMoney(statement.depreciation)}`,
        `${padLabel('(Cash from P&L):')}${formatMoney(statement.cashFromPL)}`,
        `${padLabel('- Change in Inventory:')}${formatMoneySigned(statement.changeInInventory)}`,
        `${padLabel('- Change in Receivables:')}${formatMoneySigned(statement.changeInReceivables)}`,
        `${padLabel('+ Change in Payables:')}${formatMoney(statement.changeInPayables)}`,
        `${padLabel('Cash from Operations:')}${formatMoney(statement.cashFromOperations)}`,
        `${padLabel('- CapEx:')}${formatMoneySigned(statement.capex)}`,
        `${padLabel('+ Change in Long-Term Debt:')}${formatMoney(statement.changeInLongTermDebt)}`,
        `${padLabel('+ Change in Short-Term Debt:')}${formatMoney(statement.changeInShortTermDebt)}`,
        `${padLabel('+ Change in Equity:')}${formatMoney(statement.changeInEquity)}`,
        `${padLabel('- Dividends Paid:')}${formatMoneySigned(statement.dividendsPaid)}`,
        `${padLabel('NET CHANGE IN CASH:')}${formatMoney(statement.netChange)}`,
        '',
        `${padLabel('Starting Cash (from Phase 1):')}${formatMoney(statement.startingCash)}`,
        `${padLabel('+ Net Change in Cash:')}${formatMoney(statement.netChange)}`,
        `${padLabel('CHECK (ENDING CASH):')}${formatMoneySigned(cashDelta)} ${status}`,
      ].join('\n')
    }
    const phase1BsFinal = phase1Data.balanceSheet
    const phase1PnlFinal = phase1Data.pnl
    const phase1CashflowFinal = phase1Data.cashflow
    const phase2BsFinal = phase2Data.balanceSheet
    const phase2PnlFinal = phase2Data.pnl
    const phase2CashflowFinal = phase2Data.cashflow
    const phase1Text = [
      `${phase1Data.phase} | ${phase1Data.team} | source: ${phase1Data.source}`,
      '',
      buildPnlLines(phase1PnlFinal),
      '',
      buildBalanceSheetLines(phase1BsFinal),
      '',
      buildCashflowLines(phase1PnlFinal, phase1BsFinal, {
        cash: 0,
        receivables: 0,
        inventory: 0,
        payables: 0,
        fixedAssets: 0,
        longTermDebt: 0,
        shareCapital: 0,
      }, phase1CashflowFinal),
    ].join('\n')
    const phase2Text = phase2Result ? [
      `${phase2Data.phase} | ${phase2Data.team} | source: ${phase2Data.source}`,
      '',
      buildPnlLines(phase2PnlFinal),
      '',
      buildBalanceSheetLines(phase2BsFinal),
      '',
      buildCashflowLines(phase2PnlFinal, phase2BsFinal, phase1BsFinal, phase2CashflowFinal),
    ].join('\n') : [
      `${phase2Data.phase} | ${phase2Data.team}`,
      '',
      `ERROR: ${phase2Data.error ?? 'No data available.'}`,
    ].join('\n')
    return {
      phase1: phase1Text,
      phase2: phase2Text,
    }
  }, [fetchedResults, GAME_CONFIG, debugTeamName, debugTeamId])
  const stage3DbResult = useMemo(() => findTeamResultForRound(-1), [fetchedResults, debugTeamId])
  const stage2StartState = useMemo(() => {
    const starting = getBalancedStartingFinancials(GAME_CONFIG)
    const zeroInventoryAssets = starting.fixedAssets + starting.startingCash
    const zeroInventoryDebt = Math.round(zeroInventoryAssets * 0.25)
    const zeroInventoryShareCapital = zeroInventoryAssets - zeroInventoryDebt
    return {
      cash: starting.startingCash,
      receivables: 0,
      inventory: 0,
      fixedAssets: starting.fixedAssets,
      totalAssets: zeroInventoryAssets,
      longTermDebt: zeroInventoryDebt,
      shortTermLoans: 0,
      payables: 0,
      shareCapital: zeroInventoryShareCapital,
      retainedEarnings: 0,
      totalLiabilities: zeroInventoryDebt,
      totalEquity: zeroInventoryShareCapital,
    }
  }, [GAME_CONFIG])
  const stage3TeamRow = useMemo(() => {
    const teamResult = stage3DbResult
    if (!teamResult) return null
    const full = teamResult.fullResults || {}
    const pnl = full.pnl ?? {}
    const costs = full.costs ?? {}
    const balanceSheet = full.balanceSheet ?? {}
    const gameState = full.gameState ?? {}
    return {
      salesRevenue: pnl.revenue ?? 0,
      cogs: pnl.cogs ?? (costs.materials + costs.labor + costs.logistics + costs.outsourcing),
      totalOperating: costs.totalOperating ?? (costs.production + costs.outsourcing + costs.logistics + costs.rnd + costs.marketing + costs.admin),
      revenue: pnl.revenue ?? 0,
      grossProfit: pnl.grossProfit ?? 0,
      netProfit: pnl.netProfit ?? 0,
      depreciation: pnl.depreciation ?? costs.depreciation ?? 0,
      interestExpense: pnl.interestExpense ?? costs.interest ?? 0,
      tax: pnl.tax ?? 0,
      ebit: pnl.ebit ?? 0,
      admin: costs.admin ?? 0,
      rnd: costs.rnd ?? 0,
      marketing: costs.marketing ?? 0,
      inventory: balanceSheet.inventory ?? 0,
      receivables: balanceSheet.receivables ?? 0,
      payables: balanceSheet.payables ?? 0,
      cash: balanceSheet.cash ?? 0,
      fixedAssets: balanceSheet.fixedAssets ?? 0,
      totalAssets: balanceSheet.totalAssets ?? 0,
      totalLiabilities: balanceSheet.totalLiabilities ?? 0,
      totalEquity: balanceSheet.totalEquity ?? 0,
      longTermDebt: balanceSheet.longTermDebt ?? 0,
      shortTermLoans: balanceSheet.shortTermLoans ?? 0,
      shareCapital: balanceSheet.shareCapital ?? 0,
      retainedEarnings: balanceSheet.retainedEarnings ?? 0,
      inventoryUnits: gameState.inventory ?? 0,
    }
  }, [stage3DbResult])
  const stage3WorkingCapitalAudit = useMemo(() => {
    if (!stage3TeamRow) return null
    const receivablePercent = GAME_CONFIG.financial.receivablePercent
    const payablePercent = GAME_CONFIG.financial.payablePercent
    const receivableBase = stage3TeamRow.salesRevenue ?? 0
    const payableBase = stage3TeamRow.cogs ?? 0
    return {
      receivablePercent,
      payablePercent,
      receivableBase,
      payableBase,
      receivableFormula: receivableBase * receivablePercent,
      payableFormula: payableBase * payablePercent,
    }
  }, [stage3TeamRow, GAME_CONFIG])
  const stage3BalanceDelta = useMemo(() => {
    if (!stage3TeamRow) return null
    const assets = stage3TeamRow.totalAssets || 0
    const liabilities = stage3TeamRow.totalLiabilities || 0
    const equity = stage3TeamRow.totalEquity || 0
    return {
      assets,
      liabilities,
      equity,
      delta: assets - (liabilities + equity),
    }
  }, [stage3TeamRow])

  const isStartingPosition = prevRoundData?.isStartingPosition ?? true
  const reviewLabel = prevRoundData
    ? (isStartingPosition
      ? 'Starting Position (Stored)'
      : prevRoundData.round === 0
        ? 'Trial Round Performance'
        : `Round ${prevRoundData.round} Performance`)
    : 'Previous Round'
  const reviewRoundNumber = prevRoundData?.round ?? -1
  const reviewScenarioSnapshot = prevRoundData && 'scenarioSnapshot' in prevRoundData ? prevRoundData.scenarioSnapshot : null
  // const reviewScenario = reviewScenarioSnapshot ?? (reviewRoundNumber >= 0 ? (SCENARIOS[reviewScenarioId] || SCENARIOS[0]) : null)
  const reviewUnitsSoldTotal = prevRoundData?.unitsSold?.total ?? 0
  const displayRevenue = prevRoundData?.revenue ?? 0
  const displayNetProfit = prevRoundData?.netProfit ?? 0
  const displayCogs = prevRoundData?.cogs ?? 0
  const displayOperatingExpenses = prevRoundData?.operatingExpenses ?? 0
  // ============================================================================
  // BALANCE SHEET DISPLAY VALUES - DO NOT MODIFY
  // ============================================================================
  // These values come from useReviewData which prefers engine-provided values
  // and only falls back to balanced calculations when engine values are missing.
  // The source of truth is in: src/hooks/useReviewData.ts
  //
  // DO NOT recalculate or override these values here.
  // If there's a mismatch, fix it in useReviewData.ts, not here.
  // ============================================================================
  const displayCash = prevRoundData?.cashBalance ?? 0
  const displayInventoryValue = prevRoundData?.inventory ?? 0
  const displayReceivables = prevRoundData?.receivables ?? 0
  const displayFixedAssets = prevRoundData?.fixedAssets ?? 0
  const displayTotalAssets = prevRoundData?.totalAssets ?? 0
  const displayDebt = prevRoundData?.longTermDebt ?? 0
  // const displayShortTermDebt = prevRoundData?.shortTermLoans ?? prevRoundData?.shortTermDebt ?? 0
  const displayPayables = prevRoundData?.payables ?? 0
  const displayTotalLiabilities = prevRoundData?.totalLiabilities ?? displayDebt
  const displayShareCapital = prevRoundData?.shareCapital ?? 0
  const displayRetainedEarnings = prevRoundData?.retainedEarnings ?? 0
  const displayTotalEquity = prevRoundData?.totalEquity ?? displayShareCapital
  const reviewAvgShare = prevRoundData
    ? (prevRoundData.marketShare.us + prevRoundData.marketShare.asia + prevRoundData.marketShare.europe) / 3
    : 0
  const reviewShareUS = prevRoundData?.marketShare.us ?? 0
  const reviewShareAsia = prevRoundData?.marketShare.asia ?? 0
  const reviewShareEurope = prevRoundData?.marketShare.europe ?? 0
  const reviewUnitsSold = prevRoundData?.unitsSold ?? { us: 0, asia: 0, europe: 0, total: 0 }
  const reviewInventoryUnits = prevRoundData?.inventoryUnits ?? 0
  const reviewInventoryByRegion = prevRoundData?.inventoryByRegion ?? { us: reviewInventoryUnits, asia: 0, europe: 0 }
  const reviewInventoryUS = Math.max(0, reviewInventoryByRegion?.us ?? reviewInventoryUnits ?? (gameState as unknown)?.inventoryUS ?? 0)
  const reviewInventoryAsia = Math.max(0, reviewInventoryByRegion?.asia ?? (gameState as unknown)?.inventoryAsia ?? 0)
  const reviewInventoryTotal = reviewInventoryUS + reviewInventoryAsia
  const latestResultsRound = useMemo(() => {
    if (!Array.isArray(fetchedResults) || fetchedResults.length === 0) return null
    const rounds = fetchedResults
      .map((entry) => entry?.roundNumber)
      .filter((value) => typeof value === 'number')
    if (rounds.length === 0) return null
    const latest = Math.max(...rounds)
    return latest >= 0 ? latest : null
  }, [fetchedResults])

  const resultsNoticeKey = useMemo(() => {
    if (!team?.id || !game?.id || latestResultsRound === null) return null
    return `results-notice-seen-${game.id}-${team.id}-${latestResultsRound}`
  }, [game?.id, team?.id, latestResultsRound])
  const [showResultsNotice, setShowResultsNotice] = useState(false)
  const resultsNoticeLabel = latestResultsRound === 0
    ? 'Trial results available - click to view'
    : latestResultsRound !== null
      ? `Round ${latestResultsRound} results available - click to view`
      : ''
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
  const activeDecision = currentDecision ?? fallbackDecision
  const forecastEffects = getScenarioEffectsForRound(
    currentRound <= 0 ? 0 : currentRound,
    game?.scenarioSequence
  )
  const forecastTeamCount = game?.totalTeams ?? game?.teams?.length ?? 4
  const forecastMarketDemand = calculateMarketDemand(
    currentRound,
    game?.scenarioSequence,
    game?.marketDemandMultiplier ?? 1,
    GAME_CONFIG,
    forecastTeamCount,
    game?.regionDemandSplit
  )
  const forecastDemandTeams = [
    {
      id: team?.id ?? 0,
      name: team?.name ?? 'Your Team',
      decisions: activeDecision,
    },
  ] as unknown
  const forecastPriceDemand = {
    us: calculateMarketDemandMultiplier(forecastDemandTeams, 'us', forecastEffects, GAME_CONFIG),
    asia: calculateMarketDemandMultiplier(forecastDemandTeams, 'asia', forecastEffects, GAME_CONFIG),
    europe: calculateMarketDemandMultiplier(forecastDemandTeams, 'europe', forecastEffects, GAME_CONFIG),
  }
  const forecastRange = (region: 'us' | 'asia' | 'europe') => {
    const central = scenarioDemandModifiers[region] ?? 0
    return {
      low: central - 3,
      high: central + 3,
      central,
    }
  }
  const formatGrowthRange = (range: { low: number; high: number }) => `${range.low}% to ${range.high}%`
  const formatGrowthTarget = (value: number) => `${value > 0 ? '+' : ''}${value}%`
  const formatUnitsDetailed = (value: number) =>
    new Intl.NumberFormat('en-US', {
      notation: 'compact',
      maximumFractionDigits: 3,
    }).format(value)
  const formatUnitsExact = (value: number) =>
    new Intl.NumberFormat('en-US', {
      maximumFractionDigits: 0,
    }).format(value)
  const parseTargetUnits = (value: string) => {
    const cleaned = value.replace(/[, ]/g, '')
    const parsed = Number(cleaned)
    if (!Number.isFinite(parsed)) return 0
    return Math.max(0, Math.round(parsed))
  }
  const getGrowthFromTarget = (baseUnits: number, targetUnits: number) => {
    const base = Math.max(1, baseUnits)
    return ((targetUnits / base) - 1) * 100
  }
  const formatCurrencyFull = (value: number) => `$${Math.round(value).toLocaleString('en-US')}`
  const formatPctValue = (value: number, digits: number = 2) => `${value >= 0 ? '+' : ''}${value.toFixed(digits)}%`
  const formatRateValue = (value: number, digits: number = 2) => `${(value * 100).toFixed(digits)}%`
  const formatMultiplier = (value: number) => `${value.toFixed(2)}x`
  const formatCentralGrowth = (central: number) => `${central >= 0 ? '+' : ''}${central}%`
  const forecastRounds = useMemo(() => {
    const lastRound = Math.max(currentRound - 1, -1)
    return Array.from(new Set([lastRound, currentRound]))
  }, [currentRound])
  // Unused for now - may be needed for future features
  // const demandSeries = useMemo(() => {
  //   return forecastRounds.map((round) => {
  //     const scenarioForRound = round >= 0 ? (game?.scenarioSequence?.[round] ?? 0) : 0
  //     const scenarioName = round < 0 ? 'Starting Position' : (SCENARIOS[scenarioForRound]?.name || 'Stable Market')
  //     const scenarioShort = round < 0 ? 'Start' : scenarioName.split(' ').slice(0, 2).join(' ')
  //     const demand = calculateMarketDemand(
  //       round,
  //       game?.scenarioSequence,
  //       game?.marketDemandMultiplier ?? 1,
  //       GAME_CONFIG,
  //       forecastTeamCount,
  //       game?.regionDemandSplit
  //     )
  //     return {
  //       round,
  //       scenarioName,
  //       scenarioShort,
  //       us: demand.us,
  //       asia: demand.asia,
  //       europe: demand.europe,
  //       total: demand.total ?? (demand.us + demand.asia + demand.europe),
  //     }
  //   })
  // }, [forecastRounds, game?.scenarioSequence, game?.marketDemandMultiplier, GAME_CONFIG, forecastTeamCount, game?.regionDemandSplit])
  const adjustedForecastDemand = {
    us: Math.round(forecastMarketDemand.us * forecastPriceDemand.us.multiplier),
    asia: Math.round(forecastMarketDemand.asia * forecastPriceDemand.asia.multiplier),
    europe: Math.round(forecastMarketDemand.europe * forecastPriceDemand.europe.multiplier),
  }
  const forecastRegionBriefs = [
    {
      key: 'us' as const,
      name: regionLabels.us,
      share: reviewShareUS,
      demand: adjustedForecastDemand.us,
      range: forecastRange('us'),
    },
    {
      key: 'asia' as const,
      name: regionLabels.asia,
      share: reviewShareAsia,
      demand: adjustedForecastDemand.asia,
      range: forecastRange('asia'),
    },
    {
      key: 'europe' as const,
      name: regionLabels.europe,
      share: reviewShareEurope,
      demand: adjustedForecastDemand.europe,
      range: forecastRange('europe'),
    },
  ]
  useEffect(() => {
    if (forecastInitializedRef.current) return
    forecastInitializedRef.current = true
    const savedForecast = currentDecision?.production?.demandForecast
    if (savedForecast && (savedForecast.us || savedForecast.asia || savedForecast.europe)) {
      setForecastTargets({
        us: Math.round(savedForecast.us ?? 0),
        asia: Math.round(savedForecast.asia ?? 0),
        europe: Math.round(savedForecast.europe ?? 0),
      })
      return
    }
    if (game?.id && team?.id) {
      const stored = localStorage.getItem(`decisions-modern-forecast-${game.id}-${team.id}-${currentRound}`)
      if (stored) {
        try {
          const parsed = JSON.parse(stored) as { us?: number; asia?: number; europe?: number }
          if (parsed && (parsed.us !== undefined || parsed.asia !== undefined || parsed.europe !== undefined)) {
            setForecastTargets({
              us: Math.round(parsed.us ?? 0),
              asia: Math.round(parsed.asia ?? 0),
              europe: Math.round(parsed.europe ?? 0),
            })
            return
          }
        } catch {
          // Ignore parse errors.
        }
      }
    }
    setForecastTargets({ us: 0, asia: 0, europe: 0 })
  }, [currentDecision, reviewShareUS, reviewShareAsia, reviewShareEurope, game?.id, team?.id, currentRound])
  const forecastShareTargets = forecastTargets
  const scheduleForecastSave = (nextTargets: { us: number; asia: number; europe: number }) => {
    if (isLocked) return
    setCurrentDecision((prev: unknown) => {
      if (!prev) return prev
      const nextProduction = {
        ...prev.production,
        demandForecast: { ...nextTargets },
      }
      // Defer save until user navigates to another step
      markPendingSave('production', nextProduction)
      return {
        ...prev,
        production: nextProduction,
      }
    })
    if (game?.id && team?.id) {
      localStorage.setItem(
        `decisions-modern-forecast-${game.id}-${team.id}-${currentRound}`,
        JSON.stringify(nextTargets)
      )
    }
  }
  const forecastProjected = {
    us: Math.max(0, Math.round((reviewUnitsSold.us || 0) * (1 + (forecastShareTargets.us / 100)))),
    asia: Math.max(0, Math.round((reviewUnitsSold.asia || 0) * (1 + (forecastShareTargets.asia / 100)))),
    europe: Math.max(0, Math.round((reviewUnitsSold.europe || 0) * (1 + (forecastShareTargets.europe / 100)))),
  }
  const forecastProjectedTotal = forecastProjected.us + forecastProjected.asia + forecastProjected.europe
  const forecastDeltaPct = reviewUnitsSoldTotal > 0
    ? (forecastProjectedTotal - reviewUnitsSoldTotal) / reviewUnitsSoldTotal
    : 0
  const forecastMaxRegion = Math.max(forecastProjected.us, forecastProjected.asia, forecastProjected.europe, 1)
  const interestRateSpread = scenario?.interestRateSpread ?? 0
  const csrModifier = scenario?.csrImportanceModifier ?? 1
  // Base 1 leaf. +1 for every 10% increase. Max 5.

  const salesByRegion = prevRoundData?.salesByRegion ?? {
    us: { units: 0, revenue: 0, price: 0, unmetDemand: 0 },
    asia: { units: 0, revenue: 0, price: 0, unmetDemand: 0 },
    europe: { units: 0, revenue: 0, price: 0, unmetDemand: 0 },
  }

  const startCash = prevRoundData?.cashBalance ?? 0
  const debtBalance = prevRoundData?.longTermDebt ?? 0
  const totalAssets = prevRoundData?.totalAssets ?? 0
  const debtRatio = totalAssets > 0 ? debtBalance / totalAssets : 0
  const maxDebtRatio = game?.maxDebtRatio ?? 0.4
  const debtRatioDisplay = Math.min(debtRatio, 1)
  const debtRiskLabel = debtRatio > maxDebtRatio ? 'High Risk' : debtRatio > maxDebtRatio * 0.6 ? 'Moderate Risk' : 'Low Risk'

  const marketingDecision = activeDecision?.marketing ?? fallbackDecision.marketing
  const marketingPrices = {
    us: (marketingDecision.us?.price || GAME_CONFIG.priceDemand.baselinePriceByRegion.us),
    asia: (marketingDecision.asia?.price || GAME_CONFIG.priceDemand.baselinePriceByRegion.asia),
    europe: (marketingDecision.europe?.price || GAME_CONFIG.priceDemand.baselinePriceByRegion.europe),
  }
  const marketingPromos = {
    us: marketingDecision.us?.promotionPct ?? 0,
    asia: marketingDecision.asia?.promotionPct ?? 0,
    europe: marketingDecision.europe?.promotionPct ?? 0,
  }
  const marketingRevenue = {
    us: forecastProjected.us * marketingPrices.us,
    asia: forecastProjected.asia * marketingPrices.asia,
    europe: forecastProjected.europe * marketingPrices.europe,
  }
  const marketingTotalRevenue = marketingRevenue.us + marketingRevenue.asia + marketingRevenue.europe
  const marketingPromoSpend =
    (marketingPromos.us / 100) * marketingRevenue.us +
    (marketingPromos.asia / 100) * marketingRevenue.asia +
    (marketingPromos.europe / 100) * marketingRevenue.europe
  const marketingGrowthAvg = (forecastShareTargets.us + forecastShareTargets.asia + forecastShareTargets.europe) / 3
  const marketingRevenueDeltaPct = displayRevenue > 0
    ? (marketingTotalRevenue - displayRevenue) / displayRevenue
    : 0

  const financeDecision = activeDecision?.finance ?? fallbackDecision.finance
  const financeBorrowing = financeDecision.borrowing ?? 0
  const financeRepayment = financeDecision.repayment ?? 0
  const financeShareIssue = financeDecision.shareIssue ?? 0
  const financeShareBuyback = financeDecision.shareBuyback ?? 0
  const financeDividend = financeDecision.dividend ?? 0
  const financePlantsUS = financeDecision.newPlantsUS ?? 0
  const financePlantsAsia = financeDecision.newPlantsAsia ?? 0
  const currentDebt = prevRoundData?.longTermDebt ?? 0
  const currentAssets = prevRoundData?.totalAssets ?? 0
  const sharesOutstanding = prevRoundData?.sharesOutstanding ?? 1
  const currentSharePrice = prevRoundData?.sharePrice ?? (GAME_CONFIG.financial?.startingSharePrice ?? 10)
  const maxDebt = currentAssets * (game?.maxDebtRatio ?? 0.4)
  const maxBorrowing = Math.max(0, maxDebt - currentDebt)
  const maxIssueShares = Math.floor(sharesOutstanding * (GAME_CONFIG.financial?.maxShareDilutionPerRound ?? 0.1))
  const maxIssueValue = maxIssueShares * currentSharePrice
  const maxBuybackShares = Math.floor(sharesOutstanding * (GAME_CONFIG.financial?.maxBuybackPerRound ?? 0.05))
  const maxBuybackValue = maxBuybackShares * currentSharePrice
  const plantCostUSBase = GAME_CONFIG.investment.plantCostUS
  const plantCostAsiaBase = GAME_CONFIG.investment.plantCostAsia
  const investmentMultiplier = forecastEffects?.investmentCostMultiplier ?? 1
  const plantCostUS = plantCostUSBase * investmentMultiplier
  const plantCostAsia = plantCostAsiaBase * investmentMultiplier
  const totalInvestmentCost = (financePlantsUS * plantCostUS) + (financePlantsAsia * plantCostAsia)
  const minCashReserve = GAME_CONFIG.financial.minCashReserve ?? 0
  const cashAvailableForReturns = Math.max(
    0,
    startCash + financeBorrowing + financeShareIssue - totalInvestmentCost - minCashReserve
  )
  // Available cash after reserving min cash and planned investments (for new capex + payouts)
  const availableInvestmentCash = startCash + financeBorrowing + financeShareIssue -
    financeRepayment - financeShareBuyback - financeDividend - minCashReserve - totalInvestmentCost
  const availableForRepayment = Math.max(0, cashAvailableForReturns - financeShareBuyback - financeDividend)
  const availableForBuyback = Math.max(0, cashAvailableForReturns - financeRepayment - financeDividend)
  const maxRepayment = Math.min(currentDebt, financeRepayment + availableForRepayment)
  const minDebtAction = -Math.min(currentDebt, availableForRepayment)
  const maxBuybackCash = financeShareBuyback + availableForBuyback
  const financeNetProfitEstimate = prevRoundData
    ? (displayNetProfit || (displayRevenue - displayCogs - displayOperatingExpenses))
    : 0
  // Net debt change: positive = borrowing, negative = repayment
  const netDebtChange = financeBorrowing - financeRepayment
  // Net share change: positive = issue, negative = buyback
  const netShareChange = financeShareIssue - financeShareBuyback
  const dividendMax = Math.max(0, cashAvailableForReturns - financeRepayment - financeShareBuyback)
  const forecastExpenseEstimate = Math.max(0, displayCogs + displayOperatingExpenses + marketingPromoSpend)
  // Projected ending cash (financing + investing only; excludes forecast net profit)
  const projectedEndingCash = startCash + netDebtChange + netShareChange -
    totalInvestmentCost - financeDividend
  const dividendBreachesReserve = projectedEndingCash < minCashReserve
  const canAddUSPlant = availableInvestmentCash >= plantCostUS
  const canAddAsiaPlant = availableInvestmentCash >= plantCostAsia
  const usPlantShortfall = Math.max(0, plantCostUS - availableInvestmentCash)
  const asiaPlantShortfall = Math.max(0, plantCostAsia - availableInvestmentCash)

  const reviewInsight = useMemo(() => {
    if (!prevRoundData) return 'Review results to see insights.'
    if (prevRoundData.debtRatio > 0.45) {
      return 'Debt ratio is elevated. Consider reducing borrowing or improving margins.'
    }
    if (prevRoundData.inventoryUnits > 0 && prevRoundData.inventoryUnits > prevRoundData.unitsSold.total * 0.25) {
      return 'Inventory is building up. Consider lowering price or promotion to clear stock.'
    }
    if (prevRoundData.netMargin < 0) {
      return 'Net margin is negative. Review operating costs and pricing.'
    }
    if (prevRoundData.utilization > 0 && prevRoundData.utilization < 0.6) {
      return 'Capacity is underutilized. Adjust production or boost demand.'
    }
    return 'Performance is stable. Focus on sustaining share while improving margins.'
  }, [prevRoundData])

  // --- Production Step Logic ---
  // Use prevRoundData for factory counts as it includes pending investments that are now available
  const prodFactories = {
    us: prevRoundData?.factoriesUS ?? (gameState as unknown)?.factoriesUS ?? 1,
    asia: prevRoundData?.factoriesAsia ?? (gameState as unknown)?.factoriesAsia ?? 0,
  }
  const costGameState = {
    ...(gameState as unknown),
    factories: {
      us: prodFactories.us,
      asia: prodFactories.asia,
    },
  }
  const costDecisions = normalizeProductionLines(activeDecision ?? fallbackDecision, costGameState as unknown, GAME_CONFIG)
  const costCapacity = calculateCapacity(costGameState as unknown, costDecisions, GAME_CONFIG)
  const unitCostEstimate = calculateUnitCost(costDecisions, costGameState as unknown, costCapacity, GAME_CONFIG)
  const costCapacityPerPlant = GAME_CONFIG.capacityPerPlant ?? 325000
  const costOvertimePct = costDecisions.production?.overtime ?? 0
  const costMaxCapacity =
    (costCapacity.usFactoryCount + costCapacity.asiaFactoryCount) *
    costCapacityPerPlant *
    (1 + costOvertimePct / 100)
  const costUtilization = costMaxCapacity > 0
    ? costCapacity.totalFactoryCapacity / costMaxCapacity
    : 0
  const costUtilizationPct = Math.max(0, Math.min(100, costUtilization * 100))
  const optimalUtilizationPct = GAME_CONFIG.costCurve.optimalUtilization * 100
  const prodPlanned = {
    us: activeDecision?.production?.usUnits || 0,
    asia: activeDecision?.production?.asiaUnits || 0,
    outUS: activeDecision?.production?.outsourceUS || 0,
    outAsia: activeDecision?.production?.outsourceAsia || 0,
  }
  const prodTotalOutput = prodPlanned.us + prodPlanned.asia + prodPlanned.outUS + prodPlanned.outAsia
  const prodForecastDemand = forecastProjectedTotal
  const prodAvailable = prodTotalOutput + reviewInventoryTotal
  const prodShortage = prodForecastDemand - prodAvailable
  const prodInHouseUnits = prodPlanned.us + prodPlanned.asia
  const prodOutsourceUnits = prodPlanned.outUS + prodPlanned.outAsia
  const outsourceSupplierId = (costDecisions.production?.outsource?.supplierId ??
    GAME_CONFIG.defaults.production.outsourceSupplier ?? 2) as 1 | 2 | 3 | 4
  const outsourceSupplierMultiplier =
    GAME_CONFIG.unitCosts.supplier[outsourceSupplierId] ?? GAME_CONFIG.unitCosts.supplier[2]
  const outsourceUnitCost =
    (GAME_CONFIG.unitCosts.directMaterialUS + GAME_CONFIG.unitCosts.directLabourUS) *
    outsourceSupplierMultiplier *
    (1 + GAME_CONFIG.outsourcing.costPremium)
  const prodInHouseCost =
    (prodPlanned.us * unitCostEstimate.finalUnitCostUS) +
    (prodPlanned.asia * unitCostEstimate.finalUnitCostAsia)
  const prodOutsourceCost = prodOutsourceUnits * outsourceUnitCost
  const prodTotalCost = prodInHouseCost + prodOutsourceCost

  const persistDecisionSection = (section: string, nextSection: unknown) => {
    if (isLocked) return Promise.resolve()
    if (!team?.id || game?.currentRound === undefined) return Promise.resolve()
    // Backend expects flattened marketing fields (priceUS, promoUS, etc.).
    // When UI uses nested marketing object, convert to flattened DB keys.
    let payload: unknown
    if (section === 'marketing') {
      payload = {
        marketing: {
          priceUS: nextSection?.us?.price,
          priceAsia: nextSection?.asia?.price,
          priceEurope: nextSection?.europe?.price,
          promoUS: nextSection?.us?.promotionPct,
          promoAsia: nextSection?.asia?.promotionPct,
          promoEurope: nextSection?.europe?.promotionPct,
        },
      }
    } else if (section === 'finance') {
      // Save finance and also mirror new plant investments to the investment section
      payload = {
        finance: {
          borrowing: nextSection?.borrowing,
          repayment: nextSection?.repayment,
          shareIssue: nextSection?.shareIssue,
          shareBuyback: nextSection?.shareBuyback,
          dividend: nextSection?.dividend,
          newPlantsUS: nextSection?.newPlantsUS,
          newPlantsAsia: nextSection?.newPlantsAsia,
        },
        investment: {
          newPlantsUS: nextSection?.newPlantsUS,
          newPlantsAsia: nextSection?.newPlantsAsia,
        },
      }
    } else {
      payload = { [section]: nextSection }
    }

    console.debug('[DecisionsModernPage] saving decision section', section, payload)
    return teamApi.saveDecision(team.id, game.currentRound, payload)
      .then((response: unknown) => {
        console.debug('[DecisionsModernPage] save response', response)
        markSaved()
        // If server returns the saved decision, update local state using the
        // same DB->engine mapping so refresh/load shows the persisted values.
        try {
          if (response && response.decision) {
            // Prefer the local `nextSection` we sent for this section to avoid
            // server responses overwriting optimistic edits (e.g., reorder)
            setCurrentDecision((prev: unknown) => {
              if (!prev) return { ...(transformDecisionFromDb(response.decision ?? null, GAME_CONFIG) || {}), [section]: nextSection }
              return {
                ...prev,
                [section]: nextSection,
              }
            })
          }
        } catch (err) {
          // Non-fatal: keep optimistic local state if mapping fails
          console.warn('Failed to map saved decision response', err)
        }
      })
      .catch((err) => {
        console.error('[DecisionsModernPage] save failed', err)
        markSaveError()
      })
  }

  // Track which section needs to be saved on step navigation
  const pendingSectionRef = useRef<{ section: string; data: unknown } | null>(null)

  // Mark section as pending save (deferred until user navigates to another step)
  const markPendingSave = (section: string, nextSection: unknown) => {
    if (isLocked) return
    pendingSectionRef.current = { section, data: nextSection }
  }

  // Flush any pending save to the server
  const flushPendingSave = () => {
    if (pendingSectionRef.current && !isLocked) {
      const { section, data } = pendingSectionRef.current
      pendingSectionRef.current = null
      markSaving()
      persistDecisionSection(section, data)
    }
  }

  const updateDecisionField = (section: string, field: string, value: unknown) => {
    if (isLocked) return
    setCurrentDecision((prev: unknown) => {
      if (!prev) return prev
      const nextSection = {
        ...prev[section],
        [field]: value,
      }
      // Defer save until user navigates to another step
      markPendingSave(section, nextSection)
      return {
        ...prev,
        [section]: nextSection,
      }
    })
  }

  const updateDecisionSection = (section: string, nextSection: unknown) => {
    if (isLocked) return
    setCurrentDecision((prev: unknown) => {
      if (!prev) return prev
      // Defer save until user navigates to another step
      markPendingSave(section, nextSection)
      return {
        ...prev,
        [section]: nextSection,
      }
    })
  }

  // Flush pending save when user navigates to a different step
  const prevStepRef = useRef(activeStepIndex)
  useEffect(() => {
    if (prevStepRef.current !== activeStepIndex) {
      flushPendingSave()
      prevStepRef.current = activeStepIndex
    }
  }, [activeStepIndex])

  const updateProductionSupplier = (region: 'us' | 'asia', supplierId: number) => {
    const currentProduction = activeDecision?.production ?? fallbackDecision.production
    const baseLines = fallbackDecision.production.productionLines ?? {}
    const existingLines = currentProduction.productionLines ?? {}
    const nextLines = {
      ...baseLines,
      ...existingLines,
    }

    if (region === 'us') {
      nextLines.us1 = { ...nextLines.us1, supplierId }
      nextLines.us2 = { ...nextLines.us2, supplierId }
    } else {
      nextLines.asia1 = { ...nextLines.asia1, supplierId }
      nextLines.asia2 = { ...nextLines.asia2, supplierId }
    }

    const nextProduction = {
      ...currentProduction,
      [region === 'us' ? 'supplierUS' : 'supplierAsia']: supplierId,
      productionLines: nextLines,
    }

    // Defer save until step navigation, same as other production edits
    updateDecisionSection('production', nextProduction)
  }

  const updateProductionShift = (nextOvertimeRaw: number) => {
    const currentProduction = activeDecision?.production ?? fallbackDecision.production
    const currentOvertime = Math.max(0, currentProduction.overtime ?? 0)
    const nextOvertime = Math.max(0, nextOvertimeRaw)
    const capacityPerPlant = GAME_CONFIG.capacityPerPlant ?? 325000

    const scaleAndClampUnits = (currentUnitsRaw: number, factories: number) => {
      if (factories <= 0) return 0
      const currentUnits = Math.max(0, currentUnitsRaw || 0)
      const oldMax = factories * capacityPerPlant * (1 + currentOvertime / 100)
      const newMax = factories * capacityPerPlant * (1 + nextOvertime / 100)
      if (newMax <= 0) return 0

      // Preserve utilization ratio across shift changes, then hard clamp to new capacity.
      const scaledUnits = oldMax > 0 ? (currentUnits / oldMax) * newMax : currentUnits
      return Math.round(Math.min(newMax, Math.max(0, scaledUnits)))
    }

    const nextProduction = {
      ...currentProduction,
      overtime: nextOvertime,
      usUnits: scaleAndClampUnits(currentProduction.usUnits ?? 0, prodFactories.us),
      asiaUnits: scaleAndClampUnits(currentProduction.asiaUnits ?? 0, prodFactories.asia),
    }

    updateDecisionSection('production', nextProduction)
  }

  const renderProductionCard = (region: 'us' | 'asia', title: string, demand: number) => {
    const hasFactory = (region === 'us' ? prodFactories.us : prodFactories.asia) > 0
    const unitsKey = region === 'us' ? 'usUnits' : 'asiaUnits'
    const outKey = region === 'us' ? 'outsourceUS' : 'outsourceAsia'
    const supplierKey = region === 'us' ? 'supplierUS' : 'supplierAsia'
    const plannedUnits = activeDecision?.production?.[unitsKey] || 0
    const plannedOutsource = activeDecision?.production?.[outKey] || 0
    const totalRegionOutput = plannedUnits + plannedOutsource

    const capacityPerPlant = GAME_CONFIG.capacityPerPlant || 325000
    const plants = region === 'us' ? prodFactories.us : prodFactories.asia
    const overtimePct = costDecisions.production?.overtime ?? 0
    const baseCapacity = plants * capacityPerPlant
    const maxCapacity = baseCapacity * (1 + overtimePct / 100)
    const utilization = maxCapacity > 0 ? (plannedUnits / maxCapacity) * 100 : 0
    const statusLabel = utilization > 100
      ? 'Overcapacity'
      : utilization > 90
        ? 'Overtime'
        : utilization < 60
          ? 'Underutilized'
          : 'Optimal'
    const statusColor = utilization > 100
      ? '#ef4444'
      : utilization > 90
        ? '#f59e0b'
        : utilization < 60
          ? '#64748b'
          : '#10b981'

    const matBase = region === 'us' ? GAME_CONFIG.unitCosts.directMaterialUS : GAME_CONFIG.unitCosts.directMaterialAsia
    const labBase = region === 'us' ? GAME_CONFIG.unitCosts.directLabourUS : GAME_CONFIG.unitCosts.directLabourAsia
    const supplierId = activeDecision?.production?.[supplierKey] || 1
    const supplierMult = GAME_CONFIG.unitCosts.supplier[supplierId as 1 | 2 | 3 | 4] || 1.0
    const unitCost = region === 'us'
      ? unitCostEstimate.finalUnitCostUS
      : unitCostEstimate.finalUnitCostAsia
    const outsourceMax = region === 'us'
      ? GAME_CONFIG.outsourcing.maxCapacityUS
      : GAME_CONFIG.outsourcing.maxCapacityAsia
    const supplierOptions = Object.keys(GAME_CONFIG.unitCosts.supplier)
      .map((key) => Number(key))
      .sort((a, b) => a - b)
      .map((id) => {
        const multiplier = GAME_CONFIG.unitCosts.supplier[id as 1 | 2 | 3 | 4] || 1
        const costPct = Math.round((multiplier - 1) * 100)
        const tierName = id === 1 ? 'Economy' : id === 2 ? 'Standard' : id === 3 ? 'Responsible' : 'Premium ESG'
        const csrScore = GAME_CONFIG.supplierCSR?.[id as 1 | 2 | 3 | 4] ?? 0
        let csrLabel = csrScore <= 1 ? 'Poor' : csrScore === 2 ? 'Basic' : csrScore === 3 ? 'Good' : 'Excellent'
        // enforce tier mapping: Tier 3 -> Good, Tier 4 -> Excellent
        if (id === 3) csrLabel = 'Good'
        if (id === 4) csrLabel = 'Excellent'
        return { id, label: `${tierName} - Cost +${costPct}% - CSR: ${csrLabel}`, multiplier, csrLabel, csrScore }
      })

    return (
      <div className="dm-prod-card" key={region}>
        <div className="dm-prod-header">
          <div className="dm-prod-title">
            <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
              🌏 {Array(plants).fill('🏭').join(' ')}
              {hasFactory && (
                <>
                  <span className="smoke">☁️</span>
                  <span className="smoke">☁️</span>
                  <span className="smoke">☁️</span>
                </>
              )}
            </span>
            <span style={{ marginLeft: '8px' }}>{title}{plants > 0 ? ` (x${plants})` : ''}</span>
          </div>
          <div className="dm-prod-meta">Demand: <strong>{formatUnits(demand)}</strong></div>
        </div>
        <div className="dm-prod-body">
          <div className="dm-prod-inputs">
            {hasFactory ? (
              <>
                <div className="dm-prod-section-header"><span className="dm-prod-step-num">1</span> Configuration</div>
                <div className="dm-prod-config">
                  <div className="dm-prod-field">
                    <label>
                      Shift Strategy
                      <InfoTooltip text={tooltipCopy.shiftStrategy} label="Shift strategy info" />
                    </label>
                    <div className="dm-prod-select-wrapper">
                      <select
                        className="dm-prod-select dm-shift-select"
                        value={activeDecision?.production?.overtime || 0}
                        onChange={(e) => {
                          const value = parseInt(e.target.value)
                          updateProductionShift(value)
                        }}
                      >
                        <option value={0}>🏭 Standard (8hr)</option>
                        <option value={10}>📅 Weekend (+10%)</option>
                        <option value={20}>🔁 Double (+20%)</option>
                        <option value={30}>🚀 Maximize (+30%)</option>
                        <option value={40}>⚡ Surge (+40%)</option>
                        <option value={50}>🔥 Critical (+50%)</option>
                      </select>
                    </div>
                  </div>
                  <div className="dm-prod-field">
                    <label>
                      Supplier
                      <InfoTooltip text={tooltipCopy.supplier} label="Supplier selection info" />
                    </label>
                    <div className="dm-supplier-row dm-prod-select-wrapper">
                      {
                        (() => {
                          const sel = supplierOptions.find(s => s.id === supplierId)
                          const cls = sel ? `csr-${(sel.csrLabel || '').toLowerCase()}` : ''
                          return (
                            <select
                              className={`dm-prod-select ${cls}`}
                              value={supplierId}
                              onChange={(e) => updateProductionSupplier(region, parseInt(e.target.value))}
                            >
                              {supplierOptions.map((option) => {
                                const emoji = option.id === 4 ? '🌟' : option.id === 3 ? '✅' : option.csrLabel === 'Poor' ? '🔴' : option.csrLabel === 'Basic' ? '🟠' : '🔵'
                                const displayLabel = `${emoji} ${option.label}`
                                return <option key={option.id} value={option.id}>{displayLabel}</option>
                              })}
                            </select>
                          )
                        })()
                      }

                      <span className={`dm-supplier-csr ${(supplierOptions.find(s => s.id === supplierId)?.csrLabel || '').toLowerCase()}`}>{(supplierOptions.find(s => s.id === supplierId)?.csrLabel) || ''}</span>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="dm-prod-no-factory" style={{ opacity: 0.5 }}>
                <span className="dm-prod-section-header"><span className="dm-prod-step-num">1</span> Configuration</span>
                <p style={{ fontSize: '0.8rem' }}>No factories active in this region.</p>
              </div>
            )}

            <div className="dm-prod-section-header"><span className="dm-prod-step-num">{hasFactory ? '2' : '1'}</span> Volume Allocation</div>


            <div className="dm-prod-sliders">
              {hasFactory ? (
                <div className="dm-prod-slider-group">
                  <div className="dm-prod-slider-header">
                    <span className="dm-prod-source-badge factory">
                      In-House
                      <InfoTooltip text={tooltipCopy.inHouse} label="In-house production info" />
                    </span>
                    <span className="dm-prod-slider-val">{formatUnits(plannedUnits)}</span>
                  </div>
                  <RangeWithButtons
                    min={0}
                    max={maxCapacity}
                    step={1000}
                    value={plannedUnits}
                    disabled={isLocked}
                    ariaLabel="In-house volume"
                    onChange={(nextValue) => updateDecisionField('production', unitsKey, nextValue)}
                  />
                  <div className="dm-prod-slider-limit"><span>0</span><span>Max: {formatUnits(maxCapacity)}</span></div>
                  <div style={{ marginTop: '0.4rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-main)' }}>
                    Unit Cost: {hasFactory ? formatCurrencyFull(unitCost) : 'N/A'}
                  </div>
                </div>
              ) : (
                <div className="dm-prod-no-factory">
                  <div style={{ fontSize: '0.75rem', fontWeight: 600 }}>No Active Factories</div>
                  <button className="dm-prod-invest-btn" onClick={() => setActiveStepIndex(6)}>⚡ Invest Now</button>
                </div>
              )}

              <div className="dm-prod-slider-group">
                <div className="dm-prod-slider-header">
                  <span className="dm-prod-source-badge outsource">
                    External
                    <InfoTooltip text={tooltipCopy.outsource} label="External production info" />
                  </span>
                  <span className="dm-prod-slider-val" style={{ color: '#f59e0b' }}>{formatUnits(plannedOutsource)}</span>
                </div>
                <RangeWithButtons
                  min={0}
                  max={outsourceMax}
                  step={1000}
                  value={plannedOutsource}
                  disabled={isLocked}
                  className="outsource-slider"
                  ariaLabel="External volume"
                  onChange={(nextValue) => updateDecisionField('production', outKey, nextValue)}
                />
                <div className="dm-prod-slider-limit"><span>0</span><span>Max: {formatUnits(outsourceMax)}</span></div>
                <div style={{ marginTop: '0.4rem', fontSize: '0.75rem', fontWeight: 700, color: '#f59e0b' }}>
                  Unit Cost: {formatCurrencyFull(outsourceUnitCost)}
                </div>
              </div>
            </div>
          </div>

          <div className="dm-prod-meter-col">
            <div className="dm-prod-meter-label">
              Factory Efficiency
              <InfoTooltip text={tooltipCopy.factoryEfficiency} label="Factory efficiency info" />
            </div>
            <div className="dm-prod-v-track">
              <div className="dm-prod-v-zone-overtime"></div>
              <div className="dm-prod-v-zone-efficient"></div>
              <div
                className="dm-prod-v-fill"
                style={{ height: `${Math.min(100, utilization)}%`, background: statusColor }}
              ></div>
            </div>
            <div className="dm-prod-meter-stats">
              <div className="dm-prod-meter-main" style={{ color: statusColor }}>
                {hasFactory ? `${utilization.toFixed(0)}%` : 'N/A'}
              </div>
              <div className="dm-prod-meter-sub">
                {hasFactory ? `${statusLabel} · Optimal ${optimalUtilizationPct.toFixed(0)}%` : 'N/A'}
              </div>
            </div>
            <div className="dm-prod-breakdown">
              <div className="dm-prod-breakdown-title">In-house Cost Logic:</div>
              <div className="dm-prod-breakdown-row">
                <span>Mat:</span>
                <span>{hasFactory ? `${formatCurrencyFull(matBase)} x ${supplierMult}` : 'N/A'}</span>
              </div>
              <div className="dm-prod-breakdown-row">
                <span>Lab:</span>
                <span>{hasFactory ? `${formatCurrencyFull(labBase)} x 1.0` : 'N/A'}</span>
              </div>
              <div className="dm-prod-total-summary" style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px dashed var(--border-light)' }}>
                <div className="dm-prod-total-label">Region Total</div>
                <div className="dm-prod-total-value">{formatUnits(totalRegionOutput)}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // --- Logistics Step Logic ---
  const logAvailability = prodTotalOutput + reviewInventoryTotal
  const logUSPriority = (activeDecision?.logistics?.usPriority || ['us', 'europe', 'asia']) as Array<'us' | 'asia' | 'europe'>
  const logAsiaPriority = (activeDecision?.logistics?.asiaPriority || ['asia', 'europe', 'us']) as Array<'us' | 'asia' | 'europe'>

  // Base tariffs from game config (e.g., $12/unit)
  const baseLogisticsTariffs = gameConfig.logisticsTariff

  // Scenario tariff modifiers (e.g., 0.05 = +5%, so final = base * 1.05)
  const scenarioTariffModifiers = scenario?.logisticsTariff || {}

  // Apply scenario modifiers to base tariffs: base * (1 + modifier)
  // If no scenario modifier, use 0 (no change)
  const logisticsTariffs = {
    usToUs: baseLogisticsTariffs.usToUs * (1 + (scenarioTariffModifiers.usToUs || 0)),
    usToAsia: baseLogisticsTariffs.usToAsia * (1 + (scenarioTariffModifiers.usToAsia || 0)),
    usToEurope: baseLogisticsTariffs.usToEurope * (1 + (scenarioTariffModifiers.usToEurope || 0)),
    asiaToUs: baseLogisticsTariffs.asiaToUs * (1 + (scenarioTariffModifiers.asiaToUs || 0)),
    asiaToAsia: baseLogisticsTariffs.asiaToAsia * (1 + (scenarioTariffModifiers.asiaToAsia || 0)),
    asiaToEurope: baseLogisticsTariffs.asiaToEurope * (1 + (scenarioTariffModifiers.asiaToEurope || 0)),
  }
  const logisticsAllocation = calculateLogisticsAllocation({
    usSupply: prodPlanned.us + prodPlanned.outUS + reviewInventoryUS,
    asiaSupply: prodPlanned.asia + prodPlanned.outAsia + reviewInventoryAsia,
    demands: forecastProjected,
    usPriority: logUSPriority,
    asiaPriority: logAsiaPriority,
  })
  const logisticsServed = {
    us: logisticsAllocation.us.local + logisticsAllocation.us.fromAsia,
    asia: logisticsAllocation.asia.local + logisticsAllocation.asia.fromUS,
    europe: logisticsAllocation.europe.fromUS + logisticsAllocation.europe.fromAsia,
  }
  const logisticsShippedIn = {
    us: logisticsAllocation.us.fromAsia,
    asia: logisticsAllocation.asia.fromUS,
    europe: logisticsAllocation.europe.fromUS + logisticsAllocation.europe.fromAsia,
  }
  const logisticsFulfillment = {
    us: forecastProjected.us > 0 ? Math.min(1, logisticsServed.us / forecastProjected.us) : 1,
    asia: forecastProjected.asia > 0 ? Math.min(1, logisticsServed.asia / forecastProjected.asia) : 1,
    europe: forecastProjected.europe > 0 ? Math.min(1, logisticsServed.europe / forecastProjected.europe) : 1,
  }
  const logisticsUnmet = {
    us: Math.max(0, forecastProjected.us - logisticsServed.us),
    asia: Math.max(0, forecastProjected.asia - logisticsServed.asia),
    europe: Math.max(0, forecastProjected.europe - logisticsServed.europe),
  }
  // Calculate base logistics cost using tariffs with scenario modifiers
  const logisticsCostBase =
    (logisticsAllocation.asia.fromUS * logisticsTariffs.usToAsia) +
    (logisticsAllocation.europe.fromUS * logisticsTariffs.usToEurope) +
    (logisticsAllocation.us.fromAsia * logisticsTariffs.asiaToUs) +
    (logisticsAllocation.europe.fromAsia * logisticsTariffs.asiaToEurope)

  // Note: logisticsCostInflated and logisticsCostTotal are calculated later after currentCostInflation is available

  const getLogisticsCost = (usPriority: ('us' | 'asia' | 'europe')[], asiaPriority: ('us' | 'asia' | 'europe')[]) => {
    const allocation = calculateLogisticsAllocation({
      usSupply: prodPlanned.us + prodPlanned.outUS + reviewInventoryUS,
      asiaSupply: prodPlanned.asia + prodPlanned.outAsia + reviewInventoryAsia,
      demands: forecastProjected,
      usPriority,
      asiaPriority,
    })
    return (
      allocation.asia.fromUS * logisticsTariffs.usToAsia +
      allocation.europe.fromUS * logisticsTariffs.usToEurope +
      allocation.us.fromAsia * logisticsTariffs.asiaToUs +
      allocation.europe.fromAsia * logisticsTariffs.asiaToEurope
    )
  }

  const [priorityDelta, setPriorityDelta] = useState<{ us: number | null; asia: number | null }>({
    us: null,
    asia: null,
  })
  const priorityDeltaTimeout = useRef<{ us?: number; asia?: number }>({})

  const handleReorder = (region: 'us' | 'asia', index: number, direction: 'up' | 'down') => {
    if (isLocked) return
    const key = region === 'us' ? 'usPriority' : 'asiaPriority'
    const currentList = region === 'us'
      ? [...logUSPriority]
      : [...logAsiaPriority]
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= currentList.length) return
    const nextList = [...currentList]
    const tmp = nextList[index]
    nextList[index] = nextList[targetIndex]
    nextList[targetIndex] = tmp
    // Update using functional state update to avoid stale closures and race conditions
    setCurrentDecision((prev: unknown) => {
      if (!prev) return prev
      const nextLogistics = { ...(prev.logistics || {}), [key]: nextList }
      // schedule save for logistics section
      console.debug('[DecisionsModernPage] scheduling logistics save', { region, key, next: nextList })
      markPendingSave('logistics', nextLogistics)
      return { ...prev, logistics: nextLogistics }
    })
    const nextCost = region === 'us'
      ? getLogisticsCost(nextList as ('us' | 'asia' | 'europe')[], logAsiaPriority)
      : getLogisticsCost(logUSPriority, nextList as ('us' | 'asia' | 'europe')[])
    const delta = nextCost - logisticsCostTotal
    if (Math.abs(delta) > 0.5) {
      setPriorityDelta((prev) => ({ ...prev, [region]: delta }))
      const existingTimeout = priorityDeltaTimeout.current[region]
      if (existingTimeout) {
        clearTimeout(existingTimeout)
      }
      priorityDeltaTimeout.current[region] = window.setTimeout(() => {
        setPriorityDelta((prev) => ({ ...prev, [region]: null }))
      }, 1200)
    }
  }

  const renderLogisticsStep = () => {
    const hasUSFactory = costCapacity.usFactoryCount > 0
    const hasAsiaFactory = costCapacity.asiaFactoryCount > 0

    return (
      <div className="dm-logistics">
        <div className="dm-logistics-keys">
          <div className="dm-l-key-card">
            <div className="dm-l-key-label">Total Production</div>
            <div className="dm-l-key-val">{formatUnits(prodTotalOutput)}</div>
            <div className="dm-l-key-sub">Units arriving this round</div>
          </div>
          <div className="dm-l-key-card">
            <div className="dm-l-key-label">Inventory On Hand</div>
            <div className="dm-l-key-val">{formatUnits(reviewInventoryUnits)}</div>
            <div className="dm-l-key-sub">Unsold from prev round</div>
          </div>
          <div className="dm-l-key-card success">
            <div className="dm-l-key-label">Total Availability</div>
            <div className="dm-l-key-val" style={{ color: '#10b981' }}>{formatUnits(logAvailability)}</div>
            <div className="dm-l-key-sub">Available to sell</div>
          </div>
        </div>

        <div className="dm-priority-grid">
          {hasUSFactory ? (
            <div className="dm-priority-card">
              <div className="dm-priority-header">
                <div className="dm-priority-source">
                  {regionLabels.us} Source Priority
                  <InfoTooltip
                    text={`Define the order in which regions are fulfilled when production is limited. Units are shipped to higher-priority regions first, with remaining supply allocated to lower-priority regions. Current priority: ${formatPriorityLabel(logUSPriority)}. Demand is fulfilled in this order.`}
                    label={`${regionLabels.us} source priority info`}
                  />
                </div>
                <div className="dm-prod-meta">{formatUnits(prodPlanned.us + prodPlanned.outUS + reviewInventoryUnits)} Avail.</div>
                {priorityDelta.us !== null && (
                  <span className={`dm-priority-delta ${priorityDelta.us >= 0 ? 'negative' : 'positive'}`}>
                    {priorityDelta.us >= 0 ? '+' : '-'}{formatCurrency(Math.abs(priorityDelta.us))}
                  </span>
                )}
              </div>
              <div className="dm-priority-list">
                {logUSPriority.map((market: string, idx: number) => (
                  <div className={`dm-priority-item market-${market}`} key={market}>
                    <div className={`dm-priority-label ${market}`}>
                      <div className="dm-rank-num">{idx + 1}</div>
                      <span>{market === 'us' ? 'Americas' : regionLabels[market as keyof typeof regionLabels]}</span>
                      {market !== 'us' && <span className="dm-tariff-tag">${Math.ceil(logisticsTariffs?.[`usTo${market.charAt(0).toUpperCase()}${market.slice(1)}` as keyof typeof logisticsTariffs] || 0)} Tariff</span>}
                    </div>
                    <div className="dm-priority-actions">
                      <button className="dm-priority-btn" onClick={() => handleReorder('us', idx, 'up')} disabled={isLocked || idx === 0}>▲</button>
                      <button className="dm-priority-btn" onClick={() => handleReorder('us', idx, 'down')} disabled={isLocked || idx === logUSPriority.length - 1}>▼</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="dm-priority-card" style={{ opacity: 0.5 }}>
              <div className="dm-priority-header">
                <div className="dm-priority-source">
                  {regionLabels.us} Source Priority
                  <InfoTooltip
                    text={`Define the order in which regions are fulfilled when production is limited. Units are shipped to higher-priority regions first, with remaining supply allocated to lower-priority regions. Current priority: ${formatPriorityLabel(logUSPriority)}. Demand is fulfilled in this order.`}
                    label={`${regionLabels.us} source priority info`}
                  />
                </div>
              </div>
              <div className="dm-prod-no-factory">
                <div style={{ fontSize: '0.75rem', fontWeight: 600 }}>No {regionLabels.us} Factories</div>
                <p style={{ fontSize: '0.7rem', margin: '0.5rem 0 0', color: '#64748b' }}>Build a factory to enable logistics from this region.</p>
              </div>
            </div>
          )}

          {hasAsiaFactory ? (
            <div className="dm-priority-card">
              <div className="dm-priority-header">
                <div className="dm-priority-source">
                  {regionLabels.asia} Source Priority
                  <InfoTooltip
                    text={`Define the order in which regions are fulfilled when production is limited. Units are shipped to higher-priority regions first, with remaining supply allocated to lower-priority regions. Current priority: ${formatPriorityLabel(logAsiaPriority)}. Demand is fulfilled in this order.`}
                    label={`${regionLabels.asia} source priority info`}
                  />
                </div>
                <div className="dm-prod-meta">{formatUnits(prodPlanned.asia + prodPlanned.outAsia)} Avail.</div>
                {priorityDelta.asia !== null && (
                  <span className={`dm-priority-delta ${priorityDelta.asia >= 0 ? 'negative' : 'positive'}`}>
                    {priorityDelta.asia >= 0 ? '+' : '-'}{formatCurrency(Math.abs(priorityDelta.asia))}
                  </span>
                )}
              </div>
              <div className="dm-priority-list">
                {logAsiaPriority.map((market: string, idx: number) => (
                  <div className={`dm-priority-item market-${market}`} key={market}>
                    <div className={`dm-priority-label ${market}`}>
                      <div className="dm-rank-num">{idx + 1}</div>
                      <span>{market === 'us' ? 'Americas' : regionLabels[market as keyof typeof regionLabels]}</span>
                      {market !== 'asia' && <span className="dm-tariff-tag">${Math.ceil(logisticsTariffs?.[`asiaTo${market === 'us' ? 'Us' : market.charAt(0).toUpperCase() + market.slice(1)}` as keyof typeof logisticsTariffs] || 0)} Tariff</span>}
                    </div>
                    <div className="dm-priority-actions">
                      <button className="dm-priority-btn" onClick={() => handleReorder('asia', idx, 'up')} disabled={isLocked || idx === 0}>▲</button>
                      <button className="dm-priority-btn" onClick={() => handleReorder('asia', idx, 'down')} disabled={isLocked || idx === logAsiaPriority.length - 1}>▼</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="dm-priority-card" style={{ opacity: 0.5 }}>
              <div className="dm-priority-header">
                <div className="dm-priority-source">
                  {regionLabels.asia} Source Priority
                  <InfoTooltip
                    text={`Define the order in which regions are fulfilled when production is limited. Units are shipped to higher-priority regions first, with remaining supply allocated to lower-priority regions. Current priority: ${formatPriorityLabel(logAsiaPriority)}. Demand is fulfilled in this order.`}
                    label={`${regionLabels.asia} source priority info`}
                  />
                </div>
              </div>
              <div className="dm-prod-no-factory">
                <div style={{ fontSize: '0.75rem', fontWeight: 600 }}>No {regionLabels.asia} Factories</div>
                <p style={{ fontSize: '0.7rem', margin: '0.5rem 0 0', color: '#64748b' }}>Build a factory to enable logistics from this region.</p>
              </div>
            </div>
          )}
        </div>

        <div className="dm-supply-chain">
          <div className="dm-sc-title">
            Market Fulfillment Analysis
            <span className="dm-sc-avail">Global Availability: <strong>{formatUnits(logAvailability)} units</strong></span>
          </div>
          <div className="dm-sc-table">
            <div className="dm-sc-header">
              <div>Target Market</div>
              <div>Forecast Demand</div>
              <div>Local Prod.</div>
              <div>Shipped In</div>
              <div style={{ textAlign: 'right' }}>Fulfillment</div>
            </div>
            <div className="dm-sc-row">
              <div className="dm-sc-market">{regionLabels.us}</div>
              <div className="dm-sc-val-demand">{formatUnits(forecastProjected.us)}</div>
              <div className="dm-sc-val-local">{formatUnits(logisticsAllocation.us.local)}</div>
              <div className="dm-sc-val-import">{formatUnits(logisticsAllocation.us.fromAsia)}</div>
              <div style={{ textAlign: 'right' }}>
                <span className={`dm-fulfillment-badge ${logisticsFulfillment.us >= 0.9 ? 'success' : logisticsFulfillment.us >= 0.6 ? 'warning' : 'danger'}`}>
                  {(logisticsFulfillment.us * 100).toFixed(0)}%
                </span>
              </div>
            </div>
            <div className="dm-sc-row">
              <div className="dm-sc-market">{regionLabels.asia}</div>
              <div className="dm-sc-val-demand">{formatUnits(forecastProjected.asia)}</div>
              <div className="dm-sc-val-local">{formatUnits(logisticsAllocation.asia.local)}</div>
              <div className="dm-sc-val-import">{formatUnits(logisticsAllocation.asia.fromUS)}</div>
              <div style={{ textAlign: 'right' }}>
                <span className={`dm-fulfillment-badge ${logisticsFulfillment.asia >= 0.9 ? 'success' : logisticsFulfillment.asia >= 0.6 ? 'warning' : 'danger'}`}>
                  {(logisticsFulfillment.asia * 100).toFixed(0)}%
                </span>
              </div>
            </div>
            <div className="dm-sc-row">
              <div className="dm-sc-market">{regionLabels.europe}</div>
              <div className="dm-sc-val-demand">{formatUnits(forecastProjected.europe)}</div>
              <div className="dm-sc-val-local">-</div>
              <div className="dm-sc-val-import">{formatUnits(logisticsShippedIn.europe)}</div>
              <div style={{ textAlign: 'right' }}>
                <span className={`dm-fulfillment-badge ${logisticsFulfillment.europe >= 0.9 ? 'success' : logisticsFulfillment.europe >= 0.6 ? 'warning' : 'danger'}`}>
                  {(logisticsFulfillment.europe * 100).toFixed(0)}%
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // --- R&D Step Logic ---
  const rndStaff = activeDecision?.rnd?.researchStaff ?? defaults.hr.us.employees
  const rndTraining = (activeDecision?.rnd?.trainingLevel ?? defaults.rnd.trainingLevel ?? 'basic') as 'basic' | 'standard' | 'advanced'
  const featureCatalog = (GAME_CONFIG.featureCatalog && GAME_CONFIG.featureCatalog.length > 0)
    ? GAME_CONFIG.featureCatalog
    : Array.from({ length: 20 }, (_, index) => ({
      id: index + 1,
      name: `Feature ${index + 1}`,
      emoji: '',
    }))
  const featureLimit = featureCatalog.length
  const rndRoadmap = featureCatalog.slice(0, 20).map((feature, index) => ({
    id: feature.id ?? index + 1,
    name: feature.name ?? `Feature ${index + 1}`,
    emoji: feature.emoji ?? '',
  }))

  const { mandaysPerWorker, trainingEfficiencyBoost } = GAME_CONFIG.hr
  const trainingMultiplier = rndTraining === 'advanced'
    ? 1 + trainingEfficiencyBoost * 2
    : rndTraining === 'standard'
      ? 1 + trainingEfficiencyBoost
      : 1.0
  const totalResearchHours = Math.round(rndStaff * mandaysPerWorker * trainingMultiplier)
  const hoursToFeatures = totalResearchHours

  const trainingCostPerStaff =
    (GAME_CONFIG.hr.trainingCostPerStaff?.[rndTraining] ?? 0) *
    (GAME_CONFIG.hr.trainingCostMultiplierByRegion?.us ?? 1)
  const totalTrainingCost = rndStaff * trainingCostPerStaff
  const staffSalary = defaults.hr.us.wage * 12
  const totalStaffCost = rndStaff * staffSalary
  const rndTotalSpend = totalStaffCost + totalTrainingCost
  const rndEfficiencyDelta = Math.round((trainingMultiplier - 1) * 100)

  const baseRndProgress = (gameState as unknown)?.rndProgress ?? {
    unlockedTechLevel: ((gameState as unknown)?.unlockedTechLevel ??
      (isStartingPosition ? defaults.initialTechLevel : prevRoundData?.techLevel ?? defaults.initialTechLevel)) as 1 | 2 | 3 | 4,
    unlockedFeatureCount: isStartingPosition
      ? (defaults.initialFeatures ?? 0)
      : ((gameState as unknown)?.unlockedFeatures ?? prevRoundData?.features ?? defaults.initialFeatures ?? 0),
    cumulativeResearchHours: isStartingPosition
      ? (defaults.initialResearchHours ?? 0)
      : ((gameState as unknown)?.cumulativeResearchHours ?? prevRoundData?.cumulativeResearchHours ?? defaults.initialResearchHours ?? 0),
  }
  const currentFeatures = baseRndProgress.unlockedFeatureCount ?? 0
  const cumulativeHours = baseRndProgress.cumulativeResearchHours ?? 0
  const projectedProgress = hoursToFeatures > 0
    ? updateRnDProgress(baseRndProgress, hoursToFeatures, GAME_CONFIG)
    : baseRndProgress
  const projectedFeatures = projectedProgress.unlockedFeatureCount ?? currentFeatures
  const projectedCumulativeHours = projectedProgress.cumulativeResearchHours ?? (cumulativeHours + hoursToFeatures)
  const featuresUnlockingThisRound = Math.max(0, projectedFeatures - currentFeatures)
  const nextFeatureNum = currentFeatures + 1
  const nextFeatureHours = GAME_CONFIG.featureResearchHours[nextFeatureNum] || 1320000
  const hoursRemaining = currentFeatures >= featureLimit ? 0 : Math.max(0, nextFeatureHours - cumulativeHours)
  const nextUpFeatureNum = currentFeatures >= featureLimit
    ? featureLimit
    : Math.min(projectedFeatures + 1, featureLimit)
  const nextUpThreshold = GAME_CONFIG.featureResearchHours[nextUpFeatureNum] || 1320000
  const nextUpProgress = currentFeatures >= featureLimit
    ? 100
    : Math.min(100, (projectedCumulativeHours / nextUpThreshold) * 100)
  const nextUpRemaining = currentFeatures >= featureLimit
    ? 0
    : Math.max(0, nextUpThreshold - projectedCumulativeHours)
  const nextUpRounds = hoursToFeatures > 0 ? Math.ceil(nextUpRemaining / hoursToFeatures) : Infinity
  const nextFeatureEntry = rndRoadmap[nextUpFeatureNum - 1]
  const nextFeatureName = currentFeatures >= featureLimit
    ? 'All Features Unlocked'
    : (nextFeatureEntry?.name || 'Future Tech')
  const nextFeatureEmoji = nextFeatureEntry?.emoji || ''

  const scenarioSequence = game?.scenarioSequence ?? []
  const scenarioForRound = (round: number) => {
    if (round < 0) return null
    const scenarioIdForRound = scenarioSequence[round] ?? 0
    return SCENARIOS[scenarioIdForRound] ?? SCENARIOS[0]
  }
  const demandSplit = game?.regionDemandSplit ?? GAME_CONFIG.marketDemandConfig?.defaultRegionSplit ?? {
    us: 0.34,
    asia: 0.33,
    europe: 0.33,
  }
  const capacityPerPlant = GAME_CONFIG.capacityPerPlant ?? 0
  // const baseDemandTotal = capacityPerPlant * forecastTeamCount
  const startingDemand = calculateMarketDemand(
    -1,
    game?.scenarioSequence,
    game?.marketDemandMultiplier ?? 1,
    GAME_CONFIG,
    forecastTeamCount,
    game?.regionDemandSplit
  )
  const previousRoundDemand = calculateMarketDemand(
    Math.max(currentRound - 1, -1),
    game?.scenarioSequence,
    game?.marketDemandMultiplier ?? 1,
    GAME_CONFIG,
    forecastTeamCount,
    game?.regionDemandSplit
  )
  const currentRoundDemand = calculateMarketDemand(
    currentRound,
    game?.scenarioSequence,
    game?.marketDemandMultiplier ?? 1,
    GAME_CONFIG,
    forecastTeamCount,
    game?.regionDemandSplit
  )
  const reviewEffects = reviewRoundNumber < 0
    ? { costInflation: 1, interestRateSpread: 0, taxRateDeltaByRegion: { us: 0, asia: 0, europe: 0 } }
    : (
      reviewScenarioSnapshot
        ? {
          priceElasticityModifier: reviewScenarioSnapshot.priceElasticityModifier ?? 1,
          csrImportanceModifier: reviewScenarioSnapshot.csrImportanceModifier ?? 1,
          marketingEffectModifier: reviewScenarioSnapshot.marketingEffectModifier ?? 1,
          costInflation: reviewScenarioSnapshot.costInflation ?? 1,
          investmentCostMultiplier: reviewScenarioSnapshot.investmentCostMultiplier ?? 1,
          interestRateSpread: reviewScenarioSnapshot.interestRateSpread ?? 0,
          taxRateDeltaByRegion: reviewScenarioSnapshot.taxRateDeltaByRegion ?? { us: 0, asia: 0, europe: 0 },
          workingCapitalDelta: reviewScenarioSnapshot.workingCapitalDelta ?? { inventory: 0, receivable: 0, payable: 0 },
          demandGrowthModifier: reviewScenarioSnapshot.demandModifier ?? { us: 0, asia: 0, europe: 0 },
          logisticsTariff: reviewScenarioSnapshot.logisticsTariff,
        }
        : getScenarioEffectsForRound(reviewRoundNumber, game?.scenarioSequence)
    )
  const currentCostInflation = forecastEffects?.costInflation ?? 1
  const reviewCostInflation = reviewEffects?.costInflation ?? 1

  // R&D affordability calculation (needs currentCostInflation)
  const maxAffordableStaff = prevRoundData
    ? Math.floor(Math.max(0, (prevRoundData.cashBalance ?? 0) - (totalTrainingCost * currentCostInflation)) / (staffSalary * currentCostInflation))
    : 500
  const maxStaffCap = Math.max(0, Math.min(500, maxAffordableStaff))
  const staffSliderMax = Math.max(maxStaffCap, rndStaff)

  const productionLines = costDecisions.production?.productionLines ?? {}
  const getSupplierCsrLabel = (id: number) => {
    const csrScore = GAME_CONFIG.supplierCSR?.[id as 1 | 2 | 3 | 4] ?? 0
    let csrLabel = csrScore <= 1 ? 'Poor' : csrScore === 2 ? 'Basic' : csrScore === 3 ? 'Good' : 'Excellent'
    if (id === 3) csrLabel = 'Good'
    if (id === 4) csrLabel = 'Excellent'
    return `Tier ${id} ${csrLabel}`
  }
  const supplierMultiplierFor = (id: number) =>
    GAME_CONFIG.unitCosts.supplier[id as 1 | 2 | 3 | 4] ?? GAME_CONFIG.unitCosts.supplier[1]
  const us1Units = costCapacity.usFactoryCount >= 1
    ? Math.round(capacityPerPlant * ((productionLines.us1?.units ?? 0) / 100))
    : 0
  const us2Units = costCapacity.usFactoryCount >= 2
    ? Math.round(capacityPerPlant * ((productionLines.us2?.units ?? 0) / 100))
    : 0
  const asia1Units = costCapacity.asiaFactoryCount >= 1
    ? Math.round(capacityPerPlant * ((productionLines.asia1?.units ?? 0) / 100))
    : 0
  const asia2Units = costCapacity.asiaFactoryCount >= 2
    ? Math.round(capacityPerPlant * ((productionLines.asia2?.units ?? 0) / 100))
    : 0
  const lineTotalUnits = us1Units + us2Units + asia1Units + asia2Units
  const weightedMaterialCost = lineTotalUnits > 0
    ? (
      (us1Units + us2Units) * GAME_CONFIG.unitCosts.directMaterialUS +
      (asia1Units + asia2Units) * GAME_CONFIG.unitCosts.directMaterialAsia
    ) / lineTotalUnits
    : GAME_CONFIG.unitCosts.directMaterialUS
  const weightedLabourCost = lineTotalUnits > 0
    ? (
      (us1Units + us2Units) * GAME_CONFIG.unitCosts.directLabourUS +
      (asia1Units + asia2Units) * GAME_CONFIG.unitCosts.directLabourAsia
    ) / lineTotalUnits
    : GAME_CONFIG.unitCosts.directLabourUS
  const weightedSupplierMultiplier = lineTotalUnits > 0
    ? (
      (us1Units * supplierMultiplierFor(productionLines.us1?.supplierId ?? 1)) +
      (us2Units * supplierMultiplierFor(productionLines.us2?.supplierId ?? 1)) +
      (asia1Units * supplierMultiplierFor(productionLines.asia1?.supplierId ?? 1)) +
      (asia2Units * supplierMultiplierFor(productionLines.asia2?.supplierId ?? 1))
    ) / lineTotalUnits
    : supplierMultiplierFor(productionLines.us1?.supplierId ?? 1)
  const baseMaterialUnitCost = weightedMaterialCost * weightedSupplierMultiplier
  const overtimeLaborPremiumPct = Math.max(0, GAME_CONFIG.defaults.production.overtimeLaborPremiumPct ?? 50)
  const overtimeLaborPremium = 1 + (Math.max(0, costOvertimePct) / 100) * (overtimeLaborPremiumPct / 100)
  const baseLabourUnitCost = weightedLabourCost * weightedSupplierMultiplier * overtimeLaborPremium
  const baseManufacturingUnitCost = baseMaterialUnitCost + baseLabourUnitCost
  const costCurve = GAME_CONFIG.costCurve
  const costMultiplier = 1 + costCurve.curvature * Math.pow(costUtilization - costCurve.optimalUtilization, 2)
  const unitCostBeforeScenario = baseManufacturingUnitCost * costMultiplier
  const unitCostAfterScenario = unitCostBeforeScenario * currentCostInflation
  const outsourceUnitCostInflated = outsourceUnitCost * currentCostInflation

  // Apply scenario cost inflation to logistics cost (calculated earlier in logistics section)
  const logisticsCostInflated = logisticsCostBase * currentCostInflation
  const logisticsCostTotal = logisticsCostInflated

  const lastRndDecision = prevRoundData?.decisions?.rnd ?? {}
  const lastRndStaff = lastRndDecision.researchStaff ?? defaults.hr.us.employees
  const lastRndTraining = (lastRndDecision.trainingLevel ?? defaults.rnd.trainingLevel ?? 'basic') as 'basic' | 'standard' | 'advanced'
  const lastRndTrainingCostPerStaff =
    (GAME_CONFIG.hr.trainingCostPerStaff?.[lastRndTraining] ?? 0) *
    (GAME_CONFIG.hr.trainingCostMultiplierByRegion?.us ?? 1)
  const lastRndTrainingCost = lastRndStaff * lastRndTrainingCostPerStaff * reviewCostInflation
  const lastRndStaffCost = lastRndStaff * defaults.hr.us.wage * 12 * reviewCostInflation
  const lastRndTotalSpend = lastRndTrainingCost + lastRndStaffCost
  const lastRndFeatures = prevRoundData?.features ?? defaults.initialFeatures ?? 0
  const lastRndUnlocked = lastRndFeatures
  const thisRndUnlocked = projectedFeatures

  const lastMarketing = prevRoundData?.decisions?.marketing ?? {}
  const lastMarketingPrices = {
    us: salesByRegion.us?.price ?? lastMarketing.us?.price ?? GAME_CONFIG.priceDemand.baselinePriceByRegion.us,
    asia: salesByRegion.asia?.price ?? lastMarketing.asia?.price ?? GAME_CONFIG.priceDemand.baselinePriceByRegion.asia,
    europe: salesByRegion.europe?.price ?? lastMarketing.europe?.price ?? GAME_CONFIG.priceDemand.baselinePriceByRegion.europe,
  }
  const lastMarketingPromos = {
    us: lastMarketing.us?.promotionPct ?? defaults.marketing.promotionPctByRegion.us,
    asia: lastMarketing.asia?.promotionPct ?? defaults.marketing.promotionPctByRegion.asia,
    europe: lastMarketing.europe?.promotionPct ?? defaults.marketing.promotionPctByRegion.europe,
  }
  const lastMarketingRevenue = {
    us: reviewUnitsSold.us * lastMarketingPrices.us,
    asia: reviewUnitsSold.asia * lastMarketingPrices.asia,
    europe: reviewUnitsSold.europe * lastMarketingPrices.europe,
  }
  const lastMarketingRevenueTotal = lastMarketingRevenue.us + lastMarketingRevenue.asia + lastMarketingRevenue.europe
  const auditReviewDemand = reviewRoundNumber < 0 ? startingDemand : reviewMarketDemand

  // Calculate last round supply/demand metrics
  const lastRoundTotalSupply = reviewTeams.reduce((sum: number, t: unknown) => {
    const unitsSold = (t.unitsSold?.us ?? 0) + (t.unitsSold?.asia ?? 0) + (t.unitsSold?.europe ?? 0)
    return sum + unitsSold
  }, 0)
  const lastRoundTotalDemand = (reviewMarketDemand?.us ?? 0) + (reviewMarketDemand?.asia ?? 0) + (reviewMarketDemand?.europe ?? 0)
  const lastRoundTotalProduction = reviewTeams.reduce((sum: number, t: unknown) => sum + (t.productionUnits ?? 0), 0)
  const lastRoundUnmetDemand = Math.max(0, lastRoundTotalDemand - lastRoundTotalSupply)
  const lastRoundSurplus = Math.max(0, lastRoundTotalSupply - lastRoundTotalDemand)
  const isShortage = lastRoundUnmetDemand > 0
  const isSurplus = lastRoundSurplus > 0
  const emphasizeNumbers = (text: string) => {
    const parts = text.split(/(\d[\d.,]*(?:[KMB])?%?)/g)
    return parts.map((part, index) => (
      /\d/.test(part)
        ? <span key={`num-${index}`} style={{ color: 'var(--text-accent)', fontWeight: 700 }}>{part}</span>
        : part
    ))
  }

  // Generate dynamic review summary
  const reviewSummaryText = (() => {
    // Calculate supply/demand percentage difference
    const supplyDemandDiff = lastRoundTotalDemand > 0
      ? Math.abs(lastRoundTotalSupply - lastRoundTotalDemand) / lastRoundTotalDemand
      : 0

    const marketCondition = (() => {
      if (supplyDemandDiff < 0.01) {
        return 'supply met demand'
      } else if (isShortage) {
        if (supplyDemandDiff <= 0.03) {
          return 'demand slightly exceeded supply'
        } else {
          return 'strong market demand outpaced total industry supply'
        }
      } else if (isSurplus) {
        if (supplyDemandDiff <= 0.03) {
          return 'supply slightly exceeded demand'
        } else {
          return 'total industry supply exceeded market demand'
        }
      }
      return 'supply met demand'
    })()

    const sharePercent = (reviewAvgShare * 100).toFixed(1)
    const currentScenarioDescription = scenario?.description || scenarioLabel || 'Stable Market'
    const roundLabel = currentRound === 0 ? 'Trial Round' : `Round ${currentRound}`

    return `As we enter ${roundLabel}, the market landscape has expanded to ${currentScenarioDescription}. In the previous round, ${marketCondition}. ${teamName} captured a ${sharePercent}% market share with sales of ${formatUnits(reviewUnitsSoldTotal)} units. You begin this round with ${formatUnits(reviewInventoryUnits)} units in inventory. Good luck!`
  })()

  // Map visited step indices to step IDs for progress tracking
  const visitedStepIds = useMemo(() => {
    const ids = new Set<string>()
    visitedSteps.forEach(index => {
      const step = STEPS[index]
      if (step) ids.add(step.id)
    })
    return ids
  }, [visitedSteps])

  const decisionProgress = useMemo(() => {
    const sections = [
      { id: 'forecast', label: 'Forecast', hasData: visitedStepIds.has('forecast') },
      { id: 'production', label: 'Production', hasData: visitedStepIds.has('production') },
      { id: 'logistics', label: 'Logistics', hasData: visitedStepIds.has('logistics') },
      { id: 'rnd', label: 'R&D', hasData: visitedStepIds.has('rnd') },
      { id: 'marketing', label: 'Marketing', hasData: visitedStepIds.has('marketing') },
      { id: 'finance', label: 'Finance', hasData: visitedStepIds.has('finance') },
    ]
    const completed = sections.filter(s => s.hasData).length
    const total = sections.length
    const percent = Math.round((completed / total) * 100)
    const isSubmitted = Boolean(currentDecision?.isSubmitted || submittedAt)
    return { sections, completed, total, percent, isSubmitted }
  }, [visitedStepIds, currentDecision, submittedAt])

  const marketIntelData = useMemo(() => {
    const myTeam = reviewTeams.find((t: unknown) => t.id === team?.id) || reviewTeams[0]
    const avgPrices = reviewIndustryAverages.price
    const avgPromos = reviewIndustryAverages.promo

    const allPrices = { us: [] as number[], asia: [] as number[], europe: [] as number[] }
    const allPromos = { us: [] as number[], asia: [] as number[], europe: [] as number[] }
    reviewTeams.forEach((t: unknown) => {
      allPrices.us.push(t.prices.us)
      allPrices.asia.push(t.prices.asia)
      allPrices.europe.push(t.prices.europe)
      allPromos.us.push(t.promos.us)
      allPromos.asia.push(t.promos.asia)
      allPromos.europe.push(t.promos.europe)
    })

    const getPriceRange = (region: 'us' | 'asia' | 'europe') => {
      const prices = allPrices[region]
      const basePrice = gameConfig.priceDemand.baselinePriceByRegion[region]
      let min = prices.length > 0 ? Math.min(...prices) : basePrice * 0.8
      let max = prices.length > 0 ? Math.max(...prices) : basePrice * 1.2
      if (max - min < basePrice * 0.2) {
        min = basePrice * 0.9
        max = basePrice * 1.1
      }
      return { min: Math.round(min), max: Math.round(max) }
    }

    const getPromoRange = (region: 'us' | 'asia' | 'europe') => {
      const promos = allPromos[region]
      let min = promos.length > 0 ? Math.min(...promos) : 5
      let max = promos.length > 0 ? Math.max(...promos) : 25
      if (max - min < 10) {
        const center = (min + max) / 2
        min = Math.max(0, center - 10)
        max = Math.min(100, center + 10)
      }
      return { min: Math.round(min), max: Math.round(max) }
    }

    const myFeatures = myTeam?.features ?? prevRoundData?.features ?? 0
    const myCSR = myTeam?.csrRating ?? gameConfig.supplierCSR[2]
    const avgFeatures = reviewIndustryAverages.features ?? 0
    const avgCSR = reviewIndustryAverages.csrRating ?? gameConfig.supplierCSR[2]

    return {
      myTeam,
      avgPrices,
      avgPromos,
      priceRanges: {
        us: getPriceRange('us'),
        asia: getPriceRange('asia'),
        europe: getPriceRange('europe'),
      },
      promoRanges: {
        us: getPromoRange('us'),
        asia: getPromoRange('asia'),
        europe: getPromoRange('europe'),
      },
      features: myFeatures,
      avgFeatures,
      techLevel: prevRoundData?.techLevel ?? 1,
      csrRating: myCSR,
      avgCSR,
    }
  }, [reviewTeams, reviewIndustryAverages, team?.id, gameConfig, prevRoundData])

  const supplyDemandData = useMemo(() => {
    const totalSupply = { us: 0, asia: 0, europe: 0 }
    reviewTeams.forEach((t: unknown) => {
      totalSupply.us += t.unitsSold?.us ?? 0
      totalSupply.asia += t.unitsSold?.asia ?? 0
      totalSupply.europe += t.unitsSold?.europe ?? 0
    })

    const demand = calculatedMarketDemand
    const getBalance = (supply: number, demand: number) => {
      if (demand === 0) return 1
      return supply / demand
    }

    const getStatus = (ratio: number): { status: 'shortage' | 'balanced' | 'saturated'; position: number } => {
      if (ratio < 0.85) return { status: 'shortage', position: 70 + (1 - ratio) * 30 }
      if (ratio > 1.15) return { status: 'saturated', position: 30 - (ratio - 1) * 20 }
      return { status: 'balanced', position: 45 + (1 - ratio) * 10 }
    }

    return {
      us: {
        supply: totalSupply.us,
        demand: demand.us,
        ratio: getBalance(totalSupply.us, demand.us),
        ...getStatus(getBalance(totalSupply.us, demand.us)),
      },
      asia: {
        supply: totalSupply.asia,
        demand: demand.asia,
        ratio: getBalance(totalSupply.asia, demand.asia),
        ...getStatus(getBalance(totalSupply.asia, demand.asia)),
      },
      europe: {
        supply: totalSupply.europe,
        demand: demand.europe,
        ratio: getBalance(totalSupply.europe, demand.europe),
        ...getStatus(getBalance(totalSupply.europe, demand.europe)),
      },
    }
  }, [reviewTeams, calculatedMarketDemand])

  const marketIntelAuditText = useMemo(() => {
    if (!reviewIndustryAverages || reviewTeams.length === 0) return ''
    const lines: string[] = []

    lines.push('MARKET INTELLIGENCE AUDIT - Average Calculation Breakdown')
    lines.push('='.repeat(80))
    lines.push('')
    lines.push(`Review Round: ${prevRoundData?.round ?? -1}`)
    lines.push(`Total Teams: ${reviewTeams.length}`)
    lines.push('')

    lines.push('AVERAGE PRICES BY REGION')
    lines.push('-'.repeat(80))
    interface TeamPrices {
      name: string
      us: number
      asia: number
      europe: number
    }
    const allPrices: TeamPrices[] = reviewTeams.map((t: unknown) => ({
      name: t.name,
      us: t.prices.us,
      asia: t.prices.asia,
      europe: t.prices.europe,
    }))

    lines.push('')
    lines.push('US Region:')
    allPrices.forEach((team) => {
      lines.push(`  ${team.name}: ${formatCurrency(team.us)}`)
    })
    const avgPriceUS = reviewIndustryAverages.price?.us ?? 0
    lines.push(`  Average: (${allPrices.map(t => formatCurrency(t.us)).join(' + ')}) / ${allPrices.length}`)
    lines.push(`  Average: ${formatCurrency(avgPriceUS)}`)

    lines.push('')
    lines.push('Asia Region:')
    allPrices.forEach((team) => {
      lines.push(`  ${team.name}: ${formatCurrency(team.asia)}`)
    })
    const avgPriceAsia = reviewIndustryAverages.price?.asia ?? 0
    lines.push(`  Average: (${allPrices.map(t => formatCurrency(t.asia)).join(' + ')}) / ${allPrices.length}`)
    lines.push(`  Average: ${formatCurrency(avgPriceAsia)}`)

    lines.push('')
    lines.push('Europe Region:')
    allPrices.forEach((team) => {
      lines.push(`  ${team.name}: ${formatCurrency(team.europe)}`)
    })
    const avgPriceEurope = reviewIndustryAverages.price?.europe ?? 0
    lines.push(`  Average: (${allPrices.map(t => formatCurrency(t.europe)).join(' + ')}) / ${allPrices.length}`)
    lines.push(`  Average: ${formatCurrency(avgPriceEurope)}`)

    lines.push('')
    lines.push('AVERAGE PROMOTION % BY REGION')
    lines.push('-'.repeat(80))
    interface TeamPromos {
      name: string
      us: number
      asia: number
      europe: number
    }
    const allPromos: TeamPromos[] = reviewTeams.map((t: unknown) => ({
      name: t.name,
      us: t.promos.us,
      asia: t.promos.asia,
      europe: t.promos.europe,
    }))

    lines.push('')
    lines.push('US Region:')
    allPromos.forEach((team) => {
      lines.push(`  ${team.name}: ${team.us.toFixed(1)}%`)
    })
    const avgPromoUS = reviewIndustryAverages.promo?.us ?? 0
    lines.push(`  Average: (${allPromos.map(t => t.us.toFixed(1)).join(' + ')}) / ${allPromos.length}`)
    lines.push(`  Average: ${avgPromoUS.toFixed(1)}%`)

    lines.push('')
    lines.push('Asia Region:')
    allPromos.forEach((team) => {
      lines.push(`  ${team.name}: ${team.asia.toFixed(1)}%`)
    })
    const avgPromoAsia = reviewIndustryAverages.promo?.asia ?? 0
    lines.push(`  Average: (${allPromos.map(t => t.asia.toFixed(1)).join(' + ')}) / ${allPromos.length}`)
    lines.push(`  Average: ${avgPromoAsia.toFixed(1)}%`)

    lines.push('')
    lines.push('Europe Region:')
    allPromos.forEach((team) => {
      lines.push(`  ${team.name}: ${team.europe.toFixed(1)}%`)
    })
    const avgPromoEurope = reviewIndustryAverages.promo?.europe ?? 0
    lines.push(`  Average: (${allPromos.map(t => t.europe.toFixed(1)).join(' + ')}) / ${allPromos.length}`)
    lines.push(`  Average: ${avgPromoEurope.toFixed(1)}%`)

    lines.push('')
    lines.push('AVERAGE TECH FEATURES')
    lines.push('-'.repeat(80))
    interface TeamFeatures {
      name: string
      features: number
    }
    const allFeatures: TeamFeatures[] = reviewTeams.map((t: unknown) => ({
      name: t.name,
      features: t.features ?? 0,
    }))

    allFeatures.forEach((team) => {
      lines.push(`  ${team.name}: ${team.features} features`)
    })
    const avgFeatures = reviewIndustryAverages.features ?? 0
    lines.push(`  Average: (${allFeatures.map(t => t.features).join(' + ')}) / ${allFeatures.length}`)
    lines.push(`  Average: ${avgFeatures.toFixed(2)} features`)

    lines.push('')
    lines.push('AVERAGE CSR RATING')
    lines.push('-'.repeat(80))
    interface TeamCSR {
      name: string
      csr: number
    }
    const allCSR: TeamCSR[] = reviewTeams.map((t: unknown) => ({
      name: t.name,
      csr: t.csrRating ?? GAME_CONFIG.supplierCSR[2],
    }))

    allCSR.forEach((team) => {
      lines.push(`  ${team.name}: ${team.csr.toFixed(2)} / 4.0`)
    })
    const avgCSR = reviewIndustryAverages.csrRating ?? 0
    lines.push(`  Average: (${allCSR.map(t => t.csr.toFixed(2)).join(' + ')}) / ${allCSR.length}`)
    lines.push(`  Average: ${avgCSR.toFixed(2)} / 4.0`)

    lines.push('')
    lines.push('='.repeat(80))
    lines.push('End of Market Intelligence Audit')

    return lines.join('\n')
  }, [reviewIndustryAverages, reviewTeams, GAME_CONFIG, prevRoundData])

  const auditText = (() => {
    const joinLines = (lines: (string | null | undefined)[]) => lines.filter(Boolean).join('\n')
    const demandMultiplier = game?.marketDemandMultiplier ?? 1
    const baseGrowth = GAME_CONFIG.marketGrowthRate ?? { us: 0, asia: 0, europe: 0 }
    const reviewScenario = reviewScenarioSnapshot ?? (reviewRoundNumber >= 0 ? scenarioForRound(reviewRoundNumber) : null)
    const scenarioDemand = reviewScenario
      ? {
        us: baseGrowth.us + (reviewScenario.demandModifier?.us ?? 0),
        asia: baseGrowth.asia + (reviewScenario.demandModifier?.asia ?? 0),
        europe: baseGrowth.europe + (reviewScenario.demandModifier?.europe ?? 0),
      }
      : baseGrowth
    const auditCapacityPerPlant = prevRoundData?.capacityPerPlantUsed ?? capacityPerPlant
    const startingDemandResult = fetchedResults.find((result) => result.roundNumber === -1)
    const auditPrevDemand = prevRoundData?.previousMarketDemand
      ?? (reviewRoundNumber === 0 ? (startingDemandResult?.marketDemand ?? null) : null)
    const auditPrevDemandTotal = auditPrevDemand
      ? (auditPrevDemand.us + auditPrevDemand.asia + auditPrevDemand.europe)
      : 0
    const auditPrevDemandLabel = 'Previous round total sold break down to each region'
    const scenarioTimeline = forecastRounds
      .filter((round) => round >= 0)
      .map((round) => {
        const scenarioData = scenarioForRound(round)
        const scenarioName = scenarioData?.name ?? 'Stable Market'
        const growth = {
          us: baseGrowth.us + (scenarioData?.demandModifier?.us ?? 0),
          asia: baseGrowth.asia + (scenarioData?.demandModifier?.asia ?? 0),
          europe: baseGrowth.europe + (scenarioData?.demandModifier?.europe ?? 0),
        }
        const taxDelta = scenarioData?.taxRateDeltaByRegion ?? { us: 0, asia: 0, europe: 0 }
        const wc = scenarioData?.workingCapitalDelta ?? { inventory: 0, receivable: 0, payable: 0 }
        const isCurrent = round === currentRound
        const prefix = isCurrent ? '[[GREEN_LINE]]' : ''
        return joinLines([
          `${prefix}Round ${round} (${round === 0 ? 'Trial' : 'Live'}): ${scenarioName}`,
          `${prefix}  Demand growth: US ${formatPctValue(growth.us, 2)} | Asia ${formatPctValue(growth.asia, 2)} | Europe ${formatPctValue(growth.europe, 2)}`,
          `${prefix}  Cost inflation: ${formatMultiplier(scenarioData?.costInflation ?? 1)}`,
          `${prefix}  Interest spread: ${formatPctValue((scenarioData?.interestRateSpread ?? 0) * 100, 2)} (base ${formatRateValue(GAME_CONFIG.financial.interestRate)})`,
          `${prefix}  Tax delta: US ${formatPctValue((taxDelta.us ?? 0) * 100, 2)} | Asia ${formatPctValue((taxDelta.asia ?? 0) * 100, 2)} | Europe ${formatPctValue((taxDelta.europe ?? 0) * 100, 2)}`,
          `${prefix}  Price elasticity: ${formatMultiplier(scenarioData?.priceElasticityModifier ?? 1)} | Marketing effect: ${formatMultiplier(scenarioData?.marketingEffectModifier ?? 1)} | CSR importance: ${formatMultiplier(scenarioData?.csrImportanceModifier ?? 1)}`,
          `${prefix}  Investment cost: ${formatMultiplier(scenarioData?.investmentCostMultiplier ?? 1)}`,
          `${prefix}  Working capital delta: Inv ${formatPctValue((wc.inventory ?? 0) * 100, 2)} | AR ${formatPctValue((wc.receivable ?? 0) * 100, 2)} | AP ${formatPctValue((wc.payable ?? 0) * 100, 2)}`,
        ])
      })

    if (activeStep.id === 'review') {
      const inventoryFactor = 1.1
      if (reviewRoundNumber < 0 && !prevRoundData) {
        return 'AUDIT: Starting Position\nNo stored Round -1 results available.'
      }
      const auditFactoriesUS = prevRoundData?.factoriesUS ?? GAME_CONFIG.initialFactories.us
      const auditFactoriesAsia = prevRoundData?.factoriesAsia ?? GAME_CONFIG.initialFactories.asia
      const auditTotalCapacity = (auditFactoriesUS + auditFactoriesAsia) * auditCapacityPerPlant
      const auditUnitsProduced = prevRoundData?.unitsProduced ?? auditTotalCapacity
      const auditShare = forecastTeamCount > 0 ? 1 / forecastTeamCount : 0
      const auditMarketShare = prevRoundData?.marketShare ?? { us: auditShare, asia: auditShare, europe: auditShare }
      const auditUnitsSold = reviewUnitsSoldTotal > 0
        ? reviewUnitsSold
        : {
          us: Math.round(auditReviewDemand.us * auditShare),
          asia: Math.round(auditReviewDemand.asia * auditShare),
          europe: Math.round(auditReviewDemand.europe * auditShare),
        }
      const auditUnitsSoldTotal = auditUnitsSold.us + auditUnitsSold.asia + auditUnitsSold.europe
      const auditPrices = {
        us: salesByRegion.us?.price || GAME_CONFIG.priceDemand.baselinePriceByRegion.us,
        asia: salesByRegion.asia?.price || GAME_CONFIG.priceDemand.baselinePriceByRegion.asia,
        europe: salesByRegion.europe?.price || GAME_CONFIG.priceDemand.baselinePriceByRegion.europe,
      }
      const auditRevenueCalc = {
        us: auditUnitsSold.us * auditPrices.us,
        asia: auditUnitsSold.asia * auditPrices.asia,
        europe: auditUnitsSold.europe * auditPrices.europe,
      }
      const auditRevenueCalcTotal = auditRevenueCalc.us + auditRevenueCalc.asia + auditRevenueCalc.europe
      const auditRevenueTotal = prevRoundData?.revenue ?? auditRevenueCalcTotal
      const auditInventoryUnits = prevRoundData?.inventoryUnits ?? Math.max(0, Math.round(auditUnitsProduced - auditUnitsSoldTotal))
      const auditStartingInventoryUnits = prevRoundData?.startingInventoryUnits ?? 0
      const auditStartingInventoryByRegion = prevRoundData?.startingInventoryByRegion ?? {
        us: auditStartingInventoryUnits,
        asia: 0,
        europe: 0,
      }
      const auditEndingInventoryUnits = prevRoundData?.endingInventoryUnits ?? auditInventoryUnits
      const auditEndingInventoryByRegion = prevRoundData?.endingInventoryByRegion
        ?? prevRoundData?.inventoryByRegion
        ?? {
        us: auditEndingInventoryUnits,
        asia: 0,
        europe: 0,
      }
      const auditUnitCost = prevRoundData?.unitCost ?? unitCostAfterScenario
      const auditMaterialCost = prevRoundData?.materials ?? 0
      const auditLaborCost = prevRoundData?.labor ?? 0
      const auditLogisticsCost = prevRoundData?.logistics ?? 0
      const auditOutsourcingCost = prevRoundData?.outsourcing ?? 0
      const auditManufacturingCogs = auditMaterialCost + auditLaborCost
      const auditTotalCogs = prevRoundData?.cogs ?? (auditManufacturingCogs + auditLogisticsCost + auditOutsourcingCost)
      const auditGrossProfit = prevRoundData?.grossProfit ?? (auditRevenueTotal - auditTotalCogs)
      const auditPromoSpend = prevRoundData?.marketing ?? 0
      const auditRndCost = prevRoundData?.rnd ?? 0
      const auditAdminCost = prevRoundData?.admin ?? 0
      const workingCapitalDeltaUsed = prevRoundData?.workingCapitalDeltaUsed ?? { inventory: 0, receivable: 0, payable: 0 }
      const auditInventoryHoldingValue = auditEndingInventoryUnits * auditUnitCost * (1 + workingCapitalDeltaUsed.inventory)
      const auditInventoryHoldingCost = auditInventoryHoldingValue * GAME_CONFIG.hr.inventoryHoldingCostPercent
      const auditInventoryHoldingStored = prevRoundData?.inventoryHolding ?? 0
      const auditOperatingExpenses = prevRoundData?.operatingExpenses
        ?? (auditPromoSpend + auditRndCost + auditAdminCost + auditInventoryHoldingCost)
      const auditDepreciation = prevRoundData?.depreciation ?? 0
      const auditInterest = prevRoundData?.interest ?? 0
      const auditTax = prevRoundData?.tax ?? 0
      const auditNetProfit = prevRoundData?.netProfit ?? 0
      const auditInterestRate = prevRoundData?.activeInterestRate ?? GAME_CONFIG.financial.interestRate
      const auditTaxRate = prevRoundData?.activeTaxRate ?? GAME_CONFIG.financial.taxRate
      const auditTaxDelta = reviewScenario?.taxRateDeltaByRegion ?? { us: 0, asia: 0, europe: 0 }
      const auditEbit = prevRoundData?.ebit ?? (auditGrossProfit - auditOperatingExpenses - auditDepreciation)
      const auditProfitBeforeTax = prevRoundData?.profitBeforeTax ?? (auditEbit - auditInterest)
      const auditTaxLossCarryforwardStart = prevRoundData?.taxLossCarryforwardStart ?? 0
      const auditTaxLossCarryforwardEnd = prevRoundData?.taxLossCarryforward ?? 0
      const auditTaxableIncome = Math.max(0, auditProfitBeforeTax - auditTaxLossCarryforwardStart)
      const auditFinanceDecision = prevRoundData?.decisions?.finance ?? {}
      const auditInvestmentDecision = prevRoundData?.decisions?.investment ?? {}
      const priorRoundNumber = reviewRoundNumber <= 1 ? -1 : reviewRoundNumber - 1
      const priorRoundEntry = fetchedResults.find((round) => round.roundNumber === priorRoundNumber) ?? null
      const priorTeamEntry = priorRoundEntry?.teams?.find((row: unknown) => row.teamId === team?.id) ?? null
      const priorEngineBS = priorTeamEntry?.fullResults?.balanceSheet ?? null
      const currentEngineBS = prevRoundData?.engineBalanceSheet ?? null
      const priorCash = priorEngineBS?.cash ?? null
      const priorDebt = priorEngineBS?.longTermDebt ?? null
      const priorShareCapital = priorEngineBS?.shareCapital ?? null
      const priorRetained = priorEngineBS?.retainedEarnings ?? null
      const priorFixedAssets = priorEngineBS?.fixedAssets ?? null
      const priorInventoryValue = priorEngineBS?.inventory ?? null
      const priorReceivables = priorEngineBS?.receivables ?? null
      const priorPayables = priorEngineBS?.payables ?? null
      const priorShortTermLoans = priorEngineBS?.shortTermLoans ?? 0
      const currentShortTermLoans = currentEngineBS?.shortTermLoans ?? prevRoundData?.shortTermLoans ?? 0
      const currentEngineCash = currentEngineBS?.cash ?? displayCash
      const currentEngineDebt = currentEngineBS?.longTermDebt ?? displayDebt
      const currentEngineShareCapital = currentEngineBS?.shareCapital ?? displayShareCapital
      const currentEngineRetained = currentEngineBS?.retainedEarnings ?? displayRetainedEarnings
      const currentEngineFixedAssets = currentEngineBS?.fixedAssets ?? displayFixedAssets
      const currentEngineInventory = currentEngineBS?.inventory ?? displayInventoryValue
      const currentEngineReceivables = currentEngineBS?.receivables ?? displayReceivables
      const currentEnginePayables = currentEngineBS?.payables ?? displayPayables
      // const cashDelta = priorCash !== null ? (currentEngineCash - priorCash) : null
      // const debtDelta = priorDebt !== null ? (currentEngineDebt - priorDebt) : null
      // const shareCapitalDelta = priorShareCapital !== null ? (currentEngineShareCapital - priorShareCapital) : null
      // const retainedDelta = priorRetained !== null ? (currentEngineRetained - priorRetained) : null
      // const fixedAssetsDelta = priorFixedAssets !== null ? (currentEngineFixedAssets - priorFixedAssets) : null
      const legacyDebtDelta = auditFinanceDecision.longTermDebt ?? 0
      // const financeBorrowing = auditFinanceDecision.borrowing ?? 0
      // const financeRepayment = auditFinanceDecision.repayment ?? 0
      const financeDividend = auditFinanceDecision.dividends ?? auditFinanceDecision.dividend ?? 0
      const legacyShareDelta = auditFinanceDecision.shareIssuance ?? 0
      // const financeShareIssue = auditFinanceDecision.shareIssue ?? 0
      // const financeShareBuyback = auditFinanceDecision.shareBuyback ?? 0
      const financeNewPlantsUS = auditInvestmentDecision.newPlantsUS ?? 0
      const financeNewPlantsAsia = auditInvestmentDecision.newPlantsAsia ?? 0
      const plantCostUS = GAME_CONFIG.investment?.plantCostUS ?? 0
      const plantCostAsia = GAME_CONFIG.investment?.plantCostAsia ?? 0
      const expectedDebtDelta = legacyDebtDelta
      const expectedShareCapitalDelta = legacyShareDelta
      // const expectedRetainedDelta = -financeDividend
      // Unused for now - may be needed for future audit features
      // const expectedFixedAssetsDelta = (financeNewPlantsUS * plantCostUS) + (financeNewPlantsAsia * plantCostAsia)
      const expectedRetainedEngineDelta = auditNetProfit - financeDividend
      // const expectedFixedAssetsEngineDelta = -auditDepreciation + expectedFixedAssetsDelta
      const operatingCashFlow = (priorInventoryValue !== null && priorReceivables !== null && priorPayables !== null)
        ? (auditNetProfit + auditDepreciation
          - (currentEngineInventory - priorInventoryValue)
          - (currentEngineReceivables - priorReceivables)
          + (currentEnginePayables - priorPayables))
        : null
      // const expectedCashEngineDelta = operatingCashFlow !== null
      //   ? (operatingCashFlow + legacyDebtDelta + legacyShareDelta - financeDividend - expectedFixedAssetsDelta - priorShortTermLoans + currentShortTermLoans)
      //   : null
      const investmentMultiplierUsed = reviewScenario?.investmentCostMultiplier ?? prevRoundData?.investmentCostMultiplierUsed ?? 1
      const plantCostUSUsed = prevRoundData?.plantCostUSUsed ?? plantCostUS
      const plantCostAsiaUsed = prevRoundData?.plantCostAsiaUsed ?? plantCostAsia
      const capexUsed = (financeNewPlantsUS * plantCostUSUsed + financeNewPlantsAsia * plantCostAsiaUsed) * investmentMultiplierUsed
      const expectedFixedAssetsEngineDeltaDetailed = -auditDepreciation + capexUsed
      const expectedCashEngineDeltaDetailed = operatingCashFlow !== null
        ? (operatingCashFlow + legacyDebtDelta + legacyShareDelta - financeDividend - capexUsed - priorShortTermLoans + currentShortTermLoans)
        : null
      // Unused for now - may be needed for future audit features
      // const expectedCashDelta =
      //   -financeDividend
      //   - expectedFixedAssetsDelta
      //   + legacyShareDelta
      //   + legacyDebtDelta
      const reconcileLine = (label: string, start: number | null, expectedDelta: number, end: number) => {
        if (start === null) {
          return `  ${label}: n/a`
        }
        const expectedEnd = start + expectedDelta
        const ok = Math.abs(expectedEnd - end) < 1
        // Use markers that renderAuditText can colorize
        return `  ${label}: ${formatCurrency(start)} + ${formatCurrency(expectedDelta)} = ${formatCurrency(end)} ${ok ? '[[OK]]' : '[[MISMATCH]]'}`
      }
      const auditDemandTotal = auditReviewDemand.total ?? (auditReviewDemand.us + auditReviewDemand.asia + auditReviewDemand.europe)
      const auditBaseDemandTotal = auditDemandTotal * inventoryFactor
      // Unused for now - may be needed for future audit features
      // const auditBaseDemandByRegion = {
      //   us: auditReviewDemand.us * inventoryFactor,
      //   asia: auditReviewDemand.asia * inventoryFactor,
      //   europe: auditReviewDemand.europe * inventoryFactor,
      // }
      const allTeamsRoundEntry = reviewRoundNumber >= 0
        ? fetchedResults.find((round) => round.roundNumber === reviewRoundNumber)
        : null
      const allTeamsRows = allTeamsRoundEntry?.teams ?? []
      const allTeamsSupplyTotals = allTeamsRows.reduce(
        (acc: { sold: { us: number; asia: number; europe: number }; inv: { us: number; asia: number; europe: number }; startInv: { us: number; asia: number; europe: number }; production: number }, row: unknown) => {
          let full: unknown = row.fullResults ?? {}
          if (typeof full === 'string') {
            try {
              full = JSON.parse(full)
            } catch {
              full = {}
            }
          }
          const sales = full.sales ?? {}
          const productionUnits = full.productionUnits ?? full.production?.totalUnits ?? row.productionUnits ?? 0
          const soldUS = row.salesUnitsUS ?? sales.us?.units ?? 0
          const soldAsia = row.salesUnitsAsia ?? sales.asia?.units ?? 0
          const soldEurope = row.salesUnitsEurope ?? sales.europe?.units ?? 0
          const inventoryTrace = full.audit?.trace?.inventory ?? full.inventoryTrace ?? null
          const gameState = full.gameState ?? row.gameState ?? {}
          const startInvUS = inventoryTrace?.startingUnitsUS ?? 0
          const startInvAsia = inventoryTrace?.startingUnitsAsia ?? 0
          const startInvEurope = inventoryTrace?.startingUnitsEurope ?? 0
          const invUS = inventoryTrace?.endingUnitsUS ?? gameState.inventoryUS ?? gameState.inventory ?? 0
          const invAsia = inventoryTrace?.endingUnitsAsia ?? gameState.inventoryAsia ?? 0
          const invEurope = inventoryTrace?.endingUnitsEurope ?? 0
          acc.sold.us += soldUS
          acc.sold.asia += soldAsia
          acc.sold.europe += soldEurope
          acc.inv.us += invUS
          acc.inv.asia += invAsia
          acc.inv.europe += invEurope
          acc.startInv.us += startInvUS
          acc.startInv.asia += startInvAsia
          acc.startInv.europe += startInvEurope
          acc.production += productionUnits
          return acc
        },
        { sold: { us: 0, asia: 0, europe: 0 }, inv: { us: 0, asia: 0, europe: 0 }, startInv: { us: 0, asia: 0, europe: 0 }, production: 0 }
      )
      const allTeamsSoldTotal = allTeamsSupplyTotals.sold.us + allTeamsSupplyTotals.sold.asia + allTeamsSupplyTotals.sold.europe
      const allTeamsInvTotal = allTeamsSupplyTotals.inv.us + allTeamsSupplyTotals.inv.asia + allTeamsSupplyTotals.inv.europe
      const allTeamsStartInvTotal = allTeamsSupplyTotals.startInv.us + allTeamsSupplyTotals.startInv.asia + allTeamsSupplyTotals.startInv.europe
      const scenarioSection = reviewRoundNumber < 0
        ? ['Scenario (stored): None (starting assumptions)']
        : [
          `Scenario (stored): ${reviewScenario?.name ?? 'Unknown'}`,
          `Demand modifiers: US ${formatPctValue(scenarioDemand.us, 2)} | Asia ${formatPctValue(scenarioDemand.asia, 2)} | Europe ${formatPctValue(scenarioDemand.europe, 2)}`,
          `Cost inflation: ${formatMultiplier(reviewScenario?.costInflation ?? 1)}`,
          `Interest spread: ${formatPctValue((reviewScenario?.interestRateSpread ?? 0) * 100, 2)}`,
          `Tax delta: US ${formatPctValue(((reviewScenario?.taxRateDeltaByRegion?.us ?? 0) * 100), 2)} | Asia ${formatPctValue(((reviewScenario?.taxRateDeltaByRegion?.asia ?? 0) * 100), 2)} | Europe ${formatPctValue(((reviewScenario?.taxRateDeltaByRegion?.europe ?? 0) * 100), 2)}`,
        ]
      const baseDemandSection = reviewRoundNumber < 0
        ? [
          `Base Demand Total (implied): ${formatUnits(auditBaseDemandTotal)} = ${formatUnits(auditDemandTotal)} x ${inventoryFactor}`,
          '',
        ]
        : []
      const prevDemandLine = reviewRoundNumber <= 0
        ? []
        : [
          auditPrevDemand
            ? `${auditPrevDemandLabel}: US ${formatUnits(auditPrevDemand.us)} | Asia ${formatUnits(auditPrevDemand.asia)} | Europe ${formatUnits(auditPrevDemand.europe)}`
            : `${auditPrevDemandLabel}: unavailable`,
        ]
      const formulaDetails = reviewRoundNumber <= 0
        ? []
        : [
          auditPrevDemand
            ? `Demand formula: prev * (1 + (growth * ${demandMultiplier})/100)`
            : '',
          auditPrevDemand
            ? `  US: ${formatUnits(auditPrevDemand.us)} * (1 + (${scenarioDemand.us} * ${demandMultiplier})/100) = ${formatUnits(auditReviewDemand.us)}`
            : '',
          auditPrevDemand
            ? `  Asia: ${formatUnits(auditPrevDemand.asia)} * (1 + (${scenarioDemand.asia} * ${demandMultiplier})/100) = ${formatUnits(auditReviewDemand.asia)}`
            : '',
          auditPrevDemand
            ? `  Europe: ${formatUnits(auditPrevDemand.europe)} * (1 + (${scenarioDemand.europe} * ${demandMultiplier})/100) = ${formatUnits(auditReviewDemand.europe)}`
            : '',
        ]
      const trialDemandSection = reviewRoundNumber === 0
        ? [
          auditPrevDemand
            ? `${auditPrevDemandLabel}: Total ${formatUnits(auditPrevDemandTotal)}`
            : `${auditPrevDemandLabel}: unavailable`,
          auditPrevDemand
            ? `  Breakdown: US ${formatUnits(auditPrevDemand.us)} | Asia ${formatUnits(auditPrevDemand.asia)} | Europe ${formatUnits(auditPrevDemand.europe)}`
            : '',
          auditPrevDemand
            ? `Trial demand formula: prev * (1 + (growth * ${demandMultiplier})/100)`
            : '',
          auditPrevDemand
            ? `  US: ${formatUnits(auditPrevDemand.us)} * (1 + (${scenarioDemand.us} * ${demandMultiplier})/100) = ${formatUnits(auditReviewDemand.us)}`
            : '',
          auditPrevDemand
            ? `  Asia: ${formatUnits(auditPrevDemand.asia)} * (1 + (${scenarioDemand.asia} * ${demandMultiplier})/100) = ${formatUnits(auditReviewDemand.asia)}`
            : '',
          auditPrevDemand
            ? `  Europe: ${formatUnits(auditPrevDemand.europe)} * (1 + (${scenarioDemand.europe} * ${demandMultiplier})/100) = ${formatUnits(auditReviewDemand.europe)}`
            : '',
        ]
        : []
      const computedAttractiveness = reviewTeams?.length
        ? (() => {
          const map = new Map<string, unknown>()
          const totals = { us: 0, asia: 0, europe: 0 }
          const avgPrice = { us: 0, asia: 0, europe: 0 }
          const teamCount = reviewTeams.length
          const teamData = reviewTeams.map((row: unknown) => {
            const rawDecision = row.decisions ?? {}
            const engineDecision = rawDecision.marketing?.us
              ? rawDecision
              : transformDecisionFromDb(rawDecision, GAME_CONFIG, true)
            // reviewTeams now provides gameState directly (not nested in fullResults)
            const engineState = row.gameState ?? createInitialGameState(GAME_CONFIG)
            // Update rndProgress with availableFeatures/availableTechLevel from reviewTeams
            if (row.availableFeatures !== undefined || row.availableTechLevel !== undefined) {
              const current = engineState.rndProgress ?? { unlockedFeatureCount: 0, unlockedTechLevel: 1, cumulativeResearchHours: 0 }
              engineState.rndProgress = {
                ...current,
                unlockedFeatureCount: row.availableFeatures ?? current.unlockedFeatureCount,
                unlockedTechLevel: row.availableTechLevel ?? current.unlockedTechLevel,
              }
            }
            const prices = {
              us: engineDecision.marketing?.us?.price ?? GAME_CONFIG.priceDemand.baselinePriceByRegion.us,
              asia: engineDecision.marketing?.asia?.price ?? GAME_CONFIG.priceDemand.baselinePriceByRegion.asia,
              europe: engineDecision.marketing?.europe?.price ?? GAME_CONFIG.priceDemand.baselinePriceByRegion.europe,
            }
            avgPrice.us += prices.us
            avgPrice.asia += prices.asia
            avgPrice.europe += prices.europe
            return { row, engineDecision, engineState, prices }
          })
          if (teamCount > 0) {
            avgPrice.us /= teamCount
            avgPrice.asia /= teamCount
            avgPrice.europe /= teamCount
          }
          teamData.forEach(({ row, engineDecision, engineState, prices }: unknown) => {
            const storedBreakdown = row.attractivenessBreakdown
            const us = storedBreakdown?.us ?? calculateAttractivenessBreakdown(engineDecision, engineState, 'us', avgPrice.us, reviewEffects as unknown, GAME_CONFIG)
            const asia = storedBreakdown?.asia ?? calculateAttractivenessBreakdown(engineDecision, engineState, 'asia', avgPrice.asia, reviewEffects as unknown, GAME_CONFIG)
            const europe = storedBreakdown?.europe ?? calculateAttractivenessBreakdown(engineDecision, engineState, 'europe', avgPrice.europe, reviewEffects as unknown, GAME_CONFIG)
            totals.us += us.finalScore
            totals.asia += asia.finalScore
            totals.europe += europe.finalScore
            // Use availableFeatures/availableTechLevel directly from row (from reviewTeams)
            const availableFeatures = row.availableFeatures ?? engineState.rndProgress?.unlockedFeatureCount ?? 0
            const availableTechLevel = row.availableTechLevel ?? engineState.rndProgress?.unlockedTechLevel ?? 0
            const key = row.teamId ?? row.id ?? row.teamCode ?? row.name
            map.set(key, { us, asia, europe, prices, engineDecision, engineState, availableFeatures, availableTechLevel })
          })
          return { map, totals, avgPrice }
        })()
        : null
      const renderTable = (headers: string[], rows: string[][]) => {
        const widths = headers.map((header, idx) => {
          const maxCell = rows.reduce((max, row) => Math.max(max, (row[idx] ?? '').length), header.length)
          return maxCell
        })
        const formatRow = (cells: string[]) =>
          cells.map((cell, idx) => (cell ?? '').padEnd(widths[idx])).join(' | ')
        const divider = widths.map((width) => '-'.repeat(width)).join('-|-')
        return [
          formatRow(headers),
          divider,
          ...rows.map(formatRow),
        ]
      }
      const summaryTables = computedAttractiveness
        ? (() => {
          const teams = reviewTeams.map((row: unknown) => {
            const key = row.teamId ?? row.id ?? row.teamCode ?? row.name
            return {
              name: row.name,
              csrRating: row.csrRating ?? 0,
              data: computedAttractiveness.map.get(key),
              // Actual stored data for comparison
              actualMarketShare: row.marketShare ?? { us: 0, asia: 0, europe: 0 },
              actualUnitsSold: row.unitsSold ?? { us: 0, asia: 0, europe: 0 },
              audit: row.audit ?? null,
              sales: row.sales ?? null,
              capacity: row.capacity ?? null,
              productionUnits: row.productionUnits ?? 0,
            }
          }).filter((row: unknown) => row.data)
          const totals = computedAttractiveness.totals
          const summaryRows = teams.map((row: unknown) => {
            const shareUS = totals.us > 0 ? row.data.us.finalScore / totals.us : 0
            const shareAsia = totals.asia > 0 ? row.data.asia.finalScore / totals.asia : 0
            const shareEurope = totals.europe > 0 ? row.data.europe.finalScore / totals.europe : 0
            return [
              row.name,
              row.data.us.finalScore.toFixed(1),
              row.data.asia.finalScore.toFixed(1),
              row.data.europe.finalScore.toFixed(1),
              row.data.us.trainingScore.toFixed(1),
              row.data.asia.trainingScore.toFixed(1),
              row.data.europe.trainingScore.toFixed(1),
              formatRatio(shareUS),
              formatRatio(shareAsia),
              formatRatio(shareEurope),
            ]
          })
          const summaryTable = renderTable(
            ['Team', 'US Score', 'Asia Score', 'Europe Score', 'US Train', 'Asia Train', 'Europe Train', 'US Share', 'Asia Share', 'Europe Share'],
            summaryRows
          )
          // Ideal vs Actual comparison table
          const comparisonRows = teams.map((row: unknown) => {
            const idealUS = totals.us > 0 ? row.data.us.finalScore / totals.us : 0
            const idealAsia = totals.asia > 0 ? row.data.asia.finalScore / totals.asia : 0
            const idealEurope = totals.europe > 0 ? row.data.europe.finalScore / totals.europe : 0
            const actualUS = row.actualMarketShare.us ?? 0
            const actualAsia = row.actualMarketShare.asia ?? 0
            const actualEurope = row.actualMarketShare.europe ?? 0
            const diffUS = (actualUS - idealUS) * 100
            const diffAsia = (actualAsia - idealAsia) * 100
            const diffEurope = (actualEurope - idealEurope) * 100
            // Get unmet demand from sales if available
            const unmetUS = row.sales?.us?.unmetDemand ?? 0
            const unmetAsia = row.sales?.asia?.unmetDemand ?? 0
            const unmetEurope = row.sales?.europe?.unmetDemand ?? 0
            return [
              row.name,
              formatRatio(idealUS),
              formatRatio(actualUS),
              `${diffUS >= 0 ? '+' : ''}${diffUS.toFixed(1)}%`,
              formatRatio(idealAsia),
              formatRatio(actualAsia),
              `${diffAsia >= 0 ? '+' : ''}${diffAsia.toFixed(1)}%`,
              formatRatio(idealEurope),
              formatRatio(actualEurope),
              `${diffEurope >= 0 ? '+' : ''}${diffEurope.toFixed(1)}%`,
              unmetUS > 0 || unmetAsia > 0 || unmetEurope > 0 ? 'Yes' : 'No',
            ]
          })
          const comparisonTable = [
            '',
            'Ideal vs Actual Market Share',
            '(Difference due to capacity constraints & unmet demand redistribution)',
            ...renderTable(
              ['Team', 'US Ideal', 'US Actual', 'US Diff', 'Asia Ideal', 'Asia Actual', 'Asia Diff', 'EU Ideal', 'EU Actual', 'EU Diff', 'Unmet?'],
              comparisonRows
            ),
          ]
          const componentTable = (region: 'us' | 'asia' | 'europe', label: string) => {
            const rows = teams.map((row: unknown) => {
              const data = row.data[region]
              return [
                row.name,
                data.priceScore.toFixed(1),
                data.techScore.toFixed(1),
                data.featuresScore.toFixed(1),
                data.promotionScore.toFixed(1),
                data.trainingScore.toFixed(1),
                data.csrScore.toFixed(1),
              ]
            })
            return [
              `${label} Components`,
              ...renderTable(
                ['Team', 'Price', 'Tech', 'Features', 'Promo', 'Training', 'CSR'],
                rows
              ),
            ]
          }
          const rawInputTable = (region: 'us' | 'asia' | 'europe', label: string) => {
            const rows = teams.map((row: unknown) => {
              const data = row.data[region]
              const decisions = row.data.engineDecision ?? null
              const marketing = decisions?.marketing?.[region] ?? null
              const promo = marketing?.promotionPct ?? 0
              const price = marketing?.price ?? row.data.prices[region] ?? 0
              const hr = decisions?.hr ?? {}
              const usEmployees = hr.us?.employees ?? 0
              const asiaEmployees = hr.asia?.employees ?? 0
              const totalEmployees = usEmployees + asiaEmployees
              const totalTraining = (hr.us?.training ?? 0) + (hr.asia?.training ?? 0)
              const trainingPerStaff = totalEmployees > 0 ? totalTraining / totalEmployees : 0
              // CSR rating comes from supplier tiers, extracted by useReviewData and stored in row.csrRating
              // Also check attractiveness breakdown csrScore (which is rating * 25)
              const csrFromBreakdown = data?.csrScore ? data.csrScore / 25 : 0
              const csr = row.csrRating ?? csrFromBreakdown ?? 0
              const features = row.data.availableFeatures ?? 0
              const tech = row.data.availableTechLevel ?? 0
              return [
                row.name,
                formatCurrencyFull(price),
                `${promo}%`,
                `${features}`,
                `${tech}`,
                csr.toFixed(2),
                formatCurrencyFull(totalTraining),
                formatCurrencyFull(trainingPerStaff),
              ]
            })
            return [
              `${label} Raw Inputs`,
              ...renderTable(
                ['Team', 'Price', 'Promo %', 'Features', 'Tech', 'CSR', 'Training $', 'Train/Staff'],
                rows
              ),
            ]
          }
          const featuresDebugTable = () => {
            const rows = teams.map((row: unknown) => {
              const decisions = row.data.engineDecision ?? null
              const requested = decisions?.marketing?.us?.features ?? decisions?.marketing?.asia?.features ?? decisions?.marketing?.europe?.features ?? 0
              const engineFeatures = row.data.engineState?.rndProgress?.unlockedFeatureCount ?? 0
              const engineTech = row.data.engineState?.rndProgress?.unlockedTechLevel ?? 0
              return [
                row.name,
                `${row.data.availableFeatures ?? 0}`,
                `${engineFeatures}`,
                `${engineTech}`,
                `${requested}`,
              ]
            })
            return [
              'Features Debug (round data)',
              ...renderTable(
                ['Team', 'AvailableFeatures', 'GameStateFeatures', 'GameStateTech', 'RequestedFeatures'],
                rows
              ),
            ]
          }
          const engineAuditInputsTable = (region: 'us' | 'asia' | 'europe', label: string) => {
            const rows = teams.map((row: unknown) => {
              const data = row.data[region]
              const inputs = data?.auditInputs
              if (!inputs) {
                return [row.name, '-', '-', '-', '-', '-', '-']
              }
              return [
                row.name,
                `$${inputs.price}`,
                `${inputs.featureCount}/${inputs.marketedFeatures}`,
                `${inputs.promotionPct}%`,
                inputs.weightedCSRRating.toFixed(2),
                inputs.trainingPerStaff.toFixed(0),
                `${inputs.brandReputation}`,
              ]
            })
            return [
              `${label} Engine Inputs (from calculateAttractivenessBreakdown)`,
              ...renderTable(
                ['Team', 'Price', 'Feat/Mkt', 'Promo%', 'CSR', 'Train/Staff', 'Brand'],
                rows
              ),
            ]
          }
          return [
            '',
            'Attractiveness Summary (computed)',
            ...summaryTable,
            ...comparisonTable,
            '',
            ...componentTable('us', 'US'),
            '',
            ...componentTable('asia', 'Asia'),
            '',
            ...componentTable('europe', 'Europe'),
            '',
            ...rawInputTable('us', 'US'),
            '',
            ...rawInputTable('asia', 'Asia'),
            '',
            ...rawInputTable('europe', 'Europe'),
            '',
            ...featuresDebugTable(),
            '',
            ...engineAuditInputsTable('us', 'US'),
            '',
            ...engineAuditInputsTable('asia', 'Asia'),
            '',
            ...engineAuditInputsTable('europe', 'Europe'),
            '',
          ]
        })()
        : []
      const teamAttractiveness = reviewRoundNumber >= 0 && reviewTeams?.length
        ? [
          '',
          'Attractiveness (stored)',
          '----------------------------------------',
          ...summaryTables,
          ...reviewTeams.flatMap((teamRow: unknown) => {
            const breakdown = teamRow.attractivenessBreakdown
            if (!breakdown) {
              const teamKey = teamRow.teamId ?? teamRow.id ?? teamRow.teamCode ?? teamRow.name
              const computed = computedAttractiveness?.map.get(teamKey)
              if (!computed) {
                return [
                  `Team: ${teamRow.name}`,
                  '  Breakdown unavailable (no decisions)',
                ]
              }
              const totals = computedAttractiveness?.totals ?? { us: 0, asia: 0, europe: 0 }
              const avgPrice = computedAttractiveness?.avgPrice ?? { us: 0, asia: 0, europe: 0 }
              const shareUS = totals.us > 0 ? computed.us.finalScore / totals.us : 0
              const shareAsia = totals.asia > 0 ? computed.asia.finalScore / totals.asia : 0
              const shareEurope = totals.europe > 0 ? computed.europe.finalScore / totals.europe : 0
              return [
                `Team: ${teamRow.name}`,
                `  Avg price (US/Asia/Europe): ${formatCurrencyFull(avgPrice.us)} | ${formatCurrencyFull(avgPrice.asia)} | ${formatCurrencyFull(avgPrice.europe)}`,
                `  Price (US/Asia/Europe): ${formatCurrencyFull(computed.prices.us)} | ${formatCurrencyFull(computed.prices.asia)} | ${formatCurrencyFull(computed.prices.europe)}`,
                `  US score: raw ${computed.us.rawScore.toFixed(1)} * brand ${computed.us.brandBonus.toFixed(2)} * pricePen ${computed.us.pricePenalty.toFixed(2)} = ${computed.us.finalScore.toFixed(1)}`,
                `    price ${computed.us.priceScore.toFixed(1)} | tech ${computed.us.techScore.toFixed(1)} | features ${computed.us.featuresScore.toFixed(1)} | promo ${computed.us.promotionScore.toFixed(1)} | training ${computed.us.trainingScore.toFixed(1)} | csr ${computed.us.csrScore.toFixed(1)}`,
                `    share: ${formatRatio(shareUS)} | units: ${formatUnits(Math.round(auditReviewDemand.us * shareUS))}`,
                `  Asia score: raw ${computed.asia.rawScore.toFixed(1)} * brand ${computed.asia.brandBonus.toFixed(2)} * pricePen ${computed.asia.pricePenalty.toFixed(2)} = ${computed.asia.finalScore.toFixed(1)}`,
                `    price ${computed.asia.priceScore.toFixed(1)} | tech ${computed.asia.techScore.toFixed(1)} | features ${computed.asia.featuresScore.toFixed(1)} | promo ${computed.asia.promotionScore.toFixed(1)} | training ${computed.asia.trainingScore.toFixed(1)} | csr ${computed.asia.csrScore.toFixed(1)}`,
                `    share: ${formatRatio(shareAsia)} | units: ${formatUnits(Math.round(auditReviewDemand.asia * shareAsia))}`,
                `  Europe score: raw ${computed.europe.rawScore.toFixed(1)} * brand ${computed.europe.brandBonus.toFixed(2)} * pricePen ${computed.europe.pricePenalty.toFixed(2)} = ${computed.europe.finalScore.toFixed(1)}`,
                `    price ${computed.europe.priceScore.toFixed(1)} | tech ${computed.europe.techScore.toFixed(1)} | features ${computed.europe.featuresScore.toFixed(1)} | promo ${computed.europe.promotionScore.toFixed(1)} | training ${computed.europe.trainingScore.toFixed(1)} | csr ${computed.europe.csrScore.toFixed(1)}`,
                `    share: ${formatRatio(shareEurope)} | units: ${formatUnits(Math.round(auditReviewDemand.europe * shareEurope))}`,
              ]
            }
            const us = breakdown.us
            const asia = breakdown.asia
            const europe = breakdown.europe
            const usInputs = us.auditInputs
            const asiaInputs = asia.auditInputs
            const europeInputs = europe.auditInputs
            return [
              `Team: ${teamRow.name}`,
              `  US score: ${us.finalScore.toFixed(1)} (raw ${us.rawScore.toFixed(1)} * brand ${us.brandBonus.toFixed(2)} * pricePen ${us.pricePenalty.toFixed(2)})`,
              `    Price ${us.priceScore.toFixed(1)} | Tech ${us.techScore.toFixed(1)} | Features ${us.featuresScore.toFixed(1)} | Promo ${us.promotionScore.toFixed(1)} | Training ${us.trainingScore.toFixed(1)} | CSR ${us.csrScore.toFixed(1)}`,
              ...(usInputs ? [`    [INPUTS] price=$${usInputs.price} features=${usInputs.featureCount}/${usInputs.marketedFeatures} promo=${usInputs.promotionPct}% csr=${usInputs.weightedCSRRating.toFixed(2)} train=${usInputs.trainingPerStaff.toFixed(0)}/staff brand=${usInputs.brandReputation}`] : []),
              `  Asia score: ${asia.finalScore.toFixed(1)} (raw ${asia.rawScore.toFixed(1)} * brand ${asia.brandBonus.toFixed(2)} * pricePen ${asia.pricePenalty.toFixed(2)})`,
              `    Price ${asia.priceScore.toFixed(1)} | Tech ${asia.techScore.toFixed(1)} | Features ${asia.featuresScore.toFixed(1)} | Promo ${asia.promotionScore.toFixed(1)} | Training ${asia.trainingScore.toFixed(1)} | CSR ${asia.csrScore.toFixed(1)}`,
              ...(asiaInputs ? [`    [INPUTS] price=$${asiaInputs.price} features=${asiaInputs.featureCount}/${asiaInputs.marketedFeatures} promo=${asiaInputs.promotionPct}% csr=${asiaInputs.weightedCSRRating.toFixed(2)} train=${asiaInputs.trainingPerStaff.toFixed(0)}/staff brand=${asiaInputs.brandReputation}`] : []),
              `  Europe score: ${europe.finalScore.toFixed(1)} (raw ${europe.rawScore.toFixed(1)} * brand ${europe.brandBonus.toFixed(2)} * pricePen ${europe.pricePenalty.toFixed(2)})`,
              `    Price ${europe.priceScore.toFixed(1)} | Tech ${europe.techScore.toFixed(1)} | Features ${europe.featuresScore.toFixed(1)} | Promo ${europe.promotionScore.toFixed(1)} | Training ${europe.trainingScore.toFixed(1)} | CSR ${europe.csrScore.toFixed(1)}`,
              ...(europeInputs ? [`    [INPUTS] price=$${europeInputs.price} features=${europeInputs.featureCount}/${europeInputs.marketedFeatures} promo=${europeInputs.promotionPct}% csr=${europeInputs.weightedCSRRating.toFixed(2)} train=${europeInputs.trainingPerStaff.toFixed(0)}/staff brand=${europeInputs.brandReputation}`] : []),
            ]
          }),
        ]
        : []
      return joinLines([
        '============================================================',
        `AUDIT: ${reviewLabel}`,
        '============================================================',
        '',
        'GAME CONFIG (source)',
        '----------------------------------------',
        `Industry: ${game?.industry ?? 'Unknown'}`,
        `Capacity per Factory (game): ${formatUnits(game?.capacityPerFactory ?? capacityPerPlant)}`,
        `Demand Multiplier: ${demandMultiplier}`,
        `Region Split: US ${(demandSplit.us * 100).toFixed(1)}% | Asia ${(demandSplit.asia * 100).toFixed(1)}% | Europe ${(demandSplit.europe * 100).toFixed(1)}%`,
        `Scenario Sequence: ${Array.isArray(game?.scenarioSequence) ? game.scenarioSequence.join(', ') : 'n/a'}`,
        '',
        '1. MARKET DEMAND CALCULATION (DB)',
        '----------------------------------------',
        `Capacity per Factory: ${formatUnits(auditCapacityPerPlant)}`,
        `Number of Teams: ${forecastTeamCount}`,
        ...prevDemandLine,
        '',
        ...scenarioSection,
        '',
        'Region Split Ratios:',
        `  US:     ${(demandSplit.us * 100).toFixed(1)}%`,
        `  Asia:   ${(demandSplit.asia * 100).toFixed(1)}%`,
        `  Europe: ${(demandSplit.europe * 100).toFixed(1)}%`,
        '',
        ...baseDemandSection,
        ...trialDemandSection,
        ...formulaDetails,
        '',
        'Market Summary:',
        `  Last round unit sold: ${formatUnits(lastRoundTotalSupply)}`,
        `  Last round production: ${formatUnits(lastRoundTotalProduction)}`,
        `  Total market demand:  ${formatUnits(lastRoundTotalDemand)}`,
        `  ${isShortage ? 'Unmet Demand' : 'Surplus'}:            ${formatUnits(isShortage ? lastRoundUnmetDemand : lastRoundSurplus)}`,
        '',
        'Market Demand (stored):',
        `  US:     ${formatUnits(auditReviewDemand.us)}`,
        `  Asia:   ${formatUnits(auditReviewDemand.asia)}`,
        `  Europe: ${formatUnits(auditReviewDemand.europe)}`,
        `  Total:  ${formatUnits(auditDemandTotal)}`,
        '',
        '2. SALES & MARKET SHARE (DB)',
        '----------------------------------------',
        `Number of Teams: ${forecastTeamCount}`,
        '',
        'Units Sold by Region (stored):',
        `  US:     ${formatUnits(auditUnitsSold.us)} (market share: ${(auditMarketShare.us * 100).toFixed(1)}%)`,
        `  Asia:   ${formatUnits(auditUnitsSold.asia)} (market share: ${(auditMarketShare.asia * 100).toFixed(1)}%)`,
        `  Europe: ${formatUnits(auditUnitsSold.europe)} (market share: ${(auditMarketShare.europe * 100).toFixed(1)}%)`,
        `  Total:  ${formatUnits(auditUnitsSoldTotal)}`,
        '',
        'Market Share Calculation:',
        `  US:     ${formatUnits(auditUnitsSold.us)} / ${formatUnits(auditReviewDemand.us)} = ${(auditReviewDemand.us > 0 ? (auditUnitsSold.us / auditReviewDemand.us) * 100 : 0).toFixed(1)}%`,
        `  Asia:   ${formatUnits(auditUnitsSold.asia)} / ${formatUnits(auditReviewDemand.asia)} = ${(auditReviewDemand.asia > 0 ? (auditUnitsSold.asia / auditReviewDemand.asia) * 100 : 0).toFixed(1)}%`,
        `  Europe: ${formatUnits(auditUnitsSold.europe)} / ${formatUnits(auditReviewDemand.europe)} = ${(auditReviewDemand.europe > 0 ? (auditUnitsSold.europe / auditReviewDemand.europe) * 100 : 0).toFixed(1)}%`,
        ...teamAttractiveness,
        '',
        'SUPPLY-DEMAND BALANCE (stored):',
        '----------------------------------------',
        `Market Demand (US/Asia/Europe): ${formatUnitsDetailed(auditReviewDemand.us)} | ${formatUnitsDetailed(auditReviewDemand.asia)} | ${formatUnitsDetailed(auditReviewDemand.europe)}`,
        `Market Demand (total): ${formatUnitsDetailed(auditDemandTotal)}`,
        `Units Sold (US/Asia/Europe): ${formatUnitsDetailed(auditUnitsSold.us)} | ${formatUnitsDetailed(auditUnitsSold.asia)} | ${formatUnitsDetailed(auditUnitsSold.europe)}`,
        `Units Sold (total): ${formatUnitsDetailed(auditUnitsSoldTotal)}`,
        `Ending Inventory (US/Asia/Europe): ${formatUnitsDetailed(auditEndingInventoryByRegion.us)} | ${formatUnitsDetailed(auditEndingInventoryByRegion.asia)} | ${formatUnitsDetailed(auditEndingInventoryByRegion.europe)}`,
        `Ending Inventory (total): ${formatUnitsDetailed(auditEndingInventoryUnits)}`,
        '',
        'SUPPLY-DEMAND BALANCE (all teams):',
        '----------------------------------------',
        ...(allTeamsRows.length > 0
          ? [
            `Market Demand (US/Asia/Europe): ${formatUnitsDetailed(auditReviewDemand.us)} | ${formatUnitsDetailed(auditReviewDemand.asia)} | ${formatUnitsDetailed(auditReviewDemand.europe)}`,
            `Market Demand (total): ${formatUnitsDetailed(auditDemandTotal)}`,
            `Beginning Inventory (US/Asia/Europe): ${formatUnitsDetailed(allTeamsSupplyTotals.startInv.us)} | ${formatUnitsDetailed(allTeamsSupplyTotals.startInv.asia)} | ${formatUnitsDetailed(allTeamsSupplyTotals.startInv.europe)}`,
            `Beginning Inventory (total): ${formatUnitsDetailed(allTeamsStartInvTotal)}`,
            `Total Production (all teams): ${formatUnitsDetailed(allTeamsSupplyTotals.production)}`,
            `Units Sold (US/Asia/Europe): ${formatUnitsDetailed(allTeamsSupplyTotals.sold.us)} | ${formatUnitsDetailed(allTeamsSupplyTotals.sold.asia)} | ${formatUnitsDetailed(allTeamsSupplyTotals.sold.europe)}`,
            `Units Sold (total): ${formatUnitsDetailed(allTeamsSoldTotal)}`,
            `Ending Inventory (US/Asia/Europe): ${formatUnitsDetailed(allTeamsSupplyTotals.inv.us)} | ${formatUnitsDetailed(allTeamsSupplyTotals.inv.asia)} | ${formatUnitsDetailed(allTeamsSupplyTotals.inv.europe)}`,
            `Ending Inventory (total, end-of-round carryover): ${formatUnitsDetailed(allTeamsInvTotal)}`,
          ]
          : ['No team totals available for this round.']),
        '',
        '3. SUPPLY & INVENTORY (stored)',
        '----------------------------------------',
        `Production (US/Asia/Europe): ${formatUnitsDetailed(prevRoundData?.productionUS ?? 0)} | ${formatUnitsDetailed(prevRoundData?.productionAsia ?? 0)} | ${formatUnitsDetailed(0)}`,
        `Units Sold (US/Asia/Europe): ${formatUnitsDetailed(auditUnitsSold.us)} | ${formatUnitsDetailed(auditUnitsSold.asia)} | ${formatUnitsDetailed(auditUnitsSold.europe)}`,
        `Units Sold (total): ${formatUnitsDetailed(auditUnitsSoldTotal)}`,
        `Beginning Inventory (US/Asia/Europe): ${formatUnitsDetailed(auditStartingInventoryByRegion.us)} | ${formatUnitsDetailed(auditStartingInventoryByRegion.asia)} | ${formatUnitsDetailed(auditStartingInventoryByRegion.europe)}`,
        `Ending Inventory (US/Asia/Europe): ${formatUnitsDetailed(auditEndingInventoryByRegion.us)} | ${formatUnitsDetailed(auditEndingInventoryByRegion.asia)} | ${formatUnitsDetailed(auditEndingInventoryByRegion.europe)}`,
        `Beginning Inventory (total): ${formatUnitsDetailed(auditStartingInventoryUnits)}`,
        `Ending Inventory (total): ${formatUnitsDetailed(auditEndingInventoryUnits)}`,
        `Inventory Value (stored): ${formatCurrency(displayInventoryValue)}`,
        '',
        '4. PROFIT & LOSS (DB)',
        '----------------------------------------',
        'REVENUE:',
        '  Formula check: Units Sold x Price per unit',
        `  US:     ${formatUnits(auditUnitsSold.us)} x ${formatCurrencyFull(auditPrices.us)} = ${formatCurrency(auditRevenueCalc.us)}`,
        `  Asia:   ${formatUnits(auditUnitsSold.asia)} x ${formatCurrencyFull(auditPrices.asia)} = ${formatCurrency(auditRevenueCalc.asia)}`,
        `  Europe: ${formatUnits(auditUnitsSold.europe)} x ${formatCurrencyFull(auditPrices.europe)} = ${formatCurrency(auditRevenueCalc.europe)}`,
        `  Total Revenue (stored): ${formatCurrency(auditRevenueTotal)}`,
        '',
        'COGS:',
        `  Manufacturing COGS (stored): ${formatCurrency(auditManufacturingCogs)} = ${formatCurrency(auditMaterialCost)} + ${formatCurrency(auditLaborCost)}`,
        `  Logistics COGS (stored): ${formatCurrency(auditLogisticsCost)}`,
        `  Outsourcing COGS (stored): ${formatCurrency(auditOutsourcingCost)}`,
        `  Total COGS (stored): ${formatCurrency(auditTotalCogs)}`,
        `  Unit Cost (stored): ${formatCurrencyFull(auditUnitCost)}`,
        '',
        `GROSS PROFIT (stored): ${formatCurrency(auditGrossProfit)} (margin: ${auditRevenueTotal > 0 ? ((auditGrossProfit / auditRevenueTotal) * 100).toFixed(1) : '0.0'}%)`,
        '',
        'OPERATING EXPENSES (stored):',
        `  Marketing/Promo: ${formatCurrency(auditPromoSpend)}`,
        `  R&D:             ${formatCurrency(auditRndCost)}`,
        `  Admin (SG&A):    ${formatCurrency(auditAdminCost)}`,
        `  Inventory Hold:  ${formatCurrency(auditInventoryHoldingStored)} (calc: ${formatCurrency(auditInventoryHoldingCost)})`,
        `  Depreciation:    ${formatCurrency(auditDepreciation)}`,
        `  Total OpEx:      ${formatCurrency(auditOperatingExpenses)}`,
        '',
        'INTEREST & TAX (stored):',
        `  Interest Expense: ${formatCurrency(auditInterest)} (Rate: ${(auditInterestRate * 100).toFixed(2)}%)`,
        `  Tax base rate:     ${formatRateValue(GAME_CONFIG.financial.taxRate)}`,
        `  Tax delta:         US ${formatRateValue(auditTaxDelta.us ?? 0)} | Asia ${formatRateValue(auditTaxDelta.asia ?? 0)} | Europe ${formatRateValue(auditTaxDelta.europe ?? 0)}`,
        `  Profit Before Tax: ${formatCurrency(auditProfitBeforeTax)}`,
        `  Tax Loss CF (start): ${formatCurrency(auditTaxLossCarryforwardStart)}`,
        `  Taxable Income:    ${formatCurrency(auditTaxableIncome)}`,
        `  Tax:              ${formatCurrency(auditTax)} (Rate: ${(auditTaxRate * 100).toFixed(2)}%)`,
        `  Tax Loss CF (end): ${formatCurrency(auditTaxLossCarryforwardEnd)}`,
        '',
        `NET PROFIT (stored): ${formatCurrency(auditNetProfit)} (margin: ${auditRevenueTotal > 0 ? ((auditNetProfit / auditRevenueTotal) * 100).toFixed(1) : '0.0'}%)`,
        '',
        '6. BALANCE SHEET (DB)',
        '----------------------------------------',
        'ASSETS:',
        `  Cash:         ${formatCurrency(displayCash)}`,
        `  Inventory:    ${formatCurrency(displayInventoryValue)}`,
        `  Fixed Assets: ${formatCurrency(displayFixedAssets)}`,
        `  Total Assets: ${formatCurrency(displayTotalAssets)}`,
        '',
        'LIABILITIES & EQUITY:',
        `  Long-term Debt:     ${formatCurrency(displayDebt)}`,
        `  Share Capital:      ${formatCurrency(displayShareCapital)}`,
        `  Retained Earnings:  ${formatCurrency(displayRetainedEarnings)}`,
        `  Total Equity:       ${formatCurrency(displayTotalEquity)}`,
        '',
        `Balance Check: ${formatCurrency(displayTotalAssets)} = ${formatCurrency(displayTotalLiabilities + displayTotalEquity)} ✓`,
        '',
        'DEBUG: Data Sources',
        `  Review Round: ${reviewRoundNumber} | Prior Round for BS: ${priorRoundNumber}`,
        `  priorRoundEntry found: ${priorRoundEntry ? '[[OK]]' : '[[MISMATCH]]'} (roundNumber=${priorRoundEntry?.roundNumber ?? 'N/A'})`,
        `  priorTeamEntry found: ${priorTeamEntry ? '[[OK]]' : '[[MISMATCH]]'} (teamId=${priorTeamEntry?.teamId ?? 'N/A'})`,
        `  priorEngineBS found: ${priorEngineBS ? '[[OK]]' : '[[MISMATCH]]'}`,
        `  currentEngineBS found: ${currentEngineBS ? '[[OK]]' : '[[MISMATCH]]'}`,
        priorEngineBS ? `  Prior BS values: cash=${formatCurrency(priorEngineBS.cash)} debt=${formatCurrency(priorEngineBS.longTermDebt)} RE=${formatCurrency(priorEngineBS.retainedEarnings)} SC=${formatCurrency(priorEngineBS.shareCapital)}` : '  Prior BS: N/A',
        currentEngineBS ? `  Current BS values: cash=${formatCurrency(currentEngineBS.cash)} debt=${formatCurrency(currentEngineBS.longTermDebt)} RE=${formatCurrency(currentEngineBS.retainedEarnings)} SC=${formatCurrency(currentEngineBS.shareCapital)}` : '  Current BS: N/A',
        '',
        'Balance Sheet Check (engine):',
        reconcileLine('Long-term Debt', priorDebt, expectedDebtDelta, currentEngineDebt),
        reconcileLine('Share Capital', priorShareCapital, expectedShareCapitalDelta, currentEngineShareCapital),
        reconcileLine('Retained Earnings', priorRetained, expectedRetainedEngineDelta, currentEngineRetained),
        `  RE formula: prior ${formatCurrency(priorRetained ?? 0)} + net profit ${formatCurrency(auditNetProfit)} - dividends ${formatCurrency(financeDividend)} = ${formatCurrency((priorRetained ?? 0) + expectedRetainedEngineDelta)}`,
        reconcileLine('Fixed Assets', priorFixedAssets, expectedFixedAssetsEngineDeltaDetailed, currentEngineFixedAssets),
        `  Fixed assets formula: prior ${formatCurrency(priorFixedAssets ?? 0)} - depreciation ${formatCurrency(auditDepreciation)} + capex ${formatCurrency(capexUsed)} = ${formatCurrency((priorFixedAssets ?? 0) + expectedFixedAssetsEngineDeltaDetailed)}`,
        operatingCashFlow !== null
          ? reconcileLine('Cash', priorCash, expectedCashEngineDeltaDetailed ?? 0, currentEngineCash)
          : '  Cash: n/a (missing prior inventory/receivables/payables)',
        operatingCashFlow !== null
          ? `  Cash formula: prior ${formatCurrency(priorCash ?? 0)} + OCF ${formatCurrency(operatingCashFlow ?? 0)} + debt/share ${formatCurrency(legacyDebtDelta + legacyShareDelta)} - dividends ${formatCurrency(financeDividend)} - capex ${formatCurrency(capexUsed)} - STΔ ${formatCurrency(priorShortTermLoans - currentShortTermLoans)} = ${formatCurrency((priorCash ?? 0) + (expectedCashEngineDeltaDetailed ?? 0))}`
          : '',
        operatingCashFlow !== null
          ? `  OCF breakdown: net profit ${formatCurrency(auditNetProfit)} + depreciation ${formatCurrency(auditDepreciation)} - ΔInv ${formatCurrency(currentEngineInventory - (priorInventoryValue ?? 0))} - ΔAR ${formatCurrency(currentEngineReceivables - (priorReceivables ?? 0))} + ΔAP ${formatCurrency(currentEnginePayables - (priorPayables ?? 0))}`
          : '',
        '',
        '============================================================',
        'END OF AUDIT',
        '============================================================',
      ])
    }

    if (activeStep.id === 'forecast') {
      const scenarioData = scenarioForRound(currentRound)

      // Use exact engine logic for growth calculation
      const growth = getScenarioGrowthRateForRound(currentRound, game?.scenarioSequence ?? [0], GAME_CONFIG)

      // Round 1 resets to Base Demand (ignores Round 0)
      const isRound1 = currentRound === 1
      // const totalBaseDemand = GAME_CONFIG.capacityPerPlant * 1 * forecastTeamCount
      // const split = game?.regionDemandSplit ?? GAME_CONFIG.marketDemandConfig.defaultRegionSplit
      // Calculate Round -1 (Starting Position) sales for reference
      const roundMinus1Calc = calculateRoundMinus1(forecastTeamCount, GAME_CONFIG, game?.scenarioSequence ?? [0], game?.marketDemandMultiplier ?? 1, game?.regionDemandSplit)

      // Get DB Reference for Round -1 (Actual Persisted)
      const rMinus1DB = fetchedResults.find(r => r.roundNumber === -1)
      const rMinus1DBDemand = rMinus1DB?.marketDemand

      // Calculate actual sold units from previous round (DB)
      const prevRoundNum = currentRound - 1
      const prevRoundResults = fetchedResults.find(r => r.roundNumber === prevRoundNum)
      const prevTotalSold = prevRoundResults?.teams?.reduce((sum: number, t: unknown) => sum + (t.sales?.total?.units ?? 0), 0) ?? 0

      // User Rule: Round 1 (and Trial) should start from Round -1 Sales (Starting Position)
      // Prefer DB value if available to ensure alignment with Review step
      const startDemand = isRound1 ? (rMinus1DBDemand ?? roundMinus1Calc.marketDemand) : previousRoundDemand
      const startLabel = isRound1 ? '(Base)' : '(Previous)'

      const rMinus1Total = rMinus1DBDemand?.total ?? (rMinus1DBDemand ? (rMinus1DBDemand.us + rMinus1DBDemand.asia + rMinus1DBDemand.europe) : roundMinus1Calc.marketDemand.total)
      const rMinus1Label = rMinus1DBDemand ? '(DB)' : '(Calc Base/1.1)'

      const baseContext = isRound1
        ? [
          `  [Ref] Round -1 Total Sold (Starting): ${formatUnits(rMinus1Total)} ${rMinus1Label}`,
          `    Breakdown: ${formatUnits(startDemand.us)} + ${formatUnits(startDemand.asia)} + ${formatUnits(startDemand.europe)} = ${formatUnits(startDemand.us + startDemand.asia + startDemand.europe)}`,
          prevTotalSold > 0 ? `  [Ref] Round ${prevRoundNum} Total Sold (DB): ${formatUnits(prevTotalSold)}` : null,
          ''
        ]
        : []

      return joinLines([
        'AUDIT: Forecast',
        '',
        'Scenario timeline',
        '----------------------------------------',
        scenarioTimeline.join('\n'),
        '',
        'This round calculation',
        '----------------------------------------',
        ...baseContext,
        `Demand multiplier (Scenario Growth Amplifier): ${formatMultiplier(demandMultiplier)}`,
        `US demand = ${formatUnits(startDemand.us)} ${startLabel} * (1 + (${growth.us.toFixed(2)} * ${demandMultiplier}) / 100) = ${formatUnits(currentRoundDemand.us)}`,
        `Asia demand = ${formatUnits(startDemand.asia)} ${startLabel} * (1 + (${growth.asia.toFixed(2)} * ${demandMultiplier}) / 100) = ${formatUnits(currentRoundDemand.asia)}`,
        `Europe demand = ${formatUnits(startDemand.europe)} ${startLabel} * (1 + (${growth.europe.toFixed(2)} * ${demandMultiplier}) / 100) = ${formatUnits(currentRoundDemand.europe)}`,
        `Total demand: ${formatUnits(currentRoundDemand.total ?? (currentRoundDemand.us + currentRoundDemand.asia + currentRoundDemand.europe))}`,
        '',
        `Interest rate = ${formatRateValue(GAME_CONFIG.financial.interestRate)} + ${formatRateValue(scenarioData?.interestRateSpread ?? 0)} = ${formatRateValue((GAME_CONFIG.financial.interestRate ?? 0) + (scenarioData?.interestRateSpread ?? 0))}`,
        `Tax rate (US) = ${formatRateValue(GAME_CONFIG.financial.taxRate)} + ${formatRateValue(scenarioData?.taxRateDeltaByRegion?.us ?? 0)} = ${formatRateValue((GAME_CONFIG.financial.taxRate ?? 0) + (scenarioData?.taxRateDeltaByRegion?.us ?? 0))}`,
        `Price elasticity = ${GAME_CONFIG.priceDemand.elasticityByRegion.us.toFixed(2)} * ${(scenarioData?.priceElasticityModifier ?? 1).toFixed(2)}`,
        `Marketing effect = 1.00 * ${(scenarioData?.marketingEffectModifier ?? 1).toFixed(2)}`,
        `CSR importance = 1.00 * ${(scenarioData?.csrImportanceModifier ?? 1).toFixed(2)}`,
      ])
    }

    if (activeStep.id === 'production') {
      // Calculate sales and inventory data
      const lastRoundSalesUS = reviewUnitsSold.us
      const lastRoundSalesAsia = reviewUnitsSold.asia
      const lastRoundSalesEurope = reviewUnitsSold.europe
      const lastRoundSalesTotal = lastRoundSalesUS + lastRoundSalesAsia + lastRoundSalesEurope

      const lastRoundInventoryUS = reviewInventoryUS
      const lastRoundInventoryAsia = reviewInventoryAsia
      const lastRoundInventoryTotal = reviewInventoryTotal

      const thisRoundSalesUS = forecastProjected.us
      const thisRoundSalesAsia = forecastProjected.asia
      const thisRoundSalesEurope = forecastProjected.europe
      const thisRoundSalesTotal = thisRoundSalesUS + thisRoundSalesAsia + thisRoundSalesEurope

      const totalInventoryUS = lastRoundInventoryUS + prodPlanned.us + prodPlanned.outUS - thisRoundSalesUS
      const totalInventoryAsia = lastRoundInventoryAsia + prodPlanned.asia + prodPlanned.outAsia - thisRoundSalesAsia
      const totalInventoryTotal = totalInventoryUS + totalInventoryAsia

      const marketDemandUS = forecastMarketDemand.us
      const marketDemandAsia = forecastMarketDemand.asia
      const marketDemandEurope = forecastMarketDemand.europe
      const marketDemandTotal = marketDemandUS + marketDemandAsia + marketDemandEurope

      const unmetDemandUS = Math.max(0, marketDemandUS - thisRoundSalesUS)
      const unmetDemandAsia = Math.max(0, marketDemandAsia - thisRoundSalesAsia)
      const unmetDemandEurope = Math.max(0, marketDemandEurope - thisRoundSalesEurope)
      const unmetDemandTotal = unmetDemandUS + unmetDemandAsia + unmetDemandEurope

      // Get last round factory investments from previous round decision
      const lastRoundInvestmentUS = prevRoundDecision?.investment?.newPlantsUS ?? prevRoundDecision?.finance?.newPlantsUS ?? 0
      const lastRoundInvestmentAsia = prevRoundDecision?.investment?.newPlantsAsia ?? prevRoundDecision?.finance?.newPlantsAsia ?? 0
      const lastRoundLabel = currentRound > 0 ? `Round ${currentRound - 1}` : 'N/A'
      const availableThisRound = currentRound > 0 ? `(should be available in Round ${currentRound})` : ''

      // Get actual factory counts from game state (from database)
      const actualFactoriesUS = prevRoundData?.factoriesUS ?? GAME_CONFIG.initialFactories.us
      const actualFactoriesAsia = prevRoundData?.factoriesAsia ?? GAME_CONFIG.initialFactories.asia
      const displayedFactoriesUS = costCapacity.usFactoryCount
      const displayedFactoriesAsia = costCapacity.asiaFactoryCount

      return joinLines([
        'AUDIT: Production',
        '',
        '========================================',
        '🏭 FACTORY COUNT DEBUG',
        '========================================',
        `Current Round: ${currentRound}`,
        `Actual Factories (from game state DB):`,
        `  US:   ${actualFactoriesUS}`,
        `  Asia: ${actualFactoriesAsia}`,
        `Displayed Factories (in UI):`,
        `  US:   ${displayedFactoriesUS} ${actualFactoriesUS !== displayedFactoriesUS ? '⚠️ MISMATCH!' : '✅'}`,
        `  Asia: ${displayedFactoriesAsia} ${actualFactoriesAsia !== displayedFactoriesAsia ? '⚠️ MISMATCH!' : '✅'}`,
        '',
        'Inputs',
        '----------------------------------------',
        `Overtime (shift): ${costOvertimePct}%`,
        `Supplier US: ${costDecisions.production?.supplierUS ?? GAME_CONFIG.defaults.production.supplierUS ?? 1}`,
        `Supplier Asia: ${costDecisions.production?.supplierAsia ?? GAME_CONFIG.defaults.production.supplierAsia ?? 1}`,
        `In-house units: US ${formatUnits(prodPlanned.us)} | Asia ${formatUnits(prodPlanned.asia)}`,
        `Outsource units: US ${formatUnits(prodPlanned.outUS)} | Asia ${formatUnits(prodPlanned.outAsia)}`,
        '',
        'Capacity and utilization',
        '----------------------------------------',
        `Factories: US ${costCapacity.usFactoryCount} | Asia ${costCapacity.asiaFactoryCount}`,
        `Total capacity = (${costCapacity.usFactoryCount} + ${costCapacity.asiaFactoryCount}) * ${formatUnits(capacityPerPlant)} = ${formatUnits(costCapacity.totalFactoryCapacity)}`,
        `Max capacity (with overtime) = ${formatUnits(costMaxCapacity)}`,
        `Utilization u = ${formatUnits(costCapacity.totalFactoryCapacity)} / ${formatUnits(costMaxCapacity)} = ${(costUtilization * 100).toFixed(1)}%`,
        '',
        'In-house unit cost (engine)',
        '----------------------------------------',
        `Material unit cost = ${weightedMaterialCost.toFixed(2)} * ${weightedSupplierMultiplier.toFixed(3)} = ${baseMaterialUnitCost.toFixed(2)}`,
        `Overtime labor premium = 1 + (${costOvertimePct.toFixed(1)}% * ${(overtimeLaborPremiumPct / 100).toFixed(2)}) = ${overtimeLaborPremium.toFixed(3)}x`,
        `Labor unit cost = ${weightedLabourCost.toFixed(2)} * ${weightedSupplierMultiplier.toFixed(3)} * ${overtimeLaborPremium.toFixed(3)} = ${baseLabourUnitCost.toFixed(2)}`,
        `Base unit cost = ${baseManufacturingUnitCost.toFixed(2)}`,
        `Cost multiplier = 1 + ${costCurve.curvature.toFixed(2)} * (u - ${costCurve.optimalUtilization.toFixed(2)})^2 = ${costMultiplier.toFixed(3)}`,
        `Unit cost before scenario = ${baseManufacturingUnitCost.toFixed(2)} * ${costMultiplier.toFixed(3)} = ${unitCostBeforeScenario.toFixed(2)}`,
        `Scenario cost inflation = ${formatMultiplier(currentCostInflation)}`,
        `Final in-house unit cost = ${unitCostBeforeScenario.toFixed(2)} * ${currentCostInflation.toFixed(2)} = ${unitCostAfterScenario.toFixed(2)}`,
        '',
        'Outsource unit cost',
        '----------------------------------------',
        `Base outsource cost = ${formatCurrencyFull(outsourceUnitCost)}`,
        `Scenario cost inflation = ${formatMultiplier(currentCostInflation)}`,
        `Final outsource cost = ${formatCurrencyFull(outsourceUnitCost)} * ${currentCostInflation.toFixed(2)} = ${formatCurrencyFull(outsourceUnitCostInflated)}`,
        '',
        'Total production cost',
        '----------------------------------------',
        `In-house cost = ${formatUnits(prodInHouseUnits)} * ${formatCurrencyFull(unitCostAfterScenario)} = ${formatCurrency(prodInHouseUnits * unitCostAfterScenario)}`,
        `Outsource cost = ${formatUnits(prodOutsourceUnits)} * ${formatCurrencyFull(outsourceUnitCostInflated)} = ${formatCurrency(prodOutsourceUnits * outsourceUnitCostInflated)}`,
        `Total = ${formatCurrency((prodInHouseUnits * unitCostAfterScenario) + (prodOutsourceUnits * outsourceUnitCostInflated))}`,
        '',
        '========================================',
        'LAST ROUND FACTORY INVESTMENT',
        '========================================',
        currentRound > 0 ? `Ordered in ${lastRoundLabel}:` : 'No previous round',
        currentRound > 0 ? `  US Factories:   +${lastRoundInvestmentUS} ${availableThisRound}` : '  N/A',
        currentRound > 0 ? `  Asia Factories: +${lastRoundInvestmentAsia} ${availableThisRound}` : '  N/A',
        currentRound > 0 && (lastRoundInvestmentUS > 0 || lastRoundInvestmentAsia > 0)
          ? `  ⚠️ Investment lag: Factories ordered in ${lastRoundLabel} become available in Round ${currentRound}`
          : '',
        '',
        '========================================',
        'SALES & INVENTORY TRACKING',
        '========================================',
        '',
        'LAST ROUND SALES (from database)',
        '----------------------------------------',
        `US:     ${formatUnits(lastRoundSalesUS)}`,
        `Asia:   ${formatUnits(lastRoundSalesAsia)}`,
        `Europe: ${formatUnits(lastRoundSalesEurope)}`,
        `TOTAL:  ${formatUnits(lastRoundSalesTotal)}`,
        '',
        'LAST ROUND INVENTORY CARRYOVER',
        '----------------------------------------',
        `US:     ${formatUnits(lastRoundInventoryUS)}`,
        `Asia:   ${formatUnits(lastRoundInventoryAsia)}`,
        `TOTAL:  ${formatUnits(lastRoundInventoryTotal)}`,
        '',
        'THIS ROUND PROJECTED SALES (forecast)',
        '----------------------------------------',
        `US:     ${formatUnits(thisRoundSalesUS)}`,
        `Asia:   ${formatUnits(thisRoundSalesAsia)}`,
        `Europe: ${formatUnits(thisRoundSalesEurope)}`,
        `TOTAL:  ${formatUnits(thisRoundSalesTotal)}`,
        '',
        'PROJECTED INVENTORY LEFT (after this round)',
        '----------------------------------------',
        `US:     ${formatUnits(Math.max(0, totalInventoryUS))} (carryover ${formatUnits(lastRoundInventoryUS)} + production ${formatUnits(prodPlanned.us + prodPlanned.outUS)} - sales ${formatUnits(thisRoundSalesUS)})`,
        `Asia:   ${formatUnits(Math.max(0, totalInventoryAsia))} (carryover ${formatUnits(lastRoundInventoryAsia)} + production ${formatUnits(prodPlanned.asia + prodPlanned.outAsia)} - sales ${formatUnits(thisRoundSalesAsia)})`,
        `TOTAL:  ${formatUnits(Math.max(0, totalInventoryTotal))}`,
        '',
        'TOTAL MARKET DEMAND (this round)',
        '----------------------------------------',
        `US:     ${formatUnits(marketDemandUS)}`,
        `Asia:   ${formatUnits(marketDemandAsia)}`,
        `Europe: ${formatUnits(marketDemandEurope)}`,
        `TOTAL:  ${formatUnits(marketDemandTotal)}`,
        '',
        'UNMET DEMAND (market - your forecast)',
        '----------------------------------------',
        `US:     ${formatUnits(unmetDemandUS)} (${marketDemandUS > 0 ? ((unmetDemandUS / marketDemandUS) * 100).toFixed(1) : '0.0'}% of market)`,
        `Asia:   ${formatUnits(unmetDemandAsia)} (${marketDemandAsia > 0 ? ((unmetDemandAsia / marketDemandAsia) * 100).toFixed(1) : '0.0'}% of market)`,
        `Europe: ${formatUnits(unmetDemandEurope)} (${marketDemandEurope > 0 ? ((unmetDemandEurope / marketDemandEurope) * 100).toFixed(1) : '0.0'}% of market)`,
        `TOTAL:  ${formatUnits(unmetDemandTotal)} (${marketDemandTotal > 0 ? ((unmetDemandTotal / marketDemandTotal) * 100).toFixed(1) : '0.0'}% of market)`,
      ])
    }

    if (activeStep.id === 'logistics') {
      // Build scenario tariff modifier display
      const scenarioModifierList = scenario?.logisticsTariff ? Object.entries(scenario.logisticsTariff).map(([k, v]) => {
        const modifier = v as number
        const sign = modifier >= 0 ? '+' : ''
        return `  ${k}: ${sign}${(modifier * 100).toFixed(0)}%`
      }) : []

      // Helper to show tariff breakdown with modifier formula: base * (1 + modifier)
      const formatTariffLine = (route: string, units: number, baseTariff: number, modifier: number | undefined, finalTariff: number) => {
        if (units === 0) return `  ${route}: 0 units (skipped)`
        const mod = modifier || 0
        const hasModifier = mod !== 0
        const sign = mod >= 0 ? '+' : ''
        const tariffExplain = hasModifier
          ? `$${baseTariff.toFixed(2)} * (1${sign}${(mod * 100).toFixed(0)}%) = $${finalTariff.toFixed(2)}`
          : `$${baseTariff.toFixed(2)}`
        return `  ${route}: ${formatUnits(units)} * ${tariffExplain} = ${formatCurrency(units * finalTariff)}`
      }

      return joinLines([
        'AUDIT: Logistics',
        '',
        'Scenario settings',
        '----------------------------------------',
        `Scenario inflation: ${formatMultiplier(currentCostInflation)}`,
        `Scenario tariff modifiers:`,
        ...(scenarioModifierList.length > 0 ? scenarioModifierList : ['  None (using base tariffs)']),
        '',
        'Last round',
        '----------------------------------------',
        `Production (US/Asia): ${formatUnits(prevRoundData?.productionUS ?? 0)} | ${formatUnits(prevRoundData?.productionAsia ?? 0)}`,
        `Demand (US/Asia/Europe): ${formatUnits(auditReviewDemand.us)} | ${formatUnits(auditReviewDemand.asia)} | ${formatUnits(auditReviewDemand.europe)}`,
        `Units sold (US/Asia/Europe): ${formatUnits(reviewUnitsSold.us)} | ${formatUnits(reviewUnitsSold.asia)} | ${formatUnits(reviewUnitsSold.europe)}`,
        `Inventory (US/Asia): ${formatUnits(reviewInventoryUS)} | ${formatUnits(reviewInventoryAsia)}`,
        `Logistics cost (last round): ${formatCurrency(prevRoundData?.logistics || prevRoundData?.costs?.logistics || prevRoundData?.logisticsCost || 0)}`,
        '',
        'Base tariffs (from config)',
        '----------------------------------------',
        `  US->Asia:    $${gameConfig.logisticsTariff.usToAsia.toFixed(2)}/unit`,
        `  US->Europe:  $${gameConfig.logisticsTariff.usToEurope.toFixed(2)}/unit`,
        `  Asia->US:    $${gameConfig.logisticsTariff.asiaToUs.toFixed(2)}/unit`,
        `  Asia->Europe:$${gameConfig.logisticsTariff.asiaToEurope.toFixed(2)}/unit`,
        '',
        'This round forecast',
        '----------------------------------------',
        `Planned production (US/Asia): ${formatUnits(prodPlanned.us)} | ${formatUnits(prodPlanned.asia)}`,
        `Forecast demand (US/Asia/Europe): ${formatUnits(forecastProjected.us)} | ${formatUnits(forecastProjected.asia)} | ${formatUnits(forecastProjected.europe)}`,
        `Allocation (US): local ${formatUnits(logisticsAllocation.us.local)} | import ${formatUnits(logisticsAllocation.us.fromAsia)}`,
        `Allocation (Asia): local ${formatUnits(logisticsAllocation.asia.local)} | import ${formatUnits(logisticsAllocation.asia.fromUS)}`,
        `Allocation (Europe): from US ${formatUnits(logisticsAllocation.europe.fromUS)} | from Asia ${formatUnits(logisticsAllocation.europe.fromAsia)}`,
        '',
        'Logistics cost breakdown (base * (1 + modifier))',
        '----------------------------------------',
        formatTariffLine('US->Asia', logisticsAllocation.asia.fromUS, gameConfig.logisticsTariff.usToAsia, scenarioTariffModifiers.usToAsia, logisticsTariffs.usToAsia),
        formatTariffLine('US->Europe', logisticsAllocation.europe.fromUS, gameConfig.logisticsTariff.usToEurope, scenarioTariffModifiers.usToEurope, logisticsTariffs.usToEurope),
        formatTariffLine('Asia->US', logisticsAllocation.us.fromAsia, gameConfig.logisticsTariff.asiaToUs, scenarioTariffModifiers.asiaToUs, logisticsTariffs.asiaToUs),
        formatTariffLine('Asia->Europe', logisticsAllocation.europe.fromAsia, gameConfig.logisticsTariff.asiaToEurope, scenarioTariffModifiers.asiaToEurope, logisticsTariffs.asiaToEurope),
        `Base logistics cost = ${formatCurrency(logisticsCostBase)}`,
        `Scenario cost inflation = ${formatMultiplier(currentCostInflation)}`,
        `Final logistics cost = ${formatCurrency(logisticsCostBase)} * ${currentCostInflation.toFixed(2)} = ${formatCurrency(logisticsCostInflated)}`,
      ])
    }

    if (activeStep.id === 'rnd') {
      return joinLines([
        'AUDIT: R&D',
        '',
        `Scenario cost inflation (this round): ${formatMultiplier(currentCostInflation)}`,
        '',
        'Last round',
        '----------------------------------------',
        `Scenario cost inflation (last round): ${formatMultiplier(reviewCostInflation)}`,
        `Staff: ${lastRndStaff} | Training: ${lastRndTraining}`,
        `Training cost = ${lastRndStaff} * ${formatCurrencyFull(lastRndTrainingCostPerStaff)} * ${formatMultiplier(reviewCostInflation)} = ${formatCurrency(lastRndTrainingCost)}`,
        `Staff cost = ${lastRndStaff} * ${formatCurrencyFull(defaults.hr.us.wage * 12)} * ${formatMultiplier(reviewCostInflation)} = ${formatCurrency(lastRndStaffCost)}`,
        `Features unlocked: ${lastRndUnlocked}`,
        `Total cost = ${formatCurrency(lastRndTrainingCost)} + ${formatCurrency(lastRndStaffCost)} = ${formatCurrency(lastRndTotalSpend)}`,
        '',
        'This round',
        '----------------------------------------',
        `Staff: ${rndStaff} | Training: ${rndTraining}`,
        `Training cost = ${rndStaff} * ${formatCurrencyFull(trainingCostPerStaff)} * ${formatMultiplier(currentCostInflation)} = ${formatCurrency(totalTrainingCost * currentCostInflation)}`,
        `Staff cost = ${rndStaff} * ${formatCurrencyFull(staffSalary)} * ${formatMultiplier(currentCostInflation)} = ${formatCurrency(totalStaffCost * currentCostInflation)}`,
        `Features unlocking this round: ${featuresUnlockingThisRound}`,
        `Total active features: ${thisRndUnlocked}`,
        `Total cost = ${formatCurrency(totalTrainingCost * currentCostInflation)} + ${formatCurrency(totalStaffCost * currentCostInflation)} = ${formatCurrency(rndTotalSpend * currentCostInflation)}`,
      ])
    }

    if (activeStep.id === 'marketing') {
      const basePrice = GAME_CONFIG.priceDemand.baselinePriceByRegion
      const elasticity = GAME_CONFIG.priceDemand.elasticityByRegion
      const elasticityModifier = forecastEffects?.priceElasticityModifier ?? 1
      return joinLines([
        'AUDIT: Marketing',
        '',
        'Last round',
        '----------------------------------------',
        `Price (US/Asia/Europe): ${formatCurrencyFull(lastMarketingPrices.us)} | ${formatCurrencyFull(lastMarketingPrices.asia)} | ${formatCurrencyFull(lastMarketingPrices.europe)}`,
        `Promotion (US/Asia/Europe): ${lastMarketingPromos.us}% | ${lastMarketingPromos.asia}% | ${lastMarketingPromos.europe}%`,
        `Active features: ${lastRndFeatures}`,
        `Revenue = units * price = ${formatUnits(reviewUnitsSold.us)} * ${formatCurrencyFull(lastMarketingPrices.us)} + ${formatUnits(reviewUnitsSold.asia)} * ${formatCurrencyFull(lastMarketingPrices.asia)} + ${formatUnits(reviewUnitsSold.europe)} * ${formatCurrencyFull(lastMarketingPrices.europe)} = ${formatCurrency(lastMarketingRevenueTotal)}`,
        '',
        'This round',
        '----------------------------------------',
        `Price (US/Asia/Europe): ${formatCurrencyFull(marketingPrices.us)} | ${formatCurrencyFull(marketingPrices.asia)} | ${formatCurrencyFull(marketingPrices.europe)}`,
        `Promotion (US/Asia/Europe): ${marketingPromos.us}% | ${marketingPromos.asia}% | ${marketingPromos.europe}%`,
        `Active features: ${thisRndUnlocked}`,
        `Projected revenue = ${formatUnits(forecastProjected.us)} * ${formatCurrencyFull(marketingPrices.us)} + ${formatUnits(forecastProjected.asia)} * ${formatCurrencyFull(marketingPrices.asia)} + ${formatUnits(forecastProjected.europe)} * ${formatCurrencyFull(marketingPrices.europe)} = ${formatCurrency(marketingTotalRevenue)}`,
        '',
        'Demand sensitivity (price)',
        '----------------------------------------',
        `US price multiplier = (${forecastPriceDemand.us.avgPrice.toFixed(2)} / ${basePrice.us}) ^ (-${elasticity.us} * ${elasticityModifier.toFixed(2)}) = ${forecastPriceDemand.us.multiplier.toFixed(3)}`,
        `Asia price multiplier = (${forecastPriceDemand.asia.avgPrice.toFixed(2)} / ${basePrice.asia}) ^ (-${elasticity.asia} * ${elasticityModifier.toFixed(2)}) = ${forecastPriceDemand.asia.multiplier.toFixed(3)}`,
        `Europe price multiplier = (${forecastPriceDemand.europe.avgPrice.toFixed(2)} / ${basePrice.europe}) ^ (-${elasticity.europe} * ${elasticityModifier.toFixed(2)}) = ${forecastPriceDemand.europe.multiplier.toFixed(3)}`,
        `Adjusted demand (US/Asia/Europe): ${formatUnits(adjustedForecastDemand.us)} | ${formatUnits(adjustedForecastDemand.asia)} | ${formatUnits(adjustedForecastDemand.europe)}`,
      ])
    }

    if (activeStep.id === 'finance') {
      const financeInvestmentMultiplier = forecastEffects?.investmentCostMultiplier ?? 1
      const financeInterestRateBase = GAME_CONFIG.financial?.interestRate ?? 0
      const financeInterestSpread = scenario?.interestRateSpread ?? 0
      const financeInterestRate = financeInterestRateBase + financeInterestSpread

      // const lastFinance = prevRoundData?.decisions?.finance ?? {}
      // const lastInvestment = prevRoundData?.decisions?.investment ?? {}
      // const lastPlantsUS = lastFinance.newPlantsUS ?? lastInvestment.newPlantsUS ?? 0
      // const lastPlantsAsia = lastFinance.newPlantsAsia ?? lastInvestment.newPlantsAsia ?? 0
      const thisInvestmentCost = totalInvestmentCost

      // Beginning of round state
      const beginningFactoriesUS = prevRoundData?.factoriesUS ?? GAME_CONFIG.initialFactories.us
      const beginningFactoriesAsia = prevRoundData?.factoriesAsia ?? GAME_CONFIG.initialFactories.asia
      const beginningSharesOutstanding = sharesOutstanding
      const beginningDebt = currentDebt

      // End of round projections (based on current decisions)
      const shareIssuedShares = financeShareIssue > 0 ? Math.floor(financeShareIssue / currentSharePrice) : 0
      const shareBuybackShares = financeShareBuyback > 0 ? Math.floor(financeShareBuyback / currentSharePrice) : 0
      const endingSharesOutstanding = beginningSharesOutstanding + shareIssuedShares - shareBuybackShares
      const endingDebt = beginningDebt + financeBorrowing - financeRepayment
      const endingFactoriesUS = beginningFactoriesUS + financePlantsUS
      const endingFactoriesAsia = beginningFactoriesAsia + financePlantsAsia

      // Determine what round the beginning state is from
      const beginningRoundLabel = isStartingPosition
        ? 'Round -1 (Starting Position)'
        : reviewRoundNumber === 0
          ? 'Round 0 (Trial) Ending'
          : `Round ${reviewRoundNumber} Ending`

      const prevRoundLabel = currentRound > 0 ? `Round ${currentRound - 1}` : 'N/A'
      const prevDecisionFinance = prevRoundDecision?.finance ?? null
      const prevDecisionInvestment = prevRoundDecision?.investment ?? null
      const prevDecisionJson = prevRoundDecision ? JSON.stringify({
        finance: prevDecisionFinance,
        investment: prevDecisionInvestment,
      }, null, 2) : 'No previous round decision found'

      return joinLines([
        'AUDIT: Finance',
        '',
        `BEGINNING OF ROUND (from ${beginningRoundLabel})`,
        '----------------------------------------',
        `Shares outstanding: ${formatUnits(beginningSharesOutstanding)}`,
        `Long-term debt: ${formatCurrency(beginningDebt)}`,
        `Factories (US): ${beginningFactoriesUS}`,
        `Factories (Asia): ${beginningFactoriesAsia}`,
        '',
        'SCENARIO RATES & COSTS',
        '----------------------------------------',
        `Interest rate = ${formatRateValue(financeInterestRateBase)} + ${formatRateValue(financeInterestSpread)} = ${formatRateValue(financeInterestRate)}`,
        `Base factory cost: US ${formatCurrencyFull(plantCostUSBase)} | Asia ${formatCurrencyFull(plantCostAsiaBase)}`,
        `Investment cost multiplier: ${formatMultiplier(financeInvestmentMultiplier)}`,
        `Final factory cost: US ${formatCurrencyFull(plantCostUS)} | Asia ${formatCurrencyFull(plantCostAsia)}`,
        '',
        'LIMITS',
        '----------------------------------------',
        `Max borrow = max(0, Assets * ${formatPercent(maxDebtRatio * 100)} - Debt) = ${formatCurrency(maxBorrowing)}`,
        `Max repay = min(Debt, Available) = ${formatCurrency(maxRepayment)}`,
        `Max share issue = ${formatUnits(maxIssueShares)} shares = ${formatCurrency(maxIssueValue)}`,
        `Max buyback = ${formatUnits(maxBuybackShares)} shares (capped at ${formatCurrency(Math.min(maxBuybackValue, maxBuybackCash))})`,
        `Max dividend = ${formatCurrency(dividendMax)}`,
        '',
        'THIS ROUND DECISIONS',
        '----------------------------------------',
        `Borrowing: ${formatCurrency(financeBorrowing)}`,
        `Repayment: ${formatCurrency(financeRepayment)}`,
        `Net debt change: ${financeBorrowing - financeRepayment >= 0 ? '+' : ''}${formatCurrency(financeBorrowing - financeRepayment)}`,
        `Share issue: ${formatCurrency(financeShareIssue)} (${shareIssuedShares} shares)`,
        `Share buyback: ${formatCurrency(financeShareBuyback)} (${shareBuybackShares} shares)`,
        `Net share change: ${shareIssuedShares - shareBuybackShares >= 0 ? '+' : ''}${shareIssuedShares - shareBuybackShares} shares`,
        `Dividends: ${formatCurrency(financeDividend)}`,
        `Factory investment: US +${financePlantsUS} / Asia +${financePlantsAsia} = ${formatCurrency(thisInvestmentCost)}`,
        '',
        'END OF ROUND (projected)',
        '----------------------------------------',
        `Shares outstanding: ${formatUnits(beginningSharesOutstanding)} ${shareIssuedShares - shareBuybackShares >= 0 ? '+' : ''}${shareIssuedShares - shareBuybackShares} = ${formatUnits(endingSharesOutstanding)}`,
        `Long-term debt: ${formatCurrency(beginningDebt)} ${financeBorrowing - financeRepayment >= 0 ? '+' : ''}${formatCurrency(financeBorrowing - financeRepayment)} = ${formatCurrency(endingDebt)}`,
        `Factories (US): ${beginningFactoriesUS} ${financePlantsUS > 0 ? `+${financePlantsUS}` : ''} = ${endingFactoriesUS}${financePlantsUS > 0 ? ' (available next round)' : ''}`,
        `Factories (Asia): ${beginningFactoriesAsia} ${financePlantsAsia > 0 ? `+${financePlantsAsia}` : ''} = ${endingFactoriesAsia}${financePlantsAsia > 0 ? ' (available next round)' : ''}`,
        '',
        '========================================',
        `PREVIOUS ROUND DECISION (${prevRoundLabel}) - FROM DATABASE`,
        '========================================',
        prevDecisionJson.split('\n').join('\n'),
      ])
    }

    if (activeStep.id === 'submit') {
      const decisionJson = JSON.stringify(activeDecision ?? {}, null, 2)
      return joinLines([
        'AUDIT: Submit',
        '',
        'Decision JSON',
        '----------------------------------------',
        ...decisionJson.split('\n'),
      ])
    }

    return ''
  })()
  const combinedAuditText = useMemo(() => {
    if (activeStep.id !== 'review') return auditText
    if (!marketIntelAuditText) return auditText
    return [auditText, marketIntelAuditText].filter(Boolean).join('\n\n')
  }, [activeStep.id, auditText, marketIntelAuditText])
  const renderAuditText = (text: string) => {
    if (!text) return null
    const lines = text.split('\n')
    const dbBlockHeaders = new Set([
      'Market Demand (stored):',
      'Units Sold by Region (stored):',
      'OPERATING EXPENSES (stored):',
      'INTEREST & TAX (stored):',
      'ASSETS:',
      'LIABILITIES & EQUITY:',
    ])
    const calcMarkers = [
      'Demand formula',
      'Formula',
      'formula',
      'implied',
      'Utilization',
      'Expected Equal Share',
      'Market Share Calculation',
      'Balance Check',
      'Total Capacity',
    ]
    const numberRegex = /(-?\$?\d[\d,]*(?:\.\d+)?%?)/g
    // Markers for OK/Mismatch status
    const statusMarkerRegex = /\[\[(OK|MISMATCH)\]\]/g
    let blockMode: 'db' | 'calc' | null = null
    return lines.map((line, idx) => {
      let isGreenLine = false
      if (line.includes('[[GREEN_LINE]]')) {
        isGreenLine = true
        line = line.replace('[[GREEN_LINE]]', '')
      }
      const trimmed = line.trim()
      let mode = blockMode
      if (!trimmed) {
        blockMode = null
        mode = null
      }
      if (dbBlockHeaders.has(trimmed) || line.includes('(stored)') || line.includes('stored):')) {
        mode = 'db'
        if (trimmed.endsWith(':')) {
          blockMode = 'db'
        }
      } else if (calcMarkers.some((marker) => line.includes(marker))) {
        mode = 'calc'
        if (trimmed.endsWith(':')) {
          blockMode = 'calc'
        }
      } else if (trimmed.endsWith(':')) {
        blockMode = null
      }
      const parts: React.ReactNode[] = []
      let lastIndex = 0
      // First pass: replace status markers with colored spans
      const lineWithColors = line.replace(statusMarkerRegex, (_match, status) => {
        if (status === 'OK') {
          return '{{STATUS_OK}}'
        } else {
          return '{{STATUS_MISMATCH}}'
        }
      })
      // Process the line with placeholders
      lineWithColors.replace(numberRegex, (match, _value, offset) => {
        parts.push(lineWithColors.slice(lastIndex, offset))
        if (mode) {
          parts.push(
            <span className={`dm-audit-num ${mode}`} key={`${idx}-${offset}`}>
              {match}
            </span>
          )
        } else {
          parts.push(match)
        }
        lastIndex = offset + match.length
        return match
      })
      parts.push(lineWithColors.slice(lastIndex))
      // Convert placeholder strings to colored spans
      const colorizedParts = parts.flatMap((part, partIdx) => {
        if (typeof part === 'string') {
          const segments: React.ReactNode[] = []
          let remaining = part
          let segIdx = 0
          while (remaining.length > 0) {
            const okIdx = remaining.indexOf('{{STATUS_OK}}')
            const mismatchIdx = remaining.indexOf('{{STATUS_MISMATCH}}')
            if (okIdx === -1 && mismatchIdx === -1) {
              segments.push(remaining)
              break
            }
            const nextIdx = okIdx === -1 ? mismatchIdx : (mismatchIdx === -1 ? okIdx : Math.min(okIdx, mismatchIdx))
            const isOk = nextIdx === okIdx
            if (nextIdx > 0) {
              segments.push(remaining.slice(0, nextIdx))
            }
            const marker = isOk ? '{{STATUS_OK}}' : '{{STATUS_MISMATCH}}'
            segments.push(
              <span
                key={`${idx}-${partIdx}-status-${segIdx}`}
                className={isOk ? 'dm-audit-status-ok' : 'dm-audit-status-mismatch'}
              >
                {isOk ? 'OK' : 'Mismatch'}
              </span>
            )
            remaining = remaining.slice(nextIdx + marker.length)
            segIdx++
          }
          return segments
        }
        return [part]
      })
      const suffix = idx < lines.length - 1 ? '\n' : ''
      return (
        <span key={`line-${idx}`} style={isGreenLine ? { color: '#22c55e', fontWeight: 600 } : undefined}>
          {colorizedParts}
          {suffix}
        </span>
      )
    })
  }

  const handleAuditCopy = () => {
    if (!combinedAuditText) return
    navigator.clipboard.writeText(combinedAuditText)
      .then(() => {
        setAuditCopied(true)
        window.setTimeout(() => setAuditCopied(false), 1500)
      })
      .catch(() => undefined)
  }

  function HeroStatus() {
    const progress = decisionProgress.isSubmitted ? 100 : decisionProgress.percent
    const isSubmitted = decisionProgress.isSubmitted
    const isGameComplete = game?.status === 'COMPLETED'

    if (isGameComplete) {
      return (
        <div className="hero-status submitted" style={{ borderLeftColor: '#2563eb' }}>
          <div className="hero-info">
            <div className="hero-title">
              Game Complete
              <span className="hero-deadline" style={{ background: '#dbeafe', color: '#1e3a8a' }}>
                Results Ready
              </span>
            </div>
            <div className="hero-progress-wrap">
              <div className="hero-prog-label">
                <span>Status</span>
                <span>Final Results</span>
              </div>
              <div className="hero-prog-track">
                <div
                  className="hero-prog-fill"
                  style={{ width: '100%', background: '#2563eb' }}
                ></div>
              </div>
            </div>
          </div>
          <button className="dm-hero-btn dm-hero-btn-primary" onClick={() => navigate('/results')}>
            View Results
          </button>
        </div>
      )
    }

    if (isSubmitted) {
      return (
        <div className="hero-status submitted" style={{ borderLeftColor: '#f59e0b' }}>
          <div className="hero-info">
            <div className="hero-title" style={{ fontSize: '1.1rem' }}>
              Decisions Submitted
              <span className="hero-deadline submitted-badge">
                Submitted {submittedAtLabel || 'just now'}
              </span>
            </div>
            <div className="hero-progress-wrap">
              <div className="hero-prog-label">
                <span>Status</span>
                <span>All Locked</span>
              </div>
              <div className="hero-prog-track">
                <div
                  className="hero-prog-fill"
                  style={{ width: '100%', background: '#f59e0b' }}
                ></div>
              </div>
            </div>
          </div>
          <button
            className="dm-hero-btn dm-hero-btn-waiting"
            disabled
          >
            Waiting for Decision...
          </button>
        </div>
      )
    }

    const statusText = `${decisionProgress.completed}/${decisionProgress.total} Sections`

    return (
      <div className="hero-status">
        <div className="hero-info">
          <div className="hero-title">
            {currentRound === 0 ? 'Trial Round' : `Round ${currentRound}`} Active
            <span className="hero-deadline">🕒 {timeRemainingLabel}</span>
          </div>
          <div className="hero-progress-wrap">
            <div className="hero-prog-label">
              <span>Decision Progress</span>
              <span>{progress}% {statusText}</span>
            </div>
            <div className="hero-prog-track">
              <div
                className="hero-prog-fill"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          </div>
        </div>
        <button className="dm-hero-btn dm-hero-btn-primary" onClick={() => navigate('/decisions')}>
          Continue Decisions ⚡
        </button>
      </div>
    )
  }

  function MarketIntelligence() {
    const region = selectedRegion
    const priceRange = marketIntelData.priceRanges[region]
    const promoRange = marketIntelData.promoRanges[region]
    const myPrice = marketIntelData.myTeam?.prices?.[region] ?? gameConfig.priceDemand.baselinePriceByRegion[region]
    const myPromo = marketIntelData.myTeam?.promos?.[region] ?? gameConfig.defaults.marketing.promotionPctByRegion[region]
    const avgPrice = marketIntelData.avgPrices[region]
    const avgPromo = marketIntelData.avgPromos[region]

    const getPricePosition = (price: number) => {
      const range = priceRange.max - priceRange.min
      if (range === 0) return 50
      return Math.min(100, Math.max(0, ((price - priceRange.min) / range) * 100))
    }

    const getPromoPosition = (promo: number) => {
      const range = promoRange.max - promoRange.min
      if (range === 0) return 50
      return Math.min(100, Math.max(0, ((promo - promoRange.min) / range) * 100))
    }

    const myPricePos = getPricePosition(myPrice)
    const avgPricePos = getPricePosition(avgPrice)
    const myPromoPos = getPromoPosition(myPromo)
    const avgPromoPos = getPromoPosition(avgPromo)

    const priceDiff = avgPrice > 0 ? ((myPrice - avgPrice) / avgPrice) * 100 : 0
    const promoDiff = avgPromo > 0 ? ((myPromo - avgPromo) / avgPromo) * 100 : 0

    const getPriceBadgeClass = () => priceDiff > 5 ? 'red' : priceDiff < -5 ? 'green' : 'neutral'
    const getPromoBadgeClass = () => promoDiff > 10 ? 'green' : promoDiff < -10 ? 'red' : 'neutral'

    return (
      <div id="market-intel" className="card">
        <div className="card-header">
          <div className="mi-title-group">
            <h2 className="card-title">Market Intelligence</h2>
            <p className="mi-subtitle">Last Round Market Research - Your Position vs Market Range</p>
          </div>
          <div className="seg-control" style={{ display: 'flex', gap: '4px', background: 'var(--bg-page)', padding: '4px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            {(['us', 'asia', 'europe'] as const).map((r) => (
              <button
                key={r}
                className={`seg-btn ${selectedRegion === r ? 'active' : ''}`}
                style={{
                  border: 'none',
                  background: selectedRegion === r
                    ? (theme === 'light' ? 'white' : 'rgba(255, 255, 255, 0.1)')
                    : 'transparent',
                  padding: '4px 8px',
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                  fontWeight: selectedRegion === r ? 700 : 600,
                  color: selectedRegion === r ? 'var(--text-accent)' : 'var(--text-muted)',
                  boxShadow: selectedRegion === r ? 'var(--shadow-card)' : 'none',
                  cursor: 'pointer',
                }}
                onClick={() => setSelectedRegion(r)}
              >
                {regionLabels[r]}
              </button>
            ))}
          </div>
        </div>
        <div className="card-body">
          <div className="mi-body">
            <div className="mi-row mi-unit-price">
              <div className="mi-label-group">
                <div className="mi-label-main">
                  Unit Price
                  <InfoTooltip text={tooltipCopy.unitPrice} label="Unit price info" />
                </div>
                <div className="mi-label-sub"><span>{formatCurrencyFull(myPrice)}</span></div>
              </div>
              <div className="mi-track-container">
                <div className="mi-limit" style={{ left: '0%' }}><span className="mi-limit-label">{formatCurrencyFull(priceRange.min)}</span></div>
                <div className="mi-limit" style={{ right: '0%' }}><span className="mi-limit-label">{formatCurrencyFull(priceRange.max)}</span></div>
                <div className="mi-pivot" style={{ left: `${avgPricePos}%` }}><span className="mi-pivot-label">AVG</span></div>
                <div
                  className={`mi-pill ${getPriceBadgeClass()}`}
                  style={{
                    left: `${Math.min(myPricePos, avgPricePos)}%`,
                    width: `${Math.abs(myPricePos - avgPricePos)}%`
                  }}
                ></div>
                <div className="mi-anchor-dot your-pos" style={{ left: `${myPricePos}%` }}></div>
              </div>
              <div className={`mi-badge ${getPriceBadgeClass()}`}>
                {priceDiff > 0 ? '+' : ''}{priceDiff.toFixed(0)}%
              </div>
            </div>
            <div className="mi-row mi-promotion">
              <div className="mi-label-group">
                <div className="mi-label-main">
                  Promotion
                  <InfoTooltip text={tooltipCopy.promotion} label="Promotion budget info" />
                </div>
                <div className="mi-label-sub"><span>{myPromo.toFixed(0)}%</span></div>
              </div>
              <div className="mi-track-container">
                <div className="mi-limit" style={{ left: '0%' }}><span className="mi-limit-label">{promoRange.min}%</span></div>
                <div className="mi-limit" style={{ right: '0%' }}><span className="mi-limit-label">{promoRange.max}%</span></div>
                <div className="mi-pivot" style={{ left: `${avgPromoPos}%` }}><span className="mi-pivot-label">AVG</span></div>
                <div
                  className={`mi-pill ${getPromoBadgeClass()}`}
                  style={{
                    left: `${Math.min(myPromoPos, avgPromoPos)}%`,
                    width: `${Math.abs(myPromoPos - avgPromoPos)}%`
                  }}
                ></div>
                <div className="mi-anchor-dot your-pos" style={{ left: `${myPromoPos}%` }}></div>
              </div>
              <div className={`mi-badge ${getPromoBadgeClass()}`}>
                {promoDiff > 0 ? '+' : ''}{promoDiff.toFixed(0)}%
              </div>
            </div>
            {(() => {
              const myFeatures = marketIntelData.features
              const avgFeatures = marketIntelData.avgFeatures
              const featureMax = 10
              const myFeaturesPos = (myFeatures / featureMax) * 100
              const avgFeaturesPos = (avgFeatures / featureMax) * 100
              const featuresDiff = avgFeatures > 0 ? ((myFeatures - avgFeatures) / avgFeatures) * 100 : (myFeatures > 0 ? 100 : 0)
              const getFeaturesBadgeClass = () => featuresDiff > 10 ? 'green' : featuresDiff < -10 ? 'red' : 'neutral'
              return (
                <div className="mi-row mi-tech">
                  <div className="mi-label-group">
                    <div className="mi-label-main">
                      Tech Features
                      <InfoTooltip text={tooltipCopy.features} label="Product features info" />
                    </div>
                    <div className="mi-label-sub"><span>{myFeatures} unlocked</span></div>
                  </div>
                  <div className="mi-track-container">
                    <div className="mi-limit" style={{ left: '0%' }}><span className="mi-limit-label">0</span></div>
                    <div className="mi-limit" style={{ right: '0%' }}><span className="mi-limit-label">{featureMax}</span></div>
                    <div className="mi-pivot" style={{ left: `${avgFeaturesPos}%` }}><span className="mi-pivot-label">AVG</span></div>
                    <div
                      className={`mi-pill ${getFeaturesBadgeClass()}`}
                      style={{
                        left: `${Math.min(myFeaturesPos, avgFeaturesPos)}%`,
                        width: `${Math.max(1, Math.abs(myFeaturesPos - avgFeaturesPos))}%`
                      }}
                    ></div>
                    <div className="mi-anchor-dot your-pos" style={{ left: `${myFeaturesPos}%` }}></div>
                  </div>
                  <div className={`mi-badge ${getFeaturesBadgeClass()}`}>
                    {featuresDiff > 0 ? '+' : ''}{featuresDiff.toFixed(0)}%
                  </div>
                </div>
              )
            })()}
            {(() => {
              const myCSR = marketIntelData.csrRating
              const avgCSR = marketIntelData.avgCSR
              const csrMin = 1
              const csrMax = 4
              const myCSRPos = ((myCSR - csrMin) / (csrMax - csrMin)) * 100
              const avgCSRPos = ((avgCSR - csrMin) / (csrMax - csrMin)) * 100
              const csrDiff = avgCSR > 0 ? ((myCSR - avgCSR) / avgCSR) * 100 : 0
              const getCSRBadgeClass = () => csrDiff > 5 ? 'green' : csrDiff < -5 ? 'red' : 'neutral'
              return (
                <div className="mi-row mi-csr">
                  <div className="mi-label-group">
                    <div className="mi-label-main">
                      <span title="Corporate Social Responsibility">CSR</span> Rating
                      <InfoTooltip text={tooltipCopy.supplier} label="CSR info" />
                    </div>
                    <div className="mi-label-sub"><span>{myCSR.toFixed(1)} / 4.0</span></div>
                  </div>
                  <div className="mi-track-container">
                    <div className="mi-limit" style={{ left: '0%' }}><span className="mi-limit-label">1.0</span></div>
                    <div className="mi-limit" style={{ right: '0%' }}><span className="mi-limit-label">4.0</span></div>
                    <div className="mi-pivot" style={{ left: `${avgCSRPos}%` }}><span className="mi-pivot-label">AVG</span></div>
                    <div
                      className={`mi-pill ${getCSRBadgeClass()}`}
                      style={{
                        left: `${Math.min(myCSRPos, avgCSRPos)}%`,
                        width: `${Math.max(1, Math.abs(myCSRPos - avgCSRPos))}%`
                      }}
                    ></div>
                    <div className="mi-anchor-dot your-pos" style={{ left: `${myCSRPos}%` }}></div>
                  </div>
                  <div className={`mi-badge ${getCSRBadgeClass()}`}>
                    {csrDiff > 0 ? '+' : ''}{csrDiff.toFixed(0)}%
                  </div>
                </div>
              )
            })()}
          </div>
          <div className="mi-legend">
            <div className="mi-legend-item"><div className="mi-legend-mark avg-mark"></div><span>Industry Average</span></div>
            <div className="mi-legend-item"><div className="mi-legend-mark your-mark"></div><span>Your Position</span></div>
          </div>
        </div>
      </div>
    )
  }

  function UnmetDemandIntelligence() {
    const getStatusStyle = (status: 'shortage' | 'balanced' | 'saturated') => {
      switch (status) {
        case 'shortage':
          return { color: '#ef4444', background: '#fee2e2', label: 'SHORTAGE', borderColor: '#ef4444' }
        case 'saturated':
          return { color: '#10b981', background: '#dcfce7', label: 'SATURATED', borderColor: '#10b981' }
        default:
          return { color: '#3b82f6', background: '#dbeafe', label: 'BALANCED', borderColor: '#3b82f6' }
      }
    }

    const regions: Array<{ key: 'us' | 'asia' | 'europe'; label: string }> = [
      { key: 'us', label: regionLabels.us.toUpperCase() },
      { key: 'asia', label: regionLabels.asia.toUpperCase() },
      { key: 'europe', label: regionLabels.europe.toUpperCase() },
    ]

    // Calculate market-wide totals and generate summary
    const marketSummary = useMemo(() => {
      const totalSupply = supplyDemandData.us.supply + supplyDemandData.asia.supply + supplyDemandData.europe.supply
      const totalDemand = supplyDemandData.us.demand + supplyDemandData.asia.demand + supplyDemandData.europe.demand
      const totalGap = totalSupply - totalDemand
      const roundNum = prevRoundData?.round ?? 0

      const regionData = {
        us: {
          supply: supplyDemandData.us.supply,
          demand: supplyDemandData.us.demand,
          gap: supplyDemandData.us.supply - supplyDemandData.us.demand,
          ratio: supplyDemandData.us.ratio,
          status: supplyDemandData.us.status,
        },
        asia: {
          supply: supplyDemandData.asia.supply,
          demand: supplyDemandData.asia.demand,
          gap: supplyDemandData.asia.supply - supplyDemandData.asia.demand,
          ratio: supplyDemandData.asia.ratio,
          status: supplyDemandData.asia.status,
        },
        europe: {
          supply: supplyDemandData.europe.supply,
          demand: supplyDemandData.europe.demand,
          gap: supplyDemandData.europe.supply - supplyDemandData.europe.demand,
          ratio: supplyDemandData.europe.ratio,
          status: supplyDemandData.europe.status,
        },
      }

      // Generate strategic insight based on overall market balance
      let insight = ''
      const avgRatio = (regionData.us.ratio + regionData.asia.ratio + regionData.europe.ratio) / 3

      if (avgRatio < 0.90) {
        insight = '🔥 Growth Opportunity: Strong demand is outpacing industry capacity. This is a seller\'s market - teams with available capacity can command premium pricing. Consider aggressive expansion to capture unmet demand before competitors scale up. First-mover advantage is available.'
      } else if (avgRatio > 1.10) {
        insight = '⚠️ Competitive Alert: The industry is overproducing. This excess capacity will likely trigger price wars as teams compete to move inventory. Consider maintaining conservative production levels or increasing marketing to capture share while competitors struggle with stock.'
      } else {
        insight = '✅ Stable Market: The industry supply-demand dynamics are well-calibrated. No major pricing pressure or shortage risk. This equilibrium suggests rational capacity planning across competitors. Focus on differentiation through quality, features, and brand rather than volume plays.'
      }

      return {
        totalSupply,
        totalDemand,
        totalGap,
        roundNum,
        regionData,
        insight,
      }
    }, [supplyDemandData, prevRoundData])

    return (
      <div id="unmet-demand" className="card">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 className="card-title">Market Supply-Demand</h2>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={() => setBalanceView('chart')}
              className="btn btn-tiny"
              style={{
                background: balanceView === 'chart' ? '#3b82f6' : theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                color: balanceView === 'chart' ? '#ffffff' : 'var(--text-main)',
                border: `1px solid ${balanceView === 'chart' ? '#3b82f6' : 'var(--border-color)'}`,
                padding: '0.35rem 0.75rem',
                fontSize: '0.75rem',
                fontWeight: 600,
              }}
            >
              Chart
            </button>
            <button
              onClick={() => setBalanceView('summary')}
              className="btn btn-tiny"
              style={{
                background: balanceView === 'summary' ? '#3b82f6' : theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                color: balanceView === 'summary' ? '#ffffff' : 'var(--text-main)',
                border: `1px solid ${balanceView === 'summary' ? '#3b82f6' : 'var(--border-color)'}`,
                padding: '0.35rem 0.75rem',
                fontSize: '0.75rem',
                fontWeight: 600,
              }}
            >
              Summary
            </button>
          </div>
        </div>
        <div className="card-body">
          {balanceView === 'chart' ? (
            <>
              <p className="mi-subtitle" style={{ marginBottom: '1.5rem' }}>Market equilibrium based on last round data.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                {regions.map(({ key, label }) => {
                  const data = supplyDemandData[key]
                  const style = getStatusStyle(data.status)
                  const position = Math.min(100, Math.max(0, data.position))

                  return (
                    <div key={key} className="relative">
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-main)' }}>{label}</span>
                        <span style={{
                          fontSize: '0.65rem',
                          fontWeight: 800,
                          color: style.color,
                          background: theme === 'dark' ? 'rgba(255,255,255,0.1)' : style.background,
                          padding: '2px 8px',
                          borderRadius: '4px',
                          border: theme === 'dark' ? `1px solid ${style.borderColor}` : 'none'
                        }}>
                          {style.label}
                        </span>
                      </div>
                      <div className="spectrum-track">
                        <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: '1px', background: 'rgba(255,255,255,0.4)' }}></div>
                        <div className="indicator-pin" style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', left: `${position}%` }}>
                          <div
                            className={data.status === 'shortage' ? 'pulse-glow-red' : undefined}
                            style={{
                              width: '14px',
                              height: '14px',
                              background: 'var(--bg-card)',
                              border: `3px solid ${style.borderColor}`,
                              borderRadius: '50%'
                            }}
                          ></div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem', fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                        <span>Supply: {formatUnits(data.supply)}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
              <div style={{ marginTop: '2rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', textAlign: 'center' }}>
                <div><div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontWeight: 800 }}>OVER-SUPPLY</div><div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#10b981' }}>Glut</div></div>
                <div style={{ borderLeft: '1px solid var(--border-color)', borderRight: '1px solid var(--border-color)' }}><div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontWeight: 800 }}>IDEAL</div><div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#3b82f6' }}>Balanced</div></div>
                <div><div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontWeight: 800 }}>UNDER-SUPPLY</div><div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#ef4444' }}>Shortage</div></div>
              </div>
            </>
          ) : (
            <div style={{ fontSize: '0.875rem', lineHeight: '1.7', color: 'var(--text-secondary)' }}>
              {/* Market Overview */}
              <div style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--text-main)' }}>
                  Market Overview - {marketSummary.roundNum < 0 ? 'Last Round' : `Round ${marketSummary.roundNum}`}
                </h3>
                <p>
                  Last round, the global market sold <strong style={{ color: 'var(--text-main)' }}>{formatUnits(marketSummary.totalSupply)}</strong> units{' '}
                  {Math.abs(marketSummary.totalGap) > 100 && (
                    <>
                      {marketSummary.totalGap > 0 ? (
                        <>while total industry production reached <strong style={{ color: 'var(--text-main)' }}>{formatUnits(marketSummary.totalDemand + marketSummary.totalGap)}</strong> units, resulting in <strong style={{ color: '#ef4444' }}>{formatUnits(Math.abs(marketSummary.totalGap))}</strong> units of excess inventory sitting across all teams.</>
                      ) : (
                        <>but demand reached <strong style={{ color: 'var(--text-main)' }}>{formatUnits(marketSummary.totalDemand)}</strong> units, leaving <strong style={{ color: '#ef4444' }}>{formatUnits(Math.abs(marketSummary.totalGap))}</strong> units of unmet customer demand on the table.</>
                      )}
                    </>
                  )}
                </p>
              </div>

              {/* Regional Breakdown */}
              <div style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--text-main)' }}>
                  Regional Market Breakdown
                </h3>

                {/* North America */}
                <div style={{ marginBottom: '1rem', paddingLeft: '0.5rem', borderLeft: '3px solid #3b82f6' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                    <span style={{ fontSize: '1rem' }}>🇺🇸</span>
                    <strong style={{ color: 'var(--text-main)' }}>North America:</strong>
                  </div>
                  <p style={{ fontSize: '0.875rem', marginBottom: '0.25rem' }}>
                    Market sold: {formatUnits(marketSummary.regionData.us.supply)} units
                    {marketSummary.regionData.us.demand > 0 && ` | Demand: ${formatUnits(marketSummary.regionData.us.demand)} units`}
                  </p>
                  <p style={{ fontSize: '0.85rem', fontStyle: 'italic', color: 'var(--text-muted)' }}>
                    {marketSummary.regionData.us.status === 'saturated' && (
                      <><strong style={{ color: '#10b981' }}>Oversupply:</strong> {formatUnits(Math.abs(marketSummary.regionData.us.gap))} units surplus - Market utilization: {(marketSummary.regionData.us.ratio * 100).toFixed(0)}%</>
                    )}
                    {marketSummary.regionData.us.status === 'shortage' && (
                      <><strong style={{ color: '#ef4444' }}>Shortfall:</strong> {formatUnits(Math.abs(marketSummary.regionData.us.gap))} units unmet - Market fulfillment: {(marketSummary.regionData.us.ratio * 100).toFixed(0)}%</>
                    )}
                    {marketSummary.regionData.us.status === 'balanced' && (
                      <><strong style={{ color: '#3b82f6' }}>Balanced:</strong> Excellent equilibrium - Market match: {(marketSummary.regionData.us.ratio * 100).toFixed(0)}%</>
                    )}
                  </p>
                </div>

                {/* Asia-Pacific */}
                <div style={{ marginBottom: '1rem', paddingLeft: '0.5rem', borderLeft: '3px solid #10b981' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                    <span style={{ fontSize: '1rem' }}>🌏</span>
                    <strong style={{ color: 'var(--text-main)' }}>Asia-Pacific:</strong>
                  </div>
                  <p style={{ fontSize: '0.875rem', marginBottom: '0.25rem' }}>
                    Market sold: {formatUnits(marketSummary.regionData.asia.supply)} units
                    {marketSummary.regionData.asia.demand > 0 && ` | Demand: ${formatUnits(marketSummary.regionData.asia.demand)} units`}
                  </p>
                  <p style={{ fontSize: '0.85rem', fontStyle: 'italic', color: 'var(--text-muted)' }}>
                    {marketSummary.regionData.asia.status === 'saturated' && (
                      <><strong style={{ color: '#10b981' }}>Oversupply:</strong> {formatUnits(Math.abs(marketSummary.regionData.asia.gap))} units surplus - Market utilization: {(marketSummary.regionData.asia.ratio * 100).toFixed(0)}%</>
                    )}
                    {marketSummary.regionData.asia.status === 'shortage' && (
                      <><strong style={{ color: '#ef4444' }}>Shortfall:</strong> {formatUnits(Math.abs(marketSummary.regionData.asia.gap))} units unmet - Market fulfillment: {(marketSummary.regionData.asia.ratio * 100).toFixed(0)}%</>
                    )}
                    {marketSummary.regionData.asia.status === 'balanced' && (
                      <><strong style={{ color: '#3b82f6' }}>Balanced:</strong> Excellent equilibrium - Market match: {(marketSummary.regionData.asia.ratio * 100).toFixed(0)}%</>
                    )}
                  </p>
                </div>

                {/* Europe */}
                <div style={{ marginBottom: '1rem', paddingLeft: '0.5rem', borderLeft: '3px solid #8b5cf6' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                    <span style={{ fontSize: '1rem' }}>🇪🇺</span>
                    <strong style={{ color: 'var(--text-main)' }}>Europe:</strong>
                  </div>
                  <p style={{ fontSize: '0.875rem', marginBottom: '0.25rem' }}>
                    Market sold: {formatUnits(marketSummary.regionData.europe.supply)} units
                    {marketSummary.regionData.europe.demand > 0 && ` | Demand: ${formatUnits(marketSummary.regionData.europe.demand)} units`}
                  </p>
                  <p style={{ fontSize: '0.85rem', fontStyle: 'italic', color: 'var(--text-muted)' }}>
                    {marketSummary.regionData.europe.status === 'saturated' && (
                      <><strong style={{ color: '#10b981' }}>Oversupply:</strong> {formatUnits(Math.abs(marketSummary.regionData.europe.gap))} units surplus - Market utilization: {(marketSummary.regionData.europe.ratio * 100).toFixed(0)}%</>
                    )}
                    {marketSummary.regionData.europe.status === 'shortage' && (
                      <><strong style={{ color: '#ef4444' }}>Shortfall:</strong> {formatUnits(Math.abs(marketSummary.regionData.europe.gap))} units unmet - Market fulfillment: {(marketSummary.regionData.europe.ratio * 100).toFixed(0)}%</>
                    )}
                    {marketSummary.regionData.europe.status === 'balanced' && (
                      <><strong style={{ color: '#3b82f6' }}>Balanced:</strong> Excellent equilibrium - Market match: {(marketSummary.regionData.europe.ratio * 100).toFixed(0)}%</>
                    )}
                  </p>
                </div>
              </div>

              {/* Market Intelligence */}
              <div style={{
                padding: '1rem',
                background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(16, 185, 129, 0.1) 100%)',
                borderRadius: '8px',
                border: '1px solid rgba(59, 130, 246, 0.2)'
              }}>
                <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text-main)' }}>
                  Market Intelligence
                </h3>
                <p style={{ fontSize: '0.85rem', lineHeight: '1.6', margin: 0 }}>
                  {marketSummary.insight}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  function DecisionProgress() {
    const isGameComplete = game?.status === 'COMPLETED'
    const sectionProgress = useMemo(() => {
      const map = new Map<string, boolean>()
      decisionProgress.sections.forEach((section) => {
        map.set(section.id, section.hasData)
      })
      return map
    }, [decisionProgress.sections])

    const timelineItems = [
      {
        id: 'forecast',
        label: 'Forecast',
        sub: 'Demand projections',
        hasData: sectionProgress.get('forecast') ?? false,
        icon: '📈',
      },
      {
        id: 'production',
        label: 'Production',
        sub: 'Capacity optimization',
        hasData: sectionProgress.get('production') ?? false,
        icon: '🏭',
        showSmoke: true,
      },
      {
        id: 'logistics',
        label: 'Logistics',
        sub: 'Regional distribution',
        hasData: sectionProgress.get('logistics') ?? false,
        icon: '📦',
      },
      {
        id: 'rnd',
        label: 'R&D',
        sub: 'Tech feature roadmap',
        hasData: sectionProgress.get('rnd') ?? false,
        icon: '🔬',
      },
      {
        id: 'marketing',
        label: 'Marketing',
        sub: 'Pricing & Promotions',
        hasData: sectionProgress.get('marketing') ?? false,
        icon: '📢',
      },
      {
        id: 'finance',
        label: 'Finance',
        sub: 'Capital structure',
        hasData: sectionProgress.get('finance') ?? false,
        icon: '💰',
      },
    ]

    const currentIndex = timelineItems.findIndex(item => !item.hasData)

    const getInsight = () => {
      if (isGameComplete) {
        return 'Game complete. Results are ready.'
      }
      if (decisionProgress.isSubmitted) {
        return `Submitted ${submittedAtLabel || 'just now'}. Waiting for decision.`
      }
      if (supplyDemandData.us.status === 'shortage' || supplyDemandData.asia.status === 'shortage') {
        const shortageRegion = supplyDemandData.us.status === 'shortage' ? regionLabels.us : regionLabels.asia
        return `Market shortage detected in ${shortageRegion}. Consider increasing production capacity to capture unmet demand.`
      }
      if (supplyDemandData.europe.status === 'saturated') {
        return `${regionLabels.europe} market is saturated. Focus on competitive pricing or shift resources to higher-demand regions.`
      }
      if (decisionProgress.percent < 50) {
        return `You're ${decisionProgress.percent}% through your decisions. Review market intelligence to optimize your strategy.`
      }
      return 'Market conditions are stable. Focus on efficiency and maintaining your competitive position.'
    }

    const isSubmitted = decisionProgress.isSubmitted
    const statusColor = isGameComplete
      ? 'var(--text-accent)'
      : isSubmitted
        ? '#f59e0b'
        : '#10b981'
    const statusPulseStyle = isGameComplete
      ? { background: 'var(--text-accent)', boxShadow: '0 0 0 0 rgba(37, 99, 235, 0.7)' }
      : isSubmitted
        ? { background: '#f59e0b', boxShadow: '0 0 0 0 rgba(245, 158, 11, 0.7)' }
        : { background: '#10b981', boxShadow: '0 0 0 0 rgba(16, 185, 129, 0.7)' }
    const statusLabel = isGameComplete ? 'RESULTS READY' : isSubmitted ? 'SUBMITTED' : 'LIVE'

    return (
      <div id="decisions-status" className="card impact-card">
        <div className="impact-header">
          <span>Decision Progress</span>
          <div
            className="impact-live"
            style={{ color: statusColor }}
          >
            <span
              className="status-pulse"
              style={statusPulseStyle}
            ></span>
            <span style={{ marginLeft: '4px' }}>{statusLabel}</span>
          </div>
        </div>
        <div className="timeline-container">
          {timelineItems.map((item, index) => {
            const isDone = item.hasData || decisionProgress.isSubmitted || isGameComplete
            const isCurrent = index === currentIndex && !decisionProgress.isSubmitted && !isGameComplete
            const statusClass = isDone ? 't-done' : isCurrent ? 't-warn' : ''

            return (
              <div key={item.id} className={`timeline-item ${statusClass}`}>
                <div className="timeline-node"></div>
                <div className="t-content">
                  <div className="t-title">
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      {item.label}
                      {item.icon && item.showSmoke && isCurrent && (
                        <span style={{ position: 'relative', display: 'inline-block' }}>
                          {item.icon}
                          <span className="smoke">☁️</span>
                          <span className="smoke">☁️</span>
                          <span className="smoke">☁️</span>
                        </span>
                      )}
                    </span>
                    {isDone && <span style={{ color: '#10b981', fontSize: '0.7rem' }}>Done</span>}
                    {isCurrent && <span style={{ color: '#f59e0b', fontSize: '0.7rem' }}>Review</span>}
                  </div>
                  <div className="t-sub">{item.sub}</div>
                </div>
              </div>
            )
          })}

          <div className={`timeline-item ${decisionProgress.isSubmitted ? 't-done' : ''}`}>
            <div className="timeline-node"></div>
            <div className="t-content">
              <div className="t-title" style={{ opacity: decisionProgress.isSubmitted ? 1 : 0.6 }}>
                Submit Decisions
                {decisionProgress.isSubmitted && <span style={{ color: '#10b981', fontSize: '0.7rem' }}>Done</span>}
              </div>
              <div className="t-sub">Final transmission</div>
            </div>
          </div>
        </div>
        <div className="impact-insight">
          <div className="insight-title">💡 Strategic Insight</div>
          <p className="insight-text">{getInsight()}</p>
        </div>
      </div>
    )
  }

  const renderRndStep = () => {
    return (
      <div className="dm-rnd">
        <div className="dm-innovation-header">
          <div className="dm-roadmap-progress">
            <div className="dm-progress-meta">
              <span>Next Feature: <strong>{nextFeatureEmoji ? `${nextFeatureEmoji} ` : ''}{nextFeatureName}</strong></span>
              <span>{Math.round(nextUpProgress)}% Complete</span>
            </div>
            <div className="dm-impact-progress" style={{ height: '10px', background: 'var(--border-light)' }}>
              <span className="dm-impact-progress-fill" style={{ width: `${nextUpProgress}%`, background: '#2563eb' }} />
            </div>
            <div style={{ marginTop: '0.5rem', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              Estimated unlock: <strong>{
                currentFeatures >= featureLimit
                  ? 'Complete'
                  : hoursToFeatures <= 0
                    ? 'Not investing'
                    : (nextUpRemaining <= 0 ? 'This Round' : `~${nextUpRounds} rounds`)
              }</strong>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="dm-unlocked-title">Features Unlocked</div>
            <div className="dm-unlocked-count">{projectedFeatures} <span className="dm-unlocked-total">/ {featureLimit}</span></div>
          </div>
        </div>

        <div className="dm-rnd-controls">
          <div className="dm-resource-card">
            <div className="dm-prod-section-header">
              <span className="dm-prod-step-num">1</span>
              Research Headcount
              <InfoTooltip text={tooltipCopy.rndHeadcount} label="Research headcount info" />
            </div>
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '1rem' }}>
                <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Staffing</span>
                <span className="dm-prod-slider-val" style={{ fontSize: '1.5rem' }}>{rndStaff} Employees</span>
              </div>
              <RangeWithButtons
                min={0}
                max={staffSliderMax}
                step={10}
                value={rndStaff}
                disabled={isLocked}
                ariaLabel="Research staffing"
                onChange={(nextValue) => updateDecisionField('rnd', 'researchStaff', nextValue)}
              />
            </div>
            <div className="dm-m-tip">
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Salary</span><strong>{formatCurrency(defaults.hr.us.wage)} / pp</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.25rem', fontWeight: 700 }}>
                <span>Total Cost</span><span>{formatCurrency(totalStaffCost)}</span>
              </div>
            </div>
          </div>

          <div className="dm-resource-card">
            <div className="dm-prod-section-header">
              <span className="dm-prod-step-num">2</span>
              Training Strategy
              <InfoTooltip text={tooltipCopy.training} label="Training strategy info" />
            </div>
            <div className="dm-training-grid">
              {['basic', 'standard', 'advanced'].map((level) => {
                const label = level === 'basic' ? 'No training' : level
                return (
                  <div
                    key={level}
                    className={`dm-training-option ${rndTraining === level ? 'active' : ''}`}
                    onClick={() => updateDecisionField('rnd', 'trainingLevel', level)}
                  >
                    <strong style={{ textTransform: 'capitalize' }}>{label}</strong>
                    <div className="dm-training-efficiency">{level === 'basic' ? '1.0x' : level === 'standard' ? '1.1x' : '1.2x'} Eff.</div>
                  </div>
                )
              })}
            </div>
            <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px dashed #e2e8f0', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Total Training Cost</span>
              <strong>{formatCurrency(totalTrainingCost)}</strong>
            </div>
          </div>
        </div>

        <div className="dm-prod-card">
          <div className="dm-prod-header">
            <div className="dm-prod-title">
              Technology Roadmap
              <InfoTooltip text={tooltipCopy.features} label="Product features info" />
            </div>
          </div>
          <div style={{ padding: '1.5rem' }}>
            <div className="dm-roadmap-grid">
              {rndRoadmap.map((f, i) => {
                const featureNum = i + 1
                const isUnlocked = featureNum <= currentFeatures
                const isUnlocking = featureNum > currentFeatures && featureNum <= projectedFeatures
                const isNext = featureNum === projectedFeatures + 1
                const status = isUnlocked ? 'Unlocked' : isUnlocking ? 'Unlocking' : isNext ? 'Next Up' : 'Locked'
                const statusClass = isUnlocked ? 'unlocked' : isUnlocking ? 'unlocking' : isNext ? 'next' : 'locked'
                return (
                  <div key={f.name} className={`dm-feature-node ${statusClass}`}>
                    <span className="dm-feature-icon">{f.emoji || `F${featureNum}`}</span>
                    <div className="dm-feature-name">{f.name}</div>
                    <div className="dm-feature-status">{status}</div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // --- Marketing Step Logic ---
  const renderMarketingStep = () => {
    const regions: ('us' | 'asia' | 'europe')[] = ['us', 'asia', 'europe']
    // Use outsource unit cost as the minimum price (breakeven)
    const breakEvenPrice = outsourceUnitCostInflated

    return (
      <div className="dm-marketing">
        <div className="dm-marketing-grid">
          {regions.map(r => {
            const price = marketingDecision?.[r]?.price ?? GAME_CONFIG.priceDemand.baselinePriceByRegion[r]
            const promo = marketingDecision?.[r]?.promotionPct ?? 0
            // Set minimum price to outsource cost (rounded up to whole number)
            const minPrice = Math.ceil(breakEvenPrice)
            const maxPrice = Math.round(GAME_CONFIG.priceDemand.maxPriceByRegion?.[r] ?? price)
            // Calculate stable score: rewards competitive pricing (lower = better) and higher promo %
            const score = Math.min(100, Math.round(50 + (promo * 0.3) + ((1 - (price / maxPrice)) * 30)))
            const priceStep = 1 // Use whole number increments
            const regionColor = r === 'us' ? '#3b82f6' : r === 'asia' ? '#ec4899' : '#f59e0b'

            return (
              <div className="dm-m-card" key={r} style={{ borderTopColor: r === 'us' ? '#3b82f6' : r === 'asia' ? '#ec4899' : '#f59e0b' }}>
                <div className="dm-m-header">
                  <div className="dm-m-region">
                    {regionLabels[r]}
                    <InfoTooltip text={regionTooltipText[r]} label={`${regionLabels[r]} market characteristics`} />
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="dm-unlocked-title">Score</div>
                    <div className="dm-m-score-bar">
                      <span style={{ width: `${score}%`, background: regionColor }} />
                    </div>
                  </div>
                </div>
                <div className="dm-market-input">
                  <div className="dm-market-row">
                    <span>
                      Unit Price
                      <InfoTooltip text={tooltipCopy.unitPrice} label="Unit price info" />
                    </span>
                    <strong>{formatCurrencyFull(price)}</strong>
                  </div>
                  <div style={{ position: 'relative' }}>
                    <RangeWithButtons
                      min={minPrice}
                      max={maxPrice}
                      step={priceStep}
                      buttonStep={1000}
                      value={price}
                      disabled={isLocked}
                      ariaLabel={`${regionLabels[r]} unit price`}
                      onChange={(nextValue) => updateDecisionField('marketing', r, { ...marketingDecision[r], price: nextValue })}
                    />
                  </div>
                  <div className="dm-price-context">
                    <span style={{ color: '#64748b', fontWeight: 600 }}>
                      Min ${Math.round(minPrice / 1000)}k
                    </span>
                    <strong>Avg ${Math.round(GAME_CONFIG.priceDemand.baselinePriceByRegion[r] / 1000)}k</strong>
                    <span>Max ${Math.round(maxPrice / 1000)}k</span>
                  </div>
                </div>
                <div className="dm-market-input">
                  <div className="dm-market-row">
                    <span>
                      Promotion
                      <InfoTooltip text={tooltipCopy.promotion} label="Promotion budget info" />
                    </span>
                    <strong>{promo}%</strong>
                  </div>
                  <RangeWithButtons
                    min={0}
                    max={20}
                    step={1}
                    value={promo}
                    disabled={isLocked}
                    ariaLabel={`${regionLabels[r]} promotion`}
                    onChange={(nextValue) => updateDecisionField('marketing', r, { ...marketingDecision[r], promotionPct: nextValue })}
                  />
                  <div className="dm-promo-visual">
                    {Array.from({ length: 10 }).map((_, i) => (
                      <div
                        key={i}
                        className={`dm-promo-bar ${i < promo / 2 ? 'active' : ''}`}
                        style={i < promo / 2 ? { background: regionColor } : undefined}
                      />
                    ))}
                  </div>
                </div>
                <div className={`dm-m-tip ${price > GAME_CONFIG.priceDemand.baselinePriceByRegion[r] + 10 ? 'warning' : 'success'}`}>
                  {price > GAME_CONFIG.priceDemand.baselinePriceByRegion[r] + 10
                    ? '⚠ High price may hurt volume.'
                    : '✓ Competitive pricing.'}
                </div>
              </div>
            )
          })}
        </div>
        <div className="dm-prod-card">
          <div className="dm-prod-header"><div className="dm-prod-title">✨ Active Product Features</div></div>
          <div style={{ padding: '1.5rem' }}>
            {featureCatalog.slice(0, 12).map((feature, index) => {
              const featureNum = index + 1
              const isUnlocked = featureNum <= projectedFeatures
              const isUnlocking = featureNum > currentFeatures && featureNum <= projectedFeatures
              const statusClass = isUnlocked ? 'active' : 'locked'
              const statusLabel = isUnlocking ? 'Unlocking' : isUnlocked ? 'Unlocked' : 'Locked'
              return (
                <div key={feature.id ?? featureNum} className={`dm-f-tag ${statusClass}`}>
                  {feature.emoji ? `${feature.emoji} ` : ''}{feature.name} ({statusLabel})
                </div>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  // --- Finance Step Logic ---
  const renderFinanceStep = () => {
    const debtAction = financeBorrowing - financeRepayment
    const currentSTDebt = (prevRoundData as unknown)?.shortTermLoans ?? 0
    const totalProjectedDebt = currentDebt + currentSTDebt + financeBorrowing - financeRepayment
    const netLTDebt = currentDebt + financeBorrowing - financeRepayment
    const projectedDebtRatio = currentAssets > 0 ? totalProjectedDebt / currentAssets : 0

    // Widths for the stacked bar
    const ltBarWidth = maxDebt > 0 ? Math.min(100, (netLTDebt / maxDebt) * 100) : 0
    const stBarWidth = maxDebt > 0 ? Math.min(100 - ltBarWidth, (currentSTDebt / maxDebt) * 100) : 0
    const shareActionValue = shareActionMode === 'issue' ? financeShareIssue : financeShareBuyback
    const shareActionMax = shareActionMode === 'issue'
      ? maxIssueValue
      : Math.min(maxBuybackValue, maxBuybackCash)
    return (
      <div className="dm-finance">
        <div className="dm-finance-grid">
          <div className="dm-resource-card">
            <div className="dm-prod-header" style={{ padding: 0, background: 'transparent', border: 'none', marginBottom: '1rem' }}>
              <div className="dm-prod-title">
                🏦 Debt Management
                <InfoTooltip text={tooltipCopy.debt} label="Debt management info" />
              </div>
            </div>
            <div className="dm-debt-meter">
              <div className="dm-market-row"><span>Projected Debt / Limit</span><strong>{formatCurrency(totalProjectedDebt)} / {formatCurrency(maxDebt)}</strong></div>
              <div className="dm-debt-bar" style={{ display: 'flex' }}>
                <div className="dm-debt-fill" style={{ width: `${ltBarWidth.toFixed(1)}%` }} />
                <div className="dm-debt-fill-st" style={{ width: `${stBarWidth.toFixed(1)}%`, background: '#ef4444', transition: 'width 0.3s' }} />
              </div>
              <div className="dm-impact-muted">Debt Ratio: <strong>{formatPercent(projectedDebtRatio * 100)}</strong> (Safe &lt; 40%)</div>
              <div className="dm-impact-muted" style={{ marginTop: '0.25rem', fontSize: '0.65rem', display: 'flex', gap: '1rem' }}>
                <span><span style={{ display: 'inline-block', width: '8px', height: '8px', background: '#3b82f6', marginRight: '4px', borderRadius: '1px' }}></span>Long-term</span>
                <span><span style={{ display: 'inline-block', width: '8px', height: '8px', background: '#ef4444', marginRight: '4px', borderRadius: '1px' }}></span>Short-term (Overdraft)</span>
              </div>
            </div>
            <div className="dm-market-input">
              <div className="dm-market-row"><span>Action</span><strong style={{ color: 'var(--text-accent)' }}>{debtAction >= 0 ? '+' : ''}{formatCurrency(debtAction)}</strong></div>
              <RangeWithButtons
                min={minDebtAction}
                max={maxBorrowing}
                step={250000}
                value={debtAction}
                disabled={isLocked}
                ariaLabel="Debt action"
                onChange={(nextValue) => {
                  updateDecisionSection('finance', {
                    ...financeDecision,
                    borrowing: nextValue >= 0 ? nextValue : 0,
                    repayment: nextValue < 0 ? Math.abs(nextValue) : 0,
                  })
                }}
              />
              <div className="dm-price-context"><span>Repay {formatCurrency(Math.abs(minDebtAction))}</span><span>Borrow {formatCurrency(maxBorrowing)}</span></div>
              <div className="dm-impact-muted" style={{ marginTop: '0.5rem' }}>Max borrow: {formatCurrency(maxBorrowing)} | Max repay: {formatCurrency(Math.abs(minDebtAction))}</div>
            </div>
          </div>

          <div className="dm-resource-card">
            <div className="dm-prod-header" style={{ padding: 0, background: 'transparent', border: 'none', marginBottom: '1rem' }}>
              <div className="dm-prod-title">
                💎 Shareholder Value
                <InfoTooltip text={tooltipCopy.shareholder} label="Shareholder value info" />
              </div>
            </div>
            <div className="dm-market-input">
              <div className="dm-market-row"><span>Dividend Payout</span><strong>{formatCurrency(financeDividend)}</strong></div>
              <RangeWithButtons
                min={0}
                max={dividendMax}
                step={500000}
                value={financeDividend}
                disabled={isLocked}
                ariaLabel="Dividend payout"
                onChange={(nextValue) => {
                  const value = Math.min(nextValue, dividendMax)
                  updateDecisionSection('finance', { ...financeDecision, dividend: value })
                }}
              />
              <div className="dm-impact-muted" style={{ marginTop: '0.5rem' }}>
                Max allowed: {formatCurrency(dividendMax)} (keeps {formatCurrency(minCashReserve)} minimum cash)
              </div>
              {dividendBreachesReserve && (
                <div className="dm-inv-warning" style={{ marginTop: '0.5rem' }}>
                  Cannot go below the minimum cash requirement.
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
              <button
                className={`dm-finance-action issue ${shareActionMode === 'issue' ? 'active' : ''}`}
                style={{ flex: 1 }}
                onClick={() => setShareActionMode(shareActionMode === 'issue' ? null : 'issue')}
                aria-pressed={shareActionMode === 'issue'}
              >
                Issue Shares
              </button>
              <button
                className={`dm-finance-action buyback ${shareActionMode === 'buyback' ? 'active' : ''}`}
                style={{ flex: 1 }}
                onClick={() => setShareActionMode(shareActionMode === 'buyback' ? null : 'buyback')}
                aria-pressed={shareActionMode === 'buyback'}
              >
                Buyback
              </button>
            </div>
            {shareActionMode && (
              <div className="dm-market-input" style={{ marginTop: '1rem' }}>
                <div className="dm-market-row">
                  <span>{shareActionMode === 'issue' ? 'Share Issue' : 'Share Buyback'}</span>
                  <strong style={{ color: shareActionMode === 'issue' ? 'var(--text-accent)' : '#f59e0b' }}>
                    {formatCurrency(shareActionValue)}
                  </strong>
                </div>
                <RangeWithButtons
                  min={0}
                  max={shareActionMax}
                  step={1000000}
                  value={shareActionValue}
                  disabled={isLocked}
                  ariaLabel={shareActionMode === 'issue' ? 'Share issue' : 'Share buyback'}
                  onChange={(nextValue) => {
                    updateDecisionSection('finance', {
                      ...financeDecision,
                      shareIssue: shareActionMode === 'issue' ? nextValue : financeShareIssue,
                      shareBuyback: shareActionMode === 'buyback' ? nextValue : financeShareBuyback,
                    })
                  }}
                />
                <div className="dm-impact-muted" style={{ marginTop: '0.5rem' }}>
                  {shareActionMode === 'issue'
                    ? `Max issue: ${formatCurrency(maxIssueValue)}`
                    : `Max buyback: ${formatCurrency(Math.min(maxBuybackValue, maxBuybackCash))}`}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="dm-prod-card">
          <div className="dm-prod-header">
            <div className="dm-prod-title">
              🏗️ Factory Investment (CapEx)
              <InfoTooltip text={tooltipCopy.capex} label="Factory investment info" />
            </div>
          </div>
          <div style={{ padding: '1.5rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
            <div>
              <div className="dm-inv-row">
                <strong>{regionLabels.us} Factory</strong>
                <div className="dm-inv-btns">
                  <button className="dm-inv-btn" onClick={() => updateDecisionSection('finance', { ...financeDecision, newPlantsUS: Math.max(0, financePlantsUS - 1) })}>-</button>
                  <span className="dm-inv-count">{financePlantsUS}</span>
                  <button className="dm-inv-btn" disabled={!canAddUSPlant} onClick={() => updateDecisionSection('finance', { ...financeDecision, newPlantsUS: financePlantsUS + 1 })}>+</button>
                </div>
              </div>
              <div className="dm-inv-cost">Cost: <strong>{formatCurrency(plantCostUS)}</strong> per plant</div>
              {!canAddUSPlant && (
                <div className="dm-inv-warning">Short by {formatCurrency(usPlantShortfall)} to add a plant.</div>
              )}
            </div>
            <div>
              <div className="dm-inv-row asia">
                <strong>{regionLabels.asia} Factory</strong>
                <div className="dm-inv-btns">
                  <button className="dm-inv-btn" onClick={() => updateDecisionSection('finance', { ...financeDecision, newPlantsAsia: Math.max(0, financePlantsAsia - 1) })}>-</button>
                  <span className="dm-inv-count">{financePlantsAsia}</span>
                  <button className="dm-inv-btn" disabled={!canAddAsiaPlant} onClick={() => updateDecisionSection('finance', { ...financeDecision, newPlantsAsia: financePlantsAsia + 1 })}>+</button>
                </div>
              </div>
              <div className="dm-inv-cost">Cost: <strong>{formatCurrency(plantCostAsia)}</strong> per plant</div>
              {!canAddAsiaPlant && (
                <div className="dm-inv-warning">Short by {formatCurrency(asiaPlantShortfall)} to add a plant.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // --- Submit Step Logic ---
  const buildDbPayloadFromCurrent = (decision: unknown) => {
    if (!decision) return {}
    const prod = decision.production || {}
    const mkt = decision.marketing || {}
    const fin = decision.finance || {}
    const inv = decision.investment || {}
    const hr = decision.hr || {}
    const rnd = decision.rnd || {}
    const logistics = decision.logistics || {}
    return {
      production: {
        usUnits: prod.usUnits,
        asiaUnits: prod.asiaUnits,
        outsourceUS: prod.outsourceUS,
        outsourceAsia: prod.outsourceAsia,
        overtime: prod.overtime,
        supplierUS: prod.supplierUS,
        supplierAsia: prod.supplierAsia,
      },
      marketing: {
        priceUS: mkt.us?.price ?? mkt.priceUS,
        priceAsia: mkt.asia?.price ?? mkt.priceAsia,
        priceEurope: mkt.europe?.price ?? mkt.priceEurope,
        promoUS: mkt.us?.promotionPct ?? mkt.promoUS,
        promoAsia: mkt.asia?.promotionPct ?? mkt.promoAsia,
        promoEurope: mkt.europe?.promotionPct ?? mkt.promoEurope,
      },
      hr,
      rnd,
      logistics,
      finance: {
        borrowing: fin.borrowing ?? fin.longTermDebt ?? 0,
        repayment: fin.repayment ?? 0,
        shareIssue: fin.shareIssue ?? 0,
        shareBuyback: fin.shareBuyback ?? 0,
        dividend: fin.dividend ?? fin.dividends ?? 0,
        newPlantsUS: fin?.newPlantsUS ?? inv?.newPlantsUS ?? 0,
        newPlantsAsia: fin?.newPlantsAsia ?? inv?.newPlantsAsia ?? 0,
      },
      investment: {
        newPlantsUS: fin?.newPlantsUS ?? inv?.newPlantsUS ?? 0,
        newPlantsAsia: fin?.newPlantsAsia ?? inv?.newPlantsAsia ?? 0,
      },
    }
  }

  const clearAutoAdvancePoll = useCallback(() => {
    if (autoAdvancePollRef.current) {
      clearInterval(autoAdvancePollRef.current)
      autoAdvancePollRef.current = null
    }
  }, [])

  useEffect(() => {
    return () => {
      clearAutoAdvancePoll()
    }
  }, [clearAutoAdvancePoll])

  const handleSubmit = async () => {
    if (isLocked || submitting) return
    if (!team?.id || game?.currentRound === undefined) {
      setSubmitted(true)
      return
    }

    setSubmitting(true)
    setSubmitError(null)

    // Save any pending changes before submitting
    if (pendingSectionRef.current) {
      const { section, data } = pendingSectionRef.current
      await persistDecisionSection(section, data)
      pendingSectionRef.current = null
    }

    const payload = buildDbPayloadFromCurrent(currentDecision)
    try {
      // Save final decisions first
      await teamApi.saveDecision(team.id, game.currentRound, payload)
      // Then call submit endpoint to lock decisions
      await teamApi.submitDecision(team.id, game.currentRound)
      if (game?.id) {
        const key = `decisions-modern-submitted-${game.id}-${team.id}-${game.currentRound}`
        const now = new Date().toISOString()
        try {
          localStorage.setItem(key, now)
        } catch {
          // Ignore storage errors.
        }
        setLocalSubmittedAt(now)
      }
      setSubmitted(true)
      setSubmitting(false)

      // Auto-advance logic for demo mode or games with all AI opponents
      const autoAdvance = sessionStorage.getItem('autoAdvance') === 'true'
      const demoGameId = sessionStorage.getItem('demoGameId')
      const isCurrentDemoGame = demoGameId === String(game?.id)
      if (autoAdvance && game?.id && isCurrentDemoGame) {
        try {
          const response = await gameApi.get(game.id, { mode: 'lite' })
          const freshGame = response.game as unknown
          const gameCompleted = String(freshGame?.status || '').toUpperCase() === 'COMPLETED'
          const alreadyAdvanced = (freshGame?.currentRound ?? 0) > game.currentRound

          if (alreadyAdvanced || gameCompleted) {
            navigate('/results')
            return
          }

          const teams = freshGame?.teams || []
          const humanTeams = teams.filter((t: unknown) => !t.isComputer)
          const aiTeams = teams.filter((t: unknown) => t.isComputer)
          const submittedHumans = humanTeams.filter((t: unknown) => {
            const currentDecision = t.decisions?.find((d: unknown) => d.roundNumber === freshGame.currentRound)
            return currentDecision?.isSubmitted === true
          }).length
          const isOneHumanVsAI = humanTeams.length === 1 && aiTeams.length > 0

          const shouldAdvanceNow =
            freshGame?.status === 'ACTIVE' &&
            freshGame?.currentRound === game.currentRound &&
            isOneHumanVsAI &&
            submittedHumans >= humanTeams.length

          if (shouldAdvanceNow) {
            await gameApi.advance(game.id)
          }
        } catch (err) {
          console.error('Immediate auto-advance check failed:', err)
        }

        // Poll game status to check when results are ready
        let pollCount = 0
        const maxPolls = 30 // Poll for up to 30 seconds

        clearAutoAdvancePoll()
        const pollInterval = setInterval(async () => {
          pollCount++

          try {
            // Fetch fresh game data
            const response = await gameApi.get(game.id, { mode: 'lite' })
            const freshGame = response.game as unknown

            // Check if we're already past this round (results calculated)
            if (freshGame.currentRound > game.currentRound || String(freshGame.status || '').toUpperCase() === 'COMPLETED') {
              clearInterval(pollInterval)
              if (autoAdvancePollRef.current === pollInterval) autoAdvancePollRef.current = null
              navigate('/results')
              return
            }

            // Stop polling after max attempts
            if (pollCount >= maxPolls) {
              clearInterval(pollInterval)
              if (autoAdvancePollRef.current === pollInterval) autoAdvancePollRef.current = null
            }
          } catch (err) {
            console.error('Auto-advance polling error:', err)
            // Stop polling on error
            clearInterval(pollInterval)
            if (autoAdvancePollRef.current === pollInterval) autoAdvancePollRef.current = null
          }
        }, 1000) // Poll every second
        autoAdvancePollRef.current = pollInterval
      }
    } catch (err) {
      console.error('Failed to submit decisions', err)
      setSubmitting(false)
      setSubmitError(err instanceof Error ? err.message : 'Failed to submit decisions. Please try again.')
    }
  }

  const renderSubmitStep = () => {
    if (submitted && !isLocked) {
      return (
        <div className="dm-success-screen">
          <div className="dm-check-circle">✓</div>
          <h1 style={{ fontSize: '2rem' }}>Decisions Locked</h1>
          <p style={{ color: '#64748b', maxWidth: '400px' }}>Your Round {currentRound} strategy has been securely transmitted. Waiting for other teams...</p>
          <button className="dm-nav dm-nav-secondary" style={{ marginTop: '2rem', border: '1px solid #e2e8f0' }} onClick={() => navigate('/mission')}>Return to Mission</button>
        </div>
      )
    }
    return (
      <div className="dm-submit">
        <div className="dm-audit-grid">
          {
            // Prepare a list of summary cards to render; each corresponds to a decision step
            (
              [
                {
                  id: 'forecast',
                  title: '📈 Forecast',
                  isRegional: true,
                  editIndex: 1,
                  rows: [
                    { label: 'Projected Sales (Units)', value: formatUnits(forecastProjectedTotal) },
                    {
                      label: `Growth Targets (${regionLabels.us} / ${regionLabels.asia} / ${regionLabels.europe})`,
                      value: `${formatGrowthTarget(forecastShareTargets.us)} / ${formatGrowthTarget(forecastShareTargets.asia)} / ${formatGrowthTarget(forecastShareTargets.europe)}`
                    },
                  ],
                },
                {
                  id: 'production',
                  title: '🏭 Production',
                  isRegional: true,
                  editIndex: 2,
                  rows: [
                    { label: 'Output (Units)', value: formatUnits(prodTotalOutput) },
                    {
                      label: costCapacity.asiaFactoryCount > 0
                        ? `CSR Supplier (${regionLabels.us} / ${regionLabels.asia})`
                        : `CSR Supplier (${regionLabels.us})`,
                      value: costCapacity.asiaFactoryCount > 0
                        ? `${getSupplierCsrLabel(costDecisions.production?.supplierUS ?? GAME_CONFIG.defaults.production.supplierUS ?? 1)} / ${getSupplierCsrLabel(costDecisions.production?.supplierAsia ?? GAME_CONFIG.defaults.production.supplierAsia ?? 1)}`
                        : `${getSupplierCsrLabel(costDecisions.production?.supplierUS ?? GAME_CONFIG.defaults.production.supplierUS ?? 1)}`,
                    },
                    { label: 'Status', value: prodShortage > 0 ? 'Shortage' : 'Balanced', tone: prodShortage > 0 ? 'negative' : 'positive' },
                  ],
                },
                {
                  id: 'logistics',
                  title: '🚚 Logistics',
                  isRegional: true,
                  editIndex: 3,
                  rows: [
                    { label: 'Availability (Units)', value: formatUnits(logAvailability) },
                    { label: 'Fulfillment', value: `${Math.round(((logisticsFulfillment.us + logisticsFulfillment.asia + logisticsFulfillment.europe) / 3) * 100)}%` },
                  ],
                },
                {
                  id: 'rnd',
                  title: '🔬 R&D',
                  editIndex: 4,
                  rows: [
                    { label: 'Staff', value: String(rndStaff) },
                    { label: 'Training', value: String(rndTraining) },
                    { label: 'Training Cost', value: formatCurrency(totalTrainingCost * currentCostInflation) },
                    { label: 'Features Available', value: `${projectedFeatures}` },
                  ],
                },
                {
                  id: 'marketing',
                  title: '📢 Marketing',
                  isRegional: true,
                  editIndex: 5,
                  rows: [
                    { label: `Price (${regionLabels.us} / ${regionLabels.asia} / ${regionLabels.europe})`, value: `${formatCurrency(marketingPrices.us)} / ${formatCurrency(marketingPrices.asia)} / ${formatCurrency(marketingPrices.europe)}` },
                    { label: `Promotions (${regionLabels.us} / ${regionLabels.asia} / ${regionLabels.europe})`, value: `${marketingPromos.us}% / ${marketingPromos.asia}% / ${marketingPromos.europe}%` },
                  ],
                },
                {
                  id: 'finance',
                  title: '💰 Finance',
                  editIndex: 6,
                  rows: [
                    { label: 'Debt Action', value: formatCurrency(financeBorrowing - financeRepayment) },
                    { label: 'Shares Action', value: formatCurrency(financeShareIssue - financeShareBuyback) },
                    { label: 'Dividends', value: formatCurrency(-financeDividend) },
                    { label: `New Plants (${regionLabels.us} / ${regionLabels.asia})`, value: `${financePlantsUS} / ${financePlantsAsia}`, isRegional: true },
                    { label: 'Proj. Cash', value: formatCurrency(projectedEndingCash) },
                  ],
                },
              ]
            ).map((card) => (
              <div className="dm-audit-card" key={card.id}>
                <div className="dm-audit-head">
                  <div className="dm-audit-title">{card.title}</div>
                  <button
                    className="dm-logout"
                    style={{
                      background: 'none',
                      color: isLocked ? '#94a3b8' : '#2563eb',
                      padding: 0,
                      cursor: isLocked ? 'not-allowed' : 'pointer',
                      opacity: isLocked ? 0.6 : 1,
                    }}
                    disabled={isLocked}
                    onClick={() => {
                      if (!isLocked) {
                        setActiveStepIndex((card as unknown).editIndex)
                      }
                    }}
                  >
                    {isLocked ? 'Locked' : 'Edit'}
                  </button>
                </div>
                {card.rows.map((r: unknown, idx: number) => (
                  <div className="dm-audit-row" key={idx}>
                    <span>{r.label}</span>
                    <span className="dm-audit-val" style={r.tone === 'negative' ? { color: '#ef4444', fontWeight: 700 } : undefined}>
                      {typeof r.value === 'string' && r.value.includes(' / ') ? (
                        // Split slash-separated values onto separate lines
                        // Apply regional colors only if card or row is marked as regional
                        r.value.split(' / ').map((part: string, i: number) => {
                          const isRegional = (card as unknown).isRegional || r.isRegional
                          const regionKey = isRegional ? (['us', 'asia', 'europe'][i] || 'us') : 'neutral'
                          return (
                            <div key={i} className={`region-val ${regionKey}`} style={{ whiteSpace: 'nowrap' }}>{part}</div>
                          )
                        })
                      ) : (
                        r.value
                      )}
                    </span>
                  </div>
                ))}
              </div>
            ))
          }
        </div>
        <div className="dm-submit-action">
          <span className="dm-submit-icon">🚀</span>
          {isGameComplete ? (
            <>
              <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Game Complete</h2>
              <p style={{ color: '#64748b', marginBottom: '2rem' }}>
                Final results are ready. View the results to see the outcome.
              </p>
              <button className="dm-submit-btn-big" onClick={() => navigate('/results')}>
                View Results →
              </button>
            </>
          ) : isLocked ? (
            <>
              <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Submitted</h2>
              <p style={{ color: '#64748b', marginBottom: '2rem' }}>
                Submitted {submittedAtLabel || 'just now'}. Waiting for decision.
              </p>
            </>
          ) : (
            <>
              <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Ready to Commit?</h2>
              <p style={{ color: '#64748b', marginBottom: '2rem' }}>Once submitted, your decisions are locked for Round {currentRound}.</p>
              {submitError && (
                <div style={{
                  background: '#fee2e2',
                  border: '1px solid #ef4444',
                  borderRadius: '8px',
                  padding: '12px 16px',
                  marginBottom: '1rem',
                  color: '#991b1b',
                  fontSize: '0.875rem'
                }}>
                  {submitError}
                </div>
              )}
              <button
                className="dm-submit-btn-big"
                onClick={handleSubmit}
                disabled={submitting}
                style={submitting ? { opacity: 0.7, cursor: 'not-allowed' } : undefined}
              >
                {submitting ? (
                  <>
                    <span style={{ display: 'inline-block', marginRight: '8px' }}>⏳</span>
                    Submitting Decisions...
                  </>
                ) : (
                  'Lock & Submit Decisions →'
                )}
              </button>
            </>
          )}
        </div>
      </div>
    )
  }

  if (!authReady) {
    return (
      <div className="decisions-modern" aria-busy="true">
        <CliPhaseLoader className="dm-loading dm-loading-cli" />
      </div>
    )
  }
  if (!team || !game) return <Navigate to="/" replace />

  // Subtitle per-step to give contextual guidance in the header
  const stepSubtitles: Record<string, string> = {
    review: 'Starting assumptions All teams begin with the same position.',
    forecast: 'Set Growth Forecast',
    production: 'Set your manufacturing targets to meet expected demand.',
    logistics: 'Allocate your production to markets and set delivery priorities.',
    rnd: 'Hire research staff to generate research hours, then unlock product features.',
    marketing: 'Set your pricing and advertising budgets for each region.',
    finance: 'Invest in new factories, and handle shareholder actions.',
    submit: 'Review and submit your decisions.'
  }

  return (
    <div className="decisions-modern">
      <div className="dm-shell">
        <aside className="dm-sidebar">
          <a className="dm-company dm-company-link" href="/landing" target="_blank" rel="noreferrer">
            <div className="dm-company-logo">
              {industryIcon && <img src={industryIcon} alt="Company logo" />}
            </div>
            <div>
              <div className="dm-company-name">{teamName}</div>
              <div className="dm-company-meta">{game?.industry || 'Industry'}</div>
            </div>
          </a>

          <nav className="dm-nav">
            {MAIN_NAV.map((item) => {
              const isActive = item.path === '/decisions'
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
                      {visibleSteps.map((step, index) => {
                        const isStepActive = index === activeStepIndex
                        const isCompleted = visitedSteps.has(index) && !isStepActive
                        return (
                          <button
                            key={step.id}
                            type="button"
                            className={`dm-subnav-item ${isStepActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}
                            onClick={() => setActiveStepIndex(index)}
                          >
                            <span className="dm-subnav-icon">{isCompleted ? '✓' : index + 1}</span>
                            <span className="dm-subnav-label">{step.label}</span>
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
          <header className={`dm-header ${saveStatus !== 'idle' ? 'dm-header-save-active' : ''} ${saveStatus === 'saved' ? 'dm-header-save-saved' : ''}`}>
            <div>
              <h1>{activeVisibleStep.label}</h1>
              <p>{stepSubtitles[activeVisibleStep.id] ?? 'Build your decisions step by step.'}</p>
            </div>
            <div className="dm-header-controls">
              {showResultsNotice && (
                <button
                  type="button"
                  className="dm-results-cta"
                  onClick={() => navigate('/results', { state: { refreshKey: Date.now() } })}
                >
                  {resultsNoticeLabel}
                </button>
              )}
              <div className="dm-timer">
                <span>Time</span>
                {timeRemainingLabel}
              </div>
              <div className={`dm-save-status ${saveStatus}`}>
                {saveStatus === 'saving' && 'Saving...'}
                {saveStatus === 'saved' && 'Saved'}
                {saveStatus === 'error' && 'Save failed'}
                {saveStatus === 'idle' && ' '}
              </div>
              <button
                ref={sessionMenuRef}
                type="button"
                className="dm-session"
                onClick={() => setSessionOpen((open) => !open)}
              >
                <span className="dm-session-round dm-session-small">{roundLabel}</span>
                <span className="dm-session-scenario dm-session-small">{gameName}</span>
                <span className="dm-session-caret">▾</span>
                {sessionOpen && (
                  <span className="dm-session-menu" onClick={(event) => event.stopPropagation()}>
                    <span className="dm-menu-row">
                      <span className="dm-menu-label">Game Code</span>
                      <span className="dm-menu-value">{gameCode}</span>
                    </span>
                    <span className="dm-menu-row">
                      <span className="dm-menu-label">Team</span>
                      <span className="dm-menu-value">{teamName}</span>
                    </span>
                    <span className="dm-menu-row">
                      <span className="dm-menu-label">Team Code</span>
                      <span className="dm-menu-value">{teamCode}</span>
                    </span>
                    <div style={{ borderTop: '1px solid var(--border-light)', marginTop: '0.25rem', paddingTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', alignItems: 'center' }}>
                      <button type="button" className="dm-logout" onClick={() => { logout(); navigate('/') }}>
                        🚪 Log Out
                      </button>
                    </div>
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

          <div className={`dm-workspace ${activeStep.id === 'review' ? 'dm-no-impact' : ''}`}>
            <section className="dm-content">
              <div className="dm-scroll">

                {activeStep.id === 'review' ? (
                  prevRoundData ? (
                    <div className="dm-review">
                      <div className="main-grid" style={{ marginBottom: '2rem' }}>
                        <div className="left-col">
                          {/* Strategic Market Intelligence Panel */}
                          <div className="dm-market-intelligence" style={{
                            background: 'var(--bg-card)',
                            borderRadius: '12px',
                            padding: '1.5rem',
                            marginBottom: '1.5rem',
                            border: '1px solid var(--border-color)'
                          }}>
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.5rem',
                              marginBottom: '1.5rem'
                            }}>
                              <span style={{ fontSize: '1.5rem' }}>📊</span>
                              <h3 style={{ fontSize: '1.25rem', fontWeight: 600, margin: 0 }}>Regional Market Strategy Guide</h3>
                            </div>

                            {(() => {
                              const intel = getMarketIntelligence(
                                scenario,
                                scenarioDemandModifiers,
                                interestRateSpread,
                                csrModifier,
                                scenario?.logisticsTariff
                              )
                              return (
                                <>
                                  {/* Global Scenario Effects (if any) */}
                                  {intel.global && intel.global.length > 0 && (
                                    <div style={{
                                      marginBottom: '1.5rem',
                                      padding: '1rem',
                                      background: theme === 'dark'
                                        ? 'linear-gradient(135deg, rgba(30, 58, 138, 0.22) 0%, rgba(15, 23, 42, 0.42) 100%)'
                                        : 'linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(239, 68, 68, 0.15) 100%)',
                                      borderRadius: '8px',
                                      border: theme === 'dark'
                                        ? '1px solid rgba(96, 165, 250, 0.42)'
                                        : '2px solid rgba(245, 158, 11, 0.4)'
                                    }}>
                                      <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                        marginBottom: '0.75rem'
                                      }}>
                                        <span style={{ fontSize: '1.25rem' }}>⚠️</span>
                                        <h4 style={{
                                          fontSize: '1rem',
                                          fontWeight: 700,
                                          margin: 0,
                                          color: theme === 'dark' ? '#93c5fd' : '#f59e0b'
                                        }}>
                                          THIS ROUND: Global Market Conditions
                                        </h4>
                                      </div>

                                      {/* Round Summary */}
                                      <div style={{
                                        fontSize: '0.95rem',
                                        lineHeight: '1.6',
                                        color: 'var(--text-main)',
                                        marginBottom: '0.75rem',
                                        padding: '0.75rem',
                                        background: theme === 'dark' ? 'rgba(15, 23, 42, 0.58)' : 'rgba(0, 0, 0, 0.03)',
                                        borderRadius: '6px',
                                        borderLeft: `3px solid ${theme === 'dark' ? '#60a5fa' : '#f59e0b'}`
                                      }}>
                                        {emphasizeNumbers(reviewSummaryText)}
                                      </div>

                                      <div style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '0.5rem'
                                      }}>
                                        {intel.global.map((note, idx) => (
                                          <div key={idx} style={{
                                            fontSize: '0.85rem',
                                            lineHeight: '1.5',
                                            color: 'var(--text-main)',
                                            padding: '0.5rem',
                                            background: theme === 'dark' ? 'rgba(30, 41, 59, 0.62)' : 'rgba(0, 0, 0, 0.04)',
                                            border: theme === 'dark' ? '1px solid rgba(148, 163, 184, 0.18)' : 'none',
                                            borderRadius: '4px',
                                            fontWeight: 500
                                          }}>
                                            {note}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {/* Region Tabs */}
                                  <div style={{
                                    display: 'flex',
                                    gap: '0.5rem',
                                    marginBottom: '1.5rem',
                                    borderBottom: '1px solid var(--border-color)',
                                    paddingBottom: '0.5rem'
                                  }}>
                                    <button
                                      onClick={() => setSelectedRegionTab('us')}
                                      style={{
                                        background: selectedRegionTab === 'us' ? '#3b82f6' : theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                                        color: selectedRegionTab === 'us' ? '#ffffff' : 'var(--text-main)',
                                        border: `1px solid ${selectedRegionTab === 'us' ? '#3b82f6' : 'var(--border-color)'}`,
                                        padding: '0.5rem 1rem',
                                        fontSize: '0.85rem',
                                        fontWeight: 600,
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem'
                                      }}
                                    >
                                      🇺🇸 {regionLabels.us}
                                    </button>
                                    <button
                                      onClick={() => setSelectedRegionTab('asia')}
                                      style={{
                                        background: selectedRegionTab === 'asia' ? '#3b82f6' : theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                                        color: selectedRegionTab === 'asia' ? '#ffffff' : 'var(--text-main)',
                                        border: `1px solid ${selectedRegionTab === 'asia' ? '#3b82f6' : 'var(--border-color)'}`,
                                        padding: '0.5rem 1rem',
                                        fontSize: '0.85rem',
                                        fontWeight: 600,
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem'
                                      }}
                                    >
                                      🌏 {regionLabels.asia}
                                    </button>
                                    <button
                                      onClick={() => setSelectedRegionTab('europe')}
                                      style={{
                                        background: selectedRegionTab === 'europe' ? '#3b82f6' : theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                                        color: selectedRegionTab === 'europe' ? '#ffffff' : 'var(--text-main)',
                                        border: `1px solid ${selectedRegionTab === 'europe' ? '#3b82f6' : 'var(--border-color)'}`,
                                        padding: '0.5rem 1rem',
                                        fontSize: '0.85rem',
                                        fontWeight: 600,
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem'
                                      }}
                                    >
                                      🇪🇺 {regionLabels.europe}
                                    </button>
                                  </div>

                                  {/* North America */}
                                  {selectedRegionTab === 'us' && (
                                  <div style={{
                                    marginBottom: '1.5rem',
                                    paddingBottom: '1.5rem',
                                    borderBottom: '1px solid var(--border-color)'
                                  }}>
                                    <div style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '0.5rem',
                                      marginBottom: '0.75rem'
                                    }}>
                                      <span style={{ fontSize: '1.25rem' }}>🇺🇸</span>
                                      <h4 style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>North America</h4>
                                    </div>
                                    <p style={{
                                      fontSize: '0.95rem',
                                      color: 'var(--text-muted)',
                                      fontStyle: 'italic',
                                      marginBottom: '0.5rem'
                                    }}>
                                      {intel.us.character}
                                    </p>
                                    <p style={{
                                      fontSize: '0.875rem',
                                      lineHeight: '1.6',
                                      marginBottom: '0.75rem',
                                      color: 'var(--text-secondary)'
                                    }}>
                                      <strong>What Drives Sales:</strong> {intel.us.salesDrivers}
                                    </p>
                                    <p style={{
                                      fontSize: '0.875rem',
                                      background: 'var(--bg-hover)',
                                      padding: '0.75rem',
                                      borderRadius: '6px',
                                      margin: 0,
                                      borderLeft: '3px solid #3b82f6'
                                    }}>
                                      <strong>Strategy:</strong> {intel.us.strategy}
                                    </p>

                                    {/* Competitive Positioning */}
                                    {(() => {
                                      const myPrice = marketIntelData.myTeam?.prices?.us ?? gameConfig.priceDemand.baselinePriceByRegion.us
                                      const avgPrice = marketIntelData.avgPrices.us
                                      const myPromo = marketIntelData.myTeam?.promos?.us ?? gameConfig.defaults.marketing.promotionPctByRegion.us
                                      const avgPromo = marketIntelData.avgPromos.us
                                      const myFeatures = marketIntelData.features
                                      const avgFeatures = marketIntelData.avgFeatures
                                      const myCSR = marketIntelData.csrRating
                                      const avgCSR = marketIntelData.avgCSR

                                      const priceDiff = avgPrice > 0 ? ((myPrice - avgPrice) / avgPrice) * 100 : 0
                                      const promoDiff = avgPromo > 0 ? ((myPromo - avgPromo) / avgPromo) * 100 : 0
                                      const featuresDiff = avgFeatures > 0 ? ((myFeatures - avgFeatures) / avgFeatures) * 100 : 0
                                      const csrDiff = avgCSR > 0 ? ((myCSR - avgCSR) / avgCSR) * 100 : 0

                                      const getPriceText = () => {
                                        if (priceDiff > 10) return `priced significantly above market (${formatCurrencyFull(myPrice)} vs ${formatCurrencyFull(avgPrice)} avg). This premium positioning signals quality but watch sales volume.`
                                        if (priceDiff > 5) return `priced moderately above market (${formatCurrencyFull(myPrice)} vs ${formatCurrencyFull(avgPrice)} avg). Reasonable premium if features and brand justify it.`
                                        if (priceDiff < -10) return `priced significantly below market (${formatCurrencyFull(myPrice)} vs ${formatCurrencyFull(avgPrice)} avg). High-volume strategy but margins are thin - ensure production efficiency.`
                                        if (priceDiff < -5) return `priced moderately below market (${formatCurrencyFull(myPrice)} vs ${formatCurrencyFull(avgPrice)} avg). Value positioning to drive volume.`
                                        return `priced at market average (${formatCurrencyFull(myPrice)}). Competing on level ground - differentiate through other factors.`
                                      }

                                      const getPromoText = () => {
                                        if (promoDiff > 15) return `marketing spend is ${myPromo.toFixed(0)}% vs ${avgPromo.toFixed(0)}% average - strong brand investment driving visibility.`
                                        if (promoDiff > 5) return `marketing spend is ${myPromo.toFixed(0)}% vs ${avgPromo.toFixed(0)}% average - moderate promotional advantage.`
                                        if (promoDiff < -15) return `marketing spend is ${myPromo.toFixed(0)}% vs ${avgPromo.toFixed(0)}% average - being outspent by competitors. Consider increasing to maintain visibility.`
                                        if (promoDiff < -5) return `marketing spend is ${myPromo.toFixed(0)}% vs ${avgPromo.toFixed(0)}% average - below market investment.`
                                        return `marketing spend matches the ${avgPromo.toFixed(0)}% industry average - balanced promotional approach.`
                                      }

                                      const getFeaturesText = () => {
                                        if (featuresDiff > 15) return `leading with ${myFeatures} features vs ${avgFeatures.toFixed(1)} average - strong innovation advantage justifying premium pricing.`
                                        if (featuresDiff > 5) return `ahead with ${myFeatures} features vs ${avgFeatures.toFixed(1)} average - moderate technological edge.`
                                        if (featuresDiff < -15) return `trailing with ${myFeatures} features vs ${avgFeatures.toFixed(1)} average - significant innovation gap limiting premium pricing ability.`
                                        if (featuresDiff < -5) return `behind with ${myFeatures} features vs ${avgFeatures.toFixed(1)} average - consider R&D investment to catch up.`
                                        return `at ${myFeatures} features matching ${avgFeatures.toFixed(1)} average - keeping pace on innovation.`
                                      }

                                      const getCSRText = () => {
                                        if (csrDiff > 10) return `Your CSR (Corporate Social Responsibility - ethical and sustainable practices) rating of ${myCSR.toFixed(1)} beats ${avgCSR.toFixed(1)} average. Strong "green" reputation supporting brand loyalty.`
                                        if (csrDiff > 5) return `Your CSR (Corporate Social Responsibility - ethical and sustainable practices) rating of ${myCSR.toFixed(1)} exceeds ${avgCSR.toFixed(1)} average. Solid sustainability reputation.`
                                        if (csrDiff < -10) return `Your CSR (Corporate Social Responsibility - ethical and sustainable practices) rating of ${myCSR.toFixed(1)} trails ${avgCSR.toFixed(1)} average. Weaker sustainability hurts brand in conscious markets.`
                                        if (csrDiff < -5) return `Your CSR (Corporate Social Responsibility - ethical and sustainable practices) rating of ${myCSR.toFixed(1)} below ${avgCSR.toFixed(1)} average. Consider upgrading supplier sustainability.`
                                        return `Your CSR (Corporate Social Responsibility - ethical and sustainable practices) rating of ${myCSR.toFixed(1)} matches ${avgCSR.toFixed(1)} average. Standard sustainability practices.`
                                      }

                                      return (
                                        <div style={{
                                          marginTop: '1rem',
                                          padding: '0.75rem',
                                          background: 'rgba(59, 130, 246, 0.05)',
                                          borderRadius: '6px',
                                          border: '1px solid rgba(59, 130, 246, 0.2)',
                                          fontSize: '0.8rem',
                                          lineHeight: '1.6',
                                          color: 'var(--text-secondary)'
                                        }}>
                                          <div style={{ fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text-main)', fontSize: '0.85rem' }}>
                                            📊 Your Competitive Position
                                          </div>
                                          <div style={{ marginBottom: '0.4rem' }}><strong>Pricing:</strong> You're {getPriceText()}</div>
                                          <div style={{ marginBottom: '0.4rem' }}><strong>Marketing:</strong> Your {getPromoText()}</div>
                                          <div style={{ marginBottom: '0.4rem' }}><strong>Innovation:</strong> You're {getFeaturesText()}</div>
                                          <div><strong>Sustainability:</strong> {getCSRText()}</div>
                                        </div>
                                      )
                                    })()}

                                    {/* Market Supply-Demand */}
                                    {(() => {
                                      const regionData = supplyDemandData.us
                                      const supply = regionData.supply
                                      const demand = regionData.demand
                                      const gap = supply - demand
                                      const status = regionData.status

                                      let statusText = ''
                                      let statusColor = ''
                                      let insight = ''

                                      if (status === 'saturated') {
                                        statusText = 'Oversupply'
                                        statusColor = '#10b981'
                                        insight = `The market sold ${formatUnits(supply)} units but had capacity for ${formatUnits(demand)} units - ${formatUnits(Math.abs(gap))} units of surplus inventory. This oversupply puts downward pressure on prices. Consider reducing production or increasing marketing to move excess stock.`
                                      } else if (status === 'shortage') {
                                        statusText = 'Shortfall'
                                        statusColor = '#ef4444'
                                        insight = `The market had ${formatUnits(demand)} units of demand but only ${formatUnits(supply)} units were sold - ${formatUnits(Math.abs(gap))} units of unmet customer demand. This shortage creates pricing power. Consider increasing production capacity to capture this opportunity before competitors do.`
                                      } else {
                                        statusText = 'Balanced'
                                        statusColor = '#3b82f6'
                                        insight = `Market supply and demand are well-balanced at around ${formatUnits(supply)} units. Neither shortage nor oversupply - a healthy equilibrium. Focus on differentiation rather than volume plays.`
                                      }

                                      return (
                                        <div style={{
                                          marginTop: '1rem',
                                          padding: '0.75rem',
                                          background: 'rgba(59, 130, 246, 0.03)',
                                          borderRadius: '6px',
                                          border: '1px solid rgba(59, 130, 246, 0.15)',
                                          fontSize: '0.8rem',
                                          lineHeight: '1.6',
                                          color: 'var(--text-secondary)'
                                        }}>
                                          <div style={{ fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text-main)', fontSize: '0.85rem' }}>
                                            📈 Market Supply vs Demand
                                          </div>
                                          <div style={{ marginBottom: '0.5rem' }}>
                                            <strong style={{ color: statusColor }}>{statusText}:</strong> {insight}
                                          </div>
                                        </div>
                                      )
                                    })()}

                                    {/* Financial Environment - North America */}
                                    {(() => {
                                      const baseTaxRate = GAME_CONFIG.financial.taxRateByRegion.us
                                      const taxDelta = scenario?.taxRateDeltaByRegion?.us ?? 0
                                      const currentTaxRate = baseTaxRate + taxDelta

                                      const baseInterestRate = GAME_CONFIG.financial.interestRate
                                      const interestSpread = scenario?.interestRateSpread ?? 0
                                      const currentInterestRate = baseInterestRate + interestSpread

                                      return (
                                        <div style={{
                                          marginTop: '1rem',
                                          padding: '0.75rem',
                                          background: 'rgba(251, 191, 36, 0.05)',
                                          borderRadius: '6px',
                                          border: '1px solid rgba(251, 191, 36, 0.2)',
                                          fontSize: '0.8rem',
                                          lineHeight: '1.6',
                                          color: 'var(--text-secondary)'
                                        }}>
                                          <div style={{ fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text-main)', fontSize: '0.85rem' }}>
                                            💰 Financial Environment
                                          </div>
                                          <div style={{ marginBottom: '0.4rem' }}>
                                            <strong>Tax Rate:</strong> {formatPercent(currentTaxRate * 100)}
                                            {Math.abs(taxDelta) > 0.01 && (
                                              <span style={{ color: taxDelta > 0 ? '#ef4444' : '#10b981', fontWeight: 600 }}>
                                                {' '}({taxDelta > 0 ? '↑' : '↓'} {taxDelta > 0 ? 'increased' : 'decreased'} from {formatPercent(baseTaxRate * 100)})
                                              </span>
                                            )}
                                          </div>
                                          <div>
                                            <strong>Interest Rate:</strong> {formatPercent(currentInterestRate * 100)}
                                            {Math.abs(interestSpread) > 0.002 && (
                                              <span style={{ color: interestSpread > 0 ? '#ef4444' : '#10b981', fontWeight: 600 }}>
                                                {' '}({interestSpread > 0 ? '↑' : '↓'} {interestSpread > 0 ? 'rising' : 'falling'} from {formatPercent(baseInterestRate * 100)})
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      )
                                    })()}
                                  </div>
                                  )}

                                  {/* Asia-Pacific */}
                                  {selectedRegionTab === 'asia' && (
                                  <div style={{
                                    marginBottom: '1.5rem',
                                    paddingBottom: '1.5rem',
                                    borderBottom: '1px solid var(--border-color)'
                                  }}>
                                    <div style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '0.5rem',
                                      marginBottom: '0.75rem'
                                    }}>
                                      <span style={{ fontSize: '1.25rem' }}>🌏</span>
                                      <h4 style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>Asia-Pacific</h4>
                                    </div>
                                    <p style={{
                                      fontSize: '0.95rem',
                                      color: 'var(--text-muted)',
                                      fontStyle: 'italic',
                                      marginBottom: '0.5rem'
                                    }}>
                                      {intel.asia.character}
                                    </p>
                                    <p style={{
                                      fontSize: '0.875rem',
                                      lineHeight: '1.6',
                                      marginBottom: '0.75rem',
                                      color: 'var(--text-secondary)'
                                    }}>
                                      <strong>What Drives Sales:</strong> {intel.asia.salesDrivers}
                                    </p>
                                    <p style={{
                                      fontSize: '0.875rem',
                                      background: 'var(--bg-hover)',
                                      padding: '0.75rem',
                                      borderRadius: '6px',
                                      margin: 0,
                                      borderLeft: '3px solid #10b981'
                                    }}>
                                      <strong>Strategy:</strong> {intel.asia.strategy}
                                    </p>

                                    {/* Competitive Positioning */}
                                    {(() => {
                                      const myPrice = marketIntelData.myTeam?.prices?.asia ?? gameConfig.priceDemand.baselinePriceByRegion.asia
                                      const avgPrice = marketIntelData.avgPrices.asia
                                      const myPromo = marketIntelData.myTeam?.promos?.asia ?? gameConfig.defaults.marketing.promotionPctByRegion.asia
                                      const avgPromo = marketIntelData.avgPromos.asia
                                      const myFeatures = marketIntelData.features
                                      const avgFeatures = marketIntelData.avgFeatures
                                      const myCSR = marketIntelData.csrRating
                                      const avgCSR = marketIntelData.avgCSR

                                      const priceDiff = avgPrice > 0 ? ((myPrice - avgPrice) / avgPrice) * 100 : 0
                                      const promoDiff = avgPromo > 0 ? ((myPromo - avgPromo) / avgPromo) * 100 : 0
                                      const featuresDiff = avgFeatures > 0 ? ((myFeatures - avgFeatures) / avgFeatures) * 100 : 0
                                      const csrDiff = avgCSR > 0 ? ((myCSR - avgCSR) / avgCSR) * 100 : 0

                                      const getPriceText = () => {
                                        if (priceDiff > 10) return `priced significantly above market (${formatCurrencyFull(myPrice)} vs ${formatCurrencyFull(avgPrice)} avg). Premium strategy in a price-sensitive market - risky.`
                                        if (priceDiff > 5) return `priced moderately above market (${formatCurrencyFull(myPrice)} vs ${formatCurrencyFull(avgPrice)} avg). Small premium acceptable if differentiated.`
                                        if (priceDiff < -10) return `priced significantly below market (${formatCurrencyFull(myPrice)} vs ${formatCurrencyFull(avgPrice)} avg). Strong value play for volume - ideal for this cost-conscious region.`
                                        if (priceDiff < -5) return `priced moderately below market (${formatCurrencyFull(myPrice)} vs ${formatCurrencyFull(avgPrice)} avg). Good value positioning here.`
                                        return `priced at market average (${formatCurrencyFull(myPrice)}). Standard positioning in this competitive market.`
                                      }

                                      const getPromoText = () => {
                                        if (promoDiff > 15) return `marketing spend is ${myPromo.toFixed(0)}% vs ${avgPromo.toFixed(0)}% average - strong investment in brand awareness.`
                                        if (promoDiff > 5) return `marketing spend is ${myPromo.toFixed(0)}% vs ${avgPromo.toFixed(0)}% average - moderate promotional advantage.`
                                        if (promoDiff < -15) return `marketing spend is ${myPromo.toFixed(0)}% vs ${avgPromo.toFixed(0)}% average - being outgunned. Low prices need visibility to convert.`
                                        if (promoDiff < -5) return `marketing spend is ${myPromo.toFixed(0)}% vs ${avgPromo.toFixed(0)}% average - below market investment.`
                                        return `marketing spend matches the ${avgPromo.toFixed(0)}% industry average - standard approach.`
                                      }

                                      const getFeaturesText = () => {
                                        if (featuresDiff > 15) return `leading with ${myFeatures} features vs ${avgFeatures.toFixed(1)} average - strong innovation but may be over-engineering for this market.`
                                        if (featuresDiff > 5) return `ahead with ${myFeatures} features vs ${avgFeatures.toFixed(1)} average - good differentiation.`
                                        if (featuresDiff < -15) return `trailing with ${myFeatures} features vs ${avgFeatures.toFixed(1)} average - but in this value market, basic functionality may suffice.`
                                        if (featuresDiff < -5) return `behind with ${myFeatures} features vs ${avgFeatures.toFixed(1)} average - acceptable if competing on price.`
                                        return `at ${myFeatures} features matching ${avgFeatures.toFixed(1)} average - adequate for this market.`
                                      }

                                      const getCSRText = () => {
                                        if (csrDiff > 10) return `Your CSR (Corporate Social Responsibility - ethical and sustainable practices) rating of ${myCSR.toFixed(1)} beats ${avgCSR.toFixed(1)} average. Good values but less critical in this cost-focused market.`
                                        if (csrDiff > 5) return `Your CSR (Corporate Social Responsibility - ethical and sustainable practices) rating of ${myCSR.toFixed(1)} exceeds ${avgCSR.toFixed(1)} average. Decent sustainability positioning.`
                                        if (csrDiff < -10) return `Your CSR (Corporate Social Responsibility - ethical and sustainable practices) rating of ${myCSR.toFixed(1)} trails ${avgCSR.toFixed(1)} average. Acceptable here - price matters more than sustainability.`
                                        if (csrDiff < -5) return `Your CSR (Corporate Social Responsibility - ethical and sustainable practices) rating of ${myCSR.toFixed(1)} below ${avgCSR.toFixed(1)} average. Standard for this value-focused region.`
                                        return `Your CSR (Corporate Social Responsibility - ethical and sustainable practices) rating of ${myCSR.toFixed(1)} matches ${avgCSR.toFixed(1)} average. Standard sustainability.`
                                      }

                                      return (
                                        <div style={{
                                          marginTop: '1rem',
                                          padding: '0.75rem',
                                          background: 'rgba(16, 185, 129, 0.05)',
                                          borderRadius: '6px',
                                          border: '1px solid rgba(16, 185, 129, 0.2)',
                                          fontSize: '0.8rem',
                                          lineHeight: '1.6',
                                          color: 'var(--text-secondary)'
                                        }}>
                                          <div style={{ fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text-main)', fontSize: '0.85rem' }}>
                                            📊 Your Competitive Position
                                          </div>
                                          <div style={{ marginBottom: '0.4rem' }}><strong>Pricing:</strong> You're {getPriceText()}</div>
                                          <div style={{ marginBottom: '0.4rem' }}><strong>Marketing:</strong> Your {getPromoText()}</div>
                                          <div style={{ marginBottom: '0.4rem' }}><strong>Innovation:</strong> You're {getFeaturesText()}</div>
                                          <div><strong>Sustainability:</strong> {getCSRText()}</div>
                                        </div>
                                      )
                                    })()}

                                    {/* Market Supply-Demand */}
                                    {(() => {
                                      const regionData = supplyDemandData.asia
                                      const supply = regionData.supply
                                      const demand = regionData.demand
                                      const gap = supply - demand
                                      const status = regionData.status

                                      let statusText = ''
                                      let statusColor = ''
                                      let insight = ''

                                      if (status === 'saturated') {
                                        statusText = 'Oversupply'
                                        statusColor = '#10b981'
                                        insight = `The market sold ${formatUnits(supply)} units but had capacity for ${formatUnits(demand)} units - ${formatUnits(Math.abs(gap))} units of surplus inventory. This oversupply puts downward pressure on prices. In this price-sensitive market, consider aggressive discounting or shifting production to other regions.`
                                      } else if (status === 'shortage') {
                                        statusText = 'Shortfall'
                                        statusColor = '#ef4444'
                                        insight = `The market had ${formatUnits(demand)} units of demand but only ${formatUnits(supply)} units were sold - ${formatUnits(Math.abs(gap))} units of unmet customer demand. OPPORTUNITY: This high-volume market has unmet demand. Prioritize production here for maximum revenue impact.`
                                      } else {
                                        statusText = 'Balanced'
                                        statusColor = '#3b82f6'
                                        insight = `Market supply and demand are well-balanced at around ${formatUnits(supply)} units. Equilibrium achieved - maintain current production levels and compete on price efficiency.`
                                      }

                                      return (
                                        <div style={{
                                          marginTop: '1rem',
                                          padding: '0.75rem',
                                          background: 'rgba(16, 185, 129, 0.03)',
                                          borderRadius: '6px',
                                          border: '1px solid rgba(16, 185, 129, 0.15)',
                                          fontSize: '0.8rem',
                                          lineHeight: '1.6',
                                          color: 'var(--text-secondary)'
                                        }}>
                                          <div style={{ fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text-main)', fontSize: '0.85rem' }}>
                                            📈 Market Supply vs Demand
                                          </div>
                                          <div style={{ marginBottom: '0.5rem' }}>
                                            <strong style={{ color: statusColor }}>{statusText}:</strong> {insight}
                                          </div>
                                        </div>
                                      )
                                    })()}

                                    {/* Financial Environment - Asia-Pacific */}
                                    {(() => {
                                      const baseTaxRate = GAME_CONFIG.financial.taxRateByRegion.asia
                                      const taxDelta = scenario?.taxRateDeltaByRegion?.asia ?? 0
                                      const currentTaxRate = baseTaxRate + taxDelta

                                      const baseInterestRate = GAME_CONFIG.financial.interestRate
                                      const interestSpread = scenario?.interestRateSpread ?? 0
                                      const currentInterestRate = baseInterestRate + interestSpread

                                      return (
                                        <div style={{
                                          marginTop: '1rem',
                                          padding: '0.75rem',
                                          background: 'rgba(251, 191, 36, 0.05)',
                                          borderRadius: '6px',
                                          border: '1px solid rgba(251, 191, 36, 0.2)',
                                          fontSize: '0.8rem',
                                          lineHeight: '1.6',
                                          color: 'var(--text-secondary)'
                                        }}>
                                          <div style={{ fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text-main)', fontSize: '0.85rem' }}>
                                            💰 Financial Environment
                                          </div>
                                          <div style={{ marginBottom: '0.4rem' }}>
                                            <strong>Tax Rate:</strong> {formatPercent(currentTaxRate * 100)}
                                            {Math.abs(taxDelta) > 0.01 && (
                                              <span style={{ color: taxDelta > 0 ? '#ef4444' : '#10b981', fontWeight: 600 }}>
                                                {' '}({taxDelta > 0 ? '↑' : '↓'} {taxDelta > 0 ? 'increased' : 'decreased'} from {formatPercent(baseTaxRate * 100)})
                                              </span>
                                            )}
                                          </div>
                                          <div>
                                            <strong>Interest Rate:</strong> {formatPercent(currentInterestRate * 100)}
                                            {Math.abs(interestSpread) > 0.002 && (
                                              <span style={{ color: interestSpread > 0 ? '#ef4444' : '#10b981', fontWeight: 600 }}>
                                                {' '}({interestSpread > 0 ? '↑' : '↓'} {interestSpread > 0 ? 'rising' : 'falling'} from {formatPercent(baseInterestRate * 100)})
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      )
                                    })()}
                                  </div>
                                  )}

                                  {/* Europe */}
                                  {selectedRegionTab === 'europe' && (
                                  <div style={{
                                    marginBottom: '1.5rem',
                                    paddingBottom: '1.5rem',
                                    borderBottom: '1px solid var(--border-color)'
                                  }}>
                                    <div style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '0.5rem',
                                      marginBottom: '0.75rem'
                                    }}>
                                      <span style={{ fontSize: '1.25rem' }}>🇪🇺</span>
                                      <h4 style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>Europe</h4>
                                    </div>
                                    <p style={{
                                      fontSize: '0.95rem',
                                      color: 'var(--text-muted)',
                                      fontStyle: 'italic',
                                      marginBottom: '0.5rem'
                                    }}>
                                      {intel.europe.character}
                                    </p>
                                    <p style={{
                                      fontSize: '0.875rem',
                                      lineHeight: '1.6',
                                      marginBottom: '0.75rem',
                                      color: 'var(--text-secondary)'
                                    }}>
                                      <strong>What Drives Sales:</strong> {intel.europe.salesDrivers}
                                    </p>
                                    <p style={{
                                      fontSize: '0.875rem',
                                      background: 'var(--bg-hover)',
                                      padding: '0.75rem',
                                      borderRadius: '6px',
                                      margin: 0,
                                      borderLeft: '3px solid #8b5cf6'
                                    }}>
                                      <strong>Strategy:</strong> {intel.europe.strategy}
                                    </p>

                                    {/* Competitive Positioning */}
                                    {(() => {
                                      const myPrice = marketIntelData.myTeam?.prices?.europe ?? gameConfig.priceDemand.baselinePriceByRegion.europe
                                      const avgPrice = marketIntelData.avgPrices.europe
                                      const myPromo = marketIntelData.myTeam?.promos?.europe ?? gameConfig.defaults.marketing.promotionPctByRegion.europe
                                      const avgPromo = marketIntelData.avgPromos.europe
                                      const myFeatures = marketIntelData.features
                                      const avgFeatures = marketIntelData.avgFeatures
                                      const myCSR = marketIntelData.csrRating
                                      const avgCSR = marketIntelData.avgCSR

                                      const priceDiff = avgPrice > 0 ? ((myPrice - avgPrice) / avgPrice) * 100 : 0
                                      const promoDiff = avgPromo > 0 ? ((myPromo - avgPromo) / avgPromo) * 100 : 0
                                      const featuresDiff = avgFeatures > 0 ? ((myFeatures - avgFeatures) / avgFeatures) * 100 : 0
                                      const csrDiff = avgCSR > 0 ? ((myCSR - avgCSR) / avgCSR) * 100 : 0

                                      const getPriceText = () => {
                                        if (priceDiff > 10) return `priced significantly above market (${formatCurrencyFull(myPrice)} vs ${formatCurrencyFull(avgPrice)} avg). Premium positioning works here IF sustainability and features justify it.`
                                        if (priceDiff > 5) return `priced moderately above market (${formatCurrencyFull(myPrice)} vs ${formatCurrencyFull(avgPrice)} avg). Acceptable premium if you lead on CSR and innovation.`
                                        if (priceDiff < -10) return `priced significantly below market (${formatCurrencyFull(myPrice)} vs ${formatCurrencyFull(avgPrice)} avg). Value play but may signal lower quality in this premium-minded market.`
                                        if (priceDiff < -5) return `priced moderately below market (${formatCurrencyFull(myPrice)} vs ${formatCurrencyFull(avgPrice)} avg). Competitive but risks commodity positioning.`
                                        return `priced at market average (${formatCurrencyFull(myPrice)}). Neutral positioning - differentiate on values and innovation.`
                                      }

                                      const getPromoText = () => {
                                        if (promoDiff > 15) return `marketing spend is ${myPromo.toFixed(0)}% vs ${avgPromo.toFixed(0)}% average - strong brand-building investment.`
                                        if (promoDiff > 5) return `marketing spend is ${myPromo.toFixed(0)}% vs ${avgPromo.toFixed(0)}% average - moderate promotional advantage.`
                                        if (promoDiff < -15) return `marketing spend is ${myPromo.toFixed(0)}% vs ${avgPromo.toFixed(0)}% average - significantly underfunding brand vs competitors.`
                                        if (promoDiff < -5) return `marketing spend is ${myPromo.toFixed(0)}% vs ${avgPromo.toFixed(0)}% average - below market investment.`
                                        return `marketing spend matches the ${avgPromo.toFixed(0)}% industry average - balanced approach.`
                                      }

                                      const getFeaturesText = () => {
                                        if (featuresDiff > 15) return `leading with ${myFeatures} features vs ${avgFeatures.toFixed(1)} average - excellent innovation positioning for this tech-savvy market.`
                                        if (featuresDiff > 5) return `ahead with ${myFeatures} features vs ${avgFeatures.toFixed(1)} average - good technological edge.`
                                        if (featuresDiff < -15) return `trailing with ${myFeatures} features vs ${avgFeatures.toFixed(1)} average - serious gap in this quality-focused market.`
                                        if (featuresDiff < -5) return `behind with ${myFeatures} features vs ${avgFeatures.toFixed(1)} average - need R&D investment to compete effectively.`
                                        return `at ${myFeatures} features matching ${avgFeatures.toFixed(1)} average - competitive parity on innovation.`
                                      }

                                      const getCSRText = () => {
                                        if (csrDiff > 10) return `Your CSR (Corporate Social Responsibility - ethical and sustainable practices) rating of ${myCSR.toFixed(1)} beats ${avgCSR.toFixed(1)} average. CRITICAL advantage in this environmentally-conscious market!`
                                        if (csrDiff > 5) return `Your CSR (Corporate Social Responsibility - ethical and sustainable practices) rating of ${myCSR.toFixed(1)} exceeds ${avgCSR.toFixed(1)} average. Strong sustainability positioning - highly valued here.`
                                        if (csrDiff < -10) return `Your CSR (Corporate Social Responsibility - ethical and sustainable practices) rating of ${myCSR.toFixed(1)} trails ${avgCSR.toFixed(1)} average. Major weakness in this green-focused market - consider upgrading suppliers immediately.`
                                        if (csrDiff < -5) return `Your CSR (Corporate Social Responsibility - ethical and sustainable practices) rating of ${myCSR.toFixed(1)} below ${avgCSR.toFixed(1)} average. Sustainability deficit hurts significantly here.`
                                        return `Your CSR (Corporate Social Responsibility - ethical and sustainable practices) rating of ${myCSR.toFixed(1)} matches ${avgCSR.toFixed(1)} average. Meeting baseline expectations but not differentiating.`
                                      }

                                      return (
                                        <div style={{
                                          marginTop: '1rem',
                                          padding: '0.75rem',
                                          background: 'rgba(139, 92, 246, 0.05)',
                                          borderRadius: '6px',
                                          border: '1px solid rgba(139, 92, 246, 0.2)',
                                          fontSize: '0.8rem',
                                          lineHeight: '1.6',
                                          color: 'var(--text-secondary)'
                                        }}>
                                          <div style={{ fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text-main)', fontSize: '0.85rem' }}>
                                            📊 Your Competitive Position
                                          </div>
                                          <div style={{ marginBottom: '0.4rem' }}><strong>Pricing:</strong> You're {getPriceText()}</div>
                                          <div style={{ marginBottom: '0.4rem' }}><strong>Marketing:</strong> Your {getPromoText()}</div>
                                          <div style={{ marginBottom: '0.4rem' }}><strong>Innovation:</strong> You're {getFeaturesText()}</div>
                                          <div><strong>Sustainability:</strong> {getCSRText()}</div>
                                        </div>
                                      )
                                    })()}

                                    {/* Market Supply-Demand */}
                                    {(() => {
                                      const regionData = supplyDemandData.europe
                                      const supply = regionData.supply
                                      const demand = regionData.demand
                                      const gap = supply - demand
                                      const status = regionData.status

                                      let statusText = ''
                                      let statusColor = ''
                                      let insight = ''

                                      if (status === 'saturated') {
                                        statusText = 'OVERSUPPLY'
                                        statusColor = '#10b981'
                                        insight = `The market sold ${formatUnits(supply)} units but had capacity for ${formatUnits(demand)} units - ${formatUnits(Math.abs(gap))} units of surplus inventory. This quality-focused market is saturated. Consider reducing production or ramping up CSR/features to differentiate and capture share.`
                                      } else if (status === 'shortage') {
                                        statusText = 'SHORTAGE'
                                        statusColor = '#ef4444'
                                        insight = `High demand! Customers wanted ${formatUnits(demand)} units but only ${formatUnits(supply)} were available - ${formatUnits(Math.abs(gap))} units of unmet demand. This premium market has room for growth. Increase production capacity to capture revenue, especially if your CSR is strong.`
                                      } else {
                                        statusText = 'BALANCED'
                                        statusColor = '#3b82f6'
                                        insight = `Supply and demand are well-matched at ${formatUnits(supply)} units. Market equilibrium means competition is based on quality, sustainability, and brand rather than availability. Maintain current capacity and compete on values.`
                                      }

                                      return (
                                        <div style={{
                                          marginTop: '1rem',
                                          padding: '0.75rem',
                                          background: 'rgba(59, 130, 246, 0.05)',
                                          borderRadius: '6px',
                                          border: '1px solid rgba(59, 130, 246, 0.2)',
                                          fontSize: '0.8rem',
                                          lineHeight: '1.6',
                                          color: 'var(--text-secondary)'
                                        }}>
                                          <div style={{ fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text-main)', fontSize: '0.85rem' }}>
                                            📈 Market Supply vs Demand
                                          </div>
                                          <div style={{ marginBottom: '0.5rem' }}>
                                            <strong style={{ color: statusColor }}>{statusText}:</strong> {insight}
                                          </div>
                                        </div>
                                      )
                                    })()}

                                    {/* Financial Environment - Europe */}
                                    {(() => {
                                      const baseTaxRate = GAME_CONFIG.financial.taxRateByRegion.europe
                                      const taxDelta = scenario?.taxRateDeltaByRegion?.europe ?? 0
                                      const currentTaxRate = baseTaxRate + taxDelta

                                      const baseInterestRate = GAME_CONFIG.financial.interestRate
                                      const interestSpread = scenario?.interestRateSpread ?? 0
                                      const currentInterestRate = baseInterestRate + interestSpread

                                      return (
                                        <div style={{
                                          marginTop: '1rem',
                                          padding: '0.75rem',
                                          background: 'rgba(251, 191, 36, 0.05)',
                                          borderRadius: '6px',
                                          border: '1px solid rgba(251, 191, 36, 0.2)',
                                          fontSize: '0.8rem',
                                          lineHeight: '1.6',
                                          color: 'var(--text-secondary)'
                                        }}>
                                          <div style={{ fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text-main)', fontSize: '0.85rem' }}>
                                            💰 Financial Environment
                                          </div>
                                          <div style={{ marginBottom: '0.4rem' }}>
                                            <strong>Tax Rate:</strong> {formatPercent(currentTaxRate * 100)}
                                            {Math.abs(taxDelta) > 0.01 && (
                                              <span style={{ color: taxDelta > 0 ? '#ef4444' : '#10b981', fontWeight: 600 }}>
                                                {' '}({taxDelta > 0 ? '↑' : '↓'} {taxDelta > 0 ? 'increased' : 'decreased'} from {formatPercent(baseTaxRate * 100)})
                                              </span>
                                            )}
                                          </div>
                                          <div>
                                            <strong>Interest Rate:</strong> {formatPercent(currentInterestRate * 100)}
                                            {Math.abs(interestSpread) > 0.002 && (
                                              <span style={{ color: interestSpread > 0 ? '#ef4444' : '#10b981', fontWeight: 600 }}>
                                                {' '}({interestSpread > 0 ? '↑' : '↓'} {interestSpread > 0 ? 'rising' : 'falling'} from {formatPercent(baseInterestRate * 100)})
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      )
                                    })()}
                                  </div>
                                  )}

                                  {/* Bottom Line */}
                                  <div style={{
                                    marginTop: '1.5rem',
                                    padding: '1rem',
                                    background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(16, 185, 129, 0.1) 100%)',
                                    borderRadius: '8px',
                                    border: '1px solid rgba(59, 130, 246, 0.2)'
                                  }}>
                                    <p style={{
                                      fontSize: '0.875rem',
                                      fontWeight: 600,
                                      margin: 0,
                                      color: 'var(--text-main)'
                                    }}>
                                      <strong>Bottom Line:</strong> Each market rewards different strategies. Success requires balancing regional approaches - innovate for North America, optimize costs for Asia-Pacific, and lead with sustainability in Europe.
                                    </p>
                                  </div>
                                </>
                              )
                            })()}
                          </div>

                          <MarketIntelligence />
                        </div>

                        <div className="right-col">
                          <div id="overview">
                            <HeroStatus />
                          </div>
                          <DecisionProgress />
                          <UnmetDemandIntelligence />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <CliPhaseLoader className="dm-loading dm-loading-cli" />
                  )
                ) : activeStep.id === 'forecast' ? (
                  <div className="dm-forecast">

                    {/* Newspaper and Growth Sliders */}
                    <div className="dm-forecast-layout">
                        <div className="dm-briefing-paper">
                          <header className="dm-paper-header">
                            <div className="dm-paper-masthead">The Global Times</div>
                            <div className="dm-paper-subhead">
                              <span>VOL. 19, NO. 190</span>
                              <span style={{ textTransform: 'uppercase' }}>ROUND {currentRound === 0 ? 'TRIAL' : currentRound} — {scenarioLabel}</span>
                              <span>{briefingDate}</span>
                            </div>
                          </header>

                          <main className="dm-paper-content">
                            <div className="dm-paper-hero">
                              <h1 className="dm-paper-title">{scenario?.description}</h1>

                              {/* Moving Share Price Ticker */}
                              <div className="dm-paper-ticker">
                                <div className="dm-paper-ticker-inner">
                                  {reviewTeams.map((t: unknown) => {
                                    const change = t.sharePrice - t.prevSharePrice
                                    const pctChange = t.prevSharePrice > 0 ? (change / t.prevSharePrice) * 100 : 0
                                    return (
                                      <span key={t.id} className="dm-paper-ticker-item">
                                        {t.name}: {formatCurrency(t.sharePrice)}
                                        <span className={`dm-paper-ticker-change ${change > 0 ? 'up' : change < 0 ? 'down' : 'neutral'}`}>
                                          {change > 0 ? '▲' : change < 0 ? '▼' : '•'}
                                          {Math.abs(pctChange).toFixed(1)}%
                                        </span>
                                      </span>
                                    )
                                  })}
                                  {/* Duplicate for seamless loop */}
                                  {reviewTeams.map((t: unknown) => {
                                    const change = t.sharePrice - t.prevSharePrice
                                    const pctChange = t.prevSharePrice > 0 ? (change / t.prevSharePrice) * 100 : 0
                                    return (
                                      <span key={`${t.id}-clone`} className="dm-paper-ticker-item">
                                        {t.name}: {formatCurrency(t.sharePrice)}
                                        <span className={`dm-paper-ticker-change ${change > 0 ? 'up' : change < 0 ? 'down' : 'neutral'}`}>
                                          {change > 0 ? '▲' : change < 0 ? '▼' : '•'}
                                          {Math.abs(pctChange).toFixed(1)}%
                                        </span>
                                      </span>
                                    )
                                  })}
                                </div>
                              </div>

                            </div>

                            <section className="dm-paper-article">
                              <div className="dm-paper-indicator-box">
                                <h3 className="dm-paper-box-title">Economic Briefing & Market Outlook</h3>

                                {/* Photo floated right for text wrap */}
                                <div style={{
                                  float: 'right',
                                  width: '30%',
                                  marginLeft: '1.5rem',
                                  marginBottom: '1rem'
                                }}>
                                  <img
                                    src={`/images/scenarios/${SCENARIO_IMAGES[scenarioId] || 'stablemarket.jpg'}`}
                                    alt={scenarioLabel}
                                    style={{ width: '100%', height: 'auto', borderRadius: '4px' }}
                                  />
                                  <div style={{
                                    fontSize: '0.75rem',
                                    fontStyle: 'italic',
                                    marginTop: '0.5rem',
                                    color: 'var(--text-muted)',
                                    textAlign: 'center'
                                  }}>
                                    {scenario?.description}
                                  </div>
                                </div>

                                <div className="dm-paper-box-content">
                                  {(() => {
                                      const articles = []
                                      const baseTaxRates = GAME_CONFIG.financial.taxRateByRegion
                                      const baseInterestRate = GAME_CONFIG.financial.interestRate

                                      // Helper functions
                                      const getMagnitude = (modifier: number): string => {
                                        const delta = Math.abs(modifier - 1)
                                        if (delta < 0.05) return 'slightly'
                                        if (delta < 0.10) return 'moderately'
                                        if (delta < 0.20) return 'significantly'
                                        return 'dramatically'
                                      }

                                      const getMagnitudeDelta = (delta: number): string => {
                                        const abs = Math.abs(delta)
                                        if (abs < 0.03) return 'slightly'
                                        if (abs < 0.08) return 'moderately'
                                        if (abs < 0.15) return 'significantly'
                                        return 'dramatically'
                                      }

                                      // Cost Inflation
                                      if (scenario?.costInflation && Math.abs(scenario.costInflation - 1) > 0.02) {
                                        const mag = getMagnitude(scenario.costInflation)
                                        if (scenario.costInflation > 1) {
                                          const pct = ((scenario.costInflation - 1) * 100).toFixed(1)
                                          articles.push(`Production costs are rising ${mag}, with manufacturers reporting a ${pct}% increase in input prices as supply chain pressures persist.`)
                                        } else {
                                          const pct = ((1 - scenario.costInflation) * 100).toFixed(1)
                                          articles.push(`Production costs are falling ${mag}, declining ${pct}% as supply conditions normalize and commodity prices ease.`)
                                        }
                                      }

                                      // Investment Costs
                                      if (scenario?.investmentCostMultiplier && Math.abs(scenario.investmentCostMultiplier - 1) > 0.03) {
                                        const mag = getMagnitude(scenario.investmentCostMultiplier)
                                        if (scenario.investmentCostMultiplier > 1) {
                                          articles.push(`Capital investment has become ${mag} more expensive, with R&D programs and factory expansions facing elevated costs.`)
                                        } else {
                                          articles.push(`Capital investment costs have declined ${mag}, creating favorable conditions for R&D expansion and facility upgrades.`)
                                        }
                                      }

                                      // Interest Rates
                                      const interestSpread = scenario?.interestRateSpread ?? 0
                                      if (Math.abs(interestSpread) > 0.002) {
                                        const currentRate = baseInterestRate + interestSpread
                                        const mag = getMagnitudeDelta(interestSpread)
                                        if (interestSpread > 0) {
                                          articles.push(`Central banks have raised interest rates ${mag} to ${formatPercent(currentRate * 100)}, tightening credit conditions and increasing borrowing costs across the economy.`)
                                        } else {
                                          articles.push(`Central banks have cut interest rates ${mag} to ${formatPercent(currentRate * 100)}, easing monetary policy to support economic activity.`)
                                        }
                                      }

                                      // Marketing Effectiveness
                                      if (scenario?.marketingEffectModifier && Math.abs(scenario.marketingEffectModifier - 1) > 0.05) {
                                        const mag = getMagnitude(scenario.marketingEffectModifier)
                                        if (scenario.marketingEffectModifier > 1) {
                                          articles.push(`Marketing campaigns are proving ${mag} more effective as consumer engagement rises and advertising channels gain traction.`)
                                        } else {
                                          articles.push(`Marketing effectiveness has declined ${mag} amid advertising saturation and reduced consumer responsiveness to promotional campaigns.`)
                                        }
                                      }

                                      // Price Elasticity
                                      if (scenario?.priceElasticityModifier && Math.abs(scenario.priceElasticityModifier - 1) > 0.05) {
                                        const mag = getMagnitude(scenario.priceElasticityModifier)
                                        if (scenario.priceElasticityModifier > 1) {
                                          articles.push(`Consumer price sensitivity has increased ${mag}, with buyers scrutinizing purchases more carefully and showing heightened responsiveness to price changes.`)
                                        } else {
                                          articles.push(`Consumer price sensitivity has decreased ${mag}, with buyers showing more willingness to pay premium prices for preferred brands.`)
                                        }
                                      }

                                      // CSR Importance
                                      if (scenario?.csrImportanceModifier && Math.abs(scenario.csrImportanceModifier - 1) > 0.1) {
                                        const mag = getMagnitude(scenario.csrImportanceModifier)
                                        if (scenario.csrImportanceModifier > 1) {
                                          articles.push(`Corporate sustainability and ethical practices have become ${mag} more important to consumers, particularly in premium markets where CSR credentials drive purchasing decisions.`)
                                        } else {
                                          articles.push(`Environmental and social governance considerations have become ${mag} less prominent in consumer decision-making as economic concerns take priority.`)
                                        }
                                      }

                                      // Regional Demand
                                      const demandMods = scenario?.demandModifier
                                      const demandTexts = []
                                      if (demandMods?.us && Math.abs(demandMods.us) > 1) {
                                        const desc = demandMods.us > 10 ? 'strong expansion' : demandMods.us > 5 ? 'moderate growth' : demandMods.us < -10 ? 'sharp contraction' : 'modest weakening'
                                        demandTexts.push(`${regionLabels.us} shows ${desc}`)
                                      }
                                      if (demandMods?.asia && Math.abs(demandMods.asia) > 1) {
                                        const desc = demandMods.asia > 10 ? 'strong expansion' : demandMods.asia > 5 ? 'moderate growth' : demandMods.asia < -10 ? 'sharp contraction' : 'modest weakening'
                                        demandTexts.push(`${regionLabels.asia} faces ${desc}`)
                                      }
                                      if (demandMods?.europe && Math.abs(demandMods.europe) > 1) {
                                        const desc = demandMods.europe > 10 ? 'strong expansion' : demandMods.europe > 5 ? 'moderate growth' : demandMods.europe < -10 ? 'sharp contraction' : 'modest weakening'
                                        demandTexts.push(`${regionLabels.europe} expects ${desc}`)
                                      }
                                      if (demandTexts.length > 0) {
                                        articles.push(`Regional market conditions vary significantly: ${demandTexts.join('; ')}.`)
                                      }

                                      // Logistics Costs
                                      const logistics = scenario?.logisticsTariff
                                      const baseLogistics = { usToAsia: 0.20, usToEurope: 0.40, asiaToUs: 0.20, asiaToEurope: 0.50, europeToUs: 0.05, europeToAsia: 0.03 }
                                      const logisticsChanges = []
                                      if (logistics?.usToAsia && Math.abs(logistics.usToAsia - baseLogistics.usToAsia) > 0.01) {
                                        logisticsChanges.push(`US-Asia routes now cost ${formatCurrency(logistics.usToAsia)} per unit`)
                                      }
                                      if (logistics?.usToEurope && Math.abs(logistics.usToEurope - baseLogistics.usToEurope) > 0.01) {
                                        logisticsChanges.push(`US-Europe shipments ${formatCurrency(logistics.usToEurope)}`)
                                      }
                                      if (logistics?.asiaToEurope && Math.abs(logistics.asiaToEurope - baseLogistics.asiaToEurope) > 0.01) {
                                        logisticsChanges.push(`Asia-Europe trade ${formatCurrency(logistics.asiaToEurope)}`)
                                      }
                                      if (logisticsChanges.length > 0) {
                                        articles.push(`Global shipping costs have shifted substantially: ${logisticsChanges.join(', ')}.`)
                                      }

                                      // Tax Changes
                                      const taxDeltas = scenario?.taxRateDeltaByRegion
                                      const taxTexts = []
                                      if (taxDeltas?.us && Math.abs(taxDeltas.us) > 0.01) {
                                        const newRate = baseTaxRates.us + taxDeltas.us
                                        taxTexts.push(`${regionLabels.us} ${taxDeltas.us > 0 ? 'raised' : 'cut'} corporate taxes to ${formatPercent(newRate * 100)}`)
                                      }
                                      if (taxDeltas?.asia && Math.abs(taxDeltas.asia) > 0.01) {
                                        const newRate = baseTaxRates.asia + taxDeltas.asia
                                        taxTexts.push(`${regionLabels.asia} adjusted rates to ${formatPercent(newRate * 100)}`)
                                      }
                                      if (taxDeltas?.europe && Math.abs(taxDeltas.europe) > 0.01) {
                                        const newRate = baseTaxRates.europe + taxDeltas.europe
                                        taxTexts.push(`${regionLabels.europe} set taxes at ${formatPercent(newRate * 100)}`)
                                      }
                                      if (taxTexts.length > 0) {
                                        articles.push(`Tax policy shifts across regions: ${taxTexts.join('; ')}.`)
                                      }

                                      // Working Capital
                                      const wc = scenario?.workingCapitalDelta
                                      if (wc?.inventory && Math.abs(wc.inventory) > 0.01) {
                                        const mag = getMagnitudeDelta(wc.inventory)
                                        if (wc.inventory > 0) {
                                          articles.push(`Inventory holding costs have risen ${mag}, tying up more working capital in stock management.`)
                                        } else {
                                          articles.push(`Inventory holding costs have declined ${mag}, improving working capital efficiency.`)
                                        }
                                      }

                                      // If no changes, show baseline message
                                      if (articles.length === 0) {
                                        articles.push('Economic conditions remain stable with no significant changes from baseline expectations. Markets are operating under normal parameters across all regions.')
                                      }

                                      return (
                                        <>
                                          <p style={{ marginBottom: '1rem' }}>
                                            {articles.join(' ')}
                                          </p>
                                          <div className="dm-paper-quote-block">
                                            "{scenario?.hints?.[0] || scenario?.description}"
                                          </div>
                                        </>
                                      )
                                    })()}
                                  </div>
                                </div>
                              </section>

                            <section className="dm-paper-regions">
                              <div className="dm-paper-region-grid">
                                {forecastRegionBriefs.map((region) => (
                                  <div key={region.key} className="dm-paper-region-col">
                                    <h4 className="dm-paper-region-title">{region.name}</h4>

                                    <p className="dm-paper-region-forecast">
                                      Analysts forecast growth between{' '}
                                      <span className={region.range.central >= 0 ? 'dm-paper-positive' : 'dm-paper-negative'}>
                                        {formatGrowthRange(region.range)}
                                      </span>{' '}
                                      (central estimate{' '}
                                      <span className={region.range.central >= 0 ? 'dm-paper-positive' : 'dm-paper-negative'}>
                                        {formatCentralGrowth(region.range.central)}
                                      </span>
                                      ).
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </section>
                          </main>
                        </div>

                        {/* Growth Sliders - Stacked Vertically */}
                        <div className="dm-forecast-sliders">
                          <div className="dm-market-card dm-region-us">
                            <div className="dm-market-header">
                              <div className="dm-market-title">
                                {regionLabels.us}
                                <InfoTooltip text={regionTooltipText.us} label={`${regionLabels.us} market characteristics`} />
                              </div>
                            </div>
                            <div className="dm-market-input">
                              <div className="dm-market-row">
                                <span>
                                  Growth Target
                                  <InfoTooltip text={tooltipCopy.growthTarget} label="Growth target info" />
                                </span>
                                <span className="dm-market-target">{formatGrowthTarget(forecastShareTargets.us)}</span>
                              </div>
                              <RangeWithButtons
                                min={-100}
                                max={100}
                                step={1}
                                value={forecastShareTargets.us}
                                disabled={isLocked}
                                className="dm-market-slider"
                                ariaLabel={`${regionLabels.us} growth target`}
                                onChange={(nextValue) => {
                                  const clampedValue = Math.min(100, Math.max(-100, nextValue))
                                  setForecastTargets((prev) => {
                                    const nextTargets = { ...prev, us: clampedValue }
                                    scheduleForecastSave(nextTargets)
                                    return nextTargets
                                  })
                                }}
                              />
                            </div>
                            <div className="dm-market-footer">
                              <span>Target Sales</span>
                              <input
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9,]*"
                                min="0"
                                step="1"
                                className="dm-market-target-input"
                                value={formatUnitsExact(forecastProjected.us)}
                                onChange={(event) => {
                                  if (isLocked) return
                                  const nextUnits = parseTargetUnits(event.target.value)
                                  const nextGrowth = getGrowthFromTarget(reviewUnitsSold.us || 0, nextUnits)
                                  setForecastTargets((prev) => {
                                    const nextTargets = { ...prev, us: Math.round(nextGrowth) }
                                    scheduleForecastSave(nextTargets)
                                    return nextTargets
                                  })
                                }}
                                disabled={isLocked}
                              />
                            </div>
                          </div>

                          <div className="dm-market-card dm-region-asia">
                            <div className="dm-market-header">
                              <div className="dm-market-title">
                                {regionLabels.asia}
                                <InfoTooltip text={regionTooltipText.asia} label={`${regionLabels.asia} market characteristics`} />
                              </div>
                            </div>
                            <div className="dm-market-input">
                              <div className="dm-market-row">
                                <span>
                                  Growth Target
                                  <InfoTooltip text={tooltipCopy.growthTarget} label="Growth target info" />
                                </span>
                                <span className="dm-market-target">{formatGrowthTarget(forecastShareTargets.asia)}</span>
                              </div>
                              <RangeWithButtons
                                min={-100}
                                max={100}
                                step={1}
                                value={forecastShareTargets.asia}
                                disabled={isLocked}
                                className="dm-market-slider"
                                ariaLabel={`${regionLabels.asia} growth target`}
                                onChange={(nextValue) => {
                                  const clampedValue = Math.min(100, Math.max(-100, nextValue))
                                  setForecastTargets((prev) => {
                                    const nextTargets = { ...prev, asia: clampedValue }
                                    scheduleForecastSave(nextTargets)
                                    return nextTargets
                                  })
                                }}
                              />
                            </div>
                            <div className="dm-market-footer">
                              <span>Target Sales</span>
                              <input
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9,]*"
                                min="0"
                                step="1"
                                className="dm-market-target-input"
                                value={formatUnitsExact(forecastProjected.asia)}
                                onChange={(event) => {
                                  if (isLocked) return
                                  const nextUnits = parseTargetUnits(event.target.value)
                                  const nextGrowth = getGrowthFromTarget(reviewUnitsSold.asia || 0, nextUnits)
                                  setForecastTargets((prev) => {
                                    const nextTargets = { ...prev, asia: Math.round(nextGrowth) }
                                    scheduleForecastSave(nextTargets)
                                    return nextTargets
                                  })
                                }}
                                disabled={isLocked}
                              />
                            </div>
                          </div>

                          <div className="dm-market-card dm-region-europe">
                            <div className="dm-market-header">
                              <div className="dm-market-title">
                                {regionLabels.europe}
                                <InfoTooltip text={regionTooltipText.europe} label={`${regionLabels.europe} market characteristics`} />
                              </div>
                            </div>
                            <div className="dm-market-input">
                              <div className="dm-market-row">
                                <span>
                                  Growth Target
                                  <InfoTooltip text={tooltipCopy.growthTarget} label="Growth target info" />
                                </span>
                                <span className="dm-market-target">{formatGrowthTarget(forecastShareTargets.europe)}</span>
                              </div>
                              <RangeWithButtons
                                min={-100}
                                max={100}
                                step={1}
                                value={forecastShareTargets.europe}
                                disabled={isLocked}
                                className="dm-market-slider"
                                ariaLabel={`${regionLabels.europe} growth target`}
                                onChange={(nextValue) => {
                                  const clampedValue = Math.min(100, Math.max(-100, nextValue))
                                  setForecastTargets((prev) => {
                                    const nextTargets = { ...prev, europe: clampedValue }
                                    scheduleForecastSave(nextTargets)
                                    return nextTargets
                                  })
                                }}
                              />
                            </div>
                            <div className="dm-market-footer">
                              <span>Target Sales</span>
                              <input
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9,]*"
                                min="0"
                                step="1"
                                className="dm-market-target-input"
                                value={formatUnitsExact(forecastProjected.europe)}
                                onChange={(event) => {
                                  if (isLocked) return
                                  const nextUnits = parseTargetUnits(event.target.value)
                                  const nextGrowth = getGrowthFromTarget(reviewUnitsSold.europe || 0, nextUnits)
                                  setForecastTargets((prev) => {
                                    const nextTargets = { ...prev, europe: Math.round(nextGrowth) }
                                    scheduleForecastSave(nextTargets)
                                    return nextTargets
                                  })
                                }}
                                disabled={isLocked}
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                  </div>
                ) : activeStep.id === 'production' ? (
                  <>
                    <div className="dm-prod">
                      {renderProductionCard('us', `${regionLabels.us} Operations`, forecastProjected.us)}
                      {renderProductionCard('asia', `${regionLabels.asia} Operations`, forecastProjected.asia)}
                    </div>

                    {/* Regional Production Summary */}
                    <div className="dm-supply-chain" style={{ marginTop: '1.5rem' }}>
                      <div className="dm-sc-title">Regional Production Summary</div>
                      <div className="dm-sc-table">
                        <div className="dm-sc-header">
                          <div>Region</div>
                          <div>Output</div>
                          <div>Inventory</div>
                          <div>Total</div>
                          <div style={{ textAlign: 'right' }}>Forecast</div>
                        </div>
                        <div className="dm-sc-row">
                          <div className="dm-sc-market">{regionLabels.us}</div>
                          <div>{formatUnits(prodPlanned.us + prodPlanned.outUS)}</div>
                          <div>{formatUnits(reviewInventoryUS)}</div>
                          <div>{formatUnits(prodPlanned.us + prodPlanned.outUS + reviewInventoryUS)}</div>
                          <div style={{ textAlign: 'right' }}>
                            <span style={{
                              color: (prodPlanned.us + prodPlanned.outUS + reviewInventoryUS) >= forecastProjected.us ? '#10b981' : '#ef4444',
                              fontWeight: 600
                            }}>
                              {formatUnits(forecastProjected.us)}
                            </span>
                          </div>
                        </div>
                        <div className="dm-sc-row">
                          <div className="dm-sc-market">{regionLabels.asia}</div>
                          <div>{formatUnits(prodPlanned.asia + prodPlanned.outAsia)}</div>
                          <div>{formatUnits(reviewInventoryAsia)}</div>
                          <div>{formatUnits(prodPlanned.asia + prodPlanned.outAsia + reviewInventoryAsia)}</div>
                          <div style={{ textAlign: 'right' }}>
                            <span style={{
                              color: (prodPlanned.asia + prodPlanned.outAsia + reviewInventoryAsia) >= forecastProjected.asia ? '#10b981' : '#ef4444',
                              fontWeight: 600
                            }}>
                              {formatUnits(forecastProjected.asia)}
                            </span>
                          </div>
                        </div>
                        <div className="dm-sc-row">
                          <div className="dm-sc-market">{regionLabels.europe}</div>
                          <div>—</div>
                          <div>—</div>
                          <div>—</div>
                          <div style={{ textAlign: 'right' }}>
                            <span style={{
                              color: '#ef4444',
                              fontWeight: 600
                            }}>
                              {formatUnits(forecastProjected.europe)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                ) : activeStep.id === 'logistics' ? renderLogisticsStep() :
                  activeStep.id === 'rnd' ? renderRndStep() :
                    activeStep.id === 'marketing' ? renderMarketingStep() :
                      activeStep.id === 'finance' ? renderFinanceStep() :
                        activeStep.id === 'submit' ? renderSubmitStep() : null}

                {debugOpen && isDevAdmin && (
                  <div className="dm-debug-panel">
                    <div className="dm-debug-label">Review Debug: Financial Snapshots (Sample Team)</div>
                    <div className="dm-debug-block">
                      {activeStep.id === 'review' && (
                        <div className="dm-debug-phase">
                          <div className="dm-debug-phase-title">Phase 1: Starting Position</div>
                          <pre className="dm-debug-pre">{debugSnapshots.phase1}</pre>
                        </div>
                      )}
                      <div className="dm-debug-phase">
                        <div className="dm-debug-phase-title">Phase 2: End of Round 1</div>
                        <pre className="dm-debug-pre">{debugSnapshots.phase2}</pre>
                      </div>
                    </div>
                    <div className="dm-debug-label">Legacy Decisions (Reference)</div>
                    <iframe
                      className="dm-debug-frame"
                      src="/decisions"
                      title="Legacy Decisions"
                    />
                  </div>
                )}

                {!isGameComplete && (
                  <div className="dm-step-footer" style={{ marginBottom: '2rem' }}>
                    <button
                      type="button"
                      className="dm-nav dm-nav-secondary"
                      onClick={() => setActiveStepIndex((i) => Math.max(0, i - 1))}
                      disabled={activeStepIndex === 0}
                    >
                      Previous
                    </button>
                    {activeStepIndex < STEPS.length - 1 && (
                      <button
                        type="button"
                        className="dm-nav dm-nav-primary"
                        onClick={() => setActiveStepIndex((i) => Math.min(STEPS.length - 1, i + 1))}
                      >
                        Next Step
                      </button>
                    )}
                    {!auditVisible && combinedAuditText && isDevAdmin && (
                      <button
                        type="button"
                        className="dm-audit-btn"
                        style={{ marginLeft: 'auto', alignSelf: 'center' }}
                        onClick={() => { setAuditVisible(true); setAuditOpen(true); }}
                      >
                        🐚 Debug
                      </button>
                    )}
                  </div>
                )}

                {combinedAuditText && auditVisible && isDevAdmin && (
                  <div className="dm-audit-panel">
                    <div className="dm-audit-panel-head">
                      <div className="dm-audit-panel-title">Command Prompt - audit.exe</div>
                      <div className="dm-audit-panel-actions">
                        <div className="dm-cmd-windows-btns">
                          <span className="dm-cmd-win-btn" onClick={() => setAuditOpen(!auditOpen)}>▢</span>
                          <span className="dm-cmd-win-btn close" onClick={() => setAuditVisible(false)}>✕</span>
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
                      <>
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
                            C:\Andy\Bonopoly\Audit&gt; session --debug-round -1 --split-view
                          </div>
                          {activeStep.id === 'review' && (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
                              <div style={{ paddingRight: '0.75rem', borderRight: '1px dashed #333' }}>
                                <div style={{ color: '#fbbf24', fontWeight: 700, marginBottom: '0.5rem', paddingBottom: '0.5rem', borderBottom: '1px solid #333', fontSize: '0.65rem' }}>
                                  STAGE 2: CAPITALIZATION (Day 0) <span style={{ color: '#94a3b8' }}>[Computed]</span>
                                </div>
                                <div style={{ color: '#888', marginBottom: '1rem', fontSize: '0.65rem', minHeight: '2.5rem' }}>
                                  Action: Inject Capital &gt; Buy Plants<br />
                                  Debt/Equity issued to fund initial assets.
                                </div>
                                <AuditStage2Table startState={stage2StartState} />
                              </div>
                              <div>
                                <div style={{ color: '#10b981', fontWeight: 700, marginBottom: '0.5rem', paddingBottom: '0.5rem', borderBottom: '1px solid #333', fontSize: '0.65rem' }}>
                                  STAGE 3: OPERATIONS (End of R-1) <span style={{ color: '#94a3b8' }}>[DB]</span>
                                </div>
                                <div style={{ color: '#888', marginBottom: '1rem', fontSize: '0.65rem', minHeight: '2.5rem' }}>
                                  Action: Run Production &amp; Sales<br />
                                  Sales = Prod / 1.1 (Establishes End Inv)
                                </div>
                                <AuditStage3Table teamRow={stage3TeamRow} startState={stage2StartState} />
                                {stage3BalanceDelta && (
                                  <div style={{ marginTop: '0.75rem', color: '#e2e8f0', fontSize: '0.7rem', borderTop: '1px dashed #333', paddingTop: '0.5rem' }}>
                                    <div style={{ fontWeight: 700, color: '#fbbf24', marginBottom: '0.25rem' }}>BALANCE DELTA CHECK</div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                      <span>Total Assets:</span>
                                      <span>{formatCurrency(stage3BalanceDelta.assets)}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                      <span>Total Liabilities + Equity:</span>
                                      <span>{formatCurrency(stage3BalanceDelta.liabilities + stage3BalanceDelta.equity)}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.25rem' }}>
                                      <span>Delta:</span>
                                      <span style={{ color: Math.abs(stage3BalanceDelta.delta) < 1 ? '#10b981' : '#ef4444', fontWeight: 700 }}>
                                        {formatCurrency(stage3BalanceDelta.delta)} {Math.abs(stage3BalanceDelta.delta) < 1 ? 'OK' : 'FAIL'}
                                      </span>
                                    </div>
                                    <div style={{ marginTop: '0.5rem', borderTop: '1px dashed #333', paddingTop: '0.5rem' }}>
                                      <div style={{ fontWeight: 700, color: '#94a3b8', marginBottom: '0.25rem' }}>COMPONENT BREAKDOWN</div>
                                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span>Cash:</span>
                                        <span>{formatCurrency(stage3TeamRow?.cash ?? 0)}</span>
                                      </div>
                                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span>Receivables:</span>
                                        <span>{formatCurrency(stage3TeamRow?.receivables ?? 0)}</span>
                                      </div>
                                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span>Inventory:</span>
                                        <span>{formatCurrency(stage3TeamRow?.inventory ?? 0)}</span>
                                      </div>
                                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span>Fixed Assets:</span>
                                        <span>{formatCurrency(stage3TeamRow?.fixedAssets ?? 0)}</span>
                                      </div>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.25rem' }}>
                                        <span>Assets Sum:</span>
                                        <span>{formatCurrency(
                                          (stage3TeamRow?.cash ?? 0) +
                                          (stage3TeamRow?.receivables ?? 0) +
                                          (stage3TeamRow?.inventory ?? 0) +
                                          (stage3TeamRow?.fixedAssets ?? 0)
                                        )}</span>
                                      </div>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.4rem' }}>
                                        <span>Payables:</span>
                                        <span>{formatCurrency(stage3TeamRow?.payables ?? 0)}</span>
                                      </div>
                                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span>Short-Term Debt:</span>
                                        <span>{formatCurrency(stage3TeamRow?.shortTermLoans ?? 0)}</span>
                                      </div>
                                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span>Long-Term Debt:</span>
                                        <span>{formatCurrency(stage3TeamRow?.longTermDebt ?? 0)}</span>
                                      </div>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.25rem' }}>
                                        <span>Liabilities Sum:</span>
                                        <span>{formatCurrency(
                                          (stage3TeamRow?.payables ?? 0) +
                                          (stage3TeamRow?.shortTermLoans ?? 0) +
                                          (stage3TeamRow?.longTermDebt ?? 0)
                                        )}</span>
                                      </div>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.4rem' }}>
                                        <span>Share Capital:</span>
                                        <span>{formatCurrency(stage3TeamRow?.shareCapital ?? 0)}</span>
                                      </div>
                                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span>Retained Earnings:</span>
                                        <span>{formatCurrency(stage3TeamRow?.retainedEarnings ?? 0)}</span>
                                      </div>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.25rem' }}>
                                        <span>Equity Sum:</span>
                                        <span>{formatCurrency(
                                          (stage3TeamRow?.shareCapital ?? 0) +
                                          (stage3TeamRow?.retainedEarnings ?? 0)
                                        )}</span>
                                      </div>
                                      {stage3WorkingCapitalAudit && (
                                        <div style={{ marginTop: '0.5rem', borderTop: '1px dashed #333', paddingTop: '0.5rem' }}>
                                          <div style={{ fontWeight: 700, color: '#94a3b8', marginBottom: '0.25rem' }}>WORKING CAPITAL FORMULAS</div>
                                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <span>Receivable %:</span>
                                            <span>{(stage3WorkingCapitalAudit.receivablePercent * 100).toFixed(1)}%</span>
                                          </div>
                                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <span>Receivable Base (Revenue):</span>
                                            <span>{formatCurrency(stage3WorkingCapitalAudit.receivableBase)}</span>
                                          </div>
                                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <span>Receivables Formula:</span>
                                            <span>{formatCurrency(stage3WorkingCapitalAudit.receivableFormula)}</span>
                                          </div>
                                          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.25rem' }}>
                                            <span>Payable %:</span>
                                            <span>{(stage3WorkingCapitalAudit.payablePercent * 100).toFixed(1)}%</span>
                                          </div>
                                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <span>Payable Base (COGS):</span>
                                            <span>{formatCurrency(stage3WorkingCapitalAudit.payableBase)}</span>
                                          </div>
                                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <span>Payables Formula:</span>
                                            <span>{formatCurrency(stage3WorkingCapitalAudit.payableFormula)}</span>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                        <pre className="dm-audit-panel-body">{renderAuditText(combinedAuditText)}</pre>
                      </>
                    )}
                  </div>
                )}

              </div>
            </section>

            {activeStep.id !== 'review' && (
              <aside className="dm-impact">
                <div className="dm-impact-card">
                  {activeStep.id === 'review' ? (
                    <div className="dm-impact-review">
                      <div className="dm-impact-header">
                        <span>Current Game State</span>
                        <span className="dm-impact-live" style={impactStatusStyle}>
                          {renderImpactStatus(impactStatusLabelActive)}
                        </span>
                      </div>

                      <div className="dm-impact-kpi">
                        <div className="dm-impact-kpi-label">Current Round</div>
                        <div className="dm-impact-kpi-value">{roundLabel}</div>
                        <div className="dm-impact-muted">{scenarioLabel}</div>
                      </div>

                      <div className="dm-impact-kpi">
                        <div className="dm-impact-kpi-label">Start Cash</div>
                        <div className="dm-impact-kpi-value">{formatCurrency(startCash)}</div>
                      </div>

                      <div className="dm-impact-kpi">
                        <div className="dm-impact-kpi-label">Debt Load</div>
                        <div className="dm-impact-kpi-value">{formatCurrency(debtBalance)}</div>
                        <div className="dm-impact-progress">
                          <span
                            className="dm-impact-progress-fill"
                            style={{ width: `${Math.min(100, (debtRatioDisplay / maxDebtRatio) * 100)}%` }}
                          />
                        </div>
                        <div className="dm-impact-muted">
                          Debt Ratio: {formatRatio(debtRatio)} ({debtRiskLabel})
                        </div>
                      </div>

                      <div className="dm-impact-insight">
                        <div className="dm-impact-insight-title">CEO Insight</div>
                        <p>{reviewInsight}</p>
                      </div>
                    </div>
                  ) : activeStep.id === 'forecast' ? (
                    <div className="dm-impact-forecast">
                      <div className="dm-impact-header">
                        <span>Forecast Impact</span>
                        <span className="dm-impact-live" style={impactStatusStyle}>
                          {renderImpactStatus(impactStatusLabelLive)}
                        </span>
                      </div>

                      <div className="dm-impact-kpi">
                        <div className="dm-impact-kpi-label">Total Projected Demand</div>
                        <div className="dm-impact-kpi-value">{formatUnits(forecastProjectedTotal)}</div>
                        <div className="dm-impact-delta positive">
                          {formatRatio(Math.max(0, forecastDeltaPct))} vs Last Round
                        </div>
                        <div className="dm-impact-muted">Units you plan to sell</div>
                      </div>

                      {/* This Round's Conditions */}
                      {(() => {
                        const conditions = []
                        const baseTaxRates = GAME_CONFIG.financial.taxRateByRegion
                        const baseInterestRate = GAME_CONFIG.financial.interestRate
                        const baseLogistics = {
                          usToAsia: 0.20,
                          usToEurope: 0.40,
                          asiaToUs: 0.20,
                          asiaToEurope: 0.50,
                          europeToUs: 0.05,
                          europeToAsia: 0.03
                        }

                        const getMagnitude = (modifier: number): string => {
                          const delta = Math.abs(modifier - 1)
                          if (delta < 0.05) return 'slightly'
                          if (delta < 0.10) return 'moderately'
                          if (delta < 0.20) return 'significantly'
                          return 'dramatically'
                        }

                        const getMagnitudeDelta = (delta: number): string => {
                          const abs = Math.abs(delta)
                          if (abs < 0.03) return 'slightly'
                          if (abs < 0.08) return 'moderately'
                          if (abs < 0.15) return 'significantly'
                          return 'dramatically'
                        }

                        // Cost Inflation
                        if (scenario?.costInflation && scenario.costInflation !== 1) {
                          const mag = getMagnitude(scenario.costInflation)
                          if (scenario.costInflation > 1.02) {
                            conditions.push({ icon: '📈', text: `Production costs rising ${mag}` })
                          } else if (scenario.costInflation < 0.98) {
                            conditions.push({ icon: '📉', text: `Production costs falling ${mag}` })
                          }
                        }

                        // Investment Cost
                        if (scenario?.investmentCostMultiplier && scenario.investmentCostMultiplier !== 1) {
                          const mag = getMagnitude(scenario.investmentCostMultiplier)
                          if (scenario.investmentCostMultiplier > 1.03) {
                            conditions.push({ icon: '🏗️', text: `R&D and factory expansions ${mag} more expensive` })
                          } else if (scenario.investmentCostMultiplier < 0.97) {
                            conditions.push({ icon: '🏗️', text: `R&D and factory expansions ${mag} cheaper` })
                          }
                        }

                        // Interest Rate
                        const interestSpread = scenario?.interestRateSpread ?? 0
                        if (Math.abs(interestSpread) > 0.002) {
                          const currentRate = baseInterestRate + interestSpread
                          const mag = getMagnitudeDelta(interestSpread)
                          if (interestSpread > 0) {
                            conditions.push({ icon: '💰', text: `Interest rates: ${formatPercent(currentRate * 100)} (↑ rising ${mag} from ${formatPercent(baseInterestRate * 100)})` })
                          } else {
                            conditions.push({ icon: '💰', text: `Interest rates: ${formatPercent(currentRate * 100)} (↓ falling ${mag} from ${formatPercent(baseInterestRate * 100)})` })
                          }
                        }

                        // Marketing Effectiveness
                        if (scenario?.marketingEffectModifier && scenario.marketingEffectModifier !== 1) {
                          const mag = getMagnitude(scenario.marketingEffectModifier)
                          if (scenario.marketingEffectModifier > 1.05) {
                            conditions.push({ icon: '📢', text: `Marketing ${mag} more effective` })
                          } else if (scenario.marketingEffectModifier < 0.95) {
                            conditions.push({ icon: '📢', text: `Marketing ${mag} less effective` })
                          }
                        }

                        // Price Elasticity
                        if (scenario?.priceElasticityModifier && scenario.priceElasticityModifier !== 1) {
                          const mag = getMagnitude(scenario.priceElasticityModifier)
                          if (scenario.priceElasticityModifier > 1.05) {
                            conditions.push({ icon: '💵', text: `Customers ${mag} more price-sensitive` })
                          } else if (scenario.priceElasticityModifier < 0.95) {
                            conditions.push({ icon: '💵', text: `Customers ${mag} less price-conscious` })
                          }
                        }

                        // CSR Importance
                        if (scenario?.csrImportanceModifier && scenario.csrImportanceModifier !== 1) {
                          const mag = getMagnitude(scenario.csrImportanceModifier)
                          if (scenario.csrImportanceModifier > 1.1) {
                            conditions.push({ icon: '🌿', text: `Sustainability ${mag} more important` })
                          } else if (scenario.csrImportanceModifier < 0.9) {
                            conditions.push({ icon: '🌿', text: `Sustainability ${mag} less important` })
                          }
                        }

                        // Tax Rate Changes
                        const taxDeltas = scenario?.taxRateDeltaByRegion
                        const taxChanges = []
                        if (taxDeltas?.us && Math.abs(taxDeltas.us) > 0.01) {
                          const newRate = baseTaxRates.us + taxDeltas.us
                          taxChanges.push(`${regionLabels.us}: ${formatPercent(newRate * 100)} (${taxDeltas.us > 0 ? '↑' : '↓'})`)
                        }
                        if (taxDeltas?.asia && Math.abs(taxDeltas.asia) > 0.01) {
                          const newRate = baseTaxRates.asia + taxDeltas.asia
                          taxChanges.push(`${regionLabels.asia}: ${formatPercent(newRate * 100)} (${taxDeltas.asia > 0 ? '↑' : '↓'})`)
                        }
                        if (taxDeltas?.europe && Math.abs(taxDeltas.europe) > 0.01) {
                          const newRate = baseTaxRates.europe + taxDeltas.europe
                          taxChanges.push(`${regionLabels.europe}: ${formatPercent(newRate * 100)} (${taxDeltas.europe > 0 ? '↑' : '↓'})`)
                        }
                        if (taxChanges.length > 0) {
                          conditions.push({ icon: '💼', text: 'Tax rates: ' + taxChanges.join(', ') })
                        }

                        // Regional Demand
                        const demandMods = scenario?.demandModifier
                        const demandChanges = []
                        if (demandMods?.us && Math.abs(demandMods.us) > 1) {
                          const mag = demandMods.us > 10 ? 'much stronger' : demandMods.us > 5 ? 'stronger' : demandMods.us < -10 ? 'much weaker' : 'weaker'
                          demandChanges.push(`🇺🇸 ${regionLabels.us}: ${mag} demand`)
                        }
                        if (demandMods?.asia && Math.abs(demandMods.asia) > 1) {
                          const mag = demandMods.asia > 10 ? 'much stronger' : demandMods.asia > 5 ? 'stronger' : demandMods.asia < -10 ? 'much weaker' : 'weaker'
                          demandChanges.push(`🌏 ${regionLabels.asia}: ${mag} demand`)
                        }
                        if (demandMods?.europe && Math.abs(demandMods.europe) > 1) {
                          const mag = demandMods.europe > 10 ? 'much stronger' : demandMods.europe > 5 ? 'stronger' : demandMods.europe < -10 ? 'much weaker' : 'weaker'
                          demandChanges.push(`🇪🇺 ${regionLabels.europe}: ${mag} demand`)
                        }
                        if (demandChanges.length > 0) {
                          conditions.push({ icon: '📊', text: demandChanges.join(', ') })
                        }

                        // Logistics Costs
                        const logistics = scenario?.logisticsTariff
                        const logisticsChanges = []
                        if (logistics?.usToAsia && Math.abs(logistics.usToAsia - baseLogistics.usToAsia) > 0.01) {
                          const change = logistics.usToAsia - baseLogistics.usToAsia
                          logisticsChanges.push(`US→Asia: ${formatCurrency(logistics.usToAsia)} (${change > 0 ? '↑' : '↓'} ${formatCurrency(Math.abs(change))})`)
                        }
                        if (logistics?.usToEurope && Math.abs(logistics.usToEurope - baseLogistics.usToEurope) > 0.01) {
                          const change = logistics.usToEurope - baseLogistics.usToEurope
                          logisticsChanges.push(`US→EU: ${formatCurrency(logistics.usToEurope)} (${change > 0 ? '↑' : '↓'} ${formatCurrency(Math.abs(change))})`)
                        }
                        if (logistics?.asiaToUs && Math.abs(logistics.asiaToUs - baseLogistics.asiaToUs) > 0.01) {
                          const change = logistics.asiaToUs - baseLogistics.asiaToUs
                          logisticsChanges.push(`Asia→US: ${formatCurrency(logistics.asiaToUs)} (${change > 0 ? '↑' : '↓'} ${formatCurrency(Math.abs(change))})`)
                        }
                        if (logistics?.asiaToEurope && Math.abs(logistics.asiaToEurope - baseLogistics.asiaToEurope) > 0.01) {
                          const change = logistics.asiaToEurope - baseLogistics.asiaToEurope
                          logisticsChanges.push(`Asia→EU: ${formatCurrency(logistics.asiaToEurope)} (${change > 0 ? '↑' : '↓'} ${formatCurrency(Math.abs(change))})`)
                        }
                        if (logistics?.europeToUs && Math.abs(logistics.europeToUs - baseLogistics.europeToUs) > 0.01) {
                          const change = logistics.europeToUs - baseLogistics.europeToUs
                          logisticsChanges.push(`EU→US: ${formatCurrency(logistics.europeToUs)} (${change > 0 ? '↑' : '↓'} ${formatCurrency(Math.abs(change))})`)
                        }
                        if (logistics?.europeToAsia && Math.abs(logistics.europeToAsia - baseLogistics.europeToAsia) > 0.01) {
                          const change = logistics.europeToAsia - baseLogistics.europeToAsia
                          logisticsChanges.push(`EU→Asia: ${formatCurrency(logistics.europeToAsia)} (${change > 0 ? '↑' : '↓'} ${formatCurrency(Math.abs(change))})`)
                        }
                        if (logisticsChanges.length > 0) {
                          conditions.push({ icon: '🚢', text: 'Shipping: ' + logisticsChanges.join('; ') })
                        }

                        // Working Capital
                        const wc = scenario?.workingCapitalDelta
                        if (wc?.inventory && Math.abs(wc.inventory) > 0.01) {
                          const mag = getMagnitudeDelta(wc.inventory)
                          conditions.push({ icon: '📦', text: `Inventory holding costs ${wc.inventory > 0 ? 'increased' : 'decreased'} ${mag}` })
                        }

                        if (conditions.length === 0) {
                          return null
                        }

                        return (
                          <div className="dm-impact-forecast-block" style={{ marginBottom: '1.5rem' }}>
                            <div className="dm-impact-forecast-title">📊 This Round's Conditions</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.8rem' }}>
                              {conditions.map((cond, idx) => (
                                <div key={idx} style={{
                                  display: 'flex',
                                  alignItems: 'flex-start',
                                  gap: '0.5rem',
                                  lineHeight: '1.5',
                                  color: '#e5e7eb'
                                }}>
                                  <span style={{ flexShrink: 0 }}>{cond.icon}</span>
                                  <span>{cond.text}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )
                      })()}

                      <div className="dm-impact-forecast-block">
                        <div className="dm-impact-forecast-title">Production Requirements</div>
                        <div className="dm-impact-forecast-row">
                          <span>{regionLabels.us} Demand</span>
                          <span>{formatUnits(forecastProjected.us)}</span>
                        </div>
                        <div className="dm-impact-progress">
                          <span className="dm-impact-progress-fill" style={{ width: `${(forecastProjected.us / forecastMaxRegion) * 100}%` }} />
                        </div>
                        <div className="dm-impact-forecast-row">
                          <span>{regionLabels.asia} Demand</span>
                          <span>{formatUnits(forecastProjected.asia)}</span>
                        </div>
                        <div className="dm-impact-progress">
                          <span className="dm-impact-progress-fill" style={{ width: `${(forecastProjected.asia / forecastMaxRegion) * 100}%`, background: '#ec4899' }} />
                        </div>
                        <div className="dm-impact-forecast-row">
                          <span>{regionLabels.europe} Demand</span>
                          <span>{formatUnits(forecastProjected.europe)}</span>
                        </div>
                        <div className="dm-impact-progress">
                          <span className="dm-impact-progress-fill" style={{ width: `${(forecastProjected.europe / forecastMaxRegion) * 100}%`, background: '#f59e0b' }} />
                        </div>
                      </div>

                      <div className="dm-impact-insight">
                        <div className="dm-impact-insight-title">Analyst Note</div>
                        <p>
                          {scenarioLabel} demand signals are driving this forecast. Ensure capacity matches your growth targets.
                        </p>
                      </div>
                    </div>
                  ) : activeStep.id === 'production' ? (
                    <div className="dm-prod-impact">
                      <div className="dm-impact-header">
                        <span>Production Impact</span>
                        <span className="dm-impact-live" style={impactStatusStyle}>
                          {renderImpactStatus(impactStatusLabelLive)}
                        </span>
                      </div>
                      {(() => {
                        const normalizedIndustry = (game?.industry || '').toLowerCase();
                        let gifName = 'electronis-production.gif';
                        if (normalizedIndustry.includes('oil')) gifName = 'oil-production.gif';
                        else if (normalizedIndustry.includes('auto') || normalizedIndustry.includes('car')) gifName = 'cars-production.gif';

                        return (
                          <div style={{ marginBottom: '1rem', overflow: 'hidden', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
                            <img
                              src={`/images/decisions/${gifName}`}
                              alt="Production Activity"
                              style={{ width: '100%', height: '120px', objectFit: 'cover', display: 'block' }}
                            />
                          </div>
                        );
                      })()}

                      <div className="dm-impact-kpi">
                        <div className="dm-impact-kpi-label">Total Available</div>
                        <div className="dm-impact-kpi-value">{formatUnits(prodAvailable)}</div>
                        <div className="dm-impact-delta positive">Includes inventory on hand</div>
                      </div>

                      <div className="dm-impact-forecast-block">
                        <div className="dm-impact-kpi-label" style={{ marginBottom: '0.5rem' }}>Forecasted Demand</div>
                        <div style={{ fontSize: '1.25rem', color: 'white', fontWeight: 600 }}>{formatUnits(prodForecastDemand)} units</div>
                        <div className="dm-impact-forecast-row">
                          <span>Planned output</span>
                          <span>{formatUnits(prodTotalOutput)}</span>
                        </div>
                        <div className="dm-impact-forecast-row">
                          <span>Inventory on hand</span>
                          <span>{formatUnits(reviewInventoryTotal)}</span>
                        </div>
                        <div className="dm-impact-forecast-row">
                          <span>Available (incl. inventory)</span>
                          <span>{formatUnits(prodAvailable)}</span>
                        </div>

                        {prodShortage > 0 && (
                          <div className="dm-prod-shortage">
                            ⚠ Shortage: -{formatUnits(prodShortage)} units
                          </div>
                        )}
                      </div>

                      {/* Factory Efficiency Curve */}
                      <div style={{
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '8px',
                        padding: '1rem',
                        marginBottom: '1rem'
                      }}>
                        <div style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.75rem', color: 'var(--text-main)' }}>
                          Factory Efficiency Curve
                        </div>
                        <svg viewBox="0 0 400 200" style={{ width: '100%', height: 'auto', maxHeight: '180px' }}>
                          {/* Background grid */}
                          <line x1="40" y1="20" x2="40" y2="160" stroke="var(--border-color)" strokeWidth="1" />
                          <line x1="40" y1="160" x2="380" y2="160" stroke="var(--border-color)" strokeWidth="1" />

                          {/* Optimal zone (70-90%) */}
                          {(() => {
                            const xStart = 40 + (70 / 120) * 340
                            const xEnd = 40 + (90 / 120) * 340
                            return (
                              <rect
                                x={xStart}
                                y="20"
                                width={xEnd - xStart}
                                height="140"
                                fill="#22c55e"
                                opacity="0.1"
                              />
                            )
                          })()}

                          {/* U-shaped cost curve */}
                          {(() => {
                            const points: string[] = []
                            const optimalUtil = optimalUtilizationPct / 100
                            const curvature = GAME_CONFIG.costCurve.curvature

                            for (let util = 0; util <= 1.2; util += 0.02) {
                              const x = 40 + (util / 1.2) * 340
                              const costMultiplier = 1 + curvature * Math.pow(util - optimalUtil, 2)
                              const y = 160 - (costMultiplier - 1) * 350 // Scale for visibility
                              points.push(`${x},${y}`)
                            }

                            return (
                              <polyline
                                points={points.join(' ')}
                                fill="none"
                                stroke="#3b82f6"
                                strokeWidth="2.5"
                              />
                            )
                          })()}

                          {/* Current position marker */}
                          {(() => {
                            const currentUtil = Math.min(1.2, Math.max(0, costUtilizationPct / 100))
                            const optimalUtil = optimalUtilizationPct / 100
                            const curvature = GAME_CONFIG.costCurve.curvature
                            const costMultiplier = 1 + curvature * Math.pow(currentUtil - optimalUtil, 2)

                            const x = 40 + (currentUtil / 1.2) * 340
                            const y = 160 - (costMultiplier - 1) * 350

                            const isOptimal = currentUtil >= 0.7 && currentUtil <= 0.9
                            const markerColor = isOptimal ? '#22c55e' : currentUtil < 0.7 || currentUtil > 1.0 ? '#ef4444' : '#f59e0b'

                            return (
                              <>
                                <circle cx={x} cy={y} r="6" fill={markerColor} stroke="#fff" strokeWidth="2" />
                                <text x={x} y={y - 15} textAnchor="middle" fontSize="11" fontWeight="600" fill={markerColor}>
                                  You ({costUtilizationPct.toFixed(0)}%)
                                </text>
                              </>
                            )
                          })()}

                          {/* Optimal marker */}
                          {(() => {
                            const optimalUtil = optimalUtilizationPct / 100
                            const x = 40 + (optimalUtil / 1.2) * 340

                            return (
                              <>
                                <line x1={x} y1="20" x2={x} y2="160" stroke="#22c55e" strokeWidth="1.5" strokeDasharray="4,4" opacity="0.5" />
                                <text x={x} y="15" textAnchor="middle" fontSize="10" fill="#22c55e" fontWeight="600">
                                  Optimal
                                </text>
                              </>
                            )
                          })()}

                          {/* X-axis labels */}
                          <text x="40" y="180" textAnchor="middle" fontSize="10" fill="var(--text-muted)">0%</text>
                          <text x="180" y="180" textAnchor="middle" fontSize="10" fill="var(--text-muted)">50%</text>
                          <text x="320" y="180" textAnchor="middle" fontSize="10" fill="var(--text-muted)">100%</text>

                          {/* Y-axis label */}
                          <text x="10" y="90" textAnchor="middle" fontSize="10" fill="var(--text-muted)" transform="rotate(-90, 10, 90)">
                            Cost
                          </text>

                          {/* X-axis label */}
                          <text x="210" y="198" textAnchor="middle" fontSize="10" fill="var(--text-muted)">
                            Factory Utilization
                          </text>
                        </svg>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem', textAlign: 'center' }}>
                          {costUtilizationPct >= 70 && costUtilizationPct <= 90
                            ? '✓ Operating in optimal efficiency zone (lowest cost)'
                            : costUtilizationPct < 70
                              ? '⚠ Under-utilized - reduce production or increase capacity usage'
                              : '⚠ Over-utilized - add capacity or reduce production to lower costs'}
                        </div>
                      </div>

                      <div className="dm-impact-kpi">
                        <div className="dm-impact-kpi-label">Avg Unit Cost</div>
                        <div className="dm-impact-kpi-value">{formatCurrencyFull(unitCostEstimate.finalUnitCost)}</div>
                        <div className="dm-impact-delta positive">
                          Utilization {costUtilizationPct.toFixed(0)}% (Optimal {optimalUtilizationPct.toFixed(0)}%)
                        </div>
                      </div>

                      <div className="dm-impact-kpi">
                        <div className="dm-impact-kpi-label">Total Production Cost</div>
                        <div className="dm-impact-kpi-value">{formatCurrency(prodTotalCost)}</div>
                      </div>
                      <div className="dm-impact-forecast-block">
                        <div className="dm-impact-forecast-row">
                          <span>In-house Cost</span>
                          <span>{formatCurrency(prodInHouseCost)}</span>
                        </div>
                        <div className="dm-impact-forecast-row">
                          <span>Outsource Cost</span>
                          <span>{formatCurrency(prodOutsourceCost)}</span>
                        </div>
                      </div>

                      <div className="dm-impact-insight">
                        <div className="dm-impact-insight-title">Operations Insight</div>
                        <p>
                          {prodShortage > 0
                            ? `You are under-producing by ${formatUnits(prodShortage)} units. Increase utilization or use outsourcing to meet the full demand.`
                            : "Your current production matches your forecast. Watch your margins."
                          }
                        </p>
                      </div>
                    </div>
                  ) : activeStep.id === 'logistics' ? (
                    <div className="dm-logistics-impact">
                      <div className="dm-impact-header">
                        <span>Logistics Impact</span>
                        <span className="dm-impact-live" style={impactStatusStyle}>
                          {renderImpactStatus(impactStatusLabelLive)}
                        </span>
                      </div>
                      <div style={{ marginBottom: '1rem', overflow: 'hidden', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
                        <img
                          src="/images/decisions/logistics.gif"
                          alt="Logistics Activity"
                          style={{ width: '100%', height: '120px', objectFit: 'cover', display: 'block' }}
                        />
                      </div>
                      <div className="dm-impact-kpi">
                        <div className="dm-impact-kpi-label">Fulfillment Rate</div>
                        <div className="dm-impact-kpi-value">{formatPercent(((logisticsServed.us + logisticsServed.asia + logisticsServed.europe) / Math.max(1, forecastProjectedTotal)) * 100)}</div>
                        <div className={`dm-impact-delta ${(logisticsServed.us + logisticsServed.asia + logisticsServed.europe) / Math.max(1, forecastProjectedTotal) >= 0.9 ? 'positive' : (logisticsServed.us + logisticsServed.asia + logisticsServed.europe) / Math.max(1, forecastProjectedTotal) >= 0.6 ? 'warning' : 'danger'}`}>
                          {(logisticsServed.us + logisticsServed.asia + logisticsServed.europe) / Math.max(1, forecastProjectedTotal) >= 0.9 ? 'On Track' : (logisticsServed.us + logisticsServed.asia + logisticsServed.europe) / Math.max(1, forecastProjectedTotal) >= 0.6 ? 'At Risk' : 'Critical'}
                        </div>
                      </div>

                      <div className="dm-impact-forecast-block">
                        <div className="dm-impact-kpi-label" style={{ marginBottom: '0.5rem' }}>Unmet Demand</div>
                        <div className="dm-impact-forecast-row"><span className="region-label us">{regionLabels.us}</span><span className="region-val us" style={{ color: logisticsUnmet.us > 0 ? '#ef4444' : '#34d399' }}>{logisticsUnmet.us > 0 ? `-${formatUnits(logisticsUnmet.us)}` : 'Met'}</span></div>
                        <div className="dm-impact-forecast-row"><span className="region-label asia">{regionLabels.asia}</span><span className="region-val asia" style={{ color: logisticsUnmet.asia > 0 ? '#ef4444' : '#34d399' }}>{logisticsUnmet.asia > 0 ? `-${formatUnits(logisticsUnmet.asia)}` : 'Met'}</span></div>
                        <div className="dm-impact-forecast-row"><span className="region-label europe">{regionLabels.europe}</span><span className="region-val europe" style={{ color: logisticsUnmet.europe > 0 ? '#ef4444' : '#34d399' }}>{logisticsUnmet.europe > 0 ? `-${formatUnits(logisticsUnmet.europe)}` : 'Met'}</span></div>
                      </div>

                      <div className="dm-impact-kpi">
                        <div className="dm-impact-kpi-label">Total Logistics Cost</div>
                        <div className="dm-impact-kpi-value">{formatCurrency(logisticsCostTotal)}</div>
                      </div>

                      <div className="dm-impact-insight">
                        <div className="dm-impact-insight-title">Logistics Alert</div>
                        <p>{logisticsUnmet.asia > 0 ? `Shortage in ${regionLabels.asia}. Consider changing priority to fulfill demand first.` : 'Priority routing is balancing demand across regions.'}</p>
                      </div>
                    </div>
                  ) : activeStep.id === 'rnd' ? (
                    <div className="dm-logistics-impact">
                      <div className="dm-impact-header">
                        <span>Innovation Impact</span>
                        <span className="dm-impact-live" style={impactStatusStyle}>
                          {renderImpactStatus(impactStatusLabelLive)}
                        </span>
                      </div>
                      <div style={{ marginBottom: '1rem', overflow: 'hidden', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
                        <img
                          src="/images/decisions/Rnd.gif"
                          alt="R&D Activity"
                          style={{ width: '100%', height: '120px', objectFit: 'cover', display: 'block' }}
                        />
                      </div>
                      <div className="dm-impact-kpi">
                        <div className="dm-impact-kpi-label">Total Research Hours</div>
                        <div className="dm-impact-kpi-value">{formatUnits(totalResearchHours)}</div>
                        <div className={`dm-impact-delta ${rndEfficiencyDelta >= 0 ? 'positive' : 'danger'}`}>
                          {rndEfficiencyDelta >= 0 ? '+' : ''}{rndEfficiencyDelta}% vs base
                        </div>
                      </div>
                      <div className="dm-impact-kpi">
                        <div className="dm-impact-kpi-label">Features Unlocking This Round</div>
                        <div className="dm-impact-kpi-value">{featuresUnlockingThisRound}</div>
                        <div className="dm-impact-muted">Next: {nextFeatureName} ({formatUnits(hoursRemaining)} hrs)</div>
                      </div>
                      <div className="dm-impact-kpi">
                        <div className="dm-impact-kpi-label">Total R&amp;D Spend</div>
                        <div className="dm-impact-kpi-value">{formatCurrency(rndTotalSpend * currentCostInflation)}</div>
                      </div>
                      <div className="dm-impact-insight">
                        <div className="dm-impact-insight-title">Innovation Tip</div>
                        <p>High training improves innovation speed but raises current round costs.</p>
                      </div>
                    </div>
                  ) : activeStep.id === 'submit' ? (
                    <div className="dm-logistics-impact">
                      <div className="dm-impact-header">
                        <span>Submission Impact</span>
                        <span className="dm-impact-live" style={isLocked ? impactStatusStyle : undefined}>
                          {isLocked ? renderImpactStatus(impactStatusLabelLive) : 'Summary'}
                        </span>
                      </div>

                      <div className="dm-impact-kpi">
                        <div className="dm-impact-kpi-label">Projected Revenue (Est)</div>
                        <div className="dm-impact-kpi-value">{formatCurrency(marketingTotalRevenue)}</div>
                      </div>

                      <div className="dm-impact-kpi">
                        <div className="dm-impact-kpi-label">Projected Ending Cash</div>
                        <div className="dm-impact-kpi-value">{formatCurrency(projectedEndingCash)}</div>
                      </div>

                      <div className="dm-impact-kpi">
                        <div className="dm-impact-kpi-label">Fulfillment Rate</div>
                        <div className="dm-impact-kpi-value">{formatPercent((forecastProjectedTotal > 0 ? (logisticsServed.us + logisticsServed.asia + logisticsServed.europe) / forecastProjectedTotal : 1) * 100)}</div>
                      </div>

                      <div className="dm-impact-kpi">
                        <div className="dm-impact-kpi-label">Net Profit Estimate</div>
                        <div className="dm-impact-kpi-value">{formatCurrency(financeNetProfitEstimate)}</div>
                      </div>

                      <div className="dm-impact-insight">
                        <div className="dm-impact-insight-title">Analyst Insight</div>
                        <p>Your strategy for Round {currentRound} is ready for submission. Review the KPIs above one last time before locking.</p>
                      </div>
                    </div>
                  ) : activeStep.id === 'marketing' ? (
                    <div className="dm-logistics-impact">
                      <div className="dm-impact-header">
                        <span>Marketing Impact</span>
                        <span className="dm-impact-live" style={impactStatusStyle}>
                          {renderImpactStatus(impactStatusLabelLive)}
                        </span>
                      </div>
                      {(() => {
                        const normalizedIndustry = (game?.industry || '').toLowerCase();
                        let gifName = 'electronics-marketing.gif';
                        if (normalizedIndustry.includes('oil')) gifName = 'oil-marketing.gif';
                        else if (normalizedIndustry.includes('auto') || normalizedIndustry.includes('car')) gifName = 'car-marketing.gif';

                        return (
                          <div style={{ marginBottom: '1rem', overflow: 'hidden', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
                            <img
                              src={`/images/decisions/${gifName}`}
                              alt="Marketing Activity"
                              style={{ width: '100%', height: '120px', objectFit: 'cover', display: 'block' }}
                            />
                          </div>
                        );
                      })()}
                      <div className="dm-impact-kpi">
                        <div className="dm-impact-kpi-label">Projected Revenue</div>
                        <div className="dm-impact-kpi-value">{formatCurrency(marketingTotalRevenue)}</div>
                        <div className={`dm-impact-delta ${marketingRevenueDeltaPct >= 0 ? 'positive' : 'danger'}`}>
                          {marketingRevenueDeltaPct >= 0 ? '+' : ''}{formatPercent(marketingRevenueDeltaPct)} vs Last Round
                        </div>
                      </div>
                      <div className="dm-impact-kpi">
                        <div className="dm-impact-kpi-label">Total Promo Spend</div>
                        <div className="dm-impact-kpi-value">{formatCurrency(marketingPromoSpend)}</div>
                      </div>
                      <div className="dm-impact-kpi">
                        <div className="dm-impact-kpi-label">Breakeven Unit Price</div>
                        <div className="dm-impact-kpi-value">{formatCurrencyFull(unitCostAfterScenario * 1.15)}</div>
                        <div className="dm-impact-muted">Unit cost + 15% operating expenses</div>
                      </div>
                      <div className="dm-impact-kpi">
                        <div className="dm-impact-kpi-label">Avg Growth Target</div>
                        <div className="dm-impact-kpi-value">{formatGrowthTarget(Math.round(marketingGrowthAvg))}</div>
                      </div>
                      <div className="dm-impact-insight">
                        <div className="dm-impact-insight-title">Strategy Tip</div>
                        <p>{marketingPromos.asia > marketingPromos.us ? `Higher promo in ${regionLabels.asia} is boosting demand focus.` : 'Balance price and promotion to protect margins.'}</p>
                      </div>
                    </div>
                  ) : activeStep.id === 'finance' ? (
                    <div className="dm-logistics-impact">
                      <div className="dm-impact-header">
                        <span>Financial Impact</span>
                        <span className="dm-impact-live" style={impactStatusStyle}>
                          {renderImpactStatus(impactStatusLabelLive)}
                        </span>
                      </div>
                      <div className="dm-impact-kpi">
                        <div className="dm-impact-kpi-label">Proj. Ending Cash</div>
                        <div className="dm-impact-kpi-value">{formatCurrency(projectedEndingCash)}</div>
                        <div className={`dm-impact-delta ${projectedEndingCash >= minCashReserve ? 'positive' : 'danger'}`}>
                          {projectedEndingCash >= minCashReserve ? 'Healthy' : 'Below Reserve'}
                        </div>
                      </div>
                      <div className="dm-impact-cashflow">
                        <div className="dm-impact-cashflow-title">Cash Flow Breakdown</div>
                        <div className="dm-cf-row"><span>Opening Cash</span><span>{formatCurrency(startCash)}</span></div>
                        <div className="dm-cf-row">
                          <span>Debt {netDebtChange >= 0 ? '(Borrow)' : '(Repay)'}</span>
                          <span className={netDebtChange >= 0 ? 'dm-cf-pos' : 'dm-cf-neg'}>
                            {netDebtChange >= 0 ? '+' : ''}{formatCurrency(netDebtChange)}
                          </span>
                        </div>
                        <div className="dm-cf-row">
                          <span>Shares {netShareChange >= 0 ? '(Issue)' : '(Buyback)'}</span>
                          <span className={netShareChange >= 0 ? 'dm-cf-pos' : 'dm-cf-neg'}>
                            {netShareChange >= 0 ? '+' : ''}{formatCurrency(netShareChange)}
                          </span>
                        </div>
                        <div className="dm-cf-row"><span>Dividends</span><span className="dm-cf-neg">-{formatCurrency(financeDividend)}</span></div>
                        <div className="dm-cf-row"><span>Factory Investment ({financePlantsUS + financePlantsAsia} new)</span><span className="dm-cf-neg">-{formatCurrency(totalInvestmentCost)}</span></div>
                        <div className="dm-cf-row total"><span>Ending Cash</span><span>{formatCurrency(projectedEndingCash)}</span></div>
                      </div>
                      <div className="dm-impact-forecast-note">
                        <div>Forecast Revenue: {formatCurrency(marketingTotalRevenue)}</div>
                        <div>Forecast Expenses: {formatCurrency(forecastExpenseEstimate)} <span>(COGS + Operating + Promo)</span></div>
                        <div className="dm-impact-forecast-disclaimer">Not included in available cash calculations.</div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="dm-impact-title">Turn Projection</div>
                      <div className="dm-impact-block">
                        <div className="dm-impact-label">Projected Revenue</div>
                        <div className="dm-impact-value">$5.42B</div>
                        <div className="dm-impact-delta positive">+12.4% vs R1</div>
                      </div>
                      <div className="dm-impact-block">
                        <div className="dm-impact-label">Net Profit (Est)</div>
                        <div className="dm-impact-value">$640M</div>
                        <div className="dm-impact-delta positive">Target Achieved</div>
                      </div>
                      <div className="dm-impact-block">
                        <div className="dm-impact-label">Closing Cash</div>
                        <div className="dm-impact-value">$890M</div>
                        <div className="dm-impact-bar">
                          <span className="dm-impact-bar-fill" />
                        </div>
                      </div>
                      <div className="dm-impact-note">
                        <div className="dm-impact-note-title">Analyst Insight</div>
                        <p>
                          Current marketing intensity in Asia is high. This will secure volume but
                          lower your ROS by 1.2%.
                        </p>
                      </div>
                    </>
                  )}
                  <div className="dm-help-widget">
                    <HelpWidget />
                  </div>
                </div>
              </aside>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}




