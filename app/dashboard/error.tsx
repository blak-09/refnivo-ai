"use client";

import { useEffect } from "react";
import { AlertTriangleIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Digest only — never log the full error object in the browser.
    console.error("Dashboard error", error.digest ?? error.message);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-4 text-center">
      <AlertTriangleIcon className="size-8 text-destructive" aria-hidden />
      <h2 className="text-lg font-semibold">Something went wrong</h2>
      <p className="max-w-sm text-sm text-muted-foreground">
        We could not load this page. Please try again — if the problem persists, contact support.
      </p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
