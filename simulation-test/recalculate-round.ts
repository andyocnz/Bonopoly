import { PrismaClient } from '@prisma/client'
import { calculateRound, createInitialGameState, getGameConfigForIndustry } from '../src/engine/gameEngine'
import type { TeamDecisions, TeamState } from '../src/components/DecisionSimulator'
import type { TeamGameState } from '../src/engine/gameEngine'

const prisma = new PrismaClient()

type DecisionLike = {
  production?: Record<string, unknown>
  hr?: Record<string, unknown>
  rnd?: Record<string, unknown>
  investment?: Record<string, unknown>
  logistics?: Record<string, unknown>
  marketing?: Record<string, unknown>
  finance?: Record<string, unknown>
}

type GameStateLike = {
  factoriesUS?: number
  factoriesAsia?: number
  pendingInvestments?: TeamGameState['pendingInvestments']
  unlockedTechLevel?: number
  unlockedFeatures?: number
  cumulativeResearchHours?: number
  brandReputation?: number
  inventory?: number
}

const toDecision = (decision: unknown): TeamDecisions => {
  const raw = (decision ?? {}) as DecisionLike
  const prod = raw.production || {}
  const hr = raw.hr || {}
  const rnd = raw.rnd || {}
  const inv = raw.investment || {}
  const log = raw.logistics || {}
  const mkt = raw.marketing || {}
  const fin = raw.finance || {}

  return {
    production: {
      demandForecast: { us: 0, asia: 0, europe: 0 },
      techShareForecast: {
        us: { tech1: 100, tech2: 0, tech3: 0, tech4: 0 },
        asia: { tech1: 100, tech2: 0, tech3: 0, tech4: 0 },
        europe: { tech1: 100, tech2: 0, tech3: 0, tech4: 0 },
      },
      usUnits: typeof prod.usUnits === 'number' ? prod.usUnits : undefined,
      asiaUnits: typeof prod.asiaUnits === 'number' ? prod.asiaUnits : undefined,
      outsourceUS: typeof prod.outsourceUS === 'number' ? prod.outsourceUS : undefined,
      outsourceAsia: typeof prod.outsourceAsia === 'number' ? prod.outsourceAsia : undefined,
      overtime: typeof prod.overtime === 'number' ? prod.overtime : undefined,
      supplierUS: typeof prod.supplierUS === 'number' ? prod.supplierUS : undefined,
      supplierAsia: typeof prod.supplierAsia === 'number' ? prod.supplierAsia : undefined,
      productionLines: prod.productionLines,
      outsource: prod.outsource,
    },
    hr: {
      us: {
        employees: hr.researchStaff || rnd.researchStaff || 50,
        wage: 5000,
        training:
          (hr.trainingLevel || rnd.trainingLevel) === 'advanced'
            ? 100000
            : (hr.trainingLevel || rnd.trainingLevel) === 'standard'
              ? 50000
              : 0,
      },
      asia: {
        employees: 50,
        wage: 2000,
        training:
          (hr.trainingLevel || rnd.trainingLevel) === 'advanced'
            ? 60000
            : (hr.trainingLevel || rnd.trainingLevel) === 'standard'
              ? 30000
              : 0,
      },
    },
    rnd: {
      featureInvestment: 100,
    },
    investment: {
      newPlantsUS: inv.newPlantsUS || fin.newPlantsUS || 0,
      newPlantsAsia: inv.newPlantsAsia || fin.newPlantsAsia || 0,
    },
    logistics: {
      allocation: log.allocation || {
        us: { local: 100, fromAsia: 0 },
        asia: { local: 100, fromUS: 0 },
        europe: { fromUS: 50, fromAsia: 50 },
      },
    },
    marketing: {
      us: { price: mkt.priceUS || 125, features: 0, promotionPct: mkt.promoUS || 5 },
      asia: { price: mkt.priceAsia || 115, features: 0, promotionPct: mkt.promoAsia || 5 },
      europe: { price: mkt.priceEurope || 130, features: 0, promotionPct: mkt.promoEurope || 5 },
    },
    finance: {
      transferPricing: { us: 1.0, asia: 1.0, europe: 1.0 },
      longTermDebt: (fin.borrowing || 0) - (fin.repayment || 0),
      shareIssuance: (fin.shareIssue || 0) - (fin.shareBuyback || 0),
      dividends: fin.dividend || 0,
    },
  }
}

const toGameState = (state: unknown): TeamGameState => {
  const raw = (state ?? {}) as GameStateLike
  return ({
  factories: {
    us: raw.factoriesUS ?? 1,
    asia: raw.factoriesAsia ?? 0,
  },
  pendingInvestments: raw.pendingInvestments || [],
  rndProgress: {
    unlockedTechLevel: raw.unlockedTechLevel ?? 1,
    unlockedFeatureCount: raw.unlockedFeatures ?? 0,
    cumulativeResearchHours: raw.cumulativeResearchHours ?? 0,
  },
  cumulativeProduction: 0,
  brandReputation: raw.brandReputation ?? 50,
  inventory: raw.inventory ?? 0,
  })
}

async function run() {
  const gameCode = process.argv[2]
  const roundArg = process.argv[3]
  if (!gameCode || !roundArg) {
    console.log('Usage: npx tsx simulation-test/recalculate-round.ts <GAME_CODE> <ROUND_NUMBER>')
    return
  }

  const round = Number(roundArg)
  if (Number.isNaN(round) || round < 0) {
    console.log('Round number must be a valid number (>= 0).')
    return
  }

  const game = await prisma.game.findUnique({
    where: { gameCode },
    include: {
      teams: {
        orderBy: { displayOrder: 'asc' },
        include: { decisions: { where: { roundNumber: round } } },
      },
    },
  })

  if (!game) {
    console.log(`Game not found: ${gameCode}`)
    return
  }

  const prevRoundNumber = round === 0 ? -1 : round - 1
  const prevStates = await prisma.gameState.findMany({
    where: {
      teamId: { in: game.teams.map((t) => t.id) },
      roundNumber: prevRoundNumber,
    },
  })
  const prevStateMap = new Map<string, unknown>()
  prevStates.forEach((state) => prevStateMap.set(state.teamId, state))

  const prevRoundResults = round > 1
    ? await prisma.teamRoundResult.findMany({
        where: { gameId: game.id, roundNumber: round - 1 },
        select: { teamId: true, fullResults: true },
      })
    : []
  const prevRoundResultsMap = new Map<string, unknown>()
  prevRoundResults.forEach((row) => {
    if (row?.teamId) prevRoundResultsMap.set(row.teamId, row.fullResults)
  })

  const config = getGameConfigForIndustry(game.industry)
  const teamStates: TeamState[] = []
  const previousGameStates = new Map<number, TeamGameState>()

  game.teams.forEach((team, index) => {
    const decision = team.decisions[0]
    const decisions = decision ? toDecision(decision) : toDecision({})
    teamStates.push({ id: index, name: team.name, decisions })

    const prevState = prevStateMap.get(team.id)
    if (prevState) {
      const state = toGameState(prevState)
      if (prevRoundResultsMap.has(team.id)) {
        state.previousRoundResults = prevRoundResultsMap.get(team.id)
      }
      previousGameStates.set(index, state)
    } else {
      previousGameStates.set(index, createInitialGameState(config))
    }
  })

  const results = calculateRound(
    teamStates,
    round,
    previousGameStates,
    game.scenarioSequence,
    game.marketDemandMultiplier ?? 1,
    config
  )

  await prisma.$transaction(async (tx) => {
    await tx.round.upsert({
      where: { gameId_roundNumber: { gameId: game.id, roundNumber: round } },
      update: { marketDemand: results.marketDemand },
      create: {
        gameId: game.id,
        roundNumber: round,
        scenarioId: game.scenarioSequence?.[round] ?? 0,
        marketDemand: results.marketDemand,
      },
    })

    for (let i = 0; i < results.teams.length; i++) {
      const teamResult = results.teams[i]
      const dbTeam = game.teams[i]
      await tx.teamRoundResult.upsert({
        where: {
          teamId_roundNumber: { teamId: dbTeam.id, roundNumber: round },
        },
        update: {
          rank: i + 1,
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
          fullResults: teamResult,
        },
        create: {
          teamId: dbTeam.id,
          gameId: game.id,
          roundNumber: round,
          rank: i + 1,
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
          fullResults: teamResult,
        },
      })
    }
  })

  console.log(`Recalculated ${gameCode} round ${round} and saved results.`)
}

run().catch(console.error).finally(async () => prisma.$disconnect())
