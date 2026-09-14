"use client";

/* eslint-disable @next/next/no-img-element */
import * as React from "react";
import { AlertCircleIcon, CheckCircle2Icon, ImageIcon, Loader2Icon, Trash2Icon, UploadCloudIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ACCEPT = "image/jpeg,image/png,image/webp";
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/png", "image/webp"];

type Status = "idle" | "uploading" | "success" | "error";

/**
 * Reusable image uploader. Uploads to `endpoint` and writes the resulting URL
 * into a hidden input named `name`, so it plugs into ordinary <form action>
 * server-action submissions. Pass `initialUrl` to show an existing image
 * (legacy URL or a previously uploaded path) — it stays until replaced/removed.
 */
export function ImageUpload({
  name,
  initialUrl,
  endpoint = "/api/uploads/product-image",
  label = "Upload image",
  helpText = "Upload JPG, PNG, or WebP. Maximum size: 5 MB.",
  aspect = "aspect-video",
}: {
  name: string;
  initialUrl?: string | null;
  endpoint?: string;
  label?: string;
  helpText?: string;
  aspect?: string;
}) {
  const [url, setUrl] = React.useState<string>(initialUrl ?? "");
  const [status, setStatus] = React.useState<Status>("idle");
  const [message, setMessage] = React.useState<string>("");
  const [dragging, setDragging] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const fieldId = React.useId();

  function clientValidate(file: File): string | null {
    if (!ALLOWED.includes(file.type)) return "Unsupported file type. Upload a JPG, PNG or WebP image.";
    if (file.size > MAX_BYTES) return "Image is too large. Maximum size is 5 MB.";
    return null;
  }

  async function upload(file: File) {
    const invalid = clientValidate(file);
    if (invalid) {
      setStatus("error");
      setMessage(invalid);
      return;
    }
    setStatus("uploading");
    setMessage("");
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch(endpoint, { method: "POST", body });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; url?: string; error?: string } | null;
      if (!res.ok || !data?.ok || !data.url) {
        setStatus("error");
        setMessage(data?.error ?? "Upload failed. Please try again.");
        return;
      }
      setUrl(data.url);
      setStatus("success");
      setMessage("Image uploaded.");
    } catch {
      setStatus("error");
      setMessage("Network error during upload. Please try again.");
    }
  }

  function onFiles(files: FileList | null) {
    const file = files?.[0];
    if (file) void upload(file);
  }

  function remove() {
    setUrl("");
    setStatus("idle");
    setMessage("");
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="space-y-2">
      {/* Value consumed by the enclosing <form> server action. */}
      <input type="hidden" name={name} value={url} />
      <input
        ref={inputRef}
        id={fieldId}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        aria-label={label}
        onChange={(e) => onFiles(e.target.files)}
      />

      {url ? (
        <div className="space-y-2">
          <div className={cn("relative overflow-hidden rounded-xl border bg-muted", aspect)}>
            <img src={url} alt="Selected product image" className="size-full object-contain" />
            {status === "uploading" ? (
              <div className="absolute inset-0 grid place-items-center bg-background/60">
                <Loader2Icon className="size-6 animate-spin text-primary" />
              </div>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={status === "uploading"}>
              <UploadCloudIcon /> Replace image
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={remove} disabled={status === "uploading"}>
              <Trash2Icon /> Remove
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            onFiles(e.dataTransfer.files);
          }}
          className={cn(
            "flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-6 py-10 text-center transition-colors",
            "hover:bg-muted/50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
            dragging ? "border-primary bg-primary/5" : "border-input",
          )}
          aria-describedby={`${fieldId}-help`}
        >
          {status === "uploading" ? (
            <Loader2Icon className="size-6 animate-spin text-primary" aria-hidden />
          ) : (
            <span className="flex size-10 items-center justify-center rounded-full bg-accent text-accent-foreground">
              <ImageIcon className="size-5" aria-hidden />
            </span>
          )}
          <span className="text-sm font-medium">{status === "uploading" ? "Uploading…" : label}</span>
          <span className="text-xs text-muted-foreground">Drag &amp; drop, or click to browse</span>
        </button>
      )}

      <p id={`${fieldId}-help`} className="text-xs text-muted-foreground">
        {helpText}
      </p>
      {status === "error" && message ? (
        <p role="alert" className="flex items-center gap-1.5 text-xs text-destructive">
          <AlertCircleIcon className="size-3.5" /> {message}
        </p>
      ) : null}
      {status === "success" && message ? (
        <p className="flex items-center gap-1.5 text-xs text-primary">
          <CheckCircle2Icon className="size-3.5" /> {message}
        </p>
      ) : null}
    </div>
  );
}
