import {
    calculateRoundMinus1,
    getBalancedStartingFinancials,
    type GameConfig
} from '../engine/gameEngine'

type FinancialGameLike = {
    totalTeams?: number
    teams?: unknown[]
    scenarioSequence?: number[]
    marketDemandMultiplier?: number
    regionDemandSplit?: { us: number; asia: number; europe: number }
}

export function calculateStartingFinancials(game: FinancialGameLike, gameConfig: GameConfig) {
    const teamCount = game.totalTeams ?? game.teams?.length ?? 1
    const scenarioSequence = game.scenarioSequence ?? [0]
    const marketDemandMultiplier = game.marketDemandMultiplier ?? 1
    const regionDemandSplit = game.regionDemandSplit

    // Run the game engine to calculate round -1 results
    const roundMinus1Results = calculateRoundMinus1(
        teamCount,
        gameConfig,
        scenarioSequence,
        marketDemandMultiplier,
        regionDemandSplit
    )

    // Get results for the first team (all are identical in Round -1)
    const teamResult = roundMinus1Results.teams[0]
    if (!teamResult) return null

    const pnl = teamResult.pnl || {}
    const balanceSheet = teamResult.balanceSheet || {}
    const costs = teamResult.costs || {}

    // Get starting financials for balance sheet display
    const startingFinancialsForPosition = getBalancedStartingFinancials(gameConfig)
    const startingSharePrice = gameConfig.financial.startingSharePrice
    const sharesOutstanding = startingFinancialsForPosition.sharesOutstanding

    // Extract P&L
    const revenue = pnl.revenue ?? 0
    const cogs = pnl.cogs ?? 0
    const grossProfit = pnl.grossProfit ?? 0
    const operatingExpenses = pnl.operatingExpenses ?? 0
    const ebitda = pnl.ebitda ?? 0
    const depreciation = pnl.depreciation ?? costs.depreciation ?? 0
    const interest = pnl.interestExpense ?? costs.interest ?? 0
    const tax = pnl.tax ?? 0
    const ebit = pnl.ebit ?? (ebitda - depreciation)
    const netProfit = pnl.netProfit ?? 0

    // Derive Cash & Share Price from starting position
    // Note: We use the "Balanced Starting Financials" for the Cash Balance & Share Price 
    // because that represents the "Day 1" state available to the user,
    // whereas roundMinus1Results might effectively be "Day 0" operations.
    // However, check if ResultsModernPage uses calculated or starting?
    // ResultsModernPage uses `balancedBS.cash` which comes from `balanceSheet.cash ?? startingFinancials.startingCash`.
    // So it prefers the ROUND -1 result if available?
    // Let's use the explicit calculated values to match ResultsModernPage.

    const cash = balanceSheet.cash ?? startingFinancialsForPosition.startingCash

    return {
        revenue,
        cogs,
        grossProfit,
        grossMargin: revenue > 0 ? (grossProfit / revenue) * 100 : 0,
        operatingExpenses,
        ebitda,
        depreciation,
        ebit,
        interestExpense: interest,
        tax,
        netProfit,
        netMargin: revenue > 0 ? (netProfit / revenue) * 100 : 0,
        cash,
        sharePrice: startingSharePrice,
        sharesOutstanding
    }
}
