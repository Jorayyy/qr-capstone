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

export type OcrIdType =
  | "NATIONAL_ID"
  | "PASSPORT"
  | "DRIVERS_LICENSE"
  | "UMID"
  | "STUDENT_ID"
  | "OTHER";

export type OcrResult = {
  firstName?: string;
  middleName?: string;
  lastName?: string;
  dateOfBirth?: string;
  idType?: OcrIdType;
  idNumber?: string;
};

const NAME_PARTICLES = new Set([
  "de", "del", "dela", "delas", "delos", "la", "las", "los", "san", "santa", "sta", "van", "von", "da", "dos", "y",
]);

const NAME_STOPWORDS = new Set([
  "last", "first", "middle", "name", "surname", "given", "full", "date", "birth", "address",
  "nationality", "sex", "weight", "height", "blood", "type", "eyes", "color", "conditions",
  "license", "expiration", "agency", "code", "signature", "republic", "department",
  "transportation", "office", "driver", "card", "identification", "philippines", "philippine",
  "number", "no", "street", "avenue", "ave", "road", "barangay", "brgy", "city", "province",
  "municipality", "leyte", "tacloban", "visitor", "passport", "umid", "capital",
  "university", "college", "institute", "campus", "school", "academy", "eastern",
  "visayas", "student", "faculty", "employee", "company", "corporation", "inc",
  "course", "program", "year", "section", "semester", "academic", "bachelor",
  "science", "information", "technology", "engineering", "education", "business",
  "accountancy", "nursing", "criminology", "hospitality", "management",
  "administration", "government", "republic", "id", "control", "holder",
  "cardholder", "of", "the", "and", "in",
]);

const DIGIT_CONFUSIONS: Record<string, string> = {
  O: "0", o: "0", Q: "0", q: "0",
  I: "1", l: "1", i: "1", "|": "1", "!": "1",
  S: "5", s: "5", B: "8", Z: "2", z: "2", G: "6",
  "¢": "6", "©": "6", "$": "5",
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

function fixDigits(value: string): string {
  return value.replace(/[OoQqIliSsBbZzG¢©$|!]/g, (char) => DIGIT_CONFUSIONS[char] ?? char);
}

function normalizeDate(day: number, month: number, year: number): string | undefined {
  const now = new Date();
  if (year < 1900 || year > now.getFullYear()) return undefined;
  if (month < 1 || month > 12 || day < 1 || day > 31) return undefined;
  if (now.getFullYear() - year > 120) return undefined;

  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return undefined;
  }
  if (year === now.getFullYear() && month - 1 > now.getMonth()) return undefined;
  if (year === now.getFullYear() && month - 1 === now.getMonth() && day > now.getDate()) return undefined;

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

  const iso = cleaned.match(/^(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})$/);
  if (iso) return normalizeDate(Number(iso[3]), Number(iso[2]), Number(iso[1]));

  const numeric = cleaned.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (numeric) {
    const a = Number(numeric[1]);
    const b = Number(numeric[2]);
    // Philippine IDs are month/day/year unless the first number cannot be a month.
    const month = a > 12 ? b : a;
    const day = a > 12 ? a : b;
    return normalizeDate(day, month, Number(numeric[3]));
  }

  return undefined;
}

const DATE_NUMBER_RE = /(?:^|[^0-9A-Za-z])([\dOoQqIliSsBbZzG¢©]{1,4}[/.-][\dOoQqIliSsBbZzG¢©]{1,2}[/.-][\dOoQqIliSsBbZzG¢©]{1,4})(?:$|[^0-9A-Za-z])/g;
const MONTH_NAME_RE = /(?:^|[^A-Za-z])([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})(?:$|[^0-9])/;
const DAY_MONTH_RE = /(?:^|[^A-Za-z0-9])(\d{1,2})\s+([A-Za-z]{3,9})\.?,?\s+(\d{4})(?:$|[^0-9])/;

function extractDate(value: string): string | undefined {
  for (const match of value.matchAll(DATE_NUMBER_RE)) {
    const parsed = parseDateToken(fixDigits(match[1]));
    if (parsed) return parsed;
  }

  const monthName = value.match(MONTH_NAME_RE);
  if (monthName) {
    const month = MONTHS[monthName[1].toLowerCase()];
    if (month) {
      const parsed = normalizeDate(Number(monthName[2]), month, Number(monthName[3]));
      if (parsed) return parsed;
    }
  }

  const dayMonth = value.match(DAY_MONTH_RE);
  if (dayMonth) {
    const month = MONTHS[dayMonth[2].toLowerCase()];
    if (month) {
      const parsed = normalizeDate(Number(dayMonth[1]), month, Number(dayMonth[3]));
      if (parsed) return parsed;
    }
  }

  return undefined;
}

function splitNameTokens(value: string): string[] {
  return value
    .replace(/[^A-Za-zÑñ'.\-\s]/g, " ")
    .replace(/\./g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
}

function isNameToken(token: string, index: number): boolean {
  if (!/^[A-Za-zÑñ]+(?:['-][A-Za-zÑñ]+)*$/.test(token)) return false;
  if (token.length === 1) return index > 0;
  return !NAME_STOPWORDS.has(token.toLowerCase());
}

function isNamePart(tokens: string[]): boolean {
  return tokens.length > 0 && tokens.length <= 4 && tokens.every((token, index) => isNameToken(token, index));
}

function splitGivenNames(tokens: string[]): { first: string; middle?: string } {
  if (tokens.length === 1) return { first: tokens[0] };

  let split = tokens.length - 1;
  while (split > 1 && NAME_PARTICLES.has(tokens[split - 1].toLowerCase())) split -= 1;

  return {
    first: tokens.slice(0, split).join(" "),
    middle: tokens.slice(split).join(" "),
  };
}

type ParsedName = Pick<OcrResult, "firstName" | "middleName" | "lastName">;

function trimNameNoise(tokens: string[]): string[] {
  const isUpper = (token: string) => /^[A-ZÑ]+(?:['-][A-ZÑ]+)*$/.test(token);
  if (!tokens.some(isUpper)) return tokens;

  let start = 0;
  while (start < tokens.length - 1) {
    const token = tokens[start];
    if (isUpper(token) || NAME_PARTICLES.has(token.toLowerCase())) break;
    start += 1;
  }
  return tokens.slice(start);
}

function parseCommaName(line: string): ParsedName | null {
  const cleaned = line.replace(/[^A-Za-zÑñ'.,\-\s]/g, " ").replace(/\s+/g, " ").trim();
  const parts = cleaned.split(",");
  if (parts.length !== 2) return null;

  const lastTokens = trimNameNoise(splitNameTokens(parts[0]));
  const givenTokens = trimNameNoise(splitNameTokens(parts[1]));
  if (!isNamePart(lastTokens) || !isNamePart(givenTokens)) return null;

  const { first, middle } = splitGivenNames(givenTokens);
  return {
    lastName: titleCase(lastTokens.join(" ")),
    firstName: titleCase(first),
    ...(middle ? { middleName: titleCase(middle) } : {}),
  };
}

const FULL_NAME_HEADER = /(?:last\s*name|surname)[.,:\s]+(?:first\s*name|given\s*name)/i;
const SURNAME_LABEL = /^(?:surname|last\s*name|apelyido)\b/i;
const GIVEN_LABEL = /^(?:given\s*name|first\s*name|pangalan)\b/i;
const MIDDLE_LABEL = /^(?:middle\s*name|gitnang\s*apelyido)\b/i;
const GENERIC_NAME_LABEL = /^(?:full\s*name|name|pangalan|student\s*name|holder(?:'s)?\s*name|cardholder)\b/i;

const NAME_SUFFIXES = new Set(["jr", "sr", "ii", "iii", "iv", "v"]);
const INSTITUTION_WORDS =
  /\b(?:university|college|institute|campus|school|academy|republic|government|city|municipality|province|barangay|street|address|course|program|student|employee|company|corporation|department|office|semester|bachelor|science|technology)\b/i;

/** "Juan Dela Cruz" -> last name Dela Cruz, first Juan (no comma on the card). */
function parseFreeName(tokens: string[]): ParsedName | null {
  if (tokens.length < 2) return null;

  let split = tokens.length - 1;
  if (NAME_SUFFIXES.has(tokens[split].toLowerCase())) split -= 1;
  while (split > 1 && NAME_PARTICLES.has(tokens[split - 1].toLowerCase())) split -= 1;

  const given = tokens.slice(0, split);
  const last = tokens.slice(split);
  if (given.length === 0 || last.length === 0) return null;

  const { first, middle } = splitGivenNames(given);
  return {
    lastName: titleCase(last.join(" ")),
    firstName: titleCase(first),
    ...(middle ? { middleName: titleCase(middle) } : {}),
  };
}

/** Any name line, comma-separated or free-order. */
function parseNameValue(value: string): ParsedName | null {
  const cleaned = value.replace(/[^A-Za-zA`A�'.,\-\s]/g, " ").replace(/\s+/g, " ").trim();
  if (!cleaned) return null;
  if (cleaned.includes(",")) return parseCommaName(cleaned);

  const tokens = splitNameTokens(cleaned);
  if (tokens.length < 2 || tokens.length > 6) return null;
  if (!tokens.every((token, index) => isNameToken(token, index))) return null;
  return parseFreeName(tokens);
}

function isLabelLike(value: string): boolean {
  return (
    FULL_NAME_HEADER.test(value) ||
    /^(?:surname|last\s*name|given\s*name|first\s*name|middle\s*name|apelyido|pangalan|date\s+of\s+birth|birth\s+date|address|nationality|sex|weight|height|blood\s+type|eyes\s+color|license\s+no|expiration\s+date|agency\s+code|conditions|signature)\b/i.test(
      value
    )
  );
}

function findCommaName(lines: string[]): ParsedName | null {
  const headerIndex = lines.findIndex((line) => FULL_NAME_HEADER.test(line));

  if (headerIndex >= 0) {
    const inline = lines[headerIndex].replace(FULL_NAME_HEADER, "");
    if (inline.includes(",")) {
      const parsed = parseCommaName(inline);
      if (parsed) return parsed;
    }
    for (let i = headerIndex + 1; i <= Math.min(headerIndex + 3, lines.length - 1); i += 1) {
      const parsed = parseCommaName(lines[i]);
      if (parsed) return parsed;
    }
    return null;
  }

  for (const line of lines) {
    const parsed = parseCommaName(line);
    if (parsed) return parsed;
  }
  return null;
}

/** Last resort: the first line that reads like a person's name, whatever the layout. */
function findLooseName(lines: string[]): ParsedName | null {
  for (const line of lines) {
    if (INSTITUTION_WORDS.test(line)) continue;
    const parsed = parseNameValue(line);
    if (parsed) return parsed;
  }
  return null;
}

function valueAfterLabel(lines: string[], label: RegExp): string | undefined {
  for (let i = 0; i < lines.length; i += 1) {
    const match = lines[i].match(label);
    if (!match) continue;

    const inline = lines[i].slice((match.index ?? 0) + match[0].length).replace(/^[.,:\s]+/, "").trim();
    if (inline && !isLabelLike(inline)) return inline;

    for (let j = i + 1; j <= Math.min(i + 2, lines.length - 1); j += 1) {
      const next = lines[j].trim();
      if (!next || isLabelLike(next)) break;
      return next;
    }
  }
  return undefined;
}

function parseLabelledName(lines: string[]): ParsedName | null {
  const genericValue = valueAfterLabel(lines, GENERIC_NAME_LABEL);
  if (genericValue) {
    const parsed = parseNameValue(genericValue);
    if (parsed) return parsed;
  }

  const lastValue = valueAfterLabel(lines, SURNAME_LABEL);
  const givenValue = valueAfterLabel(lines, GIVEN_LABEL);
  if (!lastValue || !givenValue) return null;

  const lastTokens = splitNameTokens(lastValue);
  const givenTokens = splitNameTokens(givenValue);
  if (!isNamePart(lastTokens) || !isNamePart(givenTokens)) return null;

  const middleValue = valueAfterLabel(lines, MIDDLE_LABEL);
  if (middleValue) {
    const middleTokens = splitNameTokens(middleValue);
    if (middleTokens.length > 0 && middleTokens.length <= 4 && middleTokens.every((token, i) => isNameToken(token, i))) {
      return {
        lastName: titleCase(lastTokens.join(" ")),
        firstName: titleCase(givenTokens.join(" ")),
        middleName: titleCase(middleTokens.join(" ")),
      };
    }
  }

  const { first, middle } = splitGivenNames(givenTokens);
  return {
    lastName: titleCase(lastTokens.join(" ")),
    firstName: titleCase(first),
    ...(middle ? { middleName: titleCase(middle) } : {}),
  };
}

function detectIdType(text: string): OcrIdType | undefined {
  const normalized = text.replace(/\s+/g, " ");
  if (/driver'?s?\s+licen[cs]e|land\s+transportation\s+office|\blto\b/i.test(normalized)) {
    return "DRIVERS_LICENSE";
  }
  if (/unified\s+multi[- ]?purpose|\bumid\b/i.test(normalized)) return "UMID";
  if (/philippine\s+identification\s+card|philsys|\bpsn\b|philippine\s+identification\s+(?:system|number)/i.test(normalized)) {
    return "NATIONAL_ID";
  }
  if (/\bpassport\b|paseport/i.test(normalized)) return "PASSPORT";
  if (/\bstudent\b|\bevsu\b|eastern\s+visayas|\buniversity\b|\bcollege\b/i.test(normalized)) {
    return "STUDENT_ID";
  }
  return undefined;
}

function parseLicenseNumber(text: string): string | undefined {
  for (const token of text.split(/\s+/)) {
    const cleaned = token.replace(/^[^A-Za-z0-9¢©$]+|[^A-Za-z0-9¢©$]+$/g, "");
    if (!/^[A-Za-z]/.test(cleaned)) continue;

    const fixed = cleaned[0].toUpperCase() + fixDigits(cleaned.slice(1));
    const compact = fixed.replace(/[^A-Z0-9]/g, "");
    if (/^[A-Z]\d{10}$/.test(compact)) {
      return `${compact.slice(0, 3)}-${compact.slice(3, 5)}-${compact.slice(5)}`;
    }
  }
  return undefined;
}

function parsePassportNumber(text: string): string | undefined {
  const labelled = text.match(
    /passport\s*(?:no\.?|number)?[^A-Za-z0-9]{0,20}([A-Z]{1,2}\d{7})(?:[^A-Z0-9]|$)/i
  );
  if (labelled) return labelled[1].toUpperCase();

  const candidate = text.match(/(?:^|[^A-Z0-9])([A-Z]{1,2}\d{7})(?:$|[^A-Z0-9])/);
  return candidate ? candidate[1].toUpperCase() : undefined;
}

const ID_NUMBER_LABEL =
  /\b(?:student\s*(?:id|no\.?|number)|school\s*id|employee\s*(?:id|no\.?|number)|id\s*(?:no\.?|number|#)|identification\s*(?:no\.?|number)|control\s*(?:no\.?|number)|card\s*(?:no\.?|number)|sss\s*(?:no\.?|number)|tin\s*(?:no\.?|number)|prc\s*(?:no\.?|number)|postal\s*id|umid\s*(?:no\.?|number))\b/i;
const GENERIC_ID_RE = /\b([A-Z]{2,8}(?:[- ]\d{2,12})+|\d{4}[- ]\d{4,10}|\d{6,14})\b/g;

/** Keeps one plausible ID token; rejects dates, phone numbers and bare years. */
function pickIdToken(value: string | undefined): string | undefined {
  if (!value) return undefined;

  for (const raw of value.split(/\s+/)) {
    const cleaned = raw.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9-]+$/g, "");
    if (!cleaned) continue;

    const candidate = /[A-Za-z]/.test(cleaned) ? cleaned : fixDigits(cleaned);
    const compact = candidate.replace(/[^A-Za-z0-9]/g, "");
    const digits = candidate.replace(/\D/g, "");
    if (compact.length < 4 || compact.length > 24 || digits.length < 4) continue;
    if (/^\d{4}$/.test(compact)) continue;
    if (/^09\d{9}$/.test(compact)) continue;
    if (parseDateToken(candidate)) continue;
    return candidate.toUpperCase();
  }
  return undefined;
}

function extractIdNumber(
  text: string,
  type?: OcrIdType,
  lines: string[] = []
): { value: string; type: OcrIdType } | undefined {
  if (type === "DRIVERS_LICENSE" || /driver'?s?\s+licen[cs]e|licen[cs]e\s*(?:no\.?|number)/i.test(text)) {
    const license = parseLicenseNumber(text);
    if (license) return { value: license, type: "DRIVERS_LICENSE" };
  }

  if (type === "PASSPORT" || /\bpassport\b/i.test(text)) {
    const passport = parsePassportNumber(text);
    if (passport) return { value: passport, type: "PASSPORT" };
  }

  if (type === "UMID") {
    const umid = fixDigits(text).match(/(?:^|[^0-9])(\d{4})-?(\d{7})-?(\d)(?:$|[^0-9])/);
    if (umid) return { value: `${umid[1]}-${umid[2]}-${umid[3]}`, type: "UMID" };
  }

  const pcn = fixDigits(text).match(/(?:^|[^0-9])(\d{4})[ -]?(\d{4})[ -]?(\d{4})[ -]?(\d{4})(?:$|[^0-9])/);
  if (pcn) {
    return { value: `${pcn[1]} ${pcn[2]} ${pcn[3]} ${pcn[4]}`, type: "NATIONAL_ID" };
  }

  const philSys = fixDigits(text).match(/(?:^|[^0-9])(\d{4})[ -]?(\d{4})[ -]?(\d{4})(?:$|[^0-9])/);
  if (philSys) {
    return { value: `${philSys[1]} ${philSys[2]} ${philSys[3]}`, type: "NATIONAL_ID" };
  }

  const license = parseLicenseNumber(text);
  if (license) return { value: license, type: "DRIVERS_LICENSE" };

  const labelled = pickIdToken(valueAfterLabel(lines, ID_NUMBER_LABEL));
  if (labelled) return { value: labelled, type: type ?? "OTHER" };

  for (const match of text.matchAll(GENERIC_ID_RE)) {
    const generic = pickIdToken(match[1]);
    if (generic) return { value: generic, type: type ?? "OTHER" };
  }

  return undefined;
}

/**
 * Best-effort OCR extraction from any ID (PhilSys, passport, UMID, driver's
 * licence, student/school/company cards). Anything uncertain is left blank so
 * the visitor types it.
 */
export function parseIdCardText(raw: string): OcrResult {
  const text = raw.replace(/\r/g, "\n");
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const result: OcrResult = {};
  const idType = detectIdType(text);
  if (idType) result.idType = idType;

  const idNumber = extractIdNumber(text, idType, lines);
  if (idNumber) {
    result.idType = idNumber.type;
    result.idNumber = idNumber.value;
  }

  const dobLabel = /(?:date\s+of\s+birth|birth\s+date|petsa\s+ng\s+kapanganakan|kapanganakan|\bdob\b)/i;
  for (let i = 0; i < lines.length; i += 1) {
    const label = lines[i].match(dobLabel);
    if (!label) continue;

    const windows = [
      lines[i].slice((label.index ?? 0) + label[0].length),
      lines[i + 1],
      lines[i + 2],
    ];
    const date = windows.map((window) => (window ? extractDate(window) : undefined)).find(Boolean);
    if (date) {
      result.dateOfBirth = date;
      break;
    }
  }

  const name = findCommaName(lines) ?? parseLabelledName(lines) ?? findLooseName(lines);
  if (name) Object.assign(result, name);

  return result;
}

/**
 * Drops Tesseract lines below a confidence floor so background clutter and
 * faint sticker text cannot leak into the autofilled fields.
 */
export function filterOcrTextByConfidence(tsv: string | null, minLineConfidence = 55): string {
  if (!tsv) return "";

  const lines = new Map<string, { words: string[]; total: number; count: number }>();
  for (const row of tsv.split(/\r?\n/)) {
    const cols = row.split("\t");
    if (cols[0] !== "5") continue;

    const word = cols[11]?.trim();
    const confidence = Number(cols[10]);
    if (!word || !Number.isFinite(confidence) || confidence < 30) continue;

    const key = `${cols[1]}:${cols[2]}:${cols[3]}:${cols[4]}`;
    const line = lines.get(key) ?? { words: [], total: 0, count: 0 };
    line.words.push(word);
    line.total += confidence;
    line.count += 1;
    lines.set(key, line);
  }

  return [...lines.values()]
    .filter((line) => line.count > 0 && line.total / line.count >= minLineConfidence)
    .map((line) => line.words.join(" "))
    .join("\n");
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
