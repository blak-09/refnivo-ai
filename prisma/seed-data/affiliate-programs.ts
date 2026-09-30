import type { AffiliateCommissionType, AffiliateProgramType, Prisma, PrismaClient, SocialPlatform } from "@prisma/client";
import type { BEST_FOR_OPTIONS } from "../../lib/validation/affiliate";

/**
 * Verified external affiliate / creator / ambassador programmes, inserted
 * through the same AffiliateProgram model brands use — never hard-coded in the UI.
 *
 * Rules for every entry (see docs/API.md → External affiliate programmes):
 *  - Every programme was checked live on its official page — the brand's own
 *    site, or the brand's official listing on its affiliate network — on the
 *    `checkedOn` date. Only facts published there are stored; anything the page
 *    does not state stays null and is shown as "Not publicly disclosed" /
 *    "Open application / subject to program approval".
 *  - Program type follows how the programme describes itself (an ambassador
 *    scheme that pays in free gear is INFLUENCER, not AFFILIATE).
 *  - No brand account: these are curated listings (brandId null, brandName set),
 *    shown as "Listed by Refnivo" and "not a Refnivo partner".
 *  - Seeded as APPROVED (active) with verifiedAt = checkedOn. An admin can
 *    deactivate, unverify, edit or delete any of them without code changes, and
 *    re-running the seed never overwrites an existing row.
 *
 * Logos live in public/brand-logos/<logo>.png: each brand's own site icon or
 * header logo, or the logo file on the brand's Wikipedia infobox, made square.
 */
type BestFor = (typeof BEST_FOR_OPTIONS)[number];

type Entry = {
  slug: string;
  brandName: string;
  name: string;
  programType: AffiliateProgramType;
  category: string;
  subcategory?: string;
  description: string;
  websiteUrl: string;
  programUrl: string;
  signupUrl?: string;
  networkName?: string;
  commissionType?: AffiliateCommissionType;
  commissionDescription?: string;
  cookieDurationDays?: number;
  requirements?: string;
  geography?: string;
  bestFor: BestFor[];
  supportedPlatforms?: SocialPlatform[];
  logo: string;
  /** Where each stated fact was checked, and when. Kept in code, not shown to users. */
  sources: { checkedOn: string; urls: string[]; notes: string };
};

const CHECKED = "2026-09-30";

const ENTRIES: Entry[] = [
  // ─── E-commerce platforms ────────────────────────────────────────────────
  {
    slug: "amazon-associates-india",
    brandName: "Amazon",
    name: "Amazon Associates Program",
    programType: "AFFILIATE",
    category: "E-commerce",
    subcategory: "Marketplace",
    description:
      "Amazon.in is Amazon's Indian online marketplace, selling electronics, fashion, home and kitchen, books, beauty, groceries and more from Amazon and third-party sellers. The Amazon Associates Program lets website owners, app publishers and content creators link to products on Amazon.in and earn fees on qualifying purchases — relevant to creators in almost any product niche.",
    websiteUrl: "https://www.amazon.in",
    programUrl: "https://affiliate-program.amazon.in/",
    signupUrl: "https://affiliate-program.amazon.in/signup",
    networkName: "In-house",
    commissionType: "VARIES",
    commissionDescription: "Up to 10%, varies by product category",
    requirements:
      "Content creators, publishers and bloggers with qualifying websites or mobile apps; applications are reviewed. Influencers with an established social following can apply to the separate Amazon Influencer Program.",
    geography: "India",
    bestFor: ["General creators", "Tech creators", "Lifestyle creators"],
    logo: "amazon",
    sources: { checkedOn: CHECKED, urls: ["https://affiliate-program.amazon.in/"], notes: "Official page: 'Earn up to 10% in affiliate fees'; rates by category in the fee schedule; separate Influencer Program." },
  },
  {
    slug: "flipkart-affiliate-program",
    brandName: "Flipkart",
    name: "Flipkart Affiliate Program",
    programType: "AFFILIATE",
    category: "E-commerce",
    subcategory: "Marketplace",
    description:
      "Flipkart is an Indian e-commerce marketplace for mobiles, electronics, fashion, home and kitchen, books, toys and more. Its affiliate programme lets partners drive traffic to Flipkart and earn commission on resulting purchases, with rates set per product category — useful for Indian creators and publishers who review or recommend everyday products.",
    websiteUrl: "https://www.flipkart.com",
    programUrl: "https://affiliate.flipkart.com/",
    networkName: "In-house",
    commissionType: "VARIES",
    commissionDescription: "Varies by category (e.g. up to 6% on computers, 6–20% on toys)",
    geography: "India",
    bestFor: ["General creators", "Tech creators", "Fashion creators"],
    logo: "flipkart",
    sources: { checkedOn: CHECKED, urls: ["https://affiliate.flipkart.com/"], notes: "Official page lists category rates: books 6–12%, mobiles up to 5%, computers up to 6%, toys 6–20%, cameras up to 4%." },
  },
  {
    slug: "etsy-affiliates",
    brandName: "Etsy",
    name: "Etsy Affiliates & Creator Collective",
    programType: "AFFILIATE",
    category: "E-commerce",
    subcategory: "Marketplace",
    description:
      "Etsy is a global online marketplace for handmade items, vintage goods, craft supplies and gifts from independent sellers. It runs two partner programmes: Affiliates, for bloggers, media and editorial publishers, and Creator Collective, for social media creators. Both earn commission on qualifying sales, which suits gifting, home décor and craft content.",
    websiteUrl: "https://www.etsy.com",
    programUrl: "https://www.etsy.com/affiliates",
    requirements: "Affiliates: bloggers, media and editorial publications. Creator Collective: social media creators with at least 500 followers on one authorised channel.",
    geography: "Multiple countries",
    bestFor: ["Lifestyle creators", "Home creators", "Fashion creators"],
    logo: "etsy",
    sources: { checkedOn: CHECKED, urls: ["https://www.etsy.com/affiliates"], notes: "Official page: two programmes; commission on qualifying sales excluding tax, shipping, returns; Creator Collective min 500 followers. Rate not stated." },
  },
  {
    slug: "ebay-partner-network",
    brandName: "eBay",
    name: "eBay Partner Network",
    programType: "AFFILIATE",
    category: "E-commerce",
    subcategory: "Marketplace",
    description:
      "eBay is a global online marketplace where people buy and sell new and used items across electronics, collectibles, fashion, home and more. The eBay Partner Network is eBay's affiliate programme: partners create tracked links to listings, searches and categories, and earn commission when referred buyers win or purchase an item.",
    websiteUrl: "https://www.ebay.com",
    programUrl: "https://partnernetwork.ebay.com/",
    networkName: "In-house",
    commissionType: "VARIES",
    commissionDescription: "Varies by product category",
    requirements: "A blog, website, social network or mobile app; free to join, applications reviewed.",
    geography: "Multiple countries",
    bestFor: ["Tech creators", "General creators", "Gaming creators"],
    logo: "ebay",
    sources: {
      checkedOn: CHECKED,
      urls: ["https://partnernetwork.ebay.com/", "https://www.ebay.com/help/terms-conditions/default/ebay-partner-network-epn-affiliate-programs?id=4662"],
      notes: "eBay help: 'Commissions vary by product category'; need a blog, website, social network or app; free.",
    },
  },
  {
    slug: "walmart-creator",
    brandName: "Walmart",
    name: "Walmart Creator",
    programType: "CREATOR_AFFILIATE",
    category: "E-commerce",
    subcategory: "Retail",
    description:
      "Walmart is a large US retailer selling groceries, electronics, home goods, apparel, toys and everyday essentials online and in stores. Walmart Creator is its affiliate programme for social creators, who recommend Walmart products to their audiences through affiliate links and earn commission on eligible purchases.",
    websiteUrl: "https://www.walmart.com",
    programUrl: "https://creator.walmart.com/",
    geography: "United States",
    bestFor: ["General creators", "Lifestyle creators", "Home creators"],
    logo: "walmart",
    sources: { checkedOn: CHECKED, urls: ["https://creator.walmart.com/", "https://creator.walmart.com/education/walmart-creator-101"], notes: "Official Walmart Creator site; rate and eligibility not stated on the pages read." },
  },
  {
    slug: "iherb-affiliate-program",
    brandName: "iHerb",
    name: "iHerb Affiliate Program",
    programType: "AFFILIATE",
    category: "E-commerce",
    subcategory: "Health & wellness",
    description:
      "iHerb is an online store for vitamins, supplements, sports nutrition, natural beauty, grocery and wellness products, with a dedicated India site. Its affiliate programme is offered through several major networks — Partnerize, Impact, CJ and Awin — with commission of up to 25% on referred sales, suiting health, fitness and clean-beauty creators.",
    websiteUrl: "https://in.iherb.com",
    programUrl: "https://www.iherb.com/info/affiliates",
    networkName: "Partnerize, Impact, CJ or Awin",
    commissionType: "VARIES",
    commissionDescription: "Up to 25% on referred sales",
    geography: "Multiple countries",
    bestFor: ["Fitness creators", "Beauty creators", "Food creators"],
    logo: "iherb",
    sources: { checkedOn: CHECKED, urls: ["https://www.iherb.com/info/affiliates"], notes: "Official page (India locale): up to 25% commission; join via Partnerize, Impact, CJ or Awin." },
  },

  // ─── Travel ──────────────────────────────────────────────────────────────
  {
    slug: "booking-com-affiliate-programme",
    brandName: "Booking.com",
    name: "Booking.com Affiliate Partner Programme",
    programType: "AFFILIATE",
    category: "Travel",
    subcategory: "Accommodation",
    description:
      "Booking.com is an online travel agency for hotels, homes, apartments and other accommodation worldwide, alongside flights, car rentals and attractions. Its affiliate partner programme lets travel sites and creators add links, banners and search tools and earn commission on qualified bookings; registration runs through Booking.com's official affiliate networks.",
    websiteUrl: "https://www.booking.com",
    programUrl: "https://www.booking.com/affiliate-program/v2/index.html",
    networkName: "CJ (Booking.com's official affiliate networks)",
    requirements: "Register through one of Booking.com's official affiliate networks (e.g. CJ); subject to approval.",
    geography: "Global",
    bestFor: ["Travel creators"],
    logo: "booking-com",
    sources: { checkedOn: CHECKED, urls: ["https://www.booking.com/affiliate-program/v2/index.html"], notes: "Official page: register with official affiliate networks (CJ); commission on qualified bookings; rate not stated." },
  },
  {
    slug: "agoda-affiliate",
    brandName: "Agoda",
    name: "Agoda Affiliate Partners",
    programType: "AFFILIATE",
    category: "Travel",
    subcategory: "Accommodation",
    description:
      "Agoda is an online travel platform for hotels, homes and holiday rentals, with flights and activities, and strong coverage across Asia. Its affiliate partner programme lets travel publishers and creators refer bookings to Agoda through tracked links and tools.",
    websiteUrl: "https://www.agoda.com",
    programUrl: "https://partners.agoda.com/",
    geography: "Global",
    bestFor: ["Travel creators"],
    logo: "agoda",
    sources: { checkedOn: CHECKED, urls: ["https://partners.agoda.com/"], notes: "Official Agoda Affiliate portal; terms not published on the landing page." },
  },
  {
    slug: "klook-affiliate-program",
    brandName: "Klook",
    name: "Klook Affiliate Program",
    programType: "AFFILIATE",
    category: "Travel",
    subcategory: "Experiences",
    description:
      "Klook is a travel booking platform for attractions, tours, activities, transport passes and experiences in destinations around the world. Its affiliate programme lets travel bloggers and creators share Klook links and earn on bookings their audience makes.",
    websiteUrl: "https://www.klook.com",
    programUrl: "https://affiliate.klook.com/",
    geography: "Global",
    bestFor: ["Travel creators"],
    logo: "klook",
    sources: { checkedOn: CHECKED, urls: ["https://affiliate.klook.com/"], notes: "Official 'Klook's Affiliate Program' portal; terms not published on the landing page." },
  },
  {
    slug: "trip-com-affiliate-program",
    brandName: "Trip.com",
    name: "Trip.com Affiliate Program",
    programType: "AFFILIATE",
    category: "Travel",
    subcategory: "Online travel agency",
    description:
      "Trip.com is a global online travel agency, part of Trip.com Group, offering hotels, flights, trains, car hire and attractions. Its affiliate programme lets partners promote Trip.com travel products with links and banners, earning commission of up to 7% on bookings.",
    websiteUrl: "https://www.trip.com",
    programUrl: "https://www.trip.com/partners",
    commissionType: "VARIES",
    commissionDescription: "Up to 7%",
    geography: "Global",
    bestFor: ["Travel creators"],
    logo: "trip-com",
    sources: { checkedOn: CHECKED, urls: ["https://www.trip.com/partners"], notes: "Official page: 'Join us and start earning up to 7% commission'." },
  },
  {
    slug: "expedia-group-travel-creator-program",
    brandName: "Expedia Group",
    name: "Expedia Group Travel Creator Program",
    programType: "CREATOR_AFFILIATE",
    category: "Travel",
    subcategory: "Online travel agency",
    description:
      "Expedia Group operates travel brands including Expedia, Hotels.com and Vrbo, covering hotels, holiday rentals, flights, cars and activities. Its Travel Creator Program lets publishers and content creators earn from travel bookings made through their links.",
    websiteUrl: "https://www.expediagroup.com",
    programUrl: "https://creator.expediagroup.com/affiliates",
    geography: "Global",
    bestFor: ["Travel creators"],
    logo: "expedia-group",
    sources: { checkedOn: CHECKED, urls: ["https://creator.expediagroup.com/affiliates"], notes: "Official 'Expedia Group Travel Creator Program' page with sign-up; rates not stated on the page read." },
  },
  {
    slug: "airalo-affiliate-program",
    brandName: "Airalo",
    name: "Airalo Affiliate Program",
    programType: "AFFILIATE",
    category: "Travel",
    subcategory: "Travel eSIM",
    description:
      "Airalo sells eSIM data plans that let travellers get mobile data abroad without a physical SIM card. Its affiliate programme is aimed at travel bloggers, influencers, content creators, comparison sites and apps, and pays a standard commission on the final sale value after discounts.",
    websiteUrl: "https://www.airalo.com",
    programUrl: "https://partners.airalo.com/solutions/affiliates",
    networkName: "Impact",
    commissionType: "PERCENTAGE",
    commissionDescription: "10% of final sale value (standard rate)",
    requirements: "Travel bloggers, influencers, content creators, comparison sites and apps with travelling audiences; applications are reviewed.",
    geography: "Global",
    bestFor: ["Travel creators", "Tech creators"],
    logo: "airalo",
    sources: { checkedOn: CHECKED, urls: ["https://partners.airalo.com/solutions/affiliates"], notes: "Official page: 'standard commission rate is 10% on the final sale value (after discounts)'; sign-up via Impact." },
  },
  {
    slug: "getyourguide-affiliate-program",
    brandName: "GetYourGuide",
    name: "GetYourGuide Affiliate Program",
    programType: "AFFILIATE",
    category: "Travel",
    subcategory: "Experiences",
    description:
      "GetYourGuide is an online marketplace for tours, activities, attractions and travel experiences around the world. Its affiliate (partner) programme lets travel creators and publishers link to experiences and earn on completed bookings.",
    websiteUrl: "https://www.getyourguide.com",
    programUrl: "https://partner.getyourguide.com/",
    geography: "Global",
    bestFor: ["Travel creators"],
    logo: "getyourguide",
    sources: { checkedOn: CHECKED, urls: ["https://partner.getyourguide.com/"], notes: "Official 'Travel Affiliate Program' partner site; terms not readable from the landing page." },
  },

  // ─── Electronics & tech ──────────────────────────────────────────────────
  {
    slug: "anker-affiliate-program",
    brandName: "Anker",
    name: "Anker Affiliate Program",
    programType: "AFFILIATE",
    category: "Electronics",
    subcategory: "Charging",
    description:
      "Anker makes consumer charging technology, including power banks, wall chargers, cables and charging stations. Its affiliate programme invites forums, blogs, product review sites, social media creators and publishers to promote Anker and earn a flat commission on every transaction, with a 30-day cookie.",
    websiteUrl: "https://www.anker.com",
    programUrl: "https://www.anker.com/become-an-affiliate",
    commissionType: "PERCENTAGE",
    commissionDescription: "8% on all sales",
    cookieDurationDays: 30,
    requirements: "Forums, blogs, product review websites, social media platforms and publishers; apply and await approval.",
    geography: "United States",
    bestFor: ["Tech creators"],
    logo: "anker",
    sources: { checkedOn: CHECKED, urls: ["https://www.anker.com/become-an-affiliate"], notes: "Official page: 'consistent 8% commission on all transactions', '30-day cookie duration'." },
  },
  {
    slug: "soundcore-affiliate-program",
    brandName: "soundcore",
    name: "soundcore Affiliate Program",
    programType: "AFFILIATE",
    category: "Electronics",
    subcategory: "Audio",
    description:
      "soundcore is Anker's audio brand, making wireless earbuds, headphones and portable speakers. Its affiliate programme runs on the CJ network, is free to join for review sites, communities, bloggers and other content creators, and pays 3–15% on approved sales with a 30-day cookie.",
    websiteUrl: "https://www.soundcore.com",
    programUrl: "https://www.soundcore.com/become-an-affiliate",
    networkName: "CJ",
    commissionType: "VARIES",
    commissionDescription: "3–15% on approved sales",
    cookieDurationDays: 30,
    requirements: "Review sites, online communities, bloggers and other content website owners; free to join, subject to approval.",
    geography: "United States",
    bestFor: ["Tech creators"],
    logo: "soundcore",
    sources: { checkedOn: CHECKED, urls: ["https://www.soundcore.com/become-an-affiliate"], notes: "Official page: '3%-15% commission on all approved sales', 30-day cookies, CJ affiliate network." },
  },
  {
    slug: "ugreen-affiliate-program",
    brandName: "UGREEN",
    name: "UGREEN Affiliate Program",
    programType: "AFFILIATE",
    category: "Electronics",
    subcategory: "Charging & accessories",
    description:
      "UGREEN makes charging and connectivity accessories such as chargers, power banks, cables, hubs and docking stations. Its affiliate programme invites review sites, online communities, bloggers and content creators, paying a minimum of 8% on qualifying purchases with a 30-day cookie, tracked through networks such as Impact.",
    websiteUrl: "https://www.ugreen.com",
    programUrl: "https://www.ugreen.com/pages/affiliate",
    networkName: "Impact",
    commissionType: "PERCENTAGE",
    commissionDescription: "Minimum 8% (up to 15%)",
    cookieDurationDays: 30,
    requirements: "Review sites, online communities, bloggers and other content creators; applications reviewed within a few business days.",
    geography: "Global",
    bestFor: ["Tech creators"],
    logo: "ugreen",
    sources: { checkedOn: CHECKED, urls: ["https://www.ugreen.com/pages/affiliate"], notes: "Official FAQ: 'minimum of 8% commission'; 'Up to 15%'; 'cookie duration is 30 days'; impact.com." },
  },
  {
    slug: "logitech-affiliate-program",
    brandName: "Logitech",
    name: "Logitech Affiliate Program",
    programType: "AFFILIATE",
    category: "Electronics",
    subcategory: "PC accessories & gaming",
    description:
      "Logitech designs computer peripherals and devices — mice, keyboards, webcams, headsets, speakers and gaming gear — across its family of brands. Its affiliate programme is run through Impact and offers a 4–10% standard commission that varies by brand, with a 30-day cookie.",
    websiteUrl: "https://www.logitech.com",
    programUrl: "https://www.logitech.com/en-us/programs/affiliate-program",
    networkName: "Impact",
    commissionType: "VARIES",
    commissionDescription: "4–10% standard, varies by brand",
    cookieDurationDays: 30,
    geography: "United States",
    bestFor: ["Tech creators", "Gaming creators"],
    logo: "logitech",
    sources: { checkedOn: CHECKED, urls: ["https://www.logitech.com/en-us/programs/affiliate-program"], notes: "Official page: '4 - 10% Standard Commission*', '30 Day Cookie', apply through Impact; *varies by brand." },
  },
  {
    slug: "samsung-gulf-affiliate-program",
    brandName: "Samsung",
    name: "Samsung Affiliate Program (Gulf)",
    programType: "AFFILIATE",
    category: "Electronics",
    subcategory: "Mobiles & appliances",
    description:
      "Samsung makes smartphones, tablets, wearables, TVs and home appliances. The Samsung Gulf Affiliate Program lets creators sign up on the Optimise platform, promote Samsung products and coupon offers, and earn commission on every confirmed sale.",
    websiteUrl: "https://www.samsung.com/ae/",
    programUrl: "https://www.samsung.com/ae/offer/samsung-affiliate-program/",
    networkName: "Optimise",
    geography: "Gulf region (UAE site)",
    bestFor: ["Tech creators"],
    logo: "samsung",
    sources: { checkedOn: CHECKED, urls: ["https://www.samsung.com/ae/offer/samsung-affiliate-program/"], notes: "Official Samsung Gulf page: sign up on Optimise; 'Earn commission for every confirmed sale'; rate not stated." },
  },
  {
    slug: "asus-uk-affiliate-programme",
    brandName: "ASUS",
    name: "ASUS UK Affiliate Programme",
    programType: "AFFILIATE",
    category: "Electronics",
    subcategory: "Computers & gaming",
    description:
      "ASUS makes laptops, desktop PCs, motherboards, graphics cards, monitors, routers and other technology products. Its UK affiliate programme on Awin pays up to 3% commission on transaction value, with a 30-day cookie and a 45-day validation period.",
    websiteUrl: "https://www.asus.com/uk/",
    programUrl: "https://ui.awin.com/merchant-profile/31726",
    networkName: "Awin",
    commissionType: "PERCENTAGE",
    commissionDescription: "Up to 3%",
    cookieDurationDays: 30,
    geography: "United Kingdom",
    bestFor: ["Tech creators", "Gaming creators"],
    logo: "asus",
    sources: { checkedOn: CHECKED, urls: ["https://ui.awin.com/merchant-profile/31726"], notes: "Official ASUS UK listing on Awin: 'Up to 3% Commission', 45 days validation, cookie 30 days." },
  },
  {
    slug: "nomad-ambassador-program",
    brandName: "Nomad",
    name: "Nomad Ambassador Program",
    programType: "CREATOR_AFFILIATE",
    category: "Electronics",
    subcategory: "Device accessories",
    description:
      "Nomad makes accessories for phones and smartwatches, including cases, watch bands and chargers. Its ambassador programme runs through Shopify Collabs: ambassadors create content and earn a 15% baseline commission on orders through their affiliate link, get 15% off gear when they sign up, and are paid every 30–45 days.",
    websiteUrl: "https://nomadgoods.com",
    programUrl: "https://nomadgoods.com/pages/ambassador",
    networkName: "Shopify Collabs",
    commissionType: "PERCENTAGE",
    commissionDescription: "15% baseline",
    requirements: "Anyone can apply; minimum $25 in earnings for a payout.",
    geography: "Global",
    bestFor: ["Tech creators", "Lifestyle creators"],
    logo: "nomad",
    sources: { checkedOn: CHECKED, urls: ["https://nomadgoods.com/pages/ambassador"], notes: "Official page: 'baseline commission is 15%', 15% off gear, payouts 30–45 days, min $25, Shopify Collabs, 'Anyone can apply'." },
  },

  // ─── Fitness & wearables ─────────────────────────────────────────────────
  {
    slug: "ultrahuman-affiliate-program",
    brandName: "Ultrahuman",
    name: "Ultrahuman Affiliate Program",
    programType: "AFFILIATE",
    category: "Fitness",
    subcategory: "Wearables",
    description:
      "Ultrahuman makes the Ultrahuman Ring AIR, a smart ring that tracks sleep, heart rate variability, skin temperature, movement and stress without a subscription. Its affiliate programme on Awin pays tiered commission that rises with sales volume, with a 45-day cookie.",
    websiteUrl: "https://www.ultrahuman.com",
    programUrl: "https://ui.awin.com/merchant-profile/69428",
    networkName: "Awin",
    commissionType: "VARIES",
    commissionDescription: "7% up to $10k in sales, 10% from $10k–$35k, 15% after",
    cookieDurationDays: 45,
    geography: "Global",
    bestFor: ["Fitness creators", "Tech creators"],
    logo: "ultrahuman",
    sources: { checkedOn: CHECKED, urls: ["https://ui.awin.com/merchant-profile/69428"], notes: "Official Ultrahuman listing on Awin: 7% first $10k, 10% $10k-$35k, 15% thereafter; cookie 45 days." },
  },
  {
    slug: "oura-affiliate-program",
    brandName: "Oura",
    name: "Oura Affiliate Program",
    programType: "AFFILIATE",
    category: "Fitness",
    subcategory: "Wearables",
    description:
      "Oura makes the Oura Ring, a smart ring with a membership app for tracking sleep, activity and readiness. Oura invites brand and affiliate partners to collaborate on promoting health and wellness, with an application for its affiliate programme on its partnerships page.",
    websiteUrl: "https://ouraring.com",
    programUrl: "https://organizations.ouraring.com/solutions/partners-resellers",
    geography: "Global",
    bestFor: ["Fitness creators", "Tech creators"],
    logo: "oura",
    sources: { checkedOn: CHECKED, urls: ["https://ouraring.com/partnerships"], notes: "Official partnerships page: 'Collaborate with Oura through affiliate partnerships… Apply for our affiliate program'; terms not stated." },
  },
  {
    slug: "therabody-affiliate-program",
    brandName: "Therabody",
    name: "Therabody Affiliate Program",
    programType: "AFFILIATE",
    category: "Fitness",
    subcategory: "Recovery",
    description:
      "Therabody makes wellness and recovery technology, including Theragun percussive massage devices and TheraFace skincare devices. Its affiliate programme has separate application tracks for influencers and creators, press publishers, health and wellness professionals, and coupon, deal and cashback publishers.",
    websiteUrl: "https://www.therabody.com",
    programUrl: "https://www.therabody.com/pages/affiliates",
    requirements: "Separate tracks for influencers/creators, press publishers, health & wellness professionals, and coupon/deal/cashback publishers; applications reviewed.",
    geography: "United States",
    bestFor: ["Fitness creators"],
    logo: "therabody",
    sources: { checkedOn: CHECKED, urls: ["https://www.therabody.com/pages/affiliates"], notes: "Official page: Apply now for Influencer, Press, Professionals, Affiliates; rate not stated." },
  },
  {
    slug: "myprotein-affiliate-program",
    brandName: "Myprotein",
    name: "Myprotein Affiliate Program",
    programType: "AFFILIATE",
    category: "Fitness",
    subcategory: "Sports nutrition",
    description:
      "Myprotein sells sports nutrition such as protein powders, supplements, snacks and activewear. Its US affiliate programme pays commission of up to 8% on sales generated, with support from an in-house affiliate team and a 30-day cookie window.",
    websiteUrl: "https://us.myprotein.com",
    programUrl: "https://us.myprotein.com/c/about-us/ways-to-work-with-us/affiliated-partners/",
    commissionType: "VARIES",
    commissionDescription: "Up to 8%",
    cookieDurationDays: 30,
    requirements: "Website, blog or social channel owners; subject to approval.",
    geography: "United States",
    bestFor: ["Fitness creators"],
    logo: "myprotein",
    sources: { checkedOn: CHECKED, urls: ["https://us.myprotein.com/c/about-us/ways-to-work-with-us/affiliated-partners/"], notes: "Official page: 'percentage as high as 8%', '30-day cookie window', in-house affiliate team." },
  },
  {
    slug: "bulk-affiliate-programme",
    brandName: "Bulk",
    name: "Bulk Affiliate Programme",
    programType: "AFFILIATE",
    category: "Fitness",
    subcategory: "Sports nutrition",
    description:
      "Bulk sells sports nutrition such as whey protein, creatine, protein powders and supplements. Its affiliate programme on Awin welcomes affiliates who create original content on their own websites or on Instagram and TikTok, paying 8% for new customers and 1% for existing customers with a 30-day cookie.",
    websiteUrl: "https://www.bulk.com/uk",
    programUrl: "https://www.bulk.com/uk/affiliates",
    networkName: "Awin",
    commissionType: "PERCENTAGE",
    commissionDescription: "8% new customers · 1% existing customers",
    cookieDurationDays: 30,
    requirements: "Affiliates creating original content on their own website or on channels such as Instagram and TikTok; apply via Awin.",
    geography: "United Kingdom",
    bestFor: ["Fitness creators"],
    supportedPlatforms: ["INSTAGRAM"],
    logo: "bulk",
    sources: { checkedOn: CHECKED, urls: ["https://www.bulk.com/uk/affiliates"], notes: "Official page: 8% new customers, 1% existing, 30 day cookie, apply via AWIN." },
  },

  // ─── Sports ──────────────────────────────────────────────────────────────
  {
    slug: "under-armour-affiliate-program",
    brandName: "Under Armour",
    name: "Under Armour Affiliate Program",
    programType: "AFFILIATE",
    category: "Sports",
    subcategory: "Performance apparel",
    description:
      "Under Armour makes performance apparel, footwear and accessories for training, running and sport. Its affiliate programme, joined through Awin, lets approved websites link to UA.com and earn commission on click-through sales, with commissions paid monthly.",
    websiteUrl: "https://www.underarmour.com",
    programUrl: "https://www.underarmour.com/en-us/t/ua-affiliate-program/",
    networkName: "Awin",
    requirements: "Approved websites; Under Armour reviews each site for fit with the programme.",
    geography: "United States",
    bestFor: ["Fitness creators", "Fashion creators"],
    logo: "under-armour",
    sources: { checkedOn: CHECKED, urls: ["https://www.underarmour.com/en-us/t/ua-affiliate-program/"], notes: "Official page: sign up with Awin; commissions paid monthly; rate not stated." },
  },

  // ─── Beauty & skincare ───────────────────────────────────────────────────
  {
    slug: "nykaa-affiliate-program",
    brandName: "Nykaa",
    name: "Nykaa Affiliate Program",
    programType: "AFFILIATE",
    category: "Beauty",
    subcategory: "Beauty e-commerce",
    description:
      "Nykaa is an Indian online retailer for beauty, skincare, haircare, fragrance, wellness and fashion, stocking international and Indian brands. The Nykaa Affiliate Program (NAP) lets external creators and publishers curate Nykaa products for their audiences and earn a commission when those visitors purchase — a natural fit for beauty and lifestyle content.",
    websiteUrl: "https://www.nykaa.com",
    programUrl: "https://affiliate.nykaa.com/",
    networkName: "In-house",
    commissionType: "FIXED",
    commissionDescription: "Fixed across categories — rate not publicly disclosed",
    geography: "India",
    bestFor: ["Beauty creators", "Fashion creators", "Lifestyle creators"],
    logo: "nykaa",
    sources: {
      checkedOn: CHECKED,
      urls: ["https://affiliate.nykaa.com/", "https://onenykaa.zendesk.com/hc/en-us/articles/28416301514781-What-is-the-Nykaa-Affiliate-Program"],
      notes: "Nykaa help centre: 'The commission is fixed for all affiliates and across categories'; rate not stated there.",
    },
  },
  {
    slug: "charlotte-tilbury-affiliate-programme",
    brandName: "Charlotte Tilbury",
    name: "Charlotte Tilbury Affiliate Programme",
    programType: "AFFILIATE",
    category: "Beauty",
    subcategory: "Makeup & skincare",
    description:
      "Charlotte Tilbury is a luxury makeup and skincare brand. Its affiliate programme runs on Partnerize: the brand states that partners earn around 10% commission on average, paid every 30 days, with real-time tracking, imagery and banners, and applications reviewed within 7 days.",
    websiteUrl: "https://www.charlottetilbury.com",
    programUrl: "https://www.charlottetilbury.com/us/content/charlotte-tilbury-affiliate-program",
    networkName: "Partnerize",
    commissionType: "PERCENTAGE",
    commissionDescription: "10% on average",
    requirements: "Create a Partnerize account (e.g. Loyalty or Influencer vertical) and join the Charlotte Tilbury campaigns; reviewed within 7 days.",
    geography: "Global",
    bestFor: ["Beauty creators"],
    logo: "charlotte-tilbury",
    sources: { checkedOn: CHECKED, urls: ["https://www.charlottetilbury.com/us/content/charlotte-tilbury-affiliate-program"], notes: "Official page: 'on average our partners earn 10%', paid every 30 days, Partnerize, review within 7 days." },
  },
  {
    slug: "huda-beauty-affiliate-program",
    brandName: "Huda Beauty",
    name: "Huda Beauty Affiliate Program",
    programType: "AFFILIATE",
    category: "Beauty",
    subcategory: "Makeup",
    description:
      "Huda Beauty is a makeup and beauty brand offering foundation, concealer, eyeshadow palettes, lip products and more. Its global affiliate programme runs on Partnerize and pays commission on every sale made through a partner's tracking link, with a 30-day cookie window, banners, creative assets and product feeds.",
    websiteUrl: "https://hudabeauty.com",
    programUrl: "https://hudabeauty.com/en-us/pages/affiliate-program",
    networkName: "Partnerize",
    cookieDurationDays: 30,
    geography: "Global",
    bestFor: ["Beauty creators"],
    logo: "huda-beauty",
    sources: { checkedOn: CHECKED, urls: ["https://hudabeauty.com/en-us/pages/affiliate-program"], notes: "Official page: commission on every sale, 30-day cookie window, Partnerize; rate not stated." },
  },
  {
    slug: "the-ordinary-affiliate-programme",
    brandName: "The Ordinary",
    name: "The Ordinary Affiliate Programme",
    programType: "AFFILIATE",
    category: "Beauty",
    subcategory: "Skincare",
    description:
      "The Ordinary, from DECIEM, sells clinical skincare formulations such as serums, acids and moisturisers at accessible prices. Its affiliate programme is listed on the Awin network with a 30-day cookie.",
    websiteUrl: "https://theordinary.com",
    programUrl: "https://ui.awin.com/merchant-profile/29849",
    networkName: "Awin",
    cookieDurationDays: 30,
    geography: "Global",
    bestFor: ["Beauty creators"],
    logo: "the-ordinary",
    sources: { checkedOn: CHECKED, urls: ["https://ui.awin.com/merchant-profile/29849"], notes: "Official 'The Ordinary Affiliate Programme' on Awin: cookie length 30 days; rate not stated." },
  },
  {
    slug: "plum-affiliate-program",
    brandName: "Plum",
    name: "The Plum List",
    programType: "CREATOR_AFFILIATE",
    category: "Beauty",
    subcategory: "Skincare",
    description:
      "Plum is an Indian vegan beauty brand selling skincare, bodycare, haircare and makeup. Its affiliate programme, The Plum List, pays affiliates 10% commission on the post-discount value of the sales they generate, gives their audience 15% off with a personal code, and runs its dashboard on GoAffPro.",
    websiteUrl: "https://plumgoodness.com",
    programUrl: "https://plumgoodness.com/pages/affiliate-program-faqs",
    networkName: "GoAffPro",
    commissionType: "PERCENTAGE",
    commissionDescription: "10% of post-discount sales",
    requirements: "Apply via form; profiles are verified against eligibility criteria before approval; one application per email address.",
    geography: "India",
    bestFor: ["Beauty creators", "Lifestyle creators"],
    logo: "plum",
    sources: {
      checkedOn: CHECKED,
      urls: ["https://plumgoodness.com/pages/affiliate-program-faqs", "https://plumgoodness.com/pages/affiliate-tnc"],
      notes: "Official T&C: '10% commission on the sales generated (post-discount order value)'; audience 15% off; GoAffPro dashboard.",
    },
  },
  {
    slug: "pilgrim-ambassador-program",
    brandName: "Pilgrim",
    name: "Pilgrim Ambassador Program",
    programType: "CREATOR_AFFILIATE",
    category: "Beauty",
    subcategory: "Skincare & haircare",
    description:
      "Pilgrim is an Indian beauty brand selling skincare, haircare, makeup and fragrance. The Pilgrim Ambassador Program is its affiliate programme for registered discoverpilgrim.com users: approved ambassadors get an affiliate dashboard, a discount code for their audience, and commission on completed orders, invoiced monthly.",
    websiteUrl: "https://discoverpilgrim.com",
    programUrl: "https://discoverpilgrim.com/pages/affiliates",
    requirements: "Open to registered users of discoverpilgrim.com; applications checked against eligibility criteria; minimum ₹3,000 in commission to invoice.",
    geography: "India",
    bestFor: ["Beauty creators"],
    logo: "pilgrim",
    sources: {
      checkedOn: CHECKED,
      urls: ["https://discoverpilgrim.com/pages/affiliates", "https://discoverpilgrim.com/pages/affiliate-program-faqs"],
      notes: "Official FAQ/T&C: open to registered users; commission on net invoice value (rate not stated); min ₹3000 to invoice; paid within 30 working days.",
    },
  },
  {
    slug: "tarte-affiliate-program",
    brandName: "tarte",
    name: "tarte Affiliate Program",
    programType: "CREATOR_AFFILIATE",
    category: "Beauty",
    subcategory: "Makeup",
    description:
      "tarte is a cosmetics brand selling makeup and skincare. Its creator affiliate programme runs through ShopMy, giving creators commission earnings, gifting perks and brand opportunities in one place; creators already on ShopMy can start earning on tarte products right away.",
    websiteUrl: "https://tartecosmetics.com",
    programUrl: "https://tartecosmetics.com/pages/affiliates",
    networkName: "ShopMy",
    requirements: "Sign up as a creator on ShopMy (existing ShopMy creators can link tarte products immediately).",
    geography: "Global",
    bestFor: ["Beauty creators"],
    logo: "tarte",
    sources: { checkedOn: CHECKED, urls: ["https://tartecosmetics.com/pages/affiliates"], notes: "Official page: partnered with ShopMy; commission earnings, gifting perks; rate not stated." },
  },

  // ─── Fashion ─────────────────────────────────────────────────────────────
  {
    slug: "levis-affiliate-program",
    brandName: "Levi's",
    name: "Levi's Affiliate Program",
    programType: "AFFILIATE",
    category: "Fashion",
    subcategory: "Denim & apparel",
    description:
      "Levi's, from Levi Strauss & Co., makes denim jeans, jackets and casual apparel. Its US affiliate programme accepts content creators, publishers, bloggers, media partners and loyalty and deal partners, with applications handled through Rakuten Advertising.",
    websiteUrl: "https://www.levi.com",
    programUrl: "https://www.levi.com/US/en_US/features/affiliate-program",
    networkName: "Rakuten Advertising",
    requirements: "Content creators, publishers, bloggers, media partners, and loyalty & deal partners; subject to approval.",
    geography: "United States",
    bestFor: ["Fashion creators", "Lifestyle creators"],
    logo: "levis",
    sources: { checkedOn: CHECKED, urls: ["https://www.levi.com/US/en_US/features/affiliate-program"], notes: "Official page: who can apply listed; Apply Now → signup.linkshare.com (Rakuten); rate not stated." },
  },
  {
    slug: "allbirds-affiliate-program",
    brandName: "Allbirds",
    name: "Allbirds Affiliate Program",
    programType: "AFFILIATE",
    category: "Fashion",
    subcategory: "Footwear",
    description:
      "Allbirds makes shoes and apparel using natural materials such as wool and tree fibre. It runs an ambassador track for creators promoting on Instagram, TikTok or YouTube, and a media publications track for newsletters, podcasts and blogs; both pay commission on net sales.",
    websiteUrl: "https://www.allbirds.com",
    programUrl: "https://www.allbirds.com/pages/affiliates",
    commissionDescription: "Commission on net sales (rate not publicly disclosed)",
    requirements: "Ambassadors: creators on Instagram, TikTok or YouTube. Media publications: newsletters, podcasts, blogs and other online media.",
    geography: "United States",
    bestFor: ["Fashion creators", "Lifestyle creators"],
    supportedPlatforms: ["INSTAGRAM", "YOUTUBE"],
    logo: "allbirds",
    sources: { checkedOn: CHECKED, urls: ["https://www.allbirds.com/pages/affiliates"], notes: "Official page: Ambassadors (Instagram/TikTok/YouTube) and Media Publications; 'commission on all net sales'." },
  },
  {
    slug: "daniel-wellington-dw-icons",
    brandName: "Daniel Wellington",
    name: "DW Icons Ambassador Program",
    programType: "INFLUENCER",
    category: "Fashion",
    subcategory: "Watches & jewellery",
    description:
      "Daniel Wellington sells minimalist watches, bracelets and jewellery. Its DW Icons ambassador programme is open to any fan with a public, active social media account; benefits can include commission, gift cards, cash, personalised discount codes and free products, with extra missions for ambassadors above 3,000 followers.",
    websiteUrl: "https://www.danielwellington.com",
    programUrl: "https://www.danielwellington.com/pages/become-an-ambassador",
    commissionDescription: "Commission, gift cards & discount codes (rates not publicly disclosed)",
    requirements: "A public, active social media account; no minimum follower count (extra perks above 3,000 followers).",
    geography: "Global",
    bestFor: ["Fashion creators", "Lifestyle creators"],
    logo: "daniel-wellington",
    sources: { checkedOn: CHECKED, urls: ["https://www.danielwellington.com/pages/become-an-ambassador"], notes: "Official page: DW Icons; benefits list; no minimum followers; extra missions >3,000 followers." },
  },
  {
    slug: "rothys-affiliate-program",
    brandName: "Rothy's",
    name: "Rothy's Affiliate & Influencer Program",
    programType: "AFFILIATE",
    category: "Fashion",
    subcategory: "Footwear & bags",
    description:
      "Rothy's makes shoes and bags knitted from materials that include recycled plastic. Its affiliate and influencer partner programme is for content creators and press, who earn commission on the sales they convert after applying through a form.",
    websiteUrl: "https://rothys.com",
    programUrl: "https://rothys.com/pages/brand-affiliate-marketing-program",
    requirements: "Content creators and press; apply through the form and accept the programme agreement.",
    geography: "United States",
    bestFor: ["Fashion creators", "Lifestyle creators"],
    logo: "rothys",
    sources: { checkedOn: CHECKED, urls: ["https://rothys.com/pages/brand-affiliate-marketing-program"], notes: "Official page: for content creators and press; commission on sales converted; rate not stated." },
  },
  {
    slug: "pura-vida-affiliate-program",
    brandName: "Pura Vida",
    name: "Pura Vida Affiliate Program",
    programType: "AFFILIATE",
    category: "Fashion",
    subcategory: "Jewellery & accessories",
    description:
      "Pura Vida Bracelets sells bracelets, jewellery and accessories. Its affiliate programme offers up to 15% commission on all sales with a 30-day cookie, with sign-up through the Impact network.",
    websiteUrl: "https://www.puravidabracelets.com",
    programUrl: "https://www.puravidabracelets.com/pages/affiliate-program",
    networkName: "Impact",
    commissionType: "VARIES",
    commissionDescription: "Up to 15%",
    cookieDurationDays: 30,
    geography: "United States",
    bestFor: ["Fashion creators", "Lifestyle creators"],
    logo: "pura-vida",
    sources: { checkedOn: CHECKED, urls: ["https://www.puravidabracelets.com/pages/affiliate-program"], notes: "Official page: 'Up to 15% commission on all sales', '30 day cookie', partner sign-up via Impact." },
  },
  {
    slug: "snitch-creator-squad",
    brandName: "Snitch",
    name: "Snitch Creator Squad",
    programType: "INFLUENCER",
    category: "Fashion",
    subcategory: "Menswear",
    description:
      "Snitch is an Indian fashion brand selling men's clothing such as shirts, trousers, T-shirts and co-ord sets. The Snitch Creator Squad invites creators to make content featuring Snitch styles and earn per post.",
    websiteUrl: "https://www.snitch.com",
    programUrl: "https://www.snitch.com/join-creator-squad",
    commissionDescription: "Paid per post (rate not publicly disclosed)",
    geography: "India",
    bestFor: ["Fashion creators"],
    logo: "snitch",
    sources: { checkedOn: CHECKED, urls: ["https://www.snitch.com/join-creator-squad"], notes: "Official page (meta description): 'Create content, earn per post… Apply now!'." },
  },
  {
    slug: "blenders-eyewear-affiliate-program",
    brandName: "Blenders Eyewear",
    name: "Blenders Eyewear Affiliate Program",
    programType: "AFFILIATE",
    category: "Fashion",
    subcategory: "Eyewear",
    description:
      "Blenders Eyewear makes sunglasses and blue-light glasses in lifestyle and sport styles. Its affiliate programme, run with Acceleration Partners on Awin, offers up to 12% commission on all sales with a 30-day cookie.",
    websiteUrl: "https://www.blenderseyewear.com",
    programUrl: "https://ui.awin.com/merchant-profile/60071",
    networkName: "Awin",
    commissionType: "VARIES",
    commissionDescription: "Up to 12%",
    cookieDurationDays: 30,
    geography: "United States",
    bestFor: ["Fashion creators", "Lifestyle creators"],
    logo: "blenders",
    sources: { checkedOn: CHECKED, urls: ["https://ui.awin.com/merchant-profile/60071"], notes: "Official Blenders listing on Awin: 'Up to 12% on all sales', cookie 30 days, managed with Acceleration Partners." },
  },

  // ─── Home & kitchen ──────────────────────────────────────────────────────
  {
    slug: "dyson-affiliate-programme-uk",
    brandName: "Dyson",
    name: "Dyson Affiliate Programme",
    programType: "AFFILIATE",
    category: "Home",
    subcategory: "Appliances",
    description:
      "Dyson makes vacuum cleaners, hair care tools, air purifiers and lighting. Its UK affiliate programme pays a 1% commission on every item sale — including vacuums, hair care, air treatment and lighting — through the Impact network, with monthly commission payments.",
    websiteUrl: "https://www.dyson.co.uk",
    programUrl: "https://www.dyson.co.uk/inside-dyson/affiliates",
    networkName: "Impact",
    commissionType: "PERCENTAGE",
    commissionDescription: "1% of every item sale",
    geography: "United Kingdom",
    bestFor: ["Home creators", "Tech creators", "Beauty creators"],
    logo: "dyson",
    sources: { checkedOn: CHECKED, urls: ["https://www.dyson.co.uk/inside-dyson/affiliates"], notes: "Official page: 'All affiliates earn a 1% commission of every item sale amount', monthly payments, IMPACT." },
  },
  {
    slug: "wayfair-creator-program",
    brandName: "Wayfair",
    name: "Wayfair Creator Program",
    programType: "CREATOR_AFFILIATE",
    category: "Home",
    subcategory: "Furniture & décor",
    description:
      "Wayfair is an online retailer of furniture, home décor, lighting, kitchenware and home improvement products. The Wayfair Creator Program lets creators and influencers share Wayfair products through affiliate links.",
    websiteUrl: "https://www.wayfair.com",
    programUrl: "https://influencers.wayfair.com/connect/",
    geography: "United States",
    bestFor: ["Home creators", "Lifestyle creators"],
    logo: "wayfair",
    sources: { checkedOn: CHECKED, urls: ["https://influencers.wayfair.com/connect/"], notes: "Official 'Wayfair Creator Program' page; terms not stated on the page read." },
  },
  {
    slug: "vitamix-affiliate-program",
    brandName: "Vitamix",
    name: "Vitamix Affiliate Program",
    programType: "AFFILIATE",
    category: "Home",
    subcategory: "Kitchen appliances",
    description:
      "Vitamix makes high-performance blenders and kitchen appliances for home and commercial use. Its affiliate programme runs on the CJ network, with commission starting at 10% for affiliates who create content.",
    websiteUrl: "https://www.vitamix.com",
    programUrl: "https://www.vitamix.com/us/en_us/owners-resources/affiliates",
    networkName: "CJ",
    commissionType: "PERCENTAGE",
    commissionDescription: "Starting at 10% for content creators",
    geography: "United States",
    bestFor: ["Food creators", "Home creators"],
    logo: "vitamix",
    sources: { checkedOn: CHECKED, urls: ["https://www.vitamix.com/us/en_us/owners-resources/affiliates/faqs"], notes: "Official FAQ: 'commission starting at 10% for those affiliates creating content'; Commission Junction." },
  },
  {
    slug: "caraway-affiliate-program",
    brandName: "Caraway",
    name: "Caraway Affiliate Program",
    programType: "AFFILIATE",
    category: "Home",
    subcategory: "Cookware",
    description:
      "Caraway makes ceramic non-stick cookware, bakeware and kitchen storage. Its affiliate programme is aimed at website and blog owners familiar with SEO, who earn commission on each sale and receive free Caraway products and early access to launches.",
    websiteUrl: "https://www.carawayhome.com",
    programUrl: "https://www.carawayhome.com/pages/affiliate",
    requirements: "Website or blog owners familiar with SEO; apply online.",
    geography: "United States",
    bestFor: ["Home creators", "Food creators"],
    logo: "caraway",
    sources: { checkedOn: CHECKED, urls: ["https://www.carawayhome.com/pages/affiliate"], notes: "Official page: for website/blog owners familiar with SEO; commission on each sale; free products; rate not stated." },
  },

  // ─── Lifestyle ───────────────────────────────────────────────────────────
  {
    slug: "stanley-affiliate-program",
    brandName: "Stanley",
    name: "Stanley Affiliate Program",
    programType: "AFFILIATE",
    category: "Lifestyle",
    subcategory: "Drinkware & outdoor",
    description:
      "Stanley (Stanley 1913) makes insulated tumblers, bottles, food jars, coolers and outdoor gear. Its affiliate programme runs on AvantLink and pays 10% commission on sales with a 30-day cookie, welcoming publishers, outdoor, lifestyle and fashion sites, review sites, social media sites and influencers.",
    websiteUrl: "https://www.stanley1913.com",
    programUrl: "https://www.stanley1913.com/pages/affiliate-program",
    networkName: "AvantLink",
    commissionType: "PERCENTAGE",
    commissionDescription: "10% on sales",
    cookieDurationDays: 30,
    requirements: "Publishers, outdoor sites, lifestyle and fashion sites, product review sites, social media sites and influencers; apply via AvantLink.",
    geography: "United States",
    bestFor: ["Lifestyle creators", "Home creators", "Fitness creators"],
    logo: "stanley",
    sources: { checkedOn: CHECKED, urls: ["https://www.stanley1913.com/pages/affiliate-program"], notes: "Official page: '10% Commission On Sales', '30 Day Cookies', AvantLink." },
  },
  {
    slug: "hydro-flask-affiliate-programme",
    brandName: "Hydro Flask",
    name: "Hydro Flask Affiliate Programme",
    programType: "AFFILIATE",
    category: "Lifestyle",
    subcategory: "Drinkware",
    description:
      "Hydro Flask makes insulated water bottles, tumblers and food containers. Its UK affiliate programme on Awin pays 10% to content and influencer partners (3% for voucher sites, 5% for cashback and loyalty sites), with a 30-day cookie.",
    websiteUrl: "https://www.hydroflask.com",
    programUrl: "https://ui.awin.com/merchant-profile/119849",
    networkName: "Awin",
    commissionType: "VARIES",
    commissionDescription: "10% for content & influencer partners",
    cookieDurationDays: 30,
    geography: "United Kingdom",
    bestFor: ["Lifestyle creators", "Fitness creators"],
    logo: "hydro-flask",
    sources: { checkedOn: CHECKED, urls: ["https://ui.awin.com/merchant-profile/119849"], notes: "Official Hydro Flask listing on Awin: 3% voucher, 5% cashback/loyalty, 10% content & influencer, 30-day cookie." },
  },
  {
    slug: "ridge-ambassador-program",
    brandName: "Ridge",
    name: "Ridge Ambassador Program",
    programType: "INFLUENCER",
    category: "Lifestyle",
    subcategory: "Everyday carry",
    description:
      "Ridge makes minimalist everyday-carry products, best known for its metal wallets, along with key cases and other accessories. Its Ambassador Program offers free gear in exchange for posts and mentions; anyone can apply, regardless of location, age or follower count, by completing a short questionnaire.",
    websiteUrl: "https://ridge.com",
    programUrl: "https://ridge.com/pages/ambassadors",
    commissionDescription: "Free gear in exchange for posts (no commission stated)",
    requirements: "Anyone can apply — any location, any number of followers, any age; complete a short questionnaire.",
    geography: "Global",
    bestFor: ["Lifestyle creators", "Tech creators"],
    logo: "ridge",
    sources: { checkedOn: CHECKED, urls: ["https://ridge.com/pages/ambassadors"], notes: "Official page: 'free gear in exchange for posts and mentions'; anyone, any followers, any age." },
  },

  // ─── Food & nutrition ────────────────────────────────────────────────────
  {
    slug: "huel-affiliate-program",
    brandName: "Huel",
    name: "#TeamHuel Affiliate Program",
    programType: "CREATOR_AFFILIATE",
    category: "Food",
    subcategory: "Nutrition",
    description:
      "Huel makes plant-based, nutritionally complete food, including powders, ready-to-drink shakes and hot meals. #TeamHuel is its affiliate ambassador programme for social creators, currently available only in the UK and US, with a welcome bundle for approved members.",
    websiteUrl: "https://huel.com",
    programUrl: "https://huel.com/pages/affiliate-program-faq",
    requirements: "UK and US only; applications are reviewed.",
    geography: "United Kingdom & United States",
    bestFor: ["Fitness creators", "Food creators"],
    logo: "huel",
    sources: { checkedOn: CHECKED, urls: ["https://huel.com/pages/affiliate-program-faq"], notes: "Official FAQ: 'currently only available in the UK and US'; Welcome Bundle; rate not readable (answers collapsed)." },
  },

  // ─── Existing examples ───────────────────────────────────────────────────
  {
    slug: "boat-affiliate-program",
    brandName: "boAt",
    name: "boAt Affiliate Program",
    programType: "AFFILIATE",
    category: "Electronics",
    subcategory: "Audio & wearables",
    description:
      "boAt is an Indian consumer electronics brand selling earbuds, headphones, speakers, smartwatches and accessories. Its affiliate programme runs on the Admitad network for India; you join on Admitad, where commission rates and programme terms are shown after you sign in.",
    websiteUrl: "https://www.boat-lifestyle.com",
    programUrl: "https://www.admitad.com/en-in/store/offers/boat-lifestyle-cps-in/",
    networkName: "Admitad",
    geography: "India",
    bestFor: ["Tech creators", "Lifestyle creators"],
    logo: "boat",
    sources: {
      checkedOn: CHECKED,
      urls: ["https://www.admitad.com/en-in/store/offers/boat-lifestyle-cps-in/", "https://www.boat-lifestyle.com/pages/refer-and-earn"],
      notes: "Admitad lists 'Boat Lifestyle [CPS] IN' (PAN India); commission shown to logged-in publishers only. boat-lifestyle.com's 'Refer & Earn' is a customer points scheme, not this programme.",
    },
  },
  {
    slug: "r-for-rabbit-affiliate-program",
    brandName: "R for Rabbit",
    name: "R for Rabbit Affiliate Program",
    programType: "AFFILIATE",
    category: "Baby Products",
    subcategory: "Baby gear",
    description:
      "R for Rabbit is an Indian baby products brand. Its own affiliate programme is built for creators who talk to Indian parents: affiliates get a partner dashboard with real-time tracking, deep links to products and collections, ready-made creatives, and a coupon code for their audience on request. Payouts are monthly.",
    websiteUrl: "https://rforrabbit.com",
    programUrl: "https://rforrabbit.com/pages/affiliate-program/",
    signupUrl: "https://partner.rforrabbit.com/register.html",
    networkName: "Trackier",
    commissionType: "PERCENTAGE",
    commissionDescription: "10% flat on every sale",
    cookieDurationDays: 30,
    requirements: "Welcomes parenting bloggers, Instagram and YouTube creators, WhatsApp community admins, coupon and deal sites, and comparison or review sites.",
    geography: "India",
    bestFor: ["Parenting creators", "Lifestyle creators"],
    supportedPlatforms: ["INSTAGRAM", "YOUTUBE"],
    logo: "r-for-rabbit",
    sources: {
      checkedOn: CHECKED,
      urls: ["https://rforrabbit.com/pages/affiliate-program/", "https://partner.rforrabbit.com/register.html"],
      notes: "Official page: flat 10% on every sale, 30-day cookie, Trackier portal, monthly payouts; approval criteria not stated.",
    },
  },
];

export type ExampleAffiliateProgram = Omit<
  Prisma.AffiliateProgramUncheckedCreateInput,
  "id" | "brandId" | "status" | "verifiedAt" | "reviewedAt" | "reviewedById" | "reviewNote" | "submittedAt" | "createdAt" | "updatedAt"
> & {
  slug: string;
  brandName: string;
  sources: Entry["sources"];
};

/** Entries as rows: every unstated field is null — never a default that would claim terms. */
export const EXAMPLE_AFFILIATE_PROGRAMS: ExampleAffiliateProgram[] = ENTRIES.map(({ logo, signupUrl, ...e }) => ({
  ...e,
  signupUrl: signupUrl ?? e.programUrl,
  subcategory: e.subcategory ?? null,
  logoUrl: `/brand-logos/${logo}.png`,
  networkName: e.networkName ?? null,
  commissionType: e.commissionType ?? null,
  commissionDescription: e.commissionDescription ?? null,
  cookieDurationDays: e.cookieDurationDays ?? null,
  approvalType: null,
  requirements: e.requirements ?? null,
  geography: e.geography ?? null,
  supportedPlatforms: e.supportedPlatforms ?? [],
  subIdParam: null,
  minFollowers: null,
  sourceUrl: e.sources.urls[0],
  featured: false,
}));

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * Inserts listings that do not exist yet (matched by slug), published and
 * verified as of their `checkedOn` date. Existing rows are left untouched, so
 * admin edits, deactivation or removal are never overwritten by re-running the
 * seed. A listing that would duplicate another (same brand name or programme
 * URL) is skipped.
 */
export async function seedExampleAffiliatePrograms(db: Db): Promise<{ created: string[]; skipped: string[] }> {
  const created: string[] = [];
  const skipped: string[] = [];
  for (const { sources, ...entry } of EXAMPLE_AFFILIATE_PROGRAMS) {
    const exists = await db.affiliateProgram.findFirst({
      where: {
        OR: [
          { slug: entry.slug },
          { brandName: { equals: entry.brandName, mode: "insensitive" }, status: { not: "CLOSED" } },
          { signupUrl: entry.signupUrl, status: { not: "CLOSED" } },
        ],
      },
      select: { id: true },
    });
    if (exists) {
      skipped.push(entry.slug);
      continue;
    }
    const verifiedAt = new Date(`${sources.checkedOn}T00:00:00.000Z`);
    const program = await db.affiliateProgram.create({
      data: { ...entry, brandId: null, status: "APPROVED", submittedAt: verifiedAt, reviewedAt: verifiedAt, verifiedAt },
    });
    await db.auditLog.create({
      data: {
        userId: null,
        action: "AFFILIATE_PROGRAM_CREATED",
        entityType: "AffiliateProgram",
        entityId: program.id,
        metadata: { byAdmin: true, curated: true, seed: "verified-programs", checkedOn: sources.checkedOn },
      },
    });
    created.push(entry.slug);
  }
  return { created, skipped };
}
