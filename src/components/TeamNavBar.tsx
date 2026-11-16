import { useNavigate, useLocation } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import { useGame } from '../context/GameContext'
import { useTheme } from '../context/ThemeContext'

type IntlWithSupportedValues = typeof Intl & {
  supportedValuesOf?: (key: 'timeZone') => string[]
}

export function TeamNavBar() {
  const navigate = useNavigate()
  const location = useLocation()
  const { team, game, logout } = useGame()
  const { theme, toggleTheme } = useTheme()
  const [now, setNow] = useState(() => Date.now())
  const currentRound = game?.currentRound ?? 0
  const currentPath = location.pathname
  const deadlineMs = game?.roundDeadline ? new Date(game.roundDeadline).getTime() : null
  const timeZone = useMemo(() => {
    const candidate = game?.timezone || 'Pacific/Auckland'
    const intlWithSupportedValues = Intl as IntlWithSupportedValues
    if (typeof intlWithSupportedValues.supportedValuesOf === 'function') {
      const supported = intlWithSupportedValues.supportedValuesOf('timeZone')
      return supported.includes(candidate) ? candidate : 'Pacific/Auckland'
    }
    try {
      new Intl.DateTimeFormat('en-NZ', { timeZone: candidate }).format(new Date())
      return candidate
    } catch {
      return 'Pacific/Auckland'
    }
  }, [game?.timezone])

  useEffect(() => {
    if (!deadlineMs) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [deadlineMs])

  const deadlineLabel = useMemo(() => {
    if (!deadlineMs) return '---'
    const deadlineDate = new Date(deadlineMs)
    try {
      return new Intl.DateTimeFormat('en-NZ', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone,
        timeZoneName: 'short',
      }).format(deadlineDate)
    } catch {
      return deadlineDate.toLocaleString('en-NZ')
    }
  }, [deadlineMs, timeZone])

  const timeRemainingLabel = useMemo(() => {
    if (game?.status === 'COMPLETED') return 'Complete'
    if (!deadlineMs) return 'No time limit'
    const remainingMs = deadlineMs - now
    if (remainingMs <= 0) return 'Time expired'
    const totalSeconds = Math.floor(remainingMs / 1000)
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60
    return `${hours}h ${minutes}m ${seconds}s`
  }, [deadlineMs, now, game?.status])

  const industryIcon = useMemo(() => {
    const key = (game?.industry || '').trim().toLowerCase()
    const icons: Record<string, string> = {
      'oil': new URL('../../icons/oil factory.png', import.meta.url).href,
      'oil & energy': new URL('../../icons/oil factory.png', import.meta.url).href,
      'oil and energy': new URL('../../icons/oil factory.png', import.meta.url).href,
      'electronics': new URL('../../icons/electrics factory.png', import.meta.url).href,
      'electronics & technology': new URL('../../icons/electrics factory.png', import.meta.url).href,
      'electronics and technology': new URL('../../icons/electrics factory.png', import.meta.url).href,
      'automotive': new URL('../../icons/car factory.png', import.meta.url).href,
      'auto': new URL('../../icons/car factory.png', import.meta.url).href,
      'automobile': new URL('../../icons/car factory.png', import.meta.url).href,
    }
    return icons[key]
  }, [game?.industry])

  if (!team || !game) return null

  return (
    <>
      <header className="team-header">
        <div className="header-left">
          <div className="header-title">
            {industryIcon && (
              <img
                className="industry-icon"
                src={industryIcon}
                alt={`${game.industry || 'Industry'} icon`}
              />
            )}
            <h1>{game.companyName || 'TechCorp'}</h1>
            <span className="round-badge">
              {currentRound === 0 ? 'Trial Round' : `Round ${currentRound}`}
            </span>
          </div>
        </div>
        <div className="header-center">
          <div className="deadline-pill">
            <span className="deadline-label">{game.status === 'COMPLETED' ? 'Game status' : 'Round ends'}</span>
            {game.status !== 'COMPLETED' && <span className="deadline-time">{deadlineLabel}</span>}
            <span className="deadline-countdown">{timeRemainingLabel}</span>
          </div>
        </div>
        <div className="header-right">
          <div className="game-info">
            <span className="game-name-value">{game.name || game.gameCode}</span>
            <span className="game-code-value">{game.gameCode}</span>
          </div>
          <div className="team-info" style={{ borderColor: team.color }}>
            <span className="team-name">{team.name}</span>
            <span className="team-code">{team.teamCode}</span>
          </div>
          <button className="btn-logout" onClick={logout}>
            Logout
          </button>
          <button className="btn-theme btn-theme-right" onClick={toggleTheme} title="Switch Theme">
            {theme === 'dark' ? '🌞' : '🌙'}
          </button>
        </div>
      </header>

      <nav className="team-nav">
        <button
          className={`nav-btn ${currentPath === '/mission' ? 'active' : ''}`}
          onClick={() => navigate('/mission')}
        >
          Mission
        </button>
        <button
          className={`nav-btn ${currentPath === '/decisions' ? 'active' : ''}`}
          onClick={() => navigate('/decisions')}
        >
          Decisions
        </button>
        <button
          className={`nav-btn ${currentPath === '/results' ? 'active' : ''}`}
          onClick={() => navigate('/results')}
        >
          Results
        </button>
      </nav>

      <style>{`
        .team-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1rem 2rem;
          background: var(--bg-card);
          border-bottom: 1px solid var(--border-color);
        }

        .header-title {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .header-left h1 {
          color: var(--text-primary);
          margin: 0;
          font-size: 1.25rem;
        }

        .round-badge {
          background: rgba(79, 172, 254, 0.2);
          color: var(--text-accent);
          padding: 0.25rem 0.75rem;
          border-radius: 20px;
          font-size: 0.75rem;
          font-weight: 500;
        }

        .industry-icon {
          width: 80px;
          height: 40px;
          object-fit: contain;
          border-radius: 0px;
          filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.25));
        }

        .header-right {
          display: flex;
          align-items: center;
          gap: 1.5rem;
        }

        .header-center {
          display: flex;
          justify-content: center;
          flex: 1;
        }

        .deadline-pill {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.1rem;
          padding: 0.35rem 0.85rem;
          border-radius: 999px;
          background: rgba(79, 172, 254, 0.12);
          border: 1px solid var(--border-color);
          min-width: 220px;
        }

        .deadline-label {
          font-size: 0.7rem;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--text-muted);
        }

        .deadline-time {
          font-size: 0.8rem;
          color: var(--text-primary);
          font-weight: 600;
        }

        .deadline-countdown {
          font-size: 0.85rem;
          color: var(--text-accent);
          font-weight: 600;
        }

        .game-info {
          text-align: right;
        }

        .game-name-value {
          display: block;
          color: var(--text-primary);
          font-size: 0.875rem;
          font-weight: 600;
        }

        .game-code-value {
          display: block;
          color: var(--text-muted);
          font-size: 0.75rem;
          font-family: var(--font-mono);
        }

        .team-info {
          border-left: 3px solid;
          padding-left: 1rem;
        }

        .team-name {
          display: block;
          color: var(--text-primary);
          font-weight: 600;
          font-size: 0.875rem;
        }

        .team-code {
          display: block;
          color: var(--text-muted);
          font-size: 0.75rem;
          font-family: var(--font-mono);
        }

        .btn-theme,
        .btn-logout {
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid var(--border-color);
          color: var(--text-secondary);
          padding: 0.5rem 1rem;
          border-radius: 6px;
          cursor: pointer;
          font-size: 0.875rem;
        }

        .btn-theme-right {
          margin-left: auto;
        }

        .btn-theme:hover,
        .btn-logout:hover {
          background: var(--bg-card-hover);
          color: var(--text-primary);
        }

        .team-nav {
          display: flex;
          gap: 0.25rem;
          padding: 0 2rem;
          background: var(--bg-card); /* Fallback/Base */
          border-bottom: 1px solid var(--border-color);
        }

        .nav-btn {
          background: none;
          border: none;
          color: var(--text-muted);
          padding: 0.875rem 1.25rem;
          font-size: 0.875rem;
          font-weight: 500;
          cursor: pointer;
          position: relative;
          transition: color 0.2s;
        }

        .nav-btn:hover {
          color: var(--text-secondary);
        }

        .nav-btn.active {
          color: var(--text-accent);
        }

        .nav-btn.active::after {
          content: '';
          position: absolute;
          bottom: -1px;
          left: 0;
          right: 0;
          height: 2px;
          background: var(--text-accent);
        }

        @media (max-width: 768px) {
          .team-header {
            flex-direction: column;
            gap: 1rem;
            padding: 1rem;
          }

          .header-center {
            width: 100%;
            justify-content: flex-start;
          }

          .header-right {
            width: 100%;
            justify-content: space-between;
          }

          .team-nav {
            padding: 0 1rem;
            overflow-x: auto;
          }

          .nav-btn {
            padding: 0.75rem 1rem;
            font-size: 0.8rem;
          }
        }
      `}</style>
    </>
  )
}
