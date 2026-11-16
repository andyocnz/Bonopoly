/**
 * Social Influence Engine — "The Signal"
 *
 * Players are shown economic/finance statements and rate their confidence
 * (0 = definitely false, 100 = definitely true) before and after seeing
 * a social proof cue.
 *
 * Treatment groups (assigned randomly at join):
 *   "low"  — shown ~15–30% of others agree
 *   "high" — shown ~70–85% of others agree
 *
 * After all statements, results reveal how much each group shifted
 * toward the social proof signal — demonstrating information cascades
 * and conformity bias.
 *
 * Based on: Bikhchandani, Hirshleifer & Welch (1992); Asch (1951)
 */

import STATEMENTS_RAW from '../../data/signalStatements.json'

export type Statement = {
  id: string
  text: string
  type: 'clearly-false' | 'ambiguous' | 'counterintuitive-true'
  correct: boolean
  explanation: string
  topic: string
}

export const STATEMENTS: Statement[] = STATEMENTS_RAW as Statement[]

export type Treatment = 'low' | 'high'

export type PlayerResponse = {
  statementId: string
  confidence: number      // 0–100
  submittedAt: number
  responseTimeMs: number  // ms from round start to submission
}

export type SocialInfluencePlayer = {
  id: string
  name: string
  treatment: Treatment    // randomly assigned at join
  responses: PlayerResponse[]
  hasActedThisRound: boolean
}

export type RoundSummary = {
  statementId: string
  statementText: string
  statementType: 'clearly-false' | 'ambiguous' | 'counterintuitive-true'
  correct: boolean
  explanation: string
  topic: string
  socialProofLow: number   // % shown to low group
  socialProofHigh: number  // % shown to high group
  avgConfidenceLow: number | null
  avgConfidenceHigh: number | null
  avgResponseTimeMsLow: number | null
  avgResponseTimeMsHigh: number | null
  allResponses: { playerId: string; playerName: string; treatment: Treatment; confidence: number; responseTimeMs: number }[]
}

export type SocialInfluenceConfig = {
  totalRounds: number       // default 8
  secondsPerRound: number   // default 60
}

export type SocialInfluenceSession = {
  roomCode: string
  hostToken: string
  phase: 'lobby' | 'playing' | 'results'
  config: SocialInfluenceConfig
  players: SocialInfluencePlayer[]
  currentRound: number      // 1-indexed, which statement we're on
  history: RoundSummary[]
  eventLog: string[]
  createdAt: number
  lastActivityAt: number
  roundStartedAt?: number
}

const SESSION_TTL_MS = 4 * 60 * 60 * 1000
const sessions = new Map<string, SocialInfluenceSession>()

export function cleanupSocialInfluenceSessions(): void {
  const now = Date.now()
  for (const [code, s] of sessions) {
    if (now - s.lastActivityAt > SESSION_TTL_MS) sessions.delete(code)
  }
}

/** Assign treatment with balancing: keep groups as even as possible. */
function assignTreatment(session: SocialInfluenceSession): Treatment {
  const lowCount = session.players.filter(p => p.treatment === 'low').length
  const highCount = session.players.filter(p => p.treatment === 'high').length
  if (lowCount < highCount) return 'low'
  if (highCount < lowCount) return 'high'
  return Math.random() < 0.5 ? 'low' : 'high'
}

/** Generate synthetic social proof numbers.
 *  Low group sees 15–30%; high group sees 70–85%.
 *  Values are deterministic per (statementId) so all low-group players
 *  see the same number in a given round.
 */
export function getSocialProof(statementIndex: number): { low: number; high: number } {
  // Use a seeded-ish approach: vary by statement index
  const seed = (statementIndex * 17 + 7) % 16
  const low = 15 + seed   // 15–30
  const high = 70 + seed  // 70–85
  return { low, high }
}

export function addSocialInfluencePlayer(
  session: SocialInfluenceSession,
  id: string,
  name: string,
  treatment?: Treatment
): SocialInfluencePlayer {
  const player: SocialInfluencePlayer = {
    id, name,
    treatment: treatment ?? assignTreatment(session),
    responses: [],
    hasActedThisRound: false,
  }
  session.players.push(player)
  session.eventLog.push(`${name} joined.`)
  if (session.eventLog.length > 60) session.eventLog.shift()
  return player
}

export function startSocialInfluenceGame(session: SocialInfluenceSession): void {
  session.phase = 'playing'
  session.currentRound = 1
  session.roundStartedAt = Date.now()
  for (const p of session.players) p.hasActedThisRound = false
  const stmt = STATEMENTS[0]
  session.eventLog.push(`Game started! Round 1 of ${session.config.totalRounds}: "${stmt?.text.slice(0, 60)}…"`)
  if (session.eventLog.length > 60) session.eventLog.shift()
}

export function submitSocialInfluenceResponse(
  session: SocialInfluenceSession,
  playerId: string,
  confidence: number
): { ok: boolean; error?: string } {
  if (session.phase !== 'playing') return { ok: false, error: 'Game not active' }

  const player = session.players.find(p => p.id === playerId)
  if (!player) return { ok: false, error: 'Player not found' }

  const stmtIndex = session.currentRound - 1
  const stmt = STATEMENTS[stmtIndex]
  if (!stmt) return { ok: false, error: 'Statement not found' }

  const clamped = Math.max(0, Math.min(100, Math.round(confidence)))
  const responseTimeMs = session.roundStartedAt ? Math.max(0, Date.now() - session.roundStartedAt) : 0

  // Upsert: replace any existing response for this statement
  const existing = player.responses.findIndex(r => r.statementId === stmt.id)
  const response: PlayerResponse = { statementId: stmt.id, confidence: clamped, submittedAt: Date.now(), responseTimeMs }
  if (existing >= 0) {
    player.responses[existing] = response
  } else {
    player.responses.push(response)
    player.hasActedThisRound = true
  }

  session.lastActivityAt = Date.now()
  return { ok: true }
}

export function isRoundComplete(session: SocialInfluenceSession): boolean {
  const humanPlayers = session.players.filter(p => !('isBot' in p))
  if (humanPlayers.length === 0) return false
  return humanPlayers.every(p => p.hasActedThisRound)
}

export function advanceSocialInfluenceRound(session: SocialInfluenceSession): void {
  const stmtIndex = session.currentRound - 1
  const stmt = STATEMENTS[stmtIndex]
  if (!stmt) return

  const { low: spLow, high: spHigh } = getSocialProof(stmtIndex)

  const lowResponses = session.players.filter(p => p.treatment === 'low')
    .map(p => {
      const r = p.responses.find(r => r.statementId === stmt.id)
      return { playerId: p.id, playerName: p.name, treatment: 'low' as Treatment, confidence: r?.confidence ?? 50, responseTimeMs: r?.responseTimeMs ?? 0 }
    })
  const highResponses = session.players.filter(p => p.treatment === 'high')
    .map(p => {
      const r = p.responses.find(r => r.statementId === stmt.id)
      return { playerId: p.id, playerName: p.name, treatment: 'high' as Treatment, confidence: r?.confidence ?? 50, responseTimeMs: r?.responseTimeMs ?? 0 }
    })

  const avg = (arr: number[]) => arr.length > 0 ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null

  const summary: RoundSummary = {
    statementId: stmt.id,
    statementText: stmt.text,
    statementType: stmt.type,
    correct: stmt.correct,
    explanation: stmt.explanation,
    topic: stmt.topic,
    socialProofLow: spLow,
    socialProofHigh: spHigh,
    avgConfidenceLow: avg(lowResponses.map(r => r.confidence)),
    avgConfidenceHigh: avg(highResponses.map(r => r.confidence)),
    avgResponseTimeMsLow: avg(lowResponses.filter(r => r.responseTimeMs > 0).map(r => r.responseTimeMs)),
    avgResponseTimeMsHigh: avg(highResponses.filter(r => r.responseTimeMs > 0).map(r => r.responseTimeMs)),
    allResponses: [...lowResponses, ...highResponses],
  }
  session.history.push(summary)

  const diffStr = summary.avgConfidenceLow != null && summary.avgConfidenceHigh != null
    ? ` | Δ=${summary.avgConfidenceHigh - summary.avgConfidenceLow}`
    : ''
  session.eventLog.push(
    `Round ${session.currentRound} done. Low group avg: ${summary.avgConfidenceLow ?? '—'}, High group avg: ${summary.avgConfidenceHigh ?? '—'}${diffStr}`
  )
  if (session.eventLog.length > 60) session.eventLog.shift()

  if (session.currentRound >= session.config.totalRounds) {
    session.phase = 'results'
    session.eventLog.push('All rounds complete! Reviewing results...')
  } else {
    session.currentRound += 1
    session.roundStartedAt = Date.now()
    for (const p of session.players) p.hasActedThisRound = false
    const nextStmt = STATEMENTS[session.currentRound - 1]
    if (nextStmt) {
      session.eventLog.push(`Round ${session.currentRound}: "${nextStmt.text.slice(0, 60)}…"`)
    }
  }
  if (session.eventLog.length > 60) session.eventLog.shift()
}
