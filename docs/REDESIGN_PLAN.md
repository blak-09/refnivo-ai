# Refnivo — UI/UX redesign audit & phased plan (25 Nov 2026)

Status: plan approved 25 Nov 2026.

- **Phase 1 (design system): done, pushed 25 Nov 2026.**
  - 326 raw colour classes moved to tokens; the 16 left are homepage illustrations (Phase 2) and social-platform brand colours.
  - New tokens: `success-strong`, `warning-strong`, `brand-from`, `brand-to`.
  - One shared campaign card for the marketplace and Discover.
  - Error boundaries offer retry, a safe page and support.
  - Six unused marketing components removed.
  - Shared filter bar moved to Phase 5, together with the filter redesign.
- **Phase 2 (navigation & homepage): done, pushed 25 Nov 2026.** Decisions: new hero headline; 4-item header; tabbed products; 4 KPIs (Phase 4).
  - Header: For Brands, For Creators, Explore Campaigns, Pricing. Other pages are under "More" in the mobile menu and in the footer (Creator directory added there).
  - Homepage goes from 11 sections to 9, in this order: hero, problem, how it works, products (tabs), creators & customers, live campaigns + trust, pricing, FAQ, CTA. The community band sits above the footer.
  - The comparison table and the separate product-card row are gone; the three deep-dives are now tabs, and `/#affiliate`, `/#ugc`, `/#partners` open the matching tab.
  - Live campaigns use the shared CampaignCard.
  - FAQ adds brand and creator sign-up answers.
  - **U3 deferred:** real dashboard screenshots need a demo account with realistic data; the local demo brand shows zeros, and inventing figures is not allowed. The labelled "Example" cards stay.
- **Phase 3 (onboarding): done, pushed 25 Nov 2026.**
  - Profile forms show the essentials first. Everything optional sits in a "More details (optional)" group (`MoreDetails` in `components/onboarding/form-kit.tsx`).
  - The group is collapsed during onboarding and open in Edit profile. It opens by itself when one of its fields has a value or an error.
  - Fields visible during onboarding: brand 19 → 10, creator 28 → 8, customer 12 → 7.
  - Server-side required fields are unchanged. Fields inside the closed group are still submitted and saved.
  - Role cards use the brief's copy, and their feature lists describe what each role can actually do.
  - The e2e onboarding spec now opens "More details" before filling City.
  - The first-run next action moves to Phase 4 (dashboard getting-started checklist).
- **Phase 4 (dashboards): done, pushed 25 Nov 2026.**
  - **Sidebars are grouped** (`components/dashboard/nav.ts`). No page was removed: brand still has 17 entries and creator 15.
    - Brand: Grow · Results · Money · Account.
    - Creator: Find work · My work · Results · Account.
    - Customer: Share & earn · Account.
    - "Creators" is renamed "Find creators".
  - **Brand overview:**
    - A "Get started" checklist (Add a product → Create a campaign → Get your first partner) until all three are done.
    - A "Needs your attention" list. It covers wallet shortfall, orders to verify, buyer claims, applications, UGC to review or pay, creator connection requests and campaigns in review. Each item links to the page that handles it.
    - 4 KPIs: Live campaigns, Link clicks, Verified conversions, Pending commissions.
    - Revenue, conversion rate, partners, ROI and the charts are on Analytics. **Exception:** Analytics is a Growth feature, so on other plans these numbers stay on the overview under "Performance". Nothing is lost on any plan.
    - Charts are hidden while there are no clicks or orders.
  - **Creator overview:**
    - Earnings strip: Pending, Approved, Paid out, Verified conversions.
    - Recommended live campaigns not yet joined, the creator's categories first. They come first on the page until the creator joins a campaign.
    - Clicks, rate and sales are on Analytics (QR scans and all-time sales were added there).
  - **Customer overview:**
    - Rewards KPI shows available, pending and redeemed.
    - New "Products you can share" row (live customer campaigns not yet joined, preferred categories first).
  - **New read-only service:** `lib/services/dashboard.ts`, with tests in `tests/integration/dashboard.test.ts`.
  - **Customer overview was not opened in the browser:** the customer demo login does not work in the local database. It was checked by typecheck and tests.
- **Phase 5 (campaign experience): done, pushed 26 Nov 2026.**
  - **One campaign browser** (`components/campaigns/campaign-browser.tsx` + `campaign-filter-bar.tsx`) for `/campaigns` and creator Discover.
    - Search, plus filters: product type, brand category, who can join, instant or approval, creator commission type, has a shopper offer.
    - Sort chips: newest, highest commission, trending, ending soon.
    - Live count, "Load more" (24 at a time), and empty states that offer "Clear filters".
    - It is a plain GET form, so every view is a shareable URL and works without JavaScript.
    - On phones the filters open in a bottom sheet behind a "Filters" button with a count badge, so campaigns start on the first screen.
    - Filter parsing lives in `lib/campaigns/filters.ts`. Unknown values are ignored.
  - **Removed** (replaced by the shared filters, per C1): the old directory view's A–Z and category sorts and its broad category chips (`campaign-directory.tsx`, `lib/services/directory.ts`).
  - **Campaign wizard: 6 steps → 4** (`lib/campaigns/wizard-steps.ts`):
    1. Product & basics.
    2. Commission & reward.
    3. Rules, budget & duration.
    4. Review & launch.
    - Fields and server validation are unchanged.
    - The review step has Edit buttons that jump to the matching step.
    - Focus moves to the new step's heading on every step change.
    - A unit test checks that every server field belongs to a step.
  - **Campaign page:**
    - An "At a glance" summary under the price: what you earn, what the shopper gets, how to qualify.
    - An application status banner at the top for creators who applied (pending, approved, rejected, removed, withdrawn).
- **Phase 6 (responsive & accessibility): done, pushed 26 Nov 2026.**
  - **Tables on phones:** `Table` has an opt-in `stackOnMobile` mode (`components/ui/table.tsx` + `app/globals.css`).
    - Below 640 px each row becomes a card of "column: value" pairs, labelled from the table's own headers. Desktop is unchanged.
    - On for 15 brand, creator and customer tables (orders, claims, partners, payouts, wallet, billing, analytics, conversions, payout history, channels).
    - Admin tables still scroll sideways. Tracking already had its own phone layout.
  - **Focus:** every link and control without its own focus ring now shows a 2 px ring-colour outline on keyboard focus (it was a faint 1 px outline).
  - **Skip link:** "Skip to main content" on every page, plus a `<main id="main-content">` landmark. Marketing pages and the 404 page had no `<main>` before.
  - **Colour-only and missing text alternatives:**
    - Each chart has a screen-reader summary.
    - The UGC "needs action" dot is now announced.
    - The duplicate product-image link in campaign cards is out of the Tab order.
  - **Skeletons:** campaign page and campaign wizard now have their own loading layouts. Every loading screen says "Loading…" to screen readers.
  - **Image upload:**
    - The field label now points at the upload button, and errors are linked to it.
    - A failed save moves focus to the upload button.
    - Upload progress and success are announced.
    - Saving while an image is still uploading is held, with a message (it used to report the image as missing).
    - The hidden file input is out of the Tab order.
  - **Copy:** logged-out visitors on approval-only campaigns see "Log in to apply" or "Log in to join or apply" (was "Join campaign & get your link").
  - **Checked:**
    - No horizontal scroll on 22 public, creator and brand pages at 375 px, and 11 at 768 px.
    - Keyboard-only walk-through: home → Explore campaigns → campaign → sign up → onboarding → apply. The apply dialog keeps focus inside.
  - **E2E suite repaired, 16/16 green** (it had been failing since Phase 3 and the 06faa7c audit fixes):
    - The onboarding helpers use the Phase 3 labels ("Business category", "Short brand description") and open "More details" for customer interests.
    - Uploads target the file inputs by id.
    - The e2e server runs with `CAMPAIGN_REVIEW=off`, so the golden path publishes straight to live. First-campaign review stays covered by integration tests.
    - The golden-path campaign uses a 0-day refund window, so the payout steps can run the same day.
  - **Known:** after a client-side page change, the first Tab goes to the page's header, not the skip link (Next.js keeps the focus start point). The skip link works on every full page load.

Scope inspected:

- the live site (https://www.refnivo.com, public pages, desktop 1280 px and phone 375 px);
- the repository at `06faa7c`;
- the brand and creator dashboards on `localhost` with the seeded demo accounts.

Not inspected live:

- The customer and admin dashboards could not be opened locally because the demo passwords in the local database do not match the seed. They were reviewed from code.
- Production dashboards need real accounts, so they were not opened.

---

## 1. What exists today (technical inventory)

| Area | Finding |
| --- | --- |
| Framework | Next.js 16 App Router, React Server Components, Server Actions, Tailwind v4, shadcn-style primitives on Base UI. 94 pages. |
| Routes | **Marketing:** `/`, `/brands`, `/creators`, `/campaigns`, `/campaigns/[slug]`, `/products`, `/pricing`, `/how-it-works`, `/community`, `/about`, `/team`, `/contact`, policies.<br>**Onboarding:** `/get-started` → `/auth/register` → `/onboarding/profile` → `/onboarding/review`.<br>**Auth:** `/auth/*`.<br>**Dashboards:** `/dashboard/{brand,creator,customer,admin}/*`. |
| Auth | Auth.js (credentials + Google), JWT sessions, `proxy.ts` route guard, `lib/auth/guards.ts` (`require*` / `assert*`). Roles: `BRAND_OWNER`, `CREATOR`, `CUSTOMER`, `ADMIN`. |
| Data | Prisma + Postgres (Supabase). Core models: User, Brand, Product, Campaign, PartnerApplication, ReferralLink, ReferralClick, Referral, Conversion, OrderClaim, Commission, Reward, BrandWallet, PayoutRequest, UgcBrief/Collaboration, Connection, Notification, AuditLog. |
| Design tokens | `app/globals.css`: oklch tokens for background, foreground, card, primary (indigo-violet 278°), secondary, muted, accent, border, success, warning, destructive, sidebar, ink. Radius scale. Dark-mode tokens defined (no toggle). Font: Geist Sans / Mono. Type utilities `text-display`, `text-headline`. |
| Components | **UI:** `components/ui` (button, card, badge, dialog, sheet, input, select, table, skeleton…).<br>**Dashboard:** `components/dashboard/primitives.tsx` (PageHeader, KpiCard, EmptyState, StatusBadge).<br>**Domain:** folders per area (campaigns, marketplace, links, orders, onboarding…). |
| States | **Loading:** `loading.tsx` for each dashboard role and the marketplace; root splash.<br>**Error:** one `app/dashboard/error.tsx`, plus `not-found.tsx`.<br>**Empty:** `EmptyState` is used widely. |

**Conclusion:** Refnivo is already a modern token-based SaaS UI. Every core journey exists and is tested (445 tests). The highest value is to **refine and simplify** the existing screens, not to rebuild them. A from-scratch visual redesign would put working, tested flows at risk and gain little.

---

## 2. UI/UX audit — problems found

Each row gives the page, what the user experiences, why it matters, and the fix.

### Navigation & homepage

| # | Where | What the user experiences | Why it matters | Recommended fix |
| --- | --- | --- | --- | --- |
| U1 | Header (`components/marketing/site-header.tsx`) | Top nav: Products ▾, For Brands, For Creators, Pricing, Community, Resources ▾. **Explore Campaigns, the core marketplace, is hidden inside "Resources".** "For Brands / For Creators" jump to anchors on the homepage. | Creators, the supply side, can't find campaigns from the header. Six items plus two dropdowns is busy. | Nav becomes: For Brands, For Creators, Explore Campaigns, Pricing (+ Log in / Get Started). Products, Community, How it works, directories and Contact move to the footer and the mobile menu. |
| U2 | Homepage (`app/(marketing)/page.tsx`, 11 sections) | Very long. Hero → marquee → 3 products → 3 deep dives → comparison → creators → how it works → trust → community → live campaigns → pricing → FAQ → CTA. | Value is clear in the hero but then repeats. Visitors scroll past several mockups before reaching "how it works" or real campaigns. | Tighten to about 8 sections, in this order: Hero → How it works (3 steps) → Product (the three products as tabs, not three full sections) → For creators & customers → Live campaigns (real data) → Trust → Pricing → FAQ + CTA. Fold the comparison table into the product section and move the community band to the footer area. |
| U3 | Homepage visuals | All product visuals are hand-built mockups labelled "Example". | Honest, but they are not the real product. | Use real screenshots of the dashboard taken from the seeded demo account, captioned "Example data". Never present them as real results. |
| U4 | Brand name | Logo shows "Refnivo" with an "AI" pill, but no feature is AI-driven (insights are computed rules). | A small expectation gap. | Keep the logo (brand identity). Flagged as a decision for you only; no change planned. |

### Onboarding

| # | Where | Experience | Why | Fix |
| --- | --- | --- | --- | --- |
| U5 | `/onboarding/profile` (`components/onboarding/*-fields.tsx`) | Brand form shows **19 fields**, creator form **28 fields**. The required set is small (brand: name, business email, contact, description, industry; creator: name, username, bio, category, photo). | A long first form causes drop-off before users reach the dashboard. | Show only the required and high-value fields first, matching the brief's list. Put everything else under a collapsed **"More details (optional)"** group, also editable later in Profile. Same schema and same data, so no backend change. |
| U6 | Role cards (`/get-started`) | Good already: icon, title, description, bullets, selection state, Continue. | — | Copy aligned to the brief; no structural change. |
| U7 | After onboarding | The dashboard opens with a profile-completion card and a grid of zero KPIs. | The "next action" competes with empty numbers. | See D1–D3. |

### Dashboards

| # | Where | Experience | Why | Fix |
| --- | --- | --- | --- | --- |
| D1 | Brand overview (`app/dashboard/brand/page.tsx`) | 8 KPI cards, insight card, 3 charts, top creators, recent campaigns. For a new brand these are **all zero or empty**. There is no "needs your attention" block, so orders to verify, applications and buyer claims live on other pages. | Brands miss the actions that keep creators active, such as orders waiting for a decision. | Add a **"Needs your attention"** strip at the top: orders to verify, applications waiting, buyer claims, campaigns in review, all linked. Show 4 primary KPIs (Live campaigns, Link clicks, Verified conversions, Pending commissions) and move the rest to Analytics. With no campaigns, show a 3-step getting-started checklist (Add product → Create campaign → Approve creators) instead of empty charts. |
| D2 | Creator overview | 8 zero KPIs come before the "You haven't joined any campaigns" empty state. No recommended campaigns. | The main next step, finding a campaign, sits below the fold. | Earnings strip (Pending / Approved / Paid, using existing data and labels) + **recommended campaigns** matched to the creator's category (existing marketplace query) + My campaigns. Secondary KPIs go to Analytics. |
| D3 | Customer overview | 4 KPIs + My links + claims. No product suggestions. | A customer with no links has nothing to do. | Add a **"Products you can share"** row (live campaigns that accept customers, using the existing query) + Rewards summary (available / pending / redeemed). |
| D4 | Sidebars (`components/dashboard/nav.ts`) | Brand: 17 items. Creator: 15. Several sound alike: Applications / Partners / Connections, Tracking / Analytics / Orders. | Users don't know where things live. | Group into clear sections, for example: **Grow** (Campaigns, Applications, Partners, UGC) · **Results** (Orders & conversions, Analytics, Tracking) · **Money** (Wallet, Payouts, Billing) · **Account**. Tighten labels. No pages removed; all routes stay. |

### Campaign experience

| # | Where | Experience | Why | Fix |
| --- | --- | --- | --- | --- |
| C1 | Discovery: two UIs | Public `/campaigns` (`marketplace/campaign-card.tsx`) and creator `/dashboard/creator/discover` (`campaigns/campaign-directory-card.tsx`) use **different cards and filters** for the same data. | The same campaign looks different depending on where you see it, and fixes must be made twice. | One shared campaign card and one filter bar, used in both places. |
| C2 | `/campaigns` on phone | The filter form (search + 3 selects + button) fills the **entire first screen**. No campaign is visible without scrolling. | Mobile visitors bounce before seeing a campaign. | On phones: search field + a **"Filters"** button that opens a sheet. Sort chips scroll horizontally. Cards start in the first screen. |
| C3 | Filters | Product type, category, campaign type, sort. | Missing filters the data already supports. | Add **Approval** (instant link / approval needed), **Commission type** (percent / fixed) and **Shopper offer** (has coupon). Skip filters without real backing (e.g. "eligibility" beyond approval). |
| C4 | Campaign wizard (`components/campaigns/campaign-wizard.tsx`) | **7 steps:** Product, Details, Commission & reward, Rules & budget, Duration, Preview, Launch. | Preview and Launch are separate steps, and Duration is a step of its own. | **4 steps, same fields and same schemas:** (1) Product & basics, (2) Commission & reward, (3) Rules, budget & duration, (4) Review & launch, where each section has an "Edit" link back to its step. |
| C5 | Campaign detail (`/campaigns/[slug]`) | Already shows commission, reward, coupon, window, hold, approval, terms and the join/apply CTA. | Order of information. | Put a compact **"What you earn / what the shopper gets / how to qualify"** summary right under the title. Make the application status after applying (pending / approved / rejected) a visible banner. |

### Design system & states

| # | Where | Experience | Why | Fix |
| --- | --- | --- | --- | --- |
| S1 | 48 files use **~400 raw Tailwind colour classes** (`text-indigo-*`, `bg-emerald-*`, `text-amber-*`…), mostly in marketing, community and settings. | Shades of success, warning and brand drift between pages. | Inconsistent look; dark mode would break. | Map them to tokens (`primary`, `success`, `warning`, `destructive`, plus a new `info` token if needed) and add `success-foreground` / `warning-foreground` surfaces. **The visible palette does not change**, it is just consistent. |
| S2 | Gradients: ~80 gradient usages, including the brand gradient on CTAs. | Gradient is brand identity on the logo and primary CTA. Elsewhere it is decoration. | — | Keep the brand gradient for the logo, primary CTA and hero accent only. Use flat surfaces elsewhere. |
| S3 | Status | `StatusBadge` already pairs a label with colour. | Good. | Audit remaining colour-only indicators (dots, coloured numbers) and add a text or icon. |
| S4 | Error page (`app/dashboard/error.tsx`) | Generic "Something went wrong" + Try again. | No way out. | Add "Go to dashboard" and "Contact support" links. Marketing pages get the same error boundary. |
| S5 | Loading | Dashboard skeletons exist. The root splash shows only a logo. | Fine. | Keep. Add skeletons for the campaign detail and wizard. |

---

## 3. Design system (to formalise in Phase 1, no new look)

- **Colour:** keep the current tokens.
  - Primary: indigo-violet `oklch(0.55 0.22 278)`.
  - Neutral scale from foreground / muted / border.
  - Semantic: success, warning, destructive (+ optional info).
  - Brand gradient reserved for the logo, primary CTA and hero accent.
- **Type:** Geist.
  - Display (hero) → Headline (section) → Title (`text-lg` / `text-xl` page title) → Body `text-sm` / `text-base` → Label `text-xs` uppercase eyebrow.
  - One page title per screen (`PageHeader`).
- **Spacing:** 4-px scale. Section rhythm on marketing pages `py-16 sm:py-24`. Dashboard `space-y-6`, card padding `p-4 sm:p-6`.
- **Components:** Button (primary / secondary / ghost / destructive, sizes sm / md / lg), Input / Select / Textarea with label + hint + error, Card, Table → stacked cards on phones, StatusBadge, EmptyState, KpiCard, PageHeader, the shared CampaignCard, FilterBar.
- **Documentation:** a short `docs/DESIGN_SYSTEM.md` listing tokens and components.

---

## 4. Phased implementation plan

Each phase ends with:

- `npm run typecheck && npm run lint && npm test && npm run build`;
- a browser check on desktop and 375 px (no horizontal scroll, keyboard focus visible);
- screenshots for you to review before the next phase.

**Nothing is pushed until you say "push".**

| Phase | Work | Files (main) | Acceptance criteria | Effort |
| --- | --- | --- | --- | --- |
| **1. Design system** | Token cleanup (S1, S2), semantic surfaces, shared CampaignCard + FilterBar extracted (C1), error boundary links (S4), `DESIGN_SYSTEM.md`. | `app/globals.css`, `components/dashboard/primitives.tsx`, `components/marketplace/*`, `components/campaigns/campaign-directory-card.tsx`, `app/dashboard/error.tsx` | No raw palette classes outside illustrations. Both discovery pages render the same card. Visual palette unchanged in screenshots. | M |
| **2. Navigation & homepage** | New header nav (U1), mobile menu order, homepage tightened to about 8 sections (U2), real "Example data" screenshots (U3), brief-aligned copy and FAQ. | `site-header.tsx`, `mobile-nav.tsx`, `site-footer.tsx`, `app/(marketing)/page.tsx`, `components/marketing/home/*` | Explore Campaigns is in the top nav. Every page from the old nav is still reachable (footer / menu). No fake metrics or testimonials. Lighthouse accessibility ≥ 95. | M |
| **3. Onboarding** | Essentials-first profile forms with a collapsed optional group (U5), role-card copy (U6), first-run next action. | `components/onboarding/*`, `(onboarding)/*` | Required fields unchanged server-side. A new brand, creator or customer completes onboarding in one short screen. Existing onboarding tests pass. | S–M |
| **4. Dashboards** | Brand "Needs your attention" + 4 KPIs + getting-started checklist (D1). Creator earnings + recommended campaigns (D2). Customer shareable products + rewards (D3). Grouped sidebars (D4). | `app/dashboard/{brand,creator,customer}/page.tsx`, `components/dashboard/nav.ts`, small read-only service queries | All numbers come from existing services. Empty accounts see one clear next action. Every old page is still in the sidebar. | M–L |
| **5. Campaign experience** | Mobile filter sheet + new filters (C2, C3), 4-step wizard (C4), campaign-detail summary + status banner (C5). | `app/(marketing)/campaigns/*`, `components/campaigns/campaign-wizard.tsx`, `components/marketplace/join-campaign.tsx`, `lib/services/campaigns.ts` (filter params) | First campaign card visible on a 375 px screen without scrolling. The wizard creates identical campaign rows (existing tests + one new test). Apply status visible after applying. | M–L |
| **6. Responsive & a11y pass** | Tables → cards on phones where needed, focus states, colour-only indicators (S3), skeletons (S5). | Across the redesigned pages | 375 / 768 / 1280 px screenshots of every redesigned page. Keyboard-only walk-through of signup → campaign → join. | S–M |
| **7. Testing & report** | Full regression and the final deliverables list (problems, improvements, pages, components, preserved functionality, open issues, screenshots, test results). | — | All checks green. Report delivered. | S |

**Not planned** (would need your approval):

- new authentication;
- backend or schema changes beyond read-only queries and filter params;
- removing any page or feature;
- changing the logo, brand colours or name;
- dark-mode toggle;
- fake screenshots, metrics or testimonials.

---

## 5. Decisions needed before Phase 2

1. **Hero headline.**
   - Keep "Grow with creators. Pay only for results.", or
   - switch to the brief's "Turn Your Customers & Creators Into Your Sales Team." (today that line is a section heading lower on the page).
2. **Top navigation.** Move Products, Community and Resources out of the header into the footer and the mobile menu (recommended)?
3. **Homepage length.** OK to merge the three product deep-dives into one tabbed section and drop the standalone comparison table?
4. **Dashboard KPIs.** OK to show 4 KPIs on the overviews and move the others to Analytics (nothing removed, only moved)?
