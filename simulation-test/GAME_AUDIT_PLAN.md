# Game Engine Audit & Validation Plan

This document outlines the strategy for ensuring mathematical integrity, accounting accuracy, and operational consistency within the Bonopoly Game Engine.

## 1. Core Mathematical Integrity (The "Golden Rules")

To ensure player trust, the engine must strictly enforce these four pillars of simulation accuracy:

### A. The Operational Waterfall (Inventory & Sales)
*   **Rule:** Total units sold can NEVER exceed total units available.
*   **Equation:** `Total Available = Beginning Inventory + Units Produced + Units Outsourced`
*   **Sales Constraint:** `Actual Sales = MIN(Market Demand, Total Available)`
*   **Inventory Roll-forward:** `Ending Inventory = Total Available - Actual Sales`
*   **Audit Check:** `Ending Inventory` must never be negative. If it is 0, `Unmet Demand` must be recorded.

### B. The Accounting Tie-Out (Balance Sheet)
*   **Rule:** The balance sheet must balance every round to within $1.00.
*   **Equation:** `Total Assets = Total Liabilities + Total Shareholder Equity`
*   **Equity Roll-forward:** `Ending Equity = Opening Equity + Net Profit - Dividends + Share Issuance - Share Buybacks`
*   **Audit Check:** `Assets - (Liabilities + Equity) = 0`.

### C. The Time-Lag Logic (CapEx & Investment)
*   **Rule:** Capital expenditures take effect over time, not instantly.
*   **Factory Timeline:** 
    *   Round N: Order factory -> Cash deducted -> Factory enters `pendingInvestments`.
    *   Round N+1: Factory completed -> `factoriesCount` increases -> Capacity becomes available for Round N+1 production.
*   **Debt/Equity Timeline:** 
    *   Borrowing/Repayment happens at the *start* or *end* of the round (standardize to end-of-round for interest calculation on the average balance).

### D. Scenario Transparency
*   **Rule:** Scenario modifiers (Tax, Interest, Demand) must be explicitly traceable.
*   **Audit Check:** Save the `Effective Tax Rate` and `Interest Rate` used in the round results, allowing comparison against the `scenarios.json` source.

---

## 2. Implementation Architecture: The "Audit Trace"

We will move away from "black-box" calculations by introducing a **Trace Object** that accompanies every round result.

### The Trace Interface
```typescript
interface AuditTrace {
  inventory: {
    beginning: number;
    produced: number;
    outsourced: number;
    available: number;
    sold: number;
    ending: number;
  };
  finance: {
    assets: number;
    liabilities: number;
    equity: number;
    imbalance: number; // Must be 0
  };
  capacity: {
    activeFactories: number;
    capacityPerPlant: number;
    theoreticalMax: number;
    utilizationRate: number;
  };
  parameters: {
    taxRate: number;
    interestRate: number;
    marketGrowthMod: number;
  };
}
```

---

## 3. The "Auditor" Validation Suite

We will implement a `GameAuditor` class in `simulation-test/` that performs the following checks after every round calculation:

| Check | Description | Action on Failure |
| :--- | :--- | :--- |
| **Inventory Leak** | Checks if `End != Start + Prod - Sold` | LOG: High Alert & Block Save |
| **Asset Imbalance** | Checks `A != L + E` | LOG: Critical Error & Block Save |
| **Negative Cash** | Checks if cash went negative without a loan | LOG: Warning (Auto-loan triggered?) |
| **Zombie Factories** | Checks if factories increased without a prior order | LOG: Logic Error |
| **Scenario Drift** | Checks if Tax/Interest used matches Scenario ID | LOG: Tuning Alert |

---

## 4. UI for Auditing (Debugging View)

To make debugging easier for developers and educators:

1.  **Audit Overlay:** In the `AdminPage.tsx`, add a toggle to "Show Math" which displays the `AuditTrace` for any team in any round.
2.  **Visual Waterfall:** A small chart showing `Start Inv -> Production -> Sales -> End Inv`.
3.  **Balance Sheet Proof:** A specific section in the Financial Report that explicitly shows the Assets vs. Liab+Equity calculation.

## 5. Next Steps for Implementation

1.  **Modify `gameEngine.ts`**: Update the `TeamResults` interface to include the `AuditTrace` object.
2.  **Update Calculation Functions**: Ensure `calculatePnL` and `calculateBalanceSheet` contribute to the trace.
3.  **Enhance `simulate.ts`**: Add a final "Audit Pass" that loops through the generated JSON and confirms all math rules were followed over the 100-round simulation.
