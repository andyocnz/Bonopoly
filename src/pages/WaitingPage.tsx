import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGame } from '../context/GameContext'

export function WaitingPage() {
  const navigate = useNavigate()
  const { team, game, logout, authReady } = useGame()
  const [dots, setDots] = useState('.')

  // Redirect if no team
  useEffect(() => {
    if (!authReady) return
    if (!team) {
      navigate('/')
    }
  }, [team, navigate, authReady])

  useEffect(() => {
    if (!authReady) return
    if ((game?.status || '').toUpperCase() === 'ACTIVE') {
      navigate('/mission')
    }
  }, [authReady, game?.status, navigate])

  // Animated dots
  useEffect(() => {
    const interval = setInterval(() => {
      setDots((d) => (d.length >= 3 ? '.' : d + '.'))
    }, 500)
    return () => clearInterval(interval)
  }, [])

  if (!authReady) {
    return (
      <div className="waiting-page">
        <div className="waiting-container">
          <h1>Restoring session...</h1>
        </div>
      </div>
    )
  }

  if (!team || !game) {
    return null
  }

  return (
    <div className="waiting-page">
      <div className="waiting-container">
        <div className="team-badge" style={{ borderColor: team.color }}>
          <span className="team-name">{team.name}</span>
          <span className="team-code">{team.teamCode}</span>
        </div>

        <div className="spinner" />

        <h1>Waiting for Game to Start{dots}</h1>
        <p className="hint">
          The educator will start the game when all teams are ready.
        </p>

        <div className="game-info">
          <div className="info-row">
            <span className="label">Game</span>
            <span className="value">{game.gameCode}</span>
          </div>
          <div className="info-row">
            <span className="label">Company</span>
            <span className="value">{game.companyName}</span>
          </div>
          <div className="info-row">
            <span className="label">Total Rounds</span>
            <span className="value">{game.totalRounds}</span>
          </div>
        </div>

        <button className="btn-logout" onClick={logout}>
          Leave Game
        </button>
      </div>

      <style>{`
        .waiting-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
          padding: 2rem;
        }

        .waiting-container {
          text-align: center;
          max-width: 400px;
        }

        .team-badge {
          display: inline-block;
          border: 2px solid;
          border-radius: 12px;
          padding: 1rem 2rem;
          margin-bottom: 2rem;
        }

        .team-name {
          display: block;
          color: #fff;
          font-size: 1.25rem;
          font-weight: 600;
        }

        .team-code {
          display: block;
          color: #64748b;
          font-size: 0.875rem;
          font-family: 'JetBrains Mono', monospace;
          margin-top: 0.25rem;
        }

        .spinner {
          width: 60px;
          height: 60px;
          border: 3px solid rgba(255, 255, 255, 0.1);
          border-top-color: #4facfe;
          border-radius: 50%;
          margin: 0 auto 2rem;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        h1 {
          color: #fff;
          font-size: 1.5rem;
          margin: 0 0 0.5rem 0;
        }

        .hint {
          color: #64748b;
          margin: 0 0 2rem 0;
        }

        .game-info {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          padding: 1rem;
          margin-bottom: 2rem;
        }

        .info-row {
          display: flex;
          justify-content: space-between;
          padding: 0.5rem 0;
        }

        .info-row + .info-row {
          border-top: 1px solid rgba(255, 255, 255, 0.05);
        }

        .label {
          color: #64748b;
        }

        .value {
          color: #fff;
          font-weight: 500;
        }

        .btn-logout {
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.3);
          color: #fca5a5;
          padding: 0.75rem 2rem;
          border-radius: 8px;
          cursor: pointer;
          font-size: 1rem;
        }

        .btn-logout:hover {
          background: rgba(239, 68, 68, 0.2);
        }
      `}</style>
    </div>
  )
}
