# AI Code Challenge Tournament: The "Bonopoly Arena"

We are transforming the simulation engine into a competitive arena where Large Language Models (LLMs) compete not just by playing, but by **coding the logic** for autonomous trading bots.

## 1. The Approaches: Architect vs. Operator

We evaluated two distinct ways to integrate LLMs into the Bonopoly simulation.

### Option A: "The Operator" (Live Turn-by-Turn)
In this model, the simulation pauses every round. The system serializes the entire game state into text, sends it to the LLM API, and waits for a JSON response containing the decision.

*   **Workflow:** `Game State -> Text Prompt -> API Call -> JSON -> Game Engine`
*   **Pros:** Allows for "creative" or role-play decisions based on news flavor text.
*   **Cons:**
    *   **Extremely Slow:** A 100-round game with 4 agents requires 400 synchronous API calls.
    *   **Fragile:** If the LLM returns malformed JSON in Round 99, the entire simulation crashes.
    *   **Costly:** High token usage for repeating context every single turn.

### Option B: "The Architect" (Code Tournament) - **SELECTED**
In this model, the LLM acts as a Software Engineer. We provide the API interfaces and game rules *once*, and the LLM writes a TypeScript class (a "Bot") that implements the strategy. We then compile and run these bots against each other at native CPU speed.

*   **Workflow:** `Rules + Interface -> LLM -> TypeScript Code -> Compiled Bot -> Simulation`
*   **Pros:**
    *   **Blazing Fast:** 100 rounds take milliseconds, allowing for thousands of monte-carlo simulations.
    *   **Robust:** We validate the code *before* the game starts. If it compiles, it plays.
    *   **Complex:** Tests the LLM's ability to create long-term logic, mathematical formulas, and state management.

---

## 2. Implementation Roadmap (Option B)

### Step 1: Define the "Bot Contract"
We need a strict TypeScript interface that the LLM must implement. This ensures all generated bots can plug into our engine.

```typescript
// simulation-test/arena/BotInterface.ts
import { TeamGameState, TeamDecisions, GameConfig } from '../../src/engine/gameEngine';

export interface BonopolyBot {
    name: string;
    // The core function the LLM must write
    getDecision(gameState: TeamGameState, config: GameConfig, history: any[]): TeamDecisions;
}
```

### Step 2: The "Prompt Package"
We create a script that bundles the necessary context for the LLM. It shouldn't just say "write a bot", it needs to provide:
1.  The `TeamGameState` type definition (So it knows what data it has).
2.  The `TeamDecisions` type definition (So it knows what it can output).
3.  The `GameConfig` constants (So it knows costs, capacities, and constraints).

### Step 3: The Arena Runner
A new script (`simulation-test/arena/run_tournament.ts`) that:
1.  Dynamically loads the bot files (e.g., `bots/gpt4_v1.ts`, `bots/claude_aggressive.ts`).
2.  Initializes the `gameEngine`.
3.  Loops through rounds, calling `bot.getDecision()` for each team instead of user input.
4.  Records TSR (Total Shareholder Return) and Net Profit.

### Step 4: The Leaderboard
A JSON output that tracks which Model/Prompt combination is the current "Grandmaster" of Bonopoly.

---

## 3. UI Visualization

While the simulation runs in the backend (CLI), the frontend can replay the "Battle."

### The "Arena" Dashboard
Imagine a simplified version of the current Game Dashboard, but focused on comparison.

**Layout:**
*   **Top Bar:** "Arena Mode: GPT-4o vs Claude 3.5 vs Gemini Pro"
*   **Main View (Split Screen):**
    *   **Left:** A real-time line graph of **Cash Balance** and **Market Share** for all 4 bots.
    *   **Right:** A scrolling log of "Reasoning" (optional) or Major Events.
        *   *Round 4: GPT-Bot slashes prices to $85 (Aggressive).*
        *   *Round 5: Claude-Bot responds by increasing R&D investment.*

### Code Inspector
A tab where users can see the **actual code** the LLM wrote.
*   "See why Gemini won Round 50? Look at line 45 where it checks for `inventory > 20000`."

## 4. Why this is exciting
This moves beyond "Chat with AI" to "AI Generating Software." We are using the game as a **Turing Test for Strategic Coding**.
