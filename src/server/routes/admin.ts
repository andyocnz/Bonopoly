/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { Router } from 'express'
import { Prisma } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { getSessionCookie, getSession } from '../sessionStore'
import prisma from '../db'
import { calculateRound, calculateRoundMinus1, calculateUnitCost, getEffectiveTaxRate, createInitialGameState, getBalancedStartingFinancials, SCENARIOS, type TeamGameState } from '../../engine/gameEngine'
import {
  generateInitialAIDecision,
  generateAIDecision as generateSmartAIDecision,
  type AIProfile,
} from '../../engine/aiEngine'
import {
  transformDecisionFromDb,
  transformGameStateFromDb,
  transformGameStateFromResults,
  getDefaultDecisions,
  getDefaultDecisionForDb,
  calculateRank,
  generateAIDecisionForDb,
} from '../../utils/mappings'
import type { TeamDecisions as EngineDecisions } from '../../components/DecisionSimulator'
import { getDefaultGameState } from '../utils'
import { resolveGameConfig } from '../utils/configResolver'
import { getTransferSummary } from '../transferMetrics'
import { invalidateResultsCache } from '../cache/resultsCache'

const router = Router()

function isMissingMiniGameTables(error: unknown): boolean {
  const candidate = error as { code?: string; meta?: { table?: string; modelName?: string } }
  if (candidate?.code !== 'P2021') return false
  const table = candidate?.meta?.table || ''
  const modelName = candidate?.meta?.modelName || ''
  return table.includes('MiniGameSession') || table.includes('MiniGameInvite') || modelName.includes('MiniGame')
}

router.get('/transfer-summary', async (req, res) => {
  try {
    const sessionId = getSessionCookie(req, 'admin')
    const session = getSession(sessionId)
    if (!session || session.role !== 'admin') {
      return res.status(401).json({ success: false, error: 'Unauthorized' })
    }

    const summary = getTransferSummary()
    res.json({ success: true, summary })
  } catch (error) {
    console.error('Error fetching transfer summary:', error)
    res.status(500).json({ success: false, error: 'Failed to fetch transfer summary' })
  }
})

// Create a new admin (requires existing admin auth)
router.post('/users', async (req, res) => {
  try {
    const sessionId = getSessionCookie(req, 'admin')
    const session = getSession(sessionId)
    if (!session || session.role !== 'admin') {
      return res.status(401).json({ success: false, error: 'Unauthorized' })
    }

    const { username, password } = req.body
    if (!username || !password) {
      return res.status(400).json({ success: false, error: 'Username and password required' })
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    const admin = await prisma.admin.create({
      data: {
        username,
        password: hashedPassword,
      },
    })

    res.json({ success: true, admin: { id: admin.id, username: admin.username } })
  } catch (error) {
    console.error('Error creating admin:', error)
    res.status(500).json({ success: false, error: 'Failed to create admin' })
  }
})

// List all admins
router.get('/users', async (req, res) => {
  try {
    const sessionId = getSessionCookie(req, 'admin')
    const session = getSession(sessionId)
    if (!session || session.role !== 'admin') {
      return res.status(401).json({ success: false, error: 'Unauthorized' })
    }

    const admins = await prisma.admin.findMany({
      select: { id: true, username: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    })

    res.json({ success: true, admins })
  } catch (error) {
    console.error('Error listing admins:', error)
    res.status(500).json({ success: false, error: 'Failed to list admins' })
  }
})

// Delete admin
router.delete('/users/:id', async (req, res) => {
  try {
    const sessionId = getSessionCookie(req, 'admin')
    const session = getSession(sessionId)
    if (!session || session.role !== 'admin') {
      return res.status(401).json({ success: false, error: 'Unauthorized' })
    }

    const { id } = req.params
    // Prevent self-deletion if wanted, but simpler to allow for now unless single admin
    // Optional: Check if at least one admin remains?
    // For now, simple delete.

    await prisma.admin.delete({ where: { id } })
    res.json({ success: true })
  } catch (error) {
    console.error('Error deleting admin:', error)
    res.status(500).json({ success: false, error: 'Failed to delete admin' })
  }
})


// Change current admin password
router.post('/password', async (req, res) => {
  try {
    const sessionId = getSessionCookie(req, 'admin')
    const session = getSession(sessionId)
    if (!session || session.role !== 'admin') {
      return res.status(401).json({ success: false, error: 'Unauthorized' })
    }

    const { password } = req.body
    if (!password) {
      return res.status(400).json({ success: false, error: 'Password required' })
    }

    // Since we don't store admin ID in session currently (fallback mode vs db mode),
    // we need to handle this carefully.
    // If it's a fallback session, we can't really change password in DB easily unless we ask for username.
    // But for now let's assume if they are logged in via DB, we might want to store their ID in session?
    // Actually, let's update auth.ts to store adminId in session if possible, OR
    // for this v1, checking if there is only 1 admin or just update the one matching the current user?
    // Wait, the session store is simple.
    // Let's rely on the client sending the username OR just update the password for the 'admin' user if it exists?
    // BETTER: The requirement is "change admin password".
    // Let's assume the user knows their username.
    // Actually, `auth.ts` doesn't store username in session.
    // I entered a rabbit hole.
    // SIMPLIFICATION: If DB auth is used, we can find the admin by some means.
    // BUT, since we just added the feature, let's allow changing password for a provided username?
    // NO, that's insecure if I can change others' passwords.
    // Let's just implement "Create Admin" first which covers the "add options to create new admin".
    // For "change admin password", I will implement it such that you change the password for a target username,
    // which effectively is "Reset Password" since you are an admin.
    // So let's add `username` to the body.

    // WAIT, strict requirement: "change admin password".
    // I will implement "Change Password" as "Change MY password" or "Reset ANY password".
    // Given I am an admin, I can reset anyone's password.
    // So I will expect { username, password } to update that user.

    // RETHINK: The prompts says "create new admin and change admin password".
    // It's likely intended to be able to reset/change credentials.

    // Let's support updating a specific user's password.
    // If username not provided, try 'admin' as default? Or fail?
    // Safe route: require username.

    // Actually, looking at `implementation_plan`, I said `/admins/password`.
    // Let's stick to update by username.

    const hashedPassword = await bcrypt.hash(password, 10)

    // We update the user with the given username (or 'admin' default if we want to support the legacy feel, but let's be strict).
    // If the user body has username, use it.

    // Let's check if username is passed.
    const usernameToUpdate = req.body.username
    if (!usernameToUpdate) {
      // If no username, maybe we can't proceed safely without session info.
      // But maybe the user meant "Change the password of the 'admin' user".
      // Let's require username to be safe.
      return res.status(400).json({ success: false, error: 'Target username required' })
    }

    await prisma.admin.update({
      where: { username: usernameToUpdate },
      data: { password: hashedPassword }
    })

    res.json({ success: true })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return res.status(404).json({ success: false, error: 'Admin user not found' })
    }
    console.error('Error changing password:', error)
    res.status(500).json({ success: false, error: 'Failed' })
  }
})

// --- Educator Management ---

// Create new educator
router.post('/educators', async (req, res) => {
  try {
    const sessionId = getSessionCookie(req, 'admin')
    const session = getSession(sessionId)
    if (!session || session.role !== 'admin') {
      return res.status(401).json({ success: false, error: 'Unauthorized' })
    }

    const { email, pin, credits } = req.body
    if (!email || !pin) {
      return res.status(400).json({ success: false, error: 'Email and PIN required' })
    }

    const educator = await prisma.educator.create({
      data: {
        email: email.toLowerCase(),
        pin,
        credits: credits ?? 0,
      },
    })

    if ((credits ?? 0) > 0) {
      const adminUser = session.adminUsername || 'admin'
      await prisma.creditTransaction.create({
        data: {
          educatorId: educator.id,
          amount: credits,
          balanceAfter: credits,
          type: 'INITIAL_GRANT',
          description: 'Initial credits on account creation',
          adminUser,
        }
      })
    }

    res.json({ success: true, educator })
  } catch (error) {
    console.error('Error creating educator:', error)
    res.status(500).json({ success: false, error: 'Failed' })
  }
})

// List educators
router.get('/educators', async (req, res) => {
  try {
    const sessionId = getSessionCookie(req, 'admin')
    const session = getSession(sessionId)
    if (!session || session.role !== 'admin') {
      return res.status(401).json({ success: false, error: 'Unauthorized' })
    }

    const educators = await prisma.educator.findMany({
      orderBy: { createdAt: 'desc' },
    })

    res.json({ success: true, educators })
  } catch (error) {
    console.error('Error listing educators:', error)
    res.status(500).json({ success: false, error: 'Failed' })
  }
})

// Delete educator
router.delete('/educators/:id', async (req, res) => {
  try {
    const sessionId = getSessionCookie(req, 'admin')
    const session = getSession(sessionId)
    if (!session || session.role !== 'admin') {
      return res.status(401).json({ success: false, error: 'Unauthorized' })
    }

    const { id } = req.params
    await prisma.educator.delete({ where: { id } })

    res.json({ success: true })
  } catch (error) {
    console.error('Error deleting educator:', error)
    res.status(500).json({ success: false, error: 'Failed' })
  }
})

// Update educator credits
router.put('/educators/:id/credits', async (req, res) => {
  try {
    const sessionId = getSessionCookie(req, 'admin')
    const session = getSession(sessionId)
    if (!session || session.role !== 'admin') {
      return res.status(401).json({ success: false, error: 'Unauthorized' })
    }

    const { id } = req.params
    const { amount, mode } = req.body // mode: 'add' | 'set'

    const educator = await prisma.educator.findUnique({ where: { id } })
    if (!educator) return res.status(404).json({ success: false, error: 'Educator not found' })

    let newCredits = educator.credits
    if (mode === 'set') {
      newCredits = amount
    } else {
      newCredits += amount
    }

    const updated = await prisma.educator.update({
      where: { id },
      data: { credits: newCredits },
    })

    const adminUser = session.adminUsername || 'admin'
    await prisma.creditTransaction.create({
      data: {
        educatorId: id,
        amount: mode === 'set' ? (newCredits - educator.credits) : amount,
        balanceAfter: newCredits,
        type: mode === 'add' ? 'ADD' : 'SET',
        description: `Credit ${mode} operation`,
        adminUser,
      }
    })

    res.json({ success: true, educator: updated })
  } catch (error) {
    console.error('Error updating credits:', error)
    res.status(500).json({ success: false, error: 'Failed' })
  }
})

// Get educator transactions
router.get('/educators/:id/transactions', async (req, res) => {
  try {
    const sessionId = getSessionCookie(req, 'admin')
    const session = getSession(sessionId)
    if (!session || session.role !== 'admin') {
      return res.status(401).json({ success: false, error: 'Unauthorized' })
    }

    const { id } = req.params
    const transactions = await prisma.creditTransaction.findMany({
      where: { educatorId: id },
      orderBy: { createdAt: 'desc' },
    })

    res.json({ success: true, transactions })
  } catch (error) {
    console.error('Error fetching transactions:', error)
    res.status(500).json({ success: false, error: 'Failed' })
  }
})

// Update educator PIN
router.put('/educators/:id/pin', async (req, res) => {
  try {
    const sessionId = getSessionCookie(req, 'admin')
    const session = getSession(sessionId)
    if (!session || session.role !== 'admin') {
      return res.status(401).json({ success: false, error: 'Unauthorized' })
    }

    const { id } = req.params
    const { pin } = req.body

    const updated = await prisma.educator.update({
      where: { id },
      data: { pin },
    })

    res.json({ success: true, educator: updated })
  } catch (error) {
    console.error('Error updating PIN:', error)
    res.status(500).json({ success: false, error: 'Failed' })
  }
})


// List all games with team codes (admin view)
router.get('/games', async (req, res) => {
  try {
    const includeArchived = String(req.query.includeArchived || '').toLowerCase() === 'true'
    const includeCounts = String(req.query.includeCounts || '').toLowerCase() === 'true'
    const activeFilter = { status: { notIn: ['ARCHIVED', 'COMPLETED'] as unknown[] } }
    const games = await prisma.game.findMany({
      ...(includeArchived
        ? {}
        : {
          where: activeFilter,
        }),
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        gameCode: true,
        gamePin: true,
        name: true,
        status: true,
        companyName: true,
        industry: true,
        totalRounds: true,
        hoursPerRound: true,
        currentRound: true,
        scenarioSequence: true,
        createdAt: true,
        marketDemandMode: true,
        marketDemandMultiplier: true,
        capacityPerFactory: true,
        regionDemandSplit: true,
        timezone: true,
        regionLabels: true,
        educators: {
          select: {
            educator: {
              select: {
                email: true,
              },
            },
          },
        },
        teams: {
          orderBy: { displayOrder: 'asc' },
          select: {
            id: true,
            name: true,
            teamCode: true,
            teamPin: true,
            isComputer: true,
            color: true,
          },
        },
      },
    })
    const gamesWithStatus = await Promise.all(
      games.map(async (game) => {
        const humanTeams = game.teams.filter((team) => !team.isComputer)
        const decisions = humanTeams.length > 0
          ? await prisma.decision.findMany({
            where: {
              teamId: { in: humanTeams.map((team) => team.id) },
              roundNumber: game.currentRound,
            },
            select: { teamId: true, isSubmitted: true },
          })
          : []
        const submittedTeamIds = new Set(decisions.filter((d) => d.isSubmitted).map((d) => d.teamId))
        const submittedHumans = humanTeams.filter((team) => submittedTeamIds.has(team.id)).length
        const pendingHumans = Math.max(0, humanTeams.length - submittedHumans)
        return {
          ...game,
          decisionStatus: {
            totalHumans: humanTeams.length,
            submittedHumans,
            pendingHumans,
            allHumanSubmitted: pendingHumans === 0,
          },
        }
      })
    )

    if (includeCounts) {
      const [activeCount, archivedCount] = await Promise.all([
        prisma.game.count({ where: activeFilter as Prisma.GameWhereInput }),
        prisma.game.count({ where: { status: { in: ['ARCHIVED', 'COMPLETED'] as unknown[] } } }),
      ])
      return res.json({ success: true, games: gamesWithStatus, counts: { active: activeCount, archived: archivedCount } })
    }

    res.json({ success: true, games: gamesWithStatus })
  } catch (error) {
    console.error('Error fetching admin games:', error)
    res.status(500).json({ success: false, error: 'Failed to fetch games' })
  }
})

router.get('/games/insights', async (req, res) => {
  try {
    const includeAllMiniSessions = String(req.query.includeAllMiniSessions ?? '').toLowerCase() === 'true'
    const [rows, miniGameSessions, miniGamesByTypeRaw, miniGameSessionsTotal] = await Promise.all([
      prisma.game.findMany({
        select: {
          createdAt: true,
          status: true,
        },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.miniGameSession.findMany({
        select: {
          id: true,
          gameType: true,
          title: true,
          status: true,
          teamCount: true,
          roomCode: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        ...(includeAllMiniSessions ? {} : { take: 5 }),
      }).catch((error) => {
        if (isMissingMiniGameTables(error)) return []
        throw error
      }),
      prisma.miniGameSession.groupBy({
        by: ['gameType'],
        _count: { _all: true },
      }).catch((error) => {
        if (isMissingMiniGameTables(error)) return []
        throw error
      }),
      prisma.miniGameSession.count().catch((error) => {
        if (isMissingMiniGameTables(error)) return 0
        throw error
      }),
    ])

    const dayMap = new Map<string, { active: number; archived: number }>()
    rows.forEach((game) => {
      const dateKey = game.createdAt.toISOString().slice(0, 10)
      const bucket = dayMap.get(dateKey) ?? { active: 0, archived: 0 }
      if (game.status === 'ARCHIVED' || game.status === 'COMPLETED') {
        bucket.archived += 1
      } else {
        bucket.active += 1
      }
      dayMap.set(dateKey, bucket)
    })
    const byDay = Array.from(dayMap.entries()).map(([date, counts]) => ({
      date,
      active: counts.active,
      archived: counts.archived,
    }))

    const miniGamesByType = miniGamesByTypeRaw
      .map((row) => ({
        gameType: row.gameType,
        count: row._count._all,
      }))
      .sort((a, b) => b.count - a.count)

    res.json({
      success: true,
      byDay,
      miniGames: {
        sessions: miniGameSessions,
        totalSessions: miniGameSessionsTotal,
        includesAll: includeAllMiniSessions,
        hasMore: miniGameSessionsTotal > miniGameSessions.length,
        byType: miniGamesByType,
      },
    })
  } catch (error) {
    console.error('Error fetching admin insights:', error)
    res.status(500).json({ success: false, error: 'Failed to fetch insights' })
  }
})

// Fetch full results for audit (admin view)
router.get('/games/:gameId/results', async (req, res) => {
  try {
    const { gameId } = req.params
    const results = await prisma.teamRoundResult.findMany({
      where: { gameId },
      orderBy: { roundNumber: 'asc' },
      include: {
        team: {
          select: {
            id: true,
            name: true,
            teamCode: true,
            teamPin: true,
          },
        },
      },
    })

    res.json({ success: true, results })
  } catch (error) {
    console.error('Error fetching admin audit results:', error)
    res.status(500).json({ success: false, error: 'Failed to fetch audit results' })
  }
})

// Data consistency checks across games/rounds (admin view)
router.get('/games/consistency', async (req, res) => {
  try {
    const gameId = typeof req.query.gameId === 'string' ? req.query.gameId : null
    const games = await prisma.game.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        teams: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    const scopedGames = gameId ? games.filter((game) => game.id === gameId) : games
    const gameById = new Map(scopedGames.map((game) => [game.id, game]))
    const teamIds = scopedGames.flatMap((game) => game.teams.map((team) => team.id))

    if (teamIds.length === 0) {
      return res.json({ success: true, generatedAt: new Date().toISOString(), summary: [], issues: [] })
    }

    const results = await prisma.teamRoundResult.findMany({
      where: {
        gameId: { in: scopedGames.map((g) => g.id) },
        roundNumber: { gte: -1 },
      },
      orderBy: [{ gameId: 'asc' }, { roundNumber: 'asc' }],
      include: {
        team: {
          select: { id: true, name: true },
        },
      },
    })

    const gameStates = await prisma.gameState.findMany({
      where: {
        teamId: { in: teamIds },
      },
      select: {
        teamId: true,
        roundNumber: true,
        factoriesUS: true,
        factoriesAsia: true,
        pendingInvestments: true,
        unlockedTechLevel: true,
        unlockedFeatures: true,
        cumulativeResearchHours: true,
        brandReputation: true,
        inventory: true,
        inventoryUS: true,
        inventoryAsia: true,
        cashBalance: true,
        longTermDebt: true,
        shareCapital: true,
        retainedEarnings: true,
        taxLossCarryforward: true,
      },
    })

    const stateByKey = new Map<string, typeof gameStates[number]>()
    gameStates.forEach((state) => {
      stateByKey.set(`${state.teamId}:${state.roundNumber}`, state)
    })

    const resultByKey = new Map<string, typeof results[number]>()
    results.forEach((row) => {
      resultByKey.set(`${row.teamId}:${row.roundNumber}`, row)
    })

    const issues: Array<{
      gameId: string
      gameName: string
      roundNumber: number
      teamId?: string
      teamName?: string
      check: string
      severity: 'warning' | 'error'
      message: string
      baselineRoundMinus1State?: unknown
    }> = []

    const summaryByKey = new Map<string, {
      gameId: string
      gameName: string
      gameCreatedAt?: Date | null
      roundNumber: number
      totalTeams: number
      issueCount: number
    }>()

    const salesTotalsByGameRound = new Map<string, number>()
    const marketDemandByGameRound = new Map<string, number>()

    const toNumber = (value: unknown, fallback = 0) => (typeof value === 'number' && Number.isFinite(value) ? value : fallback)
    const nearlyEqual = (a: number, b: number, tolerance: number) => Math.abs(a - b) <= tolerance

    const ensureSummary = (gameId: string, roundNumber: number) => {
      const key = `${gameId}:${roundNumber}`
      if (!summaryByKey.has(key)) {
        const game = gameById.get(gameId)
        summaryByKey.set(key, {
          gameId,
          gameName: game?.name ?? 'Unknown Game',
          gameCreatedAt: game?.createdAt ?? null,
          roundNumber,
          totalTeams: game?.teams.length ?? 0,
          issueCount: 0,
        })
      }
    }

    const addIssue = (
      gameId: string,
      roundNumber: number,
      check: string,
      message: string,
      severity: 'warning' | 'error' = 'warning',
      team?: { id: string; name: string }
    ) => {
      const game = gameById.get(gameId)
      const baselineRoundMinus1State = team ? (resultByKey.get(`${team.id}:-1`)?.fullResults as Record<string, unknown>)?.gameState ?? null : null
      issues.push({
        gameId,
        gameName: game?.name ?? 'Unknown Game',
        roundNumber,
        teamId: team?.id,
        teamName: team?.name,
        check,
        severity,
        message,
        baselineRoundMinus1State,
      })
      const key = `${gameId}:${roundNumber}`
      const summary = summaryByKey.get(key)
      if (summary) {
        summary.issueCount += 1
      }
    }

    for (const row of results) {
      if (row.roundNumber < 0) continue
      const gameId = row.gameId
      const roundNumber = row.roundNumber
      const team = row.team
      const fullResults = (row.fullResults ?? {}) as Record<string, unknown>
      ensureSummary(gameId, roundNumber)

      const baselineRound = roundNumber <= 1 ? -1 : roundNumber - 1
      const prevResult = resultByKey.get(`${row.teamId}:${baselineRound}`)

      const fullGameState = fullResults.gameState ?? {}
      const fullBalanceSheet = fullResults.balanceSheet ?? {}

      const fullInventory = toNumber(fullGameState.inventoryUS, 0) + toNumber(fullGameState.inventoryAsia, 0)
      const fullInventoryTotal = fullInventory > 0 ? fullInventory : toNumber(fullGameState.inventory, 0)

      if (!fullResults.gameState) {
        addIssue(gameId, roundNumber, 'Results GameState', 'Missing fullResults.gameState for this round.', 'error', team)
      }

      if (fullResults.balanceSheet) {
        if (fullBalanceSheet.totalAssets !== undefined && fullBalanceSheet.totalLiabilities !== undefined && fullBalanceSheet.totalEquity !== undefined) {
          const totalAssets = toNumber(fullBalanceSheet.totalAssets)
          const totalLiabilities = toNumber(fullBalanceSheet.totalLiabilities)
          const totalEquity = toNumber(fullBalanceSheet.totalEquity)
          if (!nearlyEqual(totalAssets, totalLiabilities + totalEquity, 1)) {
            addIssue(
              gameId,
              roundNumber,
              'Balance Sheet',
              `Balance sheet does not balance (assets ${totalAssets}, liabilities + equity ${totalLiabilities + totalEquity}).`,
              'error',
              team
            )
          }
        }
      } else {
        addIssue(gameId, roundNumber, 'Balance Sheet', 'Missing fullResults.balanceSheet for this round.', 'error', team)
      }

      const salesUnits = {
        us: toNumber(fullResults.sales?.us?.units),
        asia: toNumber(fullResults.sales?.asia?.units),
        europe: toNumber(fullResults.sales?.europe?.units),
      }
      const salesTotal = salesUnits.us + salesUnits.asia + salesUnits.europe
      const salesKey = `${gameId}:${roundNumber}`
      salesTotalsByGameRound.set(salesKey, (salesTotalsByGameRound.get(salesKey) ?? 0) + salesTotal)

      const demandTotal = toNumber(fullResults.marketDemand?.total, toNumber(fullResults.marketDemand?.us) + toNumber(fullResults.marketDemand?.asia) + toNumber(fullResults.marketDemand?.europe))
      if (demandTotal > 0 && !marketDemandByGameRound.has(salesKey)) {
        marketDemandByGameRound.set(salesKey, demandTotal)
      }

      const productionUnits = toNumber(
        fullResults.productionUnits,
        toNumber(fullResults.production?.totalUnits, toNumber(fullResults.production?.usFactoryUnits) + toNumber(fullResults.production?.asiaFactoryUnits) + toNumber(fullResults.production?.outsourceUS) + toNumber(fullResults.production?.outsourceAsia))
      )

      const prevGameState = (prevResult?.fullResults as Record<string, unknown>)?.gameState ?? null
      const prevInventoryRegional = toNumber(prevGameState?.inventoryUS, 0) + toNumber(prevGameState?.inventoryAsia, 0)
      const prevInventoryTotal = prevInventoryRegional > 0 ? prevInventoryRegional : toNumber(prevGameState?.inventory, 0)
      const startInventory = prevGameState
        ? prevInventoryTotal
        : toNumber(fullResults.audit?.trace?.inventory?.startingUnits, 0)

      if (productionUnits > 0 || startInventory > 0) {
        const availableUnits = productionUnits + startInventory
        if (salesTotal > availableUnits + 1) {
          addIssue(
            gameId,
            roundNumber,
            'Sales vs Supply',
            `Sold ${salesTotal} units but only ${availableUnits} available (start ${startInventory}, produced ${productionUnits}).`,
            'error',
            team
          )
        }

        const expectedEndingInventory = availableUnits - salesTotal
        if (!nearlyEqual(fullInventoryTotal, expectedEndingInventory, 1)) {
          addIssue(
            gameId,
            roundNumber,
            'Inventory Flow',
            `Ending inventory ${fullInventoryTotal} does not match expected ${expectedEndingInventory} (start ${startInventory}, produced ${productionUnits}, sold ${salesTotal}).`,
            'warning',
            team
          )
        }
      }

      if (prevResult && fullResults.decisions) {
        const prevBalanceSheet = (prevResult.fullResults as Record<string, unknown>)?.balanceSheet ?? {}
        const finance = fullResults.decisions?.finance ?? {}
        const shareIssuance = toNumber(
          finance.shareIssuance,
          toNumber(finance.shareIssue) - toNumber(finance.shareBuyback)
        )
        if (shareIssuance !== 0) {
          const expectedShareCapital = toNumber(prevBalanceSheet.shareCapital) + shareIssuance
          if (!nearlyEqual(toNumber(fullBalanceSheet.shareCapital), expectedShareCapital, 1)) {
            addIssue(
              gameId,
              roundNumber,
              'Share Issuance',
              `Share capital ${fullBalanceSheet.shareCapital} does not match expected ${expectedShareCapital} after issuance ${shareIssuance}.`,
              'warning',
              team
            )
          }
        }
      }

      if (roundNumber > 0 && fullResults.decisions) {
        const decisions = fullResults.decisions ?? {}
        const investment = decisions.investment ?? {}
        const finance = decisions.finance ?? {}
        const newPlantsUS = toNumber(investment.newPlantsUS, toNumber(finance.newPlantsUS))
        const newPlantsAsia = toNumber(investment.newPlantsAsia, toNumber(finance.newPlantsAsia))
        if (newPlantsUS > 0 || newPlantsAsia > 0) {
          const game = gameById.get(gameId)
          const gameConfig = resolveGameConfig(game)
          const lagRounds = gameConfig.investment.lagRounds ?? 1
          const targetRound = roundNumber + lagRounds
          if (game?.totalRounds !== undefined && targetRound > game.totalRounds) {
            continue
          }
          const targetBaselineRound = targetRound <= 1 ? -1 : targetRound - 1
          const targetResult = resultByKey.get(`${row.teamId}:${targetRound}`)
          const targetGameState = (targetResult?.fullResults as Record<string, unknown>)?.gameState ?? null
          const baseResult = resultByKey.get(`${row.teamId}:${targetBaselineRound}`) ?? row
          const baseGameState = ((baseResult.fullResults as Record<string, unknown>)?.gameState ?? fullGameState) as Record<string, unknown>

          if (!targetGameState) {
            addIssue(
              gameId,
              roundNumber,
              'Factory Availability',
              `Missing fullResults.gameState for round ${targetRound} to confirm factory availability after investment.`,
              'warning',
              team
            )
          } else {
            if (newPlantsUS > 0) {
              const expectedFactoriesUS = toNumber(baseGameState.factories?.us) + newPlantsUS
              if (toNumber(targetGameState.factories?.us) < expectedFactoriesUS) {
                addIssue(
                  gameId,
                  roundNumber,
                  'Factory Availability',
                  `US factories in round ${targetRound} (${toNumber(targetGameState.factories?.us)}) less than expected ${expectedFactoriesUS} after investment.`,
                  'warning',
                  team
                )
              }
            }
            if (newPlantsAsia > 0) {
              const expectedFactoriesAsia = toNumber(baseGameState.factories?.asia) + newPlantsAsia
              if (toNumber(targetGameState.factories?.asia) < expectedFactoriesAsia) {
                addIssue(
                  gameId,
                  roundNumber,
                  'Factory Availability',
                  `Asia factories in round ${targetRound} (${toNumber(targetGameState.factories?.asia)}) less than expected ${expectedFactoriesAsia} after investment.`,
                  'warning',
                  team
                )
              }
            }
          }
        }
      }

      const prevCumulative = toNumber((prevResult?.fullResults as Record<string, unknown>)?.gameState?.cumulativeProduction, 0)
      const currentCumulative = toNumber(fullResults.gameState?.cumulativeProduction, 0)
      if (productionUnits > 0 && currentCumulative > 0) {
        const expectedCumulative = prevCumulative + productionUnits
        if (!nearlyEqual(currentCumulative, expectedCumulative, 1)) {
          addIssue(
            gameId,
            roundNumber,
            'Cumulative Production',
            `Cumulative production ${currentCumulative} does not match expected ${expectedCumulative}.`,
            'warning',
            team
          )
        }
      }
    }

    salesTotalsByGameRound.forEach((totalSold, key) => {
      const demandTotal = marketDemandByGameRound.get(key)
      if (demandTotal !== undefined && totalSold > demandTotal + 1) {
        const [gameId, roundValue] = key.split(':')
        const roundNumber = Number(roundValue)
        addIssue(
          gameId,
          roundNumber,
          'Market Demand',
          `Total sales ${totalSold} exceed market demand ${demandTotal}.`,
          'error'
        )
      }
    })

    const summary = Array.from(summaryByKey.values()).sort((a, b) => {
      const aTime = a.gameCreatedAt ? new Date(a.gameCreatedAt).getTime() : 0
      const bTime = b.gameCreatedAt ? new Date(b.gameCreatedAt).getTime() : 0
      if (aTime !== bTime) return bTime - aTime
      return a.roundNumber - b.roundNumber
    })

    const rawRounds = scopedGames.map((game) => {
      const roundNumbers = Array.from(
        new Set(
          results
            .filter((row) => row.gameId === game.id && row.roundNumber >= 0)
            .map((row) => row.roundNumber)
        )
      ).sort((a, b) => a - b)
      return {
        gameId: game.id,
        rounds: roundNumbers.map((roundNumber) => ({
          roundNumber,
          teams: game.teams.map((team) => ({
            teamId: team.id,
            teamName: team.name,
            roundMinus1: {
              gameState: stateByKey.get(`${team.id}:-1`) ?? null,
              teamRoundResult: resultByKey.get(`${team.id}:-1`) ?? null,
            },
            roundData: {
              gameState: stateByKey.get(`${team.id}:${roundNumber}`) ?? null,
              teamRoundResult: resultByKey.get(`${team.id}:${roundNumber}`) ?? null,
            },
          })),
        })),
      }
    })

    res.json({
      success: true,
      generatedAt: new Date().toISOString(),
      summary: summary.map((row) => ({
        ...row,
        gameCreatedAt: row.gameCreatedAt ? row.gameCreatedAt.toISOString() : null,
      })),
      issues,
      rawRounds,
    })
  } catch (error) {
    console.error('Error running consistency checks:', error)
    res.status(500).json({ success: false, error: 'Failed to run consistency checks' })
  }
})

// Get all team decisions for a specific round (admin view)
router.get('/games/:gameId/decisions/:roundNumber', async (req, res) => {
  try {
    const { gameId, roundNumber } = req.params
    const round = parseInt(roundNumber, 10)

    if (Number.isNaN(round)) {
      return res.status(400).json({ success: false, error: 'Invalid round number' })
    }

    const game = await prisma.game.findUnique({
      where: { id: gameId },
      include: {
        teams: {
          orderBy: { displayOrder: 'asc' },
          include: {
            decisions: {
              where: { roundNumber: round },
            },
          },
        },
      },
    })

    if (!game) {
      return res.status(404).json({ success: false, error: 'Game not found' })
    }

    const decisions = game.teams.map((team) => {
      const decision = team.decisions[0]
      return {
        teamId: team.id,
        teamName: team.name,
        roundNumber: round,
        isSubmitted: decision?.isSubmitted ?? false,
        submittedAt: decision?.submittedAt ?? null,
        production: decision?.production ?? null,
        hr: decision?.hr ?? null,
        rnd: decision?.rnd ?? null,
        investment: decision?.investment ?? null,
        logistics: decision?.logistics ?? null,
        marketing: decision?.marketing ?? null,
        finance: decision?.finance ?? null,
      }
    })

    res.json({ success: true, decisions })
  } catch (error) {
    console.error('Error fetching round decisions:', error)
    res.status(500).json({ success: false, error: 'Failed to fetch round decisions' })
  }
})


// Force recalculation for a specific round (admin view)
router.post('/games/:gameId/recalculate/:roundNumber', async (req, res) => {
  try {
    const { gameId, roundNumber } = req.params
    const round = parseInt(roundNumber, 10)

    if (Number.isNaN(round) || round < -1) {
      return res.status(400).json({ success: false, error: 'Invalid round number' })
    }

    // Handle round -1 (starting position reset)
    if (round === -1) {
      const game = await prisma.game.findUnique({
        where: { id: gameId },
        include: { teams: true },
      })

      if (!game) {
        return res.status(404).json({ success: false, error: 'Game not found' })
      }

      const gameConfig = resolveGameConfig(game)
      const defaultState = getDefaultGameState(gameConfig)

      // Reset all teams' round -1 game state to fresh defaults
      await prisma.$transaction(async (tx) => {
        for (const team of game.teams) {
          await tx.gameState.upsert({
            where: {
              teamId_roundNumber: {
                teamId: team.id,
                roundNumber: -1,
              },
            },
            update: {
              ...defaultState,
              factoriesUS: game.startingFactoriesUS,
              factoriesAsia: game.startingFactoriesAsia,
              cashBalance: game.startingCash,
            },
            create: {
              teamId: team.id,
              roundNumber: -1,
              ...defaultState,
              factoriesUS: game.startingFactoriesUS,
              factoriesAsia: game.startingFactoriesAsia,
              cashBalance: game.startingCash,
            },
          })
        }
      })

      const roundMinus1Results = calculateRoundMinus1(
        game.teams.length,
        gameConfig,
        game.scenarioSequence ?? [0],
        game.marketDemandMultiplier ?? 1,
        game.regionDemandSplit as { us: number; asia: number; europe: number } | undefined
      )
      const roundMinus1Effects = {
        priceElasticityModifier: 1,
        csrImportanceModifier: 1,
        marketingEffectModifier: 1,
        costInflation: 1,
        investmentCostMultiplier: 1,
        interestRateSpread: 0,
        taxRateDeltaByRegion: { us: 0, asia: 0, europe: 0 },
        workingCapitalDelta: { inventory: 0, receivable: 0, payable: 0 },
        demandGrowthModifier: { us: 0, asia: 0, europe: 0 },
      }
      const roundMinus1InterestRate = Math.max(0, gameConfig.financial.interestRate + (roundMinus1Effects.interestRateSpread ?? 0))
      const startingSharePrice = gameConfig.financial.startingSharePrice
      await prisma.$transaction(async (tx) => {
        for (let i = 0; i < roundMinus1Results.teams.length; i++) {
          const teamResult = roundMinus1Results.teams[i]
          const dbTeam = game.teams[i]
          const adjustedKpis = {
            ...teamResult.kpis,
            sharePrice: startingSharePrice,
            tsr: 0,
            sharePriceTrace: teamResult.kpis.sharePriceTrace
              ? {
                ...teamResult.kpis.sharePriceTrace,
                basePrice: startingSharePrice,
                prevSharePrice: startingSharePrice,
                finalSharePrice: startingSharePrice,
              }
              : undefined,
          }
          const adjustedTeamResult = {
            ...teamResult,
            kpis: adjustedKpis,
          }
          const unitCostSnapshot = adjustedTeamResult.decisions ? calculateUnitCost(
            adjustedTeamResult.decisions,
            adjustedTeamResult.gameState,
            adjustedTeamResult.capacity,
            gameConfig
          ).finalUnitCost * (roundMinus1Effects?.costInflation ?? 1) : 26
          const fullResults = {
            ...adjustedTeamResult,
            marketDemand: roundMinus1Results.marketDemand,
            unitCost: unitCostSnapshot,
            activeInterestRate: roundMinus1InterestRate,
            activeTaxRate: getEffectiveTaxRate(adjustedTeamResult.sales, roundMinus1Effects, gameConfig),
            scenarioSnapshot: SCENARIOS[0],
          }
          const data = {
            gameId: game.id,
            teamId: dbTeam.id,
            roundNumber: -1,
            rank: calculateRank(roundMinus1Results.teams, i),
            fullResults: fullResults as unknown,
          }
          await tx.teamRoundResult.upsert({
            where: {
              teamId_roundNumber: {
                teamId: dbTeam.id,
                roundNumber: -1,
              },
            },
            create: data,
            update: data,
          })
        }
      })

      console.log(`[admin/recalculate] Reset round -1 (starting position) for game ${gameId} with ${game.teams.length} teams`)
      invalidateResultsCache(gameId)
      return res.json({
        success: true,
        message: `Reset starting position (round -1) and recalculated TeamRoundResult for ${game.teams.length} teams`,
        round: -1,
      })
    }

    const game = await prisma.game.findUnique({
      where: { id: gameId },
      include: {
        teams: {
          orderBy: { displayOrder: 'asc' },
          include: {
            decisions: {
              where: { roundNumber: round },
            },
          },
        },
      },
    })

    if (!game) {
      return res.status(404).json({ success: false, error: 'Game not found' })
    }

    const prevRoundResultsMap = new Map<string, unknown>()
    // For state accumulation (inventory, cash, factories, balance sheet):
    // - Round 0 (trial): Use round -1 TeamRoundResult (calculated starting position)
    // - Round 1: Use round -1 TeamRoundResult (trial resets, start from calculated position)
    // - Round 2+: Use previous round's TeamRoundResult for state accumulation
    // NOTE: Round -1 TeamRoundResult is created by calculateRoundMinus1() during freeze
    const prevRoundForResults = round <= 1 ? -1 : round - 1
    const prevResults = await prisma.teamRoundResult.findMany({
      where: { gameId, roundNumber: prevRoundForResults },
      select: { teamId: true, fullResults: true },
    })
    prevResults.forEach((row) => {
      if (row?.teamId) {
        prevRoundResultsMap.set(row.teamId, row.fullResults)
      }
    })
    console.log(`[admin/recalculate] Round ${round}: Loaded ${prevResults.length} TeamRoundResult(s) from round ${prevRoundForResults}`)

    // For game state accumulation:
    // - Round 0 uses starting state (-1)
    // - Round 1 uses starting state (-1); trial does NOT carry forward
    // - Round 2+ uses previous round
    const prevRoundNumber = round > 1 ? round - 1 : -1
    const prevStates = await prisma.gameState.findMany({
      where: {
        teamId: { in: game.teams.map((t) => t.id) },
        roundNumber: prevRoundNumber,
      },
    })
    const prevStateMap = new Map<string, unknown>()
    prevStates.forEach((state) => {
      prevStateMap.set(state.teamId, state)
    })

    const gameConfig = resolveGameConfig(game)
    const teamStates: Array<{ id: number; name: string; decisions: EngineDecisions }> = []
    const previousGameStates = new Map<number, TeamGameState>()

    game.teams.forEach((team, index) => {
      const decision = team.decisions[0]
      if (decision) {
        const decisionProduction = decision.production as Record<string, unknown>
        console.log(`[admin/recalculate] Team ${team.name} Round ${round}: Using DB decision (submitted=${decision.isSubmitted}, usUnits=${decisionProduction?.usUnits}, outsourceUS=${decisionProduction?.outsourceUS})`)
      } else {
        console.warn(`[admin/recalculate] Team ${team.name} Round ${round}: No decision found, using defaults`)
      }
      const decisions = decision
        ? (transformDecisionFromDb(decision as unknown as Parameters<typeof transformDecisionFromDb>[0], gameConfig) as EngineDecisions)
        : (getDefaultDecisions(gameConfig) as EngineDecisions)
      teamStates.push({
        id: index,
        name: team.name,
        decisions,
      })

      const prevState = prevStateMap.get(team.id)
      const usePrevState = prevState
      const hasPrevResults = prevRoundResultsMap.has(team.id)
      const prevResults = prevRoundResultsMap.get(team.id)
      const prevBalanceSheet = prevResults?.balanceSheet
      console.log(`[admin/recalculate] Team ${team.name} Round ${round}: prevState=${!!prevState}, hasPrevResults=${hasPrevResults}, prevBalanceSheet.retainedEarnings=${prevBalanceSheet?.retainedEarnings ?? 'N/A'}`)

      if (hasPrevResults) {
        // PREFER TeamRoundResult - it's the source of truth for Round 2+
        const state = transformGameStateFromResults(prevResults, gameConfig) as TeamGameState
        state.previousRoundResults = prevResults
        console.log(`[admin/recalculate] Team ${team.name} using TeamRoundResult as source`)
        previousGameStates.set(index, state)
      } else if (usePrevState) {
        // FALLBACK to GameState for Round 0/1 (no previous results)
        const state = transformGameStateFromDb(usePrevState, gameConfig) as TeamGameState
        console.log(`[admin/recalculate] Team ${team.name} using GameState as source`)
        previousGameStates.set(index, state)
      } else {
        previousGameStates.set(index, createInitialGameState(gameConfig))
      }
    })

    const results = calculateRound(
      teamStates,
      round,
      previousGameStates,
      game.scenarioSequence,
      game.marketDemandMultiplier ?? 1,
      gameConfig,
      game.regionDemandSplit as { us: number; asia: number; europe: number } | undefined,
      game.taxLossCarryforwardEnabled ?? false
    )
    const scenarioId = game.scenarioSequence?.[round] ?? 0
    const scenarioSnapshot = SCENARIOS[scenarioId] ?? SCENARIOS[0]

    const writes: Prisma.PrismaPromise<unknown>[] = []
    for (let i = 0; i < results.teams.length; i++) {
      const teamResult = results.teams[i]
      const dbTeam = game.teams[i]

      const fullResultsToSave = {
        ...teamResult,
        marketDemand: results.marketDemand,
        scenarioSnapshot,
      }
      writes.push(
        prisma.teamRoundResult.upsert({
          where: {
            teamId_roundNumber: {
              teamId: dbTeam.id,
              roundNumber: round,
            },
          },
          update: {
            rank: calculateRank(results.teams, i),
            fullResults: fullResultsToSave as unknown,
          },
          create: {
            gameId: game.id,
            roundNumber: round,
            rank: calculateRank(results.teams, i),
            fullResults: fullResultsToSave as unknown,
            team: { connect: { id: dbTeam.id } },
          },
        })
      )

      if (round > 0) {
        writes.push(
          prisma.gameState.upsert({
            where: {
              teamId_roundNumber: {
                teamId: dbTeam.id,
                roundNumber: round,
              },
            },
            update: {
              factoriesUS: teamResult.gameState.factories.us,
              factoriesAsia: teamResult.gameState.factories.asia,
              pendingInvestments: teamResult.gameState.pendingInvestments as unknown,
              unlockedTechLevel: teamResult.gameState.rndProgress.unlockedTechLevel,
              unlockedFeatures: teamResult.gameState.rndProgress.unlockedFeatureCount,
              cumulativeResearchHours: teamResult.gameState.rndProgress.cumulativeResearchHours,
              brandReputation: teamResult.gameState.brandReputation,
              inventory: teamResult.gameState.inventory || 0,
              inventoryUS: teamResult.gameState.inventoryUS || 0,
              inventoryAsia: teamResult.gameState.inventoryAsia || 0,
              cashBalance: teamResult.balanceSheet.cash,
              longTermDebt: teamResult.balanceSheet.longTermDebt,
              shareCapital: teamResult.balanceSheet.shareCapital,
              retainedEarnings: teamResult.balanceSheet.retainedEarnings,
            },
            create: {
              teamId: dbTeam.id,
              roundNumber: round,
              factoriesUS: teamResult.gameState.factories.us,
              factoriesAsia: teamResult.gameState.factories.asia,
              pendingInvestments: teamResult.gameState.pendingInvestments as unknown,
              unlockedTechLevel: teamResult.gameState.rndProgress.unlockedTechLevel,
              unlockedFeatures: teamResult.gameState.rndProgress.unlockedFeatureCount,
              cumulativeResearchHours: teamResult.gameState.rndProgress.cumulativeResearchHours,
              brandReputation: teamResult.gameState.brandReputation,
              inventory: teamResult.gameState.inventory || 0,
              inventoryUS: teamResult.gameState.inventoryUS || 0,
              inventoryAsia: teamResult.gameState.inventoryAsia || 0,
              cashBalance: teamResult.balanceSheet.cash,
              longTermDebt: teamResult.balanceSheet.longTermDebt,
              shareCapital: teamResult.balanceSheet.shareCapital,
              retainedEarnings: teamResult.balanceSheet.retainedEarnings,
            },
          })
        )
      }
    }

    writes.push(
      prisma.round.update({
        where: {
          gameId_roundNumber: {
            gameId: game.id,
            roundNumber: round,
          },
        },
        data: {
          marketDemand: results.marketDemand as unknown,
        },
      })
    )

    await prisma.$transaction(writes)

    invalidateResultsCache(gameId)
    res.json({ success: true })
  } catch (error) {
    console.error('Error recalculating round:', error)
    res.status(500).json({ success: false, error: 'Failed to recalculate round' })
  }
})

// Reset game back to a specific round (admin view)
router.post('/games/:gameId/reset/:roundNumber', async (req, res) => {
  try {
    const { gameId, roundNumber } = req.params
    const round = parseInt(roundNumber, 10)

    if (Number.isNaN(round) || round < 0) {
      return res.status(400).json({ success: false, error: 'Invalid round number' })
    }

    const game = await prisma.game.findUnique({
      where: { id: gameId },
      select: { id: true },
    })

    if (!game) {
      return res.status(404).json({ success: false, error: 'Game not found' })
    }

    const gameWithTeams = await prisma.game.findUnique({
      where: { id: gameId },
      include: {
        teams: {
          include: {
            gameStates: {
              where: { roundNumber: round - 1 },
              orderBy: { roundNumber: 'desc' },
              take: 1,
            },
          },
        },
      },
    })

    const writes: Prisma.PrismaPromise<unknown>[] = [
      prisma.decision.deleteMany({
        where: {
          roundNumber: { gte: round },
          team: { gameId },
        },
      }),
      prisma.teamRoundResult.deleteMany({
        where: {
          gameId,
          roundNumber: { gte: round },
        },
      }),
      prisma.gameState.deleteMany({
        where: {
          roundNumber: { gte: round },
          team: { gameId },
        },
      }),
      prisma.round.updateMany({
        where: {
          gameId,
          roundNumber: { gte: round },
        },
        data: {
          status: 'PENDING',
          startedAt: null,
          deadline: null,
          completedAt: null,
          marketDemand: Prisma.DbNull,
        },
      }),
      prisma.round.update({
        where: {
          gameId_roundNumber: {
            gameId,
            roundNumber: round,
          },
        },
        data: {
          status: 'ACTIVE',
          startedAt: new Date(),
          deadline: null,
        },
      }),
      prisma.game.update({
        where: { id: gameId },
        data: {
          currentRound: round,
          status: 'ACTIVE',
          roundDeadline: null,
          completedAt: null,
        },
      }),
    ]

    if (gameWithTeams) {
      const gameConfig = resolveGameConfig(gameWithTeams)
      const scenarioId = gameWithTeams.scenarioSequence?.[round] ?? 0

      for (const team of gameWithTeams.teams) {
        writes.push(
          prisma.gameState.upsert({
            where: {
              teamId_roundNumber: {
                teamId: team.id,
                roundNumber: -1,
              },
            },
            update: {
              ...getDefaultGameState(gameConfig),
            },
            create: {
              teamId: team.id,
              roundNumber: -1,
              ...getDefaultGameState(gameConfig),
            },
          })
        )
      }

      for (const team of gameWithTeams.teams) {
        let decisions
        if (team.isComputer && team.aiProfile) {
          const aiProfile = team.aiProfile as unknown as AIProfile
          if (round <= 0) {
            decisions = generateInitialAIDecision(
              aiProfile,
              scenarioId,
              gameWithTeams.totalRounds,
              gameConfig
            )
          } else {
            const prevState = team.gameStates?.[0]
            // SINGLE SOURCE OF TRUTH: Use getBalancedStartingFinancials for fallback values
            const startingFinancials = getBalancedStartingFinancials(gameConfig)
            const gameContext = {
              round,
              totalRounds: gameWithTeams.totalRounds,
              scenarioId,
              currentState: {
                cash: prevState?.cashBalance ?? startingFinancials.startingCash,
                debt: prevState?.longTermDebt ?? startingFinancials.startingDebt,
                factories: {
                  us: prevState?.factoriesUS ?? gameConfig.initialFactories.us,
                  asia: prevState?.factoriesAsia ?? gameConfig.initialFactories.asia,
                },
                inventory: {
                  us: prevState?.inventoryUS ?? 0,
                  asia: prevState?.inventoryAsia ?? 0,
                },
                techLevel: prevState?.unlockedTechLevel ?? 1,
                unlockedFeatures: prevState?.unlockedFeatures ?? 0,
                brandReputation: prevState?.brandReputation ?? 50,
              },
            }
            decisions = generateSmartAIDecision(aiProfile, gameContext, gameConfig)
          }
        } else if (team.isComputer) {
          decisions = generateAIDecisionForDb(scenarioId, gameConfig)
        } else {
          decisions = getDefaultDecisionForDb(gameConfig)
        }

        writes.push(
          prisma.decision.upsert({
            where: {
              teamId_roundNumber: {
                teamId: team.id,
                roundNumber: round,
              },
            },
            update: {
              ...decisions,
              isSubmitted: team.isComputer,
              submittedAt: team.isComputer ? new Date() : null,
            },
            create: {
              teamId: team.id,
              roundNumber: round,
              ...decisions,
              isSubmitted: team.isComputer,
              submittedAt: team.isComputer ? new Date() : null,
            },
          })
        )
      }
    }

    await prisma.$transaction(writes)

    invalidateResultsCache(gameId)
    res.json({ success: true })
  } catch (error) {
    console.error('Error resetting game:', error)
    res.status(500).json({ success: false, error: 'Failed to reset game' })
  }
})

// Detailed audit calculation per round (admin view)
router.get('/games/:gameId/audit/:roundNumber', async (req, res) => {
  try {
    const { gameId, roundNumber } = req.params
    const round = parseInt(roundNumber, 10)

    const [roundRecord, results] = await Promise.all([
      prisma.round.findUnique({
        where: {
          gameId_roundNumber: {
            gameId,
            roundNumber: round,
          },
        },
        select: { marketDemand: true },
      }),
      prisma.teamRoundResult.findMany({
        where: { gameId, roundNumber: round },
        include: {
          team: { select: { id: true, name: true } },
        },
      }),
    ])

    const toShareFraction = (value: number | null | undefined) => {
      if (!value || Number.isNaN(value)) return 0
      return value > 1 ? value / 100 : value
    }

    const deriveDemand = (regionKey: 'us' | 'asia' | 'europe') => {
      const values: number[] = []
      results.forEach((row) => {
        const fr = row.fullResults as Record<string, unknown>
        const share =
          regionKey === 'us'
            ? toShareFraction(fr?.marketShare?.us)
            : regionKey === 'asia'
              ? toShareFraction(fr?.marketShare?.asia)
              : toShareFraction(fr?.marketShare?.europe)
        const units =
          regionKey === 'us'
            ? fr?.sales?.us?.units
            : regionKey === 'asia'
              ? fr?.sales?.asia?.units
              : fr?.sales?.europe?.units
        if (share > 0 && units > 0) {
          values.push(units / share)
        }
      })
      if (values.length === 0) return 0
      return values.reduce((sum, v) => sum + v, 0) / values.length
    }

    const roundMarketDemand = roundRecord?.marketDemand as unknown
    const marketDemand = {
      us: roundMarketDemand?.us ?? deriveDemand('us'),
      asia: roundMarketDemand?.asia ?? deriveDemand('asia'),
      europe: roundMarketDemand?.europe ?? deriveDemand('europe'),
    }

    const audit = {
      source: 'db',
      round,
      marketDemand,
      teams: results.map((row) => {
        const fullResults = (row.fullResults as Record<string, unknown>) || {}
        const shareUS = toShareFraction(fullResults?.marketShare?.us)
        const shareAsia = toShareFraction(fullResults?.marketShare?.asia)
        const shareEurope = toShareFraction(fullResults?.marketShare?.europe)
        const auditTrace = fullResults.audit || {}
        const demandTrace = auditTrace.trace?.demand || {}

        const ensuredDemandTrace = {
          ...demandTrace,
          marketDemand: demandTrace.marketDemand ?? marketDemand,
          idealSharePct: demandTrace.idealSharePct ?? {
            us: shareUS * 100,
            asia: shareAsia * 100,
            europe: shareEurope * 100,
          },
          desiredUnits: demandTrace.desiredUnits ?? {
            us: marketDemand.us * shareUS,
            asia: marketDemand.asia * shareAsia,
            europe: marketDemand.europe * shareEurope,
          },
        }

        return {
          ...fullResults,
          teamId: row.team.id,
          teamName: row.team.name,
          audit: {
            ...auditTrace,
            trace: {
              ...auditTrace.trace,
              demand: ensuredDemandTrace,
            },
          },
          // Keep summary fields for convenience in the UI (from fullResults)
          revenue: fullResults.pnl?.revenue,
          netProfit: fullResults.pnl?.netProfit,
          marketShareUS: fullResults.marketShare?.us,
          marketShareAsia: fullResults.marketShare?.asia,
          marketShareEurope: fullResults.marketShare?.europe,
          salesUnitsUS: fullResults.sales?.us?.units,
          salesUnitsAsia: fullResults.sales?.asia?.units,
          salesUnitsEurope: fullResults.sales?.europe?.units,
        }
      }),
    }

    res.json({ success: true, audit })
  } catch (error) {
    console.error('Error generating audit:', error)
    res.status(500).json({ success: false, error: 'Failed to generate audit' })
  }
})

// Comprehensive Claude Audit - generates a text report for debugging
router.get('/games/:gameId/claude-audit/:roundNumber', async (req, res) => {
  try {
    const { gameId, roundNumber } = req.params
    const round = parseInt(roundNumber, 10)

    // Fetch game with all related data
    const game = await prisma.game.findUnique({
      where: { id: gameId },
      include: {
        rounds: {
          where: { roundNumber: round },
        },
        teams: {
          orderBy: { displayOrder: 'asc' },
          include: {
            decisions: {
              where: { roundNumber: round },
            },
            results: {
              where: { roundNumber: round },
            },
            gameStates: {
              where: { roundNumber: { in: [round - 1, round] } },
              orderBy: { roundNumber: 'asc' },
            },
          },
        },
      },
    })

    if (!game) {
      return res.status(404).json({ success: false, error: 'Game not found' })
    }

    const roundRecord = game.rounds[0]

    // Build comprehensive report
    let report = `=== CLAUDE AUDIT REPORT ===\n`
    report += `Generated: ${new Date().toISOString()}\n\n`

    // Game Info
    report += `== GAME INFO ==\n`
    report += `Game Code: ${game.gameCode}\n`
    report += `Name: ${game.name}\n`
    report += `Industry: ${game.industry}\n`
    report += `Status: ${game.status}\n`
    report += `Current Round: ${game.currentRound}\n`
    report += `Total Rounds: ${game.totalRounds}\n`
    report += `Auditing Round: ${round}\n\n`

    // Round Info
    report += `== ROUND ${round} INFO ==\n`
    if (roundRecord) {
      report += `Status: ${roundRecord.status}\n`
      report += `Scenario ID: ${roundRecord.scenarioId}\n`
      report += `Created: ${roundRecord.createdAt.toISOString()}\n`
      report += `Started: ${roundRecord.startedAt?.toISOString() || 'N/A'}\n`
      report += `Completed: ${roundRecord.completedAt?.toISOString() || 'N/A'}\n`
      if (roundRecord.marketDemand) {
        const md = roundRecord.marketDemand as unknown
        report += `Market Demand: US=${md.us?.toLocaleString() || 0}, Asia=${md.asia?.toLocaleString() || 0}, Europe=${md.europe?.toLocaleString() || 0}\n`
        report += `Total Market Demand: ${((md.us || 0) + (md.asia || 0) + (md.europe || 0)).toLocaleString()}\n`
      }
    } else {
      report += `No round record found\n`
    }
    report += `\n`

    // Each Team
    for (const team of game.teams) {
      report += `== TEAM: ${team.name} (isComputer: ${team.isComputer}) ==\n`
      report += `Team ID: ${team.id}\n\n`

      // Decision
      const decision = team.decisions[0]
      if (decision) {
        report += `--- DECISION (INPUT) ---\n`
        report += `Submitted: ${decision.isSubmitted}\n`
        report += `Submitted At: ${decision.submittedAt?.toISOString() || 'N/A'}\n`
        report += `Created: ${decision.createdAt.toISOString()}\n`
        report += `Updated: ${decision.updatedAt.toISOString()}\n\n`

        const prod = decision.production as Record<string, unknown> || {}
        report += `Production:\n`
        report += `  US Capacity: ${prod.usCapacity?.toLocaleString() || 0}\n`
        report += `  Asia Capacity: ${prod.asiaCapacity?.toLocaleString() || 0}\n`
        report += `  US Units: ${prod.usUnits?.toLocaleString() || 0}\n`
        report += `  Asia Units: ${prod.asiaUnits?.toLocaleString() || 0}\n`
        report += `  Outsource US: ${prod.outsourceUS?.toLocaleString() || 0}\n`
        report += `  Outsource Asia: ${prod.outsourceAsia?.toLocaleString() || 0}\n`
        report += `  Overtime %: ${prod.overtime || 0}%\n\n`

        const mkt = decision.marketing as Record<string, unknown> || {}
        report += `Marketing:\n`
        report += `  Price US: $${mkt.priceUS?.toLocaleString() || 0}\n`
        report += `  Price Asia: $${mkt.priceAsia?.toLocaleString() || 0}\n`
        report += `  Price Europe: $${mkt.priceEurope?.toLocaleString() || 0}\n`
        report += `  Promo US: ${(mkt.promoUS || 0) * 100}%\n`
        report += `  Promo Asia: ${(mkt.promoAsia || 0) * 100}%\n`
        report += `  Promo Europe: ${(mkt.promoEurope || 0) * 100}%\n\n`

        const inv = decision.investment as Record<string, unknown> || {}
        report += `Investment:\n`
        report += `  New Plants US: ${inv.newPlantsUS || 0}\n`
        report += `  New Plants Asia: ${inv.newPlantsAsia || 0}\n\n`

        const fin = decision.finance as Record<string, unknown> || {}
        report += `Finance:\n`
        report += `  Borrowing: $${fin.borrowing?.toLocaleString() || 0}\n`
        report += `  Repayment: $${fin.repayment?.toLocaleString() || 0}\n`
        report += `  Dividend: $${fin.dividend?.toLocaleString() || 0}\n\n`
      } else {
        report += `--- NO DECISION FOUND ---\n\n`
      }

      // Previous State
      const prevState = team.gameStates.find((s: { roundNumber?: number }) => s.roundNumber === round - 1)
      if (prevState) {
        report += `--- PREVIOUS STATE (Round ${round - 1}) ---\n`
        report += `  Factories US: ${prevState.factoriesUS}\n`
        report += `  Factories Asia: ${prevState.factoriesAsia}\n`
        report += `  Cash: $${prevState.cashBalance?.toLocaleString() || 0}\n`
        report += `  Inventory: ${prevState.inventory?.toLocaleString() || 0} units\n`
        report += `  Long-term Debt: $${prevState.longTermDebt?.toLocaleString() || 0}\n`
        report += `  Retained Earnings: $${prevState.retainedEarnings?.toLocaleString() || 0}\n\n`
      }

      // Result
      const result = team.results[0]
      if (result) {
        report += `--- RESULT (OUTPUT) ---\n`
        report += `Created: ${result.createdAt.toISOString()}\n\n`

        // Extract from fullResults
        const fr = result.fullResults as Record<string, unknown>

        report += `Sales:\n`
        report += `  Units Sold US: ${fr?.sales?.us?.units?.toLocaleString() || 0}\n`
        report += `  Units Sold Asia: ${fr?.sales?.asia?.units?.toLocaleString() || 0}\n`
        report += `  Units Sold Europe: ${fr?.sales?.europe?.units?.toLocaleString() || 0}\n`
        report += `  Total Units Sold: ${((fr?.sales?.us?.units || 0) + (fr?.sales?.asia?.units || 0) + (fr?.sales?.europe?.units || 0)).toLocaleString()}\n`
        report += `  Market Share US: ${((fr?.marketShare?.us || 0) * 100).toFixed(2)}%\n`
        report += `  Market Share Asia: ${((fr?.marketShare?.asia || 0) * 100).toFixed(2)}%\n`
        report += `  Market Share Europe: ${((fr?.marketShare?.europe || 0) * 100).toFixed(2)}%\n\n`

        report += `Financials:\n`
        report += `  Revenue: $${fr?.pnl?.revenue?.toLocaleString() || 0}\n`
        report += `  Net Profit: $${fr?.pnl?.netProfit?.toLocaleString() || 0}\n\n`

        // Full results breakdown if available
        if (fr) {
          if (fr.production) {
            report += `Production (from fullResults):\n`
            report += `  Units Produced: ${fr.production.unitsProduced?.toLocaleString() || 0}\n`
            report += `  Capacity Used: ${fr.production.capacityUsed?.toLocaleString() || 0}\n`
            report += `  Available for Sale: ${fr.production.availableForSale?.toLocaleString() || 0}\n\n`
          }
          if (fr.balanceSheet) {
            const bs = fr.balanceSheet
            report += `Balance Sheet:\n`
            report += `  Fixed Assets: $${bs.fixedAssets?.toLocaleString() || 0}\n`
            report += `  Inventory: $${bs.inventory?.toLocaleString() || 0}\n`
            report += `  Receivables: $${bs.receivables?.toLocaleString() || 0}\n`
            report += `  Cash: $${bs.cash?.toLocaleString() || 0}\n`
            report += `  Total Assets: $${bs.totalAssets?.toLocaleString() || 0}\n`
            report += `  ---\n`
            report += `  Long-term Debt: $${bs.longTermDebt?.toLocaleString() || 0}\n`
            report += `  Short-term Loans: $${bs.shortTermLoans?.toLocaleString() || 0}\n`
            report += `  Payables: $${bs.payables?.toLocaleString() || 0}\n`
            report += `  Total Liabilities: $${bs.totalLiabilities?.toLocaleString() || 0}\n`
            report += `  ---\n`
            report += `  Share Capital: $${bs.shareCapital?.toLocaleString() || 0}\n`
            report += `  Retained Earnings: $${bs.retainedEarnings?.toLocaleString() || 0}\n`
            report += `  Total Equity: $${bs.totalEquity?.toLocaleString() || 0}\n`
            report += `  ---\n`
            report += `  ASSETS: $${bs.totalAssets?.toLocaleString() || 0}\n`
            report += `  L + E: $${((bs.totalLiabilities || 0) + (bs.totalEquity || 0)).toLocaleString()}\n`
            const diff = (bs.totalAssets || 0) - ((bs.totalLiabilities || 0) + (bs.totalEquity || 0))
            report += `  DIFF: $${diff.toLocaleString()} ${Math.abs(diff) > 1 ? '⚠️ UNBALANCED!' : '✓'}\n\n`
          }
          if (fr.gameState) {
            const gs = fr.gameState
            report += `Game State (after round):\n`
            report += `  Factories: US=${gs.factories?.us || 0}, Asia=${gs.factories?.asia || 0}\n`
            report += `  Inventory: ${gs.inventory?.toLocaleString() || 0} units\n`
            report += `  Cash: $${gs.cash?.toLocaleString() || 0}\n`
            report += `  Pending Investments: ${JSON.stringify(gs.pendingInvestments || [])}\n\n`
          }
        }
      } else {
        report += `--- NO RESULT FOUND ---\n\n`
      }

      report += `\n`
    }

    // Timeline
    report += `== TIMELINE ==\n`
    const events: { time: Date; event: string }[] = []

    if (roundRecord) {
      events.push({ time: roundRecord.createdAt, event: `Round ${round} CREATED` })
      if (roundRecord.startedAt) events.push({ time: roundRecord.startedAt, event: `Round ${round} STARTED` })
      if (roundRecord.completedAt) events.push({ time: roundRecord.completedAt, event: `Round ${round} COMPLETED` })
    }

    for (const team of game.teams) {
      const decision = team.decisions[0]
      if (decision) {
        events.push({ time: decision.createdAt, event: `${team.name} Decision CREATED` })
        events.push({ time: decision.updatedAt, event: `${team.name} Decision UPDATED (submitted=${decision.isSubmitted})` })
      }
      const result = team.results[0]
      if (result) {
        events.push({ time: result.createdAt, event: `${team.name} Result CREATED` })
      }
    }

    events.sort((a, b) => a.time.getTime() - b.time.getTime())
    for (const e of events) {
      report += `${e.time.toISOString()} - ${e.event}\n`
    }

    report += `\n=== END OF AUDIT REPORT ===\n`

    res.json({ success: true, report })
  } catch (error) {
    console.error('Error generating Claude audit:', error)
    res.status(500).json({ success: false, error: 'Failed to generate Claude audit' })
  }
})

// Update educator credits
router.put('/educators/:id/credits', async (req, res) => {
  try {
    const sessionId = getSessionCookie(req, 'admin')
    const session = getSession(sessionId)
    if (!session || session.role !== 'admin') {
      return res.status(401).json({ success: false, error: 'Unauthorized' })
    }

    const { id } = req.params
    const { credits } = req.body

    if (typeof credits !== 'number' || credits < 0) {
      return res.status(400).json({ success: false, error: 'Valid credit amount required' })
    }

    const educator = await prisma.educator.update({
      where: { id },
      data: { credits },
    })

    res.json({ success: true, educator })
  } catch (error) {
    console.error('Error updating credits:', error)
    res.status(500).json({ success: false, error: 'Failed to update credits' })
  }
})

export default router

