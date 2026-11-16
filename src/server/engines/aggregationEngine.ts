/**
 * Aggregation Game Engine
 * Powers: Beauty Contest (Keynesian Beauty Contest / p-Beauty Contest)
 *
 * Each player submits a number (0–100).
 * Target = fraction × mean of all guesses.
 * Winner = player closest to the target.
 *
 * Nash equilibrium: all guess 0 (via iterated dominance).
 * In practice, players converge slowly over multiple rounds.
 */

export type AggregationConfig = {
  fraction: number        // e.g. 0.667 (2/3)
  guessMin: number        // e.g. 0
  guessMax: number        // e.g. 100
  rounds: number
  revealAfterEachRound: boolean  // Show target and winner after each round
}

export type AggregationPlayer = {
  id: string
  name: string
  isBot: boolean
  totalWins: number
  totalScore: number    // Lower distance = better; invert for leaderboard
  guessThisRound?: number
  hasActedThisRound: boolean
}

export type AggregationRoundSummary = {
  round: number
  guesses: Record<string, number>    // playerId → guess
  mean: number
  target: number                     // fraction × mean
  distances: Record<string, number>  // playerId → |guess - target|
  winners: string[]                  // playerId(s) closest to target
  winnerNames: string[]
}

export type AggregationSession = {
  roomCode: string
  hostToken: string
  phase: 'lobby' | 'playing' | 'results'
  config: AggregationConfig
  players: AggregationPlayer[]
  currentRound: number
  history: AggregationRoundSummary[]
  eventLog: string[]
  createdAt: number
  lastActivityAt: number
}

const SESSION_TTL_MS = 2 * 60 * 60 * 1000
const sessions = new Map<string, AggregationSession>()

export function cleanupAggregationSessions(): void {
  const now = Date.now()
  for (const [code, s] of sessions) {
    if (now - s.lastActivityAt > SESSION_TTL_MS) sessions.delete(code)
  }
}

export function getAggregationSession(roomCode: string): AggregationSession | undefined {
  cleanupAggregationSessions()
  return sessions.get(roomCode.toUpperCase())
}

export function setAggregationSession(session: AggregationSession): void {
  session.lastActivityAt = Date.now()
  sessions.set(session.roomCode, session)
}

export function createAggregationSession(
  roomCode: string,
  hostToken: string,
  config: AggregationConfig
): AggregationSession {
  return {
    roomCode: roomCode.toUpperCase(),
    hostToken,
    phase: 'lobby',
    config,
    players: [],
    currentRound: 1,
    history: [],
    eventLog: ['Game created. Waiting for players...'],
    createdAt: Date.now(),
    lastActivityAt: Date.now(),
  }
}

export function addAggregationPlayer(
  session: AggregationSession,
  id: string,
  name: string,
  isBot = false
): AggregationPlayer {
  const player: AggregationPlayer = {
    id, name, isBot,
    totalWins: 0,
    totalScore: 0,
    hasActedThisRound: false,
  }
  session.players.push(player)
  session.eventLog.push(`${name} joined.`)
  if (session.eventLog.length > 40) session.eventLog.shift()
  return player
}

export function submitGuess(
  session: AggregationSession,
  playerId: string,
  guess: number
): { ok: boolean; error?: string } {
  const player = session.players.find(p => p.id === playerId)
  if (!player) return { ok: false, error: 'Player not found' }
  if (player.hasActedThisRound) return { ok: false, error: 'Already guessed this round' }

  const { guessMin, guessMax } = session.config
  const clamped = Math.max(guessMin, Math.min(guessMax, Math.round(guess * 10) / 10))
  player.guessThisRound = clamped
  player.hasActedThisRound = true

  session.eventLog.push(`${player.name} submitted their guess.`)
  if (session.eventLog.length > 40) session.eventLog.shift()
  return { ok: true }
}

export function isAggregationRoundComplete(session: AggregationSession): boolean {
  return session.players.filter(p => !p.isBot).every(p => p.hasActedThisRound)
}

// Bot guessing logic: converge toward 0 over rounds (level-k reasoning)
function getBotGuess(session: AggregationSession): number {
  const { fraction, guessMax } = session.config
  const round = session.currentRound

  // Round 1: random (no info); subsequent rounds: apply iterated reasoning
  if (round === 1) {
    return Math.round(Math.random() * guessMax)
  }

  // Look at last round target as a starting point, apply fraction again
  const lastSummary = session.history[session.history.length - 1]
  if (lastSummary) {
    const levelK = lastSummary.target * fraction
    const noise = (Math.random() - 0.5) * 10
    return Math.max(0, Math.round(levelK + noise))
  }

  return Math.round(guessMax * fraction * Math.random())
}

export function processAggregationRound(session: AggregationSession): void {
  // Fill in bot guesses
  for (const bot of session.players.filter(p => p.isBot)) {
    if (!bot.hasActedThisRound) {
      bot.guessThisRound = getBotGuess(session)
      bot.hasActedThisRound = true
    }
  }

  const guesses: Record<string, number> = {}
  let sum = 0
  for (const p of session.players) {
    const g = p.guessThisRound ?? 50
    guesses[p.id] = g
    sum += g
  }

  const n = session.players.length
  const mean = Math.round((sum / n) * 100) / 100
  const target = Math.round(mean * session.config.fraction * 100) / 100

  const distances: Record<string, number> = {}
  let minDist = Infinity
  for (const p of session.players) {
    const dist = Math.abs(guesses[p.id] - target)
    distances[p.id] = Math.round(dist * 100) / 100
    if (dist < minDist) minDist = dist
  }

  const winners = session.players.filter(p => distances[p.id] === minDist).map(p => p.id)
  const winnerNames = session.players.filter(p => winners.includes(p.id)).map(p => p.name)

  for (const p of session.players) {
    if (winners.includes(p.id)) p.totalWins += 1
    // Score = negative distance (higher is better) accumulated
    p.totalScore += Math.round((session.config.guessMax - distances[p.id]) * 10) / 10
  }

  const summary: AggregationRoundSummary = {
    round: session.currentRound,
    guesses,
    mean,
    target,
    distances,
    winners,
    winnerNames,
  }
  session.history.push(summary)

  session.eventLog.push(
    `Round ${session.currentRound}: Mean = ${mean}, Target = ${target}. ` +
    `Winner(s): ${winnerNames.join(', ')}.`
  )
  if (session.eventLog.length > 40) session.eventLog.shift()

  // Reset
  for (const p of session.players) {
    p.hasActedThisRound = false
    p.guessThisRound = undefined
  }

  if (session.currentRound >= session.config.rounds) {
    session.phase = 'results'
    session.eventLog.push('Game complete!')
  } else {
    session.currentRound += 1
  }
}
