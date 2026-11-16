import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTheme } from '../../context/ThemeContext'
import { authApi } from '../../api/client'
import type { MiniGameTypeSlug } from '../../api/client'
import { MINI_GAME_LIBRARY_BY_LEVEL, DIFFICULTY_ORDER, GAME_TOPICS, type DifficultyLevel, type GameTopic } from './catalog'
import { MiniGameSvg } from './MiniGameSvg'
import { MiniGameSessionsTable } from './MiniGameSessionsTable'
import { clearEducatorSessionCache, getEducatorSessionCached, getEducatorSessionSync } from './educatorSession'
import MINIGAME_TEACHING_RAW from '../../data/minigameTeaching.json'
import './MiniGameShell.css'

const TWO_PLAYER_GAME_TYPES = new Set<MiniGameTypeSlug>([
  'matching-pennies',
  'prisoners-dilemma',
  'trust-game',
  'ultimatum',
])

function getPlayerModeTag(gameType: MiniGameTypeSlug, solo?: boolean): { icon: string; label: string } {
  if (solo) return { icon: '\u{1F464}', label: 'Solo game' }
  if (TWO_PLAYER_GAME_TYPES.has(gameType)) return { icon: '\u{1F465}', label: 'Two-player game' }
  return { icon: '\u{1F464}\u{1F464}\u{1F464}', label: 'Multiplayer game' }
}

type MiniGameShellProps = {
  title: string
  subtitle?: string
  children: ReactNode
  sessionsGameType?: MiniGameTypeSlug
  showSessionsTable?: boolean
  sessionsRefreshKey?: number
  publicMode?: boolean
}

type TeachingTable = {
  title?: string
  headers?: string[]
  rows?: string[][]
}

type TeachingContent = {
  slug: string
  title: string
  subtitle?: string
  concept?: string
  setup?: string
  keyInsight?: string
  lessons?: string[]
  strategies?: Array<{ name?: string; outcome?: string; insight?: string } | string>
  classroomObservations?: string | string[]
  realWorld?: string
  tip?: string
  furtherReading?: string | Array<{ author?: string; title?: string; journal?: string } | string>
  numericalExample?: string
  tables?: TeachingTable[]
}

const MINIGAME_TEACHING = MINIGAME_TEACHING_RAW as TeachingContent[]

function normalizeSlug(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

function resolveTeachingSlug(gameType?: MiniGameTypeSlug, title?: string): string | null {
  if (gameType) return gameType
  if (!title) return null
  const normalized = normalizeSlug(title)
  const aliasByTitle: Record<string, string> = {
    'director-duties-classifier': 'director-duties',
    'conflict-of-interest-simulation': 'conflict-of-interest',
    'market-basket-analysis': 'market-basket',
    'the-signal': 'social-influence',
  }
  return aliasByTitle[normalized] ?? normalized
}

function hasAnyTeachingSections(content: TeachingContent | null): boolean {
  if (!content) return false
  return Boolean(
    content.concept ||
    content.setup ||
    content.keyInsight ||
    (Array.isArray(content.lessons) && content.lessons.length > 0) ||
    (Array.isArray(content.strategies) && content.strategies.length > 0) ||
    (typeof content.classroomObservations === 'string' && content.classroomObservations.trim()) ||
    (Array.isArray(content.classroomObservations) && content.classroomObservations.length > 0) ||
    content.realWorld ||
    content.tip ||
    content.numericalExample ||
    (Array.isArray(content.tables) && content.tables.length > 0) ||
    (typeof content.furtherReading === 'string' && content.furtherReading.trim()) ||
    (Array.isArray(content.furtherReading) && content.furtherReading.length > 0)
  )
}

export function MiniGameShell({
  title,
  subtitle,
  children,
  sessionsGameType,
  showSessionsTable = false,
  sessionsRefreshKey = 0,
  publicMode = false,
}: MiniGameShellProps) {
  const navigate = useNavigate()
  const { theme, toggleTheme } = useTheme()
  const [menuOpen, setMenuOpen] = useState(false)
  const [launcherOpen, setLauncherOpen] = useState(false)
  const [credits, setCredits] = useState<number | null>(() => publicMode ? null : (getEducatorSessionSync()?.credits ?? null))
  const [educatorEmail, setEducatorEmail] = useState(() => publicMode ? '' : (getEducatorSessionSync()?.email ?? ''))
  const [authResolved, setAuthResolved] = useState(() => publicMode || getEducatorSessionSync() !== null)
  const [showTeachingModal, setShowTeachingModal] = useState(false)
  const currentPath = useMemo(() => window.location.pathname, [])
  const [activeFilter, setActiveFilter] = useState<'all' | DifficultyLevel | GameTopic>('all')

  const filteredGroups = useMemo(() => {
    if (activeFilter === 'all') return MINI_GAME_LIBRARY_BY_LEVEL
    if ((DIFFICULTY_ORDER as readonly string[]).includes(activeFilter)) {
      return MINI_GAME_LIBRARY_BY_LEVEL
        .map((g) => ({ ...g, games: g.games.filter((x) => x.difficulty === activeFilter) }))
        .filter((g) => g.games.length > 0)
    }
    // Topic filter — flatten all groups into one
    const all = MINI_GAME_LIBRARY_BY_LEVEL.flatMap((g) => g.games).filter((x) => x.topic === activeFilter)
    return all.length > 0 ? [{ level: activeFilter as DifficultyLevel, games: all }] : []
  }, [activeFilter])

  const teachingSlug = useMemo(() => resolveTeachingSlug(sessionsGameType, title), [sessionsGameType, title])
  const teachingContent = useMemo(
    () => MINIGAME_TEACHING.find((entry) => entry.slug === teachingSlug) ?? null,
    [teachingSlug]
  )
  const hasTeachingSections = useMemo(() => hasAnyTeachingSections(teachingContent), [teachingContent])

  useEffect(() => {
    if (publicMode) return
    let cancelled = false
    const loadMe = async () => {
      const me = await getEducatorSessionCached()
      if (cancelled) return
      if (!me.ok) {
        setAuthResolved(true)
        navigate('/educator-login', { replace: true })
        return
      }
      if (!cancelled) {
        setEducatorEmail(me.email)
        setCredits(me.credits)
        setAuthResolved(true)
      }
    }
    void loadMe()
    return () => {
      cancelled = true
    }
  }, [publicMode, navigate])

  useEffect(() => {
    if (!showTeachingModal && !launcherOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowTeachingModal(false)
        setLauncherOpen(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [showTeachingModal, launcherOpen])

  const handleLogout = async () => {
    try {
      await authApi.logout('educator')
    } catch {
      // Ignore logout failures and still redirect to login.
    }
    clearEducatorSessionCache()
    navigate('/educator-login')
  }

  if (publicMode) {
    return (
      <div className="mg-public-shell">
        <div className="mg-content mg-content-public">
          {children}
        </div>
      </div>
    )
  }

  if (!authResolved) {
    return (
      <div className="mg-public-shell">
        <div className="mg-content mg-content-public">
          <div className="mg-sessions-panel">Checking educator access...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="mg-shell">
      <div className="mg-main">
        <header className="mg-topbar">
          <div className="mg-topbar-left">
            <button
              type="button"
              className="mg-launcher-btn"
              onClick={() => setLauncherOpen(true)}
              aria-label="Browse experiments"
            >
              <span className="mg-launcher-icon">{'⊞'}</span>
              <span className="mg-launcher-label">All Experiments</span>
            </button>
            <div className="mg-topbar-divider" />
            <div>
              <div className="mg-topbar-title-row">
                <h1 className="mg-topbar-title">{title}</h1>
                {teachingContent && (
                  <button
                    type="button"
                    className="mg-teaching-btn"
                    onClick={() => setShowTeachingModal(true)}
                  >
                    Teaching Guide
                  </button>
                )}
              </div>
              {subtitle && <p className="mg-topbar-subtitle">{subtitle}</p>}
            </div>
          </div>
          <div className="mg-topbar-actions">
            {credits !== null && (
              <div className="mg-credits-pill">Game Credits: {credits}</div>
            )}
            <div className="mg-account">
              <button type="button" className="mg-account-btn" onClick={() => setMenuOpen((v) => !v)}>
                Account
              </button>
              {menuOpen && (
                <div className="mg-account-menu">
                  {educatorEmail && <div className="mg-account-email">{educatorEmail}</div>}
                  <button type="button" onClick={() => navigate('/educator-dashboard')}>Dashboard</button>
                  <button type="button" onClick={handleLogout}>Logout</button>
                </div>
              )}
            </div>
            <button
              type="button"
              className="mg-theme-toggle"
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? '\u2600' : '\uD83C\uDF19'}
            </button>
          </div>
        </header>
        <div className="mg-content">
          {children}
          {showSessionsTable && <MiniGameSessionsTable gameType={sessionsGameType} refreshKey={sessionsRefreshKey} />}
        </div>
      </div>

      {/* macOS Launchpad-style game picker overlay */}
      {launcherOpen && (
        <div className="mg-launcher-overlay" role="dialog" aria-modal="true" aria-label="Browse experiments">
          <button
            type="button"
            className="mg-launcher-backdrop"
            aria-label="Close experiment picker"
            onClick={() => setLauncherOpen(false)}
          />
          <div className="mg-launcher-panel">
            <div className="mg-launcher-header">
              <div className="mg-launcher-header-title">{'\uD83C\uDFAE'} Class Experiments</div>
              <div className="mg-launcher-header-sub">Select a simulation to run with your class</div>
              <button type="button" className="mg-launcher-close" onClick={() => setLauncherOpen(false)}>
                {'\u2715'}
              </button>
            </div>
            <div className="mg-launcher-filters" role="toolbar" aria-label="Filter experiments">
              <button
                type="button"
                className={`mg-filter-pill ${activeFilter === 'all' ? 'active' : ''}`}
                onClick={() => setActiveFilter('all')}
              >All</button>
              <div className="mg-filter-sep" />
              {DIFFICULTY_ORDER.map((level) => (
                <button
                  key={level}
                  type="button"
                  className={`mg-filter-pill ${activeFilter === level ? 'active' : ''}`}
                  onClick={() => setActiveFilter(level)}
                >{level}</button>
              ))}
              <div className="mg-filter-sep" />
              {GAME_TOPICS.map((topic) => (
                <button
                  key={topic}
                  type="button"
                  className={`mg-filter-pill ${activeFilter === topic ? 'active' : ''}`}
                  onClick={() => setActiveFilter(topic)}
                >{topic}</button>
              ))}
            </div>
            <div className="mg-launcher-body">
              {filteredGroups.map(({ level, games }) => (
                <div key={level} className="mg-launcher-group">
                  {filteredGroups.length > 1 && <div className="mg-launcher-group-label">{level}</div>}
                  <div className="mg-launcher-grid">
                    {games.map((game) => {
                      const href = `/mini-games/${game.type}`
                      const isActive = currentPath === href
                      const playerMode = getPlayerModeTag(game.type, game.solo)
                      return (
                        <Link
                          key={game.type}
                          to={href}
                          className={`mg-launcher-card ${isActive ? 'active' : ''}`}
                          onClick={() => setLauncherOpen(false)}
                        >
                          <div className="mg-launcher-card-svg">
                            <MiniGameSvg type={game.type} style={{ width: '100%', height: '100%', display: 'block' }} />
                          </div>
                          <div className="mg-launcher-card-body">
                            <div className="mg-launcher-card-titlerow">
                              <span className="mg-launcher-card-title">{game.icon} {game.title}</span>
                              {game.beta && <span className="mg-beta-tag">Beta</span>}
                            </div>
                            <div className="mg-launcher-card-meta">
                              <span className="mg-launcher-card-difficulty">{game.difficulty}</span>
                              <span className="mg-launcher-player-tag" title={playerMode.label}>{playerMode.icon}</span>
                            </div>
                            <p className="mg-launcher-card-blurb">{game.blurb}</p>
                          </div>
                        </Link>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {showTeachingModal && teachingContent && (
        <div className="mg-teaching-overlay" role="dialog" aria-modal="true" aria-label="Teaching guide">
          <div className="mg-teaching-modal">
            <div className="mg-teaching-header">
              <div>
                <h2>{teachingContent.title}</h2>
                {teachingContent.subtitle && <p>{teachingContent.subtitle}</p>}
              </div>
              <button type="button" className="mg-teaching-close" onClick={() => setShowTeachingModal(false)}>Close</button>
            </div>
            <div className="mg-teaching-body">
              {teachingContent.concept && (
                <section>
                  <h3>Concept</h3>
                  <p>{teachingContent.concept}</p>
                </section>
              )}
              {teachingContent.setup && (
                <section>
                  <h3>How The Game Works</h3>
                  <p>{teachingContent.setup}</p>
                </section>
              )}
              {teachingContent.keyInsight && (
                <section>
                  <h3>Key Insight</h3>
                  <p>{teachingContent.keyInsight}</p>
                </section>
              )}
              {Array.isArray(teachingContent.lessons) && teachingContent.lessons.length > 0 && (
                <section>
                  <h3>Teaching Points</h3>
                  <ul>
                    {teachingContent.lessons.map((lesson, index) => (
                      <li key={`lesson-${index}`}>{lesson}</li>
                    ))}
                  </ul>
                </section>
              )}
              {Array.isArray(teachingContent.strategies) && teachingContent.strategies.length > 0 && (
                <section>
                  <h3>Strategy Discussion</h3>
                  {teachingContent.strategies.every((item) => typeof item === 'string') ? (
                    <ul>
                      {teachingContent.strategies.map((item, index) => (
                        <li key={`strategy-${index}`}>{String(item)}</li>
                      ))}
                    </ul>
                  ) : (
                    <div className="mg-teaching-strategy-grid">
                      {teachingContent.strategies.map((strategy, index) => {
                        if (typeof strategy === 'string') {
                          return (
                            <article key={`strategy-${index}`} className="mg-teaching-strategy-card">
                              <h4>{`Strategy ${index + 1}`}</h4>
                              <p>{strategy}</p>
                            </article>
                          )
                        }
                        return (
                          <article key={`strategy-${index}`} className="mg-teaching-strategy-card">
                            <h4>{strategy.name ?? `Strategy ${index + 1}`}</h4>
                            {strategy.outcome && <p><strong>Outcome:</strong> {strategy.outcome}</p>}
                            {strategy.insight && <p><strong>Insight:</strong> {strategy.insight}</p>}
                          </article>
                        )
                      })}
                    </div>
                  )}
                </section>
              )}
              {teachingContent.classroomObservations && (
                <section>
                  <h3>Classroom Observation</h3>
                  {Array.isArray(teachingContent.classroomObservations) ? (
                    <ul>
                      {teachingContent.classroomObservations.map((item, index) => (
                        <li key={`classroom-${index}`}>{item}</li>
                      ))}
                    </ul>
                  ) : (
                    <p>{teachingContent.classroomObservations}</p>
                  )}
                </section>
              )}
              {teachingContent.realWorld && (
                <section>
                  <h3>Real World Link</h3>
                  <p>{teachingContent.realWorld}</p>
                </section>
              )}
              {teachingContent.tip && (
                <section>
                  <h3>Teaching Tip</h3>
                  <p>{teachingContent.tip}</p>
                </section>
              )}
              {teachingContent.numericalExample && (
                <section>
                  <h3>Numerical Example</h3>
                  <p>{teachingContent.numericalExample}</p>
                </section>
              )}
              {Array.isArray(teachingContent.tables) && teachingContent.tables.length > 0 && (
                <section>
                  <h3>Reference Tables</h3>
                  <div className="mg-teaching-tables">
                    {teachingContent.tables.map((table, index) => (
                      <div key={`table-${index}`} className="mg-teaching-table-wrap">
                        {table.title && <h4>{table.title}</h4>}
                        <div className="mg-teaching-table-scroll">
                          <table>
                            <thead>
                              <tr>
                                {(table.headers ?? []).map((header, headerIndex) => (
                                  <th key={`table-${index}-header-${headerIndex}`}>{header}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {(table.rows ?? []).map((row, rowIndex) => (
                                <tr key={`table-${index}-row-${rowIndex}`}>
                                  {row.map((cell, cellIndex) => (
                                    <td key={`table-${index}-row-${rowIndex}-cell-${cellIndex}`}>{cell}</td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}
              {teachingContent.furtherReading && (
                <section>
                  <h3>Further Reading</h3>
                  {typeof teachingContent.furtherReading === 'string' ? (
                    <p>{teachingContent.furtherReading}</p>
                  ) : (
                    <ul>
                      {teachingContent.furtherReading.map((item, index) => {
                        if (typeof item === 'string') return <li key={`reading-${index}`}>{item}</li>
                        const author = item.author?.trim() ?? ''
                        const title = item.title?.trim() ?? ''
                        const journal = item.journal?.trim() ?? ''
                        const text = [author, title, journal].filter(Boolean).join(' - ')
                        return <li key={`reading-${index}`}>{text || 'Reference item'}</li>
                      })}
                    </ul>
                  )}
                </section>
              )}
              {!hasTeachingSections && (
                <section>
                  <h3>Teaching Guide</h3>
                  <p>This content is being updated. Please check back soon.</p>
                </section>
              )}
            </div>
          </div>
          <button
            type="button"
            className="mg-teaching-backdrop"
            aria-label="Close teaching guide"
            onClick={() => setShowTeachingModal(false)}
          />
        </div>
      )}
    </div>
  )
}

