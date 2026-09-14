/**
 * LocalGrowth AI — demo seed.
 *
 * Everything created here is DEMO DATA. Demo accounts use the
 * `@localgrowth.demo` domain so the UI can label them. Brands and products are
 * fictional stand-ins (e.g. "Soundwave" instead of a real audio brand).
 * Re-running the seed removes and recreates all demo records.
 *
 *   npm run db:seed
 *
 * All demo accounts share the password: Demo@1234
 */
import "dotenv/config";
import { PrismaClient, type PartnerType } from "@prisma/client";
import bcrypt from "bcryptjs";
import { subDays } from "date-fns";

const prisma = new PrismaClient();

export const DEMO_DOMAIN = "localgrowth.demo";
export const DEMO_PASSWORD = "Demo@1234";

const daysAgo = (n: number, hour = 12) => {
  const d = subDays(new Date(), n);
  d.setHours(hour, 0, 0, 0);
  return d;
};

async function main() {
  console.log("Seeding demo data…");
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  // Remove previous demo data (cascades through brands, products, campaigns, ledgers).
  await prisma.user.deleteMany({ where: { email: { endsWith: `@${DEMO_DOMAIN}` } } });

  // ------------------------------------------------------------------ users
  const admin = await prisma.user.create({
    data: { name: "Platform Admin", email: `admin@${DEMO_DOMAIN}`, passwordHash, role: "ADMIN", status: "APPROVED" },
  });

  const owners = await Promise.all(
    [
      { name: "Rohan Mehta", email: `owner.soundwave@${DEMO_DOMAIN}` },
      { name: "Priya Nair", email: `owner.glowlab@${DEMO_DOMAIN}` },
      { name: "Arjun Kapoor", email: `owner.fitfuel@${DEMO_DOMAIN}` },
    ].map((o) => prisma.user.create({ data: { ...o, passwordHash, role: "BRAND_OWNER", phone: "+91 98100 00001", status: "APPROVED" } })),
  );

  const creators = await Promise.all(
    [
      {
        name: "Arjun Verma",
        email: `arjun.tech@${DEMO_DOMAIN}`,
        profile: {
          displayName: "Arjun Reviews Tech",
          username: "arjuntech",
          category: "Tech & gadgets",
          location: "Bengaluru, India",
          bio: "Honest gadget reviews for students and first-jobbers. 2 videos a week.",
          instagramHandle: "arjuntech",
          instagramUrl: "https://instagram.com/arjuntech",
          instagramFollowers: 84_000,
          youtubeChannel: "Arjun Reviews Tech",
          youtubeUrl: "https://youtube.com/@arjuntech",
          youtubeSubscribers: 210_000,
          twitterHandle: "arjuntech",
          twitterUrl: "https://x.com/arjuntech",
          averageViews: 45_000,
          engagementRate: 4.1,
          audienceCategory: "Tech enthusiasts",
          audienceLocation: "India (metro cities), 18–30",
          previousCampaigns: "Noise ColorFit launch (reel + story), Realme Narzo unboxing, Zebronics gaming headset review.",
          contentSamples: ["https://www.youtube.com/watch?v=demo-arjun-1", "https://www.instagram.com/reel/demo-arjun-2"],
          verificationStatus: "VERIFIED" as const,
        },
      },
      {
        name: "Sana Ali",
        email: `sana.glow@${DEMO_DOMAIN}`,
        profile: {
          displayName: "Sana Glow Diaries",
          username: "sanaglow",
          category: "Beauty",
          location: "Mumbai, India",
          bio: "Skincare routines that survive Mumbai humidity. Dermat-approved picks only.",
          instagramHandle: "sanaglow",
          instagramUrl: "https://instagram.com/sanaglow",
          instagramFollowers: 156_000,
          youtubeChannel: "Sana Glow Diaries",
          youtubeUrl: "https://youtube.com/@sanaglow",
          youtubeSubscribers: 38_000,
          averageViews: 60_000,
          engagementRate: 5.6,
          audienceCategory: "Fashion & beauty",
          audienceLocation: "India, 20–35, 80% women",
          previousCampaigns: "Minimalist sunscreen, Plum body lotion, Dot & Key festive box.",
          contentSamples: ["https://www.instagram.com/reel/demo-sana-1"],
          verificationStatus: "VERIFIED" as const,
        },
      },
      {
        name: "Neha Sharma",
        email: `neha.fit@${DEMO_DOMAIN}`,
        profile: {
          displayName: "Neha Lifts",
          username: "nehalifts",
          category: "Fitness",
          location: "Gurugram, India",
          bio: "Strength coach. Budget-friendly fitness gear and protein reviews.",
          instagramHandle: "nehalifts",
          instagramUrl: "https://instagram.com/nehalifts",
          instagramFollowers: 22_500,
          averageViews: 9_000,
          engagementRate: 7.2,
          audienceCategory: "Fitness enthusiasts",
          audienceLocation: "Delhi NCR, 22–40",
          contentSamples: [],
          verificationStatus: "PENDING" as const,
        },
      },
    ].map((c) =>
      prisma.user.create({
        data: { name: c.name, email: c.email, passwordHash, role: "CREATOR", status: "APPROVED", creatorProfile: { create: c.profile } },
      }),
    ),
  );

  const customers = await Promise.all(
    [
      { name: "Aarav Gupta", email: `aarav@${DEMO_DOMAIN}` },
      { name: "Ishita Verma", email: `ishita@${DEMO_DOMAIN}` },
      { name: "Dev Malhotra", email: `dev@${DEMO_DOMAIN}` },
      { name: "Meera Iyer", email: `meera@${DEMO_DOMAIN}` },
    ].map((c) => prisma.user.create({ data: { ...c, passwordHash, role: "CUSTOMER", status: "APPROVED" } })),
  );

  // ----------------------------------------------------------------- brands
  const [soundwave, glowlab, fitfuel] = await Promise.all([
    prisma.brand.create({
      data: {
        ownerId: owners[0].id,
        name: "Soundwave Audio",
        slug: "soundwave-audio",
        tagline: "Big sound. Fair price.",
        description: "Wireless headphones, earbuds and speakers designed in India for everyday listening. Sold on our own store and major marketplaces.",
        industry: "Consumer electronics",
        website: "https://example.com/soundwave",
        supportEmail: "partners@soundwave.example",
        socialLinks: { instagram: "https://instagram.com/soundwave.demo", youtube: "https://youtube.com/@soundwave.demo" },
        verificationStatus: "VERIFIED",
      },
    }),
    prisma.brand.create({
      data: {
        ownerId: owners[1].id,
        name: "GlowLab Skincare",
        slug: "glowlab-skincare",
        tagline: "Clinically simple skincare.",
        description: "Fragrance-free, dermatologist-formulated skincare for Indian skin and weather.",
        industry: "Beauty & personal care",
        website: "https://example.com/glowlab",
        socialLinks: { instagram: "https://instagram.com/glowlab.demo" },
        verificationStatus: "VERIFIED",
      },
    }),
    prisma.brand.create({
      data: {
        ownerId: owners[2].id,
        name: "FitFuel Nutrition",
        slug: "fitfuel-nutrition",
        tagline: "Plant protein that actually tastes good.",
        description: "Vegan protein powders and snacks made in Pune.",
        industry: "Health & fitness",
        website: "https://example.com/fitfuel",
        verificationStatus: "PENDING",
      },
    }),
  ]);

  // --------------------------------------------------------------- products
  const [rockerz, buds, serum, protein] = await Promise.all([
    prisma.product.create({
      data: {
        brandId: soundwave.id,
        name: "Soundwave Rockerz 450 Bluetooth Headphones",
        slug: "soundwave-rockerz-450",
        description: "15-hour playback, 40mm drivers, soft padded ear cushions and a foldable design. Available in black, blue and red.",
        category: "Headphones & audio",
        price: 149_900,
        purchaseUrl: "https://example.com/soundwave/products/rockerz-450",
        sku: "SW-R450",
        imageUrl: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&q=80",
      },
    }),
    prisma.product.create({
      data: {
        brandId: soundwave.id,
        name: "Soundwave Airdopes 141 TWS Earbuds",
        slug: "soundwave-airdopes-141",
        description: "42-hour total playtime, ENx noise cancellation for calls, IPX4 water resistance.",
        category: "Headphones & audio",
        price: 129_900,
        purchaseUrl: "https://example.com/soundwave/products/airdopes-141",
        sku: "SW-A141",
        imageUrl: "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=800&q=80",
      },
    }),
    prisma.product.create({
      data: {
        brandId: glowlab.id,
        name: "GlowLab 10% Niacinamide Serum",
        slug: "glowlab-niacinamide-serum",
        description: "Oil control and pore refinement in 4 weeks. 30ml, fragrance-free.",
        category: "Skincare",
        price: 59_900,
        purchaseUrl: "https://example.com/glowlab/products/niacinamide-serum",
        sku: "GL-NIA10",
        imageUrl: "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=800&q=80",
      },
    }),
    prisma.product.create({
      data: {
        brandId: fitfuel.id,
        name: "FitFuel Plant Protein — Chocolate (1kg)",
        slug: "fitfuel-plant-protein-chocolate",
        description: "25g protein per scoop from pea and brown rice. No added sugar.",
        category: "Supplements",
        price: 219_900,
        purchaseUrl: "https://example.com/fitfuel/products/plant-protein-chocolate",
        sku: "FF-PP-CHOC-1KG",
        imageUrl: "https://images.unsplash.com/photo-1593095948071-474c5cc2989d?w=800&q=80",
      },
    }),
  ]);

  // -------------------------------------------------------------- campaigns
  const rockerzLaunch = await prisma.campaign.create({
    data: {
      brandId: soundwave.id,
      productId: rockerz.id,
      name: "Rockerz 450 Festive Launch",
      slug: "soundwave-rockerz-450-festive-launch",
      description: "Drive online sales of the Rockerz 450 through tech and lifestyle creators before the festive season.",
      campaignType: "HYBRID",
      offerTitle: "Get 10% off with a creator link",
      offerDescription: "Discount applied automatically at checkout on the Soundwave store.",
      terms: "Commission is paid on delivered, non-returned orders.\nNo paid ads on brand keywords.\nDisclose the partnership (#ad).",
      rewardType: "FIXED_AMOUNT",
      customerRewardValue: 10_000, // ₹100 to the referring customer
      creatorCommissionType: "PERCENTAGE",
      creatorCommissionValue: 1_200, // 12%
      minimumPurchaseAmount: null,
      newCustomerOnly: false,
      requiresApproval: true,
      attributionWindowDays: 30,
      budget: 20_000_000,
      startDate: daysAgo(28),
      endDate: daysAgo(-45),
      status: "ACTIVE",
      publishedAt: daysAgo(28),
    },
  });

  const budsAlwaysOn = await prisma.campaign.create({
    data: {
      brandId: soundwave.id,
      productId: buds.id,
      name: "Airdopes 141 Always-on Affiliate",
      slug: "soundwave-airdopes-141-affiliate",
      description: "Evergreen affiliate program for our best-selling earbuds. Open to all creators — no approval needed.",
      campaignType: "CREATOR_AFFILIATE",
      rewardType: "FIXED_AMOUNT",
      customerRewardValue: 0,
      creatorCommissionType: "FIXED_AMOUNT",
      creatorCommissionValue: 15_000, // ₹150 per order
      requiresApproval: false,
      attributionWindowDays: 30,
      startDate: daysAgo(60),
      endDate: null,
      status: "ACTIVE",
      publishedAt: daysAgo(60),
    },
  });

  const serumRefer = await prisma.campaign.create({
    data: {
      brandId: glowlab.id,
      productId: serum.id,
      name: "Niacinamide Serum — Refer a Friend",
      slug: "glowlab-niacinamide-refer-a-friend",
      description: "Customers and beauty creators share the serum; friends get a discount, referrers earn a reward.",
      campaignType: "HYBRID",
      offerTitle: "₹100 off your first GlowLab order",
      terms: "First-time GlowLab customers only. One reward per referred customer.",
      rewardType: "FIXED_AMOUNT",
      customerRewardValue: 7_500, // ₹75
      creatorCommissionType: "PERCENTAGE",
      creatorCommissionValue: 1_500, // 15%
      newCustomerOnly: true,
      requiresApproval: true,
      attributionWindowDays: 45,
      maxRewardPerCustomer: 30_000,
      budget: 5_000_000,
      startDate: daysAgo(20),
      endDate: daysAgo(-10),
      status: "ACTIVE",
      publishedAt: daysAgo(20),
    },
  });

  const proteinDraft = await prisma.campaign.create({
    data: {
      brandId: fitfuel.id,
      productId: protein.id,
      name: "Plant Protein Creator Program",
      slug: "fitfuel-plant-protein-creator-program",
      campaignType: "CREATOR_AFFILIATE",
      rewardType: "FIXED_AMOUNT",
      customerRewardValue: 0,
      creatorCommissionType: "PERCENTAGE",
      creatorCommissionValue: 2_000,
      requiresApproval: true,
      startDate: daysAgo(-3),
      status: "DRAFT",
    },
  });

  // ------------------------------------------------ partners & links
  type PartnerSeed = { campaignId: string; userId: string; partnerType: PartnerType; code: string; approved: boolean; message?: string };
  const partnerSeeds: PartnerSeed[] = [
    { campaignId: rockerzLaunch.id, userId: creators[0].id, partnerType: "CREATOR", code: "ARJUNTECH-SOUNDWAV-DEMO", approved: true, message: "I have a Rockerz vs Sony comparison planned for next week." },
    { campaignId: rockerzLaunch.id, userId: creators[2].id, partnerType: "CREATOR", code: "NEHALIFTS-SOUNDWAV-DEMO", approved: false, message: "Gym-audio angle — sweat resistance and battery for long sessions." },
    { campaignId: rockerzLaunch.id, userId: customers[0].id, partnerType: "CUSTOMER", code: "AARAVGUPTA-SOUNDWAV-DEMO", approved: true },
    { campaignId: rockerzLaunch.id, userId: customers[1].id, partnerType: "CUSTOMER", code: "ISHITAVERMA-SOUNDWAV-DEMO", approved: true },
    { campaignId: budsAlwaysOn.id, userId: creators[0].id, partnerType: "CREATOR", code: "ARJUNTECH-SOUNDWAV-DEM2", approved: true },
    { campaignId: serumRefer.id, userId: creators[1].id, partnerType: "CREATOR", code: "SANAGLOW-GLOWLAB-DEMO", approved: true, message: "Will include it in my monsoon skincare routine reel." },
    { campaignId: serumRefer.id, userId: customers[2].id, partnerType: "CUSTOMER", code: "DEVMALHOTRA-GLOWLAB-DEMO", approved: true },
  ];

  const links = new Map<string, { id: string; campaignId: string; ownerId: string; partnerType: PartnerType }>();
  for (const p of partnerSeeds) {
    await prisma.partnerApplication.create({
      data: { campaignId: p.campaignId, userId: p.userId, partnerType: p.partnerType, status: p.approved ? "APPROVED" : "PENDING", message: p.message },
    });
    if (p.approved) {
      const link = await prisma.referralLink.create({ data: { campaignId: p.campaignId, ownerId: p.userId, partnerType: p.partnerType, code: p.code } });
      links.set(p.code, link);
    }
  }

  // ------------------------------------------------------------ clicks
  const clickPlan: { code: string; count: number; qrShare: number; spreadDays: number }[] = [
    { code: "ARJUNTECH-SOUNDWAV-DEMO", count: 420, qrShare: 0.05, spreadDays: 27 },
    { code: "AARAVGUPTA-SOUNDWAV-DEMO", count: 26, qrShare: 0.4, spreadDays: 20 },
    { code: "ISHITAVERMA-SOUNDWAV-DEMO", count: 11, qrShare: 0.2, spreadDays: 15 },
    { code: "ARJUNTECH-SOUNDWAV-DEM2", count: 640, qrShare: 0.02, spreadDays: 29 },
    { code: "SANAGLOW-GLOWLAB-DEMO", count: 310, qrShare: 0.03, spreadDays: 19 },
    { code: "DEVMALHOTRA-GLOWLAB-DEMO", count: 14, qrShare: 0.5, spreadDays: 12 },
  ];
  const clickRows = [];
  for (const plan of clickPlan) {
    const link = links.get(plan.code)!;
    for (let i = 0; i < plan.count; i++) {
      clickRows.push({
        referralLinkId: link.id,
        campaignId: link.campaignId,
        anonymousVisitorId: `demo-visitor-${plan.code}-${i}`,
        source: i < plan.count * plan.qrShare ? ("QR" as const) : ("LINK" as const),
        ipHash: `demo-iphash-${(i * 7919) % 97}`,
        userAgent: i % 3 === 0 ? "Mozilla/5.0 (iPhone; demo)" : "Mozilla/5.0 (Android; demo)",
        createdAt: daysAgo(Math.floor((i / plan.count) * plan.spreadDays), 9 + (i % 12)),
      });
    }
  }
  await prisma.referralClick.createMany({ data: clickRows });

  // ------------------------------------------------- orders & ledger
  type OrderSeed = {
    code: string;
    brandId: string;
    status: "VERIFIED" | "PURCHASED" | "REJECTED";
    amount: number;
    orderRef: string;
    ago: number;
    reward?: number;
    commission?: number;
    rewardStatus?: "PENDING" | "AVAILABLE" | "REDEEMED";
    commissionStatus?: "PENDING" | "APPROVED" | "PAID";
  };
  const orders: OrderSeed[] = [
    // Rockerz launch — Arjun (12% of ₹1,499 = ₹179.88 → 17_988)
    { code: "ARJUNTECH-SOUNDWAV-DEMO", brandId: soundwave.id, status: "VERIFIED", amount: 149_900, orderRef: "SW-10412", ago: 24, commission: 17_988, commissionStatus: "PAID" },
    { code: "ARJUNTECH-SOUNDWAV-DEMO", brandId: soundwave.id, status: "VERIFIED", amount: 149_900, orderRef: "SW-10458", ago: 21, commission: 17_988, commissionStatus: "PAID" },
    { code: "ARJUNTECH-SOUNDWAV-DEMO", brandId: soundwave.id, status: "VERIFIED", amount: 299_800, orderRef: "SW-10502", ago: 15, commission: 35_976, commissionStatus: "APPROVED" },
    { code: "ARJUNTECH-SOUNDWAV-DEMO", brandId: soundwave.id, status: "VERIFIED", amount: 149_900, orderRef: "SW-10533", ago: 9, commission: 17_988, commissionStatus: "APPROVED" },
    { code: "ARJUNTECH-SOUNDWAV-DEMO", brandId: soundwave.id, status: "PURCHASED", amount: 149_900, orderRef: "SW-10590", ago: 2, commission: 17_988, commissionStatus: "PENDING" },
    { code: "ARJUNTECH-SOUNDWAV-DEMO", brandId: soundwave.id, status: "REJECTED", amount: 149_900, orderRef: "SW-10550", ago: 6 },
    // Rockerz — customers (₹100 reward)
    { code: "AARAVGUPTA-SOUNDWAV-DEMO", brandId: soundwave.id, status: "VERIFIED", amount: 149_900, orderRef: "SW-10477", ago: 18, reward: 10_000, rewardStatus: "REDEEMED" },
    { code: "AARAVGUPTA-SOUNDWAV-DEMO", brandId: soundwave.id, status: "VERIFIED", amount: 149_900, orderRef: "SW-10520", ago: 11, reward: 10_000, rewardStatus: "AVAILABLE" },
    { code: "ISHITAVERMA-SOUNDWAV-DEMO", brandId: soundwave.id, status: "PURCHASED", amount: 149_900, orderRef: "SW-10588", ago: 3, reward: 10_000, rewardStatus: "PENDING" },
    // Airdopes always-on — ₹150 fixed
    { code: "ARJUNTECH-SOUNDWAV-DEM2", brandId: soundwave.id, status: "VERIFIED", amount: 129_900, orderRef: "SW-10301", ago: 40, commission: 15_000, commissionStatus: "PAID" },
    { code: "ARJUNTECH-SOUNDWAV-DEM2", brandId: soundwave.id, status: "VERIFIED", amount: 129_900, orderRef: "SW-10388", ago: 30, commission: 15_000, commissionStatus: "PAID" },
    { code: "ARJUNTECH-SOUNDWAV-DEM2", brandId: soundwave.id, status: "VERIFIED", amount: 259_800, orderRef: "SW-10440", ago: 22, commission: 15_000, commissionStatus: "APPROVED" },
    { code: "ARJUNTECH-SOUNDWAV-DEM2", brandId: soundwave.id, status: "VERIFIED", amount: 129_900, orderRef: "SW-10515", ago: 12, commission: 15_000, commissionStatus: "APPROVED" },
    { code: "ARJUNTECH-SOUNDWAV-DEM2", brandId: soundwave.id, status: "VERIFIED", amount: 129_900, orderRef: "SW-10570", ago: 5, commission: 15_000, commissionStatus: "APPROVED" },
    { code: "ARJUNTECH-SOUNDWAV-DEM2", brandId: soundwave.id, status: "PURCHASED", amount: 129_900, orderRef: "SW-10601", ago: 1, commission: 15_000, commissionStatus: "PENDING" },
    // GlowLab serum — Sana 15% of ₹599 = ₹89.85 → 8_985
    { code: "SANAGLOW-GLOWLAB-DEMO", brandId: glowlab.id, status: "VERIFIED", amount: 59_900, orderRef: "GL-2201", ago: 16, commission: 8_985, commissionStatus: "APPROVED" },
    { code: "SANAGLOW-GLOWLAB-DEMO", brandId: glowlab.id, status: "VERIFIED", amount: 119_800, orderRef: "GL-2240", ago: 8, commission: 17_970, commissionStatus: "APPROVED" },
    { code: "SANAGLOW-GLOWLAB-DEMO", brandId: glowlab.id, status: "PURCHASED", amount: 59_900, orderRef: "GL-2288", ago: 1, commission: 8_985, commissionStatus: "PENDING" },
    { code: "DEVMALHOTRA-GLOWLAB-DEMO", brandId: glowlab.id, status: "VERIFIED", amount: 59_900, orderRef: "GL-2215", ago: 12, reward: 7_500, rewardStatus: "AVAILABLE" },
  ];

  const ownerFor = (brandId: string) => (brandId === soundwave.id ? owners[0] : brandId === glowlab.id ? owners[1] : owners[2]);

  for (const o of orders) {
    const link = links.get(o.code)!;
    const createdAt = daysAgo(o.ago, 13);
    const verifiedAt = o.status === "VERIFIED" ? daysAgo(Math.max(0, o.ago - 1), 18) : null;
    const referral = await prisma.referral.create({
      data: {
        campaignId: link.campaignId,
        referralLinkId: link.id,
        referrerId: link.ownerId,
        status: o.status,
        qualifyingEvent: "Online order",
        verifiedAt,
        createdAt,
      },
    });
    await prisma.conversion.create({
      data: {
        referralId: referral.id,
        brandId: o.brandId,
        orderReference: o.orderRef,
        amount: o.amount,
        quantity: o.amount >= 250_000 ? 2 : 1,
        source: o.code.includes("GUPTA") || o.code.includes("MALHOTRA") ? "QR_SCAN" : "REFERRAL_CODE",
        verifiedById: o.status === "VERIFIED" ? ownerFor(o.brandId).id : null,
        verifiedAt,
        createdAt,
      },
    });
    if (o.reward) {
      await prisma.reward.create({ data: { referralId: referral.id, recipientId: link.ownerId, rewardType: "FIXED_AMOUNT", amount: o.reward, status: o.rewardStatus ?? "PENDING", createdAt } });
    }
    if (o.commission) {
      await prisma.commission.create({ data: { referralId: referral.id, creatorId: link.ownerId, amount: o.commission, status: o.commissionStatus ?? "PENDING", createdAt } });
    }
  }

  // ------------------------------------------------------------ payouts
  await prisma.payoutRequest.create({
    data: { userId: creators[0].id, amount: 65_976, status: "PAID", payoutMethod: "UPI", payoutReference: "DEMO-UTR-000123", requestedAt: daysAgo(14), processedAt: daysAgo(12) },
  });
  await prisma.payoutRequest.create({
    data: { userId: creators[1].id, amount: 26_955, status: "REQUESTED", payoutMethod: "UPI", requestedAt: daysAgo(2) },
  });

  // ---------------------------------------------------------- audit logs
  await prisma.auditLog.createMany({
    data: [
      { userId: admin.id, action: "SEED_DEMO_DATA", entityType: "System", metadata: { note: "Demo data created by prisma/seed.ts" } },
      { userId: owners[0].id, action: "CAMPAIGN_PUBLISH", entityType: "Campaign", entityId: rockerzLaunch.id, metadata: { from: "DRAFT", to: "ACTIVE" }, createdAt: daysAgo(28) },
      { userId: owners[0].id, action: "CAMPAIGN_PUBLISH", entityType: "Campaign", entityId: budsAlwaysOn.id, metadata: { from: "DRAFT", to: "ACTIVE" }, createdAt: daysAgo(60) },
      { userId: owners[1].id, action: "CAMPAIGN_PUBLISH", entityType: "Campaign", entityId: serumRefer.id, metadata: { from: "DRAFT", to: "ACTIVE" }, createdAt: daysAgo(20) },
      { userId: owners[2].id, action: "CAMPAIGN_CREATED", entityType: "Campaign", entityId: proteinDraft.id, metadata: { name: proteinDraft.name }, createdAt: daysAgo(1) },
      { userId: admin.id, action: "PAYOUT_PAID", entityType: "PayoutRequest", metadata: { reference: "DEMO-UTR-000123" }, createdAt: daysAgo(12) },
    ],
  });

  // ------------------------------------------- quick sign-in IDs (one per role)
  const quickBrand = await prisma.user.create({
    data: {
      name: "Demo Brand Owner",
      email: `brand@${DEMO_DOMAIN}`,
      passwordHash,
      role: "BRAND_OWNER",
      status: "APPROVED",
      brands: {
        create: {
          name: "Demo Gadgets Co",
          slug: "demo-gadgets-co",
          tagline: "A demo brand with one product and no campaigns yet.",
          industry: "Consumer electronics",
          website: "https://example.com/demo-gadgets",
          products: {
            create: {
              name: "Demo Smartwatch S1",
              slug: "demo-gadgets-smartwatch-s1",
              description: "A sample product to create your first campaign with.",
              category: "Wearables",
              price: 249_900,
              purchaseUrl: "https://example.com/demo-gadgets/products/smartwatch-s1",
              sku: "DG-S1",
            },
          },
        },
      },
    },
  });
  const quickCreator = await prisma.user.create({
    data: {
      name: "Demo Creator",
      email: `creator@${DEMO_DOMAIN}`,
      passwordHash,
      role: "CREATOR",
      status: "APPROVED",
      creatorProfile: {
        create: { displayName: "Demo Creator", username: "democreator", category: "Lifestyle", location: "Delhi, India", instagramHandle: "democreator", instagramFollowers: 12_000, engagementRate: 3.5, audienceCategory: "Young professionals" },
      },
    },
  });
  const quickCustomer = await prisma.user.create({
    data: { name: "Demo Customer", email: `customer@${DEMO_DOMAIN}`, passwordHash, role: "CUSTOMER", status: "APPROVED" },
  });

  console.log("Demo data ready.\n");
  console.log(`All demo accounts use password: ${DEMO_PASSWORD}`);
  console.table([
    { role: "BRAND_OWNER", email: quickBrand.email, workspace: "Demo Gadgets Co (1 product, no campaigns)" },
    { role: "CREATOR", email: quickCreator.email, workspace: "Demo Creator" },
    { role: "CUSTOMER", email: quickCustomer.email },
    { role: "ADMIN", email: admin.email },
    { role: "BRAND_OWNER", email: owners[0].email, workspace: "Soundwave Audio" },
    { role: "BRAND_OWNER", email: owners[1].email, workspace: "GlowLab Skincare" },
    { role: "BRAND_OWNER", email: owners[2].email, workspace: "FitFuel Nutrition" },
    { role: "CREATOR", email: creators[0].email, workspace: "Arjun Reviews Tech" },
    { role: "CREATOR", email: creators[1].email, workspace: "Sana Glow Diaries" },
    { role: "CREATOR", email: creators[2].email, workspace: "Neha Lifts" },
    { role: "CUSTOMER", email: customers[0].email },
  ]);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
