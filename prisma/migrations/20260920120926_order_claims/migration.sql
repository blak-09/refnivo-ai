-- CreateEnum
CREATE TYPE "OrderClaimStatus" AS ENUM ('PENDING', 'CONFIRMED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ClaimEvidence" AS ENUM ('LAST_CLICK', 'CODE_ENTERED');

-- AlterEnum
ALTER TYPE "ConversionSource" ADD VALUE 'CUSTOMER_CLAIM';

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'ORDER_CLAIMED';

-- CreateTable
CREATE TABLE "order_claims" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "referralLinkId" TEXT NOT NULL,
    "customerId" TEXT,
    "contactHash" TEXT NOT NULL,
    "contactMasked" TEXT NOT NULL,
    "orderReference" TEXT NOT NULL,
    "orderReferenceKey" TEXT NOT NULL,
    "note" TEXT,
    "evidence" "ClaimEvidence" NOT NULL,
    "clickedAt" TIMESTAMP(3),
    "status" "OrderClaimStatus" NOT NULL DEFAULT 'PENDING',
    "rejectionReason" TEXT,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "referralId" TEXT,
    "ipHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_claims_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "order_claims_referralId_key" ON "order_claims"("referralId");

-- CreateIndex
CREATE INDEX "order_claims_brandId_status_createdAt_idx" ON "order_claims"("brandId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "order_claims_campaignId_status_idx" ON "order_claims"("campaignId", "status");

-- CreateIndex
CREATE INDEX "order_claims_customerId_idx" ON "order_claims"("customerId");

-- CreateIndex
CREATE INDEX "order_claims_contactHash_idx" ON "order_claims"("contactHash");

-- CreateIndex
CREATE UNIQUE INDEX "order_claims_brandId_orderReferenceKey_key" ON "order_claims"("brandId", "orderReferenceKey");

-- AddForeignKey
ALTER TABLE "order_claims" ADD CONSTRAINT "order_claims_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_claims" ADD CONSTRAINT "order_claims_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_claims" ADD CONSTRAINT "order_claims_referralLinkId_fkey" FOREIGN KEY ("referralLinkId") REFERENCES "referral_links"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_claims" ADD CONSTRAINT "order_claims_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_claims" ADD CONSTRAINT "order_claims_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_claims" ADD CONSTRAINT "order_claims_referralId_fkey" FOREIGN KEY ("referralId") REFERENCES "referrals"("id") ON DELETE SET NULL ON UPDATE CASCADE;
