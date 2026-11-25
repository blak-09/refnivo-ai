"use client";

import * as React from "react";
import { ClapperboardIcon, HeartHandshakeIcon, MegaphoneIcon, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type ProductPanel = {
  /** Also the URL hash that opens this tab (/#affiliate, /#ugc, /#partners). */
  id: "affiliate" | "ugc" | "partners";
  name: string;
  verb: string;
  pay: string;
  /** Server-rendered panel body. */
  content: React.ReactNode;
};

const ICONS: Record<ProductPanel["id"], LucideIcon> = {
  affiliate: MegaphoneIcon,
  ugc: ClapperboardIcon,
  partners: HeartHandshakeIcon,
};

/**
 * The three Refnivo products as accessible tabs (arrow keys, Home/End). All
 * panels are rendered (hidden ones with the `hidden` attribute) so links such
 * as /#ugc keep working: the matching tab opens and scrolls into view.
 */
export function ProductTabs({ panels }: { panels: ProductPanel[] }) {
  const [active, setActive] = React.useState(0);
  const tabs = React.useRef<(HTMLButtonElement | null)[]>([]);
  const root = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const fromHash = () => {
      const i = panels.findIndex((p) => `#${p.id}` === window.location.hash);
      if (i < 0) return;
      setActive(i);
      requestAnimationFrame(() => root.current?.scrollIntoView({ block: "start" }));
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, [panels]);

  const onKey = (e: React.KeyboardEvent, i: number) => {
    const n = panels.length;
    const next = e.key === "ArrowRight" ? (i + 1) % n : e.key === "ArrowLeft" ? (i - 1 + n) % n : e.key === "Home" ? 0 : e.key === "End" ? n - 1 : null;
    if (next === null) return;
    e.preventDefault();
    setActive(next);
    tabs.current[next]?.focus();
  };

  return (
    <div ref={root} className="scroll-mt-24">
      <div role="tablist" aria-label="Refnivo products" className="grid gap-3 sm:grid-cols-3">
        {panels.map((p, i) => {
          const selected = i === active;
          const Icon = ICONS[p.id];
          return (
            <button
              key={p.id}
              ref={(el) => {
                tabs.current[i] = el;
              }}
              id={`product-tab-${p.id}`}
              role="tab"
              type="button"
              aria-selected={selected}
              aria-controls={`product-panel-${p.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(i)}
              onKeyDown={(e) => onKey(e, i)}
              className={cn(
                "flex items-start gap-3 rounded-2xl border p-4 text-left transition-[background-color,border-color,box-shadow] focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none sm:p-5",
                selected ? "border-primary/30 bg-card shadow-lg shadow-primary/10" : "border-border bg-muted/40 hover:bg-card",
              )}
            >
              <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", selected ? "bg-primary text-primary-foreground" : "bg-accent text-primary")}>
                <Icon className="size-5" aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block text-xs font-semibold tracking-wide text-primary uppercase">{p.verb}</span>
                <span className="block font-semibold tracking-tight">{p.name}</span>
                <span className="mt-0.5 block text-sm text-muted-foreground">{p.pay}</span>
              </span>
            </button>
          );
        })}
      </div>
      {panels.map((p, i) => (
        <div
          key={p.id}
          id={`product-panel-${p.id}`}
          role="tabpanel"
          aria-labelledby={`product-tab-${p.id}`}
          hidden={i !== active}
          tabIndex={0}
          className="mt-10 rounded-3xl focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none sm:mt-14"
        >
          {p.content}
        </div>
      ))}
    </div>
  );
}
