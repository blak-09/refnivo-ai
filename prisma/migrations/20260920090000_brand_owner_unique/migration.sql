-- One brand per owner (v1 rule) enforced by the database. Verified no owner has
-- more than one brand before applying. Replaces the plain index with a unique one.
DROP INDEX IF EXISTS "brands_ownerId_idx";
CREATE UNIQUE INDEX "brands_ownerId_key" ON "brands"("ownerId");
