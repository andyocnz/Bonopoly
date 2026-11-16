/**
 * AI Strategy Engine - Game Theory Strategies for Bonopoly
 *
 * Implements various game theory strategies (Tit-for-Tat, Predatory Pricing, etc.)
 * that can be applied to AI teams in simulation mode.
 */

import type { Decision } from '../types/game'


// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export type StrategyCategory = 'pricing' | 'production' | 'investment' | 'regional' | 'mixed'

export interface GameTheoryStrategy {
  id: string
  name: string
  description: string
  category: StrategyCategory

  // Core strategy logic
  execute: (context: StrategyContext) => DecisionModifiers | Promise<DecisionModifiers>

  // Optional: strategy-specific state that persists across rounds
  state?: Record<string, unknown>
}

export interface StrategyContext {
  // Current round info
  round: number
  totalRounds: number
  scenarioId: number

  // My team's current state
  myTeam: TeamState

  // Competitor information
  competitors: TeamState[]

  // Market data
  marketData: MarketData

  // Historical data (last 3 rounds)
  history: RoundHistory[]

  // Strategy-specific state
  strategyState: Record<string, unknown>
}

export interface TeamState {
  id: number
  name: string

  // Financial
  cash: number
  debt: number
  sharePrice: number
  marketCap: number

  // Operations
  factories: { us: number; asia: number }
  inventory: { us: number; asia: number }
  production: { us: number; asia: number }

  // Market performance
  marketShare: { us: number; asia: number; europe: number }
  sales: { us: number; asia: number; europe: number }

  // Pricing
  prices: { us: number; asia: number; europe: number }

  // Previous round data (for reactive strategies)
  previousPrices?: { us: number; asia: number; europe: number }
  previousProduction?: { us: number; asia: number }
  previousDecision?: Decision
}

export interface MarketData {
  // Market averages
  avgPrice: { us: number; asia: number; europe: number }
  avgMarketShare: number

  // Demand info
  totalDemand: { us: number; asia: number; europe: number }

  // Competition intensity
  competitorCount: number
  priceRange: { min: number; max: number }
}

export interface RoundHistory {
  round: number
  myDecision: Decision
  myResults: Partial<TeamState>
  marketSnapshot: Partial<MarketData>
}

export interface DecisionModifiers {
  // Pricing modifiers (applied to AI's base price decision)
  priceMultiplier?: {
    us?: number      // e.g., 0.9 = 10% discount
    asia?: number
    europe?: number
  }
  absolutePrices?: {
    us?: number      // Override price entirely
    asia?: number
    europe?: number
  }

  // Production modifiers
  productionMultiplier?: number | { us: number; asia: number }  // e.g., 1.2 or { us: 1.2, asia: 1.0 }

  // Investment modifiers
  rdInvestmentMultiplier?: number  // e.g., 1.5 = 50% more R&D
  forceInvestment?: { us: number, asia: number } // Force specific plant counts
  blockInvestment?: boolean        // Prevent factory investment

  // Regional focus
  regionalFocus?: 'us' | 'asia' | 'europe'  // Focus marketing/production here

  // Special flags
  cooperativeMode?: boolean        // High prices, low aggression
  aggressiveMode?: boolean         // Low prices, high volume
}

// ============================================================================
// STRATEGY IMPLEMENTATIONS
// ============================================================================

/**
 * Strategy 1: Tit-for-Tat (Cooperative Pricing)
 *
 * Start cooperating (fair prices), then mirror competitor's previous move.
 * If competitor cuts price, we cut. If competitor raises, we raise.
 *
 * Game Theory: Famous strategy from Axelrod's tournaments.
 * Nice, retaliatory, forgiving, clear.
 */
export const TitForTatStrategy: GameTheoryStrategy = {
  id: 'tit-for-tat',
  name: 'Tit-for-Tat',
  description: 'Cooperative pricing. Start fair, then mirror competitors\' price changes.',
  category: 'pricing',

  execute: (context: StrategyContext): DecisionModifiers => {
    const { round, competitors, strategyState } = context

    // Round 1: Start with cooperative pricing (slightly above market average)
    if (round === 1) {
      strategyState.mode = 'cooperative'
      return {
        priceMultiplier: {
          us: 1.05,    // 5% above base
          asia: 1.05,
          europe: 1.05
        },
        cooperativeMode: true
      }
    }

    const marketLeader = competitors.reduce((prev, current) =>
      current.sharePrice > prev.sharePrice ? current : prev
    )

    // 2. MIRROR PRICING (The reaction)
    const hasHistory = marketLeader.previousPrices &&
      marketLeader.previousPrices.us > 0;

    let usPriceChange = 0
    let asiaPriceChange = 0
    let europePriceChange = 0

    if (hasHistory) {
      usPriceChange = (marketLeader.prices.us - marketLeader.previousPrices!.us) / marketLeader.previousPrices!.us
      asiaPriceChange = (marketLeader.prices.asia - marketLeader.previousPrices!.asia) / marketLeader.previousPrices!.asia
      europePriceChange = (marketLeader.prices.europe - marketLeader.previousPrices!.europe) / marketLeader.previousPrices!.europe
    }

    // 3. MIRROR STRATEGIC POSTURE (The "Move")
    const leadDecision = marketLeader.previousDecision

    // Mirror exact factory expansion (Location-aware)
    const forceInvestment = leadDecision?.investment
      && (leadDecision.investment.newPlantsUS > 0 || leadDecision.investment.newPlantsAsia > 0)
      ? { us: leadDecision.investment.newPlantsUS, asia: leadDecision.investment.newPlantsAsia }
      : undefined

    // Mirror R&D effort (Relative staff levels)
    // If leader is outspending us on R&D, match them
    const leadRDStaff = leadDecision?.rnd.researchStaff || 50
    const myLastRD = context.myTeam.previousDecision?.rnd.researchStaff || 50
    const rdMultiplier = myLastRD > 0 ? leadRDStaff / myLastRD : (leadRDStaff / 50)

    return {
      priceMultiplier: {
        us: 1 + usPriceChange,
        asia: 1 + asiaPriceChange,
        europe: 1 + europePriceChange
      },
      forceInvestment,
      rdInvestmentMultiplier: rdMultiplier,
      cooperativeMode: !hasHistory || (usPriceChange >= 0 && asiaPriceChange >= 0)
    }
  },

  state: { mode: 'cooperative' }
}

/**
 * Strategy 2: Predatory Pricing (Always Defect)
 *
 * Always undercut competitors. Accept low margins to gain market share.
 *
 * Game Theory: Defection strategy. High risk, aims to dominate through volume.
 */
export const PredatoryPricingStrategy: GameTheoryStrategy = {
  id: 'predatory-pricing',
  name: 'Predatory Pricing',
  description: 'Always undercut competitors by 5-10%. Maximize market share.',
  category: 'pricing',

  execute: (context: StrategyContext): DecisionModifiers => {
    const { competitors } = context

    if (competitors.length === 0) {
      // No competitors, price low anyway
      return { priceMultiplier: { us: 0.90, asia: 0.90, europe: 0.90 } }
    }

    // Find lowest competitor price in each region
    // const lowestPrices = competitors.reduce((acc, comp) => ({
    //   us: Math.min(acc.us, comp.prices.us),
    //   asia: Math.min(acc.asia, comp.prices.asia),
    //   europe: Math.min(acc.europe, comp.prices.europe)
    // }), {
    //   us: Infinity,
    //   asia: Infinity,
    //   europe: Infinity
    // })

    // Undercut by 5-8%
    const undercut = 0.93 // 7% lower

    return {
      priceMultiplier: {
        us: undercut,
        asia: undercut,
        europe: undercut
      },
      productionMultiplier: 1.1,  // Produce more to capture share
      aggressiveMode: true
    }
  }
}

/**
 * Strategy 3: Premium Strategy (Price Skimming)
 *
 * Always price high. Invest heavily in quality/brand to justify premium.
 *
 * Game Theory: Differentiation strategy. Low volume, high margins.
 */
export const PremiumStrategy: GameTheoryStrategy = {
  id: 'premium',
  name: 'Premium Strategy',
  description: 'Price 20-30% above market. Focus on quality and brand.',
  category: 'pricing',

  execute: (context: StrategyContext): DecisionModifiers => {
    void context
    return {
      priceMultiplier: {
        us: 1.25,     // 25% premium
        asia: 1.20,   // Slightly lower in price-sensitive Asia
        europe: 1.30  // Highest in Europe
      },
      rdInvestmentMultiplier: 1.5,  // 50% more R&D investment
      productionMultiplier: 0.7,    // Lower volume, high margin
      cooperativeMode: true
    }
  }
}

/**
 * Strategy 4: Capacity Leader (First Mover)
 *
 * Invest heavily in factories early. Commit to high volume production.
 *
 * Game Theory: First-mover advantage, economies of scale.
 */
export const CapacityLeaderStrategy: GameTheoryStrategy = {
  id: 'capacity-leader',
  name: 'Capacity Leader',
  description: 'Invest in factories early (rounds 1-5). Produce at max capacity.',
  category: 'production',

  execute: (context: StrategyContext): DecisionModifiers => {
    const { round, totalRounds } = context
    const gameProgress = round / totalRounds

    // Early game: invest aggressively
    if (gameProgress < 0.3) {
      return {
        forceInvestment: { us: 1, asia: 0 },
        productionMultiplier: 0.95,  // Produce near max from start
        priceMultiplier: { us: 0.95, asia: 0.95, europe: 0.95 } // Competitive pricing
      }
    }

    // Mid/late game: leverage capacity advantage
    return {
      productionMultiplier: 1.0,  // Max capacity
      priceMultiplier: { us: 0.92, asia: 0.92, europe: 0.92 } // Undercut with economies of scale
    }
  }
}

/**
 * Strategy 5: Regional Specialist (Asia Focus)
 *
 * Focus 80% of effort on one region. Dominate niche vs compete globally.
 *
 * Game Theory: Niche strategy, regional dominance.
 */
export const RegionalSpecialistStrategy: GameTheoryStrategy = {
  id: 'regional-asia',
  name: 'Regional Specialist (Asia)',
  description: 'Focus on Asia market. Price aggressively in Asia, premium elsewhere.',
  category: 'regional',

  execute: (context: StrategyContext): DecisionModifiers => {
    void context
    return {
      priceMultiplier: {
        us: 1.30,     // Premium in US (low focus)
        asia: 0.88,   // Aggressive in Asia (main focus)
        europe: 1.25  // Premium in Europe (low focus)
      },
      regionalFocus: 'asia',
      productionMultiplier: 1.0
    }
  }
}

/**
 * Strategy 6: Pure Innovator (R&D Focused)
 *
 * Invest heavily in R&D regardless of competitors. Focus on feature quality.
 */
export const InnovatorStrategy: GameTheoryStrategy = {
  id: 'innovator',
  name: 'Pure Innovator',
  description: 'Heavy R&D focus (+100%). High prices, low volume, aiming for feature dominance.',
  category: 'mixed',

  execute: (context: StrategyContext): DecisionModifiers => {
    void context
    return {
      priceMultiplier: {
        us: 1.35,     // Very high premium
        asia: 1.25,
        europe: 1.40
      },
      rdInvestmentMultiplier: 2.0,  // Double R&D
      productionMultiplier: 0.6,    // Focus on quality over scale
      cooperativeMode: true
    }
  }
}

/**
 * Strategy 7: Adaptive Strategy
 *
 * Changes behavior based on market conditions.
 * Aggressive in growth markets, defensive in recessions.
 */
export const AdaptiveStrategy: GameTheoryStrategy = {
  id: 'adaptive',
  name: 'Adaptive',
  description: 'Adjusts strategy based on market conditions - aggressive in growth, defensive in downturns.',
  category: 'mixed',

  execute: (context: StrategyContext): DecisionModifiers => {
    const { history } = context

    // Detect market condition based on average price trends
    let marketCondition: 'growth' | 'stable' | 'recession' = 'stable'

    if (history.length >= 2) {
      const recentPriceChange = history[history.length - 1]?.marketSnapshot?.avgPrice?.us || 100
      const olderPriceChange = history[history.length - 2]?.marketSnapshot?.avgPrice?.us || 100

      // Safety check: avoid division by zero
      if (olderPriceChange > 0) {
        const priceChangeRate = (recentPriceChange - olderPriceChange) / olderPriceChange

        if (priceChangeRate > 0.05) {
          marketCondition = 'growth'
        } else if (priceChangeRate < -0.05) {
          marketCondition = 'recession'
        }
      }
    }

    // Adapt strategy based on market condition
    if (marketCondition === 'growth') {
      // Growth: Invest aggressively, premium pricing
      return {
        priceMultiplier: { us: 1.10, asia: 1.10, europe: 1.10 },
        productionMultiplier: { us: 1.15, asia: 1.15 },
        rdInvestmentMultiplier: 1.3,
        cooperativeMode: true
      }
    } else if (marketCondition === 'recession') {
      // Recession: Cut costs, competitive pricing, preserve cash
      return {
        priceMultiplier: { us: 0.95, asia: 0.95, europe: 0.95 },
        productionMultiplier: { us: 0.85, asia: 0.85 },
        rdInvestmentMultiplier: 0.7,
        cooperativeMode: false
      }
    } else {
      // Stable: Balanced approach
      return {
        priceMultiplier: { us: 1.0, asia: 1.0, europe: 1.0 },
        productionMultiplier: { us: 1.0, asia: 1.0 },
        rdInvestmentMultiplier: 1.0,
        cooperativeMode: true
      }
    }
  },

  state: { marketCondition: 'stable' }
}

/**
 * Strategy 8: Mean Reversion
 *
 * Targets market average pricing. Pulls prices toward the mean.
 * Game Theory: Stabilizing force that prevents extreme deviations.
 */
export const MeanReversionStrategy: GameTheoryStrategy = {
  id: 'mean-reversion',
  name: 'Mean Reversion',
  description: 'Targets market average pricing. Stabilizes prices and prevents extremes.',
  category: 'pricing',

  execute: (context: StrategyContext): DecisionModifiers => {
    const { marketData, myTeam, round } = context

    // First round or no price data: start at baseline
    if (round === 1 || !myTeam.prices || myTeam.prices.us === 0) {
      return {
        priceMultiplier: { us: 1.0, asia: 1.0, europe: 1.0 },
        cooperativeMode: true
      }
    }

    // Calculate how far we are from market average (with safety checks)
    const avgUs = marketData.avgPrice?.us || 100
    const avgAsia = marketData.avgPrice?.asia || 90
    const avgEurope = marketData.avgPrice?.europe || 110

    const usDeviation = myTeam.prices.us > 0 ? avgUs / myTeam.prices.us : 1.0
    const asiaDeviation = myTeam.prices.asia > 0 ? avgAsia / myTeam.prices.asia : 1.0
    const europeDeviation = myTeam.prices.europe > 0 ? avgEurope / myTeam.prices.europe : 1.0

    // Move 50% toward the mean each round (strong reversion)
    const reversionSpeed = 0.5

    // Clamp multipliers to reasonable range
    const clamp = (val: number) => Math.max(0.8, Math.min(1.2, val))

    return {
      priceMultiplier: {
        us: clamp(1 + (usDeviation - 1) * reversionSpeed),
        asia: clamp(1 + (asiaDeviation - 1) * reversionSpeed),
        europe: clamp(1 + (europeDeviation - 1) * reversionSpeed)
      },
      cooperativeMode: true
    }
  },

  state: {}
}

/**
 * Strategy 9: Momentum
 *
 * Follows recent trends. If prices are rising, raise them more.
 * If falling, cut them further. Trend-following strategy.
 */
export const MomentumStrategy: GameTheoryStrategy = {
  id: 'momentum',
  name: 'Momentum',
  description: 'Follows market trends. Amplifies price movements in the direction of recent changes.',
  category: 'pricing',

  execute: (context: StrategyContext): DecisionModifiers => {
    const { history } = context

    // Need at least 2 rounds of history to detect momentum
    if (history.length < 2) {
      return {
        priceMultiplier: { us: 1.0, asia: 1.0, europe: 1.0 },
        cooperativeMode: true
      }
    }

    // Calculate price momentum from market average
    const recent = history[history.length - 1]?.marketSnapshot?.avgPrice?.us || 100
    const older = history[history.length - 2]?.marketSnapshot?.avgPrice?.us || 100

    const momentum = older > 0 ? (recent - older) / older : 0

    // Amplify the momentum by 1.5x
    const amplification = 1.5
    const adjustedMultiplier = 1 + (momentum * amplification)

    // Clamp to reasonable range (0.85 to 1.15)
    const clampedMultiplier = Math.max(0.85, Math.min(1.15, adjustedMultiplier))

    return {
      priceMultiplier: {
        us: clampedMultiplier,
        asia: clampedMultiplier,
        europe: clampedMultiplier
      },
      cooperativeMode: momentum >= 0
    }
  },

  state: {}
}

/**
 * Strategy 10: Mixed Strategy (True Game Theory)
 *
 * Randomizes decisions to be unpredictable.
 * Classic game theory: prevents opponents from exploiting patterns.
 */
export const MixedStrategy: GameTheoryStrategy = {
  id: 'mixed',
  name: 'Mixed Strategy',
  description: 'Randomizes pricing decisions. Unpredictable and unexploitable.',
  category: 'mixed',

  execute: (context: StrategyContext): DecisionModifiers => {
    void context
    // Random price between 0.90 and 1.15 (±10% to +15%)
    const randomPrice = () => 0.90 + Math.random() * 0.25

    // Randomly decide to be cooperative or competitive
    const isCooperative = Math.random() > 0.5

    // Random production adjustment
    const randomProduction = () => 0.85 + Math.random() * 0.30

    return {
      priceMultiplier: {
        us: randomPrice(),
        asia: randomPrice(),
        europe: randomPrice()
      },
      productionMultiplier: {
        us: randomProduction(),
        asia: randomProduction()
      },
      rdInvestmentMultiplier: 0.8 + Math.random() * 0.4, // 0.8 to 1.2
      cooperativeMode: isCooperative
    }
  },

  state: {}
}

/**
 * Strategy 11: Grim Trigger
 *
 * Cooperative until betrayed, then defects forever.
 * Classic game theory: enforces cooperation through credible punishment.
 */
export const GrimTriggerStrategy: GameTheoryStrategy = {
  id: 'grim-trigger',
  name: 'Grim Trigger',
  description: 'Cooperative until a competitor defects, then becomes permanently aggressive.',
  category: 'pricing',

  execute: (context: StrategyContext): DecisionModifiers => {
    const { competitors, strategyState, round } = context

    // Initialize as cooperative
    if (round === 1) {
      strategyState.triggered = false
      strategyState.betrayer = null
    }

    // Check if anyone has "betrayed" (dropped prices significantly)
    if (!strategyState.triggered && competitors.length > 0) {
      for (const comp of competitors) {
        // Safety checks for prices
        if (comp.previousPrices && comp.previousPrices.us > 0 && comp.prices && comp.prices.us > 0) {
          const priceChange = (comp.prices.us - comp.previousPrices.us) / comp.previousPrices.us

          // If competitor cut prices by more than 10%, consider it betrayal
          if (priceChange < -0.10) {
            strategyState.triggered = true
            strategyState.betrayer = comp.name
            break
          }
        }
      }
    }

    if (strategyState.triggered) {
      // Permanently aggressive after being triggered
      return {
        priceMultiplier: { us: 0.85, asia: 0.85, europe: 0.85 },
        productionMultiplier: { us: 1.2, asia: 1.2 },
        cooperativeMode: false
      }
    } else {
      // Cooperative mode
      return {
        priceMultiplier: { us: 1.08, asia: 1.08, europe: 1.08 },
        cooperativeMode: true
      }
    }
  },

  state: { triggered: false, betrayer: null }
}

/**
 * Strategy 12: Win-Stay-Lose-Shift
 *
 * Repeats successful moves, changes strategy after losses.
 * Reinforcement learning approach.
 */
export const WinStayLoseShiftStrategy: GameTheoryStrategy = {
  id: 'win-stay-lose-shift',
  name: 'Win-Stay-Lose-Shift',
  description: 'Repeats winning strategies, shifts after losses. Learning-based approach.',
  category: 'mixed',

  execute: (context: StrategyContext): DecisionModifiers => {
    const { myTeam, strategyState, round } = context

    // Initialize
    if (round === 1) {
      strategyState.lastPriceMultiplier = 1.0
      strategyState.lastSharePrice = myTeam.sharePrice
      return {
        priceMultiplier: { us: 1.0, asia: 1.0, europe: 1.0 },
        cooperativeMode: true
      }
    }

    // Check if last move was winning (share price increased)
    const currentSharePrice = myTeam.sharePrice || 100
    const lastSharePrice = strategyState.lastSharePrice || 100
    const wasWinning = currentSharePrice > lastSharePrice

    let newMultiplier: number

    if (wasWinning) {
      // WIN-STAY: Keep the same strategy
      newMultiplier = strategyState.lastPriceMultiplier || 1.0
    } else {
      // LOSE-SHIFT: Try something different
      // Randomly shift strategy
      const shifts = [0.90, 0.95, 1.05, 1.10, 1.15]
      newMultiplier = shifts[Math.floor(Math.random() * shifts.length)]
    }

    // Store for next round (use fallback if undefined)
    strategyState.lastPriceMultiplier = newMultiplier
    strategyState.lastSharePrice = currentSharePrice

    return {
      priceMultiplier: {
        us: newMultiplier,
        asia: newMultiplier,
        europe: newMultiplier
      },
      cooperativeMode: wasWinning
    }
  },

  state: { lastPriceMultiplier: 1.0, lastSharePrice: 100 }
}

// ============================================================================
// STRATEGY REGISTRY
// ============================================================================

export const AVAILABLE_STRATEGIES: Record<string, GameTheoryStrategy> = {
  'tit-for-tat': TitForTatStrategy,
  'predatory-pricing': PredatoryPricingStrategy,
  'premium': PremiumStrategy,
  'capacity-leader': CapacityLeaderStrategy,
  'regional-asia': RegionalSpecialistStrategy,
  'innovator': InnovatorStrategy,
  'adaptive': AdaptiveStrategy,
  'mean-reversion': MeanReversionStrategy,
  'momentum': MomentumStrategy,
  'mixed': MixedStrategy,
  'grim-trigger': GrimTriggerStrategy,
  'win-stay-lose-shift': WinStayLoseShiftStrategy
}
const BUILT_IN_STRATEGY_IDS = new Set(Object.keys(AVAILABLE_STRATEGIES))
const CUSTOM_STRATEGY_IDS = new Set<string>()

/**
 * Get all available strategies
 */
export function getAllStrategies(): GameTheoryStrategy[] {
  return Object.values(AVAILABLE_STRATEGIES)
}

/**
 * Get strategy by ID
 */
export function getStrategy(id: string): GameTheoryStrategy | undefined {
  return AVAILABLE_STRATEGIES[id]
}

/**
 * Get strategies by category
 */
export function getStrategiesByCategory(category: StrategyCategory): GameTheoryStrategy[] {
  return Object.values(AVAILABLE_STRATEGIES).filter(s => s.category === category)
}

export function registerCustomStrategy(strategy: GameTheoryStrategy): void {
  if (!strategy?.id) {
    throw new Error('Custom strategy requires a valid id')
  }
  if (BUILT_IN_STRATEGY_IDS.has(strategy.id)) {
    throw new Error(`Cannot override built-in strategy: ${strategy.id}`)
  }

  AVAILABLE_STRATEGIES[strategy.id] = strategy
  CUSTOM_STRATEGY_IDS.add(strategy.id)
}

export function unregisterCustomStrategy(strategyId: string): void {
  if (!CUSTOM_STRATEGY_IDS.has(strategyId)) return
  delete AVAILABLE_STRATEGIES[strategyId]
  CUSTOM_STRATEGY_IDS.delete(strategyId)
}

export function clearCustomStrategies(): void {
  for (const strategyId of CUSTOM_STRATEGY_IDS) {
    delete AVAILABLE_STRATEGIES[strategyId]
  }
  CUSTOM_STRATEGY_IDS.clear()
}

export function getCustomStrategyIds(): string[] {
  return Array.from(CUSTOM_STRATEGY_IDS)
}

export function isCustomStrategy(strategyId: string): boolean {
  return CUSTOM_STRATEGY_IDS.has(strategyId)
}
