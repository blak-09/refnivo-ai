# Build progress

Legend: ✅ done · 🔜 next · ⬜ pending

## Repositioning (restaurant → brand / product affiliate platform)

### R1 — Brand platform core ✅
- ✅ Schema: `Brand` (industry, socials, verification), `Product`, `Campaign.productId` + `requiresApproval`, extended `CreatorProfile` (per-platform metrics, audience, samples), `ReferralClick.source` (LINK/QR), `Conversion.brandId`/quantity
- ✅ Roles: `BRAND_OWNER`; `/dashboard/brand/**`; guards `requireBrand` / `requireCreator` / `assertPartner`
- ✅ Brand onboarding + public brand profile editing
- ✅ Product management (add / edit / archive, SKU uniqueness, status)
- ✅ Campaign wizard tied to a product (details, commission %, customer reward, rules & budget, approval toggle, duration, preview, publish)
- ✅ Creator applications review with social handles, followers, subscribers, avg views, engagement (self-reported), audience, samples; approve / reject / view profile
- ✅ Brand analytics: campaigns, products, creators, customers, clicks, QR scans, orders, conversions, revenue, commissions, rewards, conversion rate, top creators, best products, campaign breakdown
- ✅ All restaurant copy replaced (landing, header/footer, pricing, about, legal, dashboards)

### R2 — Marketplace & partners ✅
- ✅ Discover Campaigns with filters (product type, brand category, campaign type, search) and sorts (new, highest commission, trending, ending soon); cards with brand logo, product image/name/price, commission, reward, duration, creator count
- ✅ Campaign page: brand, product, price, purchase link, commission, reward, terms, join/apply, referral link + QR + share
- ✅ Discover Products, Product details, Discover Brands, Brand profile, Creator profile, How it works
- ✅ Creator onboarding + profile editor (Instagram/YouTube/X handles & counts, audience, previous campaigns, content samples)
- ✅ Join flow: customers join instantly; creators apply (or join instantly when approval is off); human-readable codes `HANDLE-BRAND-XXXX`
- ✅ Creator dashboard: overview KPIs, my campaigns, links & QR (copy / download / WhatsApp / X / Telegram / native share), conversions, earnings
- ✅ Customer dashboard (simpler, no creator metrics): links, clicks, purchases, rewards

### R3 — Tracking & money ✅
- ✅ `/r/[code]` records click (link vs QR), anonymous visitor id, hashed IP, referral session; duplicate hits from the same visitor within 30 s are not counted; per-IP click throttle; last-click attribution cookie sized to the campaign window; redirect with `?ref=`
- ✅ Campaign page marks session VISITED; purchase link carries `?ref=CODE`
- ✅ Order handshake (real click→order attribution without a store plugin): customer confirms their order number on the campaign page (code pre-filled from the link / last-click cookie, evidence recorded) → brand confirms with the order value = recorded + verified atomically, or rejects with a reason; claims listed on Orders with a "to confirm" KPI; signed-in customers see their claims on their dashboard
- ✅ Brand records orders by hand (code, order ref, value, quantity, source, hashed customer contact) → pending commission/reward
- ✅ Verify / reject orders → APPROVED / AVAILABLE or REJECTED; budget enforcement under a campaign row lock
- ✅ Refunds: brand reverses a verified order → REFUNDED, ledger entries REVERSED, budget freed
- ✅ Guards: paused/expired campaigns, minimum order value, duplicate order reference, self-referral, duplicate customer on new-customer-only campaigns
- ✅ Commission & reward ledger views (brand, creator, customer); campaign CSV export
- ✅ Manual payout / redemption workflow: partner requests → admin reviews → settles off-platform → marks paid with reference (only path to PAID / REDEEMED)
- ✅ Partner lifecycle: creators withdraw pending applications; brands remove approved partners (link disabled)

### R4 — Admin, notifications & security ✅ (AI ⬜)
- ✅ Admin: registrations, users (suspend / reactivate with session revocation), brand & creator verification, campaign moderation, conversions oversight, payouts, audit log viewer, system health
- ✅ Database-backed notifications for every role (unread badge, mark read / all), per-user e-mail opt-out, e-mail abstraction (console / Resend)
- ✅ Password reset by e-mail (hashed single-use tokens, session revocation), forced password rotation for the bootstrap admin, session versioning
- ✅ Production hardening: start-up env validation, guarded DB scripts, admin bootstrap, distributed rate limiting (Upstash), magic-byte upload validation, redacting security logs, CI workflow
- ⬜ AI campaign generator / creator matching / content assistant / insights (not started; `AI_*` env reserved)
- ⬜ E-mail verification at signup (accounts are admin-approved instead)
- ⬜ Store webhooks (Shopify / WooCommerce) — orders stay manual

### Quality (current build)
- [x] TypeScript passes
- [x] Lint passes (zero warnings)
- [x] Unit + integration tests pass (see `npm test` output; CI enforces)
- [x] Production build passes
- [x] Mobile layout works
- [ ] Playwright e2e
