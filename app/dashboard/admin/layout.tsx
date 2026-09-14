import { logoutAction } from "@/app/actions/auth";
import { DashboardShell } from "@/components/dashboard/shell";
import { requireRole } from "@/lib/auth/guards";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("ADMIN");
  return (
    <DashboardShell
      navKey="admin"
      roleLabel="Admin"
      workspaceName="Refnivo AI"
      workspaceSubtitle="Platform admin"
      user={{ name: user.name, email: user.email }}
      onLogout={logoutAction}
    >
      {children}
    </DashboardShell>
  );
}
