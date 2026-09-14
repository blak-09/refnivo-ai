import "server-only";
import { redirect } from "next/navigation";
import type { Brand, CreatorProfile, User, UserRole } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { roleHome } from "./roles";

export class AuthorizationError extends Error {
  constructor(message = "You are not allowed to perform this action.") {
    super(message);
    this.name = "AuthorizationError";
  }
}

export type SessionUser = Pick<User, "id" | "name" | "email" | "role" | "status">;

/** Returns the current user from the DB, or null. Never throws. */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return null;
  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, email: true, role: true, status: true },
  });
  if (!user || user.status === "SUSPENDED") return null;
  return user;
}

// ---------------------------------------------------------------------------
// Page guards — redirect. Use in Server Components / layouts.
// ---------------------------------------------------------------------------

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login");
  return user;
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
  const brand = await prisma.brand.findFirst({ where: { ownerId: user.id }, orderBy: { createdAt: "asc" } });
  if (!brand) redirect("/auth/onboarding");
  return { user, brand };
}

/** Creators must complete their profile before using the dashboard. */
export async function requireCreator(): Promise<{ user: SessionUser; profile: CreatorProfile }> {
  const user = await requireRole("CREATOR");
  const profile = await prisma.creatorProfile.findUnique({ where: { userId: user.id } });
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
  const brand = await prisma.brand.findFirst({ where: { ownerId: user.id }, orderBy: { createdAt: "asc" } });
  if (!brand) throw new AuthorizationError("Create your brand profile first.");
  return { user, brand };
}

export async function assertCreator(): Promise<{ user: SessionUser; profile: CreatorProfile }> {
  const user = await assertRole("CREATOR");
  const profile = await prisma.creatorProfile.findUnique({ where: { userId: user.id } });
  if (!profile) throw new AuthorizationError("Complete your creator profile first.");
  return { user, profile };
}

/** Creators or customers — anyone who can join a campaign as a partner. */
export async function assertPartner(): Promise<SessionUser> {
  const user = await assertUser();
  if (user.role !== "CREATOR" && user.role !== "CUSTOMER") {
    throw new AuthorizationError("Only creators and customers can join campaigns.");
  }
  return user;
}
