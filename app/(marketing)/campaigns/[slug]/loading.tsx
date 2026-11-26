import { Skeleton } from "@/components/ui/skeleton";

/** Campaign page skeleton: product image, title and price on the left; terms and the promote card on the right. */
export default function CampaignLoading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6" aria-busy="true" aria-live="polite">
      <p className="sr-only">Loading campaign…</p>
      <div className="grid gap-8 lg:grid-cols-[1.1fr_1fr]">
        <div>
          <Skeleton className="aspect-square w-full rounded-2xl" />
          <Skeleton className="mt-5 h-5 w-40" />
          <Skeleton className="mt-3 h-8 w-3/4" />
          <Skeleton className="mt-2 h-6 w-24" />
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <Skeleton className="h-16 rounded-xl" />
            <Skeleton className="h-16 rounded-xl" />
            <Skeleton className="h-16 rounded-xl sm:col-span-2" />
          </div>
        </div>
        <div className="space-y-4">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-36 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
        </div>
      </div>
    </div>
  );
}
