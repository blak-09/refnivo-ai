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
    logoUrl: null,
    minFollowers: null,
    sources: {
      checkedOn: "2026-09-28",
      urls: ["https://www.admitad.com/en-in/store/offers/boat-lifestyle-cps-in/", "https://www.boat-lifestyle.com/pages/refer-and-earn"],
      notes:
        "Admitad lists an active advertiser programme 'Boat Lifestyle [CPS] IN' (advertiser site www.boat-lifestyle.com, geography PAN India); commission and cookie are shown to logged-in publishers only. boat-lifestyle.com has no affiliate page of its own — its 'Refer & Earn' is a customer reward-points scheme, not an affiliate programme. boAt does not publicly name its networks, so the reviewer should confirm Admitad before publishing.",
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
