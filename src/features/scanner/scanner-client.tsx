"use client";

import { useCallback, useState, useTransition } from "react";
import { Card, CardHeader, Input, Button, Badge, Select, buttonClass } from "@/components/ui";
import { checkInAction, checkOutAction, addVisitStopAction, checkInStopAction, checkOutStopAction } from "@/lib/actions/visitors";
import { PH_TZ } from "@/lib/ph-time";
import { QrCode, Search, CheckCircle, XCircle, LogIn, LogOut, Camera, X, Keyboard, MapPin, Plus, Upload } from "lucide-react";
import { CameraViewport, type CameraState } from "@/components/camera-viewport";

type VisitStopInfo = {
  id: string;
  departmentId?: string;
  department?: { name: string } | null;
  building?: string | null;
  checkedInAt?: string | null;
  checkedOutAt?: string | null;
};

type VisitResult = {
  id: string;
  status?: string;
  purpose?: string;
  hostName?: string | null;
  actualArrival?: string | null;
  actualDeparture?: string | null;
  qrCode?: string;
  visitor?: {
    firstName?: string;
    lastName?: string;
    photoUrl?: string | null;
    idPhotoUrl?: string | null;
  } | null;
  department?: { name?: string } | null;
  stops?: VisitStopInfo[];
};

function formatDate(d?: Date | string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: PH_TZ,
  });
}

const STATUS_BADGE: Record<string, { tone: "brand" | "green" | "red" | "gray" }> = {
  PENDING: { tone: "brand" },
  CHECKED_IN: { tone: "green" },
  CHECKED_OUT: { tone: "gray" },
  CANCELLED: { tone: "red" },
};

type Decoder = (data: Uint8ClampedArray, width: number, height: number) => { data?: string } | null;

/** Decodes a QR code out of an uploaded image file (screenshot, photo, download). */
async function decodeQrFromImage(file: File): Promise<string | null> {
  const mod = await import("jsqr");
  const jsQr = (((mod as { default?: unknown }).default ?? mod) as unknown) as Decoder;
  if (typeof jsQr !== "function") return null;

  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Could not load image"));
      img.src = url;
    });

    const scale = Math.min(1, 1200 / Math.max(image.width, image.height));
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(image, 0, 0, width, height);
    const frame = ctx.getImageData(0, 0, width, height);
    return jsQr(frame.data, frame.width, frame.height)?.data?.trim() || null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function ScannerPage() {
  const [mode, setMode] = useState<"camera" | "manual" | "upload">("camera");
  const [qrInput, setQrInput] = useState("");
  const [result, setResult] = useState<VisitResult | null>(null);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [uploading, setUploading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [cameraOn, setCameraOn] = useState(true);
  const [cameraState, setCameraState] = useState<CameraState>("idle");
  const [departments, setDepartments] = useState<Array<{ id: string; name: string; building: string | null }>>([]);
  const [stopDept, setStopDept] = useState("");
  const [stopBuilding, setStopBuilding] = useState("");

  const lookupVisit = useCallback(async (qrCode: string) => {
    setCameraOn(false);
    setError("");
    setResult(null);
    setFeedback("");
    try {
      const res = await fetch(`/api/visits/lookup?qr=${encodeURIComponent(qrCode.trim())}`);
      if (!res.ok) {
        setError("No visit found with this QR code.");
        return;
      }
      const data = await res.json();
      setResult(data);
      fetch("/api/departments").then((r) => r.json()).then(setDepartments);
    } catch {
      setError("Failed to look up QR code.");
    }
  }, []);

  async function handleManualLookup(e: React.FormEvent) {
    e.preventDefault();
    if (!qrInput.trim()) {
      setError("Please enter a QR code.");
      return;
    }
    lookupVisit(qrInput.trim());
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError("");
    setUploading(true);
    try {
      const code = await decodeQrFromImage(file);
      if (!code) {
        setError("No QR code found in that image. Try a clearer screenshot or photo.");
        return;
      }
      await lookupVisit(code);
    } catch {
      setError("Could not read that image file.");
    } finally {
      setUploading(false);
    }
  }

  async function handleCheckIn() {
    if (!result) return;
    setFeedback("");
    startTransition(async () => {
      const res = await checkInAction(result.id);
      if (res.success) {
        setFeedback("Checked in successfully!");
        setResult({ ...result, status: "CHECKED_IN", actualArrival: new Date().toISOString() });
      } else {
        setFeedback(res.message);
      }
    });
  }

  async function handleCheckOut() {
    if (!result) return;
    setFeedback("");
    startTransition(async () => {
      const res = await checkOutAction(result.id);
      if (res.success) {
        setFeedback("Checked out successfully!");
        setResult({ ...result, status: "CHECKED_OUT", actualDeparture: new Date().toISOString() });
      } else {
        setFeedback(res.message);
      }
    });
  }

  async function handleAddStop() {
    if (!result || !stopDept) return;
    setFeedback("");
    startTransition(async () => {
      const res = await addVisitStopAction(result.id, stopDept, stopBuilding || undefined);
      if (res.success) {
        const updated = await fetch(`/api/visits/lookup?qr=${encodeURIComponent(result.qrCode ?? "")}`).then((r) => r.json());
        setResult(updated);
        setStopDept("");
        setStopBuilding("");
        setFeedback(res.message);
      } else {
        setFeedback(res.message);
      }
    });
  }

  async function handleCheckInStop(stopId: string) {
    if (!result) return;
    setFeedback("");
    startTransition(async () => {
      const res = await checkInStopAction(stopId);
      if (res.success) {
        const updated = await fetch(`/api/visits/lookup?qr=${encodeURIComponent(result.qrCode ?? "")}`).then((r) => r.json());
        setResult(updated);
        setFeedback("Stop marked as visited.");
      } else {
        setFeedback(res.message);
      }
    });
  }

  async function handleCheckoutStop(stopId: string) {
    if (!result) return;
    startTransition(async () => {
      const res = await checkOutStopAction(stopId);
      if (res.success) {
        const updated = await fetch(`/api/visits/lookup?qr=${encodeURIComponent(result.qrCode ?? "")}`).then((r) => r.json());
        setResult(updated);
        setFeedback(res.message);
      } else {
        setFeedback(res.message);
      }
    });
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">QR Code Scanner</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Scan a visitor&apos;s QR code with the camera, upload a screenshot, or enter it manually.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          variant={mode === "camera" ? "primary" : "secondary"}
          onClick={() => {
            setMode("camera");
            setError("");
            setResult(null);
            setFeedback("");
            setCameraOn(true);
          }}
        >
          <Camera className="h-4 w-4" />
          Camera Scan
        </Button>
        <Button
          variant={mode === "upload" ? "primary" : "secondary"}
          onClick={() => {
            setMode("upload");
            setCameraOn(false);
            setError("");
            setResult(null);
            setFeedback("");
          }}
        >
          <Upload className="h-4 w-4" />
          Upload QR
        </Button>
        <Button
          variant={mode === "manual" ? "primary" : "secondary"}
          onClick={() => {
            setMode("manual");
            setCameraOn(false);
          }}
        >
          <Keyboard className="h-4 w-4" />
          Manual Entry
        </Button>
      </div>

      {mode === "camera" && !result && (
        <Card>
          <CardHeader
            title="Camera Scanner"
            subtitle={
              cameraState === "ready"
                ? "Point camera at a QR code"
                : cameraState === "error"
                  ? "Camera unavailable — try again or use manual entry"
                  : cameraState === "idle"
                    ? "Camera is off"
                    : "Starting camera…"
            }
            action={
              cameraOn ? (
                <Button variant="ghost" onClick={() => setCameraOn(false)}>
                  <X className="h-4 w-4" />
                </Button>
              ) : undefined
            }
          />
          <div className="p-5">
            <CameraViewport
              active={cameraOn}
              onScan={(text) => lookupVisit(text)}
              onStateChange={setCameraState}
              className="rounded-lg"
            />
            {!cameraOn && (
              <Button onClick={() => setCameraOn(true)} className="mt-3 w-full">
                <Camera className="h-4 w-4" />
                Start Camera
              </Button>
            )}
          </div>
        </Card>
      )}

      {mode === "upload" && !result && (
        <Card>
          <CardHeader title="Upload QR" subtitle="Pick a screenshot or photo of the visitor's QR code" />
          <div className="space-y-3 p-5">
            <label
              className={buttonClass(
                "secondary",
                `w-full cursor-pointer ${uploading ? "pointer-events-none opacity-50" : ""}`
              )}
            >
              <Upload className="h-4 w-4" />
              {uploading ? "Reading image…" : "Choose image"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleUpload}
                disabled={uploading}
              />
            </label>
            <p className="text-xs text-[var(--muted)]">
              Works with the QR image downloaded from a visitor&apos;s profile, a screenshot, or a photo of a printed pass.
            </p>
          </div>
        </Card>
      )}

      {mode === "manual" && (
        <Card>
          <CardHeader title="Manual Entry" subtitle="Type or paste the QR code string" />
          <form onSubmit={handleManualLookup} className="space-y-4 p-5">
            <div className="relative">
              <QrCode className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
              <Input
                value={qrInput}
                onChange={(e) => setQrInput(e.target.value)}
                placeholder="e.g. VMS-1234567890-ABCDEF12"
                className="pl-9 font-mono"
                autoFocus
              />
            </div>
            <Button type="submit" className="w-full">
              <Search className="h-4 w-4" />
              Look Up Visit
            </Button>
          </form>
        </Card>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-[var(--danger)]/20 bg-[var(--danger-soft)] p-3 text-sm text-[var(--danger)]">
          <XCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {result && (
        <Card>
          <CardHeader title="Visit Details" />
          <div className="space-y-4 p-5">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-[var(--muted)]">Visitor:</span>
                <p className="font-medium">
                  {result.visitor?.firstName} {result.visitor?.lastName}
                </p>
              </div>
              <div>
                <span className="text-[var(--muted)]">Department:</span>
                <p className="font-medium">{result.department?.name}</p>
              </div>
              <div>
                <span className="text-[var(--muted)]">Purpose:</span>
                <p className="font-medium">{result.purpose?.replace("_", " ")}</p>
              </div>
              <div>
                <span className="text-[var(--muted)]">Status:</span>
                <p>
                  <Badge tone={STATUS_BADGE[result.status ?? ""]?.tone}>
                    {result.status?.replace("_", " ")}
                  </Badge>
                </p>
              </div>
              {result.hostName && (
                <div>
                  <span className="text-[var(--muted)]">Host:</span>
                  <p className="font-medium">{result.hostName}</p>
                </div>
              )}
              {result.actualArrival && (
                <div>
                  <span className="text-[var(--muted)]">Checked In:</span>
                  <p className="font-medium">{formatDate(result.actualArrival)}</p>
                </div>
              )}
              {result.actualDeparture && (
                <div>
                  <span className="text-[var(--muted)]">Checked Out:</span>
                  <p className="font-medium">{formatDate(result.actualDeparture)}</p>
                </div>
              )}
            </div>

            {(result.visitor?.photoUrl || result.visitor?.idPhotoUrl) && (
              <div className="grid grid-cols-2 gap-3">
                {result.visitor?.photoUrl && (
                  <div>
                    <p className="text-xs text-[var(--muted)]">Visitor Photo</p>
                    <img
                      src={`/api/visitor-photo?path=${encodeURIComponent(result.visitor.photoUrl)}`}
                      alt="Visitor"
                      className="mt-1 h-40 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] object-cover"
                    />
                  </div>
                )}
                {result.visitor?.idPhotoUrl && (
                  <div>
                    <p className="text-xs text-[var(--muted)]">ID Photo</p>
                    <img
                      src={`/api/visitor-photo?path=${encodeURIComponent(result.visitor.idPhotoUrl)}`}
                      alt="ID"
                      className="mt-1 h-40 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] object-contain"
                    />
                  </div>
                )}
              </div>
            )}

            {feedback && (
              <div className="flex items-center gap-2 rounded-lg border border-[var(--success)]/20 bg-[var(--success-soft)] p-3 text-sm text-[var(--success)]">
                <CheckCircle className="h-4 w-4" />
                {feedback}
              </div>
            )}

            {result.status === "PENDING" && (
              <Button onClick={handleCheckIn} disabled={isPending} className="w-full">
                <LogIn className="h-4 w-4" />
                {isPending ? "Processing..." : "Check In"}
              </Button>
            )}

            {result.status === "CHECKED_IN" && (
              <>
                <div className="rounded-lg border border-[var(--border)] p-4 space-y-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Visit Stops</p>
                  {result.stops && result.stops.length > 0 ? (
                    <div className="space-y-2">
                      {result.stops.map((stop) => (
                        <div key={stop.id} className="flex items-center justify-between rounded-md bg-[var(--surface-muted)] px-3 py-2 text-sm">
                          <div className="flex items-center gap-2">
                            <MapPin className="h-3.5 w-3.5 text-[var(--muted)]" />
                            <span className="font-medium">{stop.department?.name || "Unknown"}</span>
                            {stop.building && <span className="text-xs text-[var(--muted)]">({stop.building})</span>}
                            {stop.checkedInAt && (
                              <span className="text-xs text-[var(--muted)]">{formatDate(stop.checkedInAt)}</span>
                            )}
                          </div>
                          {!stop.checkedInAt ? (
                            <button
                              onClick={() => handleCheckInStop(stop.id)}
                              disabled={isPending}
                              className="text-xs font-medium text-[var(--success)] hover:underline disabled:opacity-50"
                            >
                              Mark arrived
                            </button>
                          ) : !stop.checkedOutAt ? (
                            <button onClick={() => handleCheckoutStop(stop.id)} className="text-xs text-[var(--danger)] hover:underline">
                              Check Out
                            </button>
                          ) : (
                            <span className="text-xs text-[var(--success)]">Left {formatDate(stop.checkedOutAt)}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-[var(--muted)]">No stops logged yet.</p>
                  )}
                  <p className="text-xs text-[var(--muted)]">
                    Planned offices are listed above. Use the dropdown only for an unplanned stop.
                  </p>
                  <div className="flex gap-2">
                    <Select value={stopDept} onChange={(e) => setStopDept(e.target.value)}>
                      <option value="">Select department</option>
                      {departments
                        .filter(
                          (d) =>
                            !result.stops?.some(
                              (stop) => stop.departmentId === d.id && !stop.checkedOutAt
                            )
                        )
                        .map((d) => (
                          <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                    </Select>
                    <Input value={stopBuilding} onChange={(e) => setStopBuilding(e.target.value)} placeholder="Building (optional)" className="flex-1" />
                    <Button onClick={handleAddStop} disabled={!stopDept || isPending}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <Button variant="danger" onClick={handleCheckOut} disabled={isPending} className="w-full">
                  <LogOut className="h-4 w-4" />
                  {isPending ? "Processing..." : "Check Out"}
                </Button>
              </>
            )}

            {(result.status === "CHECKED_OUT" || result.status === "CANCELLED") && (
              <p className="text-center text-sm text-[var(--muted)]">
                This visit has already been {result.status.toLowerCase().replace("_", " ")}.
              </p>
            )}

            <Button
              variant="ghost"
              className="w-full"
              onClick={() => { setResult(null); setFeedback(""); setError(""); setMode("camera"); setCameraOn(true); }}
            >
              Scan Another
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
