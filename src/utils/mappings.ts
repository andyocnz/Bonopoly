/**
 * Centralized DB <-> Engine Transformation Utilities
 *
 * This file consolidates all transformation logic between:
 * - Database JSON format (flattened structure)
 * - Engine format (TeamDecisions, TeamGameState)
 * - UI format (legacy decision format)
 *
 * Previously this logic was duplicated in:
 * - src/server/routes/games.ts
 * - src/server/routes/admin.ts
 * - src/pages/EducatorDashboardPage.tsx
 *
 * All consumers should import from this file to ensure consistency.
 */

import type { GameConfig } from '../engine/gameEngine'
import { GAME_CONFIG } from '../engine/gameEngine'

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Engine's internal TeamDecisions format
 * Used by calculateRound() and all game calculations
 */
export interface TeamDecisions {
  production: {
    demandForecast: { us: number; asia: number; europe: number }
    usUnits?: number
    asiaUnits?: number
    outsourceUS?: number
    outsourceAsia?: number
    overtime?: number
    supplierUS?: number
    supplierAsia?: number
    productionLines: {
      us1: { techLevel: number; supplierId: number; units: number }
      us2: { techLevel: number; supplierId: number; units: number }
      asia1: { techLevel: number; supplierId: number; units: number }
      asia2: { techLevel: number; supplierId: number; units: number }
    }
    outsource: { techLevel: number; supplierId: number; units: number }
  }
  hr: {
    us: { employees: number; wage: number; training: number }
    asia: { employees: number; wage: number; training: number }
  }
  rnd: {
    researchStaff?: number
  }
  investment: { newPlantsUS: number; newPlantsAsia: number }
  logistics: {
    allocation?: {
      us: { local: number; fromAsia: number }
      asia: { local: number; fromUS: number }
      europe: { fromUS: number; fromAsia: number }
    }
    usPriority?: string[]
    asiaPriority?: string[]
  }
  marketing: {
    us: { price: number; features: number; promotionPct: number }
    asia: { price: number; features: number; promotionPct: number }
    europe: { price: number; features: number; promotionPct: number }
  }
  finance: {
    transferPricing: { us: number; asia: number; europe: number }
    longTermDebt: number
    shareIssuance: number
    dividends: number
    // Backwards-compatible flat finance fields (optional)
    borrowing?: number
    repayment?: number
    shareIssue?: number
    shareBuyback?: number
    dividend?: number
    newPlantsUS?: number
    newPlantsAsia?: number
  }
}

/**
 * Engine's internal TeamGameState format
 * Tracks accumulated state across rounds
 */
export interface TeamGameState {
  factories: { us: number; asia: number }
  pendingInvestments: Array<{ region: 'us' | 'asia'; roundOrdered: number }>
  rndProgress: {
    unlockedTechLevel: 1 | 2 | 3 | 4
    unlockedFeatureCount: number
    cumulativeResearchHours: number
    pendingTechUpgrade?: { targetLevel: number; roundStarted: number }
  }
  cumulativeProduction: number
  brandReputation: number
  inventory: number
  inventoryUS?: number
  inventoryAsia?: number
  previousRoundResults?: unknown
  taxLossCarryforward?: number
}

/**
 * Database decision format (flattened JSON)
 * Stored in database and sent from UI forms
 */
export interface DbDecision {
  production?: {
    usUnits?: number
    asiaUnits?: number
    outsourceUS?: number
    outsourceAsia?: number
    overtime?: number
    supplierUS?: number
    supplierAsia?: number
  }
  hr?: {
    researchStaff?: number
    trainingLevel?: 'basic' | 'standard' | 'advanced'
  }
  rnd?: {
    researchStaff?: number
    trainingLevel?: 'basic' | 'standard' | 'advanced'
  }
  investment?: {
    newPlantsUS?: number
    newPlantsAsia?: number
  }
  logistics?: {
    allocation?: TeamDecisions['logistics']['allocation']
    usPriority?: ('us' | 'asia' | 'europe')[]
    asiaPriority?: ('us' | 'asia' | 'europe')[]
  }
  marketing?: {
    priceUS?: number
    priceAsia?: number
    priceEurope?: number
    promoUS?: number
    promoAsia?: number
    promoEurope?: number
  }
  finance?: {
    borrowing?: number
    repayment?: number
    shareIssue?: number
    shareBuyback?: number
    dividend?: number
    newPlantsUS?: number
    newPlantsAsia?: number
  }
}

/**
 * Database game state format (flattened JSON)
 */
export interface DbGameState {
  factoriesUS?: number
  factoriesAsia?: number
  pendingInvestments?: Array<{ region: 'us' | 'asia'; roundOrdered: number }>
  unlockedTechLevel?: number
  unlockedFeatures?: number
  cumulativeResearchHours?: number
  brandReputation?: number
  inventory?: number
  inventoryUS?: number
  inventoryAsia?: number
  taxLossCarryforward?: number
}

// ============================================================================
// TRANSFORMATION: DB -> ENGINE
// ============================================================================

/**
 * Transform database decision format to engine format
 *
 * Handles the conversion from flattened DB JSON to the complex nested
 * structure the game engine expects. Applies defaults from config where
 * values are missing.
 */
export function transformDecisionFromDb(
  decision: DbDecision | null | undefined,
  gameConfig: GameConfig = GAME_CONFIG,
  enableLogging: boolean = false
): TeamDecisions {
  if (!decision) {
    return getDefaultDecisions(gameConfig)
  }

  const prod = decision.production || {}
  const hr = decision.hr || {}
  const rnd = decision.rnd || {}
  const inv = decision.investment || {}
  const log = decision.logistics || {}
  const mkt = decision.marketing || {}
  const fin = decision.finance || {}
  const defaults = gameConfig.defaults
  const defaultPrices = gameConfig.priceDemand.baselinePriceByRegion
  const capacityPerPlant = gameConfig.capacityPerPlant

  // Training calculation
  const trainingLevel = (rnd.trainingLevel || hr.trainingLevel || defaults.rnd.trainingLevel) as 'basic' | 'standard' | 'advanced'
  const trainingCost = gameConfig.hr.trainingCostPerStaff[trainingLevel]
  const usTraining = trainingCost * gameConfig.hr.trainingCostMultiplierByRegion.us
  const asiaTraining = trainingCost * gameConfig.hr.trainingCostMultiplierByRegion.asia
  const usEmployees = rnd.researchStaff || hr.researchStaff || defaults.hr.us.employees

  if (enableLogging) {
    console.log('🏭 [transformDecisionFromDb] Production data:', {
      usUnits: prod.usUnits,
      asiaUnits: prod.asiaUnits,
      outsourceUS: prod.outsourceUS,
      outsourceAsia: prod.outsourceAsia,
      totalOutsource: (prod.outsourceUS || 0) + (prod.outsourceAsia || 0)
    })
  }

  return {
    production: {
      demandForecast: { us: 0, asia: 0, europe: 0 },
      usUnits: typeof prod.usUnits === 'number' ? prod.usUnits : undefined,
      asiaUnits: typeof prod.asiaUnits === 'number' ? prod.asiaUnits : undefined,
      outsourceUS: typeof prod.outsourceUS === 'number' ? prod.outsourceUS : undefined,
      outsourceAsia: typeof prod.outsourceAsia === 'number' ? prod.outsourceAsia : undefined,
      overtime: typeof prod.overtime === 'number' ? prod.overtime : undefined,
      supplierUS: typeof prod.supplierUS === 'number' ? prod.supplierUS : undefined,
      supplierAsia: typeof prod.supplierAsia === 'number' ? prod.supplierAsia : undefined,
      productionLines: {
        us1: {
          techLevel: 1,
          supplierId: prod.supplierUS ?? defaults.production.supplierUS,
          units: typeof prod.usUnits === 'number' ? (prod.usUnits / (capacityPerPlant / 100)) : defaults.production.allocationPct,
        },
        us2: {
          techLevel: 1,
          supplierId: prod.supplierUS ?? defaults.production.supplierUS,
          units: typeof prod.usUnits === 'number' ? (prod.usUnits / (capacityPerPlant / 100)) : defaults.production.allocationPct,
        },
        asia1: {
          techLevel: 1,
          supplierId: prod.supplierAsia ?? defaults.production.supplierAsia,
          units: typeof prod.asiaUnits === 'number' ? (prod.asiaUnits / (capacityPerPlant / 100)) : 0,
        },
        asia2: { techLevel: 1, supplierId: prod.supplierAsia ?? defaults.production.supplierAsia, units: 0 },
      },
      outsource: {
        techLevel: 1,
        supplierId: defaults.production.outsourceSupplier,
        units: (prod.outsourceUS || 0) + (prod.outsourceAsia || 0)
      },
    },
    hr: {
      us: {
        employees: usEmployees,
        wage: defaults.hr.us.wage,
        training: usTraining * usEmployees,
      },
      asia: {
        employees: defaults.hr.asia.employees,
        wage: defaults.hr.asia.wage,
        training: asiaTraining,
      },
    },
    rnd: {
      researchStaff: rnd.researchStaff || hr.researchStaff,
    },
    investment: {
      newPlantsUS: inv.newPlantsUS || fin.newPlantsUS || 0,
      newPlantsAsia: inv.newPlantsAsia || fin.newPlantsAsia || 0,
    },
    logistics: {
      allocation: log.allocation || defaults.logistics.allocation,
      usPriority: Array.isArray(log.usPriority) ? log.usPriority : defaults.logistics.usPriority,
      asiaPriority: Array.isArray(log.asiaPriority) ? log.asiaPriority : defaults.logistics.asiaPriority,
    },
    marketing: {
      us: {
        price: typeof mkt.priceUS === 'number' ? mkt.priceUS : defaultPrices.us,
        features: defaults.marketing.featuresUsed,
        promotionPct: mkt.promoUS ?? defaults.marketing.promotionPctByRegion.us
      },
      asia: {
        price: typeof mkt.priceAsia === 'number' ? mkt.priceAsia : defaultPrices.asia,
        features: defaults.marketing.featuresUsed,
        promotionPct: mkt.promoAsia ?? defaults.marketing.promotionPctByRegion.asia
      },
      europe: {
        price: typeof mkt.priceEurope === 'number' ? mkt.priceEurope : defaultPrices.europe,
        features: defaults.marketing.featuresUsed,
        promotionPct: mkt.promoEurope ?? defaults.marketing.promotionPctByRegion.europe
      },
    },
    finance: {
      transferPricing: { ...defaults.finance.transferPricing },
      longTermDebt: (fin.borrowing || 0) - (fin.repayment || 0),
      shareIssuance: (fin.shareIssue || 0) - (fin.shareBuyback || 0),
      dividends: fin.dividend || 0,
      // Preserve flat fields so UI that expects borrowing/repayment/shareIssue works
      borrowing: fin.borrowing ?? 0,
      repayment: fin.repayment ?? 0,
      shareIssue: fin.shareIssue ?? 0,
      shareBuyback: fin.shareBuyback ?? 0,
      dividend: fin.dividend ?? 0,
      // Expose new plant investments on finance so UI loads persisted values
      newPlantsUS: fin.newPlantsUS ?? inv.newPlantsUS ?? 0,
      newPlantsAsia: fin.newPlantsAsia ?? inv.newPlantsAsia ?? 0,
    },
  }
}

/**
 * Transform database game state to engine format
 */
export function transformGameStateFromDb(
  state: DbGameState | null | undefined,
  gameConfig: GameConfig = GAME_CONFIG
): TeamGameState {
  if (!state) {
    return getDefaultGameState(gameConfig)
  }

  const defaults = gameConfig.defaults
  const inventoryRegional = (state.inventoryUS ?? 0) + (state.inventoryAsia ?? 0)
  return {
    factories: {
      us: state.factoriesUS ?? gameConfig.initialFactories.us,
      asia: state.factoriesAsia ?? gameConfig.initialFactories.asia,
    },
    pendingInvestments: state.pendingInvestments || [],
    rndProgress: {
      unlockedTechLevel: (state.unlockedTechLevel ?? defaults.initialTechLevel) as 1 | 2 | 3 | 4,
      unlockedFeatureCount: state.unlockedFeatures ?? defaults.initialFeatures,
      cumulativeResearchHours: state.cumulativeResearchHours ?? defaults.initialResearchHours,
    },
    cumulativeProduction: 0,
    brandReputation: state.brandReputation ?? defaults.brandReputation,
    inventory: inventoryRegional > 0 ? inventoryRegional : (state.inventory ?? gameConfig.financial.startingInventoryUnits),
    inventoryUS: state.inventoryUS ?? state.inventory ?? gameConfig.financial.startingInventoryUnits,
    inventoryAsia: state.inventoryAsia ?? 0,
    taxLossCarryforward: state.taxLossCarryforward ?? 0,
  }
}

/**
 * Transform engine results to game state for next round
 * Used to carry over state between rounds
 */
export function transformResultsToGameState(
  fullResults: unknown,
  gameConfig: GameConfig = GAME_CONFIG
): TeamGameState {
  const defaults = gameConfig.defaults
  const fullResultsObj = (fullResults && typeof fullResults === 'object'
    ? fullResults
    : {}) as { gameState?: TeamGameState }
  const state = fullResultsObj.gameState ?? {}
  const rnd = state.rndProgress ?? {}
  const inventoryRegional = (state.inventoryUS ?? 0) + (state.inventoryAsia ?? 0)
  return {
    factories: {
      us: state.factories?.us ?? gameConfig.initialFactories.us,
      asia: state.factories?.asia ?? gameConfig.initialFactories.asia,
    },
    pendingInvestments: state.pendingInvestments ?? [],
    rndProgress: {
      unlockedTechLevel: (rnd.unlockedTechLevel ?? defaults.initialTechLevel) as 1 | 2 | 3 | 4,
      unlockedFeatureCount: rnd.unlockedFeatureCount ?? defaults.initialFeatures,
      cumulativeResearchHours: rnd.cumulativeResearchHours ?? defaults.initialResearchHours,
    },
    cumulativeProduction: state.cumulativeProduction ?? 0,
    brandReputation: state.brandReputation ?? defaults.brandReputation,
    inventory: inventoryRegional > 0 ? inventoryRegional : (state.inventory ?? 0),
    inventoryUS: state.inventoryUS ?? state.inventory ?? 0,
    inventoryAsia: state.inventoryAsia ?? 0,
    taxLossCarryforward: state.taxLossCarryforward ?? 0,
    previousRoundResults: fullResults,
  }
}

// Alias for backwards compatibility
export const transformGameStateFromResults = transformResultsToGameState

// ============================================================================
// DEFAULT OBJECT CREATION
// ============================================================================

/**
 * Get default decisions for a new team
 * Central source of truth for initial decision state
 */
export function getDefaultDecisions(gameConfig: GameConfig = GAME_CONFIG): TeamDecisions {
  const defaults = gameConfig.defaults
  const defaultPrices = gameConfig.priceDemand.baselinePriceByRegion
  return {
    production: {
      demandForecast: { us: 0, asia: 0, europe: 0 },
      productionLines: {
        us1: { techLevel: 1, supplierId: defaults.production.supplierUS, units: defaults.production.allocationPct },
        us2: { techLevel: 1, supplierId: defaults.production.supplierUS, units: defaults.production.allocationPct },
        asia1: { techLevel: 1, supplierId: defaults.production.supplierAsia, units: 0 },
        asia2: { techLevel: 1, supplierId: defaults.production.supplierAsia, units: 0 },
      },
      outsource: {
        techLevel: 1,
        supplierId: defaults.production.outsourceSupplier,
        units: 0
      },
    },
    hr: {
      us: { ...defaults.hr.us },
      asia: { ...defaults.hr.asia },
    },
    rnd: {},
    investment: { newPlantsUS: 0, newPlantsAsia: 0 },
    logistics: {
      allocation: defaults.logistics.allocation,
      usPriority: defaults.logistics.usPriority,
      asiaPriority: defaults.logistics.asiaPriority,
    },
    marketing: {
      us: { price: defaultPrices.us, features: defaults.marketing.featuresUsed, promotionPct: defaults.marketing.promotionPctByRegion.us },
      asia: { price: defaultPrices.asia, features: defaults.marketing.featuresUsed, promotionPct: defaults.marketing.promotionPctByRegion.asia },
      europe: { price: defaultPrices.europe, features: defaults.marketing.featuresUsed, promotionPct: defaults.marketing.promotionPctByRegion.europe },
    },
    finance: {
      transferPricing: { ...defaults.finance.transferPricing },
      longTermDebt: 0,
      shareIssuance: 0,
      dividends: 0,
    },
  }
}

/**
 * Get default game state for a new team
 * Central source of truth for initial game state
 */
export function getDefaultGameState(gameConfig: GameConfig = GAME_CONFIG): TeamGameState {
  const defaults = gameConfig.defaults
  return {
    factories: {
      us: gameConfig.initialFactories.us,
      asia: gameConfig.initialFactories.asia,
    },
    pendingInvestments: [],
    rndProgress: {
      unlockedTechLevel: defaults.initialTechLevel as 1 | 2 | 3 | 4,
      unlockedFeatureCount: defaults.initialFeatures,
      cumulativeResearchHours: defaults.initialResearchHours,
    },
    cumulativeProduction: 0,
    brandReputation: defaults.brandReputation,
    inventory: gameConfig.financial.startingInventoryUnits,
    inventoryUS: gameConfig.financial.startingInventoryUnits,
    inventoryAsia: 0,
    taxLossCarryforward: 0,
  }
}

/**
 * Get default decision in database format
 * Used when saving initial decisions to database
 */
export function getDefaultDecisionForDb(gameConfig: GameConfig = GAME_CONFIG) {
  const defaults = gameConfig.defaults
  const defaultPrices = gameConfig.priceDemand.baselinePriceByRegion
  const allocationPct = defaults.production.allocationPct / 100
  const usUnits = Math.round(gameConfig.initialFactories.us * gameConfig.capacityPerPlant * allocationPct)
  const asiaUnits = Math.round(gameConfig.initialFactories.asia * gameConfig.capacityPerPlant * allocationPct)

  return {
    production: {
      usUnits,
      asiaUnits,
      supplierUS: defaults.production.supplierUS,
      supplierAsia: defaults.production.supplierAsia,
      overtime: defaults.production.overtimePct,
      outsourceUS: 0,
      outsourceAsia: 0,
    },
    hr: {
      researchStaff: defaults.hr.us.employees,
      trainingLevel: defaults.rnd.trainingLevel,
    },
    rnd: {
      researchStaff: defaults.hr.us.employees,
      trainingLevel: defaults.rnd.trainingLevel,
    },
    investment: {
      newPlantsUS: 0,
      newPlantsAsia: 0,
    },
    logistics: {
      allocation: defaults.logistics.allocation,
    },
    marketing: {
      priceUS: defaultPrices.us,
      priceAsia: defaultPrices.asia,
      priceEurope: defaultPrices.europe,
      promoUS: defaults.marketing.promotionPctByRegion.us,
      promoAsia: defaults.marketing.promotionPctByRegion.asia,
      promoEurope: defaults.marketing.promotionPctByRegion.europe,
    },
    finance: {
      borrowing: 0,
      repayment: 0,
      shareIssue: 0,
      shareBuyback: 0,
      dividend: 0,
      newPlantsUS: 0,
      newPlantsAsia: 0,
    },
  }
}

// ============================================================================
// RANKING & SCORING
// ============================================================================

/**
 * Calculate team rank based on Share Price
 * Used to determine 1st, 2nd, 3rd place etc.
 */
export function calculateRank(teams: Array<{ kpis: { tsr: number; sharePrice: number } }>, teamIndex: number): number {
  const sorted = teams
    .map((t, i) => ({ sharePrice: t.kpis.sharePrice, idx: i }))
    .sort((a, b) => b.sharePrice - a.sharePrice)

  return sorted.findIndex(s => s.idx === teamIndex) + 1
}

/**
 * Sort teams by TSR descending and return with ranks
 */
export function rankTeamsByTSR<T extends { kpis: { tsr: number } }>(teams: T[]): Array<T & { rank: number }> {
  return teams
    .map((team, idx) => ({ ...team, originalIndex: idx }))
    .sort((a, b) => b.kpis.tsr - a.kpis.tsr)
    .map((team, rank) => ({ ...team, rank: rank + 1 }))
}

/**
 * Sort teams by share price descending and return with ranks
 */
export function rankTeamsBySharePrice<T extends { kpis: { sharePrice: number } }>(teams: T[]): Array<T & { rank: number }> {
  return teams
    .map((team, idx) => ({ ...team, originalIndex: idx }))
    .sort((a, b) => b.kpis.sharePrice - a.kpis.sharePrice)
    .map((team, rank) => ({ ...team, rank: rank + 1 }))
}

// ============================================================================
// FORMATTING UTILITIES
// ============================================================================

/**
 * Format currency value for display
 * @param value - The numeric value to format
 * @param precision - Number of decimal places for M/B suffixes (default: 2 for B, 1 for M)
 */
export function formatCurrency(value: number): string {
  if (Math.abs(value) >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
  if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(0)}K`
  return `$${value.toFixed(0)}`
}

/**
 * Format currency with full precision (no abbreviation)
 */
export function formatCurrencyFull(value: number): string {
  return `$${value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

/**
 * Format percentage value for display
 * @param value - The decimal value (0.25 = 25%)
 * @param decimals - Number of decimal places (default: 1)
 */
export function formatPercent(value: number, decimals: number = 1): string {
  return `${(value * 100).toFixed(decimals)}%`
}

/**
 * Format percentage value that's already in percentage form
 * @param value - The percentage value (25 = 25%)
 */
export function formatPercentRaw(value: number, decimals: number = 1): string {
  return `${value.toFixed(decimals)}%`
}

/**
 * Format unit count for display
 */
export function formatUnits(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`
  return value.toFixed(0)
}

// ============================================================================
// AI DECISION GENERATION
// ============================================================================

/**
 * Generate AI decision based on scenario
 * Used for AI-controlled teams
 */
export function generateAIDecision(
  scenarioId: number,
  _prevState: unknown,
  gameConfig: GameConfig = GAME_CONFIG
): TeamDecisions {
  const decisions = getDefaultDecisions(gameConfig)
  const baseline = gameConfig.priceDemand.baselinePriceByRegion

  // Adjust based on scenario
  switch (scenarioId) {
    case 1: // Asia Boom
      decisions.marketing.asia.price = Math.round(baseline.asia * 0.95)
      decisions.marketing.asia.promotionPct = Math.round(decisions.marketing.asia.promotionPct * 1.6)
      decisions.investment.newPlantsAsia = 1
      break
    case 2: // Green Wave
      decisions.marketing.europe.price = Math.round(baseline.europe * 1.05)
      decisions.marketing.europe.promotionPct = Math.round(decisions.marketing.europe.promotionPct * 2)
      // Use eco-friendly suppliers
      decisions.production.productionLines.us1.supplierId = gameConfig.defaults.production.outsourceSupplier
      decisions.production.productionLines.us2.supplierId = gameConfig.defaults.production.outsourceSupplier
      break
    case 3: // Price War
      decisions.marketing.us.price = Math.round(baseline.us * 0.9)
      decisions.marketing.asia.price = Math.round(baseline.asia * 0.9)
      decisions.marketing.europe.price = Math.round(baseline.europe * 0.9)
      break
    default: // Stable
      break
  }

  return decisions
}

/**
 * Generate AI decision in database format
 * Used for AI-controlled teams when persisting decisions to DB
 */
export function generateAIDecisionForDb(scenarioId: number, gameConfig: GameConfig = GAME_CONFIG) {
  const base = getDefaultDecisionForDb(gameConfig)
  const baseline = gameConfig.priceDemand.baselinePriceByRegion

  switch (scenarioId) {
    case 1: // Asia Boom
      base.marketing.priceAsia = Math.round(baseline.asia * 0.95)
      base.marketing.promoAsia = Math.round(base.marketing.promoAsia * 1.6)
      base.finance.newPlantsAsia = 1
      base.production.asiaUnits = Math.round(gameConfig.capacityPerPlant * 0.3)
      break
    case 2: // Green Wave
      base.marketing.priceEurope = Math.round(baseline.europe * 1.05)
      base.marketing.promoEurope = Math.round(base.marketing.promoEurope * 2)
      base.production.supplierUS = gameConfig.defaults.production.outsourceSupplier
      base.production.supplierAsia = gameConfig.defaults.production.outsourceSupplier
      break
    case 3: // Price War
      base.marketing.priceUS = Math.round(baseline.us * 0.9)
      base.marketing.priceAsia = Math.round(baseline.asia * 0.9)
      base.marketing.priceEurope = Math.round(baseline.europe * 0.9)
      break
    default: // Stable / Trial
      break
  }

  return base
}
