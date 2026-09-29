import type { Prisma, PrismaClient } from "@prisma/client";

/**
 * Example external affiliate programme listings, inserted through the same
 * AffiliateProgram model brands use — never hard-coded in the UI.
 *
 * Rules for every entry:
 *  - only facts published on the programme's official page or its authorised
 *    affiliate network's page; anything unpublished stays null ("not stated");
 *  - no brand account: these are curated listings (brandId null, brandName set),
 *    shown as "Listed by Refnivo" with a note that the brand has not joined;
 *  - inserted as PENDING_REVIEW and unverified. An admin publishes it from
 *    Admin → Affiliate programs after re-checking the URLs, which is the only
 *    path to APPROVED and to the "Verified by Refnivo" mark.
 *
 * Add more brands by appending entries — nothing here is specific to one brand.
 */
export type ExampleAffiliateProgram = Omit<
  Prisma.AffiliateProgramUncheckedCreateInput,
  "id" | "brandId" | "status" | "verifiedAt" | "reviewedAt" | "reviewedById" | "reviewNote" | "submittedAt" | "createdAt" | "updatedAt"
> & {
  slug: string;
  brandName: string;
  /** Where each stated fact was checked, and when. Kept in code, not shown to users. */
  sources: { checkedOn: string; urls: string[]; notes: string };
};

export const EXAMPLE_AFFILIATE_PROGRAMS: ExampleAffiliateProgram[] = [
  {
    slug: "boat-affiliate-program",
    brandName: "boAt",
    name: "boAt Affiliate Program",
    category: "Electronics",
    description:
      "Promote boAt products through boAt's existing affiliate programme on the Admitad network (India). You join on Admitad; commission rates and programme terms are shown there after you sign in.",
    websiteUrl: "https://www.boat-lifestyle.com",
    programUrl: "https://www.admitad.com/en-in/store/offers/boat-lifestyle-cps-in/",
    signupUrl: "https://www.admitad.com/en-in/store/offers/boat-lifestyle-cps-in/",
    networkName: "Admitad",
    geography: "India",
    // Not published without a publisher login, so deliberately not stated:
    commissionType: null,
    commissionDescription: null,
    cookieDurationDays: null,
    approvalType: null,
    supportedPlatforms: [],
    requirements: null,
    subIdParam: null,
    // boAt's own share image (og:image on boat-lifestyle.com), cropped square; see public/brand-logos/boat.png.
    logoUrl: "/brand-logos/boat.png",
    minFollowers: null,
    sources: {
      checkedOn: "2026-09-28",
      urls: [
        "https://www.admitad.com/en-in/store/offers/boat-lifestyle-cps-in/",
        "https://www.boat-lifestyle.com/pages/refer-and-earn",
        // Logo: the og:image boAt publishes on its homepage (checked 2026-09-29).
        "https://www.boat-lifestyle.com/cdn/shop/files/profile-1_2e1d2124-ba4c-43f0-bb83-0e6ee038ff30.png",
      ],
      notes:
        "Admitad lists an active advertiser programme 'Boat Lifestyle [CPS] IN' (advertiser site www.boat-lifestyle.com, geography PAN India); commission and cookie are shown to logged-in publishers only. boat-lifestyle.com has no affiliate page of its own — its 'Refer & Earn' is a customer reward-points scheme, not an affiliate programme. boAt does not publicly name its networks, so the reviewer should confirm Admitad before publishing.",
    },
  },
  {
    slug: "r-for-rabbit-affiliate-program",
    brandName: "R for Rabbit",
    name: "R for Rabbit Affiliate Program",
    category: "Baby Products",
    description:
      "Promote R for Rabbit's baby products through the brand's own affiliate programme, built for creators who talk to Indian parents. Affiliates get a partner dashboard with real-time tracking, deep links to products and collections, ready-made creatives, and a coupon code for their audience on request. Payouts are monthly.",
    websiteUrl: "https://rforrabbit.com",
    programUrl: "https://rforrabbit.com/pages/affiliate-program/",
    signupUrl: "https://partner.rforrabbit.com/register.html",
    networkName: "Trackier",
    geography: "India",
    commissionType: "PERCENTAGE",
    commissionDescription: "10% flat on every sale",
    cookieDurationDays: 30,
    // The page describes registration but not how applicants are approved.
    approvalType: null,
    supportedPlatforms: ["INSTAGRAM", "YOUTUBE"],
    requirements:
      "Welcomes parenting bloggers, Instagram and YouTube creators, WhatsApp community admins, coupon and deal sites, and comparison or review sites.",
    subIdParam: null,
    // R for Rabbit's own og:image (rforrabbit.com), placed on a square; see public/brand-logos/r-for-rabbit.png.
    logoUrl: "/brand-logos/r-for-rabbit.png",
    minFollowers: null,
    sources: {
      checkedOn: "2026-09-29",
      urls: [
        "https://rforrabbit.com/pages/affiliate-program/",
        "https://partner.rforrabbit.com/register.html",
        "https://rforrabbit.com/cdn/shop/files/R_for_Rabbit_Website_logo_f10cf445-cc8c-42f3-9b3a-4b45261d6236.png",
      ],
      notes:
        "First-party programme page states: flat 10% commission on every sale, 30-day cookie, Trackier-powered partner portal, monthly payouts, audience of Indian parents; lists the creator types above and the partner benefits. 'Join the Program' links to partner.rforrabbit.com/register.html (returns 200). Approval criteria are not stated. Contact: affiliate@rforrabbit.com.",
    },
  },
];

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * Inserts example listings that do not exist yet (matched by slug). Existing
 * rows are left untouched, so admin edits, publishing or removal are never
 * overwritten by re-running the seed.
 */
export async function seedExampleAffiliatePrograms(db: Db): Promise<{ created: string[]; skipped: string[] }> {
  const created: string[] = [];
  const skipped: string[] = [];
  for (const { sources, ...entry } of EXAMPLE_AFFILIATE_PROGRAMS) {
    void sources;
    const exists = await db.affiliateProgram.findUnique({ where: { slug: entry.slug }, select: { id: true } });
    if (exists) {
      skipped.push(entry.slug);
      continue;
    }
    const program = await db.affiliateProgram.create({ data: { ...entry, brandId: null, status: "PENDING_REVIEW", submittedAt: new Date(), verifiedAt: null } });
    await db.auditLog.create({
      data: { userId: null, action: "AFFILIATE_PROGRAM_CREATED", entityType: "AffiliateProgram", entityId: program.id, metadata: { byAdmin: true, curated: true, seed: "example" } },
    });
    created.push(entry.slug);
  }
  return { created, skipped };
}
