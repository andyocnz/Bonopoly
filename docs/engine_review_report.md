# Game Engine Review Report (Read-Only)

Date: 2026-01-30
Scope: Core engine, simulation engine, AI/strategy logic, configs, and key utils.

## User Answers Incorporated
- Demand baseline is **Round -1 sales**; after that, apply scenario multiplier only (no other carry-forward).
- Outsourced production **should be capitalized into inventory** (not expensed immediately on production).
- AI simulations should start from the **same financial state as the engine**, for fair comparison.

---

## Findings (Ordered by Severity)

### Critical
1) Strategy simulation uses the wrong scenario per round (rounds ? 2 default to scenario 0)
   - **Evidence**: `processRound` gets a single-element array `[scenarioId]` while the engine indexes `scenarioSequence[round]`. At round 2+, lookup returns undefined -> scenario 0.
   - **Locations**:
     - `src/engine/strategySimulation.ts:685`
     - `src/engine/gameEngine.ts:1570`
   - **Impact**: Scenario effects are silently wrong after round 1 in Strategy Lab/Tournament results.
   - **Proposed fix (not applied)**: Pass a full `scenarioSequence` for all rounds (or pass a function/override so the engine uses `scenarioId` directly for the given round).

### High
2) Production multipliers from strategies are ignored when numeric
   - **Evidence**: `productionMultiplier?: number` in `strategyEngine`, but `applyStrategyModifiers` treats it like `{ us, asia }`. Numeric multipliers become `undefined` -> no change.
   - **Locations**:
     - `src/engine/strategyEngine.ts:114`
     - `src/engine/strategyEngine.ts:253`
     - `src/engine/strategySimulation.ts:875`
   - **Impact**: Many strategies (Predatory/Premium/Capacity/etc.) don?t apply intended production adjustments.
   - **Proposed fix (not applied)**: Normalize `productionMultiplier` to object form, or accept both shapes in `applyStrategyModifiers`.

3) Strategy simulation uses hardcoded starting cash/market cap (not engine starting financials)
   - **Evidence**: `initializeGameState` sets cash to $50M and marketCap $100M while engine defaults differ (starting cash $15M, derived share capital/price).
   - **Locations**:
     - `src/engine/strategySimulation.ts:537`
     - `src/engine/gameEngine.ts:608`
   - **Impact**: AI decisions are based on a different balance sheet than the game engine, skewing strategy outcomes.
   - **Proposed fix (not applied)**: Initialize strategy sim using `getBalancedStartingFinancials` and `GAME_CONFIG` so all teams match engine start state.

4) Previous-round results are not consistently carried into strategy simulation game state
   - **Evidence**: `previousGameStates` are updated with `result.gameState`, but `previousRoundResults` is never attached there; engine uses that for KPIs and demand baselines.
   - **Locations**:
     - `src/engine/strategySimulation.ts:703`
     - `src/engine/gameEngine.ts:2715`
   - **Impact**: Round-to-round deltas (share price traces, brand adjustments, demand baselines) may be incorrect or fall back to initial values.
   - **Proposed fix (not applied)**: Set `result.gameState.previousRoundResults = result` (or use `transformResultsToGameState`) before saving it.

5) HR costs ignore Asia headcount and training
   - **Evidence**: HR cost uses only `hr.us` wages/training; `hr.asia` never billed. Also R&D cost equals HR cost, so R&D is undercounted.
   - **Locations**:
     - `src/engine/gameEngine.ts:2352`
     - `src/engine/gameEngine.ts:2419`
   - **Impact**: Asia staffing is effectively free, creating a strong imbalance and mispricing in cashflows.
   - **Proposed fix (not applied)**: Sum US + Asia wage/training for HR cost; keep the same rate logic.

6) Outsourcing cost vs inventory accounting mismatch (per your requirement)
   - **Evidence**: Outsourced units are added to inventory but outsourcing costs are expensed immediately; inventory valuation uses only in-house unit cost.
   - **Locations**:
     - `src/engine/gameEngine.ts:2371`
     - `src/engine/gameEngine.ts:3095`
     - `src/engine/gameEngine.ts:3123`
   - **Impact**: Cost of outsourced units is effectively counted twice (expense now + inventory value later) or mis-stated in inventory value.
   - **Proposed fix (not applied)**: Capitalize outsourced cost into inventory valuation and adjust P&L to expense only when sold.

### Medium
7) Demand baseline is supply-driven and price effects can carry forward
   - **Evidence**: Base demand uses last round total units sold, and previous adjusted demand is passed as `baseDemandOverride` for later rounds with growth applied.
   - **Locations**:
     - `src/engine/gameEngine.ts:2917`
     - `src/engine/gameEngine.ts:2934`
     - `src/engine/gameEngine.ts:1652`
   - **Impact**: Future demand is a function of last round sales (including price effects), which contradicts the requirement: ?round -1 baseline, then apply scenario multiplier only.?
   - **Proposed fix (not applied)**: Always use round -1 base demand for all rounds and apply only scenario growth, ignoring last-round sales.

8) Equity accounting for share issuance/buybacks is inconsistent
   - **Evidence**: Cash uses market price, but share capital uses par value only; no APIC/treasury stock, so balance sheet equity can diverge from cash flows.
   - **Locations**:
     - `src/engine/gameEngine.ts:2584`
     - `src/engine/gameEngine.ts:2625`
     - `src/engine/gameEngine.ts:2658`
   - **Impact**: Equity and retained earnings can drift from financial reality; ratios derived from equity may be distorted.
   - **Proposed fix (not applied)**: Track additional paid?in capital or treasury stock to reconcile cash and equity changes.

### Low
9) Current ratio uses total liabilities instead of current liabilities
   - **Evidence**: `currentRatio = (cash + receivables) / totalLiabilities`
   - **Location**: `src/engine/gameEngine.ts:2678`
   - **Impact**: Liquidity ratio is understated when long?term debt exists.
   - **Proposed fix (not applied)**: Use `payables + shortTermLoans` as denominator.

10) Decision simulator uses a different outsourcing input than engine
   - **Evidence**: Simulator references `production.outsource.units` while engine reads `outsourceUS/outsourceAsia`.
   - **Locations**:
     - `src/components/DecisionSimulator.tsx:350`
     - `src/engine/gameEngine.ts:1499`
   - **Impact**: Simulator view can diverge from engine results, confusing for QA.
   - **Proposed fix (not applied)**: Convert simulator units into `outsourceUS/outsourceAsia` (or update engine to support `outsource.units`).

11) Comment mismatch in starting factories
   - **Evidence**: Header says teams start with 2 US factories; config sets 1.
   - **Locations**:
     - `src/engine/gameEngine.ts:9`
     - `src/engine/gameEngine.ts:115`
   - **Impact**: Documentation confusion; not a functional bug.
   - **Proposed fix (not applied)**: Update comment to match config or vice versa.

---

## Recommended Fix Plan (Not Applied)
1) Strategy Simulation Correctness
   - Pass a full `scenarioSequence` (length = rounds) to `processRound`.
   - Fix `productionMultiplier` handling to support numeric multipliers.
   - Initialize simulation state using `getBalancedStartingFinancials` and `GAME_CONFIG`.
   - Persist `previousRoundResults` into `previousGameStates` each round.

2) Financial & Cost Model Consistency
   - Include Asia HR wages + training in HR cost.
   - Capitalize outsourced cost into inventory and expense when sold.
   - Fix demand baseline to use Round -1 only + scenario growth.

3) Reporting & Ratios
   - Adjust current ratio denominator to current liabilities only.
   - Clarify comment vs. config for starting factories.

---

## Testing Recommendations (Not Run)
- Strategy simulation regression: 5?round run with fixed scenarioSequence; verify scenario effects each round.
- Accounting invariants: inventory continuity, cash reconciliation, equity reconciliation.
- HR cost check: Asia staffing should change cash and cost lines.
- Outsourcing cost: verify P&L vs inventory when outsourced production is stored.

---

## Files Reviewed (Key)
- `src/engine/gameEngine.ts`
- `src/engine/strategySimulation.ts`
- `src/engine/strategyEngine.ts`
- `src/engine/aiEngine.ts`
- `src/engine/simulationConfig.ts`
- `src/engine/scenarios.json`
- `src/utils/logisticsAllocation.ts`
- `src/utils/financialCalculations.ts`
- `src/components/DecisionSimulator.tsx`
- `src/config/*`

---

If you want, I can next produce a minimal patch set that targets only the high?severity items, or split fixes into separate commits by area.
