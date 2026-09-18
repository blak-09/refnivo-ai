# Server actions & routes

The app uses Next.js Server Actions (no public JSON API yet). Every action validates input with Zod and re-checks the session and ownership server-side.

## Auth (`app/actions/auth.ts`)

| Action | Input | Result |
| --- | --- | --- |
| `registerAction(prev, formData)` | `name, email, password, confirmPassword, role (BRAND_OWNER/CREATOR/CUSTOMER), phone?` + role-specific fields (brand: `brandName, brandWebsite?, brandCategory, brandDescription?`; creator: `creatorName, creatorCategory, instagramHandle?, instagramFollowers?, youtubeChannel?, youtubeSubscribers?`) | Creates the user per `SIGNUP_APPROVAL` (`lib/config/signup-policy.ts`): auto-approved roles are created **APPROVED**, signed in immediately and redirected to their dashboard (queues the "approved" e-mail); other roles are created **PENDING** (no auto-login), queue the "received" e-mail and redirect to `/registration-pending?rid=…`. Rate-limited. |
| `googleSignInAction(formData)` | `role?` (register page: BRAND_OWNER/CREATOR/CUSTOMER), `callbackUrl?` (login page) | Stores the chosen role in a 10-minute httpOnly cookie and redirects to Google (PKCE, `prompt=select_account`). The Auth.js `signIn` callback (`lib/auth/index.ts`) then resolves the identity via `lib/services/oauth.ts`: linked account → session; same verified e-mail → link + session; new + role → create per `SIGNUP_APPROVAL`; new without role → `/auth/register?error=google-no-account`. Non-approved accounts are redirected to `/auth/login?error=google-…` without a session. Rate-limited. |
| `loginAction(prev, formData)` | `email, password, callbackUrl?` | Verifies the password, then gates on status: no account, PENDING, REJECTED (with reason), SUSPENDED each return a distinct message; APPROVED signs in and redirects by role. Rate-limited. |
| `logoutAction()` | — | Signs out → `/` |

## Password reset (`app/actions/password-reset.ts`)

| Action | Input | Result |
| --- | --- | --- |
| `forgotPasswordAction(prev, formData)` | `email` | Neutral response whether or not the account exists; queues a one-hour single-use reset link (hashed token) when `EMAIL_PROVIDER` is configured; rate-limited per IP and per e-mail. |
| `resetPasswordAction(prev, formData)` | `token, password, confirmPassword` | Consumes the token, sets the password, bumps `sessionVersion` (all sessions signed out) → `/auth/login?reason=password-changed`. |

Only **APPROVED** users can sign in (enforced in `authorize()` and `getCurrentUser()`).

### Admin verification (`app/actions/admin.ts`) — ADMIN only

| Action | Input | Notes |
| --- | --- | --- |
| `approveUserAction(prev, formData)` | `userId` | Sets status APPROVED (records `approvedAt`/`approvedById`); in-app notification + e-mail. Cannot approve self. |
| `rejectUserAction(prev, formData)` | `userId, reason` | Sets status REJECTED with reason (shown to the applicant); in-app notification + e-mail. Cannot reject self. |
| `suspendUserAction({ userId, reason })` | | APPROVED → SUSPENDED, sessions revoked; self and last active admin refused |
| `reactivateUserAction({ userId })` | | SUSPENDED → APPROVED |
| `verificationAction({ target, id, decision, note? })` | `target ∈ BRAND, CREATOR`; `decision ∈ VERIFIED, REJECTED, UNVERIFIED` | Public verified badge; owner notified |
| `moderateCampaignAction({ campaignId, action, reason })` | `action ∈ PAUSE, END, ARCHIVE` | Same lifecycle rules as brands; owner notified |
| `payoutReviewAction({ payoutId, action, reference?, note? })` | `action ∈ UNDER_REVIEW, APPROVE, MARK_PAID, FAIL, REJECT` | `MARK_PAID` needs an external reference and is the only path to commission `PAID` / reward `REDEEMED`; `REJECT` releases the ledger rows |

All admin actions require `role = ADMIN`, validate with Zod, write an audit row with the admin as actor and notify the affected user.

### Registration status (`app/actions/registrations.ts`)

| Action | Input | Notes |
| --- | --- | --- |
| `checkRegistrationAction(prev, formData)` | `registrationId?` **or** `email?` | Public status lookup → Name, Role, Registration date, Status, admin message. Rate-limited. |

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
| `decideApplicationAction({ applicationId, decision })` | `decision ∈ APPROVED, REJECTED` | Brand side; approval creates the partner's referral link; partner notified |
| `removePartnerAction({ applicationId, reason? })` | | Brand side; APPROVED → REMOVED, referral link DISABLED |
| `withdrawApplicationAction({ applicationId })` | | Partner side; PENDING → WITHDRAWN (can re-apply) |
| `joinCampaignAction({ campaignId, message? })` | | Creator/customer side; returns `{ status, code }` — customers and no-approval campaigns get a code instantly |
| `saveCreatorProfileAction(prev, formData)` | | Creates/updates the creator profile (username unique) |

## Orders & conversions (`app/actions/conversions.ts`)

| Action | Input | Notes |
| --- | --- | --- |
| `recordOrderAction(prev, formData)` | `code, orderReference, amount (₹), quantity, source, customerContact?, note?` | Creates PURCHASED referral + conversion + PENDING commission/reward |
| `conversionDecisionAction({ referralId, decision, reason? })` | `decision ∈ VERIFY, REJECT` | VERIFY → VERIFIED + APPROVED/AVAILABLE ledger (budget-checked, campaign row lock); REJECT → REJECTED |
| `conversionReversalAction({ referralId, reason })` | VERIFIED only | Refund: referral REFUNDED, commissions/rewards REVERSED, budget freed; partner notified |

## Payouts & notifications (`app/actions/payouts.ts`, `app/actions/notifications.ts`)

| Action | Notes |
| --- | --- |
| `requestPayoutAction({ kind, method })` | `kind ∈ COMMISSION (creators), REWARD (customers)`; `method ∈ UPI, Bank transfer, Brand voucher`. Bundles every eligible ledger row into a REQUESTED payout once the balance reaches `PAYOUT_MINIMUM_AMOUNT`; admins notified. Nothing is paid here. |
| `markNotificationReadAction({ id })` / `markAllNotificationsReadAction()` | Owner-scoped |
| `setEmailNotificationsAction(enabled)` | Per-user e-mail opt-out (security e-mails ignore it) |

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
/auth/login /auth/register /auth/forgot-password /auth/reset-password?token=… /auth/onboarding
/registration-pending?rid=…         post-signup status page (opaque Registration ID)
/check-registration                 public status lookup (Registration ID or email)
/admin/registrations                → /dashboard/admin/registrations (ADMIN)
/dashboard                 → role home
/dashboard/brand           overview · products[/new|/[id]] · campaigns[/new|/[id]|/[id]/edit] · creators?status&type · orders?status · payouts · analytics · profile · notifications · settings
/dashboard/creator         overview · campaigns · links · conversions · earnings · profile · notifications · settings
/dashboard/customer        overview · referrals · rewards · notifications · settings
/dashboard/admin           overview · registrations · users?q&role&status · verification · campaigns · conversions · payouts?status · audit?action&entityType&userId · health · notifications · settings

/api/health                        GET → 200 {ok,db,latencyMs} · 503 {status:"database-down"} · 503 {status:"misconfigured", errors:[rule names]}
/api/uploads/product-image         POST (brand owner) multipart `file` → {url}; JPEG/PNG/WebP ≤ 5 MB, magic-byte checked, rate-limited
/api/exports/campaigns/[id]        GET (brand owner, own campaign) → CSV of partners + orders, audited, rate-limited
```
