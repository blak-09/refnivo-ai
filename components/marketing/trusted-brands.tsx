import Link from "next/link";
import { BrandLogo } from "@/components/products/product-thumb";

export type LogoItem = { key: string; name: string; logoUrl: string; href: string };

/**
 * Logo strip of brands creators can promote through Refnivo: brands running
 * Refnivo campaigns plus brands whose external affiliate programmes are listed
 * in the directory. Real listings with a logo only — no placeholders — and the
 * copy says "promote", not "partners", because external brands are listed for
 * discovery. Scrolls slowly; stops for reduced motion (then scrolls by hand).
 */
export function TrustedBrands({ items }: { items: LogoItem[] }) {
  if (items.length < 4) return null;
  const row = (hidden: boolean) =>
    items.map((b) => (
      <li key={`${hidden ? "b" : "a"}-${b.key}`} aria-hidden={hidden || undefined} className={hidden ? "motion-reduce:hidden" : undefined}>
        <Link
          href={b.href}
          tabIndex={hidden ? -1 : undefined}
          className="group flex h-14 items-center gap-2.5 rounded-xl px-3 opacity-70 grayscale transition hover:opacity-100 hover:grayscale-0 focus-visible:opacity-100 focus-visible:grayscale-0"
        >
          <BrandLogo src={b.logoUrl} name={b.name} className="size-9 rounded-lg border-border/60 p-0.5" sizes="36px" />
          <span className="text-sm font-semibold whitespace-nowrap text-slate-600 group-hover:text-foreground dark:text-slate-300">{b.name}</span>
        </Link>
      </li>
    ));

  return (
    <section aria-labelledby="logos-heading" className="border-y bg-muted/30">
      <div className="mx-auto max-w-6xl px-4 pt-8 sm:px-6">
        <p id="logos-heading" className="text-center text-xs font-semibold tracking-wider text-muted-foreground uppercase">
          Brands you can promote with Refnivo
        </p>
      </div>
      <div className="group/marquee relative mt-4 overflow-x-auto pb-8 [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)] [scrollbar-width:none] motion-safe:overflow-hidden [&::-webkit-scrollbar]:hidden">
        <ul className="flex w-max gap-2 motion-safe:animate-marquee group-hover/marquee:[animation-play-state:paused]">
          {row(false)}
          {row(true)}
        </ul>
      </div>
    </section>
  );
}
