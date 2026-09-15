/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { BarChart3Icon, LinkIcon, QrCodeIcon, Share2Icon, TagIcon } from "lucide-react";
import { BrandLogo, ProductThumb } from "@/components/products/product-thumb";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

export type ShowcaseCreator = { name: string; imageUrl: string | null };

export type ProductShowcaseProps = {
  product: { name: string; imageUrl: string | null; price: number; currency: string } | null;
  brand: { name: string; logoUrl: string | null } | null;
  /** e.g. "12% commission" — derived from the featured campaign. */
  commissionLabel: string | null;
  creators: ShowcaseCreator[];
  /** Real QR image (data URL) or null for an icon placeholder. */
  qrDataUrl: string | null;
  href: string;
};

/** Round creator avatar with a white ring — floats around the product card. */
export function FloatingProfile({ creator, className }: { creator: ShowcaseCreator; className?: string }) {
  const initials = creator.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <div
      className={cn(
        "flex size-14 items-center justify-center overflow-hidden rounded-full bg-linear-to-br from-violet-100 to-blue-100 text-sm font-semibold text-indigo-700 ring-4 ring-white shadow-lg shadow-indigo-500/15",
        className,
      )}
      title={creator.name}
    >
      {creator.imageUrl ? <img src={creator.imageUrl} alt={creator.name} className="size-full object-cover" loading="lazy" /> : initials}
    </div>
  );
}

function FloatingChip({ icon: Icon, className }: { icon: typeof LinkIcon; className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "hidden size-10 items-center justify-center rounded-xl border border-indigo-100 bg-white text-indigo-600 shadow-md shadow-indigo-500/10 sm:flex",
        className,
      )}
    >
      <Icon className="size-4" />
    </div>
  );
}

/**
 * Hero visual: featured product card surrounded by creators, a referral QR,
 * a commission badge and small referral/analytics chips. Everything is real
 * data when available; falls back to neutral placeholders.
 */
export function ProductShowcase({ product, brand, commissionLabel, creators, qrDataUrl, href }: ProductShowcaseProps) {
  const [c1, c2] = creators;
  return (
    <div className="relative mx-auto aspect-square w-full max-w-md select-none lg:mr-0 lg:ml-auto">
      {/* Soft background shapes */}
      <div aria-hidden className="pointer-events-none absolute -top-6 -right-6 size-56 rounded-full bg-violet-300/30 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-8 -left-8 size-56 rounded-full bg-blue-300/30 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute inset-[12%] rounded-[2rem] bg-linear-to-br from-violet-100/70 via-white to-blue-100/70" />

      {/* Referral connection lines (decorative) */}
      <svg aria-hidden className="pointer-events-none absolute inset-0 hidden size-full text-indigo-300 sm:block" viewBox="0 0 400 400" fill="none">
        <path d="M78 96 C 130 96, 150 150, 190 165" stroke="currentColor" strokeWidth="2" strokeDasharray="5 6" />
        <path d="M322 300 C 280 300, 260 250, 220 236" stroke="currentColor" strokeWidth="2" strokeDasharray="5 6" />
        <path d="M110 300 C 150 300, 160 250, 190 236" stroke="currentColor" strokeWidth="2" strokeDasharray="5 6" />
      </svg>

      {/* Featured product card */}
      <Link
        href={href}
        className="absolute top-1/2 left-1/2 w-[62%] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-indigo-100 bg-white p-3 shadow-xl shadow-indigo-500/15 transition-transform hover:-translate-y-[52%]"
      >
        <ProductThumb src={product?.imageUrl} name={product?.name ?? "Featured product"} className="aspect-square w-full rounded-xl border-0 bg-linear-to-br from-slate-50 to-indigo-50" />
        <div className="mt-3 flex items-center gap-2">
          {brand ? <BrandLogo src={brand.logoUrl} name={brand.name} className="size-6 text-[10px]" /> : null}
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">{product?.name ?? "Your featured product"}</p>
            <p className="truncate text-xs text-muted-foreground">
              {brand?.name ?? "Your brand"}
              {product ? ` · ${formatMoney(product.price, product.currency)}` : ""}
            </p>
          </div>
        </div>
      </Link>

      {/* Commission badge */}
      <div className="absolute top-[9%] right-[6%] inline-flex items-center gap-1.5 rounded-full bg-linear-to-r from-violet-600 to-blue-500 px-3 py-1.5 text-xs font-semibold text-white shadow-lg shadow-indigo-500/25">
        <TagIcon className="size-3.5" aria-hidden />
        {commissionLabel ?? "Earn commission"}
      </div>

      {/* Creators */}
      {c1 ? <FloatingProfile creator={c1} className="absolute top-[14%] left-[8%]" /> : null}
      {c2 ? <FloatingProfile creator={c2} className="absolute right-[6%] bottom-[16%]" /> : null}

      {/* Referral QR card */}
      <div className="absolute bottom-[3%] left-[1%] flex items-center gap-2 rounded-xl border border-indigo-100 bg-white p-2 shadow-lg shadow-indigo-500/15">
        {qrDataUrl ? (
          <img src={qrDataUrl} alt="Referral QR code" className="size-16 rounded-md" />
        ) : (
          <div className="flex size-16 items-center justify-center rounded-md bg-muted text-muted-foreground">
            <QrCodeIcon className="size-8" aria-hidden />
          </div>
        )}
        <div className="pr-1">
          <p className="text-[11px] font-semibold text-foreground">Scan to shop</p>
          <p className="text-[10px] text-muted-foreground">Referral tracked</p>
        </div>
      </div>

      {/* Floating referral / analytics chips */}
      <FloatingChip icon={LinkIcon} className="absolute top-[46%] left-[2%]" />
      <FloatingChip icon={Share2Icon} className="absolute top-[38%] right-[3%]" />
      <FloatingChip icon={BarChart3Icon} className="absolute right-[26%] bottom-[2%]" />
    </div>
  );
}
