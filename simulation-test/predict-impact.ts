import { GAME_CONFIG, createInitialGameState, getDefaultDecisions, predictTurnOutcome } from '../src/engine/gameEngine'

const round = 1
const gameState = createInitialGameState(GAME_CONFIG)

const defaultDecisions = getDefaultDecisions(GAME_CONFIG)
const emptyDecisions = {} as typeof defaultDecisions

const run = (label: string, decisions: typeof defaultDecisions) => {
  const result = predictTurnOutcome(decisions, gameState, round, undefined, GAME_CONFIG)
  console.log(label, {
    revenue: result.revenue,
    netProfit: result.netProfit,
    unitsSold: result.totalUnitsSold,
    inventoryEnding: result.inventoryEnding,
  })
}

run('default decisions', defaultDecisions)
run('empty decisions', emptyDecisions)
