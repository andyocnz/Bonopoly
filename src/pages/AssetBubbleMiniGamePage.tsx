import { QRCodeSVG } from 'qrcode.react'
import { useEffect, useMemo, useState, useRef } from 'react'
import { getEducatorSessionCached, getEducatorSessionSync } from '../features/minigames/educatorSession'
import { MiniGameShell } from '../features/minigames/MiniGameShell'
import './AssetBubbleMiniGamePage.css'
import '../features/minigames/SessionControlPanel.css'
import { educatorMiniGamesApi } from '../features/minigames/api'
import { MiniGameSessionsTable } from '../features/minigames/MiniGameSessionsTable'
import type { EducatorMiniGameSession } from '../api/client'

const STORAGE_KEY = 'asset-bubble_minigame_v1'
const GAME_SLUG = 'asset-bubble'

type OrderEntry = { id: string; playerName: string; price: number }
type Trade = { buyerName: string; sellerName: string; price: number; at: number; period: number }
type PeriodSummary = { period: number; fundamentalValue: number; trades: Trade[]; avgTradePrice: number | null; dividendPaid: number }
type Player = { id: string; name: string; isBot: boolean; cash: number; assets: number; totalProfit: number }
type Session = {
  roomCode: string; phase: 'lobby' | 'playing' | 'results'
  currentPeriod: number; config: { totalPeriods: number; dividend: number; cashEndowment: number; assetEndowment: number; secondsPerPeriod: number }
  fundamentalValue: number
  periodEndsAt: number | null
  players: Player[]; bids: OrderEntry[]; asks: OrderEntry[]
  tradesThisPeriod: Trade[]; history: PeriodSummary[]; eventLog: string[]
  viewer: { cash: number; assets: number; totalProfit: number; myBid: number | null; myAsk: number | null } | null
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

export default function AssetBubbleMiniGamePage() {
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
  const [bidPrice, setBidPrice] = useState(50)
  const [askPrice, setAskPrice] = useState(50)
  const [secsRemaining, setSecsRemaining] = useState<number | null>(null)

  useEffect(() => {
    if (!session?.periodEndsAt || session.phase !== 'playing') { setSecsRemaining(null); return }
    const tick = () => setSecsRemaining(Math.max(0, Math.ceil((session.periodEndsAt! - Date.now()) / 1000)))
    tick()
    const id = setInterval(tick, 500)
    return () => clearInterval(id)
  }, [session?.periodEndsAt, session?.phase])

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
        const latest = sessions.filter(s => s.gameType === 'asset-bubble').sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] || null
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

  async function placeBid() {
    if (!roomCode || !playerToken) return
    try {
      const d = await api<{ session: Session }>(`/${GAME_SLUG}/${roomCode}/bid`, { method: 'POST', body: JSON.stringify({ playerToken, price: bidPrice }) })
      setSession(d.session)
    } catch (e) { setError((e as Error).message) }
  }

  async function placeAsk() {
    if (!roomCode || !playerToken) return
    try {
      const d = await api<{ session: Session }>(`/${GAME_SLUG}/${roomCode}/ask`, { method: 'POST', body: JSON.stringify({ playerToken, price: askPrice }) })
      setSession(d.session)
    } catch (e) { setError((e as Error).message) }
  }

  async function cancelOrder() {
    if (!roomCode || !playerToken) return
    try {
      const d = await api<{ session: Session }>(`/${GAME_SLUG}/${roomCode}/cancel`, { method: 'POST', body: JSON.stringify({ playerToken }) })
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
      <MiniGameShell title="Asset Bubble" sessionsGameType="asset-bubble" publicMode={true}>
        <div className="ab-page"><div className="ab-shell">
          <div className="ab-hero mg-page-hero"><h1>📈 Asset Bubble</h1></div>
          <div className="ab-card" style={{ textAlign: 'center' }}>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>Educator login required to create. Students: enter room code to join.</p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <input className="ab-input" placeholder="Your name" value={nameInput} onChange={e => setNameInput(e.target.value)} />
              <input className="ab-input" placeholder="Room code" value={roomCodeInput} onChange={e => setRoomCodeInput(e.target.value.toUpperCase())} style={{ maxWidth: '140px' }} />
              <button className="ab-btn ab-btn-primary" onClick={joinGame} disabled={loading}>Join</button>
            </div>
            {error && <div className="ab-error">{error}</div>}
          </div>
        </div></div>
      </MiniGameShell>
    )
  }

  if (isLobbyMode && !session) {
    return (
      <MiniGameShell title="Asset Bubble" subtitle="Live Order Book Trading" sessionsGameType="asset-bubble" publicMode={hasPublicJoinContext}>
        <div className="ab-page"><div className="ab-shell">
          <div className="ab-hero mg-page-hero">
            <h1>📈 Asset Bubble</h1>
            <p className="ab-sub">Trade an asset with declining fundamental value. Post bids and asks in a live order book. Can you avoid the crash?</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
            <div className="ab-card" style={{ border: '1px solid var(--accent-blue)', background: 'rgba(59,130,246,0.05)' }}>
              <h2 style={{ fontSize: '1rem', color: 'var(--accent-blue)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1rem' }}>📈 How It Works</h2>
              <div style={{ fontSize: '0.9rem', lineHeight: '1.6', color: 'var(--text-primary)', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                <p>The asset pays a <strong>$10 dividend</strong> per unit each period.</p>
                <p><strong>Fundamental Value</strong> = remaining periods × $10. It declines every period!</p>
                <p>Post a <strong>bid</strong> (buy) or <strong>ask</strong> (sell). Trades execute immediately when best bid ≥ best ask.</p>
                <p>You start with <strong>$500 cash</strong> and <strong>4 assets</strong>. Score = final portfolio value.</p>
                <div className="ab-fv-table">
                  <div className="ab-fv-header">Period</div><div className="ab-fv-header">Fund. Value</div>
                  <div>1</div><div>$100</div>
                  <div>5</div><div>$60</div>
                  <div>10</div><div>$10</div>
                </div>
              </div>
              <p style={{ marginTop: '1rem', fontSize: '0.82rem', color: 'var(--accent-amber)', fontStyle: 'italic' }}>💡 Classic Smith et al. bubble: markets often trade above fundamental value!</p>
            </div>
            <div className="ab-card">
              <div style={{ display: 'grid', gap: '0.65rem' }}>
                <button className="ab-btn ab-btn-primary" onClick={createGame} disabled={creatingSession}>{creatingSession ? 'Creating...' : 'Create Session'}</button>
                <button className="ab-btn ab-btn-secondary" onClick={soloPlay} disabled={loading}>{loading ? 'Starting...' : 'Play Solo Test'}</button>
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
                          <button type="button" className="mgsp-btn mgsp-secondary" onClick={() => navigator.clipboard.writeText(latestSession.roomCode || '')}>📋</button>
                        </div>
                    </div>
                    <div className="mg-form-group">
                      <label>Latest Join Link</label>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <input className="mgsp-input" style={{ flex: 1, minWidth: 0, width: '100%' }} value={latestSession.joinByCodeLink || `${window.location.origin}/mini-games/join?code=${encodeURIComponent(latestSession.roomCode || '')}`} readOnly />
                          <button type="button" className="mgsp-btn mgsp-secondary" onClick={() => navigator.clipboard.writeText(latestSession.joinByCodeLink || `${window.location.origin}/mini-games/join?code=${encodeURIComponent(latestSession.roomCode || '')}`)}>📋</button>
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
                      <button className="ab-btn ab-btn-secondary" disabled={quickActionLoading !== null || latestSession.status !== 'LOBBY'} onClick={() => void runQuickAction('start')}>{quickActionLoading === 'start' ? 'Starting...' : latestSession.status === 'LOBBY' ? 'Start' : 'Started'}</button>
                      <button className="ab-btn ab-btn-secondary" disabled={quickActionLoading !== null || latestSession.status !== 'ACTIVE'} onClick={() => void runQuickAction('advance')}>{quickActionLoading === 'advance' ? 'Advancing...' : 'Advance Period'}</button>
                      <button className="ab-btn ab-btn-secondary" disabled={quickActionLoading !== null || (latestSession.status !== 'ACTIVE' && latestSession.status !== 'COMPLETED')} onClick={() => void runQuickAction('reset')}>{quickActionLoading === 'reset' ? 'Resetting...' : 'Reset'}</button>
                    </div>
                    {quickActionMessage && <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{quickActionMessage}</div>}
                  </div>
                )}
              </div>
            </div>
          </div>
          <MiniGameSessionsTable gameType="asset-bubble" refreshKey={sessionsRefreshKey} />
          {error && <div className="ab-error">{error}</div>}
        </div></div>
      </MiniGameShell>
    )
  }

  if (!session) return (
    <MiniGameShell title="Asset Bubble" sessionsGameType="asset-bubble" publicMode={hasPublicJoinContext}>
      <div className="ab-page"><div className="ab-shell"><div className="ab-loading">Loading...</div></div></div>
    </MiniGameShell>
  )

  const sortedPlayers = [...session.players].sort((a, b) => (b.cash + b.assets * session.fundamentalValue) - (a.cash + a.assets * session.fundamentalValue))
  const recentTrades = [...session.tradesThisPeriod].reverse().slice(0, 5)

  return (
    <MiniGameShell title="Asset Bubble" subtitle="Live Order Book Trading" sessionsGameType="asset-bubble" publicMode={hasPublicJoinContext}>
      <div className="ab-page"><div className="ab-shell">
        <div className="ab-hero mg-page-hero">
          <h1>📈 Asset Bubble</h1>
          <p className="ab-sub">Room: <strong>{session.roomCode}</strong> · Period {session.currentPeriod}/{session.config.totalPeriods} · FV = <strong>${session.fundamentalValue}</strong> · {session.phase.toUpperCase()}</p>
        </div>
        <div className="ab-card" style={{ border: '1px solid var(--accent-blue)', background: 'rgba(59,130,246,0.05)', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1rem', color: 'var(--accent-blue)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1rem' }}>📈 How It Works</h2>
          <div style={{ fontSize: '0.9rem', lineHeight: '1.6', color: 'var(--text-primary)', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            <p>The asset pays a <strong>$10 dividend</strong> per unit each period.</p>
            <p><strong>Fundamental Value</strong> = remaining periods × $10. It declines every period!</p>
            <p>Post a <strong>bid</strong> (buy) or <strong>ask</strong> (sell). Trades execute immediately when best bid ≥ best ask.</p>
            <p>You start with <strong>$500 cash</strong> and <strong>4 assets</strong>. Score = final portfolio value.</p>
            <div className="ab-fv-table">
              <div className="ab-fv-header">Period</div><div className="ab-fv-header">Fund. Value</div>
              <div>1</div><div>$100</div>
              <div>5</div><div>$60</div>
              <div>10</div><div>$10</div>
            </div>
          </div>
          <p style={{ marginTop: '1rem', fontSize: '0.82rem', color: 'var(--accent-amber)', fontStyle: 'italic' }}>💡 Classic Smith et al. bubble: markets often trade above fundamental value!</p>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
          <button className="ab-btn ab-btn-secondary" onClick={leaveGame} style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}>← Leave Game</button>
        </div>

        {session.phase === 'lobby' && (
          <div className="ab-card" style={{ maxWidth: 520, margin: '0 auto' }}>
            <h2>{isHost ? 'Waiting for Players' : 'Waiting for Host to Start'}</h2>
            <p className="ab-desc">Share code: <strong className="ab-room-code">{session.roomCode}</strong></p>
            <div className="ab-players-list">{session.players.map(p => <div key={p.id} className="ab-chip">{p.name}</div>)}</div>
            {isHost && <button className="ab-btn ab-btn-primary" onClick={() => hostAction('start')} disabled={session.players.length < 2} style={{ marginTop: '1rem' }}>Start ({session.players.length}/2+ players)</button>}
            {playerToken && !isHost && (
              <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>You've joined — waiting for the host to start the game.</p>
            )}
            {!isHost && !playerToken && (
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
                <input className="ab-input" placeholder="Your name" value={nameInput} onChange={e => setNameInput(e.target.value)} />
                <button className="ab-btn ab-btn-secondary" onClick={joinGame}>Join</button>
              </div>
            )}
          </div>
        )}


        {session.phase === 'playing' && (
          <div className="ab-game-grid">
            <div className="ab-main-col">
              <div className="ab-card ab-info-card">
                <div className="ab-info-row">
                  <div className="ab-info-item"><span className="ab-info-label">Period</span><span className="ab-info-val">{session.currentPeriod}/{session.config.totalPeriods}</span></div>
                  <div className="ab-info-item"><span className="ab-info-label">Fund. Value</span><span className="ab-info-val" style={{ color: '#f59e0b' }}>${session.fundamentalValue}</span></div>
                  {secsRemaining !== null && (
                    <div className="ab-info-item">
                      <span className="ab-info-label">Time Left</span>
                      <span className="ab-info-val" style={{ color: secsRemaining <= 10 ? '#dc2626' : 'inherit' }}>{secsRemaining}s</span>
                    </div>
                  )}
                  {session.viewer && <div className="ab-info-item"><span className="ab-info-label">My Cash</span><span className="ab-info-val">${session.viewer.cash}</span></div>}
                  {session.viewer && <div className="ab-info-item"><span className="ab-info-label">My Assets</span><span className="ab-info-val">{session.viewer.assets}</span></div>}
                </div>
              </div>

              {playerToken && session.viewer && (
                <div className="ab-card">
                  <h3>Place Orders</h3>
                  <p className="ab-desc">Post a bid (buy) or ask (sell). Trades execute when best bid ≥ best ask.</p>
                  <div className="ab-order-grid">
                    <div className="ab-order-side ab-bid-side">
                      <h4>BID (Buy)</h4>
                      <div className="ab-order-row">
                        <input type="number" className="ab-price-input" value={bidPrice} min={1} max={500} onChange={e => setBidPrice(Number(e.target.value))} />
                        <button className="ab-btn ab-btn-bid" onClick={placeBid} disabled={session.viewer.cash < bidPrice}>Bid ${bidPrice}</button>
                      </div>
                      {session.viewer.myBid !== null && <div className="ab-my-order">My bid: <strong>${session.viewer.myBid}</strong></div>}
                    </div>
                    <div className="ab-order-side ab-ask-side">
                      <h4>ASK (Sell)</h4>
                      <div className="ab-order-row">
                        <input type="number" className="ab-price-input" value={askPrice} min={1} max={500} onChange={e => setAskPrice(Number(e.target.value))} />
                        <button className="ab-btn ab-btn-ask" onClick={placeAsk} disabled={session.viewer.assets < 1}>Ask ${askPrice}</button>
                      </div>
                      {session.viewer.myAsk !== null && <div className="ab-my-order">My ask: <strong>${session.viewer.myAsk}</strong></div>}
                    </div>
                  </div>
                  {(session.viewer.myBid !== null || session.viewer.myAsk !== null) && (
                    <button className="ab-btn ab-btn-secondary" onClick={cancelOrder} style={{ marginTop: '0.75rem', fontSize: '0.82rem' }}>Cancel My Orders</button>
                  )}
                </div>
              )}

              <div className="ab-card">
                <h3>Order Book</h3>
                <div className="ab-book-grid">
                  <div className="ab-book-col">
                    <div className="ab-book-header" style={{ color: '#16a34a' }}>Bids (Buy)</div>
                    {session.bids.length === 0 ? <div className="ab-book-empty">No bids</div> : session.bids.slice(0, 5).map((b, i) => (
                      <div key={b.id} className="ab-book-row bid">
                        <span className="ab-book-name">{b.playerName}</span><span className="ab-book-price">${b.price}</span>
                      </div>
                    ))}
                  </div>
                  <div className="ab-book-col">
                    <div className="ab-book-header" style={{ color: '#dc2626' }}>Asks (Sell)</div>
                    {session.asks.length === 0 ? <div className="ab-book-empty">No asks</div> : session.asks.slice(0, 5).map((a, i) => (
                      <div key={a.id} className="ab-book-row ask">
                        <span className="ab-book-name">{a.playerName}</span><span className="ab-book-price">${a.price}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {recentTrades.length > 0 && (
                <div className="ab-card">
                  <h3>Recent Trades (Period {session.currentPeriod})</h3>
                  {recentTrades.map((t, i) => (
                    <div key={i} className="ab-trade-row">
                      <span className="ab-trade-price">${t.price}</span>
                      <span className="ab-trade-detail">{t.buyerName} ← {t.sellerName}</span>
                      <span className={`ab-fv-diff ${t.price > session.fundamentalValue ? 'above' : 'below'}`}>{t.price > session.fundamentalValue ? `+${t.price - session.fundamentalValue} above FV` : `${t.price - session.fundamentalValue} below FV`}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="ab-side-col">
              <div className="ab-card">
                <h3>Holdings (by portfolio value)</h3>
                {sortedPlayers.map((p, i) => {
                  const portfolioVal = p.cash + p.assets * session.fundamentalValue
                  return (
                    <div key={p.id} className={`ab-score-row ${p.id === playerToken ? 'is-me' : ''}`}>
                      <span className="ab-rank">#{i+1}</span>
                      <span className="ab-pname">{p.name}{p.isBot ? ' 🤖' : ''}</span>
                      <span className="ab-pts" style={{ fontSize: '0.75rem' }}>${p.cash}+{p.assets}×FV</span>
                    </div>
                  )
                })}
              </div>
              {session.history.length > 0 && (
                <div className="ab-card">
                  <h3>Period History</h3>
                  <div className="ab-history">
                    {[...session.history].reverse().map(h => (
                      <div key={h.period} className="ab-hist-row">
                        <span>P{h.period}</span>
                        <span style={{ color: '#f59e0b' }}>FV=${h.fundamentalValue}</span>
                        <span style={{ color: h.avgTradePrice !== null && h.avgTradePrice > h.fundamentalValue ? '#dc2626' : '#16a34a' }}>
                          {h.avgTradePrice !== null ? `avg $${h.avgTradePrice}` : 'no trades'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="ab-card">
                <h3>Events</h3>
                <div className="ab-event-log">{[...session.eventLog].reverse().map((e, i) => <div key={i} className="ab-event">{e}</div>)}</div>
              </div>
              {isHost && (
                <div className="ab-card">
                  <h3>Host Controls</h3>
                  <p className="ab-desc">End period → pay dividends → advance</p>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button className="ab-btn ab-btn-primary" onClick={() => hostAction('advance')}>End Period {session.currentPeriod}</button>
                    <button className="ab-btn ab-btn-danger" onClick={() => hostAction('reset')}>Reset</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {session.phase === 'results' && (
          <div className="ab-card" style={{ maxWidth: 640, margin: '0 auto' }}>
            <h2>Game Complete!</h2>
            <p className="ab-desc">Final portfolio values (cash + assets × FV at end):</p>
            <div style={{ marginBottom: '1.5rem' }}>
              {sortedPlayers.map((p, i) => (
                <div key={p.id} className={`ab-final-row ${i === 0 ? 'winner' : ''}`}>
                  <span>{i === 0 ? '🏆' : `#${i+1}`}</span>
                  <span style={{ flex: 1 }}>{p.name}{p.isBot ? ' 🤖' : ''}</span>
                  <span>${p.cash} cash + {p.assets} assets</span>
                  <span style={{ color: p.totalProfit >= 0 ? '#16a34a' : '#dc2626', fontWeight: 700 }}>{p.totalProfit >= 0 ? '+' : ''}{p.totalProfit} vs start</span>
                </div>
              ))}
            </div>
            <h3>Period Prices vs Fundamental Value</h3>
            {session.history.map(h => (
              <div key={h.period} className="ab-hist-row">
                <span>P{h.period}</span>
                <span style={{ color: '#f59e0b' }}>FV=${h.fundamentalValue}</span>
                <span>{h.avgTradePrice !== null ? `avg $${h.avgTradePrice}` : 'no trades'}</span>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>{h.trades.length} trades</span>
              </div>
            ))}
            {isHost && <button className="ab-btn ab-btn-secondary" onClick={() => hostAction('reset')} style={{ marginTop: '1.5rem' }}>Play Again</button>}
          </div>
        )}

        {error && <div className="ab-error">{error}</div>}
      </div></div>
    </MiniGameShell>
  )
}



