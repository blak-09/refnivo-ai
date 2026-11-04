import { GiftIcon, MegaphoneIcon, StoreIcon } from "lucide-react";
import type { RegistrableRole } from "@/lib/validation/auth";

const ICONS = { BRAND_OWNER: StoreIcon, CREATOR: MegaphoneIcon, CUSTOMER: GiftIcon } as const;

/** Role → icon, resolved inside the component so Server Components can pass just the role. */
export function RoleIcon({ role, className }: { role: RegistrableRole; className?: string }) {
  const Icon = ICONS[role];
  return <Icon className={className} aria-hidden />;
}
