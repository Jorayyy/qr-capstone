"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Upload, X } from "lucide-react";
import { Button } from "@/components/ui";

type Kind = "face" | "id";

const MAX_WIDTH = 1024;

export default function PhotoCapture({
  label,
  kind,
  facing = "user",
  endpoint = "/api/uploads",
  onPath,
}: {
  label: string;
  kind: Kind;
  facing?: "user" | "environment";
  endpoint?: string;
  onPath: (pathname: string | null) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraOn(false);
  }, []);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  // The <video> element only mounts after `cameraOn` flips, so attach the
  // stream here rather than in startCamera (where the ref is still null).
  useEffect(() => {
    const video = videoRef.current;
    const stream = streamRef.current;
    if (cameraOn && video && stream) {
      video.srcObject = stream;
      void video.play().catch(() => {});
    }
  }, [cameraOn]);

  async function upload(blob: Blob, filename: string) {
    setBusy(true);
    setError("");
    try {
      const form = new FormData();
      const file = new File([blob], filename, { type: blob.type || "image/jpeg" });
      form.append("file", file);
      form.append("kind", kind);
      const res = await fetch(endpoint, { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Upload failed.");
      if (preview) URL.revokeObjectURL(preview);
      setPreview(URL.createObjectURL(blob));
      onPath(data.pathname as string);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  async function startCamera() {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: MAX_WIDTH } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraOn(true);
    } catch {
      setError("Camera unavailable. You can upload a photo instead.");
      stopCamera();
    }
  }

  function capture() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const scale = Math.min(1, MAX_WIDTH / video.videoWidth);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    stopCamera();
    canvas.toBlob((blob) => blob && upload(blob, `${kind}.jpg`), "image/jpeg", 0.85);
  }

  function onFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) upload(file, file.name);
    event.target.value = "";
  }

  function clear() {
    stopCamera();
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setError("");
    onPath(null);
  }

  return (
    <div>
      <label className="label">{label}</label>
      <div className="rounded-xl border border-[var(--border)] bg-slate-50 p-3">
        {preview ? (
          <img src={preview} alt={label} className="mx-auto max-h-56 w-auto rounded-lg bg-white object-contain" />
        ) : cameraOn ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="mx-auto max-h-56 w-full rounded-lg bg-black object-cover"
          />
        ) : (
          <div className="flex h-40 items-center justify-center text-xs text-[var(--muted)]">
            No photo yet
          </div>
        )}

        <div className="mt-3 flex flex-wrap gap-2">
          {preview ? (
            <>
              <Button type="button" variant="secondary" onClick={clear} disabled={busy}>
                <X className="h-4 w-4" />
                Remove
              </Button>
              <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-semibold hover:bg-slate-50">
                <Upload className="h-4 w-4" />
                Replace
                <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={onFile} />
              </label>
            </>
          ) : cameraOn ? (
            <>
              <Button type="button" onClick={capture} disabled={busy}>
                <Camera className="h-4 w-4" />
                {busy ? "Saving..." : "Capture"}
              </Button>
              <Button type="button" variant="secondary" onClick={stopCamera} disabled={busy}>
                Cancel
              </Button>
            </>
          ) : (
            <>
              <Button type="button" onClick={startCamera} disabled={busy}>
                <Camera className="h-4 w-4" />
                Take photo
              </Button>
              <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-semibold hover:bg-slate-50">
                <Upload className="h-4 w-4" />
                Upload
                <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={onFile} />
              </label>
            </>
          )}
          {busy && <span className="self-center text-xs text-[var(--muted)]">Uploading…</span>}
        </div>

        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      </div>
    </div>
  );
}
