# Refnivo AI

**Turn Creators and Customers Into Your Sales Engine.**

Affiliate and referral infrastructure for product brands — Levanta-style, but for any brand (think a headphone brand like boAt) with **both creators and everyday customers** as referral partners. India-first.

> Build status: **Brand platform repositioning (R1–R3) complete** — brands, products, product campaigns, public marketplace, creator/customer onboarding and dashboards, referral links + QR codes, click/QR tracking, order recording & verification, commission/reward ledger. See [docs/PROGRESS.md](docs/PROGRESS.md).

## The core flow

```
Brand lists a product → creates a campaign for it (commission + customer reward + rules)
   → creators apply / customers join → unique referral link + QR code (ARJUN-BOAT-4K7Q)
   → link/QR shared → shopper clicks, lands on the campaign page, buys on the brand's store (?ref=CODE)
   → brand records the order with the code → verifies it → commission / reward approved in the ledger
```

## Stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router, Turbopack), React 19, TypeScript |
| UI | Tailwind CSS v4, shadcn/ui (Base UI), Lucide icons, Recharts |
| Data | Prisma 6 + PostgreSQL |
| Auth | Auth.js v5 (Credentials, bcrypt, JWT sessions), role-based `proxy.ts` + server-side guards |
| Validation | Zod 4 (client steps + server re-validation) |
| QR codes | `qrcode` (server-generated PNG data URLs) |
| Tests | Vitest (unit + DB integration) |

## Quick start

```bash
npm install
cp .env.example .env         # then edit values (see below)
npm run db:local             # optional: embedded PostgreSQL on :5433 (or use `npm run dev:all` to start it with the app)
npm run db:migrate           # applies prisma/migrations
npm run db:seed              # loads clearly-labelled demo data
npm run dev                  # http://localhost:3000
```

`npm run db:local` downloads a real PostgreSQL binary (via `embedded-postgres`) and runs it in `.localdb/` — handy on machines without Postgres or Docker. Keep it running in a separate terminal. Any hosted Postgres (Neon, Supabase, Railway, Vercel Postgres) works the same way by changing `DATABASE_URL`.

### Demo accounts — local development only

`npm run db:seed` loads fictional demo data into a **local** database (the seed refuses remote hosts). The shared demo
password is printed by the seed and lives only in `prisma/seed.ts`; quick sign-in buttons appear on the login page
outside production and are never rendered in production builds. Never seed demo accounts into a real database.

| Role | Email | Workspace |
| --- | --- | --- |
| Brand owner | `brand@localgrowth.demo` | Demo Gadgets Co (1 product, no campaigns yet) |
| Creator | `creator@localgrowth.demo` | Demo Creator |
| Customer | `customer@localgrowth.demo` | — |
| Admin | `admin@localgrowth.demo` | Platform |

Richer demo workspaces with products, campaigns, partners, clicks, orders and ledger entries:

| Role | Email | Workspace |
| --- | --- | --- |
| Brand owner | `owner.soundwave@localgrowth.demo` | Soundwave Audio (headphones, earbuds) |
| Brand owner | `owner.glowlab@localgrowth.demo` | GlowLab Skincare |
| Brand owner | `owner.fitfuel@localgrowth.demo` | FitFuel Nutrition (draft campaign) |
| Creator | `arjun.tech@localgrowth.demo` | Arjun Reviews Tech |
| Creator | `sana.glow@localgrowth.demo` | Sana Glow Diaries |
| Creator | `neha.fit@localgrowth.demo` | Neha Lifts (pending application) |
| Customer | `aarav@localgrowth.demo` | — |

Demo accounts are labelled **Demo data** in the dashboard. Brands, products and metrics are fictional.

## Environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `DATABASE_URL` | yes | PostgreSQL connection string. |
| `AUTH_SECRET` | yes | Secret for Auth.js JWT/session signing (also salts hashed IPs / customer contacts). **The app refuses to start without it.** `openssl rand -base64 32`. |
| `NEXTAUTH_URL` | production | Canonical https URL for Auth.js (required by the production start-up check; `AUTH_URL` accepted). Leave empty locally so tunnels work. |
| `NEXT_PUBLIC_APP_URL` | yes | Public origin used to build referral links (`/r/CODE`), QR codes and e-mail links. |
| `EMAIL_PROVIDER` | no | `console` (default, logs only) or `resend` (needs `RESEND_API_KEY` + `EMAIL_FROM`). Password reset by e-mail is only offered when configured. |
| `RATE_LIMIT_PROVIDER` | production | `memory` (default, per instance) or `upstash` (`UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`) for a shared limiter. |
| `PAYOUT_MINIMUM_AMOUNT` | no | Minimum payout / redemption request in minor units (default `50000` = ₹500). |
| `STORAGE_PROVIDER` | no | Image storage driver — `local` (default; writes to `public/uploads`). The `lib/storage` abstraction lets you add an R2/S3/Cloudinary/Supabase driver without touching callers. |
| `PAYMENT_PROVIDER` / `PAYMENTS_ENABLED` | no | Must stay `NONE` / `false` — payouts are settled manually by an admin; the app refuses to start in production if payments are enabled. |
| `NEXT_PUBLIC_SHOW_DEMO_LOGINS` | no | Demo quick sign-in buttons show only in non-production builds (never in production). Set `false` to hide them on a shared dev server. |
| `TEST_DATABASE_URL` | no | Database for `npm test` integration tests (defaults to the local `localgrowth_test`). |

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server (Turbopack). |
| `npm run dev:all` | Embedded local PostgreSQL + dev server together (recommended locally). |
| `npm run build` / `npm start` | Production build / serve. |
| `npm run lint` | ESLint. |
| `npm run typecheck` | `tsc --noEmit`. |
| `npm test` | Vitest — unit tests + DB integration tests (needs `TEST_DATABASE_URL` reachable). |
| `npm run db:local` | Start the embedded local PostgreSQL. |
| `npm run db:migrate` | `prisma migrate dev` — **localhost only** (refuses remote hosts and `NODE_ENV=production`). |
| `npm run db:push:local` / `npm run db:reset:local` | `prisma db push` / `prisma migrate reset` — **localhost only**, same guard, no override flag. |
| `npm run db:deploy` | Safe production migrations: prints target + pending migrations, then `prisma migrate deploy` only. Remote targets need `DB_DEPLOY_CONFIRM_HOST=<hostname>`; `DB_DEPLOY_DRY_RUN=1` to preview. See `docs/PRODUCTION.md`. |
| `npm run db:target` | Prints which database the scripts will use (host/port/db only, never credentials). |
| `npm run email:outbox` | Delivers/retries queued e-mails from the transactional outbox (schedule it from cron). |
| `npm run admin:create` | Bootstrap the single admin from `ADMIN_EMAIL` / `ADMIN_NAME` / `ADMIN_PASSWORD` env vars; requires `ADMIN_BOOTSTRAP_CONFIRM=<db hostname>`; never overwrites or promotes an existing account; the admin must change the password at first login. Never prints the password. |
| `npm run db:seed` | Load / reload demo data — **local databases only** (refuses non-local hosts). |
| `npm run db:studio` | Prisma Studio. |
| `npm run tunnel` | Cloudflare quick tunnel for a temporary public link. |

## Routes

```
Public      /  /how-it-works  /pricing  /about  /contact  /privacy  /terms
            /campaigns (marketplace + filters)  /campaigns/[slug]
            /products  /products/[slug]   /brands  /brands/[slug]   /creators/[username]
            /r/[code]  (referral entry: records click/QR scan, sets attribution, redirects to campaign page)
Auth        /auth/login  /auth/register  /auth/forgot-password  /auth/reset-password  /auth/onboarding (brand or creator profile)
Brand       /dashboard/brand  products  campaigns (new/[id]/edit)  creators  orders  payouts  analytics  profile  notifications  settings
            /api/exports/campaigns/[id]  (CSV export, brand-scoped)
Creator     /dashboard/creator  campaigns  links  conversions  earnings (payout requests)  profile  notifications  settings
Customer    /dashboard/customer  referrals  rewards (redemption requests)  notifications  settings
Admin       /dashboard/admin  registrations  users  verification  campaigns  conversions  payouts  audit  health  notifications  settings
```

## Project structure

```
app/
  (marketing)/           landing, discover (campaigns/products/brands), detail pages, creator profile, legal
  r/[code]/route.ts      referral tracking redirect
  auth/                  login, register, onboarding
  dashboard/{brand,creator,customer,admin}/
  actions/               Server Actions (auth, brand, products, campaigns, partners, creator, conversions, account)
components/
  ui/                    shadcn/ui primitives (+ native-select)
  dashboard/             shell, nav config, KPI/empty-state/status primitives
  campaigns/             7-step wizard (product → details → commission → rules → duration → preview → publish)
  products/ brand/ creators/ orders/ links/ marketplace/ charts/ forms/ auth/ account/ marketing/
lib/
  auth/                  Auth.js config, guards (requireBrand / requireCreator / assert*), role routing
  domain/                Pure rules: campaign lifecycle, reward/commission maths, insights
  services/              brands, products, campaigns (+ marketplace), partners (join/approve/links), creators,
                         tracking (clicks/attribution), conversions (orders/verify/ledger), metrics, ledger, audit
  validation/            Zod schemas
  money/  utils/         integer money, referral codes, slugs, labels, dates
prisma/                  schema.prisma, migrations/, seed.ts
tests/                   Vitest unit + integration
docs/                    ARCHITECTURE, API, PROGRESS
```

## Key design decisions

- **Money is integer-only.** Paise for amounts, basis points for percentages. No floats touch the ledger.
- **A campaign promotes exactly one product**; the product cannot change after publishing.
- **Clicks are not sales.** `/r/CODE` records a click (source LINK or QR) and a referral session with an anonymous visitor id and hashed IP. Only orders the brand records and verifies create approved commissions/rewards.
- **Ledger amounts are fixed at order time**, so later rule edits never change what is owed.
- **Ownership on every query** (`brandId` scoping; non-owners touch zero rows). **Audit log on every mutation** in the same transaction.
- **Honest data.** Creator follower counts are labelled *Self-reported*; analytics say "not enough data" instead of estimating; customers never see creator metrics.
- **Referral codes** are human-readable: `<handle>-<brand>-<4 chars>` (e.g. `ARJUNTECH-SOUNDWAV-4K7Q`).

## Share a temporary public link (tunnel)

```bash
npm run dev      # terminal 1 (with npm run db:local running too)
npm run tunnel   # terminal 2 — prints a https://….trycloudflare.com URL
```

Works only while both are running on your machine; the URL changes each restart. `allowedDevOrigins` already permits `*.trycloudflare.com`.

## Deployment (Vercel)

Read **[docs/PRODUCTION.md](docs/PRODUCTION.md)** first — backups, migration baseline, pooling, health check, admin bootstrap and the pre-launch checklist.

1. Push the repo and import it in Vercel.
2. Provision PostgreSQL (Neon / Supabase / Vercel Postgres) and set every variable from `.env.example` (`NEXT_PUBLIC_APP_URL` = your public https URL so referral links are correct). The app validates the configuration at start-up and refuses to boot with a missing/insecure value.
3. Run migrations against production with the guarded runner: `DB_DEPLOY_CONFIRM_HOST=<db host> npm run db:deploy` (only ever `prisma migrate deploy`).
4. Create the single admin with `npm run admin:create` (see `docs/PRODUCTION.md` §7). Never seed demo data into production.
5. Deploy — `next build` is verified to pass. CI (`.github/workflows/ci.yml`) runs lint, typecheck, tests and build on every push.

## Known limitations (current build)

- Product images are uploaded from the device to local disk (`public/uploads`) via the `local` storage driver — great for dev/self-hosted. On ephemeral/serverless hosts, switch `STORAGE_PROVIDER` to a cloud driver (interface in `lib/storage`). Existing external image URLs keep working.

- Orders are recorded manually by the brand (referral code + order reference) and verified/refunded by the brand. Store integrations (Shopify/WooCommerce webhooks) are on the roadmap; the `?ref=CODE` parameter is already passed to the purchase URL.
- Payouts and reward redemptions are a **manual settlement workflow**: partners request, an admin approves, settles off-platform (UPI / bank / voucher) and records the reference. No money moves through the platform and no payment provider is integrated.
- E-mail verification at signup is not implemented. Password reset needs `EMAIL_PROVIDER=resend`.
- Image uploads (product, brand logo/cover, creator photo, account photo) go through one validated pipeline. Locally
  they land in `public/uploads`; production uses Supabase Storage (`STORAGE_PROVIDER=supabase`, see
  `docs/PRODUCTION.md` §10). Without a configured provider the forms show "Uploads unavailable" instead of failing.
- Users can delete their own account from Settings → Danger zone (personal data removed, ledger history kept; see
  `docs/PRODUCTION.md` §11).
- AI features are not implemented; the `AI_*` variables are reserved.
- One brand per owner account. Creator social metrics are self-reported until an admin marks the profile verified (no social API).
- **Continue with Google** is available on the login and register pages when `GOOGLE_CLIENT_ID` and
  `GOOGLE_CLIENT_SECRET` are set (see `docs/PRODUCTION.md` §9 for the Google Cloud setup; callback URL
  `/api/auth/callback/google`). Existing accounts with the same verified e-mail are linked, never duplicated; new
  Google accounts pick their role on the register page and follow `SIGNUP_APPROVAL`.
- Signup approval is a deployment setting, `SIGNUP_APPROVAL` (`auto` — default — every brand/creator/customer can sign
  in right after registering; `manual` — every account waits in `/dashboard/admin/registrations`; or a comma list of
  roles to auto-approve, e.g. `CREATOR,CUSTOMER`). Reviewed applicants receive an in-app notification and, when
  `EMAIL_PROVIDER` is configured, an e-mail on approval/rejection. Admins can still suspend any account.
- Auth endpoints have basic **in-memory** rate limiting (per instance). For multi-instance/serverless, back
  `lib/utils/rate-limit.ts` with a shared store (Redis/Upstash).
