-- AlterTable: Add gamePin column with default for existing rows
ALTER TABLE "Game" ADD COLUMN "gamePin" VARCHAR(6);
UPDATE "Game" SET "gamePin" = LPAD(FLOOR(RANDOM() * 9000 + 1000)::TEXT, 4, '0') WHERE "gamePin" IS NULL;
ALTER TABLE "Game" ALTER COLUMN "gamePin" SET NOT NULL;

-- AlterTable: Add teamPin column with default for existing rows
ALTER TABLE "Team" ADD COLUMN "teamPin" VARCHAR(6);
UPDATE "Team" SET "teamPin" = LPAD(FLOOR(RANDOM() * 9000 + 1000)::TEXT, 4, '0') WHERE "teamPin" IS NULL;
ALTER TABLE "Team" ALTER COLUMN "teamPin" SET NOT NULL;
