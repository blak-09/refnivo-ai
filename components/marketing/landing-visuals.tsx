import Link from "next/link";
import { CheckIcon, ChevronRightIcon, RocketIcon, SearchIcon, type LucideIcon } from "lucide-react";
import { BrandLogo } from "@/components/products/product-thumb";
import { ProgramTypeBadge } from "@/components/affiliate/program-badge";
import { CTAButton } from "@/components/marketing/cta-button";
import { cn } from "@/lib/utils";

/** Two-column landing block: copy + checklist on one side, a product visual on the other. */
export function SplitSection({
  id,
  icon: Icon,
  eyebrow,
  title,
  body,
  points,
  cta,
  visual,
  reverse = false,
  tinted = false,
}: {
  id: string;
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  body: string;
  points: string[];
  cta: { href: string; label: string };
  visual: React.ReactNode;
  reverse?: boolean;
  tinted?: boolean;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-heading`} className={cn("scroll-mt-20 py-20 sm:py-24", tinted && "bg-muted/30")}>
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:gap-16">
        <div className={cn(reverse && "lg:order-2")}>
          <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-600 dark:text-indigo-400">
            <Icon className="size-4" aria-hidden />
            {eyebrow}
          </p>
          <h2 id={`${id}-heading`} className="mt-2 text-3xl font-bold tracking-tight text-balance sm:text-4xl">
            {title}
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">{body}</p>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            {points.map((p) => (
              <li key={p} className="flex items-start gap-2.5 text-sm font-medium">
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                  <CheckIcon className="size-3" aria-hidden />
                </span>
                {p}
              </li>
            ))}
          </ul>
          <CTAButton href={cta.href} className="mt-8">
            {cta.label}
          </CTAButton>
        </div>
        <div className={cn("relative", reverse && "lg:order-1")}>
          <div aria-hidden className="absolute -inset-6 -z-10 rounded-[2.5rem] bg-linear-to-br from-violet-100/70 to-sky-100/60 blur-2xl dark:from-violet-950/40 dark:to-sky-950/30" />
          {visual}
        </div>
      </div>
    </section>
  );
}

/** Window chrome shared by the visuals so they read as product screenshots. */
function Frame({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border bg-card shadow-xl shadow-indigo-500/10">
      <div className="grid grid-cols-[3rem_1fr_3rem] items-center gap-2 border-b bg-muted/40 px-4 py-2.5">
        <div className="flex items-center gap-1.5" aria-hidden>
          <span className="size-2.5 rounded-full bg-rose-300" />
          <span className="size-2.5 rounded-full bg-amber-300" />
          <span className="size-2.5 rounded-full bg-emerald-300" />
        </div>
        <p className="truncate text-center text-xs font-medium text-muted-foreground">{title}</p>
      </div>
      {children}
    </div>
  );
}

const BUILDER_STEPS = [
  { label: "Product", value: "Wireless earbuds" },
  { label: "Creator commission", value: "10% per verified sale" },
  { label: "Customer reward", value: "₹100 off" },
  { label: "Rules", value: "30-day attribution · brand approval" },
];

/** Brand visual: the campaign builder's review step (illustrative settings, not metrics). */
export function CampaignBuilderVisual() {
  return (
    <Frame title="New campaign · Review">
      <div className="p-5 sm:p-6">
        <ol className="space-y-3">
          {BUILDER_STEPS.map((s, i) => (
            <li key={s.label} className="flex items-center gap-3 rounded-xl border bg-background px-4 py-3">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">
                <CheckIcon className="size-3.5" aria-hidden />
                <span className="sr-only">Step {i + 1} done</span>
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{s.label}</p>
                <p className="truncate text-sm font-semibold">{s.value}</p>
              </div>
            </li>
          ))}
        </ol>
        <div className="mt-5 flex items-center justify-between gap-3 border-t pt-4">
          <p className="text-xs text-muted-foreground">Commissions are recorded only after you verify an order.</p>
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-linear-to-r from-violet-600 to-blue-500 px-3 py-2 text-xs font-semibold text-white shadow-md shadow-indigo-500/25">
            <RocketIcon className="size-3.5" aria-hidden /> Launch Campaign
          </span>
        </div>
      </div>
    </Frame>
  );
}

export type ProgramRow = { key: string; name: string; logoUrl: string | null; detail: string; type: "REFNIVO" | "EXTERNAL"; href: string };

/** Creator visual: a live slice of the programme directory (real listings). */
export function ProgramListVisual({ rows }: { rows: ProgramRow[] }) {
  return (
    <Frame title="Find Brands to Promote">
      <div className="p-5 sm:p-6">
        <div className="flex items-center gap-2 rounded-xl border bg-background px-3 py-2.5 text-sm text-muted-foreground">
          <SearchIcon className="size-4" aria-hidden />
          Search brands, products or categories…
        </div>
        {rows.length ? (
          <ul className="mt-4 divide-y rounded-xl border bg-background">
            {rows.map((r) => (
              <li key={r.key}>
                <Link href={r.href} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50">
                  <BrandLogo src={r.logoUrl} name={r.name} className="size-10 rounded-lg p-0.5" sizes="40px" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{r.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{r.detail}</p>
                  </div>
                  <ProgramTypeBadge type={r.type} className="hidden sm:inline-flex" />
                  <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Programs appear here as brands list them.</p>
        )}
        <Link href="/affiliate-programs" className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-indigo-600 hover:underline dark:text-indigo-400">
          Browse the full directory <ChevronRightIcon className="size-4" aria-hidden />
        </Link>
      </div>
    </Frame>
  );
}
