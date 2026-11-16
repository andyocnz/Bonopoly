import { useMemo } from 'react'
import { CartesianGrid, Legend, Line, LineChart, ReferenceDot, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatCurrency, formatUnits } from '../../engine/gameEngine'
import type { TeamRow } from '../../utils/normalizeTeamRow'

interface CostCurvesChartProps {
  currentTeamData: TeamRow | null
  allRoundsData: Array<{ roundNumber: number; teams: TeamRow[] }>
  regionLabels: { us: string; asia: string; europe: string }
}

type CostPoint = {
  round: number
  teamName: string
  quantity: number
  avc: number
  afc: number
  atc: number
  variableCost: number
  fixedCost: number
  totalCost: number
}

type PlotPoint = {
  quantity: number
  atc: number
  avc: number
  afc: number
  mc: number
}

function quantile(sortedValues: number[], q: number) {
  if (sortedValues.length === 0) return 0
  const clamped = Math.min(1, Math.max(0, q))
  const pos = (sortedValues.length - 1) * clamped
  const base = Math.floor(pos)
  const rest = pos - base
  if (sortedValues[base + 1] !== undefined) {
    return sortedValues[base] + rest * (sortedValues[base + 1] - sortedValues[base])
  }
  return sortedValues[base]
}

function median(values: number[]) {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  return quantile(sorted, 0.5)
}

function solve3x3(a: number[][], b: number[]) {
  const m = a.map((row, i) => [...row, b[i]])
  for (let i = 0; i < 3; i += 1) {
    let pivot = i
    for (let r = i + 1; r < 3; r += 1) {
      if (Math.abs(m[r][i]) > Math.abs(m[pivot][i])) pivot = r
    }
    if (Math.abs(m[pivot][i]) < 1e-12) return null
    if (pivot !== i) {
      const tmp = m[i]
      m[i] = m[pivot]
      m[pivot] = tmp
    }
    const div = m[i][i]
    for (let c = i; c < 4; c += 1) m[i][c] /= div
    for (let r = 0; r < 3; r += 1) {
      if (r === i) continue
      const factor = m[r][i]
      for (let c = i; c < 4; c += 1) m[r][c] -= factor * m[i][c]
    }
  }
  return [m[0][3], m[1][3], m[2][3]]
}

function fitQuadraticThrough3(xs: [number, number, number], ys: [number, number, number]) {
  const [x1, x2, x3] = xs
  const [y1, y2, y3] = ys
  return solve3x3(
    [
      [x1 * x1, x1, 1],
      [x2 * x2, x2, 1],
      [x3 * x3, x3, 1],
    ],
    [y1, y2, y3],
  )
}

function nearestByQuantity(points: CostPoint[], target: number) {
  return points.reduce((best, p) => {
    const dBest = Math.abs(best.quantity - target)
    const dCurr = Math.abs(p.quantity - target)
    return dCurr < dBest ? p : best
  }, points[0])
}

function aggregateAround(points: CostPoint[], targetQ: number, qBand: number) {
  const neighborhood = points.filter((p) => Math.abs(p.quantity - targetQ) <= qBand)
  const source = neighborhood.length >= 3
    ? neighborhood
    : [...points].sort((a, b) => Math.abs(a.quantity - targetQ) - Math.abs(b.quantity - targetQ)).slice(0, 3)

  return {
    quantity: median(source.map((p) => p.quantity)),
    atc: median(source.map((p) => p.atc)),
    avc: median(source.map((p) => p.avc)),
    afc: median(source.map((p) => p.afc)),
    fixedCost: median(source.map((p) => p.fixedCost)),
  }
}

export function CostCurvesChart({
  currentTeamData,
  allRoundsData,
  regionLabels,
}: CostCurvesChartProps) {
  const model = useMemo(() => {
    void currentTeamData
    void regionLabels

    if (!Array.isArray(allRoundsData) || allRoundsData.length === 0) return null

    const pooled = allRoundsData
      .filter((round) => round.roundNumber >= 0)
      .flatMap((round) => round.teams.map((team) => {
        const quantity = Math.max(0, team.unitsProduced || team.unitsSold || 0)
        if (quantity <= 0) return null

        const variableCost = Math.max(0, team.cogs || 0)
        const fixedCost = Math.max(0, (team.operatingExpenses || 0) + (team.depreciation || 0))
        const totalCost = variableCost + fixedCost

        return {
          round: round.roundNumber,
          teamName: team.teamName || team.teamId || 'Team',
          quantity,
          avc: variableCost / quantity,
          afc: fixedCost / quantity,
          atc: totalCost / quantity,
          variableCost,
          fixedCost,
          totalCost,
        } as CostPoint
      }).filter((p): p is CostPoint => Boolean(p)))
      .sort((a, b) => a.quantity - b.quantity)

    if (pooled.length < 6) return null

    const qSorted = pooled.map((p) => p.quantity).sort((a, b) => a - b)
    const atcSorted = pooled.map((p) => p.atc).sort((a, b) => a - b)
    const qLowTrim = quantile(qSorted, 0.05)
    const qHighTrim = quantile(qSorted, 0.95)
    const atcLowTrim = quantile(atcSorted, 0.05)
    const atcHighTrim = quantile(atcSorted, 0.95)

    const filtered = pooled.filter((p) => (
      p.quantity >= qLowTrim
      && p.quantity <= qHighTrim
      && p.atc >= atcLowTrim
      && p.atc <= atcHighTrim
    ))

    if (filtered.length < 6) return null

    const minRaw = filtered.reduce((best, p) => (p.atc < best.atc ? p : best), filtered[0])
    const q1Target = quantile(filtered.map((p) => p.quantity).sort((a, b) => a - b), 0.2)
    const q3Target = quantile(filtered.map((p) => p.quantity).sort((a, b) => a - b), 0.8)

    const leftPool = filtered.filter((p) => p.quantity < minRaw.quantity)
    const rightPool = filtered.filter((p) => p.quantity > minRaw.quantity)
    const leftPick = leftPool.length > 0 ? nearestByQuantity(leftPool, q1Target) : filtered[0]
    const rightPick = rightPool.length > 0 ? nearestByQuantity(rightPool, q3Target) : filtered[filtered.length - 1]

    const qSpan = Math.max(1, rightPick.quantity - leftPick.quantity)
    const qBand = Math.max(1, qSpan * 0.08)

    const a1 = aggregateAround(filtered, leftPick.quantity, qBand)
    const a2 = aggregateAround(filtered, minRaw.quantity, qBand)
    const a3 = aggregateAround(filtered, rightPick.quantity, qBand)

    const x1 = a1.quantity
    const x2 = a2.quantity
    const x3 = a3.quantity
    if (!(x1 < x2 && x2 < x3)) return null

    const atcCoef = fitQuadraticThrough3([x1, x2, x3], [a1.atc, a2.atc, a3.atc])
    if (!atcCoef) return null
    let a = atcCoef[0]
    const b = atcCoef[1]
    const c = atcCoef[2]
    if (a <= 0) a = Math.abs(a) + 1e-9

    const fixedPerRound = median([a1.fixedCost, a2.fixedCost, a3.fixedCost])

    let qStar = -b / (2 * a)
    qStar = Math.min(x3, Math.max(x1, qStar))
    const qGrid = [x1, qStar, x3]

    const points: PlotPoint[] = qGrid.map((q) => {
      const atc = Math.max(0, a * q * q + b * q + c)
      const afc = Math.max(0, fixedPerRound / Math.max(1, q))
      const avc = Math.max(0, atc - afc)
      const mc = Math.max(0, 3 * a * q * q + 2 * b * q + c)
      return { quantity: q, atc, avc, afc, mc }
    })

    const atcStar = Math.max(0, a * qStar * qStar + b * qStar + c)

    return {
      points,
      anchors: [a1, a2, a3],
      qStar,
      atcStar,
      pooledCount: pooled.length,
      usedCount: filtered.length,
    }
  }, [allRoundsData, currentTeamData, regionLabels])

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
          1. Cost Curves (AVC, ATC, AFC)
        </h4>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          Need enough completed rounds with production data to fit cost curves.
        </p>
      </div>
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
        1. Cost Curves (AVC, ATC, AFC)
      </h4>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '12px', fontSize: '0.9rem' }}>
        Built from three real anchors (low quantity, minimum ATC, high quantity), then connected as smooth curves.
      </p>

      <ResponsiveContainer width="100%" height={460}>
        <LineChart data={model.points} margin={{ top: 42, right: 30, bottom: 96, left: 60 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
          <XAxis
            type="number"
            dataKey="quantity"
            domain={['dataMin', 'dataMax']}
            tickCount={6}
            stroke="var(--text-secondary)"
            tick={{ fill: 'var(--text-secondary)' }}
            tickFormatter={(value) => formatUnits(value)}
          />
          <YAxis
            type="number"
            domain={[0, 'dataMax']}
            stroke="var(--text-secondary)"
            tick={{ fill: 'var(--text-secondary)' }}
            tickFormatter={(value) => `$${Number(value).toFixed(0)}`}
            label={{ value: 'Cost per Unit ($)', angle: -90, position: 'left', offset: 40, fill: 'var(--text-secondary)' }}
          />
          <Tooltip
            content={({ payload }) => {
              if (!payload || payload.length === 0) return null
              const data = payload[0].payload as PlotPoint
              return (
                <div style={{
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '4px',
                  padding: '12px',
                }}>
                  <p style={{ fontWeight: 700, marginBottom: '8px', color: 'var(--text-main)' }}>
                    Q {formatUnits(data.quantity)}
                  </p>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>ATC: {formatCurrency(data.atc)}</p>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>AVC: {formatCurrency(data.avc)}</p>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>AFC: {formatCurrency(data.afc)}</p>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>MC: {formatCurrency(data.mc)}</p>
                </div>
              )
            }}
          />
          <Legend verticalAlign="top" align="center" wrapperStyle={{ top: 6 }} />

          <ReferenceDot
            x={model.qStar}
            y={model.atcStar}
            r={6}
            fill="#f59e0b"
            stroke="none"
            label={{ value: 'ATC minimum (MC=ATC)', position: 'top', fill: '#fbbf24' }}
          />

          {model.anchors.map((a, idx) => (
            <ReferenceDot
              key={`anchor-${idx}`}
              x={a.quantity}
              y={a.atc}
              r={3}
              fill="#94a3b8"
              stroke="none"
            />
          ))}

          <Line type="monotone" dataKey="atc" name="ATC" stroke="#ef4444" strokeWidth={2.8} dot={false} />
          <Line type="monotone" dataKey="avc" name="AVC" stroke="#3b82f6" strokeWidth={2.6} dot={false} />
          <Line type="monotone" dataKey="afc" name="AFC" stroke="#10b981" strokeWidth={2.4} strokeDasharray="5 4" dot={false} />
          <Line type="monotone" dataKey="mc" name="MC" stroke="#f59e0b" strokeWidth={2.4} strokeDasharray="4 3" dot={false} />
        </LineChart>
      </ResponsiveContainer>

      <div style={{ textAlign: 'center', color: 'var(--text-secondary)', marginTop: '-2px', marginBottom: '8px' }}>Quantity</div>

      <div style={{
        marginTop: '10px',
        padding: '10px 12px',
        borderRadius: '6px',
        border: '1px solid var(--border-color)',
        background: 'var(--bg-secondary)',
        color: 'var(--text-secondary)',
        fontSize: '0.86rem',
        lineHeight: 1.45,
      }}>
        Comment: Formulas used: (1) AVC = VC/Q, (2) AFC = FC/Q, (3) ATC = AVC + AFC, (4) discrete MC ~ ?TC/?Q, (5) fitted MC = d(TC)/dQ. We fit ATC as ATC(Q)=aQ^2+bQ+c from three real anchors, then TC(Q)=Q*ATC(Q)=aQ^3+bQ^2+cQ, so MC(Q)=3aQ^2+2bQ+c. At the ATC minimum Q* (where dATC/dQ=0), MC=ATC. Built with {model.usedCount}/{model.pooledCount} real pooled points after trimming.
      </div>
    </div>
  )
}
