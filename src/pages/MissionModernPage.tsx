import { Fragment, useEffect, useState, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGame } from '../context/GameContext'
import { teamApi } from '../api/client'
import { useTheme } from '../context/ThemeContext'
import './DecisionsModernPage.css'
import './DashboardModernPage.css'
import { SidebarFooter } from '../components/SidebarFooter'

type WebkitAudioWindow = Window & {
    webkitAudioContext?: typeof AudioContext
}

type MissionResultRow = {
    roundNumber?: number
}

// Typing animation hook with Sound
function useTypewriter(text: string, speed: number = 300, delay: number = 0) {
    const [displayedText, setDisplayedText] = useState('')
    const [isComplete, setIsComplete] = useState(false)
    const audioContextRef = useRef<AudioContext | null>(null)
    const intervalRef = useRef<NodeJS.Timeout | null>(null)
    const timeoutRef = useRef<NodeJS.Timeout | null>(null)

    // Initialize AudioContext - DON'T close it on cleanup
    useEffect(() => {
        const AudioContextClass = window.AudioContext || (window as WebkitAudioWindow).webkitAudioContext
        if (AudioContextClass && !audioContextRef.current) {
            audioContextRef.current = new AudioContextClass()
        }

        // Resume audio context on first user interaction
        const resumeAudio = () => {
            if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
                audioContextRef.current.resume().catch(console.error)
            }
        }

        document.addEventListener('click', resumeAudio, { once: true })
        document.addEventListener('keydown', resumeAudio, { once: true })

        return () => {
            document.removeEventListener('click', resumeAudio)
            document.removeEventListener('keydown', resumeAudio)
        }
    }, [])

    // Stop sound and animation when page loses focus or component unmounts
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.hidden) {
                // Stop all sounds and animation when leaving page
                if (intervalRef.current) {
                    clearInterval(intervalRef.current)
                    intervalRef.current = null
                }
                if (timeoutRef.current) {
                    clearTimeout(timeoutRef.current)
                    timeoutRef.current = null
                }
                if (audioContextRef.current && audioContextRef.current.state === 'running') {
                    audioContextRef.current.suspend()
                }
            } else if (!document.hidden && audioContextRef.current && audioContextRef.current.state === 'suspended') {
                audioContextRef.current.resume()
            }
        }

        document.addEventListener('visibilitychange', handleVisibilityChange)

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange)
            // Clean up on unmount
            if (intervalRef.current) clearInterval(intervalRef.current)
            if (timeoutRef.current) clearTimeout(timeoutRef.current)
        }
    }, [])

    const playClick = () => {
        if (!audioContextRef.current) return

        // If context is suspended or closed, skip sound
        if (audioContextRef.current.state === 'suspended' || audioContextRef.current.state === 'closed') {
            return
        }

        const ctx = audioContextRef.current
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()

        // Higher frequency for sharper, more realistic click (2000-2400Hz range)
        const variance = Math.random() * 400
        const baseFreq = 2000 + variance
        const duration = 0.012 // Much shorter for crisper sound

        // Triangle wave for softer, less harsh sound
        osc.type = 'triangle'

        // Steep pitch drop for mechanical click character
        osc.frequency.setValueAtTime(baseFreq, ctx.currentTime)
        osc.frequency.exponentialRampToValueAtTime(baseFreq / 4, ctx.currentTime + duration)

        // MUCH QUIETER - reduced to 0.008
        gain.gain.setValueAtTime(0.008, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration)

        osc.connect(gain)
        gain.connect(ctx.destination)

        osc.start()
        osc.stop(ctx.currentTime + duration)
    }

    useEffect(() => {
        setDisplayedText('')
        setIsComplete(false)

        let timeoutId: number
        let currentIndex = 0
        let isCancelled = false

        const typeNextChar = () => {
            if (isCancelled) return

            if (currentIndex < text.length) {
                const char = text[currentIndex]
                setDisplayedText(text.slice(0, currentIndex + 1))
                playClick() // Play sound
                currentIndex++

                // Determine delay for next character
                let nextDelay = speed + (Math.random() * 20 - 10) // Base speed +/- 10ms jitter

                // Pause longer after sentence endings
                if (['.', '!', '?'].includes(char)) {
                    nextDelay += 900
                }
                // Slight pause after commas
                else if (char === ',') {
                    nextDelay += 300
                }

                timeoutId = window.setTimeout(typeNextChar, nextDelay)
            } else {
                setIsComplete(true)
            }
        }

        // Start typing after initial delay
        timeoutId = window.setTimeout(typeNextChar, delay)

        return () => {
            isCancelled = true
            clearTimeout(timeoutId)
        }
    }, [text, speed, delay])


    return { displayedText, isComplete }
}



const MAIN_NAV = [
    { id: 'mission', label: 'Mission', path: '/mission' },
    { id: 'results', label: 'Results', path: '/results' },
    { id: 'decisions', label: 'Decisions ⚡', path: '/decisions' },
]

const SECTIONS = [
    { id: 'snapshot', label: 'Company' },
    { id: 'briefing', label: 'Mission Briefing' },
    { id: 'winning', label: 'How to Win' },
    { id: 'areas', label: 'Decision Areas' },
    { id: 'progress', label: 'Game Progress' },
]

export function MissionModernPage() {
    const navigate = useNavigate()
    const { team, game, authReady, logout } = useGame()
    const { theme, toggleTheme } = useTheme()
    const [sessionOpen, setSessionOpen] = useState(false)
    const [activeSection, setActiveSection] = useState('briefing')
    const [rawResults, setRawResults] = useState<MissionResultRow[]>([])
    const [showResultsNotice, setShowResultsNotice] = useState(false)
    const [now, setNow] = useState(() => Date.now())
    const lastStateSignatureRef = useRef<string | null>(null)

    useEffect(() => {
        if (!authReady) return
        if (!team || !game) {
            navigate('/')
        }
    }, [team, game, navigate, authReady])

    useEffect(() => {
        lastStateSignatureRef.current = null
    }, [team?.id, game?.id])

    useEffect(() => {
        const fetchResultsPolling = async () => {
            if (!authReady || !team?.id) return
            try {
                const stateResponse = await teamApi.getState(team.id)
                if (!stateResponse?.success || !stateResponse.game) return

                const stateSignature = `${stateResponse.game.currentRound}:${stateResponse.game.status}:${stateResponse.game.resultsVersion ?? 0}`
                if (lastStateSignatureRef.current === stateSignature) return
                lastStateSignatureRef.current = stateSignature

                const response = await teamApi.getResults(team.id, 'metadata', 'mission-modern', {
                    latestOnly: true,
                    version: stateResponse.game.resultsVersion ?? 0,
                })
                if (response.results) {
                    setRawResults(response.results as MissionResultRow[])
                }
            } catch {
                // Silently fail
            }
        }

        const initialFetchTimeout = window.setTimeout(() => {
            void fetchResultsPolling()
        }, 0)
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                void fetchResultsPolling()
            }
        }
        document.addEventListener('visibilitychange', handleVisibilityChange)
        return () => {
            window.clearTimeout(initialFetchTimeout)
            document.removeEventListener('visibilitychange', handleVisibilityChange)
        }
    }, [authReady, team?.id])

    const companyName = game?.companyName || team?.name || 'TechCorp'
    const industry = game?.industry || 'Electronics & Technology'
    const currentRound = game?.currentRound ?? 0

    // Header Logic
    const roundLabel = currentRound === 0 ? 'Trial Round' : `Round ${currentRound} / ${game?.totalRounds || '-'}`
    const teamName = team?.name || 'Team'
    const teamCode = team?.teamCode || '---'
    const gameName = game?.name || 'AIgopoly'
    const gameCode = game?.gameCode || '---'
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

    const industryKey = (game?.industry || '').trim().toLowerCase()
    const industryIcon = useMemo(() => {
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
        return icons[industryKey]
    }, [industryKey])


    const timeRemainingLabel = (() => {
        if (game?.status === 'COMPLETED') return 'Complete'
        const deadline = game?.roundDeadline ? new Date(game.roundDeadline) : null
        if (!deadline) return 'No time limit'
        const remainingMs = deadline.getTime() - now
        if (remainingMs <= 0) return 'Time expired'
        const totalSeconds = Math.floor(remainingMs / 1000)
        const hours = Math.floor(totalSeconds / 3600)
        const minutes = Math.floor((totalSeconds % 3600) / 60)
        const seconds = totalSeconds % 60
        return `${hours}h ${minutes}m ${seconds}s`
    })()

    useEffect(() => {
        const intervalId = window.setInterval(() => setNow(Date.now()), 1000)
        return () => window.clearInterval(intervalId)
    }, [])
    const isGameComplete = game?.status === 'COMPLETED'

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

    const missionText = `Welcome aboard! Your mission is to lead the company to maximize shareholder value by aligning strategy, operations, and capital allocation across Production, HR, R&D, Marketing, and Finance, steering the company toward sustainable value creation and industry leadership. Good Luck!`

    const { displayedText, isComplete } = useTypewriter(missionText, 120, 500)

    // Snapshot Logic
    const snapshotData = useMemo(() => {
        const isOil = industryKey.includes('oil') || industryKey.includes('energy')
        const isAuto = industryKey.includes('auto') || industryKey.includes('car') || industryKey.includes('mobile')

        if (isOil) {
            return {
                icon: '/images/industry/oil.png',
                title: 'Energy & Petrochemicals',
                description: `${companyName} is a global leader in the energy industry, generating hundreds of millions in revenue annually. Our operations span the entire value chain—from upstream exploration and production of oil and natural gas to downstream refining, logistics, and marketing of fuels, lubricants, and petrochemicals—serving customers and industries worldwide.`
            }
        } else if (isAuto) {
            return {
                icon: '/images/industry/car.png',
                title: 'Automotive Mobility',
                description: `${companyName} is a global leader in the automotive industry, generating billions in revenue annually. We design, manufacture, and sell a full range of vehicles—including passenger cars, SUVs, and commercial trucks—while pioneering the future of electric and autonomous mobility worldwide.`
            }
        } else {
            return {
                icon: '/images/industry/electrics.png',
                title: 'Consumer Electronics',
                description: `${companyName} is a global leader in the consumer electronics industry, generating hundreds of millions in revenue annually. We design, manufacture, and sell a wide range of innovative products—from smartphones and wearables to smart home systems worldwide.`
            }
        }
    }, [industryKey, companyName])

    const scrollToSection = (id: string) => {
        setActiveSection(id)
        const element = document.getElementById(id)
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
    }
    const decisionStepKey = !game?.id || !team?.id
        ? null
        : `decisions-modern-active-step-${game.id}-${team.id}`
    const goToDecisionStep = (stepIndex: number) => {
        if (decisionStepKey) {
            try {
                localStorage.setItem(decisionStepKey, String(stepIndex))
            } catch {
                // ignore storage failures
            }
        }
        navigate('/decisions')
    }

    // Intersection Observer to update active section on scroll
    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        setActiveSection(entry.target.id)
                    }
                })
            },
            { threshold: 0.5 }
        )

        SECTIONS.forEach((section) => {
            const element = document.getElementById(section.id)
            if (element) observer.observe(element)
        })

        return () => observer.disconnect()
    }, [])

    if (!authReady) {
        return (
            <div style={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
                color: '#64748b',
                fontSize: '1rem'
            }}>
                Restoring session...
            </div>
        )
    }

    if (!team || !game) {
        return (
            <div style={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
                color: '#64748b',
                fontSize: '1rem'
            }}>
                Redirecting to login...
            </div>
        )
    }

    return (
        <div className="decisions-modern">
            <div className="dm-shell">
                <aside className="dm-sidebar">
                    <a className="dm-company dm-company-link" href="/landing" target="_blank" rel="noreferrer">
                        <div className="dm-company-logo">
                            {industryIcon && <img src={industryIcon} alt="Industry logo" />}
                        </div>
                        <div>
                            <div className="dm-company-name">{teamName}</div>
                            <div className="dm-company-meta">{industry}</div>
                        </div>
                    </a>

                    <nav className="dm-nav">
                        {MAIN_NAV.map((item) => {
                            const isActive = item.path === '/mission'
                            return (
                                <Fragment key={item.id}>
                                    <button
                                        type="button"
                                        className={`dm-nav-item ${isActive ? 'active' : ''}`}
                                        onClick={() => navigate(item.path)}
                                    >
                                        {item.label}
                                    </button>
                                    {isActive && (
                                        <div className="dm-subnav">
                                            {SECTIONS.map((section, index) => {
                                                const isSectionActive = activeSection === section.id
                                                return (
                                                    <button
                                                        key={section.id}
                                                        type="button"
                                                        className={`dm-subnav-item ${isSectionActive ? 'active' : ''}`}
                                                        onClick={() => scrollToSection(section.id)}
                                                    >
                                                        <span className="dm-subnav-icon">{index + 1}</span>
                                                        <span className="dm-subnav-label">{section.label}</span>
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    )}
                                </Fragment>
                            )
                        })}
                    </nav>

                    <SidebarFooter />
                </aside>

                <main className="dm-main">
                    <header className="dm-header">
                        <div>
                            <h1>Corporate Mission</h1>
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
                            <div className="dm-timer">
                                <span>Time</span>
                                {timeRemainingLabel}
                            </div>
                            <button
                                type="button"
                                className="dm-session"
                                onClick={() => setSessionOpen((open) => !open)}
                            >
                                <span className="dm-session-round dm-session-small">{roundLabel}</span>
                                <span className="dm-session-scenario dm-session-small">{gameName}</span>
                                <span className="dm-session-caret">▾</span>
                                {sessionOpen && (
                                    <span className="dm-session-menu" onClick={(event) => event.stopPropagation()}>
                                        <span className="dm-menu-row">
                                            <span className="dm-menu-label">Game Code</span>
                                            <span className="dm-menu-value">{gameCode}</span>
                                        </span>
                                        <span className="dm-menu-row">
                                            <span className="dm-menu-label">Team</span>
                                            <span className="dm-menu-value">{teamName}</span>
                                        </span>
                                        <span className="dm-menu-row">
                                            <span className="dm-menu-label">Team Code</span>
                                            <span className="dm-menu-value">{teamCode}</span>
                                        </span>
                                        <span className="dm-menu-row">
                                            <button type="button" className="dm-logout" onClick={() => { logout(); navigate('/'); }}>
                                                Log Out
                                            </button>
                                        </span>
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
                                {/* Company Snapshot Section */}
                                <section id="snapshot" className="mission-section" style={{ marginBottom: '3rem' }}>
                                    <div className="snapshot-road-header">
                                        <h2 className="section-title" style={{ borderBottom: 'none', paddingBottom: 0, margin: 0 }}>Company Snapshot</h2>
                                        <div className="snapshot-header-visual">
                                            <img src={snapshotData.icon} alt="Industry Fleet" className="snapshot-truck-header" />
                                        </div>
                                    </div>
                                    <div className="snapshot-card">
                                        <div className="snapshot-content">
                                            <div className="snapshot-meta-row">
                                                <span className="snapshot-industry-tag">{snapshotData.title}</span>
                                            </div>
                                            <p className="snapshot-description">{snapshotData.description}</p>
                                        </div>
                                    </div>
                                </section>

                                {/* Mission Terminal Section with Monitor */}
                                <section id="briefing" className="mission-section" style={{ marginBottom: '2.5rem' }}>
                                    <h2 className="section-title">Mission Briefing</h2>

                                    <div className="mission-split">
                                        {/* Left: Visual Monitor */}
                                        <div className="monitor-wrapper">
                                            <div className="monitor-bezel">
                                                <div className="monitor-screen">
                                                    <img src="/images/boardmeeting.gif" alt="Board Meeting" className="monitor-content" />
                                                    <div className="monitor-scanline"></div>
                                                    <div className="monitor-glitch"></div>
                                                </div>
                                                <div className="monitor-logo">AI Decision Lab</div>
                                                <div className="monitor-power on"></div>
                                            </div>
                                            <div className="monitor-stand"></div>
                                            <div className="monitor-base"></div>
                                        </div>

                                        {/* Right: Terminal */}
                                        <div className="terminal-box" style={{ flex: 1, minHeight: '300px' }}>
                                            <div className="terminal-header">
                                                <div className="terminal-dots">
                                                    <span className="dot red" />
                                                    <span className="dot yellow" />
                                                    <span className="dot green" />
                                                </div>
                                                <span className="terminal-title">SECURE TRANSMISSION // CEO OFFICE</span>
                                            </div>
                                            <div className="terminal-content">
                                                <div className="typing-text">
                                                    <span className="prompt">&gt;</span> {displayedText}
                                                    {!isComplete && <span className="cursor">|</span>}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </section>

                                {/* How to Win Section */}
                                <section id="winning" className="mission-section" style={{ marginBottom: '2.5rem' }}>
                                    <h2 className="section-title">How to Win</h2>
                                    <div className="info-cards">
                                        <div className="info-card">
                                            <span className="card-icon">🏆</span>
                                            <h3>Winning Is Strategic, Not One-Size-Fits-All</h3>
                                            <p>Each team can choose its own short-term and medium-term strategy. Some teams may focus on market share, while others focus on profit and EPS.</p>
                                        </div>
                                        <div className="info-card">
                                            <span className="card-icon">💰</span>
                                            <h3>Case by Case, Guided by Your Lecturer</h3>
                                            <p>The game's winning criterion may differ by class or scenario, based on your lecturer's instructions. Always follow your professor's guidance for what counts most in your game.</p>
                                        </div>
                                        <div className="info-card">
                                            <span className="card-icon">⚖️</span>
                                            <h3>Possible Winning Criteria</h3>
                                            <p>Winning can be evaluated by one of these criteria: Share Price, Market Share, EPS, or Profit.</p>
                                        </div>
                                    </div>
                                </section>

                                {/* Decision Areas Section */}
                                <section id="areas" className="mission-section" style={{ marginBottom: '2.5rem' }}>
                                    <h2 className="section-title">Decision Areas</h2>
                                    <div className="decision-areas">
                                        <button type="button" className="decision-area" onClick={() => goToDecisionStep(2)}>
                                            <div className="area-icon">
                                                🏭
                                                <span className="smoke">☁️</span>
                                                <span className="smoke">☁️</span>
                                                <span className="smoke">☁️</span>
                                            </div>
                                            <div className="area-content">
                                                <h3>Production</h3>
                                                <p>Set manufacturing targets, manage factory capacity, and control overtime levels.</p>
                                            </div>
                                        </button>
                                        <button type="button" className="decision-area" onClick={() => goToDecisionStep(3)}>
                                            <span className="area-icon">🚚</span>
                                            <div className="area-content">
                                                <h3>Logistics</h3>
                                                <p>Manage distribution priorities and shipping allocation across regions to optimize delivery and minimize tariff costs.</p>
                                            </div>
                                        </button>
                                        <button type="button" className="decision-area" onClick={() => goToDecisionStep(4)}>
                                            <span className="area-icon">🔬</span>
                                            <div className="area-content">
                                                <h3>Research & Development</h3>
                                                <p>Hire research staff, invest in workforce training, and develop new product features to stay competitive.</p>
                                            </div>
                                        </button>
                                        <button type="button" className="decision-area" onClick={() => goToDecisionStep(5)}>
                                            <span className="area-icon">📣</span>
                                            <div className="area-content">
                                                <h3>Marketing</h3>
                                                <p>Set prices by region, allocate advertising budgets, and invest in <span title="Corporate Social Responsibility - sustainable and ethical business practices" style={{ textDecoration: 'underline dotted', cursor: 'help' }}>CSR</span> initiatives.</p>
                                            </div>
                                        </button>
                                        <button type="button" className="decision-area" onClick={() => goToDecisionStep(6)}>
                                            <span className="area-icon">🏦</span>
                                            <div className="area-content">
                                                <h3>Finance</h3>
                                                <p>Manage debt, issue or buyback shares, and decide on dividend payments.</p>
                                            </div>
                                        </button>
                                    </div>
                                </section>

                                {/* Game Progress Section */}
                                <section id="progress" className="mission-section">
                                    <h2 className="section-title">Game Progress</h2>
                                    <div className="progress-info">
                                        <div className="progress-item">
                                            <span className="progress-label">Current Round</span>
                                            <span className="progress-value">
                                                {currentRound === 0 ? 'Trial Round' : `Round ${currentRound}`}
                                            </span>
                                        </div>
                                        <div className="progress-item">
                                            <span className="progress-label">Total Rounds</span>
                                            <span className="progress-value">{game?.totalRounds || '-'}</span>
                                        </div>
                                        <div className="progress-item">
                                            <span className="progress-label">Game Status</span>
                                            <span className={`progress-value status-${game?.status?.toLowerCase() || 'inactive'}`}>
                                                {game?.status || '-'}
                                            </span>
                                        </div>
                                    </div>
                                    {currentRound === 0 && (
                                        <p className="trial-note">
                                            This is the <strong>Trial Round</strong>. Use it to learn the system and experiment
                                            with different strategies. Results from this round won't count towards the final ranking.
                                        </p>
                                    )}
                                </section>

                                {!isGameComplete && (
                                    <div className="action-buttons">
                                        <button
                                            className="btn-modern-primary"
                                            onClick={() => navigate('/decisions')}
                                            style={{
                                                background: theme === 'dark' ? '#3b82f6' : '#2563eb',
                                                color: '#ffffff',
                                                border: 'none',
                                                padding: '1rem 2rem',
                                                borderRadius: '8px',
                                                fontSize: '1.125rem',
                                                fontWeight: 700,
                                                letterSpacing: '0.01em',
                                                cursor: 'pointer',
                                                boxShadow: theme === 'dark' ? '0 4px 12px rgba(59, 130, 246, 0.25)' : '0 4px 12px rgba(37, 99, 235, 0.25)'
                                            }}
                                        >
                                            Start {currentRound === 0 ? 'Trial Round' : `Round ${currentRound}`}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </section>
                    </div>
                </main>
            </div>

            <style>{`
        /* Bright Theme Adaptations for Mission Content */
        
        .snapshot-road-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          padding-bottom: 0.75rem;
          margin-bottom: 1.5rem;
          position: relative;
        }

        /* Road Line */
        .snapshot-road-header::after {
          content: '';
          position: absolute;
          bottom: 0;
          left: 0;
          width: 100%;
          height: 2px;
          background: var(--border-color);
          opacity: 1;
        }

        @keyframes roadMove {
          from { background-position: 0 0; }
          to { background-position: -35px 0; }
        }

        /* Speed up road on hover */
        .snapshot-road-header:hover::after {
          animation: none;
          opacity: 1;
        }
        .snapshot-card {
          display: flex;
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: 16px;
          overflow: hidden;
          position: relative;
          box-shadow: var(--shadow-card);
        }

        .snapshot-content {
          flex: 1;
          padding: 2.5rem;
          display: flex;
          flex-direction: column;
          justify-content: center;
          z-index: 2;
        }

        .snapshot-header-visual {
          height: 80px;
          display: flex;
          align-items: flex-end;
          margin-bottom: -4px; /* Align wheels closer to the line */
          padding-right: 40px; /* Space for running */
          overflow: visible;
        }

        .snapshot-truck-header {
          height: 100%;
          width: auto;
          filter: drop-shadow(0 4px 8px rgba(0,0,0,0.1));
          animation: truckRun 0.6s infinite linear;
          transition: transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        @keyframes truckRun {
          0% { transform: translateY(0) translateX(0); }
          25% { transform: translateY(-0.6px) translateX(0.2px); }
          50% { transform: translateY(0) translateX(0); }
          75% { transform: translateY(-0.6px) translateX(-0.2px); }
          100% { transform: translateY(0) translateX(0); }
        }

        .snapshot-header-visual:hover .snapshot-truck-header {
          transform: scale(1.03) translateX(8px);
          filter: drop-shadow(0 8px 15px rgba(0,0,0,0.15));
        }

        /* Add a "wheel blur" effect on hover */
        .snapshot-header-visual:hover .snapshot-truck-header {
          animation: truckRun 0.25s infinite linear; /* Faster vibration when "moving" faster on hover */
        }

        .snapshot-meta-row {
          margin-bottom: 1rem;
        }

        .snapshot-industry-tag {
          background: var(--bg-subtle);
          color: var(--text-accent);
          padding: 0.4rem 1rem;
          border-radius: 999px;
          font-size: 0.75rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          border: 1px solid var(--border-color);
        }

        .snapshot-description {
          font-size: 1.15rem;
          line-height: 1.7;
          color: var(--text-main);
          margin: 0;
          font-weight: 500;
        }

        @media (max-width: 900px) {
          .snapshot-content {
            padding: 2rem;
          }
          .snapshot-truck-header {
            height: 60px;
          }
        }
        
        .section-title {
          font-size: 1.25rem;
          color: var(--text-main);
          margin: 0 0 1.5rem 0;
          font-weight: 700;
          border-bottom: 2px solid var(--border-color);
          padding-bottom: 0.75rem;
        }

        /* Terminal/Window Styling (Bright Mode) */
        .mission-split {
          display: flex;
          gap: 2rem;
          align-items: center;
        }

        .monitor-wrapper {
          flex: 0 0 320px;
          display: flex;
          flex-direction: column;
          align-items: center;
          perspective: 1000px;
        }

        .monitor-bezel {
          background: #1e293b;
          padding: 1rem;
          border-radius: 12px;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3), inset 0 0 0 2px rgba(255,255,255,0.1);
          width: 100%;
          position: relative;
        }

        .monitor-screen {
          background: #000;
          border-radius: 4px;
          overflow: hidden;
          position: relative;
          aspect-ratio: 16/9;
          border: 1px solid #334155;
        }

        .monitor-content {
          width: 100%;
          height: 100%;
          object-fit: cover;
          opacity: 0.9;
          filter: contrast(1.1) brightness(1.1);
        }

        .monitor-scanline {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: linear-gradient(
            to bottom,
            rgba(255,255,255,0),
            rgba(255,255,255,0) 50%,
            rgba(0,0,0,0.1) 50%,
            rgba(0,0,0,0.1)
          );
          background-size: 100% 4px;
          pointer-events: none;
          z-index: 2;
        }

        .monitor-logo {
          text-align: center;
          color: #64748b;
          font-size: 0.65rem;
          font-weight: 700;
          letter-spacing: 0.2em;
          margin-top: 0.5rem;
        }

        .monitor-power {
          width: 4px;
          height: 4px;
          border-radius: 50%;
          background: #ef4444;
          position: absolute;
          bottom: 12px;
          right: 20px;
          box-shadow: 0 0 4px #ef4444;
        }
        .monitor-power.on { background: #22c55e; box-shadow: 0 0 4px #22c55e; }

        .monitor-stand {
          width: 80px;
          height: 40px;
          background: linear-gradient(to bottom, #1e293b, #0f172a);
          margin-top: -5px;
          z-index: -1;
        }

        .monitor-base {
          width: 140px;
          height: 12px;
          background: #1e293b;
          border-radius: 4px 4px 0 0;
          box-shadow: 0 4px 6px rgba(0,0,0,0.2);
        }

        .terminal-box {
          background: var(--bg-card);
          border-radius: 12px;
          overflow: hidden;
          border: 1px solid var(--border-color);
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);
          height: 100%;
          display: flex;
          flex-direction: column;
        }

        .terminal-header {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 0.75rem 1rem;
          background: var(--bg-subtle);
          border-bottom: 1px solid var(--border-color);
        }

        @media (max-width: 900px) {
          .mission-split {
            flex-direction: column;
          }
          .monitor-wrapper {
            flex: none;
            width: 100%;
            max-width: 400px;
          }
        }

        .terminal-dots {
          display: flex;
          gap: 6px;
        }

        .dot {
          width: 12px;
          height: 12px;
          border-radius: 50%;
        }

        .dot.red { background: #ff5f56; border: 1px solid #e0443e; }
        .dot.yellow { background: #ffbd2e; border: 1px solid #dea123; }
        .dot.green { background: #27ca3f; border: 1px solid #1aab29; }

        .terminal-title {
          color: #64748b;
          font-size: 0.75rem;
          font-family: monospace;
          letter-spacing: 0.1em;
          font-weight: 600;
        }

        .terminal-content {
          padding: 2rem;
          min-height: 120px;
          background: var(--bg-card);
        }

        .typing-text {
          font-size: 1.125rem;
          color: var(--text-main);
          line-height: 1.8;
          font-family: 'JetBrains Mono', 'Fira Code', monospace;
        }

        .prompt {
          color: #3b82f6; /* Blue prompt instead of green */
          margin-right: 0.5rem;
          font-weight: bold;
        }

        .cursor {
          animation: blink 1s infinite;
          color: #3b82f6;
          font-weight: bold;
        }

        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }

        /* Info Cards */
        .info-cards {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1.5rem;
        }

        .info-card {
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: 12px;
          padding: 1.5rem;
          text-align: center;
          box-shadow: 0 1px 3px rgba(0,0,0,0.05);
          transition: transform 0.2s, box-shadow 0.2s;
        }
        
        .info-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 6px rgba(0,0,0,0.05);
        }

        .card-icon {
          font-size: 2rem;
          display: block;
          margin-bottom: 1rem;
        }

        .info-card h3 {
          color: var(--text-main);
          font-size: 1.1rem;
          margin: 0 0 0.5rem 0;
          font-weight: 600;
        }

        .info-card p {
          color: var(--text-muted);
          font-size: 0.9rem;
          margin: 0;
          line-height: 1.5;
        }

        /* Decision Areas */
        .decision-areas {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .decision-area {
          display: flex;
          align-items: flex-start;
          gap: 1.5rem;
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: 12px;
          padding: 1.25rem 1.5rem;
          box-shadow: 0 1px 2px rgba(0,0,0,0.05);
          transition: border-color 0.2s;
          cursor: pointer;
          text-align: left;
          width: 100%;
        }

        .decision-area:hover {
          border-color: var(--border-hover);
        }
        
        .decision-area:focus-visible {
          outline: 2px solid var(--text-accent);
          outline-offset: 2px;
        }

        .area-icon {
          font-size: 1.75rem;
          flex-shrink: 0;
          background: var(--bg-subtle);
          width: 3.5rem;
          height: 3.5rem;
          display: grid;
          place-items: center;
          border-radius: 10px;
          position: relative; /* Added for smoke positioning */
        }

        .smoke { 
          position: absolute; 
          top: 0; 
          right: 10px; 
          font-size: 1rem; 
          animation: smoke 3s infinite ease-out; 
          opacity: 0; 
          color: #94a3b8;
          pointer-events: none;
        }
        .smoke:nth-child(2) { animation-delay: 1s; right: 18px; }
        .smoke:nth-child(3) { animation-delay: 2s; right: 4px; }
        @keyframes smoke { 
          0% { transform: translateY(0) scale(1); opacity: 0.6; } 
          100% { transform: translateY(-30px) scale(2); opacity: 0; } 
        }

        .area-content h3 {
          color: var(--text-main);
          font-size: 1.1rem;
          margin: 0 0 0.25rem 0;
          font-weight: 600;
        }

        .area-content p {
          color: var(--text-muted);
          font-size: 0.95rem;
          margin: 0;
          line-height: 1.5;
        }

        /* Progress Info */
        .progress-info {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1.5rem;
          margin-bottom: 1.5rem;
        }

        .progress-item {
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: 12px;
        .progress-label {
          display: block;
          color: var(--text-muted);
          font-size: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 0.5rem;
          font-weight: 600;
        }

        .progress-value {
          display: block;
          color: var(--text-main);
          font-size: 1.5rem;
          font-weight: 700;
        }
        .progress-value.status-active { color: #3b82f6; }
        .progress-value.status-completed { color: #3b82f6; }
        .progress-value.status-inactive { color: #94a3b8; }

        .trial-note {
          background: #fffbeb;
          border: 1px solid #fcd34d;
          border-radius: 8px;
          padding: 1rem;
          color: #92400e;
          font-size: 0.9rem;
          margin: 0;
          line-height: 1.5;
        }

        .action-buttons {
          display: flex;
          justify-content: center;
          margin-top: 3rem;
        }

        .btn-modern-primary {
          background: ${theme === 'dark' ? '#3b82f6' : '#2563eb'} !important;
          color: #ffffff !important;
          border: none !important;
          padding: 1rem 2rem;
          border-radius: 8px;
          font-size: 1.125rem;
          font-weight: 700;
          letter-spacing: 0.01em;
          cursor: pointer;
          transition: all 0.2s;
          box-shadow: ${theme === 'dark' ? '0 4px 12px rgba(59, 130, 246, 0.25)' : '0 4px 12px rgba(37, 99, 235, 0.25)'};
          opacity: 1 !important;
          text-shadow: none !important;
        }

        .btn-modern-primary:hover {
          background: ${theme === 'dark' ? '#60a5fa' : '#1d4ed8'} !important;
          color: #ffffff !important;
          transform: translateY(-1px);
          box-shadow: ${theme === 'dark' ? '0 6px 16px rgba(59, 130, 246, 0.35)' : '0 6px 16px rgba(37, 99, 235, 0.35)'};
          opacity: 1 !important;
        }

        @media (max-width: 768px) {
          .info-cards,
          .progress-info {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
        </div >
    )
}

export default MissionModernPage
