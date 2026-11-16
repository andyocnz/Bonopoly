/**
 * Test BUG-005 and BUG-006:
 * - BUG-005: Can market share exceed 100%?
 * - BUG-006: Can total sales exceed demand?
 */

import {
  calculateRound,
  createInitialGameState,
  getGameConfigForIndustry,
  type TeamGameState,
  type TeamDecisions,
  type GameConfig,
} from '../src/engine/gameEngine'

function createHighCapacityDecisions(config: GameConfig, productionMultiplier: number): TeamDecisions {
  const basePrice = config.priceDemand.baselinePriceByRegion
  const baseProduction = config.initialFactories.us * config.capacityPerPlant

  return {
    production: {
      usUnits: baseProduction * productionMultiplier,
      asiaUnits: baseProduction * productionMultiplier * 0.8,
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
      asia: { employees: 50, wage: 2000, training: 0 }
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

console.log('=== TESTING BUG-005 & BUG-006 ===')
console.log('Running 5 scenarios with varying production capacity...\n')

const scenarios = [
  { name: 'Normal Capacity', multiplier: 1.0 },
  { name: 'High Capacity (2x)', multiplier: 2.0 },
  { name: 'Very High Capacity (5x)', multiplier: 5.0 },
  { name: 'Extreme Capacity (10x)', multiplier: 10.0 },
  { name: 'Massive Capacity (20x)', multiplier: 20.0 },
]

for (const scenario of scenarios) {
  console.log(`\n${'='.repeat(60)}`)
  console.log(`Scenario: ${scenario.name}`)
  console.log('='.repeat(60))

  // Create 5 teams all producing at the same capacity level
  const teams = []
  const initialStates = new Map<number, TeamGameState>()

  for (let i = 1; i <= 5; i++) {
    teams.push({
      id: i,
      name: `Team ${i}`,
      decisions: createHighCapacityDecisions(config, scenario.multiplier)
    })
    initialStates.set(i, createInitialGameState(config))
  }

  // Run one round
  const results = calculateRound(teams, 1, initialStates, [0], 1, config)

  // Calculate total market share and total sales
  let totalMarketShareUS = 0
  let totalMarketShareAsia = 0
  let totalMarketShareEurope = 0
  let totalSalesUS = 0
  let totalSalesAsia = 0
  let totalSalesEurope = 0
  let totalSales = 0

  results.teams.forEach((team) => {
    totalMarketShareUS += team.marketShare?.us ?? 0
    totalMarketShareAsia += team.marketShare?.asia ?? 0
    totalMarketShareEurope += team.marketShare?.europe ?? 0
    totalSalesUS += team.sales?.us?.units ?? 0
    totalSalesAsia += team.sales?.asia?.units ?? 0
    totalSalesEurope += team.sales?.europe?.units ?? 0
    totalSales += team.sales?.total?.units ?? 0
  })

  // Get demand from market demand object
  const demandUS = results.marketDemand?.us ?? 0
  const demandAsia = results.marketDemand?.asia ?? 0
  const demandEurope = results.marketDemand?.europe ?? 0
  const totalDemand = demandUS + demandAsia + demandEurope

  // Debug: show what's in the results object
  if (scenario.name === 'Normal Capacity') {
    console.log('\nDEBUG - Results structure:')
    console.log('  results.marketDemand:', results.marketDemand)
    console.log('  first team sales:', results.teams[0].sales)
  }

  // Calculate total production
  let totalProduction = 0
  results.teams.forEach((team) => {
    const usProduction = team.production?.usFactoryUnits ?? 0
    const asiaProduction = team.production?.asiaFactoryUnits ?? 0
    totalProduction += usProduction + asiaProduction
  })

  console.log('\nProduction:')
  console.log(`  Total Production: ${totalProduction.toLocaleString()} units`)
  console.log(`  Total Demand:     ${totalDemand.toLocaleString()} units`)
  console.log(`  Production/Demand Ratio: ${(totalProduction / totalDemand).toFixed(2)}x`)

  console.log('\nMarket Share by Region:')
  console.log(`  US:     ${(totalMarketShareUS * 100).toFixed(2)}% ${totalMarketShareUS > 1.01 ? '⚠️ EXCEEDS 100%' : '✓'}`)
  console.log(`  Asia:   ${(totalMarketShareAsia * 100).toFixed(2)}% ${totalMarketShareAsia > 1.01 ? '⚠️ EXCEEDS 100%' : '✓'}`)
  console.log(`  Europe: ${(totalMarketShareEurope * 100).toFixed(2)}% ${totalMarketShareEurope > 1.01 ? '⚠️ EXCEEDS 100%' : '✓'}`)

  console.log('\nSales vs Demand:')
  console.log(`  US:     ${totalSalesUS.toLocaleString()} / ${demandUS.toLocaleString()} (${(totalSalesUS / demandUS * 100).toFixed(1)}%) ${totalSalesUS > demandUS * 1.01 ? '⚠️ EXCEEDS DEMAND' : '✓'}`)
  console.log(`  Asia:   ${totalSalesAsia.toLocaleString()} / ${demandAsia.toLocaleString()} (${(totalSalesAsia / demandAsia * 100).toFixed(1)}%) ${totalSalesAsia > demandAsia * 1.01 ? '⚠️ EXCEEDS DEMAND' : '✓'}`)
  console.log(`  Europe: ${totalSalesEurope.toLocaleString()} / ${demandEurope.toLocaleString()} (${(totalSalesEurope / demandEurope * 100).toFixed(1)}%) ${totalSalesEurope > demandEurope * 1.01 ? '⚠️ EXCEEDS DEMAND' : '✓'}`)
  console.log(`  TOTAL:  ${totalSales.toLocaleString()} / ${totalDemand.toLocaleString()} (${(totalSales / totalDemand * 100).toFixed(1)}%) ${totalSales > totalDemand * 1.01 ? '⚠️ EXCEEDS DEMAND' : '✓'}`)

  // Show individual team details
  console.log('\nIndividual Team Market Shares:')
  results.teams.forEach((team) => {
    const msUS = ((team.marketShare?.us ?? 0) * 100).toFixed(1)
    const msAsia = ((team.marketShare?.asia ?? 0) * 100).toFixed(1)
    const msEurope = ((team.marketShare?.europe ?? 0) * 100).toFixed(1)
    console.log(`  ${team.teamName}: US=${msUS}%, Asia=${msAsia}%, Europe=${msEurope}%`)
  })
}

console.log('\n' + '='.repeat(60))
console.log('SUMMARY')
console.log('='.repeat(60))
console.log('\nBUG-005: Market share can exceed 100%?')
console.log('  → Check above for any ⚠️ EXCEEDS 100% warnings')
console.log('\nBUG-006: Sales can exceed demand?')
console.log('  → Check above for any ⚠️ EXCEEDS DEMAND warnings')
