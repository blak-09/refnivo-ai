import type { RegistrableRole } from "@/lib/validation/auth";

/** Copy for the role cards on /get-started (from the onboarding brief) and the signup summary. */
export const ROLE_CARDS: Record<
  RegistrableRole,
  { short: string; title: string; description: string; features: readonly string[]; cta: string }
> = {
  BRAND_OWNER: {
    short: "Brand",
    title: "I'm a Brand",
    description: "Grow your business through creator partnerships and referral campaigns.",
    features: ["Launch affiliate & referral campaigns", "Work with creators", "Pay commission only on verified orders", "Track clicks and sales"],
    cta: "Continue as Brand",
  },
  CREATOR: {
    short: "Creator",
    title: "I'm a Creator",
    description: "Discover brands, join campaigns, and earn through referrals.",
    features: ["Browse brand campaigns", "Get your own referral links", "Earn commission on verified orders", "Apply for paid UGC briefs"],
    cta: "Continue as Creator",
  },
  CUSTOMER: {
    short: "Customer",
    title: "I'm a Customer",
    description: "Discover products and earn rewards by sharing them.",
    features: ["Explore products from brands", "Share a personal link with friends", "Earn rewards on verified orders", "No followers needed"],
    cta: "Continue as Customer",
  },
};

export const ROLE_ORDER: readonly RegistrableRole[] = ["BRAND_OWNER", "CREATOR", "CUSTOMER"];
