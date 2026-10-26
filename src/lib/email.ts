import { Resend } from "resend";
import nodemailer from "nodemailer";
import QRCode from "qrcode";

type SmtpConfig = {
  host: string;
  port: number;
  user: string;
  pass: string;
};

/**
 * Read at call time (not module scope) so the flag follows runtime env vars
 * even when the bundler inlined an unset value at build time.
 */
function smtpConfig(): SmtpConfig | null {
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  if (!user || !pass) return null;

  const port = Number(process.env.SMTP_PORT?.trim()) || 465;
  return {
    host: process.env.SMTP_HOST?.trim() || "smtp.gmail.com",
    port,
    user,
    pass,
  };
}

export function emailEnabled(): boolean {
  return Boolean(smtpConfig() || process.env.RESEND_API_KEY);
}

function fromAddress(): string {
  const explicit = process.env.EMAIL_FROM?.trim();
  if (explicit) return explicit;

  const smtp = smtpConfig();
  // Gmail only accepts From addresses that match the authenticated mailbox,
  // but it does allow a friendly name in front of it.
  if (smtp) return `Visitor Management <${smtp.user}>`;

  return "Visitor Management <onboarding@resend.dev>";
}

export type QrEmailInput = {
  to: string;
  visitorName: string;
  qrCode: string;
  referenceCode?: string | null;
  visitType?: "ONE_DAY" | "MULTIPLE" | null;
  offices?: string[];
  departmentName?: string | null;
  purpose?: string | null;
  validFrom?: Date | null;
  expiresAt?: Date | null;
  passUrl?: string | null;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function manilaDate(value: Date): string {
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(value);
}

function buildHtml(input: QrEmailInput): string {
  const name = escapeHtml(input.visitorName);
  const code = escapeHtml(input.qrCode);
  const reference = input.referenceCode ? escapeHtml(input.referenceCode) : null;
  const offices = input.offices?.filter(Boolean) ?? [];
  const officeText = offices.length
    ? escapeHtml(offices.join(", "))
    : input.departmentName
      ? escapeHtml(input.departmentName)
      : null;
  const purpose = input.purpose ? escapeHtml(input.purpose) : null;
  const visitType =
    input.visitType === "MULTIPLE"
      ? "Multiple visits"
      : input.visitType === "ONE_DAY"
        ? "One-day visit"
        : null;
  const validFrom = input.validFrom ? manilaDate(input.validFrom) : null;
  const validUntil = input.expiresAt ? manilaDate(input.expiresAt) : null;
  const passUrl = input.passUrl
    ? `${(process.env.APP_URL ?? "").replace(/\/$/, "")}${input.passUrl}`
    : null;

  const row = (label: string, value: string) =>
    `<tr><td style="padding:7px 0;color:#64748b;font-size:13px;">${label}</td><td style="padding:7px 0;font-weight:600;font-size:13px;text-align:right;">${value}</td></tr>`;

  const rows = [
    reference ? row("Reference no.", reference) : "",
    officeText ? row("Offices", officeText) : "",
    purpose ? row("Purpose", purpose) : "",
    validFrom ? row("Valid from", validFrom) : "",
    validUntil ? row("Valid until", validUntil) : "",
    visitType ? row("Visit type", visitType) : "",
    row("Status", '<span style="color:#15803d;">Active</span>'),
  ].join("");

  return `
<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#f1f5f9;padding:24px;">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;">
    <div style="background:#700000;padding:20px 28px;color:#ffffff;">
      <p style="margin:0;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#f0c000;">Eastern Visayas State University</p>
      <h1 style="margin:6px 0 0;font-size:20px;">Pre-Registration Confirmation</h1>
    </div>
    <div style="padding:28px;text-align:center;">
      <p style="margin:0 0 16px;font-size:14px;color:#334155;text-align:left;">
        Dear ${name}, your visitor pre-registration has been confirmed. Present the pass below at the gate.
      </p>
      ${
        reference
          ? `<div style="background:#fef9e7;border:1px solid #f0c000;border-radius:10px;padding:12px;margin-bottom:18px;">
              <p style="margin:0;font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:#7c5c00;">Reference number</p>
              <p style="margin:4px 0 0;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:17px;font-weight:700;color:#700000;">${reference}</p>
            </div>`
          : ""
      }
      <img src="cid:qrcode" alt="Visitor QR code" width="220" height="220" style="display:block;margin:0 auto;border:1px solid #e2e8f0;border-radius:12px;" />
      <p style="margin:12px 0 0;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:14px;font-weight:700;letter-spacing:0.5px;color:#0f172a;">${code}</p>
      <p style="margin:4px 0 20px;font-size:12px;color:#94a3b8;">Show this QR at the guard station, or type the code at the self check-in page.</p>
      <table style="width:100%;border-collapse:collapse;text-align:left;border-top:1px solid #e2e8f0;">
        <tr><td style="padding:7px 0;color:#64748b;font-size:13px;">Visitor</td><td style="padding:7px 0;font-weight:600;font-size:13px;text-align:right;">${name}</td></tr>
        ${rows}
      </table>
      ${
        passUrl
          ? `<p style="margin:22px 0 0;"><a href="${escapeHtml(passUrl)}" style="display:inline-block;background:#700000;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-size:14px;font-weight:600;">View / Download Visitor Pass</a></p>`
          : ""
      }
      <p style="margin:18px 0 0;font-size:11px;color:#94a3b8;">This pass is non-transferable and must be used with the same physical ID presented during registration.</p>
    </div>
  </div>
</div>`.trim();
}

function logFailure(input: QrEmailInput, transport: string, reason: string): void {
  console.error(
    JSON.stringify({
      level: "error",
      event: "QR_EMAIL_FAILED",
      transport,
      to: input.to,
      error: reason,
    })
  );
}

/**
 * Emails the visitor their QR code. Returns false (never throws) when no
 * transport is configured or the send fails, so registration can proceed.
 *
 * Transport order: SMTP (dedicated mailbox) when SMTP_USER/SMTP_PASS are set,
 * otherwise the Resend API when RESEND_API_KEY is set.
 */
export async function sendQrEmail(input: QrEmailInput): Promise<boolean> {
  if (!input.to) return false;

  const smtp = smtpConfig();
  const useResend = !smtp && Boolean(process.env.RESEND_API_KEY);
  if (!smtp && !useResend) return false;

  try {
    const png = await QRCode.toBuffer(input.qrCode, {
      width: 440,
      margin: 2,
      color: { dark: "#1e293b", light: "#ffffff" },
    });

    const subject = `Your visitor QR code — ${input.qrCode}`;

    if (smtp) {
      const transport = nodemailer.createTransport({
        host: smtp.host,
        port: smtp.port,
        secure: smtp.port === 465,
        auth: { user: smtp.user, pass: smtp.pass },
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 20_000,
      });

      await transport.sendMail({
        from: fromAddress(),
        to: input.to,
        subject,
        html: buildHtml(input),
        attachments: [
          {
            filename: `qr-${input.qrCode}.png`,
            content: png,
            contentType: "image/png",
            cid: "qrcode",
          },
        ],
      });
      return true;
    }

    const resend = new Resend(process.env.RESEND_API_KEY);
    const { error } = await resend.emails.send({
      from: fromAddress(),
      to: input.to,
      subject,
      html: buildHtml(input),
        attachments: [
          {
            filename: `qr-${input.qrCode}.png`,
            // Resend serializes the payload with JSON.stringify, so a Buffer
            // would become {"type":"Buffer",...}. The API expects base64.
            content: png.toString("base64"),
            contentType: "image/png",
            contentId: "qrcode",
          },
        ],
    });

    if (error) {
      logFailure(input, "resend", error.message);
      return false;
    }
    return true;
  } catch (error) {
    logFailure(
      input,
      smtp ? "smtp" : "resend",
      error instanceof Error ? error.message : String(error)
    );
    return false;
  }
}
