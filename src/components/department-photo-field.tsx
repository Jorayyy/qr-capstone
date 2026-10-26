"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2, Upload, X } from "lucide-react";
import { buttonClass } from "@/components/ui";

const MAX_BYTES = 5 * 1024 * 1024;

/** Uploads a department photo to Blob and keeps the resulting pathname in a hidden field. */
export function DepartmentPhotoField({ initialPath }: { initialPath?: string | null }) {
  const [path, setPath] = useState(initialPath ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
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

  return (
    <div>
      <label className="label">Department Photo (Optional)</label>
      <p className="mb-2 text-xs text-[var(--muted)]">Landscape photo, at least 1000 × 600 px.</p>
      <input type="hidden" name="photoPath" value={path} />

      <div className="relative h-40 overflow-hidden rounded-xl border border-dashed border-[var(--border)] bg-slate-50">
        {path ? (
          <img
            src={`/api/department-photo?path=${encodeURIComponent(path)}`}
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
          <div className="absolute inset-0 flex items-center justify-center bg-white/70">
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
            className={buttonClass("ghost", "min-h-9 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50")}
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

      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
      <p className="mt-1 text-xs text-[var(--muted)]">
        JPEG, PNG or WebP, up to 5 MB. Shown on the visitor landing page.
      </p>
    </div>
  );
}
