import { PrismaClient } from '@prisma/client'
import { calculateRoundAudit, getGameConfigForIndustry } from '../src/engine/gameEngine'
import type { TeamDecisions, TeamState } from '../src/components/DecisionSimulator'

type RegionKey = 'us' | 'asia' | 'europe'

const prisma = new PrismaClient()

const formatNum = (value: number) => new Intl.NumberFormat('en-US').format(Math.round(value))
const formatPct = (value: number) => `${value.toFixed(2)}%`

const regionOrder: RegionKey[] = ['us', 'asia', 'europe']

type DbDecisionLike = {
  production?: Record<string, unknown>
  hr?: Record<string, unknown>
  rnd?: Record<string, unknown>
  investment?: Record<string, unknown>
  logistics?: Record<string, unknown>
  marketing?: Record<string, unknown>
  finance?: Record<string, unknown>
}

type FullResultsLike = {
  audit?: {
    trace?: {
      demand?: {
        marketDemand?: Partial<Record<RegionKey, number>>
        idealSharePct?: Partial<Record<RegionKey, number>>
        desiredUnits?: Partial<Record<RegionKey, number>>
      }
      inventory?: {
        startingUnits?: number
        productionUnits?: number
        availableUnits?: number
        endingUnits?: number
      }
    }
  }
  sales?: {
    us?: { units?: number; unmetDemand?: number; price?: number }
    asia?: { units?: number; unmetDemand?: number; price?: number }
    europe?: { units?: number; unmetDemand?: number; price?: number }
    total?: { units?: number }
  }
  productionUnits?: number
}

async function run() {
  const gameCode = process.argv[2]
  const roundArg = process.argv[3]
  if (!gameCode || !roundArg) {
    console.log('Usage: npx tsx simulation-test/explain-round.ts <GAME_CODE> <ROUND_NUMBER>')
    return
  }

  const roundNumber = Number(roundArg)
  if (Number.isNaN(roundNumber)) {
    console.log('Round number must be a valid number.')
    return
  }

  const game = await prisma.game.findUnique({
    where: { gameCode },
    include: { teams: true },
  })

  if (!game) {
    console.log(`Game not found: ${gameCode}`)
    return
  }

  const results = await prisma.teamRoundResult.findMany({
    where: { gameId: game.id, roundNumber },
    include: { team: { select: { id: true, name: true } } },
  })

  if (results.length === 0) {
    console.log(`No results for ${gameCode} round ${roundNumber}.`)
    return
  }

  console.log(`\n=== ${gameCode} Round ${roundNumber} Units Sold Explanation ===`)
  results.forEach((row) => {
    const full = (row.fullResults || {}) as FullResultsLike
    const audit = full.audit || {}
    const trace = audit.trace || {}
    const demandTrace = trace.demand || {}
    const inventoryTrace = trace.inventory || {}
    const sales = full.sales || {}

    console.log(`\n-- ${row.team.name} (DB Results) --`)

    regionOrder.forEach((region) => {
      const demand = demandTrace.marketDemand?.[region] ?? 0
      const sharePct = demandTrace.idealSharePct?.[region] ?? 0
      const desiredUnits = demandTrace.desiredUnits?.[region] ?? 0
      const soldUnits = sales?.[region]?.units ?? 0
      const unmet = sales?.[region]?.unmetDemand ?? 0
      const price = sales?.[region]?.price ?? 0

      console.log(
        `${region.toUpperCase()}: Demand ${formatNum(demand)} | Share ${formatPct(sharePct)} | Desired ${formatNum(desiredUnits)} | Sold ${formatNum(soldUnits)} | Unmet ${formatNum(unmet)} | Price ${formatNum(price)}`
      )
    })

    const startingInventory = inventoryTrace.startingUnits ?? 0
    const productionUnits = inventoryTrace.productionUnits ?? full.productionUnits ?? 0
    const availableUnits = inventoryTrace.availableUnits ?? startingInventory + productionUnits
    const endingInventory = inventoryTrace.endingUnits ?? 0
    const totalSold = sales?.total?.units ?? row.salesUnitsUS + row.salesUnitsAsia + row.salesUnitsEurope

    console.log(
      `Supply: Start Inv ${formatNum(startingInventory)} + Production ${formatNum(productionUnits)} = ${formatNum(availableUnits)} | Sold ${formatNum(totalSold)} | End Inv ${formatNum(endingInventory)}`
    )
  })

  const decisions = await prisma.decision.findMany({
    where: { team: { gameId: game.id }, roundNumber },
    include: { team: { select: { id: true, name: true, displayOrder: true } } },
    orderBy: [{ team: { displayOrder: 'asc' } }],
  })

  const toDecision = (decision: unknown): TeamDecisions => {
    const raw = (decision ?? {}) as DbDecisionLike
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
        productionLines: prod.productionLines || undefined,
        outsource: prod.outsource || undefined,
      },
      hr: {
        us: {
          employees: typeof hr.us?.employees === 'number' ? hr.us.employees : 50,
          wage: typeof hr.us?.wage === 'number' ? hr.us.wage : 5000,
          training: typeof hr.us?.training === 'number' ? hr.us.training : 0,
        },
        asia: {
          employees: typeof hr.asia?.employees === 'number' ? hr.asia.employees : 50,
          wage: typeof hr.asia?.wage === 'number' ? hr.asia.wage : 2000,
          training: typeof hr.asia?.training === 'number' ? hr.asia.training : 0,
        },
      },
      rnd: {
        featureInvestment: typeof rnd.featureInvestment === 'number' ? rnd.featureInvestment : 100,
      },
      investment: {
        newPlantsUS: typeof inv.newPlantsUS === 'number' ? inv.newPlantsUS : 0,
        newPlantsAsia: typeof inv.newPlantsAsia === 'number' ? inv.newPlantsAsia : 0,
      },
      logistics: log.allocation
        ? { allocation: log.allocation }
        : {
            usPriority: log.usPriority || ['us', 'europe', 'asia'],
            asiaPriority: log.asiaPriority || ['asia', 'europe', 'us'],
          },
      marketing: {
        us: {
          price: typeof mkt.priceUS === 'number' ? mkt.priceUS : 100,
          features: 0,
          promotionPct: typeof mkt.promoUS === 'number' ? mkt.promoUS : 0,
        },
        asia: {
          price: typeof mkt.priceAsia === 'number' ? mkt.priceAsia : 100,
          features: 0,
          promotionPct: typeof mkt.promoAsia === 'number' ? mkt.promoAsia : 0,
        },
        europe: {
          price: typeof mkt.priceEurope === 'number' ? mkt.priceEurope : 100,
          features: 0,
          promotionPct: typeof mkt.promoEurope === 'number' ? mkt.promoEurope : 0,
        },
      },
      finance: {
        transferPricing: fin.transferPricing || { us: 1, asia: 1, europe: 1 },
        longTermDebt: typeof fin.longTermDebt === 'number' ? fin.longTermDebt : 0,
        shareIssuance: typeof fin.shareIssuance === 'number' ? fin.shareIssuance : 0,
        dividends: typeof fin.dividends === 'number' ? fin.dividends : 0,
      },
    }
  }

  const teamStates: TeamState[] = decisions.map((decision, index) => ({
    id: index,
    name: decision.team.name,
    decisions: toDecision(decision),
  }))

  const config = getGameConfigForIndustry(game.industry)
  const engineAudit = calculateRoundAudit(
    teamStates,
    roundNumber,
    undefined,
    game.scenarioSequence,
    game.marketDemandMultiplier ?? 1,
    config
  )

  console.log(`\n=== ${gameCode} Round ${roundNumber} Units Sold (Engine Audit) ===`)
  engineAudit.teams.forEach((team) => {
    console.log(`\n-- ${team.teamName} (Engine) --`)
    regionOrder.forEach((region) => {
      const demand = engineAudit.marketDemand[region] ?? 0
      const sharePct = team.audit?.trace?.marketShare?.sharePct?.[region] ?? team.marketShare?.[region] ?? 0
      const desiredUnits = team.audit?.desiredUnits?.[region] ?? team.audit?.trace?.demand?.desiredUnits?.[region] ?? 0
      const soldUnits = team.sales?.[region]?.units ?? 0
      const unmet = team.sales?.[region]?.unmetDemand ?? 0
      const price = team.sales?.[region]?.price ?? 0

      console.log(
        `${region.toUpperCase()}: Demand ${formatNum(demand)} | Share ${formatPct(sharePct)} | Desired ${formatNum(desiredUnits)} | Sold ${formatNum(soldUnits)} | Unmet ${formatNum(unmet)} | Price ${formatNum(price)}`
      )
    })

    const inventoryTrace = team.audit?.trace?.inventory || {}
    const startingInventory = inventoryTrace.startingUnits ?? 0
    const productionUnits = inventoryTrace.productionUnits ?? team.productionUnits ?? 0
    const availableUnits = inventoryTrace.availableUnits ?? startingInventory + productionUnits
    const endingInventory = inventoryTrace.endingUnits ?? 0
    const totalSold = team.sales?.total?.units ?? 0

    console.log(
      `Supply: Start Inv ${formatNum(startingInventory)} + Production ${formatNum(productionUnits)} = ${formatNum(availableUnits)} | Sold ${formatNum(totalSold)} | End Inv ${formatNum(endingInventory)}`
    )
  })

  await prisma.$disconnect()
}

run().catch((error) => {
  console.error(error)
  prisma.$disconnect()
})
