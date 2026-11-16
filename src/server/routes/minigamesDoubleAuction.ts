import { Router } from 'express'
import type { Request } from 'express'
import { randomUUID } from 'crypto'
import { MiniGameSessionStatus, MiniGameType, Prisma } from '@prisma/client'
import { prisma } from '../db'
import { getSession, getSessionCookie } from '../sessionStore'
import { claimUniqueRoomCode, releaseRoomCode } from '../minigames/roomCodeRegistry'

type AuctionPhase = 'lobby' | 'playing' | 'results'
type Role = 'buyer' | 'seller'

type AuctionConfig = {
  rounds: number
  minPrice: number
  maxPrice: number
}

type AuctionPlayer = {
  id: string
  token: string | null
  name: string
  isBot: boolean
  role: Role | null
  totalProfit: number
  lastProfit: number
}

type RoundCard = { role: Role; privateNumber: number }
type Order = { price: number; at: number }

type Trade = {
  buyerId: string
  buyerName: string
  sellerId: string
  sellerName: string
  bid: number
  ask: number
  price: number
}

type RoundSummary = {
  round: number
  trades: Trade[]
  avgPrice: number | null
  tradeCount: number
}

type AuctionRuntimeState = {
  phase: AuctionPhase
  currentRound: number
  config: AuctionConfig
  players: AuctionPlayer[]
  roundCards: Record<string, Record<string, RoundCard>>
  roundOrders: Record<string, Record<string, Order>>
  history: RoundSummary[]
  eventLog: string[]
}

type ConfigPayload = {
  auctionRuntime?: AuctionRuntimeState
  auctionConfig?: Partial<AuctionConfig>
  [key: string]: unknown
}

const router = Router()

function clampInt(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min
  return Math.max(min, Math.min(max, Math.floor(value)))
}

function requireEducatorId(req: Request): string | null {
  const sessionId = getSessionCookie(req, 'educator')
  const session = getSession(sessionId)
  if (!session || session.role !== 'educator' || !session.educatorId) return null
  return session.educatorId
}

function asConfigObject(value: Prisma.JsonValue | null): ConfigPayload {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as ConfigPayload
  return {}
}

function defaultConfig(config?: Partial<AuctionConfig>): AuctionConfig {
  const next = {
    rounds: clampInt(config?.rounds ?? 6, 3, 12),
    minPrice: clampInt(config?.minPrice ?? 20, 1, 500),
    maxPrice: clampInt(config?.maxPrice ?? 200, 10, 1000),
  }
  if (next.maxPrice <= next.minPrice) {
    next.maxPrice = next.minPrice + 10
  }
  return next
}

function defaultRuntime(config?: Partial<AuctionConfig>): AuctionRuntimeState {
  return {
    phase: 'lobby',
    currentRound: 1,
    config: defaultConfig(config),
    players: [],
    roundCards: {},
    roundOrders: {},
    history: [],
    eventLog: [],
  }
}

function normalizeRuntime(runtime: AuctionRuntimeState | undefined, configObj: ConfigPayload): AuctionRuntimeState {
  if (!runtime) return defaultRuntime(configObj.auctionConfig)
  return {
    phase: runtime.phase,
    currentRound: Number(runtime.currentRound || 1),
    config: defaultConfig(runtime.config),
    players: Array.isArray(runtime.players) ? runtime.players : [],
    roundCards: runtime.roundCards || {},
    roundOrders: runtime.roundOrders || {},
    history: Array.isArray(runtime.history) ? runtime.history : [],
    eventLog: Array.isArray(runtime.eventLog) ? runtime.eventLog.slice(0, 40) : [],
  }
}

function toStatus(phase: AuctionPhase): MiniGameSessionStatus {
  if (phase === 'lobby') return MiniGameSessionStatus.LOBBY
  if (phase === 'playing') return MiniGameSessionStatus.ACTIVE
  return MiniGameSessionStatus.COMPLETED
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function getRoundOrders(runtime: AuctionRuntimeState): Record<string, Order> {
  const key = String(runtime.currentRound)
  if (!runtime.roundOrders[key]) runtime.roundOrders[key] = {}
  return runtime.roundOrders[key]
}

function getRoundCards(runtime: AuctionRuntimeState): Record<string, RoundCard> {
  const key = String(runtime.currentRound)
  if (!runtime.roundCards[key]) runtime.roundCards[key] = {}
  return runtime.roundCards[key]
}

function generatePrivateNumberForRole(runtime: AuctionRuntimeState, role: Role): number {
  const min = runtime.config.minPrice
  const max = runtime.config.maxPrice
  const span = max - min
  if (role === 'buyer') {
    return clampInt(min + span * 0.55 + Math.random() * span * 0.45, min, max)
  }
  return clampInt(min + Math.random() * span * 0.45, min, max)
}

function assignRoles(players: AuctionPlayer[]) {
  const shuffled = shuffle(players)
  const buyerCount = Math.ceil(shuffled.length / 2)
  shuffled.forEach((player, idx) => {
    player.role = idx < buyerCount ? 'buyer' : 'seller'
  })
}

function generateCardsForCurrentRound(runtime: AuctionRuntimeState) {
  const cards = getRoundCards(runtime)
  for (const player of runtime.players) {
    if (!player.role) continue
    cards[player.id] = {
      role: player.role,
      privateNumber: generatePrivateNumberForRole(runtime, player.role),
    }
  }
}

function findPlayerByToken(runtime: AuctionRuntimeState, token: string): AuctionPlayer | undefined {
  return runtime.players.find((player) => !player.isBot && player.token === token)
}

function toPublicSession(roomCode: string, runtime: AuctionRuntimeState) {
  return {
    roomCode,
    phase: runtime.phase,
    currentRound: runtime.currentRound,
    config: runtime.config,
    players: runtime.players.map((player) => ({
      id: player.id,
      name: player.name,
      isBot: player.isBot,
      role: player.role,
      totalProfit: player.totalProfit,
      lastProfit: player.lastProfit,
    })),
    history: runtime.history,
    eventLog: runtime.eventLog,
  }
}

function botOrderPrice(card: RoundCard, config: AuctionConfig): number {
  const spread = Math.max(2, Math.floor((config.maxPrice - config.minPrice) * 0.08))
  if (card.role === 'buyer') {
    return clampInt(card.privateNumber - Math.floor(Math.random() * spread), config.minPrice, config.maxPrice)
  }
  return clampInt(card.privateNumber + Math.floor(Math.random() * spread), config.minPrice, config.maxPrice)
}

function resolveRound(runtime: AuctionRuntimeState): RoundSummary {
  const cards = getRoundCards(runtime)
  const orders = getRoundOrders(runtime)
  for (const player of runtime.players) {
    if (!player.isBot || !player.role) continue
    const card = cards[player.id]
    if (!card) continue
    orders[player.id] = { price: botOrderPrice(card, runtime.config), at: Date.now() }
  }

  const buyers = runtime.players
    .filter((player) => player.role === 'buyer')
    .map((player) => {
      const card = cards[player.id]
      const order = orders[player.id]
      return {
        player,
        value: card?.privateNumber ?? runtime.config.maxPrice,
        bid: order?.price ?? -1,
        at: order?.at ?? Number.MAX_SAFE_INTEGER,
      }
    })
    .filter((row) => row.bid >= runtime.config.minPrice)
    .sort((a, b) => (b.bid - a.bid) || (a.at - b.at))

  const sellers = runtime.players
    .filter((player) => player.role === 'seller')
    .map((player) => {
      const card = cards[player.id]
      const order = orders[player.id]
      return {
        player,
        cost: card?.privateNumber ?? runtime.config.minPrice,
        ask: order?.price ?? Number.MAX_SAFE_INTEGER,
        at: order?.at ?? Number.MAX_SAFE_INTEGER,
      }
    })
    .filter((row) => row.ask <= runtime.config.maxPrice)
    .sort((a, b) => (a.ask - b.ask) || (a.at - b.at))

  for (const player of runtime.players) player.lastProfit = 0

  const trades: Trade[] = []
  let bi = 0
  let si = 0
  while (bi < buyers.length && si < sellers.length) {
    const buyer = buyers[bi]
    const seller = sellers[si]
    if (buyer.bid < seller.ask) break

    const price = clampInt(Math.round((buyer.bid + seller.ask) / 2), runtime.config.minPrice, runtime.config.maxPrice)
    const buyerProfit = Math.max(0, buyer.value - price)
    const sellerProfit = Math.max(0, price - seller.cost)
    buyer.player.totalProfit += buyerProfit
    buyer.player.lastProfit += buyerProfit
    seller.player.totalProfit += sellerProfit
    seller.player.lastProfit += sellerProfit

    trades.push({
      buyerId: buyer.player.id,
      buyerName: buyer.player.name,
      sellerId: seller.player.id,
      sellerName: seller.player.name,
      bid: buyer.bid,
      ask: seller.ask,
      price,
    })

    bi += 1
    si += 1
  }

  const avgPrice = trades.length > 0
    ? Math.round(trades.reduce((sum, trade) => sum + trade.price, 0) / trades.length)
    : null

  return {
    round: runtime.currentRound,
    trades,
    avgPrice,
    tradeCount: trades.length,
  }
}

function applyRoundResolution(runtime: AuctionRuntimeState): RoundSummary {
  const summary = resolveRound(runtime)
  runtime.history.push(summary)

  if (runtime.currentRound >= runtime.config.rounds) {
    runtime.phase = 'results'
    runtime.eventLog.unshift('Game finished')
  } else {
    runtime.currentRound += 1
    generateCardsForCurrentRound(runtime)
    runtime.eventLog.unshift(`Round ${runtime.currentRound - 1} resolved`)
  }
  runtime.eventLog = runtime.eventLog.slice(0, 40)
  return summary
}

async function allocateRoomCode(): Promise<string> {
  let attempts = 0
  while (attempts < 200) {
    const code = claimUniqueRoomCode()
    const existing = await prisma.miniGameSession.findFirst({ where: { roomCode: code }, select: { id: true } })
    if (!existing) return code
    releaseRoomCode(code)
    attempts += 1
  }
  throw new Error('Unable to generate unique room code')
}

router.post('/double-auction/create', async (req, res) => {
  const educatorId = requireEducatorId(req)
  if (!educatorId) return res.status(401).json({ success: false, error: 'Educator login required' })

  const body = req.body as { config?: Partial<AuctionConfig> }
  const runtime = defaultRuntime(body?.config)
  let roomCode: string | null = null

  try {
    roomCode = await allocateRoomCode()
    const hostToken = randomUUID()
    await prisma.miniGameSession.create({
      data: {
        educatorId,
        gameType: MiniGameType.DOUBLE_AUCTION,
        roomCode,
        hostToken,
        status: MiniGameSessionStatus.LOBBY,
        teamCount: 40,
        configJson: {
          auctionConfig: runtime.config,
          auctionRuntime: runtime,
        },
      },
    })
    return res.json({ success: true, roomCode, hostToken, session: toPublicSession(roomCode, runtime) })
  } catch (error) {
    if (roomCode) releaseRoomCode(roomCode)
    console.error('Failed to create auction room:', error)
    return res.status(500).json({ success: false, error: 'Failed to create room' })
  }
})

router.post('/double-auction/solo', async (req, res) => {
  const educatorId = requireEducatorId(req)
  if (!educatorId) return res.status(401).json({ success: false, error: 'Educator login required' })

  const body = req.body as { name?: string; playAs?: Role; config?: Partial<AuctionConfig> }
  const config = defaultConfig(body?.config)
  const name = String(body?.name || 'Host').trim().slice(0, 24) || 'Host'
  const playAs: Role = body?.playAs === 'seller' ? 'seller' : 'buyer'
  let roomCode: string | null = null

  try {
    roomCode = await allocateRoomCode()
    const hostToken = randomUUID()
    const playerToken = randomUUID()

    const players: AuctionPlayer[] = [
      { id: randomUUID(), token: playerToken, name, isBot: false, role: playAs, totalProfit: 0, lastProfit: 0 },
      { id: randomUUID(), token: null, name: 'Bot 1', isBot: true, role: playAs === 'buyer' ? 'seller' : 'buyer', totalProfit: 0, lastProfit: 0 },
      { id: randomUUID(), token: null, name: 'Bot 2', isBot: true, role: playAs === 'buyer' ? 'seller' : 'buyer', totalProfit: 0, lastProfit: 0 },
      { id: randomUUID(), token: null, name: 'Bot 3', isBot: true, role: playAs === 'buyer' ? 'seller' : 'buyer', totalProfit: 0, lastProfit: 0 },
      { id: randomUUID(), token: null, name: 'Bot 4', isBot: true, role: playAs === 'buyer' ? 'buyer' : 'seller', totalProfit: 0, lastProfit: 0 },
      { id: randomUUID(), token: null, name: 'Bot 5', isBot: true, role: playAs === 'buyer' ? 'buyer' : 'seller', totalProfit: 0, lastProfit: 0 },
    ]

    const runtime: AuctionRuntimeState = {
      phase: 'playing',
      currentRound: 1,
      config,
      players,
      roundCards: {},
      roundOrders: {},
      history: [],
      eventLog: ['Solo double-auction game started'],
    }
    generateCardsForCurrentRound(runtime)

    await prisma.miniGameSession.create({
      data: {
        educatorId,
        gameType: MiniGameType.DOUBLE_AUCTION,
        roomCode,
        hostToken,
        status: MiniGameSessionStatus.ACTIVE,
        teamCount: 1,
        configJson: {
          auctionConfig: config,
          auctionRuntime: runtime,
          solo: true,
        },
      },
    })

    return res.json({ success: true, roomCode, hostToken, playerToken, session: toPublicSession(roomCode, runtime) })
  } catch (error) {
    if (roomCode) releaseRoomCode(roomCode)
    console.error('Failed to create solo auction room:', error)
    return res.status(500).json({ success: false, error: 'Failed to create solo game' })
  }
})

router.post('/double-auction/:roomCode/join', async (req, res) => {
  const roomCode = String(req.params.roomCode || '').trim().toUpperCase()
  const body = req.body as { name?: string }
  const name = String(body?.name || '').trim().slice(0, 24)
  if (!name) return res.status(400).json({ success: false, error: 'Name is required' })

  try {
    const result = await prisma.$transaction(async (tx) => {
      const session = await tx.miniGameSession.findFirst({ where: { roomCode, gameType: MiniGameType.DOUBLE_AUCTION } })
      if (!session) throw new Error('ROOM_NOT_FOUND')

      const configObj = asConfigObject(session.configJson)
      const runtime = normalizeRuntime(configObj.auctionRuntime, configObj)
      if (runtime.phase !== 'lobby') throw new Error('GAME_ALREADY_STARTED')
      if (runtime.players.some((p) => p.name.toLowerCase() === name.toLowerCase())) throw new Error('NAME_IN_USE')
      if (runtime.players.length >= 80) throw new Error('ROOM_FULL')

      const player: AuctionPlayer = {
        id: randomUUID(), token: randomUUID(), name, isBot: false, role: null, totalProfit: 0, lastProfit: 0,
      }
      runtime.players.push(player)
      runtime.eventLog.unshift(`${name} joined`)
      runtime.eventLog = runtime.eventLog.slice(0, 40)

      await tx.miniGameSession.update({
        where: { id: session.id },
        data: {
          configJson: { ...configObj, auctionRuntime: runtime } as Prisma.InputJsonValue,
          status: toStatus(runtime.phase),
        },
      })

      return { player, runtime }
    })

    return res.json({ success: true, playerToken: result.player.token, playerId: result.player.id, session: toPublicSession(roomCode, result.runtime) })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'JOIN_FAILED'
    if (message === 'ROOM_NOT_FOUND') return res.status(404).json({ success: false, error: 'Room not found' })
    if (message === 'GAME_ALREADY_STARTED') return res.status(400).json({ success: false, error: 'Game already started' })
    if (message === 'NAME_IN_USE') return res.status(400).json({ success: false, error: 'Name already used in this room' })
    if (message === 'ROOM_FULL') return res.status(400).json({ success: false, error: 'Room is full' })

    console.error('Failed to join auction room:', error)
    return res.status(500).json({ success: false, error: 'Failed to join room' })
  }
})

router.get('/double-auction/:roomCode/state', async (req, res) => {
  const roomCode = String(req.params.roomCode || '').trim().toUpperCase()
  const session = await prisma.miniGameSession.findFirst({ where: { roomCode, gameType: MiniGameType.DOUBLE_AUCTION } })
  if (!session) return res.status(404).json({ success: false, error: 'Room not found' })

  const hostToken = typeof req.query.hostToken === 'string' ? req.query.hostToken : null
  const playerToken = typeof req.query.playerToken === 'string' ? req.query.playerToken : null

  const configObj = asConfigObject(session.configJson)
  const runtime = normalizeRuntime(configObj.auctionRuntime, configObj)
  const player = playerToken ? findPlayerByToken(runtime, playerToken) : undefined
  const cards = getRoundCards(runtime)
  const orders = getRoundOrders(runtime)

  return res.json({
    success: true,
    session: toPublicSession(roomCode, runtime),
    viewer: {
      isHost: Boolean(hostToken && session.hostToken && hostToken === session.hostToken),
      playerId: player?.id ?? null,
      playerName: player?.name ?? null,
      role: player?.role ?? null,
      privateNumber: player ? (cards[player.id]?.privateNumber ?? null) : null,
      submitted: player ? Boolean(orders[player.id]) : false,
    },
  })
})

router.post('/double-auction/:roomCode/start', async (req, res) => {
  const roomCode = String(req.params.roomCode || '').trim().toUpperCase()
  const body = req.body as { hostToken?: string }

  try {
    const runtime = await prisma.$transaction(async (tx) => {
      const session = await tx.miniGameSession.findFirst({ where: { roomCode, gameType: MiniGameType.DOUBLE_AUCTION } })
      if (!session) throw new Error('ROOM_NOT_FOUND')
      if (!session.hostToken || body?.hostToken !== session.hostToken) throw new Error('INVALID_HOST')

      const configObj = asConfigObject(session.configJson)
      const runtime = normalizeRuntime(configObj.auctionRuntime, configObj)
      if (runtime.phase !== 'lobby') throw new Error('ALREADY_STARTED')
      if (runtime.players.length < 2) throw new Error('NOT_ENOUGH_PLAYERS')

      assignRoles(runtime.players)
      runtime.phase = 'playing'
      runtime.currentRound = 1
      generateCardsForCurrentRound(runtime)
      runtime.eventLog.unshift(`Game started with ${runtime.players.length} players`)
      runtime.eventLog = runtime.eventLog.slice(0, 40)

      await tx.miniGameSession.update({
        where: { id: session.id },
        data: {
          status: MiniGameSessionStatus.ACTIVE,
          configJson: { ...configObj, auctionRuntime: runtime } as Prisma.InputJsonValue,
        },
      })
      return runtime
    })

    return res.json({ success: true, session: toPublicSession(roomCode, runtime) })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'START_FAILED'
    if (message === 'ROOM_NOT_FOUND') return res.status(404).json({ success: false, error: 'Room not found' })
    if (message === 'INVALID_HOST') return res.status(401).json({ success: false, error: 'Invalid host token' })
    if (message === 'ALREADY_STARTED') return res.status(400).json({ success: false, error: 'Game already started' })
    if (message === 'NOT_ENOUGH_PLAYERS') return res.status(400).json({ success: false, error: 'Need at least 2 players' })
    console.error('Failed to start auction game:', error)
    return res.status(500).json({ success: false, error: 'Failed to start game' })
  }
})

router.post('/double-auction/:roomCode/order', async (req, res) => {
  const roomCode = String(req.params.roomCode || '').trim().toUpperCase()
  const body = req.body as { playerToken?: string; price?: number }
  const playerToken = String(body?.playerToken || '')
  if (!playerToken) return res.status(400).json({ success: false, error: 'Missing player token' })

  try {
    const runtime = await prisma.$transaction(async (tx) => {
      const session = await tx.miniGameSession.findFirst({ where: { roomCode, gameType: MiniGameType.DOUBLE_AUCTION } })
      if (!session) throw new Error('ROOM_NOT_FOUND')

      const configObj = asConfigObject(session.configJson)
      const runtime = normalizeRuntime(configObj.auctionRuntime, configObj)
      const isSoloSession = Boolean(configObj.solo)
      if (runtime.phase !== 'playing') throw new Error('NOT_ACTIVE')

      const player = findPlayerByToken(runtime, playerToken)
      if (!player) throw new Error('INVALID_PLAYER')

      const cards = getRoundCards(runtime)
      const card = cards[player.id]
      if (!card) throw new Error('NO_CARD')

      const price = clampInt(Number(body?.price ?? runtime.config.minPrice), runtime.config.minPrice, runtime.config.maxPrice)
      getRoundOrders(runtime)[player.id] = { price, at: Date.now() }

      if (isSoloSession) {
        applyRoundResolution(runtime)
      }

      await tx.miniGameSession.update({
        where: { id: session.id },
        data: {
          status: toStatus(runtime.phase),
          configJson: { ...configObj, auctionRuntime: runtime } as Prisma.InputJsonValue,
        },
      })
      return runtime
    })

    return res.json({ success: true, session: toPublicSession(roomCode, runtime) })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'ORDER_FAILED'
    if (message === 'ROOM_NOT_FOUND') return res.status(404).json({ success: false, error: 'Room not found' })
    if (message === 'NOT_ACTIVE') return res.status(400).json({ success: false, error: 'Game is not active' })
    if (message === 'INVALID_PLAYER') return res.status(401).json({ success: false, error: 'Invalid player token' })
    if (message === 'NO_CARD') return res.status(400).json({ success: false, error: 'Player card not generated for this round' })
    console.error('Failed to submit auction order:', error)
    return res.status(500).json({ success: false, error: 'Failed to submit order' })
  }
})

router.post('/double-auction/:roomCode/advance', async (req, res) => {
  const roomCode = String(req.params.roomCode || '').trim().toUpperCase()
  const body = req.body as { hostToken?: string }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const session = await tx.miniGameSession.findFirst({ where: { roomCode, gameType: MiniGameType.DOUBLE_AUCTION } })
      if (!session) throw new Error('ROOM_NOT_FOUND')
      if (!session.hostToken || body?.hostToken !== session.hostToken) throw new Error('INVALID_HOST')

      const configObj = asConfigObject(session.configJson)
      const runtime = normalizeRuntime(configObj.auctionRuntime, configObj)
      if (runtime.phase !== 'playing') throw new Error('NOT_ACTIVE')

      const summary = applyRoundResolution(runtime)

      await tx.miniGameSession.update({
        where: { id: session.id },
        data: {
          status: toStatus(runtime.phase),
          configJson: { ...configObj, auctionRuntime: runtime } as Prisma.InputJsonValue,
        },
      })
      return { runtime, summary }
    })

    return res.json({ success: true, session: toPublicSession(roomCode, result.runtime), roundSummary: result.summary })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'ADVANCE_FAILED'
    if (message === 'ROOM_NOT_FOUND') return res.status(404).json({ success: false, error: 'Room not found' })
    if (message === 'INVALID_HOST') return res.status(401).json({ success: false, error: 'Invalid host token' })
    if (message === 'NOT_ACTIVE') return res.status(400).json({ success: false, error: 'Game is not active' })
    console.error('Failed to advance auction game:', error)
    return res.status(500).json({ success: false, error: 'Failed to advance game' })
  }
})

router.post('/double-auction/:roomCode/reset', async (req, res) => {
  const roomCode = String(req.params.roomCode || '').trim().toUpperCase()
  const body = req.body as { hostToken?: string }

  try {
    const runtime = await prisma.$transaction(async (tx) => {
      const session = await tx.miniGameSession.findFirst({ where: { roomCode, gameType: MiniGameType.DOUBLE_AUCTION } })
      if (!session) throw new Error('ROOM_NOT_FOUND')
      if (!session.hostToken || body?.hostToken !== session.hostToken) throw new Error('INVALID_HOST')

      const configObj = asConfigObject(session.configJson)
      const current = normalizeRuntime(configObj.auctionRuntime, configObj)
      const resetRuntime: AuctionRuntimeState = {
        ...current,
        phase: 'lobby',
        currentRound: 1,
        roundCards: {},
        roundOrders: {},
        history: [],
        players: current.players.map((player) => ({
          ...player,
          role: player.isBot ? player.role : null,
          totalProfit: 0,
          lastProfit: 0,
        })),
        eventLog: ['Game reset', ...current.eventLog].slice(0, 40),
      }

      await tx.miniGameSession.update({
        where: { id: session.id },
        data: {
          status: MiniGameSessionStatus.LOBBY,
          configJson: { ...configObj, auctionRuntime: resetRuntime } as Prisma.InputJsonValue,
        },
      })
      return resetRuntime
    })

    return res.json({ success: true, session: toPublicSession(roomCode, runtime) })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'RESET_FAILED'
    if (message === 'ROOM_NOT_FOUND') return res.status(404).json({ success: false, error: 'Room not found' })
    if (message === 'INVALID_HOST') return res.status(401).json({ success: false, error: 'Invalid host token' })
    console.error('Failed to reset auction game:', error)
    return res.status(500).json({ success: false, error: 'Failed to reset game' })
  }
})

export default router
