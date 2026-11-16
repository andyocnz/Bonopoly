import { QRCodeSVG } from 'qrcode.react'
import { useEffect, useMemo, useState, useRef } from 'react'
import { getEducatorSessionCached, getEducatorSessionSync } from '../features/minigames/educatorSession'
import { MiniGameShell } from '../features/minigames/MiniGameShell'
import './MarketSurvivalMiniGamePage.css'
import '../features/minigames/SessionControlPanel.css'
import { educatorMiniGamesApi } from '../features/minigames/api'
import { MiniGameSessionsTable } from '../features/minigames/MiniGameSessionsTable'
import type { EducatorMiniGameSession } from '../api/client'
import { LineChart, Line, XAxis, YAxis, ReferenceLine, ResponsiveContainer, Tooltip } from 'recharts'

const STORAGE_KEY = 'market-survival_minigame_v1'
const GAME_SLUG = 'market-survival'

// Round context — mirrors server ROUND_CONTEXTS
const ROUND_CONTEXTS = [
  {
    round: 1,
    title: 'Normal Market',
    description: 'Steady economic conditions. Build your portfolio and observe how diversification affects outcomes.',
    correlationNote: null as string | null,
  },
  {
    round: 2,
    title: 'Recession',
    description: 'The economy contracts. Risk assets are hit hard as earnings expectations collapse. Bonds hold their value — everything else suffers.',
    correlationNote: "In a downturn, stocks and index funds tend to fall together — they're positively correlated. Holding both provides less protection than it might appear on paper.",
  },
  {
    round: 3,
    title: 'Bull Run',
    description: 'Markets surge on strong growth data. Risk assets lead the rally. Portfolios heavy on bonds miss the upside.',
    correlationNote: null as string | null,
  },
]

const ASSETS = [
  { key: 'bonds',  label: 'Government Bonds', returnLabel: '~5% return',  riskLabel: 'Very low risk',  color: '#16a34a', desc: 'Stable, low volatility. Protects in downturns.' },
  { key: 'index',  label: 'Index Fund',        returnLabel: '~9% return',  riskLabel: 'Moderate risk', color: '#2563eb', desc: 'Diversified equity. Balanced risk and growth.' },
  { key: 'stocks', label: 'Growth Stocks',     returnLabel: '~15% return', riskLabel: 'High risk',     color: '#dc2626', desc: 'High potential. Volatile — swings hard both ways.' },
]

type MsvConfig = { rounds: number; steps: number; pathCount: number; startPrice: number; targetPrice: number; bankruptcyPrice: number }
type MsvPlayer = { id: string; name: string; isBot: boolean; totalScore: number; hasActedThisRound: boolean }
type ADAllocation = { bondsPct: number; indexPct: number; stocksPct: number }
type MsvPlayerResult = { playerId: string; playerName: string; allocation?: ADAllocation; drift: number; volatility: number; paths: number[][]; pathsHitTarget: number; pathsBankrupt: number; pathsSurvived: number; roundScore: number }
type MsvRoundSummary = { round: number; results: MsvPlayerResult[] }
type Session = {
  roomCode: string; phase: 'lobby' | 'playing' | 'results'
  currentRound: number; config: MsvConfig
  players: MsvPlayer[]; history: MsvRoundSummary[]; eventLog: string[]
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

function PathsChart({ paths, targetPrice, bankruptcyPrice }: { paths: number[][]; targetPrice: number; bankruptcyPrice: number }) {
  const chartData = useMemo(() => {
    const len = paths[0]?.length ?? 0
    return Array.from({ length: len }, (_, i) => {
      const point: Record<string, number> = { step: i }
      paths.forEach((p, pi) => { point[`p${pi}`] = Math.round(p[i] * 100) / 100 })
      return point
    })
  }, [paths])

  const colors = ['#3b82f6', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#6366f1', '#84cc16', '#f97316']

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
        <XAxis dataKey="step" tick={{ fontSize: 10 }} label={{ value: 'Step', position: 'insideBottom', offset: -2, fontSize: 10 }} />
        <YAxis tick={{ fontSize: 10 }} domain={['auto', 'auto']} />
        <Tooltip formatter={(v: number) => [`$${v.toFixed(2)}`, '']} labelFormatter={(l: number) => `Step ${l}`} />
        <ReferenceLine y={targetPrice} stroke="#16a34a" strokeDasharray="5 3" label={{ value: `Target $${targetPrice}`, position: 'right', fontSize: 10, fill: '#16a34a' }} />
        <ReferenceLine y={bankruptcyPrice} stroke="#dc2626" strokeDasharray="5 3" label={{ value: `Floor $${bankruptcyPrice}`, position: 'right', fontSize: 10, fill: '#dc2626' }} />
        {paths.map((_, i) => (
          <Line key={i} type="monotone" dataKey={`p${i}`} stroke={colors[i % colors.length]} dot={false} strokeWidth={1.5} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}

function AllocationBar({ bondsPct, indexPct, stocksPct }: ADAllocation) {
  return (
    <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', gap: 1 }}>
      {bondsPct > 0 && <div style={{ flex: bondsPct, background: '#16a34a' }} title={`Bonds ${bondsPct}%`} />}
      {indexPct > 0 && <div style={{ flex: indexPct, background: '#2563eb' }} title={`Index ${indexPct}%`} />}
      {stocksPct > 0 && <div style={{ flex: stocksPct, background: '#dc2626' }} title={`Stocks ${stocksPct}%`} />}
    </div>
  )
}

export default function MarketSurvivalMiniGamePage() {
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

  // Allocation state — bonds and index are the two free sliders; stocks is derived
  const [bondsInput, setBondsInput] = useState(30)
  const [indexInput, setIndexInput] = useState(40)
  const stocksInput = Math.max(0, 100 - bondsInput - indexInput)
  const totalInput = bondsInput + indexInput + stocksInput // always 100

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
      await educatorMiniGamesApi.createSession({ gameType: 'market-survival', teamCount: 40 })
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
    setLoading(true); setError(null)
    void (async () => {
      try {
        const code = roomFromUrl.trim().toUpperCase()
        const d = await api<{ playerToken: string; session: Session }>(`/${GAME_SLUG}/${code}/join`, { method: 'POST', body: JSON.stringify({ name: nameFromUrl.trim() }) })
        setRoomCodeInput(code); setPlayerToken(d.playerToken); setSession(d.session); setIsLobbyMode(false)
      } catch (e) { setError((e as Error).message); setIsLobbyMode(true) } finally { setLoading(false) }
    })()
  }, [roomFromUrl, nameFromUrl, hostTokenFromUrl, session, hostToken, playerToken])

  function leaveGame() {
    fetchGuardRef.current += 1
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
    saveTokens(EMPTY_TOKENS)
    setHostToken(null); setPlayerToken(null); setSession(null); setIsHost(false); setError(null); setIsLobbyMode(true)
  }

  async function submitAllocation() {
    if (!roomCode || !playerToken) return
    if (totalInput !== 100) { setError('Allocation must sum to 100%'); return }
    try {
      const d = await api<{ session: Session }>(`/${GAME_SLUG}/${roomCode}/action`, {
        method: 'POST',
        body: JSON.stringify({ playerToken, bondsPct: bondsInput, indexPct: indexInput, stocksPct: stocksInput }),
      })
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
        const latest = sessions.filter(s => s.gameType === 'market-survival').sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] || null
        setLatestSession(latest)
        if (latest?.id) {
          try {
            const players = await educatorMiniGamesApi.getSessionPlayers(latest.id)
            setJoinedPlayers(players.filter((p) => !p.isBot).map((p) => p.name))
          } catch { setJoinedPlayers([]) }
        } else { setJoinedPlayers([]) }
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
      <MiniGameShell title="Assets Diversification" sessionsGameType="market-survival" publicMode={true}>
        <div className="msv-page"><div className="msv-shell">
          <div className="msv-hero mg-page-hero"><h1>📊 Assets Diversification</h1></div>
          <div className="msv-card" style={{ textAlign: 'center' }}>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>Educator login required to create. Students: enter room code to join.</p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <input className="msv-input" placeholder="Your name" value={nameInput} onChange={e => setNameInput(e.target.value)} />
              <input className="msv-input" placeholder="Room code" value={roomCodeInput} onChange={e => setRoomCodeInput(e.target.value.toUpperCase())} style={{ maxWidth: '140px' }} />
              <button className="msv-btn msv-btn-primary" onClick={joinGame} disabled={loading}>Join</button>
            </div>
            {error && <div className="msv-error">{error}</div>}
          </div>
        </div></div>
      </MiniGameShell>
    )
  }

  if (isLobbyMode && !session) {
    return (
      <MiniGameShell title="Assets Diversification" subtitle="Portfolio Allocation Simulation" sessionsGameType="market-survival" publicMode={hasPublicJoinContext}>
        <div className="msv-page"><div className="msv-shell">
          <div className="msv-hero mg-page-hero">
            <h1>📊 Assets Diversification</h1>
            <p className="msv-sub">Allocate your portfolio across Bonds, Index Fund, and Growth Stocks. Three market conditions reveal why diversification matters.</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
            <div className="msv-card" style={{ border: '1px solid var(--accent)', background: 'rgba(217,119,6,0.05)' }}>
              <h2 style={{ fontSize: '1rem', color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1rem' }}>📊 How It Works</h2>
              <div style={{ fontSize: '0.95rem', lineHeight: '1.6', color: 'var(--text)', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                <p>🏦 <strong>3 Asset Classes:</strong> Government Bonds, Index Fund, and Growth Stocks — each with different return and risk profiles.</p>
                <p>🎛️ <strong>Your job:</strong> Allocate 100% across these three assets each round.</p>
                <p>📈 <strong>Simulation:</strong> The system computes your portfolio's drift and volatility, then runs 10 price paths.</p>
                <p>🎯 <strong>Scoring:</strong> +10 per path hitting target · −15 per path hitting floor · +5 per surviving path.</p>
                <p>🌍 <strong>3 Rounds:</strong> Normal Market → Recession → Bull Run. Same allocation won't work every time.</p>
              </div>
            </div>
            <div className="msv-card">
              <div style={{ display: 'grid', gap: '0.65rem' }}>
                <button className="msv-btn msv-btn-primary" onClick={createGame} disabled={creatingSession}>
                  {creatingSession ? 'Creating...' : 'Create Session'}
                </button>
                <button className="msv-btn msv-btn-secondary" onClick={soloPlay} disabled={loading}>
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
                        <input className="mgsp-input" style={{ flex: 1, minWidth: 0 }} value={latestSession.roomCode || ''} readOnly />
                        <button className="mgsp-btn mgsp-secondary" type="button" onClick={() => navigator.clipboard.writeText(latestSession.roomCode || '')}>📋</button>
                      </div>
                    </div>
                    <div className="mg-form-group">
                      <label>Latest Join Link</label>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <input className="mgsp-input" style={{ flex: 1, minWidth: 0 }} value={latestSession.joinByCodeLink || `${window.location.origin}/mini-games/join?code=${encodeURIComponent(latestSession.roomCode || '')}`} readOnly />
                        <button className="mgsp-btn mgsp-secondary" type="button" onClick={() => navigator.clipboard.writeText(latestSession.joinByCodeLink || '')}>📋</button>
                      </div>
                      <div style={{ marginTop: 12, display: 'flex', justifyContent: 'center', background: '#fff', borderRadius: 8, padding: 12 }}>
                        <QRCodeSVG value={latestSession.joinByCodeLink || `${window.location.origin}/mini-games/join?code=${encodeURIComponent(latestSession.roomCode || '')}`} size={200} bgColor="#ffffff" fgColor="#0f172a" level="M" />
                      </div>
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Status: <strong>{latestSession.status}</strong> | Joined: {latestSession.joinedCount || 0}/{latestSession.teamCount}</div>
                    {joinedPlayers.length > 0 && (
                      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
                        {joinedPlayers.map((name) => <span key={name} className="mgsp-pill">{name}</span>)}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <button className="msv-btn msv-btn-secondary" disabled={quickActionLoading !== null || latestSession.status !== 'LOBBY'} onClick={() => void runQuickAction('start')}>{quickActionLoading === 'start' ? 'Starting...' : latestSession.status === 'LOBBY' ? 'Start' : 'Started'}</button>
                      <button className="msv-btn msv-btn-secondary" disabled={quickActionLoading !== null || latestSession.status !== 'ACTIVE'} onClick={() => void runQuickAction('advance')}>{quickActionLoading === 'advance' ? 'Advancing...' : 'Advance'}</button>
                      <button className="msv-btn msv-btn-secondary" disabled={quickActionLoading !== null || (latestSession.status !== 'ACTIVE' && latestSession.status !== 'COMPLETED')} onClick={() => void runQuickAction('reset')}>{quickActionLoading === 'reset' ? 'Resetting...' : 'Reset'}</button>
                    </div>
                    {quickActionMessage && <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{quickActionMessage}</div>}
                  </div>
                )}
              </div>
            </div>
          </div>
          <MiniGameSessionsTable gameType="market-survival" refreshKey={sessionsRefreshKey} />
          {error && <div className="msv-error">{error}</div>}
        </div></div>
      </MiniGameShell>
    )
  }

  if (!session) return (
    <MiniGameShell title="Assets Diversification" sessionsGameType="market-survival" publicMode={hasPublicJoinContext}>
      <div className="msv-page"><div className="msv-shell"><div className="msv-loading">Loading...</div></div></div>
    </MiniGameShell>
  )

  const myPlayer = session.players.find(p => p.id === playerToken)
  const sortedPlayers = [...session.players].sort((a, b) => b.totalScore - a.totalScore)
  const lastRound = session.history[session.history.length - 1]
  const myLastResult = lastRound?.results.find(r => r.playerId === playerToken)
  const config = session.config
  const roundCtx = ROUND_CONTEXTS[(session.currentRound - 1) % ROUND_CONTEXTS.length]

  return (
    <MiniGameShell title="Assets Diversification" subtitle="Portfolio Allocation Simulation" sessionsGameType="market-survival" publicMode={hasPublicJoinContext}>
      <div className="msv-page"><div className="msv-shell">
        <div className="msv-hero mg-page-hero">
          <h1>📊 Assets Diversification</h1>
          <p className="msv-sub">Room: <strong>{session.roomCode}</strong> · Round {session.currentRound}/{config.rounds} · {session.phase.toUpperCase()}</p>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
          <button className="msv-btn msv-btn-secondary" onClick={leaveGame} style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}>← Leave Game</button>
        </div>

        {session.phase === 'lobby' && (
          <div className="msv-card" style={{ maxWidth: 520, margin: '0 auto' }}>
            <h2>{isHost ? 'Waiting for Players' : 'Waiting for Host to Start'}</h2>
            <p className="msv-desc">Share code: <strong className="msv-room-code">{session.roomCode}</strong></p>
            <div className="msv-players-list">{session.players.map(p => <div key={p.id} className="msv-chip">{p.name}</div>)}</div>
            {isHost && <button className="msv-btn msv-btn-primary" onClick={() => hostAction('start')} disabled={session.players.length < 2} style={{ marginTop: '1rem' }}>Start ({session.players.length}/2+ players)</button>}
            {playerToken && !isHost && <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>You've joined — waiting for the host to start.</p>}
            {!isHost && !playerToken && (
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
                <input className="msv-input" placeholder="Your name" value={nameInput} onChange={e => setNameInput(e.target.value)} />
                <button className="msv-btn msv-btn-secondary" onClick={joinGame}>Join</button>
              </div>
            )}
          </div>
        )}

        {session.phase === 'playing' && (
          <div className="msv-game-grid">
            <div className="msv-main-col">

              {/* Round context card */}
              <div className="msv-card" style={{ borderLeft: '4px solid var(--accent)', background: 'rgba(217,119,6,0.04)', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', marginBottom: '0.4rem' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--accent)' }}>Round {session.currentRound} of {config.rounds}</span>
                  <span style={{ fontSize: '1rem', fontWeight: 700 }}>{roundCtx.title}</span>
                </div>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>{roundCtx.description}</p>
                {roundCtx.correlationNote && (
                  <div style={{ marginTop: '0.6rem', padding: '0.5rem 0.75rem', background: 'rgba(220,38,38,0.07)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: 6, fontSize: '0.85rem', color: 'var(--text)', lineHeight: 1.5 }}>
                    <strong>⚠ Correlation:</strong> {roundCtx.correlationNote}
                  </div>
                )}
              </div>

              {/* Metrics row */}
              <div className="msv-card msv-info-card" style={{ marginBottom: '1rem' }}>
                <div className="msv-info-row">
                  <div className="msv-info-item"><span className="msv-info-label">My Score</span><span className="msv-info-val">{myPlayer?.totalScore ?? session.viewer?.totalScore ?? 0}</span></div>
                  <div className="msv-info-item"><span className="msv-info-label">Target</span><span className="msv-info-val" style={{ color: '#16a34a' }}>+${config.targetPrice - config.startPrice}</span></div>
                  <div className="msv-info-item"><span className="msv-info-label">Floor</span><span className="msv-info-val" style={{ color: '#dc2626' }}>-${config.startPrice - config.bankruptcyPrice}</span></div>
                  <div className="msv-info-item"><span className="msv-info-label">Paths</span><span className="msv-info-val">{config.pathCount}</span></div>
                </div>
              </div>

              {/* Allocation input */}
              {playerToken && myPlayer && (
                <div className="msv-card">
                  <h3 style={{ marginBottom: '0.75rem' }}>Round {session.currentRound} — Your Portfolio Allocation</h3>
                  {session.viewer?.hasActed ? (
                    <div className="msv-waiting">Allocation submitted! Waiting for others ({session.stats.actedCount}/{session.stats.waitingCount} ready)...</div>
                  ) : (
                    <>
                      <p className="msv-desc" style={{ marginBottom: '1rem' }}>Allocate 100% across the three asset classes. Bonds and Index sliders are free; Stocks fills the remainder.</p>

                      {/* Asset allocation sliders */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem', marginBottom: '1rem' }}>
                        {/* Bonds */}
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                            <span style={{ fontSize: '0.88rem', fontWeight: 600, color: '#16a34a' }}>🏦 Government Bonds</span>
                            <span style={{ fontSize: '0.88rem', fontWeight: 700 }}>{bondsInput}%</span>
                          </div>
                          <input type="range" className="msv-slider" min={0} max={100} step={5} value={bondsInput}
                            onChange={e => { const v = Number(e.target.value); setBondsInput(v); if (v + indexInput > 100) setIndexInput(100 - v) }}
                            style={{ accentColor: '#16a34a' }}
                          />
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>~5% expected return · Very low volatility</div>
                        </div>

                        {/* Index */}
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                            <span style={{ fontSize: '0.88rem', fontWeight: 600, color: '#2563eb' }}>📈 Index Fund</span>
                            <span style={{ fontSize: '0.88rem', fontWeight: 700 }}>{indexInput}%</span>
                          </div>
                          <input type="range" className="msv-slider" min={0} max={100 - bondsInput} step={5} value={indexInput}
                            onChange={e => setIndexInput(Number(e.target.value))}
                            style={{ accentColor: '#2563eb' }}
                          />
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>~9% expected return · Moderate volatility</div>
                        </div>

                        {/* Stocks — derived */}
                        <div style={{ opacity: 0.85 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                            <span style={{ fontSize: '0.88rem', fontWeight: 600, color: '#dc2626' }}>🚀 Growth Stocks</span>
                            <span style={{ fontSize: '0.88rem', fontWeight: 700 }}>{stocksInput}%</span>
                          </div>
                          <div style={{ height: 6, borderRadius: 3, background: 'var(--mg-border)', overflow: 'hidden', marginBottom: '0.3rem' }}>
                            <div style={{ width: `${stocksInput}%`, height: '100%', background: '#dc2626', borderRadius: 3, transition: 'width 0.15s' }} />
                          </div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>~15% expected return · High volatility · Remainder after Bonds + Index</div>
                        </div>
                      </div>

                      {/* Allocation summary bar */}
                      <AllocationBar bondsPct={bondsInput} indexPct={indexInput} stocksPct={stocksInput} />
                      <div style={{ display: 'flex', gap: '1rem', fontSize: '0.78rem', marginTop: '0.35rem', color: 'var(--text-muted)' }}>
                        <span style={{ color: '#16a34a' }}>■ Bonds {bondsInput}%</span>
                        <span style={{ color: '#2563eb' }}>■ Index {indexInput}%</span>
                        <span style={{ color: '#dc2626' }}>■ Stocks {stocksInput}%</span>
                      </div>

                      <button className="msv-btn msv-btn-primary" onClick={() => void submitAllocation()} style={{ marginTop: '1rem' }}>
                        Submit: {bondsInput}% Bonds · {indexInput}% Index · {stocksInput}% Stocks
                      </button>
                    </>
                  )}
                </div>
              )}

              {/* My paths chart */}
              {myLastResult && myLastResult.paths.length > 0 && (
                <div className="msv-card">
                  <h3>Round {lastRound.round} — Your Portfolio Paths</h3>
                  {myLastResult.allocation && (
                    <div style={{ marginBottom: '0.6rem' }}>
                      <AllocationBar bondsPct={myLastResult.allocation.bondsPct} indexPct={myLastResult.allocation.indexPct} stocksPct={myLastResult.allocation.stocksPct} />
                      <div style={{ display: 'flex', gap: '1rem', fontSize: '0.78rem', marginTop: '0.3rem', color: 'var(--text-muted)' }}>
                        <span style={{ color: '#16a34a' }}>■ Bonds {myLastResult.allocation.bondsPct}%</span>
                        <span style={{ color: '#2563eb' }}>■ Index {myLastResult.allocation.indexPct}%</span>
                        <span style={{ color: '#dc2626' }}>■ Stocks {myLastResult.allocation.stocksPct}%</span>
                        <span>Drift {(myLastResult.drift * 100).toFixed(1)}% · Vol {(myLastResult.volatility * 100).toFixed(1)}%</span>
                      </div>
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.5rem', fontSize: '0.85rem' }}>
                    <span className="msv-badge-target">✅ {myLastResult.pathsHitTarget} hit target</span>
                    <span className="msv-badge-bankrupt">💀 {myLastResult.pathsBankrupt} hit floor</span>
                    <span>Score: <strong>{myLastResult.roundScore}</strong></span>
                  </div>
                  <PathsChart paths={myLastResult.paths} targetPrice={config.targetPrice} bankruptcyPrice={config.bankruptcyPrice} />
                </div>
              )}

              {/* Round leaderboard */}
              {lastRound && (
                <div className="msv-card">
                  <h3>Round {lastRound.round} Results</h3>
                  <table className="msv-results-table">
                    <thead><tr><th>Rank</th><th>Player</th><th>Bonds</th><th>Index</th><th>Stocks</th><th>Hit Target</th><th>Hit Floor</th><th>Score</th></tr></thead>
                    <tbody>
                      {lastRound.results.map((r, i) => (
                        <tr key={r.playerId} className={i === 0 ? 'is-winner' : ''}>
                          <td>{i === 0 ? '🏆' : `#${i + 1}`}</td>
                          <td>{r.playerName}</td>
                          <td style={{ color: '#16a34a' }}>{r.allocation?.bondsPct ?? '—'}%</td>
                          <td style={{ color: '#2563eb' }}>{r.allocation?.indexPct ?? '—'}%</td>
                          <td style={{ color: '#dc2626' }}>{r.allocation?.stocksPct ?? '—'}%</td>
                          <td><span className="msv-badge-target">{r.pathsHitTarget}</span></td>
                          <td><span className="msv-badge-bankrupt">{r.pathsBankrupt}</span></td>
                          <td><strong>{r.roundScore}</strong></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="msv-side-col">
              <div className="msv-card">
                <h3>Scoreboard</h3>
                {sortedPlayers.map((p, i) => (
                  <div key={p.id} className={`msv-score-row ${p.id === playerToken ? 'is-me' : ''}`}>
                    <span className="msv-rank">#{i + 1}</span>
                    <span className="msv-pname">{p.name}{p.isBot ? ' 🤖' : ''}</span>
                    <span className="msv-pts">{p.totalScore}</span>
                  </div>
                ))}
              </div>
              <div className="msv-card">
                <h3>Asset Guide</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  {ASSETS.map(a => (
                    <div key={a.key} style={{ padding: '0.5rem 0.6rem', borderRadius: 6, border: `1px solid ${a.color}22`, background: `${a.color}08` }}>
                      <div style={{ fontSize: '0.82rem', fontWeight: 700, color: a.color }}>{a.label}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{a.returnLabel} · {a.riskLabel}</div>
                      <div style={{ fontSize: '0.77rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>{a.desc}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="msv-card">
                <h3>Events</h3>
                <div className="msv-event-log">{session.eventLog.map((e, i) => <div key={i} className="msv-event">{e}</div>)}</div>
              </div>
              {isHost && (
                <div className="msv-card">
                  <h3>Host Controls</h3>
                  <p className="msv-desc">Ready: {session.stats.actedCount}/{session.stats.waitingCount}</p>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="msv-btn msv-btn-secondary" onClick={() => hostAction('advance')}>Force Advance</button>
                    <button className="msv-btn msv-btn-danger" onClick={() => hostAction('reset')}>Reset</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {session.phase === 'results' && (
          <div className="msv-card" style={{ maxWidth: 700, margin: '0 auto' }}>
            <h2>Game Complete! 🎉</h2>
            <p className="msv-desc" style={{ marginBottom: '1.5rem' }}>Final Leaderboard — 3 market conditions, {config.pathCount} paths each</p>
            <div style={{ marginBottom: '1.5rem' }}>
              {sortedPlayers.map((p, i) => (
                <div key={p.id} className={`msv-final-row ${i === 0 ? 'winner' : ''}`}>
                  <span style={{ width: '2rem' }}>{i === 0 ? '🏆' : `#${i + 1}`}</span>
                  <span style={{ flex: 1 }}>{p.name}{p.isBot ? ' 🤖' : ''}</span>
                  <span style={{ fontWeight: 800 }}>{p.totalScore} pts</span>
                </div>
              ))}
            </div>
            {session.history.length > 0 && (
              <div>
                <h3>Round History</h3>
                {session.history.map(r => {
                  const ctx = ROUND_CONTEXTS[(r.round - 1) % ROUND_CONTEXTS.length]
                  return (
                    <div key={r.round} style={{ marginBottom: '1rem' }}>
                      <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Round {r.round}: {ctx.title}</div>
                      <table className="msv-results-table">
                        <thead><tr><th>Player</th><th>Bonds</th><th>Index</th><th>Stocks</th><th>Hit</th><th>Floor</th><th>Score</th></tr></thead>
                        <tbody>
                          {r.results.map((res, i) => (
                            <tr key={res.playerId} className={i === 0 ? 'is-winner' : ''}>
                              <td>{res.playerName}</td>
                              <td style={{ color: '#16a34a' }}>{res.allocation?.bondsPct ?? '—'}%</td>
                              <td style={{ color: '#2563eb' }}>{res.allocation?.indexPct ?? '—'}%</td>
                              <td style={{ color: '#dc2626' }}>{res.allocation?.stocksPct ?? '—'}%</td>
                              <td>{res.pathsHitTarget}</td>
                              <td>{res.pathsBankrupt}</td>
                              <td><strong>{res.roundScore}</strong></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )
                })}
              </div>
            )}
            {isHost && <button className="msv-btn msv-btn-secondary" onClick={() => hostAction('reset')} style={{ marginTop: '1.5rem' }}>Play Again</button>}
          </div>
        )}

        {error && <div className="msv-error">{error}</div>}
      </div></div>
    </MiniGameShell>
  )
}
