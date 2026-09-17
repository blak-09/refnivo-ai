"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BellIcon, LogOutIcon, MenuIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { SidebarLogo } from "@/components/brand/logo";
import { cn } from "@/lib/utils";
import { isDemoAccount } from "@/lib/utils/demo";
import { NAV, type NavItem, type NavKey } from "./nav";

type ShellProps = {
  navKey: NavKey;
  roleLabel: string;
  workspaceName: string;
  workspaceSubtitle?: string;
  user: { name: string; email: string };
  /** Unread in-app notifications (server-computed). */
  unreadNotifications?: number;
  onLogout: () => Promise<void>;
  children: React.ReactNode;
};

function isActive(pathname: string, item: NavItem) {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(item.href + "/");
}

function NavList({ nav, onNavigate, unread = 0 }: { nav: NavItem[]; onNavigate?: () => void; unread?: number }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-0.5" aria-label="Dashboard">
      {nav.map((item) => {
        const active = isActive(pathname, item);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
            )}
          >
            <item.icon className="size-4 shrink-0" aria-hidden />
            <span className="truncate">{item.label}</span>
            {item.badge === "notifications" && unread > 0 ? (
              <span className="ml-auto rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold leading-none text-primary-foreground" aria-label={`${unread} unread`}>
                {unread > 99 ? "99+" : unread}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

function SidebarBody({
  navKey,
  workspaceName,
  workspaceSubtitle,
  roleLabel,
  user,
  unreadNotifications = 0,
  onLogout,
  onNavigate,
}: Omit<ShellProps, "children"> & { onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col">
      <div className="px-4 pt-5 pb-4">
        <SidebarLogo />
      </div>
      <div className="mx-3 mb-3 rounded-lg border bg-card px-3 py-2">
        <p className="truncate text-sm font-medium">{workspaceName}</p>
        <p className="truncate text-xs text-muted-foreground">{workspaceSubtitle ?? roleLabel}</p>
      </div>
      <div className="flex-1 overflow-y-auto px-3">
        <NavList nav={NAV[navKey]} onNavigate={onNavigate} unread={unreadNotifications} />
      </div>
      <Separator />
      <div className="flex items-center gap-2 p-3">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary uppercase">
          {user.name.slice(0, 2)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{user.name}</p>
          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
        </div>
        <form action={onLogout}>
          <Button type="submit" variant="ghost" size="icon-sm" aria-label="Log out" title="Log out">
            <LogOutIcon />
          </Button>
        </form>
      </div>
    </div>
  );
}

export function DashboardShell(props: ShellProps) {
  const [open, setOpen] = React.useState(false);
  const { children, ...rest } = props;

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r bg-sidebar lg:block">
        <SidebarBody {...rest} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur lg:hidden">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger
              render={<Button variant="outline" size="icon-sm" aria-label="Open navigation" />}
            >
              <MenuIcon />
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <SidebarBody {...rest} onNavigate={() => setOpen(false)} />
            </SheetContent>
          </Sheet>
          <SidebarLogo compact />
          <Link
            href={`/dashboard/${rest.navKey}/notifications`}
            className="relative ml-auto inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label={rest.unreadNotifications ? `Notifications, ${rest.unreadNotifications} unread` : "Notifications"}
          >
            <BellIcon className="size-4" aria-hidden />
            {rest.unreadNotifications ? <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-primary" aria-hidden /> : null}
          </Link>
        </header>

        {isDemoAccount(rest.user.email) ? (
          <div className="border-b bg-warning/10 px-4 py-1.5 text-center text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Demo data</span> — this account and its metrics were created by the seed script and do not represent real business performance.
          </div>
        ) : null}
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
