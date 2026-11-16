import { Router } from 'express'
import { randomUUID } from 'crypto'
import { MiniGameSessionStatus, MiniGameType, Prisma } from '@prisma/client'
import { prisma } from '../db'
import { getSession, getSessionCookie } from '../sessionStore'
import { claimUniqueRoomCode, releaseRoomCode } from '../minigames/roomCodeRegistry'
import type { Request } from 'express'
import {
  type SequentialSession,
  addSequentialPlayer,
  submitOffer,
  submitResponse,
  getCurrentRoundState,
  getBotOffer,
} from '../engines/sequentialEngine'

const router = Router()
const GAME_SLUG = 'trust-game'
const GAME_TYPE = MiniGameType.TRUST_GAME
const RUNTIME_KEY = 'trustRuntime'

const TRUST_CONFIG = {
  variant: 'trust' as const,
  endowment: 100,
  multiplier: 3,
  rounds: 5,
}

function requireEducatorId(req: Request): string | null {
  const sid = getSessionCookie(req, 'educator')
  const s = getSession(sid)
  if (!s || s.role !== 'educator' || !s.educatorId) return null
  return s.educatorId
}

function asRuntime(configJson: Prisma.JsonValue | null): SequentialSession | null {
  if (configJson && typeof configJson === 'object' && !Array.isArray(configJson)) {
    const cfg = configJson as Record<string, unknown>
    if (cfg[RUNTIME_KEY]) return cfg[RUNTIME_KEY] as SequentialSession
  }
  return null
}

function toStatus(phase: string): MiniGameSessionStatus {
  if (phase === 'lobby') return MiniGameSessionStatus.LOBBY
  if (phase === 'playing') return MiniGameSessionStatus.ACTIVE
  return MiniGameSessionStatus.COMPLETED
}

function toPublicSession(rt: SequentialSession, viewerToken?: string) {
  const viewer = rt.players.find(p => p.id === viewerToken)
  const currentRound = getCurrentRoundState(rt)
  return {
    roomCode: rt.roomCode,
    phase: rt.phase,
    currentRound: rt.currentRound,
    roundStep: rt.roundStep,
    config: rt.config,
    players: rt.players.map(p => ({
      id: p.id, name: p.name, isBot: p.isBot,
      role: p.role, totalScore: p.totalScore,
    })),
    rounds: rt.rounds,
    eventLog: rt.eventLog,
    currentRoundState: currentRound
      ? { round: currentRound.round, offer: currentRound.offer, settled: currentRound.settled }
      : null,
    viewer: viewer
      ? { role: viewer.role, totalScore: viewer.totalScore, isProposer: viewer.role === 'proposer' }
      : null,
  }
}

function defaultSessionRuntime(roomCode: string, hostToken: string): SequentialSession {
  return {
    roomCode, hostToken, phase: 'lobby',
    config: TRUST_CONFIG,
    players: [], currentRound: 1, roundStep: 'offer', rounds: [],
    eventLog: ['Trust Game ready. Waiting for players...'],
    createdAt: Date.now(), lastActivityAt: Date.now(),
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

async function saveRuntime(id: string, rt: SequentialSession) {
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
    const rt: SequentialSession = {
      roomCode, hostToken, phase: 'lobby',
      config: TRUST_CONFIG,
      players: [], currentRound: 1, roundStep: 'offer', rounds: [],
      eventLog: ['Trust Game created. Waiting for players...'],
      createdAt: Date.now(), lastActivityAt: Date.now(),
    }
    await prisma.miniGameSession.create({
      data: {
        educatorId, gameType: GAME_TYPE, roomCode, hostToken,
        status: MiniGameSessionStatus.LOBBY, teamCount: 2,
        configJson: { [RUNTIME_KEY]: rt } as unknown as Prisma.InputJsonValue,
      },
    })
    return res.json({ success: true, roomCode, hostToken, session: toPublicSession(rt) })
  } catch (err) {
    if (roomCode) releaseRoomCode(roomCode)
    console.error('Trust create error:', err)
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

    const rt: SequentialSession = {
      roomCode, hostToken, phase: 'playing',
      config: TRUST_CONFIG,
      players: [], currentRound: 1, roundStep: 'offer', rounds: [],
      eventLog: ['Solo Trust Game started.'],
      createdAt: Date.now(), lastActivityAt: Date.now(),
    }
    const human = addSequentialPlayer(rt, playerToken, name)
    human.id = playerToken
    addSequentialPlayer(rt, randomUUID(), 'Bot (Trustee)', true)

    // Bot auto-starts as responder; if human is proposer, auto-start round
    await prisma.miniGameSession.create({
      data: {
        educatorId, gameType: GAME_TYPE, roomCode, hostToken,
        status: MiniGameSessionStatus.ACTIVE, teamCount: 2,
        configJson: { [RUNTIME_KEY]: rt } as unknown as Prisma.InputJsonValue,
      },
    })
    return res.json({ success: true, roomCode, hostToken, playerToken, session: toPublicSession(rt, playerToken) })
  } catch (err) {
    if (roomCode) releaseRoomCode(roomCode)
    console.error('Trust solo error:', err)
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
      const rows = await tx.$queryRawUnsafe<Array<{
        id: string
        hostToken: string
        configJson: Prisma.JsonValue | null
        status: MiniGameSessionStatus
      }>>(
        `SELECT id, "hostToken", "configJson", status FROM "MiniGameSession" WHERE "roomCode" = $1 FOR UPDATE`,
        roomCode,
      )
      const record = rows[0]
      if (!record) throw new Error('ROOM_NOT_FOUND')
      const rt = asRuntime(record.configJson) ?? defaultSessionRuntime(roomCode, record.hostToken ?? '')
      if (rt.phase !== 'lobby') throw new Error('GAME_ALREADY_STARTED')
      if (rt.players.length >= 2) throw new Error('ROOM_FULL')
      if (rt.players.some((p) => p.name.toLowerCase() === name.toLowerCase())) throw new Error('NAME_IN_USE')
      const playerToken = randomUUID()
      const player = addSequentialPlayer(rt, playerToken, name)
      player.id = playerToken
      if (rt.players.length === 2) {
        rt.phase = 'playing'
        rt.eventLog.push('Trust Game started! Investor: decide how much to send.')
      }
      await tx.miniGameSession.update({
        where: { id: record.id },
        data: { status: toStatus(rt.phase), configJson: { [RUNTIME_KEY]: rt } as unknown as Prisma.InputJsonValue },
      })
      return { playerToken, rt }
    })
    return res.json({ success: true, playerToken: result.playerToken, session: toPublicSession(result.rt, result.playerToken) })
  } catch (err) {
    const msg = err instanceof Error ? err.message : ''
    if (msg === 'ROOM_NOT_FOUND') return res.status(404).json({ success: false, error: 'Room not found' })
    if (msg === 'GAME_ALREADY_STARTED') return res.status(400).json({ success: false, error: 'Game already started' })
    if (msg === 'ROOM_FULL') return res.status(400).json({ success: false, error: 'Room is full (max 2 players)' })
    if (msg === 'NAME_IN_USE') return res.status(400).json({ success: false, error: 'Name already used in this room' })
    console.error('Trust join error:', err)
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

    const rt = asRuntime(record.configJson) ?? defaultSessionRuntime(roomCode, record.hostToken ?? '')

    const isHost = !!hostToken && hostToken === record.hostToken
    const viewerId = rt.players.find(p => p.id === playerToken)?.id
    return res.json({ success: true, session: toPublicSession(rt, viewerId), isHost })
  } catch (err) {
    console.error('Trust state error:', err)
    return res.status(500).json({ success: false, error: 'Failed to get state' })
  }
})

// --- ACTION (offer or response) ---
router.post(`/${GAME_SLUG}/:roomCode/action`, async (req, res) => {
  const roomCode = req.params.roomCode.toUpperCase()
  const body = req.body as { playerToken?: string; actionType?: 'offer' | 'response'; amount?: number }

  try {
    const record = await loadSession(roomCode)
    if (!record) return res.status(404).json({ success: false, error: 'Room not found' })

    const rt = asRuntime(record.configJson)
    if (!rt) return res.status(500).json({ success: false, error: 'Invalid session state' })
    if (rt.phase !== 'playing') return res.status(400).json({ success: false, error: 'Game not active' })

    const player = rt.players.find(p => p.id === body.playerToken)
    if (!player) return res.status(403).json({ success: false, error: 'Player not found' })

    let result: { ok: boolean; error?: string }
    if (body.actionType === 'offer') {
      // Auto-advance bot if needed
      const botResult = submitOffer(rt, player.id, body.amount ?? 0)
      result = botResult
    } else if (body.actionType === 'response') {
      result = submitResponse(rt, player.id, body.amount ?? 0)
    } else {
      // Infer from roundStep
      if (rt.roundStep === 'offer') {
        result = submitOffer(rt, player.id, body.amount ?? 0)
      } else {
        result = submitResponse(rt, player.id, body.amount ?? 0)
      }
    }

    if (!result.ok) return res.status(400).json({ success: false, error: result.error })

    // If proposer is bot and we need a bot offer at round start
    if (rt.roundStep === 'offer') {
      const currentRound = rt.rounds.find(r => r.round === rt.currentRound)
      const proposer = rt.players.find(p => p.role === 'proposer')
      if (proposer?.isBot && !currentRound?.offer) {
        submitOffer(rt, proposer.id, getBotOffer(rt))
      }
    }

    await saveRuntime(record.id, rt)
    return res.json({ success: true, session: toPublicSession(rt, player.id) })
  } catch (err) {
    console.error('Trust action error:', err)
    return res.status(500).json({ success: false, error: 'Failed to submit action' })
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

    const rt = asRuntime(record.configJson) ?? defaultSessionRuntime(roomCode, record.hostToken ?? '')
    if (rt.phase !== 'lobby') return res.status(400).json({ success: false, error: 'Already started' })
    if (rt.players.length < 2) return res.status(400).json({ success: false, error: 'Need at least 2 players' })

    rt.phase = 'playing'
    rt.eventLog.push('Trust Game started! Investor: decide how much to send.')

    // If proposer is a bot, auto-make offer
    const proposer = rt.players.find(p => p.role === 'proposer')
    if (proposer?.isBot) {
      submitOffer(rt, proposer.id, getBotOffer(rt))
    }

    await saveRuntime(record.id, rt)
    return res.json({ success: true, session: toPublicSession(rt) })
  } catch (err) {
    console.error('Trust start error:', err)
    return res.status(500).json({ success: false, error: 'Failed to start' })
  }
})

// --- ADVANCE ---
router.post(`/${GAME_SLUG}/:roomCode/advance`, async (req, res) => {
  const roomCode = req.params.roomCode.toUpperCase()
  const body = req.body as { hostToken?: string }

  try {
    const record = await loadSession(roomCode)
    if (!record) return res.status(404).json({ success: false, error: 'Room not found' })
    if (body.hostToken !== record.hostToken) return res.status(403).json({ success: false, error: 'Invalid host token' })

    const rt = asRuntime(record.configJson)
    if (!rt || rt.phase !== 'playing') return res.status(400).json({ success: false, error: 'Game not active' })

    // Host can force-advance: bot fills in missing actions
    const proposer = rt.players.find(p => p.role === 'proposer')
    const currentRound = getCurrentRoundState(rt)
    if (!currentRound?.offer && proposer) {
      submitOffer(rt, proposer.id, getBotOffer(rt))
    }

    await saveRuntime(record.id, rt)
    return res.json({ success: true, session: toPublicSession(rt) })
  } catch (err) {
    console.error('Trust advance error:', err)
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
    rt.roundStep = 'offer'
    rt.rounds = []
    rt.players = []
    rt.eventLog = ['Game reset. Waiting for players...']

    await saveRuntime(record.id, rt)
    return res.json({ success: true, session: toPublicSession(rt) })
  } catch (err) {
    console.error('Trust reset error:', err)
    return res.status(500).json({ success: false, error: 'Failed to reset' })
  }
})

export default router
