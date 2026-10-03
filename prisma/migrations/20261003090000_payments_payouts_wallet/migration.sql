-- Payments phase 2–4: saved payout accounts (encrypted), automatic payout tracking,
-- and the brand wallet ledger. Additive only: no existing column or row changes.

-- CreateEnum
CREATE TYPE "PayoutAccountType" AS ENUM ('UPI', 'BANK');

-- CreateEnum
CREATE TYPE "WalletEntryType" AS ENUM ('TOPUP', 'TOPUP_REFUND', 'ORDER_DEBIT', 'REVERSAL_CREDIT', 'ADJUSTMENT');

-- AlterEnum
ALTER TYPE "PaymentPurpose" ADD VALUE 'WALLET_TOPUP';

-- AlterTable
ALTER TABLE "payout_requests" ADD COLUMN     "initiatedById" TEXT,
ADD COLUMN     "payoutAccountId" TEXT,
ADD COLUMN     "provider" TEXT,
ADD COLUMN     "providerAttempt" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "providerPayoutId" TEXT,
ADD COLUMN     "providerStatus" TEXT;

-- CreateTable
CREATE TABLE "payout_accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "PayoutAccountType" NOT NULL,
    "holderName" TEXT NOT NULL,
    "encryptedDetails" TEXT NOT NULL,
    "maskedLabel" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "providerContactId" TEXT,
    "providerFundAccountId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "payout_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brand_wallets" (
    "brandId" TEXT NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brand_wallets_pkey" PRIMARY KEY ("brandId")
);

-- CreateTable
CREATE TABLE "wallet_entries" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "type" "WalletEntryType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "referralId" TEXT,
    "paymentTransactionId" TEXT,
    "note" TEXT,
    "actorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallet_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "payout_accounts_userId_deletedAt_idx" ON "payout_accounts"("userId", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "wallet_entries_idempotencyKey_key" ON "wallet_entries"("idempotencyKey");

-- CreateIndex
CREATE INDEX "wallet_entries_brandId_createdAt_idx" ON "wallet_entries"("brandId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "payout_requests_providerPayoutId_key" ON "payout_requests"("providerPayoutId");

-- AddForeignKey
ALTER TABLE "payout_requests" ADD CONSTRAINT "payout_requests_payoutAccountId_fkey" FOREIGN KEY ("payoutAccountId") REFERENCES "payout_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payout_accounts" ADD CONSTRAINT "payout_accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brand_wallets" ADD CONSTRAINT "brand_wallets_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_entries" ADD CONSTRAINT "wallet_entries_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brand_wallets"("brandId") ON DELETE CASCADE ON UPDATE CASCADE;

