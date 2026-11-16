import { QRCodeSVG } from 'qrcode.react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { MiniGameShell } from '../features/minigames/MiniGameShell'
import { getEducatorSessionCached, getEducatorSessionSync } from '../features/minigames/educatorSession'
import { educatorMiniGamesApi } from '../features/minigames/api'
import { MiniGameSessionsTable } from '../features/minigames/MiniGameSessionsTable'
import type { EducatorMiniGameSession } from '../api/client'
import './DoubleAuctionMiniGamePage.css'
import '../features/minigames/SessionControlPanel.css'

type Role = 'buyer' | 'seller'

type Player = {
  id: string
  name: string
  isBot: boolean
  role: Role | null
  totalProfit: number
  lastProfit: number
}

type Trade = {
  buyerId: string
  buyerName: string
  sellerId: string
  sellerName: string
  bid: number
  ask: number
  price: number
}

type RoundSummary = {
  round: number
  trades: Trade[]
  avgPrice: number | null
  tradeCount: number
}

type Session = {
  roomCode: string
  phase: 'lobby' | 'playing' | 'results'
  currentRound: number
  config: {
    rounds: number
    minPrice: number
    maxPrice: number
  }
  players: Player[]
  history: RoundSummary[]
  eventLog: string[]
}

type Viewer = {
  isHost: boolean
  playerId: string | null
  playerName: string | null
  role: Role | null
  privateNumber: number | null
  submitted: boolean
}

type Saved = {
  roomCode: string
  hostToken: string | null
  playerToken: string | null
  name: string | null
}

const STORAGE_KEY = 'double_auction_minigame_v1'

function loadSaved(): Saved {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') as Saved | null
    if (!parsed) return { roomCode: '', hostToken: null, playerToken: null, name: null }
    return {
      roomCode: parsed.roomCode || '',
      hostToken: parsed.hostToken || null,
      playerToken: parsed.playerToken || null,
      name: parsed.name || null,
    }
  } catch {
    return { roomCode: '', hostToken: null, playerToken: null, name: null }
  }
}

function saveSaved(v: Saved) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(v))
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/minigames${path}`, {
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    ...init,
  })
  const raw = await res.text()
  let parsed: (T & { success?: boolean; error?: string }) | null = null
  if (raw) {
    try {
      parsed = JSON.parse(raw) as T & { success?: boolean; error?: string }
    } catch {
      throw new Error(`Server returned non-JSON response (${res.status})`)
    }
  }
  if (!res.ok || (parsed && parsed.success === false)) {
    throw new Error(parsed?.error || `Request failed (${res.status})`)
  }
  return (parsed ?? ({} as T))
}

const IconGavel = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14.5 2L3.5 13L11 20.5L22 9.5L14.5 2Z" />
    <path d="M7 14.5L2.5 19L5 21.5L9.5 17" />
    <path d="M12.5 7L17.5 12" />
  </svg>
)

const IconUsers = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
)

const IconTrendingUp = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
    <polyline points="17 6 23 6 23 12" />
  </svg>
)

const IconActivity = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
  </svg>
)

const DoubleAuctionMissionBanner = () => (
  <div className="auction-mission-banner">
    <h2 style={{ fontSize: '1.2rem', color: 'var(--accent-blue)', marginBottom: '1rem' }}>{'\u{1F3AF} The Strategic Mission: Equilibrium & Profit'}</h2>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', fontSize: '0.95rem' }}>
      <div style={{ borderLeft: '3px solid var(--accent-emerald)', paddingLeft: '1rem' }}>
        <p style={{ color: 'var(--text-primary)', fontWeight: '700', marginBottom: '0.5rem' }}>{'\u{1F6D2} BUYERS: VALUE RETENTION'}</p>
        <p>Your goal is to buy <strong>below</strong> your private value. The lower you bid, the higher your profit, but if you bid too low, you might not get any units.</p>
      </div>
      <div style={{ borderLeft: '3px solid var(--accent-amber)', paddingLeft: '1rem' }}>
        <p style={{ color: 'var(--accent-amber)', fontWeight: '700', marginBottom: '0.5rem' }}>{'\u{1F3ED} SELLERS: MARGIN MAXIMIZATION'}</p>
        <p>Your goal is to sell <strong>above</strong> your production cost. High asks mean high margins, but if your ask is too high, no buyer will take the deal.</p>
      </div>
      <div style={{ borderLeft: '3px solid var(--accent-rose)', paddingLeft: '1rem' }}>
        <p style={{ color: 'var(--accent-rose)', fontWeight: '700', marginBottom: '0.5rem' }}>{'\u{1F4C8} THE MARKET PRICE'}</p>
        <p>Over multiple rounds, watch how the average price stabilizes. This is the "Invisible Hand" finding the market equilibrium.</p>
      </div>
    </div>
  </div>
)

export default function DoubleAuctionMiniGamePage() {
  const saved = useMemo(loadSaved, [])
  const query = useMemo(() => new URLSearchParams(window.location.search), [])
  const inviteToken = (query.get('invite') || '').trim()
  const roomFromUrl = (query.get('room') || '').trim().toUpperCase()
  const nameFromUrl = (query.get('name') || '').trim()
  const hostTokenFromUrl = (query.get('hostToken') || '').trim()

  const [name, setName] = useState(nameFromUrl || saved.name || 'You')
  const [roomCodeInput, setRoomCodeInput] = useState(roomFromUrl || saved.roomCode)
  const [hostToken, setHostToken] = useState<string | null>(hostTokenFromUrl || saved.hostToken)
  const [playerToken, setPlayerToken] = useState<string | null>(saved.playerToken)
  const [session, setSession] = useState<Session | null>(null)
  const [viewer, setViewer] = useState<Viewer | null>(null)
  const [priceInput, setPriceInput] = useState(100)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [inviteLabel, setInviteLabel] = useState<string | null>(null)
  const hasPublicJoinContext = Boolean(inviteToken || roomFromUrl || hostTokenFromUrl)
  const [authChecked, setAuthChecked] = useState(() => hasPublicJoinContext || getEducatorSessionSync() !== null)
  const [canAccessSetup, setCanAccessSetup] = useState(() => hostTokenFromUrl ? true : roomFromUrl ? false : (getEducatorSessionSync()?.ok ?? false))
  const [sessionsRefreshKey, setSessionsRefreshKey] = useState(0)
  const [creatingSession, setCreatingSession] = useState(false)
  const [sessionsFetching, setSessionsFetching] = useState(false)
  const [startingSolo, setStartingSolo] = useState(false)
  const [isSoloMode, setIsSoloMode] = useState(false)
  const [latestSession, setLatestSession] = useState<EducatorMiniGameSession | null>(null)
  const [quickActionLoading, setQuickActionLoading] = useState<'start' | 'advance' | 'reset' | null>(null)
  const [quickActionMessage, setQuickActionMessage] = useState<string | null>(null)
  const [hostSessionId, setHostSessionId] = useState<string | null>(null)
  const [claimingHost, setClaimingHost] = useState(false)
  const autoJoinAttemptedRef = useRef(false)
  const loadGuardRef = useRef(0)

  const roomCode = (session?.roomCode || roomCodeInput || '').toUpperCase()
  const canPoll = Boolean(roomCode && (hostToken || playerToken))
  const isHost = viewer?.isHost || Boolean(hostToken)

  useEffect(() => {
    if (!session?.roomCode || isHost || hasPublicJoinContext || !authChecked || !canAccessSetup) {
      setHostSessionId(null)
      return
    }
    let cancelled = false
    const resolveHostSession = async () => {
      try {
        const all = await educatorMiniGamesApi.listSessions()
        const match = all.find(
          (s) => s.gameType === 'double-auction' && String(s.roomCode || '').toUpperCase() === String(session.roomCode || '').toUpperCase(),
        )
        if (!cancelled) setHostSessionId(match?.id || null)
      } catch {
        if (!cancelled) setHostSessionId(null)
      }
    }
    void resolveHostSession()
    return () => {
      cancelled = true
    }
  }, [session?.roomCode, isHost, hasPublicJoinContext, authChecked, canAccessSetup])

  useEffect(() => {
    saveSaved({
      roomCode,
      hostToken,
      playerToken,
      name,
    })
  }, [roomCode, hostToken, playerToken, name])

  useEffect(() => {
    if (!inviteToken) return
    let cancelled = false
    const resolveInvite = async () => {
      try {
        const response = await api<{ success: boolean; invite: { teamLabel: string; roomCode?: string | null } }>(
          `/invite/${encodeURIComponent(inviteToken)}`
        )
        if (cancelled) return
        if (response.invite.roomCode && !roomFromUrl) {
          setRoomCodeInput(String(response.invite.roomCode).toUpperCase())
        }
        if (response.invite.teamLabel && !nameFromUrl && !name) {
          setName(response.invite.teamLabel)
        }
        setInviteLabel(response.invite.teamLabel || null)
      } catch {
        if (!cancelled) setInviteLabel(null)
      }
    }
    void resolveInvite()
    return () => {
      cancelled = true
    }
  }, [inviteToken, roomFromUrl, nameFromUrl, name])

  useEffect(() => {
    if (hasPublicJoinContext) return
    let cancelled = false
    const ensureEducator = async () => {
      const sessionInfo = await getEducatorSessionCached(true)
      if (!cancelled) {
        setCanAccessSetup(sessionInfo.ok)
        setAuthChecked(true)
      }
    }
    void ensureEducator()
    return () => {
      cancelled = true
    }
  }, [hasPublicJoinContext])

  useEffect(() => {
    if (hasPublicJoinContext) return
    if (!authChecked) return
    if (!canAccessSetup && !session && !playerToken) {
      window.location.href = '/educator-login'
    }
  }, [hasPublicJoinContext, authChecked, canAccessSetup])

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

  const loadLatestDoubleAuctionSession = async () => {
    if (hasPublicJoinContext) return
    setSessionsFetching(true)
    try {
      const sessions = await educatorMiniGamesApi.listSessions()
      const latest = sessions
        .filter((s) => s.gameType === 'double-auction')
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] || null
      setLatestSession(latest)
    } catch {
      setLatestSession(null)
    } finally { setSessionsFetching(false) }
  }

  useEffect(() => {
    if (hasPublicJoinContext || !authChecked || !canAccessSetup || sessionsRefreshKey === 0) return
    void loadLatestDoubleAuctionSession()
  }, [hasPublicJoinContext, authChecked, canAccessSetup, sessionsRefreshKey])

  const loadState = async () => {
    if (!roomCode) return
    const guard = loadGuardRef.current
    const qs = new URLSearchParams()
    if (hostToken) qs.set('hostToken', hostToken)
    if (playerToken) qs.set('playerToken', playerToken)
    const response = await api<{ success: boolean; session: Session; viewer: Viewer }>(`/double-auction/${roomCode}/state?${qs.toString()}`)
    if (loadGuardRef.current !== guard) return
    setSession(response.session)
    setViewer(response.viewer)
    setError(null)
  }

  useEffect(() => {
    if (!canPoll) return
    void loadState()
    const timer = window.setInterval(() => void loadState(), 2000)
    return () => window.clearInterval(timer)
  }, [canPoll, roomCode, hostToken, playerToken])

  useEffect(() => {
    if (!session) return
    setPriceInput((v) => Math.max(session.config.minPrice, Math.min(session.config.maxPrice, v)))
  }, [session])

  const joinLiveRoom = async () => {
    setLoading(true)
    setError(null)
    try {
      const code = roomCodeInput.trim().toUpperCase()
      const response = await api<{ success: boolean; playerToken: string; session: Session }>(`/double-auction/${code}/join`, {
        method: 'POST',
        body: JSON.stringify({ name }),
      })
      setPlayerToken(response.playerToken)
      setRoomCodeInput(code)
      setSession(response.session)
      await loadState()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join room')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (autoJoinAttemptedRef.current) return
    if (!roomFromUrl || !nameFromUrl) return
    if (hostTokenFromUrl) return
    const alreadyInTargetSession =
      (session?.roomCode || '').toUpperCase() === roomFromUrl &&
      String(viewer?.playerName || '').trim().toLowerCase() === nameFromUrl.trim().toLowerCase()
    if (alreadyInTargetSession) return

    autoJoinAttemptedRef.current = true
    setHostToken(null)
    setPlayerToken(null)
    setSession(null)
    setViewer(null)
    setLoading(true)
    setError(null)
    void (async () => {
      try {
        const code = roomFromUrl.trim().toUpperCase()
        const response = await api<{ success: boolean; playerToken: string; session: Session }>(`/double-auction/${code}/join`, {
          method: 'POST',
          body: JSON.stringify({ name: nameFromUrl.trim() }),
        })
        setPlayerToken(response.playerToken)
        setRoomCodeInput(code)
        setSession(response.session)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to join room')
      } finally {
        setLoading(false)
      }
    })()
  }, [roomFromUrl, nameFromUrl, hostTokenFromUrl, session?.roomCode, viewer?.playerName])

  const startLiveGame = async () => {
    if (!hostToken || !roomCode) return
    setLoading(true)
    setError(null)
    try {
      const response = await api<{ success: boolean; session: Session }>(`/double-auction/${roomCode}/start`, {
        method: 'POST',
        body: JSON.stringify({ hostToken }),
      })
      setSession(response.session)
      setPriceInput(response.session.config.minPrice)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start game')
    } finally {
      setLoading(false)
    }
  }

  const submitOrder = async () => {
    if (!playerToken || !roomCode) return
    setLoading(true)
    setError(null)
    try {
      const response = await api<{ success: boolean; session: Session }>(`/double-auction/${roomCode}/order`, {
        method: 'POST',
        body: JSON.stringify({ playerToken, price: priceInput }),
      })
      setSession(response.session)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit order')
    } finally {
      setLoading(false)
    }
  }

  const closeRound = async () => {
    if (!hostToken || !roomCode) return
    setLoading(true)
    setError(null)
    try {
      const response = await api<{ success: boolean; session: Session }>(`/double-auction/${roomCode}/advance`, {
        method: 'POST',
        body: JSON.stringify({ hostToken }),
      })
      setSession(response.session)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to close round')
    } finally {
      setLoading(false)
    }
  }

  const resetGame = async () => {
    if (!hostToken || !roomCode) return
    setLoading(true)
    setError(null)
    try {
      const response = await api<{ success: boolean; session: Session }>(`/double-auction/${roomCode}/reset`, {
        method: 'POST',
        body: JSON.stringify({ hostToken }),
      })
      setSession(response.session)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset')
    } finally {
      setLoading(false)
    }
  }

  const claimHostControl = async () => {
    if (!hostSessionId) return
    setClaimingHost(true)
    setError(null)
    try {
      const links = await educatorMiniGamesApi.getSessionLinks(hostSessionId)
      window.location.href = links.session.hostLink
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to claim host control')
    } finally {
      setClaimingHost(false)
    }
  }

  const myRole = viewer?.role || null
  const myPrivate = viewer?.privateNumber ?? null
  const previewProfit = myPrivate !== null
    ? (myRole === 'buyer' ? myPrivate - priceInput : priceInput - myPrivate)
    : 0

  const createSession = async () => {
    setCreatingSession(true)
    setError(null)
    setQuickActionMessage(null)
    try {
      await educatorMiniGamesApi.createSession({ gameType: 'double-auction', teamCount: 40 })
      setSessionsRefreshKey((v) => v + 1)
    } catch (err) {
      if (err instanceof Error && /unauthorized/i.test(err.message)) {
        window.location.href = '/educator-login'
        return
      }
      setError(err instanceof Error ? err.message : 'Failed to create session')
    } finally {
      setCreatingSession(false)
    }
  }

  const startSoloTest = async () => {
    setStartingSolo(true)
    setError(null)
    try {
      const response = await api<{ success: boolean; roomCode: string; hostToken: string; playerToken: string; session: Session }>(
        '/double-auction/solo',
        { method: 'POST', body: JSON.stringify({ name: 'Host', playAs: 'buyer' }) },
      )
      setRoomCodeInput(response.roomCode)
      // Keep solo UX in player mode to avoid host/player dual-control flicker.
      setHostToken(null)
      setPlayerToken(response.playerToken)
      setSession(response.session)
      setIsSoloMode(true)
    } catch (err) {
      if (err instanceof Error && /unauthorized|educator login required/i.test(err.message)) {
        window.location.href = '/educator-login'
        return
      }
      setError(err instanceof Error ? err.message : 'Failed to start solo test')
    } finally {
      setStartingSolo(false)
    }
  }

  const runQuickAction = async (action: 'start' | 'advance' | 'reset') => {
    if (!latestSession) return
    setQuickActionLoading(action)
    setQuickActionMessage(null)
    try {
      await educatorMiniGamesApi.hostAction(latestSession.id, action)
      setQuickActionMessage(`Session ${action} successful`)
      setSessionsRefreshKey((v) => v + 1)
    } catch (err) {
      setQuickActionMessage(err instanceof Error ? err.message : `Failed to ${action} session`)
    } finally {
      setQuickActionLoading(null)
    }
  }

  return (
    <MiniGameShell
      title="Double Auction"
      subtitle="Market Setup and Host Controls"
      sessionsGameType="double-auction"
      showSessionsTable={false}
      sessionsRefreshKey={sessionsRefreshKey}
      publicMode={hasPublicJoinContext}
    >
      <main className="auction-page">
        <section className="auction-shell">
        <header className="mg-page-hero auction-hero">
          <div className="auction-hero-main">
            <h1>{'\u{2696}\u{FE0F} DOUBLE AUCTION'}</h1>
            <p className="auction-sub">Supply, Demand, and the Invisible Hand</p>
          </div>
        </header>

        {!session ? (
          !authChecked ? (
            <div className="auction-card">Checking educator access...</div>
          ) : (!canAccessSetup && !hasPublicJoinContext) ? (
            <div className="auction-card">
              <h2>Educator Login Required</h2>
              <p style={{ color: 'var(--text-secondary)' }}>This setup page is restricted to educator accounts.</p>
              <button className="auction-btn primary" onClick={() => { window.location.href = '/educator-login' }}>
                Go to Educator Login
              </button>
            </div>
          ) : (
            <>
              <div className="auction-lobby-grid">
                <DoubleAuctionMissionBanner />
                <div className="auction-card">
                  <h2 style={{ marginBottom: '1.5rem' }}>Setup Your Market</h2>
                  {inviteLabel && (
                    <div style={{ marginBottom: '1rem', fontSize: '0.9rem', color: 'var(--accent-blue)', fontWeight: 700 }}>
                      Invite: {inviteLabel}
                    </div>
                  )}
                  <div className="auction-form">
                    {!hasPublicJoinContext ? (
                      <div style={{ display: 'grid', gap: '0.65rem' }}>
                        <button className="auction-btn primary" onClick={createSession} disabled={creatingSession}>
                          {creatingSession ? 'Creating...' : 'Create Session'}
                        </button>
                        <button className="auction-btn ghost" onClick={startSoloTest} disabled={startingSolo}>
                          {startingSolo ? 'Starting Solo...' : 'Play Solo Test'}
                        </button>
                        {!latestSession && sessionsRefreshKey === 0 && !sessionsFetching && (
                          <button type="button" className="mgsp-btn mgsp-secondary" style={{ fontSize: '0.85rem' }} onClick={() => setSessionsRefreshKey(1)}>
                            Load last session
                          </button>
                        )}
                        {!latestSession && sessionsFetching && (
                          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Loading session...</div>
                        )}
                        {latestSession && (
                          <div style={{ display: 'grid', gap: '0.65rem', marginTop: '0.25rem' }}>
                            <div className="mg-form-group">
                              <label>Latest Game Code</label>
                              <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <input className="mgsp-input" style={{ flex: 1, minWidth: 0, width: '100%' }} value={latestSession.roomCode || ''} readOnly />
                                <button
                                  className="mgsp-btn mgsp-secondary"
                                  type="button"
                                  aria-label="Copy game code"
                                  title="Copy game code"
                                  onClick={() => navigator.clipboard.writeText(latestSession.roomCode || '')}
                                >
                                  {'\u{1F4CB}'}
                                </button>
                              </div>
                            </div>
                            <div className="mg-form-group">
                              <label>Latest Join Link</label>
                              <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <input
                                  className="mgsp-input"
                                  style={{ flex: 1, minWidth: 0, width: '100%' }}
                                  value={latestSession.joinByCodeLink || `${window.location.origin}/mini-games/join?code=${encodeURIComponent(latestSession.roomCode || '')}`}
                                  readOnly
                                />
                                <button
                                  className="mgsp-btn mgsp-secondary"
                                  type="button"
                                  aria-label="Copy join link"
                                  title="Copy join link"
                                  onClick={() => navigator.clipboard.writeText(latestSession.joinByCodeLink || `${window.location.origin}/mini-games/join?code=${encodeURIComponent(latestSession.roomCode || '')}`)}
                                >
                                  {'\u{1F4CB}'}
                                </button>
                              </div>
                              <div style={{ marginTop: 12, display: 'flex', justifyContent: 'center', background: '#fff', borderRadius: 8, padding: 12 }}>
                                <QRCodeSVG value={latestSession.joinByCodeLink || `${window.location.origin}/mini-games/join?code=${encodeURIComponent(latestSession.roomCode || '')}`} size={200} bgColor="#ffffff" fgColor="#0f172a" level="M" />
                              </div>
                            </div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                              Status: <strong>{latestSession.status}</strong> | Joined: {latestSession.joinedCount || 0}/{latestSession.teamCount}
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                              <button
                                className="auction-btn ghost"
                                type="button"
                                disabled={quickActionLoading !== null || latestSession.status !== 'LOBBY'}
                                onClick={() => void runQuickAction('start')}
                              >
                                {quickActionLoading === 'start' ? 'Starting...' : latestSession.status === 'LOBBY' ? 'Start' : 'Started'}
                              </button>
                              <button
                                className="auction-btn ghost"
                                type="button"
                                disabled={quickActionLoading !== null || latestSession.status !== 'ACTIVE'}
                                onClick={() => void runQuickAction('advance')}
                              >
                                {quickActionLoading === 'advance' ? 'Advancing...' : 'Advance'}
                              </button>
                              <button
                                className="auction-btn ghost"
                                type="button"
                                disabled={quickActionLoading !== null || (latestSession.status !== 'ACTIVE' && latestSession.status !== 'COMPLETED')}
                                onClick={() => void runQuickAction('reset')}
                              >
                                {quickActionLoading === 'reset' ? 'Resetting...' : 'Reset'}
                              </button>
                            </div>
                            {quickActionMessage && (
                              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                {quickActionMessage}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <>
                        <div className="mg-form-group">
                          <label>Name</label>
                          <input className="auction-input" value={name} onChange={(e) => setName(e.target.value)} maxLength={24} />
                        </div>
                        <div className="mg-form-group">
                          <label>Room Code</label>
                          <input className="auction-input" value={roomCodeInput} onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())} maxLength={6} />
                        </div>
                        <button className="auction-btn primary" onClick={joinLiveRoom} disabled={loading || !roomCodeInput}>
                          Join Market
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
              {!hasPublicJoinContext && (
                <MiniGameSessionsTable gameType="double-auction" refreshKey={sessionsRefreshKey} />
              )}
            </>
          )
        ) : (
          <>
          <DoubleAuctionMissionBanner />
          {isSoloMode && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.75rem' }}>
              <button
                className="auction-btn ghost"
                onClick={() => { loadGuardRef.current += 1; setSession(null); setPlayerToken(null); setRoomCodeInput(''); setIsSoloMode(false) }}
              >
                ← Exit Solo Test
              </button>
            </div>
          )}
          <div className="auction-grid">
            <div className="auction-left-col">
              <div className="auction-stats">
                <div className="stat-box">
                  <div className="label">Current Day</div>
                  <div className="value">Round {session.currentRound}</div>
                </div>
                <div className="stat-box">
                  <div className="label">Price Range</div>
                  <div className="value">${session.config.minPrice} - ${session.config.maxPrice}</div>
                </div>
                <div className="stat-box">
                  <div className="label">Your Role</div>
                  <div className="value blue">{isHost ? 'HOST' : (myRole?.toUpperCase() || 'NOT ASSIGNED')}</div>
                </div>
                {myPrivate !== null && (
                  <div className="stat-box">
                    <div className="label">{myRole === 'buyer' ? 'Private Value' : 'Production Cost'}</div>
                    <div className="value emerald">${myPrivate}</div>
                  </div>
                )}
              </div>

              <div className="auction-card" style={{ marginBottom: '1.5rem' }}>
                <div className="auction-head" style={{ marginBottom: '1.5rem' }}>
                  <h2>Manage Your Interest</h2>
                  {viewer?.playerName && <span className="payout-badge">{viewer.playerName}</span>}
                </div>

                {session.phase === 'playing' && myRole ? (
                  <div className="auction-form">
                    <div className="mg-form-group">
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <label>{myRole === 'buyer' ? 'Your Maximum Bid' : 'Your Minimum Ask'}</label>
                        <span className="blue" style={{ fontWeight: '700', fontSize: '1.2rem' }}>${priceInput}</span>
                      </div>
                      <input
                        type="range"
                        style={{ width: '100%', cursor: 'pointer' }}
                        min={session.config.minPrice}
                        max={session.config.maxPrice}
                        value={priceInput}
                        onChange={(e) => {
                          const n = Number(e.target.value) || session.config.minPrice
                          setPriceInput(Math.max(session.config.minPrice, Math.min(session.config.maxPrice, n)))
                        }}
                      />
                    </div>
                    {myPrivate !== null && (
                      <div className={`stat-box ${previewProfit >= 0 ? 'emerald' : 'rose'}`} style={{ textAlign: 'center', background: 'rgba(255,255,255,0.03)' }}>
                        <div className="label">Expected Round Profit</div>
                        <div className="value">{previewProfit >= 0 ? '+' : ''}${previewProfit}</div>
                      </div>
                    )}
                    <button className="auction-btn primary" style={{ width: '100%' }} onClick={submitOrder} disabled={loading || viewer?.submitted}>
                      {viewer?.submitted ? 'Interest Submitted' : 'Submit My Interest'}
                    </button>
                    {viewer?.submitted && <p style={{ fontSize: '0.8rem', textAlign: 'center', color: 'var(--text-secondary)' }}>Waiting for the host to resolve the round...</p>}
                  </div>
                ) : session.phase === 'playing' ? (
                  <div style={{ textAlign: 'center', padding: '2rem' }}>
                    <p style={{ color: 'var(--text-secondary)' }}>The market is currently open for trading.</p>
                  </div>
                ) : session.phase === 'results' ? (
                  <div style={{ textAlign: 'center', padding: '1rem' }}>
                    <h3 className="emerald" style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Season Results</h3>
                    <p>Total Class Volume: <strong>{session.history[session.history.length - 1]?.tradeCount || 0} trades</strong></p>
                    <p>Avg Market Price: <strong>${session.history[session.history.length - 1]?.avgPrice || 0}</strong></p>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '2rem' }}>
                    <p style={{ color: 'var(--text-secondary)' }}>Waiting for the host to start the game.</p>
                    {hostSessionId && (
                      <button className="auction-btn primary" style={{ marginTop: '1rem' }} onClick={claimHostControl} disabled={claimingHost}>
                        {claimingHost ? 'Opening host controls...' : 'Take Host Control'}
                      </button>
                    )}
                  </div>
                )}
              </div>

              {isHost && (
                <div className="auction-card" style={{ borderColor: 'var(--accent-blue)', marginBottom: '1.5rem' }}>
                  <h2>Market Control Panel</h2>
                  <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                    {session.phase === 'lobby' && (
                      <button className="auction-btn primary" style={{ flex: 1 }} onClick={startLiveGame} disabled={loading || session.players.length === 0}>
                        <IconGavel /> Start Season 1
                      </button>
                    )}
                    {session.phase === 'playing' && (
                      <button className="auction-btn primary" style={{ flex: 1 }} onClick={closeRound} disabled={loading}>
                        <IconTrendingUp /> Resolve Market & Advance
                      </button>
                    )}
                    <button className="auction-btn ghost" onClick={resetGame} disabled={loading}>Reset</button>
                  </div>
                  {session.phase === 'lobby' && session.players.length === 0 && (
                    <p style={{ fontSize: '0.8rem', color: 'var(--accent-rose)', marginTop: '0.5rem' }}>Wait for at least one student to join.</p>
                  )}
                </div>
              )}

            </div>

            <div className="auction-right-col">
              <div className="auction-card" style={{ marginBottom: '1.5rem' }}>
                <h2>Historical Clearing Prices</h2>
                {session.history.length === 0 ? (
                  <p className="muted" style={{ marginTop: '1rem' }}>No data points available yet.</p>
                ) : (
                  <table className="auction-table" style={{ marginTop: '1rem' }}>
                    <thead>
                      <tr>
                        <th>Season</th>
                        <th>Volume</th>
                        <th style={{ textAlign: 'right' }}>Avg Price</th>
                      </tr>
                    </thead>
                    <tbody>
                      {session.history.map((row) => (
                        <tr key={row.round}>
                          <td>Round {row.round}</td>
                          <td>{row.tradeCount}</td>
                          <td style={{ textAlign: 'right' }} className="blue">${row.avgPrice === null ? '-' : row.avgPrice}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              <div className="auction-card" style={{ marginBottom: '1.5rem' }}>
                <h2><IconUsers /> Trader Rankings</h2>
                <table className="auction-table">
                  <thead>
                    <tr>
                      <th>Trader</th>
                      <th>Role</th>
                      <th style={{ textAlign: 'right' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {session.players.length === 0 ? (
                      <tr>
                        <td colSpan={3} style={{ color: 'var(--text-secondary)' }}>No traders joined yet.</td>
                      </tr>
                    ) : (
                      session.players
                        .slice()
                        .sort((a, b) => b.totalProfit - a.totalProfit)
                        .map((player) => (
                          <tr key={player.id}>
                            <td style={{ fontWeight: player.id === viewer?.playerId ? '700' : '400' }}>
                              {player.name} {player.id === viewer?.playerId && '(You)'}
                            </td>
                            <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{player.role?.toUpperCase() || 'PENDING'}</td>
                            <td style={{ textAlign: 'right' }}>
                              <span className="payout-badge">${player.totalProfit}</span>
                            </td>
                          </tr>
                        ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="auction-card" style={{ marginBottom: '1.5rem' }}>
                <h2><IconActivity /> Activity Feed</h2>
                <div style={{ maxHeight: '220px', overflowY: 'auto', marginTop: '1rem' }}>
                  {session.eventLog.length === 0 ? (
                    <p className="muted">No activity yet.</p>
                  ) : (
                    session.eventLog.map((line, idx) => (
                      <div key={idx} className="event-item">
                        <span className="event-time">&bull;</span>
                        <span>{line}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="auction-card" style={{ marginBottom: '1.5rem' }}>
                <h2>Joined Players ({session.players.length})</h2>
                <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
                  {session.players.map((p) => (
                    <span key={p.id} className="auction-player-pill">
                      {p.name} {p.id === viewer?.playerId ? '(You)' : ''}
                    </span>
                  ))}
                </div>
              </div>

            </div>
          </div>
          </>
        )}

        {error && (
          <div className="auction-error" style={{ position: 'fixed', bottom: '2rem', right: '2rem', background: 'rgba(244, 63, 94, 0.2)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--accent-rose)' }}>
            {`Warning: ${error}`}
          </div>
        )}
        </section>
      </main >
    </MiniGameShell>
  )
}
