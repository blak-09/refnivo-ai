-- Additive only. New enum values, nullable/defaulted columns and new tables.
-- No existing rows are rewritten or deleted; no table or column is dropped.
--
--  * ApplicationStatus  + WITHDRAWN, REMOVED     (creator withdraws / brand removes a partner)
--  * ReferralStatus     + REFUNDED               (verified order refunded → ledger reversed)
--  * CommissionStatus   + REVERSED
--  * RewardStatus       + REVERSED
--  * PayoutStatus       + FAILED
--  * users              + emailNotifications, suspendedAt, suspensionReason
--  * conversions        + reversedAt, reversalReason
--  * payout_requests    + kind, processedById
--  * payout_items, notifications, password_reset_tokens (new tables)

-- AlterEnum
ALTER TYPE "ApplicationStatus" ADD VALUE 'WITHDRAWN';
ALTER TYPE "ApplicationStatus" ADD VALUE 'REMOVED';

-- AlterEnum
ALTER TYPE "ReferralStatus" ADD VALUE 'REFUNDED';

-- AlterEnum
ALTER TYPE "CommissionStatus" ADD VALUE 'REVERSED';

-- AlterEnum
ALTER TYPE "RewardStatus" ADD VALUE 'REVERSED';

-- AlterEnum
ALTER TYPE "PayoutStatus" ADD VALUE 'FAILED';

-- CreateEnum
CREATE TYPE "PayoutKind" AS ENUM ('COMMISSION', 'REWARD');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('APPLICATION_RECEIVED', 'APPLICATION_APPROVED', 'APPLICATION_REJECTED', 'PARTNER_REMOVED', 'CAMPAIGN_PUBLISHED', 'CAMPAIGN_PAUSED', 'ORDER_RECORDED', 'CONVERSION_VERIFIED', 'CONVERSION_REJECTED', 'CONVERSION_REVERSED', 'PAYOUT_REQUESTED', 'PAYOUT_UPDATED', 'ACCOUNT_APPROVED', 'ACCOUNT_REJECTED', 'ACCOUNT_SUSPENDED', 'ACCOUNT_REACTIVATED', 'VERIFICATION_UPDATED', 'SYSTEM');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "emailNotifications" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "suspendedAt" TIMESTAMP(3),
ADD COLUMN     "suspensionReason" TEXT;

-- AlterTable
ALTER TABLE "conversions" ADD COLUMN     "reversalReason" TEXT,
ADD COLUMN     "reversedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "payout_requests" ADD COLUMN     "kind" "PayoutKind" NOT NULL DEFAULT 'COMMISSION',
ADD COLUMN     "processedById" TEXT;

-- CreateTable
CREATE TABLE "payout_items" (
    "id" TEXT NOT NULL,
    "payoutRequestId" TEXT NOT NULL,
    "commissionId" TEXT,
    "rewardId" TEXT,
    "amount" INTEGER NOT NULL,

    CONSTRAINT "payout_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "href" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payout_items_commissionId_key" ON "payout_items"("commissionId");

-- CreateIndex
CREATE UNIQUE INDEX "payout_items_rewardId_key" ON "payout_items"("rewardId");

-- CreateIndex
CREATE INDEX "payout_items_payoutRequestId_idx" ON "payout_items"("payoutRequestId");

-- CreateIndex
CREATE INDEX "notifications_userId_readAt_createdAt_idx" ON "notifications"("userId", "readAt", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_tokenHash_key" ON "password_reset_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "password_reset_tokens_userId_idx" ON "password_reset_tokens"("userId");

-- AddForeignKey
ALTER TABLE "payout_items" ADD CONSTRAINT "payout_items_payoutRequestId_fkey" FOREIGN KEY ("payoutRequestId") REFERENCES "payout_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payout_items" ADD CONSTRAINT "payout_items_commissionId_fkey" FOREIGN KEY ("commissionId") REFERENCES "commissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payout_items" ADD CONSTRAINT "payout_items_rewardId_fkey" FOREIGN KEY ("rewardId") REFERENCES "rewards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
