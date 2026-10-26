"use client";

import { Download, Printer } from "lucide-react";
import { buttonClass } from "@/components/ui";

export default function PassActions({ qrDataUrl, reference }: { qrDataUrl: string; reference: string }) {
  return (
    <div className="no-print mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
      <a
        href={qrDataUrl}
        download={`EVSU-Pass-${reference}.png`}
        className={buttonClass("primary")}
      >
        <Download className="h-4 w-4" />
        Download QR pass
      </a>
      <button type="button" onClick={() => window.print()} className={buttonClass("secondary")}>
        <Printer className="h-4 w-4" />
        Print pass
      </button>
    </div>
  );
}
