import { useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine, ReferenceDot } from 'recharts'
import { formatUnits } from '../../engine/gameEngine'
import type { TeamRow } from '../../utils/normalizeTeamRow'

interface DemandShiftsChartProps {
  currentTeamData: TeamRow | null
  allRoundsData: Array<{ roundNumber: number; teams: TeamRow[]; marketDemand?: { us: number; asia: number; europe: number } }>
  regionLabels: { us: string; asia: string; europe: string }
}

type ShockPoint = {
  round: number
  roundLabel: string
  totalDemand: number
  deltaPct: number
  scenario: 'Boom' | 'Normal' | 'Recession'
}

function classifyScenario(deltaPct: number): ShockPoint['scenario'] {
  if (deltaPct >= 6) return 'Boom'
  if (deltaPct <= -6) return 'Recession'
  return 'Normal'
}

export function DemandShiftsChart({
  currentTeamData,
  allRoundsData,
  regionLabels,
}: DemandShiftsChartProps) {
  const chartData = useMemo(() => {
    void currentTeamData
    void regionLabels

    if (!allRoundsData || allRoundsData.length === 0) return null

    const base = allRoundsData
      .filter((round) => round.roundNumber >= 0 && round.marketDemand)
      .map((round) => {
        const marketDemand = round.marketDemand || { us: 0, asia: 0, europe: 0 }
        return {
          round: round.roundNumber,
          totalDemand: Math.max(0, marketDemand.us + marketDemand.asia + marketDemand.europe),
        }
      })
      .sort((a, b) => a.round - b.round)

    if (base.length === 0) return null

    const withScenario: ShockPoint[] = base.map((point, i) => {
      const prev = i > 0 ? base[i - 1] : null
      const deltaPct = prev && prev.totalDemand > 0
        ? ((point.totalDemand - prev.totalDemand) / prev.totalDemand) * 100
        : 0
      return {
        round: point.round,
        roundLabel: `R${point.round + 1}`,
        totalDemand: point.totalDemand,
        deltaPct,
        scenario: classifyScenario(deltaPct),
      }
    })

    return withScenario
  }, [allRoundsData, currentTeamData, regionLabels])

  if (!chartData || chartData.length === 0) {
    return (
      <div style={{
        padding: '24px',
        background: 'var(--bg-secondary)',
        borderRadius: '8px',
        border: '1px solid var(--border-color)',
        marginBottom: '24px',
      }}>
        <h4 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '12px', color: 'var(--text-main)' }}>
          1. Market Demand Over Time
        </h4>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          No market demand data available.
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
        1. Market Demand Over Time
      </h4>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '12px', fontSize: '0.9rem' }}>
        Total market demand only (all regions combined). Labels indicate likely cycle state from round-to-round demand shifts.
      </p>

      <ResponsiveContainer width="100%" height={420}>
        <LineChart data={chartData} margin={{ top: 70, right: 30, bottom: 46, left: 60 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
          <XAxis
            dataKey="roundLabel"
            stroke="var(--text-secondary)"
            tick={{ fill: 'var(--text-secondary)' }}
          />
          <YAxis
            stroke="var(--text-secondary)"
            tick={{ fill: 'var(--text-secondary)' }}
            tickFormatter={(value) => formatUnits(value)}
            label={{ value: 'Demand (units)', angle: -90, position: 'left', offset: 40, fill: 'var(--text-secondary)' }}
          />
          <Tooltip
            content={({ payload }) => {
              if (!payload || payload.length === 0) return null
              const data = payload[0].payload as ShockPoint
              return (
                <div style={{
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '4px',
                  padding: '12px',
                }}>
                  <p style={{ fontWeight: 700, marginBottom: '8px', color: 'var(--text-main)' }}>Round {data.round}</p>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    Total demand: {formatUnits(data.totalDemand)}
                  </p>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    Demand shift vs prior round: {data.deltaPct >= 0 ? '+' : ''}{data.deltaPct.toFixed(1)}%
                  </p>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    Scenario: {data.scenario}
                  </p>
                </div>
              )
            }}
          />
          <Legend verticalAlign="top" align="center" wrapperStyle={{ top: 4 }} />

          <ReferenceLine y={chartData[0].totalDemand} stroke="#94a3b8" strokeDasharray="4 4" ifOverflow="extendDomain" label={{ value: 'Baseline', fill: '#94a3b8', position: 'insideTopRight' }} />

          <Line
            type="monotone"
            dataKey="totalDemand"
            stroke="#3b82f6"
            strokeWidth={3}
            name="Total Demand"
            dot={{ fill: '#3b82f6', r: 5 }}
            activeDot={{ r: 6 }}
          />

          {chartData.map((point) => (
            <ReferenceDot
              key={`scenario-${point.round}`}
              x={point.roundLabel}
              y={point.totalDemand}
              r={0}
              fill="transparent"
              stroke="transparent"
              label={{
                value: point.scenario,
                position: 'top',
                offset: 14,
                fill: point.scenario === 'Boom' ? '#22c55e' : point.scenario === 'Recession' ? '#ef4444' : '#cbd5e1',
                fontSize: 12,
                fontWeight: 700,
              }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>

    </div>
  )
}
