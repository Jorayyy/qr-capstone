"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Loader2, ScanLine, Upload, X } from "lucide-react";
import { Button } from "@/components/ui";
import { parseIdCardText, type OcrResult } from "@/lib/registration";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/png", "image/webp"];

type Status = "idle" | "uploading" | "reading" | "done" | "error";

/**
 * Captures or uploads the ID front side, stores it privately, and runs
 * Tesseract OCR in the browser. Failure is never fatal — the visitor keeps
 * typing and the photo stays as the staff-facing ID record.
 */
export default function IdScan({
  onPath,
  onExtract,
}: {
  onPath: (pathname: string | null) => void;
  onExtract: (fields: OcrResult) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraOn(false);
  }, []);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (cameraOn && video && streamRef.current) {
      video.srcObject = streamRef.current;
      void video.play().catch(() => {});
    }
  }, [cameraOn]);

  async function readText(file: File) {
    setStatus("reading");
    setProgress(0);
    try {
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker("eng", 1, {
        logger: (log) => {
          if (log.status === "recognizing text" && typeof log.progress === "number") {
            setProgress(Math.round(log.progress * 100));
          }
        },
      });
      try {
        const { data } = await worker.recognize(file);
        onExtract(parseIdCardText(data.text));
        setStatus("done");
        setMessage("We filled in what we could read. Please check every field.");
      } finally {
        await worker.terminate();
      }
    } catch {
      setStatus("error");
      setMessage("The ID could not be read automatically. Type the details on the next step.");
    }
  }

  async function accept(file: File) {
    if (!ALLOWED.includes(file.type)) {
      setStatus("error");
      setMessage("Use a JPG, PNG or WebP photo of your ID.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setStatus("error");
      setMessage("The ID photo must be 5 MB or smaller.");
      return;
    }

    if (preview) URL.revokeObjectURL(preview);
    setPreview(URL.createObjectURL(file));
    setMessage("");
    setStatus("uploading");

    try {
      const form = new FormData();
      form.append("file", file);
      form.append("kind", "id");
      const res = await fetch("/api/register/uploads", { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Upload failed.");
      onPath(data.pathname as string);
    } catch {
      onPath(null);
      setMessage("The ID photo did not upload. You can still continue and show it at the gate.");
    }

    await readText(file);
  }

  function onFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) void accept(file);
    event.target.value = "";
  }

  async function startCamera() {
    setMessage("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraOn(true);
    } catch {
      setMessage("Camera unavailable. Upload a photo instead.");
      stopCamera();
    }
  }

  function capture() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    stopCamera();
    canvas.toBlob((blob) => {
      if (!blob) return;
      void accept(new File([blob], "id.jpg", { type: "image/jpeg" }));
    }, "image/jpeg", 0.9);
  }

  function clear() {
    stopCamera();
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setStatus("idle");
    setMessage("");
    setProgress(0);
    onPath(null);
  }

  const busy = status === "uploading" || status === "reading";

  return (
    <div>
      <div className="rounded-xl border border-[var(--border)] bg-slate-50 p-3">
        {preview ? (
          <img src={preview} alt="Uploaded ID" className="mx-auto max-h-56 w-auto rounded-lg bg-white object-contain" />
        ) : cameraOn ? (
          <video ref={videoRef} autoPlay playsInline muted className="mx-auto max-h-56 w-full rounded-lg bg-black object-cover" />
        ) : (
          <label className="flex h-40 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-[var(--brand)]/25 bg-white text-center text-sm text-[var(--muted)] transition hover:border-[var(--brand)]/50">
            <Upload className="h-7 w-7 text-[var(--brand)]/60" />
            <span className="font-semibold text-[var(--brand)]">Upload your ID</span>
            <span className="px-6 text-xs">Click to upload or drag the front side here — JPG, PNG, WebP (max 5 MB)</span>
            <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={onFile} />
          </label>
        )}

        <div className="mt-3 flex flex-wrap gap-2">
          {cameraOn ? (
            <>
              <Button type="button" onClick={capture} disabled={busy}>
                <Camera className="h-4 w-4" />
                Capture ID
              </Button>
              <Button type="button" variant="secondary" onClick={stopCamera}>
                Cancel
              </Button>
            </>
          ) : (
            <>
              <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-semibold hover:bg-slate-50">
                <Upload className="h-4 w-4" />
                Upload image
                <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={onFile} />
              </label>
              <Button type="button" variant="secondary" onClick={startCamera} disabled={busy}>
                <Camera className="h-4 w-4" />
                Use camera
              </Button>
              {preview && (
                <Button type="button" variant="ghost" onClick={clear} disabled={busy}>
                  <X className="h-4 w-4" />
                  Remove
                </Button>
              )}
            </>
          )}
        </div>

        {busy && (
          <p className="mt-3 flex items-center gap-2 text-xs font-medium text-[var(--brand)]">
            <Loader2 className="h-4 w-4 animate-spin" />
            {status === "uploading" ? "Uploading your ID…" : `Reading your ID… ${progress}%`}
          </p>
        )}
        {status === "done" && (
          <p className="mt-3 flex items-center gap-2 text-xs font-medium text-emerald-700">
            <ScanLine className="h-4 w-4" />
            {message}
          </p>
        )}
        {status === "error" && <p className="mt-3 text-xs text-amber-700">{message}</p>}
      </div>
    </div>
  );
}
