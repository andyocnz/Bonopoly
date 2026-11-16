# Config Snapshot Testing

## Quick Start

Run the integration test:
```bash
npm run test:snapshot
```

This creates 3 real games in your database that you can login and play in the frontend.

## What It Tests

**Test 1: New game with snapshot** (Oil industry)
- ✅ `gameConfig` JSON is stored in DB
- ✅ Contains full resolved config (265 values)
- ✅ Capacity = 2,000,000 (Oil default)

**Test 2: Legacy game** (Automotive, no snapshot)
- ✅ `gameConfig` is NULL
- ✅ `resolveGameConfig()` falls back to code
- ✅ Capacity = 150,000 (Automotive default from code)

**Test 3: Resolve function**
- ✅ Reads from DB snapshot when available
- ✅ Falls back to code when NULL

**Test 4: Custom config** (Electronics with overrides)
- ✅ Stores custom capacity = 777,777
- ✅ Stores custom starting cash = $50M
- ✅ Custom values frozen in DB

**Test 5: Round calculations**
- ✅ All games use `resolveGameConfig()` to get frozen config
- ✅ Round -1 (trial round) calculated successfully

## Frontend Verification

After running the test, the script prints login credentials:

```
Team login: ABCD12 / 123456
```

1. Start the dev server: `npm run dev:all`
2. Go to http://localhost:5173/team-login
3. Enter the team code and PIN
4. Play the game and verify:
   - Game 1 (Oil): Uses Oil industry config
   - Game 2 (Legacy): Uses Automotive config from fallback
   - Game 3 (Custom): Uses capacity 777,777

## Database Verification

Check the games were created:
```sql
SELECT
  "gameCode",
  "industry",
  "capacityPerFactory",
  "gameConfig" IS NOT NULL as "hasSnapshot"
FROM "Game"
WHERE "name" LIKE 'TEST:%'
ORDER BY "createdAt" DESC;
```

Inspect the JSON:
```sql
SELECT
  "gameCode",
  "gameConfig"->'capacityPerPlant' as capacity,
  "gameConfig"->'financial'->'startingCash' as cash
FROM "Game"
WHERE "gameCode" = 'OIL123ABC';
```

## Cleanup

Remove all test games:
```bash
npm run test:cleanup
```

This deletes all games with names starting with "TEST:".

## Manual E2E Test

To manually verify the frozen config is actually used in calculations:

1. Run `npm run test:snapshot`
2. Login to Game 3 (custom capacity 777,777)
3. Go to Decisions page
4. Submit a decision (any values)
5. Calculate round 1
6. Check Results → Production section
7. **Verify capacity shown is 777,777** (not the code default 900,000)

If capacity = 777,777 → ✅ Frozen config working!
If capacity = 900,000 → ❌ Bug: using code instead of snapshot

## Advanced: Simulate Code Change

To test that frozen config protects against code changes:

1. Run test, note Game 1's gameCode
2. Edit `src/engine/gameEngine.ts` line ~450:
   ```typescript
   // Change Oil capacity temporarily
   oil: {
     capacityPerPlant: 9999999, // ← Was 2000000
   }
   ```
3. Restart server
4. Login to Game 1
5. Play a round
6. **Verify capacity is still 2,000,000** (frozen in DB)
7. Revert the code change

If it still uses 2,000,000 → ✅ Snapshot protection working!
If it uses 9,999,999 → ❌ Bug: not reading from snapshot

## Files

- `test-config-snapshot.ts` - Main integration test
- `cleanup-test-games.ts` - Cleanup script
- `README_TESTING.md` - This file

## Next Steps: Automated Unit Tests

The script above creates real games for manual verification. For CI/CD, you'd want:

1. **Unit tests** for `resolveGameConfig()`:
   - Test null → fallback
   - Test object → return as-is
   - Test undefined → fallback

2. **Integration tests** for API:
   - POST /api/games → verify `gameConfig` stored
   - POST /api/games/:id/calculate-round → verify uses frozen config

3. **E2E tests** with Playwright/Cypress:
   - Create game → play round → verify UI shows frozen values

See `docs/snapshot_implementation_review.md` for the full test plan.
