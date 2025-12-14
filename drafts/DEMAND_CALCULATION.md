# How Market Demand is Calculated - THE COMPLETE PICTURE

## Initial Market Size Calculation (game.php lines 608-617)

### Step 1: Calculate Total Market Demand

```php
// Line 608
$totalsale = round(
    $no_of_teams ×
    ($capacity_per_plant × $cap_allocate × $no_of_factory_c1) ×
    (100 - $Inventory_1st_r/100) / 100
, 0);
```

**What this means:**
- Total market demand = What all teams can collectively produce
- Based on: number of teams × their initial capacity × allocation %
- Reduced by initial inventory percentage

**Example:**
```
5 teams × (500 units/plant × 95% allocation × 2 factories) × (100 - 10%)/100
= 5 × (500 × 0.95 × 2) × 0.9
= 5 × 950 × 0.9
= 4,275 units total market demand
```

---

### Step 2: Split Total Demand Across 3 Markets

```php
// Lines 610-617
$Marketshare_c1_r0 = $_POST['Marketshare_c1_r0'];  // e.g., 35%
$Marketshare_c2_r0 = $_POST['Marketshare_c2_r0'];  // e.g., 40%
$Marketshare_c3_r0 = 100 - ($Marketshare_c2_r0 + $Marketshare_c1_r0);  // e.g., 25%

$totalsale_c1 = round($totalsale × $Marketshare_c1_r0 / 100, 0);  // US
$totalsale_c2 = round($totalsale × $Marketshare_c2_r0 / 100, 0);  // Asia
$totalsale_c3 = round($totalsale × $Marketshare_c3_r0 / 100, 0);  // Europe
```

**Example continued:**
```
Total market = 4,275 units

US market (35%):     4,275 × 0.35 = 1,496 units
Asia market (40%):   4,275 × 0.40 = 1,710 units
Europe market (25%): 4,275 × 0.25 = 1,069 units
```

---

### Step 3: Initial Market Share Per Team (Equal Distribution)

```php
// Lines 630-632
$sale_per_team_r0_c1 = round($totalsale_c1 / $no_of_teams, 0);
$sale_per_team_r0_c2 = round($totalsale_c2 / $no_of_teams, 0);
$sale_per_team_r0_c3 = round($totalsale_c3 / $no_of_teams, 0);
```

**Example continued (5 teams):**
```
Each team's initial sales:
- US: 1,496 / 5 = 299 units
- Asia: 1,710 / 5 = 342 units
- Europe: 1,069 / 5 = 214 units
```

---

## How Demand Changes Per Round

### Round 0 (Practice):
- Uses base market sizes calculated above
- All teams start equal: `100,0,0,0` market share for Tech1 (100% Tech1, 0% Tech2/3/4)

### Round 1+:
Market demand changes based on **scenario** selected for each market:

```php
// From HOW_ROUNDS_WORK.md
New_demand = Previous_demand × (1 + scenario_change_percentage/100)
```

**Example - Round 1:**
```
Scenario picked for US: Scenario 4 (+15% growth)
US market demand: 1,496 × 1.15 = 1,721 units

Scenario picked for Asia: Scenario 2 (-10% recession)
Asia market demand: 1,710 × 0.90 = 1,539 units

Scenario picked for Europe: Scenario 3 (0% stagnant)
Europe market demand: 1,069 × 1.00 = 1,069 units
```

---

## Educator Inputs for Demand Calculation

From `parameters_assumption` table (lines 8518-8519):

### Required Inputs:
1. **Marketshare_c1_r0** (US market %)
   - Min: 30%
   - Max: 35%
   - Random: System picks between 30-35%

2. **Marketshare_c2_r0** (Asia market %)
   - Min: 40%
   - Max: 45%
   - Random: System picks between 40-45%

3. **Marketshare_c3_r0** (Europe market %)
   - **Auto-calculated**: `100 - (c1 + c2)`
   - If US=35% and Asia=40%, then Europe=25%

4. **capacity_per_plant** (line 8566)
   - Min: 450 units
   - Max: 600 units
   - Defines initial production capacity

5. **cap_allocate** (line 8568)
   - Min: 90%
   - Max: 100%
   - How much of capacity is allocated (rest is maintenance/downtime)

6. **Inventory_1st_r** (line 8567)
   - Min: 5%
   - Max: 15%
   - Initial inventory percentage (reduces available sales)

7. **no_of_factory_c1** (implied from code)
   - Number of initial factories per team (typically 2)

---

## The Complete Formula

```javascript
// Initial total market demand
totalMarketDemand = noOfTeams ×
                    (capacityPerPlant × capacityAllocation × initialFactories) ×
                    (1 - initialInventory)

// Split across markets
usMarketDemand = totalMarketDemand × usMarketShare
asiaMarketDemand = totalMarketDemand × asiaMarketShare
europeMarketDemand = totalMarketDemand × europeMarketShare

// Each round, demand changes per market
newRoundDemand[market] = previousRoundDemand[market] × (1 + scenarioChange/100)
```

---

## Market Share Within Each Market

Initially (Round 0):
- All teams have equal market share
- All demand is for Tech 1 only
- Market share: `"100,0,0,0"` (100% Tech1, 0% Tech2/3/4)

Later rounds:
- Market share becomes **competitive**
- Depends on:
  - Price
  - Features
  - Promotion
  - Technology attractiveness
  - Product quality
  - CSR (supplier choice)

**Example Round 1 US market after competition:**
```
Team 1: 25% market share (Tech1: 15%, Tech2: 10%)
Team 2: 20% market share (Tech1: 20%, Tech2: 0%)
Team 3: 22% market share (Tech1: 12%, Tech2: 10%)
Team 4: 18% market share (Tech1: 10%, Tech2: 8%)
Team 5: 15% market share (Tech1: 8%, Tech2: 7%)
Total: 100%
```

---

## Why This Design is Brilliant for Education

1. **Market size reflects capacity**: Prevents unrealistic scenarios where demand >> supply
2. **Markets have different sizes**: US, Asia, Europe are realistically proportioned
3. **Demand evolves dynamically**: Scenarios make each round unpredictable
4. **Teams compete for share**: Zero-sum game teaches competitive strategy
5. **Technology adoption**: Markets shift from Tech1 → Tech2 → Tech3 → Tech4 over time
6. **Global strategy**: Teams must decide which markets to prioritize

---

## For React Implementation

### Game Creation Form Inputs (Auto-randomized):

**Market Split Section:**
```jsx
<h3>Initial Market Distribution</h3>
<Field>
  US Market Share: [Auto: 30-35%] → 33%
  Asia Market Share: [Auto: 40-45%] → 42%
  Europe Market Share: [Auto-calculated] → 25%
</Field>
```

**Capacity Section:**
```jsx
<h3>Production Capacity</h3>
<Field>
  Units per Plant: [Auto: 450-600] → 520 units
  Capacity Allocation: [Auto: 90-100%] → 95%
  Initial Factories: [Fixed] → 2 per team
  Initial Inventory: [Auto: 5-15%] → 10%
</Field>
```

### Calculation Service:

```typescript
function calculateInitialMarketDemand(gameParams: GameParams): MarketDemand {
  const {
    noOfTeams,
    capacityPerPlant,
    capacityAllocation,
    initialFactories,
    initialInventory,
    usMarketShare,
    asiaMarketShare
  } = gameParams;

  // Total market
  const totalDemand = Math.round(
    noOfTeams *
    (capacityPerPlant * capacityAllocation * initialFactories) *
    (1 - initialInventory)
  );

  // Split across markets
  const usMarket = Math.round(totalDemand * usMarketShare);
  const asiaMarket = Math.round(totalDemand * asiaMarketShare);
  const europeMarket = Math.round(totalDemand * (1 - usMarketShare - asiaMarketShare));

  return {
    total: totalDemand,
    us: usMarket,
    asia: asiaMarket,
    europe: europeMarket,
    perTeam: {
      us: Math.round(usMarket / noOfTeams),
      asia: Math.round(asiaMarket / noOfTeams),
      europe: Math.round(europeMarket / noOfTeams)
    }
  };
}

function calculateNextRoundDemand(
  previousDemand: number,
  scenario: Scenario
): number {
  const changePercent = scenario.demandChange; // e.g., 15 for +15%
  return Math.round(previousDemand * (1 + changePercent / 100));
}
```

---

## Summary

**Educator inputs (auto-randomized):**
1. Market split percentages (US: 30-35%, Asia: 40-45%, Europe: auto)
2. Capacity per plant (450-600 units)
3. Capacity allocation (90-100%)
4. Initial inventory (5-15%)

**System calculates:**
1. Total market demand based on teams' collective capacity
2. Split demand across 3 markets
3. Each team starts with equal share
4. Each round: Apply scenario changes to demand
5. Teams compete for market share within each market

**Result:**
- Realistic market sizes
- Dynamic demand evolution
- Competitive strategic gameplay
- Educational business simulation!
