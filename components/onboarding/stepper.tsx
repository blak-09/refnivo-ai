import { CheckIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = ["Choose role", "Create account", "Your profile", "Review"] as const;

/** Onboarding progress: step `current` (1-based) of the four signup steps. */
export function OnboardingStepper({ current, className }: { current: 1 | 2 | 3 | 4; className?: string }) {
  return (
    <nav aria-label="Signup progress" className={cn("w-full", className)}>
      <p className="mb-3 text-center text-xs font-medium text-muted-foreground sm:hidden">
        Step {current} of {STEPS.length} · {STEPS[current - 1]}
      </p>
      <ol className="flex items-center gap-2">
        {STEPS.map((label, i) => {
          const n = i + 1;
          const done = n < current;
          const active = n === current;
          return (
            <li key={label} className="flex flex-1 items-center gap-2" aria-current={active ? "step" : undefined}>
              <span
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors",
                  done && "bg-primary text-primary-foreground",
                  active && "border-2 border-primary bg-background text-primary",
                  !done && !active && "border bg-background text-muted-foreground",
                )}
              >
                {done ? <CheckIcon className="size-3.5" aria-hidden /> : n}
                <span className="sr-only">{done ? " (done)" : active ? " (current)" : ""}</span>
              </span>
              <span className={cn("hidden text-xs font-medium whitespace-nowrap sm:inline", active ? "text-foreground" : "text-muted-foreground")}>{label}</span>
              {n < STEPS.length ? <span className={cn("h-px flex-1", done ? "bg-primary" : "bg-border")} aria-hidden /> : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
