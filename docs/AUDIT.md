# Refnivo — product & UX audit (25 Nov 2026)

Scope: the live site (https://www.refnivo.com, public pages only), the source code in this repository (`main` at
`b4d75f3`), and logged-in flows exercised **locally** with the seeded demo accounts. No code was changed for this audit.

**How to read the evidence column**

- **Live**: seen on refnivo.com.
- **Code**: read in this repo (file named).
- **Local**: exercised on `localhost` with demo data.
- **Unverified**: depends on production configuration this audit could not see. Vercel access had expired, and
  production cannot be signed into without a real account.

**Feature status labels**

- ✅ **Implemented**: works in code (and tests) and is reachable in the UI.
- 🟡 **Partial**: works, but with an important gap.
- 🗓 **Planned**: the product itself says "not available yet".
- ❔ **Unverified in production**: switched by an environment flag.

---

## 1. Existing product summary

**What it is.** A creator commerce platform for Indian product brands: *"Grow with creators. Pay only for results."*
Brands run campaigns per product. Creators (commission) and customers (referral reward) share unique links and QR codes.
The brand records and verifies the resulting orders, and a shared ledger tracks what is owed.

**Who it is for.**

- **Brands** are the paying customer: small Indian D2C and product brands that sell on their own store.
- **Creators** (nano and micro) and **customers** (happy buyers) are the free supply side.

**Problems it solves.**

- Proving which creator drove which sale.
- Paying only on verified orders.
- Replacing chats and spreadsheets for creator deals and UGC.

**Business model.**

- Brand subscription: Free (3 campaign launches), Starter ₹999 / 30 days, Growth ₹2,499 / 30 days.
  Source: `lib/config/plans.ts`.
- Plans do not auto-renew.
- No platform cut on commissions or UGC fees. Verified in code: no fee logic exists.

**Main journeys.**

1. **Brand:**
   1. Sign up and set up the brand profile.
   2. Add a product (with its purchase URL on the brand's own store).
   3. Run the 7-step campaign wizard and launch.
   4. Approve creator applications.
   5. Record orders, or confirm customer order claims.
   6. Verify or reject each order; refund if needed.
   7. Commissions and rewards are paid out by the Refnivo team.
2. **Creator:**
   1. Sign up and build a profile.
   2. Discover campaigns and apply.
   3. Once approved, get a link and QR code.
   4. Share; clicks are counted.
   5. The brand records and verifies orders.
   6. Request a payout.
   7. Admin settles it.
3. **Customer:**
   1. Sign up and join a customer-referral campaign.
   2. Share the link.
   3. Friends buy on the brand store.
   4. The brand records the order, or the buyer submits an order claim on the campaign page.
   5. The reward becomes available, then is redeemed through a payout request.
4. **UGC (Starter / Growth plans):** the brand posts a brief, creators pitch, the brand selects, delivery happens with
   up to 2 revisions, the brand approves, then pays off-platform and both sides confirm.
5. **Partners:** one page per creator showing campaigns, UGC, results and private notes.

**How attribution actually works today.** This matters for several findings below.

1. `/r/[code]` counts a click (de-duplicated and rate-limited), sets a last-click cookie *on refnivo.com*, and
   redirects to the campaign page. Source: `app/r/[code]/route.ts`.
2. "Buy" sends the shopper to the brand's store with `?ref=CODE`.
3. **No store integration exists.** `app/dashboard/brand/settings/page.tsx` itself says "Automatic order import from
   Shopify / WooCommerce … not available yet".
4. An order therefore enters Refnivo only when one of two things happens:
   - the brand records it by hand with the referral code, or
   - the shopper comes back and submits an **order claim** that the brand confirms.

   Source: `lib/services/conversions.ts`, `lib/services/order-claims.ts`.

### Feature inventory

| Feature | Status | Evidence |
| --- | --- | --- |
| Products, 7-step campaign wizard, edit/pause/end | ✅ | Code `components/campaigns/campaign-wizard.tsx`; Local |
| Marketplace: search, product type, category, partner type, 4 sorts | ✅ | Live `/campaigns`; Code `lib/services/campaigns.ts` |
| Creator applications + brand approval | ✅ | Code; Local |
| Referral links, QR, per-channel links | ✅ | Code `lib/services/channel-links.ts`; Local |
| Click tracking (30 s visitor dedupe, 1 h device dedupe, 60/min IP limit) | ✅ | Code `lib/services/tracking.ts` |
| Order recording by referral code (manual) | ✅ | Code `conversions.ts` |
| Customer order claims (no account needed) | ✅ | Live campaign page "Already ordered? Confirm your order" |
| Verify / reject / refund with ledger reversal, budget cap, min order, new-customer-only, self-referral hash check | ✅ | Code `conversions.ts` |
| Automatic order import (Shopify / WooCommerce) | 🗓 | Brand settings page copy |
| Payouts: request → admin review → paid with reference | ✅ | Code `payouts.ts` |
| Automatic payouts via provider | ❔ | `PAYOUT_PROVIDER` flag |
| Brand wallet (prepaid funds for commissions) | ❔ | `BRAND_WALLET_ENABLED`, off by default (`docs/PRODUCTION.md` §4b) |
| Plan checkout (Razorpay) | ❔ | `PAYMENTS_ENABLED` flag |
| Signup approval (auto / manual) | ❔ | `SIGNUP_APPROVAL` flag, `lib/config/signup-policy.ts` |
| Brand / creator verification by admin | ✅ | Code `app/dashboard/admin/verification` |
| Campaign moderation | 🟡 | Admin can moderate after launch; `PENDING_REVIEW` status exists but is **never set**, so campaigns go live unreviewed |
| UGC collaborations, Partners | ✅ | Code + tests; Local |
| Social OAuth | 🟡 | Live `/api/health`: YouTube, LinkedIn, X on; Instagram, Facebook off |
| Disputes / appeals | ❌ Not present | No dispute model, action or page (only mentioned in the privacy policy) |
| Product analytics / funnel events | ❌ Not present | No analytics SDK in `package.json` or the layout |
| Security headers, Upstash rate limiting | ✅ | Live response headers; Live `/api/health` |

---

## 2. Identified weaknesses

| # | Weakness | Area |
| --- | --- | --- |
| W1 | Who funds creator commissions is unclear, and the copy contradicts itself | Trust / payments |
| W2 | Orders that arrive after a campaign ends or pauses cannot be recorded, even inside the attribution window | Core bug |
| W3 | Brands can reverse a paid commission at any time, with no hold period, no clawback and no appeal | Trust / payments |
| W4 | Attribution depends entirely on the brand recording orders; marketing copy overstates it | Trust / claims |
| W5 | Pending orders and order claims have no deadline or SLA | Trust / creator experience |
| W6 | Campaigns go live without review; the live marketplace has listings outside the product-brand focus | Trust / marketplace |
| W7 | Shopper offer "10% — Apply at checkout!" shows no code to apply | Customer experience |
| W8 | Brand settings says billing is "not available yet", but billing exists | Stale copy |
| W9 | Developer jargon on public pages ("passed along as ?ref=") | Customer experience |
| W10 | Marketplace cards show "0 creators" and omit key terms (approval needed, shopper offer) | Marketplace |
| W11 | Public `/api/health` exposes infrastructure details | Security hygiene |
| W12 | Thin creator profiles reach the public directory with no completeness guidance | Creator experience |
| W13 | No product analytics, so activation and funnel metrics cannot be measured | Measurement |
| W14 | KPI cards stack one per row on phones, pushing the content far down | Mobile UX |
| W15 | Referral-link card overflowed the screen on phones | Mobile UX — **fixed** in `b4d75f3` |

### Status of fixes (25 Nov 2026)

| # | Status | What changed |
| --- | --- | --- |
| W1 | Fixed (code + copy) | One model everywhere: brands prepay into their Refnivo wallet, verification debits it, Refnivo pays partners after the refund window. FAQ, how-it-works, terms, refund policy, brand payouts and settings updated. Admin overview and health warn while `BRAND_WALLET_ENABLED` is off; **turn it on in production**. |
| W2 | Fixed | Orders dated inside the campaign window can be recorded (and buyer claims confirmed) for 30 days after a campaign ends or pauses. Order date is captured. |
| W3 | Fixed | Per-campaign refund window (`holdDays`, default 14); payouts wait for it; refunds refused after it or once paid; partners can contest rejections/refunds and admins resolve them. |
| W4 | Fixed (copy) | Home page and FAQ say plainly that brands confirm orders from their store; partners see how long each order has waited. |
| W5 | Fixed | Daily brand reminders at 3 and 7 days; "Waiting X days" shown to brands and partners; admin queue for items older than 14 days. |
| W6 | Fixed (code) | `CAMPAIGN_REVIEW` (first launch reviewed by default), admin approve / send back, public content policy. **Live off-scope listings must still be moderated by an admin.** |
| W7 | Fixed | Coupon code field (required with a shopper offer), shown with a copy button on the campaign page. |
| W8 | Fixed | Settings links to Billing. |
| W9 | Fixed | Customer-facing copy rewritten without URL parameters. |
| W10 | Fixed | Cards show "Approval needed" / "Instant link", the shopper offer, and "Be one of the first" instead of "0 creators". |
| W11 | Fixed | Public health answer is minimal; details for admins or `x-health-token`. |
| W12 | Fixed | Bio minimum 40 characters with guidance; directory ranks complete profiles first and hides empty ones. |
| W13 | Partly fixed | `/dashboard/admin/metrics` computes §13 metrics from database rows. Page-view funnels (wizard drop-off, campaign views) need an analytics tool. |
| W14 | Fixed | KPI grids use two columns on phones. |

---

## 3. Brand journey analysis

| Step | What happens | Problem | Evidence |
| --- | --- | --- | --- |
| Registration | Email/Google; may wait for admin approval | If `SIGNUP_APPROVAL=manual`, a brand cannot try the product until an admin acts; the time-to-value is unknown | Code `app/actions/auth.ts`; ❔ |
| Brand profile | 7 fields, 5 required (name, industry, description, business email, contact person) | Reasonable. Business email duplicates the account email for most small brands | Code `components/onboarding/brand-fields.tsx` |
| Product | Name, price, purchase URL, image | Hint says the store must "capture" `?ref=`; most small stores cannot, without a developer | Code `components/products/product-form.tsx` |
| Campaign wizard | 7 steps: product, details, rewards, rules, duration, preview, launch | Good structure. Goes live instantly (W6) | Code `campaign-wizard.tsx` |
| Creator discovery / approval | Directory + applications; numbers labelled self-reported, hidden from anonymous visitors | Works. Many profiles are thin (W12) | Live `/creators` |
| Order recording | Manual entry by code, or confirm a customer claim | The only path in, so it is the core workload. Blocked after the campaign ends (W2) | Code `conversions.ts:56` |
| Verification | Verify / reject; budget cap enforced | No reminder or deadline for pending items (W5) | Code |
| Commissions / payments | "Payouts are processed by the platform team" | The brand is never asked to fund them unless the wallet flag is on (W1) | Code `app/dashboard/brand/payouts/page.tsx:23` |
| Analytics | Campaign, source and partner tables; Growth plan analytics | Fine. Product-level funnel analytics are missing (W13) | Local |
| Settings | Says billing is not available | Stale (W8) | Code `app/dashboard/brand/settings/page.tsx:36` |

## 4. Creator journey analysis

| Step | Problem | Evidence |
| --- | --- | --- |
| Registration / profile | 5 fields (4 required); a one-word bio is accepted and published | Live `/creators` (several one-word bios); Code `creator-fields.tsx` |
| Social profiles | Instagram, the main creator platform in India, cannot be connected (provider off). Numbers fall back to self-reported | Live `/api/health` |
| Discovery / filtering | Search and filters work. Marketplace cards don't say whether approval is required | Live `/campaigns` |
| Campaign details | Clear: commission, reward, dates, approval, attribution window, minimum order, budget | Live campaign page — a strength |
| Application status | Shown in "My applications" | Local |
| Links | Works; mobile overflow fixed | Local, `b4d75f3` |
| Performance | Clicks are visible, but orders the brand never records are invisible. The creator cannot tell "no sales" from "sales not recorded" (W4) | Code |
| Earnings / payment | Payable as soon as the order is verified, yet reversible forever (W3). Copy says the Refnivo team settles, while the FAQ says the brand pays (W1) | Code `app/dashboard/creator/earnings/page.tsx`, `components/marketing/home/faq.tsx` |

## 5. Customer journey analysis

| Step | Problem | Evidence |
| --- | --- | --- |
| Join | Must create an account to get a referral link; reasonable for paying rewards | Live campaign page |
| Sharing | WhatsApp / X / Telegram / native share / QR — good for India | Code `referral-link-card.tsx` |
| Buying (as the referred shopper) | Lands on the campaign page, then must click again to the brand store. Sees "Offer 10% — Apply at checkout!" with no code (W7) and "codes are passed along as ?ref=" (W9) | Live `/campaigns/healthystan-vedaair-launch` |
| Order claim | Strong idea: 20 seconds, no account. It is the main way a store without integration can attribute | Live |
| Reward status / redemption | Reward → payout request → admin. Same funding question (W1) | Code |

## 6. Campaign marketplace audit

- **Strengths.**
  - Search, three filters and four sorts (newest, highest commission, trending, ending soon) work.
  - Cards show product, price, creator commission, customer reward, end date and creator count.
  - The detail page answers every question on the checklist: what the product is, what the creator earns, what the
    customer gets, requirements, approval, end date and conditions.
- **Gaps.**
  1. **Cards miss "Approval needed" and the shopper offer.** Creators have to open each campaign to learn whether they
     can start immediately.
  2. **"0 creators"** appears on 5 of the 7 live campaigns (Live, 25 Nov). This is negative social proof.
  3. **"Highest commission"** compares a percentage against the list price. That is fine, but the card does not say
     the rupee figure is an estimate.
  4. **Scope and moderation (W6).** Live listings include:
     - a land plot (₹35,36,000, creators earn ₹20,000);
     - a "GTA 6 Reels Bundle", which uses a third-party game trademark;
     - a herbal product page with health-effect wording.

     Campaigns go live without review, and there is no published list of allowed categories.
  5. **Expired / unavailable campaigns.** Handled. Inactive links redirect with `?link=inactive` and ended campaigns
     drop out of the list. But orders that legitimately arrive later cannot be recorded (W2).
  6. **Cold start.** 7 live campaigns. No fake supply should be added; see the recommendations below.

## 7. Trust & payment audit

| Topic | Finding | Status |
| --- | --- | --- |
| Commission funding | If `BRAND_WALLET_ENABLED` is off (the default), verifying an order creates an approved commission that admins pay out, but nothing collects that money from the brand first. Either Refnivo fronts it, or payouts wait on off-platform collection that no screen explains. | ❔ Critical to confirm |
| Copy consistency | FAQ: "The brand … pays them". Creator earnings: "The Refnivo AI team … settles it". Brand payouts: "processed by the platform team". | Live + Code — contradictory |
| Refund handling | Refunding a verified order reverses commissions and rewards, including ones already **PAID** (`conversions.ts` `reverseConversion`). There is no time limit. Paid money is not clawed back; admins only get a list (`payouts.ts:298`). | 🟡 |
| Disputes | No way for a creator or customer to contest a rejection or reversal. | ❌ |
| Order verification | Brand-controlled. Self-referral and duplicate checks only work when a contact is provided. | 🟡 |
| Brand / creator verification | Admin verification exists. Badge visibility on public pages was not audited in depth. | ✅ (partial check) |
| Campaign authenticity | No pre-publish review (W6). | 🟡 |
| Payout conditions | A minimum payout threshold exists and the request flow is clear. | ✅ |
| Claims vs reality | "Every order tied to the partner who sent it" (homepage compare table) and "verified attribution" are true only for orders that are recorded or claimed. | Live — overstated |

## 8. UI / UX audit (no redesign)

| Page / component | User experience | Why it matters | Business effect | Recommendation |
| --- | --- | --- | --- | --- |
| Campaign page "Offer for referred shoppers" | Sees "10% Apply at checkout!" with no code | Shopper cannot claim the offer | Lost conversions and support tickets | Require a coupon code when a shopper offer is set; show it with a copy button |
| Campaign page note "Referral codes are passed along as ?ref=" | Jargon | Confuses shoppers | Lower trust | Replace with: "You'll buy on {brand}'s store. Came back after ordering? Confirm your order below." |
| Marketplace card | Must open each campaign to see approval and offer | Slower discovery | Fewer applications | Add two small existing-style badges: "Approval needed" / "Instant link", and the shopper offer |
| Marketplace card "0 creators" | Looks abandoned | Negative social proof | Fewer applications | Hide when 0, or show "Be one of the first creators" |
| Brand settings | Says billing is unavailable | Contradicts the Billing page | Confusion | Remove "and billing" from the roadmap line |
| Payout copy (FAQ, earnings, brand payouts) | Three different answers | Trust | Disputes | One consistent sentence everywhere, once the funding model is decided (W1) |
| Dashboard KPI grids on phones | 4 full-width cards before any content | Long scroll | Lower engagement on mobile | `grid-cols-2` on phones for KPI rows (same component, no restyle) |
| Creator onboarding bio | One word accepted | Thin public profiles | Brands don't approve | Minimum 40 characters with an example hint; profile-completeness nudge on the dashboard |
| Mobile links page | Card overflowed the screen | — | — | **Fixed** (`components/links/partner-links-list.tsx`, `b4d75f3`) |

**Already good (keep):**

- Clear labels and pricing everywhere.
- Example numbers in mockups are labelled "Example".
- Self-reported numbers are labelled and hidden from anonymous visitors.
- Empty states exist on dashboard lists.
- No page scrolls sideways on a phone. This audit checked 17 public pages live and every creator and brand dashboard
  page locally.

## 9. Technical audit

- **Stack.**
  - Next.js 16 App Router (`proxy.ts`), server actions, Prisma 6 on Supabase Postgres (39 models), Auth.js
    credentials + Google.
  - Supabase storage, Upstash rate limiting, Razorpay, email outbox via cron.
  - Integer paise money, audit logs inside transactions, 428 passing tests (50 files).
- **Bugs.**
  1. **W2 — orders cannot be recorded after a campaign ends or pauses.** `recordOrderInTx` throws when
     `!isCampaignLive(campaign, now)` (`lib/services/conversions.ts:56`). `RecordOrderInput` has no order date. An
     order placed on the last day and recorded the next morning is refused, so the creator loses a legitimate
     commission. The same applies to pausing a campaign and possibly to order claims.
  2. Stale copy in brand settings (W8).
- **Risky logic.**
  - Reversal of PAID commissions with no window and no clawback (W3).
  - Commission funding when the wallet is off (W1).
  - No expiry or SLA for PURCHASED orders and order claims (W5).
- **Security.**
  - Strong: CSP, HSTS (preload), X-Frame-Options DENY, a strict Permissions-Policy, Upstash rate limits on auth,
    claims, contact, uploads and checkout, hashed contacts and IPs, encrypted payout accounts.
  - Gap (W11): `/api/health` is public and returns the storage host and bucket, the enabled social providers, schema
    state and DB pooler warnings. Keep a public `{ ok, db }` and put the details behind an admin session or secret
    header.
- **Moderation.** The `PENDING_REVIEW` campaign status is defined but never used.
- **Measurement.** No product analytics events. Business metrics would have to be reconstructed from database rows.
- **Not verified.** Production environment flags (wallet, payments, payout provider, signup approval) and logged-in
  production behaviour. The code and production can differ only by these flags; the deployed commit equals `main`.

---

## 10. Prioritised roadmap

| Issue | User type | Severity | Evidence | Recommended fix | Priority | Effort |
| --- | --- | --- | --- | --- | --- | --- |
| W1 Commission funding model undefined / copy contradicts | Brand, creator, customer | Critical | Code + Live FAQ | Decide: (a) platform-settled → turn wallet on, so orders cannot be verified unless funded; or (b) brand pays directly → record-and-confirm like UGC. Align all copy | **P0** | S (decision + copy); M if (b) |
| W2 Orders blocked after campaign end / pause | Creator, customer, brand | High (bug) | `conversions.ts:56` | Accept orders whose referral click was inside the attribution window, even if the campaign has since ended or paused; add an order date field | **P0** | M |
| W3 Unlimited reversal of paid commissions; no appeal | Creator | High | `reverseConversion` | Per-campaign hold (e.g. 14–30 days) before commission becomes payable; refunds only during the hold; afterwards admin-only with a reason; creator can contest | **P1** | M–L |
| W4 Attribution overstated | Creator, brand | High (trust) | Live homepage compare table | Reword claims to "orders the brand records or a buyer confirms"; show creators their click → claim → verified funnel; show brand response stats on campaigns (real data only) | **P1** | S (copy) + M |
| W5 No deadline for pending orders / claims | Creator, customer | Medium | No expiry code | Reminders at 3 and 7 days; show "awaiting brand for N days"; admin queue for items older than 14 days | **P1** | M |
| W6 No pre-publish campaign review; off-scope listings live | All | Medium–High | Live `/campaigns` | Publish an allowed-categories policy; route a brand's first campaign (or flagged categories) to `PENDING_REVIEW`; review the current live listings | **P1** | M |
| W7 Shopper offer without a code | Customer | Medium | Live campaign page | Coupon-code field required when an offer is set; show it with copy | **P1** | S |
| W13 No analytics | Business | Medium | `package.json` | Add privacy-friendly event tracking for the funnel events in §13 | **P1** | M |
| W8 Stale "billing not available" | Brand | Low | settings page | Edit one line | **P2** | XS |
| W9 `?ref=` jargon | Customer | Low | Live | Replace copy | **P2** | XS |
| W10 Card badges, "0 creators" | Creator | Low–Medium | Live | Badges + hide zero count | **P2** | S |
| W11 Health endpoint detail | Security | Low | Live `/api/health` | Split public / admin output | **P2** | S |
| W12 Thin creator profiles | Brand, creator | Medium | Live `/creators` | Bio minimum + completeness nudge; hide very incomplete profiles from the directory | **P2** | S–M |
| Instagram connect off | Creator | Medium | Live health | Finish Meta app review / enable provider (operational) | **P2** | Ops |
| W14 Mobile KPI stacking | All | Low | Local | `grid-cols-2` on phones | **P3** | XS |
| Shopify / WooCommerce import | Brand | — | Settings roadmap | Later; the order-claim flow covers stores without it | **P3** | L |

## 11. Implementation plan

### Immediate (this week)

1. **W1 — decide the money model, then align copy.**
   - Files: `components/marketing/home/faq.tsx`, `app/(marketing)/how-it-works/page.tsx`,
     `app/dashboard/creator/earnings/page.tsx`, `app/dashboard/brand/payouts/page.tsx`, `docs/PRODUCTION.md`.
   - Desired behaviour: one sentence describes who pays and when, identical everywhere.
   - If platform-settled: set `BRAND_WALLET_ENABLED=true`. The code already blocks verification when the wallet
     cannot cover it.
   - Acceptance: no page contradicts another; with the wallet on, verifying an order with an empty wallet shows the
     top-up message.
   - Test: search every user-visible string for "pay"; run the wallet integration tests; verify on staging with an
     empty wallet.
2. **W2 — honour the attribution window after a campaign ends or pauses.**
   - Files: `lib/services/conversions.ts` (`recordOrderInTx`), `lib/services/order-claims.ts`, the order form
     (add "Order date", default today, not in the future).
   - Rule: allowed if the campaign is live, **or** the order date is ≤ end date (or ≤ pause time) and within
     `attributionWindowDays` of a recorded click for that link. The budget cap still applies.
   - Acceptance:
     - an order dated inside the campaign is accepted after the campaign ends;
     - an order dated after the end is refused with a clear message;
     - existing tests pass.
   - Test: new integration tests for the ended, paused and future-date cases.
3. **W7, W8, W9 — copy and offer fixes.**
   - Files: campaign detail page and campaign wizard rules step (coupon code), brand settings page, campaign page note.
   - Acceptance: a campaign with an offer cannot be launched without a code, and the code is visible and copyable on
     the public page.

### Short term (2–4 weeks)

4. **W3 — commission hold and appeal.**
   - Schema: `holdDays` on the campaign (default 14) and a `payableAt` date on the commission or reward. Payout
     eligibility filters on `payableAt <= now`.
   - Reversal: allowed until `payableAt`; afterwards admin-only with a reason. Add a "Contest" action for the
     partner that creates an admin task (reuse notifications + audit log).
   - Acceptance: a commission cannot be requested before `payableAt`; a brand cannot reverse a PAID commission; a
     contest notifies admins.
5. **W5 — pending reminders.**
   - Extend the existing cron (`app/api/cron`) to notify brands about PURCHASED orders and claims older than 3 and
     7 days.
   - Partner UI shows "Waiting for the brand · N days".
   - Acceptance: reminders are idempotent (one per threshold).
6. **W6 — moderation.**
   - Set `PENDING_REVIEW` for a brand's first campaign and for listed sensitive categories.
   - Add an admin queue (reuse `moderateCampaign`) and a published content policy page linked from the footer and
     the wizard.
7. **W10, W12, W14 — small UX.** Card badges, hide the zero count, bio minimum, mobile KPI grid.

### Medium term (1–3 months)

8. **W4 — transparency.**
   - Creator "funnel": clicks → buyer claims → recorded → verified, per link.
   - Brand response stats on campaign pages (median verification time, share of claims answered), computed from real
     rows and hidden until there is enough data.
9. **W13 — analytics.** Add an event layer and the funnel events listed in §13.
10. **W11 — health endpoint split.** Instagram provider enablement (operational).

### Future opportunities

- Shopify / WooCommerce order import (removes manual recording).
- Team members for brands.
- Coupon-code attribution (brand pastes its store coupon per creator).

## 12. Acceptance criteria & testing checklist

- [ ] `npm run typecheck && npm run lint && npm test && npm run build` pass.
- [ ] W2: integration tests cover an order dated inside an ended campaign (accepted), after the end (refused), during
      a pause (accepted if the click was before the pause), and in the future (refused).
- [ ] W3: tests cover payout eligibility before and after `payableAt`, refund before the hold ends (allowed), refund
      of PAID (refused for brands), and an audit row for every reversal.
- [ ] W1: a staging run with the wallet on and ₹0 balance refuses verification with the top-up message; the copy diff
      is reviewed.
- [ ] W7: the wizard refuses an offer without a code; the public page shows the code with copy.
- [ ] Mobile: the existing 375 px sweep (no sideways scroll) is repeated on every changed page.
- [ ] No new page shows creators' self-reported numbers to anonymous visitors.
- [ ] Every money change writes its audit log in the same transaction (`lib/services/audit.ts`).

## 13. Success metrics

No current values are stated: none were measured. ✱ marks metrics that need event instrumentation (W13); the rest can
be computed from existing database tables.

| Metric | Definition | Source |
| --- | --- | --- |
| Brand signup completion rate | Brands with a completed profile ÷ brand registrations | DB (users + brands); ✱ for drop-off per step |
| Creator signup completion rate | Creators with a completed profile ÷ creator registrations | DB; ✱ per step |
| Campaign creation completion | Launched ÷ wizard starts | ✱ wizard step events (drafts in DB give a partial view) |
| Creator application rate | Applications ÷ creators who viewed a campaign | DB for applications; ✱ for views |
| Campaign activation rate | Campaigns with ≥ 1 approved partner and ≥ 1 click within 14 days ÷ launched | DB |
| Referral link usage | Links with ≥ 1 counted click in 30 days ÷ issued links | DB (`referral_clicks`) |
| Verified order rate | Verified ÷ (recorded + confirmed claims); also median time to verify | DB |
| Claim response rate | Claims confirmed or rejected within 7 days ÷ claims submitted | DB |
| Retention | Brands active (an order recorded or a partner approved) in month N+1 ÷ month N; same for creators | DB |
| Payment dispute rate | Contests (after W3) ÷ verified orders; reversals after payout ÷ paid commissions | DB (after W3) |
| Plan conversion | Paid brands ÷ brands that hit the free 3-launch limit | DB (payments, plan limits) |
