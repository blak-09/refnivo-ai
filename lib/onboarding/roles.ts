import type { RegistrableRole } from "@/lib/validation/auth";

/** Copy for the role cards on /get-started (from the onboarding brief) and the signup summary. */
export const ROLE_CARDS: Record<
  RegistrableRole,
  { short: string; title: string; description: string; features: readonly string[]; cta: string }
> = {
  BRAND_OWNER: {
    short: "Brand",
    title: "I'm a Brand",
    description: "Grow your brand through creator partnerships, referral campaigns and customer engagement.",
    features: ["Discover creators", "Launch campaigns", "Promote your products", "Track campaign performance"],
    cta: "Continue as Brand",
  },
  CREATOR: {
    short: "Creator",
    title: "I'm a Creator",
    description: "Discover brands, collaborate on campaigns and grow your creator journey.",
    features: ["Discover brand opportunities", "Collaborate with brands", "Share referral links", "Earn through eligible campaigns"],
    cta: "Continue as Creator",
  },
  CUSTOMER: {
    short: "Customer",
    title: "I'm a Customer",
    description: "Discover exciting brands, explore products and participate in referral campaigns.",
    features: ["Discover brands", "Explore products", "Participate in campaigns", "Access available rewards"],
    cta: "Continue as Customer",
  },
};

export const ROLE_ORDER: readonly RegistrableRole[] = ["BRAND_OWNER", "CREATOR", "CUSTOMER"];
