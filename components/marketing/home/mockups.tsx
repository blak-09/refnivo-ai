import Image from "next/image";
import { ArrowUpRightIcon, CheckIcon, CircleDollarSignIcon, ClockIcon, PlayIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/*
 * Product mockups built in code (no screenshots). Every figure is invented
 * sample data and each mockup is captioned "Example", so nothing here can be
 * read as real platform or customer numbers. The faces and the UGC reel
 * thumbnails are licensed Pexels stock photos — models, not Refnivo creators.
 */

const APPLICANTS = ["avatar-red-kurta", "avatar-turban", "avatar-studio"] as const;

/** The UGC delivery: 1 vertical video + 3 photos, matching the brief in the mockup. */
const REELS = ["reel-earbud-wear", "reel-unboxing", "reel-outdoor", "reel-hand-case"] as const;

function Window({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("overflow-hidden rounded-2xl border bg-card shadow-xl shadow-primary/10", className)}>
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
  Approved: "bg-success/10 text-success-strong",
  Pending: "bg-warning/10 text-warning-strong",
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
            <div className="mt-2 flex items-center" aria-hidden>
              <span className="flex -space-x-2.5">
                {APPLICANTS.map((a) => (
                  <Image key={a} src={`/images/marketing/avatars/${a}.webp`} alt="" width={36} height={36} className="size-9 rounded-full border-2 border-card object-cover shadow-sm" />
                ))}
              </span>
              <span className="ml-3 text-xs text-muted-foreground">Review and approve</span>
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
    { icon: ClockIcon, label: "Pending", value: "₹4,180", tone: "text-warning" },
    { icon: CheckIcon, label: "Approved", value: "₹12,640", tone: "text-success" },
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

/** UGC: a brief with fixed terms and a delivery waiting for approval. */
export function UgcMockup() {
  return (
    <Window title="UGC brief · Example">
      <div className="space-y-4 p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-semibold tracking-tight">Unboxing reel · wireless earbuds</p>
            <p className="mt-0.5 text-xs text-muted-foreground">1 vertical video (30–45 s) + 3 photos</p>
          </div>
          <span className="shrink-0 rounded-full bg-success/10 px-2.5 py-1 text-[11px] font-semibold text-success-strong">Open</span>
        </div>
        <dl className="grid grid-cols-3 gap-2 text-sm">
          {[
            ["Fee", "₹2,500"],
            ["Creators", "3 of 5"],
            ["Usage", "3 months"],
          ].map(([k, v]) => (
            <div key={k} className="rounded-xl border bg-background p-3">
              <dt className="text-[11px] text-muted-foreground">{k}</dt>
              <dd className="mt-0.5 font-semibold">{v}</dd>
            </div>
          ))}
        </dl>
        <div className="rounded-xl border bg-background p-3">
          <div className="flex items-center gap-2.5">
            <Image src="/images/marketing/avatars/avatar-curls.webp" alt="" width={32} height={32} className="size-8 rounded-full object-cover" />
            <p className="min-w-0 flex-1 truncate text-sm font-medium">Revision 1 delivered</p>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">To review</span>
          </div>
          <div className="mt-3 grid grid-cols-4 gap-1.5" aria-hidden>
            {REELS.map((r, i) => (
              <span key={r} className="relative aspect-[9/16] overflow-hidden rounded-lg bg-muted">
                <Image src={`/images/marketing/reels/${r}.webp`} alt="" fill sizes="96px" className="object-cover" />
                <span className="absolute inset-0 bg-linear-to-t from-black/50 via-transparent to-transparent" />
                {i === 0 ? (
                  <span className="absolute top-1.5 left-1.5 flex size-5 items-center justify-center rounded-full bg-white/90 text-ink shadow-sm">
                    <PlayIcon className="size-2.5 fill-current" />
                  </span>
                ) : null}
                <span className="absolute bottom-1.5 left-1.5 text-[10px] font-semibold text-white">{i === 0 ? "0:32" : `Photo ${i}`}</span>
              </span>
            ))}
          </div>
          <div className="mt-3 flex justify-end gap-2 text-xs font-semibold">
            <span className="rounded-lg border px-3 py-1.5">Request changes</span>
            <span className="rounded-lg bg-gradient-brand px-3 py-1.5 text-white">Approve</span>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">You pay the creator directly after you approve. Refnivo takes no cut.</p>
      </div>
    </Window>
  );
}

const PARTNERS = [
  { avatar: "avatar-saree", name: "Ananya", via: "Campaign + UGC", sales: "38", value: "₹94,620" },
  { avatar: "avatar-yellow-kurta", name: "Rahul", via: "Campaign", sales: "21", value: "₹41,980" },
  { avatar: "avatar-pink", name: "Priya", via: "UGC", sales: "—", value: "2 videos" },
] as const;

/** Partners: every creator the brand works with and what each produced. */
export function PartnersMockup() {
  return (
    <Window title="Partners · Example">
      <div className="space-y-4 p-5 sm:p-6">
        <div className="grid grid-cols-3 gap-2">
          {[
            ["Partners", "24"],
            ["Verified sales", "312"],
            ["Sales value", "₹7.8L"],
          ].map(([k, v]) => (
            <div key={k} className="rounded-xl border bg-background p-3">
              <p className="text-base font-bold tabular-nums sm:text-lg">{v}</p>
              <p className="text-[11px] text-muted-foreground">{k}</p>
            </div>
          ))}
        </div>
        <ul className="divide-y rounded-xl border bg-background">
          {PARTNERS.map((p) => (
            <li key={p.name} className="flex items-center gap-3 px-3 py-2.5 text-sm">
              <Image src={`/images/marketing/avatars/${p.avatar}.webp`} alt="" width={32} height={32} className="size-8 rounded-full object-cover" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{p.name}</span>
                <span className="block truncate text-[11px] text-muted-foreground">{p.via}</span>
              </span>
              <span className="hidden w-10 text-right text-xs text-muted-foreground tabular-nums sm:block">{p.sales}</span>
              <span className="w-20 text-right font-semibold tabular-nums">{p.value}</span>
            </li>
          ))}
        </ul>
        <div className="rounded-xl bg-ink px-4 py-3 text-sm text-ink-foreground">
          <p className="text-[11px] font-semibold tracking-wide text-violet-200 uppercase">Private note</p>
          <p className="mt-1 text-white/85">Replies fast, great on camera. Send the new launch first.</p>
        </div>
      </div>
    </Window>
  );
}
