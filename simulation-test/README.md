# Bonopoly Simulation Test Suite

This folder contains scripts to run automated game simulations that insert real data into the database, allowing you to login and verify the results manually.

## Purpose

1. **End-to-End Testing**: Runs complete game simulations through the actual game engine
2. **Database Verification**: All data is inserted into the real database - you can login and check
3. **Issue Detection**: Automatically detects bugs, imbalances, and tuning issues
4. **Transparency**: Every calculation is traced and logged for debugging

## How It Works

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Run Simulation │────▶│  Game Engine    │────▶│  Database       │
│  (simulate.ts)  │     │  (gameEngine.ts)│     │  (PostgreSQL)   │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                        │
                                                        ▼
                                               ┌─────────────────┐
                                               │  Login & Verify │
                                               │  (Web Browser)  │
                                               └─────────────────┘
```

## Prerequisites

1. PostgreSQL database running (via Docker or local)
2. Database migrated: `npm run db:migrate`
3. Server running: `npm run server` (optional - script uses Prisma directly)

## Usage

### Run a Simulation

```bash
# Run default simulation (4 teams, 5 rounds)
npm run simulate:test

# Run quick test (3 teams, 2 rounds)
npm run simulate:test -- --rounds=2 --teams=3

# Run with specific scenarios
npm run simulate:test -- --scenarios=0,1,2,3,4
```

### Output

After running, you'll see:

```
================================================================================
  SIMULATION COMPLETE
================================================================================

  Game Created:
    Game Code:  BONO-A3X9
    Game PIN:   1234

  Teams:
    1. Alpha Corp      | Code: ALPHA-7K2M | PIN: 5678
    2. Beta Industries | Code: BETA-3N9P  | PIN: 9012
    3. Gamma Tech      | Code: GAMMA-X5Q1 | PIN: 3456

  Login URLs:
    Educator: http://localhost:5173/educator-login
    Team:     http://localhost:5173/team-login

================================================================================
  ISSUES DETECTED (3)
================================================================================

  [BUG] #1: Negative cash balance
    Round: 3, Team: Beta Industries
    Details: Cash: -$2,345,678
    Suggested Fix: Add automatic short-term borrowing

  [TUNING] #2: Unrealistic gross margin
    Round: 1, Team: All teams
    Details: Gross margin 65% (expected 30-50%)
    Suggested Fix: Review unit cost calculation
```

### Verify in Browser

1. Open http://localhost:5173/team-login
2. Enter Team Code (e.g., `ALPHA-7K2M`) and PIN (e.g., `5678`)
3. Navigate to Results page
4. Verify the numbers match the simulation output

## Files

| File | Description |
|------|-------------|
| `simulate.ts` | Main simulation runner with database integration |
| `README.md` | This documentation |
| `output/` | Generated logs, issues reports, and JSON results |

## Key Principles

### No Hardcoding

All calculations use the actual game engine functions:
- `calculateRoundAudit()` for round calculations
- `createInitialGameState()` for team initialization
- `GAME_CONFIG` and `SCENARIOS` for all parameters

### No Fallbacks

If the game engine fails or produces unexpected results:
- The simulation stops with an error
- The issue is logged with full trace
- No "safe defaults" are substituted

### Full Traceability

Every number can be traced back to its source:
- Input decisions are logged
- Intermediate calculations are traced
- Final results show formulas used

## Troubleshooting

### "Database connection failed"

1. Ensure PostgreSQL is running: `docker-compose up -d`
2. Check `.env` for correct connection string
3. Run migrations: `npm run db:migrate`

### "Game engine error"

The simulation intentionally fails loudly when the game engine has issues. Check:
1. The error message for the specific calculation that failed
2. The `output/` folder for the last successful state
3. The game engine source code at the line number indicated

### "Results don't match in browser"

If the browser shows different results than the simulation:
1. Check that you're logged in as the correct team
2. Ensure the server was restarted after database changes
3. Clear browser cache and refresh

## Development

### Adding New Issue Checks

Edit `simulate.ts` and add a new check in the `IssueDetector` class:

```typescript
private checkMyNewIssue(results: RoundAuditResults) {
  results.teams.forEach(team => {
    if (/* condition */) {
      this.issues.push({
        type: 'BUG', // or 'WARNING', 'IMBALANCE', 'TUNING'
        severity: 'high',
        round: results.round,
        teamId: team.teamId,
        teamName: team.teamName,
        description: 'Description of the issue',
        details: 'Specific details...',
        suggestedFix: 'How to fix it',
      })
    }
  })
}
```

### Running Multiple Simulations

For stress testing, run multiple games:

```bash
for i in {1..10}; do
  npm run simulate:test -- --quiet
done
```

## Architecture

The simulation uses:
- **Prisma** for database operations (not the HTTP API)
- **Game Engine** directly imported from `src/engine/gameEngine.ts`
- **Same types** as the production application

This ensures the simulation tests the exact same code path as real gameplay.
