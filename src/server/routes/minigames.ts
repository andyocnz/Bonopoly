import { Router } from 'express'
import type { Request } from 'express'
import { randomUUID } from 'crypto'
import { MiniGameSessionStatus, MiniGameType, Prisma } from '@prisma/client'
import { prisma } from '../db'
import { getSession, getSessionCookie } from '../sessionStore'
import { claimUniqueRoomCode, releaseRoomCode } from '../minigames/roomCodeRegistry'

type GamePhase = 'lobby' | 'playing' | 'results'
type PlayerAction = 'wait' | 'withdraw'

type BankRunConfig = {
  deposit: number
  maturityPayout: number
  liquidityRatio: number
  liquidationPenalty: number
  totalDays: number
}

type PlayerState = {
  id: string
  token: string
  name: string
  joinedAt: number
  withdrawnDay: number | null
  earlyPayout: number
  finalPayout: number
}

type ActionEntry = {
  action: PlayerAction
  at: number
}

type BankRunRuntimeState = {
  phase: GamePhase
  currentDay: number
  config: BankRunConfig
  players: PlayerState[]
  actionsByDay: Record<string, Record<string, ActionEntry>>
  remainingLiquidity: number
  remainingMaturityPool: number
  eventLog: string[]
}

type SessionConfigPayload = {
  bankRunRuntime?: BankRunRuntimeState
  [key: string]: unknown
}

const router = Router()

function asConfigObject(value: Prisma.JsonValue | null): SessionConfigPayload {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as SessionConfigPayload
  }
  return {}
}

function defaultBankRunConfig(override?: Partial<BankRunConfig>): BankRunConfig {
  return {
    deposit: 100,
    maturityPayout: 150,
    liquidityRatio: Math.max(0.1, Math.min(0.9, override?.liquidityRatio ?? 0.4)),
    liquidationPenalty: Math.max(1, Math.min(5, override?.liquidationPenalty ?? 2.0)),
    totalDays: 3,
  }
}

function defaultRuntime(configOverride?: Partial<BankRunConfig>): BankRunRuntimeState {
  return {
    phase: 'lobby',
    currentDay: 1,
    config: defaultBankRunConfig(configOverride),
    players: [],
    actionsByDay: {},
    remainingLiquidity: 0,
    remainingMaturityPool: 0,
    eventLog: [],
  }
}

function normalizeRuntime(runtime: BankRunRuntimeState | undefined, configObj: SessionConfigPayload): BankRunRuntimeState {
  if (!runtime) {
    const cfg = (configObj.bankRunConfig && typeof configObj.bankRunConfig === 'object' && !Array.isArray(configObj.bankRunConfig))
      ? (configObj.bankRunConfig as Partial<BankRunConfig>)
      : undefined
    return defaultRuntime(cfg)
  }

  return {
    phase: runtime.phase,
    currentDay: Number(runtime.currentDay || 1),
    config: defaultBankRunConfig(runtime.config),
    players: Array.isArray(runtime.players) ? runtime.players : [],
    actionsByDay: runtime.actionsByDay || {},
    remainingLiquidity: Number(runtime.remainingLiquidity || 0),
    remainingMaturityPool: Number(runtime.remainingMaturityPool || 0),
    eventLog: Array.isArray(runtime.eventLog) ? runtime.eventLog.slice(0, 40) : [],
  }
}

function toSessionStatus(phase: GamePhase): MiniGameSessionStatus {
  if (phase === 'lobby') return MiniGameSessionStatus.LOBBY
  if (phase === 'playing') return MiniGameSessionStatus.ACTIVE
  return MiniGameSessionStatus.COMPLETED
}

function toPublicSession(roomCode: string, runtime: BankRunRuntimeState) {
  const players = runtime.players.map((p) => ({
    id: p.id,
    name: p.name,
    withdrawnDay: p.withdrawnDay,
    earlyPayout: p.earlyPayout,
    finalPayout: p.finalPayout,
    totalPayout: p.earlyPayout + p.finalPayout,
  }))

  const totalPlayers = players.length
  const withdrawnCount = players.filter((p) => p.withdrawnDay !== null).length
  const waitingCount = totalPlayers - withdrawnCount
  const todayActions = runtime.actionsByDay[String(runtime.currentDay)] || {}
  const actedCount = Object.keys(todayActions).length

  return {
    roomCode,
    phase: runtime.phase,
    currentDay: runtime.currentDay,
    config: runtime.config,
    remainingLiquidity: runtime.remainingLiquidity,
    remainingMaturityPool: runtime.remainingMaturityPool,
    players,
    stats: {
      totalPlayers,
      withdrawnCount,
      waitingCount,
      actedCount,
    },
    eventLog: runtime.eventLog,
  }
}

async function findBankRunSessionByRoom(roomCode: string) {
  return prisma.miniGameSession.findFirst({
    where: { roomCode, gameType: MiniGameType.BANK_RUN },
  })
}

function requireEducatorId(req: Request): string | null {
  const sessionId = getSessionCookie(req, 'educator')
  const session = getSession(sessionId)
  if (!session || session.role !== 'educator' || !session.educatorId) {
    return null
  }
  return session.educatorId
}

async function allocateRoomCode(): Promise<string> {
  let attempts = 0
  while (attempts < 200) {
    const code = claimUniqueRoomCode()
    const existing = await prisma.miniGameSession.findFirst({
      where: { roomCode: code },
      select: { id: true },
    })
    if (!existing) {
      return code
    }
    releaseRoomCode(code)
    attempts += 1
  }
  throw new Error('Unable to generate unique room code')
}

router.post('/bank-run/create', async (req, res) => {
  const educatorId = requireEducatorId(req)
  if (!educatorId) {
    return res.status(401).json({ success: false, error: 'Educator login required' })
  }

  const body = req.body as { config?: Partial<BankRunConfig> }
  const runtime = defaultRuntime(body?.config)
  let roomCode: string | null = null

  try {
    roomCode = await allocateRoomCode()
    const hostToken = randomUUID()

    const created = await prisma.miniGameSession.create({
      data: {
        educatorId,
        gameType: MiniGameType.BANK_RUN,
        teamCount: 40,
        status: MiniGameSessionStatus.LOBBY,
        roomCode,
        hostToken,
        configJson: {
          bankRunRuntime: runtime,
          bankRunConfig: runtime.config,
          createdVia: 'bank-run-page',
        },
      },
    })

    return res.json({
      success: true,
      roomCode: created.roomCode,
      hostToken: created.hostToken,
      session: toPublicSession(created.roomCode || roomCode, runtime),
    })
  } catch (error) {
    if (roomCode) {
      releaseRoomCode(roomCode)
    }
    console.error('Failed to create bank run room:', error)
    return res.status(500).json({ success: false, error: 'Failed to create room' })
  }
})

router.post('/bank-run/:roomCode/join', async (req, res) => {
  const roomCode = String(req.params.roomCode || '').trim().toUpperCase()
  const body = req.body as { name?: string }
  const name = String(body?.name || '').trim().slice(0, 24)

  if (!name) {
    return res.status(400).json({ success: false, error: 'Name is required' })
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const session = await tx.miniGameSession.findFirst({
        where: { roomCode, gameType: MiniGameType.BANK_RUN },
      })
      if (!session) {
        throw new Error('ROOM_NOT_FOUND')
      }

      const configObj = asConfigObject(session.configJson)
      const runtime = normalizeRuntime(configObj.bankRunRuntime, configObj)

      if (runtime.phase !== 'lobby') {
        throw new Error('GAME_ALREADY_STARTED')
      }
      if (runtime.players.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
        throw new Error('NAME_IN_USE')
      }
      if (runtime.players.length >= 100) {
        throw new Error('ROOM_FULL')
      }

      const player: PlayerState = {
        id: randomUUID(),
        token: randomUUID(),
        name,
        joinedAt: Date.now(),
        withdrawnDay: null,
        earlyPayout: 0,
        finalPayout: 0,
      }

      runtime.players.push(player)
      runtime.eventLog.unshift(`${name} joined the room`)
      runtime.eventLog = runtime.eventLog.slice(0, 40)

      const updatedConfig: SessionConfigPayload = {
        ...configObj,
        bankRunRuntime: runtime,
      }

      await tx.miniGameSession.update({
        where: { id: session.id },
        data: {
          configJson: updatedConfig as Prisma.InputJsonValue,
          status: toSessionStatus(runtime.phase),
        },
      })

      return { player, runtime }
    })

    return res.json({
      success: true,
      playerToken: result.player.token,
      playerId: result.player.id,
      session: toPublicSession(roomCode, result.runtime),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'JOIN_FAILED'
    if (message === 'ROOM_NOT_FOUND') return res.status(404).json({ success: false, error: 'Room not found' })
    if (message === 'GAME_ALREADY_STARTED') return res.status(400).json({ success: false, error: 'Game already started' })
    if (message === 'NAME_IN_USE') return res.status(400).json({ success: false, error: 'Name already used in this room' })
    if (message === 'ROOM_FULL') return res.status(400).json({ success: false, error: 'Room is full' })

    console.error('Failed to join bank run room:', error)
    return res.status(500).json({ success: false, error: 'Failed to join room' })
  }
})

router.post('/bank-run/:roomCode/rejoin', async (req, res) => {
  const roomCode = String(req.params.roomCode || '').trim().toUpperCase()
  const body = req.body as { name?: string }
  const name = String(body?.name || '').trim().slice(0, 24)

  if (!name) {
    return res.status(400).json({ success: false, error: 'Name is required' })
  }

  try {
    const session = await findBankRunSessionByRoom(roomCode)
    if (!session) {
      return res.status(404).json({ success: false, error: 'Room not found' })
    }

    const configObj = asConfigObject(session.configJson)
    const runtime = normalizeRuntime(configObj.bankRunRuntime, configObj)
    const player = runtime.players.find((p) => p.name.toLowerCase() === name.toLowerCase())

    if (!player) {
      return res.status(404).json({ success: false, error: 'Player not found in this room' })
    }

    return res.json({
      success: true,
      playerToken: player.token,
      playerId: player.id,
      session: toPublicSession(roomCode, runtime),
    })
  } catch (error) {
    console.error('Failed to rejoin bank run room:', error)
    return res.status(500).json({ success: false, error: 'Failed to rejoin room' })
  }
})

router.get('/bank-run/:roomCode/state', async (req, res) => {
  const roomCode = String(req.params.roomCode || '').trim().toUpperCase()
  const playerToken = typeof req.query.playerToken === 'string' ? req.query.playerToken : null
  const hostToken = typeof req.query.hostToken === 'string' ? req.query.hostToken : null

  const session = await findBankRunSessionByRoom(roomCode)
  if (!session) {
    return res.status(404).json({ success: false, error: 'Room not found' })
  }

  const configObj = asConfigObject(session.configJson)
  const runtime = normalizeRuntime(configObj.bankRunRuntime, configObj)

  const isHost = Boolean(hostToken && session.hostToken && hostToken === session.hostToken)
  const player = playerToken ? runtime.players.find((p) => p.token === playerToken) : undefined
  const todayActions = runtime.actionsByDay[String(runtime.currentDay)] || {}
  const currentAction = player ? (todayActions[player.id]?.action ?? null) : null

  return res.json({
    success: true,
    session: toPublicSession(roomCode, runtime),
    viewer: {
      isHost,
      playerId: player?.id ?? null,
      playerName: player?.name ?? null,
      hasWithdrawn: player?.withdrawnDay !== null,
      hasSubmittedToday: currentAction !== null,
      currentAction,
    },
  })
})

router.post('/bank-run/:roomCode/start', async (req, res) => {
  const roomCode = String(req.params.roomCode || '').trim().toUpperCase()
  const body = req.body as { hostToken?: string }

  try {
    const runtime = await prisma.$transaction(async (tx) => {
      const session = await tx.miniGameSession.findFirst({
        where: { roomCode, gameType: MiniGameType.BANK_RUN },
      })
      if (!session) throw new Error('ROOM_NOT_FOUND')
      if (!session.hostToken || body?.hostToken !== session.hostToken) throw new Error('INVALID_HOST')

      const configObj = asConfigObject(session.configJson)
      const runtime = normalizeRuntime(configObj.bankRunRuntime, configObj)

      if (runtime.phase !== 'lobby') throw new Error('ALREADY_STARTED')
      if (runtime.players.length < 1) throw new Error('NOT_ENOUGH_PLAYERS')

      runtime.phase = 'playing'
      runtime.currentDay = 1
      runtime.remainingLiquidity = Math.round(runtime.players.length * runtime.config.deposit * runtime.config.liquidityRatio)
      runtime.remainingMaturityPool = runtime.players.length * runtime.config.maturityPayout
      runtime.eventLog.unshift(`Game started with ${runtime.players.length} players`)
      runtime.eventLog = runtime.eventLog.slice(0, 40)

      const updatedConfig: SessionConfigPayload = { ...configObj, bankRunRuntime: runtime }
      await tx.miniGameSession.update({
        where: { id: session.id },
        data: {
          status: MiniGameSessionStatus.ACTIVE,
          configJson: updatedConfig as Prisma.InputJsonValue,
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
    if (message === 'NOT_ENOUGH_PLAYERS') return res.status(400).json({ success: false, error: 'Need at least 1 player to start' })

    console.error('Failed to start bank run game:', error)
    return res.status(500).json({ success: false, error: 'Failed to start game' })
  }
})

router.post('/bank-run/:roomCode/action', async (req, res) => {
  const roomCode = String(req.params.roomCode || '').trim().toUpperCase()
  const body = req.body as { playerToken?: string; action?: PlayerAction }
  const playerToken = String(body?.playerToken || '')
  const action = body?.action

  if (!playerToken) {
    return res.status(400).json({ success: false, error: 'Missing player token' })
  }
  if (action !== 'wait' && action !== 'withdraw') {
    return res.status(400).json({ success: false, error: 'Invalid action' })
  }

  try {
    const runtime = await prisma.$transaction(async (tx) => {
      const session = await tx.miniGameSession.findFirst({
        where: { roomCode, gameType: MiniGameType.BANK_RUN },
      })
      if (!session) throw new Error('ROOM_NOT_FOUND')

      const configObj = asConfigObject(session.configJson)
      const runtime = normalizeRuntime(configObj.bankRunRuntime, configObj)
      if (runtime.phase !== 'playing') throw new Error('NOT_ACTIVE')

      const player = runtime.players.find((p) => p.token === playerToken)
      if (!player) throw new Error('INVALID_PLAYER')
      if (player.withdrawnDay !== null) throw new Error('ALREADY_WITHDREW')

      const dayKey = String(runtime.currentDay)
      if (!runtime.actionsByDay[dayKey]) runtime.actionsByDay[dayKey] = {}
      runtime.actionsByDay[dayKey][player.id] = { action, at: Date.now() }

      const updatedConfig: SessionConfigPayload = { ...configObj, bankRunRuntime: runtime }
      await tx.miniGameSession.update({
        where: { id: session.id },
        data: { configJson: updatedConfig as Prisma.InputJsonValue },
      })

      return runtime
    })

    return res.json({ success: true, session: toPublicSession(roomCode, runtime) })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'ACTION_FAILED'
    if (message === 'ROOM_NOT_FOUND') return res.status(404).json({ success: false, error: 'Room not found' })
    if (message === 'NOT_ACTIVE') return res.status(400).json({ success: false, error: 'Game is not active' })
    if (message === 'INVALID_PLAYER') return res.status(401).json({ success: false, error: 'Invalid player token' })
    if (message === 'ALREADY_WITHDREW') return res.status(400).json({ success: false, error: 'You already withdrew in a previous day' })

    console.error('Failed to record bank run action:', error)
    return res.status(500).json({ success: false, error: 'Failed to submit action' })
  }
})

router.post('/bank-run/:roomCode/advance', async (req, res) => {
  const roomCode = String(req.params.roomCode || '').trim().toUpperCase()
  const body = req.body as { hostToken?: string }

  try {
    const runtime = await prisma.$transaction(async (tx) => {
      const session = await tx.miniGameSession.findFirst({
        where: { roomCode, gameType: MiniGameType.BANK_RUN },
      })
      if (!session) throw new Error('ROOM_NOT_FOUND')
      if (!session.hostToken || body?.hostToken !== session.hostToken) throw new Error('INVALID_HOST')

      const configObj = asConfigObject(session.configJson)
      const runtime = normalizeRuntime(configObj.bankRunRuntime, configObj)
      if (runtime.phase !== 'playing') throw new Error('NOT_ACTIVE')

      const day = runtime.currentDay
      const dayKey = String(day)
      const todayActions = runtime.actionsByDay[dayKey] || {}

      const withdrawalRequests = runtime.players
        .filter((player) => player.withdrawnDay === null && todayActions[player.id]?.action === 'withdraw')
        .map((player) => ({ player, at: todayActions[player.id]?.at ?? Number.MAX_SAFE_INTEGER }))
        .sort((a, b) => a.at - b.at)

      for (const request of withdrawalRequests) {
        const payout = Math.min(runtime.config.deposit, runtime.remainingLiquidity)
        request.player.earlyPayout += payout
        request.player.withdrawnDay = day
        runtime.remainingLiquidity -= payout
        runtime.remainingMaturityPool -= payout * runtime.config.liquidationPenalty
        runtime.eventLog.unshift(
          payout > 0
            ? `${request.player.name} withdrew on day ${day} and received $${payout}`
            : `${request.player.name} tried to withdraw on day ${day} but bank had no liquidity left`,
        )
      }

      runtime.eventLog = runtime.eventLog.slice(0, 40)

      if (day >= runtime.config.totalDays) {
        const waiters = runtime.players.filter((player) => player.withdrawnDay === null)
        if (waiters.length > 0) {
          const maxPool = Math.max(0, runtime.remainingMaturityPool)
          const perWaiter = Math.min(runtime.config.maturityPayout, Math.floor(maxPool / waiters.length))
          for (const waiter of waiters) {
            waiter.finalPayout = perWaiter
          }
          runtime.remainingMaturityPool = Math.max(0, runtime.remainingMaturityPool - perWaiter * waiters.length)
          runtime.eventLog.unshift(`Final settlement: waiters received $${perWaiter} each`)
        } else {
          runtime.eventLog.unshift('Final settlement: no waiting depositors remained')
        }
        runtime.phase = 'results'
      } else {
        runtime.currentDay += 1
        runtime.eventLog.unshift(`Day ${day} closed. Moving to day ${runtime.currentDay}`)
      }

      const updatedConfig: SessionConfigPayload = { ...configObj, bankRunRuntime: runtime }
      await tx.miniGameSession.update({
        where: { id: session.id },
        data: {
          status: toSessionStatus(runtime.phase),
          configJson: updatedConfig as Prisma.InputJsonValue,
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

    console.error('Failed to advance bank run game:', error)
    return res.status(500).json({ success: false, error: 'Failed to advance game' })
  }
})

router.post('/bank-run/:roomCode/reset', async (req, res) => {
  const roomCode = String(req.params.roomCode || '').trim().toUpperCase()
  const body = req.body as { hostToken?: string }

  try {
    const runtime = await prisma.$transaction(async (tx) => {
      const session = await tx.miniGameSession.findFirst({
        where: { roomCode, gameType: MiniGameType.BANK_RUN },
      })
      if (!session) throw new Error('ROOM_NOT_FOUND')
      if (!session.hostToken || body?.hostToken !== session.hostToken) throw new Error('INVALID_HOST')

      const configObj = asConfigObject(session.configJson)
      const currentRuntime = normalizeRuntime(configObj.bankRunRuntime, configObj)
      const resetRuntime: BankRunRuntimeState = {
        ...currentRuntime,
        phase: 'lobby',
        currentDay: 1,
        actionsByDay: {},
        remainingLiquidity: 0,
        remainingMaturityPool: 0,
        players: currentRuntime.players.map((player) => ({
          ...player,
          withdrawnDay: null,
          earlyPayout: 0,
          finalPayout: 0,
        })),
        eventLog: ['Game reset to lobby', ...currentRuntime.eventLog].slice(0, 40),
      }

      const updatedConfig: SessionConfigPayload = { ...configObj, bankRunRuntime: resetRuntime }
      await tx.miniGameSession.update({
        where: { id: session.id },
        data: {
          status: MiniGameSessionStatus.LOBBY,
          configJson: updatedConfig as Prisma.InputJsonValue,
        },
      })

      return resetRuntime
    })

    return res.json({ success: true, session: toPublicSession(roomCode, runtime) })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'RESET_FAILED'
    if (message === 'ROOM_NOT_FOUND') return res.status(404).json({ success: false, error: 'Room not found' })
    if (message === 'INVALID_HOST') return res.status(401).json({ success: false, error: 'Invalid host token' })

    console.error('Failed to reset bank run game:', error)
    return res.status(500).json({ success: false, error: 'Failed to reset game' })
  }
})

export default router
