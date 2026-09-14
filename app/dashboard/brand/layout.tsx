import { logoutAction } from "@/app/actions/auth";
import { DashboardShell } from "@/components/dashboard/shell";
import { requireBrand } from "@/lib/auth/guards";

export default async function BrandLayout({ children }: { children: React.ReactNode }) {
  const { user, brand } = await requireBrand();
  return (
    <DashboardShell
      navKey="brand"
      roleLabel="Brand owner"
      workspaceName={brand.name}
      workspaceSubtitle={brand.industry ?? "Brand"}
      user={{ name: user.name, email: user.email }}
      onLogout={logoutAction}
    >
      {children}
    </DashboardShell>
  );
}
