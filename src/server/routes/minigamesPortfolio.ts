/**
 * Portfolio Monte Carlo Mini-Game Routes
 *
 * Self-paced portfolio simulation with session-based leaderboard.
 * Flow: Educator creates session → shares link → students join and play independently → leaderboard
 */

import { Router } from 'express'
import { randomUUID } from 'crypto'

// ─── Types ───────────────────────────────────────────────────────────────

type PortfolioPhase = 'lobby' | 'active' | 'closed'

interface PortfolioAllocation {
  stocks: number
  bonds: number
  cash: number
}

interface RiskControls {
  rebalance: boolean
  stopLoss: boolean
  defensiveShift: boolean
}

interface PortfolioSubmission {
  playerId: string
  playerName: string
  allocation: PortfolioAllocation
  riskControls: RiskControls
  finalWealth: number
  sharpeRatio: number
  targetProb: number
  bigLossProb: number
  score: number
  submittedAt: number
}

interface PortfolioSession {
  roomCode: string
  hostToken: string
  createdAt: number
  updatedAt: number
  phase: PortfolioPhase
  title: string
  description: string
  players: Array<{ id: string; token: string; name: string }>
  submissions: PortfolioSubmission[]
}

// ─── Storage ─────────────────────────────────────────────────────────────

const router = Router()
const portfolioSessions = new Map<string, PortfolioSession>()
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days for async submissions

// ─── Utilities ───────────────────────────────────────────────────────────

function cleanupPortfolioSessions() {
  const now = Date.now()
  for (const [code, session] of portfolioSessions.entries()) {
    if (now - session.updatedAt > SESSION_TTL_MS) {
      portfolioSessions.delete(code)
    }
  }
}

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let out = ''
  for (let i = 0; i < 6; i += 1) out += chars[Math.floor(Math.random() * chars.length)]
  return out
}

function uniqueRoomCode(): string {
  let code = generateRoomCode()
  while (portfolioSessions.has(code)) code = generateRoomCode()
  return code
}

function toPublicSession(session: PortfolioSession, includeTokens = false) {
  return {
    roomCode: session.roomCode,
    phase: session.phase,
    title: session.title,
    description: session.description,
    playerCount: session.players.length,
    submissionCount: session.submissions.length,
    players: session.players.map(p => ({
      id: p.id,
      name: p.name,
      hasSubmitted: session.submissions.some(s => s.playerId === p.id),
      ...(includeTokens ? { token: p.token } : {}),
    })),
    leaderboard: session.submissions
      .sort((a, b) => b.score - a.score)
      .map((sub, index) => ({
        rank: index + 1,
        playerName: sub.playerName,
        allocation: sub.allocation,
        riskControls: sub.riskControls,
        finalWealth: sub.finalWealth,
        sharpeRatio: sub.sharpeRatio,
        targetProb: sub.targetProb,
        bigLossProb: sub.bigLossProb,
        score: sub.score,
        submittedAt: sub.submittedAt,
      })),
  }
}

function findPlayerByToken(session: PortfolioSession, token: string) {
  return session.players.find(p => p.token === token)
}

// ─── Routes ──────────────────────────────────────────────────────────────

/**
 * POST /portfolio/create
 * Educator creates a new portfolio game session
 */
router.post('/portfolio/create', (req, res) => {
  cleanupPortfolioSessions()
  const body = req.body as { title?: string; description?: string }

  const title = String(body?.title || 'Portfolio Challenge').trim().slice(0, 100)
  const description = String(body?.description || 'Manage your portfolio through 6 market scenarios').trim().slice(0, 500)

  const roomCode = uniqueRoomCode()
  const hostToken = randomUUID()
  const now = Date.now()

  const session: PortfolioSession = {
    roomCode,
    hostToken,
    createdAt: now,
    updatedAt: now,
    phase: 'active',
    title,
    description,
    players: [],
    submissions: [],
  }

  portfolioSessions.set(roomCode, session)

  return res.json({
    success: true,
    roomCode,
    hostToken,
    session: toPublicSession(session),
  })
})

/**
 * POST /portfolio/:roomCode/join
 * Student joins a portfolio game session
 */
router.post('/portfolio/:roomCode/join', (req, res) => {
  cleanupPortfolioSessions()
  const roomCode = String(req.params.roomCode || '').toUpperCase()
  const session = portfolioSessions.get(roomCode)

  if (!session) {
    return res.status(404).json({ success: false, error: 'Session not found or expired' })
  }

  if (session.phase === 'closed') {
    return res.status(400).json({ success: false, error: 'This session is closed' })
  }

  const body = req.body as { name?: string }
  const name = String(body?.name || '').trim().slice(0, 50)

  if (!name) {
    return res.status(400).json({ success: false, error: 'Name is required' })
  }

  // Check if name already exists
  if (session.players.some(p => p.name.toLowerCase() === name.toLowerCase())) {
    return res.status(400).json({ success: false, error: 'Name already taken in this session' })
  }

  if (session.players.length >= 200) {
    return res.status(400).json({ success: false, error: 'Session is full' })
  }

  const player = {
    id: randomUUID(),
    token: randomUUID(),
    name,
  }

  session.players.push(player)
  session.updatedAt = Date.now()

  return res.json({
    success: true,
    playerToken: player.token,
    playerId: player.id,
    session: toPublicSession(session),
  })
})

/**
 * GET /portfolio/:roomCode/state
 * Get current session state (for polling or initial load)
 */
router.get('/portfolio/:roomCode/state', (req, res) => {
  cleanupPortfolioSessions()
  const roomCode = String(req.params.roomCode || '').toUpperCase()
  const session = portfolioSessions.get(roomCode)

  if (!session) {
    return res.status(404).json({ success: false, error: 'Session not found or expired' })
  }

  const playerToken = typeof req.query.playerToken === 'string' ? req.query.playerToken : null
  const hostToken = typeof req.query.hostToken === 'string' ? req.query.hostToken : null

  const isHost = hostToken === session.hostToken
  const player = playerToken ? findPlayerByToken(session, playerToken) : undefined
  const hasSubmitted = player ? session.submissions.some(s => s.playerId === player.id) : false

  session.updatedAt = Date.now()

  return res.json({
    success: true,
    session: toPublicSession(session),
    viewer: {
      isHost,
      playerId: player?.id ?? null,
      playerName: player?.name ?? null,
      hasSubmitted,
    },
  })
})

/**
 * POST /portfolio/:roomCode/submit
 * Student submits their portfolio results
 */
router.post('/portfolio/:roomCode/submit', (req, res) => {
  cleanupPortfolioSessions()
  const roomCode = String(req.params.roomCode || '').toUpperCase()
  const session = portfolioSessions.get(roomCode)

  if (!session) {
    return res.status(404).json({ success: false, error: 'Session not found or expired' })
  }

  if (session.phase === 'closed') {
    return res.status(400).json({ success: false, error: 'This session is closed' })
  }

  const body = req.body as {
    playerToken?: string
    allocation?: PortfolioAllocation
    riskControls?: RiskControls
    finalWealth?: number
    sharpeRatio?: number
    targetProb?: number
    bigLossProb?: number
    score?: number
  }

  const token = String(body?.playerToken || '')
  const player = findPlayerByToken(session, token)

  if (!player) {
    return res.status(401).json({ success: false, error: 'Invalid player token' })
  }

  // Validate submission data
  if (!body.allocation || !body.riskControls) {
    return res.status(400).json({ success: false, error: 'Missing required data' })
  }

  const { allocation, riskControls, finalWealth = 0, sharpeRatio = 0, targetProb = 0, bigLossProb = 0, score = 0 } = body

  // Validate allocation sums to 100
  const total = allocation.stocks + allocation.bonds + allocation.cash
  if (Math.abs(total - 100) > 0.01) {
    return res.status(400).json({ success: false, error: 'Allocation must total 100%' })
  }

  // Check if player already submitted (allow resubmission - keep latest)
  const existingIndex = session.submissions.findIndex(s => s.playerId === player.id)

  const submission: PortfolioSubmission = {
    playerId: player.id,
    playerName: player.name,
    allocation,
    riskControls,
    finalWealth,
    sharpeRatio,
    targetProb,
    bigLossProb,
    score,
    submittedAt: Date.now(),
  }

  if (existingIndex >= 0) {
    // Replace existing submission
    session.submissions[existingIndex] = submission
  } else {
    // Add new submission
    session.submissions.push(submission)
  }

  session.updatedAt = Date.now()

  return res.json({
    success: true,
    message: existingIndex >= 0 ? 'Results updated' : 'Results submitted',
    session: toPublicSession(session),
  })
})

/**
 * POST /portfolio/:roomCode/close
 * Host closes the session (no more submissions)
 */
router.post('/portfolio/:roomCode/close', (req, res) => {
  cleanupPortfolioSessions()
  const roomCode = String(req.params.roomCode || '').toUpperCase()
  const session = portfolioSessions.get(roomCode)

  if (!session) {
    return res.status(404).json({ success: false, error: 'Session not found or expired' })
  }

  const body = req.body as { hostToken?: string }
  if (body?.hostToken !== session.hostToken) {
    return res.status(401).json({ success: false, error: 'Invalid host token' })
  }

  session.phase = 'closed'
  session.updatedAt = Date.now()

  return res.json({
    success: true,
    session: toPublicSession(session),
  })
})

/**
 * POST /portfolio/:roomCode/reopen
 * Host reopens the session (allow more submissions)
 */
router.post('/portfolio/:roomCode/reopen', (req, res) => {
  cleanupPortfolioSessions()
  const roomCode = String(req.params.roomCode || '').toUpperCase()
  const session = portfolioSessions.get(roomCode)

  if (!session) {
    return res.status(404).json({ success: false, error: 'Session not found or expired' })
  }

  const body = req.body as { hostToken?: string }
  if (body?.hostToken !== session.hostToken) {
    return res.status(401).json({ success: false, error: 'Invalid host token' })
  }

  session.phase = 'active'
  session.updatedAt = Date.now()

  return res.json({
    success: true,
    session: toPublicSession(session),
  })
})

export default router
