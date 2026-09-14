# Architecture

## Core flow

```
Brand lists products → creates a product campaign (commission + customer reward + rules)
→ creators apply / customers join → unique referral link + QR (HANDLE-BRAND-XXXX)
→ /r/CODE records the click (LINK or QR) + a referral session, sets last-click attribution
→ shopper buys on the brand store (?ref=CODE) → brand records the order → verifies it
→ commission (creator) or reward (customer) approved in the ledger → payout
```

## Data model (Prisma / PostgreSQL)

| Model | Purpose | Notable constraints |
| --- | --- | --- |
| `User` | All accounts; `role` ∈ BRAND_OWNER, CREATOR, CUSTOMER, ADMIN | unique `email`, `status` ACTIVE/SUSPENDED |
| `Brand` | Brand profile (industry, socials, verification) — one per owner in v1 | unique `slug` |
| `Product` | A product sold online; price in paise, purchase URL, SKU, status | unique `slug`, unique `(brandId, sku)` |
| `CreatorProfile` | Public creator profile incl. self-reported social metrics, audience, samples | unique `userId`, `username` |
| `Campaign` | Promotes exactly one product; commission, reward, rules, budget, `requiresApproval` | unique `slug`, `productId` (Restrict) |
| `PartnerApplication` | Creator/customer joining a campaign | unique `(campaignId, userId)` |
| `ReferralLink` | Unique code per partner per campaign | unique `code`, unique `(campaignId, ownerId)` |
| `ReferralClick` | Click log with `source` LINK/QR, anonymous visitor id, hashed IP, referer | indexed by campaign/date |
| `Referral` | Referral sessions (CLICKED/VISITED) and orders (PURCHASED/VERIFIED/REJECTED) | indexed by campaign/status |
| `Conversion` | Order tied to a referral (value, quantity, source, verifier) | unique `referralId`, unique `(brandId, orderReference)` |
| `Reward` / `Commission` | Ledger entries; amounts fixed at order time | unique per referral + recipient |
| `PayoutRequest` | Manual payout workflow | status machine |
| `AIInsight`, `AuditLog` | Stored insights; every mutation audited with actor + JSON metadata | |

## Money

- Amounts: **integer paise** (`₹100 = 10000`). Percentages: **basis points** (`10% = 1000`).
- `lib/money` converts form units ↔ stored units and applies percentages with integer half-up rounding.
- `lib/domain/rewards.ts` computes the customer reward / creator commission for an order value.
  `lib/services/conversions.ts` writes the ledger entries when an order is recorded (PENDING) and flips them to
  APPROVED (commission) / AVAILABLE (reward) on verification — or REJECTED. Amounts never change after that.

## Auth & authorization

- Auth.js v5 Credentials provider (`lib/auth/index.ts`), bcrypt (cost 12), JWT session (7 days) carrying `id`, `role`, `status`.
- `proxy.ts` redirects unauthenticated users away from `/dashboard/**` and `/auth/onboarding`, sends logged-in users
  away from login/register, and enforces that `/dashboard/<segment>` matches the user's role.
- Every page/layout re-checks server-side via `lib/auth/guards.ts`:
  - `requireUser()` / `requireRole()` / `requireBrand()` / `requireCreator()` — redirect (pages; brand/creator also require onboarding).
  - `assertUser()` / `assertRole()` / `assertBrandOwner()` / `assertCreator()` / `assertPartner()` — throw `AuthorizationError` (server actions).
- Suspended users are refused at login and on every request.
- Services take `brandId` / `ownerId` explicitly and scope every query by it, so ownership is enforced in the data layer.
- Brands see a creator's public profile and self-reported metrics, never their email/phone. Customers never see creator metrics.
  Partners never see who bought — only order value and status.

## Campaign lifecycle

```
DRAFT ──PUBLISH(confirmed)──▶ ACTIVE ──PAUSE──▶ PAUSED ──RESUME──▶ ACTIVE
                                 │                 │
                                 └──END──▶ ENDED ◀─┘ ──ARCHIVE──▶ ARCHIVED
DRAFT/PAUSED/ENDED ──ARCHIVE──▶ ARCHIVED     DRAFT ──DELETE
```

- `publishProblems()` blocks publishing/resuming when a campaign that includes customers has a zero reward, one that
  includes creators has a zero commission, the end date is past, budget ≤ 0, or the product is not active.
- `isCampaignLive()` = status ACTIVE **and** inside the date window — enforced by `/r/[code]`, `joinCampaign` and
  `recordOrder`, so paused/expired campaigns cannot create new eligible conversions.
- Editing is allowed for DRAFT/ACTIVE/PAUSED; the product is locked once published; reward-rule changes are audit-logged.

## Tracking & attribution

- `/r/[code]` (`app/r/[code]/route.ts`): validates the code and campaign, records a `ReferralClick` (source LINK, or QR
  when `?src=qr` — the QR image encodes that URL), creates one referral session per visitor per link, sets `lg_vid`
  (visitor id, 1 year) and `lg_ref` (last-click attribution, max-age = the campaign's attribution window), then
  redirects to `/campaigns/[slug]?ref=CODE`.
- The campaign page shows "Recommended by …", marks the session VISITED and appends `?ref=CODE` to the product's
  purchase URL so the brand's store can capture it.
- Orders are attributed by code when the brand records them (`recordOrder`): the code identifies brand, product,
  campaign and partner. Rejected: inactive campaign, order below the minimum, duplicate order reference, self-referral
  (hashed customer contact equals the partner's email/phone), duplicate customer on new-customer-only campaigns.
  Verification is refused when it would exceed the campaign budget.

## Request/response pattern

- Forms use React 19 `useActionState` + Server Actions returning `ActionResult`
  (`{ ok, data } | { ok: false, error, fieldErrors, values }`); failed submits echo values so forms keep user input.
- The campaign wizard keeps state client-side, validates each step with its Zod schema, and posts JSON to
  `saveCampaignAction`, which re-validates the whole payload before writing.
- All writes run inside `prisma.$transaction` together with their audit-log row.

## Metrics & insights

`lib/services/metrics.ts` aggregates real rows only (verified orders for revenue; APPROVED/AVAILABLE/REDEEMED rewards
and APPROVED/PAID commissions for cost; top creators and products by attributed revenue). `lib/domain/insights.ts`
produces a deterministic, rule-based insight and returns "Not enough data" below thresholds. Phase R4 layers optional
LLM phrasing on top without adding numbers.
