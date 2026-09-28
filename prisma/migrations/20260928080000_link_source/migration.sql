-- CreateEnum
CREATE TYPE "LinkSource" AS ENUM ('GENERAL', 'INSTAGRAM', 'YOUTUBE', 'FACEBOOK', 'LINKEDIN', 'X');

-- AlterTable: every existing link is the partner's everyday link.
ALTER TABLE "referral_links" ADD COLUMN "source" "LinkSource" NOT NULL DEFAULT 'GENERAL';

-- One link per partner per campaign PER SOURCE (was: one per partner per campaign).
-- Safe: all existing rows default to GENERAL, so the old pairs stay unique.
DROP INDEX "referral_links_campaignId_ownerId_key";
CREATE UNIQUE INDEX "referral_links_campaignId_ownerId_source_key" ON "referral_links"("campaignId", "ownerId", "source");
