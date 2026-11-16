import { QRCodeSVG } from 'qrcode.react'
import { useEffect, useMemo, useState, useRef } from 'react'
import { getEducatorSessionCached, getEducatorSessionSync } from '../features/minigames/educatorSession'
import { MiniGameShell } from '../features/minigames/MiniGameShell'
import './EnglishAuctionMiniGamePage.css'
import '../features/minigames/SessionControlPanel.css'
import { educatorMiniGamesApi } from '../features/minigames/api'
import { MiniGameSessionsTable } from '../features/minigames/MiniGameSessionsTable'
import type { EducatorMiniGameSession } from '../api/client'

const STORAGE_KEY = 'english-auction_minigame_v1'
const GAME_SLUG = 'english-auction'

type Bidder = {
  id: string; name: string; isBot: boolean
  status: 'active' | 'dropped' | 'winner'; profit: number
  hasRespondedThisStep: boolean; dropPrice?: number
}
type AuctionRound = {
  round: number; winnerId?: string; winnerName?: string; winningPrice?: number
  winnerValue?: number; winnerProfit?: number; noWinner: boolean
  allValues?: Record<string, number>
}
type Session = {
  roomCode: string; phase: 'lobby' | 'playing' | 'results'
  currentRound: number; currentPrice: number; roundStep: 'bidding' | 'advancing' | 'roundComplete'
  config: { valueMin: number; valueMax: number; startingPrice: number; priceStep: number; rounds: number }
  bidders: Bidder[]; activeBidderCount: number; history: AuctionRound[]; eventLog: string[]
  viewer?: ViewerInfo | null
}
type ViewerInfo = { status: string; privateValue: number; profit: number; hasResponded: boolean }
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

export default function EnglishAuctionMiniGamePage() {
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
  const [viewerInfo, setViewerInfo] = useState<ViewerInfo | null>(null)
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
        setPlayerToken(null)
        setSession(null)
        setViewerInfo(null)
        setIsLobbyMode(true)
        setError('Your previous join session expired. Please join again.')
        return
      }
      setSession(data.session); setViewerInfo(data.session.viewer ?? null); setIsHost(data.isHost); setError(null)
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

  useEffect(() => {
    if (hasPublicJoinContext) return
    if (sessionsRefreshKey === 0) return
    const load = async () => {
      setSessionsFetching(true)
      try {
        const sessions = await educatorMiniGamesApi.listSessions()
        const latest = sessions.filter(s => s.gameType === 'english-auction').sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] || null
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

    setHostToken(null); setPlayerToken(null); setSession(null); setViewerInfo(null); setIsHost(false); setError(null); setIsLobbyMode(true)
  }

  async function submitBid(action: 'stay' | 'drop') {
    if (!roomCode || !playerToken) return
    try {
      const d = await api<{ session: Session }>(`/${GAME_SLUG}/${roomCode}/action`, { method: 'POST', body: JSON.stringify({ playerToken, action }) })
      setSession(d.session); setViewerInfo(d.session.viewer ?? null)
    } catch (e) { setError((e as Error).message) }
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
      <MiniGameShell title="English Auction" sessionsGameType="english-auction" publicMode={true}>
        <div className="ea-page"><div className="ea-shell">
          <div className="ea-hero mg-page-hero"><h1>🔨 English Auction</h1></div>
          <div className="ea-card" style={{ textAlign: 'center' }}>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>Educator login required. Students: enter room code to join.</p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <input className="ea-input" placeholder="Your name" value={nameInput} onChange={e => setNameInput(e.target.value)} />
              <input className="ea-input" placeholder="Room code" value={roomCodeInput} onChange={e => setRoomCodeInput(e.target.value.toUpperCase())} style={{ maxWidth: '140px' }} />
              <button className="ea-btn ea-btn-primary" onClick={joinGame} disabled={loading}>Join</button>
            </div>
            {error && <div className="ea-error">{error}</div>}
          </div>
        </div></div>
      </MiniGameShell>
    )
  }

  if (isLobbyMode && !session) {
    return (
      <MiniGameShell title="English Auction" subtitle="Ascending Bid Auction" sessionsGameType="english-auction" publicMode={hasPublicJoinContext}>
        <div className="ea-page"><div className="ea-shell">
          <div className="ea-hero mg-page-hero">
            <h1>🔨 English Auction</h1>
            <p className="ea-sub">Ascending-price auction. Each bidder has a private value. Stay or drop as price rises. Last bidder wins.</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
            <div className="ea-card" style={{ border: '1px solid var(--accent-blue)', background: 'rgba(59, 130, 246, 0.05)' }}>
              <h2 style={{ fontSize: '1rem', color: 'var(--accent-blue)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1rem' }}>🔨 How It Works</h2>
              <div style={{ fontSize: '0.95rem', lineHeight: '1.6', color: 'var(--text-primary)', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                <p>🎲 <strong>Private Values:</strong> Each bidder receives a secret value for the item — nobody knows anyone else's value.</p>
                <p>📈 <strong>Price Rises:</strong> The auctioneer starts at a low price and raises it step by step. Bidders choose to Stay or Drop Out.</p>
                <p>🏆 <strong>Last One Standing Wins:</strong> The final bidder who hasn't dropped out wins the item and pays the current price.</p>
                <p>🎯 <strong>Dominant Strategy:</strong> Drop when price exceeds your private value. Staying beyond your value means a loss!</p>
              </div>
              <p style={{ marginTop: '1.2rem', fontSize: '0.85rem', color: 'var(--accent-amber)', fontStyle: 'italic' }}>💡 Best with 4–10 bidders over 3+ rounds.</p>
            </div>
            <div className="ea-card">
              <div style={{ display: 'grid', gap: '0.65rem' }}>
                <button className="ea-btn ea-btn-primary" onClick={createGame} disabled={creatingSession}>
                  {creatingSession ? 'Creating...' : 'Create Session'}
                </button>
                <button className="ea-btn ea-btn-secondary" onClick={soloPlay} disabled={loading}>
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
                      <button className="ea-btn ea-btn-secondary" disabled={quickActionLoading !== null || latestSession.status !== 'LOBBY'} onClick={() => void runQuickAction('start')}>{quickActionLoading === 'start' ? 'Starting...' : latestSession.status === 'LOBBY' ? 'Start' : 'Started'}</button>
                      <button className="ea-btn ea-btn-secondary" disabled={quickActionLoading !== null || latestSession.status !== 'ACTIVE'} onClick={() => void runQuickAction('advance')}>{quickActionLoading === 'advance' ? 'Advancing...' : 'Advance'}</button>
                      <button className="ea-btn ea-btn-secondary" disabled={quickActionLoading !== null || (latestSession.status !== 'ACTIVE' && latestSession.status !== 'COMPLETED')} onClick={() => void runQuickAction('reset')}>{quickActionLoading === 'reset' ? 'Resetting...' : 'Reset'}</button>
                    </div>
                    {quickActionMessage && <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{quickActionMessage}</div>}
                  </div>
                )}
              </div>
            </div>
          </div>
          <MiniGameSessionsTable gameType="english-auction" refreshKey={sessionsRefreshKey} />
          {error && <div className="ea-error">{error}</div>}
        </div></div>
      </MiniGameShell>
    )
  }

  if (!session) return (
    <MiniGameShell title="English Auction" sessionsGameType="english-auction" publicMode={hasPublicJoinContext}>
      <div className="ea-page"><div className="ea-shell"><div className="ea-loading">Loading...</div></div></div>
    </MiniGameShell>
  )

  const myBidder = session.bidders.find(b => b.id === playerToken)
  const isActive = myBidder?.status === 'active'
  const hasResponded = viewerInfo?.hasResponded || myBidder?.hasRespondedThisStep
  const privateValue = viewerInfo?.privateValue
  const sortedBidders = [...session.bidders].sort((a, b) => b.profit - a.profit)
  const lastRound = session.history[session.history.length - 1]

  return (
    <MiniGameShell title="English Auction" subtitle="Ascending Bid Auction" sessionsGameType="english-auction" publicMode={hasPublicJoinContext}>
      <div className="ea-page"><div className="ea-shell">
        <div className="ea-hero mg-page-hero">
          <h1>🔨 English Auction</h1>
          <p className="ea-sub">Room: <strong>{session.roomCode}</strong> · Round {session.currentRound}/{session.config.rounds} · {session.phase.toUpperCase()}</p>
        </div>

        <div className="ea-card" style={{ border: '1px solid var(--accent-blue)', background: 'rgba(59, 130, 246, 0.05)', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1rem', color: 'var(--accent-blue)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1rem' }}>🔨 How It Works</h2>
          <div style={{ fontSize: '0.95rem', lineHeight: '1.6', color: 'var(--text-primary)', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
            <p>🎲 <strong>Private Values:</strong> Each bidder receives a secret value for the item — nobody knows anyone else's value.</p>
            <p>📈 <strong>Price Rises:</strong> The auctioneer starts at a low price and raises it step by step. Bidders choose to Stay or Drop Out.</p>
            <p>🏆 <strong>Last One Standing Wins:</strong> The final bidder who hasn't dropped out wins the item and pays the current price.</p>
            <p>🎯 <strong>Dominant Strategy:</strong> Drop when price exceeds your private value. Staying beyond your value means a loss!</p>
          </div>
          <p style={{ marginTop: '1.2rem', fontSize: '0.85rem', color: 'var(--accent-amber)', fontStyle: 'italic' }}>💡 Best with 4–10 bidders over 3+ rounds.</p>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
          <button className="ea-btn ea-btn-secondary" onClick={leaveGame} style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}>← Leave Game</button>
        </div>

        {session.phase === 'lobby' && (
          <div className="ea-card" style={{ maxWidth: 520, margin: '0 auto' }}>
            <h2>{isHost ? 'Waiting for Bidders' : 'Waiting for Host to Start'}</h2>
            <p className="ea-desc">Share code: <strong className="ea-room-code">{session.roomCode}</strong></p>
            <div className="ea-bidders-list">{session.bidders.map(b => <div key={b.id} className="ea-chip">{b.name}</div>)}</div>
            {isHost && <button className="ea-btn ea-btn-primary" onClick={() => hostAction('start')} disabled={session.bidders.length < 2} style={{ marginTop: '1rem' }}>Start Auction ({session.bidders.length} bidders)</button>}
            {playerToken && !isHost && (
              <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>You've joined — waiting for the host to start the game.</p>
            )}
            {!isHost && !playerToken && (
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
                <input className="ea-input" placeholder="Your name" value={nameInput} onChange={e => setNameInput(e.target.value)} />
                <button className="ea-btn ea-btn-secondary" onClick={joinGame}>Join</button>
              </div>
            )}
          </div>
        )}

        {session.phase === 'playing' && (
          <div className="ea-game-grid">
            <div className="ea-main-col">
              {/* Price display */}
              <div className="ea-card ea-price-card">
                <div className="ea-price-display">
                  <div>
                    <span className="ea-price-label">Current Price</span>
                    <span className="ea-current-price">{session.currentPrice}</span>
                  </div>
                  <div>
                    <span className="ea-price-label">Active Bidders</span>
                    <span className="ea-active-count">{session.activeBidderCount}</span>
                  </div>
                  {privateValue !== undefined && (
                    <div>
                      <span className="ea-price-label">Your Value</span>
                      <span className="ea-private-val" style={{ color: session.currentPrice > privateValue ? '#ef4444' : '#16a34a' }}>{privateValue}</span>
                    </div>
                  )}
                  {privateValue !== undefined && (
                    <div>
                      <span className="ea-price-label">Surplus if win</span>
                      <span className="ea-surplus">{Math.max(0, privateValue - session.currentPrice)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Bidder action */}
              {playerToken && myBidder && session.roundStep === 'bidding' && (
                <div className="ea-card">
                  <h3>Round {session.currentRound} — Price: {session.currentPrice}</h3>
                  {myBidder.status === 'dropped' ? (
                    <div className="ea-dropped">You dropped out at price {myBidder.dropPrice}. Watching...</div>
                  ) : myBidder.status === 'winner' ? (
                    <div className="ea-winner-msg">🏆 You won this round!</div>
                  ) : hasResponded ? (
                    <div className="ea-waiting">Response submitted. Waiting for others...</div>
                  ) : (
                    <>
                      <p className="ea-desc">
                        Current price: <strong>{session.currentPrice}</strong>.
                        {privateValue !== undefined && ` Your value: ${privateValue}.`}
                        {privateValue !== undefined && session.currentPrice > privateValue && ' ⚠️ Price exceeds your value!'}
                      </p>
                      <div className="ea-bid-btns">
                        <button className="ea-btn ea-btn-stay" onClick={() => submitBid('stay')}>✋ Stay In</button>
                        <button className="ea-btn ea-btn-drop" onClick={() => submitBid('drop')}>🚪 Drop Out</button>
                      </div>
                    </>
                  )}
                </div>
              )}

              {session.roundStep === 'advancing' && isHost && (
                <div className="ea-card">
                  <h3>All responded — Advance Price?</h3>
                  <p className="ea-desc">Current price: {session.currentPrice}. Raise by {session.config.priceStep}?</p>
                  <button className="ea-btn ea-btn-primary" onClick={() => hostAction('advance')}>Raise Price to {session.currentPrice + session.config.priceStep}</button>
                </div>
              )}

              {session.roundStep === 'advancing' && !isHost && (
                <div className="ea-card"><div className="ea-waiting">Waiting for host to advance price...</div></div>
              )}

              {lastRound && (
                <div className="ea-card">
                  <h3>Round {lastRound.round} Result</h3>
                  {lastRound.noWinner ? (
                    <p className="ea-desc">No winner — all bidders dropped.</p>
                  ) : (
                    <div className="ea-round-result">
                      <div className="ea-result-item"><span className="ea-result-label">Winner</span><span className="ea-result-val">{lastRound.winnerName}</span></div>
                      <div className="ea-result-item"><span className="ea-result-label">Winning Price</span><span className="ea-result-val">{lastRound.winningPrice}</span></div>
                      <div className="ea-result-item"><span className="ea-result-label">True Value</span><span className="ea-result-val">{lastRound.winnerValue}</span></div>
                      <div className="ea-result-item"><span className="ea-result-label">Profit</span><span className="ea-result-val" style={{ color: '#16a34a' }}>{lastRound.winnerProfit}</span></div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="ea-side-col">
              <div className="ea-card">
                <h3>Bidder Status</h3>
                {session.bidders.map(b => (
                  <div key={b.id} className={`ea-bidder-row ${b.id === playerToken ? 'is-me' : ''}`}>
                    <span className={`ea-status-dot ea-status-${b.status}`}></span>
                    <span className="ea-bname">{b.name}</span>
                    <span className="ea-bstatus">{b.status === 'dropped' ? `out@${b.dropPrice}` : b.status}</span>
                    <span className="ea-bprofit">{b.profit}</span>
                  </div>
                ))}
              </div>
              <div className="ea-card">
                <h3>Events</h3>
                <div className="ea-event-log">{[...session.eventLog].reverse().map((e, i) => <div key={i} className="ea-event">{e}</div>)}</div>
              </div>
              {isHost && (
                <div className="ea-card">
                  <h3>Host Controls</h3>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="ea-btn ea-btn-secondary" onClick={() => hostAction('advance')}>Advance Price</button>
                    <button className="ea-btn ea-btn-danger" onClick={() => hostAction('reset')}>Reset</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {session.phase === 'results' && (
          <div className="ea-card" style={{ maxWidth: 640, margin: '0 auto' }}>
            <h2>Auction Complete!</h2>
            <div style={{ marginBottom: '1.5rem' }}>
              {sortedBidders.map((b, i) => (
                <div key={b.id} className={`ea-final-row ${i === 0 ? 'winner' : ''}`}>
                  <span>{i === 0 ? '🏆' : `#${i+1}`}</span><span style={{ flex: 1 }}>{b.name}</span><span>{b.profit} profit</span>
                </div>
              ))}
            </div>
            <h3>Round History</h3>
            {session.history.map(r => (
              <div key={r.round} className="ea-hist-row">
                <span>R{r.round}</span>
                {r.noWinner ? <span>No winner</span> : <><span>{r.winnerName} won</span><span>@{r.winningPrice}</span><span>(value {r.winnerValue})</span></>}
              </div>
            ))}
            {isHost && <button className="ea-btn ea-btn-secondary" onClick={() => hostAction('reset')} style={{ marginTop: '1.5rem' }}>Play Again</button>}
          </div>
        )}

        {error && <div className="ea-error">{error}</div>}
      </div></div>
    </MiniGameShell>
  )
}



