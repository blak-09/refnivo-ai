import Link from "next/link";
import { TrendingUpIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function Logo({ compact = false, href = "/", className }: { compact?: boolean; href?: string; className?: string }) {
  return (
    <Link href={href} className={cn("inline-flex items-center gap-2", className)} aria-label="Refnivo AI home">
      <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <TrendingUpIcon className="size-4" aria-hidden />
      </span>
      {!compact ? (
        <span className="text-base font-semibold tracking-tight">
          Refnivo <span className="text-primary">AI</span>
        </span>
      ) : null}
    </Link>
  );
}
