"use client";

import { useActionState, useRef, useEffect, useState } from "react";
import { Card, CardHeader, Input, Select, Button } from "@/components/ui";
import PhotoCapture from "@/components/photo-capture";
import { registerVisitorAction, type ActionState } from "@/lib/actions/visitors";
import { portalHomePath, portalHref, type Portal } from "@/lib/portal";
import { ArrowLeft, CheckCircle, Download, Printer } from "lucide-react";
import Link from "next/link";
import QRCode from "qrcode";

const ID_TYPES = [
  { value: "NATIONAL_ID", label: "National ID (PhilSys)" },
  { value: "PASSPORT", label: "Passport" },
  { value: "DRIVERS_LICENSE", label: "Driver's License" },
  { value: "UMID", label: "UMID" },
  { value: "PRC", label: "PRC ID" },
  { value: "STUDENT_ID", label: "Student ID" },
  { value: "COMPANY_ID", label: "Company ID" },
  { value: "SSS", label: "SSS" },
  { value: "TIN", label: "TIN" },
  { value: "OTHER", label: "Other" },
] as const;

const PURPOSES = [
  { value: "ATTENDANCE", label: "Attendance" },
  { value: "DELIVERY", label: "Delivery" },
  { value: "INTERVIEW", label: "Interview" },
  { value: "MEETING", label: "Meeting" },
  { value: "SCHOOL_VISIT", label: "School Visit" },
  { value: "OTHER", label: "Other" },
] as const;

function QRCodeDisplay({ qrString, visitorName }: { qrString: string; visitorName: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dataUrl, setDataUrl] = useState("");

  useEffect(() => {
    if (canvasRef.current && qrString) {
      QRCode.toCanvas(canvasRef.current, qrString, {
        width: 256,
        margin: 2,
        color: { dark: "#6f1010", light: "#ffffff" },
      });
      QRCode.toDataURL(qrString, {
        width: 256,
        margin: 2,
        color: { dark: "#6f1010", light: "#ffffff" },
      }).then(setDataUrl);
    }
  }, [qrString]);

  function downloadQR() {
    const link = document.createElement("a");
    link.download = `QR-${visitorName.replace(/\s+/g, "-")}-${qrString}.png`;
    link.href = dataUrl;
    link.click();
  }

  function printQR() {
    const win = window.open("", "_blank");
    if (!win) return;
    const doc = win.document;
    doc.title = `QR Code - ${visitorName}`;
    const style = doc.createElement("style");
    style.textContent =
      "body{display:flex;justify-content:center;align-items:center;min-height:100vh;font-family:sans-serif;flex-direction:column;}" +
      ".info{text-align:center;margin-top:16px;}.name{font-size:18px;font-weight:bold;}.code{font-size:12px;color:#666;margin-top:4px;}";
    doc.head.appendChild(style);
    const img = doc.createElement("img");
    img.src = dataUrl;
    img.width = 256;
    img.height = 256;
    const info = doc.createElement("div");
    info.className = "info";
    const nameEl = doc.createElement("div");
    nameEl.className = "name";
    nameEl.textContent = visitorName; // text, never HTML — prevents script injection
    const codeEl = doc.createElement("div");
    codeEl.className = "code";
    codeEl.textContent = qrString;
    info.appendChild(nameEl);
    info.appendChild(codeEl);
    doc.body.appendChild(img);
    doc.body.appendChild(info);
    win.print();
  }

  return (
    <div className="flex flex-col items-center">
      <canvas ref={canvasRef} className="hidden" />
      {dataUrl && (
        <>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-xs">
            <img src={dataUrl} alt={`QR Code for ${visitorName}`} width={256} height={256} />
          </div>
          <p className="mt-3 font-mono text-xs text-[var(--muted)] break-all max-w-[280px] text-center">{qrString}</p>
          <div className="mt-4 flex gap-3">
            <Button variant="secondary" onClick={downloadQR}>
              <Download className="h-4 w-4" />
              Download
            </Button>
            <Button variant="secondary" onClick={printQR}>
              <Printer className="h-4 w-4" />
              Print
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

export default function RegisterVisitorPage({ portal }: { portal: Portal }) {
  const homeHref = portalHomePath(portal);
  const homeLabel = portal === "admin" ? "Dashboard" : portal === "guard" ? "Scanner" : "Visitors";

  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    registerVisitorAction,
    { success: false, message: "" }
  );
  const [departments, setDepartments] = useState<Array<{ id: string; name: string; building: string | null }>>([]);
  const [facePath, setFacePath] = useState<string | null>(null);
  const [idPath, setIdPath] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/departments").then((r) => r.json()).then(setDepartments);
  }, []);

  if (state.success && state.data) {
    return (
      <div className="mx-auto max-w-lg">
        <Card className="p-8 text-center">
          <div className="mb-4 flex justify-center">
            <div className="rounded-xl bg-[var(--success-soft)] p-3">
              <CheckCircle className="h-8 w-8 text-[var(--success)]" />
            </div>
          </div>
          <h2 className="text-lg font-semibold">Visitor Registered!</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Show or send this QR code to the visitor. They can use it at any check-in station.
          </p>
          {state.data.emailTo && (
            <p
              className={
                state.data.emailSent
                  ? "mt-2 text-sm font-medium text-[var(--success)]"
                  : "mt-2 text-sm font-medium text-[var(--warning)]"
              }
            >
              {state.data.emailSent
                ? `QR code emailed to ${state.data.emailTo}.`
                : `Could not email ${state.data.emailTo} — show or download the QR below.`}
            </p>
          )}

          <div className="mt-6">
            <QRCodeDisplay
              qrString={state.data.qrCode}
              visitorName={state.data.visitorId}
            />
          </div>

          <div className="mt-6 flex gap-3 justify-center">
            <Link href={homeHref}>
              <Button variant="secondary">
                <ArrowLeft className="h-4 w-4" />
                {homeLabel}
              </Button>
            </Link>
            <Link href={portalHref(portal, "/visitors/register")}>
              <Button>Register Another</Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4">
        <Link href={homeHref} className="text-sm text-[var(--muted)] hover:text-[var(--brand)]">
          ← Back to {homeLabel}
        </Link>
      </div>

      <Card>
        <CardHeader title="Register Visitor" subtitle="Fill in details to generate a scannable QR code" />

        <form action={formAction} className="space-y-6 p-5">
          {state.message && !state.success && (
            <div className="rounded-lg border border-[var(--danger)]/20 bg-[var(--danger-soft)] p-3 text-sm text-[var(--danger)]">{state.message}</div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="label">First Name *</label>
              <Input name="firstName" required />
            </div>
            <div>
              <label className="label">Last Name *</label>
              <Input name="lastName" required />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Email (Optional)</label>
              <Input name="email" type="email" />
            </div>
            <div>
              <label className="label">Phone (Optional)</label>
              <Input name="phone" type="tel" />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Company / School (Optional)</label>
              <Input name="company" />
            </div>
            <div>
              <label className="label">ID Type *</label>
              <Select name="idType" required>
                <option value="">Select ID type</option>
                {ID_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div>
            <label className="label">ID Number (Optional)</label>
            <Input name="idNumber" />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <PhotoCapture label="Visitor Photo" kind="face" facing="user" onPath={setFacePath} />
            <PhotoCapture label="ID Photo" kind="id" facing="environment" onPath={setIdPath} />
          </div>
          <input type="hidden" name="photoUrl" value={facePath ?? ""} />
          <input type="hidden" name="idPhotoUrl" value={idPath ?? ""} />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Department *</label>
              <Select name="departmentId" required>
                <option value="">Select department</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}{d.building ? ` (${d.building})` : ""}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="label">Purpose *</label>
              <Select name="purpose" required>
                <option value="">Select purpose</option>
                {PURPOSES.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div>
            <label className="label">Vehicle (Optional)</label>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Input name="vehicleType" aria-label="Vehicle type" placeholder="e.g. Sedan" className="min-w-0" />
              <Input name="vehicleModel" aria-label="Vehicle model" placeholder="e.g. Vios" className="min-w-0" />
              <Input name="vehiclePlateNumber" aria-label="Plate number" placeholder="e.g. ABC 1234" className="min-w-0" />
            </div>
          </div>

          <div>
            <label className="label">Notes (Optional)</label>
            <Input name="notes" />
          </div>

          <Button type="submit" disabled={pending} className="w-full">
            {pending ? "Registering..." : "Register Visitor & Generate QR"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
