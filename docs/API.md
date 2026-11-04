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
