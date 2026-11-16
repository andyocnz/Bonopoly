/**
 * Debug script to understand balance sheet mismatch
 */

import {
  calculateRound,
  createInitialGameState,
  getGameConfigForIndustry,
  getBalancedStartingFinancials,
  type TeamGameState,
  type TeamDecisions,
  type GameConfig,
} from '../src/engine/gameEngine'

function createBaseDecisions(config: GameConfig): TeamDecisions {
  const basePrice = config.priceDemand.baselinePriceByRegion
  return {
    production: {
      usUnits: config.initialFactories.us * config.capacityPerPlant * 0.8,
      asiaUnits: 0,
      outsourceUS: 0,
      outsourceAsia: 0,
      overtime: 0,
      supplierUS: 2,
      supplierAsia: 2,
      productionLines: {
        us1: { techLevel: 1, supplierId: 2, units: 50 },
        us2: { techLevel: 1, supplierId: 2, units: 50 },
      },
      outsource: { techLevel: 1, supplierId: 2, units: 0 },
      demandForecast: { us: 100000, asia: 100000, europe: 100000 },
      techShareForecast: { us: {}, asia: {}, europe: {} } as TeamDecisions['production']['techShareForecast']
    },
    marketing: {
      us: { price: basePrice.us, features: 0, promotionPct: 5 },
      asia: { price: basePrice.asia, features: 0, promotionPct: 5 },
      europe: { price: basePrice.europe, features: 0, promotionPct: 5 }
    },
    hr: {
      us: { employees: 50, wage: 5000, training: 0 },
      asia: { employees: 0, wage: 2000, training: 0 }
    },
    rnd: {
      featureInvestment: 0,
      researchStaff: 0
    },
    investment: { newPlantsUS: 0, newPlantsAsia: 0 },
    logistics: {
      usPriority: ['us', 'europe', 'asia'],
      asiaPriority: ['asia', 'europe', 'us']
    },
    finance: {
      longTermDebt: 0,  // positive = borrow, negative = repay
      shareIssuance: 0, // positive = issue, negative = buyback
      dividends: 0,
      transferPricing: { us: 1, asia: 1, europe: 1 }
    }
  }
}

const config = getGameConfigForIndustry('Electronics')
const financials = getBalancedStartingFinancials(config)

console.log('=== CONFIG FINANCIAL DEFAULTS ===')
console.log('config.financial.startingCash:', config.financial.startingCash)
console.log('config.financial.startingDebt:', config.financial.startingDebt)
console.log('config.financial.startingShareCapital:', config.financial.startingShareCapital)

console.log('=== STARTING FINANCIALS ===')
console.log('Fixed Assets:', financials.fixedAssets.toLocaleString())
console.log('Inventory Value:', financials.inventoryValue.toLocaleString())
console.log('Cash:', financials.startingCash.toLocaleString())
console.log('Total Assets:', financials.totalAssets.toLocaleString())
console.log('Starting Debt:', financials.startingDebt.toLocaleString())
console.log('Share Capital:', financials.startingShareCapital.toLocaleString())
console.log('Shares Outstanding:', financials.sharesOutstanding.toLocaleString())

// Run one round
const teams = [{ id: 1, name: 'Test', decisions: createBaseDecisions(config) }]
const initialStates = new Map<number, TeamGameState>()
initialStates.set(1, createInitialGameState(config))

const results = calculateRound(teams, 1, initialStates, [0], 1, config)
const t = results.teams[0]

console.log('\n=== ROUND 1 BALANCE SHEET ===')
console.log('Fixed Assets:', t.balanceSheet.fixedAssets.toLocaleString())
console.log('Inventory:', t.balanceSheet.inventory.toLocaleString())
console.log('Receivables:', t.balanceSheet.receivables.toLocaleString())
console.log('Cash:', t.balanceSheet.cash.toLocaleString())
console.log('TOTAL ASSETS:', t.balanceSheet.totalAssets.toLocaleString())
console.log('')
console.log('Long-term Debt:', t.balanceSheet.longTermDebt.toLocaleString())
console.log('Short-term Loans:', t.balanceSheet.shortTermLoans.toLocaleString())
console.log('Payables:', t.balanceSheet.payables.toLocaleString())
console.log('TOTAL LIABILITIES:', t.balanceSheet.totalLiabilities.toLocaleString())
console.log('')
console.log('Share Capital:', t.balanceSheet.shareCapital.toLocaleString())
console.log('Retained Earnings:', t.balanceSheet.retainedEarnings.toLocaleString())
const balanceSheetWithCurrentProfit = t.balanceSheet as typeof t.balanceSheet & { currentProfit?: number }
console.log('Current Profit:', balanceSheetWithCurrentProfit.currentProfit?.toLocaleString() ?? 'N/A')
console.log('TOTAL EQUITY:', t.balanceSheet.totalEquity.toLocaleString())
console.log('')
console.log('ASSETS:', t.balanceSheet.totalAssets.toLocaleString())
console.log('L + E:', (t.balanceSheet.totalLiabilities + t.balanceSheet.totalEquity).toLocaleString())
console.log('DIFF:', (t.balanceSheet.totalAssets - (t.balanceSheet.totalLiabilities + t.balanceSheet.totalEquity)).toLocaleString())

console.log('\n=== P&L ===')
console.log('Revenue:', t.pnl.revenue.toLocaleString())
console.log('COGS:', t.pnl.cogs.toLocaleString())
console.log('Gross Profit:', t.pnl.grossProfit.toLocaleString())
console.log('Net Profit:', t.pnl.netProfit.toLocaleString())

console.log('\n=== KPIs ===')
console.log('Share Price:', t.kpis.sharePrice.toLocaleString())
console.log('EPS:', t.kpis.eps.toLocaleString())
console.log('Market Cap:', t.kpis.marketCap.toLocaleString())

console.log('\n=== DEBUG - DECISION FINANCE ===')
console.log('decisions.finance.longTermDebt:', teams[0].decisions.finance.longTermDebt)
console.log('decisions.finance.shareIssuance:', teams[0].decisions.finance.shareIssuance)
console.log('decisions.finance.dividends:', teams[0].decisions.finance.dividends)

console.log('\n=== RESULT KEYS ===')
console.log('keys:', Object.keys(t))
console.log('sales.total:', t.sales?.total)
console.log('gameState.inventory:', t.gameState?.inventory)
console.log('capacity:', t.capacity)
