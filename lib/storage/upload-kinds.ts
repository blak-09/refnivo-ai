/**
 * Every place an image can be uploaded, with who may do it and where it is
 * stored. The route `/api/uploads/[kind]` resolves the kind here, so there is
 * exactly one upload pipeline (auth → rate limit → validation → sniff → store)
 * for products, brand logos/covers, creator photos and account avatars.
 * Pure; unit-tested.
 */
export type UploadKind = "product-image" | "brand-logo" | "brand-cover" | "creator-image" | "avatar";

export type UploadScope =
  /** Needs an approved brand-owner session with a brand; stored under the brand id. */
  | "brand"
  /** Needs an approved creator session; stored under the user id. */
  | "creator"
  /** Any approved user; stored under the user id. */
  | "user";

export const UPLOAD_KINDS: Record<UploadKind, { scope: UploadScope; folder: string; label: string }> = {
  "product-image": { scope: "brand", folder: "products", label: "product image" },
  "brand-logo": { scope: "brand", folder: "brands/logo", label: "brand logo" },
  "brand-cover": { scope: "brand", folder: "brands/cover", label: "brand cover image" },
  "creator-image": { scope: "creator", folder: "creators", label: "creator profile image" },
  avatar: { scope: "user", folder: "avatars", label: "profile photo" },
};

export function isUploadKind(value: unknown): value is UploadKind {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(UPLOAD_KINDS, value);
}

/** Storage prefix for an upload: folder + the owner's id, never anything client-supplied. */
export function uploadPrefix(kind: UploadKind, ownerId: string): string {
  return `${UPLOAD_KINDS[kind].folder}/${ownerId}`;
}
