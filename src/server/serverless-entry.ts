/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import 'dotenv/config'
import express from 'express'
import compression from 'compression'
import cors from 'cors'
import gamesRouter from './routes/games.js'
import teamsRouter from './routes/teams.js'
import adminRouter from './routes/admin.js'
import authRouter from './routes/auth.js'
import educatorRouter from './routes/educator.js'
import publicRouter from './routes/public.js'
import tournamentsRouter from './routes/tournaments.js'
import educatorMiniGamesRouter from './minigames/educatorRouter.js'
import publicMiniGamesRouter from './minigames/publicRouter.js'
import { transferMetricsMiddleware } from './transferMetrics.js'

const app = express()

// Middleware
app.use(compression())
app.use(cors({ origin: true, credentials: true }))
app.use(express.json())
app.use(transferMetricsMiddleware)

// Routes - with /api prefix for Vercel serverless
app.use('/api/games', gamesRouter)
app.use('/api/teams', teamsRouter)
app.use('/api/modlab', adminRouter)
app.use('/api/auth', authRouter)
app.use('/api/educator', educatorRouter)
app.use('/api/educator/minigames', educatorMiniGamesRouter)
app.use('/api/tournaments', tournamentsRouter)
app.use('/api/public', publicRouter)
app.use('/api/minigames', publicMiniGamesRouter)

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Export for Vercel serverless
export default app
