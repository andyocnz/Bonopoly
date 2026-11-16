import { useEffect, useMemo, useRef, useState } from 'react'
import { MiniGameShell } from '../features/minigames/MiniGameShell'
import { getEducatorSessionCached, getEducatorSessionSync } from '../features/minigames/educatorSession'
import { educatorMiniGamesApi } from '../features/minigames/api'
import { MiniGameSessionsTable } from '../features/minigames/MiniGameSessionsTable'
import SessionControlPanel from '../features/minigames/SessionControlPanel'
import type { EducatorMiniGameSession } from '../api/client'
import type { EducatorMiniGamePlayer } from '../api/client'
import './FisheryMiniGamePage.css'

type FisheryMode = 'classic' | 'quota'

type Player = {
  id: string
  name: string
  isBot: boolean
  totalCatch: number
  lastCatch: number
}

type RoundHistory = {
  round: number
  stockStart: number
  intendedTotal: number
  actualTotal: number
  stockAfterHarvest: number
  stockAfterReproduction: number
  actions: Array<{ playerId: string; playerName: string; intended: number; actual: number }>
}

type Session = {
  roomCode: string
  phase: 'lobby' | 'playing' | 'results'
  currentRound: number
  config: {
    mode: FisheryMode
    rounds: number
    capacityPerPlayer: number
    quotaPerPlayer: number
  }
  stock: number
  stockCapacity: number
  players: Player[]
  history: RoundHistory[]
  stats: {
    actedCount: number
    waitingCount: number
  }
  eventLog: string[]
}

type Viewer = {
  isHost: boolean
  playerId: string | null
  playerName: string | null
  submitted: boolean
}

const STORAGE_KEY = 'fishery_minigame_v1'
const ACTIVE_SESSION_KEY = 'fishery_active_session_id_v1'

type Tokens = {
  roomCode: string
  hostToken: string | null
  playerToken: string | null
  playerName: string | null
}

const EMPTY_TOKENS: Tokens = {
  roomCode: '',
  hostToken: null,
  playerToken: null,
  playerName: null,
}

// Icons
const IconFish = () => <span aria-hidden="true">{'\u{1F41F}'}</span>

const IconAnchor = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="5" r="3" />
    <line x1="12" y1="8" x2="12" y2="22" />
    <path d="M5 12H2a10 10 0 0 0 20 0h-3" />
  </svg>
)

const IconWaves = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 6c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.5 0 2.5 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
    <path d="M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.5 0 2.5 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
    <path d="M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.5 0 2.5 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
  </svg>
)

// --- ANIMATED OCEAN VIEW ---
// --- ANIMATED OCEAN VIEW ---
const FisheryOceanView = ({ stock, capacity, isLobby = false }: { stock: number; capacity: number; isLobby?: boolean }) => {
  const stockPct = Math.min(100, (stock / Math.max(1, capacity)) * 100)
  const renderStockPct = isLobby ? 45 : stockPct
  const fishCount = Math.max(3, Math.floor((renderStockPct / 100) * 20))
  const bubbleSeeds = useMemo(
    () => [...Array(8)].map((_, i) => ({
      left: (i * 11 + 7) % 100,
      size: 10 + (i % 5) * 3,
      delay: (i % 4) * 0.6,
      duration: 4 + (i % 3) * 1.25,
    })),
    [],
  )
  const fishSeeds = useMemo(
    () => [...Array(Math.max(1, fishCount))].map((_, i) => {
      const depth = 20 + ((i * 13) % 60)
      const duration = 12 + ((i * 5) % 12)
      return {
        key: i,
        depth,
        duration,
        delay: -(((i * 7) % 100) / 100) * duration,
        anim: i % 2 === 0 ? 'swim' : 'swim-alt',
        wagDuration: 0.2 + ((i * 3) % 4) * 0.1,
        fontSize: 1.2 + ((i * 2) % 4) * 0.2,
      }
    }),
    [fishCount],
  )

  return (
    <div className="fishery-ocean-view">
      {bubbleSeeds.map((seed, i) => (
        <div
          key={i}
          className="ocean-bubble"
          style={{
            left: `${seed.left}%`,
            width: `${seed.size}px`,
            height: `${seed.size}px`,
            animationDelay: `${seed.delay}s`,
            animationDuration: `${seed.duration}s`,
          }}
        />
      ))}
      <div className="fish-container">
        {fishSeeds.map((seed) => (
          <div
            key={seed.key}
            className="animated-fish"
            style={{
              top: `${seed.depth}%`,
              left: 0,
              width: '100%',
              fontSize: `${seed.fontSize}rem`,
              animation: `${seed.anim} ${seed.duration}s infinite linear`,
              animationDelay: `${seed.delay}s`,
              opacity: (isLobby || stock > 0) ? 0.85 : 0.1,
              zIndex: Math.floor(seed.depth),
            }}
          >
            <span className="fish-emoji" style={{ animationDuration: `${seed.wagDuration}s` }} aria-hidden="true">
              {'\u{1F41F}'}
            </span>
          </div>
        ))}
        {!isLobby && stock <= 0 && (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            color: 'var(--accent-rose)',
            fontWeight: '800',
            fontSize: '1.5rem',
            textAlign: 'center',
            textShadow: '0 2px 10px rgba(0,0,0,0.5)',
          }}>
            ECOSYSTEM COLLAPSED
          </div>
        )}
      </div>
    </div>
  )
}
function loadTokens(): Tokens {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') as Tokens | null
    return parsed ? { ...EMPTY_TOKENS, ...parsed } : EMPTY_TOKENS
  } catch {
    return EMPTY_TOKENS
  }
}

function saveTokens(tokens: Tokens) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens))
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

export default function FisheryMiniGamePage() {
  const saved = useMemo(loadTokens, [])
  const query = useMemo(() => new URLSearchParams(window.location.search), [])
  const inviteToken = (query.get('invite') || '').trim()
  const roomFromUrl = (query.get('room') || '').trim().toUpperCase()
  const nameFromUrl = (query.get('name') || '').trim()
  const hostTokenFromUrl = (query.get('hostToken') || '').trim()
  const savedRoomCode = (saved.roomCode || '').trim().toUpperCase()
  const canReuseSavedSession = !roomFromUrl || savedRoomCode === roomFromUrl

  const [roomCodeInput, setRoomCodeInput] = useState(roomFromUrl || savedRoomCode)
  const [nameInput, setNameInput] = useState(nameFromUrl || (canReuseSavedSession ? saved.playerName || '' : ''))
  const [hostToken, setHostToken] = useState<string | null>(hostTokenFromUrl || (canReuseSavedSession ? saved.hostToken : null))
  const [playerToken, setPlayerToken] = useState<string | null>(canReuseSavedSession ? saved.playerToken : null)
  const [session, setSession] = useState<Session | null>(null)
  const [viewer, setViewer] = useState<Viewer | null>(null)
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
  const [fisherySessions, setFisherySessions] = useState<EducatorMiniGameSession[]>([])
  const [activeSessionPlayers, setActiveSessionPlayers] = useState<EducatorMiniGamePlayer[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(ACTIVE_SESSION_KEY)
    } catch {
      return null
    }
  })
  const [quickActionLoading, setQuickActionLoading] = useState<'start' | 'advance' | 'reset' | null>(null)
  const [quickActionMessage, setQuickActionMessage] = useState<string | null>(null)
  const autoJoinAttemptedRef = useRef(false)

  const [catchVal, setCatchVal] = useState(0)

  const roomCode = (session?.roomCode || roomCodeInput || '').toUpperCase()
  const canPoll = Boolean(roomCode && (hostToken || playerToken))
  const isHost = viewer?.isHost || Boolean(hostToken)
  const toUiError = (err: unknown, fallback: string) => {
    const message = err instanceof Error ? err.message : fallback
    if (/game already started/i.test(message)) {
      return 'Game already started. Join is locked after host starts.'
    }
    return message || fallback
  }

  useEffect(() => {
    saveTokens({
      roomCode,
      hostToken,
      playerToken,
      playerName: nameInput || null,
    })
  }, [roomCode, hostToken, playerToken, nameInput])

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
        if (response.invite.teamLabel && !nameFromUrl && !nameInput) {
          setNameInput(response.invite.teamLabel)
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
  }, [inviteToken, roomFromUrl, nameFromUrl, nameInput])

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

  const loadFisherySessions = async () => {
    if (hasPublicJoinContext) return
    setSessionsFetching(true)
    try {
      const sessions = await educatorMiniGamesApi.listSessions()
      const fishery = sessions
        .filter((s) => s.gameType === 'fishery')
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      setFisherySessions(fishery)
      if (fishery.length === 0) {
        setActiveSessionId(null)
      } else if (!activeSessionId || !fishery.some((s) => s.id === activeSessionId)) {
        setActiveSessionId(fishery[0].id)
      }
    } catch {
      setFisherySessions([])
      setActiveSessionId(null)
    } finally { setSessionsFetching(false) }
  }

  const loadActiveSessionPlayers = async (sessionIdOverride?: string | null) => {
    const targetSessionId = sessionIdOverride ?? activeSessionId
    if (!targetSessionId) {
      setActiveSessionPlayers([])
      return
    }
    try {
      const players = await educatorMiniGamesApi.getSessionPlayers(targetSessionId)
      setActiveSessionPlayers(players.filter((p) => !p.isBot))
    } catch {
      setActiveSessionPlayers([])
    }
  }

  useEffect(() => {
    if (hasPublicJoinContext || !authChecked || !canAccessSetup || sessionsRefreshKey === 0) return
    void loadFisherySessions()
  }, [hasPublicJoinContext, authChecked, canAccessSetup, sessionsRefreshKey, activeSessionId])

  useEffect(() => {
    if (hasPublicJoinContext || !authChecked || !canAccessSetup) return
    if (sessionsRefreshKey === 0) return
    if (session) return
    if (!activeSessionId) return
    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return
      void loadFisherySessions()
      void loadActiveSessionPlayers()
    }, 4000)
    return () => window.clearInterval(timer)
  }, [hasPublicJoinContext, authChecked, canAccessSetup, session, activeSessionId, sessionsRefreshKey])

  useEffect(() => {
    if (hasPublicJoinContext || !authChecked || !canAccessSetup) return
    if (sessionsRefreshKey === 0) return
    if (session) return
    void loadActiveSessionPlayers()
  }, [hasPublicJoinContext, authChecked, canAccessSetup, session, activeSessionId, sessionsRefreshKey])

  const loadState = async (overrides?: { roomCode?: string; hostToken?: string | null; playerToken?: string | null }) => {
    const effectiveRoomCode = (overrides?.roomCode || roomCode || '').toUpperCase()
    if (!effectiveRoomCode) return
    const qs = new URLSearchParams()
    const effectiveHostToken = overrides?.hostToken ?? hostToken
    const effectivePlayerToken = overrides?.playerToken ?? playerToken
    if (effectiveHostToken) qs.set('hostToken', effectiveHostToken)
    if (effectivePlayerToken) qs.set('playerToken', effectivePlayerToken)
    try {
      const response = await api<{ success: boolean; session: Session; viewer: Viewer }>(`/fishery/${effectiveRoomCode}/state?${qs.toString()}`)
      setSession(response.session)
      setViewer(response.viewer)
      setError(null)
    } catch (err) {
      console.error('State poll failed', err)
    }
  }

  useEffect(() => {
    if (!canPoll) return
    void loadState()
    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return
      void loadState()
    }, 2000)
    return () => window.clearInterval(timer)
  }, [canPoll, roomCode, hostToken, playerToken])

  const joinRoom = async () => {
    if (!nameInput) { setError('Please enter a name'); return }
    setLoading(true)
    setError(null)
    try {
      const code = roomCodeInput.trim().toUpperCase()
      const res = await api<{ success: boolean; playerToken: string; session: Session }>(`/fishery/${code}/join`, {
        method: 'POST',
        body: JSON.stringify({ name: nameInput }),
      })
      setRoomCodeInput(code)
      setPlayerToken(res.playerToken)
      await loadState({ roomCode: code, playerToken: res.playerToken, hostToken: null })
    } catch (err) {
      setError(toUiError(err, 'Failed to join room'))
    } finally {
      setLoading(false)
    }
  }

  const startGame = async () => {
    if (!hostToken || !roomCode) return
    setLoading(true)
    setError(null)
    try {
      await api<{ success: boolean; session: Session }>(`/fishery/${roomCode}/start`, {
        method: 'POST',
        body: JSON.stringify({ hostToken }),
      })
      await loadState()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start game')
    } finally {
      setLoading(false)
    }
  }

  const submitCatch = async () => {
    if (!playerToken || !roomCode) return
    setLoading(true)
    setError(null)
    try {
      const shouldAutoAdvanceSolo = Boolean(
        hostToken &&
        session?.phase === 'playing' &&
        session.players.filter((p) => !p.isBot).length === 1
      )
      await api<{ success: boolean; session: Session }>(`/fishery/${roomCode}/action`, {
        method: 'POST',
        body: JSON.stringify({ playerToken, catch: catchVal }),
      })
      if (shouldAutoAdvanceSolo && hostToken) {
        await api<{ success: boolean; session: Session }>(`/fishery/${roomCode}/advance`, {
          method: 'POST',
          body: JSON.stringify({ hostToken }),
        })
        setCatchVal(0)
      }
      await loadState()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit catch')
    } finally {
      setLoading(false)
    }
  }

  const advanceRound = async () => {
    if (!hostToken || !roomCode) return
    setLoading(true)
    setError(null)
    try {
      await api<{ success: boolean; session: Session }>(`/fishery/${roomCode}/advance`, {
        method: 'POST',
        body: JSON.stringify({ hostToken }),
      })
      setCatchVal(0)
      await loadState()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to close round')
    } finally {
      setLoading(false)
    }
  }

  const resetGame = async () => {
    if (!hostToken || !roomCode) return
    if (!confirm('Are you sure you want to reset the entire game?')) return
    setLoading(true)
    setError(null)
    try {
      await api<{ success: boolean; session: Session }>(`/fishery/${roomCode}/reset`, {
        method: 'POST',
        body: JSON.stringify({ hostToken }),
      })
      setCatchVal(0)
      await loadState()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset game')
    } finally {
      setLoading(false)
    }
  }

  const leave = () => {
    saveTokens(EMPTY_TOKENS)
    setHostToken(null)
    setPlayerToken(null)
    setSession(null)
    setViewer(null)
    setError(null)
    setRoomCodeInput('')
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
        const response = await api<{ success: boolean; playerToken: string; session: Session }>(`/fishery/${code}/join`, {
          method: 'POST',
          body: JSON.stringify({ name: nameFromUrl.trim() }),
        })
        setRoomCodeInput(code)
        setPlayerToken(response.playerToken)
        setSession(response.session)
      } catch (err) {
        setError(toUiError(err, 'Failed to join room'))
      } finally {
        setLoading(false)
      }
    })()
  }, [roomFromUrl, nameFromUrl, hostTokenFromUrl, session, hostToken, playerToken])

  const myPlayer = session?.players.find((p) => p.id === viewer?.playerId) || null
  const maxCatchNow = session
    ? (session.config.mode === 'quota' ? session.config.quotaPerPlayer : session.stock)
    : 0
  const stockPct = session ? Math.min(100, (session.stock / session.stockCapacity) * 100) : 0
  const isLobbyPhase = session?.phase === 'lobby'
  const activeSession = useMemo(
    () => fisherySessions.find((s) => s.id === activeSessionId) || fisherySessions[0] || null,
    [fisherySessions, activeSessionId],
  )

  useEffect(() => {
    try {
      if (activeSession?.id) {
        localStorage.setItem(ACTIVE_SESSION_KEY, activeSession.id)
      } else {
        localStorage.removeItem(ACTIVE_SESSION_KEY)
      }
    } catch {
      // Ignore storage failures.
    }
  }, [activeSession?.id])

  if (!session) {
    const createSession = async () => {
      setCreatingSession(true)
      setError(null)
      setQuickActionMessage(null)
      try {
        const created = await educatorMiniGamesApi.createSession({ gameType: 'fishery', teamCount: 40 })
        setActiveSessionId(created.session.id)
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
          '/fishery/solo',
          {
            method: 'POST',
            body: JSON.stringify({ name: 'Host' }),
          },
        )
        setRoomCodeInput(response.roomCode)
        setHostToken(response.hostToken)
        setPlayerToken(response.playerToken)
        setSession(response.session)
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
      if (!activeSession) return
      setQuickActionLoading(action)
      setQuickActionMessage(null)
      try {
        await educatorMiniGamesApi.hostAction(activeSession.id, action)
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
        title="Fishery"
        subtitle="Commons and Sustainability Setup"
        sessionsGameType="fishery"
        showSessionsTable={false}
        sessionsRefreshKey={sessionsRefreshKey}
        publicMode={hasPublicJoinContext}
      >
        <main className="fishery-page">
          <section className="fishery-shell">
          {!hasPublicJoinContext && !authChecked ? (
            <div className="fishery-card">Checking educator access...</div>
          ) : !hasPublicJoinContext && !canAccessSetup ? (
            <div className="fishery-card">
              <h2>Educator Login Required</h2>
              <p style={{ color: 'var(--text-secondary)' }}>This setup page is restricted to educator accounts.</p>
              <button className="fishery-btn primary" onClick={() => { window.location.href = '/educator-login' }}>
                Go to Educator Login
              </button>
            </div>
          ) : (
          <>
          <div className="fishery-hero mg-page-hero">
            <h1>{'\u{1F41F} FISHERY COMMONS'}</h1>
            <p className="fishery-sub">A Tragedy of the Commons Simulation</p>
          </div>

          <div className="fishery-lobby-grid">
          <div className="fishery-mission-banner">
            <h2 style={{ fontSize: '1.2rem', color: 'var(--accent-blue)', marginBottom: '1rem' }}>{'\u{1F3AF} The Mission: Harvest vs. Sustainability'}</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', fontSize: '0.95rem' }}>
              <div style={{ borderLeft: '3px solid var(--accent-emerald)', paddingLeft: '1rem' }}>
                <p style={{ color: 'var(--text-primary)', fontWeight: '700', marginBottom: '0.5rem' }}>{'\u{1F91D} THE COLLECTIVE GOAL'}</p>
                <p>Maintain a healthy fish stock. If everyone takes just enough, the fish reproduce and the industry thrives forever.</p>
              </div>
              <div style={{ borderLeft: '3px solid var(--accent-amber)', paddingLeft: '1rem' }}>
                <p style={{ color: 'var(--accent-amber)', fontWeight: '700', marginBottom: '0.5rem' }}>{'\u{1F3C3}\u200D\u2642\uFE0F THE GREED TRAP'}</p>
                <p>Taking more fish now increases your personal score, but it reduces the growth rate for everyone next season.</p>
              </div>
              <div style={{ borderLeft: '3px solid var(--accent-rose)', paddingLeft: '1rem' }}>
                <p style={{ color: 'var(--accent-rose)', fontWeight: '700', marginBottom: '0.5rem' }}>{'\u{1F480} THE COLLAPSE'}</p>
                <p>If the stock hits zero, the ocean is dead. The game ends immediately and everyone loses their livelihood.</p>
              </div>
            </div>
          </div>

          <div className="fishery-card">
              {/* Join Class tab hidden â€” setup page is educator-only */}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {inviteLabel && (
                <div style={{ fontSize: '0.9rem', color: 'var(--accent-sea, #38bdf8)', fontWeight: 700 }}>
                  Invite: {inviteLabel}
                </div>
              )}
              {!hasPublicJoinContext ? (
                <>
                  <SessionControlPanel
                    creatingSession={creatingSession}
                    onCreateSession={() => void createSession()}
                    startingSolo={startingSolo}
                    onStartSolo={() => void startSoloTest()}
                    sessions={fisherySessions}
                    activeSessionId={activeSessionId}
                    onActiveSessionChange={setActiveSessionId}
                    onQuickAction={(action) => void runQuickAction(action)}
                    quickActionLoading={quickActionLoading}
                    quickActionMessage={quickActionMessage}
                    joinedNames={activeSessionPlayers.map((p) => p.name)}
                    disableStart={activeSessionPlayers.length < 1}
                  />
                  {fisherySessions.length === 0 && sessionsRefreshKey === 0 && (
                    <button type="button" className="mgsp-btn mgsp-secondary" style={{ fontSize: '0.85rem' }} onClick={() => setSessionsRefreshKey(1)}>
                      Load last session
                    </button>
                  )}
                  {sessionsRefreshKey > 0 && sessionsFetching && fisherySessions.length === 0 && (
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Loading session...</div>
                  )}
                </>
              ) : (
                <>
                  <div className="fishery-form-group">
                    <label>Room Code</label>
                    <input className="fishery-input" value={roomCodeInput} onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())} placeholder="e.g. FISHY" />
                  </div>
                  <button className="fishery-btn primary" onClick={joinRoom} disabled={loading || !roomCodeInput}>Join Ocean</button>
                </>
              )}
            </div>
          </div>
          </div>{/* fishery-lobby-grid */}
          {!hasPublicJoinContext && sessionsRefreshKey > 0 && (
            <MiniGameSessionsTable gameType="fishery" refreshKey={sessionsRefreshKey} />
          )}
          {error && <div className="rose" style={{ marginTop: '1rem', textAlign: 'center', fontWeight: '600' }}>{`Warning: ${error}`}</div>}
          </>
          )}
          </section>
        </main >
      </MiniGameShell>
    )
  }

  return (
    <MiniGameShell
      title="Fishery"
      subtitle="Commons and Sustainability Setup"
      sessionsGameType="fishery"
      showSessionsTable={false}
      sessionsRefreshKey={sessionsRefreshKey}
      publicMode={hasPublicJoinContext}
    >
      <main className="fishery-page">
      <section className="fishery-shell">
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <div>
            <h1 style={{ fontSize: '1.8rem', margin: 0 }}>FISHERY: <span className="blue">ROOM {session.roomCode}</span></h1>
            <div style={{ display: 'flex', gap: '0.8rem', marginTop: '0.5rem' }}>
              <span className={`stat-box`} style={{ padding: '0.2rem 0.6rem', fontSize: '0.7rem' }}>ROUND {session.currentRound} / {session.config.rounds}</span>
              <span className={`stat-box`} style={{ padding: '0.2rem 0.6rem', fontSize: '0.7rem' }}>MODE: {session.config.mode.toUpperCase()}</span>
            </div>
          </div>
          <button className="fishery-btn ghost" onClick={leave}>Exit Room</button>
        </header>

        <div className="fishery-mission-banner" style={{ marginBottom: '1.5rem', padding: '1.2rem' }}>
          <h2 style={{ fontSize: '1rem', color: 'var(--accent-blue)', marginBottom: '0.8rem' }}>{'\u{1F3AF} The Mission: Harvest vs. Sustainability'}</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', fontSize: '0.9rem' }}>
            <div style={{ borderLeft: '3px solid var(--accent-emerald)', paddingLeft: '0.8rem' }}>
              <p style={{ color: 'var(--text-primary)', fontWeight: '700', marginBottom: '0.4rem' }}>{'\u{1F91D} THE COLLECTIVE GOAL'}</p>
              <p>Maintain a healthy fish stock. If everyone takes just enough, the fish reproduce and the industry thrives forever.</p>
            </div>
            <div style={{ borderLeft: '3px solid var(--accent-amber)', paddingLeft: '0.8rem' }}>
              <p style={{ color: 'var(--accent-amber)', fontWeight: '700', marginBottom: '0.4rem' }}>{'\u{1F3C3}\u200D\u2642\uFE0F THE GREED TRAP'}</p>
              <p>Taking more fish now increases your personal score, but it reduces the growth rate for everyone next season.</p>
            </div>
            <div style={{ borderLeft: '3px solid var(--accent-rose)', paddingLeft: '0.8rem' }}>
              <p style={{ color: 'var(--accent-rose)', fontWeight: '700', marginBottom: '0.4rem' }}>{'\u{1F480} THE COLLAPSE'}</p>
              <p>If the stock hits zero, the ocean is dead. The game ends immediately and everyone loses their livelihood.</p>
            </div>
          </div>
        </div>

        <div className="fishery-game-layout">
          <div className="fishery-main-col">
            <div className="fishery-stats">
              <div className="stat-box">
                <div className="label"><IconFish /> Total Stock</div>
                <div className={`value ${isLobbyPhase ? 'blue' : session.stock < session.stockCapacity * 0.2 ? 'rose' : 'emerald'}`}>
                  {isLobbyPhase ? 'Pending' : session.stock}
                </div>
              </div>
              <div className="stat-box">
                <div className="label"><IconAnchor /> Your Payout</div>
                <div className="value blue">${myPlayer?.totalCatch || 0}</div>
              </div>
              <div className="stat-box">
                <div className="label"><IconWaves /> Reproduction Rate</div>
                <div className="value">2.0x (capped)</div>
              </div>
            </div>

            <div className="fishery-card stock-container" style={{ marginBottom: '1rem' }}>
              <div className="stock-header">
                <span>Oceanic Biomass Health</span>
                <span className={isLobbyPhase ? 'blue' : stockPct < 30 ? 'rose pulse' : 'emerald'}>
                  {isLobbyPhase ? 'Pending' : `${Math.round(stockPct)}% Capacity`}
                </span>
              </div>
              <div className="stock-bar-bg">
                <div className={`stock-bar-fill ${!isLobbyPhase && stockPct < 30 ? 'warning' : ''}`} style={{ width: `${isLobbyPhase ? 0 : stockPct}%` }} />
              </div>
              <p style={{ marginTop: '0.8rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                {isLobbyPhase
                  ? 'Biomass and reproduction initialize once the host starts the game.'
                  : stockPct > 60
                    ? "The ecosystem is healthy and thriving."
                    : stockPct > 20
                      ? "Warning: Overfishing is reducing reproduction potential."
                      : "CRITICAL: The ecosystem is on the verge of total collapse."}
              </p>
            </div>

            <div className="fishery-card" style={{ marginBottom: '1rem' }}>
              <h2 style={{ marginBottom: '0.8rem' }}>Ocean View</h2>
              <FisheryOceanView stock={session.stock} capacity={session.stockCapacity} isLobby={isLobbyPhase} />
            </div>

            {session.phase === 'playing' && myPlayer && (
              <div className="fishery-card" style={{ marginBottom: '1rem', border: '2px solid var(--accent-blue)' }}>
                <h2>Your Season Harvest</h2>
                <div style={{ marginTop: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <label>Amount to Catch</label>
                    <span className="blue" style={{ fontWeight: '700', fontSize: '1.2rem' }}>{catchVal} Units</span>
                  </div>
                  <input
                    type="range"
                    style={{ width: '100%', cursor: 'pointer' }}
                    min={0}
                    max={maxCatchNow}
                    value={catchVal}
                    onChange={(e) => setCatchVal(Number(e.target.value))}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.4rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    <span>0</span>
                    <span>Max: {maxCatchNow}</span>
                  </div>
                  <button className="fishery-btn primary" style={{ width: '100%', marginTop: '1.2rem' }} onClick={submitCatch} disabled={loading || viewer?.submitted}>
                    {viewer?.submitted ? 'Season Submitted' : 'Submit Harvest'}
                  </button>
                </div>
              </div>
            )}

            {session.phase === 'lobby' && (
              <div className="fishery-card" style={{ marginBottom: '1rem', textAlign: 'center' }}>
                {isHost ? (
                  <>
                    <h2>Ready to Start?</h2>
                    <p style={{ color: 'var(--text-secondary)' }}>Waiting for students to join this room.</p>
                    <button className="fishery-btn primary" style={{ marginTop: '0.8rem' }} onClick={startGame} disabled={loading}>
                      Start Season 1
                    </button>
                  </>
                ) : (
                  <>
                    <h2>Waiting For Host</h2>
                    <p style={{ color: 'var(--text-secondary)' }}>The educator has not started this game yet.</p>
                  </>
                )}
              </div>
            )}

            {session.phase === 'results' && (
              <div className="fishery-card" style={{ marginBottom: '1rem', border: '2px solid var(--accent-amber)' }}>
                <h2>Oceanic Assessment</h2>
                <div style={{ textAlign: 'center', padding: '1rem' }}>
                  {session.stock <= 0 ? (
                    <>
                      <p className="rose" style={{ fontSize: '1.2rem', fontWeight: '700' }}>{'\u{1F480} THE OCEAN HAS COLLAPSED'}</p>
                      <p style={{ margin: '1rem 0' }}>This is a classic <strong>Tragedy of the Commons</strong>. Individual incentives to harvest more led to collapse.</p>
                    </>
                  ) : (
                    <>
                      <p className="emerald" style={{ fontSize: '1.2rem', fontWeight: '700' }}>{'\u{1F30A} THE FISHERY PERSISTS'}</p>
                      <p style={{ margin: '1rem 0' }}>Collective restraint preserved the ecosystem.</p>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="fishery-sidebar">
            <div className="fishery-card" style={{ marginBottom: '1rem' }}>
              <h2>Leaderboard</h2>
              <table className="fishery-table">
                <thead>
                  <tr>
                    <th>Boat/Captain</th>
                    <th style={{ textAlign: 'right' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {session.players.slice().sort((a, b) => b.totalCatch - a.totalCatch).map(p => (
                    <tr key={p.id}>
                      <td>{p.name} {p.id === viewer?.playerId ? '(You)' : ''}</td>
                      <td style={{ textAlign: 'right', fontWeight: '700' }} className="blue">${p.totalCatch}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {isHost && session.phase === 'playing' && (
              <div className="fishery-card" style={{ marginBottom: '1rem', borderColor: 'var(--accent-blue)' }}>
                <h2>Host Controls</h2>
                <div style={{ marginBottom: '0.8rem', fontSize: '0.85rem' }}>
                  <p style={{ marginBottom: '0.4rem' }}><strong>Harvest Progress:</strong> {session.stats.actedCount} / {session.stats.waitingCount}</p>
                  <div className="stock-bar-bg" style={{ height: '6px' }}>
                    <div className="stock-bar-fill" style={{ width: `${(session.stats.actedCount / Math.max(1, session.stats.waitingCount)) * 100}%` }} />
                  </div>
                </div>
                <button className="fishery-btn primary" style={{ width: '100%' }} onClick={advanceRound} disabled={loading}>
                  End Season & Reproduce
                </button>
                <button className="fishery-btn ghost" style={{ width: '100%', marginTop: '0.6rem' }} onClick={resetGame} disabled={loading}>
                  Reset Simulation
                </button>
              </div>
            )}

            <div className="fishery-card" style={{ marginBottom: '1rem' }}>
              <h2>Activity Feed</h2>
              <div style={{ maxHeight: '220px', overflowY: 'auto', marginTop: '0.6rem' }}>
                {session.eventLog.map((evt, idx) => (
                  <div key={idx} style={{ padding: '0.45rem 0', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.9rem' }}>
                    <span style={{ color: 'var(--text-secondary)', marginRight: '0.5rem' }}>•</span>{evt}
                  </div>
                ))}
              </div>
            </div>

            <div className="fishery-card">
              <h2>Joined Players ({session.players.length})</h2>
              <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
                {session.players.map((p) => (
                  <span key={p.id} className="fishery-player-pill">
                    {p.name}{p.id === viewer?.playerId ? ' (You)' : ''}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </main >
    </MiniGameShell>
  )
}
