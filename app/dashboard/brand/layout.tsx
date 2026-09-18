import { logoutAction } from "@/app/actions/auth";
import { DashboardShell } from "@/components/dashboard/shell";
import { countUnread } from "@/lib/services/notify";
import { requireBrand } from "@/lib/auth/guards";

export default async function BrandLayout({ children }: { children: React.ReactNode }) {
  const { user, brand } = await requireBrand();
  const unreadNotifications = await countUnread(user.id);
  return (
    <DashboardShell
      navKey="brand"
      roleLabel="Brand owner"
      workspaceName={brand.name}
      workspaceSubtitle={brand.industry ?? "Brand"}
      user={{ name: user.name, email: user.email, avatarUrl: user.avatarUrl }}
      unreadNotifications={unreadNotifications}
      onLogout={logoutAction}
    >
      {children}
    </DashboardShell>
  );
}
