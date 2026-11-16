import { useMemo } from 'react'
import { Area, AreaChart, CartesianGrid, Legend, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatCurrency, formatUnits } from '../../engine/gameEngine'
import type { TeamRow } from '../../utils/normalizeTeamRow'

interface RevenueProfitChartProps {
  allRoundsData: Array<{ roundNumber: number; teams: TeamRow[]; marketDemand?: { us: number; asia: number; europe: number } }>
  roundNumber: number
}

type LinearFn = {
  intercept: number
  slope: number
}

type Snapshot = {
  roundNumber: number
  quantitySold: number
  quantitySupplied: number
  quantityDemanded: number
  avgPrice: number
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function solveIntersection(demand: LinearFn, supply: LinearFn, fallback: { q: number; p: number }) {
  const denom = demand.slope - supply.slope
  if (Math.abs(denom) < 1e-9) return fallback
  const p = (supply.intercept - demand.intercept) / denom
  const q = demand.intercept + demand.slope * p
  if (!Number.isFinite(p) || !Number.isFinite(q)) return fallback
  return { q, p }
}

function demandAtPrice(demand: LinearFn, price: number) {
  return demand.intercept + demand.slope * price
}

function supplyAtPrice(supply: LinearFn, price: number) {
  return supply.intercept + supply.slope * price
}

export function RevenueProfitChart({
  allRoundsData,
  roundNumber,
}: RevenueProfitChartProps) {
  void roundNumber

  const model = useMemo(() => {
    if (!Array.isArray(allRoundsData) || allRoundsData.length === 0) return null

    const sorted = [...allRoundsData]
      .filter((round) => round.roundNumber >= 0)
      .sort((a, b) => a.roundNumber - b.roundNumber)

    if (sorted.length === 0) return null

    const toSnapshot = (round: { roundNumber: number; teams: TeamRow[]; marketDemand?: { us: number; asia: number; europe: number } }): Snapshot => {
      const teams = round.teams ?? []
      const quantitySold = teams.reduce((sum, team) => sum + (team.unitsSold ?? 0), 0)
      const quantitySupplied = teams.reduce((sum, team) => sum + (team.unitsProduced ?? 0), 0)
      const quantityDemanded = round.marketDemand
        ? (round.marketDemand.us ?? 0) + (round.marketDemand.asia ?? 0) + (round.marketDemand.europe ?? 0)
        : quantitySold
      const revenue = teams.reduce((sum, team) => sum + (team.revenueUS ?? 0) + (team.revenueAsia ?? 0) + (team.revenueEurope ?? 0), 0)
      const avgPrice = quantitySold > 0 ? revenue / quantitySold : 0
      return { roundNumber: round.roundNumber, quantitySold, quantitySupplied, quantityDemanded, avgPrice }
    }

    // Calculate DWL for each round and select the one with highest DWL for best teaching example
    const calculateDWLForRound = (roundIndex: number) => {
      const round = sorted[roundIndex]
      const previous = roundIndex > 0 ? sorted[roundIndex - 1] : null
      const curr = toSnapshot(round)

      if (curr.quantitySold <= 0 || curr.avgPrice <= 0) return { round, dwl: 0, roundIndex }

      const prev = previous ? toSnapshot(previous) : null
      const q0 = curr.quantitySold
      const p0 = curr.avgPrice
      const qPrev = prev?.quantitySold ?? q0 * 0.98
      const pPrev = prev?.avgPrice && prev.avgPrice > 0 ? prev.avgPrice : p0 * 1.02
      const supplyPrev = prev?.quantitySupplied ?? qPrev

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

      const demand: LinearFn = { intercept: q0 - demandSlope * p0, slope: demandSlope }
      const supply: LinearFn = { intercept: q0 - supplySlope * p0, slope: supplySlope }

      const eq = solveIntersection(demand, supply, { q: q0, p: p0 })
      const policyPrice = p0
      const qdAtPolicy = Math.max(0, demandAtPrice(demand, policyPrice))
      const qsAtPolicy = Math.max(0, supplyAtPrice(supply, policyPrice))
      const tradedQty = Math.min(qdAtPolicy, qsAtPolicy)

      const dwl = eq.q > tradedQty ? 0.5 * (eq.q - tradedQty) * Math.max(0, demandPAtQ(demand, tradedQty) - supplyPAtQ(supply, tradedQty)) : 0

      return { round, dwl, roundIndex }
    }

    const roundsWithDWL = sorted.map((_, index) => calculateDWLForRound(index))
    const bestTeachingRound = roundsWithDWL.sort((a, b) => b.dwl - a.dwl)[0]

    // Use the round with highest DWL, or fallback to last round if none have DWL
    const selectedIndex = bestTeachingRound ? bestTeachingRound.roundIndex : sorted.length - 1
    const selected = sorted[selectedIndex]
    const previous = selectedIndex > 0 ? sorted[selectedIndex - 1] : null

    const curr = toSnapshot(selected)
    if (curr.quantitySold <= 0 || curr.avgPrice <= 0) return null

    const prev = previous ? toSnapshot(previous) : null
    const q0 = curr.quantitySold
    const p0 = curr.avgPrice
    const qPrev = prev?.quantitySold ?? q0 * 0.98
    const pPrev = prev?.avgPrice && prev.avgPrice > 0 ? prev.avgPrice : p0 * 1.02
    const supplyPrev = prev?.quantitySupplied ?? qPrev

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

    const demand: LinearFn = { intercept: q0 - demandSlope * p0, slope: demandSlope }
    const supply: LinearFn = { intercept: q0 - supplySlope * p0, slope: supplySlope }

    const eq = solveIntersection(demand, supply, { q: q0, p: p0 })

    // Use actual observed average market price as policy line (data-driven teaching anchor).
    const policyPrice = p0
    const qdAtPolicy = Math.max(0, demandAtPrice(demand, policyPrice))
    const qsAtPolicy = Math.max(0, supplyAtPrice(supply, policyPrice))
    const tradedQty = Math.min(qdAtPolicy, qsAtPolicy)

    const qMax = Math.max(eq.q, qdAtPolicy, qsAtPolicy, curr.quantityDemanded, curr.quantitySupplied, 1) * 1.2
    const qMin = 0

    const pAtQ0Demand = (qMin - demand.intercept) / demand.slope
    const pAtQMaxDemand = (qMax - demand.intercept) / demand.slope
    const pAtQ0Supply = (qMin - supply.intercept) / supply.slope
    const pAtQMaxSupply = (qMax - supply.intercept) / supply.slope
    const pMin = Math.max(1, Math.min(policyPrice, eq.p, pAtQMaxDemand, pAtQ0Supply, pAtQMaxSupply) * 0.85)
    const pMax = Math.max(pMin + 1, Math.max(policyPrice, eq.p, pAtQ0Demand, pAtQ0Supply) * 1.15)

    const steps = 48
    const data = Array.from({ length: steps + 1 }).map((_, i) => {
      const q = qMin + ((qMax - qMin) * i) / steps
      const demandP = clamp((q - demand.intercept) / demand.slope, pMin, pMax)
      const supplyP = clamp((q - supply.intercept) / supply.slope, pMin, pMax)

      const inTradeRange = q <= tradedQty
      const inDwlRange = q >= tradedQty && q <= eq.q

      const csBase = inTradeRange ? policyPrice : null
      const csFill = inTradeRange ? Math.max(0, demandP - policyPrice) : null

      const psBase = inTradeRange ? supplyP : null
      const psFill = inTradeRange ? Math.max(0, policyPrice - supplyP) : null

      const dwlBase = inDwlRange ? supplyP : null
      const dwlFill = inDwlRange ? Math.max(0, demandP - supplyP) : null

      return {
        q,
        demandP,
        supplyP,
        policyP: policyPrice,
        csBase,
        csFill,
        psBase,
        psFill,
        dwlBase,
        dwlFill,
      }
    })

    const consumerSurplus = 0.5 * tradedQty * Math.max(0, ((0 - demand.intercept) / demand.slope) - policyPrice)
    const producerSurplus = 0.5 * tradedQty * Math.max(0, policyPrice - ((0 - supply.intercept) / supply.slope))
    const deadweightLoss = eq.q > tradedQty ? 0.5 * (eq.q - tradedQty) * Math.max(0, demandPAtQ(demand, tradedQty) - supplyPAtQ(supply, tradedQty)) : 0

    return {
      selectedRound: curr.roundNumber,
      data,
      qMin,
      qMax,
      pMin,
      pMax,
      eq,
      policyPrice,
      qdAtPolicy,
      qsAtPolicy,
      tradedQty,
      consumerSurplus,
      producerSurplus,
      deadweightLoss,
    }
  }, [allRoundsData])

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
          3. Consumer Surplus & Deadweight Loss
        </h4>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          Not enough market data to derive surplus areas yet.
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
        3. Consumer Surplus & Deadweight Loss (Round {model.selectedRound})
      </h4>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '12px', fontSize: '0.9rem' }}>
        Automatically shows the round with highest deadweight loss for teaching. Policy/market price line uses actual observed average price ({formatCurrency(model.policyPrice)}). Equilibrium is E ({formatUnits(model.eq.q)}, {formatCurrency(model.eq.p)}).
      </p>

      <ResponsiveContainer width="100%" height={420}>
        <AreaChart data={model.data} margin={{ top: 44, right: 30, bottom: 48, left: 72 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
          <XAxis
            type="number"
            dataKey="q"
            domain={[model.qMin, model.qMax]}
            tick={{ fill: 'var(--text-secondary)' }}
            tickMargin={8}
            tickFormatter={(value) => formatUnits(value)}
          />
          <YAxis
            domain={[model.pMin, model.pMax]}
            tick={{ fill: 'var(--text-secondary)' }}
            tickMargin={8}
            tickFormatter={(value) => `$${Number(value).toFixed(0)}`}
            label={{ value: 'Price ($)', angle: -90, position: 'left', offset: 34, fill: 'var(--text-secondary)' }}
          />
          <Tooltip
            formatter={(value: unknown, key: string) => {
              const labels: Record<string, string> = {
                demandP: 'Demand',
                supplyP: 'Supply',
                policyP: 'Policy Price',
              }
              return [formatCurrency(Number(value)), labels[key] ?? key]
            }}
            labelFormatter={(value) => `Q: ${formatUnits(Number(value))}`}
            contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}
          />
          <Legend verticalAlign="top" align="center" wrapperStyle={{ top: 4 }} />

          <Area dataKey="csBase" stackId="cs" stroke="none" fill="transparent" connectNulls isAnimationActive={false} />
          <Area dataKey="csFill" stackId="cs" name="Consumer Surplus" stroke="none" fill="#f59e0b" fillOpacity={0.45} connectNulls isAnimationActive={false} />

          <Area dataKey="psBase" stackId="ps" stroke="none" fill="transparent" connectNulls isAnimationActive={false} />
          <Area dataKey="psFill" stackId="ps" name="Producer Surplus" stroke="none" fill="#06b6d4" fillOpacity={0.4} connectNulls isAnimationActive={false} />

          <Area dataKey="dwlBase" stackId="dwl" stroke="none" fill="transparent" connectNulls isAnimationActive={false} />
          <Area dataKey="dwlFill" stackId="dwl" name="Deadweight Loss" stroke="none" fill="#9ca3af" fillOpacity={0.45} connectNulls isAnimationActive={false} />

          <Line type="monotone" dataKey="demandP" name="Demand" stroke="#ef4444" strokeWidth={3} dot={false} connectNulls />
          <Line type="monotone" dataKey="supplyP" name="Supply" stroke="#3b82f6" strokeWidth={3} dot={false} connectNulls />
          <Line type="monotone" dataKey="policyP" name="Observed Price" stroke="#f97316" strokeWidth={2.2} strokeDasharray="6 4" dot={false} connectNulls />

          <ReferenceLine x={model.eq.q} stroke="#cbd5e1" strokeDasharray="4 4" label={{ value: 'Qe', fill: '#cbd5e1', position: 'insideTop' }} />
          <ReferenceLine y={model.eq.p} stroke="#cbd5e1" strokeDasharray="4 4" label={{ value: 'Pe', fill: '#cbd5e1', position: 'insideRight' }} />
          <ReferenceLine x={model.tradedQty} stroke="#fbbf24" strokeDasharray="4 4" label={{ value: 'Qt', fill: '#fbbf24', position: 'insideBottom' }} />
        </AreaChart>
      </ResponsiveContainer>
      <div style={{ textAlign: 'center', color: 'var(--text-secondary)', marginTop: '-2px', marginBottom: '8px' }}>Quantity</div>

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
        Consumer Surplus: {formatCurrency(model.consumerSurplus)}. Producer Surplus: {formatCurrency(model.producerSurplus)}. Deadweight Loss: {formatCurrency(model.deadweightLoss)}. If traded quantity ({formatUnits(model.tradedQty)}) is below equilibrium quantity ({formatUnits(model.eq.q)}), welfare is lost.
      </div>
    </div>
  )
}

function demandPAtQ(demand: LinearFn, q: number) {
  return (q - demand.intercept) / demand.slope
}

function supplyPAtQ(supply: LinearFn, q: number) {
  return (q - supply.intercept) / supply.slope
}
