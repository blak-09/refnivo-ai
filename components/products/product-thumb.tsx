/* eslint-disable @next/next/no-img-element */
import { PackageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Product / brand image with a graceful placeholder. Uses a plain <img>
 * because image URLs are user-supplied and come from arbitrary hosts.
 */
export function ProductThumb({ src, name, className }: { src: string | null | undefined; name: string; className?: string }) {
  return (
    <div className={cn("flex shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted", className)}>
      {src ? (
        <img src={src} alt={name} className="size-full object-cover" loading="lazy" />
      ) : (
        <PackageIcon className="size-1/2 text-muted-foreground/60" aria-hidden />
      )}
    </div>
  );
}

/** Inline-safe (renders as <span>) so it can sit inside <p> and <a>. */
export function BrandLogo({ src, name, className }: { src: string | null | undefined; name: string; className?: string }) {
  return (
    <span className={cn("inline-flex shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-background text-sm font-semibold", className)}>
      {src ? <img src={src} alt={name} className="size-full object-contain" loading="lazy" /> : <span>{name.slice(0, 2).toUpperCase()}</span>}
    </span>
  );
}
