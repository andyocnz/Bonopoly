import { Router } from 'express'
import { randomUUID } from 'crypto'
import { MiniGameSessionStatus, MiniGameType, Prisma } from '@prisma/client'
import { prisma } from '../db'
import { getSession, getSessionCookie } from '../sessionStore'
import { claimUniqueRoomCode, releaseRoomCode } from '../minigames/roomCodeRegistry'
import type { Request } from 'express'
import {
  type MonopolySession,
  addMonopolyPlayer,
  submitMonopolyAction,
  isMonopolyRoundComplete,
  processMonopolyRound,
} from '../engines/monopolyEngine'

const router = Router()
const GAME_SLUG = 'monopoly-pricing'
const GAME_TYPE = MiniGameType.MONOPOLY_PRICING
const RUNTIME_KEY = 'mp2Runtime'
const DEFAULT_CONFIG = { a: 100, b: 1, c: 10, pMin: 10, pMax: 100, rounds: 6 }

function requireEducatorId(req: Request): string | null {
  const sid = getSessionCookie(req, 'educator')
  const s = getSession(sid)
  if (!s || s.role !== 'educator' || !s.educatorId) return null
  return s.educatorId
}
function asRuntime(configJson: Prisma.JsonValue | null): MonopolySession | null {
  if (configJson && typeof configJson === 'object' && !Array.isArray(configJson)) {
    const cfg = configJson as Record<string, unknown>
    if (cfg[RUNTIME_KEY]) return cfg[RUNTIME_KEY] as MonopolySession
  }
  return null
}
function toStatus(phase: string): MiniGameSessionStatus {
  if (phase === 'lobby') return MiniGameSessionStatus.LOBBY
  if (phase === 'playing') return MiniGameSessionStatus.ACTIVE
  return MiniGameSessionStatus.COMPLETED
}
function toPublicSession(rt: MonopolySession, viewerToken?: string) {
  const viewer = rt.players.find(p => p.id === viewerToken)
  const humanPlayers = rt.players.filter(p => !p.isBot)
  const actedCount = humanPlayers.filter(p => p.hasActedThisRound).length
  return {
    roomCode: rt.roomCode, phase: rt.phase, currentRound: rt.currentRound, config: rt.config,
    players: rt.players.map(p => ({ id: p.id, name: p.name, isBot: p.isBot, totalScore: p.totalScore, hasActedThisRound: p.hasActedThisRound })),
    history: rt.history, eventLog: rt.eventLog,
    stats: { actedCount, waitingCount: humanPlayers.length },
    viewer: viewer ? { totalScore: viewer.totalScore, hasActed: viewer.hasActedThisRound } : null,
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
async function saveRuntime(id: string, rt: MonopolySession) {
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
    const rt: MonopolySession = { roomCode, hostToken, phase: 'lobby', config: DEFAULT_CONFIG, players: [], currentRound: 1, history: [], eventLog: ['Monopoly Pricing game created. Waiting for players...'], createdAt: Date.now(), lastActivityAt: Date.now() }
    await prisma.miniGameSession.create({ data: { educatorId, gameType: GAME_TYPE, roomCode, hostToken, status: MiniGameSessionStatus.LOBBY, teamCount: 8, configJson: { [RUNTIME_KEY]: rt } as unknown as Prisma.InputJsonValue } })
    return res.json({ success: true, roomCode, hostToken, session: toPublicSession(rt) })
  } catch (err) { if (roomCode) releaseRoomCode(roomCode); return res.status(500).json({ success: false, error: 'Failed to create game' }) }
})
router.post(`/${GAME_SLUG}/solo`, async (req, res) => {
  const educatorId = requireEducatorId(req)
  if (!educatorId) return res.status(401).json({ success: false, error: 'Educator login required' })
  const name = String((req.body as { name?: string })?.name || 'Player').trim().slice(0, 24) || 'Player'
  let roomCode: string | null = null
  try {
    roomCode = await allocateRoomCode(); const hostToken = randomUUID(); const playerToken = randomUUID()
    const rt: MonopolySession = { roomCode, hostToken, phase: 'playing', config: DEFAULT_CONFIG, players: [], currentRound: 1, history: [], eventLog: ['Solo Monopoly Pricing game started.'], createdAt: Date.now(), lastActivityAt: Date.now() }
    const human = addMonopolyPlayer(rt, playerToken, name); human.id = playerToken
    addMonopolyPlayer(rt, randomUUID(), 'Bot A', true); addMonopolyPlayer(rt, randomUUID(), 'Bot B', true)
    await prisma.miniGameSession.create({ data: { educatorId, gameType: GAME_TYPE, roomCode, hostToken, status: MiniGameSessionStatus.ACTIVE, teamCount: 3, configJson: { [RUNTIME_KEY]: rt } as unknown as Prisma.InputJsonValue } })
    return res.json({ success: true, roomCode, hostToken, playerToken, session: toPublicSession(rt, playerToken) })
  } catch (err) { if (roomCode) releaseRoomCode(roomCode); return res.status(500).json({ success: false, error: 'Failed' }) }
})
router.post(`/${GAME_SLUG}/:roomCode/join`, async (req, res) => {
  const roomCode = req.params.roomCode.toUpperCase()
  const name = String((req.body as { name?: string })?.name || 'Player').trim().slice(0, 24) || 'Player'
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
      const player = addMonopolyPlayer(rt, playerToken, name)
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
    console.error('Monopoly join error:', err)
    return res.status(500).json({ success: false, error: 'Failed to join' })
  }
})
router.get(`/${GAME_SLUG}/:roomCode/state`, async (req, res) => {
  const roomCode = req.params.roomCode.toUpperCase()
  const { playerToken, hostToken } = req.query as Record<string, string>
  try {
    const record = await loadSession(roomCode); if (!record) return res.status(404).json({ success: false, error: 'Room not found' })
    let rt = asRuntime(record.configJson)
    if (!rt) {
      // Recover from missing/corrupt runtime payload instead of hard-failing state polling.
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
  } catch (err) { return res.status(500).json({ success: false, error: 'Failed' }) }
})
router.post(`/${GAME_SLUG}/:roomCode/action`, async (req, res) => {
  const roomCode = req.params.roomCode.toUpperCase()
  const body = req.body as { playerToken?: string; price?: number }
  try {
    const record = await loadSession(roomCode); if (!record) return res.status(404).json({ success: false, error: 'Room not found' })
    const rt = asRuntime(record.configJson); if (!rt) return res.status(500).json({ success: false, error: 'Invalid session state' })
    if (rt.phase !== 'playing') return res.status(400).json({ success: false, error: 'Game not active' })
    const player = rt.players.find(p => p.id === body.playerToken); if (!player) return res.status(403).json({ success: false, error: 'Player not found' })
    const result = submitMonopolyAction(rt, player.id, body.price ?? 55)
    if (!result.ok) return res.status(400).json({ success: false, error: result.error })
    if (isMonopolyRoundComplete(rt)) processMonopolyRound(rt)
    await saveRuntime(record.id, rt)
    return res.json({ success: true, session: toPublicSession(rt, player.id) })
  } catch (err) { return res.status(500).json({ success: false, error: 'Failed' }) }
})
router.post(`/${GAME_SLUG}/:roomCode/start`, async (req, res) => {
  const roomCode = req.params.roomCode.toUpperCase()
  const body = req.body as { hostToken?: string }
  try {
    const record = await loadSession(roomCode); if (!record) return res.status(404).json({ success: false, error: 'Room not found' })
    if (body.hostToken !== record.hostToken) return res.status(403).json({ success: false, error: 'Invalid host token' })
    const rt = asRuntime(record.configJson); if (!rt) return res.status(500).json({ success: false, error: 'Invalid session state' })
    if (rt.phase !== 'lobby') return res.status(400).json({ success: false, error: 'Already started' })
    if (rt.players.length < 2) return res.status(400).json({ success: false, error: 'Need at least 2 players' })
    rt.phase = 'playing'
    rt.eventLog.push('Game started! Q = ' + rt.config.a + ' - P. MC = ' + rt.config.c + '. Optimal P* = ' + (rt.config.a + rt.config.c) / 2 + '.')
    await saveRuntime(record.id, rt)
    return res.json({ success: true, session: toPublicSession(rt) })
  } catch (err) { return res.status(500).json({ success: false, error: 'Failed' }) }
})
router.post(`/${GAME_SLUG}/:roomCode/advance`, async (req, res) => {
  const roomCode = req.params.roomCode.toUpperCase()
  const body = req.body as { hostToken?: string }
  try {
    const record = await loadSession(roomCode); if (!record) return res.status(404).json({ success: false, error: 'Room not found' })
    if (body.hostToken !== record.hostToken) return res.status(403).json({ success: false, error: 'Invalid host token' })
    const rt = asRuntime(record.configJson); if (!rt || rt.phase !== 'playing') return res.status(400).json({ success: false, error: 'Game not active' })
    processMonopolyRound(rt); await saveRuntime(record.id, rt)
    return res.json({ success: true, session: toPublicSession(rt) })
  } catch (err) { return res.status(500).json({ success: false, error: 'Failed' }) }
})
router.post(`/${GAME_SLUG}/:roomCode/reset`, async (req, res) => {
  const roomCode = req.params.roomCode.toUpperCase()
  const body = req.body as { hostToken?: string }
  try {
    const record = await loadSession(roomCode); if (!record) return res.status(404).json({ success: false, error: 'Room not found' })
    if (body.hostToken !== record.hostToken) return res.status(403).json({ success: false, error: 'Invalid host token' })
    const rt = asRuntime(record.configJson); if (!rt) return res.status(500).json({ success: false, error: 'Invalid session state' })
    const newRt: MonopolySession = { roomCode: rt.roomCode, hostToken: rt.hostToken, phase: 'lobby', config: rt.config, players: [], currentRound: 1, history: [], eventLog: ['Game reset.'], createdAt: rt.createdAt, lastActivityAt: Date.now() }
    await saveRuntime(record.id, newRt)
    return res.json({ success: true, session: toPublicSession(newRt) })
  } catch (err) { return res.status(500).json({ success: false, error: 'Failed' }) }
})

export default router
