import { QRCodeSVG } from 'qrcode.react'
import { useEffect, useMemo, useState, useRef } from 'react'
import { getEducatorSessionCached, getEducatorSessionSync } from '../features/minigames/educatorSession'
import { MiniGameShell } from '../features/minigames/MiniGameShell'
import './SocialInfluenceMiniGamePage.css'
import '../features/minigames/SessionControlPanel.css'
import { educatorMiniGamesApi } from '../features/minigames/api'
import { MiniGameSessionsTable } from '../features/minigames/MiniGameSessionsTable'
import type { EducatorMiniGameSession } from '../api/client'

const STORAGE_KEY = 'social-influence_minigame_v1'
const GAME_SLUG = 'social-influence'

type StatementType = 'clearly-false' | 'ambiguous' | 'counterintuitive-true'
type CurrentStatement = { id: string; text: string; topic: string }
type RoundSummary = {
  statementId: string
  statementText: string
  statementType: StatementType
  correct: boolean
  explanation: string
  topic: string
  socialProofLow: number
  socialProofHigh: number
  avgConfidenceLow: number | null
  avgConfidenceHigh: number | null
  avgResponseTimeMsLow: number | null
  avgResponseTimeMsHigh: number | null
  allResponses: { playerId: string; playerName: string; treatment: 'low' | 'high'; confidence: number; responseTimeMs: number }[]
}
type ViewerHistoryEntry = {
  statementId: string
  statementType: StatementType
  socialProofShown: number
  myConfidence: number | null
  myResponseTimeMs: number | null
  myGroupAvg: number | null
  oppositeGroupAvg: number | null
}
type Player = {
  id: string; name: string; treatment: 'low' | 'high'
  hasActedThisRound: boolean; responsesCount: number
}
type Session = {
  roomCode: string
  phase: 'lobby' | 'playing' | 'results'
  currentRound: number
  config: { totalRounds: number; secondsPerRound: number }
  playerCount: number
  actedCount: number
  eventLog: string[]
  history: RoundSummary[]
  roundEndsAt: number | null
  currentStatement: CurrentStatement | null
  viewerSocialProof: number | null
  viewerResponse: number | null
  viewer: { treatment: 'low' | 'high'; responsesCount: number } | null
  viewerHistory: ViewerHistoryEntry[] | null
  players: Player[]
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

export default function SocialInfluenceMiniGamePage() {
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
  const [isHost, setIsHost] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isLobbyMode, setIsLobbyMode] = useState(!hostTokenFromUrl)
  const [canAccessSetup, setCanAccessSetup] = useState(() => hostTokenFromUrl ? true : roomFromUrl ? false : (getEducatorSessionSync()?.ok ?? false))
  const [authChecked, setAuthChecked] = useState(() => hasPublicJoinContext || getEducatorSessionSync() !== null)

  const [confidence, setConfidence] = useState(50)
  const [submitting, setSubmitting] = useState(false)
  const [secsRemaining, setSecsRemaining] = useState<number | null>(null)

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

  useEffect(() => {
    if (!inviteToken) return
    api<{ invite: { teamLabel: string; roomCode?: string } }>(`/invite/${inviteToken}`).then(r => {
      if (r.invite.roomCode) setRoomCodeInput(r.invite.roomCode.toUpperCase())
      if (r.invite.teamLabel && !nameInput) setNameInput(r.invite.teamLabel)
    }).catch(() => {})
  }, [inviteToken])

  // Countdown timer
  useEffect(() => {
    if (!session?.roundEndsAt || session.phase !== 'playing') { setSecsRemaining(null); return }
    const tick = () => {
      const secs = Math.max(0, Math.round((session.roundEndsAt! - Date.now()) / 1000))
      setSecsRemaining(secs)
    }
    tick()
    const id = setInterval(tick, 500)
    return () => clearInterval(id)
  }, [session?.roundEndsAt, session?.phase, session?.currentRound])

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
        setPlayerToken(null); setSession(null); setIsLobbyMode(true)
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

  async function createGame() {
    setCreatingSession(true); setError(null); setQuickActionMessage(null)
    try {
      await api<{ roomCode: string; hostToken: string; session: Session }>(`/${GAME_SLUG}/create`, { method: 'POST', body: JSON.stringify({}) })
      setSessionsRefreshKey(v => v + 1)
    } catch (e) { setError((e as Error).message) } finally { setCreatingSession(false) }
  }

  async function soloPlay() {
    setLoading(true); setError(null)
    try {
      const d = await api<{ roomCode: string; hostToken: string; playerToken: string; session: Session }>(
        `/${GAME_SLUG}/solo`,
        { method: 'POST', body: JSON.stringify({ name: nameInput || 'Player' }) },
      )
      setRoomCodeInput(d.roomCode)
      setHostToken(d.hostToken)
      setPlayerToken(d.playerToken)
      setSession(d.session)
      setIsHost(true)
      setIsLobbyMode(false)
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

  async function submitConfidence() {
    if (!roomCode || !playerToken) return
    setSubmitting(true)
    try {
      const d = await api<{ session: Session }>(`/${GAME_SLUG}/${roomCode}/respond`, { method: 'POST', body: JSON.stringify({ playerToken, confidence }) })
      setSession(d.session)
      if (hostToken && d.session.playerCount === 1 && d.session.phase === 'playing') {
        const next = await api<{ session: Session }>(
          `/${GAME_SLUG}/${d.session.roomCode}/advance`,
          { method: 'POST', body: JSON.stringify({ hostToken }) }
        )
        setSession(next.session)
      }
    } catch (e) { setError((e as Error).message) } finally { setSubmitting(false) }
  }

  useEffect(() => {
    if (hasPublicJoinContext) return
    if (sessionsRefreshKey === 0) return
    const load = async () => {
      setSessionsFetching(true)
      try {
        const sessions = await educatorMiniGamesApi.listSessions()
        const latest = sessions.filter(s => s.gameType === 'social-influence').sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] || null
        setLatestSession(latest)
        if (latest?.id) {
          try {
            const players = await educatorMiniGamesApi.getSessionPlayers(latest.id)
            setJoinedPlayers(players.filter(p => !p.isBot).map(p => p.name))
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
      setSessionsRefreshKey(v => v + 1)
    }, 4000)
    return () => window.clearInterval(timer)
  }, [hasPublicJoinContext, session, latestSession])

  if (!authChecked) return null

  // ── Public join-only (no educator access) ─────────────────────────────────
  if (!canAccessSetup && !session && !playerToken) {
    return (
      <MiniGameShell title="Social Influence" sessionsGameType="social-influence" publicMode={true}>
        <div className="si-page"><div className="si-shell">
          <div className="si-hero mg-page-hero"><h1>📡 Social Influence</h1></div>
          <div className="si-card" style={{ textAlign: 'center' }}>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>Educator login required. Students: enter room code to join.</p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <input className="si-input" placeholder="Your name" value={nameInput} onChange={e => setNameInput(e.target.value)} />
              <input className="si-input" placeholder="Room code" value={roomCodeInput} onChange={e => setRoomCodeInput(e.target.value.toUpperCase())} style={{ maxWidth: '140px' }} />
              <button className="si-btn si-btn-primary" onClick={joinGame} disabled={loading}>Join</button>
            </div>
            {error && <div className="si-error">{error}</div>}
          </div>
        </div></div>
      </MiniGameShell>
    )
  }

  // ── Lobby / Setup ──────────────────────────────────────────────────────────
  if (isLobbyMode && !session) {
    return (
      <MiniGameShell title="Social Influence" subtitle="Social Influence Experiment" sessionsGameType="social-influence" publicMode={hasPublicJoinContext}>
        <div className="si-page"><div className="si-shell">
          <div className="si-hero mg-page-hero">
            <h1>📡 Social Influence</h1>
            <p className="si-sub">Rate economic statements. Then see what others believe. Does social proof change your mind?</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
            <div className="si-card" style={{ border: '1px solid var(--accent-blue)', background: 'rgba(59,130,246,0.05)' }}>
              <h3 style={{ color: 'var(--accent-blue)', marginBottom: '0.75rem' }}>📘 How It Works</h3>
              <div style={{ fontSize: '0.9rem', lineHeight: 1.65, display: 'flex', flexDirection: 'column', gap: '0.5rem', color: 'var(--text-primary)' }}>
                <p>A statement appears each round. Students rate confidence from <strong>0-100</strong>.</p>
                <p>Each student is assigned a social-proof treatment: <strong>low</strong> cue or <strong>high</strong> cue.</p>
                <p>After submission, compare group confidence shifts and discuss conformity effects.</p>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.83rem' }}>Learning focus: information cascades, social influence, and belief updating under uncertainty.</p>
              </div>
            </div>

            <div className="si-card" style={{ border: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.03)' }}>
              <h3 style={{ color: 'var(--text-primary)', marginBottom: '0.75rem' }}>🎓 Session Setup</h3>
              <div style={{ display: 'grid', gap: '0.55rem' }}>
                <button className="si-btn si-btn-primary" style={{ width: '100%' }} onClick={createGame} disabled={creatingSession}>
                  {creatingSession ? 'Creating…' : 'Create Simulation'}
                </button>
                <button className="si-btn si-btn-secondary" style={{ width: '100%' }} onClick={soloPlay} disabled={loading}>
                  {loading ? 'Starting…' : 'Play Solo Test'}
                </button>
                {!latestSession && sessionsRefreshKey === 0 && (
                  <button className="si-btn si-btn-secondary" style={{ width: '100%' }} onClick={() => setSessionsRefreshKey(1)}>Load latest session</button>
                )}
                {sessionsRefreshKey > 0 && sessionsFetching && !latestSession && (
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Loading session…</div>
                )}
                {latestSession && (
                  <div style={{ display: 'grid', gap: '0.65rem', marginTop: '0.25rem' }}>
                    <div className="mg-form-group">
                      <label>Active Game Code</label>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <input className="mgsp-input" style={{ flex: 1, minWidth: 0, width: '100%' }} value={latestSession.roomCode || ''} readOnly />
                        <button type="button" className="mgsp-btn mgsp-secondary" onClick={() => void navigator.clipboard.writeText(latestSession.roomCode || '')}>📋</button>
                      </div>
                    </div>
                    <div className="mg-form-group">
                      <label>Latest Join Link</label>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <input className="mgsp-input" style={{ flex: 1, minWidth: 0, width: '100%' }} value={`${window.location.origin}/mini-games/join?code=${encodeURIComponent(latestSession.roomCode || '')}`} readOnly />
                        <button type="button" className="mgsp-btn mgsp-secondary" onClick={() => void navigator.clipboard.writeText(`${window.location.origin}/mini-games/join?code=${encodeURIComponent(latestSession.roomCode || '')}`)}>📋</button>
                      </div>
                      <div style={{ marginTop: 12, display: 'flex', justifyContent: 'center', background: '#fff', borderRadius: 8, padding: 12 }}>
                        <QRCodeSVG value={latestSession.joinByCodeLink || `${window.location.origin}/mini-games/join?code=${encodeURIComponent(latestSession.roomCode || '')}`} size={200} bgColor="#ffffff" fgColor="#0f172a" level="M" />
                      </div>
                    </div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>Status: <strong>{latestSession.status}</strong> | Joined: {latestSession.joinedCount || 0}</div>
                    {joinedPlayers.length > 0 && (
                      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
                        {joinedPlayers.map((name) => (
                          <span key={name} className="mgsp-pill">{name}</span>
                        ))}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <button className="si-btn si-btn-success si-btn-sm" onClick={() => runQuickAction('start')} disabled={!!quickActionLoading || latestSession.status !== 'LOBBY'}>Start</button>
                      <button className="si-btn si-btn-warning si-btn-sm" onClick={() => runQuickAction('advance')} disabled={!!quickActionLoading || latestSession.status !== 'ACTIVE'}>Advance</button>
                      <button className="si-btn si-btn-danger si-btn-sm" onClick={() => runQuickAction('reset')} disabled={!!quickActionLoading}>Reset</button>
                    </div>
                    {quickActionMessage && <div className="si-info">{quickActionMessage}</div>}
                  </div>
                )}
              </div>
            </div>
          </div>

          {error && <div className="si-error">{error}</div>}

          {/* Sessions table */}
          {canAccessSetup && !hasPublicJoinContext && (
            <div className="si-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <h3 style={{ color: 'var(--text-primary)', margin: 0 }}>Recent Sessions</h3>
                <button className="si-btn si-btn-secondary si-btn-xs" onClick={() => setSessionsRefreshKey(v => v + 1)} disabled={sessionsFetching}>
                  {sessionsFetching ? 'Loading…' : 'Refresh'}
                </button>
              </div>
              <MiniGameSessionsTable gameType="social-influence" refreshKey={sessionsRefreshKey} />
            </div>
          )}
        </div></div>
      </MiniGameShell>
    )
  }

  // ── In-game view ──────────────────────────────────────────────────────────
  if (session) {
    const { phase, currentRound, config, currentStatement, viewerSocialProof, viewerResponse, actedCount, playerCount, history } = session
    const hasResponded = viewerResponse !== null
    const isPlaying = phase === 'playing'
    const isResults = phase === 'results'
    const isSoloSession = Boolean(hostToken && playerToken && playerCount === 1)
    const canSubmitAsViewer = Boolean(playerToken && session.viewer)

    return (
      <MiniGameShell title="Social Influence" subtitle="Social Influence Experiment" sessionsGameType="social-influence" publicMode={hasPublicJoinContext}>
        <div className="si-page"><div className={`si-shell ${isResults ? 'si-shell-results' : ''}`}>

          {/* Header bar */}
          <div className="si-header-bar">
            <div className="si-header-left">
              <span className="si-badge si-badge-blue">Room: {session.roomCode}</span>
              {isPlaying && (
                <span className="si-badge">Round {currentRound}/{config.totalRounds}</span>
              )}
              {isResults && <span className="si-badge si-badge-green">Results</span>}
              <span className="si-badge">{playerCount} player{playerCount !== 1 ? 's' : ''}</span>
            </div>
            {isPlaying && secsRemaining !== null && (
              <div className={`si-timer${secsRemaining <= 10 ? ' si-timer-urgent' : ''}`}>
                ⏱ {secsRemaining}s
              </div>
            )}
            <div className="si-header-right">
              <button className="si-btn si-btn-secondary si-btn-xs" onClick={leaveGame}>Leave</button>
            </div>
          </div>

          {error && <div className="si-error" style={{ marginBottom: '1rem' }}>{error}</div>}

          <div className="si-card" style={{ borderColor: 'rgba(37,99,235,0.3)', background: 'rgba(37,99,235,0.03)' }}>
            <h3 style={{ color: '#2563eb', marginBottom: '0.6rem' }}>How To Play</h3>
            {!isResults ? (
              <div style={{ display: 'grid', gap: '0.35rem', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                <p style={{ margin: 0 }}><strong>Step 1:</strong> Read the statement and social proof cue.</p>
                <p style={{ margin: 0 }}><strong>Step 2:</strong> Set confidence from <strong>0-100</strong>, then click <strong>Lock In</strong>.</p>
                <p style={{ margin: 0 }}><strong>Step 3:</strong> Compare low-proof vs high-proof confidence shifts at the end.</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '0.35rem', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                <p style={{ margin: 0 }}><strong>Read the table:</strong> each row is one round.</p>
                <p style={{ margin: 0 }}><strong>Key metric:</strong> <strong>Delta Effect</strong> = High-group confidence minus Low-group confidence.</p>
                <p style={{ margin: 0 }}>Large positive Delta means social proof strongly increased confidence.</p>
              </div>
            )}
          </div>

          {/* ── LOBBY ── */}
          {phase === 'lobby' && (
            <div className="si-card si-card-centered">
              <h2>Waiting for host to start…</h2>
              <p style={{ color: 'var(--text-muted)' }}>{playerCount} player{playerCount !== 1 ? 's' : ''} joined</p>
              {isHost && !isSoloSession && (
                <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                  <button className="si-btn si-btn-primary" onClick={() => hostAction('start')} disabled={playerCount < 2}>
                    {playerCount < 2 ? 'Need ≥ 2 players' : '▶ Start Game'}
                  </button>
                  <button className="si-btn si-btn-danger" onClick={() => hostAction('reset')}>↺ Reset</button>
                </div>
              )}
              <div className="si-player-list">
                {session.players.map(p => (
                  <span key={p.id} className="si-player-chip">{p.name}</span>
                ))}
              </div>
            </div>
          )}

          {/* ── PLAYING ── */}
          {isPlaying && currentStatement && (
            <div className="si-game-layout">
              {/* Statement card */}
              <div className="si-card si-statement-card">
                <div className="si-topic-tag">{currentStatement.topic}</div>
                <p className="si-statement-text">{currentStatement.text}</p>

                {/* Social proof cue */}
                {viewerSocialProof !== null && (
                  <div className="si-social-proof">
                    <div className="si-sp-label">📊 Of people surveyed on this topic:</div>
                    <div className="si-sp-bar-wrap">
                      <div className="si-sp-bar" style={{ width: `${viewerSocialProof}%` }} />
                    </div>
                    <div className="si-sp-pct">{viewerSocialProof}% agreed with this statement</div>
                  </div>
                )}
              </div>

              {/* Confidence input */}
              {canSubmitAsViewer && (
                <div className="si-card si-response-card">
                  {!hasResponded ? (
                    <>
                      <h3 className="si-response-title">How confident are you this is <strong>TRUE</strong>?</h3>
                      <div className="si-slider-wrap">
                        <span className="si-slider-label si-false">Definitely False</span>
                        <div className="si-slider-inner">
                          <input
                            type="range" min={0} max={100} step={1}
                            value={confidence}
                            onChange={e => setConfidence(Number(e.target.value))}
                            className="si-slider"
                          />
                          <div className="si-confidence-display"
                            style={{ background: confidence > 60 ? 'var(--accent-green)' : confidence < 40 ? 'var(--accent-red, #ef4444)' : 'var(--accent-yellow, #f59e0b)' }}>
                            {confidence}
                          </div>
                        </div>
                        <span className="si-slider-label si-true">Definitely True</span>
                      </div>
                      <button className="si-btn si-btn-primary si-btn-submit" onClick={submitConfidence} disabled={submitting}>
                        {submitting ? 'Submitting…' : 'Lock In'}
                      </button>
                    </>
                  ) : (
                    <div className="si-responded">
                      <div className="si-check">✓</div>
                      <p>Your answer: <strong>{viewerResponse}</strong></p>
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Waiting for others… ({actedCount}/{playerCount} responded)</p>
                    </div>
                  )}
                </div>
              )}

              {/* Host controls */}
              {isHost && !isSoloSession && (
                <div className="si-card si-host-card">
                  <h3>Host Controls</h3>
                  <p style={{ color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                    {actedCount}/{playerCount} responded
                  </p>
                  <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <button className="si-btn si-btn-warning" onClick={() => hostAction('advance')}>⏭ Next Round</button>
                    <button className="si-btn si-btn-danger" onClick={() => hostAction('reset')}>↺ Reset</button>
                  </div>
                  <div className="si-player-list" style={{ marginTop: '1rem' }}>
                    {session.players.map(p => (
                      <span key={p.id} className={`si-player-chip ${p.hasActedThisRound ? 'si-acted' : ''}`}>
                        {p.name} {p.hasActedThisRound ? '✓' : '…'}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Progress */}
              <div className="si-progress-row">
                {Array.from({ length: config.totalRounds }, (_, i) => (
                  <div key={i} className={`si-progress-dot ${i + 1 < currentRound ? 'si-done' : i + 1 === currentRound ? 'si-current' : ''}`} />
                ))}
              </div>
            </div>
          )}

          {/* ── RESULTS ── */}
          {isResults && (
            <div className="si-results">
              <h2 className="si-results-title">📊 Results: The Signal Effect</h2>
              <p className="si-results-sub">
                Players were randomly shown different social proof figures for the same statements. Did it change their confidence?
              </p>

              {/* ── Personalized debrief card ── */}
              {session.viewerHistory && session.viewer && (
                <div className="si-card si-personal-card">
                  <div className="si-personal-header">
                    <span className="si-personal-icon">🎯</span>
                    <div>
                      <h3 style={{ margin: 0 }}>Your Results</h3>
                      <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        You were in the{' '}
                        <strong className={session.viewer.treatment === 'high' ? 'si-treat-high' : 'si-treat-low'}>
                          {session.viewer.treatment === 'high' ? 'HIGH' : 'LOW'} social proof group
                        </strong>
                        {' '}— you saw figures suggesting{' '}
                        {session.viewer.treatment === 'high' ? '~75–85%' : '~15–25%'} of people agreed with each statement.
                        The other group saw the opposite.
                      </p>
                    </div>
                  </div>
                  <div style={{ overflowX: 'auto', marginTop: '0.75rem' }}>
                    <table className="si-results-table si-personal-table">
                      <thead>
                        <tr>
                          <th>Rd</th>
                          <th>You saw</th>
                          <th>Your rating</th>
                          <th>Your group avg</th>
                          <th>Other group avg</th>
                          <th>⏱ Your time</th>
                          <th>Type</th>
                        </tr>
                      </thead>
                      <tbody>
                        {session.viewerHistory.map((vh, i) => {
                          const timeSec = vh.myResponseTimeMs != null ? Math.round(vh.myResponseTimeMs / 1000) : null
                          return (
                            <tr key={vh.statementId}>
                              <td>R{i + 1}</td>
                              <td className="si-num"><strong>{vh.socialProofShown}%</strong></td>
                              <td className="si-num">{vh.myConfidence ?? '—'}</td>
                              <td className="si-num">{vh.myGroupAvg ?? '—'}</td>
                              <td className="si-num si-muted">{vh.oppositeGroupAvg ?? '—'}</td>
                              <td className="si-num">{timeSec != null ? `${timeSec}s` : '—'}</td>
                              <td><span className={`si-type-badge si-type-${vh.statementType}`}>{
                                vh.statementType === 'clearly-false' ? 'Baseline' :
                                vh.statementType === 'ambiguous' ? 'Ambiguous' : 'Counterintuitive'
                              }</span></td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                  <p className="si-personal-note">
                    💡 If your ratings tracked social proof rather than your own knowledge, you experienced conformity bias in real time.
                  </p>
                </div>
              )}

              {/* Summary table */}
              <div className="si-card" style={{ overflowX: 'auto' }}>
                <h3 style={{ marginBottom: '0.75rem' }}>Group Comparison</h3>
                <table className="si-results-table">
                  <thead>
                    <tr>
                      <th>Rd</th>
                      <th>Statement</th>
                      <th>Type</th>
                      <th>Answer</th>
                      <th>Low saw</th>
                      <th>Avg (low)</th>
                      <th>⏱ (low)</th>
                      <th>High saw</th>
                      <th>Avg (high)</th>
                      <th>⏱ (high)</th>
                      <th>Δ Effect</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((r, i) => {
                      const delta = r.avgConfidenceHigh != null && r.avgConfidenceLow != null
                        ? r.avgConfidenceHigh - r.avgConfidenceLow : null
                      const timeLow = r.avgResponseTimeMsLow != null ? `${Math.round(r.avgResponseTimeMsLow / 1000)}s` : '—'
                      const timeHigh = r.avgResponseTimeMsHigh != null ? `${Math.round(r.avgResponseTimeMsHigh / 1000)}s` : '—'
                      return (
                        <tr key={r.statementId}>
                          <td>{i + 1}</td>
                          <td className="si-stmt-cell">{r.statementText}</td>
                          <td><span className={`si-type-badge si-type-${r.statementType}`}>{
                            r.statementType === 'clearly-false' ? 'Baseline' :
                            r.statementType === 'ambiguous' ? 'Ambiguous' : 'Counterintuitive'
                          }</span></td>
                          <td><span className={`si-truth-badge ${r.correct ? 'si-true' : 'si-false'}`}>{r.correct ? 'TRUE' : 'FALSE'}</span></td>
                          <td className="si-num">{r.socialProofLow}%</td>
                          <td className="si-num">{r.avgConfidenceLow ?? '—'}</td>
                          <td className="si-num si-muted">{timeLow}</td>
                          <td className="si-num">{r.socialProofHigh}%</td>
                          <td className="si-num">{r.avgConfidenceHigh ?? '—'}</td>
                          <td className="si-num si-muted">{timeHigh}</td>
                          <td className="si-num">
                            {delta != null && (
                              <span className={`si-delta ${delta > 0 ? 'si-pos' : delta < 0 ? 'si-neg' : ''}`}>
                                {delta > 0 ? '+' : ''}{delta}
                              </span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Effect visualisation */}
              <div className="si-card si-effect-card">
                <h3>Confidence Shift by Treatment Group</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
                  High group = shown ~75–85% agreed. Low group = shown ~15–25% agreed.
                  Bars show average confidence per round.
                </p>
                <div className="si-chart">
                  {history.map((r, i) => {
                    const low = r.avgConfidenceLow ?? 0
                    const high = r.avgConfidenceHigh ?? 0
                    return (
                      <div key={r.statementId} className="si-chart-group">
                        <div className="si-chart-bars">
                          <div className="si-bar si-bar-low" style={{ height: `${low}%` }} title={`Low: ${low}`} />
                          <div className="si-bar si-bar-high" style={{ height: `${high}%` }} title={`High: ${high}`} />
                        </div>
                        <div className="si-chart-label">R{i + 1}</div>
                      </div>
                    )
                  })}
                </div>
                <div className="si-chart-legend">
                  <span className="si-legend-dot si-legend-low" /> Low social proof
                  <span className="si-legend-dot si-legend-high" style={{ marginLeft: '1.5rem' }} /> High social proof
                </div>
              </div>

              {/* Explanation of each statement */}
              <div className="si-card">
                <h3>Answer Key</h3>
                {history.map((r, i) => (
                  <div key={r.statementId} className="si-answer-row">
                    <div className="si-answer-num">R{i + 1}</div>
                    <div className="si-answer-body">
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '0.35rem' }}>
                        <span className={`si-type-badge si-type-${r.statementType}`}>{
                          r.statementType === 'clearly-false' ? 'Baseline control' :
                          r.statementType === 'ambiguous' ? 'Ambiguous' : 'Counterintuitive'
                        }</span>
                        <span className="si-topic-tag" style={{ fontSize: '0.75rem' }}>{r.topic}</span>
                      </div>
                      <div className="si-answer-stmt">{r.statementText}</div>
                      <div className={`si-answer-verdict ${r.correct ? 'si-true' : 'si-false'}`}>{r.correct ? '✓ TRUE' : '✗ FALSE'}</div>
                      <div className="si-answer-explain">{r.explanation}</div>
                    </div>
                  </div>
                ))}
              </div>

              {isHost && !isSoloSession && (
                <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
                  <button className="si-btn si-btn-danger" onClick={() => hostAction('reset')}>↺ Reset for Next Class</button>
                </div>
              )}
            </div>
          )}

          {/* Event log (host only during play) */}
          {isHost && !isSoloSession && isPlaying && (
            <div className="si-card si-log-card">
              <div className="si-log">
                {[...session.eventLog].reverse().slice(0, 8).map((msg, i) => (
                  <div key={i} className="si-log-entry">{msg}</div>
                ))}
              </div>
            </div>
          )}
        </div></div>
      </MiniGameShell>
    )
  }

  // Fallback spinner while session loads
  return (
    <MiniGameShell title="Social Influence" sessionsGameType="social-influence" publicMode={hasPublicJoinContext}>
      <div className="si-page"><div className="si-shell" style={{ textAlign: 'center', paddingTop: '4rem' }}>
        <div style={{ color: 'var(--text-muted)' }}>Loading…</div>
      </div></div>
    </MiniGameShell>
  )
}
