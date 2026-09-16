-- Additive only: composite index for the recordClick / markVisited lookup
-- (referralLinkId + anonymousVisitorId) and the referral_links FK.
-- Safe on live data; no rows are touched.

-- CreateIndex
CREATE INDEX "referrals_referralLinkId_anonymousVisitorId_idx" ON "referrals"("referralLinkId", "anonymousVisitorId");
