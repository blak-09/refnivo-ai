# Refnivo AI — Fix Report

**Scope:** performance, "MVP build" branding, admin account, image uploads, account deletion, quality gates.
**Base:** `9bf478e` (main) · **Date:** 2026-09-18 · **Status:** implemented and verified locally; **not deployed** (awaiting approval).
**Gates:** `tsc --noEmit` ✅ · `eslint . --max-warnings 0` ✅ · `vitest` **254/254** ✅ (29 files) · `next build` ✅.

---

## 1. Issues found, root causes and fixes

### Issue 1 — Homepage does uncached, unbounded database work on every hit
- **Severity:** P2 (performance)
- **Root cause:** `app/(marketing)/page.tsx` ran, per request, the full marketplace listing, the full public brand list (no `take`), 60 creators, three `count()`s and a QR render — 6 DB round-trips + CPU — then used 4 / 8 / 2 of the rows. Vercel (Mumbai/IAD) ↔ Supabase (Tokyo) made each round-trip expensive.
- **File / line:** `app/(marketing)/page.tsx:40-57` (old), `lib/services/brands.ts:81`, `lib/services/creators.ts:146`, `lib/services/campaigns.ts:257`
- **Fix:** `lib/services/landing.ts` — bounded loaders (`limit` 4 / 8 / 4) wrapped in `unstable_cache` (60 s, tag `landing`, invalidated by campaign / brand / creator saves); marketplace listing now applies the live-date window in SQL; QR data URL memoised per process. The header's session check stays per-request.
- **Testing:** existing campaign/brand/creator tests pass; `GET /` renders with an empty DB; local dev TTFB ≈ 250 ms warm. Production baseline (before deploy): home TTFB 0.47–1.0 s, `/campaigns` 0.47 s — re-measure after deploy (§10).
- **Status:** Fixed (verify in production after deploy)

### Issue 2 — Recharts shipped to the server render and the first JS pass
- **Severity:** P3 (performance)
- **Root cause:** `components/charts/charts.tsx` (client) imported directly by `app/dashboard/brand/page.tsx` and `analytics/page.tsx` → Recharts SSR'd (it cannot measure on the server anyway) and hydrated eagerly.
- **Fix:** `components/charts/lazy-charts.tsx` — `next/dynamic` with `ssr: false` and skeleton placeholders; pages import from it.
- **Testing:** analytics/overview HTML no longer contains recharts; charts render after hydration with a skeleton.
- **Status:** Fixed

### Issue 3 — No image optimisation; no responsive sizing; hero image not prioritised
- **Severity:** P3 (performance)
- **Root cause:** every image was a plain `<img>` because URLs can come from arbitrary hosts (using `next/image` for those would make the optimizer an open proxy).
- **Fix:** `lib/storage/hosted-image.ts` + `components/products/product-thumb.tsx`: images **we host** (`/uploads/…` and the configured storage origin) go through `next/image` (`fill` + `sizes`, AVIF/WebP, lazy); external URLs stay `<img loading="lazy" decoding="async">`. Hero product image gets `priority`. `next.config.ts` allows only the storage host in `images.remotePatterns`.
- **Testing:** public brand page requests `/_next/image?url=%2Fuploads%2F…` → `200 image/webp`; unit test `hosted image allow-list`.
- **Status:** Fixed

### Issue 4 — Blank screens during dashboard / marketplace navigation
- **Severity:** P3 (UX)
- **Root cause:** only the brand dashboard had a `loading.tsx`.
- **Fix:** `app/dashboard/{creator,customer,admin}/loading.tsx`, `app/(marketing)/campaigns/loading.tsx` (skeletons); fonts use `display: "swap"` (mono not preloaded).
- **Status:** Fixed

### Issue 5 — "MVP build" visible in the footer and "MVP" wording across pages
- **Severity:** P3 (branding)
- **File / line:** `components/marketing/site-footer.tsx:68` (footer, desktop + mobile), `app/(marketing)/about/page.tsx:27`, `how-it-works/page.tsx:38`, `terms/page.tsx:8`, `app/dashboard/brand/settings/page.tsx:36`
- **Fix:** footer → "© YEAR Refnivo AI. All rights reserved."; other copy re-worded ("early", "today", "on the roadmap"). No metadata or nav contained it. Internal docs/comments untouched.
- **Testing:** `curl /` contains 0 occurrences of "MVP"; footer layout unchanged (same flex/responsive classes).
- **Status:** Fixed

### Issue 6 — "Admin account is not working"
- **Severity:** P1 (operations)
- **Root cause (verified):** **not a code defect.** The full admin flow was exercised locally end-to-end: login → forced first-sign-in password rotation (`/dashboard/admin/settings?rotate=1`) → change → sign-out → re-login → all 11 admin pages 200 → brand/creator/customer/`/dashboard` URLs redirect by role. Server-side authorisation (`requireRole("ADMIN")` in the admin layout and every page, `assertRole("ADMIN")` in every admin action) is intact. The production symptom therefore comes from account **state** — one of: lost bootstrap password (rotation screen requires it), account created in a different Supabase project than Vercel's `DATABASE_URL`, the 10-attempts/10-min login limiter, or not yet created. I cannot read production to tell which (no credentials, Vercel log access is 403 for my connector).
- **Fix:** `npm run admin:check` (`scripts/admin-check.ts`, read-only, never prints secrets) reports the admin's state and the exact next step; `scripts/create-admin.ps1` gained a "rotate existing admin password" prompt (uses the existing `ADMIN_ROTATE_EXISTING=1` path — no new auth system). Runbook section added.
- **Testing:** `admin:check` run locally (caught a stale local schema on the way); rotation path covered by existing `admin-bootstrap` tests; authorisation matrix re-verified (§11).
- **Status:** Diagnosed + tooling shipped; production account needs the operator to run `admin:check` (§7)

### Issue 7 — Brand logo / cover and creator photo were "paste a URL" fields; no customer photo
- **Severity:** P2 (product)
- **File / line:** `components/brand/brand-form.tsx:67-72`, `components/creators/creator-profile-form.tsx:42-44`; account form had no photo.
- **Fix:** the existing `ImageUpload` component is now used everywhere; the single upload route became `app/api/uploads/[kind]/route.ts` (`product-image`, `brand-logo`, `brand-cover`, `creator-image`, `avatar`) with per-kind server-side authorisation and owner-derived storage prefixes (`lib/storage/upload-kinds.ts`). `updateAccount` accepts `avatarUrl`; the dashboard sidebar shows it. Validators accept our hosted paths and keep legacy external URLs working.
- **Storage:** production could not write files at all (Vercel FS is read-only). Added a **Supabase Storage** driver over its REST API (`lib/storage/supabase.ts`, no SDK, same Supabase project as the DB). Without configuration the forms show "Uploads unavailable" and the route answers 503 (never a 500).
- **Testing:** browser: brand logo + cover uploaded via the component → saved → served → optimised; customer avatar uploaded → saved → sidebar. Unit: upload kinds, allow-list, driver (mocked fetch: headers, prefix sanitising, public URL, failure never leaks the key, delete).
- **Status:** Fixed (production needs the 5 storage variables — §6)

### Issue 8 — No way for a user to delete their account
- **Severity:** P2 (product / privacy)
- **Fix:** Settings → **Danger zone** → dialog (typed `DELETE` + current password; Google-only accounts: phrase only) → `deleteAccountAction` (session-derived user id, rate-limited) → `lib/services/account-deletion.ts` (policy in §9) → sessions invalidated → sign-out with notice. New nullable column `users.deletedAt` (additive migration). Session classifier treats deleted rows as "gone".
- **Testing:** browser (customer): button → dialog disabled until phrase → wrong password rejected in-dialog → correct → `/auth/login?reason=account-deleted`; row anonymised; old credentials rejected. Integration tests: all three roles, wrong phrase/password, admin refusal, open-payout block, ledger kept, brand closed + partners notified, e-mail freed.
- **Status:** Fixed

## 2–4. Files changed

**New:** `lib/services/landing.ts`, `components/charts/lazy-charts.tsx`, `lib/storage/hosted-image.ts`, `lib/storage/supabase.ts`, `lib/storage/upload-kinds.ts`, `app/api/uploads/[kind]/route.ts` (moved from `product-image/route.ts`), `lib/services/account-deletion.ts`, `components/account/delete-account.tsx`, `scripts/admin-check.ts`, `app/dashboard/{admin,creator,customer}/loading.tsx`, `app/(marketing)/campaigns/loading.tsx`, `prisma/migrations/20260918150000_user_deleted_at/`, `tests/integration/account-deletion.test.ts`, `tests/unit/storage-drivers.test.ts`.

**Modified:** `app/(marketing)/page.tsx`, `app/layout.tsx`, `next.config.ts`, `components/products/product-thumb.tsx`, `components/marketing/product-showcase.tsx`, `components/marketing/site-footer.tsx`, `app/(marketing)/{about,how-it-works,terms}/page.tsx`, `app/dashboard/brand/settings/page.tsx`, `app/dashboard/brand/{page,analytics/page}.tsx`, `lib/services/{campaigns,brands,creators,users}.ts`, `app/actions/{campaigns,brand,creator,account}.ts`, `components/brand/brand-form.tsx`, `components/creators/creator-profile-form.tsx`, `components/account/{account-forms,settings-page}.tsx`, `components/dashboard/shell.tsx`, `app/dashboard/*/layout.tsx`, `app/auth/onboarding/page.tsx`, `app/dashboard/{brand/profile,creator/profile}/page.tsx`, `lib/validation/{brand,creator,account}.ts`, `lib/storage/{index,availability}.ts`, `lib/config/env.ts`, `lib/auth/{guards,session-state}.ts`, `app/auth/login/page.tsx`, `prisma/schema.prisma`, `scripts/create-admin.ps1`, `package.json` (`admin:check`), `.env.example`, `README.md`, `docs/{API,PRODUCTION}.md`, tests.

## 5. Database changes
- `20260918150000_user_deleted_at`: `ALTER TABLE "users" ADD COLUMN "deletedAt" TIMESTAMP(3);` — additive, nullable, no data touched. Apply with `npm run db:deploy` (or the SQL editor + history row, as before) **before** deploying; `/api/health` reports `schema: behind` until it is applied (`REQUIRED_MIGRATION` bumped).

## 6. Environment variables required
| Variable | Where | Purpose |
|---|---|---|
| `STORAGE_PROVIDER=supabase` | Vercel (Production) | switch from the read-only local driver |
| `SUPABASE_URL` | Vercel | `https://<ref>.supabase.co` (Project settings → API) |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel (server-only, never `NEXT_PUBLIC_`) | upload/delete objects |
| `SUPABASE_STORAGE_BUCKET` | Vercel | public bucket name (default `uploads`) |
| `NEXT_PUBLIC_STORAGE_PUBLIC_URL` | Vercel | `https://<ref>.supabase.co/storage/v1/object/public/uploads` — enables `next/image` for uploads |
| `CRON_SECRET` (from batch 1) | Vercel + GitHub secret | outbox retries |
| `EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, `EMAIL_FROM` (still open) | Vercel | password reset / notifications |
| `RATE_LIMIT_PROVIDER=upstash`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` (still open) | Vercel | shared login limiter |

No secret values are stored in the repository; `.env.example` documents placeholders.

## 7. Admin setup / recovery instructions
1. Diagnose (read-only):
   `powershell -ExecutionPolicy Bypass -Command "$env:DATABASE_URL = Read-Host 'Production DATABASE_URL' ; $env:ADMIN_EMAIL = 'arjunganster679@gmail.com' ; npm.cmd run admin:check ; Remove-Item Env:DATABASE_URL"`
2. Act on the printed step: **lost bootstrap password** → `powershell -ExecutionPolicy Bypass -File scripts\create-admin.ps1`, answer **y** to rotate, same e-mail, new password (first sign-in then asks to change it once more); **no admin** → same script, answer **n**; **limiter** → wait 10 minutes; **schema BEHIND** → `npm run db:deploy`.
3. Sign in at `/auth/login` (or *Continue with Google* with the same e-mail — it links to the admin account).

## 8. Image upload setup
Supabase → Storage → New bucket `uploads` (**public**) → set the five variables in §6 → redeploy → `/api/health` shows no storage warning → product / brand / creator / account forms show the uploader. Limits: JPG, PNG, WebP; 5 MB; 30 uploads / 10 min per user; server-side magic-byte sniffing; owner-scoped folders.

## 9. Account deletion behaviour
Personal data removed/anonymised: name, e-mail (freed), phone, photo, password hash, Google link, notifications, reset tokens, queued e-mails, creator profile. Kept (anonymised owner): referrals, conversions, commissions, rewards, payout history, audit log. Brand owners: brand suspended, campaigns ended, partner links disabled, partners + admins notified. Blocked while a payout request is open; unrequested approved balance is forfeited (dialog warns). Admins cannot self-delete; the last admin can never be removed (existing `suspendUser` guard). Re-authentication: current password (password accounts) + typed `DELETE`. All sessions invalidated.

## 10. Performance — before / after
| Item | Before | After |
|---|---|---|
| Homepage DB work per request | 6 queries, unbounded lists, QR render | 0 for 60 s windows (5 bounded queries on refresh), QR once per process |
| Marketplace live filter | all ACTIVE rows fetched, dates filtered in JS | date window in SQL |
| Hosted images | plain `<img>`, original bytes | `next/image` AVIF/WebP, sized, lazy; hero prioritised |
| Recharts | SSR + eager hydration | client-only, lazy, skeletons |
| Dashboard/marketplace transitions | blank (root spinner) | skeleton `loading.tsx` |
| Fonts | default | `display: swap`, mono not preloaded |
| Region (batch 1) | bom1/iad1 → Tokyo DB | `hnd1` |
Production baseline before deploy: `/` TTFB 0.47–1.0 s, `/campaigns` 0.47 s. Lighthouse is not available in this environment; re-measure with `curl -w '%{time_starttransfer}'` and PageSpeed after deploy. Remaining bottlenecks: the marketing header still resolves the session per request (needed for the Log in / dashboard button); listing pages without pagination (`take: 200`); external image hosts cannot be optimised by design.

## 11. Tests performed
- Automated: 254 tests (unit + integration on a real Postgres), lint, typecheck, production build.
- Admin (local, browser + curl): valid login ✅ · invalid password → "Invalid email or password" ✅ · redirect to `/dashboard/admin` ✅ · refresh keeps session ✅ · logout ✅ · brand/creator/customer opening `/dashboard/admin` → redirected to their own dashboard ✅ · unauthenticated `/dashboard/admin` → login ✅ · admin actions guarded server-side (`assertRole("ADMIN")` in all 8 admin actions, verified by reading `app/actions/admin.ts`) ✅ · forced password rotation flow ✅ · all 11 admin pages 200 ✅.
- Uploads (local, browser): brand logo + cover via the component → saved → served → `/_next/image` WebP ✅; customer avatar → saved → sidebar ✅; direct `POST /api/uploads/brand-logo` → 200 with owner-scoped URL ✅.
- Deletion (local, browser): dialog gating, wrong password, success + sign-out + notice ✅; DB state anonymised ✅; old login rejected ✅.
- Not testable here: Supabase Storage against a real bucket (driver is fetch-based and unit-tested with a mocked API; needs the production variables), production timings after deploy, Lighthouse.

## 12. Remaining issues
- Production admin state must be diagnosed by the operator (§7).
- Storage/e-mail/rate-limit variables are operator configuration (§6).
- From the audit, still open: REF-01 attribution copy/design, CONV-01/02, CAMP-02, AUTH-02, PRIV-01, pagination, e2e tests.
- Uploaded files are not deleted from storage when replaced/removed (URL is simply replaced); add a cleanup job later.

## 13. Deployment instructions (after approval)
1. `npm run db:deploy` (Production `DATABASE_URL`, `DB_DEPLOY_CONFIRM_HOST=aws-0-ap-northeast-1.pooler.supabase.com`) → applies `20260918150000_user_deleted_at`.
2. Create the Supabase bucket and set the §6 variables in Vercel.
3. `git push origin main` → Vercel builds (`prisma generate && next build`).
4. Verify: `/api/health` → `schema: current`, no storage warning; `/` footer shows "All rights reserved"; upload an image on `/dashboard/brand/profile`; Settings shows Danger zone; `admin:check` → healthy.
