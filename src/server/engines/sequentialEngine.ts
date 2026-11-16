/**
 * Sequential Game Engine
 * Powers: Ultimatum Game, Trust Game
 *
 * Two roles act in sequence each round.
 * Ultimatum: Proposer offers a split → Responder accepts or rejects.
 * Trust: Investor sends an amount (multiplied) → Trustee returns a portion.
 */

export type SequentialVariant = 'ultimatum' | 'trust'

export type SequentialConfig = {
  variant: SequentialVariant
  endowment: number     // Starting amount per round (e.g. 100 points)
  multiplier: number    // Trust only: sent amount is multiplied (e.g. 3)
  rounds: number
}

export type SequentialPlayer = {
  id: string
  name: string
  isBot: boolean
  role: 'proposer' | 'responder'   // Ultimatum labels
  totalScore: number
  roundsActed: number
}

export type SequentialRoundState = {
  round: number
  proposerId: string
  responderId: string
  offer?: number          // Amount sent / proposed (0 to endowment)
  response?: 'accept' | 'reject' | number  // accept/reject for ultimatum; amount returned for trust
  proposerPayoff?: number
  responderPayoff?: number
  settled: boolean
}

export type SequentialSession = {
  roomCode: string
  hostToken: string
  phase: 'lobby' | 'playing' | 'results'
  config: SequentialConfig
  players: SequentialPlayer[]
  currentRound: number
  roundStep: 'offer' | 'response' | 'complete'
  rounds: SequentialRoundState[]
  eventLog: string[]
  createdAt: number
  lastActivityAt: number
}

const SESSION_TTL_MS = 2 * 60 * 60 * 1000
const sessions = new Map<string, SequentialSession>()

export function cleanupSequentialSessions(): void {
  const now = Date.now()
  for (const [code, s] of sessions) {
    if (now - s.lastActivityAt > SESSION_TTL_MS) sessions.delete(code)
  }
}

export function getSequentialSession(roomCode: string): SequentialSession | undefined {
  cleanupSequentialSessions()
  return sessions.get(roomCode.toUpperCase())
}

export function setSequentialSession(session: SequentialSession): void {
  session.lastActivityAt = Date.now()
  sessions.set(session.roomCode, session)
}

export function createSequentialSession(
  roomCode: string,
  hostToken: string,
  config: SequentialConfig
): SequentialSession {
  return {
    roomCode: roomCode.toUpperCase(),
    hostToken,
    phase: 'lobby',
    config,
    players: [],
    currentRound: 1,
    roundStep: 'offer',
    rounds: [],
    eventLog: ['Game created. Waiting for players...'],
    createdAt: Date.now(),
    lastActivityAt: Date.now(),
  }
}

export function addSequentialPlayer(
  session: SequentialSession,
  id: string,
  name: string,
  isBot = false
): SequentialPlayer {
  const proposerCount = session.players.filter(p => p.role === 'proposer').length
  const responderCount = session.players.filter(p => p.role === 'responder').length
  const role: 'proposer' | 'responder' = proposerCount <= responderCount ? 'proposer' : 'responder'

  const player: SequentialPlayer = {
    id, name, isBot, role,
    totalScore: 0,
    roundsActed: 0,
  }
  session.players.push(player)
  const roleLabel = session.config.variant === 'trust'
    ? (role === 'proposer' ? 'Investor' : 'Trustee')
    : (role === 'proposer' ? 'Proposer' : 'Responder')
  session.eventLog.push(`${name} joined as ${roleLabel}.`)
  if (session.eventLog.length > 40) session.eventLog.shift()
  return player
}

function getProposer(session: SequentialSession): SequentialPlayer | undefined {
  return session.players.find(p => p.role === 'proposer')
}

function getResponder(session: SequentialSession): SequentialPlayer | undefined {
  return session.players.find(p => p.role === 'responder')
}

export function getCurrentRoundState(session: SequentialSession): SequentialRoundState | undefined {
  return session.rounds.find(r => r.round === session.currentRound)
}

function ensureCurrentRound(session: SequentialSession): SequentialRoundState {
  let r = getCurrentRoundState(session)
  if (!r) {
    const proposer = getProposer(session)!
    const responder = getResponder(session)!
    r = {
      round: session.currentRound,
      proposerId: proposer.id,
      responderId: responder.id,
      settled: false,
    }
    session.rounds.push(r)
  }
  return r
}

// --- Submit an offer (proposer action) ---
export function submitOffer(
  session: SequentialSession,
  playerId: string,
  amount: number
): { ok: boolean; error?: string } {
  const r = ensureCurrentRound(session)
  if (session.roundStep !== 'offer') return { ok: false, error: 'Not in offer phase' }
  if (r.proposerId !== playerId) return { ok: false, error: 'Not the proposer' }

  const clampedAmount = Math.max(0, Math.min(session.config.endowment, Math.round(amount)))
  r.offer = clampedAmount

  const proposer = session.players.find(p => p.id === playerId)!
  const variant = session.config.variant
  if (variant === 'ultimatum') {
    session.eventLog.push(
      `${proposer.name} proposes: keep ${session.config.endowment - clampedAmount}, offer ${clampedAmount}.`
    )
  } else {
    session.eventLog.push(`${proposer.name} (Investor) sends ${clampedAmount}.`)
  }
  if (session.eventLog.length > 40) session.eventLog.shift()

  // Bot auto-responds if responder is bot
  const responder = session.players.find(p => p.id === r.responderId)
  if (responder?.isBot) {
    const botResponse = getBotResponse(session, clampedAmount)
    return processResponse(session, r.responderId, botResponse)
  }

  session.roundStep = 'response'
  return { ok: true }
}

// --- Submit a response (responder action) ---
export function submitResponse(
  session: SequentialSession,
  playerId: string,
  response: 'accept' | 'reject' | number
): { ok: boolean; error?: string } {
  const r = ensureCurrentRound(session)
  if (session.roundStep !== 'response') return { ok: false, error: 'Not in response phase' }
  if (r.responderId !== playerId) return { ok: false, error: 'Not the responder' }
  return processResponse(session, playerId, response)
}

function processResponse(
  session: SequentialSession,
  _playerId: string,
  response: 'accept' | 'reject' | number
): { ok: boolean; error?: string } {
  const r = ensureCurrentRound(session)
  const { endowment, multiplier, variant } = session.config
  const proposer = session.players.find(p => p.id === r.proposerId)!
  const responder = session.players.find(p => p.id === r.responderId)!
  const offer = r.offer ?? 0

  r.response = response

  if (variant === 'ultimatum') {
    if (response === 'accept') {
      r.proposerPayoff = endowment - offer
      r.responderPayoff = offer
      session.eventLog.push(`${responder.name} ACCEPTED. Payoffs: ${proposer.name} +${r.proposerPayoff}, ${responder.name} +${r.responderPayoff}.`)
    } else {
      r.proposerPayoff = 0
      r.responderPayoff = 0
      session.eventLog.push(`${responder.name} REJECTED. Both earn 0.`)
    }
  } else {
    // Trust: offer was amount sent; multiplied; responder returns some
    const received = offer * multiplier
    const returned = typeof response === 'number'
      ? Math.max(0, Math.min(received, Math.round(response)))
      : 0
    r.response = returned
    r.proposerPayoff = (endowment - offer) + returned
    r.responderPayoff = received - returned
    session.eventLog.push(
      `${responder.name} (Trustee) received ${received}, returns ${returned}. ` +
      `Payoffs: ${proposer.name} +${r.proposerPayoff}, ${responder.name} +${r.responderPayoff}.`
    )
  }

  if (session.eventLog.length > 40) session.eventLog.shift()

  proposer.totalScore += r.proposerPayoff ?? 0
  responder.totalScore += r.responderPayoff ?? 0
  r.settled = true
  session.roundStep = 'complete'

  // Advance to next round or results
  if (session.currentRound >= session.config.rounds) {
    session.phase = 'results'
    session.eventLog.push('Game complete!')
  } else {
    session.currentRound += 1
    session.roundStep = 'offer'
  }

  return { ok: true }
}

function getBotResponse(
  session: SequentialSession,
  offer: number
): 'accept' | 'reject' | number {
  const { endowment, multiplier, variant } = session.config
  if (variant === 'ultimatum') {
    // Reject offers below 30% of endowment
    const threshold = endowment * 0.3
    return offer >= threshold ? 'accept' : 'reject'
  } else {
    // Return ~50% of what was received (with some noise)
    const received = offer * multiplier
    const base = received * 0.5
    const noise = (Math.random() - 0.5) * received * 0.2
    return Math.max(0, Math.round(base + noise))
  }
}

// Bot proposer logic
export function getBotOffer(session: SequentialSession): number {
  const { endowment, variant } = session.config
  if (variant === 'ultimatum') {
    // Offer ~40% (slightly above rejection threshold)
    return Math.round(endowment * 0.4 + (Math.random() - 0.5) * endowment * 0.1)
  } else {
    // Send ~50% of endowment
    return Math.round(endowment * 0.5 + (Math.random() - 0.5) * endowment * 0.2)
  }
}
