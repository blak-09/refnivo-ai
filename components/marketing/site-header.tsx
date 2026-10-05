import Link from "next/link";
import { ChevronDownIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HeaderLogo } from "@/components/brand/logo";
import { MobileNav, type NavLink } from "@/components/marketing/mobile-nav";
import { getCurrentUser } from "@/lib/auth/guards";
import { roleHome } from "@/lib/auth/roles";

const links: NavLink[] = [
  { href: "/#product", label: "Product" },
  { href: "/#brands", label: "For Brands" },
  { href: "/#creators", label: "For Creators" },
  { href: "/affiliate-programs", label: "Affiliate Programs" },
  { href: "/community", label: "Community" },
];

/** Everything that used to be a top-level link stays one click away under Resources. */
const resources: NavLink[] = [
  { href: "/how-it-works", label: "How It Works" },
  { href: "/campaigns", label: "Refnivo Campaigns" },
  { href: "/brands", label: "Brand Directory" },
  { href: "/creators", label: "Creator Directory" },
  { href: "/pricing", label: "Pricing" },
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
          {/* CSS-only dropdown: opens on hover and on keyboard focus, no client JS. */}
          <div className="group relative">
            <button type="button" className={`${linkClass} inline-flex items-center gap-1`} aria-haspopup="true">
              Resources <ChevronDownIcon className="size-3.5 transition-transform group-focus-within:rotate-180 group-hover:rotate-180" aria-hidden />
            </button>
            <div className="invisible absolute top-full left-1/2 z-50 w-56 -translate-x-1/2 pt-2 opacity-0 transition-opacity group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
              <ul className="rounded-xl border bg-popover p-1.5 shadow-lg">
                {resources.map((r) => (
                  <li key={r.href}>
                    <Link href={r.href} className="block rounded-lg px-3 py-2 text-sm text-foreground hover:bg-accent">
                      {r.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
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
              <Button size="sm" className="rounded-lg sm:h-9 sm:px-4" nativeButton={false} render={<Link href="/auth/register" />}>
                Get Started
              </Button>
            </>
          )}
          <MobileNav links={links} resources={resources} signedIn={!!user} dashboardHref={dashboardHref} />
        </div>
      </div>
    </header>
  );
}
