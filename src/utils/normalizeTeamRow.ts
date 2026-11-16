type SharePriceTrace = {
  basePrice?: number
  prevSharePrice?: number
  eps?: number
  basePERatio?: number
  growthPremium?: number
  peRatio?: number
  sharePriceBase?: number
  smoothedPrice?: number
  protectedFloor?: number
  finalSharePrice?: number
}

type BalanceSheetLike = {
  fixedAssets?: number
  inventory?: number
  receivables?: number
  cash?: number
  totalAssets?: number
  longTermDebt?: number
  shortTermLoans?: number
  payables?: number
  totalLiabilities?: number
  shareCapital?: number
  retainedEarnings?: number
  totalEquity?: number
}

type ProductionLike = {
  usFactoryUnits?: number
  usUnits?: number
  outsourceUS?: number
  asiaFactoryUnits?: number
  asiaUnits?: number
  outsourceAsia?: number
}

type MarketingLike = {
  us?: { promotionPct?: number }
  asia?: { promotionPct?: number }
  europe?: { promotionPct?: number }
  promoUS?: number
  promoAsia?: number
  promoEurope?: number
  promotionUS?: number
  promotionAsia?: number
  promotionEurope?: number
}

type HrLike = {
  us?: { training?: number }
  asia?: { training?: number }
  europe?: { training?: number }
  trainingUS?: number
  trainingAsia?: number
  trainingEurope?: number
}

type FullResultsLike = {
  balanceSheet?: BalanceSheetLike
  production?: ProductionLike
  decisions?: {
    production?: ProductionLike
    marketing?: MarketingLike
    hr?: HrLike
    finance?: { dividends?: number }
  }
  inventoryTrace?: { startingUnits?: number; endingUnits?: number }
  audit?: { trace?: { inventory?: { startingUnits?: number; endingUnits?: number } } }
  sales?: {
    us?: { units?: number; price?: number; revenue?: number }
    asia?: { units?: number; price?: number; revenue?: number }
    europe?: { units?: number; price?: number; revenue?: number }
    total?: { units?: number }
  }
  marketShare?: { us?: number; asia?: number; europe?: number }
  pnl?: {
    revenue?: number
    grossProfit?: number
    netProfit?: number
    cogs?: number
    grossMargin?: number
    operatingExpenses?: number
    ebitda?: number
    depreciation?: number
    ebit?: number
    interestExpense?: number
    tax?: number
    taxLossCarryforwardEnd?: number
    netMargin?: number
  }
  attractivenessBreakdown?: {
    us?: { csrScore?: number }
    asia?: { csrScore?: number }
  }
  availableFeatures?: number
  rndProgress?: { unlockedFeatureCount?: number }
  gameState?: {
    rndProgress?: { unlockedFeatureCount?: number }
    taxLossCarryforward?: number
    inventory?: number
    inventoryUS?: number
    inventoryAsia?: number
    inventoryEurope?: number
  }
  costs?: {
    materials?: number
    labor?: number
    logistics?: number
    outsourcing?: number
    marketing?: number
    rnd?: number
    admin?: number
    inventoryHolding?: number
    depreciation?: number
    interest?: number
  }
  inventoryHolding?: number
  fixedAssets?: number
  inventory?: number
  receivables?: number
  cash?: number
  totalAssets?: number
  longTermDebt?: number
  shortTermLoans?: number
  payables?: number
  totalLiabilities?: number
  shareCapital?: number
  retainedEarnings?: number
  totalEquity?: number
  productionUnits?: number
  ratios?: { roe?: number; roce?: number; ros?: number }
  kpis?: {
    sharePrice?: number
    sharesOutstanding?: number
    sharePriceTrace?: SharePriceTrace | null
    eps?: number
    tsr?: number
    dividendYield?: number
    utilization?: number
  }
  utilization?: number
  capacity?: { totalCapacity?: number }
  inventoryByRegion?: { us?: number; asia?: number; europe?: number }
}

type TeamLike = {
  teamId?: string
  id?: string
  teamCode?: string
  teamName?: string
  name?: string
  fixedAssets?: number
  inventory?: number
  receivables?: number
  cash?: number
  totalAssets?: number
  longTermDebt?: number
  shortTermLoans?: number
  payables?: number
  totalLiabilities?: number
  shareCapital?: number
  retainedEarnings?: number
  totalEquity?: number
  balanceSheet?: BalanceSheetLike
  fullResults?: FullResultsLike
}

type MarketDemandLike = {
  us?: number
  asia?: number
  europe?: number
}

export type TeamRow = {
  teamId: string
  teamName: string
  sharePrice: number
  sharesOutstanding?: number
  dividends?: number
  sharePriceTrace?: SharePriceTrace | null
  priceUS: number
  priceAsia: number
  priceEurope: number
  revenueUS: number
  revenueAsia: number
  revenueEurope: number
  materials: number
  labor: number
  logistics: number
  outsourcing: number
  marketing: number
  rnd: number
  admin: number
  inventoryHolding?: number
  revenue: number
  cogs: number
  grossProfit: number
  grossMargin: number
  operatingExpenses: number
  ebitda: number
  depreciation: number
  ebit: number
  interestExpense: number
  tax: number
  taxLossCarryforward?: number
  netProfit: number
  netMargin: number
  fixedAssets: number
  inventory: number
  receivables: number
  cash: number
  totalAssets: number
  longTermDebt: number
  shortTermLoans: number
  payables: number
  totalLiabilities: number
  shareCapital: number
  retainedEarnings: number
  totalEquity: number
  inventoryUnits: number
  inventoryStartUnits?: number
  inventoryEndUnits?: number
  unitsSold: number
  unitsSoldUS: number
  unitsSoldAsia: number
  unitsSoldEurope: number
  productionUS?: number
  productionAsia?: number
  outsourceUS?: number
  outsourceAsia?: number
  unitsProduced: number
  marketShareUS: number
  marketShareAsia: number
  marketShareEurope: number
  roe: number
  roce: number
  ros: number
  eps: number
  tsr: number
  dividendYield: number
  utilization?: number
  inventoryUnitsUS?: number
  inventoryUnitsAsia?: number
  inventoryUnitsEurope?: number
  promoUS?: number
  promoAsia?: number
  promoEurope?: number
  features?: number
  csrRating?: number
  trainingBudget?: number
}

export const toShareFraction = (value: number | undefined | null): number => {
  if (!value || Number.isNaN(value)) return 0
  return value > 1 ? value / 100 : value
}

export const normalizeTeamRow = (team: TeamLike, fallbackName: string, marketDemand: MarketDemandLike | null | undefined, baseSharePrice: number, parValuePerShare: number = 10): TeamRow => {
  const full = team?.fullResults || team
  const balanceSheet = full?.balanceSheet ?? team?.balanceSheet ?? {}
  const decisionProduction = full?.production ?? full?.decisions?.production ?? null
  const marketing = full?.decisions?.marketing ?? {}
  const hr = full?.decisions?.hr ?? {}
  const auditInventory = full?.inventoryTrace ?? full?.audit?.trace?.inventory ?? null
  const salesUS = full?.sales?.us?.units ?? 0
  const salesAsia = full?.sales?.asia?.units ?? 0
  const salesEurope = full?.sales?.europe?.units ?? 0
  const demandUS = marketDemand?.us ?? 0
  const demandAsia = marketDemand?.asia ?? 0
  const demandEurope = marketDemand?.europe ?? 0

  const marketShareUS = (demandUS > 0 ? salesUS / demandUS : toShareFraction(full?.marketShare?.us ?? 0)) * 100
  const marketShareAsia = (demandAsia > 0 ? salesAsia / demandAsia : toShareFraction(full?.marketShare?.asia ?? 0)) * 100
  const marketShareEurope = (demandEurope > 0 ? salesEurope / demandEurope : toShareFraction(full?.marketShare?.europe ?? 0)) * 100

  const revenue = full?.pnl?.revenue ?? 0
  const grossProfit = full?.pnl?.grossProfit ?? 0
  const netProfit = full?.pnl?.netProfit ?? 0
  const cogs = full?.pnl?.cogs ?? (revenue - grossProfit)
  const csrScore =
    full?.attractivenessBreakdown?.us?.csrScore ??
    full?.attractivenessBreakdown?.asia?.csrScore ??
    0
  const csrRating = csrScore > 0 ? csrScore / 25 : 0
  const features =
    full?.availableFeatures ??
    full?.rndProgress?.unlockedFeatureCount ??
    full?.gameState?.rndProgress?.unlockedFeatureCount ??
    0
  const trainingBudget =
    (hr?.us?.training ?? hr?.trainingUS ?? 0) +
    (hr?.asia?.training ?? hr?.trainingAsia ?? 0) +
    (hr?.europe?.training ?? hr?.trainingEurope ?? 0)

  return {
    teamId: team?.teamId ?? team?.id ?? team?.teamCode ?? fallbackName,
    teamName: team?.teamName ?? team?.name ?? fallbackName,
    sharePrice: full?.kpis?.sharePrice ?? baseSharePrice,
    sharesOutstanding: full?.kpis?.sharesOutstanding ?? (balanceSheet?.shareCapital ? balanceSheet.shareCapital / parValuePerShare : 0),
    dividends: full?.decisions?.finance?.dividends ?? 0,
    sharePriceTrace: full?.kpis?.sharePriceTrace ?? null,
    priceUS: full?.sales?.us?.price ?? 0,
    priceAsia: full?.sales?.asia?.price ?? 0,
    priceEurope: full?.sales?.europe?.price ?? 0,
    promoUS: marketing?.us?.promotionPct ?? marketing?.promoUS ?? marketing?.promotionUS ?? 0,
    promoAsia: marketing?.asia?.promotionPct ?? marketing?.promoAsia ?? marketing?.promotionAsia ?? 0,
    promoEurope: marketing?.europe?.promotionPct ?? marketing?.promoEurope ?? marketing?.promotionEurope ?? 0,
    features,
    csrRating,
    trainingBudget,
    revenueUS: full?.sales?.us?.revenue ?? 0,
    revenueAsia: full?.sales?.asia?.revenue ?? 0,
    revenueEurope: full?.sales?.europe?.revenue ?? 0,
    materials: full?.costs?.materials ?? 0,
    labor: full?.costs?.labor ?? 0,
    logistics: full?.costs?.logistics ?? 0,
    outsourcing: full?.costs?.outsourcing ?? 0,
    marketing: full?.costs?.marketing ?? 0,
    rnd: full?.costs?.rnd ?? 0,
    admin: full?.costs?.admin ?? 0,
    inventoryHolding: full?.costs?.inventoryHolding ?? full?.inventoryHolding ?? 0,
    revenue,
    cogs,
    grossProfit,
    grossMargin: full?.pnl?.grossMargin ?? (revenue > 0 ? (grossProfit / revenue) * 100 : 0),
    operatingExpenses: full?.pnl?.operatingExpenses ?? 0,
    ebitda: full?.pnl?.ebitda ?? grossProfit,
    depreciation: full?.pnl?.depreciation ?? full?.costs?.depreciation ?? 0,
    ebit: full?.pnl?.ebit ?? 0,
    interestExpense: full?.pnl?.interestExpense ?? full?.costs?.interest ?? 0,
    tax: full?.pnl?.tax ?? 0,
    taxLossCarryforward: full?.pnl?.taxLossCarryforwardEnd ?? full?.gameState?.taxLossCarryforward ?? 0,
    netProfit,
    netMargin: full?.pnl?.netMargin ?? (revenue > 0 ? (netProfit / revenue) * 100 : 0),
    fixedAssets: balanceSheet?.fixedAssets ?? full?.fixedAssets ?? team?.fixedAssets ?? 0,
    inventory: balanceSheet?.inventory ?? full?.inventory ?? team?.inventory ?? 0,
    receivables: balanceSheet?.receivables ?? full?.receivables ?? team?.receivables ?? 0,
    cash: balanceSheet?.cash ?? full?.cash ?? team?.cash ?? 0,
    totalAssets: balanceSheet?.totalAssets ?? full?.totalAssets ?? team?.totalAssets ?? 0,
    longTermDebt: balanceSheet?.longTermDebt ?? full?.longTermDebt ?? team?.longTermDebt ?? 0,
    shortTermLoans: balanceSheet?.shortTermLoans ?? full?.shortTermLoans ?? team?.shortTermLoans ?? 0,
    payables: balanceSheet?.payables ?? full?.payables ?? team?.payables ?? 0,
    totalLiabilities: balanceSheet?.totalLiabilities ?? full?.totalLiabilities ?? team?.totalLiabilities ?? 0,
    shareCapital: balanceSheet?.shareCapital ?? full?.shareCapital ?? team?.shareCapital ?? 0,
    retainedEarnings: balanceSheet?.retainedEarnings ?? full?.retainedEarnings ?? team?.retainedEarnings ?? 0,
    totalEquity: balanceSheet?.totalEquity ?? full?.totalEquity ?? team?.totalEquity ?? 0,
    inventoryUnits: full?.gameState?.inventory ?? 0,
    inventoryStartUnits: auditInventory?.startingUnits ?? undefined,
    inventoryEndUnits: auditInventory?.endingUnits ?? full?.gameState?.inventory ?? 0,
    unitsSold: full?.sales?.total?.units ?? 0,
    unitsSoldUS: salesUS,
    unitsSoldAsia: salesAsia,
    unitsSoldEurope: salesEurope,
    productionUS: (decisionProduction?.usFactoryUnits ?? decisionProduction?.usUnits ?? 0) + (decisionProduction?.outsourceUS ?? 0),
    productionAsia: (decisionProduction?.asiaFactoryUnits ?? decisionProduction?.asiaUnits ?? 0) + (decisionProduction?.outsourceAsia ?? 0),
    outsourceUS: decisionProduction?.outsourceUS ?? 0,
    outsourceAsia: decisionProduction?.outsourceAsia ?? 0,
    unitsProduced: full?.productionUnits ?? 0,
    marketShareUS,
    marketShareAsia,
    marketShareEurope,
    roe: toShareFraction(full?.ratios?.roe ?? 0),
    roce: toShareFraction(full?.ratios?.roce ?? 0),
    ros: toShareFraction(full?.ratios?.ros ?? 0),
    eps: full?.kpis?.eps ?? 0,
    tsr: full?.kpis?.tsr ?? 0,
    dividendYield: full?.kpis?.dividendYield ?? 0,
    utilization: full?.utilization ?? full?.kpis?.utilization ?? (
      full?.capacity?.totalCapacity
        ? (full?.productionUnits ?? 0) / full.capacity.totalCapacity
        : 0
    ),
    inventoryUnitsUS: full?.inventoryByRegion?.us ?? full?.gameState?.inventoryUS ?? 0,
    inventoryUnitsAsia: full?.inventoryByRegion?.asia ?? full?.gameState?.inventoryAsia ?? 0,
    inventoryUnitsEurope: full?.inventoryByRegion?.europe ?? full?.gameState?.inventoryEurope ?? 0,
  }
}
