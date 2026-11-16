import { QRCodeSVG } from 'qrcode.react'
import { useEffect, useMemo, useState, useRef } from 'react'
import { getEducatorSessionCached, getEducatorSessionSync } from '../features/minigames/educatorSession'
import { MiniGameShell } from '../features/minigames/MiniGameShell'
import './TrustGameMiniGamePage.css'
import '../features/minigames/SessionControlPanel.css'
import { educatorMiniGamesApi } from '../features/minigames/api'
import { MiniGameSessionsTable } from '../features/minigames/MiniGameSessionsTable'
import type { EducatorMiniGameSession } from '../api/client'

const STORAGE_KEY = 'trust-game_minigame_v1'
const GAME_SLUG = 'trust-game'

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

export default function TrustGameMiniGamePage() {
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
  const [sendAmount, setSendAmount] = useState(50)
  const [returnAmount, setReturnAmount] = useState(75)
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
      await educatorMiniGamesApi.createSession({ gameType: 'trust-game', teamCount: 2 })
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

  async function submitSend() {
    if (!roomCode || !playerToken) return
    try {
      const d = await api<{ session: Session }>(`/${GAME_SLUG}/${roomCode}/action`, { method: 'POST', body: JSON.stringify({ playerToken, actionType: 'offer', amount: sendAmount }) })
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

  async function submitReturn() {
    if (!roomCode || !playerToken) return
    try {
      const d = await api<{ session: Session }>(`/${GAME_SLUG}/${roomCode}/action`, { method: 'POST', body: JSON.stringify({ playerToken, actionType: 'response', amount: returnAmount }) })
      setSession(d.session)
    } catch (e) { setError((e as Error).message) }
  }

  const endowment = session?.config.endowment || 100
  const multiplier = session?.config.multiplier || 3
  const currentOffer = session?.currentRoundState?.offer
  const received = currentOffer !== undefined ? currentOffer * multiplier : 0

  useEffect(() => {
    if (hasPublicJoinContext) return
    if (sessionsRefreshKey === 0) return
    const load = async () => {
      setSessionsFetching(true)
      try {
        const sessions = await educatorMiniGamesApi.listSessions()
        const latest = sessions.filter(s => s.gameType === 'trust-game').sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] || null
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
      <MiniGameShell title="Trust Game" sessionsGameType="trust-game" publicMode={true}>
        <div className="tg-page"><div className="tg-shell">
          <div className="tg-hero mg-page-hero"><h1>🔒 Trust Game</h1></div>
          <div className="tg-card" style={{ textAlign: 'center' }}>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>Educator login required to create. Students: enter room code to join.</p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <input className="tg-input" placeholder="Your name" value={nameInput} onChange={e => setNameInput(e.target.value)} />
              <input className="tg-input" placeholder="Room code" value={roomCodeInput} onChange={e => setRoomCodeInput(e.target.value.toUpperCase())} style={{ maxWidth: '140px' }} />
              <button className="tg-btn tg-btn-primary" onClick={joinGame} disabled={loading}>Join</button>
            </div>
            {error && <div className="tg-error">{error}</div>}
          </div>
        </div></div>
      </MiniGameShell>
    )
  }

  if (isLobbyMode && !session) {
    return (
      <MiniGameShell title="Trust Game" subtitle="Trust and Reciprocity" sessionsGameType="trust-game" publicMode={hasPublicJoinContext}>
        <div className="tg-page"><div className="tg-shell">
          <div className="tg-hero mg-page-hero">
            <h1>🔒 Trust Game</h1>
            <p className="tg-sub">Investor sends points → amount is tripled → Trustee decides how much to return. Will trust be rewarded?</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
            <div className="tg-card" style={{ border: '1px solid var(--accent-blue)', background: 'rgba(59, 130, 246, 0.05)' }}>
              <h2 style={{ fontSize: '1rem', color: 'var(--accent-blue)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1rem' }}>🔒 How It Works</h2>
              <div style={{ fontSize: '0.95rem', lineHeight: '1.6', color: 'var(--text-primary)', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                <div className="tg-flow" style={{ marginBottom: '0.5rem' }}>
                  <div className="tg-flow-box tg-flow-investor"><span className="tg-flow-label">Investor sends</span><span className="tg-flow-val">X</span></div>
                  <div className="tg-flow-arrow">→ ×3 →</div>
                  <div className="tg-flow-box tg-flow-multiplied"><span className="tg-flow-label">Trustee gets</span><span className="tg-flow-val">3X</span></div>
                  <div className="tg-flow-arrow">→ Y →</div>
                  <div className="tg-flow-box tg-flow-returned"><span className="tg-flow-label">Investor gets</span><span className="tg-flow-val">Y</span></div>
                </div>
                <p>📤 <strong>Investor:</strong> Earns (100−X)+Y. Sending more signals trust but risks getting nothing back.</p>
                <p>📥 <strong>Trustee:</strong> Earns 3X−Y. Returns nothing = maximizes personal gain but breaks trust.</p>
                <p>🎯 <strong>Nash Equilibrium:</strong> Investor sends 0, Trustee returns 0 — but real experiments show far more generosity!</p>
              </div>
              <p style={{ marginTop: '1.2rem', fontSize: '0.85rem', color: 'var(--accent-amber)', fontStyle: 'italic' }}>💡 Best as 2-player game over 5 rounds.</p>
            </div>
            <div className="tg-card">
              <div style={{ display: 'grid', gap: '0.65rem' }}>
                <button className="tg-btn tg-btn-primary" onClick={createGame} disabled={creatingSession}>
                  {creatingSession ? 'Creating...' : 'Create Session'}
                </button>
                <button className="tg-btn tg-btn-secondary" onClick={soloPlay} disabled={loading}>
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
                      <button className="tg-btn tg-btn-secondary" disabled={quickActionLoading !== null || latestSession.status !== 'LOBBY'} onClick={() => void runQuickAction('start')}>{quickActionLoading === 'start' ? 'Starting...' : latestSession.status === 'LOBBY' ? 'Start' : 'Started'}</button>
                      <button className="tg-btn tg-btn-secondary" disabled={quickActionLoading !== null || latestSession.status !== 'ACTIVE'} onClick={() => void runQuickAction('advance')}>{quickActionLoading === 'advance' ? 'Advancing...' : 'Advance'}</button>
                      <button className="tg-btn tg-btn-secondary" disabled={quickActionLoading !== null || (latestSession.status !== 'ACTIVE' && latestSession.status !== 'COMPLETED')} onClick={() => void runQuickAction('reset')}>{quickActionLoading === 'reset' ? 'Resetting...' : 'Reset'}</button>
                    </div>
                    {quickActionMessage && <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{quickActionMessage}</div>}
                  </div>
                )}
              </div>
            </div>
          </div>
          <MiniGameSessionsTable gameType="trust-game" refreshKey={sessionsRefreshKey} />
          {error && <div className="tg-error">{error}</div>}
        </div></div>
      </MiniGameShell>
    )
  }

  if (!session) return (
    <MiniGameShell title="Trust Game" sessionsGameType="trust-game" publicMode={hasPublicJoinContext}>
      <div className="tg-page"><div className="tg-shell">
        {(!playerToken && !hostToken) ? (
          <div className="tg-card" style={{ maxWidth: 480, margin: '2rem auto', textAlign: 'center' }}>
            <h2 style={{ marginBottom: '1rem' }}>Join Trust Game</h2>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <input className="tg-input" placeholder="Your name" value={nameInput} onChange={e => setNameInput(e.target.value)} />
              {!roomCodeInput && (
                <input className="tg-input" placeholder="Room code" value={roomCodeInput} onChange={e => setRoomCodeInput(e.target.value.toUpperCase())} style={{ maxWidth: '140px' }} />
              )}
              <button className="tg-btn tg-btn-primary" onClick={joinGame} disabled={loading}>
                {loading ? 'Joining...' : `Join${roomCodeInput ? ` Room ${roomCodeInput}` : ''}`}
              </button>
            </div>
            {error && <div className="tg-error">{error}</div>}
          </div>
        ) : (
          <div className="tg-loading">Loading...</div>
        )}
      </div></div>
    </MiniGameShell>
  )

  const myPlayer = session.players.find(p => p.id === playerToken)
  const isInvestor = session.viewer?.isProposer ?? false
  const isTrustee = !isInvestor && !!myPlayer
  const sortedPlayers = [...session.players].sort((a, b) => b.totalScore - a.totalScore)

  return (
    <MiniGameShell title="Trust Game" subtitle="Trust and Reciprocity" sessionsGameType="trust-game" publicMode={hasPublicJoinContext}>
      <div className="tg-page"><div className="tg-shell">
        <div className="tg-hero mg-page-hero">
          <h1>🔒 Trust Game</h1>
          <p className="tg-sub">
            Room: <strong>{session.roomCode}</strong> · Round {session.currentRound}/{session.config.rounds}
            {myPlayer && <span className="tg-role-badge" style={{ marginLeft: '0.5rem' }}>{isInvestor ? 'Investor' : 'Trustee'}</span>}
          </p>
        </div>
        <div className="tg-card" style={{ border: '1px solid var(--accent-blue)', background: 'rgba(59, 130, 246, 0.05)', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1rem', color: 'var(--accent-blue)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1rem' }}>🔒 How It Works</h2>
          <div style={{ fontSize: '0.95rem', lineHeight: '1.6', color: 'var(--text-primary)', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
            <div className="tg-flow" style={{ marginBottom: '0.5rem' }}>
              <div className="tg-flow-box tg-flow-investor"><span className="tg-flow-label">Investor sends</span><span className="tg-flow-val">X</span></div>
              <div className="tg-flow-arrow">→ ×3 →</div>
              <div className="tg-flow-box tg-flow-multiplied"><span className="tg-flow-label">Trustee gets</span><span className="tg-flow-val">3X</span></div>
              <div className="tg-flow-arrow">→ Y →</div>
              <div className="tg-flow-box tg-flow-returned"><span className="tg-flow-label">Investor gets</span><span className="tg-flow-val">Y</span></div>
            </div>
            <p>📤 <strong>Investor:</strong> Earns (100−X)+Y. Sending more signals trust but risks getting nothing back.</p>
            <p>📥 <strong>Trustee:</strong> Earns 3X−Y. Returns nothing = maximizes personal gain but breaks trust.</p>
            <p>🎯 <strong>Nash Equilibrium:</strong> Investor sends 0, Trustee returns 0 — but real experiments show far more generosity!</p>
          </div>
          <p style={{ marginTop: '1.2rem', fontSize: '0.85rem', color: 'var(--accent-amber)', fontStyle: 'italic' }}>💡 Best as 2-player game over 5 rounds.</p>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
          <button className="tg-btn tg-btn-secondary" onClick={leaveGame} style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}>← Leave Game</button>
        </div>

        {session.phase === 'lobby' && (
          <div className="tg-card" style={{ maxWidth: 520, margin: '0 auto' }}>
            <h2>{isHost ? 'Waiting for Players' : 'Waiting for Host to Start'}</h2>
            <p className="tg-desc">Share code: <strong className="tg-room-code">{session.roomCode}</strong></p>
            <div className="tg-players-list">
              {session.players.map(p => <div key={p.id} className="tg-chip">{p.name} ({p.role === 'proposer' ? 'Investor' : 'Trustee'})</div>)}
            </div>
            {isHost && <button className="tg-btn tg-btn-primary" onClick={() => hostAction('start')} disabled={session.players.length < 2} style={{ marginTop: '1rem' }}>Start ({session.players.length}/2 players)</button>}
            {playerToken && !isHost && (
              <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>You've joined — waiting for the host to start the game.</p>
            )}
            {!isHost && !playerToken && (
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
                <input className="tg-input" placeholder="Your name" value={nameInput} onChange={e => setNameInput(e.target.value)} />
                <button className="tg-btn tg-btn-secondary" onClick={joinGame}>Join</button>
              </div>
            )}
          </div>
        )}

        {session.phase === 'playing' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: '1rem' }}>
            <div>
              <div className="tg-card tg-info-card">
                <div className="tg-info-row">
                  <div className="tg-info-item"><span className="tg-info-label">Round</span><span className="tg-info-val">{session.currentRound}/{session.config.rounds}</span></div>
                  <div className="tg-info-item"><span className="tg-info-label">Endowment</span><span className="tg-info-val">{endowment}</span></div>
                  <div className="tg-info-item"><span className="tg-info-label">Multiplier</span><span className="tg-info-val">×{multiplier}</span></div>
                  <div className="tg-info-item"><span className="tg-info-label">My Score</span><span className="tg-info-val">{myPlayer?.totalScore ?? session.viewer?.totalScore ?? 0}</span></div>
                </div>
              </div>

              {playerToken && myPlayer && isInvestor && session.roundStep === 'offer' && (
                <div className="tg-card">
                  <h3>Send to Trustee</h3>
                  <p className="tg-desc">You have <strong>{endowment} points</strong>. How much do you send? It will be multiplied by ×{multiplier}.</p>
                  <input type="range" min={0} max={endowment} value={sendAmount} onChange={e => setSendAmount(Number(e.target.value))} style={{ width: '100%', margin: '1rem 0' }} />
                  <div className="tg-flow">
                    <div className="tg-flow-box tg-flow-investor">
                      <span className="tg-flow-label">You Send</span>
                      <span className="tg-flow-val">{sendAmount}</span>
                    </div>
                    <div className="tg-flow-arrow">→ ×{multiplier} →</div>
                    <div className="tg-flow-box tg-flow-multiplied">
                      <span className="tg-flow-label">Trustee Gets</span>
                      <span className="tg-flow-val">{sendAmount * multiplier}</span>
                    </div>
                  </div>
                  <p className="tg-desc" style={{ fontSize: '0.8rem' }}>You keep: {endowment - sendAmount} + whatever Trustee returns.</p>
                  <button className="tg-btn tg-btn-primary" onClick={submitSend} style={{ width: '100%', marginTop: '0.5rem' }}>
                    Send {sendAmount} to Trustee
                  </button>
                </div>
              )}

              {playerToken && myPlayer && isTrustee && session.roundStep === 'response' && currentOffer !== undefined && (
                <div className="tg-card">
                  <h3>Return to Investor</h3>
                  <div className="tg-receive-display">
                    <div className="tg-receive-label">Investor sent {currentOffer} → multiplied ×{multiplier} → you received</div>
                    <div className="tg-receive-amount">{received}</div>
                    <div className="tg-receive-sub">How much do you return?</div>
                  </div>
                  <input
                    type="range" min={0} max={received} value={Math.min(returnAmount, received)}
                    onChange={e => setReturnAmount(Number(e.target.value))}
                    style={{ width: '100%', margin: '1rem 0' }}
                  />
                  <div className="tg-flow">
                    <div className="tg-flow-box tg-flow-returned">
                      <span className="tg-flow-label">Return</span>
                      <span className="tg-flow-val">{Math.min(returnAmount, received)}</span>
                    </div>
                    <div className="tg-flow-arrow" style={{ fontSize: '1rem' }}>You keep</div>
                    <div className="tg-flow-box tg-flow-multiplied">
                      <span className="tg-flow-label">You Keep</span>
                      <span className="tg-flow-val">{received - Math.min(returnAmount, received)}</span>
                    </div>
                  </div>
                  <button className="tg-btn tg-btn-primary" onClick={submitReturn} style={{ width: '100%', marginTop: '0.5rem' }}>
                    Return {Math.min(returnAmount, received)} to Investor
                  </button>
                </div>
              )}

              {isInvestor && session.roundStep === 'response' && (
                <div className="tg-card"><div className="tg-waiting">Sent! Waiting for Trustee's decision...</div></div>
              )}
              {isTrustee && session.roundStep === 'offer' && (
                <div className="tg-card"><div className="tg-waiting">Waiting for Investor to send...</div></div>
              )}

              {session.rounds.filter(r => r.settled).length > 0 && (
                <div className="tg-card">
                  <h3>Round History</h3>
                  <div className="tg-round-hist">
                    {[...session.rounds].filter(r => r.settled).reverse().map(r => (
                      <div key={r.round} className="tg-hist-row">
                        <span>R{r.round}</span>
                        <span>Sent: <strong>{r.offer ?? 0}</strong></span>
                        <span>×{multiplier}→{(r.offer ?? 0) * multiplier}</span>
                        <span>Returned: <strong>{typeof r.response === 'number' ? r.response : '—'}</strong></span>
                        {r.settled && <span style={{ color: 'var(--text-muted)' }}>{r.proposerPayoff}/{r.responderPayoff}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div>
              <div className="tg-card">
                <h3>Scoreboard</h3>
                {sortedPlayers.map((p, i) => (
                  <div key={p.id} className={`tg-score-row ${p.id === playerToken ? 'is-me' : ''}`}>
                    <span className="tg-rank">#{i+1}</span>
                    <span className="tg-pname">{p.name}{p.isBot ? ' 🤖' : ''}<br /><span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{p.role === 'proposer' ? 'Investor' : 'Trustee'}</span></span>
                    <span className="tg-pts">{p.totalScore}</span>
                  </div>
                ))}
              </div>
              <div className="tg-card">
                <h3>Events</h3>
                <div className="tg-event-log">{[...session.eventLog].reverse().map((e, i) => <div key={i} className="tg-event">{e}</div>)}</div>
              </div>
              {isHost && (
                <div className="tg-card">
                  <h3>Host Controls</h3>
                  <div style={{ display: 'flex', gap: '0.5rem', flexDirection: 'column' }}>
                    <button className="tg-btn tg-btn-secondary" onClick={() => hostAction('advance')}>Force Advance</button>
                    <button className="tg-btn tg-btn-danger" onClick={() => hostAction('reset')}>Reset</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {session.phase === 'results' && (
          <div className="tg-card" style={{ maxWidth: 640, margin: '0 auto' }}>
            <h2>Game Complete!</h2>
            <div style={{ marginBottom: '1.5rem' }}>
              {sortedPlayers.map((p, i) => (
                <div key={p.id} className={`tg-final-row ${i === 0 ? 'winner' : ''}`}>
                  <span>{i === 0 ? '🏆' : `#${i+1}`}</span>
                  <span style={{ flex: 1 }}>{p.name}{p.isBot ? ' 🤖' : ''} ({p.role === 'proposer' ? 'Investor' : 'Trustee'})</span>
                  <span>{p.totalScore} pts</span>
                </div>
              ))}
            </div>
            <div>
              <h3>Round History</h3>
              {session.rounds.map(r => (
                <div key={r.round} className="tg-hist-row">
                  <span>R{r.round}</span>
                  <span>Sent: {r.offer ?? '—'}</span>
                  <span>Received: {(r.offer ?? 0) * multiplier}</span>
                  <span>Returned: {typeof r.response === 'number' ? r.response : '—'}</span>
                  {r.settled && <span style={{ color: 'var(--text-muted)' }}>{r.proposerPayoff}/{r.responderPayoff}</span>}
                </div>
              ))}
            </div>
            {isHost && <button className="tg-btn tg-btn-secondary" onClick={() => hostAction('reset')} style={{ marginTop: '1.5rem' }}>Play Again</button>}
          </div>
        )}

        {error && <div className="tg-error">{error}</div>}
      </div></div>
    </MiniGameShell>
  )
}



