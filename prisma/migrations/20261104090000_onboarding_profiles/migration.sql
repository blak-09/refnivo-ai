-- Onboarding & profile creation (role → profile → review).
-- Additive only: new nullable/defaulted columns and one new table. Safe to
-- re-run (IF NOT EXISTS / ON CONFLICT guards) so it can be rehearsed.

-- Users: onboarding state.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "onboardingCompletedAt" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "onboardingDraft" JSONB;

-- Brands: richer profile.
ALTER TABLE "brands" ADD COLUMN IF NOT EXISTS "businessEmail" TEXT;
ALTER TABLE "brands" ADD COLUMN IF NOT EXISTS "contactName" TEXT;
ALTER TABLE "brands" ADD COLUMN IF NOT EXISTS "state" TEXT;
ALTER TABLE "brands" ADD COLUMN IF NOT EXISTS "city" TEXT;
ALTER TABLE "brands" ADD COLUMN IF NOT EXISTS "productCategories" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "brands" ADD COLUMN IF NOT EXISTS "targetAudience" TEXT;
ALTER TABLE "brands" ADD COLUMN IF NOT EXISTS "productDescription" TEXT;
ALTER TABLE "brands" ADD COLUMN IF NOT EXISTS "collaborationTypes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Creator profiles: richer profile.
ALTER TABLE "creator_profiles" ADD COLUMN IF NOT EXISTS "linkedinUrl" TEXT;
ALTER TABLE "creator_profiles" ADD COLUMN IF NOT EXISTS "facebookUrl" TEXT;
ALTER TABLE "creator_profiles" ADD COLUMN IF NOT EXISTS "otherLinks" JSONB;
ALTER TABLE "creator_profiles" ADD COLUMN IF NOT EXISTS "primaryPlatform" TEXT;
ALTER TABLE "creator_profiles" ADD COLUMN IF NOT EXISTS "audienceSize" TEXT;
ALTER TABLE "creator_profiles" ADD COLUMN IF NOT EXISTS "contentLanguage" TEXT;
ALTER TABLE "creator_profiles" ADD COLUMN IF NOT EXISTS "country" TEXT;
ALTER TABLE "creator_profiles" ADD COLUMN IF NOT EXISTS "state" TEXT;
ALTER TABLE "creator_profiles" ADD COLUMN IF NOT EXISTS "city" TEXT;
ALTER TABLE "creator_profiles" ADD COLUMN IF NOT EXISTS "contentDescription" TEXT;
ALTER TABLE "creator_profiles" ADD COLUMN IF NOT EXISTS "collaborationPreferences" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "creator_profiles" ADD COLUMN IF NOT EXISTS "interestedCategories" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Customer profiles.
CREATE TABLE IF NOT EXISTS "customer_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "bio" TEXT,
    "country" TEXT NOT NULL DEFAULT 'India',
    "state" TEXT,
    "city" TEXT,
    "gender" TEXT,
    "interests" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "preferredCategories" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "favouriteBrands" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_profiles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "customer_profiles_userId_key" ON "customer_profiles"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "customer_profiles_username_key" ON "customer_profiles"("username");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'customer_profiles_userId_fkey') THEN
    ALTER TABLE "customer_profiles" ADD CONSTRAINT "customer_profiles_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Backfill: accounts that already have what their dashboard needs are treated
-- as onboarded, so nobody who signed up before this change is sent through it
-- again. Brand owners without a brand, creators without a profile and
-- customers (who had no profile until now) stay NULL and are asked to finish.
UPDATE "users" u SET "onboardingCompletedAt" = u."createdAt"
WHERE u."onboardingCompletedAt" IS NULL
  AND (
    u."role" = 'ADMIN'
    OR (u."role" = 'BRAND_OWNER' AND EXISTS (SELECT 1 FROM "brands" b WHERE b."ownerId" = u."id"))
    OR (u."role" = 'CREATOR' AND EXISTS (SELECT 1 FROM "creator_profiles" c WHERE c."userId" = u."id"))
  );

-- Creator categories now follow the onboarding list ("Technology", not "Tech & gadgets").
UPDATE "creator_profiles" SET "category" = 'Technology' WHERE "category" = 'Tech & gadgets';
