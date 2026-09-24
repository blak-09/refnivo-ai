/**
 * Public contact details and official social profiles.
 *
 * Single source of truth so the address is never duplicated across pages.
 * The inbox can be overridden per environment with CONTACT_INBOX_EMAIL
 * (Vercel → Environment Variables) without a code change.
 */
export const CONTACT_EMAIL = "refnivo45@gmail.com";

/** Where contact-form submissions are delivered. */
export function contactInbox(env: NodeJS.ProcessEnv = process.env): string {
  return env.CONTACT_INBOX_EMAIL?.trim() || CONTACT_EMAIL;
}

/** mailto: link with an optional pre-filled subject. */
export function mailto(subject?: string): string {
  return subject ? `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}` : `mailto:${CONTACT_EMAIL}`;
}

export const SOCIALS = [
  {
    key: "youtube",
    name: "Refnivo on YouTube",
    handle: "@Refnivo",
    href: "https://www.youtube.com/@Refnivo",
    description: "Watch product updates, educational content, and videos from Refnivo.",
    cta: "Visit YouTube",
  },
  {
    key: "instagram",
    name: "@refnivo",
    handle: "@refnivo",
    href: "https://www.instagram.com/refnivo/",
    description: "Follow Refnivo on Instagram for updates, announcements, and community content.",
    cta: "Follow on Instagram",
  },
] as const;
