// ─── Credit Score Scenario Library ───────────────────────────────────────────
// Realistic credit score simulator with itemised expenses.
//
// CREDIT SCORE RULES (based on FICO model):
// - Payment History (35%): only changes when you make/miss a credit payment
// - Utilization (30%): auto-computed from cardBalance / cardLimit — NEVER in creditDelta
// - Age of Credit (15%): slowly improves each round, drops when new account opened
// - Credit Mix (10%): improves when opening a new TYPE of credit (loan, card, etc.)
// - New Inquiries (10%): drops when you apply for credit, slowly recovers over time
//
// WHAT DOES NOT AFFECT CREDIT SCORE:
// - Income changes, savings, spending habits, bank balances, employment, lifestyle

// ─── Types ───────────────────────────────────────────────────────────────────

export type CreditScenarioCategory = 'emergency' | 'lifestyle' | 'income' | 'debt' | 'opportunity'

export interface CreditBudgetProfile {
  // Income (monthly gross — named historically as "weekly" but treated as monthly throughout)
  monthlyPay: number
  // Fixed expenses (hard to change)
  rent: number
  utilities: number
  phone: number
  insurance: number
  // Variable expenses (easier to adjust)
  groceries: number
  transport: number
  entertainment: number
  diningOut: number
  subscriptions: number
  repaymentPlan: number
  // Credit card minimum payment (calculated from balance)
  cardPayment: number
  // Financial position
  emergencyFund: number
  goalSavings: number
  // % of monthly surplus allocated to emergency fund (rest to goal savings)
  emergencySplitPercent: number
  // False until player chooses banker split policy
  savingsSplitConfigured: boolean
  cardBalance: number
  cardLimit: number
}

export interface CreditFactors {
  paymentHistory: number
  utilization: number
  ageOfCredit: number
  creditMix: number
  newInquiries: number
}

export interface CreditChoiceImpact {
  budgetDelta: Partial<CreditBudgetProfile>
  creditDelta: Partial<CreditFactors>
}

export interface CreditScenarioChoice {
  id: string
  label: string
  quality: 'good' | 'moderate' | 'risky'
  consequence: string
  creditNote: string // explains WHY credit was/wasn't affected
  impact: CreditChoiceImpact
}

export interface CreditScenario {
  id: string
  title: string
  category: CreditScenarioCategory
  story: string
  /** Optional NZQA standard mapping badges shown in UI */
  nzqaStandards?: string[]
  /** Crisis scenarios are guaranteed to appear — at least 3 per game */
  mandatory?: boolean
  /** Only appears in specific difficulty modes */
  difficulty?: 'easy' | 'hard'
  choices: [CreditScenarioChoice, CreditScenarioChoice, CreditScenarioChoice]
}

export interface CreditHistoryEntry {
  round: number
  scenarioId: string
  scenarioTitle: string
  category: CreditScenarioCategory
  choiceId: string
  choiceLabel: string
  choiceQuality: 'good' | 'moderate' | 'risky'
  consequence: string
  creditNote: string
  scoreBefore: number
  scoreAfter: number
  scoreDelta: number
  budgetBefore: CreditBudgetProfile
  budgetAfter: CreditBudgetProfile
}

export type PresetKey = 'student' | 'young-professional' | 'part-time'

export interface ProfilePreset {
  key: PresetKey
  label: string
  description: string
  profile: CreditBudgetProfile
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Calculate minimum credit card payment (2.5% of balance or $25, whichever is higher)
 */
export function calculateCardPayment(cardBalance: number): number {
  if (cardBalance <= 0) return 0
  return Math.max(25, Math.round(cardBalance * 0.025))
}

export function totalExpenses(p: CreditBudgetProfile): number {
  return p.rent + p.groceries + p.transport + p.utilities + p.phone + p.insurance + p.entertainment + p.diningOut + p.subscriptions + p.repaymentPlan + p.cardPayment
}

export function totalSavings(p: CreditBudgetProfile): number {
  return p.emergencyFund + p.goalSavings
}

export interface MonthlyDeductionBreakdown {
  grossMonthly: number
  payeMonthly: number
  accMonthly: number
  netMonthly: number
}

const NZ_TAX_BRACKETS = [
  { upTo: 15600, rate: 0.105 },
  { upTo: 53500, rate: 0.175 },
  { upTo: 78100, rate: 0.3 },
  { upTo: 180000, rate: 0.33 },
  { upTo: Number.POSITIVE_INFINITY, rate: 0.39 },
] as const

const ACC_EARNERS_LEVY_RATE = 0.016
const ACC_MAX_EARNINGS = 142283

function computeAnnualPaye(grossAnnual: number): number {
  let remaining = Math.max(0, grossAnnual)
  let lowerBound = 0
  let tax = 0
  for (const bracket of NZ_TAX_BRACKETS) {
    if (remaining <= 0) break
    const bandWidth = Math.max(0, bracket.upTo - lowerBound)
    const taxableInBand = Math.min(remaining, bandWidth)
    tax += taxableInBand * bracket.rate
    remaining -= taxableInBand
    lowerBound = bracket.upTo
  }
  return Math.round(tax)
}

export function monthlyDeductionBreakdown(grossMonthly: number): MonthlyDeductionBreakdown {
  const gross = Math.max(0, grossMonthly)
  const annualGross = gross * 12
  const payeAnnual = computeAnnualPaye(annualGross)
  const accAnnualBase = Math.min(annualGross, ACC_MAX_EARNINGS)
  const accAnnual = Math.round(accAnnualBase * ACC_EARNERS_LEVY_RATE)
  const payeMonthly = Math.round(payeAnnual / 12)
  const accMonthly = Math.round(accAnnual / 12)
  const netMonthly = Math.max(0, gross - payeMonthly - accMonthly)
  return {
    grossMonthly: gross,
    payeMonthly,
    accMonthly,
    netMonthly,
  }
}

export function monthlyTakeHome(p: CreditBudgetProfile): number {
  return monthlyDeductionBreakdown(p.monthlyPay).netMonthly
}

export function monthlyNet(p: CreditBudgetProfile): number {
  return monthlyTakeHome(p) - totalExpenses(p)
}

// ─── Profile Presets ─────────────────────────────────────────────────────────

export const PROFILE_PRESETS: ProfilePreset[] = [
  {
    key: 'student',
    label: 'University Student',
    description: 'Studying full-time, casual work on weekends (~16hrs/mo), shared house',
    // Gross Monthly income.
    // Approx net after PAYE + ACC is used in the game cashflow.
    profile: {
      monthlyPay: 1920,
      rent: 720,
      groceries: 240,
      transport: 100,
      utilities: 72,
      phone: 60,
      insurance: 0, // no car, on parents' health insurance
      entertainment: 80,
      diningOut: 80,
      subscriptions: 48,
      repaymentPlan: 0,
      cardPayment: 38, // min payment on $1500 balance
      emergencyFund: 0,
      goalSavings: 200,
      emergencySplitPercent: 30,
      savingsSplitConfigured: false,
      cardBalance: 1500,
      cardLimit: 2500,
    },
  },
  {
    key: 'part-time',
    label: 'Part-Time Worker',
    description: 'Part-time retail/hospitality (~28hrs/mo), living with housemates',
    // Gross Monthly income.
    profile: {
      monthlyPay: 3080,
      rent: 1040,
      groceries: 320,
      transport: 160,
      utilities: 120,
      phone: 72,
      insurance: 140,
      entertainment: 100,
      diningOut: 120,
      subscriptions: 60,
      repaymentPlan: 0,
      cardPayment: 50, // min payment on $2000 balance
      emergencyFund: 0,
      goalSavings: 400,
      emergencySplitPercent: 30,
      savingsSplitConfigured: false,
      cardBalance: 2000,
      cardLimit: 3500,
    },
  },
  {
    key: 'young-professional',
    label: 'Young Professional',
    description: 'Full-time salary (gross pay), renting solo, building career',
    // Gross Monthly income.
    profile: {
      monthlyPay: 5200,
      rent: 1920,
      groceries: 440,
      transport: 240,
      utilities: 180,
      phone: 80,
      insurance: 220,
      entertainment: 140,
      diningOut: 200,
      subscriptions: 100,
      repaymentPlan: 0,
      cardPayment: 70, // min payment on $2800 balance
      emergencyFund: 0,
      goalSavings: 800,
      emergencySplitPercent: 30,
      savingsSplitConfigured: false,
      cardBalance: 2800,
      cardLimit: 6000,
    },
  },
]

// ─── Category Metadata ───────────────────────────────────────────────────────

export const CATEGORY_LABELS: Record<CreditScenarioCategory, string> = {
  emergency: 'Emergency',
  lifestyle: 'Lifestyle',
  income: 'Income Change',
  debt: 'Debt Management',
  opportunity: 'Opportunity',
}

export const CATEGORY_ICONS: Record<CreditScenarioCategory, string> = {
  emergency: '🚨',
  lifestyle: '🛍️',
  income: '💰',
  debt: '💳',
  opportunity: '🎯',
}

// ─── Expense field labels (for display) ──────────────────────────────────────

export const EXPENSE_LABELS: Record<string, string> = {
  monthlyPay: 'Gross Income',
  rent: 'Rent / Housing',
  groceries: 'Groceries',
  transport: 'Transport',
  utilities: 'Utilities & Bills',
  phone: 'Phone / Internet',
  insurance: 'Insurance',
  entertainment: 'Entertainment',
  diningOut: 'Dining Out',
  subscriptions: 'Subscriptions',
  repaymentPlan: 'Repayment Plan',
  cardPayment: 'Credit Card Payment',
  emergencyFund: 'Emergency Fund',
  goalSavings: 'Goal Savings',
  emergencySplitPercent: 'Emergency Split %',
  cardBalance: 'Card Balance',
  cardLimit: 'Card Limit',
}

// ─── Scenario Library (18 scenarios) ─────────────────────────────────────────
// creditDelta rules:
// - NEVER include `utilization` — it is auto-computed from cardBalance/cardLimit
// - paymentHistory: only when explicitly making/missing a credit payment
// - newInquiries: only when applying for new credit
// - creditMix: only when opening a new TYPE of credit account
// - ageOfCredit: only when opening a new account (negative)

export const CREDIT_SCENARIOS: CreditScenario[] = [
  {
    id: 'banker-savings-split',
    title: 'Banker Advice: Split Your Savings',
    category: 'debt',
    mandatory: true,
    nzqaStandards: ['US 28104', 'US 28100'],
    story: 'Your bank adviser suggests splitting monthly surplus between emergency cash and your long-term savings target. Choose your split.',
    choices: [
      {
        id: 'split-20-80',
        label: '20% emergency / 80% goal',
        quality: 'good',
        consequence: 'Strong progress toward your $2,000 goal while still building a basic emergency buffer.',
        creditNote: 'No direct credit impact. Better savings structure lowers future debt pressure.',
        impact: { budgetDelta: { emergencySplitPercent: 20, savingsSplitConfigured: true }, creditDelta: {} },
      },
      {
        id: 'split-50-50',
        label: '50% emergency / 50% goal',
        quality: 'moderate',
        consequence: 'Balanced approach. You protect against shocks, but goal progress is slower.',
        creditNote: 'No direct credit impact. This is a risk/goal trade-off decision.',
        impact: { budgetDelta: { emergencySplitPercent: 50, savingsSplitConfigured: true }, creditDelta: {} },
      },
      {
        id: 'split-80-20',
        label: '80% emergency / 20% goal',
        quality: 'risky',
        consequence: 'Very safe buffer, but long-term goal progress can lag behind target rounds.',
        creditNote: 'No direct credit impact. Overweighting emergency can delay planned purchases.',
        impact: { budgetDelta: { emergencySplitPercent: 80, savingsSplitConfigured: true }, creditDelta: {} },
      },
    ],
  },
  {
    id: 'health-insurance-decision',
    title: 'Health Insurance Setup',
    category: 'emergency',
    mandatory: true,
    nzqaStandards: ['US 28104', 'US 28100'],
    story: 'Before the year starts, choose your health cover strategy. This changes what you pay now, and what you pay if you need treatment later.',
    choices: [
      {
        id: 'health-insurance-basic',
        label: 'Buy basic health cover (+$22/mo premium)',
        quality: 'good',
        consequence: 'You add a modest Monthly premium and reduce future treatment costs if something happens.',
        creditNote: 'Insurance premiums do not directly build credit score, but risk protection helps avoid forced debt when emergencies happen.',
        impact: { budgetDelta: { insurance: 22 }, creditDelta: {} },
      },
      {
        id: 'health-insurance-comprehensive',
        label: 'Buy comprehensive cover (+$38/mo premium)',
        quality: 'moderate',
        consequence: 'You get stronger coverage with a higher Monthly premium, reducing cashflow flexibility.',
        creditNote: 'No direct credit impact. The trade-off is higher fixed costs versus stronger risk protection.',
        impact: { budgetDelta: { insurance: 38 }, creditDelta: {} },
      },
      {
        id: 'health-insurance-none',
        label: 'Skip health insurance for now',
        quality: 'risky',
        consequence: 'No premium now, but any health event will likely hit savings or card debt harder.',
        creditNote: 'No immediate credit impact, but uninsured shocks can push utilization and missed-payment risk higher.',
        impact: { budgetDelta: {}, creditDelta: {} },
      },
    ],
  },
  {
    id: 'investment-pathways',
    title: 'Investment Pathways',
    category: 'opportunity',
    mandatory: true,
    nzqaStandards: ['US 28101', 'US 28100'],
    story: 'You have $300 available to put toward a long-term goal. Choose one investment option. Its value will update each round.',
    choices: [
      {
        id: 'invest-shares',
        label: 'Shares fund (higher risk, higher expected return)',
        quality: 'moderate',
        consequence: 'You invest $300 into shares. Returns can swing both up and down.',
        creditNote: 'Investment choice has no direct credit file effect. Indirectly, poor liquidity can increase debt risk.',
        impact: { budgetDelta: { emergencyFund: -300 }, creditDelta: {} },
      },
      {
        id: 'invest-kiwisaver',
        label: 'KiwiSaver growth fund (medium risk)',
        quality: 'good',
        consequence: 'You invest $300 into a KiwiSaver-style growth option with steadier long-term performance.',
        creditNote: 'No direct credit effect. This supports long-term planning and diversification outcomes.',
        impact: { budgetDelta: { emergencyFund: -300 }, creditDelta: {} },
      },
      {
        id: 'invest-term-pie',
        label: 'Term PIE / cash fund (low risk, low return)',
        quality: 'good',
        consequence: 'You invest $300 in a low-volatility option with smaller but steadier gains.',
        creditNote: 'No direct credit effect. Lower volatility protects liquidity but grows wealth slower.',
        impact: { budgetDelta: { emergencyFund: -300 }, creditDelta: {} },
      },
    ],
  },
  // ── EMERGENCY (4) ──────────────────────────────────────────────────────────
  {
    id: 'broken-laptop',
    title: 'Broken Laptop',
    category: 'emergency',
    story: 'Your laptop dies right before assessments. You need a replacement this week — a decent one costs around $450.',
    choices: [
      {
        id: 'emergency-fund',
        label: 'Pay from emergency fund',
        quality: 'good',
        consequence: 'No new debt. Emergency fund drops but all payments stay on time.',
        creditNote: 'No credit impact. Paying cash/savings does not appear on your credit report.',
        impact: { budgetDelta: { emergencyFund: -450 }, creditDelta: {} },
      },
      {
        id: 'split-card-savings',
        label: 'Split between card ($250) and savings ($200)',
        quality: 'moderate',
        consequence: 'Some new card debt. Your card balance goes up, increasing your utilization ratio.',
        creditNote: 'Higher card balance increases your utilization ratio, which is 30% of your score.',
        impact: { budgetDelta: { emergencyFund: -200, cardBalance: 250 }, creditDelta: {} },
      },
      {
        id: 'full-on-card',
        label: 'Put the whole $450 on credit card',
        quality: 'risky',
        consequence: 'Card balance jumps. The higher minimum payment means you struggle and miss next month\'s payment.',
        creditNote: 'Missed payment reported after 30 days — this is the #1 factor in your credit score (35%).',
        impact: { budgetDelta: { cardBalance: 480 }, creditDelta: { paymentHistory: -0.12 } },
      },
    ],
  },
  {
    id: 'medical-bill',
    title: 'Medical Bill Shock',
    category: 'emergency',
    story: 'An unexpected medical bill for $380 arrives. Payment is due in 10 days — no extensions available.',
    choices: [
      {
        id: 'payment-plan',
        label: 'Negotiate a payment plan ($50/mo for 8 weeks)',
        quality: 'good',
        consequence: 'Spread the cost over time with a dedicated repayment line in your Monthly budget.',
        creditNote: 'Medical payment plans usually don\'t involve a credit check or appear on your credit report.',
        impact: { budgetDelta: { repaymentPlan: 50 }, creditDelta: {} },
      },
      {
        id: 'pay-from-savings',
        label: 'Pay the full amount from emergency fund',
        quality: 'moderate',
        consequence: 'Bill cleared immediately. Emergency fund takes a big hit.',
        creditNote: 'No credit impact. Paying from your bank account is invisible to credit bureaus.',
        impact: { budgetDelta: { emergencyFund: -380 }, creditDelta: {} },
      },
      {
        id: 'miss-card-payment',
        label: 'Pay the bill but skip this month\'s credit card payment',
        quality: 'risky',
        consequence: 'Medical bill paid, but your credit card payment goes 30+ days overdue.',
        creditNote: 'A single 30-day late payment can drop your score by 60-110 points. It stays on your report for 7 years.',
        impact: { budgetDelta: { emergencyFund: -300 }, creditDelta: { paymentHistory: -0.18 } },
      },
    ],
  },
  {
    id: 'car-breakdown',
    title: 'Car Breakdown',
    category: 'emergency',
    story: 'Your car needs urgent repairs — $600 for parts and labour. Without it you can\'t get to work.',
    choices: [
      {
        id: 'bus-and-save',
        label: 'Take the bus for 2 weeks while you save up for repairs',
        quality: 'good',
        consequence: 'Inconvenient commute but no new debt. Transport costs go up temporarily.',
        creditNote: 'No credit impact. Catching the bus doesn\'t show up on your credit report!',
        impact: { budgetDelta: { transport: 25, entertainment: -20, emergencyFund: -200 }, creditDelta: {} },
      },
      {
        id: 'mechanic-finance',
        label: 'Use the mechanic\'s interest-free payment plan (credit check required)',
        quality: 'moderate',
        consequence: 'Car fixed now. New fixed cost of $75/mo for 8 weeks. A hard inquiry hits your credit.',
        creditNote: 'Applying for finance triggers a hard inquiry (affects 10% of score). Adding a new credit type can help credit mix.',
        impact: { budgetDelta: { transport: 75 }, creditDelta: { newInquiries: -0.06, creditMix: 0.04 } },
      },
      {
        id: 'personal-loan',
        label: 'Take out a personal loan for the full $600',
        quality: 'risky',
        consequence: 'Quick fix but a hard inquiry plus new monthly repayment of $50/mo.',
        creditNote: 'Personal loan application = hard inquiry. Multiple credit applications in a short time look risky to lenders.',
        impact: { budgetDelta: { transport: 50 }, creditDelta: { newInquiries: -0.12, creditMix: 0.04, ageOfCredit: -0.03 } },
      },
    ],
  },
  {
    id: 'phone-replacement',
    title: 'Phone Screen Shattered',
    category: 'emergency',
    story: 'You drop your phone and the screen shatters. Repair costs $180, or a new phone on a plan is $20/mo for 24 months.',
    choices: [
      {
        id: 'repair-cash',
        label: 'Pay $180 for the screen repair from savings',
        quality: 'good',
        consequence: 'Cheapest option. Small hit to emergency fund, phone works fine.',
        creditNote: 'No credit impact. Cash/savings transactions are invisible to credit bureaus.',
        impact: { budgetDelta: { emergencyFund: -180 }, creditDelta: {} },
      },
      {
        id: 'new-phone-card',
        label: 'Buy a new phone — put $350 on credit card',
        quality: 'moderate',
        consequence: 'Nicer phone but card balance goes up. Utilization ratio increases.',
        creditNote: 'Higher card balance means higher utilization ratio. Keep it under 30% of your limit.',
        impact: { budgetDelta: { cardBalance: 350 }, creditDelta: {} },
      },
      {
        id: 'phone-plan',
        label: 'Sign up for a 24-month phone plan (credit check required)',
        quality: 'risky',
        consequence: 'No upfront cost but locked into $20/mo payments and a hard credit inquiry.',
        creditNote: 'Phone plan applications trigger a hard inquiry. Missing plan payments gets reported to credit bureaus.',
        impact: { budgetDelta: { phone: 20 }, creditDelta: { newInquiries: -0.08, ageOfCredit: -0.02 } },
      },
    ],
  },

  // ── LIFESTYLE (4) ──────────────────────────────────────────────────────────
  {
    id: 'subscription-creep',
    title: 'Subscription Creep',
    category: 'lifestyle',
    story: 'You realise you\'re paying $60/mo on subscriptions — 4 streaming services, a gym, and a meal kit box. Do you need all of them?',
    choices: [
      {
        id: 'audit-and-cut',
        label: 'Cancel three subscriptions and use savings to pay down $200 off your card',
        quality: 'good',
        consequence: 'You free up $35/mo AND reduce your card balance. Double win for your budget.',
        creditNote: 'Cancelling subscriptions doesn\'t affect credit. But paying down your card lowers your utilization ratio — that\'s 30% of your score.',
        impact: { budgetDelta: { subscriptions: -35, cardBalance: -200 }, creditDelta: {} },
      },
      {
        id: 'cut-one',
        label: 'Cancel the one you barely use',
        quality: 'moderate',
        consequence: 'You save $12/mo. Small improvement.',
        creditNote: 'No credit impact. Subscription changes are invisible to credit bureaus.',
        impact: { budgetDelta: { subscriptions: -12 }, creditDelta: {} },
      },
      {
        id: 'keep-all',
        label: 'Keep everything — FOMO is real',
        quality: 'risky',
        consequence: 'Budget stays tight. You end up unable to make your card minimum payment this month.',
        creditNote: 'The subscriptions themselves don\'t affect credit. But the missed card payment does — that\'s the #1 credit factor.',
        impact: { budgetDelta: {}, creditDelta: { paymentHistory: -0.10 } },
      },
    ],
  },
  {
    id: 'gym-membership',
    title: 'Premium Gym Offer',
    category: 'lifestyle',
    story: 'A premium gym offers you a 12-month contract at $55/mo (normally $70). You currently pay $20/mo at a basic gym.',
    choices: [
      {
        id: 'stay-basic',
        label: 'Keep your basic gym — redirect the difference to savings',
        quality: 'good',
        consequence: 'Budget unchanged. Emergency fund grows by $60.',
        creditNote: 'No credit impact. Gym memberships don\'t appear on credit reports.',
        impact: { budgetDelta: { emergencyFund: 60 }, creditDelta: {} },
      },
      {
        id: 'upgrade-cut-dining',
        label: 'Upgrade but cut dining out to compensate',
        quality: 'moderate',
        consequence: 'Net spending stays similar — $35/mo more on gym, $30/mo less on dining.',
        creditNote: 'No credit impact. Neither gym fees nor restaurant spending affect your credit score.',
        impact: { budgetDelta: { entertainment: 35, diningOut: -30 }, creditDelta: {} },
      },
      {
        id: 'upgrade-on-card',
        label: 'Sign up — put the $200 joining fee on credit card',
        quality: 'risky',
        consequence: 'Higher Monthly cost plus a lump sum on your card. Budget gets very tight.',
        creditNote: 'The joining fee increases your card balance, raising your utilization ratio.',
        impact: { budgetDelta: { entertainment: 35, cardBalance: 200 }, creditDelta: {} },
      },
    ],
  },
  {
    id: 'wardrobe-refresh',
    title: 'Wardrobe Refresh',
    category: 'lifestyle',
    story: 'Your work clothes are looking worn. A decent refresh would cost around $300.',
    choices: [
      {
        id: 'thrift-shops',
        label: 'Buy key pieces from op-shops for $80 cash',
        quality: 'good',
        consequence: 'Smart and affordable. Small hit to savings, you look presentable.',
        creditNote: 'No credit impact. Cash purchases are invisible to credit bureaus.',
        impact: { budgetDelta: { emergencyFund: -80 }, creditDelta: {} },
      },
      {
        id: 'moderate-shop',
        label: 'Spend $180 — half savings, half credit card',
        quality: 'moderate',
        consequence: 'Decent upgrade. Card balance goes up slightly.',
        creditNote: 'The $90 on your card increases your utilization ratio slightly.',
        impact: { budgetDelta: { emergencyFund: -90, cardBalance: 90 }, creditDelta: {} },
      },
      {
        id: 'full-on-card',
        label: 'Full $300 shopping spree on credit card',
        quality: 'risky',
        consequence: 'Looking great but card balance balloons. You can barely cover the minimum payment.',
        creditNote: 'Large card balance increase pushes utilization higher. If you miss the minimum payment, it gets worse.',
        impact: { budgetDelta: { cardBalance: 300 }, creditDelta: { paymentHistory: -0.05 } },
      },
    ],
  },
  {
    id: 'dining-habits',
    title: 'Eating Out Too Much',
    category: 'lifestyle',
    story: 'You\'ve been spending $80/mo on dining out and takeaway. Cooking at home would cost about $20/mo for the same meals.',
    choices: [
      {
        id: 'meal-prep',
        label: 'Switch to meal prep — use the $60/mo savings to pay down your card',
        quality: 'good',
        consequence: 'Big budget win. Dining out drops AND card balance reduces by $240 over a month.',
        creditNote: 'Eating at home doesn\'t affect credit. But using saved money to pay down your card reduces utilization — that\'s what improves your score.',
        impact: { budgetDelta: { diningOut: -60, cardBalance: -240 }, creditDelta: {} },
      },
      {
        id: 'reduce-half',
        label: 'Cut back to eating out twice a week',
        quality: 'moderate',
        consequence: 'You save about $30/mo. Nice improvement to your budget.',
        creditNote: 'No credit impact. How much you eat out is invisible to credit bureaus.',
        impact: { budgetDelta: { diningOut: -30 }, creditDelta: {} },
      },
      {
        id: 'keep-eating-out',
        label: 'Keep your habits — food is your joy',
        quality: 'risky',
        consequence: 'No savings. You can\'t cover your card minimum this month.',
        creditNote: 'Eating out doesn\'t hurt credit. But not being able to pay your card bill does — missed payments are devastating.',
        impact: { budgetDelta: {}, creditDelta: { paymentHistory: -0.10 } },
      },
    ],
  },

  // ── INCOME (4) ─────────────────────────────────────────────────────────────
  {
    id: 'hours-reduced',
    title: 'Hours Reduced',
    category: 'income',
    story: 'Your employer cuts your Monthly hours. Pay drops by $120/mo for the next month.',
    choices: [
      {
        id: 'cut-lifestyle',
        label: 'Cut entertainment and dining to keep all payments current',
        quality: 'good',
        consequence: 'Tough month — less fun, but every bill gets paid on time.',
        creditNote: 'Income changes don\'t affect credit score. What matters is that you kept making payments on time.',
        impact: { budgetDelta: { monthlyPay: -120, entertainment: -15, diningOut: -25 }, creditDelta: {} },
      },
      {
        id: 'use-emergency-fund',
        label: 'Use emergency fund to cover the income gap',
        quality: 'moderate',
        consequence: 'Bills covered but your safety net shrinks significantly.',
        creditNote: 'No credit impact. Your income and savings are not on your credit report.',
        impact: { budgetDelta: { monthlyPay: -120, emergencyFund: -400 }, creditDelta: {} },
      },
      {
        id: 'short-term-loan',
        label: 'Take a short-term loan to bridge the gap',
        quality: 'risky',
        consequence: 'Cash flow smoothed but you now have a loan repayment AND a hard inquiry on your file.',
        creditNote: 'Loan application = hard inquiry (10% of score). A new account also reduces your average credit age (15% of score).',
        impact: { budgetDelta: { monthlyPay: -120, emergencyFund: 200 }, creditDelta: { newInquiries: -0.12, creditMix: 0.04, ageOfCredit: -0.03 } },
      },
    ],
  },
  {
    id: 'freelance-gig',
    title: 'Freelance Opportunity',
    category: 'income',
    story: 'A friend offers freelance work — an extra $200/mo for 4 weeks. It\'ll eat into your evenings.',
    choices: [
      {
        id: 'take-gig-pay-card',
        label: 'Take it and use all extra income to pay down your card',
        quality: 'good',
        consequence: 'Card balance drops by $800 over the month. Utilization improves significantly.',
        creditNote: 'Paying down card debt reduces your utilization ratio — that\'s 30% of your credit score. This is one of the fastest ways to improve your score.',
        impact: { budgetDelta: { cardBalance: -800 }, creditDelta: {} },
      },
      {
        id: 'take-gig-save',
        label: 'Take it and put the extra cash into savings',
        quality: 'moderate',
        consequence: 'Emergency fund grows by $800. Card balance unchanged.',
        creditNote: 'No credit impact. Savings account balances are not reported to credit bureaus.',
        impact: { budgetDelta: { emergencyFund: 800 }, creditDelta: {} },
      },
      {
        id: 'decline-gig',
        label: 'Decline — your free time matters more right now',
        quality: 'risky',
        consequence: 'No financial change. Nothing improves, nothing worsens.',
        creditNote: 'No credit impact. Employment decisions don\'t affect your credit score.',
        impact: { budgetDelta: {}, creditDelta: {} },
      },
    ],
  },
  {
    id: 'pay-raise',
    title: 'Pay Raise!',
    category: 'income',
    story: 'Great news — you get a $150/mo pay rise. Over the next 4 rounds, that is $600 extra income. How will you use it?',
    choices: [
      {
        id: 'paydown-card',
        label: 'Use the extra income to pay off credit card debt',
        quality: 'good',
        consequence: 'Strong discipline. You use the full 4-week raise to reduce debt, lowering interest pressure.',
        creditNote: 'Income itself does not raise your credit score. Paying down card balance improves utilization (30% of score).',
        impact: { budgetDelta: { monthlyPay: 150, cardBalance: -600 }, creditDelta: {} },
      },
      {
        id: 'upgrade-phone',
        label: 'Upgrade your phone',
        quality: 'moderate',
        consequence: 'You get a better phone, but add a new ongoing cost that absorbs part of the raise.',
        creditNote: 'No direct positive credit impact. New recurring costs reduce flexibility if a shock hits.',
        impact: { budgetDelta: { monthlyPay: 150, phone: 22, cardBalance: 120 }, creditDelta: { newInquiries: -0.03 } },
      },
      {
        id: 'save-raise',
        label: 'Save the extra income',
        quality: 'good',
        consequence: 'You keep your lifestyle steady and build a larger emergency buffer from the full 4-week raise.',
        creditNote: 'Savings do not directly change credit score, but stronger cash buffers reduce future missed-payment risk.',
        impact: { budgetDelta: { monthlyPay: 150, emergencyFund: 600 }, creditDelta: {} },
      },
    ],
  },
  {
    id: 'overtime-offer',
    title: 'Overtime Available',
    category: 'income',
    story: 'Your boss offers overtime shifts for the next month — an extra $180/mo but longer hours.',
    choices: [
      {
        id: 'overtime-pay-debt',
        label: 'Work overtime and aggressively pay down card debt',
        quality: 'good',
        consequence: 'Tiring month but your card balance drops by $720. Major utilization improvement.',
        creditNote: 'Paying down card balance is the fastest way to improve utilization (30% of score). Smart use of extra income.',
        impact: { budgetDelta: { cardBalance: -720, emergencyFund: 100 }, creditDelta: {} },
      },
      {
        id: 'overtime-save',
        label: 'Work overtime and build your emergency fund',
        quality: 'moderate',
        consequence: 'Safety net grows by $720. Card balance unchanged.',
        creditNote: 'No credit impact. Savings don\'t appear on credit reports — but having savings helps avoid future missed payments.',
        impact: { budgetDelta: { emergencyFund: 720 }, creditDelta: {} },
      },
      {
        id: 'skip-overtime',
        label: 'Skip it — work-life balance matters',
        quality: 'risky',
        consequence: 'No financial change. Missed opportunity to strengthen your position.',
        creditNote: 'No credit impact. Employment decisions don\'t affect credit.',
        impact: { budgetDelta: {}, creditDelta: {} },
      },
    ],
  },

  // ── DEBT (3) ───────────────────────────────────────────────────────────────
  {
    id: 'balance-transfer',
    title: 'Balance Transfer Offer',
    category: 'debt',
    story: 'A bank offers a 0% balance transfer card with a $5,000 limit. Transfer fee is 3%. Your current card charges 18% interest.',
    choices: [
      {
        id: 'transfer-paydown',
        label: 'Transfer balance to the new card and create an aggressive payoff plan',
        quality: 'good',
        consequence: 'Hard inquiry on your file, but you save on interest. New card means higher total credit limit — utilization improves.',
        creditNote: 'New card = hard inquiry (-5 pts typically) + lower average credit age. BUT higher total credit limit reduces utilization ratio. Net positive long-term.',
        impact: { budgetDelta: { cardBalance: -200, cardLimit: 2000 }, creditDelta: { newInquiries: -0.06, creditMix: 0.04, ageOfCredit: -0.02 } },
      },
      {
        id: 'transfer-keep-spending',
        label: 'Transfer balance but keep spending on the old card',
        quality: 'moderate',
        consequence: 'Interest savings happen but total debt doesn\'t drop. Two cards to manage now.',
        creditNote: 'Same inquiry impact. Total debt unchanged, so utilization stays similar despite higher limit.',
        impact: { budgetDelta: { cardLimit: 2000 }, creditDelta: { newInquiries: -0.06, ageOfCredit: -0.02 } },
      },
      {
        id: 'ignore-offer',
        label: 'Ignore the offer — opening new cards seems risky',
        quality: 'risky',
        consequence: 'No inquiry, but you keep paying 18% interest. Card balance grows from interest charges.',
        creditNote: 'No new inquiry, but interest makes your balance grow — pushing utilization higher over time.',
        impact: { budgetDelta: { cardBalance: 80 }, creditDelta: {} },
      },
    ],
  },
  {
    id: 'student-loan',
    title: 'Student Loan Repayments Start',
    category: 'debt',
    story: 'Your student loan repayments kick in at $80/mo. You need to fit this into your budget.',
    choices: [
      {
        id: 'budget-restructure',
        label: 'Cut dining out and entertainment to make room for repayments',
        quality: 'good',
        consequence: 'Tight but manageable. On-time loan payments build your credit history over time.',
        creditNote: 'On-time loan payments build payment history (35% of score). Having a loan alongside your card improves credit mix (10%).',
        impact: { budgetDelta: { diningOut: -30, entertainment: -20 }, creditDelta: { creditMix: 0.05 } },
      },
      {
        id: 'income-based',
        label: 'Apply for income-based repayment ($45/mo instead)',
        quality: 'moderate',
        consequence: 'Lower payments but loan takes longer to pay off.',
        creditNote: 'Still builds credit mix. Lower payments are easier to keep current — protecting your payment history.',
        impact: { budgetDelta: { diningOut: -15 }, creditDelta: { creditMix: 0.03 } },
      },
      {
        id: 'defer-loan',
        label: 'Request deferment — deal with it later',
        quality: 'risky',
        consequence: 'No budget change now, but interest accumulates. You miss out on building credit mix.',
        creditNote: 'Deferment means no payments reported — you miss the chance to build payment history and credit mix.',
        impact: { budgetDelta: {}, creditDelta: { creditMix: -0.02 } },
      },
    ],
  },
  {
    id: 'bnpl-temptation',
    title: 'Buy Now Pay Later Temptation',
    category: 'debt',
    story: 'You want a $400 tablet. A BNPL service offers 4 fortnightly payments of $100. Miss one and it\'s a $15 late fee.',
    choices: [
      {
        id: 'save-and-buy',
        label: 'Wait 4 weeks, save up, buy outright with cash',
        quality: 'good',
        consequence: 'Delayed gratification. No new debt, no credit risk.',
        creditNote: 'No credit impact. Buying with saved cash is invisible to credit bureaus.',
        impact: { budgetDelta: { entertainment: -25, emergencyFund: -100 }, creditDelta: {} },
      },
      {
        id: 'bnpl-careful',
        label: 'Use BNPL with calendar reminders for every payment',
        quality: 'moderate',
        consequence: 'Tablet now. BNPL may or may not trigger a soft credit check depending on provider.',
        creditNote: 'Some BNPL providers now report to credit bureaus. A soft check doesn\'t affect your score, but missed payments might.',
        impact: { budgetDelta: { entertainment: 25 }, creditDelta: { newInquiries: -0.03 } },
      },
      {
        id: 'bnpl-miss',
        label: 'Use BNPL — you\'ll probably remember the payments...',
        quality: 'risky',
        consequence: 'You miss the second payment. Late fee charged and the BNPL provider reports you.',
        creditNote: 'Missed BNPL payments are increasingly reported to credit bureaus. A late mark on your file damages payment history.',
        impact: { budgetDelta: { entertainment: 25, cardBalance: 65 }, creditDelta: { paymentHistory: -0.08, newInquiries: -0.03 } },
      },
    ],
  },

  // ── OPPORTUNITY (3) ────────────────────────────────────────────────────────
  {
    id: 'investment-chance',
    title: 'Investment Opportunity',
    category: 'opportunity',
    nzqaStandards: ['US 28101'],
    story: 'A friend pitches you on investing $500 in their small business. Could double in 6 months — or lose it all.',
    choices: [
      {
        id: 'invest-small',
        label: 'Invest $200 from savings — a manageable amount',
        quality: 'good',
        consequence: 'Controlled risk. Emergency fund dips but you\'re not exposed to credit risk.',
        creditNote: 'No credit impact. Investments made from savings don\'t appear on credit reports.',
        impact: { budgetDelta: { emergencyFund: -200 }, creditDelta: {} },
      },
      {
        id: 'invest-full',
        label: 'Go all in — invest $500 from emergency fund',
        quality: 'moderate',
        consequence: 'Big bet. Emergency fund nearly wiped out. One more surprise and you\'re in trouble.',
        creditNote: 'No direct credit impact. But with no emergency fund, the next unexpected cost could force you to miss credit payments.',
        impact: { budgetDelta: { emergencyFund: -500 }, creditDelta: {} },
      },
      {
        id: 'borrow-to-invest',
        label: 'Put $500 on credit card to invest',
        quality: 'risky',
        consequence: 'Borrowing at 18% interest to invest. Card balance jumps significantly.',
        creditNote: 'The card balance increase raises your utilization ratio. Borrowing to invest is extremely risky for your credit profile.',
        impact: { budgetDelta: { cardBalance: 500 }, creditDelta: {} },
      },
    ],
  },
  {
    id: 'car-purchase-choice',
    title: 'Car Purchase Decision',
    category: 'debt',
    nzqaStandards: ['US 28103', 'US 28100'],
    story: 'You need a reliable car for work placement. The car costs $2,200. Choose whether to pay outright or finance it.',
    choices: [
      {
        id: 'car-pay-cash',
        label: 'Pay outright from savings',
        quality: 'good',
        consequence: 'No loan repayment pressure, but your emergency buffer drops sharply.',
        creditNote: 'No direct credit impact from paying cash. You avoid inquiries and repayment risk.',
        impact: { budgetDelta: { emergencyFund: -2200 }, creditDelta: {} },
      },
      {
        id: 'car-deposit-loan',
        label: 'Pay $700 deposit and finance the rest ($65/mo)',
        quality: 'moderate',
        consequence: 'You keep some liquidity but take on a Monthly repayment that tightens cashflow.',
        creditNote: 'Loan application can add an inquiry, but consistent repayments can support credit mix over time.',
        impact: { budgetDelta: { emergencyFund: -700, transport: 65 }, creditDelta: { newInquiries: -0.04, creditMix: 0.03 } },
      },
      {
        id: 'car-full-finance',
        label: 'Finance full amount ($95/mo)',
        quality: 'risky',
        consequence: 'No upfront cash needed, but high Monthly repayments create sustained pressure on budget.',
        creditNote: 'Higher loan burden and inquiry increase repayment stress and future missed-payment risk.',
        impact: { budgetDelta: { transport: 95 }, creditDelta: { newInquiries: -0.07, ageOfCredit: -0.02, creditMix: 0.03 } },
      },
    ],
  },
  {
    id: 'side-business',
    title: 'Side Business Idea',
    category: 'opportunity',
    story: 'You have an idea for a small online business. Startup costs are about $350 for equipment and a website. If it works, your first small payout arrives in the final round.',
    choices: [
      {
        id: 'bootstrap',
        label: 'Start small with $150 from savings',
        quality: 'good',
        consequence: 'Low risk. You keep most of your buffer and may receive a small final-round payout (+$50).',
        creditNote: 'No direct credit impact. Savings-funded startups avoid utilization and inquiry pressure.',
        impact: { budgetDelta: { emergencyFund: -150 }, creditDelta: {} },
      },
      {
        id: 'credit-funded',
        label: 'Fund it entirely on credit card',
        quality: 'risky',
        consequence: 'You can start immediately, but debt rises now. If it still succeeds, final-round payout is +$50.',
        creditNote: 'Card balance increase raises utilization immediately; any return arrives later and may not offset near-term risk.',
        impact: { budgetDelta: { cardBalance: 350 }, creditDelta: { paymentHistory: -0.04 } },
      },
      {
        id: 'pass-for-now',
        label: 'Pass for now and keep your cash',
        quality: 'moderate',
        consequence: 'No startup risk and no startup return. You preserve liquidity for other shocks.',
        creditNote: 'No direct credit impact. Keeping cash can reduce future missed-payment risk.',
        impact: { budgetDelta: {}, creditDelta: {} },
      },
    ],
  },
  {
    id: 'travel-deal',
    title: 'Travel Deal Alert',
    category: 'opportunity',
    story: 'An incredible flight deal pops up — $400 return trip to somewhere you\'ve always wanted to go. Sale ends tonight.',
    choices: [
      {
        id: 'skip-travel',
        label: 'Pass on it — there will be other deals',
        quality: 'good',
        consequence: 'No spending. Your financial position stays solid. You add $50 to savings instead.',
        creditNote: 'No credit impact. Not spending money doesn\'t change your credit score — but it keeps you financially stable.',
        impact: { budgetDelta: { emergencyFund: 50 }, creditDelta: {} },
      },
      {
        id: 'pay-from-savings',
        label: 'Book it from savings — you\'ve earned it',
        quality: 'moderate',
        consequence: 'Trip booked! Emergency fund drops but no new debt.',
        creditNote: 'No credit impact. Paying from savings is invisible to credit bureaus.',
        impact: { budgetDelta: { emergencyFund: -400 }, creditDelta: {} },
      },
      {
        id: 'book-on-card',
        label: 'Book on credit card — YOLO',
        quality: 'risky',
        consequence: 'Trip booked but card balance jumps by $400. Monthly minimum payment increases.',
        creditNote: 'Higher card balance increases utilization. If utilization exceeds 30%, it starts dragging your score down.',
        impact: { budgetDelta: { cardBalance: 400 }, creditDelta: {} },
      },
    ],
  },

  // ── CRISIS (6) — mandatory scenarios that guarantee financial pressure ────
  {
    id: 'rent-increase',
    title: 'Rent Increase Notice',
    category: 'emergency',
    mandatory: true,
    story: 'Your landlord sends a notice — rent is going up by $65/mo starting immediately. The local rental market is tight and moving would cost even more.',
    choices: [
      {
        id: 'cut-lifestyle-hard',
        label: 'Cut dining out and entertainment to absorb the increase',
        quality: 'good',
        consequence: 'You eat in every night and cancel social plans. Rent covered but lifestyle takes a hit.',
        creditNote: 'No credit impact. Reducing spending doesn\'t affect your credit score — but it helps you keep making payments.',
        impact: { budgetDelta: { rent: 65, diningOut: -35, entertainment: -20 }, creditDelta: {} },
      },
      {
        id: 'partial-savings',
        label: 'Cover the gap from savings while you figure things out',
        quality: 'moderate',
        consequence: 'Rent paid but your savings drain every week. This isn\'t sustainable long-term.',
        creditNote: 'No credit impact yet. But draining savings means the next emergency could push you into debt.',
        impact: { budgetDelta: { rent: 65 }, creditDelta: {} },
      },
      {
        id: 'put-on-card',
        label: 'Use credit card for groceries to free up cash for rent',
        quality: 'risky',
        consequence: 'Rent paid but you\'re adding $80/mo to your card for groceries. Card balance climbs fast.',
        creditNote: 'Shifting expenses to credit card increases utilization. If this continues, you\'ll max out and miss payments.',
        impact: { budgetDelta: { rent: 65, cardBalance: 320 }, creditDelta: {} },
      },
    ],
  },
  {
    id: 'utility-spike',
    title: 'Winter Energy Bill Shock',
    category: 'emergency',
    mandatory: true,
    story: 'Winter hits hard. Your electricity and gas bills double — utilities jump by $60/mo this month. You\'re shivering just thinking about it.',
    choices: [
      {
        id: 'bundle-up',
        label: 'Wear extra layers, use blankets, and reduce heating',
        quality: 'good',
        consequence: 'Uncomfortable but you limit the damage to a $30/mo increase. You also cut subscriptions.',
        creditNote: 'No credit impact. Utility bills paid from regular income don\'t affect credit.',
        impact: { budgetDelta: { utilities: 30, subscriptions: -10 }, creditDelta: {} },
      },
      {
        id: 'pay-full-savings',
        label: 'Keep the heating on and absorb the full cost',
        quality: 'moderate',
        consequence: 'Comfortable but $60/mo extra eats into your surplus fast. Savings stop growing.',
        creditNote: 'No credit impact. But your tighter budget means less room for unexpected costs.',
        impact: { budgetDelta: { utilities: 60 }, creditDelta: {} },
      },
      {
        id: 'skip-card-payment',
        label: 'Put the utility bill on credit card and skip minimum payment',
        quality: 'risky',
        consequence: 'You charge the $60 bill to your card and also miss the minimum payment. A $45 late fee is added.',
        creditNote: 'Card balance increases by $105 total ($60 utility + $45 fee), and the missed payment damages payment history.',
        impact: { budgetDelta: { cardBalance: 105 }, creditDelta: { paymentHistory: -0.15 } },
      },
    ],
  },
  {
    id: 'hours-slashed',
    title: 'Hours Slashed',
    category: 'income',
    mandatory: true,
    story: 'Bad news — your employer is cutting costs. Your hours are reduced significantly and your pay drops by $200/mo. This could last a while.',
    choices: [
      {
        id: 'slash-everything',
        label: 'Emergency mode — cut all non-essentials and pick up odd jobs',
        quality: 'good',
        consequence: 'You cancel subscriptions, stop eating out, and do odd jobs for $50/mo. Still a $90/mo shortfall.',
        creditNote: 'No credit impact from the income drop itself — but you need to keep making credit payments on time.',
        impact: { budgetDelta: { monthlyPay: -200, diningOut: -30, entertainment: -20, subscriptions: -15 }, creditDelta: {} },
      },
      {
        id: 'use-savings',
        label: 'Dip into savings to cover the gap — things will improve',
        quality: 'moderate',
        consequence: 'No lifestyle change but your savings drain by $200/mo. How long can this last?',
        creditNote: 'No credit impact. But when savings run out, the next step is debt.',
        impact: { budgetDelta: { monthlyPay: -200 }, creditDelta: {} },
      },
      {
        id: 'payday-loan',
        label: 'Take a payday loan to bridge the gap',
        quality: 'risky',
        consequence: 'Quick cash but the loan charges huge fees. Hard inquiry on your credit plus high interest debt.',
        creditNote: 'Payday loan application = hard inquiry. These high-interest loans are a debt trap — the interest alone can cause missed payments.',
        impact: { budgetDelta: { monthlyPay: -200, cardBalance: 300 }, creditDelta: { newInquiries: -0.10, ageOfCredit: -0.03 } },
      },
    ],
  },
  {
    id: 'tax-bill-surprise',
    title: 'Tax Bill Surprise',
    category: 'debt',
    mandatory: true,
    nzqaStandards: ['US 28098', 'US 28100'],
    story: 'The tax office sends you a bill for $600 — you under-reported income from a side gig last year. Payment is due in 14 days or they charge penalties.',
    choices: [
      {
        id: 'pay-from-savings',
        label: 'Pay the full $600 from savings',
        quality: 'good',
        consequence: 'Emergency fund takes a huge hit but the debt is cleared. No credit involvement.',
        creditNote: 'No credit impact. Tax payments don\'t appear on credit reports (unless they become delinquent).',
        impact: { budgetDelta: { emergencyFund: -600 }, creditDelta: {} },
      },
      {
        id: 'ato-payment-plan',
        label: 'Set up a payment plan — $80/mo for 8 weeks',
        quality: 'moderate',
        consequence: 'Manageable payments with a clear $80/mo repayment added to your budget.',
        creditNote: 'Tax payment plans don\'t typically involve a credit check. But the tighter budget means less room for error.',
        impact: { budgetDelta: { repaymentPlan: 80 }, creditDelta: {} },
      },
      {
        id: 'put-on-credit-card',
        label: 'Pay with credit card — deal with it later',
        quality: 'risky',
        consequence: 'Tax bill cleared but $600 added to your card. At 18% interest, this debt grows fast.',
        creditNote: '$600 increase in card balance significantly raises utilization. If you were at 30%, you might now be at 50%+.',
        impact: { budgetDelta: { cardBalance: 600 }, creditDelta: {} },
      },
    ],
  },
  {
    id: 'card-interest-shock',
    title: 'Credit Card Statement Shock',
    category: 'debt',
    mandatory: true,
    story: 'Your credit card statement arrives. You\'ve been carrying a balance and interest charges have added $180 to your debt. The minimum payment is $95.',
    choices: [
      {
        id: 'pay-more-than-min',
        label: 'Pay $200 from savings — more than minimum to fight the balance',
        quality: 'good',
        consequence: 'Card balance reduced. On-time payment recorded. Emergency fund shrinks.',
        creditNote: 'Paying more than minimum reduces utilization AND builds payment history. Double positive for your score.',
        impact: { budgetDelta: { emergencyFund: -200, cardBalance: -20 }, creditDelta: {} },
      },
      {
        id: 'pay-minimum-only',
        label: 'Pay the $95 minimum — keep the rest in savings',
        quality: 'moderate',
        consequence: 'Payment on time but the interest means your balance barely drops. Debt lingers.',
        creditNote: 'Minimum payment counts as on-time — protects payment history. But balance stays high, keeping utilization elevated.',
        impact: { budgetDelta: { emergencyFund: -95, cardBalance: 85 }, creditDelta: {} },
      },
      {
        id: 'miss-payment',
        label: 'Skip it — you need the cash for rent this week',
        quality: 'risky',
        consequence: 'Missed payment. Late fee of $30 added. And it gets reported to credit bureaus after 30 days.',
        creditNote: 'THIS IS THE BIG ONE. A missed payment is the #1 factor in credit scoring (35%). One late payment can drop your score 60-110 points.',
        impact: { budgetDelta: { cardBalance: 210 }, creditDelta: { paymentHistory: -0.18 } },
      },
    ],
  },
  {
    id: 'rego-insurance-due',
    title: 'Car Rego & Insurance Due',
    category: 'emergency',
    mandatory: true,
    nzqaStandards: ['US 28104'],
    story: 'Your annual car registration and insurance renewal is due — $500 total. You need the car for work. No extensions possible.',
    choices: [
      {
        id: 'pay-from-savings',
        label: 'Pay the full $500 from emergency fund',
        quality: 'good',
        consequence: 'Big chunk out of savings but no debt. Car stays on the road.',
        creditNote: 'No credit impact. Insurance and rego payments don\'t appear on credit reports.',
        impact: { budgetDelta: { emergencyFund: -500 }, creditDelta: {} },
      },
      {
        id: 'split-savings-card',
        label: 'Pay $250 from savings, $250 on credit card',
        quality: 'moderate',
        consequence: 'Savings take a smaller hit but card balance increases. Utilization goes up.',
        creditNote: 'The $250 on your card increases utilization. If you\'re already above 30%, this pushes you further into risky territory.',
        impact: { budgetDelta: { emergencyFund: -250, cardBalance: 250 }, creditDelta: {} },
      },
      {
        id: 'full-on-card',
        label: 'Put the whole $500 on credit card',
        quality: 'risky',
        consequence: 'Savings untouched but card balance jumps by $500. Monthly minimum goes up. Budget pressure intensifies.',
        creditNote: 'Large card balance increase. If this pushes utilization above 50%, it significantly drags your score down.',
        impact: { budgetDelta: { cardBalance: 500 }, creditDelta: {} },
      },
    ],
  },

  // ─── HARD MODE ONLY: Can't Cover Everything ─────────────────────────────────
  {
    id: 'cant-cover-everything',
    category: 'emergency',
    mandatory: true,
    difficulty: 'hard',
    title: 'Financial Crisis: Can\'t Cover Everything',
    story: 'Disaster. Your hours were cut this week AND you had unexpected expenses. You\'re $250 short and you can\'t pay everything. Your savings are empty. What do you skip?',
    choices: [
      {
        id: 'skip-card',
        label: 'Skip credit card minimum payment this month',
        quality: 'risky',
        consequence: 'You skipped your credit card payment to keep a roof over your head. Your card company reports the missed payment to credit bureaus. Late fees added to your balance.',
        creditNote: 'CRITICAL HIT to credit score! Missed payments are 35% of your score. This single missed payment can drop your score by 60-110 points and stays on your record for 7 years. Credit card payments should be your top priority.',
        impact: {
          budgetDelta: { cardBalance: 75 }, // Late fee + missed minimum gets added to balance
          creditDelta: { paymentHistory: -0.15 } // Massive penalty
        },
      },
      {
        id: 'defer-rent',
        label: 'Ask landlord to defer rent payment 2 weeks',
        quality: 'moderate',
        consequence: 'You called your landlord and explained the situation. They agreed to let you pay in 2 weeks with a $50 late fee. You kept your credit card payment on track. Crisis managed, but expensive.',
        creditNote: 'Smart prioritization! In Australia, rent doesn\'t directly affect your credit score unless you\'re evicted and sent to collections. Paying your credit card protects your credit history. Communication with landlords usually works better than just skipping.',
        impact: {
          budgetDelta: { rent: 50 }, // Late fee added to rent
          creditDelta: {} // No credit impact
        },
      },
      {
        id: 'skip-rent',
        label: 'Skip rent payment entirely this month',
        quality: 'risky',
        consequence: 'You didn\'t pay rent and didn\'t communicate with your landlord. They\'re furious. Eviction notice possible. You kept the cash this round — but your landlord has started formal proceedings. If this goes to a debt collector or Tenancy Tribunal, it will appear on your credit file.',
        creditNote: 'Skipping rent gives you short-term cash but creates a real collections risk. Unpaid rent sent to a debt collector WILL damage your credit score significantly. The +cash this round is a trap — landlord debt compounds like any other unpaid obligation.',
        impact: {
          budgetDelta: { goalSavings: 700 }, // Kept the rent money this month
          creditDelta: { paymentHistory: -0.08 }, // Landlord has started proceedings — collections risk starts now
        },
      },
    ],
  },

  // ─── WINDFALL: Bonus/Tax Refund (DYNAMIC - amounts calculated based on current card balance) ──────────────────────────────────────────
  {
    id: 'bonus-windfall',
    category: 'opportunity',
    mandatory: true,
    nzqaStandards: ['US 28100', 'US 28101'],
    title: 'Work Bonus!',
    story: 'Great news! You received a work bonus for hitting your performance targets. The bonus is nearly enough to wipe out your credit card debt! This is a rare opportunity to improve your financial situation. What will you do with it?',
    choices: [
      {
        id: 'pay-debt',
        label: 'Pay off credit card debt (use 90% of bonus)',
        quality: 'good',
        consequence: 'You paid most of the bonus toward your credit card, dramatically reducing your balance. Your monthly minimum payment drops, freeing up Monthly cash flow. Interest charges will be much lower.',
        creditNote: 'Excellent financial decision! Reducing credit card debt improves your utilization ratio (debt/limit), which is 30% of your credit score. Lower balances mean lower interest charges and better financial flexibility.',
        impact: { budgetDelta: { cardBalance: -9999 }, creditDelta: {} }, // -9999 = special flag for dynamic calculation; utilization is auto-computed from balance
      },
      {
        id: 'split-bonus',
        label: 'Pay half toward debt, save and spend the rest',
        quality: 'moderate',
        consequence: 'You paid half the bonus toward your credit card (good progress!), put a quarter in savings, and spent a quarter on treats. Balanced approach, but debt still lingers.',
        creditNote: 'Balanced choice. Reducing debt improves utilization, though not as much as paying it all off. Building savings is wise, but the remaining card balance still costs you interest.',
        impact: {
          budgetDelta: { cardBalance: -9998, emergencyFund: 9998 }, // -9998 = special flag
          creditDelta: { utilization: 0.02 }
        },
      },
      {
        id: 'spend-bonus',
        label: 'Treat yourself! New clothes, night out, upgrade subscriptions',
        quality: 'risky',
        consequence: 'You spent the entire bonus on lifestyle upgrades: new wardrobe, nights out with friends, premium streaming services (+$25/mo), and a gym membership (+$30/mo). Your credit card debt remains unchanged, and your Monthly expenses just increased by $55.',
        creditNote: 'Missed opportunity! Your credit card debt is still accumulating interest at 18% APR. The $55/month in new subscriptions ($2,860/year) could have been used to pay down debt. High card balances hurt your score.',
        impact: {
          budgetDelta: { subscriptions: 55, entertainment: 25 },
          creditDelta: {}
        },
      },
    ],
  },
  {
    id: 'gp-treatment-visit',
    title: 'GP & Treatment Visit',
    category: 'emergency',
    mandatory: true,
    nzqaStandards: ['US 28104', 'US 28100'],
    story: 'You need a GP consultation plus follow-up treatment this week. Cost depends heavily on whether you bought health insurance earlier.',
    choices: [
      {
        id: 'treatment-pay-savings',
        label: 'Pay treatment from savings',
        quality: 'good',
        consequence: 'You avoid new debt but your emergency fund takes the hit.',
        creditNote: 'No direct credit impact. Avoiding new debt helps keep utilization under control.',
        impact: { budgetDelta: { emergencyFund: -420 }, creditDelta: {} },
      },
      {
        id: 'treatment-split',
        label: 'Split between savings and card',
        quality: 'moderate',
        consequence: 'You preserve some savings but increase card debt and utilization.',
        creditNote: 'Higher card balance can weaken utilization, especially if already above 30%.',
        impact: { budgetDelta: { emergencyFund: -180, cardBalance: 240 }, creditDelta: {} },
      },
      {
        id: 'treatment-card',
        label: 'Put it on credit card',
        quality: 'risky',
        consequence: 'No immediate cash hit, but debt and minimum repayments jump.',
        creditNote: 'Large debt increase worsens utilization and raises missed-payment risk.',
        impact: { budgetDelta: { cardBalance: 420 }, creditDelta: {} },
      },
    ],
  },
  {
    id: 'utility-cant-pay',
    title: 'Utility Bill Due — Short on Cash',
    category: 'emergency',
    story: 'Your power and internet bill arrived but this month\'s budget is stretched thin. You don\'t have quite enough without dipping into savings or credit. Worth knowing: NZ utilities don\'t automatically report to credit bureaus — but they do if you go overdue long enough.',
    choices: [
      {
        id: 'skip-utility-payment',
        label: 'Skip it — I\'ll sort it next month',
        quality: 'risky',
        consequence: 'Bill unpaid. No immediate credit impact — but if it stays unpaid past 60 days it goes to a collections agency.',
        creditNote: 'Utilities don\'t report to credit bureaus immediately. After ~60 days overdue the debt is referred to collections — that\'s when a credit default is filed and stays on your record for 5 years.',
        impact: { budgetDelta: {}, creditDelta: {} },
      },
      {
        id: 'pay-utility-card',
        label: 'Put it on the credit card',
        quality: 'moderate',
        consequence: 'Bill paid on time, but card balance rises and utilization increases.',
        creditNote: 'Paying on credit is better than defaulting. Watch your utilization — above 30% weakens your score.',
        impact: { budgetDelta: { cardBalance: 200 }, creditDelta: {} },
      },
      {
        id: 'pay-utility-savings',
        label: 'Pay from savings',
        quality: 'good',
        consequence: 'Bill paid, savings dip by $200. No debt created.',
        creditNote: 'No credit impact at all. Savings take the hit but your credit profile stays clean.',
        impact: { budgetDelta: { goalSavings: -200 }, creditDelta: {} },
      },
    ],
  },
]

// ─── Utility Collections Scenario (injected dynamically — not in draw pool) ──
// Exported so CreditScoreMvpPage can inject it when player skips utility payment.
export const UTILITY_COLLECTIONS_SCENARIO: CreditScenario = {
  id: 'utility-collections',
  title: '⚠️ Utility Debt Sent to Collections',
  category: 'emergency',
  story: 'It\'s been over 60 days since you skipped that utility bill. Your power and internet provider has referred the $200 overdue balance to a debt collection agency. A credit default will now be filed against you — and it stays on your credit record for 5 years regardless of whether you pay.',
  choices: [
    {
      id: 'utility-pay-collections',
      label: 'Pay the collection agency ($220 with fees)',
      quality: 'moderate',
      consequence: 'Debt cleared, but the credit default remains on your file for 5 years — it shows as "paid default".',
      creditNote: 'A credit default is serious. Even after payment it stays visible. Lenders see it and treat you as higher risk. This is one of the most damaging events in NZ credit reporting.',
      impact: { budgetDelta: { cardBalance: 220 }, creditDelta: { paymentHistory: -0.20 } },
    },
    {
      id: 'utility-debt-management',
      label: 'Enter a debt management plan',
      quality: 'risky',
      consequence: 'Structured repayments begin, but a DMP notation and credit default both appear on your file.',
      creditNote: 'A DMP means a credit default is still filed AND a new inquiry hits your record. Slightly lower monthly payment — but double the credit damage.',
      impact: { budgetDelta: { cardBalance: 200 }, creditDelta: { paymentHistory: -0.15, newInquiries: -0.10 } },
    },
    {
      id: 'utility-ignore',
      label: 'Ignore it — can\'t afford anything right now',
      quality: 'risky',
      consequence: 'The default stands unresolved. The collections agency may escalate to a court judgment.',
      creditNote: 'An unpaid default is the worst outcome. The collections agency can apply for a court judgment, which is an additional negative mark on your credit file.',
      impact: { budgetDelta: {}, creditDelta: { paymentHistory: -0.22 } },
    },
  ],
}

// ─── Scenario Helpers ────────────────────────────────────────────────────────

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function shuffleChoiceTuple(choices: CreditScenario['choices']): CreditScenario['choices'] {
  const shuffled = shuffle([...choices]) as CreditScenarioChoice[]
  return [shuffled[0], shuffled[1], shuffled[2]]
}

function withShuffledChoices(scenario: CreditScenario): CreditScenario {
  return {
    ...scenario,
    choices: shuffleChoiceTuple(scenario.choices),
  }
}

/** Draw `count` scenarios — guarantees bonus-windfall + crisis scenarios based on difficulty */
export function drawCreditScenarios(count: number, difficulty: 'easy' | 'hard' = 'easy'): CreditScenario[] {
  const availableScenarios = CREDIT_SCENARIOS.filter(s => !s.difficulty || s.difficulty === difficulty)
  const byId = new Map(availableScenarios.map((s) => [s.id, s]))
  const used = new Set<string>()
  const picked: CreditScenario[] = []

  // Always include all mandatory non-delayed scenarios first.
  const delayedIds = new Set(['health-insurance-decision', 'investment-pathways', 'investment-chance'])
  const bankerScenarioId = 'banker-savings-split'
  const delayedPool: CreditScenario[] = []
  for (const id of delayedIds) {
    const scenario = byId.get(id)
    if (scenario) delayedPool.push(scenario)
  }

  const mandatoryCore = shuffle(
    availableScenarios.filter((s) => s.mandatory && !delayedIds.has(s.id) && s.id !== bankerScenarioId),
  )
  for (const scenario of mandatoryCore) {
    if (picked.length >= count - delayedPool.length) break
    if (!used.has(scenario.id)) {
      used.add(scenario.id)
      picked.push(scenario)
    }
  }

  // Fill remaining with optionals (excluding delayed placeholders for now).
  const optionalPool = shuffle(
    availableScenarios.filter((s) => !s.mandatory && !delayedIds.has(s.id) && !used.has(s.id)),
  )
  for (const scenario of optionalPool) {
    if (picked.length >= count - delayedPool.length) break
    used.add(scenario.id)
    picked.push(scenario)
  }

  // If still short, backfill from any remaining scenarios.
  const backfillPool = shuffle(availableScenarios.filter((s) => !used.has(s.id) && !delayedIds.has(s.id)))
  for (const scenario of backfillPool) {
    if (picked.length >= count - delayedPool.length) break
    used.add(scenario.id)
    picked.push(scenario)
  }

  // Base order with at least 5 normal decisions up front.
  const ordered = shuffle(picked).slice(0, Math.max(0, count - delayedPool.length))

  // Force banker savings split scenario into round 2-5 (1-4 zero-indexed).
  const bankerScenario = byId.get(bankerScenarioId)
  if (bankerScenario) {
    const alreadyIndex = ordered.findIndex((s) => s.id === bankerScenarioId)
    if (alreadyIndex !== -1) {
      ordered.splice(alreadyIndex, 1)
    }
    const minIndex = Math.min(1, Math.max(0, ordered.length))
    const maxIndex = Math.min(4, ordered.length)
    const bankerIndex = minIndex + Math.floor(Math.random() * Math.max(1, maxIndex - minIndex + 1))
    ordered.splice(bankerIndex, 0, bankerScenario)
  }

  // Insert delayed module-style prompts after round 5, spaced apart.
  const delayedShuffled = shuffle(delayedPool)
  const insertionPositions: number[] = []
  let cursor = 5 + Math.floor(Math.random() * 2) // 5 or 6 (0-indexed)
  for (let i = 0; i < delayedShuffled.length; i++) {
    const maxAllowed = Math.max(5, count - (delayedShuffled.length - i))
    const clamped = Math.min(Math.max(5, cursor), maxAllowed)
    insertionPositions.push(clamped)
    cursor = clamped + 2 + Math.floor(Math.random() * 2) // enforce spacing
  }

  for (let i = 0; i < delayedShuffled.length; i++) {
    const scenario = delayedShuffled[i]
    const target = Math.min(insertionPositions[i], ordered.length)
    ordered.splice(target, 0, scenario)
  }

  // Keep gp-treatment after insurance setup where possible and never last.
  const insuranceIndex = ordered.findIndex((s) => s.id === 'health-insurance-decision')
  const gpIndex = ordered.findIndex((s) => s.id === 'gp-treatment-visit')
  if (insuranceIndex !== -1 && gpIndex !== -1 && gpIndex <= insuranceIndex && ordered.length > insuranceIndex + 1) {
    const [gpScenario] = ordered.splice(gpIndex, 1)
    const afterInsurance = Math.min(ordered.length - 1, insuranceIndex + 2)
    ordered.splice(afterInsurance, 0, gpScenario)
  }
  const gpIndexFinal = ordered.findIndex((s) => s.id === 'gp-treatment-visit')
  if (gpIndexFinal === ordered.length - 1 && ordered.length > 1) {
    ;[ordered[gpIndexFinal], ordered[ordered.length - 2]] = [ordered[ordered.length - 2], ordered[gpIndexFinal]]
  }

  return ordered.slice(0, count).map(withShuffledChoices)
}

/** Get scenarios grouped by category */
export function getScenariosByCategory(): Record<CreditScenarioCategory, CreditScenario[]> {
  const grouped: Record<CreditScenarioCategory, CreditScenario[]> = {
    emergency: [],
    lifestyle: [],
    income: [],
    debt: [],
    opportunity: [],
  }
  for (const s of CREDIT_SCENARIOS) {
    grouped[s.category].push(s)
  }
  return grouped
}

