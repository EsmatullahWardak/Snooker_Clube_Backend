ALTER TABLE "loans" ADD COLUMN "paidAt" TIMESTAMP(3);

UPDATE "loans"
SET "paidAt" = "updatedAt"
WHERE "status" = 'PAID';

CREATE INDEX "loans_paidAt_idx" ON "loans"("paidAt");
