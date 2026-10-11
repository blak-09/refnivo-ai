import Link from "next/link";
import { BrandLogo } from "@/components/products/product-thumb";
import { cn } from "@/lib/utils";

export type LogoItem = { key: string; name: string; logoUrl: string; href: string };

/**
 * Logo strip of brands creators can promote through Refnivo: verified brands
 * running on Refnivo, with a real logo only — no placeholders. Hidden until
 * there are enough of them to fill a row.
 *
 * Each logo sits beside the brand name. Two rows drift in opposite directions
 * and pause on hover or keyboard focus; with reduced motion they keep moving,
 * but three times slower.
 */
export function TrustedBrands({ items }: { items: LogoItem[] }) {
  if (items.length < 6) return null;
  const half = Math.ceil(items.length / 2);
  const rows = items.length >= 16 ? [items.slice(0, half), items.slice(half)] : [items];

  const tile = (b: LogoItem, hidden: boolean) => (
    <li key={`${hidden ? "b" : "a"}-${b.key}`} aria-hidden={hidden || undefined}>
      <Link
        href={b.href}
        tabIndex={hidden ? -1 : undefined}
        title={b.name}
        className="flex h-16 items-center gap-3 rounded-2xl border border-border/60 bg-white px-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition duration-200 hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none dark:bg-card"
      >
        <BrandLogo src={b.logoUrl} name={b.name} className="size-8 rounded-md border-0 text-[11px]" sizes="32px" />
        <span className="text-[15px] font-semibold tracking-tight whitespace-nowrap text-slate-800 dark:text-slate-100">{b.name}</span>
      </Link>
    </li>
  );

  return (
    <section aria-labelledby="logos-heading" className="border-y bg-slate-50/70 py-12 dark:bg-muted/20">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-2 px-4 text-center sm:px-6">
        <p id="logos-heading" className="text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
          Brands you can promote with Refnivo
        </p>
      </div>
      <div className="group/marquee mt-8 space-y-4 [mask-image:linear-gradient(to_right,transparent,black_7%,black_93%,transparent)]">
        {rows.map((row, i) => (
          <div key={i} className="overflow-hidden py-1">
            <ul
              className={cn(
                "flex w-max gap-4 px-2 group-focus-within/marquee:[animation-play-state:paused] group-hover/marquee:[animation-play-state:paused] motion-reduce:[animation-duration:240s]",
                i % 2 ? "animate-marquee-reverse" : "animate-marquee",
              )}
            >
              {row.map((b) => tile(b, false))}
              {row.map((b) => tile(b, true))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
