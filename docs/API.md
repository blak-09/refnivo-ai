# Server actions & routes

The app uses Next.js Server Actions (no public JSON API yet). Every action validates input with Zod and re-checks the session and ownership server-side.

## Auth (`app/actions/auth.ts`)

| Action | Input | Result |
| --- | --- | --- |
| `registerAction(prev, formData)` | `name, email, password, role (BRAND_OWNER/CREATOR/CUSTOMER), phone?` | Creates user, signs in, redirects (brand owners and creators → `/auth/onboarding`) |
| `loginAction(prev, formData)` | `email, password, callbackUrl?` | Signs in and redirects; `Invalid email or password.` on failure |
| `logoutAction()` | — | Signs out → `/` |

Route handler: `GET/POST /api/auth/[...nextauth]` (Auth.js).

## Brand (`app/actions/brand.ts`)

| Action | Notes |
| --- | --- |
| `createBrandAction(prev, formData)` | Brand owner only; one brand per owner; redirects to `/dashboard/brand?welcome=1` |
| `updateBrandAction(prev, formData)` | Owner of that brand only |

## Products (`app/actions/products.ts`)

| Action | Notes |
| --- | --- |
| `saveProductAction(productId \| null, prev, formData)` | Create or update; price in rupees → paise; SKU unique per brand |
| `archiveProductAction(productId)` | Blocked while the product has live campaigns |

## Campaigns (`app/actions/campaigns.ts`)

| Action | Input | Notes |
| --- | --- | --- |
| `saveCampaignAction(input, campaignId?)` | Wizard payload incl. `productId`, `requiresApproval` (form units: rupees/percent) | Creates a DRAFT or updates; product locked after publish; returns `{ id, status }` |
| `campaignStatusAction({ campaignId, action, confirmed? })` | `action ∈ PUBLISH, PAUSE, RESUME, END, ARCHIVE` | PUBLISH requires `confirmed: true` and passing pre-flight validation |
| `deleteDraftCampaignAction(campaignId)` | | DRAFT only |

## Partners (`app/actions/partners.ts`, `app/actions/creator.ts`)

| Action | Input | Notes |
| --- | --- | --- |
| `decideApplicationAction({ applicationId, decision })` | `decision ∈ APPROVED, REJECTED` | Brand side; approval creates the partner's referral link |
| `joinCampaignAction({ campaignId, message? })` | | Creator/customer side; returns `{ status, code }` — customers and no-approval campaigns get a code instantly |
| `saveCreatorProfileAction(prev, formData)` | | Creates/updates the creator profile (username unique) |

## Orders & conversions (`app/actions/conversions.ts`)

| Action | Input | Notes |
| --- | --- | --- |
| `recordOrderAction(prev, formData)` | `code, orderReference, amount (₹), quantity, source, customerContact?, note?` | Creates PURCHASED referral + conversion + PENDING commission/reward |
| `conversionDecisionAction({ referralId, decision, reason? })` | `decision ∈ VERIFY, REJECT` | VERIFY → VERIFIED + APPROVED/AVAILABLE ledger (budget-checked); REJECT → REJECTED |

## Account (`app/actions/account.ts`)

| Action | Notes |
| --- | --- |
| `updateAccountAction(prev, formData)` | name, phone |
| `changePasswordAction(prev, formData)` | requires current password |

## Routes

```
/                          landing         /how-it-works /pricing /about /contact /privacy /terms
/campaigns?q&category&industry&type&sort   marketplace (sort: newest | commission | trending | ending)
/campaigns/[slug]?ref=CODE                 campaign page (join, link + QR, purchase link with ?ref)
/products /products/[slug] /brands /brands/[slug] /creators/[username]
/r/[code]?src=qr           GET → records click, sets attribution cookies, 302 → /campaigns/[slug]?ref=CODE
/auth/login /auth/register /auth/onboarding
/dashboard                 → role home
/dashboard/brand           overview · products[/new|/[id]] · campaigns[/new|/[id]|/[id]/edit] · creators?status&type · orders?status · payouts · analytics · profile · settings
/dashboard/creator         overview · campaigns · links · conversions · earnings · profile · settings
/dashboard/customer        overview · referrals · rewards · settings
/dashboard/admin           overview · settings
```
