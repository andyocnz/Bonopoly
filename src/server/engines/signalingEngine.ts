/**
 * Signaling Game Engine — Spence-style Education Signaling
 *
 * All students are workers randomly assigned High or Low type at session start.
 * Each round: worker chooses education level (0=none, 1=some, 2=full).
 * Server simulates employer who offers wage from a fixed wage schedule.
 *
 * Payoffs: wage(eduChoice) − (eduChoice × costPerLevel)
 *
 * Default wage schedule (separating equilibrium):
 *   Edu 0 → 50, Edu 1 → 50, Edu 2 → 100
 *
 * High type: cost=10/level.  Low type: cost=40/level.
 */

export type SignalingConfig = {
  wageSchedule: [number, number, number]  // wages for edu 0, 1, 2
  highTypeCost: number                    // cost per edu level for High types
  lowTypeCost: number                     // cost per edu level for Low types
  rounds: number
  roundScenarios?: Array<{
    label: string
    wageSchedule: [number, number, number]
    highTypeCost: number
    lowTypeCost: number
  }>
}

export type WorkerType = 'high' | 'low'

export type SignalingPlayer = {
  id: string
  name: string
  isBot: boolean
  workerType: WorkerType
  totalScore: number
  hasActedThisRound: boolean
  eduChoiceThisRound?: number   // 0 | 1 | 2
}

export type SignalingRoundSummary = {
  round: number
  results: Array<{
    playerId: string
    playerName: string
    workerType: WorkerType
    eduChoice: number
    wage: number
    cost: number
    roundPayoff: number
  }>
}

export type SignalingSession = {
  roomCode: string
  hostToken: string
  phase: 'lobby' | 'playing' | 'results'
  config: SignalingConfig
  players: SignalingPlayer[]
  currentRound: number
  history: SignalingRoundSummary[]
  eventLog: string[]
  createdAt: number
  lastActivityAt: number
}

const SESSION_TTL_MS = 2 * 60 * 60 * 1000
const sessions = new Map<string, SignalingSession>()

export function cleanupSignalingSessions(): void {
  const now = Date.now()
  for (const [code, s] of sessions) {
    if (now - s.lastActivityAt > SESSION_TTL_MS) sessions.delete(code)
  }
}

export function addSignalingPlayer(
  session: SignalingSession,
  id: string,
  name: string,
  isBot = false
): SignalingPlayer {
  const workerType: WorkerType = Math.random() < 0.5 ? 'high' : 'low'
  const player: SignalingPlayer = {
    id, name, isBot, workerType,
    totalScore: 0,
    hasActedThisRound: false,
  }
  session.players.push(player)
  session.eventLog.push(`${name} joined as a ${workerType === 'high' ? 'High' : 'Low'}-type worker.`)
  if (session.eventLog.length > 40) session.eventLog.shift()
  return player
}

export function getSignalingScenario(session: SignalingSession): {
  label: string
  wageSchedule: [number, number, number]
  highTypeCost: number
  lowTypeCost: number
} {
  const scenario = session.config.roundScenarios?.[Math.max(0, session.currentRound - 1)]
  if (scenario) return scenario
  return {
    label: 'Baseline',
    wageSchedule: session.config.wageSchedule,
    highTypeCost: session.config.highTypeCost,
    lowTypeCost: session.config.lowTypeCost,
  }
}

export function submitSignalingAction(
  session: SignalingSession,
  playerId: string,
  eduChoice: number
): { ok: boolean; error?: string } {
  const player = session.players.find(p => p.id === playerId)
  if (!player) return { ok: false, error: 'Player not found' }
  if (player.hasActedThisRound) return { ok: false, error: 'Already acted this round' }
  if (session.phase !== 'playing') return { ok: false, error: 'Game not active' }
  if (![0, 1, 2].includes(eduChoice)) return { ok: false, error: 'Invalid education choice' }

  player.eduChoiceThisRound = eduChoice
  player.hasActedThisRound = true
  session.eventLog.push(`${player.name} chose education level ${eduChoice}.`)
  if (session.eventLog.length > 40) session.eventLog.shift()
  return { ok: true }
}

export function isSignalingRoundComplete(session: SignalingSession): boolean {
  return session.players.filter(p => !p.isBot).every(p => p.hasActedThisRound)
}

export function processSignalingRound(session: SignalingSession): void {
  const { wageSchedule, highTypeCost, lowTypeCost } = getSignalingScenario(session)

  // Bot strategy: choose argmax payoff given current round scenario.
  for (const bot of session.players.filter(p => p.isBot && !p.hasActedThisRound)) {
    const costPerLevel = bot.workerType === 'high' ? highTypeCost : lowTypeCost
    let bestEdu = 0
    let bestPayoff = wageSchedule[0]
    for (const edu of [1, 2]) {
      const payoff = wageSchedule[edu] - edu * costPerLevel
      if (payoff > bestPayoff) {
        bestPayoff = payoff
        bestEdu = edu
      }
    }
    bot.eduChoiceThisRound = bestEdu
    bot.hasActedThisRound = true
  }

  const results: SignalingRoundSummary['results'] = []
  for (const p of session.players) {
    const edu = p.eduChoiceThisRound ?? 0
    const wage = wageSchedule[edu]
    const costPerLevel = p.workerType === 'high' ? highTypeCost : lowTypeCost
    const cost = edu * costPerLevel
    const roundPayoff = wage - cost
    p.totalScore += roundPayoff
    results.push({
      playerId: p.id, playerName: p.name,
      workerType: p.workerType, eduChoice: edu,
      wage, cost, roundPayoff,
    })
  }

  session.history.push({ round: session.currentRound, results })
  session.eventLog.push(`Round ${session.currentRound} complete. Wages paid.`)
  if (session.eventLog.length > 40) session.eventLog.shift()

  // Reset
  for (const p of session.players) {
    p.hasActedThisRound = false
    p.eduChoiceThisRound = undefined
  }

  if (session.currentRound >= session.config.rounds) {
    session.phase = 'results'
    session.eventLog.push('Game complete!')
  } else {
    session.currentRound += 1
  }
}
