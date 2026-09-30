-- Richer listing metadata for the affiliate-program marketplace. Additive only.
CREATE TYPE "AffiliateProgramType" AS ENUM ('AFFILIATE', 'CREATOR_AFFILIATE', 'REFERRAL', 'INFLUENCER', 'PARTNER', 'AFFILIATE_NETWORK', 'CREATOR_COMMERCE');

ALTER TABLE "affiliate_programs" ADD COLUMN "programType" "AffiliateProgramType" NOT NULL DEFAULT 'AFFILIATE';
ALTER TABLE "affiliate_programs" ADD COLUMN "subcategory" TEXT;
ALTER TABLE "affiliate_programs" ADD COLUMN "bestFor" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "affiliate_programs" ADD COLUMN "featured" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "affiliate_programs" ADD COLUMN "sourceUrl" TEXT;
ALTER TABLE "affiliate_programs" ADD COLUMN "linkCheckedAt" TIMESTAMP(3);
ALTER TABLE "affiliate_programs" ADD COLUMN "linkStatus" TEXT;

CREATE INDEX "affiliate_programs_featured_status_idx" ON "affiliate_programs"("featured", "status");
