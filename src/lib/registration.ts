import { manilaMidnight, manilaParts, PH_OFFSET_MS } from "@/lib/ph-time";

const MONTHS: Record<string, number> = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12,
};

const MAX_VALIDITY_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

/** EVSU-2026-00123 — the human-readable reference printed on the pass. */
export function formatReference(year: number, sequence: number): string {
  return `EVSU-${year}-${String(sequence).padStart(5, "0")}`;
}

/** Today's calendar date in Manila as YYYY-MM-DD. */
export function todayIso(now: Date = new Date()): string {
  const { year, month, day } = manilaParts(now);
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** First and last instant of a Manila calendar day. */
export function manilaDayBounds(iso: string): { start: Date; end: Date } {
  const [y, m, d] = iso.split("-").map(Number);
  const start = manilaMidnight(y, m - 1, d);
  return { start, end: new Date(start.getTime() + DAY_MS - 1) };
}

export type VisitWindow = { validFrom: Date; validUntil: Date };

/**
 * Resolves what the visitor picked into a real validity window.
 * One-day passes ignore the end date; multi-visit passes are capped at 30 days.
 */
export function resolveVisitWindow(input: {
  visitType: "ONE_DAY" | "MULTIPLE";
  validFrom: string;
  validUntil?: string;
  now?: Date;
}): { ok: true; window: VisitWindow } | { ok: false; message: string } {
  const today = todayIso(input.now);
  if (input.validFrom < today) {
    return { ok: false, message: "The visit date cannot be in the past." };
  }

  const from = manilaDayBounds(input.validFrom);
  if (input.visitType === "ONE_DAY") {
    return { ok: true, window: { validFrom: from.start, validUntil: from.end } };
  }

  if (!input.validUntil) {
    return { ok: false, message: "Choose the last day the pass should work." };
  }
  if (input.validUntil < input.validFrom) {
    return { ok: false, message: "The end date must be on or after the start date." };
  }

  const until = manilaDayBounds(input.validUntil);
  const days = Math.round((until.start.getTime() - from.start.getTime()) / DAY_MS) + 1;
  if (days > MAX_VALIDITY_DAYS) {
    return { ok: false, message: `A multiple-visit pass can last at most ${MAX_VALIDITY_DAYS} days.` };
  }

  return { ok: true, window: { validFrom: from.start, validUntil: until.end } };
}

export type OcrResult = {
  firstName?: string;
  middleName?: string;
  lastName?: string;
  dateOfBirth?: string;
  idNumber?: string;
};

function titleCase(value: string): string {
  return value
    .toLowerCase()
    .replace(/(^|[\s'-])([a-z])/g, (_, prefix: string, letter: string) => prefix + letter.toUpperCase())
    .trim();
}

function two(n: number): string {
  return String(n).padStart(2, "0");
}

function normalizeDate(day: number, month: number, year: number): string | undefined {
  if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return undefined;
  return `${year}-${two(month)}-${two(day)}`;
}

function parseDateToken(token: string): string | undefined {
  const cleaned = token.replace(/\./g, " ").replace(/\s+/g, " ").trim();

  const monthName = cleaned.match(/^([A-Za-z]{3,9})\s+(\d{1,2}),?\s+(\d{4})$/);
  if (monthName) {
    const month = MONTHS[monthName[1].toLowerCase()];
    return month ? normalizeDate(Number(monthName[2]), month, Number(monthName[3])) : undefined;
  }

  const dayFirst = cleaned.match(/^(\d{1,2})\s+([A-Za-z]{3,9}),?\s+(\d{4})$/);
  if (dayFirst) {
    const month = MONTHS[dayFirst[2].toLowerCase()];
    return month ? normalizeDate(Number(dayFirst[1]), month, Number(dayFirst[3])) : undefined;
  }

  const numeric = cleaned.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (numeric) {
    const a = Number(numeric[1]);
    const b = Number(numeric[2]);
    // Philippine IDs are month/day/year unless the first number cannot be a month.
    const month = a > 12 ? b : a;
    const day = a > 12 ? a : b;
    return normalizeDate(day, month, Number(numeric[3]));
  }

  const iso = cleaned.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (iso) return normalizeDate(Number(iso[3]), Number(iso[2]), Number(iso[1]));

  return undefined;
}

/**
 * Best-effort OCR extraction from a Philippine ID (PhilSys, passport, UMID,
 * driver's licence). Anything uncertain is left blank so the visitor types it.
 */
export function parseIdCardText(raw: string): OcrResult {
  const text = raw.replace(/\r/g, "\n");
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const result: OcrResult = {};

  const idMatch = text.match(/\b(\d{4})[ -]?(\d{4})[ -]?(\d{4})\b/);
  if (idMatch) result.idNumber = `${idMatch[1]} ${idMatch[2]} ${idMatch[3]}`;

  const dobMatch = text.match(
    /(?:date\s+of\s+birth|birth\s+date|petsa\s+ng\s+kapanganakan|kapanganakan)[^0-9A-Za-z]*([A-Za-z]{3,9}\.?\s+\d{1,2},?\s+\d{4}|\d{1,2}[\/.-]\d{1,2}[\/.-]\d{4}|\d{4}[\/.-]\d{1,2}[\/.-]\d{1,2})/i
  );
  if (dobMatch) {
    const parsed = parseDateToken(dobMatch[1]);
    if (parsed) result.dateOfBirth = parsed;
  }

  const isLabel = (line: string) =>
    /^(surname|last\s*name|given\s*name|first\s*name|middle\s*name|apelyido|pangalan|date\s+of\s+birth|birth\s+date|address|sex|nationality|blood\s+type|signature|philippine|republika|identification|card\s+no)/i.test(
      line
    );

  let nameLine = lines.find(
    (line) => line.includes(",") && /^[A-Za-zÑñ' .-]+,\s*[A-Za-zÑñ' .-]+$/.test(line)
  );

  if (!nameLine) {
    const surnameIndex = lines.findIndex((line) => /^(surname|last\s*name|apelyido)$/i.test(line));
    if (surnameIndex >= 0 && lines[surnameIndex + 1] && !isLabel(lines[surnameIndex + 1])) {
      const last = lines[surnameIndex + 1];
      const givenIndex = lines.findIndex((line, i) => i > surnameIndex && /^(given\s*name|first\s*name|pangalan)$/i.test(line));
      const first = givenIndex >= 0 ? lines[givenIndex + 1] : undefined;
      if (first && !isLabel(first)) nameLine = `${last}, ${first}`;
    }
  }

  if (nameLine) {
    const [lastPart, restPart] = nameLine.split(",", 2);
    const rest = restPart.trim().split(/\s+/);
    result.lastName = titleCase(lastPart.trim());
    if (rest[0]) result.firstName = titleCase(rest[0]);
    if (rest.length > 1) result.middleName = titleCase(rest.slice(1).join(" "));
  }

  return result;
}

/** Keeps the printed pass useful while hiding most of the ID number. */
export function maskIdNumber(value: string | null | undefined): string {
  if (!value) return "—";
  const compact = value.replace(/\s+/g, "");
  if (compact.length <= 4) return "••••";
  return `••••${compact.slice(-4)}`;
}

/** Short office list for pass cards and emails: "Registrar, Accounting". */
export function officeSummary(names: string[], max = 3): string {
  if (names.length <= max) return names.join(", ");
  return `${names.slice(0, max).join(", ")} +${names.length - max} more`;
}

/** Effective state of a pass right now, used by the public pass page. */
export type PassState = "ACTIVE" | "INSIDE" | "EXPIRED" | "REVOKED" | "CANCELLED";

export function passState(
  visit: { status: string; qrExpiresAt: Date | null; qrRevokedAt: Date | null },
  now: number = Date.now()
): PassState {
  if (visit.qrRevokedAt) return "REVOKED";
  if (visit.status === "CANCELLED") return "CANCELLED";
  if (visit.qrExpiresAt && visit.qrExpiresAt.getTime() < now) return "EXPIRED";
  return visit.status === "CHECKED_IN" ? "INSIDE" : "ACTIVE";
}

export { PH_OFFSET_MS, MAX_VALIDITY_DAYS };
