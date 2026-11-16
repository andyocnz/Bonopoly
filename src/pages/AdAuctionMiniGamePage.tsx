import { QRCodeSVG } from 'qrcode.react'
import { useEffect, useMemo, useState, useRef } from 'react'
import { getEducatorSessionCached, getEducatorSessionSync } from '../features/minigames/educatorSession'
import { MiniGameShell } from '../features/minigames/MiniGameShell'
import { educatorMiniGamesApi } from '../features/minigames/api'
import { MiniGameSessionsTable } from '../features/minigames/MiniGameSessionsTable'
import type { EducatorMiniGameSession } from '../api/client'
import './AdAuctionMiniGamePage.css'
import '../features/minigames/SessionControlPanel.css'

const STORAGE_KEY = 'ad-auction_minigame_v1'
const GAME_SLUG = 'ad-auction'

type AuctionKeyword = {
  id: string; keyword: string; context: string
  clicksAvailable: number; revenuePerConversion: number
  conversionRate?: number; floorPriceCents: number
}
type AuctionPlayer = {
  id: string; name: string; budgetCents: number; totalProfitCents: number; hasBidThisRound: boolean
}
type RoundResult = {
  round: number; keyword: AuctionKeyword
  bids: Record<string, number>
  winnerId: string | null; winnerName: string | null
  pricePaidCents: number; clicks: number; conversions: number
  winnerRevenueCents: number; winnerCostCents: number; winnerProfitCents: number
  breakEvenBidCents: number
}
type Session = {
  roomCode: string; phase: 'lobby' | 'bidding' | 'results' | 'done'
  currentRound: number; config: { rounds: number; startingBudgetCents: number }
  players: AuctionPlayer[]
  currentKeyword: AuctionKeyword | null
  currentBids?: Record<string, number>
  history: RoundResult[]
  eventLog: string[]
  stats: { bidsIn: number; total: number }
  viewer: { budgetCents: number; totalProfitCents: number; hasBid: boolean; myBid?: number } | null
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

function fmt(cents: number, sign = false) {
  const val = `$${(Math.abs(cents) / 100).toFixed(2)}`
  if (!sign) return cents < 0 ? `-${val}` : val
  return cents >= 0 ? `+${val}` : `-${val}`
}

export default function AdAuctionMiniGamePage() {
  const saved = useMemo(loadTokens, [])
  const query = useMemo(() => new URLSearchParams(window.location.search), [])
  const roomFromUrl = (query.get('room') || '').toUpperCase()
  const nameFromUrl = query.get('name') || ''
  const hostTokenFromUrl = query.get('hostToken') || ''
  const forcePlayerJoinFromUrl = Boolean(roomFromUrl && nameFromUrl && !hostTokenFromUrl)
  const hasPublicJoinContext = Boolean(roomFromUrl || hostTokenFromUrl)

  const [roomCodeInput, setRoomCodeInput] = useState(roomFromUrl || saved.roomCode)
  const [nameInput, setNameInput] = useState(nameFromUrl || saved.playerName || '')
  const [hostToken, setHostToken] = useState<string | null>(hostTokenFromUrl || saved.hostToken)
  const [playerToken, setPlayerToken] = useState<string | null>(forcePlayerJoinFromUrl ? null : saved.playerToken)
  const [session, setSession] = useState<Session | null>(null)
  const [isHost, setIsHost] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isLobbyMode, setIsLobbyMode] = useState(!hostTokenFromUrl)
  const [canAccessSetup, setCanAccessSetup] = useState(() => hostTokenFromUrl ? true : roomFromUrl ? false : (getEducatorSessionSync()?.ok ?? false))
  const [authChecked, setAuthChecked] = useState(() => hasPublicJoinContext || getEducatorSessionSync() !== null)
  const [bidInput, setBidInput] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [sessionsRefreshKey, setSessionsRefreshKey] = useState(0)
  const [creatingSession, setCreatingSession] = useState(false)
  const [sessionsFetching, setSessionsFetching] = useState(false)
  const [latestSession, setLatestSession] = useState<EducatorMiniGameSession | null>(null)
  const [joinedPlayers, setJoinedPlayers] = useState<string[]>([])
  const [startingSolo, setStartingSolo] = useState(false)
  const [quickActionLoading, setQuickActionLoading] = useState<'start' | 'advance' | 'reset' | null>(null)
  const [quickActionMessage, setQuickActionMessage] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const fetchGuardRef = useRef(0)
  const autoJoinAttemptedRef = useRef(false)

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
        setSession(null)
        setIsHost(false)
        setIsLobbyMode(true)
        setError('Session expired. Please join again.')
        return
      }
      setSession(prev => {
        if (prev?.currentRound !== data.session.currentRound || prev?.phase !== data.session.phase) {
          setBidInput('')
        }
        return data.session
      })
      setIsHost(data.isHost)
      setError(null)
    } catch (e) { if (fetchGuardRef.current === guard) setError((e as Error).message) }
  }

  useEffect(() => {
    if (!roomCode || (!hostToken && !playerToken)) return
    void fetchState()
    pollRef.current = setInterval(() => void fetchState(), 2000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [roomCode, hostToken, playerToken])

  useEffect(() => {
    if (hasPublicJoinContext) return
    if (sessionsRefreshKey === 0) return
    const load = async () => {
      setSessionsFetching(true)
      try {
        const sessions = await educatorMiniGamesApi.listSessions()
        const latest = sessions
          .filter(s => s.gameType === 'ad-auction')
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] || null
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
      await api<{ roomCode: string; hostToken: string; session: Session }>(`/${GAME_SLUG}/create`, {
        method: 'POST',
        body: JSON.stringify({}),
      })
      setSessionsRefreshKey(v => v + 1)
    } catch (e) { setError((e as Error).message) } finally { setCreatingSession(false) }
  }

  async function soloPlay() {
    setStartingSolo(true); setError(null)
    try {
      const d = await api<{ roomCode: string; hostToken: string; playerToken: string; session: Session }>(`/${GAME_SLUG}/solo`, {
        method: 'POST',
        body: JSON.stringify({ name: 'Host' }),
      })
      setHostToken(d.hostToken)
      setPlayerToken(d.playerToken)
      setSession(d.session)
      setRoomCodeInput(d.roomCode)
      setIsHost(true)
      setIsLobbyMode(false)
    } catch (e) { setError((e as Error).message) } finally { setStartingSolo(false) }
  }

  async function joinGame() {
    if (!nameInput.trim()) { setError('Enter your name'); return }
    if (!roomCodeInput.trim()) { setError('Enter room code'); return }
    setLoading(true); setError(null)
    try {
      const d = await api<{ playerToken: string; session: Session }>(`/${GAME_SLUG}/${roomCodeInput.toUpperCase()}/join`, {
        method: 'POST', body: JSON.stringify({ name: nameInput }),
      })
      setPlayerToken(d.playerToken); setIsLobbyMode(false); setSession(d.session)
    } catch (e) { setError((e as Error).message) } finally { setLoading(false) }
  }

  async function hostAction(action: string) {
    if (!roomCode || !hostToken) return
    try {
      const d = await api<{ session: Session }>(`/${GAME_SLUG}/${roomCode}/${action}`, {
        method: 'POST', body: JSON.stringify({ hostToken }),
      })
      setSession(d.session)
    } catch (e) { setError((e as Error).message) }
  }

  async function submitBid() {
    if (!roomCode || !playerToken || submitting) return
    const bidDollars = parseFloat(bidInput)
    if (isNaN(bidDollars) || bidDollars < 0) { setError('Enter a valid bid (≥ $0.00)'); return }
    const bidCents = Math.round(bidDollars * 100)
    setSubmitting(true); setError(null)
    try {
      const d = await api<{ session: Session }>(`/${GAME_SLUG}/${roomCode}/action`, {
        method: 'POST', body: JSON.stringify({ playerToken, bidCents }),
      })
      setSession(d.session); setBidInput('')
    } catch (e) { setError((e as Error).message) } finally { setSubmitting(false) }
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

    setHostToken(null); setPlayerToken(null); setSession(null)
    setIsHost(false); setError(null); setIsLobbyMode(true); setBidInput('')
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
      <MiniGameShell title="Ad Auction" publicMode>
        <div className="aa-page"><div className="aa-shell">
          <div className="aa-hero mg-page-hero"><h1>📢 Ad Auction</h1></div>
          <div className="aa-card" style={{ textAlign: 'center' }}>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>Educator login required to create. Students: enter room code to join.</p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <input className="aa-input" style={{ maxWidth: 180 }} placeholder="Your name" value={nameInput} onChange={e => setNameInput(e.target.value)} />
              <input className="aa-input" style={{ maxWidth: 140 }} placeholder="Room code" value={roomCodeInput} onChange={e => setRoomCodeInput(e.target.value.toUpperCase())} />
              <button className="aa-btn aa-btn-primary" onClick={() => void joinGame()} disabled={loading}>Join</button>
            </div>
            {error && <div className="aa-error">{error}</div>}
          </div>
        </div></div>
      </MiniGameShell>
    )
  }

  if (isLobbyMode && !session) {
    return (
      <MiniGameShell title="Ad Auction" subtitle="Search Advertising" sessionsGameType="ad-auction" publicMode={hasPublicJoinContext}>
        <div className="aa-page"><div className="aa-shell">
          <div className="aa-hero mg-page-hero">
            <h1>📢 Ad Auction</h1>
            <p>Bid on keywords. Win clicks. Maximise profit. Learn why second-price auctions work.</p>
          </div>
          <div className="aa-grid-2">
            <div className="aa-card" style={{ borderColor: 'rgba(37,99,235,0.3)', background: 'rgba(37,99,235,0.03)' }}>
              <h2 style={{ fontSize: '0.95rem', color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.75rem' }}>📢 How It Works</h2>
              <div style={{ fontSize: '0.9rem', lineHeight: 1.65, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <p>Each round, one keyword is auctioned. Submit your <strong>max cost-per-click (CPC) bid</strong>.</p>
                <p><strong>Second-price rule:</strong> Highest bidder wins but pays the second-highest bid.</p>
                <p>After bidding, the real <strong>conversion rate</strong> is revealed — did you over or underpay?</p>
                <p>Profit = Revenue from conversions − Cost of clicks. Manage your $1,000 budget over 6 rounds.</p>
                <p style={{ color: '#ca8a04', fontStyle: 'italic', fontSize: '0.85rem' }}>💡 Key lesson: bid your true expected value (revenue × conversion rate).</p>
              </div>
            </div>
            <div className="aa-card">
              <div style={{ display: 'grid', gap: '0.65rem' }}>
                <button className="aa-btn aa-btn-primary" onClick={() => void createGame()} disabled={creatingSession}>
                  {creatingSession ? 'Creating...' : 'Create Session'}
                </button>
                <button className="aa-btn aa-btn-secondary" onClick={() => void soloPlay()} disabled={startingSolo}>
                  {startingSolo ? 'Starting...' : 'Play Solo Test'}
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
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Status: <strong>{latestSession.status}</strong> | Joined: {latestSession.joinedCount || 0}</div>
                    {joinedPlayers.length > 0 && (
                      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
                        {joinedPlayers.map((name) => (
                          <span key={name} className="mgsp-pill">{name}</span>
                        ))}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <button className="aa-btn aa-btn-secondary" disabled={quickActionLoading !== null || latestSession.status !== 'LOBBY'} onClick={() => void runQuickAction('start')}>
                        {quickActionLoading === 'start' ? 'Starting...' : 'Start'}
                      </button>
                      <button className="aa-btn aa-btn-secondary" disabled={quickActionLoading !== null || latestSession.status !== 'ACTIVE'} onClick={() => void runQuickAction('advance')}>
                        {quickActionLoading === 'advance' ? '...' : 'Advance'}
                      </button>
                      <button className="aa-btn aa-btn-secondary" disabled={quickActionLoading !== null} onClick={() => void runQuickAction('reset')}>
                        {quickActionLoading === 'reset' ? '...' : 'Reset'}
                      </button>
                    </div>
                    {quickActionMessage && <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{quickActionMessage}</div>}
                  </div>
                )}
              </div>
            </div>
          </div>
          <MiniGameSessionsTable gameType="ad-auction" refreshKey={sessionsRefreshKey} />
          {error && <div className="aa-error">{error}</div>}
        </div></div>
      </MiniGameShell>
    )
  }

  if (!session) return (
    <MiniGameShell title="Ad Auction" publicMode={hasPublicJoinContext}>
      <div className="aa-page"><div className="aa-shell"><div className="aa-waiting">Loading...</div></div></div>
    </MiniGameShell>
  )

  const sortedPlayers = [...session.players].sort((a, b) => b.totalProfitCents - a.totalProfitCents)
  const lastResult = session.history[session.history.length - 1]
  const isResults = session.phase === 'results'
  const myPlayer = session.players.find(p => p.id === playerToken)

  return (
    <MiniGameShell title="Ad Auction" subtitle="Search Advertising" sessionsGameType="ad-auction" publicMode={hasPublicJoinContext}>
      <div className="aa-page"><div className="aa-shell">
        <div className="aa-hero mg-page-hero">
          <h1>📢 Ad Auction</h1>
          <p>Room: <strong>{session.roomCode}</strong> · Round {session.currentRound}/{session.config.rounds} · {session.phase.toUpperCase()}</p>
        </div>

        <div className="aa-card" style={{ borderColor: 'rgba(37,99,235,0.3)', background: 'rgba(37,99,235,0.03)', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '0.95rem', color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.75rem' }}>📢 How It Works</h2>
          <div style={{ fontSize: '0.9rem', lineHeight: 1.65, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <p>Each round, one keyword is auctioned. Submit your <strong>max cost-per-click (CPC) bid</strong>.</p>
            <p><strong>Second-price rule:</strong> Highest bidder wins but pays the second-highest bid.</p>
            <p>After bidding, the real <strong>conversion rate</strong> is revealed — did you over or underpay?</p>
            <p>Profit = Revenue from conversions − Cost of clicks. Manage your $1,000 budget over 6 rounds.</p>
            <p style={{ color: '#ca8a04', fontStyle: 'italic', fontSize: '0.85rem' }}>💡 Key lesson: bid your true expected value (revenue × conversion rate).</p>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="aa-round-progress">
            {Array.from({ length: session.config.rounds }, (_, i) => (
              <div key={i} className={`aa-round-dot ${i < session.currentRound - 1 ? 'done' : i === session.currentRound - 1 ? 'current' : 'upcoming'}`} />
            ))}
          </div>
          <button className="aa-btn aa-btn-secondary" onClick={leaveGame} style={{ fontSize: '0.8rem', padding: '0.3rem 0.7rem' }}>← Leave</button>
        </div>

        {session.phase === 'lobby' && (
          <div className="aa-card" style={{ maxWidth: 520, margin: '0 auto' }}>
            <h2>{isHost ? 'Waiting for Players' : 'Waiting for Host to Start'}</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Share code: <strong style={{ fontSize: '1.1rem', letterSpacing: '0.1em' }}>{session.roomCode}</strong></p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', margin: '0.75rem 0' }}>
              {session.players.map(p => <div key={p.id} className="aa-chip">{p.name}</div>)}
            </div>
            {isHost && (
              <button className="aa-btn aa-btn-primary" onClick={() => void hostAction('start')} disabled={session.players.length < 2} style={{ marginTop: '0.75rem' }}>
                Start ({session.players.length}/2+ players)
              </button>
            )}
            {playerToken && !isHost && (
              <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>You've joined — waiting for the host to start the game.</p>
            )}
            {!isHost && !playerToken && (
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.75rem' }}>
                <input className="aa-input" placeholder="Your name" value={nameInput} onChange={e => setNameInput(e.target.value)} />
                <button className="aa-btn aa-btn-secondary" onClick={() => void joinGame()}>Join</button>
              </div>
            )}
          </div>
        )}

        {(session.phase === 'bidding' || session.phase === 'results') && session.currentKeyword && (
          <div className="aa-game-grid">
            <div className="aa-main-col">
              {/* Keyword info */}
              <div className="aa-card">
                <div style={{ fontSize: '0.8rem', color: '#2563eb', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.4rem' }}>
                  Round {session.currentRound} of {session.config.rounds}
                </div>
                <div className="aa-keyword-title">🔍 "{session.currentKeyword.keyword}"</div>
                <div className="aa-keyword-context">{session.currentKeyword.context}</div>
                <div className="aa-keyword-stats">
                  <div className="aa-stat-box">
                    <div className="aa-stat-label">Clicks Available</div>
                    <div className="aa-stat-val">{session.currentKeyword.clicksAvailable.toLocaleString()}</div>
                  </div>
                  <div className="aa-stat-box">
                    <div className="aa-stat-label">Revenue / Conversion</div>
                    <div className="aa-stat-val">${session.currentKeyword.revenuePerConversion}</div>
                  </div>
                  <div className="aa-stat-box">
                    <div className="aa-stat-label">Floor Price</div>
                    <div className="aa-stat-val">${(session.currentKeyword.floorPriceCents / 100).toFixed(2)}/click</div>
                  </div>
                  {isResults && session.currentKeyword.conversionRate !== undefined && (
                    <div className="aa-stat-box" style={{ borderColor: '#16a34a', background: 'rgba(22,163,74,0.05)' }}>
                      <div className="aa-stat-label">Actual Conv. Rate</div>
                      <div className="aa-stat-val" style={{ color: '#16a34a' }}>{(session.currentKeyword.conversionRate * 100).toFixed(1)}%</div>
                    </div>
                  )}
                </div>

                {/* Bid input — only during bidding phase */}
                {session.phase === 'bidding' && playerToken && !session.viewer?.hasBid && (
                  <div className="aa-bid-section">
                    <div className="aa-bid-label">Your Max CPC Bid</div>
                    <div className="aa-bid-hint">
                      Budget remaining: <strong>{fmt(session.viewer?.budgetCents ?? 0)}</strong>
                    </div>
                    <div className="aa-bid-input-row">
                      <span className="aa-bid-prefix">$</span>
                      <input
                        type="number" min="0" step="0.01"
                        className="aa-bid-input"
                        placeholder="0.00"
                        value={bidInput}
                        onChange={e => setBidInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') void submitBid() }}
                      />
                      <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>per click</span>
                      <button className="aa-btn aa-btn-primary" onClick={() => void submitBid()} disabled={submitting}>
                        {submitting ? 'Bidding...' : 'Place Bid'}
                      </button>
                    </div>
                  </div>
                )}

                {session.phase === 'bidding' && playerToken && session.viewer?.hasBid && (
                  <div className="aa-waiting">Bid placed. Waiting for others ({session.stats.bidsIn}/{session.stats.total})...</div>
                )}

                {session.phase === 'bidding' && !playerToken && (
                  <div className="aa-waiting">Observing — {session.stats.bidsIn}/{session.stats.total} bids in</div>
                )}
              </div>

              {/* Results reveal */}
              {isResults && lastResult && (
                <div className="aa-card">
                  <h3 style={{ fontSize: '0.95rem', marginBottom: '0.75rem' }}>Auction Results</h3>
                  {lastResult.winnerId ? (
                    <div className="aa-winner-badge">
                      🏆 {lastResult.winnerName} won! Paid {fmt(lastResult.pricePaidCents)}/click (second price)
                    </div>
                  ) : (
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.75rem' }}>No valid bids — no winner this round.</div>
                  )}

                  {lastResult.winnerId && (
                    <div className="aa-results-grid">
                      <div className="aa-result-box">
                        <div className="aa-result-label">Clicks Won</div>
                        <div className="aa-result-val">{lastResult.clicks.toLocaleString()}</div>
                      </div>
                      <div className="aa-result-box">
                        <div className="aa-result-label">Conversions</div>
                        <div className="aa-result-val">{lastResult.conversions}</div>
                      </div>
                      <div className="aa-result-box">
                        <div className="aa-result-label">Revenue</div>
                        <div className="aa-result-val">{fmt(lastResult.winnerRevenueCents)}</div>
                      </div>
                      <div className="aa-result-box">
                        <div className="aa-result-label">Ad Spend</div>
                        <div className="aa-result-val">{fmt(lastResult.winnerCostCents)}</div>
                      </div>
                      <div className="aa-result-box">
                        <div className="aa-result-label">Winner Profit</div>
                        <div className={`aa-result-val ${lastResult.winnerProfitCents >= 0 ? 'aa-profit-pos' : 'aa-profit-neg'}`}>
                          {fmt(lastResult.winnerProfitCents, true)}
                        </div>
                      </div>
                      <div className="aa-result-box" style={{ borderColor: '#2563eb', background: 'rgba(37,99,235,0.04)' }}>
                        <div className="aa-result-label">Break-even Bid</div>
                        <div className="aa-result-val" style={{ color: '#2563eb' }}>{fmt(lastResult.breakEvenBidCents)}/click</div>
                      </div>
                    </div>
                  )}

                  {lastResult.breakEvenBidCents > 0 && (
                    <div className="aa-insight">
                      💡 <strong>Break-even bid</strong> = revenue × conversion rate = ${lastResult.keyword.revenuePerConversion} × {((lastResult.keyword.conversionRate ?? 0) * 100).toFixed(1)}% = {fmt(lastResult.breakEvenBidCents)}/click.
                      Bidding above this loses money; below this is profitable if you win.
                    </div>
                  )}

                  <h4 style={{ fontSize: '0.88rem', marginTop: '0.75rem', marginBottom: '0.5rem' }}>All Bids</h4>
                  <table className="aa-bid-table">
                    <thead><tr><th>Player</th><th>Bid/click</th><th>Result</th></tr></thead>
                    <tbody>
                      {session.players
                        .map(p => ({ player: p, bid: lastResult.bids[p.id] }))
                        .sort((a, b) => (b.bid ?? -1) - (a.bid ?? -1))
                        .map(({ player, bid }) => (
                          <tr key={player.id} className={[player.id === lastResult.winnerId ? 'winner-row' : '', player.id === playerToken ? 'is-me' : ''].join(' ')}>
                            <td>{player.name}{player.id === lastResult.winnerId ? ' 🏆' : ''}</td>
                            <td>{bid !== undefined ? fmt(bid) : '—'}</td>
                            <td>{player.id === lastResult.winnerId ? fmt(lastResult.winnerProfitCents, true) : '—'}</td>
                          </tr>
                        ))
                      }
                    </tbody>
                  </table>

                  {isHost && (
                    <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
                      <button className="aa-btn aa-btn-primary" onClick={() => void hostAction('advance')}>
                        {session.currentRound >= session.config.rounds ? 'Show Final Results' : `Next Round →`}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {isHost && session.phase === 'bidding' && (
                <div className="aa-card">
                  <h3 style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>Host Controls</h3>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                    {session.stats.bidsIn}/{session.stats.total} bids received
                  </p>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="aa-btn aa-btn-secondary" onClick={() => void hostAction('advance')}>Force Reveal</button>
                    <button className="aa-btn aa-btn-danger" onClick={() => void hostAction('reset')}>Reset</button>
                  </div>
                </div>
              )}
            </div>

            <div className="aa-side-col">
              {/* My status */}
              {myPlayer && (
                <div className="aa-card">
                  <h3 style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>My Account</h3>
                  <div style={{ display: 'grid', gap: '0.4rem' }}>
                    <div className="aa-stat-box">
                      <div className="aa-stat-label">Budget Left</div>
                      <div className="aa-stat-val">{fmt(myPlayer.budgetCents)}</div>
                    </div>
                    <div className="aa-stat-box">
                      <div className="aa-stat-label">Total Profit</div>
                      <div className={`aa-stat-val ${myPlayer.totalProfitCents >= 0 ? 'aa-profit-pos' : 'aa-profit-neg'}`}>
                        {fmt(myPlayer.totalProfitCents, true)}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Leaderboard */}
              <div className="aa-card">
                <h3 style={{ fontSize: '0.9rem', marginBottom: '0.75rem' }}>Leaderboard</h3>
                {sortedPlayers.map((p, i) => (
                  <div key={p.id} className={`aa-score-row ${p.id === playerToken ? 'is-me' : ''}`}>
                    <span className="aa-rank">#{i + 1}</span>
                    <span className="aa-pname">{p.name}</span>
                    <div style={{ textAlign: 'right' }}>
                      <div className={`aa-profit ${p.totalProfitCents >= 0 ? 'aa-profit-pos' : 'aa-profit-neg'}`}>{fmt(p.totalProfitCents, true)}</div>
                      <div className="aa-budget">{fmt(p.budgetCents)} left</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Round history */}
              {session.history.length > 0 && (
                <div className="aa-card">
                  <h3 style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>Round History</h3>
                  <div className="aa-history-list">
                    {[...session.history].reverse().map(r => (
                      <div key={r.round} className="aa-hist-item">
                        <div className="aa-hist-keyword">R{r.round}: {r.keyword.keyword}</div>
                        <div className="aa-hist-detail">
                          {r.winnerId ? `Winner: ${r.winnerName} · ${fmt(r.winnerProfitCents, true)}` : 'No winner'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="aa-card">
                <h3 style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>Events</h3>
                <div className="aa-event-log">
                  {[...session.eventLog].reverse().map((e, i) => <div key={i} className="aa-event">{e}</div>)}
                </div>
              </div>
            </div>
          </div>
        )}

        {session.phase === 'done' && (
          <div className="aa-card" style={{ maxWidth: 640, margin: '0 auto' }}>
            <h2 style={{ textAlign: 'center', marginBottom: '1.25rem' }}>Auction Complete!</h2>
            <div style={{ marginBottom: '1.5rem' }}>
              {sortedPlayers.map((p, i) => (
                <div key={p.id} className={`aa-final-row ${i === 0 ? 'winner' : ''}`}>
                  <span style={{ fontSize: '1.1rem' }}>{i === 0 ? '🏆' : `#${i + 1}`}</span>
                  <span style={{ flex: 1 }}>{p.name}</span>
                  <span className={p.totalProfitCents >= 0 ? 'aa-profit-pos' : 'aa-profit-neg'}>{fmt(p.totalProfitCents, true)}</span>
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginLeft: '0.5rem' }}>{fmt(p.budgetCents)} left</span>
                </div>
              ))}
            </div>
            <h3 style={{ fontSize: '0.95rem', marginBottom: '0.75rem' }}>Round Summary</h3>
            {session.history.map(r => (
              <div key={r.round} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.35rem 0', borderBottom: '1px solid var(--border)', fontSize: '0.88rem' }}>
                <span>R{r.round}: <em>{r.keyword.keyword}</em></span>
                <span style={{ color: 'var(--text-secondary)' }}>
                  {r.winnerId ? `${r.winnerName} +${fmt(r.winnerProfitCents)}` : 'No winner'}
                </span>
              </div>
            ))}
            {isHost && (
              <button className="aa-btn aa-btn-secondary" onClick={() => void hostAction('reset')} style={{ marginTop: '1.25rem' }}>
                Play Again (new keywords)
              </button>
            )}
          </div>
        )}

        {error && <div className="aa-error">{error}</div>}
      </div></div>
    </MiniGameShell>
  )
}



