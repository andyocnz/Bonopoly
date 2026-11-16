/**
 * Monopoly Pricing Engine
 *
 * Each student runs their own monopoly with demand Q = max(0, a − b×P) and MC = c.
 * Each round: choose price P. Profit = (P − c) × Q.
 * Score = cumulative profit. Competitive on who earns most.
 *
 * Optimal: P* = (a + c) / 2 = 55, π* = (P*−c)×(a−b×P*) = 45×45 = 2025
 */

export type MonopolyConfig = {
  a: number       // demand intercept (default 100)
  b: number       // demand slope (default 1)
  c: number       // marginal cost (default 10)
  pMin: number    // min price players can set (default 10)
  pMax: number    // max price players can set (default 100)
  rounds: number
}

export type MonopolyPlayer = {
  id: string
  name: string
  isBot: boolean
  totalScore: number
  hasActedThisRound: boolean
  priceThisRound?: number
}

export type MonopolyRoundSummary = {
  round: number
  optimalPrice: number
  results: Array<{
    playerId: string
    playerName: string
    price: number
    quantity: number
    profit: number
    roundScore: number
  }>
}

export type MonopolySession = {
  roomCode: string
  hostToken: string
  phase: 'lobby' | 'playing' | 'results'
  config: MonopolyConfig
  players: MonopolyPlayer[]
  currentRound: number
  history: MonopolyRoundSummary[]
  eventLog: string[]
  createdAt: number
  lastActivityAt: number
}

const SESSION_TTL_MS = 2 * 60 * 60 * 1000
const sessions = new Map<string, MonopolySession>()

export function cleanupMonopolySessions(): void {
  const now = Date.now()
  for (const [code, s] of sessions) {
    if (now - s.lastActivityAt > SESSION_TTL_MS) sessions.delete(code)
  }
}

export function addMonopolyPlayer(
  session: MonopolySession,
  id: string,
  name: string,
  isBot = false
): MonopolyPlayer {
  const player: MonopolyPlayer = {
    id, name, isBot, totalScore: 0, hasActedThisRound: false,
  }
  session.players.push(player)
  session.eventLog.push(`${name} joined.`)
  if (session.eventLog.length > 40) session.eventLog.shift()
  return player
}

export function submitMonopolyAction(
  session: MonopolySession,
  playerId: string,
  price: number
): { ok: boolean; error?: string } {
  const player = session.players.find(p => p.id === playerId)
  if (!player) return { ok: false, error: 'Player not found' }
  if (player.hasActedThisRound) return { ok: false, error: 'Already set price this round' }
  if (session.phase !== 'playing') return { ok: false, error: 'Game not active' }

  const { pMin, pMax } = session.config
  const clamped = Math.max(pMin, Math.min(pMax, Math.round(price)))
  player.priceThisRound = clamped
  player.hasActedThisRound = true
  session.eventLog.push(`${player.name} set their price.`)
  if (session.eventLog.length > 40) session.eventLog.shift()
  return { ok: true }
}

export function isMonopolyRoundComplete(session: MonopolySession): boolean {
  return session.players.filter(p => !p.isBot).every(p => p.hasActedThisRound)
}

export function processMonopolyRound(session: MonopolySession): void {
  const { a, b, c } = session.config
  const optimalPrice = (a + c) / 2

  // Bots: optimal price ± small noise
  for (const bot of session.players.filter(p => p.isBot && !p.hasActedThisRound)) {
    bot.priceThisRound = Math.round(optimalPrice + (Math.random() - 0.5) * 10)
    bot.hasActedThisRound = true
  }

  const results: MonopolyRoundSummary['results'] = []
  for (const p of session.players) {
    const price = p.priceThisRound ?? optimalPrice
    const quantity = Math.max(0, a - b * price)
    const profit = Math.round((price - c) * quantity)
    p.totalScore += profit
    results.push({
      playerId: p.id, playerName: p.name,
      price, quantity: Math.round(quantity * 10) / 10, profit, roundScore: profit,
    })
  }

  session.history.push({ round: session.currentRound, optimalPrice, results })
  session.eventLog.push(`Round ${session.currentRound}: profits computed. Optimal P*=${optimalPrice.toFixed(0)}.`)
  if (session.eventLog.length > 40) session.eventLog.shift()

  for (const p of session.players) {
    p.hasActedThisRound = false
    p.priceThisRound = undefined
  }

  if (session.currentRound >= session.config.rounds) {
    session.phase = 'results'
    session.eventLog.push('Game complete!')
  } else {
    session.currentRound += 1
  }
}
