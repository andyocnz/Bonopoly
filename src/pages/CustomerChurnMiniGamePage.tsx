import { QRCodeSVG } from 'qrcode.react'
import { useEffect, useMemo, useState } from 'react'
import { MiniGameShell } from '../features/minigames/MiniGameShell'
import { getEducatorSessionCached } from '../features/minigames/educatorSession'
import { educatorMiniGamesApi } from '../features/minigames/api'

// Types

type Plan = 'Basic' | 'Pro' | 'Enterprise'

type Customer = {
  id: number
  name: string
  tenure: number         // months as customer
  monthlyUsage: number   // sessions/month
  tickets: number        // support tickets filed in last 90 days
  daysSinceLogin: number
  nps: number            // -100 to 100
  plan: Plan
  spend: number          // monthly $
  churned: boolean
}

type Intervention = 'call' | 'discount' | 'onboarding' | 'service_fix'

type TeamStrategy = {
  inactiveDays: number
  maxSessions: number
  minTickets: number
  maxNps: number
  intervention: Intervention
}

type CustomerProfile = {
  tenure:  [number, number]
  usage:   [number, number]
  tickets: [number, number]
  dsl:     [number, number]  // days since login
  plans:   Plan[]
}

type RoundConfig = {
  title: string
  context: string
  capacity: number
  churnSignal: string
  explanation: string
  numChurners: number
  numAmbig: number  // borderline cases that look risky but don't churn
  churner: CustomerProfile
  safe:    CustomerProfile
  ambig:   CustomerProfile
}

// PRNG

function seededRand(seed: number) {
  let s = seed >>> 0
  return () => { s = (Math.imul(1664525, s) + 1013904223) >>> 0; return s / 0x100000000 }
}

// Name + plan pools

const FIRST_NAMES = [
  'Alex', 'Bella', 'Carlo', 'Diana', 'Ethan', 'Fiona', 'Gabe', 'Hana',
  'Ivan', 'Jade', 'Kyle', 'Luna', 'Marco', 'Nina', 'Omar', 'Petra',
  'Quinn', 'Rosa', 'Sam', 'Tara', 'Uma', 'Vince', 'Wren', 'Xia',
  'Yuki', 'Zoe', 'Adam', 'Beth', 'Chen', 'Dani', 'Emil', 'Fran',
  'Greg', 'Hope', 'Iris', 'Joel', 'Kate', 'Liam', 'Mia', 'Noel',
]
const LAST_INITS = ['A.','B.','C.','D.','E.','F.','G.','H.','J.','K.',
                    'L.','M.','N.','O.','P.','R.','S.','T.','V.','W.']
const SPEND: Record<Plan, number> = { Basic: 29, Pro: 79, Enterprise: 299 }

// Round configs

const ROUND_CONFIGS: RoundConfig[] = [
  {
    title: 'Q1 - Starter Cohort',
    context: 'Your first churn review. Customers are mostly new. Look for the clearest warning signs.',
    capacity: 8, numChurners: 8, numAmbig: 4,
    churnSignal: 'Churners have ALL three signals bad together: low usage + many tickets + long inactive',
    explanation: 'Churners shared a clear pattern: low usage, multiple support tickets, and long inactivity - all three together. Several non-churners had one or two warning signs but not all three. The combination is what matters, not any single signal.',
    churner: { tenure: [1,5],   usage: [3,12],  tickets: [5,9], dsl: [38,68], plans: ['Basic','Basic','Basic','Pro'] },
    safe:    { tenure: [10,40], usage: [32,80], tickets: [0,1], dsl: [1,14],  plans: ['Pro','Pro','Enterprise'] },
    ambig:   { tenure: [5,10],  usage: [12,32], tickets: [3,6], dsl: [28,55], plans: ['Basic','Pro'] },
  },
  {
    title: 'Q2 - Mixed Cohort',
    context: 'Churn rate drops to 25%. Fewer churners to find - precision matters more now.',
    capacity: 6, numChurners: 5, numAmbig: 6,
    churnSignal: 'Capacity is tight - only flag customers with all signals clearly bad',
    explanation: 'With only 5 true churners and a team capacity of 6, several borderline cases had high inactive days or many tickets - but not both combined with low usage. Wasting slots on partial signals directly costs score. The combination of all three is the reliable rule.',
    churner: { tenure: [1,5],  usage: [4,12],  tickets: [5,8], dsl: [36,60], plans: ['Basic','Basic','Pro'] },
    safe:    { tenure: [8,30], usage: [30,75], tickets: [0,2], dsl: [2,16],  plans: ['Pro','Enterprise'] },
    ambig:   { tenure: [4,9],  usage: [10,30], tickets: [3,6], dsl: [24,52], plans: ['Basic','Pro'] },
  },
  {
    title: 'Q3 - Tenure Trap',
    context: 'Surprise: some long-tenured customers are churning. Tenure alone is not safety.',
    capacity: 8, numChurners: 6, numAmbig: 4,
    churnSignal: 'Long tenure can mask disengagement - watch usage and recency together',
    explanation: 'This quarter\'s churners are long-tenured customers who became disengaged - low usage, many support tickets, and long inactivity, all at once. New customers with high usage are perfectly safe even if inactive for a few weeks. Tenure is not a reliable safety signal.',
    churner: { tenure: [15,40], usage: [4,10],  tickets: [5,8], dsl: [48,70], plans: ['Pro','Pro','Enterprise'] },
    safe:    { tenure: [2,40],  usage: [32,80], tickets: [0,2], dsl: [1,14],  plans: ['Basic','Pro','Enterprise'] },
    ambig:   { tenure: [8,18],  usage: [14,32], tickets: [3,6], dsl: [26,58], plans: ['Basic','Pro'] },
  },
  {
    title: 'Q4 - Capacity Crunch',
    context: 'Team capacity cut to just 6 slots. Churn rate is back up at 40%. Prioritise ruthlessly.',
    capacity: 6, numChurners: 8, numAmbig: 3,
    churnSignal: 'With more churners than slots, prioritise by revenue: high-spend churners first',
    explanation: 'With only 6 team slots and 8 true churners, some had to be missed. High-value churners (Enterprise/Pro) represent the biggest revenue risk. When capacity is tight, targeting by spend x churn probability gives better ROI than flagging low-spend churners.',
    churner: { tenure: [2,6],   usage: [4,11],  tickets: [5,9], dsl: [38,58], plans: ['Basic','Pro','Pro','Enterprise'] },
    safe:    { tenure: [12,35], usage: [35,80], tickets: [0,2], dsl: [2,14],  plans: ['Pro','Enterprise'] },
    ambig:   { tenure: [5,12],  usage: [12,28], tickets: [3,6], dsl: [24,50], plans: ['Basic','Pro'] },
  },
  {
    title: 'Year-End - Class Imbalance',
    context: 'Only 4 of 21 customers will churn (19% rate). Noisy signals - hardest round.',
    capacity: 8, numChurners: 4, numAmbig: 10,
    churnSignal: 'When churn is rare, one bad signal is not enough - require all three bad together',
    explanation: 'With only 4 churners in 21, false positives dominate. Many customers had high inactive days or several tickets - but not all three signals bad simultaneously. The true churners had tickets >=5 and usage <=9 and 42+ days inactive. Class imbalance forces you to raise your combined threshold.',
    churner: { tenure: [2,6],  usage: [5,9],   tickets: [5,7], dsl: [42,60], plans: ['Basic','Pro'] },
    safe:    { tenure: [8,30], usage: [28,75], tickets: [0,2], dsl: [2,16],  plans: ['Pro','Enterprise'] },
    ambig:   { tenure: [5,12], usage: [10,28], tickets: [3,6], dsl: [22,55], plans: ['Basic','Pro'] },
  },
]

// Customer generator

function generateCustomers(seed: number, cfg: RoundConfig): Customer[] {
  const rng = seededRand(seed)
  const ri = (min: number, max: number) => Math.floor(rng() * (max - min + 1)) + min
  const pick = <T,>(arr: T[]): T => arr[Math.floor(rng() * arr.length)]

  const firstNames = [...FIRST_NAMES]
  for (let i = firstNames.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [firstNames[i], firstNames[j]] = [firstNames[j], firstNames[i]]
  }
  const lastInits = [...LAST_INITS]
  for (let i = lastInits.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [lastInits[i], lastInits[j]] = [lastInits[j], lastInits[i]]
  }

  let nameIdx = 0
  const makeCust = (profile: CustomerProfile, churned: boolean): Omit<Customer, 'id'> => {
    const plan = pick(profile.plans)
    const n = nameIdx++
    const tenure = ri(profile.tenure[0], profile.tenure[1])
    const maxDsl = Math.max(1, tenure * 30 - 1)  // can't be inactive longer than they've been a customer
    return {
      name: `${firstNames[n % firstNames.length]} ${lastInits[n % lastInits.length]}`,
      tenure,
      monthlyUsage: ri(profile.usage[0], profile.usage[1]),
      tickets: ri(profile.tickets[0], profile.tickets[1]),
      daysSinceLogin: Math.min(ri(profile.dsl[0], profile.dsl[1]), maxDsl),
      nps: Math.max(-100, Math.min(100, 55 - ri(profile.tickets[0], profile.tickets[1]) * 12 - Math.floor(ri(profile.dsl[0], profile.dsl[1]) / 4) + ri(-8, 12))),
      plan, spend: SPEND[plan], churned,
    }
  }

  const numSafe = 21 - cfg.numChurners - cfg.numAmbig
  const raw = [
    ...Array.from({ length: cfg.numChurners }, () => makeCust(cfg.churner, true)),
    ...Array.from({ length: cfg.numAmbig    }, () => makeCust(cfg.ambig,   false)),
    ...Array.from({ length: numSafe          }, () => makeCust(cfg.safe,    false)),
  ]

  for (let i = raw.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [raw[i], raw[j]] = [raw[j], raw[i]]
  }
  return raw.map((c, i) => ({ ...c, id: i + 1 }))
}

// Helpers

function usageBar(val: number, max = 80) {
  const pct = Math.min(100, (val / max) * 100)
  const color = pct >= 60 ? '#16a34a' : pct >= 30 ? '#ca8a04' : '#dc2626'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ flex: 1, background: 'var(--mg-border)', borderRadius: 3, height: 6, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, background: color, height: '100%' }} />
      </div>
      <span style={{ fontSize: 11, color: 'var(--mg-muted)', minWidth: 36 }}>{val} /mo</span>
    </div>
  )
}

function planBadge(plan: Plan) {
  const colors: Record<Plan, string> = { Basic: '#64748b', Pro: '#3b82f6', Enterprise: '#8b5cf6' }
  return (
    <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: colors[plan] + '20', border: `1px solid ${colors[plan]}40`, color: colors[plan], fontWeight: 600 }}>
      {plan}
    </span>
  )
}

// Main component

export default function CustomerChurnMiniGamePage() {
  const query = useMemo(() => new URLSearchParams(window.location.search), [])
  const GAME_SLUG = 'customer-churn'
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

  const [gameSeed, setGameSeed] = useState(() => Math.floor(Math.random() * 1e9))
  const [roundIndex, setRoundIndex] = useState(0)
  const [phase, setPhase] = useState<'playing' | 'reveal'>('playing')
  const [teamAStrategy, setTeamAStrategy] = useState<TeamStrategy>({
    inactiveDays: 35, maxSessions: 16, minTickets: 4, maxNps: 15, intervention: 'call',
  })
  const [teamANet, setTeamANet] = useState(0)
  const [teamBNet, setTeamBNet] = useState(0)
  const [teamASaved, setTeamASaved] = useState(0)
  const [teamBSaved, setTeamBSaved] = useState(0)
  const [totalTrueAtRisk, setTotalTrueAtRisk] = useState(0)
  const [teamATargeted, setTeamATargeted] = useState(0)
  const [teamBTargeted, setTeamBTargeted] = useState(0)
  const [roundResults, setRoundResults] = useState<{
    teamA: { net: number; tp: number; fp: number; fn: number; tn: number; saved: number; spend: number; roi: number; targeted: number; saveRate: number; precision: number; targetedIds: number[] }
    teamB: { net: number; tp: number; fp: number; fn: number; tn: number; saved: number; spend: number; roi: number; targeted: number; saveRate: number; precision: number; targetedIds: number[] }
  }[]>([])

  // Fixed order for easier teaching/review: Q1 -> Q2 -> Q3 -> Q4 -> Year-End
  const roundOrder = useMemo(() => ROUND_CONFIGS.map((_, i) => i), [])

  // Generate all round customers when game seed changes
  const allCustomers = useMemo(
    () => ROUND_CONFIGS.map((cfg, i) => generateCustomers(gameSeed + i * 999983, cfg)),
    [gameSeed]
  )

  const round = ROUND_CONFIGS[roundOrder[roundIndex]]
  const customers = allCustomers[roundOrder[roundIndex]]
  const marketShift = useMemo(() => 0.9 + (((roundIndex + 1) * 17) % 9) / 25, [roundIndex])

  const aiStrategy = useMemo<TeamStrategy>(() => {
    const candidateIntervention: Intervention =
      roundIndex <= 1 ? 'discount' :
      roundIndex === 2 ? 'service_fix' :
      roundIndex === 3 ? 'call' :
      'onboarding'
    return {
      inactiveDays: Math.max(18, round.churner.dsl[0] - 2),
      maxSessions: Math.min(42, round.churner.usage[1] + 3),
      minTickets: Math.max(2, round.churner.tickets[0]),
      maxNps: roundIndex >= 2 ? 18 : 24,
      intervention: candidateIntervention,
    }
  }, [round, roundIndex])

  useEffect(() => {
    if (hasStudentContext) return
    let cancelled = false
    getEducatorSessionCached(true).then(s => {
      if (!cancelled) { setCanAccessSetup(s.ok); setAuthChecked(true) }
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
          if (!inviteData.success || inviteData.invite?.gameType !== GAME_SLUG) {
            throw new Error('Invalid invite')
          }
          if (!roomCode) {
            roomCode = String(inviteData.invite?.roomCode || '').trim().toUpperCase()
          }
        }
        if (!roomCode) throw new Error('Missing room code')

        const roomResponse = await fetch(`/api/minigames/join/${encodeURIComponent(roomCode)}`, {
          headers: { 'Content-Type': 'application/json' },
        })
        if (!roomResponse.ok) throw new Error('Invalid room code')
        const roomData = await roomResponse.json() as {
          success?: boolean
          room?: { gameType?: string }
        }
        if (!roomData.success || roomData.room?.gameType !== GAME_SLUG) {
          throw new Error('Invalid room code')
        }
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
    if (hasStudentContext && gamePhase === 'setup') {
      setGamePhase('playing')
    }
  }, [hasStudentContext, gamePhase])

  async function handleCreateLink() {
    setCreating(true); setCreateError('')
    try {
      const res = await educatorMiniGamesApi.createSession({ gameType: 'customer-churn', teamCount: 1 })
      const roomCode = res.session.roomCode || ''
      const joinLink = roomCode
        ? `${window.location.origin}/mini-games/customer-churn?room=${encodeURIComponent(roomCode)}`
        : (res.session.joinByCodeLink || `${window.location.origin}/mini-games/join`)
      setCreatedLink({ roomCode: res.session.roomCode || '', joinLink })
      setSessionsRefreshKey(k => k + 1)
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : 'Failed to create link')
    } finally { setCreating(false) }
  }

  if (hasStudentContext && !studentAccessResolved) {
    return (
      <MiniGameShell title="Customer Churn" subtitle="Precision-Recall Tradeoff" publicMode>
        <div style={{ maxWidth: 760, margin: '0 auto', padding: '32px 20px' }}>
          <div style={{ background: 'var(--mg-surface)', border: '1px solid var(--mg-border)', borderRadius: 12, padding: 24 }}>
            Validating classroom access...
          </div>
        </div>
      </MiniGameShell>
    )
  }
  if (hasStudentContext && !studentAccessAllowed) return null

  function handleSubmit() {
    const interventionCostPerCustomer: Record<Intervention, number> = {
      call: 40,
      discount: 70,
      onboarding: 55,
      service_fix: 70,
    }

    const interventionBaseSaveRate: Record<Intervention, number> = {
      call: 0.32,
      discount: 0.44,
      onboarding: 0.28,
      service_fix: 0.38,
    }

    const evaluate = (strategy: TeamStrategy, seedOffset: number) => {
      const candidates = customers
        .map((c, i) => ({ c, i }))
        .filter(({ c }) =>
          c.daysSinceLogin >= strategy.inactiveDays &&
          c.monthlyUsage <= strategy.maxSessions &&
          c.tickets >= strategy.minTickets &&
          c.nps <= strategy.maxNps
        )

      const ranked = candidates
        .map(({ c, i }) => ({
          i,
          c,
          score:
            c.daysSinceLogin * 1.1 +
            Math.max(0, 38 - c.monthlyUsage) * 2.3 +
            c.tickets * 11 +
            Math.max(0, 25 - c.nps) * 0.8 +
            c.spend / 11,
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, round.capacity)

      const targetedIds = ranked.map(r => r.c.id)
      const targetedSet = new Set(ranked.map(r => r.i))
      let tp = 0, fp = 0, fn = 0, tn = 0
      let saved = 0
      let savedValue = 0
      const rng = seededRand(gameSeed + roundIndex * 997 + seedOffset)
      customers.forEach((c, i) => {
        const targeted = targetedSet.has(i)
        if (targeted && c.churned) {
          tp++
          const contextualBoost =
            (strategy.intervention === 'service_fix' ? (c.tickets >= 5 ? 0.08 : -0.03) : 0) +
            (strategy.intervention === 'onboarding' ? (c.tenure <= 6 ? 0.1 : -0.04) : 0) +
            (strategy.intervention === 'discount' ? (c.plan === 'Basic' ? 0.06 : -0.02) : 0) +
            (strategy.intervention === 'call' ? (c.plan !== 'Basic' ? 0.04 : -0.01) : 0)
          const saveProb = Math.max(0.05, Math.min(0.85, interventionBaseSaveRate[strategy.intervention] * marketShift + contextualBoost))
          if (rng() < saveProb) {
            saved++
            savedValue += c.spend * 6
          }
        }
        else if (targeted && !c.churned) fp++
        else if (!targeted && c.churned) fn++
        else tn++
      })
      const targeted = targetedSet.size
      const interventionCost = targeted * interventionCostPerCustomer[strategy.intervention]
      const falsePositiveCost = fp * 35
      const net = Math.round(savedValue - interventionCost - falsePositiveCost)
      const trueAtRisk = customers.filter(c => c.churned).length
      const saveRate = trueAtRisk > 0 ? saved / trueAtRisk : 0
      const precision = targeted > 0 ? saved / targeted : 0
      const roi = interventionCost > 0 ? net / interventionCost : 0
      return { net, tp, fp, fn, tn, saved, spend: interventionCost, roi, targeted, saveRate, precision, targetedIds }
    }

    const teamA = evaluate(teamAStrategy, 13)
    const teamB = evaluate(aiStrategy, 29)
    setTeamANet(s => s + teamA.net)
    setTeamBNet(s => s + teamB.net)
    setTeamASaved(s => s + teamA.saved)
    setTeamBSaved(s => s + teamB.saved)
    setTotalTrueAtRisk(s => s + customers.filter(c => c.churned).length)
    setTeamATargeted(s => s + teamA.targeted)
    setTeamBTargeted(s => s + teamB.targeted)
    setRoundResults(prev => [...prev, { teamA, teamB }])
    setPhase('reveal')
  }

  function handleNext() {
    if (roundIndex + 1 >= ROUND_CONFIGS.length) {
      setGamePhase('done')
    } else {
      setRoundIndex(i => i + 1)
      setPhase('playing')
    }
  }

  function handleRestart() {
    setRoundIndex(0)
    setPhase('playing')
    setTeamAStrategy({ inactiveDays: 35, maxSessions: 16, minTickets: 4, maxNps: 15, intervention: 'call' })
    setTeamANet(0)
    setTeamBNet(0)
    setTeamASaved(0)
    setTeamBSaved(0)
    setTotalTrueAtRisk(0)
    setTeamATargeted(0)
    setTeamBTargeted(0)
    setRoundResults([])
    setGameSeed(Math.floor(Math.random() * 1e9))  // new customers + new round order each replay
    setGamePhase('playing')
  }

  const lastResult = roundResults[roundResults.length - 1]

  // Setup screen
  if (gamePhase === 'setup') {
    return (
      <MiniGameShell title="Customer Churn" subtitle="Precision-Recall Tradeoff"
        sessionsGameType="customer-churn" showSessionsTable={authChecked && canAccessSetup}
        sessionsRefreshKey={sessionsRefreshKey} publicMode={false}>
        <div style={{ maxWidth: 760, margin: '0 auto', padding: '32px 20px' }}>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 32 }}>
            <div style={{ background: 'var(--mg-surface)', border: '1px solid var(--mg-border)', borderRadius: 12, padding: 24 }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>📉</div>
              <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, marginTop: 0, color: 'var(--mg-text)' }}>Customer Churn Analysis</h2>
              <p style={{ fontSize: 14, color: 'var(--mg-muted)', lineHeight: 1.6, marginBottom: 16, marginTop: 0 }}>
                Students act as data analysts flagging at-risk customers under a limited team capacity for outreach.
                The core lesson: <strong style={{ color: 'var(--mg-text)' }}>precision vs. recall</strong> - and why both matter.
              </p>
              <div style={{ fontSize: 13, color: 'var(--mg-muted)', lineHeight: 1.8 }}>
                <div><strong style={{ color: 'var(--mg-text)' }}>5 rounds</strong> with evolving churn patterns</div>
                <div><strong style={{ color: 'var(--mg-text)' }}>Flag</strong> at-risk customers within your team's capacity</div>
                <div><strong style={{ color: 'var(--mg-text)' }}>Random</strong> customers and round order each play-through</div>
                <div><strong style={{ color: 'var(--mg-text)' }}>Score</strong> based on revenue saved minus wasted spend</div>
              </div>
            </div>

            <div style={{ background: 'var(--mg-surface)', border: '1px solid var(--mg-border)', borderRadius: 12, padding: 24 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, marginTop: 0, color: 'var(--mg-text)' }}>Assign to Students</h3>
              <p style={{ fontSize: 13, color: 'var(--mg-muted)', marginBottom: 16, marginTop: 0, lineHeight: 1.5 }}>
                Create a shareable link to send students directly to this game.
              </p>
              <button onClick={() => void handleCreateLink()} disabled={creating}
                style={{ width: '100%', padding: '10px', background: 'var(--mg-accent)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: creating ? 'not-allowed' : 'pointer', marginBottom: 10, opacity: creating ? 0.7 : 1 }}>
                {creating ? 'Creating...' : '+ Create Student Link'}
              </button>
              <button onClick={() => setGamePhase('playing')}
                style={{ width: '100%', padding: '10px', background: 'transparent', color: 'var(--mg-muted)', border: '1px solid var(--mg-border)', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                Test Solo
              </button>
              {createError && <p style={{ color: '#dc2626', fontSize: 12, marginTop: 8 }}>{createError}</p>}
              {createdLink && (
                <div style={{ marginTop: 14, padding: 12, background: 'var(--mg-surface-2)', borderRadius: 8, border: '1px solid var(--mg-border)' }}>
                  <div style={{ fontSize: 12, color: 'var(--mg-muted)', marginBottom: 6 }}>Student link:</div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input readOnly value={createdLink.joinLink} style={{ flex: 1, fontSize: 11, padding: '6px 8px', borderRadius: 6, border: '1px solid var(--mg-border)', background: 'var(--mg-surface)', color: 'var(--mg-text)', minWidth: 0 }} />
                    <button onClick={() => navigator.clipboard.writeText(createdLink.joinLink)}
                      style={{ padding: '6px 10px', background: 'var(--mg-accent)', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                      Copy
                    </button>
                  </div>
                  <div style={{ marginTop: 12, display: 'flex', justifyContent: 'center', background: '#fff', borderRadius: 8, padding: 12 }}>
                    <QRCodeSVG value={createdLink.joinLink} size={200} bgColor="#ffffff" fgColor="#0f172a" level="M" />
                  </div>
                </div>
              )}
            </div>
          </div>

          <div style={{ background: 'var(--mg-surface)', border: '1px solid var(--mg-border)', borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--mg-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>Core Concept</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
              {[
                { term: 'Precision', formula: 'TP / (TP + FP)', desc: 'Of everyone you flagged as at-risk, how many actually churned? High precision = few wasted interventions.', color: '#3b82f6' },
                { term: 'Recall', formula: 'TP / (TP + FN)', desc: 'Of all customers who actually churned, how many did you catch? High recall = few missed churners.', color: '#f97316' },
                { term: 'F1 Score', formula: '2 x P x R / (P + R)', desc: 'Harmonic mean of precision and recall. Balances both - best when you cannot optimise one alone.', color: '#8b5cf6' },
              ].map(({ term, formula, desc, color }) => (
                <div key={term} style={{ padding: 14, background: 'var(--mg-surface-2)', borderRadius: 8, borderTop: `3px solid ${color}` }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--mg-text)', marginBottom: 2 }}>{term}</div>
                  <div style={{ fontSize: 12, color, fontFamily: 'monospace', marginBottom: 6 }}>{formula}</div>
                  <div style={{ fontSize: 12, color: 'var(--mg-muted)', lineHeight: 1.5 }}>{desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </MiniGameShell>
    )
  }

  // Done screen
  if (gamePhase === 'done') {
    const lead = teamANet - teamBNet
    const saveRateA = totalTrueAtRisk > 0 ? teamASaved / totalTrueAtRisk : 0
    const saveRateB = totalTrueAtRisk > 0 ? teamBSaved / totalTrueAtRisk : 0
    const precisionA = teamATargeted > 0 ? teamASaved / teamATargeted : 0
    const precisionB = teamBTargeted > 0 ? teamBSaved / teamBTargeted : 0
    const rankRows = [
      { team: 'You', net: teamANet, saveRate: saveRateA, precision: precisionA },
      { team: 'AI', net: teamBNet, saveRate: saveRateB, precision: precisionB },
    ].sort((a, b) => (b.net - a.net) || (b.saveRate - a.saveRate) || (b.precision - a.precision))
    const yourRank = rankRows.findIndex(r => r.team === 'You') + 1
    return (
      <MiniGameShell title="Customer Churn" subtitle="Precision-Recall Tradeoff" publicMode={hasStudentContext}>
        <div style={{ maxWidth: 600, margin: '0 auto', padding: '40px 20px' }}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{ background: 'var(--mg-surface)', border: '1px solid var(--mg-border)', borderRadius: 12, padding: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--mg-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                Final Ranking Summary
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: 'var(--mg-surface-2)' }}>
                    <th style={{ textAlign: 'left', padding: '8px 10px', color: 'var(--mg-muted)' }}>Rank</th>
                    <th style={{ textAlign: 'left', padding: '8px 10px', color: 'var(--mg-muted)' }}>Team</th>
                    <th style={{ textAlign: 'right', padding: '8px 10px', color: 'var(--mg-muted)' }}>Net Value</th>
                    <th style={{ textAlign: 'right', padding: '8px 10px', color: 'var(--mg-muted)' }}>Save Rate</th>
                    <th style={{ textAlign: 'right', padding: '8px 10px', color: 'var(--mg-muted)' }}>Precision</th>
                  </tr>
                </thead>
                <tbody>
                  {rankRows.map((r, idx) => (
                    <tr key={r.team} style={{ borderTop: '1px solid var(--mg-border)' }}>
                      <td style={{ padding: '8px 10px', fontWeight: 700, color: idx === 0 ? '#16a34a' : 'var(--mg-text)' }}>#{idx + 1}</td>
                      <td style={{ padding: '8px 10px', fontWeight: 700, color: 'var(--mg-text)' }}>{r.team}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: r.net >= 0 ? '#16a34a' : '#dc2626' }}>
                        {r.net >= 0 ? '+' : ''}${r.net.toLocaleString()}
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--mg-text)' }}>{(r.saveRate * 100).toFixed(1)}%</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--mg-text)' }}>{(r.precision * 100).toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ marginTop: 8, fontSize: 12, color: 'var(--mg-muted)', textAlign: 'left' }}>
                Your final rank: <strong style={{ color: yourRank === 1 ? '#16a34a' : '#dc2626' }}>#{yourRank}</strong>
                {' '}| Lead vs AI: <strong style={{ color: lead >= 0 ? '#16a34a' : '#dc2626' }}>{lead >= 0 ? '+' : ''}${lead.toLocaleString()}</strong>
              </div>
            </div>
          </div>

          <div style={{ background: 'var(--mg-surface)', border: '1px solid var(--mg-border)', borderRadius: 12, padding: 20, marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--mg-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>Round Results</div>
            {roundOrder.map((configIdx, i) => {
              const r = ROUND_CONFIGS[configIdx]
              const res = roundResults[i]
              if (!res) return null
              const precisionA = res.teamA.precision
              const precisionB = res.teamB.precision
              const saveRateA = res.teamA.saveRate
              const saveRateB = res.teamB.saveRate
              return (
                <div key={i} style={{ padding: '10px 0', borderBottom: i < roundResults.length - 1 ? '1px solid var(--mg-border)' : 'none' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--mg-text)' }}>{r.title}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: (res.teamA.net - res.teamB.net) >= 0 ? '#16a34a' : '#dc2626' }}>
                      {(res.teamA.net - res.teamB.net) >= 0 ? '+' : ''}${(res.teamA.net - res.teamB.net).toLocaleString()} lead
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--mg-muted)' }}>
                    You: ${res.teamA.net.toLocaleString()} (saved {res.teamA.saved}, spend ${res.teamA.spend.toLocaleString()}, save rate {(saveRateA * 100).toFixed(0)}%, precision {(precisionA * 100).toFixed(0)}%) &nbsp;|&nbsp;
                    AI: ${res.teamB.net.toLocaleString()} (saved {res.teamB.saved}, spend ${res.teamB.spend.toLocaleString()}, save rate {(saveRateB * 100).toFixed(0)}%, precision {(precisionB * 100).toFixed(0)}%)
                  </div>
                </div>
              )
            })}
          </div>

          <div style={{ background: 'var(--mg-surface)', border: '1px solid var(--mg-border)', borderLeft: '4px solid #8b5cf6', borderRadius: 12, padding: 16, marginBottom: 20, fontSize: 13, lineHeight: 1.7, color: 'var(--mg-muted)' }}>
            <strong style={{ color: 'var(--mg-text)' }}>Key rule: </strong>
            Best ranking is not raw saves. Score primary on Net Retained Value, secondary on Save Rate (saved / true at-risk), and tie-break on Precision (saved / targeted). Threshold quality and intervention choice both matter.
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={handleRestart} style={{ flex: 1, padding: '12px', background: 'var(--mg-accent)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Play Again</button>
            {!hasStudentContext && (
              <button onClick={() => setGamePhase('setup')} style={{ flex: 1, padding: '12px', background: 'transparent', border: '1px solid var(--mg-border)', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer', color: 'var(--mg-muted)' }}>Back to Setup</button>
            )}
          </div>
        </div>
      </MiniGameShell>
    )
  }

  // Playing screen
  const showAi = hasStudentContext
  return (
    <MiniGameShell title="Customer Churn" subtitle="Precision-Recall Tradeoff" publicMode={hasStudentContext}>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 16px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--mg-muted)' }}>Round {roundIndex + 1} of {ROUND_CONFIGS.length}</span>
          <span style={{ marginLeft: 'auto' }} />
          {!hasStudentContext && (
            <button onClick={() => setGamePhase('setup')}
              style={{ padding: '4px 10px', background: 'transparent', border: '1px solid var(--mg-border)', borderRadius: 6, fontSize: 12, color: 'var(--mg-muted)', cursor: 'pointer' }}>
              Back
            </button>
          )}
        </div>

        <div style={{ background: 'var(--mg-border)', borderRadius: 4, height: 4, marginBottom: 20, overflow: 'hidden' }}>
          <div style={{ width: `${(roundIndex / ROUND_CONFIGS.length) * 100}%`, background: '#8b5cf6', height: '100%', transition: 'width 0.4s' }} />
        </div>

        {/* Mission + context - full width top section */}
        <div style={{ background: 'var(--mg-surface)', border: '1px solid var(--mg-border)', borderRadius: 12, padding: '16px 20px', marginBottom: 16, display: 'grid', gridTemplateColumns: '1fr auto', gap: 20, alignItems: 'start' }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--mg-text)', marginBottom: 6 }}>{round.title}</div>
            <div style={{ fontSize: 13, color: 'var(--mg-muted)', lineHeight: 1.6, marginBottom: 10 }}>{round.context}</div>
            <div style={{ fontSize: 13, color: 'var(--mg-text)', lineHeight: 1.6 }}>
              Objective: create a churn rule that catches true at-risk customers without wasting outreach capacity.
            </div>
            <div style={{ fontSize: 12, color: '#a78bfa', marginTop: 8 }}>Signal: {round.churnSignal}</div>
            <div style={{ fontSize: 12, color: 'var(--mg-muted)', marginTop: 8, lineHeight: 1.6 }}>
              Step 1: set thresholds in <strong style={{ color: 'var(--mg-text)' }}>Your Rules</strong>.
              <br />
              Step 2: choose one intervention.
              <br />
              Step 3: click <strong style={{ color: 'var(--mg-text)' }}>Simulate Round</strong>, then compare You vs AI results.
            </div>
            <div style={{ fontSize: 12, color: 'var(--mg-muted)', marginTop: 8, lineHeight: 1.6 }}>
              NPS = <strong style={{ color: 'var(--mg-text)' }}>Net Promoter Score</strong> (from -100 to 100).
              Higher means more loyal customers, lower means unhappy customers with higher churn risk.
            </div>
          </div>
          {/* Scoring reference */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 180, background: 'var(--mg-surface-2)', border: '1px solid var(--mg-border)', borderRadius: 8, padding: '10px 14px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--mg-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Scoring</div>
            <div style={{ fontSize: 12, color: '#16a34a' }}><strong>+Saved value</strong> from prevented churn</div>
            <div style={{ fontSize: 12, color: '#f97316' }}><strong>-Intervention cost</strong> for targeted customers</div>
            <div style={{ fontSize: 12, color: '#dc2626' }}><strong>-$60 each</strong> unnecessary outreach (false alarm)</div>
          </div>
        </div>

        {/* Strategy controls */}
        {(() => {
          const youSaveRate = totalTrueAtRisk > 0 ? teamASaved / totalTrueAtRisk : 0
          const aiSaveRate = totalTrueAtRisk > 0 ? teamBSaved / totalTrueAtRisk : 0
          const youPrecision = teamATargeted > 0 ? teamASaved / teamATargeted : 0
          const aiPrecision = teamBTargeted > 0 ? teamBSaved / teamBTargeted : 0
          const rows = [
            { team: 'You', net: teamANet, saveRate: youSaveRate, precision: youPrecision, saved: teamASaved, targeted: teamATargeted },
            { team: 'AI', net: teamBNet, saveRate: aiSaveRate, precision: aiPrecision, saved: teamBSaved, targeted: teamBTargeted },
          ].sort((a, b) => (b.net - a.net) || (b.saveRate - a.saveRate) || (b.precision - a.precision))
          const rankOfYou = rows.findIndex(r => r.team === 'You') + 1
          return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, marginBottom: 14 }}>
            <div style={{ background: 'var(--mg-surface)', border: '1px solid #2563eb44', borderRadius: 8, padding: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#2563eb', marginBottom: 8 }}>Your Rules</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <label style={{ fontSize: 11, color: 'var(--mg-muted)' }}>
                  Inactive Days &gt;=
                  <input type="number" min={0} max={120} value={teamAStrategy.inactiveDays}
                    disabled={phase !== 'playing'}
                    onChange={(e) => setTeamAStrategy(prev => ({ ...prev, inactiveDays: Number(e.target.value) }))}
                    style={{ width: '100%', marginTop: 3, padding: '6px', borderRadius: 6, border: '1px solid var(--mg-border)', background: 'var(--mg-surface-2)', color: 'var(--mg-text)' }} />
                </label>
                <label style={{ fontSize: 11, color: 'var(--mg-muted)' }}>
                  Sessions &lt;=
                  <input type="number" min={0} max={80} value={teamAStrategy.maxSessions}
                    disabled={phase !== 'playing'}
                    onChange={(e) => setTeamAStrategy(prev => ({ ...prev, maxSessions: Number(e.target.value) }))}
                    style={{ width: '100%', marginTop: 3, padding: '6px', borderRadius: 6, border: '1px solid var(--mg-border)', background: 'var(--mg-surface-2)', color: 'var(--mg-text)' }} />
                </label>
                <label style={{ fontSize: 11, color: 'var(--mg-muted)' }}>
                  Tickets &gt;=
                  <input type="number" min={0} max={12} value={teamAStrategy.minTickets}
                    disabled={phase !== 'playing'}
                    onChange={(e) => setTeamAStrategy(prev => ({ ...prev, minTickets: Number(e.target.value) }))}
                    style={{ width: '100%', marginTop: 3, padding: '6px', borderRadius: 6, border: '1px solid var(--mg-border)', background: 'var(--mg-surface-2)', color: 'var(--mg-text)' }} />
                </label>
                <label style={{ fontSize: 11, color: 'var(--mg-muted)' }}>
                  NPS &lt;=
                  <input type="number" min={-100} max={100} value={teamAStrategy.maxNps}
                    disabled={phase !== 'playing'}
                    onChange={(e) => setTeamAStrategy(prev => ({ ...prev, maxNps: Number(e.target.value) }))}
                    style={{ width: '100%', marginTop: 3, padding: '6px', borderRadius: 6, border: '1px solid var(--mg-border)', background: 'var(--mg-surface-2)', color: 'var(--mg-text)' }} />
                </label>
              </div>
              <label style={{ display: 'block', marginTop: 8, fontSize: 11, color: 'var(--mg-muted)' }}>
                Intervention
                <select value={teamAStrategy.intervention}
                  disabled={phase !== 'playing'}
                  onChange={(e) => setTeamAStrategy(prev => ({ ...prev, intervention: e.target.value as Intervention }))}
                  style={{ width: '100%', marginTop: 3, padding: '6px', borderRadius: 6, border: '1px solid var(--mg-border)', background: 'var(--mg-surface-2)', color: 'var(--mg-text)' }}>
                  <option value="call">Call campaign</option>
                  <option value="discount">Discount offer</option>
                  <option value="onboarding">Onboarding support</option>
                  <option value="service_fix">Service fix queue</option>
                </select>
              </label>
              {phase === 'playing' ? (
                <button
                  onClick={handleSubmit}
                  style={{ width: '100%', marginTop: 10, padding: '11px', background: '#8b5cf6', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
                >
                  Simulate Round -&gt;
                </button>
              ) : (
                <button
                  onClick={handleNext}
                  style={{ width: '100%', marginTop: 10, padding: '11px', background: '#8b5cf6', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
                >
                  {roundIndex + 1 < ROUND_CONFIGS.length ? 'Next Round ->' : 'See Results ->'}
                </button>
              )}
            </div>
            <div style={{ minWidth: 220, background: 'var(--mg-surface)', border: '1px solid #dc262644', borderRadius: 8, padding: 12 }}>
              <div style={{ background: 'var(--mg-surface-2)', border: '1px solid var(--mg-border)', borderRadius: 8, padding: '8px 10px', marginBottom: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--mg-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Ranking</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: rankOfYou === 1 ? '#16a34a' : '#dc2626' }}>
                  {rankOfYou === 1 ? 'Rank #1' : 'Rank #2'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--mg-muted)', marginTop: 3 }}>
                  Sorted by Net Value, then Save Rate, then Precision
                </div>
              </div>
              <div style={{ border: '1px solid var(--mg-border)', borderRadius: 8, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                  <thead>
                    <tr style={{ background: 'var(--mg-surface-2)' }}>
                      <th style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--mg-muted)' }}>#</th>
                      <th style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--mg-muted)' }}>Team</th>
                      <th style={{ textAlign: 'right', padding: '6px 8px', color: 'var(--mg-muted)' }}>Net</th>
                      <th style={{ textAlign: 'right', padding: '6px 8px', color: 'var(--mg-muted)' }}>Save%</th>
                      <th style={{ textAlign: 'right', padding: '6px 8px', color: 'var(--mg-muted)' }}>Prec%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, idx) => (
                      <tr key={r.team} style={{ borderTop: '1px solid var(--mg-border)' }}>
                        <td style={{ padding: '6px 8px', color: 'var(--mg-text)', fontWeight: 700 }}>{idx + 1}</td>
                        <td style={{ padding: '6px 8px', color: 'var(--mg-text)', fontWeight: 700 }}>{r.team}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'right', color: r.net >= 0 ? '#16a34a' : '#dc2626', fontWeight: 700 }}>
                          {r.net >= 0 ? '+' : ''}${r.net.toLocaleString()}
                        </td>
                        <td style={{ padding: '6px 8px', textAlign: 'right', color: 'var(--mg-text)' }}>{(r.saveRate * 100).toFixed(0)}%</td>
                        <td style={{ padding: '6px 8px', textAlign: 'right', color: 'var(--mg-text)' }}>{(r.precision * 100).toFixed(0)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ fontSize: 11, color: 'var(--mg-muted)', marginTop: 8, lineHeight: 1.5 }}>
                You control thresholds and intervention. AI is auto-simulated each round.
              </div>
            </div>
        </div>
          )
        })()}

        {/* Reveal summary under next-round action and above customer matrix */}
        {phase === 'reveal' && lastResult && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
              {[
                { label: 'You TP / FP', value: `${lastResult.teamA.tp} / ${lastResult.teamA.fp}`, color: '#3b82f6' },
                { label: 'You Saved', value: `${lastResult.teamA.saved}`, color: '#2563eb' },
                { label: 'You Spend', value: `$${lastResult.teamA.spend.toLocaleString()}`, color: '#0ea5e9' },
                { label: 'You ROI', value: `${(lastResult.teamA.roi * 100).toFixed(0)}%`, color: '#22c55e' },
                { label: 'You Net', value: `${lastResult.teamA.net >= 0 ? '+' : ''}$${lastResult.teamA.net.toLocaleString()}`, color: lastResult.teamA.net >= 0 ? '#16a34a' : '#dc2626' },
                { label: 'You Save Rate', value: `${(lastResult.teamA.saveRate * 100).toFixed(0)}%`, color: '#3b82f6' },
                ...(showAi ? [
                  { label: 'AI TP / FP', value: `${lastResult.teamB.tp} / ${lastResult.teamB.fp}`, color: '#f97316' },
                  { label: 'AI Saved', value: `${lastResult.teamB.saved}`, color: '#ea580c' },
                  { label: 'AI Spend', value: `$${lastResult.teamB.spend.toLocaleString()}`, color: '#fb7185' },
                  { label: 'AI ROI', value: `${(lastResult.teamB.roi * 100).toFixed(0)}%`, color: '#84cc16' },
                  { label: 'AI Net', value: `${lastResult.teamB.net >= 0 ? '+' : ''}$${lastResult.teamB.net.toLocaleString()}`, color: lastResult.teamB.net >= 0 ? '#16a34a' : '#dc2626' },
                  { label: 'AI Save Rate', value: `${(lastResult.teamB.saveRate * 100).toFixed(0)}%`, color: '#f97316' },
                  { label: 'Round Lead', value: `${(lastResult.teamA.net - lastResult.teamB.net) >= 0 ? '+' : ''}$${(lastResult.teamA.net - lastResult.teamB.net).toLocaleString()}`, color: (lastResult.teamA.net - lastResult.teamB.net) >= 0 ? '#16a34a' : '#dc2626' },
                ] : []),
              ].map(({ label, value, color }) => (
                <div key={label} style={{ flex: '1 1 90px', background: 'var(--mg-surface)', border: '1px solid var(--mg-border)', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
                  <div style={{ fontSize: 10, color: 'var(--mg-muted)', marginBottom: 2, textTransform: 'uppercase' }}>{label}</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color }}>{value}</div>
                </div>
              ))}
            </div>
            <div style={{ background: 'var(--mg-surface)', border: '1px solid var(--mg-border)', borderLeft: '4px solid #8b5cf6', borderRadius: 10, padding: 14, marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#a78bfa', marginBottom: 6 }}>What happened - {round.title}</div>
              <div style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--mg-text)' }}>{round.explanation}</div>
            </div>
            <div style={{ background: 'var(--mg-surface)', border: '1px solid var(--mg-border)', borderRadius: 10, padding: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--mg-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Why Money Rank Changed</div>
              <div style={{ fontSize: 12, lineHeight: 1.7, color: 'var(--mg-text)' }}>
                You used <strong>{teamAStrategy.intervention.replace('_', ' ')}</strong>: saved value
                {' '}<strong>${(lastResult.teamA.net + lastResult.teamA.spend + lastResult.teamA.fp * 60).toLocaleString()}</strong>
                {' '}minus intervention cost <strong>${lastResult.teamA.spend.toLocaleString()}</strong>
                {' '}minus false-alarm cost <strong>${(lastResult.teamA.fp * 60).toLocaleString()}</strong>
                {' '}= net <strong style={{ color: lastResult.teamA.net >= 0 ? '#16a34a' : '#dc2626' }}>{lastResult.teamA.net >= 0 ? '+' : ''}${lastResult.teamA.net.toLocaleString()}</strong>.
                {showAi && (
                  <>
                    <br />
                    AI used <strong>{aiStrategy.intervention.replace('_', ' ')}</strong> and scored
                    {' '}<strong style={{ color: lastResult.teamB.net >= 0 ? '#16a34a' : '#dc2626' }}>{lastResult.teamB.net >= 0 ? '+' : ''}${lastResult.teamB.net.toLocaleString()}</strong>.
                  </>
                )}
              </div>
            </div>
            <div style={{ background: 'var(--mg-surface)', border: '1px solid var(--mg-border)', borderLeft: '4px solid #2563eb', borderRadius: 10, padding: 14, marginTop: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                Round Learning Insight
              </div>
              <div style={{ fontSize: 12, lineHeight: 1.7, color: 'var(--mg-text)' }}>
                {(() => {
                  const campaign = teamAStrategy.intervention.replace('_', ' ')
                  const savedValue = lastResult.teamA.net + lastResult.teamA.spend + lastResult.teamA.fp * 60
                  const valuePerTarget = lastResult.teamA.targeted > 0 ? savedValue / lastResult.teamA.targeted : 0
                  const signal =
                    teamAStrategy.intervention === 'service_fix' ? 'works best when ticket volume is high' :
                    teamAStrategy.intervention === 'onboarding' ? 'works best for newer customers' :
                    teamAStrategy.intervention === 'call' ? 'works better on higher-value accounts' :
                    'can lift saves quickly but is expensive'
                  if (lastResult.teamA.saved === 0) {
                    return <>Your <strong>{campaign}</strong> campaign saved no churners this round. Try tightening thresholds to raise precision before spending intervention budget.</>
                  }
                  if (lastResult.teamA.fp > lastResult.teamA.saved) {
                    return <>Your <strong>{campaign}</strong> campaign had more false alarms than saves. The campaign type can work, but your targeting was too broad for this cohort.</>
                  }
                  return <>Your <strong>{campaign}</strong> campaign generated about <strong>${Math.round(valuePerTarget).toLocaleString()}</strong> value per targeted customer and {signal}. Keep this match in similar rounds.</>
                })()}
              </div>
            </div>
          </div>
        )}

        {/* Customer grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 24 }}>
          {customers.map((c) => (
            (() => {
              const isReveal = phase === 'reveal' && Boolean(lastResult)
              const youTargeted = isReveal ? lastResult!.teamA.targetedIds.includes(c.id) : false
              const aiTargeted = isReveal ? lastResult!.teamB.targetedIds.includes(c.id) : false
              const isTp = isReveal && youTargeted && c.churned
              const isFp = isReveal && youTargeted && !c.churned
              const isFn = isReveal && !youTargeted && c.churned
              const cardBg = isTp ? 'rgba(22,163,74,0.08)' : isFp ? 'rgba(249,115,22,0.08)' : isFn ? 'rgba(220,38,38,0.06)' : 'var(--mg-surface)'
              const cardBorder = isTp ? '#16a34a' : isFp ? '#f97316' : isFn ? '#dc2626' : 'var(--mg-border)'
              return (
            <div
              key={c.id}
              style={{
                background: cardBg,
                border: `1.5px solid ${cardBorder}`,
                borderRadius: 10,
                padding: '12px',
                transition: 'border-color 0.2s, background 0.2s',
                userSelect: 'none',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--mg-text)' }}>{c.name}</span>
                  <span style={{ fontSize: 11, color: 'var(--mg-muted)', marginLeft: 6 }}>#{c.id}</span>
                </div>
                {planBadge(c.plan)}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 8px', fontSize: 11, marginBottom: 8 }}>
                <div>
                  <span style={{ color: 'var(--mg-muted)' }}>Tenure </span>
                  <span style={{ fontWeight: 600, color: 'var(--mg-text)' }}>{c.tenure} mo</span>
                </div>
                <div>
                  <span style={{ color: 'var(--mg-muted)' }}>Spend </span>
                  <span style={{ fontWeight: 600, color: 'var(--mg-text)' }}>${c.spend}/mo</span>
                </div>
                <div>
                  <span style={{ color: 'var(--mg-muted)' }}>Support tickets </span>
                  <span style={{ fontWeight: 600, color: c.tickets >= 5 ? '#dc2626' : c.tickets >= 3 ? '#ca8a04' : '#16a34a' }}>{c.tickets}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--mg-muted)' }}>Inactive </span>
                  <span style={{ fontWeight: 600, color: 'var(--mg-text)' }}>{c.daysSinceLogin}d</span>
                </div>
                <div>
                  <span style={{ color: 'var(--mg-muted)' }}>NPS </span>
                  <span style={{ fontWeight: 600, color: c.nps <= 0 ? '#dc2626' : c.nps <= 30 ? '#ca8a04' : '#16a34a' }}>{c.nps}</span>
                </div>
              </div>

              <div style={{ marginBottom: 2, fontSize: 10, color: 'var(--mg-muted)' }}>Avg sessions / month</div>
              {usageBar(c.monthlyUsage)}

              <div style={{ marginTop: 8, fontSize: 11, fontWeight: 700, textAlign: 'center', color: phase === 'reveal' ? (isTp ? '#16a34a' : isFp ? '#f97316' : isFn ? '#dc2626' : 'var(--mg-muted)') : 'var(--mg-muted)' }}>
                {phase === 'reveal'
                  ? (isTp
                    ? 'Your rule identified this at-risk customer (TP)'
                    : isFp
                      ? 'Your rule flagged this but customer retained (FP)'
                      : isFn
                        ? 'Your rule missed this churner (FN)'
                        : 'Your rule left this customer unflagged')
                  : 'Use data to set your thresholds'}
              </div>
              {phase === 'reveal' && showAi && (
                <div style={{ marginTop: 4, fontSize: 10, textAlign: 'center', color: 'var(--mg-muted)' }}>
                  AI action: {aiTargeted ? 'Targeted' : 'Not targeted'}
                </div>
              )}
              </div>
              )
            })()
          ))}
        </div>
      </div>
    </MiniGameShell>
  )
}
