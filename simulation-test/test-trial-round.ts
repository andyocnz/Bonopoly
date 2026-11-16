/**
 * Test script for calculateTrialRound function
 *
 * Tests that the trial round (round 0):
 * 1. Runs the full engine with default decisions
 * 2. Produces balanced balance sheets
 * 3. Generates valid TSR for leaderboard display
 */

import {
  calculateTrialRound,
  getGameConfigForIndustry,
  GAME_CONFIG,
  getBalancedStartingFinancials,
  formatCurrency,
} from '../src/engine/gameEngine'

function runTrialRoundTest() {
  console.log('=' .repeat(70))
  console.log('TRIAL ROUND (ROUND 0) TEST')
  console.log('=' .repeat(70))

  const teamNames = ['Alpha Corp', 'Beta Inc', 'Gamma Ltd', 'Delta Co']

  // Test with default Electronics industry
  console.log('\n--- Testing with Electronics Industry (default) ---\n')
  testTrialRound(teamNames, GAME_CONFIG, 'Electronics')

  // Test with Oil & Energy industry
  console.log('\n--- Testing with Oil & Energy Industry ---\n')
  const oilConfig = getGameConfigForIndustry('Oil & Energy')
  testTrialRound(teamNames, oilConfig, 'Oil & Energy')
}

function testTrialRound(
  teamNames: string[],
  config: typeof GAME_CONFIG,
  industryName: string
) {
  // First, show expected starting values
  const startingFinancials = getBalancedStartingFinancials(config)
  console.log(`Starting Financials for ${industryName}:`)
  console.log(`  Fixed Assets:    ${formatCurrency(startingFinancials.fixedAssets)}`)
  console.log(`  Inventory:       ${formatCurrency(startingFinancials.inventoryValue)} (${config.financial.startingInventoryUnits.toLocaleString()} units @ ${formatCurrency(startingFinancials.unitCost)}/unit)`)
  console.log(`  Cash:            ${formatCurrency(startingFinancials.startingCash)}`)
  console.log(`  Total Assets:    ${formatCurrency(startingFinancials.totalAssets)}`)
  console.log(`  Long-term Debt:  ${formatCurrency(startingFinancials.startingDebt)}`)
  console.log(`  Share Capital:   ${formatCurrency(startingFinancials.startingShareCapital)}`)
  console.log(`  Balance Check:   ${formatCurrency(startingFinancials.startingDebt + startingFinancials.startingShareCapital)} (should = Total Assets)`)
  console.log()

  // Run trial round
  const results = calculateTrialRound(teamNames, config)

  console.log(`Trial Round Results (${teamNames.length} teams):`)
  console.log(`  Market Demand: US=${results.marketDemand.us.toLocaleString()}, Asia=${results.marketDemand.asia.toLocaleString()}, Europe=${results.marketDemand.europe.toLocaleString()}`)
  console.log()

  // Check each team's balance sheet
  let allBalanced = true
  const issues: string[] = []

  results.teams.forEach((team, idx) => {
    const bs = team.balanceSheet
    const diff = bs.totalAssets - (bs.totalLiabilities + bs.totalEquity)
    const balanced = Math.abs(diff) < 1 // Allow $1 rounding error

    if (!balanced) {
      allBalanced = false
      issues.push(`${team.teamName}: Assets=${formatCurrency(bs.totalAssets)}, L+E=${formatCurrency(bs.totalLiabilities + bs.totalEquity)}, Diff=${formatCurrency(diff)}`)
    }

    const avgPrice = team.sales.total.units > 0 ? team.sales.total.revenue / team.sales.total.units : 0
    const grossMargin = team.pnl.revenue > 0 ? (team.pnl.grossProfit / team.pnl.revenue * 100) : 0
    const opex = (team.costs.marketing ?? 0) + (team.costs.hr ?? 0) + (team.costs.rnd ?? 0) + (team.costs.admin ?? 0)

    console.log(`  ${idx + 1}. ${team.teamName}:`)
    console.log(`     Production: ${team.productionUnits.toLocaleString()} units`)
    console.log(`     Sales: ${team.sales.total.units.toLocaleString()} units @ avg ${formatCurrency(avgPrice)}/unit`)
    console.log(`     Revenue: ${formatCurrency(team.pnl.revenue)}`)
    console.log(`     COGS: ${formatCurrency(team.pnl.cogs)}`)
    console.log(`     Gross Profit: ${formatCurrency(team.pnl.grossProfit)} (${grossMargin.toFixed(1)}% margin)`)
    console.log(`     OpEx: ${formatCurrency(opex)}`)
    console.log(`     Net Profit: ${formatCurrency(team.pnl.netProfit)}`)
    console.log(`     TSR: ${team.kpis.tsr.toFixed(2)}%`)
    console.log(`     Share Price: ${formatCurrency(team.kpis.sharePrice)}`)
    console.log(`     Balance Sheet: Assets=${formatCurrency(bs.totalAssets)}, L+E=${formatCurrency(bs.totalLiabilities + bs.totalEquity)} ${balanced ? '✓' : '✗ UNBALANCED'}`)
  })

  console.log()
  if (allBalanced) {
    console.log('✓ All balance sheets are balanced!')
  } else {
    console.log('✗ BALANCE SHEET ISSUES:')
    issues.forEach(issue => console.log(`  - ${issue}`))
  }

  // Show TSR leaderboard
  console.log('\nTSR Leaderboard (for trial round display):')
  const sortedByTSR = [...results.teams].sort((a, b) => b.kpis.tsr - a.kpis.tsr)
  sortedByTSR.forEach((team, idx) => {
    console.log(`  ${idx + 1}. ${team.teamName}: ${team.kpis.tsr.toFixed(2)}%`)
  })

  return allBalanced
}

// Run the test
runTrialRoundTest()
