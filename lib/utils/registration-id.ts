import { randomBytes } from "node:crypto";

// Unambiguous alphabet (no 0/O/1/I) so the ID is safe to read out or type.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/**
 * Opaque, human-readable registration handle, e.g. `REF-7QK4M2P9`.
 * Safe to show on the pending page and share for status checks — it reveals no
 * personal data and is unguessable enough for a lookup key.
 */
export function generateRegistrationId(length = 8): string {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return `REF-${out}`;
}
