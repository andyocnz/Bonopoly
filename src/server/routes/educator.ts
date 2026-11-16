import { Router } from 'express'
import type { NextFunction, Request, Response } from 'express'
import { prisma } from '../db'
import { getSessionCookie, getSession } from '../sessionStore'

const router = Router()
type EducatorRequest = Request & { educatorId?: string }

// Middleware to require educator authentication
function requireEducator(req: EducatorRequest, res: Response, next: NextFunction) {
    const sessionId = getSessionCookie(req, 'educator')
    const session = getSession(sessionId)

    if (!session || session.role !== 'educator' || !session.educatorId) {
        return res.status(401).json({ success: false, error: 'Unauthorized' })
    }

    req.educatorId = session.educatorId
    next()
}

// List educator's games
router.get('/games', requireEducator, async (req: EducatorRequest, res: Response) => {
    try {
        const educatorGames = await prisma.educatorGame.findMany({
            where: { educatorId: req.educatorId },
            include: {
                game: {
                    include: {
                        teams: {
                            select: {
                                id: true,
                                name: true,
                                teamCode: true,
                                teamPin: true,
                                color: true,
                                isComputer: true,
                                decisions: {
                                    select: { isSubmitted: true, roundNumber: true },
                                    orderBy: { roundNumber: 'desc' },
                                    take: 1
                                },
                                results: {
                                    select: {
                                        roundNumber: true,
                                        rank: true,
                                        createdAt: true,
                                    },
                                    orderBy: { roundNumber: 'desc' },
                                }
                            },
                        },
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        })

        const games = educatorGames.map((eg) => eg.game)
        res.json({ success: true, games })
    } catch (error) {
        console.error('Error listing educator games:', error)
        res.status(500).json({ success: false, error: 'Failed to list games' })
    }
})

// Get full results for a specific game (on-demand, for financial report)
router.get('/games/:gameId/results', requireEducator, async (req: EducatorRequest, res: Response) => {
    try {
        // Verify educator owns this game
        const link = await prisma.educatorGame.findFirst({
            where: { educatorId: req.educatorId, gameId: req.params.gameId },
        })
        if (!link) {
            return res.status(403).json({ success: false, error: 'Game not found' })
        }

        const results = await prisma.teamRoundResult.findMany({
            where: { gameId: req.params.gameId },
            select: {
                roundNumber: true,
                rank: true,
                fullResults: true,
                createdAt: true,
                team: { select: { id: true, name: true } },
            },
            orderBy: [{ roundNumber: 'asc' }, { rank: 'asc' }],
        })

        res.json({ success: true, results })
    } catch (error) {
        console.error('Error fetching game results:', error)
        res.status(500).json({ success: false, error: 'Failed to fetch results' })
    }
})

// Add existing game to educator's list
router.post('/games/add', requireEducator, async (req: EducatorRequest, res: Response) => {
    try {
        const { gameCode, gamePin } = req.body

        const educator = await prisma.educator.findUnique({
            where: { id: req.educatorId },
            select: { credits: true },
        })

        if (!educator) {
            return res.status(404).json({ success: false, error: 'Educator not found' })
        }

        if (!gameCode || !gamePin) {
            return res.status(400).json({ success: false, error: 'Game code and PIN required' })
        }

        // Find game and verify PIN
        const game = await prisma.game.findUnique({
            where: { gameCode: gameCode.toUpperCase() },
        })

        if (!game) {
            return res.status(404).json({ success: false, error: 'Game not found' })
        }

        if (game.gamePin !== gamePin) {
            return res.status(401).json({ success: false, error: 'Invalid game PIN' })
        }

        // Check if already added
        const existing = await prisma.educatorGame.findUnique({
            where: {
                educatorId_gameId: {
                    educatorId: req.educatorId,
                    gameId: game.id,
                },
            },
        })

        if (existing) {
            return res.json({ success: true, message: 'Game already in your list', credits: educator.credits })
        }

        // Add game to educator's list
        await prisma.educatorGame.create({
            data: {
                educatorId: req.educatorId,
                gameId: game.id,
            },
        })

        res.json({ success: true, message: 'Game added successfully', credits: educator.credits })
    } catch (error) {
        console.error('Error adding game:', error)
        res.status(500).json({ success: false, error: 'Failed to add game' })
    }
})

// Update educator's PIN
router.put('/pin', requireEducator, async (req: EducatorRequest, res: Response) => {
    try {
        const { newPin } = req.body

        if (!newPin || newPin.length < 4) {
            return res.status(400).json({ success: false, error: 'PIN must be at least 4 characters' })
        }

        await prisma.educator.update({
            where: { id: req.educatorId },
            data: { pin: newPin },
        })

        res.json({ success: true, message: 'PIN updated successfully' })
    } catch (error) {
        console.error('Error updating PIN:', error)
        res.status(500).json({ success: false, error: 'Failed to update PIN' })
    }
})

export default router
