import {
  BarChart3Icon,
  CompassIcon,
  GiftIcon,
  LayoutDashboardIcon,
  LinkIcon,
  MegaphoneIcon,
  PackageIcon,
  ReceiptIcon,
  SettingsIcon,
  ShoppingCartIcon,
  StoreIcon,
  UserCircleIcon,
  UsersIcon,
  WalletIcon,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon; exact?: boolean };
export type NavKey = "brand" | "creator" | "customer" | "admin";

/**
 * Sidebar navigation per role. Lives in a client module because icon
 * components cannot be passed from Server Components to Client Components.
 */
export const NAV: Record<NavKey, NavItem[]> = {
  brand: [
    { href: "/dashboard/brand", label: "Overview", icon: LayoutDashboardIcon, exact: true },
    { href: "/dashboard/brand/products", label: "Products", icon: PackageIcon },
    { href: "/dashboard/brand/campaigns", label: "Campaigns", icon: MegaphoneIcon },
    { href: "/creators", label: "Discover Creators", icon: CompassIcon },
    { href: "/dashboard/brand/creators", label: "Applications", icon: UsersIcon },
    { href: "/dashboard/brand/orders", label: "Orders & Conversions", icon: ShoppingCartIcon },
    { href: "/dashboard/brand/payouts", label: "Commissions & Rewards", icon: WalletIcon },
    { href: "/dashboard/brand/analytics", label: "Analytics", icon: BarChart3Icon },
    { href: "/dashboard/brand/profile", label: "Brand Profile", icon: StoreIcon },
    { href: "/dashboard/brand/settings", label: "Settings", icon: SettingsIcon },
  ],
  creator: [
    { href: "/dashboard/creator", label: "Overview", icon: LayoutDashboardIcon, exact: true },
    { href: "/campaigns", label: "Discover Campaigns", icon: CompassIcon },
    { href: "/dashboard/creator/campaigns", label: "My Applications", icon: MegaphoneIcon },
    { href: "/dashboard/creator/links", label: "Referral Links & QR", icon: LinkIcon },
    { href: "/dashboard/creator/conversions", label: "Conversions", icon: ReceiptIcon },
    { href: "/dashboard/creator/earnings", label: "Earnings", icon: WalletIcon },
    { href: "/dashboard/creator/profile", label: "Profile", icon: UserCircleIcon },
    { href: "/dashboard/creator/settings", label: "Settings", icon: SettingsIcon },
  ],
  customer: [
    { href: "/dashboard/customer", label: "Overview", icon: LayoutDashboardIcon, exact: true },
    { href: "/campaigns", label: "Discover Products", icon: CompassIcon },
    { href: "/dashboard/customer/referrals", label: "My Links", icon: LinkIcon },
    { href: "/dashboard/customer/rewards", label: "Rewards", icon: GiftIcon },
    { href: "/dashboard/customer/settings", label: "Settings", icon: SettingsIcon },
  ],
  admin: [
    { href: "/dashboard/admin", label: "Overview", icon: LayoutDashboardIcon, exact: true },
    { href: "/dashboard/admin/registrations", label: "Registrations", icon: UsersIcon },
    { href: "/dashboard/admin/settings", label: "Settings", icon: SettingsIcon },
  ],
};
