/**
 * Decision Simulator - Master page for testing the game engine
 *
 * Layout: Each row is a decision area, each column is a team
 * All changes trigger real-time recalculation
 */

import { useState, useCallback, useMemo } from 'react'
import './DecisionSimulator.css'
import {
  calculateRound,
  createInitialGameState,
  formatCurrency,
  formatPercent,
  formatUnits,
  type RoundResults,
  type TeamResults,
  type TeamGameState,
  GAME_CONFIG,
  SCENARIOS,
} from '../engine/gameEngine'

// ============================================================================
// TYPES
// ============================================================================

export type RegionKey = 'us' | 'asia' | 'europe'

export interface ProductionDecision {
  // Demand forecast (growth % per market)
  demandForecast: { us: number; asia: number; europe: number }
  // Optional absolute-unit inputs (from DB decisions)
  usUnits?: number
  asiaUnits?: number
  outsourceUS?: number
  outsourceAsia?: number
  overtime?: number
  supplierUS?: number
  supplierAsia?: number
  // Production lines (4 lines: 2 US, 2 Asia) - each has its own tech level AND supplier
  productionLines: {
    us1: { techLevel: 1 | 2 | 3 | 4; supplierId: 1 | 2 | 3 | 4; units: number }
    us2: { techLevel: 1 | 2 | 3 | 4; supplierId: 1 | 2 | 3 | 4; units: number }
    asia1: { techLevel: 1 | 2 | 3 | 4; supplierId: 1 | 2 | 3 | 4; units: number }
    asia2: { techLevel: 1 | 2 | 3 | 4; supplierId: 1 | 2 | 3 | 4; units: number }
  }
  // Outsourcing
  outsource: { techLevel: 1 | 2 | 3 | 4; supplierId: 1 | 2 | 3 | 4; units: number }
}

export interface HRDecision {
  us: { employees: number; wage: number; training: number }
  asia: { employees: number; wage: number; training: number }
}

export type RnDDecision = {
  // R&D decisions are minimal - all research hours go to feature unlocking
  _reserved?: never
}

export interface InvestmentDecision {
  newPlantsUS: number
  newPlantsAsia: number
}

export interface LogisticsDecision {
  // Delivery priority: which market to serve first from each production region
  usPriority: [RegionKey, RegionKey, RegionKey]
  asiaPriority: [RegionKey, RegionKey, RegionKey]
}

export interface MarketingDecision {
  us: { price: number; features: number; promotionPct: number }
  asia: { price: number; features: number; promotionPct: number }
  europe: { price: number; features: number; promotionPct: number }
}

export interface FinanceDecision {
  transferPricing: { us: number; asia: number; europe: number } // 1.0 - 2.0
  longTermDebt: number // positive = borrow, negative = repay
  shareIssuance: number // positive = issue, negative = buyback
  dividends: number
}

export interface TeamDecisions {
  production: ProductionDecision
  hr: HRDecision
  rnd: RnDDecision
  investment: InvestmentDecision
  logistics: LogisticsDecision
  marketing: MarketingDecision
  finance: FinanceDecision
}

export interface TeamState {
  id: number
  name: string
  decisions: TeamDecisions
}

// ============================================================================
// DEFAULT VALUES
// ============================================================================

const DEFAULT_PRODUCTION: ProductionDecision = {
  demandForecast: { us: 0, asia: 0, europe: 0 },
  productionLines: {
    // US: 2 factories, allocate 80% capacity each = 720K capacity
    // Each line can have different tech level AND different supplier
    us1: { techLevel: 1, supplierId: 1, units: 80 },  // 80% allocation, Budget supplier
    us2: { techLevel: 1, supplierId: 1, units: 80 },  // 80% allocation, Budget supplier
    // Asia: 0 factories initially - these will have NO EFFECT until factories are built
    asia1: { techLevel: 1, supplierId: 1, units: 0 },  // No factories = no production
    asia2: { techLevel: 1, supplierId: 1, units: 0 },  // No factories = no production
  },
  outsource: { techLevel: 1, supplierId: 2, units: 0 },  // Outsource uses Standard supplier by default
}

const DEFAULT_HR: HRDecision = {
  // Research capacity: 100 workers × 1500 hrs = 150K hrs/round
  us: { employees: 50, wage: 5000, training: 50000 },
  asia: { employees: 50, wage: 2000, training: 30000 },
}

const DEFAULT_RND: RnDDecision = {
  // All research hours automatically go to feature development
}

const DEFAULT_INVESTMENT: InvestmentDecision = {
  newPlantsUS: 0,
  newPlantsAsia: 0,
}

const DEFAULT_LOGISTICS: LogisticsDecision = {
  usPriority: ['us', 'europe', 'asia'],
  asiaPriority: ['asia', 'europe', 'us'],
}

const DEFAULT_MARKETING: MarketingDecision = {
  // Start with 0 features (must research them first!)
  us: { price: 250, features: 0, promotionPct: 5 },
  asia: { price: 200, features: 0, promotionPct: 5 },
  europe: { price: 280, features: 0, promotionPct: 5 },
}

const DEFAULT_FINANCE: FinanceDecision = {
  transferPricing: { us: 1.0, asia: 1.0, europe: 1.0 },
  longTermDebt: 0,
  shareIssuance: 0,
  dividends: 0,
}

const DEFAULT_DECISIONS: TeamDecisions = {
  production: DEFAULT_PRODUCTION,
  hr: DEFAULT_HR,
  rnd: DEFAULT_RND,
  investment: DEFAULT_INVESTMENT,
  logistics: DEFAULT_LOGISTICS,
  marketing: DEFAULT_MARKETING,
  finance: DEFAULT_FINANCE,
}

// ============================================================================
// SUPPLIER DATA
// ============================================================================

// Suppliers with multiplier and CSR (environmental) ratings
// Multiplier comes from GAME_CONFIG.unitCosts.supplier
// CSR impacts demand - especially in Europe (25% weight), less in Asia (5%)
const SUPPLIERS = [
  { id: 1 as const, name: 'Budget', multiplier: GAME_CONFIG.unitCosts.supplier[1], csr: 1, csrLabel: 'Poor' },
  { id: 2 as const, name: 'Standard', multiplier: GAME_CONFIG.unitCosts.supplier[2], csr: 2, csrLabel: 'Basic' },
  { id: 3 as const, name: 'Eco-Friendly', multiplier: GAME_CONFIG.unitCosts.supplier[3], csr: 4, csrLabel: 'Excellent' },
  { id: 4 as const, name: 'Premium', multiplier: GAME_CONFIG.unitCosts.supplier[4], csr: 3, csrLabel: 'Good' },
]

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

interface NumberInputProps {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  prefix?: string
  suffix?: string
  width?: string
}

function NumberInput({ value, onChange, min, max, step = 1, prefix, suffix, width = '80px' }: NumberInputProps) {
  return (
    <span className="number-input-wrapper">
      {prefix && <span className="input-prefix">{prefix}</span>}
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        min={min}
        max={max}
        step={step}
        style={{ width }}
      />
      {suffix && <span className="input-suffix">{suffix}</span>}
    </span>
  )
}

interface SliderInputProps {
  value: number
  onChange: (value: number) => void
  min: number
  max: number
  step?: number
  showValue?: boolean
  suffix?: string
}

function SliderInput({ value, onChange, min, max, step = 1, showValue = true, suffix = '' }: SliderInputProps) {
  return (
    <span className="slider-input-wrapper">
      <input
        type="range"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        min={min}
        max={max}
        step={step}
      />
      {showValue && <span className="slider-value">{value}{suffix}</span>}
    </span>
  )
}

interface SelectInputProps {
  value: string | number
  onChange: (value: string | number) => void
  options: { value: string | number; label: string }[]
}

function SelectInput({ value, onChange, options }: SelectInputProps) {
  return (
    <select
      value={value}
      onChange={(e) => {
        const val = e.target.value
        // Try to parse as number if it looks like one
        const numVal = Number(val)
        onChange(isNaN(numVal) ? val : numVal)
      }}
    >
      {options.map((opt) => (
        <option key={String(opt.value)} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  )
}

// ============================================================================
// DECISION SECTION COMPONENTS
// ============================================================================

interface DecisionSectionProps {
  team: TeamState
  onUpdate: (decisions: Partial<TeamDecisions>) => void
  gameState?: TeamGameState  // Current game state (factories, R&D progress)
  teamResult?: TeamResults   // Results for budget display
  currentRound?: number      // Current round number
}

// --- MARKET FORECAST SECTION ---
function MarketForecastSection({ team, onUpdate, gameState, teamResult, currentRound = 0 }: DecisionSectionProps) {
  const { production } = team.decisions
  const scenario = SCENARIOS[currentRound] || SCENARIOS[0]
  const factories = gameState?.factories ?? { us: 2, asia: 0 }

  const { marketGrowthRate, capacityPerPlant } = GAME_CONFIG

  // Get previous round's data
  const prevResults = gameState?.previousRoundResults
  const prevSales =
    prevResults && 'sales' in prevResults
      ? prevResults.sales
      : teamResult?.sales
  const prevMarketShare =
    prevResults && 'marketShare' in prevResults
      ? prevResults.marketShare
      : teamResult?.marketShare

  // Previous round's actual sales per region
  const prevSalesUS = prevSales?.us.units ?? 0
  const prevSalesAsia = prevSales?.asia.units ?? 0
  const prevSalesEurope = prevSales?.europe.units ?? 0
  const prevTotalSales = prevSalesUS + prevSalesAsia + prevSalesEurope

  // Previous round's market share (as decimal)
  const defaultShare = 50 // Assume 2 teams in simulator, equal share
  const marketShareUS = (prevMarketShare?.us ?? defaultShare) / 100
  const marketShareAsia = (prevMarketShare?.asia ?? defaultShare) / 100
  const marketShareEurope = (prevMarketShare?.europe ?? defaultShare) / 100

  // Calculate previous round's TOTAL market from our sales and market share
  // Total market = Our sales / Our share (if we sold 360K with 50% share, total market was 720K)
  const prevTotalMarketUS = marketShareUS > 0 ? Math.round(prevSalesUS / marketShareUS) : 0
  const prevTotalMarketAsia = marketShareAsia > 0 ? Math.round(prevSalesAsia / marketShareAsia) : 0
  const prevTotalMarketEurope = marketShareEurope > 0 ? Math.round(prevSalesEurope / marketShareEurope) : 0
  const prevTotalMarket = prevTotalMarketUS + prevTotalMarketAsia + prevTotalMarketEurope

  // For Round 0 or if no previous data, estimate based on current production capacity
  const hasHistoricalData = prevTotalSales > 0
  const estimatedMarketFromCapacity = (factories.us + factories.asia) * capacityPerPlant * 0.8 * 2 // 2 teams, 80% utilization

  // Calculate THIS round's total market demand with growth + scenario modifiers
  const calculateThisRoundMarket = (region: 'us' | 'asia' | 'europe', prevMarket: number) => {
    // If no history, use capacity-based estimate distributed by typical market proportions
    const marketProportions = { us: 0.22, asia: 0.60, europe: 0.18 }
    const baseMarket = hasHistoricalData ? prevMarket : Math.round(estimatedMarketFromCapacity * marketProportions[region])

    // Apply growth: base growth + scenario modifier + user's forecast adjustment
    const userForecast = production.demandForecast[region]
    const baseGrowth = marketGrowthRate[region]
    const scenarioMod = scenario.demandModifier[region]
    const growthRate = (baseGrowth + scenarioMod + userForecast) / 100

    return Math.round(baseMarket * (1 + growthRate))
  }

  // This round's total market demand (all competitors)
  const totalMarketUS = calculateThisRoundMarket('us', prevTotalMarketUS)
  const totalMarketAsia = calculateThisRoundMarket('asia', prevTotalMarketAsia)
  const totalMarketEurope = calculateThisRoundMarket('europe', prevTotalMarketEurope)
  const totalMarketDemand = totalMarketUS + totalMarketAsia + totalMarketEurope

  // Expected sales = This round's market × Our share (assuming we maintain share)
  const expectedUS = Math.round(totalMarketUS * marketShareUS)
  const expectedAsia = Math.round(totalMarketAsia * marketShareAsia)
  const expectedEurope = Math.round(totalMarketEurope * marketShareEurope)
  const totalExpectedSales = expectedUS + expectedAsia + expectedEurope

  // Average market share for display
  const avgMarketShare = ((marketShareUS + marketShareAsia + marketShareEurope) / 3) * 100

  // Calculate current production capacity
  const lines = production.productionLines
  const us1Units = factories.us >= 1 ? Math.round(capacityPerPlant * lines.us1.units / 100) : 0
  const us2Units = factories.us >= 2 ? Math.round(capacityPerPlant * lines.us2.units / 100) : 0
  const asia1Units = factories.asia >= 1 ? Math.round(capacityPerPlant * lines.asia1.units / 100) : 0
  const asia2Units = factories.asia >= 2 ? Math.round(capacityPerPlant * lines.asia2.units / 100) : 0
  const factoryProduction = us1Units + us2Units + asia1Units + asia2Units
  const outsourceProduction = production.outsource.units
  const totalProduction = factoryProduction + outsourceProduction

  // Previous inventory (from game state)
  const previousInventory = gameState?.inventory ?? 0

  // Calculate inventory position (based on expected SALES, not total market)
  const availableToSell = totalProduction + previousInventory
  const inventoryGap = availableToSell - totalExpectedSales
  const hasShortage = inventoryGap < 0
  const hasExcess = inventoryGap > totalExpectedSales * 0.1 // More than 10% excess

  // User's demand forecast inputs
  const updateForecast = (region: 'us' | 'asia' | 'europe', value: number) => {
    onUpdate({
      production: {
        ...production,
        demandForecast: { ...production.demandForecast, [region]: value }
      }
    })
  }

  return (
    <div className="decision-section forecast-section">
      <div className="section-header">📊 Market Forecast</div>

      {/* Scenario Information */}
      <div style={{
        fontSize: '0.7rem',
        marginBottom: '0.5rem',
        padding: '0.5rem',
        background: 'linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%)',
        borderRadius: '6px',
        color: 'white'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
          <span style={{ fontWeight: 700, fontSize: '0.8rem' }}>Round {currentRound}: {scenario.name}</span>
          <span style={{ opacity: 0.8, fontSize: '0.6rem' }}>Scenario #{scenario.id}</span>
        </div>
        <div style={{ fontSize: '0.65rem', opacity: 0.9, marginBottom: '0.25rem' }}>
          {scenario.description}
        </div>
      </div>

      {/* Market Intelligence / Hints */}
      <div style={{
        fontSize: '0.65rem',
        marginBottom: '0.5rem',
        padding: '0.4rem',
        background: '#fef3c7',
        borderRadius: '4px',
        border: '1px solid #fcd34d'
      }}>
        <div style={{ fontWeight: 600, color: '#92400e', marginBottom: '0.25rem' }}>🔍 Market Intelligence:</div>
        <ul style={{ margin: 0, paddingLeft: '1rem', color: '#78350f' }}>
          {scenario.hints.map((hint, idx) => (
            <li key={idx} style={{ marginBottom: '0.15rem' }}>{hint}</li>
          ))}
        </ul>
      </div>

      {/* Demand Forecast Inputs */}
      <div style={{
        fontSize: '0.65rem',
        marginBottom: '0.5rem',
        padding: '0.4rem',
        background: '#f0f9ff',
        borderRadius: '4px',
        border: '1px solid #bae6fd'
      }}>
        <div style={{ fontWeight: 600, color: '#0369a1', marginBottom: '0.35rem' }}>
          📈 Your Demand Forecast (% change from last round):
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
          {(['us', 'asia', 'europe'] as const).map(region => {
            const forecast = production.demandForecast[region]
            return (
              <div key={region} style={{ textAlign: 'center' }}>
                <div style={{ fontWeight: 600, marginBottom: '0.2rem' }}>
                  {region === 'us' ? '🇺🇸 US' : region === 'asia' ? '🌏 Asia' : '🇪🇺 Europe'}
                </div>
                <div style={{ display: 'flex', gap: '0.15rem', justifyContent: 'center', marginBottom: '0.15rem' }}>
                  {[-10, -5, 0, 5, 10, 15].map(pct => (
                    <button
                      key={pct}
                      onClick={() => updateForecast(region, pct)}
                      style={{
                        padding: '0.2rem 0.35rem',
                        border: forecast === pct ? '2px solid #0369a1' : '1px solid #cbd5e1',
                        borderRadius: '3px',
                        background: forecast === pct ? '#0369a1' : 'white',
                        color: forecast === pct ? 'white' : '#1e293b',
                        fontSize: '0.55rem',
                        fontWeight: forecast === pct ? 600 : 400,
                        cursor: 'pointer',
                      }}
                    >
                      {pct > 0 ? `+${pct}%` : `${pct}%`}
                    </button>
                  ))}
                </div>
                <div style={{ fontSize: '0.5rem', color: '#64748b' }}>
                  Base growth: +{marketGrowthRate[region]}%
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Last Round Results */}
      <div style={{
        fontSize: '0.65rem',
        marginBottom: '0.5rem',
        padding: '0.4rem',
        background: '#e0f2fe',
        borderRadius: '4px',
        border: '1px solid #7dd3fc'
      }}>
        <div style={{ fontWeight: 600, color: '#0369a1', marginBottom: '0.25rem' }}>
          📊 Last Round Results:
        </div>

        {/* Your Sales */}
        <div style={{ marginBottom: '0.3rem' }}>
          <div style={{ fontSize: '0.55rem', color: '#64748b', marginBottom: '0.1rem' }}>Your Sales:</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.25rem', textAlign: 'center', fontSize: '0.6rem' }}>
            <div>
              <div style={{ color: '#64748b' }}>🇺🇸 US</div>
              <strong>{formatUnits(prevSalesUS)}</strong>
            </div>
            <div>
              <div style={{ color: '#64748b' }}>🌏 Asia</div>
              <strong>{formatUnits(prevSalesAsia)}</strong>
            </div>
            <div>
              <div style={{ color: '#64748b' }}>🇪🇺 Europe</div>
              <strong>{formatUnits(prevSalesEurope)}</strong>
            </div>
            <div style={{ background: '#0369a1', color: 'white', borderRadius: '4px', padding: '0.1rem' }}>
              <div style={{ opacity: 0.8, fontSize: '0.5rem' }}>TOTAL</div>
              <strong>{formatUnits(prevTotalSales)}</strong>
            </div>
          </div>
        </div>

        {/* Your Market Share */}
        <div>
          <div style={{ fontSize: '0.55rem', color: '#64748b', marginBottom: '0.1rem' }}>Your Market Share:</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.25rem', textAlign: 'center', fontSize: '0.6rem' }}>
            <div><strong>{(marketShareUS * 100).toFixed(1)}%</strong></div>
            <div><strong>{(marketShareAsia * 100).toFixed(1)}%</strong></div>
            <div><strong>{(marketShareEurope * 100).toFixed(1)}%</strong></div>
            <div style={{ background: '#64748b', color: 'white', borderRadius: '4px', padding: '0.1rem' }}>
              <strong>{avgMarketShare.toFixed(1)}%</strong>
            </div>
          </div>
        </div>

        {/* Implied Total Market */}
        {hasHistoricalData && (
          <div style={{ marginTop: '0.3rem', paddingTop: '0.2rem', borderTop: '1px dashed #7dd3fc' }}>
            <div style={{ fontSize: '0.55rem', color: '#64748b', marginBottom: '0.1rem' }}>
              Total Market (calculated: your sales ÷ your share):
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.25rem', textAlign: 'center', fontSize: '0.55rem' }}>
              <div>{formatUnits(prevTotalMarketUS)}</div>
              <div>{formatUnits(prevTotalMarketAsia)}</div>
              <div>{formatUnits(prevTotalMarketEurope)}</div>
              <div style={{ fontWeight: 600 }}>{formatUnits(prevTotalMarket)}</div>
            </div>
          </div>
        )}

        {!hasHistoricalData && (
          <div style={{ marginTop: '0.2rem', fontSize: '0.5rem', color: '#64748b', fontStyle: 'italic' }}>
            No historical data - using capacity-based estimate
          </div>
        )}
      </div>

      {/* Total Market Demand */}
      <div style={{
        fontSize: '0.65rem',
        marginBottom: '0.5rem',
        padding: '0.4rem',
        background: '#f8fafc',
        borderRadius: '4px',
        border: '1px solid #e2e8f0'
      }}>
        <div style={{ fontWeight: 600, color: '#1e3a5f', marginBottom: '0.25rem' }}>
          🌍 Total Market Demand (all competitors):
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.25rem', textAlign: 'center', fontSize: '0.6rem' }}>
          <div>
            <div style={{ color: '#64748b' }}>🇺🇸 US</div>
            <strong>{formatUnits(totalMarketUS)}</strong>
          </div>
          <div>
            <div style={{ color: '#64748b' }}>🌏 Asia</div>
            <strong>{formatUnits(totalMarketAsia)}</strong>
          </div>
          <div>
            <div style={{ color: '#64748b' }}>🇪🇺 Europe</div>
            <strong>{formatUnits(totalMarketEurope)}</strong>
          </div>
          <div style={{ background: '#64748b', color: 'white', borderRadius: '4px', padding: '0.15rem' }}>
            <div style={{ opacity: 0.8 }}>TOTAL</div>
            <strong>{formatUnits(totalMarketDemand)}</strong>
          </div>
        </div>
      </div>

      {/* Expected Sales (Your Share) */}
      <div style={{
        fontSize: '0.65rem',
        marginBottom: '0.5rem',
        padding: '0.4rem',
        background: '#dcfce7',
        borderRadius: '4px',
        border: '1px solid #86efac'
      }}>
        <div style={{ fontWeight: 600, color: '#166534', marginBottom: '0.25rem' }}>
          🎯 Your Expected Sales (Market × Your Share):
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.25rem', textAlign: 'center' }}>
          <div>
            <div style={{ color: '#64748b', fontSize: '0.55rem' }}>🇺🇸 US</div>
            <strong>{formatUnits(expectedUS)}</strong>
          </div>
          <div>
            <div style={{ color: '#64748b', fontSize: '0.55rem' }}>🌏 Asia</div>
            <strong>{formatUnits(expectedAsia)}</strong>
          </div>
          <div>
            <div style={{ color: '#64748b', fontSize: '0.55rem' }}>🇪🇺 Europe</div>
            <strong>{formatUnits(expectedEurope)}</strong>
          </div>
          <div style={{ background: '#166534', color: 'white', borderRadius: '4px', padding: '0.2rem' }}>
            <div style={{ opacity: 0.8, fontSize: '0.55rem' }}>TOTAL</div>
            <strong>{formatUnits(totalExpectedSales)}</strong>
          </div>
        </div>
        <div style={{ fontSize: '0.5rem', color: '#64748b', marginTop: '0.2rem', textAlign: 'center', fontStyle: 'italic' }}>
          Based on maintaining your current market share
        </div>
      </div>

      {/* Production vs Demand / Inventory Position */}
      <div style={{
        fontSize: '0.65rem',
        padding: '0.4rem',
        background: hasShortage ? '#fee2e2' : hasExcess ? '#fef3c7' : '#f0fdf4',
        borderRadius: '4px',
        border: `1px solid ${hasShortage ? '#fca5a5' : hasExcess ? '#fcd34d' : '#86efac'}`
      }}>
        <div style={{ fontWeight: 600, color: hasShortage ? '#991b1b' : hasExcess ? '#92400e' : '#166534', marginBottom: '0.35rem' }}>
          {hasShortage ? '⚠️ Production Shortage!' : hasExcess ? '📦 Excess Inventory' : '✅ Balanced Production'}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.15rem' }}>
          <span>Previous Inventory:</span>
          <strong>{formatUnits(previousInventory)}</strong>

          <span>+ This Round Production:</span>
          <strong>{formatUnits(totalProduction)}</strong>

          <span style={{ borderTop: '1px solid currentColor', paddingTop: '0.15rem' }}>= Available to Sell:</span>
          <strong style={{ borderTop: '1px solid currentColor', paddingTop: '0.15rem' }}>{formatUnits(availableToSell)}</strong>

          <span>- Expected Sales:</span>
          <strong>{formatUnits(totalExpectedSales)}</strong>

          <span style={{ borderTop: '2px solid currentColor', paddingTop: '0.15rem', fontWeight: 600 }}>
            = {inventoryGap >= 0 ? 'Ending Inventory:' : 'Shortage:'}
          </span>
          <strong style={{
            borderTop: '2px solid currentColor',
            paddingTop: '0.15rem',
            color: hasShortage ? '#dc2626' : hasExcess ? '#f59e0b' : '#16a34a'
          }}>
            {hasShortage ? `-${formatUnits(Math.abs(inventoryGap))}` : formatUnits(inventoryGap)}
          </strong>
        </div>

        {hasShortage && (
          <div style={{ marginTop: '0.35rem', fontSize: '0.6rem', color: '#991b1b' }}>
            💡 <strong>Action needed:</strong> Increase production or outsourcing. Lost sales hurt revenue and market share!
          </div>
        )}
        {hasExcess && (
          <div style={{ marginTop: '0.35rem', fontSize: '0.6rem', color: '#92400e' }}>
            💡 <strong>Consider:</strong> Reduce production to avoid inventory carrying costs, or lower prices to stimulate demand.
          </div>
        )}
      </div>
    </div>
  )
}

// --- PRODUCTION SECTION ---
function ProductionSection({ team, onUpdate, gameState, teamResult }: DecisionSectionProps) {
  const { production, marketing } = team.decisions
  const factories = gameState?.factories ?? { us: 2, asia: 0 }
  const unlockedTechLevel = gameState?.rndProgress.unlockedTechLevel ?? 1

  const updateProduction = (updates: Partial<ProductionDecision>) => {
    onUpdate({ production: { ...production, ...updates } })
  }

  // Helper to update a specific production line
  const updateLine = (
    line: 'us1' | 'us2' | 'asia1' | 'asia2',
    field: 'units' | 'techLevel' | 'supplierId',
    value: number
  ) => {
    updateProduction({
      productionLines: {
        ...production.productionLines,
        [line]: { ...production.productionLines[line], [field]: value }
      }
    })
  }

  // Calculate actual capacity and utilization
  const usCapacity = factories.us * GAME_CONFIG.capacityPerPlant
  const asiaCapacity = factories.asia * GAME_CONFIG.capacityPerPlant
  const totalMaxCapacity = usCapacity + asiaCapacity
  const maxOutsource = GAME_CONFIG.outsourcing.maxCapacityUS
  const outsourcePremium = GAME_CONFIG.outsourcing.costPremium // 30%

  // Calculate units per factory line
  const lines = production.productionLines
  const us1Units = factories.us >= 1 ? Math.round(GAME_CONFIG.capacityPerPlant * lines.us1.units / 100) : 0
  const us2Units = factories.us >= 2 ? Math.round(GAME_CONFIG.capacityPerPlant * lines.us2.units / 100) : 0
  const asia1Units = factories.asia >= 1 ? Math.round(GAME_CONFIG.capacityPerPlant * lines.asia1.units / 100) : 0
  const asia2Units = factories.asia >= 2 ? Math.round(GAME_CONFIG.capacityPerPlant * lines.asia2.units / 100) : 0

  const usAllocatedCapacity = us1Units + us2Units
  const asiaAllocatedCapacity = asia1Units + asia2Units
  const totalAllocated = usAllocatedCapacity + asiaAllocatedCapacity

  // Calculate utilization-based cost adjustment
  const utilization = totalMaxCapacity > 0 ? totalAllocated / totalMaxCapacity : 0
  const costMultiplier =
    1 + GAME_CONFIG.costCurve.curvature * Math.pow(utilization - GAME_CONFIG.costCurve.optimalUtilization, 2)
  const effectiveCostMultiplier = costMultiplier

  // Calculate cost per line (each line has its own supplier and tech)
  const materialCostUS = GAME_CONFIG.unitCosts.directMaterialUS
  const materialCostAsia = GAME_CONFIG.unitCosts.directMaterialAsia
  const laborCostUS = GAME_CONFIG.unitCosts.directLabourUS
  const laborCostAsia = GAME_CONFIG.unitCosts.directLabourAsia
  const materialCost = (materialCostUS + materialCostAsia) / 2
  const laborCost = (laborCostUS + laborCostAsia) / 2

  const calcLineCost = (line: typeof lines.us1, region: 'us' | 'asia') => {
    const supplierMultiplier = GAME_CONFIG.unitCosts.supplier[line.supplierId]
    const techMult = GAME_CONFIG.techCostMultiplier[line.techLevel]
    const materialCost = region === 'us' ? materialCostUS : materialCostAsia
    const laborCost = region === 'us' ? laborCostUS : laborCostAsia
    const baseCost = (materialCost + laborCost) * supplierMultiplier
    return baseCost * effectiveCostMultiplier * techMult
  }

  // Weighted average unit cost
  const totalUnitsForAvg = us1Units + us2Units + asia1Units + asia2Units || 1
  const avgUnitCost = (
    (us1Units * calcLineCost(lines.us1, 'us')) +
    (us2Units * calcLineCost(lines.us2, 'us')) +
    (asia1Units * calcLineCost(lines.asia1, 'asia')) +
    (asia2Units * calcLineCost(lines.asia2, 'asia'))
  ) / totalUnitsForAvg

  // Outsource cost calculation
  const outsourceSupplierMultiplier = GAME_CONFIG.unitCosts.supplier[production.outsource.supplierId]
  const outsourceBaseCost = (materialCostUS + laborCostUS) * outsourceSupplierMultiplier
  const outsourceTechMultiplier = GAME_CONFIG.techCostMultiplier[production.outsource.techLevel]
  const outsourceUnitCost = outsourceBaseCost * (1 + outsourcePremium) * outsourceTechMultiplier

  // Find optimal utilization (minimum cost multiplier)
  const optimalUtil = GAME_CONFIG.costCurve.optimalUtilization

  // Options for dropdowns
  const techOptions = [1, 2, 3, 4].filter(t => t <= unlockedTechLevel).map(t => ({
    value: t,
    label: `Tech ${t}`
  }))

  const supplierOptions = SUPPLIERS.map(s => ({
    value: s.id,
    label: `${s.name} (x${s.multiplier.toFixed(2)})`
  }))

  // Calculate margin per market
  const marginUS = marketing.us.price - avgUnitCost
  const marginAsia = marketing.asia.price - avgUnitCost
  const marginEurope = marketing.europe.price - avgUnitCost

  // Get supplier name for display
  const getSupplierInfo = (id: 1 | 2 | 3 | 4) => SUPPLIERS.find(s => s.id === id)!

  return (
    <div className="decision-section production-section">
      <div className="section-header">Production</div>

      {/* MARKET ASSUMPTIONS - Plain Language Explanations */}
      <div style={{ fontSize: '0.55rem', marginBottom: '0.5rem', padding: '0.4rem', background: '#e0f2fe', borderRadius: '4px', border: '1px solid #7dd3fc', color: '#0369a1' }}>
        <div style={{ fontWeight: 700, marginBottom: '0.3rem', fontSize: '0.6rem' }}>How Customers Choose Products (Market Assumptions):</div>

        <div style={{ marginBottom: '0.3rem' }}>
          <strong>Supplier CSR/Environment Impact on Sales:</strong>
          <ul style={{ margin: '0.1rem 0', paddingLeft: '1rem' }}>
            <li><strong>Europe cares most about environment</strong> - 25% of their decision is based on your supplier's CSR rating. Use Eco-Friendly supplier to win European customers!</li>
            <li><strong>US cares moderately</strong> - 15% of their decision considers CSR. Good CSR helps but isn't critical.</li>
            <li><strong>Asia cares least about CSR</strong> - Only 5% weight. They prioritize low prices over environment. Budget supplier works fine here.</li>
          </ul>
        </div>

        <div style={{ marginBottom: '0.3rem' }}>
          <strong>Technology Level Impact:</strong>
          <ul style={{ margin: '0.1rem 0', paddingLeft: '1rem' }}>
            <li><strong>Higher tech = better quality product</strong> - Customers prefer Tech 4 over Tech 1</li>
            <li><strong>But higher tech costs more to produce</strong> - Tech 1: no extra cost | Tech 2: +15% | Tech 3: +35% | Tech 4: +60%</li>
            <li><strong>US values quality most</strong> (30% weight) - Worth investing in higher tech for US market</li>
          </ul>
        </div>

        <div>
          <strong>Capacity Utilization Impact:</strong>
          <ul style={{ margin: '0.1rem 0', paddingLeft: '1rem' }}>
            <li><strong>Optimal: ~{(optimalUtil * 100).toFixed(0)}% capacity</strong> - Lowest cost per unit</li>
            <li><strong>Too low (under 50%)</strong> - Factory overhead spread over fewer units = higher cost</li>
            <li><strong>Too high (over 90%)</strong> - Overtime pay, rush orders = higher cost</li>
          </ul>
        </div>
      </div>

      {/* SUPPLIER REFERENCE - Quick comparison */}
      <div style={{ fontSize: '0.55rem', marginBottom: '0.4rem', padding: '0.35rem', background: '#faf5ff', borderRadius: '4px', border: '1px solid #d8b4fe', color: '#7c3aed' }}>
        <div style={{ fontWeight: 700, marginBottom: '0.15rem' }}>Supplier Options (select per factory line below):</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.2rem' }}>
          {SUPPLIERS.map(s => (
            <div key={s.id} style={{ padding: '0.2rem', background: 'rgba(139, 92, 246, 0.1)', borderRadius: '3px', textAlign: 'center' }}>
              <div style={{ fontWeight: 600 }}>{s.name}</div>
              <div>x{s.multiplier.toFixed(2)} cost</div>
              <div style={{
                color: s.csr >= 4 ? '#16a34a' : s.csr >= 3 ? '#ca8a04' : s.csr >= 2 ? '#ea580c' : '#dc2626',
                fontWeight: 600
              }}>CSR: {s.csrLabel}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Utilization Gauge */}
      <div style={{ marginBottom: '0.4rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6rem', marginBottom: '0.1rem' }}>
          <span>Factory Utilization: <strong>{(utilization * 100).toFixed(0)}%</strong></span>
          <span style={{ color: '#16a34a' }}>Optimal: ~{(optimalUtil * 100).toFixed(0)}%</span>
          <span>Cost Adj: <strong style={{ color: effectiveCostMultiplier <= 1.0 ? '#16a34a' : '#dc2626' }}>
            {effectiveCostMultiplier <= 1.0 ? '' : '+'}{((effectiveCostMultiplier - 1) * 100).toFixed(0)}%
          </strong></span>
        </div>
        <div style={{ height: '8px', background: '#e5e7eb', borderRadius: '4px', position: 'relative', overflow: 'hidden' }}>
          <div style={{
            position: 'absolute',
            left: `${Math.max(0, (optimalUtil - 0.1) * 100)}%`,
            width: '20%',
            height: '100%',
            background: 'rgba(34, 197, 94, 0.3)'
          }} />
          <div style={{
            width: `${utilization * 100}%`,
            height: '100%',
            background: utilization >= optimalUtil - 0.1 && utilization <= optimalUtil + 0.1 ? '#22c55e' : '#f59e0b',
            borderRadius: '4px'
          }} />
        </div>
      </div>

      {/* FACTORY LINES - Each with capacity, tech, AND supplier */}
      <div style={{ marginBottom: '0.4rem' }}>
        <div style={{ fontSize: '0.6rem', fontWeight: 600, color: '#1e3a5f', marginBottom: '0.2rem', background: '#f1f5f9', padding: '0.2rem 0.3rem', borderRadius: '3px' }}>
          US FACTORIES ({factories.us}) - Total: {formatUnits(usAllocatedCapacity)} units
        </div>

        {factories.us >= 1 && (
          <FactoryLineRow
            label="Factory 1"
            line={lines.us1}
            units={us1Units}
            unitCost={calcLineCost(lines.us1, 'us')}
            onUnitsChange={(v) => updateLine('us1', 'units', v)}
            onTechChange={(v) => updateLine('us1', 'techLevel', v)}
            onSupplierChange={(v) => updateLine('us1', 'supplierId', v)}
            techOptions={techOptions}
            supplierOptions={supplierOptions}
            getSupplierInfo={getSupplierInfo}
          />
        )}

        {factories.us >= 2 && (
          <FactoryLineRow
            label="Factory 2"
            line={lines.us2}
            units={us2Units}
            unitCost={calcLineCost(lines.us2, 'us')}
            onUnitsChange={(v) => updateLine('us2', 'units', v)}
            onTechChange={(v) => updateLine('us2', 'techLevel', v)}
            onSupplierChange={(v) => updateLine('us2', 'supplierId', v)}
            techOptions={techOptions}
            supplierOptions={supplierOptions}
            getSupplierInfo={getSupplierInfo}
          />
        )}

        {factories.us === 0 && (
          <div style={{ color: '#dc2626', fontStyle: 'italic', fontSize: '0.6rem', padding: '0.3rem' }}>
            No US factories yet - go to Investment to build!
          </div>
        )}
      </div>

      <div style={{ marginBottom: '0.4rem', opacity: factories.asia === 0 ? 0.5 : 1 }}>
        <div style={{ fontSize: '0.6rem', fontWeight: 600, color: factories.asia === 0 ? '#dc2626' : '#1e3a5f', marginBottom: '0.2rem', background: '#f1f5f9', padding: '0.2rem 0.3rem', borderRadius: '3px' }}>
          ASIA FACTORIES ({factories.asia}) {factories.asia > 0 ? `- Total: ${formatUnits(asiaAllocatedCapacity)} units` : '- NONE (go to Investment!)'}
        </div>

        {factories.asia >= 1 && (
          <FactoryLineRow
            label="Factory 1"
            line={lines.asia1}
            units={asia1Units}
            unitCost={calcLineCost(lines.asia1, 'asia')}
            onUnitsChange={(v) => updateLine('asia1', 'units', v)}
            onTechChange={(v) => updateLine('asia1', 'techLevel', v)}
            onSupplierChange={(v) => updateLine('asia1', 'supplierId', v)}
            techOptions={techOptions}
            supplierOptions={supplierOptions}
            getSupplierInfo={getSupplierInfo}
          />
        )}

        {factories.asia >= 2 && (
          <FactoryLineRow
            label="Factory 2"
            line={lines.asia2}
            units={asia2Units}
            unitCost={calcLineCost(lines.asia2, 'asia')}
            onUnitsChange={(v) => updateLine('asia2', 'units', v)}
            onTechChange={(v) => updateLine('asia2', 'techLevel', v)}
            onSupplierChange={(v) => updateLine('asia2', 'supplierId', v)}
            techOptions={techOptions}
            supplierOptions={supplierOptions}
            getSupplierInfo={getSupplierInfo}
          />
        )}
      </div>

      {/* Outsource */}
      <div style={{ marginBottom: '0.4rem' }}>
        <div style={{ fontSize: '0.6rem', fontWeight: 600, color: '#b45309', marginBottom: '0.2rem', background: '#fef3c7', padding: '0.2rem 0.3rem', borderRadius: '3px' }}>
          OUTSOURCE (max {formatUnits(maxOutsource)}) - +30% cost premium
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.25rem', background: '#fffbeb', borderRadius: '4px', flexWrap: 'wrap' }}>
          <NumberInput
            value={production.outsource.units}
            onChange={(v) => updateProduction({
              outsource: { ...production.outsource, units: Math.min(Math.max(0, v), maxOutsource) }
            })}
            min={0}
            max={maxOutsource}
            step={10000}
            width="65px"
          />
          <SelectInput
            value={production.outsource.techLevel}
            onChange={(v) => updateProduction({
              outsource: { ...production.outsource, techLevel: v as 1 | 2 | 3 | 4 }
            })}
            options={techOptions}
          />
          <SelectInput
            value={production.outsource.supplierId}
            onChange={(v) => updateProduction({
              outsource: { ...production.outsource, supplierId: v as 1 | 2 | 3 | 4 }
            })}
            options={supplierOptions}
          />
          <span style={{ fontSize: '0.55rem', color: '#92400e' }}>
            = <strong>${outsourceUnitCost.toFixed(2)}/unit</strong>
          </span>
        </div>
      </div>

      {/* COST SUMMARY & MARGINS */}
      {(() => {
        // Get costs from team result if available
        const costs = teamResult?.costs
        const sales = teamResult?.sales
        const totalUnits = sales?.total.units || (totalAllocated + production.outsource.units) || 1
        const inHouseUnitsForSupplier = us1Units + us2Units + asia1Units + asia2Units
        const avgSupplierMultiplier = inHouseUnitsForSupplier > 0
          ? (
            (us1Units * GAME_CONFIG.unitCosts.supplier[lines.us1.supplierId]) +
            (us2Units * GAME_CONFIG.unitCosts.supplier[lines.us2.supplierId]) +
            (asia1Units * GAME_CONFIG.unitCosts.supplier[lines.asia1.supplierId]) +
            (asia2Units * GAME_CONFIG.unitCosts.supplier[lines.asia2.supplierId])
          ) / inHouseUnitsForSupplier
          : GAME_CONFIG.unitCosts.supplier[lines.us1.supplierId]

        // Calculate per-unit costs for each category
        const rndPerUnit = costs ? costs.rnd / totalUnits : 0
        const marketingPerUnit = costs ? costs.marketing / totalUnits : 0
        const adminPerUnit = costs ? costs.admin / totalUnits : 0
        const inventoryHoldingPerUnit = costs ? (costs.inventoryHolding ?? 0) / totalUnits : 0
        const logisticsPerUnit = costs ? costs.logistics / totalUnits : 0
        const depreciationPerUnit = costs ? costs.depreciation / totalUnits : 0
        const interestPerUnit = costs ? costs.interest / totalUnits : 0

        // Total fully-loaded cost per unit
        const fullyLoadedCost = avgUnitCost + rndPerUnit + marketingPerUnit + adminPerUnit + inventoryHoldingPerUnit + logisticsPerUnit + depreciationPerUnit + interestPerUnit

        // Calculate full margins (price - fully loaded cost)
        const fullMarginUS = marketing.us.price - fullyLoadedCost
        const fullMarginAsia = marketing.asia.price - fullyLoadedCost
        const fullMarginEurope = marketing.europe.price - fullyLoadedCost

        return (
          <>
            {/* Production Cost Breakdown */}
            <div style={{ fontSize: '0.55rem', marginBottom: '0.3rem', padding: '0.35rem', background: '#f8fafc', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontWeight: 700, color: '#1e3a5f', marginBottom: '0.2rem' }}>📊 Full Unit Cost Breakdown</div>

              {/* Production Costs */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.1rem', marginBottom: '0.15rem' }}>
                <span style={{ color: '#64748b' }}>Material:</span>
                <strong>${materialCost.toFixed(2)} × {avgSupplierMultiplier.toFixed(2)} = ${(materialCost * avgSupplierMultiplier).toFixed(2)}</strong>
                <span style={{ color: '#64748b' }}>Labor:</span>
                <strong>${laborCost.toFixed(2)} × {avgSupplierMultiplier.toFixed(2)} = ${(laborCost * avgSupplierMultiplier).toFixed(2)}</strong>
                <span style={{ color: '#64748b' }}>Capacity Adj ({(utilization * 100).toFixed(0)}%):</span>
                <strong>×{effectiveCostMultiplier.toFixed(2)}</strong>
              </div>
              <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '0.15rem', marginTop: '0.1rem', display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.1rem' }}>
                <span style={{ fontWeight: 600, color: '#1e3a5f' }}>= Production Cost:</span>
                <strong style={{ color: '#1e3a5f' }}>${avgUnitCost.toFixed(2)}</strong>
              </div>

              {/* Overhead Costs */}
              {costs && (
                <>
                  <div style={{ borderTop: '1px dashed #cbd5e1', paddingTop: '0.15rem', marginTop: '0.15rem', marginBottom: '0.1rem', fontWeight: 600, color: '#64748b', fontSize: '0.5rem' }}>
                    + OVERHEAD COSTS (per unit):
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.1rem' }}>
                    <span style={{ color: '#7c3aed' }}>R&D:</span>
                    <strong style={{ color: '#7c3aed' }}>${rndPerUnit.toFixed(2)}</strong>
                    <span style={{ color: '#ea580c' }}>Marketing:</span>
                    <strong style={{ color: '#ea580c' }}>${marketingPerUnit.toFixed(2)}</strong>
                    <span style={{ color: '#0891b2' }}>Logistics:</span>
                    <strong style={{ color: '#0891b2' }}>${logisticsPerUnit.toFixed(2)}</strong>
                    <span style={{ color: '#64748b' }}>Admin:</span>
                    <strong>${adminPerUnit.toFixed(2)}</strong>
                    <span style={{ color: '#64748b' }}>Inventory Holding:</span>
                    <strong>${inventoryHoldingPerUnit.toFixed(2)}</strong>
                    <span style={{ color: '#64748b' }}>Depreciation:</span>
                    <strong>${depreciationPerUnit.toFixed(2)}</strong>
                    <span style={{ color: '#dc2626' }}>Interest:</span>
                    <strong style={{ color: '#dc2626' }}>${interestPerUnit.toFixed(2)}</strong>
                  </div>
                  <div style={{ borderTop: '2px solid #1e3a5f', paddingTop: '0.15rem', marginTop: '0.15rem', display: 'grid', gridTemplateColumns: '1fr auto' }}>
                    <span style={{ fontWeight: 700, color: '#1e3a5f' }}>= FULLY LOADED COST:</span>
                    <strong style={{ color: '#1e3a5f', fontSize: '0.6rem' }}>${fullyLoadedCost.toFixed(2)}</strong>
                  </div>
                </>
              )}
            </div>

            {/* Margin Summary Table */}
            <div style={{ fontSize: '0.55rem', marginBottom: '0.3rem', padding: '0.35rem', background: '#dcfce7', borderRadius: '4px', border: '1px solid #86efac' }}>
              <div style={{ fontWeight: 700, color: '#166534', marginBottom: '0.2rem' }}>💰 Margin Analysis by Market</div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ color: '#166534', borderBottom: '1px solid #86efac' }}>
                    <th style={{ textAlign: 'left', padding: '0.1rem' }}>Market</th>
                    <th style={{ textAlign: 'right', padding: '0.1rem' }}>Price</th>
                    <th style={{ textAlign: 'right', padding: '0.1rem' }}>Gross Margin</th>
                    <th style={{ textAlign: 'right', padding: '0.1rem' }}>Net Margin</th>
                  </tr>
                </thead>
                <tbody style={{ color: '#15803d' }}>
                  <tr>
                    <td style={{ padding: '0.1rem' }}>🇺🇸 US</td>
                    <td style={{ textAlign: 'right' }}>${marketing.us.price}</td>
                    <td style={{ textAlign: 'right', color: marginUS >= 0 ? '#16a34a' : '#dc2626' }}>
                      ${marginUS.toFixed(2)} ({marketing.us.price > 0 ? ((marginUS / marketing.us.price) * 100).toFixed(0) : 0}%)
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: fullMarginUS >= 0 ? '#16a34a' : '#dc2626' }}>
                      ${fullMarginUS.toFixed(2)} ({marketing.us.price > 0 ? ((fullMarginUS / marketing.us.price) * 100).toFixed(0) : 0}%)
                    </td>
                  </tr>
                  <tr>
                    <td style={{ padding: '0.1rem' }}>🌏 Asia</td>
                    <td style={{ textAlign: 'right' }}>${marketing.asia.price}</td>
                    <td style={{ textAlign: 'right', color: marginAsia >= 0 ? '#16a34a' : '#dc2626' }}>
                      ${marginAsia.toFixed(2)} ({marketing.asia.price > 0 ? ((marginAsia / marketing.asia.price) * 100).toFixed(0) : 0}%)
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: fullMarginAsia >= 0 ? '#16a34a' : '#dc2626' }}>
                      ${fullMarginAsia.toFixed(2)} ({marketing.asia.price > 0 ? ((fullMarginAsia / marketing.asia.price) * 100).toFixed(0) : 0}%)
                    </td>
                  </tr>
                  <tr>
                    <td style={{ padding: '0.1rem' }}>🇪🇺 Europe</td>
                    <td style={{ textAlign: 'right' }}>${marketing.europe.price}</td>
                    <td style={{ textAlign: 'right', color: marginEurope >= 0 ? '#16a34a' : '#dc2626' }}>
                      ${marginEurope.toFixed(2)} ({marketing.europe.price > 0 ? ((marginEurope / marketing.europe.price) * 100).toFixed(0) : 0}%)
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: fullMarginEurope >= 0 ? '#16a34a' : '#dc2626' }}>
                      ${fullMarginEurope.toFixed(2)} ({marketing.europe.price > 0 ? ((fullMarginEurope / marketing.europe.price) * 100).toFixed(0) : 0}%)
                    </td>
                  </tr>
                </tbody>
              </table>
              <div style={{ marginTop: '0.15rem', fontSize: '0.45rem', color: '#64748b' }}>
                <strong>Gross Margin</strong> = Price - Production Cost | <strong>Net Margin</strong> = Price - All Costs (fully loaded)
              </div>
            </div>
          </>
        )
      })()}

      <div className="section-summary">
        Total Production: <strong>{formatUnits(totalAllocated + production.outsource.units)}</strong>
        {production.outsource.units > 0 && (
          <span style={{ fontSize: '0.65rem', color: '#b45309' }}> ({formatUnits(production.outsource.units)} outsourced)</span>
        )}
      </div>
    </div>
  )
}

// Helper component for factory line row
function FactoryLineRow({
  label, line, units, unitCost,
  onUnitsChange, onTechChange, onSupplierChange,
  techOptions, supplierOptions, getSupplierInfo
}: {
  label: string
  line: { techLevel: 1 | 2 | 3 | 4; supplierId: 1 | 2 | 3 | 4; units: number }
  units: number
  unitCost: number
  onUnitsChange: (v: number) => void
  onTechChange: (v: number) => void
  onSupplierChange: (v: number) => void
  techOptions: { value: number; label: string }[]
  supplierOptions: { value: number; label: string }[]
  getSupplierInfo: (id: 1 | 2 | 3 | 4) => { name: string; multiplier: number; csr: number; csrLabel: string }
}) {
  const supplier = getSupplierInfo(line.supplierId)

  return (
    <div style={{ marginBottom: '0.2rem', padding: '0.25rem', background: '#f8fafc', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.6rem', fontWeight: 600, color: '#475569', minWidth: '55px' }}>{label}:</span>
        <SliderInput
          value={line.units}
          onChange={onUnitsChange}
          min={0} max={100} step={5} suffix="%"
        />
        <SelectInput
          value={line.techLevel}
          onChange={(value) => onTechChange(Number(value))}
          options={techOptions}
        />
        <SelectInput
          value={line.supplierId}
          onChange={(value) => onSupplierChange(Number(value))}
          options={supplierOptions}
        />
      </div>
      <div style={{ fontSize: '0.5rem', color: '#64748b', marginTop: '0.15rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <span>{formatUnits(units)} units</span>
        <span>|</span>
        <span>Tech {line.techLevel} (×{GAME_CONFIG.techCostMultiplier[line.techLevel].toFixed(2)})</span>
        <span>|</span>
        <span style={{ color: supplier.csr >= 4 ? '#16a34a' : supplier.csr <= 1 ? '#dc2626' : '#64748b' }}>
          {supplier.name} (CSR: {supplier.csrLabel})
        </span>
        <span>|</span>
        <span style={{ fontWeight: 600 }}>Cost: ${unitCost.toFixed(2)}/unit</span>
      </div>
    </div>
  )
}

// --- HR SECTION ---
function HRSection({ team, onUpdate }: DecisionSectionProps) {
  const { hr } = team.decisions
  const { mandaysPerWorker, trainingEfficiencyBoost } = GAME_CONFIG.hr

  const updateHRRegion = (region: 'us' | 'asia', field: 'employees' | 'wage' | 'training', value: number) => {
    onUpdate({
      hr: {
        ...hr,
        [region]: { ...hr[region], [field]: value }
      }
    })
  }

  const totalCost =
    (hr.us.employees * hr.us.wage * 12) + hr.us.training +
    (hr.asia.employees * hr.asia.wage * 12) + hr.asia.training

  // Calculate research hours generated
  const usEff = hr.us.training > 0 ? 1 + trainingEfficiencyBoost : 1
  const asiaEff = hr.asia.training > 0 ? 1 + trainingEfficiencyBoost : 1
  const totalResearchHours =
    (hr.us.employees * mandaysPerWorker * usEff) +
    (hr.asia.employees * mandaysPerWorker * asiaEff)

  return (
    <div className="decision-section hr-section">
      <div className="section-header">HR & Research Capacity</div>

      {(['us', 'asia'] as const).map((region) => {
        const eff = hr[region].training > 0 ? 1 + trainingEfficiencyBoost : 1
        const regionHours = hr[region].employees * mandaysPerWorker * eff
        return (
          <div key={region} className="field-group">
            <div className="field-group-title">{region.toUpperCase()}</div>
            <div className="field-row compact">
              <label>Workers:</label>
              <NumberInput
                value={hr[region].employees}
                onChange={(v) => updateHRRegion(region, 'employees', v)}
                min={0}
                step={10}
                width="70px"
              />
            </div>
            <div className="field-row compact">
              <label>Wage:</label>
              <NumberInput
                value={hr[region].wage}
                onChange={(v) => updateHRRegion(region, 'wage', v)}
                min={0}
                step={100}
                prefix="$"
                suffix="/mo"
                width="70px"
              />
            </div>
            <div className="field-row compact">
              <label>Training:</label>
              <NumberInput
                value={hr[region].training}
                onChange={(v) => updateHRRegion(region, 'training', v)}
                min={0}
                step={5000}
                prefix="$"
                width="80px"
              />
              {hr[region].training > 0 && <span style={{ color: '#16a34a', fontSize: '0.7rem' }}>+10%</span>}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
              = {formatUnits(regionHours)} research hrs
            </div>
          </div>
        )
      })}

      <div className="section-summary">
        Cost: <strong>${(totalCost / 1000).toFixed(0)}K</strong>/yr
        <br />
        Research: <strong>{formatUnits(totalResearchHours)}</strong> hrs/round
      </div>
    </div>
  )
}

// --- R&D SECTION ---
function RnDSection({ team, gameState }: DecisionSectionProps) {
  const { hr } = team.decisions
  const rndProgress = gameState?.rndProgress ?? { unlockedTechLevel: 1, unlockedFeatureCount: 0, cumulativeResearchHours: 0 }
  const featureLimit = GAME_CONFIG.featureCatalog?.length || 20

  // Calculate research hours from HR
  const { mandaysPerWorker, trainingEfficiencyBoost } = GAME_CONFIG.hr
  const usEff = hr.us.training > 0 ? 1 + trainingEfficiencyBoost : 1
  const asiaEff = hr.asia.training > 0 ? 1 + trainingEfficiencyBoost : 1
  const totalResearchHours = (hr.us.employees * mandaysPerWorker * usEff) + (hr.asia.employees * mandaysPerWorker * asiaEff)
  const hoursToFeatures = Math.round(totalResearchHours) // All research hours go to features

  const unlockedFeatures = rndProgress.unlockedFeatureCount
  const nextFeature = unlockedFeatures + 1
  const nextFeatureHours = GAME_CONFIG.featureResearchHours[nextFeature] || 0
  const featureProgressPct = nextFeatureHours > 0 ? Math.min(100, (rndProgress.cumulativeResearchHours / nextFeatureHours) * 100) : 100
  const hoursRemaining = Math.max(0, nextFeatureHours - rndProgress.cumulativeResearchHours)
  const roundsToUnlock = hoursToFeatures > 0 ? Math.ceil(hoursRemaining / hoursToFeatures) : Infinity

  return (
    <div className="decision-section rnd-section">
      <div className="section-header">R&D</div>

      {/* Feature Progress - Visual Progress Bar */}
      <div style={{ marginBottom: '0.75rem', padding: '0.5rem', background: '#f0fdf4', borderRadius: '6px', border: '1px solid #86efac' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
          <span style={{ fontWeight: 600, color: '#166534', fontSize: '0.8rem' }}>
            Features: {unlockedFeatures}/{featureLimit}
          </span>
          {nextFeature <= featureLimit && (
            <span style={{ fontSize: '0.7rem', color: '#16a34a' }}>
              {roundsToUnlock === Infinity ? 'Not investing' : `~${roundsToUnlock} round${roundsToUnlock > 1 ? 's' : ''} to next`}
            </span>
          )}
        </div>
        {/* Feature dots/progress */}
        <div style={{ display: 'flex', gap: '3px', marginBottom: '0.35rem' }}>
          {Array.from({ length: featureLimit }, (_, i) => {
            const featureNum = i + 1
            const isUnlocked = featureNum <= unlockedFeatures
            const isNext = featureNum === nextFeature
            return (
              <div
                key={i}
                style={{
                  flex: 1,
                  height: '8px',
                  borderRadius: '2px',
                  background: isUnlocked ? '#22c55e' : isNext ? `linear-gradient(90deg, #86efac ${featureProgressPct}%, #e5e7eb ${featureProgressPct}%)` : '#e5e7eb',
                  border: isNext ? '1px solid #22c55e' : 'none'
                }}
              />
            )
          })}
        </div>
        {nextFeature <= featureLimit && (
          <div style={{ fontSize: '0.65rem', color: '#64748b' }}>
            Progress to Feature #{nextFeature}: <strong>{formatUnits(rndProgress.cumulativeResearchHours)}</strong> / {formatUnits(nextFeatureHours)} hrs
            <span style={{ marginLeft: '0.5rem' }}>({formatUnits(hoursRemaining)} remaining)</span>
          </div>
        )}
      </div>

      {/* Research Hours Display */}
      <div style={{ marginBottom: '0.5rem' }}>
        <div style={{ fontSize: '0.7rem', fontWeight: 600, color: '#64748b', marginBottom: '0.25rem' }}>
          RESEARCH HOURS (from HR)
        </div>
        <div style={{ fontSize: '0.7rem', color: '#0369a1' }}>
          <strong>{formatUnits(hoursToFeatures)}</strong> hrs/round → Feature Development
        </div>
      </div>

    </div>
  )
}

// --- INVESTMENT SECTION ---
function InvestmentSection({ team, onUpdate, gameState, teamResult }: DecisionSectionProps) {
  const { investment } = team.decisions
  const factories = gameState?.factories ?? { us: 2, asia: 0 }
  const pendingInvestments = gameState?.pendingInvestments ?? []
  const { plantCostUS, plantCostAsia, lagRounds } = GAME_CONFIG.investment
  const { capacityPerPlant } = GAME_CONFIG

  // Financial info - Beginning of round is the previous round's ending position
  // For round 1, we estimate based on starting equity minus current round activity
  const endOfRoundCash = teamResult?.balanceSheet.cash ?? 30_000_000
  const updateInvestment = (updates: Partial<InvestmentDecision>) => {
    onUpdate({ investment: { ...investment, ...updates } })
  }

  const totalCost = (investment.newPlantsUS * plantCostUS) + (investment.newPlantsAsia * plantCostAsia)
  const newCapacity = (investment.newPlantsUS + investment.newPlantsAsia) * capacityPerPlant

  // Check affordability based on end-of-round cash
  const cashAfterInvestment = endOfRoundCash - totalCost
  const canAffordUS = endOfRoundCash >= plantCostUS

  // Calculate max plants affordable for each region
  const maxUSPlants = Math.floor(endOfRoundCash / plantCostUS)

  // After selecting US plants, how many Asia can we still afford?
  const cashAfterUS = endOfRoundCash - (investment.newPlantsUS * plantCostUS)
  const maxAsiaAfterUS = Math.floor(cashAfterUS / plantCostAsia)

  // Button style factory selection
  const FactoryButton = ({ region, count, cost, currentCount, maxAffordable, disabled }: {
    region: string
    count: number
    cost: number
    currentCount: number
    maxAffordable: number
    disabled: boolean
  }) => {
    const isSelected = count === currentCount
    const isAffordable = count <= maxAffordable && !disabled

    return (
      <button
        onClick={() => {
          if (region === 'US') {
            updateInvestment({ newPlantsUS: count })
          } else {
            updateInvestment({ newPlantsAsia: count })
          }
        }}
        disabled={!isAffordable}
        style={{
          padding: '0.4rem 0.6rem',
          border: isSelected ? '2px solid #1e3a5f' : '1px solid #cbd5e1',
          borderRadius: '6px',
          background: isSelected ? '#1e3a5f' : isAffordable ? 'white' : '#f1f5f9',
          color: isSelected ? 'white' : isAffordable ? '#1e293b' : '#94a3b8',
          fontWeight: isSelected ? 600 : 400,
          fontSize: '0.75rem',
          cursor: isAffordable ? 'pointer' : 'not-allowed',
          opacity: isAffordable ? 1 : 0.6,
          transition: 'all 0.15s',
        }}
      >
        {count} ({formatCurrency(count * cost).replace('$', '')}$)
      </button>
    )
  }

  return (
    <div className="decision-section investment-section">
      <div className="section-header">Plant Investment</div>

      {/* Cash Position Explained */}
      <div style={{
        fontSize: '0.75rem',
        marginBottom: '0.5rem',
        padding: '0.5rem',
        background: '#f0f9ff',
        borderRadius: '4px',
        border: '1px solid #bae6fd'
      }}>
        <div style={{ fontWeight: 600, color: '#0369a1', marginBottom: '0.25rem' }}>
          💰 Cash Position
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.25rem' }}>
          <span style={{ color: '#64748b' }}>End of Round:</span>
          <strong style={{ color: '#0369a1' }}>{formatCurrency(endOfRoundCash)}</strong>
        </div>
        <div style={{ fontSize: '0.65rem', color: '#64748b', marginTop: '0.25rem', fontStyle: 'italic' }}>
          Investment uses end-of-round cash position
        </div>
      </div>

      {/* Current factories */}
      <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.5rem', padding: '0.5rem', background: '#f1f5f9', borderRadius: '4px' }}>
        <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>🏭 Current Factories</div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <span>US: <strong>{factories.us}</strong> ({formatUnits(factories.us * capacityPerPlant)})</span>
          <span>Asia: <strong>{factories.asia}</strong> ({formatUnits(factories.asia * capacityPerPlant)})</span>
        </div>
        {pendingInvestments.length > 0 && (
          <div style={{ marginTop: '0.25rem', color: '#f59e0b' }}>
            🚧 Building: {pendingInvestments.map(inv =>
              `${inv.plantsOrdered} ${inv.region.toUpperCase()} (Round ${inv.roundAvailable})`
            ).join(', ')}
          </div>
        )}
      </div>

      {/* US Factory Selection */}
      <div style={{ marginBottom: '0.75rem' }}>
        <div style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.25rem', display: 'flex', justifyContent: 'space-between' }}>
          <span>🇺🇸 New US Plants</span>
          <span style={{ fontWeight: 400, color: '#64748b' }}>${(plantCostUS / 1_000_000).toFixed(0)}M each</span>
        </div>
        <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
          {[0, 1, 2, 3].map(count => (
            <FactoryButton
              key={count}
              region="US"
              count={count}
              cost={plantCostUS}
              currentCount={investment.newPlantsUS}
              maxAffordable={maxUSPlants}
              disabled={false}
            />
          ))}
        </div>
        {!canAffordUS && investment.newPlantsUS === 0 && (
          <div style={{ fontSize: '0.65rem', color: '#dc2626', marginTop: '0.25rem' }}>
            Need {formatCurrency(plantCostUS)} to build a US plant
          </div>
        )}
      </div>

      {/* Asia Factory Selection */}
      <div style={{ marginBottom: '0.75rem' }}>
        <div style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.25rem', display: 'flex', justifyContent: 'space-between' }}>
          <span>🌏 New Asia Plants</span>
          <span style={{ fontWeight: 400, color: '#64748b' }}>${(plantCostAsia / 1_000_000).toFixed(0)}M each</span>
        </div>
        <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
          {[0, 1, 2, 3].map(count => (
            <FactoryButton
              key={count}
              region="Asia"
              count={count}
              cost={plantCostAsia}
              currentCount={investment.newPlantsAsia}
              maxAffordable={maxAsiaAfterUS}
              disabled={false}
            />
          ))}
        </div>
        {cashAfterUS < plantCostAsia && investment.newPlantsAsia === 0 && investment.newPlantsUS > 0 && (
          <div style={{ fontSize: '0.65rem', color: '#f59e0b', marginTop: '0.25rem' }}>
            After US investment: {formatCurrency(cashAfterUS)} remaining
          </div>
        )}
      </div>

      {/* Investment Summary */}
      {totalCost > 0 ? (
        <div className="section-summary" style={{
          background: cashAfterInvestment >= 0 ? '#dcfce7' : '#fee2e2',
          border: `1px solid ${cashAfterInvestment >= 0 ? '#86efac' : '#fca5a5'}`
        }}>
          <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>📋 Investment Summary</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.25rem' }}>
            <span>Total Cost:</span>
            <strong>{formatCurrency(totalCost)}</strong>
            <span>Cash After:</span>
            <strong style={{ color: cashAfterInvestment >= 0 ? '#16a34a' : '#dc2626' }}>
              {formatCurrency(cashAfterInvestment)}
            </strong>
            <span>New Capacity:</span>
            <strong>+{formatUnits(newCapacity)}</strong>
          </div>
          <div style={{ fontSize: '0.65rem', color: '#64748b', marginTop: '0.25rem' }}>
            Plants ready in {lagRounds} round{lagRounds > 1 ? 's' : ''}
          </div>
        </div>
      ) : (
        <div className="section-summary" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
          <div style={{ color: '#64748b', textAlign: 'center' }}>
            No new plants planned this round
          </div>
        </div>
      )}
    </div>
  )
}

// --- LOGISTICS SECTION ---
function LogisticsSection({ team, onUpdate }: DecisionSectionProps) {
  const { logistics } = team.decisions

  const updateLogistics = (updates: Partial<LogisticsDecision>) => {
    onUpdate({ logistics: { ...logistics, ...updates } })
  }

  const regions: RegionKey[] = ['us', 'asia', 'europe']

  const handlePriorityChange = (source: 'us' | 'asia', index: number, newValue: RegionKey) => {
    const currentPriority = [...logistics[`${source}Priority`]] as [RegionKey, RegionKey, RegionKey]
    const oldIndex = currentPriority.indexOf(newValue)
    if (oldIndex !== -1 && oldIndex !== index) {
      // Swap
      currentPriority[oldIndex] = currentPriority[index]
    }
    currentPriority[index] = newValue
    updateLogistics({ [`${source}Priority`]: currentPriority })
  }

  return (
    <div className="decision-section logistics-section">
      <div className="section-header">Logistics</div>

      <div className="field-group">
        <div className="field-group-title">US Delivery Priority</div>
        {[0, 1, 2].map((idx) => (
          <div key={idx} className="field-row compact">
            <label>#{idx + 1}:</label>
            <SelectInput
              value={logistics.usPriority[idx]}
              onChange={(v) => handlePriorityChange('us', idx, v as RegionKey)}
              options={regions.map(r => ({ value: r, label: r.toUpperCase() }))}
            />
          </div>
        ))}
      </div>

      <div className="field-group">
        <div className="field-group-title">Asia Delivery Priority</div>
        {[0, 1, 2].map((idx) => (
          <div key={idx} className="field-row compact">
            <label>#{idx + 1}:</label>
            <SelectInput
              value={logistics.asiaPriority[idx]}
              onChange={(v) => handlePriorityChange('asia', idx, v as RegionKey)}
              options={regions.map(r => ({ value: r, label: r.toUpperCase() }))}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

// --- MARKETING SECTION ---
function MarketingSection({ team, onUpdate, gameState }: DecisionSectionProps) {
  const { marketing } = team.decisions
  const rndProgress = gameState?.rndProgress ?? { unlockedTechLevel: 1, unlockedFeatureCount: 0, cumulativeResearchHours: 0 }
  const maxFeatures = rndProgress.unlockedFeatureCount
  const featureLimit = GAME_CONFIG.featureCatalog?.length || 20

  // Calculate progress to next feature
  const nextFeature = maxFeatures + 1
  const nextFeatureHours = GAME_CONFIG.featureResearchHours[nextFeature] || 0
  const hoursProgress = nextFeatureHours > 0
    ? Math.min(100, (rndProgress.cumulativeResearchHours / nextFeatureHours) * 100)
    : 100

  const updateMarketingRegion = (
    region: 'us' | 'asia' | 'europe',
    field: 'price' | 'features' | 'promotionPct',
    value: number
  ) => {
    // Clamp features to max unlocked
    if (field === 'features' && value > maxFeatures) {
      value = maxFeatures
    }
    onUpdate({
      marketing: {
        ...marketing,
        [region]: { ...marketing[region], [field]: value }
      }
    })
  }

  // Market preference weights from config
  const prefs = GAME_CONFIG.marketPreferences

  return (
    <div className="decision-section marketing-section">
      <div className="section-header">Marketing</div>

      {/* Market Assumptions - What drives customer demand */}
      <div style={{ fontSize: '0.6rem', marginBottom: '0.5rem', padding: '0.4rem', background: '#e0f2fe', borderRadius: '4px', border: '1px solid #7dd3fc', color: '#0369a1' }}>
        <div style={{ fontWeight: 700, marginBottom: '0.2rem' }}>What Drives Customer Demand (Market Sensitivity):</div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.55rem' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '0.1rem' }}>Factor</th>
              <th style={{ textAlign: 'center', padding: '0.1rem' }}>US</th>
              <th style={{ textAlign: 'center', padding: '0.1rem' }}>Asia</th>
              <th style={{ textAlign: 'center', padding: '0.1rem' }}>Europe</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>Price</td><td style={{ textAlign: 'center' }}>{(prefs.us.priceWeight * 100).toFixed(0)}%</td><td style={{ textAlign: 'center', fontWeight: 600, color: '#dc2626' }}>{(prefs.asia.priceWeight * 100).toFixed(0)}%</td><td style={{ textAlign: 'center' }}>{(prefs.europe.priceWeight * 100).toFixed(0)}%</td></tr>
            <tr><td>Tech/Quality</td><td style={{ textAlign: 'center', fontWeight: 600, color: '#16a34a' }}>{(prefs.us.qualityWeight * 100).toFixed(0)}%</td><td style={{ textAlign: 'center' }}>{(prefs.asia.qualityWeight * 100).toFixed(0)}%</td><td style={{ textAlign: 'center' }}>{(prefs.europe.qualityWeight * 100).toFixed(0)}%</td></tr>
            <tr><td>Features</td><td style={{ textAlign: 'center' }}>{(prefs.us.featuresWeight * 100).toFixed(0)}%</td><td style={{ textAlign: 'center' }}>{(prefs.asia.featuresWeight * 100).toFixed(0)}%</td><td style={{ textAlign: 'center' }}>{(prefs.europe.featuresWeight * 100).toFixed(0)}%</td></tr>
            <tr><td>Promotion</td><td style={{ textAlign: 'center' }}>{(prefs.us.promotionWeight * 100).toFixed(0)}%</td><td style={{ textAlign: 'center' }}>{(prefs.asia.promotionWeight * 100).toFixed(0)}%</td><td style={{ textAlign: 'center', fontWeight: 600, color: '#16a34a' }}>{(prefs.europe.promotionWeight * 100).toFixed(0)}%</td></tr>
            <tr><td>CSR/Env</td><td style={{ textAlign: 'center' }}>{(prefs.us.csrWeight * 100).toFixed(0)}%</td><td style={{ textAlign: 'center' }}>{(prefs.asia.csrWeight * 100).toFixed(0)}%</td><td style={{ textAlign: 'center', fontWeight: 600, color: '#16a34a' }}>{(prefs.europe.csrWeight * 100).toFixed(0)}%</td></tr>
          </tbody>
        </table>
        <div style={{ marginTop: '0.2rem', fontStyle: 'italic' }}>
          Asia = price-sensitive | US = quality-focused | Europe = CSR & promo-responsive
        </div>
      </div>

      {/* Show unlocked features with clear labeling */}
      <div style={{ fontSize: '0.65rem', marginBottom: '0.4rem', padding: '0.4rem', background: maxFeatures > 0 ? '#dcfce7' : '#fee2e2', borderRadius: '4px', border: `1px solid ${maxFeatures > 0 ? '#86efac' : '#fca5a5'}` }}>
        <div style={{ fontWeight: 600, color: maxFeatures > 0 ? '#166534' : '#991b1b' }}>
          Available Features: <strong>{maxFeatures}/{featureLimit}</strong> unlocked
        </div>
        {maxFeatures === 0 && (
          <span style={{ color: '#dc2626', fontSize: '0.6rem' }}>Research features in R&D first!</span>
        )}
        {maxFeatures > 0 && nextFeature <= featureLimit && (
          <div style={{ fontSize: '0.55rem', color: '#64748b', marginTop: '0.15rem' }}>
            Next feature: {hoursProgress.toFixed(0)}% researched
          </div>
        )}
      </div>

      {(['us', 'asia', 'europe'] as const).map((region) => {
        const regionPrefs = prefs[region]
        return (
          <div key={region} className="field-group" style={{ marginBottom: '0.4rem', padding: '0.35rem' }}>
            <div className="field-group-title" style={{ marginBottom: '0.2rem' }}>
              {region.toUpperCase()}
              <span style={{ fontSize: '0.55rem', color: '#94a3b8', marginLeft: '0.5rem' }}>
                (Price: {(regionPrefs.priceWeight * 100).toFixed(0)}% | Features: {(regionPrefs.featuresWeight * 100).toFixed(0)}% | Promo: {(regionPrefs.promotionWeight * 100).toFixed(0)}%)
              </span>
            </div>
            <div className="field-row compact">
              <label style={{ fontSize: '0.65rem' }}>Price:</label>
              <NumberInput
                value={marketing[region].price}
                onChange={(v) => updateMarketingRegion(region, 'price', v)}
                min={50}
                max={500}
                step={10}
                prefix="$"
                width="65px"
              />
            </div>
            <div className="field-row compact">
              <label style={{ fontSize: '0.65rem' }}>Features:</label>
              {maxFeatures === 0 ? (
                <span style={{ color: '#dc2626', fontSize: '0.65rem', fontStyle: 'italic' }}>
                  None
                </span>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flex: 1 }}>
                  <SliderInput
                    value={Math.min(marketing[region].features, maxFeatures)}
                    onChange={(v) => updateMarketingRegion(region, 'features', v)}
                    min={0}
                    max={maxFeatures}
                  />
                  <span style={{ fontSize: '0.65rem', fontWeight: 600, color: '#3b82f6', minWidth: '40px' }}>
                    {marketing[region].features}/{maxFeatures}
                  </span>
                </div>
              )}
            </div>
            <div className="field-row compact">
              <label style={{ fontSize: '0.65rem' }}>Promo:</label>
              <SliderInput
                value={marketing[region].promotionPct}
                onChange={(v) => updateMarketingRegion(region, 'promotionPct', v)}
                min={0}
                max={20}
                suffix="%"
              />
            </div>
          </div>
        )
      })}

      {/* Promotion Cost Info */}
      <div style={{ fontSize: '0.55rem', padding: '0.3rem', background: '#fef3c7', borderRadius: '4px', border: '1px solid #fcd34d', color: '#92400e' }}>
        <strong>Promotion Cost:</strong> % of (unit cost × units sold). Higher promo = more demand but higher cost.
      </div>
    </div>
  )
}

// --- FINANCE SECTION ---
function FinanceSection({ team, onUpdate, teamResult }: DecisionSectionProps) {
  const { finance } = team.decisions
  const { financial } = GAME_CONFIG

  const updateFinance = (updates: Partial<FinanceDecision>) => {
    onUpdate({ finance: { ...finance, ...updates } })
  }

  const updateTransferPricing = (region: 'us' | 'asia' | 'europe', value: number) => {
    onUpdate({
      finance: {
        ...finance,
        transferPricing: { ...finance.transferPricing, [region]: value }
      }
    })
  }

  // Current financial position
  const currentDebt = teamResult?.balanceSheet.longTermDebt ?? 30_000_000
  const currentEquity = teamResult?.balanceSheet.totalEquity ?? 70_000_000
  const totalAssets = teamResult?.balanceSheet.totalAssets ?? 100_000_000
  const netProfit = teamResult?.pnl.netProfit ?? 0
  const marketCap = teamResult?.kpis.marketCap ?? 100_000_000

  // Calculate limits
  const maxDebtAllowed = totalAssets * financial.maxDebtToAssetRatio
  const currentDebtCapacity = maxDebtAllowed - currentDebt
  const maxNewBorrowing = Math.max(0, currentDebtCapacity)
  const maxRepayment = currentDebt // Can repay up to current debt

  const maxShareIssuance = marketCap * financial.maxShareDilutionPerRound
  const maxShareBuyback = marketCap * financial.maxBuybackPerRound
  const maxDividends = Math.max(0, netProfit * financial.maxDividendPayoutRatio)

  // Validate current selections
  const debtAfterChange = currentDebt + finance.longTermDebt
  const isDebtOverLimit = finance.longTermDebt > maxNewBorrowing
  const isRepaymentOverLimit = finance.longTermDebt < -maxRepayment
  const isShareIssueOverLimit = finance.shareIssuance > maxShareIssuance
  const isBuybackOverLimit = finance.shareIssuance < -maxShareBuyback
  const isDividendOverLimit = finance.dividends > maxDividends && netProfit > 0

  const netCashFlow = finance.longTermDebt + finance.shareIssuance - finance.dividends
  const debtToEquity = currentEquity > 0 ? debtAfterChange / currentEquity : 0

  return (
    <div className="decision-section finance-section">
      <div className="section-header">Finance</div>

      {/* Financial Position Overview */}
      <div style={{ fontSize: '0.7rem', marginBottom: '0.5rem', padding: '0.5rem', background: '#f0f9ff', borderRadius: '4px', border: '1px solid #bae6fd' }}>
        <div style={{ fontWeight: 600, color: '#0369a1', marginBottom: '0.25rem' }}>📊 Current Position</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.15rem' }}>
          <span>Total Assets:</span>
          <strong>{formatCurrency(totalAssets)}</strong>
          <span>Current Debt:</span>
          <strong>{formatCurrency(currentDebt)}</strong>
          <span>Total Equity:</span>
          <strong>{formatCurrency(currentEquity)}</strong>
          <span>Net Profit:</span>
          <strong style={{ color: netProfit >= 0 ? '#16a34a' : '#dc2626' }}>{formatCurrency(netProfit)}</strong>
        </div>
        <div style={{ marginTop: '0.25rem', paddingTop: '0.25rem', borderTop: '1px solid #bae6fd' }}>
          D/E Ratio: <strong style={{ color: debtToEquity > 2 ? '#dc2626' : debtToEquity > 1 ? '#f59e0b' : '#16a34a' }}>
            {debtToEquity.toFixed(2)}x
          </strong>
          {debtToEquity > 2 && <span style={{ color: '#dc2626', fontSize: '0.6rem' }}> (High risk!)</span>}
        </div>
      </div>

      {/* Financing Limits Explanation */}
      <div style={{ fontSize: '0.6rem', marginBottom: '0.4rem', padding: '0.35rem', background: '#fef3c7', borderRadius: '4px', border: '1px solid #fcd34d', color: '#92400e' }}>
        <div style={{ fontWeight: 600, marginBottom: '0.15rem' }}>⚠️ Financing Limits (per round):</div>
        <div>• Max Debt: {(financial.maxDebtToAssetRatio * 100).toFixed(0)}% of assets = <strong>{formatCurrency(maxDebtAllowed)}</strong></div>
        <div>• Available to Borrow: <strong style={{ color: maxNewBorrowing > 0 ? '#166534' : '#dc2626' }}>{formatCurrency(maxNewBorrowing)}</strong></div>
        <div>• Max Share Issue: {(financial.maxShareDilutionPerRound * 100).toFixed(0)}% dilution = <strong>{formatCurrency(maxShareIssuance)}</strong></div>
        <div>• Max Buyback: {(financial.maxBuybackPerRound * 100).toFixed(0)}% = <strong>{formatCurrency(maxShareBuyback)}</strong></div>
        <div>• Max Dividends: {(financial.maxDividendPayoutRatio * 100).toFixed(0)}% of profit = <strong>{formatCurrency(maxDividends)}</strong></div>
      </div>

      <div className="field-group">
        <div className="field-group-title">Transfer Pricing</div>
        {(['us', 'asia', 'europe'] as const).map((region) => (
          <div key={region} className="field-row compact">
            <label>{region.toUpperCase()}:</label>
            <SliderInput
              value={finance.transferPricing[region]}
              onChange={(v) => updateTransferPricing(region, v)}
              min={1.0}
              max={2.0}
              step={0.1}
              suffix="x"
            />
          </div>
        ))}
      </div>

      {/* Debt with limits */}
      <div style={{ marginBottom: '0.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 600 }}>📈 Debt Change:</label>
          <span style={{ fontSize: '0.6rem', color: '#64748b' }}>
            {finance.longTermDebt >= 0 ? 'Borrow' : 'Repay'}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', marginBottom: '0.25rem' }}>
          {[-10_000_000, -5_000_000, 0, 5_000_000, 10_000_000].map(amount => {
            const isValid = amount >= -maxRepayment && amount <= maxNewBorrowing
            const isSelected = finance.longTermDebt === amount
            return (
              <button
                key={amount}
                onClick={() => isValid && updateFinance({ longTermDebt: amount })}
                disabled={!isValid}
                style={{
                  padding: '0.3rem 0.5rem',
                  border: isSelected ? '2px solid #1e3a5f' : '1px solid #cbd5e1',
                  borderRadius: '4px',
                  background: isSelected ? '#1e3a5f' : isValid ? 'white' : '#f1f5f9',
                  color: isSelected ? 'white' : isValid ? '#1e293b' : '#94a3b8',
                  fontSize: '0.65rem',
                  fontWeight: isSelected ? 600 : 400,
                  cursor: isValid ? 'pointer' : 'not-allowed',
                  opacity: isValid ? 1 : 0.5,
                }}
              >
                {amount === 0 ? 'None' : amount > 0 ? `+${formatCurrency(amount)}` : formatCurrency(amount)}
              </button>
            )
          })}
        </div>
        {(isDebtOverLimit || isRepaymentOverLimit) && (
          <div style={{ fontSize: '0.6rem', color: '#dc2626', marginTop: '0.15rem' }}>
            {isDebtOverLimit ? `Exceeds borrowing limit of ${formatCurrency(maxNewBorrowing)}` : `Cannot repay more than ${formatCurrency(maxRepayment)}`}
          </div>
        )}
      </div>

      {/* Share Issuance with limits */}
      <div style={{ marginBottom: '0.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 600 }}>📊 Share Capital:</label>
          <span style={{ fontSize: '0.6rem', color: '#64748b' }}>
            {finance.shareIssuance >= 0 ? 'Issue' : 'Buyback'}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', marginBottom: '0.25rem' }}>
          {[
            -Math.min(5_000_000, maxShareBuyback),
            0,
            Math.min(5_000_000, maxShareIssuance),
            Math.min(10_000_000, maxShareIssuance)
          ].filter((v, i, arr) => arr.indexOf(v) === i).map(amount => {
            const isValid = amount >= -maxShareBuyback && amount <= maxShareIssuance
            const isSelected = finance.shareIssuance === amount
            return (
              <button
                key={amount}
                onClick={() => isValid && updateFinance({ shareIssuance: amount })}
                disabled={!isValid}
                style={{
                  padding: '0.3rem 0.5rem',
                  border: isSelected ? '2px solid #7c3aed' : '1px solid #cbd5e1',
                  borderRadius: '4px',
                  background: isSelected ? '#7c3aed' : isValid ? 'white' : '#f1f5f9',
                  color: isSelected ? 'white' : isValid ? '#1e293b' : '#94a3b8',
                  fontSize: '0.65rem',
                  fontWeight: isSelected ? 600 : 400,
                  cursor: isValid ? 'pointer' : 'not-allowed',
                  opacity: isValid ? 1 : 0.5,
                }}
              >
                {amount === 0 ? 'None' : amount > 0 ? `+${formatCurrency(amount)}` : formatCurrency(amount)}
              </button>
            )
          })}
        </div>
        {(isShareIssueOverLimit || isBuybackOverLimit) && (
          <div style={{ fontSize: '0.6rem', color: '#dc2626', marginTop: '0.15rem' }}>
            {isShareIssueOverLimit
              ? `Exceeds {(financial.maxShareDilutionPerRound * 100).toFixed(0)}% dilution limit`
              : `Exceeds {(financial.maxBuybackPerRound * 100).toFixed(0)}% buyback limit`}
          </div>
        )}
      </div>

      {/* Dividends with limits */}
      <div style={{ marginBottom: '0.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 600 }}>💰 Dividends:</label>
          <span style={{ fontSize: '0.6rem', color: '#64748b' }}>
            Max: {formatCurrency(maxDividends)}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', marginBottom: '0.25rem' }}>
          {[0, Math.min(1_000_000, maxDividends), Math.min(2_000_000, maxDividends), maxDividends].filter((v, i, arr) => arr.indexOf(v) === i && v >= 0).map(amount => {
            const isValid = amount <= maxDividends || maxDividends === 0
            const isSelected = finance.dividends === amount
            return (
              <button
                key={amount}
                onClick={() => isValid && updateFinance({ dividends: amount })}
                disabled={!isValid}
                style={{
                  padding: '0.3rem 0.5rem',
                  border: isSelected ? '2px solid #16a34a' : '1px solid #cbd5e1',
                  borderRadius: '4px',
                  background: isSelected ? '#16a34a' : isValid ? 'white' : '#f1f5f9',
                  color: isSelected ? 'white' : isValid ? '#1e293b' : '#94a3b8',
                  fontSize: '0.65rem',
                  fontWeight: isSelected ? 600 : 400,
                  cursor: isValid ? 'pointer' : 'not-allowed',
                  opacity: isValid ? 1 : 0.5,
                }}
              >
                {amount === 0 ? 'None' : formatCurrency(amount)}
              </button>
            )
          })}
        </div>
        {isDividendOverLimit && (
          <div style={{ fontSize: '0.6rem', color: '#dc2626', marginTop: '0.15rem' }}>
            Exceeds {(financial.maxDividendPayoutRatio * 100).toFixed(0)}% payout ratio
          </div>
        )}
        {netProfit <= 0 && (
          <div style={{ fontSize: '0.6rem', color: '#f59e0b', marginTop: '0.15rem' }}>
            No profit available for dividends
          </div>
        )}
      </div>

      {/* Summary */}
      <div className="section-summary" style={{
        background: netCashFlow >= 0 ? '#dcfce7' : '#fee2e2',
        border: `1px solid ${netCashFlow >= 0 ? '#86efac' : '#fca5a5'}`
      }}>
        <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>💵 Net Cash Impact</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.1rem', fontSize: '0.7rem' }}>
          <span>Debt Change:</span>
          <strong style={{ color: finance.longTermDebt >= 0 ? '#16a34a' : '#dc2626' }}>
            {finance.longTermDebt >= 0 ? '+' : ''}{formatCurrency(finance.longTermDebt)}
          </strong>
          <span>Share Capital:</span>
          <strong style={{ color: finance.shareIssuance >= 0 ? '#16a34a' : '#dc2626' }}>
            {finance.shareIssuance >= 0 ? '+' : ''}{formatCurrency(finance.shareIssuance)}
          </strong>
          <span>Dividends:</span>
          <strong style={{ color: '#dc2626' }}>-{formatCurrency(finance.dividends)}</strong>
        </div>
        <div style={{ borderTop: '1px solid #e2e8f0', marginTop: '0.25rem', paddingTop: '0.25rem' }}>
          <strong>Net: </strong>
          <strong style={{ color: netCashFlow >= 0 ? '#16a34a' : '#dc2626', fontSize: '0.85rem' }}>
            {netCashFlow >= 0 ? '+' : ''}{formatCurrency(netCashFlow)}
          </strong>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function DecisionSimulator() {
  const [currentRound, setCurrentRound] = useState(0) // 0 = Trial, 1-3 = Rounds
  const [teams, setTeams] = useState<TeamState[]>([
    { id: 1, name: 'Team Alpha', decisions: { ...DEFAULT_DECISIONS } },
    { id: 2, name: 'Team Beta', decisions: JSON.parse(JSON.stringify(DEFAULT_DECISIONS)) },
  ])

  // Track game state across rounds (factories, R&D progress, etc.)
  const [gameStates] = useState<Map<number, TeamGameState>>(() => {
    const initial = new Map<number, TeamGameState>()
    initial.set(1, createInitialGameState())
    initial.set(2, createInitialGameState())
    return initial
  })

  const updateTeamDecisions = useCallback((teamId: number, updates: Partial<TeamDecisions>) => {
    setTeams(prev => prev.map(team =>
      team.id === teamId
        ? { ...team, decisions: { ...team.decisions, ...updates } }
        : team
    ))
  }, [])

  // Calculate results using the game engine with game state
  const roundResults: RoundResults = useMemo(() => {
    const results = calculateRound(teams, currentRound, gameStates)

    // Update game states with results (for next round)
    // This is done outside of render to avoid side effects
    return results
  }, [teams, currentRound, gameStates])

  // Helper to get current game state for display
  const getTeamGameState = useCallback((teamId: number): TeamGameState => {
    // Use the result game state if available, otherwise use stored state
    const teamResult = roundResults.teams.find(t => t.teamId === teamId)
    if (teamResult?.gameState) {
      return teamResult.gameState
    }
    return gameStates.get(teamId) ?? createInitialGameState()
  }, [roundResults, gameStates])

  return (
    <div className="decision-simulator">
      <header className="simulator-header">
        <h1>Decision Simulator</h1>
        <p>Master testing page for the game engine - 2 teams, real-time calculation</p>

        <div className="round-selector">
          {[0, 1, 2, 3].map(round => (
            <button
              key={round}
              className={`round-btn ${currentRound === round ? 'active' : ''}`}
              onClick={() => setCurrentRound(round)}
            >
              {round === 0 ? 'Trial' : `Round ${round}`}
            </button>
          ))}
        </div>
      </header>

      <div className="simulator-grid">
        {/* Header Row */}
        <div className="grid-header">
          <div className="decision-label">Decision Area</div>
          {teams.map(team => (
            <div key={team.id} className="team-header">
              <input
                type="text"
                value={team.name}
                onChange={(e) => setTeams(prev => prev.map(t =>
                  t.id === team.id ? { ...t, name: e.target.value } : t
                ))}
                className="team-name-input"
              />
            </div>
          ))}
        </div>

        {/* Budget Summary Row - Shows key financial metrics */}
        <div className="decision-row" style={{ background: '#f0f9ff' }}>
          <div className="decision-label" style={{ background: '#dbeafe' }}>
            <span className="label-icon">📊</span>
            Budget
          </div>
          {teams.map(team => {
            const teamResult = roundResults.teams.find(t => t.teamId === team.id)
            if (!teamResult) return <div key={team.id} className="team-cell">Loading...</div>

            const cash = teamResult.balanceSheet.cash
            const revenue = teamResult.pnl.revenue
            const netProfit = teamResult.pnl.netProfit
            const totalAssets = teamResult.balanceSheet.totalAssets

            // Calculate spending this round
            const hrCost = (team.decisions.hr.us.employees * team.decisions.hr.us.wage * 12) +
              team.decisions.hr.us.training +
              (team.decisions.hr.asia.employees * team.decisions.hr.asia.wage * 12) +
              team.decisions.hr.asia.training
            const investCost = (team.decisions.investment.newPlantsUS * GAME_CONFIG.investment.plantCostUS) +
              (team.decisions.investment.newPlantsAsia * GAME_CONFIG.investment.plantCostAsia)

            return (
              <div key={team.id} className="team-cell" style={{ padding: '0.5rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.25rem', fontSize: '0.75rem' }}>
                  <div style={{ padding: '0.35rem', background: cash >= 0 ? '#dcfce7' : '#fee2e2', borderRadius: '4px' }}>
                    <span style={{ color: '#64748b' }}>Cash: </span>
                    <strong style={{ color: cash >= 0 ? '#16a34a' : '#dc2626' }}>{formatCurrency(cash)}</strong>
                  </div>
                  <div style={{ padding: '0.35rem', background: '#f1f5f9', borderRadius: '4px' }}>
                    <span style={{ color: '#64748b' }}>Revenue: </span>
                    <strong>{formatCurrency(revenue)}</strong>
                  </div>
                  <div style={{ padding: '0.35rem', background: netProfit >= 0 ? '#dcfce7' : '#fee2e2', borderRadius: '4px' }}>
                    <span style={{ color: '#64748b' }}>Profit: </span>
                    <strong style={{ color: netProfit >= 0 ? '#16a34a' : '#dc2626' }}>{formatCurrency(netProfit)}</strong>
                  </div>
                  <div style={{ padding: '0.35rem', background: '#f1f5f9', borderRadius: '4px' }}>
                    <span style={{ color: '#64748b' }}>Assets: </span>
                    <strong>{formatCurrency(totalAssets)}</strong>
                  </div>
                </div>
                {/* Spending breakdown */}
                <div style={{ marginTop: '0.5rem', padding: '0.35rem', background: '#fef3c7', borderRadius: '4px', fontSize: '0.7rem' }}>
                  <div style={{ fontWeight: 600, color: '#92400e', marginBottom: '0.25rem' }}>This Round Spending:</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#78716c' }}>
                    <span>HR: ${(hrCost / 1000).toFixed(0)}K</span>
                    <span>Plants: ${(investCost / 1_000_000).toFixed(1)}M</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Market Forecast Row */}
        <div className="decision-row" style={{ background: '#fefce8' }}>
          <div className="decision-label">
            <span className="label-icon">📊</span>
            Forecast
          </div>
          {teams.map(team => {
            const gameState = getTeamGameState(team.id)
            const teamResult = roundResults.teams.find(t => t.teamId === team.id)
            return (
              <div key={team.id} className="team-cell">
                <MarketForecastSection
                  team={team}
                  onUpdate={(updates) => updateTeamDecisions(team.id, updates)}
                  gameState={gameState}
                  teamResult={teamResult}
                  currentRound={currentRound}
                />
              </div>
            )
          })}
        </div>

        {/* Production Row */}
        <div className="decision-row">
          <div className="decision-label">
            <span className="label-icon">🏭</span>
            Production
          </div>
          {teams.map(team => {
            const gameState = getTeamGameState(team.id)
            const teamResult = roundResults.teams.find(t => t.teamId === team.id)
            return (
              <div key={team.id} className="team-cell">
                <ProductionSection
                  team={team}
                  onUpdate={(updates) => updateTeamDecisions(team.id, updates)}
                  gameState={gameState}
                  teamResult={teamResult}
                />
              </div>
            )
          })}
        </div>

        {/* HR Row */}
        <div className="decision-row">
          <div className="decision-label">
            <span className="label-icon">👥</span>
            HR
          </div>
          {teams.map(team => {
            const gameState = getTeamGameState(team.id)
            const teamResult = roundResults.teams.find(t => t.teamId === team.id)
            return (
              <div key={team.id} className="team-cell">
                <HRSection
                  team={team}
                  onUpdate={(updates) => updateTeamDecisions(team.id, updates)}
                  gameState={gameState}
                  teamResult={teamResult}
                />
              </div>
            )
          })}
        </div>

        {/* R&D Row */}
        <div className="decision-row">
          <div className="decision-label">
            <span className="label-icon">🔬</span>
            R&D
          </div>
          {teams.map(team => {
            const gameState = getTeamGameState(team.id)
            return (
              <div key={team.id} className="team-cell">
                <RnDSection
                  team={team}
                  onUpdate={(updates) => updateTeamDecisions(team.id, updates)}
                  gameState={gameState}
                />
              </div>
            )
          })}
        </div>

        {/* Investment Row */}
        <div className="decision-row">
          <div className="decision-label">
            <span className="label-icon">🏗️</span>
            Investment
          </div>
          {teams.map(team => {
            const gameState = getTeamGameState(team.id)
            const teamResult = roundResults.teams.find(t => t.teamId === team.id)
            return (
              <div key={team.id} className="team-cell">
                <InvestmentSection
                  team={team}
                  onUpdate={(updates) => updateTeamDecisions(team.id, updates)}
                  gameState={gameState}
                  teamResult={teamResult}
                />
              </div>
            )
          })}
        </div>

        {/* Finance Row - placed next to Investment for easy capital planning */}
        <div className="decision-row">
          <div className="decision-label">
            <span className="label-icon">💰</span>
            Finance
          </div>
          {teams.map(team => {
            const gameState = getTeamGameState(team.id)
            const teamResult = roundResults.teams.find(t => t.teamId === team.id)
            return (
              <div key={team.id} className="team-cell">
                <FinanceSection
                  team={team}
                  onUpdate={(updates) => updateTeamDecisions(team.id, updates)}
                  gameState={gameState}
                  teamResult={teamResult}
                />
              </div>
            )
          })}
        </div>

        {/* Logistics Row */}
        <div className="decision-row">
          <div className="decision-label">
            <span className="label-icon">🚚</span>
            Logistics
          </div>
          {teams.map(team => {
            const gameState = getTeamGameState(team.id)
            const teamResult = roundResults.teams.find(t => t.teamId === team.id)
            return (
              <div key={team.id} className="team-cell">
                <LogisticsSection
                  team={team}
                  onUpdate={(updates) => updateTeamDecisions(team.id, updates)}
                  gameState={gameState}
                  teamResult={teamResult}
                />
              </div>
            )
          })}
        </div>

        {/* Marketing Row */}
        <div className="decision-row">
          <div className="decision-label">
            <span className="label-icon">📢</span>
            Marketing
          </div>
          {teams.map(team => {
            const gameState = getTeamGameState(team.id)
            const teamResult = roundResults.teams.find(t => t.teamId === team.id)
            return (
              <div key={team.id} className="team-cell">
                <MarketingSection
                  team={team}
                  onUpdate={(updates) => updateTeamDecisions(team.id, updates)}
                  gameState={gameState}
                  teamResult={teamResult}
                />
              </div>
            )
          })}
        </div>
      </div>

      {/* Results Section */}
      <section className="results-section">
        <h2>Results (Round {currentRound === 0 ? 'Trial' : currentRound})</h2>

        {/* Market Overview */}
        <div className="market-overview">
          <h3>Market Overview</h3>
          <div className="market-stats">
            <div className="stat-item">
              <span className="stat-label">US Demand</span>
              <span className="stat-value">{formatUnits(roundResults.marketDemand.us)}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Asia Demand</span>
              <span className="stat-value">{formatUnits(roundResults.marketDemand.asia)}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Europe Demand</span>
              <span className="stat-value">{formatUnits(roundResults.marketDemand.europe)}</span>
            </div>
            <div className="stat-item total">
              <span className="stat-label">Total Demand</span>
              <span className="stat-value">{formatUnits(roundResults.marketDemand.total)}</span>
            </div>
          </div>
        </div>

        {/* Game State Overview - Shows factory counts, R&D progress */}
        <div className="market-overview" style={{ marginTop: '1rem' }}>
          <h3>Team Status (Factories, Capacity & R&D)</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
            {roundResults.teams.map(result => {
              const gameState = result.gameState
              const nextFeatureHours = GAME_CONFIG.featureResearchHours[gameState.rndProgress.unlockedFeatureCount + 1] || 0
              const featureProgress = nextFeatureHours > 0
                ? Math.min(100, (gameState.rndProgress.cumulativeResearchHours / nextFeatureHours) * 100)
                : 100
              return (
                <div key={result.teamId} style={{ padding: '0.75rem', background: '#f8fafc', borderRadius: '6px' }}>
                  <strong>{result.teamName}</strong>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem', marginTop: '0.5rem', fontSize: '0.85rem' }}>
                    {/* Factories */}
                    <div>
                      <span style={{ color: '#64748b' }}>US Factories: </span>
                      <strong>{gameState.factories.us}</strong>
                      <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}> ({formatUnits(result.capacity.usFactoryCapacity)} cap)</span>
                    </div>
                    <div>
                      <span style={{ color: '#64748b' }}>Asia Factories: </span>
                      <strong style={{ color: gameState.factories.asia === 0 ? '#dc2626' : 'inherit' }}>
                        {gameState.factories.asia}
                      </strong>
                      {gameState.factories.asia === 0 && (
                        <span style={{ color: '#dc2626', fontSize: '0.75rem' }}> (NO PROD)</span>
                      )}
                      {gameState.factories.asia > 0 && (
                        <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}> ({formatUnits(result.capacity.asiaFactoryCapacity)} cap)</span>
                      )}
                    </div>

                    {/* R&D Status */}
                    <div>
                      <span style={{ color: '#64748b' }}>Tech Level: </span>
                      <strong>{gameState.rndProgress.unlockedTechLevel}</strong>
                      {gameState.rndProgress.pendingTechUpgrade && (
                        <span style={{ color: '#f59e0b', fontSize: '0.75rem' }}>
                          {' '}(T{gameState.rndProgress.pendingTechUpgrade.targetLevel} pending)
                        </span>
                      )}
                    </div>
                    <div>
                      <span style={{ color: '#64748b' }}>Features: </span>
                      <strong>{gameState.rndProgress.unlockedFeatureCount}/10</strong>
                      <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}> ({featureProgress.toFixed(0)}% to next)</span>
                    </div>

                    {/* Research Hours */}
                    <div>
                      <span style={{ color: '#64748b' }}>Research/Round: </span>
                      <strong>{formatUnits(result.researchHoursThisRound)}</strong>
                      <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}> hrs</span>
                    </div>
                    <div>
                      <span style={{ color: '#64748b' }}>Total Capacity: </span>
                      <strong>{formatUnits(result.capacity.totalCapacity)}</strong>
                    </div>

                    {/* Outsourcing */}
                    {result.capacity.totalOutsourceCapacity > 0 && (
                      <div style={{ gridColumn: 'span 2', color: '#6366f1' }}>
                        Outsourcing: {formatUnits(result.capacity.totalOutsourceCapacity)} units available
                      </div>
                    )}

                    {/* Pending Investments */}
                    {gameState.pendingInvestments.length > 0 && (
                      <div style={{ gridColumn: 'span 2', color: '#f59e0b' }}>
                        Building: {gameState.pendingInvestments.map(inv =>
                          `${inv.plantsOrdered} ${inv.region.toUpperCase()} plant(s) ready Round ${inv.roundAvailable}`
                        ).join(', ')}
                      </div>
                    )}

                    {/* Lost Sales Warning */}
                    {result.sales.total.unmetDemand > 0 && (
                      <div style={{ gridColumn: 'span 2', color: '#dc2626', fontWeight: 'bold' }}>
                        LOST SALES: {formatUnits(result.sales.total.unmetDemand)} units (capacity constrained!)
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Team Results */}
        <div className="results-grid">
          {roundResults.teams.map(result => (
            <TeamResultCard
              key={result.teamId}
              result={result}
              isWinner={{
                revenue: roundResults.winner.byRevenue === result.teamId,
                profit: roundResults.winner.byProfit === result.teamId,
                marketShare: roundResults.winner.byMarketShare === result.teamId,
                tsr: roundResults.winner.byTSR === result.teamId,
                sharePrice: roundResults.winner.bySharePrice === result.teamId,
              }}
            />
          ))}
        </div>

        {/* Comparison Table */}
        <div className="comparison-section">
          <h3>Head-to-Head Comparison</h3>
          <ComparisonTable results={roundResults.teams} winner={roundResults.winner} />
        </div>
      </section>
    </div>
  )
}

// ============================================================================
// RESULT DISPLAY COMPONENTS
// ============================================================================

interface TeamResultCardProps {
  result: TeamResults
  isWinner: {
    revenue: boolean
    profit: boolean
    marketShare: boolean
    tsr: boolean
    sharePrice: boolean
  }
}

function TeamResultCard({ result, isWinner }: TeamResultCardProps) {
  const [activeTab, setActiveTab] = useState<'summary' | 'pnl' | 'balance' | 'kpis'>('summary')

  return (
    <div className={`result-card ${(isWinner.tsr || isWinner.sharePrice) ? 'winner' : ''}`}>
      <div className="result-header">
        <h3>{result.teamName}</h3>
        {isWinner.tsr && (
          <span
            className="winner-badge"
            title="Total Shareholder Return Leader - highest value returned to shareholders through stock appreciation and dividends"
          >
            TSR Leader
          </span>
        )}
        {isWinner.sharePrice && (
          <span
            className="winner-badge share-price"
            title="Share Price Leader - highest stock price per share"
          >
            Share Price Leader
          </span>
        )}
      </div>

      <div className="result-tabs">
        <button className={activeTab === 'summary' ? 'active' : ''} onClick={() => setActiveTab('summary')}>Summary</button>
        <button className={activeTab === 'pnl' ? 'active' : ''} onClick={() => setActiveTab('pnl')}>P&L</button>
        <button className={activeTab === 'balance' ? 'active' : ''} onClick={() => setActiveTab('balance')}>Balance</button>
        <button className={activeTab === 'kpis' ? 'active' : ''} onClick={() => setActiveTab('kpis')}>KPIs</button>
      </div>

      {activeTab === 'summary' && (
        <table className="result-table">
          <tbody>
            <tr className="section-header-row">
              <td colSpan={2}>Market Share</td>
            </tr>
            <tr>
              <td>US</td>
              <td className="numeric">{formatPercent(result.marketShare.us)}</td>
            </tr>
            <tr>
              <td>Asia</td>
              <td className="numeric">{formatPercent(result.marketShare.asia)}</td>
            </tr>
            <tr>
              <td>Europe</td>
              <td className="numeric">{formatPercent(result.marketShare.europe)}</td>
            </tr>
            <tr className="section-header-row">
              <td colSpan={2}>Sales</td>
            </tr>
            <tr>
              <td>Units Sold</td>
              <td className="numeric">{formatUnits(result.sales.total.units)}</td>
            </tr>
            <tr className={isWinner.revenue ? 'highlight winner-row' : ''}>
              <td>Revenue</td>
              <td className="numeric">{formatCurrency(result.pnl.revenue)}</td>
            </tr>
            <tr className={isWinner.profit ? 'highlight winner-row' : ''}>
              <td>Net Profit</td>
              <td className={`numeric ${result.pnl.netProfit >= 0 ? 'positive' : 'negative'}`}>
                {formatCurrency(result.pnl.netProfit)}
              </td>
            </tr>
            <tr>
              <td>Net Margin</td>
              <td className="numeric">{formatPercent(result.pnl.netMargin)}</td>
            </tr>
          </tbody>
        </table>
      )}

      {activeTab === 'pnl' && (
        <table className="result-table">
          <tbody>
            <tr>
              <td>Revenue</td>
              <td className="numeric">{formatCurrency(result.pnl.revenue)}</td>
            </tr>
            <tr>
              <td>COGS</td>
              <td className="numeric negative">({formatCurrency(result.pnl.cogs)})</td>
            </tr>
            <tr className="subtotal">
              <td>Gross Profit</td>
              <td className="numeric">{formatCurrency(result.pnl.grossProfit)}</td>
            </tr>
            <tr>
              <td>Gross Margin</td>
              <td className="numeric">{formatPercent(result.pnl.grossMargin)}</td>
            </tr>
            <tr>
              <td>Operating Exp.</td>
              <td className="numeric negative">({formatCurrency(result.pnl.operatingExpenses)})</td>
            </tr>
            <tr className="subtotal">
              <td>EBITDA</td>
              <td className="numeric">{formatCurrency(result.pnl.ebitda)}</td>
            </tr>
            <tr>
              <td>Depreciation</td>
              <td className="numeric negative">({formatCurrency(result.pnl.depreciation)})</td>
            </tr>
            <tr>
              <td>EBIT</td>
              <td className="numeric">{formatCurrency(result.pnl.ebit)}</td>
            </tr>
            <tr>
              <td>Interest</td>
              <td className="numeric negative">({formatCurrency(result.pnl.interestExpense)})</td>
            </tr>
            <tr>
              <td>Tax</td>
              <td className="numeric negative">({formatCurrency(result.pnl.tax)})</td>
            </tr>
            <tr className="total">
              <td>Net Profit</td>
              <td className={`numeric ${result.pnl.netProfit >= 0 ? 'positive' : 'negative'}`}>
                {formatCurrency(result.pnl.netProfit)}
              </td>
            </tr>
          </tbody>
        </table>
      )}

      {activeTab === 'balance' && (
        <table className="result-table">
          <tbody>
            <tr className="section-header-row">
              <td colSpan={2}>Assets</td>
            </tr>
            <tr>
              <td>Fixed Assets</td>
              <td className="numeric">{formatCurrency(result.balanceSheet.fixedAssets)}</td>
            </tr>
            <tr>
              <td>Inventory</td>
              <td className="numeric">{formatCurrency(result.balanceSheet.inventory)}</td>
            </tr>
            <tr>
              <td>Receivables</td>
              <td className="numeric">{formatCurrency(result.balanceSheet.receivables)}</td>
            </tr>
            <tr>
              <td>Cash</td>
              <td className="numeric">{formatCurrency(result.balanceSheet.cash)}</td>
            </tr>
            <tr className="subtotal">
              <td>Total Assets</td>
              <td className="numeric">{formatCurrency(result.balanceSheet.totalAssets)}</td>
            </tr>
            <tr className="section-header-row">
              <td colSpan={2}>Liabilities</td>
            </tr>
            <tr>
              <td>Long-term Debt</td>
              <td className="numeric">{formatCurrency(result.balanceSheet.longTermDebt)}</td>
            </tr>
            <tr>
              <td>Short-term Loans</td>
              <td className="numeric">{formatCurrency(result.balanceSheet.shortTermLoans)}</td>
            </tr>
            <tr>
              <td>Payables</td>
              <td className="numeric">{formatCurrency(result.balanceSheet.payables)}</td>
            </tr>
            <tr className="subtotal">
              <td>Total Liabilities</td>
              <td className="numeric">{formatCurrency(result.balanceSheet.totalLiabilities)}</td>
            </tr>
            <tr className="section-header-row">
              <td colSpan={2}>Equity</td>
            </tr>
            <tr className="total">
              <td>Total Equity</td>
              <td className="numeric">{formatCurrency(result.balanceSheet.totalEquity)}</td>
            </tr>
          </tbody>
        </table>
      )}

      {activeTab === 'kpis' && (
        <table className="result-table">
          <tbody>
            <tr className="section-header-row">
              <td colSpan={2}>Share Performance</td>
            </tr>
            <tr className={isWinner.sharePrice ? 'highlight winner-row' : ''}>
              <td>Share Price</td>
              <td className="numeric">${result.kpis.sharePrice.toFixed(2)}</td>
            </tr>
            <tr>
              <td>EPS</td>
              <td className="numeric">${result.kpis.eps.toFixed(2)}</td>
            </tr>
            <tr>
              <td>Market Cap</td>
              <td className="numeric">{formatCurrency(result.kpis.marketCap)}</td>
            </tr>
            <tr className={isWinner.tsr ? 'highlight winner-row' : ''}>
              <td style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                TSR
                <span
                  title="Total Shareholder Return = (Price Change + Dividends) / Start Price. Measures total value returned to shareholders through stock appreciation and dividends."
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '14px',
                    height: '14px',
                    borderRadius: '50%',
                    background: '#e2e8f0',
                    color: '#64748b',
                    fontSize: '10px',
                    fontWeight: 'bold',
                    cursor: 'help'
                  }}
                >?</span>
              </td>
              <td className={`numeric ${result.kpis.tsr >= 0 ? 'positive' : 'negative'}`}>
                {formatPercent(result.kpis.tsr)}
              </td>
            </tr>
            <tr className="section-header-row">
              <td colSpan={2}>Financial Ratios</td>
            </tr>
            <tr>
              <td>ROE</td>
              <td className="numeric">{formatPercent(result.ratios.roe)}</td>
            </tr>
            <tr>
              <td>ROCE</td>
              <td className="numeric">{formatPercent(result.ratios.roce)}</td>
            </tr>
            <tr>
              <td>ROS</td>
              <td className="numeric">{formatPercent(result.ratios.ros)}</td>
            </tr>
            <tr>
              <td>Debt/Equity</td>
              <td className="numeric">{result.ratios.debtToEquity.toFixed(2)}x</td>
            </tr>
          </tbody>
        </table>
      )}
    </div>
  )
}

interface ComparisonTableProps {
  results: TeamResults[]
  winner: RoundResults['winner']
}

function ComparisonTable({ results, winner }: ComparisonTableProps) {
  type WinnerKey = keyof RoundResults['winner']
  const metrics = [
    { key: 'revenue', label: 'Revenue', format: (r: TeamResults) => formatCurrency(r.pnl.revenue), winnerKey: 'byRevenue' },
    { key: 'profit', label: 'Net Profit', format: (r: TeamResults) => formatCurrency(r.pnl.netProfit), winnerKey: 'byProfit' },
    { key: 'margin', label: 'Net Margin', format: (r: TeamResults) => formatPercent(r.pnl.netMargin), winnerKey: null },
    { key: 'marketShare', label: 'Total Market Share', format: (r: TeamResults) => formatPercent((r.marketShare.us + r.marketShare.asia + r.marketShare.europe) / 3), winnerKey: 'byMarketShare' },
    { key: 'units', label: 'Units Sold', format: (r: TeamResults) => formatUnits(r.sales.total.units), winnerKey: null },
    { key: 'tsr', label: 'TSR', format: (r: TeamResults) => formatPercent(r.kpis.tsr), winnerKey: 'byTSR' },
    { key: 'sharePrice', label: 'Share Price', format: (r: TeamResults) => `$${r.kpis.sharePrice.toFixed(2)}`, winnerKey: 'bySharePrice' },
    { key: 'eps', label: 'EPS', format: (r: TeamResults) => `$${r.kpis.eps.toFixed(2)}`, winnerKey: null },
  ]

  return (
    <table className="comparison-table">
      <thead>
        <tr>
          <th>Metric</th>
          {results.map(r => (
            <th key={r.teamId}>{r.teamName}</th>
          ))}
          <th>Leader</th>
        </tr>
      </thead>
      <tbody>
        {metrics.map(metric => {
          const winnerId = metric.winnerKey ? winner[metric.winnerKey as WinnerKey] : null
          const winnerTeam = winnerId ? results.find(r => r.teamId === winnerId) : null

          return (
            <tr key={metric.key}>
              <td className="metric-label">{metric.label}</td>
              {results.map(r => (
                <td
                  key={r.teamId}
                  className={`numeric ${winnerId === r.teamId ? 'winner-cell' : ''}`}
                >
                  {metric.format(r)}
                </td>
              ))}
              <td className="winner-name">
                {winnerTeam ? winnerTeam.teamName : '-'}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

export default DecisionSimulator
