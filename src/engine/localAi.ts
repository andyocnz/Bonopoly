import { GAME_CONFIG, type GameConfig, type RoundScenario } from './gameEngine'

type RegionFocus = 'global' | 'us' | 'asia' | 'europe'

type ScenarioTheme = {
  key: string
  name: string
  description: string
  hints: string[]
  econBase: { gdp: string; inflation: string; rates: string; pmi: string; currency: string }
  demandRange: { min: number; max: number }
  elasticityRange: { min: number; max: number }
  costInflationRange: { min: number; max: number }
  marketingEffectRange: { min: number; max: number }
  csrImportanceRange: { min: number; max: number }
  investmentCostRange: { min: number; max: number }
  interestSpreadRange: { min: number; max: number }
  taxDeltaRange: { min: number; max: number }
  workingCapitalRange: { min: number; max: number }
  useTariff?: boolean
}

const SCENARIO_THEMES: ScenarioTheme[] = [
  {
    key: 'demand_surge',
    name: 'Demand Surge',
    description: 'Consumer demand accelerates across the board.',
    hints: [
      '🚀 MARKET BOOM: Consumer sentiment hits a 2-year high as household wealth grows.',
      '📦 STRATEGIC TIP: Leaders with spare capacity can capture significant share.',
      '⚠️ COST WATCH: Avoid over-reliance on expensive overtime to meet the surge.'
    ],
    econBase: { gdp: '3.6% YoY', inflation: '2.1% YoY', rates: 'steady', pmi: '54.5', currency: 'neutral' },
    demandRange: { min: 4, max: 12 },
    elasticityRange: { min: 0.85, max: 1.05 },
    costInflationRange: { min: 1.0, max: 1.06 },
    marketingEffectRange: { min: 1.05, max: 1.2 },
    csrImportanceRange: { min: 0.9, max: 1.1 },
    investmentCostRange: { min: 0.95, max: 1.1 },
    interestSpreadRange: { min: -0.005, max: 0.015 },
    taxDeltaRange: { min: -0.01, max: 0.01 },
    workingCapitalRange: { min: 0.0, max: 0.05 },
  },
  {
    key: 'credit_tightening',
    name: 'Credit Tightening',
    description: 'Financing costs rise and demand moderates.',
    hints: [
      '🏦 CREDIT SQUEEZE: Central banks raise rates to cool overheating markets.',
      '💰 CASH IS KING: Watch your liquidity carefully and avoid aggressive expansion.',
      '🎯 MARGIN FOCUS: Price power beats volume in a high-cost environment.'
    ],
    econBase: { gdp: '0.8% YoY', inflation: '3.2% YoY', rates: 'rising', pmi: '49.8', currency: 'stronger' },
    demandRange: { min: -6, max: 2 },
    elasticityRange: { min: 1.1, max: 1.4 },
    costInflationRange: { min: 1.02, max: 1.08 },
    marketingEffectRange: { min: 0.9, max: 1.05 },
    csrImportanceRange: { min: 0.85, max: 1.05 },
    investmentCostRange: { min: 1.0, max: 1.2 },
    interestSpreadRange: { min: 0.015, max: 0.045 },
    taxDeltaRange: { min: -0.005, max: 0.015 },
    workingCapitalRange: { min: -0.02, max: 0.04 },
  },
  {
    key: 'green_wave',
    name: 'Green Regulation Wave',
    description: 'Sustainability rules tighten, lifting CSR sensitivity.',
    hints: [
      '🌱 ECO SHIFT: New environmental standards prioritize sustainable production.',
      '🏆 VALUE PLAY: CSR upgrades have higher payoffs and customer loyalty.',
      '📦 SUPPLY RISK: Low-cost suppliers could face regulatory scrutiny.'
    ],
    econBase: { gdp: '2.1% YoY', inflation: '2.4% YoY', rates: 'steady', pmi: '51.2', currency: 'neutral' },
    demandRange: { min: -2, max: 6 },
    elasticityRange: { min: 0.8, max: 1.1 },
    costInflationRange: { min: 1.04, max: 1.12 },
    marketingEffectRange: { min: 0.95, max: 1.1 },
    csrImportanceRange: { min: 1.4, max: 1.8 },
    investmentCostRange: { min: 1.0, max: 1.15 },
    interestSpreadRange: { min: 0.0, max: 0.02 },
    taxDeltaRange: { min: 0.0, max: 0.03 },
    workingCapitalRange: { min: 0.0, max: 0.05 },
  },
  {
    key: 'trade_shock',
    name: 'Trade Shock',
    description: 'Tariffs and logistics frictions ripple across regions.',
    hints: [
      '🛃 TARIFF BARRIERS: New cross-border duties increase the cost of global trade.',
      '🏭 LOCAL ADVANTAGE: Regional production gains significant cost advantage.',
      '🚢 LOGISTICS: Review logistics priorities as shipping lead times extend.'
    ],
    econBase: { gdp: '1.2% YoY', inflation: '3.5% YoY', rates: 'volatile', pmi: '48.5', currency: 'volatile' },
    demandRange: { min: -4, max: 4 },
    elasticityRange: { min: 1.0, max: 1.3 },
    costInflationRange: { min: 1.05, max: 1.15 },
    marketingEffectRange: { min: 0.9, max: 1.05 },
    csrImportanceRange: { min: 0.9, max: 1.1 },
    investmentCostRange: { min: 1.0, max: 1.2 },
    interestSpreadRange: { min: 0.005, max: 0.025 },
    taxDeltaRange: { min: -0.005, max: 0.01 },
    workingCapitalRange: { min: 0.02, max: 0.08 },
    useTariff: true,
  },
  {
    key: 'stable_growth',
    name: 'Steady Expansion',
    description: 'Balanced growth with manageable risk.',
    hints: [
      '📈 STEADY STATE: Economy continues on a predictable path of expansion.',
      '💎 QUALITY FOCUS: Incremental product quality and brand wins the round.',
      '⚖️ BALANCE: Maintain profitability while scaling and investing.'
    ],
    econBase: { gdp: '2.5% YoY', inflation: '2.0% YoY', rates: 'stable', pmi: '52.5', currency: 'neutral' },
    demandRange: { min: 1, max: 6 },
    elasticityRange: { min: 0.9, max: 1.1 },
    costInflationRange: { min: 0.98, max: 1.04 },
    marketingEffectRange: { min: 0.95, max: 1.1 },
    csrImportanceRange: { min: 0.9, max: 1.1 },
    investmentCostRange: { min: 0.95, max: 1.05 },
    interestSpreadRange: { min: -0.005, max: 0.01 },
    taxDeltaRange: { min: -0.005, max: 0.01 },
    workingCapitalRange: { min: -0.01, max: 0.02 },
  },
]

const stringToSeed = (seed: string) => {
  let hash = 2166136261
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

const seededRandom = (seed: string) => {
  let state = stringToSeed(seed) || 1
  return () => {
    state ^= state << 13
    state ^= state >>> 17
    state ^= state << 5
    return ((state >>> 0) % 1000) / 1000
  }
}

const pick = <T,>(rng: () => number, items: T[]) => items[Math.floor(rng() * items.length)]
const range = (rng: () => number, min: number, max: number) => min + (max - min) * rng()
const roundTo = (value: number, step: number) => Math.round(value / step) * step

type ScenarioOptions = {
  seed?: string
  baseId?: number
  regionFocus?: RegionFocus
  labels?: Record<RegionFocus, string>
}

export function generateLocalScenario(options: ScenarioOptions = {}, config: GameConfig = GAME_CONFIG): RoundScenario {
  void config
  const seed = options.seed?.trim() || `scenario-${Date.now()}`
  const rng = seededRandom(seed)
  const theme = pick(rng, SCENARIO_THEMES)
  const regionFocus = options.regionFocus ?? pick(rng, ['global', 'us', 'asia', 'europe'])
  const baseId = options.baseId ?? Math.floor(range(rng, 1000, 9999))

  // Map IDs to labels, prioritizing injected labels from UI for 1:1 parity with game settings
  const labels = options.labels || {
    us: 'Americas',
    asia: 'Asia',
    europe: 'Europe',
    global: 'Global'
  }

  const demandValue = roundTo(range(rng, theme.demandRange.min, theme.demandRange.max), 1)
  const regionShift = regionFocus !== 'global' ? 4 : 0

  const demandModifier = {
    us: demandValue + (regionFocus === 'us' ? regionShift : 0),
    asia: demandValue + (regionFocus === 'asia' ? regionShift : 0),
    europe: demandValue + (regionFocus === 'europe' ? regionShift : 0),
  }

  const priceElasticityModifier = roundTo(range(rng, theme.elasticityRange.min, theme.elasticityRange.max), 0.01)
  const csrImportanceModifier = roundTo(range(rng, theme.csrImportanceRange.min, theme.csrImportanceRange.max), 0.01)
  const marketingEffectModifier = roundTo(range(rng, theme.marketingEffectRange.min, theme.marketingEffectRange.max), 0.01)
  const costInflation = roundTo(range(rng, theme.costInflationRange.min, theme.costInflationRange.max), 0.01)
  const investmentCostMultiplier = roundTo(range(rng, theme.investmentCostRange.min, theme.investmentCostRange.max), 0.01)
  const interestRateSpread = roundTo(range(rng, theme.interestSpreadRange.min, theme.interestSpreadRange.max), 0.001)

  const taxRateDeltaByRegion = {
    us: roundTo(range(rng, theme.taxDeltaRange.min, theme.taxDeltaRange.max), 0.001),
    asia: roundTo(range(rng, theme.taxDeltaRange.min, theme.taxDeltaRange.max), 0.001),
    europe: roundTo(range(rng, theme.taxDeltaRange.min, theme.taxDeltaRange.max), 0.001),
  }

  const workingCapitalDelta = {
    inventory: roundTo(range(rng, theme.workingCapitalRange.min, theme.workingCapitalRange.max), 0.001),
    receivable: roundTo(range(rng, theme.workingCapitalRange.min, theme.workingCapitalRange.max), 0.001),
    payable: roundTo(range(rng, theme.workingCapitalRange.min, theme.workingCapitalRange.max), 0.001),
  }

  const logisticsTariff = theme.useTariff
    ? {
      usToAsia: roundTo(range(rng, 0.08, 0.25), 0.01),
      usToEurope: roundTo(range(rng, 0.05, 0.20), 0.01),
      asiaToUs: roundTo(range(rng, 0.08, 0.25), 0.01),
      asiaToEurope: roundTo(range(rng, 0.05, 0.25), 0.01),
    }
    : undefined

  const name = `${labels[regionFocus]} ${theme.name}`
  const description = `${theme.description} Potential impact is centered in the ${labels[regionFocus]} region.`
  const hints = [...theme.hints]

  const gdpVal = parseFloat(theme.econBase.gdp)
  const inflVal = parseFloat(theme.econBase.inflation)
  const pmiVal = parseFloat(theme.econBase.pmi)

  const econBrief = {
    gdp: `${theme.econBase.gdp} (${gdpVal > 2.5 ? 'above trend' : gdpVal < 1 ? 'cooling' : 'steady'})`,
    inflation: `${theme.econBase.inflation} (${inflVal > 2.5 ? 'elevated' : 'anchored'})`,
    rates: theme.econBase.rates === 'steady' ? 'Policy on hold' : theme.econBase.rates === 'rising' ? 'Hawkish tilt' : 'Volatile',
    pmi: `${theme.econBase.pmi} (${pmiVal > 50 ? 'expansion' : 'contraction'})`,
    currency: theme.econBase.currency === 'neutral'
      ? `${labels[regionFocus]} currency remains stable vs basket`
      : `${labels[regionFocus]} currency ${theme.econBase.currency === 'stronger' ? 'under buying pressure' : 'under volatility'}`,
  }

  return {
    id: baseId,
    name,
    description,
    hints,
    econBrief,
    demandModifier,
    priceElasticityModifier,
    csrImportanceModifier,
    marketingEffectModifier,
    costInflation,
    investmentCostMultiplier,
    interestRateSpread,
    taxRateDeltaByRegion,
    workingCapitalDelta,
    logisticsTariff,
  }
}

type CoachInput = {
  currentTeam?: CoachTeamLike
  previousTeam?: CoachTeamLike
  regionLabels?: { us: string; asia: string; europe: string }
  roundLabel?: string
}

type CoachTeamLike = {
  marketShare?: { us?: number; asia?: number; europe?: number }
  marketShareUS?: number
  marketShareAsia?: number
  marketShareEurope?: number
  attractivenessBreakdown?: {
    us?: { weightedComponents?: Record<string, number | undefined> }
    asia?: { weightedComponents?: Record<string, number | undefined> }
    europe?: { weightedComponents?: Record<string, number | undefined> }
  }
  netMargin?: number
  pnl?: { netMargin?: number }
  unitsSold?: number
  sales?: { total?: { units?: number } }
  inventoryUnits?: number
  gameState?: { inventory?: number; utilization?: number }
  utilization?: number
}

export function generateLocalCoachInsights(input: CoachInput): string[] {
  const output: string[] = []
  const current = input.currentTeam ?? {}
  const previous = input.previousTeam ?? {}
  const shareAvg = (Number(current.marketShare?.us ?? current.marketShareUS ?? 0) +
    Number(current.marketShare?.asia ?? current.marketShareAsia ?? 0) +
    Number(current.marketShare?.europe ?? current.marketShareEurope ?? 0)) / 3
  const prevShareAvg = (Number(previous.marketShare?.us ?? previous.marketShareUS ?? 0) +
    Number(previous.marketShare?.asia ?? previous.marketShareAsia ?? 0) +
    Number(previous.marketShare?.europe ?? previous.marketShareEurope ?? 0)) / 3
  const shareDelta = shareAvg - prevShareAvg
  if (Number.isFinite(shareDelta) && Math.abs(shareDelta) >= 0.5) {
    output.push(
      `Market share ${shareDelta >= 0 ? 'up' : 'down'} ${shareDelta.toFixed(1)} pts vs prior round.`
    )
  }
  const breakdown = current.attractivenessBreakdown ?? {}
  const components: Record<string, number> = { price: 0, tech: 0, features: 0, promotion: 0, training: 0, csr: 0 }
  let regionsSummed = 0
    ; (['us', 'asia', 'europe'] as Array<'us' | 'asia' | 'europe'>).forEach((region) => {
      const weighted = breakdown[region]?.weightedComponents
      if (!weighted) return
      components.price += weighted.price ?? 0
      components.tech += weighted.tech ?? 0
      components.features += weighted.features ?? 0
      components.promotion += weighted.promotion ?? 0
      components.training += weighted.training ?? 0
      components.csr += weighted.csr ?? 0
      regionsSummed += 1
    })
  if (regionsSummed > 0) {
    const averages = Object.entries(components).map(([key, value]) => ({
      key,
      value: value / regionsSummed,
    }))
    const sorted = averages.sort((a, b) => b.value - a.value)
    if (sorted[0]) output.push(`Strongest driver: ${sorted[0].key}.`)
    if (sorted[sorted.length - 1]) output.push(`Weakest driver: ${sorted[sorted.length - 1].key}.`)
  }
  const netMargin = current.netMargin ?? current.pnl?.netMargin
  if (typeof netMargin === 'number') {
    if (netMargin >= 15) output.push(`Profitability is healthy (${netMargin.toFixed(1)}% net margin).`)
    else if (netMargin <= 5) output.push(`Profitability is thin (${netMargin.toFixed(1)}% net margin).`)
  }
  const unitsSold = current.unitsSold ?? current.sales?.total?.units ?? 0
  const inventoryUnits = current.inventoryUnits ?? current.gameState?.inventory ?? 0
  const available = unitsSold + inventoryUnits
  if (available > 0) {
    const inventoryPct = (inventoryUnits / available) * 100
    if (inventoryPct >= 30) output.push(`Inventory holding is high (${inventoryPct.toFixed(0)}% of available units).`)
    else if (inventoryPct <= 5) output.push(`Inventory is lean (${inventoryPct.toFixed(0)}% of available units).`)
  }
  const utilization = current.utilization ?? current.gameState?.utilization
  if (typeof utilization === 'number') {
    const utilPct = utilization * 100
    if (utilPct <= 70) output.push(`Capacity utilization is low (${utilPct.toFixed(0)}%).`)
    else if (utilPct >= 90) output.push(`Capacity utilization is very high (${utilPct.toFixed(0)}%).`)
  }
  if (output.length === 0 && input.roundLabel) {
    output.push(`AI coach sees no major anomalies for ${input.roundLabel}.`)
  }
  return output
}
