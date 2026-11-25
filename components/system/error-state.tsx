"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangleIcon, RotateCcwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Shared body for route error boundaries. Explains what happened and offers a
 * way forward (retry, a safe page, support) without showing technical details:
 * only the opaque digest is shown, so support can find the server log.
 */
export function ErrorState({
  error,
  reset,
  home,
  logLabel,
}: {
  error: Error & { digest?: string };
  reset: () => void;
  home: { href: string; label: string };
  logLabel: string;
}) {
  useEffect(() => {
    // Digest only — never log the full error object in the browser.
    console.error(logLabel, error.digest ?? error.message);
  }, [error, logLabel]);

  return (
    <div role="alert" className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-4 text-center">
      <AlertTriangleIcon className="size-8 text-destructive" aria-hidden />
      <h2 className="text-lg font-semibold">This page didn&apos;t load</h2>
      <p className="max-w-sm text-sm text-muted-foreground">
        Something went wrong on our side. Your data is safe. Try again, or go back and continue from there.
      </p>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
        <Button onClick={reset}>
          <RotateCcwIcon aria-hidden /> Try again
        </Button>
        <Button variant="outline" nativeButton={false} render={<Link href={home.href} />}>
          {home.label}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Still stuck?{" "}
        <Link href="/contact" className="font-medium text-primary hover:underline">
          Contact support
        </Link>
        {error.digest ? <> and mention reference <span className="font-mono">{error.digest}</span>.</> : "."}
      </p>
    </div>
  );
}
