import { QRCodeSVG } from 'qrcode.react'
import type { EducatorMiniGameSession } from '../../api/client'
import './SessionControlPanel.css'

type QuickAction = 'start' | 'advance' | 'reset'

type Props = {
  creatingSession: boolean
  onCreateSession: () => void
  startingSolo?: boolean
  onStartSolo?: () => void
  sessions: EducatorMiniGameSession[]
  activeSessionId: string | null
  onActiveSessionChange: (sessionId: string) => void
  onQuickAction: (action: QuickAction) => void
  quickActionLoading: QuickAction | null
  quickActionMessage?: string | null
  joinedNames?: string[]
  disableStart?: boolean
  creatingMessage?: string
}

export default function SessionControlPanel({
  creatingSession,
  onCreateSession,
  startingSolo = false,
  onStartSolo,
  sessions,
  activeSessionId,
  onActiveSessionChange,
  onQuickAction,
  quickActionLoading,
  quickActionMessage,
  joinedNames = [],
  disableStart = false,
  creatingMessage = 'Creating session. Please wait...',
}: Props) {
  const activeSession = sessions.find((s) => s.id === activeSessionId) || sessions[0] || null
  const code = activeSession?.roomCode || ''
  const joinLink = activeSession?.joinByCodeLink || `${window.location.origin}/mini-games/join?code=${encodeURIComponent(code)}`

  return (
    <div className="mg-session-panel">
      <button className="mgsp-btn mgsp-primary" onClick={onCreateSession} disabled={creatingSession}>
        {creatingSession ? 'Creating...' : 'Create Session'}
      </button>
      {creatingSession && <div className="mg-session-status">{creatingMessage}</div>}
      {onStartSolo && (
        <button className="mgsp-btn mgsp-secondary" onClick={onStartSolo} disabled={startingSolo}>
          {startingSolo ? 'Starting Solo...' : 'Play Solo Test'}
        </button>
      )}

      {creatingSession ? (
        <div className="mg-session-panel-body mg-session-panel-loading">
          <div className="mg-session-status">Preparing new session details...</div>
        </div>
      ) : activeSession && (
        <div className="mg-session-panel-body">
          {sessions.length > 1 && (
            <div className="fishery-form-group">
              <label>Active Session</label>
              <select className="mgsp-input" value={activeSession.id} onChange={(e) => onActiveSessionChange(e.target.value)}>
                {sessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {`${s.roomCode || 'NO-CODE'} • ${s.status}`}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="fishery-form-group">
            <label>Active Game Code</label>
            <div className="mg-session-row">
              <input className="mgsp-input" style={{ flex: 1, minWidth: 0, width: '100%' }} value={code} readOnly />
              <button className="mgsp-btn mgsp-secondary" type="button" onClick={() => navigator.clipboard.writeText(code)}>
                {'\u{1F4CB}'}
              </button>
            </div>
          </div>

          <div className="fishery-form-group">
            <label>Latest Join Link</label>
            <div className="mg-session-row">
              <input className="mgsp-input" style={{ flex: 1, minWidth: 0, width: '100%' }} value={joinLink} readOnly />
              <button className="mgsp-btn mgsp-secondary" type="button" onClick={() => navigator.clipboard.writeText(joinLink)}>
                {'\u{1F4CB}'}
              </button>
            </div>
            <div className="mgsp-qr-wrap">
              <QRCodeSVG value={joinLink} size={200} bgColor="#ffffff" fgColor="#0f172a" level="M" />
            </div>
          </div>

          <div className="mg-session-status">
            Status: <strong>{activeSession.status}</strong> | Joined: {activeSession.joinedCount || 0}/{activeSession.teamCount}
          </div>

          <div className="fishery-form-group">
            <label>Joined Names ({joinedNames.length})</label>
            <div className="mg-session-names">
              {joinedNames.length === 0 ? (
                <span className="mg-session-empty">No players joined yet</span>
              ) : (
                joinedNames.map((name) => (
                  <span key={name} className="mgsp-pill">{name}</span>
                ))
              )}
            </div>
          </div>

          <div className="mg-session-actions">
            <button
              className="mgsp-btn mgsp-secondary"
              type="button"
              disabled={quickActionLoading !== null || activeSession.status !== 'LOBBY' || disableStart}
              onClick={() => onQuickAction('start')}
            >
              {quickActionLoading === 'start' ? 'Starting...' : activeSession.status === 'LOBBY' ? 'Start' : 'Started'}
            </button>
            <button
              className="mgsp-btn mgsp-secondary"
              type="button"
              disabled={quickActionLoading !== null || activeSession.status !== 'ACTIVE'}
              onClick={() => onQuickAction('advance')}
            >
              {quickActionLoading === 'advance' ? 'Advancing...' : 'Advance'}
            </button>
            <button
              className="mgsp-btn mgsp-secondary"
              type="button"
              disabled={quickActionLoading !== null || (activeSession.status !== 'ACTIVE' && activeSession.status !== 'COMPLETED')}
              onClick={() => onQuickAction('reset')}
            >
              {quickActionLoading === 'reset' ? 'Resetting...' : 'Reset'}
            </button>
          </div>

          {quickActionMessage && <div className="mg-session-status">{quickActionMessage}</div>}
        </div>
      )}
    </div>
  )
}
