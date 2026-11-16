# Simulation Verification Guide

This folder contains scripts to simulate and verify the core game mechanics of Bonopoly.

## verifying Realistic Mechanics

We have specific logic ensuring the game behaves realistically:
1.  **Price Elasticity**: Higher prices should lower demand, and vice versa.
2.  **Investment Lag**: Factories built in Round X should only be available in Round X+1.
3.  **R&D Impact**: Investing in research should accumulate hours and unlock features.

### How to Run the Verification Script

Run the following command from the project root (`bonopoly-react2`):

```bash
npx tsx simulation/verify_mechanics.ts
```

### What to Look For

The script will output a report with `✅ SUCCESS` or `❌ FAILURE` for each check.

**Example Output:**

```
🧪 Starting Game Mechanics Verification...

--- 🏁 ROUND 1 SIMULATION ---

📊 Price Elasticity Check (Round 1):
  🔹 Control Price: $85 -> Demand: 1,500,000
  🔺 High Price:    $102 -> Demand: 1,250,000
  🔻 Low Price:     $68 -> Demand: 1,850,000
  ✅ SUCCESS: Demand responded inversely to price as expected.

🏗️ Investment Check (Round 1):
  Initial US Factories: 1
  Ordered: 1 plants
  R1 Ending Factories: 1
  ✅ SUCCESS: Factories did not increase immediately (Lag works).

--- 🏁 ROUND 2 SIMULATION ---

🏗️ Investment Check (Round 2):
  R2 Ending Factories: 2
  ✅ SUCCESS: Factory became operational in Round 2.
```

## Running Full Database Simulations

If you want to run a full multi-team, multi-round simulation that writes to the database (for checking the Educator Dashboard), use:

```bash
npm run simulate:quick
# or for more control:
npx tsx simulation-test/simulate.ts --rounds=5 --teams=4
```
