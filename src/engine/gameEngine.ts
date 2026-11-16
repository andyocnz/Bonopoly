/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
/**
 * Bonopoly Game Calculation Engine v3.2
 *
 * =============================================================================
 * GAME MECHANICS
 * =============================================================================
 *
 * 1. PRODUCTION/CAPACITY:
 *    - Teams start with 2 US factories, 0 Asia factories (default)
 *    - IF factories = 0 in a region, production capacity = 0
 *    - Capacity = factories × capacity_per_plant × (allocation% / 100)
 *    - Outsourcing is a SEPARATE capacity pool with its own limit
 *
 * 2. HR → RESEARCH HOURS:
 *    - Research Hours = workers × mandays_per_worker
 *    - Training increases efficiency
 *    - Hours accumulate across rounds for features
 *
 * 3. FEATURE UNLOCK SYSTEM:
 *    - Each feature requires X research hours (accumulates across rounds)
 *    - Features are unlocked sequentially (can't skip)
 *
 * 4. QUALITY / TECH SCORE:
 *    - "Tech Investment" (cash spend) has been REMOVED.
 *    - Tech Score is now fixed (baseTechScore) or could be driven by features.
 *    - Currently fixed at 50 to simplify the model.
 *
 * 5. MARKET SHARE:
 *    - Attractiveness-based (price, features, promotion)
 *    - Units sold = MIN(demand_share, production_capacity)
 *    - Unfulfilled demand redistributes to competitors
 */

import type {
  TeamState,
  TeamDecisions,
  RegionKey,
} from '../components/DecisionSimulator'
import scenariosData from './scenarios.json'
import {
  calculateLogisticsAllocation,
  calculateTotalLogisticsCost,
  applyLogisticsTariffModifiers,
  type LogisticsInput,
} from '../utils/logisticsAllocation'

// ============================================================================
// GAME CONFIGURATION
// ============================================================================

export interface RoundScenario {
  id: number
  name: string
  description: string
  hints: string[]
  econBrief?: { gdp: string; inflation: string; rates: string; pmi: string; currency: string }
  logisticsTariff?: Partial<{
    usToUs: number
    usToAsia: number
    usToEurope: number
    asiaToUs: number
    asiaToAsia: number
    asiaToEurope: number
    europeToUs: number
    europeToAsia: number
  }>
  demandModifier: { us: number; asia: number; europe: number }
  priceElasticityModifier: number
  csrImportanceModifier: number
  marketingEffectModifier: number
  costInflation: number
  investmentCostMultiplier: number
  interestRateSpread: number
  taxRateDeltaByRegion: { us: number; asia: number; europe: number }
  workingCapitalDelta: { inventory: number; receivable: number; payable: number }
}

export type FeatureDefinition = {
  id: number
  emoji: string
  name: string
}


const scenariosRaw = scenariosData as Record<string, RoundScenario>
export const SCENARIOS: Record<number, RoundScenario> = Object.fromEntries(
  Object.entries(scenariosRaw).map(([key, value]) => [Number(key), value])
) as Record<number, RoundScenario>


export const GAME_CONFIG = {
  featuresLabel: undefined as string | undefined,
  featureCatalog: [
    { id: 1, emoji: '📶', name: 'Wi-Fi 6' },
    { id: 2, emoji: '🔋', name: 'Fast Charge' },
    { id: 3, emoji: '🔐', name: 'Secure Enclave' },
    { id: 4, emoji: '🎧', name: 'Spatial Audio' },
    { id: 5, emoji: '📱', name: 'Multi-Device Sync' },
    { id: 6, emoji: '🧠', name: 'On-Device AI' },
    { id: 7, emoji: '📷', name: 'Computational Camera' },
    { id: 8, emoji: '🪟', name: 'Adaptive Display' },
    { id: 9, emoji: '🛰️', name: 'Precision GPS' },
    { id: 10, emoji: '🌡️', name: 'Thermal Control' },
    { id: 11, emoji: '🔒', name: 'Biometric Lock' },
    { id: 12, emoji: '☁️', name: 'Cloud Backup' },
    { id: 13, emoji: '⚙️', name: 'Modular Design' },
    { id: 14, emoji: '🔊', name: 'Smart Assist' },
    { id: 15, emoji: '🧪', name: 'Nano-Coating' },
    { id: 16, emoji: '🧭', name: 'Ultra-Wideband' },
    { id: 17, emoji: '🔋', name: 'All-Day Battery+' },
    { id: 18, emoji: '🧰', name: 'Self-Diagnostics' },
    { id: 19, emoji: '🧬', name: 'Chipset Gen-X' },
    { id: 20, emoji: '🚀', name: 'Quantum-Ready' },
  ] as FeatureDefinition[],
  // Initial factory state - teams start with 1 US plant only
  initialFactories: {
    us: 1,    // Start with 1 US factory
    asia: 0,  // Start with 0 Asia factories
  },

  // Capacity per plant (units per round)
  capacityPerPlant: 325_000,

  // Outsourcing - SEPARATE pool from factory production
  outsourcing: {
    maxCapacityUS: 200_000,
    maxCapacityAsia: 200_000,
    costPremium: 0.30,
  },

  // Market demand configuration
  marketDemandConfig: {
    defaultRegionSplit: {
      us: 0.22,
      asia: 0.60,
      europe: 0.18,
    } as Record<RegionKey, number>,
    modeMultipliers: {
      balanced: 1.0,
      blue_ocean: 2.0,
      high_competition: 0.75,
    } as Record<string, number>,
  },

  // NOTE: baseMarketDemand was removed. Market demand is now calculated dynamically:
  // Base Demand = capacityPerPlant × 1 × numTeams, then split by region using marketDemandConfig.defaultRegionSplit

  marketGrowthRate: {
    us: 3,
    asia: 8,
    europe: 2,
  } as Record<RegionKey, number>,

  marketPreferences: {
    us: { priceWeight: 0.22, qualityWeight: 0.25, featuresWeight: 0.28, promotionWeight: 0.05, csrWeight: 0.15, trainingWeight: 0.05 },     // Features: 20% → 28% (+8%)
    asia: { priceWeight: 0.40, qualityWeight: 0.17, featuresWeight: 0.28, promotionWeight: 0.05, csrWeight: 0.05, trainingWeight: 0.05 },   // Features: 20% → 28% (+8%)
    europe: { priceWeight: 0.18, qualityWeight: 0.25, featuresWeight: 0.22, promotionWeight: 0.10, csrWeight: 0.20, trainingWeight: 0.05 }, // Features: 15% → 22% (+7%)
  } as Record<RegionKey, { priceWeight: number; qualityWeight: number; featuresWeight: number; promotionWeight: number; csrWeight: number; trainingWeight: number }>,

  supplierCSR: {
    1: 1,
    2: 2,
    3: 4,
    4: 3,
  } as Record<1 | 2 | 3 | 4, number>,

  unitCosts: {
    directMaterialUS: 22,
    directMaterialAsia: 18,
    directLabourUS: 14,
    directLabourAsia: 7,
    // Supplier multiplier applied to (material + labor)
    supplier: {
      1: 1.00, // Budget: baseline
      2: 1.05, // Standard
      3: 1.10, // Eco-Friendly
      4: 1.15, // Premium
    } as Record<1 | 2 | 3 | 4, number>,
  },

  logisticsTariff: {
    usToUs: 0,
    usToAsia: 10,
    usToEurope: 7,
    asiaToUs: 10,
    asiaToAsia: 0,
    asiaToEurope: 9,
  },

  costCurve: {
    optimalUtilization: 0.8,
    curvature: 4.0,
  },

  scoringCurves: {
    priceExponent: 0.35,
    priceClampMin: 60,
    priceClampMax: 140,
    promotionK: 0.08,
    featuresK: 0.15,  // Was 0.25 - gentler curve for slower diminishing returns
    trainingK: 0.35,
    baseTechScore: 50, // Base quality score, enhanced by features (+2 per feature, max +30)
  },

  priceDemand: {
    baselinePriceByRegion: { us: 125, asia: 115, europe: 130 },
    elasticityByRegion: { us: 0.6, asia: 1.0, europe: 0.8 },
    minPriceByRegion: { us: 80, asia: 70, europe: 85 },
    maxPriceByRegion: { us: 220, asia: 200, europe: 230 },
    minDemandMultiplier: 0.05,
    maxDemandMultiplier: 1.2,
    penaltyK: 2.2,
    penaltyFloor: 0.02,
    penaltyCapMultiple: 2.5,
  },

  demandRedistribution: {
    qualityShrinkageEnabled: true,  // Apply quality-based conversion when redistributing unmet demand
    minAttractivenessForFallback: 30,  // Below this attractiveness, demand shrinks proportionally
  },

  hr: {
    mandaysPerWorker: 1500,
    baseEfficiency: 1.0,
    trainingEfficiencyBoost: 0.10,
    adminStaffFloor: 10,
    adminOverheadPercent: 0.20, // Default 20% overhead
    adminRevenuePercent: 0.03, // Admin cost as % of revenue (3% = realistic for large manufacturers)
    adminIdleMultiplier: 3.0, // Multiply admin cost by this when production = 0 (idle factories penalty)
    inventoryHoldingCostPercent: 0.01, // 1% annual holding cost (warehousing, insurance, obsolescence)
    minWageByRegion: {
      us: 4000,
      asia: 1500,
    },
    trainingCostPerStaff: {
      basic: 0,
      standard: 2000,
      advanced: 5000,
    },
    trainingCostMultiplierByRegion: {
      us: 1,
      asia: 0.6,
    },
  },

  featureResearchHours: {
    1: 20_000,      // Was 50,000 (-60%)
    2: 48_000,      // Was 120,000 (-60%)
    3: 80_000,      // Was 200,000 (-60%)
    4: 120_000,     // Was 300,000 (-60%)
    5: 168_000,     // Was 420,000 (-60%)
    6: 224_000,     // Was 560,000 (-60%)
    7: 288_000,     // Was 720,000 (-60%)
    8: 360_000,     // Was 900,000 (-60%)
    9: 440_000,     // Was 1,100,000 (-60%)
    10: 528_000,    // Was 1,320,000 (-60%)
    11: 640_000,    // Was 1,600,000 (-60%)
    12: 780_000,    // Was 1,950,000 (-60%)
    13: 940_000,    // Was 2,350,000 (-60%)
    14: 1_140_000,  // Was 2,850,000 (-60%)
    15: 1_380_000,  // Was 3,450,000 (-60%)
    16: 1_660_000,  // Was 4,150,000 (-60%)
    17: 2_000_000,  // Was 5,000,000 (-60%)
    18: 2_420_000,  // Was 6,050,000 (-60%)
    19: 2_920_000,  // Was 7,300,000 (-60%)
    20: 3_520_000,  // Was 8,800,000 (-60%)
  } as Record<number, number>,

  // Tech Cost Multiplier (still needed for production line calculations in UI, even if always 1)
  techCostMultiplier: {
    1: 1.0,
    2: 1.15,
    3: 1.35,
    4: 1.60,
  } as Record<1 | 2 | 3 | 4, number>,

  // Tech Research Cost (needed for UI progression bar if we keep "Level" concept visuals)
  techResearchCost: {
    1: 0,
    2: 1_000_000,
    3: 2_000_000,
    4: 5_000_000,
  } as Record<number, number>,

  defaults: {
    brandReputation: 50,
    initialTechLevel: 1,
    initialFeatures: 0,
    initialResearchHours: 0,
    production: {
      allocationPct: 80,
      supplierUS: 1,
      supplierAsia: 1,
      outsourceSupplier: 2,
      overtimePct: 0,
      overtimeLaborPremiumPct: 50,
    },
    hr: {
      us: { employees: 50, wage: 5000, training: 0 },
      asia: { employees: 0, wage: 0, training: 0 },
    },
    rnd: {
      trainingLevel: 'basic' as 'basic' | 'standard' | 'advanced',
    },
    marketing: {
      promotionPctByRegion: { us: 5, asia: 5, europe: 5 },
      featuresUsed: 0,
    },
    logistics: {
      usPriority: ['us', 'europe', 'asia'] as [RegionKey, RegionKey, RegionKey],
      asiaPriority: ['asia', 'europe', 'us'] as [RegionKey, RegionKey, RegionKey],
      allocation: {
        us: { local: 100, fromAsia: 0 },
        asia: { local: 100, fromUS: 0 },
        europe: { fromUS: 50, fromAsia: 50 },
      },
    },
    finance: {
      transferPricing: { us: 1.0, asia: 1.0, europe: 1.0 },
    },
  },

  investment: {
    lagRounds: 1,
    plantCostUS: 30_000_000,
    plantCostAsia: 18_000_000,
  },

  financial: {
    taxRate: 0.25,
    taxRateByRegion: { us: 0.20, asia: 0.15, europe: 0.25 },
    maxEffectiveTaxRate: 0.60,
    interestRate: 0.05,
    shortTermInterestMultiplier: 2.0,  // Short-term loans cost 2x long-term rate (penalty for poor cash management)
    depreciationRate: 0.05,
    inventoryPercent: 0.10,
    receivablePercent: 0.10,
    payablePercent: 0.10,
    minCashReserve: 50_000_000,
    startingSharePrice: 10,
    parValuePerShare: 10,
    startingCash: 15_000_000,
    startingDebt: 20_000_000,
    startingShareCapital: 60_000_000,
    // NOTE: For round -1, inventory is calculated as 10% of units sold (not from this config)
    // This value is only used as a fallback for legacy code paths
    startingInventoryUnits: 0,
    basePERatio: 15,
    growthPremiumWeights: {
      capacity: 0.10,    // Reduced from 0.12
      share: 0.10,       // Unchanged
      brand: 0.08,       // Increased from 0.05
      cash: 0.14,        // Cash strength bonus (increased from 0.04)
    },
    growthPremiumCap: { down: -0.20, up: 0.35 },  // Slightly wider range
    sharePriceSmoothingPrevWeight: 0.45,  // Reduced from 0.60 for faster price discovery
    maxSharePriceDropPct: 0.35,
    maxDebtToAssetRatio: 0.40,
    maxShareDilutionPerRound: 0.10,
    maxBuybackPerRound: 0.05,
    maxDividendPayoutRatio: 0.50,
    // REMOVED: shortTermLoanPenaltyPct (replaced with progressive debt ratio system)
    debtPenaltyThresholds: {
      safe: 0.20,      // <20% debt/assets: no penalty
      warning: 0.40,   // 20-40%: mild penalty
      danger: 0.60,    // >60%: severe penalty
    },
    maxROE: 500,       // Cap ROE at ±500% to prevent exploits from tiny equity
    minROCE: -500,     // Floor for ROCE
    maxROCE: 500,      // Cap for ROCE
  },
}

export type GameConfig = typeof GAME_CONFIG

type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P]
}

const INDUSTRY_ALIASES: Record<string, string> = {
  'oil': 'Oil & Energy',
  'oil & energy': 'Oil & Energy',
  'oil and energy': 'Oil & Energy',
  'electronics': 'Electronics',
  'electronics & technology': 'Electronics',
  'electronics and technology': 'Electronics',
  'automotive': 'Automotive',
}

export const INDUSTRY_CONFIGS: Record<string, DeepPartial<GameConfig>> = {
  'Oil & Energy': {
    featuresLabel: 'Oil Refinery Level (Distillation)',
    featureCatalog: [
      { id: 1, emoji: '🧪', name: 'Advanced Refining' },
      { id: 2, emoji: '🛡️', name: 'Safety Systems' },
      { id: 3, emoji: '🌫️', name: 'Emissions Scrubbers' },
      { id: 4, emoji: '🔍', name: 'Leak Detection' },
      { id: 5, emoji: '⚙️', name: 'Predictive Maintenance' },
      { id: 6, emoji: '🌡️', name: 'Thermal Recovery' },
      { id: 7, emoji: '🛢️', name: 'Enhanced Extraction' },
      { id: 8, emoji: '🌐', name: 'Grid Integration' },
      { id: 9, emoji: '🔋', name: 'Storage Buffering' },
      { id: 10, emoji: '🚚', name: 'Logistics Optimization' },
      { id: 11, emoji: '♻️', name: 'Waste Reprocessing' },
      { id: 12, emoji: '🛰️', name: 'Remote Monitoring' },
      { id: 13, emoji: '🌱', name: 'Carbon Capture' },
      { id: 14, emoji: '⚡', name: 'Efficiency Boost' },
      { id: 15, emoji: '🧯', name: 'Emergency Response' },
      { id: 16, emoji: '🧪', name: 'Catalyst Upgrade' },
      { id: 17, emoji: '🧭', name: 'Supply Traceability' },
      { id: 18, emoji: '🔌', name: 'Hybrid Feedstock' },
      { id: 19, emoji: '🧬', name: 'Synthetic Fuels' },
      { id: 20, emoji: '☀️', name: 'Renewables Portfolio' },
    ] as FeatureDefinition[],
    capacityPerPlant: 10_000_000,
    // baseMarketDemand removed - calculated dynamically from capacityPerPlant × numTeams
    marketGrowthRate: { us: 2, asia: 5, europe: 1 },
    priceDemand: {
      baselinePriceByRegion: { us: 100, asia: 95, europe: 110 },
      elasticityByRegion: { us: 1.1, asia: 1.4, europe: 1.2 },
      minPriceByRegion: { us: 40, asia: 35, europe: 45 },
      maxPriceByRegion: { us: 140, asia: 130, europe: 150 },
    },
    costCurve: {
      optimalUtilization: 0.80,
      curvature: 2.0,
    },
    unitCosts: {
      directMaterialUS: 26,
      directMaterialAsia: 22,
      directLabourUS: 10,
      directLabourAsia: 6,
      supplier: { 1: 1.0, 2: 1.03, 3: 1.08, 4: 1.12 },
    },
    investment: {
      plantCostUS: 450_000_000,
      plantCostAsia: 320_000_000,
    },
    outsourcing: {
      maxCapacityUS: 300_000,
      maxCapacityAsia: 300_000,
      costPremium: 0.15,
    },
    logisticsTariff: {
      usToAsia: 12,
      usToEurope: 8,
      asiaToUs: 12,
      asiaToEurope: 10,
    },
    defaults: {
      marketing: {
        promotionPctByRegion: { us: 2, asia: 2, europe: 2 },
      },
    },
    financial: {
      startingCash: 150_000_000,
      minCashReserve: 100_000_000,
      startingInventoryUnits: 0,
    },
  },
  Electronics: {
    featuresLabel: 'Product Features',
    featureCatalog: [
      { id: 1, emoji: '📶', name: 'Wi-Fi 6' },
      { id: 2, emoji: '🔋', name: 'Fast Charge' },
      { id: 3, emoji: '🔐', name: 'Secure Enclave' },
      { id: 4, emoji: '🎧', name: 'Spatial Audio' },
      { id: 5, emoji: '📱', name: 'Multi-Device Sync' },
      { id: 6, emoji: '🧠', name: 'On-Device AI' },
      { id: 7, emoji: '📷', name: 'Computational Camera' },
      { id: 8, emoji: '🪟', name: 'Adaptive Display' },
      { id: 9, emoji: '🛰️', name: 'Precision GPS' },
      { id: 10, emoji: '🌡️', name: 'Thermal Control' },
      { id: 11, emoji: '🔒', name: 'Biometric Lock' },
      { id: 12, emoji: '☁️', name: 'Cloud Backup' },
      { id: 13, emoji: '⚙️', name: 'Modular Design' },
      { id: 14, emoji: '🔊', name: 'Smart Assist' },
      { id: 15, emoji: '🧪', name: 'Nano-Coating' },
      { id: 16, emoji: '🧭', name: 'Ultra-Wideband' },
      { id: 17, emoji: '🔋', name: 'All-Day Battery+' },
      { id: 18, emoji: '🧰', name: 'Self-Diagnostics' },
      { id: 19, emoji: '🧬', name: 'Chipset Gen-X' },
      { id: 20, emoji: '🚀', name: 'Quantum-Ready' },
    ] as FeatureDefinition[],
    capacityPerPlant: 900_000,
    // baseMarketDemand removed - calculated dynamically from capacityPerPlant × numTeams
    priceDemand: {
      minPriceByRegion: { us: 80, asia: 70, europe: 85 },
      maxPriceByRegion: { us: 220, asia: 200, europe: 230 },
    },
    defaults: {
      marketing: {
        promotionPctByRegion: { us: 5, asia: 5, europe: 5 },
      },
    },
    financial: {
      startingInventoryUnits: 0,
    },
  },
  Automotive: {
    featuresLabel: 'Safety Features',
    featureCatalog: [
      { id: 1, emoji: '🛡️', name: 'ABS Braking' },
      { id: 2, emoji: '📱', name: 'Infotainment' },
      { id: 3, emoji: '🤖', name: 'Adaptive Cruise' },
      { id: 4, emoji: '🔌', name: 'Fast Charging' },
      { id: 5, emoji: '🌐', name: 'Cloud Sync' },
      { id: 6, emoji: '🛰️', name: 'GPS + Traffic' },
      { id: 7, emoji: '🔒', name: 'Vehicle Security' },
      { id: 8, emoji: '🧠', name: 'Lane Assist' },
      { id: 9, emoji: '💡', name: 'LED Matrix' },
      { id: 10, emoji: '🌦️', name: 'All-Weather Mode' },
      { id: 11, emoji: '🧭', name: 'Auto Parking' },
      { id: 12, emoji: '🪫', name: 'Battery Health' },
      { id: 13, emoji: '🛰️', name: 'V2X Comms' },
      { id: 14, emoji: '🛠️', name: 'Predictive Maintenance' },
      { id: 15, emoji: '🧭', name: 'Driver Monitoring' },
      { id: 16, emoji: '🤝', name: 'Vehicle-to-Home' },
      { id: 17, emoji: '⚡', name: 'Ultra Fast Charge' },
      { id: 18, emoji: '🛰️', name: 'HD Mapping' },
      { id: 19, emoji: '🧪', name: 'Solid-State Ready' },
      { id: 20, emoji: '🧬', name: 'Autonomy Stack' },
    ] as FeatureDefinition[],
    capacityPerPlant: 150_000,
    // baseMarketDemand removed - calculated dynamically from capacityPerPlant × numTeams
    marketGrowthRate: { us: 1, asia: 3, europe: 1 },
    priceDemand: {
      baselinePriceByRegion: { us: 45_000, asia: 40_000, europe: 45_000 },
      elasticityByRegion: { us: 0.7, asia: 0.8, europe: 0.6 },
      minPriceByRegion: { us: 25_000, asia: 22_000, europe: 26_000 },
      maxPriceByRegion: { us: 80_000, asia: 75_000, europe: 85_000 },
    },
    unitCosts: {
      directMaterialUS: 18_000,
      directMaterialAsia: 15_000,
      directLabourUS: 5_000,
      directLabourAsia: 2_500,
      supplier: { 1: 1.0, 2: 1.05, 3: 1.1, 4: 1.15 },
    },
    investment: {
      plantCostUS: 1_500_000_000,
      plantCostAsia: 1_000_000_000,
    },
    outsourcing: {
      maxCapacityUS: 80_000,
      maxCapacityAsia: 80_000,
      costPremium: 0.25,
    },
    logisticsTariff: {
      usToAsia: 1_800,
      usToEurope: 1_200,
      asiaToUs: 1_800,
      asiaToEurope: 1_500,
    },
    defaults: {
      hr: {
        us: { employees: 200, wage: 8000, training: 100_000 },
        asia: { employees: 0, wage: 0, training: 0 },
      },
      marketing: {
        promotionPctByRegion: { us: 6, asia: 6, europe: 6 },
      },
    },
    financial: {
      startingCash: 250_000_000,
      minCashReserve: 100_000_000,
      maxDebtToAssetRatio: 0.60,
      startingInventoryUnits: 0,
    },
    hr: {
      adminOverheadPercent: 0.20, // 20% overhead (Standard corporate structure)
      inventoryHoldingCostPercent: 0.005, // 0.5% annual holding cost for Automotive
    },
  },
}

function normalizeIndustry(industry?: string): string {
  if (!industry) return 'Electronics'
  const key = industry.trim().toLowerCase()
  return INDUSTRY_ALIASES[key] ?? industry
}

function mergeConfig<T extends Record<string, unknown>>(base: T, override: DeepPartial<T>): T {
  const result = { ...base } as T
  Object.entries(override).forEach(([key, value]) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const baseValue = (base[key as keyof T] ?? {}) as Record<string, unknown>
      const overrideValue = value as DeepPartial<Record<string, unknown>>
      result[key as keyof T] = mergeConfig(baseValue, overrideValue) as T[keyof T]
    } else if (value !== undefined) {
      result[key as keyof T] = value as T[keyof T]
    }
  })
  return result
}

export function getGameConfigForIndustry(
  industry?: string,
  overrides?: DeepPartial<GameConfig>
): GameConfig {
  const normalized = normalizeIndustry(industry)
  const override = INDUSTRY_CONFIGS[normalized] ?? {}
  const baseConfig = mergeConfig(GAME_CONFIG, override)
  return overrides ? mergeConfig(baseConfig, overrides) : baseConfig
}

export function getStartingUnitCost(config: GameConfig): number {
  const { unitCosts } = config
  const materialCost = unitCosts.directMaterialUS
  const labourCost = unitCosts.directLabourUS
  const supplierMultiplier = unitCosts.supplier[2] ?? 1
  return (materialCost + labourCost) * supplierMultiplier
}

export function getBalancedStartingFinancials(config: GameConfig) {
  const { initialFactories, investment, financial } = config
  const fixedAssets =
    initialFactories.us * investment.plantCostUS +
    initialFactories.asia * investment.plantCostAsia

  const unitCost = getStartingUnitCost(config)
  const inventoryValue = financial.startingInventoryUnits * unitCost
  const totalAssets = fixedAssets + inventoryValue + financial.startingCash
  const startingDebt = Math.round(totalAssets * 0.25)
  const startingShareCapital = totalAssets - startingDebt

  return {
    fixedAssets,
    inventoryValue,
    unitCost,
    totalAssets,
    startingDebt,
    startingShareCapital,
    startingCash: financial.startingCash,
    startingInventoryUnits: financial.startingInventoryUnits,
    sharesOutstanding: Math.round(startingShareCapital / financial.startingSharePrice),
    sharePrice: financial.startingSharePrice,
  }
}

// ============================================================================
// TYPES
// ============================================================================

export interface FactoryState {
  us: number
  asia: number
}

export interface PendingInvestment {
  region: 'us' | 'asia'
  plantsOrdered: number
  roundOrdered: number
  roundAvailable: number
}

export interface RnDProgress {
  unlockedTechLevel: 1 | 2 | 3 | 4
  unlockedFeatureCount: number
  cumulativeResearchHours: number
  pendingTechUpgrade?: {
    targetLevel: 2 | 3 | 4
    roundAvailable: number
  }
}

export interface InitialRoundState {
  balanceSheet: TeamBalanceSheet
  kpis: Pick<TeamKPIs, 'sharePrice' | 'tsr'>
}

export interface TeamGameState {
  factories: FactoryState
  pendingInvestments: PendingInvestment[]
  rndProgress: RnDProgress
  cumulativeProduction: number
  brandReputation: number
  inventory: number
  inventoryUS?: number
  inventoryAsia?: number
  previousRoundResults?: TeamResults | InitialRoundState
  totalDividendsPaid?: number
  totalDebtBorrowed?: number
  totalDebtRepaid?: number
  totalSharesIssued?: number
  totalSharesBoughtBack?: number
  taxLossCarryforward?: number
}

export interface TeamProductionCapacity {
  usFactoryCapacity: number
  asiaFactoryCapacity: number
  totalFactoryCapacity: number
  usOutsourceCapacity: number
  asiaOutsourceCapacity: number
  totalOutsourceCapacity: number
  totalCapacity: number
  usFactoryCount: number
  asiaFactoryCount: number
}

type ProductionLineInput = {
  techLevel: 1 | 2 | 3 | 4
  supplierId: 1 | 2 | 3 | 4
  units: number
}

export interface MarketDemand {
  us: number
  asia: number
  europe: number
  total: number
}

export interface TeamMarketShare {
  us: number
  asia: number
  europe: number
}

export interface TeamSales {
  us: { units: number; revenue: number; price: number; unmetDemand: number }
  asia: { units: number; revenue: number; price: number; unmetDemand: number }
  europe: { units: number; revenue: number; price: number; unmetDemand: number }
  total: { units: number; revenue: number; unmetDemand: number }
}

export interface AttractivenessBreakdown {
  baselinePrice: number
  priceMultiple: number
  priceRatio: number
  priceScore: number
  pricePenalty: number
  techScore: number
  featuresScore: number
  promotionScore: number
  trainingScore: number
  csrScore: number
  brandBonus: number
  weights: {
    priceWeight: number
    qualityWeight: number
    featuresWeight: number
    promotionWeight: number
    trainingWeight: number
    csrWeight: number
  }
  weightedComponents: {
    price: number
    tech: number
    features: number
    promotion: number
    training: number
    csr: number
  }
  rawScore: number
  finalScore: number
  // Raw audit inputs for debugging/auditing
  auditInputs?: {
    price: number
    featureCount: number
    marketedFeatures: number
    promotionPct: number
    trainingPerStaff: number
    trainingRatio: number
    weightedCSRRating: number
    totalEmployees: number
    totalTraining: number
    brandReputation: number
  }
}

export interface TeamCosts {
  production: number
  materials: number
  labor: number
  logistics: number
  outsourcing: number
  hr: number
  rnd: number
  marketing: number
  admin: number
  inventoryHolding?: number
  depreciation: number
  interest: number
  totalOperating: number
  totalCost: number
}

export interface TeamPnL {
  revenue: number
  cogs: number
  grossProfit: number
  grossMargin: number
  operatingExpenses: number
  ebitda: number
  ebitdaMargin: number
  depreciation: number
  ebit: number
  interestExpense: number
  profitBeforeTax: number
  taxableIncome: number
  tax: number
  netProfit: number
  netMargin: number
  taxLossCarryforwardStart: number
  taxLossCarryforwardEnd: number
}

export interface TeamBalanceSheet {
  fixedAssets: number
  inventory: number
  receivables: number
  cash: number
  totalAssets: number
  longTermDebt: number
  shortTermLoans: number
  payables: number
  totalLiabilities: number
  shareCapital: number
  retainedEarnings: number
  currentProfit: number
  totalEquity: number
}

export interface TeamRatios {
  roe: number
  roce: number
  ros: number
  currentRatio: number
  debtToEquity: number
  assetTurnover: number
}

interface ScenarioEffects {
  priceElasticityModifier: number
  csrImportanceModifier: number
  marketingEffectModifier: number
  costInflation: number
  investmentCostMultiplier: number
  interestRateSpread: number
  taxRateDeltaByRegion: { us: number; asia: number; europe: number }
  workingCapitalDelta: { inventory: number; receivable: number; payable: number }
  demandGrowthModifier: { us: number; asia: number; europe: number }
  logisticsTariff?: RoundScenario['logisticsTariff']
}

export interface TeamKPIs {
  eps: number
  sharePrice: number
  marketCap: number
  sharesOutstanding: number
  dividendYield: number
  tsr: number
  growthPremium?: number
  sharePriceTrace?: {
    basePrice: number
    prevSharePrice: number
    eps: number
    basePERatio: number
    growthPremium: number
    peRatio: number
    capacityGrowth: number
    shareGain: number
    techScore: number
    brandScore: number
    sharePriceBase: number
    smoothingPrevWeight: number
    smoothedPrice: number
    protectedFloor: number
    finalSharePrice: number
  }
}

export interface TeamResults {
  teamId: number
  teamName: string
  round: number
  decisions?: TeamDecisions
  production?: {
    totalUnits: number
    factoryUnits: number
    outsourcedUnits: number
    usFactoryUnits: number
    asiaFactoryUnits: number
    outsourceUS: number
    outsourceAsia: number
  }
  inventoryTrace?: {
    startingUnits: number
    endingUnits: number
    startingUnitsUS?: number
    startingUnitsAsia?: number
    endingUnitsUS?: number
    endingUnitsAsia?: number
  }
  gameState: TeamGameState
  capacity: TeamProductionCapacity
  productionUnits: number
  availableFeatures: number
  availableTechLevel: 1 | 2 | 3 | 4
  researchHoursThisRound: number
  marketShare: TeamMarketShare
  attractivenessScore: { us: number; asia: number; europe: number }
  sales: TeamSales
  costs: TeamCosts
  pnl: TeamPnL
  balanceSheet: TeamBalanceSheet
  ratios: TeamRatios
  kpis: TeamKPIs
}

export interface RoundResults {
  round: number
  marketDemand: MarketDemand
  teams: TeamResults[]
  winner: {
    byRevenue: number
    byProfit: number
    byMarketShare: number
    byTSR: number
    bySharePrice: number
  }
}

export interface RoundAuditResults {
  round: number
  marketDemand: MarketDemand
  sharePriceTraceSummary?: Array<{
    teamId: number
    teamName: string
    trace?: TeamKPIs['sharePriceTrace']
  }>
  marketDemandBreakdown: {
    round: number
    teamCount: number
    // Base demand = capacityPerPlant × 1 × teamCount, split by region
    capacityPerPlant: number
    baseDemandTotal: number
    marketGrowthRate: MarketDemand
    totalCapacity?: number
    scenarioSequence?: number[]
    priceDemand?: {
      us: { avgPrice: number; multiplier: number }
      asia: { avgPrice: number; multiplier: number }
      europe: { avgPrice: number; multiplier: number }
    }
    adjustedMarketDemand?: MarketDemand
  }
  idealShares: {
    us: {
      avgPrice: number
      totalScore: number
      teams: Array<{ teamId: number; teamName: string; score: number; sharePct: number; breakdown: AttractivenessBreakdown }>
    }
    asia: {
      avgPrice: number
      totalScore: number
      teams: Array<{ teamId: number; teamName: string; score: number; sharePct: number; breakdown: AttractivenessBreakdown }>
    }
    europe: {
      avgPrice: number
      totalScore: number
      teams: Array<{ teamId: number; teamName: string; score: number; sharePct: number; breakdown: AttractivenessBreakdown }>
    }
  }
  teams: Array<TeamResults & {
    decisions: TeamDecisions
    audit: {
      desiredUnits: { us: number; asia: number; europe: number }
      capacity: TeamProductionCapacity
      trace: unknown // Flexible container for audit trace internals
    }
  }>
  winner: RoundResults['winner']
}

// ============================================================================
// INITIALIZATION
// ============================================================================

export function createInitialGameState(config: GameConfig = GAME_CONFIG): TeamGameState {
  const startingFinancials = getBalancedStartingFinancials(config)

  const initialBalanceSheet: TeamBalanceSheet = {
    fixedAssets: startingFinancials.fixedAssets,
    inventory: startingFinancials.inventoryValue,
    receivables: 0,
    cash: startingFinancials.startingCash,
    totalAssets: startingFinancials.totalAssets,
    longTermDebt: startingFinancials.startingDebt,
    shortTermLoans: 0,
    payables: 0,
    totalLiabilities: startingFinancials.startingDebt,
    shareCapital: startingFinancials.startingShareCapital,
    retainedEarnings: 0,
    currentProfit: 0,
    totalEquity: startingFinancials.startingShareCapital,
  }

  return {
    factories: { ...config.initialFactories },
    pendingInvestments: [],
    rndProgress: {
      unlockedTechLevel: config.defaults.initialTechLevel as 1 | 2 | 3 | 4,
      unlockedFeatureCount: config.defaults.initialFeatures,
      cumulativeResearchHours: config.defaults.initialResearchHours,
    },
    cumulativeProduction: 0,
    brandReputation: config.defaults.brandReputation,
    inventory: config.financial.startingInventoryUnits,
    inventoryUS: config.financial.startingInventoryUnits,
    inventoryAsia: 0,
    previousRoundResults: {
      balanceSheet: initialBalanceSheet,
      kpis: {
        sharePrice: config.financial.startingSharePrice,
        tsr: 0,
      },
    },
    totalDividendsPaid: 0,
    totalDebtBorrowed: 0,
    totalDebtRepaid: 0,
    totalSharesIssued: 0,
    totalSharesBoughtBack: 0,
    taxLossCarryforward: 0,
  }
}

export function getDefaultDecisions(config: GameConfig = GAME_CONFIG): TeamDecisions {
  const { priceDemand, initialFactories, capacityPerPlant, defaults } = config
  const allocationPct = defaults.production.allocationPct
  const usCapacity = initialFactories.us * capacityPerPlant * (allocationPct / 100)
  const asiaCapacity = initialFactories.asia * capacityPerPlant * (allocationPct / 100)

  return {
    production: {
      demandForecast: { us: 0, asia: 0, europe: 0 },
      productionLines: {
        us1: { techLevel: 1, supplierId: defaults.production.supplierUS as 1 | 2 | 3 | 4, units: initialFactories.us > 0 ? allocationPct : 0 },
        us2: { techLevel: 1, supplierId: defaults.production.supplierUS as 1 | 2 | 3 | 4, units: initialFactories.us > 0 ? allocationPct : 0 },
        asia1: { techLevel: 1, supplierId: defaults.production.supplierAsia as 1 | 2 | 3 | 4, units: initialFactories.asia > 0 ? allocationPct : 0 },
        asia2: { techLevel: 1, supplierId: defaults.production.supplierAsia as 1 | 2 | 3 | 4, units: initialFactories.asia > 0 ? allocationPct : 0 },
      },
      outsource: { techLevel: 1, supplierId: defaults.production.outsourceSupplier as 1 | 2 | 3 | 4, units: 0 },
      usUnits: usCapacity,
      asiaUnits: asiaCapacity,
    },
    hr: {
      us: { ...defaults.hr.us },
      asia: { ...defaults.hr.asia },
    },
    rnd: {},
    investment: {
      newPlantsUS: 0,
      newPlantsAsia: 0,
    },
    logistics: {
      usPriority: defaults.logistics.usPriority,
      asiaPriority: defaults.logistics.asiaPriority,
    },
    marketing: {
      us: { price: priceDemand.baselinePriceByRegion.us, features: defaults.marketing.featuresUsed, promotionPct: defaults.marketing.promotionPctByRegion.us },
      asia: { price: priceDemand.baselinePriceByRegion.asia, features: defaults.marketing.featuresUsed, promotionPct: defaults.marketing.promotionPctByRegion.asia },
      europe: { price: priceDemand.baselinePriceByRegion.europe, features: defaults.marketing.featuresUsed, promotionPct: defaults.marketing.promotionPctByRegion.europe },
    },
    finance: {
      transferPricing: { ...defaults.finance.transferPricing },
      longTermDebt: 0,
      shareIssuance: 0,
      dividends: 0,
    },
  }
}

export function calculateTrialRound(
  teamNames: string[],
  config: GameConfig = GAME_CONFIG,
  scenarioSequence: number[] = [0]
): RoundResults {
  const defaultDecisions = getDefaultDecisions(config)
  const teams: TeamState[] = teamNames.map((name, index) => ({
    id: index + 1,
    name,
    decisions: JSON.parse(JSON.stringify(defaultDecisions)),
  }))

  const previousGameStates = new Map<number, TeamGameState>()
  teams.forEach(team => {
    previousGameStates.set(team.id, createInitialGameState(config))
  })

  return calculateRound(teams, 0, previousGameStates, scenarioSequence, 1.0, config)
}

// ============================================================================
// ROUND -1 SIMULATION (STARTING POSITION)
// ============================================================================
/**
 * Calculate Round -1 Results (Starting Position)
 *
 * CRITICAL: This is the ONLY way to get round -1 data. Do NOT patch/guess values elsewhere.
 *
 * Round -1 represents the hypothetical "year before the game starts". It shows:
 * - What operations would look like with default decisions
 * - All production from Americas (US) only (no Asia factories initially for most configs)
 * - Market share split evenly among teams
 * - Balance sheet shows the STARTING position (before round -1 profits)
 *
 * The P&L shows one year of operations, but the balance sheet shows what teams
 * START with (i.e., retained earnings = 0, not the year's profit).
 *
 * Usage:
 * - Call this function once when displaying Review step for round 0 or 1
 * - The results are deterministic given the same inputs
 * - Use the returned data for ALL round -1 displays (don't recalculate elsewhere)
 *
 * @param numTeams - Number of teams in the game
 * @param config - Game configuration (defaults to GAME_CONFIG)
 * @param scenarioSequence - Scenario sequence for the game
 * @param marketDemandMultiplier - Scenario growth amplifier
 * @param regionDemandSplit - Region demand split (optional)
 * @returns Round results with full P&L, balance sheet, and production data
 */
export function calculateRoundMinus1(
  numTeams: number,
  config: GameConfig = GAME_CONFIG,
  scenarioSequence: number[] = [0],
  _marketDemandMultiplier: number = 1,
  regionDemandSplit?: { us: number; asia: number; europe: number }
): RoundResults {
  void _marketDemandMultiplier
  // Create teams with default decisions
  // All teams are identical in round -1 (equal market share)
  const defaultDecisions = getDefaultDecisions(config)
  const teams: TeamState[] = Array.from({ length: numTeams }, (_, index) => ({
    id: index + 1,
    name: `Team ${index + 1}`,
    decisions: JSON.parse(JSON.stringify(defaultDecisions)),
  }))

  // Create "pre-round -1" game states (what teams had BEFORE round -1)
  // This is a hypothetical state where:
  // - Factories exist (from config)
  // - No inventory yet (will be built during round -1)
  // - No retained earnings yet
  const preRoundMinus1States = new Map<number, TeamGameState>()

  // SINGLE SOURCE OF TRUTH: Use getBalancedStartingFinancials for all starting values
  const startingFinancials = getBalancedStartingFinancials(config)

  teams.forEach(team => {
    const initialState = createInitialGameState(config)
    const prevResults = initialState.previousRoundResults
    const prevBalanceSheet = prevResults?.balanceSheet
    const zeroInventoryAssets = startingFinancials.fixedAssets + startingFinancials.startingCash
    const zeroInventoryDebt = Math.round(zeroInventoryAssets * 0.25)
    const zeroInventoryShareCapital = zeroInventoryAssets - zeroInventoryDebt

    // For round -1, we assume starting with 0 inventory (inventory is BUILT during this round)
    // The ending inventory after round -1 becomes the starting inventory for round 0
    preRoundMinus1States.set(team.id, {
      ...initialState,
      inventory: 0,
      inventoryUS: 0,
      inventoryAsia: 0,
      // Balance sheet starts with 0 inventory value, but WITH factories and debt
      previousRoundResults: prevBalanceSheet ? {
        balanceSheet: {
          ...prevBalanceSheet,
          inventory: 0,
          // Use startingFinancials for consistent values across all industries
          fixedAssets: startingFinancials.fixedAssets,
          longTermDebt: zeroInventoryDebt,
          shareCapital: zeroInventoryShareCapital,
          totalAssets: zeroInventoryAssets,
        },
        kpis: prevResults?.kpis ?? { sharePrice: config.financial.startingSharePrice, tsr: 0 },
      } : undefined,
    })
  })

  // ============================================================================
  // ROUND -1 ASSUMPTIONS (Starting Position)
  // ============================================================================
  // 1. Production = 100% of capacity (all factories running at full utilization)
  // 2. Ending Inventory = 10% of units sold
  // 3. Therefore: Production = Sales + Inventory = Sales + (0.1 × Sales) = 1.1 × Sales
  //    So: Sales = Production / 1.1
  // 4. All teams are identical with equal market share
  // ============================================================================

  const capacityPerPlant = config.capacityPerPlant
  const usFactories = config.initialFactories.us
  const asiaFactories = config.initialFactories.asia
  // const totalProduction = (usFactories + asiaFactories) * capacityPerPlant // 100% utilization

  // Set production to 100% for all factories
  // IMPORTANT: Must set both productionLines (UI %) AND usUnits/asiaUnits (actual units)
  // The engine reads usUnits/asiaUnits in calculatePlannedProductionUnits()
  const usFullCapacity = usFactories * capacityPerPlant
  const asiaFullCapacity = asiaFactories * capacityPerPlant

  teams.forEach(t => {
    // Set actual unit counts (what the engine reads)
    t.decisions.production.usUnits = usFullCapacity
    t.decisions.production.asiaUnits = asiaFullCapacity

    // Also set UI percentages for consistency
    if (t.decisions.production.productionLines) {
      t.decisions.production.productionLines.us1.units = 100
      t.decisions.production.productionLines.us2.units = 100
      if (t.decisions.production.productionLines.asia1) {
        t.decisions.production.productionLines.asia1.units = 100
      }
      if (t.decisions.production.productionLines.asia2) {
        t.decisions.production.productionLines.asia2.units = 100
      }
    }
  })

  // Round -1 demand calculation is handled in calculateScenarioAdjustedDemand
  // It divides base demand by 1.1 to achieve 10% ending inventory
  // No need for adjustedMultiplier here - just use default multiplier of 1

  const results = calculateRound(
    teams,
    -1, // Round -1
    preRoundMinus1States,
    scenarioSequence,
    1, // Default multiplier - round -1 adjustment is in calculateScenarioAdjustedDemand
    config,
    regionDemandSplit
  )

  return results
}

/**
 * Get round -1 results for a specific team
 *
 * Convenience wrapper that returns data formatted for the Review step display.
 *
 * @param teamIndex - 0-based index of the team (or team ID - 1)
 * @param numTeams - Total number of teams
 * @param config - Game configuration
 * @param scenarioSequence - Scenario sequence
 * @param marketDemandMultiplier - Scenario growth amplifier
 * @param regionDemandSplit - Region demand split
 * @returns Team's round -1 results with all financial and operational data
 */
export function getRoundMinus1TeamResults(
  teamIndex: number,
  numTeams: number,
  config: GameConfig = GAME_CONFIG,
  scenarioSequence: number[] = [0],
  marketDemandMultiplier: number = 1,
  regionDemandSplit?: { us: number; asia: number; europe: number }
) {
  const roundResults = calculateRoundMinus1(
    numTeams,
    config,
    scenarioSequence,
    marketDemandMultiplier,
    regionDemandSplit
  )

  // Get the specific team's results
  const teamResult = roundResults.teams[teamIndex] || roundResults.teams[0]
  if (!teamResult) {
    throw new Error(`Team ${teamIndex} not found in round -1 results`)
  }

  // Get starting financials for balance sheet display
  // (Balance sheet shows STARTING position, not post-operations)
  const startingFinancials = getBalancedStartingFinancials(config)

  return {
    roundResults,
    teamResult,
    startingFinancials,
    marketDemand: roundResults.marketDemand,
  }
}

export function normalizeProductionLines(
  decisions: TeamDecisions,
  gameState: TeamGameState,
  config: GameConfig = GAME_CONFIG
): TeamDecisions {
  const production = decisions.production
  const { capacityPerPlant } = config
  const overtimePct = Math.max(0, Math.min(100, production.overtime ?? 0))
  const maxUS = gameState.factories.us > 0
    ? gameState.factories.us * capacityPerPlant * (1 + overtimePct / 100)
    : 0
  const maxAsia = gameState.factories.asia > 0
    ? gameState.factories.asia * capacityPerPlant * (1 + overtimePct / 100)
    : 0

  const makeLine = (line: Partial<ProductionLineInput> | undefined, supplierId: number): ProductionLineInput => ({
    techLevel: (line?.techLevel ?? 1) as 1 | 2 | 3 | 4,
    supplierId: ((line?.supplierId ?? supplierId) as 1 | 2 | 3 | 4),
    units: line?.units ?? 0,
  })
  const nextLines = {
    us1: makeLine(production.productionLines?.us1, production.supplierUS ?? 1),
    us2: makeLine(production.productionLines?.us2, production.supplierUS ?? 1),
    asia1: makeLine(production.productionLines?.asia1, production.supplierAsia ?? 1),
    asia2: makeLine(production.productionLines?.asia2, production.supplierAsia ?? 1),
  }

  if (typeof production.usUnits === 'number') {
    const fraction = maxUS > 0 ? Math.min(1, Math.max(0, production.usUnits / maxUS)) : 0
    const pct = Math.max(0, Math.min(100, fraction * 100))
    nextLines.us1 = { ...nextLines.us1, units: pct }
    nextLines.us2 = { ...nextLines.us2, units: pct }
  }

  if (typeof production.asiaUnits === 'number') {
    const fraction = maxAsia > 0 ? Math.min(1, Math.max(0, production.asiaUnits / maxAsia)) : 0
    const pct = Math.max(0, Math.min(100, fraction * 100))
    nextLines.asia1 = { ...nextLines.asia1, units: pct }
    nextLines.asia2 = { ...nextLines.asia2, units: pct }
  }

  // Force techLevel to 1 for all lines (clean up legacy input)
  nextLines.us1.techLevel = 1
  nextLines.us2.techLevel = 1
  nextLines.asia1.techLevel = 1
  nextLines.asia2.techLevel = 1

  return { ...decisions, production: { ...production, productionLines: nextLines } }
}

function calculateResearchHoursThisRound(
  decisions: TeamDecisions,
  config: GameConfig = GAME_CONFIG
): number {
  const { hr, rnd } = decisions
  const { mandaysPerWorker, trainingEfficiencyBoost } = config.hr
  const rndData = rnd as { researchStaff?: number; trainingLevel?: string }
  const hrData = hr as {
    us?: { employees?: number; training?: number }
    asia?: { employees?: number; training?: number }
  }

  if (typeof rndData.researchStaff === 'number') {
    const trainingMultiplier = rndData.trainingLevel === 'advanced' ? 1 + (trainingEfficiencyBoost * 2)
      : rndData.trainingLevel === 'standard' ? 1 + trainingEfficiencyBoost
        : 1.0
    return Math.round((rndData.researchStaff || 0) * mandaysPerWorker * trainingMultiplier)
  }

  if (hrData?.us?.employees) {
    const usTrainingCost = hrData.us?.training ?? 0
    const asiaTrainingCost = hrData.asia?.training ?? 0
    const usEfficiency = usTrainingCost >= 100000 ? 1 + (trainingEfficiencyBoost * 2) : usTrainingCost > 0 ? 1 + trainingEfficiencyBoost : 1.0
    const asiaEfficiency = asiaTrainingCost >= 60000 ? 1 + (trainingEfficiencyBoost * 2) : asiaTrainingCost > 0 ? 1 + trainingEfficiencyBoost : 1.0

    const usHours = (hrData.us.employees || 0) * mandaysPerWorker * usEfficiency
    const asiaHours = (hrData.asia?.employees || 0) * mandaysPerWorker * asiaEfficiency
    return Math.round(usHours + asiaHours)
  }
  return 0
}

export function updateRnDProgress(
  prevProgress: RnDProgress,
  researchHoursThisRound: number,
  config: GameConfig = GAME_CONFIG
): RnDProgress {
  // R&D system: Only unlocks features, no tech level progression
  const newTechLevel = 1 as const
  let newFeatureCount = prevProgress.unlockedFeatureCount
  let newResearchHours = prevProgress.cumulativeResearchHours

  const hoursToFeatures = Math.round(researchHoursThisRound)
  newResearchHours += hoursToFeatures

  while (true) {
    const nextFeature = newFeatureCount + 1
    let requiredHours = config.featureResearchHours[nextFeature]
    if (!requiredHours && nextFeature > 20) {
      const lastKnown = config.featureResearchHours[20] || 8_800_000
      requiredHours = Math.round(lastKnown * Math.pow(1.22, nextFeature - 20))
    }
    if (requiredHours && newResearchHours >= requiredHours) {
      newFeatureCount++
    } else {
      break
    }
  }

  return {
    unlockedTechLevel: newTechLevel,
    unlockedFeatureCount: newFeatureCount,
    cumulativeResearchHours: newResearchHours,
  }
}

function updateFactoryState(
  prevState: TeamGameState,
  decisions: TeamDecisions,
  round: number,
  config: GameConfig = GAME_CONFIG
): { factories: FactoryState; pendingInvestments: PendingInvestment[] } {
  const newFactories = { ...prevState.factories }
  const newPendingInvestments: PendingInvestment[] = []

  for (const investment of prevState.pendingInvestments) {
    if (round >= investment.roundAvailable) {
      newFactories[investment.region] += investment.plantsOrdered
    } else {
      newPendingInvestments.push(investment)
    }
  }

  const { investment } = decisions
  const { lagRounds } = config.investment

  if (investment.newPlantsUS > 0) {
    newPendingInvestments.push({
      region: 'us',
      plantsOrdered: investment.newPlantsUS,
      roundOrdered: round,
      roundAvailable: round + lagRounds,
    })
  }

  if (investment.newPlantsAsia > 0) {
    newPendingInvestments.push({
      region: 'asia',
      plantsOrdered: investment.newPlantsAsia,
      roundOrdered: round,
      roundAvailable: round + lagRounds,
    })
  }

  return { factories: newFactories, pendingInvestments: newPendingInvestments }
}

export function calculateCapacity(
  gameState: TeamGameState,
  decisions: TeamDecisions,
  config: GameConfig = GAME_CONFIG
): TeamProductionCapacity {
  const factories = gameState?.factories ?? { us: 0, asia: 0 }
  const fallbackProduction = {
    supplierUS: 1,
    supplierAsia: 1,
    productionLines: {
      us1: { units: 0, supplierId: 1, techLevel: 1 },
      us2: { units: 0, supplierId: 1, techLevel: 1 },
      asia1: { units: 0, supplierId: 1, techLevel: 1 },
      asia2: { units: 0, supplierId: 1, techLevel: 1 },
    },
    outsource: { techLevel: 1, supplierId: 2, units: 0 },
    outsourceUS: 0,
    outsourceAsia: 0,
    overtime: 0,
    usUnits: 0,
    asiaUnits: 0,
  }
  const defaultsProduction = config.defaults?.production as Partial<TeamDecisions['production']> | undefined
  const defaultProduction = {
    ...fallbackProduction,
    ...(defaultsProduction ?? {}),
    productionLines: {
      ...fallbackProduction.productionLines,
      ...(defaultsProduction?.productionLines ?? {}),
    },
    outsource: {
      ...fallbackProduction.outsource,
      ...(defaultsProduction?.outsource ?? {}),
    },
  }
  const production = {
    ...defaultProduction,
    ...decisions.production,
    productionLines: {
      ...defaultProduction.productionLines,
      ...(decisions.production?.productionLines ?? {}),
    },
    outsource: {
      ...defaultProduction.outsource,
      ...(decisions.production?.outsource ?? {}),
    },
  }
  const mergedLines = production.productionLines ?? {}
  const productionLines = {
    us1: mergedLines.us1 ?? defaultProduction.productionLines.us1,
    us2: mergedLines.us2 ?? defaultProduction.productionLines.us2,
    asia1: mergedLines.asia1 ?? defaultProduction.productionLines.asia1,
    asia2: mergedLines.asia2 ?? defaultProduction.productionLines.asia2,
  }
  const { capacityPerPlant, outsourcing } = config
  const overtimePct = production.overtime ?? 0
  const overtimeMultiplier = 1 + overtimePct / 100

  const usAllocationRaw = (productionLines.us1.units + productionLines.us2.units) / 200
  const asiaAllocationRaw = (productionLines.asia1.units + productionLines.asia2.units) / 200
  const usAllocation = Math.max(0, Math.min(1, usAllocationRaw))
  const asiaAllocation = Math.max(0, Math.min(1, asiaAllocationRaw))

  const usFactoryCapacity = factories.us > 0 ? Math.round(factories.us * capacityPerPlant * usAllocation * overtimeMultiplier) : 0
  const asiaFactoryCapacity = factories.asia > 0 ? Math.round(factories.asia * capacityPerPlant * asiaAllocation * overtimeMultiplier) : 0
  const totalFactoryCapacity = usFactoryCapacity + asiaFactoryCapacity

  const requestedOutsourceUS = Math.max(0, production.outsourceUS ?? 0)
  const requestedOutsourceAsia = Math.max(0, production.outsourceAsia ?? 0)
  const usOutsourceCapacity = Math.min(requestedOutsourceUS, outsourcing.maxCapacityUS)
  const asiaOutsourceCapacity = Math.min(requestedOutsourceAsia, outsourcing.maxCapacityAsia)
  const totalOutsourceCapacity = usOutsourceCapacity + asiaOutsourceCapacity
  const totalCapacity = totalFactoryCapacity + totalOutsourceCapacity

  return {
    usFactoryCapacity,
    asiaFactoryCapacity,
    totalFactoryCapacity,
    usOutsourceCapacity,
    asiaOutsourceCapacity,
    totalOutsourceCapacity,
    totalCapacity,
    usFactoryCount: factories.us,
    asiaFactoryCount: factories.asia,
  }
}

// function getOutsourceUnits(decisions: TeamDecisions): number {
//   const production = decisions.production ?? {}
//   if (typeof production.outsource?.units === 'number') {
//     return production.outsource.units
//   }
//   const outsourceUS = production.outsourceUS ?? 0
//   const outsourceAsia = production.outsourceAsia ?? 0
//   return outsourceUS + outsourceAsia
// }

export function calculatePlannedProductionUnits(
  decisions: TeamDecisions,
  capacity: TeamProductionCapacity
): {
  totalUnits: number
  factoryUnits: number
  outsourcedUnits: number
  usFactoryUnits: number
  asiaFactoryUnits: number
  outsourceUS: number
  outsourceAsia: number
} {
  const production = decisions.production ?? {}
  const usRequested = Math.max(0, production.usUnits ?? 0)
  const asiaRequested = Math.max(0, production.asiaUnits ?? 0)

  const usFactoryUnits = Math.min(usRequested, capacity.usFactoryCapacity)
  const asiaFactoryUnits = Math.min(asiaRequested, capacity.asiaFactoryCapacity)

  const requestedOutsourceUS = Math.max(0, production.outsourceUS ?? 0)
  const requestedOutsourceAsia = Math.max(0, production.outsourceAsia ?? 0)
  const outsourceUS = Math.min(requestedOutsourceUS, capacity.usOutsourceCapacity)
  const outsourceAsia = Math.min(requestedOutsourceAsia, capacity.asiaOutsourceCapacity)
  const outsourcedUnits = outsourceUS + outsourceAsia

  const factoryUnits = usFactoryUnits + asiaFactoryUnits
  const totalUnits = factoryUnits + outsourcedUnits

  return {
    totalUnits,
    factoryUnits,
    outsourcedUnits,
    usFactoryUnits,
    asiaFactoryUnits,
    outsourceUS,
    outsourceAsia,
  }
}

export function getScenarioGrowthRateForRound(
  round: number,
  scenarioSequence?: number[],
  config: GameConfig = GAME_CONFIG
): MarketDemand {
  const { marketGrowthRate } = config
  const scenarioId = scenarioSequence?.[Math.max(round, 0)] ?? 0
  const scenario = SCENARIOS[scenarioId] ?? SCENARIOS[0]
  return {
    us: marketGrowthRate.us + scenario.demandModifier.us,
    asia: marketGrowthRate.asia + scenario.demandModifier.asia,
    europe: marketGrowthRate.europe + scenario.demandModifier.europe,
    total: 0,
  }
}

export function calculateScenarioAdjustedDemand(
  round: number,
  scenarioSequence?: number[],
  marketDemandMultiplier: number = 1,
  config: GameConfig = GAME_CONFIG,
  numTeams?: number,
  regionDemandSplit?: { us: number; asia: number; europe: number },
  baseDemandTotal?: number,
  baseDemandOverride?: { us: number; asia: number; europe: number }
): MarketDemand {
  const { capacityPerPlant, marketDemandConfig } = config
  let baseDemand: { us: number; asia: number; europe: number }

  // Market demand is calculated dynamically based on capacity and team count
  // Formula: Base Demand = capacityPerPlant × 1 × numTeams, then split by region
  if (baseDemandOverride) {
    baseDemand = {
      us: baseDemandOverride.us,
      asia: baseDemandOverride.asia,
      europe: baseDemandOverride.europe,
    }
  } else if (baseDemandTotal && baseDemandTotal > 0) {
    const split = regionDemandSplit ?? marketDemandConfig.defaultRegionSplit
    const totalBaseDemand = baseDemandTotal
    baseDemand = {
      us: totalBaseDemand * split.us,
      asia: totalBaseDemand * split.asia,
      europe: totalBaseDemand * split.europe,
    }
  } else if (numTeams && numTeams > 0) {
    const split = regionDemandSplit ?? marketDemandConfig.defaultRegionSplit
    const totalBaseDemand = capacityPerPlant * 1 * numTeams
    baseDemand = {
      us: totalBaseDemand * split.us,
      asia: totalBaseDemand * split.asia,
      europe: totalBaseDemand * split.europe,
    }
  } else {
    // numTeams must be provided - this is required for proper demand calculation
    throw new Error('calculateScenarioAdjustedDemand: numTeams or baseDemandTotal must be provided')
  }

  if (round < 0) {
    // Round -1: Market demand is adjusted to allow 10% ending inventory
    // Base demand = capacityPerFactory × 1 × numTeams
    // But we want each team to have 10% inventory after sales
    // Production = Sales + Inventory = Sales × 1.1
    // So: Sales = Production / 1.1, and Market Demand = Total Sales = Base Demand / 1.1
    const inventoryFactor = 1.1
    const usAdjusted = Math.round(baseDemand.us / inventoryFactor)
    const asiaAdjusted = Math.round(baseDemand.asia / inventoryFactor)
    const europeAdjusted = Math.round(baseDemand.europe / inventoryFactor)
    return {
      us: usAdjusted,
      asia: asiaAdjusted,
      europe: europeAdjusted,
      total: usAdjusted + asiaAdjusted + europeAdjusted,
    }
  }



  const applyGrowth = (value: number, growthPct: number) =>
    value * (1 + (growthPct * marketDemandMultiplier) / 100)
  let us = baseDemand.us
  let asia = baseDemand.asia
  let europe = baseDemand.europe

  if (baseDemandOverride && round >= 1) {
    const growth = getScenarioGrowthRateForRound(round, scenarioSequence, config)
    us = applyGrowth(us, growth.us)
    asia = applyGrowth(asia, growth.asia)
    europe = applyGrowth(europe, growth.europe)
  } else if (round === 0) {
    const growth = getScenarioGrowthRateForRound(0, scenarioSequence, config)
    us = applyGrowth(us, growth.us)
    asia = applyGrowth(asia, growth.asia)
    europe = applyGrowth(europe, growth.europe)
  } else {
    for (let r = 1; r <= round; r += 1) {
      const growth = getScenarioGrowthRateForRound(r, scenarioSequence, config)
      us = applyGrowth(us, growth.us)
      asia = applyGrowth(asia, growth.asia)
      europe = applyGrowth(europe, growth.europe)
    }
  }

  const usRounded = Math.round(us)
  const asiaRounded = Math.round(asia)
  const europeRounded = Math.round(europe)

  return {
    us: usRounded,
    asia: asiaRounded,
    europe: europeRounded,
    total: usRounded + asiaRounded + europeRounded,
  }
}

export function getScenarioEffectsForRound(
  round: number,
  scenarioSequence?: number[]
): ScenarioEffects {
  const scenarioId = scenarioSequence?.[Math.max(round, 0)] ?? 0
  const scenario = SCENARIOS[scenarioId] ?? SCENARIOS[0]
  return {
    priceElasticityModifier: scenario.priceElasticityModifier ?? 1,
    csrImportanceModifier: scenario.csrImportanceModifier ?? 1,
    marketingEffectModifier: scenario.marketingEffectModifier ?? 1,
    costInflation: scenario.costInflation ?? 1,
    investmentCostMultiplier: scenario.investmentCostMultiplier ?? 1,
    interestRateSpread: scenario.interestRateSpread ?? 0,
    taxRateDeltaByRegion: scenario.taxRateDeltaByRegion ?? { us: 0, asia: 0, europe: 0 },
    workingCapitalDelta: scenario.workingCapitalDelta ?? { inventory: 0, receivable: 0, payable: 0 },
    demandGrowthModifier: scenario.demandModifier ?? { us: 0, asia: 0, europe: 0 },
    logisticsTariff: scenario.logisticsTariff,
  }
}

export function calculateMarketDemand(
  round: number,
  scenarioSequence?: number[],
  marketDemandMultiplier: number = 1,
  config: GameConfig = GAME_CONFIG,
  numTeams?: number,
  regionDemandSplit?: { us: number; asia: number; europe: number },
  baseDemandTotal?: number,
  baseDemandOverride?: { us: number; asia: number; europe: number }
): MarketDemand {
  return calculateScenarioAdjustedDemand(
    round,
    scenarioSequence,
    marketDemandMultiplier,
    config,
    numTeams,
    regionDemandSplit,
    baseDemandTotal,
    baseDemandOverride
  )
}

function calculatePricePenalty(
  price: number,
  baselinePrice: number,
  elasticityModifier: number,
  config: GameConfig = GAME_CONFIG
): { priceMultiple: number; penalty: number } {
  const priceMultiple = Math.max(price, 1) / Math.max(baselinePrice, 1)
  const { penaltyK, penaltyFloor, penaltyCapMultiple } = config.priceDemand
  const effectiveK = penaltyK * elasticityModifier
  let penalty = Math.exp(-effectiveK * Math.max(0, priceMultiple - 1))
  if (priceMultiple >= penaltyCapMultiple) {
    penalty = penaltyFloor
  }
  penalty = Math.max(penalty, penaltyFloor)
  return { priceMultiple, penalty }
}

export function calculateMarketDemandMultiplier(
  teams: TeamState[],
  region: RegionKey,
  effects?: ScenarioEffects,
  config: GameConfig = GAME_CONFIG
): { avgPrice: number; multiplier: number } {
  const avgPrice = teams.reduce((sum, t) => sum + t.decisions.marketing[region].price, 0) / Math.max(teams.length, 1)
  const baseline = config.priceDemand.baselinePriceByRegion[region]
  const elasticityBase = config.priceDemand.elasticityByRegion[region]
  const elasticity = elasticityBase * (effects?.priceElasticityModifier ?? 1)
  const ratio = avgPrice / Math.max(baseline, 1)
  const rawMultiplier = Math.pow(ratio, -elasticity)
  const multiplier = Math.min(
    config.priceDemand.maxDemandMultiplier,
    Math.max(config.priceDemand.minDemandMultiplier, rawMultiplier)
  )
  return { avgPrice, multiplier }
}

export function calculateAttractivenessBreakdown(
  decisions: TeamDecisions,
  gameState: TeamGameState,
  region: RegionKey,
  marketAvgPrice: number,
  effects?: ScenarioEffects,
  config: GameConfig = GAME_CONFIG
): AttractivenessBreakdown {
  const weights = config.marketPreferences[region]
  const defaultPromo = config.defaults?.marketing?.promotionPctByRegion?.[region] ?? 0
  const marketing =
    decisions.marketing?.[region] ?? {
      price: config.priceDemand.baselinePriceByRegion[region],
      promotionPct: defaultPromo,
      features: 0,
    }
  const featureCount = gameState.rndProgress?.unlockedFeatureCount ?? 0
  const { scoringCurves } = config
  const priceElasticity = effects?.priceElasticityModifier ?? 1
  const csrImportance = effects?.csrImportanceModifier ?? 1
  const marketingEffect = effects?.marketingEffectModifier ?? 1
  const baselinePrice = config.priceDemand.baselinePriceByRegion[region]
  const hr = decisions.hr ?? config.defaults.hr
  const usEmployees = hr.us?.employees ?? config.defaults.hr.us.employees
  const asiaEmployees = hr.asia?.employees ?? config.defaults.hr.asia.employees
  const totalEmployees = usEmployees + asiaEmployees
  const usTraining = hr.us?.training ?? config.defaults.hr.us.training
  const asiaTraining = hr.asia?.training ?? config.defaults.hr.asia.training
  const totalTraining = usTraining + asiaTraining
  const baselineTrainingUS = config.hr.trainingCostPerStaff.standard * (config.hr.trainingCostMultiplierByRegion.us ?? 1)
  const baselineTrainingAsia = config.hr.trainingCostPerStaff.standard * (config.hr.trainingCostMultiplierByRegion.asia ?? 1)
  const baselineTrainingPerStaff = totalEmployees > 0
    ? ((usEmployees * baselineTrainingUS) + (asiaEmployees * baselineTrainingAsia)) / totalEmployees
    : baselineTrainingUS
  const trainingPerStaff = totalEmployees > 0 ? (totalTraining / totalEmployees) : 0
  const trainingRatio = baselineTrainingPerStaff > 0 ? (trainingPerStaff / baselineTrainingPerStaff) : 0

  const defaultSupplierUS = config.defaults?.production?.supplierUS ?? 1
  const defaultSupplierAsia = config.defaults?.production?.supplierAsia ?? 1
  const lines = decisions.production?.productionLines ?? {
    us1: { units: 0, supplierId: defaultSupplierUS, techLevel: 1 },
    us2: { units: 0, supplierId: defaultSupplierUS, techLevel: 1 },
    asia1: { units: 0, supplierId: defaultSupplierAsia, techLevel: 1 },
    asia2: { units: 0, supplierId: defaultSupplierAsia, techLevel: 1 },
  }
  const { capacityPerPlant } = config
  const factories = gameState.factories ?? { us: 0, asia: 0 }
  const us1Units = factories.us >= 1 ? Math.round(capacityPerPlant * lines.us1.units / 100) : 0
  const us2Units = factories.us >= 2 ? Math.round(capacityPerPlant * lines.us2.units / 100) : 0
  const asia1Units = factories.asia >= 1 ? Math.round(capacityPerPlant * lines.asia1.units / 100) : 0
  const asia2Units = factories.asia >= 2 ? Math.round(capacityPerPlant * lines.asia2.units / 100) : 0
  const totalLineUnits = us1Units + us2Units + asia1Units + asia2Units

  let weightedCSRRating = config.supplierCSR[1]
  if (totalLineUnits > 0) {
    weightedCSRRating = (
      (us1Units * config.supplierCSR[lines.us1.supplierId]) +
      (us2Units * config.supplierCSR[lines.us2.supplierId]) +
      (asia1Units * config.supplierCSR[lines.asia1.supplierId]) +
      (asia2Units * config.supplierCSR[lines.asia2.supplierId])
    ) / totalLineUnits
  }

  const priceRatio = marketAvgPrice / Math.max(marketing.price, 1)
  const priceScore = Math.min(
    scoringCurves.priceClampMax,
    Math.max(
      scoringCurves.priceClampMin,
      100 * Math.pow(priceRatio, scoringCurves.priceExponent)
    )
  ) * priceElasticity
  const { priceMultiple, penalty: pricePenalty } = calculatePricePenalty(
    marketing.price,
    baselinePrice,
    priceElasticity,
    config
  )

  // Quality score: Base quality + feature bonus
  // More features → higher perceived quality (innovation = quality perception)
  const baseQuality = scoringCurves.baseTechScore  // 50
  const featureBonus = Math.min(30, featureCount * 2)  // +2 per feature, max +30 at 15 features
  const techScore = baseQuality + featureBonus  // Range: 50-80

  const requestedFeatures = marketing.features || featureCount
  const marketedFeatures = Math.min(requestedFeatures, featureCount)
  const featuresScore = 100 * (1 - Math.exp(-scoringCurves.featuresK * marketedFeatures))

  const promotionScore = 100 * (1 - Math.exp(-scoringCurves.promotionK * marketing.promotionPct)) * marketingEffect
  const cappedTrainingRatio = Math.min(3.0, trainingRatio) // Cap at 3× baseline to prevent ratio exploit
  const baseTrainingScore = 100 * (1 - Math.exp(-scoringCurves.trainingK * cappedTrainingRatio))
  const trainingThreshold = Math.max(100, totalLineUnits / 1000) // Require 1 employee per 1000 units
  const workforceScale = totalEmployees >= trainingThreshold ? 1.0 : (totalEmployees / trainingThreshold)
  const trainingScore = baseTrainingScore * workforceScale // Scale by workforce adequacy
  const csrScore = weightedCSRRating * 25 * csrImportance
  const brandBonus = 1 + (gameState.brandReputation - 50) / 250

  const rawScore =
    priceScore * weights.priceWeight +
    techScore * weights.qualityWeight +
    featuresScore * weights.featuresWeight +
    promotionScore * weights.promotionWeight +
    trainingScore * weights.trainingWeight +
    csrScore * weights.csrWeight

  return {
    baselinePrice,
    priceMultiple,
    priceRatio,
    priceScore,
    pricePenalty,
    techScore,
    featuresScore,
    promotionScore,
    trainingScore,
    csrScore,
    brandBonus,
    weights,
    weightedComponents: {
      price: priceScore * weights.priceWeight,
      tech: techScore * weights.qualityWeight,
      features: featuresScore * weights.featuresWeight,
      promotion: promotionScore * weights.promotionWeight,
      training: trainingScore * weights.trainingWeight,
      csr: csrScore * weights.csrWeight,
    },
    rawScore,
    finalScore: Math.max(0, rawScore * brandBonus * pricePenalty),
    auditInputs: {
      price: marketing.price,
      featureCount,
      marketedFeatures,
      promotionPct: marketing.promotionPct,
      trainingPerStaff,
      trainingRatio,
      weightedCSRRating,
      totalEmployees,
      totalTraining,
      brandReputation: gameState.brandReputation,
    },
  }
}

function calculateAttractiveness(
  decisions: TeamDecisions,
  gameState: TeamGameState,
  region: RegionKey,
  marketAvgPrice: number,
  effects?: ScenarioEffects,
  config: GameConfig = GAME_CONFIG
): number {
  return calculateAttractivenessBreakdown(decisions, gameState, region, marketAvgPrice, effects, config).finalScore
}

function calculateIdealMarketShares(
  teams: TeamState[],
  gameStates: Map<number, TeamGameState>,
  region: RegionKey,
  avgPrice: number,
  attractivenessCache: Map<number, { us: number; asia: number; europe: number }>,
  effects?: ScenarioEffects,
  config: GameConfig = GAME_CONFIG
): Map<number, number> {
  void gameStates
  void avgPrice
  void effects
  void config
  const scores = new Map<number, number>()
  let totalScore = 0

  teams.forEach(team => {
    // Optimization 1: Use cached attractiveness scores
    const score = attractivenessCache.get(team.id)![region]
    scores.set(team.id, score)
    totalScore += score
  })

  const shares = new Map<number, number>()
  if (totalScore > 0) {
    scores.forEach((score, teamId) => {
      shares.set(teamId, (score / totalScore) * 100)
    })
  } else {
    // Optimization 5: Fix edge case - if no team is attractive, no sales happen
    // This is more realistic than equal distribution
    teams.forEach(team => shares.set(team.id, 0))
  }
  return shares
}

function calculateSalesWithRedistribution(
  teams: TeamState[],
  gameStates: Map<number, TeamGameState>,
  productionUnitsByTeam: Map<number, number>,
  idealShares: { us: Map<number, number>; asia: Map<number, number>; europe: Map<number, number> },
  demand: MarketDemand,
  attractivenessCache: Map<number, { us: number; asia: number; europe: number }>,
  config: GameConfig = GAME_CONFIG
): Map<number, TeamSales> {
  const salesMap = new Map<number, TeamSales>()
  teams.forEach(team => {
    salesMap.set(team.id, {
      us: { units: 0, revenue: 0, price: team.decisions.marketing.us.price, unmetDemand: 0 },
      asia: { units: 0, revenue: 0, price: team.decisions.marketing.asia.price, unmetDemand: 0 },
      europe: { units: 0, revenue: 0, price: team.decisions.marketing.europe.price, unmetDemand: 0 },
      total: { units: 0, revenue: 0, unmetDemand: 0 },
    })
  })

  const regions: RegionKey[] = ['us', 'asia', 'europe']
  const remainingCapacity = new Map<number, number>()
  teams.forEach(team => {
    const gameState = gameStates.get(team.id) ?? createInitialGameState(config)
    const inventoryRegional = (gameState.inventoryUS ?? 0) + (gameState.inventoryAsia ?? 0)
    const startingInventory = Math.max(
      0,
      inventoryRegional > 0 ? inventoryRegional : (gameState.inventory ?? 0)
    )
    const plannedProduction = productionUnitsByTeam.get(team.id) ?? 0
    remainingCapacity.set(team.id, plannedProduction + startingInventory)
  })

  // Optimization 6: Filter teams with capacity upfront
  const viableTeams = teams.filter(team => {
    const capacity = remainingCapacity.get(team.id) ?? 0
    return capacity > 0
  })

  const idealUnitsByTeam = new Map<number, Record<RegionKey, number>>()
  const totalIdealByTeam = new Map<number, number>()
  regions.forEach(region => {
    const regionDemand = demand[region]
    const regionShares = idealShares[region]
    teams.forEach(team => {
      const share = regionShares.get(team.id) ?? 0
      const units = Math.round(regionDemand * (share / 100))
      if (!idealUnitsByTeam.has(team.id)) idealUnitsByTeam.set(team.id, { us: 0, asia: 0, europe: 0 })
      idealUnitsByTeam.get(team.id)![region] = units
    })
  })

  teams.forEach(team => {
    const ideal = idealUnitsByTeam.get(team.id) ?? { us: 0, asia: 0, europe: 0 }
    totalIdealByTeam.set(team.id, ideal.us + ideal.asia + ideal.europe)
  })

  // Optimization 6: Only process viable teams (capacity > 0)
  viableTeams.forEach(team => {
    const totalIdeal = totalIdealByTeam.get(team.id) ?? 0
    const capacity = remainingCapacity.get(team.id) ?? 0
    if (totalIdeal <= 0) return

    const scaling = Math.min(1, capacity / totalIdeal)
    const ideal = idealUnitsByTeam.get(team.id)!
    const raw = {
      us: ideal.us * scaling,
      asia: ideal.asia * scaling,
      europe: ideal.europe * scaling,
    }
    const allocated = {
      us: Math.floor(raw.us),
      asia: Math.floor(raw.asia),
      europe: Math.floor(raw.europe),
    }
    const targetTotal = Math.min(capacity, Math.round(totalIdeal * scaling))
    let remainingUnits = targetTotal - (allocated.us + allocated.asia + allocated.europe)

    const fractions = [
      { region: 'us', frac: raw.us - allocated.us },
      { region: 'asia', frac: raw.asia - allocated.asia },
      { region: 'europe', frac: raw.europe - allocated.europe },
    ].sort((a, b) => b.frac - a.frac)

    let idx = 0
    while (remainingUnits > 0 && fractions.length > 0) {
      const fraction = fractions[idx % fractions.length]
      if (!fraction) break
      const region = fraction.region
      allocated[region] += 1
      remainingUnits -= 1
      idx += 1
    }

    const sales = salesMap.get(team.id)!
    sales.us.units = allocated.us
    sales.asia.units = allocated.asia
    sales.europe.units = allocated.europe
    // Optimization 4: Remove first unmet demand calculation (will be set later)
    remainingCapacity.set(team.id, capacity - (allocated.us + allocated.asia + allocated.europe))
  })

  regions.forEach(region => {
    const regionDemand = demand[region]
    const regionAllocated = teams.reduce((sum, team) => sum + salesMap.get(team.id)![region].units, 0)
    let regionUnmet = Math.max(0, regionDemand - regionAllocated)
    if (regionUnmet <= 0) return

    // Optimization 1: Use cached attractiveness scores instead of recalculating
    const spareTeams = teams
      .map(team => {
        const spareCapacity = remainingCapacity.get(team.id) ?? 0
        if (spareCapacity <= 0) return null
        const attractiveness = attractivenessCache.get(team.id)![region]
        return { teamId: team.id, spareCapacity, attractiveness }
      })
      .filter((entry): entry is { teamId: number; spareCapacity: number; attractiveness: number } => !!entry)

    if (spareTeams.length === 0) return

    const totalAttr = spareTeams.reduce((sum, team) => sum + team.attractiveness, 0)
    if (totalAttr <= 0) return

    // FIX: Apply quality-based conversion rate for demand redistribution
    // Prevent "forced sale" problem where 100% of disappointed customers buy inferior products
    const allocations = spareTeams.map(team => {
      let raw = (regionUnmet * team.attractiveness) / totalAttr

      // Apply quality shrinkage if enabled
      if (config.demandRedistribution.qualityShrinkageEnabled) {
        const conversionRate = team.attractiveness < config.demandRedistribution.minAttractivenessForFallback
          ? team.attractiveness / config.demandRedistribution.minAttractivenessForFallback
          : 1.0
        raw = raw * conversionRate
      }

      const base = Math.min(Math.floor(raw), team.spareCapacity)
      return { ...team, raw, allocated: base, fractional: raw - Math.floor(raw) }
    })

    allocations.forEach(team => {
      const sales = salesMap.get(team.teamId)!
      sales[region].units += team.allocated
      remainingCapacity.set(team.teamId, (remainingCapacity.get(team.teamId) ?? 0) - team.allocated)
      regionUnmet -= team.allocated
    })

    // Optimization 2: Greedy fractional allocation (better algorithm, no infinite loop risk)
    allocations.sort((a, b) => b.fractional - a.fractional)
    for (const entry of allocations) {
      if (regionUnmet <= 0) break

      const spare = remainingCapacity.get(entry.teamId) ?? 0
      const toAllocate = Math.min(spare, regionUnmet)

      if (toAllocate > 0) {
        const sales = salesMap.get(entry.teamId)!
        sales[region].units += toAllocate
        remainingCapacity.set(entry.teamId, spare - toAllocate)
        regionUnmet -= toAllocate
      }
    }
  })

  regions.forEach(region => {
    teams.forEach(team => {
      const sales = salesMap.get(team.id)!
      sales[region].revenue = sales[region].units * sales[region].price
    })
  })

  teams.forEach(team => {
    const ideal = idealUnitsByTeam.get(team.id) ?? { us: 0, asia: 0, europe: 0 }
    const sales = salesMap.get(team.id)!
    sales.us.unmetDemand = Math.max(0, ideal.us - sales.us.units)
    sales.asia.unmetDemand = Math.max(0, ideal.asia - sales.asia.units)
    sales.europe.unmetDemand = Math.max(0, ideal.europe - sales.europe.units)
  })

  teams.forEach(team => {
    const sales = salesMap.get(team.id)!
    sales.total.units = sales.us.units + sales.asia.units + sales.europe.units
    sales.total.revenue = sales.us.revenue + sales.asia.revenue + sales.europe.revenue
    sales.total.unmetDemand = sales.us.unmetDemand + sales.asia.unmetDemand + sales.europe.unmetDemand
  })

  return salesMap
}

function calculateActualMarketShare(sales: TeamSales, demand: MarketDemand): TeamMarketShare {
  return {
    us: demand.us > 0 ? sales.us.units / demand.us : 0,
    asia: demand.asia > 0 ? sales.asia.units / demand.asia : 0,
    europe: demand.europe > 0 ? sales.europe.units / demand.europe : 0,
  }
}

export function calculateUnitCost(
  decisions: TeamDecisions,
  gameState: TeamGameState,
  capacity: TeamProductionCapacity,
  config: GameConfig = GAME_CONFIG
): {
  finalUnitCost: number
  baseUnitCost: number
  finalUnitCostUS: number
  finalUnitCostAsia: number
  baseUnitCostUS: number
  baseUnitCostAsia: number
  utilizationUS: number
  utilizationAsia: number
} {
  const fallbackProduction = {
    supplierUS: 1,
    supplierAsia: 1,
    outsourceSupplier: 2,
    productionLines: {
      us1: { units: 0, supplierId: 1, techLevel: 1 },
      us2: { units: 0, supplierId: 1, techLevel: 1 },
      asia1: { units: 0, supplierId: 1, techLevel: 1 },
      asia2: { units: 0, supplierId: 1, techLevel: 1 },
    },
    outsource: { techLevel: 1, supplierId: 2, units: 0 },
    outsourceUS: 0,
    outsourceAsia: 0,
    overtime: 0,
    usUnits: 0,
    asiaUnits: 0,
  }
  const defaultsProduction = config.defaults?.production as Partial<TeamDecisions['production']> | undefined
  const production = {
    ...fallbackProduction,
    ...(defaultsProduction ?? {}),
    ...(decisions.production ?? {}),
    productionLines: {
      ...fallbackProduction.productionLines,
      ...(defaultsProduction?.productionLines ?? {}),
      ...(decisions.production?.productionLines ?? {}),
    },
  }
  const { unitCosts, costCurve, capacityPerPlant } = config
  const lines = production.productionLines ?? fallbackProduction.productionLines
  const factories = gameState.factories ?? { us: 0, asia: 0 }
  const us1Units = factories.us >= 1 ? Math.round(capacityPerPlant * lines.us1.units / 100) : 0
  const us2Units = factories.us >= 2 ? Math.round(capacityPerPlant * lines.us2.units / 100) : 0
  const asia1Units = factories.asia >= 1 ? Math.round(capacityPerPlant * lines.asia1.units / 100) : 0
  const asia2Units = factories.asia >= 2 ? Math.round(capacityPerPlant * lines.asia2.units / 100) : 0
  const usUnits = us1Units + us2Units
  const asiaUnits = asia1Units + asia2Units

  const supplierMultiplierFor = (id: number) =>
    unitCosts.supplier[id as 1 | 2 | 3 | 4] ?? unitCosts.supplier[1]

  const usSupplierMultiplier = usUnits > 0
    ? (
      (us1Units * supplierMultiplierFor(lines.us1.supplierId)) +
      (us2Units * supplierMultiplierFor(lines.us2.supplierId))
    ) / usUnits
    : supplierMultiplierFor(lines.us1.supplierId)

  const asiaSupplierMultiplier = asiaUnits > 0
    ? (
      (asia1Units * supplierMultiplierFor(lines.asia1.supplierId)) +
      (asia2Units * supplierMultiplierFor(lines.asia2.supplierId))
    ) / asiaUnits
    : supplierMultiplierFor(lines.asia1.supplierId)

  const overtimePct = Math.max(0, production.overtime ?? 0)
  const overtimeLaborPremiumPct = Math.max(0, config.defaults?.production?.overtimeLaborPremiumPct ?? 50)
  const overtimeLaborPremium = 1 + (overtimePct / 100) * (overtimeLaborPremiumPct / 100)
  const baseUnitCostUS =
    (unitCosts.directMaterialUS + (unitCosts.directLabourUS * overtimeLaborPremium)) * usSupplierMultiplier
  const baseUnitCostAsia =
    (unitCosts.directMaterialAsia + (unitCosts.directLabourAsia * overtimeLaborPremium)) * asiaSupplierMultiplier

  const overtimeMultiplier = 1 + overtimePct / 100
  const usMaxCapacity = capacity.usFactoryCount * capacityPerPlant * overtimeMultiplier
  const asiaMaxCapacity = capacity.asiaFactoryCount * capacityPerPlant * overtimeMultiplier
  const utilizationUSRaw = usMaxCapacity > 0 ? capacity.usFactoryCapacity / usMaxCapacity : costCurve.optimalUtilization
  const utilizationAsiaRaw = asiaMaxCapacity > 0 ? capacity.asiaFactoryCapacity / asiaMaxCapacity : costCurve.optimalUtilization
  const utilizationUS = Math.max(0, Math.min(1, utilizationUSRaw))
  const utilizationAsia = Math.max(0, Math.min(1, utilizationAsiaRaw))
  const usCostMultiplier = 1 + costCurve.curvature * Math.pow(utilizationUS - costCurve.optimalUtilization, 2)
  const asiaCostMultiplier = 1 + costCurve.curvature * Math.pow(utilizationAsia - costCurve.optimalUtilization, 2)

  const finalUnitCostUS = baseUnitCostUS * usCostMultiplier
  const finalUnitCostAsia = baseUnitCostAsia * asiaCostMultiplier

  // Preserve legacy aggregate values for callers that still consume a single unit cost.
  const weightUS = capacity.usFactoryCapacity
  const weightAsia = capacity.asiaFactoryCapacity
  const totalWeight = weightUS + weightAsia
  const baseUnitCost = totalWeight > 0
    ? ((baseUnitCostUS * weightUS) + (baseUnitCostAsia * weightAsia)) / totalWeight
    : baseUnitCostUS
  const finalUnitCost = totalWeight > 0
    ? ((finalUnitCostUS * weightUS) + (finalUnitCostAsia * weightAsia)) / totalWeight
    : finalUnitCostUS

  return {
    finalUnitCost,
    baseUnitCost,
    finalUnitCostUS,
    finalUnitCostAsia,
    baseUnitCostUS,
    baseUnitCostAsia,
    utilizationUS,
    utilizationAsia,
  }
}

function calculateCosts(
  decisions: TeamDecisions,
  gameState: TeamGameState,
  sales: TeamSales,
  productionUnits: number,
  prevBalanceSheet?: TeamBalanceSheet,
  effects?: ScenarioEffects,
  config: GameConfig = GAME_CONFIG,
  soldAllocation?: {
    inHouseSoldUnits: number
    outsourcedSoldUnitsUS: number
    outsourcedSoldUnitsAsia: number
  },
  inventoryHoldingValue?: number
): TeamCosts {
  const defaultsProduction = config.defaults?.production as Partial<TeamDecisions['production']> | undefined
  const fallbackProduction: TeamDecisions['production'] = {
    supplierUS: 1,
    supplierAsia: 1,
    productionLines: {
      us1: { units: 0, supplierId: 1, techLevel: 1 },
      us2: { units: 0, supplierId: 1, techLevel: 1 },
      asia1: { units: 0, supplierId: 1, techLevel: 1 },
      asia2: { units: 0, supplierId: 1, techLevel: 1 },
    },
    outsource: { techLevel: 1, supplierId: 2, units: 0 },
    outsourceUS: 0,
    outsourceAsia: 0,
    overtime: 0,
    usUnits: 0,
    asiaUnits: 0,
    demandForecast: { us: 0, asia: 0, europe: 0 },
  }
  const fallbackHr = config.defaults?.hr ?? {
    us: { employees: 0, wage: 0, training: 0 },
    asia: { employees: 0, wage: 0, training: 0 },
  }
  const fallbackMarketing = {
    us: { price: config.priceDemand.baselinePriceByRegion.us, promotionPct: 0, features: 0 },
    asia: { price: config.priceDemand.baselinePriceByRegion.asia, promotionPct: 0, features: 0 },
    europe: { price: config.priceDemand.baselinePriceByRegion.europe, promotionPct: 0, features: 0 },
  }

  const production = {
    ...fallbackProduction,
    ...(defaultsProduction ?? {}),
    ...decisions.production,
    productionLines: {
      ...fallbackProduction.productionLines,
      ...(defaultsProduction?.productionLines ?? {}),
      ...(decisions.production?.productionLines ?? {}),
    },
    outsource: {
      ...fallbackProduction.outsource,
      ...(defaultsProduction?.outsource ?? {}),
      ...(decisions.production?.outsource ?? {}),
    },
  }
  const hr = decisions.hr ?? fallbackHr
  const marketing = {
    us: decisions.marketing?.us ?? fallbackMarketing.us,
    asia: decisions.marketing?.asia ?? fallbackMarketing.asia,
    europe: decisions.marketing?.europe ?? fallbackMarketing.europe,
  }
  const { unitCosts, outsourcing, costCurve, capacityPerPlant } = config
  const costInflation = effects?.costInflation ?? 1
  const totalUnits = productionUnits

  const requestedOutsourceUS = Math.max(0, production.outsourceUS ?? 0)
  const requestedOutsourceAsia = Math.max(0, production.outsourceAsia ?? 0)
  const outsourcedUnitsUS = Math.min(requestedOutsourceUS, outsourcing.maxCapacityUS)
  const outsourcedUnitsAsia = Math.min(requestedOutsourceAsia, outsourcing.maxCapacityAsia)
  const outsourcedUnits = outsourcedUnitsUS + outsourcedUnitsAsia
  const factoryUnits = Math.max(0, totalUnits - outsourcedUnits)
  void soldAllocation?.inHouseSoldUnits
  void factoryUnits

  const defaultSupplierUS = config.defaults?.production?.supplierUS ?? 1
  const defaultSupplierAsia = config.defaults?.production?.supplierAsia ?? 1
  const lines = production.productionLines ?? {
    us1: { units: 0, supplierId: defaultSupplierUS, techLevel: 1 },
    us2: { units: 0, supplierId: defaultSupplierUS, techLevel: 1 },
    asia1: { units: 0, supplierId: defaultSupplierAsia, techLevel: 1 },
    asia2: { units: 0, supplierId: defaultSupplierAsia, techLevel: 1 },
  }
  const factories = gameState.factories ?? { us: 0, asia: 0 }
  const us1Units = factories.us >= 1 ? Math.round(capacityPerPlant * lines.us1.units / 100) : 0
  const us2Units = factories.us >= 2 ? Math.round(capacityPerPlant * lines.us2.units / 100) : 0
  const asia1Units = factories.asia >= 1 ? Math.round(capacityPerPlant * lines.asia1.units / 100) : 0
  const asia2Units = factories.asia >= 2 ? Math.round(capacityPerPlant * lines.asia2.units / 100) : 0
  const usLineUnits = us1Units + us2Units
  const asiaLineUnits = asia1Units + asia2Units
  const supplierMultiplierFor = (id: number) =>
    unitCosts.supplier[id as 1 | 2 | 3 | 4] ?? unitCosts.supplier[1]
  const usSupplierMultiplier = usLineUnits > 0
    ? (
      (us1Units * supplierMultiplierFor(lines.us1.supplierId)) +
      (us2Units * supplierMultiplierFor(lines.us2.supplierId))
    ) / usLineUnits
    : supplierMultiplierFor(lines.us1.supplierId)
  const asiaSupplierMultiplier = asiaLineUnits > 0
    ? (
      (asia1Units * supplierMultiplierFor(lines.asia1.supplierId)) +
      (asia2Units * supplierMultiplierFor(lines.asia2.supplierId))
    ) / asiaLineUnits
    : supplierMultiplierFor(lines.asia1.supplierId)

  const overtimePct = Math.max(0, production.overtime ?? 0)
  const overtimeLaborPremiumPct = Math.max(0, config.defaults?.production?.overtimeLaborPremiumPct ?? 50)
  const overtimeLaborPremium = 1 + (overtimePct / 100) * (overtimeLaborPremiumPct / 100)
  const overtimeMultiplier = 1 + overtimePct / 100
  const usMaxCapacity = factories.us * capacityPerPlant * overtimeMultiplier
  const asiaMaxCapacity = factories.asia * capacityPerPlant * overtimeMultiplier
  const utilizationUS = usMaxCapacity > 0 ? usLineUnits / usMaxCapacity : costCurve.optimalUtilization
  const utilizationAsia = asiaMaxCapacity > 0 ? asiaLineUnits / asiaMaxCapacity : costCurve.optimalUtilization
  const uUS = Math.max(0, Math.min(1, utilizationUS))
  const uAsia = Math.max(0, Math.min(1, utilizationAsia))
  const usCostMultiplier = 1 + costCurve.curvature * Math.pow(uUS - costCurve.optimalUtilization, 2)
  const asiaCostMultiplier = 1 + costCurve.curvature * Math.pow(uAsia - costCurve.optimalUtilization, 2)

  // FIX: Material and labor costs should be based on actual PRODUCTION, not sales from inventory
  // Use usLineUnits/asiaLineUnits (actual production) instead of inHouseSoldUnits (sales including inventory)
  const materialCostUS = usLineUnits * unitCosts.directMaterialUS * usSupplierMultiplier * costInflation * usCostMultiplier
  const manufacturingLaborCostUS =
    usLineUnits * unitCosts.directLabourUS * overtimeLaborPremium * usSupplierMultiplier * costInflation * usCostMultiplier
  const materialCostAsia = asiaLineUnits * unitCosts.directMaterialAsia * asiaSupplierMultiplier * costInflation * asiaCostMultiplier
  const manufacturingLaborCostAsia =
    asiaLineUnits * unitCosts.directLabourAsia * overtimeLaborPremium * asiaSupplierMultiplier * costInflation * asiaCostMultiplier
  const materialCost = materialCostUS + materialCostAsia
  const manufacturingLaborCost = manufacturingLaborCostUS + manufacturingLaborCostAsia
  const laborCost = (hr.us.employees * hr.us.wage * 12) * costInflation
  const trainingCost = (hr.us.training) * costInflation
  const hrCost = laborCost + trainingCost

  const outsourceSupplierFallback = config.defaults?.production?.outsourceSupplier ?? 2
  const outsourceSupplierId = (production.outsource?.supplierId ?? outsourceSupplierFallback) as 1 | 2 | 3 | 4
  const outsourceSupplierMultiplier = unitCosts.supplier[outsourceSupplierId] ?? unitCosts.supplier[2]
  const outsourceTechLevel = production.outsource?.techLevel ?? 1
  const outsourceTechMultiplier = config.techCostMultiplier[outsourceTechLevel] ?? 1
  const outsourceUnitCostUS =
    (unitCosts.directMaterialUS + unitCosts.directLabourUS) *
    outsourceSupplierMultiplier *
    outsourceTechMultiplier *
    (1 + outsourcing.costPremium)
  const outsourceUnitCostAsia =
    (unitCosts.directMaterialAsia + unitCosts.directLabourAsia) *
    outsourceSupplierMultiplier *
    outsourceTechMultiplier *
    (1 + outsourcing.costPremium)
  const outsourcedSoldUnitsUS = Math.max(0, soldAllocation?.outsourcedSoldUnitsUS ?? outsourcedUnitsUS)
  const outsourcedSoldUnitsAsia = Math.max(0, soldAllocation?.outsourcedSoldUnitsAsia ?? outsourcedUnitsAsia)
  const outsourceCost =
    (outsourcedSoldUnitsUS * outsourceUnitCostUS + outsourcedSoldUnitsAsia * outsourceUnitCostAsia) * costInflation

  // Calculate logistics cost using the user's shipping priority order
  // This respects the user's decisions on which markets to serve first from each supply source
  const usProduction = us1Units + us2Units + outsourcedUnitsUS
  const asiaProduction = asia1Units + asia2Units + outsourcedUnitsAsia
  const totalProduction = usProduction + asiaProduction
  const startingInventoryUS = Math.max(0, gameState.inventoryUS ?? gameState.inventory ?? 0)
  const startingInventoryAsia = Math.max(0, gameState.inventoryAsia ?? 0)
  const totalSupply = totalProduction + startingInventoryUS + startingInventoryAsia

  let logisticsCost = 0
  if (totalSupply > 0) {
    // Get user's logistics priority settings (or defaults)
    const defaultLogistics = config.defaults?.logistics ?? {
      usPriority: ['us', 'europe', 'asia'] as [RegionKey, RegionKey, RegionKey],
      asiaPriority: ['asia', 'europe', 'us'] as [RegionKey, RegionKey, RegionKey],
    }
    const logistics = decisions.logistics ?? defaultLogistics

    // Calculate allocation based on user's shipping priority
    const logisticsInput: LogisticsInput = {
      usSupply: usProduction + startingInventoryUS,
      asiaSupply: asiaProduction + startingInventoryAsia,
      demands: {
        us: sales.us.units,
        asia: sales.asia.units,
        europe: sales.europe.units,
      },
      usPriority: logistics.usPriority,
      asiaPriority: logistics.asiaPriority,
    }

    const allocation = calculateLogisticsAllocation(logisticsInput)

    // Apply scenario tariff modifiers to base tariffs: base * (1 + modifier)
    const baseTariffs = config.logisticsTariff
    const scenarioTariffs = effects?.logisticsTariff || {}
    const resolvedTariffs = applyLogisticsTariffModifiers(baseTariffs, scenarioTariffs)

    logisticsCost = calculateTotalLogisticsCost(allocation, resolvedTariffs)
  }
  logisticsCost *= costInflation

  // R&D cost = HR cost only (no separate tech spending)
  const rndCost = hrCost

  const marketingCost =
    (sales.us.revenue * marketing.us.promotionPct / 100) +
    (sales.asia.revenue * marketing.asia.promotionPct / 100) +
    (sales.europe.revenue * marketing.europe.promotionPct / 100)

  // Admin cost: Use revenue-based (3% of revenue) if revenue exists, otherwise fallback to employee-based
  const adminLaborFloor = config.hr.adminStaffFloor * hr.us.wage * 12
  const revenueBasedAdmin = sales.total.revenue * config.hr.adminRevenuePercent
  const employeeBasedAdmin = Math.max(hrCost, adminLaborFloor) * config.hr.adminOverheadPercent
  const adminCostBase = sales.total.revenue > 0 ? revenueBasedAdmin : employeeBasedAdmin
  // Apply idle factory penalty: multiply admin cost when production = 0
  const idleMultiplier = productionUnits === 0 ? config.hr.adminIdleMultiplier : 1
  const adminCost = adminCostBase * idleMultiplier

  // Inventory holding cost: charged on ending inventory value for this round
  // Includes warehousing, insurance, obsolescence risk (5% annual rate)
  const inventoryHoldingCost = (inventoryHoldingValue ?? 0) * config.hr.inventoryHoldingCostPercent

  const financial = config.financial
  const startingFinancials = getBalancedStartingFinancials(config)
  // const plantCount = gameState.factories.us + gameState.factories.asia
  const fixedAssets = prevBalanceSheet?.fixedAssets ?? startingFinancials.fixedAssets
  const depreciation = fixedAssets * financial.depreciationRate

  // Use getBalancedStartingFinancials for consistent starting debt across industries
  const longTermDebt = prevBalanceSheet?.longTermDebt ?? startingFinancials.startingDebt
  const shortTermLoans = prevBalanceSheet?.shortTermLoans ?? 0
  const interestRate = Math.max(0, financial.interestRate + (effects?.interestRateSpread ?? 0))

  // FIX: Charge interest on BOTH long-term debt and short-term loans
  // Short-term loans have penalty rate (default 2x) to discourage poor cash management
  const longTermInterest = longTermDebt * interestRate
  const shortTermInterestRate = interestRate * financial.shortTermInterestMultiplier
  const shortTermInterest = shortTermLoans * shortTermInterestRate
  const interest = longTermInterest + shortTermInterest

  const productionCost = materialCost + manufacturingLaborCost
  const totalOperating = productionCost + outsourceCost + logisticsCost + rndCost + marketingCost + adminCost + inventoryHoldingCost

  return {
    production: productionCost,
    materials: materialCost,
    labor: manufacturingLaborCost,
    logistics: logisticsCost,
    outsourcing: outsourceCost,
    hr: hrCost,
    rnd: rndCost,
    marketing: marketingCost,
    admin: adminCost,
    inventoryHolding: inventoryHoldingCost,
    depreciation,
    interest,
    totalOperating,
    totalCost: totalOperating + depreciation + interest,
  }
}

export function getEffectiveTaxRate(
  sales: TeamSales,
  effects?: ScenarioEffects,
  config: GameConfig = GAME_CONFIG
): number {
  const { taxRateByRegion, taxRate, maxEffectiveTaxRate } = config.financial
  const totalRevenue = sales.total.revenue
  if (totalRevenue <= 0) return taxRate
  const shares = {
    us: sales.us.revenue / totalRevenue,
    asia: sales.asia.revenue / totalRevenue,
    europe: sales.europe.revenue / totalRevenue,
  }
  const deltas = effects?.taxRateDeltaByRegion ?? { us: 0, asia: 0, europe: 0 }
  const clamp = (value: number) => Math.max(0, Math.min(maxEffectiveTaxRate, value))
  const rateUs = clamp(taxRateByRegion.us + deltas.us)
  const rateAsia = clamp(taxRateByRegion.asia + deltas.asia)
  const rateEurope = clamp(taxRateByRegion.europe + deltas.europe)
  return (rateUs * shares.us) + (rateAsia * shares.asia) + (rateEurope * shares.europe)
}

function calculatePnL(
  sales: TeamSales,
  costs: TeamCosts,
  effects?: ScenarioEffects,
  config: GameConfig = GAME_CONFIG,
  taxLossCarryforward: number = 0,
  enableTaxLossCarryforward: boolean = false
): TeamPnL {
  const revenue = sales.total.revenue
  const cogs = costs.materials + costs.labor + costs.logistics + costs.outsourcing
  const grossProfit = revenue - cogs
  const grossMargin = revenue > 0 ? (grossProfit / revenue) * 100 : 0
  const operatingExpenses = costs.rnd + costs.marketing + costs.admin + (costs.inventoryHolding ?? 0)
  const ebitda = grossProfit - operatingExpenses
  const ebitdaMargin = revenue > 0 ? (ebitda / revenue) * 100 : 0
  const ebit = ebitda - costs.depreciation
  const profitBeforeTax = ebit - costs.interest

  const effectiveTaxRate = getEffectiveTaxRate(sales, effects, config)
  const safeCarryforward = Math.max(0, taxLossCarryforward)
  const taxableIncome = enableTaxLossCarryforward
    ? Math.max(0, profitBeforeTax - safeCarryforward)
    : Math.max(0, profitBeforeTax)
  const tax = taxableIncome > 0 ? taxableIncome * effectiveTaxRate : 0
  const netProfit = profitBeforeTax - tax
  const taxLossCarryforwardStart = enableTaxLossCarryforward ? safeCarryforward : 0
  const taxLossCarryforwardEnd = enableTaxLossCarryforward
    ? (profitBeforeTax >= 0
      ? Math.max(0, safeCarryforward - profitBeforeTax)
      : safeCarryforward + Math.abs(profitBeforeTax))
    : 0
  const netMargin = revenue > 0 ? (netProfit / revenue) * 100 : 0
  return {
    revenue, cogs, grossProfit, grossMargin,
    operatingExpenses, ebitda, ebitdaMargin,
    depreciation: costs.depreciation, ebit,
    interestExpense: costs.interest,
    profitBeforeTax, taxableIncome, tax, netProfit, netMargin,
    taxLossCarryforwardStart,
    taxLossCarryforwardEnd,
  }
}

function calculateBalanceSheet(
  decisions: TeamDecisions,
  gameState: TeamGameState,
  sales: TeamSales,
  costs: TeamCosts,
  pnl: TeamPnL,
  capacity: TeamProductionCapacity,
  inventoryUnits: number,
  prevBalanceSheet?: TeamBalanceSheet,
  effects?: ScenarioEffects,
  config: GameConfig = GAME_CONFIG,
  previousSharePrice?: number
): TeamBalanceSheet {
  const { finance, investment } = decisions
  const { financial } = config
  const safeNumber = (value: number) => (Number.isFinite(value) ? value : 0)

  // SINGLE SOURCE OF TRUTH: Always use getBalancedStartingFinancials for fallback values
  const startingFinancials = getBalancedStartingFinancials(config)
  // const plantCount = gameState.factories.us + gameState.factories.asia
  const prevFixedAssets = prevBalanceSheet?.fixedAssets ?? startingFinancials.fixedAssets
  const prevCash = prevBalanceSheet?.cash ?? startingFinancials.startingCash
  const prevRetainedEarnings = prevBalanceSheet?.retainedEarnings ?? 0
  const prevLongTermDebt = prevBalanceSheet?.longTermDebt ?? startingFinancials.startingDebt

  const investmentMultiplier = effects?.investmentCostMultiplier ?? 1
  const newInvestment =
    investment.newPlantsUS * config.investment.plantCostUS * investmentMultiplier +
    investment.newPlantsAsia * config.investment.plantCostAsia * investmentMultiplier
  const fixedAssets = Math.max(0, safeNumber(prevFixedAssets - costs.depreciation + newInvestment))

  const workingDelta = effects?.workingCapitalDelta ?? { inventory: 0, receivable: 0, payable: 0 }
  const receivablePercent = Math.max(0, financial.receivablePercent + workingDelta.receivable)
  const payablePercent = Math.max(0, financial.payablePercent + workingDelta.payable)

  const costInflation = effects?.costInflation ?? 1
  const unitCost = calculateUnitCost(decisions, gameState, capacity, config).finalUnitCost * costInflation
  const inventory = safeNumber(Math.max(0, inventoryUnits) * unitCost * (1 + workingDelta.inventory))
  const receivables = safeNumber(sales.total.revenue * receivablePercent)
  const payableBase = pnl.cogs ?? (costs.materials + costs.labor + costs.logistics + costs.outsourcing)
  const payables = safeNumber(payableBase * payablePercent)

  const longTermDebt = safeNumber(Math.max(0, prevLongTermDebt + finance.longTermDebt))

  // FIX: Market-based share transactions with volume limits and floor
  // Bug #1: Use current market price instead of par value for buybacks/issuances
  // Bug #2: Enforce 5% buyback and 10% issuance volume limits
  // Bug #3: Set minimum shares outstanding to 100,000 to prevent EPS explosions
  const baseShareCapital = prevBalanceSheet?.shareCapital ?? startingFinancials.startingShareCapital
  const prevSharesOutstanding = baseShareCapital / config.financial.parValuePerShare
  const currentSharePrice = previousSharePrice ?? config.financial.startingSharePrice

  // Calculate actual share change based on MARKET PRICE (not par value)
  let shareIssuanceDollars = finance.shareIssuance
  let actualShareChange = 0

  if (shareIssuanceDollars > 0) {
    // Share issuance: enforce 10% volume limit
    const maxIssuanceShares = prevSharesOutstanding * financial.maxShareDilutionPerRound
    const requestedShares = shareIssuanceDollars / currentSharePrice
    const actualShares = Math.min(requestedShares, maxIssuanceShares)
    actualShareChange = actualShares
    // Adjust the actual dollar amount received based on enforced limit
    shareIssuanceDollars = actualShares * currentSharePrice
  } else if (shareIssuanceDollars < 0) {
    // Share buyback: enforce 5% volume limit
    const maxBuybackShares = prevSharesOutstanding * financial.maxBuybackPerRound
    const requestedShares = Math.abs(shareIssuanceDollars) / currentSharePrice
    const actualShares = Math.min(requestedShares, maxBuybackShares)
    actualShareChange = -actualShares
    // Adjust the actual dollar amount spent based on enforced limit
    shareIssuanceDollars = -actualShares * currentSharePrice
  }

  // Calculate new shares outstanding with 100,000 minimum floor
  const newSharesOutstanding = Math.max(100000, prevSharesOutstanding + actualShareChange)

  // Calculate share capital based on par value (accounting convention)
  const shareCapital = Math.max(0, safeNumber(newSharesOutstanding * config.financial.parValuePerShare))

  const retainedEarnings = safeNumber(prevRetainedEarnings + pnl.netProfit - finance.dividends)

  const prevInventory = prevBalanceSheet?.inventory ?? startingFinancials.inventoryValue
  const operatingCashFlow = pnl.netProfit + costs.depreciation -
    (inventory - prevInventory) -
    (receivables - (prevBalanceSheet?.receivables ?? 0)) +
    (payables - (prevBalanceSheet?.payables ?? 0))

  const prevShortTermLoans = prevBalanceSheet?.shortTermLoans ?? 0
  let cash = prevCash + operatingCashFlow +
    finance.longTermDebt + shareIssuanceDollars - finance.dividends - newInvestment - prevShortTermLoans
  cash = safeNumber(cash)

  let shortTermLoans = 0
  if (cash < financial.minCashReserve) {
    shortTermLoans = financial.minCashReserve - cash
    cash = financial.minCashReserve
  }

  const totalAssets = safeNumber(fixedAssets + inventory + receivables + cash)
  const totalLiabilities = safeNumber(longTermDebt + shortTermLoans + payables)
  const totalEquity = safeNumber(shareCapital + retainedEarnings)

  return {
    fixedAssets, inventory, receivables, cash, totalAssets,
    longTermDebt, shortTermLoans: safeNumber(shortTermLoans), payables, totalLiabilities,
    shareCapital, retainedEarnings, currentProfit: safeNumber(pnl.netProfit), totalEquity,
  }
}

function calculateRatios(pnl: TeamPnL, balanceSheet: TeamBalanceSheet, config: GameConfig = GAME_CONFIG): TeamRatios {
  const { totalEquity, totalAssets, totalLiabilities, longTermDebt } = balanceSheet

  // FIX: Cap ROE and ROCE to prevent exploits from tiny equity values
  const rawROE = totalEquity > 0 ? (pnl.netProfit / totalEquity) * 100 : 0
  const rawROCE = (totalEquity + longTermDebt) > 0 ? (pnl.ebit / (totalEquity + longTermDebt)) * 100 : 0

  return {
    roe: Math.max(-config.financial.maxROE, Math.min(config.financial.maxROE, rawROE)),
    roce: Math.max(config.financial.minROCE, Math.min(config.financial.maxROCE, rawROCE)),
    ros: pnl.revenue > 0 ? (pnl.netProfit / pnl.revenue) * 100 : 0,
    currentRatio: totalLiabilities > 0 ? (balanceSheet.cash + balanceSheet.receivables) / totalLiabilities : 0,
    debtToEquity: totalEquity > 0 ? totalLiabilities / totalEquity : 0,
    assetTurnover: totalAssets > 0 ? pnl.revenue / totalAssets : 0,
  }
}

function calculateKPIs(
  pnl: TeamPnL,
  balanceSheet: TeamBalanceSheet,
  decisions: TeamDecisions,
  gameState: TeamGameState,
  marketShare: TeamMarketShare,
  capacity: TeamProductionCapacity,
  previousRoundResults?: TeamResults | InitialRoundState,
  previousSharePrice?: number,
  config: GameConfig = GAME_CONFIG
): TeamKPIs {
  const sharesOutstanding = Math.max(1, balanceSheet.shareCapital / config.financial.parValuePerShare)
  const eps = pnl.netProfit / sharesOutstanding
  const basePERatio = config.financial.basePERatio

  const isFullTeamResults = (r: TeamResults | InitialRoundState | undefined): r is TeamResults =>
    r !== undefined && 'capacity' in r && 'marketShare' in r

  const prevCapacity = isFullTeamResults(previousRoundResults)
    ? previousRoundResults.capacity.totalCapacity
    : capacity.totalCapacity
  const capacityGrowth = prevCapacity > 0 ? (capacity.totalCapacity - prevCapacity) / prevCapacity : 0
  const prevShareTotal = isFullTeamResults(previousRoundResults)
    ? (previousRoundResults.marketShare.us + previousRoundResults.marketShare.asia + previousRoundResults.marketShare.europe) / 3
    : (marketShare.us + marketShare.asia + marketShare.europe) / 3
  const shareTotal = (marketShare.us + marketShare.asia + marketShare.europe) / 3
  const shareGain = shareTotal - prevShareTotal
  const brandScore = (gameState.brandReputation - 50) / 100

  // NEW: Calculate cash strength score
  const totalAssets = balanceSheet.cash + balanceSheet.inventory +
    balanceSheet.receivables + balanceSheet.fixedAssets
  const cashScore = Math.max(0, Math.min(1,
    (balanceSheet.cash - config.financial.minCashReserve) /
    (totalAssets * 0.30)  // Cash >30% of assets = strong position
  ))

  const weights = config.financial.growthPremiumWeights
  const rawPremium =
    (capacityGrowth * (weights.capacity ?? 0.10)) +
    (shareGain * (weights.share ?? 0.10)) +
    (brandScore * (weights.brand ?? 0.08)) +
    (cashScore * (weights.cash ?? 0.04))

  const { down, up } = config.financial.growthPremiumCap
  const growthPremium = Math.max(down, Math.min(up, rawPremium))

  // NEW: Calculate profitability quality multiplier
  const profitMargin = pnl.revenue > 0 ? pnl.netProfit / pnl.revenue : 0
  const roeScore = balanceSheet.shareCapital > 0 ?
    pnl.netProfit / balanceSheet.shareCapital : 0

  // Quality multiplier ranges from 0.85 to 1.15
  const qualityMultiplier = 1 + Math.max(-0.15, Math.min(0.15,
    (profitMargin * 0.5) + (roeScore * 0.5) - 0.10
  ))

  // Apply both growth premium and quality multiplier to P/E ratio
  const peRatio = basePERatio * (1 + growthPremium) * qualityMultiplier

  const sharePriceBase = Math.max(1, eps * peRatio)
  const basePrice = Math.max(1, previousSharePrice ?? config.financial.startingSharePrice)
  const smoothingPrevWeight = Math.max(0, Math.min(1, config.financial.sharePriceSmoothingPrevWeight))
  const smoothingModelWeight = 1 - smoothingPrevWeight
  const smoothedPrice = (basePrice * smoothingPrevWeight) + (sharePriceBase * smoothingModelWeight)
  const maxDrop = Math.max(0, Math.min(0.95, config.financial.maxSharePriceDropPct))
  const protectedFloor = basePrice * (1 - maxDrop)

  // NEW: Progressive debt penalty based on debt/asset ratio (replaces fixed loan penalty)
  const totalDebt = balanceSheet.shortTermLoans + balanceSheet.longTermDebt
  const debtToAssets = totalAssets > 0 ? totalDebt / totalAssets : 0
  const thresholds = config.financial.debtPenaltyThresholds ?? { safe: 0.20, warning: 0.40, danger: 0.60 }

  const debtPenalty = Math.max(0, Math.min(0.30,
    debtToAssets < thresholds.safe ? 0 :                              // <20%: No penalty
      debtToAssets < thresholds.warning ?
        (debtToAssets - thresholds.safe) * 0.5 :                        // 20-40%: Mild penalty
        0.10 + (debtToAssets - thresholds.warning) * 1.0                  // >40%: Escalating penalty
  ))

  const penalizedPrice = smoothedPrice * (1 - debtPenalty)
  const sharePrice = Math.max(penalizedPrice, protectedFloor, 1)

  const marketCap = sharePrice * sharesOutstanding
  const dividendYield = marketCap > 0 ? (decisions.finance.dividends / marketCap) * 100 : 0
  const dividendPerShare = decisions.finance.dividends / sharesOutstanding
  const tsr = ((sharePrice - basePrice + dividendPerShare) / basePrice) * 100

  return {
    eps,
    sharePrice,
    marketCap,
    sharesOutstanding,
    dividendYield,
    tsr,
    growthPremium,
    sharePriceTrace: {
      basePrice,
      prevSharePrice: previousSharePrice ?? config.financial.startingSharePrice,
      eps,
      basePERatio,
      growthPremium,
      peRatio,
      capacityGrowth,
      shareGain,
      techScore: 0,
      brandScore,
      sharePriceBase,
      smoothingPrevWeight,
      smoothedPrice,
      protectedFloor,
      finalSharePrice: sharePrice,
    },
  }
}

function updateBrandReputation(
  prevReputation: number,
  sales: TeamSales,
  pnl: TeamPnL,
  marketShare: TeamMarketShare,
  teamCount: number
): number {
  // FIX: Calculate fair share dynamically based on team count
  // Bug: Hardcoded 50% baseline breaks multi-team games (e.g., 4 teams = 25% fair share)
  const fairShare = 100 / teamCount
  const avgShare = (marketShare.us + marketShare.asia + marketShare.europe) / 3
  const shareBonus = (avgShare - fairShare) * 0.1
  const profitBonus = pnl.netMargin * 0.2
  const unmetPenalty = sales.total.unmetDemand > 0 ? -Math.min(10, sales.total.unmetDemand / 10000) : 0
  const decay = (fairShare - prevReputation) * 0.05
  return Math.max(0, Math.min(100, prevReputation + shareBonus + profitBonus + unmetPenalty + decay))
}

// ============================================================================
// MAIN ENGINE - DEDUPLICATED
// ============================================================================

export function calculateRoundInternal(
  teams: TeamState[],
  round: number,
  previousGameStates?: Map<number, TeamGameState>,
  scenarioSequence?: number[],
  marketDemandMultiplier: number = 1,
  config: GameConfig = GAME_CONFIG,
  regionDemandSplit?: { us: number; asia: number; europe: number },
  taxLossCarryforwardEnabled: boolean = false
): RoundAuditResults {
  const teamCount = teams.length
  const gameStates = new Map<number, TeamGameState>()
  const researchHoursByTeam = new Map<number, number>()

  teams.forEach(team => {
    const prevState = previousGameStates?.get(team.id) ?? createInitialGameState(config)
    const researchHours = calculateResearchHoursThisRound(team.decisions, config)
    const rndProgress = updateRnDProgress(prevState.rndProgress, researchHours, config)
    const { factories, pendingInvestments } = updateFactoryState(prevState, team.decisions, round, config)

    gameStates.set(team.id, {
      factories,
      pendingInvestments,
      rndProgress,
      cumulativeProduction: prevState.cumulativeProduction,
      brandReputation: prevState.brandReputation,
      inventory: prevState.inventory,
      inventoryUS: prevState.inventoryUS,
      inventoryAsia: prevState.inventoryAsia,
      previousRoundResults: prevState.previousRoundResults,
      totalDividendsPaid: prevState.totalDividendsPaid || 0,
      totalDebtBorrowed: prevState.totalDebtBorrowed || 0,
      totalDebtRepaid: prevState.totalDebtRepaid || 0,
      totalSharesIssued: prevState.totalSharesIssued || 0,
      totalSharesBoughtBack: prevState.totalSharesBoughtBack || 0,
      taxLossCarryforward: prevState.taxLossCarryforward ?? 0,
    })
    researchHoursByTeam.set(team.id, researchHours)
  })

  const normalizedTeams = teams.map(team => ({
    ...team,
    decisions: normalizeProductionLines(team.decisions, gameStates.get(team.id)!, config)
  }))

  const capacities = new Map<number, TeamProductionCapacity>()
  normalizedTeams.forEach(team => {
    const gameState = gameStates.get(team.id)!
    capacities.set(team.id, calculateCapacity(gameState, team.decisions, config))
  })

  const productionByTeam = new Map<number, ReturnType<typeof calculatePlannedProductionUnits>>()
  const productionUnitsByTeam = new Map<number, number>()
  normalizedTeams.forEach(team => {
    const capacity = capacities.get(team.id)!
    const production = calculatePlannedProductionUnits(team.decisions, capacity)
    productionByTeam.set(team.id, production)
    productionUnitsByTeam.set(team.id, production.totalUnits)
  })

  const isTeamResults = (value: TeamResults | InitialRoundState | undefined): value is TeamResults =>
    Boolean(value && (value as TeamResults).sales && (value as TeamResults).marketShare)
  const lastRoundTotalUnitsSold = Array.from(gameStates.values())
    .map((state) => state.previousRoundResults)
    .filter(isTeamResults)
    .reduce((sum, results) => sum + (results.sales?.total?.units ?? 0), 0)
  let baseDemandTotal = lastRoundTotalUnitsSold > 0 ? lastRoundTotalUnitsSold : undefined

  if (baseDemandTotal === undefined && round >= 0) {
    const startingResults = calculateRoundMinus1(
      teamCount,
      config,
      scenarioSequence ?? [0],
      marketDemandMultiplier,
      regionDemandSplit
    )
    baseDemandTotal = startingResults.teams.reduce((sum, team) => sum + (team.sales?.total?.units ?? 0), 0) || undefined
  }

  let previousMarketDemand: { us: number; asia: number; europe: number } | undefined
  if (round >= 0 && previousGameStates?.size) {
    for (const state of previousGameStates.values()) {
      const demand = (state.previousRoundResults as { marketDemand?: { us?: number; asia?: number; europe?: number } } | undefined)?.marketDemand
      if (demand && typeof demand.us === 'number') {
        previousMarketDemand = demand as { us: number; asia: number; europe: number }
        break
      }
    }
  }

  const effects = round < 0 ? {
    priceElasticityModifier: 1,
    csrImportanceModifier: 1,
    marketingEffectModifier: 1,
    costInflation: 1,
    investmentCostMultiplier: 1,
    interestRateSpread: 0,
    taxRateDeltaByRegion: { us: 0, asia: 0, europe: 0 },
    workingCapitalDelta: { inventory: 0, receivable: 0, payable: 0 },
    demandGrowthModifier: { us: 0, asia: 0, europe: 0 },
  } : getScenarioEffectsForRound(round <= 0 ? 0 : round, scenarioSequence)
  const marketDemand = calculateMarketDemand(
    round,
    scenarioSequence,
    marketDemandMultiplier,
    config,
    teamCount,
    regionDemandSplit,
    baseDemandTotal,
    previousMarketDemand
  )
  const priceDemand = {
    us: calculateMarketDemandMultiplier(normalizedTeams, 'us', effects, config),
    asia: calculateMarketDemandMultiplier(normalizedTeams, 'asia', effects, config),
    europe: calculateMarketDemandMultiplier(normalizedTeams, 'europe', effects, config),
  }

  const adjustedMarketDemand = {
    us: Math.round(marketDemand.us * priceDemand.us.multiplier),
    asia: Math.round(marketDemand.asia * priceDemand.asia.multiplier),
    europe: Math.round(marketDemand.europe * priceDemand.europe.multiplier),
    total: 0,
  }
  adjustedMarketDemand.total = adjustedMarketDemand.us + adjustedMarketDemand.asia + adjustedMarketDemand.europe

  // Optimization 3: Precompute average prices once
  const avgPrices = {
    us: normalizedTeams.reduce((sum, t) => sum + t.decisions.marketing.us.price, 0) / normalizedTeams.length,
    asia: normalizedTeams.reduce((sum, t) => sum + t.decisions.marketing.asia.price, 0) / normalizedTeams.length,
    europe: normalizedTeams.reduce((sum, t) => sum + t.decisions.marketing.europe.price, 0) / normalizedTeams.length,
  }

  // Optimization 1: Cache attractiveness scores (calculate once for all regions)
  const attractivenessCache = new Map<number, { us: number; asia: number; europe: number }>()
  normalizedTeams.forEach(team => {
    const gameState = gameStates.get(team.id) ?? createInitialGameState(config)
    attractivenessCache.set(team.id, {
      us: calculateAttractiveness(team.decisions, gameState, 'us', avgPrices.us, effects, config),
      asia: calculateAttractiveness(team.decisions, gameState, 'asia', avgPrices.asia, effects, config),
      europe: calculateAttractiveness(team.decisions, gameState, 'europe', avgPrices.europe, effects, config),
    })
  })

  const idealShares = {
    us: calculateIdealMarketShares(normalizedTeams, gameStates, 'us', avgPrices.us, attractivenessCache, effects, config),
    asia: calculateIdealMarketShares(normalizedTeams, gameStates, 'asia', avgPrices.asia, attractivenessCache, effects, config),
    europe: calculateIdealMarketShares(normalizedTeams, gameStates, 'europe', avgPrices.europe, attractivenessCache, effects, config),
  }

  const salesMap = calculateSalesWithRedistribution(normalizedTeams, gameStates, productionUnitsByTeam, idealShares, adjustedMarketDemand, attractivenessCache, config)

  // Audit helpers
  const idealSharesBreakdown = (region: RegionKey) => {
    // Optimization 3: Use precomputed average price
    const avgPrice = avgPrices[region]
    const breakdownTeams: Array<{ teamId: number; teamName: string; score: number; sharePct: number; breakdown: AttractivenessBreakdown }> = []
    let totalScore = 0
    normalizedTeams.forEach(team => {
      const gameState = gameStates.get(team.id) ?? createInitialGameState(config)
      const breakdown = calculateAttractivenessBreakdown(team.decisions, gameState, region, avgPrice, effects, config)
      totalScore += breakdown.finalScore
      breakdownTeams.push({
        teamId: team.id,
        teamName: team.name,
        score: breakdown.finalScore,
        sharePct: idealShares[region].get(team.id) ?? 0,
        breakdown,
      })
    })
    return { avgPrice, totalScore, teams: breakdownTeams }
  }

  const idealSharesAudit = {
    us: idealSharesBreakdown('us'),
    asia: idealSharesBreakdown('asia'),
    europe: idealSharesBreakdown('europe'),
  }
  const breakdownByTeam = new Map<number, { us: AttractivenessBreakdown; asia: AttractivenessBreakdown; europe: AttractivenessBreakdown }>()
  idealSharesAudit.us.teams.forEach((team) => {
    breakdownByTeam.set(team.teamId, {
      us: team.breakdown,
      asia: idealSharesAudit.asia.teams.find((row) => row.teamId === team.teamId)?.breakdown ?? team.breakdown,
      europe: idealSharesAudit.europe.teams.find((row) => row.teamId === team.teamId)?.breakdown ?? team.breakdown,
    })
  })

  const teamResults = normalizedTeams.map(team => {
    const gameState = gameStates.get(team.id)!
    const capacity = capacities.get(team.id)!
    const sales = salesMap.get(team.id)!
    const researchHours = researchHoursByTeam.get(team.id) ?? 0
    const prevBalanceSheet = previousGameStates?.get(team.id)?.previousRoundResults?.balanceSheet
    const startingInventoryUS = Math.max(0, gameState.inventoryUS ?? gameState.inventory ?? 0)
    const startingInventoryAsia = Math.max(0, gameState.inventoryAsia ?? 0)
    const startingInventoryUnits = startingInventoryUS + startingInventoryAsia
    const production = productionByTeam.get(team.id)!
    const productionUnits = production.totalUnits
    const availableUnits = productionUnits + startingInventoryUnits

    const defaultLogistics = config.defaults?.logistics ?? {
      usPriority: ['us', 'europe', 'asia'] as [RegionKey, RegionKey, RegionKey],
      asiaPriority: ['asia', 'europe', 'us'] as [RegionKey, RegionKey, RegionKey],
    }
    const logistics = team.decisions.logistics ?? defaultLogistics
    const productionDecision = team.decisions.production ?? {}
    const requestedOutsourceUS = Math.max(0, productionDecision.outsourceUS ?? 0)
    const requestedOutsourceAsia = Math.max(0, productionDecision.outsourceAsia ?? 0)
    const usOutsourceUnits = Math.min(requestedOutsourceUS, capacity.usOutsourceCapacity)
    const asiaOutsourceUnits = Math.min(requestedOutsourceAsia, capacity.asiaOutsourceCapacity)
    const usProduction = production.usFactoryUnits + usOutsourceUnits
    const asiaProduction = production.asiaFactoryUnits + asiaOutsourceUnits
    const allocation = calculateLogisticsAllocation({
      usSupply: usProduction + startingInventoryUS,
      asiaSupply: asiaProduction + startingInventoryAsia,
      demands: {
        us: sales.us.units,
        asia: sales.asia.units,
        europe: sales.europe.units,
      },
      usPriority: logistics.usPriority,
      asiaPriority: logistics.asiaPriority,
    })
    const inHouseAllocation = calculateLogisticsAllocation({
      usSupply: production.usFactoryUnits + startingInventoryUS,
      asiaSupply: production.asiaFactoryUnits + startingInventoryAsia,
      demands: {
        us: sales.us.units,
        asia: sales.asia.units,
        europe: sales.europe.units,
      },
      usPriority: logistics.usPriority,
      asiaPriority: logistics.asiaPriority,
    })
    const usSupplyUsed = allocation.us.local + allocation.asia.fromUS + allocation.europe.fromUS
    const asiaSupplyUsed = allocation.asia.local + allocation.us.fromAsia + allocation.europe.fromAsia
    const inHouseUsUsed = inHouseAllocation.us.local + inHouseAllocation.asia.fromUS + inHouseAllocation.europe.fromUS
    const inHouseAsiaUsed = inHouseAllocation.asia.local + inHouseAllocation.us.fromAsia + inHouseAllocation.europe.fromAsia

    // Ending inventory includes BOTH factory and outsourced production
    // Formula: Starting Inventory + Total Production (Factory + Outsource) - Units Used
    const endingInventoryUS = Math.max(0, startingInventoryUS + production.usFactoryUnits + usOutsourceUnits - usSupplyUsed)
    const endingInventoryAsia = Math.max(0, startingInventoryAsia + production.asiaFactoryUnits + asiaOutsourceUnits - asiaSupplyUsed)
    const endingInventoryUnits = endingInventoryUS + endingInventoryAsia
    const inHouseSoldUnits = inHouseUsUsed + inHouseAsiaUsed
    // const totalSoldUnits = sales.total.units

    // Outsourcing cost is based on ALL outsourced units produced (not just sold)
    // Since outsourced units now enter inventory, we pay for what we produce
    const outsourcedSoldUnitsUS = usOutsourceUnits
    const outsourcedSoldUnitsAsia = asiaOutsourceUnits

    const marketShare = calculateActualMarketShare(sales, adjustedMarketDemand)
    const avgPrices = {
      us: idealSharesAudit.us.avgPrice,
      asia: idealSharesAudit.asia.avgPrice,
      europe: idealSharesAudit.europe.avgPrice,
    }

    const attractivenessScore = {
      us: calculateAttractiveness(team.decisions, gameState, 'us', avgPrices.us, effects, config),
      asia: calculateAttractiveness(team.decisions, gameState, 'asia', avgPrices.asia, effects, config),
      europe: calculateAttractiveness(team.decisions, gameState, 'europe', avgPrices.europe, effects, config),
    }

    // Inventory holding cost value based on ending inventory this round
    const workingDelta = effects?.workingCapitalDelta ?? { inventory: 0, receivable: 0, payable: 0 }
    const costInflation = effects?.costInflation ?? 1
    const unitCost = calculateUnitCost(team.decisions, gameState, capacity, config).finalUnitCost * costInflation
    const inventoryHoldingValue = endingInventoryUnits * unitCost * (1 + workingDelta.inventory)

    const costs = calculateCosts(team.decisions, gameState, sales, productionUnits, prevBalanceSheet, effects, config, {
      inHouseSoldUnits,
      outsourcedSoldUnitsUS,
      outsourcedSoldUnitsAsia,
    }, inventoryHoldingValue)
    const carryforwardStart = taxLossCarryforwardEnabled ? (gameState.taxLossCarryforward ?? 0) : 0
    const pnl = calculatePnL(sales, costs, effects, config, carryforwardStart, taxLossCarryforwardEnabled)
    const prevSharePrice = previousGameStates?.get(team.id)?.previousRoundResults?.kpis?.sharePrice ?? config.financial.startingSharePrice

    const balanceSheet = calculateBalanceSheet(team.decisions, gameState, sales, costs, pnl, capacity, endingInventoryUnits, prevBalanceSheet, effects, config, prevSharePrice)
    const ratios = calculateRatios(pnl, balanceSheet, config)
    const kpis = calculateKPIs(pnl, balanceSheet, team.decisions, gameState, marketShare, capacity, previousGameStates?.get(team.id)?.previousRoundResults, prevSharePrice, config)

    const newBrandReputation = updateBrandReputation(gameState.brandReputation, sales, pnl, marketShare, teamCount)

    const debtChange = team.decisions.finance.longTermDebt
    const shareChange = team.decisions.finance.shareIssuance
    const updatedGameState: TeamGameState = {
      ...gameState,
      cumulativeProduction: gameState.cumulativeProduction + productionUnits,
      brandReputation: newBrandReputation,
      inventory: endingInventoryUnits,
      inventoryUS: endingInventoryUS,
      inventoryAsia: endingInventoryAsia,
      totalDividendsPaid: (gameState.totalDividendsPaid || 0) + team.decisions.finance.dividends,
      totalDebtBorrowed: (gameState.totalDebtBorrowed || 0) + Math.max(0, debtChange),
      totalDebtRepaid: (gameState.totalDebtRepaid || 0) + Math.abs(Math.min(0, debtChange)),
      totalSharesIssued: (gameState.totalSharesIssued || 0) + Math.max(0, shareChange),
      totalSharesBoughtBack: (gameState.totalSharesBoughtBack || 0) + Math.abs(Math.min(0, shareChange)),
      taxLossCarryforward: taxLossCarryforwardEnabled
        ? pnl.taxLossCarryforwardEnd
        : (gameState.taxLossCarryforward ?? 0),
    }

    // Full audit trace object
    const auditTrace = {
      demand: {
        formula: 'desired_units = adjusted_market_demand * (ideal_share_pct / 100)',
        marketDemand: adjustedMarketDemand,
        idealSharePct: {
          us: idealShares.us.get(team.id) ?? 0,
          asia: idealShares.asia.get(team.id) ?? 0,
          europe: idealShares.europe.get(team.id) ?? 0,
        },
        desiredUnits: {
          us: (idealShares.us.get(team.id) ?? 0) / 100 * adjustedMarketDemand.us,
          asia: (idealShares.asia.get(team.id) ?? 0) / 100 * adjustedMarketDemand.asia,
          europe: (idealShares.europe.get(team.id) ?? 0) / 100 * adjustedMarketDemand.europe,
        },
      },
      inventory: {
        startingUnits: startingInventoryUnits,
        startingUnitsUS: startingInventoryUS,
        startingUnitsAsia: startingInventoryAsia,
        productionUnits,
        availableUnits,
        endingUnits: endingInventoryUnits,
        endingUnitsUS: endingInventoryUS,
        endingUnitsAsia: endingInventoryAsia,
      },
      costs,
      pnl,
      balanceSheet,
      kpis,
    }

    return {
      teamId: team.id,
      teamName: team.name,
      round,
      decisions: team.decisions,
      production,
      inventoryTrace: {
        startingUnits: startingInventoryUnits,
        endingUnits: endingInventoryUnits,
        startingUnitsUS: startingInventoryUS,
        startingUnitsAsia: startingInventoryAsia,
        endingUnitsUS: endingInventoryUS,
        endingUnitsAsia: endingInventoryAsia,
      },
      gameState: updatedGameState,
      capacity,
      productionUnits,
      availableFeatures: gameState.rndProgress.unlockedFeatureCount,
      availableTechLevel: gameState.rndProgress.unlockedTechLevel,
      researchHoursThisRound: researchHours,
      rndProgress: gameState.rndProgress,
      marketShare,
      attractivenessScore,
      attractivenessBreakdown: breakdownByTeam.get(team.id) ?? null,
      sales,
      costs,
      pnl,
      balanceSheet,
      ratios,
      kpis,
      audit: {
        desiredUnits: auditTrace.demand.desiredUnits,
        capacity,
        trace: auditTrace
      }
    }
  })

  const winner = {
    byRevenue: teamResults.reduce((max, t) => t.pnl.revenue > (teamResults.find(r => r.teamId === max)?.pnl.revenue ?? 0) ? t.teamId : max, teamResults[0]?.teamId ?? 0),
    byProfit: teamResults.reduce((max, t) => t.pnl.netProfit > (teamResults.find(r => r.teamId === max)?.pnl.netProfit ?? 0) ? t.teamId : max, teamResults[0]?.teamId ?? 0),
    byMarketShare: teamResults.reduce((max, t) => {
      const total = t.marketShare.us + t.marketShare.asia + t.marketShare.europe
      const maxTotal = teamResults.find(r => r.teamId === max)
      const maxSum = maxTotal ? maxTotal.marketShare.us + maxTotal.marketShare.asia + maxTotal.marketShare.europe : 0
      return total > maxSum ? t.teamId : max
    }, teamResults[0]?.teamId ?? 0),
    byTSR: teamResults.reduce((max, t) => t.kpis.tsr > (teamResults.find(r => r.teamId === max)?.kpis.tsr ?? 0) ? t.teamId : max, teamResults[0]?.teamId ?? 0),
    bySharePrice: teamResults.reduce((max, t) => t.kpis.sharePrice > (teamResults.find(r => r.teamId === max)?.kpis.sharePrice ?? 0) ? t.teamId : max, teamResults[0]?.teamId ?? 0),
  }

  const sharePriceTraceSummary = teamResults.map((team) => ({
    teamId: team.teamId,
    teamName: team.teamName,
    trace: team.kpis.sharePriceTrace,
  }))

  const marketDemandBreakdown = {
    round,
    teamCount,
    // Base demand = capacityPerPlant × 1 × teamCount, split by region
    capacityPerPlant: config.capacityPerPlant,
    baseDemandTotal: config.capacityPerPlant * teamCount,
    marketGrowthRate: config.marketGrowthRate,
    adjustedMarketDemand,
  }

  return {
    round,
    marketDemand: adjustedMarketDemand,
    sharePriceTraceSummary,
    marketDemandBreakdown: marketDemandBreakdown as unknown, // Simplify for deduplication
    idealShares: idealSharesAudit,
    teams: teamResults,
    winner,
  }
}

export function calculateRound(
  teams: TeamState[],
  round: number,
  previousGameStates?: Map<number, TeamGameState>,
  scenarioSequence?: number[],
  marketDemandMultiplier: number = 1,
  config: GameConfig = GAME_CONFIG,
  regionDemandSplit?: { us: number; asia: number; europe: number },
  taxLossCarryforwardEnabled: boolean = false
): RoundResults {
  const auditResult = calculateRoundInternal(teams, round, previousGameStates, scenarioSequence, marketDemandMultiplier, config, regionDemandSplit, taxLossCarryforwardEnabled)
  // Strip audit info to return RoundResults
  const strippedTeams: TeamResults[] = auditResult.teams.map(t => {
    const rest = { ...t }
    delete (rest as { audit?: unknown }).audit
    return rest
  })

  return {
    round: auditResult.round,
    marketDemand: auditResult.marketDemand,
    teams: strippedTeams,
    winner: auditResult.winner
  }
}

/**
 * processRound - Simplified wrapper for strategy simulation
 *
 * This is an alias for calculateRound, provided for the strategy simulation framework.
 * Processes a single round of gameplay with multiple teams and returns results.
 */
export function processRound(
  teams: TeamState[],
  round: number,
  previousGameStates?: Map<number, TeamGameState>,
  scenarioSequence?: number[],
  marketDemandMultiplier: number = 1,
  config: GameConfig = GAME_CONFIG,
  regionDemandSplit?: { us: number; asia: number; europe: number },
  taxLossCarryforwardEnabled: boolean = false
): RoundResults {
  return calculateRound(teams, round, previousGameStates, scenarioSequence, marketDemandMultiplier, config, regionDemandSplit, taxLossCarryforwardEnabled)
}

export function calculateRoundAudit(
  teams: TeamState[],
  round: number,
  previousGameStates?: Map<number, TeamGameState>,
  scenarioSequence?: number[],
  marketDemandMultiplier: number = 1,
  config: GameConfig = GAME_CONFIG,
  regionDemandSplit?: { us: number; asia: number; europe: number },
  taxLossCarryforwardEnabled: boolean = false
): RoundAuditResults {
  return calculateRoundInternal(teams, round, previousGameStates, scenarioSequence, marketDemandMultiplier, config, regionDemandSplit, taxLossCarryforwardEnabled)
}

export interface TurnPrediction {
  revenue: number
  grossProfit: number
  netProfit: number
  closingCash: number
  totalUnitsSold: number
  inventoryEnding: number
  unitCost: number
  utilization: number
  marketShare: { us: number; asia: number; europe: number }
  unmetDemand: number
  productionUnits: number
  hrCost: number
  logisticsCost: number
}

/**
 * predictTurnOutcome
 * 
 * Provides a "Pro Forma" forecast for a single team based on their current draft decisions.
 * Used to power the "Projected Impact" panel in the UI.
 * 
 * Note: This assumes competitors are pricing at the market baseline.
 */
export function predictTurnOutcome(
  teamDecisions: TeamDecisions,
  gameState: TeamGameState,
  round: number,
  scenarioSequence?: number[],
  config: GameConfig = GAME_CONFIG
): TurnPrediction {
  // 1. Setup context
  const effects = getScenarioEffectsForRound(round, scenarioSequence)
  const capacity = calculateCapacity(gameState, teamDecisions, config)
  const production = calculatePlannedProductionUnits(teamDecisions, capacity)

  // 2. Assume competitors are at baseline for share calculation
  const baseline = config.priceDemand.baselinePriceByRegion
  const marketAvgPrices = {
    us: baseline.us,
    asia: baseline.asia,
    europe: baseline.europe
  }

  // 3. Calculate Player Attractiveness
  const scores = {
    us: calculateAttractiveness(teamDecisions, gameState, 'us', marketAvgPrices.us, effects, config),
    asia: calculateAttractiveness(teamDecisions, gameState, 'asia', marketAvgPrices.asia, effects, config),
    europe: calculateAttractiveness(teamDecisions, gameState, 'europe', marketAvgPrices.europe, effects, config)
  }

  // 4. Estimate Market Share (Simplification: 1/4 of market adjusted by relative score)
  // Assume a 4-team market for prediction purposes
  const estimatedTeamCount = 4
  const baselineScore = 50 // Typical score for a balanced competitor
  const calculateShare = (playerScore: number) => {
    const totalMarketScore = playerScore + (baselineScore * (estimatedTeamCount - 1))
    return (playerScore / totalMarketScore)
  }

  const marketShare = {
    us: calculateShare(scores.us),
    asia: calculateShare(scores.asia),
    europe: calculateShare(scores.europe)
  }

  // 5. Calculate Sales
  const marketDemand = calculateMarketDemand(round, scenarioSequence, 1.0, config, estimatedTeamCount)
  const inventoryRegional = (gameState.inventoryUS ?? 0) + (gameState.inventoryAsia ?? 0)
  const inventoryTotal = Math.max(
    0,
    inventoryRegional > 0 ? inventoryRegional : (gameState.inventory ?? 0)
  )
  const availableUnits = production.totalUnits + inventoryTotal

  const potentialSales = {
    us: marketDemand.us * marketShare.us,
    asia: marketDemand.asia * marketShare.asia,
    europe: marketDemand.europe * marketShare.europe
  }
  const totalPotential = potentialSales.us + potentialSales.asia + potentialSales.europe

  // Constrain by capacity
  const salesRatio = totalPotential > 0 ? Math.min(1, availableUnits / totalPotential) : 0
  const actualSalesUnits = {
    us: Math.round(potentialSales.us * salesRatio),
    asia: Math.round(potentialSales.asia * salesRatio),
    europe: Math.round(potentialSales.europe * salesRatio)
  }
  const totalSold = actualSalesUnits.us + actualSalesUnits.asia + actualSalesUnits.europe

  const marketingFallback = {
    us: teamDecisions.marketing?.us ?? { price: baseline.us, promotionPct: 0, features: 0 },
    asia: teamDecisions.marketing?.asia ?? { price: baseline.asia, promotionPct: 0, features: 0 },
    europe: teamDecisions.marketing?.europe ?? { price: baseline.europe, promotionPct: 0, features: 0 },
  }

  const sales: TeamSales = {
    us: { units: actualSalesUnits.us, revenue: actualSalesUnits.us * marketingFallback.us.price, price: marketingFallback.us.price, unmetDemand: potentialSales.us - actualSalesUnits.us },
    asia: { units: actualSalesUnits.asia, revenue: actualSalesUnits.asia * marketingFallback.asia.price, price: marketingFallback.asia.price, unmetDemand: potentialSales.asia - actualSalesUnits.asia },
    europe: { units: actualSalesUnits.europe, revenue: actualSalesUnits.europe * marketingFallback.europe.price, price: marketingFallback.europe.price, unmetDemand: potentialSales.europe - actualSalesUnits.europe },
    total: { units: totalSold, revenue: 0, unmetDemand: 0 }
  }
  sales.total.revenue = sales.us.revenue + sales.asia.revenue + sales.europe.revenue

  // 6. Financials
  const prevBalanceSheet = gameState.previousRoundResults?.balanceSheet
  const startingInventoryUnits = Math.max(0, (gameState.inventoryUS ?? gameState.inventory ?? 0) + (gameState.inventoryAsia ?? 0))
  const requestedOutsourceUS = Math.max(0, teamDecisions.production?.outsourceUS ?? 0)
  const requestedOutsourceAsia = Math.max(0, teamDecisions.production?.outsourceAsia ?? 0)
  const outsourceUS = Math.min(requestedOutsourceUS, capacity.usOutsourceCapacity)
  const outsourceAsia = Math.min(requestedOutsourceAsia, capacity.asiaOutsourceCapacity)

  // Total available includes factory + outsource + starting inventory
  // const totalAvailable = production.factoryUnits + outsourceUS + outsourceAsia + startingInventoryUnits
  const inHouseAvailable = production.factoryUnits + startingInventoryUnits
  const inHouseSoldUnits = Math.max(0, Math.min(inHouseAvailable, totalSold))

  // Outsourcing cost is based on ALL outsourced units produced
  const outsourcedSoldUnitsUS = outsourceUS
  const outsourcedSoldUnitsAsia = outsourceAsia

  // Ending inventory = Starting + Total Production (Factory + Outsource) - Total Sold
  const inventoryEnding = Math.max(0, startingInventoryUnits + production.factoryUnits + outsourceUS + outsourceAsia - totalSold)

  // Inventory holding cost value based on ending inventory this round
  const workingDelta = effects?.workingCapitalDelta ?? { inventory: 0, receivable: 0, payable: 0 }
  const costInflation = effects?.costInflation ?? 1
  const unitCost = calculateUnitCost(teamDecisions, gameState, capacity, config).finalUnitCost * costInflation
  const inventoryHoldingValue = inventoryEnding * unitCost * (1 + workingDelta.inventory)

  const costs = calculateCosts(teamDecisions, gameState, sales, production.totalUnits, prevBalanceSheet, effects, config, {
    inHouseSoldUnits,
    outsourcedSoldUnitsUS,
    outsourcedSoldUnitsAsia,
  }, inventoryHoldingValue)
  const pnl = calculatePnL(sales, costs, effects, config)

  // Use starting share price for predictions (no previous round data available)
  const balanceSheet = calculateBalanceSheet(teamDecisions, gameState, sales, costs, pnl, capacity, inventoryEnding, prevBalanceSheet, effects, config, config.financial.startingSharePrice)

  return {
    revenue: pnl.revenue,
    grossProfit: pnl.grossProfit,
    netProfit: pnl.netProfit,
    closingCash: balanceSheet.cash,
    totalUnitsSold: totalSold,
    inventoryEnding,
    unitCost: calculateUnitCost(teamDecisions, gameState, capacity, config).finalUnitCost,
    utilization: capacity.totalFactoryCapacity > 0 ? production.factoryUnits / capacity.totalFactoryCapacity : 0,
    marketShare: {
      us: marketShare.us * 100,
      asia: marketShare.asia * 100,
      europe: marketShare.europe * 100
    },
    unmetDemand: sales.us.unmetDemand + sales.asia.unmetDemand + sales.europe.unmetDemand,
    productionUnits: production.totalUnits,
    hrCost: costs.hr,
    logisticsCost: costs.logistics,
  }
}

// ============================================================================
// FORMATTERS
// ============================================================================

export function formatCurrency(value: number): string {
  if (Math.abs(value) >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`
  if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(0)}K`
  return `$${value.toFixed(0)}`
}

export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`
}

export function formatUnits(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`
  return value.toFixed(0)
}

export function getStartingMarketShare(teamCount: number): number {
  return teamCount > 0 ? 1 / teamCount : 0
}
