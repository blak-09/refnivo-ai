-- Additive only: optional request context on audit rows (actor role, salted IP
-- hash, truncated user agent, request id) plus an index for per-action review.
-- Existing rows keep NULLs; no data is rewritten.

-- AlterTable
ALTER TABLE "audit_logs" ADD COLUMN     "actorRole" "UserRole",
ADD COLUMN     "ipHash" TEXT,
ADD COLUMN     "requestId" TEXT,
ADD COLUMN     "userAgent" TEXT;

-- CreateIndex
CREATE INDEX "audit_logs_action_createdAt_idx" ON "audit_logs"("action", "createdAt");
