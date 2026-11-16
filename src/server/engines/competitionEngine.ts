/**
 * Competition Game Engine
 * Powers: Cournot Competition, Bertrand Competition
 *
 * Cournot: Firms simultaneously choose quantities.
 *   Market price P = demandIntercept - demandSlope * Q_total
 *   Firm profit = (P - marginalCost) * q_i
 *
 * Bertrand: Firms simultaneously choose prices.
 *   Lowest-price firm(s) capture all demand and earn (price - MC) * demand
 *   Higher-price firms earn 0.
 */

export type CompetitionVariant = 'cournot' | 'bertrand'

export type CompetitionConfig = {
  variant: CompetitionVariant
  demandIntercept: number   // 'a' in P = a - b*Q  (e.g. 100)
  demandSlope: number       // 'b' in P = a - b*Q  (e.g. 1)
  marginalCost: number      // MC for all firms    (e.g. 10)
  rounds: number
  // Cournot Nash equilibrium quantities for reference:
  // q_Nash = (a - MC) / (b * (n + 1))   where n = num firms
}

export type CompetitionFirm = {
  id: string
  name: string
  isBot: boolean
  totalProfit: number
  decisionThisRound?: number   // Quantity (Cournot) or Price (Bertrand)
  hasActedThisRound: boolean
}

export type CompetitionRoundSummary = {
  round: number
  decisions: Record<string, number>    // firmId → quantity or price
  marketPrice?: number                 // Cournot only
  totalQuantity?: number               // Cournot only
  profits: Record<string, number>      // firmId → profit
  nashEquilibrium: number              // Reference Nash q* or p* per firm
}

export type CompetitionSession = {
  roomCode: string
  hostToken: string
  phase: 'lobby' | 'playing' | 'results'
  config: CompetitionConfig
  firms: CompetitionFirm[]
  currentRound: number
  history: CompetitionRoundSummary[]
  eventLog: string[]
  createdAt: number
  lastActivityAt: number
}

const SESSION_TTL_MS = 2 * 60 * 60 * 1000
const sessions = new Map<string, CompetitionSession>()

export function cleanupCompetitionSessions(): void {
  const now = Date.now()
  for (const [code, s] of sessions) {
    if (now - s.lastActivityAt > SESSION_TTL_MS) sessions.delete(code)
  }
}

export function getCompetitionSession(roomCode: string): CompetitionSession | undefined {
  cleanupCompetitionSessions()
  return sessions.get(roomCode.toUpperCase())
}

export function setCompetitionSession(session: CompetitionSession): void {
  session.lastActivityAt = Date.now()
  sessions.set(session.roomCode, session)
}

export function createCompetitionSession(
  roomCode: string,
  hostToken: string,
  config: CompetitionConfig
): CompetitionSession {
  return {
    roomCode: roomCode.toUpperCase(),
    hostToken,
    phase: 'lobby',
    config,
    firms: [],
    currentRound: 1,
    history: [],
    eventLog: ['Game created. Waiting for firms to join...'],
    createdAt: Date.now(),
    lastActivityAt: Date.now(),
  }
}

export function addCompetitionFirm(
  session: CompetitionSession,
  id: string,
  name: string,
  isBot = false
): CompetitionFirm {
  const firm: CompetitionFirm = {
    id, name, isBot,
    totalProfit: 0,
    hasActedThisRound: false,
  }
  session.firms.push(firm)
  const label = session.config.variant === 'cournot' ? 'quantity' : 'price'
  session.eventLog.push(`${name} joined. Will choose ${label} each round.`)
  if (session.eventLog.length > 40) session.eventLog.shift()
  return firm
}

export function submitDecision(
  session: CompetitionSession,
  firmId: string,
  decision: number
): { ok: boolean; error?: string } {
  const firm = session.firms.find(f => f.id === firmId)
  if (!firm) return { ok: false, error: 'Firm not found' }
  if (firm.hasActedThisRound) return { ok: false, error: 'Already submitted this round' }

  const { variant, demandIntercept, marginalCost } = session.config
  let clamped: number

  if (variant === 'cournot') {
    // Max sensible quantity: full monopoly output = (a - MC) / (2b)
    const maxQ = (demandIntercept - marginalCost) / (2 * session.config.demandSlope)
    clamped = Math.max(0, Math.min(maxQ * 2, Math.round(decision)))
  } else {
    // Price must be >= MC, <= intercept
    clamped = Math.max(marginalCost, Math.min(demandIntercept, Math.round(decision * 100) / 100))
  }

  firm.decisionThisRound = clamped
  firm.hasActedThisRound = true

  const label = variant === 'cournot' ? `quantity ${clamped}` : `price ${clamped}`
  session.eventLog.push(`${firm.name} submitted ${label}.`)
  if (session.eventLog.length > 40) session.eventLog.shift()
  return { ok: true }
}

export function isCompetitionRoundComplete(session: CompetitionSession): boolean {
  return session.firms.filter(f => !f.isBot).every(f => f.hasActedThisRound)
}

function computeNashEquilibrium(session: CompetitionSession): number {
  const { variant, demandIntercept, demandSlope, marginalCost } = session.config
  const n = session.firms.length || 1
  if (variant === 'cournot') {
    return (demandIntercept - marginalCost) / (demandSlope * (n + 1))
  } else {
    return marginalCost  // Bertrand Nash = MC (Bertrand paradox)
  }
}

function getBotDecision(session: CompetitionSession): number {
  const { variant, demandIntercept, demandSlope, marginalCost } = session.config
  const n = session.firms.length || 1
  if (variant === 'cournot') {
    const nashQ = (demandIntercept - marginalCost) / (demandSlope * (n + 1))
    // Bots play close to Nash with small noise
    return Math.max(0, Math.round(nashQ * (0.85 + Math.random() * 0.3)))
  } else {
    // Bertrand bots: slightly above MC to make profit
    const margin = (demandIntercept - marginalCost) * 0.15
    return Math.round((marginalCost + margin * (0.5 + Math.random() * 1.0)) * 100) / 100
  }
}

export function processCompetitionRound(session: CompetitionSession): void {
  const { variant, demandIntercept, demandSlope, marginalCost } = session.config

  // Fill in bot decisions
  for (const bot of session.firms.filter(f => f.isBot)) {
    if (!bot.hasActedThisRound) {
      bot.decisionThisRound = getBotDecision(session)
      bot.hasActedThisRound = true
    }
  }

  const decisions: Record<string, number> = {}
  for (const f of session.firms) decisions[f.id] = f.decisionThisRound ?? 0

  const profits: Record<string, number> = {}
  let marketPrice: number | undefined
  let totalQuantity: number | undefined

  if (variant === 'cournot') {
    totalQuantity = Object.values(decisions).reduce((a, b) => a + b, 0)
    marketPrice = Math.max(0, demandIntercept - demandSlope * totalQuantity)
    for (const f of session.firms) {
      profits[f.id] = Math.round((marketPrice - marginalCost) * decisions[f.id] * 10) / 10
    }
    session.eventLog.push(
      `Round ${session.currentRound}: Total Q = ${totalQuantity.toFixed(1)}, ` +
      `Market price = ${marketPrice.toFixed(1)}.`
    )
  } else {
    // Bertrand: find minimum price
    const prices = Object.values(decisions)
    const minPrice = Math.min(...prices)
    const winners = session.firms.filter(f => decisions[f.id] === minPrice)
    const marketDemand = Math.max(0, (demandIntercept - minPrice) / demandSlope)

    for (const f of session.firms) {
      if (decisions[f.id] === minPrice) {
        const share = marketDemand / winners.length
        profits[f.id] = Math.round((minPrice - marginalCost) * share * 10) / 10
      } else {
        profits[f.id] = 0
      }
    }
    session.eventLog.push(
      `Round ${session.currentRound}: Lowest price = ${minPrice}. ` +
      `${winners.map(w => w.name).join(', ')} win the market.`
    )
  }

  for (const f of session.firms) f.totalProfit += profits[f.id] ?? 0

  const summary: CompetitionRoundSummary = {
    round: session.currentRound,
    decisions,
    marketPrice,
    totalQuantity,
    profits,
    nashEquilibrium: Math.round(computeNashEquilibrium(session) * 100) / 100,
  }
  session.history.push(summary)

  if (session.eventLog.length > 40) session.eventLog.shift()

  // Reset
  for (const f of session.firms) {
    f.hasActedThisRound = false
    f.decisionThisRound = undefined
  }

  if (session.currentRound >= session.config.rounds) {
    session.phase = 'results'
    session.eventLog.push('Game complete!')
  } else {
    session.currentRound += 1
  }
}
