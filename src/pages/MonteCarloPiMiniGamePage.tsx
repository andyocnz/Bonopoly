import { QRCodeSVG } from 'qrcode.react'
import { useEffect, useMemo, useState, useRef } from 'react'
import { getEducatorSessionCached, getEducatorSessionSync } from '../features/minigames/educatorSession'
import { MiniGameShell } from '../features/minigames/MiniGameShell'
import './MonteCarloPiMiniGamePage.css'
import '../features/minigames/SessionControlPanel.css'
import { educatorMiniGamesApi } from '../features/minigames/api'
import { MiniGameSessionsTable } from '../features/minigames/MiniGameSessionsTable'
import type { EducatorMiniGameSession } from '../api/client'

const STORAGE_KEY = 'monte-carlo-pi_minigame_v1'
const GAME_SLUG = 'monte-carlo-pi'

type McpConfig = { rounds: number; budget: number; trialCost: number; maxTrials: number }
type McpPlayer = { id: string; name: string; isBot: boolean; totalScore: number; budgetRemaining: number; hasActedThisRound: boolean }
type McpRoundResult = { playerId: string; playerName: string; trialsChosen: number; estimate: number; error: number; roundScore: number; budgetSpent: number; budgetRemaining: number }
type McpRoundSummary = { round: number; results: McpRoundResult[] }
type Session = {
  roomCode: string; phase: 'lobby' | 'playing' | 'results'
  currentRound: number; config: McpConfig
  players: McpPlayer[]; history: McpRoundSummary[]; eventLog: string[]
  stats: { actedCount: number; waitingCount: number }
  viewer: { totalScore: number; budgetRemaining: number; hasActed: boolean } | null
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

export default function MonteCarloPiMiniGamePage() {
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
  const [trialsInput, setTrialsInput] = useState(50)

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
      await educatorMiniGamesApi.createSession({ gameType: 'monte-carlo-pi', teamCount: 40 })
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

  async function submitTrials() {
    if (!roomCode || !playerToken) return
    try {
      const d = await api<{ session: Session }>(`/${GAME_SLUG}/${roomCode}/action`, { method: 'POST', body: JSON.stringify({ playerToken, trials: trialsInput }) })
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
        const latest = sessions.filter(s => s.gameType === 'monte-carlo-pi').sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] || null
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
      <MiniGameShell title="Monte Carlo Pi" sessionsGameType="monte-carlo-pi" publicMode={true}>
        <div className="mcp-page"><div className="mcp-shell">
          <div className="mcp-hero mg-page-hero"><h1>🎲 Monte Carlo Pi</h1></div>
          <div className="mcp-card" style={{ textAlign: 'center' }}>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>Educator login required to create. Students: enter room code to join.</p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <input className="mcp-input" placeholder="Your name" value={nameInput} onChange={e => setNameInput(e.target.value)} />
              <input className="mcp-input" placeholder="Room code" value={roomCodeInput} onChange={e => setRoomCodeInput(e.target.value.toUpperCase())} style={{ maxWidth: '140px' }} />
              <button className="mcp-btn mcp-btn-primary" onClick={joinGame} disabled={loading}>Join</button>
            </div>
            {error && <div className="mcp-error">{error}</div>}
          </div>
        </div></div>
      </MiniGameShell>
    )
  }

  if (isLobbyMode && !session) {
    return (
      <MiniGameShell title="Monte Carlo Pi" subtitle="Budget vs Precision" sessionsGameType="monte-carlo-pi" publicMode={hasPublicJoinContext}>
        <div className="mcp-page"><div className="mcp-shell">
          <div className="mcp-hero mg-page-hero">
            <h1>🎲 Monte Carlo Pi</h1>
            <p className="mcp-sub">Race to estimate π with a limited budget. More trials = more accuracy, but each trial costs money. Spend wisely!</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
            <div className="mcp-card" style={{ border: '1px solid var(--accent)', background: 'rgba(5,150,105,0.05)' }}>
              <h2 style={{ fontSize: '1rem', color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1rem' }}>🎲 How It Works</h2>
              <div style={{ fontSize: '0.95rem', lineHeight: '1.6', color: 'var(--text)', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                <p>💰 <strong>Budget:</strong> Each player starts with $50 (5 rounds). Each trial costs $0.50.</p>
                <p>🎯 <strong>Goal:</strong> Estimate π by throwing random darts at a unit circle. More darts = closer estimate.</p>
                <p>📊 <strong>Score:</strong> Accuracy points (closer to π) + Efficiency bonus (budget saved).</p>
                <p>🏆 <strong>Strategy:</strong> Balance trial count vs. budget savings. Leftover budget earns bonus points!</p>
              </div>
              <p style={{ marginTop: '1.2rem', fontSize: '0.85rem', color: 'var(--accent)', fontStyle: 'italic' }}>💡 π ≈ 3.14159. More trials reduce variance but cost more.</p>
            </div>
            <div className="mcp-card">
              <div style={{ display: 'grid', gap: '0.65rem' }}>
                <button className="mcp-btn mcp-btn-primary" onClick={createGame} disabled={creatingSession}>
                  {creatingSession ? 'Creating...' : 'Create Session'}
                </button>
                <button className="mcp-btn mcp-btn-secondary" onClick={soloPlay} disabled={loading}>
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
                      <button className="mcp-btn mcp-btn-secondary" disabled={quickActionLoading !== null || latestSession.status !== 'LOBBY'} onClick={() => void runQuickAction('start')}>{quickActionLoading === 'start' ? 'Starting...' : latestSession.status === 'LOBBY' ? 'Start' : 'Started'}</button>
                      <button className="mcp-btn mcp-btn-secondary" disabled={quickActionLoading !== null || latestSession.status !== 'ACTIVE'} onClick={() => void runQuickAction('advance')}>{quickActionLoading === 'advance' ? 'Advancing...' : 'Advance'}</button>
                      <button className="mcp-btn mcp-btn-secondary" disabled={quickActionLoading !== null || (latestSession.status !== 'ACTIVE' && latestSession.status !== 'COMPLETED')} onClick={() => void runQuickAction('reset')}>{quickActionLoading === 'reset' ? 'Resetting...' : 'Reset'}</button>
                    </div>
                    {quickActionMessage && <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{quickActionMessage}</div>}
                  </div>
                )}
              </div>
            </div>
          </div>
          <MiniGameSessionsTable gameType="monte-carlo-pi" refreshKey={sessionsRefreshKey} />
          {error && <div className="mcp-error">{error}</div>}
        </div></div>
      </MiniGameShell>
    )
  }

  if (!session) return (
    <MiniGameShell title="Monte Carlo Pi" sessionsGameType="monte-carlo-pi" publicMode={hasPublicJoinContext}>
      <div className="mcp-page"><div className="mcp-shell"><div className="mcp-loading">Loading...</div></div></div>
    </MiniGameShell>
  )

  const myPlayer = session.players.find(p => p.id === playerToken)
  const sortedPlayers = [...session.players].sort((a, b) => b.totalScore - a.totalScore)
  const lastRound = session.history[session.history.length - 1]
  const myLastResult = lastRound?.results.find(r => r.playerId === playerToken)
  const config = session.config
  const myBudget = myPlayer?.budgetRemaining ?? session.viewer?.budgetRemaining ?? config.budget
  const trialCost = trialsInput * config.trialCost
  const canAfford = trialsInput <= Math.floor(myBudget / config.trialCost)

  return (
    <MiniGameShell title="Monte Carlo Pi" subtitle="Budget vs Precision" sessionsGameType="monte-carlo-pi" publicMode={hasPublicJoinContext}>
      <div className="mcp-page"><div className="mcp-shell">
        <div className="mcp-hero mg-page-hero">
          <h1>🎲 Monte Carlo Pi</h1>
          <p className="mcp-sub">Room: <strong>{session.roomCode}</strong> · Round {session.currentRound}/{config.rounds} · {session.phase.toUpperCase()}</p>
        </div>

        <div className="mcp-card" style={{ border: '1px solid var(--accent)', background: 'rgba(5,150,105,0.05)', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1rem', color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1rem' }}>🎲 How It Works</h2>
          <div style={{ fontSize: '0.95rem', lineHeight: '1.6', color: 'var(--text)', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
            <p>💰 <strong>Budget:</strong> Each player starts with $50 (5 rounds). Each trial costs $0.50.</p>
            <p>🎯 <strong>Goal:</strong> Estimate π by throwing random darts at a unit circle. More darts = closer estimate.</p>
            <p>📊 <strong>Score:</strong> Accuracy points (closer to π) + Efficiency bonus (budget saved).</p>
            <p>🏆 <strong>Strategy:</strong> Balance trial count vs. budget savings. Leftover budget earns bonus points!</p>
          </div>
          <p style={{ marginTop: '1.2rem', fontSize: '0.85rem', color: 'var(--accent)', fontStyle: 'italic' }}>💡 π ≈ 3.14159. More trials reduce variance but cost more.</p>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
          <button className="mcp-btn mcp-btn-secondary" onClick={leaveGame} style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}>← Leave Game</button>
        </div>

        {session.phase === 'lobby' && (
          <div className="mcp-card" style={{ maxWidth: 520, margin: '0 auto' }}>
            <h2>{isHost ? 'Waiting for Players' : 'Waiting for Host to Start'}</h2>
            <p className="mcp-desc">Share code: <strong className="mcp-room-code">{session.roomCode}</strong></p>
            <div className="mcp-players-list">{session.players.map(p => <div key={p.id} className="mcp-chip">{p.name}</div>)}</div>
            {isHost && <button className="mcp-btn mcp-btn-primary" onClick={() => hostAction('start')} disabled={session.players.length < 2} style={{ marginTop: '1rem' }}>Start ({session.players.length}/2+ players)</button>}
            {playerToken && !isHost && (
              <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>You've joined — waiting for the host to start the game.</p>
            )}
            {!isHost && !playerToken && (
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
                <input className="mcp-input" placeholder="Your name" value={nameInput} onChange={e => setNameInput(e.target.value)} />
                <button className="mcp-btn mcp-btn-secondary" onClick={joinGame}>Join</button>
              </div>
            )}
          </div>
        )}

        {session.phase === 'playing' && (
          <div className="mcp-game-grid">
            <div className="mcp-main-col">
              <div className="mcp-card mcp-info-card">
                <div className="mcp-info-row">
                  <div className="mcp-info-item"><span className="mcp-info-label">Round</span><span className="mcp-info-val">{session.currentRound}/{config.rounds}</span></div>
                  <div className="mcp-info-item"><span className="mcp-info-label">My Score</span><span className="mcp-info-val">{myPlayer?.totalScore ?? session.viewer?.totalScore ?? 0}</span></div>
                  <div className="mcp-info-item"><span className="mcp-info-label">Budget Left</span><span className="mcp-info-val">${myBudget.toFixed(2)}</span></div>
                  <div className="mcp-info-item"><span className="mcp-info-label">Max Trials</span><span className="mcp-info-val">{Math.floor(myBudget / config.trialCost)}</span></div>
                </div>
                <div className="mcp-budget-bar" style={{ marginTop: '0.75rem' }}>
                  <div className="mcp-budget-fill" style={{ width: `${(myBudget / config.budget) * 100}%` }} />
                </div>
              </div>

              {playerToken && myPlayer && (
                <div className="mcp-card">
                  <h3>Round {session.currentRound} — Choose Your Trial Count</h3>
                  {session.viewer?.hasActed ? (
                    <div className="mcp-waiting">Trials submitted! Waiting for others ({session.stats.actedCount}/{session.stats.waitingCount} ready)...</div>
                  ) : (
                    <>
                      <p className="mcp-desc">More trials → better estimate, but costs more of your budget.</p>
                      <div className="mcp-slider-group">
                        <label>Number of trials: <strong style={{ color: 'var(--accent)' }}>{trialsInput}</strong></label>
                        <input type="range" className="mcp-slider" min={1} max={Math.min(config.maxTrials, Math.floor(myBudget / config.trialCost))} value={trialsInput}
                          onChange={e => setTrialsInput(Number(e.target.value))} />
                        <div className="mcp-cost-hint">
                          Cost: <strong>${trialCost.toFixed(2)}</strong> · Budget after: <strong>${(myBudget - trialCost).toFixed(2)}</strong>
                          {!canAfford && <span style={{ color: '#ef4444', marginLeft: '0.5rem' }}>⚠ Exceeds budget!</span>}
                        </div>
                      </div>
                      <button className="mcp-btn mcp-btn-primary" onClick={submitTrials} disabled={!canAfford} style={{ marginTop: '0.5rem' }}>
                        Run {trialsInput} Trials (${trialCost.toFixed(2)})
                      </button>
                    </>
                  )}
                </div>
              )}

              {myLastResult && (
                <div className="mcp-card">
                  <h3>Round {lastRound.round} — Your Result</h3>
                  <div className="mcp-pi-display">
                    <div>Your estimate: <strong>π ≈ {myLastResult.estimate.toFixed(6)}</strong></div>
                    <div style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>
                      Actual π = {Math.PI.toFixed(6)} · Error: {myLastResult.error.toFixed(6)}
                    </div>
                    <div style={{ marginTop: '0.5rem' }}>Round score: <strong style={{ fontSize: '1.2rem' }}>{myLastResult.roundScore}</strong></div>
                  </div>
                </div>
              )}

              {lastRound && (
                <div className="mcp-card">
                  <h3>Round {lastRound.round} Leaderboard</h3>
                  <table className="mcp-results-table">
                    <thead><tr><th>Rank</th><th>Player</th><th>Trials</th><th>Estimate</th><th>Error</th><th>Score</th><th>Budget Left</th></tr></thead>
                    <tbody>
                      {lastRound.results.map((r, i) => (
                        <tr key={r.playerId} className={i === 0 ? 'is-winner' : ''}>
                          <td>{i === 0 ? '🏆' : `#${i+1}`}</td>
                          <td>{r.playerName}</td>
                          <td>{r.trialsChosen}</td>
                          <td>{r.estimate.toFixed(5)}</td>
                          <td>{r.error.toFixed(5)}</td>
                          <td><strong>{r.roundScore}</strong></td>
                          <td>${r.budgetRemaining.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="mcp-side-col">
              <div className="mcp-card">
                <h3>Scoreboard</h3>
                {sortedPlayers.map((p, i) => (
                  <div key={p.id} className={`mcp-score-row ${p.id === playerToken ? 'is-me' : ''}`}>
                    <span className="mcp-rank">#{i+1}</span><span className="mcp-pname">{p.name}{p.isBot ? ' 🤖' : ''}</span><span className="mcp-pts">{p.totalScore}</span>
                  </div>
                ))}
              </div>
              <div className="mcp-card">
                <h3>Events</h3>
                <div className="mcp-event-log">{session.eventLog.map((e, i) => <div key={i} className="mcp-event">{e}</div>)}</div>
              </div>
              {isHost && (
                <div className="mcp-card">
                  <h3>Host Controls</h3>
                  <p className="mcp-desc">Ready: {session.stats.actedCount}/{session.stats.waitingCount}</p>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="mcp-btn mcp-btn-secondary" onClick={() => hostAction('advance')}>Force Advance</button>
                    <button className="mcp-btn mcp-btn-danger" onClick={() => hostAction('reset')}>Reset</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {session.phase === 'results' && (
          <div className="mcp-card" style={{ maxWidth: 700, margin: '0 auto' }}>
            <h2>Game Complete! 🎉</h2>
            <p className="mcp-desc" style={{ marginBottom: '1.5rem' }}>Final Leaderboard — π = {Math.PI.toFixed(6)}</p>
            <div style={{ marginBottom: '1.5rem' }}>
              {sortedPlayers.map((p, i) => (
                <div key={p.id} className={`mcp-final-row ${i === 0 ? 'winner' : ''}`}>
                  <span style={{ width: '2rem' }}>{i === 0 ? '🏆' : `#${i+1}`}</span>
                  <span style={{ flex: 1 }}>{p.name}{p.isBot ? ' 🤖' : ''}</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>${p.budgetRemaining.toFixed(2)} left</span>
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
                    <table className="mcp-results-table">
                      <thead><tr><th>Player</th><th>Trials</th><th>Estimate</th><th>Error</th><th>Score</th></tr></thead>
                      <tbody>
                        {r.results.map((res, i) => (
                          <tr key={res.playerId} className={i === 0 ? 'is-winner' : ''}>
                            <td>{res.playerName}</td>
                            <td>{res.trialsChosen}</td>
                            <td>{res.estimate.toFixed(5)}</td>
                            <td>{res.error.toFixed(5)}</td>
                            <td><strong>{res.roundScore}</strong></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            )}
            {isHost && <button className="mcp-btn mcp-btn-secondary" onClick={() => hostAction('reset')} style={{ marginTop: '1.5rem' }}>Play Again</button>}
          </div>
        )}

        {error && <div className="mcp-error">{error}</div>}
      </div></div>
    </MiniGameShell>
  )
}



