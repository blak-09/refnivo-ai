import Link from "next/link";
import { Button } from "@/components/ui/button";
import { HeaderLogo } from "@/components/brand/logo";
import { MobileNav, type NavLink } from "@/components/marketing/mobile-nav";
import { getCurrentUser } from "@/lib/auth/guards";
import { roleHome } from "@/lib/auth/roles";

/** Four destinations only (docs/REDESIGN_PLAN.md U1); everything else is in the footer and the mobile menu. */
const links: NavLink[] = [
  { href: "/#brands", label: "For Brands" },
  { href: "/#creators", label: "For Creators" },
  { href: "/campaigns", label: "Explore Campaigns" },
  { href: "/pricing", label: "Pricing" },
];

/** Secondary pages, listed under "More" in the mobile menu. */
const more: NavLink[] = [
  { href: "/how-it-works", label: "How it works" },
  { href: "/products", label: "Discover products" },
  { href: "/brands", label: "Brand directory" },
  { href: "/creators", label: "Creator directory" },
  { href: "/community", label: "Community" },
  { href: "/contact", label: "Contact" },
];

const linkClass =
  "rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors hover:bg-accent hover:text-foreground";

export async function SiteHeader() {
  const user = await getCurrentUser();
  const dashboardHref = user ? roleHome(user.role) : "/auth/login";
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 shadow-[0_1px_0_0_rgba(15,23,42,0.03)] backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6">
        <HeaderLogo />

        <nav className="mx-auto hidden items-center gap-0.5 lg:flex" aria-label="Main">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className={linkClass}>
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-2 whitespace-nowrap lg:ml-0">
          {user ? (
            <Button size="sm" className="rounded-lg sm:h-9 sm:px-4" nativeButton={false} render={<Link href={dashboardHref} />}>
              Dashboard
            </Button>
          ) : (
            <>
              <Button variant="ghost" className="hidden rounded-lg sm:inline-flex" nativeButton={false} render={<Link href="/auth/login" />}>
                Log in
              </Button>
              <Button size="sm" className="bg-gradient-brand rounded-lg font-semibold text-white shadow-sm shadow-primary/25 hover:opacity-95 sm:h-9 sm:px-4" nativeButton={false} render={<Link href="/get-started" />}>
                Get Started
              </Button>
            </>
          )}
          <MobileNav links={links} resources={more} resourcesLabel="More" signedIn={!!user} dashboardHref={dashboardHref} />
        </div>
      </div>
    </header>
  );
}
