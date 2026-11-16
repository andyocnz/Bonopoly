/**
 * Principal-Agent Engine — Moral Hazard
 *
 * All students are agents. Contract: fixed wage w + success bonus b.
 * Each round: agent chooses Low or High effort (High has effortCost).
 * Server generates stochastic outcome: High effort → pH success, Low → pL success.
 *
 * Agent payoff: w + b×(1 if success) − effortCost×(1 if high effort)
 */

export type PrincipalAgentConfig = {
  wage: number         // fixed wage w (default 10)
  bonus: number        // success bonus b (default 50)
  pH: number           // prob success | high effort (default 0.8)
  pL: number           // prob success | low effort (default 0.3)
  effortCost: number   // cost of high effort (default 20)
  rounds: number
  roundContracts?: Array<{
    wage: number
    bonus: number
    label?: string
  }>
}

export type EffortLevel = 'high' | 'low'

export type PrincipalAgentPlayer = {
  id: string
  name: string
  isBot: boolean
  totalScore: number
  hasActedThisRound: boolean
  effortThisRound?: EffortLevel
}

export type PrincipalAgentRoundSummary = {
  round: number
  results: Array<{
    playerId: string
    playerName: string
    effort: EffortLevel
    success: boolean
    wage: number
    bonusEarned: number
    effortCostPaid: number
    roundPayoff: number
  }>
}

export type PrincipalAgentSession = {
  roomCode: string
  hostToken: string
  phase: 'lobby' | 'playing' | 'results'
  config: PrincipalAgentConfig
  players: PrincipalAgentPlayer[]
  currentRound: number
  history: PrincipalAgentRoundSummary[]
  eventLog: string[]
  createdAt: number
  lastActivityAt: number
}

const SESSION_TTL_MS = 2 * 60 * 60 * 1000
const sessions = new Map<string, PrincipalAgentSession>()

export function getRoundContract(session: PrincipalAgentSession, roundNumber = session.currentRound): {
  wage: number
  bonus: number
  label?: string
} {
  const fromSchedule = session.config.roundContracts?.[Math.max(0, roundNumber - 1)]
  if (fromSchedule) {
    return {
      wage: fromSchedule.wage,
      bonus: fromSchedule.bonus,
      label: fromSchedule.label,
    }
  }
  return {
    wage: session.config.wage,
    bonus: session.config.bonus,
  }
}

export function cleanupPrincipalAgentSessions(): void {
  const now = Date.now()
  for (const [code, s] of sessions) {
    if (now - s.lastActivityAt > SESSION_TTL_MS) sessions.delete(code)
  }
}

export function addPrincipalAgentPlayer(
  session: PrincipalAgentSession,
  id: string,
  name: string,
  isBot = false
): PrincipalAgentPlayer {
  const player: PrincipalAgentPlayer = {
    id, name, isBot, totalScore: 0, hasActedThisRound: false,
  }
  session.players.push(player)
  session.eventLog.push(`${name} joined.`)
  if (session.eventLog.length > 40) session.eventLog.shift()
  return player
}

export function submitPrincipalAgentAction(
  session: PrincipalAgentSession,
  playerId: string,
  effort: EffortLevel
): { ok: boolean; error?: string } {
  const player = session.players.find(p => p.id === playerId)
  if (!player) return { ok: false, error: 'Player not found' }
  if (player.hasActedThisRound) return { ok: false, error: 'Already acted this round' }
  if (session.phase !== 'playing') return { ok: false, error: 'Game not active' }

  player.effortThisRound = effort
  player.hasActedThisRound = true
  session.eventLog.push(`${player.name} chose their effort level.`)
  if (session.eventLog.length > 40) session.eventLog.shift()
  return { ok: true }
}

export function isPrincipalAgentRoundComplete(session: PrincipalAgentSession): boolean {
  return session.players.filter(p => !p.isBot).every(p => p.hasActedThisRound)
}

export function processPrincipalAgentRound(session: PrincipalAgentSession): void {
  const { pH, pL, effortCost } = session.config
  const { wage, bonus } = getRoundContract(session)
  const expectedHigh = wage + bonus * pH - effortCost
  const expectedLow = wage + bonus * pL

  // Bots choose the effort with higher expected payoff under the current round contract.
  for (const bot of session.players.filter(p => p.isBot && !p.hasActedThisRound)) {
    bot.effortThisRound = expectedHigh >= expectedLow ? 'high' : 'low'
    bot.hasActedThisRound = true
  }

  const results: PrincipalAgentRoundSummary['results'] = []
  for (const p of session.players) {
    const effort: EffortLevel = p.effortThisRound ?? 'low'
    const successProb = effort === 'high' ? pH : pL
    const success = Math.random() < successProb
    const bonusEarned = success ? bonus : 0
    const effortCostPaid = effort === 'high' ? effortCost : 0
    const roundPayoff = wage + bonusEarned - effortCostPaid
    p.totalScore += roundPayoff
    results.push({
      playerId: p.id, playerName: p.name,
      effort, success, wage, bonusEarned, effortCostPaid, roundPayoff,
    })
  }

  session.history.push({ round: session.currentRound, results })
  session.eventLog.push(`Round ${session.currentRound}: outcomes revealed.`)
  if (session.eventLog.length > 40) session.eventLog.shift()

  for (const p of session.players) {
    p.hasActedThisRound = false
    p.effortThisRound = undefined
  }

  if (session.currentRound >= session.config.rounds) {
    session.phase = 'results'
    session.eventLog.push('Game complete!')
  } else {
    session.currentRound += 1
    const next = getRoundContract(session)
    const nextHigh = next.wage + next.bonus * session.config.pH - session.config.effortCost
    const nextLow = next.wage + next.bonus * session.config.pL
    session.eventLog.push(
      `Round ${session.currentRound} contract: wage ${next.wage}, bonus ${next.bonus}. Best response (expected): ${nextHigh >= nextLow ? 'High' : 'Low'} effort.`
    )
  }
}
