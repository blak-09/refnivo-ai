import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand/logo";
import { getCurrentUser } from "@/lib/auth/guards";
import { roleHome } from "@/lib/auth/roles";

const links = [
  { href: "/campaigns", label: "Campaigns" },
  { href: "/products", label: "Products" },
  { href: "/brands", label: "Brands" },
  { href: "/creators", label: "Creators" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/pricing", label: "Pricing" },
];

export async function SiteHeader() {
  const user = await getCurrentUser();
  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Logo />
        <nav className="hidden items-center gap-6 md:flex" aria-label="Main">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          {user ? (
            <Button nativeButton={false} render={<Link href={roleHome(user.role)} />}>Go to dashboard</Button>
          ) : (
            <>
              <Button variant="ghost" nativeButton={false} render={<Link href="/auth/login" />}>
                Log in
              </Button>
              <Button nativeButton={false} render={<Link href="/auth/register?role=BRAND_OWNER" />}>List your brand</Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
