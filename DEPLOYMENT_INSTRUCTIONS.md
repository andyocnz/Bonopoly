# Deployment Instructions - Phase 2 & Tech Cleanup

**Date**: 2026-01-23
**Status**: ⚠️ **READY TO DEPLOY** - Follow steps below

---

## ⚠️ IMPORTANT: Database Migration Required

The Prisma schema has been updated but the database has NOT been migrated yet.

**Current Error**: `The column TeamRoundResult.tsr does not exist in the current database`

**Reason**: Phase 2 removed 18 columns from the schema, but they still exist in the database.

---

## Step-by-Step Deployment

### Step 1: Stop Development Server

**CRITICAL**: You must stop the dev server before regenerating Prisma client.

```bash
# Stop your dev server (Ctrl+C in the terminal where it's running)
# Or kill the process
```

**Why**: Prisma files are locked while the server is running, causing `EPERM` errors.

---

### Step 2: Regenerate Prisma Client

After stopping the server, run:

```bash
npx prisma generate
```

**Expected Output**:
```
✔ Generated Prisma Client (5.22.0 | library) to ./node_modules/@prisma/client
```

**What this does**: Updates TypeScript types to match the new schema (without `tsr`, `salesUnitsUS`, etc.)

---

### Step 3: Run Database Migration

**⚠️ BACKUP FIRST** (recommended):

```bash
# If you have important data, backup the database first
pg_dump bonopoly_db > backup_before_phase2_$(date +%Y%m%d).sql
```

**Then run migration**:

```bash
npx prisma db push
```

**OR** (if you want to track migrations):

```bash
npx prisma migrate deploy
```

**What this does**: Removes the 18 duplicate columns from the `TeamRoundResult` table in the database.

**Columns being removed**:
- tsr, salesUnitsUS, salesUnitsAsia, salesUnitsEurope
- salesRevenueTotal, marketShareUS, marketShareAsia, marketShareEurope
- revenue, grossProfit, ebitda, netProfit
- totalAssets, totalEquity, cash
- sharePrice, eps, roe

---

### Step 4: Restart Development Server

```bash
npm run dev
```

**Expected**: Server should start without errors.

---

### Step 5: Verify Changes

**Test these critical paths**:

1. **View Existing Game Results**:
   - Navigate to a game with existing rounds
   - Check Results page displays correctly
   - Verify all financial data shows (sharePrice, revenue, etc.)
   - Should all come from `fullResults` JSON field

2. **Process New Round**:
   - Make decisions for a team
   - Process the round
   - Verify results save correctly
   - Check database: `fullResults` should contain all data

3. **Check Simulator**:
   - Open DecisionSimulator
   - Verify R&D section shows "Research Hours (from HR) → Feature Development"
   - Verify NO `featureInvestment` slider appears

4. **Admin Audit**:
   - Access `/admin/games/:gameId/results`
   - Should work without `tsr` column error

---

## What Changed

### Phase 2: Database Schema Cleanup

**Files Modified**: 3
- [prisma/schema.prisma](prisma/schema.prisma) - Removed 18 duplicate fields
- [src/server/routes/games.ts](src/server/routes/games.ts) - Stop writing duplicates
- [prisma/migrations/.../migration.sql](prisma/migrations/20260123000000_remove_duplicate_fields/migration.sql) - Migration script

**Impact**: TeamRoundResult table now has 7 columns instead of 25

### Tech Investment Dead Code Removal

**Files Modified**: 6
- [DecisionSimulator.tsx](src/components/DecisionSimulator.tsx)
- [aiEngine.ts](src/engine/aiEngine.ts)
- [mappings.ts](src/utils/mappings.ts)
- [gameEngine.ts](src/engine/gameEngine.ts)
- [EducatorGameView.tsx](src/pages/EducatorGameView.tsx)
- [SingleGameDashboard.tsx](src/pages/SingleGameDashboard.tsx)

**Impact**: Removed ~66 lines of non-functional code, simulator now matches engine

### Inventory Fix (Already Deployed)

**File Modified**: [gameEngine.ts](src/engine/gameEngine.ts) (2 locations)

**Impact**: Outsourced units now correctly enter inventory

---

## Rollback Plan (If Issues)

### If Migration Fails

```bash
# Restore from backup
psql bonopoly_db < backup_before_phase2_YYYYMMDD.sql

# Revert Prisma schema
git checkout HEAD -- prisma/schema.prisma

# Regenerate client
npx prisma generate
```

### If App Errors After Migration

**Check**:
1. Did Prisma client regenerate? (`npx prisma generate`)
2. Did migration complete? (`npx prisma migrate status`)
3. Are there TypeScript errors? (`npm run build`)

**Quick Fix**:
```bash
# Regenerate everything
npx prisma generate
npm run build
```

---

## Migration SQL (For Reference)

The migration will execute:

```sql
ALTER TABLE "TeamRoundResult" DROP COLUMN IF EXISTS "tsr";
ALTER TABLE "TeamRoundResult" DROP COLUMN IF EXISTS "salesUnitsUS";
ALTER TABLE "TeamRoundResult" DROP COLUMN IF EXISTS "salesUnitsAsia";
ALTER TABLE "TeamRoundResult" DROP COLUMN IF EXISTS "salesUnitsEurope";
ALTER TABLE "TeamRoundResult" DROP COLUMN IF EXISTS "salesRevenueTotal";
ALTER TABLE "TeamRoundResult" DROP COLUMN IF EXISTS "marketShareUS";
ALTER TABLE "TeamRoundResult" DROP COLUMN IF EXISTS "marketShareAsia";
ALTER TABLE "TeamRoundResult" DROP COLUMN IF EXISTS "marketShareEurope";
ALTER TABLE "TeamRoundResult" DROP COLUMN IF EXISTS "revenue";
ALTER TABLE "TeamRoundResult" DROP COLUMN IF EXISTS "grossProfit";
ALTER TABLE "TeamRoundResult" DROP COLUMN IF EXISTS "ebitda";
ALTER TABLE "TeamRoundResult" DROP COLUMN IF EXISTS "netProfit";
ALTER TABLE "TeamRoundResult" DROP COLUMN IF EXISTS "totalAssets";
ALTER TABLE "TeamRoundResult" DROP COLUMN IF EXISTS "totalEquity";
ALTER TABLE "TeamRoundResult" DROP COLUMN IF EXISTS "cash";
ALTER TABLE "TeamRoundResult" DROP COLUMN IF EXISTS "sharePrice";
ALTER TABLE "TeamRoundResult" DROP COLUMN IF EXISTS "eps";
ALTER TABLE "TeamRoundResult" DROP COLUMN IF EXISTS "roe";
```

**Safe**: Uses `IF EXISTS` so won't fail if columns already removed.

---

## Expected Timeline

| Step | Duration | Can Fail? |
|------|----------|-----------|
| Stop server | 5 seconds | No |
| Prisma generate | 10-30 seconds | No (if server stopped) |
| Database migration | 5-15 seconds | Unlikely (uses IF EXISTS) |
| Restart server | 30-60 seconds | No |
| **Total** | **~2 minutes** | Low risk |

---

## Production Deployment

**For staging/production**:

1. **Schedule maintenance window** (migration is fast but requires app restart)
2. **Backup database** (critical!)
3. **Run migration during low-traffic period**
4. **Monitor for errors** in first hour after deployment

```bash
# Production deployment
git pull
npm install
npx prisma generate
npx prisma migrate deploy  # Use migrate deploy for production
npm run build
pm2 restart app  # Or your process manager
```

---

## Support Documents

- [PHASE2_COMPLETION_SUMMARY.md](PHASE2_COMPLETION_SUMMARY.md) - Database cleanup details
- [TECH_DEAD_CODE_REMOVAL_SUMMARY.md](TECH_DEAD_CODE_REMOVAL_SUMMARY.md) - Tech code cleanup details
- [INVENTORY_FIX_SUMMARY.md](INVENTORY_FIX_SUMMARY.md) - Inventory outsourcing fix
- [PHASE1_COMPLETION_SUMMARY.md](PHASE1_COMPLETION_SUMMARY.md) - UI cleanup (already deployed)

---

## TL;DR - Quick Commands

```bash
# 1. Stop dev server (Ctrl+C)

# 2. Regenerate Prisma client
npx prisma generate

# 3. Run migration
npx prisma db push

# 4. Restart server
npm run dev
```

**Done!** 🎉

---

## Contact

If you encounter any issues during deployment, check:
1. Prisma client regenerated successfully
2. Migration executed without errors
3. Server started without TypeScript errors
4. Existing games still display correctly
