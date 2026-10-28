"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, RefreshCw } from "lucide-react";
import { cx } from "@/components/ui";

export type CameraState = "idle" | "loading" | "ready" | "error";

type Props = {
  onScan: (text: string) => void;
  active: boolean;
  className?: string;
  onStateChange?: (state: CameraState) => void;
};

const START_TIMEOUT_MS = 10_000;
const SLOW_HINT_MS = 3_000;
const SCAN_INTERVAL_MS = 150;
const MAX_FRAME_WIDTH = 480;

type QrCodeResult = { data?: string } | null;
type JsQrFn = (data: Uint8ClampedArray, width: number, height: number) => QrCodeResult;
type Decoder = (source: HTMLVideoElement) => Promise<string | null> | string | null;

let cachedJsQr: Promise<JsQrFn | null> | null = null;

function loadJsQr(): Promise<JsQrFn | null> {
  cachedJsQr ??= import("jsqr")
    .then((mod) => {
      const fn = (mod as { default?: unknown }).default ?? mod;
      return typeof fn === "function" ? (fn as unknown as JsQrFn) : null;
    })
    .catch(() => null);
  return cachedJsQr;
}

/**
 * `BarcodeDetector` exists on Android / ChromeOS / macOS Chrome. On Windows
 * Chrome, Firefox and Safari it is missing, or present but advertising no QR
 * support — so an *empty* format list means "fall back", not "go native".
 */
async function nativeQrDecoder(): Promise<Decoder | null> {
  try {
    const ctor = (
      window as unknown as {
        BarcodeDetector?: {
          new (opts: { formats: string[] }): {
            detect(source: HTMLVideoElement): Promise<Array<{ rawValue?: string }>>;
          };
          getSupportedFormats?: () => Promise<string[]>;
        };
      }
    ).BarcodeDetector;
    if (!ctor) return null;
    const formats = ctor.getSupportedFormats ? await ctor.getSupportedFormats() : ["qr_code"];
    if (!formats.includes("qr_code")) return null;
    const detector = new ctor({ formats: ["qr_code"] });
    return async (video) => {
      const found = await detector.detect(video);
      return found?.[0]?.rawValue || null;
    };
  } catch {
    return null;
  }
}

function describeError(err: unknown): string {
  const name = err instanceof Error ? err.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") {
    return "Camera permission was denied. Allow camera access for this site, then try again.";
  }
  if (name === "NotFoundError" || name === "OverconstrainedError") {
    return "No usable camera was found on this device.";
  }
  if (name === "NotReadableError") {
    return "The camera is already in use by another app.";
  }
  return "Could not start the camera. Try again, or enter the code manually.";
}

/**
 * Shared camera surface for every QR scanner in the app.
 *
 * The component owns the `<video>` element outright (getUserMedia + a decode
 * loop), so there is no third-party layout code to negotiate with — the old
 * forced 1:1 aspect ratio and fixed 250 px viewfinder made several phone
 * cameras fail to start at all.
 */
export function CameraViewport({ onScan, active, className, onStateChange }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hintRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Bumped on every teardown so a superseded start() (rapid Tap-to-restart,
  // camera toggled mid-permission-prompt) can detect it is stale.
  const genRef = useRef(0);
  const onScanRef = useRef(onScan);
  const handleScanRef = useRef<(text: string) => void>(() => undefined);
  const [state, setState] = useState<CameraState>(active ? "loading" : "idle");
  const [message, setMessage] = useState(active ? "Starting camera…" : "");
  const [showSlowHint, setShowSlowHint] = useState(false);
  // Derived while inactive so effects only ever touch external systems (the
  // camera), never React state.
  const current = active ? state : "idle";

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    onStateChange?.(current);
  }, [current, onStateChange]);

  const teardown = useCallback(() => {
    genRef.current += 1;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (hintRef.current) clearTimeout(hintRef.current);
    timeoutRef.current = null;
    hintRef.current = null;
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = null;
    const stream = streamRef.current;
    streamRef.current = null;
    if (stream) {
      for (const track of stream.getTracks()) {
        try {
          track.stop();
        } catch {
          // Track may already be released.
        }
      }
    }
    const video = videoRef.current;
    if (video) {
      try {
        video.srcObject = null;
      } catch {
        // Older Safari throws when the stream is already detached.
      }
    }
  }, []);

  const start = useCallback(async () => {
    teardown();
    const gen = genRef.current;
    const stale = () => genRef.current !== gen;

    setShowSlowHint(false);
    setState("loading");
    setMessage("Starting camera…");

    timeoutRef.current = setTimeout(() => {
      if (stale()) return;
      teardown();
      setMessage("The camera is taking too long to start. Try again, or enter the code manually.");
      setState("error");
    }, START_TIMEOUT_MS);

    // A tap-to-retry affordance appears if the permission prompt or the
    // camera is not ready within a few seconds — Safari does not always
    // open the camera from an un-gesture'd getUserMedia call.
    hintRef.current = setTimeout(() => {
      if (!stale()) setShowSlowHint(true);
    }, SLOW_HINT_MS);

    const stopStream = (stream: MediaStream) => {
      for (const track of stream.getTracks()) {
        try {
          track.stop();
        } catch {
          // Track may already be released.
        }
      }
    };

    try {
      // Both engines resolve while the permission prompt is still on screen,
      // so the decoder download never sits in front of the live preview.
      const [nativeDecode, jsQr, media] = await Promise.all([
        nativeQrDecoder(),
        loadJsQr(),
        navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        }),
      ]);

      if (stale()) {
        stopStream(media);
        return;
      }

      streamRef.current = media;
      const video = videoRef.current;
      if (!video) throw new Error("Camera view missing");
      video.srcObject = media;
      await video.play();
      if (stale()) return;

      const decoder: Decoder | null =
        nativeDecode ?? (jsQr ? (source) => decodeJsQrFrame(jsQr, source, canvasRef) : null);
      if (!decoder) throw new Error("No QR decoder available");

      setState("ready");
      setMessage("");
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (hintRef.current) clearTimeout(hintRef.current);
      timeoutRef.current = null;
      hintRef.current = null;
      setShowSlowHint(false);

      let busy = false;
      pollRef.current = setInterval(async () => {
        if (stale() || busy) return;
        busy = true;
        try {
          const raw = await decoder(video);
          if (raw && !stale()) handleScanRef.current(raw);
        } catch {
          // Transient decode errors are expected — keep scanning.
        } finally {
          busy = false;
        }
      }, SCAN_INTERVAL_MS);
    } catch (err) {
      if (stale()) return;
      teardown();
      setMessage(describeError(err));
      setState("error");
    }
  }, [teardown]);

  useEffect(() => {
    handleScanRef.current = (text: string) => {
      const value = typeof text === "string" ? text.trim() : "";
      if (!value) return;
      teardown();
      onScanRef.current(value);
    };
  }, [teardown]);

  useEffect(() => {
    if (!active) {
      teardown();
      return;
    }
    // Kicked off on the next tick: starting the camera sets React state, and
    // doing that synchronously inside an effect cascades renders.
    const kick = setTimeout(() => void start(), 0);
    return () => {
      clearTimeout(kick);
      teardown();
    };
  }, [active, start, teardown]);

  return (
    <div
      className={cx(
        "relative aspect-[4/3] w-full overflow-hidden rounded-lg bg-black",
        className
      )}
    >
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        aria-hidden
        className={cx(
          "absolute inset-0 h-full w-full object-cover transition-opacity",
          current === "ready" ? "opacity-100" : "opacity-0"
        )}
      />

      {current !== "ready" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
          {current === "error" ? (
            <Camera className="h-10 w-10 text-white/40" />
          ) : (
            <span className="h-9 w-9 animate-spin rounded-full border-2 border-white/25 border-t-white" />
          )}
          <p className="max-w-xs text-sm text-white/85">
            {current === "idle" ? "Camera is off." : message}
          </p>
          {current !== "error" && current !== "idle" && (
            <span className="h-1 w-40 overflow-hidden rounded-full bg-white/20">
              <span className="block h-full w-1/3 animate-pulse rounded-full bg-white/70" />
            </span>
          )}
          {active && (current === "error" || showSlowHint) && (
            <button
              type="button"
              onClick={() => void start()}
              className="mt-1 inline-flex min-h-11 items-center gap-2 rounded-lg bg-[var(--surface)] px-4 py-2 text-sm font-semibold text-[var(--foreground)]"
            >
              <RefreshCw className="h-4 w-4" />
              {current === "error" ? "Try again" : "Tap to start camera"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function decodeJsQrFrame(
  jsQr: JsQrFn,
  video: HTMLVideoElement,
  canvasRef: React.MutableRefObject<HTMLCanvasElement | null>
): string | null {
  const width = video.videoWidth;
  const height = video.videoHeight;
  if (!width || !height) return null;

  canvasRef.current ??= document.createElement("canvas");
  const canvas = canvasRef.current;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;

  const scale = Math.min(1, MAX_FRAME_WIDTH / width);
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }

  ctx.drawImage(video, 0, 0, w, h);
  const frame = ctx.getImageData(0, 0, w, h);
  return jsQr(frame.data, frame.width, frame.height)?.data ?? null;
}
