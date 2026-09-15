import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { CAMPAIGN_STATUS_LABEL } from "@/lib/utils/labels";

// ---------------------------------------------------------------------------
// Page header
// ---------------------------------------------------------------------------

export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between", className)}>
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// KPI card
// ---------------------------------------------------------------------------

export function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: LucideIcon;
  className?: string;
}) {
  return (
    <Card size="sm" className={cn("gap-2", className)}>
      <CardContent className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          {Icon ? <Icon className="size-4 text-muted-foreground" aria-hidden /> : null}
        </div>
        <p className="text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-12 text-center",
        className,
      )}
    >
      {Icon ? (
        <div className="mb-3 flex size-10 items-center justify-center rounded-full bg-accent text-accent-foreground">
          <Icon className="size-5" aria-hidden />
        </div>
      ) : null}
      <h3 className="text-sm font-medium">{title}</h3>
      {description ? <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Status badges
// ---------------------------------------------------------------------------

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: "bg-success/10 text-success border-success/25",
  VERIFIED: "bg-success/10 text-success border-success/25",
  APPROVED: "bg-success/10 text-success border-success/25",
  AVAILABLE: "bg-success/10 text-success border-success/25",
  PAID: "bg-success/10 text-success border-success/25",
  DRAFT: "bg-muted text-muted-foreground border-border",
  PENDING: "bg-warning/15 text-amber-800 border-warning/40 dark:text-amber-200",
  PENDING_REVIEW: "bg-warning/15 text-amber-800 border-warning/30 dark:text-amber-200",
  PURCHASED: "bg-warning/15 text-amber-800 border-warning/30 dark:text-amber-200",
  UNDER_REVIEW: "bg-warning/15 text-amber-800 border-warning/30 dark:text-amber-200",
  PAUSED: "bg-secondary text-secondary-foreground border-border",
  CLICKED: "bg-secondary text-secondary-foreground border-border",
  VISITED: "bg-secondary text-secondary-foreground border-border",
  ENDED: "bg-muted text-muted-foreground border-border",
  ARCHIVED: "bg-muted text-muted-foreground border-border",
  REDEEMED: "bg-muted text-muted-foreground border-border",
  REJECTED: "bg-destructive/10 text-destructive border-destructive/20",
  CANCELLED: "bg-destructive/10 text-destructive border-destructive/20",
  SUSPENDED: "bg-destructive/10 text-destructive border-destructive/20",
};

export function StatusBadge({ status, label, className }: { status: string; label?: string; className?: string }) {
  const text = label ?? CAMPAIGN_STATUS_LABEL[status] ?? status.replace(/_/g, " ").toLowerCase();
  return (
    <Badge variant="outline" className={cn("capitalize", STATUS_STYLES[status], className)}>
      {text}
    </Badge>
  );
}

