import { cn } from "@/lib/utils";

/**
 * WhatsApp mark (speech bubble + handset) in its official green, drawn in the
 * same simplified inline-SVG style as components/social/platform-icon.tsx.
 * Decorative: links that use it say "opens WhatsApp" in text.
 */
export function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={cn("size-5 shrink-0", className)} aria-hidden focusable="false">
      <path d="M24 4a20 20 0 0 0-17.2 30.2L4 44l10.1-2.7A20 20 0 1 0 24 4Z" fill="#25D366" />
      <path
        transform="translate(13 13) scale(0.9167)"
        d="M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384"
        fill="#fff"
      />
    </svg>
  );
}
