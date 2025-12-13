# Bonopoly Google Sheets Structure - FULL FEATURED VERSION

## Philosophy: Keep ALL Features, Improve Organization

This is a **university-level business simulation** that teaches:
- Strategic decision-making across 7 business areas
- Understanding of financial statements and ratios
- Competitive market dynamics
- Temporal effects (investment lags, R&D delays, learning curves)
- Trade-offs and optimization

**We MUST keep all complexity!** We just organize it better.

---

## Google Sheets Structure (One Spreadsheet per Game)

### **Sheet 1: Game_Settings**
Core game configuration (one row, transpose it for easy editing):

| Setting                      | Value          | Description                                    |
|------------------------------|----------------|------------------------------------------------|
| game_id                      | game_001       | Unique game identifier                         |
| game_name                    | Fall 2024 Sim  | Display name                                   |
| instructor_email             | prof@uni.edu   | Admin access                                   |
| no_of_teams                  | 5              | Number of competing teams (max 5)             |
| no_of_rounds                 | 3              | Total rounds (max 5, typically 3)             |
| practice_rounds              | 0              | Practice rounds before real game              |
| hours_per_round              | 48             | Deadline time per round (hours)               |
| cost_equation                | 0.9,6,-0.85,1.5| Cost multiplier formula: a,b,c,d              |
| depreciation_rate            | 9              | % per round                                   |
| min_cash                     | 3851000        | Minimum cash requirement (USD)                |
| initial_share_capital        | 298000         | Starting equity (USD)                         |
| share_face_value             | 10             | Par value per share                           |
| capacity_per_plant           | 1200           | Units per plant per round                     |

### **Sheet 2: Game_Parameters**
Default parameters (rarely changed by instructor):

| Category | Parameter                    | Value | Unit    |
|----------|------------------------------|-------|---------|
| HR       | standard_wage                | 21    | USD/hr  |
| HR       | standard_training_budget     | 1     | USD/emp |
| HR       | standard_turnover_rate       | 6     | %       |
| HR       | manday_per_worker            | 273   | days    |
| HR       | recruitment_layoff_cost      | 52    | USD     |
| Finance  | receivable_rate              | 8     | %       |
| Finance  | payable_rate                 | 14    | %       |
| Inventory| cost_per_unit               | 6     | USD     |
| R&D      | tech_price_reduce_rate       | 11    | %/round |

### **Sheet 3: Tech_Network_Coverage**
Technology infrastructure availability by round (% of market with network coverage):

| Round | Market | Tech1 | Tech2 | Tech3 | Tech4 | Notes                          |
|-------|--------|-------|-------|-------|-------|--------------------------------|
| 1     | US     | 70    | 20    | 0     | 0     | Tech1 established, Tech2 early |
| 2     | US     | 80    | 25    | 0     | 10    | Tech2 growing, Tech4 emerging  |
| 3     | US     | 90    | 30    | 10    | 15    | Tech3 launches                 |
| 4     | US     | 100   | 60    | 15    | 25    |                                |
| 5     | US     | 100   | 65    | 19    | 40    |                                |
| 1     | Asia   | 100   | 0     | 0     | 0     | Tech1 dominant                 |
| 2     | Asia   | 100   | 20    | 0     | 0     | Tech2 enters                   |
| 3     | Asia   | 100   | 30    | 10    | 0     |                                |
| 4     | Asia   | 100   | 40    | 30    | 0     |                                |
| 5     | Asia   | 100   | 45    | 60    | 20    |                                |
| 1     | Europe | 90    | 0     | 0     | 0     |                                |
| 2     | Europe | 100   | 15    | 0     | 0     |                                |
| 3     | Europe | 100   | 30    | 0     | 20    |                                |
| 4     | Europe | 100   | 35    | 10    | 40    |                                |
| 5     | Europe | 100   | 40    | 20    | 60    |                                |

**Note:** Network coverage determines demand potential. No sales possible without infrastructure.

### **Sheet 4: Round_Market_Params**
Detailed market conditions for each round (replaces the 26-value CSV):

| Round | Market | demand_multiplier | material_cost | supplier1_cost | supplier2_cost | supplier3_cost | supplier4_cost | labour_cost | outsource_capacity | tax_rate | interest_rate | min_wage | tech1_cost | tech2_cost | tech3_cost | tech4_cost | feature1_cost | feature2_cost | feature3_cost | feature4_cost | tariff | transport_cost | receivable_days | payable_days | exchange_rate | csr_impact |
|-------|--------|-------------------|---------------|----------------|----------------|----------------|----------------|-------------|-------------------|----------|---------------|----------|------------|------------|------------|------------|---------------|---------------|---------------|---------------|--------|----------------|-----------------|--------------|---------------|------------|
| 1     | US     | 1.0               | 13            | 5              | 9              | 12             | 15             | 8           | 616               | 25       | 5             | 9        | 112        | 297        | 470        | 566        | 174           | 1564          | 12            | 13            | 55     | 5              | 5               | 154          | 1.0           | 10         |
| 1     | Asia   | 1.0               | 10.53         | 5              | 9              | 12             | 15             | 6.48        | 462               | 12       | 6             | 9        | 112        | 297        | 470        | 566        | 174           | 1564          | 12            | 13            | 21     | 2              | 5               | 111          | 1.0           | 10         |
| 1     | Europe | 1.0               | 0             | 5              | 9              | 12             | 15             | 0           | 0                 | 24       | 5             | 9        | 112        | 297        | 470        | 566        | 174           | 1564          | 12            | 13            | 0      | 0              | 5               | 0            | 1.0           | 10         |
| 2     | US     | 1.1               | 14.3          | 5.5            | 9.9            | 13.2           | 16.5           | 8.8         | 677.6             | 27.5     | 5.5           | 9.9      | 123.2      | 326.7      | 517        | 622.6      | 191.4         | 1720.4        | 13.2          | 14.3          | 60.5   | 5.5            | 5.5             | 169.4        | 1.1           | 11         |
| 2     | Asia   | 1.1               | 11.583        | 5.5            | 9.9            | 13.2           | 16.5           | 7.128       | 508.2             | 13.2     | 6.6           | 9.9      | 123.2      | 326.7      | 517        | 622.6      | 191.4         | 1720.4        | 13.2          | 14.3          | 23.1   | 2.2            | 5.5             | 122.1        | 1.1           | 11         |
| 2     | Europe | 1.1               | 0             | 5.5            | 9.9            | 13.2           | 16.5           | 0           | 0                 | 26.4     | 5.5           | 9.9      | 123.2      | 326.7      | 517        | 622.6      | 191.4         | 1720.4        | 13.2          | 14.3          | 0      | 0              | 5.5             | 0            | 1.1           | 11         |

**Notes:**
- `demand_multiplier`: Market growth factor (1.0 = baseline, 1.1 = 10% growth)
- `supplier1-4_cost`: Cost index for different suppliers (affects CSR rating)
- `outsource_capacity`: Maximum units available for outsourcing
- All costs in USD unless noted
- `exchange_rate`: For currency conversion (future feature)

### **Sheet 5: Round_Schedule**
Round deadlines and status:

| Round | Scenario | Deadline            | Status    | Notes                    |
|-------|----------|---------------------|-----------|--------------------------|
| 1     | 4,3,1    | 2024-12-15 17:00:00 | active    | First competitive round  |
| 2     | 2,2,2    | 2024-12-17 17:00:00 | pending   | Medium growth scenario   |
| 3     | 2,4,2    | 2024-12-19 17:00:00 | pending   | High competition         |

**Scenario codes:** (demand_scenario, competition_scenario, volatility)
- 1 = Low, 2 = Medium, 3 = High, 4 = Very High

### **Sheet 6: Teams**
Team roster and login credentials:

| team_id | team_name      | login_code | members                  | email              | created_at          |
|---------|----------------|------------|--------------------------|--------------------|---------------------|
| team1   | Team Alpha     | ALPHA2024  | John, Mary, Bob          | team1@example.com  | 2024-12-13 10:00:00 |
| team2   | Team Beta      | BETA2024   | Alice, Tom, Sarah        | team2@example.com  | 2024-12-13 10:00:00 |
| team3   | Team Gamma     | GAMMA2024  | Mike, Lisa, Dave         | team3@example.com  | 2024-12-13 10:00:00 |
| team4   | Team Delta     | DELTA2024  | Emma, Chris, Ann         | team4@example.com  | 2024-12-13 10:00:00 |
| team5   | Team Epsilon   | EPSIL2024  | Ryan, Kate, Mark         | team5@example.com  | 2024-12-13 10:00:00 |

### **Sheet 7: Team_Decisions** ⭐ MOST IMPORTANT
One row per team per round with ALL decisions in JSON:

| round | team_id | timestamp           | status    | decisions_json                                                    | submitted_by        | ip_address    |
|-------|---------|---------------------|-----------|-------------------------------------------------------------------|---------------------|---------------|
| 1     | team1   | 2024-12-13 14:30:00 | draft     | {"production":{...}, "hr":{...}, "rnd":{...}, "investment":{...}} | john@example.com    | 192.168.1.100 |
| 1     | team1   | 2024-12-13 16:45:00 | submitted | {"production":{...}, "hr":{...}, "rnd":{...}, "investment":{...}} | mary@example.com    | 192.168.1.101 |
| 1     | team2   | 2024-12-13 15:20:00 | draft     | {"production":{...}, "hr":{...}, "rnd":{...}, "investment":{...}} | alice@example.com   | 192.168.1.102 |

**Status values:**
- `draft` - Can still edit
- `submitted` - Locked, can't change
- `late` - Submitted after deadline (penalty applies)

**decisions_json Full Structure:**
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
    "techDevelopment": {
      "tech2": 100000,
      "tech3": 50000,
      "tech4": 0
    },
    "featureDevelopment": {
      "feature1": 20000,
      "feature2": 15000,
      "feature3": 10000
    },
    "licensing": {
      "tech3_license": false,
      "feature4_license": true
    }
  },
  "investment": {
    "newPlants": {
      "us": 0,
      "asia": 1
    },
    "plantUpgrades": {
      "usPlant1": "automation"
    }
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
        "pricing": {
          "us": 350,
          "asia": 300,
          "europe": 380
        },
        "promotion": {
          "us": 10,
          "asia": 5,
          "europe": 8
        }
      },
      "tech2": {
        "features": 7,
        "pricing": {
          "us": 450,
          "asia": 400,
          "europe": 480
        },
        "promotion": {
          "us": 12,
          "asia": 6,
          "europe": 10
        }
      }
    }
  },
  "finance": {
    "transferPricing": {
      "us": 1.2,
      "asia": 1.5,
      "europe": 1.3
    },
    "debt": {
      "longtermBorrowing": 50000,
      "longtermRepayment": 0
    },
    "equity": {
      "shareIssuance": 0,
      "shareBuyback": 0
    },
    "dividends": 10000
  }
}
```

### **Sheet 8: Round_Results**
Calculated results per team per round (JSON):

| round | team_id | calculated_at       | results_json                                                      | calculation_version |
|-------|---------|---------------------|-------------------------------------------------------------------|---------------------|
| 1     | team1   | 2024-12-15 17:05:00 | {"pnl":{...}, "balanceSheet":{...}, "marketShare":{...}, ...}    | v1.0                |
| 1     | team2   | 2024-12-15 17:05:00 | {"pnl":{...}, "balanceSheet":{...}, "marketShare":{...}, ...}    | v1.0                |

**results_json Full Structure:**
```json
{
  "pnl": {
    "revenue": {
      "us": 500000,
      "asia": 350000,
      "europe": 200000,
      "total": 1050000
    },
    "costs": {
      "cogs": 450000,
      "transportation": 25000,
      "promotion": 50000,
      "admin": 30000,
      "rnd": 100000,
      "total": 655000
    },
    "ebitda": 395000,
    "depreciation": 35000,
    "ebit": 360000,
    "netFinancing": 15000,
    "profitBeforeTax": 345000,
    "incomeTax": 86250,
    "profitAfterTax": 258750
  },
  "balanceSheet": {
    "assets": {
      "fixedAssets": 500000,
      "inventory": 80000,
      "receivables": 84000,
      "cash": 350000,
      "total": 1014000
    },
    "liabilities": {
      "longtermLoans": 200000,
      "shorttermLoans": 0,
      "payables": 91700,
      "total": 291700
    },
    "equity": {
      "shareCapital": 298000,
      "retainedEarnings": 165550,
      "profitForRound": 258750,
      "total": 722300
    }
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

### **Sheet 9: Audit_Log** (Optional but recommended)
Track all changes for transparency:

| timestamp           | team_id | action        | field_changed    | old_value | new_value | ip_address    |
|---------------------|---------|---------------|------------------|-----------|-----------|---------------|
| 2024-12-13 14:30:00 | team1   | decision_save | production.demand| {...}     | {...}     | 192.168.1.100 |
| 2024-12-13 14:35:00 | team1   | decision_save | hr.employeeCount | 90        | 100       | 192.168.1.100 |
| 2024-12-13 16:45:00 | team1   | submit        | status           | draft     | submitted | 192.168.1.101 |

---

## Benefits of This Structure:

### ✅ **Keeps Full Complexity:**
- All 7 decision areas preserved
- All market parameters available
- All calculations possible
- Suitable for university-level teaching

### ✅ **Much More Manageable:**
- Clear column names (no mystery CSV)
- JSON for complex structures (easy to read/edit)
- One decision row per team (not 3 country fields)
- Searchable and filterable

### ✅ **Instructor-Friendly:**
- Can edit market params in Sheets directly
- See all team progress at a glance
- Export results to Excel for grading
- Audit trail for disputes

### ✅ **Student-Friendly:**
- Clear login codes (no complex accounts)
- Can see draft vs submitted status
- All decisions in one place
- Can't accidentally overwrite teammates' work

---

## Implementation Priority:

**Phase 1:** Essential sheets (weeks 1-2)
- Sheet 1: Game_Settings
- Sheet 5: Round_Schedule
- Sheet 6: Teams
- Sheet 7: Team_Decisions ⭐
- Sheet 8: Round_Results

**Phase 2:** Full parameters (weeks 3-4)
- Sheet 2: Game_Parameters
- Sheet 3: Tech_Network_Coverage
- Sheet 4: Round_Market_Params

**Phase 3:** Advanced features (weeks 5-6)
- Sheet 9: Audit_Log
- Validation rules
- Auto-calculations in Sheets

---

## Next Steps:

1. ✅ I create the Google Sheets template with this structure
2. ✅ You review and approve the template
3. ✅ I build the Google Sheets API service to read/write
4. ✅ I build the 7 decision forms in React
5. ✅ I port the calculation formulas from PHP

**Ready to proceed?** Say YES and I'll create the actual Google Sheets template now! 🚀
