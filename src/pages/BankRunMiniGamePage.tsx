import { QRCodeSVG } from 'qrcode.react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { MiniGameShell } from '../features/minigames/MiniGameShell'
import { getEducatorSessionCached, getEducatorSessionSync } from '../features/minigames/educatorSession'
import { educatorMiniGamesApi } from '../features/minigames/api'
import { MiniGameSessionsTable } from '../features/minigames/MiniGameSessionsTable'
import type { EducatorMiniGameSession } from '../api/client'
import './BankRunMiniGamePage.css'
import '../features/minigames/SessionControlPanel.css'

type PublicPlayer = {
  id: string
  name: string
  withdrawnDay: number | null
  earlyPayout: number
  finalPayout: number
  totalPayout: number
}

type SessionState = {
  roomCode: string
  phase: 'lobby' | 'playing' | 'results'
  currentDay: number
  config: {
    deposit: number
    maturityPayout: number
    liquidityRatio: number
    liquidationPenalty: number
    totalDays: number
  }
  remainingLiquidity: number
  remainingMaturityPool: number
  players: PublicPlayer[]
  stats: {
    totalPlayers: number
    withdrawnCount: number
    waitingCount: number
    actedCount: number
  }
  eventLog: string[]
}

type ViewerState = {
  isHost: boolean
  playerId: string | null
  playerName: string | null
  hasWithdrawn: boolean
  hasSubmittedToday: boolean
  currentAction: 'wait' | 'withdraw' | null
}

type StateResponse = {
  success: boolean
  session: SessionState
  viewer?: ViewerState
  error?: string
}

const STORAGE_KEY = 'bank_run_minigame_v1'

type StoredTokens = {
  roomCode: string
  hostToken: string | null
  playerToken: string | null
  playerName: string | null
}

const defaultStored: StoredTokens = {
  roomCode: '',
  hostToken: null,
  playerToken: null,
  playerName: null,
}

function loadStoredTokens(): StoredTokens {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') as StoredTokens | null
    if (!parsed) return defaultStored
    return {
      roomCode: parsed.roomCode || '',
      hostToken: parsed.hostToken || null,
      playerToken: parsed.playerToken || null,
      playerName: parsed.playerName || null,
    }
  } catch {
    return defaultStored
  }
}

function saveStoredTokens(next: StoredTokens) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/minigames${path}`, {
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    cache: 'no-store',
    ...init,
  })
  const raw = await res.text()
  let parsed: (T & { error?: string; success?: boolean }) | null = null
  if (raw) {
    try {
      parsed = JSON.parse(raw) as T & { error?: string; success?: boolean }
    } catch {
      if (!res.ok) throw new Error(`Request failed (${res.status})`)
      throw new Error('Server returned non-JSON response')
    }
  }
  const data = parsed ?? ({} as T & { error?: string; success?: boolean })

  if (!res.ok || (parsed && parsed.success === false)) {
    throw new Error(data?.error || `Request failed (${res.status})`)
  }
  return data
}

/* --- ICONS --- */
const IconVault = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="2" width="20" height="20" rx="2" ry="2" />
    <path d="M10 10l4 4m0-4l-4 4" />
    <circle cx="12" cy="12" r="8" />
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

const IconAlertCircle = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
)

export default function BankRunMiniGamePage() {
  const stored = useMemo(loadStoredTokens, [])
  const query = useMemo(() => new URLSearchParams(window.location.search), [])
  const inviteToken = (query.get('invite') || '').trim()
  const roomFromUrl = (query.get('room') || '').trim().toUpperCase()
  const nameFromUrl = (query.get('name') || '').trim()
  const hostTokenFromUrl = (query.get('hostToken') || '').trim()

  const [roomCodeInput, setRoomCodeInput] = useState(roomFromUrl || stored.roomCode)
  const [playerNameInput, setPlayerNameInput] = useState(nameFromUrl || stored.playerName || '')
  const [hostToken, setHostToken] = useState<string | null>(hostTokenFromUrl || stored.hostToken)
  const [playerToken, setPlayerToken] = useState<string | null>(stored.playerToken)
  const [session, setSession] = useState<SessionState | null>(null)
  const [viewer, setViewer] = useState<ViewerState | null>(null)
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
  const [latestSession, setLatestSession] = useState<EducatorMiniGameSession | null>(null)
  const [quickActionLoading, setQuickActionLoading] = useState<'start' | 'advance' | 'reset' | null>(null)
  const [quickActionMessage, setQuickActionMessage] = useState<string | null>(null)
  const autoJoinAttemptedRef = useRef(false)

  const activeRoomCode = (session?.roomCode || roomCodeInput || '').toUpperCase()
  const canPoll = activeRoomCode.length > 0 && (hostToken !== null || playerToken !== null)

  useEffect(() => {
    saveStoredTokens({
      roomCode: activeRoomCode,
      hostToken,
      playerToken,
      playerName: playerNameInput || null,
    })
  }, [activeRoomCode, hostToken, playerToken, playerNameInput])

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
        if (response.invite.teamLabel && !nameFromUrl && !playerNameInput) {
          setPlayerNameInput(response.invite.teamLabel)
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
  }, [inviteToken, roomFromUrl, nameFromUrl, playerNameInput])

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

  const loadLatestBankRunSession = async () => {
    if (hasPublicJoinContext) return
    setSessionsFetching(true)
    try {
      const sessions = await educatorMiniGamesApi.listSessions()
      const latest = sessions
        .filter((s) => s.gameType === 'bank-run')
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] || null
      setLatestSession(latest)
    } catch {
      setLatestSession(null)
    } finally { setSessionsFetching(false) }
  }

  useEffect(() => {
    if (hasPublicJoinContext || !authChecked || !canAccessSetup || sessionsRefreshKey === 0) return
    void loadLatestBankRunSession()
  }, [hasPublicJoinContext, authChecked, canAccessSetup, sessionsRefreshKey])

  const fetchState = async () => {
    if (!activeRoomCode) return
    try {
      const qs = new URLSearchParams()
      if (hostToken) qs.set('hostToken', hostToken)
      if (playerToken) qs.set('playerToken', playerToken)
      const state = await api<StateResponse>(`/bank-run/${activeRoomCode}/state?${qs.toString()}`)
      setSession(state.session)
      setViewer(state.viewer || null)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection lost')
    }
  }

  useEffect(() => {
    if (!canPoll) return
    void fetchState()
    const intervalMs = session?.phase === 'playing' ? 2000 : 4000
    const timer = window.setInterval(() => void fetchState(), intervalMs)
    return () => window.clearInterval(timer)
  }, [canPoll, activeRoomCode, hostToken, playerToken, session?.phase])

  const joinRoom = async () => {
    setLoading(true)
    setError(null)
    const roomCode = roomCodeInput.trim().toUpperCase()
    const name = (playerNameInput.trim() || inviteLabel || 'Student').slice(0, 24)
    if (!roomCode) {
      setLoading(false)
      setError('Room code required')
      return
    }
    try {
      try {
        const response = await api<{ success: boolean; playerToken: string; session: SessionState }>(`/bank-run/${roomCode}/join`, {
          method: 'POST',
          body: JSON.stringify({ name }),
        })
        setRoomCodeInput(roomCode)
        setPlayerToken(response.playerToken)
        setSession(response.session)
        await fetchState()
      } catch (joinErr) {
        const msg = joinErr instanceof Error ? joinErr.message : 'Join failed'
        if (!msg.toLowerCase().includes('already started')) {
          throw joinErr
        }
        const resume = await api<{ success: boolean; playerToken: string; session: SessionState }>(`/bank-run/${roomCode}/rejoin`, {
          method: 'POST',
          body: JSON.stringify({ name }),
        })
        setRoomCodeInput(roomCode)
        setPlayerToken(resume.playerToken)
        setSession(resume.session)
        await fetchState()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Join failed')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!roomFromUrl || !nameFromUrl) return
    if (hostTokenFromUrl) return
    const hasMatchingStoredIdentity =
      String(stored.roomCode || '').toUpperCase() === roomFromUrl &&
      String(stored.playerName || '').trim().toLowerCase() === nameFromUrl.trim().toLowerCase() &&
      Boolean(stored.playerToken)
    if (hasMatchingStoredIdentity) return
    const alreadyInTargetSession =
      (session?.roomCode || '').toUpperCase() === roomFromUrl &&
      String(viewer?.playerName || '').trim().toLowerCase() === nameFromUrl.trim().toLowerCase()
    if (alreadyInTargetSession) return
    if (autoJoinAttemptedRef.current) return

    autoJoinAttemptedRef.current = true
    setHostToken(null)
    setPlayerToken(null)
    setSession(null)
    setViewer(null)
    setRoomCodeInput(roomFromUrl)
    setPlayerNameInput(nameFromUrl)
    setLoading(true)
    setError(null)
    void (async () => {
      try {
        const code = roomFromUrl.trim().toUpperCase()
        const name = (nameFromUrl.trim() || inviteLabel || 'Student').slice(0, 24)
        try {
          const response = await api<{ success: boolean; playerToken: string; session: SessionState }>(`/bank-run/${code}/join`, {
            method: 'POST',
            body: JSON.stringify({ name }),
          })
          setRoomCodeInput(code)
          setPlayerToken(response.playerToken)
          setSession(response.session)
        } catch (joinErr) {
          const msg = joinErr instanceof Error ? joinErr.message : 'Join failed'
          if (!msg.toLowerCase().includes('already started')) {
            throw joinErr
          }
          const resume = await api<{ success: boolean; playerToken: string; session: SessionState }>(`/bank-run/${code}/rejoin`, {
            method: 'POST',
            body: JSON.stringify({ name }),
          })
          setRoomCodeInput(code)
          setPlayerToken(resume.playerToken)
          setSession(resume.session)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Join failed')
      } finally {
        setLoading(false)
      }
    })()
  }, [roomFromUrl, nameFromUrl, hostTokenFromUrl, session?.roomCode, viewer?.playerName, inviteLabel, stored.roomCode, stored.playerName, stored.playerToken])

  const startGame = async () => {
    if (!hostToken || !activeRoomCode) return
    setLoading(true)
    try {
      const response = await api<{ success: boolean; session: SessionState }>(`/bank-run/${activeRoomCode}/start`, {
        method: 'POST',
        body: JSON.stringify({ hostToken }),
      })
      setSession(response.session)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Start failed')
    } finally {
      setLoading(false)
    }
  }

  const advanceDay = async () => {
    if (!hostToken || !activeRoomCode) return
    setLoading(true)
    try {
      const response = await api<{ success: boolean; session: SessionState }>(`/bank-run/${activeRoomCode}/advance`, {
        method: 'POST',
        body: JSON.stringify({ hostToken }),
      })
      setSession(response.session)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Slide advance failed')
    } finally {
      setLoading(false)
    }
  }

  const resetGame = async () => {
    if (!hostToken || !activeRoomCode) return
    if (!confirm('Are you sure you want to reset the game? All progress will be lost.')) return
    setLoading(true)
    try {
      const response = await api<{ success: boolean; session: SessionState }>(`/bank-run/${activeRoomCode}/reset`, {
        method: 'POST',
        body: JSON.stringify({ hostToken }),
      })
      setSession(response.session)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reset failed')
    } finally {
      setLoading(false)
    }
  }

  const submitAction = async (action: 'wait' | 'withdraw') => {
    if (!playerToken || !activeRoomCode) return
    setLoading(true)
    try {
      const response = await api<{ success: boolean; session: SessionState }>(`/bank-run/${activeRoomCode}/action`, {
        method: 'POST',
        body: JSON.stringify({ playerToken, action }),
      })
      setSession(response.session)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed')
    } finally {
      setLoading(false)
    }
  }

  const leaveSession = () => {
    if (session && !confirm('Leave this game session?')) return
    saveStoredTokens(defaultStored)
    setHostToken(null)
    setPlayerToken(null)
    setSession(null)
    setViewer(null)
    setError(null)
  }

  const joinAsHostPlayer = async () => {
    if (!activeRoomCode) return
    setLoading(true)
    try {
      const joinName = 'Host'
      const response = await api<{ success: boolean; playerToken: string; session: SessionState }>(`/bank-run/${activeRoomCode}/join`, {
        method: 'POST',
        body: JSON.stringify({ name: joinName }),
      })
      setPlayerToken(response.playerToken)
      setPlayerNameInput(joinName)
      setSession(response.session)
      await fetchState()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join')
    } finally {
      setLoading(false)
    }
  }

  const myPlayer = session?.players.find((p) => p.id === viewer?.playerId) || null
  const isHost = viewer?.isHost || Boolean(hostToken)
  const canPlayerAct = session?.phase === 'playing' && !viewer?.hasWithdrawn
  const isLobbyPhase = session?.phase === 'lobby'
  const displayLiquidity = session ? (isLobbyPhase ? null : session.remainingLiquidity) : null
  const displayMaturityPool = session ? (isLobbyPhase ? null : session.remainingMaturityPool) : null
  // Calculate liquidity percentage
  const maxLiquidity = session ? session.stats.totalPlayers * session.config.deposit * session.config.liquidityRatio : 1
  const liquidityPct = session ? Math.min(100, Math.max(0, (session.remainingLiquidity / maxLiquidity) * 100)) : 0

  if (!session) {
    const createSession = async () => {
      setCreatingSession(true)
      setError(null)
      setQuickActionMessage(null)
      try {
        await educatorMiniGamesApi.createSession({ gameType: 'bank-run', teamCount: 40 })
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
        const created = await api<{ success: boolean; roomCode: string; hostToken: string; session: SessionState }>(
          '/bank-run/create',
          { method: 'POST', body: JSON.stringify({}) },
        )
        const roomCode = String(created.roomCode || '').trim().toUpperCase()
        const hostTokenValue = String(created.hostToken || '').trim()
        if (!roomCode || !hostTokenValue) throw new Error('Failed to create solo room')

        const joined = await api<{ success: boolean; playerToken: string; session: SessionState }>(
          `/bank-run/${encodeURIComponent(roomCode)}/join`,
          { method: 'POST', body: JSON.stringify({ name: 'Host' }) },
        )

        const started = await api<{ success: boolean; session: SessionState }>(
          `/bank-run/${encodeURIComponent(roomCode)}/start`,
          { method: 'POST', body: JSON.stringify({ hostToken: hostTokenValue }) },
        )

        setRoomCodeInput(roomCode)
        setHostToken(hostTokenValue)
        setPlayerToken(joined.playerToken)
        setPlayerNameInput('Host')
        setSession(started.session)
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
        title="Bank Run"
        subtitle="Liquidity Crisis Simulation"
        sessionsGameType="bank-run"
        showSessionsTable={false}
        sessionsRefreshKey={sessionsRefreshKey}
        publicMode={hasPublicJoinContext}
      >
        <main className="bankrun-page">
          <section className="bankrun-shell">
          {!authChecked ? (
            <div className="bankrun-card">Checking educator access...</div>
          ) : (!hasPublicJoinContext && !canAccessSetup) ? (
            <div className="bankrun-card">
              <h2>Educator Login Required</h2>
              <p style={{ color: 'var(--text-secondary)' }}>This setup page is restricted to educator accounts.</p>
              <button className="bankrun-btn primary" onClick={() => { window.location.href = '/educator-login' }}>
                Go to Educator Login
              </button>
            </div>
          ) : (
          <div className="bankrun-lobby">
            <div className="bankrun-hero mg-page-hero">
              <h1>🏦 BANK RUN</h1>
              <p className="bankrun-sub">The Liquidity Crisis Simulation</p>
            </div>
            <div className="bankrun-lobby-grid">

            <div className="bankrun-card" style={{ border: '1px solid var(--accent-blue)', background: 'rgba(59, 130, 246, 0.05)' }}>
              <h2 style={{ fontSize: '1rem', color: 'var(--accent-blue)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1rem' }}>
                🎯 The Mission: Trust vs. Panic
              </h2>
              <div style={{ fontSize: '0.95rem', lineHeight: '1.6', color: 'var(--text-primary)' }}>
                <p style={{ color: 'var(--text-primary)', marginBottom: '1rem' }}>
                  The Goal is not just to click buttons—it's to decide if you <strong>trust your classmates</strong>.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                  <p>🤝 <strong>The Win-Win (Cooperation):</strong> If everyone waits until Day 3, the bank makes a profit and everyone gets <strong>$150</strong>.</p>
                  <p>🏃‍♂️ <strong>The Panic (Defection):</strong> If you think your classmates are going to panic, you want to Withdraw Early to get your <strong>$100</strong> before the bank runs out of cash.</p>
                  <p>💀 <strong>The Collapse:</strong> If too many people "run" for the vault, the bank is forced to sell assets at a loss. The loyal people who waited might end up with <strong>$0</strong>.</p>
                </div>
                <p style={{ marginTop: '1.2rem', fontSize: '0.85rem', color: 'var(--accent-amber)', fontStyle: 'italic' }}>
                  💡 Best experienced with 3+ players in a live classroom.
                </p>
              </div>
            </div>

            <div className="bankrun-card">
              {/* Join Class tab hidden — setup page is educator-only */}

              <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                {inviteLabel && (
                  <div style={{ fontSize: '0.9rem', color: 'var(--accent-blue)', fontWeight: 700 }}>
                    Invite: {inviteLabel}
                  </div>
                )}
                {!hasPublicJoinContext ? (
                  <div style={{ display: 'grid', gap: '0.65rem' }}>
                    <button className="bankrun-btn primary" onClick={createSession} disabled={creatingSession}>
                      {creatingSession ? 'Creating...' : 'Create Session'}
                    </button>
                    <button className="bankrun-btn ghost" onClick={startSoloTest} disabled={startingSolo}>
                      {startingSolo ? 'Starting Solo...' : 'Play Solo Test'}
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
                              📋
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
                              📋
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
                            className="bankrun-btn ghost"
                            type="button"
                            disabled={quickActionLoading !== null || latestSession.status !== 'LOBBY'}
                            onClick={() => void runQuickAction('start')}
                          >
                            {quickActionLoading === 'start' ? 'Starting...' : latestSession.status === 'LOBBY' ? 'Start' : 'Started'}
                          </button>
                          <button
                            className="bankrun-btn ghost"
                            type="button"
                            disabled={quickActionLoading !== null || latestSession.status !== 'ACTIVE'}
                            onClick={() => void runQuickAction('advance')}
                          >
                            {quickActionLoading === 'advance' ? 'Advancing...' : 'Advance'}
                          </button>
                          <button
                            className="bankrun-btn ghost"
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
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                    <div className="mg-form-group">
                      <label>Display Name (Optional)</label>
                      <input
                        value={playerNameInput}
                        onChange={(e) => setPlayerNameInput(e.target.value)}
                        placeholder={inviteLabel ? inviteLabel : 'e.g. Alex'}
                        maxLength={24}
                      />
                    </div>
                    <div className="mg-form-group">
                      <label>Room Code</label>
                      <input
                        value={roomCodeInput}
                        onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
                        placeholder="e.g. AB12XY"
                        maxLength={6}
                      />
                    </div>
                    <button className="bankrun-btn primary" onClick={joinRoom} disabled={loading || !roomCodeInput}>
                      Enter Room
                    </button>
                  </div>
                )}
              </div>
            </div>
            </div>
            {!hasPublicJoinContext && (
              <MiniGameSessionsTable gameType="bank-run" refreshKey={sessionsRefreshKey} />
            )}

            {error && <div className="bankrun-error">{error}</div>}

            {/* Rules button removed from bottom as it is now at the top */}
          </div>
          )}
          </section>
        </main >
      </MiniGameShell>
    )
  }

  return (
    <MiniGameShell
      title="Bank Run"
      subtitle="Liquidity Crisis Simulation"
      sessionsGameType="bank-run"
      showSessionsTable={false}
      sessionsRefreshKey={sessionsRefreshKey}
      publicMode={hasPublicJoinContext}
    >
      <main className="bankrun-page">
      <section className="bankrun-shell">
        <header className="bankrun-header">
          <div>
            <h1>BANK RUN <span style={{ color: 'var(--text-secondary)', fontWeight: '300', fontSize: '0.6em' }}>ROOM {session.roomCode}</span></h1>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
              <span className={`phase-tag ${session.phase}`}>{session.phase}</span>
              <span className="day-badge">DAY {session.currentDay} OF {session.config.totalDays}</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.6rem' }}>
            {isHost && session.phase === 'lobby' && !myPlayer && (
              <button className="bankrun-btn ghost" onClick={joinAsHostPlayer} disabled={loading}>
                Join as Player
              </button>
            )}
            <button className="bankrun-btn ghost" onClick={leaveSession}>Leave Session</button>
          </div>
        </header>

        <div className="bankrun-card" style={{
          border: '1px solid var(--accent-blue)',
          background: 'rgba(59, 130, 246, 0.05)',
          marginBottom: '1.5rem',
          padding: '1.5rem'
        }}>
          <h2 style={{ fontSize: '1.1rem', color: 'var(--text-primary)', marginBottom: '1rem' }}>🎯 The Strategic Mission</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.2rem', fontSize: '1rem' }}>
            The "Goal" isn't just to click buttons—it's to decide if you <strong>trust your classmates</strong>.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', fontSize: '0.9rem', lineHeight: '1.5' }}>
            <div style={{ borderLeft: '3px solid var(--accent-emerald)', paddingLeft: '1rem' }}>
              <p style={{ color: 'var(--accent-emerald)', fontWeight: '700', marginBottom: '0.4rem' }}>🤝 THE WIN-WIN (COOPERATION)</p>
              <p style={{ color: 'var(--text-secondary)' }}>If everyone waits until Day 3, the bank makes a profit and everyone gets <strong>$150</strong>.</p>
            </div>
            <div style={{ borderLeft: '3px solid var(--accent-amber)', paddingLeft: '1rem' }}>
              <p style={{ color: 'var(--accent-amber)', fontWeight: '700', marginBottom: '0.4rem' }}>🏃‍♂️ THE PANIC (DEFECTION)</p>
              <p style={{ color: 'var(--text-secondary)' }}>If you think others will panic, you want to <strong>Withdraw Early</strong> to get your $100 before cash runs out.</p>
            </div>
            <div style={{ borderLeft: '3px solid var(--accent-rose)', paddingLeft: '1rem' }}>
              <p style={{ color: 'var(--accent-rose)', fontWeight: '700', marginBottom: '0.4rem' }}>💀 THE COLLAPSE</p>
              <p style={{ color: 'var(--text-secondary)' }}>If too many "run," the bank sells assets at a loss. Loyal players who wait might end up with <strong>$0</strong>.</p>
            </div>
          </div>
        </div>

        <div className="bankrun-game-layout">
          <div className="bankrun-main-col">
            <div className="bankrun-vault-status">
              <div className={`stat-box ${!isLobbyPhase && session.remainingLiquidity < 100 ? 'vault-unstable' : ''}`}>
                <div className="label"><IconVault /> Bank Liquidity</div>
                <div className={`value ${!isLobbyPhase && session.remainingLiquidity < 100 ? 'rose' : 'blue'}`}>
                  {displayLiquidity === null ? 'Pending' : `$${displayLiquidity}`}
                </div>
              </div>
              <div className="stat-box">
                <div className="label"><IconTrendingUp /> Maturity Pool</div>
                <div className="value emerald">{displayMaturityPool === null ? 'Pending' : `$${Math.floor(displayMaturityPool)}`}</div>
              </div>
              <div className="stat-box">
                <div className="label"><IconUsers /> Active Depositors</div>
                <div className="value">
                  {isLobbyPhase ? session.stats.totalPlayers : session.stats.waitingCount}
                  <span style={{ fontSize: '0.5em', color: 'var(--text-secondary)' }}> / {session.stats.totalPlayers}</span>
                </div>
              </div>
            </div>

            <div className="bankrun-card liquidity-container">
              <div className="liquidity-header">
                <span>Vault Cash Reserve</span>
                <span>{isLobbyPhase ? 'Starts when host begins simulation' : `${Math.round(liquidityPct)}% of Required Buffer`}</span>
              </div>
              <div className="liquidity-bar-bg">
                <div
                  className={`liquidity-bar-fill ${liquidityPct < 30 ? 'critical' : ''}`}
                  style={{ width: `${isLobbyPhase ? 0 : liquidityPct}%` }}
                />
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.8rem' }}>
                {isLobbyPhase
                  ? 'Liquidity and maturity pool will initialize once the host starts the game.'
                  : session.remainingLiquidity <= 0
                  ? "CRITICAL: The vault is empty! Early withdrawals are no longer possible."
                  : "The bank has enough cash to cover a few more early withdrawals."}
              </p>
            </div>

            {session.phase === 'playing' && (
              <div className="bankrun-player-zone">
                {myPlayer && (
                  <div className="bankrun-card" style={{ marginTop: '1.5rem' }}>
                    <h2>Your Account: {myPlayer.name}</h2>
                    <div style={{ fontSize: '1.2rem', marginBottom: '1.5rem' }}>
                      Position: <strong>{myPlayer.withdrawnDay ? 'Withdrawn' : 'Waiting for Maturity'}</strong>
                      {myPlayer.totalPayout > 0 && <span> | Payout: <strong className="emerald">${myPlayer.totalPayout}</strong></span>}
                    </div>

                    {canPlayerAct ? (
                      <div style={{ position: 'relative' }}>
                        {viewer?.hasSubmittedToday && (
                          <div style={{
                            background: viewer.currentAction === 'withdraw' ? 'rgba(244, 63, 94, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                            color: 'var(--text-primary)',
                            padding: '1rem',
                            borderRadius: '12px',
                            marginBottom: '1rem',
                            textAlign: 'center',
                            fontSize: '1rem',
                            fontWeight: '600',
                            border: `1px solid ${viewer.currentAction === 'withdraw' ? 'var(--accent-rose)' : 'var(--accent-emerald)'}`
                          }}>
                            {viewer.currentAction === 'withdraw' ? (
                              <span>🚨 CURRENT CHOICE: <strong>WITHDRAW EARLY</strong></span>
                            ) : (
                              <span>🏦 CURRENT CHOICE: <strong>HOLD DEPOSIT</strong></span>
                            )}
                            <p style={{ margin: '0.4rem 0 0', fontSize: '0.8rem', opacity: 0.8, fontWeight: '400' }}>
                              Choice recorded. You can still switch below.
                            </p>
                          </div>
                        )}
                        <div className="action-zone">
                          <div
                            className={`action-card withdraw ${!viewer?.currentAction ? 'pulse' : ''} ${viewer?.currentAction === 'withdraw' ? 'selected' : ''}`}
                            onClick={() => submitAction('withdraw')}
                            style={viewer?.currentAction === 'withdraw' ? { borderColor: 'var(--accent-rose)', background: 'rgba(244, 63, 94, 0.2)', borderWidth: '3px' } : {}}
                          >
                            <div className="action-icon">🏃‍♂️</div>
                            <h3>Withdraw Early</h3>
                            <p>Lock in $100 now. Safe, but causes bank stress.</p>
                          </div>
                          <div
                            className={`action-card wait ${!viewer?.currentAction ? 'pulse' : ''} ${viewer?.currentAction === 'wait' ? 'selected' : ''}`}
                            onClick={() => submitAction('wait')}
                            style={viewer?.currentAction === 'wait' ? { borderColor: 'var(--accent-emerald)', background: 'rgba(16, 185, 129, 0.2)', borderWidth: '3px' } : {}}
                          >
                            <div className="action-icon">🏦</div>
                            <h3>Hold Deposit</h3>
                            <p>Wait for Day 3. Higher reward ($150) if bank survives.</p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="bankrun-error" style={{ background: 'rgba(59, 130, 246, 0.1)', borderColor: 'rgba(59, 130, 246, 0.2)', color: 'var(--accent-blue)' }}>
                        {myPlayer.withdrawnDay
                          ? `You withdrew on Day ${myPlayer.withdrawnDay} and received $${myPlayer.earlyPayout}.`
                          : "The Host has ended this round. Please wait for the next day to start."}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {session.phase === 'lobby' && isHost && (
              <div className="bankrun-card" style={{ marginTop: '1.5rem', textAlign: 'center' }}>
                <h2>Ready to Start?</h2>
                <p>Waiting for players to join. Share the room code: <strong>{session.roomCode}</strong></p>
                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '1.5rem' }}>
                  <button className="bankrun-btn primary" onClick={startGame} disabled={session.players.length === 0}>
                    Begin Simulation
                  </button>
                </div>
                <div style={{ marginTop: '1rem', textAlign: 'left' }}>
                  <p style={{ margin: '0 0 0.5rem', fontWeight: 700 }}>
                    Joined Users ({session.players.length})
                  </p>
                  {session.players.length === 0 ? (
                    <p style={{ margin: 0, color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                      No users joined yet.
                    </p>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                      {session.players.map((player) => (
                        <span
                          key={player.id}
                          style={{
                            padding: '0.25rem 0.6rem',
                            borderRadius: '999px',
                            border: '1px solid var(--border-color)',
                            background: 'rgba(59, 130, 246, 0.08)',
                            fontSize: '0.85rem',
                          }}
                        >
                          {player.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {session.phase === 'lobby' && !isHost && (
              <div className="bankrun-card" style={{ marginTop: '1.5rem', textAlign: 'center' }}>
                <h2>Waiting For Host</h2>
                <p>The educator has not started this game yet. Your choice buttons will appear when the game starts.</p>
              </div>
            )}

            {session.phase === 'results' && (
              <div className="bankrun-card" style={{ marginTop: '1.5rem', border: '1px solid var(--accent-amber)', background: 'rgba(245, 158, 11, 0.05)' }}>
                <h2 style={{ justifyContent: 'center' }}>Simulation Recap</h2>
                <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                  {session.stats.withdrawnCount === 0 ? (
                    <p style={{ color: 'var(--accent-emerald)', fontSize: '1.1rem' }}>
                      🌟 <strong>PERFECT COOPERATION:</strong> Everyone stayed calm and the bank matured fully. Everyone earned the maximum $150!
                    </p>
                  ) : session.remainingMaturityPool <= 0 ? (
                    <p style={{ color: 'var(--accent-rose)', fontSize: '1.1rem' }}>
                      💀 <strong>TOTAL COLLAPSE:</strong> Panic withdrawals destroyed the bank's value. The bank is bankrupt and many received $0.
                    </p>
                  ) : (
                    <p style={{ color: 'var(--accent-amber)', fontSize: '1.1rem' }}>
                      ⚖️ <strong>PARTIAL RUN:</strong> Some players panicked. The bank survived, but the maturity pool was reduced by forced liquidations.
                    </p>
                  )}
                </div>
                {isHost && (
                  <div style={{ textAlign: 'center' }}>
                    <button className="bankrun-btn primary" onClick={resetGame}>Play Again</button>
                  </div>
                )}
              </div>
            )}
          </div>

          <aside className="bankrun-side-col">
            {isHost && session.phase === 'playing' && (
              <div className="bankrun-card" style={{ marginBottom: '1.5rem', borderColor: 'var(--accent-blue)' }}>
                <h2>Host Controls</h2>
                <div style={{ marginBottom: '1rem', fontSize: '0.9rem' }}>
                  <p><strong>Status:</strong> {session.stats.actedCount} / {session.stats.waitingCount} players have made a choice.</p>
                  <progress
                    value={session.stats.actedCount}
                    max={session.stats.waitingCount}
                    style={{ width: '100%', height: '8px', borderRadius: '4px' }}
                  />
                </div>
                <button className="bankrun-btn primary" style={{ width: '100%' }} onClick={advanceDay} disabled={loading}>
                  Close Round & Process Results
                </button>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.8rem' }}>
                  Clicking this will lock in everyone's current choice (Withdraw or Hold) and move the bank to the next business day.
                </p>
                <button className="bankrun-btn ghost" style={{ width: '100%', marginTop: '0.8rem' }} onClick={resetGame}>
                  Emergency Reset
                </button>
              </div>
            )}

            <div className="bankrun-card">
              <h2><IconUsers /> Activity Feed</h2>
              <div className="event-log-container">
                {session.eventLog.length === 0 ? (
                  <p style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>Waiting for activity...</p>
                ) : (
                  session.eventLog.map((line, idx) => (
                    <div key={idx} className="event-item">
                      <span className="event-time">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                      <span>{line}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="bankrun-card" style={{ marginTop: '1.5rem' }}>
              <h2>Leaderboard</h2>
              <table className="bankrun-table">
                <thead>
                  <tr>
                    <th>Player</th>
                    <th>Status</th>
                    <th>Payout</th>
                  </tr>
                </thead>
                <tbody>
                  {session.players
                    .slice()
                    .sort((a, b) => (b.earlyPayout + b.finalPayout) - (a.earlyPayout + a.finalPayout))
                    .map((player) => (
                      <tr key={player.id}>
                        <td style={{ fontWeight: player.id === viewer?.playerId ? '700' : '400' }}>
                          {player.name} {player.id === viewer?.playerId && '(You)'}
                        </td>
                        <td style={{ fontSize: '0.8rem' }}>
                          {session.phase === 'lobby'
                            ? 'Joined'
                            : player.withdrawnDay
                              ? `Day ${player.withdrawnDay}`
                              : session.phase === 'results'
                                ? 'Matured'
                                : 'Waiting'}
                        </td>
                        <td>
                          <span className="payout-badge">${player.earlyPayout + player.finalPayout}</span>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            {session.phase === 'lobby' && (
              <div className="bankrun-card" style={{ marginTop: '1.5rem' }}>
                <h2>Joined Players ({session.players.length})</h2>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.8rem' }}>
                  {session.players.map((player) => (
                    <span
                      key={player.id}
                      style={{
                        border: '1px solid var(--border-color)',
                        borderRadius: '999px',
                        padding: '0.25rem 0.65rem',
                        fontSize: '0.82rem',
                        background: 'var(--card-bg)',
                      }}
                    >
                      {player.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </aside>
        </div>

        {error && (
          <div className="bankrun-error" style={{ position: 'fixed', bottom: '2rem', right: '2rem', maxWidth: '300px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)' }}>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <IconAlertCircle /> {error}
            </div>
          </div>
        )}
      </section>
    </main>
    </MiniGameShell>
  )
}


