# Bonopoly - Actual System Workflow

## Critical Understanding from Original PHP System

### Educator Workflow (No Login Required)

1. **Go to website** → "Create New Game" page
2. **Fill form with:**
   - Game name (e.g., "MBA Class Fall 2024")
   - Educator email (for notifications)
   - Number of teams (1-5)
   - Number of rounds (1-5, typically 3)
   - Number of practice rounds (0-2, typically 1)
   - Deadline for each round (date + time)
   - General game parameters (cost equation, depreciation rate, etc.)

3. **Click "Create Game"**

4. **System automatically generates:**
   - ✅ Game code (e.g., "GAME001")
   - ✅ Admin PIN (to monitor game progress)
   - ✅ Team names: "Team 1", "Team 2", "Team 3", etc.
   - ✅ Team PINs: Unique code for each team
   - ✅ Market conditions for ALL rounds (randomly generated realistic values)
     - 26 market parameters × 3 markets × number of rounds
     - Different scenarios per round (growth, recession, stable, etc.)
   - ✅ Technology availability progression across rounds
   - ✅ Practice round(s) + Real rounds

5. **System displays:**
   - Game code: `GAME001`
   - Admin PIN: `ADMIN-XYZ123`
   - Team access codes:
     ```
     Team 1: PIN-ABC111
     Team 2: PIN-ABC222
     Team 3: PIN-ABC333
     Team 4: PIN-ABC444
     Team 5: PIN-ABC555
     ```

6. **Educator shares with students:**
   - Game URL: `https://bonopoly.com/play`
   - Game code: `GAME001`
   - Each team gets their own PIN

---

## Student/Team Workflow

1. **Go to** `https://bonopoly.com/play`
2. **Enter:**
   - Game code: `GAME001`
   - Team PIN: `PIN-ABC111`
3. **System shows:**
   - Game name
   - Current round (Practice Round / Round 1 / Round 2...)
   - Deadline countdown
   - Team dashboard

### Practice Round (Optional)
- **Purpose**: Let students learn the interface
- **Impact**: Does NOT affect starting position for real rounds
- **Results**: Calculated and shown, but don't carry over
- **Default starting position**: All teams start Round 1 with same initial conditions

### Real Rounds (Round 1, 2, 3...)

**Before Deadline:**
1. Team fills decision forms (7 areas: Production, HR, R&D, Investment, Logistics, Marketing, Finance)
2. Can save draft and edit multiple times
3. Click "Submit Final Decision" when ready
4. Forms lock after submission (can't change)

**If team doesn't submit by deadline:**
- System uses **default values** (predefined "do nothing" decisions)
- Team still participates in round with defaults

**At deadline (automatic):**
1. System checks: `current_time > deadline`
2. Collects all team decisions (submitted + defaults for missing teams)
3. **Automatically calculates results** for all teams:
   - P&L statements
   - Balance sheets
   - Market share distribution (competitive - depends on ALL teams)
   - Financial ratios
   - Rankings
4. **Immediately publishes results** to all teams
5. Next round begins (if any rounds remaining)

---

## Admin Monitoring (Educator)

**Access:** `https://bonopoly.com/admin`
- Enter: Game code + Admin PIN

**Can see:**
- Which teams submitted decisions ✅
- Which teams haven't submitted ⏳
- Current round status
- Time until deadline
- Button: "Calculate Now" (manual trigger before deadline if needed)
- View all results after calculation
- Export data (CSV, Excel)

---

## Data Storage Strategy (Simplified)

### ONE Google Sheet = "Bonopoly Master Database"

**Sheet 1: games**
```
game_id | game_code | admin_pin | name | educator_email | no_of_teams | no_of_rounds | practice_rounds | created_at | settings_json
```
Example:
```
1 | GAME001 | ADMIN-XYZ | MBA Fall 2024 | prof@uni.edu | 5 | 3 | 1 | 2024-12-13 | {"cost_equation":"0.9,6,-0.85,1.5",...}
```

**Sheet 2: teams**
```
team_id | game_id | team_number | team_name | team_pin | created_at
```
Example:
```
1 | 1 | 1 | Team 1 | PIN-ABC111 | 2024-12-13
2 | 1 | 2 | Team 2 | PIN-ABC222 | 2024-12-13
3 | 1 | 3 | Team 3 | PIN-ABC333 | 2024-12-13
```

**Sheet 3: rounds**
```
round_id | game_id | round_number | is_practice | deadline | status | market_params_json
```
Example:
```
1 | 1 | 0 | TRUE  | 2024-12-14 17:00 | completed | {"us":{...26 params...}, "asia":{...}, "europe":{...}}
2 | 1 | 1 | FALSE | 2024-12-15 17:00 | active    | {...}
3 | 1 | 2 | FALSE | 2024-12-17 17:00 | pending   | {...}
4 | 1 | 3 | FALSE | 2024-12-19 17:00 | pending   | {...}
```

**Sheet 4: decisions**
```
decision_id | game_id | team_id | round_id | submitted | timestamp | decisions_json
```
Example:
```
1 | 1 | 1 | 2 | TRUE  | 2024-12-15 16:45 | {"production":{...}, "hr":{...}, "rnd":{...}, ...}
2 | 1 | 2 | 2 | FALSE | 2024-12-15 17:01 | {"production":{defaults}, "hr":{defaults}, ...}
```

**Sheet 5: results**
```
result_id | game_id | team_id | round_id | calculated_at | results_json
```
Example:
```
1 | 1 | 1 | 2 | 2024-12-15 17:01 | {"pnl":{...}, "balanceSheet":{...}, "marketShare":{...}, "rank":2}
```

---

## Key Technical Requirements

### 1. Automatic Round Calculation
- **Trigger**: Cloud Function or scheduled job every 1 minute
- **Logic**:
  ```javascript
  for each round where (status === 'active' && now > deadline):
    1. Mark round status = 'calculating'
    2. Fetch all team decisions for this round
    3. For teams without submission: use default decisions
    4. Run competitive calculations (market share distribution)
    5. Calculate P&L, Balance Sheet, Ratios for each team
    6. Write results to Sheet 5
    7. Mark round status = 'completed'
    8. If next round exists: Mark next round status = 'active'
  ```

### 2. Default Decisions
When team doesn't submit, use these defaults:
```json
{
  "production": {
    "demandForecast": {"us": {"tech1": 0, "tech2": 0}, "asia": {...}, "europe": {...}},
    "capacityAllocation": {same as previous round or 0},
    "suppliers": {same as previous round},
    "outsourcing": {"us": 0, "asia": 0}
  },
  "hr": {
    "employeeCount": {same as previous round},
    "monthlySalary": {same as previous round},
    "monthlyTrainingBudget": 0
  },
  "rnd": {"techDevelopment": {all 0}, "featureDevelopment": {all 0}},
  "investment": {"newPlants": {"us": 0, "asia": 0}},
  "logistics": {same as previous round},
  "marketing": {
    "products": {
      "tech1": {"features": {same}, "pricing": {same}, "promotion": {all 0}},
      "tech2": {...}
    }
  },
  "finance": {
    "transferPricing": {same as previous round},
    "debt": {borrowing: 0, repayment: 0},
    "equity": {issuance: 0, buyback: 0},
    "dividends": 0
  }
}
```

### 3. Market Condition Generation
When game is created, system generates realistic random values:
```javascript
for each round:
  for each market (us, asia, europe):
    generate 26 parameters:
      - demand_multiplier: random between scenario ranges
      - material_cost: base_cost × (1 + random(-10%, +10%))
      - labour_cost: varies by market
      - tax_rate: 20-35%
      - interest_rate: 5-15%
      - etc.
```

### 4. Practice Round Handling
- Practice round: `round_number = 0`, `is_practice = TRUE`
- Calculated normally (so students see results)
- Results do NOT affect Round 1 starting position
- All teams start Round 1 with identical initial conditions:
  - Cash: $10,000,000
  - Share capital: $10,000,000
  - No plants, no inventory, no employees
  - Must build from scratch

---

## Questions to Confirm

1. **Practice round results**: Are they calculated and shown? (I assume YES based on code)

2. **Default decisions**: Do they use "same as previous round" or all zeros? (Need to check PHP logic)

3. **Round auto-start**: After Round 1 calculation completes, does Round 2 immediately become active? (I assume YES)

4. **Market generation**: Are scenarios pre-defined templates (Scenario 1, 2, 3) or fully random? (Looks like random based on ranges)

5. **Team names**: Are they always "Team 1", "Team 2" or can educator customize? (I assume auto-generated "Team 1, 2, 3...")

6. **Admin PIN vs Team PIN**: Admin PIN is for monitoring only (read-only)? Can't submit decisions? (I assume YES)

Please confirm these assumptions and I'll finalize the architecture!
