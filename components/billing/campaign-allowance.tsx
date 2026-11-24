import Link from "next/link";
import { CrownIcon, RocketIcon, SparklesIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { CampaignAllowance } from "@/lib/services/plan-limits";
import { cn } from "@/lib/utils";

const BILLING = "/dashboard/brand/billing";

/**
 * "2 of 3 free campaigns launched" — shown on the brand's campaign pages and on
 * Billing. Renders nothing when the free limit does not apply (billing off), and
 * only a slim plan line for subscribed brands unless `showWhenSubscribed`.
 */
export function CampaignAllowanceBanner({
  allowance,
  showWhenSubscribed = false,
  showAction = true,
  className,
}: {
  allowance: CampaignAllowance;
  showWhenSubscribed?: boolean;
  /** Off on the Billing page itself, where the plans are right below. */
  showAction?: boolean;
  className?: string;
}) {
  if (!allowance.enforced) return null;

  if (allowance.subscribed) {
    if (!showWhenSubscribed) return null;
    return (
      <div
        className={cn(
          "flex items-center gap-3 rounded-2xl border bg-card px-4 py-3 text-sm",
          className,
        )}
      >
        <CrownIcon className="size-5 shrink-0 text-primary" aria-hidden />
        <p>
          <span className="font-medium">
            {allowance.planName ?? "Paid"} plan
          </span>{" "}
          — unlimited campaign launches. {allowance.used} launched so far.
        </p>
      </div>
    );
  }

  const usedUp = allowance.remaining === 0;
  const shown = Math.min(allowance.used, allowance.limit);
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-2xl border px-4 py-4 sm:flex-row sm:items-center sm:gap-5",
        usedUp ? "border-primary/40 bg-primary/5" : "bg-card",
        className,
      )}
      role={usedUp ? "status" : undefined}
    >
      <span
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-xl",
          usedUp
            ? "bg-gradient-brand text-white"
            : "bg-primary/10 text-primary",
        )}
      >
        {usedUp ? (
          <SparklesIcon className="size-5" aria-hidden />
        ) : (
          <RocketIcon className="size-5" aria-hidden />
        )}
      </span>
      <div className="min-w-0 flex-1 space-y-2">
        <p className="text-sm font-medium">
          {usedUp
            ? `You've launched all ${allowance.limit} free campaigns`
            : `${shown} of ${allowance.limit} free campaign launches used · ${allowance.remaining} left`}
        </p>
        <Progress
          value={(shown / allowance.limit) * 100}
          aria-label="Free campaign launches used"
        />
        <p className="text-xs text-muted-foreground">
          {usedUp
            ? "Choose a plan to launch more campaigns. You can keep creating and editing drafts, and your live campaigns keep running."
            : "Drafts are free. Each campaign you publish uses one free launch; after that a plan unlocks unlimited launches."}
        </p>
      </div>
      {showAction ? (
        <Button
          size="sm"
          variant={usedUp ? "default" : "outline"}
          className={cn(
            "shrink-0",
            usedUp && "bg-gradient-brand text-white hover:opacity-95",
          )}
          nativeButton={false}
          render={<Link href={BILLING} />}
        >
          {usedUp ? "Choose a plan" : "See plans"}
        </Button>
      ) : null}
    </div>
  );
}
