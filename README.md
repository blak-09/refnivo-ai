# LocalGrowth AI

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

### Demo accounts (password for all: `Demo@1234`)

Quick sign-in IDs — one per role. Outside production the login page shows these as one-click buttons (set `NEXT_PUBLIC_SHOW_DEMO_LOGINS=true` to show them on a demo deployment).

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
| `AUTH_SECRET` | yes | Secret for Auth.js JWT/session signing (also salts hashed IPs / customer contacts). `openssl rand -base64 32`. |
| `NEXTAUTH_URL` | deploy only | Canonical URL for Auth.js on deployments. Leave empty locally so tunnels work (`trustHost` uses the request host). |
| `NEXT_PUBLIC_APP_URL` | yes | Public origin used to build referral links (`/r/CODE`) and QR codes. |
| `AI_PROVIDER` | no | `anthropic`, `openai` or `mock` (default). AI features are added in phase R4; `mock` needs no key. |
| `ANTHROPIC_API_KEY` | no | Used when `AI_PROVIDER=anthropic`. Server-side only. |
| `OPENAI_API_KEY` | no | Used when `AI_PROVIDER=openai`. Server-side only. |
| `PAYOUT_MINIMUM_AMOUNT` | no | Minimum payout request in minor units (default `50000` = ₹500). |
| `STORAGE_PROVIDER` | no | Image storage driver — `local` (default; writes to `public/uploads`). The `lib/storage` abstraction lets you add an R2/S3/Cloudinary/Supabase driver without touching callers. |
| `NEXT_PUBLIC_SHOW_DEMO_LOGINS` | no | `true` shows the quick sign-in buttons on the login page in production builds (demo deployments only). |
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
| `npm run db:migrate` | `prisma migrate dev` (development). |
| `npm run db:deploy` | `prisma migrate deploy` (production). |
| `npm run db:seed` | Load / reload demo data. |
| `npm run db:studio` | Prisma Studio. |
| `npm run tunnel` | Cloudflare quick tunnel for a temporary public link. |

## Routes

```
Public      /  /how-it-works  /pricing  /about  /contact  /privacy  /terms
            /campaigns (marketplace + filters)  /campaigns/[slug]
            /products  /products/[slug]   /brands  /brands/[slug]   /creators/[username]
            /r/[code]  (referral entry: records click/QR scan, sets attribution, redirects to campaign page)
Auth        /auth/login  /auth/register  /auth/onboarding (brand or creator profile)
Brand       /dashboard/brand  products  campaigns (new/[id]/edit)  creators  orders  payouts  analytics  profile  settings
Creator     /dashboard/creator  campaigns  links  conversions  earnings  profile  settings
Customer    /dashboard/customer  referrals  rewards  settings
Admin       /dashboard/admin  settings
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

1. Push the repo and import it in Vercel.
2. Provision PostgreSQL (Neon / Supabase / Vercel Postgres) and set every variable from `.env.example` (`NEXT_PUBLIC_APP_URL` = your public URL so referral links are correct).
3. Run migrations against production: `npx prisma migrate deploy`.
4. Optionally seed demo data on a staging database only: `npm run db:seed`.
5. Deploy — `next build` is verified to pass.

## Known limitations (current build)

- Product images are uploaded from the device to local disk (`public/uploads`) via the `local` storage driver — great for dev/self-hosted. On ephemeral/serverless hosts, switch `STORAGE_PROVIDER` to a cloud driver (interface in `lib/storage`). Existing external image URLs keep working.

- Orders are recorded manually by the brand (referral code + order reference). Store integrations (Shopify/WooCommerce webhooks) are on the roadmap; the `?ref=CODE` parameter is already passed to the purchase URL.
- Payout requests, reward redemption, admin management tools and AI features are scheduled for phases R3b/R4 (see `docs/PROGRESS.md`).
- Images are URL fields; no file upload. One brand per owner account.
- Creator social metrics are self-reported (no social API).
- No rate limiting on auth endpoints yet.
