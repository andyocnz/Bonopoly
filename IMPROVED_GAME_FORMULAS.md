# 🎯 IMPROVED GAME FORMULAS & LOGIC - BONOPOLY 2026

**VERSION**: 1.0
**CREATED**: 2024-12-13
**STATUS**: Design Specification - Ready for Implementation
**PURPOSE**: Define all configurable, non-hardcoded formulas for realistic business simulation

---

## 📋 TABLE OF CONTENTS

1. [Design Philosophy](#design-philosophy)
2. [Improved Cost Equation System](#improved-cost-equation-system)
3. [Improved Market Demand System](#improved-market-demand-system)
4. [Improved Market Share Competition](#improved-market-share-competition)
5. [Improved Scenario System](#improved-scenario-system)
6. [Additional Critical Formulas](#additional-critical-formulas)
7. [Database Schema Changes](#database-schema-changes)
8. [Implementation Checklist](#implementation-checklist)

---

## 1. DESIGN PHILOSOPHY

### Core Principles

✅ **NO HARDCODED FORMULAS** - All parameters must be configurable in database
✅ **ECONOMICALLY REALISTIC** - Based on actual business operations, not arbitrary math
✅ **EDUCATIONALLY SOUND** - Students should understand WHY formulas work this way
✅ **TRANSPARENT** - Show breakdown of calculations to students
✅ **BALANCED** - No "always optimal" strategy should exist

### Problems with Original System

❌ **Cost equation**: Opaque formula (a×capacity^6 + c×capacity + d) with unclear economic meaning
❌ **Market demand**: Tied to team capacity (demand = supply, circular logic)
❌ **Market share**: Black-box calculation, unclear how competition works
❌ **Scenarios**: All parameters change uniformly (+10% or -10% everything)
❌ **Hardcoded weights**: Magic numbers scattered throughout PHP code

---

## 2. IMPROVED COST EQUATION SYSTEM

### 2.1 Economic Foundation

Real manufacturing costs have **two distinct components**:

1. **Fixed Costs**: Plant depreciation, admin costs, minimum staff (independent of volume)
2. **Variable Costs**: Materials, labor, energy (proportional to units produced)
3. **Efficiency Factor**: Utilization rate affects per-unit efficiency

### 2.2 New Cost Structure (Option 2 - Recommended)

```typescript
interface CostCalculationInputs {
  // EXISTING PARAMETERS (no new DB fields needed!)
  unitCostMaterial: number;        // From market params position 2
  unitCostLabour: number;          // From market params position 7
  unitCostSupplier: number;        // From market params positions 3-6
  fixedAdminCost: number;          // From market params position 21
  variableAdminCost: number;       // From market params position 22
  depreciationRate: number;        // From game.depreciation_rate
  assetValue: number;              // From team decisions

  // NEW PARAMETERS (need to add to database)
  plantMaintenanceCost: number;    // NEW - per plant per round
  plantMaxCapacity: number;        // NEW - units per plant
  plantFixedLaborCost: number;     // NEW - minimum staff cost
  technologyEfficiencyMultiplier: {
    tech1: { fixed: 1.0, variable: 1.2 },   // Tech 1: low fixed, high variable
    tech2: { fixed: 1.1, variable: 1.0 },
    tech3: { fixed: 1.3, variable: 0.85 },
    tech4: { fixed: 1.6, variable: 0.65 }   // Tech 4: high fixed, low variable
  };

  // UTILIZATION EFFICIENCY CURVE PARAMETERS (replaces a,b,c,d)
  utilizationCurveParams: {
    optimalUtilization: 0.80,      // 80% is most efficient
    underutilizationPenalty: 0.40, // Penalty coefficient for < optimal
    overutilizationPenalty: 1.50   // Penalty coefficient for > optimal
  };
}

interface CostBreakdown {
  // Direct Variable Costs
  directMaterialCost: number;
  directLabourCost: number;
  supplierCost: number;

  // Manufacturing Overhead
  variableOverhead: number;

  // Fixed Operating Costs
  fixedAdminCost: number;
  plantDepreciation: number;
  plantMaintenance: number;
  fixedLabor: number;

  // Efficiency Adjustments
  utilizationRate: number;
  efficiencyMultiplier: number;

  // Totals
  totalVariableCost: number;
  totalFixedCost: number;
  totalCost: number;
  unitCost: number;
}

function calculateProductionCost(
  decision: ProductionDecision,
  inputs: CostCalculationInputs
): CostBreakdown {

  // 1. CALCULATE BASE VARIABLE COSTS (per unit)
  const baseVariableCostPerUnit =
    inputs.unitCostMaterial +
    inputs.unitCostLabour +
    inputs.unitCostSupplier;

  // 2. CALCULATE FIXED COSTS (per round)
  const plantCount = decision.numberOfPlants;
  const fixedCostsPerRound =
    inputs.fixedAdminCost +
    (inputs.depreciationRate * inputs.assetValue) +
    (inputs.plantMaintenanceCost * plantCount) +
    (inputs.plantFixedLaborCost * plantCount);

  // 3. CALCULATE UTILIZATION RATE
  const totalCapacity = inputs.plantMaxCapacity * plantCount;
  const utilizationRate = decision.unitsProduced / totalCapacity;

  // 4. CALCULATE EFFICIENCY MULTIPLIER
  // U-shaped curve: penalty for both under AND over utilization
  const { optimalUtilization, underutilizationPenalty, overutilizationPenalty } =
    inputs.utilizationCurveParams;

  let efficiencyMultiplier = 1.0;

  if (utilizationRate < optimalUtilization) {
    // Underutilization: Fixed costs spread over fewer units
    const utilizationGap = optimalUtilization - utilizationRate;
    efficiencyMultiplier = 1.0 + (utilizationGap * underutilizationPenalty);
  }
  else if (utilizationRate > optimalUtilization) {
    // Overutilization: Overtime, rushed work, quality issues
    const overageAmount = utilizationRate - optimalUtilization;
    efficiencyMultiplier = 1.0 + (Math.pow(overageAmount, 2) * overutilizationPenalty);
  }

  // 5. APPLY TECHNOLOGY EFFICIENCY
  const techMultiplier = inputs.technologyEfficiencyMultiplier[decision.technology];

  // 6. CALCULATE TOTAL COSTS
  const directMaterialCost = inputs.unitCostMaterial * decision.unitsProduced;
  const directLabourCost = inputs.unitCostLabour * decision.unitsProduced;
  const supplierCost = inputs.unitCostSupplier * decision.unitsProduced;

  const variableOverhead =
    inputs.variableAdminCost * decision.unitsProduced * techMultiplier.variable;

  const totalVariableCost =
    (directMaterialCost + directLabourCost + supplierCost + variableOverhead) *
    efficiencyMultiplier;

  const totalFixedCost = fixedCostsPerRound * techMultiplier.fixed;

  const totalCost = totalVariableCost + totalFixedCost;
  const unitCost = totalCost / decision.unitsProduced;

  return {
    directMaterialCost,
    directLabourCost,
    supplierCost,
    variableOverhead,
    fixedAdminCost: inputs.fixedAdminCost,
    plantDepreciation: inputs.depreciationRate * inputs.assetValue,
    plantMaintenance: inputs.plantMaintenanceCost * plantCount,
    fixedLabor: inputs.plantFixedLaborCost * plantCount,
    utilizationRate,
    efficiencyMultiplier,
    totalVariableCost,
    totalFixedCost,
    totalCost,
    unitCost
  };
}
```

### 2.3 New Parameters Required

Add to database:

```sql
-- Add to game table (game-wide defaults)
ALTER TABLE game ADD COLUMN plant_maintenance_cost_per_round INT NOT NULL DEFAULT 200000;
ALTER TABLE game ADD COLUMN plant_max_capacity INT NOT NULL DEFAULT 600;
ALTER TABLE game ADD COLUMN plant_fixed_labor_cost INT NOT NULL DEFAULT 150000;

-- Replace cost_equation (a,b,c,d) with new utilization curve params
ALTER TABLE game ADD COLUMN utilization_optimal DECIMAL(3,2) NOT NULL DEFAULT 0.80;
ALTER TABLE game ADD COLUMN utilization_under_penalty DECIMAL(3,2) NOT NULL DEFAULT 0.40;
ALTER TABLE game ADD COLUMN utilization_over_penalty DECIMAL(3,2) NOT NULL DEFAULT 1.50;

-- Technology efficiency multipliers (stored as JSON or separate table)
ALTER TABLE game ADD COLUMN tech_efficiency_config TEXT; -- JSON format
```

### 2.4 Default Values (Recommended)

```json
{
  "plantMaintenanceCost": 200000,
  "plantMaxCapacity": 600,
  "plantFixedLaborCost": 150000,
  "utilizationCurve": {
    "optimal": 0.80,
    "underPenalty": 0.40,
    "overPenalty": 1.50
  },
  "techEfficiency": {
    "tech1": { "fixed": 1.0, "variable": 1.2 },
    "tech2": { "fixed": 1.1, "variable": 1.0 },
    "tech3": { "fixed": 1.3, "variable": 0.85 },
    "tech4": { "fixed": 1.6, "variable": 0.65 }
  }
}
```

### 2.5 Behavior Comparison

| Utilization | Old Formula (b=6) | New Formula | Interpretation |
|-------------|------------------|-------------|----------------|
| 40% | 1.16× | 1.16× | Underutilized - spreading fixed costs |
| 60% | 1.04× | 1.08× | Below optimal but reasonable |
| 80% | 1.16× | 1.00× | **Optimal efficiency point** |
| 100% | 1.64× | 1.06× | Overtime penalty, but manageable |
| 120% | N/A | 1.24× | Severe penalty - quality issues |

### 2.6 Educational Display (Show Students)

```
╔══════════════════════════════════════════════════════╗
║         PRODUCTION COST BREAKDOWN - ROUND 3          ║
╠══════════════════════════════════════════════════════╣
║ Units Produced: 480 / 600 capacity (80% utilization) ║
║ Technology: Tech 2 (Standard Manufacturing)          ║
╠══════════════════════════════════════════════════════╣
║ VARIABLE COSTS (per unit produced):                  ║
║   Direct Materials:        $45,000 × 480 = $21.6M    ║
║   Direct Labour:           $28,000 × 480 = $13.4M    ║
║   Supplier Components:     $12,000 × 480 = $5.8M     ║
║   Variable Overhead:       $8,000 × 480 = $3.8M      ║
║   ─────────────────────────────────────────────      ║
║   Subtotal Variable:                   $44.6M        ║
╠══════════════════════════════════════════════════════╣
║ FIXED COSTS (per round):                             ║
║   Plant Depreciation:                  $2.5M         ║
║   Plant Maintenance:                   $0.4M         ║
║   Fixed Admin Costs:                   $1.8M         ║
║   Fixed Labor (min staff):             $0.3M         ║
║   ─────────────────────────────────────────────      ║
║   Subtotal Fixed:                      $5.0M         ║
╠══════════════════════════════════════════════════════╣
║ EFFICIENCY ADJUSTMENT:                                ║
║   Utilization Rate: 80% (OPTIMAL! ✓)                 ║
║   Efficiency Multiplier: 1.00× (no penalty)          ║
╠══════════════════════════════════════════════════════╣
║ TOTAL PRODUCTION COST:          $49.6M               ║
║ COST PER UNIT:                  $103,333             ║
╚══════════════════════════════════════════════════════╝
```

---

## 3. IMPROVED MARKET DEMAND SYSTEM

### 3.1 Problem with Original System

```php
// WRONG: Demand depends on supply!
$totalDemand = $numberOfTeams × ($capacityPerPlant × $allocation × $factories) × (1 - $inventory%)
```

**Issues:**
- More teams = more demand (makes no sense!)
- Build more factories = demand increases (unrealistic!)
- No relationship to actual market size, GDP, population

### 3.2 New Market Demand System (Fixed Base)

```typescript
interface MarketDemandConfig {
  marketId: string;              // 'us', 'asia', 'europe'
  baseMarketSize: number;        // Fixed initial size (units per round)
  annualGrowthRate: number;      // Compound growth rate per year
  volatilityFactor: number;      // How much scenarios affect this market
  consumerProfile: {
    incomeLevel: 'high' | 'medium' | 'low';
    priceElasticity: number;     // How sensitive to price (0.5 - 2.0)
    qualityPreference: number;   // How much they value features (0.5 - 2.0)
  };
}

const MARKET_DEFINITIONS: Record<string, MarketDemandConfig> = {
  us: {
    marketId: 'us',
    baseMarketSize: 1500,        // 1,500 units per round
    annualGrowthRate: 0.03,      // 3% annual growth (mature market)
    volatilityFactor: 0.15,      // ±15% scenario impact
    consumerProfile: {
      incomeLevel: 'high',
      priceElasticity: 0.8,      // Less price-sensitive
      qualityPreference: 1.4     // Strongly prefer quality
    }
  },
  asia: {
    marketId: 'asia',
    baseMarketSize: 4000,        // 4,000 units per round (larger market)
    annualGrowthRate: 0.08,      // 8% annual growth (emerging market)
    volatilityFactor: 0.25,      // ±25% scenario impact (more volatile)
    consumerProfile: {
      incomeLevel: 'medium',
      priceElasticity: 1.5,      // Very price-sensitive
      qualityPreference: 0.9     // Price > Quality
    }
  },
  europe: {
    marketId: 'europe',
    baseMarketSize: 1200,        // 1,200 units per round
    annualGrowthRate: 0.02,      // 2% annual growth (mature market)
    volatilityFactor: 0.10,      // ±10% scenario impact (stable)
    consumerProfile: {
      incomeLevel: 'high',
      priceElasticity: 1.0,      // Moderate price sensitivity
      qualityPreference: 1.2     // Value quality but also practical
    }
  }
};

function calculateMarketDemand(
  market: MarketDemandConfig,
  currentRound: number,
  scenario: Scenario
): number {

  // 1. Apply natural market growth (compound over rounds)
  const roundsPerYear = 12; // Assuming monthly rounds
  const yearsElapsed = currentRound / roundsPerYear;
  const growthMultiplier = Math.pow(1 + market.annualGrowthRate, yearsElapsed);

  // 2. Apply scenario impact (from scenario definition)
  const scenarioImpact = 1 + (scenario.effects.demandChange / 100);

  // 3. Apply market-specific volatility
  const volatilityAdjustedImpact = 1 + (
    (scenario.effects.demandChange / 100) * market.volatilityFactor
  );

  // 4. Calculate final demand
  const demand = Math.round(
    market.baseMarketSize *
    growthMultiplier *
    volatilityAdjustedImpact
  );

  return demand;
}
```

### 3.3 New Parameters Required

```sql
-- Add to market_params table (or create new market_config table)
CREATE TABLE market_config (
  id INT PRIMARY KEY AUTO_INCREMENT,
  game_id INT NOT NULL,
  market_id VARCHAR(20) NOT NULL,  -- 'us', 'asia', 'europe'
  base_market_size INT NOT NULL,
  annual_growth_rate DECIMAL(4,3) NOT NULL,
  volatility_factor DECIMAL(3,2) NOT NULL,
  income_level ENUM('low','medium','high') NOT NULL,
  price_elasticity DECIMAL(3,2) NOT NULL,
  quality_preference DECIMAL(3,2) NOT NULL,
  FOREIGN KEY (game_id) REFERENCES game(id),
  UNIQUE KEY (game_id, market_id)
);

-- Default values
INSERT INTO market_config (game_id, market_id, base_market_size, annual_growth_rate, volatility_factor, income_level, price_elasticity, quality_preference)
VALUES
  (?, 'us', 1500, 0.030, 0.15, 'high', 0.80, 1.40),
  (?, 'asia', 4000, 0.080, 0.25, 'medium', 1.50, 0.90),
  (?, 'europe', 1200, 0.020, 0.10, 'high', 1.00, 1.20);
```

### 3.4 Comparison: Old vs New

**Example: 3 teams, Round 1**

```
OLD SYSTEM:
Total demand = 3 teams × (600 capacity × 2 plants) × 0.95 = 3,420 units
  US (33%): 1,129 units
  Asia (42%): 1,436 units
  Europe (25%): 855 units
Problem: Add 2 more teams → demand jumps to 5,700 units!

NEW SYSTEM:
Total demand = Fixed at 6,700 units (independent of teams!)
  US: 1,500 units
  Asia: 4,000 units
  Europe: 1,200 units
Result: Adding teams increases COMPETITION, not market size (realistic!)
```

---

## 4. IMPROVED MARKET SHARE COMPETITION

### 4.1 Attractiveness Score Calculation

```typescript
interface TeamOffering {
  price: number;
  technology: {
    level: 1 | 2 | 3 | 4;
    attractiveness: number;  // From tech_att parameter
  };
  features: number;          // Number of features (0-20)
  promotion: number;         // Promotion spend %
  supplier: {
    id: number;
    csrRating: number;      // 1-10 CSR score
  };
  brandReputation: number;   // Accumulated over rounds (0-100)
}

interface MarketShareResult {
  teamId: number;
  attractivenessScore: number;
  idealDemandShare: number;    // What they'd get with unlimited capacity
  actualSales: number;         // Capped by production capacity
  unmetDemand: number;         // Demand they couldn't fulfill
  marketSharePercent: number;
  lostToCompetitors: number;   // Demand redistributed to others
}

function calculateMarketShare(
  teams: TeamOffering[],
  marketDemand: number,
  marketConfig: MarketDemandConfig,
  scenario: Scenario
): MarketShareResult[] {

  // STEP 1: Calculate attractiveness score for each team
  const teamScores = teams.map(team => {

    // Quality Score (0-100)
    const featureScore = Math.min(100, team.features * 5); // Max 20 features
    const techScore = team.technology.attractiveness * 20;  // Tech att usually 1-5
    const qualityScore = (featureScore * 0.4) + (techScore * 0.6);

    // Price Competitiveness Score (relative to market average)
    const avgPrice = teams.reduce((sum, t) => sum + t.price, 0) / teams.length;
    const priceScore = (avgPrice / team.price) * 100; // Lower price = higher score

    // Promotion Bonus (multiplicative)
    const promotionMultiplier = 1 + (team.promotion / 100);

    // CSR Bonus (scenario-dependent)
    const csrBonus = team.supplier.csrRating >= 8 ? 1.15 :
                     team.supplier.csrRating >= 5 ? 1.0 : 0.95;

    // Brand Reputation (accumulated competitive advantage)
    const brandBonus = 1 + (team.brandReputation / 200); // Max 50% bonus

    // WEIGHTED ATTRACTIVENESS (scenario & market dependent)
    const qualityWeight = marketConfig.consumerProfile.qualityPreference *
                          scenario.effects.consumerPreferences.qualityWeight;

    const priceWeight = marketConfig.consumerProfile.priceElasticity *
                        scenario.effects.consumerPreferences.priceWeight;

    const attractiveness =
      (qualityScore * qualityWeight) +
      (priceScore * priceWeight) *
      promotionMultiplier *
      csrBonus *
      brandBonus;

    return {
      teamId: team.id,
      attractiveness,
      maxCapacity: team.productionCapacity,
      qualityScore,
      priceScore,
      details: {
        qualityWeight,
        priceWeight,
        promotionMultiplier,
        csrBonus,
        brandBonus
      }
    };
  });

  // STEP 2: Distribute demand proportionally to attractiveness
  const totalAttractiveness = teamScores.reduce((sum, t) => sum + t.attractiveness, 0);

  const initialDistribution = teamScores.map(team => {
    const idealShare = (team.attractiveness / totalAttractiveness) * marketDemand;
    const actualSales = Math.min(idealShare, team.maxCapacity);
    const unmetDemand = idealShare - actualSales;

    return {
      teamId: team.teamId,
      attractivenessScore: team.attractiveness,
      idealDemandShare: idealShare,
      actualSales,
      unmetDemand,
      marketSharePercent: (actualSales / marketDemand) * 100,
      lostToCompetitors: 0,
      details: team.details
    };
  });

  // STEP 3: Redistribute unmet demand (customers go to next best alternative)
  const totalUnmetDemand = initialDistribution.reduce((sum, d) => sum + d.unmetDemand, 0);

  if (totalUnmetDemand > 0) {
    // Find teams with spare capacity
    const teamsWithCapacity = initialDistribution.filter(
      d => d.actualSales < d.maxCapacity
    );

    if (teamsWithCapacity.length > 0) {
      // Redistribute proportionally to their attractiveness
      const redistributableAttractiveness = teamsWithCapacity.reduce(
        (sum, t) => sum + t.attractivenessScore, 0
      );

      teamsWithCapacity.forEach(team => {
        const redistributedDemand =
          (team.attractivenessScore / redistributableAttractiveness) * totalUnmetDemand;

        const canAcceptAdditional = team.maxCapacity - team.actualSales;
        const additionalSales = Math.min(redistributedDemand, canAcceptAdditional);

        team.actualSales += additionalSales;
        team.marketSharePercent = (team.actualSales / marketDemand) * 100;
      });
    }
  }

  // STEP 4: Calculate lost sales due to competitors
  initialDistribution.forEach(team => {
    team.lostToCompetitors = team.unmetDemand -
      (team.idealDemandShare - team.actualSales);
  });

  return initialDistribution;
}
```

### 4.2 New Parameters Required

```sql
-- Add to team table (brand reputation accumulates over rounds)
ALTER TABLE team ADD COLUMN brand_reputation INT NOT NULL DEFAULT 50;

-- Update brand reputation each round based on performance
-- High quality + good CSR + market share → brand grows
-- Low quality + bad CSR + losing share → brand declines
```

### 4.3 Educational Display

```
╔════════════════════════════════════════════════════════════════╗
║           MARKET SHARE ANALYSIS - US MARKET - ROUND 3          ║
╠════════════════════════════════════════════════════════════════╣
║ Total Market Demand: 1,620 units (↑8% from last round)         ║
║ Consumer Preferences: Quality-focused (Boom scenario)          ║
╠════════════════════════════════════════════════════════════════╣
║ YOUR TEAM (Team 2):                                            ║
║   Attractiveness Score: 87.3 / 100                             ║
║     • Quality Score: 82 (Tech 3, 12 features)                  ║
║     • Price Score: 95 (15% below average)                      ║
║     • Promotion Bonus: 1.10× (10% promotion spend)             ║
║     • CSR Bonus: 1.15× (Supplier rating 9/10)                  ║
║     • Brand Reputation: +8% (good performance)                 ║
╠════════════════════════════════════════════════════════════════╣
║ COMPETITION:                                                    ║
║   Team 1: Score 74.2 - Higher price, lower features            ║
║   Team 2: Score 87.3 - YOU (best position!)                    ║
║   Team 3: Score 81.5 - Similar quality, higher price           ║
║   Team 4: Score 69.8 - Low price, low quality                  ║
╠════════════════════════════════════════════════════════════════╣
║ MARKET SHARE RESULTS:                                          ║
║   Your Ideal Share: 28.0% (453 units)                          ║
║   Your Actual Sales: 453 units ✓ (capacity sufficient)         ║
║   Market Share Won: 28.0% (↑3.2% from last round)              ║
║                                                                 ║
║   Total Industry Sales: 1,620 / 1,620 (100% fulfilled)         ║
║   Unmet Demand: 0 units (all customers served)                 ║
╚════════════════════════════════════════════════════════════════╝
```

---

## 5. IMPROVED SCENARIO SYSTEM

### 5.1 Problem with Original System

```php
// ALL 29 parameters change by same percentage!
if ($scenario_id == 1) {
  foreach ($all_params as $param) {
    $param *= 1.10;  // Everything +10%
  }
}
```

**Issues:**
- Unrealistic: In a recession, demand falls but interest rates also fall (opposite direction!)
- No nuance: All costs move together (in reality, labor ≠ materials ≠ energy)
- No strategy: Every scenario is just "scale everything up or down"

### 5.2 New Scenario System (Realistic Economic Scenarios)

```typescript
interface ScenarioEffects {
  // Demand Impact
  demandChange: number;              // % change in market demand

  // Cost Impacts (differentiated)
  materialCostChange: number;        // % change in material costs
  labourCostChange: number;          // % change in labour costs
  energyCostChange: number;          // % change in energy/utilities

  // Financial Market Impacts
  taxRateChange: number;             // Absolute change (e.g., +3% → 25% becomes 28%)
  interestRateChange: number;        // Absolute change in interest rate
  exchangeRateVolatility: number;    // % volatility in exchange rates

  // Market Dynamics
  consumerPreferences: {
    qualityWeight: number;           // Multiplier for quality importance
    priceWeight: number;             // Multiplier for price sensitivity
  };

  // Supply Chain
  supplierReliability: number;       // 0.8-1.2 (affects lead times)
  logisticsCostChange: number;       // % change in shipping costs
}

interface Scenario {
  id: number;
  name: string;
  description: string;
  probability: number;               // Likelihood of occurring (for random selection)
  effects: ScenarioEffects;
}

const SCENARIOS: Scenario[] = [
  {
    id: 1,
    name: "Economic Boom",
    description: "Strong GDP growth, high consumer confidence, tight labor market",
    probability: 0.15,
    effects: {
      demandChange: +18,               // Strong demand
      materialCostChange: +5,          // Commodity prices rise
      labourCostChange: +12,           // Labor shortage → higher wages
      energyCostChange: +8,            // Economic activity → higher energy
      taxRateChange: 0,                // Tax stable
      interestRateChange: +2.5,        // Central bank raises rates
      exchangeRateVolatility: 0.05,    // Currency appreciates
      consumerPreferences: {
        qualityWeight: 1.3,            // Consumers want premium
        priceWeight: 0.7               // Less price-sensitive
      },
      supplierReliability: 0.95,       // Suppliers stretched thin
      logisticsCostChange: +10         // Shipping demand high
    }
  },

  {
    id: 2,
    name: "Recession",
    description: "Negative GDP growth, high unemployment, reduced consumer spending",
    probability: 0.12,
    effects: {
      demandChange: -25,               // Demand collapses
      materialCostChange: -12,         // Commodity prices fall
      labourCostChange: -8,            // Unemployment → cheaper labor
      energyCostChange: -10,           // Low economic activity
      taxRateChange: -2,               // Government stimulus (tax cuts)
      interestRateChange: -4,          // Central bank cuts rates
      exchangeRateVolatility: -0.08,   // Currency depreciates
      consumerPreferences: {
        qualityWeight: 0.6,            // Focus on essentials
        priceWeight: 1.8               // VERY price-sensitive
      },
      supplierReliability: 1.1,        // Suppliers desperate for business
      logisticsCostChange: -15         // Shipping overcapacity
    }
  },

  {
    id: 3,
    name: "Stagflation",
    description: "Stagnant growth with high inflation - worst of both worlds",
    probability: 0.08,
    effects: {
      demandChange: -5,                // Demand weak
      materialCostChange: +22,         // Commodity shock!
      labourCostChange: +15,           // Wage-price spiral
      energyCostChange: +35,           // Energy crisis
      taxRateChange: +3,               // Government needs revenue
      interestRateChange: +6,          // Fighting inflation
      exchangeRateVolatility: -0.12,   // Currency crisis
      consumerPreferences: {
        qualityWeight: 0.8,
        priceWeight: 1.5               // Price-sensitive but trapped
      },
      supplierReliability: 0.85,       // Supply chain disruptions
      logisticsCostChange: +25         // Logistics crisis
    }
  },

  {
    id: 4,
    name: "Tech Innovation Wave",
    description: "Major technological breakthrough drives new demand",
    probability: 0.10,
    effects: {
      demandChange: +30,               // Huge demand for new tech
      materialCostChange: +8,          // New materials needed
      labourCostChange: +20,           // Need skilled tech workers
      energyCostChange: +5,
      taxRateChange: 0,
      interestRateChange: 0,
      exchangeRateVolatility: 0,
      consumerPreferences: {
        qualityWeight: 1.8,            // Features CRITICAL
        priceWeight: 0.5               // Willing to pay premium
      },
      supplierReliability: 0.90,       // Suppliers adapting
      logisticsCostChange: 0
    }
  },

  {
    id: 5,
    name: "Trade War",
    description: "Tariffs and protectionism disrupt global supply chains",
    probability: 0.12,
    effects: {
      demandChange: -8,                // Uncertainty reduces demand
      materialCostChange: +25,         // Tariffs on imports
      labourCostChange: +3,            // Some reshoring
      energyCostChange: 0,
      taxRateChange: 0,
      interestRateChange: +1,
      exchangeRateVolatility: +0.15,   // Currency volatility
      consumerPreferences: {
        qualityWeight: 1.0,
        priceWeight: 1.4               // Prices rising → sensitivity
      },
      supplierReliability: 0.75,       // Supply chain chaos
      logisticsCostChange: +30         // Rerouting shipments
    }
  },

  {
    id: 6,
    name: "Green Transition",
    description: "Carbon taxes and sustainability regulations reshape markets",
    probability: 0.10,
    effects: {
      demandChange: +5,                // Eco-conscious buying
      materialCostChange: +15,         // Sustainable materials costly
      labourCostChange: +8,            // Green skills premium
      energyCostChange: +20,           // Carbon tax
      taxRateChange: +2,               // Environmental taxes
      interestRateChange: -1,          // Green bonds cheaper
      exchangeRateVolatility: 0,
      consumerPreferences: {
        qualityWeight: 1.2,
        priceWeight: 1.1               // Willing to pay some green premium
      },
      supplierReliability: 1.0,
      logisticsCostChange: +12         // Low-carbon shipping
    }
  },

  {
    id: 7,
    name: "Supply Chain Crisis",
    description: "Global logistics breakdown (pandemic, Suez blockage, etc.)",
    probability: 0.08,
    effects: {
      demandChange: +12,               // Demand exists but can't fulfill
      materialCostChange: +30,         // Material shortages
      labourCostChange: +5,
      energyCostChange: +15,
      taxRateChange: 0,
      interestRateChange: 0,
      exchangeRateVolatility: 0,
      consumerPreferences: {
        qualityWeight: 0.9,
        priceWeight: 1.3               // Frustrated by shortages
      },
      supplierReliability: 0.60,       // SEVERE disruption
      logisticsCostChange: +50         // Shipping crisis
    }
  },

  {
    id: 8,
    name: "Normal Growth",
    description: "Stable, predictable economic conditions",
    probability: 0.25,
    effects: {
      demandChange: +3,                // Steady growth
      materialCostChange: +2,          // Mild inflation
      labourCostChange: +3,            // Standard wage growth
      energyCostChange: +2,
      taxRateChange: 0,
      interestRateChange: 0,
      exchangeRateVolatility: 0,
      consumerPreferences: {
        qualityWeight: 1.0,
        priceWeight: 1.0               // Balanced
      },
      supplierReliability: 1.0,
      logisticsCostChange: +2
    }
  }
];
```

### 5.3 New Parameters Required

```sql
-- Create scenarios table
CREATE TABLE scenarios (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  probability DECIMAL(3,2) NOT NULL,  -- 0.00 to 1.00
  demand_change DECIMAL(5,2) NOT NULL,
  material_cost_change DECIMAL(5,2) NOT NULL,
  labour_cost_change DECIMAL(5,2) NOT NULL,
  energy_cost_change DECIMAL(5,2) NOT NULL,
  tax_rate_change DECIMAL(4,2) NOT NULL,
  interest_rate_change DECIMAL(4,2) NOT NULL,
  exchange_rate_volatility DECIMAL(4,2) NOT NULL,
  quality_weight DECIMAL(3,2) NOT NULL,
  price_weight DECIMAL(3,2) NOT NULL,
  supplier_reliability DECIMAL(3,2) NOT NULL,
  logistics_cost_change DECIMAL(5,2) NOT NULL
);

-- Create round_scenario table (which scenario applies to which round)
CREATE TABLE round_scenarios (
  id INT PRIMARY KEY AUTO_INCREMENT,
  game_id INT NOT NULL,
  round_number INT NOT NULL,
  market_id VARCHAR(20) NOT NULL,  -- 'us', 'asia', 'europe'
  scenario_id INT NOT NULL,
  FOREIGN KEY (game_id) REFERENCES game(id),
  FOREIGN KEY (scenario_id) REFERENCES scenarios(id),
  UNIQUE KEY (game_id, round_number, market_id)
);
```

---

## 6. ADDITIONAL CRITICAL FORMULAS

### 6.1 Learning Curve (Optional Enhancement)

```typescript
interface LearningCurveConfig {
  enabled: boolean;
  learningRate: number;          // 0.85-0.95 (90% = 10% improvement per doubling)
  maxReduction: number;          // Cap at 30% total cost reduction
  techLearningBonus: {           // Advanced tech learns faster
    tech1: 1.0,
    tech2: 1.1,
    tech3: 1.2,
    tech4: 1.3
  };
}

function applyLearningCurve(
  baseCost: number,
  cumulativeProduction: number,
  config: LearningCurveConfig
): number {

  if (!config.enabled) return baseCost;

  // Wright's learning curve formula
  const doublings = Math.log2(cumulativeProduction / 1000); // Relative to 1000 units baseline
  const learningProgress = Math.pow(config.learningRate, doublings);

  // Cap the learning benefit
  const costReduction = Math.min(
    1 - learningProgress,
    config.maxReduction
  );

  return baseCost * (1 - costReduction);
}
```

### 6.2 Brand Reputation Accumulation

```typescript
function updateBrandReputation(
  currentReputation: number,
  performance: {
    marketShareChange: number;    // % point change
    productQualityScore: number;  // 0-100
    csrRating: number;            // 1-10
    customerSatisfaction: number; // 0-100 (from unmet demand, etc.)
  }
): number {

  // Reputation changes slowly (momentum)
  const reputationChange =
    (performance.marketShareChange * 2) +
    ((performance.productQualityScore - 50) / 10) +
    ((performance.csrRating - 5) * 2) +
    ((performance.customerSatisfaction - 50) / 10);

  // Apply with decay factor (moves toward 50 over time without maintenance)
  const decay = (50 - currentReputation) * 0.05;

  const newReputation = currentReputation + reputationChange + decay;

  // Cap between 0-100
  return Math.max(0, Math.min(100, newReputation));
}
```

### 6.3 Inventory Carrying Cost

```typescript
function calculateInventoryCost(
  unitsInInventory: number,
  unitCost: number,
  inventoryCarryingRate: number  // From game config (e.g., 0.06 = 6% per round)
): number {

  return unitsInInventory * unitCost * inventoryCarryingRate;
}
```

---

## 7. DATABASE SCHEMA CHANGES

### 7.1 New Tables

```sql
-- Market configuration (replaces hardcoded market splits)
CREATE TABLE market_config (
  id INT PRIMARY KEY AUTO_INCREMENT,
  game_id INT NOT NULL,
  market_id VARCHAR(20) NOT NULL,
  base_market_size INT NOT NULL,
  annual_growth_rate DECIMAL(4,3) NOT NULL,
  volatility_factor DECIMAL(3,2) NOT NULL,
  income_level ENUM('low','medium','high') NOT NULL,
  price_elasticity DECIMAL(3,2) NOT NULL,
  quality_preference DECIMAL(3,2) NOT NULL,
  FOREIGN KEY (game_id) REFERENCES game(id),
  UNIQUE KEY (game_id, market_id)
);

-- Scenarios (replaces random +/-10% system)
CREATE TABLE scenarios (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  probability DECIMAL(3,2) NOT NULL,
  demand_change DECIMAL(5,2) NOT NULL,
  material_cost_change DECIMAL(5,2) NOT NULL,
  labour_cost_change DECIMAL(5,2) NOT NULL,
  energy_cost_change DECIMAL(5,2) NOT NULL,
  tax_rate_change DECIMAL(4,2) NOT NULL,
  interest_rate_change DECIMAL(4,2) NOT NULL,
  exchange_rate_volatility DECIMAL(4,2) NOT NULL,
  quality_weight DECIMAL(3,2) NOT NULL,
  price_weight DECIMAL(3,2) NOT NULL,
  supplier_reliability DECIMAL(3,2) NOT NULL,
  logistics_cost_change DECIMAL(5,2) NOT NULL
);

-- Round-specific scenario assignments
CREATE TABLE round_scenarios (
  id INT PRIMARY KEY AUTO_INCREMENT,
  game_id INT NOT NULL,
  round_number INT NOT NULL,
  market_id VARCHAR(20) NOT NULL,
  scenario_id INT NOT NULL,
  FOREIGN KEY (game_id) REFERENCES game(id),
  FOREIGN KEY (scenario_id) REFERENCES scenarios(id),
  UNIQUE KEY (game_id, round_number, market_id)
);
```

### 7.2 Modified Tables

```sql
-- Update game table
ALTER TABLE game
  -- Remove old cost equation
  DROP COLUMN cost_equation,

  -- Add new cost structure params
  ADD COLUMN plant_maintenance_cost INT NOT NULL DEFAULT 200000,
  ADD COLUMN plant_max_capacity INT NOT NULL DEFAULT 600,
  ADD COLUMN plant_fixed_labor_cost INT NOT NULL DEFAULT 150000,
  ADD COLUMN utilization_optimal DECIMAL(3,2) NOT NULL DEFAULT 0.80,
  ADD COLUMN utilization_under_penalty DECIMAL(3,2) NOT NULL DEFAULT 0.40,
  ADD COLUMN utilization_over_penalty DECIMAL(3,2) NOT NULL DEFAULT 1.50,
  ADD COLUMN tech_efficiency_config TEXT,  -- JSON

  -- Learning curve config (optional)
  ADD COLUMN learning_curve_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN learning_rate DECIMAL(3,2) NOT NULL DEFAULT 0.90,
  ADD COLUMN max_learning_reduction DECIMAL(3,2) NOT NULL DEFAULT 0.30;

-- Update team table
ALTER TABLE team
  ADD COLUMN brand_reputation INT NOT NULL DEFAULT 50,
  ADD COLUMN cumulative_production_total INT NOT NULL DEFAULT 0;
```

---

## 8. IMPLEMENTATION CHECKLIST

### Phase 1: Database Migration
- [ ] Create `market_config` table
- [ ] Create `scenarios` table
- [ ] Create `round_scenarios` table
- [ ] Modify `game` table (add new cost params, remove old cost_equation)
- [ ] Modify `team` table (add brand_reputation, cumulative_production)
- [ ] Seed scenarios table with 8 default scenarios
- [ ] Create migration script for existing games

### Phase 2: Core Formula Implementation
- [ ] Implement new cost calculation function (Option 2)
- [ ] Implement fixed market demand system
- [ ] Implement market share competition algorithm
- [ ] Implement scenario effect application
- [ ] Add formula configuration UI for educators

### Phase 3: Educational Features
- [ ] Create cost breakdown visualization
- [ ] Create market share analysis dashboard
- [ ] Add "What-if" scenario explorer
- [ ] Generate round summaries with explanations

### Phase 4: Testing & Validation
- [ ] Unit tests for all formulas
- [ ] Compare new vs old system with sample data
- [ ] Playtest with 3-5 teams to verify balance
- [ ] Educator review of default parameters
- [ ] Student usability testing

### Phase 5: Documentation
- [ ] API documentation for all formulas
- [ ] Educator guide for configuring parameters
- [ ] Student guide explaining economic concepts
- [ ] Migration guide for existing games

---

## 9. PARAMETER DEFAULTS - REFERENCE SHEET

```json
{
  "costStructure": {
    "plantMaintenanceCost": 200000,
    "plantMaxCapacity": 600,
    "plantFixedLaborCost": 150000,
    "utilizationCurve": {
      "optimal": 0.80,
      "underPenalty": 0.40,
      "overPenalty": 1.50
    },
    "techEfficiency": {
      "tech1": { "fixed": 1.0, "variable": 1.2 },
      "tech2": { "fixed": 1.1, "variable": 1.0 },
      "tech3": { "fixed": 1.3, "variable": 0.85 },
      "tech4": { "fixed": 1.6, "variable": 0.65 }
    }
  },

  "marketDemand": {
    "us": {
      "baseSize": 1500,
      "growthRate": 0.03,
      "volatility": 0.15,
      "priceElasticity": 0.80,
      "qualityPreference": 1.40
    },
    "asia": {
      "baseSize": 4000,
      "growthRate": 0.08,
      "volatility": 0.25,
      "priceElasticity": 1.50,
      "qualityPreference": 0.90
    },
    "europe": {
      "baseSize": 1200,
      "growthRate": 0.02,
      "volatility": 0.10,
      "priceElasticity": 1.00,
      "qualityPreference": 1.20
    }
  },

  "marketShare": {
    "weights": {
      "quality": 0.4,
      "price": 0.6
    },
    "csrBonus": {
      "high": 1.15,
      "medium": 1.0,
      "low": 0.95
    },
    "brandImpact": 0.005
  },

  "learningCurve": {
    "enabled": false,
    "rate": 0.90,
    "maxReduction": 0.30,
    "techBonus": {
      "tech1": 1.0,
      "tech2": 1.1,
      "tech3": 1.2,
      "tech4": 1.3
    }
  }
}
```

---

## 10. MIGRATION FROM OLD SYSTEM

### Conversion Script (Pseudocode)

```typescript
function migrateExistingGame(gameId: number) {

  // 1. Convert old cost_equation (a,b,c,d) to new params
  const oldEquation = db.query("SELECT cost_equation FROM game WHERE id=?", [gameId]);
  const [a, b, c, d] = oldEquation.split(',');

  // Map old parameters to new utilization curve
  // (This is approximate - may need manual tuning)
  const newParams = {
    utilization_optimal: 0.80,  // Assume 80% optimal
    utilization_under_penalty: Math.abs(c) / 2,
    utilization_over_penalty: a / b
  };

  db.update("game", newParams, { id: gameId });

  // 2. Create market_config entries
  const markets = ['us', 'asia', 'europe'];
  markets.forEach(market => {
    db.insert("market_config", {
      game_id: gameId,
      market_id: market,
      ...DEFAULT_MARKET_CONFIG[market]
    });
  });

  // 3. Assign scenarios to existing rounds
  const rounds = db.query("SELECT DISTINCT round FROM output WHERE game_id=?", [gameId]);
  rounds.forEach(round => {
    markets.forEach(market => {
      const randomScenario = selectWeightedRandomScenario();
      db.insert("round_scenarios", {
        game_id: gameId,
        round_number: round,
        market_id: market,
        scenario_id: randomScenario.id
      });
    });
  });

  // 4. Initialize brand reputation for all teams
  db.update("team", { brand_reputation: 50 }, { game_id: gameId });
}
```

---

**END OF DOCUMENT**

**Next Steps:**
1. Review this specification with stakeholders
2. Prioritize which improvements to implement first
3. Create detailed implementation tasks
4. Begin Phase 1: Database migration
