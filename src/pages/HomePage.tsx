import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { teamApi, gameApi } from '../api/client'
import { useGame } from '../context/GameContext'

type LoginMode = 'team' | 'educator'

export function HomePage() {
  const navigate = useNavigate()
  const { setTeam, setGame, setGameState, setIsEducator, authReady, team, game, isEducator } = useGame()
  const [loginMode, setLoginMode] = useState<LoginMode>('team')
  const [teamCode, setTeamCode] = useState('')
  const [teamPin, setTeamPin] = useState('')
  const [gameCode, setGameCode] = useState('')
  const [gamePin, setGamePin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!authReady) return
    if (isEducator && game) {
      navigate('/educator-dev')
      return
    }
    if (team && game) {
      if (game.status === 'SETUP') {
        navigate('/waiting')
      } else {
        navigate('/mission')
      }
    }
  }, [authReady, isEducator, game, team, navigate])

  const handleTeamLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!teamCode.trim()) {
      setError('Please enter a team code')
      return
    }
    if (!teamPin.trim()) {
      setError('Please enter your team PIN')
      return
    }

    setLoading(true)
    setError('')

    try {
      const { team, game, currentState } = await teamApi.login(teamCode.trim(), teamPin.trim())
      setTeam(team)
      setGame(game)
      setGameState(currentState as never)
      setIsEducator(false)

      if (game.status === 'SETUP') {
        navigate('/waiting')
      } else {
        navigate('/mission')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  const handleEducatorLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!gameCode.trim()) {
      setError('Please enter a game code')
      return
    }
    if (!gamePin.trim()) {
      setError('Please enter the game PIN')
      return
    }

    setLoading(true)
    setError('')

    try {
      const { game } = await gameApi.login(gameCode.trim(), gamePin.trim())
      setGame({
        id: game.id,
        gameCode: game.gameCode,
        name: game.name,
        status: game.status,
        companyName: game.companyName,
        industry: game.industry,
        totalRounds: game.totalRounds,
        currentRound: game.currentRound,
        roundDeadline: game.roundDeadline ?? null,
        timezone: game.timezone,
        regionLabels: game.regionLabels,
        marketDemandMode: game.marketDemandMode,
        marketDemandMultiplier: game.marketDemandMultiplier,
        regionDemandSplit: game.regionDemandSplit,
        scenarioSequence: game.scenarioSequence ?? [],
        teams: game.teams,
      })
      setTeam(null)
      setIsEducator(true)
      navigate('/educator-dev')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="home-page">
      <div className="home-container">
        <div className="logo-section">
          <h1 className="game-title">BONOPOLY</h1>
          <p className="game-subtitle">Business Simulation Game</p>
        </div>

        <div className="login-card">
          <div className="login-tabs">
            <button
              className={`login-tab ${loginMode === 'team' ? 'active' : ''}`}
              onClick={() => { setLoginMode('team'); setError(''); }}
            >
              Team
            </button>
            <button
              className={`login-tab ${loginMode === 'educator' ? 'active' : ''}`}
              onClick={() => { setLoginMode('educator'); setError(''); }}
            >
              Educator
            </button>
          </div>

          {loginMode === 'team' ? (
            <form onSubmit={handleTeamLogin}>
              <div className="form-group">
                <label htmlFor="teamCode">Team Code</label>
                <input
                  id="teamCode"
                  type="text"
                  value={teamCode}
                  onChange={(e) => setTeamCode(e.target.value.toUpperCase())}
                  placeholder="e.g., ALPHA-7K2M"
                  autoComplete="off"
                  disabled={loading}
                />
              </div>
              <div className="form-group">
                <label htmlFor="teamPin">Team PIN</label>
                <input
                  id="teamPin"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={4}
                  value={teamPin}
                  onChange={(e) => setTeamPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="4-digit PIN"
                  autoComplete="off"
                  disabled={loading}
                />
              </div>
              {error && <div className="error-message">{error}</div>}
              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? 'Logging in...' : 'Enter Game'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleEducatorLogin}>
              <div className="form-group">
                <label htmlFor="gameCode">Game Code</label>
                <input
                  id="gameCode"
                  type="text"
                  value={gameCode}
                  onChange={(e) => setGameCode(e.target.value.toUpperCase())}
                  placeholder="e.g., BONO-A3X9"
                  autoComplete="off"
                  disabled={loading}
                />
              </div>
              <div className="form-group">
                <label htmlFor="gamePin">Game PIN</label>
                <input
                  id="gamePin"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={4}
                  value={gamePin}
                  onChange={(e) => setGamePin(e.target.value.replace(/\D/g, ''))}
                  placeholder="4-digit PIN"
                  autoComplete="off"
                  disabled={loading}
                />
              </div>
              {error && <div className="error-message">{error}</div>}
              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? 'Logging in...' : 'Manage Game'}
              </button>
            </form>
          )}
        </div>

        <div className="divider">
          <span>OR</span>
        </div>

        <div className="action-buttons">
          <button
            className="btn-secondary"
            onClick={() => navigate('/create')}
          >
            Create New Game
          </button>
          <button
            className="btn-outline"
            onClick={() => navigate('/simulator')}
          >
            Try Decision Simulator
          </button>
        </div>
      </div>

      <style>{`
        .home-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
          padding: 2rem;
        }

        .home-container {
          max-width: 400px;
          width: 100%;
        }

        .logo-section {
          text-align: center;
          margin-bottom: 2rem;
        }

        .game-title {
          font-size: 3rem;
          font-weight: 800;
          color: #fff;
          letter-spacing: 0.2em;
          margin: 0;
          text-shadow: 0 0 30px rgba(79, 172, 254, 0.5);
        }

        .game-subtitle {
          color: #94a3b8;
          margin-top: 0.5rem;
          font-size: 1.1rem;
        }

        .login-card {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 16px;
          padding: 2rem;
          backdrop-filter: blur(10px);
        }

        .login-tabs {
          display: flex;
          gap: 0.5rem;
          margin-bottom: 1.5rem;
          background: rgba(0, 0, 0, 0.2);
          border-radius: 8px;
          padding: 0.25rem;
        }

        .login-tab {
          flex: 1;
          padding: 0.75rem 1rem;
          border: none;
          border-radius: 6px;
          background: transparent;
          color: #64748b;
          font-size: 0.875rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .login-tab:hover {
          color: #94a3b8;
        }

        .login-tab.active {
          background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
          color: #1a1a2e;
        }

        .login-card h2 {
          color: #fff;
          margin: 0 0 1.5rem 0;
          font-size: 1.25rem;
          text-align: center;
        }

        .form-group {
          margin-bottom: 1rem;
        }

        .form-group label {
          display: block;
          color: #94a3b8;
          margin-bottom: 0.5rem;
          font-size: 0.875rem;
        }

        .form-group input {
          width: 100%;
          padding: 0.875rem 1rem;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          background: rgba(0, 0, 0, 0.3);
          color: #fff;
          font-size: 1rem;
          font-family: 'JetBrains Mono', monospace;
          letter-spacing: 0.1em;
          text-align: center;
          box-sizing: border-box;
        }

        .form-group input::placeholder {
          color: #64748b;
        }

        .form-group input:focus {
          outline: none;
          border-color: #4facfe;
          box-shadow: 0 0 0 3px rgba(79, 172, 254, 0.2);
        }

        .error-message {
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.3);
          color: #fca5a5;
          padding: 0.75rem;
          border-radius: 8px;
          font-size: 0.875rem;
          margin-bottom: 1rem;
          text-align: center;
        }

        .btn-primary {
          width: 100%;
          padding: 1rem;
          border: none;
          border-radius: 8px;
          background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
          color: #1a1a2e;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .btn-primary:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 10px 30px rgba(79, 172, 254, 0.4);
        }

        .btn-primary:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .divider {
          display: flex;
          align-items: center;
          margin: 2rem 0;
        }

        .divider::before,
        .divider::after {
          content: '';
          flex: 1;
          height: 1px;
          background: rgba(255, 255, 255, 0.1);
        }

        .divider span {
          padding: 0 1rem;
          color: #64748b;
          font-size: 0.875rem;
        }

        .action-buttons {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .btn-secondary {
          width: 100%;
          padding: 1rem;
          border: none;
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.1);
          color: #fff;
          font-size: 1rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .btn-secondary:hover {
          background: rgba(255, 255, 255, 0.15);
        }

        .btn-outline {
          width: 100%;
          padding: 1rem;
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 8px;
          background: transparent;
          color: #94a3b8;
          font-size: 1rem;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .btn-outline:hover {
          border-color: rgba(255, 255, 255, 0.4);
          color: #fff;
        }
      `}</style>
    </div>
  )
}
