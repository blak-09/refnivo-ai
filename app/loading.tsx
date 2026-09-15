import { LogoMark } from "@/components/brand/logo";

/** Branded route-transition loading state. */
export default function Loading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center" role="status" aria-label="Loading">
      <LogoMark className="size-12 animate-pulse" />
    </div>
  );
}
