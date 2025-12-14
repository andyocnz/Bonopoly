# Demand Calculation System - Analysis & Redesign

## Problems with Original System

### ❌ Problem 1: Demand Tied to Supply (Circular Logic)

**Original formula:**
```php
totalMarketDemand = noOfTeams × (capacityPerPlant × allocation × factories) × (1 - inventory%)
```

**Issues:**
1. **Demand = Supply**: Market size is based on what teams CAN produce, not what customers WANT
2. **Circular dependency**: If teams build more factories → demand magically increases!
3. **Unrealistic**: Real markets don't grow just because you build more factories
4. **No market dynamics**: Doesn't reflect actual customer demand, population, GDP, etc.

**Example of the problem:**
```
Game A: 3 teams with 2 factories each
→ Total demand = 3 × (500 × 2) = 3,000 units

Game B: 5 teams with 2 factories each
→ Total demand = 5 × (500 × 2) = 5,000 units

Why does the market magically grow 67% just because there are more teams?
This makes no economic sense!
```

---

### ❌ Problem 2: Market Split is Random, Not Realistic

**Original:**
```php
US market: random(30-35%)
Asia market: random(40-45%)
Europe: whatever's left (25-30%)
```

**Issues:**
1. No relationship to real market sizes
2. Asia might be 45% in one game, 40% in another - inconsistent
3. No consideration of GDP, population, purchasing power

---

### ❌ Problem 3: Static Initial Distribution

**Original:**
```php
Each team starts with equal market share: totalDemand / noOfTeams
```

**Issues:**
1. All teams start identical - no differentiation
2. No challenge in Round 0
3. Students don't learn about market entry strategies

---

## ✅ PROPOSED REDESIGN: Realistic Market Demand System

### New Approach: Fixed Market Sizes Based on Economic Reality

**Core Principle:** Market demand should be **independent** of supply (teams' capacity)

---

## Redesign Option A: GDP-Based Market Sizing (Recommended)

### Step 1: Define Base Market Sizes (Fixed per round initially)

```typescript
interface MarketEconomy {
  name: string;
  population: number;      // millions
  gdpPerCapita: number;    // USD
  adoptionRate: number;    // % of population that buys products
  unitsPerBuyer: number;   // units purchased per year
}

const MARKET_DEFINITIONS = {
  us: {
    name: "United States",
    population: 330,           // 330 million people
    gdpPerCapita: 70000,       // $70k GDP/capita
    adoptionRate: 0.40,        // 40% buy the product
    unitsPerBuyer: 1.2         // 1.2 units per buyer per year
  },
  asia: {
    name: "Asia Pacific",
    population: 2000,          // 2 billion people
    gdpPerCapita: 15000,       // $15k GDP/capita (average)
    adoptionRate: 0.25,        // 25% adoption (lower income)
    unitsPerBuyer: 0.8         // 0.8 units per buyer
  },
  europe: {
    name: "Europe",
    population: 450,           // 450 million people
    gdpPerCapita: 45000,       // $45k GDP/capita
    adoptionRate: 0.35,        // 35% adoption
    unitsPerBuyer: 1.0         // 1.0 units per buyer
  }
};
```

### Step 2: Calculate Market Demand

```typescript
function calculateMarketDemand(market: MarketEconomy): number {
  return Math.round(
    market.population *              // 330 million
    market.adoptionRate *            // × 40% = 132 million buyers
    market.unitsPerBuyer *          // × 1.2 units = 158.4 million units/year
    (1 / 12)                        // ÷ 12 months = 13.2 million units/month
  );
}

// Results (monthly demand):
// US: 13.2 million units/month
// Asia: 40 million units/month
// Europe: 13.1 million units/month
// TOTAL: 66.3 million units/month
```

**But this is too large for a classroom game!**

### Step 3: Scale Down for Classroom (Educational Scale Factor)

```typescript
const GAME_SCALE_FACTOR = 0.0001; // Represents 0.01% of real market

function getGameMarketDemand(market: MarketEconomy, scaleFactor: number): number {
  const realDemand = calculateMarketDemand(market);
  return Math.round(realDemand * scaleFactor);
}

// Results (scaled for game):
// US: 1,320 units/round
// Asia: 4,000 units/round
// Europe: 1,310 units/round
// TOTAL: 6,630 units/round
```

---

## Redesign Option B: Simplified Fixed Market (Even Simpler)

```typescript
interface GameMarketConfig {
  baseSize: number;          // Base units per round
  growthRate: number;        // % growth per year
  volatility: number;        // How much scenarios affect it
}

const MARKET_CONFIG = {
  us: {
    baseSize: 1500,          // 1,500 units/round (fixed)
    growthRate: 0.03,        // 3% annual growth
    volatility: 0.15         // Scenarios can swing ±15%
  },
  asia: {
    baseSize: 4000,          // 4,000 units/round (larger market)
    growthRate: 0.08,        // 8% annual growth (emerging)
    volatility: 0.20         // More volatile ±20%
  },
  europe: {
    baseSize: 1200,          // 1,200 units/round
    growthRate: 0.02,        // 2% annual growth (mature)
    volatility: 0.10         // More stable ±10%
  }
};
```

---

## Comparison: Old vs New

### Old System:
```
3 teams, 2 factories, 500 capacity each
Total demand = 3 × (500 × 2) × 0.95 = 2,850 units
  US (33%): 941 units
  Asia (42%): 1,197 units
  Europe (25%): 713 units
```

### New System (Option B):
```
Total demand = 6,700 units (FIXED, independent of teams)
  US: 1,500 units
  Asia: 4,000 units
  Europe: 1,200 units
```

**Key Difference:**
- ❌ Old: Add more teams → demand increases (wrong!)
- ✅ New: Demand is fixed → teams compete for share (realistic!)

---

## Improved Scenario System

### Old System Issues:
- All 29 parameters change by same % (too simple)
- Scenario 1: "+10% everything"
- Scenario 2: "-10% everything"

### New System: Realistic Mixed Scenarios

```typescript
interface Scenario {
  id: number;
  name: string;
  description: string;
  effects: {
    demandChange: number;          // % change in demand
    costChange: number;            // % change in costs
    labourCostChange: number;      // Separate for labour
    materialCostChange: number;    // Separate for materials
    taxRateChange: number;         // Absolute change (e.g., +5% → 30% becomes 35%)
    interestRateChange: number;    // Absolute change
    exchangeRateChange: number;    // % change
    consumerPreferences: {         // New!
      qualityWeight: number;       // How much consumers care about features
      priceWeight: number;         // How price-sensitive they are
    };
  };
}

const SCENARIOS = [
  {
    id: 1,
    name: "Economic Boom",
    description: "Strong growth, high consumer spending, tight labor market",
    effects: {
      demandChange: +15,           // +15% demand
      costChange: +5,              // But +5% overall costs
      labourCostChange: +10,       // Labour especially expensive
      materialCostChange: +3,      // Materials slightly up
      taxRateChange: 0,            // Tax unchanged
      interestRateChange: +2,      // Interest rates up (central bank cooling economy)
      exchangeRateChange: +5,      // Currency appreciates
      consumerPreferences: {
        qualityWeight: 1.2,        // Consumers want quality (willing to pay)
        priceWeight: 0.8           // Less price-sensitive
      }
    }
  },
  {
    id: 2,
    name: "Recession",
    description: "Economic downturn, job losses, reduced spending",
    effects: {
      demandChange: -20,           // -20% demand (harsh!)
      costChange: -5,              // Costs drop
      labourCostChange: -10,       // Unemployment → cheaper labour
      materialCostChange: -8,      // Commodity prices fall
      taxRateChange: -3,           // Government stimulus (tax cuts)
      interestRateChange: -3,      // Central bank cuts rates
      exchangeRateChange: -8,      // Currency depreciates
      consumerPreferences: {
        qualityWeight: 0.7,        // Consumers prioritize basics
        priceWeight: 1.5           // VERY price-sensitive
      }
    }
  },
  {
    id: 3,
    name: "Stagflation",
    description: "No growth but high inflation - worst of both worlds",
    effects: {
      demandChange: 0,             // Demand flat
      costChange: +15,             // But costs skyrocket!
      labourCostChange: +12,       // Wages rise (inflation)
      materialCostChange: +20,     // Commodities soar
      taxRateChange: +2,           // Government needs revenue
      interestRateChange: +5,      // Fighting inflation
      exchangeRateChange: -10,     // Currency weak
      consumerPreferences: {
        qualityWeight: 0.9,
        priceWeight: 1.3           // Price-sensitive due to inflation
      }
    }
  },
  {
    id: 4,
    name: "Tech Disruption",
    description: "New technology wave, consumer excitement",
    effects: {
      demandChange: +25,           // Huge demand for new tech
      costChange: +8,              // R&D investment needed
      labourCostChange: +15,       // Need skilled workers
      materialCostChange: +5,
      taxRateChange: 0,
      interestRateChange: 0,
      exchangeRateChange: 0,
      consumerPreferences: {
        qualityWeight: 1.5,        // Features VERY important
        priceWeight: 0.6           // Willing to pay premium
      }
    }
  },
  {
    id: 5,
    name: "Trade War",
    description: "Tariffs, protectionism, supply chain disruption",
    effects: {
      demandChange: -5,            // Slight demand drop
      costChange: +12,             // Tariffs increase costs
      labourCostChange: 0,
      materialCostChange: +18,     // Import materials expensive
      taxRateChange: 0,
      interestRateChange: +1,
      exchangeRateChange: +3,      // Domestic currency strong
      consumerPreferences: {
        qualityWeight: 1.0,
        priceWeight: 1.2           // Prices rising → sensitivity up
      }
    }
  }
];
```

---

## Better Market Share Competition

### Old Problem:
- Teams start equal, no differentiation
- Market share calculation unclear

### New System:

```typescript
function calculateMarketShare(
  teams: TeamDecision[],
  marketDemand: number,
  marketParams: MarketParams
): MarketShareResult[] {

  // Step 1: Calculate attractiveness score for each team's product
  const teamScores = teams.map(team => {
    const {
      price,
      features,
      promotion,
      technology,
      supplier // CSR impact
    } = team.productOffering;

    // Weighted score based on consumer preferences
    const qualityScore = (features * 0.4) + (technology.attractiveness * 0.6);
    const priceScore = 1 / (price / marketParams.averagePrice); // Lower price = higher score
    const promotionBonus = 1 + (promotion / 100);
    const csrBonus = supplier.csrRating > 7 ? 1.1 : 1.0;

    // Apply consumer preference weights from scenario
    const attractiveness =
      (qualityScore * marketParams.consumerPreferences.qualityWeight) *
      (priceScore * marketParams.consumerPreferences.priceWeight) *
      promotionBonus *
      csrBonus;

    return {
      teamId: team.id,
      attractiveness,
      maxCapacity: team.productionCapacity
    };
  });

  // Step 2: Distribute demand proportionally to attractiveness
  const totalAttractiveness = teamScores.reduce((sum, t) => sum + t.attractiveness, 0);

  const marketShares = teamScores.map(team => {
    const demandShare = (team.attractiveness / totalAttractiveness) * marketDemand;

    // Cap at production capacity (can't sell more than you can make!)
    const actualSales = Math.min(demandShare, team.maxCapacity);

    return {
      teamId: team.teamId,
      demandShare: demandShare,
      actualSales: actualSales,
      marketSharePercent: (actualSales / marketDemand) * 100,
      lostSales: demandShare - actualSales // Unfulfilled demand
    };
  });

  return marketShares;
}
```

---

## Educational Benefits of New System

### 1. **Realistic Competition:**
- Market size is FIXED (like real markets)
- Teams compete for SHARE, not growing the pie
- Zero-sum game teaches competitive strategy

### 2. **Supply/Demand Dynamics:**
- If total capacity < demand → Opportunity! (unmet demand)
- If total capacity > demand → Overcapacity! (price war likely)
- Teams learn about capacity planning

### 3. **Strategic Trade-offs:**
- **Boom scenario**: High demand, high costs → Expand or maximize margin?
- **Recession scenario**: Low demand, low costs → Price war or maintain quality?
- **Different markets**: Asia (large, price-sensitive) vs US (smaller, quality-focused)

### 4. **Market Entry Strategy:**
- Should we focus on US (high margin) or Asia (high volume)?
- Invest in features (US customers) or low cost (Asia customers)?

---

## Recommendation: Hybrid Approach

```typescript
interface GameMarketDemand {
  // Fixed base (realistic market size)
  baseMarketSize: {
    us: 1500,
    asia: 4000,
    europe: 1200
  };

  // Growth over time (compound each round)
  annualGrowthRate: {
    us: 0.03,      // 3% per year (mature market)
    asia: 0.08,    // 8% per year (emerging market)
    europe: 0.02   // 2% per year (mature market)
  };

  // Scenario volatility on top of growth
  scenarioImpact: {
    us: { min: -15, max: +20 },      // Can swing -15% to +20%
    asia: { min: -25, max: +30 },    // More volatile
    europe: { min: -10, max: +15 }   // More stable
  };
}

// Round demand calculation:
function calculateRoundDemand(
  market: string,
  previousDemand: number,
  roundsSinceStart: number,
  scenario: Scenario
): number {

  // Natural growth
  const growthFactor = Math.pow(
    1 + gameMarketDemand.annualGrowthRate[market],
    roundsSinceStart / 12  // Convert rounds to years
  );

  // Scenario impact
  const scenarioFactor = 1 + (scenario.effects.demandChange / 100);

  return Math.round(
    gameMarketDemand.baseMarketSize[market] *
    growthFactor *
    scenarioFactor
  );
}
```

---

## Summary: What to Change

### ❌ Remove:
1. Demand calculated from team capacity
2. Random market split percentages
3. Equal starting market share

### ✅ Add:
1. **Fixed base market sizes** (US: 1500, Asia: 4000, Europe: 1200)
2. **Realistic scenarios** (different impacts on demand, costs, preferences)
3. **Competitive market share** (based on price, quality, features, CSR)
4. **Consumer preference weights** (scenario-dependent)
5. **Unmet demand tracking** (if teams underproduce)

### Result:
- More realistic simulation
- Better teaches business strategy
- More engaging for students
- Easier to balance

**Should we implement this redesigned demand system?**
