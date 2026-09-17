-- Additive only: transactional e-mail outbox. New enum + new table; nothing
-- existing is altered, rewritten or dropped.

-- CreateEnum
CREATE TYPE "EmailStatus" AS ENUM ('PENDING', 'SENDING', 'SENT', 'FAILED');

-- CreateTable
CREATE TABLE "email_outbox" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "to" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "html" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "status" "EmailStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastError" TEXT,
    "providerId" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_outbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "email_outbox_idempotencyKey_key" ON "email_outbox"("idempotencyKey");

-- CreateIndex
CREATE INDEX "email_outbox_status_nextAttemptAt_idx" ON "email_outbox"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "email_outbox_userId_idx" ON "email_outbox"("userId");

-- AddForeignKey
ALTER TABLE "email_outbox" ADD CONSTRAINT "email_outbox_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
