import NextAuth, { type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db/prisma";
import { loginSchema } from "@/lib/validation/auth";
import { authSecretAtBoot } from "@/lib/config/env";
import { googleOAuthConfig } from "@/lib/config/oauth";
import { notifyRegistration } from "@/lib/services/notifications";
import { GOOGLE_PROVIDER, resolveGoogleSignIn, userForGoogleAccount, type GoogleIdentity } from "@/lib/services/oauth";
import { securityEvent } from "@/lib/utils/security-log";
import { describeError, logServerError } from "@/lib/utils/server-log";
import { authConfig } from "./config";
import { consumeOAuthRoleCookie } from "./oauth-role-cookie";
import { tokenSessionVersion } from "./session-version";

/** Google sign-in outcomes that end on the login/register page instead of a session (see `OAUTH_MESSAGES`). */
export const OAUTH_ERROR = {
  noAccount: "google-no-account",
  pending: "google-pending",
  rejected: "google-rejected",
  suspended: "google-suspended",
  emailUnverified: "google-email-unverified",
  unavailable: "google-unavailable",
} as const;

function googleIdentity(profile: Record<string, unknown> | undefined, providerAccountId: string): GoogleIdentity | null {
  const email = typeof profile?.email === "string" ? profile.email : null;
  if (!email) return null;
  return {
    providerAccountId,
    email,
    emailVerified: profile?.email_verified === true,
    name: typeof profile?.name === "string" ? profile.name : null,
    picture: typeof profile?.picture === "string" ? profile.picture : null,
  };
}

const google = googleOAuthConfig();

const callbacks: NextAuthConfig["callbacks"] = {
  ...authConfig.callbacks,

  /**
   * Google: map the identity to a local account (link / create) and gate on
   * status. Returning a string redirects there WITHOUT creating a session.
   * Credentials: already authorised in `authorize`.
   */
  async signIn({ account, profile }) {
    if (account?.provider !== GOOGLE_PROVIDER) return true;
    const identity = googleIdentity(profile as Record<string, unknown> | undefined, account.providerAccountId);
    if (!identity) return `/auth/login?error=${OAUTH_ERROR.emailUnverified}`;

    let resolution;
    try {
      const requestedRole = await consumeOAuthRoleCookie();
      resolution = await resolveGoogleSignIn(identity, requestedRole);
    } catch (err) {
      logServerError("oauth.google", err);
      // A short, secret-free reference (Prisma code such as P2021, or the error
      // class name) so the failure can be diagnosed from the page alone.
      const summary = describeError(err);
      const ref = String(summary.code ?? summary.name ?? "").replace(/[^A-Za-z0-9_]/g, "").slice(0, 40);
      return `/auth/login?error=${OAUTH_ERROR.unavailable}${ref ? `&ref=${ref}` : ""}`;
    }

    switch (resolution.kind) {
      case "ok":
        if (resolution.isNew) {
          await notifyRegistration("approved", { id: resolution.user.id, name: resolution.user.name, email: resolution.user.email, role: resolution.user.role, registrationId: resolution.user.registrationId });
        }
        return true;
      case "pending":
        await notifyRegistration("received", { id: resolution.user.id, name: resolution.user.name, email: resolution.user.email, role: resolution.user.role, registrationId: resolution.user.registrationId });
        return `/registration-pending?rid=${encodeURIComponent(resolution.user.registrationId ?? "")}`;
      case "no-account":
        return `/auth/register?error=${OAUTH_ERROR.noAccount}`;
      case "email-unverified":
        securityEvent("LOGIN_FAILED", { reason: "OAUTH_EMAIL_UNVERIFIED", provider: GOOGLE_PROVIDER, email: identity.email });
        return `/auth/login?error=${OAUTH_ERROR.emailUnverified}`;
      case "blocked":
        securityEvent("LOGIN_FAILED", { reason: resolution.status, provider: GOOGLE_PROVIDER, email: identity.email });
        if (resolution.status === "PENDING") return `/auth/login?error=${OAUTH_ERROR.pending}`;
        if (resolution.status === "REJECTED") return `/auth/login?error=${OAUTH_ERROR.rejected}`;
        return `/auth/login?error=${OAUTH_ERROR.suspended}`;
    }
  },

  /**
   * For Google sign-ins the `user` handed to us is Google's profile, so the
   * claims are taken from the local account that `signIn` just resolved.
   */
  async jwt(params) {
    const { token, account } = params;
    if (account?.provider === GOOGLE_PROVIDER) {
      const local = await userForGoogleAccount(account.providerAccountId);
      if (!local || local.status !== "APPROVED") return null;
      token.id = local.id;
      token.role = local.role;
      token.status = local.status;
      token.name = local.name;
      token.email = local.email;
      token.sv = tokenSessionVersion(local.sessionVersion);
      token.mcp = local.mustChangePassword;
      return token;
    }
    return authConfig.callbacks.jwt(params);
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  // Fail at boot (not on first request) if the secret is missing — except during `next build`.
  secret: authSecretAtBoot(),
  callbacks,
  providers: [
    Credentials({
      name: "Email and password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(raw) {
        const parsed = loginSchema.safeParse(raw);
        if (!parsed.success) return null;

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email },
        });
        // Google-only accounts have no password to compare.
        if (!user || !user.passwordHash) return null;

        const ok = await bcrypt.compare(parsed.data.password, user.passwordHash);
        if (!ok) return null;
        if (user.status !== "APPROVED") return null;

        // Best-effort: never block a login on this bookkeeping write.
        prisma.user.updateMany({ where: { id: user.id }, data: { lastLoginAt: new Date() } }).catch(() => {});

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          status: user.status,
          sessionVersion: user.sessionVersion,
          mustChangePassword: user.mustChangePassword,
        };
      },
    }),
    // Registered only when both GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are set.
    ...(google
      ? [
          Google({
            clientId: google.clientId,
            clientSecret: google.clientSecret,
            // Always let the user pick the Google account; never store provider tokens.
            authorization: { params: { prompt: "select_account", scope: "openid email profile" } },
          }),
        ]
      : []),
  ],
});
