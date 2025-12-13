# Complete Calculation Formulas & Dependencies

## Financial Calculations - P&L Statement (From game.php lines 410-574)

### Revenue Calculations
```javascript
// 1. Sales Revenue
salesRevenue = price × salesVolume

// 2. Transfer Pricing (between markets)
transferRevenue = transferPrice × transferredUnits

// 3. Total Revenue
totalRevenue = salesRevenue + transferRevenue

// 4. Accounts Receivable
receivables = receivablesRate × totalRevenue
```

### Cost Calculations
```javascript
// 1. Variable Production Cost
if (country === 'US') {
  variableCost = unitCost × salesVolume
  costOfImport = 0
} else {  // Asia or Europe
  variableCost = 0
  costOfImport = unitCost × salesVolume
}

// 2. Feature Development Cost
featureCost = featureInvestment  // From R&D decision

// 3. Transportation/Logistics Cost
transportationCost = salesVolume × logisticsCostPerUnit

// 4. Promotion Cost
promotionCost = salesVolume × (variableCost + logisticsCost) × promotionRate

// 5. Administrative Cost
adminCost = fixedAdminCost + (variableAdminCost × salesVolume)

// 6. R&D Cost
rndCost = techInvestment  // From R&D decision

// 7. Total Cost
totalCost = variableCost + featureCost + transportationCost + promotionCost + adminCost + rndCost

// 8. Accounts Payable
payables = payablesRate × totalCost
```

### EBITDA, EBIT, Profit
```javascript
// 1. EBITDA (Earnings Before Interest, Tax, Depreciation, Amortization)
ebitda = totalRevenue - totalCost

// 2. Depreciation
depreciation = depreciationRate × assetValue × 1000

// 3. EBIT (Earnings Before Interest & Tax)
ebit = ebitda - depreciation

// 4. Net Financing Cost
netFinancingCost = interestRate × 1000  // Interest on long-term loans

// 5. Profit Before Tax
profitBeforeTax = ebit - netFinancingCost

// 6. Income Tax
if (profitBeforeTax < 0) {
  incomeTax = 0  // No tax on losses
} else {
  incomeTax = profitBeforeTax × taxRate
}

// 7. Profit After Tax (Net Income)
profitAfterTax = profitBeforeTax - incomeTax
```

---

## Balance Sheet Calculations (From game.php lines 469-507)

### Assets
```javascript
// 1. Fixed Assets
fixedAssets = (assetValue × 1000) - depreciation

// 2. Inventory
inventory = inventoryUnits × costPerUnit

// 3. Receivables (from P&L)
receivables = receivablesRate × totalRevenue

// 4. Cash (Balancing Formula)
retainedEarnings = 0  // For Round 0, later rounds accumulate
cash = retainedEarnings + ebitda - inventory - incomeTax + payables - receivables - netFinancingCost

// 5. Short-term Loans (to meet minimum cash requirement)
if (cash < minimumCash) {
  shortTermLoans = minimumCash - cash
  cash = minimumCash
} else {
  shortTermLoans = 0
}

// 6. Total Assets
totalAssets = fixedAssets + inventory + receivables + cash
```

### Liabilities & Equity
```javascript
// 1. Share Capital
shareCapital = (assetValue - longTermLoans) × 1000

// 2. Retained Earnings (accumulated from previous rounds)
retainedEarnings = previousRetainedEarnings + profitAfterTax - dividends

// 3. Other Restricted Equity
otherRestrictedEquity = 0

// 4. Profit for the Round
profitForTheRound = profitAfterTax

// 5. Total Equity
totalEquity = shareCapital + retainedEarnings + otherRestrictedEquity + profitForTheRound

// 6. Long-term Loans
longTermLoans = longTermLoans × 1000

// 7. Short-term Loans (from cash calculation)
shortTermLoans = (calculated above)

// 8. Payables (from P&L)
payables = payablesRate × totalCost

// 9. Total Liabilities
totalLiabilities = longTermLoans + shortTermLoans + payables

// 10. Total Shareholders' Equity + Liabilities
totalShareholdersEquity = totalEquity + totalLiabilities

// BALANCE CHECK: totalAssets should equal totalShareholdersEquity
```

---

## Financial Ratios (From game.php lines 509-536)

### Market Valuation
```javascript
// 1. Shares Outstanding
sharesOutstanding = shareCapital × 0.1

// 2. Share Price End of Round (randomized with expectations)
expectedDividend = 40  // Expected
expectedSharePrice = 100  // Expected
randomMultiplier = random(10, 25)
sharePriceEnd = (expectedDividend + expectedSharePrice) / (1 + randomMultiplier/100)

// 3. Market Capitalization
marketCap = sharesOutstanding × sharePriceEnd

// 4. Average Share Price (during the round)
averageSharePrice = random(sharePriceEnd × 0.8, sharePriceEnd)

// 5. Dividend (per share)
dividend = 0  // Round 0, later rounds can pay dividends

// 6. P/E Ratio
if (EPS === 0) {
  PE = "-"
} else {
  PE = sharePriceEnd / EPS
}

// 7. Cumulative Return (Total Shareholder Return)
TSR = ((sharePriceEnd - previousSharePrice) + dividend) / previousSharePrice
```

### Profitability Ratios
```javascript
// 1. EBITDA Margin
ebitdaMargin = ebitda / totalRevenue

// 2. EBIT Margin
ebitMargin = ebit / totalRevenue

// 3. ROS (Return on Sales / Net Profit Margin)
ROS = profitAfterTax / totalRevenue

// 4. ROCE (Return on Capital Employed)
ROCE = ebit / totalLiabilities

// 5. ROE (Return on Equity)
ROE = profitAfterTax / totalEquity

// 6. EPS (Earnings Per Share)
if (sharesOutstanding === 0) {
  EPS = 0
} else {
  EPS = profitAfterTax / sharesOutstanding
}
```

### Leverage Ratios
```javascript
// 1. Equity Ratio
equityRatio = totalEquity / totalLiabilities

// 2. Net Debt to Equity
netDebtToEquity = (longTermLoans - shortTermLoans) / totalLiabilities
```

---

## Market Demand Calculations (From game.php lines 608-617 & DEMAND_CALCULATION.md)

### Initial Market Demand (Round 0)
```javascript
// 1. Total Market Demand (capacity-based - OLD SYSTEM)
totalMarketDemand = noOfTeams ×
                    (capacityPerPlant × capacityAllocation × initialFactories) ×
                    (1 - initialInventory/100)

// Example:
// 5 teams × (500 units × 0.95 × 2 factories) × (1 - 0.10) = 4,275 units

// 2. Market Split
usMarketShare = random(30, 35)  // % (from parameters_assumption)
asiaMarketShare = random(40, 45)  // %
europeMarketShare = 100 - (usMarketShare + asiaMarketShare)  // Auto-calculated

usMarketDemand = totalMarketDemand × (usMarketShare / 100)
asiaMarketDemand = totalMarketDemand × (asiaMarketShare / 100)
europeMarketDemand = totalMarketDemand × (europeMarketShare / 100)

// 3. Initial Team Market Share (Equal Distribution)
teamMarketShare_US = usMarketDemand / noOfTeams
teamMarketShare_Asia = asiaMarketDemand / noOfTeams
teamMarketShare_Europe = europeMarketDemand / noOfTeams

// 4. Initial Technology Market Share
// Round 0: 100% Tech 1, 0% Tech 2/3/4
tMarketShare_c1 = "100,0,0,0"  // Tech1: 100%, Tech2: 0%, Tech3: 0%, Tech4: 0%
tMarketShare_c2 = "100,0,0,0"
tMarketShare_c3 = "100,0,0,0"
```

### PROPOSED NEW SYSTEM (From DEMAND_SYSTEM_REDESIGN.md)
```javascript
// Fixed market sizes independent of team capacity
const MARKET_CONFIG = {
  us: {
    baseSize: 1500,        // Fixed base demand
    growthRate: 0.03,      // 3% annual growth
    volatility: 0.15       // ±15% scenario impact
  },
  asia: {
    baseSize: 4000,
    growthRate: 0.08,      // 8% annual growth (emerging)
    volatility: 0.20       // ±20% scenario impact
  },
  europe: {
    baseSize: 1200,
    growthRate: 0.02,      // 2% annual growth (mature)
    volatility: 0.10       // ±10% scenario impact
  }
}

// Round demand calculation
function calculateRoundDemand(market, roundsSinceStart, scenario) {
  // Natural growth
  const growthFactor = Math.pow(
    1 + MARKET_CONFIG[market].growthRate,
    roundsSinceStart / 12  // Convert rounds to years
  )

  // Scenario impact
  const scenarioFactor = 1 + (scenario.effects.demandChange / 100)

  return Math.round(
    MARKET_CONFIG[market].baseSize × growthFactor × scenarioFactor
  )
}
```

---

## Scenario-Based Market Evolution (From game.php lines 891-1020 & HOW_ROUNDS_WORK.md)

### How Market Parameters Change Per Round
```javascript
// For Round 0 (Practice):
marketParams_Round0 = baseMarketParams  // From parameters_assumption table

// For Round 1+:
for (let round = 1; round <= totalRounds; round++) {
  // Pick random scenario for each market
  const scenarioUS = randomScenario(1, 8)      // US
  const scenarioAsia = randomScenario(1, 8)    // Asia
  const scenarioEurope = randomScenario(1, 8)  // Europe

  // Get scenario percentage changes (29 parameters)
  const changesUS = scenarios[scenarioUS].value     // e.g., "10,10,10,10,..."
  const changesAsia = scenarios[scenarioAsia].value
  const changesEurope = scenarios[scenarioEurope].value

  // Apply changes to each of 29 parameters
  for (let param = 0; param < 29; param++) {
    const changePercent = changesUS[param]  // e.g., 10 for +10%
    const previousValue = marketParams_previousRound[param]

    const newValue = previousValue × (1 + changePercent / 100)
    marketParams_currentRound[param] = newValue
  }

  // Store in round_assumption table
  storeRoundAssumption(gameId, round, {
    scenarioIds: [scenarioUS, scenarioAsia, scenarioEurope],
    marketParams: {
      us: marketParams_US,
      asia: marketParams_Asia,
      europe: marketParams_Europe
    }
  })
}
```

### The 29 Market Parameters (That Change Per Round)
```javascript
const MARKET_PARAMS = [
  1.  'change_in_demand',           // Demand multiplier
  2.  'unitcost_direct_material',   // Material cost per unit
  3.  'unitcost_supplier1',         // Supplier 1 cost
  4.  'unitcost_supplier2',         // Supplier 2 cost
  5.  'unitcost_supplier3',         // Supplier 3 cost (CSR-friendly)
  6.  'unitcost_supplier4',         // Supplier 4 cost
  7.  'unitcost_direct_labour',     // Labour cost per unit
  8.  'production_max_outsource',   // Max outsource capacity
  9.  'tax',                        // Corporate tax rate
  10. 'interest',                   // Long-term interest rate
  11. 'min_wage',                   // Minimum wage
  12. 'cost_tech1',                 // R&D cost Tech 1
  13. 'cost_tech2',                 // R&D cost Tech 2
  14. 'cost_tech3',                 // R&D cost Tech 3
  15. 'cost_tech4',                 // R&D cost Tech 4
  16. 'Exchange_rate21',            // Exchange rate Asia→US
  17. 'Exchange_rate31',            // Exchange rate Europe→US
  18. 'Logistic_tariffs_c1_c2',    // Tariff US→Asia
  19. 'Logistic_tariffs_c2_c1',    // Tariff Asia→US
  20. 'Logistic_tariffs_c1_c3',    // Tariff US→Europe
  21. 'fix_admin_cost',            // Fixed admin cost
  22. 'variable_admin_cost',       // Variable admin cost per unit
  23. 'cost_per_plant',            // Plant construction cost
  24. 'cost_outsource',            // Outsourcing cost per unit
  25. 'short_interest',            // Short-term loan premium
  26. 'tech1_att',                 // Tech 1 attractiveness
  27. 'tech2_att',                 // Tech 2 attractiveness
  28. 'tech3_att',                 // Tech 3 attractiveness
  29. 'tech4_att'                  // Tech 4 attractiveness
]
```

---

## Competitive Market Share Distribution (Needs Full Analysis)

### Current System (From game.php line 3037+)
```javascript
// Teams compete based on:
// 1. Technology available (tech_1, tech_2, tech_3, tech_4)
// 2. Features invested
// 3. Price set
// 4. Promotion spend
// 5. Supplier choice (CSR impact)

// Market share calculation appears to be in separate calculation files
// Need to analyze: calculate.php or similar files

// Technology Market Share Evolution:
// Round 0: "100,0,0,0" (100% Tech1, rest 0%)
// Round 1+: Competitive distribution based on team decisions
```

### PROPOSED IMPROVED SYSTEM (From DEMAND_SYSTEM_REDESIGN.md)
```javascript
function calculateMarketShare(teams, marketDemand, marketParams) {
  // Step 1: Calculate attractiveness score for each team
  const teamScores = teams.map(team => {
    const {
      price,
      features,
      promotion,
      technology,
      supplier
    } = team.productOffering

    // Quality score (features + technology)
    const qualityScore = (features × 0.4) + (technology.attractiveness × 0.6)

    // Price score (lower price = higher score)
    const priceScore = 1 / (price / marketParams.averagePrice)

    // Promotion bonus
    const promotionBonus = 1 + (promotion / 100)

    // CSR bonus (Supplier 3 is CSR-friendly)
    const csrBonus = supplier.csrRating > 7 ? 1.1 : 1.0

    // Apply consumer preference weights from scenario
    const attractiveness =
      (qualityScore × marketParams.consumerPreferences.qualityWeight) ×
      (priceScore × marketParams.consumerPreferences.priceWeight) ×
      promotionBonus ×
      csrBonus

    return {
      teamId: team.id,
      attractiveness,
      maxCapacity: team.productionCapacity
    }
  })

  // Step 2: Distribute demand proportionally
  const totalAttractiveness = teamScores.reduce((sum, t) => sum + t.attractiveness, 0)

  const marketShares = teamScores.map(team => {
    const demandShare = (team.attractiveness / totalAttractiveness) × marketDemand

    // Cap at production capacity
    const actualSales = Math.min(demandShare, team.maxCapacity)

    return {
      teamId: team.teamId,
      demandShare,
      actualSales,
      marketSharePercent: (actualSales / marketDemand) × 100,
      lostSales: demandShare - actualSales  // Unfulfilled demand
    }
  })

  return marketShares
}
```

---

## Production Capacity & Cost Calculations

### Capacity Multiplier Cost Formula (From game.php cost equation)
```javascript
// Cost equation parameters: a, b, c, d
// Example: "0.9, 6, -0.85, 1.5"

function calculateProductionCost(capacity, promotion, a, b, c, d) {
  const baseCost = (a × Math.pow(capacity, b)) + (c × capacity) + d
  const totalCost = (1 + promotion) × baseCost
  return totalCost
}

// Example:
// capacity = 1000 units
// promotion = 0.1 (10%)
// a=0.9, b=6, c=-0.85, d=1.5
// baseCost = (0.9 × 1000^6) + (-0.85 × 1000) + 1.5
// totalCost = 1.1 × baseCost
```

### Learning Curve Effect
```javascript
// Production efficiency improves with cumulative output
// Typically: 85-95% learning curve
// For every doubling of cumulative production, cost reduces by 5-15%

learningRate = 0.90  // 90% learning curve (10% reduction per doubling)
cumulativeProduction = previousCumulativeProduction + currentProduction
learningFactor = Math.pow(cumulativeProduction / initialProduction, Math.log(learningRate) / Math.log(2))

adjustedUnitCost = baseUnitCost × learningFactor
```

---

## Investment & Plant Construction (2-Round Lag)

### Investment Decision Tracking
```javascript
// Round N: Team decides to build plant
investmentDecision = {
  round: N,
  market: 'Asia',
  plantCost: 50000000,  // $50M
  capacity: 500000      // 500k units
}

// Round N: Record investment, no production yet
// Round N+1: Plant under construction, cash outflow, still no production
// Round N+2: Plant operational, production capacity increases

// Implementation:
investments = []

// Round N:
investments.push({
  decidedRound: N,
  operationalRound: N + 2,
  market: 'Asia',
  capacity: 500000
})

// Round N+2:
const operationalInvestments = investments.filter(inv => inv.operationalRound === currentRound)
totalCapacity += operationalInvestments.reduce((sum, inv) => sum + inv.capacity, 0)
```

---

## R&D & Technology (1-Round Lag)

### Technology Development
```javascript
// Round N: Team invests in Tech 2
rndDecision = {
  round: N,
  technology: 'Tech2',
  cost: 10000000  // $10M
}

// Round N: Record R&D investment, technology NOT available yet
// Round N+1: Technology becomes available for production

// Technology Availability by Market (Network Coverage)
const TECH_AVAILABILITY = {
  us: {
    tech1: [70, 80, 90, 100, 100],  // % coverage per round
    tech2: [20, 35, 50, 65, 80],
    tech3: [0, 0, 10, 25, 40],
    tech4: [0, 0, 0, 5, 15]
  },
  asia: {
    tech1: [80, 90, 95, 100, 100],
    tech2: [10, 25, 40, 60, 75],
    tech3: [0, 0, 5, 15, 30],
    tech4: [0, 0, 0, 0, 10]
  },
  europe: {
    tech1: [75, 85, 95, 100, 100],
    tech2: [15, 30, 45, 60, 70],
    tech3: [0, 0, 8, 20, 35],
    tech4: [0, 0, 0, 3, 12]
  }
}

// Can only sell to % of market with network coverage
maxTech2Sales_US_Round1 = usMarketDemand × (35 / 100)  // Only 35% have Tech 2 network
```

---

## Summary: Calculation Dependencies

### Data Flow:
```
1. Game Creation
   ↓
2. Auto-generate base parameters (76 parameters from min/max ranges)
   ↓
3. Generate Round 0-N with random scenarios
   ↓
4. Teams make decisions (7 areas)
   ↓
5. Calculate results:
   - Market share distribution (competitive)
   - Sales volume per team
   - Production costs
   - P&L Statement (57 line items)
   - Balance Sheet (40 line items)
   - Financial Ratios (17 ratios)
   ↓
6. Store results
   ↓
7. Results become input for next round
```

### Key Dependencies:
- **Market demand** depends on: Scenario changes to base market size
- **Sales** depends on: Market share (competitive) + Production capacity (constraint)
- **Costs** depends on: Supplier choice, Volume, Outsourcing, Logistics
- **Cash** depends on: EBITDA, Inventory, Tax, Payables, Receivables
- **Ratios** depend on: All P&L and Balance Sheet items
- **Next round** depends on: Previous round results + New scenario

This creates a **highly interdependent simulation** where every decision affects multiple outcomes!
