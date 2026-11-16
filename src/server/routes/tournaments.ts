import { Router } from 'express'
import type { NextFunction, Request, Response } from 'express'
import type { Prisma } from '@prisma/client'
import { prisma } from '../db'
import { getSessionCookie, getSession } from '../sessionStore'
import {
    generateGameCode,
    generateTeamCode,
    generatePin,
    generateScenarioSequence,
    TEAM_COLORS,
    getDefaultGameState
} from '../utils'
import {
    calculateRoundMinus1,
    SCENARIOS,
} from '../../engine/gameEngine'
import { getDefaultDecisionForDb, calculateRank } from '../../utils/mappings'
import { resolveGameConfig } from '../utils/configResolver'

const router = Router()
type EducatorRequest = Request & { educatorId?: string }

function requireEducator(req: EducatorRequest, res: Response, next: NextFunction) {
    const sessionId = getSessionCookie(req, 'educator')
    const session = getSession(sessionId)
    if (!session || session.role !== 'educator' || !session.educatorId) {
        return res.status(401).json({ success: false, error: 'Unauthorized' })
    }
    req.educatorId = session.educatorId
    next()
}

// Internal helper to create a game within a transaction
async function createTournamentGame(
    tx: Prisma.TransactionClient,
    gameName: string,
    educatorId: string,
    teamsConfig: Array<{ name: string; isAI: boolean }>,
    config?: {
        industry?: string
        totalRounds?: number
        hoursPerRound?: number | null
    }
) {
    const industry = config?.industry || 'Electronics & Technology'
    const totalRounds = config?.totalRounds || 3
    const hoursPerRound = config?.hoursPerRound ?? null

    const gameConfig = resolveGameConfig({ industry })
    const gameConfigSnapshot = JSON.parse(JSON.stringify(gameConfig))

    // 1. Create Game
    let gameCode = generateGameCode()
    // Simple retry for uniqueness
    let attempts = 0
    while (await tx.game.findUnique({ where: { gameCode } }) && attempts < 5) {
        gameCode = generateGameCode()
        attempts++
    }

    const gamePin = generatePin()

    // Calculate deadline if hoursPerRound is set (for both game.roundDeadline and round.deadline)
    const roundDeadline = hoursPerRound
        ? new Date(Date.now() + hoursPerRound * 60 * 60 * 1000)
        : null

    const newGame = await tx.game.create({
        data: {
            gameCode,
            gamePin,
            name: gameName,
            status: 'ACTIVE',
            companyName: 'TechCorp',
            industry,
            totalRounds,
            hoursPerRound,
            roundDeadline,
            scenarioSequence: generateScenarioSequence(totalRounds),
            startingCash: gameConfig.financial.startingCash,
            startingFactoriesUS: gameConfig.initialFactories.us,
            startingFactoriesAsia: gameConfig.initialFactories.asia,
            capacityPerFactory: gameConfig.capacityPerPlant,
            gameConfig: gameConfigSnapshot as unknown,
            taxLossCarryforwardEnabled: true,
            currentRound: 0,
            marketDemandMode: 'balanced',
            marketDemandMultiplier: 1.0,
            timezone: 'Pacific/Auckland'
        }
    })

    // 2. Link Educator
    await tx.educatorGame.create({
        data: { educatorId, gameId: newGame.id }
    })

    // 3. Create Teams
    const teams = []
    for (let i = 0; i < teamsConfig.length; i++) {
        const tConf = teamsConfig[i]
        const teamName = tConf.name
        const teamCode = generateTeamCode(teamName)
        const teamPin = generatePin()

        const team = await tx.team.create({
            data: {
                gameId: newGame.id,
                teamCode,
                teamPin,
                name: teamName,
                color: TEAM_COLORS[i % TEAM_COLORS.length],
                isComputer: tConf.isAI,
                displayOrder: i
            }
        })

        // Initial State (Round -1)
        await tx.gameState.create({
            data: {
                teamId: team.id,
                roundNumber: -1,
                ...getDefaultGameState(gameConfig)
            }
        })

        teams.push(team)
    }

    // 4. Create Round 0
    // Use the roundDeadline calculated earlier
    await tx.round.create({
        data: {
            gameId: newGame.id,
            roundNumber: 0,
            status: 'ACTIVE',
            scenarioId: newGame.scenarioSequence[0],
            startedAt: new Date(),
            deadline: roundDeadline
        }
    })

    // 5. Default Decisions for Round 0
    const defaultDecisions = getDefaultDecisionForDb(gameConfig)
    for (const team of teams) {
        await tx.decision.create({
            data: {
                teamId: team.id,
                roundNumber: 0,
                ...defaultDecisions,
                isSubmitted: team.isComputer
            }
        })
    }

    // 6. Generate Round -1 Results (Starting History)
    const roundMinus1Results = calculateRoundMinus1(
        teams.length,
        gameConfig,
        newGame.scenarioSequence,
        1.0,
        undefined
    )

    // Calculate basics for -1
    // const startingSharePrice = gameConfig.financial.startingSharePrice

    for (let i = 0; i < roundMinus1Results.teams.length; i++) {
        const result = roundMinus1Results.teams[i]
        const dbTeam = teams[i]

        // Construct full results object
        const fullResults = {
            ...result,
            marketDemand: roundMinus1Results.marketDemand,
            unitCost: 26, // Approximation or calculated
            activeInterestRate: gameConfig.financial.interestRate,
            activeTaxRate: 0.25,
            scenarioSnapshot: SCENARIOS[0]
        }

        await tx.teamRoundResult.create({
            data: {
                gameId: newGame.id,
                teamId: dbTeam.id,
                roundNumber: -1,
                rank: calculateRank(roundMinus1Results.teams, i),
                fullResults: fullResults as unknown
            }
        })
    }

    return newGame
}

// GET /api/tournaments - List tournaments for educator
router.get('/', requireEducator, async (req: EducatorRequest, res: Response) => {
    try {
        const tournaments = await prisma.tournament.findMany({
            where: { educatorId: req.educatorId },
            include: {
                games: {
                    include: {
                        game: {
                            select: {
                                id: true,
                                name: true,
                                status: true,
                                currentRound: true,
                                totalRounds: true,
                                hoursPerRound: true,
                                rounds: {
                                    select: {
                                        roundNumber: true,
                                        startedAt: true
                                    }
                                },
                                teams: {
                                    select: {
                                        id: true,
                                        name: true,
                                        teamCode: true,
                                        teamPin: true,
                                        isComputer: true,
                                        color: true,
                                        decisions: {
                                            select: {
                                                roundNumber: true,
                                                isSubmitted: true
                                            }
                                        },
                                        results: {
                                            orderBy: { roundNumber: 'desc' },
                                            take: 1,
                                            select: { rank: true }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        })
        res.json({ success: true, tournaments })
    } catch (err) {
        console.error('Error listing tournaments:', err)
        res.status(500).json({ success: false, error: 'Failed to list tournaments' })
    }
})

// POST /api/tournaments - Create new tournament
router.post('/', requireEducator, async (req: EducatorRequest, res: Response) => {
    try {
        const { name, teamNames, industry, totalRounds, hoursPerRound } = req.body
        // teamNames is now Array<{ name: string; isAI: boolean }>
        if (!name || !teamNames || !Array.isArray(teamNames) || teamNames.length !== 16) {
            return res.status(400).json({ success: false, error: 'Tournament name and exactly 16 team names are required.' })
        }

        // Check credits
        const educator = await prisma.educator.findUnique({
            where: { id: req.educatorId }
        })

        if (!educator) return res.status(404).json({ success: false, error: 'Educator not found' })

        // Tournament requires 4 games + 1 final = 5 credits
        if (educator.credits < 5) {
            return res.status(403).json({ success: false, error: 'Insufficient credits. Tournaments require 5 game credits (4 groups + 1 final).' })
        }

        const groups = ['Group A', 'Group B', 'Group C', 'Group D']

        // Shuffle helper function
        const shuffleArray = <T,>(array: T[]): T[] => {
            const shuffled = [...array]
            for (let i = shuffled.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
            }
            return shuffled
        }

        // Shuffle team names to randomize group assignments
        const shuffledTeamNames = shuffleArray(teamNames)

        // Game configuration
        const gameConfig = {
            industry,
            totalRounds,
            hoursPerRound
        }

        // Create everything in a transaction
        const tournament = await prisma.$transaction(async (tx) => {
            // 0. Deduct credits
            await tx.educator.update({
                where: { id: req.educatorId },
                data: { credits: { decrement: 5 } }
            })

            // 1. Create Tournament container
            const t = await tx.tournament.create({
                data: {
                    name,
                    educatorId: req.educatorId,
                    status: 'ACTIVE'
                }
            })

            // 2. Create 4 Games
            for (let i = 0; i < 4; i++) {
                const groupName = groups[i]
                const groupTeams = shuffledTeamNames.slice(i * 4, (i * 4) + 4)

                const gameName = `${name} - ${groupName}`
                const game = await createTournamentGame(tx, gameName, req.educatorId, groupTeams, gameConfig)

                // Link
                await tx.tournamentGame.create({
                    data: {
                        tournamentId: t.id,
                        gameId: game.id,
                        groupName,
                        isFinal: false
                    }
                })
            }

            return t
        })

        res.json({ success: true, tournament })

    } catch (err) {
        console.error('Error creating tournament:', err)
        res.status(500).json({ success: false, error: 'Failed to create tournament' })
    }
})

// POST /api/tournaments/:id/create-final - Create final game from winners
router.post('/:id/create-final', requireEducator, async (req: EducatorRequest, res: Response) => {
    try {
        const { id } = req.params

        // Fetch tournament games
        const tournamentGames = await prisma.tournamentGame.findMany({
            where: { tournamentId: id },
            include: {
                game: {
                    include: {
                        teams: {
                            include: {
                                results: {
                                    orderBy: { roundNumber: 'desc' },
                                    take: 1
                                }
                            }
                        }
                    }
                }
            }
        })

        // Verify we have 4 groups and they are finished?
        // Or at least we can determine a winner.
        // We need 1 winner from each of the 4 groups.

        const winners: string[] = []
        const groups = tournamentGames.filter(tg => !tg.isFinal)

        if (groups.length < 4) {
            return res.status(400).json({ success: false, error: 'Tournament does not have 4 groups.' })
        }

        for (const tg of groups) {
            // Find winner based on last result rank
            const teams = tg.game.teams
            // Sort by rank of last round
            const sorted = [...teams].sort((a, b) => {
                const rankA = a.results[0]?.rank ?? 99
                const rankB = b.results[0]?.rank ?? 99
                return rankA - rankB
            })

            if (sorted.length > 0) {
                winners.push(sorted[0].name)
            }
        }

        if (winners.length !== 4) {
            return res.status(400).json({ success: false, error: 'Could not determine 4 winners.' })
        }

        // Create Final Game
        const tournamentData = await prisma.tournament.findUnique({ where: { id } })
        if (!tournamentData) return res.status(404).json({ success: false, error: 'Tournament not found' })

        await prisma.$transaction(async (tx) => {
            const gameName = `${tournamentData.name} - Final`

            // Get settings from the first group game to use for the final
            const firstGroupGame = groups[0]?.game
            const gameConfig = firstGroupGame ? {
                industry: firstGroupGame.industry,
                totalRounds: firstGroupGame.totalRounds,
                hoursPerRound: firstGroupGame.hoursPerRound
            } : undefined

            const game = await createTournamentGame(tx, gameName, req.educatorId, winners.map(w => ({ name: w, isAI: false })), gameConfig)

            await tx.tournamentGame.create({
                data: {
                    tournamentId: id,
                    gameId: game.id,
                    groupName: 'Final',
                    isFinal: true
                }
            })

            // Update tournament status? Optional.
        })

        res.json({ success: true, message: 'Final game created' })

    } catch (err) {
        console.error('Error creating final:', err)
        res.status(500).json({ success: false, error: 'Failed to create final game' })
    }
})

// POST /api/tournaments/:id/archive
router.post('/:id/archive', requireEducator, async (req: EducatorRequest, res: Response) => {
    try {
        await prisma.$transaction(async (tx) => {
            // Archive the tournament
            await tx.tournament.update({
                where: { id: req.params.id },
                data: { status: 'ARCHIVED' }
            })

            // Find all games in this tournament
            const tournamentGames = await tx.tournamentGame.findMany({
                where: { tournamentId: req.params.id },
                select: { gameId: true }
            })

            if (tournamentGames.length > 0) {
                const gameIds = tournamentGames.map(tg => tg.gameId)
                // Archive all associated games
                await tx.game.updateMany({
                    where: { id: { in: gameIds } },
                    data: { status: 'ARCHIVED' }
                })
            }
        })
        res.json({ success: true })
    } catch (err) {
        console.error('Archive error:', err)
        res.status(500).json({ success: false, error: 'Failed to archive' })
    }
})

// POST /api/tournaments/:id/unarchive
router.post('/:id/unarchive', requireEducator, async (req: EducatorRequest, res: Response) => {
    try {
        await prisma.$transaction(async (tx) => {
            // Unarchive the tournament
            await tx.tournament.update({
                where: { id: req.params.id },
                data: { status: 'ACTIVE' }
            })

            // Find all games in this tournament
            const tournamentGames = await tx.tournamentGame.findMany({
                where: { tournamentId: req.params.id },
                select: { gameId: true }
            })

            // Unarchive all associated games (restore to ACTIVE if they were ARCHIVED)
            // Note: If a game was COMPLETED, we might want to keep it as COMPLETED?
            // For now, let's restore to ACTIVE to allow continued play/viewing, 
            // or maybe we should check if they were completed?
            // A simple approach is to set them to ACTIVE, but maybe better to only unarchive?
            // If the game logic handles completed state via round count, setting status to ACTIVE is generally safe 
            // as it just makes it visible and playable if rounds remain.
            // However, if a game finished, it might be better to check.
            // But 'ARCHIVED' is usually a separate status from 'COMPLETED'.
            // Let's just set to ACTIVE for now as 'Unarchive' implies 'bring back to active list'.

            if (tournamentGames.length > 0) {
                const gameIds = tournamentGames.map(tg => tg.gameId)
                await tx.game.updateMany({
                    where: { id: { in: gameIds } },
                    data: { status: 'ACTIVE' }
                })
            }
        })
        res.json({ success: true })
    } catch (err) {
        console.error('Unarchive error:', err)
        res.status(500).json({ success: false, error: 'Failed to unarchive' })
    }
})

export default router
