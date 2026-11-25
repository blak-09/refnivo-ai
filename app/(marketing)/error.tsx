"use client";

import { ErrorState } from "@/components/system/error-state";

export default function MarketingError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorState error={error} reset={reset} home={{ href: "/", label: "Go to home page" }} logLabel="Page error" />;
}
