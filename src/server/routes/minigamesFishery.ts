import { Router } from 'express'
import type { Request } from 'express'
import { randomUUID } from 'crypto'
import { MiniGameSessionStatus, MiniGameType, Prisma } from '@prisma/client'
import { prisma } from '../db'
import { getSession, getSessionCookie } from '../sessionStore'
import { claimUniqueRoomCode, releaseRoomCode } from '../minigames/roomCodeRegistry'

type FisheryMode = 'classic' | 'quota'
type FisheryPhase = 'lobby' | 'playing' | 'results'
type BotBehavior = 'conservative' | 'balanced' | 'greedy'

type FisheryConfig = {
  mode: FisheryMode
  rounds: number
  capacityPerPlayer: number
  quotaPerPlayer: number
}

type FisheryPlayer = {
  id: string
  token: string | null
  name: string
  isBot: boolean
  behavior: BotBehavior | null
  totalCatch: number
  lastCatch: number
}

type FisheryRoundAction = {
  intended: number
  at: number
}

type FisheryRoundSummary = {
  round: number
  stockStart: number
  intendedTotal: number
  actualTotal: number
  stockAfterHarvest: number
  stockAfterReproduction: number
  actions: Array<{ playerId: string; playerName: string; intended: number; actual: number }>
}

type FisheryRuntimeState = {
  phase: FisheryPhase
  currentRound: number
  config: FisheryConfig
  players: FisheryPlayer[]
  stock: number
  roundActions: Record<string, Record<string, FisheryRoundAction>>
  history: FisheryRoundSummary[]
  eventLog: string[]
}

type ConfigPayload = {
  fisheryRuntime?: FisheryRuntimeState
  fisheryConfig?: Partial<FisheryConfig>
  [key: string]: unknown
}

const router = Router()

function clampInt(n: number, min: number, max: number): number {
  if (Number.isNaN(n)) return min
  return Math.max(min, Math.min(max, Math.floor(n)))
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

function defaultConfig(config?: Partial<FisheryConfig>): FisheryConfig {
  return {
    mode: config?.mode === 'quota' ? 'quota' : 'classic',
    rounds: clampInt(config?.rounds ?? 6, 3, 12),
    capacityPerPlayer: clampInt(config?.capacityPerPlayer ?? 40, 10, 100),
    quotaPerPlayer: clampInt(config?.quotaPerPlayer ?? 8, 1, 40),
  }
}

function defaultRuntime(config?: Partial<FisheryConfig>): FisheryRuntimeState {
  return {
    phase: 'lobby',
    currentRound: 1,
    config: defaultConfig(config),
    players: [],
    stock: 0,
    roundActions: {},
    history: [],
    eventLog: [],
  }
}

function normalizeRuntime(runtime: FisheryRuntimeState | undefined, configObj: ConfigPayload): FisheryRuntimeState {
  if (!runtime) return defaultRuntime(configObj.fisheryConfig)
  return {
    phase: runtime.phase,
    currentRound: Number(runtime.currentRound || 1),
    config: defaultConfig(runtime.config),
    players: Array.isArray(runtime.players) ? runtime.players : [],
    stock: Number(runtime.stock || 0),
    roundActions: runtime.roundActions || {},
    history: Array.isArray(runtime.history) ? runtime.history : [],
    eventLog: Array.isArray(runtime.eventLog) ? runtime.eventLog.slice(0, 40) : [],
  }
}

function toStatus(phase: FisheryPhase): MiniGameSessionStatus {
  if (phase === 'lobby') return MiniGameSessionStatus.LOBBY
  if (phase === 'playing') return MiniGameSessionStatus.ACTIVE
  return MiniGameSessionStatus.COMPLETED
}

function toPublicSession(roomCode: string, runtime: FisheryRuntimeState) {
  const totalPlayers = runtime.players.length
  const stockCapacity = runtime.config.capacityPerPlayer * totalPlayers
  const roundActions = runtime.roundActions[String(runtime.currentRound)] || {}
  const actedCount = Object.keys(roundActions).length
  const waitingCount = runtime.players.filter((p) => !p.isBot).length

  return {
    roomCode,
    phase: runtime.phase,
    currentRound: runtime.currentRound,
    config: runtime.config,
    stock: runtime.stock,
    stockCapacity,
    players: runtime.players.map((p) => ({
      id: p.id,
      name: p.name,
      isBot: p.isBot,
      totalCatch: p.totalCatch,
      lastCatch: p.lastCatch,
    })),
    stats: { actedCount, waitingCount },
    history: runtime.history,
    eventLog: runtime.eventLog,
  }
}

function getRoundActions(runtime: FisheryRuntimeState): Record<string, FisheryRoundAction> {
  const key = String(runtime.currentRound)
  if (!runtime.roundActions[key]) runtime.roundActions[key] = {}
  return runtime.roundActions[key]
}

function findHumanPlayerByToken(runtime: FisheryRuntimeState, token: string): FisheryPlayer | undefined {
  return runtime.players.find((p) => !p.isBot && p.token === token)
}

function botIntendedCatch(stockPerPlayer: number, behavior: BotBehavior): number {
  if (behavior === 'conservative') return Math.max(0, Math.floor(stockPerPlayer * 0.2))
  if (behavior === 'greedy') return Math.max(0, Math.floor(stockPerPlayer * 0.75))
  return Math.max(0, Math.floor(stockPerPlayer * 0.45))
}

function resolveRound(runtime: FisheryRuntimeState) {
  const round = runtime.currentRound
  const actions = getRoundActions(runtime)
  const stockStart = runtime.stock
  const activePlayers = runtime.players
  const stockPerPlayer = activePlayers.length > 0 ? stockStart / activePlayers.length : 0
  const quota = runtime.config.mode === 'quota' ? runtime.config.quotaPerPlayer : Number.MAX_SAFE_INTEGER

  const intendedByPlayer = activePlayers.map((p) => {
    const intendedFromAction = actions[p.id]?.intended
    const intendedRaw = p.isBot ? botIntendedCatch(stockPerPlayer, p.behavior || 'balanced') : (intendedFromAction ?? 0)
    const intended = clampInt(intendedRaw, 0, quota)
    return { player: p, intended }
  })

  const intendedTotal = intendedByPlayer.reduce((sum, row) => sum + row.intended, 0)
  const actualByPlayer = intendedByPlayer.map((row) => ({ ...row, actual: row.intended }))

  if (intendedTotal > stockStart && intendedTotal > 0) {
    const scale = stockStart / intendedTotal
    for (const row of actualByPlayer) {
      row.actual = Math.floor(row.intended * scale)
    }
    let remaining = Math.max(0, stockStart - actualByPlayer.reduce((sum, row) => sum + row.actual, 0))
    const remainders = actualByPlayer
      .map((row) => ({ row, frac: row.intended * scale - row.actual }))
      .sort((a, b) => b.frac - a.frac)
    for (const item of remainders) {
      if (remaining <= 0) break
      item.row.actual += 1
      remaining -= 1
    }
  }

  const actualTotal = actualByPlayer.reduce((sum, row) => sum + row.actual, 0)
  const stockAfterHarvest = Math.max(0, stockStart - actualTotal)
  const stockCapacity = runtime.config.capacityPerPlayer * activePlayers.length
  const stockAfterReproduction = Math.min(stockCapacity, stockAfterHarvest * 2)
  runtime.stock = stockAfterReproduction

  const summaryActions = actualByPlayer.map((row) => {
    row.player.totalCatch += row.actual
    row.player.lastCatch = row.actual
    return {
      playerId: row.player.id,
      playerName: row.player.name,
      intended: row.intended,
      actual: row.actual,
    }
  })

  runtime.history.push({
    round,
    stockStart,
    intendedTotal,
    actualTotal,
    stockAfterHarvest,
    stockAfterReproduction,
    actions: summaryActions,
  })

  const reproductionAmount = stockAfterReproduction - stockAfterHarvest
  if (stockAfterReproduction <= 0) {
    runtime.eventLog.unshift(`Season ${round}: TOTAL COLLAPSE. All ${stockStart} fish were harvested or died.`)
  } else {
    runtime.eventLog.unshift(`Season ${round}: ${actualTotal} units harvested. +${reproductionAmount} new growth.`)
  }
  runtime.eventLog = runtime.eventLog.slice(0, 40)
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

router.post('/fishery/create', async (req, res) => {
  const educatorId = requireEducatorId(req)
  if (!educatorId) return res.status(401).json({ success: false, error: 'Educator login required' })

  const body = req.body as { config?: Partial<FisheryConfig> }
  const runtime = defaultRuntime(body?.config)
  let roomCode: string | null = null

  try {
    roomCode = await allocateRoomCode()
    const hostToken = randomUUID()
    await prisma.miniGameSession.create({
      data: {
        educatorId,
        gameType: MiniGameType.FISHERY,
        roomCode,
        hostToken,
        status: MiniGameSessionStatus.LOBBY,
        teamCount: 40,
        configJson: {
          fisheryConfig: runtime.config,
          fisheryRuntime: runtime,
        },
      },
    })
    return res.json({ success: true, roomCode, hostToken, session: toPublicSession(roomCode, runtime) })
  } catch (error) {
    if (roomCode) releaseRoomCode(roomCode)
    console.error('Failed to create fishery room:', error)
    return res.status(500).json({ success: false, error: 'Failed to create room' })
  }
})

router.post('/fishery/solo', async (req, res) => {
  const educatorId = requireEducatorId(req)
  if (!educatorId) return res.status(401).json({ success: false, error: 'Educator login required' })

  const body = req.body as { name?: string; config?: Partial<FisheryConfig> }
  const name = String(body?.name || 'Host').trim().slice(0, 24) || 'Host'
  const config = defaultConfig(body?.config)
  let roomCode: string | null = null

  try {
    roomCode = await allocateRoomCode()
    const hostToken = randomUUID()
    const playerToken = randomUUID()

    const players: FisheryPlayer[] = [
      { id: randomUUID(), token: playerToken, name, isBot: false, behavior: null, totalCatch: 0, lastCatch: 0 },
      { id: randomUUID(), token: null, name: 'Bot Conservative', isBot: true, behavior: 'conservative', totalCatch: 0, lastCatch: 0 },
      { id: randomUUID(), token: null, name: 'Bot Balanced', isBot: true, behavior: 'balanced', totalCatch: 0, lastCatch: 0 },
      { id: randomUUID(), token: null, name: 'Bot Greedy', isBot: true, behavior: 'greedy', totalCatch: 0, lastCatch: 0 },
    ]

    const runtime: FisheryRuntimeState = {
      phase: 'playing',
      currentRound: 1,
      config,
      players,
      stock: Math.floor(config.capacityPerPlayer * players.length * 0.5),
      roundActions: {},
      history: [],
      eventLog: ['Solo game started'],
    }

    await prisma.miniGameSession.create({
      data: {
        educatorId,
        gameType: MiniGameType.FISHERY,
        roomCode,
        hostToken,
        status: MiniGameSessionStatus.ACTIVE,
        teamCount: 1,
        configJson: {
          fisheryConfig: config,
          fisheryRuntime: runtime,
          solo: true,
        },
      },
    })

    return res.json({ success: true, roomCode, hostToken, playerToken, session: toPublicSession(roomCode, runtime) })
  } catch (error) {
    if (roomCode) releaseRoomCode(roomCode)
    console.error('Failed to create fishery solo room:', error)
    return res.status(500).json({ success: false, error: 'Failed to create solo game' })
  }
})

router.post('/fishery/:roomCode/join', async (req, res) => {
  const roomCode = String(req.params.roomCode || '').trim().toUpperCase()
  const body = req.body as { name?: string }
  const name = String(body?.name || '').trim().slice(0, 24)
  if (!name) return res.status(400).json({ success: false, error: 'Name is required' })

  try {
    const result = await prisma.$transaction(async (tx) => {
      const session = await tx.miniGameSession.findFirst({ where: { roomCode, gameType: MiniGameType.FISHERY } })
      if (!session) throw new Error('ROOM_NOT_FOUND')

      const configObj = asConfigObject(session.configJson)
      const runtime = normalizeRuntime(configObj.fisheryRuntime, configObj)
      if (runtime.phase !== 'lobby') throw new Error('GAME_ALREADY_STARTED')
      if (runtime.players.some((p) => p.name.toLowerCase() === name.toLowerCase())) throw new Error('NAME_IN_USE')
      if (runtime.players.length >= 60) throw new Error('ROOM_FULL')

      const player: FisheryPlayer = {
        id: randomUUID(), token: randomUUID(), name, isBot: false, behavior: null, totalCatch: 0, lastCatch: 0,
      }
      runtime.players.push(player)
      runtime.eventLog.unshift(`${name} joined`)
      runtime.eventLog = runtime.eventLog.slice(0, 40)

      await tx.miniGameSession.update({
        where: { id: session.id },
        data: {
          configJson: { ...configObj, fisheryRuntime: runtime } as Prisma.InputJsonValue,
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

    console.error('Failed to join fishery room:', error)
    return res.status(500).json({ success: false, error: 'Failed to join room' })
  }
})

router.get('/fishery/:roomCode/state', async (req, res) => {
  const roomCode = String(req.params.roomCode || '').trim().toUpperCase()
  try {
    const session = await prisma.miniGameSession.findFirst({ where: { roomCode, gameType: MiniGameType.FISHERY } })
    if (!session) return res.status(404).json({ success: false, error: 'Room not found' })

    const hostToken = typeof req.query.hostToken === 'string' ? req.query.hostToken : null
    const playerToken = typeof req.query.playerToken === 'string' ? req.query.playerToken : null

    const configObj = asConfigObject(session.configJson)
    const runtime = normalizeRuntime(configObj.fisheryRuntime, configObj)
    const player = playerToken ? findHumanPlayerByToken(runtime, playerToken) : undefined
    const roundActions = getRoundActions(runtime)

    return res.json({
      success: true,
      session: toPublicSession(roomCode, runtime),
      viewer: {
        isHost: Boolean(hostToken && session.hostToken && hostToken === session.hostToken),
        playerId: player?.id ?? null,
        playerName: player?.name ?? null,
        submitted: player ? Boolean(roundActions[player.id]) : false,
      },
    })
  } catch (error) {
    const prismaCode =
      error instanceof Prisma.PrismaClientKnownRequestError || error instanceof Prisma.PrismaClientInitializationError
        ? error.code
        : null
    if (prismaCode === 'P1001' || prismaCode === 'P2024') {
      return res.status(503).json({ success: false, error: 'Database unavailable. Please retry shortly.' })
    }
    console.error('Failed to fetch fishery state:', error)
    return res.status(500).json({ success: false, error: 'Failed to fetch state' })
  }
})

router.post('/fishery/:roomCode/start', async (req, res) => {
  const roomCode = String(req.params.roomCode || '').trim().toUpperCase()
  const body = req.body as { hostToken?: string }

  try {
    const runtime = await prisma.$transaction(async (tx) => {
      const session = await tx.miniGameSession.findFirst({ where: { roomCode, gameType: MiniGameType.FISHERY } })
      if (!session) throw new Error('ROOM_NOT_FOUND')
      if (!session.hostToken || body?.hostToken !== session.hostToken) throw new Error('INVALID_HOST')

      const configObj = asConfigObject(session.configJson)
      const runtime = normalizeRuntime(configObj.fisheryRuntime, configObj)
      if (runtime.phase !== 'lobby') throw new Error('ALREADY_STARTED')
      if (runtime.players.length < 1) throw new Error('NOT_ENOUGH_PLAYERS')

      runtime.phase = 'playing'
      runtime.currentRound = 1
      runtime.stock = Math.floor(runtime.config.capacityPerPlayer * runtime.players.length * 0.5)
      runtime.eventLog.unshift(`Game started with ${runtime.players.length} players`)
      runtime.eventLog = runtime.eventLog.slice(0, 40)

      await tx.miniGameSession.update({
        where: { id: session.id },
        data: {
          status: MiniGameSessionStatus.ACTIVE,
          configJson: { ...configObj, fisheryRuntime: runtime } as Prisma.InputJsonValue,
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
    if (message === 'NOT_ENOUGH_PLAYERS') return res.status(400).json({ success: false, error: 'Need at least 1 player' })
    console.error('Failed to start fishery game:', error)
    return res.status(500).json({ success: false, error: 'Failed to start game' })
  }
})

router.post('/fishery/:roomCode/action', async (req, res) => {
  const roomCode = String(req.params.roomCode || '').trim().toUpperCase()
  const body = req.body as { playerToken?: string; catch?: number }
  const playerToken = String(body?.playerToken || '')
  if (!playerToken) return res.status(400).json({ success: false, error: 'Missing player token' })

  try {
    const runtime = await prisma.$transaction(async (tx) => {
      const session = await tx.miniGameSession.findFirst({ where: { roomCode, gameType: MiniGameType.FISHERY } })
      if (!session) throw new Error('ROOM_NOT_FOUND')

      const configObj = asConfigObject(session.configJson)
      const runtime = normalizeRuntime(configObj.fisheryRuntime, configObj)
      if (runtime.phase !== 'playing') throw new Error('NOT_ACTIVE')

      const player = findHumanPlayerByToken(runtime, playerToken)
      if (!player) throw new Error('INVALID_PLAYER')

      const roundActions = getRoundActions(runtime)
      const maxCatch = runtime.config.mode === 'quota' ? runtime.config.quotaPerPlayer : runtime.stock
      const intended = clampInt(Number(body?.catch ?? 0), 0, Math.max(0, maxCatch))
      roundActions[player.id] = { intended, at: Date.now() }

      await tx.miniGameSession.update({
        where: { id: session.id },
        data: { configJson: { ...configObj, fisheryRuntime: runtime } as Prisma.InputJsonValue },
      })
      return runtime
    })

    return res.json({ success: true, session: toPublicSession(roomCode, runtime) })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'ACTION_FAILED'
    if (message === 'ROOM_NOT_FOUND') return res.status(404).json({ success: false, error: 'Room not found' })
    if (message === 'NOT_ACTIVE') return res.status(400).json({ success: false, error: 'Game is not active' })
    if (message === 'INVALID_PLAYER') return res.status(401).json({ success: false, error: 'Invalid player token' })
    console.error('Failed to submit fishery action:', error)
    return res.status(500).json({ success: false, error: 'Failed to submit action' })
  }
})

router.post('/fishery/:roomCode/advance', async (req, res) => {
  const roomCode = String(req.params.roomCode || '').trim().toUpperCase()
  const body = req.body as { hostToken?: string }

  try {
    const runtime = await prisma.$transaction(async (tx) => {
      const session = await tx.miniGameSession.findFirst({ where: { roomCode, gameType: MiniGameType.FISHERY } })
      if (!session) throw new Error('ROOM_NOT_FOUND')
      if (!session.hostToken || body?.hostToken !== session.hostToken) throw new Error('INVALID_HOST')

      const configObj = asConfigObject(session.configJson)
      const runtime = normalizeRuntime(configObj.fisheryRuntime, configObj)
      if (runtime.phase !== 'playing') throw new Error('NOT_ACTIVE')

      resolveRound(runtime)
      if (runtime.currentRound >= runtime.config.rounds) {
        runtime.phase = 'results'
        runtime.eventLog.unshift('Game finished')
      } else {
        runtime.currentRound += 1
        runtime.eventLog.unshift(`Round ${runtime.currentRound - 1} closed`)
      }
      runtime.eventLog = runtime.eventLog.slice(0, 40)

      await tx.miniGameSession.update({
        where: { id: session.id },
        data: {
          status: toStatus(runtime.phase),
          configJson: { ...configObj, fisheryRuntime: runtime } as Prisma.InputJsonValue,
        },
      })
      return runtime
    })

    return res.json({ success: true, session: toPublicSession(roomCode, runtime) })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'ADVANCE_FAILED'
    if (message === 'ROOM_NOT_FOUND') return res.status(404).json({ success: false, error: 'Room not found' })
    if (message === 'INVALID_HOST') return res.status(401).json({ success: false, error: 'Invalid host token' })
    if (message === 'NOT_ACTIVE') return res.status(400).json({ success: false, error: 'Game is not active' })
    console.error('Failed to advance fishery game:', error)
    return res.status(500).json({ success: false, error: 'Failed to advance game' })
  }
})

router.post('/fishery/:roomCode/reset', async (req, res) => {
  const roomCode = String(req.params.roomCode || '').trim().toUpperCase()
  const body = req.body as { hostToken?: string }

  try {
    const runtime = await prisma.$transaction(async (tx) => {
      const session = await tx.miniGameSession.findFirst({ where: { roomCode, gameType: MiniGameType.FISHERY } })
      if (!session) throw new Error('ROOM_NOT_FOUND')
      if (!session.hostToken || body?.hostToken !== session.hostToken) throw new Error('INVALID_HOST')

      const configObj = asConfigObject(session.configJson)
      const current = normalizeRuntime(configObj.fisheryRuntime, configObj)
      const resetRuntime: FisheryRuntimeState = {
        ...current,
        phase: 'lobby',
        currentRound: 1,
        roundActions: {},
        history: [],
        stock: 0,
        players: current.players.map((p) => ({ ...p, totalCatch: 0, lastCatch: 0 })),
        eventLog: ['Game reset', ...current.eventLog].slice(0, 40),
      }

      await tx.miniGameSession.update({
        where: { id: session.id },
        data: {
          status: MiniGameSessionStatus.LOBBY,
          configJson: { ...configObj, fisheryRuntime: resetRuntime } as Prisma.InputJsonValue,
        },
      })
      return resetRuntime
    })

    return res.json({ success: true, session: toPublicSession(roomCode, runtime) })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'RESET_FAILED'
    if (message === 'ROOM_NOT_FOUND') return res.status(404).json({ success: false, error: 'Room not found' })
    if (message === 'INVALID_HOST') return res.status(401).json({ success: false, error: 'Invalid host token' })
    console.error('Failed to reset fishery game:', error)
    return res.status(500).json({ success: false, error: 'Failed to reset game' })
  }
})

export default router
