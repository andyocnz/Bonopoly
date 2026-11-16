import { useMemo } from 'react'
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Customized,
  usePlotArea, useXAxisDomain, useYAxisDomain,
} from 'recharts'
import { formatUnits } from '../../engine/gameEngine'
import type { TeamRow } from '../../utils/normalizeTeamRow'

interface ProductionPossibilityChartProps {
  currentTeamData: TeamRow | null
  allRoundsData: Array<{ roundNumber: number; teams: TeamRow[] }>
  regionLabels: { us: string; asia: string; europe: string }
}

type ChartPoint = {
  round?: number
  usProduction: number
  asiaProduction: number
  utilizationPct?: number
  isFrontier?: boolean
}

type ScatterShapeProps = {
  cx?: number
  cy?: number
  payload?: ChartPoint
}

/* ── Annotation layer rendered inside the chart SVG ── */
function PPFAnnotations({
  maxCapacity,
  frontierPoints,
  regionLabels,
}: {
  maxCapacity: number
  frontierPoints: Array<{ usProduction: number; asiaProduction: number }>
  regionLabels: { us: string; asia: string }
}) {
  const plotArea = usePlotArea()
  const xDomain = useXAxisDomain(0) as [number, number] | undefined
  const yDomain = useYAxisDomain(0) as [number, number] | undefined

  if (!plotArea || !xDomain || !yDomain) return null

  // Linear scale: data value → pixel coordinate
  const sx = (v: number) =>
    plotArea.x + ((v - xDomain[0]) / (xDomain[1] - xDomain[0])) * plotArea.width
  const sy = (v: number) =>
    plotArea.y + plotArea.height - ((v - yDomain[0]) / (yDomain[1] - yDomain[0])) * plotArea.height

  const mc = maxCapacity

  // Attainable-region polygon: origin → along frontier → back
  const polyPts = [
    `${sx(0)},${sy(0)}`,
    ...frontierPoints.map((p) => `${sx(p.usProduction)},${sy(p.asiaProduction)}`),
    `${sx(mc)},${sy(0)}`,
  ].join(' ')

  // Midpoint on the frontier for "Efficient" label
  const midT = 0.42
  const eMidX = mc * Math.sin(midT * Math.PI / 2)
  const eMidY = mc * Math.cos(midT * Math.PI / 2)

  return (
    <g className="ppf-annotations">
      {/* Yellow fill for attainable region */}
      <polygon points={polyPts} fill="#fef9c3" fillOpacity={0.35} stroke="none" />

      {/* ── Region labels ── */}
      <text
        x={sx(mc * 0.2)}
        y={sy(mc * 0.2)}
        textAnchor="middle"
        fontSize={14}
        fontWeight={600}
        fill="#92400e"
        opacity={0.72}
      >
        Inefficient
      </text>

      <text
        x={sx(mc * 0.75)}
        y={sy(mc * 0.75)}
        textAnchor="middle"
        fontSize={14}
        fontWeight={600}
        fill="#dc2626"
        opacity={0.5}
      >
        Unattainable
      </text>

      <text
        x={sx(eMidX) + 10}
        y={sy(eMidY) - 12}
        textAnchor="start"
        fontSize={12}
        fontWeight={700}
        fill="#d97706"
      >
        ← Efficient
      </text>

      {/* ── Anchor point A: All Asia (top of y-axis) ── */}
      <circle cx={sx(0)} cy={sy(mc)} r={6} fill="#f59e0b" stroke="#fff" strokeWidth={2} />
      <text x={sx(0) + 12} y={sy(mc) + 5} fontSize={12} fontWeight={700} fill="#b45309">
        A: All {regionLabels.asia}
      </text>

      {/* ── Anchor point B: All US (right of x-axis) ── */}
      <circle cx={sx(mc)} cy={sy(0)} r={6} fill="#f59e0b" stroke="#fff" strokeWidth={2} />
      <text x={sx(mc)} y={sy(0) - 12} textAnchor="middle" fontSize={12} fontWeight={700} fill="#b45309">
        B: All {regionLabels.us}
      </text>
    </g>
  )
}

export function ProductionPossibilityChart({
  currentTeamData,
  allRoundsData,
  regionLabels,
}: ProductionPossibilityChartProps) {
  const model = useMemo(() => {
    if (!currentTeamData || !Array.isArray(allRoundsData) || allRoundsData.length === 0) return null

    const actualProduction = allRoundsData
      .filter((round) => round.roundNumber >= 0)
      .map((round) => {
        const teamData = round.teams.find((team) => team.teamId === currentTeamData.teamId)
        if (!teamData) return null

        const us = Math.max(0, teamData.productionUS ?? 0)
        const asia = Math.max(0, teamData.productionAsia ?? 0)
        let total = us + asia
        if (total <= 0) total = Math.max(0, teamData.unitsProduced ?? 0)
        if (total <= 0) return null

        const utilization = teamData.utilization && teamData.utilization > 0 ? teamData.utilization : null
        const estimatedCapacity = utilization ? total / utilization : total

        return {
          round: round.roundNumber,
          usProduction: us,
          asiaProduction: asia,
          totalProduction: total,
          estimatedCapacity,
          utilizationPct: utilization ? utilization * 100 : 100,
        }
      })
      .filter((row): row is NonNullable<typeof row> => Boolean(row))

    if (actualProduction.length === 0) return null

    const maxCapacity = Math.max(...actualProduction.map((r) => r.estimatedCapacity), 1)

    // Bowed (concave) frontier — quarter ellipse shape
    const N = 30
    const frontier = Array.from({ length: N + 1 }, (_, i) => {
      const t = i / N
      return {
        usProduction: maxCapacity * Math.sin(t * Math.PI / 2),
        asiaProduction: maxCapacity * Math.cos(t * Math.PI / 2),
        isFrontier: true,
      }
    })

    return { actualProduction, frontier, maxCapacity }
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
          1. Production Possibility Frontier (PPF)
        </h4>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          Need at least one completed round with production to draw the frontier.
        </p>
      </div>
    )
  }

  /* Custom dot renderer — shows round label next to each production point */
  const renderProductionDot = (props: ScatterShapeProps) => {
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
        1. Production Possibility Frontier (PPF)
      </h4>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '12px', fontSize: '0.9rem' }}>
        Shows opportunity cost of regional production allocation. Blue points are your actual decisions each round.
        The curved frontier shows maximum possible production combinations given your capacity.
      </p>

      <ResponsiveContainer width="100%" height={420}>
        <ScatterChart margin={{ top: 20, right: 30, bottom: 60, left: 60 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
          <XAxis
            type="number"
            dataKey="usProduction"
            name={`${regionLabels.us} Production`}
            stroke="var(--text-secondary)"
            tick={{ fill: 'var(--text-secondary)' }}
            tickFormatter={(value) => formatUnits(value)}
            label={{ value: `${regionLabels.us} Production`, position: 'bottom', offset: 16, fill: 'var(--text-secondary)' }}
          />
          <YAxis
            type="number"
            dataKey="asiaProduction"
            name={`${regionLabels.asia} Production`}
            stroke="var(--text-secondary)"
            tick={{ fill: 'var(--text-secondary)' }}
            tickFormatter={(value) => formatUnits(value)}
            label={{ value: `${regionLabels.asia} Production`, angle: -90, position: 'left', offset: 40, fill: 'var(--text-secondary)' }}
          />
          <Tooltip
            content={({ payload }) => {
              if (!payload || payload.length === 0) return null
              const data = payload[0].payload as ChartPoint
              if (data.isFrontier) {
                return (
                  <div style={{
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '4px',
                    padding: '12px',
                  }}>
                    <p style={{ fontWeight: 700, marginBottom: '8px', color: 'var(--text-main)' }}>PPF Frontier</p>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{regionLabels.us}: {formatUnits(data.usProduction)}</p>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{regionLabels.asia}: {formatUnits(data.asiaProduction)}</p>
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
                  <p style={{ fontWeight: 700, marginBottom: '8px', color: 'var(--text-main)' }}>Round {data.round}</p>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{regionLabels.us}: {formatUnits(data.usProduction)}</p>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{regionLabels.asia}: {formatUnits(data.asiaProduction)}</p>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Utilization: {Number(data.utilizationPct ?? 0).toFixed(1)}%</p>
                </div>
              )
            }}
          />

          {/* Shaded regions + anchor point labels (rendered behind data) */}
          <Customized
            component={
              <PPFAnnotations
                maxCapacity={model.maxCapacity}
                frontierPoints={model.frontier}
                regionLabels={{ us: regionLabels.us, asia: regionLabels.asia }}
              />
            }
          />

          {/* Frontier curve — bowed line, no visible dots */}
          <Scatter
            data={model.frontier}
            fill="#f59e0b"
            line={{ stroke: '#f59e0b', strokeWidth: 2.5 }}
            shape={(props: ScatterShapeProps) => (
              <circle cx={props.cx} cy={props.cy} r={3} fill="#f59e0b" fillOpacity={0} />
            )}
            isAnimationActive={false}
          />

          {/* Actual production points with round labels */}
          <Scatter
            data={model.actualProduction}
            fill="#3b82f6"
            shape={renderProductionDot}
            isAnimationActive={false}
          />
        </ScatterChart>
      </ResponsiveContainer>

      {/* Custom legend below chart */}
      <div style={{ display: 'flex', gap: '24px', marginTop: '12px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: 24, height: 3, background: '#f59e0b', borderRadius: 2 }} />
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>PPF Frontier (max capacity)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#3b82f6' }} />
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Your production each round</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: 16, height: 12, background: '#fef9c3', border: '1px solid #fde68a', borderRadius: 2 }} />
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Attainable region</span>
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
        <strong>A</strong> and <strong>B</strong> show extreme allocations (100% to one region).
        Points on the frontier = efficient use of all capacity.
        Points inside = wasted capacity or idle factories.
        The curve shape reflects increasing opportunity cost — shifting the last units between regions costs more than the first.
      </div>
    </div>
  )
}
