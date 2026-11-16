/**
 * Monte Carlo Pi Engine
 * Powers: Monte Carlo Pi Challenge
 *
 * Players choose how many random trials to run (budget-constrained).
 * Server estimates π for each player. Scored on accuracy + budget efficiency.
 */

export type MonteCarloPiConfig = {
  rounds: number
  budget: number       // Total budget per player (e.g. 50)
  trialCost: number    // Cost per trial (e.g. 0.50)
  maxTrials: number    // budget / trialCost
}

export type MonteCarloPiPlayer = {
  id: string
  name: string
  isBot: boolean
  totalScore: number
  budgetRemaining: number
  hasActedThisRound: boolean
  trialsChosen?: number
  estimateThisRound?: number
}

export type MonteCarloPiRoundResult = {
  playerId: string
  playerName: string
  trialsChosen: number
  estimate: number
  error: number
  roundScore: number
  budgetSpent: number
  budgetRemaining: number
}

export type MonteCarloPiRoundSummary = {
  round: number
  results: MonteCarloPiRoundResult[]
}

export type MonteCarloPiSession = {
  roomCode: string
  hostToken: string
  phase: 'lobby' | 'playing' | 'results'
  config: MonteCarloPiConfig
  players: MonteCarloPiPlayer[]
  currentRound: number
  history: MonteCarloPiRoundSummary[]
  eventLog: string[]
  createdAt: number
  lastActivityAt: number
}

const SESSION_TTL_MS = 2 * 60 * 60 * 1000
const sessions = new Map<string, MonteCarloPiSession>()

export function cleanupMonteCarloPiSessions(): void {
  const now = Date.now()
  for (const [code, s] of sessions) {
    if (now - s.lastActivityAt > SESSION_TTL_MS) sessions.delete(code)
  }
}

export function getMonteCarloPiSession(roomCode: string): MonteCarloPiSession | undefined {
  cleanupMonteCarloPiSessions()
  return sessions.get(roomCode.toUpperCase())
}

export function setMonteCarloPiSession(session: MonteCarloPiSession): void {
  session.lastActivityAt = Date.now()
  sessions.set(session.roomCode, session)
}

export const DEFAULT_MCP_CONFIG: MonteCarloPiConfig = {
  rounds: 5,
  budget: 50,
  trialCost: 0.5,
  maxTrials: 100,
}

export function createMonteCarloPiSession(
  roomCode: string,
  hostToken: string,
  config: MonteCarloPiConfig = DEFAULT_MCP_CONFIG
): MonteCarloPiSession {
  return {
    roomCode: roomCode.toUpperCase(),
    hostToken,
    phase: 'lobby',
    config,
    players: [],
    currentRound: 1,
    history: [],
    eventLog: ['Monte Carlo Pi Challenge created. Waiting for players...'],
    createdAt: Date.now(),
    lastActivityAt: Date.now(),
  }
}

export function addMonteCarloPiPlayer(
  session: MonteCarloPiSession,
  id: string,
  name: string,
  isBot = false
): MonteCarloPiPlayer {
  const player: MonteCarloPiPlayer = {
    id,
    name,
    isBot,
    totalScore: 0,
    budgetRemaining: session.config.budget,
    hasActedThisRound: false,
  }
  session.players.push(player)
  return player
}

/** Run Monte Carlo pi estimation server-side */
function estimatePi(trials: number): number {
  let inside = 0
  for (let i = 0; i < trials; i++) {
    const x = Math.random()
    const y = Math.random()
    if (x * x + y * y <= 1) inside++
  }
  return trials === 0 ? 0 : (4 * inside) / trials
}

export function submitMonteCarloPiAction(
  session: MonteCarloPiSession,
  playerId: string,
  trialsChosen: number
): boolean {
  const player = session.players.find((p) => p.id === playerId)
  if (!player || player.hasActedThisRound) return false

  const clampedTrials = Math.max(1, Math.min(trialsChosen, Math.floor(player.budgetRemaining / session.config.trialCost)))
  const estimate = estimatePi(clampedTrials)

  player.trialsChosen = clampedTrials
  player.estimateThisRound = estimate
  player.hasActedThisRound = true

  session.eventLog.unshift(`${player.name} chose ${clampedTrials} trial${clampedTrials !== 1 ? 's' : ''} (est. π ≈ ${estimate.toFixed(4)}).`)
  if (session.eventLog.length > 40) session.eventLog.pop()

  return true
}

export function isMonteCarloPiRoundComplete(session: MonteCarloPiSession): boolean {
  const humans = session.players.filter((p) => !p.isBot)
  return humans.length > 0 && humans.every((p) => p.hasActedThisRound)
}

export function processMonteCarloPiRound(session: MonteCarloPiSession): void {
  // Process bot players first
  for (const p of session.players) {
    if (p.isBot && !p.hasActedThisRound) {
      const maxTrials = Math.floor(p.budgetRemaining / session.config.trialCost)
      const botTrials = Math.min(maxTrials, Math.floor(20 + Math.random() * 60))
      submitMonteCarloPiAction(session, p.id, botTrials)
    }
  }

  const results: MonteCarloPiRoundResult[] = []

  for (const p of session.players) {
    const trials = p.trialsChosen ?? 0
    const estimate = p.estimateThisRound ?? 0
    const error = Math.abs(estimate - Math.PI)
    const budgetSpent = trials * session.config.trialCost
    const newBudget = Math.max(0, p.budgetRemaining - budgetSpent)

    const accuracy = Math.max(0, 100 - error * 1000)
    const efficiency = (newBudget / session.config.budget) * 20
    const roundScore = Math.round(accuracy + efficiency)

    p.budgetRemaining = newBudget
    p.totalScore += roundScore

    results.push({
      playerId: p.id,
      playerName: p.name,
      trialsChosen: trials,
      estimate,
      error,
      roundScore,
      budgetSpent,
      budgetRemaining: newBudget,
    })
  }

  // Sort by round score descending for the summary
  results.sort((a, b) => b.roundScore - a.roundScore)

  session.history.push({ round: session.currentRound, results })

  const best = results[0]
  session.eventLog.unshift(
    `Round ${session.currentRound} complete. Best: ${best.playerName} (π ≈ ${best.estimate.toFixed(4)}, score: ${best.roundScore}).`
  )
  if (session.eventLog.length > 40) session.eventLog.pop()

  // Reset for next round or move to results
  if (session.currentRound >= session.config.rounds) {
    session.phase = 'results'
    session.eventLog.unshift('Game over! Final results.')
  } else {
    session.currentRound++
    for (const p of session.players) {
      p.hasActedThisRound = false
      p.trialsChosen = undefined
      p.estimateThisRound = undefined
    }
  }
}
