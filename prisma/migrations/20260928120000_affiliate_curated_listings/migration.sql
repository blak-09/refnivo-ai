-- Curated listings: a programme Refnivo lists from public information before the
-- brand has a Refnivo account. Such rows carry a brand name instead of a brandId.
ALTER TABLE "affiliate_programs" ALTER COLUMN "brandId" DROP NOT NULL;
ALTER TABLE "affiliate_programs" ADD COLUMN "brandName" TEXT;

-- Every listing names its brand one way or the other.
ALTER TABLE "affiliate_programs" ADD CONSTRAINT "affiliate_programs_brand_present" CHECK ("brandId" IS NOT NULL OR "brandName" IS NOT NULL);

-- Commission type and joining rules are often not published. Null means "not
-- stated"; a default would silently claim terms the programme never gave.
ALTER TABLE "affiliate_programs" ALTER COLUMN "commissionType" DROP NOT NULL;
ALTER TABLE "affiliate_programs" ALTER COLUMN "commissionType" DROP DEFAULT;
ALTER TABLE "affiliate_programs" ALTER COLUMN "approvalType" DROP NOT NULL;
ALTER TABLE "affiliate_programs" ALTER COLUMN "approvalType" DROP DEFAULT;
