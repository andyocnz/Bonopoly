/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { authApi, teamApi } from '../api/client'
import { useVisibilityPolling } from '../hooks/useVisibilityPolling'
import type { GameConfig } from '../engine/gameEngine'

interface Team {
  id: string
  teamCode: string
  name: string
  color: string
  isComputer: boolean
  introSeen?: boolean
}

interface Game {
  id: string
  gameCode: string
  name: string
  status: string
  companyName: string
  industry: string
  totalRounds: number
  currentRound: number
  roundDeadline: string | null
  timezone?: string
  regionLabels?: { us: string; asia: string; europe: string }
  scenarioSequence: number[]
  marketDemandMode?: string
  marketDemandMultiplier?: number
  regionDemandSplit?: { us: number; asia: number; europe: number }
  startingCash?: number
  startingFactoriesUS?: number
  startingFactoriesAsia?: number
  capacityPerFactory?: number
  maxDebtRatio?: number
  gameConfig?: GameConfig | null
  totalTeams?: number
  teams?: Team[] // All teams in the game
}

interface GameState {
  factoriesUS: number
  factoriesAsia: number
  unlockedTechLevel: number
  unlockedFeatures: number
  brandReputation: number
  inventory: number
  cashBalance: number
  longTermDebt: number
  shareCapital: number
  retainedEarnings: number
  // Cumulative finance tracking (for debugging and verification)
  totalDividendsPaid?: number
  totalDebtBorrowed?: number
  totalDebtRepaid?: number
  totalSharesIssued?: number
  totalSharesBoughtBack?: number
}

interface GameContextType {
  team: Team | null
  game: Game | null
  gameState: GameState | null
  isEducator: boolean
  isAdmin: boolean
  authReady: boolean
  setTeam: (team: Team | null) => void
  setGame: (game: Game | null) => void
  setGameState: (state: GameState | null) => void
  setIsEducator: (value: boolean) => void
  setIsAdmin: (value: boolean) => void
  logout: () => void
}

const GameContext = createContext<GameContextType | undefined>(undefined)
type DemoWindow = Window & { demoAutoCalculatorInterval?: ReturnType<typeof setInterval> }

export function GameProvider({ children }: { children: ReactNode }) {
  const [team, setTeam] = useState<Team | null>(null)
  const [game, setGame] = useState<Game | null>(null)
  const [gameState, setGameState] = useState<GameState | null>(null)
  const [isEducator, setIsEducator] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [authReady, setAuthReady] = useState(false)

  const handleSetTeam = (t: Team | null) => {
    setTeam(t)
  }

  const handleSetGame = (g: Game | null) => {
    setGame(g)
  }

  const handleSetIsEducator = (value: boolean) => {
    setIsEducator(value)
  }

  const logout = () => {
    const role = isEducator ? 'educator' : isAdmin ? 'admin' : 'team'
    // Clear demo-session runtime flags so logout doesn't immediately feel like a demo re-entry.
    try {
      sessionStorage.removeItem('demoMode')
      sessionStorage.removeItem('autoAdvance')
      sessionStorage.removeItem('demoGameId')
      sessionStorage.removeItem('lastDemoGameId')
    } catch {
      // Ignore storage access errors
    }
    const demoWindow = window as DemoWindow
    const autoCalcInterval = demoWindow.demoAutoCalculatorInterval
    if (autoCalcInterval) {
      clearInterval(autoCalcInterval)
      demoWindow.demoAutoCalculatorInterval = undefined
    }
    handleSetTeam(null)
    handleSetGame(null)
    setGameState(null)
    handleSetIsEducator(false)
    setIsAdmin(false)
    // Wait for logout to complete before redirecting
    authApi.logout(role)
      .catch(() => undefined)
      .finally(() => {
        // Force clean reload to home page to clear all state
        window.location.href = '/'
      })
  }

  useEffect(() => {
    let active = true
    const hydrateSession = async () => {
      try {
        const path = window.location.pathname

        // On home page, check for educator first, then team
        if (path === '/' || path === '') {
          const educatorSession = await authApi.me('educator')
          if (active && educatorSession.success && educatorSession.role === 'educator') {
            setTeam(null)
            setGame((educatorSession.game ?? null) as Game | null)
            setGameState(null)
            setIsEducator(true)
            setAuthReady(true)
            return
          }

          const teamSession = await authApi.me('team')
          if (active && teamSession.success && teamSession.role === 'team') {
            setTeam(teamSession.team ?? null)
            setGame((teamSession.game ?? null) as Game | null)
            setGameState((teamSession.currentState ?? null) as GameState | null)
            setIsEducator(false)
            setAuthReady(true)
            return
          }

          setAuthReady(true)
          return
        }

        // On other pages, use path-based role hint
        const roleHint: 'team' | 'educator' | 'admin' =
          path.startsWith('/educator') ? 'educator' :
            (path.startsWith('/admin') || path.startsWith('/modlab')) ? 'admin' : 'team'
        const session = await authApi.me(roleHint)
        if (!active) return
        if (!session.success) {
          setAuthReady(true)
          return
        }

        if (session.role === 'team') {
          setTeam(session.team ?? null)
          setGame((session.game ?? null) as Game | null)
          setGameState((session.currentState ?? null) as GameState | null)
          setIsEducator(false)
          setIsAdmin(false)
        } else if (session.role === 'educator') {
          setTeam(null)
          setGame((session.game ?? null) as Game | null)
          setGameState(null)
          setIsEducator(true)
          setIsAdmin(false)
        } else if (session.role === 'admin') {
          setTeam(null)
          setGame(null)
          setGameState(null)
          setIsEducator(false)
          setIsAdmin(true)
        } else {
          setTeam(null)
          setGame(null)
          setGameState(null)
          setIsEducator(false)
          setIsAdmin(false)
        }
        setAuthReady(true)
      } catch (err) {
        console.error('Failed to hydrate session', err)
        setAuthReady(true)
      }
    }

    hydrateSession()
    return () => {
      active = false
    }
  }, [])

  // Background polling for game and state updates
  // Reduced from 10s to 60s and added visibility check to save 95% database bandwidth
  const pollGameState = async () => {
    if (!authReady || !team?.id || !game?.id) return

    try {
      const response = await teamApi.getState(team.id!)
      if (response.success && response.game) {
        // Check if game state has changed meaningfully
        const curr = response.game
        if (curr.currentRound !== game.currentRound || curr.status !== game.status) {
          setGame({ ...game, ...curr })
        }
        if (response.state) {
          setGameState(response.state as GameState)
        }
      }
    } catch (err) {
      console.warn('[GameContext] Polling failed', err)
    }
  }

  useVisibilityPolling(
    pollGameState,
    60000, // Poll every 60 seconds (reduced from 10s)
    authReady && !!team?.id && !!game?.id && (game.status || '').toUpperCase() !== 'COMPLETED'
  )

  const handleSetIsAdmin = (value: boolean) => {
    setIsAdmin(value)
  }

  return (
    <GameContext.Provider
      value={{
        team,
        game,
        gameState,
        isEducator,
        isAdmin,
        authReady,
        setTeam: handleSetTeam,
        setGame: handleSetGame,
        setGameState,
        setIsEducator: handleSetIsEducator,
        setIsAdmin: handleSetIsAdmin,
        logout,
      }}
    >
      {children}
    </GameContext.Provider>
  )
}

export function useGame() {
  const context = useContext(GameContext)
  if (!context) {
    throw new Error('useGame must be used within a GameProvider')
  }
  return context
}
