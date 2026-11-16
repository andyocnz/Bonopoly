import { QRCodeSVG } from 'qrcode.react'
import { useState, useRef, useEffect, useMemo } from 'react'
import {
  GAME_OF_LIFE_SCENARIOS,
  STARTING_PROFILE,
  STARTING_STATS,
  CATEGORY_ICONS,
  CATEGORY_LABELS,
  STAGE_LABELS,
  applyCompounding,
  applyStatsDelta,
  computeNetWorth,
  financialWellbeingScore,
  monthlyTakeHome,
  determineEnding,
  formatDollars,
  type LifeProfile,
  type LifeStats,
  type LifeHistoryEntry,
  type LifeScenario,
  type LifeChoice,
} from '../engine/gameOfLifeScenarios'
import { MiniGameShell } from '../features/minigames/MiniGameShell'
import { getEducatorSessionCached } from '../features/minigames/educatorSession'
import { educatorMiniGamesApi } from '../features/minigames/api'
import { useTheme } from '../context/ThemeContext'
import { ScenarioIllustration } from './GameOfLifeIllustrations'
import './GameOfLifePage.css'

const GAME_SLUG = 'game-of-life' as const

// ─── Types ─────────────────────────────────────────────────────────────────

type GamePhase = 'setup' | 'playing' | 'result'

interface ChoiceRecord {
  round: number
  choiceId: string
  choiceLabel: string
}

// ─── Stat Bar ──────────────────────────────────────────────────────────────

function StatBar({ label, value, icon }: { label: string; value: number; icon: string }) {
  const colour =
    value >= 75 ? '#34d399' : value >= 50 ? '#38bdf8' : value >= 30 ? '#fbbf24' : '#f87171'
  return (
    <div className="gol-stat">
      <div className="gol-stat-header">
        <span className="gol-stat-icon">{icon}</span>
        <span className="gol-stat-label">{label}</span>
        <span className="gol-stat-value" style={{ color: colour }}>{value}</span>
      </div>
      <div className="gol-stat-track">
        <div
          className="gol-stat-fill"
          style={{ width: `${value}%`, background: colour }}
        />
      </div>
    </div>
  )
}

// ─── Net Worth Chart ───────────────────────────────────────────────────────

function NetWorthChart({ history }: { history: LifeHistoryEntry[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { theme } = useTheme()

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || history.length === 0) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const isDark = theme === 'dark'
    const gridColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'
    const labelColor = isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.45)'

    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    ctx.scale(dpr, dpr)

    const W = rect.width
    const H = rect.height
    const pad = { top: 10, right: 10, bottom: 24, left: 52 }
    const chartW = W - pad.left - pad.right
    const chartH = H - pad.top - pad.bottom

    const values = history.map(h => h.profileAfter.netWorth)
    const min = Math.min(0, ...values)
    const max = Math.max(1, ...values)
    const range = max - min || 1

    const toX = (i: number) => pad.left + (i / Math.max(history.length - 1, 1)) * chartW
    const toY = (v: number) => pad.top + chartH - ((v - min) / range) * chartH

    // Zero line
    const zeroY = toY(0)
    ctx.strokeStyle = gridColor
    ctx.lineWidth = 1
    ctx.setLineDash([4, 4])
    ctx.beginPath()
    ctx.moveTo(pad.left, zeroY)
    ctx.lineTo(W - pad.right, zeroY)
    ctx.stroke()
    ctx.setLineDash([])

    // Gradient fill
    const grad = ctx.createLinearGradient(0, pad.top, 0, H - pad.bottom)
    grad.addColorStop(0, 'rgba(52,211,153,0.3)')
    grad.addColorStop(1, 'rgba(52,211,153,0.0)')
    ctx.beginPath()
    values.forEach((v, i) => {
      if (i === 0) ctx.moveTo(toX(i), toY(v))
      else ctx.lineTo(toX(i), toY(v))
    })
    ctx.lineTo(toX(values.length - 1), zeroY)
    ctx.lineTo(toX(0), zeroY)
    ctx.closePath()
    ctx.fillStyle = grad
    ctx.fill()

    // Line
    ctx.beginPath()
    ctx.strokeStyle = '#34d399'
    ctx.lineWidth = 2
    ctx.lineJoin = 'round'
    values.forEach((v, i) => {
      if (i === 0) ctx.moveTo(toX(i), toY(v))
      else ctx.lineTo(toX(i), toY(v))
    })
    ctx.stroke()

    // Dots
    values.forEach((v, i) => {
      ctx.beginPath()
      ctx.arc(toX(i), toY(v), 3, 0, Math.PI * 2)
      ctx.fillStyle = '#34d399'
      ctx.fill()
    })

    // Y labels
    ctx.fillStyle = labelColor
    ctx.font = "10px 'Plus Jakarta Sans', system-ui, sans-serif"
    ctx.textAlign = 'right'
    const ticks = [min, (min + max) / 2, max]
    ticks.forEach(t => {
      ctx.fillText(formatDollars(t), pad.left - 4, toY(t) + 4)
    })

    // X labels (ages)
    ctx.textAlign = 'center'
    history.forEach((h, i) => {
      if (i % 3 === 0 || i === history.length - 1) {
        ctx.fillText(String(h.age), toX(i), H - 4)
      }
    })
  }, [history, theme])

  return (
    <canvas
      ref={canvasRef}
      className="gol-chart-canvas"
      style={{ width: '100%', height: '100%' }}
    />
  )
}

// ─── Result Screen ────────────────────────────────────────────────────────

function ResultScreen({
  profile,
  stats,
  history,
  choices,
  onRestart,
  hasStudentContext,
}: {
  profile: LifeProfile
  stats: LifeStats
  history: LifeHistoryEntry[]
  choices: ChoiceRecord[]
  onRestart: () => void
  hasStudentContext: boolean
}) {
  const { theme, toggleTheme } = useTheme()
  const ending = determineEnding(profile, stats)
  const nw = computeNetWorth(profile)
  const fwScore = financialWellbeingScore(profile)
  const [showRoadNotTaken, setShowRoadNotTaken] = useState(false)

  // Pick 3 "hinge" moments to show in Road Not Taken
  const hingeRounds = [3, 9, 14]
  const hingeHistory = history.filter(h => hingeRounds.includes(h.round))

  return (
    <MiniGameShell
      title="Game of Life"
      subtitle="Ages 17–65 · 18 Decisions · One Life"
      sessionsGameType={GAME_SLUG}
      publicMode={hasStudentContext}
    >
      <div className="gol-result">
        {/* Theme toggle — only in student/public mode (educator uses shell topbar) */}
        {hasStudentContext && (
          <button
            type="button"
            className="gol-theme-toggle-float"
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
        )}
        {/* Ending archetype */}
        <div className="gol-result-archetype">
          <div className="gol-result-emoji">{ending.emoji}</div>
          <h2 className="gol-result-title">{ending.title}</h2>
          <p className="gol-result-desc">{ending.description}</p>
        </div>

        {/* Key numbers */}
        <div className="gol-result-numbers">
          <div className="gol-result-number">
            <div className="gol-result-number-label">Net Worth at 65</div>
            <div className="gol-result-number-value" style={{ color: nw >= 0 ? '#34d399' : '#f87171' }}>
              {formatDollars(nw)}
            </div>
          </div>
          <div className="gol-result-number">
            <div className="gol-result-number-label">KiwiSaver</div>
            <div className="gol-result-number-value" style={{ color: '#38bdf8' }}>
              {formatDollars(profile.kiwisaverBalance)}
            </div>
          </div>
          <div className="gol-result-number">
            <div className="gol-result-number-label">Financial Wellbeing</div>
            <div className="gol-result-number-value" style={{ color: '#fbbf24' }}>
              {fwScore}/100
            </div>
          </div>
          <div className="gol-result-number">
            <div className="gol-result-number-label">NZ Super pw</div>
            <div className="gol-result-number-value" style={{ color: '#a78bfa' }}>
              $496
            </div>
          </div>
        </div>

        {/* Life stats */}
        <div className="gol-result-stats">
          <StatBar label="Career Capital" value={stats.careerCapital} icon="🎯" />
          <StatBar label="Happiness"      value={stats.happiness}      icon="😊" />
          <StatBar label="Health"         value={stats.health}         icon="🏥" />
          <StatBar label="Relationships"  value={stats.relationships}  icon="🤝" />
        </div>

        {/* Net worth chart */}
        <div className="gol-result-chart-wrap">
          <div className="gol-result-chart-title">Your Net Worth Journey (Ages 17–65)</div>
          <div className="gol-result-chart">
            <NetWorthChart history={history} />
          </div>
        </div>

        {/* Reflection */}
        <div className="gol-result-reflection">
          <div className="gol-result-reflection-title">Looking Back</div>
          <p>{ending.reflection}</p>
        </div>

        {/* Road not taken */}
        <div className="gol-road-not-taken">
          <button
            className="gol-road-toggle"
            onClick={() => setShowRoadNotTaken(v => !v)}
          >
            {showRoadNotTaken ? '▲' : '▼'} The Road Not Taken
          </button>
          {showRoadNotTaken && (
            <div className="gol-road-items">
              {hingeHistory.map(h => {
                const scenario = GAME_OF_LIFE_SCENARIOS.find(s => s.round === h.round)
                if (!scenario) return null
                const otherChoices = scenario.choices.filter(c => c.id !== h.choiceId)
                const bestOther = otherChoices.find(c => c.quality === 'good') ?? otherChoices[0]
                return (
                  <div key={h.round} className="gol-road-item">
                    <div className="gol-road-item-header">
                      <span className="gol-road-age">Age {h.age}</span>
                      <span className="gol-road-title">{h.scenarioTitle}</span>
                    </div>
                    <div className="gol-road-you">
                      <span className="gol-road-you-label">You chose:</span> {h.choiceLabel}
                    </div>
                    {bestOther && (
                      <div className="gol-road-alt">
                        <span className="gol-road-alt-label">What if:</span> {bestOther.label}
                        <div className="gol-road-alt-insight">{bestOther.insight}</div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Decision log */}
        <div className="gol-decision-log">
          <div className="gol-log-title">Your 18 Decisions</div>
          <div className="gol-log-items">
            {history.map(h => (
              <div key={h.round} className="gol-log-item">
                <div className="gol-log-age">Age {h.age}</div>
                <div className="gol-log-scenario">{h.scenarioTitle}</div>
                <div className={`gol-log-choice gol-log-choice--${h.choiceQuality}`}>
                  {h.choiceLabel}
                </div>
                <div className="gol-log-delta" style={{ color: h.netWorthDelta >= 0 ? '#34d399' : '#f87171' }}>
                  {h.netWorthDelta >= 0 ? '+' : ''}{formatDollars(h.netWorthDelta)}
                </div>
              </div>
            ))}
          </div>
        </div>

        <button className="gol-restart-btn" onClick={onRestart}>
          Play Again
        </button>
      </div>
    </MiniGameShell>
  )
}

// ─── Main Game ────────────────────────────────────────────────────────────

export default function GameOfLifePage() {
  const { theme, toggleTheme } = useTheme()
  const query = useMemo(() => new URLSearchParams(window.location.search), [])
  const roomFromUrl = (query.get('room') || '').trim().toUpperCase()
  const inviteToken = (query.get('invite') || '').trim()
  const hasStudentContext = Boolean(roomFromUrl || inviteToken)

  const [phase, setPhase] = useState<GamePhase>(hasStudentContext ? 'playing' : 'setup')
  const [authChecked, setAuthChecked] = useState(hasStudentContext)
  const [canAccessSetup, setCanAccessSetup] = useState(hasStudentContext)
  const [studentAccessResolved, setStudentAccessResolved] = useState(!hasStudentContext)
  const [studentAccessAllowed, setStudentAccessAllowed] = useState(!hasStudentContext)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const [createdLink, setCreatedLink] = useState<{ roomCode: string; joinLink: string } | null>(null)
  const [sessionsRefreshKey, setSessionsRefreshKey] = useState(0)

  // Game state
  const [round, setRound] = useState(1)
  const [profile, setProfile] = useState<LifeProfile>(STARTING_PROFILE)
  const [stats, setStats] = useState<LifeStats>(STARTING_STATS)
  const [history, setHistory] = useState<LifeHistoryEntry[]>([])
  const [choiceRecords, setChoiceRecords] = useState<ChoiceRecord[]>([])
  const [selectedChoice, setSelectedChoice] = useState<LifeChoice | null>(null)
  const [showConsequence, setShowConsequence] = useState(false)
  const [showSidebar, setShowSidebar] = useState(false)
  const topRef = useRef<HTMLDivElement>(null)

  // ── Auth check for educator setup access ──
  useEffect(() => {
    if (hasStudentContext) return
    let cancelled = false
    getEducatorSessionCached(true).then(s => {
      if (!cancelled) { setCanAccessSetup(s.ok); setAuthChecked(true) }
    })
    return () => { cancelled = true }
  }, [hasStudentContext])

  useEffect(() => {
    if (!hasStudentContext && authChecked && !canAccessSetup) {
      window.location.href = '/educator-login'
    }
  }, [hasStudentContext, authChecked, canAccessSetup])

  // ── Student access validation ──
  useEffect(() => {
    if (!hasStudentContext) {
      setStudentAccessAllowed(true)
      setStudentAccessResolved(true)
      return
    }
    let cancelled = false
    const validateStudentContext = async () => {
      try {
        let roomCode = roomFromUrl
        if (inviteToken) {
          const inviteResponse = await fetch(`/api/minigames/invite/${encodeURIComponent(inviteToken)}`, {
            headers: { 'Content-Type': 'application/json' },
          })
          if (!inviteResponse.ok) throw new Error('Invalid invite')
          const inviteData = await inviteResponse.json() as {
            success?: boolean
            invite?: { gameType?: string; roomCode?: string | null }
          }
          if (!inviteData.success || inviteData.invite?.gameType !== GAME_SLUG) {
            throw new Error('Invalid invite')
          }
          if (!roomCode) {
            roomCode = String(inviteData.invite?.roomCode || '').trim().toUpperCase()
          }
        }
        if (!roomCode) throw new Error('Missing room code')

        const roomResponse = await fetch(`/api/minigames/join/${encodeURIComponent(roomCode)}`, {
          headers: { 'Content-Type': 'application/json' },
        })
        if (!roomResponse.ok) throw new Error('Invalid room code')
        const roomData = await roomResponse.json() as {
          success?: boolean
          room?: { gameType?: string }
        }
        if (!roomData.success || roomData.room?.gameType !== GAME_SLUG) {
          throw new Error('Invalid room code')
        }
        if (!cancelled) {
          setStudentAccessAllowed(true)
          setStudentAccessResolved(true)
        }
      } catch {
        if (!cancelled) {
          setStudentAccessAllowed(false)
          setStudentAccessResolved(true)
        }
      }
    }
    void validateStudentContext()
    return () => { cancelled = true }
  }, [hasStudentContext, inviteToken, roomFromUrl])

  useEffect(() => {
    if (hasStudentContext && phase === 'setup') setPhase('playing')
  }, [hasStudentContext, phase])

  // ── Session creation ──
  async function handleCreateLink() {
    setCreating(true); setCreateError('')
    try {
      const res = await educatorMiniGamesApi.createSession({ gameType: GAME_SLUG, teamCount: 1 })
      const roomCode = res.session.roomCode || ''
      const joinLink = roomCode
        ? `${window.location.origin}/mini-games/game-of-life?room=${encodeURIComponent(roomCode)}`
        : (res.session.joinByCodeLink || `${window.location.origin}/mini-games/join`)
      setCreatedLink({ roomCode: res.session.roomCode || '', joinLink })
      setSessionsRefreshKey(k => k + 1)
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setCreating(false)
    }
  }

  // ── Student loading state ──
  if (hasStudentContext && !studentAccessResolved) {
    return (
      <MiniGameShell title="Game of Life" subtitle="Ages 17–65 · 18 Decisions · One Life" publicMode>
        <div style={{ maxWidth: 760, margin: '0 auto', padding: '32px 20px' }}>
          <div style={{ background: 'var(--mg-surface)', border: '1px solid var(--mg-border)', borderRadius: 12, padding: 24 }}>
            Validating classroom access...
          </div>
        </div>
      </MiniGameShell>
    )
  }
  if (hasStudentContext && !studentAccessAllowed) {
    return (
      <MiniGameShell title="Game of Life" subtitle="Ages 17-65 · 18 Decisions · One Life" publicMode>
        <div style={{ maxWidth: 760, margin: '0 auto', padding: '32px 20px' }}>
          <div style={{ background: 'var(--mg-surface)', border: '1px solid var(--mg-border)', borderRadius: 12, padding: 24 }}>
            This classroom link is invalid or expired. Please ask your educator for a new share link.
          </div>
        </div>
      </MiniGameShell>
    )
  }

  // ── Game logic ──

  const scenario: LifeScenario | undefined = GAME_OF_LIFE_SCENARIOS.find(s => s.round === round)
  const totalRounds = GAME_OF_LIFE_SCENARIOS.length
  const progress = (round - 1) / (totalRounds - 1)

  function handleStart() {
    setPhase('playing')
    setRound(1)
    setProfile(STARTING_PROFILE)
    setStats(STARTING_STATS)
    setHistory([])
    setChoiceRecords([])
    setSelectedChoice(null)
    setShowConsequence(false)
  }

  function handleSelectChoice(choice: LifeChoice) {
    if (showConsequence) return
    setSelectedChoice(choice)
  }

  function handleConfirmChoice() {
    if (!selectedChoice || !scenario) return

    const profileBefore = { ...profile }
    const statsBefore = { ...stats }

    let newProfile: LifeProfile = { ...profile }
    const pd = selectedChoice.impact.profileDelta
    Object.entries(pd).forEach(([k, v]) => {
      if (v === undefined) return
      const key = k as keyof LifeProfile
      if (typeof v === 'number' && typeof newProfile[key] === 'number') {
        ;(newProfile as Record<string, number>)[key] =
          ((newProfile as Record<string, number>)[key] ?? 0) + v
      } else {
        ;(newProfile as Record<string, unknown>)[key] = v
      }
    })

    if (selectedChoice.impact.setEducationPath !== undefined)
      newProfile.educationPath = selectedChoice.impact.setEducationPath
    if (selectedChoice.impact.setJobLevel !== undefined)
      newProfile.jobLevel = selectedChoice.impact.setJobLevel
    if (selectedChoice.impact.setInsurance !== undefined)
      newProfile.insuranceType = selectedChoice.impact.setInsurance

    if (selectedChoice.impact.monthlyIncomeDelta) {
      newProfile.grossAnnualIncome += selectedChoice.impact.monthlyIncomeDelta * 12
    }
    if (selectedChoice.impact.monthlyExpenseDelta) {
      newProfile.monthlyExpenseOffset = (newProfile.monthlyExpenseOffset ?? 0) + selectedChoice.impact.monthlyExpenseDelta
    }

    newProfile.savings = Math.max(-100_000, newProfile.savings)
    newProfile.studentLoanBalance = Math.max(0, newProfile.studentLoanBalance)
    newProfile.kiwisaverBalance = Math.max(0, newProfile.kiwisaverBalance)

    const newStats = applyStatsDelta(stats, selectedChoice.impact.statsDelta)

    if (scenario.yearsElapsed > 0) {
      newProfile = applyCompounding(newProfile, scenario.yearsElapsed)
    }

    newProfile.netWorth = computeNetWorth(newProfile)

    const entry: LifeHistoryEntry = {
      round,
      age: scenario.age,
      scenarioId: scenario.id,
      scenarioTitle: scenario.title,
      category: scenario.category,
      choiceId: selectedChoice.id,
      choiceLabel: selectedChoice.label,
      choiceQuality: selectedChoice.quality,
      consequence: selectedChoice.consequence,
      insight: selectedChoice.insight,
      profileBefore,
      profileAfter: newProfile,
      statsBefore,
      statsAfter: newStats,
      netWorthDelta: newProfile.netWorth - profileBefore.netWorth,
    }

    setProfile(newProfile)
    setStats(newStats)
    setHistory(prev => [...prev, entry])
    setChoiceRecords(prev => [
      ...prev,
      { round, choiceId: selectedChoice.id, choiceLabel: selectedChoice.label },
    ])
    setShowConsequence(true)
    topRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  function handleNextRound() {
    if (round >= totalRounds) {
      setPhase('result')
      return
    }
    setRound(r => r + 1)
    setSelectedChoice(null)
    setShowConsequence(false)
    topRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const nw = computeNetWorth(profile)
  const fwScore = financialWellbeingScore(profile)
  const monthlyIncome = monthlyTakeHome(profile.grossAnnualIncome)
  const isLastRound = scenario?.stage === 'legacy'
  const lastEntry = history[history.length - 1]

  // ── Setup phase ──
  if (phase === 'setup') {
    return (
      <MiniGameShell
        title="Game of Life"
        subtitle="Ages 17–65 · 18 Decisions · One Life"
        sessionsGameType={GAME_SLUG}
        showSessionsTable={authChecked && canAccessSetup}
        sessionsRefreshKey={sessionsRefreshKey}
        publicMode={false}
      >
        <div style={{ maxWidth: 760, margin: '0 auto', padding: '32px 20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 32 }}>
            {/* Game description */}
            <div style={{ background: 'var(--mg-surface)', border: '1px solid var(--mg-border)', borderRadius: 12, padding: 24 }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>🌱</div>
              <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, marginTop: 0, color: 'var(--mg-text)' }}>Game of Life</h2>
              <p style={{ fontSize: 14, color: 'var(--mg-muted)', lineHeight: 1.6, marginBottom: 16, marginTop: 0 }}>
                Students make <strong style={{ color: 'var(--mg-text)' }}>18 decisions</strong> across a simulated lifetime — ages 17 to 65.
                The core lesson: <strong style={{ color: 'var(--mg-text)' }}>small financial choices compound dramatically</strong> over decades.
              </p>
              <div style={{ fontSize: 13, color: 'var(--mg-muted)', lineHeight: 1.9 }}>
                <div>🌱 <strong style={{ color: 'var(--mg-text)' }}>Foundation (17–25)</strong> — KiwiSaver, education, BNPL traps</div>
                <div>🏗️ <strong style={{ color: 'var(--mg-text)' }}>Build (25–40)</strong> — housing, career pivots, family decisions</div>
                <div>🌾 <strong style={{ color: 'var(--mg-text)' }}>Harvest (40–60)</strong> — burnout, investment, health costs</div>
                <div>🌅 <strong style={{ color: 'var(--mg-text)' }}>Legacy (65)</strong> — retirement reveal with 6 ending archetypes</div>
              </div>
            </div>

            {/* Assign to students */}
            <div style={{ background: 'var(--mg-surface)', border: '1px solid var(--mg-border)', borderRadius: 12, padding: 24 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, marginTop: 0, color: 'var(--mg-text)' }}>Assign to Students</h3>
              <p style={{ fontSize: 13, color: 'var(--mg-muted)', marginBottom: 16, marginTop: 0, lineHeight: 1.5 }}>
                Create a shareable link to send students directly to this simulation.
              </p>
              <button
                onClick={() => void handleCreateLink()}
                disabled={creating}
                style={{ width: '100%', padding: '10px', background: 'var(--mg-accent)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: creating ? 'not-allowed' : 'pointer', marginBottom: 10, opacity: creating ? 0.7 : 1 }}
              >
                {creating ? 'Creating…' : '+ Create Student Link'}
              </button>
              <button
                onClick={handleStart}
                style={{ width: '100%', padding: '10px', background: 'transparent', color: 'var(--mg-muted)', border: '1px solid var(--mg-border)', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
              >
                ▶ Test Solo
              </button>
              {createError && <p style={{ color: '#dc2626', fontSize: 12, marginTop: 8 }}>{createError}</p>}
              {createdLink && (
                <div style={{ marginTop: 14, padding: 12, background: 'var(--mg-surface-2)', borderRadius: 8, border: '1px solid var(--mg-border)' }}>
                  <div style={{ fontSize: 12, color: 'var(--mg-muted)', marginBottom: 6 }}>Student link:</div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input
                      readOnly
                      value={createdLink.joinLink}
                      style={{ flex: 1, fontSize: 11, padding: '6px 8px', borderRadius: 6, border: '1px solid var(--mg-border)', background: 'var(--mg-surface)', color: 'var(--mg-text)', minWidth: 0 }}
                    />
                    <button
                      onClick={() => navigator.clipboard.writeText(createdLink.joinLink)}
                      style={{ padding: '6px 10px', background: 'var(--mg-accent)', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}
                    >
                      Copy
                    </button>
                  </div>
                  <div style={{ marginTop: 12, display: 'flex', justifyContent: 'center', background: '#fff', borderRadius: 8, padding: 12 }}>
                    <QRCodeSVG value={createdLink.joinLink} size={200} bgColor="#ffffff" fgColor="#0f172a" level="M" />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* What students track */}
          <div style={{ background: 'var(--mg-surface)', border: '1px solid var(--mg-border)', borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--mg-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>What Students Track Across Their Life</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
              {[
                { label: 'Net Worth', icon: '💰', desc: 'Savings, property, KiwiSaver minus debt', color: '#34d399' },
                { label: 'Career Capital', icon: '🎯', desc: 'Skills, experience, and earning potential', color: '#38bdf8' },
                { label: 'Happiness', icon: '😊', desc: 'Work–life balance and fulfilment', color: '#fbbf24' },
                { label: 'Health', icon: '🏥', desc: 'Physical and mental wellbeing', color: '#f87171' },
                { label: 'Relationships', icon: '🤝', desc: 'Family, friendships, and support network', color: '#a78bfa' },
              ].map(({ label, icon, desc, color }) => (
                <div key={label} style={{ padding: 12, background: 'var(--mg-surface-2)', borderRadius: 8, borderTop: `3px solid ${color}` }}>
                  <div style={{ fontSize: 18, marginBottom: 4 }}>{icon}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--mg-text)', marginBottom: 2 }}>{label}</div>
                  <div style={{ fontSize: 11, color: 'var(--mg-muted)', lineHeight: 1.4 }}>{desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </MiniGameShell>
    )
  }

  // ── Result phase ──
  if (phase === 'result') {
    return (
      <ResultScreen
        profile={profile}
        stats={stats}
        history={history}
        choices={choiceRecords}
        onRestart={handleStart}
        hasStudentContext={hasStudentContext}
      />
    )
  }

  // ── Playing phase ──
  if (!scenario) return null
  const stageName = STAGE_LABELS[scenario.stage]

  return (
    <MiniGameShell
      title="Game of Life"
      subtitle="Ages 17–65 · 18 Decisions · One Life"
      sessionsGameType={GAME_SLUG}
      publicMode={hasStudentContext}
    >
      <div className="gol-game" ref={topRef}>
        {/* ── Header bar ── */}
        <div className="gol-header">
          <div className="gol-header-left">
            <span className="gol-age-badge">Age {scenario.age}</span>
            <span className="gol-stage-badge">{stageName}</span>
            {scenario.yearsElapsed > 1 && (
              <span className="gol-years-badge">{scenario.yearsElapsed} years this round</span>
            )}
          </div>
          <div className="gol-header-center">
            <div className="gol-progress-track">
              <div className="gol-progress-fill" style={{ width: `${progress * 100}%` }} />
            </div>
            <div className="gol-progress-label">Round {round} of {totalRounds}</div>
          </div>
          <div className="gol-header-right">
            {!hasStudentContext && (
              <button
                className="gol-leave-btn"
                onClick={() => setPhase('setup')}
              >
                ← Setup
              </button>
            )}
            {hasStudentContext && (
              <button
                type="button"
                className="gol-theme-toggle"
                onClick={toggleTheme}
                title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {theme === 'dark' ? '☀️' : '🌙'}
              </button>
            )}
            <button
              className="gol-sidebar-toggle"
              onClick={() => setShowSidebar(v => !v)}
              title="Your stats"
            >
              📊
            </button>
          </div>
        </div>

        <div className="gol-layout">
          {/* ── Main content ── */}
          <main className="gol-main">
            {/* Scenario card */}
            {!showConsequence ? (
              <div className="gol-scenario-card">
                <div className="gol-illustration">
                  <ScenarioIllustration key={scenario.id} scenarioId={scenario.id} category={scenario.category} />
                </div>
                <div className="gol-scenario-meta">
                  <span className="gol-category-badge">
                    {CATEGORY_ICONS[scenario.category]} {CATEGORY_LABELS[scenario.category]}
                  </span>
                  {scenario.nzStat && (
                    <div className="gol-nz-stat">📌 {scenario.nzStat}</div>
                  )}
                </div>

                <h2 className="gol-scenario-title">{scenario.title}</h2>
                <div className="gol-scenario-story">{scenario.story}</div>

                {/* Choices */}
                {!isLastRound && (
                  <div className="gol-choices">
                    {scenario.choices.map(choice => (
                      <button
                        key={choice.id}
                        className={[
                          'gol-choice',
                          `gol-choice--${choice.quality}`,
                          selectedChoice?.id === choice.id ? 'gol-choice--selected' : '',
                        ].join(' ')}
                        onClick={() => handleSelectChoice(choice)}
                      >
                        <div className="gol-choice-label">{choice.label}</div>
                        {choice.sublabel && (
                          <div className="gol-choice-sublabel">{choice.sublabel}</div>
                        )}
                      </button>
                    ))}
                  </div>
                )}

                {selectedChoice && !isLastRound && (
                  <button className="gol-confirm-btn" onClick={handleConfirmChoice}>
                    Confirm: {selectedChoice.label} →
                  </button>
                )}

                {isLastRound && (
                  <button className="gol-confirm-btn" onClick={() => setPhase('result')}>
                    See My Life Results →
                  </button>
                )}
              </div>
            ) : (
              /* Consequence card */
              <div className="gol-consequence-card">
                <div className="gol-consequence-header">
                  <span className="gol-consequence-age">Age {scenario.age + scenario.yearsElapsed}</span>
                  <span className="gol-consequence-title">The outcome</span>
                </div>

                <div className="gol-consequence-choice">
                  You chose: <strong>{lastEntry?.choiceLabel}</strong>
                </div>

                <div className="gol-consequence-story">
                  {lastEntry?.consequence}
                </div>

                <div className="gol-insight-box">
                  <div className="gol-insight-header">💡 What this teaches you</div>
                  <div className="gol-insight-text">{lastEntry?.insight}</div>
                </div>

                {/* Net worth delta */}
                <div className="gol-delta-row">
                  <div className="gol-delta-item">
                    <div className="gol-delta-label">Net Worth Change</div>
                    <div
                      className="gol-delta-value"
                      style={{ color: (lastEntry?.netWorthDelta ?? 0) >= 0 ? '#34d399' : '#f87171' }}
                    >
                      {(lastEntry?.netWorthDelta ?? 0) >= 0 ? '+' : ''}
                      {formatDollars(lastEntry?.netWorthDelta ?? 0)}
                    </div>
                  </div>
                  <div className="gol-delta-item">
                    <div className="gol-delta-label">Net Worth Now</div>
                    <div className="gol-delta-value" style={{ color: nw >= 0 ? '#34d399' : '#f87171' }}>
                      {formatDollars(nw)}
                    </div>
                  </div>
                  {profile.kiwisaverBalance > 0 && (
                    <div className="gol-delta-item">
                      <div className="gol-delta-label">KiwiSaver</div>
                      <div className="gol-delta-value" style={{ color: '#38bdf8' }}>
                        {formatDollars(profile.kiwisaverBalance)}
                      </div>
                    </div>
                  )}
                </div>

                {/* Stat changes */}
                {lastEntry && (
                  <div className="gol-stat-changes">
                    {(
                      [
                        { key: 'careerCapital', label: 'Career', icon: '🎯' },
                        { key: 'happiness',     label: 'Happiness', icon: '😊' },
                        { key: 'health',        label: 'Health', icon: '🏥' },
                        { key: 'relationships', label: 'Relationships', icon: '🤝' },
                      ] as const
                    ).map(({ key, label, icon }) => {
                      const delta = lastEntry.statsAfter[key] - lastEntry.statsBefore[key]
                      if (delta === 0) return null
                      return (
                        <div key={key} className="gol-stat-change">
                          <span className="gol-stat-change-icon">{icon}</span>
                          <span className="gol-stat-change-label">{label}</span>
                          <span
                            className="gol-stat-change-delta"
                            style={{ color: delta > 0 ? '#34d399' : '#f87171' }}
                          >
                            {delta > 0 ? '+' : ''}{delta}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}

                <button className="gol-next-btn" onClick={handleNextRound}>
                  {round < totalRounds ? `Continue to Age ${GAME_OF_LIFE_SCENARIOS[round]?.age ?? ''}  →` : 'See My Final Results →'}
                </button>
              </div>
            )}
          </main>

          {/* ── Sidebar ── */}
          <aside className={`gol-sidebar ${showSidebar ? 'gol-sidebar--open' : ''}`}>
            <div className="gol-sidebar-section">
              <div className="gol-sidebar-title">Your Life Stats</div>
              <StatBar label="Career Capital" value={stats.careerCapital} icon="🎯" />
              <StatBar label="Happiness"      value={stats.happiness}      icon="😊" />
              <StatBar label="Health"         value={stats.health}         icon="🏥" />
              <StatBar label="Relationships"  value={stats.relationships}  icon="🤝" />
              <StatBar label="Financial Wellbeing" value={fwScore}         icon="💰" />
            </div>

            <div className="gol-sidebar-section">
              <div className="gol-sidebar-title">Finances</div>
              <div className="gol-finance-row">
                <span>Net Worth</span>
                <span style={{ color: nw >= 0 ? '#34d399' : '#f87171' }}>{formatDollars(nw)}</span>
              </div>
              <div className="gol-finance-row">
                <span>Monthly Take-Home</span>
                <span>{formatDollars(monthlyIncome)}/mo</span>
              </div>
              {profile.kiwisaverBalance > 0 && (
                <div className="gol-finance-row">
                  <span>KiwiSaver</span>
                  <span style={{ color: '#38bdf8' }}>{formatDollars(profile.kiwisaverBalance)}</span>
                </div>
              )}
              {profile.studentLoanBalance > 0 && (
                <div className="gol-finance-row">
                  <span>Student Loan</span>
                  <span style={{ color: '#f87171' }}>-{formatDollars(profile.studentLoanBalance)}</span>
                </div>
              )}
              {profile.creditCardDebt > 0 && (
                <div className="gol-finance-row">
                  <span>Credit Card Debt</span>
                  <span style={{ color: '#f87171' }}>-{formatDollars(profile.creditCardDebt)}</span>
                </div>
              )}
              {profile.hasProperty && (
                <div className="gol-finance-row">
                  <span>Property Equity</span>
                  <span style={{ color: '#fbbf24' }}>{formatDollars(profile.propertyEquity)}</span>
                </div>
              )}
            </div>

            {history.length > 0 && (
              <div className="gol-sidebar-section">
                <div className="gol-sidebar-title">Net Worth</div>
                <div className="gol-sidebar-chart">
                  <NetWorthChart history={history} />
                </div>
              </div>
            )}

            {history.length > 0 && (
              <div className="gol-sidebar-section">
                <div className="gol-sidebar-title">Recent Choices</div>
                <div className="gol-recent-choices">
                  {history.slice(-3).reverse().map(h => (
                    <div key={h.round} className="gol-recent-choice">
                      <span className="gol-recent-age">Age {h.age}</span>
                      <span className={`gol-recent-quality gol-recent-quality--${h.choiceQuality}`}>
                        {h.choiceQuality}
                      </span>
                      <span className="gol-recent-label">{h.choiceLabel}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>
    </MiniGameShell>
  )
}
