-- Creator partnerships (private partner notes) and UGC collaborations.
-- Idempotent: safe to re-run (IF NOT EXISTS / guarded DO blocks).

DO $$ BEGIN
  CREATE TYPE "UgcBriefStatus" AS ENUM ('DRAFT', 'OPEN', 'CLOSED', 'ARCHIVED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "UgcCollabStatus" AS ENUM ('APPLIED', 'DECLINED', 'WITHDRAWN', 'IN_PROGRESS', 'SUBMITTED', 'REVISION_REQUESTED', 'APPROVED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'UGC_UPDATE';

CREATE TABLE IF NOT EXISTS "partner_notes" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "partner_notes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ugc_briefs" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "productId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "deliverables" TEXT NOT NULL,
    "contentTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "feeAmount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "creatorsNeeded" INTEGER NOT NULL DEFAULT 1,
    "usageRights" TEXT NOT NULL,
    "usageNotes" TEXT,
    "productShipped" BOOLEAN NOT NULL DEFAULT false,
    "applyBy" TIMESTAMP(3),
    "deliverBy" TIMESTAMP(3),
    "status" "UgcBriefStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ugc_briefs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ugc_collaborations" (
    "id" TEXT NOT NULL,
    "briefId" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "status" "UgcCollabStatus" NOT NULL DEFAULT 'APPLIED',
    "pitch" TEXT NOT NULL,
    "portfolioLinks" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "agreedFee" INTEGER,
    "brandNote" TEXT,
    "acceptedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "paidMarkedAt" TIMESTAMP(3),
    "paymentReference" TEXT,
    "paidConfirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ugc_collaborations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ugc_submissions" (
    "id" TEXT NOT NULL,
    "collaborationId" TEXT NOT NULL,
    "round" INTEGER NOT NULL,
    "note" TEXT,
    "imageUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "links" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "decision" "UgcCollabStatus",
    "feedback" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ugc_submissions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "partner_notes_brandId_creatorId_createdAt_idx" ON "partner_notes"("brandId", "creatorId", "createdAt");
CREATE INDEX IF NOT EXISTS "ugc_briefs_brandId_status_idx" ON "ugc_briefs"("brandId", "status");
CREATE INDEX IF NOT EXISTS "ugc_briefs_status_publishedAt_idx" ON "ugc_briefs"("status", "publishedAt");
CREATE INDEX IF NOT EXISTS "ugc_collaborations_creatorId_status_idx" ON "ugc_collaborations"("creatorId", "status");
CREATE INDEX IF NOT EXISTS "ugc_collaborations_briefId_status_idx" ON "ugc_collaborations"("briefId", "status");
CREATE UNIQUE INDEX IF NOT EXISTS "ugc_collaborations_briefId_creatorId_key" ON "ugc_collaborations"("briefId", "creatorId");
CREATE UNIQUE INDEX IF NOT EXISTS "ugc_submissions_collaborationId_round_key" ON "ugc_submissions"("collaborationId", "round");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'partner_notes_brandId_fkey') THEN
    ALTER TABLE "partner_notes" ADD CONSTRAINT "partner_notes_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'partner_notes_creatorId_fkey') THEN
    ALTER TABLE "partner_notes" ADD CONSTRAINT "partner_notes_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'partner_notes_authorId_fkey') THEN
    ALTER TABLE "partner_notes" ADD CONSTRAINT "partner_notes_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ugc_briefs_brandId_fkey') THEN
    ALTER TABLE "ugc_briefs" ADD CONSTRAINT "ugc_briefs_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ugc_briefs_productId_fkey') THEN
    ALTER TABLE "ugc_briefs" ADD CONSTRAINT "ugc_briefs_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ugc_collaborations_briefId_fkey') THEN
    ALTER TABLE "ugc_collaborations" ADD CONSTRAINT "ugc_collaborations_briefId_fkey" FOREIGN KEY ("briefId") REFERENCES "ugc_briefs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ugc_collaborations_creatorId_fkey') THEN
    ALTER TABLE "ugc_collaborations" ADD CONSTRAINT "ugc_collaborations_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ugc_submissions_collaborationId_fkey') THEN
    ALTER TABLE "ugc_submissions" ADD CONSTRAINT "ugc_submissions_collaborationId_fkey" FOREIGN KEY ("collaborationId") REFERENCES "ugc_collaborations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
