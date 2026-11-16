import { useMemo } from 'react'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatCurrency, formatUnits } from '../../engine/gameEngine'
import type { TeamRow } from '../../utils/normalizeTeamRow'

interface SupplyDemandChartProps {
  allRoundsData: Array<{ roundNumber: number; teams: TeamRow[]; marketDemand?: { us: number; asia: number; europe: number } }>
  roundNumber: number
  regionLabels: { us: string; asia: string; europe: string }
}

type RoundMarketSnapshot = {
  roundNumber: number
  quantitySold: number
  quantitySupplied: number
  quantityDemanded: number
  avgPrice: number
}

type LinearFn = {
  intercept: number
  slope: number
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function solveIntersection(demand: LinearFn, supply: LinearFn, fallback: { q: number; p: number }) {
  const denom = demand.slope - supply.slope
  if (Math.abs(denom) < 1e-9) return fallback
  const price = (supply.intercept - demand.intercept) / denom
  const quantity = demand.intercept + demand.slope * price
  if (!Number.isFinite(price) || !Number.isFinite(quantity)) return fallback
  return { q: quantity, p: price }
}

function buildLineData(
  demand: LinearFn,
  supply: LinearFn,
  shifted: LinearFn,
  qMin: number,
  qMax: number,
  shiftedKey: 's1' | 'd1'
) {
  const points: Array<{ q: number; d0: number | null; s0: number | null; s1: number | null; d1: number | null }> = []
  const steps = 36

  for (let i = 0; i <= steps; i++) {
    const q = qMin + ((qMax - qMin) * i) / steps
    const d0 = demand.slope !== 0 ? (q - demand.intercept) / demand.slope : null
    const s0 = supply.slope !== 0 ? (q - supply.intercept) / supply.slope : null
    const shiftedPrice = shifted.slope !== 0 ? (q - shifted.intercept) / shifted.slope : null
    points.push({
      q,
      d0: Number.isFinite(d0 ?? NaN) ? d0 : null,
      s0: Number.isFinite(s0 ?? NaN) ? s0 : null,
      s1: shiftedKey === 's1' && Number.isFinite(shiftedPrice ?? NaN) ? shiftedPrice : null,
      d1: shiftedKey === 'd1' && Number.isFinite(shiftedPrice ?? NaN) ? shiftedPrice : null,
    })
  }

  return points
}

export function SupplyDemandChart({
  allRoundsData,
  roundNumber,
  regionLabels,
}: SupplyDemandChartProps) {
  const model = useMemo(() => {
    if (!Array.isArray(allRoundsData) || allRoundsData.length === 0) return null

    const sorted = [...allRoundsData]
      .filter((round) => round.roundNumber >= 0)
      .sort((a, b) => a.roundNumber - b.roundNumber)

    if (sorted.length === 0) return null

    const selected = sorted.find((round) => round.roundNumber === roundNumber) ?? sorted[sorted.length - 1]
    const selectedIndex = sorted.findIndex((round) => round.roundNumber === selected.roundNumber)
    const previous = selectedIndex > 0 ? sorted[selectedIndex - 1] : null

    const toSnapshot = (round: { roundNumber: number; teams: TeamRow[]; marketDemand?: { us: number; asia: number; europe: number } }): RoundMarketSnapshot => {
      const teams = round.teams ?? []
      const quantitySold = teams.reduce((sum, team) => sum + (team.unitsSold ?? 0), 0)
      const quantitySupplied = teams.reduce((sum, team) => sum + (team.unitsProduced ?? 0), 0)
      const quantityDemanded = round.marketDemand
        ? (round.marketDemand.us ?? 0) + (round.marketDemand.asia ?? 0) + (round.marketDemand.europe ?? 0)
        : quantitySold
      const revenue = teams.reduce((sum, team) => sum + (team.revenueUS ?? 0) + (team.revenueAsia ?? 0) + (team.revenueEurope ?? 0), 0)
      const avgPrice = quantitySold > 0 ? revenue / quantitySold : 0

      return {
        roundNumber: round.roundNumber,
        quantitySold,
        quantitySupplied,
        quantityDemanded,
        avgPrice,
      }
    }

    const curr = toSnapshot(selected)
    if (curr.quantitySold <= 0 || curr.avgPrice <= 0) return null

    const prev = previous ? toSnapshot(previous) : null

    const q0 = curr.quantitySold
    const p0 = curr.avgPrice
    const qPrev = prev?.quantitySold ?? q0 * 0.98
    const pPrev = prev?.avgPrice && prev.avgPrice > 0 ? prev.avgPrice : p0 * 1.02
    const supplyPrev = prev?.quantitySupplied ?? qPrev
    const demandPrev = prev?.quantityDemanded ?? qPrev

    const deltaP = p0 - pPrev
    const rawDemandSlope = Math.abs(deltaP) > 1e-6 ? (q0 - qPrev) / deltaP : NaN
    const rawSupplySlope = Math.abs(deltaP) > 1e-6 ? (curr.quantitySupplied - supplyPrev) / deltaP : NaN

    const demandSlopeFallback = -Math.max(1, q0 / Math.max(p0, 1))
    const supplySlopeFallback = Math.max(1, Math.max(curr.quantitySupplied, q0) / Math.max(p0, 1) * 0.8)

    const demandSlope = rawDemandSlope < 0 && Number.isFinite(rawDemandSlope)
      ? clamp(rawDemandSlope, demandSlopeFallback * 5, demandSlopeFallback * 0.15)
      : demandSlopeFallback

    const supplySlope = rawSupplySlope > 0 && Number.isFinite(rawSupplySlope)
      ? clamp(rawSupplySlope, supplySlopeFallback * 0.15, supplySlopeFallback * 5)
      : supplySlopeFallback

    const demand0: LinearFn = {
      intercept: q0 - demandSlope * p0,
      slope: demandSlope,
    }
    const supply0: LinearFn = {
      intercept: q0 - supplySlope * p0,
      slope: supplySlope,
    }

    const supplyShift = curr.quantitySupplied - supplyPrev
    const demandShift = curr.quantityDemanded - demandPrev

    const supply1: LinearFn = {
      intercept: supply0.intercept + supplyShift,
      slope: supply0.slope,
    }
    const demand1: LinearFn = {
      intercept: demand0.intercept + demandShift,
      slope: demand0.slope,
    }

    const eq0 = { q: q0, p: p0 }
    const eqSupplyShiftRaw = solveIntersection(demand0, supply1, eq0)
    const eqDemandShiftRaw = solveIntersection(demand1, supply0, eq0)

    const qObservedMax = Math.max(q0, qPrev, curr.quantitySupplied, supplyPrev, curr.quantityDemanded, demandPrev, 1)
    const pObservedMax = Math.max(p0, pPrev, 1)
    const eqSupplyShift = {
      q: clamp(eqSupplyShiftRaw.q, 0, qObservedMax * 2.5),
      p: clamp(eqSupplyShiftRaw.p, 1, pObservedMax * 2.5),
    }
    const eqDemandShift = {
      q: clamp(eqDemandShiftRaw.q, 0, qObservedMax * 2.5),
      p: clamp(eqDemandShiftRaw.p, 1, pObservedMax * 2.5),
    }

    const qMinBase = Math.min(q0, qPrev, eqSupplyShift.q, eqDemandShift.q, curr.quantitySupplied, supplyPrev, curr.quantityDemanded, demandPrev)
    const qMaxBase = Math.max(q0, qPrev, eqSupplyShift.q, eqDemandShift.q, curr.quantitySupplied, supplyPrev, curr.quantityDemanded, demandPrev, 1)
    const qMin = Math.max(0, qMinBase * 0.8)
    const qMax = qMaxBase * 1.15

    const pBaseMin = Math.min(p0, pPrev, eqSupplyShift.p, eqDemandShift.p)
    const pBaseMax = Math.max(p0, pPrev, eqSupplyShift.p, eqDemandShift.p)
    const pCandidates = [
      p0,
      pPrev,
      eqSupplyShift.p,
      eqDemandShift.p,
      (qMin - demand0.intercept) / demand0.slope,
      (qMax - demand0.intercept) / demand0.slope,
      (qMin - supply0.intercept) / supply0.slope,
      (qMax - supply0.intercept) / supply0.slope,
      (qMin - supply1.intercept) / supply1.slope,
      (qMax - supply1.intercept) / supply1.slope,
      (qMin - demand1.intercept) / demand1.slope,
      (qMax - demand1.intercept) / demand1.slope,
    ].filter((v) => Number.isFinite(v)) as number[]

    const pMin = Math.max(1, Math.min(pBaseMin * 0.82, Math.min(...pCandidates)))
    const pMax = Math.max(pMin + 1, Math.max(pBaseMax * 1.18, Math.max(...pCandidates)))

    const supplyShiftData = buildLineData(demand0, supply0, supply1, qMin, qMax, 's1')
      .map((row) => ({
        ...row,
        d0: row.d0 === null ? null : clamp(row.d0, pMin, pMax),
        s0: row.s0 === null ? null : clamp(row.s0, pMin, pMax),
        s1: row.s1 === null ? null : clamp(row.s1, pMin, pMax),
      }))
    const demandShiftData = buildLineData(demand0, supply0, demand1, qMin, qMax, 'd1')
      .map((row) => ({
        ...row,
        d0: row.d0 === null ? null : clamp(row.d0, pMin, pMax),
        s0: row.s0 === null ? null : clamp(row.s0, pMin, pMax),
        d1: row.d1 === null ? null : clamp(row.d1, pMin, pMax),
      }))

    return {
      selectedRound: curr.roundNumber,
      previousRound: prev?.roundNumber ?? null,
      eq0: { q: q0, p: p0 },
      eqSupplyShift,
      eqDemandShift,
      supplyShift,
      demandShift,
      supplyShiftData,
      demandShiftData,
      qMin,
      qMax,
      pMin,
      pMax,
    }
  }, [allRoundsData, roundNumber])

  if (!model) {
    return (
      <div style={{ padding: '24px', background: 'var(--bg-secondary)', borderRadius: '8px', marginBottom: '24px' }}>
        <h4 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '12px', color: 'var(--text-main)' }}>
          1. Supply & Demand Curves + Equilibrium Price
        </h4>
        <p style={{ color: 'var(--text-secondary)' }}>Not enough game data to build teaching curves yet.</p>
      </div>
    )
  }

  const renderPanel = (
    title: string,
    data: Array<{ q: number; d0: number | null; s0: number | null; s1: number | null; d1: number | null }>,
    shiftedKey: 's1' | 'd1',
    eq1: { q: number; p: number },
    explanation: string
  ) => {
    const quantityValues = [model.eq0.q, eq1.q, ...data.map((row) => row.q)].filter((v) => Number.isFinite(v))
    const priceSeries = shiftedKey === 's1'
      ? data.flatMap((row) => [row.d0, row.s0, row.s1])
      : data.flatMap((row) => [row.d0, row.s0, row.d1])
    const priceValues = [model.eq0.p, eq1.p, ...priceSeries].filter((v): v is number => v !== null && Number.isFinite(v))

    const qMinRaw = Math.min(...quantityValues)
    const qMaxRaw = Math.max(...quantityValues)
    const pMinRaw = Math.min(...priceValues)
    const pMaxRaw = Math.max(...priceValues)

    const qPad = Math.max((qMaxRaw - qMinRaw) * 0.25, model.eq0.q * 0.05, 1)
    const pPad = Math.max((pMaxRaw - pMinRaw) * 0.25, model.eq0.p * 0.08, 1)

    const qMinPanel = Math.max(0, qMinRaw - qPad)
    const qMaxPanel = qMaxRaw + qPad
    const pMinPanel = Math.max(1, pMinRaw - pPad)
    const pMaxPanel = pMaxRaw + pPad

    return (
      <div style={{
      background: 'var(--bg-main)',
      border: '1px solid var(--border-color)',
      borderRadius: '8px',
      padding: '16px',
    }}>
      <h5 style={{ margin: '0 0 10px 0', color: 'var(--text-main)', fontSize: '1rem' }}>{title}</h5>
      <ResponsiveContainer width="100%" height={330}>
        <LineChart data={data} margin={{ top: 40, right: 20, left: 66, bottom: 44 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
          <XAxis
            type="number"
            dataKey="q"
            domain={[qMinPanel, qMaxPanel]}
            stroke="var(--text-secondary)"
            tick={{ fill: 'var(--text-secondary)', fontSize: 11 }}
            tickMargin={8}
            tickCount={6}
            tickFormatter={(v) => formatUnits(v)}
          />
          <YAxis
            domain={[pMinPanel, pMaxPanel]}
            stroke="var(--text-secondary)"
            tick={{ fill: 'var(--text-secondary)', fontSize: 11 }}
            tickMargin={8}
            tickCount={6}
            tickFormatter={(v) => `$${Number(v).toFixed(0)}`}
            label={{ value: 'Price ($)', angle: -90, position: 'left', offset: 30, fill: 'var(--text-secondary)' }}
          />
          <Tooltip
            formatter={(value: unknown, key: string) => {
              const label = key === 'd0' ? 'D0'
                : key === 's0' ? 'S0'
                  : key === 's1' ? 'S1'
                    : key === 'd1' ? 'D1'
                      : key
              return [value === null ? '-' : formatCurrency(Number(value)), label]
            }}
            labelFormatter={(value) => `Q: ${formatUnits(Number(value))}`}
            contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}
          />
          <Legend verticalAlign="top" align="center" wrapperStyle={{ top: 2 }} />

          <ReferenceLine x={model.eq0.q} stroke="#94a3b8" strokeDasharray="4 4" label={{ value: 'Q0', fill: '#cbd5e1', position: 'insideTop' }} />
          <ReferenceLine y={model.eq0.p} stroke="#94a3b8" strokeDasharray="4 4" label={{ value: 'P0', fill: '#cbd5e1', position: 'insideRight' }} />
          <ReferenceLine x={eq1.q} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: 'Q1', fill: '#fbbf24', position: 'insideBottom' }} />
          <ReferenceLine y={eq1.p} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: 'P1', fill: '#fbbf24', position: 'insideLeft' }} />

          <Line type="monotone" dataKey="d0" name="D0 (Demand)" stroke="#ef4444" strokeWidth={2.8} dot={false} connectNulls />
          <Line type="monotone" dataKey="s0" name="S0 (Supply)" stroke="#3b82f6" strokeWidth={2.8} dot={false} connectNulls />
          {shiftedKey === 's1' && (
            <Line type="monotone" dataKey="s1" name="S1 (Shifted Supply)" stroke="#22c55e" strokeWidth={3.2} dot={false} connectNulls />
          )}
          {shiftedKey === 'd1' && (
            <Line type="monotone" dataKey="d1" name="D1 (Shifted Demand)" stroke="#f97316" strokeWidth={3.2} dot={false} connectNulls />
          )}
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
        {explanation}
      </div>
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
        1. Supply & Demand Curves + Equilibrium Price (Market Overall, Round {model.selectedRound})
      </h4>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '16px', fontSize: '0.9rem' }}>
        Built from game data (all teams aggregated across {regionLabels.us}, {regionLabels.asia}, {regionLabels.europe}). E0: {formatUnits(model.eq0.q)} at {formatCurrency(model.eq0.p)}. Previous round: {model.previousRound ?? 'N/A'}.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '16px' }}>
        {renderPanel(
          `Supply Shift (S0 -> S1): ${model.supplyShift >= 0 ? '+' : ''}${formatUnits(model.supplyShift)}`,
          model.supplyShiftData,
          's1',
          model.eqSupplyShift,
          `Supply changed by ${model.supplyShift >= 0 ? '+' : ''}${formatUnits(model.supplyShift)} from the previous round. Equilibrium moves from E0 (${formatCurrency(model.eq0.p)}, ${formatUnits(model.eq0.q)}) to E1 (${formatCurrency(model.eqSupplyShift.p)}, ${formatUnits(model.eqSupplyShift.q)}). This panel isolates supply movement while holding demand at D0.`
        )}
        {renderPanel(
          `Demand Shift (D0 -> D1): ${model.demandShift >= 0 ? '+' : ''}${formatUnits(model.demandShift)}`,
          model.demandShiftData,
          'd1',
          model.eqDemandShift,
          `Demand changed by ${model.demandShift >= 0 ? '+' : ''}${formatUnits(model.demandShift)} from the previous round. Equilibrium moves from E0 (${formatCurrency(model.eq0.p)}, ${formatUnits(model.eq0.q)}) to E1 (${formatCurrency(model.eqDemandShift.p)}, ${formatUnits(model.eqDemandShift.q)}). This panel isolates demand movement while holding supply at S0.`
        )}
      </div>
    </div>
  )
}
