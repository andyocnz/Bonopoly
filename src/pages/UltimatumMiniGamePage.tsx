import { QRCodeSVG } from 'qrcode.react'
import { useEffect, useMemo, useState, useRef } from 'react'
import { getEducatorSessionCached, getEducatorSessionSync } from '../features/minigames/educatorSession'
import { MiniGameShell } from '../features/minigames/MiniGameShell'
import './UltimatumMiniGamePage.css'
import '../features/minigames/SessionControlPanel.css'
import { educatorMiniGamesApi } from '../features/minigames/api'
import { MiniGameSessionsTable } from '../features/minigames/MiniGameSessionsTable'
import type { EducatorMiniGameSession } from '../api/client'

const STORAGE_KEY = 'ultimatum_minigame_v1'
const GAME_SLUG = 'ultimatum'

type Player = { id: string; name: string; isBot: boolean; role: 'proposer' | 'responder'; totalScore: number }
type RoundState = { round: number; offer?: number; settled: boolean; response?: string | number; proposerPayoff?: number; responderPayoff?: number }
type Session = {
  roomCode: string; phase: 'lobby' | 'playing' | 'results'
  currentRound: number; roundStep: 'offer' | 'response' | 'complete'
  config: { variant: string; endowment: number; multiplier: number; rounds: number }
  players: Player[]; rounds: RoundState[]; eventLog: string[]
  currentRoundState: RoundState | null
  viewer: { role: 'proposer' | 'responder'; totalScore: number; isProposer: boolean } | null
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

export default function UltimatumMiniGamePage() {
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
  const [offerAmount, setOfferAmount] = useState(40)
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

  const fetchState = async () => {
    if (!roomCode) return
    const guard = fetchGuardRef.current
    try {
      const qs = playerToken ? `?playerToken=${playerToken}` : hostToken ? `?hostToken=${hostToken}` : ''
      const data = await api<{ session: Session; isHost: boolean }>(`/${GAME_SLUG}/${roomCode}/state${qs}`)
      if (fetchGuardRef.current !== guard) return
      if (playerToken && !hostToken && !data.session.viewer) {
        // Stored token is stale for this room; clear it so the user can join again.
        setPlayerToken(null)
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
      await educatorMiniGamesApi.createSession({ gameType: 'ultimatum', teamCount: 2 })
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

  async function submitOffer() {
    if (!roomCode || !playerToken) return
    try {
      const d = await api<{ session: Session }>(`/${GAME_SLUG}/${roomCode}/action`, { method: 'POST', body: JSON.stringify({ playerToken, amount: offerAmount }) })
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

  async function submitResponse(accept: boolean) {
    if (!roomCode || !playerToken) return
    try {
      const d = await api<{ session: Session }>(`/${GAME_SLUG}/${roomCode}/action`, { method: 'POST', body: JSON.stringify({ playerToken, accept }) })
      setSession(d.session)
    } catch (e) { setError((e as Error).message) }
  }

  const endowment = session?.config.endowment || 100

  useEffect(() => {
    if (hasPublicJoinContext) return
    if (sessionsRefreshKey === 0) return
    const load = async () => {
      setSessionsFetching(true)
      try {
        const sessions = await educatorMiniGamesApi.listSessions()
        const latest = sessions.filter(s => s.gameType === 'ultimatum').sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] || null
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

  if (!canAccessSetup && !session) {
    return (
      <MiniGameShell title="Ultimatum Game" sessionsGameType="ultimatum" publicMode={true}>
        <div className="ult-page"><div className="ult-shell">
          <div className="ult-hero mg-page-hero"><h1>🤝 Ultimatum Game</h1></div>
          <div className="ult-card" style={{ textAlign: 'center' }}>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>Educator login required to create. Students: enter room code to join.</p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <input className="ult-input" placeholder="Your name" value={nameInput} onChange={e => setNameInput(e.target.value)} />
              <input className="ult-input" placeholder="Room code" value={roomCodeInput} onChange={e => setRoomCodeInput(e.target.value.toUpperCase())} style={{ maxWidth: '140px' }} />
              <button className="ult-btn ult-btn-primary" onClick={joinGame} disabled={loading}>Join</button>
            </div>
            {error && <div className="ult-error">{error}</div>}
          </div>
        </div></div>
      </MiniGameShell>
    )
  }

  if (isLobbyMode && !session) {
    return (
      <MiniGameShell title="Ultimatum Game" subtitle="Fairness and Rationality" sessionsGameType="ultimatum" publicMode={hasPublicJoinContext}>
        <div className="ult-page"><div className="ult-shell">
          <div className="ult-hero mg-page-hero">
            <h1>🤝 Ultimatum Game</h1>
            <p className="ult-sub">Proposer splits 100 points. Responder accepts (split stands) or rejects (both get 0). What's fair? What's rational?</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
            <div className="ult-card" style={{ border: '1px solid var(--accent-blue)', background: 'rgba(59, 130, 246, 0.05)' }}>
              <h2 style={{ fontSize: '1rem', color: 'var(--accent-blue)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1rem' }}>🤝 How It Works</h2>
              <div style={{ fontSize: '0.95rem', lineHeight: '1.6', color: 'var(--text-primary)', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                <p>💰 <strong>The Proposer</strong> splits 100 points any way they choose — e.g., keep 70, offer 30.</p>
                <p>✅ <strong>The Responder</strong> can Accept (split stands, both earn) or Reject (both earn zero).</p>
                <p>🧠 <strong>Rational Prediction:</strong> Any offer &gt; 0 should be accepted — something is better than nothing. But humans reject "unfair" offers!</p>
                <p>⚖️ <strong>Fairness vs. Rationality:</strong> Most responders reject offers below 30%. This reveals preferences for fairness over pure self-interest.</p>
              </div>
              <p style={{ marginTop: '1.2rem', fontSize: '0.85rem', color: 'var(--accent-amber)', fontStyle: 'italic' }}>💡 Best as 2-player game over 5 rounds.</p>
            </div>
            <div className="ult-card">
              <div style={{ display: 'grid', gap: '0.65rem' }}>
                <button className="ult-btn ult-btn-primary" onClick={createGame} disabled={creatingSession}>
                  {creatingSession ? 'Creating...' : 'Create Session'}
                </button>
                <button className="ult-btn ult-btn-secondary" onClick={soloPlay} disabled={loading}>
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
                      <button className="ult-btn ult-btn-secondary" disabled={quickActionLoading !== null || latestSession.status !== 'LOBBY'} onClick={() => void runQuickAction('start')}>{quickActionLoading === 'start' ? 'Starting...' : latestSession.status === 'LOBBY' ? 'Start' : 'Started'}</button>
                      <button className="ult-btn ult-btn-secondary" disabled={quickActionLoading !== null || latestSession.status !== 'ACTIVE'} onClick={() => void runQuickAction('advance')}>{quickActionLoading === 'advance' ? 'Advancing...' : 'Advance'}</button>
                      <button className="ult-btn ult-btn-secondary" disabled={quickActionLoading !== null || (latestSession.status !== 'ACTIVE' && latestSession.status !== 'COMPLETED')} onClick={() => void runQuickAction('reset')}>{quickActionLoading === 'reset' ? 'Resetting...' : 'Reset'}</button>
                    </div>
                    {quickActionMessage && <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{quickActionMessage}</div>}
                  </div>
                )}
              </div>
            </div>
          </div>
          <MiniGameSessionsTable gameType="ultimatum" refreshKey={sessionsRefreshKey} />
          {error && <div className="ult-error">{error}</div>}
        </div></div>
      </MiniGameShell>
    )
  }

  if (!session) return (
    <MiniGameShell title="Ultimatum Game" sessionsGameType="ultimatum" publicMode={hasPublicJoinContext}>
      <div className="ult-page"><div className="ult-shell"><div className="ult-loading">Loading...</div></div></div>
    </MiniGameShell>
  )

  const myPlayer = session.players.find(p => p.id === playerToken)
  const isProposer = session.viewer?.isProposer ?? false
  const sortedPlayers = [...session.players].sort((a, b) => b.totalScore - a.totalScore)
  const currentOffer = session.currentRoundState?.offer
  const isWaitingForOffer = session.roundStep === 'offer' && !isProposer
  const isWaitingForResponse = session.roundStep === 'response' && isProposer

  return (
    <MiniGameShell title="Ultimatum Game" subtitle="Fairness and Rationality" sessionsGameType="ultimatum" publicMode={hasPublicJoinContext}>
      <div className="ult-page"><div className="ult-shell">
        <div className="ult-hero mg-page-hero">
          <h1>🤝 Ultimatum Game</h1>
          <p className="ult-sub">
            Room: <strong>{session.roomCode}</strong> · Round {session.currentRound}/{session.config.rounds}
            {myPlayer && <span className="ult-role-badge" style={{ marginLeft: '0.5rem' }}>{isProposer ? 'Proposer' : 'Responder'}</span>}
          </p>
        </div>

        <div className="ult-card" style={{ border: '1px solid var(--accent-blue)', background: 'rgba(59, 130, 246, 0.05)', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1rem', color: 'var(--accent-blue)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1rem' }}>🤝 How It Works</h2>
          <div style={{ fontSize: '0.95rem', lineHeight: '1.6', color: 'var(--text-primary)', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
            <p>💰 <strong>The Proposer</strong> splits 100 points any way they choose — e.g., keep 70, offer 30.</p>
            <p>✅ <strong>The Responder</strong> can Accept (split stands, both earn) or Reject (both earn zero).</p>
            <p>🧠 <strong>Rational Prediction:</strong> Any offer &gt; 0 should be accepted — something is better than nothing. But humans reject "unfair" offers!</p>
            <p>⚖️ <strong>Fairness vs. Rationality:</strong> Most responders reject offers below 30%. This reveals preferences for fairness over pure self-interest.</p>
          </div>
          <p style={{ marginTop: '1.2rem', fontSize: '0.85rem', color: 'var(--accent-amber)', fontStyle: 'italic' }}>💡 Best as 2-player game over 5 rounds.</p>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
          <button className="ult-btn ult-btn-secondary" onClick={leaveGame} style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}>← Leave Game</button>
        </div>

        {session.phase === 'lobby' && (
          <div className="ult-card" style={{ maxWidth: 520, margin: '0 auto' }}>
            <h2>{isHost ? 'Waiting for Players' : 'Waiting for Host to Start'}</h2>
            <p className="ult-desc">Share code: <strong className="ult-room-code">{session.roomCode}</strong></p>
            <div className="ult-players-list">
              {session.players.map(p => <div key={p.id} className="ult-chip">{p.name} ({p.role})</div>)}
            </div>
            {isHost && <button className="ult-btn ult-btn-primary" onClick={() => hostAction('start')} disabled={session.players.length < 2} style={{ marginTop: '1rem' }}>Start ({session.players.length}/2 players)</button>}
            {playerToken && !isHost && (
              <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>You've joined — waiting for the host to start the game.</p>
            )}
            {!isHost && !playerToken && (
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
                <input className="ult-input" placeholder="Your name" value={nameInput} onChange={e => setNameInput(e.target.value)} />
                <button className="ult-btn ult-btn-secondary" onClick={joinGame}>Join</button>
              </div>
            )}
          </div>
        )}

        {session.phase === 'playing' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: '1rem' }}>
            <div>
              <div className="ult-card ult-info-card">
                <div className="ult-info-row">
                  <div className="ult-info-item"><span className="ult-info-label">Round</span><span className="ult-info-val">{session.currentRound}/{session.config.rounds}</span></div>
                  <div className="ult-info-item"><span className="ult-info-label">Endowment</span><span className="ult-info-val">{endowment} pts</span></div>
                  <div className="ult-info-item"><span className="ult-info-label">My Score</span><span className="ult-info-val">{myPlayer?.totalScore ?? session.viewer?.totalScore ?? 0}</span></div>
                  <div className="ult-info-item"><span className="ult-info-label">Phase</span><span className="ult-info-val" style={{ fontSize: '0.9rem', textTransform: 'capitalize' }}>{session.roundStep}</span></div>
                </div>
              </div>

              {playerToken && myPlayer && isProposer && session.roundStep === 'offer' && (
                <div className="ult-card">
                  <h3>Make Your Offer</h3>
                  <p className="ult-desc">You have <strong>{endowment} points</strong>. How much do you offer to the Responder?</p>
                  <p className="ult-desc" style={{ fontSize: '0.8rem' }}>If accepted: you keep {endowment - offerAmount}, they get {offerAmount}. If rejected: both get 0.</p>
                  <input type="range" min={0} max={endowment} value={offerAmount} onChange={e => setOfferAmount(Number(e.target.value))} style={{ width: '100%', margin: '1rem 0' }} />
                  <div className="ult-split-display">
                    <div className="ult-split-box ult-split-keep">
                      <span className="ult-split-label">You Keep</span>
                      <span className="ult-split-val">{endowment - offerAmount}</span>
                    </div>
                    <div className="ult-split-arrow">→</div>
                    <div className="ult-split-box ult-split-offer">
                      <span className="ult-split-label">You Offer</span>
                      <span className="ult-split-val">{offerAmount}</span>
                    </div>
                  </div>
                  <button className="ult-btn ult-btn-primary" onClick={submitOffer} style={{ width: '100%' }}>
                    Submit Offer of {offerAmount}
                  </button>
                </div>
              )}

              {playerToken && myPlayer && !isProposer && session.roundStep === 'response' && currentOffer !== undefined && (
                <div className="ult-card">
                  <h3>Respond to Offer</h3>
                  <div className="ult-offer-display">
                    <div className="ult-offer-label">The Proposer offers you</div>
                    <div className="ult-offer-amount">{currentOffer}</div>
                    <div className="ult-offer-keep">They keep: {endowment - currentOffer} · {Math.round(currentOffer / endowment * 100)}% of {endowment}</div>
                  </div>
                  <p className="ult-desc">Accept: you get {currentOffer}, they get {endowment - currentOffer}. Reject: both get 0.</p>
                  <div className="ult-action-btns">
                    <button className="ult-btn ult-btn-accept" onClick={() => submitResponse(true)}>Accept</button>
                    <button className="ult-btn ult-btn-reject" onClick={() => submitResponse(false)}>Reject</button>
                  </div>
                </div>
              )}

              {isWaitingForOffer && (
                <div className="ult-card"><div className="ult-waiting">Waiting for Proposer to make an offer...</div></div>
              )}
              {isWaitingForResponse && (
                <div className="ult-card"><div className="ult-waiting">Offer submitted. Waiting for Responder's decision...</div></div>
              )}

              {session.rounds.length > 0 && (
                <div className="ult-card">
                  <h3>Round History</h3>
                  <div className="ult-round-hist">
                    {[...session.rounds].filter(r => r.settled).reverse().map(r => (
                      <div key={r.round} className="ult-hist-row">
                        <span>R{r.round}</span>
                        <span>Offer: <strong>{r.offer}</strong></span>
                        <span className={`ult-badge ${r.response === 'accept' ? 'ult-badge-accept' : 'ult-badge-reject'}`}>
                          {r.response === 'accept' ? 'Accepted' : 'Rejected'}
                        </span>
                        {r.settled && <span style={{ color: 'var(--text-muted)' }}>{r.proposerPayoff}/{r.responderPayoff}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div>
              <div className="ult-card">
                <h3>Scoreboard</h3>
                {sortedPlayers.map((p, i) => (
                  <div key={p.id} className={`ult-score-row ${p.id === playerToken ? 'is-me' : ''}`}>
                    <span className="ult-rank">#{i+1}</span>
                    <span className="ult-pname">{p.name}{p.isBot ? ' 🤖' : ''}<br /><span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{p.role}</span></span>
                    <span className="ult-pts">{p.totalScore}</span>
                  </div>
                ))}
              </div>
              <div className="ult-card">
                <h3>Events</h3>
                <div className="ult-event-log">{[...session.eventLog].reverse().map((e, i) => <div key={i} className="ult-event">{e}</div>)}</div>
              </div>
              {isHost && (
                <div className="ult-card">
                  <h3>Host Controls</h3>
                  <div style={{ display: 'flex', gap: '0.5rem', flexDirection: 'column' }}>
                    <button className="ult-btn ult-btn-secondary" onClick={() => hostAction('advance')}>Force Advance</button>
                    <button className="ult-btn ult-btn-danger" onClick={() => hostAction('reset')}>Reset</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {session.phase === 'results' && (
          <div className="ult-card" style={{ maxWidth: 640, margin: '0 auto' }}>
            <h2>Game Complete!</h2>
            <div style={{ marginBottom: '1.5rem' }}>
              {sortedPlayers.map((p, i) => (
                <div key={p.id} className={`ult-final-row ${i === 0 ? 'winner' : ''}`}>
                  <span>{i === 0 ? '🏆' : `#${i+1}`}</span>
                  <span style={{ flex: 1 }}>{p.name}{p.isBot ? ' 🤖' : ''} ({p.role})</span>
                  <span>{p.totalScore} pts</span>
                </div>
              ))}
            </div>
            <div>
              <h3>Round History</h3>
              {session.rounds.map(r => (
                <div key={r.round} className="ult-hist-row">
                  <span>R{r.round}</span>
                  <span>Offer: {r.offer ?? '—'}</span>
                  <span className={`ult-badge ${r.response === 'accept' ? 'ult-badge-accept' : 'ult-badge-reject'}`}>
                    {r.settled ? (r.response === 'accept' ? 'Accepted' : 'Rejected') : '—'}
                  </span>
                  {r.settled && <span>{r.proposerPayoff}/{r.responderPayoff}</span>}
                </div>
              ))}
            </div>
            {isHost && <button className="ult-btn ult-btn-secondary" onClick={() => hostAction('reset')} style={{ marginTop: '1.5rem' }}>Play Again</button>}
          </div>
        )}

        {error && <div className="ult-error">{error}</div>}
      </div></div>
    </MiniGameShell>
  )
}



