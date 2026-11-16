import { useMemo } from 'react'
import {
  getBalancedStartingFinancials,
  getStartingMarketShare,
  getStartingUnitCost,
  calculateMarketDemand,
  calculateRoundMinus1,
} from '../engine/gameEngine'
import type { GameConfig } from '../engine/gameEngine'

type ReviewParams = {
  game: ReviewGame | null
  gameState: unknown
  team: ReviewTeam | null
  fetchedResults: ReviewRoundResult[]
  gameConfig: GameConfig
  /** Optional: override which round to review. If not provided, defaults to currentRound - 1 */
  selectedReviewRound?: number | null
}

type ReviewTeam = { id?: string; [key: string]: unknown }
type ReviewGame = {
  currentRound?: number
  totalTeams?: number
  teams?: Array<{ id: string; name: string; [key: string]: unknown }>
  scenarioSequence?: number[]
  marketDemandMultiplier?: number
  regionDemandSplit?: { us?: number; asia?: number; europe?: number }
  capacityPerFactory?: number
  [key: string]: unknown
}
type ReviewRoundResult = {
  roundNumber: number
  marketDemand?: { us: number; asia: number; europe: number }
  teams?: TeamRoundResult[]
  [key: string]: unknown
}
type TeamRoundResult = {
  id?: string
  teamId?: string
  name?: string
  teamName?: string
  fullResults?: Record<string, unknown>
  gameState?: Record<string, unknown>
  decisions?: Record<string, unknown>
  attractivenessBreakdown?: Record<string, unknown>
  audit?: unknown
  sales?: unknown
  capacity?: unknown
  productionUnits?: number
  team?: { name?: string; id?: string }
  [key: string]: unknown
}

// ============================================================================
// BALANCE SHEET CALCULATION - SINGLE SOURCE OF TRUTH
// ============================================================================
/**
 * CRITICAL: This is the ONLY place where balance sheet values should be calculated.
 *
 * The accounting equation MUST always hold: Assets = Liabilities + Equity
 *
 * Components:
 * - Assets = Cash + Inventory + Fixed Assets
 * - Liabilities = Long-term Debt (+ Short-term Debt if applicable)
 * - Equity = Share Capital + Retained Earnings
 *
 * DO NOT calculate these values elsewhere. Always use this helper to ensure
 * the balance sheet balances. If you need to display balance sheet data,
 * use the values returned by this function.
 *
 * @see DecisionsModernPage.tsx - uses displayBalanceSheet from prevRoundData
 * @see DecisionsPage.tsx - should also use this same data source
 */
export interface BalanceSheetData {
  // Assets
  cash: number
  inventory: number       // Value at cost
  receivables: number
  fixedAssets: number
  totalAssets: number
  // Liabilities
  longTermDebt: number
  shortTermDebt: number
  shortTermLoans: number
  payables: number
  totalLiabilities: number
  // Equity
  shareCapital: number
  retainedEarnings: number
  totalEquity: number
  // Verification
  totalLiabilitiesAndEquity: number
  isBalanced: boolean
}

/**
 * Calculate a balanced balance sheet from raw inputs.
 *
 * This function ensures Assets = Liabilities + Equity by:
 * 1. Taking known values (cash, inventory, fixed assets, debt, share capital)
 * 2. Computing retained earnings as the balancing figure
 *
 * This matches standard accounting practice where retained earnings
 * accumulate from net profits minus dividends.
 */
export function calculateBalancedBalanceSheet(params: {
  cash: number
  inventoryValue: number
  receivables?: number
  fixedAssets: number
  longTermDebt: number
  shortTermDebt?: number
  payables?: number
  shareCapital: number
  // Optional: if retainedEarnings is provided, we verify balance; otherwise we compute it
  retainedEarnings?: number
}): BalanceSheetData {
  const {
    cash,
    inventoryValue,
    receivables = 0,
    fixedAssets,
    longTermDebt,
    shortTermDebt = 0,
    payables = 0,
    shareCapital,
    retainedEarnings: providedRetainedEarnings,
  } = params

  // Calculate totals
  const totalAssets = cash + inventoryValue + receivables + fixedAssets
  const totalLiabilities = longTermDebt + shortTermDebt + payables

  // Retained earnings is the balancing figure: RE = Assets - Liabilities - Share Capital
  // This ensures the accounting equation always holds
  const computedRetainedEarnings = totalAssets - totalLiabilities - shareCapital

  // Use provided value if given (for verification), otherwise use computed
  const retainedEarnings = providedRetainedEarnings ?? computedRetainedEarnings
  const totalEquity = shareCapital + retainedEarnings
  const totalLiabilitiesAndEquity = totalLiabilities + totalEquity

  // Verify balance (should always be true if we computed retained earnings)
  const isBalanced = Math.abs(totalAssets - totalLiabilitiesAndEquity) < 0.01

  return {
    cash,
    inventory: inventoryValue,
    receivables,
    fixedAssets,
    totalAssets,
    longTermDebt,
    shortTermDebt,
    shortTermLoans: shortTermDebt,
    payables,
    totalLiabilities,
    shareCapital,
    retainedEarnings,
    totalEquity,
    totalLiabilitiesAndEquity,
    isBalanced,
  }
}

export function useReviewData({
  game,
  gameState,
  team,
  fetchedResults,
  gameConfig,
  selectedReviewRound,
}: ReviewParams) {
  const GAME_CONFIG = gameConfig
  const defaults = GAME_CONFIG.defaults
  const currentRound = game?.currentRound ?? 0

  // For round 1 or trial, show starting position (-1). Otherwise review previous round.
  // If selectedReviewRound is provided, use that instead
  // For Round 0 (Trial) and Round 1: use Round -1 (starting position)
  // For Round 2+: use previous round's ending state
  // Trial (Round 0) doesn't carry forward to Round 1
  const defaultReviewRound = currentRound > 1 ? currentRound - 1 : -1
  const reviewRound = selectedReviewRound !== null && selectedReviewRound !== undefined
    ? selectedReviewRound
    : defaultReviewRound
  const reviewResults = useMemo(() => {
    return fetchedResults.find((r) => r.roundNumber === reviewRound) || null
  }, [fetchedResults, reviewRound])

  const preReviewResults = useMemo(() => {
    const preRound = reviewRound > 0 ? reviewRound - 1 : -2
    return fetchedResults.find((r) => r.roundNumber === preRound) || null
  }, [fetchedResults, reviewRound])

  // Use calculateMarketDemand for consistent demand calculation across the app
  // This accounts for numTeams, regionDemandSplit, and scenario effects
  const numTeams = game?.totalTeams ?? game?.teams?.length ?? 1
  const calculatedMarketDemand = useMemo(() => {
    return calculateMarketDemand(
      reviewRound,
      game?.scenarioSequence,
      game?.marketDemandMultiplier ?? 1,
      GAME_CONFIG,
      numTeams,
      game?.regionDemandSplit
    )
  }, [reviewRound, game?.scenarioSequence, game?.marketDemandMultiplier, GAME_CONFIG, numTeams, game?.regionDemandSplit])

  const normalizeShare = (value: number | undefined | null) => {
    if (!value || Number.isNaN(value)) return 0
    return value > 1 ? value / 100 : value
  }

  const reviewMarketDemand = reviewResults?.marketDemand || calculatedMarketDemand
  const reviewTeams = useMemo(() => {
    const fallbackTeamCount = game?.totalTeams ?? 0
    const teamList = game?.teams?.length
      ? game.teams
      : Array.from({ length: fallbackTeamCount }, (_, index) => ({
        id: `team-${index + 1}`,
        name: `Team ${index + 1}`,
      }))
    const teamNameById = new Map(teamList.map((teamInfo) => [teamInfo.id, teamInfo.name]))
    const defaultShare = getStartingMarketShare(teamList.length)
    const basePrices = GAME_CONFIG.priceDemand.baselinePriceByRegion
    const basePromos = defaults.marketing.promotionPctByRegion
    const mapTeamResult = (teamResult: TeamRoundResult) => {
      const full = teamResult.fullResults || {}
      const sales = full.sales || {}
      const marketing = full.decisions?.marketing || {}
      const pnl = full.pnl ?? {}
      const balanceSheet = full.balanceSheet ?? {}
      const cashflow = full.cashflow ?? full.cashFlow ?? null
      const costs = full.costs ?? {}
      const revenue = pnl.revenue ?? 0
      const cogs = pnl.cogs ?? (revenue * 0.7)
      const grossProfit = pnl.grossProfit ?? (revenue - cogs)
      const operatingExpenses = pnl.operatingExpenses ?? (revenue * 0.12)
      const admin = pnl.admin ?? costs.admin ?? null
      const rnd = pnl.rnd ?? pnl.rndCost ?? costs.rnd ?? null
      const marketingExpense = pnl.marketing ?? pnl.promo ?? costs.marketing ?? null
      const inventoryHolding = costs.inventoryHolding ?? 0
      const depreciation = pnl.depreciation ?? costs.depreciation ?? null
      const ebit = pnl.ebit ?? null
      const interest = pnl.interestExpense ?? pnl.interest ?? costs.interest ?? 0
        const tax = pnl.tax ?? 0
        const taxLossCarryforward = full.gameState?.taxLossCarryforward ?? pnl.taxLossCarryforwardEnd ?? 0
        const netProfit = pnl.netProfit ?? (grossProfit - operatingExpenses - interest - tax)
      const rawCash = balanceSheet.cash ?? 0
      const rawInventoryValue = balanceSheet.inventory ?? 0
      const rawFixedAssets = balanceSheet.fixedAssets ?? 0
      const rawLongTermDebt = balanceSheet.longTermDebt ?? 0
      const rawShareCapital = balanceSheet.shareCapital ?? 0
      const rawReceivables = balanceSheet.receivables ?? 0
      const rawPayables = balanceSheet.payables ?? 0
      const rawShortTermDebt = balanceSheet.shortTermLoans ?? 0
      const balancedBS = calculateBalancedBalanceSheet({
        cash: rawCash,
        inventoryValue: rawInventoryValue,
        fixedAssets: rawFixedAssets,
        longTermDebt: rawLongTermDebt,
        shareCapital: rawShareCapital,
        receivables: rawReceivables,
        payables: rawPayables,
        shortTermDebt: rawShortTermDebt,
      })
      const prices = {
        us: sales.us?.price ?? marketing.us?.price ?? marketing.priceUS ?? basePrices.us,
        asia: sales.asia?.price ?? marketing.asia?.price ?? marketing.priceAsia ?? basePrices.asia,
        europe: sales.europe?.price ?? marketing.europe?.price ?? marketing.priceEurope ?? basePrices.europe,
      }
      const promos = {
        us: marketing.us?.promotionPct ?? marketing.promoUS ?? basePromos.us,
        asia: marketing.asia?.promotionPct ?? marketing.promoAsia ?? basePromos.asia,
        europe: marketing.europe?.promotionPct ?? marketing.promoEurope ?? basePromos.europe,
      }
      const hrDecision = full.decisions?.hr || {}
      const trainingBudget =
        (hrDecision.us?.training ?? hrDecision.trainingUS ?? 0) +
        (hrDecision.asia?.training ?? hrDecision.trainingAsia ?? 0)
      const unitsSold = {
        us: sales.us?.units ?? 0,
        asia: sales.asia?.units ?? 0,
        europe: sales.europe?.units ?? 0,
      }
      const totalUnits = unitsSold.us + unitsSold.asia + unitsSold.europe
      const marketShare = {
        us: reviewMarketDemand.us > 0
          ? unitsSold.us / reviewMarketDemand.us
          : normalizeShare(full.marketShare?.us ?? 0),
        asia: reviewMarketDemand.asia > 0
          ? unitsSold.asia / reviewMarketDemand.asia
          : normalizeShare(full.marketShare?.asia ?? 0),
        europe: reviewMarketDemand.europe > 0
          ? unitsSold.europe / reviewMarketDemand.europe
          : normalizeShare(full.marketShare?.europe ?? 0),
      }
      // Extract features count - try multiple sources in order of preference:
      // 1. Direct availableFeatures field from engine output
      // 2. rndProgress from fullResults
      // 3. gameState.rndProgress
      // 4. Default to 0
      const gameState = full.gameState || teamResult.gameState || {}
      const availableFeatures = full.availableFeatures
        ?? full.rndProgress?.unlockedFeatureCount
        ?? gameState.rndProgress?.unlockedFeatureCount
        ?? 0
      const availableTechLevel = full.availableTechLevel
        ?? full.rndProgress?.unlockedTechLevel
        ?? gameState.rndProgress?.unlockedTechLevel
        ?? 1

      // Extract CSR rating - try multiple sources:
      // 1. From attractivenessBreakdown (csrScore / 25) - NOTE: engine stores as "attractivenessBreakdown" not "attractiveness"
      // 2. From production decisions (supplierUS/supplierAsia -> GAME_CONFIG.supplierCSR)
      // 3. Default to Standard tier (2)
      const attractiveness = full.attractivenessBreakdown || teamResult.attractivenessBreakdown || {}
      const csrScore = attractiveness.us?.csrScore ?? attractiveness.asia?.csrScore ?? attractiveness.europe?.csrScore ?? 0

      let csrRating: number
      if (csrScore > 0) {
        // csrScore is typically rating * 25 (e.g., rating 2 = score 50)
        csrRating = csrScore / 25
      } else {
        // Try to get from production decisions
        const production = full.decisions?.production || teamResult.decisions?.production || {}
        const supplierUS = production.supplierUS ?? 2 // Default to Standard (tier 2)
        const supplierAsia = production.supplierAsia ?? 2
        const csrUS = GAME_CONFIG.supplierCSR[supplierUS as 1 | 2 | 3 | 4] ?? 2
        const csrAsia = GAME_CONFIG.supplierCSR[supplierAsia as 1 | 2 | 3 | 4] ?? 2
        csrRating = (csrUS + csrAsia) / 2
      }

      const sharePrice = full.kpis?.sharePrice ?? 0
      const preTeamResult = preReviewResults?.teams?.find((t) => (t.teamId ?? t.id) === (teamResult.teamId ?? teamResult.id))
      const preFull = preTeamResult?.fullResults || {}
      const prevSharePrice = preFull.kpis?.sharePrice ?? 0

      return {
        id: teamResult.teamId || teamResult.id,
        name:
          teamResult.teamName ||
          teamNameById.get(teamResult.teamId) ||
          teamResult.name ||
          teamResult.team?.name ||
          `Team ${teamResult.teamId ?? ''}`.trim(),
        prices,
        promos,
        unitsSold,
        totalUnits,
        marketShare,
        features: availableFeatures,
        availableFeatures,
        availableTechLevel,
        csrRating,
        trainingBudget,
        financials: {
            pnl: {
              revenue,
              cogs,
              grossProfit,
              operatingExpenses,
              admin,
              rnd,
              marketing: marketingExpense,
              inventoryHolding,
              depreciation,
              ebit,
              interest,
              tax,
              taxLossCarryforward,
              netProfit,
            },
          balanceSheet: {
            cash: balanceSheet.cash ?? balancedBS.cash,
            inventory: balanceSheet.inventory ?? balancedBS.inventory,
            receivables: balanceSheet.receivables ?? balancedBS.receivables,
            fixedAssets: balanceSheet.fixedAssets ?? balancedBS.fixedAssets,
            totalAssets: balanceSheet.totalAssets ?? balancedBS.totalAssets,
            longTermDebt: balanceSheet.longTermDebt ?? balancedBS.longTermDebt,
            payables: balanceSheet.payables ?? balancedBS.payables,
            shortTermLoans: balanceSheet.shortTermLoans ?? balancedBS.shortTermLoans ?? balancedBS.shortTermDebt,
            shareCapital: balanceSheet.shareCapital ?? balancedBS.shareCapital,
            retainedEarnings: balanceSheet.retainedEarnings ?? balancedBS.retainedEarnings,
            totalLiabilities: balanceSheet.totalLiabilities ?? balancedBS.totalLiabilities,
            totalEquity: balanceSheet.totalEquity ?? balancedBS.totalEquity,
          },
          cashflow,
        },
        decisions: full.decisions ?? teamResult.decisions ?? null,
        gameState: full.gameState ?? teamResult.gameState ?? null,
        attractivenessBreakdown: full.attractivenessBreakdown ?? null,
        previousMarketDemand: full.previousMarketDemand ?? null,
        // Audit data for comparing ideal vs actual share
        audit: full.audit ?? teamResult.audit ?? null,
        sales: full.sales ?? teamResult.sales ?? null,
        capacity: full.capacity ?? teamResult.capacity ?? null,
        productionUnits: full.productionUnits ?? teamResult.productionUnits ?? 0,
        sharePrice,
        prevSharePrice,
      }
    }

    if (reviewResults?.teams?.length) {
      return reviewResults.teams.map(mapTeamResult)
    }

    const startingPrice = GAME_CONFIG.financial?.startingSharePrice ?? 10
    const defaultCSR = GAME_CONFIG.supplierCSR[2] // Standard tier default
    return teamList.map((teamInfo) => {
      const unitsSold = {
        us: Math.round(reviewMarketDemand.us * defaultShare),
        asia: Math.round(reviewMarketDemand.asia * defaultShare),
        europe: Math.round(reviewMarketDemand.europe * defaultShare),
      }
      return {
        id: teamInfo.id,
        name: teamInfo.name,
        prices: { ...basePrices },
        promos: { ...basePromos },
        unitsSold,
        totalUnits: unitsSold.us + unitsSold.asia + unitsSold.europe,
        marketShare: { us: defaultShare, asia: defaultShare, europe: defaultShare },
        features: 0,
        availableFeatures: 0,
        availableTechLevel: 1,
        csrRating: defaultCSR,
        trainingBudget: 0,
        financials: {
            pnl: {
              revenue: 0,
              cogs: 0,
              grossProfit: 0,
              operatingExpenses: 0,
              admin: 0,
              rnd: 0,
              marketing: 0,
              inventoryHolding: 0,
              depreciation: 0,
              ebit: 0,
              interest: 0,
              tax: 0,
              taxLossCarryforward: 0,
              netProfit: 0,
            },
          balanceSheet: {
            cash: 0,
            inventory: 0,
            receivables: 0,
            fixedAssets: 0,
            totalAssets: 0,
            longTermDebt: 0,
            payables: 0,
            shortTermLoans: 0,
            shareCapital: 0,
            retainedEarnings: 0,
            totalLiabilities: 0,
            totalEquity: 0,
          },
          cashflow: null,
        },
        sharePrice: startingPrice,
        prevSharePrice: startingPrice,
      }
    })
  }, [GAME_CONFIG, defaults, game, preReviewResults?.teams, reviewMarketDemand, reviewResults])

  const reviewIndustryAverages = useMemo(() => {
    const defaultCSR = GAME_CONFIG.supplierCSR[2] // Standard tier default
    if (!reviewTeams.length) {
      return {
        price: { ...GAME_CONFIG.priceDemand.baselinePriceByRegion },
        promo: { ...defaults.marketing.promotionPctByRegion },
        features: 0,
        csrRating: defaultCSR,
      }
    }
    const avg = (values: number[]) => values.reduce((sum, v) => sum + v, 0) / values.length
    return {
      price: {
        us: avg(reviewTeams.map((t) => t.prices.us)),
        asia: avg(reviewTeams.map((t) => t.prices.asia)),
        europe: avg(reviewTeams.map((t) => t.prices.europe)),
      },
      promo: {
        us: avg(reviewTeams.map((t) => t.promos.us)),
        asia: avg(reviewTeams.map((t) => t.promos.asia)),
        europe: avg(reviewTeams.map((t) => t.promos.europe)),
      },
      features: avg(reviewTeams.map((t) => t.features ?? 0)),
      csrRating: avg(reviewTeams.map((t) => t.csrRating ?? defaultCSR)),
    }
  }, [reviewTeams, GAME_CONFIG, defaults])

  const reviewSalesSummary = useMemo(() => {
    const teamRow =
      reviewTeams.find((row) => row.id === team?.id) ||
      reviewTeams[0]
    const totals = teamRow
      ? {
        us: teamRow.unitsSold.us,
        asia: teamRow.unitsSold.asia,
        europe: teamRow.unitsSold.europe,
        total: teamRow.totalUnits,
        revenue:
          teamRow.unitsSold.us * teamRow.prices.us +
          teamRow.unitsSold.asia * teamRow.prices.asia +
          teamRow.unitsSold.europe * teamRow.prices.europe,
        prices: teamRow.prices,
        promos: teamRow.promos,
      }
      : {
        us: 0,
        asia: 0,
        europe: 0,
        total: 0,
        revenue: 0,
        prices: { ...GAME_CONFIG.priceDemand.baselinePriceByRegion },
        promos: { ...defaults.marketing.promotionPctByRegion },
      }
    const unitCost = getStartingUnitCost(GAME_CONFIG)
    const cogs = totals.total * unitCost
    const grossProfit = totals.revenue - cogs
    return {
      ...totals,
      cogs,
      grossProfit,
      grossMargin: totals.revenue > 0 ? grossProfit / totals.revenue : 0,
    }
  }, [reviewTeams, GAME_CONFIG, defaults, team?.id])

  const startingFinancials = useMemo(
    () => getBalancedStartingFinancials(GAME_CONFIG),
    [GAME_CONFIG]
  )

  const reviewOperatingSummary = useMemo(() => {
    const hrDefaults = defaults.hr
    const annualUS = hrDefaults.us.employees * hrDefaults.us.wage * 12
    const hrCost = annualUS + hrDefaults.us.training
    const rndCost = hrCost
    const marketingCost =
      reviewSalesSummary.us * reviewSalesSummary.prices.us * (reviewSalesSummary.promos.us / 100) +
      reviewSalesSummary.asia * reviewSalesSummary.prices.asia * (reviewSalesSummary.promos.asia / 100) +
      reviewSalesSummary.europe * reviewSalesSummary.prices.europe * (reviewSalesSummary.promos.europe / 100)
    // Admin cost: Use revenue-based (3% of revenue) if revenue exists, otherwise fallback to employee-based
    const adminStaffFloor = GAME_CONFIG.hr?.adminStaffFloor ?? 10
    const adminOverheadPercent = GAME_CONFIG.hr?.adminOverheadPercent ?? 0.20
    const adminRevenuePercent = GAME_CONFIG.hr?.adminRevenuePercent ?? 0.03
    const adminIdleMultiplier = GAME_CONFIG.hr?.adminIdleMultiplier ?? 1
    const adminLaborFloor = adminStaffFloor * hrDefaults.us.wage * 12
    const revenueBasedAdmin = reviewSalesSummary.revenue * adminRevenuePercent
    const employeeBasedAdmin = Math.max(hrCost, adminLaborFloor) * adminOverheadPercent
    const adminCostBase = reviewSalesSummary.revenue > 0 ? revenueBasedAdmin : employeeBasedAdmin
    const idleMultiplier = reviewSalesSummary.total === 0 ? adminIdleMultiplier : 1
    const adminCost = adminCostBase * idleMultiplier
    const operatingExpenses = rndCost + marketingCost + adminCost
    const operatingProfit = reviewSalesSummary.grossProfit - operatingExpenses
    const depreciation = startingFinancials.fixedAssets * GAME_CONFIG.financial.depreciationRate
    const interest = startingFinancials.startingDebt * GAME_CONFIG.financial.interestRate
    const profitBeforeTax = operatingProfit - depreciation - interest
    const tax = profitBeforeTax > 0 ? profitBeforeTax * GAME_CONFIG.financial.taxRate : 0
    const netProfit = profitBeforeTax - tax
    const netMargin = reviewSalesSummary.revenue > 0 ? netProfit / reviewSalesSummary.revenue : 0
    return {
      operatingExpenses,
      operatingProfit,
      netProfit,
      netMargin,
      // Detailed cost breakdown
      hrCost,
      rndCost,
      marketingCost,
      adminCost,
      depreciation,
      interest,
      tax,
    }
  }, [defaults, reviewSalesSummary, startingFinancials, GAME_CONFIG])

  const prevRoundData = useMemo(() => {
    if (!game || !gameState) return null
    const teamCount = game.totalTeams ?? game.teams?.length ?? 0
    const capacityPerFactory = game.capacityPerFactory ?? GAME_CONFIG.capacityPerPlant
    // Use reviewRound (which may be overridden by selectedReviewRound)
    const prevRound = reviewRound
    const prevRoundResult = fetchedResults.find((r) => r.roundNumber === prevRound)
    const teamResult = prevRoundResult?.teams?.find((t) => t.teamId === team?.id)

    if (teamResult) {
      const result = teamResult
      const fullResults = (result.fullResults || {}) as Record<string, unknown>
      const fullGameState = fullResults.gameState || {}
      const balanceSheet = fullResults.balanceSheet || {}
      const pnl = fullResults.pnl || {}
      const sales = fullResults.sales || {}

      const baseFactoriesUS = fullGameState.factories?.us ?? 0
      const baseFactoriesAsia = fullGameState.factories?.asia ?? 0
      const pendingInvestments = Array.isArray(fullGameState.pendingInvestments)
        ? fullGameState.pendingInvestments
        : []
      // Use currentRound to check what factories are available NOW
      // When in Round 2, we want to show factories that are available by Round 2
      const currentRoundNumber = game.currentRound ?? (prevRound + 1)
      const effectiveFactories = pendingInvestments.reduce(
        (acc: { us: number; asia: number }, investment: { roundAvailable?: number; region?: string; plantsOrdered?: number }) => {
          if (investment?.roundAvailable <= currentRoundNumber) {
            if (investment.region === 'us') {
              acc.us += investment.plantsOrdered || 0
            }
            if (investment.region === 'asia') {
              acc.asia += investment.plantsOrdered || 0
            }
          }
          return acc
        },
        { us: baseFactoriesUS, asia: baseFactoriesAsia }
      )

      const fallbackMarketShare = getStartingMarketShare(teamCount)
      const revenue = pnl.revenue ?? 0
      const cogs = pnl.cogs ?? (revenue * 0.7)
      const grossProfit = pnl.grossProfit ?? (revenue - cogs)
      const operatingExpenses = pnl.operatingExpenses ?? (revenue * 0.12)
      const ebitda = pnl.ebitda ?? (grossProfit - operatingExpenses)
      const depreciation = pnl.depreciation ?? fullResults.costs?.depreciation ?? 0
      const interest = pnl.interestExpense ?? fullResults.costs?.interest ?? 0
        const tax = pnl.tax ?? 0
        const taxLossCarryforwardStart = pnl.taxLossCarryforwardStart ?? 0
        const taxLossCarryforwardEnd = fullGameState.taxLossCarryforward ?? pnl.taxLossCarryforwardEnd ?? 0
        const ebit = pnl.ebit ?? (ebitda - depreciation)
        const operatingProfit = ebit
        const netProfit = pnl.netProfit ?? (operatingProfit * 0.75)

      const prevSharePrice = fullResults.kpis?.sharePrice ?? 0
      const resultSharesOutstanding =
        fullResults.kpis?.sharesOutstanding ??
        (balanceSheet.shareCapital ? balanceSheet.shareCapital / GAME_CONFIG.financial.parValuePerShare : 0)

      const inventoryRegional =
        (fullResults.gameState?.inventoryUS ?? 0) + (fullResults.gameState?.inventoryAsia ?? 0)
      const inventoryUnits =
        inventoryRegional > 0
          ? inventoryRegional
          : fullResults.gameState?.inventory ??
          fullGameState.inventory ??
          Math.round((balanceSheet.inventory ?? 0) / 26)

      const inventoryTrace = fullResults.inventoryTrace ?? null
      const inventoryByRegion = {
        us: fullResults.gameState?.inventoryUS ?? inventoryUnits,
        asia: fullResults.gameState?.inventoryAsia ?? 0,
        europe: 0,
      }
      const startingInventoryUnits = inventoryTrace?.startingUnits ?? 0
      const startingInventoryByRegion = {
        us: inventoryTrace?.startingUnitsUS ?? 0,
        asia: inventoryTrace?.startingUnitsAsia ?? 0,
        europe: 0,
      }
      const endingInventoryUnits = inventoryTrace?.endingUnits ?? inventoryUnits
      const endingInventoryByRegion = {
        us: inventoryTrace?.endingUnitsUS ?? inventoryByRegion.us,
        asia: inventoryTrace?.endingUnitsAsia ?? inventoryByRegion.asia,
        europe: 0,
      }
      const inventoryValueAtCost = inventoryUnits * (fullResults.unitCost ?? 0)

      // Extract raw balance sheet values from fullResults only
      const rawCash = balanceSheet.cash ?? 0
      const rawInventoryValue = balanceSheet.inventory ?? inventoryValueAtCost
      const rawFixedAssets = balanceSheet.fixedAssets ??
        ((effectiveFactories.us * GAME_CONFIG.investment.plantCostUS) +
          (effectiveFactories.asia * GAME_CONFIG.investment.plantCostAsia))
      const rawLongTermDebt = balanceSheet.longTermDebt ?? 0
      const rawShareCapital = balanceSheet.shareCapital ?? 0
      const rawReceivables = balanceSheet.receivables ?? 0
      const rawPayables = balanceSheet.payables ?? 0
      const rawShortTermDebt = balanceSheet.shortTermLoans ?? 0

      // Use centralized balance sheet calculator to ensure Assets = Liabilities + Equity
      // This is the SINGLE SOURCE OF TRUTH for balance sheet calculations
      // See calculateBalancedBalanceSheet documentation at top of file
      const balancedBS = calculateBalancedBalanceSheet({
        cash: rawCash,
        inventoryValue: rawInventoryValue,
        fixedAssets: rawFixedAssets,
        longTermDebt: rawLongTermDebt,
        shareCapital: rawShareCapital,
        receivables: rawReceivables,
        payables: rawPayables,
        shortTermDebt: rawShortTermDebt,
        // Let the function compute retained earnings to ensure balance
      })
      const engineBS = fullResults.balanceSheet || {}
      const displayCash = engineBS.cash ?? balancedBS.cash
      const displayInventory = engineBS.inventory ?? balancedBS.inventory
      const displayReceivables = engineBS.receivables ?? balancedBS.receivables
      const displayFixedAssets = engineBS.fixedAssets ?? balancedBS.fixedAssets
      const displayTotalAssets = engineBS.totalAssets ?? balancedBS.totalAssets
      const displayLongTermDebt = engineBS.longTermDebt ?? balancedBS.longTermDebt
      const displayPayables = engineBS.payables ?? balancedBS.payables
      const displayShortTermDebt = engineBS.shortTermLoans ?? balancedBS.shortTermDebt
      const displayShareCapital = engineBS.shareCapital ?? balancedBS.shareCapital
      const displayRetainedEarnings = engineBS.retainedEarnings ?? balancedBS.retainedEarnings
      const displayTotalLiabilities = engineBS.totalLiabilities ?? balancedBS.totalLiabilities
      const displayTotalEquity = engineBS.totalEquity ?? balancedBS.totalEquity

      return {
        isStartingPosition: prevRound < 0,
        round: prevRound,
        rank: result.rank ?? 1,
        totalTeams: teamCount,
        sharePrice: prevSharePrice,
        sharesOutstanding: resultSharesOutstanding,
        scenarioSnapshot: fullResults.scenarioSnapshot ?? null,
        engineMarketDemand: fullResults.marketDemand ?? null,
        engineBalanceSheet: fullResults.balanceSheet ?? null,
        plantCostUSUsed: fullResults.plantCostUSUsed ?? null,
        plantCostAsiaUsed: fullResults.plantCostAsiaUsed ?? null,
        investmentCostMultiplierUsed: fullResults.investmentCostMultiplierUsed ?? null,
        costInflationUsed: fullResults.costInflationUsed ?? null,
        workingCapitalDeltaUsed: fullResults.workingCapitalDeltaUsed ?? null,
        // Prefer engine-provided balance sheet values; fallback to balanced values when missing.
        shareCapital: displayShareCapital,
        retainedEarnings: displayRetainedEarnings,
        marketCap: fullResults.kpis?.marketCap ?? (prevSharePrice * resultSharesOutstanding),
        revenue,
        cogs,
        grossProfit,
        grossMargin: revenue > 0 ? grossProfit / revenue : 0,
          ebitda,
          depreciation,
          interest,
          tax,
          taxLossCarryforwardStart,
          taxLossCarryforward: taxLossCarryforwardEnd,
          ebit,
          operatingExpenses,
          operatingProfit,
          netProfit,
          netMargin: revenue > 0 ? netProfit / revenue : 0,
        // Prefer engine totals when present to avoid UI recalculation drift.
        totalAssets: displayTotalAssets,
        totalLiabilities: displayTotalLiabilities,
        cashBalance: displayCash,
        inventory: displayInventory,
        receivables: displayReceivables,
        payables: displayPayables,
        shortTermLoans: displayShortTermDebt,
        inventoryUnits,
        inventoryByRegion,
        startingInventoryUnits,
        startingInventoryByRegion,
        endingInventoryUnits,
        endingInventoryByRegion,
        inventoryValueAtCost,
        fixedAssets: displayFixedAssets,
        longTermDebt: displayLongTermDebt,
        totalEquity: displayTotalEquity,
        debtRatio: displayTotalAssets > 0
          ? displayLongTermDebt / displayTotalAssets
          : 0,
        factoriesUS: effectiveFactories.us,
        factoriesAsia: effectiveFactories.asia,
        capacityPerFactory,
        totalCapacity: (effectiveFactories.us + effectiveFactories.asia) * capacityPerFactory,
        unitsProduced: fullResults.productionUnits ?? 0,
        utilization: fullResults.capacity?.totalCapacity
          ? (fullResults.productionUnits ?? 0) / fullResults.capacity.totalCapacity
          : 0,
        unitsSold: {
          us: sales.us?.units ?? 0,
          asia: sales.asia?.units ?? 0,
          europe: sales.europe?.units ?? 0,
          total:
            (sales.us?.units ?? 0) +
            (sales.asia?.units ?? 0) +
            (sales.europe?.units ?? 0),
        },
        salesUnits: {
          us: sales.us?.units ?? 0,
          asia: sales.asia?.units ?? 0,
          europe: sales.europe?.units ?? 0,
        },
        marketShare: {
          us: fullResults.marketShare?.us !== undefined
            ? normalizeShare(fullResults.marketShare.us)
            : fallbackMarketShare,
          asia: fullResults.marketShare?.asia !== undefined
            ? normalizeShare(fullResults.marketShare.asia)
            : fallbackMarketShare,
          europe: fullResults.marketShare?.europe !== undefined
            ? normalizeShare(fullResults.marketShare.europe)
            : fallbackMarketShare,
        },
        techLevel: fullGameState.rndProgress?.unlockedTechLevel ?? 0,
        features: fullGameState.rndProgress?.unlockedFeatureCount ?? 0,
        cumulativeResearchHours: fullGameState.rndProgress?.cumulativeResearchHours ?? 0,
        brandReputation: fullGameState.brandReputation ?? 0,
        roe: (balanceSheet.totalEquity ?? 0) > 0
          ? netProfit / (balanceSheet.totalEquity ?? 0)
          : 0,
        ros: revenue > 0 ? netProfit / revenue : 0,
        eps: resultSharesOutstanding > 0 ? netProfit / resultSharesOutstanding : 0,
        // Per-region sales data for margin calculation
        salesByRegion: {
          us: {
            units: sales.us?.units ?? 0,
            revenue: sales.us?.revenue ?? 0,
            price: sales.us?.price ?? 0,
            unmetDemand: sales.us?.unmetDemand ?? 0,
          },
          asia: {
            units: sales.asia?.units ?? 0,
            revenue: sales.asia?.revenue ?? 0,
            price: sales.asia?.price ?? 0,
            unmetDemand: sales.asia?.unmetDemand ?? 0,
          },
          europe: {
            units: sales.europe?.units ?? 0,
            revenue: sales.europe?.revenue ?? 0,
            price: sales.europe?.price ?? 0,
            unmetDemand: sales.europe?.unmetDemand ?? 0,
          },
        },
        // Unit cost for per-region margin calculation
        unitCost: fullResults.unitCost ?? 0,
        activeInterestRate: fullResults.activeInterestRate ?? null,
        activeTaxRate: fullResults.activeTaxRate ?? null,
        capacityPerPlantUsed: fullResults.capacityPerPlantUsed ?? GAME_CONFIG.capacityPerPlant ?? null,
        previousMarketDemand: fullResults.previousMarketDemand ?? null,
        profitBeforeTax: ebit - interest,
        // Detailed cost breakdown (from fullResults.costs if available)
        costs: fullResults.costs ?? null,
        materials: fullResults.costs?.materials ?? 0,
        labor: fullResults.costs?.labor ?? 0,
        logistics: fullResults.costs?.logistics ?? fullResults.logisticsCost ?? 0,
        logisticsCost: fullResults.logisticsCost ?? fullResults.costs?.logistics ?? 0,
        outsourcing: fullResults.costs?.outsourcing ?? 0,
        marketing: fullResults.costs?.marketing ?? 0,
        rnd: fullResults.costs?.rnd ?? 0,
        admin: fullResults.costs?.admin ?? 0,
        inventoryHolding: fullResults.costs?.inventoryHolding ?? 0,
        decisions: fullResults.decisions ?? {},
        // Production breakdown
        productionUS: fullResults.production?.usFactoryUnits ?? 0,
        productionAsia: fullResults.production?.asiaFactoryUnits ?? 0,
        outsourceUS: fullResults.production?.outsourceUS ?? 0,
        outsourceAsia: fullResults.production?.outsourceAsia ?? 0,
      }
    }

    // Return null - starting position will be built below using reviewSalesSummary
    return null
  }, [game, fetchedResults, team?.id, gameState, GAME_CONFIG, reviewRound])

  // Calculate starting position (round -1) data when needed
  const roundMinus1Data = useMemo(() => {
    if (reviewRound !== -1 || !game) return null

    const teamCount = game.totalTeams ?? game.teams?.length ?? 1
    const capacityPerFactory = game.capacityPerFactory ?? GAME_CONFIG.capacityPerPlant

    // Run the game engine to calculate round -1 results
    const roundMinus1Results = calculateRoundMinus1(
      teamCount,
      GAME_CONFIG,
      game.scenarioSequence ?? [0],
      game.marketDemandMultiplier ?? 1,
      game.regionDemandSplit
    )

    const teamResult = roundMinus1Results.teams[0] // All teams identical in round -1
    if (!teamResult) return null

    const pnl = teamResult.pnl || {}
    const sales = teamResult.sales || {}
    const production = teamResult.production
    const costs = teamResult.costs || {}
    const capacity = teamResult.capacity || {
      usFactoryCapacity: 0, asiaFactoryCapacity: 0, totalFactoryCapacity: 0,
      usOutsourceCapacity: 0, asiaOutsourceCapacity: 0, totalOutsourceCapacity: 0,
      totalCapacity: 0, usFactoryCount: 0, asiaFactoryCount: 0
    }
    const balanceSheet = teamResult.balanceSheet || {}
    const kpis = teamResult.kpis || {}

    const startingFinancialsForPosition = getBalancedStartingFinancials(GAME_CONFIG)
    const startingFactoriesUS = GAME_CONFIG.initialFactories.us
    const startingFactoriesAsia = GAME_CONFIG.initialFactories.asia

    const sharePrice = kpis.sharePrice ?? GAME_CONFIG.financial.startingSharePrice
    const sharesOutstanding = kpis.sharesOutstanding ??
      Math.round(startingFinancialsForPosition.startingShareCapital / GAME_CONFIG.financial.parValuePerShare)

    const revenue = pnl.revenue ?? 0
    const cogs = pnl.cogs ?? 0
    const grossProfit = pnl.grossProfit ?? 0
    const operatingExpenses = pnl.operatingExpenses ?? 0
    const netProfit = pnl.netProfit ?? 0
    const unitsProduced = production?.totalUnits ?? 0

    const unitsSoldUS = sales.us?.units ?? 0
    const unitsSoldAsia = sales.asia?.units ?? 0
    const unitsSoldEurope = sales.europe?.units ?? 0
    const totalUnitsSold = unitsSoldUS + unitsSoldAsia + unitsSoldEurope

    const inventoryUnits = teamResult.gameState?.inventory ?? 0
    const inventoryByRegion = {
      us: teamResult.gameState?.inventoryUS ?? inventoryUnits,
      asia: teamResult.gameState?.inventoryAsia ?? 0,
      europe: 0,
    }
    const inventoryTrace = teamResult.inventoryTrace ?? null
    const startingInventoryUnits = inventoryTrace?.startingUnits ?? 0
    const startingInventoryByRegion = {
      us: inventoryTrace?.startingUnitsUS ?? 0,
      asia: inventoryTrace?.startingUnitsAsia ?? 0,
      europe: 0,
    }
    const endingInventoryUnits = inventoryTrace?.endingUnits ?? inventoryUnits
    const endingInventoryByRegion = {
      us: inventoryTrace?.endingUnitsUS ?? inventoryByRegion.us,
      asia: inventoryTrace?.endingUnitsAsia ?? inventoryByRegion.asia,
      europe: 0,
    }

    const marketSharePct = getStartingMarketShare(teamCount)

    // Use balanced balance sheet
    const balancedBS = calculateBalancedBalanceSheet({
      cash: balanceSheet.cash ?? startingFinancialsForPosition.startingCash,
      inventoryValue: balanceSheet.inventory ?? 0,
      fixedAssets: balanceSheet.fixedAssets ?? startingFinancialsForPosition.fixedAssets,
      longTermDebt: balanceSheet.longTermDebt ?? startingFinancialsForPosition.startingDebt,
      shareCapital: balanceSheet.shareCapital ?? startingFinancialsForPosition.startingShareCapital,
      receivables: balanceSheet.receivables ?? 0,
      payables: balanceSheet.payables ?? 0,
      shortTermDebt: balanceSheet.shortTermLoans ?? 0,
    })

    return {
      isStartingPosition: true,
      round: -1,
      scenarioSnapshot: null,
      engineMarketDemand: roundMinus1Results.marketDemand,
      rank: 1,
      totalTeams: teamCount,
      sharePrice,
      sharesOutstanding,
      shareCapital: balancedBS.shareCapital,
      retainedEarnings: balancedBS.retainedEarnings,
      marketCap: sharePrice * sharesOutstanding,
      revenue,
      cogs,
      grossProfit,
      grossMargin: revenue > 0 ? grossProfit / revenue : 0,
      operatingExpenses,
      operatingProfit: grossProfit - operatingExpenses,
      ebitda: grossProfit - operatingExpenses + (costs.depreciation ?? 0),
      ebit: grossProfit - operatingExpenses,
      netProfit,
      netMargin: revenue > 0 ? netProfit / revenue : 0,
      taxLossCarryforward: 0,
      taxLossCarryforwardStart: 0,
      totalAssets: balancedBS.totalAssets,
      totalLiabilities: balancedBS.totalLiabilities,
      cashBalance: balancedBS.cash,
      inventory: balancedBS.inventory,
      receivables: balancedBS.receivables,
      payables: balancedBS.payables,
      engineBalanceSheet: teamResult.balanceSheet ?? null,
      plantCostUSUsed: GAME_CONFIG.investment?.plantCostUS ?? null,
      plantCostAsiaUsed: GAME_CONFIG.investment?.plantCostAsia ?? null,
      investmentCostMultiplierUsed: 1,
      costInflationUsed: 1,
      workingCapitalDeltaUsed: { inventory: 0, receivable: 0, payable: 0 },
      inventoryUnits,
      inventoryByRegion,
      inventoryValueAtCost: inventoryUnits * getStartingUnitCost(GAME_CONFIG),
      shortTermLoans: balancedBS.shortTermDebt,
      startingInventoryUnits,
      startingInventoryByRegion,
      endingInventoryUnits,
      endingInventoryByRegion,
      fixedAssets: balancedBS.fixedAssets,
      longTermDebt: balancedBS.longTermDebt,
      totalEquity: balancedBS.totalEquity,
      debtRatio: balancedBS.totalAssets > 0 ? balancedBS.longTermDebt / balancedBS.totalAssets : 0,
      factoriesUS: startingFactoriesUS,
      factoriesAsia: startingFactoriesAsia,
      capacityPerFactory,
      totalCapacity: (startingFactoriesUS + startingFactoriesAsia) * capacityPerFactory,
      unitsProduced,
      utilization: capacity.totalFactoryCapacity > 0 ? unitsProduced / capacity.totalFactoryCapacity : 0,
      unitsSold: {
        us: unitsSoldUS,
        asia: unitsSoldAsia,
        europe: unitsSoldEurope,
        total: totalUnitsSold,
      },
      salesUnits: {
        us: unitsSoldUS,
        asia: unitsSoldAsia,
        europe: unitsSoldEurope,
      },
      marketShare: {
        us: marketSharePct,
        asia: marketSharePct,
        europe: marketSharePct,
      },
      techLevel: 1,
      features: 0,
      cumulativeResearchHours: 0,
      brandReputation: 0,
      roe: balancedBS.totalEquity > 0 ? netProfit / balancedBS.totalEquity : 0,
      ros: revenue > 0 ? netProfit / revenue : 0,
      eps: sharesOutstanding > 0 ? netProfit / sharesOutstanding : 0,
      salesByRegion: {
        us: {
          units: sales.us?.units ?? 0,
          revenue: sales.us?.revenue ?? 0,
          price: sales.us?.price ?? GAME_CONFIG.priceDemand.baselinePriceByRegion.us,
          unmetDemand: sales.us?.unmetDemand ?? 0,
        },
        asia: {
          units: sales.asia?.units ?? 0,
          revenue: sales.asia?.revenue ?? 0,
          price: sales.asia?.price ?? GAME_CONFIG.priceDemand.baselinePriceByRegion.asia,
          unmetDemand: sales.asia?.unmetDemand ?? 0,
        },
        europe: {
          units: sales.europe?.units ?? 0,
          revenue: sales.europe?.revenue ?? 0,
          price: sales.europe?.price ?? GAME_CONFIG.priceDemand.baselinePriceByRegion.europe,
          unmetDemand: sales.europe?.unmetDemand ?? 0,
        },
      },
      unitCost: getStartingUnitCost(GAME_CONFIG),
      materials: costs.materials ?? 0,
      labor: costs.labor ?? 0,
      logistics: costs.logistics ?? 0,
      outsourcing: costs.outsourcing ?? 0,
      marketing: costs.marketing ?? 0,
      rnd: costs.rnd ?? 0,
      admin: costs.admin ?? 0,
      inventoryHolding: costs.inventoryHolding ?? 0,
      depreciation: costs.depreciation ?? 0,
      interest: costs.interest ?? 0,
      tax: pnl.tax ?? 0,
      productionUS: production?.usFactoryUnits ?? unitsProduced,
      productionAsia: production?.asiaFactoryUnits ?? 0,
      outsourceUS: production?.outsourcedUnits ?? 0,
      outsourceAsia: 0,
      decisions: null,
      activeInterestRate: GAME_CONFIG.financial?.interestRate ?? null,
      activeTaxRate: GAME_CONFIG.financial?.taxRate ?? null,
      capacityPerPlantUsed: GAME_CONFIG.capacityPerPlant ?? null,
      previousMarketDemand: null,
      profitBeforeTax: grossProfit - operatingExpenses - (costs.depreciation ?? 0) - (costs.interest ?? 0),
      costs: costs,
      logisticsCost: costs.logistics ?? 0,
    }
  }, [reviewRound, game, GAME_CONFIG])

  // Use prevRoundData if available, otherwise use roundMinus1Data for starting position
  const completePrevRoundData = prevRoundData ?? roundMinus1Data

  const finalReviewMarketDemand = completePrevRoundData?.engineMarketDemand
    ?? reviewResults?.marketDemand
    ?? calculatedMarketDemand

  return {
    // Market demand calculated using: capacityPerFactory × 1 × numTeams, then split by region
    calculatedMarketDemand,
    reviewRound,
    reviewResults,
    reviewMarketDemand: finalReviewMarketDemand,
    reviewTeams,
    reviewIndustryAverages,
    reviewSalesSummary,
    reviewOperatingSummary,
    startingFinancials,
    prevRoundData: completePrevRoundData,
  }
}


