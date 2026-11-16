// ── Simulation Charts Component ──
// 2x2 grid of real-time Recharts LineCharts, configurable per model.

import { useMemo } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import type { ChartConfig, TimeSeriesPoint } from '../../types/minsky'

interface SimulationChartsProps {
  chartConfigs: ChartConfig[]
  history: TimeSeriesPoint[]
  variableNames: Record<string, string>  // id → display name
}

const DEFAULT_COLORS = ['#2563eb', '#dc2626', '#16a34a', '#f59e0b', '#7c3aed', '#ec4899']

export function SimulationCharts({
  chartConfigs,
  history,
  variableNames,
}: SimulationChartsProps) {
  // Transform history into chart-friendly format
  const chartDataSets = useMemo(() => {
    return chartConfigs.map(config => {
      return history.map(point => {
        const datum: Record<string, number> = { t: point.t }
        for (const varId of config.variables) {
          datum[varId] = point.values[varId] ?? 0
        }
        return datum
      })
    })
  }, [chartConfigs, history])

  if (chartConfigs.length === 0) {
    return <div className="minsky-charts-empty">No charts configured</div>
  }

  if (history.length === 0) {
    return <div className="minsky-charts-empty">No data yet. Click Step or Play to generate data.</div>
  }

  return (
    <div className="minsky-charts-grid">
      {chartConfigs.map((config, index) => (
        <div key={config.id} className="minsky-chart-panel">
          <h4 className="minsky-chart-title">{config.title}</h4>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart
              data={chartDataSets[index]}
              margin={{ top: 5, right: 10, left: 10, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--minsky-grid, #333)" />
              <XAxis
                dataKey="t"
                label={{ value: 'Years', position: 'insideBottomRight', offset: -5, style: { fontSize: 10 } }}
                tick={{ fontSize: 9 }}
                stroke="var(--minsky-axis, #888)"
              />
              <YAxis
                label={
                  config.yAxisLabel
                    ? { value: config.yAxisLabel, angle: -90, position: 'insideLeft', offset: 5, style: { fontSize: 9 } }
                    : undefined
                }
                tick={{ fontSize: 9 }}
                stroke="var(--minsky-axis, #888)"
                width={50}
              />
              <Tooltip
                contentStyle={{
                  background: 'var(--minsky-tooltip-bg, #1a1a2e)',
                  border: '1px solid var(--minsky-border, #333)',
                  fontSize: 11,
                }}
                labelFormatter={(label) => `t = ${Number(label).toFixed(1)} years`}
                formatter={(value: number) => value.toFixed(2)}
              />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              {config.variables.map((varId, vi) => (
                <Line
                  key={varId}
                  type="monotone"
                  dataKey={varId}
                  name={variableNames[varId] ?? varId}
                  stroke={config.colors?.[vi] ?? DEFAULT_COLORS[vi % DEFAULT_COLORS.length]}
                  strokeWidth={1.5}
                  dot={false}
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      ))}
    </div>
  )
}
