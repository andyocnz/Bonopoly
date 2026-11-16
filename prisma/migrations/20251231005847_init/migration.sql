-- CreateEnum
CREATE TYPE "GameStatus" AS ENUM ('SETUP', 'ACTIVE', 'PAUSED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "RoundStatus" AS ENUM ('PENDING', 'ACTIVE', 'CALCULATING', 'COMPLETED');

-- CreateTable
CREATE TABLE "Game" (
    "id" TEXT NOT NULL,
    "gameCode" VARCHAR(10) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "status" "GameStatus" NOT NULL DEFAULT 'SETUP',
    "companyName" VARCHAR(50) NOT NULL DEFAULT 'TechCorp',
    "industry" VARCHAR(100) NOT NULL DEFAULT 'Electronics & Technology',
    "totalRounds" INTEGER NOT NULL DEFAULT 3,
    "hoursPerRound" INTEGER,
    "vsComputer" BOOLEAN NOT NULL DEFAULT false,
    "startingCash" DOUBLE PRECISION NOT NULL DEFAULT 30000000,
    "startingFactoriesUS" INTEGER NOT NULL DEFAULT 2,
    "startingFactoriesAsia" INTEGER NOT NULL DEFAULT 0,
    "capacityPerFactory" INTEGER NOT NULL DEFAULT 450000,
    "maxDebtRatio" DOUBLE PRECISION NOT NULL DEFAULT 0.4,
    "currentRound" INTEGER NOT NULL DEFAULT 0,
    "roundDeadline" TIMESTAMP(3),
    "scenarioSequence" INTEGER[] DEFAULT ARRAY[0, 1, 2, 3]::INTEGER[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "Game_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "teamCode" VARCHAR(20) NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "color" VARCHAR(7) NOT NULL DEFAULT '#1e3a5f',
    "isComputer" BOOLEAN NOT NULL DEFAULT false,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Round" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "roundNumber" INTEGER NOT NULL,
    "status" "RoundStatus" NOT NULL DEFAULT 'PENDING',
    "scenarioId" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "deadline" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "marketDemand" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Round_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameState" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "roundNumber" INTEGER NOT NULL,
    "factoriesUS" INTEGER NOT NULL DEFAULT 2,
    "factoriesAsia" INTEGER NOT NULL DEFAULT 0,
    "pendingInvestments" JSONB,
    "unlockedTechLevel" INTEGER NOT NULL DEFAULT 1,
    "unlockedFeatures" INTEGER NOT NULL DEFAULT 0,
    "cumulativeResearchHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "brandReputation" DOUBLE PRECISION NOT NULL DEFAULT 50,
    "inventory" INTEGER NOT NULL DEFAULT 0,
    "cashBalance" DOUBLE PRECISION NOT NULL DEFAULT 30000000,
    "longTermDebt" DOUBLE PRECISION NOT NULL DEFAULT 30000000,
    "shareCapital" DOUBLE PRECISION NOT NULL DEFAULT 70000000,
    "retainedEarnings" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Decision" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "roundNumber" INTEGER NOT NULL,
    "isSubmitted" BOOLEAN NOT NULL DEFAULT false,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "submittedAt" TIMESTAMP(3),
    "production" JSONB,
    "hr" JSONB,
    "rnd" JSONB,
    "investment" JSONB,
    "logistics" JSONB,
    "marketing" JSONB,
    "finance" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Decision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamRoundResult" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "roundNumber" INTEGER NOT NULL,
    "rank" INTEGER NOT NULL,
    "tsr" DOUBLE PRECISION NOT NULL,
    "salesUnitsUS" INTEGER NOT NULL,
    "salesUnitsAsia" INTEGER NOT NULL,
    "salesUnitsEurope" INTEGER NOT NULL,
    "salesRevenueTotal" DOUBLE PRECISION NOT NULL,
    "marketShareUS" DOUBLE PRECISION NOT NULL,
    "marketShareAsia" DOUBLE PRECISION NOT NULL,
    "marketShareEurope" DOUBLE PRECISION NOT NULL,
    "revenue" DOUBLE PRECISION NOT NULL,
    "grossProfit" DOUBLE PRECISION NOT NULL,
    "ebitda" DOUBLE PRECISION NOT NULL,
    "netProfit" DOUBLE PRECISION NOT NULL,
    "totalAssets" DOUBLE PRECISION NOT NULL,
    "totalEquity" DOUBLE PRECISION NOT NULL,
    "cash" DOUBLE PRECISION NOT NULL,
    "sharePrice" DOUBLE PRECISION NOT NULL,
    "eps" DOUBLE PRECISION NOT NULL,
    "roe" DOUBLE PRECISION NOT NULL,
    "fullResults" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamRoundResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Game_gameCode_key" ON "Game"("gameCode");

-- CreateIndex
CREATE INDEX "Game_gameCode_idx" ON "Game"("gameCode");

-- CreateIndex
CREATE INDEX "Game_status_idx" ON "Game"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Team_teamCode_key" ON "Team"("teamCode");

-- CreateIndex
CREATE INDEX "Team_gameId_idx" ON "Team"("gameId");

-- CreateIndex
CREATE INDEX "Team_teamCode_idx" ON "Team"("teamCode");

-- CreateIndex
CREATE INDEX "Round_gameId_idx" ON "Round"("gameId");

-- CreateIndex
CREATE UNIQUE INDEX "Round_gameId_roundNumber_key" ON "Round"("gameId", "roundNumber");

-- CreateIndex
CREATE INDEX "GameState_teamId_idx" ON "GameState"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "GameState_teamId_roundNumber_key" ON "GameState"("teamId", "roundNumber");

-- CreateIndex
CREATE INDEX "Decision_teamId_idx" ON "Decision"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "Decision_teamId_roundNumber_key" ON "Decision"("teamId", "roundNumber");

-- CreateIndex
CREATE INDEX "TeamRoundResult_gameId_roundNumber_idx" ON "TeamRoundResult"("gameId", "roundNumber");

-- CreateIndex
CREATE UNIQUE INDEX "TeamRoundResult_teamId_roundNumber_key" ON "TeamRoundResult"("teamId", "roundNumber");

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Round" ADD CONSTRAINT "Round_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameState" ADD CONSTRAINT "GameState_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Decision" ADD CONSTRAINT "Decision_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamRoundResult" ADD CONSTRAINT "TeamRoundResult_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
