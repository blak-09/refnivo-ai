import Link from "next/link";
import { Logo } from "@/components/brand/logo";

const groups = [
  {
    title: "Product",
    links: [
      { href: "/how-it-works", label: "How it works" },
      { href: "/campaigns", label: "Discover campaigns" },
      { href: "/products", label: "Discover products" },
      { href: "/brands", label: "Discover brands" },
      { href: "/pricing", label: "Pricing" },
    ],
  },
  {
    title: "For Brands",
    links: [
      { href: "/#brands", label: "Affiliate campaigns" },
      { href: "/auth/register?role=BRAND_OWNER", label: "List your brand" },
    ],
  },
  {
    title: "For Creators",
    links: [
      { href: "/#creators", label: "Earn commissions" },
      { href: "/auth/register?role=CREATOR", label: "Join as creator" },
      { href: "/auth/register?role=CUSTOMER", label: "Join as customer" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/about", label: "About" },
      { href: "/contact", label: "Contact" },
      { href: "/privacy", label: "Privacy" },
      { href: "/terms", label: "Terms" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t bg-muted/30">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_repeat(4,1fr)]">
        <div className="space-y-3">
          <Logo />
          <p className="max-w-xs text-sm text-muted-foreground">
            Affiliate and referral infrastructure for product brands, creators and customers. India-first.
          </p>
        </div>
        {groups.map((g) => (
          <div key={g.title}>
            <h3 className="mb-3 text-sm font-semibold">{g.title}</h3>
            <ul className="space-y-2">
              {g.links.map((l) => (
                <li key={l.href + l.label}>
                  <Link href={l.href} className="text-sm text-muted-foreground hover:text-foreground">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-4 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>© {new Date().getFullYear()} Refnivo AI. MVP build.</p>
          <p>Payouts are processed manually by the Refnivo team in this version.</p>
        </div>
      </div>
    </footer>
  );
}
