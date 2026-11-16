import { QRCodeSVG } from 'qrcode.react'
import { useEffect, useMemo, useState, useRef } from 'react'
import { getEducatorSessionCached, getEducatorSessionSync } from '../features/minigames/educatorSession'
import { MiniGameShell } from '../features/minigames/MiniGameShell'
import './SignalingMiniGamePage.css'
import '../features/minigames/SessionControlPanel.css'
import { educatorMiniGamesApi } from '../features/minigames/api'
import { MiniGameSessionsTable } from '../features/minigames/MiniGameSessionsTable'
import type { EducatorMiniGameSession } from '../api/client'

const STORAGE_KEY = 'signaling-game_minigame_v1'
const GAME_SLUG = 'signaling-game'
const RECOMMENDED_MAX_PLAYERS = 8

type Player = { id: string; name: string; isBot: boolean; totalScore: number; hasActedThisRound: boolean }
type RoundResult = { playerId: string; playerName: string; workerType: string; eduChoice: number; wage: number; cost: number; roundPayoff: number }
type RoundSummary = { round: number; results: RoundResult[] }
type Session = {
  roomCode: string; phase: 'lobby' | 'playing' | 'results'
  currentRound: number; config: { wageSchedule: [number, number, number]; highTypeCost: number; lowTypeCost: number; rounds: number }
  currentScenario: { label: string; wageSchedule: [number, number, number]; highTypeCost: number; lowTypeCost: number }
  players: Player[]; history: RoundSummary[]; eventLog: string[]
  stats: { actedCount: number; waitingCount: number }
  viewer: { totalScore: number; hasActed: boolean; workerType: string } | null
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

export default function SignalingMiniGamePage() {
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
        fetchGuardRef.current += 1
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
        saveTokens(EMPTY_TOKENS)
        setPlayerToken(null)
        setHostToken(null)
        setSession(null)
        setIsHost(false)
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
    pollRef.current = setInterval(fetchState, 2000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [roomCode, hostToken, playerToken])

  useEffect(() => {
    if (hasPublicJoinContext) return
    if (sessionsRefreshKey === 0) return
    const load = async () => {
      setSessionsFetching(true)
      try {
        const sessions = await educatorMiniGamesApi.listSessions()
        const latest = sessions.filter(s => s.gameType === 'signaling-game').sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] || null
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

  async function createGame() {
    setCreatingSession(true); setError(null)
    try {
      await api<{ roomCode: string; hostToken: string; session: Session }>(
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
    if (session || (!forcePlayerJoinFromUrl && (hostToken || playerToken))) return

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
  }, [roomFromUrl, nameFromUrl, hostTokenFromUrl, forcePlayerJoinFromUrl, session, hostToken, playerToken])

  function leaveGame() {
    fetchGuardRef.current += 1
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
    saveTokens(EMPTY_TOKENS)

    setHostToken(null); setPlayerToken(null); setSession(null); setIsHost(false); setError(null); setIsLobbyMode(true)
  }

  async function submitAction(eduChoice: number) {
    if (!roomCode || !playerToken) return
    try {
      const d = await api<{ session: Session }>(`/${GAME_SLUG}/${roomCode}/action`, { method: 'POST', body: JSON.stringify({ playerToken, eduChoice }) })
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
      <MiniGameShell title="Signaling Game" sessionsGameType="signaling-game" publicMode={true}>
        <div className="sg-page"><div className="sg-shell">
          <div className="sg-hero mg-page-hero"><h1>🎓 Signaling Game</h1></div>
          <div className="sg-card" style={{ textAlign: 'center' }}>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>Educator login required to create. Students: enter room code to join.</p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <input className="sg-input" placeholder="Your name" value={nameInput} onChange={e => setNameInput(e.target.value)} />
              <input className="sg-input" placeholder="Room code" value={roomCodeInput} onChange={e => setRoomCodeInput(e.target.value.toUpperCase())} style={{ maxWidth: '140px' }} />
              <button className="sg-btn sg-btn-primary" onClick={joinGame} disabled={loading}>Join</button>
            </div>
            {error && <div className="sg-error">{error}</div>}
          </div>
        </div></div>
      </MiniGameShell>
    )
  }

  if (isLobbyMode && !session) {
    return (
      <MiniGameShell title="Signaling Game" subtitle="Spence Education Signaling" sessionsGameType="signaling-game" publicMode={hasPublicJoinContext}>
        <div className="sg-page"><div className="sg-shell">
          <div className="sg-hero mg-page-hero">
            <h1>🎓 Signaling Game</h1>
            <p className="sg-sub">You are a worker with a private type. Invest in education to signal productivity — but at a cost.</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
            <div className="sg-card" style={{ border: '1px solid var(--accent-blue)', background: 'rgba(59,130,246,0.05)' }}>
              <h2 style={{ fontSize: '1rem', color: 'var(--accent-blue)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1rem' }}>🎓 How It Works</h2>
              <div style={{ fontSize: '0.9rem', lineHeight: '1.6', color: 'var(--text-primary)', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                <p>You are randomly assigned <strong>High-type</strong> (cost 10/level) or <strong>Low-type</strong> (cost 40/level).</p>
                <p>Each round: choose education level <strong>0, 1, or 2</strong>.</p>
                <p>Employer pays wages: edu=0 -&gt; $50, edu=1 -&gt; $50, edu=2 -&gt; $100.</p>
                <p>Your payoff = <strong>wage − (edu × cost)</strong>.</p>
              </div>
              <div className="sg-wage-table">
                <div className="sg-wt-header">Edu Level</div><div className="sg-wt-header">Wage</div><div className="sg-wt-header">High Cost</div><div className="sg-wt-header">Low Cost</div>
                <div>0 (None)</div><div>$50</div><div>$50 net</div><div>$50 net</div>
                <div>1 (Some)</div><div>$50</div><div>$40 net</div><div>$10 net</div>
                <div>2 (Full)</div><div>$100</div><div>$80 net</div><div>$20 net</div>
              </div>
              <p style={{ marginTop: '1rem', fontSize: '0.82rem', color: 'var(--accent-amber)', fontStyle: 'italic' }}>💡 Best with 4-8 players over 3 rounds.</p>
            </div>
            <div className="sg-card">
              <div style={{ display: 'grid', gap: '0.65rem' }}>
                <button className="sg-btn sg-btn-primary" onClick={createGame} disabled={creatingSession}>{creatingSession ? 'Creating...' : 'Create Simulation'}</button>
                <button className="sg-btn sg-btn-secondary" onClick={soloPlay} disabled={loading}>{loading ? 'Starting...' : 'Play Solo Test'}</button>
                {!latestSession && sessionsRefreshKey === 0 && (
                  <button type="button" className="sg-btn sg-btn-secondary" style={{ fontSize: '0.85rem' }} onClick={() => setSessionsRefreshKey(1)}>
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
                          <button type="button" className="sg-btn sg-btn-secondary" onClick={() => navigator.clipboard.writeText(latestSession.roomCode || '')}>📋</button>
                        </div>
                    </div>
                    <div className="mg-form-group">
                      <label>Latest Join Link</label>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <input className="mgsp-input" style={{ flex: 1, minWidth: 0, width: '100%' }} value={latestSession.joinByCodeLink || `${window.location.origin}/mini-games/join?code=${encodeURIComponent(latestSession.roomCode || '')}`} readOnly />
                          <button type="button" className="sg-btn sg-btn-secondary" onClick={() => navigator.clipboard.writeText(latestSession.joinByCodeLink || `${window.location.origin}/mini-games/join?code=${encodeURIComponent(latestSession.roomCode || '')}`)}>📋</button>
                        </div>
                        <div style={{ marginTop: 12, display: 'flex', justifyContent: 'center', background: '#fff', borderRadius: 8, padding: 12 }}>
                          <QRCodeSVG value={latestSession.joinByCodeLink || `${window.location.origin}/mini-games/join?code=${encodeURIComponent(latestSession.roomCode || '')}`} size={200} bgColor="#ffffff" fgColor="#0f172a" level="M" />
                        </div>
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Status: <strong>{latestSession.status}</strong> | Joined: {latestSession.joinedCount || 0}/{RECOMMENDED_MAX_PLAYERS}</div>
                    {joinedPlayers.length > 0 && (
                      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
                        {joinedPlayers.map((name) => (
                          <span key={name} className="mgsp-pill">{name}</span>
                        ))}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <button className="sg-btn sg-btn-secondary" disabled={quickActionLoading !== null || latestSession.status !== 'LOBBY'} onClick={() => void runQuickAction('start')}>{quickActionLoading === 'start' ? 'Starting...' : latestSession.status === 'LOBBY' ? 'Start' : 'Started'}</button>
                      <button className="sg-btn sg-btn-secondary" disabled={quickActionLoading !== null || latestSession.status !== 'ACTIVE'} onClick={() => void runQuickAction('advance')}>{quickActionLoading === 'advance' ? 'Advancing...' : 'Advance'}</button>
                      <button className="sg-btn sg-btn-secondary" disabled={quickActionLoading !== null || (latestSession.status !== 'ACTIVE' && latestSession.status !== 'COMPLETED')} onClick={() => void runQuickAction('reset')}>{quickActionLoading === 'reset' ? 'Resetting...' : 'Reset'}</button>
                    </div>
                    {quickActionMessage && <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{quickActionMessage}</div>}
                  </div>
                )}
              </div>
            </div>
          </div>
          <MiniGameSessionsTable gameType="signaling-game" refreshKey={sessionsRefreshKey} />
          {error && <div className="sg-error">{error}</div>}
        </div></div>
      </MiniGameShell>
    )
  }

  if (!session) return (
    <MiniGameShell title="Signaling Game" sessionsGameType="signaling-game" publicMode={hasPublicJoinContext}>
      <div className="sg-page"><div className="sg-shell"><div className="sg-loading">Loading...</div></div></div>
    </MiniGameShell>
  )

  const sortedPlayers = [...session.players].sort((a, b) => b.totalScore - a.totalScore)
  const lastRound = session.history[session.history.length - 1]
  const myLastResult = lastRound?.results.find(r => r.playerId === playerToken)
  const isHigh = session.viewer?.workerType === 'high'
  const costPerLevel = isHigh ? session.currentScenario.highTypeCost : session.currentScenario.lowTypeCost
  const eduLabels = ['0 — No education', '1 — Some education', '2 — Full education']

  return (
    <MiniGameShell title="Signaling Game" subtitle="Spence Education Signaling" sessionsGameType="signaling-game" publicMode={hasPublicJoinContext}>
      <div className="sg-page"><div className="sg-shell">
        <div className="sg-hero mg-page-hero">
          <h1>🎓 Signaling Game</h1>
          <p className="sg-sub">Room: <strong>{session.roomCode}</strong> · Round {session.currentRound}/{session.config.rounds} · {session.phase.toUpperCase()}</p>
        </div>
        {session.phase === 'playing' && (
          <div className="sg-card" style={{ marginBottom: '1rem', border: '1px solid var(--accent-blue)', background: 'rgba(59,130,246,0.05)' }}>
            <strong>{session.currentScenario.label}</strong>
          </div>
        )}
        <div className="sg-card" style={{ border: '1px solid var(--accent-blue)', background: 'rgba(59,130,246,0.05)', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1rem', color: 'var(--accent-blue)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1rem' }}>🎓 How It Works</h2>
          <div style={{ fontSize: '0.9rem', lineHeight: '1.6', color: 'var(--text-primary)', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            <p>You are randomly assigned <strong>High-type</strong> (cost 10/level) or <strong>Low-type</strong> (cost 40/level).</p>
            <p>Each round: choose education level <strong>0, 1, or 2</strong>.</p>
            <p>Employer pays wages this round: edu=0 -&gt; {session.currentScenario.wageSchedule[0]}, edu=1 -&gt; {session.currentScenario.wageSchedule[1]}, edu=2 -&gt; {session.currentScenario.wageSchedule[2]}.</p>
            <p>Your payoff = <strong>wage − (edu × cost)</strong>.</p>
          </div>
          <div className="sg-wage-table">
            <div className="sg-wt-header">Edu Level</div><div className="sg-wt-header">Wage</div><div className="sg-wt-header">High Cost</div><div className="sg-wt-header">Low Cost</div>
            <div>0 (None)</div><div>{session.currentScenario.wageSchedule[0]}</div><div>{session.currentScenario.wageSchedule[0]}</div><div>{session.currentScenario.wageSchedule[0]}</div>
            <div>1 (Some)</div><div>{session.currentScenario.wageSchedule[1]}</div><div>{session.currentScenario.wageSchedule[1] - session.currentScenario.highTypeCost}</div><div>{session.currentScenario.wageSchedule[1] - session.currentScenario.lowTypeCost}</div>
            <div>2 (Full)</div><div>{session.currentScenario.wageSchedule[2]}</div><div>{session.currentScenario.wageSchedule[2] - (2 * session.currentScenario.highTypeCost)}</div><div>{session.currentScenario.wageSchedule[2] - (2 * session.currentScenario.lowTypeCost)}</div>
          </div>
          <p style={{ marginTop: '1rem', fontSize: '0.82rem', color: 'var(--accent-amber)', fontStyle: 'italic' }}>💡 Best with 4-8 players over 3 rounds.</p>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
          <button className="sg-btn sg-btn-secondary" onClick={leaveGame} style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}>← Leave Game</button>
        </div>

        {session.phase === 'lobby' && (
          <div className="sg-card" style={{ maxWidth: 520, margin: '0 auto' }}>
            <h2>{isHost ? 'Waiting for Players' : 'Waiting for Host to Start'}</h2>
            <p className="sg-desc">Share code: <strong className="sg-room-code">{session.roomCode}</strong></p>
            <div className="sg-players-list">{session.players.map(p => <div key={p.id} className="sg-chip">{p.name}</div>)}</div>
            {isHost && <button className="sg-btn sg-btn-primary" onClick={() => hostAction('start')} disabled={session.players.length < 2} style={{ marginTop: '1rem' }}>Start ({session.players.length}/2+ players)</button>}
            {playerToken && !isHost && (
              <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>You've joined — waiting for the host to start the game.</p>
            )}
            {!isHost && !playerToken && (
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
                <input className="sg-input" placeholder="Your name" value={nameInput} onChange={e => setNameInput(e.target.value)} />
                <button className="sg-btn sg-btn-secondary" onClick={joinGame}>Join</button>
              </div>
            )}
          </div>
        )}

        {session.phase === 'playing' && (
          <div className="sg-game-grid">
            <div className="sg-main-col">
              <div className="sg-card sg-info-card">
                <div className="sg-info-row">
                  <div className="sg-info-item"><span className="sg-info-label">Round</span><span className="sg-info-val">{session.currentRound}/{session.config.rounds}</span></div>
                  <div className="sg-info-item"><span className="sg-info-label">My Score</span><span className="sg-info-val">{session.viewer?.totalScore ?? 0}</span></div>
                  {session.viewer && <div className="sg-info-item"><span className="sg-info-label">My Type</span><span className="sg-info-val" style={{ color: isHigh ? '#16a34a' : '#dc2626' }}>{isHigh ? 'HIGH' : 'LOW'}</span></div>}
                  {session.viewer && <div className="sg-info-item"><span className="sg-info-label">Edu Cost</span><span className="sg-info-val">${costPerLevel}/level</span></div>}
                </div>
              </div>

              {playerToken && session.viewer && (
                <div className="sg-card">
                  <h3>Round {session.currentRound} — Choose Education Level</h3>
                  {session.viewer.hasActed ? (
                    <div className="sg-waiting">Choice submitted. Waiting for others ({session.stats.actedCount}/{session.stats.waitingCount} ready)...</div>
                  ) : (
                    <>
                      <p className="sg-desc">You are a <strong style={{ color: isHigh ? '#16a34a' : '#dc2626' }}>{isHigh ? 'HIGH' : 'LOW'}</strong>-type worker. Education cost: ${costPerLevel}/level.</p>
                      <div className="sg-edu-btns">
                        {[0, 1, 2].map(edu => {
                          const wage = session.currentScenario.wageSchedule[edu]
                          const cost = edu * costPerLevel
                          const net = wage - cost
                          return (
                            <button key={edu} className="sg-edu-btn" onClick={() => submitAction(edu)}>
                              <span className="sg-edu-level">{eduLabels[edu]}</span>
                              <span className="sg-edu-wage">Wage: ${wage}</span>
                              <span className="sg-edu-cost">Cost: ${cost}</span>
                              <span className="sg-edu-net" style={{ color: net > 0 ? '#16a34a' : '#dc2626' }}>Net: ${net}</span>
                            </button>
                          )
                        })}
                      </div>
                    </>
                  )}
                </div>
              )}

              {myLastResult && (
                <div className="sg-card">
                  <h3>Round {lastRound.round} Result</h3>
                  <div className="sg-round-result">
                    <div className="sg-result-box"><span className="sg-result-label">Education</span><span className="sg-result-val">{myLastResult.eduChoice}</span></div>
                    <div className="sg-result-box"><span className="sg-result-label">Wage</span><span className="sg-result-val">${myLastResult.wage}</span></div>
                    <div className="sg-result-box"><span className="sg-result-label">Cost</span><span className="sg-result-val">−${myLastResult.cost}</span></div>
                    <div className="sg-result-box"><span className="sg-result-label">Payoff</span><span className="sg-result-val" style={{ color: 'var(--accent)' }}>+{myLastResult.roundPayoff}</span></div>
                  </div>
                </div>
              )}
            </div>

            <div className="sg-side-col">
              <div className="sg-card">
                <h3>Scoreboard</h3>
                {sortedPlayers.map((p, i) => (
                  <div key={p.id} className={`sg-score-row ${p.id === playerToken ? 'is-me' : ''}`}>
                    <span className="sg-rank">#{i+1}</span><span className="sg-pname">{p.name}{p.isBot ? ' 🤖' : ''}</span><span className="sg-pts">{p.totalScore}</span>
                  </div>
                ))}
              </div>
              {session.history.length > 0 && (
                <div className="sg-card">
                  <h3>Round History</h3>
                  <div className="sg-history">
                    {session.history.map(r => {
                      const my = r.results.find(x => x.playerId === playerToken)
                      return (
                        <div key={r.round} className="sg-hist-row">
                          <span>R{r.round}</span>
                          {my && <span className="sg-hist-edu">Edu={my.eduChoice}</span>}
                          {my && <span style={{ color: 'var(--accent)', fontWeight: 700 }}>+{my.roundPayoff}</span>}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
              <div className="sg-card">
                <h3>Events</h3>
                <div className="sg-event-log">{[...session.eventLog].reverse().map((e, i) => <div key={i} className="sg-event">{e}</div>)}</div>
              </div>
              {isHost && (
                <div className="sg-card">
                  <h3>Host Controls</h3>
                  <p className="sg-desc">Ready: {session.stats.actedCount}/{session.stats.waitingCount}</p>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="sg-btn sg-btn-secondary" onClick={() => hostAction('advance')}>Force Advance</button>
                    <button className="sg-btn sg-btn-danger" onClick={() => hostAction('reset')}>Reset</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {session.phase === 'results' && (
          <div className="sg-card" style={{ maxWidth: 640, margin: '0 auto' }}>
            <h2>Game Complete!</h2>
            <div style={{ marginBottom: '1.5rem' }}>
              {sortedPlayers.map((p, i) => (
                <div key={p.id} className={`sg-final-row ${i === 0 ? 'winner' : ''}`}>
                  <span>{i === 0 ? '🏆' : `#${i+1}`}</span>
                  <span style={{ flex: 1 }}>{p.name}{p.isBot ? ' 🤖' : ''}</span>
                  <span>{p.totalScore} pts</span>
                </div>
              ))}
            </div>
            {isHost && <button className="sg-btn sg-btn-secondary" onClick={() => hostAction('reset')} style={{ marginTop: '1.5rem' }}>Play Again</button>}
          </div>
        )}

        {error && <div className="sg-error">{error}</div>}
      </div></div>
    </MiniGameShell>
  )
}







