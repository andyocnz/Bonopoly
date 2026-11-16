/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { Router } from 'express'
import prisma from '../db'
import { generateGameCode, generateTeamCode, generatePin, generateScenarioSequence, TEAM_COLORS, getDefaultGameState } from '../utils'
import {
  calculateRound,
  calculateRoundMinus1,
  calculateUnitCost,
  createInitialGameState,
  getEffectiveTaxRate,
  getBalancedStartingFinancials,
  getScenarioEffectsForRound,
  SCENARIOS,
} from '../../engine/gameEngine'
import type { TeamGameState } from '../../engine/gameEngine'
import { createSession, SESSION_COOKIE_BY_ROLE, getSessionCookie, getSession } from '../sessionStore'
import type { TeamState, TeamDecisions as EngineTeamDecisions } from '../../components/DecisionSimulator'
import {
  assignAIProfiles,
  generateInitialAIDecision,
  generateAIDecision as generateSmartAIDecision,
  type AIProfile,
  type AIDifficulty,
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
import { resolveGameConfig } from '../utils/configResolver'
import { invalidateResultsCache } from '../cache/resultsCache'

const router = Router()
const REGION_KEYS = ['us', 'asia', 'europe'] as const
const PREF_KEYS = ['priceWeight', 'qualityWeight', 'featuresWeight', 'promotionWeight', 'csrWeight', 'trainingWeight'] as const
const GROWTH_KEYS = ['capacity', 'share', 'brand', 'cash'] as const
const activeAdvanceLocks = new Set<string>()
const activeRoundPersistLocks = new Set<string>()

const isObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

const mergeDeep = (base: unknown, override: unknown): unknown => {
  if (!isObject(base) || !isObject(override)) return override
  const output: Record<string, unknown> = { ...base }
  Object.keys(override).forEach((key) => {
    const baseValue = output[key]
    const nextValue = override[key]
    output[key] = isObject(baseValue) && isObject(nextValue)
      ? mergeDeep(baseValue, nextValue)
      : nextValue
  })
  return output
}

const buildValidatedConfigOverrides = (raw: unknown, baseConfig: unknown): { overrides: unknown | null; error?: string } => {
  if (!isObject(raw)) return { overrides: null }
  const overrides: Record<string, unknown> = {}

  const rawBasePrices = raw?.priceDemand?.baselinePriceByRegion
  if (isObject(rawBasePrices)) {
    const nextPrices: Record<string, number> = {}
    for (const region of REGION_KEYS) {
      const value = Number(rawBasePrices[region])
      if (!Number.isFinite(value) || value <= 0) {
        return { overrides: null, error: `Invalid baseline price for ${region}.` }
      }
      const min = Number(baseConfig?.priceDemand?.minPriceByRegion?.[region])
      const max = Number(baseConfig?.priceDemand?.maxPriceByRegion?.[region])
      if (Number.isFinite(min) && value < min) {
        return { overrides: null, error: `Baseline ${region} price must be >= ${min}.` }
      }
      if (Number.isFinite(max) && value > max) {
        return { overrides: null, error: `Baseline ${region} price must be <= ${max}.` }
      }
      nextPrices[region] = value
    }
    overrides.priceDemand = { baselinePriceByRegion: nextPrices }
  }

  const rawPrefs = raw?.marketPreferences
  if (isObject(rawPrefs)) {
    const nextPrefs: Record<string, Record<string, number>> = {}
    for (const region of REGION_KEYS) {
      const regionPrefs = rawPrefs[region]
      if (!isObject(regionPrefs)) {
        return { overrides: null, error: `Missing market preference weights for ${region}.` }
      }
      const parsed: Record<string, number> = {}
      let sum = 0
      for (const key of PREF_KEYS) {
        const value = Number(regionPrefs[key])
        if (!Number.isFinite(value) || value < 0 || value > 1) {
          return { overrides: null, error: `Invalid ${region}.${key}. Must be between 0 and 1.` }
        }
        parsed[key] = value
        sum += value
      }
      if (Math.abs(sum - 1) > 0.001) {
        return { overrides: null, error: `${region} market preference weights must sum to 1.0.` }
      }
      nextPrefs[region] = parsed
    }
    overrides.marketPreferences = nextPrefs
  }

  const rawGrowth = raw?.financial?.growthPremiumWeights
  if (isObject(rawGrowth)) {
    const nextGrowth: Record<string, number> = {}
    let sum = 0
    for (const key of GROWTH_KEYS) {
      const value = Number(rawGrowth[key])
      if (!Number.isFinite(value) || value < 0 || value > 1) {
        return { overrides: null, error: `Invalid growth premium weight ${key}. Must be between 0 and 1.` }
      }
      nextGrowth[key] = value
      sum += value
    }
    if (sum < 0.1 || sum > 1.0) {
      return { overrides: null, error: 'Growth premium weights must sum between 0.10 and 1.00.' }
    }
    overrides.financial = { growthPremiumWeights: nextGrowth }
  }

  return { overrides: Object.keys(overrides).length > 0 ? overrides : null }
}

// Create a new game
router.post('/', async (req, res) => {
  try {
    // Check for educator/admin session to link game
    // Admins use a different cookie, so check both
    const educatorSessionId = getSessionCookie(req, 'educator')
    const adminSessionId = getSessionCookie(req, 'admin')

    const educatorSession = getSession(educatorSessionId)
    void adminSessionId

    const educatorId = educatorSession?.role === 'educator' ? educatorSession.educatorId : undefined

    const {
      name,
      companyName = 'TechCorp',
      industry = 'Electronics & Technology',
      totalRounds = 3,
      hoursPerRound,
      teams: teamsInput = [{ name: 'Team Alpha', isAI: false }, { name: 'Team Beta', isAI: false }],
      marketDemandMode = 'balanced',
      marketDemandMultiplier: providedMultiplier,
      regionDemandSplit,
      timezone = 'Pacific/Auckland',
      regionLabels,
    } = req.body
    const capacityPerFactoryInput = Number(req.body?.capacityPerFactory)
    const capacityPerFactory = Number.isFinite(capacityPerFactoryInput) && capacityPerFactoryInput > 0
      ? capacityPerFactoryInput
      : undefined
    const normalizedDemandMode = marketDemandMode.toString()
    // Use provided multiplier, or fall back to mode defaults
    const marketDemandMultiplier = providedMultiplier ?? (
      normalizedDemandMode === 'high_competition'
        ? 1.0
        : normalizedDemandMode === 'blue_ocean'
          ? 3.0
          : 2.0
    )

    // Generate unique game code
    let gameCode = generateGameCode()
    let attempts = 0
    while (await prisma.game.findUnique({ where: { gameCode } })) {
      gameCode = generateGameCode()
      attempts++
      if (attempts > 10) throw new Error('Could not generate unique game code')
    }

    // Generate game PIN
    const gamePin = generatePin()

    // Check if unknown team is AI and assign profiles with per-team difficulty
    const hasAI = teamsInput.some((t: { isAI: boolean }) => t.isAI)
    const aiTeams = teamsInput.filter((t: { isAI: boolean }) => t.isAI)
    const aiDifficulties = aiTeams.map((t: { aiDifficulty?: string }) =>
      (t.aiDifficulty || 'medium') as AIDifficulty
    )
    const aiProfiles = hasAI
      ? assignAIProfiles(aiTeams.length, aiDifficulties)
      : []
    let aiProfileIndex = 0

    const gameConfig = resolveGameConfig({
      industry,
      capacityPerFactory: capacityPerFactory ?? null,
    })
    const { overrides: validatedOverrides, error: overrideError } = buildValidatedConfigOverrides(
      req.body?.configOverrides,
      gameConfig
    )
    if (overrideError) {
      return res.status(400).json({ success: false, error: overrideError })
    }
    const effectiveConfig = validatedOverrides ? mergeDeep(gameConfig, validatedOverrides) : gameConfig
    const gameConfigSnapshot = JSON.parse(JSON.stringify(effectiveConfig))

    // Create game with teams in a transaction
    const game = await prisma.$transaction(async (tx) => {
      console.log(`[GAMES_API] 🎮 CREATING NEW GAME: "${name}" with gameCode: ${gameCode}`)

      // Check and deduct credits whenever an educator session is present
      // (even if an admin cookie also exists), except for demo games.
      const isDemoGame = name && name.toLowerCase().startsWith('demo game')
      let creditsRemaining: number | null = null
      if (educatorId && !isDemoGame) {
        const educator = await tx.educator.findUnique({ where: { id: educatorId } })
        if (!educator) throw new Error('Educator not found')

        if (educator.credits < 1) {
          throw new Error('Insufficient credits. Please contact support to purchase more credits.')
        }

        const updatedEducator = await tx.educator.update({
          where: { id: educatorId },
          data: { credits: { decrement: 1 } },
          select: { credits: true },
        })
        creditsRemaining = updatedEducator.credits
      }

      // Create the game
      const roundDeadline = hoursPerRound
        ? new Date(Date.now() + hoursPerRound * 60 * 60 * 1000)
        : null

      console.log(`[GAMES_API] 📝 About to call tx.game.create for game: ${gameCode}`)
      const newGame = await tx.game.create({
        data: {
          gameCode,
          gamePin,
          name: name || `Game ${gameCode} `,
          companyName,
          industry,
          totalRounds,
          hoursPerRound: hoursPerRound || null,
          vsComputer: hasAI,
          scenarioSequence: generateScenarioSequence(totalRounds),
          marketDemandMode: normalizedDemandMode,
          marketDemandMultiplier,
          regionDemandSplit: regionDemandSplit ?? { us: 0.22, asia: 0.60, europe: 0.18 },
          timezone,
          regionLabels: regionLabels ?? { us: 'Americas', asia: 'Asia', europe: 'Europe' },
          startingCash: effectiveConfig.financial.startingCash,
            startingFactoriesUS: effectiveConfig.initialFactories.us,
            startingFactoriesAsia: effectiveConfig.initialFactories.asia,
            capacityPerFactory: capacityPerFactory ?? effectiveConfig.capacityPerPlant,
            gameConfig: gameConfigSnapshot as unknown,
            taxLossCarryforwardEnabled: true,
            status: 'ACTIVE',
          currentRound: 0, // Start at trial round
          roundDeadline,
        },
      })



      // Link to educator if authenticated
      if (educatorId) {
        await tx.educatorGame.create({
          data: {
            educatorId,
            gameId: newGame.id,
          },
        })
      }

      // Create teams
      const teams = []
      for (let i = 0; i < teamsInput.length; i++) {
        const { name: teamName, isAI } = teamsInput[i] as { name: string; isAI: boolean }
        let teamCode = generateTeamCode(teamName)

        // Ensure unique team code
        while (await tx.team.findUnique({ where: { teamCode } })) {
          teamCode = generateTeamCode(teamName)
        }

        // Assign AI profile if this is an AI team
        const aiProfile = isAI ? aiProfiles[aiProfileIndex++] : null

        // Generate team PIN
        const teamPin = generatePin()

        const team = await tx.team.create({
          data: {
            gameId: newGame.id,
            teamCode,
            teamPin,
            name: teamName,
            color: TEAM_COLORS[i % TEAM_COLORS.length],
            isComputer: isAI,
            displayOrder: i,
            aiProfile: aiProfile as unknown, // Store AI profile as JSON
          },
        })



        // Create initial game state for team (round -1 = starting position)
        await tx.gameState.create({
          data: {
            teamId: team.id,
            roundNumber: -1,
            ...getDefaultGameState(effectiveConfig),
            factoriesUS: newGame.startingFactoriesUS,
            factoriesAsia: newGame.startingFactoriesAsia,
            cashBalance: newGame.startingCash,
          },
        })



        teams.push(team)
      }

      // Create initial round (trial round = round 0)
      const trialScenarioId = newGame.scenarioSequence[0] ?? 0
      await tx.round.create({
        data: {
          gameId: newGame.id,
          roundNumber: 0,
          status: 'ACTIVE',
          scenarioId: trialScenarioId,
          startedAt: new Date(),
          deadline: roundDeadline,
        },
      })



      // Create default decisions for all teams (round 0 = trial round)
      const scenarioId = newGame.scenarioSequence[0] ?? 0
      for (const team of teams) {
        let decisions
        if (team.isComputer && team.aiProfile) {
          const aiProfile = team.aiProfile as unknown as AIProfile
          decisions = generateInitialAIDecision(
            aiProfile,
            scenarioId,
            newGame.totalRounds,
            effectiveConfig
          )
        } else if (team.isComputer) {
          decisions = generateAIDecisionForDb(scenarioId, effectiveConfig)
        } else {
          decisions = getDefaultDecisionForDb(effectiveConfig)
        }

        await tx.decision.upsert({
          where: {
            teamId_roundNumber: {
              teamId: team.id,
              roundNumber: 0,
            },
          },
          update: {
            ...decisions,
            isSubmitted: team.isComputer,
            submittedAt: team.isComputer ? new Date() : null,
          },
          create: {
            teamId: team.id,
            roundNumber: 0,
            ...decisions,
            isSubmitted: team.isComputer,
            submittedAt: team.isComputer ? new Date() : null,
          },
        })
      }

      return { ...newGame, teams, creditsRemaining }
    }, {
      timeout: 20000 // 20 seconds - needed for games with many teams
    })






    const frozenCount = await prisma.teamRoundResult.count({
      where: { gameId: game.id, roundNumber: -1 },
    })
    if (frozenCount === 0) {
      const frozenConfig = resolveGameConfig(game)
      const roundMinus1Results = calculateRoundMinus1(
        game.teams.length,
        frozenConfig,
        game.scenarioSequence,
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
      const roundMinus1InterestRate = Math.max(0, frozenConfig.financial.interestRate + (roundMinus1Effects.interestRateSpread ?? 0))
      const startingSharePrice = frozenConfig.financial.startingSharePrice
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
            frozenConfig
          ).finalUnitCost * (roundMinus1Effects?.costInflation ?? 1) : 26
          const fullResults = {
            ...adjustedTeamResult,
            marketDemand: roundMinus1Results.marketDemand,
            unitCost: unitCostSnapshot,
            activeInterestRate: roundMinus1InterestRate,
            activeTaxRate: getEffectiveTaxRate(adjustedTeamResult.sales, roundMinus1Effects, frozenConfig),
            scenarioSnapshot: SCENARIOS[0],
          }
          await tx.teamRoundResult.create({
            data: {
              gameId: game.id,
              teamId: dbTeam.id,
              roundNumber: -1,
              rank: calculateRank(roundMinus1Results.teams, i),
              fullResults: fullResults as unknown,
            },
          })
        }
      }, {
        timeout: 20000 // 20 seconds - needed for games with many teams
      })
    }

    // Only create new session if NOT already logged in as educator
    // This prevents overwriting the main educator session with a game-specific one
    if (!educatorId) {
      const sessionId = createSession({ role: 'educator', gameId: game.id })
      res.cookie(SESSION_COOKIE_BY_ROLE.educator, sessionId, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 1000 * 60 * 60 * 24 * 7,
      })
    }

    res.status(201).json({
      success: true,
      creditsRemaining: game.creditsRemaining ?? undefined,
      game: {
        id: game.id,
        gameCode: game.gameCode,
        gamePin: game.gamePin,
        name: game.name,
        status: game.status,
        currentRound: game.currentRound,
        roundDeadline: game.roundDeadline,
        timezone: game.timezone,
        gameConfig: game.gameConfig,
        teams: game.teams.map((t) => ({
          id: t.id,
          teamCode: t.teamCode,
          teamPin: t.teamPin,
          name: t.name,
          color: t.color,
          isComputer: t.isComputer,
        })),
      },
    })

    console.log(`[GAMES_API] ✅ GAME CREATED SUCCESSFULLY: ${game.gameCode} (ID: ${game.id})`)
  } catch (error) {
    console.error('[GAMES_API] ❌ Error creating game:', error)
    res.status(500).json({ success: false, error: 'Failed to create game' })
  }
})

// Educator login with game code and PIN
router.post('/login', async (req, res) => {
  try {
    const { gameCode, gamePin } = req.body

    if (!gameCode) {
      return res.status(400).json({ success: false, error: 'Game code is required' })
    }

    if (!gamePin) {
      return res.status(400).json({ success: false, error: 'Game PIN is required' })
    }

    const game = await prisma.game.findUnique({
      where: { gameCode: gameCode.toUpperCase() },
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
      return res.status(404).json({ success: false, error: 'Game not found' })
    }

    // Verify PIN
    if (game.gamePin !== gamePin) {
      return res.status(401).json({ success: false, error: 'Invalid PIN' })
    }

    const sessionId = createSession({ role: 'educator', gameId: game.id })
    res.cookie(SESSION_COOKIE_BY_ROLE.educator, sessionId, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 1000 * 60 * 60 * 24 * 7,
    })



    res.json({
      success: true,
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
        marketDemandMode: game.marketDemandMode,
        marketDemandMultiplier: game.marketDemandMultiplier,
        regionDemandSplit: game.regionDemandSplit,
        scenarioSequence: game.scenarioSequence,
        gameConfig: game.gameConfig,
        teams: game.teams,
      },
    })
  } catch (error) {
    console.error('Error logging in:', error)
    res.status(500).json({ success: false, error: 'Failed to login' })
  }
})

// Get game by code (for joining) - kept for backwards compatibility but deprecated
router.get('/code/:gameCode', async (req, res) => {
  try {
    const game = await prisma.game.findUnique({
      where: { gameCode: req.params.gameCode.toUpperCase() },
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
      return res.status(404).json({ success: false, error: 'Game not found' })
    }

    res.json({
      success: true,
      game: {
        id: game.id,
        gameCode: game.gameCode,
        name: game.name,
        status: game.status,
        companyName: game.companyName,
        industry: game.industry,
        totalRounds: game.totalRounds,
        currentRound: game.currentRound,
        regionLabels: game.regionLabels,
        marketDemandMode: game.marketDemandMode,
        marketDemandMultiplier: game.marketDemandMultiplier,
        gameConfig: game.gameConfig,
        teams: game.teams,
      },
    })
  } catch (error) {
    console.error('Error fetching game:', error)
    res.status(500).json({ success: false, error: 'Failed to fetch game' })
  }
})

// Get full game state (for educator/admin)
router.get('/:gameId', async (req, res) => {
  try {
    // await finalizeRoundIfDeadlinePassed(req.params.gameId)
    const mode = String(req.query.mode || 'full').toLowerCase()
    const game = mode === 'lite'
      ? await prisma.game.findUnique({
        where: { id: req.params.gameId },
        select: {
          id: true,
          status: true,
          currentRound: true,
          teams: {
            orderBy: { displayOrder: 'asc' },
            select: {
              isComputer: true,
              decisions: {
                orderBy: { roundNumber: 'desc' },
                select: {
                  roundNumber: true,
                  isSubmitted: true,
                },
              },
            },
          },
        },
      })
      : await prisma.game.findUnique({
        where: { id: req.params.gameId },
        include: {
          teams: {
            orderBy: { displayOrder: 'asc' },
            include: {
              gameStates: {
                orderBy: { roundNumber: 'desc' },
                take: 1,
              },
              decisions: {
                orderBy: { roundNumber: 'desc' },
              },
              results: {
                orderBy: { roundNumber: 'desc' },
              },
            },
          },
          rounds: {
            orderBy: { roundNumber: 'asc' },
          },
        },
      })



    if (!game) {
      return res.status(404).json({ success: false, error: 'Game not found' })
    }

    res.json({ success: true, game })
  } catch (error) {
    console.error('Error fetching game:', error)
    res.status(500).json({ success: false, error: 'Failed to fetch game' })
  }
})

// Start game (transition from SETUP to ACTIVE)
router.post('/:gameId/start', async (req, res) => {
  try {
    const game = await prisma.game.findUnique({
      where: { id: req.params.gameId },
      include: { teams: true },
    })



    if (!game) {
      return res.status(404).json({ success: false, error: 'Game not found' })
    }

    if (game.status !== 'SETUP') {
      return res.status(400).json({ success: false, error: 'Game already started' })
    }

    // Calculate deadline if hoursPerRound is set
    let roundDeadline = null
    if (game.hoursPerRound) {
      roundDeadline = new Date(Date.now() + game.hoursPerRound * 60 * 60 * 1000)
    }

    const scenarioId = game.scenarioSequence[0] ?? 0

    // Start the game and create initial decisions for all teams
    await prisma.$transaction(async (tx) => {
      // Update game status
      await tx.game.update({
        where: { id: game.id },
        data: {
          status: 'ACTIVE',
          startedAt: new Date(),
          roundDeadline,
        },
      })



      // Update round status
      await tx.round.update({
        where: {
          gameId_roundNumber: {
            gameId: game.id,
            roundNumber: 0,
          },
        },
        data: {
          status: 'ACTIVE',
          startedAt: new Date(),
          deadline: roundDeadline,
        },
      })



      const gameConfig = resolveGameConfig(game)

      // Create default decisions for all teams
      for (const team of game.teams) {
        let decisions
        if (team.isComputer && team.aiProfile) {
          // Use smart AI engine with personality
          const aiProfile = team.aiProfile as unknown as AIProfile
          const aiDecision = generateInitialAIDecision(
            aiProfile,
            scenarioId,
            game.totalRounds,
            gameConfig
          )
          decisions = aiDecision
        } else if (team.isComputer) {
          // Fallback for AI without profile
          decisions = generateAIDecisionForDb(scenarioId, gameConfig)
        } else {
          // Human team - use defaults
          decisions = getDefaultDecisionForDb(gameConfig)
        }

        await tx.decision.upsert({
          where: {
            teamId_roundNumber: {
              teamId: team.id,
              roundNumber: 0,
            },
          },
          update: {
            ...decisions,
            isSubmitted: team.isComputer, // AI teams auto-submit
            submittedAt: team.isComputer ? new Date() : null,
          },
          create: {
            teamId: team.id,
            roundNumber: 0,
            ...decisions,
            isSubmitted: team.isComputer,
            submittedAt: team.isComputer ? new Date() : null,
          },
        })
      }
    }, {
      timeout: 20000 // 20 seconds - needed for games with many teams
    })



    res.json({ success: true, game: { ...game, status: 'ACTIVE' } })
  } catch (error) {
    console.error('Error starting game:', error)
    res.status(500).json({ success: false, error: 'Failed to start game' })
  }
})

// Archive a game
router.post('/:gameId/archive', async (req, res) => {
  try {
    const { gameId } = req.params
    const educatorSessionId = getSessionCookie(req, 'educator')
    const educatorSession = getSession(educatorSessionId)
    const adminSessionId = getSessionCookie(req, 'admin')
    const adminSession = getSession(adminSessionId)

    if (!educatorSession && !adminSession) {
      return res.status(401).json({ success: false, message: 'Unauthorized' })
    }

    if (adminSession?.role === 'admin') {
      // Admins can archive unknown game.
    } else if (educatorSession?.role === 'educator') {
      // Check ownership
      const link = await prisma.educatorGame.findFirst({
        where: {
          educatorId: educatorSession.educatorId,
          gameId
        }
      })

      if (!link) {
        return res.status(403).json({ success: false, message: 'Not authorized for this game' })
      }
    }

    const game = await prisma.game.update({
      where: { id: gameId },
      data: { status: 'COMPLETED' }
    })



    res.json({ success: true, game })
  } catch (err) {
    console.error('Failed to archive game:', err)
    const msg = err instanceof Error ? err.message : 'Failed to archive game'
    res.status(500).json({ success: false, message: msg })
  }
})

// Unarchive game (RESTORE)
router.post('/:gameId/unarchive', async (req, res) => {
  try {
    const { gameId } = req.params
    // Simple authentication check based on session cookie (similar to others)
    const sessionId = getSessionCookie(req, 'educator')
    const educatorSession = getSession(sessionId)
    if (!educatorSession || !educatorSession.educatorId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' })
    }

    // Verify ownership
    const link = await prisma.educatorGame.findUnique({
      where: {
        educatorId_gameId: {
          educatorId: educatorSession.educatorId,
          gameId
        }
      }
    })



    if (!link) {
      return res.status(403).json({ success: false, message: 'Not authorized for this game' })
    }

    const game = await prisma.game.update({
      where: { id: gameId },
      data: { status: 'ACTIVE' }
    })



    res.json({ success: true, game })
  } catch (err) {
    console.error('Failed to unarchive game:', err)
    const msg = err instanceof Error ? err.message : 'Failed to unarchive game'
    res.status(500).json({ success: false, message: msg })
  }
})

// Advance to next round
router.post('/:gameId/advance', async (req, res) => {
  const gameId = req.params.gameId
  if (activeAdvanceLocks.has(gameId)) {
    console.warn(`[advance] Game ${gameId} advance already in progress; rejecting duplicate request.`)
    return res.status(409).json({
      success: false,
      error: 'Round advance already in progress for this game. Please retry in a few seconds.',
    })
  }
  activeAdvanceLocks.add(gameId)
  try {
    const game = await prisma.game.findUnique({
      where: { id: gameId },
      include: {
        rounds: true,
        teams: {
          include: {
            decisions: {
              orderBy: { roundNumber: 'desc' },
            },
            gameStates: {
              orderBy: { roundNumber: 'desc' },
              take: 1,
            },
          },
        },
      },
    })



    if (!game) {
      return res.status(404).json({ success: false, error: 'Game not found' })
    }

    const currentRoundRecord = game.rounds.find((round) => round.roundNumber === game.currentRound)
    const hasActiveRound = currentRoundRecord?.status === 'ACTIVE'

    if (game.status !== 'ACTIVE') {
      if (hasActiveRound) {
        await prisma.game.update({
          where: { id: game.id },
          data: { status: 'ACTIVE' },
        })
        game.status = 'ACTIVE'
      } else {
        return res.status(400).json({
          success: false,
          error: `Game is not active (status: ${game.status})`,
        })
      }
    }

    // CRITICAL: Check if all human teams have submitted their decisions for current round
    const currentRound = game.currentRound
    const humanTeams = game.teams.filter((t: unknown) => !t.isComputer)
    const unsubmittedTeams: string[] = []

    for (const team of humanTeams) {
      const decision = team.decisions.find((d: unknown) => d.roundNumber === currentRound)
      if (!decision || !decision.isSubmitted) {
        unsubmittedTeams.push(team.name)
      }
    }

    // Allow override with force=true query param (for testing/admin)
    const forceAdvance = req.query.force === 'true'

    if (unsubmittedTeams.length > 0 && !forceAdvance) {
      console.warn(`[advance] Cannot advance: ${unsubmittedTeams.length} human teams have not submitted for Round ${currentRound}: ${unsubmittedTeams.join(', ')} `)
      return res.status(400).json({
        success: false,
        error: `Cannot advance round: ${unsubmittedTeams.length} team(s) have not submitted their decisions`,
        unsubmittedTeams,
        hint: 'All human teams must submit their decisions before advancing. Use ?force=true to override (will use default decisions for unsubmitted teams).'
      })
    }

    if (forceAdvance && unsubmittedTeams.length > 0) {
      console.warn(`[advance] Force advancing despite ${unsubmittedTeams.length} unsubmitted teams: ${unsubmittedTeams.join(', ')} `)
    }

    const existingResults = await prisma.teamRoundResult.findFirst({
      where: {
        gameId: game.id,
        roundNumber: currentRound,
      },
      select: { id: true },
    })



    if (!existingResults) {
      await calculateAndPersistRound(game, currentRound)
    }

    const nextRound = game.currentRound + 1

    if (nextRound > game.totalRounds) {
      // Game complete
      await prisma.game.update({
        where: { id: game.id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
        },
      })



      return res.json({ success: true, completed: true })
    }

    // Calculate deadline
    let roundDeadline = null
    if (game.hoursPerRound) {
      roundDeadline = new Date(Date.now() + game.hoursPerRound * 60 * 60 * 1000)
    }

    // Get scenario for this round
    const scenarioId = game.scenarioSequence[nextRound] ?? 0

    // Update game and create/update round
    await prisma.$transaction(async (tx) => {
      // Mark current round as completed
      await tx.round.update({
        where: {
          gameId_roundNumber: {
            gameId: game.id,
            roundNumber: game.currentRound,
          },
        },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
        },
      })



      // Create or update next round
      await tx.round.upsert({
        where: {
          gameId_roundNumber: {
            gameId: game.id,
            roundNumber: nextRound,
          },
        },
        update: {
          status: 'ACTIVE',
          startedAt: new Date(),
          deadline: roundDeadline,
        },
        create: {
          gameId: game.id,
          roundNumber: nextRound,
          status: 'ACTIVE',
          scenarioId,
          startedAt: new Date(),
          deadline: roundDeadline,
        },
      })



      // Update game
      await tx.game.update({
        where: { id: game.id },
        data: {
          currentRound: nextRound,
          roundDeadline,
        },
      })



      const gameConfig = resolveGameConfig(game)

      // Pre-populate decisions for next round
      for (const team of game.teams) {
        const existingDecision = await tx.decision.findUnique({
          where: {
            teamId_roundNumber: {
              teamId: team.id,
              roundNumber: nextRound,
            },
          },
        })



        if (existingDecision) {
          continue
        }

        let decisions
        if (team.isComputer && team.aiProfile) {
          const prevRoundNumber = nextRound === 1 ? -1 : nextRound - 1
          const prevState = await tx.gameState.findUnique({
            where: {
              teamId_roundNumber: {
                teamId: team.id,
                roundNumber: prevRoundNumber,
              },
            },
          })
          // SINGLE SOURCE OF TRUTH: Use getBalancedStartingFinancials for fallback values
          const startingFinancials = getBalancedStartingFinancials(gameConfig)
          const baseInventoryUS = prevState?.inventoryUS ?? 0
          const baseInventoryAsia = prevState?.inventoryAsia ?? 0
          const totalInventory = prevState?.inventory ?? 0
          const inventoryUS = (baseInventoryUS === 0 && baseInventoryAsia === 0) ? totalInventory : baseInventoryUS
          const inventoryAsia = (baseInventoryUS === 0 && baseInventoryAsia === 0) ? 0 : baseInventoryAsia
          const gameContext = {
            round: nextRound,
            totalRounds: game.totalRounds,
            scenarioId,
            currentState: {
              cash: prevState?.cashBalance ?? startingFinancials.startingCash,
              debt: prevState?.longTermDebt ?? startingFinancials.startingDebt,
              factories: {
                us: prevState?.factoriesUS ?? gameConfig.initialFactories.us,
                asia: prevState?.factoriesAsia ?? gameConfig.initialFactories.asia,
              },
              inventory: {
                us: inventoryUS,
                asia: inventoryAsia,
              },
              techLevel: prevState?.unlockedTechLevel ?? 1,
              unlockedFeatures: prevState?.unlockedFeatures ?? 0,
              brandReputation: prevState?.brandReputation ?? 50,
            },
          }
          const aiProfile = team.aiProfile as unknown as AIProfile
          decisions = generateSmartAIDecision(aiProfile, gameContext, gameConfig)
        } else if (team.isComputer) {
          decisions = generateAIDecisionForDb(scenarioId, gameConfig)
        } else {
          if (nextRound >= 2) {
            const prevDecision = await tx.decision.findUnique({
              where: {
                teamId_roundNumber: {
                  teamId: team.id,
                  roundNumber: nextRound - 1,
                },
              },
            })
            if (prevDecision) {
              decisions = {
                production: prevDecision.production ?? undefined,
                hr: prevDecision.hr ?? undefined,
                rnd: prevDecision.rnd ?? undefined,
                investment: prevDecision.investment ? {
                  ...(prevDecision.investment as unknown),
                  newPlantsUS: 0,
                  newPlantsAsia: 0,
                } : undefined,
                logistics: prevDecision.logistics ?? undefined,
                marketing: prevDecision.marketing ?? undefined,
                finance: prevDecision.finance ? {
                  ...(prevDecision.finance as unknown),
                  borrowing: 0,
                  repayment: 0,
                  dividend: 0,
                  shareIssue: 0,
                  shareBuyback: 0,
                  newPlantsUS: 0,
                  newPlantsAsia: 0,
                } : undefined,
              }
            } else {
              decisions = getDefaultDecisionForDb(gameConfig)
            }
          } else {
            decisions = getDefaultDecisionForDb(gameConfig)
          }
        }

        await tx.decision.create({
          data: {
            teamId: team.id,
            roundNumber: nextRound,
            ...decisions,
            isSubmitted: team.isComputer,
            submittedAt: team.isComputer ? new Date() : null,
          },
        })
      }
    }, {
      timeout: 20000 // 20 seconds - needed for games with many teams
    })



    res.json({ success: true, currentRound: nextRound })
  } catch (error) {
    console.error('Error advancing round:', error)
    res.status(500).json({ success: false, error: 'Failed to advance round' })
  } finally {
    activeAdvanceLocks.delete(gameId)
  }
})

// Calculate round results
router.post('/:gameId/calculate-round', async (req, res) => {
  try {
    const game = await prisma.game.findUnique({
      where: { id: req.params.gameId },
      include: {
        teams: {
          include: {
            decisions: {
              orderBy: { roundNumber: 'desc' },
            },
            gameStates: {
              orderBy: { roundNumber: 'desc' },
              take: 1,
            },
          },
        },
      },
    })



    if (!game) {
      return res.status(404).json({ success: false, error: 'Game not found' })
    }

    const currentRoundRecord = await prisma.round.findUnique({
      where: {
        gameId_roundNumber: {
          gameId: game.id,
          roundNumber: game.currentRound,
        },
      },
      select: { status: true },
    })
    const hasActiveRound = currentRoundRecord?.status === 'ACTIVE'

    if (game.status !== 'ACTIVE') {
      if (hasActiveRound) {
        await prisma.game.update({
          where: { id: game.id },
          data: { status: 'ACTIVE' },
        })
        game.status = 'ACTIVE'
      } else {
        return res.status(400).json({
          success: false,
          error: `Game is not active (status: ${game.status})`,
        })
      }
    }

    const currentRound = game.currentRound

    const results = await calculateAndPersistRound(game, currentRound)

    res.json({
      success: true,
      results: {
        round: results.round,
        marketDemand: results.marketDemand,
        teams: results.teams.map((t, i) => ({
          teamId: game.teams[i].id,
          teamName: t.teamName,
          rank: calculateRank(results.teams, i),
          sharePrice: t.kpis.sharePrice,
          tsr: t.kpis.tsr,
          revenue: t.pnl.revenue,
          netProfit: t.pnl.netProfit,
        })),
        winner: results.winner,
      },
    })
  } catch (error) {
    console.error('Error calculating round:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const errorStack = error instanceof Error ? error.stack : ''
    console.error('Stack trace:', errorStack)
    res.status(500).json({
      success: false,
      error: `Failed to calculate round: ${errorMessage} `,
      details: errorStack
    })
  }
})

export async function calculateAndPersistRound(game: unknown, currentRound: number) {
  const persistKey = `${game.id}:${currentRound}`
  if (activeRoundPersistLocks.has(persistKey)) {
    console.warn(`[calculateAndPersistRound] Round ${currentRound} for game ${game.id} is already persisting; skipping duplicate call.`)
    return { round: currentRound, teams: [], marketDemand: {} }
  }
  activeRoundPersistLocks.add(persistKey)
  try {
    // Check if results already exist to prevent race conditions from concurrent requests
    const existingCheck = await prisma.teamRoundResult.findFirst({
      where: {
        gameId: game.id,
        roundNumber: currentRound,
      },
      select: { id: true },
    })

    if (existingCheck) {
      console.log(`[calculateAndPersistRound] Results already exist for round ${currentRound}, skipping duplicate calculation`)
      // Return empty results object to indicate completion without recalculation
      return { round: currentRound, teams: [], marketDemand: {} }
    }

  const prevRoundResultsMap = new Map<string, unknown>()
  // For state accumulation (inventory, cash, factories, balance sheet):
  // - Round 0 (trial): Use round -1 TeamRoundResult (calculated starting position)
  // - Round 1: Use round -1 TeamRoundResult (trial resets, start from calculated position)
  // - Round 2+: Use previous round's TeamRoundResult for state accumulation
  // NOTE: Round -1 TeamRoundResult is created by calculateRoundMinus1() during freeze
  const prevRoundForResults = currentRound <= 1 ? -1 : currentRound - 1
  const prevResults = await prisma.teamRoundResult.findMany({
    where: { gameId: game.id, roundNumber: prevRoundForResults },
    select: { teamId: true, fullResults: true },
  })
  prevResults.forEach((row) => {
    prevRoundResultsMap.set(row.teamId, row.fullResults)
  })
  console.log(`[calculateAndPersistRound] Round ${currentRound}: Loaded ${prevResults.length} TeamRoundResult(s) from round ${prevRoundForResults}`)

  // CRITICAL FIX: Fetch fresh decisions directly from DB to avoid stale data
  // The game.teams.decisions may be stale if user submitted after the game was fetched
  const freshDecisions = await prisma.decision.findMany({
    where: {
      teamId: { in: game.teams.map((t: unknown) => t.id) },
      roundNumber: currentRound,
    },
  })
  const freshDecisionMap = new Map<string, unknown>()
  freshDecisions.forEach((decision) => {
    freshDecisionMap.set(decision.teamId, decision)
  })
  // For game state accumulation (factories, inventory, cash, debt):
  // - Round 0 (trial): Use round -1 (starting state)
  // - Round 1: Use round -1 (starting state). Trial does NOT carry into Round 1.
  // - Round 2+: Use previous round's state
  const prevRoundNumber = currentRound <= 1 ? -1 : currentRound - 1
  const prevStates = await prisma.gameState.findMany({
    where: {
      teamId: { in: game.teams.map((t: unknown) => t.id) },
      roundNumber: prevRoundNumber,
    },
  })
  const prevStateMap = new Map<string, unknown>()
  prevStates.forEach((state) => {
    prevStateMap.set(state.teamId, state)
  })

  const gameConfig = resolveGameConfig(game)
  const teamIds = game.teams.map((t: unknown) => t.id)
  const teamStates: TeamState[] = []
  const previousGameStates = new Map<number, TeamGameState>()
  const pendingDecisionWrites: Array<{
    teamId: string
    roundNumber: number
    data: unknown
  }> = []
  const prevDecisionMap = new Map<string, unknown>()
  if (currentRound > 1) {
    const prevDecisions = await prisma.decision.findMany({
      where: {
        teamId: { in: teamIds },
        roundNumber: currentRound - 1,
      },
      select: {
        teamId: true,
        production: true,
        hr: true,
        rnd: true,
        investment: true,
        logistics: true,
        marketing: true,
        finance: true,
      },
    })
    prevDecisions.forEach((prev) => {
      prevDecisionMap.set(prev.teamId, prev)
    })
  }

  for (let i = 0; i < game.teams.length; i++) {
    const team = game.teams[i]
    // Use fresh decision from DB, not stale data from game object
    const decision = freshDecisionMap.get(team.id)
    const prevState = prevStateMap.get(team.id)
    const usePrevState = prevState

    let teamDecisions: EngineTeamDecisions
    if (decision) {
      // Log decision source for debugging
      const isSubmitted = decision.isSubmitted
      const hasProduction = decision.production?.usUnits !== undefined || decision.production?.asiaUnits !== undefined
      console.log(`[calculateAndPersistRound] Team ${team.name} Round ${currentRound}: Using DB decision(submitted = ${isSubmitted}, hasProduction = ${hasProduction}, usUnits = ${decision.production?.usUnits}, outsourceUS = ${decision.production?.outsourceUS})`)

      if (!team.isComputer && !isSubmitted) {
        console.warn(`[calculateAndPersistRound] WARNING: Human team ${team.name} has NOT submitted their decision for Round ${currentRound}! Using their draft /default values.`)
      }

      teamDecisions = transformDecisionFromDb(decision, gameConfig, true) as EngineTeamDecisions
    } else if (team.isComputer && team.aiProfile) {
      const scenarioId = game.scenarioSequence[currentRound] ?? 0
      // SINGLE SOURCE OF TRUTH: Use getBalancedStartingFinancials for fallback values
      const startingFinancials = getBalancedStartingFinancials(gameConfig)
      const baseInventoryUS = usePrevState?.inventoryUS ?? 0
      const baseInventoryAsia = usePrevState?.inventoryAsia ?? 0
      const totalInventory = usePrevState?.inventory ?? 0
      const inventoryUS = (baseInventoryUS === 0 && baseInventoryAsia === 0) ? totalInventory : baseInventoryUS
      const inventoryAsia = (baseInventoryUS === 0 && baseInventoryAsia === 0) ? 0 : baseInventoryAsia
      const gameContext = {
        round: currentRound,
        totalRounds: game.totalRounds,
        scenarioId,
        currentState: {
          cash: usePrevState?.cashBalance || startingFinancials.startingCash,
          debt: usePrevState?.longTermDebt || startingFinancials.startingDebt,
          factories: {
            us: usePrevState?.factoriesUS || gameConfig.initialFactories.us,
            asia: usePrevState?.factoriesAsia || gameConfig.initialFactories.asia,
          },
          inventory: {
            us: inventoryUS,
            asia: inventoryAsia,
          },
          techLevel: usePrevState?.unlockedTechLevel || 1,
          unlockedFeatures: usePrevState?.unlockedFeatures || 0,
          brandReputation: usePrevState?.brandReputation || 50,
        },
      }
      const aiProfile = team.aiProfile as unknown as AIProfile
      const aiDecision = generateSmartAIDecision(aiProfile, gameContext, gameConfig)
      teamDecisions = transformDecisionFromDb(aiDecision, gameConfig) as EngineTeamDecisions
      pendingDecisionWrites.push({
        teamId: team.id,
        roundNumber: currentRound,
        data: aiDecision,
      })
    } else if (team.isComputer) {
      const scenarioId = game.scenarioSequence[currentRound] ?? 0
      const aiDecision = generateAIDecisionForDb(scenarioId, gameConfig)
      teamDecisions = transformDecisionFromDb(aiDecision, gameConfig) as EngineTeamDecisions
      pendingDecisionWrites.push({
        teamId: team.id,
        roundNumber: currentRound,
        data: aiDecision,
      })
    } else {
      // No decision found at all - this should be rare (only if decision record wasn't created)
      if (!team.isComputer && currentRound > 1) {
        const prevDecision = prevDecisionMap.get(team.id)
        if (prevDecision) {
          console.warn(`[calculateAndPersistRound] WARNING: Human team ${team.name} missing decision for Round ${currentRound}. Carrying forward Round ${currentRound - 1} with one-time actions reset.`)
          const carryForward = {
            production: prevDecision.production ?? undefined,
            hr: prevDecision.hr ?? undefined,
            rnd: prevDecision.rnd ?? undefined,
            investment: prevDecision.investment ?? undefined,
            logistics: prevDecision.logistics ?? undefined,
            marketing: prevDecision.marketing ?? undefined,
            finance: prevDecision.finance ?? undefined,
          } as unknown
          if (carryForward.investment) {
            carryForward.investment = {
              ...carryForward.investment,
              newPlantsUS: 0,
              newPlantsAsia: 0,
            }
          }
          if (carryForward.finance) {
            carryForward.finance = {
              ...carryForward.finance,
              borrowing: 0,
              repayment: 0,
              shareIssue: 0,
              shareBuyback: 0,
              dividend: 0,
              newPlantsUS: 0,
              newPlantsAsia: 0,
              longTermDebt: 0,
              shareIssuance: 0,
              dividends: 0,
            }
          }
          teamDecisions = transformDecisionFromDb(carryForward, gameConfig, true) as EngineTeamDecisions
          pendingDecisionWrites.push({
            teamId: team.id,
            roundNumber: currentRound,
            data: carryForward,
          })
        } else {
          console.error(`[calculateAndPersistRound] ERROR: No decision history found for team ${team.name} for Round ${currentRound}! Using engine defaults.`)
          teamDecisions = getDefaultDecisions(gameConfig) as EngineTeamDecisions
        }
      } else {
        console.error(`[calculateAndPersistRound] ERROR: No decision found for team ${team.name}(isComputer = ${team.isComputer}) for Round ${currentRound}! Using engine defaults.`)
        teamDecisions = getDefaultDecisions(gameConfig) as EngineTeamDecisions
      }
    }

    teamStates.push({
      id: i,
      name: team.name,
      decisions: teamDecisions,
    })



    if (usePrevState) {
      let state: TeamGameState
      if (prevRoundResultsMap.has(team.id)) {
        // Round 2+: Use TeamRoundResult as SOURCE OF TRUTH for ending state
        state = transformGameStateFromResults(prevRoundResultsMap.get(team.id), gameConfig) as TeamGameState
        state.previousRoundResults = prevRoundResultsMap.get(team.id)
        console.log(`[calculateAndPersistRound] Team ${team.name} using TeamRoundResult (Round ${currentRound - 1}) as source`)
        console.log(`[FACTORY DEBUG] Team ${team.name} Round ${currentRound}: Loaded pendingInvestments from TeamRoundResult:`, JSON.stringify(state.pendingInvestments))
      } else {
        // Round 0/1: Use GameState (round -1 starting position)
        state = transformGameStateFromDb(usePrevState, gameConfig) as TeamGameState
        console.log(`[calculateAndPersistRound] Team ${team.name} using GameState (Round ${prevRoundNumber}) as source`)
        console.log(`[FACTORY DEBUG] Team ${team.name} Round ${currentRound}: Loaded pendingInvestments from GameState:`, JSON.stringify(state.pendingInvestments))
        console.log(`[FACTORY DEBUG] Raw DB pendingInvestments:`, JSON.stringify(usePrevState.pendingInvestments))
      }
      previousGameStates.set(i, state)
    } else if (prevRoundResultsMap.has(team.id)) {
      console.warn(`[calculateAndPersistRound] Team ${team.name} missing gameState for Round ${prevRoundNumber}, using fullResults fallback.`)
      const state = transformGameStateFromResults(prevRoundResultsMap.get(team.id), gameConfig) as TeamGameState
      previousGameStates.set(i, state)
    } else {
      console.warn(`[calculateAndPersistRound] Team ${team.name} has NO prevState for Round ${prevRoundNumber}.Using initial state.`)
      previousGameStates.set(i, createInitialGameState(gameConfig))
    }
  }

  const results = calculateRound(
    teamStates,
    currentRound,
    previousGameStates,
    game.scenarioSequence,
    game.marketDemandMultiplier ?? 1,
    gameConfig,
    game.regionDemandSplit as { us: number; asia: number; europe: number } | undefined,
    game.taxLossCarryforwardEnabled ?? false
  )
  const scenarioId = game.scenarioSequence?.[currentRound] ?? 0
  const scenarioSnapshot = SCENARIOS[scenarioId] ?? SCENARIOS[0]
  const roundEffects = getScenarioEffectsForRound(currentRound, game.scenarioSequence)
  const activeInterestRate = Math.max(0, gameConfig.financial.interestRate + (roundEffects?.interestRateSpread ?? 0))

  await prisma.$transaction(async (tx) => {
    for (const pending of pendingDecisionWrites) {
      await tx.decision.upsert({
        where: {
          teamId_roundNumber: {
            teamId: pending.teamId,
            roundNumber: pending.roundNumber,
          },
        },
        update: {
          ...pending.data,
          isSubmitted: true,
          submittedAt: new Date(),
        },
        create: {
          teamId: pending.teamId,
          roundNumber: pending.roundNumber,
          ...pending.data,
          isSubmitted: true,
          submittedAt: new Date(),
        },
      })
    }

    for (let i = 0; i < results.teams.length; i++) {
      const teamResult = results.teams[i]
      const dbTeam = game.teams[i]

      // Log what we are about to save for critical accumulation fields
      console.log(`[calculateAndPersistRound] Saving Round ${currentRound} for Team ${dbTeam.name}: Factories = ${teamResult.gameState.factories.us}, Inventory = ${teamResult.gameState.inventory}, PendingInvestments = ${teamResult.gameState.pendingInvestments.length} `)

      const unitCostSnapshot = teamResult.decisions ? calculateUnitCost(
        teamResult.decisions,
        teamResult.gameState,
        teamResult.capacity,
        gameConfig
      ).finalUnitCost * (roundEffects?.costInflation ?? 1) : 26
      const previousMarketDemand = prevRoundResultsMap.get(dbTeam.id)?.marketDemand ?? null
      const activeTaxRate = getEffectiveTaxRate(teamResult.sales, roundEffects, gameConfig)
      const investmentCostMultiplier = roundEffects?.investmentCostMultiplier ?? 1
      const costInflation = roundEffects?.costInflation ?? 1
      const workingCapitalDelta = roundEffects?.workingCapitalDelta ?? { inventory: 0, receivable: 0, payable: 0 }

      const fullResultsToSave = {
        ...teamResult,
        marketDemand: results.marketDemand,
        scenarioSnapshot,
        unitCost: unitCostSnapshot,
        activeInterestRate,
        activeTaxRate,
        previousMarketDemand,
        capacityPerPlantUsed: game.capacityPerFactory ?? gameConfig.capacityPerPlant,
        plantCostUSUsed: gameConfig.investment?.plantCostUS ?? 0,
        plantCostAsiaUsed: gameConfig.investment?.plantCostAsia ?? 0,
        investmentCostMultiplierUsed: investmentCostMultiplier,
        costInflationUsed: costInflation,
        workingCapitalDeltaUsed: workingCapitalDelta,
      }
      await tx.teamRoundResult.upsert({
        where: {
          teamId_roundNumber: {
            teamId: dbTeam.id,
            roundNumber: currentRound,
          },
        },
        update: {
          rank: calculateRank(results.teams, i),
          fullResults: fullResultsToSave as unknown,
        },
        create: {
          gameId: game.id,
          roundNumber: currentRound,
          rank: calculateRank(results.teams, i),
          fullResults: fullResultsToSave as unknown,
          team: { connect: { id: dbTeam.id } },
        },
      })



      // Save game state for ALL rounds including Round 0 (trial)
      // This is critical for state accumulation (factories, debt, inventory, etc.)
      await tx.gameState.upsert({
        where: {
          teamId_roundNumber: {
            teamId: dbTeam.id,
            roundNumber: currentRound,
          },
        },
        update: {
          factoriesUS: teamResult.gameState.factories.us,
          factoriesAsia: teamResult.gameState.factories.asia,
          pendingInvestments: teamResult.gameState.pendingInvestments as unknown,
          unlockedTechLevel: teamResult.gameState.rndProgress.unlockedTechLevel,
          unlockedFeatures: teamResult.gameState.rndProgress.unlockedFeatureCount,
          cumulativeResearchHours: teamResult.gameState.rndProgress.cumulativeResearchHours,
          brandReputation: isNaN(teamResult.gameState.brandReputation) ? 50 : teamResult.gameState.brandReputation,
          inventory: teamResult.gameState.inventory || 0,
          inventoryUS: teamResult.gameState.inventoryUS || 0,
          inventoryAsia: teamResult.gameState.inventoryAsia || 0,
          taxLossCarryforward: isNaN(teamResult.gameState.taxLossCarryforward ?? 0) ? 0 : (teamResult.gameState.taxLossCarryforward ?? 0),
          cashBalance: teamResult.balanceSheet.cash,
          longTermDebt: teamResult.balanceSheet.longTermDebt,
          shareCapital: teamResult.balanceSheet.shareCapital,
          retainedEarnings: teamResult.balanceSheet.retainedEarnings,
        },
        create: {
          team: { connect: { id: dbTeam.id } },
          roundNumber: currentRound,
          factoriesUS: teamResult.gameState.factories.us,
          factoriesAsia: teamResult.gameState.factories.asia,
          pendingInvestments: teamResult.gameState.pendingInvestments as unknown,
          unlockedTechLevel: teamResult.gameState.rndProgress.unlockedTechLevel,
          unlockedFeatures: teamResult.gameState.rndProgress.unlockedFeatureCount,
          cumulativeResearchHours: teamResult.gameState.rndProgress.cumulativeResearchHours,
          brandReputation: isNaN(teamResult.gameState.brandReputation) ? 50 : teamResult.gameState.brandReputation,
          inventory: teamResult.gameState.inventory || 0,
          inventoryUS: teamResult.gameState.inventoryUS || 0,
          inventoryAsia: teamResult.gameState.inventoryAsia || 0,
          taxLossCarryforward: isNaN(teamResult.gameState.taxLossCarryforward ?? 0) ? 0 : (teamResult.gameState.taxLossCarryforward ?? 0),
          cashBalance: teamResult.balanceSheet.cash,
          longTermDebt: teamResult.balanceSheet.longTermDebt,
          shareCapital: teamResult.balanceSheet.shareCapital,
          retainedEarnings: teamResult.balanceSheet.retainedEarnings,
        },
      })
    }

    const roundScenarioId = game.scenarioSequence?.[currentRound] ?? 0
    await tx.round.upsert({
      where: {
        gameId_roundNumber: {
          gameId: game.id,
          roundNumber: currentRound,
        },
      },
      update: {
        marketDemand: results.marketDemand as unknown,
      },
      create: {
        gameId: game.id,
        roundNumber: currentRound,
        status: 'COMPLETED',
        scenarioId: roundScenarioId,
        completedAt: new Date(),
        marketDemand: results.marketDemand as unknown,
      },
    })
  }, {
    timeout: 20000 // 20 seconds - needed for games with many teams
  })

  invalidateResultsCache(game.id)
    return results
  } finally {
    activeRoundPersistLocks.delete(persistKey)
  }
}

export async function finalizeRoundIfDeadlinePassed(gameId: string) {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: {
      teams: {
        orderBy: { displayOrder: 'asc' },
        include: {
          decisions: { orderBy: { roundNumber: 'desc' } },
        },
      },
    },
  })

  if (!game || game.status !== 'ACTIVE' || !game.roundDeadline) {
    return
  }

  const deadlineMs = new Date(game.roundDeadline).getTime()
  if (Number.isNaN(deadlineMs) || Date.now() < deadlineMs) {
    return
  }

  const currentRound = game.currentRound
  const round = await prisma.round.findUnique({
    where: {
      gameId_roundNumber: {
        gameId: game.id,
        roundNumber: currentRound,
      },
    },
  })

  if (round?.status === 'COMPLETED') {
    return
  }

  await prisma.$transaction(async (tx) => {
    await tx.decision.updateMany({
      where: {
        teamId: { in: game.teams.map((team) => team.id) },
        roundNumber: currentRound,
      },
      data: {
        isSubmitted: true,
        isLocked: true,
        submittedAt: new Date(),
      },
    })



      await tx.round.upsert({
        where: {
          gameId_roundNumber: {
            gameId: game.id,
            roundNumber: currentRound,
          },
        },
        update: {
          status: 'COMPLETED',
          completedAt: new Date(),
        },
        create: {
          gameId: game.id,
          roundNumber: currentRound,
          status: 'COMPLETED',
          scenarioId: game.scenarioSequence?.[currentRound] ?? 0,
          completedAt: new Date(),
        },
      })
  })

  const existingResults = await prisma.teamRoundResult.findFirst({
    where: {
      gameId: game.id,
      roundNumber: currentRound,
    },
    select: { id: true },
  })

  if (!existingResults) {
    await calculateAndPersistRound(game, currentRound)
  }

  const nextRound = currentRound + 1
  if (nextRound > game.totalRounds) {
    await prisma.game.update({
      where: { id: game.id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    })
    return
  }

  let roundDeadline = null
  if (game.hoursPerRound) {
    roundDeadline = new Date(Date.now() + game.hoursPerRound * 60 * 60 * 1000)
  }
  const nextScenarioId = game.scenarioSequence?.[nextRound] ?? 0

  await prisma.$transaction(async (tx) => {
    await tx.round.upsert({
      where: {
        gameId_roundNumber: {
          gameId: game.id,
          roundNumber: nextRound,
        },
      },
      update: {
        status: 'ACTIVE',
        startedAt: new Date(),
        deadline: roundDeadline,
      },
      create: {
        gameId: game.id,
        roundNumber: nextRound,
        status: 'ACTIVE',
        scenarioId: nextScenarioId,
        startedAt: new Date(),
        deadline: roundDeadline,
      },
    })

    await tx.game.update({
      where: { id: game.id },
      data: {
        currentRound: nextRound,
        roundDeadline,
      },
    })

    const gameConfig = resolveGameConfig(game)

    for (const team of game.teams) {
      const existingDecision = await tx.decision.findUnique({
        where: {
          teamId_roundNumber: {
            teamId: team.id,
            roundNumber: nextRound,
          },
        },
      })

      if (existingDecision) {
        continue
      }

      let decisions
      if (team.isComputer && team.aiProfile) {
        const prevRoundNumber = nextRound === 1 ? -1 : nextRound - 1
        const prevState = await tx.gameState.findUnique({
          where: {
            teamId_roundNumber: {
              teamId: team.id,
              roundNumber: prevRoundNumber,
            },
          },
        })
        const startingFinancials = getBalancedStartingFinancials(gameConfig)
        const baseInventoryUS = prevState?.inventoryUS ?? 0
        const baseInventoryAsia = prevState?.inventoryAsia ?? 0
        const totalInventory = prevState?.inventory ?? 0
        const inventoryUS = (baseInventoryUS === 0 && baseInventoryAsia === 0) ? totalInventory : baseInventoryUS
        const inventoryAsia = (baseInventoryUS === 0 && baseInventoryAsia === 0) ? 0 : baseInventoryAsia
        const gameContext = {
          round: nextRound,
          totalRounds: game.totalRounds,
          scenarioId: nextScenarioId,
          currentState: {
            cash: prevState?.cashBalance ?? startingFinancials.startingCash,
            debt: prevState?.longTermDebt ?? startingFinancials.startingDebt,
            factories: {
              us: prevState?.factoriesUS ?? gameConfig.initialFactories.us,
              asia: prevState?.factoriesAsia ?? gameConfig.initialFactories.asia,
            },
            inventory: {
              us: inventoryUS,
              asia: inventoryAsia,
            },
            techLevel: prevState?.unlockedTechLevel ?? 1,
            unlockedFeatures: prevState?.unlockedFeatures ?? 0,
            brandReputation: prevState?.brandReputation ?? 50,
          },
        }
        const aiProfile = team.aiProfile as unknown as AIProfile
        decisions = generateSmartAIDecision(aiProfile, gameContext, gameConfig)
      } else if (team.isComputer) {
        decisions = generateAIDecisionForDb(nextScenarioId, gameConfig)
      } else {
        if (nextRound >= 2) {
          const prevDecision = await tx.decision.findUnique({
            where: {
              teamId_roundNumber: {
                teamId: team.id,
                roundNumber: nextRound - 1,
              },
            },
          })
          if (prevDecision) {
            decisions = {
              production: prevDecision.production ?? undefined,
              hr: prevDecision.hr ?? undefined,
              rnd: prevDecision.rnd ?? undefined,
              investment: prevDecision.investment ? {
                ...(prevDecision.investment as unknown),
                newPlantsUS: 0,
                newPlantsAsia: 0,
              } : undefined,
              logistics: prevDecision.logistics ?? undefined,
              marketing: prevDecision.marketing ?? undefined,
              finance: prevDecision.finance ? {
                ...(prevDecision.finance as unknown),
                borrowing: 0,
                repayment: 0,
                dividend: 0,
                shareIssue: 0,
                shareBuyback: 0,
                newPlantsUS: 0,
                newPlantsAsia: 0,
              } : undefined,
            }
          } else {
            decisions = getDefaultDecisionForDb(gameConfig)
          }
        } else {
          decisions = getDefaultDecisionForDb(gameConfig)
        }
      }

      await tx.decision.create({
        data: {
          teamId: team.id,
          roundNumber: nextRound,
          ...decisions,
          isSubmitted: team.isComputer,
          submittedAt: team.isComputer ? new Date() : null,
        },
      })
    }
  }, {
    timeout: 20000 // 20 seconds - needed for games with many teams
  })
}

export default router

