import { QRCodeSVG } from 'qrcode.react'
import { useEffect, useMemo, useState, useRef } from 'react'
import { getEducatorSessionCached, getEducatorSessionSync } from '../features/minigames/educatorSession'
import { MiniGameShell } from '../features/minigames/MiniGameShell'
import './CournotMiniGamePage.css'
import '../features/minigames/SessionControlPanel.css'
import { educatorMiniGamesApi } from '../features/minigames/api'
import { MiniGameSessionsTable } from '../features/minigames/MiniGameSessionsTable'
import type { EducatorMiniGameSession } from '../api/client'

const STORAGE_KEY = 'cournot_minigame_v1'
const GAME_SLUG = 'cournot'

type Firm = { id: string; name: string; isBot: boolean; totalProfit: number; hasActedThisRound: boolean }
type RoundSummary = {
  round: number; decisions: Record<string, number>; marketPrice?: number
  totalQuantity?: number; profits: Record<string, number>; nashEquilibrium: number
}
type Session = {
  roomCode: string; phase: 'lobby' | 'playing' | 'results'
  currentRound: number; config: { demandIntercept: number; demandSlope: number; marginalCost: number; rounds: number }
  firms: Firm[]; history: RoundSummary[]; eventLog: string[]
  stats: { actedCount: number; waitingCount: number }
  viewer?: Viewer | null
}
type Viewer = { totalProfit: number; hasActed: boolean }
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

export default function CournotMiniGamePage() {
  const saved = useMemo(loadTokens, [])
  const query = useMemo(() => new URLSearchParams(window.location.search), [])
  const inviteToken = (query.get('invite') || '').trim()
  const roomFromUrl = (query.get('room') || '').toUpperCase()
  const nameFromUrl = query.get('name') || ''
  const hostTokenFromUrl = query.get('hostToken') || ''
  const forcePlayerJoinFromUrl = Boolean(roomFromUrl && nameFromUrl && !hostTokenFromUrl)
  const hasPublicJoinContext = Boolean(inviteToken || roomFromUrl || hostTokenFromUrl)

  const [roomCodeInput, setRoomCodeInput] = useState(roomFromUrl || saved.roomCode)
  const [nameInput, setNameInput] = useState(nameFromUrl || saved.playerName || '')
  const [hostToken, setHostToken] = useState<string | null>(hostTokenFromUrl || (forcePlayerJoinFromUrl ? null : saved.hostToken))
  const [playerToken, setPlayerToken] = useState<string | null>(forcePlayerJoinFromUrl ? null : saved.playerToken)
  const [session, setSession] = useState<Session | null>(null)
  const [viewer, setViewer] = useState<Viewer | null>(null)
  const [isHost, setIsHost] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isLobbyMode, setIsLobbyMode] = useState(!hostTokenFromUrl)
  const [canAccessSetup, setCanAccessSetup] = useState(() => hostTokenFromUrl ? true : roomFromUrl ? false : (getEducatorSessionSync()?.ok ?? false))
  const [authChecked, setAuthChecked] = useState(() => hasPublicJoinContext || getEducatorSessionSync() !== null)
  const [quantity, setQuantity] = useState(30)
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

  const roomCode = (session?.roomCode || roomCodeInput || '').toUpperCase()
  useEffect(() => { saveTokens({ roomCode, hostToken, playerToken, playerName: nameInput || null }) }, [roomCode, hostToken, playerToken, nameInput])

  useEffect(() => {
    if (hasPublicJoinContext) return
    getEducatorSessionCached().then(s => { setCanAccessSetup(s.ok); setAuthChecked(true) }).catch(() => { setAuthChecked(true) })
  }, [hasPublicJoinContext])

  const fetchState = async () => {
    if (!roomCode) return
    const guard = fetchGuardRef.current
    try {
      const queryParts: string[] = []
      if (hostToken) queryParts.push(`hostToken=${encodeURIComponent(hostToken)}`)
      if (playerToken) queryParts.push(`playerToken=${encodeURIComponent(playerToken)}`)
      const qs = queryParts.length > 0 ? `?${queryParts.join('&')}` : ''
      const data = await api<{ session: Session; isHost: boolean }>(`/${GAME_SLUG}/${roomCode}/state${qs}`)
      if (fetchGuardRef.current !== guard) return
      if (playerToken && !hostToken && !data.session.viewer) {
        setPlayerToken(null)
        setSession(null)
        setViewer(null)
        setIsLobbyMode(true)
        setError('Your previous join session expired. Please join again.')
        return
      }
      setSession(data.session); setViewer(data.session.viewer ?? null); setIsHost(data.isHost); setError(null)
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
      await api<{ roomCode: string; hostToken: string; session: Session }>(`/${GAME_SLUG}/create`, {
        method: 'POST',
        body: JSON.stringify({}),
      })
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
    if (!nameInput.trim()) { setError('Enter your firm name'); return }
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

    setHostToken(null); setPlayerToken(null); setSession(null); setViewer(null); setIsHost(false); setError(null); setIsLobbyMode(true)
  }

  async function submitQuantity() {
    if (!roomCode || !playerToken) return
    try {
      const d = await api<{ session: Session }>(`/${GAME_SLUG}/${roomCode}/action`, { method: 'POST', body: JSON.stringify({ playerToken, quantity }) })
      setSession(d.session); setViewer(d.session.viewer ?? null)
    } catch (e) { setError((e as Error).message) }
  }

  useEffect(() => {
    if (hasPublicJoinContext) return
    if (sessionsRefreshKey === 0) return
    const load = async () => {
      setSessionsFetching(true)
      try {
        const sessions = await educatorMiniGamesApi.listSessions()
        const latest = sessions.filter(s => s.gameType === 'cournot').sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] || null
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
      <MiniGameShell title="Cournot Competition" sessionsGameType="cournot" publicMode={true}>
        <div className="cou-page"><div className="cou-shell">
          <div className="cou-hero mg-page-hero"><h1>🏭 Cournot Competition</h1></div>
          <div className="cou-card" style={{ textAlign: 'center' }}>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>Educator login required. Students: enter room code to join.</p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <input className="cou-input" placeholder="Firm name" value={nameInput} onChange={e => setNameInput(e.target.value)} />
              <input className="cou-input" placeholder="Room code" value={roomCodeInput} onChange={e => setRoomCodeInput(e.target.value.toUpperCase())} style={{ maxWidth: '140px' }} />
              <button className="cou-btn cou-btn-primary" onClick={joinGame} disabled={loading}>Join</button>
            </div>
            {error && <div className="cou-error">{error}</div>}
          </div>
        </div></div>
      </MiniGameShell>
    )
  }

  if (isLobbyMode && !session) {
    const a = 100, mc = 10
    return (
      <MiniGameShell title="Cournot Competition" subtitle="Oligopoly Equilibrium" sessionsGameType="cournot" publicMode={hasPublicJoinContext}>
        <div className="cou-page"><div className="cou-shell">
          <div className="cou-hero mg-page-hero">
            <h1>🏭 Cournot Competition</h1>
            <p className="cou-sub">Firms choose quantities simultaneously. Market price = {a} − Q. MC = {mc}. Nash: q* = (a−MC)/(n+1)</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
            <div className="cou-card" style={{ border: '1px solid var(--accent-blue)', background: 'rgba(59, 130, 246, 0.05)' }}>
              <h2 style={{ fontSize: '1rem', color: 'var(--accent-blue)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1rem' }}>🏭 How It Works</h2>
              <div style={{ fontSize: '0.95rem', lineHeight: '1.6', color: 'var(--text-primary)', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                <p>📦 <strong>Choose Quantity:</strong> Each firm decides how much to produce simultaneously — without seeing rivals' choices.</p>
                <p>📉 <strong>Market Price Adjusts:</strong> Price = {a} − Total Q. The more firms produce, the lower the price falls.</p>
                <p>🏆 <strong>Nash Equilibrium:</strong> q* = (a−MC)/(n+1) per firm. With more firms, price approaches marginal cost.</p>
                <p>🎯 <strong>The Tension:</strong> Collude = higher profits for all. Defect = gain market share but hurt everyone.</p>
              </div>
              <p style={{ marginTop: '1.2rem', fontSize: '0.85rem', color: 'var(--accent-amber)', fontStyle: 'italic' }}>💡 Best with 2–5 firms over 5+ rounds.</p>
            </div>
            <div className="cou-card">
              <div style={{ display: 'grid', gap: '0.65rem' }}>
                <button className="cou-btn cou-btn-primary" onClick={createGame} disabled={creatingSession}>
                  {creatingSession ? 'Creating...' : 'Create Session'}
                </button>
                <button className="cou-btn cou-btn-secondary" onClick={soloPlay} disabled={loading}>
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
                          <button className="mgsp-btn mgsp-secondary" type="button" title="Copy game code" onClick={() => navigator.clipboard.writeText(latestSession.roomCode || '')}>📋</button>
                        </div>
                    </div>
                    <div className="mg-form-group">
                      <label>Latest Join Link</label>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <input className="mgsp-input" style={{ flex: 1, minWidth: 0, width: '100%' }} value={latestSession.joinByCodeLink || `${window.location.origin}/mini-games/join?code=${encodeURIComponent(latestSession.roomCode || '')}`} readOnly />
                          <button className="mgsp-btn mgsp-secondary" type="button" title="Copy join link" onClick={() => navigator.clipboard.writeText(latestSession.joinByCodeLink || `${window.location.origin}/mini-games/join?code=${encodeURIComponent(latestSession.roomCode || '')}`)}>📋</button>
                        </div>
                        <div style={{ marginTop: 12, display: 'flex', justifyContent: 'center', background: '#fff', borderRadius: 8, padding: 12 }}>
                          <QRCodeSVG value={latestSession.joinByCodeLink || `${window.location.origin}/mini-games/join?code=${encodeURIComponent(latestSession.roomCode || '')}`} size={200} bgColor="#ffffff" fgColor="#0f172a" level="M" />
                        </div>
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Status: <strong>{latestSession.status}</strong> | Joined: {latestSession.joinedCount || 0}/{latestSession.teamCount}</div>
                    {joinedPlayers.length > 0 && (
                      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
                        {joinedPlayers.map((name) => (
                          <span key={name} className="mgsp-pill">{name}</span>
                        ))}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <button className="cou-btn cou-btn-secondary" disabled={quickActionLoading !== null || latestSession.status !== 'LOBBY'} onClick={() => void runQuickAction('start')}>{quickActionLoading === 'start' ? 'Starting...' : latestSession.status === 'LOBBY' ? 'Start' : 'Started'}</button>
                      <button className="cou-btn cou-btn-secondary" disabled={quickActionLoading !== null || latestSession.status !== 'ACTIVE'} onClick={() => void runQuickAction('advance')}>{quickActionLoading === 'advance' ? 'Advancing...' : 'Advance'}</button>
                      <button className="cou-btn cou-btn-secondary" disabled={quickActionLoading !== null || (latestSession.status !== 'ACTIVE' && latestSession.status !== 'COMPLETED')} onClick={() => void runQuickAction('reset')}>{quickActionLoading === 'reset' ? 'Resetting...' : 'Reset'}</button>
                    </div>
                    {quickActionMessage && <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{quickActionMessage}</div>}
                  </div>
                )}
              </div>
            </div>
          </div>
          <MiniGameSessionsTable gameType="cournot" refreshKey={sessionsRefreshKey} />
          {error && <div className="cou-error">{error}</div>}
        </div></div>
      </MiniGameShell>
    )
  }

  if (!session) return (
    <MiniGameShell title="Cournot Competition" sessionsGameType="cournot" publicMode={hasPublicJoinContext}>
      <div className="cou-page"><div className="cou-shell"><div className="cou-loading">Loading...</div></div></div>
    </MiniGameShell>
  )

  const config = session.config
  const myFirm = session.firms.find(f => f.id === playerToken)
  const sortedFirms = [...session.firms].sort((a, b) => b.totalProfit - a.totalProfit)
  const lastRound = session.history[session.history.length - 1]
  const maxQ = Math.round((config.demandIntercept - config.marginalCost) / (2 * config.demandSlope))
  const nashQ = lastRound ? Math.round(lastRound.nashEquilibrium) : 0

  return (
    <MiniGameShell title="Cournot Competition" subtitle="Oligopoly Equilibrium" sessionsGameType="cournot" publicMode={hasPublicJoinContext}>
      <div className="cou-page"><div className="cou-shell">
        <div className="cou-hero mg-page-hero">
          <h1>🏭 Cournot Competition</h1>
          <p className="cou-sub">Room: <strong>{session.roomCode}</strong> · Round {session.currentRound}/{session.config.rounds} · {session.phase.toUpperCase()}</p>
        </div>

        <div className="cou-card" style={{ border: '1px solid var(--accent-blue)', background: 'rgba(59, 130, 246, 0.05)', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1rem', color: 'var(--accent-blue)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1rem' }}>🏭 How It Works</h2>
          <div style={{ fontSize: '0.95rem', lineHeight: '1.6', color: 'var(--text-primary)', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
            <p>📦 <strong>Choose Quantity:</strong> Each firm decides how much to produce simultaneously — without seeing rivals' choices.</p>
            <p>📉 <strong>Market Price Adjusts:</strong> Price = {config.demandIntercept} − Total Q. The more firms produce, the lower the price falls.</p>
            <p>🏆 <strong>Nash Equilibrium:</strong> q* = (a−MC)/(n+1) per firm. With more firms, price approaches marginal cost.</p>
            <p>🎯 <strong>The Tension:</strong> Collude = higher profits for all. Defect = gain market share but hurt everyone.</p>
          </div>
          <p style={{ marginTop: '1.2rem', fontSize: '0.85rem', color: 'var(--accent-amber)', fontStyle: 'italic' }}>💡 Best with 2–5 firms over 5+ rounds.</p>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
          <button className="cou-btn cou-btn-secondary" onClick={leaveGame} style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}>← Leave Game</button>
        </div>

        {session.phase === 'lobby' && (
          <div className="cou-card" style={{ maxWidth: 520, margin: '0 auto' }}>
            <h2>{isHost ? 'Waiting for Firms' : 'Waiting for Host to Start'}</h2>
            <p className="cou-desc">Share code: <strong className="cou-room-code">{session.roomCode}</strong></p>
            <div className="cou-firms-list">{session.firms.map(f => <div key={f.id} className="cou-chip">{f.name}</div>)}</div>
            {isHost && <button className="cou-btn cou-btn-primary" onClick={() => hostAction('start')} disabled={session.firms.length < 2} style={{ marginTop: '1rem' }}>Start ({session.firms.length} firms)</button>}
            {playerToken && !isHost && (
              <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>You've joined — waiting for the host to start the game.</p>
            )}
            {!isHost && !playerToken && (
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
                <input className="cou-input" placeholder="Firm name" value={nameInput} onChange={e => setNameInput(e.target.value)} />
                <button className="cou-btn cou-btn-secondary" onClick={joinGame}>Join</button>
              </div>
            )}
          </div>
        )}

        {session.phase === 'playing' && (
          <div className="cou-game-grid">
            <div className="cou-main-col">
              <div className="cou-card cou-info-card">
                <div className="cou-info-row">
                  <div className="cou-info-item"><span className="cou-info-label">Round</span><span className="cou-info-val">{session.currentRound}/{config.rounds}</span></div>
                  <div className="cou-info-item"><span className="cou-info-label">Demand</span><span className="cou-info-val">P = {config.demandIntercept} − Q</span></div>
                  <div className="cou-info-item"><span className="cou-info-label">MC</span><span className="cou-info-val">{config.marginalCost}</span></div>
                  <div className="cou-info-item"><span className="cou-info-label">Nash q*</span><span className="cou-info-val">{nashQ || '?'}</span></div>
                </div>
              </div>

              {playerToken && myFirm && (
                <div className="cou-card">
                  <h3>Choose Your Quantity — Round {session.currentRound}</h3>
                  {viewer?.hasActed ? (
                    <div className="cou-waiting">Quantity submitted. Waiting for other firms ({session.stats.actedCount}/{session.stats.waitingCount})...</div>
                  ) : (
                    <>
                      <p className="cou-desc">Set output quantity (0–{maxQ * 2}). Market price falls as total output rises.</p>
                      <input type="range" min={0} max={maxQ * 2} value={quantity} onChange={e => setQuantity(Number(e.target.value))} style={{ width: '100%', margin: '1rem 0' }} />
                      <div className="cou-qty-preview">
                        <div className="cou-qty-box"><span className="cou-qty-label">Your Quantity</span><span className="cou-qty-val">{quantity}</span></div>
                        <div className="cou-qty-box cou-nash"><span className="cou-qty-label">Nash q*</span><span className="cou-qty-val">{nashQ}</span></div>
                      </div>
                      <button className="cou-btn cou-btn-primary" onClick={submitQuantity} style={{ width: '100%', marginTop: '1rem' }}>
                        Submit Quantity: {quantity}
                      </button>
                    </>
                  )}
                </div>
              )}

              {lastRound && (
                <div className="cou-card">
                  <h3>Round {lastRound.round} Outcome</h3>
                  <div className="cou-round-stats">
                    {lastRound.totalQuantity !== undefined && <div className="cou-stat"><span className="cou-stat-label">Total Q</span><span className="cou-stat-val">{lastRound.totalQuantity.toFixed(1)}</span></div>}
                    {lastRound.marketPrice !== undefined && <div className="cou-stat"><span className="cou-stat-label">Market Price</span><span className="cou-stat-val">{lastRound.marketPrice.toFixed(1)}</span></div>}
                    <div className="cou-stat"><span className="cou-stat-label">Nash q*</span><span className="cou-stat-val">{lastRound.nashEquilibrium.toFixed(1)}</span></div>
                  </div>
                  <div className="cou-profits">
                    {session.firms.map(f => (
                      <div key={f.id} className={`cou-profit-row ${f.id === playerToken ? 'is-me' : ''}`}>
                        <span>{f.name}</span>
                        <span>q = {lastRound.decisions[f.id] ?? '—'}</span>
                        <span>π = {lastRound.profits[f.id] ?? 0}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="cou-side-col">
              <div className="cou-card">
                <h3>Leaderboard</h3>
                {sortedFirms.map((f, i) => (
                  <div key={f.id} className={`cou-score-row ${f.id === playerToken ? 'is-me' : ''}`}>
                    <span className="cou-rank">#{i+1}</span><span className="cou-fname">{f.name}</span><span className="cou-pts">{Math.round(f.totalProfit)}</span>
                  </div>
                ))}
              </div>
              <div className="cou-card">
                <h3>Events</h3>
                <div className="cou-event-log">{[...session.eventLog].reverse().map((e, i) => <div key={i} className="cou-event">{e}</div>)}</div>
              </div>
              {isHost && (
                <div className="cou-card">
                  <h3>Host Controls</h3>
                  <p className="cou-desc">Ready: {session.stats.actedCount}/{session.stats.waitingCount}</p>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="cou-btn cou-btn-secondary" onClick={() => hostAction('advance')}>Force Advance</button>
                    <button className="cou-btn cou-btn-danger" onClick={() => hostAction('reset')}>Reset</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {session.phase === 'results' && (
          <div className="cou-card" style={{ maxWidth: 640, margin: '0 auto' }}>
            <h2>Competition Over!</h2>
            {sortedFirms.map((f, i) => (
              <div key={f.id} className={`cou-final-row ${i === 0 ? 'winner' : ''}`}>
                <span>{i === 0 ? '🏆' : `#${i+1}`}</span><span style={{ flex: 1 }}>{f.name}</span><span>{Math.round(f.totalProfit)} profit</span>
              </div>
            ))}
            {isHost && <button className="cou-btn cou-btn-secondary" onClick={() => hostAction('reset')} style={{ marginTop: '1.5rem' }}>Play Again</button>}
          </div>
        )}

        {error && <div className="cou-error">{error}</div>}
      </div></div>
    </MiniGameShell>
  )
}



