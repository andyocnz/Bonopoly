import { QRCodeSVG } from 'qrcode.react'
import { useEffect, useMemo, useState, useRef } from 'react'
import { getEducatorSessionCached, getEducatorSessionSync } from '../features/minigames/educatorSession'
import { MiniGameShell } from '../features/minigames/MiniGameShell'
import './BeautyContestMiniGamePage.css'
import '../features/minigames/SessionControlPanel.css'
import { educatorMiniGamesApi } from '../features/minigames/api'
import { MiniGameSessionsTable } from '../features/minigames/MiniGameSessionsTable'
import type { EducatorMiniGameSession } from '../api/client'

const STORAGE_KEY = 'beauty-contest_minigame_v1'
const GAME_SLUG = 'beauty-contest'

type Player = { id: string; name: string; isBot: boolean; totalWins: number; totalScore: number; hasActedThisRound: boolean }
type RoundSummary = {
  round: number; guesses: Record<string, number>; mean: number; target: number
  distances: Record<string, number>; winners: string[]; winnerNames: string[]
}
type Session = {
  roomCode: string; phase: 'lobby' | 'playing' | 'results'
  currentRound: number; config: { fraction: number; guessMin: number; guessMax: number; rounds: number }
  players: Player[]; history: RoundSummary[]; eventLog: string[]
  stats: { actedCount: number; waitingCount: number }
  viewer?: Viewer | null
}
type Viewer = { totalWins: number; totalScore: number; hasActed: boolean }
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

export default function BeautyContestMiniGamePage() {
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
  const [guess, setGuess] = useState(50)
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

    setHostToken(null); setPlayerToken(null); setSession(null); setViewer(null); setIsHost(false); setError(null); setIsLobbyMode(true)
  }

  async function submitGuess() {
    if (!roomCode || !playerToken) return
    try {
      const d = await api<{ session: Session }>(`/${GAME_SLUG}/${roomCode}/action`, { method: 'POST', body: JSON.stringify({ playerToken, guess }) })
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
        const latest = sessions.filter(s => s.gameType === 'beauty-contest').sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] || null
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
      <MiniGameShell title="Beauty Contest" sessionsGameType="beauty-contest" publicMode={true}>
        <div className="bc-page"><div className="bc-shell">
          <div className="bc-hero mg-page-hero"><h1>🎯 Beauty Contest</h1></div>
          <div className="bc-card" style={{ textAlign: 'center' }}>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>Educator login required. Students: enter room code to join.</p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <input className="bc-input" placeholder="Your name" value={nameInput} onChange={e => setNameInput(e.target.value)} />
              <input className="bc-input" placeholder="Room code" value={roomCodeInput} onChange={e => setRoomCodeInput(e.target.value.toUpperCase())} style={{ maxWidth: '140px' }} />
              <button className="bc-btn bc-btn-primary" onClick={joinGame} disabled={loading}>Join</button>
            </div>
            {error && <div className="bc-error">{error}</div>}
          </div>
        </div></div>
      </MiniGameShell>
    )
  }

  if (isLobbyMode && !session) {
    return (
      <MiniGameShell title="Beauty Contest" subtitle="Iterated Dominance" sessionsGameType="beauty-contest" publicMode={hasPublicJoinContext}>
        <div className="bc-page"><div className="bc-shell">
          <div className="bc-hero mg-page-hero">
            <h1>🎯 Beauty Contest</h1>
            <p className="bc-sub">Guess 0–100. Winner = closest to ⅔ of the average. Nash equilibrium = 0.</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
            <div className="bc-card" style={{ border: '1px solid var(--accent-blue)', background: 'rgba(59, 130, 246, 0.05)' }}>
              <h2 style={{ fontSize: '1rem', color: 'var(--accent-blue)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1rem' }}>🎯 How It Works</h2>
              <div style={{ fontSize: '0.95rem', lineHeight: '1.6', color: 'var(--text-primary)', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                <p>🔢 <strong>Guess a Number (0–100):</strong> Everyone picks simultaneously each round.</p>
                <p>🎯 <strong>The Target:</strong> Winner = closest to <strong>⅔ of the average</strong> of all guesses.</p>
                <p>🧠 <strong>Nash Equilibrium:</strong> If everyone reasons through iterated dominance, all converge to <strong>0</strong> — but rarely happens at first.</p>
                <p>📉 <strong>Watch It Converge:</strong> Over 5 rounds, guesses typically drop as players learn the equilibrium logic.</p>
              </div>
              <p style={{ marginTop: '1.2rem', fontSize: '0.85rem', color: 'var(--accent-amber)', fontStyle: 'italic' }}>💡 Best with 5–20 players over 5+ rounds.</p>
            </div>
            <div className="bc-card">
              <div style={{ display: 'grid', gap: '0.65rem' }}>
                <button className="bc-btn bc-btn-primary" onClick={createGame} disabled={creatingSession}>
                  {creatingSession ? 'Creating...' : 'Create Session'}
                </button>
                <button className="bc-btn bc-btn-secondary" onClick={soloPlay} disabled={loading}>
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
                      <button className="bc-btn bc-btn-secondary" disabled={quickActionLoading !== null || latestSession.status !== 'LOBBY'} onClick={() => void runQuickAction('start')}>{quickActionLoading === 'start' ? 'Starting...' : latestSession.status === 'LOBBY' ? 'Start' : 'Started'}</button>
                      <button className="bc-btn bc-btn-secondary" disabled={quickActionLoading !== null || latestSession.status !== 'ACTIVE'} onClick={() => void runQuickAction('advance')}>{quickActionLoading === 'advance' ? 'Advancing...' : 'Advance'}</button>
                      <button className="bc-btn bc-btn-secondary" disabled={quickActionLoading !== null || (latestSession.status !== 'ACTIVE' && latestSession.status !== 'COMPLETED')} onClick={() => void runQuickAction('reset')}>{quickActionLoading === 'reset' ? 'Resetting...' : 'Reset'}</button>
                    </div>
                    {quickActionMessage && <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{quickActionMessage}</div>}
                  </div>
                )}
              </div>
            </div>
          </div>
          <MiniGameSessionsTable gameType="beauty-contest" refreshKey={sessionsRefreshKey} />
          {error && <div className="bc-error">{error}</div>}
        </div></div>
      </MiniGameShell>
    )
  }

  if (!session) return (
    <MiniGameShell title="Beauty Contest" sessionsGameType="beauty-contest" publicMode={hasPublicJoinContext}>
      <div className="bc-page"><div className="bc-shell"><div className="bc-loading">Loading...</div></div></div>
    </MiniGameShell>
  )

  const myPlayer = session.players.find(p => p.id === playerToken)
  const sortedPlayers = [...session.players].sort((a, b) => b.totalWins - a.totalWins || b.totalScore - a.totalScore)
  const lastRound = session.history[session.history.length - 1]
  const fracPct = Math.round(session.config.fraction * 100)
  const myLastGuess = lastRound && myPlayer ? lastRound.guesses[myPlayer.id] : undefined
  const myLastDist = lastRound && myPlayer ? lastRound.distances[myPlayer.id] : undefined
  const iWon = lastRound && myPlayer ? lastRound.winners.includes(myPlayer.id) : false

  return (
    <MiniGameShell title="Beauty Contest" subtitle="Iterated Dominance" sessionsGameType="beauty-contest" publicMode={hasPublicJoinContext}>
      <div className="bc-page"><div className="bc-shell">
        <div className="bc-hero mg-page-hero">
          <h1>🎯 Beauty Contest</h1>
          <p className="bc-sub">Room: <strong>{session.roomCode}</strong> · Round {session.currentRound}/{session.config.rounds} · {session.phase.toUpperCase()}</p>
        </div>

        <div className="bc-card" style={{ border: '1px solid var(--accent-blue)', background: 'rgba(59, 130, 246, 0.05)', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1rem', color: 'var(--accent-blue)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1rem' }}>🎯 How It Works</h2>
          <div style={{ fontSize: '0.95rem', lineHeight: '1.6', color: 'var(--text-primary)', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
            <p>🔢 <strong>Guess a Number (0–100):</strong> Everyone picks simultaneously each round.</p>
            <p>🎯 <strong>The Target:</strong> Winner = closest to <strong>⅔ of the average</strong> of all guesses.</p>
            <p>🧠 <strong>Nash Equilibrium:</strong> If everyone reasons through iterated dominance, all converge to <strong>0</strong> — but rarely happens at first.</p>
            <p>📉 <strong>Watch It Converge:</strong> Over 5 rounds, guesses typically drop as players learn the equilibrium logic.</p>
          </div>
          <p style={{ marginTop: '1.2rem', fontSize: '0.85rem', color: 'var(--accent-amber)', fontStyle: 'italic' }}>💡 Best with 5–20 players over 5+ rounds.</p>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
          <button className="bc-btn bc-btn-secondary" onClick={leaveGame} style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}>← Leave Game</button>
        </div>

        {session.phase === 'lobby' && (
          <div className="bc-card" style={{ maxWidth: 520, margin: '0 auto' }}>
            <h2>{isHost ? 'Waiting for Players' : 'Waiting for Host to Start'}</h2>
            <p className="bc-desc">Share code: <strong className="bc-room-code">{session.roomCode}</strong></p>
            <p className="bc-desc">Goal: Guess closest to <strong>{fracPct}% of the average</strong>. Nash equilibrium = 0.</p>
            <div className="bc-players-list">{session.players.map(p => <div key={p.id} className="bc-chip">{p.name}</div>)}</div>
            {isHost && <button className="bc-btn bc-btn-primary" onClick={() => hostAction('start')} disabled={session.players.length < 2} style={{ marginTop: '1rem' }}>Start ({session.players.length} players)</button>}
            {playerToken && !isHost && (
              <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>You've joined — waiting for the host to start the game.</p>
            )}
            {!isHost && !playerToken && (
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
                <input className="bc-input" placeholder="Your name" value={nameInput} onChange={e => setNameInput(e.target.value)} />
                <button className="bc-btn bc-btn-secondary" onClick={joinGame}>Join</button>
              </div>
            )}
          </div>
        )}

        {session.phase === 'playing' && (
          <div className="bc-game-grid">
            <div className="bc-main-col">
              <div className="bc-card bc-info-card">
                <div className="bc-info-row">
                  <div className="bc-info-item"><span className="bc-info-label">Round</span><span className="bc-info-val">{session.currentRound}/{session.config.rounds}</span></div>
                  <div className="bc-info-item"><span className="bc-info-label">Target</span><span className="bc-info-val">{fracPct}% of avg</span></div>
                  <div className="bc-info-item"><span className="bc-info-label">Nash Eq.</span><span className="bc-info-val">0</span></div>
                  {lastRound && <div className="bc-info-item"><span className="bc-info-label">Last Target</span><span className="bc-info-val">{lastRound.target}</span></div>}
                </div>
              </div>

              {playerToken && myPlayer && (
                <div className="bc-card">
                  <h3>Round {session.currentRound} — Your Guess</h3>
                  {viewer?.hasActed ? (
                    <div className="bc-waiting">Guess submitted. Waiting for others ({session.stats.actedCount}/{session.stats.waitingCount})...</div>
                  ) : (
                    <>
                      <p className="bc-desc">
                        Guess a number 0–100. Winner = closest to <strong>{fracPct}% of everyone's average</strong>.
                        {lastRound && ` Last round: mean was ${lastRound.mean}, target was ${lastRound.target}.`}
                      </p>
                      <input type="range" min={0} max={100} value={guess} onChange={e => setGuess(Number(e.target.value))} style={{ width: '100%', margin: '1rem 0' }} />
                      <div className="bc-guess-display">
                        <div className="bc-guess-box">
                          <span className="bc-guess-label">Your Guess</span>
                          <span className="bc-guess-val">{guess}</span>
                        </div>
                        {lastRound && (
                          <div className="bc-guess-box bc-target-box">
                            <span className="bc-guess-label">Previous Target</span>
                            <span className="bc-guess-val">{lastRound.target}</span>
                          </div>
                        )}
                      </div>
                      <button className="bc-btn bc-btn-primary" onClick={submitGuess} style={{ width: '100%', marginTop: '1rem' }}>
                        Submit Guess: {guess}
                      </button>
                    </>
                  )}
                </div>
              )}

              {lastRound && (
                <div className="bc-card">
                  <h3>Round {lastRound.round} Results</h3>
                  <div className="bc-round-stats">
                    <div className="bc-stat"><span className="bc-stat-label">Average</span><span className="bc-stat-val">{lastRound.mean}</span></div>
                    <div className="bc-stat"><span className="bc-stat-label">Target ({fracPct}% of avg)</span><span className="bc-stat-val bc-target">{lastRound.target}</span></div>
                    <div className="bc-stat"><span className="bc-stat-label">Winner(s)</span><span className="bc-stat-val">{lastRound.winnerNames.join(', ')}</span></div>
                    {myLastGuess !== undefined && <div className="bc-stat"><span className="bc-stat-label">Your Guess</span><span className="bc-stat-val">{myLastGuess}</span></div>}
                    {myLastDist !== undefined && <div className="bc-stat"><span className="bc-stat-label">Your Distance</span><span className="bc-stat-val" style={{ color: iWon ? '#16a34a' : undefined }}>{myLastDist} {iWon ? '🏆' : ''}</span></div>}
                  </div>
                  <div className="bc-all-guesses">
                    {session.players.map(p => (
                      <div key={p.id} className={`bc-guess-row ${p.id === playerToken ? 'is-me' : ''} ${lastRound.winners.includes(p.id) ? 'is-winner' : ''}`}>
                        <span>{p.name}</span>
                        <span>guessed {lastRound.guesses[p.id] ?? '—'}</span>
                        <span>dist: {lastRound.distances[p.id] ?? '—'}</span>
                        {lastRound.winners.includes(p.id) && <span className="bc-win-badge">WIN</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="bc-side-col">
              <div className="bc-card">
                <h3>Leaderboard (by wins)</h3>
                {sortedPlayers.map((p, i) => (
                  <div key={p.id} className={`bc-score-row ${p.id === playerToken ? 'is-me' : ''}`}>
                    <span className="bc-rank">#{i+1}</span>
                    <span className="bc-pname">{p.name}</span>
                    <span className="bc-wins">{p.totalWins}W</span>
                  </div>
                ))}
              </div>
              {session.history.length > 0 && (
                <div className="bc-card">
                  <h3>Target History</h3>
                  <div className="bc-target-hist">
                    {session.history.map(r => (
                      <div key={r.round} className="bc-hist-row">
                        <span>R{r.round}</span>
                        <span>avg:{r.mean}</span>
                        <span className="bc-target">→{r.target}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="bc-card">
                <h3>Events</h3>
                <div className="bc-event-log">{[...session.eventLog].reverse().map((e, i) => <div key={i} className="bc-event">{e}</div>)}</div>
              </div>
              {isHost && (
                <div className="bc-card">
                  <h3>Host Controls</h3>
                  <p className="bc-desc">Ready: {session.stats.actedCount}/{session.stats.waitingCount}</p>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="bc-btn bc-btn-secondary" onClick={() => hostAction('advance')}>Force Advance</button>
                    <button className="bc-btn bc-btn-danger" onClick={() => hostAction('reset')}>Reset</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {session.phase === 'results' && (
          <div className="bc-card" style={{ maxWidth: 640, margin: '0 auto' }}>
            <h2>Game Complete!</h2>
            <p className="bc-desc">Nash equilibrium was 0. Did anyone converge?</p>
            {sortedPlayers.map((p, i) => (
              <div key={p.id} className={`bc-final-row ${i === 0 ? 'winner' : ''}`}>
                <span>{i === 0 ? '🏆' : `#${i+1}`}</span>
                <span style={{ flex: 1 }}>{p.name}</span>
                <span>{p.totalWins} win{p.totalWins !== 1 ? 's' : ''}</span>
              </div>
            ))}
            <h3 style={{ marginTop: '1.5rem' }}>Target Convergence</h3>
            <div className="bc-convergence">
              {session.history.map(r => (
                <div key={r.round} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <span style={{ width: '3rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>R{r.round}</span>
                  <div style={{ flex: 1, background: 'var(--border)', borderRadius: '4px', height: '20px', position: 'relative', overflow: 'hidden' }}>
                    <div style={{ width: `${r.target}%`, background: 'var(--accent)', height: '100%', borderRadius: '4px', transition: 'width 0.3s' }}></div>
                  </div>
                  <span style={{ width: '2.5rem', fontSize: '0.85rem', fontWeight: 700 }}>{r.target}</span>
                </div>
              ))}
            </div>
            {isHost && <button className="bc-btn bc-btn-secondary" onClick={() => hostAction('reset')} style={{ marginTop: '1.5rem' }}>Play Again</button>}
          </div>
        )}

        {error && <div className="bc-error">{error}</div>}
      </div></div>
    </MiniGameShell>
  )
}



