/**
 * Demo Game Page
 *
 * Automatically creates a quick demo game with preset configuration:
 * - 3 rounds
 * - 1 human player + 3 AI opponents
 * - Automotive industry
 * - Random AI difficulty
 */

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authApi, educatorApi, gameApi, teamApi } from '../api/client'
import { useGame } from '../context/GameContext'
import demoConfig from '../../demo-config.json'

type DemoLoginResult = Awaited<ReturnType<typeof teamApi.login>>
type DemoCreationWindow = Window & {
  __demoGameCreationPromise?: Promise<DemoLoginResult> | null
  demoAutoCalculatorInterval?: ReturnType<typeof setInterval>
}

type DemoLiteDecision = {
  roundNumber: number
  isSubmitted?: boolean
}

type DemoLiteTeam = {
  isComputer?: boolean
  decisions?: DemoLiteDecision[]
}

type DemoLiteGame = {
  status?: string
  currentRound?: number
  teams?: DemoLiteTeam[]
}

function getDemoCreationPromise() {
  return (window as DemoCreationWindow).__demoGameCreationPromise ?? null
}

function setDemoCreationPromise(promise: Promise<DemoLoginResult> | null) {
  ; (window as DemoCreationWindow).__demoGameCreationPromise = promise
}

/**
 * Background auto-calculator for demo games
 * Monitors game status and auto-advances rounds when all human teams submit
 */
function startDemoAutoCalculator(gameId: string) {
  const existingInterval = (window as DemoCreationWindow).demoAutoCalculatorInterval
  if (existingInterval) {
    console.log('[DemoAutoCalc] Auto-calculator already running:', existingInterval)
    return
  }

  const checkInterval = 30000 // Check every 30 seconds

  console.log(`[DemoAutoCalc] Starting auto-calculator for game ${gameId}`)

  const intervalId = setInterval(async () => {
    if (document.visibilityState !== 'visible') return

    try {
      const response = await gameApi.get(gameId, { mode: 'lite' })
      const game = response.game as DemoLiteGame | undefined
      console.log(`[DemoAutoCalc] Poll - Game ${gameId}, Round ${game?.currentRound}, Status: ${game?.status}`)

      // Stop if game is completed
      if (String(game?.status || '').toUpperCase() === 'COMPLETED') {
        console.log(`[DemoAutoCalc] Game completed, stopping auto-calculator`)
        clearInterval(intervalId)
        ; (window as DemoCreationWindow).demoAutoCalculatorInterval = undefined
        return
      }

      // Check if game is active and all human teams have submitted
      if (game?.status === 'ACTIVE' && game?.teams) {
        const teams = game.teams || []
        const humanTeams = teams.filter((t: DemoLiteTeam) => !t.isComputer)
        const aiTeams = teams.filter((t: DemoLiteTeam) => t.isComputer)

        // Check if each human team has submitted for the current round
        const submittedHumans = humanTeams.filter((t: DemoLiteTeam) => {
          const currentDecision = t.decisions?.find((d: DemoLiteDecision) => d.roundNumber === game.currentRound)
          return currentDecision?.isSubmitted === true
        })

        console.log(`[DemoAutoCalc] Teams - Human: ${humanTeams.length}, AI: ${aiTeams.length}, Submitted: ${submittedHumans.length}`)

        // Only auto-advance if exactly 1 human player and rest are AI
        const isOneHumanVsAI = humanTeams.length === 1 && aiTeams.length > 0

        console.log(`[DemoAutoCalc] Is 1v AI: ${isOneHumanVsAI}, All submitted: ${submittedHumans.length >= humanTeams.length}`)

        // If this is 1 human vs AI AND human has submitted, auto-advance
        if (isOneHumanVsAI && submittedHumans.length >= humanTeams.length) {
          try {
            console.log(`[DemoAutoCalc] Triggering advance for game ${gameId}, round ${game?.currentRound}`)
            await gameApi.advance(gameId)
            console.log(`[DemoAutoCalc] ✅ Advanced from round ${game?.currentRound} for game ${gameId}`)
          } catch (err) {
            console.error('[DemoAutoCalc] ❌ Auto-advance failed:', err)
          }
        }
      }
    } catch (err) {
      console.error('[DemoAutoCalc] ⚠️ Demo auto-calculator error:', err)
      // Don't clear interval - keep trying
    }
  }, checkInterval)

    // Store interval ID so we can clean it up later if needed
    ; (window as DemoCreationWindow).demoAutoCalculatorInterval = intervalId
  console.log(`[DemoAutoCalc] Interval ID stored:`, intervalId)
}

async function createDemoGameOnce(): Promise<DemoLoginResult> {
  const existingPromise = getDemoCreationPromise()
  if (existingPromise) {
    console.log('[DemoGamePage] ⚠️ Demo game creation already in progress, reusing existing promise')
    return existingPromise
  }

  const demoCreationPromise = (async () => {
    let educatorSessionActive = false
    try {
      const session = await authApi.me('educator')
      educatorSessionActive = Boolean(session?.success && session?.role === 'educator')
    } catch {
      educatorSessionActive = false
    }

    // Check if user already has a demo game stored in localStorage
    const storedDemoCredentials = localStorage.getItem('demoGameCredentials')
    if (storedDemoCredentials) {
      try {
        const { teamCode, teamPin, gameCode, gamePin } = JSON.parse(storedDemoCredentials)
        // Legacy credential blobs may not include game code/pin.
        // If educator is logged in, require these so we can ensure the game is linked to their dashboard.
        if (educatorSessionActive && (!gameCode || !gamePin)) {
          console.log('[DemoGamePage] Legacy demo credentials without game PIN/code; creating a fresh linked demo game...')
          localStorage.removeItem('demoGameCredentials')
        } else {
          console.log('[DemoGamePage] Found existing demo game, attempting to reuse...')

          const loginResult = await teamApi.login(teamCode, teamPin)

          if (loginResult && loginResult.game && loginResult.team) {
            const status = String(loginResult.game.status || '').toUpperCase()
            const isStaleGame = status === 'COMPLETED' || status === 'ARCHIVED'
            if (isStaleGame) {
              console.log('[DemoGamePage] Stored demo game is stale, creating a fresh one...')
              localStorage.removeItem('demoGameCredentials')
            } else {
              console.log('[DemoGamePage] Reused existing demo game')

              // Restore demo mode flags
              sessionStorage.setItem('demoMode', 'true')
              sessionStorage.setItem('autoAdvance', 'true')
              sessionStorage.setItem('demoGameId', String(loginResult.game.id))
              sessionStorage.setItem('lastDemoGameId', String(loginResult.game.id))

              // Start auto-calculator if needed
              const config = demoConfig.demoGame
              if (config.autoAdvance) {
                startDemoAutoCalculator(loginResult.game.id)
              }

              if (educatorSessionActive && gameCode && gamePin) {
                try {
                  await educatorApi.addExistingGame(gameCode, gamePin)
                } catch (linkErr) {
                  console.warn('[DemoGamePage] Could not auto-link reused demo game to educator dashboard', linkErr)
                }
              }

              return loginResult
            }
          } else {
            console.log('[DemoGamePage] Existing demo game invalid, creating new one...')
            localStorage.removeItem('demoGameCredentials')
          }
        }
      } catch (err) {
        console.log('[DemoGamePage] ⚠️ Failed to reuse existing demo game, creating new one...', err)
        localStorage.removeItem('demoGameCredentials')
      }
    }

    console.log('[DemoGamePage] ✅ Starting new demo game creation')

    // Set creation timestamp before creating game for diagnostics/race prevention.
    sessionStorage.setItem('lastDemoCreationTime', String(Date.now()))
    const config = demoConfig.demoGame

    // Check if demo is disabled
    if (!config.enabled) {
      throw new Error('Demo mode is currently disabled. Please contact support for access.')
    }

    // Create game with demo configuration
    console.log('[DemoGamePage] 🔨 Calling gameApi.create...')
    const result = await gameApi.create({
      name: 'Demo Game',
      companyName: 'Demo Company',
      industry: config.industry,
      totalRounds: config.rounds,
      hoursPerRound: 1, // Quick 1-hour rounds for demo
      teams: config.teamNames.map((name, index) => ({
        name,
        isAI: index > 0, // First team is human, rest are AI
        aiDifficulty: index === 0 ? undefined :
          config.aiDifficultyOptions[Math.floor(Math.random() * config.aiDifficultyOptions.length)] as 'easy' | 'medium' | 'hard'
      }))
    })
    console.log('[DemoGamePage] ✅ gameApi.create completed:', result.game?.gameCode)

    if (!result || !result.game) {
      throw new Error('Failed to create demo game')
    }

    // Auto-login as first team (human player)
    const firstTeam = result.game.teams[0]
    if (!firstTeam) {
      throw new Error('No teams created')
    }

    const loginResult = await teamApi.login(firstTeam.teamCode, firstTeam.teamPin)

    if (!loginResult || !loginResult.game || !loginResult.team) {
      throw new Error('Failed to login to demo game')
    }

    // Store demo credentials in localStorage for future reuse
    localStorage.setItem('demoGameCredentials', JSON.stringify({
      teamCode: firstTeam.teamCode,
      teamPin: firstTeam.teamPin,
      gameCode: result.game.gameCode,
      gamePin: result.game.gamePin,
    }))
    console.log('[DemoGamePage] 💾 Stored demo game credentials in localStorage')

    // Store demo mode flags in session
    sessionStorage.setItem('demoMode', 'true')
    sessionStorage.setItem('autoAdvance', String(config.autoAdvance))
    sessionStorage.setItem('demoGameId', String(loginResult.game.id))
    sessionStorage.setItem('lastDemoGameId', String(loginResult.game.id))
    console.log('[DemoGamePage] 💾 Stored game ID in session:', loginResult.game.id)

    // Start background auto-calculator for demo game
    if (config.autoAdvance) {
      startDemoAutoCalculator(loginResult.game.id)
    }

    return loginResult
  })()

  // Acquire in-flight lock immediately so concurrent calls reuse this promise.
  setDemoCreationPromise(demoCreationPromise)

  try {
    return await demoCreationPromise
  } finally {
    if (getDemoCreationPromise() === demoCreationPromise) {
      setDemoCreationPromise(null)
    }
  }
}
export default function DemoGamePage() {
  const navigate = useNavigate()
  const { game, team, setGame, setTeam } = useGame()
  const [status, setStatus] = useState<'creating' | 'ready' | 'error'>('creating')
  const [error, setError] = useState<string | null>(null)
  const [gameData, setGameData] = useState<DemoLoginResult | null>(null)

  useEffect(() => {
    console.log('[DemoGamePage] 🚀 useEffect triggered')
    let isActive = true

    const runDemoSetup = async () => {
      try {
        if (!isActive) return

        // If already in a demo game (context already set), show the ready screen instead of creating new game
        if (game && team && sessionStorage.getItem('demoMode') === 'true') {
          console.log('[DemoGamePage] Already in demo game, showing ready screen...')
          setGameData({ game, team })
          setStatus('ready')
          return
        }

        console.log('[DemoGamePage] 📞 Calling createDemoGameOnce...')
        setStatus('creating')

        const loginResult = await createDemoGameOnce()
        if (!isActive) return

        console.log('[DemoGamePage] ✅ Demo game created successfully, ready to start!')
        setGameData(loginResult)
        setStatus('ready')
      } catch (err) {
        if (!isActive) return
        console.error('Demo game creation error:', err)
        setStatus('error')
        setError(err instanceof Error ? err.message : 'Failed to create demo game')
      }
    }

    runDemoSetup()
    return () => {
      isActive = false
    }
  }, [navigate, setGame, setTeam, game, team])

  const handleStartPlaying = () => {
    if (gameData) {
      setGame(gameData.game)
      setTeam(gameData.team)
      navigate('/mission')
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #0f172a 0%, #020617 100%)',
      color: '#f8fafc',
      fontFamily: 'var(--font-family, inherit)'
    }}>
      <div style={{
        maxWidth: '500px',
        padding: '3rem',
        background: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '1.5rem',
        textAlign: 'center'
      }}>
        {status === 'creating' && (
          <>
            <div style={{
              width: '60px',
              height: '60px',
              border: '4px solid rgba(14, 165, 233, 0.3)',
              borderTopColor: '#0ea5e9',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 2rem'
            }} />
            <h1 style={{
              fontSize: '1.5rem',
              fontWeight: '700',
              marginBottom: '1rem',
              color: '#0ea5e9'
            }}>
              Creating Your Demo Game...
            </h1>
            <p style={{ color: '#94a3b8', fontSize: '0.875rem' }}>
              Setting up 3-round demo with AI opponents
            </p>
          </>
        )}

        {status === 'ready' && (
          <>
            <div style={{
              width: '60px',
              height: '60px',
              background: '#10b981',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 2rem',
              fontSize: '2rem'
            }}>
              ✓
            </div>
            <h1 style={{
              fontSize: '1.5rem',
              fontWeight: '700',
              marginBottom: '1rem',
              color: '#10b981'
            }}>
              Demo Game Ready!
            </h1>
            <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginBottom: '2rem' }}>
              Your game has been created with 3 AI opponents. Ready to start playing?
            </p>
            <button
              onClick={handleStartPlaying}
              style={{
                padding: '0.75rem 2rem',
                background: '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '0.5rem',
                fontWeight: '600',
                cursor: 'pointer',
                fontSize: '1rem',
                transition: 'all 0.2s'
              }}
              onMouseOver={(e) => e.currentTarget.style.background = '#059669'}
              onMouseOut={(e) => e.currentTarget.style.background = '#10b981'}
            >
              Start Playing
            </button>
          </>
        )}

        {status === 'error' && (
          <>
            <div style={{
              width: '60px',
              height: '60px',
              background: '#ef4444',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 2rem',
              fontSize: '2rem'
            }}>
              ⚠️
            </div>
            <h1 style={{
              fontSize: '1.5rem',
              fontWeight: '700',
              marginBottom: '1rem',
              color: '#ef4444'
            }}>
              Error Creating Demo
            </h1>
            <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginBottom: '2rem' }}>
              {error || 'Something went wrong'}
            </p>
            <button
              onClick={() => navigate('/landing')}
              style={{
                padding: '0.75rem 2rem',
                background: '#0ea5e9',
                color: 'white',
                border: 'none',
                borderRadius: '0.5rem',
                fontWeight: '600',
                cursor: 'pointer',
                fontSize: '0.875rem'
              }}
            >
              Back to Home
            </button>
          </>
        )}
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}


