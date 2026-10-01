import { PackageIcon } from "lucide-react";
import { Picture } from "@/components/products/picture";
import { cn } from "@/lib/utils";

/**
 * Product / brand / avatar image with a graceful placeholder.
 *
 * Images we host (uploads, the configured storage bucket) go through
 * `next/image` — resized to the rendered box, served as WebP/AVIF, lazy by
 * default. User-pasted URLs from arbitrary hosts render as a plain <img>
 * (optimizing them would make the optimizer an open proxy) with lazy loading
 * and async decoding so they never block the page. A missing or failed image
 * shows the placeholder (an icon, or the brand's initials) instead.
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

export function ProductThumb({ src, name, className, priority, sizes }: Props) {
  const placeholder = <PackageIcon className="size-1/2 text-muted-foreground/60" aria-hidden />;
  return (
    <div className={cn("relative flex shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted", className)}>
      {src ? <Picture src={src} alt={name} priority={priority} sizes={sizes} fit="cover" fallback={placeholder} /> : placeholder}
    </div>
  );
}

/** Inline-safe (renders as <span>) so it can sit inside <p> and <a>. */
export function BrandLogo({ src, name, className, sizes }: Props) {
  const initials = <span>{name.slice(0, 2).toUpperCase()}</span>;
  return (
    <span className={cn("relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-background text-sm font-semibold", className)}>
      {src ? <Picture src={src} alt={name} sizes={sizes ?? "64px"} fit="contain" fallback={initials} /> : initials}
    </span>
  );
}
