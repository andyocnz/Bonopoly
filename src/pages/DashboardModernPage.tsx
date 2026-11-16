import { useState, useMemo, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useGame } from '../context/GameContext'
import { teamApi } from '../api/client'
import './DashboardModernPage.css'
import './DecisionsModernPage.css'
import { useTheme } from '../context/ThemeContext'
import { SidebarFooter } from '../components/SidebarFooter'
import type { TeamResultData } from '../api/client'

const MAIN_NAV = [
    { id: 'dashboard', label: 'Dashboard', path: '/dashboard' },
    { id: 'mission', label: 'Mission', path: '/mission' },
    { id: 'results', label: 'Results', path: '/results' },
    { id: 'decisions', label: 'Decisions ⚡', path: '/decisions' },
]


export function DashboardModernPage() {
    const [sessionOpen, setSessionOpen] = useState(false)
    const [rawResults, setRawResults] = useState<TeamResultData[]>([])
    const [showResultsNotice, setShowResultsNotice] = useState(false)
    const { theme, toggleTheme } = useTheme()

    const navigate = useNavigate()
    const location = useLocation()
    const { team, game, authReady, logout } = useGame()

    // Fetch once on mount/context change and again when tab becomes visible.
    useEffect(() => {
        const fetchResults = async () => {
            if (!authReady || !team) return
            try {
                const { results } = await teamApi.getResults(team.id, 'metadata', 'dashboard-modern')
                setRawResults(Array.isArray(results) ? results : [])
            } catch (err) {
                console.error('Error fetching results:', err)
            }
        }

        const initialFetchTimeout = window.setTimeout(() => {
            void fetchResults()
        }, 0)
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                void fetchResults()
            }
        }
        document.addEventListener('visibilitychange', handleVisibilityChange)
        return () => {
            window.clearTimeout(initialFetchTimeout)
            document.removeEventListener('visibilitychange', handleVisibilityChange)
        }
    }, [authReady, team, team?.id])

    // --- Derived State ---
    const gameCode = game?.gameCode || '---'
    const teamCode = team?.teamCode || '---'
    const companyName = game?.companyName || 'TechCorp'
    const teamName = team?.name || 'Team'
    const gameName = game?.name || 'AIgopoly'
    const latestResultsRound = useMemo(() => {
        if (!Array.isArray(rawResults) || rawResults.length === 0) return null
        const rounds = rawResults
            .map((entry) => entry?.roundNumber)
            .filter((value) => typeof value === 'number')
        if (rounds.length === 0) return null
        const latest = Math.max(...rounds)
        return latest >= 0 ? latest : null
    }, [rawResults])
    const resultsNoticeKey = !team?.id || !game?.id || latestResultsRound === null
        ? null
        : `results-notice-seen-${game.id}-${team.id}-${latestResultsRound}`
    const resultsNoticeLabel = latestResultsRound === 0
        ? 'Trial results available - click to view'
        : latestResultsRound !== null
            ? `Round ${latestResultsRound} results available - click to view`
            : ''
    useEffect(() => {
        if (!resultsNoticeKey) {
            const hideTimeout = window.setTimeout(() => setShowResultsNotice(false), 0)
            return () => window.clearTimeout(hideTimeout)
        }
        let seen = false
        try {
            seen = localStorage.getItem(resultsNoticeKey) === 'true'
        } catch {
            seen = false
        }
        if (seen) {
            const hideTimeout = window.setTimeout(() => setShowResultsNotice(false), 0)
            return () => window.clearTimeout(hideTimeout)
        }
        const showTimeout = window.setTimeout(() => setShowResultsNotice(true), 0)
        try {
            localStorage.setItem(resultsNoticeKey, 'true')
        } catch {
            // ignore storage failures
        }
        const timeout = window.setTimeout(() => setShowResultsNotice(false), 8000)
        return () => {
            window.clearTimeout(showTimeout)
            window.clearTimeout(timeout)
        }
    }, [resultsNoticeKey])
    
    const industryKey = (game?.industry || '').trim().toLowerCase()
    const industryIcon = useMemo(() => {
        const icons: Record<string, string> = {
            'oil': new URL('../../icons/oil factory.png', import.meta.url).href,
            'oil & energy': new URL('../../icons/oil factory.png', import.meta.url).href,
            'electronics': new URL('../../icons/electrics factory.png', import.meta.url).href,
            'automotive': new URL('../../icons/car factory.png', import.meta.url).href,
        }
        return icons[industryKey] || icons['electronics']
    }, [industryKey])

    const roundLabel = (game?.currentRound ?? 0) === 0 ? 'Trial Round' : `Round ${game?.currentRound} / ${game?.totalRounds || '-'}`

    return (
        <div className="decisions-modern dashboard-modern-scoped">
            <div className="dm-shell">
                <aside className="dm-sidebar">
                    <div className="dm-company">
                        <div className="dm-company-logo">{industryIcon && <img src={industryIcon} alt="Company logo" />}</div>
                        <div>
                            <div className="dm-company-name">{teamName}</div>
                            <div className="dm-company-meta">{game?.industry || 'Industry'}</div>
                        </div>
                    </div>

                    <nav className="dm-nav">
                        {MAIN_NAV.map((item) => (
                            <button
                                key={item.id}
                                type="button"
                                className={`dm-nav-item ${location.pathname === item.path ? 'active' : ''}`}
                                onClick={() => navigate(item.path)}
                            >
                                {item.label}
                            </button>
                        ))}
                    </nav>
                    <SidebarFooter />
                </aside>

                <main className="dm-main">
                    <header className={`dm-header`}>
                        <div>
                            <h1>Dashboard</h1>
                            <p>{companyName}</p>
                        </div>
                        <div className="dm-header-controls">
                            {showResultsNotice && (
                                <button
                                    type="button"
                                    className="dm-results-cta"
                                    onClick={() => navigate('/results', { state: { refreshKey: Date.now() } })}
                                >
                                    {resultsNoticeLabel}
                                </button>
                            )}
                            <div className="dm-timer" style={{ display: 'none' }} />
                            <button type="button" className="dm-session" onClick={() => setSessionOpen((open) => !open)}>
                                <span className="dm-session-round dm-session-small">{roundLabel}</span>
                                <span className="dm-session-scenario dm-session-small">{gameName}</span>
                                <span className="dm-session-caret">▾</span>
                                {sessionOpen && (
                                    <span className="dm-session-menu" onClick={(event) => event.stopPropagation()}>
                                        <span className="dm-menu-row"><span className="dm-menu-label">Game Code</span><span className="dm-menu-value">{gameCode}</span></span>
                                        <span className="dm-menu-row"><span className="dm-menu-label">Team</span><span className="dm-menu-value">{teamName}</span></span>
                                        <span className="dm-menu-row"><span className="dm-menu-label">Team Code</span><span className="dm-menu-value">{teamCode}</span></span>
                                        <span className="dm-menu-row"><button type="button" className="dm-logout" onClick={() => { logout(); navigate('/'); }}>Log Out</button></span>
                                    </span>
                                )}
                            </button>
                            <button
                                type="button"
                                className="dm-theme-toggle"
                                onClick={toggleTheme}
                                title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                            >
                                {theme === 'dark' ? '☀️' : '🌙'}
                            </button>
                        </div>
                    </header>

                    <div className="dm-workspace dm-no-impact">
                        <section className="dm-content">
                            <div className="dm-scroll" style={{ padding: '2rem' }}>

                            </div>
                        </section>
                    </div>
                </main>
            </div>

        </div>
    )
}
