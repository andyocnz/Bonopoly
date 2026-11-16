
import React, { useMemo, useState } from 'react'
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { formatPercent } from '../engine/gameEngine'

interface MarketShareChartProps {
    teams: TeamShareRow[]
    currentTeamId?: string
    regionLabels: { us: string; asia: string; europe: string }
}

type RegionTab = 'global' | 'us' | 'asia' | 'europe'

type TeamShareRow = {
    teamId: string
    teamName: string
    unitsSold?: number
    unitsSoldUS?: number
    unitsSoldAsia?: number
    unitsSoldEurope?: number
}

type PieDataRow = {
    id: string
    name: string
    value: number
    isMe: boolean
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#6366f1', '#ec4899', '#8b5cf6', '#14b8a6', '#f43f5e']

export const MarketShareChart: React.FC<MarketShareChartProps> = ({ teams, currentTeamId, regionLabels }) => {
    const [region, setRegion] = useState<RegionTab>('global')

    const data = useMemo(() => {
        if (!teams || teams.length === 0) return []

        let totalMarket = 0
        const teamShares = teams.map(t => {
            let value = 0
            switch (region) {
                case 'us':
                    value = t.unitsSoldUS || 0
                    break
                case 'asia':
                    value = t.unitsSoldAsia || 0
                    break
                case 'europe':
                    value = t.unitsSoldEurope || 0
                    break
                case 'global':
                default:
                    value = t.unitsSold || 0
                    break
            }
            totalMarket += value
            return {
                id: t.teamId,
                name: t.teamName,
                value: value,
                isMe: t.teamId === currentTeamId
            }
        })

        // If no sales yet (e.g. Round -1), show equal shares
        if (totalMarket === 0) {
            return teamShares.map(t => ({ ...t, value: 1 }))
        }

        return teamShares.filter(t => t.value > 0).sort((a, b) => b.value - a.value)
    }, [teams, region, currentTeamId])

    const chartTitle = useMemo(() => {
        switch (region) {
            case 'us': return `Market Share (${regionLabels.us})`
            case 'asia': return `Market Share (${regionLabels.asia})`
            case 'europe': return `Market Share (${regionLabels.europe})`
            default: return 'Global Market Share'
        }
    }, [region, regionLabels])

    return (
        <div id="market-share" className="card">
            <div className="card-header" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                    <h2 className="card-title">{chartTitle}</h2>
                </div>

                {/* Region Tabs */}
                <div className="dm-timeline-track" style={{ width: '100%', padding: '4px', background: '#f1f5f9', borderRadius: '8px', display: 'flex', gap: '4px' }}>
                    {(['global', 'us', 'asia', 'europe'] as RegionTab[]).map((r) => (
                        <button
                            key={r}
                            onClick={() => setRegion(r)}
                            style={{
                                flex: 1,
                                border: 'none',
                                background: region === r ? '#fff' : 'transparent',
                                color: region === r ? '#0f172a' : '#64748b',
                                boxShadow: region === r ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
                                borderRadius: '6px',
                                padding: '4px 8px',
                                fontSize: '0.75rem',
                                fontWeight: region === r ? 600 : 500,
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                textTransform: 'capitalize'
                            }}
                        >
                            {r === 'global' ? 'Global' : r === 'us' ? 'US' : r === 'asia' ? 'Asia' : 'Europe'}
                        </button>
                    ))}
                </div>
            </div>

            <div className="card-body" style={{ height: '300px', padding: '0' }}>
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={data}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={2}
                            dataKey="value"
                            label={({ cx, cy, midAngle = 0, innerRadius, outerRadius, percent = 0 }) => {
                                const RADIAN = Math.PI / 180
                                const radius = innerRadius + (outerRadius - innerRadius) * 0.5
                                const x = cx + radius * Math.cos(-midAngle * RADIAN)
                                const y = cy + radius * Math.sin(-midAngle * RADIAN)

                                return (
                                    <text
                                        x={x}
                                        y={y}
                                        fill="var(--text-main, #0f172a)"
                                        textAnchor={x > cx ? 'start' : 'end'}
                                        dominantBaseline="central"
                                        fontSize="12"
                                        fontWeight="600"
                                    >
                                        {`${(percent * 100).toFixed(0)}%`}
                                    </text>
                                )
                            }}
                        >
                            {data.map((entry, index) => (
                                <Cell
                                    key={`cell-${index}`}
                                    fill={entry.isMe ? '#2563eb' : COLORS[index % COLORS.length]}
                                    stroke={entry.isMe ? '#1e40af' : 'none'}
                                    strokeWidth={entry.isMe ? 2 : 0}
                                />
                            ))}
                        </Pie>
                        <Tooltip
                            formatter={(value: number, _name: string, props: { payload?: PieDataRow }) => {
                                const total = data.reduce((sum, item) => sum + item.value, 0)
                                const percent = total > 0 ? (value / total) * 100 : 0
                                return [formatPercent(percent), props.payload?.name ?? 'Team']
                            }}
                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
                        />
                        <Legend
                            layout="horizontal"
                            verticalAlign="bottom"
                            align="center"
                            wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }}
                        />
                    </PieChart>
                </ResponsiveContainer>
            </div>
        </div>
    )
}
