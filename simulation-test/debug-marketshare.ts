/**
 * Debug market share calculation with 5 teams
 */

import {
  calculateRound,
  createInitialGameState,
  getGameConfigForIndustry,
  type TeamGameState,
  type TeamDecisions,
  type GameConfig,
} from '../src/engine/gameEngine'

function createBaseDecisions(config: GameConfig): TeamDecisions {
  const basePrice = config.priceDemand.baselinePriceByRegion
  return {
    production: {
      usUnits: config.initialFactories.us * config.capacityPerPlant * 0.8,
      asiaUnits: 0,
      outsourceUS: 0,
      outsourceAsia: 0,
      overtime: 0,
      supplierUS: 2,
      supplierAsia: 2,
      productionLines: {
        us1: { techLevel: 1, supplierId: 2, units: 50 },
        us2: { techLevel: 1, supplierId: 2, units: 50 },
      },
      outsource: { techLevel: 1, supplierId: 2, units: 0 },
      demandForecast: { us: 100000, asia: 100000, europe: 100000 },
      techShareForecast: { us: {}, asia: {}, europe: {} } as TeamDecisions['production']['techShareForecast']
    },
    marketing: {
      us: { price: basePrice.us, features: 0, promotionPct: 5 },
      asia: { price: basePrice.asia, features: 0, promotionPct: 5 },
      europe: { price: basePrice.europe, features: 0, promotionPct: 5 }
    },
    hr: {
      us: { employees: 50, wage: 5000, training: 0 },
      asia: { employees: 0, wage: 2000, training: 0 }
    },
    rnd: {
      featureInvestment: 0,
      researchStaff: 0
    },
    investment: { newPlantsUS: 0, newPlantsAsia: 0 },
    logistics: {
      usPriority: ['us', 'europe', 'asia'],
      asiaPriority: ['asia', 'europe', 'us']
    },
    finance: {
      longTermDebt: 0,
      shareIssuance: 0,
      dividends: 0,
      transferPricing: { us: 1, asia: 1, europe: 1 }
    }
  }
}

const config = getGameConfigForIndustry('Electronics')

// Create 5 teams
const teams = [
  { id: 1, name: 'Team 1', decisions: createBaseDecisions(config) },
  { id: 2, name: 'Team 2', decisions: createBaseDecisions(config) },
  { id: 3, name: 'Team 3', decisions: createBaseDecisions(config) },
  { id: 4, name: 'Team 4', decisions: createBaseDecisions(config) },
  { id: 5, name: 'Team 5', decisions: createBaseDecisions(config) },
]

const initialStates = new Map<number, TeamGameState>()
teams.forEach(t => initialStates.set(t.id, createInitialGameState(config)))

const results = calculateRound(teams, 1, initialStates, [0], 5, config)

console.log('=== MARKET DEMAND ===')
console.log('US:', results.marketDemand.us.toLocaleString())
console.log('Asia:', results.marketDemand.asia.toLocaleString())
console.log('Europe:', results.marketDemand.europe.toLocaleString())
console.log('Total:', results.marketDemand.total.toLocaleString())

console.log('\n=== MARKET SHARE BY TEAM ===')
let totalUS = 0, totalAsia = 0, totalEurope = 0
results.teams.forEach(t => {
  console.log(`${t.teamName}:`)
  console.log(`  US: ${(t.marketShare.us * 100).toFixed(2)}%`)
  console.log(`  Asia: ${(t.marketShare.asia * 100).toFixed(2)}%`)
  console.log(`  Europe: ${(t.marketShare.europe * 100).toFixed(2)}%`)
  totalUS += t.marketShare.us
  totalAsia += t.marketShare.asia
  totalEurope += t.marketShare.europe
})

console.log('\n=== TOTALS ===')
console.log('US total:', (totalUS * 100).toFixed(2) + '%')
console.log('Asia total:', (totalAsia * 100).toFixed(2) + '%')
console.log('Europe total:', (totalEurope * 100).toFixed(2) + '%')
