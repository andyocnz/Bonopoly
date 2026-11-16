import { QRCodeSVG } from 'qrcode.react'
import { useEffect, useMemo, useState, useRef } from 'react'
import { getEducatorSessionCached, getEducatorSessionSync } from '../features/minigames/educatorSession'
import { MiniGameShell } from '../features/minigames/MiniGameShell'
import './PrincipalAgentMiniGamePage.css'
import '../features/minigames/SessionControlPanel.css'
import { educatorMiniGamesApi } from '../features/minigames/api'
import { MiniGameSessionsTable } from '../features/minigames/MiniGameSessionsTable'
import type { EducatorMiniGameSession } from '../api/client'

const STORAGE_KEY = 'principal-agent_minigame_v1'
const GAME_SLUG = 'principal-agent'
const RECOMMENDED_MAX_PLAYERS = 8

type Player = { id: string; name: string; isBot: boolean; totalScore: number; hasActedThisRound: boolean }
type RoundResult = { playerId: string; playerName: string; effort: string; success: boolean; roundPayoff: number }
type RoundSummary = { round: number; results: RoundResult[] }
type Session = {
  roomCode: string; phase: 'lobby' | 'playing' | 'results'
  currentRound: number; config: { wage: number; bonus: number; pH: number; pL: number; effortCost: number; rounds: number }
  players: Player[]; history: RoundSummary[]; eventLog: string[]
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
  const res = await fetch(`/api/minigames${path}`, { headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) }, ...init })
  const text = await res.text()
  let parsed: (T & { success?: boolean; error?: string }) | null = null
  try { if (text) parsed = JSON.parse(text) } catch { throw new Error(`Non-JSON (${res.status})`) }
  if (!res.ok || parsed?.success === false) throw new Error(parsed?.error || `Failed (${res.status})`)
  return (parsed ?? {}) as T
}

export default function PrincipalAgentMiniGamePage() {
  const saved = useMemo(loadTokens, [])
  const query = useMemo(() => new URLSearchParams(window.location.search), [])
  const roomFromUrl = (query.get('room') || '').toUpperCase()
  const nameFromUrl = query.get('name') || ''
  const hostTokenFromUrl = query.get('hostToken') || ''
  const forcePlayerJoinFromUrl = Boolean(roomFromUrl && nameFromUrl && !hostTokenFromUrl)
  const hasPublicJoinContext = Boolean(roomFromUrl || hostTokenFromUrl)

  const [roomCodeInput, setRoomCodeInput] = useState(roomFromUrl || saved.roomCode)
  const [nameInput, setNameInput] = useState(nameFromUrl || saved.playerName || '')
  const [hostToken, setHostToken] = useState<string | null>(hostTokenFromUrl || (forcePlayerJoinFromUrl ? null : saved.hostToken))
  const [playerToken, setPlayerToken] = useState<string | null>(forcePlayerJoinFromUrl ? null : saved.playerToken)
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
        setIsLobbyMode(true)
        setError('Your previous join session expired. Please join again.')
        return
      }
      setSession(data.session); setIsHost(data.isHost); setError(null)
    } catch (e) { if (fetchGuardRef.current === guard) setError((e as Error).message) }
  }

  useEffect(() => {
    if (!roomCode || (!hostToken && !playerToken)) return
    fetchState()
    pollRef.current = setInterval(() => {
      if (document.visibilityState !== 'visible') return
      fetchState()
    }, 2000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [roomCode, hostToken, playerToken])

  useEffect(() => {
    if (hasPublicJoinContext) return
    if (sessionsRefreshKey === 0) return
    const load = async () => {
      setSessionsFetching(true)
      try {
        const sessions = await educatorMiniGamesApi.listSessions()
        const latest = sessions.filter(s => s.gameType === 'principal-agent').sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] || null
        setLatestSession(latest)
      } catch { setLatestSession(null) } finally { setSessionsFetching(false) }
    }
    void load()
  }, [hasPublicJoinContext, canAccessSetup, sessionsRefreshKey])

  async function createGame() {
    setCreatingSession(true); setError(null)
    try {
      await api<{ success: boolean; roomCode: string; hostToken: string; session: Session }>(
        `/${GAME_SLUG}/create`,
        { method: 'POST', body: JSON.stringify({}) },
      )
      setSessionsRefreshKey(v => v + 1)
    } catch (e) { setError((e as Error).message) } finally { setCreatingSession(false) }
  }

  async function soloPlay() {
    setLoading(true); setError(null)
    try {
      const d = await api<{ roomCode: string; hostToken: string; playerToken: string; session: Session }>(`/${GAME_SLUG}/solo`, { method: 'POST', body: JSON.stringify({ name: nameInput || 'Player' }) })
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

  async function hostAction(action: string) {
    if (!roomCode || !hostToken) return
    try {
      const d = await api<{ session: Session }>(`/${GAME_SLUG}/${roomCode}/${action}`, { method: 'POST', body: JSON.stringify({ hostToken }) })
      setSession(d.session)
    } catch (e) { setError((e as Error).message) }
  }

  function leaveGame() {
    fetchGuardRef.current += 1
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
    saveTokens(EMPTY_TOKENS)

    setHostToken(null); setPlayerToken(null); setSession(null); setIsHost(false); setError(null); setIsLobbyMode(true)
  }

  async function submitEffort(effort: 'high' | 'low') {
    if (!roomCode || !playerToken) return
    try {
      const d = await api<{ session: Session }>(`/${GAME_SLUG}/${roomCode}/action`, { method: 'POST', body: JSON.stringify({ playerToken, effort }) })
      setSession(d.session)
    } catch (e) { setError((e as Error).message) }
  }

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
      <MiniGameShell title="Principal-Agent" sessionsGameType="principal-agent" publicMode={true}>
        <div className="pa-page"><div className="pa-shell">
          <div className="pa-hero mg-page-hero"><h1>📋 Principal-Agent</h1></div>
          <div className="pa-card" style={{ textAlign: 'center' }}>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>Educator login required to create. Students: enter room code to join.</p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <input className="pa-input" placeholder="Your name" value={nameInput} onChange={e => setNameInput(e.target.value)} />
              <input className="pa-input" placeholder="Room code" value={roomCodeInput} onChange={e => setRoomCodeInput(e.target.value.toUpperCase())} style={{ maxWidth: '140px' }} />
              <button className="pa-btn pa-btn-primary" onClick={joinGame} disabled={loading}>Join</button>
            </div>
            {error && <div className="pa-error">{error}</div>}
          </div>
        </div></div>
      </MiniGameShell>
    )
  }

  if (isLobbyMode && !session) {
    return (
      <MiniGameShell title="Principal-Agent" subtitle="Moral Hazard & Incentive Contracts" sessionsGameType="principal-agent" publicMode={hasPublicJoinContext}>
        <div className="pa-page"><div className="pa-shell">
          <div className="pa-hero mg-page-hero">
            <h1>📋 Principal-Agent</h1>
            <p className="pa-sub">Hidden effort and moral hazard. Choose your effort level to maximise your expected payoff.</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
            <div className="pa-card" style={{ border: '1px solid var(--accent-blue)', background: 'rgba(59,130,246,0.05)' }}>
              <h2 style={{ fontSize: '1rem', color: 'var(--accent-blue)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1rem' }}>📋 How It Works</h2>
              <div style={{ fontSize: '0.9rem', lineHeight: '1.6', color: 'var(--text-primary)', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                <p>You are an <strong>agent</strong>. The principal offers: fixed wage + success bonus.</p>
                <p>Each round: choose <strong>High Effort</strong> (80% success chance, costs 20) or <strong>Low Effort</strong> (30% success, no cost).</p>
                <p>Payoff = wage + bonus×(success) − effort cost.</p>
                <div className="pa-payoff-table">
                  <div className="pa-pt-header">Effort</div><div className="pa-pt-header">Success %</div><div className="pa-pt-header">Exp. Payoff</div>
                  <div>High</div><div>80%</div><div>10 + 50×0.8 − 20 = <strong>30</strong></div>
                  <div>Low</div><div>30%</div><div>10 + 50×0.3 − 0 = <strong>25</strong></div>
                </div>
              </div>
              <p style={{ marginTop: '1rem', fontSize: '0.82rem', color: 'var(--accent-amber)', fontStyle: 'italic' }}>💡 Best with 4-8 players over 5 rounds.</p>
            </div>
            <div className="pa-card">
              <div style={{ display: 'grid', gap: '0.65rem' }}>
                  <button className="pa-btn pa-btn-primary" onClick={createGame} disabled={creatingSession}>{creatingSession ? 'Creating...' : 'Create Session'}</button>
                  {creatingSession && (
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Creating session. Please wait...</div>
                  )}
                  <button className="pa-btn pa-btn-secondary" onClick={soloPlay} disabled={loading}>{loading ? 'Starting...' : 'Play Solo Test'}</button>
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
                      <label>Latest Game Code</label>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <input className="mgsp-input" style={{ flex: 1, minWidth: 0, width: '100%' }} value={latestSession.roomCode || ''} readOnly />
                        <button className="mgsp-btn mgsp-secondary" onClick={() => navigator.clipboard.writeText(latestSession.roomCode || '')}>📋</button>
                      </div>
                    </div>
                    <div className="mg-form-group">
                      <label>Latest Join Link</label>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <input className="mgsp-input" style={{ flex: 1, minWidth: 0, width: '100%' }} value={latestSession.joinByCodeLink || `${window.location.origin}/mini-games/join?code=${encodeURIComponent(latestSession.roomCode || '')}`} readOnly />
                        <button className="mgsp-btn mgsp-secondary" onClick={() => navigator.clipboard.writeText(latestSession.joinByCodeLink || `${window.location.origin}/mini-games/join?code=${encodeURIComponent(latestSession.roomCode || '')}`)}>📋</button>
                      </div>
                      <div style={{ marginTop: 12, display: 'flex', justifyContent: 'center', background: '#fff', borderRadius: 8, padding: 12 }}>
                        <QRCodeSVG value={latestSession.joinByCodeLink || `${window.location.origin}/mini-games/join?code=${encodeURIComponent(latestSession.roomCode || '')}`} size={200} bgColor="#ffffff" fgColor="#0f172a" level="M" />
                      </div>
                    </div>
                    <div className="pa-setup-status">Status: <strong>{latestSession.status}</strong> | Joined: {latestSession.joinedCount || 0}/{RECOMMENDED_MAX_PLAYERS}</div>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <button className="pa-btn pa-btn-secondary" disabled={quickActionLoading !== null || latestSession.status !== 'LOBBY'} onClick={() => void runQuickAction('start')}>{quickActionLoading === 'start' ? 'Starting...' : latestSession.status === 'LOBBY' ? 'Start' : 'Started'}</button>
                      <button className="pa-btn pa-btn-secondary" disabled={quickActionLoading !== null || latestSession.status !== 'ACTIVE'} onClick={() => void runQuickAction('advance')}>{quickActionLoading === 'advance' ? 'Advancing...' : 'Advance'}</button>
                      <button className="pa-btn pa-btn-secondary" disabled={quickActionLoading !== null || (latestSession.status !== 'ACTIVE' && latestSession.status !== 'COMPLETED')} onClick={() => void runQuickAction('reset')}>{quickActionLoading === 'reset' ? 'Resetting...' : 'Reset'}</button>
                    </div>
                    {quickActionMessage && <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{quickActionMessage}</div>}
                  </div>
                )}
              </div>
            </div>
          </div>
          <MiniGameSessionsTable gameType="principal-agent" refreshKey={sessionsRefreshKey} />
          {error && <div className="pa-error">{error}</div>}
        </div></div>
      </MiniGameShell>
    )
  }

  if (!session) return (
    <MiniGameShell title="Principal-Agent" sessionsGameType="principal-agent" publicMode={hasPublicJoinContext}>
      <div className="pa-page"><div className="pa-shell"><div className="pa-loading">Loading...</div></div></div>
    </MiniGameShell>
  )

  const sortedPlayers = [...session.players].sort((a, b) => b.totalScore - a.totalScore)
  const lastRound = session.history[session.history.length - 1]
  const myLastResult = lastRound?.results.find(r => r.playerId === playerToken)
  const { wage, bonus, pH, pL, effortCost } = session.config
  const expHigh = wage + bonus * pH - effortCost
  const expLow = wage + bonus * pL

  return (
    <MiniGameShell title="Principal-Agent" subtitle="Moral Hazard & Incentive Contracts" sessionsGameType="principal-agent" publicMode={hasPublicJoinContext}>
      <div className="pa-page"><div className="pa-shell">
        <div className="pa-hero mg-page-hero">
          <h1>📋 Principal-Agent</h1>
          <p className="pa-sub">Room: <strong>{session.roomCode}</strong> · Round {session.currentRound}/{session.config.rounds} · {session.phase.toUpperCase()}</p>
        </div>
        <div className="pa-card" style={{ border: '1px solid var(--accent-blue)', background: 'rgba(59,130,246,0.05)', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1rem', color: 'var(--accent-blue)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1rem' }}>📋 How It Works</h2>
          <div style={{ fontSize: '0.9rem', lineHeight: '1.6', color: 'var(--text-primary)', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            <p>You are an <strong>agent</strong>. The principal offers: fixed wage + success bonus.</p>
            <p>Each round: choose <strong>High Effort</strong> ({Math.round(pH * 100)}% success chance, costs ${effortCost}) or <strong>Low Effort</strong> ({Math.round(pL * 100)}% success, no cost).</p>
            <p>Payoff = wage + bonus×(success) − effort cost.</p>
            <div className="pa-payoff-table">
              <div className="pa-pt-header">Effort</div><div className="pa-pt-header">Success %</div><div className="pa-pt-header">Exp. Payoff</div>
              <div>High</div><div>{Math.round(pH * 100)}%</div><div>${wage} + ${bonus}×{pH} − ${effortCost} = <strong>{expHigh.toFixed(1)}</strong></div>
              <div>Low</div><div>{Math.round(pL * 100)}%</div><div>${wage} + ${bonus}×{pL} − $0 = <strong>{expLow.toFixed(1)}</strong></div>
            </div>
          </div>
          <p style={{ marginTop: '1rem', fontSize: '0.82rem', color: 'var(--accent-amber)', fontStyle: 'italic' }}>💡 Best with 4-8 players over 5 rounds.</p>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
          <button className="pa-btn pa-btn-secondary" onClick={leaveGame} style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}>← Leave Game</button>
        </div>

        {session.phase === 'lobby' && (
          <div className="pa-card" style={{ maxWidth: 520, margin: '0 auto' }}>
            <h2>{isHost ? 'Waiting for Players' : 'Waiting for Host to Start'}</h2>
            <p className="pa-desc">Share code: <strong className="pa-room-code">{session.roomCode}</strong></p>
            {!isHost && playerToken && (
              <p className="pa-desc">Waiting for players to join, then waiting for host to start.</p>
            )}
            <div className="pa-players-list">{session.players.map(p => <div key={p.id} className="pa-chip">{p.name}</div>)}</div>
            {isHost && <button className="pa-btn pa-btn-primary" onClick={() => hostAction('start')} disabled={session.players.length < 2} style={{ marginTop: '1rem' }}>Start ({session.players.length}/2+ players)</button>}
            {playerToken && !isHost && (
              <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>You've joined — waiting for the host to start the game.</p>
            )}
            {!isHost && !playerToken && (
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
                <input className="pa-input" placeholder="Your name" value={nameInput} onChange={e => setNameInput(e.target.value)} />
                <button className="pa-btn pa-btn-secondary" onClick={joinGame}>Join</button>
              </div>
            )}
          </div>
        )}

        {session.phase === 'playing' && (
          <div className="pa-game-grid">
            <div className="pa-main-col">
              <div className="pa-card pa-info-card">
                <div className="pa-info-row">
                  <div className="pa-info-item"><span className="pa-info-label">Round</span><span className="pa-info-val">{session.currentRound}/{session.config.rounds}</span></div>
                  <div className="pa-info-item"><span className="pa-info-label">Wage</span><span className="pa-info-val">${wage}</span></div>
                  <div className="pa-info-item"><span className="pa-info-label">Bonus</span><span className="pa-info-val">${bonus}</span></div>
                  <div className="pa-info-item"><span className="pa-info-label">My Score</span><span className="pa-info-val">{session.viewer?.totalScore ?? 0}</span></div>
                </div>
              </div>

              {playerToken && (
                <div className="pa-card">
                  <h3>Round {session.currentRound} — Choose Your Effort</h3>
                  {session.viewer?.hasActed ? (
                    <div className="pa-waiting">Effort submitted. Waiting for others ({session.stats.actedCount}/{session.stats.waitingCount} ready), then host will process the round.</div>
                  ) : (
                    <>
                      <p className="pa-desc">Contract: fixed wage ${wage} + success bonus ${bonus}. Expected payoffs:</p>
                      <div className="pa-effort-btns">
                        <button className="pa-btn pa-btn-effort" onClick={() => submitEffort('high')}>
                          <span className="pa-effort-title">High Effort</span>
                          <span className="pa-effort-detail">{Math.round(pH * 100)}% success · Cost ${effortCost}</span>
                          <span className="pa-effort-exp">E[payoff] = {expHigh.toFixed(1)}</span>
                        </button>
                        <button className="pa-btn pa-btn-effort" onClick={() => submitEffort('low')}>
                          <span className="pa-effort-title">Low Effort</span>
                          <span className="pa-effort-detail">{Math.round(pL * 100)}% success · Cost $0</span>
                          <span className="pa-effort-exp">E[payoff] = {expLow.toFixed(1)}</span>
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}

              {myLastResult && (
                <div className="pa-card">
                  <h3>Round {lastRound.round} Outcome</h3>
                  <div className="pa-round-result">
                    <div className="pa-result-box"><span className="pa-result-label">Your Effort</span><span className="pa-result-val" style={{ fontSize: '1rem', textTransform: 'capitalize' }}>{myLastResult.effort}</span></div>
                    <div className="pa-result-box"><span className="pa-result-label">Outcome</span><span className="pa-result-val" style={{ color: myLastResult.success ? '#16a34a' : '#dc2626' }}>{myLastResult.success ? 'SUCCESS' : 'FAIL'}</span></div>
                    <div className="pa-result-box"><span className="pa-result-label">Payoff</span><span className="pa-result-val" style={{ color: 'var(--accent)' }}>+{myLastResult.roundPayoff}</span></div>
                  </div>
                </div>
              )}
            </div>

            <div className="pa-side-col">
              <div className="pa-card">
                <h3>Scoreboard</h3>
                {sortedPlayers.map((p, i) => (
                  <div key={p.id} className={`pa-score-row ${p.id === playerToken ? 'is-me' : ''}`}>
                    <span className="pa-rank">#{i+1}</span><span className="pa-pname">{p.name}{p.isBot ? ' 🤖' : ''}</span><span className="pa-pts">{p.totalScore}</span>
                  </div>
                ))}
              </div>
              {session.history.length > 0 && (
                <div className="pa-card">
                  <h3>Round History</h3>
                  <div className="pa-history">
                    {session.history.map(r => {
                      const my = r.results.find(x => x.playerId === playerToken)
                      return (
                        <div key={r.round} className="pa-hist-row">
                          <span>R{r.round}</span>
                          {my && <span className={`pa-effort-tag ${my.effort}`}>{my.effort[0].toUpperCase()}</span>}
                          {my && <span style={{ color: my.success ? '#16a34a' : '#dc2626' }}>{my.success ? '✓' : '✗'}</span>}
                          {my && <span style={{ color: 'var(--accent)', fontWeight: 700 }}>+{my.roundPayoff}</span>}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
              <div className="pa-card">
                <h3>Events</h3>
                <div className="pa-event-log">{[...session.eventLog].reverse().map((e, i) => <div key={i} className="pa-event">{e}</div>)}</div>
              </div>
              {isHost && (
                <div className="pa-card">
                  <h3>Host Controls</h3>
                  <p className="pa-desc">Ready: {session.stats.actedCount}/{session.stats.waitingCount}</p>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="pa-btn pa-btn-secondary" onClick={() => hostAction('advance')}>Force Advance</button>
                    <button className="pa-btn pa-btn-danger" onClick={() => hostAction('reset')}>Reset</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {session.phase === 'results' && (
          <div className="pa-card" style={{ maxWidth: 640, margin: '0 auto' }}>
            <h2>Game Complete!</h2>
            <div style={{ marginBottom: '1.5rem' }}>
              {sortedPlayers.map((p, i) => (
                <div key={p.id} className={`pa-final-row ${i === 0 ? 'winner' : ''}`}>
                  <span>{i === 0 ? '🏆' : `#${i+1}`}</span>
                  <span style={{ flex: 1 }}>{p.name}{p.isBot ? ' 🤖' : ''}</span>
                  <span>{p.totalScore} pts</span>
                </div>
              ))}
            </div>
            {isHost && <button className="pa-btn pa-btn-secondary" onClick={() => hostAction('reset')} style={{ marginTop: '1.5rem' }}>Play Again</button>}
          </div>
        )}

        {error && <div className="pa-error">{error}</div>}
      </div></div>
    </MiniGameShell>
  )
}


