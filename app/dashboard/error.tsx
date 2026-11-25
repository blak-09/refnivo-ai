"use client";

import { ErrorState } from "@/components/system/error-state";

export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorState error={error} reset={reset} home={{ href: "/dashboard", label: "Go to dashboard" }} logLabel="Dashboard error" />;
}
