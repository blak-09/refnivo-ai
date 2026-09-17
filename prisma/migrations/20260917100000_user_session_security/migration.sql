-- Additive only: session revocation + forced password rotation.
-- Every existing user gets sessionVersion = 1 (matches tokens issued before this
-- change) and mustChangePassword = false, so nobody is logged out or forced to
-- rotate by this migration. No rows are rewritten; no credentials are touched.

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "lastLoginAt" TIMESTAMP(3),
ADD COLUMN     "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "passwordChangedAt" TIMESTAMP(3),
ADD COLUMN     "sessionVersion" INTEGER NOT NULL DEFAULT 1;
