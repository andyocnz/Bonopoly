import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
type ProductionLike = { usUnits?: number }

async function check() {
  const game = await prisma.game.findFirst({
    where: { gameCode: { startsWith: 'SIM-' } },
    orderBy: { createdAt: 'desc' },
    include: { teams: true, rounds: true }
  })

  if (!game) {
    console.log('No simulation games found')
    await prisma.$disconnect()
    return
  }

  console.log('=== GAME ===')
  console.log('Code:', game.gameCode, 'Status:', game.status, 'CurrentRound:', game.currentRound)
  console.log('Teams:', game.teams.length)
  console.log('Rounds:', game.rounds.map(r => `R${r.roundNumber}:${r.status}`).join(', '))

  const results = await prisma.teamRoundResult.findMany({
    where: { gameId: game.id },
    orderBy: [{ roundNumber: 'asc' }]
  })
  console.log('\n=== RESULTS ===')
  console.log('Count:', results.length)
  results.slice(0, 6).forEach(r => {
    console.log(`  R${r.roundNumber} Team ${r.teamId.slice(0,8)}: Revenue $${(r.revenue/1e6).toFixed(1)}M, Profit $${(r.netProfit/1e6).toFixed(1)}M`)
  })

  const decisions = await prisma.decision.findMany({
    where: { team: { gameId: game.id } },
    orderBy: [{ roundNumber: 'asc' }]
  })
  console.log('\n=== DECISIONS ===')
  console.log('Count:', decisions.length)
  decisions.slice(0, 6).forEach(d => {
    const prod = d.production as ProductionLike | null
    console.log(`  R${d.roundNumber} Team ${d.teamId.slice(0,8)}: Submitted=${d.isSubmitted}, US Units=${prod?.usUnits ?? 'N/A'}`)
  })

  await prisma.$disconnect()
}

check()
