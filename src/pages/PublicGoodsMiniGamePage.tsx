import { QRCodeSVG } from 'qrcode.react'
import { useEffect, useMemo, useState, useRef } from 'react'
import { getEducatorSessionCached, getEducatorSessionSync } from '../features/minigames/educatorSession'
import { MiniGameShell } from '../features/minigames/MiniGameShell'
import './PublicGoodsMiniGamePage.css'
import '../features/minigames/SessionControlPanel.css'
import { educatorMiniGamesApi } from '../features/minigames/api'
import { MiniGameSessionsTable } from '../features/minigames/MiniGameSessionsTable'
import type { EducatorMiniGameSession } from '../api/client'

const STORAGE_KEY = 'public-goods_minigame_v1'
const GAME_SLUG = 'public-goods'

type Player = { id: string; name: string; isBot: boolean; totalScore: number; hasActedThisRound: boolean }
type RoundSummary = {
  round: number; totalContributed: number; publicGoodShare: number; avgContribution: number
  contributions: Record<string, number>; payoffs: Record<string, number>
}
type Session = {
  roomCode: string; phase: 'lobby' | 'playing' | 'results'
  currentRound: number; config: { endowment: number; multiplier: number; rounds: number }
  players: Player[]; history: RoundSummary[]; eventLog: string[]
  stats: { actedCount: number; waitingCount: number }
  viewer?: Viewer | null
}
type Viewer = { totalScore: number; hasActed: boolean }
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

export default function PublicGoodsMiniGamePage() {
  const saved = useMemo(loadTokens, [])
  const query = useMemo(() => new URLSearchParams(window.location.search), [])
  const inviteToken = (query.get('invite') || '').trim()
  const roomFromUrl = (query.get('room') || '').toUpperCase()
  const nameFromUrl = query.get('name') || ''
  const hostTokenFromUrl = query.get('hostToken') || ''
  const forcePlayerContextFromUrl = Boolean(roomFromUrl && !hostTokenFromUrl)
  const hasPublicJoinContext = Boolean(inviteToken || roomFromUrl || hostTokenFromUrl)

  const [roomCodeInput, setRoomCodeInput] = useState(roomFromUrl || saved.roomCode)
  const [nameInput, setNameInput] = useState(nameFromUrl || saved.playerName || '')
  const [hostToken, setHostToken] = useState<string | null>(hostTokenFromUrl || (forcePlayerContextFromUrl ? null : saved.hostToken))
  const [playerToken, setPlayerToken] = useState<string | null>(forcePlayerContextFromUrl ? null : saved.playerToken)
  const [session, setSession] = useState<Session | null>(null)
  const [viewer, setViewer] = useState<Viewer | null>(null)
  const [isHost, setIsHost] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isLobbyMode, setIsLobbyMode] = useState(!hostTokenFromUrl)
  const [canAccessSetup, setCanAccessSetup] = useState(() => hostTokenFromUrl ? true : roomFromUrl ? false : (getEducatorSessionSync()?.ok ?? false))
  const [authChecked, setAuthChecked] = useState(() => hasPublicJoinContext || getEducatorSessionSync() !== null)
  const [contribution, setContribution] = useState(10)
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
      const currentViewer = data.session.viewer ?? null
      if (playerToken && !hostToken && !currentViewer) {
        // Stored token is stale for this room; clear it so the user can join again.
        setPlayerToken(null)
      }
      setSession(data.session); setViewer(currentViewer); setIsHost(data.isHost); setError(null)
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
    if (!roomFromUrl) return
    if (hostTokenFromUrl) return
    if (session || hostToken || playerToken) return

    autoJoinAttemptedRef.current = true
    setLoading(true)
    setError(null)
    void (async () => {
      try {
        const code = roomFromUrl.trim().toUpperCase()
        const joinName = (nameFromUrl || nameInput || 'Player').trim() || 'Player'
        const d = await api<{ playerToken: string; session: Session }>(
          `/${GAME_SLUG}/${code}/join`,
          { method: 'POST', body: JSON.stringify({ name: joinName }) },
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
  }, [roomFromUrl, nameFromUrl, nameInput, hostTokenFromUrl, session, hostToken, playerToken])

  function leaveGame() {
    fetchGuardRef.current += 1
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
    saveTokens(EMPTY_TOKENS)

    setHostToken(null); setPlayerToken(null); setSession(null); setViewer(null); setIsHost(false); setError(null); setIsLobbyMode(true)
  }

  async function submitContribution() {
    if (!roomCode || !playerToken) return
    try {
      const d = await api<{ session: Session }>(`/${GAME_SLUG}/${roomCode}/action`, { method: 'POST', body: JSON.stringify({ playerToken, amount: contribution }) })
      setSession(d.session); setViewer(d.session.viewer ?? null)
    } catch (e) { setError((e as Error).message) }
  }

  const multiplier = session?.config.multiplier || 1.6

  useEffect(() => {
    if (hasPublicJoinContext) return
    if (sessionsRefreshKey === 0) return
    const load = async () => {
      setSessionsFetching(true)
      try {
        const sessions = await educatorMiniGamesApi.listSessions()
        const latest = sessions.filter(s => s.gameType === 'public-goods').sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] || null
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
      <MiniGameShell title="Public Goods Game" sessionsGameType="public-goods" publicMode={true}>
        <div className="pg-page"><div className="pg-shell">
          <div className="pg-hero mg-page-hero"><h1>🌐 Public Goods Game</h1></div>
          <div className="pg-card" style={{ textAlign: 'center' }}>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>Educator login required to create. Students: enter room code to join.</p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <input className="pg-input" placeholder="Your name" value={nameInput} onChange={e => setNameInput(e.target.value)} />
              <input className="pg-input" placeholder="Room code" value={roomCodeInput} onChange={e => setRoomCodeInput(e.target.value.toUpperCase())} style={{ maxWidth: '140px' }} />
              <button className="pg-btn pg-btn-primary" onClick={joinGame} disabled={loading}>Join</button>
            </div>
            {error && <div className="pg-error">{error}</div>}
          </div>
        </div></div>
      </MiniGameShell>
    )
  }

  if (isLobbyMode && !session) {
    return (
      <MiniGameShell title="Public Goods Game" subtitle="Free-Rider Problem" sessionsGameType="public-goods" publicMode={hasPublicJoinContext}>
        <div className="pg-page"><div className="pg-shell">
          <div className="pg-hero mg-page-hero">
            <h1>🌐 Public Goods Game</h1>
            <p className="pg-sub">Each player has tokens. Contribute to the public good — total is multiplied and shared equally. Will you cooperate or free-ride?</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
            <div className="pg-card" style={{ border: '1px solid var(--accent-blue)', background: 'rgba(59, 130, 246, 0.05)' }}>
              <h2 style={{ fontSize: '1rem', color: 'var(--accent-blue)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1rem' }}>🌐 How It Works</h2>
              <div style={{ fontSize: '0.95rem', lineHeight: '1.6', color: 'var(--text-primary)', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                <p>💰 <strong>Your Endowment:</strong> Each player starts with 20 tokens every round. Decide how much to keep vs. contribute.</p>
                <p>✖️ <strong>The Multiplier:</strong> All contributions are pooled, multiplied (×1.6), then split equally among all players.</p>
                <p>🆓 <strong>The Free-Rider Problem:</strong> If everyone contributes, everyone benefits. But you earn more by keeping tokens while others contribute.</p>
                <p>📉 <strong>The Tragedy:</strong> If everyone free-rides, the public good collapses and everyone is worse off than if all cooperated.</p>
              </div>
              <p style={{ marginTop: '1.2rem', fontSize: '0.85rem', color: 'var(--accent-amber)', fontStyle: 'italic' }}>💡 Best with 4–8 players over 5+ rounds.</p>
            </div>
            <div className="pg-card">
              <div style={{ display: 'grid', gap: '0.65rem' }}>
                <button className="pg-btn pg-btn-primary" onClick={createGame} disabled={creatingSession}>
                  {creatingSession ? 'Creating...' : 'Create Session'}
                </button>
                <button className="pg-btn pg-btn-secondary" onClick={soloPlay} disabled={loading}>
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
                      <button className="pg-btn pg-btn-secondary" disabled={quickActionLoading !== null || latestSession.status !== 'LOBBY'} onClick={() => void runQuickAction('start')}>{quickActionLoading === 'start' ? 'Starting...' : latestSession.status === 'LOBBY' ? 'Start' : 'Started'}</button>
                      <button className="pg-btn pg-btn-secondary" disabled={quickActionLoading !== null || latestSession.status !== 'ACTIVE'} onClick={() => void runQuickAction('advance')}>{quickActionLoading === 'advance' ? 'Advancing...' : 'Advance'}</button>
                      <button className="pg-btn pg-btn-secondary" disabled={quickActionLoading !== null || (latestSession.status !== 'ACTIVE' && latestSession.status !== 'COMPLETED')} onClick={() => void runQuickAction('reset')}>{quickActionLoading === 'reset' ? 'Resetting...' : 'Reset'}</button>
                    </div>
                    {quickActionMessage && <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{quickActionMessage}</div>}
                  </div>
                )}
              </div>
            </div>
          </div>
          <MiniGameSessionsTable gameType="public-goods" refreshKey={sessionsRefreshKey} />
          {error && <div className="pg-error">{error}</div>}
        </div></div>
      </MiniGameShell>
    )
  }

  if (!session) return (
    <MiniGameShell title="Public Goods Game" sessionsGameType="public-goods" publicMode={hasPublicJoinContext}>
      <div className="pg-page"><div className="pg-shell"><div className="pg-loading">Loading...</div></div></div>
    </MiniGameShell>
  )

  const myPlayer = session.players.find(p => p.id === playerToken)
  const sortedPlayers = [...session.players].sort((a, b) => b.totalScore - a.totalScore)
  const lastRound = session.history[session.history.length - 1]
  const myContrib = lastRound && myPlayer ? lastRound.contributions[myPlayer.id] : undefined

  return (
    <MiniGameShell title="Public Goods Game" subtitle="Free-Rider Problem" sessionsGameType="public-goods" publicMode={hasPublicJoinContext}>
      <div className="pg-page"><div className="pg-shell">
        <div className="pg-hero mg-page-hero">
          <h1>🌐 Public Goods Game</h1>
          <p className="pg-sub">Room: <strong>{session.roomCode}</strong> · Round {session.currentRound}/{session.config.rounds} · {session.phase.toUpperCase()}</p>
        </div>

        <div className="pg-card" style={{ border: '1px solid var(--accent-blue)', background: 'rgba(59, 130, 246, 0.05)', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1rem', color: 'var(--accent-blue)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1rem' }}>🌐 How It Works</h2>
          <div style={{ fontSize: '0.95rem', lineHeight: '1.6', color: 'var(--text-primary)', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
            <p>💰 <strong>Your Endowment:</strong> Each player starts with 20 tokens every round. Decide how much to keep vs. contribute.</p>
            <p>✖️ <strong>The Multiplier:</strong> All contributions are pooled, multiplied (×1.6), then split equally among all players.</p>
            <p>🆓 <strong>The Free-Rider Problem:</strong> If everyone contributes, everyone benefits. But you earn more by keeping tokens while others contribute.</p>
            <p>📉 <strong>The Tragedy:</strong> If everyone free-rides, the public good collapses and everyone is worse off than if all cooperated.</p>
          </div>
          <p style={{ marginTop: '1.2rem', fontSize: '0.85rem', color: 'var(--accent-amber)', fontStyle: 'italic' }}>💡 Best with 4–8 players over 5+ rounds.</p>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
          <button className="pg-btn pg-btn-secondary" onClick={leaveGame} style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}>← Leave Game</button>
        </div>

        {session.phase === 'lobby' && (
          <div className="pg-card" style={{ maxWidth: 520, margin: '0 auto' }}>
            <h2>{isHost ? 'Waiting for Players' : 'Waiting for Host to Start'}</h2>
            <p className="pg-desc">Share code: <strong className="pg-room-code">{session.roomCode}</strong></p>
            <div className="pg-players-list">{session.players.map(p => <div key={p.id} className="pg-chip">{p.name}</div>)}</div>
            {isHost && <button className="pg-btn pg-btn-primary" onClick={() => hostAction('start')} disabled={session.players.length < 2} style={{ marginTop: '1rem' }}>Start ({session.players.length} players)</button>}
            {playerToken && !isHost && (
              <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>You've joined — waiting for the host to start the game.</p>
            )}
            {!isHost && !playerToken && (
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
                <input className="pg-input" placeholder="Your name" value={nameInput} onChange={e => setNameInput(e.target.value)} />
                <button className="pg-btn pg-btn-secondary" onClick={joinGame}>Join</button>
              </div>
            )}
          </div>
        )}

        {session.phase === 'playing' && (
          <div className="pg-game-grid">
            <div className="pg-main-col">
              <div className="pg-card pg-info-card">
                <div className="pg-info-row">
                  <div className="pg-info-item"><span className="pg-info-label">Round</span><span className="pg-info-val">{session.currentRound}/{session.config.rounds}</span></div>
                  <div className="pg-info-item"><span className="pg-info-label">Endowment</span><span className="pg-info-val">{session.config.endowment} tokens</span></div>
                  <div className="pg-info-item"><span className="pg-info-label">Multiplier</span><span className="pg-info-val">×{session.config.multiplier}</span></div>
                  <div className="pg-info-item"><span className="pg-info-label">Players</span><span className="pg-info-val">{session.players.length}</span></div>
                </div>
              </div>

              {playerToken && myPlayer && (
                <div className="pg-card">
                  <h3>Your Contribution — Round {session.currentRound}</h3>
                  {viewer?.hasActed ? (
                    <div className="pg-waiting">
                      Contribution submitted. Waiting for others ({session.stats.actedCount}/{session.stats.waitingCount} ready)...
                    </div>
                  ) : (
                    <>
                      <p className="pg-desc">You have <strong>{session.config.endowment} tokens</strong>. How much do you contribute to the public good?</p>
                      <p className="pg-desc" style={{ fontSize: '0.8rem' }}>Payoff = (kept) + (×{multiplier} × total / {session.players.length} players)</p>
                      <input type="range" min={0} max={session.config.endowment} value={contribution} onChange={e => setContribution(Number(e.target.value))} style={{ width: '100%', margin: '1rem 0' }} />
                      <div className="pg-contrib-preview">
                        <div className="pg-contrib-box"><span className="pg-contrib-label">Keep</span><span className="pg-contrib-val">{session.config.endowment - contribution}</span></div>
                        <div className="pg-contrib-arrow">→</div>
                        <div className="pg-contrib-box pg-contrib-public"><span className="pg-contrib-label">Contribute</span><span className="pg-contrib-val">{contribution}</span></div>
                      </div>
                      <button className="pg-btn pg-btn-primary" onClick={submitContribution} style={{ width: '100%', marginTop: '1rem' }}>
                        Submit Contribution of {contribution}
                      </button>
                    </>
                  )}
                </div>
              )}

              {lastRound && (
                <div className="pg-card">
                  <h3>Round {lastRound.round} Results</h3>
                  <div className="pg-round-stats">
                    <div className="pg-stat"><span className="pg-stat-label">Total contributed</span><span className="pg-stat-val">{lastRound.totalContributed}</span></div>
                    <div className="pg-stat"><span className="pg-stat-label">Avg contribution</span><span className="pg-stat-val">{lastRound.avgContribution}</span></div>
                    <div className="pg-stat"><span className="pg-stat-label">Public good/player</span><span className="pg-stat-val">{lastRound.publicGoodShare}</span></div>
                    {myContrib !== undefined && <div className="pg-stat"><span className="pg-stat-label">Your contribution</span><span className="pg-stat-val">{myContrib}</span></div>}
                  </div>
                </div>
              )}
            </div>

            <div className="pg-side-col">
              <div className="pg-card">
                <h3>Scoreboard</h3>
                {sortedPlayers.map((p, i) => (
                  <div key={p.id} className={`pg-score-row ${p.id === playerToken ? 'is-me' : ''}`}>
                    <span className="pg-rank">#{i+1}</span><span className="pg-pname">{p.name}</span><span className="pg-pts">{Math.round(p.totalScore * 10) / 10}</span>
                  </div>
                ))}
              </div>
              {session.history.length > 0 && (
                <div className="pg-card">
                  <h3>Contribution History</h3>
                  <div className="pg-history">
                    {session.history.map(r => (
                      <div key={r.round} className="pg-hist-row">
                        <span>R{r.round}</span>
                        <span>Avg: {r.avgContribution}</span>
                        <span>Pool/player: {r.publicGoodShare}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="pg-card">
                <h3>Events</h3>
                <div className="pg-event-log">{[...session.eventLog].reverse().map((e, i) => <div key={i} className="pg-event">{e}</div>)}</div>
              </div>
              {isHost && (
                <div className="pg-card">
                  <h3>Host Controls</h3>
                  <p className="pg-desc">Ready: {session.stats.actedCount}/{session.stats.waitingCount}</p>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="pg-btn pg-btn-secondary" onClick={() => hostAction('advance')}>Force Advance</button>
                    <button className="pg-btn pg-btn-danger" onClick={() => hostAction('reset')}>Reset</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {session.phase === 'results' && (
          <div className="pg-card" style={{ maxWidth: 640, margin: '0 auto' }}>
            <h2>Game Complete!</h2>
            <div style={{ marginBottom: '1.5rem' }}>
              {sortedPlayers.map((p, i) => (
                <div key={p.id} className={`pg-final-row ${i === 0 ? 'winner' : ''}`}>
                  <span>{i === 0 ? '🏆' : `#${i+1}`}</span>
                  <span style={{ flex: 1 }}>{p.name}</span>
                  <span>{Math.round(p.totalScore * 10) / 10} pts</span>
                </div>
              ))}
            </div>
            <div>
              <h3>Round History</h3>
              {session.history.map(r => (
                <div key={r.round} className="pg-hist-row">
                  <span>R{r.round}</span><span>Total: {r.totalContributed}</span><span>Avg: {r.avgContribution}</span><span>Share: {r.publicGoodShare}</span>
                </div>
              ))}
            </div>
            {isHost && <button className="pg-btn pg-btn-secondary" onClick={() => hostAction('reset')} style={{ marginTop: '1.5rem' }}>Play Again</button>}
          </div>
        )}

        {error && <div className="pg-error">{error}</div>}
      </div></div>
    </MiniGameShell>
  )
}



