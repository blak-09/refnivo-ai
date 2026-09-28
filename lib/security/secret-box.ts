import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * Authenticated encryption for secrets we must be able to read back — today the
 * OAuth tokens of a creator's linked social accounts.
 *
 * AES-256-GCM: the ciphertext carries its own authentication tag, so a tampered
 * value fails to decrypt instead of silently returning something else. The
 * stored form is `v1.<iv>.<tag>.<ciphertext>`, all base64url, with the version
 * prefix so the scheme can change later without guessing at old rows.
 *
 * The key comes from SOCIAL_TOKEN_ENCRYPTION_KEY. A missing key is not a
 * fallback-to-plaintext: encryption throws, which is what stops a deployment
 * from quietly storing tokens in the clear.
 */
const VERSION = "v1";

export class SecretBoxError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SecretBoxError";
  }
}

/**
 * Accepts a 32-byte key as base64 or hex, or any passphrase (hashed to 32
 * bytes). Generating one: `openssl rand -base64 32`.
 */
export function deriveKey(raw: string | undefined, label = "SOCIAL_TOKEN_ENCRYPTION_KEY"): Buffer {
  const value = raw?.trim();
  if (!value) throw new SecretBoxError(`${label} is not set, so secrets cannot be encrypted.`);
  for (const encoding of ["base64", "hex"] as const) {
    try {
      const buf = Buffer.from(value, encoding);
      if (buf.length === 32) return buf;
    } catch {
      // try the next encoding
    }
  }
  if (value.length < 16) throw new SecretBoxError(`${label} is too short: use 32 random bytes (openssl rand -base64 32).`);
  return createHash("sha256").update(value).digest();
}

export function encryptSecret(plaintext: string, key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return [VERSION, iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), ciphertext.toString("base64url")].join(".");
}

export function decryptSecret(stored: string, key: Buffer): string {
  const [version, iv, tag, ciphertext] = stored.split(".");
  if (version !== VERSION || !iv || !tag || !ciphertext) throw new SecretBoxError("Stored secret is not in the expected format.");
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    // Wrong key, or the value was altered. Never say which.
    throw new SecretBoxError("Could not decrypt the stored secret.");
  }
}

/** True when a deployment can store social tokens at all. */
export function encryptionConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  try {
    deriveKey(env.SOCIAL_TOKEN_ENCRYPTION_KEY);
    return true;
  } catch {
    return false;
  }
}
