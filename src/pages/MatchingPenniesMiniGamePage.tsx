import { QRCodeSVG } from 'qrcode.react'
import { useEffect, useMemo, useState, useRef } from 'react'
import { getEducatorSessionCached, getEducatorSessionSync } from '../features/minigames/educatorSession'
import { MiniGameShell } from '../features/minigames/MiniGameShell'
import './MatchingPenniesMiniGamePage.css'
import '../features/minigames/SessionControlPanel.css'
import { educatorMiniGamesApi } from '../features/minigames/api'
import { MiniGameSessionsTable } from '../features/minigames/MiniGameSessionsTable'
import type { EducatorMiniGameSession } from '../api/client'

const STORAGE_KEY = 'matching-pennies_minigame_v1'
const GAME_SLUG = 'matching-pennies'

type Player = { id: string; name: string; isBot: boolean; role: 'row' | 'col'; totalScore: number; hasActedThisRound: boolean }
type RoundSummary = { round: number; rowChoice: string; colChoice: string; rowPayoff: number; colPayoff: number; choices: Record<string, string>; payoffs: Record<string, number> }
type Session = {
  roomCode: string; phase: 'lobby' | 'playing' | 'results'
  currentRound: number; config: { strategies: string[]; rounds: number; gameName: string }
  players: Player[]; history: RoundSummary[]; eventLog: string[]
  stats: { actedCount: number; waitingCount: number }
  viewer: { role: 'row' | 'col'; totalScore: number; hasActed: boolean } | null
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

export default function MatchingPenniesMiniGamePage() {
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

  async function submitStrategy(strategy: string) {
    if (!roomCode || !playerToken) return
    try {
      const d = await api<{ session: Session }>(`/${GAME_SLUG}/${roomCode}/action`, { method: 'POST', body: JSON.stringify({ playerToken, strategy }) })
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
        const latest = sessions.filter(s => s.gameType === 'matching-pennies').sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] || null
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
      <MiniGameShell title="Matching Pennies" sessionsGameType="matching-pennies" publicMode={true}>
        <div className="mp-page"><div className="mp-shell">
          <div className="mp-hero mg-page-hero"><h1>🪙 Matching Pennies</h1></div>
          <div className="mp-card" style={{ textAlign: 'center' }}>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>Educator login required to create. Students: enter room code to join.</p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <input className="mp-input" placeholder="Your name" value={nameInput} onChange={e => setNameInput(e.target.value)} />
              <input className="mp-input" placeholder="Room code" value={roomCodeInput} onChange={e => setRoomCodeInput(e.target.value.toUpperCase())} style={{ maxWidth: '140px' }} />
              <button className="mp-btn mp-btn-primary" onClick={joinGame} disabled={loading}>Join</button>
            </div>
            {error && <div className="mp-error">{error}</div>}
          </div>
        </div></div>
      </MiniGameShell>
    )
  }

  if (isLobbyMode && !session) {
    return (
      <MiniGameShell title="Matching Pennies" subtitle="Zero-Sum Game" sessionsGameType="matching-pennies" publicMode={hasPublicJoinContext}>
        <div className="mp-page"><div className="mp-shell">
          <div className="mp-hero mg-page-hero">
            <h1>🪙 Matching Pennies</h1>
            <p className="mp-sub">Pure zero-sum game. Row wins if choices match, Col wins if they differ. Nash: 50/50 mixed strategy.</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
            <div className="mp-card" style={{ border: '1px solid var(--accent-blue)', background: 'rgba(59, 130, 246, 0.05)' }}>
              <h2 style={{ fontSize: '1rem', color: 'var(--accent-blue)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1rem' }}>🪙 How It Works</h2>
              <div style={{ fontSize: '0.95rem', lineHeight: '1.6', color: 'var(--text-primary)', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                <p>🎭 <strong>Two Roles:</strong> Row Player (Matcher) wins if both choose the same. Col Player (Mismatcher) wins if they differ.</p>
                <div className="mp-matrix" style={{ marginTop: '0.5rem', marginBottom: '0.5rem' }}>
                  <div className="mp-matrix-cell mp-matrix-corner"></div>
                  <div className="mp-matrix-cell mp-matrix-header">Col: Heads</div>
                  <div className="mp-matrix-cell mp-matrix-header">Col: Tails</div>
                  <div className="mp-matrix-cell mp-matrix-header">Row: Heads</div>
                  <div className="mp-matrix-cell mp-matrix-win">+1 / −1</div>
                  <div className="mp-matrix-cell mp-matrix-lose">−1 / +1</div>
                  <div className="mp-matrix-cell mp-matrix-header">Row: Tails</div>
                  <div className="mp-matrix-cell mp-matrix-lose">−1 / +1</div>
                  <div className="mp-matrix-cell mp-matrix-win">+1 / −1</div>
                </div>
                <p>🎯 <strong>Nash Equilibrium:</strong> Mixed strategy — randomize 50/50 between Heads and Tails. No pure strategy equilibrium exists.</p>
              </div>
              <p style={{ marginTop: '1.2rem', fontSize: '0.85rem', color: 'var(--accent-amber)', fontStyle: 'italic' }}>💡 Best as a 2-player game over 10 rounds.</p>
            </div>
            <div className="mp-card">
              <div style={{ display: 'grid', gap: '0.65rem' }}>
                <button className="mp-btn mp-btn-primary" onClick={createGame} disabled={creatingSession}>
                  {creatingSession ? 'Creating...' : 'Create Session'}
                </button>
                <button className="mp-btn mp-btn-secondary" onClick={soloPlay} disabled={loading}>
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
                      <button className="mp-btn mp-btn-secondary" disabled={quickActionLoading !== null || latestSession.status !== 'LOBBY'} onClick={() => void runQuickAction('start')}>{quickActionLoading === 'start' ? 'Starting...' : latestSession.status === 'LOBBY' ? 'Start' : 'Started'}</button>
                      <button className="mp-btn mp-btn-secondary" disabled={quickActionLoading !== null || latestSession.status !== 'ACTIVE'} onClick={() => void runQuickAction('advance')}>{quickActionLoading === 'advance' ? 'Advancing...' : 'Advance'}</button>
                      <button className="mp-btn mp-btn-secondary" disabled={quickActionLoading !== null || (latestSession.status !== 'ACTIVE' && latestSession.status !== 'COMPLETED')} onClick={() => void runQuickAction('reset')}>{quickActionLoading === 'reset' ? 'Resetting...' : 'Reset'}</button>
                    </div>
                    {quickActionMessage && <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{quickActionMessage}</div>}
                  </div>
                )}
              </div>
            </div>
          </div>
          <MiniGameSessionsTable gameType="matching-pennies" refreshKey={sessionsRefreshKey} />
          {error && <div className="mp-error">{error}</div>}
        </div></div>
      </MiniGameShell>
    )
  }

  if (!session) return (
    <MiniGameShell title="Matching Pennies" sessionsGameType="matching-pennies" publicMode={hasPublicJoinContext}>
      <div className="mp-page"><div className="mp-shell"><div className="mp-loading">Loading...</div></div></div>
    </MiniGameShell>
  )

  const myPlayer = session.players.find(p => p.id === playerToken)
  const opponent = session.players.find(p => p.id !== playerToken)
  const sortedPlayers = [...session.players].sort((a, b) => b.totalScore - a.totalScore)
  const lastRound = session.history[session.history.length - 1]
  const myLastChoice = myPlayer && lastRound ? lastRound.choices[myPlayer.id] : undefined
  const oppLastChoice = opponent && lastRound ? lastRound.choices[opponent.id] : undefined
  const myLastPayoff = myPlayer && lastRound ? lastRound.payoffs[myPlayer.id] : undefined

  return (
    <MiniGameShell title="Matching Pennies" subtitle="Zero-Sum Game" sessionsGameType="matching-pennies" publicMode={hasPublicJoinContext}>
      <div className="mp-page"><div className="mp-shell">
        <div className="mp-hero mg-page-hero">
          <h1>🪙 Matching Pennies</h1>
          <p className="mp-sub">Room: <strong>{session.roomCode}</strong> · Round {session.currentRound}/{session.config.rounds} · {session.phase.toUpperCase()}</p>
        </div>
        <div className="mp-card" style={{ border: '1px solid var(--accent-blue)', background: 'rgba(59, 130, 246, 0.05)', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1rem', color: 'var(--accent-blue)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1rem' }}>🪙 How It Works</h2>
          <div style={{ fontSize: '0.95rem', lineHeight: '1.6', color: 'var(--text-primary)', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
            <p>🎭 <strong>Two Roles:</strong> Row Player (Matcher) wins if both choose the same. Col Player (Mismatcher) wins if they differ.</p>
            <div className="mp-matrix" style={{ marginTop: '0.5rem', marginBottom: '0.5rem' }}>
              <div className="mp-matrix-cell mp-matrix-corner"></div>
              <div className="mp-matrix-cell mp-matrix-header">Col: Heads</div>
              <div className="mp-matrix-cell mp-matrix-header">Col: Tails</div>
              <div className="mp-matrix-cell mp-matrix-header">Row: Heads</div>
              <div className="mp-matrix-cell mp-matrix-win">+1 / −1</div>
              <div className="mp-matrix-cell mp-matrix-lose">−1 / +1</div>
              <div className="mp-matrix-cell mp-matrix-header">Row: Tails</div>
              <div className="mp-matrix-cell mp-matrix-lose">−1 / +1</div>
              <div className="mp-matrix-cell mp-matrix-win">+1 / −1</div>
            </div>
            <p>🎯 <strong>Nash Equilibrium:</strong> Mixed strategy — randomize 50/50 between Heads and Tails. No pure strategy equilibrium exists.</p>
          </div>
          <p style={{ marginTop: '1.2rem', fontSize: '0.85rem', color: 'var(--accent-amber)', fontStyle: 'italic' }}>💡 Best as a 2-player game over 10 rounds.</p>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
          <button className="mp-btn mp-btn-secondary" onClick={leaveGame} style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}>← Leave Game</button>
        </div>

        {session.phase === 'lobby' && (
          <div className="mp-card" style={{ maxWidth: 520, margin: '0 auto' }}>
            <h2>{isHost ? (session.players.length >= 2 ? '▶ Ready to Start!' : 'Waiting for Players') : 'Waiting for Host to Start'}</h2>
            <p className="mp-desc">Share code: <strong className="mp-room-code">{session.roomCode}</strong></p>
            <div className="mp-players-list">{session.players.map(p => <div key={p.id} className="mp-chip">{p.name}</div>)}</div>
            {isHost && <button className="mp-btn mp-btn-primary" onClick={() => hostAction('start')} disabled={session.players.length < 2} style={{ marginTop: '1rem' }}>Start ({session.players.length}/2 players)</button>}
            {playerToken && !isHost && (
              <p className="mp-desc" style={{ marginTop: '1rem' }}>You've joined — waiting for the host to start the game.</p>
            )}
            {!isHost && !playerToken && (
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
                <input className="mp-input" placeholder="Your name" value={nameInput} onChange={e => setNameInput(e.target.value)} />
                <button className="mp-btn mp-btn-secondary" onClick={joinGame}>Join</button>
              </div>
            )}
          </div>
        )}

        {session.phase === 'playing' && (
          <div className="mp-game-grid">
            <div className="mp-main-col">
              <div className="mp-card mp-info-card">
                <div className="mp-info-row">
                  <div className="mp-info-item"><span className="mp-info-label">Round</span><span className="mp-info-val">{session.currentRound}/{session.config.rounds}</span></div>
                  <div className="mp-info-item"><span className="mp-info-label">My Score</span><span className="mp-info-val">{myPlayer?.totalScore ?? session.viewer?.totalScore ?? 0}</span></div>
                  {myPlayer && <div className="mp-info-item"><span className="mp-info-label">Role</span><span className="mp-info-val" style={{ fontSize: '0.9rem' }}>{myPlayer.role === 'row' ? 'Matcher' : 'Mismatcher'}</span></div>}
                </div>
                {myPlayer && <p className="mp-desc" style={{ marginTop: '0.5rem', fontSize: '0.82rem' }}>
                  {myPlayer.role === 'row' ? 'You win when choices MATCH (both H or both T).' : 'You win when choices DIFFER (H vs T).'}
                </p>}
              </div>

              {playerToken && myPlayer && (
                <div className="mp-card">
                  <h3>Round {session.currentRound} — Choose Your Coin</h3>
                  {session.viewer?.hasActed ? (
                    <div className="mp-waiting">
                      {session.stats.waitingCount <= 1
                        ? 'Choice submitted. Resolving round...'
                        : `Choice submitted. Waiting for opponent (${session.stats.actedCount}/${session.stats.waitingCount} ready)...`}
                    </div>
                  ) : (
                    <>
                      <p className="mp-desc">Play against <strong>{opponent?.name || 'opponent'}</strong>. Pick heads or tails.</p>
                      <div className="mp-choice-btns">
                        <button className="mp-btn mp-btn-heads" onClick={() => submitStrategy('Heads')}>🪙 Heads</button>
                        <button className="mp-btn mp-btn-tails" onClick={() => submitStrategy('Tails')}>🔮 Tails</button>
                      </div>
                    </>
                  )}
                </div>
              )}

              {lastRound && (
                <div className="mp-card">
                  <h3>Round {lastRound.round} Result</h3>
                  <div className="mp-coin-display">
                    {myLastChoice && (
                      <div style={{ textAlign: 'center' }}>
                        <div className={`mp-coin ${myLastChoice.toLowerCase()}`}>{myLastChoice === 'Heads' ? '🪙' : '🔮'}</div>
                        <div style={{ fontSize: '0.8rem', marginTop: '0.25rem', color: 'var(--text-muted)' }}>You: {myLastChoice}</div>
                      </div>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', fontSize: '1.5rem', color: 'var(--text-muted)' }}>vs</div>
                    {oppLastChoice && (
                      <div style={{ textAlign: 'center' }}>
                        <div className={`mp-coin ${oppLastChoice.toLowerCase()}`}>{oppLastChoice === 'Heads' ? '🪙' : '🔮'}</div>
                        <div style={{ fontSize: '0.8rem', marginTop: '0.25rem', color: 'var(--text-muted)' }}>{opponent?.name}: {oppLastChoice}</div>
                      </div>
                    )}
                  </div>
                  {myLastPayoff !== undefined && (
                    <p style={{ textAlign: 'center', fontWeight: 700, fontSize: '1.1rem' }}>
                      <span className={myLastPayoff > 0 ? 'mp-outcome-win' : 'mp-outcome-lose'}>
                        {myLastPayoff > 0 ? `+${myLastPayoff} — You Win!` : `${myLastPayoff} — You Lose`}
                      </span>
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="mp-side-col">
              <div className="mp-card">
                <h3>Scoreboard</h3>
                {sortedPlayers.map((p, i) => (
                  <div key={p.id} className={`mp-score-row ${p.id === playerToken ? 'is-me' : ''}`}>
                    <span className="mp-rank">#{i+1}</span><span className="mp-pname">{p.name}{p.isBot ? ' 🤖' : ''}</span><span className="mp-pts">{p.totalScore}</span>
                  </div>
                ))}
              </div>
              {session.history.length > 0 && (
                <div className="mp-card">
                  <h3>Round History</h3>
                  <div className="mp-history">
                    {session.history.map(r => {
                      const myChoice = myPlayer ? r.choices[myPlayer.id] : undefined
                      const oppChoice = opponent ? r.choices[opponent.id] : undefined
                      const myPayoff = myPlayer ? r.payoffs[myPlayer.id] : undefined
                      return (
                        <div key={r.round} className="mp-hist-row">
                          <span>R{r.round}</span>
                          {myChoice && <span className={`mp-choice-tag ${myChoice.toLowerCase()}`}>{myChoice[0]}</span>}
                          {oppChoice && <span className={`mp-choice-tag ${oppChoice.toLowerCase()}`}>{oppChoice[0]}</span>}
                          <span className={myPayoff !== undefined ? (myPayoff > 0 ? 'mp-outcome-win' : 'mp-outcome-lose') : ''}>{myPayoff !== undefined ? (myPayoff > 0 ? 'W' : 'L') : `${r.rowPayoff}`}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
              <div className="mp-card">
                <h3>Events</h3>
                <div className="mp-event-log">{[...session.eventLog].reverse().map((e, i) => <div key={i} className="mp-event">{e}</div>)}</div>
              </div>
              {isHost && (
                <div className="mp-card">
                  <h3>Host Controls</h3>
                  <p className="mp-desc">Ready: {session.stats.actedCount}/{session.stats.waitingCount}</p>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="mp-btn mp-btn-secondary" onClick={() => hostAction('advance')}>Force Advance</button>
                    <button className="mp-btn mp-btn-danger" onClick={() => hostAction('reset')}>Reset</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {session.phase === 'results' && (
          <div className="mp-card" style={{ maxWidth: 640, margin: '0 auto' }}>
            <h2>Game Complete!</h2>
            <div style={{ marginBottom: '1.5rem' }}>
              {sortedPlayers.map((p, i) => (
                <div key={p.id} className={`mp-final-row ${i === 0 ? 'winner' : ''}`}>
                  <span>{i === 0 ? '🏆' : `#${i+1}`}</span>
                  <span style={{ flex: 1 }}>{p.name}{p.isBot ? ' 🤖' : ''} ({p.role === 'row' ? 'Matcher' : 'Mismatcher'})</span>
                  <span>{p.totalScore} pts</span>
                </div>
              ))}
            </div>
            <div>
              <h3>Round History</h3>
              {session.history.map(r => (
                <div key={r.round} className="mp-hist-row">
                  <span>R{r.round}</span>
                  <span className={`mp-choice-tag ${r.rowChoice.toLowerCase()}`}>{r.rowChoice[0]}</span>
                  <span>vs</span>
                  <span className={`mp-choice-tag ${r.colChoice.toLowerCase()}`}>{r.colChoice[0]}</span>
                  <span>{r.rowPayoff > 0 ? 'Row wins' : 'Col wins'}</span>
                </div>
              ))}
            </div>
            {isHost && <button className="mp-btn mp-btn-secondary" onClick={() => hostAction('reset')} style={{ marginTop: '1.5rem' }}>Play Again</button>}
          </div>
        )}

        {error && <div className="mp-error">{error}</div>}
      </div></div>
    </MiniGameShell>
  )
}



