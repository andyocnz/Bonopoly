# Game Mechanics Verification Checklist

This document lists ALL game mechanics that need to be verified through simulation testing.

## 1. State Accumulation (Round-over-Round)

### 1.1 Factory State
- [ ] Factories from Round N should carry over to Round N+1
- [ ] New factory ordered in Round N should be available in Round N+1 (lag = 1)
- [ ] Cannot produce from Asia factory if none exist
- [ ] Factory count should never decrease (no selling factories)

### 1.2 R&D Progress
- [ ] Tech level unlocked should persist across rounds
- [ ] Cumulative tech investment should accumulate
- [ ] Feature count should accumulate from research hours
- [ ] Tech level affects production quality/efficiency

### 1.3 Financial State
- [ ] Retained earnings accumulate (previous + net profit - dividends)
- [ ] Long-term debt carries over (adjusted by borrowing/repayment)
- [ ] Share capital changes only with issuance/buyback
- [ ] Cash balance flows correctly between rounds

### 1.4 Inventory
- [ ] Ending inventory = Starting + Production - Sales
- [ ] Inventory carries over to next round
- [ ] Inventory valued at production cost (not selling price)

---

## 2. Balance Sheet Integrity

### 2.1 Accounting Equation
- [ ] Assets = Liabilities + Equity (EVERY round)
- [ ] No rounding errors that break the equation
- [ ] All components accounted for

### 2.2 Asset Components
- [ ] Fixed Assets = Factory cost × Factory count - Depreciation
- [ ] Inventory = Units × Unit cost
- [ ] Receivables = Revenue × Receivable %
- [ ] Cash = Calculated from cash flow

### 2.3 Liability Components
- [ ] Long-term debt = Previous + New borrowing - Repayment
- [ ] Short-term loans = Auto-calculated for cash shortfall
- [ ] Payables = COGS × Payable %

### 2.4 Equity Components
- [ ] Share capital = Previous + Issuance - Buyback
- [ ] Retained earnings = Previous + Net profit - Dividends

---

## 3. Market & Sales Logic

### 3.1 Demand Calculation
- [ ] Base demand uses correct industry values
- [ ] Region split applied correctly (US/Asia/Europe)
- [ ] Market demand multiplier applied
- [ ] Scenario adjustments applied (tariffs, disruptions)
- [ ] Demand grows by marketGrowthRate each round

### 3.2 Market Share Calculation
- [ ] Market share based on competitive score
- [ ] Price affects market share (elasticity)
- [ ] Marketing spend affects market share
- [ ] Quality (tech level, features) affects market share
- [ ] Market share sums to ~100% across all teams

### 3.3 Sales Calculation
- [ ] Units sold = min(demand share, available supply)
- [ ] Cannot sell more than produced + inventory
- [ ] Revenue = Units sold × Price per region
- [ ] Unsold units go to inventory

---

## 4. Pricing & Elasticity

### 4.1 Price Bounds
- [ ] Price cannot go below minPrice per region
- [ ] Price cannot exceed maxPrice per region
- [ ] Baseline price used for elasticity calculation

### 4.2 Elasticity Effect
- [ ] Higher price → Lower demand (elasticity > 0)
- [ ] Lower price → Higher demand
- [ ] Elasticity varies by region
- [ ] Effect is proportional, not binary

---

## 5. Production & Capacity

### 5.1 Capacity Limits
- [ ] Production limited by factory capacity
- [ ] Capacity = Factories × CapacityPerPlant
- [ ] Outsourcing adds to capacity (separate pool)
- [ ] Cannot exceed outsourcing limits

### 5.2 Cost Curve
- [ ] Optimal utilization affects cost efficiency
- [ ] Over-utilization increases costs
- [ ] Under-utilization wastes fixed costs

### 5.3 Production Costs
- [ ] Direct materials cost per unit
- [ ] Direct labor cost per unit
- [ ] Supplier quality affects cost
- [ ] Regional cost differences (US vs Asia)

---

## 6. HR & Labor

### 6.1 Employee Costs
- [ ] Wages × Employees = Labor cost
- [ ] Training increases productivity
- [ ] Regional wage differences apply

### 6.2 Productivity
- [ ] Training level affects output quality
- [ ] Employee count affects capacity utilization

---

## 7. R&D Mechanics

### 7.1 Tech Levels
- [ ] Investment accumulates toward next level
- [ ] Each level requires specific $ threshold
- [ ] Higher tech = better products

### 7.2 Features
- [ ] Research hours accumulate
- [ ] Features unlock at thresholds
- [ ] Features improve market appeal

---

## 8. Investment (Factories)

### 8.1 Ordering
- [ ] Factory cost deducted from cash
- [ ] Order recorded with round ordered
- [ ] Cannot order if insufficient funds (unless borrowing)

### 8.2 Delivery Lag
- [ ] Factory not available same round
- [ ] Available after lagRounds (default: 1)
- [ ] Pending investments tracked correctly

### 8.3 Regional Costs
- [ ] US factory costs plantCostUS
- [ ] Asia factory costs plantCostAsia
- [ ] Different costs per industry

---

## 9. Logistics & Shipping

### 9.1 Tariffs
- [ ] Cross-region shipping incurs tariff
- [ ] US→Asia, Asia→US, US→Europe, Asia→Europe
- [ ] Tariffs add to COGS

### 9.2 Allocation Priority
- [ ] Teams set priority order for fulfillment
- [ ] Local production used first (typically)
- [ ] Overflow from other regions

---

## 10. Finance Decisions

### 10.1 Borrowing
- [ ] Can borrow up to debt limit (% of assets)
- [ ] Interest charged on debt
- [ ] Debt increases liabilities

### 10.2 Share Issuance
- [ ] New shares dilute ownership
- [ ] Cash received = shares × price
- [ ] Limited to % per round

### 10.3 Buybacks
- [ ] Shares reduced
- [ ] Cash paid out
- [ ] Limited to % per round

### 10.4 Dividends
- [ ] Cash paid to shareholders
- [ ] Reduces retained earnings
- [ ] Affects TSR calculation

---

## 11. KPIs & Share Price

### 11.1 EPS Calculation
- [ ] EPS = Net Profit / Shares Outstanding
- [ ] Shares calculated from share capital / par value

### 11.2 Share Price
- [ ] Based on EPS × PE ratio
- [ ] Smoothed with previous price (60/40 weight)
- [ ] Growth premium adjustments
- [ ] Max drop limit enforced

### 11.3 TSR (Total Shareholder Return)
- [ ] TSR = (Price change + Dividends) / Starting price
- [ ] Cumulative across rounds
- [ ] Primary ranking metric

### 11.4 ROE
- [ ] ROE = Net Profit / Equity
- [ ] Should be reasonable (5-30% typical)

---

## 12. Scenario Effects

### 12.1 Tariff Scenarios
- [ ] Increases shipping costs
- [ ] Affects specific routes

### 12.2 Demand Shock Scenarios
- [ ] Increases/decreases regional demand
- [ ] Temporary or permanent

### 12.3 Supply Disruption
- [ ] Affects production capacity
- [ ] Regional impact

### 12.4 Cost Scenarios
- [ ] Material cost changes
- [ ] Labor cost changes

---

## 13. Game Balance & Reasonableness

### 13.1 Profit Margins
- [ ] Gross margin: 20-50% is reasonable
- [ ] Net margin: 5-20% is reasonable
- [ ] Negative profit possible but not constant

### 13.2 Market Dynamics
- [ ] Not too easy (everyone profitable)
- [ ] Not too hard (everyone losing)
- [ ] Differentiation matters

### 13.3 Decision Impact
- [ ] Price changes affect sales meaningfully
- [ ] Marketing spend has visible effect
- [ ] R&D investment pays off over time
- [ ] Factory investment enables growth

### 13.4 Competitive Balance
- [ ] No dominant strategy
- [ ] Different strategies can win
- [ ] Catch-up possible (not snowball)

---

## 14. Edge Cases

### 14.1 Cash Shortfall
- [ ] Auto-loan kicks in if cash negative
- [ ] Game doesn't break with 0 cash

### 14.2 Zero Production
- [ ] Can survive a round with no production
- [ ] Inventory depletes, no crash

### 14.3 Maximum Values
- [ ] Very high prices don't break game
- [ ] Very high production doesn't overflow
- [ ] Maximum factories handled

### 14.4 Minimum Values
- [ ] Zero marketing works (just poorly)
- [ ] Zero R&D works (no upgrades)
- [ ] Minimum viable decisions

---

## 15. Code Quality / Tech Debt

### 15.1 Audit Findings (2026-01-09)

Completed:
- [x] Delete unused config files (financialAssumptions.ts, techMarketShare.ts, gameDefaults.ts, calculations.ts)
- [x] Move hardcoded values to GAME_CONFIG (baseTechScore, maxEffectiveTaxRate, adminStaffFloor)
- [x] Fix tech investment to affect techScore (now accumulates and provides diminishing returns bonus)

Deferred (Medium Priority):
- [ ] Refactor calculateRoundAudit to share logic with calculateRound (~400 lines duplicated)
  - Risk: Changes to game mechanics must be replicated in both functions
  - Recommendation: Extract shared core calculation functions or add `enableTrace` parameter

---

## Running Verification

To verify these mechanics, run:
```bash
cd bonopoly-react2
npx tsx simulation-test/runFullAudit.ts
```

This will generate a report showing pass/fail for each check.
