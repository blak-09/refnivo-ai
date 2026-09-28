import { customAlphabet } from "nanoid";

// Unambiguous alphabet (no 0/O, 1/I/l) so codes can be read aloud or typed from a QR flyer.
const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const random = customAlphabet(ALPHABET, 4);
const randomLong = customAlphabet(ALPHABET, 8);

function token(input: string, max: number): string {
  const cleaned = input
    .normalize("NFKD")
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase()
    .slice(0, max);
  return cleaned || "USER";
}

/**
 * Human-readable referral codes: `ARJUN-BOAT-4K7Q`
 *   <partner handle>-<brand>-<random>
 * The random suffix guarantees uniqueness even when two partners share a name.
 * Creator and customer links are distinguished by `ReferralLink.partnerType`.
 *
 * A channel-specific link carries a fourth segment — `ARJUN-BOAT-4K7Q-YT` — so
 * the creator (and anyone reading the link in a bio) can see which platform it
 * belongs to, and so a sale can be credited to that channel. The suffix is part
 * of the code, not a query parameter, because query strings are frequently
 * stripped when a link is pasted into a social profile.
 */
export const SOURCE_SUFFIX = { GENERAL: "", INSTAGRAM: "IG", YOUTUBE: "YT", FACEBOOK: "FB", LINKEDIN: "LI", X: "X" } as const;
export type CodeSource = keyof typeof SOURCE_SUFFIX;

export function generateReferralCode(partnerHandle: string, brandName: string, source: CodeSource = "GENERAL"): string {
  const suffix = SOURCE_SUFFIX[source];
  return `${token(partnerHandle, 12)}-${token(brandName, 8)}-${random()}${suffix ? `-${suffix}` : ""}`;
}

/**
 * Customer codes carry no personal data: `C-7QK2M9XW`. A customer's display
 * name is their real name, and the code travels in every share message.
 */
export function generateCustomerReferralCode(): string {
  return `C-${randomLong()}`;
}

export function isReferralCodeFormat(code: string): boolean {
  return (
    /^[A-Z0-9]{1,12}-[A-Z0-9]{1,8}-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}(-(IG|YT|FB|LI|X))?$/.test(code) ||
    /^[CR]-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{8}$/.test(code)
  );
}

export function normalizeReferralCode(input: string): string {
  return input.trim().toUpperCase();
}
