import 'dotenv/config'
import express from 'express'
import compression from 'compression'
import cors from 'cors'
import gamesRouter from './routes/games'
import teamsRouter from './routes/teams'
import adminRouter from './routes/admin'
import authRouter from './routes/auth'
import educatorRouter from './routes/educator'
import publicRouter from './routes/public'
import educatorMiniGamesRouter from './minigames/educatorRouter'
import publicMiniGamesRouter from './minigames/publicRouter'
import { transferMetricsMiddleware } from './transferMetrics'

import tournamentsRouter from './routes/tournaments'

const app = express()
const PORT = process.env.PORT || 3001

// Middleware
app.use(compression())
app.use(cors({ origin: true, credentials: true }))
app.use(express.json())
app.use(transferMetricsMiddleware)

// Routes
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
  void req
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Start server only in development (not in Vercel serverless)
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`)
  })
}

// Export for Vercel serverless
export default app
