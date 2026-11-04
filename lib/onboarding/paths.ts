/** Onboarding routes, in order: choose role → (create account) → profile → review. */
export const GET_STARTED_PATH = "/get-started";
export const ONBOARDING_PROFILE_PATH = "/onboarding/profile";
export const ONBOARDING_REVIEW_PATH = "/onboarding/review";

/** Only same-site paths survive as a post-onboarding destination. */
export function safeNext(value: unknown): string | null {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return null;
  if (value.startsWith("/onboarding") || value.startsWith("/get-started") || value.startsWith("/auth")) return null;
  return value.slice(0, 300);
}

export function withNext(path: string, next: string | null | undefined): string {
  return next ? `${path}?next=${encodeURIComponent(next)}` : path;
}
