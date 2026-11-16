import { useEffect, useMemo, useState } from 'react'
import type { EducatorMiniGamePlayer, EducatorMiniGameSession, MiniGameTypeSlug } from '../../api/client'
import { educatorMiniGamesApi } from './api'
import { MINI_GAME_LIBRARY } from './catalog'

type LoadedLinks = {
  roomCode: string | null
  hostLink: string
  joinByCodeLink?: string
}

type MiniGameSessionsTableProps = {
  gameType?: MiniGameTypeSlug
  refreshKey?: number
}

export function MiniGameSessionsTable({ gameType, refreshKey = 0 }: MiniGameSessionsTableProps) {
  const [loading, setLoading] = useState(false)
  const [hasTriggeredLoad, setHasTriggeredLoad] = useState(false)
  const [sessions, setSessions] = useState<EducatorMiniGameSession[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [linksById, setLinksById] = useState<Record<string, LoadedLinks>>({})
  const [playersById, setPlayersById] = useState<Record<string, EducatorMiniGamePlayer[]>>({})
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [actionMsg, setActionMsg] = useState('')

  const filteredSessions = useMemo(
    () => (gameType ? sessions.filter((s) => s.gameType === gameType) : sessions),
    [sessions, gameType],
  )

  const sortedSessions = useMemo(
    () => [...filteredSessions].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [filteredSessions],
  )
  const visibleSessions = useMemo(() => sortedSessions.slice(0, 12), [sortedSessions])
  const hasSessions = visibleSessions.length > 0

  const tableTitle = useMemo(() => {
    if (!gameType) return 'Created Mini-Game Sessions'
    const game = MINI_GAME_LIBRARY.find((g) => g.type === gameType)
    return `Created ${game?.title || 'Mini-Game'} Sessions`
  }, [gameType])

  const loadSessions = async () => {
    setLoading(true)
    try {
      const next = await educatorMiniGamesApi.listSessions()
      setSessions(next)
    } catch {
      setSessions([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!hasTriggeredLoad) return
    void loadSessions()
  }, [refreshKey, hasTriggeredLoad])

  const toggleDetails = async (session: EducatorMiniGameSession) => {
    if (expandedId === session.id) {
      setExpandedId(null)
      return
    }

    setExpandedId(session.id)

    const needsLinks = !linksById[session.id]
    const needsPlayers = !playersById[session.id]
    if (!needsLinks && !needsPlayers) return

    try {
      const [linkData, players] = await Promise.all([
        needsLinks ? educatorMiniGamesApi.getSessionLinks(session.id) : Promise.resolve(null),
        needsPlayers ? educatorMiniGamesApi.getSessionPlayers(session.id) : Promise.resolve(playersById[session.id] || []),
      ])

      if (linkData) {
        setLinksById((prev) => ({
          ...prev,
          [session.id]: {
            roomCode: linkData.session.roomCode || session.roomCode || null,
            hostLink: linkData.session.hostLink,
            joinByCodeLink: linkData.session.joinByCodeLink,
          },
        }))
      }

      if (needsPlayers) {
        setPlayersById((prev) => ({ ...prev, [session.id]: players }))
      }
    } catch {
      // keep row expanded even if details call fails
    }
  }

  const runHostAction = async (sessionId: string, action: 'start' | 'advance' | 'reset') => {
    setActionLoading(`${sessionId}:${action}`)
    setActionMsg('')
    try {
      await educatorMiniGamesApi.hostAction(sessionId, action)
      setActionMsg(`Session ${action} successful`)
      const [nextSessions, nextPlayers] = await Promise.all([
        educatorMiniGamesApi.listSessions(),
        educatorMiniGamesApi.getSessionPlayers(sessionId).catch(() => []),
      ])
      setSessions(nextSessions)
      setPlayersById((prev) => ({ ...prev, [sessionId]: nextPlayers }))
    } catch (err) {
      setActionMsg(err instanceof Error ? err.message : `Failed to ${action} session`)
    } finally {
      setActionLoading(null)
    }
  }

  const formatCreatedAt = (value: string) =>
    new Date(value).toLocaleString([], {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })

  if (!hasTriggeredLoad) {
    return (
      <section className="mg-sessions-panel">
        <div className="mg-sessions-head">
          <h2 style={{ margin: 0 }}>{tableTitle}</h2>
          <button type="button" className="mg-sessions-btn" onClick={() => setHasTriggeredLoad(true)}>
            Show session history
          </button>
        </div>
      </section>
    )
  }

  return (
    <section className="mg-sessions-panel">
      <div className="mg-sessions-head">
        <h2 style={{ margin: 0 }}>{tableTitle}</h2>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {actionMsg && <span className="mg-sessions-note">{actionMsg}</span>}
          <button type="button" className="mg-sessions-btn" onClick={() => void loadSessions()} disabled={loading}>
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      <div className="mg-sessions-table-wrap">
        <table className="mg-sessions-table">
          <thead>
            <tr>
              <th>Game</th>
              <th>Code</th>
              <th>Created</th>
              <th>Joined</th>
              <th>Status</th>
              <th className="right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {!loading && !hasSessions && (
              <tr>
                <td colSpan={6} className="mg-sessions-empty">
                  No sessions created yet for this game.
                </td>
              </tr>
            )}

            {visibleSessions.map((s) => {
              const meta = MINI_GAME_LIBRARY.find((g) => g.type === s.gameType)
              const isOpen = expandedId === s.id
              const links = linksById[s.id]
              const players = playersById[s.id] || []
              const roomCode = links?.roomCode || s.roomCode || ''
              const joinLink = links?.joinByCodeLink || `${window.location.origin}/mini-games/join?code=${encodeURIComponent(roomCode)}`
              const supportsHostControls = s.gameType === 'bank-run' || s.gameType === 'fishery' || s.gameType === 'double-auction'
              const canStart = s.status === 'LOBBY'
              const canAdvance = s.status === 'ACTIVE'
              const canReset = s.status === 'ACTIVE' || s.status === 'COMPLETED'

              return [
                <tr key={s.id}>
                  <td style={{ fontWeight: 700 }}>{meta?.title || s.gameType}</td>
                  <td className="mono">{s.roomCode || '-'}</td>
                  <td>{formatCreatedAt(s.createdAt)}</td>
                  <td>{typeof s.joinedCount === 'number' ? s.joinedCount : 0} / {s.teamCount}</td>
                  <td>{s.status}</td>
                  <td className="right">
                    <button type="button" className="mg-sessions-btn" onClick={() => void toggleDetails(s)}>
                      {isOpen ? 'Hide Details' : 'Show Details'}
                    </button>
                  </td>
                </tr>,
                isOpen && (
                  <tr key={`${s.id}-details`} className="mg-sessions-detail-row">
                    <td colSpan={6}>
                      <div className="mg-sessions-detail-grid">
                        <div className="mg-sessions-detail-item">
                          <label>Game Code</label>
                          <div className="mg-sessions-detail-field">
                            <input readOnly value={roomCode} />
                            <button type="button" className="mg-sessions-btn" onClick={() => navigator.clipboard.writeText(roomCode)}>
                              Copy Code
                            </button>
                          </div>
                        </div>

                        <div className="mg-sessions-detail-item">
                          <label>Join Link</label>
                          <div className="mg-sessions-detail-field">
                            <input readOnly value={joinLink} />
                            <button type="button" className="mg-sessions-btn" onClick={() => navigator.clipboard.writeText(joinLink)}>
                              Copy Join Link
                            </button>
                          </div>
                        </div>

                        <div className="mg-sessions-detail-item">
                          <label>Joined Players ({players.length})</label>
                          <div className="mg-sessions-player-list">
                            {players.length === 0 ? (
                              <span className="mg-sessions-muted">No players joined yet</span>
                            ) : (
                              players.map((p) => (
                                <span key={p.id} className="mg-sessions-player-pill">
                                  {p.name}
                                  {p.isBot ? ' (bot)' : ''}
                                  {typeof p.submitted === 'boolean' ? ` - ${p.submitted ? 'submitted' : 'waiting'}` : ''}
                                </span>
                              ))
                            )}
                          </div>
                        </div>

                        {supportsHostControls && (
                          <div className="mg-sessions-detail-item">
                            <label>Host Controls</label>
                            <div className="mg-sessions-control-row">
                              <button
                                type="button"
                                className="mg-sessions-btn"
                                disabled={actionLoading !== null || !canStart}
                                onClick={() => void runHostAction(s.id, 'start')}
                              >
                                {actionLoading === `${s.id}:start` ? 'Starting...' : canStart ? 'Start' : 'Started'}
                              </button>
                              <button
                                type="button"
                                className="mg-sessions-btn"
                                disabled={actionLoading !== null || !canAdvance}
                                onClick={() => void runHostAction(s.id, 'advance')}
                              >
                                {actionLoading === `${s.id}:advance` ? 'Advancing...' : 'Advance'}
                              </button>
                              <button
                                type="button"
                                className="mg-sessions-btn"
                                disabled={actionLoading !== null || !canReset}
                                onClick={() => void runHostAction(s.id, 'reset')}
                              >
                                {actionLoading === `${s.id}:reset` ? 'Resetting...' : 'Reset'}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ),
              ]
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}

