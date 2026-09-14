-- Add an explicit approval state without storing or moving credentials.
CREATE TYPE "UserStatus_new" AS ENUM ('PENDING', 'APPROVED', 'SUSPENDED');

ALTER TABLE "users"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "UserStatus_new"
  USING CASE "status"::text WHEN 'ACTIVE' THEN 'APPROVED'::text ELSE "status"::text END::"UserStatus_new";

DROP TYPE "UserStatus";
ALTER TYPE "UserStatus_new" RENAME TO "UserStatus";
ALTER TABLE "users" ALTER COLUMN "status" SET DEFAULT 'PENDING';
