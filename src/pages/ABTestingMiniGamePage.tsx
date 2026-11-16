import { QRCodeSVG } from 'qrcode.react'
import React, { useEffect, useMemo, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine, ResponsiveContainer } from 'recharts'
import { MiniGameShell } from '../features/minigames/MiniGameShell'
import { getEducatorSessionCached } from '../features/minigames/educatorSession'
import { educatorMiniGamesApi } from '../features/minigames/api'

// ─── Types ────────────────────────────────────────────────────────────────────

type Decision = 'b_wins' | 'a_wins' | 'no_diff'

type ScenarioConfig = {
  id: number; title: string; description: string; seed: number
  trueA: number; trueB: number; visitorsPerDay: number; totalDays: number
  winValue: number; penaltyValue: number; correctDecision: Decision
  optimalDay: number; teaching: string
}

type DaySnapshot = {
  day: number; cumVisA: number; cumConvA: number; cumVisB: number; cumConvB: number
  rateA: number; rateB: number; confidence: number
}

// ─── PRNG + Stats ─────────────────────────────────────────────────────────────

function seededRand(seed: number) {
  let s = seed >>> 0
  return () => { s = (Math.imul(1664525, s) + 1013904223) >>> 0; return s / 0x100000000 }
}

function computeConfidence(cA: number, vA: number, cB: number, vB: number): number {
  if (vA < 20 || vB < 20) return 0
  const pA = cA / vA, pB = cB / vB, pp = (cA + cB) / (vA + vB)
  const se = Math.sqrt(pp * (1 - pp) * (1 / vA + 1 / vB))
  if (se === 0) return 0
  const z = Math.abs(pB - pA) / se
  const t = 1 / (1 + 0.2316419 * z)
  const poly = t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))))
  return Math.min(99, Math.max(0, Math.round((1 - poly) * 100)))
}

function generateData(cfg: ScenarioConfig): DaySnapshot[] {
  const rng = seededRand(cfg.seed)
  let cA = 0, vA = 0, cB = 0, vB = 0
  return Array.from({ length: cfg.totalDays }, (_, d) => {
    for (let i = 0; i < cfg.visitorsPerDay; i++) { if (rng() < cfg.trueA) cA++; vA++ }
    for (let i = 0; i < cfg.visitorsPerDay; i++) { if (rng() < cfg.trueB) cB++; vB++ }
    return { day: d + 1, cumVisA: vA, cumConvA: cA, cumVisB: vB, cumConvB: cB, rateA: cA / vA, rateB: cB / vB, confidence: computeConfidence(cA, vA, cB, vB) }
  })
}

// ─── Scenarios ────────────────────────────────────────────────────────────────

const SCENARIOS: ScenarioConfig[] = [
  { id: 1, title: 'New Checkout Button', description: 'Blue "Buy Now" vs orange "Checkout". Does colour affect conversions?', seed: 42, trueA: 0.04, trueB: 0.065, visitorsPerDay: 500, totalDays: 40, winValue: 12000, penaltyValue: 6000, correctDecision: 'b_wins', optimalDay: 18, teaching: 'Treatment B was genuinely better (+62.5% lift). With 500 visitors/day, significance appeared around day 18. Stopping early risks a false positive; waiting longer only burns budget.' },
  { id: 2, title: 'Homepage Hero Image', description: 'Product photo vs lifestyle photo. Early data looked great for B — but is it real?', seed: 77, trueA: 0.035, trueB: 0.037, visitorsPerDay: 300, totalDays: 50, winValue: 8000, penaltyValue: 5000, correctDecision: 'no_diff', optimalDay: 35, teaching: 'The true difference was only 0.2pp — not meaningful. Early noise made B look better. "No difference" was the right call — don\'t waste engineering effort on marginal changes.' },
  { id: 3, title: 'Aggressive Discount Pop-up', description: 'No pop-up vs a discount pop-up after 10 seconds. Watch conversion rates carefully.', seed: 99, trueA: 0.05, trueB: 0.031, visitorsPerDay: 400, totalDays: 40, winValue: 9000, penaltyValue: 7000, correctDecision: 'a_wins', optimalDay: 14, teaching: 'The pop-up hurt conversions (−38%). You must watch for B being worse, not just better. Stopping the harmful treatment quickly saves real revenue.' },
  { id: 4, title: 'Simplified Pricing Page', description: 'Three tiers vs one recommended tier. Does simplification improve sign-ups?', seed: 123, trueA: 0.028, trueB: 0.044, visitorsPerDay: 200, totalDays: 50, winValue: 15000, penaltyValue: 8000, correctDecision: 'b_wins', optimalDay: 28, teaching: 'With only 200 visitors/day, it took until day 28 to reach confidence. Calling it at day 10 would have been a false positive. High value ($15k) justifies waiting.' },
  { id: 5, title: 'Email Subject Line Emoji', description: 'Emoji vs plain text. High traffic, tiny true difference — classic peeking problem.', seed: 256, trueA: 0.22, trueB: 0.223, visitorsPerDay: 1000, totalDays: 30, winValue: 5000, penaltyValue: 4000, correctDecision: 'no_diff', optimalDay: 25, teaching: 'With 1,000 visitors/day, early noise looks significant. This is the peeking problem — checking at day 3-5 causes false positives. True rates were essentially identical.' },
]

// ─── Brand colors — used in chart, stat tiles, and decision buttons ───────────

const COLOR_A = '#3b82f6'  // blue  — Version A
const COLOR_B = '#f97316'  // orange — Version B

// ─── Scenario visual previews ─────────────────────────────────────────────────

function ScenarioPreview({ id }: { id: number }) {
  const wrap: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, margin: '12px 0 4px' }
  const box: React.CSSProperties = { background: 'var(--mg-surface-2)', border: '1px solid var(--mg-border)', borderRadius: 8, padding: '10px 12px', textAlign: 'center' }
  const tag = (c: string): React.CSSProperties => ({ fontSize: 10, fontWeight: 700, color: c, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 })

  if (id === 1) return (
    <div style={wrap}>
      <div style={box}>
        <div style={tag(COLOR_A)}>Version A</div>
        <button style={{ width: '100%', padding: '8px 0', background: COLOR_A, color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'default' }}>Buy Now</button>
      </div>
      <div style={box}>
        <div style={tag(COLOR_B)}>Version B</div>
        <button style={{ width: '100%', padding: '8px 0', background: COLOR_B, color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'default' }}>Checkout</button>
      </div>
    </div>
  )

  if (id === 2) return (
    <div style={wrap}>
      <div style={box}>
        <div style={tag(COLOR_A)}>Version A</div>
        <div style={{ height: 52, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${COLOR_A}15`, borderRadius: 6, fontSize: 26 }}>📦</div>
        <div style={{ fontSize: 11, color: 'var(--mg-muted)', marginTop: 5 }}>Product photo</div>
      </div>
      <div style={box}>
        <div style={tag(COLOR_B)}>Version B</div>
        <div style={{ height: 52, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${COLOR_B}15`, borderRadius: 6, fontSize: 26 }}>🏡</div>
        <div style={{ fontSize: 11, color: 'var(--mg-muted)', marginTop: 5 }}>Lifestyle photo</div>
      </div>
    </div>
  )

  if (id === 3) return (
    <div style={wrap}>
      <div style={box}>
        <div style={tag(COLOR_A)}>Version A</div>
        <div style={{ height: 52, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${COLOR_A}10`, borderRadius: 6, fontSize: 12, color: 'var(--mg-muted)' }}>No pop-up</div>
      </div>
      <div style={box}>
        <div style={tag(COLOR_B)}>Version B</div>
        <div style={{ height: 52, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${COLOR_B}10`, borderRadius: 6 }}>
          <div style={{ background: 'var(--mg-surface)', border: '1px solid var(--mg-border)', borderRadius: 4, padding: '4px 10px', fontSize: 11, fontWeight: 600, color: 'var(--mg-text)', boxShadow: '0 2px 8px rgba(0,0,0,0.18)' }}>🎁 Get 20% OFF</div>
        </div>
      </div>
    </div>
  )

  if (id === 4) return (
    <div style={wrap}>
      <div style={box}>
        <div style={tag(COLOR_A)}>Version A</div>
        <div style={{ display: 'flex', gap: 3 }}>
          {['Basic', 'Pro', 'Ent.'].map(t => (
            <div key={t} style={{ flex: 1, padding: '6px 2px', background: 'var(--mg-surface)', border: '1px solid var(--mg-border)', borderRadius: 4, fontSize: 10, color: 'var(--mg-muted)' }}>{t}</div>
          ))}
        </div>
        <div style={{ fontSize: 11, color: 'var(--mg-muted)', marginTop: 5 }}>3 pricing tiers</div>
      </div>
      <div style={box}>
        <div style={tag(COLOR_B)}>Version B</div>
        <div style={{ padding: '7px 8px', background: `${COLOR_B}18`, border: `1px solid ${COLOR_B}55`, borderRadius: 6, fontSize: 12, fontWeight: 700, color: COLOR_B }}>⭐ Pro — Recommended</div>
        <div style={{ fontSize: 11, color: 'var(--mg-muted)', marginTop: 5 }}>1 clear choice</div>
      </div>
    </div>
  )

  if (id === 5) return (
    <div style={wrap}>
      <div style={{ ...box, textAlign: 'left' }}>
        <div style={tag(COLOR_A)}>Version A</div>
        <div style={{ background: 'var(--mg-surface)', border: '1px solid var(--mg-border)', borderRadius: 6, padding: '6px 10px' }}>
          <div style={{ fontSize: 10, color: 'var(--mg-muted)', marginBottom: 2 }}>Subject:</div>
          <div style={{ fontSize: 12, color: 'var(--mg-text)', fontWeight: 500 }}>New products this week</div>
        </div>
      </div>
      <div style={{ ...box, textAlign: 'left' }}>
        <div style={tag(COLOR_B)}>Version B</div>
        <div style={{ background: 'var(--mg-surface)', border: `1px solid ${COLOR_B}44`, borderRadius: 6, padding: '6px 10px' }}>
          <div style={{ fontSize: 10, color: 'var(--mg-muted)', marginBottom: 2 }}>Subject:</div>
          <div style={{ fontSize: 12, color: 'var(--mg-text)', fontWeight: 500 }}>🎉 New products this week</div>
        </div>
      </div>
    </div>
  )

  return null
}

// ─── Recharts Line Chart ──────────────────────────────────────────────────────

function ABLineChart({ snapshots, currentDay, optimalDay, revealed }: { snapshots: DaySnapshot[]; currentDay: number; optimalDay: number; revealed: boolean }) {
  if (currentDay === 0) return (
    <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--mg-muted)', fontSize: 14 }}>
      Click "Next Day" to start collecting data
    </div>
  )
  const data = snapshots.slice(0, currentDay).map(s => ({
    day: s.day,
    'Version A': parseFloat((s.rateA * 100).toFixed(2)),
    'Version B': parseFloat((s.rateB * 100).toFixed(2)),
  }))
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--mg-border)" />
        <XAxis dataKey="day" tick={{ fontSize: 12, fill: 'var(--mg-muted)' }} label={{ value: 'Day', position: 'insideBottomRight', offset: -4, fontSize: 11, fill: 'var(--mg-muted)' }} />
        <YAxis tickFormatter={v => v + '%'} tick={{ fontSize: 12, fill: 'var(--mg-muted)' }} width={44} />
        <Tooltip formatter={(v: number) => v.toFixed(2) + '%'} labelFormatter={l => `Day ${l}`} contentStyle={{ background: 'var(--mg-surface)', border: '1px solid var(--mg-border)', borderRadius: 8, fontSize: 13 }} />
        <Legend wrapperStyle={{ fontSize: 13, paddingTop: 6 }} />
        {revealed && <ReferenceLine x={optimalDay} stroke="#ca8a04" strokeDasharray="4 3" label={{ value: `Optimal ~day ${optimalDay}`, position: 'top', fontSize: 11, fill: '#ca8a04' }} />}
        <Line type="monotone" dataKey="Version A" stroke={COLOR_A} strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
        <Line type="monotone" dataKey="Version B" stroke={COLOR_B} strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
      </LineChart>
    </ResponsiveContainer>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ABTestingMiniGamePage() {
  const query = useMemo(() => new URLSearchParams(window.location.search), [])
  const GAME_SLUG = 'ab-testing'
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
  const [currentDay, setCurrentDay] = useState(0)
  const [decision, setDecision] = useState<Decision | null>(null)
  const [totalScore, setTotalScore] = useState(0)
  const [results, setResults] = useState<{ decision: Decision; net: number; correct: boolean }[]>([])

  const cfg = SCENARIOS[scenarioIndex]
  const allData = useMemo(() => SCENARIOS.map(generateData), [])
  const snapshots = allData[scenarioIndex]
  const current = currentDay > 0 ? snapshots[currentDay - 1] : null
  const costSoFar = currentDay * 200
  const revealed = decision !== null
  const canAdvanceDay = !revealed && currentDay < cfg.totalDays

  useEffect(() => {
    if (hasStudentContext) return
    let cancelled = false
    getEducatorSessionCached(true).then(s => { if (!cancelled) { setCanAccessSetup(s.ok); setAuthChecked(true) } })
    return () => { cancelled = true }
  }, [hasStudentContext])

  useEffect(() => {
    if (!hasStudentContext && authChecked && !canAccessSetup) window.location.href = '/educator-login'
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
      const res = await educatorMiniGamesApi.createSession({ gameType: 'ab-testing', teamCount: 1 })
      const roomCode = res.session.roomCode || ''
      const joinLink = roomCode
        ? `${window.location.origin}/mini-games/ab-testing?room=${encodeURIComponent(roomCode)}`
        : (res.session.joinByCodeLink || `${window.location.origin}/mini-games/join`)
      setCreatedLink({ roomCode: res.session.roomCode || '', joinLink })
      setSessionsRefreshKey(k => k + 1)
    } catch (e) { setCreateError(e instanceof Error ? e.message : 'Failed') } finally { setCreating(false) }
  }

  if (hasStudentContext && !studentAccessResolved) {
    return (
      <MiniGameShell title="A/B Testing" subtitle="Statistical Decision-Making" publicMode>
        <div style={{ maxWidth: 760, margin: '0 auto', padding: '32px 20px' }}>
          <div style={{ background: 'var(--mg-surface)', border: '1px solid var(--mg-border)', borderRadius: 12, padding: 24 }}>
            Validating classroom access...
          </div>
        </div>
      </MiniGameShell>
    )
  }
  if (hasStudentContext && !studentAccessAllowed) return null

  function handleDecision(d: Decision) {
    if (revealed) return
    setDecision(d)
    const correct = d === cfg.correctDecision
    const net = correct ? cfg.winValue - costSoFar : -(cfg.penaltyValue + costSoFar)
    setTotalScore(s => s + Math.max(-20000, net))
    setResults(prev => [...prev, { decision: d, net: Math.max(-20000, net), correct }])
  }

  function handleNext() {
    if (scenarioIndex + 1 >= SCENARIOS.length) { setGamePhase('done') }
    else { setScenarioIndex(i => i + 1); setCurrentDay(0); setDecision(null) }
  }

  function handleRestart() { setScenarioIndex(0); setCurrentDay(0); setDecision(null); setTotalScore(0); setResults([]) }

  const dlLabel: Record<Decision, string> = { b_wins: '🚀 Ship B', a_wins: '⚠️ Keep A (B hurts)', no_diff: '⚖️ No Difference' }
  const confColor = (c: number) => c >= 80 ? '#16a34a' : c >= 50 ? '#ca8a04' : '#dc2626'

  // ── Setup ──
  if (gamePhase === 'setup') {
    return (
      <MiniGameShell title="A/B Testing" subtitle="Statistical Decision-Making"
        sessionsGameType="ab-testing" showSessionsTable={authChecked && canAccessSetup}
        sessionsRefreshKey={sessionsRefreshKey} publicMode={false}>
        <div style={{ maxWidth: 760, margin: '0 auto', padding: '32px 20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 32 }}>
            <div style={{ background: 'var(--mg-surface)', border: '1px solid var(--mg-border)', borderRadius: 12, padding: 24 }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>🧪</div>
              <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, marginTop: 0, color: 'var(--mg-text)' }}>A/B Testing</h2>
              <p style={{ fontSize: 14, color: 'var(--mg-muted)', lineHeight: 1.6, marginBottom: 16, marginTop: 0 }}>
                Students play product manager — deciding when they have enough data to confidently call a winner.
                The core lesson: <strong style={{ color: 'var(--mg-text)' }}>early patterns are often noise</strong>, and wrong decisions have real economic cost.
              </p>
              <div style={{ fontSize: 13, color: 'var(--mg-muted)', lineHeight: 1.9 }}>
                <div>📈 <strong style={{ color: 'var(--mg-text)' }}>5 scenarios</strong> — genuine winners, noise, and harmful treatments</div>
                <div>📅 <strong style={{ color: 'var(--mg-text)' }}>Day by day</strong> — costs $200/day to keep running</div>
                <div>💰 <strong style={{ color: 'var(--mg-text)' }}>Economic scoring</strong> — right call earns value, wrong call loses penalty</div>
                <div>⚠️ <strong style={{ color: 'var(--mg-text)' }}>Peeking problem</strong> — demonstrates why early stopping inflates false positives</div>
              </div>
            </div>
            <div style={{ background: 'var(--mg-surface)', border: '1px solid var(--mg-border)', borderRadius: 12, padding: 24 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, marginTop: 0, color: 'var(--mg-text)' }}>Assign to Students</h3>
              <p style={{ fontSize: 13, color: 'var(--mg-muted)', marginBottom: 16, marginTop: 0, lineHeight: 1.5 }}>Create a shareable link to send students directly to this simulation.</p>
              <button onClick={() => void handleCreateLink()} disabled={creating}
                style={{ width: '100%', padding: '10px', background: 'var(--mg-accent)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: creating ? 'not-allowed' : 'pointer', marginBottom: 10, opacity: creating ? 0.7 : 1 }}>
                {creating ? 'Creating…' : '+ Create Student Link'}
              </button>
              <button onClick={() => setGamePhase('playing')}
                style={{ width: '100%', padding: '10px', background: 'transparent', color: 'var(--mg-muted)', border: '1px solid var(--mg-border)', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                ▶ Test Solo
              </button>
              {createError && <p style={{ color: '#dc2626', fontSize: 12, marginTop: 8 }}>{createError}</p>}
              {createdLink && (
                <div style={{ marginTop: 14, padding: 12, background: 'var(--mg-surface-2)', borderRadius: 8, border: '1px solid var(--mg-border)' }}>
                  <div style={{ fontSize: 12, color: 'var(--mg-muted)', marginBottom: 6 }}>Student link:</div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input readOnly value={createdLink.joinLink} style={{ flex: 1, fontSize: 11, padding: '6px 8px', borderRadius: 6, border: '1px solid var(--mg-border)', background: 'var(--mg-surface)', color: 'var(--mg-text)', minWidth: 0 }} />
                    <button onClick={() => navigator.clipboard.writeText(createdLink.joinLink)}
                      style={{ padding: '6px 10px', background: 'var(--mg-accent)', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}>Copy</button>
                  </div>
                  <div style={{ marginTop: 12, display: 'flex', justifyContent: 'center', background: '#fff', borderRadius: 8, padding: 12 }}>
                    <QRCodeSVG value={createdLink.joinLink} size={200} bgColor="#ffffff" fgColor="#0f172a" level="M" />
                  </div>
                </div>
              )}
            </div>
          </div>
          <div style={{ background: 'var(--mg-surface)', border: '1px solid var(--mg-border)', borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--mg-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>How Decisions Are Scored</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
              {[
                { label: 'Correct call', value: '+$winValue', desc: 'minus days × $200', color: '#16a34a' },
                { label: 'Wrong call', value: '−$penalty', desc: 'plus days × $200', color: '#dc2626' },
                { label: 'Each extra day', value: '−$200', desc: 'server cost', color: '#ca8a04' },
                { label: 'Optimal day', value: 'Revealed', desc: 'after decision', color: '#3b82f6' },
              ].map(({ label, value, desc, color }) => (
                <div key={label} style={{ padding: 12, background: 'var(--mg-surface-2)', borderRadius: 8, borderTop: `3px solid ${color}` }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--mg-text)', marginBottom: 2 }}>{label}</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color }}>{value}</div>
                  <div style={{ fontSize: 11, color: 'var(--mg-muted)' }}>{desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </MiniGameShell>
    )
  }

  // ── Done ──
  if (gamePhase === 'done') {
    const maxPossible = SCENARIOS.reduce((s, c) => s + c.winValue, 0)
    const grade = totalScore >= 40000 ? 'A' : totalScore >= 20000 ? 'B' : totalScore >= 0 ? 'C' : 'D'
    const gradeColor = grade === 'A' ? '#16a34a' : grade === 'B' ? '#65a30d' : grade === 'C' ? '#ca8a04' : '#dc2626'
    return (
      <MiniGameShell title="A/B Testing" subtitle="Statistical Decision-Making" publicMode={hasStudentContext}>
        <div style={{ maxWidth: 560, margin: '0 auto', padding: '40px 20px' }}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{ fontSize: 72, fontWeight: 900, color: gradeColor, lineHeight: 1 }}>{grade}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: gradeColor, marginTop: 4 }}>{grade === 'A' ? 'Data-Driven Expert' : grade === 'B' ? 'Strong Analyst' : grade === 'C' ? 'Getting There' : 'Keep Practising'}</div>
            <div style={{ fontSize: 15, color: 'var(--mg-muted)', marginTop: 4 }}>Net: ${totalScore.toLocaleString()} (max possible: ${maxPossible.toLocaleString()})</div>
          </div>
          <div style={{ background: 'var(--mg-surface)', border: '1px solid var(--mg-border)', borderRadius: 12, padding: 20, marginBottom: 20 }}>
            {SCENARIOS.map((s, i) => {
              const r = results[i]; if (!r) return null
              return (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: i < results.length - 1 ? '1px solid var(--mg-border)' : 'none' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--mg-text)' }}>{s.title}</div>
                    <div style={{ fontSize: 12, color: 'var(--mg-muted)' }}>{r.correct ? '✓ Correct' : '✗ Wrong'} — called {dlLabel[r.decision]}</div>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: r.net >= 0 ? '#16a34a' : '#dc2626' }}>{r.net >= 0 ? '+' : ''}${r.net.toLocaleString()}</div>
                </div>
              )
            })}
          </div>
          <div style={{ background: 'var(--mg-surface)', border: '1px solid var(--mg-border)', borderLeft: '4px solid var(--mg-accent)', borderRadius: 12, padding: 16, marginBottom: 20, fontSize: 14, lineHeight: 1.7, color: 'var(--mg-muted)' }}>
            <strong style={{ color: 'var(--mg-text)' }}>Key lesson: </strong>
            Statistical significance ≠ practical significance. The peeking problem inflates false positives. Pre-commit to a minimum runtime and use confidence + lift together.
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => { handleRestart(); setGamePhase('playing') }} style={{ flex: 1, padding: '12px', background: 'var(--mg-accent)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Play Again</button>
            {!hasStudentContext && (
              <button onClick={() => setGamePhase('setup')} style={{ flex: 1, padding: '12px', background: 'transparent', border: '1px solid var(--mg-border)', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer', color: 'var(--mg-muted)' }}>Back to Setup</button>
            )}
          </div>
        </div>
      </MiniGameShell>
    )
  }

  return (
    <MiniGameShell title="A/B Testing" subtitle="Statistical Decision-Making" publicMode={hasStudentContext}>
      <div style={{ maxWidth: 1040, margin: '0 auto', padding: '24px 20px' }}>
        {/* Header bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--mg-muted)' }}>Scenario {scenarioIndex + 1} of {SCENARIOS.length}</span>
          <span style={{ marginLeft: 'auto', fontSize: 14, fontWeight: 700, color: totalScore >= 0 ? '#16a34a' : '#dc2626' }}>${totalScore.toLocaleString()}</span>
          {!hasStudentContext && (
            <button onClick={() => setGamePhase('setup')}
              style={{ padding: '4px 10px', background: 'transparent', border: '1px solid var(--mg-border)', borderRadius: 6, fontSize: 12, color: 'var(--mg-muted)', cursor: 'pointer' }}>
              ← Leave
            </button>
          )}
        </div>
        <div style={{ background: 'var(--mg-border)', borderRadius: 4, height: 4, marginBottom: 20, overflow: 'hidden' }}>
          <div style={{ width: `${(scenarioIndex / SCENARIOS.length) * 100}%`, background: 'var(--mg-accent)', height: '100%', transition: 'width 0.4s' }} />
        </div>

        {/* ── TOP: full-width scenario card (story + 2 advance buttons) ── */}
        <div style={{ background: 'var(--mg-surface)', border: '1px solid var(--mg-border)', borderRadius: 12, padding: '18px 20px', marginBottom: 20, display: 'grid', gridTemplateColumns: '1fr auto', gap: 20, alignItems: 'center' }}>
          {/* Story summary */}
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 20, alignItems: 'start' }}>
            <div style={{ minWidth: 200 }}>
              <ScenarioPreview id={cfg.id} />
            </div>
            <div>
              <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--mg-text)', marginBottom: 4 }}>{cfg.title}</div>
              <div style={{ fontSize: 13, color: 'var(--mg-muted)', lineHeight: 1.6, marginBottom: 8 }}>{cfg.description}</div>
              <div style={{ fontSize: 13, color: 'var(--mg-text)', lineHeight: 1.6 }}>
                You are the <strong>Product Manager</strong> — half your users see <strong style={{ color: COLOR_A }}>Version A</strong> (live), half see <strong style={{ color: COLOR_B }}>Version B</strong> (new design). Every day costs <strong>$200</strong>. Decide when you have enough data.
              </div>
            </div>
          </div>

          {/* The 2 advance buttons */}
          {!revealed ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 148 }}>
              <button
                onClick={() => setCurrentDay(d => Math.min(d + 1, cfg.totalDays))}
                disabled={!canAdvanceDay}
                style={{ padding: '12px 16px', background: canAdvanceDay ? '#2563eb' : 'var(--mg-border)', color: canAdvanceDay ? '#fff' : 'var(--mg-muted)', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 700, cursor: canAdvanceDay ? 'pointer' : 'not-allowed', whiteSpace: 'nowrap' }}>
                ▶ {currentDay === 0 ? 'Start Day 1' : 'Next Day'} <span style={{ fontSize: 12, fontWeight: 500, opacity: 0.95 }}>−$200</span>
              </button>
              <button
                onClick={() => setCurrentDay(d => Math.min(d + 5, cfg.totalDays))}
                disabled={!canAdvanceDay}
                style={{ padding: '12px 16px', background: 'transparent', border: `1px solid ${canAdvanceDay ? '#2563eb' : 'var(--mg-border)'}`, borderRadius: 8, fontSize: 13, fontWeight: 700, color: canAdvanceDay ? '#1d4ed8' : 'var(--mg-muted)', cursor: canAdvanceDay ? 'pointer' : 'not-allowed', whiteSpace: 'nowrap' }}>
                ⏩ +5 Days <span style={{ fontSize: 10, fontWeight: 400 }}>−$1,000</span>
              </button>
            </div>
          ) : (
            <button onClick={handleNext} style={{ minWidth: 148, padding: '12px 16px', background: '#2563eb', color: '#ffffff', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              {scenarioIndex + 1 < SCENARIOS.length ? 'Next Scenario →' : 'See Results →'}
            </button>
          )}
        </div>

        {/* ── BELOW: two-column layout ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 20, alignItems: 'start' }}>

          {/* ── Left column: hints / post-decision outcome ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* How to decide */}
            {!revealed && (
              <div style={{ background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 8, padding: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--mg-accent)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>💡 How to decide</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[
                    { n: '1', label: "Don't trust early gaps", hint: "After just a few days, big leads are usually random noise — not a real signal. Early patterns almost always even out." },
                    { n: '2', label: 'Watch the confidence bar', hint: 'The confidence bar shows statistical reliability. Once it reaches ≥80%, the result is reliable enough to act on.' },
                    { n: '3', label: 'Weigh cost vs risk', hint: 'Waiting longer costs $200/day but reduces the chance of a wrong call. A wrong call costs far more than a few extra days.' },
                  ].map(({ n, label, hint }) => (
                    <div key={n} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                      <div style={{ minWidth: 20, height: 20, borderRadius: '50%', background: 'var(--mg-accent)', color: '#fff', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>{n}</div>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--mg-text)', marginBottom: 2 }}>{label}</div>
                        <div style={{ fontSize: 12, color: 'var(--mg-muted)', lineHeight: 1.5 }}>{hint}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Post-decision: outcome + ground truth + teaching */}
            {revealed && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ background: 'var(--mg-surface)', border: `2px solid ${results[results.length - 1]?.correct ? '#16a34a' : '#dc2626'}`, borderRadius: 10, padding: 14 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: results[results.length - 1]?.correct ? '#16a34a' : '#dc2626', marginBottom: 4 }}>
                    {results[results.length - 1]?.correct ? '✓ Correct call!' : '✗ Wrong call'}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--mg-muted)', marginBottom: 6 }}>
                    You called: <strong style={{ color: 'var(--mg-text)' }}>{dlLabel[decision!]}</strong><br />
                    Answer was: <strong style={{ color: 'var(--mg-text)' }}>{dlLabel[cfg.correctDecision]}</strong>
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: (results[results.length - 1]?.net ?? 0) >= 0 ? '#16a34a' : '#dc2626' }}>
                    Net: {(results[results.length - 1]?.net ?? 0) >= 0 ? '+' : ''}${(results[results.length - 1]?.net ?? 0).toLocaleString()}
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {[
                    { label: 'True A Rate', value: (cfg.trueA * 100).toFixed(1) + '%', color: COLOR_A },
                    { label: 'True B Rate', value: (cfg.trueB * 100).toFixed(1) + '%', color: COLOR_B },
                    { label: 'True Lift', value: ((cfg.trueB / cfg.trueA - 1) * 100).toFixed(1) + '%', color: 'var(--mg-text)' },
                    { label: 'Optimal Day', value: `~day ${cfg.optimalDay}`, color: '#ca8a04' },
                  ].map(({ label, value, color }) => (
                    <div key={label} style={{ background: 'var(--mg-surface)', border: '1px solid var(--mg-border)', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
                      <div style={{ fontSize: 10, color: 'var(--mg-muted)', marginBottom: 2, textTransform: 'uppercase' }}>{label}</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color }}>{value}</div>
                    </div>
                  ))}
                </div>
                <div style={{ background: 'var(--mg-surface)', border: '1px solid var(--mg-border)', borderLeft: '4px solid var(--mg-accent)', borderRadius: 8, padding: 14 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--mg-accent)', marginBottom: 6 }}>💡 What happened</div>
                  <div style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--mg-text)' }}>{cfg.teaching}</div>
                </div>
              </div>
            )}
          </div>

          {/* ── Right column: live data ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* Live meta tiles */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
              {[
                { label: 'Day', value: `${currentDay} / ${cfg.totalDays}` },
                { label: 'Cost so far', value: `$${costSoFar.toLocaleString()}` },
                { label: 'Win earns', value: `+$${cfg.winValue.toLocaleString()}` },
                { label: 'Wrong call', value: `−$${cfg.penaltyValue.toLocaleString()}` },
              ].map(({ label, value }) => (
                <div key={label} style={{ background: 'var(--mg-surface)', border: '1px solid var(--mg-border)', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
                  <div style={{ fontSize: 10, color: 'var(--mg-muted)', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--mg-text)' }}>{value}</div>
                </div>
              ))}
            </div>

            {/* Chart */}
            <div style={{ background: 'var(--mg-surface)', border: '1px solid var(--mg-border)', borderRadius: 12, padding: '14px 12px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--mg-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Conversion Rate Over Time</div>
              <ABLineChart snapshots={snapshots} currentDay={currentDay} optimalDay={cfg.optimalDay} revealed={revealed} />
            </div>

            {/* Stats tiles */}
            {current && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                <div style={{ background: 'var(--mg-surface)', border: `1px solid ${COLOR_A}44`, borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: COLOR_A, marginBottom: 3, textTransform: 'uppercase', fontWeight: 700 }}>Version A (live)</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: COLOR_A }}>{(current.rateA * 100).toFixed(2)}%</div>
                  <div style={{ fontSize: 11, color: 'var(--mg-muted)' }}>{current.cumConvA} / {current.cumVisA} visitors</div>
                </div>
                <div style={{ background: 'var(--mg-surface)', border: `1px solid ${COLOR_B}44`, borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: COLOR_B, marginBottom: 3, textTransform: 'uppercase', fontWeight: 700 }}>Version B (new)</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: COLOR_B }}>{(current.rateB * 100).toFixed(2)}%</div>
                  <div style={{ fontSize: 11, color: 'var(--mg-muted)' }}>{current.cumConvB} / {current.cumVisB} visitors</div>
                </div>
                <div style={{ background: 'var(--mg-surface)', border: `1px solid ${current.rateB > current.rateA ? 'rgba(22,163,74,0.3)' : 'rgba(220,38,38,0.3)'}`, borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: 'var(--mg-muted)', marginBottom: 3, textTransform: 'uppercase', fontWeight: 700 }}>B vs A</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: current.rateB > current.rateA ? '#16a34a' : '#dc2626' }}>
                    {current.rateB > current.rateA ? '+' : ''}{((current.rateB - current.rateA) * 100).toFixed(2)}pp
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--mg-muted)' }}>{current.rateB > current.rateA ? 'B looks better' : current.rateB < current.rateA ? 'A looks better' : 'Equal so far'}</div>
                </div>
              </div>
            )}

            {/* Confidence meter */}
            {current && (
              <div style={{ background: 'var(--mg-surface)', border: '1px solid var(--mg-border)', borderRadius: 10, padding: '12px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 8, fontWeight: 600 }}>
                  <span style={{ color: 'var(--mg-text)' }}>Statistical Confidence</span>
                  <span style={{ color: confColor(current.confidence), fontWeight: 700 }}>{current.confidence}%</span>
                </div>
                <div style={{ background: 'var(--mg-border)', borderRadius: 6, height: 12, overflow: 'hidden' }}>
                  <div style={{ width: `${current.confidence}%`, background: confColor(current.confidence), height: '100%', borderRadius: 6, transition: 'width 0.3s' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--mg-muted)', marginTop: 6 }}>
                  <span>Noisy / unreliable</span><span>≥80% = safe to call</span><span>Very confident</span>
                </div>
              </div>
            )}

            {/* Decision buttons */}
            {!revealed && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--mg-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6, textAlign: 'center' }}>
                  {currentDay < 5 ? 'Collect more data before calling…' : 'Ready to call the result?'}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, opacity: currentDay < 5 ? 0.4 : 1, pointerEvents: currentDay < 5 ? 'none' : 'auto' }}>
                  <button onClick={() => handleDecision('b_wins')} style={{ padding: '10px 6px', background: `${COLOR_B}18`, color: COLOR_B, border: `1px solid ${COLOR_B}55`, borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>🚀 Ship B</button>
                  <button onClick={() => handleDecision('no_diff')} style={{ padding: '10px 6px', background: 'rgba(202,138,4,0.1)', color: '#ca8a04', border: '1px solid rgba(202,138,4,0.35)', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>⚖️ No Difference</button>
                  <button onClick={() => handleDecision('a_wins')} style={{ padding: '10px 6px', background: `${COLOR_A}18`, color: COLOR_A, border: `1px solid ${COLOR_A}55`, borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>⚠️ Keep A (B hurts)</button>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </MiniGameShell>
  )
}
