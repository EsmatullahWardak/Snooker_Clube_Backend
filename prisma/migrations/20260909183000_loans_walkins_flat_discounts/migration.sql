-- Add pause support for active games and a lifecycle for customer loans.
ALTER TYPE "GameStatus" ADD VALUE 'PAUSED';

CREATE TYPE "LoanStatus" AS ENUM ('PENDING', 'PAID');

-- Percentage discounts are replaced by cashier-entered flat amounts at settlement.
ALTER TABLE "membership_types" DROP COLUMN "discountPercent";

ALTER TABLE "game_sessions"
  ALTER COLUMN "memberId" DROP NOT NULL,
  ALTER COLUMN "membershipCodeSnapshot" DROP NOT NULL,
  DROP COLUMN "discountPercentSnapshot",
  ADD COLUMN "pausedAt" TIMESTAMP(3),
  ADD COLUMN "totalPausedSeconds" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "manualAdjustmentAmount" DECIMAL(12,2) NOT NULL DEFAULT 0;

CREATE TABLE "loans" (
  "id" UUID NOT NULL,
  "playerName" VARCHAR(150) NOT NULL,
  "fatherName" VARCHAR(150),
  "phoneNumber" VARCHAR(30),
  "email" VARCHAR(255),
  "address" TEXT,
  "amount" DECIMAL(12,2) NOT NULL,
  "status" "LoanStatus" NOT NULL DEFAULT 'PENDING',
  "createdById" UUID NOT NULL,
  "updatedById" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "loans_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "loans_status_createdAt_idx" ON "loans"("status", "createdAt");
CREATE INDEX "loans_playerName_idx" ON "loans"("playerName");
CREATE INDEX "loans_phoneNumber_idx" ON "loans"("phoneNumber");

ALTER TABLE "loans"
  ADD CONSTRAINT "loans_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "loans"
  ADD CONSTRAINT "loans_updatedById_fkey"
  FOREIGN KEY ("updatedById") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "club_settings"
  ALTER COLUMN "clubName" SET DEFAULT 'Sultan snooker club';

UPDATE "club_settings"
SET "clubName" = 'Sultan snooker club'
WHERE "clubName" = 'Kabul Snooker Club';
