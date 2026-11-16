import { QRCodeSVG } from 'qrcode.react'
import { useEffect, useMemo, useState, useRef } from 'react'
import { getEducatorSessionCached, getEducatorSessionSync } from '../features/minigames/educatorSession'
import { MiniGameShell } from '../features/minigames/MiniGameShell'
import { educatorMiniGamesApi } from '../features/minigames/api'
import { MiniGameSessionsTable } from '../features/minigames/MiniGameSessionsTable'
import type { EducatorMiniGameSession } from '../api/client'
import './ConflictOfInterestMiniGamePage.css'
import '../features/minigames/SessionControlPanel.css'

const STORAGE_KEY = 'conflict-of-interest_minigame_v1'
const GAME_SLUG = 'conflict-of-interest'

type CoiOutcome = { legalRiskAction: number; reputationAction: number; integrityAction: number; explanation: string }
type CoiOption = { label: string; text: string; outcome?: CoiOutcome }
type CoiQuestion = {
  id: string; topic: string; difficulty: 'easy' | 'medium' | 'hard'
  situation: string; directorRole: string; options: CoiOption[]
  principle?: string; reference?: string
}
type RoleProfile = 'director' | 'executive' | 'procurement'
type GovernanceAction = 'disclose' | 'escalate' | 'recuse' | 'document' | 'proceed'
type Player = {
  id: string; name: string; score: number; hasAnswered: boolean; roleProfile: RoleProfile
  legalExposure: number; trustScore: number; disclosureCompleteness: number
  decisionQuality: number; teamMorale: number; deliveryOutcomes: number
}
type HistoryEntry = {
  questionId: string; responses: Record<string, string>
  totalCount: number; averageLegalExposure: number; averageTrustScore: number
  averageDisclosure: number; averageDecisionQuality: number; averageMorale: number
  averageDelivery: number; eventCount: number
}
type Session = {
  roomCode: string; phase: 'lobby' | 'question' | 'reveal' | 'done'
  currentQuestion: number; totalQuestions: number
  config: { questionCount: number }
  players: Player[]
  question: CoiQuestion | null
  responses?: Record<string, string>
  history: HistoryEntry[]
  eventLog: string[]
  stats: { answered: number; total: number }
  viewer: {
    hasAnswered: boolean; myAnswer: string | null; roleProfile: RoleProfile
    legalExposure: number; trustScore: number; disclosureCompleteness: number
    decisionQuality: number; teamMorale: number; deliveryOutcomes: number
  } | null
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

export default function ConflictOfInterestMiniGamePage() {
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
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null)
  const [selectedActions, setSelectedActions] = useState<GovernanceAction[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [sessionsRefreshKey, setSessionsRefreshKey] = useState(0)
  const [creatingSession, setCreatingSession] = useState(false)
  const [sessionsFetching, setSessionsFetching] = useState(false)
  const [latestSession, setLatestSession] = useState<EducatorMiniGameSession | null>(null)
  const [joinedPlayers, setJoinedPlayers] = useState<string[]>([])
  const [quickActionLoading, setQuickActionLoading] = useState<'start' | 'advance' | 'reset' | null>(null)
  const [quickActionMessage, setQuickActionMessage] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const autoJoinAttemptedRef = useRef(false)
  const fetchGuardRef = useRef(0)

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
      if (playerToken) queryParts.push(`playerToken=${encodeURIComponent(playerToken)}`)
      if (hostToken) queryParts.push(`hostToken=${encodeURIComponent(hostToken)}`)
      const qs = queryParts.length > 0 ? `?${queryParts.join('&')}` : ''
      const data = await api<{ session: Session; isHost: boolean }>(`/${GAME_SLUG}/${roomCode}/state${qs}`)
      if (guard !== fetchGuardRef.current) return
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
        if (prev?.currentQuestion !== data.session.currentQuestion || prev?.phase !== data.session.phase) {
          setSelectedAnswer(null)
          setSelectedActions([])
        }
        return data.session
      })
      setIsHost(data.isHost)
      setError(null)
    } catch (e) { setError((e as Error).message) }
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
          .filter(s => s.gameType === 'conflict-of-interest')
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
      })
      setSessionsRefreshKey(v => v + 1)
    } catch (e) { setError((e as Error).message) } finally { setCreatingSession(false) }
  }

  async function soloPlay() {
    setLoading(true); setError(null)
    try {
      const d = await api<{ roomCode: string; hostToken: string; playerToken: string; session: Session }>(`/${GAME_SLUG}/solo`, {
        method: 'POST',
        body: JSON.stringify({ name: nameInput || 'Player' }),
      })
      setRoomCodeInput(d.roomCode)
      setHostToken(d.hostToken)
      setPlayerToken(d.playerToken)
      setSession(d.session)
      setIsHost(true)
      setIsLobbyMode(false)
    } catch (e) { setError((e as Error).message) } finally { setLoading(false) }
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
      setSession(d.session); setSelectedAnswer(null); setSelectedActions([])
    } catch (e) { setError((e as Error).message) }
  }

  async function submitAnswer(label: string, actions: GovernanceAction[]) {
    if (!roomCode || !playerToken || submitting) return
    setSubmitting(true); setSelectedAnswer(label); setError(null)
    try {
      const d = await api<{ session: Session }>(`/${GAME_SLUG}/${roomCode}/action`, {
        method: 'POST', body: JSON.stringify({ playerToken, answer: label, selectedActions: actions }),
      })
      setSession(d.session)
    } catch (e) { setError((e as Error).message); setSelectedAnswer(null) } finally { setSubmitting(false) }
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
    setIsHost(false); setError(null); setIsLobbyMode(true); setSelectedAnswer(null); setSelectedActions([])
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
      <MiniGameShell title="Conflict of Interest" publicMode>
        <div className="coi-page"><div className="coi-shell">
          <div className="coi-hero mg-page-hero"><h1>⚖️ Conflict of Interest Simulation</h1></div>
          <div className="coi-card" style={{ textAlign: 'center' }}>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>Educator login required to create. Students: enter room code to join.</p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <input className="coi-input" style={{ maxWidth: 180 }} placeholder="Your name" value={nameInput} onChange={e => setNameInput(e.target.value)} />
              <input className="coi-input" style={{ maxWidth: 140 }} placeholder="Room code" value={roomCodeInput} onChange={e => setRoomCodeInput(e.target.value.toUpperCase())} />
              <button className="coi-btn coi-btn-primary" onClick={() => void joinGame()} disabled={loading}>Join</button>
            </div>
            {error && <div className="coi-error">{error}</div>}
          </div>
        </div></div>
      </MiniGameShell>
    )
  }

  if (isLobbyMode && !session) {
    return (
      <MiniGameShell title="Conflict of Interest Simulation" subtitle="Corporate Governance" sessionsGameType="conflict-of-interest" publicMode={hasPublicJoinContext}>
        <div className="coi-page"><div className="coi-shell">
          <div className="coi-hero mg-page-hero">
            <h1>⚖️ Conflict of Interest Simulation</h1>
            <p>Interactive corporate governance scenarios. Can you maintain integrity while managing risks?</p>
          </div>
          <div className="coi-grid-2">
            <div className="coi-card" style={{ borderColor: 'rgba(37,99,235,0.3)', background: 'rgba(37,99,235,0.03)' }}>
              <h2 style={{ fontSize: '0.95rem', color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.75rem' }}>⚖️ How It Works</h2>
              <div style={{ fontSize: '0.9rem', lineHeight: 1.65, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <p>A governance scenario is shown — students choose what the director should do.</p>
                <p>Every choice changes <strong>legal exposure</strong>, <strong>trust</strong>, <strong>disclosure quality</strong>, and delivery pressure.</p>
                <p>There is no single perfect answer every time. Balance short-term speed against long-term governance risk.</p>
                <p style={{ color: '#ca8a04', fontStyle: 'italic', fontSize: '0.85rem' }}>💡 Decisions are judged against the NZ Companies Act 1993.</p>
              </div>
            </div>
            <div className="coi-card">
              <div style={{ display: 'grid', gap: '0.65rem' }}>
                <button className="coi-btn coi-btn-primary" onClick={() => void createGame()} disabled={creatingSession}>
                  {creatingSession ? 'Creating...' : 'Create Simulation'}
                </button>
                <button className="coi-btn coi-btn-secondary" onClick={() => void soloPlay()} disabled={loading}>
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
                          <QRCodeSVG value={`${window.location.origin}/mini-games/join?code=${encodeURIComponent(latestSession.roomCode || '')}`} size={200} bgColor="#ffffff" fgColor="#0f172a" level="M" />
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
                      <button className="coi-btn coi-btn-secondary" disabled={quickActionLoading !== null || latestSession.status !== 'LOBBY'} onClick={() => void runQuickAction('start')}>
                        {quickActionLoading === 'start' ? 'Starting...' : 'Start'}
                      </button>
                      <button className="coi-btn coi-btn-secondary" disabled={quickActionLoading !== null || latestSession.status !== 'ACTIVE'} onClick={() => void runQuickAction('advance')}>
                        {quickActionLoading === 'advance' ? '...' : 'Advance'}
                      </button>
                      <button className="coi-btn coi-btn-secondary" disabled={quickActionLoading !== null} onClick={() => void runQuickAction('reset')}>
                        {quickActionLoading === 'reset' ? '...' : 'Reset'}
                      </button>
                    </div>
                    {quickActionMessage && <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{quickActionMessage}</div>}
                  </div>
                )}
              </div>
            </div>
          </div>
          <MiniGameSessionsTable gameType="conflict-of-interest" refreshKey={sessionsRefreshKey} />
          {error && <div className="coi-error">{error}</div>}
        </div></div>
      </MiniGameShell>
    )
  }

  if (!session) return (
    <MiniGameShell title="Conflict of Interest Simulation" publicMode={hasPublicJoinContext}>
      <div className="coi-page"><div className="coi-shell"><div className="coi-loading">Loading...</div></div></div>
    </MiniGameShell>
  )

  const sortedPlayers = [...session.players].sort((a, b) => b.score - a.score)
  const q = session.question
  const isReveal = session.phase === 'reveal'
  const myAnswer = session.viewer?.myAnswer ?? selectedAnswer

  return (
    <MiniGameShell title="Conflict of Interest Simulation" subtitle="Corporate Governance" sessionsGameType="conflict-of-interest" publicMode={hasPublicJoinContext}>
      <div className="coi-page"><div className="coi-shell">
        <div className="coi-hero mg-page-hero">
          <h1>⚖️ Conflict of Interest Simulation</h1>
          <p>Room: <strong>{session.roomCode}</strong> · Timeline Round {session.currentQuestion + 1}/{session.totalQuestions}</p>
        </div>
        <div className="coi-card" style={{ border: '1px solid var(--accent-blue)', background: 'rgba(37,99,235,0.03)', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '0.95rem', color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.75rem' }}>⚖️ How It Works</h2>
          <div style={{ fontSize: '0.9rem', lineHeight: 1.65, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <p>A governance scenario is shown — students choose what the director should do.</p>
            <p>Every choice changes <strong>legal exposure</strong>, <strong>trust</strong>, <strong>disclosure quality</strong>, and delivery pressure.</p>
            <p>There is no single perfect answer every time. Balance short-term speed against long-term governance risk.</p>
            <p style={{ color: '#ca8a04', fontStyle: 'italic', fontSize: '0.85rem' }}>💡 Decisions are judged against the NZ Companies Act 1993.</p>
          </div>
        </div>

        {/* Metrics Bar */}
        {session.viewer && (
          <div className="dd-metrics-bar" style={{ marginBottom: '1.5rem' }}>
            <div className="dd-metric">
              <span className="dd-metric-label">Legal Exposure</span>
              <div className="dd-metric-track"><div className="dd-metric-fill risk" style={{ width: `${session.viewer.legalExposure}%` }}></div></div>
              <span className="dd-metric-value">{session.viewer.legalExposure}%</span>
            </div>
            <div className="dd-metric">
              <span className="dd-metric-label">Trust</span>
              <div className="dd-metric-track"><div className="dd-metric-fill reputation" style={{ width: `${session.viewer.trustScore}%` }}></div></div>
              <span className="dd-metric-value">{session.viewer.trustScore}%</span>
            </div>
            <div className="dd-metric">
              <span className="dd-metric-label">Disclosure</span>
              <div className="dd-metric-track"><div className="dd-metric-fill performance" style={{ width: `${session.viewer.disclosureCompleteness}%` }}></div></div>
              <span className="dd-metric-value">{session.viewer.disclosureCompleteness}%</span>
            </div>
            <div className="dd-metric">
              <span className="dd-metric-label">Decision Quality</span>
              <div className="dd-metric-track"><div className="dd-metric-fill performance" style={{ width: `${session.viewer.decisionQuality}%` }}></div></div>
              <span className="dd-metric-value">{session.viewer.decisionQuality}%</span>
            </div>
            <div className="dd-metric">
              <span className="dd-metric-label">Team Morale</span>
              <div className="dd-metric-track"><div className="dd-metric-fill reputation" style={{ width: `${session.viewer.teamMorale}%` }}></div></div>
              <span className="dd-metric-value">{session.viewer.teamMorale}%</span>
            </div>
            <div className="dd-metric">
              <span className="dd-metric-label">Delivery</span>
              <div className="dd-metric-track"><div className="dd-metric-fill" style={{ width: `${session.viewer.deliveryOutcomes}%` }}></div></div>
              <span className="dd-metric-value">{session.viewer.deliveryOutcomes}%</span>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button className="coi-btn coi-btn-secondary" onClick={leaveGame} style={{ fontSize: '0.8rem', padding: '0.3rem 0.7rem' }}>← Leave</button>
        </div>

        <div className="coi-progress-bar">
          <div className="coi-progress-fill" style={{ width: `${((session.currentQuestion + (isReveal ? 1 : 0)) / session.totalQuestions) * 100}%` }} />
        </div>

        {session.phase === 'lobby' && (
          <div className="coi-card" style={{ maxWidth: 520, margin: '0 auto' }}>
            <h2>{isHost ? 'Waiting for Players' : 'Waiting for Host to Start'}</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Share code: <strong style={{ fontSize: '1.1rem', letterSpacing: '0.1em' }}>{session.roomCode}</strong></p>
            <div className="coi-players-list">
              {session.players.map(p => <div key={p.id} className="coi-chip">{p.name}</div>)}
            </div>
            {isHost && (
              <button className="coi-btn coi-btn-primary" onClick={() => void hostAction('start')} disabled={session.players.length < 1} style={{ marginTop: '0.75rem' }}>
                Start ({session.players.length} player{session.players.length !== 1 ? 's' : ''})
              </button>
            )}
            {playerToken && !isHost && (
              <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>You've joined — waiting for the host to start the game.</p>
            )}
          </div>
        )}

        {(session.phase === 'question' || session.phase === 'reveal') && q && (
          <div className="coi-game-grid">
            <div className="coi-main-col">
              <div className="coi-card">
                <div className="coi-question-number">
                  Timeline Round {session.currentQuestion + 1} of {session.totalQuestions}
                  <span className="coi-topic-badge" style={{ marginLeft: '0.5rem' }}>{q.topic.replace(/-/g, ' ')}</span>
                  <span className={`coi-difficulty-badge ${q.difficulty}`}>{q.difficulty}</span>
                </div>
                <div className="coi-director-role">Role: <strong>{q.directorRole}</strong></div>
                <div className="coi-situation">{q.situation}</div>
                <p style={{ fontSize: '0.88rem', fontWeight: 600, marginBottom: '0.6rem', color: 'var(--text-primary)' }}>What should the director do?</p>

                {session.phase === 'question' && !session.viewer?.hasAnswered && (
                  <>
                    <div className="coi-options">
                      {q.options.map(opt => {
                        const isSelected = myAnswer === opt.label

                        return (
                          <div
                            key={opt.label}
                            className={[
                              'coi-option',
                              isSelected ? 'selected' : '',
                              isReveal || session.viewer?.hasAnswered ? 'disabled' : '',
                            ].join(' ')}
                            onClick={() => {
                              if (!playerToken || session.viewer?.hasAnswered || isReveal || submitting) return
                              setSelectedAnswer(opt.label)
                            }}
                          >
                            <span className="coi-option-label">{opt.label}</span>
                            <div className="coi-option-content">
                              <span className="coi-option-text">{opt.text}</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>

                  <div style={{ marginTop: '0.85rem', display: 'grid', gap: '0.65rem' }}>
                    <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Governance Actions (choose one or more)</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: '0.5rem' }}>
                      {([
                        { id: 'disclose', title: 'Disclose', blurb: 'Formally declare the conflict' },
                        { id: 'escalate', title: 'Escalate', blurb: 'Raise to chair, compliance, legal' },
                        { id: 'recuse', title: 'Recuse', blurb: 'Step out of decision influence' },
                        { id: 'document', title: 'Document', blurb: 'Record rationale and controls' },
                        { id: 'proceed', title: 'Proceed', blurb: 'Continue with operational pace' },
                      ] as const).map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            setSelectedActions(prev => prev.includes(p.id)
                              ? prev.filter(a => a !== p.id)
                              : [...prev, p.id])
                          }}
                          style={{
                            textAlign: 'left',
                            borderRadius: 10,
                            border: selectedActions.includes(p.id) ? '2px solid #2563eb' : '1px solid var(--border)',
                            background: selectedActions.includes(p.id) ? 'rgba(37,99,235,0.08)' : 'var(--surface)',
                            color: 'var(--text-primary)',
                            padding: '0.6rem 0.65rem',
                            cursor: 'pointer',
                          }}
                        >
                          <div style={{ fontSize: '0.84rem', fontWeight: 700 }}>{p.title}</div>
                          <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: 3, overflowWrap: 'anywhere', wordBreak: 'break-word' }}>{p.blurb}</div>
                        </button>
                      ))}
                    </div>
                    <button
                      className="coi-btn coi-btn-primary"
                      onClick={() => {
                        if (!selectedAnswer || selectedActions.length === 0) return
                        void submitAnswer(selectedAnswer, selectedActions)
                      }}
                      disabled={!selectedAnswer || selectedActions.length === 0 || submitting}
                      style={{ justifySelf: 'start' }}
                    >
                      {submitting ? 'Submitting...' : 'Submit Decision'}
                    </button>
                  </div>
                  </>
                )}

                {session.viewer?.hasAnswered && session.phase === 'question' && (
                  <div className="coi-waiting" style={{ marginTop: '0.75rem' }}>
                    Decision submitted. Waiting for others ({session.stats.answered}/{session.stats.total})...
                  </div>
                )}
              </div>

              {isReveal && (
                <div className="coi-card">
                  <h3 style={{ fontSize: '0.95rem', marginBottom: '0.75rem' }}>Decision Distribution</h3>
                  <div className="coi-distribution">
                    {q.options.map(opt => {
                      const count = Object.values(session.responses ?? {}).filter(r => r === opt.label).length
                      const total = Object.keys(session.responses ?? {}).length || 1
                      const pct = Math.round((count / total) * 100)
                      return (
                        <div key={opt.label} className="coi-dist-row">
                          <span className="coi-dist-label">{opt.label}</span>
                          <div className="coi-dist-bar-wrap">
                            <div className="coi-dist-bar" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="coi-dist-count">{count}</span>
                        </div>
                      )
                    })}
                  </div>

                  {q.options.map(o => {
                    const isSelected = myAnswer === o.label
                    if (!isSelected) return null
                    return (
                      <div key={o.label} className="coi-explanation your-choice">
                        <strong>Your Choice:</strong> {o.outcome?.explanation}
                      </div>
                    )
                  })}

                  {session.history.length > 0 && (
                    <div className="coi-principle" style={{ marginTop: '0.75rem' }}>
                      <strong>Round impact:</strong>{' '}
                      avg legal exposure {session.history[session.history.length - 1].averageLegalExposure}%,
                      trust {session.history[session.history.length - 1].averageTrustScore}%,
                      disclosure {session.history[session.history.length - 1].averageDisclosure}%,
                      events {session.history[session.history.length - 1].eventCount}.
                    </div>
                  )}
                  {session.history.length > 1 && (
                    <div className="coi-reference" style={{ marginTop: '0.35rem' }}>
                      Delayed effects: previous-round decisions can still surface now through audit/media/whistleblower events.
                    </div>
                  )}

                  {q.principle && <div className="coi-principle"><strong>Key principle:</strong> {q.principle}</div>}
                  {q.reference && <div className="coi-reference">Ref: {q.reference}</div>}

                  {isHost && (
                    <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
                      <button className="coi-btn coi-btn-primary" onClick={() => void hostAction('advance')}>
                        {session.currentQuestion + 1 >= session.totalQuestions ? 'Show Final Results' : `Next Round →`}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {isHost && session.phase === 'question' && (
                <div className="coi-card">
                  <h3 style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>Host Controls</h3>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                    {session.stats.answered}/{session.stats.total} decisions made
                  </p>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="coi-btn coi-btn-secondary" onClick={() => void hostAction('advance')}>Force Reveal</button>
                    <button className="coi-btn coi-btn-danger" onClick={() => void hostAction('reset')}>Reset</button>
                  </div>
                </div>
              )}
            </div>

            <div className="coi-side-col">
              <div className="coi-card">
                <h3 style={{ fontSize: '0.9rem', marginBottom: '0.75rem' }}>Scoreboard</h3>
                {sortedPlayers.map((p, i) => (
                  <div key={p.id} className={`coi-score-row ${p.id === playerToken ? 'is-me' : ''}`}>
                    <span className="coi-rank">#{i + 1}</span>
                    <span className="coi-pname">{p.name}</span>
                    <span className="coi-pts">{p.score}</span>
                    {p.hasAnswered && session.phase === 'question' && <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Submitted</span>}
                  </div>
                ))}
              </div>

              <div className="coi-card">
                <h3 style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>Events</h3>
                <div className="coi-event-log">
                  {[...session.eventLog].reverse().map((e, i) => <div key={i} className="coi-event">{e}</div>)}
                </div>
              </div>
            </div>
          </div>
        )}

        {session.phase === 'done' && (
          <div className="coi-card" style={{ maxWidth: 640, margin: '0 auto' }}>
            <h2 style={{ textAlign: 'center', marginBottom: '1.25rem' }}>Simulation Complete!</h2>
            <div style={{ marginBottom: '1.5rem' }}>
              {sortedPlayers.map((p, i) => (
                <div key={p.id} className={`coi-final-row ${i === 0 ? 'winner' : ''} ${p.id === playerToken ? '' : ''}`}>
                  <span style={{ fontSize: '1.1rem' }}>{`#${i + 1}`}</span>
                  <span style={{ flex: 1 }}>{p.name} <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>({p.roleProfile})</span></span>
                  <span style={{ fontWeight: 700 }}>{p.score} governance</span>
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                    LE {p.legalExposure}% | Trust {p.trustScore}%
                  </span>
                </div>
              ))}
            </div>
            <h3 style={{ fontSize: '0.95rem', marginBottom: '0.75rem' }}>Round Governance Summary</h3>
            {session.history.map((h, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.35rem 0', borderBottom: '1px solid var(--border)', fontSize: '0.88rem' }}>
                <span>Round {i + 1}</span>
                <span style={{ color: 'var(--text-secondary)' }}>
                  LE {h.averageLegalExposure}% | Trust {h.averageTrustScore}% | Disclosure {h.averageDisclosure}% | Events {h.eventCount}
                </span>
              </div>
            ))}
            {isHost && (
              <button className="coi-btn coi-btn-secondary" onClick={() => void hostAction('reset')} style={{ marginTop: '1.25rem' }}>
                Restart (new scenarios)
              </button>
            )}
          </div>
        )}

        {error && <div className="coi-error">{error}</div>}
      </div></div>
    </MiniGameShell>
  )
}





