import {
  Share2Icon,
  HandshakeIcon,
  CreditCardIcon,
  ActivityIcon,
  BadgeCheckIcon,
  BarChart3Icon,
  BellIcon,
  CompassIcon,
  GiftIcon,
  LayoutDashboardIcon,
  LinkIcon,
  MegaphoneIcon,
  PackageIcon,
  ReceiptIcon,
  ScrollTextIcon,
  SettingsIcon,
  ShoppingCartIcon,
  StoreIcon,
  UserCircleIcon,
  UsersIcon,
  WalletIcon,
  type LucideIcon,
} from "lucide-react";

export type NavSection = "main" | "manage" | "account";
export type NavItem = { href: string; label: string; icon: LucideIcon; exact?: boolean; badge?: "notifications"; section?: NavSection };

/** Headings shown above each sidebar group (the main group has none). */
export const NAV_SECTION_LABEL: Record<NavSection, string | null> = { main: null, manage: "Manage", account: "Account" };
export type NavKey = "brand" | "creator" | "customer" | "admin";

/**
 * Sidebar navigation per role. Lives in a client module because icon
 * components cannot be passed from Server Components to Client Components.
 */
export const NAV: Record<NavKey, NavItem[]> = {
  brand: [
    { href: "/dashboard/brand", label: "Overview", icon: LayoutDashboardIcon, exact: true },
    { href: "/dashboard/brand/campaigns", label: "Campaigns", icon: MegaphoneIcon },
    { href: "/dashboard/brand/affiliate-programs", label: "Affiliate Programs", icon: StoreIcon },
    { href: "/creators", label: "Creators", icon: CompassIcon },
    { href: "/dashboard/brand/creators", label: "Applications", icon: UsersIcon },
    { href: "/dashboard/brand/connections", label: "Connections", icon: HandshakeIcon },
    { href: "/dashboard/brand/tracking", label: "Tracking", icon: LinkIcon },
    { href: "/dashboard/brand/analytics", label: "Analytics", icon: BarChart3Icon },
    { href: "/dashboard/brand/payouts", label: "Payouts", icon: WalletIcon },
    { href: "/dashboard/brand/products", label: "Products", icon: PackageIcon, section: "manage" },
    { href: "/dashboard/brand/orders", label: "Orders & Conversions", icon: ShoppingCartIcon, section: "manage" },
    { href: "/dashboard/brand/profile", label: "Brand Profile", icon: UserCircleIcon, section: "manage" },
    { href: "/dashboard/brand/billing", label: "Billing & Plan", icon: CreditCardIcon, section: "manage" },
    { href: "/dashboard/brand/notifications", label: "Notifications", icon: BellIcon, badge: "notifications", section: "account" },
    { href: "/dashboard/brand/settings", label: "Settings", icon: SettingsIcon, section: "account" },
  ],
  creator: [
    { href: "/dashboard/creator", label: "Overview", icon: LayoutDashboardIcon, exact: true },
    { href: "/dashboard/creator/discover", label: "Discover Programs", icon: CompassIcon },
    { href: "/dashboard/creator/campaigns", label: "My Campaigns", icon: MegaphoneIcon },
    { href: "/dashboard/creator/connections", label: "Connections", icon: HandshakeIcon },
    { href: "/dashboard/creator/links", label: "Referral Links", icon: LinkIcon },
    { href: "/dashboard/creator/conversions", label: "Conversions", icon: ReceiptIcon },
    { href: "/dashboard/creator/earnings", label: "Earnings & Payouts", icon: WalletIcon },
    { href: "/dashboard/creator/analytics", label: "Analytics", icon: BarChart3Icon },
    { href: "/dashboard/creator/affiliate-links", label: "External Affiliate Links", icon: StoreIcon, section: "manage" },
    { href: "/brands", label: "Brand Directory", icon: StoreIcon, section: "manage" },
    { href: "/dashboard/creator/social", label: "Social Accounts", icon: Share2Icon, section: "manage" },
    { href: "/dashboard/creator/profile", label: "Profile", icon: UserCircleIcon, section: "account" },
    { href: "/dashboard/creator/notifications", label: "Notifications", icon: BellIcon, badge: "notifications", section: "account" },
    { href: "/dashboard/creator/settings", label: "Settings", icon: SettingsIcon, section: "account" },
  ],
  customer: [
    { href: "/dashboard/customer", label: "Overview", icon: LayoutDashboardIcon, exact: true },
    { href: "/campaigns", label: "Discover Products", icon: CompassIcon },
    { href: "/dashboard/customer/referrals", label: "My Links", icon: LinkIcon },
    { href: "/dashboard/customer/rewards", label: "Rewards", icon: GiftIcon },
    { href: "/dashboard/customer/notifications", label: "Notifications", icon: BellIcon, badge: "notifications" },
    { href: "/dashboard/customer/settings", label: "Settings", icon: SettingsIcon },
  ],
  admin: [
    { href: "/dashboard/admin", label: "Overview", icon: LayoutDashboardIcon, exact: true },
    { href: "/dashboard/admin/registrations", label: "Registrations", icon: UsersIcon },
    { href: "/dashboard/admin/users", label: "Users", icon: UserCircleIcon },
    { href: "/dashboard/admin/verification", label: "Verification", icon: BadgeCheckIcon },
    { href: "/dashboard/admin/campaigns", label: "Campaigns", icon: MegaphoneIcon },
    { href: "/dashboard/admin/connections", label: "Connections", icon: HandshakeIcon },
    { href: "/dashboard/admin/affiliate-programs", label: "Affiliate Programs", icon: StoreIcon },
    { href: "/dashboard/admin/conversions", label: "Conversions", icon: ReceiptIcon },
    { href: "/dashboard/admin/payouts", label: "Payouts", icon: WalletIcon },
    { href: "/dashboard/admin/payments", label: "Payments", icon: CreditCardIcon },
    { href: "/dashboard/admin/audit", label: "Audit log", icon: ScrollTextIcon },
    { href: "/dashboard/admin/health", label: "System health", icon: ActivityIcon },
    { href: "/dashboard/admin/notifications", label: "Notifications", icon: BellIcon, badge: "notifications" },
    { href: "/dashboard/admin/settings", label: "Settings", icon: SettingsIcon },
  ],
};
