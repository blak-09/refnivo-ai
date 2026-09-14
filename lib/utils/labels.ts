export const CAMPAIGN_STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  PENDING_REVIEW: "Pending review",
  ACTIVE: "Active",
  PAUSED: "Paused",
  ENDED: "Ended",
  ARCHIVED: "Archived",
};

export const CAMPAIGN_TYPE_LABEL: Record<string, string> = {
  CREATOR_AFFILIATE: "Creator affiliate",
  CUSTOMER_REFERRAL: "Customer referral",
  HYBRID: "Creators + customers",
};

export const REWARD_TYPE_LABEL: Record<string, string> = {
  FIXED_AMOUNT: "Fixed amount",
  PERCENTAGE: "Percentage of order",
  VOUCHER: "Voucher",
  DISCOUNT: "Discount",
};

export const COMMISSION_TYPE_LABEL: Record<string, string> = {
  FIXED_AMOUNT: "Fixed amount per order",
  PERCENTAGE: "Percentage of order value",
};

export const PRODUCT_STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  ACTIVE: "Active",
  INACTIVE: "Inactive",
  ARCHIVED: "Archived",
};

export const VERIFICATION_LABEL: Record<string, string> = {
  UNVERIFIED: "Unverified",
  PENDING: "Verification pending",
  VERIFIED: "Verified",
  REJECTED: "Verification rejected",
};

export const BRAND_INDUSTRIES = [
  "Consumer electronics",
  "Fashion & apparel",
  "Beauty & personal care",
  "Health & fitness",
  "Food & beverages",
  "Home & kitchen",
  "Baby & kids",
  "Software & apps",
  "Education",
  "Travel",
  "Other",
] as const;

export const PRODUCT_CATEGORIES = [
  "Headphones & audio",
  "Wearables",
  "Mobile accessories",
  "Laptops & computing",
  "Skincare",
  "Haircare",
  "Makeup",
  "Clothing",
  "Footwear",
  "Supplements",
  "Fitness equipment",
  "Kitchen appliances",
  "Home decor",
  "Snacks & beverages",
  "Books & courses",
  "Subscriptions",
  "Other",
] as const;

export const CREATOR_CATEGORIES = [
  "Tech & gadgets",
  "Fashion",
  "Beauty",
  "Fitness",
  "Food",
  "Lifestyle",
  "Gaming",
  "Finance",
  "Education",
  "Travel",
  "Parenting",
  "Comedy & entertainment",
  "Other",
] as const;

export const AUDIENCE_CATEGORIES = [
  "Students",
  "Young professionals",
  "Parents",
  "Gamers",
  "Fitness enthusiasts",
  "Tech enthusiasts",
  "Fashion & beauty",
  "Small business owners",
  "General",
] as const;
