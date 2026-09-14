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

### R3 — Tracking & money ✅ (payout requests 🔜)
- ✅ `/r/[code]` records click (link vs QR), anonymous visitor id, hashed IP, referral session; last-click attribution cookie sized to the campaign window; redirect with `?ref=`
- ✅ Campaign page marks session VISITED; purchase link carries `?ref=CODE`
- ✅ Brand records orders (code, order ref, value, quantity, source, hashed customer contact) → pending commission/reward
- ✅ Verify / reject orders → APPROVED / AVAILABLE or REJECTED; budget enforcement
- ✅ Guards: paused/expired campaigns, minimum order value, duplicate order reference, self-referral, duplicate customer on new-customer-only campaigns
- ✅ Commission & reward ledger views (brand, creator, customer)
- 🔜 Payout request flow (threshold shown; request/approve arrives with Admin)
- 🔜 Customer reward redemption

### R4 — Admin & AI ⬜
- ⬜ Admin: users, brands, creators (verification), campaigns, orders, payouts, audit logs
- ⬜ AI campaign generator (product + goal → title, description, commission, reward, rules — labelled suggestions)
- ⬜ AI creator matching (rule-based + explanation)
- ⬜ AI content assistant (Instagram captions, reel ideas, YouTube descriptions, WhatsApp messages)
- ⬜ AI campaign insights (LLM phrasing over real metrics)

### Quality (current build)
- [x] TypeScript passes
- [x] Lint passes
- [x] Unit + integration tests pass (54)
- [x] Production build passes
- [x] Mobile layout works
- [ ] Playwright e2e
