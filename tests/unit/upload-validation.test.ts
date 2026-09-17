import { describe, expect, it } from "vitest";
import { looksLikeMarkupOrScript, sniffImageType } from "@/lib/storage/image-sniff";
import { imageValidationMessage, makeObjectName, MAX_IMAGE_BYTES, sanitizePrefix, validateImage, validateImageBytes } from "@/lib/storage/image-validation";

// --- byte fixtures (built in memory; no binary files in the repo) -----------
const pad = (bytes: number[], length = 64) => new Uint8Array([...bytes, ...new Array(Math.max(0, length - bytes.length)).fill(0)]);
const JPEG = pad([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00]);
const PNG = pad([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52]);
const WEBP = pad([0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x20]);
const text = (s: string) => new TextEncoder().encode(s);
const SVG = text('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
const HTML = text("<!DOCTYPE html><html><body>hi</body></html>");
const XML_BOM = new Uint8Array([0xef, 0xbb, 0xbf, ...text('  <?xml version="1.0"?><svg/>')]);
const PDF = text("%PDF-1.7 ...");
const GIF = pad([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
const BMP = pad([0x42, 0x4d, 0x36, 0x00]);
const EXE = pad([0x4d, 0x5a, 0x90, 0x00]);
const ELF = pad([0x7f, 0x45, 0x4c, 0x46]);
const SHELL = text("#!/bin/sh\nrm -rf /");
const RIFF_WAV = pad([0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45]);

describe("magic-byte sniffing", () => {
  it("recognises JPEG, PNG and WebP", () => {
    expect(sniffImageType(JPEG)).toBe("image/jpeg");
    expect(sniffImageType(PNG)).toBe("image/png");
    expect(sniffImageType(WEBP)).toBe("image/webp");
  });

  it("rejects everything else, including other RIFF containers and truncated headers", () => {
    for (const buf of [SVG, HTML, XML_BOM, PDF, GIF, BMP, EXE, ELF, SHELL, RIFF_WAV, new Uint8Array(0), new Uint8Array([0xff, 0xd8])]) {
      expect(sniffImageType(buf)).toBeNull();
    }
    expect(sniffImageType(new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42]))).toBeNull(); // 11 bytes: too short for WEBP
  });

  it("flags markup, scripts and executables even after BOM/whitespace", () => {
    for (const buf of [SVG, HTML, XML_BOM, PDF, EXE, ELF, SHELL, text("\n\t <html>")]) expect(looksLikeMarkupOrScript(buf)).toBe(true);
    for (const buf of [JPEG, PNG, WEBP, GIF]) expect(looksLikeMarkupOrScript(buf)).toBe(false);
  });
});

describe("upload validation — declared metadata pre-check", () => {
  it("accepts allowed types within the size limit", () => {
    expect(validateImage({ size: 1024, type: "image/jpeg" })).toBeNull();
    expect(validateImage({ size: MAX_IMAGE_BYTES, type: "image/webp" })).toBeNull();
  });
  it("rejects empty, oversized and disallowed declared types", () => {
    expect(validateImage({ size: 0, type: "image/png" })).toBe("empty");
    expect(validateImage({ size: MAX_IMAGE_BYTES + 1, type: "image/png" })).toBe("size");
    expect(validateImage({ size: 10, type: "image/svg+xml" })).toBe("type");
    expect(validateImage({ size: 10, type: "image/gif" })).toBe("type");
    expect(validateImage({ size: 10, type: "text/html" })).toBe("type");
    expect(validateImage({ size: 10, type: "" })).toBe("type");
  });
});

describe("upload validation — bytes are authoritative", () => {
  it("accepts real images whose declared type matches and derives extension from the bytes", () => {
    expect(validateImageBytes(JPEG, "image/jpeg")).toEqual({ ok: true, contentType: "image/jpeg", ext: "jpg" });
    expect(validateImageBytes(PNG, "image/png")).toEqual({ ok: true, contentType: "image/png", ext: "png" });
    expect(validateImageBytes(WEBP, "image/webp")).toEqual({ ok: true, contentType: "image/webp", ext: "webp" });
  });

  it("rejects spoofed MIME types (declared image/png, actual JPEG, etc.)", () => {
    expect(validateImageBytes(JPEG, "image/png")).toEqual({ ok: false, error: "mismatch" });
    expect(validateImageBytes(PNG, "image/webp")).toEqual({ ok: false, error: "mismatch" });
    expect(validateImageBytes(WEBP, "image/jpeg")).toEqual({ ok: false, error: "mismatch" });
  });

  it("rejects script-like, markup and executable content regardless of declared type", () => {
    for (const buf of [SVG, HTML, XML_BOM, PDF, EXE, ELF, SHELL]) {
      expect(validateImageBytes(buf, "image/png")).toEqual({ ok: false, error: "content" });
    }
  });

  it("rejects non-image binaries and malformed/truncated data", () => {
    for (const buf of [GIF, BMP, RIFF_WAV, new Uint8Array([0xff, 0xd8]), new Uint8Array([0x89, 0x50, 0x4e])]) {
      expect(validateImageBytes(buf, "image/jpeg")).toEqual({ ok: false, error: "content" });
    }
  });

  it("rejects empty and oversized payloads", () => {
    expect(validateImageBytes(new Uint8Array(0), "image/png")).toEqual({ ok: false, error: "empty" });
    const big = new Uint8Array(MAX_IMAGE_BYTES + 1);
    big.set([0xff, 0xd8, 0xff]);
    expect(validateImageBytes(big, "image/jpeg")).toEqual({ ok: false, error: "size" });
  });

  it("has a user-facing message for every error", () => {
    for (const e of ["type", "size", "empty", "content", "mismatch"] as const) expect(imageValidationMessage(e).length).toBeGreaterThan(10);
  });
});

describe("safe filename and prefix handling", () => {
  it("generates object names that never contain client input and always use the sniffed extension", () => {
    const name = makeObjectName(JPEG, "jpg");
    expect(name).toMatch(/^[a-z0-9]+-[0-9a-f]{12}-[0-9a-f]{8}\.jpg$/);
    expect(makeObjectName(PNG, "../../etc/passwd")).toMatch(/\.etcpasswd$/); // ext sanitised — no separators
    expect(makeObjectName(PNG, "")).toMatch(/\.bin$/);
    expect(makeObjectName(PNG, "PNG")).toMatch(/\.png$/);
    expect(makeObjectName(JPEG, "jpg")).not.toBe(makeObjectName(JPEG, "jpg")); // random suffix
  });

  it("sanitises storage prefixes against traversal and odd characters", () => {
    expect(sanitizePrefix("products/brand_1")).toBe("products/brand_1");
    expect(sanitizePrefix("../../etc")).toBe("etc");
    expect(sanitizePrefix("/products//x/")).toBe("products/x");
    expect(sanitizePrefix("pro ducts$%^&*")).toBe("products");
    expect(sanitizePrefix(undefined)).toBe("misc");
    expect(sanitizePrefix("../")).toBe("misc");
  });
});
