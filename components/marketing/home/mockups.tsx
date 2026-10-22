import { ArrowUpRightIcon, CheckIcon, CircleDollarSignIcon, ClockIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/*
 * Product mockups built in code (no screenshots, no stock images). Every figure
 * is invented sample data and each mockup is captioned "Example", so nothing
 * here can be read as real platform or customer numbers.
 */

function Window({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("overflow-hidden rounded-2xl border bg-card shadow-xl shadow-indigo-500/10", className)}>
      <div className="flex items-center gap-2 border-b bg-muted/40 px-4 py-2.5">
        <span className="flex gap-1.5" aria-hidden>
          <span className="size-2.5 rounded-full bg-rose-300" />
          <span className="size-2.5 rounded-full bg-amber-300" />
          <span className="size-2.5 rounded-full bg-emerald-300" />
        </span>
        <p className="truncate text-xs font-medium text-muted-foreground">{title}</p>
      </div>
      {children}
    </div>
  );
}

const LEDGER = [
  { who: "Priya · Instagram", order: "₹2,499", amount: "₹249.90", status: "Approved" },
  { who: "Rahul · YouTube", order: "₹1,799", amount: "₹179.90", status: "Pending" },
  { who: "Customer referral", order: "₹999", amount: "₹100.00", status: "Paid" },
  { who: "Ananya · WhatsApp", order: "₹3,299", amount: "₹329.90", status: "Approved" },
] as const;

const STATUS_STYLE: Record<string, string> = {
  Approved: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  Pending: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  Paid: "bg-accent text-accent-foreground",
};

function Ledger({ rows }: { rows: readonly (typeof LEDGER)[number][] }) {
  return (
    <div className="rounded-xl border bg-background">
      <p className="border-b px-3 py-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Commission ledger</p>
      <ul className="divide-y">
        {rows.map((r) => (
          <li key={r.who} className="flex items-center gap-3 px-3 py-2 text-sm">
            <span className="min-w-0 flex-1 truncate">{r.who}</span>
            <span className="hidden text-xs text-muted-foreground tabular-nums sm:inline">{r.order}</span>
            <span className="font-semibold tabular-nums">{r.amount}</span>
            <span className={cn("w-[4.75rem] rounded-full px-2 py-0.5 text-center text-[11px] font-semibold", STATUS_STYLE[r.status])}>{r.status}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** For brands: the multi-step campaign builder. */
export function BrandMockup() {
  const steps = ["Product", "Rewards", "Rules", "Review"];
  return (
    <Window title="New campaign · Example">
      <div className="p-5 sm:p-6">
        <ol className="flex items-center gap-2 text-xs font-medium" aria-label="Campaign builder steps">
          {steps.map((s, i) => (
            <li key={s} className="flex flex-1 items-center gap-2">
              <span className={cn("flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold", i < 2 ? "bg-gradient-brand text-white" : i === 2 ? "border-2 border-primary text-primary" : "bg-muted text-muted-foreground")}>
                {i < 2 ? <CheckIcon className="size-3.5" aria-hidden /> : i + 1}
              </span>
              <span className={cn("hidden sm:inline", i === 2 ? "text-foreground" : "text-muted-foreground")}>{s}</span>
              {i < steps.length - 1 ? <span className="h-px flex-1 bg-border" aria-hidden /> : null}
            </li>
          ))}
        </ol>
        <div className="mt-5 space-y-3">
          {[
            ["Attribution window", "30 days"],
            ["Creator approval", "Brand approves each creator"],
            ["Campaign budget", "₹50,000"],
          ].map(([k, v]) => (
            <div key={k} className="flex items-center justify-between rounded-xl border bg-background px-4 py-3 text-sm">
              <span className="text-muted-foreground">{k}</span>
              <span className="font-semibold">{v}</span>
            </div>
          ))}
          <div className="rounded-xl border border-dashed bg-muted/40 px-4 py-3 text-sm">
            <p className="font-medium">3 creator applications waiting</p>
            <div className="mt-2 flex -space-x-2" aria-hidden>
              {["bg-violet-400", "bg-sky-400", "bg-indigo-400"].map((c) => (
                <span key={c} className={cn("size-7 rounded-full border-2 border-card", c)} />
              ))}
            </div>
          </div>
        </div>
        <div className="mt-5 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">Commission is recorded only after you verify an order.</p>
          <span className="rounded-lg bg-gradient-brand px-3 py-1.5 text-xs font-semibold text-white">Continue</span>
        </div>
      </div>
    </Window>
  );
}

/** For creators & customers: earnings by status plus a joined campaign. */
export function CreatorMockup() {
  const buckets = [
    { icon: ClockIcon, label: "Pending", value: "₹4,180", tone: "text-amber-600" },
    { icon: CheckIcon, label: "Approved", value: "₹12,640", tone: "text-emerald-600" },
    { icon: CircleDollarSignIcon, label: "Paid", value: "₹38,900", tone: "text-primary" },
  ];
  return (
    <Window title="Earnings · Example">
      <div className="space-y-4 p-5 sm:p-6">
        <div className="grid grid-cols-3 gap-2">
          {buckets.map((b) => (
            <div key={b.label} className="rounded-xl border bg-background p-3">
              <b.icon className={cn("size-4", b.tone)} aria-hidden />
              <p className="mt-1.5 text-base font-bold tabular-nums sm:text-lg">{b.value}</p>
              <p className="text-[11px] text-muted-foreground">{b.label}</p>
            </div>
          ))}
        </div>
        <Ledger rows={LEDGER} />
        <div className="flex items-center justify-between rounded-xl bg-ink px-4 py-3 text-sm text-ink-foreground">
          <span>
            <span className="block font-semibold">Skincare starter kit</span>
            <span className="text-xs text-white/70">12% per verified sale · joined</span>
          </span>
          <ArrowUpRightIcon className="size-4 text-white/70" aria-hidden />
        </div>
      </div>
    </Window>
  );
}
