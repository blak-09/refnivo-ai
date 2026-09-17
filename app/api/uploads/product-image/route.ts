import { NextResponse } from "next/server";
import { assertBrandOwner } from "@/lib/auth/guards";
import { recordAudit } from "@/lib/services/audit";
import { getStorage, imageValidationMessage, MAX_IMAGE_BYTES, validateImage, validateImageBytes } from "@/lib/storage";
import { rateLimit } from "@/lib/utils/rate-limit";
import { securityEvent } from "@/lib/utils/security-log";

export const runtime = "nodejs";

const UPLOADS_PER_WINDOW = 30;
const UPLOAD_WINDOW_MS = 10 * 60 * 1000;

/**
 * Uploads a single product image. Brand-owner only.
 *
 * Order of checks: auth → rate limit → multipart parse → declared metadata
 * (cheap pre-check) → actual bytes (size re-check, executable/markup rejection,
 * magic-byte sniff, declared-vs-sniffed agreement). The stored content type and
 * extension come from the sniffed bytes, never from the client; the client's
 * filename is never used.
 */
export async function POST(request: Request) {
  let ctx;
  try {
    ctx = await assertBrandOwner();
  } catch {
    return NextResponse.json({ ok: false, error: "You must be signed in as a brand owner." }, { status: 401 });
  }

  const limit = await rateLimit(`upload:${ctx.user.id}`, UPLOADS_PER_WINDOW, UPLOAD_WINDOW_MS);
  if (!limit.ok) {
    return NextResponse.json(
      { ok: false, error: `Too many uploads. Please try again in ${limit.retryAfterSeconds} seconds.` },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid upload." }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "No file provided." }, { status: 400 });
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return NextResponse.json({ ok: false, error: imageValidationMessage("size") }, { status: 413 });
  }

  const invalid = validateImage({ size: file.size, type: file.type });
  if (invalid) {
    securityEvent("UPLOAD_REJECTED", { userId: ctx.user.id, reason: invalid, declaredType: file.type, bytes: file.size });
    return NextResponse.json({ ok: false, error: imageValidationMessage(invalid) }, { status: 400 });
  }

  try {
    const data = Buffer.from(await file.arrayBuffer());
    // The bytes are authoritative: Content-Length and the declared type can both lie.
    const checked = validateImageBytes(data, file.type);
    if (!checked.ok) {
      securityEvent("UPLOAD_REJECTED", { userId: ctx.user.id, reason: checked.error, declaredType: file.type, bytes: data.byteLength });
      return NextResponse.json({ ok: false, error: imageValidationMessage(checked.error) }, { status: checked.error === "size" ? 413 : 400 });
    }
    const storage = await getStorage();
    const stored = await storage.put({ data, contentType: checked.contentType, ext: checked.ext, prefix: `products/${ctx.brand.id}` });
    await recordAudit({
      userId: ctx.user.id,
      actorRole: ctx.user.role,
      action: "PRODUCT_IMAGE_UPLOADED",
      entityType: "Brand",
      entityId: ctx.brand.id,
      metadata: { url: stored.url, bytes: data.byteLength, contentType: checked.contentType },
    });
    return NextResponse.json({ ok: true, url: stored.url });
  } catch (err) {
    console.error("[upload/product-image] failed", err instanceof Error ? err.message : err);
    return NextResponse.json({ ok: false, error: "Upload failed. Please try again." }, { status: 500 });
  }
}
