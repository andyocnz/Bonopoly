# AIgopoly Game Parameters Reference

**Document Version:** 1.0
**Last Updated:** February 2026
**Simulation Engine:** v3.2

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Industry-Specific Configurations](#industry-specific-configurations)
3. [Educational Guide - Key Parameters](#educational-guide---key-parameters)
4. [Comprehensive Technical Reference](#comprehensive-technical-reference)
5. [Scenario System](#scenario-system)

---

# Executive Summary

## Overview

AIgopoly is a sophisticated business simulation that models a global manufacturing company competing in three regional markets (US, Asia, Europe). The simulation incorporates realistic business mechanics including production capacity, workforce management, R&D, marketing, logistics, and financial management.

**IMPORTANT:** Parameters are **industry-specific**. The simulation supports three industries with different economics:
- **Electronics** (smartphones, tablets) - Default configuration
- **Oil & Energy** (refineries, petroleum products)
- **Automotive** (electric vehicles)

Each industry has unique features, costs, pricing, and scale.

## Key Parameter Categories

| Category | Description | Key Metrics |
|----------|-------------|-------------|
| **Production** | Factory capacity and manufacturing | 325,000 units/plant, 2 regions |
| **Market** | Regional demand and competition | 3 markets, dynamic pricing |
| **Workforce** | HR management and training | 1,500 mandays/worker |
| **R&D** | Product features and innovation | 20 features, sequential unlock |
| **Finance** | Capital structure and profitability | $15M starting cash, 25% tax |
| **Quality** | Product attractiveness | 50 base tech score |

## Market Regions

- **US:** 22% market share, price-sensitive (0.6 elasticity)
- **Asia:** 60% market share, highly price-sensitive (1.0 elasticity)
- **Europe:** 18% market share, quality-focused (0.8 elasticity)

**Note:** Values shown are for **Electronics industry** (default in Strategy Lab). See Industry Configurations section for Oil & Energy and Automotive variations.

## Starting Position

Each team begins with:
- **Cash:** $15,000,000
- **Debt:** $20,000,000
- **Equity:** $60,000,000
- **Factories:** 1 US plant (0 Asia)
- **Capacity:** Varies by industry (see below)
- **Share Price:** $10.00

---

# Industry-Specific Configurations

The simulation adapts parameters based on the selected industry to reflect real-world economics. Below are the key differences between industries.

## Industry Comparison Table

| Parameter | Electronics | Oil & Energy | Automotive |
|-----------|-------------|--------------|------------|
| **Product** | Smartphones/Tablets | Refined Petroleum | Electric Vehicles |
| **Capacity/Plant** | 325,000 units | 2,000,000 barrels | 150,000 vehicles |
| **Baseline Price (US)** | $125 | $100/barrel | $36,000 |
| **Unit Material Cost (US)** | $22 | $26 | $18,000 |
| **Unit Labor Cost (US)** | $14 | $10 | $5,000 |
| **Plant Cost (US)** | $30M | $45M | $1,500M |
| **Plant Cost (Asia)** | $18M | $32M | $1,000M |
| **Outsource Capacity** | 200K units | 300K barrels | 80K vehicles |
| **Tariff (US→Asia)** | $10/unit | $12/barrel | $1,800/vehicle |
| **Market Growth (Asia)** | 8% | 5% | 3% |
| **Price Elasticity (Asia)** | 1.0 | 1.4 | 0.8 |
| **Starting Employees (US)** | 50 | 50 | 200 |
| **Starting Wage (US)** | $5,000 | $5,000 | $8,000 |

## Electronics Industry (Default)

**Features:** Product innovation focused (Wi-Fi 6, Fast Charge, AI features)
- High consumer sensitivity to features and technology
- Moderate price elasticity
- Fast market growth in Asia (8% annually)
- Lower capital intensity ($30M per US plant)

**Teaching Focus:** Innovation cycles, feature competition, global supply chains

## Oil & Energy Industry

**Features:** Refinery technology (Advanced Refining, Carbon Capture, Renewables)
- Commodity market with high price volatility
- **Very high price elasticity (1.4 in Asia)** - customers extremely price-sensitive
- Massive production scale (2M barrels vs 325K electronics units)
- Higher capital costs but lower unit costs
- Slower market growth (5% Asia)
- Lower promotion spending (2% vs 5%)

**Teaching Focus:** Commodity markets, economies of scale, sustainability transitions

## Automotive Industry

**Features:** Safety and autonomy (ABS, Lane Assist, Autonomy Stack)
- **Extremely high capital intensity** ($1.5B per US plant)
- Very high unit costs ($23K per vehicle)
- Premium pricing ($36K baseline)
- Lower price elasticity (0.6-0.8) - customers less price-sensitive
- Smaller production volumes (150K vehicles)
- Large workforce (200 starting employees at $8K/month)
- Slower market growth (3% Asia)

**Teaching Focus:** Capital-intensive industries, supply chain complexity, transition to EVs

## Industry-Specific Feature Catalogs

### Electronics Features
1-5: Wi-Fi 6, Fast Charge, Secure Enclave, Spatial Audio, Multi-Device Sync
6-10: On-Device AI, Computational Camera, Adaptive Display, Precision GPS, Thermal Control
11-15: Biometric Lock, Cloud Backup, Modular Design, Smart Assist, Nano-Coating
16-20: Ultra-Wideband, All-Day Battery+, Self-Diagnostics, Chipset Gen-X, Quantum-Ready

### Oil & Energy Features
1-5: Advanced Refining, Safety Systems, Emissions Scrubbers, Leak Detection, Predictive Maintenance
6-10: Thermal Recovery, Enhanced Extraction, Grid Integration, Storage Buffering, Logistics Optimization
11-15: Waste Reprocessing, Remote Monitoring, Carbon Capture, Efficiency Boost, Emergency Response
16-20: Catalyst Upgrade, Supply Traceability, Hybrid Feedstock, Synthetic Fuels, Renewables Portfolio

### Automotive Features
1-5: ABS Braking, Infotainment, Adaptive Cruise, Fast Charging, Cloud Sync
6-10: GPS + Traffic, Vehicle Security, Lane Assist, LED Matrix, All-Weather Mode
11-15: Auto Parking, Battery Health, V2X Comms, Predictive Maintenance, Driver Monitoring
16-20: Vehicle-to-Home, Ultra Fast Charge, HD Mapping, Solid-State Ready, Autonomy Stack

## When to Use Each Industry

**Electronics:** Best for introductory courses. Moderate complexity, intuitive product features, familiar to students.

**Oil & Energy:** Advanced courses covering commodities, sustainability, energy transition. High price sensitivity teaches demand curves clearly.

**Automotive:** MBA/graduate courses. Capital budgeting, long investment cycles, complex supply chains. Real-world EV transition context.

## Strategy Lab Default Configuration

**The Strategy Lab uses the Electronics industry by default.**

This provides the best balance of:
- Intuitive product features students understand (smartphones)
- Moderate price points and costs
- Realistic market dynamics
- Balanced complexity for strategy analysis

Educators can override the industry in custom game configurations if needed.

---

# Educational Guide - Key Parameters

**Note:** The following parameters use **Electronics industry** as the reference. For Oil & Energy and Automotive variations, see the Industry Comparison Table above.

This section focuses on pedagogically important parameters that illustrate core business concepts.

## 1. Production & Capacity Management

### Factory Capacity
- **Capacity per Plant:** 325,000 units/round
- **Initial Setup:** 1 US factory, 0 Asia factories
- **Expansion Costs:**
  - US Plant: $30,000,000
  - Asia Plant: $18,000,000
- **Construction Lag:** 1 round

**Teaching Point:** *Capital investment decisions involve significant upfront costs and time delays. Students must forecast demand and plan capacity expansion ahead of market needs.*

### Outsourcing
- **Max Capacity (US):** 200,000 units
- **Max Capacity (Asia):** 200,000 units
- **Cost Premium:** 30% above in-house production

**Teaching Point:** *Outsourcing provides flexibility but at higher unit costs. This models the make-vs-buy decision companies face.*

### Production Efficiency
- **Optimal Utilization:** 80% of capacity
- **Cost Curve Exponent:** 4.0 (steep penalty for over/under-utilization)

**Teaching Point:** *Operating too close to maximum capacity increases inefficiency and costs. The sweet spot balances volume with operational efficiency.*

## 2. Workforce & Human Resources

### Labor Costs by Region
- **US Minimum Wage:** $4,000/month
- **Asia Minimum Wage:** $1,500/month
- **Admin Overhead:** 20% (minimum 10 staff)

**Teaching Point:** *Regional wage differences create offshoring incentives, but must be balanced against other factors like quality and logistics costs.*

### Training System
- **Basic Training:** $0 (1.0x efficiency)
- **Standard Training:** $2,000/employee (1.1x efficiency)
- **Advanced Training:** $5,000/employee (1.1x efficiency)
- **Training Cost Multiplier (Asia):** 0.6x

**Teaching Point:** *Investment in human capital improves productivity. The 10% efficiency boost must be weighed against training costs.*

### Research Hours
- **Mandays per Worker:** 1,500 hours/round
- **Efficiency with Training:** +10% boost
- **Purpose:** Unlock product features

**Teaching Point:** *R&D requires sustained investment in skilled labor. Training amplifies research productivity.*

## 3. Market Dynamics & Pricing

### Regional Baseline Prices
- **US:** $125
- **Asia:** $115
- **Europe:** $130

**Teaching Point:** *Different markets have different willingness to pay, reflecting income levels and competitive dynamics.*

### Price Elasticity of Demand
- **US:** 0.6 (moderately elastic)
- **Asia:** 1.0 (highly elastic)
- **Europe:** 0.8 (moderately elastic)

**Teaching Point:** *Price sensitivity varies by market. Asia responds strongly to price changes, while US and Europe are less sensitive.*

### Market Share Calculation
Teams compete on six factors, weighted by regional preferences:

**US Market Weights:**
- Price: 22%
- Quality: 25%
- Features: 28%
- Promotion: 5%
- CSR: 15%
- Training: 5%

**Asia Market Weights:**
- Price: 40%
- Quality: 17%
- Features: 28%
- Promotion: 5%
- CSR: 5%
- Training: 5%

**Europe Market Weights:**
- Price: 18%
- Quality: 25%
- Features: 22%
- Promotion: 10%
- CSR: 25%
- Training: 5%

**Teaching Point:** *Market segmentation is real. Asian customers prioritize price, Europeans value sustainability (CSR), and US markets balance multiple factors.*

## 4. Research & Development

### Feature Unlock System
Features unlock sequentially (cannot skip ahead). Research hours accumulate across rounds.

**First 5 Features (cumulative hours required):**
1. Wi-Fi 6: 20,000 hours
2. Fast Charge: 48,000 hours
3. Secure Enclave: 80,000 hours
4. Spatial Audio: 120,000 hours
5. Multi-Device Sync: 168,000 hours

**Impact on Quality:**
- **Base Tech Score:** 50
- **Per Feature Bonus:** +2 (max +30 for all 15 features)

**Teaching Point:** *Innovation requires sustained investment. Each feature provides incremental competitive advantage, but costs escalate rapidly.*

### Feature Diminishing Returns
- **Features Coefficient (K):** 0.15
- **Formula:** Score = 100 × (1 - e^(-K × features))

**Teaching Point:** *The marginal value of additional features declines. The first few features provide significant differentiation, later features provide smaller incremental benefits.*

## 5. Logistics & Supply Chain

### Tariff Costs (per unit shipped)
| From/To | US | Asia | Europe |
|---------|----|----|--------|
| **US** | $0 | $10 | $7 |
| **Asia** | $10 | $0 | $9 |

**Teaching Point:** *Cross-border shipping incurs tariffs. Local production avoids these costs but requires factory investment.*

### Inventory Holding Cost
- **Annual Rate:** 1% of inventory value
- **Components:** Warehousing, insurance, obsolescence

**Teaching Point:** *Excess inventory ties up capital and incurs carrying costs. Just-in-time production reduces these costs.*

## 6. Financial Management

### Capital Structure
- **Starting Equity:** $60,000,000
- **Starting Debt:** $20,000,000
- **Starting Cash:** $15,000,000

**Teaching Point:** *Companies are financed through a mix of equity (ownership) and debt (borrowed capital).*

### Interest Rates
- **Long-term Debt Rate:** 5% base
- **Short-term Debt Rate:** 10% (2x penalty)
- **Scenario Spread:** Varies by economic conditions

**Teaching Point:** *Short-term borrowing costs more. Poor cash management forces expensive emergency borrowing.*

### Taxation
- **US Tax Rate:** 20%
- **Asia Tax Rate:** 15%
- **Europe Tax Rate:** 25%
- **Effective Tax Rate:** Blended based on regional profits

**Teaching Point:** *Tax rates vary by jurisdiction. Transfer pricing strategies can shift profits to lower-tax regions.*

### Share Price Valuation
- **Base P/E Ratio:** 15
- **Growth Premium Factors:**
  - Capacity growth: 10%
  - Market share growth: 10%
  - Brand strength: 8%
  - Cash position: 4%
- **Premium Cap:** -20% to +35%
- **Smoothing Factor:** 45% previous price, 55% new calculation

**Teaching Point:** *Stock prices reflect both current profitability (P/E ratio) and growth prospects. The market rewards expansion and penalizes deterioration.*

### Debt Management
**Debt-to-Asset Thresholds:**
- **Safe (<20%):** No penalty
- **Warning (20-40%):** Mild penalty
- **Danger (>60%):** Severe penalty
- **Maximum:** 40% debt-to-assets ratio

**Teaching Point:** *Leverage amplifies returns but increases risk. Excessive debt triggers credit concerns and constrains flexibility.*

---

# Comprehensive Technical Reference

## Production System

### Capacity Configuration
```javascript
capacityPerPlant: 325_000  // Units per round per factory
```

### Initial Factory State
```javascript
initialFactories: {
  us: 1,      // Start with 1 US factory
  asia: 0,    // Start with 0 Asia factories
}
```

### Outsourcing Parameters
```javascript
outsourcing: {
  maxCapacityUS: 200_000,
  maxCapacityAsia: 200_000,
  costPremium: 0.30,  // 30% premium over in-house
}
```

### Cost Curve
```javascript
costCurve: {
  optimalUtilization: 0.8,  // 80% capacity is optimal
  curvature: 4.0,           // Steepness of inefficiency penalty
}
```

**Formula:**
```
Utilization = actual_production / capacity
Efficiency_Multiplier = 1 + ((utilization - optimal) / optimal)^curvature
```

### Unit Production Costs

**Direct Material:**
- US: $22/unit
- Asia: $18/unit

**Direct Labor:**
- US: $14/unit
- Asia: $7/unit

**Supplier Multipliers:**
```javascript
supplier: {
  1: 1.00,  // Budget
  2: 1.05,  // Standard
  3: 1.10,  // Eco-Friendly
  4: 1.15,  // Premium
}
```

**Total Unit Cost Formula:**
```
Base_Cost = (Direct_Material + Direct_Labor) × Supplier_Multiplier
Actual_Cost = Base_Cost × Efficiency_Multiplier
```

### Supplier CSR Scores
```javascript
supplierCSR: {
  1: 1,  // Budget (lowest CSR)
  2: 2,  // Standard
  3: 4,  // Eco-Friendly (high CSR)
  4: 3,  // Premium
}
```

## Market Demand System

### Base Demand Calculation
```
Total_Base_Demand = capacityPerPlant × 1.0 × num_teams
```

### Regional Demand Split
```javascript
defaultRegionSplit: {
  us: 0.22,      // 22% of total market
  asia: 0.60,    // 60% of total market
  europe: 0.18,  // 18% of total market
}
```

### Market Growth Rates (annual %)
```javascript
marketGrowthRate: {
  us: 3,      // 3% annual growth
  asia: 8,    // 8% annual growth
  europe: 2,  // 2% annual growth
}
```

### Mode Multipliers
```javascript
modeMultipliers: {
  balanced: 1.0,           // Standard market size
  blue_ocean: 2.0,         // Large untapped market
  high_competition: 0.75,  // Saturated market
}
```

## Pricing & Demand Elasticity

### Baseline Prices by Region
```javascript
baselinePriceByRegion: {
  us: 125,
  asia: 115,
  europe: 130
}
```

### Price Bounds
```javascript
minPriceByRegion: { us: 80, asia: 70, europe: 85 }
maxPriceByRegion: { us: 220, asia: 200, europe: 230 }
```

### Elasticity Coefficients
```javascript
elasticityByRegion: {
  us: 0.6,     // 1% price increase → 0.6% demand decrease
  asia: 1.0,   // 1% price increase → 1.0% demand decrease
  europe: 0.8, // 1% price increase → 0.8% demand decrease
}
```

### Demand Multiplier Bounds
```javascript
minDemandMultiplier: 0.05,  // Demand can't fall below 5%
maxDemandMultiplier: 1.2,   // Demand can't exceed 120%
```

### Price Penalty Curve
```javascript
penaltyK: 2.2,             // Curve steepness
penaltyFloor: 0.02,        // Minimum 2% demand at extreme prices
penaltyCapMultiple: 2.5,   // Penalty calculation cap
```

**Formula:**
```
Price_Deviation = (actual_price - baseline_price) / baseline_price
Elasticity_Effect = Price_Deviation × elasticity
Demand_Multiplier = exp(-penaltyK × |Elasticity_Effect|)
Demand_Multiplier = max(penaltyFloor, min(maxDemandMultiplier, Demand_Multiplier))
```

## Market Share Attractiveness System

### Regional Preference Weights

**US Market:**
```javascript
{
  priceWeight: 0.22,
  qualityWeight: 0.25,
  featuresWeight: 0.28,
  promotionWeight: 0.05,
  csrWeight: 0.15,
  trainingWeight: 0.05
}
```

**Asia Market:**
```javascript
{
  priceWeight: 0.40,
  qualityWeight: 0.17,
  featuresWeight: 0.28,
  promotionWeight: 0.05,
  csrWeight: 0.05,
  trainingWeight: 0.05
}
```

**Europe Market:**
```javascript
{
  priceWeight: 0.18,
  qualityWeight: 0.25,
  featuresWeight: 0.22,
  promotionWeight: 0.10,
  csrWeight: 0.25,
  trainingWeight: 0.05
}
```

### Scoring Curves

**Price Score:**
```javascript
priceExponent: 0.35
priceClampMin: 60
priceClampMax: 140
```
**Formula:**
```
Price_Ratio = market_avg_price / team_price
Clamped_Ratio = clamp(Price_Ratio, 60, 140)
Price_Score = 100 × (Clamped_Ratio / 100)^priceExponent
```

**Quality Score:**
```javascript
baseTechScore: 50  // Base quality level
```
**Formula:**
```
Quality_Score = baseTechScore + (features × 2)  // Max +30 for 15 features
```

**Features Score:**
```javascript
featuresK: 0.15  // Diminishing returns coefficient
```
**Formula:**
```
Features_Score = 100 × (1 - exp(-featuresK × num_features))
```

**Promotion Score:**
```javascript
promotionK: 0.08  // Diminishing returns coefficient
```
**Formula:**
```
Promotion_Score = 100 × (1 - exp(-promotionK × promotion_pct))
```

**Training Score:**
```javascript
trainingK: 0.35  // Diminishing returns coefficient
```
**Formula:**
```
training_level_pct = { basic: 0, standard: 50, advanced: 100 }
Training_Score = 100 × (1 - exp(-trainingK × (training_level_pct / 100)))
```

**CSR Score:**
```
CSR_Score = supplier_csr_score × 25  // Normalize to 100 scale
```

### Attractiveness Calculation
```
Attractiveness =
  (Price_Score × priceWeight) +
  (Quality_Score × qualityWeight) +
  (Features_Score × featuresWeight) +
  (Promotion_Score × promotionWeight) +
  (CSR_Score × csrWeight) +
  (Training_Score × trainingWeight)
```

### Market Share Allocation
```
Team_Market_Share = Team_Attractiveness / Sum_All_Attractiveness
Demand_Share = Team_Market_Share × Regional_Demand
Units_Sold = min(Demand_Share, Production_Capacity)
```

### Demand Redistribution
```javascript
demandRedistribution: {
  qualityShrinkageEnabled: true,
  minAttractivenessForFallback: 30,  // Below this, demand shrinks
}
```

**Logic:** If a team can't fulfill demand, unmet units are redistributed to competitors based on their attractiveness. If all competitors have low attractiveness (<30), some demand is lost (quality shrinkage).

## Human Resources System

### Workforce Parameters
```javascript
hr: {
  mandaysPerWorker: 1500,
  baseEfficiency: 1.0,
  trainingEfficiencyBoost: 0.10,  // 10% boost with training
  adminStaffFloor: 10,
  adminOverheadPercent: 0.20,  // 20% overhead staff
  inventoryHoldingCostPercent: 0.01,  // 1% annual holding cost
}
```

### Minimum Wages
```javascript
minWageByRegion: {
  us: 4000,    // $4,000/month
  asia: 1500,  // $1,500/month
}
```

### Training Costs
```javascript
trainingCostPerStaff: {
  basic: 0,
  standard: 2000,    // $2,000 per employee
  advanced: 5000,    // $5,000 per employee
}

trainingCostMultiplierByRegion: {
  us: 1.0,    // Full price
  asia: 0.6,  // 40% discount
}
```

### Research Hours Calculation
```
Production_Workers = total_employees × (1 - adminOverheadPercent)
Research_Hours = Production_Workers × mandaysPerWorker × efficiency_multiplier
```

Where:
```
efficiency_multiplier = baseEfficiency + (trainingEfficiencyBoost if trained)
```

## Research & Development System

### Feature Research Hours (Cumulative)
```javascript
featureResearchHours: {
  1: 20_000,       // Wi-Fi 6
  2: 48_000,       // Fast Charge
  3: 80_000,       // Secure Enclave
  4: 120_000,      // Spatial Audio
  5: 168_000,      // Multi-Device Sync
  6: 224_000,      // On-Device AI
  7: 288_000,      // Computational Camera
  8: 360_000,      // Adaptive Display
  9: 440_000,      // Precision GPS
  10: 528_000,     // Thermal Control
  11: 640_000,     // Biometric Lock
  12: 780_000,     // Cloud Backup
  13: 940_000,     // Modular Design
  14: 1_140_000,   // Smart Assist
  15: 1_380_000,   // Nano-Coating
  16: 1_660_000,   // Ultra-Wideband
  17: 2_000_000,   // All-Day Battery+
  18: 2_420_000,   // Self-Diagnostics
  19: 2_920_000,   // Chipset Gen-X
  20: 3_520_000,   // Quantum-Ready
}
```

**Note:** Hours are cumulative. To unlock Feature 2, you need 48,000 total hours (not an additional 48,000).

### Feature Catalog (Electronics Industry)
```javascript
featureCatalog: [
  { id: 1, emoji: '📶', name: 'Wi-Fi 6' },
  { id: 2, emoji: '🔋', name: 'Fast Charge' },
  { id: 3, emoji: '🔐', name: 'Secure Enclave' },
  // ... (20 total features)
]
```

## Logistics & Tariffs

### Base Tariff Costs
```javascript
logisticsTariff: {
  usToUs: 0,       // No tariff for domestic US
  usToAsia: 10,    // $10/unit US → Asia
  usToEurope: 7,   // $7/unit US → Europe
  asiaToUs: 10,    // $10/unit Asia → US
  asiaToAsia: 0,   // No tariff for domestic Asia
  asiaToEurope: 9, // $9/unit Asia → Europe
}
```

**Note:** Tariffs can be modified by scenario conditions (e.g., trade wars).

## Investment & Capital Expenditure

### Factory Investment
```javascript
investment: {
  lagRounds: 1,           // 1 round construction delay
  plantCostUS: 30_000_000,    // $30M for US plant
  plantCostAsia: 18_000_000,  // $18M for Asia plant
}
```

**Scenario Modifier:**
```javascript
investmentCostMultiplier: 1.0  // Can vary by scenario (e.g., 1.25 in boom times)
```

## Financial System

### Taxation
```javascript
financial: {
  taxRate: 0.25,  // Legacy global rate (not used)
  taxRateByRegion: {
    us: 0.20,      // 20% US corporate tax
    asia: 0.15,    // 15% Asia corporate tax
    europe: 0.25,  // 25% Europe corporate tax
  },
  maxEffectiveTaxRate: 0.60,  // Cap blended rate at 60%
}
```

**Effective Tax Rate Calculation:**
```
Effective_Tax_Rate = weighted average based on regional profits
```

### Interest Rates
```javascript
interestRate: 0.05,  // 5% base long-term rate
shortTermInterestMultiplier: 2.0,  // Short-term = 10%
```

**Scenario Modifier:**
```javascript
interestRateSpread: 0.0  // Added to base rate (can be +/- by scenario)
```

### Depreciation
```javascript
depreciationRate: 0.05  // 5% annual depreciation on fixed assets
```

### Working Capital Ratios
```javascript
inventoryPercent: 0.10,    // Inventory = 10% of COGS
receivablePercent: 0.10,   // A/R = 10% of revenue
payablePercent: 0.10,      // A/P = 10% of COGS
```

**Scenario Modifiers:**
```javascript
workingCapitalDelta: {
  inventory: 0.0,    // Adjustment to inventory %
  receivable: 0.0,   // Adjustment to A/R %
  payable: 0.0,      // Adjustment to A/P %
}
```

### Starting Balance Sheet
```javascript
financial: {
  startingCash: 15_000_000,       // $15M cash
  startingDebt: 20_000_000,       // $20M long-term debt
  startingShareCapital: 60_000_000,  // $60M equity
  startingInventoryUnits: 0,      // No starting inventory
  minCashReserve: 2_000_000,      // $2M minimum cash
}
```

### Share Valuation System

**Base Valuation:**
```javascript
basePERatio: 15  // Price-to-Earnings ratio
```

**Growth Premium Weights:**
```javascript
growthPremiumWeights: {
  capacity: 0.10,   // 10% weight to capacity growth
  share: 0.10,      // 10% weight to market share growth
  brand: 0.08,      // 8% weight to brand reputation
  cash: 0.04,       // 4% weight to cash strength
}
```

**Premium Bounds:**
```javascript
growthPremiumCap: {
  down: -0.20,  // Max 20% discount
  up: 0.35      // Max 35% premium
}
```

**Price Smoothing:**
```javascript
sharePriceSmoothingPrevWeight: 0.45  // 45% previous, 55% new
```

**Formula:**
```
EPS = Net_Profit / Total_Shares
Base_Price = EPS × basePERatio

Growth_Premium =
  (capacity_growth × 0.10) +
  (market_share_growth × 0.10) +
  (brand_strength × 0.08) +
  (cash_strength × 0.04)

Capped_Premium = clamp(Growth_Premium, -0.20, 0.35)
New_Price = Base_Price × (1 + Capped_Premium)
Final_Price = (Previous_Price × 0.45) + (New_Price × 0.55)
```

### Debt Management

**Debt Limits:**
```javascript
maxDebtToAssetRatio: 0.40  // Cannot exceed 40% debt/assets
```

**Debt Penalty Thresholds:**
```javascript
debtPenaltyThresholds: {
  safe: 0.20,      // <20%: No penalty
  warning: 0.40,   // 20-40%: Mild penalty
  danger: 0.60,    // >60%: Severe penalty
}
```

### Equity Management

**Share Issuance:**
```javascript
maxShareDilutionPerRound: 0.10  // Max 10% dilution per round
```

**Share Buyback:**
```javascript
maxBuybackPerRound: 0.05  // Max 5% buyback per round
```

**Dividends:**
```javascript
maxDividendPayoutRatio: 0.50  // Max 50% of profit as dividends
```

### Ratio Caps (Anti-Exploit)
```javascript
maxROE: 500,    // Cap Return on Equity at ±500%
minROCE: -500,  // Floor Return on Capital Employed
maxROCE: 500,   // Cap ROCE at 500%
```

## Default Starting Decisions

### Production Defaults
```javascript
defaults: {
  production: {
    allocationPct: 80,           // 80% capacity utilization
    supplierUS: 1,               // Budget supplier
    supplierAsia: 1,             // Budget supplier
    outsourceSupplier: 2,        // Standard supplier for outsourcing
    overtimePct: 0,              // No overtime
    overtimeLaborPremiumPct: 50, // 50% premium for overtime
  }
}
```

### HR Defaults
```javascript
defaults: {
  hr: {
    us: {
      employees: 50,
      wage: 5000,     // $5,000/month
      training: 0     // Basic training
    },
    asia: {
      employees: 0,
      wage: 0,
      training: 0
    }
  }
}
```

### R&D Defaults
```javascript
defaults: {
  rnd: {
    trainingLevel: 'basic'  // No training cost
  }
}
```

### Marketing Defaults
```javascript
defaults: {
  marketing: {
    promotionPctByRegion: {
      us: 5,      // 5% of revenue on promotion
      asia: 5,
      europe: 5
    },
    featuresUsed: 0  // No features unlocked yet
  }
}
```

### Logistics Defaults
```javascript
defaults: {
  logistics: {
    usPriority: ['us', 'europe', 'asia'],     // US production priority
    asiaPriority: ['asia', 'europe', 'us'],   // Asia production priority
    allocation: {
      us: { local: 100, fromAsia: 0 },        // 100% from US plants
      asia: { local: 100, fromUS: 0 },        // 100% from Asia plants
      europe: { fromUS: 50, fromAsia: 50 },   // 50/50 split for Europe
    }
  }
}
```

### Finance Defaults
```javascript
defaults: {
  finance: {
    transferPricing: {
      us: 1.0,      // No markup
      asia: 1.0,
      europe: 1.0
    }
  }
}
```

---

# Scenario System

Scenarios modify base parameters to simulate different economic conditions, market disruptions, and regulatory changes.

## Scenario Structure

Each scenario includes:
- **Name & Description:** What's happening in the economy
- **Economic Brief:** GDP, inflation, rates, PMI, currency
- **Hints:** Strategic guidance for students
- **Parameter Modifiers:** Adjustments to base game config

## Sample Scenarios

### Scenario 1: Baseline (Normal Economy)

**Description:** Stable economic conditions with moderate growth.

**Economic Indicators:**
- GDP Growth: 2-3%
- Inflation: ~2%
- Interest Rates: Normal
- PMI: 50-55 (expansion)
- Currency: Stable

**Modifiers:**
```javascript
{
  demandModifier: { us: 1.0, asia: 1.0, europe: 1.0 },
  priceElasticityModifier: 1.0,
  csrImportanceModifier: 1.0,
  marketingEffectModifier: 1.0,
  costInflation: 1.0,
  investmentCostMultiplier: 1.0,
  interestRateSpread: 0.0,
  taxRateDeltaByRegion: { us: 0, asia: 0, europe: 0 },
  workingCapitalDelta: { inventory: 0, receivable: 0, payable: 0 }
}
```

**Teaching Point:** *This is the baseline for comparison. All other scenarios deviate from this.*

---

### Scenario 3: Recession (Economic Downturn)

**Description:** Global recession with falling demand and credit tightening.

**Economic Indicators:**
- GDP Growth: -2%
- Inflation: Low (~1%)
- Interest Rates: Low but lending tight
- PMI: <45 (contraction)
- Currency: Flight to safety (USD strengthens)

**Modifiers:**
```javascript
{
  demandModifier: { us: 0.75, asia: 0.70, europe: 0.72 },  // 25-30% demand drop
  priceElasticityModifier: 1.3,        // Customers more price-sensitive
  csrImportanceModifier: 0.7,          // CSR less important in hard times
  marketingEffectModifier: 0.8,        // Marketing less effective
  costInflation: 0.95,                 // Deflation in inputs
  investmentCostMultiplier: 0.9,       // Assets cheaper in recession
  interestRateSpread: 0.02,            // +2% credit risk premium
  taxRateDeltaByRegion: { us: 0, asia: 0, europe: 0 },
  workingCapitalDelta: {
    inventory: 0.02,      // Inventory piles up (+2%)
    receivable: 0.03,     // Customers pay slower (+3%)
    payable: -0.01        // Suppliers demand faster payment (-1%)
  }
}
```

**Strategic Implications:**
- Cash conservation critical
- Price competition intensifies
- Working capital management becomes crucial
- Delay expansion projects

**Teaching Point:** *Recessions test financial resilience. Companies must balance cost-cutting with maintaining competitive position for recovery.*

---

### Scenario 7: Trade War (US-Asia Tariffs)

**Description:** Escalating trade tensions lead to retaliatory tariffs.

**Economic Indicators:**
- GDP Growth: Slowing (1.5%)
- Inflation: Rising (3%)
- Interest Rates: Stable
- PMI: 48-52 (uncertain)
- Currency: Volatile

**Modifiers:**
```javascript
{
  demandModifier: { us: 0.95, asia: 0.92, europe: 1.0 },  // Slight demand drop
  priceElasticityModifier: 1.0,
  csrImportanceModifier: 1.0,
  marketingEffectModifier: 1.0,
  costInflation: 1.08,                 // 8% cost inflation
  investmentCostMultiplier: 1.15,      // Investment more expensive
  interestRateSpread: 0.01,
  taxRateDeltaByRegion: { us: 0, asia: 0, europe: 0 },
  workingCapitalDelta: { inventory: 0, receivable: 0, payable: 0 },

  // Key modifier: Tariff adjustments
  logisticsTariff: {
    usToAsia: 25,      // Was 10, now 25 (+150%)
    asiaToUs: 25,      // Was 10, now 25 (+150%)
    usToEurope: 7,     // Unchanged
    asiaToEurope: 12,  // Slight increase
  }
}
```

**Strategic Implications:**
- Cross-border shipping becomes very expensive
- Pressure to localize production
- Supply chain reconfiguration needed
- Consider building factories in target markets

**Teaching Point:** *Geopolitical risk is real. Companies must evaluate supply chain resilience vs. cost efficiency.*

---

### Scenario 12: Green Revolution (ESG Focus)

**Description:** Regulatory and consumer pressure for environmental responsibility.

**Economic Indicators:**
- GDP Growth: Moderate (2.5%)
- Inflation: Moderate (2.5%)
- Interest Rates: Normal
- PMI: 52 (expansion)
- Currency: Stable

**Modifiers:**
```javascript
{
  demandModifier: { us: 1.0, asia: 1.0, europe: 1.1 },  // Europe demands green products
  priceElasticityModifier: 0.9,        // Customers less price-sensitive for green products
  csrImportanceModifier: 1.8,          // CSR 80% more important
  marketingEffectModifier: 1.0,
  costInflation: 1.05,                 // Eco-friendly inputs cost more
  investmentCostMultiplier: 1.1,       // Green tech more expensive
  interestRateSpread: -0.005,          // "Green bonds" available at lower rates
  taxRateDeltaByRegion: {
    us: -0.02,      // -2% tax break for green companies
    asia: 0,
    europe: -0.03   // -3% tax break in Europe
  },
  workingCapitalDelta: { inventory: 0, receivable: 0, payable: 0 }
}
```

**Strategic Implications:**
- Invest in eco-friendly suppliers (Supplier 3)
- Europe market rewards CSR heavily
- Tax incentives offset higher costs
- Brand differentiation opportunity

**Teaching Point:** *ESG (Environmental, Social, Governance) factors increasingly drive both regulation and consumer preferences. Companies must balance sustainability with profitability.*

---

## How Scenarios Are Applied

### Demand Calculation
```
Regional_Demand = Base_Demand × demandModifier[region]
```

### Price Elasticity
```
Effective_Elasticity = Base_Elasticity × priceElasticityModifier
```

### CSR Weight Adjustment
```
Effective_CSR_Weight = Base_CSR_Weight × csrImportanceModifier
```

### Cost Inflation
```
Inflated_Cost = Base_Unit_Cost × costInflation
```

### Tax Rate Adjustment
```
Effective_Tax_Rate = Base_Tax_Rate + taxRateDeltaByRegion[region]
```

### Working Capital
```
Inventory_Ratio = (inventoryPercent + workingCapitalDelta.inventory)
Receivable_Ratio = (receivablePercent + workingCapitalDelta.receivable)
Payable_Ratio = (payablePercent + workingCapitalDelta.payable)
```

---

## Appendix: Parameter Quick Reference

### Production
- **Capacity/Plant:** 325,000 units
- **Plant Cost (US):** $30M
- **Plant Cost (Asia):** $18M
- **Outsource Max:** 200K per region
- **Outsource Premium:** 30%

### Costs
- **Material (US):** $22/unit
- **Material (Asia):** $18/unit
- **Labor (US):** $14/unit
- **Labor (Asia):** $7/unit

### Workforce
- **Mandays/Worker:** 1,500
- **Min Wage (US):** $4,000
- **Min Wage (Asia):** $1,500
- **Training Boost:** +10%

### Markets
- **US:** 22%, elasticity 0.6, baseline $125
- **Asia:** 60%, elasticity 1.0, baseline $115
- **Europe:** 18%, elasticity 0.8, baseline $130

### Finance
- **Starting Cash:** $15M
- **Starting Debt:** $20M
- **Starting Equity:** $60M
- **Interest Rate:** 5% (long-term)
- **Tax Rates:** US 20%, Asia 15%, Europe 25%

### Features
- **Feature 1:** 20K hours
- **Feature 5:** 168K hours
- **Feature 10:** 528K hours
- **Feature 15:** 1.38M hours
- **Feature 20:** 3.52M hours

---

## Document History

- **v1.0 (Feb 2026):** Initial comprehensive reference

---

**For questions or clarifications, contact the simulation administrator.**
