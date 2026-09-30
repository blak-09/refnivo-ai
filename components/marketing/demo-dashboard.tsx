import { ArrowUpRightIcon, LinkIcon, MousePointerClickIcon, ShoppingCartIcon, WalletIcon } from "lucide-react";

/*
 * Static illustration of the brand dashboard for the landing hero. Every figure
 * here is invented sample data and the card is labelled "Demo data" — it never
 * reads the database, so it cannot be mistaken for real platform numbers.
 */
const KPIS = [
  { icon: MousePointerClickIcon, label: "Clicks", value: "4,820" },
  { icon: ShoppingCartIcon, label: "Conversions", value: "212" },
  { icon: WalletIcon, label: "Revenue", value: "₹3.4L" },
];

const SERIES = [18, 24, 21, 30, 28, 36, 33, 41, 38, 47, 44, 52];

const PARTNERS = [
  { name: "Creator A", source: "Instagram", conv: 64, pct: 100 },
  { name: "Creator B", source: "YouTube", conv: 41, pct: 64 },
  { name: "Customer referral", source: "WhatsApp", conv: 23, pct: 36 },
];

function Sparkline() {
  const w = 280;
  const h = 72;
  const max = Math.max(...SERIES);
  const pts = SERIES.map((v, i) => [(i / (SERIES.length - 1)) * w, h - (v / max) * (h - 6) - 3] as const);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-18 w-full" preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id="demo-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="rgb(99 102 241)" stopOpacity="0.28" />
          <stop offset="100%" stopColor="rgb(99 102 241)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line} L${w},${h} L0,${h} Z`} fill="url(#demo-fill)" />
      <path d={line} fill="none" stroke="rgb(99 102 241)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function DemoDashboard() {
  return (
    <figure className="relative mx-auto w-full max-w-lg" aria-label="Illustrative dashboard preview with demo data">
      <div aria-hidden className="absolute -inset-4 -z-10 rounded-[2rem] bg-linear-to-br from-violet-200/50 via-indigo-100/40 to-sky-100/50 blur-2xl dark:from-violet-900/30 dark:via-indigo-900/20 dark:to-sky-900/20" />
      <div className="overflow-hidden rounded-2xl border bg-card shadow-xl shadow-indigo-500/10">
        <div className="flex items-center justify-between gap-2 border-b bg-muted/40 px-4 py-2.5">
          <div className="flex items-center gap-1.5" aria-hidden>
            <span className="size-2.5 rounded-full bg-rose-300" />
            <span className="size-2.5 rounded-full bg-amber-300" />
            <span className="size-2.5 rounded-full bg-emerald-300" />
          </div>
          <p className="truncate text-xs font-medium text-muted-foreground">Brand dashboard · Last 30 days</p>
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold tracking-wide text-amber-800 uppercase dark:bg-amber-900/40 dark:text-amber-200">
            Demo data
          </span>
        </div>

        <div className="space-y-4 p-4 sm:p-5">
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {KPIS.map((k) => (
              <div key={k.label} className="rounded-xl border bg-background p-2.5 sm:p-3">
                <k.icon className="size-4 text-indigo-600" aria-hidden />
                <p className="mt-1.5 text-base font-bold tracking-tight tabular-nums sm:text-lg">{k.value}</p>
                <p className="text-[11px] text-muted-foreground">{k.label}</p>
              </div>
            ))}
          </div>

          <div className="rounded-xl border bg-background p-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium">Verified conversions</span>
              <span className="inline-flex items-center gap-0.5 font-semibold text-emerald-600">
                <ArrowUpRightIcon className="size-3.5" aria-hidden /> trending up
              </span>
            </div>
            <Sparkline />
          </div>

          <div className="rounded-xl border bg-background p-3">
            <p className="text-xs font-medium">Top partners</p>
            <ul className="mt-2 space-y-2">
              {PARTNERS.map((p) => (
                <li key={p.name} className="text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex min-w-0 items-center gap-1.5">
                      <LinkIcon className="size-3 shrink-0 text-muted-foreground" aria-hidden />
                      <span className="truncate font-medium">{p.name}</span>
                      <span className="hidden text-muted-foreground sm:inline">· {p.source}</span>
                    </span>
                    <span className="tabular-nums text-muted-foreground">{p.conv} conv.</span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-muted">
                    <div className="h-1.5 rounded-full bg-linear-to-r from-violet-500 to-blue-500" style={{ width: `${p.pct}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
      <figcaption className="mt-3 text-center text-xs text-muted-foreground">Illustration with demo data — not real Refnivo figures.</figcaption>
    </figure>
  );
}
