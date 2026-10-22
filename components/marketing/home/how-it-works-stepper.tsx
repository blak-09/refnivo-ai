"use client";

import * as React from "react";
import { BadgeCheckIcon, LinkIcon, MegaphoneIcon, QrCodeIcon, ShieldCheckIcon, TimerIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
  {
    id: "launch",
    icon: MegaphoneIcon,
    title: "Brand launches a campaign",
    body: "Pick a product, set the creator commission and customer reward, and choose the rules: attribution window, approval, budget.",
  },
  {
    id: "share",
    icon: LinkIcon,
    title: "Creator or customer shares",
    body: "Every partner gets a unique link and QR code. Each click is attributed to them — on Instagram, YouTube, WhatsApp or in person.",
  },
  {
    id: "verify",
    icon: BadgeCheckIcon,
    title: "Brand verifies, commission is recorded",
    body: "The brand confirms the order in its store. Only then is the commission or reward added to the ledger both sides can see.",
  },
] as const;

/** Accessible tabs (roving focus, arrow keys) over the three steps, with an example campaign card. */
export function HowItWorksStepper() {
  const [active, setActive] = React.useState(0);
  const tabs = React.useRef<(HTMLButtonElement | null)[]>([]);

  const onKey = (e: React.KeyboardEvent, i: number) => {
    const next = e.key === "ArrowRight" || e.key === "ArrowDown" ? (i + 1) % STEPS.length : e.key === "ArrowLeft" || e.key === "ArrowUp" ? (i - 1 + STEPS.length) % STEPS.length : e.key === "Home" ? 0 : e.key === "End" ? STEPS.length - 1 : null;
    if (next === null) return;
    e.preventDefault();
    setActive(next);
    tabs.current[next]?.focus();
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_1.05fr] lg:gap-12">
      <div role="tablist" aria-label="How Refnivo works" aria-orientation="vertical" className="grid gap-3">
        {STEPS.map((s, i) => {
          const selected = i === active;
          return (
            <button
              key={s.id}
              ref={(el) => {
                tabs.current[i] = el;
              }}
              id={`hiw-tab-${s.id}`}
              role="tab"
              type="button"
              aria-selected={selected}
              aria-controls="hiw-panel"
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(i)}
              onKeyDown={(e) => onKey(e, i)}
              className={cn(
                "group flex w-full items-start gap-4 rounded-2xl border p-5 text-left transition-[background-color,border-color,box-shadow] focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                selected ? "border-primary/30 bg-card shadow-lg shadow-indigo-500/10" : "border-transparent bg-transparent hover:bg-card/70",
              )}
            >
              <span
                className={cn(
                  "flex size-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold tabular-nums transition-colors",
                  selected ? "bg-gradient-brand text-white" : "bg-muted text-muted-foreground group-hover:text-foreground",
                )}
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <span>
                <span className="block text-lg font-semibold tracking-tight">{s.title}</span>
                <span className={cn("mt-1 block text-[15px] leading-6 text-muted-foreground", !selected && "line-clamp-1 sm:line-clamp-none")}>{s.body}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div id="hiw-panel" role="tabpanel" aria-labelledby={`hiw-tab-${STEPS[active].id}`} className="relative">
        <div aria-hidden className="absolute -inset-4 -z-10 rounded-[2rem] bg-linear-to-br from-violet-100/70 to-sky-100/60 blur-2xl dark:from-violet-950/40 dark:to-sky-950/30" />
        <ExampleCampaignCard step={active} />
      </div>
    </div>
  );
}

/** Illustrative campaign: example values, labelled as such. Highlights the part the active step is about. */
function ExampleCampaignCard({ step }: { step: number }) {
  const ring = (i: number) => (step === i ? "ring-2 ring-primary/40 bg-accent/60" : "bg-muted/40");
  return (
    <figure className="overflow-hidden rounded-3xl border bg-card shadow-xl shadow-indigo-500/10" aria-label="Example campaign (illustrative values)">
      <div className="flex items-center justify-between border-b bg-muted/40 px-5 py-3">
        <p className="text-xs font-semibold text-muted-foreground">Example campaign</p>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
          <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden /> Live
        </span>
      </div>
      <div className="space-y-3 p-5 sm:p-6">
        <div className={cn("rounded-2xl p-4 transition-colors", ring(0))}>
          <p className="text-sm font-semibold">Wireless earbuds · Diwali launch</p>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">Creator commission</dt>
              <dd className="font-semibold">10% per verified sale</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Customer reward</dt>
              <dd className="font-semibold">₹100 off</dd>
            </div>
          </dl>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <span className="inline-flex items-center gap-1 rounded-full border bg-background px-2 py-0.5">
              <TimerIcon className="size-3.5 text-primary" aria-hidden /> 30-day attribution
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border bg-background px-2 py-0.5">
              <ShieldCheckIcon className="size-3.5 text-primary" aria-hidden /> Brand approval
            </span>
          </div>
        </div>
        <div className={cn("flex items-center gap-3 rounded-2xl p-4 transition-colors", ring(1))}>
          <span className="flex size-12 shrink-0 items-center justify-center rounded-xl border bg-background">
            <QrCodeIcon className="size-6 text-foreground" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="truncate font-mono text-sm">refnivo.com/r/PRIYA10</p>
            <p className="text-xs text-muted-foreground">142 clicks · 18 orders recorded</p>
          </div>
        </div>
        <div className={cn("rounded-2xl p-4 transition-colors", ring(2))}>
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Order #48213 · ₹2,499</span>
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">Verified</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-sm text-muted-foreground">
            <span>Commission recorded</span>
            <span className="font-semibold text-foreground tabular-nums">₹249.90</span>
          </div>
        </div>
      </div>
      <figcaption className="border-t px-5 py-3 text-xs text-muted-foreground">Illustrative values — not a real campaign.</figcaption>
    </figure>
  );
}
