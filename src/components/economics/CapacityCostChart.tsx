import { useMemo } from 'react'
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceArea, Customized,
  usePlotArea, useXAxisDomain, useYAxisDomain,
} from 'recharts'
import type { TeamRow } from '../../utils/normalizeTeamRow'

interface CapacityCostChartProps {
  currentTeamData: TeamRow | null
  allRoundsData: Array<{ roundNumber: number; teams: TeamRow[] }>
  regionLabels: { us: string; asia: string; europe: string }
}

type CostCurvePoint = {
  round?: number
  utilPct: number
  multiplier: number
  actualUtil?: number
  isTheory?: boolean
}

type ScatterShapeProps = {
  cx?: number
  cy?: number
  payload?: CostCurvePoint
}

/* ── Config matching gameEngine.ts cost curve formula ── */
const OPTIMAL_UTIL = 0.80
const CURVATURE = 4.0
const costMultiplier = (util: number) => 1 + CURVATURE * Math.pow(util - OPTIMAL_UTIL, 2)

/* ── Annotation layer: zone labels rendered on the chart SVG ── */
function CostCurveAnnotations({ optimalMinPx, optimalMaxPx }: { optimalMinPx: number; optimalMaxPx: number }) {
  void optimalMinPx
  void optimalMaxPx
  const plotArea = usePlotArea()
  const xDomain = useXAxisDomain(0) as [number, number] | undefined
  const yDomain = useYAxisDomain(0) as [number, number] | undefined

  if (!plotArea || !xDomain || !yDomain) return null

  const sx = (v: number) =>
    plotArea.x + ((v - xDomain[0]) / (xDomain[1] - xDomain[0])) * plotArea.width
  const sy = (v: number) =>
    plotArea.y + plotArea.height - ((v - yDomain[0]) / (yDomain[1] - yDomain[0])) * plotArea.height

  return (
    <g className="cost-curve-annotations">
      {/* Underutilization label */}
      <text
        x={sx(35)}
        y={sy(costMultiplier(0.35)) - 14}
        textAnchor="middle"
        fontSize={11}
        fontWeight={600}
        fill="#dc2626"
        opacity={0.7}
      >
        Underutilized
      </text>
      <text
        x={sx(35)}
        y={sy(costMultiplier(0.35)) + 2}
        textAnchor="middle"
        fontSize={10}
        fill="#dc2626"
        opacity={0.55}
      >
        (wasted factory overhead)
      </text>

      {/* Optimal zone label */}
      <text
        x={sx(80)}
        y={sy(1.0) + 18}
        textAnchor="middle"
        fontSize={12}
        fontWeight={700}
        fill="#15803d"
      >
        Optimal (80%)
      </text>

      {/* Overutilization label */}
      <text
        x={sx(100)}
        y={sy(costMultiplier(1.0)) - 14}
        textAnchor="middle"
        fontSize={11}
        fontWeight={600}
        fill="#b45309"
        opacity={0.7}
      >
        Overutilized
      </text>
      <text
        x={sx(100)}
        y={sy(costMultiplier(1.0)) + 2}
        textAnchor="middle"
        fontSize={10}
        fill="#b45309"
        opacity={0.55}
      >
        (diminishing returns)
      </text>
    </g>
  )
}

export function CapacityCostChart({
  currentTeamData,
  allRoundsData,
  regionLabels,
}: CapacityCostChartProps) {
  void regionLabels

  const model = useMemo(() => {
    if (!currentTeamData || !Array.isArray(allRoundsData) || allRoundsData.length === 0) return null

    // Generate theoretical U-shaped cost curve
    const theoryCurve = Array.from({ length: 101 }, (_, i) => {
      const util = i / 100 // 0.00 → 1.00
      return {
        utilPct: util * 100,
        multiplier: costMultiplier(util),
        isTheory: true,
      }
    })

    // Extract team's actual utilization each round
    const actualPoints = allRoundsData
      .filter((r) => r.roundNumber >= 0)
      .map((round) => {
        const td = round.teams.find((t) => t.teamId === currentTeamData.teamId)
        if (!td) return null
        const util = td.utilization ?? 0
        if (util <= 0 && (td.unitsProduced ?? 0) <= 0) return null
        return {
          round: round.roundNumber,
          utilPct: Math.round(util * 1000) / 10, // e.g. 0.823 → 82.3
          multiplier: costMultiplier(util),
          actualUtil: util,
        }
      })
      .filter((r): r is NonNullable<typeof r> => Boolean(r))

    if (actualPoints.length === 0) return null

    return { theoryCurve, actualPoints }
  }, [allRoundsData, currentTeamData])

  if (!model) {
    return (
      <div style={{
        padding: '24px',
        background: 'var(--bg-secondary)',
        borderRadius: '8px',
        border: '1px solid var(--border-color)',
        marginBottom: '24px',
      }}>
        <h4 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '12px', color: 'var(--text-main)' }}>
          2. Capacity Cost Curve
        </h4>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          Need at least one completed round with production data to show the cost curve.
        </p>
      </div>
    )
  }

  /* Custom dot renderer — round label next to each point */
  const renderDot = (props: ScatterShapeProps) => {
    const { cx, cy, payload } = props
    if (cx == null || cy == null) return <g />
    return (
      <g>
        <circle cx={cx} cy={cy} r={6} fill="#3b82f6" stroke="#fff" strokeWidth={2} />
        <text x={cx + 10} y={cy - 6} fontSize={11} fontWeight={600} fill="#2563eb">
          R{payload.round}
        </text>
      </g>
    )
  }

  return (
    <div style={{
      background: 'var(--bg-main)',
      border: '1px solid var(--border-color)',
      borderRadius: '8px',
      padding: '24px',
      marginBottom: '32px',
    }}>
      <h4 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '8px', color: 'var(--text-main)' }}>
        2. Capacity Cost Curve
      </h4>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '12px', fontSize: '0.9rem' }}>
        Shows how your unit cost changes with factory utilization. Operating near 80% minimizes cost.
        Push too hard or run too light, and each unit gets more expensive.
      </p>

      <ResponsiveContainer width="100%" height={400}>
        <ScatterChart margin={{ top: 20, right: 30, bottom: 60, left: 60 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
          <XAxis
            type="number"
            dataKey="utilPct"
            name="Utilization"
            domain={[0, 105]}
            stroke="var(--text-secondary)"
            tick={{ fill: 'var(--text-secondary)' }}
            tickFormatter={(v) => `${v}%`}
            label={{ value: 'Capacity Utilization %', position: 'bottom', offset: 16, fill: 'var(--text-secondary)' }}
          />
          <YAxis
            type="number"
            dataKey="multiplier"
            name="Cost Multiplier"
            domain={[0.9, 'auto']}
            stroke="var(--text-secondary)"
            tick={{ fill: 'var(--text-secondary)' }}
            tickFormatter={(v: number) => `${v.toFixed(1)}x`}
            label={{ value: 'Unit Cost Multiplier', angle: -90, position: 'left', offset: 40, fill: 'var(--text-secondary)' }}
          />
          <Tooltip
            content={({ payload }) => {
              if (!payload || payload.length === 0) return null
              const data = payload[0].payload as CostCurvePoint
              if (data.isTheory) {
                return (
                  <div style={{
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '4px',
                    padding: '12px',
                  }}>
                    <p style={{ fontWeight: 700, marginBottom: '6px', color: 'var(--text-main)' }}>Cost Curve</p>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Utilization: {data.utilPct}%</p>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Multiplier: {data.multiplier.toFixed(2)}x</p>
                  </div>
                )
              }
              return (
                <div style={{
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '4px',
                  padding: '12px',
                }}>
                  <p style={{ fontWeight: 700, marginBottom: '6px', color: 'var(--text-main)' }}>Round {data.round}</p>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Utilization: {data.utilPct.toFixed(1)}%</p>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Cost Multiplier: {data.multiplier.toFixed(2)}x</p>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    {data.multiplier <= 1.02 ? '✓ Near optimal!' : data.actualUtil < 0.8 ? '↑ Could increase utilization' : '↓ Pushing beyond optimal'}
                  </p>
                </div>
              )
            }}
          />

          {/* Green optimal zone: 75-85% utilization */}
          <ReferenceArea
            x1={75}
            x2={85}
            fill="#22c55e"
            fillOpacity={0.12}
            stroke="#22c55e"
            strokeOpacity={0.3}
            strokeDasharray="4 4"
          />

          {/* Zone labels */}
          <Customized
            component={<CostCurveAnnotations optimalMinPx={75} optimalMaxPx={85} />}
          />

          {/* Theoretical U-shaped curve — no visible dots, just line */}
          <Scatter
            data={model.theoryCurve}
            fill="#f59e0b"
            line={{ stroke: '#f59e0b', strokeWidth: 2.5 }}
            shape={(props: ScatterShapeProps) => (
              <circle cx={props.cx} cy={props.cy} r={2} fill="#f59e0b" fillOpacity={0} />
            )}
            isAnimationActive={false}
          />

          {/* Actual team positions per round */}
          <Scatter
            data={model.actualPoints}
            fill="#3b82f6"
            shape={renderDot}
            isAnimationActive={false}
          />
        </ScatterChart>
      </ResponsiveContainer>

      {/* Custom legend */}
      <div style={{ display: 'flex', gap: '24px', marginTop: '12px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: 24, height: 3, background: '#f59e0b', borderRadius: 2 }} />
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Cost curve (theoretical)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#3b82f6' }} />
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Your utilization each round</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: 16, height: 12, background: '#22c55e', opacity: 0.2, border: '1px dashed #22c55e', borderRadius: 2 }} />
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Optimal zone (75–85%)</span>
        </div>
      </div>

      {/* Teaching note */}
      <div style={{
        marginTop: '12px',
        padding: '10px 12px',
        borderRadius: '6px',
        border: '1px solid var(--border-color)',
        background: 'var(--bg-secondary)',
        color: 'var(--text-secondary)',
        fontSize: '0.86rem',
        lineHeight: 1.45,
      }}>
        At <strong>80% utilization</strong>, unit costs are minimized (1.0× multiplier).
        Below 80%, you pay for idle factory overhead — costs rise sharply.
        Above 80%, diminishing returns kick in — each extra unit costs more to produce.
        This U-shape is why capacity planning matters: the goal is to stay in the green zone.
      </div>
    </div>
  )
}
