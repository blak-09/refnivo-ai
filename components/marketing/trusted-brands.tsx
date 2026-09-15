import Link from "next/link";
import { BrandLogo } from "@/components/products/product-thumb";

export type TrustedBrand = { name: string; slug: string | null; logoUrl: string | null };

/**
 * Neutral placeholders shown only when the database has no brands yet.
 * Replace or remove once real brands are onboarded. These are fictional names,
 * never real trademarks.
 */
const FALLBACK_BRANDS: TrustedBrand[] = [
  { name: "Soundwave", slug: null, logoUrl: null },
  { name: "GlowLab", slug: null, logoUrl: null },
  { name: "FitFuel", slug: null, logoUrl: null },
  { name: "Northwind", slug: null, logoUrl: null },
  { name: "Bloom Skincare", slug: null, logoUrl: null },
  { name: "Acme Audio", slug: null, logoUrl: null },
];

/** "Trusted by growing brands" logo strip. Scrolls horizontally on small screens. */
export function TrustedBrands({ brands }: { brands: TrustedBrand[] }) {
  const items = brands.length ? brands : FALLBACK_BRANDS;
  return (
    <section aria-label="Trusted brands" className="border-y bg-background">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <p className="text-center text-xs font-semibold tracking-wider text-muted-foreground uppercase">Trusted by growing brands</p>
        <ul className="mt-5 -mx-4 flex snap-x gap-8 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:justify-center sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden">
          {items.map((b) => {
            const inner = (
              <span className="inline-flex shrink-0 snap-start items-center gap-2 text-base font-semibold text-slate-500 transition-colors hover:text-foreground">
                <BrandLogo src={b.logoUrl} name={b.name} className="size-8 rounded-lg text-xs" />
                <span className="whitespace-nowrap">{b.name}</span>
              </span>
            );
            return <li key={b.name}>{b.slug ? <Link href={`/brands/${b.slug}`}>{inner}</Link> : inner}</li>;
          })}
        </ul>
      </div>
    </section>
  );
}
