/**
 * Refnivo Network — the creator & brand community.
 *
 * Joining happens in WhatsApp. Both circles currently share ONE invite; when a
 * separate group exists for a circle, set its own link here and every CTA for
 * that circle follows.
 */
export const COMMUNITY_INVITE_URL = "https://chat.whatsapp.com/JQ81NKeg6LpHWpvn7sawAe";

export const COMMUNITY_AUDIENCES = ["CREATOR", "BRAND", "GENERAL"] as const;
export type CommunityAudience = (typeof COMMUNITY_AUDIENCES)[number];

export const COMMUNITY_INVITES: Record<CommunityAudience, string> = {
  CREATOR: COMMUNITY_INVITE_URL,
  BRAND: COMMUNITY_INVITE_URL,
  GENERAL: COMMUNITY_INVITE_URL,
};

/** Analytics event names. Every click also counts as `community_join_click`. */
export const COMMUNITY_EVENTS: Record<CommunityAudience, string> = {
  CREATOR: "creator_community_join_click",
  BRAND: "brand_community_join_click",
  GENERAL: "community_join_click",
};
export const COMMUNITY_ALL_EVENT = "community_join_click";

/** Where a CTA sits — recorded with each click so you can see which placement works. */
export const COMMUNITY_PLACEMENTS = [
  "community-page",
  "community-page-band",
  "home-band",
  "home-creators",
  "home-brands",
  "campaigns",
  "affiliate-programs",
  "brands",
  "creators",
  "how-it-works",
  "creator-dashboard",
  "brand-dashboard",
] as const;
export type CommunityPlacement = (typeof COMMUNITY_PLACEMENTS)[number];

export const CREATOR_CIRCLE = {
  id: "creator-circle",
  eyebrow: "For Creators",
  title: "Creator Circle",
  description: "A space for creators to connect, collaborate, discover brand opportunities, share knowledge and grow together.",
  benefits: [
    "Discover brand opportunities",
    "Connect with other creators",
    "Find collaboration opportunities",
    "Learn and share creator strategies",
    "Get campaign and partnership updates",
  ],
  cta: "Join Creator Community",
  callout: {
    label: "Join Creator Circle",
    body: "Connect with creators, discover opportunities and stay updated on Refnivo campaigns.",
  },
} as const;

export const BRAND_CIRCLE = {
  id: "brand-circle",
  eyebrow: "For Brands",
  title: "Brand Circle",
  description: "A space for brands to connect with creators, discover partnership opportunities, share insights and build meaningful collaborations.",
  benefits: [
    "Discover relevant creators",
    "Find partnership opportunities",
    "Share campaigns",
    "Connect with the creator ecosystem",
    "Get creator marketing insights",
  ],
  cta: "Join Brand Community",
  callout: {
    label: "Join Brand Circle",
    body: "Connect with creators, discover partnership opportunities and grow with the Refnivo network.",
  },
} as const;
