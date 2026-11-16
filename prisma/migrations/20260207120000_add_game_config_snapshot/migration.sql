-- Add per-game immutable engine configuration snapshot.
ALTER TABLE "Game"
ADD COLUMN IF NOT EXISTS "gameConfig" JSONB;

