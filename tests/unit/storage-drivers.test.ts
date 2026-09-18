import { describe, expect, it, vi } from "vitest";
import { isUploadKind, UPLOAD_KINDS, uploadPrefix } from "@/lib/storage/upload-kinds";
import { isHostedImage, storagePublicOrigin } from "@/lib/storage/hosted-image";
import { uploadsAvailable } from "@/lib/storage/availability";

const env = (v: Record<string, string>) => v as NodeJS.ProcessEnv;

describe("upload kinds (one pipeline for every image)", () => {
  it("knows every kind and derives the prefix from the session owner only", () => {
    expect(Object.keys(UPLOAD_KINDS).sort()).toEqual(["avatar", "brand-cover", "brand-logo", "creator-image", "product-image"]);
    expect(isUploadKind("product-image")).toBe(true);
    expect(isUploadKind("../etc")).toBe(false);
    expect(isUploadKind("__proto__")).toBe(false);
    expect(uploadPrefix("brand-logo", "brand_1")).toBe("brands/logo/brand_1");
    expect(uploadPrefix("avatar", "u1")).toBe("avatars/u1");
  });
});

describe("hosted image allow-list (next/image never becomes an open proxy)", () => {
  it("optimises local uploads and the configured bucket, nothing else", () => {
    const e = env({ NEXT_PUBLIC_STORAGE_PUBLIC_URL: "https://abc.supabase.co/storage/v1/object/public/uploads" });
    expect(storagePublicOrigin(e)).toBe("https://abc.supabase.co");
    expect(isHostedImage("/uploads/products/x/a.webp", e)).toBe(true);
    expect(isHostedImage("https://abc.supabase.co/storage/v1/object/public/uploads/a.png", e)).toBe(true);
    expect(isHostedImage("https://evil.example/a.png", e)).toBe(false);
    expect(isHostedImage("https://cdn.brand.com/logo.png", env({}))).toBe(false);
    expect(isHostedImage(null, e)).toBe(false);
    expect(storagePublicOrigin(env({ NEXT_PUBLIC_STORAGE_PUBLIC_URL: "not a url" }))).toBeNull();
  });
});

describe("uploadsAvailable with the supabase provider", () => {
  it("needs both the URL and the service key", () => {
    expect(uploadsAvailable(env({ NODE_ENV: "production", STORAGE_PROVIDER: "supabase" }))).toBe(false);
    expect(uploadsAvailable(env({ NODE_ENV: "production", STORAGE_PROVIDER: "supabase", SUPABASE_URL: "https://x.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "k" }))).toBe(true);
    expect(uploadsAvailable(env({ NODE_ENV: "production", STORAGE_PROVIDER: "r2" }))).toBe(false);
  });
});

describe("Supabase Storage driver (REST, mocked fetch)", () => {
  it("uploads under the sanitised prefix with the service key server-side and returns the public URL", async () => {
    vi.resetModules();
    vi.doMock("server-only", () => ({}));
    const { SupabaseStorageDriver, supabaseStorageConfig } = await import("@/lib/storage/supabase");
    const cfg = supabaseStorageConfig(env({ SUPABASE_URL: "https://abc.supabase.co/", SUPABASE_SERVICE_ROLE_KEY: "service-key", SUPABASE_STORAGE_BUCKET: "uploads" }));
    expect(cfg).toEqual({ url: "https://abc.supabase.co", serviceKey: "service-key", bucket: "uploads", publicBase: "https://abc.supabase.co/storage/v1/object/public/uploads" });

    const calls: { url: string; init: RequestInit }[] = [];
    const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init: init ?? {} });
      return new Response(JSON.stringify({ Key: "ok" }), { status: 200 });
    }) as typeof fetch;
    const driver = new SupabaseStorageDriver(cfg!, fetchImpl);
    const stored = await driver.put({ data: Buffer.from("png-bytes"), contentType: "image/png", ext: "png", prefix: "products/../brand 1" });
    expect(stored.url).toMatch(/^https:\/\/abc\.supabase\.co\/storage\/v1\/object\/public\/uploads\/products\/brand1\/[a-z0-9]+-[a-f0-9]{12}-[a-f0-9]{8}\.png$/);
    expect(calls[0].url).toBe(`https://abc.supabase.co/storage/v1/object/uploads/${stored.key}`);
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer service-key");
    expect(headers["Content-Type"]).toBe("image/png");

    // Failure surfaces the status but never the key.
    const failing = new SupabaseStorageDriver(cfg!, (async () => new Response("Bucket not found", { status: 404 })) as typeof fetch);
    await expect(failing.put({ data: Buffer.from("x"), contentType: "image/png", ext: "png" })).rejects.toThrow(/404.*Bucket not found/);
    await expect(failing.put({ data: Buffer.from("x"), contentType: "image/png", ext: "png" })).rejects.not.toThrow(/service-key/);

    // remove() accepts the public URL and deletes the object key.
    await driver.remove(stored.url);
    expect(calls.at(-1)?.init.method).toBe("DELETE");
    expect(calls.at(-1)?.url).toBe(`https://abc.supabase.co/storage/v1/object/uploads/${stored.key}`);
  });
});
