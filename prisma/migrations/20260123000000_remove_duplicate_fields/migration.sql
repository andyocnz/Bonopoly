-- Remove duplicate fields from TeamRoundResult
-- Phase 2: Database Schema Migration
-- Date: 2026-01-23
--
-- All UI code has been updated to read from fullResults only (Phase 1 complete)
-- Now we remove the duplicate columns from the database schema

-- Drop duplicate columns (keeping only rank and fullResults)
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

-- Remaining schema after cleanup:
-- TeamRoundResult {
--   id          String   @id
--   teamId      String
--   gameId      String
--   roundNumber Int
--   rank        Int
--   fullResults Json     -- Single source of truth
--   createdAt   DateTime
-- }
