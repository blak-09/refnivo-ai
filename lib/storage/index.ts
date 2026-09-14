import "server-only";
import { createHash, randomUUID } from "node:crypto";

/**
 * Storage abstraction. The MVP ships a local-disk driver (writes to
 * `public/uploads`), but the interface is deliberately provider-agnostic so a
 * cloud driver (Cloudflare R2, AWS S3, Cloudinary, Supabase Storage) can be
 * dropped in later by implementing `StorageDriver` and switching `getStorage()`
 * on an env var — no calling code changes.
 */

export type StoredFile = {
  /** Public URL/path used in <img src> and stored in the DB. */
  url: string;
  /** Provider key/path — useful for deletion. */
  key: string;
};

export interface StorageDriver {
  /** Persist bytes and return the public URL + key. */
  put(input: { data: Buffer; contentType: string; ext: string; prefix?: string }): Promise<StoredFile>;
  /** Best-effort deletion of a previously stored file. Never throws on missing. */
  remove(key: string): Promise<void>;
}

export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const IMAGE_EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB

export type ImageValidationError = "type" | "size" | "empty";

/** Server-side validation shared by the upload route (never trust the client). */
export function validateImage(input: { size: number; type: string }): ImageValidationError | null {
  if (!input.size) return "empty";
  if (!ALLOWED_IMAGE_TYPES.includes(input.type as (typeof ALLOWED_IMAGE_TYPES)[number])) return "type";
  if (input.size > MAX_IMAGE_BYTES) return "size";
  return null;
}

export function imageValidationMessage(err: ImageValidationError): string {
  switch (err) {
    case "type":
      return "Unsupported file type. Upload a JPG, PNG or WebP image.";
    case "size":
      return "Image is too large. Maximum size is 5 MB.";
    case "empty":
      return "The file is empty.";
  }
}

/** Deterministic-ish unique filename: short content hash + random, keeps names unguessable. */
export function makeObjectName(data: Buffer, ext: string): string {
  const hash = createHash("sha256").update(data).digest("hex").slice(0, 12);
  return `${Date.now().toString(36)}-${hash}-${randomUUID().slice(0, 8)}.${ext}`;
}

let cached: StorageDriver | null = null;

export async function getStorage(): Promise<StorageDriver> {
  if (cached) return cached;
  const provider = (process.env.STORAGE_PROVIDER ?? "local").toLowerCase();
  switch (provider) {
    // Future: case "r2" / "s3" / "cloudinary" / "supabase" → return that driver.
    case "local":
    default: {
      const { LocalStorageDriver } = await import("./local");
      cached = new LocalStorageDriver();
      return cached;
    }
  }
}
