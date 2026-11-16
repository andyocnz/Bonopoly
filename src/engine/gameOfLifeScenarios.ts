// ─── Game of Life Scenario Engine ────────────────────────────────────────────
// A full-life simulation covering ages 17–65 across 18 rounds.
//
// STAGE 1: Foundation  (Ages 17–25, 8 rounds,  1 round = 1 year)
// STAGE 2: Build       (Ages 25–40, 5 rounds,  1 round = 3 years)
// STAGE 3: Harvest     (Ages 40–60, 4 rounds,  1 round = 5 years)
// STAGE 4: Legacy      (Age 65,     1 round  = retirement reveal)
//
// NZ-SPECIFIC FINANCIAL MODEL:
// - PAYE tax brackets + 1.39% ACC levy
// - KiwiSaver: 3% employee + 3% employer minimum + $521/yr govt tax credit
// - Student loan: interest-free in NZ, repayment at 12c per $1 above $22,828
// - First Home Loan: 5% deposit via Kāinga Ora (income/price caps apply)
// - NZ minimum wage (2025): $23.15/hr → ~$48,152 gross/yr full-time

// ─── Types ───────────────────────────────────────────────────────────────────

export type LifeStage = 'foundation' | 'build' | 'harvest' | 'legacy'
export type ChoiceQuality = 'good' | 'moderate' | 'risky'
export type EducationPath = 'university' | 'trades' | 'work' | null
export type JobLevel = 'entry' | 'junior' | 'mid' | 'senior' | 'executive' | 'self-employed'
export type InsuranceType = 'none' | 'basic' | 'comprehensive'

export type ScenarioCategory =
  | 'education'
  | 'career'
  | 'housing'
  | 'health'
  | 'money'
  | 'relationships'
  | 'crisis'
  | 'opportunity'
  | 'family'
  | 'retirement'

// ─── Life Profile (the full financial + life state) ───────────────────────────

export interface LifeProfile {
  // Core financial
  grossAnnualIncome: number        // before tax
  savings: number                  // liquid savings/cash
  netWorth: number                 // total (savings + property equity + investments - debts)

  // KiwiSaver
  kiwisaverBalance: number
  kiwisaverContributing: boolean
  kiwisaverRate: number            // employee %, e.g. 0.03 = 3%

  // Debt
  studentLoanBalance: number
  creditCardDebt: number           // at 19.9% APR
  bnplDebt: number                 // at 0% but fee-trap risk
  personalLoanBalance: number      // at ~12% APR
  mortgageBalance: number

  // Property
  hasProperty: boolean
  propertyValue: number
  propertyEquity: number           // value - mortgage

  // Investments (outside KiwiSaver)
  investmentBalance: number

  // Accumulated monthly expense adjustments from choice impacts (e.g. rent, kids, lifestyle)
  monthlyExpenseOffset: number

  // Life flags
  educationPath: EducationPath
  jobLevel: JobLevel
  insuranceType: InsuranceType
  hasKids: boolean
  isOverseas: boolean              // triggers student loan interest
}

// ─── Life Stats (the 4 qualitative scores, 0–100) ────────────────────────────

export interface LifeStats {
  careerCapital: number     // skills, credentials, network
  happiness: number         // life satisfaction / wellbeing
  health: number            // physical + mental health capital
  relationships: number     // partner, family, community bonds
}

// ─── Choice Impact ────────────────────────────────────────────────────────────

export interface LifeChoiceImpact {
  profileDelta: Partial<LifeProfile>
  statsDelta: Partial<LifeStats>
  /** Ongoing monthly income change (lasts the full stage duration) */
  monthlyIncomeDelta?: number
  /** Ongoing monthly expense change (lasts the full stage duration) */
  monthlyExpenseDelta?: number
  /** Override education path */
  setEducationPath?: EducationPath
  /** Override job level */
  setJobLevel?: JobLevel
  /** Override insurance */
  setInsurance?: InsuranceType
}

export interface LifeChoice {
  id: string
  label: string
  sublabel?: string                // e.g. "$175/week • 3 flatmates"
  quality: ChoiceQuality
  consequence: string              // what immediately happens
  insight: string                  // the educational note / "what this teaches you"
  impact: LifeChoiceImpact
}

// ─── Scenario ─────────────────────────────────────────────────────────────────

export interface LifeScenario {
  id: string
  round: number                    // 1–18
  age: number                      // age at start of round
  yearsElapsed: number             // how many years this round covers (1, 3, or 5)
  stage: LifeStage
  category: ScenarioCategory
  title: string
  story: string                    // the narrative setup
  /** Optional stat shown as "this round in NZ…" context */
  nzStat?: string
  /** Optional background event that happens regardless of choice */
  backgroundEvent?: string
  choices: [LifeChoice, LifeChoice, LifeChoice]
}

// ─── History ──────────────────────────────────────────────────────────────────

export interface LifeHistoryEntry {
  round: number
  age: number
  scenarioId: string
  scenarioTitle: string
  category: ScenarioCategory
  choiceId: string
  choiceLabel: string
  choiceQuality: ChoiceQuality
  consequence: string
  insight: string
  profileBefore: LifeProfile
  profileAfter: LifeProfile
  statsBefore: LifeStats
  statsAfter: LifeStats
  netWorthDelta: number
}

// ─── Ending Archetypes ────────────────────────────────────────────────────────

export interface LifeEnding {
  id: string
  title: string
  emoji: string
  description: string
  reflection: string
  /** Minimum thresholds to qualify */
  conditions: {
    minNetWorth?: number
    maxNetWorth?: number
    minHappiness?: number
    maxHappiness?: number
    minHealth?: number
    minCareer?: number
    minRelationships?: number
  }
}

// ─── NZ Financial Constants ───────────────────────────────────────────────────

export const NZ = {
  minimumWageHourly: 23.15,
  minimumWageAnnual: 48_152,      // 23.15 × 40hrs × 52wks

  // KiwiSaver
  kiwisaverEmployerMin: 0.03,
  kiwisaverGovtTaxCredit: 521.43, // per year (max, 50c per $1 contributed)
  kiwisaverGrowthRate: 0.06,      // 6% p.a. (balanced fund estimate)

  // Student loan
  studentLoanRepaymentThreshold: 22_828,
  studentLoanRepaymentRate: 0.12,  // 12c per $1 above threshold
  studentLoanOverseasRate: 0.072,  // 7.2% p.a. interest if overseas

  // Credit
  creditCardAPR: 0.199,
  personalLoanAPR: 0.12,
  mortgageRate: 0.065,             // 6.5% p.a. (2024 ~)

  // Property
  medianHousePrice: 780_000,
  firstHomeLoanMinDeposit: 0.05,   // 5% with Kāinga Ora
  standardMinDeposit: 0.20,        // 20% standard
  propertyAppreciationRate: 0.04,  // 4% p.a. (conservative)

  // ACC levy
  accLevyRate: 0.0139,

  // PAYE tax brackets 2025
  taxBrackets: [
    { upTo: 14_000,  rate: 0.105 },
    { upTo: 48_000,  rate: 0.175 },
    { upTo: 70_000,  rate: 0.30  },
    { upTo: 180_000, rate: 0.33  },
    { upTo: Infinity, rate: 0.39 },
  ],
} as const

// ─── Starting State ───────────────────────────────────────────────────────────

export const STARTING_PROFILE: LifeProfile = {
  grossAnnualIncome: 0,
  savings: 500,
  netWorth: 500,

  kiwisaverBalance: 0,
  kiwisaverContributing: false,
  kiwisaverRate: 0,

  studentLoanBalance: 0,
  creditCardDebt: 0,
  bnplDebt: 0,
  personalLoanBalance: 0,
  mortgageBalance: 0,

  hasProperty: false,
  propertyValue: 0,
  propertyEquity: 0,

  investmentBalance: 0,

  monthlyExpenseOffset: 0,

  educationPath: null,
  jobLevel: 'entry',
  insuranceType: 'none',
  hasKids: false,
  isOverseas: false,
}

export const STARTING_STATS: LifeStats = {
  careerCapital: 20,
  happiness: 60,
  health: 75,
  relationships: 55,
}

// ─── Helper Functions ─────────────────────────────────────────────────────────

/** Calculate NZ PAYE income tax for a given gross annual income */
export function calculatePAYE(grossAnnual: number): number {
  let tax = 0
  let remaining = grossAnnual
  let prev = 0
  for (const bracket of NZ.taxBrackets) {
    const taxable = Math.min(remaining, bracket.upTo - prev)
    if (taxable <= 0) break
    tax += taxable * bracket.rate
    remaining -= taxable
    prev = bracket.upTo
    if (remaining <= 0) break
  }
  return tax
}

/** Calculate ACC levy */
export function calculateACC(grossAnnual: number): number {
  return grossAnnual * NZ.accLevyRate
}

/** Monthly take-home after PAYE + ACC */
export function monthlyTakeHome(grossAnnual: number): number {
  const tax = calculatePAYE(grossAnnual)
  const acc = calculateACC(grossAnnual)
  return (grossAnnual - tax - acc) / 12
}

/** Monthly student loan repayment (automatic PAYE deduction in NZ) */
export function monthlyStudentLoanRepayment(grossAnnual: number, hasLoan: boolean): number {
  if (!hasLoan) return 0
  const aboveThreshold = Math.max(0, grossAnnual - NZ.studentLoanRepaymentThreshold)
  return (aboveThreshold * NZ.studentLoanRepaymentRate) / 12
}

/** Monthly KiwiSaver employee contribution */
export function monthlyKiwiSaverEmployee(grossAnnual: number, rate: number): number {
  return (grossAnnual * rate) / 12
}

/** Monthly KiwiSaver employer contribution */
export function monthlyKiwiSaverEmployer(grossAnnual: number): number {
  return (grossAnnual * NZ.kiwisaverEmployerMin) / 12
}

/** Compute net worth from profile */
export function computeNetWorth(p: LifeProfile): number {
  return (
    p.savings +
    p.kiwisaverBalance +
    p.propertyEquity +
    p.investmentBalance -
    p.studentLoanBalance -
    p.creditCardDebt -
    p.bnplDebt -
    p.personalLoanBalance
  )
}

/** Apply compounding between rounds given years elapsed */
export function applyCompounding(profile: LifeProfile, yearsElapsed: number): LifeProfile {
  const p = { ...profile }
  const months = yearsElapsed * 12

  for (let m = 0; m < months; m++) {
    // KiwiSaver growth (monthly compound)
    const monthlyGrowthRate = NZ.kiwisaverGrowthRate / 12
    p.kiwisaverBalance *= (1 + monthlyGrowthRate)

    // KiwiSaver contributions (if contributing)
    if (p.kiwisaverContributing && p.grossAnnualIncome > 0) {
      const empContrib = monthlyKiwiSaverEmployee(p.grossAnnualIncome, p.kiwisaverRate)
      // Self-employed workers have no employer — they only get their own contributions
      const emplrContrib = p.jobLevel !== 'self-employed'
        ? monthlyKiwiSaverEmployer(p.grossAnnualIncome)
        : 0
      p.kiwisaverBalance += empContrib + emplrContrib
    }

    // Govt KiwiSaver tax credit (applied annually in July — simplified: monthly)
    if (p.kiwisaverContributing) {
      p.kiwisaverBalance += NZ.kiwisaverGovtTaxCredit / 12
    }

    // Student loan repayment
    if (p.studentLoanBalance > 0 && !p.isOverseas) {
      const repayment = monthlyStudentLoanRepayment(p.grossAnnualIncome, true)
      p.studentLoanBalance = Math.max(0, p.studentLoanBalance - repayment)
    }
    // Overseas interest on student loan
    if (p.studentLoanBalance > 0 && p.isOverseas) {
      p.studentLoanBalance *= (1 + NZ.studentLoanOverseasRate / 12)
    }

    // Credit card interest (minimum payment scenario — worst case)
    if (p.creditCardDebt > 0) {
      p.creditCardDebt *= (1 + NZ.creditCardAPR / 12)
      // Minimum payment (2.5% or $25)
      const minPayment = Math.max(25, p.creditCardDebt * 0.025)
      p.creditCardDebt = Math.max(0, p.creditCardDebt - minPayment)
    }

    // Personal loan interest
    if (p.personalLoanBalance > 0) {
      const monthlyRate = NZ.personalLoanAPR / 12
      p.personalLoanBalance *= (1 + monthlyRate)
      const repayment = p.personalLoanBalance / (24 - Math.min(m, 23)) // rough 2yr term
      p.personalLoanBalance = Math.max(0, p.personalLoanBalance - repayment)
    }

    // Property appreciation + mortgage
    if (p.hasProperty && p.propertyValue > 0) {
      p.propertyValue *= (1 + NZ.propertyAppreciationRate / 12)
      if (p.mortgageBalance > 0) {
        const monthlyInterest = p.mortgageBalance * (NZ.mortgageRate / 12)
        // Standard 30yr amortization approximation
        const totalMonthlyPayment = p.mortgageBalance * (NZ.mortgageRate / 12) /
          (1 - Math.pow(1 + NZ.mortgageRate / 12, -360))
        const principal = totalMonthlyPayment - monthlyInterest
        p.mortgageBalance = Math.max(0, p.mortgageBalance - principal)
        p.propertyEquity = p.propertyValue - p.mortgageBalance
      } else {
        p.propertyEquity = p.propertyValue
      }
    }

    // Investment growth (index fund scenario)
    if (p.investmentBalance > 0) {
      p.investmentBalance *= (1 + 0.07 / 12) // 7% p.a. index fund estimate
    }

    // Monthly cashflow: surplus (or deficit) flows into/out of savings
    const takeHome = monthlyTakeHome(p.grossAnnualIncome)
    const studentLoanDeduction = monthlyStudentLoanRepayment(p.grossAnnualIncome, p.studentLoanBalance > 0)
    const kiwiSaverDeduction = p.kiwisaverContributing ? monthlyKiwiSaverEmployee(p.grossAnnualIncome, p.kiwisaverRate) : 0
    const baseExpenses = estimateBaseExpenses(p)
    const monthlySurplus = takeHome - studentLoanDeduction - kiwiSaverDeduction - baseExpenses
    p.savings += monthlySurplus
    p.savings = Math.max(-100_000, p.savings) // floor at -$100k (extreme insolvency)
  }

  p.netWorth = computeNetWorth(p)
  return p
}

/** Rough baseline monthly living expenses based on life stage */
function estimateBaseExpenses(p: LifeProfile): number {
  let base = 1_800 // rent + food + transport + utilities
  if (p.hasKids) base += 1_500
  if (p.hasProperty) base += (p.mortgageBalance > 0 ? 500 : 200) // rates/insurance instead of rent
  // Insurance premiums affect cashflow
  if (p.insuranceType === 'basic') base += 120
  if (p.insuranceType === 'comprehensive') base += 280
  // Accumulated expense adjustments from scenario choices (rent upgrades, kids costs, lifestyle)
  base += p.monthlyExpenseOffset ?? 0
  return base
}

/** Clamp a stat between 0 and 100 */
export function clampStat(v: number): number {
  return Math.max(0, Math.min(100, Math.round(v)))
}

/** Apply stat delta with clamping */
export function applyStatsDelta(stats: LifeStats, delta: Partial<LifeStats>): LifeStats {
  return {
    careerCapital: clampStat(stats.careerCapital + (delta.careerCapital ?? 0)),
    happiness: clampStat(stats.happiness + (delta.happiness ?? 0)),
    health: clampStat(stats.health + (delta.health ?? 0)),
    relationships: clampStat(stats.relationships + (delta.relationships ?? 0)),
  }
}

/** Compute a financial wellbeing score (0–100) from the profile */
export function financialWellbeingScore(p: LifeProfile): number {
  const netWorth = computeNetWorth(p)
  const monthlyIncome = monthlyTakeHome(p.grossAnnualIncome)
  const debtLoad = p.creditCardDebt + p.bnplDebt + p.personalLoanBalance

  let score = 50
  // Net worth brackets
  if (netWorth > 500_000) score += 30
  else if (netWorth > 200_000) score += 20
  else if (netWorth > 50_000) score += 10
  else if (netWorth < 0) score -= 20
  else if (netWorth < 5_000) score -= 5

  // Income contribution
  if (monthlyIncome > 6_000) score += 10
  else if (monthlyIncome > 4_000) score += 5
  else if (monthlyIncome < 2_000) score -= 10

  // Debt penalty
  if (debtLoad > 20_000) score -= 15
  else if (debtLoad > 5_000) score -= 5

  // KiwiSaver bonus
  if (p.kiwisaverBalance > 100_000) score += 10
  else if (p.kiwisaverBalance > 20_000) score += 5

  // Property bonus
  if (p.propertyEquity > 100_000) score += 10

  return clampStat(score)
}

// ─── Category Labels & Icons ──────────────────────────────────────────────────

export const CATEGORY_LABELS: Record<ScenarioCategory, string> = {
  education: 'Education',
  career: 'Career',
  housing: 'Housing',
  health: 'Health',
  money: 'Money',
  relationships: 'Relationships',
  crisis: 'Life Crisis',
  opportunity: 'Opportunity',
  family: 'Family',
  retirement: 'Retirement',
}

export const CATEGORY_ICONS: Record<ScenarioCategory, string> = {
  education: '🎓',
  career: '💼',
  housing: '🏠',
  health: '🏥',
  money: '💰',
  relationships: '🤝',
  crisis: '⚡',
  opportunity: '🚀',
  family: '👨‍👩‍👧',
  retirement: '🌅',
}

export const STAGE_LABELS: Record<LifeStage, string> = {
  foundation: 'Foundation Years',
  build: 'Building Years',
  harvest: 'Harvest Years',
  legacy: 'Legacy',
}

// ─── Scenarios ────────────────────────────────────────────────────────────────

export const GAME_OF_LIFE_SCENARIOS: LifeScenario[] = [

  // ══════════════════════════════════════════════════════════════════════════
  // STAGE 1: FOUNDATION (Ages 17–25, 1 round = 1 year)
  // ══════════════════════════════════════════════════════════════════════════

  {
    id: 'the-fork',
    round: 1,
    age: 17,
    yearsElapsed: 1,
    stage: 'foundation',
    category: 'education',
    title: 'Three Letters on the Kitchen Table',
    nzStat: 'In NZ, trades workers often out-earn university graduates within 5 years of starting work.',
    story: `It's November. Your NCEA results just landed. Three things arrived this week — a university offer letter, an email from Unitec about their electrical trades programme, and a text from your cousin saying his construction boss is hiring and will train you up.

Your parents have opinions. So does everyone at school. The guidance counsellor assumes university. Your uncle says trades. Your best friend is going to uni.

But this is your life. Fifteen years from now, which path has you better placed?`,
    choices: [
      {
        id: 'university',
        label: 'University — Commerce at AUT',
        sublabel: '3 years · $42,000 student loan · graduate salary $52,000',
        quality: 'good',
        consequence: 'You enrol in Commerce. Three years of study, part-time work, and a $42,000 student loan later — you graduate with a degree, a career foundation, and a debt that\'ll follow you for years.',
        insight: 'University opens specific doors — but the student loan is real. At 12c per dollar above the repayment threshold, it\'ll take 7–10 years to clear on a graduate salary. The degree is only as good as what you do with it.',
        impact: {
          profileDelta: { studentLoanBalance: 42_000, grossAnnualIncome: 52_000, savings: -500 },
          statsDelta: { careerCapital: 18, happiness: 5 },
          setEducationPath: 'university',
          setJobLevel: 'junior',
        },
      },
      {
        id: 'trades',
        label: 'Electrical Trades — Unitec Apprenticeship',
        sublabel: 'Earn while you learn · ~$8,000 fees · qualified at 21',
        quality: 'good',
        consequence: 'You start the apprenticeship. Year one is tough — lots of early mornings, hands-on learning, and $19/hr. By year four, you\'re a qualified electrician earning $75,000+ with near-zero debt.',
        insight: 'Trades are chronically undersupplied in NZ. A qualified electrician earns $70,000–$100,000+ and has skills no recession can offshore. Your debt is $8,000 vs the university path\'s $42,000 — that $34,000 difference compounds over your lifetime.',
        impact: {
          profileDelta: { studentLoanBalance: 8_000, grossAnnualIncome: 40_000, savings: 200 },
          statsDelta: { careerCapital: 14, happiness: 8, health: 5 },
          setEducationPath: 'trades',
          setJobLevel: 'entry',
        },
      },
      {
        id: 'work-now',
        label: 'Start Working — Uncle\'s Construction Business',
        sublabel: 'No debt · $19/hr to start · income from day one',
        quality: 'moderate',
        consequence: 'You start Monday. No debt, income from week one, and you\'re learning on the job. But without a formal credential, your salary ceiling is lower — and the work is physically demanding.',
        insight: 'Starting work immediately means no debt and early compounding on savings. The risk: without a credential, career progression slows around age 25–30. Many people in this path later return to study — but by then, life is more complicated.',
        impact: {
          profileDelta: { grossAnnualIncome: 39_500, savings: 1_000 },
          statsDelta: { careerCapital: 8, happiness: 10 },
          setEducationPath: 'work',
          setJobLevel: 'entry',
        },
      },
    ],
  },

  {
    id: 'leaving-home',
    round: 2,
    age: 18,
    yearsElapsed: 1,
    stage: 'foundation',
    category: 'housing',
    title: 'The Bond Money',
    nzStat: 'The average NZ weekly rent for a room in a shared flat (2024) is $200–$320 depending on city.',
    story: `You're moving out. Freedom. Finally.

Then the reality hits: bond (4 weeks rent), first week's rent in advance, moving costs, internet connection, and the fridge is empty. You worked out you need roughly $2,200 before you spend a single dollar on food.

You have $1,100 saved.

Three options are on the table.`,
    choices: [
      {
        id: 'flatmates',
        label: 'Move in with 3 flatmates',
        sublabel: '$195/week · chaotic but affordable',
        quality: 'good',
        consequence: 'You split costs four ways. The flat is loud, the dishes pile up, but your rent is $195/week and you\'re actually saving money. You make friends. You learn to negotiate. You become more independent.',
        insight: 'Flatting is one of the best financial moves in your 20s. The difference between $195/week and $350/week rent, compounded over 3 years, is $24,000 — enough for a First Home Loan deposit contribution.',
        impact: {
          profileDelta: { savings: -900 },
          statsDelta: { happiness: 12, relationships: 10 },
          monthlyExpenseDelta: -950, // cheaper than average
        },
      },
      {
        id: 'stay-home',
        label: 'Stay home with parents for one more year',
        sublabel: 'Free rent · save $800/month · less independence',
        quality: 'good',
        consequence: 'You stay home. You\'re contributing to chores and board ($50/week), but otherwise you\'re saving hard. By next year you\'ll have $9,000+ more than friends who moved out. It\'s not glamorous, but it\'s strategic.',
        insight: 'Staying home one extra year with parents while working full-time is one of the highest-return financial moves available to young NZers. $800/month saved × 12 months = $9,600 — a meaningful head start on a deposit.',
        impact: {
          profileDelta: { savings: 8_500 },
          statsDelta: { happiness: -8, relationships: -5, careerCapital: 3 },
          monthlyExpenseDelta: -1_400,
        },
      },
      {
        id: 'nice-flat',
        label: 'Sign for a nicer flat — just you and one flatmate',
        sublabel: '$310/week each · more comfort, harder on budget',
        quality: 'moderate',
        consequence: 'The flat is great. Your own space, a good flatmate, a quiet street. But at $310/week, it consumes 55% of your take-home pay. Savings are nearly impossible. The lifestyle is comfortable but the financial foundation is shaky.',
        insight: 'Housing costs above 30% of take-home income are considered "housing stress." At $310/week on a minimum wage income, you\'re at ~55%. Every lifestyle upgrade has an opportunity cost — and rent never builds equity.',
        impact: {
          profileDelta: { savings: -1_600 },
          statsDelta: { happiness: 8, relationships: 5 },
          monthlyExpenseDelta: 400,
        },
      },
    ],
  },

  {
    id: 'kiwisaver-moment',
    round: 3,
    age: 19,
    yearsElapsed: 1,
    stage: 'foundation',
    category: 'money',
    title: 'The Form Nobody Explains',
    nzStat: 'KiwiSaver employer matching is an instant 100% return on your contribution. Most young NZers who opt out never realise what it costs them.',
    story: `First real job. You're on $22/hr — better than minimum wage, full-time.

HR sends a KiwiSaver form on your third day. "You have two weeks to opt out or you'll be automatically enrolled at 3%."

You Google it. It's a retirement savings scheme. Government-mandated. Your employer adds 3% on top of what you contribute. There's some government tax credit too. But retirement is 46 years away. Your flatmate opted out — she said she needs every cent right now.

The difference is $27 per fortnight from your pay.`,
    choices: [
      {
        id: 'kiwisaver-3',
        label: 'Opt in at 3% — the minimum',
        sublabel: '~$28/fortnight from your pay · employer adds same · govt adds $521/yr',
        quality: 'good',
        consequence: 'You tick the box. $28 disappears from your fortnight pay. Your employer adds another $28 on top — money you\'d never otherwise see. The government adds $521 in July. The balance starts growing. Slowly. Then faster.',
        insight: 'The employer 3% match is an instant 100% return — the best investment available to you. At 19, with 46 years of compound growth ahead, $28/fortnight becomes roughly $280,000 by retirement. That\'s the cost of a coffee a day.',
        impact: {
          profileDelta: { kiwisaverContributing: true, kiwisaverRate: 0.03 },
          statsDelta: { careerCapital: 2 },
        },
      },
      {
        id: 'kiwisaver-6',
        label: 'Opt in at 6% — do it properly',
        sublabel: '~$55/fortnight · tighter budget now · significantly more at 65',
        quality: 'good',
        consequence: 'You read that 6% is better and you commit. It\'s tight some weeks. But you adapt your spending rather than your savings rate. The compound effect over 46 years is dramatic.',
        insight: 'The difference between 3% and 6% employee contribution, compounded over 46 years, is roughly $140,000 at retirement. The sacrifice: $27 extra per fortnight in your 20s. This is the textbook definition of a good trade-off.',
        impact: {
          profileDelta: { kiwisaverContributing: true, kiwisaverRate: 0.06 },
          statsDelta: { careerCapital: 3, happiness: -3 },
        },
      },
      {
        id: 'kiwisaver-opt-out',
        label: 'Opt out — I need every cent right now',
        sublabel: 'Keep full pay · forfeit employer 3% match · forfeit govt tax credit',
        quality: 'risky',
        consequence: 'You keep the $28. Your flatmate gives you a thumbs up. The employer 3% match — money that would have been yours — disappears. The government tax credit disappears. The compound growth on both never starts.',
        insight: 'By opting out, you\'re turning down a 100% instant return on investment. The $28/fortnight you kept is worth roughly $280,000 less at retirement when you account for the missed employer match and compound growth. This is the single most expensive decision most young NZers make.',
        impact: {
          profileDelta: { kiwisaverContributing: false, savings: 650 },
          statsDelta: {},
        },
      },
    ],
  },

  {
    id: 'bnpl-trap',
    round: 4,
    age: 20,
    yearsElapsed: 1,
    stage: 'foundation',
    category: 'money',
    title: 'Four Easy Payments',
    nzStat: 'About 35% of NZ 18–24 year olds regularly use Buy Now Pay Later. Missing a BNPL payment triggers fees and — increasingly — credit reporting.',
    story: `Your laptop dies. Thursday night, assignment due Friday morning.

Harvey Norman has what you need: $1,100. Your bank account has $340.

Afterpay is right there at checkout: "4 payments of $275 — interest free!" Your flatmates both use it. "It's literally free money," one says. "You pay the same price either way."

Except you already have two other Afterpay plans running. Headphones ($180 left). Gym shoes ($90 left). You hadn't really thought about that.`,
    choices: [
      {
        id: 'bnpl',
        label: 'Use Afterpay — four fortnightly payments',
        sublabel: 'Technically free if on time · adds to existing BNPL obligations',
        quality: 'risky',
        consequence: 'You tap Afterpay. The laptop is yours. But you now have three simultaneous BNPL plans. You miss one payment — $10 fee. Then another. Then the next purchase gets approved anyway. The debt doesn\'t feel like debt. That\'s the design.',
        insight: 'BNPL is engineered to feel like spending, not borrowing. It won\'t appear on your credit report — until it does under new NZ regulations. The real risk isn\'t one purchase; it\'s normalising debt as a default payment method. Studies show BNPL users spend 15–20% more than they would with cash.',
        impact: {
          profileDelta: { bnplDebt: 1_100 },
          statsDelta: { happiness: 5 },
        },
      },
      {
        id: 'trademe-laptop',
        label: 'Buy a second-hand laptop on Trade Me — $380',
        sublabel: 'Cash only · good enough to get through · save the rest',
        quality: 'good',
        consequence: 'You find a usable i5 laptop for $380 delivered by Saturday. Your assignment gets an extension. The laptop isn\'t pretty but it works. You have $0 in BNPL debt and $0 in crisis. No interest, no fees, no vulnerability.',
        insight: 'The best financial tool is often the one you already own — or can buy second-hand. A $380 second-hand laptop vs $1,100 on credit is a $720 difference. That $720, invested now, is worth $14,000 in 35 years at 7% growth.',
        impact: {
          profileDelta: { savings: -380 },
          statsDelta: { happiness: -3, careerCapital: 2 },
        },
      },
      {
        id: 'borrow-and-save',
        label: 'Borrow a classmate\'s spare laptop, save up properly',
        sublabel: 'No debt · 6 weeks to save · buy new cash',
        quality: 'good',
        consequence: 'You ask. Your classmate says yes. The assignment is submitted. Over the next 6 weeks you save $1,100 in cash and buy the laptop you wanted — new, with warranty, zero debt.',
        insight: 'Asking for help is a financial skill. Delaying a purchase by 6 weeks to pay cash instead of borrowing costs you nothing and preserves your financial resilience. The ability to wait is one of the most powerful money skills you can develop in your 20s.',
        impact: {
          profileDelta: { savings: -1_100 },
          statsDelta: { happiness: 3, relationships: 5 },
        },
      },
    ],
  },

  {
    id: 'career-crossroads-1',
    round: 5,
    age: 21,
    yearsElapsed: 1,
    stage: 'foundation',
    category: 'career',
    title: 'The Offer',
    nzStat: 'Young NZers who switch employers in their early 20s earn 10–15% more on average than those who stay put.',
    story: `You've been in your job 18 months. You know the role cold. It's fine. Not exciting, not terrible. Just fine.

Then a recruiter reaches out — a Wellington startup, $6,000 less per year, but genuine mentorship, ownership of real projects, and share options that might be worth something one day. Or nothing.

Your current manager hears you're looking and calls you in. She offers a $3,500 raise to stay. Her eyes say she knows you're bored.

Two traps. One decision.`,
    choices: [
      {
        id: 'startup',
        label: 'Take the startup — $6,000 pay cut, significant upside',
        sublabel: 'High learning curve · Wellington move · real career acceleration',
        quality: 'good',
        consequence: 'You take it. The pay cut hurts for six months. But you\'re learning faster than ever — shipping things, presenting to customers, being challenged daily. In 18 months your career capital has compounded more than it would have in five years at the old job.',
        insight: 'In your early career, learning rate matters more than salary. A $6,000 pay cut for 2 years that accelerates your career by 3 years is overwhelmingly worth it. The highest earners at 35 are almost never those who optimised pay at 21.',
        impact: {
          profileDelta: { grossAnnualIncome: -6_000 },
          statsDelta: { careerCapital: 22, happiness: 12, relationships: -5 },
          setJobLevel: 'mid',
        },
      },
      {
        id: 'take-raise',
        label: 'Take the raise and stay — $3,500 more, stay comfortable',
        sublabel: 'No disruption · pay rise · but the boredom remains',
        quality: 'moderate',
        consequence: 'You stay. The extra $3,500 feels good for a month. Then the boredom returns. A year later, another recruiter calls. You realise you\'ve been comfortable and stagnant at the same time.',
        insight: 'Counter-offers are flattering, but they rarely fix the underlying problem. A $3,500 raise that keeps you in a stagnant role costs you far more in missed career capital over the following decade than the salary difference represents.',
        impact: {
          profileDelta: { grossAnnualIncome: 3_500 },
          statsDelta: { careerCapital: 5, happiness: -5 },
        },
      },
      {
        id: 'negotiate-startup',
        label: 'Negotiate with the startup — ask for market rate',
        sublabel: 'Ask for current salary · they might say yes · or withdraw',
        quality: 'good',
        consequence: 'You counter-offer: current salary, plus a review in 12 months. The startup hesitates, then agrees. You\'ve demonstrated that you understand your value — and that negotiation skill itself becomes career capital.',
        insight: 'Negotiation is a learnable skill — and most people never try. Research shows that people who negotiate their first salary earn $1 million more over a lifetime than those who accept the first offer. The startup scenario tests whether you advocate for yourself.',
        impact: {
          profileDelta: {},
          statsDelta: { careerCapital: 18, happiness: 14, relationships: -3 },
          setJobLevel: 'mid',
        },
      },
    ],
  },

  {
    id: 'health-habits',
    round: 6,
    age: 22,
    yearsElapsed: 1,
    stage: 'foundation',
    category: 'health',
    title: 'The Invisible Cost',
    nzStat: 'NZ youth (18–24) have the highest rates of sleep deprivation of any age group. Poor sleep is linked to 20% lower productivity and significantly higher health costs by age 40.',
    story: `You're 22 and technically fine. But "fine" is doing a lot of work there.

You haven't exercised properly since school sports. You sleep 5–6 hours most nights, stay up scrolling, and your diet is two-thirds UberEats and whatever's in the flat pantry. You're tired constantly, but you're young, so you write it off.

At 22, the costs are invisible. You can't see them accumulating. But they are — in your body, in your energy, in the decisions you make when you're exhausted.

The Dunedin Study (NZ's famous long-term health research) found that self-care habits formed in your early 20s strongly predict your health outcomes at 45. What you normalise now, you live with later.`,
    choices: [
      {
        id: 'gym-sleep',
        label: 'Fix it properly — gym membership + sleep routine',
        sublabel: '$55/month · takes 3 months to feel the difference',
        quality: 'good',
        consequence: 'You join a gym and commit to a sleep schedule. The first month is hard. By month three, the improvement is undeniable — you have more energy, better focus, and you\'re getting sick less. The $55/month is the best ROI of anything you\'re spending money on.',
        insight: 'Health is compound interest. $55/month in your 20s prevents $15,000+ in medical costs in your 40s. But more immediately: the productivity and cognitive improvements from regular exercise and sleep are measurable — research shows a 20–30% uplift in focus and decision quality.',
        impact: {
          profileDelta: { savings: -660 },
          statsDelta: { health: 16, happiness: 8, careerCapital: 5 },
          monthlyExpenseDelta: 55,
        },
      },
      {
        id: 'running',
        label: 'Start running — it\'s free',
        sublabel: 'Three mornings a week · no cost · real improvement',
        quality: 'good',
        consequence: 'You download a running app and start at 5am on Tuesdays, Thursdays, and Saturdays. It\'s miserable for a month. Then it\'s routine. Then it\'s something you actually miss when you skip it. Free, sustainable, and genuinely life-changing.',
        insight: 'The best fitness plan is the one you actually do. Free exercise done consistently beats expensive gym memberships that go unused. The social benefit — running clubs, outdoor community — is an underrated bonus.',
        impact: {
          profileDelta: {},
          statsDelta: { health: 12, happiness: 10, relationships: 4 },
        },
      },
      {
        id: 'nothing',
        label: 'You feel fine — sort it out when you\'re older',
        sublabel: 'No cost now · slow background decline',
        quality: 'risky',
        consequence: 'You tell yourself you\'ll fix it when life calms down. Life doesn\'t calm down. The habits calcify. By 35, they\'re not habits — they\'re identity. The costs start appearing in your energy levels, your sick days, and eventually your medical bills.',
        insight: 'The research is unambiguous: health habits formed in early adulthood are the strongest predictors of health outcomes in middle age. "I\'ll fix it later" is the most expensive lie we tell ourselves, because time is the variable that can\'t be recovered.',
        impact: {
          profileDelta: {},
          statsDelta: { health: -8, happiness: -3 },
        },
      },
    ],
  },

  {
    id: 'relationship-money',
    round: 7,
    age: 23,
    yearsElapsed: 1,
    stage: 'foundation',
    category: 'relationships',
    title: 'Their Debt, Your Life',
    nzStat: 'Financial incompatibility is the #2 reason NZ couples separate. Debt hidden at the start of a relationship is ranked the #1 financial betrayal by relationship counsellors.',
    story: `Two years together. Moving in makes total sense — emotionally, logistically, financially. You\'d save $700/month splitting costs.

Then you find out: $9,200 in credit card debt. Three different cards, minimum payments only. At 19.9% APR, the interest alone is $1,800/year.

They mention it casually, like it\'s just a number. You don\'t know whether to be worried about the money or the fact that they didn\'t tell you sooner.`,
    choices: [
      {
        id: 'move-in-ignore',
        label: 'Move in together — their debt is their problem',
        sublabel: 'Split costs · say nothing · financial tension builds',
        quality: 'moderate',
        consequence: 'You move in. Costs are down, life is good on the surface. But the debt conversation never happened. A year in, a joint expense comes up and the tension surfaces. The money conversation you avoided becomes the argument you can\'t.',
        insight: 'Money avoidance in relationships is extremely common — and extremely costly. Research by NZ relationship counsellors shows that couples who discuss finances openly in the first year have significantly lower separation rates than those who avoid the topic.',
        impact: {
          profileDelta: {},
          statsDelta: { happiness: 8, relationships: 3 },
          monthlyExpenseDelta: -700,
        },
      },
      {
        id: 'tackle-debt-together',
        label: 'Move in and tackle the debt together as a team',
        sublabel: 'Transparent conversation · combined financial attack · trust built',
        quality: 'good',
        consequence: 'You have the hard conversation. You agree: move in, pool resources for 12 months, annihilate the debt. It\'s tight. But 14 months later the debt is gone, you\'ve built something real together, and you know what you\'re working with.',
        insight: 'Addressing debt as a team — not as an accusation — is one of the highest-leverage relationship and financial moves available. The $9,200 cleared saves ~$1,800/year in interest. More importantly, it establishes that financial honesty is safe in your relationship.',
        impact: {
          profileDelta: { savings: -4_600 },
          statsDelta: { happiness: 10, relationships: 18 },
          monthlyExpenseDelta: -400,
        },
      },
      {
        id: 'stay-separate',
        label: 'Not ready — keep living separately for now',
        sublabel: 'Stay independent · full rent on your own · relationship tension',
        quality: 'moderate',
        consequence: 'You tell them you\'re not ready to move in yet. You don\'t fully explain why. The relationship continues but with a new undercurrent. You save no money on rent. The debt issue sits unresolved between you.',
        insight: 'Sometimes the right financial decision is the hard relational one. Protecting your financial position while you understand someone\'s money habits better is rational — not cold. The key is honesty about why.',
        impact: {
          profileDelta: {},
          statsDelta: { happiness: -5, relationships: -8 },
        },
      },
    ],
  },

  {
    id: 'emergency-fund-test',
    round: 8,
    age: 24,
    yearsElapsed: 1,
    stage: 'foundation',
    category: 'crisis',
    title: '$2,200 by Friday',
    nzStat: 'Only 38% of NZ adults have an emergency fund covering 3 months of expenses. For under-30s, the figure drops to 14%.',
    story: `Monday morning. Your car doesn't start.

The mechanic calls at 11am: "Timing belt's gone. Parts and labour — $2,200. Could have it done by Friday."

You need the car for work. There's no good public transport option. Without it, you lose shifts.

This is exactly the scenario every financial adviser warns about. The question isn't whether the emergency arrives — it always does. The question is whether past-you built a buffer for present-you.`,
    backgroundEvent: 'The car breaks down. $2,200 needed.',
    choices: [
      {
        id: 'pay-savings',
        label: 'Pay from savings — the emergency fund exists for this',
        sublabel: 'Savings depleted · but no new debt · back to zero and rebuilding',
        quality: 'good',
        consequence: 'You transfer $2,200. It hurts to watch the savings number drop. But there\'s no interest, no debt spiral, no payday lender. You\'re back to zero savings — but you\'re not in the hole. You rebuild from here.',
        insight: 'An emergency fund is not money that sits around doing nothing. It\'s insurance you pay yourself. The people who survive financial shocks are the ones who built the buffer before they needed it — not the ones who were smarter, but the ones who prepared.',
        impact: {
          profileDelta: { savings: -2_200 },
          statsDelta: { happiness: -8 },
        },
      },
      {
        id: 'credit-card',
        label: 'Put it on the credit card',
        sublabel: '19.9% APR · at minimum payments, costs $800 extra over 3 years',
        quality: 'risky',
        consequence: 'You tap the credit card. The car is fixed. But $2,200 at 19.9% APR, on minimum payments, takes nearly 3 years to clear and costs an extra $800 in interest. A $2,200 problem becomes a $3,000 problem in slow motion.',
        insight: 'Credit cards are the highest-cost borrowing most people have access to. At 19.9% APR, a $2,200 debt paid at minimums costs nearly 40% extra in interest. This is the textbook argument for having an emergency fund: it turns a $2,200 crisis into a $2,200 cost, not a $3,000 one.',
        impact: {
          profileDelta: { creditCardDebt: 2_200 },
          statsDelta: { happiness: -5 },
        },
      },
      {
        id: 'payday-loan',
        label: 'Payday loan — fast cash, sorted by tomorrow',
        sublabel: 'Effective APR ~400% · you repay $3,100 for a $2,200 loan',
        quality: 'risky',
        consequence: 'The money arrives in 24 hours. The car is fixed. Then the repayment terms land. The effective interest rate translates to repaying $3,100 over 90 days for a $2,200 loan. A $900 premium for urgency. The debt trap is real.',
        insight: 'Payday lenders in NZ charge effective APRs of 200–500%. A $2,200 loan for 90 days at these rates costs $700–$900 in fees and interest. This is why the Commerce Commission has repeatedly investigated the short-term lending industry — and why building an emergency fund is the single highest-priority financial habit for young adults.',
        impact: {
          profileDelta: { personalLoanBalance: 3_100 },
          statsDelta: { happiness: -12 },
        },
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // STAGE 2: THE BUILD (Ages 25–40, 1 round = 3 years)
  // ══════════════════════════════════════════════════════════════════════════

  {
    id: 'housing-decision',
    round: 9,
    age: 25,
    yearsElapsed: 3,
    stage: 'build',
    category: 'housing',
    title: 'The Deposit Math',
    nzStat: 'The average age of a first home buyer in Auckland is now 38. In Hamilton and Christchurch it\'s 32–34. The median NZ house price requires a $156,000 20% deposit.',
    story: `You're 25. Your friend just bought in Hamilton — a small three-bedroom for $680,000. You did the maths: at the median NZ price of $780,000, a standard 20% deposit is $156,000. You have $28,000 in savings and $11,000 in KiwiSaver.

The bank mentions the First Home Loan scheme through Kāinga Ora: you can buy with just 5% — roughly $39,000. You have $39,000. Barely.

But the mortgage would be $741,000. At 6.5%, that's around $4,700/month. Your take-home is $4,100/month.

This next three years determines whether you get on the property ladder — or watch it pull further away.`,
    choices: [
      {
        id: 'first-home-loan',
        label: 'Use the First Home Loan scheme — buy now at 5% deposit',
        sublabel: 'Mortgage: ~$741k · monthly payment: ~$4,700 · tight but in the game',
        quality: 'good',
        consequence: 'You buy. The mortgage payments are brutal — every month is tight. But three years later, at 4% annual appreciation, the house is worth $877,000. Your equity has grown from $39,000 to $175,000. The leverage worked.',
        insight: 'NZ property has historically compounded at 4–7% annually. A 5% deposit means leverage of 20:1 — meaning a 4% price rise translates to an 80% return on your deposit. The risk is real (rates rise, prices fall), but for most first home buyers, getting in beats waiting.',
        impact: {
          profileDelta: {
            hasProperty: true,
            propertyValue: 780_000,
            mortgageBalance: 741_000,
            propertyEquity: 39_000,
            savings: -39_000,
          },
          statsDelta: { happiness: 10, careerCapital: 3 },
        },
      },
      {
        id: 'save-for-20',
        label: 'Keep saving — aim for a proper 20% deposit in 5 years',
        sublabel: 'Disciplined saving · no property stress · but prices may keep rising',
        quality: 'moderate',
        consequence: 'You save aggressively — $1,500/month into a dedicated account. Three years in, you have $82,000 saved plus KiwiSaver growing. But house prices have risen 12% in three years. The target keeps moving.',
        insight: 'Saving for a larger deposit is the prudent path — but in a rising market, the gap can widen faster than you save. The real risk of waiting isn\'t just the higher price; it\'s that renting while saving means your money builds no equity. Both paths carry risk.',
        impact: {
          profileDelta: { savings: 54_000 },
          statsDelta: { happiness: -5, careerCapital: 5 },
          monthlyExpenseDelta: -1_500,
        },
      },
      {
        id: 'invest-not-buy',
        label: 'Keep renting + invest the savings in index funds',
        sublabel: 'No mortgage stress · portfolio grows · skip NZ property market',
        quality: 'moderate',
        consequence: 'You rent and invest. $1,200/month into a global index fund. At 7% returns, three years of compounding grows your portfolio to $47,000. You have no mortgage anxiety. You have no property equity either.',
        insight: 'Renting + investing is a legitimate alternative to buying — especially in overheated markets. The mathematical case depends on rental yield vs capital gain. In NZ\'s historically property-biased market, most long-term comparisons favour buying — but index fund investing has outperformed NZ housing in some periods. The key: if you don\'t buy, you must invest the difference.',
        impact: {
          profileDelta: { investmentBalance: 43_200 },
          statsDelta: { happiness: 5, careerCapital: 4 },
        },
      },
    ],
  },

  {
    id: 'career-peak',
    round: 10,
    age: 28,
    yearsElapsed: 3,
    stage: 'build',
    category: 'career',
    title: 'The Auckland Offer',
    nzStat: 'Auckland salaries are on average 18% higher than the rest of NZ — but Auckland living costs are 35% higher. The net financial advantage of moving is often less than expected.',
    story: `You're 28. A senior role in Auckland — $98,000 + benefits. Real responsibility. Career-defining, probably.

But you've built something in Hamilton. A flat, a community, a network. Auckland rent for a decent one-bedroom is $2,800/month. Your Hamilton rent is $1,350/month.

You run the numbers: the Auckland salary sounds transformative, but after the $1,450 extra monthly rent and higher transport and food costs, the real financial gain is $8,000–$12,000/year — less than you thought.

These next three years set your career trajectory for the decade ahead.`,
    choices: [
      {
        id: 'auckland-role',
        label: 'Take the Auckland role — $98,000',
        sublabel: 'Higher earnings · career acceleration · higher costs · fresh start',
        quality: 'good',
        consequence: 'You move. The first year is disorienting — new city, new network, expensive everything. By year two, the career capital you\'re building is undeniable. Your salary reviews to $108,000. Your resume is stronger. Auckland extracts its tax, but the career gains are real.',
        insight: 'Major cities extract a "lifestyle premium" in cost of living, but they also offer disproportionate career access. The financial win may be modest — but the career capital compounding over the following decade often makes it worthwhile. Network and visibility matter most in your late 20s.',
        impact: {
          profileDelta: { grossAnnualIncome: 98_000 },
          statsDelta: { careerCapital: 25, happiness: 5, relationships: -12 },
          monthlyExpenseDelta: 1_400,
          setJobLevel: 'senior',
        },
      },
      {
        id: 'stay-hamilton',
        label: 'Stay in Hamilton — negotiate a raise to $72,000',
        sublabel: 'Lower costs · community · career pace slows',
        quality: 'moderate',
        consequence: 'You push back and get $72,000 in Hamilton. Lower costs mean your net position is similar to Auckland — and you keep your community. But over three years, the career ceiling is evident. The roles available here are narrower.',
        insight: 'Regional NZ is underrated for quality of life and financial efficiency. The key trade-off is career breadth and network. Many NZers who stay regional find the financial position comparable — but career advancement and earnings growth taper out sooner.',
        impact: {
          profileDelta: { grossAnnualIncome: 72_000 },
          statsDelta: { careerCapital: 10, happiness: 10, relationships: 10 },
          setJobLevel: 'senior',
        },
      },
      {
        id: 'go-self-employed',
        label: 'Go self-employed — freelance consulting',
        sublabel: 'Variable $55k–$120k · no employer KiwiSaver match · full ownership',
        quality: 'risky',
        consequence: 'You go out alone. Year one is terrifying — $48,000 income, no safety net. Year two you hit $78,000. Year three, $102,000 with three clients. No employer KiwiSaver match. No sick leave. No annual leave. But complete ownership of your time and direction.',
        insight: 'Self-employment in NZ means you must manually contribute to KiwiSaver — no employer match unless you pay both sides. You\'re also responsible for your own tax (provisional tax quarters). The upside: uncapped income and career flexibility. The risk: income volatility in years 1–2 requires serious savings buffer.',
        impact: {
          profileDelta: { grossAnnualIncome: 75_000 },
          statsDelta: { careerCapital: 30, happiness: 15, health: -8 },
          setJobLevel: 'self-employed',
        },
      },
    ],
  },

  {
    id: 'family-timing',
    round: 11,
    age: 31,
    yearsElapsed: 3,
    stage: 'build',
    category: 'family',
    title: 'The Timing Question',
    nzStat: 'The average cost of raising a child in NZ to age 18 is approximately $300,000–$350,000. NZ paid parental leave is $661/week for 26 weeks — well below median salaries.',
    story: `You're 31. The question of children has moved from abstract to real.

If you're going to, the biology matters — and so does the money. NZ childcare costs $350–$450/week per child. Paid parental leave is $661/week for 26 weeks — well below most salaries. One of you will likely earn less for 3–5 years minimum.

But the Dunedin Study — NZ's own 50-year cohort research — consistently finds that relationships and family are the dominant predictor of life satisfaction in middle age and beyond. The money maths is harder; the meaning maths is different.

These three years will set the family trajectory for the next decade.`,
    choices: [
      {
        id: 'kids-now',
        label: 'Have children now',
        sublabel: 'Income drops · expenses rise $1,500+/month · meaning rises',
        quality: 'moderate',
        consequence: 'You have a child. The parental leave gap is real — you lose $2,000+/month for 6 months. Childcare at $400/week hits from month 7. Your savings slow dramatically. But something else happens too: a kind of purpose that reorients every decision you make.',
        insight: 'Children are the largest financial decision most people make — and unlike most financial decisions, the meaning dividend doesn\'t appear on a spreadsheet. The NZ government provides some support (Working for Families, Best Start payments), but the financial impact on the primary caregiver is significant and often underestimated.',
        impact: {
          profileDelta: { hasKids: true },
          statsDelta: { happiness: 12, relationships: 15, careerCapital: -5, health: -5 },
          monthlyExpenseDelta: 1_800,
        },
      },
      {
        id: 'kids-wait',
        label: 'Wait three more years — build a bigger financial buffer',
        sublabel: '3 more years of full income · KiwiSaver grows · financially stronger',
        quality: 'good',
        consequence: 'You wait. Three years of maximum savings and career growth. When you do have children, the financial buffer makes the transition significantly less stressful. You\'re also 34 — still well within healthy parameters, but the window is shorter.',
        insight: 'Timing matters for both biological and financial reasons. Three additional years of compounding KiwiSaver and savings, before the income disruption of parental leave, creates a meaningfully stronger foundation. The trade-off is the narrowing biological window.',
        impact: {
          profileDelta: { savings: 18_000 },
          statsDelta: { happiness: 3, careerCapital: 10 },
        },
      },
      {
        id: 'no-kids',
        label: 'Choose not to have children',
        sublabel: 'Maximum financial freedom · career autonomy · no less valid',
        quality: 'good',
        consequence: 'You make the deliberate choice not to have children. The financial freedom is real and significant — an estimated $300,000+ over 18 years redirected to other life goals. Your career trajectory and health are uninterrupted. Life takes different shape — not lesser, just different.',
        insight: 'Choosing not to have children is a completely valid life decision with significant financial implications. The $300,000+ in estimated child-rearing costs represents the largest single controllable financial variable in most adults\' lives. This choice requires no justification — it\'s a legitimate path to a flourishing life.',
        impact: {
          profileDelta: { savings: 12_000 },
          statsDelta: { careerCapital: 12, happiness: 5, health: 5 },
          monthlyExpenseDelta: -500,
        },
      },
    ],
  },

  {
    id: 'parent-in-need',
    round: 12,
    age: 34,
    yearsElapsed: 3,
    stage: 'build',
    category: 'family',
    title: 'The Phone Call',
    nzStat: 'Approximately 1 in 3 working-age NZers will provide informal care for a family member at some point in their career. Female caregivers lose an average of $324,000 in lifetime earnings.',
    story: `Your mum has a fall. Hip surgery needed. Recovery: 3 months minimum. She lives alone. Your siblings — one in Australia, one in London — can\'t come back right now.

The options: a private rest home ($900/week — her savings last 7 months), a home caregiver ($420/week), or you taking unpaid leave.

Your employer says they\'ll try to keep your role open. "Try."

She raised you. She\'d do it for you.`,
    choices: [
      {
        id: 'unpaid-leave',
        label: 'Take 3 months unpaid leave to care for her yourself',
        sublabel: 'Income loss: ~$18,000 · deep family bond · caregiver fatigue is real',
        quality: 'moderate',
        consequence: 'You take the leave. Three months of navigating doctors, physio, the slow recovery. It\'s exhausting and occasionally beautiful. You return to work to find your role has been "restructured." The financial cost is larger than expected. The relationship gain is harder to measure.',
        insight: 'Caregiving is one of NZ\'s largest invisible economic contributions — an estimated $10 billion/year in unpaid care. The financial cost to caregivers is real and disproportionately falls on women. Employer obligations during caregiver leave are limited under NZ law — checking your rights before taking unpaid leave is critical.',
        impact: {
          profileDelta: { savings: -18_000 },
          statsDelta: { happiness: 8, relationships: 22, health: -8, careerCapital: -8 },
        },
      },
      {
        id: 'hire-caregiver',
        label: 'Hire a private caregiver — $420/week for 13 weeks',
        sublabel: 'Cost: $5,460 · you stay working · visit on weekends',
        quality: 'good',
        consequence: 'You hire a caregiver and visit every weekend. Mum is well cared for. Your career continues. The $5,460 hurts but doesn\'t derail you. It\'s a sustainable solution that lets you be present without sacrificing everything.',
        insight: 'Professional caregiving exists precisely for this situation. Using it isn\'t abandonment — it\'s a recognition that your time has economic value, that professional carers are skilled, and that sustainable support beats unsustainable sacrifice. The question of contribution is one of financial planning, not love.',
        impact: {
          profileDelta: { savings: -5_460 },
          statsDelta: { happiness: 5, relationships: 12 },
        },
      },
      {
        id: 'coordinate-siblings',
        label: 'Coordinate siblings — share costs and care remotely',
        sublabel: 'Shared cost ~$1,800 each · family coordination · difficult dynamics',
        quality: 'moderate',
        consequence: 'You organise a family meeting. Each sibling contributes $1,800. Mum gets a part-time caregiver plus regular video calls. It\'s imperfect. There\'s conflict. But the cost is shared and no one person carries the whole weight.',
        insight: 'Sharing caregiving responsibilities across family is the textbook recommendation — but requires explicit conversation about money, time, and role division that most families avoid. The conflict that arises from these conversations is healthier than the resentment that builds when one sibling carries everything silently.',
        impact: {
          profileDelta: { savings: -1_800 },
          statsDelta: { happiness: 3, relationships: 10 },
        },
      },
    ],
  },

  {
    id: 'investment-decision',
    round: 13,
    age: 37,
    yearsElapsed: 3,
    stage: 'build',
    category: 'money',
    title: 'The $50,000 Question',
    nzStat: 'NZ retail investors lost an estimated $200M+ in crypto and meme stock speculation between 2020–2022. The FMA documented significant harm concentrated in 18–40 year old investors.',
    story: `You're 37. After years of discipline — paying down debt, saving consistently, staying the course — you have $50,000 sitting in a savings account earning 4.1% interest. Inflation is running at 3.6%.

Your money is barely keeping pace with prices. Something has to change.

Three colleagues gave you three completely different pieces of advice this week.

"Index funds — boring, but it works."
"Crypto. My brother made 3x in six months."
"The bank is safe. Don't overthink it."`,
    choices: [
      {
        id: 'index-funds',
        label: 'Index funds — globally diversified, long-term',
        sublabel: '~7% historical average · low fees · boring · it works',
        quality: 'good',
        consequence: 'You open an InvestNow account and put $50,000 into a global index fund. It goes up 12% in year one and you feel like a genius. Then down 18% in year two and you feel sick. You don\'t sell. Three years later you\'re up 23% — $11,500 — having done nothing.',
        insight: 'Index fund investing is the best-evidenced, lowest-cost, most accessible wealth-building tool available to ordinary investors. John Bogle\'s research showed that 80% of actively managed funds underperform simple index strategies over 10+ years. The key: time in market beats timing the market.',
        impact: {
          profileDelta: { investmentBalance: 61_500, savings: -50_000 },
          statsDelta: { careerCapital: 5 },
        },
      },
      {
        id: 'crypto',
        label: 'Crypto — your colleague doubled his money',
        sublabel: '50% chance: 2× · 50% chance: -60% · pure speculation',
        quality: 'risky',
        consequence: 'You invest $50,000 in crypto. For six months it\'s exhilarating — you\'re up 40%. Then a regulatory shift. A major exchange collapses. Eighteen months in, you\'re down 58% — $29,000 gone. You sell at a $21,000 loss to stop the bleeding.',
        insight: 'Crypto assets have historically exhibited volatility of 60–80% peak-to-trough. The FMA documented widespread harm to NZ retail investors in the 2021–2022 crypto correction. Speculation with money you can\'t afford to lose is gambling with different terminology. The colleague who doubled his money rarely mentions the people who invested after him.',
        impact: {
          profileDelta: { investmentBalance: 21_000, savings: -50_000 },
          statsDelta: { happiness: -18 },
        },
      },
      {
        id: 'bank',
        label: 'Leave it in the bank — 4.1% interest, it\'s safe',
        sublabel: 'Inflation is 3.6% · real return: 0.5% · losing purchasing power',
        quality: 'risky',
        consequence: 'Three years later, the nominal amount has grown to $56,300. But inflation over those three years has meant you can buy almost exactly the same amount with it as you could at the start. Your $50,000 has effectively stood still while the world moved forward.',
        insight: 'Cash in the bank is not a "safe" investment — it\'s a slow loss of purchasing power when inflation exceeds interest rates. The "safety" is nominal: the number goes up, but what it buys doesn\'t. Long-term wealth building requires returns that exceed inflation — which cash rarely provides over a decade.',
        impact: {
          profileDelta: { savings: 56_300 },
          statsDelta: {},
        },
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // STAGE 3: THE HARVEST (Ages 40–60, 1 round = 5 years)
  // ══════════════════════════════════════════════════════════════════════════

  {
    id: 'burnout',
    round: 14,
    age: 40,
    yearsElapsed: 5,
    stage: 'harvest',
    category: 'health',
    title: 'The Body Keeps the Score',
    nzStat: 'Burnout rates in NZ peaked post-2020. The Mental Health Foundation estimates that 1 in 5 NZ workers experiences burnout symptoms in any given year. The average cost of stress-related health conditions to NZ employers is $1.4B annually.',
    story: `You\'re 42. You\'re earning more than you ever imagined at 22. The career worked.

Your doctor mentions your blood pressure — "just watch it." Your resting heart rate is elevated. You haven\'t taken a proper holiday in three years. You work from your phone at dinner. You have excellent numbers and something that used to be called life is getting smaller.

The next five years will determine whether you arrive at 47 healthy and whole — or depleted.`,
    choices: [
      {
        id: 'sabbatical',
        label: 'Take a 6-month sabbatical — reset everything',
        sublabel: 'Income pause: ~$35,000 · health recovers · clarity returns',
        quality: 'good',
        consequence: 'Six months off. The first month you don\'t know what to do with yourself. By month three you sleep 8 hours and it feels revolutionary. You return with clarity about what you actually want the next 20 years to look like. The income loss stings; the recovery is worth considerably more.',
        insight: 'Research on high-performing careers shows that strategic rest — including extended sabbaticals — often accelerates long-term career outcomes rather than interrupting them. The executives who take sabbaticals in their 40s frequently report it as a career inflection point, not a derailment.',
        impact: {
          profileDelta: { savings: -35_000 },
          statsDelta: { health: 22, happiness: 20, relationships: 12 },
        },
      },
      {
        id: 'push-through',
        label: 'Push through — you can rest when you retire',
        sublabel: 'Keep earning · health slowly deteriorates · the bill arrives at 50',
        quality: 'risky',
        consequence: 'You keep going. The body adapts — or it seems to. Five years later you\'re 47, earning well, and your cardiologist is using words you have to look up. The deferred health cost is arriving with interest.',
        insight: '"I\'ll rest when I retire" is one of the most dangerous financial-life planning errors. Health, like compound interest, works on time. The longer you wait to recover, the more expensive the recovery — and some health capital, once depleted, cannot be rebuilt at any price.',
        impact: {
          profileDelta: {},
          statsDelta: { health: -20, happiness: -10, careerCapital: 5 },
        },
      },
      {
        id: 'career-change',
        label: 'Change careers — lower pay, more meaning',
        sublabel: '-$20,000/year · more purpose · health improves',
        quality: 'good',
        consequence: 'You take a role with a social enterprise — $20,000 less per year, but the work connects to something. Your blood pressure normalises. You sleep. The income drop is real; so is the quality of life gain.',
        insight: 'The research on happiness and income is clear: above a certain threshold (roughly $100,000–$120,000 in NZ), additional income has diminishing returns on wellbeing. Meaning and autonomy show no such ceiling. The most satisfied 50-year-olds are rarely those who maximised income — they\'re those who found aligned work.',
        impact: {
          profileDelta: { grossAnnualIncome: -20_000 },
          statsDelta: { health: 15, happiness: 22, relationships: 8, careerCapital: -3 },
        },
      },
    ],
  },

  {
    id: 'health-reckoning',
    round: 15,
    age: 45,
    yearsElapsed: 5,
    stage: 'harvest',
    category: 'health',
    title: 'The Scan Results',
    nzStat: 'The average NZ health insurance premium for a 45-year-old with comprehensive cover is $180–$250/month. The average out-of-pocket cost of cancer treatment without insurance is $35,000–$80,000.',
    story: `Routine check. Something showed up. It\'s caught early — the doctor is clear and calm about this. Early detection is the best possible scenario.

But treatment is needed. And treatment costs money.

If you have comprehensive insurance, most of this is covered. If you have basic insurance, some. If you have none — this is a $25,000–$40,000 decision on top of everything else.

Somewhere in your 20s and 30s, health decisions were made. Some were visible. Some weren\'t. Here is where the account is settled.`,
    backgroundEvent: 'A health issue is detected at a routine check. Treatment is required.',
    choices: [
      {
        id: 'full-treatment',
        label: 'Full treatment — immediate, comprehensive',
        sublabel: 'Cost: $0–$38,000 depending on insurance coverage from earlier choices',
        quality: 'good',
        consequence: 'You proceed with treatment without delay. The outcome is good — caught early, treated effectively. The financial cost depends entirely on decisions made 20 years ago about insurance. Either way, you prioritised your life over the cost.',
        insight: 'Health insurance is the one financial product that feels wasteful until it isn\'t. The difference between having comprehensive cover and having none at a moment like this can be $40,000 — or the difference between private specialist access and a 6-month public waiting list. The time to buy insurance is before the diagnosis.',
        impact: {
          profileDelta: { savings: -12_000 }, // variable; insurance reduces this
          statsDelta: { health: 20, happiness: 8 },
        },
      },
      {
        id: 'lifestyle-overhaul',
        label: 'Treatment plus a complete lifestyle overhaul',
        sublabel: '$4,000 in changes · full recovery focus · real commitment',
        quality: 'moderate',
        consequence: 'Treatment plus an honest reckoning with everything you\'ve been postponing: sleep, exercise, stress, diet. The lifestyle changes feel overwhelming for the first three months, then they feel like yours.',
        insight: 'Health scares are statistically one of the most reliable triggers for lasting behavioural change. The research on post-diagnosis lifestyle improvement shows significant impact on long-term outcomes — particularly for cardiovascular and metabolic conditions. The scare, terrible as it is, can be the catalyst.',
        impact: {
          profileDelta: { savings: -16_000 },
          statsDelta: { health: 25, happiness: 12, relationships: 8 },
          monthlyExpenseDelta: 120,
        },
      },
      {
        id: 'watch-and-wait',
        label: 'Watch and wait — monitor it, see how it goes',
        sublabel: 'No immediate cost · high-risk gamble · anxiety accumulates',
        quality: 'risky',
        consequence: 'You decide to monitor rather than act. Six months later the picture has changed and the treatment required is now significantly more complex. The delay that felt like caution was actually the most expensive decision you made.',
        insight: '"Watch and wait" is sometimes medically appropriate — and sometimes a rationalisation driven by cost avoidance or fear. In early-detection scenarios, delay typically increases both the clinical complexity and the financial cost of treatment. The cheapest intervention is almost always the early one.',
        impact: {
          profileDelta: { savings: -45_000 },
          statsDelta: { health: -25, happiness: -18 },
        },
      },
    ],
  },

  {
    id: 'inheritance',
    round: 16,
    age: 50,
    yearsElapsed: 5,
    stage: 'harvest',
    category: 'opportunity',
    title: 'The Inheritance',
    nzStat: 'The average NZ inheritance is $68,000. Research shows that inheritances received before 50 are significantly more likely to be invested than those received after 60, where recipients tend to be more conservative.',
    story: `Your father passes after a long illness. He was more careful with money than anyone knew — careful in quiet ways, without talking about it.

The estate is distributed. Your share: $45,000.

Everyone in the family has an opinion. Your partner says pay off the mortgage. Your friend says invest it. Your sibling used theirs on a holiday. You feel the weight of something given, and the question of what it means to use it well.`,
    choices: [
      {
        id: 'mortgage-or-kiwisaver',
        label: 'Reduce mortgage / top up KiwiSaver',
        sublabel: 'Security + compound growth in final working decade',
        quality: 'good',
        consequence: 'You split it: $25,000 off the mortgage and $20,000 into KiwiSaver as a lump sum. The mortgage reduction saves you $9,000 in interest over the remaining term. The KiwiSaver lump sum, with 15 years to compound at 6%, becomes $48,000 by retirement.',
        insight: 'In the decade before retirement, both debt reduction and KiwiSaver contributions have exceptionally high returns. Mortgage interest saved is a guaranteed return equal to your interest rate. KiwiSaver compound growth in the final decade is magnified because the balance is at its largest.',
        impact: {
          profileDelta: { mortgageBalance: -25_000, kiwisaverBalance: 20_000 },
          statsDelta: { happiness: 8 },
        },
      },
      {
        id: 'give-to-kids',
        label: 'Give $25,000 to your children / family',
        sublabel: 'Relationships matter · pass on the head start you didn\'t have',
        quality: 'good',
        consequence: 'You give $25,000 to your children — toward their education, their first car, the deposit they\'re working toward. You invest the remaining $20,000. The gift is impactful in ways you can\'t quantify. You keep enough to be financially meaningful.',
        insight: 'Intergenerational wealth transfer is one of the most powerful forces in financial inequality — and also in family bonds. Giving your children a meaningful head start when they need it most (20s and 30s) often delivers higher "return" in terms of household wellbeing than retaining the assets yourself in your 50s.',
        impact: {
          profileDelta: { investmentBalance: 20_000 },
          statsDelta: { happiness: 15, relationships: 22 },
        },
      },
      {
        id: 'experience',
        label: 'Use $15,000 for something meaningful — invest the rest',
        sublabel: 'Experience + investment · balance honour and growth',
        quality: 'moderate',
        consequence: 'You take the family to a place your father always talked about. $15,000 spent in two weeks — the most deliberately spent money of your life. The remaining $30,000 goes into index funds. The experience becomes a family story. The investment becomes a retirement foundation.',
        insight: 'Research on end-of-life regrets consistently shows experiences — particularly those shared with family — generate more lasting wellbeing than material or financial accumulation. Using a portion of an inheritance to mark it meaningfully, while investing the majority, is a financially and emotionally sound approach.',
        impact: {
          profileDelta: { investmentBalance: 30_000 },
          statsDelta: { happiness: 20, relationships: 18 },
        },
      },
    ],
  },

  {
    id: 'pre-retirement',
    round: 17,
    age: 55,
    yearsElapsed: 5,
    stage: 'harvest',
    category: 'retirement',
    title: 'The Final Push',
    nzStat: 'Every extra $1,000 contributed to KiwiSaver at age 55 is worth approximately $1,750 at 65 (6% growth over 10 years). At age 25, the same $1,000 grows to $10,500 — illustrating why time is the critical variable.',
    story: `You're 57. The KiwiSaver statement arrives.

The number is either reassuring or terrifying — probably both. Retirement is 8 years away. NZ Super is $496/week for a single person — enough to survive, not to live. The gap between Super and comfortable retirement is filled by KiwiSaver, property equity, and whatever else you\'ve built.

These next five years are the final compounding window. Contributions now arrive at retirement with a 8–10 year multiplier — less than the 40+ year multiplier at 19, but still significant.

What do you do with the final lap?`,
    choices: [
      {
        id: 'max-kiwisaver',
        label: 'Max out KiwiSaver — 8% contributions, cut lifestyle',
        sublabel: 'The final compounding push · meaningful retirement uplift',
        quality: 'good',
        consequence: 'You increase to 8%. Your take-home drops $400/month. But every dollar compounding for 8 years at 6% becomes $1.60 at retirement. The sacrifice is real; the retirement it funds is more secure.',
        insight: 'The final decade of KiwiSaver is when the balance is largest and growing fastest in absolute terms. A 5% vs 8% difference over 8 years, on a $200,000 balance, can represent $35,000–$50,000 additional at retirement. The lifestyle sacrifice in your late 50s buys real retirement security.',
        impact: {
          profileDelta: { kiwisaverRate: 0.08 },
          statsDelta: { happiness: -5, careerCapital: 3 },
          monthlyExpenseDelta: -400,
        },
      },
      {
        id: 'steady-state',
        label: 'Keep current rate — lifestyle unchanged',
        sublabel: 'Comfortable now · retirement adequacy depends on earlier choices',
        quality: 'moderate',
        consequence: 'You keep the course. The KiwiSaver balance grows at its current rate. Whether this is enough depends entirely on the cumulative choices of the previous 38 years. If you started KiwiSaver at 19, contributed consistently, and avoided major financial setbacks, you\'re probably fine. If not, this is the moment the earlier choices crystallise.',
        insight: 'Retirement adequacy is the final accounting of 40 years of decisions. For those who built the foundation early, steady-state contributions are often sufficient. For those who delayed or interrupted their KiwiSaver, the pre-retirement window is the last meaningful opportunity to course-correct.',
        impact: {
          profileDelta: {},
          statsDelta: { happiness: 3 },
        },
      },
      {
        id: 'semi-retire',
        label: 'Semi-retire now — drop to part-time',
        sublabel: 'Income halved · more freedom now · retirement slightly reduced',
        quality: 'moderate',
        consequence: 'You go part-time at 57. Income halves; so does the stress. You garden, travel in shoulder seasons, spend time with grandchildren. KiwiSaver contributions drop significantly. Retirement comes with less financial buffer — but you\'ve essentially started a gentle retirement 8 years early.',
        insight: 'Semi-retirement in your mid-to-late 50s can be a rational trade-off between financial and life capital. The research on "active retirement" shows that gradual transitions from full-time work have better health outcomes than abrupt retirement. The financial cost requires prior wealth building to sustain.',
        impact: {
          profileDelta: { grossAnnualIncome: -30_000 },
          statsDelta: { happiness: 22, health: 15, relationships: 12 },
        },
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // STAGE 4: THE LEGACY (Age 65 — Retirement Reveal)
  // ══════════════════════════════════════════════════════════════════════════

  {
    id: 'retirement-reveal',
    round: 18,
    age: 65,
    yearsElapsed: 5,  // compounds the final 5 years (age 60→65) before reveal
    stage: 'legacy',
    category: 'retirement',
    title: 'Age 65. You\'ve Arrived.',
    story: `This is it. The decisions compound into the life you now have.

NZ Super pays $496/week — $25,792 per year. Whatever gap exists between that and what you need is filled by everything you built, or not.

Look at what you have. Look at what you sacrificed. Look at the stats that money can\'t buy.

The most important question isn\'t whether you have enough money.
It\'s whether the life you built was worth the living.`,
    choices: [
      {
        id: 'reveal',
        label: 'See your life outcomes',
        sublabel: '',
        quality: 'good',
        consequence: '',
        insight: '',
        impact: { profileDelta: {}, statsDelta: {} },
      },
      {
        id: 'reveal-2',
        label: 'See your life outcomes',
        sublabel: '',
        quality: 'good',
        consequence: '',
        insight: '',
        impact: { profileDelta: {}, statsDelta: {} },
      },
      {
        id: 'reveal-3',
        label: 'See your life outcomes',
        sublabel: '',
        quality: 'good',
        consequence: '',
        insight: '',
        impact: { profileDelta: {}, statsDelta: {} },
      },
    ],
  },
]

// ─── Ending Archetypes ────────────────────────────────────────────────────────

export const LIFE_ENDINGS: LifeEnding[] = [
  {
    id: 'flourisher',
    title: 'The Flourisher',
    emoji: '🌟',
    description: 'You built it all — financial security, meaningful relationships, genuine health, and a career that was more than just a job. These don\'t arrive by accident.',
    reflection: 'The research on human flourishing consistently finds the same pattern: people who thrive in old age built habits — financial, physical, relational — in their 20s and 30s, when the compounding had the most time to work. You did that. You\'ll also understand, in a way that\'s hard to explain, that the outcome was never the goal. The life was the goal.',
    conditions: { minNetWorth: 300_000, minHappiness: 70, minHealth: 60, minRelationships: 65 },
  },
  {
    id: 'wealthy-but-empty',
    title: 'The Asset Rich',
    emoji: '💼',
    description: 'The financial numbers are excellent. The life numbers are harder to look at. You optimised for the wrong scoreboard for too long.',
    reflection: 'The Harvard Study of Adult Development — 85 years of research on human flourishing — found that wealth and achievement have almost no correlation with life satisfaction at 65. Relationships and health were the dominant predictors. You have the assets. The question that\'s probably already forming is what they were for.',
    conditions: { minNetWorth: 400_000, maxHappiness: 60 },
  },
  {
    id: 'happy-tradesperson',
    title: 'The Rich Enough',
    emoji: '☀️',
    description: 'The financial picture is comfortable rather than spectacular. The life picture is genuinely good. It turns out you knew what mattered.',
    reflection: 'Research consistently shows that income above roughly $120,000/year has diminishing returns on day-to-day happiness. Below a threshold of genuine financial security, money matters enormously. Above it, what you do with your time matters more. You found that line and lived well within it.',
    conditions: { minHappiness: 72, minRelationships: 68, minHealth: 60, maxNetWorth: 350_000 },
  },
  {
    id: 'rebuilder',
    title: 'The Rebuilder',
    emoji: '🔄',
    description: 'You went through something. Maybe more than one something. What\'s remarkable is that you\'re still standing — and that you learned things the flourishers never had to.',
    reflection: 'Post-traumatic growth is real and well-documented. People who face serious financial or personal setbacks and recover demonstrate greater resilience, empathy, and perspective than those who never faced serious adversity. The rebuild wasn\'t glamorous. The person it produced is worth knowing.',
    conditions: { minHappiness: 55, minRelationships: 55 },
  },
  {
    id: 'late-bloomer',
    title: 'The Late Bloomer',
    emoji: '🚀',
    description: 'The trajectory is more important than the position. At 65, you\'re still building — and what you\'re building on is solid.',
    reflection: 'Not every life peaks at 65. The late bloomer archetype — lower net worth, strong trajectory, high career capital — often represents the most interesting journeys. The choices made in the final working decade suggest that the next chapter will be as purposeful as the last.',
    conditions: { minCareerCapital: 65, minHappiness: 55, maxNetWorth: 250_000 },
  },
  {
    id: 'struggling',
    title: 'The Lesson Learned',
    emoji: '📉',
    description: 'The numbers are hard. Some of it was circumstance; some of it was choices. The most important question now is what you do with what you know.',
    reflection: 'Financial struggle in retirement is increasingly common in NZ — and it\'s rarely the result of single catastrophic decisions. It\'s usually the accumulation of small decisions across decades: the KiwiSaver opt-out at 19, the BNPL habit, the emergency fund that never got built. The lesson has a cost. It also has value — if it\'s shared.',
    conditions: {},
  },
]

/** Determine which ending archetype the player achieved */
export function determineEnding(profile: LifeProfile, stats: LifeStats): LifeEnding {
  const nw = computeNetWorth(profile)

  if (nw >= 300_000 && stats.happiness >= 70 && stats.health >= 60 && stats.relationships >= 65)
    return LIFE_ENDINGS.find(e => e.id === 'flourisher')!

  if (nw >= 400_000 && stats.happiness < 60)
    return LIFE_ENDINGS.find(e => e.id === 'wealthy-but-empty')!

  if (stats.happiness >= 72 && stats.relationships >= 68 && stats.health >= 60 && nw < 350_000)
    return LIFE_ENDINGS.find(e => e.id === 'happy-tradesperson')!

  if (stats.careerCapital >= 65 && stats.happiness >= 55 && nw < 250_000)
    return LIFE_ENDINGS.find(e => e.id === 'late-bloomer')!

  if (stats.happiness >= 55 && stats.relationships >= 55)
    return LIFE_ENDINGS.find(e => e.id === 'rebuilder')!

  return LIFE_ENDINGS.find(e => e.id === 'struggling')!
}

/** Get scenario by round number */
export function getScenarioByRound(round: number): LifeScenario | undefined {
  return GAME_OF_LIFE_SCENARIOS.find(s => s.round === round)
}

/** Get all scenarios for a given stage */
export function getScenariosByStage(stage: LifeStage): LifeScenario[] {
  return GAME_OF_LIFE_SCENARIOS.filter(s => s.stage === stage)
}

/** Format a dollar amount for display */
export function formatDollars(amount: number): string {
  const abs = Math.abs(amount)
  const sign = amount < 0 ? '-' : ''
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `${sign}$${Math.round(abs / 1_000)}k`
  return `${sign}$${Math.round(abs).toLocaleString()}`
}

/** Format a stat value with colour class */
export function statColour(value: number): string {
  if (value >= 75) return 'text-emerald-400'
  if (value >= 50) return 'text-sky-400'
  if (value >= 30) return 'text-amber-400'
  return 'text-rose-400'
}

/** Stage progress (0–1) within the overall game */
export function gameProgress(round: number): number {
  return (round - 1) / (GAME_OF_LIFE_SCENARIOS.length - 1)
}
