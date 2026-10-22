import Link from "next/link";
import { CheckIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Marketing building blocks shared by the homepage and the marketing pages.
 * Type scale, eyebrow, gradient and section spacing live in app/globals.css
 * (the "Marketing design system" block); these components only compose them.
 */

/** The one or two highlighted words in a headline. */
export function Emph({ children }: { children: React.ReactNode }) {
  return <span className="text-gradient-brand">{children}</span>;
}

export function SectionHeader({
  id,
  eyebrow,
  title,
  lede,
  align = "left",
  className,
}: {
  id: string;
  eyebrow: string;
  title: React.ReactNode;
  lede?: React.ReactNode;
  align?: "left" | "center";
  className?: string;
}) {
  return (
    <div className={cn(align === "center" ? "mx-auto max-w-3xl text-center" : "max-w-3xl", className)}>
      <p className="eyebrow">{eyebrow}</p>
      <h2 id={id} className="text-headline mt-3 text-foreground">
        {title}
      </h2>
      {lede ? <p className="text-lede mt-4 text-muted-foreground">{lede}</p> : null}
    </div>
  );
}

export function CheckList({ items, className }: { items: readonly string[]; className?: string }) {
  return (
    <ul className={cn("grid gap-3", className)}>
      {items.map((item) => (
        <li key={item} className="flex items-start gap-3 text-[15px] leading-6">
          <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <CheckIcon className="size-3.5" aria-hidden />
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

const STATUS = {
  live: { label: "Live", className: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900", dot: "bg-emerald-500" },
  early: { label: "Early access", className: "bg-accent text-accent-foreground ring-primary/20", dot: "bg-primary" },
  next: { label: "Coming next", className: "bg-muted text-muted-foreground ring-border", dot: "bg-muted-foreground/60" },
} as const;

/** Honest product status: only "Live" means a visitor can use it today. */
export function StatusPill({ status, className }: { status: keyof typeof STATUS; className?: string }) {
  const s = STATUS[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset", s.className, className)}>
      <span className={cn("size-1.5 rounded-full", s.dot)} aria-hidden />
      {s.label}
    </span>
  );
}

/** Primary (brand gradient), ink (dark navy) and outline actions — same height, radius and focus ring everywhere. */
export function ActionLink({
  href,
  children,
  variant = "primary",
  className,
}: {
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "ink" | "outline" | "light" | "ghost-light";
  className?: string;
}) {
  return (
    <Button
      size="lg"
      variant={variant === "outline" ? "outline" : "default"}
      nativeButton={false}
      render={<Link href={href} />}
      className={cn(
        "h-12 rounded-xl px-6 text-[15px] font-semibold transition-[transform,box-shadow,background-color] focus-visible:ring-3 focus-visible:ring-ring/50 active:translate-y-px",
        variant === "primary" && "bg-gradient-brand text-white shadow-md shadow-indigo-500/25 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-indigo-500/30",
        variant === "ink" && "bg-ink text-ink-foreground hover:-translate-y-0.5 hover:bg-ink/90",
        variant === "outline" && "border-border bg-background hover:bg-muted",
        variant === "light" && "bg-white text-ink hover:-translate-y-0.5 hover:bg-white/90",
        variant === "ghost-light" && "border border-white/25 bg-transparent text-white hover:bg-white/10",
        className,
      )}
    >
      {children}
    </Button>
  );
}

/** Big proof number. Label example figures nearby so they are never read as customer results. */
export function StatCard({ value, label, hint, dark = false }: { value: React.ReactNode; label: string; hint?: string; dark?: boolean }) {
  return (
    <div className={cn("rounded-3xl border p-6 sm:p-8", dark ? "border-transparent bg-ink text-ink-foreground" : "bg-card")}>
      <p className={cn("text-5xl font-bold tracking-tight tabular-nums sm:text-6xl", dark ? "text-white" : "text-foreground")}>{value}</p>
      <p className={cn("mt-3 font-semibold", dark ? "text-white" : "text-foreground")}>{label}</p>
      {hint ? <p className={cn("mt-1 text-sm", dark ? "text-white/70" : "text-muted-foreground")}>{hint}</p> : null}
    </div>
  );
}
