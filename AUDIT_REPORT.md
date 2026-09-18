# Refnivo AI — Production Readiness & Engineering Audit

**Scope:** full repository at commit `81e0e7f` (main), plus read-only probes of https://refnivo-ai.vercel.app.
**Date:** 2026-09-18. **Mode:** read-only — no production code, data or secrets were changed. Two runtime checks were reproduced on the *local* dev database only (throw-away users, deleted afterwards).
**Severity:** P0 = blocks launch / money or data at risk now · P1 = must fix before real customers rely on it · P2 = fix in the first weeks · P3 = hygiene.
**Confidence:** *Confirmed* = reproduced or unambiguous in code · *Likely* = clear code trace, not executed · *Potential* = depends on conditions not verified.

---

## 1. Executive summary

Refnivo AI is a Next.js 16 / React 19 / Prisma 6 / Auth.js v5 application with a clean, layered architecture: every server action goes **guard → Zod → transactional service (+ audit row) → revalidate**, money is integer paise with basis-point percentages, and every brand-scoped query is filtered by `brandId`. The core ledger (record → verify → payout → refund/reverse) is transaction-safe, uses a per-campaign row lock for budget enforcement, and is covered by concurrency tests. Authorization is consistently correct: I found **no IDOR, no cross-brand leak, no role escalation and no client-trusted money input**.

What is *not* ready are a handful of operational and product-correctness gaps:

| # | Finding | Sev | Conf |
|---|---|---|---|
| AUTH-01 | A suspended / session-revoked user with a live cookie gets a **blank page in an infinite redirect loop** (proxy ↔ layout guard disagree) | **P1** | Confirmed (local repro) |
| PAY-01 | A payout request's **amount is frozen** at request time; a refund reversed after the request is silently dropped from the ledger update but **not from the amount the admin is told to pay** → overpayment | **P1** | Likely |
| STOR-01 | Only a **local-disk storage driver** exists; on Vercel's read-only filesystem product-image upload fails with 500 | **P1** | Likely |
| REF-01 | The attribution cookie / `attributionWindowDays` are **written but never read**; the UI promises "orders within N days of a click count", but attribution is 100 % manual code entry by the brand | **P1** | Confirmed |
| EMAIL-01 | With `EMAIL_PROVIDER=console` (production default) password reset is dead — and **Google-only accounts can never set a password** | **P1** | Likely |
| SEC-01 | Rate limiting is per-serverless-instance unless Upstash is configured; login brute-force protection is nominal | **P1** | Likely |
| DEPLOY-01 | No cron for `email:outbox` → failed e-mails are never retried | **P2** | Likely |
| CAMP-01 | Renaming a live campaign regenerates its slug → previously shared public URLs 404 | **P2** | Confirmed |
| REW-01 | `maxRewardPerCustomer` caps **per order**, not per customer, despite the label | **P2** | Confirmed |
| AUTH-02 | Root `loading.tsx` turns every guard redirect into a **200 + streamed client redirect**; non-JS clients and crawlers get a blank 200 for protected pages | **P2** | Confirmed (live) |

**Launch verdict:** *conditionally ready for a controlled launch* once AUTH-01, PAY-01, STOR-01, EMAIL-01 and SEC-01 are addressed (all are small, contained fixes — see §17). REF-01 needs a product decision (either build cookie-based attribution or change the copy).

---

## 2. Confirmed bugs

### AUTH-01 · Suspended or revoked sessions loop forever (blank page)
- **Severity:** P1 · **Category:** authentication / availability · **Confidence:** Confirmed
- **File:** `proxy.ts:39-50`, `lib/auth/guards.ts:31-41`, `lib/auth/guards.ts:52-56`, `app/loading.tsx`
- **Evidence:** `proxy.ts` decides only from the JWT (no DB): a signed-in user visiting `/auth/login` is redirected to their dashboard (`proxy.ts:44-46`). The dashboard layout calls `requireRole` → `getCurrentUser`, which returns `null` when `status !== "APPROVED"` or the session version is stale (`guards.ts:37-40`) → `redirect("/auth/login")` (`guards.ts:54`). Neither side clears the cookie. Reproduced locally: after suspending a freshly registered customer, `GET /dashboard/customer` was served 21+ times in a loop, the browser tab stayed blank, and dev logs showed `GET /dashboard/customer 200` repeating.
- **Impact:** every account an admin suspends, and every user whose sessions an admin revokes (`revokeSessions`, `suspendUser` bumps `sessionVersion`), sees a frozen white page instead of "Your account was suspended" — and support cannot explain it. Also hit when a user is deleted while logged in.
- **How to reproduce:** register → land on dashboard → set `users.status = 'SUSPENDED'` (or increment `sessionVersion`) → reload the dashboard.
- **Recommended fix:** in `getCurrentUser`/`requireUser`, when a JWT exists but the DB check fails, redirect to a dedicated page that **signs the user out** (e.g. `redirect("/auth/signed-out?reason=suspended")` whose server component calls `signOut({ redirectTo: "/auth/login?error=suspended" })`), or have `proxy.ts` not bounce `/auth/login` when `?error=`/`?reason=` is present. Add an integration test for "suspended user with valid cookie".

### REF-01 · Attribution window and cookie are dead code; UI copy over-promises
- **Severity:** P1 · **Category:** referral engine / correctness of product claims · **Confidence:** Confirmed
- **File:** `app/r/[code]/route.ts:61-71` (writes `lg_ref`), `lib/services/tracking.ts:8` (`ATTRIBUTION_COOKIE` exported), `lib/services/conversions.ts:34-73` (never reads it), `components/campaigns/campaign-wizard.tsx:464` ("How long after a link click an order still counts")
- **Evidence:** `grep ATTRIBUTION_COOKIE|lg_ref` across `app/ lib/ components/` finds no reader. `recordOrder` creates a brand-new `Referral` row from the code the brand types (`conversions.ts:64-73`) and never joins it to the CLICKED/VISITED session created in `recordClick`. `attributionWindowDays` only sets the cookie's max-age.
- **Impact:** the product has **no click-to-order attribution**; it has *code-to-order* attribution. Brands are told orders "still count within 30 days of a click" — that is not enforced or even measurable. Clicks and orders are two disconnected datasets, so the "conversion rate" metrics compare unrelated counts.
- **How to reproduce:** set a campaign's attribution window to 1 day, click a link, wait 2 days, record an order with the code → accepted.
- **Recommended fix (decision needed):** either (a) implement attribution: when the customer buys on the brand's store the brand passes `?ref=` and the order's `anonymousVisitorId`; `recordOrder` should find the visitor's CLICKED/VISITED referral inside the window and promote it (instead of creating a new row), rejecting orders outside the window; or (b) remove `attributionWindowDays` from the wizard/summary and re-word the "Buy through the button so your order is attributed" banner to "Give the code at checkout". Store integrations (Shopify/WooCommerce webhook) are the real fix and already on the roadmap.

### CAMP-01 · Renaming a live campaign breaks shared public URLs
- **Severity:** P2 · **Category:** brand workflow · **Confidence:** Confirmed
- **File:** `lib/services/campaigns.ts:113`
- **Evidence:** `const slug = existing.name === values.name ? existing.slug : await uniqueSlug(...)` — allowed for ACTIVE/PAUSED campaigns (`canEdit`, `campaign-rules.ts:89`). Public page and share targets use `/campaigns/<slug>`.
- **Impact:** any partner who shared `/campaigns/old-slug` directly (not through `/r/CODE`) gets a 404. `/r/CODE` links keep working because the redirect reads the current slug.
- **Recommended fix:** freeze the slug once `publishedAt` is set, or keep a slug-history table / 301 from old slugs.

### REW-01 · "Maximum reward per customer" is actually per order
- **Severity:** P2 · **Category:** commission / reward maths · **Confidence:** Confirmed
- **File:** `lib/domain/rewards.ts:32`, `components/campaigns/campaign-wizard.tsx:467-468`, `campaign-summary.tsx:56`
- **Evidence:** `computeCustomerReward` clamps the single reward to `maxRewardPerCustomer`; there is no per-recipient aggregate. The wizard hint says "Caps percentage rewards", the summary prints "Max reward ₹X per customer".
- **Impact:** a customer with 10 orders can earn 10 × cap; brands budgeting on "per customer" will over-spend.
- **Recommended fix:** rename the field/label to "Maximum reward per order", or enforce a cumulative cap in `recordOrder` (sum of the recipient's non-rejected rewards on the campaign + new ≤ cap).

### CONV-01 · A rejected order's reference can never be re-recorded
- **Severity:** P2 · **Category:** brand workflow · **Confidence:** Confirmed
- **File:** `prisma/schema.prisma:544` (`@@unique([brandId, orderReference])`), `lib/services/conversions.ts:87-91`
- **Evidence:** rejection keeps the `Conversion` row; a corrected re-entry with the same order number hits P2002 → "already been recorded".
- **Impact:** a typo in amount/code can only be fixed by recording the order under a fake reference, corrupting reconciliation.
- **Recommended fix:** allow re-recording when the existing conversion's referral is REJECTED (delete or supersede it in the same transaction), or add an "edit before verification" action.

### AUTH-02 · Guard redirects are streamed as 200 responses
- **Severity:** P2 · **Category:** authentication / SEO / robustness · **Confidence:** Confirmed (live: `GET /admin/registrations` → `200` with `NEXT_REDIRECT;replace;/auth/login` in the RSC payload)
- **File:** `app/loading.tsx` (root Suspense boundary), `app/admin/registrations/page.tsx`
- **Evidence:** because a root `loading.tsx` exists, the shell is flushed before layouts run; `redirect()` inside a guard is then delivered as a client instruction, not an HTTP 307. Unauthenticated `curl`/crawlers receive a 200 empty shell. This is also the mechanism that makes AUTH-01 a *silent* loop.
- **Impact:** no data leaks (payload contains only the redirect), but monitoring/uptime checks and non-JS clients cannot distinguish "protected" from "empty"; Google may index blank pages.
- **Recommended fix:** move guards into `proxy.ts` for the `/admin` prefix too, add `robots` `noindex` on dashboard/auth routes, and consider removing the root `loading.tsx` (keep per-segment ones) so redirects become real 307s.

### AUTH-03 · Google sign-up silently ignores the chosen role for existing e-mails
- **Severity:** P3 · **Category:** authentication UX · **Confidence:** Confirmed
- **File:** `lib/services/oauth.ts:92-112`
- **Evidence:** when the Google e-mail already belongs to an account, the account is linked and signed in with its *existing* role; the tile the user picked on the register page is discarded without a message.
- **Impact:** a brand owner who picks "Creator" and continues with Google lands on the brand dashboard, confused. Correct security-wise (no role change), poor feedback.
- **Recommended fix:** when `linked === true` and a role cookie was present with a different role, redirect with `?notice=linked-existing` and show "You already have a <role> account; we signed you into it."

### UX-01 · Empty marketplace copy assumes filters
- **Severity:** P3 · **Category:** UI/UX · **Confidence:** Confirmed (live)
- **File:** `app/(marketing)/campaigns/page.tsx` (empty state), `app/(marketing)/creators/page.tsx`
- **Evidence:** production shows "No live campaigns match these filters — Try clearing a filter" with no filters applied (database is empty).
- **Recommended fix:** branch the copy on whether any filter is set ("No campaigns yet — brands' campaigns appear here as soon as they publish.").

---

## 3. Potential bugs

### PAY-01 · Payout amount does not follow reversals made after the request
- **Severity:** P1 · **Category:** commission & payout ledger · **Confidence:** Likely
- **File:** `lib/services/payouts.ts:84-97` (amount frozen), `payouts.ts:141-172` (`reviewPayout` never re-checks item statuses), `lib/services/conversions.ts:257-264` (`reverseConversion` flips APPROVED→REVERSED regardless of `payoutItem` linkage)
- **Evidence:** `reviewPayout` reads `request.amount` and, on MARK_PAID, runs `updateMany({ where: { id in items, status: "APPROVED" } })`. A commission reversed after the request stays linked to the request, is skipped by the update (status is REVERSED), but the admin screen and notification still show the original `amount`, and `PAYOUT_MARK_PAID` audits `amount: request.amount`.
- **Impact:** admin settles ₹X off-platform while the ledger only owes ₹X − reversed; money leaves the brand/platform that is not owed. Existing test `ledger-lifecycle` covers reversal *before* request only.
- **How to reproduce:** verify order → creator requests payout → brand refunds that order → admin approves and marks paid: the payout says the full amount.
- **Recommended fix:** in `reviewPayout` for APPROVE and MARK_PAID, recompute `amount` from items whose ledger row is still APPROVED/AVAILABLE; if any item is REVERSED, either drop those items and update `amount` (audit the delta) or block with "one entry was reversed — reject and let the user re-request". Also block `reverseConversion` from silently touching entries in an *open* payout, or notify admins.

### STOR-01 · Image uploads cannot work on Vercel
- **Severity:** P1 · **Category:** deployment / brand workflow · **Confidence:** Likely
- **File:** `lib/storage/index.ts:43-55` (only `local` driver), `lib/storage/local.ts:16-21` (`mkdir`/`writeFile` under `process.cwd()/public/uploads`), `lib/config/env.ts:170-172` (warning only)
- **Evidence:** Vercel's function filesystem is read-only except `/tmp`; the write throws → route returns 500 "Upload failed" (`upload route:78-81`). `STORAGE_PROVIDER` accepts no other value. Even where writes succeed (self-hosted), files vanish on redeploy (documented). Not executed against production to avoid creating data.
- **Impact:** brands cannot add product images; every campaign card shows the placeholder. Product creation itself still works (image optional).
- **Recommended fix:** implement an S3-compatible driver (Supabase Storage / R2) behind `STORAGE_PROVIDER=s3`, make `local` a production **error** in `validateProductionEnv`, and add `remotePatterns`/`<Image>` or keep `<img>` with the bucket's public URL.

### EMAIL-01 · Password reset is unavailable in production; Google-only users are locked out of passwords
- **Severity:** P1 · **Category:** authentication · **Confidence:** Likely (env value not visible to me; health does not report the e-mail driver)
- **File:** `lib/email/index.ts:59-61`, `app/auth/forgot-password/page.tsx:13`, `components/account/settings-page.tsx` (Google users are sent to Forgot password)
- **Evidence:** default `EMAIL_PROVIDER=console` sends nothing; the forgot-password page says so. New Google accounts have `passwordHash = NULL` and the only path to set one is the e-mail link.
- **Impact:** any user who forgets a password is stuck; approval/rejection/payout e-mails are silently dropped.
- **Recommended fix:** configure Resend (`EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, verified `EMAIL_FROM`) before launch; expose `email: "configured" | "console"` on `/api/health`; add a "Set password" flow for signed-in password-less users that does not need e-mail (they are already authenticated via Google).

### SEC-01 · Brute-force protection is per-instance
- **Severity:** P1 · **Category:** security · **Confidence:** Likely
- **File:** `lib/utils/rate-limit.ts:27-39`, `app/actions/auth.ts:91` (10 login attempts / 10 min per IP+e-mail)
- **Evidence:** memory store is the default; Vercel spins many instances, each with its own counter, and cold starts reset it. The limiter is fail-open by design.
- **Impact:** password guessing is throttled only nominally; the login page also confirms which e-mails exist ("No account found"), so credential stuffing is efficient.
- **Recommended fix:** set `RATE_LIMIT_PROVIDER=upstash` + credentials (already implemented), and consider a per-account lockout counter in the DB after N failures.

### PAY-02 · Double payout request under concurrency returns a raw error
- **Severity:** P2 · **Category:** payout · **Confidence:** Potential
- **File:** `lib/services/payouts.ts:71-97`
- **Evidence:** no row lock; two simultaneous requests both pass the "open request" check. The unique `payout_items.commissionId` makes the second create fail with P2002, which is not a `PayoutError` → user sees "Could not submit the request" and a `[requestPayout] failed` log. Ledger stays consistent.
- **Recommended fix:** `SELECT … FOR UPDATE` on the user row (or an advisory lock keyed by userId) at the top of the transaction; map P2002 to a friendly message.

### CAMP-02 · Live campaign rules can be edited without partner notice; type change strands partners
- **Severity:** P2 · **Category:** brand workflow · **Confidence:** Potential
- **File:** `lib/services/campaigns.ts:102-133`, `lib/validation/campaign.ts` (campaignType editable)
- **Evidence:** ACTIVE campaigns accept changes to reward/commission values, `campaignType`, `requiresApproval`, dates and budget. Pending ledger rows are frozen (good), but partners are not notified of a commission cut, and switching HYBRID → CREATOR_AFFILIATE leaves existing customer links ACTIVE and still paying rewards.
- **Recommended fix:** on publish, lock `campaignType`; notify active partners when reward/commission values change; or require PAUSE before edits to economics.

### CONV-02 · Refund of an already-paid commission has no recovery path
- **Severity:** P2 · **Category:** ledger · **Confidence:** Potential (design gap)
- **File:** `lib/services/conversions.ts:257-266`, `285`
- **Evidence:** a PAID commission becomes REVERSED and `alreadySettled: true` is written to audit metadata only. No negative ledger entry, no deduction from the partner's next payout, no admin queue.
- **Recommended fix:** create a negative adjustment row (or a `clawback` on the next payout) so `payoutSummary` nets it; surface "settled but reversed" on `/dashboard/admin/payouts`.

### DB-01 · One brand per owner is enforced only in the action (TOCTOU)
- **Severity:** P3 · **Category:** database · **Confidence:** Potential
- **File:** `app/actions/brand.ts:24-26`, `prisma/schema.prisma:277-307` (`ownerId` indexed, not unique)
- **Evidence:** existence check happens outside the transaction; a double submit can create two brands; `getBrandForOwner` then always picks the oldest.
- **Recommended fix:** `@@unique([ownerId])` (v1 rule) or check inside `createBrand`'s transaction.

### REF-02 · Click counts are inflatable
- **Severity:** P3 · **Category:** referral engine · **Confidence:** Potential
- **File:** `lib/services/tracking.ts:51-77`, `app/r/[code]/route.ts:7-8`
- **Evidence:** dedupe is per visitor cookie (30 s) and 60 hits/min/IP. Clearing the cookie or rotating IPs inflates "clicks" — no money attached, but brand analytics/CSV exports report them.
- **Recommended fix:** dedupe additionally by `ipHash + userAgent` per hour; label clicks as "unique sessions (approx.)".

### SEC-03 · Hash salt is the auth secret
- **Severity:** P3 · **Category:** security / operations · **Confidence:** Confirmed by code
- **File:** `lib/services/tracking.ts:17-20`
- **Evidence:** `hashValue` salts customer contacts and IPs with `AUTH_SECRET`. Rotating the auth secret (which you should be able to do freely) silently breaks self-referral and "new customer only" duplicate detection for all historical rows.
- **Recommended fix:** introduce a separate `HASH_SALT` (or `CONTACT_HASH_SECRET`) that is never rotated; keep AUTH_SECRET for sessions only.

---

## 4. Security findings

| ID | Finding | Sev | Conf | Notes |
|---|---|---|---|---|
| SEC-01 | Rate limiting per instance (above) | P1 | Likely | configure Upstash |
| SEC-02 | CSP allows `'unsafe-inline'` scripts (`lib/config/security-headers.ts:18`) | P3 | Confirmed | acceptable for now; nonce pipeline later |
| SEC-03 | Contact/IP hashes salted with `AUTH_SECRET` (above) | P3 | Confirmed | separate salt |
| SEC-04 | Login reveals account existence ("No account found. Please sign up first.", `app/actions/auth.ts:105-108`) and register reveals e-mail taken | P3 | Confirmed | deliberate UX trade-off; pair with SEC-01 |
| SEC-05 | `/check-registration` looks up registrations by public `REF-…` id, rate-limited 10/10 min | P3 | Confirmed | ids are 8 chars from a 32-symbol alphabet (~1e12) — fine |
| SEC-06 | Uploads: auth → rate limit → size → declared type → **magic-byte sniff**, server-chosen name/extension (`app/api/uploads/product-image/route.ts`) | — | Confirmed | good; SVG rejected by allow-list |
| SEC-07 | CSV export neutralises formula injection (`lib/utils/csv.ts:11`) and is brand-scoped | — | Confirmed | good |
| SEC-08 | Secrets: none hard-coded; `.env` git-ignored; error messages name variables only; health endpoint credential-free | — | Confirmed | — |
| SEC-09 | Google OAuth: PKCE + state, `email_verified` required to link, no provider tokens stored, role from httpOnly cookie validated against the allow-list, ADMIN never self-registrable | — | Confirmed | — |
| SEC-10 | Server actions: every mutating action calls `assertUser/assertRole/assertBrandOwner/assertPartner` before parsing input (verified for all 13 action files, §"Route table" below) | — | Confirmed | — |
| SEC-11 | Passwords: bcrypt cost 12, 8+ chars with letter+number, max 128; `mustChangePassword` forced rotation; `sessionVersion` revocation | — | Confirmed | — |
| SEC-12 | Security headers live: HSTS preload, `X-Frame-Options: DENY`, CSP `frame-ancestors 'none'`, `poweredByHeader: false` | — | Confirmed (live) | — |

**Route table (authorization audit).** All routes below were read; ownership is enforced by `where: { …, brandId }` / `userId` filters inside the service, never by trusting ids from the client.

| Route / action | Auth | Role | Input validation | Ownership | Notes |
|---|---|---|---|---|---|
| `POST /api/uploads/product-image` | session | BRAND_OWNER + brand | size/type/sniff | prefix = own brand id | fails on Vercel (STOR-01) |
| `GET /api/exports/campaigns/[id]` | session | BRAND_OWNER | — | `findFirst({ id, brandId })` → 404 | no partner contacts in CSV |
| `GET /api/health` | none | — | — | — | credential-free |
| `GET /r/[code]` | none | — | code normalised | — | 302 always; tracking best-effort |
| `registerAction` | none | — | Zod (`registerSchema`), role ∈ allow-list | — | rate-limited 5/10 min/IP |
| `loginAction` | none | — | Zod | — | 10/10 min/IP+e-mail; enumerates accounts |
| `googleSignInAction` | none | — | role allow-list, safe callbackUrl | — | 20/10 min/IP |
| `saveCampaignAction`, `campaignStatusAction`, `deleteDraftCampaignAction` | session | brand | Zod | service `brandId` | — |
| `recordOrderAction`, `conversionDecisionAction`, `conversionReversalAction` | session | brand | Zod (amount 1–1e7 ₹, qty ≤ 1000) | link.campaign.brandId / `campaign: { brandId }` | commission computed server-side |
| `decideApplicationAction`, `removePartnerAction` | session | brand | Zod | `campaign: { brandId }` | — |
| `saveProductAction`, `archiveProductAction` | session | brand | Zod | `brandId` | archive blocked while campaigns live |
| `createBrandAction`, `updateBrandAction` | session | BRAND_OWNER | Zod | ownerId | DB-01 |
| `saveCreatorProfileAction`, `joinCampaignAction`, `withdrawApplicationAction` | session | CREATOR / partner | Zod | userId | own-campaign join blocked |
| `requestPayoutAction` | session | CREATOR↔COMMISSION, CUSTOMER↔REWARD | Zod enum method | userId | PAY-02 |
| `approveUser/rejectUser/suspend/reactivate/verification/moderateCampaign/payoutReview` | session | ADMIN | Zod | — | last-admin & self-suspend protected |
| `markNotificationRead*`, `setEmailNotifications`, `updateAccount`, `changePassword` | session | any | Zod | userId | — |
| `forgotPassword`, `resetPassword`, `checkRegistration` | none | — | Zod | token hash | rate-limited |
| Dashboard pages | session | layout `requireBrand/requireCreator/requireRole` + every page re-guards | — | detail pages `findFirst({ id, brandId })` | — |

---

## 5. Authentication findings

- **E-mail signup/login:** correct; `SIGNUP_APPROVAL` (auto default) verified live for all three roles; login gates PENDING/REJECTED/SUSPENDED after password check; auto-login after signup falls back to `/auth/login?registered=1` on failure.
- **Google:** verified live up to Google's consent screen (`redirect_uri=https://refnivo-ai.vercel.app/api/auth/callback/google`, PKCE S256, `prompt=select_account`); database migration now applied (`/api/health` → `schema: current`). The end-to-end sign-in with a real Google account is still **unverified by me** (needs the operator's account).
- **Role selection trust:** backend re-validates `role ∈ {BRAND_OWNER, CREATOR, CUSTOMER}` for both e-mail (`registerSchema`) and Google (`isRegistrableRole` on the cookie); `ADMIN` unreachable. ✔
- **Cross-role dashboards:** `proxy.ts` bounces by JWT role, layouts re-check by DB role; a creator hitting `/dashboard/brand` is redirected. ✔
- **Session:** JWT 7 days (`config.ts:15`), `httpOnly` + `SameSite=Lax` + `__Secure-` prefix under https; `sessionVersion` compared on every request (`guards.ts:37`). Logout is a server action → `signOut`. ✔
- **Duplicate signup:** unique e-mail (P2002 → `EmailTakenError` → field error). Google: same verified e-mail links, never duplicates; race handled by re-resolve. ✔
- **Existing account, different role:** e-mail → "already exists"; Google → linked to existing role (AUTH-03).
- **Refresh:** JWT persists; `auth()` runs per request.
- **Gaps:** AUTH-01 (loop), AUTH-02 (streamed redirects), EMAIL-01 (no password path for Google users without e-mail), no "set password while signed in" flow, no e-mail verification for password signups (documented).

## 6. Brand workflow findings

Traced: register → onboarding (`BrandForm`) → product (`saveProductAction`, price in paise, unique slug + SKU per brand) → image (STOR-01) → campaign wizard (Zod: commission ≤ 50 %, reward ≤ 100 %, window 1–90 d, budget > 0) → publish (`publishProblems` + explicit confirmation + product ACTIVE) → edit (CAMP-01, CAMP-02) → pause/resume/end/archive (state machine in `campaign-rules.ts:81-87`, partners notified) → applications (`decideApplication`, idempotent link creation) → orders (`recordOrder` → `verifyConversion` with FOR UPDATE + budget) → ledger view (`getBrandLedger`) → payout is admin-side.

- Verified orders can still be verified after a campaign ENDS (only *recording* requires live) — reasonable.
- `verifyConversion` budget check counts only APPROVED/PAID/AVAILABLE/REDEEMED — PENDING orders can collectively exceed budget until verification refuses them; the message tells the brand to raise the budget. OK, but consider showing "pending exposure" on the campaign page.
- Loading states: only `app/dashboard/brand/loading.tsx` exists; other dashboards rely on the root loading shell (UX-02).

## 7. Creator workflow findings

Traced: signup → `/auth/onboarding` (`CreatorProfileForm`, username unique, counts validated as integers ≥ 0, labelled self-reported) → `/campaigns` discovery (live campaigns only) → `joinCampaign` (`requiresApproval` ⇒ PENDING; type checks; own-campaign blocked; REJECTED/REMOVED cannot rejoin; WITHDRAWN can) → brand approval → `ensureReferralLink` (unique per campaign+owner; code `HANDLE-BRAND-XXXX`, 5 retries) → QR (`qrcode` PNG data URL to `/r/CODE?src=qr`) → sharing (WhatsApp/X/Telegram/Facebook intents) → clicks (`recordClick`, one session per visitor per link, QR vs LINK source) → orders (brand-entered) → commission (frozen at record time, PERCENTAGE half-up rounding or FIXED) → payout (`requestPayout`, min ₹500 default).

- Duplicate applications prevented by `@@unique([campaignId, userId])` and idempotent `joinCampaign`. ✔
- Commission attribution is by link owner; a removed partner's link is DISABLED so it stops resolving and recording. ✔
- **PRIV-02 (P3):** the referral code embeds the partner's handle — for customers that is their *real name* (`handle = user.name`, `partners.ts:189`) — visible to everyone they share with. Consider `C-XXXXXXXX` style codes for customers (the format is already accepted by `isReferralCodeFormat`).
- Earnings page shows commission statuses; REVERSED after PAID is displayed but not netted (CONV-02).

## 8. Customer workflow findings

Traced: signup (auto-approved) → `/campaigns` → join (instant, no approval) → link/QR → friend click → brand records order with the code → verify → reward AVAILABLE → `requestPayout(kind=REWARD)` → admin MARK_PAID → REDEEMED.

- Customer role permissions: `assertPartner` for joining; customer cannot request COMMISSION kind. ✔
- Reward eligibility: `newCustomerOnly` duplicate check only works when the brand enters a customer contact (`conversions.ts:51-62`); without it, repeat customers are rewarded. Document on the record-order form ("enter the customer contact to enforce new-customer-only").
- Refund handling: reward AVAILABLE/REDEEMED → REVERSED, referral REFUNDED, notification. ✔ (CONV-02 for REDEEMED).
- Duplicate rewards: `@@unique([referralId, recipientId])` + one referral per order reference. ✔
- **PRIV-01 (P3):** `/creators` and `/creators/[username]` show self-reported follower counts to any visitor including customers, contrary to the project rule ("never show them to customers"); they are labelled "Self-reported". Decide: hide numbers for non-brand viewers or keep with the label.

## 9. Referral engine findings — exact attribution logic

1. `/r/CODE` → `resolveReferralCode` (link ACTIVE, brand ACTIVE, product ACTIVE, campaign live) → `recordClick` (dedupe 30 s per visitor+link; creates `ReferralClick` + one `Referral{CLICKED}` per visitor per link) → cookies `lg_vid` (1 y) and `lg_ref` (attribution window) → 302 to `/campaigns/<slug>?ref=CODE`.
2. Campaign page with `?ref=` → `markVisited` (CLICKED → VISITED) and "Buy" button = `purchaseUrl?ref=CODE` (brand's own store).
3. **Order → referral mapping is manual:** the brand types the code + order reference; `recordOrder` creates a *new* `Referral{PURCHASED}` unrelated to the click session; `Conversion` unique per `(brandId, orderReference)`.
4. Verification locks the campaign row, re-checks budget, flips ledger rows; rejection cancels them; reversal (refund) reverses them.
5. **There is no first-/last-click logic, no expiry, no cookie read, no visitor↔order join** (REF-01). Campaign/link/brand/product status *is* validated at record time; creator approval is implied by link existence (links are only created on approval).
6. Manipulation: codes are unguessable (4 random symbols from 32 after a public handle — ~1 M per handle; acceptable because clicks pay nothing and orders are brand-entered). Wrong-creator attribution can only come from the brand typing the wrong code.
7. QR destination is correct (`/r/CODE?src=qr` → same flow, source recorded as QR).

## 10. Commission / payout findings

- All maths server-side and integer (`lib/money`, unit-tested: half-up rounding, no floats). Client cannot influence amounts except the **order value the brand types** (`recordOrderSchema.amount`, 1–10 000 000 ₹) — inherent to manual recording; commission/reward derive from campaign rules at record time and are frozen.
- Percentage/fixed for both creator and customer; VOUCHER/DISCOUNT treated as fixed face value (documented).
- Refund/cancel: full reversal only — **no partial refunds** (P2 product gap; `reverseConversion` is all-or-nothing).
- Currency: single-currency per payout enforced; campaign currency defaults to INR and is not validated against the product's currency (P3).
- Duplicate payouts: `payout_items.commissionId/rewardId` unique; MARK_PAID is the only path to PAID/REDEEMED; REJECT releases items. ✔ — but see PAY-01 (stale amount) and PAY-02 (race).
- Admin actions audited with `actorRole: ADMIN`, before/after status, `hasReference`. ✔
- Minimum payout `PAYOUT_MINIMUM_AMOUNT` (paise, default 50 000) — unit is easy to misconfigure (₹ vs paise); document or validate.

## 11. Database findings

- FKs and cascades are deliberate: brand → products/campaigns cascade; `Campaign.product` **Restrict** (cannot delete a product with campaigns); referral/ledger rows cascade with campaign/user (consider **Restrict** on `Commission.creator`/`Reward.recipient` once money is paid — deleting a user erases paid-ledger history). `Conversion.verifiedBy` SetNull ✔.
- Unique constraints present: user e-mail, registrationId, brand/product/campaign slugs, product `(brandId, sku)`, application `(campaignId, userId)`, link `(campaignId, ownerId)` + `code`, conversion `(brandId, orderReference)`, reward/commission `(referralId, recipientId)`, payout item ids, outbox `idempotencyKey`, oauth `(provider, providerAccountId)`. ✔
- **Missing:** `Brand.ownerId` unique (DB-01); `approvedById`/`processedById`/`AuditLog.entityId` are free strings without FKs (informational; keeps audit rows after deletions — acceptable).
- Indexes cover every hot path I traced (`referrals(referralLinkId, anonymousVisitorId)`, `commissions(creatorId,status)`, `notifications(userId, readAt, createdAt)`, `email_outbox(status, nextAttemptAt)`). `payout_requests(userId, status)` ✔.
- Migrations: 9, additive; hand-written `google_oauth` verified equal to schema via `prisma migrate diff`. History baselined on production (`/api/health` → `schema: current`).
- `Referral.referredPhoneHash` actually stores an e-mail-or-phone hash — rename to `referredContactHash` when convenient.

## 12. UI/UX findings

Checked locally at 375 px and desktop (the built-in browser blocks production assets, so layout was verified on the same build locally; production HTML/route behaviour was probed with curl).

- Home, `/campaigns`, `/creators`, login, register: no horizontal overflow, images have `alt`, forms have labels/`aria-invalid`, mobile nav present. ✔
- UX-01 empty-state copy (above). Production currently has **zero campaigns/creators/brands** — the marketplace and "Brands on Refnivo" strip are empty; plan seed content from real early brands.
- UX-02: `loading.tsx` only for the brand dashboard; creator/customer/admin dashboards show the generic root loader.
- Login page keeps the "Demo accounts are listed in the README after running `npm run db:seed`" hint when no quick accounts exist — it renders in production too (`app/auth/login/page.tsx:52-56`); remove for production (P3, Confirmed by code: only gated on `quickAccounts.length`).
- Register page: role tiles are outside the form (correct for the Google form) — keyboard focus ring works; "Continue with Google as a brand" label reads well.
- Copy is grammatical throughout; British/Indian spelling consistent ("e-mail", "₹").

## 13. Performance findings

- **PERF-01 (P2, Confirmed):** `getCurrentUser()` is not memoised with React `cache()`; layout + page (+ `requireBrand` brand lookup) each call `auth()` and the same `users` query — 2–3 duplicate round-trips per navigation. Wrap `getCurrentUser`, `getBrandForOwner`, `getCreatorProfile` in `cache()`.
- **PERF-02 (P2):** list endpoints cap at `take: 200/100` with no pagination (`listBrandOrders`, `listPartnerConversions`, `getBrandLedger`, `listPayoutRequests`, notifications). Fine at launch; add cursor pagination before 1k+ rows per brand.
- **PERF-03 (P3):** 39 `<img>` usages, no `next/image` → no resizing/lazy formats; product images are served as uploaded.
- Campaign detail runs 7 aggregate queries in parallel (`getCampaignWithStats`) — acceptable.
- No N+1 found: partner/campaign lists use `include`/`_count`; `transitionCampaign` notifies partners in a loop inside the transaction (one insert per partner — fine for <1k partners, otherwise use `createMany`).
- Client components: 17 files; dashboards are server components. Recharts is loaded only on analytics pages. ✔
- DB: Supabase transaction pooler + `pgbouncer=true`, single `PrismaClient`. Health latency 0.7–1.9 s from Vercel (bom1/iad1 → Tokyo) — consider a Vercel region near the DB (`regions: ["hnd1"]`) to cut every query's RTT (P2 operational).

## 14. Testing gaps

25 files / 229 tests, run in CI against a real Postgres. Well covered: money, campaign rules, transitions, ownership, verification concurrency & budget, ledger lifecycle, outbox, admin bootstrap, OAuth resolution, env validation.

**Not covered (do not assume these work):**
- HTTP-level auth: `proxy.ts` redirects, `loginAction`/`registerAction`/`googleSignInAction`, Auth.js `signIn`/`jwt` callbacks, the role cookie, logout — **no tests**.
- AUTH-01 scenario (suspended user with a live cookie).
- PAY-01 scenario (reversal after payout request; MARK_PAID amount).
- `/r/[code]` route handler (cookie flags, rate-limit branch, redirect targets) — only the service is tested.
- Upload route end-to-end (only validators are unit-tested); export route.
- Password reset **actions** (service tested), forgot-password enumeration behaviour at the action level.
- Notifications UI, dashboards, any React rendering (no component/e2e tests).
- `maxRewardPerCustomer` semantics, partial refunds (feature absent), campaign rename slug behaviour.

## 15. Deployment findings

- **Build:** `prisma generate && next build` (fixed today — Vercel's dependency cache previously shipped a stale client). CI: lint (0 warnings), typecheck, tests on postgres:16, build. ✔
- **No `vercel.json`:** no `regions`, no **cron** for `npm run email:outbox` (DEPLOY-01: e-mail retries never happen on Vercel; first-attempt sends happen after commit only while the function is alive). Add a cron hitting a protected route, or a GitHub Actions schedule.
- **Migrations:** manual (`db:deploy` with host confirmation, or SQL editor). `/api/health` now reports `schema: behind` + the missing migration — good; add it to the release checklist and consider a CI job that runs `db:deploy` on tag with the confirm host.
- **Env validation** at boot refuses missing `AUTH_SECRET`/`DATABASE_URL`/https URLs, payment flags, half-configured Google; **warnings only** for memory rate-limit, console e-mail and local storage — three items that matter in production (SEC-01, EMAIL-01, STOR-01). Promote local storage to an error; surface the other two on `/api/health` as `warnings`.
- **Runtime:** node runtime for API routes; `proxy.ts` imports Auth.js config (edge-safe) — ✔. `instrumentation.ts` logs, never throws.
- **Logging:** structured `[security]` and `[error]` lines with redaction; Vercel log access for the team is restricted (my connector is 403) — set up a log drain.
- **Secrets hygiene:** a database password was pasted in chat/terminal earlier this week — **rotate it** (Supabase → Database → Reset password → update Vercel `DATABASE_URL`). `AUTH_SECRET` rotation is safe for sessions but see SEC-03.
- **Demo/seed:** `showDemoLogins` hard-off in production; seed refuses remote DBs. ✔ Production DB contains only the admin and the QA accounts created during verification (`*@refnivo-test.example`) — delete/suspend them before launch.

---

## 16. Recommended fixes (grouped)

**Safe to fix immediately (small, contained, no schema change)**
1. AUTH-01 — signed-out landing for stale sessions (guards + proxy exemption) + test.
2. PAY-01 — recompute payout amount from live item statuses on APPROVE/MARK_PAID; block/adjust on REVERSED + test.
3. PAY-02 — user-level lock in `requestPayout`; map P2002.
4. REW-01 — rename to "per order" (or implement cumulative cap).
5. CAMP-01 — freeze slug after publish.
6. UX-01, login demo hint, PRIV-02 code format for customers, empty-state copy.
7. PERF-01 — `cache()` around `getCurrentUser`/brand/profile lookups.
8. DEPLOY-01 — `vercel.json` with `crons` for the outbox + `regions` near the DB.
9. Env: make `STORAGE_PROVIDER=local` an error in production; expose e-mail/rate-limit/storage state on `/api/health`.

**Configuration only (operator)**
- `RATE_LIMIT_PROVIDER=upstash` (+ URL/token), `EMAIL_PROVIDER=resend` (+ key, verified sender), rotate the DB password, remove QA accounts.

**Need design / architectural work**
- REF-01 — real click→order attribution (visitor id passed to the store and back, or store webhooks) *or* honest copy.
- STOR-01 — S3-compatible storage driver.
- CONV-02 / partial refunds — negative ledger adjustments and clawback.
- CAMP-02 — economics edits on live campaigns (lock type; notify partners).
- AUTH-02 — decide on root `loading.tsx` vs. real 307s; `noindex` for app routes.
- "Set password" flow for Google-only users without e-mail dependency (EMAIL-01 mitigation).

## 17. Priority roadmap

| Phase | Items | Effort |
|---|---|---|
| **Before opening signups** | AUTH-01, PAY-01, EMAIL-01 (configure Resend), SEC-01 (configure Upstash), STOR-01 (at minimum: hide the upload UI and make `local` a prod error until a driver exists), rotate DB password, delete QA accounts, DEPLOY-01 cron | 1–2 days |
| **First week** | REF-01 decision + copy change, REW-01, CAMP-01, PAY-02, PERF-01, UX-01/02, PRIV-01/02, health `warnings` | 2–3 days |
| **First month** | S3 storage driver, CONV-01/CONV-02 (re-record, clawback), CAMP-02, AUTH-02, cumulative reward cap, pagination, `next/image`, HTTP-level auth tests, e2e smoke (Playwright) | 1–2 weeks |
| **Later** | Store webhooks for automatic attribution, partial refunds, separate hash salt (SEC-03) with re-hash migration, CSP nonces | roadmap |

### Top 10 issues
1. AUTH-01 suspended/revoked session loop — **launch blocker** (support nightmare, P1, Confirmed)
2. PAY-01 stale payout amounts after refund — **launch blocker** (money, P1, Likely)
3. STOR-01 uploads fail on Vercel — **launch blocker for the brand experience** (P1, Likely)
4. EMAIL-01 no password reset / Google users cannot set a password — **launch blocker** unless Resend is configured (P1, Likely)
5. SEC-01 per-instance rate limiting — **launch blocker** unless Upstash is configured (P1, Likely)
6. REF-01 attribution window is fiction — product-truth issue; fix copy before marketing it (P1, Confirmed)
7. DEPLOY-01 no outbox cron — e-mails silently lost on failure (P2, Likely)
8. REW-01 per-order vs per-customer cap — brand budgets wrong (P2, Confirmed)
9. CAMP-01 rename breaks shared URLs (P2, Confirmed)
10. AUTH-02 streamed redirects / blank 200s for protected pages (P2, Confirmed)

**Blocks launch:** 1–5 (items 4 and 5 are configuration, not code).
**Safe to fix immediately:** 1, 2, 7, 8, 9, PAY-02, PERF-01, UX-01/02, PRIV-02, env hardening.
**Needs architectural change:** 3 (storage driver), 6 (attribution), 10 (routing/streaming model), CONV-02/partial refunds, CAMP-02.

---

## 18. Fix log

**Batch 1 — "safe to fix immediately" (approved 2026-09-18, commit after `81e0e7f`)**

| ID | Status | What changed |
|---|---|---|
| AUTH-01 | **Fixed** (re-verified locally: suspended user → `/auth/signed-out` → login page with reason) | `lib/auth/session-state.ts` (pure classifier + tests), `lib/auth/guards.ts` (`getSessionState`), `app/auth/signed-out/route.ts` clears the cookie, login-page messages |
| PAY-01 | **Fixed** (tests: reversal after request trims APPROVE/MARK_PAID; all-reversed refused) | `reviewPayout` reconciles items against live ledger statuses; `reverseConversion` notifies admins when an open payout is touched |
| PAY-02 | **Fixed** (test: concurrent requests → one succeeds, one clear error) | per-user `FOR UPDATE` in `requestPayout`; P2002 mapped |
| REW-01 | **Fixed** | UI/summary/validation now say "per order" (column name unchanged) |
| CAMP-01 | **Fixed** (test) | slug frozen once `publishedAt` is set |
| PRIV-02 | **Fixed** (test) | customer codes are `C-XXXXXXXX`; creator codes unchanged |
| UX-01 / demo hint | **Fixed** | filter-aware empty states on `/campaigns` and `/creators`; seed hint only outside production |
| PERF-01 | **Fixed** | `getSessionState`, brand and creator-profile lookups memoised per request with React `cache()` |
| DEPLOY-01 | **Fixed** (operator must set `CRON_SECRET` + GitHub secrets) | `GET /api/cron/email-outbox`, `vercel.json` (daily Vercel cron, `hnd1` region), `.github/workflows/email-outbox.yml` (every 15 min) |
| STOR-01 (mitigation) | **Mitigated** — the real driver is still open | `uploadsAvailable()`; upload route answers 503 with a clear message; product form shows "Uploads unavailable" in production instead of failing |
| Health | **Done** | `/api/health` lists production `warnings` (storage, rate limit, e-mail, cron) |

Still open from the report: REF-01 (attribution decision), STOR-01 driver, EMAIL-01 / SEC-01 (configuration), CONV-01, CONV-02, CAMP-02, AUTH-02, AUTH-03, DB-01, REF-02, SEC-02/03/04, PRIV-01, PERF-02/03, UX-02, test gaps.
