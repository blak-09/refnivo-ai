-- Audit fixes (docs/AUDIT.md W2, W3, W7). Idempotent: safe to run more than once.

-- W3: commission hold. Existing campaigns keep paying out immediately (0 days);
-- new campaigns default to a 14-day hold.
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "holdDays" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "campaigns" ALTER COLUMN "holdDays" SET DEFAULT 14;

-- W7: store coupon for the shopper offer.
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "couponCode" TEXT;

-- W2: when a campaign stopped taking referrals (pause / early end).
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "stoppedAt" TIMESTAMP(3);
UPDATE "campaigns" SET "stoppedAt" = "updatedAt" WHERE "stoppedAt" IS NULL AND "status" IN ('PAUSED', 'ENDED');

-- W3: when a verified ledger row becomes payable.
ALTER TABLE "commissions" ADD COLUMN IF NOT EXISTS "payableAt" TIMESTAMP(3);
ALTER TABLE "rewards" ADD COLUMN IF NOT EXISTS "payableAt" TIMESTAMP(3);

-- W2 + W3: order date and partner contests.
ALTER TABLE "conversions" ADD COLUMN IF NOT EXISTS "orderedAt" TIMESTAMP(3);
ALTER TABLE "conversions" ADD COLUMN IF NOT EXISTS "contestedAt" TIMESTAMP(3);
ALTER TABLE "conversions" ADD COLUMN IF NOT EXISTS "contestReason" TEXT;
ALTER TABLE "conversions" ADD COLUMN IF NOT EXISTS "contestResolvedAt" TIMESTAMP(3);
ALTER TABLE "conversions" ADD COLUMN IF NOT EXISTS "contestOutcome" TEXT;
ALTER TABLE "conversions" ADD COLUMN IF NOT EXISTS "contestNote" TEXT;
CREATE INDEX IF NOT EXISTS "conversions_contestedAt_idx" ON "conversions"("contestedAt");
