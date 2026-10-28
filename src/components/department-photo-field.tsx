"use client";

import { useRef, useState } from "react";
import { ImagePlus, Link2, Loader2, Upload, X } from "lucide-react";
import { buttonClass } from "@/components/ui";
import { departmentPhotoSrc } from "@/lib/photos";

const MAX_BYTES = 5 * 1024 * 1024;

/** Uploads a department photo to Blob and keeps the resulting pathname in a hidden field. */
export function DepartmentPhotoField({ initialPath }: { initialPath?: string | null }) {
  const [path, setPath] = useState(initialPath ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [link, setLink] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (file.size > MAX_BYTES) {
      setError("Image must be 5 MB or smaller.");
      return;
    }

    try {
      const bitmap = await createImageBitmap(file);
      const tooSmall = bitmap.width < 1000 || bitmap.height < 600;
      bitmap.close();
      if (tooSmall) {
        setError("Use a sharper photo, at least 1000 × 600 px, so the preview stays clear.");
        return;
      }
    } catch {
      // Browsers without createImageBitmap still upload; the server validates type and size.
    }

    setBusy(true);
    setError("");
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("kind", "department");
      const res = await fetch("/api/uploads", { method: "POST", body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Upload failed.");
      setPath(data.pathname as string);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  function useLink() {
    const value = link.trim();
    if (!/^https:\/\/[^\s]+$/i.test(value)) {
      setError("Paste a full https image link.");
      return;
    }
    setPath(value);
    setLink("");
    setError("");
  }

  return (
    <div>
      <label className="label">Department Photo (Optional)</label>
      <p className="mb-2 text-xs text-[var(--muted)]">Landscape photo, at least 1000 × 600 px.</p>
      <input type="hidden" name="photoPath" value={path} />

      <div className="relative h-40 overflow-hidden rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface-muted)]">
        {path ? (
          <img
            src={departmentPhotoSrc(path) ?? undefined}
            alt="Department photo"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-1 text-[var(--muted)]">
            <ImagePlus className="h-6 w-6" />
            <p className="text-xs">No photo yet</p>
          </div>
        )}
        {busy ? (
          <div className="absolute inset-0 flex items-center justify-center bg-[var(--surface)]/70">
            <Loader2 className="h-5 w-5 animate-spin text-[var(--brand)]" />
          </div>
        ) : null}
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className={buttonClass("secondary", "min-h-9 px-3 py-1.5 text-xs")}
        >
          <Upload className="h-3.5 w-3.5" />
          {path ? "Replace photo" : "Upload photo"}
        </button>
        {path ? (
          <button
            type="button"
            onClick={() => setPath("")}
            disabled={busy}
            className={buttonClass("ghost", "min-h-9 px-3 py-1.5 text-xs text-[var(--danger)] hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]")}
          >
            <X className="h-3.5 w-3.5" />
            Remove
          </button>
        ) : null}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFile}
        className="hidden"
      />

      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <input
          type="url"
          value={link}
          onChange={(event) => setLink(event.target.value)}
          placeholder="or paste an image link (https://…)"
          className="field min-h-9 py-1.5 text-xs"
          aria-label="Department photo image link"
        />
        <button
          type="button"
          onClick={useLink}
          disabled={busy || !link.trim()}
          className={buttonClass("secondary", "min-h-9 shrink-0 px-3 py-1.5 text-xs")}
        >
          <Link2 className="h-3.5 w-3.5" />
          Use link
        </button>
      </div>

      {error ? <p className="mt-1 text-xs text-[var(--danger)]">{error}</p> : null}
      <p className="mt-1 text-xs text-[var(--muted)]">
        Upload a file or paste a link. JPEG, PNG or WebP up to 5 MB; use at least 1000 × 600 px.
      </p>
    </div>
  );
}
