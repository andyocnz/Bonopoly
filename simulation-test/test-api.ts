import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
type RoundTeamSummary = {
  teamId: string
  teamName: string
  revenue: number
  netProfit: number
  tsr: number
}

async function testAPI() {
  // Get latest simulation game
  const game = await prisma.game.findFirst({
    where: { gameCode: { startsWith: 'SIM-' } },
    orderBy: { createdAt: 'desc' },
    include: { teams: true }
  })

  if (!game) {
    console.log('No simulation games found')
    await prisma.$disconnect()
    return
  }

  console.log('Game:', game.gameCode, 'Teams:', game.teams.length)

  const teamId = game.teams[0].id
  console.log('Testing with team:', game.teams[0].name, '(', teamId, ')')

  // Simulate what the API endpoint does
  const allResults = await prisma.teamRoundResult.findMany({
    where: { gameId: game.id },
    orderBy: [{ roundNumber: 'asc' }, { rank: 'asc' }],
    include: {
      team: { select: { id: true, name: true, teamCode: true } },
    },
  })

  console.log('\nTotal results in DB:', allResults.length)

  // Group by round
  const resultsByRound = new Map<number, RoundTeamSummary[]>()
  allResults.forEach((r) => {
    if (!resultsByRound.has(r.roundNumber)) {
      resultsByRound.set(r.roundNumber, [])
    }
    resultsByRound.get(r.roundNumber)!.push({
      teamId: r.team.id,
      teamName: r.team.name,
      revenue: r.revenue,
      netProfit: r.netProfit,
      tsr: r.tsr,
    })
  })

  console.log('\nResults grouped by round:')
  resultsByRound.forEach((teams, roundNumber) => {
    console.log(`\n  Round ${roundNumber}:`)
    teams.forEach(t => {
      console.log(`    ${t.teamName}: Revenue $${(t.revenue/1e6).toFixed(1)}M, TSR ${(t.tsr*100).toFixed(1)}%`)
    })
  })

  // Check what game.currentRound is
  console.log('\nGame currentRound:', game.currentRound)
  console.log('Game status:', game.status)

  // The frontend filters: roundNumber < currentRound
  console.log('\nRounds that would be shown (roundNumber < currentRound):')
  resultsByRound.forEach((teams, roundNumber) => {
    if (roundNumber < game.currentRound) {
      console.log(`  Round ${roundNumber}: ${teams.length} teams`)
    }
  })

  await prisma.$disconnect()
}

testAPI()
