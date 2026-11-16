import { Router } from 'express'
import { randomUUID } from 'crypto'
import { MiniGameSessionStatus, MiniGameType, Prisma } from '@prisma/client'
import { prisma } from '../db'
import { getSession, getSessionCookie } from '../sessionStore'
import { claimUniqueRoomCode, releaseRoomCode } from '../minigames/roomCodeRegistry'
import type { Request } from 'express'
import {
  type AggregationSession,
  addAggregationPlayer,
  submitGuess,
  isAggregationRoundComplete,
  processAggregationRound,
} from '../engines/aggregationEngine'

const router = Router()
const GAME_SLUG = 'beauty-contest'
const GAME_TYPE = MiniGameType.BEAUTY_CONTEST
const RUNTIME_KEY = 'beautyContestRuntime'

const BEAUTY_CONTEST_CONFIG = {
  fraction: 2 / 3,
  guessMin: 0,
  guessMax: 100,
  rounds: 5,
  revealAfterEachRound: true,
}

function requireEducatorId(req: Request): string | null {
  const sid = getSessionCookie(req, 'educator')
  const s = getSession(sid)
  if (!s || s.role !== 'educator' || !s.educatorId) return null
  return s.educatorId
}

function asRuntime(configJson: Prisma.JsonValue | null): AggregationSession | null {
  if (configJson && typeof configJson === 'object' && !Array.isArray(configJson)) {
    const cfg = configJson as Record<string, unknown>
    if (cfg[RUNTIME_KEY]) return cfg[RUNTIME_KEY] as AggregationSession
  }
  return null
}

function toStatus(phase: string): MiniGameSessionStatus {
  if (phase === 'lobby') return MiniGameSessionStatus.LOBBY
  if (phase === 'playing') return MiniGameSessionStatus.ACTIVE
  return MiniGameSessionStatus.COMPLETED
}

function toPublicSession(rt: AggregationSession, viewerToken?: string) {
  const viewer = rt.players.find(p => p.id === viewerToken)
  const humanPlayers = rt.players.filter(p => !p.isBot)
  const actedCount = humanPlayers.filter(p => p.hasActedThisRound).length

  return {
    roomCode: rt.roomCode,
    phase: rt.phase,
    currentRound: rt.currentRound,
    config: rt.config,
    players: rt.players.map(p => ({
      id: p.id, name: p.name, isBot: p.isBot,
      totalWins: p.totalWins, totalScore: p.totalScore,
      hasActedThisRound: p.hasActedThisRound,
    })),
    history: rt.history,
    eventLog: rt.eventLog,
    stats: { actedCount, waitingCount: humanPlayers.length },
    viewer: viewer
      ? { totalWins: viewer.totalWins, totalScore: viewer.totalScore, hasActed: viewer.hasActedThisRound }
      : null,
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

async function saveRuntime(id: string, rt: AggregationSession) {
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
    const rt: AggregationSession = {
      roomCode, hostToken, phase: 'lobby',
      config: BEAUTY_CONTEST_CONFIG,
      players: [], currentRound: 1, history: [],
      eventLog: ['Beauty Contest created. Waiting for players...'],
      createdAt: Date.now(), lastActivityAt: Date.now(),
    }
    await prisma.miniGameSession.create({
      data: {
        educatorId, gameType: GAME_TYPE, roomCode, hostToken,
        status: MiniGameSessionStatus.LOBBY, teamCount: 20,
        configJson: { [RUNTIME_KEY]: rt } as unknown as Prisma.InputJsonValue,
      },
    })
    return res.json({ success: true, roomCode, hostToken, session: toPublicSession(rt) })
  } catch (err) {
    if (roomCode) releaseRoomCode(roomCode)
    console.error('BC create error:', err)
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

    const rt: AggregationSession = {
      roomCode, hostToken, phase: 'playing',
      config: BEAUTY_CONTEST_CONFIG,
      players: [], currentRound: 1, history: [],
      eventLog: ['Solo Beauty Contest started.'],
      createdAt: Date.now(), lastActivityAt: Date.now(),
    }
    const human = addAggregationPlayer(rt, playerToken, name)
    human.id = playerToken
    addAggregationPlayer(rt, randomUUID(), 'Bot A', true)
    addAggregationPlayer(rt, randomUUID(), 'Bot B', true)
    addAggregationPlayer(rt, randomUUID(), 'Bot C', true)

    await prisma.miniGameSession.create({
      data: {
        educatorId, gameType: GAME_TYPE, roomCode, hostToken,
        status: MiniGameSessionStatus.ACTIVE, teamCount: 4,
        configJson: { [RUNTIME_KEY]: rt } as unknown as Prisma.InputJsonValue,
      },
    })
    return res.json({ success: true, roomCode, hostToken, playerToken, session: toPublicSession(rt, playerToken) })
  } catch (err) {
    if (roomCode) releaseRoomCode(roomCode)
    console.error('BC solo error:', err)
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
      let rt = asRuntime(record.configJson)
      if (!rt) {
        rt = { roomCode, hostToken: record.hostToken ?? '', phase: 'lobby' as const, config: BEAUTY_CONTEST_CONFIG, players: [], currentRound: 1, history: [], eventLog: ['Game ready. Waiting for players...'], createdAt: Date.now(), lastActivityAt: Date.now() }
      }
      if (rt.phase !== 'lobby') throw new Error('GAME_ALREADY_STARTED')
      if (rt.players.length >= 20) throw new Error('ROOM_FULL')
      if (rt.players.some((p) => p.name.toLowerCase() === name.toLowerCase())) throw new Error('NAME_IN_USE')
      const playerToken = randomUUID()
      const player = addAggregationPlayer(rt, playerToken, name)
      player.id = playerToken
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
    if (msg === 'ROOM_FULL') return res.status(400).json({ success: false, error: 'Room is full (max 20 players)' })
    if (msg === 'NAME_IN_USE') return res.status(400).json({ success: false, error: 'Name already used in this room' })
    console.error('BC join error:', err)
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
        roomCode,
        hostToken: record.hostToken ?? '',
        phase: 'lobby',
        config: BEAUTY_CONTEST_CONFIG,
        players: [],
        currentRound: 1,
        history: [],
        eventLog: ['Game ready. Waiting for players...'],
        createdAt: Date.now(),
        lastActivityAt: Date.now(),
      }
      await saveRuntime(record.id, rt)
    }

    const isHost = !!hostToken && hostToken === record.hostToken
    const viewerId = rt.players.find(p => p.id === playerToken)?.id
    return res.json({ success: true, session: toPublicSession(rt, viewerId), isHost })
  } catch (err) {
    console.error('BC state error:', err)
    return res.status(500).json({ success: false, error: 'Failed to get state' })
  }
})

// --- ACTION (submit guess) ---
router.post(`/${GAME_SLUG}/:roomCode/action`, async (req, res) => {
  const roomCode = req.params.roomCode.toUpperCase()
  const body = req.body as { playerToken?: string; guess?: number }

  try {
    const record = await loadSession(roomCode)
    if (!record) return res.status(404).json({ success: false, error: 'Room not found' })

    const rt = asRuntime(record.configJson)
    if (!rt) return res.status(500).json({ success: false, error: 'Invalid session state' })
    if (rt.phase !== 'playing') return res.status(400).json({ success: false, error: 'Game not active' })

    const player = rt.players.find(p => p.id === body.playerToken)
    if (!player) return res.status(403).json({ success: false, error: 'Player not found' })

    const result = submitGuess(rt, player.id, body.guess ?? 50)
    if (!result.ok) return res.status(400).json({ success: false, error: result.error })

    if (isAggregationRoundComplete(rt)) {
      processAggregationRound(rt)
    }

    await saveRuntime(record.id, rt)
    return res.json({ success: true, session: toPublicSession(rt, player.id) })
  } catch (err) {
    console.error('BC action error:', err)
    return res.status(500).json({ success: false, error: 'Failed to submit guess' })
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

    let rt = asRuntime(record.configJson)
    if (!rt) {
      rt = { roomCode, hostToken: record.hostToken ?? '', phase: 'lobby' as const, config: BEAUTY_CONTEST_CONFIG, players: [], currentRound: 1, history: [], eventLog: ['Game ready. Waiting for players...'], createdAt: Date.now(), lastActivityAt: Date.now() }
      await saveRuntime(record.id, rt)
    }
    if (rt.phase !== 'lobby') return res.status(400).json({ success: false, error: 'Already started' })
    if (rt.players.length < 2) return res.status(400).json({ success: false, error: 'Need at least 2 players' })

    rt.phase = 'playing'
    const frac = Math.round(rt.config.fraction * 100)
    rt.eventLog.push(`Game started with ${rt.players.length} players! Guess a number 0–100. Winner = closest to ${frac}% of the average.`)

    await saveRuntime(record.id, rt)
    return res.json({ success: true, session: toPublicSession(rt) })
  } catch (err) {
    console.error('BC start error:', err)
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

    processAggregationRound(rt)
    await saveRuntime(record.id, rt)
    return res.json({ success: true, session: toPublicSession(rt) })
  } catch (err) {
    console.error('BC advance error:', err)
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
    rt.eventLog = ['Game reset. Waiting for players...']

    await saveRuntime(record.id, rt)
    return res.json({ success: true, session: toPublicSession(rt) })
  } catch (err) {
    console.error('BC reset error:', err)
    return res.status(500).json({ success: false, error: 'Failed to reset' })
  }
})

export default router
