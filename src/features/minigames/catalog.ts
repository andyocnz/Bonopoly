import type { MiniGameTypeSlug } from '../../api/client'

export type DifficultyLevel = 'Intro' | 'Intro-Intermediate' | 'Intermediate'

export type GameTopic = 'Game Theory' | 'Markets' | 'Finance' | 'Behavioural' | 'Data & Analytics' | 'Governance' | 'Accounting'

export const GAME_TOPICS: GameTopic[] = ['Game Theory', 'Markets', 'Finance', 'Behavioural', 'Data & Analytics', 'Governance', 'Accounting']

export type MiniGameCatalogItem = {
  type: MiniGameTypeSlug
  title: string
  blurb: string
  difficulty: DifficultyLevel
  topic: GameTopic
  icon: string
  beta?: boolean
  solo?: boolean
}

export const DIFFICULTY_ORDER: DifficultyLevel[] = ['Intro', 'Intro-Intermediate', 'Intermediate']

const MINI_GAME_LIBRARY_BASE: MiniGameCatalogItem[] = [
  // ── Intro ──────────────────────────────────────────────────────────────────
  {
    type: 'bank-run',
    title: 'Bank Run',
    blurb: 'Liquidity panic and coordination game. Students decide to wait or withdraw.',
    difficulty: 'Intro',
    topic: 'Game Theory',
    icon: '🏦',
  },
  {
    type: 'credit-score',
    title: 'Credit Score',
    blurb: 'Personal finance decisions across rounds with delayed credit impact outcomes.',
    difficulty: 'Intro',
    topic: 'Finance',
    icon: '💳',
    solo: true,
  },
  {
    type: 'prisoners-dilemma',
    title: "Prisoner's Dilemma",
    blurb: 'Two players choose Cooperate or Defect each round. Classic cooperation vs. self-interest.',
    difficulty: 'Intro',
    topic: 'Game Theory',
    icon: '⚖️',
  },
  {
    type: 'ultimatum',
    title: 'Ultimatum Game',
    blurb: 'Proposer splits 100 points; Responder accepts or rejects. Explores fairness and rationality.',
    difficulty: 'Intro',
    topic: 'Game Theory',
    icon: '🤝',
  },
  // ── Intro-Intermediate ─────────────────────────────────────────────────────
  {
    type: 'fishery',
    title: 'Fishery',
    blurb: 'Common-pool resource game. Balance individual gains and sustainability.',
    difficulty: 'Intro-Intermediate',
    topic: 'Game Theory',
    icon: '🐟',
  },
  {
    type: 'trust-game',
    title: 'Trust Game',
    blurb: 'Investor sends money (tripled); Trustee decides how much to return. Explores trust and reciprocity.',
    difficulty: 'Intro-Intermediate',
    topic: 'Game Theory',
    icon: '🔒',
  },
  {
    type: 'public-goods',
    title: 'Public Goods Game',
    blurb: 'Each player contributes to a shared pool (multiplied and split). Demonstrates free-rider problem.',
    difficulty: 'Intro-Intermediate',
    topic: 'Game Theory',
    icon: '🌐',
  },
  {
    type: 'adverse-selection',
    title: 'Adverse Selection',
    blurb: 'Sellers with private quality decide to enter. Watch the market unravel as high-quality exits.',
    difficulty: 'Intro-Intermediate',
    topic: 'Game Theory',
    icon: '🍋',
  },
  {
    type: 'principal-agent',
    title: 'Principal-Agent',
    blurb: 'Hidden effort and incentive contracts. Choose your effort level to maximise payoff.',
    difficulty: 'Intro-Intermediate',
    topic: 'Game Theory',
    icon: '📋',
  },
  // ── Intermediate ───────────────────────────────────────────────────────────
  {
    type: 'double-auction',
    title: 'Double Auction',
    blurb: 'Price discovery with buyers and sellers. Shows market equilibrium dynamics.',
    difficulty: 'Intermediate',
    topic: 'Markets',
    icon: '📈',
  },
  {
    type: 'matching-pennies',
    title: 'Matching Pennies',
    blurb: 'Pure zero-sum game. No dominant strategy — introduces mixed-strategy Nash equilibrium.',
    difficulty: 'Intermediate',
    topic: 'Game Theory',
    icon: '🪙',
  },
  {
    type: 'cournot',
    title: 'Cournot Competition',
    blurb: 'Firms simultaneously choose quantities. Demonstrates oligopoly equilibrium.',
    difficulty: 'Intermediate',
    topic: 'Markets',
    icon: '🏭',
  },
  {
    type: 'bertrand',
    title: 'Bertrand Competition',
    blurb: 'Firms simultaneously set prices. Shows how price competition leads to marginal cost pricing.',
    difficulty: 'Intermediate',
    topic: 'Markets',
    icon: '🏷️',
  },
  {
    type: 'english-auction',
    title: 'English Auction',
    blurb: "Open ascending-bid auction. Demonstrates winner's curse and bidding strategy.",
    difficulty: 'Intermediate',
    topic: 'Markets',
    icon: '🔨',
  },
  {
    type: 'beauty-contest',
    title: 'Beauty Contest',
    blurb: 'Guess 2/3 of the average. Reveals iterated elimination of dominated strategies.',
    difficulty: 'Intermediate',
    topic: 'Behavioural',
    icon: '🎯',
  },
  {
    type: 'monte-carlo-pi',
    title: 'Monte Carlo Pi',
    blurb: 'Race to estimate π with a limited budget. More trials = more accuracy, but at a cost.',
    difficulty: 'Intermediate',
    topic: 'Data & Analytics',
    icon: '🎲',
  },
  {
    type: 'market-survival',
    title: 'Assets Diversification',
    blurb: 'Allocate your portfolio across Bonds, Index Fund, and Growth Stocks across three market conditions. See why diversification matters.',
    difficulty: 'Intro',
    topic: 'Finance',
    icon: '📊',
  },
  {
    type: 'portfolio-frontier',
    title: 'Portfolio Frontier',
    blurb: 'Pick expected return and risk for 200 simulated portfolios. Reach the retirement goal efficiently.',
    difficulty: 'Intermediate',
    topic: 'Finance',
    icon: '💼',
  },
  {
    type: 'signaling-game',
    title: 'Signaling Game',
    blurb: 'Workers invest in education to signal type. Does a separating equilibrium emerge?',
    difficulty: 'Intermediate',
    topic: 'Game Theory',
    icon: '🎓',
  },
  {
    type: 'monopoly-pricing',
    title: 'Monopoly Pricing',
    blurb: 'Set the monopoly price each round. Maximise profit — and see the deadweight loss you create.',
    difficulty: 'Intermediate',
    topic: 'Markets',
    icon: '👑',
  },
  {
    type: 'asset-bubble',
    title: 'Asset Bubble',
    blurb: 'Trade an asset with declining fundamental value in a live order book. Can you avoid the crash?',
    difficulty: 'Intermediate',
    topic: 'Behavioural',
    icon: '📈',
  },
  {
    type: 'market-basket',
    title: 'Market Basket Analysis',
    blurb: 'Find association rules worth acting on. Learn why lift beats confidence as a promotion metric.',
    difficulty: 'Intermediate',
    topic: 'Data & Analytics',
    icon: '🛒',
    solo: true,
  },
  {
    type: 'ab-testing',
    title: 'A/B Testing',
    blurb: 'Decide when to call a winner. Balance the cost of running longer against the risk of false conclusions.',
    difficulty: 'Intermediate',
    topic: 'Data & Analytics',
    icon: '🧪',
    solo: true,
  },
  {
    type: 'customer-churn',
    title: 'Customer Churn',
    blurb: 'Label at-risk customers under a retention budget. Master the precision–recall tradeoff.',
    difficulty: 'Intermediate',
    topic: 'Data & Analytics',
    icon: '📉',
    solo: true,
  },

  {
    type: 'capital-structure-lab',
    title: 'Capital Structure Lab',
    blurb: 'Choose projects and funding mix to learn debt vs equity, WACC, and value creation through consequences.',
    difficulty: 'Intro-Intermediate',
    topic: 'Finance',
    icon: '🏗️',
    solo: true,
  },

  {
    type: 'conflict-of-interest',
    title: 'Conflict of Interest',
    blurb: '20 NZ governance scenarios. Spot the right call — declare, abstain, or proceed? Built for CGINZ.',
    difficulty: 'Intro-Intermediate',
    topic: 'Governance',
    icon: '⚖️',
  },
  {
    type: 'ad-auction',
    title: 'Ad Auction',
    blurb: 'Bid on keywords in a second-price auction. Win clicks, maximise profit, learn why overbidding hurts.',
    difficulty: 'Intro-Intermediate',
    topic: 'Markets',
    icon: '📢',
  },
  {
    type: 'director-duties',
    title: 'Director Duties Classifier',
    blurb: '40 NZ scenarios. Classify which Companies Act duty was breached — or spot when no breach occurred.',
    difficulty: 'Intro-Intermediate',
    topic: 'Governance',
    icon: '📋',
  },
  {
    type: 'social-influence',
    title: 'Social Influence',
    blurb: 'Rate economic statements before and after seeing what others believe. Does social proof move you?',
    difficulty: 'Intro-Intermediate',
    topic: 'Behavioural',
    icon: '📡',
  },
  {
    type: 'crypto-bubble',
    title: 'Crypto Bubble',
    blurb: 'Trade tokens with algo-trader bots in a live order book. Survive the Minsky Moment — or cause it.',
    difficulty: 'Intermediate',
    topic: 'Behavioural',
    icon: '🪙',
  },
  {
    type: 'xero-reconciliation',
    title: 'Xero Reconciliation',
    blurb: 'Categorise bank transactions, spot the duplicate, then file a GST return. NZ accounting in practice.',
    difficulty: 'Intro',
    topic: 'Accounting',
    icon: '🧾',
    solo: true,
  },
  {
    type: 'game-of-life',
    title: 'Game of Life',
    blurb: '18 decisions. Ages 17–65. See how choices about KiwiSaver, housing, career, and health compound across a lifetime.',
    difficulty: 'Intro',
    topic: 'Finance',
    icon: '🌱',
    solo: true,
  },
]

const STABLE_MINI_GAME_TYPES = new Set<MiniGameTypeSlug>([
  'bank-run',
  'credit-score',
  'prisoners-dilemma',
  'matching-pennies',
  'ultimatum',
  'public-goods',
  'cournot',
  'beauty-contest',
  'bertrand',
  'asset-bubble',
  'english-auction',
  'monopoly-pricing',
  'trust-game',
  'conflict-of-interest',
  'ad-auction',
  'director-duties',
  'fishery',
  'double-auction',
  'market-basket',
  'ab-testing',
  'customer-churn',
])

export const MINI_GAME_LIBRARY: MiniGameCatalogItem[] = MINI_GAME_LIBRARY_BASE.map((item) => ({
  ...item,
  beta: !STABLE_MINI_GAME_TYPES.has(item.type),
}))

/** Games grouped by difficulty in display order */
export const MINI_GAME_LIBRARY_BY_LEVEL = DIFFICULTY_ORDER.map((level) => ({
  level,
  games: MINI_GAME_LIBRARY.filter((g) => g.difficulty === level),
}))
