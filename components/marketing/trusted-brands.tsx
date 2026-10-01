import Image from "next/image";
import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";
import { BrandLogo } from "@/components/products/product-thumb";
import { BRAND_LOGO_TRIM } from "@/components/marketing/brand-logo-trim";
import { cn } from "@/lib/utils";

export type LogoItem = { key: string; name: string; logoUrl: string; href: string };

/** Trimmed copy of a curated `/brand-logos/<key>.png`, if one was generated. */
function trimmed(logoUrl: string) {
  const key = /^\/brand-logos\/([a-z0-9-]+)\.png$/.exec(logoUrl)?.[1];
  const size = key ? BRAND_LOGO_TRIM[key] : undefined;
  return key && size ? { src: `/brand-logos/trim/${key}.png`, ...size } : null;
}

/**
 * Logo strip of brands creators can promote through Refnivo: verified brands
 * running Refnivo campaigns plus brands whose external affiliate programmes are
 * listed in the directory. Real listings with a logo only — no placeholders —
 * and the copy says "promote", not "partners", because external brands are
 * listed for discovery.
 *
 * Wordmark logos (wider than tall) are shown large on their own; icon-style
 * logos sit beside the brand name, so no name is ever printed twice. Two rows
 * drift in opposite directions and pause on hover or keyboard focus; with
 * reduced motion they keep moving, but three times slower.
 */
export function TrustedBrands({ items, total }: { items: LogoItem[]; total: number | null }) {
  if (items.length < 6) return null;
  const half = Math.ceil(items.length / 2);
  const rows = items.length >= 16 ? [items.slice(0, half), items.slice(half)] : [items];

  const tile = (b: LogoItem, hidden: boolean) => {
    const t = trimmed(b.logoUrl);
    const wordmark = t && t.w / t.h >= 1.8;
    return (
      <li key={`${hidden ? "b" : "a"}-${b.key}`} aria-hidden={hidden || undefined}>
        <Link
          href={b.href}
          tabIndex={hidden ? -1 : undefined}
          title={b.name}
          className="flex h-16 items-center gap-3 rounded-2xl border border-border/60 bg-white px-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition duration-200 hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none dark:bg-card"
        >
          {wordmark ? (
            <>
              <Image src={t.src} alt="" width={t.w} height={t.h} loading="eager" className="h-7 w-auto max-w-[150px] rounded-[4px] object-contain" />
              <span className="sr-only">{b.name}</span>
            </>
          ) : (
            <>
              {t ? (
                <Image src={t.src} alt="" width={t.w} height={t.h} loading="eager" className="h-8 w-auto max-w-[44px] rounded-md object-contain" />
              ) : (
                <BrandLogo src={b.logoUrl} name={b.name} className="size-8 rounded-md border-0 text-[11px]" sizes="32px" />
              )}
              <span className="text-[15px] font-semibold tracking-tight whitespace-nowrap text-slate-800 dark:text-slate-100">{b.name}</span>
            </>
          )}
        </Link>
      </li>
    );
  };

  return (
    <section aria-labelledby="logos-heading" className="border-y bg-slate-50/70 py-12 dark:bg-muted/20">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-2 px-4 text-center sm:px-6">
        <p id="logos-heading" className="text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
          Brands you can promote with Refnivo
        </p>
        {total ? (
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground tabular-nums">{total}+</span> affiliate, creator and referral programs from Indian and global brands
            <span aria-hidden> · </span>
            <Link href="/affiliate-programs" className="inline-flex items-center gap-0.5 font-medium text-indigo-600 hover:underline dark:text-indigo-400">
              Browse all <ArrowRightIcon className="size-3.5" aria-hidden />
            </Link>
          </p>
        ) : null}
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
