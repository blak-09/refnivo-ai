import { NextResponse } from "next/server";
import { assertBrandOwner, assertRole, assertUser, AuthorizationError } from "@/lib/auth/guards";
import { recordAudit } from "@/lib/services/audit";
import { getStorage, imageValidationMessage, MAX_IMAGE_BYTES, uploadsAvailable, validateImage, validateImageBytes } from "@/lib/storage";
import { isUploadKind, UPLOAD_KINDS, uploadPrefix } from "@/lib/storage/upload-kinds";
import { rateLimit } from "@/lib/utils/rate-limit";
import { securityEvent } from "@/lib/utils/security-log";
import { logServerError } from "@/lib/utils/server-log";

export const runtime = "nodejs";

const UPLOADS_PER_WINDOW = 30;
const UPLOAD_WINDOW_MS = 10 * 60 * 1000;

function json(body: Record<string, unknown>, status: number, headers: Record<string, string> = {}) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } });
}

/**
 * POST /api/uploads/[kind] — the single image upload pipeline.
 *
 *   product-image · brand-logo · brand-cover   brand owner (with a brand)
 *   creator-image                              creator
 *   avatar                                     any signed-in user
 *
 * Order of checks: kind → auth (scope) → storage availability → rate limit →
 * multipart parse → declared metadata (cheap pre-check) → actual bytes (size
 * re-check, executable/markup rejection, magic-byte sniff, declared-vs-sniffed
 * agreement). The stored content type and extension come from the sniffed
 * bytes, never from the client; the client's filename is never used; the
 * storage prefix is derived from the session (nobody can upload into another
 * brand's or user's folder).
 */
export async function POST(request: Request, ctx: { params: Promise<{ kind: string }> }) {
  const { kind } = await ctx.params;
  if (!isUploadKind(kind)) return json({ ok: false, error: "Unknown upload type." }, 404);
  const spec = UPLOAD_KINDS[kind];

  let ownerId: string;
  let userId: string;
  let actorRole: "BRAND_OWNER" | "CREATOR" | "CUSTOMER" | "ADMIN";
  let entity: { type: string; id: string };
  try {
    if (spec.scope === "brand") {
      const { user, brand } = await assertBrandOwner();
      ownerId = brand.id;
      userId = user.id;
      actorRole = user.role;
      entity = { type: "Brand", id: brand.id };
    } else if (spec.scope === "creator") {
      const user = await assertRole("CREATOR");
      ownerId = userId = user.id;
      actorRole = user.role;
      entity = { type: "User", id: user.id };
    } else {
      const user = await assertUser();
      ownerId = userId = user.id;
      actorRole = user.role;
      entity = { type: "User", id: user.id };
    }
  } catch (err) {
    const message = err instanceof AuthorizationError ? err.message : "You must be signed in.";
    return json({ ok: false, error: message }, 401);
  }

  // Fail clearly instead of attempting a write that the host will refuse.
  if (!uploadsAvailable()) {
    return json({ ok: false, error: "Image uploads are not enabled on this deployment yet. You can save without an image and add one later." }, 503);
  }

  const limit = await rateLimit(`upload:${userId}`, UPLOADS_PER_WINDOW, UPLOAD_WINDOW_MS);
  if (!limit.ok) {
    return json({ ok: false, error: `Too many uploads. Please try again in ${limit.retryAfterSeconds} seconds.` }, 429, { "Retry-After": String(limit.retryAfterSeconds) });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json({ ok: false, error: "Invalid upload." }, 400);
  }

  const file = form.get("file");
  if (!(file instanceof File)) return json({ ok: false, error: "No file provided." }, 400);
  if (file.size > MAX_IMAGE_BYTES) return json({ ok: false, error: imageValidationMessage("size") }, 413);

  const invalid = validateImage({ size: file.size, type: file.type });
  if (invalid) {
    securityEvent("UPLOAD_REJECTED", { userId, kind, reason: invalid, declaredType: file.type, bytes: file.size });
    return json({ ok: false, error: imageValidationMessage(invalid) }, 400);
  }

  try {
    const data = Buffer.from(await file.arrayBuffer());
    // The bytes are authoritative: Content-Length and the declared type can both lie.
    const checked = validateImageBytes(data, file.type);
    if (!checked.ok) {
      securityEvent("UPLOAD_REJECTED", { userId, kind, reason: checked.error, declaredType: file.type, bytes: data.byteLength });
      return json({ ok: false, error: imageValidationMessage(checked.error) }, checked.error === "size" ? 413 : 400);
    }
    const storage = await getStorage();
    const stored = await storage.put({ data, contentType: checked.contentType, ext: checked.ext, prefix: uploadPrefix(kind, ownerId) });
    await recordAudit({
      userId,
      actorRole,
      action: "IMAGE_UPLOADED",
      entityType: entity.type,
      entityId: entity.id,
      metadata: { kind, url: stored.url, bytes: data.byteLength, contentType: checked.contentType },
    });
    return json({ ok: true, url: stored.url }, 200);
  } catch (err) {
    logServerError("upload", err, { kind });
    return json({ ok: false, error: `Could not upload the ${spec.label}. Please try again.` }, 500);
  }
}
