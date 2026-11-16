
/**
 * AI Decision Engine for Bonopoly (High-Fidelity Deterministic Version)
 *
 * Implements a heuristic-based "Expert System" that simulates realistic 
 * business decision-making without external APIs. This engine justifies 
 * 'AIDecisionLabs' by providing autonomous, logical competitor agents.
 */

import { SCENARIOS as ENGINE_SCENARIOS, GAME_CONFIG, type GameConfig, getBalancedStartingFinancials } from './gameEngine'

// ============================================================================
// AI PERSONALITIES & PROFILES
// ============================================================================

export type AIPersonality =
  | 'aggressive'      // High volume, low margins, market share focused
  | 'conservative'    // Safe plays, steady profits, low risk
  | 'innovator'       // Heavy R&D investment, premium pricing
  | 'regional_asia'   // Focus on Asian market
  | 'regional_europe' // Focus on European market
  | 'balanced'        // Jack of all trades
  | 'price_leader'    // Lowest prices, volume game
  | 'premium'         // Highest quality, highest prices

export type AIDifficulty = 'easy' | 'medium' | 'hard' | 'expert'

export interface AIProfile {
  personality: AIPersonality
  difficulty: AIDifficulty
  riskTolerance: number
  priceAggression: number
  investmentFocus: number
  marketingIntensity: number
  regionalBias: { us: number; asia: number; europe: number }
}

const AI_PROFILES: Record<AIPersonality, Omit<AIProfile, 'difficulty'>> = {
  aggressive: { personality: 'aggressive', riskTolerance: 75, priceAggression: 70, investmentFocus: 60, marketingIntensity: 80, regionalBias: { us: 40, asia: 35, europe: 25 } },
  conservative: { personality: 'conservative', riskTolerance: 25, priceAggression: 30, investmentFocus: 40, marketingIntensity: 40, regionalBias: { us: 50, asia: 25, europe: 25 } },
  innovator: { personality: 'innovator', riskTolerance: 65, priceAggression: 25, investmentFocus: 90, marketingIntensity: 50, regionalBias: { us: 35, asia: 30, europe: 35 } },
  regional_asia: { personality: 'regional_asia', riskTolerance: 55, priceAggression: 50, investmentFocus: 70, marketingIntensity: 65, regionalBias: { us: 20, asia: 60, europe: 20 } },
  regional_europe: { personality: 'regional_europe', riskTolerance: 45, priceAggression: 35, investmentFocus: 55, marketingIntensity: 60, regionalBias: { us: 20, asia: 20, europe: 60 } },
  balanced: { personality: 'balanced', riskTolerance: 50, priceAggression: 50, investmentFocus: 50, marketingIntensity: 50, regionalBias: { us: 34, asia: 33, europe: 33 } },
  price_leader: { personality: 'price_leader', riskTolerance: 60, priceAggression: 90, investmentFocus: 30, marketingIntensity: 70, regionalBias: { us: 35, asia: 40, europe: 25 } },
  premium: { personality: 'premium', riskTolerance: 40, priceAggression: 15, investmentFocus: 75, marketingIntensity: 55, regionalBias: { us: 40, asia: 25, europe: 35 } },
}

const DIFFICULTY_MODIFIERS: Record<AIDifficulty, { decisionQuality: number, adaptability: number, randomness: number, mistakeChance: number }> = {
  easy: { decisionQuality: 0.6, adaptability: 0.4, randomness: 0.3, mistakeChance: 0.25 },
  medium: { decisionQuality: 0.8, adaptability: 0.7, randomness: 0.15, mistakeChance: 0.10 },
  hard: { decisionQuality: 0.95, adaptability: 0.9, randomness: 0.05, mistakeChance: 0.02 },
  expert: { decisionQuality: 0.99, adaptability: 0.98, randomness: 0.02, mistakeChance: 0.00 },
}

// ============================================================================
// CONTEXT & DECISION TYPES
// ============================================================================

export interface AIDecision {
  production: { usUnits: number; asiaUnits: number; supplierUS: number; supplierAsia: number; overtime: number; outsourceUS: number; outsourceAsia: number }
  hr: { researchStaff: number; trainingLevel: 'basic' | 'standard' | 'advanced' }
  rnd: { researchStaff: number; trainingLevel: 'basic' | 'standard' | 'advanced' }
  investment: { newPlantsUS: number; newPlantsAsia: number }
  logistics: { allocation: { us: { local: number; fromAsia: number }; asia: { local: number; fromUS: number }; europe: { fromUS: number; fromAsia: number } } }
  marketing: { priceUS: number; priceAsia: number; priceEurope: number; promoUS: number; promoAsia: number; promoEurope: number }
  finance: { borrowing: number; repayment: number; shareIssue: number; shareBuyback: number; dividend: number; newPlantsUS: number; newPlantsAsia: number }
}

interface GameContext {
  id?: number; // Team ID
  round: number;
  totalRounds: number;
  scenarioId: number;
  globalSeed?: number; // Added for AIDecisionLabs Reproducibility
  currentState: {
    cash: number;
    debt: number;
    factories: { us: number; asia: number };
    inventory: { us: number; asia: number };
    techLevel: number;
    unlockedFeatures: number;
    brandReputation: number;
  }
}

// ============================================================================
// UTILS
// ============================================================================

function clamp(v: number, min: number, max: number) { return Math.max(min, Math.min(max, v)); }

/**
 * Deterministic PRNG based on a seed
 */
function seededRandom(seed: number) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function deterministicVary(value: number, range: number, seed: number): number {
  const variation = (seededRandom(seed) - 0.5) * 2 * range;
  return Math.round(value + variation);
}

// ============================================================================
// CORE ENGINE LOGIC
// ============================================================================

export function generateAIDecision(
  profile: AIProfile,
  context: GameContext,
  config: GameConfig = GAME_CONFIG
): AIDecision {
  const teamId = context.id || 0;
  const globalBase = context.globalSeed || 42;
  const roundSeed = globalBase + (teamId * 1000) + context.round;
  const scenario = ENGINE_SCENARIOS[context.scenarioId] || ENGINE_SCENARIOS[0];
  const diffMod = DIFFICULTY_MODIFIERS[profile.difficulty];

  // 1. ANALYZE CAPACITY & INVENTORY
  const totalFactories = context.currentState.factories.us + context.currentState.factories.asia;
  const totalCapacity = totalFactories * config.capacityPerPlant;
  const totalInventory = context.currentState.inventory.us + context.currentState.inventory.asia;

  // Logic: Inventory cover ratio (how many units we have relative to one round of full capacity)
  const invCover = totalCapacity > 0 ? totalInventory / totalCapacity : 0;
  const isOutOfStock = invCover < 0.10; // Less than 10% inventory is dangerous
  const isOverstocked = invCover > 0.80; // More than 80% capacity in inventory is expensive

  // 2. GROWTH & EXPANSION HEURISTIC (Dynamic & Heuristic)
  const isLateGame = context.round / context.totalRounds > 0.8;
  let newPlantsUS = 0;
  let newPlantsAsia = 0;

  const plantCostUS = config.investment.plantCostUS;
  const plantCostAsia = config.investment.plantCostAsia;
  const avgPlantCost = (plantCostUS + plantCostAsia) / 2;

  // Decision to expand based on "Supply Stress" and "Cash Overflow"
  // We want the AI to behave like a rational manager: expand if you have cash and demand.
  if (!isLateGame && context.currentState.cash > (avgPlantCost * 1.1)) {
    let expansionDesire = 0;

    // Condition A: Supply Stress (We are running out of product)
    if (isOutOfStock) expansionDesire += 60;

    // Condition B: Business Personality (Growth mindset)
    if (profile.investmentFocus >= 60) expansionDesire += 25; // This catches Aggressive (60)
    if (profile.personality === 'aggressive') expansionDesire += 15;
    if (profile.personality === 'price_leader') expansionDesire += 10;

    // Condition C: Financial Strength (If we have > 3x factory cost in cash, just grow)
    if (context.currentState.cash > avgPlantCost * 3) expansionDesire += 30;

    // Condition D: Post-Innovation Boom (Research Cap Logic)
    // If we've maxed out features (20), we need to scale production to dominate
    if (context.currentState.unlockedFeatures >= 20) expansionDesire += 40;

    // Threshold Check: If desire > 70, we build.
    // Rational result: 
    // - Any personality that is stock-out (60) + has a growth focus (25) = 85 (Grow)
    // - An aggressive player with lots of cash regardless of stock = 15 + 30 + 25 = 70 (Grow)
    if (expansionDesire >= 70) {
      if (profile.personality === 'regional_asia' || scenario.demandModifier.asia > scenario.demandModifier.us) {
        newPlantsAsia = 1;
      } else {
        newPlantsUS = 1;
      }
    }
  }

  // 3. PRODUCTION OPTIMIZATION
  let utilization = 0.85; // Default healthy utilization
  if (isOutOfStock) utilization = 1.0;
  if (isOverstocked) utilization = 0.4;

  if (profile.personality === 'aggressive') utilization = Math.max(utilization, 0.95);
  if (profile.personality === 'conservative') utilization = Math.min(utilization, 0.80);

  const rawProduction = totalCapacity * utilization;
  const usShare = context.currentState.factories.us / Math.max(1, totalFactories);

  const usUnits = Math.round(rawProduction * usShare);
  const asiaUnits = Math.round(rawProduction * (1 - usShare));

  // Overtime heuristic
  let overtime = 0;
  if (isOutOfStock && profile.riskTolerance > 50) overtime = 15;
  if (profile.personality === 'aggressive') overtime = 20;

  // 4. PRICING HEURISTIC (Scenario Mapping)
  const baseline = config.priceDemand.baselinePriceByRegion;
  const personalityPriceMult = {
    aggressive: 0.93, conservative: 1.05, innovator: 1.15, regional_asia: 0.95,
    regional_europe: 1.05, balanced: 1.0, price_leader: 0.85, premium: 1.25
  }[profile.personality] || 1.0;

  let priceUS = baseline.us * personalityPriceMult;
  let priceAsia = baseline.asia * personalityPriceMult;
  let priceEurope = baseline.europe * personalityPriceMult;

  // Adapt to elasticity
  if (scenario.priceElasticityModifier > 1.1) { // Sensitive market
    priceUS *= 0.95; priceAsia *= 0.92; priceEurope *= 0.95;
  }

  // 5. MARKETING & R&D
  const mktIntensity = profile.marketingIntensity / 100;
  const promoUS = clamp(8 * mktIntensity * (profile.regionalBias.us / 33), 2, 15);
  const promoAsia = clamp(8 * mktIntensity * (profile.regionalBias.asia / 33), 2, 15);
  const promoEurope = clamp(8 * mktIntensity * (profile.regionalBias.europe / 33), 2, 15);

  let researchStaff = clamp(Math.round(50 * (profile.investmentFocus / 50)), 10, 100);

  // Innovation Pivot: If max features hit, reduce R&D to maintenance levels
  if (context.currentState.unlockedFeatures >= 20) {
    // This allows the team to stop burning cash on useless R&D once capped
    researchStaff = 15;
  }

  // 6. FINALIZE & APPLY SEEDED VARIATION
  // This ensures AIDecisionLabs is reproducible without APIs
  const variationSeed = roundSeed;

  return {
    production: {
      usUnits: deterministicVary(usUnits, totalCapacity * 0.04 * diffMod.randomness, variationSeed),
      asiaUnits: deterministicVary(asiaUnits, totalCapacity * 0.04 * diffMod.randomness, variationSeed + 1),
      supplierUS: profile.personality === 'premium' ? 4 : 2,
      supplierAsia: profile.personality === 'premium' ? 4 : 2,
      overtime: clamp(overtime, 0, 25),
      outsourceUS: 0, outsourceAsia: 0
    },
    hr: { researchStaff, trainingLevel: profile.investmentFocus > 70 ? 'advanced' : 'standard' },
    rnd: { researchStaff, trainingLevel: profile.investmentFocus > 70 ? 'advanced' : 'standard' },
    investment: { newPlantsUS, newPlantsAsia },
    logistics: {
      allocation: {
        us: { local: 80, fromAsia: 20 },
        asia: { local: 90, fromUS: 10 },
        europe: { fromUS: 50, fromAsia: 50 }
      }
    },
    marketing: {
      priceUS: Math.round(deterministicVary(priceUS, 5 * diffMod.randomness, roundSeed + 2)),
      priceAsia: Math.round(deterministicVary(priceAsia, 5 * diffMod.randomness, roundSeed + 3)),
      priceEurope: Math.round(deterministicVary(priceEurope, 5 * diffMod.randomness, roundSeed + 4)),
      promoUS: Math.round(promoUS),
      promoAsia: Math.round(promoAsia),
      promoEurope: Math.round(promoEurope)
    },
    finance: {
      borrowing: (newPlantsUS + newPlantsAsia > 0 && context.currentState.cash < avgPlantCost) ? Math.round(avgPlantCost) : 0,
      repayment: (context.currentState.debt > 0 && context.currentState.cash > 20000000) ? 5000000 : 0,
      shareIssue: 0, shareBuyback: 0,
      dividend: (isLateGame && context.currentState.cash > 30000000) ? Math.round(context.currentState.cash * 0.1) : 0,
      newPlantsUS, newPlantsAsia
    }
  }
}

// 7. PUBLIC API HELPERS

export function getRandomAIProfile(difficulty: AIDifficulty = 'medium'): AIProfile {
  const personalities: AIPersonality[] = ['aggressive', 'conservative', 'innovator', 'regional_asia', 'regional_europe', 'balanced', 'price_leader', 'premium'];
  const personality = personalities[Math.floor(Math.random() * personalities.length)];
  return { ...AI_PROFILES[personality], difficulty };
}

export function getAIProfile(personality: AIPersonality, difficulty: AIDifficulty): AIProfile {
  return { ...AI_PROFILES[personality], difficulty };
}

export function generateInitialAIDecision(profile: AIProfile, scenarioId: number, totalRounds: number = 3, config: GameConfig = GAME_CONFIG, seed?: number): AIDecision {
  const starting = getBalancedStartingFinancials(config);
  const context: GameContext = {
    round: 0, totalRounds, scenarioId, globalSeed: seed,
    currentState: { cash: starting.startingCash, debt: starting.startingDebt, factories: { ...config.initialFactories }, inventory: { us: 0, asia: 0 }, techLevel: 1, unlockedFeatures: 0, brandReputation: 50 }
  };
  return generateAIDecision(profile, context, config);
}

export function assignAIProfiles(count: number, difficulties: AIDifficulty[] = ['medium']): AIProfile[] {
  const personalities: AIPersonality[] = ['aggressive', 'conservative', 'innovator', 'regional_asia', 'regional_europe', 'balanced', 'price_leader', 'premium'];
  const shuffled = [...personalities].sort(() => Math.random() - 0.5);
  const profiles: AIProfile[] = [];
  for (let i = 0; i < count; i++) {
    profiles.push(getAIProfile(shuffled[i % shuffled.length], difficulties[i] || difficulties[0] || 'medium'));
  }
  return profiles;
}

export function getAIProfileDescription(profile: AIProfile): string {
  const personalityNames: Record<AIPersonality, string> = {
    aggressive: 'Aggressive Competitor', conservative: 'Steady & Safe', innovator: 'Tech Innovator',
    regional_asia: 'Asia Specialist', regional_europe: 'Europe Focus', balanced: 'Well-Rounded',
    price_leader: 'Price Fighter', premium: 'Premium Player'
  };
  const difficultyNames: Record<AIDifficulty, string> = { easy: 'Rookie', medium: 'Experienced', hard: 'Expert', expert: 'Grandmaster' };
  return `${difficultyNames[profile.difficulty]} ${personalityNames[profile.personality]}`;
}
