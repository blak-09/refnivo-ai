-- Self-service account deletion marker. Additive: one nullable column.
ALTER TABLE "users" ADD COLUMN "deletedAt" TIMESTAMP(3);
