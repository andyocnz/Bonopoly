/**
 * Assets Diversification Engine (formerly Market Survival)
 *
 * Players allocate a portfolio across 3 asset classes (Bonds, Index Fund, Growth Stocks).
 * The system derives portfolio drift + volatility from the allocation weights and applies
 * round-specific market conditions (Normal → Recession → Bull Run), then simulates
 * geometric Brownian motion paths.
 *
 * Teaches: diversification reduces risk, return/risk tradeoff, correlation in downturns.
 */

export type MarketSurvivalConfig = {
  rounds: number
  steps: number           // Steps per path (e.g. 50)
  pathCount: number       // Paths per player per round (e.g. 10)
  startPrice: number      // Starting price (e.g. 100)
  targetPrice: number     // Win target (e.g. 130)
  bankruptcyPrice: number // Bankruptcy threshold (e.g. 70)
}

export type ADAllocation = {
  bondsPct: number   // 0–100
  indexPct: number   // 0–100
  stocksPct: number  // derived: 100 - bondsPct - indexPct
}

export type MarketSurvivalPlayer = {
  id: string
  name: string
  isBot: boolean
  totalScore: number
  hasActedThisRound: boolean
  allocation?: ADAllocation  // stored for display
  drift?: number             // computed from allocation
  volatility?: number        // computed from allocation
}

export type MarketSurvivalPlayerResult = {
  playerId: string
  playerName: string
  allocation?: ADAllocation
  drift: number
  volatility: number
  paths: number[][]
  pathsHitTarget: number
  pathsBankrupt: number
  pathsSurvived: number
  roundScore: number
}

export type MarketSurvivalRoundSummary = {
  round: number
  results: MarketSurvivalPlayerResult[]
}

export type MarketSurvivalSession = {
  roomCode: string
  hostToken: string
  phase: 'lobby' | 'playing' | 'results'
  config: MarketSurvivalConfig
  players: MarketSurvivalPlayer[]
  currentRound: number
  history: MarketSurvivalRoundSummary[]
  eventLog: string[]
  createdAt: number
  lastActivityAt: number
}

// ── Round contexts ────────────────────────────────────────────────────────────

export type RoundContext = {
  round: number
  title: string
  description: string
  correlationNote: string | null
}

export const ROUND_CONTEXTS: RoundContext[] = [
  {
    round: 1,
    title: 'Normal Market',
    description: 'Steady economic conditions. Build your portfolio and observe how diversification affects outcomes.',
    correlationNote: null,
  },
  {
    round: 2,
    title: 'Recession',
    description: 'The economy contracts. Risk assets are hit hard as earnings expectations collapse. Bonds hold their value — everything else suffers.',
    correlationNote: 'In a downturn, stocks and index funds tend to fall together — they\'re positively correlated. Holding both provides less protection than it might appear on paper.',
  },
  {
    round: 3,
    title: 'Bull Run',
    description: 'Markets surge on strong growth data. Risk assets lead the rally. Portfolios heavy on bonds miss the upside.',
    correlationNote: null,
  },
]

// ── Asset base parameters and round adjustments ───────────────────────────────

const BASE_ASSETS = {
  bonds:  { drift: 0.05, volatility: 0.04 },
  index:  { drift: 0.09, volatility: 0.12 },
  stocks: { drift: 0.15, volatility: 0.25 },
}

type RoundAdjustment = {
  bonds:  { driftDelta: number; volScale: number }
  index:  { driftDelta: number; volScale: number }
  stocks: { driftDelta: number; volScale: number }
}

const ROUND_ADJUSTMENTS: RoundAdjustment[] = [
  // Round 1: Normal — no adjustment
  { bonds: { driftDelta: 0.00, volScale: 1.0 }, index: { driftDelta: 0.00, volScale: 1.0 }, stocks: { driftDelta: 0.00, volScale: 1.0 } },
  // Round 2: Recession — stocks and index hammered; bonds benefit from flight to safety
  { bonds: { driftDelta: 0.01, volScale: 0.9 }, index: { driftDelta: -0.06, volScale: 1.3 }, stocks: { driftDelta: -0.12, volScale: 1.5 } },
  // Round 3: Bull Run — stocks surge; bonds lag
  { bonds: { driftDelta: -0.01, volScale: 0.9 }, index: { driftDelta: 0.04, volScale: 1.1 }, stocks: { driftDelta: 0.08, volScale: 1.2 } },
]

export function getEffectiveAssets(roundIndex: number) {
  const adj = ROUND_ADJUSTMENTS[Math.min(roundIndex, ROUND_ADJUSTMENTS.length - 1)]
  return {
    bonds:  { drift: BASE_ASSETS.bonds.drift  + adj.bonds.driftDelta,  volatility: BASE_ASSETS.bonds.volatility  * adj.bonds.volScale  },
    index:  { drift: BASE_ASSETS.index.drift  + adj.index.driftDelta,  volatility: BASE_ASSETS.index.volatility  * adj.index.volScale  },
    stocks: { drift: BASE_ASSETS.stocks.drift + adj.stocks.driftDelta, volatility: BASE_ASSETS.stocks.volatility * adj.stocks.volScale },
  }
}

/** Compute portfolio drift and volatility from allocation weights (simplified — no cross-asset correlation). */
export function computePortfolioParams(
  allocation: ADAllocation,
  roundIndex: number,
): { drift: number; volatility: number } {
  const assets = getEffectiveAssets(roundIndex)
  const wb = allocation.bondsPct  / 100
  const wi = allocation.indexPct  / 100
  const ws = allocation.stocksPct / 100

  const drift = wb * assets.bonds.drift + wi * assets.index.drift + ws * assets.stocks.drift

  // Simplified: ignores cross-asset correlation (appropriate for intro level)
  const vol = Math.sqrt(
    wb * wb * assets.bonds.volatility  ** 2 +
    wi * wi * assets.index.volatility  ** 2 +
    ws * ws * assets.stocks.volatility ** 2,
  )
  return { drift, volatility: vol }
}

// ── Session helpers ───────────────────────────────────────────────────────────

const SESSION_TTL_MS = 2 * 60 * 60 * 1000
const sessions = new Map<string, MarketSurvivalSession>()

export function cleanupMarketSurvivalSessions(): void {
  const now = Date.now()
  for (const [code, s] of sessions) {
    if (now - s.lastActivityAt > SESSION_TTL_MS) sessions.delete(code)
  }
}

export function getMarketSurvivalSession(roomCode: string): MarketSurvivalSession | undefined {
  cleanupMarketSurvivalSessions()
  return sessions.get(roomCode.toUpperCase())
}

export function setMarketSurvivalSession(session: MarketSurvivalSession): void {
  session.lastActivityAt = Date.now()
  sessions.set(session.roomCode, session)
}

export const DEFAULT_MSV_CONFIG: MarketSurvivalConfig = {
  rounds: 3,
  steps: 50,
  pathCount: 10,
  startPrice: 100,
  targetPrice: 130,
  bankruptcyPrice: 70,
}

export function createMarketSurvivalSession(
  roomCode: string,
  hostToken: string,
  config: MarketSurvivalConfig = DEFAULT_MSV_CONFIG
): MarketSurvivalSession {
  return {
    roomCode: roomCode.toUpperCase(),
    hostToken,
    phase: 'lobby',
    config,
    players: [],
    currentRound: 1,
    history: [],
    eventLog: ['Assets Diversification created. Waiting for players...'],
    createdAt: Date.now(),
    lastActivityAt: Date.now(),
  }
}

export function addMarketSurvivalPlayer(
  session: MarketSurvivalSession,
  id: string,
  name: string,
  isBot = false
): MarketSurvivalPlayer {
  const player: MarketSurvivalPlayer = {
    id,
    name,
    isBot,
    totalScore: 0,
    hasActedThisRound: false,
  }
  session.players.push(player)
  return player
}

// ── Box-Muller transform ──────────────────────────────────────────────────────

function normalRandom(): number {
  let u = 0, v = 0
  while (u === 0) u = Math.random()
  while (v === 0) v = Math.random()
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v)
}

function generatePath(
  drift: number,
  volatility: number,
  steps: number,
  startPrice: number
): number[] {
  const dt = 1 / steps
  const path = [startPrice]
  for (let i = 0; i < steps; i++) {
    const z = normalRandom()
    const prev = path[path.length - 1]
    const next = prev * Math.exp((drift - 0.5 * volatility * volatility) * dt + volatility * Math.sqrt(dt) * z)
    path.push(Math.max(0, next))
  }
  return path
}

// ── Actions ───────────────────────────────────────────────────────────────────

/** Submit a portfolio allocation. Drift and volatility are computed from the allocation + current round. */
export function submitMarketSurvivalAction(
  session: MarketSurvivalSession,
  playerId: string,
  allocation: ADAllocation,
): boolean {
  const player = session.players.find((p) => p.id === playerId)
  if (!player || player.hasActedThisRound) return false

  const total = allocation.bondsPct + allocation.indexPct + allocation.stocksPct
  if (Math.abs(total - 100) > 1) return false

  const roundIndex = session.currentRound - 1
  const { drift, volatility } = computePortfolioParams(allocation, roundIndex)

  player.allocation = { bondsPct: Math.round(allocation.bondsPct), indexPct: Math.round(allocation.indexPct), stocksPct: Math.round(allocation.stocksPct) }
  player.drift = drift
  player.volatility = volatility
  player.hasActedThisRound = true

  session.eventLog.unshift(
    `${player.name}: ${allocation.bondsPct}% Bonds · ${allocation.indexPct}% Index · ${allocation.stocksPct}% Stocks (drift ${(drift * 100).toFixed(1)}%, vol ${(volatility * 100).toFixed(1)}%).`
  )
  if (session.eventLog.length > 40) session.eventLog.pop()

  return true
}

export function isMarketSurvivalRoundComplete(session: MarketSurvivalSession): boolean {
  const humans = session.players.filter((p) => !p.isBot)
  return humans.length > 0 && humans.every((p) => p.hasActedThisRound)
}

export function processMarketSurvivalRound(session: MarketSurvivalSession): void {
  // Bot: balanced diversified allocation
  for (const p of session.players) {
    if (p.isBot && !p.hasActedThisRound) {
      submitMarketSurvivalAction(session, p.id, { bondsPct: 30, indexPct: 40, stocksPct: 30 })
    }
  }

  const roundIndex = session.currentRound - 1
  const { steps, pathCount, startPrice, targetPrice, bankruptcyPrice } = session.config
  const results: MarketSurvivalPlayerResult[] = []

  for (const p of session.players) {
    // Use stored allocation; fall back to drift/vol if allocation missing (legacy sessions)
    let drift = p.drift ?? 0.05
    let volatility = p.volatility ?? 0.15
    if (p.allocation) {
      const computed = computePortfolioParams(p.allocation, roundIndex)
      drift = computed.drift
      volatility = computed.volatility
    }

    const paths: number[][] = []
    let pathsHitTarget = 0
    let pathsBankrupt = 0

    for (let i = 0; i < pathCount; i++) {
      const path = generatePath(drift, volatility, steps, startPrice)
      paths.push(path)
      if (path.some((price) => price >= targetPrice)) pathsHitTarget++
      if (path.some((price) => price <= bankruptcyPrice)) pathsBankrupt++
    }

    const pathsSurvived = pathCount - pathsHitTarget - pathsBankrupt
    const roundScore = Math.max(0, pathsHitTarget * 10 - pathsBankrupt * 15 + pathsSurvived * 5)
    p.totalScore += roundScore

    results.push({
      playerId: p.id,
      playerName: p.name,
      allocation: p.allocation,
      drift,
      volatility,
      paths,
      pathsHitTarget,
      pathsBankrupt,
      pathsSurvived,
      roundScore,
    })
  }

  results.sort((a, b) => b.roundScore - a.roundScore)
  session.history.push({ round: session.currentRound, results })

  const best = results[0]
  session.eventLog.unshift(
    `Round ${session.currentRound} complete. Best: ${best.playerName} (${best.pathsHitTarget} hit target, ${best.pathsBankrupt} bankrupt, score: ${best.roundScore}).`
  )
  if (session.eventLog.length > 40) session.eventLog.pop()

  if (session.currentRound >= session.config.rounds) {
    session.phase = 'results'
    session.eventLog.unshift('Game over! Final results.')
  } else {
    session.currentRound++
    for (const p of session.players) {
      p.hasActedThisRound = false
      p.drift = undefined
      p.volatility = undefined
      p.allocation = undefined
    }
  }
}
