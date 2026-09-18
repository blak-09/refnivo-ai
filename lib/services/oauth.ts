import { Prisma, type UserRole, type UserStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { isAutoApproved } from "@/lib/config/signup-policy";
import { REGISTRABLE_ROLES, type RegistrableRole } from "@/lib/validation/auth";
import { generateRegistrationId } from "@/lib/utils/registration-id";
import { recordAudit } from "./audit";

export const GOOGLE_PROVIDER = "google";

export type GoogleIdentity = {
  /** Google's stable subject id (`sub`). */
  providerAccountId: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
  picture: string | null;
};

export type OAuthUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  sessionVersion: number;
  mustChangePassword: boolean;
  registrationId: string | null;
  rejectionReason: string | null;
};

export type OAuthResolution =
  /** Signed in (existing account) or a brand-new auto-approved account. */
  | { kind: "ok"; user: OAuthUser; isNew: boolean; linked: boolean }
  /** A new account was created but must wait for admin review (SIGNUP_APPROVAL). */
  | { kind: "pending"; user: OAuthUser; isNew: true }
  /** No account for this Google identity and no role was chosen — send to the register page. */
  | { kind: "no-account" }
  /** Google did not vouch for the e-mail; refuse to link it to an existing account. */
  | { kind: "email-unverified" }
  /** The account exists but cannot sign in. */
  | { kind: "blocked"; status: Exclude<UserStatus, "APPROVED">; user: OAuthUser };

const USER_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  status: true,
  sessionVersion: true,
  mustChangePassword: true,
  registrationId: true,
  rejectionReason: true,
} satisfies Prisma.UserSelect;

export function isRegistrableRole(value: unknown): value is RegistrableRole {
  return typeof value === "string" && (REGISTRABLE_ROLES as readonly string[]).includes(value);
}

function gate(user: OAuthUser, extra: { isNew: boolean; linked: boolean }): OAuthResolution {
  if (user.status === "APPROVED") return { kind: "ok", user, ...extra };
  return { kind: "blocked", status: user.status, user };
}

/**
 * Maps a Google identity to a local account.
 *
 *  1. A linked `oauth_accounts` row wins (stable even if the Google e-mail changes).
 *  2. Otherwise an existing user with the same e-mail is linked — only when Google
 *     reports the address as verified, so nobody can take over an account by
 *     registering an unverified address at Google.
 *  3. Otherwise a new user is created with the role the visitor chose on the
 *     register page (`requestedRole`). Without a role there is nothing sensible to
 *     create, so the caller sends the visitor to the register page instead.
 *
 * Status gating mirrors the password flow: only APPROVED accounts sign in.
 * Never stores provider tokens; never overwrites an existing name or avatar.
 */
export async function resolveGoogleSignIn(
  identity: GoogleIdentity,
  requestedRole: RegistrableRole | null,
  now = new Date(),
): Promise<OAuthResolution> {
  const email = identity.email.trim().toLowerCase();

  // 1) Already linked.
  const linked = await prisma.oAuthAccount.findUnique({
    where: { provider_providerAccountId: { provider: GOOGLE_PROVIDER, providerAccountId: identity.providerAccountId } },
    select: { user: { select: USER_SELECT } },
  });
  if (linked) {
    touchLogin(linked.user.id);
    return gate(linked.user, { isNew: false, linked: false });
  }

  // 2) Same e-mail → link, but only on a verified address.
  const existing = await prisma.user.findUnique({ where: { email }, select: USER_SELECT });
  if (existing) {
    if (!identity.emailVerified) return { kind: "email-unverified" };
    await prisma.$transaction(async (tx) => {
      await tx.oAuthAccount.create({
        data: { userId: existing.id, provider: GOOGLE_PROVIDER, providerAccountId: identity.providerAccountId, email },
      });
      await recordAudit(
        {
          userId: existing.id,
          actorRole: existing.role,
          action: "OAUTH_ACCOUNT_LINKED",
          entityType: "User",
          entityId: existing.id,
          metadata: { provider: GOOGLE_PROVIDER },
        },
        tx,
      );
    });
    touchLogin(existing.id);
    return gate(existing, { isNew: false, linked: true });
  }

  // 3) New account — needs a role.
  if (!requestedRole) return { kind: "no-account" };
  if (!identity.emailVerified) return { kind: "email-unverified" };

  const autoApproved = isAutoApproved(requestedRole);
  const name = (identity.name ?? "").trim().slice(0, 80) || email.split("@")[0];

  for (let attempt = 0; attempt < 5; attempt++) {
    const registrationId = generateRegistrationId();
    try {
      const user = await prisma.$transaction(async (tx) => {
        const created = await tx.user.create({
          data: {
            name,
            email,
            passwordHash: null,
            role: requestedRole,
            avatarUrl: identity.picture?.startsWith("https://") ? identity.picture.slice(0, 500) : null,
            status: autoApproved ? "APPROVED" : "PENDING",
            approvedAt: autoApproved ? now : null,
            registrationId,
            registrationDetails: { signupMethod: GOOGLE_PROVIDER },
            lastLoginAt: autoApproved ? now : null,
            oauthAccounts: { create: { provider: GOOGLE_PROVIDER, providerAccountId: identity.providerAccountId, email } },
          },
          select: USER_SELECT,
        });
        await recordAudit(
          {
            userId: created.id,
            action: "USER_REGISTERED",
            entityType: "User",
            entityId: created.id,
            metadata: { role: created.role, registrationId, autoApproved, provider: GOOGLE_PROVIDER },
          },
          tx,
        );
        return created;
      });
      return autoApproved ? { kind: "ok", user, isNew: true, linked: false } : { kind: "pending", user, isNew: true };
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        const target = err.meta?.target;
        const fields = Array.isArray(target) ? target.join(",") : String(target ?? "");
        if (fields.includes("registrationId")) continue; // regenerate and retry
        if (fields.includes("email") || fields.includes("providerAccountId")) {
          // Lost a race with a concurrent signup for the same identity — resolve again without creating.
          return resolveGoogleSignIn(identity, null, now);
        }
      }
      throw err;
    }
  }
  throw new Error("Could not allocate a registration id. Please try again.");
}

/** Looks up the local user behind a linked Google account (used when minting the session JWT). */
export async function userForGoogleAccount(providerAccountId: string): Promise<OAuthUser | null> {
  const row = await prisma.oAuthAccount.findUnique({
    where: { provider_providerAccountId: { provider: GOOGLE_PROVIDER, providerAccountId } },
    select: { user: { select: USER_SELECT } },
  });
  return row?.user ?? null;
}

// Best-effort bookkeeping — never blocks a sign-in.
function touchLogin(userId: string) {
  prisma.user.updateMany({ where: { id: userId }, data: { lastLoginAt: new Date() } }).catch(() => {});
}
