/**
 * Strategy Simulation Runner
 *
 * Runs multi-round simulations with AI teams using different game theory strategies.
 * Tracks performance and generates comparative results.
 */

import { processRound, GAME_CONFIG, getBalancedStartingFinancials, type GameConfig } from './gameEngine'
import { generateAIDecision, getAIProfile, type AIProfile, type AIPersonality } from './aiEngine'
import { getStrategy, type GameTheoryStrategy, type StrategyContext, type DecisionModifiers, type RoundHistory } from './strategyEngine'
import { SIMULATION_CONFIG } from './simulationConfig'
import type { Decision, TeamData } from '../types/game'

// ============================================================================
// CONFIGURATION
// ============================================================================

export interface StrategySimulationConfig {
  // Team setup
  teamCount: number                        // 4-8 teams recommended
  strategies: string[]                     // Strategy IDs, one per team
  teamNames?: string[]                     // Optional custom names

  // Game settings
  rounds: number                           // e.g., 20 rounds
  scenarioId: number                       // Which scenario to use (if scenarioSequence not provided)
  scenarioSequence?: number[]              // Optional: different scenario per round
  industryConfig?: string                  // Default: 'electronics'

  // Simulation options
  trackMetrics?: ('sharePrice' | 'marketShare' | 'profit' | 'cash' | 'marketCap')[]
  silent?: boolean                         // Suppress console output
  verbose?: boolean                        // Extra logging
  gameConfigOverrides?: Record<string, unknown> // Direct overrides for GAME_CONFIG
  marketDemandMultiplier?: number          // Global demand scaling
  simulationSeed?: number                  // Global seed for reproducibility
}

export interface BatchSimulationConfig extends StrategySimulationConfig {
  gamesCount: number
  experimentName?: string
}

export interface TournamentConfig {
  strategies: string[]  // List of all strategy IDs to compete
  rounds: number
  gamesPerMatchup: number  // Number of games per unique matchup
  scenarioMode?: 'single' | 'random'
  scenarioId?: number
  simulationSeed?: number
  gameConfigOverrides?: Record<string, unknown>
  marketDemandMultiplier?: number
}

export interface TournamentResult {
  config: TournamentConfig
  leaderboard: Array<{
    strategyId: string
    strategyName: string
    totalWins: number
    totalLosses: number
    totalDraws: number
    avgSharePrice: number
    avgMarketShare: number
    winRate: number
    points: number  // Win=3, Draw=1, Loss=0
  }>
  matchups: Array<{
    team1Strategy: string
    team2Strategy: string
    team1Wins: number
    team2Wins: number
    draws: number
    avgTeam1SharePrice: number
    avgTeam2SharePrice: number
  }>
  heatmap: {
    strategies: string[]  // List of strategy IDs in order
    matrix: number[][]    // Win rate matrix [row][col] = row's win rate vs col
  }
  totalGames: number
  lastGameTrace?: {
    rounds: SimulationRoundResult[]
    finalStandings: TeamFinalStanding[]
    matchupInfo: {
      team1Strategy: string
      team2Strategy: string
      gameNumber: number
    }
  }
}

export interface BatchSimulationResult {
  config: BatchSimulationConfig
  gamesPlayed: number
  aggregatedResults: {
    teamStats: Record<number, {
      teamName: string
      strategyId: string
      avgSharePrice: number
      avgMarketShare: number
      avgProfit: number
      avgROE: number
      winRate: number
      bankruptcies: number
    }>
    industryStats: {
      avgProfitMargin: number
      avgPrice: number
      volatility: number
    }
    priceConvergence: number[] // Avg price per round
  }
  lastGameTrace?: {
    rounds: SimulationRoundResult[]
    finalStandings: TeamFinalStanding[]
  }
}

export interface SimulationTeam {
  id: number
  name: string
  strategyId: string
  strategy: GameTheoryStrategy
  aiProfile: AIProfile

  // Strategy-specific state
  strategyState: Record<string, unknown>
}

type TeamAggregateStat = {
  teamName: string
  strategyId: string
  totalSharePrice: number
  totalMarketShare: number
  totalProfit: number
  bankruptcies: number
  count: number
}

type TeamStateAggregate = {
  teamId: number
  teamName: string
  strategyId: string
  sharePrices: number[]
  marketShares: number[]
  profits: number[]
  cash: number[]
}

export interface SimulationRoundResult {
  round: number
  scenarioId?: number
  teams: TeamRoundResult[]
  marketData: {
    avgSharePrice: number
    avgMarketShare: number
    totalDemand: { us: number; asia: number; europe: number }
    avgPrice: { us: number; asia: number; europe: number }
  }
}

export interface TeamRoundResult {
  teamId: number
  teamName: string
  strategyId: string

  // Performance metrics
  sharePrice: number
  marketCap: number
  cash: number
  profit: number
  revenue: number

  // Market position
  marketShare: { us: number; asia: number; europe: number }
  avgMarketShare: number

  // Operational
  production: { us: number; asia: number }
  inventory: { us: number; asia: number }
  factories: { us: number; asia: number }

  // Pricing
  prices: { us: number; asia: number; europe: number }

  // Regional data for debugging
  salesByRegion?: { us: number; asia: number; europe: number }
  unitsByRegion?: { us: number; asia: number; europe: number }
  eps?: number

  // NEW: State for business logic
  techLevel: number
  unlockedFeatures: number
  brandReputation: number

  // Decisions made
  decision: Decision

  // Auditing
  unitsSold: number
  cogs?: number
  costs?: {
    rnd?: number
    marketing?: number
    totalOperating?: number
    interest?: number
    depreciation?: number
  }
  pnl?: {
    revenue?: number
    cogs?: number
    grossProfit?: number
    operatingExpenses?: number
    ebitda?: number
    depreciation?: number
    ebit?: number
    interestExpense?: number
    profitBeforeTax?: number
    tax?: number
    netProfit?: number
  }
}

export interface SimulationResults {
  config: StrategySimulationConfig
  rounds: SimulationRoundResult[]
  finalStandings: TeamFinalStanding[]
  insights: SimulationInsights
}

export interface TeamFinalStanding {
  rank: number
  teamId: number
  teamName: string
  strategyId: string
  strategyName: string

  finalSharePrice: number
  avgSharePrice: number
  sharePriceGrowth: number  // % change from start to end

  finalMarketShare: number
  avgMarketShare: number

  totalProfit: number
  finalCash: number
  finalMarketCap: number

  // Volatility (standard deviation of share price)
  volatility: number
}

export interface SimulationInsights {
  winner: {
    teamId: number
    teamName: string
    strategy: string
    metric: string  // What they won by (share price, market share, etc.)
  }

  mostStable: {
    teamId: number
    teamName: string
    strategy: string
    volatility: number
  }

  highestMarketShare: {
    teamId: number
    teamName: string
    strategy: string
    avgMarketShare: number
  }

  summary: string[]  // Array of insight strings
}

// ============================================================================
// SIMULATION RUNNER
// ============================================================================

/**
 * Run a strategy simulation
 */
export async function runStrategySimulation(
  config: StrategySimulationConfig
): Promise<SimulationResults> {
  // Merge overrides with base config
  const activeConfig = config.gameConfigOverrides
    ? { ...GAME_CONFIG, ...config.gameConfigOverrides }
    : GAME_CONFIG
  const scenarioSequence =
    config.scenarioSequence && config.scenarioSequence.length > 0
      ? config.scenarioSequence
      : Array.from({ length: config.rounds }, () => config.scenarioId)

  if (!config.silent) {
    console.log('='.repeat(80))
    console.log('STRATEGY SIMULATION LAB')
    console.log('='.repeat(80))
    console.log(`Teams: ${config.teamCount}`)
    console.log(`Rounds: ${config.rounds}`)
    console.log(`Scenario: ${config.scenarioId}`)
    console.log()
  }

  // Initialize teams
  const teams = initializeTeams(config)

  // Initialize game state
  const gameState = initializeGameState(config, teams, activeConfig)

  // Run simulation rounds
  const roundResults: SimulationRoundResult[] = []
  const previousGameStates = new Map<number, Record<string, unknown>>()

  // History tracking: Store last N rounds for each team
  const teamHistories = new Map<number, RoundHistory[]>()
  teams.forEach(team => {
    teamHistories.set(team.id, [])
  })

  for (let round = 1; round <= config.rounds; round++) {
    // Determine scenario for this round
    const currentScenarioId = scenarioSequence[round - 1] ?? config.scenarioId

    if (config.verbose && !config.silent) {
      console.log(`\n--- Round ${round}/${config.rounds} (Scenario: ${currentScenarioId}) ---`)
    }

    const roundResult = await simulateRound(
      round,
      config,
      teams,
      gameState,
      previousGameStates,
      currentScenarioId,
      activeConfig,
      teamHistories,
      scenarioSequence
    )
    roundResults.push(roundResult)

    // Update game state with results and track for next round
    updateGameStateWithTracking(gameState, roundResult, previousGameStates)

    // Update team histories after each round
    updateTeamHistories(roundResult, teamHistories)

    if (config.verbose && !config.silent) {
      logRoundSummary(roundResult)
    }
  }

  // Analyze results
  const finalStandings = calculateFinalStandings(roundResults)
  const insights = generateInsights(roundResults, finalStandings)

  if (!config.silent) {
    console.log('\n' + '='.repeat(80))
    console.log('SIMULATION COMPLETE')
    console.log('='.repeat(80))
  }

  return {
    config,
    rounds: roundResults,
    finalStandings,
    insights
  }
}

/**
 * Run a batch of simulations (e.g. 1000 games)
 */
export async function runBatchSimulation(
  config: BatchSimulationConfig,
  onProgress?: (completed: number, total: number) => void
): Promise<BatchSimulationResult> {
  const batchResults: SimulationResults[] = []

  // Chunking to prevent UI freeze
  const chunkSize = SIMULATION_CONFIG.BATCH.CHUNK_SIZE
  for (let i = 0; i < config.gamesCount; i += chunkSize) {
    const chunkPromises = []

    for (let j = 0; j < chunkSize && (i + j) < config.gamesCount; j++) {
      // Vary seed per game in batch for statistical coverage, but maintain determinism!
      const gameSeed = (config.simulationSeed || 0) + (i + j)
      const runConfig = { ...config, verbose: false, silent: true, simulationSeed: gameSeed }
      chunkPromises.push(runStrategySimulation(runConfig))
    }

    const chunkResults = await Promise.all(chunkPromises)
    batchResults.push(...chunkResults)

    if (onProgress) {
      onProgress(Math.min(i + chunkSize, config.gamesCount), config.gamesCount)
      // Allow UI to breathe
      await new Promise(resolve => setTimeout(resolve, SIMULATION_CONFIG.BATCH.CHUNK_DELAY))
    }
  }

  return aggregateBatchResults(config, batchResults)
}

function aggregateBatchResults(config: BatchSimulationConfig, results: SimulationResults[]): BatchSimulationResult {
  const teamStats: Record<number, TeamAggregateStat> = {}
  const teamWins: Record<number, number> = {}

  // Initialize accumulators
  results[0].finalStandings.forEach(t => {
    teamStats[t.teamId] = {
      teamName: t.teamName,
      strategyId: t.strategyId,
      totalSharePrice: 0,
      totalMarketShare: 0,
      totalProfit: 0,
      // totalROE: 0, // Need to calculate derived metrics if possible
      // const df = Math.pow((varA / nA) + (varB / nB), 2) /
      //    ((Math.pow(varA / nA, 2) / (nA - 1)) + (Math.pow(varB / nB, 2) / (nB - 1)))
      // metrics if possible
      bankruptcies: 0,
      count: 0
    }
    teamWins[t.teamId] = 0
  })

  let totalIndustryProfit = 0
  // let totalIndustryRevenue = 0
  // let totalPrices: number[] = []

  results.forEach(game => {
    // Track winner
    const winner = game.finalStandings[0]
    if (winner) teamWins[winner.teamId] = (teamWins[winner.teamId] || 0) + 1

    game.finalStandings.forEach(team => {
      const stat = teamStats[team.teamId]
      if (stat) {
        stat.totalSharePrice += team.finalSharePrice
        stat.totalMarketShare += team.avgMarketShare
        stat.totalProfit += team.totalProfit

        // Approximate ROE: Profit / (FinalMarketCap - Profit) approx Equity
        // Simplified: just track Profit for now as ROE calculation needs equity history
        stat.count++

        if (team.finalCash < 0) stat.bankruptcies++
      }
    })

    // Industry stats
    const gameTotalProfit = game.finalStandings.reduce((sum, t) => sum + t.totalProfit, 0)
    // const gameTotalRevenue = game.rounds.reduce((sum, r) => sum + r.teams.reduce((ts, t) => ts + (t.profit + t.production.us * 100), 0), 0) // Very rough revenue approx

    totalIndustryProfit += gameTotalProfit
    // Assuming revenue ~ profit * 4 for approximation if actual revenue not in finalStandings
  })
  void totalIndustryProfit

  // Normalize stats
  const finalTeamStats: Record<string, unknown> = {}
  Object.values(teamStats).forEach((stat) => {
    finalTeamStats[stat.strategyId] = { // Key by strategy or team ID? Let's use ID but mapped results
      teamName: stat.teamName,
      strategyId: stat.strategyId,
      avgSharePrice: stat.totalSharePrice / stat.count,
      avgMarketShare: stat.totalMarketShare / stat.count,
      avgProfit: stat.totalProfit / stat.count,
      avgROE: 0, // Placeholder
      winRate: (teamWins[Number(Object.keys(teamStats).find(id => teamStats[Number(id)] === stat))] || 0) / results.length,
      bankruptcies: stat.bankruptcies
    }
  })

  // Remap to team ID keys for consistency
  const mappedTeamStats: Record<number, BatchSimulationResult['aggregatedResults']['teamStats'][number]> = {}
  Object.keys(teamStats).forEach(key => {
    const id = Number(key)
    const stat = teamStats[id]
    mappedTeamStats[id] = {
      teamName: stat.teamName,
      strategyId: stat.strategyId,
      avgSharePrice: stat.totalSharePrice / stat.count,
      avgMarketShare: stat.totalMarketShare / stat.count,
      avgProfit: stat.totalProfit / stat.count,
      avgROE: 0,
      winRate: (teamWins[id] || 0) / results.length,
      bankruptcies: stat.bankruptcies
    }
  })

  // Calculate price convergence trend (avg price per round across all games)
  const roundCount = results[0].rounds.length
  const priceConvergence = Array(roundCount).fill(0).map((_, roundIdx) => {
    const avgRoundPrice = results.reduce((sum, game) => sum + game.rounds[roundIdx].marketData.avgSharePrice, 0) / results.length // Actually share price
    return avgRoundPrice
  })

  return {
    config,
    gamesPlayed: results.length,
    aggregatedResults: {
      teamStats: mappedTeamStats,
      industryStats: {
        avgProfitMargin: 0, // Need revenue data for margin
        avgPrice: 0,
        volatility: 0
      },
      priceConvergence
    },
    lastGameTrace: results[results.length - 1] // Store full trace of last game for auditing
  }
}

/**
 * Initialize simulation teams with strategies
 */
function initializeTeams(config: StrategySimulationConfig): SimulationTeam[] {
  const teams: SimulationTeam[] = []

  for (let i = 0; i < config.teamCount; i++) {
    const strategyId = config.strategies[i] || 'tit-for-tat'
    const strategy = getStrategy(strategyId)

    if (!strategy) {
      throw new Error(`Strategy not found: ${strategyId}`)
    }

    const teamName = config.teamNames?.[i] || `Team ${i + 1} (${strategy.name})`

    // Map strategy to closest AI personality
    const personality = mapStrategyToPersonality(strategyId)
    const aiProfile = getAIProfile(personality, 'medium')

    teams.push({
      id: i,
      name: teamName,
      strategyId,
      strategy,
      aiProfile,
      strategyState: { ...(strategy.state || {}) }
    })

    if (!config.silent) {
      console.log(`  ${teamName}: ${strategy.description}`)
    }
  }

  return teams
}

/**
 * Map strategy ID to closest AI personality
 */
function mapStrategyToPersonality(strategyId: string): AIPersonality {
  const mapping: Record<string, AIPersonality> = {
    'tit-for-tat': 'balanced',
    'predatory-pricing': 'aggressive',
    'premium': 'premium',
    'capacity-leader': 'aggressive',
    'regional-asia': 'regional_asia'
  }

  return mapping[strategyId] ?? 'balanced'
}

/**
 * Initialize game state (teams, cash, factories, etc.)
 */
function initializeGameState(
  config: StrategySimulationConfig,
  teams: SimulationTeam[],
  gameConfig: GameConfig
): { round: number; teams: Record<number, TeamData>; scenarioId: number } {
  const startingFinancials = getBalancedStartingFinancials(gameConfig)
  const sharesOutstanding = startingFinancials.sharesOutstanding
  const sharePrice = startingFinancials.sharePrice
  const marketCap = sharePrice * sharesOutstanding

  // Create initial team data structures
  const teamDataMap: Record<number, TeamData> = {}

  teams.forEach(team => {
    teamDataMap[team.id] = {
      id: team.id,
      name: team.name,
      cash: startingFinancials.startingCash,
      debt: startingFinancials.startingDebt,
      sharePrice,
      marketCap,
      factories: { ...gameConfig.initialFactories },
      inventory: { us: 0, asia: 0 },
      marketShare: { us: 0, asia: 0, europe: 0 },
      production: { us: 0, asia: 0 },
      prices: { ...gameConfig.priceDemand.baselinePriceByRegion },
      techLevel: 1,
      unlockedFeatures: 0,
      brandReputation: 50,
      previousPrices: { ...gameConfig.priceDemand.baselinePriceByRegion },
      previousProduction: undefined
    }
  })

  return {
    round: 0,
    teams: teamDataMap,
    scenarioId: config.scenarioId
  }
}

/**
 * Simulate a single round
 */
/**
 * Convert AIDecision format to TeamDecisions format required by game engine
 */
function convertAIDecisionToTeamDecisions(aiDecision: Decision): Record<string, unknown> {
  const supplierUS = Number(aiDecision.production.supplierUS ?? 1) || 1
  const supplierAsia = Number(aiDecision.production.supplierAsia ?? 1) || 1
  return {
    production: {
      demandForecast: { us: 0, asia: 0, europe: 0 },
      usUnits: aiDecision.production.usUnits,
      asiaUnits: aiDecision.production.asiaUnits,
      outsourceUS: aiDecision.production.outsourceUS,
      outsourceAsia: aiDecision.production.outsourceAsia,
      overtime: aiDecision.production.overtime,
      supplierUS: aiDecision.production.supplierUS,
      supplierAsia: aiDecision.production.supplierAsia,
      productionLines: {
        us1: { techLevel: 1 as const, supplierId: supplierUS, units: 80 },
        us2: { techLevel: 1 as const, supplierId: supplierUS, units: 80 },
        asia1: { techLevel: 1 as const, supplierId: supplierAsia, units: 0 },
        asia2: { techLevel: 1 as const, supplierId: supplierAsia, units: 0 },
      },
      outsource: { techLevel: 1 as const, supplierId: 2 as const, units: 0 }
    },
    hr: {
      us: {
        employees: aiDecision.hr.researchStaff / 2,
        wage: 5000,
        training: aiDecision.hr.trainingLevel === 'advanced' ? 100000 : aiDecision.hr.trainingLevel === 'standard' ? 50000 : 20000
      },
      asia: {
        employees: aiDecision.hr.researchStaff / 2,
        wage: 2000,
        training: aiDecision.hr.trainingLevel === 'advanced' ? 60000 : aiDecision.hr.trainingLevel === 'standard' ? 30000 : 10000
      }
    },
    rnd: {},
    investment: {
      newPlantsUS: aiDecision.investment.newPlantsUS,
      newPlantsAsia: aiDecision.investment.newPlantsAsia
    },
    logistics: {
      usPriority: ['us', 'europe', 'asia'],
      asiaPriority: ['asia', 'europe', 'us']
    },
    marketing: {
      us: { price: aiDecision.marketing.priceUS, features: 0, promotionPct: aiDecision.marketing.promoUS },
      asia: { price: aiDecision.marketing.priceAsia, features: 0, promotionPct: aiDecision.marketing.promoAsia },
      europe: { price: aiDecision.marketing.priceEurope, features: 0, promotionPct: aiDecision.marketing.promoEurope }
    },
    finance: {
      transferPricing: { us: 1.0, asia: 1.0, europe: 1.0 },
      longTermDebt: aiDecision.finance.borrowing - aiDecision.finance.repayment,
      shareIssuance: aiDecision.finance.shareIssue - aiDecision.finance.shareBuyback,
      dividends: aiDecision.finance.dividend
    }
  }
}

async function simulateRound(
  round: number,
  config: StrategySimulationConfig,
  teams: SimulationTeam[],
  gameState: { round: number; teams: Record<number, TeamData>; scenarioId: number },
  previousGameStates?: Map<number, Record<string, unknown>>,
  scenarioId?: number,
  activeGameConfig: GameConfig = GAME_CONFIG,
  teamHistories?: Map<number, RoundHistory[]>,
  scenarioSequence?: number[]
): Promise<SimulationRoundResult> {

  // Generate decisions for each team using their strategy
  const decisions: Record<number, Decision> = {}

  for (const team of teams) {
    // Build strategy context with history
    const teamHistory = teamHistories?.get(team.id) || []
    const context = buildStrategyContext(round, config.rounds, team, teams, gameState, teamHistory)

    // Execute strategy to get modifiers
    const modifiers = await Promise.resolve(team.strategy.execute(context))

    // Generate base AI decision
    const aiContext = {
      id: team.id,
      round,
      totalRounds: config.rounds,
      scenarioId: scenarioId || config.scenarioId,
      globalSeed: config.simulationSeed,
      currentState: {
        cash: gameState.teams[team.id].cash,
        debt: gameState.teams[team.id].debt,
        factories: gameState.teams[team.id].factories,
        inventory: gameState.teams[team.id].inventory,
        techLevel: gameState.teams[team.id].techLevel || 1,
        unlockedFeatures: gameState.teams[team.id].unlockedFeatures || 0,
        brandReputation: gameState.teams[team.id].brandReputation || 50
      }
    }

    const baseDecision = generateAIDecision(team.aiProfile, aiContext, activeGameConfig)

    // Apply strategy modifiers
    const modifiedDecision = applyStrategyModifiers(baseDecision, modifiers)

    decisions[team.id] = modifiedDecision
  }

  // Convert AI decisions to TeamState format for game engine
  const teamStates: TeamData[] = teams.map(team => ({
    id: team.id,
    name: team.name,
    decisions: convertAIDecisionToTeamDecisions(decisions[team.id])
  }))

  // Process round using actual game engine
  // For round 1, pass undefined instead of empty Map
  if (config.verbose && !config.silent && previousGameStates && previousGameStates.size > 0) {
    console.log(`  Previous game states: ${previousGameStates.size} teams`)
    previousGameStates.forEach((state, teamId) => {
      console.log(`    Team ${teamId}: factories=${JSON.stringify(state.factories)}, inventory=${state.inventory}`)
    })
  }

  const roundResult = processRound(
    teamStates,
    round,
    previousGameStates && previousGameStates.size > 0 ? previousGameStates : undefined,
    scenarioSequence && scenarioSequence.length > 0
      ? scenarioSequence
      : [scenarioId || config.scenarioId],
    config.marketDemandMultiplier || 1.0,
    activeGameConfig
  )

  // Extract results and convert to simulation format
  const teamResults: TeamRoundResult[] = roundResult.teams.map((result) => {
    // Find the corresponding team by matching teamId from result
    const team = teams.find(t => t.id === result.teamId)
    if (!team) {
      throw new Error(`Team not found for teamId ${result.teamId}`)
    }

    // Store gameState for next round, keyed by result.teamId
    if (previousGameStates) {
      previousGameStates.set(result.teamId, {
        ...result.gameState,
        previousRoundResults: result
      })
    }

    // Find the corresponding teamState by teamId to get the decisions
    const teamState = teamStates.find(ts => ts.id === result.teamId)
    if (!teamState) {
      throw new Error(`TeamState not found for teamId ${result.teamId}`)
    }

    return {
      teamId: result.teamId,
      teamName: result.teamName,
      strategyId: team.strategyId,
      sharePrice: result.kpis.sharePrice,
      marketCap: result.kpis.marketCap,
      cash: result.balanceSheet.cash,
      profit: result.pnl.netProfit,
      revenue: result.pnl.revenue,
      unitsSold: result.sales.total.units,
      marketShare: result.marketShare,
      avgMarketShare: (result.marketShare.us + result.marketShare.asia + result.marketShare.europe) / 3,
      production: {
        us: result.production?.usFactoryUnits ?? 0,
        asia: result.production?.asiaFactoryUnits ?? 0
      },
      inventory: {
        us: result.inventoryTrace?.endingUnitsUS ?? 0,
        asia: result.inventoryTrace?.endingUnitsAsia ?? 0
      },
      factories: result.gameState.factories,
      prices: {
        us: teamState.decisions.marketing.us.price,
        asia: teamState.decisions.marketing.asia.price,
        europe: teamState.decisions.marketing.europe.price
      },
      salesByRegion: {
        us: result.sales.us.revenue,
        asia: result.sales.asia.revenue,
        europe: result.sales.europe.revenue
      },
      unitsByRegion: {
        us: result.sales.us.units,
        asia: result.sales.asia.units,
        europe: result.sales.europe.units
      },
      eps: result.kpis.eps,
      techLevel: result.availableTechLevel,
      unlockedFeatures: result.availableFeatures,
      brandReputation: result.gameState.brandReputation,
      decision: decisions[result.teamId],
      cogs: result.pnl.cogs,
      costs: {
        rnd: result.costs.rnd,
        marketing: result.costs.marketing,
        totalOperating: result.costs.totalOperating,
        interest: result.costs.interest,
        depreciation: result.costs.depreciation
      },
      pnl: {
        revenue: result.pnl.revenue,
        cogs: result.pnl.cogs,
        grossProfit: result.pnl.grossProfit,
        operatingExpenses: result.pnl.operatingExpenses,
        ebitda: result.pnl.ebitda,
        depreciation: result.pnl.depreciation,
        ebit: result.pnl.ebit,
        interestExpense: result.pnl.interestExpense,
        profitBeforeTax: result.pnl.profitBeforeTax,
        tax: result.pnl.tax,
        netProfit: result.pnl.netProfit
      }
    }
  })

  // Calculate market averages
  const avgSharePrice = teamResults.reduce((sum, t) => sum + t.sharePrice, 0) / teamResults.length
  const avgMarketShare = teamResults.reduce((sum, t) => sum + t.avgMarketShare, 0) / teamResults.length
  const avgPrice = {
    us: teamResults.reduce((sum, t) => sum + t.prices.us, 0) / teamResults.length,
    asia: teamResults.reduce((sum, t) => sum + t.prices.asia, 0) / teamResults.length,
    europe: teamResults.reduce((sum, t) => sum + t.prices.europe, 0) / teamResults.length
  }

  return {
    round,
    scenarioId,
    teams: teamResults,
    marketData: {
      avgSharePrice,
      avgMarketShare: avgMarketShare * 100, // Convert to percentage
      totalDemand: {
        us: roundResult.marketDemand.us,
        asia: roundResult.marketDemand.asia,
        europe: roundResult.marketDemand.europe
      },
      avgPrice
    }
  }
}

/**
 * Build strategy context from current game state
 */
function buildStrategyContext(
  round: number,
  totalRounds: number,
  myTeam: SimulationTeam,
  allTeams: SimulationTeam[],
  gameState: { round: number; teams: Record<number, TeamData>; scenarioId: number },
  teamHistory: RoundHistory[] = []
): StrategyContext {

  const competitors = allTeams
    .filter(t => t.id !== myTeam.id)
    .map(t => gameState.teams[t.id])

  // Calculate REAL market data from current game state
  const allTeamStates = allTeams.map(t => gameState.teams[t.id])

  // Calculate average prices by region
  const avgPrice = {
    us: allTeamStates.reduce((sum, t) => sum + (t.prices?.us || SIMULATION_CONFIG.MARKET_FALLBACK.PRICE.us), 0) / allTeamStates.length,
    asia: allTeamStates.reduce((sum, t) => sum + (t.prices?.asia || SIMULATION_CONFIG.MARKET_FALLBACK.PRICE.asia), 0) / allTeamStates.length,
    europe: allTeamStates.reduce((sum, t) => sum + (t.prices?.europe || SIMULATION_CONFIG.MARKET_FALLBACK.PRICE.europe), 0) / allTeamStates.length,
  }

  // Calculate average market share
  const avgMarketShare = 100 / allTeams.length

  // Calculate total demand based on capacity (more realistic than hard-coded values)
  const totalCapacity = GAME_CONFIG.capacityPerPlant * allTeams.length
  const totalDemand = {
    us: totalCapacity * 0.22,    // 22% of total capacity
    asia: totalCapacity * 0.60,   // 60% of total capacity
    europe: totalCapacity * 0.18, // 18% of total capacity
  }

  // Calculate price range
  const allPrices = allTeamStates.flatMap(t => [
    t.prices?.us || avgPrice.us,
    t.prices?.asia || avgPrice.asia,
    t.prices?.europe || avgPrice.europe
  ]).filter(p => p > 0)

  const priceRange = allPrices.length > 0
    ? { min: Math.min(...allPrices), max: Math.max(...allPrices) }
    : { min: 80, max: 120 }

  return {
    round,
    totalRounds,
    scenarioId: gameState.scenarioId,
    myTeam: gameState.teams[myTeam.id],
    competitors,
    marketData: {
      avgPrice,
      avgMarketShare,
      totalDemand,
      competitorCount: competitors.length,
      priceRange
    },
    history: teamHistory,  // Now includes actual history data
    strategyState: myTeam.strategyState
  }
}

/**
 * Apply strategy modifiers to base AI decision
 */
function applyStrategyModifiers(
  baseDecision: Decision,
  modifiers: DecisionModifiers
): Decision {
  const modified = { ...baseDecision }

  // Apply price modifiers
  if (modifiers.priceMultiplier) {
    modified.marketing = {
      ...modified.marketing,
      priceUS: modified.marketing.priceUS * (modifiers.priceMultiplier.us || 1),
      priceAsia: modified.marketing.priceAsia * (modifiers.priceMultiplier.asia || 1),
      priceEurope: modified.marketing.priceEurope * (modifiers.priceMultiplier.europe || 1)
    }
  }

  // Apply production modifiers
  if (modifiers.productionMultiplier) {
    const multiplier = typeof modifiers.productionMultiplier === 'number'
      ? { us: modifiers.productionMultiplier, asia: modifiers.productionMultiplier }
      : modifiers.productionMultiplier
    modified.production = {
      ...modified.production,
      usUnits: Math.round(modified.production.usUnits * (multiplier.us || 1)),
      asiaUnits: Math.round(modified.production.asiaUnits * (multiplier.asia || 1))
    }
  }

  // Apply R&D modifiers
  if (modifiers.rdInvestmentMultiplier) {
    modified.rnd = {
      ...modified.rnd,
      researchStaff: Math.round(modified.rnd.researchStaff * modifiers.rdInvestmentMultiplier)
    }
  }

  // Force/block investment
  if (modifiers.forceInvestment) {
    modified.investment = {
      newPlantsUS: modifiers.forceInvestment.us,
      newPlantsAsia: modifiers.forceInvestment.asia
    }
  } else if (modifiers.blockInvestment) {
    modified.investment = {
      newPlantsUS: 0,
      newPlantsAsia: 0
    }
  }

  return modified
}

/**
 * Update team histories with round results
 * Maintains a rolling window of the last N rounds
 */
function updateTeamHistories(
  roundResult: SimulationRoundResult,
  teamHistories: Map<number, RoundHistory[]>
): void {
  roundResult.teams.forEach(teamResult => {
    const history = teamHistories.get(teamResult.teamId) || []

    // Create history entry for this round
    const historyEntry: RoundHistory = {
      round: roundResult.round,
      myDecision: teamResult.decision,
      myResults: {
        sharePrice: teamResult.sharePrice,
        marketCap: teamResult.marketCap,
        cash: teamResult.cash,
        marketShare: teamResult.marketShare,
        production: teamResult.production,
        inventory: teamResult.inventory,
        prices: teamResult.prices,
      },
      marketSnapshot: {
        avgPrice: roundResult.marketData.avgPrice,
        avgMarketShare: roundResult.marketData.avgMarketShare,
        totalDemand: roundResult.marketData.totalDemand,
        competitorCount: roundResult.teams.length - 1,
        priceRange: {
          min: Math.min(...roundResult.teams.map(t => Math.min(t.prices.us, t.prices.asia, t.prices.europe))),
          max: Math.max(...roundResult.teams.map(t => Math.max(t.prices.us, t.prices.asia, t.prices.europe))),
        },
      },
    }

    // Add to history
    history.push(historyEntry)

    // Keep only last N rounds (rolling window)
    if (history.length > SIMULATION_CONFIG.HISTORY.WINDOW_SIZE) {
      history.shift()
    }

    teamHistories.set(teamResult.teamId, history)
  })
}

/**
 * Update game state with round results
 * Note: previousGameStates is now tracked directly in simulateRound
 */
function updateGameStateWithTracking(
  gameState: { round: number; teams: Record<number, TeamData>; scenarioId: number },
  roundResult: SimulationRoundResult,
  _previousGameStates: Map<number, Record<string, unknown>>
): void {
  void _previousGameStates
  roundResult.teams.forEach(teamResult => {
    const team = gameState.teams[teamResult.teamId]

    // Store previous values for reactive strategies
    // Only set previousPrices if current prices are non-zero (avoid division by zero in strategies)
    if (team.prices.us > 0 || team.prices.asia > 0 || team.prices.europe > 0) {
      team.previousPrices = team.prices
    }
    team.previousProduction = team.production

    // Update with new values
    team.sharePrice = teamResult.sharePrice
    team.marketCap = teamResult.marketCap
    team.cash = teamResult.cash
    team.marketShare = teamResult.marketShare
    team.production = teamResult.production
    team.inventory = teamResult.inventory
    team.factories = teamResult.factories
    team.prices = teamResult.prices

    // PERSIST R&D AND BRAND STATE (Required for Innovator Pivot)
    team.techLevel = teamResult.techLevel
    team.unlockedFeatures = teamResult.unlockedFeatures
    team.brandReputation = teamResult.brandReputation
    team.previousDecision = teamResult.decision
  })

  gameState.round++
}

/**
 * Calculate final standings
 */
function calculateFinalStandings(rounds: SimulationRoundResult[]): TeamFinalStanding[] {
  const teamStats: Record<number, TeamStateAggregate> = {}

  // Aggregate stats across rounds
  rounds.forEach(round => {
    round.teams.forEach(team => {
      if (!teamStats[team.teamId]) {
        teamStats[team.teamId] = {
          teamId: team.teamId,
          teamName: team.teamName,
          strategyId: team.strategyId,
          sharePrices: [],
          marketShares: [],
          profits: [],
          cash: []
        }
      }

      teamStats[team.teamId].sharePrices.push(team.sharePrice)
      teamStats[team.teamId].marketShares.push(team.avgMarketShare)
      teamStats[team.teamId].profits.push(team.profit)
      teamStats[team.teamId].cash.push(team.cash)
    })
  })

  // Calculate final metrics
  const standings: TeamFinalStanding[] = Object.values(teamStats).map((stats) => {
    const sharePrices = stats.sharePrices
    const avgSharePrice = sharePrices.reduce((a: number, b: number) => a + b, 0) / sharePrices.length
    const volatility = calculateStdDev(sharePrices)

    return {
      rank: 0, // Will be set after sorting
      teamId: stats.teamId,
      teamName: stats.teamName,
      strategyId: stats.strategyId,
      strategyName: getStrategy(stats.strategyId)?.name || stats.strategyId,
      finalSharePrice: sharePrices[sharePrices.length - 1],
      avgSharePrice,
      sharePriceGrowth: ((sharePrices[sharePrices.length - 1] - sharePrices[0]) / sharePrices[0]) * 100,
      finalMarketShare: stats.marketShares[stats.marketShares.length - 1] || 0,
      avgMarketShare: stats.marketShares.reduce((a: number, b: number) => a + b, 0) / stats.marketShares.length || 0,
      totalProfit: stats.profits.reduce((a: number, b: number) => a + b, 0),
      finalCash: stats.cash[stats.cash.length - 1],
      finalMarketCap: sharePrices[sharePrices.length - 1] * 10000000, // Simplified
      volatility
    }
  })

  // Sort by final share price and assign ranks
  standings.sort((a, b) => b.finalSharePrice - a.finalSharePrice)
  standings.forEach((standing, index) => {
    standing.rank = index + 1
  })

  return standings
}

/**
 * Generate insights from simulation results
 */
function generateInsights(
  _rounds: SimulationRoundResult[],
  standings: TeamFinalStanding[]
): SimulationInsights {

  const winner = standings[0]
  const mostStable = standings.reduce((prev, curr) =>
    curr.volatility < prev.volatility ? curr : prev
  )
  const highestShare = standings.reduce((prev, curr) =>
    curr.avgMarketShare > prev.avgMarketShare ? curr : prev
  )

  const summary = [
    `${winner.strategyName} won with final share price of $${winner.finalSharePrice.toFixed(2)}`,
    `${mostStable.strategyName} was most stable (volatility: ${mostStable.volatility.toFixed(2)})`,
    `${highestShare.strategyName} captured highest avg market share (${highestShare.avgMarketShare.toFixed(1)}%)`
  ]

  return {
    winner: {
      teamId: winner.teamId,
      teamName: winner.teamName,
      strategy: winner.strategyName,
      metric: 'share price'
    },
    mostStable: {
      teamId: mostStable.teamId,
      teamName: mostStable.teamName,
      strategy: mostStable.strategyName,
      volatility: mostStable.volatility
    },
    highestMarketShare: {
      teamId: highestShare.teamId,
      teamName: highestShare.teamName,
      strategy: highestShare.strategyName,
      avgMarketShare: highestShare.avgMarketShare
    },
    summary
  }
}

/**
 * Run tournament: All strategies compete against each other
 */
export async function runTournament(
  config: TournamentConfig,
  onProgress?: (completed: number, total: number) => void
): Promise<TournamentResult> {
  const strategies = config.strategies
  const matchupResults: Map<string, TournamentResult['matchups'][number]> = new Map()
  const strategyStats: Map<string, {
    strategyId: string
    strategyName: string
    totalWins: number
    totalLosses: number
    totalDraws: number
    totalSharePrice: number
    totalMarketShare: number
    gamesPlayed: number
  }> = new Map()
  let lastGameTrace: TournamentResult['lastGameTrace'] | undefined

  // Initialize strategy stats
  strategies.forEach(stratId => {
    const strategy = getStrategy(stratId)
    strategyStats.set(stratId, {
      strategyId: stratId,
      strategyName: strategy?.name || stratId,
      totalWins: 0,
      totalLosses: 0,
      totalDraws: 0,
      totalSharePrice: 0,
      totalMarketShare: 0,
      gamesPlayed: 0,
    })
  })

  // Generate all unique matchups (including self-play)
  const matchups: Array<[string, string]> = []
  for (let i = 0; i < strategies.length; i++) {
    for (let j = i; j < strategies.length; j++) {
      matchups.push([strategies[i], strategies[j]])
    }
  }

  const totalGames = matchups.length * config.gamesPerMatchup
  let completedGames = 0

  // Run each matchup multiple times
  for (const [strat1, strat2] of matchups) {
    const matchupKey = `${strat1}-vs-${strat2}`
    const matchupStats = {
      team1Strategy: strat1,
      team2Strategy: strat2,
      team1Wins: 0,
      team2Wins: 0,
      draws: 0,
      team1SharePrices: [] as number[],
      team2SharePrices: [] as number[],
    }

    for (let gameNum = 0; gameNum < config.gamesPerMatchup; gameNum++) {
      // Run a 2-player game
      const gameConfig: StrategySimulationConfig = {
        teamCount: 2,
        strategies: [strat1, strat2],
        rounds: config.rounds,
        scenarioId: config.scenarioId || SIMULATION_CONFIG.DEFAULTS.SCENARIO_ID,
        simulationSeed: (config.simulationSeed || 0) + completedGames,
        gameConfigOverrides: config.gameConfigOverrides,
        marketDemandMultiplier: config.marketDemandMultiplier,
        silent: true,
      }

      const result = await runStrategySimulation(gameConfig)

      // Store the last game's trace for debugging
      lastGameTrace = {
        rounds: result.rounds,
        finalStandings: result.finalStandings,
        matchupInfo: {
          team1Strategy: strat1,
          team2Strategy: strat2,
          gameNumber: gameNum + 1
        }
      }

      // IMPORTANT: finalStandings is sorted by share price, so we need to find teams by strategyId
      const team1Result = result.finalStandings.find(t => t.strategyId === strat1)!
      const team2Result = result.finalStandings.find(t => t.strategyId === strat2)!

      // DEBUG: Log share prices
      console.log(`[TOURNAMENT] Game ${gameNum + 1}/${config.gamesPerMatchup} - ${strat1} vs ${strat2}`)
      console.log(`  ${strat1} final share price: $${team1Result.finalSharePrice.toFixed(2)}`)
      console.log(`  ${strat2} final share price: $${team2Result.finalSharePrice.toFixed(2)}`)

      // Determine winner
      if (team1Result.finalSharePrice > team2Result.finalSharePrice) {
        matchupStats.team1Wins++
        strategyStats.get(strat1)!.totalWins++
        strategyStats.get(strat2)!.totalLosses++
      } else if (team2Result.finalSharePrice > team1Result.finalSharePrice) {
        matchupStats.team2Wins++
        strategyStats.get(strat2)!.totalWins++
        strategyStats.get(strat1)!.totalLosses++
      } else {
        matchupStats.draws++
        strategyStats.get(strat1)!.totalDraws++
        strategyStats.get(strat2)!.totalDraws++
      }

      matchupStats.team1SharePrices.push(team1Result.finalSharePrice)
      matchupStats.team2SharePrices.push(team2Result.finalSharePrice)

      // DEBUG: Log array state
      console.log(`  Share prices accumulated: [${matchupStats.team1SharePrices.slice(-3).map(p => p.toFixed(2)).join(', ')}...]`)

      strategyStats.get(strat1)!.totalSharePrice += team1Result.finalSharePrice
      strategyStats.get(strat1)!.totalMarketShare += team1Result.avgMarketShare
      strategyStats.get(strat1)!.gamesPlayed++

      strategyStats.get(strat2)!.totalSharePrice += team2Result.finalSharePrice
      strategyStats.get(strat2)!.totalMarketShare += team2Result.avgMarketShare
      strategyStats.get(strat2)!.gamesPlayed++

      completedGames++
      if (onProgress) {
        onProgress(completedGames, totalGames)
      }
    }

    // DEBUG: Log matchup summary
    const avg1 = matchupStats.team1SharePrices.reduce((a: number, b: number) => a + b, 0) / matchupStats.team1SharePrices.length
    const avg2 = matchupStats.team2SharePrices.reduce((a: number, b: number) => a + b, 0) / matchupStats.team2SharePrices.length
    console.log(`[TOURNAMENT] Matchup complete: ${strat1} vs ${strat2}`)
    console.log(`  ${strat1} avg: $${avg1.toFixed(2)} (from ${matchupStats.team1SharePrices.length} games)`)
    console.log(`  ${strat2} avg: $${avg2.toFixed(2)} (from ${matchupStats.team2SharePrices.length} games)`)
    console.log(`  Results: ${strat1} ${matchupStats.team1Wins}W - ${matchupStats.draws}D - ${matchupStats.team2Wins}W ${strat2}`)

    matchupResults.set(matchupKey, matchupStats)
  }

  // Calculate final leaderboard
  const leaderboard = Array.from(strategyStats.values()).map(stats => ({
    strategyId: stats.strategyId,
    strategyName: stats.strategyName,
    totalWins: stats.totalWins,
    totalLosses: stats.totalLosses,
    totalDraws: stats.totalDraws,
    avgSharePrice: stats.totalSharePrice / stats.gamesPlayed,
    avgMarketShare: stats.totalMarketShare / stats.gamesPlayed,
    winRate: stats.totalWins / stats.gamesPlayed,
    points: stats.totalWins * 3 + stats.totalDraws * 1,
  })).sort((a, b) => b.points - a.points)  // Sort by points

  // Format matchup results
  const matchupsList = Array.from(matchupResults.values()).map(m => ({
    team1Strategy: m.team1Strategy,
    team2Strategy: m.team2Strategy,
    team1Wins: m.team1Wins,
    team2Wins: m.team2Wins,
    draws: m.draws,
    avgTeam1SharePrice: m.team1SharePrices.reduce((a: number, b: number) => a + b, 0) / m.team1SharePrices.length,
    avgTeam2SharePrice: m.team2SharePrices.reduce((a: number, b: number) => a + b, 0) / m.team2SharePrices.length,
  }))

  // Generate heatmap matrix
  const heatmapMatrix: number[][] = []
  for (let i = 0; i < strategies.length; i++) {
    const row: number[] = []
    for (let j = 0; j < strategies.length; j++) {
      const strat1 = strategies[i]
      const strat2 = strategies[j]

      if (i === j) {
        // Diagonal: 50% win rate against self
        row.push(50)
      } else {
        // Find the matchup
        const key1 = `${strat1}-vs-${strat2}`
        const key2 = `${strat2}-vs-${strat1}`

        let winRate = 50  // Default 50%

        if (matchupResults.has(key1)) {
          const matchup = matchupResults.get(key1)
          const totalGames = matchup.team1Wins + matchup.team2Wins + matchup.draws
          winRate = (matchup.team1Wins / totalGames) * 100
        } else if (matchupResults.has(key2)) {
          const matchup = matchupResults.get(key2)
          const totalGames = matchup.team1Wins + matchup.team2Wins + matchup.draws
          // Reverse perspective: strat1 was team2 in this matchup
          winRate = (matchup.team2Wins / totalGames) * 100
        }

        row.push(Math.round(winRate))
      }
    }
    heatmapMatrix.push(row)
  }

  return {
    config,
    leaderboard,
    matchups: matchupsList,
    heatmap: {
      strategies,
      matrix: heatmapMatrix
    },
    totalGames: completedGames,
    lastGameTrace,
  }
}

/**
 * Calculate standard deviation
 */
function calculateStdDev(values: number[]): number {
  const avg = values.reduce((a, b) => a + b, 0) / values.length
  const squareDiffs = values.map(value => Math.pow(value - avg, 2))
  const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / squareDiffs.length
  return Math.sqrt(avgSquareDiff)
}

/**
 * Log round summary to console
 */
function logRoundSummary(roundResult: SimulationRoundResult): void {
  console.log('\nShare Prices:')
  roundResult.teams.forEach(team => {
    console.log(`  ${team.teamName}: $${team.sharePrice.toFixed(2)}`)
  })
}
