/**
 * Contribution Game Engine
 * Powers: Public Goods Game
 *
 * N players simultaneously choose how much of their endowment to contribute
 * to a public good. Total contributions are multiplied and shared equally.
 *
 * Payoff formula:
 *   player_i = (endowment - contribution_i) + (multiplier * sum(all contributions) / n)
 */

export type ContributionConfig = {
  endowment: number     // Tokens each player starts with per round (e.g. 20)
  multiplier: number    // Public good multiplier (e.g. 1.6 → MPCR = 0.4 with 4 players)
  rounds: number
  groupSize: number     // Target group size (for display; actual = player count)
}

export type ContributionPlayer = {
  id: string
  name: string
  isBot: boolean
  totalScore: number
  contributedThisRound?: number
  hasActedThisRound: boolean
}

export type ContributionRoundSummary = {
  round: number
  contributions: Record<string, number>   // playerId → contribution
  totalContributed: number
  publicGoodShare: number                 // Each player's share of public good
  payoffs: Record<string, number>         // playerId → total payoff this round
  avgContribution: number
}

export type ContributionSession = {
  roomCode: string
  hostToken: string
  phase: 'lobby' | 'playing' | 'results'
  config: ContributionConfig
  players: ContributionPlayer[]
  currentRound: number
  history: ContributionRoundSummary[]
  eventLog: string[]
  createdAt: number
  lastActivityAt: number
}

const SESSION_TTL_MS = 2 * 60 * 60 * 1000
const sessions = new Map<string, ContributionSession>()

export function cleanupContributionSessions(): void {
  const now = Date.now()
  for (const [code, s] of sessions) {
    if (now - s.lastActivityAt > SESSION_TTL_MS) sessions.delete(code)
  }
}

export function getContributionSession(roomCode: string): ContributionSession | undefined {
  cleanupContributionSessions()
  return sessions.get(roomCode.toUpperCase())
}

export function setContributionSession(session: ContributionSession): void {
  session.lastActivityAt = Date.now()
  sessions.set(session.roomCode, session)
}

export function createContributionSession(
  roomCode: string,
  hostToken: string,
  config: ContributionConfig
): ContributionSession {
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

export function addContributionPlayer(
  session: ContributionSession,
  id: string,
  name: string,
  isBot = false
): ContributionPlayer {
  const player: ContributionPlayer = {
    id, name, isBot,
    totalScore: 0,
    hasActedThisRound: false,
  }
  session.players.push(player)
  session.eventLog.push(`${name} joined.`)
  if (session.eventLog.length > 40) session.eventLog.shift()
  return player
}

export function submitContribution(
  session: ContributionSession,
  playerId: string,
  amount: number
): { ok: boolean; error?: string } {
  const player = session.players.find(p => p.id === playerId)
  if (!player) return { ok: false, error: 'Player not found' }
  if (player.hasActedThisRound) return { ok: false, error: 'Already contributed this round' }

  const clamped = Math.max(0, Math.min(session.config.endowment, Math.round(amount)))
  player.contributedThisRound = clamped
  player.hasActedThisRound = true

  session.eventLog.push(`${player.name} submitted their contribution.`)
  if (session.eventLog.length > 40) session.eventLog.shift()
  return { ok: true }
}

export function isContributionRoundComplete(session: ContributionSession): boolean {
  return session.players.filter(p => !p.isBot).every(p => p.hasActedThisRound)
}

export function processContributionRound(session: ContributionSession): void {
  const { endowment, multiplier } = session.config
  const n = session.players.length

  // Fill in bot contributions (random, slightly below average for realism)
  for (const bot of session.players.filter(p => p.isBot)) {
    if (!bot.hasActedThisRound) {
      bot.contributedThisRound = Math.floor(endowment * (0.3 + Math.random() * 0.4))
      bot.hasActedThisRound = true
    }
  }

  const contributions: Record<string, number> = {}
  let totalContributed = 0

  for (const p of session.players) {
    const c = p.contributedThisRound ?? 0
    contributions[p.id] = c
    totalContributed += c
  }

  const publicGoodShare = (multiplier * totalContributed) / n
  const payoffs: Record<string, number> = {}

  for (const p of session.players) {
    const kept = endowment - contributions[p.id]
    const payoff = kept + publicGoodShare
    payoffs[p.id] = Math.round(payoff * 10) / 10
    p.totalScore += payoffs[p.id]
  }

  const summary: ContributionRoundSummary = {
    round: session.currentRound,
    contributions,
    totalContributed,
    publicGoodShare: Math.round(publicGoodShare * 10) / 10,
    payoffs,
    avgContribution: Math.round((totalContributed / n) * 10) / 10,
  }
  session.history.push(summary)

  session.eventLog.push(
    `Round ${session.currentRound}: Total contributed ${totalContributed}. ` +
    `Public good share per player: ${summary.publicGoodShare.toFixed(1)}.`
  )
  if (session.eventLog.length > 40) session.eventLog.shift()

  // Reset for next round
  for (const p of session.players) {
    p.hasActedThisRound = false
    p.contributedThisRound = undefined
  }

  if (session.currentRound >= session.config.rounds) {
    session.phase = 'results'
    session.eventLog.push('Game complete!')
  } else {
    session.currentRound += 1
  }
}
