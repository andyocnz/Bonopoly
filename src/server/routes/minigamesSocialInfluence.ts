import { Router } from 'express'
import { randomUUID } from 'crypto'
import { MiniGameSessionStatus, MiniGameType, Prisma } from '@prisma/client'
import { prisma } from '../db'
import { getSession, getSessionCookie } from '../sessionStore'
import { claimUniqueRoomCode, releaseRoomCode } from '../minigames/roomCodeRegistry'
import type { Request } from 'express'
import {
  type SocialInfluenceSession,
  addSocialInfluencePlayer,
  startSocialInfluenceGame,
  submitSocialInfluenceResponse,
  advanceSocialInfluenceRound,
  getSocialProof,
  STATEMENTS,
} from '../engines/socialInfluenceEngine'

const router = Router()
const GAME_SLUG = 'social-influence'
const GAME_TYPE = MiniGameType.SOCIAL_INFLUENCE
const RUNTIME_KEY = 'socialInfluenceRuntime'

const DEFAULT_CONFIG = {
  totalRounds: 9,
  secondsPerRound: 60,
}

function requireEducatorId(req: Request): string | null {
  const sid = getSessionCookie(req, 'educator')
  const s = getSession(sid)
  if (!s || s.role !== 'educator' || !s.educatorId) return null
  return s.educatorId
}

function asRuntime(configJson: Prisma.JsonValue | null): SocialInfluenceSession | null {
  if (configJson && typeof configJson === 'object' && !Array.isArray(configJson)) {
    const cfg = configJson as Record<string, unknown>
    if (cfg[RUNTIME_KEY]) return cfg[RUNTIME_KEY] as SocialInfluenceSession
  }
  return null
}

function toStatus(phase: string): MiniGameSessionStatus {
  if (phase === 'lobby') return MiniGameSessionStatus.LOBBY
  if (phase === 'playing') return MiniGameSessionStatus.ACTIVE
  return MiniGameSessionStatus.COMPLETED
}

function toPublicSession(rt: SocialInfluenceSession, viewerToken?: string) {
  const viewer = rt.players.find(p => p.id === viewerToken)
  const stmtIndex = rt.currentRound - 1
  const currentStatement = rt.phase === 'playing' ? STATEMENTS[stmtIndex] : null
  const { low: spLow, high: spHigh } = getSocialProof(stmtIndex)

  const humanPlayers = rt.players
  const actedCount = humanPlayers.filter(p => p.hasActedThisRound).length

  // Social proof shown to the viewer depends on their treatment
  const viewerProof = viewer
    ? (viewer.treatment === 'high' ? spHigh : spLow)
    : null

  // Reveal to viewer whether they've responded this round
  const viewerResponse = viewer && currentStatement
    ? viewer.responses.find(r => r.statementId === currentStatement.id)?.confidence ?? null
    : null

  const roundEndsAt = rt.roundStartedAt
    ? rt.roundStartedAt + rt.config.secondsPerRound * 1000
    : null

  // Personalized per-round history shown in results debrief
  const viewerHistory = viewer && rt.phase === 'results'
    ? rt.history.map(r => {
        const mine = r.allResponses.find(a => a.playerId === viewer.id)
        return {
          statementId: r.statementId,
          statementType: r.statementType,
          socialProofShown: viewer.treatment === 'high' ? r.socialProofHigh : r.socialProofLow,
          myConfidence: mine?.confidence ?? null,
          myResponseTimeMs: mine?.responseTimeMs ?? null,
          myGroupAvg: viewer.treatment === 'low' ? r.avgConfidenceLow : r.avgConfidenceHigh,
          oppositeGroupAvg: viewer.treatment === 'low' ? r.avgConfidenceHigh : r.avgConfidenceLow,
        }
      })
    : null

  return {
    roomCode: rt.roomCode,
    phase: rt.phase,
    currentRound: rt.currentRound,
    config: rt.config,
    playerCount: rt.players.length,
    actedCount,
    eventLog: rt.eventLog,
    history: rt.history,
    roundEndsAt,
    // Statement text shown to all; social proof tailored per viewer
    currentStatement: currentStatement ? {
      id: currentStatement.id,
      text: currentStatement.text,
      topic: currentStatement.topic,
    } : null,
    viewerSocialProof: viewerProof,
    viewerResponse,
    viewer: viewer ? { treatment: viewer.treatment, responsesCount: viewer.responses.length } : null,
    viewerHistory,
    // Host sees all player names and treatments (for debrief)
    players: rt.players.map(p => ({
      id: p.id, name: p.name, treatment: p.treatment,
      hasActedThisRound: p.hasActedThisRound,
      responsesCount: p.responses.length,
    })),
  }
}

async function allocateRoomCode(): Promise<string> {
  for (let i = 0; i < 200; i++) {
    const code = claimUniqueRoomCode()
    const existing = await prisma.miniGameSession.findFirst({ where: { roomCode: code }, select: { id: true } })
    if (!existing) return code
    releaseRoomCode(code)
  }
  throw new Error('Unable to generate unique room code')
}

async function loadSession(roomCode: string) {
  return prisma.miniGameSession.findFirst({
    where: { roomCode: roomCode.toUpperCase(), gameType: GAME_TYPE },
    select: { id: true, hostToken: true, configJson: true, status: true },
  })
}

async function saveRuntime(id: string, rt: SocialInfluenceSession) {
  await prisma.miniGameSession.update({
    where: { id },
    data: {
      status: toStatus(rt.phase),
      configJson: { [RUNTIME_KEY]: rt } as unknown as Prisma.InputJsonValue,
    },
  })
}

// --- CREATE ---
router.post(`/${GAME_SLUG}/create`, async (req, res) => {
  const educatorId = requireEducatorId(req)
  if (!educatorId) return res.status(401).json({ success: false, error: 'Educator login required' })

  let roomCode: string | null = null
  try {
    roomCode = await allocateRoomCode()
    const hostToken = randomUUID()
    const rt: SocialInfluenceSession = {
      roomCode, hostToken, phase: 'lobby',
      config: DEFAULT_CONFIG,
      players: [], currentRound: 1, history: [],
      eventLog: ['The Signal created. Waiting for players...'],
      createdAt: Date.now(), lastActivityAt: Date.now(),
    }
    await prisma.miniGameSession.create({
      data: {
        educatorId, gameType: GAME_TYPE, roomCode, hostToken,
        status: MiniGameSessionStatus.LOBBY, teamCount: 30,
        configJson: { [RUNTIME_KEY]: rt } as unknown as Prisma.InputJsonValue,
      },
    })
    return res.json({ success: true, roomCode, hostToken, session: toPublicSession(rt) })
  } catch (err) {
    if (roomCode) releaseRoomCode(roomCode)
    console.error('SI create error:', err)
    return res.status(500).json({ success: false, error: 'Failed to create game' })
  }
})

// --- SOLO ---
router.post(`/${GAME_SLUG}/solo`, async (req, res) => {
  const educatorId = requireEducatorId(req)
  if (!educatorId) return res.status(401).json({ success: false, error: 'Educator login required' })
  const body = req.body as { name?: string }
  const name = String(body?.name || 'Player').trim().slice(0, 24) || 'Player'
  let roomCode: string | null = null
  try {
    roomCode = await allocateRoomCode()
    const hostToken = randomUUID()
    const playerToken = randomUUID()
    const rt: SocialInfluenceSession = {
      roomCode, hostToken, phase: 'playing',
      config: DEFAULT_CONFIG,
      players: [], currentRound: 1, history: [],
      eventLog: ['Solo test started.'],
      createdAt: Date.now(), lastActivityAt: Date.now(),
    }
    const player = addSocialInfluencePlayer(rt, playerToken, name)
    player.id = playerToken
    startSocialInfluenceGame(rt)
    await prisma.miniGameSession.create({
      data: {
        educatorId, gameType: GAME_TYPE, roomCode, hostToken,
        status: MiniGameSessionStatus.ACTIVE, teamCount: 1,
        configJson: { [RUNTIME_KEY]: rt } as unknown as Prisma.InputJsonValue,
      },
    })
    return res.json({ success: true, roomCode, hostToken, playerToken, session: toPublicSession(rt, playerToken) })
  } catch (err) {
    if (roomCode) releaseRoomCode(roomCode)
    console.error('SI solo error:', err)
    return res.status(500).json({ success: false, error: 'Failed to create solo game' })
  }
})

// --- JOIN ---
router.post(`/${GAME_SLUG}/:roomCode/join`, async (req, res) => {
  const roomCode = req.params.roomCode.toUpperCase()
  const body = req.body as { name?: string }
  const name = String(body?.name || 'Player').trim().slice(0, 24) || 'Player'

  try {
    const result = await prisma.$transaction(async (tx) => {
      const record = await tx.miniGameSession.findFirst({
        where: { roomCode, gameType: GAME_TYPE },
        select: { id: true, hostToken: true, configJson: true, status: true },
      })
      if (!record) throw new Error('ROOM_NOT_FOUND')
      let rt = asRuntime(record.configJson)
      if (!rt) {
        rt = {
          roomCode, hostToken: record.hostToken ?? '', phase: 'lobby',
          config: DEFAULT_CONFIG, players: [], currentRound: 1, history: [],
          eventLog: ['Game ready. Waiting for players...'],
          createdAt: Date.now(), lastActivityAt: Date.now(),
        }
      }
      if (rt.phase !== 'lobby') throw new Error('GAME_ALREADY_STARTED')
      if (rt.players.length >= 60) throw new Error('ROOM_FULL')
      if (rt.players.some(p => p.name.toLowerCase() === name.toLowerCase())) throw new Error('NAME_IN_USE')

      const playerToken = randomUUID()
      const player = addSocialInfluencePlayer(rt, playerToken, name)
      player.id = playerToken

      await tx.miniGameSession.update({
        where: { id: record.id },
        data: {
          status: toStatus(rt.phase),
          configJson: { [RUNTIME_KEY]: rt } as unknown as Prisma.InputJsonValue,
        },
      })
      return { playerToken, rt }
    })
    return res.json({ success: true, playerToken: result.playerToken, session: toPublicSession(result.rt, result.playerToken) })
  } catch (err) {
    const msg = err instanceof Error ? err.message : ''
    if (msg === 'ROOM_NOT_FOUND') return res.status(404).json({ success: false, error: 'Room not found' })
    if (msg === 'GAME_ALREADY_STARTED') return res.status(400).json({ success: false, error: 'Game already started' })
    if (msg === 'ROOM_FULL') return res.status(400).json({ success: false, error: 'Room is full' })
    if (msg === 'NAME_IN_USE') return res.status(400).json({ success: false, error: 'Name already used in this room' })
    console.error('SI join error:', err)
    return res.status(500).json({ success: false, error: 'Failed to join' })
  }
})

// --- STATE ---
router.get(`/${GAME_SLUG}/:roomCode/state`, async (req, res) => {
  const roomCode = req.params.roomCode.toUpperCase()
  const { playerToken, hostToken } = req.query as Record<string, string>

  try {
    const record = await loadSession(roomCode)
    if (!record) return res.status(404).json({ success: false, error: 'Room not found' })

    let rt = asRuntime(record.configJson)
    if (!rt) {
      rt = {
        roomCode, hostToken: record.hostToken ?? '', phase: 'lobby',
        config: DEFAULT_CONFIG, players: [], currentRound: 1, history: [],
        eventLog: ['Game ready. Waiting for players...'],
        createdAt: Date.now(), lastActivityAt: Date.now(),
      }
      await saveRuntime(record.id, rt)
    }

    // Auto-advance on timer expiry
    if (
      rt.phase === 'playing' &&
      rt.roundStartedAt &&
      Date.now() - rt.roundStartedAt > rt.config.secondsPerRound * 1000
    ) {
      advanceSocialInfluenceRound(rt)
      await saveRuntime(record.id, rt)
    }

    const isHost = !!hostToken && hostToken === record.hostToken
    const viewerId = rt.players.find(p => p.id === playerToken)?.id
    return res.json({ success: true, session: toPublicSession(rt, viewerId), isHost })
  } catch (err) {
    console.error('SI state error:', err)
    return res.status(500).json({ success: false, error: 'Failed to get state' })
  }
})

// --- RESPOND (submit confidence) ---
router.post(`/${GAME_SLUG}/:roomCode/respond`, async (req, res) => {
  const roomCode = req.params.roomCode.toUpperCase()
  const body = req.body as { playerToken?: string; confidence?: number }

  try {
    const record = await loadSession(roomCode)
    if (!record) return res.status(404).json({ success: false, error: 'Room not found' })

    const rt = asRuntime(record.configJson)
    if (!rt) return res.status(500).json({ success: false, error: 'Invalid session state' })
    if (rt.phase !== 'playing') return res.status(400).json({ success: false, error: 'Game not active' })

    const result = submitSocialInfluenceResponse(rt, body.playerToken ?? '', body.confidence ?? 50)
    if (!result.ok) return res.status(400).json({ success: false, error: result.error })

    await saveRuntime(record.id, rt)
    const viewerId = rt.players.find(p => p.id === body.playerToken)?.id
    return res.json({ success: true, session: toPublicSession(rt, viewerId) })
  } catch (err) {
    console.error('SI respond error:', err)
    return res.status(500).json({ success: false, error: 'Failed to submit' })
  }
})

// --- START ---
router.post(`/${GAME_SLUG}/:roomCode/start`, async (req, res) => {
  const roomCode = req.params.roomCode.toUpperCase()
  const body = req.body as { hostToken?: string }

  try {
    const record = await loadSession(roomCode)
    if (!record) return res.status(404).json({ success: false, error: 'Room not found' })
    if (body.hostToken !== record.hostToken) return res.status(403).json({ success: false, error: 'Invalid host token' })

    const rt = asRuntime(record.configJson)
    if (!rt) return res.status(500).json({ success: false, error: 'Invalid session state' })
    if (rt.phase !== 'lobby') return res.status(400).json({ success: false, error: 'Already started' })
    if (rt.players.length < 2) return res.status(400).json({ success: false, error: 'Need at least 2 players' })

    startSocialInfluenceGame(rt)
    await saveRuntime(record.id, rt)
    return res.json({ success: true, session: toPublicSession(rt) })
  } catch (err) {
    console.error('SI start error:', err)
    return res.status(500).json({ success: false, error: 'Failed to start' })
  }
})

// --- ADVANCE (host force-advance to next round) ---
router.post(`/${GAME_SLUG}/:roomCode/advance`, async (req, res) => {
  const roomCode = req.params.roomCode.toUpperCase()
  const body = req.body as { hostToken?: string }

  try {
    const record = await loadSession(roomCode)
    if (!record) return res.status(404).json({ success: false, error: 'Room not found' })
    if (body.hostToken !== record.hostToken) return res.status(403).json({ success: false, error: 'Invalid host token' })

    const rt = asRuntime(record.configJson)
    if (!rt || rt.phase !== 'playing') return res.status(400).json({ success: false, error: 'Game not active' })

    advanceSocialInfluenceRound(rt)
    await saveRuntime(record.id, rt)
    return res.json({ success: true, session: toPublicSession(rt) })
  } catch (err) {
    console.error('SI advance error:', err)
    return res.status(500).json({ success: false, error: 'Failed to advance' })
  }
})

// --- RESET ---
router.post(`/${GAME_SLUG}/:roomCode/reset`, async (req, res) => {
  const roomCode = req.params.roomCode.toUpperCase()
  const body = req.body as { hostToken?: string }

  try {
    const record = await loadSession(roomCode)
    if (!record) return res.status(404).json({ success: false, error: 'Room not found' })
    if (body.hostToken !== record.hostToken) return res.status(403).json({ success: false, error: 'Invalid host token' })

    const rt = asRuntime(record.configJson)
    if (!rt) return res.status(500).json({ success: false, error: 'Invalid session state' })

    rt.phase = 'lobby'
    rt.currentRound = 1
    rt.history = []
    rt.players = []
    rt.roundStartedAt = undefined
    rt.eventLog = ['Game reset. Waiting for players...']

    await saveRuntime(record.id, rt)
    return res.json({ success: true, session: toPublicSession(rt) })
  } catch (err) {
    console.error('SI reset error:', err)
    return res.status(500).json({ success: false, error: 'Failed to reset' })
  }
})

export default router
