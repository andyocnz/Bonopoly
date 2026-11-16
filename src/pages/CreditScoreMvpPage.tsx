import { QRCodeSVG } from 'qrcode.react'
import { useEffect, useMemo, useState } from 'react'
import {
  CREDIT_SCENARIOS,
  drawCreditScenarios,
  PROFILE_PRESETS,
  CATEGORY_LABELS,
  CATEGORY_ICONS,
  EXPENSE_LABELS,
  UTILITY_COLLECTIONS_SCENARIO,
  getScenariosByCategory,
  totalExpenses,
  totalSavings,
  monthlyNet,
  monthlyDeductionBreakdown,
  calculateCardPayment,
  type CreditScenario,
  type CreditScenarioChoice,
  type CreditBudgetProfile,
  type CreditFactors,
  type CreditHistoryEntry,
  type ProfilePreset,
  type CreditScenarioCategory,
} from '../engine/creditScenarios'
import { useTheme } from '../context/ThemeContext'
import { SidebarFooter } from '../components/SidebarFooter'
import { InfoTooltip } from '../components/InfoTooltip'
import { MiniGameShell } from '../features/minigames/MiniGameShell'
import { educatorMiniGamesApi } from '../features/minigames/api'
import { getEducatorSessionCached, getEducatorSessionSync } from '../features/minigames/educatorSession'
import './CreditScoreMvpPage.css'
import '../features/minigames/SessionControlPanel.css'

// ─── Constants ───────────────────────────────────────────────────────────────

const STARTING_FACTORS: CreditFactors = {
  paymentHistory: 0.86,
  utilization: 0.6,
  ageOfCredit: 0.45,
  creditMix: 0.4,
  newInquiries: 0.82,
}

const SCORE_WEIGHTS = {
  paymentHistory: 0.35,
  utilization: 0.3,
  ageOfCredit: 0.15,
  creditMix: 0.1,
  newInquiries: 0.1,
} as const

const ROUNDS_PER_GAME = 15
const MIN_STARTING_MONTHLY_NET = 80
const SAVINGS_GOAL_TARGET = 2000
const SAVINGS_GOAL_ROUND = 8

type InsurancePlan = 'none' | 'basic' | 'comprehensive'
type InvestmentType = 'none' | 'shares' | 'kiwisaver' | 'term-pie'

interface InvestmentState {
  type: InvestmentType
  principalInvested: number
  currentValue: number
  totalReturn: number
}

const FACTOR_TIPS: Record<keyof CreditFactors, string> = {
  paymentHistory: 'Paying every bill on time is the #1 factor. In this simulator, a missed payment drops your score 15–40 points. Real-world credit bureaus typically report 60–110 point drops for the same event.',
  utilization: 'This is your card balance divided by your card limit. Keep it under 30%. Lower is better. This updates automatically when your balance changes.',
  ageOfCredit: 'The longer your accounts have been open, the better. Opening new accounts reduces your average age.',
  creditMix: 'Having different types of credit (card + loan) shows lenders you can manage variety.',
  newInquiries: 'Each credit application triggers a "hard inquiry". Too many in a short time looks risky. They fade over 2 years.',
}

const FACTOR_NAMES: Record<keyof CreditFactors, string> = {
  paymentHistory: 'Payment History (35%)',
  utilization: 'Utilization (30%)',
  ageOfCredit: 'Age of Credit (15%)',
  creditMix: 'Credit Mix (10%)',
  newInquiries: 'New Inquiries (10%)',
}

const EXPENSE_FIELDS: (keyof CreditBudgetProfile)[] = [
  'rent', 'groceries', 'transport', 'utilities', 'phone', 'insurance', 'entertainment', 'diningOut', 'subscriptions', 'repaymentPlan', 'cardPayment',
]

// ─── Computation ─────────────────────────────────────────────────────────────

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v
}

function computeUtilizationFactor(p: CreditBudgetProfile): number {
  return clamp01(1 - Math.min(p.cardBalance / Math.max(p.cardLimit, 1), 1))
}

function applyCreditDelta(
  current: CreditFactors,
  delta: Partial<CreditFactors>,
  profile: CreditBudgetProfile,
): CreditFactors {
  return {
    // Default +0.01 each round = "you made your regular payment on time"
    paymentHistory: clamp01(current.paymentHistory + (delta.paymentHistory ?? 0.01)),
    // ALWAYS auto-computed from card balance/limit — never from delta
    utilization: computeUtilizationFactor(profile),
    // Slowly improves each round
    ageOfCredit: clamp01(current.ageOfCredit + (delta.ageOfCredit ?? 0.01)),
    // Only changes when opening new credit types
    creditMix: clamp01(current.creditMix + (delta.creditMix ?? 0)),
    // Slowly recovers each round (inquiries age off)
    newInquiries: clamp01(current.newInquiries + (delta.newInquiries ?? 0.005)),
  }
}

function applyBudgetDelta(
  current: CreditBudgetProfile,
  delta: Partial<CreditBudgetProfile>,
): CreditBudgetProfile {
  let emergencyFundAfter = current.emergencyFund + (delta.emergencyFund ?? 0)
  let goalSavingsAfter = current.goalSavings + (delta.goalSavings ?? 0)

  // Allow transfer between savings pots before charging any remainder to card.
  if (emergencyFundAfter < 0 && goalSavingsAfter > 0) {
    const transfer = Math.min(goalSavingsAfter, Math.abs(emergencyFundAfter))
    goalSavingsAfter -= transfer
    emergencyFundAfter += transfer
  }
  if (goalSavingsAfter < 0 && emergencyFundAfter > 0) {
    const transfer = Math.min(emergencyFundAfter, Math.abs(goalSavingsAfter))
    emergencyFundAfter -= transfer
    goalSavingsAfter += transfer
  }

  const savingsShortfall = Math.max(0, -emergencyFundAfter) + Math.max(0, -goalSavingsAfter)
  emergencyFundAfter = Math.max(0, emergencyFundAfter)
  goalSavingsAfter = Math.max(0, goalSavingsAfter)

  const newCardBalance = Math.max(0, current.cardBalance + (delta.cardBalance ?? 0) + savingsShortfall)

  return {
    monthlyPay: Math.max(0, current.monthlyPay + (delta.monthlyPay ?? 0)),
    rent: Math.max(0, current.rent + (delta.rent ?? 0)),
    groceries: Math.max(0, current.groceries + (delta.groceries ?? 0)),
    transport: Math.max(0, current.transport + (delta.transport ?? 0)),
    utilities: Math.max(0, current.utilities + (delta.utilities ?? 0)),
    phone: Math.max(0, current.phone + (delta.phone ?? 0)),
    insurance: Math.max(0, current.insurance + (delta.insurance ?? 0)),
    entertainment: Math.max(0, current.entertainment + (delta.entertainment ?? 0)),
    diningOut: Math.max(0, current.diningOut + (delta.diningOut ?? 0)),
    subscriptions: Math.max(0, current.subscriptions + (delta.subscriptions ?? 0)),
    repaymentPlan: Math.max(0, current.repaymentPlan + (delta.repaymentPlan ?? 0)),
    cardPayment: calculateCardPayment(newCardBalance), // Recalculate based on new balance
    emergencyFund: emergencyFundAfter,
    goalSavings: goalSavingsAfter,
    emergencySplitPercent: Math.min(90, Math.max(10, delta.emergencySplitPercent ?? current.emergencySplitPercent)),
    savingsSplitConfigured: delta.savingsSplitConfigured ?? current.savingsSplitConfigured,
    // Add shortfall to card balance automatically
    cardBalance: newCardBalance,
    cardLimit: Math.max(1, current.cardLimit + (delta.cardLimit ?? 0)),
  }
}

// ─── Cascade Types ──────────────────────────────────────────────────────────

interface RoundCascade {
  monthlyNet: number
  savingsFlow: number
  forcedCardDebt: number
  interestCharged: number
  missedPayment: boolean
  events: string[]
}

/**
 * Round-end processing: auto-accumulate savings, cascade deficit to card,
 * charge credit card interest, and detect auto-missed payments.
 * Mutates profile in-place for simplicity, returns cascade info.
 */
function processRoundEnd(profile: CreditBudgetProfile): RoundCascade {
  const events: string[] = []
  let forcedCardDebt = 0
  let missedPayment = false

  // 1. Apply credit card payment (reduce balance)
  const paymentAmount = profile.cardPayment
  if (paymentAmount > 0 && profile.cardBalance > 0) {
    const actualPayment = Math.min(paymentAmount, profile.cardBalance)
    profile.cardBalance -= actualPayment
    if (actualPayment > 0) {
      events.push(`Credit card payment: -$${actualPayment} paid toward balance`)
    }
  }

  // 2. Credit card interest (18% APR converted to monthly rate)
  const monthlyInterestRate = 0.18 / 12
  const interestCharged = Math.round(profile.cardBalance * monthlyInterestRate)
  if (interestCharged > 0) {
    profile.cardBalance += interestCharged
    events.push(`Credit card interest: +$${interestCharged} added to balance`)
  }

  // 3. Recalculate card payment for next round based on new balance
  profile.cardPayment = calculateCardPayment(profile.cardBalance)

  // 4. Monthly cash flow
  const net = monthlyNet(profile)
  const savingsFlow = net

  if (net >= 0) {
    if (profile.savingsSplitConfigured) {
      const emergencyShare = Math.round(net * (profile.emergencySplitPercent / 100))
      const goalShare = net - emergencyShare
      profile.emergencyFund += emergencyShare
      profile.goalSavings += goalShare
      events.push(`Monthly surplus of $${net} split: +$${emergencyShare} emergency, +$${goalShare} goal savings`)
    } else {
      profile.goalSavings += net
      events.push(`Monthly surplus of $${net} added to savings`)
    }
  } else {
    // Deficit — draw emergency first, then goal savings, then card
    const deficit = Math.abs(net)
    if (profile.emergencyFund >= deficit) {
      profile.emergencyFund -= deficit
      events.push(`Monthly deficit of $${deficit} covered from emergency fund`)
    } else {
      const fromEmergency = profile.emergencyFund
      profile.emergencyFund = 0
      let remainder = deficit - fromEmergency
      let fromGoal = 0
      if (profile.goalSavings > 0 && remainder > 0) {
        fromGoal = Math.min(profile.goalSavings, remainder)
        profile.goalSavings -= fromGoal
        remainder -= fromGoal
      }

      if (remainder > 0) {
        profile.cardBalance += remainder
        forcedCardDebt = remainder
      }

      if (remainder > 0) {
        events.push(`Emergency ($${fromEmergency}) and goal savings ($${fromGoal}) used. Remaining $${remainder} charged to credit card`)
      } else {
        events.push(`Deficit covered from savings split: emergency $${fromEmergency}, goal savings $${fromGoal}`)
      }
      if (forcedCardDebt > 0) profile.cardPayment = calculateCardPayment(profile.cardBalance)
    }
  }

  // 5. Check if card exceeds limit → auto-missed payment
  if (profile.cardBalance > profile.cardLimit) {
    missedPayment = true
    events.push(`Credit card MAXED OUT ($${profile.cardBalance} / $${profile.cardLimit})! Missed minimum payment — credit score penalty!`)
  }

  return { monthlyNet: net, savingsFlow, forcedCardDebt, interestCharged, missedPayment, events }
}

function computeCreditScore(factors: CreditFactors): number {
  const idx =
    factors.paymentHistory * SCORE_WEIGHTS.paymentHistory +
    factors.utilization * SCORE_WEIGHTS.utilization +
    factors.ageOfCredit * SCORE_WEIGHTS.ageOfCredit +
    factors.creditMix * SCORE_WEIGHTS.creditMix +
    factors.newInquiries * SCORE_WEIGHTS.newInquiries
  return Math.round(300 + 550 * idx)
}

function factorLabel(v: number): string {
  if (v >= 0.8) return 'Strong'
  if (v >= 0.55) return 'Fair'
  return 'Weak'
}

function factorClass(v: number): string {
  if (v >= 0.8) return 'credit-mvp__factor--strong'
  if (v >= 0.55) return 'credit-mvp__factor--fair'
  return 'credit-mvp__factor--weak'
}

function scoreRating(score: number): { label: string; cls: string } {
  if (score >= 800) return { label: 'Excellent', cls: 'credit-mvp__rating--excellent' }
  if (score >= 740) return { label: 'Very Good', cls: 'credit-mvp__rating--very-good' }
  if (score >= 670) return { label: 'Good', cls: 'credit-mvp__rating--good' }
  if (score >= 580) return { label: 'Fair', cls: 'credit-mvp__rating--fair' }
  return { label: 'Poor', cls: 'credit-mvp__rating--poor' }
}

function fmtDelta(v: number, prefix = '$'): string {
  if (v > 0) return `+${prefix}${v}`
  if (v < 0) return `-${prefix}${Math.abs(v)}`
  return `${prefix}0`
}

function rebalanceSavingsForSplit(profile: CreditBudgetProfile): CreditBudgetProfile {
  if (!profile.savingsSplitConfigured) return profile
  const total = totalSavings(profile)
  const emergencyTarget = Math.round(total * (profile.emergencySplitPercent / 100))
  const goalTarget = Math.max(0, total - emergencyTarget)
  return {
    ...profile,
    emergencyFund: emergencyTarget,
    goalSavings: goalTarget,
  }
}

function insuranceTreatmentCost(plan: InsurancePlan): number {
  if (plan === 'comprehensive') return 80
  if (plan === 'basic') return 180
  return 420
}

function computeInvestmentReturnRate(type: InvestmentType, round: number): number {
  if (type === 'shares') {
    const cycle = [-0.12, 0.08, 0.14, -0.06, 0.1]
    return cycle[(round - 1) % cycle.length]
  }
  if (type === 'kiwisaver') {
    const cycle = [0.02, 0.015, 0.025, 0.01]
    return cycle[(round - 1) % cycle.length]
  }
  if (type === 'term-pie') {
    const cycle = [0.008, 0.01, 0.009]
    return cycle[(round - 1) % cycle.length]
  }
  return 0
}

// ─── Page Component ──────────────────────────────────────────────────────────

type GamePhase = 'setup' | 'playing' | 'feedback' | 'summary'

interface CreditDefaultEntry {
  round: number
  accountType: string
  creditProvider: string
  reference: string
  originalAmount: number
  currentBalance: number
  status: 'outstanding' | 'paid-default' | 'debt-management'
  statusDate: string
}
type DifficultyLevel = 'easy' | 'hard'
const STUDENT_PROFILE_PRESET = PROFILE_PRESETS.find((p) => p.key === 'student') || PROFILE_PRESETS[0]

export default function CreditScoreMvpPage() {
  const { theme, toggleTheme } = useTheme()
  const query = useMemo(() => new URLSearchParams(window.location.search), [])
  const inviteToken = (query.get('invite') || '').trim()
  const roomCodeFromUrl = (query.get('room') || '').trim().toUpperCase()
  const [publicRoomCode, setPublicRoomCode] = useState(roomCodeFromUrl)
  const nameFromUrl = (query.get('name') || '').trim()
  const [phase, setPhase] = useState<GamePhase>('setup')
  const [showLibrary, setShowLibrary] = useState(false)
  const [showAssumptions, setShowAssumptions] = useState(false)
  const [inviteLabel, setInviteLabel] = useState<string | null>(null)
  const hasPublicJoinContext = Boolean(inviteToken || publicRoomCode)
  const [authChecked, setAuthChecked] = useState(() => hasPublicJoinContext || getEducatorSessionSync() !== null)
  const [canAccessSetup, setCanAccessSetup] = useState(() => roomCodeFromUrl ? false : (getEducatorSessionSync()?.ok ?? false))
  const [sessionDifficulty, setSessionDifficulty] = useState<DifficultyLevel>('easy')
  const [loadingPublicConfig, setLoadingPublicConfig] = useState(false)
  const [creatingSession, setCreatingSession] = useState(false)
  const [createSessionError, setCreateSessionError] = useState('')
  const [createdSessionInfo, setCreatedSessionInfo] = useState<{ roomCode: string; joinLink: string } | null>(null)
  const [publicConfigError, setPublicConfigError] = useState('')
  const [sessionsRefreshKey, setSessionsRefreshKey] = useState(0)
  const [startingSolo, setStartingSolo] = useState(false)
  const [autoStartedPublic, setAutoStartedPublic] = useState(false)

  // Setup
  const selectedPreset: ProfilePreset = STUDENT_PROFILE_PRESET
  const [playerName, setPlayerName] = useState(nameFromUrl)
  const [difficulty, setDifficulty] = useState<DifficultyLevel>('easy')

  // Game
  const [profile, setProfile] = useState<CreditBudgetProfile>(PROFILE_PRESETS[0].profile)
  const [factors, setFactors] = useState<CreditFactors>(STARTING_FACTORS)
  const [scenarios, setScenarios] = useState<CreditScenario[]>([])
  const [roundIndex, setRoundIndex] = useState(0)
  const [history, setHistory] = useState<CreditHistoryEntry[]>([])
  const [lastCascade, setLastCascade] = useState<RoundCascade | null>(null)
  const [insurancePlan, setInsurancePlan] = useState<InsurancePlan>('none')
  const [healthPremiumPerRound, setHealthPremiumPerRound] = useState(0)
  const [sideBusinessPayoutPending, setSideBusinessPayoutPending] = useState(0)
  const [missedUtilityCount, setMissedUtilityCount] = useState(0)
  const [creditDefaults, setCreditDefaults] = useState<CreditDefaultEntry[]>([])
  const [investment, setInvestment] = useState<InvestmentState>({
    type: 'none',
    principalInvested: 0,
    currentValue: 0,
    totalReturn: 0,
  })

  // Track selected choice for preview in impact panel
  const [selectedChoice, setSelectedChoice] = useState<CreditScenarioChoice | null>(null)

  const score = useMemo(() => computeCreditScore(factors), [factors])
  const currentScenario = scenarios[roundIndex]

  useEffect(() => {
    if (!inviteToken) return
    let cancelled = false
    const resolveInvite = async () => {
      try {
        const res = await fetch(`/api/minigames/invite/${encodeURIComponent(inviteToken)}`, {
          headers: { 'Content-Type': 'application/json' },
        })
        if (!res.ok) return
        const data = await res.json() as { success?: boolean; invite?: { teamLabel?: string; roomCode?: string | null } }
        if (cancelled || !data?.success || !data.invite?.teamLabel) return
        setInviteLabel(data.invite.teamLabel)
        setPlayerName((prev) => prev || data.invite?.teamLabel || '')
        if (data.invite.roomCode) {
          setPublicRoomCode(String(data.invite.roomCode).toUpperCase())
        }
      } catch {
        // no-op
      }
    }
    void resolveInvite()
    return () => {
      cancelled = true
    }
  }, [inviteToken])

  useEffect(() => {
    if (!hasPublicJoinContext || !publicRoomCode) return
    let cancelled = false
    const loadSessionConfig = async () => {
      setLoadingPublicConfig(true)
      setPublicConfigError('')
      try {
        const resolved = await fetch(`/api/minigames/join/${encodeURIComponent(publicRoomCode)}`, {
          headers: { 'Content-Type': 'application/json' },
        })
        if (!resolved.ok) {
          throw new Error('Unable to load classroom config')
        }
        const data = await resolved.json() as {
          success?: boolean
          room?: { config?: { creditScore?: { difficulty?: DifficultyLevel } | null } | null }
        }
        if (!data?.success) {
          throw new Error('Invalid classroom config')
        }
        const difficultyFromConfig = data.room?.config?.creditScore?.difficulty
        if (!cancelled && (difficultyFromConfig === 'easy' || difficultyFromConfig === 'hard')) {
          setDifficulty(difficultyFromConfig)
        }
      } catch (err) {
        if (!cancelled) {
          setPublicConfigError(err instanceof Error ? err.message : 'Unable to load classroom config')
        }
      } finally {
        if (!cancelled) {
          setLoadingPublicConfig(false)
        }
      }
    }
    void loadSessionConfig()
    return () => {
      cancelled = true
    }
  }, [hasPublicJoinContext, publicRoomCode])

  useEffect(() => {
    if (hasPublicJoinContext) return
    let cancelled = false
    const ensureEducator = async () => {
      const sessionInfo = await getEducatorSessionCached(true)
      if (!cancelled) {
        setCanAccessSetup(sessionInfo.ok)
        setAuthChecked(true)
      }
    }
    void ensureEducator()
    return () => {
      cancelled = true
    }
  }, [hasPublicJoinContext])

  useEffect(() => {
    if (hasPublicJoinContext) return
    if (!authChecked) return
    if (!canAccessSetup && !getEducatorSessionSync()) {
      window.location.href = '/educator-login'
    }
  }, [hasPublicJoinContext, authChecked, canAccessSetup])

  useEffect(() => {
    if (!hasPublicJoinContext) return
    if (phase !== 'setup') return
    if (autoStartedPublic) return
    if (loadingPublicConfig) return
    if (publicConfigError) return
    setAutoStartedPublic(true)
    handleStart()
  }, [hasPublicJoinContext, phase, autoStartedPublic, loadingPublicConfig, publicConfigError])

  useEffect(() => {
    if (!hasPublicJoinContext) return
    if (loadingPublicConfig) return
    if (!publicConfigError) return
    window.location.href = '/educator-login'
  }, [hasPublicJoinContext, loadingPublicConfig, publicConfigError])

  /** Apply difficulty adjustments to profile - Hard mode makes budget much tighter */
  const applyDifficulty = (profile: CreditBudgetProfile, diff: DifficultyLevel): CreditBudgetProfile => {
    if (diff === 'easy') return profile

    // Hard mode: Reduce income by 8% and increase key expenses
    const adjusted = { ...profile }
    adjusted.monthlyPay = Math.round(profile.monthlyPay * 0.92) // -8% income
    adjusted.rent = Math.round(profile.rent * 1.12) // +12% rent (harder to cut)
    adjusted.groceries = Math.round(profile.groceries * 1.08) // +8% groceries
    adjusted.utilities = Math.round(profile.utilities * 1.15) // +15% utilities (bills spike)
    adjusted.transport = Math.round(profile.transport * 1.1) // +10% transport
    adjusted.emergencyFund = Math.round(profile.emergencyFund * 0.5) // 50% less savings buffer
    adjusted.goalSavings = Math.round(profile.goalSavings * 0.7)
    adjusted.cardBalance = Math.round(profile.cardBalance * 1.15) // +15% more debt
    adjusted.cardPayment = calculateCardPayment(adjusted.cardBalance)

    // Keep hard mode challenging but still solvable.
    let guard = 0
    while (monthlyNet(adjusted) < MIN_STARTING_MONTHLY_NET && guard < 120) {
      adjusted.monthlyPay += 5
      guard += 1
    }

    return adjusted
  }

  const enforceMinimumStartingNet = (profile: CreditBudgetProfile, minWeeklyNet: number): CreditBudgetProfile => {
    const adjusted = { ...profile }
    let guard = 0
    while (monthlyNet(adjusted) < minWeeklyNet && guard < 180) {
      adjusted.monthlyPay += 5
      guard += 1
    }
    return adjusted
  }

  const handleStart = () => {
    let p: CreditBudgetProfile = { ...selectedPreset.profile }
    p = applyDifficulty(p, difficulty)
    p = enforceMinimumStartingNet(p, MIN_STARTING_MONTHLY_NET)
    const f: CreditFactors = { ...STARTING_FACTORS, utilization: computeUtilizationFactor(p) }
    setProfile(p)
    setFactors(f)
    setScenarios(drawCreditScenarios(ROUNDS_PER_GAME, difficulty))
    setRoundIndex(0)
    setHistory([])
    setLastCascade(null)
    setInsurancePlan('none')
    setHealthPremiumPerRound(0)
    setSideBusinessPayoutPending(0)
    setInvestment({
      type: 'none',
      principalInvested: 0,
      currentValue: 0,
      totalReturn: 0,
    })
    setPhase('playing')
  }

  const handleStartSoloTest = () => {
    setStartingSolo(true)
    setPlayerName('Teacher')
    setDifficulty(sessionDifficulty)
    setTimeout(() => {
      handleStart()
      setStartingSolo(false)
    }, 0)
  }

  const handleChoice = (choice: CreditScenarioChoice) => {
    const prevScore = computeCreditScore(factors)

    // Dynamic scenario adjustments.
    let adjustedBudgetDelta = { ...choice.impact.budgetDelta }
    if (currentScenario.id === 'bonus-windfall') {
      const bonusAmount = Math.round(profile.cardBalance * 0.9) // 90% of current balance
      adjustedBudgetDelta = {}

      if (choice.id === 'pay-debt') {
        adjustedBudgetDelta.cardBalance = -bonusAmount
      } else if (choice.id === 'split-bonus') {
        const debtPayment = Math.round(bonusAmount * 0.5)
        const savingsAmount = Math.round(bonusAmount * 0.25)
        adjustedBudgetDelta.cardBalance = -debtPayment
        adjustedBudgetDelta.goalSavings = savingsAmount
      } else {
        adjustedBudgetDelta = { ...choice.impact.budgetDelta }
      }
    } else if (currentScenario.id === 'gp-treatment-visit') {
      const treatmentCost = insuranceTreatmentCost(insurancePlan)
      if (choice.id === 'treatment-pay-savings') {
        adjustedBudgetDelta = { emergencyFund: -treatmentCost }
      } else if (choice.id === 'treatment-split') {
        const savingsPart = Math.round(treatmentCost * 0.45)
        adjustedBudgetDelta = { emergencyFund: -savingsPart, cardBalance: treatmentCost - savingsPart }
      } else if (choice.id === 'treatment-card') {
        adjustedBudgetDelta = { cardBalance: treatmentCost }
      }
    }

    // Track insurance decisions for later risk scenarios.
    if (currentScenario.id === 'health-insurance-decision') {
      if (choice.id === 'health-insurance-basic') {
        setInsurancePlan('basic')
        setHealthPremiumPerRound(Math.max(0, adjustedBudgetDelta.insurance ?? 0))
      } else if (choice.id === 'health-insurance-comprehensive') {
        setInsurancePlan('comprehensive')
        setHealthPremiumPerRound(Math.max(0, adjustedBudgetDelta.insurance ?? 0))
      } else {
        setInsurancePlan('none')
        setHealthPremiumPerRound(0)
      }
    }

    // Track compulsory investment choice.
    if (currentScenario.id === 'investment-pathways') {
      if (choice.id === 'invest-shares') {
        setInvestment({ type: 'shares', principalInvested: 300, currentValue: 300, totalReturn: 0 })
      } else if (choice.id === 'invest-kiwisaver') {
        setInvestment({ type: 'kiwisaver', principalInvested: 300, currentValue: 300, totalReturn: 0 })
      } else if (choice.id === 'invest-term-pie') {
        setInvestment({ type: 'term-pie', principalInvested: 300, currentValue: 300, totalReturn: 0 })
      }
    }

    // Track utility missed payments and inject collections scenario when triggered.
    if (currentScenario.id === 'utility-cant-pay' && choice.id === 'skip-utility-payment') {
      const newCount = missedUtilityCount + 1
      setMissedUtilityCount(newCount)
      // Insert the collections scenario 2 rounds later (represents ~60 days overdue)
      setScenarios(prev => {
        if (prev.some(s => s.id === 'utility-collections')) return prev // already injected
        const insertAt = Math.min(roundIndex + 2, prev.length)
        const updated = [...prev]
        updated.splice(insertAt, 0, UTILITY_COLLECTIONS_SCENARIO)
        return updated
      })
    }

    // Record a credit default when the collections scenario is resolved.
    if (currentScenario.id === 'utility-collections') {
      const ref = `PWR-${String(1000 + roundIndex).substring(1)}`
      const isPaid = choice.id === 'utility-pay-collections'
      const isDmp = choice.id === 'utility-debt-management'
      setCreditDefaults(prev => [
        ...prev,
        {
          round: roundIndex + 1,
          accountType: 'Utility Account (Open)',
          creditProvider: 'Power & Internet Provider',
          reference: ref,
          originalAmount: 200,
          currentBalance: isPaid ? 0 : 220,
          status: isPaid ? 'paid-default' : isDmp ? 'debt-management' : 'outstanding',
          statusDate: `Round ${roundIndex + 1}`,
        },
      ])
    }

    // 1. Check emergency-fund shortfall before applying delta.
    let nextPendingSideBusinessPayout = sideBusinessPayoutPending
    if (currentScenario.id === 'side-business') {
      if (choice.id === 'bootstrap' || choice.id === 'credit-funded') {
        nextPendingSideBusinessPayout += 50
      }
    }

    const savingsDelta = (adjustedBudgetDelta.emergencyFund ?? 0) + (adjustedBudgetDelta.goalSavings ?? 0)
    const hasShortfall = totalSavings(profile) + savingsDelta < 0
    const shortfallAmount = hasShortfall ? Math.abs(totalSavings(profile) + savingsDelta) : 0

    // 2. Apply direct budget impact.
    let budgetAfterChoice = applyBudgetDelta(profile, adjustedBudgetDelta)
    if (currentScenario.id === 'banker-savings-split') {
      budgetAfterChoice = rebalanceSavingsForSplit(budgetAfterChoice)
    }

    // 3. Run round-end cascade.
    const cascade = processRoundEnd(budgetAfterChoice)
    if (currentScenario.id === 'side-business' && (choice.id === 'bootstrap' || choice.id === 'credit-funded')) {
      cascade.events.unshift('Side business started: potential +$50 payout will be added in the final round.')
    }

    if (currentScenario.id === 'gp-treatment-visit') {
      const uninsuredCost = insuranceTreatmentCost('none')
      const actualCost = insuranceTreatmentCost(insurancePlan)
      const immediateSavings = Math.max(0, uninsuredCost - actualCost)
      const premiumPaidToDate = healthPremiumPerRound * roundIndex
      const netInsuranceValue = immediateSavings - premiumPaidToDate
      cascade.events.unshift(
        `Health insurance check: uninsured treatment would be $${uninsuredCost}, your treatment cost was $${actualCost}.`,
      )
      cascade.events.unshift(
        `Premiums paid so far: $${premiumPaidToDate}. Event saving: $${immediateSavings}. Net value so far: ${netInsuranceValue >= 0 ? '+' : '-'}$${Math.abs(netInsuranceValue)}.`,
      )
    }

    // 4. Apply portfolio growth/decline each round after investing.
    setInvestment((currentInvestment) => {
      if (currentInvestment.type === 'none' || currentInvestment.currentValue <= 0) {
        return currentInvestment
      }
      const rate = computeInvestmentReturnRate(currentInvestment.type, roundIndex + 1)
      const gainLoss = Math.round(currentInvestment.currentValue * rate)
      const nextValue = Math.max(0, currentInvestment.currentValue + gainLoss)
      if (gainLoss !== 0) {
        cascade.events.unshift(
          `Investment update (${currentInvestment.type}): ${gainLoss >= 0 ? '+' : '-'}$${Math.abs(gainLoss)} this round. Portfolio now $${nextValue}.`,
        )
      }
      return {
        ...currentInvestment,
        currentValue: nextValue,
        totalReturn: nextValue - currentInvestment.principalInvested,
      }
    })

    // 5. If there was an emergency fund shortfall, prepend it to cascade events.
    if (hasShortfall) {
      cascade.events.unshift(
        `Savings insufficient! $${totalSavings(profile)} available, $${Math.abs(savingsDelta)} needed. Remaining $${shortfallAmount} charged to credit card.`
      )
      cascade.forcedCardDebt += shortfallAmount
    }

    const next = roundIndex + 1
    if (next >= scenarios.length && nextPendingSideBusinessPayout > 0) {
      budgetAfterChoice = applyBudgetDelta(budgetAfterChoice, { goalSavings: nextPendingSideBusinessPayout })
      cascade.events.unshift(`Final round side business payout: +$${nextPendingSideBusinessPayout} added to savings.`)
      nextPendingSideBusinessPayout = 0
    }
    setSideBusinessPayoutPending(nextPendingSideBusinessPayout)

    // 6. Apply credit delta.
    const creditDelta = { ...choice.impact.creditDelta }
    if (cascade.missedPayment) {
      // Card exceeded limit — hard missed-payment penalty
      creditDelta.paymentHistory = (creditDelta.paymentHistory ?? 0) + -0.15
    } else if (cascade.forcedCardDebt > 0 && creditDelta.paymentHistory === undefined) {
      // Player is in real cashflow deficit (savings exhausted, charging to card) but hasn't
      // technically missed a payment yet — suppress the auto +0.01 improvement. Being in the
      // red doesn't earn "on-time payment" credit.
      creditDelta.paymentHistory = 0
    }
    const factorsNext = applyCreditDelta(factors, creditDelta, budgetAfterChoice)
    const nextScore = computeCreditScore(factorsNext)

    setHistory(prev => [
      ...prev,
      {
        round: roundIndex + 1,
        scenarioId: currentScenario.id,
        scenarioTitle: currentScenario.title,
        category: currentScenario.category,
        choiceId: choice.id,
        choiceLabel: choice.label,
        choiceQuality: choice.quality,
        consequence: choice.consequence,
        creditNote: choice.creditNote,
        scoreBefore: prevScore,
        scoreAfter: nextScore,
        scoreDelta: nextScore - prevScore,
        budgetBefore: profile,
        budgetAfter: budgetAfterChoice,
      },
    ])
    setProfile(budgetAfterChoice)
    setFactors(factorsNext)
    setLastCascade(cascade)

    if (next >= scenarios.length) {
      setPhase('summary')
    } else {
      setRoundIndex(next)
      setPhase('playing')
    }
  }

  const handleRestart = () => {
    setPhase('setup')
    setRoundIndex(0)
    setHistory([])
    setLastCascade(null)
    setInsurancePlan('none')
    setHealthPremiumPerRound(0)
    setSideBusinessPayoutPending(0)
    setMissedUtilityCount(0)
    setCreditDefaults([])
    setInvestment({
      type: 'none',
      principalInvested: 0,
      currentValue: 0,
      totalReturn: 0,
    })
  }

  const handleCreatePlayLink = async () => {
    setCreatingSession(true)
    setCreateSessionError('')
    try {
      const created = await educatorMiniGamesApi.createSession({
        gameType: 'credit-score',
        // Credit Score is a solo assignment; keep teamCount fixed at 1 for session creation.
        teamCount: 1,
        configJson: {
          creditScoreConfig: {
            difficulty: sessionDifficulty,
            preset: 'student',
          },
        },
      })
      setCreatedSessionInfo({
        roomCode: created.session.roomCode || '',
        joinLink: created.session.roomCode
          ? `${window.location.origin}/mini-games/credit-score?room=${encodeURIComponent(created.session.roomCode)}`
          : (created.session.joinByCodeLink || `${window.location.origin}/mini-games/join`),
      })
      setSessionsRefreshKey((v) => v + 1)
    } catch (err) {
      if (err instanceof Error && /unauthorized/i.test(err.message)) {
        window.location.href = '/educator-login'
        return
      }
      setCreateSessionError(err instanceof Error ? err.message : 'Failed to create play link')
    } finally {
      setCreatingSession(false)
    }
  }

  // For setup and summary, use simple layout
  if (phase === 'setup' || phase === 'summary') {
    return (
      <MiniGameShell
        title="Credit Score"
        subtitle="Personal Finance Decision Simulator"
        sessionsGameType="credit-score"
        showSessionsTable={phase === 'setup' && !hasPublicJoinContext && authChecked && canAccessSetup}
        sessionsRefreshKey={sessionsRefreshKey}
        publicMode={hasPublicJoinContext}
      >
        <main className="credit-mvp">
          {showLibrary && <LibraryPanel onClose={() => setShowLibrary(false)} />}
          <header className="mg-page-hero" style={{ position: 'relative', marginBottom: '1.5rem' }}>
            <h1>💳 CREDIT SCORE SIMULATOR</h1>
            <p className="credit-mvp__muted">Personal Finance Decision Simulator</p>
            {phase === 'setup' && (
              <button type="button" className="credit-mvp__lib-btn" onClick={() => setShowLibrary(true)} style={{ position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)' }}>
                Scenario Library
              </button>
            )}
          </header>

          {phase === 'setup' && (
            !authChecked ? (
              <section className="credit-mvp__panel">
                <p>Checking educator access...</p>
              </section>
            ) : !canAccessSetup && !hasPublicJoinContext ? (
              <section className="credit-mvp__panel">
                <h2>Educator Login Required</h2>
                <p style={{ color: 'var(--text-secondary)' }}>This setup page is restricted to educator accounts.</p>
                <button type="button" className="credit-mvp__lib-btn" onClick={() => { window.location.href = '/educator-login' }}>
                  Go to Educator Login
                </button>
              </section>
            ) : (
              <>
                {hasPublicJoinContext ? (
                  <StudentJoinSetupPhase
                    difficulty={difficulty}
                    inviteLabel={inviteLabel}
                    loadingConfig={loadingPublicConfig}
                    configError={publicConfigError}
                    onStart={handleStart}
                  />
                ) : (
                  <EducatorSetupPhase
                    difficulty={sessionDifficulty}
                    isCreating={creatingSession}
                    isStartingSolo={startingSolo}
                    createdSession={createdSessionInfo}
                    error={createSessionError}
                    onDifficulty={setSessionDifficulty}
                    onCreatePlayLink={() => void handleCreatePlayLink()}
                    onSoloTest={handleStartSoloTest}
                  />
                )}
              </>
            )
          )}
          {phase === 'summary' && (
            <SummaryPhase
              history={history}
              finalScore={score}
              factors={factors}
              profile={profile}
              investment={investment}
              playerName={playerName || 'Player'}
              creditDefaults={creditDefaults}
              onRestart={handleRestart}
            />
          )}
        </main>
      </MiniGameShell>
    )
  }

  // For playing and feedback, use the new Board Layout (Game of Life style)
  return (
    <div className="credit-mvp credit-board-layout animate-fade-in">
      {showLibrary && <LibraryPanel onClose={() => setShowLibrary(false)} />}
      {showAssumptions && <AssumptionsPanel preset={selectedPreset} profile={profile} onClose={() => setShowAssumptions(false)} />}

      <header className="credit-board-header">
        <div className="credit-board-title">
          <h1>CREDIT SCORE SIMULATOR</h1>
          <p>Financial Journey</p>
        </div>
        <div className="dm-header-controls" style={{ background: 'white', padding: '0.5rem 1rem', borderRadius: '100px', border: '1px solid var(--border-color)' }}>
          <button
            type="button"
            className="dm-theme-toggle"
            onClick={toggleTheme}
            style={{ fontSize: '1.2rem' }}
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          <button
            type="button"
            className="credit-mvp__lib-btn"
            onClick={() => setShowAssumptions(true)}
            style={{ border: 'none', fontWeight: 600 }}
          >
            📋 Assumptions
          </button>
        </div>
      </header>

      <RoundSelectorDots currentRound={roundIndex + 1} totalRounds={scenarios.length} />

      <main className="credit-board-main">
        <section className="credit-board-game">
          {phase === 'playing' && currentScenario && (
            <PlayingPhase
              scenario={currentScenario}
              round={roundIndex + 1}
              totalRounds={scenarios.length}
              insurancePlan={insurancePlan}
              onChoice={handleChoice}
              selectedChoice={selectedChoice}
              onSelectChoice={setSelectedChoice}
              lastCascade={roundIndex > 0 ? lastCascade : null}
            />
          )}
        </section>

        <aside className="credit-board-stats" onClick={() => { if (phase === 'playing') setSelectedChoice(null) }}>
          <BudgetImpactPanel
            profile={profile}
            history={history}
            phase={phase}
            previewChoice={phase === 'playing' ? selectedChoice : null}
            currentScenario={phase === 'playing' ? currentScenario : null}
            insurancePlan={insurancePlan}
            investment={investment}
            savingsGoalTarget={SAVINGS_GOAL_TARGET}
          />
        </aside>
      </main>

      <footer style={{ marginTop: 'auto', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
        <SidebarFooter />
      </footer>
    </div>
  )
}

function RoundSelectorDots({ currentRound, totalRounds }: { currentRound: number; totalRounds: number }) {
  return (
    <div className="round-dots-container">
      {Array.from({ length: totalRounds }).map((_, i) => {
        const isCompleted = i < currentRound - 1
        const isCurrent = i === currentRound - 1
        return (
          <div
            key={i}
            className={`round-dot ${isCompleted ? 'completed' : ''} ${isCurrent ? 'current' : ''}`}
            data-round={i + 1}
          />
        )
      })}
    </div>
  )
}

// ─── Budget Display (reused in playing sidebar and feedback) ─────────────────

function BudgetTable({ profile, compact }: { profile: CreditBudgetProfile; compact?: boolean }) {
  const exp = totalExpenses(profile)
  const net = monthlyNet(profile)
  const deductions = monthlyDeductionBreakdown(profile.monthlyPay)
  return (
    <div className={`credit-mvp__budget ${compact ? 'credit-mvp__budget--compact' : ''}`}>
      <div className="credit-mvp__budget-cols">
        <div className="credit-mvp__budget-col">
          <h4 className="credit-mvp__budget-col-title credit-mvp__positive">Income</h4>
          <div className="credit-mvp__budget-row">
            <span>Gross Income</span>
            <strong>${profile.monthlyPay}</strong>
          </div>
          <div className="credit-mvp__budget-row">
            <span>PAYE Tax</span>
            <span>(${deductions.payeMonthly})</span>
          </div>
          <div className="credit-mvp__budget-row">
            <span>ACC Levy</span>
            <span>(${deductions.accMonthly})</span>
          </div>
          <div className="credit-mvp__budget-row credit-mvp__budget-row--total">
            <span>Take-Home Pay</span>
            <strong>${deductions.netMonthly}</strong>
          </div>
        </div>
        <div className="credit-mvp__budget-col">
          <h4 className="credit-mvp__budget-col-title credit-mvp__negative">Expenses</h4>
          {EXPENSE_FIELDS.map(k => (
            <div key={k} className="credit-mvp__budget-row">
              <span>{EXPENSE_LABELS[k]}</span>
              <span>${profile[k]}</span>
            </div>
          ))}
          <div className="credit-mvp__budget-row credit-mvp__budget-row--total">
            <span>Total Expenses</span>
            <strong>${exp}</strong>
          </div>
        </div>
      </div>
      <div className={`credit-mvp__budget-net ${net >= 0 ? 'credit-mvp__positive' : 'credit-mvp__danger'}`}>
        Net: {net >= 0 ? '+' : ''}${net}/mo
      </div>
    </div>
  )
}

// ─── Setup Phase ─────────────────────────────────────────────────────────────

function EducatorSetupPhase({
  difficulty,
  isCreating,
  isStartingSolo,
  createdSession,
  error,
  onDifficulty,
  onCreatePlayLink,
  onSoloTest,
}: {
  difficulty: DifficultyLevel
  isCreating: boolean
  isStartingSolo: boolean
  createdSession: { roomCode: string; joinLink: string } | null
  error: string
  onDifficulty: (value: DifficultyLevel) => void
  onCreatePlayLink: () => void
  onSoloTest: () => void
}) {
  return (
    <section className="credit-mvp__setup">
      <div className="credit-mvp__setup-grid">
        <article
          style={{
            background: 'var(--mg-surface)',
            border: '1px solid var(--mg-border)',
            borderRadius: 12,
            padding: 24,
          }}
        >
          <div style={{ fontSize: 32, marginBottom: 12 }}>💳</div>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, marginTop: 0, color: 'var(--mg-text)' }}>
            Credit Score
          </h2>
          <p style={{ fontSize: 14, color: 'var(--mg-muted)', lineHeight: 1.6, marginBottom: 16, marginTop: 0 }}>
            Students play individually to learn debt, budgeting, and credit outcomes over time.
          </p>
          <div style={{ fontSize: 13, color: 'var(--mg-muted)', lineHeight: 1.9 }}>
            <div>🎯 <strong style={{ color: 'var(--mg-text)' }}>Goal</strong> - build a stronger credit score through better decisions</div>
            <div>💰 <strong style={{ color: 'var(--mg-text)' }}>Savings target</strong> - reach ${SAVINGS_GOAL_TARGET.toLocaleString()} by round {SAVINGS_GOAL_ROUND}</div>
            <div>👤 <strong style={{ color: 'var(--mg-text)' }}>Mode</strong> - solo assignment (not team competition)</div>
            <div>📉 <strong style={{ color: 'var(--mg-text)' }}>Core lesson</strong> - monthly choices compound into long-term outcomes</div>
          </div>
        </article>

        <div
          className="credit-mvp__setup-form"
          style={{
            background: 'var(--mg-surface)',
            border: '1px solid var(--mg-border)',
            borderRadius: 12,
            padding: 24,
            marginBottom: 0,
          }}
        >
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, marginTop: 0, color: 'var(--mg-text)' }}>
            Assign to Students
          </h3>
          <p style={{ fontSize: 13, color: 'var(--mg-muted)', marginBottom: 16, marginTop: 0, lineHeight: 1.5 }}>
            Create a shareable link to send students directly to this simulation.
          </p>
          <div className="credit-mvp__form-row">
            <label>
              <span>Difficulty</span>
              <select value={difficulty} onChange={(e) => onDifficulty(e.target.value as DifficultyLevel)}>
                <option value="easy">Easy</option>
                <option value="hard">Hard</option>
              </select>
            </label>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem' }}>
            <button
              type="button"
              className="credit-mvp__start-btn"
              onClick={onCreatePlayLink}
              disabled={isCreating}
              style={{ width: '100%', padding: '10px', borderRadius: 8 }}
            >
              {isCreating ? 'Creating...' : '+ Create Student Link'}
            </button>
            <button
              type="button"
              className="credit-mvp__start-btn"
              onClick={onSoloTest}
              disabled={isStartingSolo}
              style={{
                width: '100%',
                padding: '10px',
                background: 'transparent',
                color: 'var(--mg-muted)',
                border: '1px solid var(--mg-border)',
                borderRadius: 8,
              }}
            >
              {isStartingSolo ? 'Starting Solo...' : '\u25B6 Test Solo'}
            </button>
          </div>
          {createdSession && (
            <div style={{ marginTop: 14, padding: 12, background: 'var(--mg-surface-2)', borderRadius: 8, border: '1px solid var(--mg-border)' }}>
              <div style={{ fontSize: 12, color: 'var(--mg-muted)', marginBottom: 6 }}>Student link:</div>
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  readOnly
                  value={createdSession.joinLink}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    fontSize: 11,
                    padding: '6px 8px',
                    borderRadius: 6,
                    border: '1px solid var(--mg-border)',
                    background: 'var(--mg-surface)',
                    color: 'var(--mg-text)',
                  }}
                />
                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(createdSession.joinLink)}
                  style={{
                    padding: '6px 10px',
                    background: 'var(--mg-accent)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 6,
                    fontSize: 12,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Copy
                </button>
              </div>
              <div style={{ marginTop: 12, display: 'flex', justifyContent: 'center', background: '#fff', borderRadius: 8, padding: 12 }}>
                <QRCodeSVG value={createdSession.joinLink} size={200} bgColor="#ffffff" fgColor="#0f172a" level="M" />
              </div>
            </div>
          )}
          {error && <p className="credit-mvp__error-text">{error}</p>}
        </div>
      </div>
    </section>
  )
}

function StudentJoinSetupPhase({
  difficulty,
  inviteLabel,
  loadingConfig,
  configError,
  onStart,
}: {
  difficulty: DifficultyLevel
  inviteLabel?: string | null
  loadingConfig: boolean
  configError: string
  onStart: () => void
}) {
  const canStart = !loadingConfig && !configError

  return (
    <section className="credit-mvp__setup">
      <div className="credit-mvp__setup-intro">
        <h2>Open Credit Score Assignment</h2>
        {inviteLabel && <p className="credit-mvp__muted">Assignment: {inviteLabel}</p>}
        <p>Settings are defined by your educator.</p>
      </div>

      <div className="credit-mvp__setup-preview">
        <h3>Assignment Settings</h3>
        <div className="credit-mvp__setup-preview-row">
          <span>Profile: <strong>{STUDENT_PROFILE_PRESET.label}</strong></span>
          <span>Difficulty: <strong>{difficulty === 'hard' ? 'Hard' : 'Easy'}</strong></span>
        </div>
        <p className="credit-mvp__muted" style={{ marginTop: '0.5rem' }}>
          Monthly income is shown as gross pay. The game calculates PAYE tax and ACC levy to show take-home pay.
        </p>
        {loadingConfig && <p className="credit-mvp__muted" style={{ marginTop: '0.5rem' }}>Loading classroom config...</p>}
        {configError && <p className="credit-mvp__error-text">{configError}</p>}
      </div>

      <div className="credit-mvp__setup-form">
        <button
          type="button"
          className="credit-mvp__btn-primary"
          disabled={!canStart}
          onClick={() => { if (canStart) onStart() }}
        >
          Start
        </button>
      </div>
    </section>
  )
}

// ─── Choice Impact Preview ──────────────────────────────────────────────────

function PlayingPhase({
  scenario, round, totalRounds, insurancePlan, onChoice, selectedChoice, onSelectChoice, lastCascade,
}: {
  scenario: CreditScenario
  round: number
  totalRounds: number
  insurancePlan: InsurancePlan
  onChoice: (c: CreditScenarioChoice) => void
  selectedChoice: CreditScenarioChoice | null
  onSelectChoice: (c: CreditScenarioChoice | null) => void
  lastCascade: RoundCascade | null
}) {
  const [showCascade, setShowCascade] = useState(true)

  const handleConfirm = () => {
    if (selectedChoice) {
      onChoice(selectedChoice)
      onSelectChoice(null) // Reset selection after confirming
      setShowCascade(true) // Show cascade for next round
    }
  }

  const handleOutsideChoiceClick = () => {
    if (selectedChoice) onSelectChoice(null)
  }

  return (
    <div className="credit-mvp__playing" onClick={handleOutsideChoiceClick}>
      {/* Previous Round Results - Compact Cascade Panel */}
      {lastCascade && showCascade && lastCascade.events.length > 0 && (
        <article className={`credit-mvp__cascade-compact ${lastCascade.missedPayment ? 'credit-mvp__cascade-compact--alert' : ''}`}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
            <strong style={{ fontSize: '0.85rem', color: lastCascade.missedPayment ? '#ef4444' : 'var(--text-accent, #2563eb)' }}>
              {lastCascade.missedPayment ? '⚠️ Previous Round - Financial Crisis' : '✓ Previous Round Results'}
            </strong>
            <button
              type="button"
              onClick={() => setShowCascade(false)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: 'var(--text-muted)', padding: 0, lineHeight: 1 }}
            >
              ×
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            {lastCascade.events.map((event, i) => (
              <div
                key={i}
                style={{
                  fontSize: '0.8rem',
                  color: event.includes('MAXED OUT') || event.includes('Missed') || event.includes('insufficient')
                    ? '#ef4444'
                    : event.includes('surplus') || event.includes('added to savings')
                      ? '#10b981'
                      : 'var(--text-secondary)',
                }}
              >
                {event}
              </div>
            ))}
          </div>
        </article>
      )}

      {/* Scenario */}
      <article className="credit-board-card animate-fade-in" style={{ animationDelay: '0.2s' }}>
        <div className="credit-mvp__scenario-header">
          <span className="credit-mvp__category-badge" data-category={scenario.category}>
            {CATEGORY_ICONS[scenario.category]} {CATEGORY_LABELS[scenario.category]}
          </span>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Round {round}/{totalRounds}</span>
        </div>
        <h2>{scenario.title}</h2>
        <p className="credit-mvp__story">{scenario.story}</p>
        {scenario.id === 'gp-treatment-visit' && (
          <div style={{ marginBottom: '0.75rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Health cover: <strong>{insurancePlan}</strong>. Treatment base cost this round: <strong>${insuranceTreatmentCost(insurancePlan)}</strong>.
          </div>
        )}
        <div className="credit-mvp__choice-list">
          <div onClick={(e) => e.stopPropagation()}>
            {scenario.choices.map(c => {
              const isSelected = selectedChoice?.id === c.id
              return (
                <div key={c.id} style={{ marginBottom: '0.75rem' }}>
                  <button
                    type="button"
                    className={`credit-mvp__choice-btn ${isSelected ? 'credit-mvp__choice-btn--selected' : ''}`}
                    onClick={() => onSelectChoice(isSelected ? null : c)}
                  >
                    <span className="credit-mvp__choice-label">{c.label}</span>
                  </button>

                  {/* Show explanation under the selected choice */}
                  {isSelected && (
                    <div className="credit-mvp__choice-analysis">
                      <div className="credit-mvp__choice-analysis-header">
                        <strong>What happens if you choose this:</strong>
                      </div>
                      <p className="credit-mvp__choice-analysis-consequence">{c.consequence}</p>

                      <div className="credit-mvp__choice-analysis-note">
                        <strong>Credit Impact:</strong> {c.creditNote}
                      </div>

                      <button
                        type="button"
                        className="credit-mvp__confirm-btn"
                        onClick={handleConfirm}
                      >
                        Confirm This Choice
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
        <div style={{ marginTop: '0.75rem', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
          NZQA mapping: US 28104, US 28100
        </div>
      </article>
    </div>
  )
}

// ─── Score Distribution Histogram ────────────────────────────────────────────

function ScoreHistogram({ score }: { score: number }) {
  const SCORE_MIN = 300, SCORE_MAX = 850
  const BINS = [
    { color: '#c62828', h: 0.25 },
    { color: '#ef5350', h: 0.38 },
    { color: '#f57c00', h: 0.52 },
    { color: '#ffa726', h: 0.67 },
    { color: '#ffee58', h: 0.78 },
    { color: '#d4e157', h: 0.88 },
    { color: '#9ccc65', h: 0.95 },
    { color: '#66bb6a', h: 0.83 },
    { color: '#43a047', h: 0.63 },
    { color: '#2e7d32', h: 0.44 },
    { color: '#1b5e20', h: 0.28 },
  ]
  const TOP = 58, CHART_H = 150
  const AXIS_Y = TOP + CHART_H
  const SVG_H = AXIS_Y + 52
  const W = 560
  const barW = W / BINS.length

  const clamped = Math.min(SCORE_MAX, Math.max(SCORE_MIN, score))
  const pinX = ((clamped - SCORE_MIN) / (SCORE_MAX - SCORE_MIN)) * W
  const binIdx = Math.min(BINS.length - 1, Math.floor((clamped - SCORE_MIN) / 50))
  const pinAnchorY = AXIS_Y - CHART_H * BINS[binIdx].h

  const curvePoints = BINS.map((b, i) => `${(i + 0.5) * barW},${AXIS_Y - CHART_H * b.h}`).join(' ')
  const xLabels = [300, 400, 500, 600, 700, 800, 850]

  return (
    <svg viewBox={`0 0 ${W} ${SVG_H}`} width="100%" style={{ display: 'block', overflow: 'visible' }}>
      {BINS.map((b, i) => (
        <rect
          key={i} x={i * barW + 1} y={AXIS_Y - CHART_H * b.h}
          width={barW - 2} height={CHART_H * b.h}
          fill={b.color} rx="2"
        />
      ))}
      <line x1={0} y1={AXIS_Y} x2={W} y2={AXIS_Y} stroke="#cbd5e1" strokeWidth="1" />
      <polyline points={curvePoints} fill="none" stroke="rgba(71,85,105,0.65)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {xLabels.map(label => {
        const x = ((label - SCORE_MIN) / (SCORE_MAX - SCORE_MIN)) * W
        return (
          <g key={label}>
            <line x1={x} y1={AXIS_Y} x2={x} y2={AXIS_Y + 4} stroke="#94a3b8" strokeWidth="1" />
            <text x={x} y={AXIS_Y + 16} textAnchor="middle" fontSize="10" fill="#64748b">{label}</text>
          </g>
        )
      })}
      <text x={W / 2} y={SVG_H - 4} textAnchor="middle" fontSize="10.5" fill="#94a3b8" fontStyle="italic">
        The higher the score the lower the risk
      </text>
      {/* Score pin */}
      <g transform={`translate(${pinX}, ${pinAnchorY})`}>
        <polygon points="0,0 -8,-14 8,-14" fill="#0891b2" />
        <circle cx={0} cy={-36} r={22} fill="#0891b2" />
        <line x1={-14} y1={-33} x2={14} y2={-33} stroke="rgba(255,255,255,0.4)" strokeWidth="1" />
        <text x={0} y={-40} textAnchor="middle" dominantBaseline="middle" fontSize="13" fontWeight="800" fill="white">{score}</text>
        <text x={0} y={-27} textAnchor="middle" dominantBaseline="middle" fontSize="8" fill="rgba(255,255,255,0.9)">{SCORE_MAX}</text>
      </g>
    </svg>
  )
}

// ─── Feedback Phase ──────────────────────────────────────────────────────────
// Shows budget impact only — credit score is hidden until summary

function SummaryPhase({
  history, finalScore, factors, profile, investment, playerName, creditDefaults, onRestart,
}: {
  history: CreditHistoryEntry[]
  finalScore: number
  factors: CreditFactors
  profile: CreditBudgetProfile
  investment: InvestmentState
  playerName: string
  creditDefaults: CreditDefaultEntry[]
  onRestart: () => void
}) {
  const rating = scoreRating(finalScore)
  const startScore = history.length > 0 ? history[0].scoreBefore : finalScore

  // Best / worst
  const sorted = [...history].sort((a, b) => b.scoreDelta - a.scoreDelta)
  const best = sorted.filter(h => h.scoreDelta > 0).slice(0, 2)
  const worst = [...history].sort((a, b) => a.scoreDelta - b.scoreDelta).filter(h => h.scoreDelta < 0).slice(0, 2)

  // Weak factors
  const weakFactors = (Object.keys(FACTOR_NAMES) as (keyof CreditFactors)[]).filter(
    k => factors[k] < 0.55,
  )
  const savingsByGoalRound = (() => {
    const budgetAtGoalRound = history.find((h) => h.round === SAVINGS_GOAL_ROUND)?.budgetAfter
    return budgetAtGoalRound ? totalSavings(budgetAtGoalRound) : totalSavings(profile)
  })()
  const goalMetByTargetRound = savingsByGoalRound >= SAVINGS_GOAL_TARGET

  // Risk odds (log-linear, calibrated so score≈700 → ~4:1)
  const rawOdds = Math.pow(2, (finalScore - 540) / 80)
  const riskOddsLabel = rawOdds >= 1
    ? `${Math.round(rawOdds)} : 1`
    : `1 : ${Math.round(1 / rawOdds)}`
  const riskOddsExplanation = rawOdds >= 1
    ? `This score indicates you can expect ${Math.round(rawOdds)} good accounts for every 1 bad.`
    : `This score indicates you can expect 1 good account for every ${Math.round(1 / rawOdds)} bad.`

  // Journey SVG
  const scores = [startScore, ...history.map(h => h.scoreAfter)]
  const mn = Math.min(...scores) - 20
  const mx = Math.max(...scores) + 20
  const W = 600, H = 160, P = 30

  return (
    <section className="credit-mvp__summary" style={{ position: 'relative' }}>

      {/* ── Credit Report Card ── */}
      <div style={{ background: '#fff', border: '1px solid #dde3ec', borderRadius: '12px', overflow: 'visible', marginBottom: '1.5rem', boxShadow: '0 2px 8px rgba(0,0,0,0.07)', color: '#111827' }}>
        {/* Tab header */}
        <div style={{ background: '#f4f6f9', borderBottom: '1px solid #dde3ec', padding: '0.35rem 1.25rem 0' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', background: '#fff', border: '1px solid #dde3ec', borderBottom: '1px solid #fff', borderRadius: '6px 6px 0 0', padding: '0.4rem 1rem', fontSize: '0.82rem', fontWeight: 600, color: '#374151' }}>
            Credit report
            <span style={{ background: '#9ca3af', color: '#fff', borderRadius: '999px', fontSize: '0.6rem', padding: '1px 5px', fontWeight: 700 }}>1</span>
          </div>
        </div>

        {/* Histogram + score box */}
        <div style={{ display: 'flex', gap: '1.5rem', padding: '1.5rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
          {/* Histogram */}
          <div style={{ flex: 1, minWidth: 260 }}>
            <ScoreHistogram score={finalScore} />
          </div>

          {/* Score info box */}
          <div style={{ width: 210, background: '#f8f9fb', border: '1px solid #dde3ec', borderRadius: '8px', padding: '1.25rem', textAlign: 'center', flexShrink: 0 }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#374151', marginBottom: '0.2rem' }}>Credit score:</div>
            <div style={{ fontSize: '3.2rem', fontWeight: 900, color: '#111827', lineHeight: 1, letterSpacing: '-2px' }}>{finalScore}</div>
            <div style={{ fontSize: '0.72rem', color: '#6b7280', marginBottom: '0.6rem' }}>out of a possible 850</div>
            <span className={`credit-mvp__rating-badge ${rating.cls}`}>{rating.label}</span>
            <div style={{ height: 1, background: '#e5e7eb', margin: '0.85rem 0' }} />
            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#374151', marginBottom: '0.3rem' }}>Risk Odds: {riskOddsLabel}</div>
            <div style={{ fontSize: '0.7rem', color: '#6b7280', lineHeight: 1.5 }}>{riskOddsExplanation}</div>
            <div style={{ height: 1, background: '#e5e7eb', margin: '0.85rem 0' }} />
            <div style={{ fontSize: '0.7rem', color: '#9ca3af' }}>
              Started {startScore} &rarr; {finalScore}{' '}
              <span style={{ color: finalScore >= startScore ? '#10b981' : '#ef4444', fontWeight: 700 }}>
                ({finalScore >= startScore ? '+' : ''}{finalScore - startScore})
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Credit Defaults Table (only shown if player triggered collections) ── */}
      {creditDefaults.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid #dde3ec', borderRadius: '12px', overflow: 'hidden', marginBottom: '1.5rem', boxShadow: '0 2px 8px rgba(0,0,0,0.07)', color: '#111827' }}>
          <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #dde3ec', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span style={{ fontSize: '1rem', fontWeight: 700 }}>Credit defaults</span>
            <span style={{ background: '#ef4444', color: '#fff', borderRadius: '999px', fontSize: '0.65rem', padding: '1px 7px', fontWeight: 700 }}>{creditDefaults.length}</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #dde3ec', background: '#f8f9fb' }}>
                  {['Date:', 'Account type:', 'Credit provider:', 'Reference:', 'Original Account:', 'Current Balance Status:', 'Status Date:'].map(h => (
                    <th key={h} style={{ padding: '0.6rem 1rem', textAlign: 'left', fontWeight: 600, color: '#374151', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {creditDefaults.map((d, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '0.6rem 1rem', color: '#6b7280' }}>Round {d.round}</td>
                    <td style={{ padding: '0.6rem 1rem', color: '#374151' }}>{d.accountType}</td>
                    <td style={{ padding: '0.6rem 1rem', color: '#374151' }}>{d.creditProvider}</td>
                    <td style={{ padding: '0.6rem 1rem', color: '#6b7280' }}>{d.reference}</td>
                    <td style={{ padding: '0.6rem 1rem', color: '#374151' }}>${d.originalAmount.toLocaleString()}.00</td>
                    <td style={{ padding: '0.6rem 1rem' }}>
                      <span style={{
                        color: d.status === 'paid-default' ? '#16a34a' : '#ef4444',
                        fontWeight: 600,
                      }}>
                        ${d.currentBalance.toLocaleString()}.00
                      </span>
                    </td>
                    <td style={{ padding: '0.6rem 1rem', color: '#6b7280' }}>
                      {d.status === 'paid-default' ? 'Paid (default remains)' : d.status === 'debt-management' ? 'Debt management' : 'Outstanding'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ padding: '0.6rem 1.5rem', background: '#fff7ed', borderTop: '1px solid #fed7aa', fontSize: '0.72rem', color: '#9a3412' }}>
            Credit defaults remain on your NZ credit file for <strong>5 years</strong> from the date of filing, regardless of whether the debt is paid.
          </div>
        </div>
      )}

      {/* Credit Factor Breakdown — revealed for the first time */}
      <article className="credit-mvp__panel">
        <h2>Credit Factor Breakdown</h2>
        <p className="credit-mvp__muted">These are the 5 factors that determine your credit score.</p>
        <div className="credit-mvp__factor-reveal">
          {(Object.keys(FACTOR_NAMES) as (keyof CreditFactors)[]).map(k => (
            <div key={k} className="credit-mvp__factor-item">
              <span className="credit-mvp__factor-name">{FACTOR_NAMES[k]}</span>
              <span className={factorClass(factors[k])}>{factorLabel(factors[k])}</span>
              <InfoTooltip content={FACTOR_TIPS[k]} position="left" />
            </div>
          ))}
        </div>
      </article>

      {/* Score Journey */}
      <article className="credit-mvp__panel">
        <h2>Score Journey</h2>
        <div className="credit-mvp__journey-chart">
          <svg viewBox={`0 0 ${W} ${H}`} className="credit-mvp__journey-svg">
            {[0.25, 0.5, 0.75].map(pct => {
              const y = P + (H - 2 * P) * (1 - pct)
              return (
                <g key={pct}>
                  <line x1={P} y1={y} x2={W - P} y2={y} stroke="#e2e8f0" strokeDasharray="4" />
                  <text x={P - 5} y={y + 4} textAnchor="end" fontSize="10" fill="#64748b">
                    {Math.round(mn + (mx - mn) * pct)}
                  </text>
                </g>
              )
            })}
            <polyline
              fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinejoin="round"
              points={scores.map((s, i) => {
                const x = P + (i / (scores.length - 1)) * (W - 2 * P)
                const y = P + (1 - (s - mn) / (mx - mn)) * (H - 2 * P)
                return `${x},${y}`
              }).join(' ')}
            />
            {scores.map((s, i) => {
              const x = P + (i / (scores.length - 1)) * (W - 2 * P)
              const y = P + (1 - (s - mn) / (mx - mn)) * (H - 2 * P)
              const q = i === 0 ? null : history[i - 1]?.choiceQuality
              const fill = q === 'good' ? '#10b981' : q === 'risky' ? '#ef4444' : q === 'moderate' ? '#f59e0b' : '#2563eb'
              return (
                <g key={i}>
                  <circle cx={x} cy={y} r="5" fill={fill} />
                  <text x={x} y={y - 10} textAnchor="middle" fontSize="10" fontWeight="600" fill="#0f172a">{s}</text>
                  <text x={x} y={H - 4} textAnchor="middle" fontSize="9" fill="#64748b">{i === 0 ? 'Start' : `R${i}`}</text>
                </g>
              )
            })}
          </svg>
        </div>
      </article>

      {/* Round History */}
      <article className="credit-mvp__panel">
        <h2>Round-by-Round Decisions</h2>
        <div className="credit-mvp__table-wrap">
          <table>
            <thead>
              <tr>
                <th>Round</th>
                <th>Scenario</th>
                <th>Decision</th>
                <th>Credit Impact</th>
                <th>Why</th>
              </tr>
            </thead>
            <tbody>
              {history.map(e => (
                <tr key={e.round}>
                  <td>{e.round}</td>
                  <td>
                    <span className="credit-mvp__category-badge credit-mvp__category-badge--small" data-category={e.category}>
                      {CATEGORY_ICONS[e.category]}
                    </span>{' '}
                    {e.scenarioTitle}
                  </td>
                  <td>{e.choiceLabel}</td>
                  <td className={e.scoreDelta > 0 ? 'credit-mvp__positive' : e.scoreDelta < 0 ? 'credit-mvp__negative' : ''}>
                    {e.scoreDelta >= 0 ? '+' : ''}{e.scoreDelta}
                  </td>
                  <td className="credit-mvp__credit-note-cell">{e.creditNote}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>

      {/* Best & Worst */}
      <div className="credit-mvp__decision-analysis">
        {best.length > 0 && (
          <article className="credit-mvp__panel credit-mvp__panel--success">
            <h3>Decisions That Helped</h3>
            {best.map(d => (
              <div key={d.round} className="credit-mvp__analysis-item">
                <strong>R{d.round}: {d.scenarioTitle}</strong>
                <p>{d.choiceLabel}</p>
                <span className="credit-mvp__positive">Score {fmtDelta(d.scoreDelta, '')}</span>
              </div>
            ))}
          </article>
        )}
        {worst.length > 0 && (
          <article className="credit-mvp__panel credit-mvp__panel--danger">
            <h3>Decisions That Hurt</h3>
            {worst.map(d => (
              <div key={d.round} className="credit-mvp__analysis-item">
                <strong>R{d.round}: {d.scenarioTitle}</strong>
                <p>{d.choiceLabel}</p>
                <span className="credit-mvp__negative">Score {fmtDelta(d.scoreDelta, '')}</span>
              </div>
            ))}
          </article>
        )}
      </div>

      {/* Tips */}
      {weakFactors.length > 0 && (
        <article className="credit-mvp__panel">
          <h2>Tips to Improve</h2>
          <div className="credit-mvp__tips-grid">
            {weakFactors.map(k => (
              <div key={k} className="credit-mvp__tip-card">
                <strong className="credit-mvp__factor--weak">{FACTOR_NAMES[k]}: Weak</strong>
                <p>{FACTOR_TIPS[k]}</p>
              </div>
            ))}
          </div>
        </article>
      )}

      {/* Final Budget */}
      <article className="credit-mvp__panel">
        <h2>Final Budget Position</h2>
        <BudgetTable profile={profile} />
        <div className="credit-mvp__setup-preview-row" style={{ marginTop: '0.75rem' }}>
          <span>Total Savings: <strong>${totalSavings(profile).toLocaleString()}</strong></span>
          <span>Emergency: <strong>${profile.emergencyFund.toLocaleString()}</strong> | Goal: <strong>${profile.goalSavings.toLocaleString()}</strong></span>
          <span>Card: <strong>${profile.cardBalance.toLocaleString()}</strong> / ${profile.cardLimit.toLocaleString()}</span>
          <span>Utilization: <strong>{Math.round((profile.cardBalance / profile.cardLimit) * 100)}%</strong></span>
        </div>
        <div className="credit-mvp__setup-preview-row" style={{ marginTop: '0.75rem' }}>
          <span>
            Goal Check (Round {SAVINGS_GOAL_ROUND}):{' '}
            <strong className={goalMetByTargetRound ? 'credit-mvp__positive' : 'credit-mvp__negative'}>
              {goalMetByTargetRound ? 'Achieved' : 'Not achieved'}
            </strong>
          </span>
          <span>Savings at target round: <strong>${savingsByGoalRound.toLocaleString()}</strong> / ${SAVINGS_GOAL_TARGET.toLocaleString()}</span>
        </div>
        {investment.type !== 'none' && (
          <div className="credit-mvp__setup-preview-row" style={{ marginTop: '0.75rem' }}>
            <span>Investment: <strong>{investment.type}</strong></span>
            <span>Value: <strong>${investment.currentValue.toLocaleString()}</strong></span>
            <span className={investment.totalReturn >= 0 ? 'credit-mvp__positive' : 'credit-mvp__negative'}>
              Return: {investment.totalReturn >= 0 ? '+' : ''}${investment.totalReturn.toLocaleString()}
            </span>
          </div>
        )}
      </article>

      <div className="credit-mvp__summary-actions">
        <button type="button" className="credit-mvp__start-btn" onClick={onRestart}>Play Again</button>
      </div>
    </section>
  )
}

// ─── Budget Impact Panel (with deltas) ──────────────────────────────────────

function BudgetImpactPanel({
  profile,
  history,
  phase,
  previewChoice,
  currentScenario,
  insurancePlan,
  investment,
  savingsGoalTarget = 2000,
}: {
  profile: CreditBudgetProfile
  history: CreditHistoryEntry[]
  phase: GamePhase
  previewChoice: CreditScenarioChoice | null
  currentScenario: CreditScenario | null
  insurancePlan: InsurancePlan
  investment: InvestmentState
  savingsGoalTarget?: number
}) {
  const payBreakdown = monthlyDeductionBreakdown(profile.monthlyPay)

  const lastEntry = history.length > 0 ? history[history.length - 1] : null
  const prevBudget = phase === 'feedback' && lastEntry ? lastEntry.budgetBefore : null

  let previewBudget: CreditBudgetProfile | null = null
  if (previewChoice) {
    let adjustedDelta = { ...previewChoice.impact.budgetDelta }

    if (currentScenario?.id === 'bonus-windfall') {
      const bonusAmount = Math.round(profile.cardBalance * 0.9)
      adjustedDelta = {}
      if (previewChoice.id === 'pay-debt') {
        adjustedDelta.cardBalance = -bonusAmount
      } else if (previewChoice.id === 'split-bonus') {
        const debtPayment = Math.round(bonusAmount * 0.5)
        const savingsAmount = Math.round(bonusAmount * 0.25)
        adjustedDelta.cardBalance = -debtPayment
        adjustedDelta.goalSavings = savingsAmount
      } else {
        adjustedDelta = { ...previewChoice.impact.budgetDelta }
      }
    } else if (currentScenario?.id === 'gp-treatment-visit') {
      const treatmentCost = insuranceTreatmentCost(insurancePlan)
      if (previewChoice.id === 'treatment-pay-savings') {
        adjustedDelta = { emergencyFund: -treatmentCost }
      } else if (previewChoice.id === 'treatment-split') {
        const savingsPart = Math.round(treatmentCost * 0.45)
        adjustedDelta = { emergencyFund: -savingsPart, cardBalance: treatmentCost - savingsPart }
      } else if (previewChoice.id === 'treatment-card') {
        adjustedDelta = { cardBalance: treatmentCost }
      }
    }

    previewBudget = applyBudgetDelta(profile, adjustedDelta)
  }

  const renderLineItem = (
    label: string,
    value: number,
    field: keyof CreditBudgetProfile,
    isExpense: boolean,
  ) => {
    let delta = 0
    let showDelta = false

    if (phase === 'feedback' && prevBudget) {
      delta = value - (prevBudget[field] as number)
      showDelta = delta !== 0
    } else if (phase === 'playing' && previewBudget) {
      const previewValue = previewBudget[field] as number
      delta = previewValue - value
      showDelta = delta !== 0
    }

    return (
      <div key={field} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', padding: '0.2rem 0' }}>
        <span style={{ color: '#cbd5e1' }}>{label}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontWeight: 600, color: isExpense ? '#f87171' : '#34d399' }}>
            {isExpense ? `(${value})` : `$${value}`}
          </span>
          {showDelta && (
            <span
              style={{
                fontSize: '0.7rem',
                fontWeight: 700,
                color: delta > 0 ? (isExpense ? '#ef4444' : '#34d399') : (isExpense ? '#34d399' : '#ef4444'),
              }}
            >
              {delta > 0 ? '+' : ''}
              {delta}
            </span>
          )}
        </div>
      </div>
    )
  }

  const baseProfile = profile
  const displayNet = monthlyNet(baseProfile)
  const netDelta =
    phase === 'feedback' && prevBudget
      ? monthlyNet(baseProfile) - monthlyNet(prevBudget)
      : phase === 'playing' && previewBudget
        ? monthlyNet(previewBudget) - monthlyNet(baseProfile)
        : 0
  const showNetDelta = netDelta !== 0

  let incomeDelta = 0
  let showIncomeDelta = false
  if (phase === 'feedback' && prevBudget) {
    incomeDelta = baseProfile.monthlyPay - prevBudget.monthlyPay
    showIncomeDelta = incomeDelta !== 0
  } else if (phase === 'playing' && previewBudget) {
    incomeDelta = previewBudget.monthlyPay - baseProfile.monthlyPay
    showIncomeDelta = incomeDelta !== 0
  }

  let cardBreakdownHint = ''
  if (phase === 'playing' && currentScenario?.id === 'utility-spike' && previewChoice?.id === 'skip-card-payment') {
    cardBreakdownHint = 'Includes +$60 utility charge and +$45 late fee.'
  }

  let savingsDelta = 0
  let showSavingsDelta = false
  let cardDelta = 0
  let showCardDelta = false

  if (phase === 'feedback' && prevBudget) {
    savingsDelta = totalSavings(baseProfile) - totalSavings(prevBudget)
    showSavingsDelta = savingsDelta !== 0
    cardDelta = baseProfile.cardBalance - prevBudget.cardBalance
    showCardDelta = cardDelta !== 0
  } else if (phase === 'playing' && previewBudget) {
    savingsDelta = totalSavings(previewBudget) - totalSavings(baseProfile)
    showSavingsDelta = savingsDelta !== 0
    cardDelta = previewBudget.cardBalance - baseProfile.cardBalance
    showCardDelta = cardDelta !== 0
  }

  return (
    <div
      className="dm-impact-card"
      style={{
        background: 'linear-gradient(180deg, rgba(24, 46, 88, 0.96) 0%, rgba(18, 36, 72, 0.98) 100%)',
        border: '1px solid rgba(191, 219, 254, 0.28)',
        borderRadius: '28px',
        boxShadow: '0 14px 28px rgba(15, 23, 42, 0.32)',
      }}
    >
      <div className="dm-impact-header">
        <span style={{ color: '#dbeafe', letterSpacing: '0.04em' }}>Your Budget</span>
        <span className="dm-impact-live">
          <span className="status-pulse"></span>
          {previewBudget ? 'PREVIEW' : 'LIVE'}
        </span>
      </div>

      {/* Financial Status — Savings & Debt summary */}
      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem' }}>
        <div style={{
          flex: 1, background: 'rgba(13, 28, 58, 0.56)', borderRadius: '14px',
          border: '1px solid rgba(52, 211, 153, 0.25)', padding: '0.75rem 1rem',
        }}>
          <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.3rem' }}>Savings</div>
          <div style={{
            fontSize: '1.1rem', fontWeight: 800,
            color: totalSavings(profile) >= savingsGoalTarget ? '#34d399'
              : totalSavings(profile) > 0 ? '#93c5fd'
              : '#f87171',
          }}>
            ${totalSavings(profile).toLocaleString()}
          </div>
        </div>
        <div style={{
          flex: 1, background: 'rgba(13, 28, 58, 0.56)', borderRadius: '14px',
          border: '1px solid rgba(239, 68, 68, 0.25)', padding: '0.75rem 1rem',
        }}>
          <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.3rem' }}>Debt</div>
          <div style={{
            fontSize: '1.1rem', fontWeight: 800,
            color: profile.cardBalance > 0 ? '#f87171' : '#34d399',
          }}>
            ${profile.cardBalance.toLocaleString()}
          </div>
        </div>
      </div>
      <div style={{ marginTop: '1.5rem' }}>
        <div className="dm-impact-kpi">
          <div className="dm-impact-kpi-label" style={{ color: '#bfdbfe' }}>Monthly Net</div>
          <div
            className={`dm-impact-kpi-value ${displayNet < 0 ? 'credit-mvp__danger' : 'credit-mvp__positive'}`}
            style={{ color: displayNet < 0 ? '#f87171' : '#34d399' }}
          >
            {displayNet >= 0 ? '+' : ''}${displayNet}
          </div>
          {showNetDelta && (
            <div className="dm-impact-muted" style={{ color: netDelta > 0 ? '#34d399' : '#ef4444', fontSize: '0.72rem', marginTop: '0.2rem' }}>
              ({netDelta > 0 ? '+' : ''}{netDelta})
            </div>
          )}
        </div>
      </div>

      <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'rgba(13, 28, 58, 0.56)', borderRadius: '16px', border: '1px solid rgba(191, 219, 254, 0.22)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem', paddingBottom: '0.5rem', borderBottom: '1px solid rgba(148, 163, 184, 0.22)' }}>
          <span style={{ fontWeight: 700, color: '#e2e8f0' }}>Gross Income</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontWeight: 700, color: '#34d399' }}>${baseProfile.monthlyPay}</span>
            {showIncomeDelta && (
              <span
                style={{
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  color: incomeDelta > 0 ? '#34d399' : '#ef4444',
                }}
              >
                {incomeDelta > 0 ? '+' : ''}
                {incomeDelta}
              </span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', padding: '0.15rem 0' }}>
          <span style={{ color: '#94a3b8' }}>PAYE tax</span>
          <span style={{ color: '#ef4444', fontWeight: 600 }}>({payBreakdown.payeMonthly})</span>
        </div>
        <div style={{ marginTop: '0.5rem', maxHeight: '320px', overflow: 'auto', paddingRight: '0.2rem' }}>
          <div style={{ color: '#94a3b8', fontWeight: 600, marginBottom: '0.5rem', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Expenses</div>
          {EXPENSE_FIELDS.filter((field) => (baseProfile[field] as number) > 0 || (phase === 'playing' && previewBudget ? (previewBudget[field] as number) > 0 : false)).map((field) =>
            renderLineItem(EXPENSE_LABELS[field], baseProfile[field] as number, field, true),
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid rgba(148, 163, 184, 0.22)' }}>
            <span style={{ color: '#e2e8f0', fontWeight: 700 }}>Total</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <span style={{ fontWeight: 700, color: '#ef4444' }}>({totalExpenses(baseProfile)})</span>
              {phase === 'playing' && previewBudget && totalExpenses(previewBudget) !== totalExpenses(baseProfile) && (
                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: totalExpenses(previewBudget) > totalExpenses(baseProfile) ? '#ef4444' : '#34d399' }}>
                  ({totalExpenses(previewBudget) > totalExpenses(baseProfile) ? '+' : ''}{totalExpenses(previewBudget) - totalExpenses(baseProfile)})
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="dm-impact-kpi" style={{ marginTop: '1rem' }}>
        <div className="dm-impact-kpi-label" style={{ color: '#e2e8f0' }}>Savings</div>
        <div className="dm-impact-muted" style={{ color: '#cbd5e1' }}>
          ${totalSavings(baseProfile).toLocaleString()} / ${SAVINGS_GOAL_TARGET.toLocaleString()} target
          {showSavingsDelta && (
            <span style={{ fontSize: '0.75rem', fontWeight: 700, marginLeft: '0.5rem', color: savingsDelta > 0 ? '#34d399' : '#ef4444' }}>
              {savingsDelta > 0 ? '+' : ''}{savingsDelta}
            </span>
          )}
        </div>
        <div className="dm-impact-progress" style={{ marginTop: '0.5rem' }}>
          <span
            className="dm-impact-progress-fill"
            style={{
              width: `${Math.min(100, (totalSavings(baseProfile) / SAVINGS_GOAL_TARGET) * 100)}%`,
              background: totalSavings(baseProfile) > 0 ? '#34d399' : '#ef4444',
            }}
          />
        </div>
        {baseProfile.savingsSplitConfigured && (
          <div className="dm-impact-muted" style={{ marginTop: '0.5rem', color: '#94a3b8' }}>
            Emergency ${baseProfile.emergencyFund.toLocaleString()} | Goal ${baseProfile.goalSavings.toLocaleString()} ({baseProfile.emergencySplitPercent}% / {100 - baseProfile.emergencySplitPercent}%)
          </div>
        )}
      </div>

      <div className="dm-impact-kpi" style={{ marginTop: '1rem' }}>
        <div className="dm-impact-kpi-label" style={{ color: '#e2e8f0' }}>Credit Card</div>
        <div className="dm-impact-muted" style={{ color: '#cbd5e1' }}>
          ${baseProfile.cardBalance.toLocaleString()} / ${baseProfile.cardLimit.toLocaleString()}
          {showCardDelta && (
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                marginLeft: '0.5rem',
                color: cardDelta > 0 ? '#ef4444' : '#34d399',
              }}
            >
              {cardDelta > 0 ? '+' : ''}
              {cardDelta}
            </span>
          )}
        </div>
        <div className="dm-impact-progress" style={{ marginTop: '0.5rem' }}>
          <span
            className="dm-impact-progress-fill"
            style={{
              width: `${(baseProfile.cardBalance / baseProfile.cardLimit) * 100}%`,
              background: baseProfile.cardBalance / baseProfile.cardLimit > 0.3 ? '#ef4444' : '#3b82f6',
            }}
          />
        </div>
        <div className="dm-impact-muted" style={{ marginTop: '0.5rem', color: '#94a3b8' }}>
          Utilization: <strong>{Math.round((baseProfile.cardBalance / baseProfile.cardLimit) * 100)}%</strong>
          {baseProfile.cardBalance / baseProfile.cardLimit > 0.3 && <span style={{ color: '#ef4444', marginLeft: '0.5rem' }}>High</span>}
        </div>
        {cardBreakdownHint && (
          <div className="dm-impact-muted" style={{ marginTop: '0.25rem', color: '#fca5a5', fontSize: '0.72rem' }}>
            {cardBreakdownHint}
          </div>
        )}
      </div>

      <div className="dm-impact-kpi" style={{ marginTop: '1rem' }}>
        <div className="dm-impact-kpi-label" style={{ color: '#e2e8f0' }}>Investment Tracker</div>
        {investment.type === 'none' ? (
          <div className="dm-impact-muted" style={{ color: '#94a3b8' }}>No active investment yet.</div>
        ) : (
          <>
            <div className="dm-impact-muted" style={{ color: '#cbd5e1' }}>
              {investment.type} portfolio: <strong>${investment.currentValue.toLocaleString()}</strong>
            </div>
            <div className="dm-impact-muted" style={{ color: investment.totalReturn >= 0 ? '#34d399' : '#ef4444' }}>
              Return: {investment.totalReturn >= 0 ? '+' : ''}${investment.totalReturn.toLocaleString()}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
function AssumptionsPanel({
  preset,
  profile,
  onClose,
}: {
  preset: ProfilePreset
  profile: CreditBudgetProfile
  onClose: () => void
}) {
  return (
    <div className="credit-mvp__library-overlay" onClick={onClose}>
      <div className="credit-mvp__library-panel" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
        <div className="credit-mvp__library-header">
          <h2>Game Assumptions</h2>
          <button type="button" className="credit-mvp__close-btn" onClick={onClose}>&times;</button>
        </div>

        <div style={{ padding: '1.5rem' }}>
          <div style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>Your Profile</h3>
            <div style={{ background: 'var(--bg-page, #f8fafc)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-color, #e2e8f0)' }}>
              <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '0.25rem' }}>{preset.label}</div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{preset.description}</div>
            </div>
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>Starting Budget</h3>
            <BudgetTable profile={profile} />
          </div>

          <div>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>Starting Financial Position</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', background: 'var(--bg-page, #f8fafc)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-color, #e2e8f0)' }}>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Total Savings</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#10b981' }}>
                  ${totalSavings(profile).toLocaleString()}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Credit Card Debt</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#ef4444' }}>
                  ${profile.cardBalance.toLocaleString()}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Card Limit</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>
                  ${profile.cardLimit.toLocaleString()}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Utilization</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: profile.cardBalance / profile.cardLimit > 0.3 ? '#ef4444' : '#10b981' }}>
                  {Math.round((profile.cardBalance / profile.cardLimit) * 100)}%
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Savings Split</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>
                  {profile.savingsSplitConfigured ? `${profile.emergencySplitPercent}% emergency / ${100 - profile.emergencySplitPercent}% goal` : 'Not set yet'}
                </div>
              </div>
            </div>
          </div>

          <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'rgba(37, 99, 235, 0.06)', borderRadius: '12px', border: '1px solid rgba(37, 99, 235, 0.2)' }}>
            <div style={{ fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-accent, #2563eb)' }}>Game Rules:</div>
            <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.85rem', lineHeight: '1.6' }}>
              <li>You'll face {ROUNDS_PER_GAME} realistic financial scenarios</li>
              <li>Each round represents one month of financial decisions</li>
              <li>Income starts as gross pay; PAYE tax and ACC levy are deducted to produce take-home pay</li>
              <li>Each month, surplus adds to savings; deficit drains savings then goes on your card</li>
              <li>Credit card interest uses a monthly rate derived from 18% APR</li>
              <li>The savings-split banker advice appears once between rounds 2 and 5; treatment outcomes still depend on your insurance choice</li>
              <li>Track your savings target of ${SAVINGS_GOAL_TARGET.toLocaleString()} by round {SAVINGS_GOAL_ROUND}</li>
              <li>If your card exceeds its limit, you auto-miss the payment (major credit penalty)</li>
              <li>Your credit score is revealed at the end</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Scenario Library Panel ──────────────────────────────────────────────────

function LibraryPanel({ onClose }: { onClose: () => void }) {
  const [filter, setFilter] = useState<CreditScenarioCategory | 'all'>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const grouped = getScenariosByCategory()
  const cats: CreditScenarioCategory[] = ['emergency', 'lifestyle', 'income', 'debt', 'opportunity']
  const list = filter === 'all' ? CREDIT_SCENARIOS : grouped[filter]

  // Helper to format credit score impact
  const formatCreditImpact = (creditDelta: CreditScenario['choices'][0]['impact']['creditDelta']): string => {
    const impacts: string[] = []

    if (creditDelta.paymentHistory) {
      const value = creditDelta.paymentHistory * 100
      impacts.push(`Payment History: ${value > 0 ? '+' : ''}${value.toFixed(0)}%`)
    }
    if (creditDelta.utilization) {
      const value = creditDelta.utilization * 100
      impacts.push(`Utilization: ${value > 0 ? '+' : ''}${value.toFixed(0)}%`)
    }
    if (creditDelta.ageOfCredit) {
      const value = creditDelta.ageOfCredit * 100
      impacts.push(`Credit Age: ${value > 0 ? '+' : ''}${value.toFixed(0)}%`)
    }
    if (creditDelta.creditMix) {
      const value = creditDelta.creditMix * 100
      impacts.push(`Mix: ${value > 0 ? '+' : ''}${value.toFixed(0)}%`)
    }
    if (creditDelta.newInquiries) {
      const value = creditDelta.newInquiries * 100
      impacts.push(`Inquiries: ${value > 0 ? '+' : ''}${value.toFixed(0)}%`)
    }

    return impacts.length > 0 ? impacts.join(', ') : 'No credit impact'
  }

  // Helper to get scenario's credit impact range (for header summary)
  const getScenarioImpactSummary = (scenario: CreditScenario): string => {
    const impacts = scenario.choices.map(ch => {
      let total = 0
      const delta = ch.impact.creditDelta
      if (delta.paymentHistory) total += delta.paymentHistory
      if (delta.utilization) total += delta.utilization
      if (delta.ageOfCredit) total += delta.ageOfCredit
      if (delta.creditMix) total += delta.creditMix
      if (delta.newInquiries) total += delta.newInquiries
      return total
    })

    const max = Math.max(...impacts)
    const min = Math.min(...impacts)

    if (max === 0 && min === 0) return 'No impact'
    if (min < 0 && max > 0) return `${(min * 100).toFixed(0)}% to +${(max * 100).toFixed(0)}%`
    if (min < 0) return `${(min * 100).toFixed(0)}% to ${(max * 100).toFixed(0)}%`
    return `+${(min * 100).toFixed(0)}% to +${(max * 100).toFixed(0)}%`
  }

  return (
    <div className="credit-mvp__library-overlay" onClick={onClose}>
      <div className="credit-mvp__library-panel" onClick={e => e.stopPropagation()}>
        <div className="credit-mvp__library-header">
          <h2>Scenario Library</h2>
          <button type="button" className="credit-mvp__close-btn" onClick={onClose}>&times;</button>
        </div>

        <div className="credit-mvp__library-filters">
          <button
            type="button"
            className={`credit-mvp__filter-btn ${filter === 'all' ? 'credit-mvp__filter-btn--active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All ({CREDIT_SCENARIOS.length})
          </button>
          {cats.map(c => (
            <button
              key={c}
              type="button"
              className={`credit-mvp__filter-btn ${filter === c ? 'credit-mvp__filter-btn--active' : ''}`}
              onClick={() => setFilter(c)}
            >
              {CATEGORY_ICONS[c]} {CATEGORY_LABELS[c]} ({grouped[c].length})
            </button>
          ))}
        </div>

        <div className="credit-mvp__library-list">
          {list.map(s => (
            <div key={s.id} className={`credit-mvp__library-item ${expandedId === s.id ? 'credit-mvp__library-item--expanded' : ''}`}>
              <button
                type="button"
                className="credit-mvp__library-item-header"
                onClick={() => setExpandedId(expandedId === s.id ? null : s.id)}
              >
                <span className="credit-mvp__category-badge credit-mvp__category-badge--small" data-category={s.category}>
                  {CATEGORY_ICONS[s.category]}
                </span>
                <span className="credit-mvp__library-item-title">{s.title}</span>
                <span style={{
                  fontSize: '0.75rem',
                  padding: '0.25rem 0.5rem',
                  backgroundColor: 'rgba(37, 99, 235, 0.15)',
                  borderRadius: '4px',
                  color: '#60a5fa',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                }}>
                  📊 {getScenarioImpactSummary(s)}
                </span>
                <span className="credit-mvp__expand-icon">{expandedId === s.id ? '−' : '+'}</span>
              </button>
              {expandedId === s.id && (
                <div className="credit-mvp__library-item-body">
                  <p className="credit-mvp__story">{s.story}</p>
                  <div className="credit-mvp__library-choices">
                    {s.choices.map(ch => (
                      <div key={ch.id} className="credit-mvp__library-choice">
                        <div className="credit-mvp__library-choice-header">
                          <span className={`credit-mvp__quality-dot credit-mvp__quality--${ch.quality}`}>{ch.quality}</span>
                          <strong>{ch.label}</strong>
                        </div>
                        <p>{ch.consequence}</p>
                        <div className="credit-mvp__library-credit-impact" style={{
                          padding: '0.5rem',
                          backgroundColor: '#f0f4f8',
                          borderRadius: '4px',
                          marginTop: '0.5rem',
                          fontSize: '0.9rem',
                          fontWeight: 600,
                          color: '#2c5282'
                        }}>
                          📊 Credit Score Impact: {formatCreditImpact(ch.impact.creditDelta)}
                        </div>
                        <p className="credit-mvp__library-credit-note">{ch.creditNote}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
