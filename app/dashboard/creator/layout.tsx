import { logoutAction } from "@/app/actions/auth";
import { DashboardShell } from "@/components/dashboard/shell";
import { requireCreator } from "@/lib/auth/guards";

export default async function CreatorLayout({ children }: { children: React.ReactNode }) {
  const { user, profile } = await requireCreator();
  return (
    <DashboardShell
      navKey="creator"
      roleLabel="Creator"
      workspaceName={profile.displayName}
      workspaceSubtitle={`@${profile.username}`}
      user={{ name: user.name, email: user.email }}
      onLogout={logoutAction}
    >
      {children}
    </DashboardShell>
  );
}
