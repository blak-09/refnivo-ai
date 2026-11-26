import Link from "next/link";
import { ArrowRightIcon, CheckCircle2Icon, CheckIcon, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * Server-only building blocks for the dashboard overviews. Icons are passed as
 * components, so these must stay Server Components (or be used from one).
 */

export type AttentionItem = {
  key: string;
  icon: LucideIcon;
  /** Short sentence with the count already in it, e.g. "3 orders to verify". */
  title: string;
  detail: string;
  href: string;
  cta: string;
  /** "action" = the brand must act; "info" = waiting on someone else. */
  kind?: "action" | "info";
};

/** "Needs your attention": one row per open task, linked to the page where it is handled. */
export function AttentionList({ items }: { items: AttentionItem[] }) {
  return (
    <section aria-labelledby="attention-heading" className="rounded-2xl border bg-card">
      <div className="flex items-center justify-between gap-3 border-b px-4 py-3 sm:px-5">
        <h2 id="attention-heading" className="text-sm font-semibold">
          Needs your attention
        </h2>
        {items.length ? <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground tabular-nums">{items.length}</span> : null}
      </div>
      {items.length ? (
        <ul className="divide-y">
          {items.map((item) => (
            <li key={item.key}>
              <Link href={item.href} className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:-outline-offset-2 sm:px-5">
                <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", item.kind === "info" ? "bg-muted text-muted-foreground" : "bg-warning/15 text-warning-strong")}>
                  <item.icon className="size-4" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{item.title}</span>
                  <span className="block text-xs text-muted-foreground">{item.detail}</span>
                </span>
                <span className="hidden shrink-0 items-center gap-1 text-xs font-medium text-primary sm:inline-flex">
                  {item.cta} <ArrowRightIcon className="size-3 transition-transform group-hover:translate-x-0.5" aria-hidden />
                </span>
                <ArrowRightIcon className="size-4 shrink-0 text-muted-foreground sm:hidden" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground sm:px-5">
          <CheckCircle2Icon className="size-4 text-success" aria-hidden /> You&apos;re all caught up — nothing is waiting for you.
        </p>
      )}
    </section>
  );
}

export type SetupStep = { title: string; description: string; done: boolean; href: string; cta: string };

/** Getting-started checklist. The first unfinished step is the one clear next action. */
export function SetupChecklist({ title, description, steps }: { title: string; description: string; steps: SetupStep[] }) {
  const next = steps.findIndex((s) => !s.done);
  const doneCount = steps.filter((s) => s.done).length;
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <span className="shrink-0 text-xs font-medium text-muted-foreground tabular-nums">
            {doneCount} of {steps.length} done
          </span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label="Setup progress" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={doneCount}>
          <div className="h-full rounded-full bg-gradient-brand" style={{ width: `${(doneCount / steps.length) * 100}%` }} />
        </div>
      </CardHeader>
      <CardContent>
        <ol className="space-y-3">
          {steps.map((step, i) => {
            const isNext = i === next;
            return (
              <li key={step.title} className={cn("flex items-start gap-3 rounded-xl border p-3 sm:items-center", isNext ? "border-primary/30 bg-accent/40" : "border-transparent")}>
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                    step.done ? "bg-success text-white" : isNext ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                  )}
                  aria-hidden
                >
                  {step.done ? <CheckIcon className="size-4" /> : i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className={cn("text-sm font-medium", step.done && "text-muted-foreground line-through decoration-muted-foreground/50")}>
                    {step.title}
                    <span className="sr-only">{step.done ? " (done)" : isNext ? " (next step)" : ""}</span>
                  </p>
                  {!step.done ? <p className="text-xs text-muted-foreground">{step.description}</p> : null}
                  {isNext ? (
                    <Button size="sm" className="mt-2 sm:hidden" nativeButton={false} render={<Link href={step.href} />}>
                      {step.cta}
                    </Button>
                  ) : null}
                </div>
                {isNext ? (
                  <Button size="sm" className="hidden shrink-0 sm:inline-flex" nativeButton={false} render={<Link href={step.href} />}>
                    {step.cta} <ArrowRightIcon aria-hidden />
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}
