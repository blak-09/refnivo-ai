# Production runbook

This document covers the database and security procedures required before and during production operation.
Nothing here uses `prisma db push`, `prisma migrate reset` or `prisma migrate dev` against production — **only `prisma migrate deploy`**.

## 1. Environment separation

| Environment | `DATABASE_URL` | `AUTH_SECRET` | `NEXT_PUBLIC_APP_URL` / `NEXTAUTH_URL` | Demo logins |
| --- | --- | --- | --- | --- |
| Local dev | embedded Postgres `localhost:5433` | any long random value | `http://localhost:3000` | shown |
| Preview (Vercel) | a **separate** staging database | its own secret | preview URL (leave `NEXTAUTH_URL` empty) | never (production build) |
| Production | pooled hosted Postgres | its own secret | the real public URL | never |

Rules enforced in code:
- The app refuses to boot without `AUTH_SECRET` (`lib/config/env.ts` → `lib/auth/index.ts`, `lib/services/tracking.ts`).
- Demo quick-login buttons are never rendered in production builds (`lib/utils/demo.ts`).
- `npm run db:seed` refuses to run against a non-local database (`prisma/seed.ts`).
- Only `NEXT_PUBLIC_APP_URL` and `NEXT_PUBLIC_SHOW_DEMO_LOGINS` are public; neither is a secret.

## 2. Backups

Take a backup **before every migration** and on a schedule (daily is a sensible minimum for launch).

Supabase (the current host): Dashboard → Database → Backups (daily automatic on paid plans; on the free plan take a manual dump before migrating).
Manual logical dump from any machine with `pg_dump` (uses the **direct** connection, port 5432, not the pooler):

```bash
pg_dump "postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres" --no-owner --format=custom --file refnivo-$(date +%Y%m%d-%H%M).dump
```

Restore (into an empty database only — never over production without a maintenance window):

```bash
pg_restore --no-owner --dbname "<target DATABASE_URL>" refnivo-YYYYMMDD-HHMM.dump
```

Keep at least 7 daily dumps off-platform.

## 3. Migration history baseline (one-time)

The production schema was created from `prisma migrate diff --from-empty` SQL, so `_prisma_migrations` did not exist.
Verified on 2026-09-16 by fingerprinting `information_schema.columns`, `pg_indexes`, constraints (incl. delete rules) and enum labels on both the local Prisma-migrated database and production:

| Part | Local | Production |
| --- | --- | --- |
| columns (190) | `7110e53c…` | `7110e53c…` ✅ |
| indexes (66) | `d132e189…` | `d132e189…` ✅ |
| constraints (41) | `41f1e1d1…` | `41f1e1d1…` ✅ |
| enum labels | identical sets | identical sets ✅ (only the *sort order* of `UserStatus` differs: `…,SUSPENDED,REJECTED` vs `…,REJECTED,SUSPENDED` — Prisma compares enum variants by presence, so this is not drift; it only affects `ORDER BY status` between those two values) |

Because the three original migrations are fully represented, mark them as applied **without running them**:

```bash
# from a machine with the production DATABASE_URL exported (direct or pooler URL both work)
npx prisma migrate resolve --applied 20260913143039_init_brand_platform
npx prisma migrate resolve --applied 20260914120000_user_approval_status
npx prisma migrate resolve --applied 20260914130000_user_verification_fields
npx prisma migrate status        # expect: 1 pending → 20260916090000_referral_link_visitor_index
npm run db:deploy                # applies the pending index migration
```

Exact SQL equivalent (what `migrate resolve --applied` writes — usable from the Supabase SQL editor if you prefer not to expose the password to a shell):

```sql
CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
  "id" VARCHAR(36) PRIMARY KEY NOT NULL,
  "checksum" VARCHAR(64) NOT NULL,
  "finished_at" TIMESTAMPTZ,
  "migration_name" VARCHAR(255) NOT NULL,
  "logs" TEXT,
  "rolled_back_at" TIMESTAMPTZ,
  "started_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "applied_steps_count" INTEGER NOT NULL DEFAULT 0
);
INSERT INTO "_prisma_migrations" ("id","checksum","finished_at","migration_name","started_at","applied_steps_count") VALUES
  (gen_random_uuid()::text, '90832e5f32b2a4e3c62114021d67a5a53a327eee8fe77a4c043bfca44e2b01fb', now(), '20260913143039_init_brand_platform', now(), 1),
  (gen_random_uuid()::text, '5bb461f1637ce0b3904a767b7aa2b4d55ec356775d42f9b811e514843295886c', now(), '20260914120000_user_approval_status', now(), 1),
  (gen_random_uuid()::text, 'f30a8eede45cdb2bff26ca49514d242edd8584076a25d37fcf00eab022f8c626', now(), '20260914130000_user_verification_fields', now(), 1)
ON CONFLICT DO NOTHING;
```

The checksums are `sha256(migration.sql)` and were verified against the files in `prisma/migrations/`.
Do **not** mark `20260916090000_referral_link_visitor_index` as applied — it must be *run* (it only creates one index).

## 4. Deploying migrations

```bash
export DATABASE_URL="<production URL>"
export DB_DEPLOY_CONFIRM_HOST="<database hostname, e.g. aws-0-ap-northeast-1.pooler.supabase.com>"
DB_DEPLOY_DRY_RUN=1 npm run db:deploy   # shows target host + pending migrations, applies nothing
npm run db:deploy                       # runs `prisma migrate deploy` only
```

`scripts/db-deploy.ts` refuses to run without `DATABASE_URL`, prints only host/db (never the password), and never calls `db push` or `reset`.
Remote targets additionally require `DB_DEPLOY_CONFIRM_HOST` to equal the parsed hostname, and the script refuses a database that has no
migration history yet (P3005) so the baseline in section 3 can never be skipped by accident.
The developer commands `db:migrate`, `db:push:local` and `db:reset:local` run only against `localhost` (no override flag exists).
On Vercel, run migrations from CI or your machine **before** promoting the deployment; do not run them in the build step.

## 5. Connection pooling

Serverless functions open many short-lived connections. Use the provider's pooler URL for `DATABASE_URL`
(Supabase: transaction pooler on port 6543 with `?pgbouncer=true`). `lib/db/prisma.ts` keeps a single `PrismaClient` per process.
Use the **direct** URL only for `pg_dump`/`migrate` if the pooler rejects DDL.

## 6. Health check

`GET /api/health` → `200 {"ok":true,"db":"up",…}` or `503 {"ok":false,"db":"down",…}`. It exposes no hostnames, versions, env values or error text. Point your uptime monitor at it.

## 7. Admin bootstrap checklist (fresh production database)

1. Confirm no demo accounts remain: `SELECT email, role, status FROM users WHERE email LIKE '%@localgrowth.demo';` → must be empty or `SUSPENDED`.
   To neutralise the seeded demo admin without deleting history:
   ```sql
   UPDATE users SET status = 'SUSPENDED' WHERE email = 'admin@localgrowth.demo';
   ```
2. Confirm which database the scripts will hit — `DATABASE_URL` must come from the **shell**, not from `.env` (which points at the local dev DB):
   ```powershell
   $env:DATABASE_URL = "<production URL>"
   npm run db:target        # prints source + host:port/db only (never credentials); must say REMOTE
   ```
3. Create the real admin **from the same shell session**, never by inserting a known password:
   ```powershell
   $env:ADMIN_BOOTSTRAP_CONFIRM = "<database hostname exactly as printed by db:target>"
   $env:ADMIN_EMAIL    = "you@yourcompany.com"
   $env:ADMIN_NAME     = "Your Name"
   $env:ADMIN_PASSWORD = Read-Host "Admin password (12+ chars, letter+number, not a previously shared one)"
   npm run admin:create
   Remove-Item Env:ADMIN_PASSWORD, Env:ADMIN_EMAIL, Env:ADMIN_NAME, Env:ADMIN_BOOTSTRAP_CONFIRM, Env:DATABASE_URL
   ```
   The script prints the target database first and then **refuses** when: the host is LOCAL (unless `ADMIN_ALLOW_LOCAL=1`);
   `ADMIN_BOOTSTRAP_CONFIRM` is missing or differs from the hostname; the e-mail already exists (it **never** overwrites or
   promotes an account — an existing *admin* can only be password-rotated with `ADMIN_ROTATE_EXISTING=1`, which also revokes its
   sessions); an approved admin already exists (unless `ADMIN_ALLOW_ADDITIONAL=1`); the password is weak or on the exposed-password
   deny-list. On success it creates an APPROVED `ADMIN` with `mustChangePassword = true`, writes an `ADMIN_BOOTSTRAPPED` audit row,
   and never prints the password or hash.
   On Windows PowerShell (where `npm` may be blocked by the execution policy and quoting is error-prone) use the
   prompt-driven wrapper instead — it asks for the URL and password hidden and never echoes them:
   ```powershell
   powershell -ExecutionPolicy Bypass -File scripts\create-admin.ps1
   ```
4. Sign in. You are redirected to Settings until you set a new password; doing so signs out every session (including this one) —
   log in again with the new password, then open `/dashboard/admin/registrations` and confirm approvals work.
5. Rotate `AUTH_SECRET` if it was ever shared in chat/tickets — rotating invalidates all sessions (users simply log in again).

## 8. Start-up validation, rate limiting and security logs

- On boot in production, `instrumentation.ts` runs `validateProductionEnv()` and **refuses to start** if `AUTH_SECRET` (≥ 32 chars),
  a non-local pooled `DATABASE_URL`, an https `NEXT_PUBLIC_APP_URL` or an https `NEXTAUTH_URL`/`AUTH_URL` is missing, or if any payment
  flag (`PAYMENTS_ENABLED`, `PAYMENT_PROVIDER` ≠ `NONE`) is enabled. Messages name variables only — values are never printed.
- Rate limiting: `RATE_LIMIT_PROVIDER=memory` (default) counts per instance; set `upstash` with `UPSTASH_REDIS_REST_URL` /
  `UPSTASH_REDIS_REST_TOKEN` for a shared counter across serverless instances. The limiter is **fail-open**: if the shared store is
  unreachable, requests are allowed and a `RATE_LIMIT_STORE_ERROR` security event is logged once per minute — during such an outage,
  brute-force protection is reduced to what the platform provides. `RATE_LIMIT_ALLOW_MEMORY=1` silences the production warning.
- Security events are single JSON lines on stderr prefixed `[security]` (`LOGIN_FAILED`, `RATE_LIMITED`, `SESSION_STALE`,
  `UPLOAD_REJECTED`, `ADMIN_BOOTSTRAP_REFUSED`, `ENV_VALIDATION_*`). Values pass through a redactor that drops password/token/cookie/
  authorization/key fields, masks e-mails and strips credentials from URLs. Ship stderr to your log drain (Vercel → Logs / a drain).
- Audit rows now carry `actorRole`, a salted `ipHash`, a truncated `userAgent` and `requestId` (from `x-vercel-id` / `x-request-id`).
- Sessions: a password change bumps `users.sessionVersion`, which invalidates every existing JWT for that user immediately.

## 9. Manual payouts, e-mail and notifications

- **Payouts / redemptions** are manual: creators and customers request settlement from Earnings / Rewards once their
  approved balance reaches `PAYOUT_MINIMUM_AMOUNT`; admins review at `/dashboard/admin/payouts`, settle off-platform and
  record the external reference with **Mark paid** — the only path that sets commissions `PAID` / rewards `REDEEMED`.
  Refunds recorded by a brand reverse the related ledger entries (`REVERSED`), including ones already settled (visible
  as `alreadySettled` in the audit log so the balance can be recovered manually).
- **E-mail**: set `EMAIL_PROVIDER=resend`, `RESEND_API_KEY` and a verified `EMAIL_FROM` to deliver registration
  decisions, notifications (per-user opt-out in Settings) and password-reset links. With the default `console`
  driver nothing is sent and the forgot-password page says so.
- **Notifications** are stored in `notifications` (per user, read/unread) and shown under each dashboard's
  Notifications page; the sidebar shows the unread count.
- **Transactional outbox**: e-mails are never sent from inside a database transaction. Business code writes an
  `email_outbox` row in the same transaction as the notification (unique `idempotencyKey` per event, so nothing is
  ever queued twice); if the transaction rolls back the row disappears with it. Delivery runs after commit
  (`lib/db/prisma.ts` → `transaction()`), claims each row atomically (`PENDING → SENDING`) and retries failures with
  backoff up to 5 attempts. Schedule `npm run email:outbox` (cron / Vercel cron / GitHub Actions schedule, e.g. every
  5 minutes) as the retry safety net; `/dashboard/admin/health` shows waiting/failed counts.

## 10. Pre-launch checklist

- [ ] `AUTH_SECRET` (≥ 32 chars), `DATABASE_URL` (pooler, `?pgbouncer=true`), `NEXT_PUBLIC_APP_URL` (https), `NEXTAUTH_URL` (https) set in Vercel → Production; `PAYMENT_PROVIDER=NONE`, `PAYMENTS_ENABLED=false`
- [ ] `RATE_LIMIT_PROVIDER=upstash` + Upstash credentials set (or `RATE_LIMIT_ALLOW_MEMORY=1` accepted knowingly)
- [ ] `EMAIL_PROVIDER=resend` + `RESEND_API_KEY` + verified `EMAIL_FROM` (otherwise password reset is unavailable)
- [ ] `/dashboard/admin/health` shows the database reachable, migrations applied and no configuration errors
- [ ] Separate values set for Preview
- [ ] Backup taken; `_prisma_migrations` baselined (section 3); `npx prisma migrate status` clean
- [ ] Demo admin suspended; real admin created via `npm run admin:create`
- [ ] `curl -I https://<prod>/` shows `Strict-Transport-Security`, `Content-Security-Policy`, `X-Frame-Options: DENY`
- [ ] `GET /api/health` returns 200
- [ ] `STORAGE_PROVIDER` moved off `local` before brands upload images (files on `local` do not survive redeploys)
