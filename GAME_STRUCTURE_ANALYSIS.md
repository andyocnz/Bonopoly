# Bonopoly Game Structure Analysis

## Current PHP/MySQL Structure

### Key Tables:

#### 1. `game` Table - Game Configuration (27 fields!)
```
Fields:
- id, name, mod_id (teacher/instructor)
- no_of_teams (currently max 15, we'll do max 5)
- no_of_rounds (currently varies, we'll do max 5)
- hours_per_round (time limit per round)
- cost_equation (e.g., "0.9,6,-0.85,1.5" for cost multiplier formula)
- hr_stan_wage, hr_standard_training_budget
- hr_standard_turnover_rate, hr_manday_per_worker
- hr_recruitment_layoff_cost
- rate_of_tech_price_reduce
- inventory_cost_per_uni
- depreciation_rate
- receivable, payable (percentages)
- share_capital, share_face_value
- tech_avai_c1, tech_avai_c2, tech_avai_c3 (PHP serialized arrays!)
- min_cash
- practice_round (number of practice rounds)
```

**Example `tech_avai_c1` (US tech availability by round):**
```php
a:4:{
  s:5:"tech1";s:44:"70,80,90,100,100,100,100,100,100,100,100,100";
  s:5:"tech2";s:35:"20,25,30,60,65,70,71,72,73,74,75,76";
  s:5:"tech3";s:33:"0,0,10,15,19,25,30,35,40,45,65,65";
  s:5:"tech4";s:34:"0,10,15,25,40,45,50,55,60,65,65,65";
}
```
This means:
- Tech 1 available at 70% in round 1, 80% in round 2, 90% in round 3, 100% after
- Tech 2 starts at 20%, grows to 76%
- Tech 3 starts at 0% (not available), then 10%, etc.
- Tech 4 similar progression

#### 2. `round_assumption` Table - Market Conditions Per Round
```
Fields:
- id, game_id, mod_id, round
- scenario_id (e.g., "4,3,1")
- deadline (datetime string)
- country1, country2, country3 (HUGE CSV strings with 26+ values!)
- t_marketshare_c1, t_marketshare_c2, t_marketshare_c3
- cap_per_plant (capacity per plant, e.g., 1200 units)
```

**Example `country1` CSV (26 values):**
```
1,13,5,9,12,15,8,616,25,5,9,112,297,470,566,174,1564,12,13,5,55,5,154,10,2,1
```

Mapping (from PHP code analysis):
1. change_in_demand
2. unitcost_material
3. supplier1 (cost)
4. supplier2
5. supplier3
6. supplier4
7. labour_cost
8. outsource_capacity
9. tax_rate
10. interest_rate
11. min_wage
12-15. cost_tech1, cost_tech2, cost_tech3, cost_tech4
16-19. feature_cost1-4
20. tariff
21. transportation_cost
22. receivables_rate
23-26. ? (need to verify)

#### 3. `team` Table
```
Fields:
- id, name, mod_id, game_id
```

#### 4. `player` Table
```
Fields:
- id, email, password, team_id, game_id
```

#### 5. `input` Table - Team Decisions
```
Fields:
- id, assumption_id, game_id, team_id, round
- country1, country2, country3 (serialized arrays with ALL decisions)
- logistic_order (delivery priorities)
- transfer_price (transfer pricing multipliers)
- fin_longterm_debt, fin_shareissue, fin_dividends
- investment_c1, investment_c2 (new plants)
```

**Example decision structure** (from PHP):
The `country1/2/3` fields contain comma-separated values for:
- demand_forecast (by tech)
- capacity_allocation (by tech)
- supplier selection
- outsourcing %
- HR decisions (employees, salary, training)
- R&D investments
- Marketing (features, price, promotion)

#### 6. `output` Table - Round Results
```
Fields:
- id, game_id, team_id, round
- output_c1, output_c2, output_c3 (CSV strings with 50+ calculated values!)
- factory, tech, hr_efficiency_rate
- demand_c1, demand_c2, demand_c3
- tmarketshare_c1, tmarketshare_c2, tmarketshare_c3
- hr_turnover, inventory_c1, inventory_c2
- ucost_inven1, ucost_inven2
- feature
- final (0 or 1, whether result is final)
```

---

## Problems with Current Structure

### 🔴 **Major Issues:**

1. **PHP Serialized Data** - Can't use in Google Sheets!
   - `tech_avai_c1` uses PHP serialize()
   - Need to convert to JSON

2. **Giant CSV Strings** - 26 values in one field!
   - `country1/2/3` in round_assumption
   - `country1/2/3` in input
   - `output_c1/2/3` with 50+ values
   - Hard to edit in Sheets

3. **Too Many Game Parameters** - 27 fields in `game` table!
   - Most are defaults that rarely change
   - Should use a template system

4. **No Clear Schema** - CSV field order is undocumented
   - Hard to maintain
   - Easy to make mistakes

---

## Proposed Simplified Structure for Google Sheets

### **Sheet 1: Game_Config**
Simplified to essential settings:
```
| setting_key              | setting_value                 |
|--------------------------|-------------------------------|
| game_id                  | game123                       |
| game_name                | Business Sim Fall 2024        |
| no_of_teams              | 5                             |
| no_of_rounds             | 3                             |
| cost_equation            | 0.9,6,-0.85,1.5              |
| depreciation_rate        | 9                             |
| min_cash                 | 3851000                       |
| initial_share_capital    | 298000                        |
| share_face_value         | 10                            |
```

### **Sheet 2: Game_Parameters** (Defaults - rarely changed)
```
| parameter_key                | value |
|------------------------------|-------|
| hr_standard_wage             | 21    |
| hr_standard_training_budget  | 1     |
| hr_standard_turnover_rate    | 6     |
| hr_manday_per_worker         | 273   |
| hr_recruitment_layoff_cost   | 52    |
| inventory_cost_per_unit      | 6     |
| receivable_rate              | 8     |
| payable_rate                 | 14    |
```

### **Sheet 3: Tech_Availability** (One row per round per tech per market)
```
| round | market | tech1 | tech2 | tech3 | tech4 |
|-------|--------|-------|-------|-------|-------|
| 1     | US     | 70    | 20    | 0     | 0     |
| 2     | US     | 80    | 25    | 0     | 10    |
| 3     | US     | 90    | 30    | 10    | 15    |
| 1     | Asia   | 100   | 0     | 0     | 0     |
| 2     | Asia   | 100   | 20    | 0     | 0     |
| 3     | Asia   | 100   | 30    | 10    | 0     |
| 1     | Europe | 90    | 0     | 0     | 0     |
| 2     | Europe | 100   | 15    | 0     | 0     |
| 3     | Europe | 100   | 30    | 0     | 20    |
```

### **Sheet 4: Round_Market_Conditions** (Simplified from 26 CSV values)
One row per round per market:
```
| round | market | demand_change | material_cost | labour_cost | tax_rate | interest_rate | tariff | transport_cost |
|-------|--------|---------------|---------------|-------------|----------|---------------|--------|----------------|
| 1     | US     | 1.0           | 13            | 8           | 25       | 5             | 55     | 5              |
| 1     | Asia   | 1.0           | 10.53         | 6.48        | 12       | 6             | 21     | 2              |
| 1     | Europe | 1.0           | 0             | 0           | 24       | 5             | 0      | 0              |
```

Additional columns for tech costs, supplier costs, etc.

### **Sheet 5: Teams**
```
| team_id | team_name      | login_code | members                    |
|---------|----------------|------------|----------------------------|
| team1   | Team Alpha     | ALPHA2024  | John, Mary, Bob           |
| team2   | Team Beta      | BETA2024   | Alice, Tom, Sarah         |
| team3   | Team Gamma     | GAMMA2024  | Mike, Lisa, Dave          |
```

### **Sheet 6: Team_Decisions** (✅ This is the KEY one!)
One row per team per round, with **JSON** in one column:
```
| round | team_id | timestamp           | status    | decisions_json                          |
|-------|---------|---------------------|-----------|----------------------------------------|
| 1     | team1   | 2024-12-13 14:30:00 | draft     | {"production":{...}, "hr":{...}, ...}  |
| 1     | team1   | 2024-12-13 16:45:00 | submitted | {"production":{...}, "hr":{...}, ...}  |
| 1     | team2   | 2024-12-13 15:20:00 | draft     | {"production":{...}, "hr":{...}, ...}  |
```

**decisions_json structure:**
```json
{
  "production": {
    "demandForecast": {
      "us": {"tech1": 1000, "tech2": 500, "tech3": 0, "tech4": 0},
      "asia": {"tech1": 800, "tech2": 300, "tech3": 0, "tech4": 0},
      "europe": {"tech1": 600, "tech2": 200, "tech3": 0, "tech4": 0}
    },
    "capacityAllocation": {
      "us": {"tech1": 80, "tech2": 20, "tech3": 0, "tech4": 0},
      "asia": {"tech1": 70, "tech2": 30, "tech3": 0, "tech4": 0}
    },
    "suppliers": {"plant1": "supplier1", "plant2": "supplier2"},
    "outsourcing": {"plant1": 0, "plant2": 10}
  },
  "hr": {
    "employeeCount": 100,
    "monthlySalary": 2500,
    "monthlyTrainingBudget": 50000
  },
  "rnd": {
    "techInvestments": {"tech1": 0, "tech2": 100000, "tech3": 50000, "tech4": 0},
    "featureInvestments": {"feature1": 20000, "feature2": 15000},
    "licensing": {"tech3": true}
  },
  "investment": {
    "newPlants": {"us": 0, "asia": 1}
  },
  "logistics": {
    "deliveryPriority": {
      "usPlants": ["us", "europe", "asia"],
      "asiaPlants": ["asia", "us", "europe"]
    }
  },
  "marketing": {
    "products": {
      "tech1": {
        "features": 5,
        "price": {"us": 350, "asia": 300, "europe": 380},
        "promotion": {"us": 10, "asia": 5, "europe": 8}
      },
      "tech2": {
        "features": 7,
        "price": {"us": 450, "asia": 400, "europe": 480},
        "promotion": {"us": 12, "asia": 6, "europe": 10}
      }
    }
  },
  "finance": {
    "transferPricing": {"us": 1.2, "asia": 1.5, "europe": 1.3},
    "longtermDebt": 50000,
    "shareIssuance": 0,
    "dividends": 10000
  }
}
```

### **Sheet 7: Round_Results** (Calculated by system)
```
| round | team_id | timestamp           | results_json                           |
|-------|---------|---------------------|----------------------------------------|
| 1     | team1   | 2024-12-13 17:00:00 | {"pnl":{...}, "balanceSheet":{...}}  |
| 1     | team2   | 2024-12-13 17:00:00 | {"pnl":{...}, "balanceSheet":{...}}  |
```

---

## Recommendations

### ✅ **What to Keep:**
- Round-based structure
- 7 decision areas
- 3 markets (US, Asia, Europe)
- 4 technologies
- Complex calculations (P&L, Balance Sheet)

### 🔄 **What to Simplify:**
1. **Convert PHP serialized → JSON** (everywhere!)
2. **Split giant CSV strings** into proper columns or JSON
3. **Reduce game parameters** - use templates for defaults
4. **Clear schema** - document JSON structures
5. **One decision row per team per round** (not 3 country fields)

### ❌ **What to Remove/Change:**
- PHP serialize format
- Undocumented CSV field orders
- 26-value CSV strings
- Separate country1/2/3 fields (merge into JSON)

### 🆕 **What to Add:**
- **status** field ("draft" vs "submitted")
- **login_code** for teams (instead of player table)
- Clear JSON schemas
- Validation rules

---

## Questions for You:

1. **Do we need ALL these parameters?** Many seem unused or could use defaults.
2. **Do we really need supplier selection?** Or can we simplify production?
3. **What's the minimum viable game?** Can we start with just 2-3 decision areas?
4. **Tech availability progression** - Is this important or can we simplify?

---

## Next Steps:

1. ✅ Understand current structure (DONE - this doc)
2. ⏳ **YOU REVIEW** - Tell me what to keep/remove/simplify
3. Create simplified Google Sheets template
4. Port calculation formulas (starting with simple P&L)
5. Build decision forms

**Let me know what you think!** Should we simplify further or keep the complexity?
