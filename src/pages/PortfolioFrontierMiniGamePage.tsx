import { QRCodeSVG } from 'qrcode.react'
import { useEffect, useMemo, useState, useRef } from 'react'
import { getEducatorSessionCached, getEducatorSessionSync } from '../features/minigames/educatorSession'
import { MiniGameShell } from '../features/minigames/MiniGameShell'
import './PortfolioFrontierMiniGamePage.css'
import '../features/minigames/SessionControlPanel.css'
import { educatorMiniGamesApi } from '../features/minigames/api'
import { MiniGameSessionsTable } from '../features/minigames/MiniGameSessionsTable'
import type { EducatorMiniGameSession } from '../api/client'
import { BarChart, Bar, XAxis, YAxis, ReferenceLine, ResponsiveContainer, Tooltip, Cell } from 'recharts'

const STORAGE_KEY = 'portfolio-frontier_minigame_v1'
const GAME_SLUG = 'portfolio-frontier'

type PfConfig = { rounds: number; simCount: number; years: number; initialInvestment: number; goalAmount: number; goalThreshold: number; minVolatility: number }
type PfPlayer = { id: string; name: string; isBot: boolean; totalScore: number; hasActedThisRound: boolean }
type PfPlayerResult = { playerId: string; playerName: string; expectedReturn: number; riskLevel: number; finalValues: number[]; pathsHitGoal: number; successRate: number; roundScore: number }
type PfRoundSummary = { round: number; results: PfPlayerResult[] }
type Session = {
  roomCode: string; phase: 'lobby' | 'playing' | 'results'
  currentRound: number; config: PfConfig
  players: PfPlayer[]; history: PfRoundSummary[]; eventLog: string[]
  stats: { actedCount: number; waitingCount: number }
  viewer: { totalScore: number; hasActed: boolean } | null
}
type Tokens = { roomCode: string; hostToken: string | null; playerToken: string | null; playerName: string | null }
const EMPTY_TOKENS: Tokens = { roomCode: '', hostToken: null, playerToken: null, playerName: null }

function loadTokens(): Tokens {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') ?? EMPTY_TOKENS } catch { return EMPTY_TOKENS }
}
function saveTokens(t: Tokens) { localStorage.setItem(STORAGE_KEY, JSON.stringify(t)) }

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/minigames${path}`, {
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) }, ...init,
  })
  const text = await res.text()
  let parsed: (T & { success?: boolean; error?: string }) | null = null
  try { if (text) parsed = JSON.parse(text) } catch { throw new Error(`Non-JSON (${res.status})`) }
  if (!res.ok || parsed?.success === false) throw new Error(parsed?.error || `Failed (${res.status})`)
  return (parsed ?? {}) as T
}

function SuccessRateBar({ successRate, goalThreshold }: { successRate: number; goalThreshold: number }) {
  const pct = Math.round(successRate * 100)
  const threshPct = Math.round(goalThreshold * 100)
  const color = pct >= threshPct ? '#16a34a' : pct >= threshPct * 0.6 ? '#f59e0b' : '#dc2626'
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
        <span>Success Rate</span><span style={{ color, fontWeight: 700 }}>{pct}%</span>
      </div>
      <div className="pf-success-bar">
        <div className="pf-success-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  )
}

function DistributionChart({ finalValues, goalAmount }: { finalValues: number[]; goalAmount: number }) {
  const chartData = useMemo(() => {
    if (!finalValues.length) return []
    const min = Math.min(...finalValues)
    const max = Math.max(...finalValues)
    const buckets = 10
    const bucketSize = (max - min) / buckets
    const counts = Array(buckets).fill(0)
    for (const v of finalValues) {
      const idx = Math.min(buckets - 1, Math.floor((v - min) / bucketSize))
      counts[idx]++
    }
    return counts.map((count, i) => ({
      range: `$${Math.round((min + i * bucketSize) / 1000)}K`,
      count,
      midpoint: min + (i + 0.5) * bucketSize,
    }))
  }, [finalValues])

  return (
    <ResponsiveContainer width="100%" height={160}>
      <BarChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 4 }}>
        <XAxis dataKey="range" tick={{ fontSize: 9 }} />
        <YAxis tick={{ fontSize: 9 }} />
        <Tooltip formatter={(v: number) => [v, 'Simulations']} labelFormatter={(l: string) => `Range: ${l}`} />
        <ReferenceLine x={chartData.findIndex(d => d.midpoint >= goalAmount).toString()} stroke="#2563eb" strokeDasharray="4 2" />
        <Bar dataKey="count" radius={[3, 3, 0, 0]}>
          {chartData.map((d, i) => (
            <Cell key={i} fill={d.midpoint >= goalAmount ? '#16a34a' : '#94a3b8'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

export default function PortfolioFrontierMiniGamePage() {
  const saved = useMemo(loadTokens, [])
  const query = useMemo(() => new URLSearchParams(window.location.search), [])
  const inviteToken = (query.get('invite') || '').trim()
  const roomFromUrl = (query.get('room') || '').toUpperCase()
  const nameFromUrl = query.get('name') || ''
  const hostTokenFromUrl = query.get('hostToken') || ''
  const hasPublicJoinContext = Boolean(inviteToken || roomFromUrl || hostTokenFromUrl)

  const [roomCodeInput, setRoomCodeInput] = useState(roomFromUrl || saved.roomCode)
  const [nameInput, setNameInput] = useState(nameFromUrl || saved.playerName || '')
  const [hostToken, setHostToken] = useState<string | null>(hostTokenFromUrl || saved.hostToken)
  const [playerToken, setPlayerToken] = useState<string | null>(saved.playerToken)
  const [session, setSession] = useState<Session | null>(null)
  const [isHost, setIsHost] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isLobbyMode, setIsLobbyMode] = useState(!hostTokenFromUrl)
  const [canAccessSetup, setCanAccessSetup] = useState(() => hostTokenFromUrl ? true : roomFromUrl ? false : (getEducatorSessionSync()?.ok ?? false))
  const [authChecked, setAuthChecked] = useState(() => hasPublicJoinContext || getEducatorSessionSync() !== null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const fetchGuardRef = useRef(0)
  const autoJoinAttemptedRef = useRef(false)
  const [sessionsRefreshKey, setSessionsRefreshKey] = useState(0)
  const [creatingSession, setCreatingSession] = useState(false)
  const [sessionsFetching, setSessionsFetching] = useState(false)
  const [latestSession, setLatestSession] = useState<EducatorMiniGameSession | null>(null)
  const [joinedPlayers, setJoinedPlayers] = useState<string[]>([])
  const [quickActionLoading, setQuickActionLoading] = useState<'start' | 'advance' | 'reset' | null>(null)
  const [quickActionMessage, setQuickActionMessage] = useState<string | null>(null)
  const [returnInput, setReturnInput] = useState(8)   // percent: 8%
  const [riskInput, setRiskInput] = useState(20)       // percent: 20%

  const roomCode = (session?.roomCode || roomCodeInput || '').toUpperCase()
  useEffect(() => { saveTokens({ roomCode, hostToken, playerToken, playerName: nameInput || null }) }, [roomCode, hostToken, playerToken, nameInput])

  useEffect(() => {
    if (hasPublicJoinContext) return
    getEducatorSessionCached().then(s => { setCanAccessSetup(s.ok); setAuthChecked(true) }).catch(() => { setAuthChecked(true) })
  }, [hasPublicJoinContext])

  useEffect(() => {
    if (!inviteToken) return
    api<{ invite: { teamLabel: string; roomCode?: string } }>(`/invite/${inviteToken}`).then(r => {
      if (r.invite.roomCode) setRoomCodeInput(r.invite.roomCode.toUpperCase())
      if (r.invite.teamLabel && !nameInput) setNameInput(r.invite.teamLabel)
    }).catch(() => {})
  }, [inviteToken])

  const fetchState = async () => {
    if (!roomCode) return
    const guard = fetchGuardRef.current
    try {
      const qs = playerToken ? `?playerToken=${playerToken}` : hostToken ? `?hostToken=${hostToken}` : ''
      const data = await api<{ session: Session; isHost: boolean }>(`/${GAME_SLUG}/${roomCode}/state${qs}`)
      if (fetchGuardRef.current !== guard) return
      setSession(data.session); setIsHost(data.isHost); setError(null)
    } catch (e) { if (fetchGuardRef.current === guard) setError((e as Error).message) }
  }

  useEffect(() => {
    if (!roomCode || (!hostToken && !playerToken)) return
    fetchState()
    pollRef.current = setInterval(fetchState, 2000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [roomCode, hostToken, playerToken])

  async function createGame() {
    setCreatingSession(true); setError(null); setQuickActionMessage(null)
    try {
      await educatorMiniGamesApi.createSession({ gameType: 'portfolio-frontier', teamCount: 40 })
      setSessionsRefreshKey(v => v + 1)
    } catch (e) { setError((e as Error).message) } finally { setCreatingSession(false) }
  }

  async function soloPlay() {
    setLoading(true); setError(null)
    try {
      const d = await api<{ roomCode: string; hostToken: string; playerToken: string; session: Session }>(`/${GAME_SLUG}/solo`, { method: 'POST', body: JSON.stringify({ name: 'Host' }) })
      setHostToken(d.hostToken); setPlayerToken(d.playerToken); setIsLobbyMode(false); setSession(d.session); setRoomCodeInput(d.roomCode)
    } catch (e) { setError((e as Error).message) } finally { setLoading(false) }
  }

  async function joinGame() {
    if (!nameInput.trim()) { setError('Enter your name'); return }
    if (!roomCodeInput.trim()) { setError('Enter room code'); return }
    setLoading(true); setError(null)
    try {
      const d = await api<{ playerToken: string; session: Session }>(`/${GAME_SLUG}/${roomCodeInput.toUpperCase()}/join`, { method: 'POST', body: JSON.stringify({ name: nameInput }) })
      setPlayerToken(d.playerToken); setIsLobbyMode(false); setSession(d.session)
    } catch (e) { setError((e as Error).message) } finally { setLoading(false) }
  }

  async function hostAction(action: string) {
    if (!roomCode || !hostToken) return
    try {
      const d = await api<{ session: Session }>(`/${GAME_SLUG}/${roomCode}/${action}`, { method: 'POST', body: JSON.stringify({ hostToken }) })
      setSession(d.session)
    } catch (e) { setError((e as Error).message) }
  }

  useEffect(() => {
    if (autoJoinAttemptedRef.current) return
    if (!roomFromUrl || !nameFromUrl) return
    if (hostTokenFromUrl) return
    if (session || hostToken || playerToken) return

    autoJoinAttemptedRef.current = true
    setLoading(true)
    setError(null)
    void (async () => {
      try {
        const code = roomFromUrl.trim().toUpperCase()
        const d = await api<{ playerToken: string; session: Session }>(
          `/${GAME_SLUG}/${code}/join`,
          { method: 'POST', body: JSON.stringify({ name: nameFromUrl.trim() }) },
        )
        setRoomCodeInput(code)
        setPlayerToken(d.playerToken)
        setSession(d.session)
        setIsLobbyMode(false)
      } catch (e) {
        setError((e as Error).message)
        setIsLobbyMode(true)
      } finally {
        setLoading(false)
      }
    })()
  }, [roomFromUrl, nameFromUrl, hostTokenFromUrl, session, hostToken, playerToken])

  function leaveGame() {
    fetchGuardRef.current += 1
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
    saveTokens(EMPTY_TOKENS)

    setHostToken(null); setPlayerToken(null); setSession(null); setIsHost(false); setError(null); setIsLobbyMode(true)
  }

  async function submitParams() {
    if (!roomCode || !playerToken) return
    try {
      const d = await api<{ session: Session }>(`/${GAME_SLUG}/${roomCode}/action`, { method: 'POST', body: JSON.stringify({ playerToken, expectedReturn: returnInput / 100, riskLevel: riskInput / 100 }) })
      setSession(d.session)
    } catch (e) { setError((e as Error).message) }
  }

  useEffect(() => {
    if (hasPublicJoinContext) return
    if (sessionsRefreshKey === 0) return
    const load = async () => {
      setSessionsFetching(true)
      try {
        const sessions = await educatorMiniGamesApi.listSessions()
        const latest = sessions.filter(s => s.gameType === 'portfolio-frontier').sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] || null
        setLatestSession(latest)
        if (latest?.id) {
          try {
            const players = await educatorMiniGamesApi.getSessionPlayers(latest.id)
            setJoinedPlayers(players.filter((p) => !p.isBot).map((p) => p.name))
          } catch { setJoinedPlayers([]) }
        } else {
          setJoinedPlayers([])
        }
      } catch { setLatestSession(null); setJoinedPlayers([]) } finally { setSessionsFetching(false) }
    }
    void load()
  }, [hasPublicJoinContext, canAccessSetup, sessionsRefreshKey])

  async function runQuickAction(action: 'start' | 'advance' | 'reset') {
    if (!latestSession) return
    setQuickActionLoading(action); setQuickActionMessage(null)
    try {
      await educatorMiniGamesApi.hostAction(latestSession.id, action)
      setQuickActionMessage(`Session ${action} successful`)
      setSessionsRefreshKey(v => v + 1)
    } catch (e) { setQuickActionMessage((e as Error).message) } finally { setQuickActionLoading(null) }
  }

  
  useEffect(() => {
    if (hasPublicJoinContext) return
    if (session) return
    if (latestSession?.status !== 'LOBBY') return
    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return
      setSessionsRefreshKey((v) => v + 1)
    }, 4000)
    return () => window.clearInterval(timer)
  }, [hasPublicJoinContext, session, latestSession])
  if (!authChecked) return null

  if (!canAccessSetup && !session && !playerToken) {
    return (
      <MiniGameShell title="Portfolio Frontier" sessionsGameType="portfolio-frontier" publicMode={true}>
        <div className="pf-page"><div className="pf-shell">
          <div className="pf-hero mg-page-hero"><h1>💼 Portfolio Frontier</h1></div>
          <div className="pf-card" style={{ textAlign: 'center' }}>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>Educator login required to create. Students: enter room code to join.</p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <input className="pf-input" placeholder="Your name" value={nameInput} onChange={e => setNameInput(e.target.value)} />
              <input className="pf-input" placeholder="Room code" value={roomCodeInput} onChange={e => setRoomCodeInput(e.target.value.toUpperCase())} style={{ maxWidth: '140px' }} />
              <button className="pf-btn pf-btn-primary" onClick={joinGame} disabled={loading}>Join</button>
            </div>
            {error && <div className="pf-error">{error}</div>}
          </div>
        </div></div>
      </MiniGameShell>
    )
  }

  if (isLobbyMode && !session) {
    return (
      <MiniGameShell title="Portfolio Frontier" subtitle="Efficient Frontier" sessionsGameType="portfolio-frontier" publicMode={hasPublicJoinContext}>
        <div className="pf-page"><div className="pf-shell">
          <div className="pf-hero mg-page-hero">
            <h1>💼 Portfolio Frontier</h1>
            <p className="pf-sub">Find the efficient frontier. Pick expected return and risk to maximize retirement goal success rate with minimum necessary risk.</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
            <div className="pf-card" style={{ border: '1px solid var(--accent)', background: 'rgba(37,99,235,0.05)' }}>
              <h2 style={{ fontSize: '1rem', color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1rem' }}>💼 How It Works</h2>
              <div style={{ fontSize: '0.95rem', lineHeight: '1.6', color: 'var(--text)', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                <p>🎛️ <strong>Parameters:</strong> Set annual expected return (4%–15%) and risk level / volatility (10%–40%).</p>
                <p>🎯 <strong>Goal:</strong> Get ≥75% of 200 simulated portfolios to reach $500K in 20 years from $100K.</p>
                <p>📊 <strong>Scoring:</strong> Success rate × 100 points + efficiency bonus for lower risk used.</p>
                <p>⚖️ <strong>Efficient Frontier:</strong> High return needs high risk, but too much risk hurts success rate!</p>
              </div>
              <p style={{ marginTop: '1.2rem', fontSize: '0.85rem', color: 'var(--accent)', fontStyle: 'italic' }}>💡 Minimum risk = 10%. Find the sweet spot on the efficient frontier.</p>
            </div>
            <div className="pf-card">
              <div style={{ display: 'grid', gap: '0.65rem' }}>
                <button className="pf-btn pf-btn-primary" onClick={createGame} disabled={creatingSession}>
                  {creatingSession ? 'Creating...' : 'Create Session'}
                </button>
                <button className="pf-btn pf-btn-secondary" onClick={soloPlay} disabled={loading}>
                  {loading ? 'Starting...' : 'Play Solo Test'}
                </button>
                {!latestSession && sessionsRefreshKey === 0 && (
                  <button type="button" className="mgsp-btn mgsp-secondary" style={{ fontSize: '0.85rem' }} onClick={() => setSessionsRefreshKey(1)}>
                    Load last session
                  </button>
                )}
                {sessionsRefreshKey > 0 && sessionsFetching && !latestSession && (
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Loading session...</div>
                )}
                {latestSession && (
                  <div style={{ display: 'grid', gap: '0.65rem', marginTop: '0.25rem' }}>
                    <div className="mg-form-group">
                      <label>Active Game Code</label>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <input className="mgsp-input" style={{ flex: 1, minWidth: 0, width: '100%' }} value={latestSession.roomCode || ''} readOnly />
                          <button className="mgsp-btn mgsp-secondary" type="button" onClick={() => navigator.clipboard.writeText(latestSession.roomCode || '')}>📋</button>
                        </div>
                    </div>
                    <div className="mg-form-group">
                      <label>Latest Join Link</label>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <input className="mgsp-input" style={{ flex: 1, minWidth: 0, width: '100%' }} value={latestSession.joinByCodeLink || `${window.location.origin}/mini-games/join?code=${encodeURIComponent(latestSession.roomCode || '')}`} readOnly />
                          <button className="mgsp-btn mgsp-secondary" type="button" onClick={() => navigator.clipboard.writeText(latestSession.joinByCodeLink || `${window.location.origin}/mini-games/join?code=${encodeURIComponent(latestSession.roomCode || '')}`)}>📋</button>
                        </div>
                        <div style={{ marginTop: 12, display: 'flex', justifyContent: 'center', background: '#fff', borderRadius: 8, padding: 12 }}>
                          <QRCodeSVG value={latestSession.joinByCodeLink || `${window.location.origin}/mini-games/join?code=${encodeURIComponent(latestSession.roomCode || '')}`} size={200} bgColor="#ffffff" fgColor="#0f172a" level="M" />
                        </div>
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Status: <strong>{latestSession.status}</strong> | Joined: {latestSession.joinedCount || 0}/{latestSession.teamCount}</div>
                    {joinedPlayers.length > 0 && (
                      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
                        {joinedPlayers.map((name) => (
                          <span key={name} className="mgsp-pill">{name}</span>
                        ))}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <button className="pf-btn pf-btn-secondary" disabled={quickActionLoading !== null || latestSession.status !== 'LOBBY'} onClick={() => void runQuickAction('start')}>{quickActionLoading === 'start' ? 'Starting...' : latestSession.status === 'LOBBY' ? 'Start' : 'Started'}</button>
                      <button className="pf-btn pf-btn-secondary" disabled={quickActionLoading !== null || latestSession.status !== 'ACTIVE'} onClick={() => void runQuickAction('advance')}>{quickActionLoading === 'advance' ? 'Advancing...' : 'Advance'}</button>
                      <button className="pf-btn pf-btn-secondary" disabled={quickActionLoading !== null || (latestSession.status !== 'ACTIVE' && latestSession.status !== 'COMPLETED')} onClick={() => void runQuickAction('reset')}>{quickActionLoading === 'reset' ? 'Resetting...' : 'Reset'}</button>
                    </div>
                    {quickActionMessage && <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{quickActionMessage}</div>}
                  </div>
                )}
              </div>
            </div>
          </div>
          <MiniGameSessionsTable gameType="portfolio-frontier" refreshKey={sessionsRefreshKey} />
          {error && <div className="pf-error">{error}</div>}
        </div></div>
      </MiniGameShell>
    )
  }

  if (!session) return (
    <MiniGameShell title="Portfolio Frontier" sessionsGameType="portfolio-frontier" publicMode={hasPublicJoinContext}>
      <div className="pf-page"><div className="pf-shell"><div className="pf-loading">Loading...</div></div></div>
    </MiniGameShell>
  )

  const myPlayer = session.players.find(p => p.id === playerToken)
  const sortedPlayers = [...session.players].sort((a, b) => b.totalScore - a.totalScore)
  const lastRound = session.history[session.history.length - 1]
  const myLastResult = lastRound?.results.find(r => r.playerId === playerToken)
  const config = session.config
  const goalThresholdPct = Math.round(config.goalThreshold * 100)

  return (
    <MiniGameShell title="Portfolio Frontier" subtitle="Efficient Frontier" sessionsGameType="portfolio-frontier" publicMode={hasPublicJoinContext}>
      <div className="pf-page"><div className="pf-shell">
        <div className="pf-hero mg-page-hero">
          <h1>💼 Portfolio Frontier</h1>
          <p className="pf-sub">Room: <strong>{session.roomCode}</strong> · Round {session.currentRound}/{config.rounds} · {session.phase.toUpperCase()}</p>
        </div>

        <div className="pf-card" style={{ border: '1px solid var(--accent)', background: 'rgba(37,99,235,0.05)', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1rem', color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1rem' }}>💼 How It Works</h2>
          <div style={{ fontSize: '0.95rem', lineHeight: '1.6', color: 'var(--text)', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
            <p>🎛️ <strong>Parameters:</strong> Set annual expected return (4%–15%) and risk level / volatility (10%–40%).</p>
            <p>🎯 <strong>Goal:</strong> Get ≥{goalThresholdPct}% of {config.simCount} simulated portfolios to reach ${(config.goalAmount / 1000).toFixed(0)}K in {config.years} years from ${(config.initialInvestment / 1000).toFixed(0)}K.</p>
            <p>📊 <strong>Scoring:</strong> Success rate × 100 points + efficiency bonus for lower risk used.</p>
            <p>⚖️ <strong>Efficient Frontier:</strong> High return needs high risk, but too much risk hurts success rate!</p>
          </div>
          <p style={{ marginTop: '1.2rem', fontSize: '0.85rem', color: 'var(--accent)', fontStyle: 'italic' }}>💡 Minimum risk = {config.minVolatility * 100}%. Find the sweet spot on the efficient frontier.</p>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
          <button className="pf-btn pf-btn-secondary" onClick={leaveGame} style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}>← Leave Game</button>
        </div>

        {session.phase === 'lobby' && (
          <div className="pf-card" style={{ maxWidth: 520, margin: '0 auto' }}>
            <h2>{isHost ? 'Waiting for Players' : 'Waiting for Host to Start'}</h2>
            <p className="pf-desc">Share code: <strong className="pf-room-code">{session.roomCode}</strong></p>
            <div className="pf-players-list">{session.players.map(p => <div key={p.id} className="pf-chip">{p.name}</div>)}</div>
            {isHost && <button className="pf-btn pf-btn-primary" onClick={() => hostAction('start')} disabled={session.players.length < 2} style={{ marginTop: '1rem' }}>Start ({session.players.length}/2+ players)</button>}
            {playerToken && !isHost && (
              <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>You've joined — waiting for the host to start the game.</p>
            )}
            {!isHost && !playerToken && (
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
                <input className="pf-input" placeholder="Your name" value={nameInput} onChange={e => setNameInput(e.target.value)} />
                <button className="pf-btn pf-btn-secondary" onClick={joinGame}>Join</button>
              </div>
            )}
          </div>
        )}

        {session.phase === 'playing' && (
          <div className="pf-game-grid">
            <div className="pf-main-col">
              <div className="pf-card pf-info-card">
                <div className="pf-info-row">
                  <div className="pf-info-item"><span className="pf-info-label">Round</span><span className="pf-info-val">{session.currentRound}/{config.rounds}</span></div>
                  <div className="pf-info-item"><span className="pf-info-label">My Score</span><span className="pf-info-val">{myPlayer?.totalScore ?? session.viewer?.totalScore ?? 0}</span></div>
                  <div className="pf-info-item"><span className="pf-info-label">Goal</span><span className="pf-info-val">${(config.goalAmount / 1000).toFixed(0)}K</span></div>
                  <div className="pf-info-item"><span className="pf-info-label">Target Rate</span><span className="pf-info-val">{goalThresholdPct}%</span></div>
                </div>
              </div>

              {playerToken && myPlayer && (
                <div className="pf-card">
                  <h3>Round {session.currentRound} — Choose Your Portfolio</h3>
                  {session.viewer?.hasActed ? (
                    <div className="pf-waiting">Parameters submitted! Waiting for others ({session.stats.actedCount}/{session.stats.waitingCount} ready)...</div>
                  ) : (
                    <>
                      <p className="pf-desc">Set expected return and risk for your ${(config.initialInvestment / 1000).toFixed(0)}K portfolio over {config.years} years.</p>
                      <div className="pf-slider-group">
                        <label>Expected Annual Return: <strong style={{ color: 'var(--accent)' }}>{returnInput}%</strong></label>
                        <input type="range" className="pf-slider" min={4} max={15} step={1} value={returnInput}
                          onChange={e => setReturnInput(Number(e.target.value))} />
                        <div className="pf-slider-hint">
                          {returnInput >= 12 ? '🚀 Very aggressive growth target' : returnInput >= 9 ? '📈 Growth-oriented portfolio' : '🏦 Conservative/moderate return'}
                        </div>
                      </div>
                      <div className="pf-slider-group">
                        <label>Risk Level (Volatility σ): <strong style={{ color: 'var(--accent)' }}>{riskInput}%</strong></label>
                        <input type="range" className="pf-slider" min={10} max={40} step={1} value={riskInput}
                          onChange={e => setRiskInput(Number(e.target.value))} />
                        <div className="pf-slider-hint">
                          {riskInput >= 30 ? '🎢 High risk: wide outcome range' : riskInput >= 20 ? '⚖️ Balanced risk' : '😌 Low risk: narrow outcome range'}
                        </div>
                      </div>
                      <div className="pf-frontier-hint">
                        💡 <strong>Efficient Frontier:</strong> Higher return needs higher risk. But too much volatility lowers your success rate!
                        Aim for the highest return you can achieve at the minimum necessary risk.
                      </div>
                      <button className="pf-btn pf-btn-primary" onClick={submitParams} style={{ marginTop: '0.75rem' }}>
                        Submit: {returnInput}% return, {riskInput}% risk
                      </button>
                    </>
                  )}
                </div>
              )}

              {myLastResult && (
                <div className="pf-card">
                  <h3>Round {lastRound.round} — Your Portfolio Result</h3>
                  <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem', fontSize: '0.85rem' }}>
                    <span>Return: <strong>{(myLastResult.expectedReturn * 100).toFixed(0)}%</strong></span>
                    <span>Risk: <strong>{(myLastResult.riskLevel * 100).toFixed(0)}%</strong></span>
                    <span className={myLastResult.successRate >= config.goalThreshold ? 'pf-goal-met' : 'pf-goal-not-met'}>
                      {myLastResult.successRate >= config.goalThreshold ? '✅' : '❌'} {(myLastResult.successRate * 100).toFixed(0)}% success
                    </span>
                    <span>Score: <strong>{myLastResult.roundScore}</strong></span>
                  </div>
                  <SuccessRateBar successRate={myLastResult.successRate} goalThreshold={config.goalThreshold} />
                  {myLastResult.finalValues.length > 0 && (
                    <div style={{ marginTop: '1rem' }}>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Distribution of final portfolio values (green = above ${(config.goalAmount / 1000).toFixed(0)}K goal)</div>
                      <DistributionChart finalValues={myLastResult.finalValues} goalAmount={config.goalAmount} />
                    </div>
                  )}
                </div>
              )}

              {lastRound && (
                <div className="pf-card">
                  <h3>Round {lastRound.round} Leaderboard</h3>
                  <table className="pf-results-table">
                    <thead><tr><th>Rank</th><th>Player</th><th>Return</th><th>Risk</th><th>Success Rate</th><th>Score</th></tr></thead>
                    <tbody>
                      {lastRound.results.map((r, i) => (
                        <tr key={r.playerId} className={i === 0 ? 'is-winner' : ''}>
                          <td>{i === 0 ? '🏆' : `#${i+1}`}</td>
                          <td>{r.playerName}</td>
                          <td>{(r.expectedReturn * 100).toFixed(0)}%</td>
                          <td>{(r.riskLevel * 100).toFixed(0)}%</td>
                          <td>
                            <span className={r.successRate >= config.goalThreshold ? 'pf-goal-met' : 'pf-goal-not-met'}>
                              {(r.successRate * 100).toFixed(0)}%
                            </span>
                          </td>
                          <td><strong>{r.roundScore}</strong></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="pf-side-col">
              <div className="pf-card">
                <h3>Scoreboard</h3>
                {sortedPlayers.map((p, i) => (
                  <div key={p.id} className={`pf-score-row ${p.id === playerToken ? 'is-me' : ''}`}>
                    <span className="pf-rank">#{i+1}</span><span className="pf-pname">{p.name}{p.isBot ? ' 🤖' : ''}</span><span className="pf-pts">{p.totalScore}</span>
                  </div>
                ))}
              </div>
              <div className="pf-card">
                <h3>Events</h3>
                <div className="pf-event-log">{session.eventLog.map((e, i) => <div key={i} className="pf-event">{e}</div>)}</div>
              </div>
              {isHost && (
                <div className="pf-card">
                  <h3>Host Controls</h3>
                  <p className="pf-desc">Ready: {session.stats.actedCount}/{session.stats.waitingCount}</p>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="pf-btn pf-btn-secondary" onClick={() => hostAction('advance')}>Force Advance</button>
                    <button className="pf-btn pf-btn-danger" onClick={() => hostAction('reset')}>Reset</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {session.phase === 'results' && (
          <div className="pf-card" style={{ maxWidth: 700, margin: '0 auto' }}>
            <h2>Game Complete! 🎉</h2>
            <p className="pf-desc" style={{ marginBottom: '1.5rem' }}>
              Final Leaderboard — Goal: ${(config.goalAmount / 1000).toFixed(0)}K in {config.years} yrs · Need {goalThresholdPct}% success rate
            </p>
            <div style={{ marginBottom: '1.5rem' }}>
              {sortedPlayers.map((p, i) => (
                <div key={p.id} className={`pf-final-row ${i === 0 ? 'winner' : ''}`}>
                  <span style={{ width: '2rem' }}>{i === 0 ? '🏆' : `#${i+1}`}</span>
                  <span style={{ flex: 1 }}>{p.name}{p.isBot ? ' 🤖' : ''}</span>
                  <span style={{ fontWeight: 800 }}>{p.totalScore} pts</span>
                </div>
              ))}
            </div>
            {session.history.length > 0 && (
              <div>
                <h3>Round History</h3>
                {session.history.map(r => (
                  <div key={r.round} style={{ marginBottom: '1rem' }}>
                    <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Round {r.round}</div>
                    <table className="pf-results-table">
                      <thead><tr><th>Player</th><th>Return</th><th>Risk</th><th>Success Rate</th><th>Score</th></tr></thead>
                      <tbody>
                        {r.results.map((res, i) => (
                          <tr key={res.playerId} className={i === 0 ? 'is-winner' : ''}>
                            <td>{res.playerName}</td>
                            <td>{(res.expectedReturn * 100).toFixed(0)}%</td>
                            <td>{(res.riskLevel * 100).toFixed(0)}%</td>
                            <td className={res.successRate >= config.goalThreshold ? 'pf-goal-met' : 'pf-goal-not-met'}>
                              {(res.successRate * 100).toFixed(0)}%
                            </td>
                            <td><strong>{res.roundScore}</strong></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            )}
            {isHost && <button className="pf-btn pf-btn-secondary" onClick={() => hostAction('reset')} style={{ marginTop: '1.5rem' }}>Play Again</button>}
          </div>
        )}

        {error && <div className="pf-error">{error}</div>}
      </div></div>
    </MiniGameShell>
  )
}



