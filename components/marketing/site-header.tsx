import Link from "next/link";
import { SearchIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HeaderLogo } from "@/components/brand/logo";
import { MobileNav, type NavLink } from "@/components/marketing/mobile-nav";
import { getCurrentUser } from "@/lib/auth/guards";
import { roleHome } from "@/lib/auth/roles";

const links: NavLink[] = [
  { href: "/", label: "Home" },
  { href: "/brands", label: "Brands" },
  { href: "/creators", label: "Creators" },
  { href: "/campaigns", label: "Campaigns" },
  { href: "/pricing", label: "Pricing" },
  { href: "/how-it-works", label: "How It Works" },
];

export async function SiteHeader() {
  const user = await getCurrentUser();
  const dashboardHref = user ? roleHome(user.role) : "/auth/login";
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 shadow-[0_1px_0_0_rgba(15,23,42,0.03)] backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
        <HeaderLogo />

        <nav className="mx-auto hidden items-center gap-1 lg:flex" aria-label="Main">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-2 whitespace-nowrap lg:ml-0">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Search campaigns"
            className="text-muted-foreground hover:text-foreground"
            nativeButton={false}
            render={<Link href="/campaigns" />}
          >
            <SearchIcon />
          </Button>
          {user ? (
            <Button className="hidden rounded-lg sm:inline-flex" nativeButton={false} render={<Link href={dashboardHref} />}>
              Go to dashboard
            </Button>
          ) : (
            <>
              <Button variant="outline" className="hidden rounded-lg sm:inline-flex" nativeButton={false} render={<Link href="/auth/login" />}>
                Sign In
              </Button>
              <Button className="hidden rounded-lg sm:inline-flex" nativeButton={false} render={<Link href="/auth/register" />}>
                Sign Up
              </Button>
            </>
          )}
          <MobileNav links={links} signedIn={!!user} dashboardHref={dashboardHref} />
        </div>
      </div>
    </header>
  );
}
