import { NextResponse } from "next/server";
import { assertBrandOwner } from "@/lib/auth/guards";
import { recordAudit } from "@/lib/services/audit";
import {
  getStorage,
  IMAGE_EXT_BY_TYPE,
  imageValidationMessage,
  MAX_IMAGE_BYTES,
  validateImage,
} from "@/lib/storage";

export const runtime = "nodejs";

/**
 * Uploads a single product image. Brand-owner only. All validation is repeated
 * server-side — the client checks are only for UX.
 */
export async function POST(request: Request) {
  let ctx;
  try {
    ctx = await assertBrandOwner();
  } catch {
    return NextResponse.json({ ok: false, error: "You must be signed in as a brand owner." }, { status: 401 });
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
    return NextResponse.json({ ok: false, error: imageValidationMessage(invalid) }, { status: 400 });
  }

  try {
    const data = Buffer.from(await file.arrayBuffer());
    // Re-check size after reading the actual bytes (client Content-Length can lie).
    if (data.byteLength > MAX_IMAGE_BYTES) {
      return NextResponse.json({ ok: false, error: imageValidationMessage("size") }, { status: 413 });
    }
    const ext = IMAGE_EXT_BY_TYPE[file.type];
    const storage = await getStorage();
    const stored = await storage.put({ data, contentType: file.type, ext, prefix: `products/${ctx.brand.id}` });
    await recordAudit({ userId: ctx.user.id, action: "PRODUCT_IMAGE_UPLOADED", entityType: "Brand", entityId: ctx.brand.id, metadata: { url: stored.url } });
    return NextResponse.json({ ok: true, url: stored.url });
  } catch (err) {
    console.error("[upload/product-image] failed", err instanceof Error ? err.message : err);
    return NextResponse.json({ ok: false, error: "Upload failed. Please try again." }, { status: 500 });
  }
}
