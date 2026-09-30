import Link from "next/link";
import { RANGE_OPTIONS } from "@/lib/services/metrics";
import { cn } from "@/lib/utils";

/**
 * Date-range switcher for analytics pages (Today / 7 / 30 / 90 days). Plain
 * links, so the page stays server-rendered and the range survives refresh.
 */
export function RangeTabs({ basePath, days, extra = {} }: { basePath: string; days: number; extra?: Record<string, string | undefined> }) {
  const href = (value: string) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(extra)) if (v) p.set(k, v);
    p.set("range", value);
    return `${basePath}?${p}`;
  };
  return (
    <div className="inline-flex rounded-lg border bg-card p-0.5" role="tablist" aria-label="Date range">
      {RANGE_OPTIONS.map((o) => {
        const active = Number(o.value) === days;
        return (
          <Link
            key={o.value}
            href={href(o.value)}
            role="tab"
            aria-selected={active}
            scroll={false}
            className={cn("rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors", active ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
          >
            {o.label}
          </Link>
        );
      })}
    </div>
  );
}
