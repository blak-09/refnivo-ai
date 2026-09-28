-- CreateEnum
CREATE TYPE "AffiliateProgramStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'PAUSED', 'CLOSED');

-- CreateEnum
CREATE TYPE "AffiliateCommissionType" AS ENUM ('PERCENTAGE', 'FIXED', 'VARIES');

-- CreateEnum
CREATE TYPE "AffiliateApprovalType" AS ENUM ('AUTOMATIC', 'APPLICATION', 'INVITE_ONLY');

-- CreateEnum
CREATE TYPE "AffiliateLinkStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateTable
CREATE TABLE "affiliate_programs" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "websiteUrl" TEXT,
    "programUrl" TEXT,
    "signupUrl" TEXT NOT NULL,
    "logoUrl" TEXT,
    "commissionType" "AffiliateCommissionType" NOT NULL DEFAULT 'VARIES',
    "commissionDescription" TEXT,
    "cookieDurationDays" INTEGER,
    "networkName" TEXT,
    "approvalType" "AffiliateApprovalType" NOT NULL DEFAULT 'APPLICATION',
    "status" "AffiliateProgramStatus" NOT NULL DEFAULT 'DRAFT',
    "minFollowers" INTEGER,
    "supportedPlatforms" "SocialPlatform"[] DEFAULT ARRAY[]::"SocialPlatform"[],
    "geography" TEXT,
    "requirements" TEXT,
    "subIdParam" TEXT,
    "submittedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "reviewNote" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "affiliate_programs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "creator_affiliate_links" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "affiliateProgramId" TEXT NOT NULL,
    "targetUrl" TEXT NOT NULL,
    "status" "AffiliateLinkStatus" NOT NULL DEFAULT 'ACTIVE',
    "externalAffiliateId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "creator_affiliate_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "affiliate_tracking_codes" (
    "id" TEXT NOT NULL,
    "creatorAffiliateLinkId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "source" "LinkSource" NOT NULL DEFAULT 'GENERAL',
    "status" "AffiliateLinkStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "affiliate_tracking_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "affiliate_clicks" (
    "id" TEXT NOT NULL,
    "trackingCodeId" TEXT NOT NULL,
    "creatorAffiliateLinkId" TEXT NOT NULL,
    "affiliateProgramId" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "source" "LinkSource" NOT NULL,
    "anonymousVisitorId" TEXT,
    "ipHash" TEXT,
    "userAgent" TEXT,
    "referer" TEXT,
    "subId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "affiliate_clicks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "affiliate_programs_slug_key" ON "affiliate_programs"("slug");

-- CreateIndex
CREATE INDEX "affiliate_programs_status_updatedAt_idx" ON "affiliate_programs"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "affiliate_programs_brandId_status_idx" ON "affiliate_programs"("brandId", "status");

-- CreateIndex
CREATE INDEX "affiliate_programs_category_status_idx" ON "affiliate_programs"("category", "status");

-- CreateIndex
CREATE INDEX "creator_affiliate_links_affiliateProgramId_idx" ON "creator_affiliate_links"("affiliateProgramId");

-- CreateIndex
CREATE UNIQUE INDEX "creator_affiliate_links_creatorId_affiliateProgramId_key" ON "creator_affiliate_links"("creatorId", "affiliateProgramId");

-- CreateIndex
CREATE UNIQUE INDEX "affiliate_tracking_codes_code_key" ON "affiliate_tracking_codes"("code");

-- CreateIndex
CREATE UNIQUE INDEX "affiliate_tracking_codes_creatorAffiliateLinkId_source_key" ON "affiliate_tracking_codes"("creatorAffiliateLinkId", "source");

-- CreateIndex
CREATE INDEX "affiliate_clicks_creatorAffiliateLinkId_createdAt_idx" ON "affiliate_clicks"("creatorAffiliateLinkId", "createdAt");

-- CreateIndex
CREATE INDEX "affiliate_clicks_affiliateProgramId_createdAt_idx" ON "affiliate_clicks"("affiliateProgramId", "createdAt");

-- CreateIndex
CREATE INDEX "affiliate_clicks_creatorId_createdAt_idx" ON "affiliate_clicks"("creatorId", "createdAt");

-- AddForeignKey
ALTER TABLE "affiliate_programs" ADD CONSTRAINT "affiliate_programs_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_programs" ADD CONSTRAINT "affiliate_programs_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creator_affiliate_links" ADD CONSTRAINT "creator_affiliate_links_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creator_affiliate_links" ADD CONSTRAINT "creator_affiliate_links_affiliateProgramId_fkey" FOREIGN KEY ("affiliateProgramId") REFERENCES "affiliate_programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_tracking_codes" ADD CONSTRAINT "affiliate_tracking_codes_creatorAffiliateLinkId_fkey" FOREIGN KEY ("creatorAffiliateLinkId") REFERENCES "creator_affiliate_links"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_clicks" ADD CONSTRAINT "affiliate_clicks_trackingCodeId_fkey" FOREIGN KEY ("trackingCodeId") REFERENCES "affiliate_tracking_codes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_clicks" ADD CONSTRAINT "affiliate_clicks_creatorAffiliateLinkId_fkey" FOREIGN KEY ("creatorAffiliateLinkId") REFERENCES "creator_affiliate_links"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_clicks" ADD CONSTRAINT "affiliate_clicks_affiliateProgramId_fkey" FOREIGN KEY ("affiliateProgramId") REFERENCES "affiliate_programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
