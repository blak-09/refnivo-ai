/* eslint-disable @next/next/no-img-element */
import Image from "next/image";
import { PackageIcon } from "lucide-react";
import { isHostedImage } from "@/lib/storage/hosted-image";
import { cn } from "@/lib/utils";

/**
 * Product / brand / avatar image with a graceful placeholder.
 *
 * Images we host (uploads, the configured storage bucket) go through
 * `next/image` — resized to the rendered box, served as WebP/AVIF, lazy by
 * default. User-pasted URLs from arbitrary hosts render as a plain <img>
 * (optimizing them would make the optimizer an open proxy) with lazy loading
 * and async decoding so they never block the page.
 */
type Props = {
  src: string | null | undefined;
  name: string;
  className?: string;
  /** Above-the-fold image that should load first (hero). */
  priority?: boolean;
  /** Layout hint for the optimizer, e.g. "(max-width: 640px) 100vw, 320px". */
  sizes?: string;
};

function Picture({ src, alt, priority, sizes, fit }: { src: string; alt: string; priority?: boolean; sizes?: string; fit: "cover" | "contain" }) {
  const cls = fit === "cover" ? "size-full object-cover" : "size-full object-contain";
  if (isHostedImage(src)) {
    return <Image src={src} alt={alt} fill sizes={sizes ?? "(max-width: 640px) 100vw, 320px"} className={cls} priority={priority} unoptimized={src.startsWith("data:")} />;
  }
  return <img src={src} alt={alt} className={cls} loading={priority ? "eager" : "lazy"} decoding="async" fetchPriority={priority ? "high" : "auto"} />;
}

export function ProductThumb({ src, name, className, priority, sizes }: Props) {
  return (
    <div className={cn("relative flex shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted", className)}>
      {src ? <Picture src={src} alt={name} priority={priority} sizes={sizes} fit="cover" /> : <PackageIcon className="size-1/2 text-muted-foreground/60" aria-hidden />}
    </div>
  );
}

/** Inline-safe (renders as <span>) so it can sit inside <p> and <a>. */
export function BrandLogo({ src, name, className, sizes }: Props) {
  return (
    <span className={cn("relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-background text-sm font-semibold", className)}>
      {src ? <Picture src={src} alt={name} sizes={sizes ?? "64px"} fit="contain" /> : <span>{name.slice(0, 2).toUpperCase()}</span>}
    </span>
  );
}
