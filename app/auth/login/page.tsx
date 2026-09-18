import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/auth-card";
import { LoginForm } from "@/components/auth/login-form";
import { prisma } from "@/lib/db/prisma";
import { googleOAuthEnabled } from "@/lib/config/oauth";
import { showDemoLogins } from "@/lib/utils/demo";
import { QUICK_DEMO_ACCOUNTS } from "@/lib/utils/demo-accounts";

export const metadata: Metadata = { title: "Log in" };

/** Only offer quick sign-in buttons for demo accounts that actually exist in this database. */
async function getQuickAccounts() {
  if (!showDemoLogins()) return [];
  try {
    const existing = await prisma.user.findMany({
      where: { email: { in: QUICK_DEMO_ACCOUNTS.map((a) => a.email) }, status: "APPROVED" },
      select: { email: true },
    });
    const emails = new Set(existing.map((u) => u.email));
    return QUICK_DEMO_ACCOUNTS.filter((a) => emails.has(a.email)).map((a) => ({ ...a }));
  } catch {
    return [];
  }
}

/**
 * Messages for `?error=` codes. Our own Google outcomes come from
 * lib/auth/index.ts (OAUTH_ERROR); the PascalCase ones are Auth.js's.
 * Anything unknown gets a generic line — never the raw code.
 */
const ERROR_MESSAGES: Record<string, string> = {
  "google-no-account": "No account found for that Google e-mail. Please sign up first.",
  "google-pending": "Your registration is still under review. Please wait for approval.",
  "google-rejected": "Your registration was not approved. Check your registration status for details.",
  "google-suspended": "Your account has been suspended. Please contact support.",
  "google-email-unverified": "Google could not verify that e-mail address, so we did not sign you in. Verify it in your Google account or use your password.",
  "google-unavailable": "Google sign-in is temporarily unavailable. Please try again in a moment or use your password.",
  "rate-limited": "Too many attempts. Please try again in a few minutes.",
  AccessDenied: "Sign-in was refused. Please try again or use your password.",
  OAuthCallbackError: "Google sign-in was cancelled or did not complete. Please try again.",
  OAuthSignInError: "Could not start Google sign-in. Please try again.",
  OAuthAccountNotLinked: "That e-mail is already registered with a different sign-in method. Log in with your password instead.",
  // Auth.js also reports expired/missing sign-in cookies under this code, so keep it actionable.
  Configuration: "Sign-in did not complete — the request may have expired. Please try again; contact support if it keeps happening.",
  CallbackRouteError: "Sign-in did not complete. Please try again.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string; registered?: string; reason?: string; ref?: string }>;
}) {
  const { callbackUrl, error, registered, reason, ref } = await searchParams;
  const safeCallback = callbackUrl && callbackUrl.startsWith("/") && !callbackUrl.startsWith("//") ? callbackUrl : undefined;
  const notice = registered
    ? "Your account was created. Log in to continue."
    : reason === "password-changed"
      ? "Your password was changed and all sessions were signed out. Log in with your new password."
      : undefined;
  const reference = ref && /^[A-Za-z0-9_]{1,40}$/.test(ref) ? ref : undefined;
  const errorMessage = error ? `${ERROR_MESSAGES[error] ?? "Please log in to continue."}${reference ? ` (reference: ${reference})` : ""}` : undefined;
  const quickAccounts = await getQuickAccounts();

  return (
    <div className="w-full pt-10">
      <div className="mx-auto w-full max-w-md">
        <AuthCard title="Welcome back" description="Log in to your Refnivo AI account.">
          <LoginForm callbackUrl={safeCallback} notice={notice} error={errorMessage} quickAccounts={quickAccounts} googleEnabled={googleOAuthEnabled()} />
        </AuthCard>
        {!quickAccounts.length ? (
          <p className="mt-4 text-center text-xs text-muted-foreground">
            Demo accounts are listed in the README after running <code className="font-mono">npm run db:seed</code>.
          </p>
        ) : null}
      </div>
    </div>
  );
}
