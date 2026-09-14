-- Manual verification workflow: add REJECTED status and the verification/audit
-- columns. The password hash stays in `passwordHash` only — no column is added
-- for it, and nothing here moves credentials anywhere.

-- AlterEnum
ALTER TYPE "UserStatus" ADD VALUE 'REJECTED';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approvedById" TEXT,
ADD COLUMN     "registrationDetails" JSONB,
ADD COLUMN     "registrationId" TEXT,
ADD COLUMN     "rejectedAt" TIMESTAMP(3),
ADD COLUMN     "rejectionReason" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "users_registrationId_key" ON "users"("registrationId");
