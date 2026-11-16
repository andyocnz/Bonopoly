import { useMemo } from 'react'
import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Scatter, Tooltip, XAxis, YAxis } from 'recharts'
import { formatCurrency, formatUnits } from '../../engine/gameEngine'
import type { TeamRow } from '../../utils/normalizeTeamRow'

interface PriceElasticityChartProps {
  allRoundsData: Array<{ roundNumber: number; teams: TeamRow[] }>
}

type Observation = {
  round: number
  teamId: string
  teamName: string
  price: number
  quantity: number
}

type AnchorPoint = {
  quantity: number
  price: number
  label: string
}

function quantile(values: number[], q: number) {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const pos = (sorted.length - 1) * q
  const base = Math.floor(pos)
  const rest = pos - base
  const next = sorted[Math.min(base + 1, sorted.length - 1)]
  return sorted[base] + rest * (next - sorted[base])
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function evaluateQuadraticThroughThreePoints(q: number, p0: AnchorPoint, p1: AnchorPoint, p2: AnchorPoint) {
  const q0 = p0.quantity
  const q1 = p1.quantity
  const q2 = p2.quantity

  const l0 = ((q - q1) * (q - q2)) / ((q0 - q1) * (q0 - q2))
  const l1 = ((q - q0) * (q - q2)) / ((q1 - q0) * (q1 - q2))
  const l2 = ((q - q0) * (q - q1)) / ((q2 - q0) * (q2 - q1))
  return p0.price * l0 + p1.price * l1 + p2.price * l2
}

export function PriceElasticityChart({
  allRoundsData,
}: PriceElasticityChartProps) {
  const model = useMemo(() => {
    if (!Array.isArray(allRoundsData)) return null

    const rawPoints: Observation[] = allRoundsData
      .filter((round) => round.roundNumber >= 0)
      .sort((a, b) => a.roundNumber - b.roundNumber)
      .flatMap((round) => {
        const teams = round.teams ?? []
        return teams.map((team) => {
          const quantity = team.unitsSold ?? 0
          const revenue = (team.revenueUS ?? 0) + (team.revenueAsia ?? 0) + (team.revenueEurope ?? 0)
          const price = quantity > 0 ? revenue / quantity : 0
          return {
            round: round.roundNumber,
            teamId: team.teamId,
            teamName: team.teamName,
            price,
            quantity,
          }
        })
      })
      .filter((point) => point.price > 0 && point.quantity > 0)

    if (rawPoints.length < 6) return null

    // Outlier filter (IQR) so anchors are stable/teachable.
    const qVals = rawPoints.map((p) => p.quantity)
    const pVals = rawPoints.map((p) => p.price)
    const q1 = quantile(qVals, 0.25)
    const q3 = quantile(qVals, 0.75)
    const p1 = quantile(pVals, 0.25)
    const p3 = quantile(pVals, 0.75)
    const qIqr = Math.max(1, q3 - q1)
    const pIqr = Math.max(1, p3 - p1)

    const cleaned = rawPoints.filter((p) =>
      p.quantity >= q1 - 1.5 * qIqr &&
      p.quantity <= q3 + 1.5 * qIqr &&
      p.price >= p1 - 1.5 * pIqr &&
      p.price <= p3 + 1.5 * pIqr
    )

    if (cleaned.length < 6) return null

    const byQuantity = [...cleaned].sort((a, b) => a.quantity - b.quantity)
    const midIndex = Math.floor(byQuantity.length / 2)
    const lowQtyHalf = byQuantity.slice(0, Math.max(2, midIndex))
    const highQtyHalf = byQuantity.slice(Math.max(1, midIndex), byQuantity.length)

    // 1) Highest price in low-quantity half (low demand)
    const highPriceLowDemand = [...lowQtyHalf].sort((a, b) => b.price - a.price)[0]
    // 2) Lowest price in high-quantity half (high demand)
    const lowPriceHighDemand = [...highQtyHalf].sort((a, b) => a.price - b.price)[0]

    if (!highPriceLowDemand || !lowPriceHighDemand) return null

    const qLeft = Math.min(highPriceLowDemand.quantity, lowPriceHighDemand.quantity)
    const qRight = Math.max(highPriceLowDemand.quantity, lowPriceHighDemand.quantity)

    const middleCandidates = cleaned.filter((p) => p.quantity >= qLeft && p.quantity <= qRight)
    const midTargetQ = (qLeft + qRight) / 2
    const middleRaw = (middleCandidates.length > 0 ? middleCandidates : cleaned)
      .sort((a, b) => Math.abs(a.quantity - midTargetQ) - Math.abs(b.quantity - midTargetQ))[0]

    if (!middleRaw) return null

    const anchorsUnsorted: AnchorPoint[] = [
      { quantity: highPriceLowDemand.quantity, price: highPriceLowDemand.price, label: 'High price / low demand' },
      { quantity: middleRaw.quantity, price: middleRaw.price, label: 'Middle' },
      { quantity: lowPriceHighDemand.quantity, price: lowPriceHighDemand.price, label: 'Low price / high demand' },
    ]

    const anchors = [...anchorsUnsorted].sort((a, b) => a.quantity - b.quantity)

    // Ensure strict increasing x for quadratic interpolation.
    if (
      Math.abs(anchors[1].quantity - anchors[0].quantity) < 1 ||
      Math.abs(anchors[2].quantity - anchors[1].quantity) < 1
    ) return null

    const qMin = Math.max(0, anchors[0].quantity * 0.9)
    const qMax = anchors[2].quantity * 1.1

    const rawCurve = Array.from({ length: 60 }).map((_, i) => {
      const quantity = qMin + ((qMax - qMin) * i) / 59
      return {
        quantity,
        price: evaluateQuadraticThroughThreePoints(quantity, anchors[0], anchors[1], anchors[2]),
      }
    })

    const pCurveVals = rawCurve.map((p) => p.price).filter((v) => Number.isFinite(v))
    const pDataMin = Math.min(...anchors.map((a) => a.price), ...pCurveVals)
    const pDataMax = Math.max(...anchors.map((a) => a.price), ...pCurveVals)
    const pMin = Math.max(1, pDataMin * 0.9)
    const pMax = Math.max(pMin + 1, pDataMax * 1.1)

    const curve = rawCurve.map((p) => ({
      quantity: p.quantity,
      price: clamp(p.price, pMin, pMax),
    }))

    const arcElasticityApprox = (() => {
      const left = anchors[0]
      const right = anchors[2]
      const dq = right.quantity - left.quantity
      const dp = right.price - left.price
      const qAvg = (left.quantity + right.quantity) / 2
      const pAvg = (left.price + right.price) / 2
      if (Math.abs(dp) < 1e-9 || qAvg <= 0 || pAvg <= 0) return 0
      return (dq / qAvg) / (dp / pAvg)
    })()

    const eAbs = Math.abs(arcElasticityApprox)
    const elasticityLabel = eAbs > 1.05 ? 'Elastic' : eAbs < 0.95 ? 'Inelastic' : 'Unit Elastic'

    const inelasticCut = anchors[1].quantity
    const elasticCut = anchors[2].quantity

    return {
      rawCount: rawPoints.length,
      usedCount: cleaned.length,
      anchors,
      curve,
      qMin,
      qMax,
      pMin,
      pMax,
      inelasticCut,
      elasticCut,
      arcElasticityApprox,
      elasticityLabel,
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
          2. Price Elasticity of Demand
        </h4>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          Need more stable team-round data points to build a teaching curve.
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
        2. Price Elasticity of Demand
      </h4>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '12px', fontSize: '0.9rem' }}>
        Uses 3 representative anchors from cleaned game data: highest-price low-demand, middle, and lowest-price high-demand. Approx. elasticity: {model.arcElasticityApprox.toFixed(2)} ({model.elasticityLabel}).
      </p>

      <ResponsiveContainer width="100%" height={420}>
        <LineChart data={model.curve} margin={{ top: 44, right: 36, bottom: 48, left: 72 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
          <XAxis
            type="number"
            dataKey="quantity"
            domain={[model.qMin, model.qMax]}
            tick={{ fill: 'var(--text-secondary)' }}
            tickMargin={8}
            tickFormatter={(value) => formatUnits(value)}
          />
          <YAxis
            type="number"
            dataKey="price"
            domain={[model.pMin, model.pMax]}
            tick={{ fill: 'var(--text-secondary)' }}
            tickMargin={8}
            tickFormatter={(value) => `$${Number(value).toFixed(0)}`}
            label={{ value: 'Price ($)', angle: -90, position: 'left', offset: 34, fill: 'var(--text-secondary)' }}
          />
          <Tooltip
            formatter={(value: unknown, key: string) => [formatCurrency(Number(value)), key === 'price' ? 'Price' : key]}
            labelFormatter={(value) => `Quantity: ${formatUnits(Number(value))}`}
            contentStyle={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: 6,
              color: 'var(--text-main)',
            }}
            labelStyle={{ color: 'var(--text-main)', fontWeight: 700 }}
            itemStyle={{ color: 'var(--text-main)' }}
          />
          <Legend verticalAlign="top" align="center" wrapperStyle={{ top: 4 }} />

          <ReferenceLine x={model.inelasticCut} stroke="#94a3b8" strokeDasharray="4 4" label={{ value: 'Inelastic', fill: '#cbd5e1', position: 'insideTop' }} />
          <ReferenceLine x={model.elasticCut} stroke="#94a3b8" strokeDasharray="4 4" label={{ value: 'Elastic', fill: '#cbd5e1', position: 'insideBottom' }} />

          <Line
            type="monotone"
            dataKey="price"
            name="Demand curve"
            stroke="#0ea5e9"
            strokeWidth={3}
            dot={false}
            isAnimationActive={false}
          />
          <Scatter
            data={model.anchors}
            name="Anchor points"
            fill="#22c55e"
          />
        </LineChart>
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
        This chart intentionally prioritizes teachability: a clean curve through 3 meaningful anchors, while still deriving those anchors from your game data.
      </div>
    </div>
  )
}
