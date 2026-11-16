import { Router } from 'express'
import educatorMiniGamesRouter from '../routes/educatorMinigames'

const router = Router()

// Educator-only mini-game orchestration APIs.
router.use('/', educatorMiniGamesRouter)

export default router

