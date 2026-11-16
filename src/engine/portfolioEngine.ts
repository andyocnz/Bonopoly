/**
 * Portfolio Monte Carlo Simulation Engine
 *
 * Generates synthetic calibrated market returns using normal distributions and regime switches.
 * Runs Monte Carlo simulations to evaluate investment strategies over market uncertainty.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PortfolioAllocation {
  stocks: number   // 0-100%
  bonds: number    // 0-100%
  cash: number     // 0-100%
  // Total must equal 100
}

export interface RiskControls {
  rebalance: boolean        // Rebalance to target allocation each round
  stopLoss: boolean         // Sell stocks if portfolio drops >15%
  defensiveShift: boolean   // Move to 70% bonds after losses
}

export interface MarketReturns {
  stocks: number   // e.g., -0.20 for -20%
  bonds: number    // e.g., 0.05 for +5%
  cash: number     // typically 0.01 (1% interest)
}

export interface PortfolioRound {
  round: number
  allocation: PortfolioAllocation
  marketReturns: MarketReturns
  portfolioValue: number
  gainLoss: number
  gainLossPercent: number
  regimeType: 'normal' | 'crash' | 'inflation' | null
}

export interface MonteCarloResult {
  trials: number
  finalWealth: number[]        // Array of final portfolio values
  medianWealth: number
  meanWealth: number
  targetProb: number           // Probability of hitting target ($140K)
  bigLossProb: number          // Probability of >20% drawdown
  sharpeRatio: number          // Risk-adjusted return
  percentile10: number         // Bottom 10%
  percentile90: number         // Top 10%
}

export interface PortfolioResult {
  rounds: PortfolioRound[]
  finalAllocation: PortfolioAllocation
  finalRiskControls: RiskControls
  monteCarlo: MonteCarloResult
  sharpeRatio: number
}

// ─── Constants ───────────────────────────────────────────────────────────────

export const STARTING_CAPITAL = 100000  // $100K
export const TARGET_WEALTH = 140000     // $140K (40% gain over 5 years ≈ 7% annual)
export const BIG_LOSS_THRESHOLD = 0.20  // 20% drawdown
export const CASH_RETURN = 0.01         // 1% per period (risk-free rate)
export const MONTE_CARLO_TRIALS = 1000  // Number of simulations
export const TOTAL_ROUNDS = 6           // 6 predefined economic scenarios

// ─── Synthetic Data Generation ──────────────────────────────────────────────

/**
 * Generate two correlated normal random variables using Box-Muller + Cholesky
 */
function generateCorrelatedNormals(correlation: number): { z1: number; z2: number } {
  // Box-Muller transform for standard normals
  const u1 = Math.random()
  const u2 = Math.random()
  const z1 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
  const z2Independent = Math.sqrt(-2 * Math.log(u1)) * Math.sin(2 * Math.PI * u2)

  // Apply correlation using Cholesky decomposition
  const z2 = correlation * z1 + Math.sqrt(1 - correlation * correlation) * z2Independent

  return { z1, z2 }
}

/**
 * Generate synthetic market returns calibrated from historical statistics
 * Uses normal distributions with regime switches for realistic market behavior
 */
export function generateSyntheticReturns(): { returns: MarketReturns; regimeType: 'normal' | 'crash' | 'inflation' | null } {
  // Calibrated parameters (monthly returns)
  const STOCK_MEAN = 0.007    // 0.7% per month ≈ 8.4% annual
  const STOCK_STD = 0.045     // 4.5% volatility per month
  const BOND_MEAN = 0.0025    // 0.25% per month ≈ 3% annual
  const BOND_STD = 0.015      // 1.5% volatility per month
  const CORRELATION = 0.2     // Low positive correlation
  const REGIME_PROB = 0.07    // 7% chance of regime switch per period

  // Generate correlated normal returns
  const { z1, z2 } = generateCorrelatedNormals(CORRELATION)
  let stockReturn = STOCK_MEAN + STOCK_STD * z1
  let bondReturn = BOND_MEAN + BOND_STD * z2
  let regimeType: 'normal' | 'crash' | 'inflation' | null = null

  // Check for regime switch (crash or inflation shock)
  if (Math.random() < REGIME_PROB) {
    const regimeRoll = Math.random()
    if (regimeRoll < 0.6) {
      // Crash regime: -20% to -30% for stocks
      stockReturn = -0.20 - Math.random() * 0.10
      bondReturn = 0.03 + Math.random() * 0.03  // Flight to safety
      regimeType = 'crash'
    } else {
      // Inflation shock: negative for bonds, mixed for stocks
      stockReturn = -0.05 - Math.random() * 0.10
      bondReturn = -0.02 - Math.random() * 0.02
      regimeType = 'inflation'
    }
  }

  return {
    returns: {
      stocks: stockReturn,
      bonds: bondReturn,
      cash: CASH_RETURN,
    },
    regimeType,
  }
}

// ─── Portfolio Simulation ────────────────────────────────────────────────────

/**
 * Run a single simulation with synthetic returns and strategy
 */
export function runSingleSimulation(
  numRounds: number,  // Number of periods to simulate
  initialAllocation: PortfolioAllocation,
  riskControls: RiskControls
): PortfolioRound[] {
  let portfolioValue = STARTING_CAPITAL
  let currentAllocation = { ...initialAllocation }
  const rounds: PortfolioRound[] = []

  let inDefensiveMode = false
  let stopLossTriggered = false

  for (let i = 0; i < numRounds; i++) {
    // Generate synthetic market returns for this period
    const { returns: marketReturns, regimeType } = generateSyntheticReturns()

    // Apply risk controls BEFORE market moves
    if (riskControls.defensiveShift && inDefensiveMode) {
      currentAllocation = { stocks: 20, bonds: 70, cash: 10 }
    }

    if (riskControls.stopLoss && stopLossTriggered) {
      // After stop-loss, go defensive (60% cash, 40% bonds)
      currentAllocation = { stocks: 0, bonds: 40, cash: 60 }
    }

    // Calculate portfolio return based on allocation
    const portfolioReturn =
      (currentAllocation.stocks / 100) * marketReturns.stocks +
      (currentAllocation.bonds / 100) * marketReturns.bonds +
      (currentAllocation.cash / 100) * marketReturns.cash

    const gainLoss = portfolioValue * portfolioReturn
    const newValue = portfolioValue + gainLoss

    rounds.push({
      round: i + 1,
      allocation: { ...currentAllocation },
      marketReturns,
      portfolioValue: newValue,
      gainLoss,
      gainLossPercent: portfolioReturn,
      regimeType,
    })

    // Check for stop-loss trigger
    if (riskControls.stopLoss && portfolioReturn < -0.15) {
      stopLossTriggered = true
    }

    // Check for defensive shift trigger
    if (riskControls.defensiveShift && portfolioReturn < 0) {
      inDefensiveMode = true
    } else if (riskControls.defensiveShift && portfolioReturn > 0) {
      inDefensiveMode = false
    }

    // Rebalance if enabled
    if (riskControls.rebalance && !stopLossTriggered) {
      currentAllocation = { ...initialAllocation }
    }

    portfolioValue = newValue
  }

  return rounds
}

/**
 * Run Monte Carlo simulation with synthetic returns
 * Each trial generates a new random path through market conditions
 */
export function runMonteCarloSimulation(
  baseAllocation: PortfolioAllocation,
  riskControls: RiskControls,
  numRounds: number = TOTAL_ROUNDS
): MonteCarloResult {
  const finalWealth: number[] = []

  for (let trial = 0; trial < MONTE_CARLO_TRIALS; trial++) {
    // Each trial generates fresh synthetic returns
    const rounds = runSingleSimulation(numRounds, baseAllocation, riskControls)
    const finalValue = rounds[rounds.length - 1].portfolioValue
    finalWealth.push(finalValue)
  }

  // Sort for percentile calculations
  finalWealth.sort((a, b) => a - b)

  const medianWealth = finalWealth[Math.floor(finalWealth.length / 2)]
  const meanWealth = finalWealth.reduce((sum, w) => sum + w, 0) / finalWealth.length
  const percentile10 = finalWealth[Math.floor(finalWealth.length * 0.1)]
  const percentile90 = finalWealth[Math.floor(finalWealth.length * 0.9)]

  // Calculate metrics
  const targetProb = finalWealth.filter(w => w >= TARGET_WEALTH).length / finalWealth.length
  const bigLossProb = finalWealth.filter(w => w < STARTING_CAPITAL * (1 - BIG_LOSS_THRESHOLD)).length / finalWealth.length

  // Sharpe ratio: (mean return - risk-free rate) / std deviation
  const avgReturn = (meanWealth - STARTING_CAPITAL) / STARTING_CAPITAL
  const variance = finalWealth.reduce((sum, w) => {
    const ret = (w - STARTING_CAPITAL) / STARTING_CAPITAL
    return sum + Math.pow(ret - avgReturn, 2)
  }, 0) / finalWealth.length
  const stdDev = Math.sqrt(variance)
  const riskFreeRate = Math.pow(1 + CASH_RETURN, numRounds) - 1
  const sharpeRatio = stdDev > 0 ? (avgReturn - riskFreeRate) / stdDev : 0

  return {
    trials: MONTE_CARLO_TRIALS,
    finalWealth,
    medianWealth,
    meanWealth,
    targetProb,
    bigLossProb,
    sharpeRatio,
    percentile10,
    percentile90,
  }
}

/**
 * Generate reference data: 1000 portfolio paths for visualization
 * Used in the reference panel to show the distribution of possible outcomes
 */
export function generateReferenceData(
  allocation: PortfolioAllocation,
  numRounds: number = TOTAL_ROUNDS,
  numPaths: number = 1000
): Array<{ path: number[]; finalValue: number }> {
  const paths: Array<{ path: number[]; finalValue: number }> = []

  for (let i = 0; i < numPaths; i++) {
    const path: number[] = [STARTING_CAPITAL]
    let value = STARTING_CAPITAL

    for (let round = 0; round < numRounds; round++) {
      const { returns } = generateSyntheticReturns()
      const portfolioReturn =
        (allocation.stocks / 100) * returns.stocks +
        (allocation.bonds / 100) * returns.bonds +
        (allocation.cash / 100) * returns.cash

      value = value * (1 + portfolioReturn)
      path.push(value)
    }

    paths.push({ path, finalValue: value })
  }

  return paths
}

// ─── Utilities ───────────────────────────────────────────────────────────────

/**
 * Validate allocation sums to 100%
 */
export function validateAllocation(allocation: PortfolioAllocation): boolean {
  const total = allocation.stocks + allocation.bonds + allocation.cash
  return Math.abs(total - 100) < 0.01  // Allow for floating point errors
}

/**
 * Calculate risk-adjusted score for leaderboard
 * Combines Sharpe ratio with target achievement
 */
export function calculateLeaderboardScore(result: MonteCarloResult): number {
  // Sharpe ratio weighted 60%, target prob weighted 40%
  const sharpeScore = Math.max(0, result.sharpeRatio) * 60
  const targetScore = result.targetProb * 40
  return sharpeScore + targetScore
}
