import { cn } from "@/lib/utils";

/**
 * Official-colour marks for the social platforms a creator can connect.
 * Inline SVG (no network request, crisp at any size). Decorative by default —
 * the platform name is always printed next to the icon.
 */
export const PLATFORM_BRAND: Record<string, { label: string; color: string; button: string }> = {
  INSTAGRAM: { label: "Instagram", color: "#E1306C", button: "bg-linear-to-r from-[#F58529] via-[#DD2A7B] to-[#8134AF] text-white hover:opacity-90" },
  YOUTUBE: { label: "YouTube", color: "#FF0000", button: "bg-[#FF0000] text-white hover:bg-[#e00000]" },
  FACEBOOK: { label: "Facebook", color: "#1877F2", button: "bg-[#1877F2] text-white hover:bg-[#166fe0]" },
  LINKEDIN: { label: "LinkedIn", color: "#0A66C2", button: "bg-[#0A66C2] text-white hover:bg-[#095bb0]" },
  X: { label: "X", color: "#000000", button: "bg-black text-white hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200" },
};

export function PlatformIcon({ platform, className }: { platform: string; className?: string }) {
  const cls = cn("size-10 shrink-0", className);
  switch (platform) {
    case "INSTAGRAM":
      return (
        <svg viewBox="0 0 48 48" className={cls} aria-hidden>
          <defs>
            <radialGradient id="ig-grad" cx="0.3" cy="1.07" r="1.2">
              <stop offset="0" stopColor="#FFDD55" />
              <stop offset="0.1" stopColor="#FFDD55" />
              <stop offset="0.5" stopColor="#FF543E" />
              <stop offset="1" stopColor="#C837AB" />
            </radialGradient>
          </defs>
          <rect width="48" height="48" rx="12" fill="url(#ig-grad)" />
          <rect x="11" y="11" width="26" height="26" rx="8" fill="none" stroke="#fff" strokeWidth="3" />
          <circle cx="24" cy="24" r="6.2" fill="none" stroke="#fff" strokeWidth="3" />
          <circle cx="31.6" cy="16.4" r="1.9" fill="#fff" />
        </svg>
      );
    case "YOUTUBE":
      return (
        <svg viewBox="0 0 48 48" className={cls} aria-hidden>
          <rect width="48" height="48" rx="12" fill="#FF0000" />
          <rect x="8" y="13" width="32" height="22" rx="7" fill="#fff" />
          <path d="M21 18.5v11l9.5-5.5z" fill="#FF0000" />
        </svg>
      );
    case "FACEBOOK":
      return (
        <svg viewBox="0 0 48 48" className={cls} aria-hidden>
          <clipPath id="fb-clip">
            <rect width="48" height="48" rx="12" />
          </clipPath>
          <g clipPath="url(#fb-clip)">
            <rect width="48" height="48" fill="#1877F2" />
            <path d="M27.6 48V30h5.9l.9-7h-6.8v-4.4c0-2 .6-3.4 3.4-3.4h3.6V8.9c-.6-.1-2.8-.3-5.3-.3-5.3 0-8.9 3.2-8.9 9.1V23h-5.9v7h5.9v18z" fill="#fff" />
          </g>
        </svg>
      );
    case "LINKEDIN":
      return (
        <svg viewBox="0 0 48 48" className={cls} aria-hidden>
          <rect width="48" height="48" rx="12" fill="#0A66C2" />
          <circle cx="15.5" cy="15" r="3.4" fill="#fff" />
          <rect x="12.6" y="20.5" width="5.8" height="16" rx="0.6" fill="#fff" />
          <path d="M22.5 20.5h5.5v2.3c.8-1.4 2.7-2.7 5.5-2.7 5.6 0 6.5 3.7 6.5 8.4v8h-5.8v-7.1c0-1.7 0-3.9-2.4-3.9s-2.8 1.9-2.8 3.8v7.2h-5.8z" fill="#fff" />
        </svg>
      );
    case "X":
      return (
        <svg viewBox="0 0 48 48" className={cls} aria-hidden>
          <rect width="48" height="48" rx="12" fill="#000" />
          <path
            d="M31.1 11h3.9l-8.5 9.7L36.5 37h-7.8l-6.1-8-7 8h-3.9l9.1-10.4L11.2 11h8l5.5 7.3Zm-1.4 23.6h2.2L18 13.3h-2.3Z"
            fill="#fff"
          />
        </svg>
      );
    default:
      return <span className={cn(cls, "inline-flex items-center justify-center rounded-xl bg-muted text-sm font-semibold")}>{platform.slice(0, 2)}</span>;
  }
}
