import { Router } from 'express'
import { randomUUID } from 'crypto'
import { MiniGameSessionStatus, MiniGameType, Prisma } from '@prisma/client'
import { prisma } from '../db'
import { getSession, getSessionCookie } from '../sessionStore'
import { claimUniqueRoomCode, releaseRoomCode } from '../minigames/roomCodeRegistry'
import type { Request } from 'express'
import {
  type AdverseSelectionSession,
  addAdverseSelectionPlayer,
  getAdverseSelectionScenario,
  submitAdverseSelectionAction,
  isAdverseSelectionRoundComplete,
  processAdverseSelectionRound,
} from '../engines/adverseSelectionEngine'

const router = Router()
const GAME_SLUG = 'adverse-selection'
const GAME_TYPE = MiniGameType.ADVERSE_SELECTION
const RUNTIME_KEY = 'asRuntime'

const DEFAULT_CONFIG = {
  price: 60,
  qualityLevels: [40, 70, 100],
  rounds: 3,
  roundScenarios: [
    { label: 'Round 1: Baseline market', price: 60, buyerThreshold: 60, qualityFloor: null },
    { label: 'Round 2: Higher price', price: 75, buyerThreshold: 75, qualityFloor: null },
    { label: 'Round 3: Buyer protection floor', price: 60, buyerThreshold: 60, qualityFloor: 70 },
  ],
}

function requireEducatorId(req: Request): string | null {
  const sid = getSessionCookie(req, 'educator')
  const s = getSession(sid)
  if (!s || s.role !== 'educator' || !s.educatorId) return null
  return s.educatorId
}
function asRuntime(configJson: Prisma.JsonValue | null): AdverseSelectionSession | null {
  if (configJson && typeof configJson === 'object' && !Array.isArray(configJson)) {
    const cfg = configJson as Record<string, unknown>
    if (cfg[RUNTIME_KEY]) return cfg[RUNTIME_KEY] as AdverseSelectionSession
  }
  return null
}

function toStatus(phase: string): MiniGameSessionStatus {
  if (phase === 'lobby') return MiniGameSessionStatus.LOBBY
  if (phase === 'playing') return MiniGameSessionStatus.ACTIVE
  return MiniGameSessionStatus.COMPLETED
}

function toPublicSession(rt: AdverseSelectionSession, viewerToken?: string) {
  const currentScenario = getAdverseSelectionScenario(rt)
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
      totalScore: p.totalScore,
      hasActedThisRound: p.hasActedThisRound,
    })),
    history: rt.history,
    eventLog: rt.eventLog,
    currentScenario,
    stats: { actedCount, waitingCount: humanPlayers.length },
    viewer: viewer
      ? { totalScore: viewer.totalScore, hasActed: viewer.hasActedThisRound, quality: viewer.quality }
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

async function saveRuntime(id: string, rt: AdverseSelectionSession) {
  await prisma.miniGameSession.update({
    where: { id },
    data: {
      status: toStatus(rt.phase),
      configJson: { [RUNTIME_KEY]: rt } as unknown as Prisma.InputJsonValue,
    },
  })
}

router.post(`/${GAME_SLUG}/create`, async (req, res) => {
  const educatorId = requireEducatorId(req)
  if (!educatorId) return res.status(401).json({ success: false, error: 'Educator login required' })
  let roomCode: string | null = null
  try {
    roomCode = await allocateRoomCode()
    const hostToken = randomUUID()
    const rt: AdverseSelectionSession = {
      roomCode, hostToken, phase: 'lobby',
      config: DEFAULT_CONFIG,
      players: [], currentRound: 1, history: [],
      eventLog: ['Adverse Selection game created. Waiting for players...'],
      createdAt: Date.now(), lastActivityAt: Date.now(),
    }
    await prisma.miniGameSession.create({
      data: {
        educatorId, gameType: GAME_TYPE, roomCode, hostToken,
        status: MiniGameSessionStatus.LOBBY, teamCount: 8,
        configJson: { [RUNTIME_KEY]: rt } as unknown as Prisma.InputJsonValue,
      },
    })
    return res.json({ success: true, roomCode, hostToken, session: toPublicSession(rt) })
  } catch (err) {
    if (roomCode) releaseRoomCode(roomCode)
    console.error('AS create error:', err)
    return res.status(500).json({ success: false, error: 'Failed to create game' })
  }
})

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
    const rt: AdverseSelectionSession = {
      roomCode, hostToken, phase: 'playing',
      config: DEFAULT_CONFIG,
      players: [], currentRound: 1, history: [],
      eventLog: ['Solo Adverse Selection game started.'],
      createdAt: Date.now(), lastActivityAt: Date.now(),
    }
    const human = addAdverseSelectionPlayer(rt, playerToken, name)
    human.id = playerToken
    addAdverseSelectionPlayer(rt, randomUUID(), 'Bot A', true)
    addAdverseSelectionPlayer(rt, randomUUID(), 'Bot B', true)
    addAdverseSelectionPlayer(rt, randomUUID(), 'Bot C', true)
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
    console.error('AS solo error:', err)
    return res.status(500).json({ success: false, error: 'Failed to create solo game' })
  }
})

router.post(`/${GAME_SLUG}/:roomCode/join`, async (req, res) => {
  const roomCode = req.params.roomCode.toUpperCase()
  const body = req.body as { name?: string }
  const name = String(body?.name || 'Player').trim().slice(0, 24) || 'Player'
  try {
    const result = await prisma.$transaction(async (tx) => {
      // Lock the session row to serialize concurrent joins and avoid lost updates.
      const rows = await tx.$queryRawUnsafe<Array<{
        id: string; hostToken: string; configJson: unknown; status: string
      }>>(
        `SELECT id, "hostToken", "configJson", status FROM "MiniGameSession" WHERE "roomCode" = $1 FOR UPDATE`,
        roomCode
      )
      const record = rows[0]
      if (!record) throw new Error('ROOM_NOT_FOUND')
      let rt = asRuntime(record.configJson)
      if (!rt) {
        rt = { roomCode, hostToken: record.hostToken ?? '', phase: 'lobby' as const, config: DEFAULT_CONFIG, players: [], currentRound: 1, history: [], eventLog: ['Game ready. Waiting for players...'], createdAt: Date.now(), lastActivityAt: Date.now() }
      }
      if (rt.phase !== 'lobby') throw new Error('GAME_ALREADY_STARTED')
      if (rt.players.length >= 8) throw new Error('ROOM_FULL')
      if (rt.players.some((p) => p.name.toLowerCase() === name.toLowerCase())) throw new Error('NAME_IN_USE')
      const playerToken = randomUUID()
      const player = addAdverseSelectionPlayer(rt, playerToken, name)
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
    if (msg === 'ROOM_FULL') return res.status(400).json({ success: false, error: 'Room is full (max 8)' })
    if (msg === 'NAME_IN_USE') return res.status(400).json({ success: false, error: 'Name already used in this room' })
    console.error('AS join error:', err)
    return res.status(500).json({ success: false, error: 'Failed to join' })
  }
})

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
        config: DEFAULT_CONFIG,
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
    console.error('AS state error:', err)
    return res.status(500).json({ success: false, error: 'Failed to get state' })
  }
})

router.post(`/${GAME_SLUG}/:roomCode/action`, async (req, res) => {
  const roomCode = req.params.roomCode.toUpperCase()
  const body = req.body as { playerToken?: string; enter?: boolean }
  try {
    const record = await loadSession(roomCode)
    if (!record) return res.status(404).json({ success: false, error: 'Room not found' })
    const rt = asRuntime(record.configJson)
    if (!rt) return res.status(500).json({ success: false, error: 'Invalid session state' })
    if (rt.phase !== 'playing') return res.status(400).json({ success: false, error: 'Game not active' })
    const player = rt.players.find(p => p.id === body.playerToken)
    if (!player) return res.status(403).json({ success: false, error: 'Player not found' })
    const result = submitAdverseSelectionAction(rt, player.id, body.enter ?? false)
    if (!result.ok) return res.status(400).json({ success: false, error: result.error })
    if (isAdverseSelectionRoundComplete(rt)) processAdverseSelectionRound(rt)
    await saveRuntime(record.id, rt)
    return res.json({ success: true, session: toPublicSession(rt, player.id) })
  } catch (err) {
    console.error('AS action error:', err)
    return res.status(500).json({ success: false, error: 'Failed to submit action' })
  }
})

router.post(`/${GAME_SLUG}/:roomCode/start`, async (req, res) => {
  const roomCode = req.params.roomCode.toUpperCase()
  const body = req.body as { hostToken?: string }
  try {
    const record = await loadSession(roomCode)
    if (!record) return res.status(404).json({ success: false, error: 'Room not found' })
    if (body.hostToken !== record.hostToken) return res.status(403).json({ success: false, error: 'Invalid host token' })
    let rt = asRuntime(record.configJson)
    if (!rt) {
      rt = { roomCode, hostToken: record.hostToken ?? '', phase: 'lobby' as const, config: DEFAULT_CONFIG, players: [], currentRound: 1, history: [], eventLog: ['Game ready. Waiting for players...'], createdAt: Date.now(), lastActivityAt: Date.now() }
      await saveRuntime(record.id, rt)
    }
    if (rt.phase !== 'lobby') return res.status(400).json({ success: false, error: 'Already started' })
    if (rt.players.length < 2) return res.status(400).json({ success: false, error: 'Need at least 2 players' })
    rt.phase = 'playing'
    rt.eventLog.push(`Game started with ${rt.players.length} sellers! Price P=${rt.config.price}.`)
    await saveRuntime(record.id, rt)
    return res.json({ success: true, session: toPublicSession(rt) })
  } catch (err) {
    console.error('AS start error:', err)
    return res.status(500).json({ success: false, error: 'Failed to start' })
  }
})

router.post(`/${GAME_SLUG}/:roomCode/advance`, async (req, res) => {
  const roomCode = req.params.roomCode.toUpperCase()
  const body = req.body as { hostToken?: string }
  try {
    const record = await loadSession(roomCode)
    if (!record) return res.status(404).json({ success: false, error: 'Room not found' })
    if (body.hostToken !== record.hostToken) return res.status(403).json({ success: false, error: 'Invalid host token' })
    const rt = asRuntime(record.configJson)
    if (!rt || rt.phase !== 'playing') return res.status(400).json({ success: false, error: 'Game not active' })
    processAdverseSelectionRound(rt)
    await saveRuntime(record.id, rt)
    return res.json({ success: true, session: toPublicSession(rt) })
  } catch (err) {
    console.error('AS advance error:', err)
    return res.status(500).json({ success: false, error: 'Failed to advance' })
  }
})

router.post(`/${GAME_SLUG}/:roomCode/reset`, async (req, res) => {
  const roomCode = req.params.roomCode.toUpperCase()
  const body = req.body as { hostToken?: string }
  try {
    const record = await loadSession(roomCode)
    if (!record) return res.status(404).json({ success: false, error: 'Room not found' })
    if (body.hostToken !== record.hostToken) return res.status(403).json({ success: false, error: 'Invalid host token' })
    const rt = asRuntime(record.configJson)
    if (!rt) return res.status(500).json({ success: false, error: 'Invalid session state' })
    const newRt: AdverseSelectionSession = {
      roomCode: rt.roomCode, hostToken: rt.hostToken, phase: 'lobby',
      config: rt.config, players: [], currentRound: 1, history: [],
      eventLog: ['Game reset. Waiting for players...'],
      createdAt: rt.createdAt, lastActivityAt: Date.now(),
    }
    await saveRuntime(record.id, newRt)
    return res.json({ success: true, session: toPublicSession(newRt) })
  } catch (err) {
    console.error('AS reset error:', err)
    return res.status(500).json({ success: false, error: 'Failed to reset' })
  }
})

export default router
