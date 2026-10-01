import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";
import { BrandLogo } from "@/components/products/product-thumb";
import { cn } from "@/lib/utils";

export type LogoItem = { key: string; name: string; logoUrl: string; href: string };

/**
 * Logo strip of brands creators can promote through Refnivo: verified brands
 * running Refnivo campaigns plus brands whose external affiliate programmes are
 * listed in the directory. Real listings with a logo only — no placeholders —
 * and the copy says "promote", not "partners", because external brands are
 * listed for discovery. Two rows drift in opposite directions; both pause on
 * hover and stand still for reduced motion (then scroll by hand).
 */
export function TrustedBrands({ items, total }: { items: LogoItem[]; total: number | null }) {
  if (items.length < 6) return null;
  const half = Math.ceil(items.length / 2);
  const rows = items.length >= 16 ? [items.slice(0, half), items.slice(half)] : [items];

  const chip = (b: LogoItem, hidden: boolean) => (
    <li key={`${hidden ? "b" : "a"}-${b.key}`} aria-hidden={hidden || undefined} className={hidden ? "motion-reduce:hidden" : undefined}>
      <Link
        href={b.href}
        tabIndex={hidden ? -1 : undefined}
        className="group flex h-12 items-center gap-2.5 rounded-full border border-border/70 bg-card py-1.5 pr-4 pl-1.5 shadow-xs transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <BrandLogo src={b.logoUrl} name={b.name} className="size-9 rounded-full border-0 bg-white p-0.5 text-[11px]" sizes="36px" />
        <span className="text-sm font-medium whitespace-nowrap text-foreground/80 group-hover:text-foreground">{b.name}</span>
      </Link>
    </li>
  );

  return (
    <section aria-labelledby="logos-heading" className="border-y bg-muted/30 py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-1 px-4 text-center sm:px-6">
        <p id="logos-heading" className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
          Brands you can promote with Refnivo
        </p>
        {total ? (
          <p className="text-sm text-muted-foreground">
            {total}+ affiliate, creator and referral programs from Indian and global brands ·{" "}
            <Link href="/affiliate-programs" className="inline-flex items-center gap-0.5 font-medium text-indigo-600 hover:underline dark:text-indigo-400">
              Browse all <ArrowRightIcon className="size-3.5" aria-hidden />
            </Link>
          </p>
        ) : null}
      </div>
      <div className="group/marquee mt-6 space-y-3 [mask-image:linear-gradient(to_right,transparent,black_6%,black_94%,transparent)]">
        {rows.map((row, i) => (
          <div key={i} className="overflow-x-auto py-1 [scrollbar-width:none] motion-safe:overflow-hidden [&::-webkit-scrollbar]:hidden">
            <ul
              className={cn(
                "flex w-max gap-3 px-1.5 group-hover/marquee:[animation-play-state:paused]",
                i % 2 ? "motion-safe:animate-marquee-reverse" : "motion-safe:animate-marquee",
              )}
            >
              {row.map((b) => chip(b, false))}
              {row.map((b) => chip(b, true))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
