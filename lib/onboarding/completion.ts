/**
 * Profile completion — a weighted score per role, not a count of filled
 * columns: a logo or a real bio matters more to brands and creators than, say,
 * a city. Each check carries the suggestion shown when it is missing. Pure;
 * unit-tested.
 */

export type CompletionCheck = { key: string; weight: number; done: boolean; suggestion: string };
export type Completion = { percent: number; checks: CompletionCheck[]; suggestions: string[] };

type Loose = Record<string, unknown>;

const has = (v: unknown, min = 1) => typeof v === "string" && v.trim().length >= min;
const hasList = (v: unknown) => Array.isArray(v) && v.length > 0;
const anyOf = (...vals: unknown[]) => vals.some((v) => has(v));

function score(checks: CompletionCheck[]): Completion {
  const total = checks.reduce((n, c) => n + c.weight, 0);
  const done = checks.reduce((n, c) => n + (c.done ? c.weight : 0), 0);
  const percent = total ? Math.round((done / total) * 100) : 0;
  const suggestions = checks
    .filter((c) => !c.done)
    .sort((a, b) => b.weight - a.weight)
    .map((c) => c.suggestion);
  return { percent, checks, suggestions };
}

export function brandCompletion(b: Loose): Completion {
  const social = (b.socialLinks && typeof b.socialLinks === "object" ? b.socialLinks : {}) as Loose;
  return score([
    { key: "logo", weight: 15, done: has(b.logoUrl), suggestion: "Upload your brand logo." },
    { key: "description", weight: 15, done: has(b.description, 40), suggestion: "Describe your brand in a few sentences." },
    { key: "website", weight: 10, done: has(b.website), suggestion: "Add your website." },
    { key: "industry", weight: 10, done: has(b.industry), suggestion: "Choose your industry." },
    { key: "productCategories", weight: 10, done: hasList(b.productCategories), suggestion: "Add the product categories you sell." },
    { key: "social", weight: 10, done: anyOf(social.instagram, social.facebook, social.linkedin, social.youtube, social.twitter), suggestion: "Add your social media links." },
    { key: "cover", weight: 5, done: has(b.coverImageUrl), suggestion: "Add a cover image for your brand page." },
    { key: "businessEmail", weight: 5, done: has(b.businessEmail), suggestion: "Add a business email." },
    { key: "contactName", weight: 5, done: has(b.contactName), suggestion: "Add a contact person." },
    { key: "location", weight: 5, done: has(b.city), suggestion: "Add your business location." },
    { key: "targetAudience", weight: 5, done: has(b.targetAudience), suggestion: "Describe your target audience." },
    { key: "collaborationTypes", weight: 5, done: hasList(b.collaborationTypes), suggestion: "Choose the collaboration types you offer." },
  ]);
}

export function creatorCompletion(c: Loose): Completion {
  return score([
    { key: "photo", weight: 15, done: has(c.profileImageUrl), suggestion: "Upload your profile picture." },
    { key: "bio", weight: 15, done: has(c.bio, 40), suggestion: "Complete your bio." },
    { key: "social", weight: 15, done: anyOf(c.instagramUrl, c.youtubeUrl, c.linkedinUrl, c.facebookUrl, c.twitterUrl), suggestion: "Add your social media links." },
    { key: "category", weight: 10, done: has(c.category), suggestion: "Choose your creator category." },
    { key: "contentDescription", weight: 10, done: has(c.contentDescription), suggestion: "Describe the content you make." },
    { key: "identity", weight: 5, done: has(c.displayName) && has(c.username), suggestion: "Add your name and username." },
    { key: "platform", weight: 5, done: has(c.primaryPlatform), suggestion: "Choose your primary platform." },
    { key: "audience", weight: 5, done: has(c.audienceSize), suggestion: "Add your audience size (self-reported)." },
    { key: "language", weight: 5, done: has(c.contentLanguage), suggestion: "Add your content language." },
    { key: "location", weight: 5, done: has(c.city) || has(c.location), suggestion: "Add your location." },
    { key: "collaboration", weight: 5, done: hasList(c.collaborationPreferences), suggestion: "Choose your collaboration preferences." },
    { key: "interests", weight: 5, done: hasList(c.interestedCategories), suggestion: "Pick the brand categories you're interested in." },
  ]);
}

/** `c` merges the customer profile with the account's name and avatar. */
export function customerCompletion(c: Loose): Completion {
  return score([
    { key: "interests", weight: 25, done: hasList(c.interests), suggestion: "Add your interests." },
    { key: "photo", weight: 15, done: has(c.avatarUrl), suggestion: "Upload your profile picture." },
    { key: "location", weight: 15, done: has(c.country) && has(c.city), suggestion: "Add your city." },
    { key: "name", weight: 10, done: has(c.name, 2), suggestion: "Add your full name." },
    { key: "username", weight: 10, done: has(c.username), suggestion: "Choose a username." },
    { key: "bio", weight: 10, done: has(c.bio), suggestion: "Write a short bio." },
    { key: "preferredCategories", weight: 10, done: hasList(c.preferredCategories), suggestion: "Pick your preferred product categories." },
    { key: "favouriteBrands", weight: 5, done: has(c.favouriteBrands), suggestion: "Tell us your favourite brands." },
  ]);
}
