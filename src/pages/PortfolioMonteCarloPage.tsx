import { useState, useMemo, useEffect } from 'react'
import { useTheme } from '../context/ThemeContext'
import {
  runSingleSimulation,
  runMonteCarloSimulation,
  generateReferenceData,
  validateAllocation,
  calculateLeaderboardScore,
  STARTING_CAPITAL,
  TARGET_WEALTH,
  type PortfolioAllocation,
  type RiskControls,
  type PortfolioRound,
  type MonteCarloResult,
} from '../engine/portfolioEngine'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import './PortfolioMonteCarloPage.css'

const INITIAL_ALLOCATION: PortfolioAllocation = {
  stocks: 60,
  bonds: 30,
  cash: 10,
}

const INITIAL_RISK_CONTROLS: RiskControls = {
  rebalance: true,
  stopLoss: false,
  defensiveShift: false,
}

const NUM_ROUNDS = 6

export default function PortfolioMonteCarloPage() {
  const { theme, toggleTheme } = useTheme()
  const [allocation, setAllocation] = useState<PortfolioAllocation>(INITIAL_ALLOCATION)
  const [riskControls, setRiskControls] = useState<RiskControls>(INITIAL_RISK_CONTROLS)
  const [rounds, setRounds] = useState<PortfolioRound[]>([])
  const [monteCarlo, setMonteCarlo] = useState<MonteCarloResult | null>(null)
  const [hasRun, setHasRun] = useState(false)
  const [referenceData, setReferenceData] = useState<Array<{ path: number[]; finalValue: number }>>([])

  useEffect(() => {
    const data = generateReferenceData(allocation, NUM_ROUNDS, 1000)
    setReferenceData(data)
  }, [allocation])

  const canStart = useMemo(() => validateAllocation(allocation), [allocation])

  const handleStart = () => {
    const gameRounds = runSingleSimulation(NUM_ROUNDS, allocation, riskControls)
    const mcResults = runMonteCarloSimulation(allocation, riskControls, NUM_ROUNDS)
    setRounds(gameRounds)
    setMonteCarlo(mcResults)
    setHasRun(true)
  }

  const handleSliderChange = (asset: keyof PortfolioAllocation, value: number) => {
    setAllocation({ ...allocation, [asset]: value })
  }

  const histogramData = useMemo(() => {
    if (!monteCarlo) return []
    const bucketSize = 5000
    const minWealth = Math.min(...monteCarlo.finalWealth)
    const maxWealth = Math.max(...monteCarlo.finalWealth)
    const bucketCount = Math.ceil((maxWealth - minWealth) / bucketSize)
    const data = []
    for (let i = 0; i < bucketCount; i++) {
      const bucketMin = minWealth + i * bucketSize
      const bucketMax = bucketMin + bucketSize
      const count = monteCarlo.finalWealth.filter((w) => w >= bucketMin && w < bucketMax).length
      data.push({ range: `$${Math.round(bucketMin / 1000)}K`, count })
    }
    return data
  }, [monteCarlo])

  const chartData = useMemo(() => {
    if (referenceData.length === 0) return []
    const sampleSize = 50
    const sampledPaths = referenceData.slice().sort(() => Math.random() - 0.5).slice(0, sampleSize)
    const numRounds = referenceData[0]?.path.length || 0
    const data = []
    for (let round = 0; round < numRounds; round++) {
      const point: any = { round: `Year ${round + 1}` }
      sampledPaths.forEach((pathData, idx) => {
        point[`path${idx}`] = pathData.path[round]
      })
      data.push(point)
    }
    return data
  }, [referenceData])

  const stats = useMemo(() => {
    if (referenceData.length === 0) return null
    const finalValues = referenceData.map((d) => d.finalValue).sort((a, b) => a - b)
    return {
      median: finalValues[Math.floor(finalValues.length / 2)],
      p10: finalValues[Math.floor(finalValues.length * 0.1)],
      p90: finalValues[Math.floor(finalValues.length * 0.9)],
    }
  }, [referenceData])

  const avgReturn = monteCarlo ? (monteCarlo.medianWealth / 1000).toFixed(2) : '0'
  const chanceOfLoss = monteCarlo ? ((monteCarlo.finalWealth.filter(w => w < STARTING_CAPITAL).length / monteCarlo.finalWealth.length) * 100).toFixed(1) : '0.0'

  return (
    <div className="portfolio-container">
      {/* Top Bar */}
      <div className="portfolio-top-bar">
        <div className="top-left">
          <h2>Investment Portfolio Simulation</h2>
          <p>Adjust your portfolio to achieve an average return of $120 with a 5% chance of loss.</p>
        </div>
        <button type="button" className="theme-toggle-btn" onClick={toggleTheme}>
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
      </div>

      {/* Asset Allocation Section (Full Width) */}
      <div className="allocation-section">
        <div className="allocation-header">
          <h3>ASSET ALLOCATION</h3>
          <p>You have <strong>${(STARTING_CAPITAL / 1000).toFixed(0)}K</strong> to invest over <strong>{NUM_ROUNDS} periods</strong>.
          Adjust your asset mix below. Goal: Grow to <strong>${(TARGET_WEALTH / 1000).toFixed(0)}K</strong> while protecting against losses.</p>
        </div>

        <div className="allocation-sliders">
          <div className="slider-item">
            <div className="slider-label">
              <span>📈 Stocks</span>
              <span className="slider-value">{allocation.stocks}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={allocation.stocks}
              onChange={(e) => handleSliderChange('stocks', Number(e.target.value))}
              className="slider slider-stocks"
            />
            <p className="slider-desc">Higher returns, higher volatility</p>
          </div>

          <div className="slider-item">
            <div className="slider-label">
              <span>🏦 Bonds</span>
              <span className="slider-value">{allocation.bonds}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={allocation.bonds}
              onChange={(e) => handleSliderChange('bonds', Number(e.target.value))}
              className="slider slider-bonds"
            />
            <p className="slider-desc">Moderate returns, lower volatility</p>
          </div>

          <div className="slider-item">
            <div className="slider-label">
              <span>💵 Cash</span>
              <span className="slider-value">{allocation.cash}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={allocation.cash}
              onChange={(e) => handleSliderChange('cash', Number(e.target.value))}
              className="slider slider-cash"
            />
            <p className="slider-desc">Safe, minimal returns</p>
          </div>

          <div className="slider-item-total">
            <div className={`total-badge ${validateAllocation(allocation) ? 'valid' : 'invalid'}`}>
              Total: {allocation.stocks + allocation.bonds + allocation.cash}%
              {!validateAllocation(allocation) && ' ⚠️ Must equal 100%'}
            </div>
          </div>
        </div>
      </div>

      {/* Main Split View */}
      <div className="portfolio-split-view">
        {/* Left Panel: Simulation (Dark) */}
        <div className="simulation-panel">
          {/* Risk Controls */}
          <div className="risk-controls">
            <h3>RISK CONTROLS</h3>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={riskControls.rebalance}
                onChange={(e) => setRiskControls({ ...riskControls, rebalance: e.target.checked })}
              />
              <span>Rebalance</span>
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={riskControls.stopLoss}
                onChange={(e) => setRiskControls({ ...riskControls, stopLoss: e.target.checked })}
              />
              <span>Stop-Loss (-15%)</span>
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={riskControls.defensiveShift}
                onChange={(e) => setRiskControls({ ...riskControls, defensiveShift: e.target.checked })}
              />
              <span>Defensive Shift</span>
            </label>
          </div>

          {/* Run Button */}
          <button
            type="button"
            onClick={handleStart}
            disabled={!canStart}
            className="run-btn"
          >
            Run Simulation
          </button>

          {/* Results */}
          {hasRun && monteCarlo && (
            <>
              <div className="metrics-row">
                <div className="metric-box">
                  <div className="metric-label">Average Return</div>
                  <div className="metric-value highlight">${avgReturn}K</div>
                </div>
                <div className="metric-box">
                  <div className="metric-label">Chance of Loss</div>
                  <div className="metric-value">{chanceOfLoss}%</div>
                </div>
              </div>

              {/* Histogram */}
              <div className="chart-wrapper">
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={histogramData}>
                    <XAxis dataKey="range" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                    <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} />
                    <Bar dataKey="count" fill="#60a5fa" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Line Chart */}
              <div className="chart-wrapper">
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                    <XAxis dataKey="round" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                    <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} />
                    {Array.from({ length: 50 }).map((_, idx) => (
                      <Line
                        key={idx}
                        type="monotone"
                        dataKey={`path${idx}`}
                        stroke={idx < 3 ? '#f59e0b' : '#64748b'}
                        strokeWidth={idx < 3 ? 2 : 1}
                        dot={false}
                        legendType="none"
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Allocation Bar - Only 3 assets */}
              <div className="allocation-bar-section">
                <div className="allocation-labels">
                  <span>US Stocks<br/>{allocation.stocks}%</span>
                  <span>Global Bonds<br/>{allocation.bonds}%</span>
                  <span>Cash Equivalents<br/>{allocation.cash}%</span>
                </div>
                <div className="allocation-bar">
                  <div className="seg seg-stocks" style={{ width: `${allocation.stocks}%` }}></div>
                  <div className="seg seg-bonds" style={{ width: `${allocation.bonds}%` }}></div>
                  <div className="seg seg-cash" style={{ width: `${allocation.cash}%` }}></div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Right Panel: Reference Data (Light) */}
        <div className="data-panel">
          <h3>Reference Data</h3>

          {/* Simulation Statistics */}
          {stats && (
            <>
              <div className="stats-section">
                <h4>1,000 Simulated Paths</h4>
                <div className="stats-grid">
                  <div className="stat-item">
                    <div className="stat-name">Median Outcome</div>
                    <div className="stat-val">${Math.round(stats.median / 1000)}K</div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-name">10th Percentile</div>
                    <div className="stat-val danger">${Math.round(stats.p10 / 1000)}K</div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-name">90th Percentile</div>
                    <div className="stat-val success">${Math.round(stats.p90 / 1000)}K</div>
                  </div>
                </div>
              </div>

              {/* Current Allocation Breakdown */}
              <div className="stats-section">
                <h4>Your Current Allocation</h4>
                <div className="allocation-breakdown">
                  <div className="alloc-row">
                    <span className="alloc-name">📈 US Stocks</span>
                    <span className="alloc-pct">{allocation.stocks}%</span>
                    <div className="alloc-bar-mini">
                      <div className="alloc-fill stocks-fill" style={{ width: `${allocation.stocks}%` }}></div>
                    </div>
                  </div>
                  <div className="alloc-row">
                    <span className="alloc-name">🏦 Global Bonds</span>
                    <span className="alloc-pct">{allocation.bonds}%</span>
                    <div className="alloc-bar-mini">
                      <div className="alloc-fill bonds-fill" style={{ width: `${allocation.bonds}%` }}></div>
                    </div>
                  </div>
                  <div className="alloc-row">
                    <span className="alloc-name">💵 Cash</span>
                    <span className="alloc-pct">{allocation.cash}%</span>
                    <div className="alloc-bar-mini">
                      <div className="alloc-fill cash-fill" style={{ width: `${allocation.cash}%` }}></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Synthetic Data Info */}
              <div className="stats-section">
                <h4>Data Model</h4>
                <div className="data-info">
                  <p><strong>Asset Returns:</strong> Normal distributions calibrated to historical stats</p>
                  <ul>
                    <li>Stocks: 0.7% monthly mean, higher volatility</li>
                    <li>Bonds: 0.25% monthly mean, lower volatility</li>
                    <li>Cash: Near-zero return, minimal risk</li>
                  </ul>
                  <p><strong>Market Scenarios:</strong> ~7% chance per period of:</p>
                  <ul>
                    <li>Market crash (-20% to -30%)</li>
                    <li>Inflation shock (bonds underperform)</li>
                  </ul>
                  <p><strong>Correlation:</strong> Assets move together during extreme events (crash/inflation)</p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

    </div>
  )
}
