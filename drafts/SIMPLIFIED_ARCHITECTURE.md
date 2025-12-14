# Bonopoly - Simplified Architecture (Final)

## Confirmed System Behavior

Based on original PHP code analysis (game.php line 1042 + workflow discussion):

### Answers to Critical Questions:

1. ✅ **Practice round results**: YES, calculated and shown to students
2. ✅ **Default decisions**: All zeros / "do nothing" values
3. ✅ **Round auto-start**: YES, immediately after previous round ends
4. ✅ **Market generation**: Random with realistic ranges (game.php:1838-1842)
5. ✅ **Team names**: Shuffled fruit/veggie names (Banana, Coconut, Cherry, etc.) - educator can customize
6. ✅ **Admin PIN**: Read-only monitoring, cannot submit decisions

---

## ONE Google Sheet Architecture

**ONE master Google Spreadsheet** = "Bonopoly Master Database"
All games stored as rows (like the original MySQL database)

### Sheet 1: games
Stores all game configurations

```
Columns (20):
game_id | game_code | admin_pin | name | educator_email | no_of_teams | no_of_rounds |
practice_rounds | created_at | cost_equation | hr_stan_wage | hr_standard_training_budget |
depreciation_rate | min_cash | share_capital | tech_avai_us | tech_avai_asia |
tech_avai_europe | status | settings_json
```

**Example Row:**
```
1 | GAME001 | ADMIN-XYZ123 | MBA Fall 2024 | prof@uni.edu | 5 | 3 | 1 |
2024-12-13 10:00:00 | 0.9,6,-0.85,1.5 | 2500 | 50000 | 0.1 | 1000000 |
10000000 | [70,80,90,100,100] | [60,70,80,90,95] | [65,75,85,95,100] |
active | {...additional settings...}
```

---

### Sheet 2: teams
All teams from all games

```
Columns (7):
team_id | game_id | team_number | team_name | team_pin | created_at | is_active
```

**Example Rows:**
```
1 | 1 | 1 | Banana   | PIN-A1B2C3 | 2024-12-13 10:00:00 | TRUE
2 | 1 | 2 | Coconut  | PIN-D4E5F6 | 2024-12-13 10:00:00 | TRUE
3 | 1 | 3 | Cherry   | PIN-G7H8I9 | 2024-12-13 10:00:00 | TRUE
4 | 1 | 4 | Carrot   | PIN-J1K2L3 | 2024-12-13 10:00:00 | TRUE
5 | 1 | 5 | Durian   | PIN-M4N5O6 | 2024-12-13 10:00:00 | TRUE
```

**Team Name Pool (shuffled):**
```javascript
["Banana", "Coconut", "Cherry", "Carrot", "Durian", "Grape", "Lemon",
 "Mango", "Litchi", "Orange", "Longan", "Starfruit", "Tomato",
 "Potato", "Melon", "Pear", "Pineapple", "Pumpkin"]
```

---

### Sheet 3: rounds
All rounds from all games

```
Columns (10):
round_id | game_id | round_number | is_practice | deadline | timezone |
status | market_params_json | calculated_at | notes
```

**Example Rows:**
```
1 | 1 | 0 | TRUE  | 2024-12-14 17:00:00 | America/New_York | completed | {...market params...} | 2024-12-14 17:01:00 | Practice round
2 | 1 | 1 | FALSE | 2024-12-15 17:00:00 | America/New_York | completed | {...market params...} | 2024-12-15 17:01:00 | Round 1
3 | 1 | 2 | FALSE | 2024-12-17 17:00:00 | America/New_York | active    | {...market params...} | NULL                | Round 2 in progress
4 | 1 | 3 | FALSE | 2024-12-19 17:00:00 | America/New_York | pending   | {...market params...} | NULL                | Round 3 not started
```

**Status values:**
- `pending` - Not started yet
- `active` - Currently open for submissions
- `calculating` - Deadline passed, calculating results
- `completed` - Results published

**market_params_json structure (26 parameters × 3 markets):**
```json
{
  "us": {
    "demand_multiplier": 1.2,
    "material_cost": 450,
    "supplier1_cost": 400,
    "supplier2_cost": 420,
    "supplier3_cost": 380,
    "supplier4_cost": 440,
    "labour_cost": 2500,
    "outsource_capacity": 50000,
    "outsource_cost": 500,
    "tax_rate": 0.30,
    "interest_rate": 0.08,
    "short_interest_premium": 0.02,
    "min_wage": 2000,
    "tech1_dev_cost": 50000,
    "tech2_dev_cost": 100000,
    "tech3_dev_cost": 150000,
    "tech4_dev_cost": 200000,
    "feature1_cost": 10000,
    "feature2_cost": 15000,
    "feature3_cost": 20000,
    "feature4_cost": 25000,
    "tariff_rate": 0.05,
    "transport_cost": 50,
    "receivable_days": 30,
    "payable_days": 45,
    "exchange_rate": 1.0,
    "csr_demand_impact": 0.05
  },
  "asia": {...same 26 parameters with different values...},
  "europe": {...same 26 parameters with different values...}
}
```

---

### Sheet 4: decisions
All team decisions from all games and rounds

```
Columns (8):
decision_id | game_id | team_id | round_id | submitted | timestamp |
ip_address | decisions_json
```

**Example Rows:**
```
1 | 1 | 1 | 2 | TRUE  | 2024-12-15 16:45:23 | 192.168.1.100 | {...all 7 decision areas...}
2 | 1 | 2 | 2 | TRUE  | 2024-12-15 16:55:12 | 192.168.1.101 | {...all 7 decision areas...}
3 | 1 | 3 | 2 | FALSE | 2024-12-15 17:01:00 | AUTO-DEFAULT  | {...default values...}
```

**decisions_json structure (all 7 areas):**
```json
{
  "production": {
    "demandForecast": {
      "us": {"tech1": 1000, "tech2": 500, "tech3": 0, "tech4": 0},
      "asia": {"tech1": 800, "tech2": 300, "tech3": 0, "tech4": 0},
      "europe": {"tech1": 600, "tech2": 200, "tech3": 0, "tech4": 0}
    },
    "capacityAllocation": {
      "usPlants": {"tech1": 70, "tech2": 30, "tech3": 0, "tech4": 0},
      "asiaPlants": {"tech1": 60, "tech2": 40, "tech3": 0, "tech4": 0}
    },
    "suppliers": {
      "usPlant1": "supplier1",
      "usPlant2": "supplier2",
      "asiaPlant1": "supplier3"
    },
    "outsourcing": {
      "us": {"tech1": 0, "tech2": 10},
      "asia": {"tech1": 5, "tech2": 0}
    }
  },
  "hr": {
    "employeeCount": 100,
    "monthlySalary": 2500,
    "monthlyTrainingBudget": 50000,
    "targetTurnoverRate": 6
  },
  "rnd": {
    "techDevelopment": {"tech2": 100000, "tech3": 50000, "tech4": 0},
    "featureDevelopment": {"feature1": 20000, "feature2": 15000, "feature3": 10000},
    "licensing": {"tech3_license": false, "feature4_license": true}
  },
  "investment": {
    "newPlants": {"us": 0, "asia": 1},
    "plantUpgrades": {"usPlant1": "automation"}
  },
  "logistics": {
    "deliveryPriority": {
      "fromUS": ["us", "europe", "asia"],
      "fromAsia": ["asia", "us", "europe"]
    },
    "inventoryPolicy": "FIFO"
  },
  "marketing": {
    "products": {
      "tech1": {
        "features": 5,
        "pricing": {"us": 350, "asia": 300, "europe": 380},
        "promotion": {"us": 10, "asia": 5, "europe": 8}
      },
      "tech2": {
        "features": 7,
        "pricing": {"us": 450, "asia": 400, "europe": 480},
        "promotion": {"us": 12, "asia": 6, "europe": 10}
      }
    }
  },
  "finance": {
    "transferPricing": {"us": 1.2, "asia": 1.5, "europe": 1.3},
    "debt": {"longtermBorrowing": 50000, "longtermRepayment": 0},
    "equity": {"shareIssuance": 0, "shareBuyback": 0},
    "dividends": 10000
  }
}
```

**Default decisions_json (when team doesn't submit):**
```json
{
  "production": {
    "demandForecast": {"us": {"tech1": 0, "tech2": 0, "tech3": 0, "tech4": 0}, "asia": {...all 0...}, "europe": {...all 0...}},
    "capacityAllocation": {"usPlants": {...all 0...}, "asiaPlants": {...all 0...}},
    "suppliers": {"usPlant1": "supplier1"},
    "outsourcing": {"us": {...all 0...}, "asia": {...all 0...}}
  },
  "hr": {"employeeCount": 0, "monthlySalary": 0, "monthlyTrainingBudget": 0},
  "rnd": {"techDevelopment": {...all 0...}, "featureDevelopment": {...all 0...}, "licensing": {...all false...}},
  "investment": {"newPlants": {"us": 0, "asia": 0}, "plantUpgrades": {}},
  "logistics": {"deliveryPriority": {"fromUS": ["us", "asia", "europe"], "fromAsia": ["asia", "us", "europe"]}},
  "marketing": {"products": {"tech1": {"features": 0, "pricing": {...all 0...}, "promotion": {...all 0...}}}},
  "finance": {"transferPricing": {"us": 1, "asia": 1, "europe": 1}, "debt": {...all 0...}, "equity": {...all 0...}, "dividends": 0}
}
```

---

### Sheet 5: results
All calculated results from all games and rounds

```
Columns (6):
result_id | game_id | team_id | round_id | calculated_at | results_json
```

**Example Rows:**
```
1 | 1 | 1 | 2 | 2024-12-15 17:01:15 | {...complete P&L, balance sheet, ratios...}
2 | 1 | 2 | 2 | 2024-12-15 17:01:15 | {...complete P&L, balance sheet, ratios...}
3 | 1 | 3 | 2 | 2024-12-15 17:01:15 | {...complete P&L, balance sheet, ratios...}
```

**results_json structure:**
```json
{
  "pnl": {
    "revenue": {"us": 500000, "asia": 350000, "europe": 200000, "total": 1050000},
    "costs": {"cogs": 450000, "transportation": 25000, "promotion": 50000, "admin": 30000, "rnd": 100000, "total": 655000},
    "ebitda": 395000,
    "depreciation": 35000,
    "ebit": 360000,
    "netFinancing": 15000,
    "profitBeforeTax": 345000,
    "incomeTax": 86250,
    "profitAfterTax": 258750
  },
  "balanceSheet": {
    "assets": {"fixedAssets": 500000, "inventory": 80000, "receivables": 84000, "cash": 350000, "total": 1014000},
    "liabilities": {"longtermLoans": 200000, "shorttermLoans": 0, "payables": 91700, "total": 291700},
    "equity": {"shareCapital": 298000, "retainedEarnings": 165550, "profitForRound": 258750, "total": 722300}
  },
  "marketShare": {
    "us": {"tech1": 22.5, "tech2": 18.3, "tech3": 0, "tech4": 0},
    "asia": {"tech1": 19.8, "tech2": 15.2, "tech3": 0, "tech4": 0},
    "europe": {"tech1": 20.1, "tech2": 16.5, "tech3": 0, "tech4": 0}
  },
  "ratios": {
    "roe": 35.8,
    "ros": 24.6,
    "eps": 8.68,
    "marketCap": 2500000,
    "sharePrice": 83.89,
    "peRatio": 9.67
  },
  "operational": {
    "hrEfficiency": 1.05,
    "hrTurnover": 7.2,
    "capacityUtilization": {"us": 85, "asia": 78},
    "demandFulfillment": {"us": 95, "asia": 88, "europe": 92}
  },
  "competitive": {
    "rank": 2,
    "tsr": 12.5,
    "revenueRank": 1,
    "profitRank": 3,
    "marketShareRank": 2
  }
}
```

---

## System Flow

### 1. Educator Creates Game

**Frontend (React):**
```javascript
POST /api/games/create
{
  name: "MBA Fall 2024",
  educatorEmail: "prof@uni.edu",
  noOfTeams: 5,
  noOfRounds: 3,
  practiceRounds: 1,
  roundDeadlines: [
    {round: 0, deadline: "2024-12-14T17:00:00", timezone: "America/New_York"},
    {round: 1, deadline: "2024-12-15T17:00:00", timezone: "America/New_York"},
    {round: 2, deadline: "2024-12-17T17:00:00", timezone: "America/New_York"},
    {round: 3, deadline: "2024-12-19T17:00:00", timezone: "America/New_York"}
  ],
  costEquation: "0.9,6,-0.85,1.5",
  hrStanWage: 2500,
  ... (other game parameters)
}
```

**Backend (Cloud Function or API):**
1. Generate game_code: `GAME001` (sequential or random)
2. Generate admin_pin: `ADMIN-XYZ123`
3. Generate team names (shuffle fruit array, take first N)
4. Generate team PINs: `PIN-XXXXX` (random 5-char alphanumeric)
5. Generate market parameters for all rounds (random realistic values)
6. Write to Google Sheets:
   - 1 row to `games` sheet
   - N rows to `teams` sheet (one per team)
   - N rows to `rounds` sheet (practice + real rounds)

**Response:**
```json
{
  gameCode: "GAME001",
  adminPin: "ADMIN-XYZ123",
  teams: [
    {teamNumber: 1, teamName: "Banana", teamPin: "PIN-A1B2C3"},
    {teamNumber: 2, teamName: "Coconut", teamPin: "PIN-D4E5F6"},
    {teamNumber: 3, teamName: "Cherry", teamPin: "PIN-G7H8I9"},
    {teamNumber: 4, teamName: "Carrot", teamPin: "PIN-J1K2L3"},
    {teamNumber: 5, teamName: "Durian", teamPin: "PIN-M4N5O6"}
  ],
  gameUrl: "https://bonopoly.com/play?game=GAME001"
}
```

---

### 2. Team Plays Game

**Login:**
```javascript
POST /api/auth/login
{
  gameCode: "GAME001",
  teamPin: "PIN-A1B2C3"
}
```

**Response:**
```json
{
  success: true,
  gameId: 1,
  teamId: 1,
  teamName: "Banana",
  currentRound: {
    roundId: 2,
    roundNumber: 1,
    isPractice: false,
    deadline: "2024-12-15T17:00:00",
    timeRemaining: "23:15:00",
    status: "active"
  },
  hasSubmitted: false
}
```

**Submit Decision:**
```javascript
POST /api/decisions/submit
{
  gameId: 1,
  teamId: 1,
  roundId: 2,
  decisions: {...all 7 decision areas...}
}
```

- Writes 1 row to `decisions` sheet with `submitted = TRUE`
- Locks team from editing (frontend enforced)

---

### 3. Automatic Round Calculation

**Scheduled Cloud Function (runs every 1 minute):**

```javascript
async function checkAndCalculateRounds() {
  // Get all active rounds past deadline
  const activeRounds = await getActiveRoundsPastDeadline();

  for (const round of activeRounds) {
    // Update status to "calculating"
    await updateRoundStatus(round.roundId, 'calculating');

    // Get all teams for this game
    const teams = await getTeamsByGame(round.gameId);

    // Get decisions for each team (or use defaults)
    const allDecisions = [];
    for (const team of teams) {
      let decision = await getTeamDecision(round.gameId, team.teamId, round.roundId);

      if (!decision || !decision.submitted) {
        // Team didn't submit - use defaults
        decision = getDefaultDecisions();

        // Write default decision to sheet
        await writeDecision(round.gameId, team.teamId, round.roundId, false, decision);
      }

      allDecisions.push({teamId: team.teamId, decisions: decision});
    }

    // Calculate competitive results
    const results = await calculateRoundResults(
      round.gameId,
      round.roundId,
      allDecisions,
      round.marketParams
    );

    // Write results for each team
    for (const teamResult of results) {
      await writeResult(round.gameId, teamResult.teamId, round.roundId, teamResult.results);
    }

    // Update round status to "completed"
    await updateRoundStatus(round.roundId, 'completed', new Date());

    // Activate next round (if exists)
    const nextRound = await getNextRound(round.gameId, round.roundNumber);
    if (nextRound) {
      await updateRoundStatus(nextRound.roundId, 'active');
    }
  }
}
```

---

### 4. View Results

**After calculation completes:**

```javascript
GET /api/results?gameId=1&teamId=1&roundId=2
```

**Response:**
```json
{
  teamName: "Banana",
  roundNumber: 1,
  results: {...full results_json...},
  teamRanking: 2,
  totalTeams: 5
}
```

---

## Key Technical Implementation

### Timezone Handling
- Educator enters deadline in their timezone
- Store timezone name (e.g., "America/New_York")
- Server converts to UTC for deadline checking
- Display to students in their local timezone

### Default Decision Logic
```javascript
function getDefaultDecisions() {
  return {
    production: {
      demandForecast: allZeros(),
      capacityAllocation: allZeros(),
      suppliers: {usPlant1: "supplier1"},
      outsourcing: allZeros()
    },
    hr: {employeeCount: 0, monthlySalary: 0, monthlyTrainingBudget: 0},
    rnd: {techDevelopment: allZeros(), featureDevelopment: allZeros(), licensing: allFalse()},
    investment: {newPlants: allZeros(), plantUpgrades: {}},
    logistics: {deliveryPriority: {fromUS: ["us","asia","europe"], fromAsia: ["asia","us","europe"]}},
    marketing: {products: {tech1: allZeroProduct()}},
    finance: {transferPricing: allOnes(), debt: allZeros(), equity: allZeros(), dividends: 0}
  };
}
```

### Market Parameter Generation
```javascript
function generateMarketParams(roundNumber, scenario) {
  // Random but realistic values based on ranges
  const markets = ['us', 'asia', 'europe'];
  const params = {};

  for (const market of markets) {
    params[market] = {
      demand_multiplier: randomBetween(0.8, 1.5),
      material_cost: randomBetween(400, 600),
      supplier1_cost: randomBetween(380, 450),
      supplier2_cost: randomBetween(400, 470),
      supplier3_cost: randomBetween(350, 420),
      supplier4_cost: randomBetween(420, 490),
      labour_cost: market === 'asia' ? randomBetween(1500, 2000) : randomBetween(2500, 3500),
      outsource_capacity: randomBetween(40000, 80000),
      outsource_cost: randomBetween(450, 550),
      tax_rate: randomBetween(0.20, 0.35),
      interest_rate: randomBetween(0.05, 0.15),
      short_interest_premium: randomBetween(0.01, 0.03),
      min_wage: market === 'asia' ? randomBetween(1000, 1500) : randomBetween(2000, 2500),
      tech1_dev_cost: randomBetween(40000, 60000),
      tech2_dev_cost: randomBetween(90000, 110000),
      tech3_dev_cost: randomBetween(140000, 160000),
      tech4_dev_cost: randomBetween(190000, 210000),
      feature1_cost: randomBetween(8000, 12000),
      feature2_cost: randomBetween(13000, 17000),
      feature3_cost: randomBetween(18000, 22000),
      feature4_cost: randomBetween(23000, 27000),
      tariff_rate: randomBetween(0.02, 0.08),
      transport_cost: randomBetween(40, 60),
      receivable_days: randomBetween(25, 35),
      payable_days: randomBetween(40, 50),
      exchange_rate: market === 'us' ? 1.0 : randomBetween(0.8, 1.2),
      csr_demand_impact: randomBetween(0.03, 0.07)
    };
  }

  return params;
}
```

---

## Summary: Why This is Simple

✅ **ONE Google Sheet** - Not multiple spreadsheets
✅ **5 sheets total** - games, teams, rounds, decisions, results
✅ **Set up ONCE** - No CSV imports per game
✅ **Auto-generate everything** - Game code, team names, PINs, market params
✅ **Append-only** - Just add rows, never complex updates
✅ **Cloud Function** - One scheduled job checks deadlines every minute
✅ **No real-time** - Simple polling or page refresh to check results

This matches your original PHP/MySQL system exactly, but using Google Sheets as the database!
