import { useEffect, useMemo, useState } from 'react'
import { MiniGameShell } from '../features/minigames/MiniGameShell'
import { getEducatorSessionCached } from '../features/minigames/educatorSession'
import { educatorMiniGamesApi } from '../features/minigames/api'

type RiskLevel = 'Low' | 'Medium' | 'High'
type Rating = 'A' | 'BBB' | 'BB' | 'B'

type ProjectOption = {
  id: string
  name: string
  expectedReturn: number
  risk: RiskLevel
  investment: number
}

type ScenarioConfig = {
  id: number
  title: string
  description: string
  seed: number
  projects: ProjectOption[]
  teaching: string
}

type ScenarioResult = {
  scenarioId: number
  scenarioTitle: string
  projectName: string
  risk: RiskLevel
  expectedReturn: number
  realizedReturn: number
  waccUsed: number
  investment: number
  debtShare: number
  equityShare: number
  internalShare: number
  valueCreated: number
  leverageAfter: number
  ratingAfter: Rating
}

type FinancingOption = {
  id: string
  label: string
  description: string
  debtPct: number
  equityPct: number
  internalPct: number
}

const FINANCING_OPTIONS: FinancingOption[] = [
  {
    id: 'debt-heavy',
    label: 'Bank Loan',
    description: 'Finance mostly with cheap debt — raises leverage and future borrowing cost.',
    debtPct: 70,
    equityPct: 0,
    internalPct: 30,
  },
  {
    id: 'balanced',
    label: 'Balanced Mix',
    description: 'Blend debt, new equity, and internal cash — moderate impact on rating.',
    debtPct: 35,
    equityPct: 25,
    internalPct: 40,
  },
  {
    id: 'equity-focus',
    label: 'Equity Issue',
    description: 'Raise new equity — more expensive but protects your credit rating.',
    debtPct: 0,
    equityPct: 65,
    internalPct: 35,
  },
]

const START_CAPITAL = 1_000_000
const BASE_COST_DEBT = 0.06
const BASE_COST_EQUITY = 0.115

const SCENARIOS: ScenarioConfig[] = [
  {
    id: 1,
    title: 'Consumer Product Expansion',
    description: 'Demand is strong. You can finance steady growth or take a high-risk bet for share gains.',
    seed: 101,
    projects: [
      { id: '1-a', name: 'Automation Upgrade', expectedReturn: 0.11, risk: 'Low', investment: 250_000 },
      { id: '1-b', name: 'Regional Launch', expectedReturn: 0.15, risk: 'Medium', investment: 340_000 },
      { id: '1-c', name: 'Category Disruption Bet', expectedReturn: 0.22, risk: 'High', investment: 450_000 },
    ],
    teaching: 'Higher expected return helps only when risk and financing cost stay under control. Debt can help, then punish you later if leverage rises too far.',
  },
  {
    id: 2,
    title: 'Manufacturing Efficiency Push',
    description: 'Margins are thin. The project must clear WACC to create value in this round.',
    seed: 202,
    projects: [
      { id: '2-a', name: 'Maintenance Program', expectedReturn: 0.10, risk: 'Low', investment: 220_000 },
      { id: '2-b', name: 'Energy Retrofit', expectedReturn: 0.145, risk: 'Medium', investment: 320_000 },
      { id: '2-c', name: 'Capacity Expansion', expectedReturn: 0.205, risk: 'High', investment: 430_000 },
    ],
    teaching: 'Project quality and capital structure are linked decisions. Good projects can still destroy value if the financing mix drives WACC too high.',
  },
  {
    id: 3,
    title: 'Digital Platform Investment',
    description: 'A platform move may increase growth but outcomes are volatile and path-dependent.',
    seed: 303,
    projects: [
      { id: '3-a', name: 'Core Platform Refresh', expectedReturn: 0.12, risk: 'Low', investment: 270_000 },
      { id: '3-b', name: 'Subscription Stack Build', expectedReturn: 0.165, risk: 'Medium', investment: 360_000 },
      { id: '3-c', name: 'Aggressive Market Entry', expectedReturn: 0.23, risk: 'High', investment: 480_000 },
    ],
    teaching: 'When leverage is already elevated, adding more debt can move you from efficient financing to rating pressure fast.',
  },
  {
    id: 4,
    title: 'Final Strategic Round',
    description: 'You are judged on total firm value. Short-term return is less important than value creation after cost of capital.',
    seed: 404,
    projects: [
      { id: '4-a', name: 'Supply Chain Optimization', expectedReturn: 0.105, risk: 'Low', investment: 230_000 },
      { id: '4-b', name: 'Product Portfolio Shift', expectedReturn: 0.16, risk: 'Medium', investment: 350_000 },
      { id: '4-c', name: 'Cross-border Scale Play', expectedReturn: 0.225, risk: 'High', investment: 460_000 },
    ],
    teaching: 'Strong performance comes from repeatedly choosing projects where realized return stays above WACC, not from maximizing debt or return labels in one round.',
  },
]

function seededRand(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0
    return s / 0x100000000
  }
}

function fmtMoney(value: number) {
  return `$${Math.round(value).toLocaleString()}`
}

function fmtPct(value: number, dp = 2) {
  return `${(value * 100).toFixed(dp)}%`
}

function getRating(leverage: number): Rating {
  if (leverage < 0.45) return 'A'
  if (leverage < 0.65) return 'BBB'
  if (leverage < 0.8) return 'BB'
  return 'B'
}

function getRiskVolatility(risk: RiskLevel) {
  if (risk === 'Low') return 0.04
  if (risk === 'Medium') return 0.085
  return 0.14
}

function getCosts(leverage: number, rating: Rating) {
  const ratingPremium = rating === 'A' ? 0 : rating === 'BBB' ? 0.015 : rating === 'BB' ? 0.035 : 0.06
  const leveragePremium = Math.max(0, leverage - 0.4) * 0.08
  const costDebt = BASE_COST_DEBT + ratingPremium + leveragePremium
  const costEquity = BASE_COST_EQUITY + leverage * 0.05
  return { costDebt, costEquity }
}

function getWacc(costDebt: number, costEquity: number, debt: number, equity: number) {
  const total = Math.max(1, debt + equity)
  return (debt / total) * costDebt + (equity / total) * costEquity
}

function computeOptionPreview(
  option: FinancingOption,
  project: ProjectOption,
  currentDebt: number,
  currentEquity: number,
) {
  const debtFunding = project.investment * (option.debtPct / 100)
  const equityFunding = project.investment * (option.equityPct / 100)
  const nextDebt = currentDebt + debtFunding
  const nextEquity = currentEquity + equityFunding
  const nextLeverage = nextDebt / Math.max(1, nextDebt + nextEquity)
  const nextRating = getRating(nextLeverage)
  const { costDebt: ncd, costEquity: nce } = getCosts(nextLeverage, nextRating)
  const nextWacc = getWacc(ncd, nce, nextDebt, nextEquity)
  return { debtFunding, equityFunding, internalFunding: project.investment * (option.internalPct / 100), nextLeverage, nextRating, nextWacc }
}

function getNarrative(
  totalValueCreated: number,
  firmValue: number,
  finalLeverage: number,
  averageWacc: number,
  shareholderReturn: number,
): string {
  const fv = fmtMoney(firmValue)
  const tv = fmtMoney(Math.abs(totalValueCreated))
  const ret = fmtPct(shareholderReturn, 1)
  const highLeverage = finalLeverage > 0.55
  const highWacc = averageWacc > 0.09

  if (totalValueCreated >= 80_000) {
    return `Your firm finished at ${fv} — a ${ret} return for shareholders. By consistently picking projects whose returns beat your cost of capital, you added ${tv} in value across four rounds. ${highLeverage ? 'You carried meaningful debt but managed it well.' : 'Disciplined financing kept WACC low and rating pressure minimal.'} This is what strong capital allocation looks like.`
  }
  if (totalValueCreated >= 25_000) {
    return `Your firm finished at ${fv}, generating ${tv} in shareholder value — a solid but uneven result. Most decisions cleared WACC, but ${highLeverage ? 'rising leverage pushed up your cost of capital in later rounds.' : highWacc ? 'WACC ran higher than it needed to, trimming the spread.' : 'a few rounds left value on the table.'} Tighter financing discipline would have compounded the gains further.`
  }
  if (totalValueCreated >= 0) {
    return `Your firm finished at ${fv}, barely breaking even on value creation (${tv} net). ${highLeverage ? 'Leverage climbed and raised borrowing costs, eroding the project spread.' : 'Project returns and WACC were too close — the margin for error was thin.'} Value is created in the spread between realized return and cost of capital. That spread needs to be deliberately managed, not left to chance.`
  }
  return `Your firm finished at ${fv}, destroying ${tv} in shareholder value. ${totalValueCreated < -50_000 ? 'Either project returns consistently fell short of WACC, or debt load pushed financing costs into the danger zone.' : 'A few rounds of negative spread compounded quickly.'} This is how firms quietly erode value — not through bad luck alone, but through mismatched project risk and capital structure. Check the WACC before you commit next time.`
}

export default function CapitalStructureLabMiniGamePage() {
  const query = useMemo(() => new URLSearchParams(window.location.search), [])
  const GAME_SLUG = 'capital-structure-lab'
  const roomFromUrl = (query.get('room') || '').trim().toUpperCase()
  const inviteToken = (query.get('invite') || '').trim()
  const hasStudentContext = Boolean(roomFromUrl || inviteToken)

  const [gamePhase, setGamePhase] = useState<'setup' | 'playing' | 'done'>(hasStudentContext ? 'playing' : 'setup')
  const [authChecked, setAuthChecked] = useState(hasStudentContext)
  const [canAccessSetup, setCanAccessSetup] = useState(hasStudentContext)
  const [studentAccessResolved, setStudentAccessResolved] = useState(!hasStudentContext)
  const [studentAccessAllowed, setStudentAccessAllowed] = useState(!hasStudentContext)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const [createdLink, setCreatedLink] = useState<{ roomCode: string; joinLink: string } | null>(null)
  const [sessionsRefreshKey, setSessionsRefreshKey] = useState(0)

  const [scenarioIndex, setScenarioIndex] = useState(0)
  const [cash, setCash] = useState(START_CAPITAL)
  const [debt, setDebt] = useState(0)
  const [equityValue, setEquityValue] = useState(START_CAPITAL)
  const [firmValue, setFirmValue] = useState(START_CAPITAL)
  const [selectedProjectId, setSelectedProjectId] = useState(SCENARIOS[0].projects[0].id)
  const [financingOptionId, setFinancingOptionId] = useState('balanced')
  const [results, setResults] = useState<ScenarioResult[]>([])
  const [revealed, setRevealed] = useState(false)
  const [error, setError] = useState('')

  const scenario = SCENARIOS[scenarioIndex]
  const selectedProject = scenario.projects.find((p) => p.id === selectedProjectId) || scenario.projects[0]
  const selectedFinancing = FINANCING_OPTIONS.find((o) => o.id === financingOptionId) || FINANCING_OPTIONS[1]
  const leverage = debt / Math.max(1, debt + equityValue)
  const rating = getRating(leverage)
  const { costDebt, costEquity } = getCosts(leverage, rating)
  const wacc = getWacc(costDebt, costEquity, debt, equityValue)
  const debtShare = selectedFinancing.debtPct
  const equityShare = selectedFinancing.equityPct
  const internalShare = selectedFinancing.internalPct

  useEffect(() => {
    if (hasStudentContext) return
    let cancelled = false
    getEducatorSessionCached(true).then((s) => {
      if (cancelled) return
      setCanAccessSetup(s.ok)
      setAuthChecked(true)
    })
    return () => { cancelled = true }
  }, [hasStudentContext])

  useEffect(() => {
    if (!hasStudentContext && authChecked && !canAccessSetup) {
      window.location.href = '/educator-login'
    }
  }, [hasStudentContext, authChecked, canAccessSetup])

  useEffect(() => {
    if (!hasStudentContext) {
      setStudentAccessAllowed(true)
      setStudentAccessResolved(true)
      return
    }
    let cancelled = false
    const validateStudentContext = async () => {
      try {
        let roomCode = roomFromUrl
        if (inviteToken) {
          const inviteResponse = await fetch(`/api/minigames/invite/${encodeURIComponent(inviteToken)}`, {
            headers: { 'Content-Type': 'application/json' },
          })
          if (!inviteResponse.ok) throw new Error('Invalid invite')
          const inviteData = await inviteResponse.json() as {
            success?: boolean
            invite?: { gameType?: string; roomCode?: string | null }
          }
          if (!inviteData.success || inviteData.invite?.gameType !== GAME_SLUG) throw new Error('Invalid invite')
          if (!roomCode) roomCode = String(inviteData.invite?.roomCode || '').trim().toUpperCase()
        }
        if (!roomCode) throw new Error('Missing room code')

        const roomResponse = await fetch(`/api/minigames/join/${encodeURIComponent(roomCode)}`, {
          headers: { 'Content-Type': 'application/json' },
        })
        if (!roomResponse.ok) throw new Error('Invalid room')
        const roomData = await roomResponse.json() as { success?: boolean; room?: { gameType?: string } }
        if (!roomData.success || roomData.room?.gameType !== GAME_SLUG) throw new Error('Invalid room')

        if (!cancelled) {
          setStudentAccessAllowed(true)
          setStudentAccessResolved(true)
        }
      } catch {
        if (!cancelled) {
          setStudentAccessAllowed(false)
          setStudentAccessResolved(true)
          window.location.href = '/educator-login'
        }
      }
    }
    void validateStudentContext()
    return () => { cancelled = true }
  }, [hasStudentContext, inviteToken, roomFromUrl, GAME_SLUG])

  useEffect(() => {
    if (hasStudentContext && gamePhase === 'setup') setGamePhase('playing')
  }, [hasStudentContext, gamePhase])

  useEffect(() => {
    setSelectedProjectId(scenario.projects[0].id)
    setFinancingOptionId('balanced')
    setRevealed(false)
    setError('')
  }, [scenarioIndex, scenario])

  async function handleCreateLink() {
    setCreating(true)
    setCreateError('')
    try {
      const res = await educatorMiniGamesApi.createSession({ gameType: 'capital-structure-lab', teamCount: 1 })
      const roomCode = res.session.roomCode || ''
      const joinLink = roomCode
        ? `${window.location.origin}/mini-games/capital-structure-lab?room=${encodeURIComponent(roomCode)}`
        : (res.session.joinByCodeLink || `${window.location.origin}/mini-games/join`)
      setCreatedLink({ roomCode: res.session.roomCode || '', joinLink })
      setSessionsRefreshKey((k) => k + 1)
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setCreating(false)
    }
  }

  function resetRun() {
    setScenarioIndex(0)
    setCash(START_CAPITAL)
    setDebt(0)
    setEquityValue(START_CAPITAL)
    setFirmValue(START_CAPITAL)
    setResults([])
    setSelectedProjectId(SCENARIOS[0].projects[0].id)
    setFinancingOptionId('balanced')
    setRevealed(false)
    setError('')
  }

  function runDecision() {
    if (revealed) return
    setError('')

    const internalFunding = selectedProject.investment * (internalShare / 100)
    if (internalFunding > cash) {
      setError('Not enough internal cash for this option. Choose a lower-cash option.')
      return
    }

    const rng = seededRand(scenario.seed + scenarioIndex * 19 + results.length * 31)
    const rawShock = (rng() * 2 - 1) * getRiskVolatility(selectedProject.risk)

    // Cap downside on correct decisions (expectedReturn > WACC) so students see cause-effect clearly
    const isCorrectDecision = selectedProject.expectedReturn > wacc
    const shock = isCorrectDecision
      ? Math.max(rawShock, wacc - selectedProject.expectedReturn)
      : rawShock
    const realizedReturn = selectedProject.expectedReturn + shock

    const debtFunding = selectedProject.investment * (debtShare / 100)
    const equityFunding = selectedProject.investment * (equityShare / 100)
    const valueCreated = selectedProject.investment * (realizedReturn - wacc)

    const nextCash = cash - internalFunding + selectedProject.investment * realizedReturn
    const nextDebt = debt + debtFunding
    const nextEquity = equityValue + equityFunding
    const nextFirmValue = firmValue + valueCreated
    const nextLeverage = nextDebt / Math.max(1, nextDebt + nextEquity)
    const nextRating = getRating(nextLeverage)

    setCash(nextCash)
    setDebt(nextDebt)
    setEquityValue(nextEquity)
    setFirmValue(nextFirmValue)

    setResults((prev) => [
      ...prev,
      {
        scenarioId: scenario.id,
        scenarioTitle: scenario.title,
        projectName: selectedProject.name,
        risk: selectedProject.risk,
        expectedReturn: selectedProject.expectedReturn,
        realizedReturn,
        waccUsed: wacc,
        investment: selectedProject.investment,
        debtShare,
        equityShare,
        internalShare,
        valueCreated,
        leverageAfter: nextLeverage,
        ratingAfter: nextRating,
      },
    ])

    setRevealed(true)
  }

  function handleNext() {
    if (scenarioIndex + 1 < SCENARIOS.length) {
      setScenarioIndex((i) => i + 1)
    } else {
      setGamePhase('done')
    }
  }

  if (hasStudentContext && !studentAccessResolved) {
    return (
      <MiniGameShell title="Capital Structure Lab" subtitle="Intro Corporate Finance" publicMode={true}>
        <div style={{ maxWidth: 860, margin: '0 auto', padding: 24 }}>Loading session...</div>
      </MiniGameShell>
    )
  }

  if (hasStudentContext && studentAccessResolved && !studentAccessAllowed) {
    return null
  }

  if (gamePhase === 'setup') {
    return (
      <MiniGameShell
        title="Capital Structure Lab"
        subtitle="Debt, Equity, WACC, and Value Creation"
        sessionsGameType="capital-structure-lab"
        showSessionsTable={authChecked && canAccessSetup}
        sessionsRefreshKey={sessionsRefreshKey}
      >
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '20px 20px' }}>
          <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <h1 style={{ margin: 0, fontSize: '3rem', fontWeight: 800, color: '#0ea5b8', display: 'inline-flex', alignItems: 'center', gap: '0.65rem' }}>
              <span style={{ width: 40, height: 40, borderRadius: 6, background: '#0ea5b8', display: 'inline-block' }} />
              Capital Structure Lab
            </h1>
            <p style={{ margin: '0.65rem auto 0', maxWidth: 760, color: 'var(--mg-muted)', fontSize: '1.1rem', lineHeight: 1.5 }}>
              Choose projects and funding mix across four scenarios. Learn debt vs equity, WACC, and value creation through consequences.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
            <div style={{ background: 'var(--mg-surface)', border: '1px solid var(--mg-accent)', borderRadius: 16, padding: '1.4rem 1.5rem' }}>
              <h2 style={{ fontSize: '1rem', color: 'var(--mg-accent)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1rem' }}>How It Works</h2>
              <div style={{ fontSize: '0.96rem', lineHeight: 1.7, color: 'var(--mg-text)', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                <p>Each scenario shows three projects with <strong>expected return</strong>, <strong>risk</strong>, and <strong>investment amount</strong>.</p>
                <p>Pick one project, then choose a <strong>financing option</strong> — bank loan, balanced mix, or equity issue — and see the WACC and leverage consequences.</p>
                <p>Projects create value when <strong>realized return &gt; WACC</strong>. Too much leverage raises future debt cost.</p>
                <div style={{ marginTop: '0.4rem', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--mg-border)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', background: 'rgba(59,130,246,0.12)', fontWeight: 700, padding: '0.45rem 0.65rem' }}>
                    <span>Debt Ratio</span><span>Typical Rating</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', padding: '0.45rem 0.65rem' }}><span>&lt; 45%</span><span>A</span></div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', padding: '0.45rem 0.65rem', background: 'rgba(148,163,184,0.08)' }}><span>45% - 65%</span><span>BBB</span></div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', padding: '0.45rem 0.65rem' }}><span>65% - 80%</span><span>BB</span></div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', padding: '0.45rem 0.65rem', background: 'rgba(148,163,184,0.08)' }}><span>&gt; 80%</span><span>B</span></div>
                </div>
              </div>
            </div>

            <div style={{ background: 'var(--mg-surface)', border: '1px solid var(--mg-border)', borderRadius: 16, padding: '1.4rem 1.5rem' }}>
              <div style={{ display: 'grid', gap: '0.7rem' }}>
                <button
                  type="button"
                  onClick={() => void handleCreateLink()}
                  disabled={creating}
                  style={{ width: '100%', padding: '0.8rem 1rem', border: 'none', borderRadius: 10, background: '#0ea5e9', color: '#fff', fontSize: '1.05rem', fontWeight: 700, cursor: creating ? 'not-allowed' : 'pointer' }}
                >
                  {creating ? 'Creating...' : 'Create Session'}
                </button>
                <button
                  type="button"
                  onClick={() => { resetRun(); setGamePhase('playing') }}
                  style={{ width: '100%', padding: '0.8rem 1rem', border: '1px solid var(--mg-border)', borderRadius: 10, background: 'transparent', color: 'var(--mg-text)', fontSize: '1.05rem', fontWeight: 700, cursor: 'pointer' }}
                >
                  Play Solo Test
                </button>
                <button
                  type="button"
                  onClick={() => setSessionsRefreshKey((v) => v + 1)}
                  style={{ width: '100%', padding: '0.8rem 1rem', border: '1px solid var(--mg-border)', borderRadius: 10, background: 'transparent', color: 'var(--mg-muted)', fontSize: '1.05rem', fontWeight: 700, cursor: 'pointer' }}
                >
                  Load last session
                </button>
              </div>
              {createError && <div style={{ color: '#dc2626', marginTop: '0.7rem', fontSize: 13 }}>{createError}</div>}
              {createdLink && (
                <div style={{ marginTop: '0.7rem', fontSize: 13, lineHeight: 1.6 }}>
                  Room: <strong>{createdLink.roomCode || 'N/A'}</strong><br />
                  Join URL: <a href={createdLink.joinLink}>{createdLink.joinLink}</a>
                </div>
              )}
            </div>
          </div>
        </div>
      </MiniGameShell>
    )
  }

  if (gamePhase === 'done') {
    const totalValueCreated = results.reduce((sum, r) => sum + r.valueCreated, 0)
    const finalLeverage = debt / Math.max(1, debt + equityValue)
    const averageWacc = results.length ? results.reduce((sum, r) => sum + r.waccUsed, 0) / results.length : 0
    const shareholderReturn = (firmValue - START_CAPITAL) / START_CAPITAL
    const isPositive = totalValueCreated >= 0
    const accentColor = totalValueCreated >= 80_000 ? '#16a34a' : totalValueCreated >= 25_000 ? '#65a30d' : totalValueCreated >= 0 ? '#ca8a04' : '#dc2626'

    return (
      <MiniGameShell title="Capital Structure Lab" subtitle="Results" sessionsGameType="capital-structure-lab" publicMode={hasStudentContext}>
        <div style={{ maxWidth: 760, margin: '0 auto', padding: '34px 20px' }}>

          <div style={{ background: 'var(--mg-surface)', border: `2px solid ${accentColor}`, borderRadius: 14, padding: '20px 24px', marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: accentColor, marginBottom: 6 }}>
              {totalValueCreated >= 80_000 ? 'Capital Allocation Expert' : totalValueCreated >= 25_000 ? 'Strong Finance Operator' : totalValueCreated >= 0 ? 'Developing Intuition' : 'Value Destruction'}
            </div>
            <div style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--mg-text)' }}>
              {getNarrative(totalValueCreated, firmValue, finalLeverage, averageWacc, shareholderReturn)}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(120px, 1fr))', gap: 8, marginBottom: 14 }}>
            <div style={{ background: 'var(--mg-surface)', border: '1px solid var(--mg-border)', borderRadius: 8, padding: 10 }}>
              <div style={{ fontSize: 10, color: 'var(--mg-muted)' }}>Final Firm Value</div>
              <div style={{ fontSize: 15, fontWeight: 800 }}>{fmtMoney(firmValue)}</div>
            </div>
            <div style={{ background: 'var(--mg-surface)', border: '1px solid var(--mg-border)', borderRadius: 8, padding: 10 }}>
              <div style={{ fontSize: 10, color: 'var(--mg-muted)' }}>Shareholder Return</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: shareholderReturn >= 0 ? '#16a34a' : '#dc2626' }}>{fmtPct(shareholderReturn, 1)}</div>
            </div>
            <div style={{ background: 'var(--mg-surface)', border: '1px solid var(--mg-border)', borderRadius: 8, padding: 10 }}>
              <div style={{ fontSize: 10, color: 'var(--mg-muted)' }}>Final Debt Ratio</div>
              <div style={{ fontSize: 15, fontWeight: 800 }}>{fmtPct(finalLeverage, 1)}</div>
            </div>
            <div style={{ background: 'var(--mg-surface)', border: '1px solid var(--mg-border)', borderRadius: 8, padding: 10 }}>
              <div style={{ fontSize: 10, color: 'var(--mg-muted)' }}>Average WACC</div>
              <div style={{ fontSize: 15, fontWeight: 800 }}>{fmtPct(averageWacc)}</div>
            </div>
          </div>

          <div style={{ background: 'var(--mg-surface)', border: '1px solid var(--mg-border)', borderRadius: 10, padding: 14, marginBottom: 14 }}>
            {results.map((r, i) => (
              <div key={`${r.scenarioId}-${i}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '8px 0', borderBottom: i < results.length - 1 ? '1px solid var(--mg-border)' : 'none' }}>
                <div style={{ fontSize: 13 }}>
                  <strong>{r.scenarioTitle}</strong><br />
                  {r.projectName} | Realized {fmtPct(r.realizedReturn)} vs WACC {fmtPct(r.waccUsed)}
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: r.valueCreated >= 0 ? '#16a34a' : '#dc2626', whiteSpace: 'nowrap' }}>
                  {r.valueCreated >= 0 ? '+' : ''}{fmtMoney(r.valueCreated)}
                </div>
              </div>
            ))}
          </div>

          <div style={{ background: 'var(--mg-surface)', border: '1px solid var(--mg-border)', borderLeft: `4px solid ${isPositive ? '#16a34a' : '#dc2626'}`, borderRadius: 10, padding: 12, fontSize: 13, lineHeight: 1.6, marginBottom: 14 }}>
            <strong>Key lesson:</strong> Value is created when project return exceeds cost of capital. Debt can improve outcomes only while leverage remains sustainable.
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              onClick={() => { resetRun(); setGamePhase('playing') }}
              style={{ flex: 1, padding: '10px 12px', border: 'none', borderRadius: 8, background: 'var(--mg-accent)', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
            >
              Play Again
            </button>
            {!hasStudentContext && (
              <button
                type="button"
                onClick={() => setGamePhase('setup')}
                style={{ flex: 1, padding: '10px 12px', border: '1px solid var(--mg-border)', borderRadius: 8, background: 'transparent', color: 'var(--mg-text)', fontWeight: 600, cursor: 'pointer' }}
              >
                Back to Setup
              </button>
            )}
          </div>
        </div>
      </MiniGameShell>
    )
  }

  const latestResult = results[results.length - 1] || null

  return (
    <MiniGameShell title="Capital Structure Lab" subtitle="Intro Corporate Finance" sessionsGameType="capital-structure-lab" publicMode={hasStudentContext}>
      <div style={{ maxWidth: 1020, margin: '0 auto', padding: '24px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--mg-muted)' }}>Scenario {scenarioIndex + 1} of {SCENARIOS.length}</span>
          <span style={{ marginLeft: 'auto', fontSize: 14, fontWeight: 700, color: firmValue >= START_CAPITAL ? '#16a34a' : '#dc2626' }}>
            Firm Value: {fmtMoney(firmValue)}
          </span>
          {!hasStudentContext && (
            <button
              type="button"
              onClick={() => setGamePhase('setup')}
              style={{ padding: '4px 10px', background: 'transparent', border: '1px solid var(--mg-border)', borderRadius: 6, fontSize: 12, color: 'var(--mg-muted)', cursor: 'pointer' }}
            >
              Leave
            </button>
          )}
        </div>

        <div style={{ background: 'var(--mg-border)', borderRadius: 4, height: 4, marginBottom: 16, overflow: 'hidden' }}>
          <div style={{ width: `${(scenarioIndex / SCENARIOS.length) * 100}%`, background: 'var(--mg-accent)', height: '100%', transition: 'width 0.3s' }} />
        </div>

        <div style={{ background: 'var(--mg-surface)', border: '1px solid var(--mg-border)', borderRadius: 12, padding: '16px 18px', marginBottom: 18, display: 'grid', gridTemplateColumns: '1fr auto', gap: 16, alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>{scenario.title}</div>
            <div style={{ fontSize: 13, color: 'var(--mg-muted)', lineHeight: 1.6 }}>{scenario.description}</div>
            <div style={{ marginTop: 8, fontSize: 13, lineHeight: 1.6 }}>
              Choose one project and a financing option. Guided check: <strong>is expected return above current WACC?</strong>
            </div>
          </div>

          {!revealed ? (
            <button
              type="button"
              onClick={runDecision}
              style={{ minWidth: 160, padding: '11px 14px', border: 'none', borderRadius: 8, background: '#2563eb', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
            >
              Reveal Outcome
            </button>
          ) : (
            <button
              type="button"
              onClick={handleNext}
              style={{ minWidth: 160, padding: '11px 14px', border: 'none', borderRadius: 8, background: '#2563eb', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
            >
              {scenarioIndex + 1 < SCENARIOS.length ? 'Next Scenario' : 'See Results'}
            </button>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 16, alignItems: 'start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {!revealed && (
              <div style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.22)', borderRadius: 8, padding: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--mg-accent)', marginBottom: 8 }}>How to decide</div>
                <div style={{ fontSize: 12, color: 'var(--mg-text)', lineHeight: 1.6 }}>
                  1) Pick the project with the best return-to-risk fit.<br />
                  2) Choose a financing option — compare how each affects your next-round leverage and WACC.<br />
                  3) Reveal the outcome and see how your spread played out.
                </div>
              </div>
            )}

            {revealed && latestResult && (
              <div style={{ display: 'grid', gap: 10 }}>
                <div style={{ background: 'var(--mg-surface)', border: `2px solid ${latestResult.valueCreated >= 0 ? '#16a34a' : '#dc2626'}`, borderRadius: 10, padding: 12 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: latestResult.valueCreated >= 0 ? '#16a34a' : '#dc2626' }}>
                    {latestResult.valueCreated >= 0 ? 'Value Created' : 'Value Destroyed'}
                  </div>
                  <div style={{ fontSize: 13, marginTop: 4, color: 'var(--mg-muted)' }}>
                    {latestResult.projectName} | {latestResult.risk} risk
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 700, marginTop: 6, color: latestResult.valueCreated >= 0 ? '#16a34a' : '#dc2626' }}>
                    {latestResult.valueCreated >= 0 ? '+' : ''}{fmtMoney(latestResult.valueCreated)}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div style={{ background: 'var(--mg-surface)', border: '1px solid var(--mg-border)', borderRadius: 8, padding: 8 }}>
                    <div style={{ fontSize: 10, color: 'var(--mg-muted)' }}>Realized Return</div>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{fmtPct(latestResult.realizedReturn)}</div>
                  </div>
                  <div style={{ background: 'var(--mg-surface)', border: '1px solid var(--mg-border)', borderRadius: 8, padding: 8 }}>
                    <div style={{ fontSize: 10, color: 'var(--mg-muted)' }}>WACC Used</div>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{fmtPct(latestResult.waccUsed)}</div>
                  </div>
                  <div style={{ background: 'var(--mg-surface)', border: '1px solid var(--mg-border)', borderRadius: 8, padding: 8 }}>
                    <div style={{ fontSize: 10, color: 'var(--mg-muted)' }}>Debt Ratio After</div>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{fmtPct(latestResult.leverageAfter, 1)}</div>
                  </div>
                  <div style={{ background: 'var(--mg-surface)', border: '1px solid var(--mg-border)', borderRadius: 8, padding: 8 }}>
                    <div style={{ fontSize: 10, color: 'var(--mg-muted)' }}>Rating After</div>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{latestResult.ratingAfter}</div>
                  </div>
                </div>

                <div style={{ background: 'var(--mg-surface)', border: '1px solid var(--mg-border)', borderLeft: '4px solid var(--mg-accent)', borderRadius: 8, padding: 12, fontSize: 13, lineHeight: 1.6 }}>
                  {scenario.teaching}
                </div>
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gap: 10 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              {[
                { label: 'Cash', value: fmtMoney(cash) },
                { label: 'Debt Ratio', value: fmtPct(leverage, 1) },
                { label: 'Credit Rating', value: rating },
                { label: 'Current WACC', value: fmtPct(wacc) },
              ].map((item) => (
                <div key={item.label} style={{ background: 'var(--mg-surface)', border: '1px solid var(--mg-border)', borderRadius: 8, padding: 8, textAlign: 'center' }}>
                  <div style={{ fontSize: 10, color: 'var(--mg-muted)', textTransform: 'uppercase' }}>{item.label}</div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{item.value}</div>
                </div>
              ))}
            </div>

            {/* Step 1: Project Choice */}
            <div style={{ background: 'var(--mg-surface)', border: '1px solid var(--mg-border)', borderRadius: 10, padding: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--mg-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Step 1: Project Choice</div>
              <div style={{ display: 'grid', gap: 8 }}>
                {scenario.projects.map((p) => {
                  const active = selectedProjectId === p.id
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setSelectedProjectId(p.id)}
                      disabled={revealed}
                      style={{
                        textAlign: 'left',
                        padding: '9px 10px',
                        borderRadius: 8,
                        border: active ? '1px solid var(--mg-accent)' : '1px solid var(--mg-border)',
                        background: active ? 'rgba(59,130,246,0.08)' : 'transparent',
                        cursor: revealed ? 'default' : 'pointer',
                        opacity: revealed ? 0.8 : 1,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 13, fontWeight: 600 }}>
                        <span>{p.name}</span>
                        <span>{fmtMoney(p.investment)}</span>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--mg-muted)' }}>
                        Expected {fmtPct(p.expectedReturn, 1)} | {p.risk} risk
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Step 2: Financing Option */}
            <div style={{ background: 'var(--mg-surface)', border: '1px solid var(--mg-border)', borderRadius: 10, padding: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--mg-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Step 2: Financing Option</div>
              <div style={{ display: 'grid', gap: 8 }}>
                {FINANCING_OPTIONS.map((opt) => {
                  const active = financingOptionId === opt.id
                  const preview = computeOptionPreview(opt, selectedProject, debt, equityValue)
                  const internalNeeded = preview.internalFunding
                  const cashOk = internalNeeded <= cash
                  const ratingColor = preview.nextRating === 'A' ? '#16a34a' : preview.nextRating === 'BBB' ? '#65a30d' : preview.nextRating === 'BB' ? '#ca8a04' : '#dc2626'
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => { if (!revealed && cashOk) setFinancingOptionId(opt.id) }}
                      disabled={revealed || !cashOk}
                      style={{
                        textAlign: 'left',
                        padding: '10px 12px',
                        borderRadius: 8,
                        border: active ? '2px solid var(--mg-accent)' : '1px solid var(--mg-border)',
                        background: active ? 'rgba(59,130,246,0.08)' : !cashOk ? 'rgba(220,38,38,0.04)' : 'transparent',
                        cursor: revealed || !cashOk ? 'default' : 'pointer',
                        opacity: !cashOk ? 0.5 : 1,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <span style={{ fontSize: 13, fontWeight: 700 }}>{opt.label}</span>
                        {!cashOk && <span style={{ fontSize: 11, color: '#dc2626' }}>Insufficient cash</span>}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--mg-muted)', marginBottom: 6 }}>{opt.description}</div>
                      <div style={{ fontSize: 11, color: 'var(--mg-text)', lineHeight: 1.5 }}>
                        {fmtMoney(preview.debtFunding)} debt &nbsp;·&nbsp; {fmtMoney(preview.equityFunding)} equity &nbsp;·&nbsp; {fmtMoney(internalNeeded)} cash
                      </div>
                      <div style={{ display: 'flex', gap: 10, marginTop: 5, fontSize: 11 }}>
                        <span style={{ color: 'var(--mg-muted)' }}>Next WACC: <strong style={{ color: 'var(--mg-text)' }}>{fmtPct(preview.nextWacc)}</strong></span>
                        <span style={{ color: 'var(--mg-muted)' }}>Leverage: <strong style={{ color: preview.nextLeverage > 0.65 ? '#dc2626' : 'var(--mg-text)' }}>{fmtPct(preview.nextLeverage, 1)}</strong></span>
                        <span style={{ color: 'var(--mg-muted)' }}>Rating: <strong style={{ color: ratingColor }}>{preview.nextRating}</strong></span>
                      </div>
                    </button>
                  )
                })}
              </div>

              {error && <div style={{ color: '#dc2626', fontSize: 12, marginTop: 8 }}>{error}</div>}
            </div>
          </div>
        </div>
      </div>
    </MiniGameShell>
  )
}
