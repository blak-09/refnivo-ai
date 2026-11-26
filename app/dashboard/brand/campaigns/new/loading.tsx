import { Skeleton } from "@/components/ui/skeleton";

/** Campaign wizard skeleton: page title, the step list and the first step's card. */
export default function NewCampaignLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <p className="sr-only">Loading campaign form…</p>
      <div className="space-y-2">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        <div className="flex gap-2 overflow-hidden lg:flex-col lg:gap-1">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-40 shrink-0 rounded-lg lg:w-full" />
          ))}
        </div>
        <div className="space-y-4 rounded-xl border p-4 sm:p-6">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-6 w-44" />
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-10" />
          <Skeleton className="h-24" />
          <Skeleton className="h-10" />
        </div>
      </div>
    </div>
  );
}
