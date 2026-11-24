import Link from "next/link";
import { CheckIcon, CrownIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { planFor, type PlanFeature } from "@/lib/config/plans";
import { formatMoney } from "@/lib/money";

/** Full-width "this is a Growth feature" panel shown in place of a locked page. */
export function UpgradeGate({ feature, title, description, bullets }: { feature: PlanFeature; title: string; description: string; bullets: string[] }) {
  const plan = planFor(feature);
  return (
    <div className="relative overflow-hidden rounded-3xl border bg-card px-6 py-10 text-center sm:px-10">
      <div className="pointer-events-none absolute inset-x-0 -top-24 mx-auto h-48 w-2/3 rounded-full bg-primary/10 blur-3xl" aria-hidden />
      <span className="relative mx-auto flex size-12 items-center justify-center rounded-2xl bg-gradient-brand text-white">
        <CrownIcon className="size-6" aria-hidden />
      </span>
      <p className="relative mt-4 text-xs font-semibold tracking-wide text-primary uppercase">{plan.name} plan</p>
      <h2 className="relative mt-1 text-xl font-semibold tracking-tight sm:text-2xl">{title}</h2>
      <p className="relative mx-auto mt-2 max-w-xl text-sm text-muted-foreground">{description}</p>
      <ul className="relative mx-auto mt-6 grid max-w-xl gap-2 text-left text-sm sm:grid-cols-2">
        {bullets.map((b) => (
          <li key={b} className="flex items-start gap-2">
            <CheckIcon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
            {b}
          </li>
        ))}
      </ul>
      <div className="relative mt-8 flex flex-col items-center justify-center gap-2 sm:flex-row">
        <Button className="bg-gradient-brand text-white hover:opacity-95" nativeButton={false} render={<Link href="/dashboard/brand/billing" />}>
          <CrownIcon /> Upgrade to {plan.name} · {formatMoney(plan.amount, plan.currency)} / {plan.periodDays} days
        </Button>
        <Button variant="ghost" nativeButton={false} render={<Link href="/pricing" />}>
          Compare plans
        </Button>
      </div>
    </div>
  );
}
