import type { UserRole } from "@prisma/client";

/**
 * Who may sign in right after registering, and who waits for an admin.
 *
 *   SIGNUP_APPROVAL=auto                 every role is approved on signup (default)
 *   SIGNUP_APPROVAL=manual               every role waits for admin review
 *   SIGNUP_APPROVAL=CREATOR,CUSTOMER     listed roles are auto-approved, the rest wait
 *
 * ADMIN is never self-registrable regardless of this setting. Pure: no I/O.
 */
export const REGISTRABLE: readonly UserRole[] = ["BRAND_OWNER", "CREATOR", "CUSTOMER"];

export type SignupPolicy = { autoApprove: ReadonlySet<UserRole> };

export function parseSignupPolicy(raw: string | undefined): { policy: SignupPolicy; error: string | null } {
  const value = (raw ?? "auto").trim();
  if (!value || value.toLowerCase() === "auto") return { policy: { autoApprove: new Set(REGISTRABLE) }, error: null };
  if (value.toLowerCase() === "manual") return { policy: { autoApprove: new Set() }, error: null };
  const roles = value.split(",").map((r) => r.trim().toUpperCase()).filter(Boolean);
  const unknown = roles.filter((r) => !REGISTRABLE.includes(r as UserRole));
  if (unknown.length) {
    return { policy: { autoApprove: new Set(REGISTRABLE) }, error: `SIGNUP_APPROVAL contains unknown role(s): ${unknown.join(", ")}. Use auto, manual, or a comma list of ${REGISTRABLE.join(", ")}.` };
  }
  return { policy: { autoApprove: new Set(roles as UserRole[]) }, error: null };
}

export function signupPolicy(env: NodeJS.ProcessEnv = process.env): SignupPolicy {
  return parseSignupPolicy(env.SIGNUP_APPROVAL).policy;
}

export function isAutoApproved(role: UserRole, env: NodeJS.ProcessEnv = process.env): boolean {
  return role !== "ADMIN" && signupPolicy(env).autoApprove.has(role);
}

/** Roles that still need an admin decision — used for UI copy. */
export function manualReviewRoles(env: NodeJS.ProcessEnv = process.env): UserRole[] {
  const auto = signupPolicy(env).autoApprove;
  return REGISTRABLE.filter((r) => !auto.has(r));
}
