/**
 * Team members shown on /team.
 *
 * ── HOW TO ADD SOMEONE ─────────────────────────────────────────────────────
 * Add an entry to TEAM below. Nothing else needs to change: the page renders
 * the cards, and hides the "profiles coming soon" state as soon as the list
 * has at least one entry.
 *
 *   {
 *     slug: "asha-r",                        // unique, lowercase, used as the React key
 *     name: "Asha R.",
 *     role: "Founder",
 *     bio: "One or two sentences. Keep it factual — no invented credentials.",
 *     photoUrl: "/team/asha.jpg",            // /public path, an uploaded URL, or omit for initials
 *     links: [{ label: "LinkedIn", href: "https://www.linkedin.com/in/…" }],
 *   }
 *
 * Deliberately empty: no placeholder people are shipped, because invented
 * names and titles on a public page are worse than an honest empty state.
 */
export type TeamLink = { label: string; href: string };

export type TeamMember = {
  slug: string;
  name: string;
  role: string;
  bio: string;
  /** `/public` path, uploaded image URL, or omitted for an initials avatar. */
  photoUrl?: string | null;
  links?: TeamLink[];
};

export const TEAM: TeamMember[] = [];
