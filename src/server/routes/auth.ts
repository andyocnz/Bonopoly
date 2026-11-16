import { Router } from 'express'
import prisma from '../db'
import { createSession, destroySession, getSession, getSessionCookie, SESSION_COOKIE_BY_ROLE, SESSION_COOKIE_NAME } from '../sessionStore'
import { finalizeRoundIfDeadlinePassed } from './games'
import bcrypt from 'bcryptjs'

const router = Router()

router.get('/me', async (req, res) => {
  try {
    const roleParam = typeof req.query.role === 'string' ? req.query.role : undefined
    const role = roleParam === 'team' || roleParam === 'educator' || roleParam === 'admin'
      ? roleParam
      : undefined
    if (!role) {
      return res.json({ success: false })
    }
    const sessionId = getSessionCookie(req, role)
    const session = getSession(sessionId)

    if (!session) {
      return res.json({ success: false })
    }

    if (session.role === 'admin') {
      return res.json({ success: true, role: 'admin' })
    }

    if (session.role === 'educator') {
      // New educator login (with educatorId)
      if (session.educatorId) {
        const educator = await prisma.educator.findUnique({
          where: { id: session.educatorId },
        })
        // Prevent caching to ensure credits are always fresh
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private')
        res.setHeader('Pragma', 'no-cache')
        res.setHeader('Expires', '0')
        return res.json({
          success: true,
          role: 'educator',
          credits: educator?.credits ?? 0,
          email: educator?.email,
        })
      }

      // Old educator login (with gameId) - return game info
      if (session.gameId) {
        await finalizeRoundIfDeadlinePassed(session.gameId)
      }
      const game = await prisma.game.findUnique({
        where: { id: session.gameId },
        include: {
          teams: {
            orderBy: { displayOrder: 'asc' },
            select: {
              id: true,
              teamCode: true,
              name: true,
              color: true,
              isComputer: true,
            },
          },
        },
      })

      if (!game) {
        return res.json({ success: false })
      }

      return res.json({
        success: true,
        role: 'educator',
        game: {
          id: game.id,
          gameCode: game.gameCode,
          name: game.name,
          status: game.status,
          companyName: game.companyName,
          industry: game.industry,
          totalRounds: game.totalRounds,
          currentRound: game.currentRound,
          roundDeadline: game.roundDeadline,
          timezone: game.timezone,
          regionLabels: game.regionLabels,
          scenarioSequence: game.scenarioSequence,
          marketDemandMode: game.marketDemandMode,
          marketDemandMultiplier: game.marketDemandMultiplier,
          capacityPerFactory: game.capacityPerFactory,
          regionDemandSplit: game.regionDemandSplit,
          gameConfig: game.gameConfig,
          teams: game.teams,
        },
      })
    }

    const team = await prisma.team.findUnique({
      where: { id: session.teamId },
      include: {
        game: {
          select: {
            id: true,
            gameCode: true,
            name: true,
            status: true,
            companyName: true,
            industry: true,
            totalRounds: true,
            currentRound: true,
            roundDeadline: true,
            timezone: true,
            regionLabels: true,
            scenarioSequence: true,
            marketDemandMode: true,
            marketDemandMultiplier: true,
            regionDemandSplit: true,
            capacityPerFactory: true,
            gameConfig: true,
            startingCash: true,
            startingFactoriesUS: true,
            startingFactoriesAsia: true,
            maxDebtRatio: true,
            plantCostUS: true,
            plantCostAsia: true,
            startingDebt: true,
            startingInventoryUnits: true,
            startingShareCapital: true,
            gamePin: true,
            _count: {
              select: {
                teams: true,
              },
            },
          },
        },
        gameStates: {
          orderBy: { roundNumber: 'desc' },
          take: 1,
        },
      },
    })

    if (!team) {
      return res.json({ success: false })
    }

    await finalizeRoundIfDeadlinePassed(team.game.id)

    const refreshedGame = await prisma.game.findUnique({
      where: { id: team.game.id },
      select: {
        id: true,
        gameCode: true,
        name: true,
        status: true,
        companyName: true,
        industry: true,
        totalRounds: true,
        currentRound: true,
        roundDeadline: true,
        timezone: true,
        regionLabels: true,
        scenarioSequence: true,
        marketDemandMode: true,
        marketDemandMultiplier: true,
        regionDemandSplit: true,
        capacityPerFactory: true,
        gameConfig: true,
        startingCash: true,
        startingFactoriesUS: true,
        startingFactoriesAsia: true,
        maxDebtRatio: true,
        plantCostUS: true,
        plantCostAsia: true,
        startingDebt: true,
        startingInventoryUnits: true,
        startingShareCapital: true,
        gamePin: true,
        _count: {
          select: {
            teams: true,
          },
        },
      },
    })

    if (!refreshedGame) {
      return res.json({ success: false })
    }

    const { _count, ...gameData } = refreshedGame

    return res.json({
      success: true,
      role: 'team',
      team: {
        id: team.id,
        teamCode: team.teamCode,
        name: team.name,
        color: team.color,
        isComputer: team.isComputer,
        introSeen: team.introSeen,
      },
      game: {
        ...gameData,
        capacityPerFactory: gameData.capacityPerFactory,
        totalTeams: _count?.teams ?? 0,
      },
      currentState: team.gameStates[0] || null,
    })
  } catch (error) {
    console.error('Error fetching session:', error)
    res.status(500).json({ success: false, error: 'Failed to fetch session' })
  }
})



router.post('/modlab/login', async (req, res) => {
  const { username, password } = req.body

  console.log('[AUTH] Admin login attempt:', { username, passwordLength: password?.length })

  if (!username || !password) {
    return res.status(400).json({ success: false, error: 'Missing credentials' })
  }

  try {
    // 1. Database check
    console.log('[AUTH] Checking database for username:', username)
    const admin = await prisma.admin.findUnique({
      where: { username },
    })

    if (!admin) {
      console.log('[AUTH] Admin not found:', username)
      return res.status(401).json({ success: false, error: 'Invalid credentials' })
    }

    console.log('[AUTH] Admin found, comparing password...')
    const isValid = await bcrypt.compare(password, admin.password)
    console.log('[AUTH] Password valid:', isValid)

    if (!isValid) {
      console.log('[AUTH] Password mismatch for user:', username)
      return res.status(401).json({ success: false, error: 'Invalid credentials' })
    }

    // Success
    const sessionId = createSession({ role: 'admin' })
    res.cookie(SESSION_COOKIE_BY_ROLE.admin, sessionId, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 1000 * 60 * 60 * 24 * 7,
    })
    res.json({ success: true })
  } catch (err) {
    console.error('Admin login error:', err)
    res.status(500).json({ success: false, error: 'Login failed' })
  }
})

// Educator login
router.post('/educator/login', async (req, res) => {
  const { email, pin } = req.body

  console.log('[AUTH] Educator login attempt:', { email, pinLength: pin?.length })

  if (!email || !pin) {
    return res.status(400).json({ success: false, error: 'Missing credentials' })
  }

  try {
    const educator = await prisma.educator.findUnique({
      where: { email: email.toLowerCase() },
    })

    if (!educator) {
      console.log('[AUTH] Educator not found:', email)
      return res.status(401).json({ success: false, error: 'Invalid credentials' })
    }

    // PIN is stored as plain text (not hashed) for educators
    if (educator.pin !== pin) {
      console.log('[AUTH] PIN mismatch for educator:', email)
      return res.status(401).json({ success: false, error: 'Invalid credentials' })
    }

    // Success
    const sessionId = createSession({ role: 'educator', educatorId: educator.id })
    res.cookie(SESSION_COOKIE_BY_ROLE.educator, sessionId, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 1000 * 60 * 60 * 24 * 7,
    })

    res.json({
      success: true,
      educator: {
        id: educator.id,
        email: educator.email,
        credits: educator.credits
      }
    })
  } catch (err) {
    console.error('Educator login error:', err)
    res.status(500).json({ success: false, error: 'Login failed' })
  }
})

router.post('/logout', (req, res) => {
  const roleParam = typeof req.query.role === 'string' ? req.query.role : undefined
  const role = roleParam === 'team' || roleParam === 'educator' || roleParam === 'admin'
    ? roleParam
    : undefined

  if (role) {
    const sessionId = getSessionCookie(req, role)
    destroySession(sessionId)
    res.cookie(SESSION_COOKIE_BY_ROLE[role], '', {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    })
  } else {
    ; (['team', 'educator', 'admin'] as const).forEach((roleKey) => {
      const sessionId = getSessionCookie(req, roleKey)
      destroySession(sessionId)
      res.cookie(SESSION_COOKIE_BY_ROLE[roleKey], '', {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 0,
      })
    })
    const sessionId = getSessionCookie(req)
    destroySession(sessionId)
    res.cookie(SESSION_COOKIE_NAME, '', {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    })
  }
  res.json({ success: true })
})

export default router
