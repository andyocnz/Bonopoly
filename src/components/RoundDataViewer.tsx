import { useState } from 'react'
import type { SimulationRoundResult, TeamFinalStanding } from '../engine/strategySimulation'

interface RoundDataViewerProps {
  results: {
    rounds: SimulationRoundResult[]
    finalStandings: TeamFinalStanding[]
    config?: unknown
    insights?: unknown
  } | null
  isDarkMode?: boolean
}

export function RoundDataViewer({ results, isDarkMode = false }: RoundDataViewerProps) {
  const [selectedTeam, setSelectedTeam] = useState<number | 'all'>('all')

  if (!results || !results.rounds || results.rounds.length === 0) {
    return null
  }

  const teams = results.rounds[0]?.teams || []
  const rounds = results.rounds

  return (
    <div className={`rdv-card ${isDarkMode ? 'rdv-dark' : 'rdv-light'}`}>
      <div className="rdv-header">
        <h3 className="rdv-title">Round-by-Round Data Inspector</h3>
        <div className="rdv-filter">
          <label className="rdv-filter-label">Filter Team:</label>
          <select
            className="rdv-filter-select"
            value={selectedTeam}
            onChange={(e) => setSelectedTeam(e.target.value === 'all' ? 'all' : Number(e.target.value))}
          >
            <option value="all">All Teams</option>
            {teams.map(team => (
              <option key={team.teamId} value={team.teamId}>
                {team.teamName} ({team.strategyId})
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="rdv-table-wrap">
        <table className="rdv-table">
          <thead>
            <tr>
              <th>Round</th>
              <th>Team</th>
              <th>Strategy</th>
              <th className="rdv-col-price">Price US</th>
              <th className="rdv-col-price">Price Asia</th>
              <th className="rdv-col-price">Price EU</th>
              <th className="rdv-col-revenue">Revenue</th>
              <th className="rdv-col-units">Units Sold</th>
              <th className="rdv-col-share">Avg Mkt Share</th>
              <th>Prod US</th>
              <th>Prod Asia</th>
              <th>Inv US</th>
              <th>Inv Asia</th>
              <th>Net Profit</th>
              <th>Share Price</th>
            </tr>
          </thead>
          <tbody>
            {rounds.map(round =>
              round.teams
                .filter(team => selectedTeam === 'all' || team.teamId === selectedTeam)
                .map(team => {
                  const isExtreme = Math.abs(team.profit || 0) > 1000000000000 ||
                                    (team.sharePrice || 0) > 1000000

                  // Check for near-zero prices
                  const hasNearZeroPrice = (team.prices?.us || 0) < 0.01 ||
                                           (team.prices?.asia || 0) < 0.01 ||
                                           (team.prices?.europe || 0) < 0.01

                  return (
                    <tr
                      key={`${round.round}-${team.teamId}`}
                      className={[
                        team.teamId % 2 === 0 ? 'rdv-row-even' : 'rdv-row-odd',
                        isExtreme ? 'rdv-row-extreme' : '',
                        hasNearZeroPrice ? 'rdv-row-warn' : '',
                      ].filter(Boolean).join(' ')}
                    >
                      <td className="rdv-cell-center">
                        {round.round}
                      </td>
                      <td>
                        {team.teamName}
                      </td>
                      <td className="rdv-cell-strategy">
                        {team.strategyId}
                      </td>
                      <td className="rdv-cell-num">
                        {team.prices?.us !== undefined ? formatNumber(team.prices.us) : 'N/A'}
                      </td>
                      <td className="rdv-cell-num">
                        {team.prices?.asia !== undefined ? formatNumber(team.prices.asia) : 'N/A'}
                      </td>
                      <td className="rdv-cell-num">
                        {team.prices?.europe !== undefined ? formatNumber(team.prices.europe) : 'N/A'}
                      </td>
                      <td className="rdv-cell-num">
                        {team.revenue !== undefined ? formatNumber(team.revenue) : 'N/A'}
                      </td>
                      <td className="rdv-cell-int">
                        {team.unitsSold !== undefined ? team.unitsSold.toLocaleString() : 'N/A'}
                      </td>
                      <td className="rdv-cell-num">
                        {team.avgMarketShare !== undefined ? formatNumber(team.avgMarketShare) : 'N/A'}
                      </td>
                      <td className="rdv-cell-int">
                        {team.production?.us !== undefined ? team.production.us.toLocaleString() : 'N/A'}
                      </td>
                      <td className="rdv-cell-int">
                        {team.production?.asia !== undefined ? team.production.asia.toLocaleString() : 'N/A'}
                      </td>
                      <td className="rdv-cell-int">
                        {team.inventory?.us !== undefined ? team.inventory.us.toLocaleString() : 'N/A'}
                      </td>
                      <td className="rdv-cell-int">
                        {team.inventory?.asia !== undefined ? team.inventory.asia.toLocaleString() : 'N/A'}
                      </td>
                      <td className="rdv-cell-num">
                        {team.profit !== undefined ? formatNumber(team.profit) : 'N/A'}
                      </td>
                      <td className="rdv-cell-num">
                        {team.sharePrice !== undefined ? formatNumber(team.sharePrice) : 'N/A'}
                      </td>
                    </tr>
                  )
                })
            )}
          </tbody>
        </table>
      </div>

      <div className="rdv-legend">
        <strong>Legend:</strong>
        <span className="rdv-legend-extreme">Red background = Extreme values (profit &gt; $1T or price &gt; $1M)</span>
        <span className="rdv-legend-warn">Yellow background = Near-zero prices (&lt; $0.01)</span>
      </div>
    </div>
  )
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return 'NaN'

  const absValue = Math.abs(value)

  // Show scientific notation for very large or very small numbers
  if (absValue >= 1e12 || (absValue < 0.01 && absValue > 0)) {
    return value.toExponential(2)
  }

  // Show 2 decimal places for prices
  if (absValue < 10000) {
    return value.toFixed(2)
  }

  // Show as integer with commas for large round numbers
  return value.toLocaleString(undefined, { maximumFractionDigits: 0 })
}
