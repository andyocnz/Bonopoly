import { Router } from 'express'
import { randomUUID } from 'crypto'
import { MiniGameSessionStatus, MiniGameType, Prisma } from '@prisma/client'
import { prisma } from '../db'
import { getSession, getSessionCookie } from '../sessionStore'
import { claimUniqueRoomCode, releaseRoomCode } from '../minigames/roomCodeRegistry'
import type { Request } from 'express'
import {
  type AssetBubbleSession,
  addAssetBubblePlayer,
  placeBid,
  placeAsk,
  cancelOrder,
  advanceAssetBubblePeriod,
  startAssetBubbleGame,
  getFundamentalValue,
  triggerShockEvent,
  SHOCK_SCENARIOS,
} from '../engines/assetBubbleEngine'

const router = Router()
const GAME_SLUG = 'crypto-bubble'
const GAME_TYPE = MiniGameType.CRYPTO_BUBBLE
const RUNTIME_KEY = 'cryptoBubbleRuntime'

const DEFAULT_CONFIG = { totalPeriods: 10, dividend: 10, cashEndowment: 500, assetEndowment: 4, secondsPerPeriod: 60 }

function requireEducatorId(req: Request): string | null {
  const sid = getSessionCookie(req, 'educator')
  const s = getSession(sid)
  if (!s || s.role !== 'educator' || !s.educatorId) return null
  return s.educatorId
}
function asRuntime(configJson: Prisma.JsonValue | null): AssetBubbleSession | null {
  if (configJson && typeof configJson === 'object' && !Array.isArray(configJson)) {
    const cfg = configJson as Record<string, unknown>
    if (cfg[RUNTIME_KEY]) return cfg[RUNTIME_KEY] as AssetBubbleSession
  }
  return null
}
function toStatus(phase: string): MiniGameSessionStatus {
  if (phase === 'lobby') return MiniGameSessionStatus.LOBBY
  if (phase === 'playing') return MiniGameSessionStatus.ACTIVE
  return MiniGameSessionStatus.COMPLETED
}
function toPublicSession(rt: AssetBubbleSession, viewerToken?: string) {
  const viewer = rt.players.find(p => p.id === viewerToken)
  const fv = getFundamentalValue(rt)
  return {
    roomCode: rt.roomCode, phase: rt.phase, currentPeriod: rt.currentPeriod, config: rt.config,
    fundamentalValue: fv,
    periodEndsAt: rt.periodStartedAt ? rt.periodStartedAt + rt.config.secondsPerPeriod * 1000 : null,
    shockEvent: rt.shockEvent ?? null,
    scenarios: SHOCK_SCENARIOS.map(s => ({ id: s.id, label: s.label })),
    players: rt.players.map(p => ({ id: p.id, name: p.name, isBot: p.isBot, cash: p.cash, assets: p.assets, totalProfit: p.totalProfit })),
    bids: rt.bids.map(o => ({ id: o.id, playerName: o.playerName, price: o.price })),
    asks: rt.asks.map(o => ({ id: o.id, playerName: o.playerName, price: o.price })),
    tradesThisPeriod: rt.tradesThisPeriod,
    history: rt.history,
    eventLog: rt.eventLog,
    viewer: viewer ? {
      cash: viewer.cash, assets: viewer.assets, totalProfit: viewer.totalProfit,
      myBid: rt.bids.find(o => o.playerId === viewerToken)?.price ?? null,
      myAsk: rt.asks.find(o => o.playerId === viewerToken)?.price ?? null,
    } : null,
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
async function saveRuntime(id: string, rt: AssetBubbleSession) {
  await prisma.miniGameSession.update({
    where: { id },
    data: { status: toStatus(rt.phase), configJson: { [RUNTIME_KEY]: rt } as unknown as Prisma.InputJsonValue },
  })
}

router.post(`/${GAME_SLUG}/solo`, async (req, res) => {
  const educatorId = requireEducatorId(req)
  if (!educatorId) return res.status(401).json({ success: false, error: 'Educator login required' })
  const name = String((req.body as { name?: string })?.name || 'Player').trim().slice(0, 24) || 'Player'
  let roomCode: string | null = null
  try {
    roomCode = await allocateRoomCode()
    const hostToken = randomUUID()
    const playerToken = randomUUID()
    const rt: AssetBubbleSession = {
      roomCode, hostToken, phase: 'lobby', config: { ...DEFAULT_CONFIG, secondsPerPeriod: 20 },
      players: [], currentPeriod: 1, bids: [], asks: [], history: [], tradesThisPeriod: [],
      eventLog: ['🚀 Solo Crypto Bubble game. Algo Traders initialised.'],
      createdAt: Date.now(), lastActivityAt: Date.now(),
    }
    const human = addAssetBubblePlayer(rt, playerToken, name)
    human.id = playerToken
    addAssetBubblePlayer(rt, randomUUID(), 'Algo Trader A', true)
    addAssetBubblePlayer(rt, randomUUID(), 'Algo Trader B', true)
    addAssetBubblePlayer(rt, randomUUID(), 'Algo Trader C', true)
    startAssetBubbleGame(rt)
    await prisma.miniGameSession.create({
      data: { educatorId, gameType: GAME_TYPE, roomCode, hostToken, status: MiniGameSessionStatus.ACTIVE, teamCount: 4, configJson: { [RUNTIME_KEY]: rt } as unknown as Prisma.InputJsonValue },
    })
    return res.json({ success: true, roomCode, hostToken, playerToken, session: toPublicSession(rt, playerToken) })
  } catch (err) { if (roomCode) releaseRoomCode(roomCode); return res.status(500).json({ success: false, error: 'Failed' }) }
})
router.post(`/${GAME_SLUG}/create`, async (req, res) => {
  const educatorId = requireEducatorId(req)
  if (!educatorId) return res.status(401).json({ success: false, error: 'Educator login required' })
  let roomCode: string | null = null
  try {
    roomCode = await allocateRoomCode()
    const hostToken = randomUUID()
    const rt: AssetBubbleSession = {
      roomCode, hostToken, phase: 'lobby', config: DEFAULT_CONFIG,
      players: [], currentPeriod: 1, bids: [], asks: [], history: [], tradesThisPeriod: [],
      eventLog: ['🚀 Crypto Bubble market created. Algo Traders standing by — waiting for human players...'],
      createdAt: Date.now(), lastActivityAt: Date.now(),
    }
    // Pre-seed algorithmic traders (Minsky bots)
    addAssetBubblePlayer(rt, randomUUID(), 'Algo Trader A', true)
    addAssetBubblePlayer(rt, randomUUID(), 'Algo Trader B', true)
    addAssetBubblePlayer(rt, randomUUID(), 'Algo Trader C', true)
    await prisma.miniGameSession.create({
      data: { educatorId, gameType: GAME_TYPE, roomCode, hostToken, status: MiniGameSessionStatus.LOBBY, teamCount: 40, configJson: { [RUNTIME_KEY]: rt } as unknown as Prisma.InputJsonValue },
    })
    return res.json({ success: true, roomCode, hostToken, session: toPublicSession(rt) })
  } catch (err) { if (roomCode) releaseRoomCode(roomCode); return res.status(500).json({ success: false, error: 'Failed to create game' }) }
})
router.post(`/${GAME_SLUG}/:roomCode/join`, async (req, res) => {
  const roomCode = req.params.roomCode.toUpperCase()
  const name = String((req.body as { name?: string })?.name || 'Player').trim().slice(0, 24) || 'Player'
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
        rt = {
          roomCode, hostToken: record.hostToken ?? '', phase: 'lobby' as const, config: DEFAULT_CONFIG,
          players: [], currentPeriod: 1, bids: [], asks: [], history: [], tradesThisPeriod: [],
          eventLog: ['🚀 Crypto Bubble market ready. Waiting for players...'],
          createdAt: Date.now(), lastActivityAt: Date.now(),
        }
        addAssetBubblePlayer(rt, randomUUID(), 'Algo Trader A', true)
        addAssetBubblePlayer(rt, randomUUID(), 'Algo Trader B', true)
        addAssetBubblePlayer(rt, randomUUID(), 'Algo Trader C', true)
      }
      if (rt.phase !== 'lobby') throw new Error('GAME_ALREADY_STARTED')
      const humanCount = rt.players.filter(p => !p.isBot).length
      if (humanCount >= 8) throw new Error('ROOM_FULL')
      if (rt.players.some((p) => p.name.toLowerCase() === name.toLowerCase())) throw new Error('NAME_IN_USE')
      const playerToken = randomUUID()
      const player = addAssetBubblePlayer(rt, playerToken, name)
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
    console.error('CryptoBubble join error:', err)
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
      rt = {
        roomCode, hostToken: record.hostToken ?? '', phase: 'lobby', config: DEFAULT_CONFIG,
        players: [], currentPeriod: 1, bids: [], asks: [], history: [], tradesThisPeriod: [],
        eventLog: ['🚀 Crypto Bubble market ready. Waiting for players...'],
        createdAt: Date.now(), lastActivityAt: Date.now(),
      }
      addAssetBubblePlayer(rt, randomUUID(), 'Algo Trader A', true)
      addAssetBubblePlayer(rt, randomUUID(), 'Algo Trader B', true)
      addAssetBubblePlayer(rt, randomUUID(), 'Algo Trader C', true)
      await saveRuntime(record.id, rt)
    }
    // Auto-advance period if timer has expired
    if (rt.phase === 'playing' && rt.periodStartedAt) {
      const elapsed = Date.now() - rt.periodStartedAt
      if (elapsed > rt.config.secondsPerPeriod * 1000) {
        advanceAssetBubblePeriod(rt)
        await saveRuntime(record.id, rt)
      }
    }
    const isHost = !!hostToken && hostToken === record.hostToken
    const viewerId = rt.players.find(p => p.id === playerToken)?.id
    return res.json({ success: true, session: toPublicSession(rt, viewerId), isHost })
  } catch (err) { return res.status(500).json({ success: false, error: 'Failed' }) }
})
router.post(`/${GAME_SLUG}/:roomCode/bid`, async (req, res) => {
  const roomCode = req.params.roomCode.toUpperCase()
  const body = req.body as { playerToken?: string; price?: number }
  try {
    const record = await loadSession(roomCode); if (!record) return res.status(404).json({ success: false, error: 'Room not found' })
    const rt = asRuntime(record.configJson); if (!rt) return res.status(500).json({ success: false, error: 'Invalid session state' })
    const result = placeBid(rt, body.playerToken ?? '', Math.round(body.price ?? 0))
    if (!result.ok) return res.status(400).json({ success: false, error: result.error })
    await saveRuntime(record.id, rt)
    const viewerId = rt.players.find(p => p.id === body.playerToken)?.id
    return res.json({ success: true, session: toPublicSession(rt, viewerId), trade: result.trade ?? null })
  } catch (err) { return res.status(500).json({ success: false, error: 'Failed to place bid' }) }
})
router.post(`/${GAME_SLUG}/:roomCode/ask`, async (req, res) => {
  const roomCode = req.params.roomCode.toUpperCase()
  const body = req.body as { playerToken?: string; price?: number }
  try {
    const record = await loadSession(roomCode); if (!record) return res.status(404).json({ success: false, error: 'Room not found' })
    const rt = asRuntime(record.configJson); if (!rt) return res.status(500).json({ success: false, error: 'Invalid session state' })
    const result = placeAsk(rt, body.playerToken ?? '', Math.round(body.price ?? 0))
    if (!result.ok) return res.status(400).json({ success: false, error: result.error })
    await saveRuntime(record.id, rt)
    const viewerId = rt.players.find(p => p.id === body.playerToken)?.id
    return res.json({ success: true, session: toPublicSession(rt, viewerId), trade: result.trade ?? null })
  } catch (err) { return res.status(500).json({ success: false, error: 'Failed to place ask' }) }
})
router.post(`/${GAME_SLUG}/:roomCode/cancel`, async (req, res) => {
  const roomCode = req.params.roomCode.toUpperCase()
  const body = req.body as { playerToken?: string }
  try {
    const record = await loadSession(roomCode); if (!record) return res.status(404).json({ success: false, error: 'Room not found' })
    const rt = asRuntime(record.configJson); if (!rt) return res.status(500).json({ success: false, error: 'Invalid session state' })
    cancelOrder(rt, body.playerToken ?? '')
    await saveRuntime(record.id, rt)
    const viewerId = rt.players.find(p => p.id === body.playerToken)?.id
    return res.json({ success: true, session: toPublicSession(rt, viewerId) })
  } catch (err) { return res.status(500).json({ success: false, error: 'Failed to cancel' }) }
})
router.post(`/${GAME_SLUG}/:roomCode/start`, async (req, res) => {
  const roomCode = req.params.roomCode.toUpperCase()
  const body = req.body as { hostToken?: string }
  try {
    const record = await loadSession(roomCode); if (!record) return res.status(404).json({ success: false, error: 'Room not found' })
    if (body.hostToken !== record.hostToken) return res.status(403).json({ success: false, error: 'Invalid host token' })
    const rt = asRuntime(record.configJson); if (!rt) return res.status(500).json({ success: false, error: 'Invalid session state' })
    if (rt.phase !== 'lobby') return res.status(400).json({ success: false, error: 'Already started' })
    const humanPlayers = rt.players.filter(p => !p.isBot)
    if (humanPlayers.length < 1) return res.status(400).json({ success: false, error: 'Need at least 1 human player' })
    startAssetBubbleGame(rt)
    await saveRuntime(record.id, rt)
    return res.json({ success: true, session: toPublicSession(rt) })
  } catch (err) { return res.status(500).json({ success: false, error: 'Failed to start' }) }
})
router.post(`/${GAME_SLUG}/:roomCode/advance`, async (req, res) => {
  const roomCode = req.params.roomCode.toUpperCase()
  const body = req.body as { hostToken?: string }
  try {
    const record = await loadSession(roomCode); if (!record) return res.status(404).json({ success: false, error: 'Room not found' })
    if (body.hostToken !== record.hostToken) return res.status(403).json({ success: false, error: 'Invalid host token' })
    const rt = asRuntime(record.configJson); if (!rt || rt.phase !== 'playing') return res.status(400).json({ success: false, error: 'Game not active' })
    advanceAssetBubblePeriod(rt); await saveRuntime(record.id, rt)
    return res.json({ success: true, session: toPublicSession(rt) })
  } catch (err) { return res.status(500).json({ success: false, error: 'Failed to advance period' }) }
})
router.post(`/${GAME_SLUG}/:roomCode/shock`, async (req, res) => {
  const roomCode = req.params.roomCode.toUpperCase()
  const body = req.body as { hostToken?: string; scenarioId?: string }
  try {
    const record = await loadSession(roomCode); if (!record) return res.status(404).json({ success: false, error: 'Room not found' })
    if (body.hostToken !== record.hostToken) return res.status(403).json({ success: false, error: 'Invalid host token' })
    const rt = asRuntime(record.configJson); if (!rt || rt.phase !== 'playing') return res.status(400).json({ success: false, error: 'Game not active' })
    if (rt.shockEvent) return res.status(400).json({ success: false, error: 'Shock already triggered' })
    triggerShockEvent(rt, body.scenarioId ?? 'quantum')
    await saveRuntime(record.id, rt)
    return res.json({ success: true, session: toPublicSession(rt) })
  } catch (err) { return res.status(500).json({ success: false, error: 'Failed to trigger shock' }) }
})
router.post(`/${GAME_SLUG}/:roomCode/reset`, async (req, res) => {
  const roomCode = req.params.roomCode.toUpperCase()
  const body = req.body as { hostToken?: string }
  try {
    const record = await loadSession(roomCode); if (!record) return res.status(404).json({ success: false, error: 'Room not found' })
    if (body.hostToken !== record.hostToken) return res.status(403).json({ success: false, error: 'Invalid host token' })
    const rt = asRuntime(record.configJson); if (!rt) return res.status(500).json({ success: false, error: 'Invalid session state' })
    const newRt: AssetBubbleSession = {
      roomCode: rt.roomCode, hostToken: rt.hostToken, phase: 'lobby', config: rt.config,
      players: [], currentPeriod: 1, bids: [], asks: [], history: [], tradesThisPeriod: [],
      eventLog: ['🔄 Market reset. Algo Traders re-initialised.'],
      createdAt: rt.createdAt, lastActivityAt: Date.now(),
    }
    addAssetBubblePlayer(newRt, randomUUID(), 'Algo Trader A', true)
    addAssetBubblePlayer(newRt, randomUUID(), 'Algo Trader B', true)
    addAssetBubblePlayer(newRt, randomUUID(), 'Algo Trader C', true)
    await saveRuntime(record.id, newRt)
    return res.json({ success: true, session: toPublicSession(newRt) })
  } catch (err) { return res.status(500).json({ success: false, error: 'Failed to reset' }) }
})

export default router
