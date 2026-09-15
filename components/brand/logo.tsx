import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Refnivo AI branding — the single source of truth for the logo.
 *
 * - `LogoMark`   gradient "R + arrow" symbol (pure SVG, crisp at any size)
 * - `Logo`       mark + "Refnivo" wordmark + "AI" pill (the full lock-up)
 * - `HeaderLogo` / `SidebarLogo` / `FooterLogo`  thin, purpose-named wrappers
 *
 * Never inline logo markup elsewhere — import one of these instead.
 */

type Tone = "dark" | "light";
type Size = "sm" | "md" | "lg";

const MARK_SIZE: Record<Size, string> = { sm: "size-6", md: "size-8", lg: "size-11" };
const TEXT_SIZE: Record<Size, string> = { sm: "text-base", md: "text-xl", lg: "text-3xl" };

/** Purple→blue gradient "R" with an upward arrow cut through it. */
export function LogoMark({ className, title = "Refnivo AI" }: { className?: string; title?: string }) {
  // Unique gradient id per instance: a shared id would resolve to the first
  // occurrence in the document, which may sit in a hidden (display:none)
  // container — and gradients in non-rendered subtrees do not paint.
  const gradientId = `refnivo-mark-${React.useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  return (
    <svg viewBox="0 0 48 48" className={cn("shrink-0", className)} role="img" aria-label={title}>
      <defs>
        <linearGradient id={gradientId} x1="4" y1="4" x2="44" y2="44" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#7C3AED" />
          <stop offset="0.55" stopColor="#4F46E5" />
          <stop offset="1" stopColor="#3B82F6" />
        </linearGradient>
      </defs>
      {/* Solid "R" with a punched counter */}
      <path
        fill={`url(#${gradientId})`}
        fillRule="evenodd"
        d="M8 4h18a13 13 0 0 1 0 26h-5l19 14h-10L15 31v13H8Zm7 7v12h11a6 6 0 0 0 0-12Z"
      />
      {/* Upward arrow cut-out */}
      <g fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 33 35 15" />
        <path d="M27 15h8v8" />
      </g>
    </svg>
  );
}

/** Full lock-up: mark + wordmark + "AI" pill. Links home by default. */
export function Logo({
  compact = false,
  href = "/",
  size = "md",
  tone = "dark",
  className,
}: {
  compact?: boolean;
  href?: string | null;
  size?: Size;
  tone?: Tone;
  className?: string;
}) {
  const content = (
    <>
      <LogoMark className={MARK_SIZE[size]} />
      {!compact ? (
        <span className={cn("flex items-center gap-1.5 font-bold tracking-tight", TEXT_SIZE[size], tone === "light" ? "text-white" : "text-foreground")}>
          Refnivo
          <span
            aria-hidden
            className="inline-flex items-center rounded-md bg-linear-to-br from-violet-600 via-indigo-600 to-blue-500 px-1.5 text-[0.5em] font-bold leading-[1.7] text-white"
          >
            AI
          </span>
        </span>
      ) : null}
    </>
  );
  const classes = cn("inline-flex items-center gap-2", className);
  if (!href) return <span className={classes}>{content}</span>;
  return (
    <Link href={href} className={classes} aria-label="Refnivo AI home">
      {content}
    </Link>
  );
}

/** Desktop/marketing header — full lock-up. */
export function HeaderLogo({ className }: { className?: string }) {
  return <Logo size="md" className={className} />;
}

/** Dashboard sidebar — full lock-up; `compact` for narrow rails / mobile bars. */
export function SidebarLogo({ compact = false, className }: { compact?: boolean; className?: string }) {
  return <Logo size="md" compact={compact} className={className} />;
}

/** Footer — smaller lock-up. */
export function FooterLogo({ className }: { className?: string }) {
  return <Logo size="sm" className={className} />;
}
