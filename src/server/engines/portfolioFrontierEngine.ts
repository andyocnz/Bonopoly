/**
 * Portfolio Frontier Engine
 * Powers: Portfolio Frontier Challenge
 *
 * Players pick expected return and risk level for a 20-year portfolio simulation.
 * Server runs 200 GBM paths. Scored on success rate (≥75% hitting goal) + risk efficiency.
 */

export type PortfolioFrontierConfig = {
  rounds: number
  simCount: number           // Number of simulation paths (e.g. 200)
  years: number              // Investment horizon (e.g. 20)
  initialInvestment: number  // Starting amount (e.g. 100000)
  goalAmount: number         // Target retirement goal (e.g. 500000)
  goalThreshold: number      // Fraction of paths needed to "win" (e.g. 0.75)
  minVolatility: number      // Minimum enforced risk (e.g. 0.10)
}

export type PortfolioFrontierPlayer = {
  id: string
  name: string
  isBot: boolean
  totalScore: number
  hasActedThisRound: boolean
  expectedReturn?: number // μ ∈ [0.04, 0.15]
  riskLevel?: number      // σ ∈ [0.10, 0.40]
}

export type PortfolioFrontierPlayerResult = {
  playerId: string
  playerName: string
  expectedReturn: number
  riskLevel: number
  finalValues: number[]   // Sampled final values for histogram (first 50)
  pathsHitGoal: number
  successRate: number     // 0–1
  roundScore: number
}

export type PortfolioFrontierRoundSummary = {
  round: number
  results: PortfolioFrontierPlayerResult[]
}

export type PortfolioFrontierSession = {
  roomCode: string
  hostToken: string
  phase: 'lobby' | 'playing' | 'results'
  config: PortfolioFrontierConfig
  players: PortfolioFrontierPlayer[]
  currentRound: number
  history: PortfolioFrontierRoundSummary[]
  eventLog: string[]
  createdAt: number
  lastActivityAt: number
}

const SESSION_TTL_MS = 2 * 60 * 60 * 1000
const sessions = new Map<string, PortfolioFrontierSession>()

export function cleanupPortfolioFrontierSessions(): void {
  const now = Date.now()
  for (const [code, s] of sessions) {
    if (now - s.lastActivityAt > SESSION_TTL_MS) sessions.delete(code)
  }
}

export function getPortfolioFrontierSession(roomCode: string): PortfolioFrontierSession | undefined {
  cleanupPortfolioFrontierSessions()
  return sessions.get(roomCode.toUpperCase())
}

export function setPortfolioFrontierSession(session: PortfolioFrontierSession): void {
  session.lastActivityAt = Date.now()
  sessions.set(session.roomCode, session)
}

export const DEFAULT_PF_CONFIG: PortfolioFrontierConfig = {
  rounds: 3,
  simCount: 200,
  years: 20,
  initialInvestment: 100000,
  goalAmount: 500000,
  goalThreshold: 0.75,
  minVolatility: 0.10,
}

export function createPortfolioFrontierSession(
  roomCode: string,
  hostToken: string,
  config: PortfolioFrontierConfig = DEFAULT_PF_CONFIG
): PortfolioFrontierSession {
  return {
    roomCode: roomCode.toUpperCase(),
    hostToken,
    phase: 'lobby',
    config,
    players: [],
    currentRound: 1,
    history: [],
    eventLog: ['Portfolio Frontier Challenge created. Waiting for players...'],
    createdAt: Date.now(),
    lastActivityAt: Date.now(),
  }
}

export function addPortfolioFrontierPlayer(
  session: PortfolioFrontierSession,
  id: string,
  name: string,
  isBot = false
): PortfolioFrontierPlayer {
  const player: PortfolioFrontierPlayer = {
    id,
    name,
    isBot,
    totalScore: 0,
    hasActedThisRound: false,
  }
  session.players.push(player)
  return player
}

/** Box-Muller transform for standard normal random */
function normalRandom(): number {
  let u = 0, v = 0
  while (u === 0) u = Math.random()
  while (v === 0) v = Math.random()
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v)
}

/** Simulate one portfolio path over N years using GBM */
function simulatePortfolio(
  expectedReturn: number,
  riskLevel: number,
  years: number,
  initialInvestment: number
): number {
  let value = initialInvestment
  for (let y = 0; y < years; y++) {
    const z = normalRandom()
    const annualReturn = Math.exp((expectedReturn - 0.5 * riskLevel * riskLevel) + riskLevel * z)
    value = value * annualReturn
  }
  return value
}

export function submitPortfolioFrontierAction(
  session: PortfolioFrontierSession,
  playerId: string,
  expectedReturn: number,
  riskLevel: number
): boolean {
  const player = session.players.find((p) => p.id === playerId)
  if (!player || player.hasActedThisRound) return false

  // Clamp to valid ranges
  player.expectedReturn = Math.max(0.04, Math.min(0.15, expectedReturn))
  player.riskLevel = Math.max(session.config.minVolatility, Math.min(0.40, riskLevel))
  player.hasActedThisRound = true

  session.eventLog.unshift(
    `${player.name} set return=${(player.expectedReturn * 100).toFixed(1)}%, risk=${(player.riskLevel * 100).toFixed(1)}%.`
  )
  if (session.eventLog.length > 40) session.eventLog.pop()

  return true
}

export function isPortfolioFrontierRoundComplete(session: PortfolioFrontierSession): boolean {
  const humans = session.players.filter((p) => !p.isBot)
  return humans.length > 0 && humans.every((p) => p.hasActedThisRound)
}

export function processPortfolioFrontierRound(session: PortfolioFrontierSession): void {
  // Bot uses typical 60/40 portfolio parameters
  for (const p of session.players) {
    if (p.isBot && !p.hasActedThisRound) {
      submitPortfolioFrontierAction(session, p.id, 0.08, 0.20)
    }
  }

  const { simCount, years, initialInvestment, goalAmount } = session.config
  const results: PortfolioFrontierPlayerResult[] = []

  for (const p of session.players) {
    const expectedReturn = p.expectedReturn ?? 0.07
    const riskLevel = p.riskLevel ?? 0.15

    const finalValues: number[] = []
    let pathsHitGoal = 0

    for (let i = 0; i < simCount; i++) {
      const finalValue = simulatePortfolio(expectedReturn, riskLevel, years, initialInvestment)
      finalValues.push(finalValue)
      if (finalValue >= goalAmount) pathsHitGoal++
    }

    const successRate = pathsHitGoal / simCount
    const successPoints = Math.round(successRate * 100)
    const efficiencyBonus = Math.max(0, Math.round((0.40 - riskLevel) * 50))
    const roundScore = successPoints + efficiencyBonus

    p.totalScore += roundScore

    results.push({
      playerId: p.id,
      playerName: p.name,
      expectedReturn,
      riskLevel,
      finalValues: finalValues.slice(0, 50), // Store first 50 for histogram
      pathsHitGoal,
      successRate,
      roundScore,
    })
  }

  results.sort((a, b) => b.roundScore - a.roundScore)
  session.history.push({ round: session.currentRound, results })

  const best = results[0]
  session.eventLog.unshift(
    `Round ${session.currentRound} complete. Best: ${best.playerName} (${(best.successRate * 100).toFixed(0)}% success, score: ${best.roundScore}).`
  )
  if (session.eventLog.length > 40) session.eventLog.pop()

  if (session.currentRound >= session.config.rounds) {
    session.phase = 'results'
    session.eventLog.unshift('Game over! Final results.')
  } else {
    session.currentRound++
    for (const p of session.players) {
      p.hasActedThisRound = false
      p.expectedReturn = undefined
      p.riskLevel = undefined
    }
  }
}
