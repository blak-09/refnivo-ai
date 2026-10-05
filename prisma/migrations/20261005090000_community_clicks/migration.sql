-- Refnivo Network: anonymous click counts for the community join CTAs. Additive only.

-- CreateEnum
CREATE TYPE "CommunityAudience" AS ENUM ('CREATOR', 'BRAND', 'GENERAL');

-- CreateTable
CREATE TABLE "community_clicks" (
    "id" TEXT NOT NULL,
    "audience" "CommunityAudience" NOT NULL,
    "placement" TEXT NOT NULL,
    "role" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "community_clicks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "community_clicks_createdAt_idx" ON "community_clicks"("createdAt");

-- CreateIndex
CREATE INDEX "community_clicks_audience_createdAt_idx" ON "community_clicks"("audience", "createdAt");
