import { Router } from 'express'
import prisma from '../db'
import { createSession, SESSION_COOKIE_BY_ROLE } from '../sessionStore'
import { finalizeRoundIfDeadlinePassed } from './games'
import { getDefaultGameState } from '../utils'
import { resolveGameConfig } from '../utils/configResolver'
import { buildResultsCacheKey, getCachedResults, getResultsVersion, setCachedResults } from '../cache/resultsCache'

function buildInitialGameState(game: { startingCash?: number; startingFactoriesUS?: number; startingFactoriesAsia?: number; industry?: string; capacityPerFactory?: number }) {
  const gameConfig = resolveGameConfig(game)
  return {
    ...getDefaultGameState(gameConfig),
    factoriesUS: game.startingFactoriesUS,
    factoriesAsia: game.startingFactoriesAsia,
    cashBalance: game.startingCash,
    pendingInvestments: [],
  }
}

const router = Router()

type TeamDecisionLike = {
  marketing?: Record<string, { promotionPct?: number; price?: number } | undefined>
  finance?: { dividends?: number } & Record<string, unknown>
  hr?: {
    us?: { training?: number; employees?: number; wage?: number }
    asia?: { training?: number; employees?: number; wage?: number }
  }
  production?: {
    usUnits?: number
    asiaUnits?: number
    outsourceUS?: number
    outsourceAsia?: number
    overtime?: number
  }
}

type GameConfigLike = {
  hr?: { minWageByRegion?: { us?: number; asia?: number } }
}

type FullResultsLike = {
  balanceSheet?: { cash?: number }
  incomeStatement?: { netProfit?: number }
  [key: string]: unknown
}

type RoundResultLike = {
  roundNumber: number
  rank: number
  team: { id: string; name: string; teamCode?: string }
  fullResults?: unknown
  [key: string]: unknown
}

const validateDecisionInputs = (decision: TeamDecisionLike, gameConfig: GameConfigLike): string | null => {
  const marketing = decision?.marketing ?? {}
  const finance = decision?.finance ?? {}
  const hr = decision?.hr ?? {}
  const production = decision?.production ?? {}
  const minWage = gameConfig?.hr?.minWageByRegion ?? { us: 0, asia: 0 }

  const marketingRegions = ['us', 'asia', 'europe'] as const
  for (const region of marketingRegions) {
    const promo = marketing?.[region]?.promotionPct
    const price = marketing?.[region]?.price
    if (typeof promo === 'number' && promo < 0) {
      return `Marketing promotionPct cannot be negative (${region}).`
    }
    if (typeof price === 'number' && price < 0) {
      return `Marketing price cannot be negative (${region}).`
    }
  }

  const hrUs = hr?.us ?? {}
  const hrAsia = hr?.asia ?? {}
  if (typeof hrUs.training === 'number' && hrUs.training < 0) {
    return 'HR training cannot be negative (US).'
  }
  if (typeof hrAsia.training === 'number' && hrAsia.training < 0) {
    return 'HR training cannot be negative (Asia).'
  }
  if (typeof hrUs.employees === 'number' && hrUs.employees < 0) {
    return 'HR employees cannot be negative (US).'
  }
  if (typeof hrAsia.employees === 'number' && hrAsia.employees < 0) {
    return 'HR employees cannot be negative (Asia).'
  }
  if (typeof hrUs.wage === 'number' && hrUs.wage < minWage.us) {
    return `US wage must be at least $${minWage.us}.`
  }
  if (typeof hrAsia.wage === 'number' && hrAsia.wage > 0 && hrAsia.wage < minWage.asia) {
    return `Asia wage must be at least $${minWage.asia}.`
  }

  if (typeof finance.dividends === 'number' && finance.dividends < 0) {
    return 'Dividends cannot be negative.'
  }

  const numericProductionFields = [
    production?.usUnits,
    production?.asiaUnits,
    production?.outsourceUS,
    production?.outsourceAsia,
    production?.overtime,
  ]
  if (numericProductionFields.some((value) => typeof value === 'number' && value < 0)) {
    return 'Production values cannot be negative.'
  }

  return null
}

// Login with team code and PIN
router.post('/login', async (req, res) => {
  try {
    const { teamCode, teamPin } = req.body

    if (!teamCode) {
      return res.status(400).json({ success: false, error: 'Team code is required' })
    }

    if (!teamPin) {
      return res.status(400).json({ success: false, error: 'Team PIN is required' })
    }

    const team = await prisma.team.findUnique({
      where: { teamCode: teamCode.toUpperCase() },
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
            capacityPerFactory: true,
            gameConfig: true,
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
      return res.status(404).json({ success: false, error: 'Invalid team code' })
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
        capacityPerFactory: true,
        gameConfig: true,
        _count: {
          select: {
            teams: true,
          },
        },
      },
    })

    if (!refreshedGame) {
      return res.status(404).json({ success: false, error: 'Game not found' })
    }

    // Verify PIN
    if (team.teamPin !== teamPin) {
      return res.status(401).json({ success: false, error: 'Invalid PIN' })
    }

    // Update last active
    await prisma.team.update({
      where: { id: team.id },
      data: { lastActiveAt: new Date() },
    })

    const { _count, ...gameData } = refreshedGame

    const sessionId = createSession({ role: 'team', teamId: team.id, gameId: team.game.id })
    res.cookie(SESSION_COOKIE_BY_ROLE.team, sessionId, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 1000 * 60 * 60 * 24 * 7,
    })

    const targetRound = refreshedGame.currentRound > 1 ? refreshedGame.currentRound - 1 : -1
    let currentState = await prisma.gameState.findUnique({
      where: {
        teamId_roundNumber: {
          teamId: team.id,
          roundNumber: targetRound,
        },
      },
    })

    if (!currentState) {
      currentState = await prisma.gameState.create({
        data: {
          teamId: team.id,
          roundNumber: targetRound,
          ...buildInitialGameState(refreshedGame),
        },
      })
    }

    res.json({
      success: true,
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
        totalTeams: _count?.teams ?? 0,
      },
      currentState: currentState || null,
    })
  } catch (error) {
    console.error('Error logging in:', error)
    res.status(500).json({ success: false, error: 'Failed to login' })
  }
})

// Mark intro briefing as seen
router.post('/:teamId/intro-seen', async (req, res) => {
  try {
    const teamId = req.params.teamId
    const team = await prisma.team.findUnique({ where: { id: teamId } })

    if (!team) {
      return res.status(404).json({ success: false, error: 'Team not found' })
    }

    if (!team.introSeen) {
      await prisma.team.update({
        where: { id: teamId },
        data: { introSeen: true },
      })
    }

    res.json({ success: true })
  } catch (error) {
    console.error('Error updating introSeen:', error)
    res.status(500).json({ success: false, error: 'Failed to update intro status' })
  }
})

// Get team's current state
router.get('/:teamId/state', async (req, res) => {
  try {
    const team = await prisma.team.findUnique({
      where: { id: req.params.teamId },
      include: {
        game: true,
      },
    })

    if (!team) {
      return res.status(404).json({ success: false, error: 'Team not found' })
    }

    await finalizeRoundIfDeadlinePassed(team.game.id)

    const refreshedGame = await prisma.game.findUnique({
      where: { id: team.game.id },
    })

    if (!refreshedGame) {
      return res.status(404).json({ success: false, error: 'Game not found' })
    }

    const targetRound = refreshedGame.currentRound > 1 ? refreshedGame.currentRound - 1 : -1
    let state = await prisma.gameState.findUnique({
      where: {
        teamId_roundNumber: {
          teamId: team.id,
          roundNumber: targetRound,
        },
      },
    })

    if (!state) {
      state = await prisma.gameState.create({
        data: {
          teamId: team.id,
          roundNumber: targetRound,
          ...buildInitialGameState(refreshedGame),
        },
      })
    }

    res.json({
      success: true,
      state: state || null,
      game: {
        currentRound: refreshedGame.currentRound,
        status: refreshedGame.status,
        roundDeadline: refreshedGame.roundDeadline,
        timezone: refreshedGame.timezone,
        regionLabels: refreshedGame.regionLabels,
        resultsVersion: getResultsVersion(refreshedGame.id),
      },
    })
  } catch (error) {
    console.error('Error fetching team state:', error)
    res.status(500).json({ success: false, error: 'Failed to fetch state' })
  }
})

// Get team's decision for current round
router.get('/:teamId/decision/:roundNumber', async (req, res) => {
  try {
    const decision = await prisma.decision.findUnique({
      where: {
        teamId_roundNumber: {
          teamId: req.params.teamId,
          roundNumber: parseInt(req.params.roundNumber),
        },
      },
    })

    res.json({
      success: true,
      decision: decision || null,
    })
  } catch (error) {
    console.error('Error fetching decision:', error)
    res.status(500).json({ success: false, error: 'Failed to fetch decision' })
  }
})

// Save team's decision (auto-save as draft)
router.put('/:teamId/decision/:roundNumber', async (req, res) => {
  try {
    const teamId = req.params.teamId
    const roundNumber = parseInt(req.params.roundNumber)
    const { production, hr, rnd, investment, logistics, marketing, finance } = req.body

    // Check if team exists and round is correct
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: { game: true },
    })

    if (!team) {
      return res.status(404).json({ success: false, error: 'Team not found' })
    }

    await finalizeRoundIfDeadlinePassed(team.game.id)

    const refreshedGame = await prisma.game.findUnique({
      where: { id: team.game.id },
      select: { id: true, currentRound: true, status: true },
    })

    if (!refreshedGame) {
      return res.status(404).json({ success: false, error: 'Game not found' })
    }

    if (refreshedGame.currentRound !== roundNumber) {
      return res.status(400).json({ success: false, error: 'Wrong round number' })
    }

    if (refreshedGame.status !== 'ACTIVE') {
      return res.status(400).json({ success: false, error: 'Game is not active' })
    }

    const gameConfig = resolveGameConfig(team.game)
    const validationError = validateDecisionInputs({ production, hr, marketing, finance }, gameConfig)
    if (validationError) {
      return res.status(400).json({ success: false, error: validationError })
    }

    const existingDecision = await prisma.decision.findUnique({
      where: {
        teamId_roundNumber: { teamId, roundNumber },
      },
      select: { isLocked: true },
    })

    if (existingDecision?.isLocked) {
      return res.status(400).json({ success: false, error: 'Round is locked after the deadline' })
    }

    // Upsert decision
    const decision = await prisma.decision.upsert({
      where: {
        teamId_roundNumber: { teamId, roundNumber },
      },
      update: {
        production: production ?? undefined,
        hr: hr ?? undefined,
        rnd: rnd ?? undefined,
        investment: investment ?? undefined,
        logistics: logistics ?? undefined,
        marketing: marketing ?? undefined,
        finance: finance ?? undefined,
        updatedAt: new Date(),
      },
      create: {
        teamId,
        roundNumber,
        production,
        hr,
        rnd,
        investment,
        logistics,
        marketing,
        finance,
      },
    })

    res.json({ success: true, decision })
  } catch (error) {
    console.error('Error saving decision:', error)
    res.status(500).json({ success: false, error: 'Failed to save decision' })
  }
})

// Submit decision (finalize)
router.post('/:teamId/decision/:roundNumber/submit', async (req, res) => {
  try {
    const teamId = req.params.teamId
    const roundNumber = parseInt(req.params.roundNumber)

    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: { gameId: true },
    })

    if (team) {
      await finalizeRoundIfDeadlinePassed(team.gameId)
    }

    // Check if decision exists
    const decision = await prisma.decision.findUnique({
      where: {
        teamId_roundNumber: { teamId, roundNumber },
      },
    })

    if (!decision) {
      return res.status(404).json({ success: false, error: 'No decision found to submit' })
    }

    if (decision.isSubmitted) {
      return res.status(400).json({ success: false, error: 'Decision already submitted' })
    }

    if (decision.isLocked) {
      return res.status(400).json({ success: false, error: 'Round is locked after the deadline' })
    }

    // Validate required fields
    if (!decision.production || !decision.marketing || !decision.finance) {
      return res.status(400).json({
        success: false,
        error: 'Please complete all required sections before submitting',
      })
    }

    const teamData = await prisma.team.findUnique({
      where: { id: teamId },
      select: { gameId: true, isComputer: true },
    })

    if (!teamData) {
      return res.status(404).json({ success: false, error: 'Team not found' })
    }

    if (teamData.gameId) {
      await finalizeRoundIfDeadlinePassed(teamData.gameId)
    }

    // Dividend validation: cannot exceed prior cash balance or prior net profit
    if (roundNumber > 0) {
      const prevRoundNumber = roundNumber === 1 ? -1 : roundNumber - 1
      const prevResult = await prisma.teamRoundResult.findUnique({
        where: {
          teamId_roundNumber: {
            teamId,
            roundNumber: prevRoundNumber,
          },
        },
        select: { fullResults: true },
      })
      if (prevResult) {
        const fullResults = prevResult.fullResults as FullResultsLike
        const availableCash = Math.max(0, fullResults?.balanceSheet?.cash ?? 0)
        const availableProfit = Math.max(0, fullResults?.incomeStatement?.netProfit ?? 0)
        const maxDividend = Math.min(availableCash, availableProfit)
        const requestedDividend = Math.max(0, (decision.finance as { dividends?: number } | null)?.dividends ?? 0)
        if (requestedDividend > maxDividend) {
          return res.status(400).json({
            success: false,
            error: `Dividend exceeds allowed limit ($${maxDividend.toLocaleString('en-US')}).`,
            details: { availableCash, availableProfit, maxDividend },
          })
        }
      }
    }

    // Mark as submitted
    const submitted = await prisma.decision.update({
      where: { id: decision.id },
      data: {
        isSubmitted: true,
        submittedAt: new Date(),
      },
    })

    res.json({ success: true, decision: submitted })
  } catch (error) {
    console.error('Error submitting decision:', error)
    res.status(500).json({ success: false, error: 'Failed to submit decision' })
  }
})

// Get team results history (includes all teams for comparison)
router.get('/:teamId/results', async (req, res) => {
  try {
    const mode = req.query.mode === 'metadata'
      ? 'metadata'
      : (req.query.mode === 'summary' ? 'summary' : 'full')
    const latestOnly = mode === 'metadata' && String(req.query.latestOnly || '') === '1'

    // First get this team to find the game
    const team = await prisma.team.findUnique({
      where: { id: req.params.teamId },
      select: { gameId: true },
    })

    if (!team) {
      return res.status(404).json({ success: false, error: 'Team not found' })
    }

    const cacheModeKey = latestOnly ? 'metadata:latest' : mode
    const resultsVersion = getResultsVersion(team.gameId)
    const cacheKey = buildResultsCacheKey(team.gameId, `${cacheModeKey}:v${resultsVersion}`)
    const cached = getCachedResults(cacheKey)
    const ifNoneMatch = req.header('if-none-match')
    if (cached) {
      res.setHeader('Cache-Control', 'private, max-age=0, must-revalidate')
      res.setHeader('ETag', cached.etag)
      if (ifNoneMatch && ifNoneMatch === cached.etag) {
        return res.status(304).end()
      }
      return res.json(cached.data)
    }

    // Get all results for all teams in the game
    let allResults: RoundResultLike[] = []
    if (mode === 'metadata') {
      const metadataWhere: { gameId: string; roundNumber?: number } = { gameId: team.gameId }
      if (latestOnly) {
        const latestRound = await prisma.teamRoundResult.findFirst({
          where: { gameId: team.gameId },
          orderBy: { roundNumber: 'desc' },
          select: { roundNumber: true },
        })
        if (latestRound) {
          metadataWhere.roundNumber = latestRound.roundNumber
        } else {
          const emptyResponse = { success: true, results: [], resultsVersion }
          const emptyCachedEntry = setCachedResults(cacheKey, emptyResponse)
          res.setHeader('Cache-Control', 'private, max-age=0, must-revalidate')
          res.setHeader('ETag', emptyCachedEntry.etag)
          if (ifNoneMatch && ifNoneMatch === emptyCachedEntry.etag) {
            return res.status(304).end()
          }
          return res.json(emptyResponse)
        }
      }

      allResults = (await prisma.teamRoundResult.findMany({
        where: metadataWhere,
        orderBy: [{ roundNumber: 'asc' }, { rank: 'asc' }],
        select: {
          roundNumber: true,
          rank: true,
          createdAt: true,
          team: { select: { id: true, name: true, teamCode: true } },
        },
      })) as RoundResultLike[]
    } else {
      allResults = (await prisma.teamRoundResult.findMany({
        where: { gameId: team.gameId },
        orderBy: [{ roundNumber: 'asc' }, { rank: 'asc' }],
        include: {
          team: { select: { id: true, name: true, teamCode: true } },
        },
      })) as RoundResultLike[]
    }

    const pickSummaryFullResults = (fullResults: unknown) => {
      if (!fullResults || typeof fullResults !== 'object') return null
      const result = fullResults as Record<string, unknown>
      const kpis = (result.kpis && typeof result.kpis === 'object')
        ? (result.kpis as Record<string, unknown>)
        : null
      const gameState = (result.gameState && typeof result.gameState === 'object')
        ? (result.gameState as Record<string, unknown>)
        : null
      const decisions = (result.decisions && typeof result.decisions === 'object')
        ? (result.decisions as Record<string, unknown>)
        : null
      const finance = (decisions?.finance && typeof decisions.finance === 'object')
        ? (decisions.finance as Record<string, unknown>)
        : null
      return {
        pnl: result.pnl ?? null,
        balanceSheet: result.balanceSheet ?? null,
        sales: result.sales ?? null,
        marketShare: result.marketShare ?? null,
        costs: result.costs ?? null,
        kpis: kpis
          ? {
            sharePrice: kpis.sharePrice,
            eps: kpis.eps,
            tsr: kpis.tsr,
            dividendYield: kpis.dividendYield,
            sharesOutstanding: kpis.sharesOutstanding,
          }
          : null,
        ratios: result.ratios ?? null,
        gameState: gameState
          ? {
            factories: gameState.factories,
            pendingInvestments: gameState.pendingInvestments,
            inventory: gameState.inventory,
            inventoryUS: gameState.inventoryUS,
            inventoryAsia: gameState.inventoryAsia,
            inventoryEurope: gameState.inventoryEurope,
            taxLossCarryforward: gameState.taxLossCarryforward,
            rndProgress: gameState.rndProgress,
          }
          : null,
        decisions: decisions
          ? {
            production: decisions.production,
            marketing: decisions.marketing,
            hr: decisions.hr,
            logistics: decisions.logistics,
            finance: finance
              ? {
                dividends: finance.dividends,
                dividend: finance.dividend,
              }
              : null,
          }
          : null,
        production: result.production ?? null,
        productionUnits: result.productionUnits ?? null,
        capacity: result.capacity ?? null,
        utilization: result.utilization ?? null,
        inventoryByRegion: result.inventoryByRegion ?? null,
        inventoryTrace: result.inventoryTrace ?? null,
        availableFeatures: result.availableFeatures ?? null,
        rndProgress: result.rndProgress ?? null,
        attractivenessBreakdown: result.attractivenessBreakdown ?? null,
        scenarioSnapshot: result.scenarioSnapshot ?? null,
      }
    }

    let decisionMap = new Map<string, unknown>()
    if (mode === 'full') {
      const allTeams = await prisma.team.findMany({
        where: { gameId: team.gameId },
        select: { id: true },
      })
      const teamIds = allTeams.map((t) => t.id)
      const decisions = await prisma.decision.findMany({
        where: { teamId: { in: teamIds } },
        select: { teamId: true, roundNumber: true, finance: true },
      })
      decisionMap = new Map<string, unknown>()
      decisions.forEach((decision) => {
        decisionMap.set(`${decision.teamId}:${decision.roundNumber}`, decision.finance || null)
      })
    }

    // Fetch round-level market demand for reference
    const rounds = await prisma.round.findMany({
      where: { gameId: team.gameId },
      select: { roundNumber: true, marketDemand: true },
    })
    const roundMarketDemand = new Map<number, unknown>()
    rounds.forEach((round) => {
      roundMarketDemand.set(round.roundNumber, round.marketDemand || null)
    })

    // Group results by round with all teams included
    const resultsByRound = new Map<number, RoundResultLike[]>()
    allResults.forEach((r) => {
      if (!resultsByRound.has(r.roundNumber)) {
        resultsByRound.set(r.roundNumber, [])
      }
      if (mode === 'metadata') {
        resultsByRound.get(r.roundNumber)!.push({
          teamId: r.team.id,
          teamName: r.team.name,
          rank: r.rank,
        })
      } else if (mode === 'summary') {
        resultsByRound.get(r.roundNumber)!.push({
          ...r,
          teamId: r.team.id,
          teamName: r.team.name,
          fullResults: pickSummaryFullResults(r.fullResults),
        })
      } else {
        resultsByRound.get(r.roundNumber)!.push({
          ...r,
          teamId: r.team.id,
          teamName: r.team.name,
          decisionFinance: decisionMap.get(`${r.team.id}:${r.roundNumber}`) || null,
        })
      }
    })

    // Convert to array format expected by frontend
    const results = Array.from(resultsByRound.entries()).map(([roundNumber, teams]) => {
      const roundDemand = roundMarketDemand.get(roundNumber)
      const fallbackDemand = mode === 'metadata' ? null : (teams[0]?.fullResults?.marketDemand || null)
      return {
        roundNumber,
        marketDemand: roundDemand ?? fallbackDemand,
        teams,
      }
    })

    const response = { success: true, results, resultsVersion }
    const cachedEntry = setCachedResults(cacheKey, response)
    res.setHeader('Cache-Control', 'private, max-age=0, must-revalidate')
    res.setHeader('ETag', cachedEntry.etag)
    if (ifNoneMatch && ifNoneMatch === cachedEntry.etag) {
      return res.status(304).end()
    }
    res.json(response)
  } catch (error) {
    console.error('Error fetching results:', error)
    res.status(500).json({ success: false, error: 'Failed to fetch results' })
  }
})

export default router
