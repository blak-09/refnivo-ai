import { createHash, randomUUID } from "node:crypto";
import { looksLikeMarkupOrScript, sniffImageType, type SniffedImageType } from "./image-sniff";

/**
 * Upload validation rules. Pure (no Next imports) so they are unit-tested and
 * shared by the upload route. The client's declared MIME type is only a hint:
 * the bytes decide (`validateImageBytes`).
 */

export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type AllowedImageType = (typeof ALLOWED_IMAGE_TYPES)[number];

export const IMAGE_EXT_BY_TYPE: Record<AllowedImageType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB

export type ImageValidationError = "type" | "size" | "empty" | "content" | "mismatch";

/** Cheap pre-check on the declared metadata (before reading the body). */
export function validateImage(input: { size: number; type: string }): ImageValidationError | null {
  if (!input.size) return "empty";
  if (!ALLOWED_IMAGE_TYPES.includes(input.type as AllowedImageType)) return "type";
  if (input.size > MAX_IMAGE_BYTES) return "size";
  return null;
}

export type ByteValidation = { ok: true; contentType: SniffedImageType; ext: string } | { ok: false; error: ImageValidationError };

/**
 * Authoritative check on the actual bytes: size, executable/markup rejection,
 * magic-byte sniffing, and agreement with the declared type (a PNG uploaded as
 * image/jpeg is rejected rather than silently relabelled).
 */
export function validateImageBytes(data: Uint8Array, declaredType: string): ByteValidation {
  if (!data.byteLength) return { ok: false, error: "empty" };
  if (data.byteLength > MAX_IMAGE_BYTES) return { ok: false, error: "size" };
  if (looksLikeMarkupOrScript(data)) return { ok: false, error: "content" };
  const sniffed = sniffImageType(data);
  if (!sniffed) return { ok: false, error: "content" };
  if (declaredType && declaredType !== sniffed) return { ok: false, error: "mismatch" };
  return { ok: true, contentType: sniffed, ext: IMAGE_EXT_BY_TYPE[sniffed] };
}

export function imageValidationMessage(err: ImageValidationError): string {
  switch (err) {
    case "type":
      return "Unsupported file type. Upload a JPG, PNG or WebP image.";
    case "size":
      return "Image is too large. Maximum size is 5 MB.";
    case "empty":
      return "The file is empty.";
    case "content":
      return "The file is not a valid JPG, PNG or WebP image.";
    case "mismatch":
      return "The file's contents do not match its type. Re-save the image and try again.";
  }
}

/**
 * Server-generated object name: timestamp + short content hash + random suffix,
 * extension from the SNIFFED type. The client's filename is never used, so path
 * separators, unicode tricks or double extensions cannot reach the disk.
 */
export function makeObjectName(data: Uint8Array, ext: string): string {
  const safeExt = ext.replace(/[^a-z0-9]/gi, "").toLowerCase() || "bin";
  const hash = createHash("sha256").update(data).digest("hex").slice(0, 12);
  return `${Date.now().toString(36)}-${hash}-${randomUUID().slice(0, 8)}.${safeExt}`;
}

/** Storage prefix sanitiser shared by drivers: lowercase alphanumerics, `/`, `_`, `-` only. */
export function sanitizePrefix(prefix: string | undefined): string {
  const cleaned = (prefix ?? "misc").replace(/[^a-z0-9/_-]/gi, "").replace(/\.\./g, "").replace(/\/+/g, "/").replace(/^\/|\/$/g, "");
  return cleaned || "misc";
}
