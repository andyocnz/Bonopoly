#!/usr/bin/env npx tsx
/**
 * Bonopoly Database-Integrated Simulation Test
 *
 * Runs complete game simulations that:
 * 1. Insert all data into the real database
 * 2. Use the actual game engine (no hardcoding)
 * 3. Output login credentials for manual verification
 * 4. Detect and report issues
 *
 * Usage:
 *   npx tsx simulation-test/simulate.ts
 *   npx tsx simulation-test/simulate.ts --rounds=5 --teams=4
 */

import { Prisma, PrismaClient, GameStatus, RoundStatus } from '@prisma/client'
import * as fs from 'node:fs'
import * as path from 'node:path'
import {
  calculateRoundAudit,
  createInitialGameState,
  getGameConfigForIndustry,
  getBalancedStartingFinancials,
  SCENARIOS,
  type GameConfig,
  type TeamGameState,
  type RoundAuditResults,
} from '../src/engine/gameEngine'
import type { TeamState, TeamDecisions, RegionKey } from '../src/components/DecisionSimulator'

const prisma = new PrismaClient()

// ============================================================================
// CONFIGURATION
// ============================================================================

interface SimulationConfig {
  rounds: number
  teams: number
  verbose: boolean
  outputDir: string
  scenarioSequence?: number[]
  industry: string
}

function parseArgs(): SimulationConfig {
  const args = process.argv.slice(2)
  const config: SimulationConfig = {
    rounds: 5,
    teams: 4,
    verbose: true,
    outputDir: './simulation-test/output',
    industry: 'Oil & Energy',
  }

  args.forEach((arg: string) => {
    if (arg.startsWith('--rounds=')) config.rounds = parseInt(arg.split('=')[1])
    if (arg.startsWith('--teams=')) config.teams = parseInt(arg.split('=')[1])
    if (arg === '--verbose') config.verbose = true
    if (arg === '--quiet') config.verbose = false
    if (arg.startsWith('--output=')) config.outputDir = arg.split('=')[1]
    if (arg.startsWith('--industry=')) config.industry = arg.split('=')[1]
    if (arg.startsWith('--scenarios=')) {
      config.scenarioSequence = arg.split('=')[1].split(',').map(Number)
    }
  })

  return config
}

// ============================================================================
// CODE GENERATORS
// ============================================================================

function generateGameCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return `SIM-${code}`
}

function generateTeamCode(prefix: string): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return `${prefix}-${code}`
}

function generatePin(): string {
  return String(Math.floor(1000 + Math.random() * 9000))
}

// ============================================================================
// DECISION GENERATOR (Uses Game Engine Config - NO HARDCODING)
// ============================================================================

function createDecisionsForTeam(
  teamIndex: number,
  round: number,
  gameState: TeamGameState,
  scenarioId: number,
  config: GameConfig
): TeamDecisions {
  // Get scenario from game engine
  const scenario = SCENARIOS[scenarioId] ?? SCENARIOS[0]

  // Calculate capacity based on actual game state
  const usCapacity = gameState.factories.us * config.capacityPerPlant
  const asiaCapacity = gameState.factories.asia * config.capacityPerPlant

  // Vary production based on team personality
  const productionMultipliers = [0.80, 0.75, 0.85, 0.70, 0.90, 0.78]
  const multiplier = productionMultipliers[teamIndex % productionMultipliers.length]

  // Price strategy varies by team
  const priceStrategies = [
    { us: 0, asia: 0, europe: 0 },       // Baseline
    { us: 5, asia: 3, europe: 7 },       // Premium
    { us: -8, asia: -5, europe: -3 },    // Discount
    { us: 10, asia: -2, europe: 5 },     // US Premium
    { us: -5, asia: 8, europe: 10 },     // Asia discount
    { us: 3, asia: 3, europe: 3 },       // Slight premium
  ]
  const priceAdjust = priceStrategies[teamIndex % priceStrategies.length]

  // Adapt to scenario
  let scenarioMultiplier = 1.0
  if (scenario.demandModifier.us < -10 || scenario.demandModifier.asia < -10) {
    // Recession - reduce production
    scenarioMultiplier = 0.85
  } else if (scenario.demandModifier.asia > 10) {
    // Boom - increase production
    scenarioMultiplier = 1.1
  }

  // Supplier selection based on team strategy
  const supplierStrategies: (1 | 2 | 3 | 4)[] = [2, 3, 1, 2, 3, 4]
  const supplier = supplierStrategies[teamIndex % supplierStrategies.length]

  // Investment decisions - team 0 invests in Asia early
  const investAsia = teamIndex === 0 && round <= 2 && gameState.factories.asia < 2 ? 1 : 0
  const investUS = round >= 3 && gameState.factories.us < 4 && teamIndex % 2 === 0 ? 1 : 0

    // Marketing varies by team and scenario
  const basePromo = scenario.csrImportanceModifier > 1.2 ? 12 : 8
  const promoVariation = [-2, 0, 2, -1, 3, 1][teamIndex % 6]

  return {
    production: {
      demandForecast: {
        us: config.marketGrowthRate.us + scenario.demandModifier.us,
        asia: config.marketGrowthRate.asia + scenario.demandModifier.asia,
        europe: config.marketGrowthRate.europe + scenario.demandModifier.europe,
      },
      techShareForecast: {
        us: { tech1: 100, tech2: 0, tech3: 0, tech4: 0 },
        asia: { tech1: 100, tech2: 0, tech3: 0, tech4: 0 },
        europe: { tech1: 100, tech2: 0, tech3: 0, tech4: 0 },
      },
      usUnits: Math.round(usCapacity * multiplier * scenarioMultiplier),
      asiaUnits: Math.round(asiaCapacity * multiplier * scenarioMultiplier),
      outsourceUS: 0,
      outsourceAsia: 0,
      overtime: 0,
      supplierUS: supplier,
      supplierAsia: supplier,
      productionLines: {
        us1: { techLevel: gameState.rndProgress.unlockedTechLevel as 1 | 2 | 3 | 4, supplierId: supplier, units: 80 },
        us2: { techLevel: gameState.rndProgress.unlockedTechLevel as 1 | 2 | 3 | 4, supplierId: supplier, units: 80 },
        asia1: { techLevel: gameState.rndProgress.unlockedTechLevel as 1 | 2 | 3 | 4, supplierId: supplier, units: gameState.factories.asia > 0 ? 80 : 0 },
        asia2: { techLevel: gameState.rndProgress.unlockedTechLevel as 1 | 2 | 3 | 4, supplierId: supplier, units: gameState.factories.asia > 0 ? 80 : 0 },
      },
      outsource: { techLevel: 1 as const, supplierId: 2 as const, units: 0 },
    },
    hr: {
      us: { employees: 50 + teamIndex * 5, wage: 5000, training: 50000 },
      asia: { employees: 40 + teamIndex * 3, wage: 2000, training: 30000 },
    },
    rnd: {
      featureInvestment: 100,
    },
    investment: {
      newPlantsUS: investUS,
      newPlantsAsia: investAsia,
    },
    logistics: {
      usPriority: ['us', 'europe', 'asia'] as [RegionKey, RegionKey, RegionKey],
      asiaPriority: ['asia', 'europe', 'us'] as [RegionKey, RegionKey, RegionKey],
    },
    marketing: {
      us: {
      price: config.priceDemand.baselinePriceByRegion.us + priceAdjust.us + round * 2,
        features: gameState.rndProgress.unlockedFeatureCount,
        promotionPct: basePromo + promoVariation,
      },
      asia: {
      price: config.priceDemand.baselinePriceByRegion.asia + priceAdjust.asia + round * 2,
        features: gameState.rndProgress.unlockedFeatureCount,
        promotionPct: basePromo + promoVariation + 2,
      },
      europe: {
      price: config.priceDemand.baselinePriceByRegion.europe + priceAdjust.europe + round * 2,
        features: gameState.rndProgress.unlockedFeatureCount,
        promotionPct: basePromo + promoVariation,
      },
    },
    finance: {
      transferPricing: { us: 1.0, asia: 1.0, europe: 1.0 },
      longTermDebt: 0,
      shareIssuance: 0,
      dividends: round >= 3 ? 500000 : 0,
    },
  }
}

function getTrainingLevelFromCost(cost: number): 'basic' | 'standard' | 'advanced' {
  if (cost >= 100000) return 'advanced'
  if (cost >= 50000) return 'standard'
  return 'basic'
}

function mapEngineDecisionToDb(decisions: TeamDecisions) {
  const prod = decisions.production
  const hr = decisions.hr
  const rnd = decisions.rnd
  const inv = decisions.investment
  const mkt = decisions.marketing
  const fin = decisions.finance

  const trainingLevel = getTrainingLevelFromCost(hr.us.training)

  return {
    production: {
      usUnits: prod.usUnits ?? 0,
      asiaUnits: prod.asiaUnits ?? 0,
      overtime: prod.overtime ?? 0,
      supplierUS: prod.supplierUS ?? prod.productionLines?.us1?.supplierId ?? 2,
      supplierAsia: prod.supplierAsia ?? prod.productionLines?.asia1?.supplierId ?? 2,
      outsourceUS: prod.outsourceUS ?? 0,
      outsourceAsia: prod.outsourceAsia ?? 0,
      productionLines: prod.productionLines,
      outsource: prod.outsource,
    },
    hr: {
      trainingLevel,
      researchStaff: hr.us.employees ?? 50,
    },
    rnd: {
      featureAllocation: rnd.featureInvestment ?? 0,
    },
    investment: {
      newPlantsUS: inv.newPlantsUS ?? 0,
      newPlantsAsia: inv.newPlantsAsia ?? 0,
    },
    logistics: {
      allocation: {
        us: { local: 100, fromAsia: 0 },
        asia: { local: 100, fromUS: 0 },
        europe: { fromUS: 50, fromAsia: 50 },
      },
    },
    marketing: {
      priceUS: mkt.us.price,
      priceAsia: mkt.asia.price,
      priceEurope: mkt.europe.price,
      promoUS: mkt.us.promotionPct,
      promoAsia: mkt.asia.promotionPct,
      promoEurope: mkt.europe.promotionPct,
    },
    finance: {
      borrowing: Math.max(0, fin.longTermDebt ?? 0),
      repayment: Math.abs(Math.min(0, fin.longTermDebt ?? 0)),
      shareIssue: Math.max(0, fin.shareIssuance ?? 0),
      shareBuyback: Math.abs(Math.min(0, fin.shareIssuance ?? 0)),
      dividend: fin.dividends ?? 0,
    },
  }
}

// ============================================================================
// ISSUE DETECTION
// ============================================================================

interface Issue {
  type: 'BUG' | 'WARNING' | 'IMBALANCE' | 'TUNING'
  severity: 'critical' | 'high' | 'medium' | 'low'
  round: number
  teamId?: string
  teamName?: string
  description: string
  details: string
  suggestedFix?: string
}

class IssueDetector {
  private issues: Issue[] = []

  check(results: RoundAuditResults, teamIdMap: Map<number, string>) {
    this.checkNegativeValues(results, teamIdMap)
    this.checkUnrealisticMargins(results, teamIdMap)
    this.checkMarketShareImbalance(results)
    this.checkCapacityUtilization(results, teamIdMap)
    this.checkFinancialHealth(results, teamIdMap)
    this.checkInventoryLogic(results, teamIdMap)
    this.checkBalanceSheetEquality(results, teamIdMap)
  }

  private checkNegativeValues(results: RoundAuditResults, teamIdMap: Map<number, string>) {
    results.teams.forEach(team => {
      if (team.balanceSheet.cash < 0) {
        this.issues.push({
          type: 'BUG',
          severity: 'critical',
          round: results.round,
          teamId: teamIdMap.get(team.teamId),
          teamName: team.teamName,
          description: 'Negative cash balance',
          details: `Cash: $${team.balanceSheet.cash.toLocaleString()}`,
          suggestedFix: 'Add automatic short-term borrowing when cash goes negative',
        })
      }

      if (team.gameState.inventory < 0) {
        this.issues.push({
          type: 'BUG',
          severity: 'critical',
          round: results.round,
          teamId: teamIdMap.get(team.teamId),
          teamName: team.teamName,
          description: 'Negative inventory',
          details: `Inventory: ${team.gameState.inventory.toLocaleString()} units`,
          suggestedFix: 'Clamp inventory to 0 in calculateRound()',
        })
      }

      if (team.balanceSheet.totalEquity < 0) {
        this.issues.push({
          type: 'WARNING',
          severity: 'high',
          round: results.round,
          teamId: teamIdMap.get(team.teamId),
          teamName: team.teamName,
          description: 'Negative equity (technically bankrupt)',
          details: `Equity: $${team.balanceSheet.totalEquity.toLocaleString()}`,
          suggestedFix: 'Consider bankruptcy rules or forced equity issuance',
        })
      }
    })
  }

  private checkUnrealisticMargins(results: RoundAuditResults, teamIdMap: Map<number, string>) {
    results.teams.forEach(team => {
      // grossMargin is already stored as a percentage (e.g., 32.5 for 32.5%)
      const grossMargin = team.pnl.grossMargin

      if (grossMargin > 70) {
        this.issues.push({
          type: 'TUNING',
          severity: 'medium',
          round: results.round,
          teamId: teamIdMap.get(team.teamId),
          teamName: team.teamName,
          description: 'Unrealistically high gross margin',
          details: `Gross margin: ${grossMargin.toFixed(1)}% (industry norm: 30-50%)`,
          suggestedFix: 'Review gross margin calculation: should be grossProfit/revenue not grossProfit/cogs',
        })
      }

      if (grossMargin < 0) {
        this.issues.push({
          type: 'WARNING',
          severity: 'high',
          round: results.round,
          teamId: teamIdMap.get(team.teamId),
          teamName: team.teamName,
          description: 'Negative gross margin (selling below cost)',
          details: `Gross margin: ${grossMargin.toFixed(1)}%`,
          suggestedFix: 'Check price vs unit cost calculation',
        })
      }
    })
  }

  private checkMarketShareImbalance(results: RoundAuditResults) {
    const shares = results.teams.map(t => ({
      name: t.teamName,
      total: t.marketShare.us + t.marketShare.asia + t.marketShare.europe,
    }))

    const maxShare = Math.max(...shares.map(s => s.total))
    const minShare = Math.min(...shares.map(s => s.total))

    if (maxShare > minShare * 3 && results.round >= 2) {
      const winner = shares.find(s => s.total === maxShare)
      this.issues.push({
        type: 'IMBALANCE',
        severity: 'medium',
        round: results.round,
        description: 'Market share heavily skewed',
        details: `${winner?.name} has ${maxShare.toFixed(1)}% vs lowest ${minShare.toFixed(1)}%`,
        suggestedFix: 'Review attractiveness scoring weights',
      })
    }
  }

  private checkCapacityUtilization(results: RoundAuditResults, teamIdMap: Map<number, string>) {
    results.teams.forEach(team => {
      const capacity = team.capacity.totalCapacity
      const sold = team.sales.total.units
      const utilization = capacity > 0 ? (sold / capacity) * 100 : 0

      if (utilization < 40 && results.round >= 2) {
        this.issues.push({
          type: 'WARNING',
          severity: 'low',
          round: results.round,
          teamId: teamIdMap.get(team.teamId),
          teamName: team.teamName,
          description: 'Very low capacity utilization',
          details: `Utilization: ${utilization.toFixed(1)}% (sold ${sold.toLocaleString()} of ${capacity.toLocaleString()})`,
          suggestedFix: 'Check demand allocation or reduce capacity costs',
        })
      }
    })
  }

  private checkFinancialHealth(results: RoundAuditResults, teamIdMap: Map<number, string>) {
    results.teams.forEach(team => {
      const debtToEquity = team.ratios.debtToEquity

      if (debtToEquity > 2) {
        this.issues.push({
          type: 'WARNING',
          severity: 'medium',
          round: results.round,
          teamId: teamIdMap.get(team.teamId),
          teamName: team.teamName,
          description: 'Excessive debt levels',
          details: `Debt/Equity: ${debtToEquity.toFixed(2)}x`,
          suggestedFix: 'Consider borrowing limits or interest rate penalties',
        })
      }
    })
  }

  private checkInventoryLogic(results: RoundAuditResults, teamIdMap: Map<number, string>) {
    results.teams.forEach(team => {
      const trace = team.audit?.trace
      if (!trace) return

      const inventoryTrace = (trace as { inventory?: { availableUnits: number; endingUnits: number } }).inventory
      if (!inventoryTrace) return

      const { availableUnits, endingUnits } = inventoryTrace
      const soldUnits = team.sales.total.units

      const expectedEnding = availableUnits - soldUnits
      if (Math.abs(expectedEnding - endingUnits) > 1) {
        this.issues.push({
          type: 'BUG',
          severity: 'high',
          round: results.round,
          teamId: teamIdMap.get(team.teamId),
          teamName: team.teamName,
          description: 'Inventory calculation mismatch',
          details: `Expected: ${expectedEnding.toLocaleString()}, Got: ${endingUnits.toLocaleString()}`,
          suggestedFix: 'Review inventory calculation in calculateRoundAudit()',
        })
      }
    })
  }

  private checkBalanceSheetEquality(results: RoundAuditResults, teamIdMap: Map<number, string>) {
    results.teams.forEach(team => {
      const bs = team.balanceSheet
      const totalLiabilitiesEquity = bs.totalLiabilities + bs.totalEquity

      const diff = Math.abs(bs.totalAssets - totalLiabilitiesEquity)
      if (diff > 1) {
        this.issues.push({
          type: 'BUG',
          severity: 'critical',
          round: results.round,
          teamId: teamIdMap.get(team.teamId),
          teamName: team.teamName,
          description: 'Balance sheet does not balance',
          details: `Assets: $${bs.totalAssets.toLocaleString()} != L+E: $${totalLiabilitiesEquity.toLocaleString()} (diff: $${diff.toLocaleString()})`,
          suggestedFix: 'Review calculateBalanceSheet() function',
        })
      }
    })
  }

  getIssues(): Issue[] {
    return this.issues
  }
}

// ============================================================================
// LOGGING
// ============================================================================

class SimulationLogger {
  private lines: string[] = []
  private verbose: boolean

  constructor(verbose: boolean) {
    this.verbose = verbose
  }

  log(message: string) {
    this.lines.push(message)
    if (this.verbose) console.log(message)
  }

  section(title: string) {
    const sep = '='.repeat(80)
    this.log('')
    this.log(sep)
    this.log(`  ${title}`)
    this.log(sep)
  }

  subsection(title: string) {
    this.log('')
    this.log(`--- ${title} ---`)
  }

  getOutput(): string {
    return this.lines.join('\n')
  }
}

// ============================================================================
// MAIN SIMULATION
// ============================================================================

async function runSimulation(config: SimulationConfig) {
  const logger = new SimulationLogger(config.verbose)
  const detector = new IssueDetector()
  const gameConfig = getGameConfigForIndustry(config.industry)
  const startingFinancials = getBalancedStartingFinancials(gameConfig)

  logger.section('BONOPOLY DATABASE SIMULATION')
  logger.log(`Configuration:`)
  logger.log(`  Teams: ${config.teams}`)
  logger.log(`  Rounds: ${config.rounds}`)
  logger.log(`  Output: ${config.outputDir}`)
  logger.log(`  Industry: ${config.industry}`)

  // Generate scenario sequence from game engine config
  const scenarioSequence = config.scenarioSequence ??
    Array.from({ length: config.rounds }, (_, i) => i % Object.keys(SCENARIOS).length)

  logger.log(`  Scenarios: ${scenarioSequence.map((s, i) => `R${i + 1}=${SCENARIOS[s]?.name ?? 'Unknown'}`).join(', ')}`)

  // ========== CREATE GAME IN DATABASE ==========
  logger.section('CREATING GAME IN DATABASE')

  const gameCode = generateGameCode()
  const gamePin = generatePin()

  const game = await prisma.game.create({
    data: {
      gameCode,
      gamePin,
      name: `Simulation Test ${new Date().toISOString().split('T')[0]}`,
      status: GameStatus.ACTIVE,
      companyName: gameConfig.initialFactories.us > 0 ? 'TechCorp' : 'SimCorp',
      industry: config.industry,
      totalRounds: config.rounds,
      currentRound: 0,
      startingCash: gameConfig.financial.startingCash,
      startingFactoriesUS: gameConfig.initialFactories.us,
      startingFactoriesAsia: gameConfig.initialFactories.asia,
      capacityPerFactory: gameConfig.capacityPerPlant,
      scenarioSequence,
      startedAt: new Date(),
    },
  })

  logger.log(`  Game ID: ${game.id}`)
  logger.log(`  Game Code: ${gameCode}`)
  logger.log(`  Game PIN: ${gamePin}`)

  // ========== CREATE TEAMS ==========
  const teamNames = ['Alpha Corp', 'Beta Industries', 'Gamma Tech', 'Delta Holdings', 'Epsilon Inc', 'Zeta Ltd']
  const teamColors = ['#1e3a5f', '#2e7d32', '#c62828', '#6a1b9a', '#ef6c00', '#00838f']
  const teamPrefixes = ['ALPHA', 'BETA', 'GAMMA', 'DELTA', 'EPSI', 'ZETA']

  const dbTeams: { id: string; teamCode: string; teamPin: string; name: string; displayOrder: number }[] = []
  const teamIdMap = new Map<number, string>() // Maps engine teamId (1,2,3...) to DB UUID

  logger.subsection('TEAMS CREATED')
  for (let i = 0; i < config.teams; i++) {
    const teamCode = generateTeamCode(teamPrefixes[i] ?? `T${i + 1}`)
    const teamPin = generatePin()

    const team = await prisma.team.create({
      data: {
        gameId: game.id,
        teamCode,
        teamPin,
        name: teamNames[i] ?? `Team ${i + 1}`,
        color: teamColors[i] ?? '#666666',
        displayOrder: i,
        isComputer: false,
      },
    })

    dbTeams.push({ id: team.id, teamCode, teamPin, name: team.name, displayOrder: i })
    teamIdMap.set(i + 1, team.id)

    // Create initial game state (round -1)
    await prisma.gameState.create({
      data: {
        teamId: team.id,
        roundNumber: -1,
        factoriesUS: gameConfig.initialFactories.us,
        factoriesAsia: gameConfig.initialFactories.asia,
        unlockedTechLevel: 1,
        unlockedFeatures: 0,
        cumulativeResearchHours: 0,
        brandReputation: 50,
        inventory: gameConfig.financial.startingInventoryUnits,
        cashBalance: startingFinancials.startingCash,
        longTermDebt: startingFinancials.startingDebt,
        shareCapital: startingFinancials.startingShareCapital,
        retainedEarnings: 0,
      },
    })

    logger.log(`  ${i + 1}. ${team.name.padEnd(16)} | Code: ${teamCode} | PIN: ${teamPin}`)
  }

  // ========== RUN SIMULATION ROUNDS ==========
  const engineGameStates = new Map<number, TeamGameState>()
  const allResults: RoundAuditResults[] = []

  // Initialize engine states
  for (let i = 0; i < config.teams; i++) {
    engineGameStates.set(i + 1, createInitialGameState(gameConfig))
  }

  for (let round = 1; round <= config.rounds; round++) {
    const scenarioId = scenarioSequence[round - 1] ?? 0
    const scenario = SCENARIOS[scenarioId] ?? SCENARIOS[0]

    logger.section(`ROUND ${round} - ${scenario.name}`)

    // Create round record
    const dbRound = await prisma.round.create({
      data: {
        gameId: game.id,
        roundNumber: round,
        status: RoundStatus.ACTIVE,
        scenarioId,
        startedAt: new Date(),
      },
    })

    // Generate and save decisions for each team
    const engineTeams: TeamState[] = []

    for (let i = 0; i < config.teams; i++) {
      const engineTeamId = i + 1
      const dbTeam = dbTeams[i]
      const gameState = engineGameStates.get(engineTeamId)!

      const decisions = createDecisionsForTeam(i, round, gameState, scenarioId, gameConfig)
      const dbDecisions = mapEngineDecisionToDb(decisions)

      // Save decision to database
      await prisma.decision.create({
        data: {
          teamId: dbTeam.id,
          roundNumber: round,
          isSubmitted: true,
          isLocked: true,
          submittedAt: new Date(),
          production: dbDecisions.production as Prisma.InputJsonValue,
          hr: dbDecisions.hr as Prisma.InputJsonValue,
          rnd: dbDecisions.rnd as Prisma.InputJsonValue,
          investment: dbDecisions.investment as Prisma.InputJsonValue,
          logistics: dbDecisions.logistics as Prisma.InputJsonValue,
          marketing: dbDecisions.marketing as Prisma.InputJsonValue,
          finance: dbDecisions.finance as Prisma.InputJsonValue,
        },
      })

      engineTeams.push({
        id: engineTeamId,
        name: dbTeam.name,
        decisions,
      })
    }

    // Calculate round using ACTUAL GAME ENGINE
    const roundResults = calculateRoundAudit(
      engineTeams,
      round,
      engineGameStates,
      scenarioSequence.slice(0, round),
      1,
      gameConfig
    )

    allResults.push(roundResults)

    // Update round with market demand
    await prisma.round.update({
      where: { id: dbRound.id },
      data: {
        status: RoundStatus.COMPLETED,
        completedAt: new Date(),
        marketDemand: {
          us: roundResults.marketDemand.us,
          asia: roundResults.marketDemand.asia,
          europe: roundResults.marketDemand.europe,
        },
      },
    })

    // Save results for each team
    const sortedByTSR = [...roundResults.teams].sort((a, b) => b.kpis.tsr - a.kpis.tsr)

    for (let i = 0; i < roundResults.teams.length; i++) {
      const teamResult = roundResults.teams[i]
      const dbTeamId = teamIdMap.get(teamResult.teamId)!
      const rank = sortedByTSR.findIndex(t => t.teamId === teamResult.teamId) + 1

      // Save TeamRoundResult
      await prisma.teamRoundResult.create({
        data: {
          teamId: dbTeamId,
          gameId: game.id,
          roundNumber: round,
          rank,
          tsr: teamResult.kpis.tsr,
          salesUnitsUS: teamResult.sales.us.units,
          salesUnitsAsia: teamResult.sales.asia.units,
          salesUnitsEurope: teamResult.sales.europe.units,
          salesRevenueTotal: teamResult.sales.total.revenue,
          marketShareUS: teamResult.marketShare.us,
          marketShareAsia: teamResult.marketShare.asia,
          marketShareEurope: teamResult.marketShare.europe,
          revenue: teamResult.pnl.revenue,
          grossProfit: teamResult.pnl.grossProfit,
          ebitda: teamResult.pnl.ebitda,
          netProfit: teamResult.pnl.netProfit,
          totalAssets: teamResult.balanceSheet.totalAssets,
          totalEquity: teamResult.balanceSheet.totalEquity,
          cash: teamResult.balanceSheet.cash,
          sharePrice: teamResult.kpis.sharePrice,
          eps: teamResult.kpis.eps,
          roe: teamResult.ratios.roe,
          fullResults: teamResult as Prisma.InputJsonValue,
        },
      })

      // Save GameState for this round
      await prisma.gameState.create({
        data: {
          teamId: dbTeamId,
          roundNumber: round,
          factoriesUS: teamResult.gameState.factories.us,
          factoriesAsia: teamResult.gameState.factories.asia,
          pendingInvestments: teamResult.gameState.pendingInvestments as Prisma.InputJsonValue,
          unlockedTechLevel: teamResult.gameState.rndProgress.unlockedTechLevel,
          unlockedFeatures: teamResult.gameState.rndProgress.unlockedFeatureCount,
          cumulativeResearchHours: teamResult.gameState.rndProgress.cumulativeResearchHours,
          brandReputation: teamResult.gameState.brandReputation,
          inventory: teamResult.gameState.inventory,
          cashBalance: teamResult.balanceSheet.cash,
          longTermDebt: teamResult.balanceSheet.longTermDebt,
          shareCapital: teamResult.balanceSheet.shareCapital,
          retainedEarnings: teamResult.balanceSheet.retainedEarnings,
        },
      })

      // Update engine state for next round
      engineGameStates.set(teamResult.teamId, {
        ...teamResult.gameState,
        previousRoundResults: teamResult,
      })

      logger.log(`  ${teamResult.teamName}: Revenue $${(teamResult.pnl.revenue / 1_000_000).toFixed(1)}M, Profit $${(teamResult.pnl.netProfit / 1_000_000).toFixed(1)}M, TSR ${(teamResult.kpis.tsr * 100).toFixed(1)}%`)
    }

    // Check for issues
    detector.check(roundResults, teamIdMap)

    // Update game current round
    await prisma.game.update({
      where: { id: game.id },
      data: { currentRound: round },
    })
  }

  await prisma.game.update({
    where: { id: game.id },
    data: {
      status: GameStatus.COMPLETED,
      currentRound: config.rounds,
      roundDeadline: null,
      completedAt: new Date(),
    },
  })

  // Mark game complete
  await prisma.game.update({
    where: { id: game.id },
    data: {
      status: GameStatus.COMPLETED,
      completedAt: new Date(),
    },
  })

  // ========== OUTPUT RESULTS ==========
  logger.section('SIMULATION COMPLETE')

  logger.subsection('LOGIN CREDENTIALS')
  logger.log('')
  logger.log(`  EDUCATOR LOGIN:`)
  logger.log(`    Game Code: ${gameCode}`)
  logger.log(`    Game PIN:  ${gamePin}`)
  logger.log('')
  logger.log(`  TEAM LOGINS:`)
  dbTeams.forEach((t, i) => {
    logger.log(`    ${i + 1}. ${t.name.padEnd(16)} | Code: ${t.teamCode} | PIN: ${t.teamPin}`)
  })
  logger.log('')
  logger.log(`  LOGIN URL: http://localhost:5173/team-login`)
  logger.log(`  EDUCATOR URL: http://localhost:5173/educator-login`)

  // Issues report
  const issues = detector.getIssues()
  if (issues.length > 0) {
    logger.subsection(`ISSUES DETECTED (${issues.length})`)
    issues.forEach((issue, i) => {
      logger.log('')
      logger.log(`  [${issue.type}] #${i + 1}: ${issue.description}`)
      logger.log(`    Round: ${issue.round}${issue.teamName ? `, Team: ${issue.teamName}` : ''}`)
      logger.log(`    Severity: ${issue.severity}`)
      logger.log(`    Details: ${issue.details}`)
      if (issue.suggestedFix) {
        logger.log(`    Suggested Fix: ${issue.suggestedFix}`)
      }
    })
  } else {
    logger.log('')
    logger.log('  ✓ No issues detected!')
  }

  // Final standings
  const finalResults = allResults[allResults.length - 1]
  logger.subsection('FINAL STANDINGS')
  const standings = [...finalResults.teams]
    .sort((a, b) => b.pnl.netProfit - a.pnl.netProfit)
    .map((t, i) => ({ rank: i + 1, ...t }))

  logger.log('')
  logger.log('Rank | Team            | Revenue        | Net Profit     | Share Price | TSR')
  logger.log('-----|-----------------|----------------|----------------|-------------|--------')
  standings.forEach(t => {
    logger.log(`${t.rank.toString().padStart(4)} | ${t.teamName.padEnd(15)} | $${t.pnl.revenue.toLocaleString().padStart(13)} | $${t.pnl.netProfit.toLocaleString().padStart(13)} | $${t.kpis.sharePrice.toFixed(2).padStart(10)} | ${(t.kpis.tsr * 100).toFixed(1).padStart(5)}%`)
  })

  // Save outputs
  if (!fs.existsSync(config.outputDir)) {
    fs.mkdirSync(config.outputDir, { recursive: true })
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')

  // Save log
  const logPath = path.join(config.outputDir, `simulation_${timestamp}.log`)
  fs.writeFileSync(logPath, logger.getOutput())
  console.log(`\nLog saved: ${logPath}`)

  // Save issues report
  if (issues.length > 0) {
    const issuesPath = path.join(config.outputDir, `ISSUES_${timestamp}.md`)
    let md = `# Simulation Issues Report\n\nGame Code: ${gameCode}\nGenerated: ${new Date().toISOString()}\n\n`
    md += `## Summary\n- Total: ${issues.length}\n- Critical: ${issues.filter(i => i.severity === 'critical').length}\n- High: ${issues.filter(i => i.severity === 'high').length}\n- Medium: ${issues.filter(i => i.severity === 'medium').length}\n- Low: ${issues.filter(i => i.severity === 'low').length}\n\n`
    md += `## Issues\n\n`
    issues.forEach((issue, i) => {
      md += `### ${i + 1}. [${issue.type}] ${issue.description}\n- **Severity**: ${issue.severity}\n- **Round**: ${issue.round}\n`
      if (issue.teamName) md += `- **Team**: ${issue.teamName}\n`
      md += `- **Details**: ${issue.details}\n`
      if (issue.suggestedFix) md += `- **Fix**: ${issue.suggestedFix}\n`
      md += '\n'
    })
    fs.writeFileSync(issuesPath, md)
    console.log(`Issues saved: ${issuesPath}`)
  }

  // Save JSON
  const jsonPath = path.join(config.outputDir, `results_${timestamp}.json`)
  fs.writeFileSync(jsonPath, JSON.stringify({
    game: { id: game.id, gameCode, gamePin },
    teams: dbTeams,
    config,
    issues,
    results: allResults,
  }, null, 2))
  console.log(`JSON saved: ${jsonPath}`)

  return { game, teams: dbTeams, issues, results: allResults }
}

// ============================================================================
// ENTRY POINT
// ============================================================================

async function main() {
  const config = parseArgs()

  console.log('\n🎮 Starting Bonopoly Database Simulation...\n')

  try {
    const { game, teams, issues } = await runSimulation(config)

    console.log('\n' + '='.repeat(80))
    console.log('  QUICK REFERENCE')
    console.log('='.repeat(80))
    console.log(`\n  Game Code: ${game.gameCode}  |  PIN: ${game.gamePin}`)
    console.log('')
    teams.forEach((t, i) => {
      console.log(`  Team ${i + 1}: ${t.teamCode} / ${t.teamPin}`)
    })
    console.log('')

    if (issues.length > 0) {
      console.log(`⚠️  Found ${issues.length} issues - check output folder for details\n`)
    } else {
      console.log('✅ No issues detected!\n')
    }

  } catch (error) {
    console.error('\n❌ Simulation failed:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
