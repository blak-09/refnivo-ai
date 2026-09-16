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
DB_DEPLOY_DRY_RUN=1 npm run db:deploy   # shows target host + pending migrations, applies nothing
npm run db:deploy                       # runs `prisma migrate deploy` only
```

`scripts/db-deploy.ts` refuses to run without `DATABASE_URL`, prints only host/db (never the password), and never calls `db push` or `reset`.
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
   $env:ADMIN_EMAIL    = "you@yourcompany.com"
   $env:ADMIN_NAME     = "Your Name"
   $env:ADMIN_PASSWORD = Read-Host "Admin password (12+ chars, letter+number)"
   npm run admin:create
   Remove-Item Env:ADMIN_PASSWORD, Env:ADMIN_EMAIL, Env:ADMIN_NAME, Env:DATABASE_URL
   ```
   The script prints the target database first, **refuses LOCAL hosts** unless `ADMIN_ALLOW_LOCAL=1`, upserts an APPROVED `ADMIN`, writes an audit row, and never prints the password or hash.
4. Sign in, open `/dashboard/admin/registrations`, and confirm approvals work.
5. Rotate `AUTH_SECRET` if it was ever shared in chat/tickets — rotating invalidates all sessions (users simply log in again).

## 8. Pre-launch checklist

- [ ] `AUTH_SECRET`, `DATABASE_URL` (pooler), `NEXT_PUBLIC_APP_URL`, `NEXTAUTH_URL` set in Vercel → Production
- [ ] Separate values set for Preview
- [ ] Backup taken; `_prisma_migrations` baselined (section 3); `npx prisma migrate status` clean
- [ ] Demo admin suspended; real admin created via `npm run admin:create`
- [ ] `curl -I https://<prod>/` shows `Strict-Transport-Security`, `Content-Security-Policy`, `X-Frame-Options: DENY`
- [ ] `GET /api/health` returns 200
- [ ] `STORAGE_PROVIDER` moved off `local` before brands upload images (files on `local` do not survive redeploys)
