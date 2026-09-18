import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import type { Brand, CreatorProfile, User, UserRole } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { securityEvent } from "@/lib/utils/security-log";
import { roleHome } from "./roles";
import { classifySession, signedOutPath, type SessionProblem } from "./session-state";

export class AuthorizationError extends Error {
  constructor(message = "You are not allowed to perform this action.") {
    super(message);
    this.name = "AuthorizationError";
  }
}

export type SessionUser = Pick<User, "id" | "name" | "email" | "role" | "status" | "mustChangePassword">;

export type SessionState = { user: SessionUser; problem: null } | { user: null; problem: SessionProblem };

/**
 * Resolves the request's session against the database. Never throws.
 * Re-checks status AND session version on every request, so a suspension or a
 * password change (which bumps `sessionVersion`) takes effect immediately even
 * though the JWT itself is still within its lifetime.
 *
 * Memoised per request with React `cache()`: a layout and its page (and any
 * server action in the same request) share one `auth()` + one user query
 * instead of repeating them at every level of the tree.
 */
export const getSessionState = cache(async (): Promise<SessionState> => {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return { user: null, problem: "no-session" };
  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, email: true, role: true, status: true, mustChangePassword: true, sessionVersion: true },
  });
  const problem = classifySession({ id, sessionVersion: session?.user?.sessionVersion }, user);
  if (problem === "stale" && user) {
    securityEvent("SESSION_STALE", { userId: user.id, tokenVersion: session?.user?.sessionVersion ?? null, currentVersion: user.sessionVersion });
  }
  if (problem || !user) return { user: null, problem: problem ?? "not-found" };
  return {
    user: { id: user.id, name: user.name, email: user.email, role: user.role, status: user.status, mustChangePassword: user.mustChangePassword },
    problem: null,
  };
});

/** Returns the current user from the DB, or null. Never throws. */
export async function getCurrentUser(): Promise<SessionUser | null> {
  return (await getSessionState()).user;
}

// Per-request memoised lookups shared by layout + page + actions.
const brandForOwner = cache((ownerId: string) => prisma.brand.findFirst({ where: { ownerId }, orderBy: { createdAt: "asc" } }));
const creatorProfileFor = cache((userId: string) => prisma.creatorProfile.findUnique({ where: { userId } }));

// ---------------------------------------------------------------------------
// Page guards — redirect. Use in Server Components / layouts.
// ---------------------------------------------------------------------------

export async function requireUser(): Promise<SessionUser> {
  const state = await getSessionState();
  if (state.user) return state.user;
  // A cookie that no longer maps to a usable account must be CLEARED first —
  // sending it straight to /auth/login would let proxy.ts (which only sees the
  // JWT) bounce it back to the dashboard, and the two redirects would loop.
  if (state.problem !== "no-session") redirect(signedOutPath(state.problem));
  redirect("/auth/login");
}

export async function requireRole(role: UserRole): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== role) redirect(roleHome(user.role));
  return user;
}

/**
 * Brand owners must complete onboarding before using the dashboard.
 * Returns the owner and their brand (v1 supports one brand per owner).
 */
export async function requireBrand(): Promise<{ user: SessionUser; brand: Brand }> {
  const user = await requireRole("BRAND_OWNER");
  const brand = await brandForOwner(user.id);
  if (!brand) redirect("/auth/onboarding");
  return { user, brand };
}

/** Creators must complete their profile before using the dashboard. */
export async function requireCreator(): Promise<{ user: SessionUser; profile: CreatorProfile }> {
  const user = await requireRole("CREATOR");
  const profile = await creatorProfileFor(user.id);
  if (!profile) redirect("/auth/onboarding");
  return { user, profile };
}

// ---------------------------------------------------------------------------
// Action guards — throw. Use in Server Actions / route handlers.
// ---------------------------------------------------------------------------

export async function assertUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new AuthorizationError("Please sign in to continue.");
  return user;
}

export async function assertRole(role: UserRole): Promise<SessionUser> {
  const user = await assertUser();
  if (user.role !== role) throw new AuthorizationError();
  return user;
}

export async function assertBrandOwner(): Promise<{ user: SessionUser; brand: Brand }> {
  const user = await assertRole("BRAND_OWNER");
  const brand = await brandForOwner(user.id);
  if (!brand) throw new AuthorizationError("Create your brand profile first.");
  return { user, brand };
}

/** Creators or customers — anyone who can join a campaign as a partner. */
export async function assertPartner(): Promise<SessionUser> {
  const user = await assertUser();
  if (user.role !== "CREATOR" && user.role !== "CUSTOMER") {
    throw new AuthorizationError("Only creators and customers can join campaigns.");
  }
  return user;
}
