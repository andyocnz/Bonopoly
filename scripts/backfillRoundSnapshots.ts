import { PrismaClient } from '@prisma/client'
import { SCENARIOS, getGameConfigForIndustry } from '../src/engine/gameEngine'

type ScenarioSnapshot = {
  costInflation?: number
  investmentCostMultiplier?: number
  workingCapitalDelta?: { inventory?: number; receivable?: number; payable?: number }
}

const prisma = new PrismaClient()

const getScenarioSnapshot = (roundNumber: number, scenarioSequence: number[] | null | undefined) => {
  if (roundNumber < 0) return null
  const scenarioId = scenarioSequence?.[roundNumber] ?? 0
  return SCENARIOS[scenarioId] ?? SCENARIOS[0]
}

const normalizeWorkingCapital = (value: ScenarioSnapshot['workingCapitalDelta']) => ({
  inventory: value?.inventory ?? 0,
  receivable: value?.receivable ?? 0,
  payable: value?.payable ?? 0,
})

const main = async () => {
  const games = await prisma.game.findMany({
    select: {
      id: true,
      industry: true,
      capacityPerFactory: true,
      scenarioSequence: true,
    },
  })

  let updated = 0
  for (const game of games) {
    const gameConfig = getGameConfigForIndustry(
      game.industry,
      game.capacityPerFactory ? { capacityPerPlant: game.capacityPerFactory } : undefined
    )
    const results = await prisma.teamRoundResult.findMany({
      where: { gameId: game.id },
      select: { id: true, roundNumber: true, fullResults: true },
    })

    for (const result of results) {
      const full = (result.fullResults ?? {}) as Record<string, unknown>
      const scenarioSnapshot =
        (full.scenarioSnapshot as ScenarioSnapshot | null)
        ?? getScenarioSnapshot(result.roundNumber, game.scenarioSequence as number[] | null | undefined)
      const needsPlantUS = full.plantCostUSUsed === undefined
      const needsPlantAsia = full.plantCostAsiaUsed === undefined
      const needsInvestMult = full.investmentCostMultiplierUsed === undefined
      const needsCostInflation = full.costInflationUsed === undefined
      const needsWorkingCapital = full.workingCapitalDeltaUsed === undefined
      if (!needsPlantUS && !needsPlantAsia && !needsInvestMult && !needsCostInflation && !needsWorkingCapital) {
        continue
      }

      const nextFull = {
        ...full,
        plantCostUSUsed: needsPlantUS ? (gameConfig.investment?.plantCostUS ?? 0) : full.plantCostUSUsed,
        plantCostAsiaUsed: needsPlantAsia ? (gameConfig.investment?.plantCostAsia ?? 0) : full.plantCostAsiaUsed,
        investmentCostMultiplierUsed: needsInvestMult ? (scenarioSnapshot?.investmentCostMultiplier ?? 1) : full.investmentCostMultiplierUsed,
        costInflationUsed: needsCostInflation ? (scenarioSnapshot?.costInflation ?? 1) : full.costInflationUsed,
        workingCapitalDeltaUsed: needsWorkingCapital
          ? normalizeWorkingCapital(scenarioSnapshot?.workingCapitalDelta)
          : full.workingCapitalDeltaUsed,
      }

      await prisma.teamRoundResult.update({
        where: { id: result.id },
        data: { fullResults: nextFull },
      })
      updated += 1
    }
  }

  console.log(`Backfill complete. Updated ${updated} round result(s).`)
}

main()
  .catch((error) => {
    console.error('Backfill failed:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
