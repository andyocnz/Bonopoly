import { SCENARIOS, GAME_CONFIG, getBalancedStartingFinancials, type GameConfig } from '../engine/gameEngine'

// Generate a random game code like "BONO-A3X9"
export function generateGameCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // Removed confusing chars (0, O, 1, I)
  let code = ''
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return `BONO-${code}`
}

// Generate a team code like "ALPHA-7K2M"
export function generateTeamCode(teamName: string): string {
  const prefix = teamName.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 5) || 'TEAM'
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let suffix = ''
  for (let i = 0; i < 4; i++) {
    suffix += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return `${prefix}-${suffix}`
}

// Generate a 4-digit PIN (for games and teams)
export function generatePin(): string {
  return Math.floor(1000 + Math.random() * 9000).toString()
}

// Team colors palette
export const TEAM_COLORS = [
  '#1e3a5f', // Dark blue
  '#2e7d32', // Green
  '#c62828', // Red
  '#6a1b9a', // Purple
  '#ef6c00', // Orange
  '#00838f', // Teal
  '#ad1457', // Pink
  '#4527a0', // Deep purple
]

// Generate random scenario sequence for game rounds
export function generateScenarioSequence(totalRounds: number): number[] {
  const allScenarios = Object.keys(SCENARIOS).map((id) => Number(id)).sort((a, b) => a - b)

  // Shuffle all scenarios
  for (let i = allScenarios.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[allScenarios[i], allScenarios[j]] = [allScenarios[j], allScenarios[i]]
  }

  // Build sequence for trial + all rounds (totalRounds + 1 total)
  const sequence: number[] = []
  for (let i = 0; i <= totalRounds; i++) {
    sequence.push(allScenarios[i % allScenarios.length])
  }

  return sequence
}

// Default starting game state
// IMPORTANT: Uses getBalancedStartingFinancials to ensure balance sheet is balanced
// for the specific industry (different plant costs = different asset values)
export function getDefaultGameState(config: GameConfig = GAME_CONFIG) {
  const startingFinancials = getBalancedStartingFinancials(config)

  return {
    factoriesUS: config.initialFactories.us,
    factoriesAsia: config.initialFactories.asia,
    pendingInvestments: [],
    unlockedTechLevel: config.defaults.initialTechLevel,
    unlockedFeatures: config.defaults.initialFeatures,
    cumulativeResearchHours: config.defaults.initialResearchHours,
    brandReputation: config.defaults.brandReputation,
    inventory: config.financial.startingInventoryUnits,
    inventoryUS: config.financial.startingInventoryUnits,
    inventoryAsia: 0,
    cashBalance: startingFinancials.startingCash,
    // Use calculated values to ensure Assets = Liabilities + Equity
    longTermDebt: startingFinancials.startingDebt,
    shareCapital: startingFinancials.startingShareCapital,
    retainedEarnings: 0,
  }
}
