# Google Sheets Database Architecture - FINAL DESIGN

## Architecture Philosophy

**ONE Google Sheet = Entire Bonopoly Database**

Just like the original MySQL database stored all games, teams, rounds, and results in one database with multiple tables, our Google Sheets will have:

- **ONE Master Spreadsheet** containing all games
- **Multiple sheets** (tabs) acting as database tables
- **Rows** = Records
- **Columns** = Fields

This is MUCH simpler than "one spreadsheet per game" and matches the original architecture.

---

## Master Spreadsheet Structure

### Spreadsheet Name: `Bonopoly_Database`

Contains 12 sheets (tabs):

1. **Games** - All games created
2. **Teams** - All teams across all games
3. **Players** - All players (team members)
4. **Scenarios** - 8 predefined economic scenarios
5. **Parameters_Master** - Auto-generation rules (min/max ranges)
6. **Round_Assumptions** - Market conditions per round per game
7. **Team_Decisions** - All team decisions (1 row per team per round)
8. **Round_Results** - Calculated results (1 row per team per round)
9. **Market_Share** - Market share distribution per round
10. **Tech_Availability** - Network coverage progression
11. **Cost_Equations** - Cost formula parameters
12. **Audit_Log** - Track all changes for debugging

---

## Sheet 1: GAMES

**Purpose**: Store all games created by educators

**Columns** (35 columns):

| Column | Field Name | Type | Description | Example |
|--------|-----------|------|-------------|---------|
| A | `game_id` | String | Unique game ID (auto-generated) | `GAME_2024_001` |
| B | `game_code` | String | 6-char login code for students | `XY7K9M` |
| C | `educator_id` | String | Who created this game | `prof_john@university.edu` |
| D | `game_name` | String | Display name | `MBA Fall 2024 - Strategy` |
| E | `created_date` | Date | Creation timestamp | `2024-12-13 10:30:00` |
| F | `status` | Enum | `draft`, `active`, `completed`, `archived` | `active` |
| G | `no_of_teams` | Integer | Number of teams (1-5) | `5` |
| H | `no_of_rounds` | Integer | Total rounds (1-5) | `3` |
| I | `no_of_practice_rounds` | Integer | Practice rounds (0-2) | `1` |
| J | `hours_per_round` | Integer | Hours per round deadline | `48` |
| K | `current_round` | Integer | Which round is active | `2` |
| L | `cost_equation` | String | `a,b,c,d` parameters | `0.9,6,-0.85,1.5` |
| M | `hr_standard_wage` | Number | Base wage per worker | `3500` |
| N | `hr_standard_training` | Number | Training budget | `1000` |
| O | `hr_turnover_rate` | Number | Expected turnover % | `0.08` |
| P | `hr_manday_per_worker` | Number | Man-days per worker | `22` |
| Q | `hr_recruitment_cost` | Number | Cost to hire/fire | `500` |
| R | `hr_min_wage` | Number | Minimum wage | `2500` |
| S | `rnd_rate_reducing` | Number | Tech price decay % | `0.05` |
| T | `rnd_cost_per_feature` | Number | Cost per feature | `500000` |
| U | `rnd_tech1_cost` | Number | Tech 1 R&D cost | `5000000` |
| V | `rnd_tech2_cost` | Number | Tech 2 R&D cost | `10000000` |
| W | `rnd_tech3_cost` | Number | Tech 3 R&D cost | `15000000` |
| X | `rnd_tech4_cost` | Number | Tech 4 R&D cost | `20000000` |
| Y | `tech1_attractiveness` | Number | Tech 1 demand multiplier | `1.0` |
| Z | `tech2_attractiveness` | Number | Tech 2 demand multiplier | `1.3` |
| AA | `tech3_attractiveness` | Number | Tech 3 demand multiplier | `1.6` |
| AB | `tech4_attractiveness` | Number | Tech 4 demand multiplier | `2.0` |
| AC | `inventory_cost_per_unit` | Number | Holding cost | `50` |
| AD | `depreciation_rate` | Number | Annual depreciation | `0.10` |
| AE | `share_capital` | Number | Initial share capital ($M) | `100` |
| AF | `share_face_value` | Number | Face value per share | `10` |
| AG | `minimum_cash` | Number | Min cash balance ($M) | `5` |
| AH | `receivables_rate` | Number | Days sales outstanding | `0.30` |
| AI | `payables_rate` | Number | Days payable outstanding | `0.25` |
| AJ | `capacity_per_plant` | Number | Units per plant (thousands) | `500` |

**Example Row**:
```
GAME_2024_001 | XY7K9M | prof_john@edu | MBA Fall 2024 | 2024-12-13 10:30 | active | 5 | 3 | 1 | 48 | 1 | 0.9,6,-0.85,1.5 | 3500 | 1000 | 0.08 | 22 | 500 | 2500 | ...
```

---

## Sheet 2: TEAMS

**Purpose**: Store all teams across all games

**Columns** (15 columns):

| Column | Field Name | Type | Description | Example |
|--------|-----------|------|-------------|---------|
| A | `team_id` | String | Unique team ID | `TEAM_G001_01` |
| B | `game_id` | String | Which game (FK to Games) | `GAME_2024_001` |
| C | `team_number` | Integer | Team number within game (1-5) | `1` |
| D | `team_name` | String | Auto-generated name | `Banana` |
| E | `team_pin` | String | 4-digit login PIN | `1234` |
| F | `team_color` | String | Display color | `#FF5733` |
| G | `status` | Enum | `active`, `inactive`, `eliminated` | `active` |
| H | `total_members` | Integer | Number of players | `4` |
| I | `created_date` | Date | When team was created | `2024-12-13 10:31:00` |
| J | `last_login` | Date | Last login timestamp | `2024-12-14 15:20:00` |
| K | `rounds_submitted` | String | Comma-separated rounds | `0,1,2` |
| L | `current_rank` | Integer | Leaderboard position | `2` |
| M | `total_tsr` | Number | Cumulative TSR % | `25.5` |
| N | `total_market_cap` | Number | Current market cap ($M) | `150.5` |
| O | `notes` | String | Admin notes | `Strong performers` |

**Example Row**:
```
TEAM_G001_01 | GAME_2024_001 | 1 | Banana | 1234 | #FF5733 | active | 4 | 2024-12-13 10:31 | 2024-12-14 15:20 | 0,1,2 | 2 | 25.5 | 150.5 | Strong performers
```

---

## Sheet 3: PLAYERS

**Purpose**: Track individual team members

**Columns** (10 columns):

| Column | Field Name | Type | Description | Example |
|--------|-----------|------|-------------|---------|
| A | `player_id` | String | Unique player ID | `PLAYER_001` |
| B | `team_id` | String | Which team (FK to Teams) | `TEAM_G001_01` |
| C | `game_id` | String | Which game | `GAME_2024_001` |
| D | `player_name` | String | Student name | `John Smith` |
| E | `player_email` | String | Student email | `john.smith@university.edu` |
| F | `student_id` | String | University ID | `STU2024001` |
| G | `role` | String | Team role | `CEO`, `CFO`, `CMO` |
| H | `joined_date` | Date | When joined | `2024-12-13 10:35:00` |
| I | `last_active` | Date | Last activity | `2024-12-14 16:00:00` |
| J | `contribution_score` | Number | Activity metric | `85` |

**Example Row**:
```
PLAYER_001 | TEAM_G001_01 | GAME_2024_001 | John Smith | john.smith@edu | STU2024001 | CEO | 2024-12-13 10:35 | 2024-12-14 16:00 | 85
```

---

## Sheet 4: SCENARIOS

**Purpose**: 8 predefined economic scenarios (from Sample database.sql)

**Columns** (5 columns):

| Column | Field Name | Type | Description | Example |
|--------|-----------|------|-------------|---------|
| A | `scenario_id` | Integer | 1-8 | `1` |
| B | `scenario_name` | String | Short name | `Moderate Growth` |
| C | `description` | Text | Full description | `Future growth... double-digit economic expansion... Target: 10%` |
| D | `parameter_changes` | String | 29 comma-separated % changes | `10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10` |
| E | `demand_impact` | Number | Main demand effect % | `10` |

**Data** (8 rows - pre-populated):
```
1 | Moderate Growth | Future growth... | 10,10,10,... | 10
2 | Recession | Ebola outbreak... | -10,-10,-10,... | -10
3 | Stagnation | Protests barricade... | 0,0,0,... | 0
4 | Strong Boom | Growth even stronger... | 15,15,15,... | 15
5 | Modest Growth | Sustainable growth... | 5,5,5,... | 5
6 | Major Boom | Strongest growth... | 20,20,20,... | 20
7 | Major Recession | Duplicate of 2 | -10,-10,-10,... | -10
8 | Mixed Reality | Demand +15%, costs +5-7%... | 15,7,7,7,7,5,5,10,0,0,1,0,0,0,0,0,0,0,0,0,0,0,10,0,30,0,30,0,0 | 15
```

---

## Sheet 5: PARAMETERS_MASTER

**Purpose**: Auto-generation rules (min/max ranges from parameters_assumption table)

**Columns** (6 columns):

| Column | Field Name | Type | Description | Example |
|--------|-----------|------|-------------|---------|
| A | `param_id` | Integer | Parameter ID | `14` |
| B | `param_name` | String | Parameter name | `Marketshare_c1_r0` |
| C | `min_value` | Number | Minimum value | `30` |
| D | `max_value` | Number | Maximum value | `35` |
| E | `unit` | String | Unit of measurement | `%` |
| F | `description` | Text | What this parameter does | `US market share percentage` |

**Data** (~76 rows - pre-populated from Sample database.sql lines 8505-8577):
```
14 | Marketshare_c1_r0 | 30 | 35 | % | US market share
15 | Marketshare_c2_r0 | 40 | 45 | % | Asia market share
16 | Unitcost_direct_material | 10 | 20 | $ | Direct material cost per unit
63 | capacity_per_plant | 450 | 600 | units | Production capacity per plant
...
```

---

## Sheet 6: ROUND_ASSUMPTIONS

**Purpose**: Market conditions for each round of each game

**Columns** (40+ columns):

| Column | Field Name | Type | Description | Example |
|--------|-----------|------|-------------|---------|
| A | `assumption_id` | String | Unique ID | `ASS_G001_R01` |
| B | `game_id` | String | Which game | `GAME_2024_001` |
| C | `round` | Integer | Round number | `1` |
| D | `deadline` | DateTime | Submission deadline | `2024-12-15 17:00:00` |
| E | `scenario_us` | Integer | US scenario (1-8) | `4` |
| F | `scenario_asia` | Integer | Asia scenario (1-8) | `2` |
| G | `scenario_europe` | Integer | Europe scenario (1-8) | `3` |
| H | `us_market_demand` | Number | Total US demand (units) | `1721` |
| I | `asia_market_demand` | Number | Total Asia demand | `1539` |
| J | `europe_market_demand` | Number | Total Europe demand | `1069` |
| K | `us_params_json` | JSON String | All 29 US parameters | `{"demand_change":1.15,"material_cost":517.5,...}` |
| L | `asia_params_json` | JSON String | All 29 Asia parameters | `{"demand_change":0.90,"material_cost":360,...}` |
| M | `europe_params_json` | JSON String | All 29 Europe parameters | `{"demand_change":1.0,"material_cost":420,...}` |
| N | `tech_marketshare_us` | String | Tech split % in US | `100,0,0,0` |
| O | `tech_marketshare_asia` | String | Tech split % in Asia | `100,0,0,0` |
| P | `tech_marketshare_europe` | String | Tech split % in Europe | `100,0,0,0` |
| Q | `capacity_per_plant` | Number | Plant capacity (units) | `500000` |
| R | `status` | Enum | `pending`, `active`, `completed` | `active` |
| S | `teams_submitted` | String | Comma-separated team IDs | `TEAM_G001_01,TEAM_G001_02` |
| T | `calculated` | Boolean | Results calculated? | `FALSE` |
| U | `calculated_date` | DateTime | When calculated | `` |

**Example Row**:
```
ASS_G001_R01 | GAME_2024_001 | 1 | 2024-12-15 17:00 | 4 | 2 | 3 | 1721 | 1539 | 1069 | {"demand_change":1.15,...} | {"demand_change":0.90,...} | {"demand_change":1.0,...} | 100,0,0,0 | 100,0,0,0 | 100,0,0,0 | 500000 | active | TEAM_G001_01,TEAM_G001_02 | FALSE |
```

---

## Sheet 7: TEAM_DECISIONS

**Purpose**: All team decisions for all rounds (append-only log)

**Columns** (12 columns + 1 mega JSON):

| Column | Field Name | Type | Description | Example |
|--------|-----------|------|-------------|---------|
| A | `decision_id` | String | Unique ID | `DEC_G001_T01_R01` |
| B | `game_id` | String | Which game | `GAME_2024_001` |
| C | `team_id` | String | Which team | `TEAM_G001_01` |
| D | `round` | Integer | Round number | `1` |
| E | `submitted_date` | DateTime | When submitted | `2024-12-14 16:45:00` |
| F | `submitted_by` | String | Player who submitted | `PLAYER_001` |
| G | `version` | Integer | Submission version (if re-submitted) | `2` |
| H | `is_final` | Boolean | Is this the final version? | `TRUE` |
| I | `status` | Enum | `draft`, `submitted`, `calculated` | `submitted` |
| J | `decisions_json` | JSON | **ALL 7 decision areas as JSON** | See below |
| K | `validation_status` | String | `valid`, `warnings`, `errors` | `valid` |
| L | `validation_messages` | JSON Array | Validation feedback | `["Warning: Low cash"]` |
| M | `ip_address` | String | Submission IP (audit) | `192.168.1.1` |

**decisions_json Structure** (combines all 7 decision areas):
```json
{
  "production": {
    "us": {
      "demand_forecast_growth": 10,
      "tech1": {
        "own_production": 500,
        "outsourced": 100,
        "supplier": 1,
        "capacity_allocation": 95
      },
      "tech2": {
        "own_production": 200,
        "outsourced": 0,
        "supplier": 2,
        "capacity_allocation": 50
      }
    },
    "asia": { /* same structure */ },
    "europe": { /* same structure */ }
  },
  "hr": {
    "us": {
      "no_of_employees": 50,
      "avg_salary": 3500,
      "training_budget": 100000,
      "hiring": 5,
      "layoffs": 0
    },
    "asia": { /* same structure */ },
    "europe": { /* same structure */ }
  },
  "rnd": {
    "tech2_investment": 5000000,
    "tech3_investment": 0,
    "tech4_investment": 0,
    "feature_investments": [
      { "feature_id": 1, "amount": 500000 },
      { "feature_id": 2, "amount": 300000 }
    ]
  },
  "investment": {
    "us": {
      "new_plants": 1,
      "plant_cost": 50000000,
      "capacity_per_plant": 500000
    },
    "asia": { "new_plants": 0 },
    "europe": { "new_plants": 0 }
  },
  "logistics": {
    "us_to_asia": {
      "tech1_transfer": 0,
      "tech2_transfer": 0
    },
    "us_to_europe": {
      "tech1_transfer": 0,
      "tech2_transfer": 0
    },
    "asia_to_us": {
      "tech1_transfer": 0,
      "tech2_transfer": 0
    }
    /* ... all transfer routes */
  },
  "marketing": {
    "us": {
      "tech1": {
        "features": 5,
        "price": 1200,
        "promotion_percent": 10
      },
      "tech2": {
        "features": 7,
        "price": 1500,
        "promotion_percent": 15
      }
    },
    "asia": { /* same structure */ },
    "europe": { /* same structure */ }
  },
  "finance": {
    "longterm_loan_amount": 20000000,
    "longterm_loan_interest": 0.08,
    "dividend_payout": 0,
    "share_issue": 0,
    "transfer_pricing": {
      "us_to_asia": 1000,
      "us_to_europe": 1100
    }
  }
}
```

**Example Row**:
```
DEC_G001_T01_R01 | GAME_2024_001 | TEAM_G001_01 | 1 | 2024-12-14 16:45 | PLAYER_001 | 2 | TRUE | submitted | {decisions_json above} | valid | ["Warning: Low cash"] | 192.168.1.1
```

---

## Sheet 8: ROUND_RESULTS

**Purpose**: Calculated financial results for all teams

**Columns** (12 columns + 1 mega JSON):

| Column | Field Name | Type | Description | Example |
|--------|-----------|------|-------------|---------|
| A | `result_id` | String | Unique ID | `RES_G001_T01_R01` |
| B | `game_id` | String | Which game | `GAME_2024_001` |
| C | `team_id` | String | Which team | `TEAM_G001_01` |
| D | `round` | Integer | Round number | `1` |
| E | `calculated_date` | DateTime | When calculated | `2024-12-15 18:00:00` |
| F | `calculated_by` | String | Admin who triggered | `prof_john@edu` |
| G | `status` | Enum | `pending`, `calculated`, `published` | `published` |
| H | `results_json` | JSON | **ALL results** | See below |
| I | `total_revenue` | Number | Quick access (from JSON) | `10500000` |
| J | `profit_after_tax` | Number | Quick access (from JSON) | `2100000` |
| K | `market_cap` | Number | Quick access (from JSON) | `150500000` |
| L | `tsr_percent` | Number | Total shareholder return % | `18.5` |

**results_json Structure**:
```json
{
  "pnl": {
    "us": {
      "sales_revenue_tech1": 5000000,
      "sales_revenue_tech2": 2000000,
      "transfer_revenue": 0,
      "total_revenue": 7000000,
      "variable_cost": 3000000,
      "feature_cost": 500000,
      "transportation_cost": 300000,
      "promotion_cost": 400000,
      "admin_cost": 200000,
      "rnd_cost": 0,
      "import_cost": 0,
      "total_cost": 4400000,
      "ebitda": 2600000,
      "depreciation": 500000,
      "ebit": 2100000,
      "net_financing": 100000,
      "profit_before_tax": 2000000,
      "income_tax": 600000,
      "profit_after_tax": 1400000
    },
    "asia": { /* same structure */ },
    "europe": { /* same structure */ },
    "consolidated": {
      "total_revenue": 10500000,
      "total_cost": 6500000,
      "ebitda": 4000000,
      "ebit": 3500000,
      "profit_after_tax": 2100000
    }
  },
  "balance_sheet": {
    "assets": {
      "fixed_assets": 95000000,
      "inventory": 2000000,
      "receivables": 3150000,
      "cash": 8500000,
      "total_assets": 108650000
    },
    "equity": {
      "share_capital": 80000000,
      "retained_earnings": 2000000,
      "profit_for_round": 2100000,
      "other_equity": 0,
      "total_equity": 84100000
    },
    "liabilities": {
      "longterm_loans": 20000000,
      "shortterm_loans": 2000000,
      "payables": 2550000,
      "total_liabilities": 24550000
    },
    "total_shareholders_equity": 108650000
  },
  "ratios": {
    "market_cap": 150500000,
    "shares_outstanding": 8000000,
    "share_price_end": 18.81,
    "average_share_price": 17.50,
    "dividend": 0,
    "pe_ratio": 71.67,
    "cumulative_return": 18.5,
    "ebitda_margin": 0.381,
    "ebit_margin": 0.333,
    "ros": 0.200,
    "equity_ratio": 3.426,
    "net_debt_to_equity": 0.733,
    "roce": 0.143,
    "roe": 0.025,
    "eps": 0.2625
  },
  "market_share": {
    "us": {
      "tech1": { "demand": 500, "sales": 500, "share_percent": 20 },
      "tech2": { "demand": 200, "sales": 200, "share_percent": 15 }
    },
    "asia": { /* same structure */ },
    "europe": { /* same structure */ }
  },
  "production": {
    "us": {
      "capacity_total": 950000,
      "capacity_used": 700000,
      "capacity_utilization": 73.7,
      "own_production_tech1": 500000,
      "own_production_tech2": 200000,
      "outsourced_tech1": 0,
      "outsourced_tech2": 0
    },
    "asia": { /* same structure */ },
    "europe": { /* same structure */ }
  }
}
```

---

## Sheet 9: MARKET_SHARE

**Purpose**: Market share distribution per round (for analytics/charts)

**Columns** (15 columns):

| Column | Field Name | Type | Description | Example |
|--------|-----------|------|-------------|---------|
| A | `share_id` | String | Unique ID | `SHR_G001_R01_US_T01` |
| B | `game_id` | String | Which game | `GAME_2024_001` |
| C | `round` | Integer | Round number | `1` |
| D | `market` | Enum | `us`, `asia`, `europe` | `us` |
| E | `team_id` | String | Which team | `TEAM_G001_01` |
| F | `technology` | Enum | `tech1`, `tech2`, `tech3`, `tech4` | `tech1` |
| G | `demand_share` | Number | Potential demand | 520 |
| H | `actual_sales` | Number | Actual units sold | 500 |
| I | `market_share_percent` | Number | % of market | `20.0` |
| J | `lost_sales` | Number | Unfulfilled demand | 20 |
| K | `price` | Number | Price per unit | `1200` |
| L | `features` | Integer | Number of features | `5` |
| M | `promotion_percent` | Number | Promotion % | `10` |
| N | `attractiveness_score` | Number | Competitive score | `85.5` |
| O | `rank` | Integer | Market rank (1-5) | `2` |

**Example Rows** (5 rows per market per round = 15 rows per round for 5 teams):
```
SHR_G001_R01_US_T01 | GAME_2024_001 | 1 | us | TEAM_G001_01 | tech1 | 520 | 500 | 20.0 | 20 | 1200 | 5 | 10 | 85.5 | 2
SHR_G001_R01_US_T02 | GAME_2024_001 | 1 | us | TEAM_G001_02 | tech1 | 600 | 600 | 24.0 | 0 | 1150 | 6 | 15 | 92.3 | 1
...
```

---

## Sheet 10: TECH_AVAILABILITY

**Purpose**: Network coverage progression (from game.php tech availability arrays)

**Columns** (8 columns):

| Column | Field Name | Type | Description | Example |
|--------|-----------|------|-------------|---------|
| A | `availability_id` | String | Unique ID | `TECH_G001_R01_US_T2` |
| B | `game_id` | String | Which game | `GAME_2024_001` |
| C | `round` | Integer | Round number | `1` |
| D | `market` | Enum | `us`, `asia`, `europe` | `us` |
| E | `tech1_coverage` | Number | % coverage | `80` |
| F | `tech2_coverage` | Number | % coverage | `35` |
| G | `tech3_coverage` | Number | % coverage | `0` |
| H | `tech4_coverage` | Number | % coverage | `0` |

**Example Rows** (3 rows per round - one per market):
```
TECH_G001_R01_US | GAME_2024_001 | 1 | us | 80 | 35 | 0 | 0
TECH_G001_R01_ASIA | GAME_2024_001 | 1 | asia | 90 | 25 | 0 | 0
TECH_G001_R01_EU | GAME_2024_001 | 1 | europe | 85 | 30 | 0 | 0
```

---

## Sheet 11: COST_EQUATIONS

**Purpose**: Cost formula parameters (can vary by game if needed)

**Columns** (6 columns):

| Column | Field Name | Type | Description | Example |
|--------|-----------|------|-------------|---------|
| A | `equation_id` | String | Unique ID | `COST_G001` |
| B | `game_id` | String | Which game | `GAME_2024_001` |
| C | `a` | Number | a parameter | `0.9` |
| D | `b` | Number | b parameter | `6` |
| E | `c` | Number | c parameter | `-0.85` |
| F | `d` | Number | d parameter | `1.5` |

**Formula**: `Cost = (1 + Promotion) × [a × capacity^b + c × capacity + d]`

---

## Sheet 12: AUDIT_LOG

**Purpose**: Track all changes for debugging and security

**Columns** (9 columns):

| Column | Field Name | Type | Description | Example |
|--------|-----------|------|-------------|---------|
| A | `log_id` | String | Unique ID | `LOG_0001` |
| B | `timestamp` | DateTime | When | `2024-12-14 16:45:30` |
| C | `user_id` | String | Who | `PLAYER_001` |
| D | `action` | Enum | `create`, `update`, `delete`, `submit`, `calculate` | `submit` |
| E | `entity_type` | String | What was changed | `team_decision` |
| F | `entity_id` | String | Which record | `DEC_G001_T01_R01` |
| G | `changes_json` | JSON | What changed | `{"version":"1->2"}` |
| H | `ip_address` | String | From where | `192.168.1.1` |
| I | `user_agent` | String | Browser/device | `Chrome 120 / Windows 10` |

---

## Data Flow & API Access Patterns

### Game Creation Flow:
```
1. Educator clicks "Create Game"
2. React form collects: name, teams, rounds
3. System auto-generates:
   - game_id, game_code
   - 5 team names (shuffled fruit array)
   - 5 team PINs (random 4-digit)
   - Base parameters (from Parameters_Master min/max)
   - All rounds (0 to N) with random scenarios
4. Write to Sheets:
   - 1 row to Games
   - 5 rows to Teams
   - N+1 rows to Round_Assumptions
   - 3×(N+1) rows to Tech_Availability
5. Return game_code to educator
```

### Team Login Flow:
```
1. Student enters: game_code + team_pin
2. React fetches from Sheets:
   - Games WHERE game_code = input
   - Teams WHERE game_id = above AND team_pin = input
3. If match:
   - Store in localStorage
   - Redirect to dashboard
4. Fetch current round data:
   - Round_Assumptions WHERE game_id AND round = current
```

### Decision Submission Flow:
```
1. Team works on decisions (localStorage auto-save every 30s)
2. Click "Submit"
3. Validation (client-side + optional server-side)
4. Append 1 row to Team_Decisions:
   - decision_id
   - All 7 decision areas as JSON
   - submitted_date, submitted_by, is_final=TRUE
5. Update Teams.rounds_submitted
6. Append 1 row to Audit_Log
```

### Round Calculation Flow:
```
1. Admin clicks "Calculate Round X"
2. Fetch from Sheets:
   - Team_Decisions WHERE game_id AND round=X AND is_final=TRUE
   - Round_Assumptions WHERE game_id AND round=X
3. Run calculations (TypeScript):
   - Competitive market share distribution
   - Sales per team
   - P&L, Balance Sheet, Ratios
4. Write to Sheets:
   - 5 rows to Round_Results (one per team)
   - 15 rows to Market_Share (3 markets × 5 teams)
5. Update Round_Assumptions.calculated=TRUE
6. Append 1 row to Audit_Log
```

### Results Display Flow:
```
1. Team views "Round X Results"
2. Fetch from Sheets:
   - Round_Results WHERE team_id AND round=X
   - Market_Share WHERE team_id AND round=X
3. Parse results_json
4. Display:
   - P&L Statement
   - Balance Sheet
   - Charts (market share, TSR)
   - Rankings
```

---

## Google Sheets API Optimization

### Batch Reading (reduce API calls):
```javascript
// Instead of 12 separate reads, batch into 1 call:
const response = await sheets.spreadsheets.values.batchGet({
  spreadsheetId: BONOPOLY_SPREADSHEET_ID,
  ranges: [
    'Games!A2:AJ',
    'Teams!A2:O',
    'Scenarios!A2:E',
    'Round_Assumptions!A2:U',
    'Team_Decisions!A2:M',
    'Round_Results!A2:L'
  ]
})

// Get all data in one API call!
const [games, teams, scenarios, rounds, decisions, results] = response.data.valueRanges
```

### Caching Strategy:
```javascript
// Cache static data (5-minute cache):
- Scenarios (never changes)
- Parameters_Master (rarely changes)
- Tech_Availability (changes per round)

// Cache game data (1-minute cache):
- Games, Teams, Players

// Real-time data (no cache):
- Team_Decisions (latest version)
- Round_Results (just calculated)

// Cache invalidation triggers:
- New game created → Invalidate Games cache
- Round calculated → Invalidate Round_Results cache
- Team submits → Invalidate Team_Decisions cache
```

### Write Batching:
```javascript
// When creating game, batch all writes:
const batchUpdate = {
  data: [
    {
      range: 'Games!A:AJ',
      values: [gameRow]
    },
    {
      range: 'Teams!A:O',
      values: [team1Row, team2Row, team3Row, team4Row, team5Row]
    },
    {
      range: 'Round_Assumptions!A:U',
      values: [round0Row, round1Row, round2Row, round3Row]
    }
  ],
  valueInputOption: 'RAW'
}

await sheets.spreadsheets.values.batchUpdate({
  spreadsheetId: BONOPOLY_SPREADSHEET_ID,
  resource: batchUpdate
})

// 1 API call instead of 10+!
```

---

## Summary: Why This Architecture Works

### ✅ Advantages:
1. **One source of truth**: All games in one place (like MySQL)
2. **Simple queries**: Filter by game_id, team_id, round
3. **Append-only logs**: Team_Decisions, Round_Results never deleted (audit trail)
4. **JSON flexibility**: Complex nested data (decisions, results) compressed into single cells
5. **Batch operations**: 1 API call to read/write multiple sheets
6. **Scalable**: Can handle 100+ games easily (Google Sheets supports 10M cells)
7. **Educator-friendly**: Can manually inspect/fix data in Google Sheets UI
8. **Export-ready**: Easy to download as CSV/Excel for analysis

### 🎯 Rate Limit Safety:
- **Game creation**: 1 batch write (3 sheets) = 1 API call
- **Team submission**: 1 append = 1 API call
- **Round calculation**: 1 batch write (2 sheets) = 1 API call
- **Results viewing**: 1 batch read (6 sheets) = 1 API call

**Total for 5 teams, 1 round:**
- 5 submissions = 5 API calls
- 1 calculation = 1 API call
- **Total = 6 API calls** (well under 60/min limit!)

### 🚀 Next Steps:
1. Create the actual Google Spreadsheet template
2. Build React services to interface with Sheets API
3. Implement calculation engine (TypeScript)
4. Build decision forms
5. Build results display components

This is the complete, production-ready architecture! 🎯
