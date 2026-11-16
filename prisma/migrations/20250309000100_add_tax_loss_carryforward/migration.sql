-- Add tax loss carryforward support (new games only)
ALTER TABLE "Game" ADD COLUMN "taxLossCarryforwardEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "GameState" ADD COLUMN "taxLossCarryforward" DOUBLE PRECISION NOT NULL DEFAULT 0;
