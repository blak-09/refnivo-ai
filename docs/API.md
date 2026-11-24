# Server actions & routes

The app uses Next.js Server Actions (no public JSON API yet). Every action validates input with Zod and re-checks the session and ownership server-side.

## Auth (`app/actions/auth.ts`)

| Action | Input | Result |
| --- | --- | --- |
| `registerAction(prev, formData)` | `name, email, password, confirmPassword, role (BRAND_OWNER/CREATOR/CUSTOMER), phone?, next?` (role comes from `/get-started`; legacy brand/creator detail fields are still accepted) | Creates the user per `SIGNUP_APPROVAL` (`lib/config/signup-policy.ts`): auto-approved roles are created **APPROVED**, signed in immediately and redirected to `/onboarding/profile` (queues the "approved" e-mail); other roles are created **PENDING** (no auto-login), queue the "received" e-mail and redirect to `/registration-pending?rid=…`. Rate-limited. |
| `googleSignInAction(formData)` | `role?` (register page: BRAND_OWNER/CREATOR/CUSTOMER), `callbackUrl?` (login page) | Stores the chosen role in a 10-minute httpOnly cookie and redirects to Google (PKCE, `prompt=select_account`). The Auth.js `signIn` callback (`lib/auth/index.ts`) then resolves the identity via `lib/services/oauth.ts`: linked account → session; same verified e-mail → link + session; new + role → create per `SIGNUP_APPROVAL`; new without role → `/get-started?error=google-no-account`. Non-approved accounts are redirected to `/auth/login?error=google-…` without a session. Rate-limited. |
| `chooseRoleAction(prev, formData)` | `role, next?` | Page 1 for a signed-in account that has not finished onboarding: keeps the role, or changes it while `roleChangeBlockers` (`lib/services/onboarding.ts`) is empty (no profile, links, money or payments yet). Audited (`ONBOARDING_ROLE_CHANGED`); the JWT is refreshed via `unstable_update` (the `jwt` callback re-reads the role from the DB and ignores the payload). Redirects to `/onboarding/profile`. |
| `saveOnboardingProfileAction(prev, formData)` | role profile fields (`lib/validation/onboarding.ts`), `intent=save\|continue`, `next?` | `save`: stores the form as typed in `users.onboardingDraft` (known fields only, bounded). `continue`: validates server-side (creator photo required when uploads are available), stores the draft, redirects to `/onboarding/review`. Nothing is written to profile tables yet. |
| `completeOnboardingAction(prev, formData)` | `next?` | Re-validates the draft and, in one transaction with audit entries, creates/updates the Brand / CreatorProfile / CustomerProfile (+ user name/avatar for customers), sets `onboardingCompletedAt` and clears the draft. Redirects to `next` or the role dashboard (`?welcome=1`). |
| `saveProfileAction(prev, formData)` | role profile fields | Settings → Edit profile for any role after onboarding (photo never required here). |

## UGC collaborations (`app/actions/ugc.ts`, `lib/services/ugc.ts`)

Brands need a plan that includes `ugc` (Starter or Growth) to **publish or reopen** a brief; drafts can be written on any plan. Fees are integer paise and are recorded only: the brand pays the creator directly, marks the fee paid, and the creator confirms. Refnivo never holds UGC money. Every mutation writes `UGC_*` audit rows in the same transaction and sends `UGC_UPDATE` notifications.

| Action | Who | Input | Result |
| --- | --- | --- | --- |
| `saveBriefAction(prev, formData)` | brand | `briefId?`, brief fields (`ugcBriefSchema`: fee in ₹ → paise, content types, usage rights, dates) | Creates a DRAFT or updates a DRAFT/OPEN brief; redirects to `/dashboard/brand/ugc/{id}`. |
| `briefStatusAction({briefId, action})` | brand | `PUBLISH`, `CLOSE`, `REOPEN` or `ARCHIVE` | CLOSE/ARCHIVE decline pending applications; ARCHIVE is blocked while work is in progress. |
| `decideUgcApplicationAction({collabId, decision, note?})` | brand | `ACCEPT` or `DECLINE` | Accept freezes `agreedFee`, locks the brief row (no overfilling); the last slot closes the brief and declines the rest. |
| `cancelUgcCollaborationAction({collabId, note?})` | brand | | Only before delivery (IN_PROGRESS / REVISION_REQUESTED). |
| `reviewUgcSubmissionAction(prev, formData)` | brand | `collabId, decision (APPROVED/REVISION_REQUESTED), feedback` | Up to 3 deliveries (first + 2 revisions); feedback required for changes. |
| `markUgcPaidAction(prev, formData)` | brand | `collabId, reference?` | Only after approval. |
| `applyToBriefAction(prev, formData)` | creator | `briefId, pitch, portfolioLinks` (one per line) | One application per brief (re-apply only after withdrawing). Rate-limited 30/hour. |
| `withdrawUgcApplicationAction(collabId)` | creator | | Only while APPLIED. |
| `submitUgcContentAction(prev, formData)` | creator | `collabId, imageUrls[]` (own uploads via `POST /api/uploads/ugc-image`), `links` (one per line), `note?` | At least one photo or link. |
| `confirmUgcPaymentAction(collabId)` | creator | | After the brand marked the fee paid. |

## Creator partnerships (`app/actions/partnerships.ts`, `lib/services/partnerships.ts`)

A creator is a brand's partner when they have an APPROVED campaign application, an ACCEPTED connection, or an accepted UGC collaboration. Results come from the ledger (clicks, VERIFIED referrals, non-rejected commissions, approved UGC fees); nothing is estimated. Pages: `/dashboard/brand/partners`, `/dashboard/brand/partners/[creatorId]`, `/dashboard/creator/partnerships`.

| Action | Input | Result |
| --- | --- | --- |
| `addPartnerNoteAction(prev, formData)` | `creatorId, body` (2–2000 chars) | Private brand note; partners only; audited. Never shown to the creator. |
| `deletePartnerNoteAction(noteId, creatorId)` | | Deletes a note of the brand; audited. |
