import { Router } from 'express'
import { randomUUID } from 'crypto'
import { MiniGameSessionStatus, MiniGameType, Prisma } from '@prisma/client'
import { prisma } from '../db'
import { getSession, getSessionCookie } from '../sessionStore'
import { claimUniqueRoomCode, releaseRoomCode } from '../minigames/roomCodeRegistry'
import type { Request } from 'express'
import {
  type PrincipalAgentSession,
  type EffortLevel,
  getRoundContract,
  addPrincipalAgentPlayer,
  submitPrincipalAgentAction,
  isPrincipalAgentRoundComplete,
  processPrincipalAgentRound,
} from '../engines/principalAgentEngine'

const router = Router()
const GAME_SLUG = 'principal-agent'
const GAME_TYPE = MiniGameType.PRINCIPAL_AGENT
const RUNTIME_KEY = 'paRuntime'

const DEFAULT_CONFIG = {
  wage: 10,
  bonus: 35,
  pH: 0.8,
  pL: 0.3,
  effortCost: 20,
  rounds: 5,
  roundContracts: [
    { wage: 18, bonus: 20, label: 'Weak incentive contract' },
    { wage: 12, bonus: 35, label: 'Balanced contract' },
    { wage: 8, bonus: 55, label: 'High-performance contract' },
    { wage: 22, bonus: 15, label: 'Comfort contract' },
    { wage: 10, bonus: 70, label: 'Strong bonus contract' },
  ],
}

function requireEducatorId(req: Request): string | null {
  const sid = getSessionCookie(req, 'educator')
  const s = getSession(sid)
  if (!s || s.role !== 'educator' || !s.educatorId) return null
  return s.educatorId
}

function asRuntime(configJson: Prisma.JsonValue | null): PrincipalAgentSession | null {
  if (configJson && typeof configJson === 'object' && !Array.isArray(configJson)) {
    const cfg = configJson as Record<string, unknown>
    if (cfg[RUNTIME_KEY]) return cfg[RUNTIME_KEY] as PrincipalAgentSession
  }
  return null
}

function toStatus(phase: string): MiniGameSessionStatus {
  if (phase === 'lobby') return MiniGameSessionStatus.LOBBY
  if (phase === 'playing') return MiniGameSessionStatus.ACTIVE
  return MiniGameSessionStatus.COMPLETED
}

function toPublicSession(rt: PrincipalAgentSession, viewerToken?: string) {
  const roundContract = getRoundContract(rt)
  const expectedHigh = roundContract.wage + roundContract.bonus * rt.config.pH - rt.config.effortCost
  const expectedLow = roundContract.wage + roundContract.bonus * rt.config.pL
  const viewer = rt.players.find(p => p.id === viewerToken)
  const humanPlayers = rt.players.filter(p => !p.isBot)
  const actedCount = humanPlayers.filter(p => p.hasActedThisRound).length
  return {
    roomCode: rt.roomCode, phase: rt.phase, currentRound: rt.currentRound,
    config: rt.config,
    currentContract: {
      wage: roundContract.wage,
      bonus: roundContract.bonus,
      label: roundContract.label ?? null,
      expectedHigh,
      expectedLow,
      recommendedEffort: expectedHigh >= expectedLow ? 'high' : 'low',
    },
    players: rt.players.map(p => ({
      id: p.id, name: p.name, isBot: p.isBot,
      totalScore: p.totalScore, hasActedThisRound: p.hasActedThisRound,
    })),
    history: rt.history, eventLog: rt.eventLog,
    stats: { actedCount, waitingCount: humanPlayers.length },
    viewer: viewer
      ? { totalScore: viewer.totalScore, hasActed: viewer.hasActedThisRound }
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

async function saveRuntime(id: string, rt: PrincipalAgentSession) {
  await prisma.miniGameSession.update({
    where: { id },
    data: { status: toStatus(rt.phase), configJson: { [RUNTIME_KEY]: rt } as unknown as Prisma.InputJsonValue },
  })
}

router.post(`/${GAME_SLUG}/create`, async (req, res) => {
  const educatorId = requireEducatorId(req)
  if (!educatorId) return res.status(401).json({ success: false, error: 'Educator login required' })
  let roomCode: string | null = null
  try {
    roomCode = await allocateRoomCode()
    const hostToken = randomUUID()
    const rt: PrincipalAgentSession = {
      roomCode, hostToken, phase: 'lobby', config: DEFAULT_CONFIG,
      players: [], currentRound: 1, history: [],
      eventLog: ['Principal-Agent game created. Waiting for players...'],
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
    console.error('PA create error:', err)
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
    const rt: PrincipalAgentSession = {
      roomCode, hostToken, phase: 'playing', config: DEFAULT_CONFIG,
      players: [], currentRound: 1, history: [],
      eventLog: ['Solo Principal-Agent game started.'],
      createdAt: Date.now(), lastActivityAt: Date.now(),
    }
    const human = addPrincipalAgentPlayer(rt, playerToken, name)
    human.id = playerToken
    addPrincipalAgentPlayer(rt, randomUUID(), 'Bot A', true)
    addPrincipalAgentPlayer(rt, randomUUID(), 'Bot B', true)
    await prisma.miniGameSession.create({
      data: {
        educatorId, gameType: GAME_TYPE, roomCode, hostToken,
        status: MiniGameSessionStatus.ACTIVE, teamCount: 3,
        configJson: { [RUNTIME_KEY]: rt } as unknown as Prisma.InputJsonValue,
      },
    })
    return res.json({ success: true, roomCode, hostToken, playerToken, session: toPublicSession(rt, playerToken) })
  } catch (err) {
    if (roomCode) releaseRoomCode(roomCode)
    console.error('PA solo error:', err)
    return res.status(500).json({ success: false, error: 'Failed to create solo game' })
  }
})

router.post(`/${GAME_SLUG}/:roomCode/join`, async (req, res) => {
  const roomCode = req.params.roomCode.toUpperCase()
  const body = req.body as { name?: string }
  const name = String(body?.name || 'Player').trim().slice(0, 24) || 'Player'
  try {
    const result = await prisma.$transaction(async (tx) => {
      // Lock row to serialize concurrent joins and avoid lost player updates.
      const rows = await tx.$queryRawUnsafe<Array<{
        id: string; hostToken: string; configJson: unknown; status: string
      }>>(
        `SELECT id, "hostToken", "configJson", status FROM "MiniGameSession" WHERE "roomCode" = $1 AND "gameType" = $2::"MiniGameType" FOR UPDATE`,
        roomCode,
        GAME_TYPE
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
      const player = addPrincipalAgentPlayer(rt, playerToken, name)
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
    if (msg === 'ROOM_FULL') return res.status(400).json({ success: false, error: 'Room is full' })
    if (msg === 'NAME_IN_USE') return res.status(400).json({ success: false, error: 'Name already used in this room' })
    console.error('PA join error:', err)
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
    console.error('PA state error:', err)
    return res.status(500).json({ success: false, error: 'Failed to get state' })
  }
})

router.post(`/${GAME_SLUG}/:roomCode/action`, async (req, res) => {
  const roomCode = req.params.roomCode.toUpperCase()
  const body = req.body as { playerToken?: string; effort?: EffortLevel }
  try {
    const record = await loadSession(roomCode)
    if (!record) return res.status(404).json({ success: false, error: 'Room not found' })
    const rt = asRuntime(record.configJson)
    if (!rt) return res.status(500).json({ success: false, error: 'Invalid session state' })
    if (rt.phase !== 'playing') return res.status(400).json({ success: false, error: 'Game not active' })
    const player = rt.players.find(p => p.id === body.playerToken)
    if (!player) return res.status(403).json({ success: false, error: 'Player not found' })
    const result = submitPrincipalAgentAction(rt, player.id, body.effort ?? 'low')
    if (!result.ok) return res.status(400).json({ success: false, error: result.error })
    if (isPrincipalAgentRoundComplete(rt)) processPrincipalAgentRound(rt)
    await saveRuntime(record.id, rt)
    return res.json({ success: true, session: toPublicSession(rt, player.id) })
  } catch (err) {
    console.error('PA action error:', err)
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
    const contract = getRoundContract(rt)
    rt.eventLog.push(`Game started! Round 1 contract: wage ${contract.wage}, bonus ${contract.bonus}.`)
    await saveRuntime(record.id, rt)
    return res.json({ success: true, session: toPublicSession(rt) })
  } catch (err) {
    console.error('PA start error:', err)
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
    processPrincipalAgentRound(rt)
    await saveRuntime(record.id, rt)
    return res.json({ success: true, session: toPublicSession(rt) })
  } catch (err) {
    console.error('PA advance error:', err)
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
    const newRt: PrincipalAgentSession = {
      roomCode: rt.roomCode, hostToken: rt.hostToken, phase: 'lobby',
      config: rt.config, players: [], currentRound: 1, history: [],
      eventLog: ['Game reset. Waiting for players...'],
      createdAt: rt.createdAt, lastActivityAt: Date.now(),
    }
    await saveRuntime(record.id, newRt)
    return res.json({ success: true, session: toPublicSession(newRt) })
  } catch (err) {
    console.error('PA reset error:', err)
    return res.status(500).json({ success: false, error: 'Failed to reset' })
  }
})

export default router
