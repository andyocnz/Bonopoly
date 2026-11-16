# Bonopoly Game Engine - Developer Notes

## Overview

This document contains critical information for developers working on the Bonopoly business simulation game engine.

---

## Factory Build Time

**Factory investment takes EXACTLY 1 ROUND to become operational.**

- Order factory in Round N → Available in Round N+1
- Example: Order in Round 1 → Can produce in Round 2
- Configured via: `investment.lagRounds = 1` in `gameEngine.ts`
- Cash outflow happens immediately when ordered
- Fixed assets increase immediately (factory is "under construction")

**DO NOT CHANGE THIS** without updating all related documentation.

---

## Industry Configuration

Each industry has different costs and parameters. The system uses a merge approach:

### How it works:

1. **Base config**: `GAME_CONFIG` (Electronics & Technology defaults)
2. **Industry overrides**: `INDUSTRY_CONFIGS['Oil & Energy']`, etc.
3. **Merge function**: `getGameConfigForIndustry('Oil & Energy')`
4. Missing values in industry config **fall back to base config**

### Key differences by industry:

| Parameter | Electronics | Oil & Energy | Automotive |
|-----------|-------------|--------------|------------|
| Plant Cost (US) | $30M | $45M | $120M |
| Plant Cost (Asia) | $18M | $32M | $90M |
| Capacity/Plant | 325K | 600K | 150K |
| Baseline Price (US) | $125 | $85 | $45,000 |
| Unit Material (US) | $22 | $45 | $8,000 |

### Usage:

```typescript
import { getGameConfigForIndustry, GAME_CONFIG } from './engine/gameEngine'

// For Electronics (default)
const config = GAME_CONFIG

// For Oil & Energy
const oilConfig = getGameConfigForIndustry('Oil & Energy')

// For unknown industry (falls back to Electronics)
const unknownConfig = getGameConfigForIndustry('Unknown')
```

---

## Trial Round (Round 0)

### Behavior:

- Teams make decisions, results ARE calculated and shown
- TSR leaderboard IS displayed for trial round
- Trial round results do **NOT** carry forward to Round 1
- Round 1 starts fresh with initial balance sheet values
- This is intentional: trial round is for learning, not scored

### Technical details:

- Round 0 = trial round
- `calculateTrialRound()` runs the full engine with default decisions
- Game state is reset for Round 1 (uses `createInitialGameState()`)

### Why trial round doesn't count:

1. Players need a practice round to learn the game
2. Mistakes in trial round shouldn't penalize teams
3. All teams start Round 1 on equal footing

---

## Tech Levels (Simplified)

**The tech level system (1-4) is SIMPLIFIED in this version.**

### Current behavior:

- Tech level **always stays at 1**
- But no actual tech level upgrades occur
- The structure is kept for potential future expansion

### Active R&D progression:

- **Features** (unlocked via research hours) are the main R&D progression
- Research hours = workers × mandays_per_worker × training efficiency
- Features unlock sequentially based on cumulative research hours

---

## Short-Term Loans

**Automatic liquidity buffer, NOT a team decision.**

### How it works:

- Generated when `cash < minCashReserve` ($2M default)
- Calculated at end of round during balance sheet preparation
- Repaid at start of next round (impacts cash flow)
- No interest charged (unlike long-term debt)

### Why automatic:

- Prevents teams from accidentally going bankrupt
- Simulates real-world overdraft facilities
- Simplifies gameplay (one less decision to manage)

---

## Balance Sheet Equation

**Assets = Liabilities + Equity**

### Assets:
- Fixed Assets (factories)
- Inventory (units × unit cost)
- Receivables (credit sales)
- Cash

### Liabilities:
- Long-term Debt
- Short-term Loans (auto-generated)
- Payables (credit purchases)

### Equity:
- Share Capital
- Retained Earnings (cumulative past profits)

**Note:** Net profit is NOT double-counted. It flows through:
1. Revenue → Net Profit in P&L
2. Net Profit → affects Cash/Receivables in Balance Sheet
3. Net Profit → added to Retained Earnings at period end

---

## Key Functions Reference

| Function | Purpose |
|----------|---------|
| `calculateRound()` | Main engine - calculates one round for all teams |
| `calculateTrialRound()` | Run trial round with default decisions |
| `createInitialGameState()` | Create starting state for a team |
| `getDefaultDecisions()` | Get reasonable default decisions for trial round |
| `getGameConfigForIndustry()` | Get merged config for specific industry |
| `getBalancedStartingFinancials()` | Calculate starting values that balance |
| `getStartingUnitCost()` | Calculate unit cost for inventory valuation |

---

## Common Issues

### Balance sheet not balancing?

1. Check net profit isn't being double-counted
2. Check short-term loan repayment is subtracted from cash
3. Verify previous round's values are being used correctly

### Production showing 0 units?

1. Check `decisions.production.usUnits` is set (not just productionLines)
2. Verify factory count > 0 for the region
3. Check allocation percentage isn't 0

### TSR very high/low?

1. TSR is in percentage points (215% means 2.15x return)
2. Check starting share price ($10 default)
3. Verify dividends are included in calculation

---

## Testing

Run the simulation test to verify engine behavior:

```bash
cd bonopoly-react2
npx tsx simulation-test/simulate.ts
```

Run the trial round test:

```bash
npx tsx simulation-test/test-trial-round.ts
```

---

## File Locations

| File | Purpose |
|------|---------|
| `src/engine/gameEngine.ts` | Core calculation engine |
| `src/config/calculations.ts` | DEPRECATED - old calculations |
| `prisma/schema.prisma` | Database schema |
| `simulation-test/simulate.ts` | Multi-round simulation test |
| `simulation-test/test-trial-round.ts` | Trial round test |
