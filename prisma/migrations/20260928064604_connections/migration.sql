-- CreateEnum
CREATE TYPE "ConnectionStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "ConnectionInitiator" AS ENUM ('BRAND', 'CREATOR');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'CONNECTION_REQUESTED';
ALTER TYPE "NotificationType" ADD VALUE 'CONNECTION_ACCEPTED';

-- CreateTable
CREATE TABLE "connections" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "initiator" "ConnectionInitiator" NOT NULL,
    "status" "ConnectionStatus" NOT NULL DEFAULT 'PENDING',
    "message" TEXT,
    "responseNote" TEXT,
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "connections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "connections_brandId_status_createdAt_idx" ON "connections"("brandId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "connections_creatorId_status_createdAt_idx" ON "connections"("creatorId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "connections_brandId_creatorId_key" ON "connections"("brandId", "creatorId");

-- AddForeignKey
ALTER TABLE "connections" ADD CONSTRAINT "connections_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connections" ADD CONSTRAINT "connections_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
