/**
 * Strategy Simulation Test
 *
 * Tests the AI Strategy Simulation Lab with different game theory strategies
 */

import { runStrategySimulation, type StrategySimulationConfig } from '../src/engine/strategySimulation'
import { getAllStrategies } from '../src/engine/strategyEngine'

console.log('='.repeat(80))
console.log('STRATEGY SIMULATION LAB - TEST')
console.log('='.repeat(80))
console.log()

// Show available strategies
console.log('Available Strategies:')
console.log('-'.repeat(80))
getAllStrategies().forEach(strategy => {
  console.log(`  ${strategy.id.padEnd(20)} - ${strategy.name}`)
  console.log(`    ${strategy.description}`)
  console.log()
})

console.log()
console.log('='.repeat(80))
console.log('EXPERIMENT 1: Price Competition')
console.log('='.repeat(80))
console.log('Testing: Tit-for-Tat vs Predatory vs Premium vs Capacity Leader')
console.log()

const experiment1Config: StrategySimulationConfig = {
  teamCount: 4,
  strategies: [
    'tit-for-tat',
    'predatory-pricing',
    'premium',
    'capacity-leader'
  ],
  teamNames: [
    'Team Cooperative',
    'Team Aggressive',
    'Team Premium',
    'Team Volume'
  ],
  rounds: 20,
  scenarioId: 1, // Asia Boom scenario
  verbose: false
}

async function runExperiment() {
  try {
    const results = await runStrategySimulation(experiment1Config)

    console.log()
    console.log('='.repeat(80))
    console.log('FINAL STANDINGS')
    console.log('='.repeat(80))
    console.log()

    results.finalStandings.forEach(standing => {
      console.log(`${standing.rank}. ${standing.teamName}`)
      console.log(`   Strategy: ${standing.strategyName}`)
      console.log(`   Final Share Price: $${standing.finalSharePrice.toFixed(2)}`)
      console.log(`   Avg Share Price: $${standing.avgSharePrice.toFixed(2)}`)
      console.log(`   Growth: ${standing.sharePriceGrowth.toFixed(1)}%`)
      console.log(`   Avg Market Share: ${standing.avgMarketShare.toFixed(1)}%`)
      console.log(`   Volatility: ${standing.volatility.toFixed(2)}`)
      console.log()
    })

    console.log('='.repeat(80))
    console.log('INSIGHTS')
    console.log('='.repeat(80))
    console.log()

    results.insights.summary.forEach(insight => {
      console.log(`• ${insight}`)
    })

    console.log()
    console.log('='.repeat(80))
    console.log('KEY FINDINGS')
    console.log('='.repeat(80))
    console.log()
    console.log(`Winner: ${results.insights.winner.teamName} (${results.insights.winner.strategy})`)
    console.log(`Most Stable: ${results.insights.mostStable.teamName} (${results.insights.mostStable.strategy})`)
    console.log(`Highest Market Share: ${results.insights.highestMarketShare.teamName} (${results.insights.highestMarketShare.strategy})`)
    console.log()

    console.log('='.repeat(80))
    console.log('SIMULATION COMPLETE')
    console.log('='.repeat(80))

  } catch (error) {
    console.error('Simulation error:', error)
  }
}

// Run the experiment
runExperiment()
