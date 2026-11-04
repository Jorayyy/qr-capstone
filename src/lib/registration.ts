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
  | "PRC"
  | "POSTAL_ID"
  | "STUDENT_ID"
  | "SSS"
  | "TIN"
  | "COMPANY_ID"
  | "OTHER";

export type OcrResult = {
  firstName?: string;
  middleName?: string;
  lastName?: string;
  idType?: OcrIdType;
  idNumber?: string;
};

const NAME_PARTICLES = new Set([
  "de", "del", "dela", "delas", "delos", "la", "las", "los", "san", "santa", "sta", "van", "von", "da", "dos", "y",
]);

const NAME_HONORIFICS = new Set([
  "mr", "mrs", "ms", "miss", "mister", "madam", "sir", "dr", "doctor", "engr", "atty", "prof", "hon",
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

function splitNameTokens(value: string): string[] {
  return value
    .replace(/[^A-Za-zÑñ'.\-\s]/g, " ")
    .replace(/\./g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
}

function stripHonorifics(tokens: string[]): string[] {
  return tokens.filter((token) => !NAME_HONORIFICS.has(token.toLowerCase()));
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
  const parts = cleaned
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length < 2 || parts.length > 3) return null;

  const lastTokens = stripHonorifics(trimNameNoise(splitNameTokens(parts[0])));
  const givenTokens = stripHonorifics(trimNameNoise(splitNameTokens(parts[1])));
  if (!isNamePart(lastTokens) || !isNamePart(givenTokens)) return null;

  const { first, middle } = splitGivenNames(givenTokens);
  const middleTokens =
    parts.length === 3 ? stripHonorifics(trimNameNoise(splitNameTokens(parts[2]))) : [];
  const middleOk =
    middleTokens.length > 0 &&
    middleTokens.length <= 4 &&
    middleTokens.every((token, index) => isNameToken(token, index + 1));

  return {
    lastName: titleCase(lastTokens.join(" ")),
    firstName: titleCase(first),
    ...(middleOk
      ? { middleName: titleCase(middleTokens.join(" ")) }
      : middle
        ? { middleName: titleCase(middle) }
        : {}),
  };
}

const FULL_NAME_HEADER = /(?:last\s*name|surname)[.,:\s]+(?:first\s*name|given\s*name)/i;
const SURNAME_LABEL = /(?:apelyidos?|surname|last\s*names?)\b/i;
const GIVEN_LABEL = /(?:mga\s+pangalan|given\s*names?|first\s*names?|pangalan)\b/i;
const MIDDLE_LABEL = /(?:gitnang\s+apelyido|middle\s*names?)\b/i;
const GENERIC_NAME_LABEL =
  /^(?:full\s*name|name\s+of\s+(?:the\s+)?(?:student|employee|holder|cardholder|visitor|owner)|name|pangalan|student\s*name|employee\s*name|holder(?:'s)?\s*name|cardholder)\b/i;

const NAME_SUFFIXES = new Set(["jr", "sr", "ii", "iii", "iv", "v"]);
const INSTITUTION_WORDS =
  /\b(?:university|college|institute|campus|school|academy|republic|government|city|municipality|province|barangay|street|address|course|program|student|employee|company|corporation|corp|inc|ltd|limited|co|enterprise|enterprises|trading|services|industries|industrial|group|holdings|business|store|shop|restaurant|hotel|bank|agency|center|centre|foundation|association|organization|solutions|systems|logistics|construction|marketing|ventures|realty|manufacturing|publishing|hospital|clinic|pharmacy|salon|bakery|cafe|department|office|semester|bachelor|science|technology)\b/i;
const NAME_ANCHOR = /\b(?:student|learner|lrn|grade|name|pangalan|holder|cardholder)\b/i;
const NAME_TITLE =
  /\b(?:principal|teacher|adviser|advisor|registrar|guard|student|grade|section|year|school|course|program|office|department)\b/i;

/**
 * "Juan Dela Cruz" -> last name Dela Cruz, first Juan (no comma on the card).
 * A line that starts with a particle ("Dela Cruz Juan P.") is surname-first.
 */
function parseFreeName(tokens: string[]): ParsedName | null {
  if (tokens.length < 2) return null;

  if (NAME_PARTICLES.has(tokens[0].toLowerCase())) {
    let surnameEnd = 0;
    while (surnameEnd < tokens.length - 1 && NAME_PARTICLES.has(tokens[surnameEnd].toLowerCase())) {
      surnameEnd += 1;
    }
    const last = tokens.slice(0, surnameEnd + 1);
    const given = tokens.slice(surnameEnd + 1);
    if (given.length === 0 || last.length === 0) return null;

    const { first, middle } = splitGivenNames(given);
    return {
      lastName: titleCase(last.join(" ")),
      firstName: titleCase(first),
      ...(middle ? { middleName: titleCase(middle) } : {}),
    };
  }

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
  const cleaned = value.replace(/[^A-Za-zÑñ'.,\-\s]/g, " ").replace(/\s+/g, " ").trim();
  if (!cleaned) return null;
  if (cleaned.includes(",")) return parseCommaName(cleaned);

  const tokens = stripHonorifics(splitNameTokens(cleaned));
  if (tokens.length < 2 || tokens.length > 6) return null;
  if (!tokens.every((token, index) => isNameToken(token, index))) return null;
  return parseFreeName(tokens);
}

const LABEL_WORDS =
  /\b(?:apelyido|surname|last\s*names?|mga\s+pangalan|given\s*names?|first\s*names?|gitnang\s+apelyido|middle\s*names?|pangalan|full\s*name|name)\b/gi;

function stripLabelWords(value: string): string {
  return value
    .replace(LABEL_WORDS, " ")
    .replace(/[^A-Za-zÑñ'.,\-\s]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^[.,:\-\s]+|[.,:\-\s]+$/g, "")
    .trim();
}

function isLabelLike(value: string): boolean {
  return (
    FULL_NAME_HEADER.test(value) ||
    /^(?:surname|last\s*names?|given\s*names?|first\s*names?|middle\s*names?|apelyido|gitnang\s+apelyido|mga\s+pangalan|pangalan|date\s+of\s+birth|birth\s+date|address|nationality|sex|weight|height|blood\s+type|eyes\s+color|license\s+no|expiration\s+date|agency\s+code|conditions|signature)\b/i.test(
      value
    )
  );
}

/** A short standalone line that reads like a middle name or initial. */
function middleFromLine(line: string): string | undefined {
  if (!line || /\d/.test(line) || INSTITUTION_WORDS.test(line)) return undefined;

  const tokens = stripHonorifics(splitNameTokens(line));
  if (tokens.length === 0 || tokens.length > 3) return undefined;
  if (!tokens.every((token, index) => isNameToken(token, index + 1))) return undefined;
  return titleCase(tokens.join(" "));
}

function withMiddleFromNextLine(parsed: ParsedName, lines: string[], index: number): ParsedName {
  if (parsed.middleName) return parsed;
  const middle = middleFromLine(lines[index + 1] ?? "");
  return middle ? { ...parsed, middleName: middle } : parsed;
}

function findCommaName(lines: string[]): ParsedName | null {
  const headerIndex = lines.findIndex((line) => FULL_NAME_HEADER.test(line));

  if (headerIndex >= 0) {
    const inline = lines[headerIndex].replace(FULL_NAME_HEADER, "");
    if (inline.includes(",")) {
      const parsed = parseCommaName(inline);
      if (parsed) return withMiddleFromNextLine(parsed, lines, headerIndex);
    }
    for (let i = headerIndex + 1; i <= Math.min(headerIndex + 3, lines.length - 1); i += 1) {
      const parsed = parseCommaName(lines[i]);
      if (parsed) return withMiddleFromNextLine(parsed, lines, i);
    }
    return null;
  }

  for (let i = 0; i < lines.length; i += 1) {
    const parsed = parseCommaName(lines[i]);
    if (parsed) return withMiddleFromNextLine(parsed, lines, i);
  }
  return null;
}

function nameFromLine(line: string): ParsedName | null {
  if (/\d/.test(line) || INSTITUTION_WORDS.test(line)) return null;
  return parseNameValue(line);
}

/** The cardholder's name sits next to "Student", "LRN" or "Grade" on school IDs. */
function findAnchoredName(lines: string[]): ParsedName | null {
  for (let i = 0; i < lines.length; i += 1) {
    if (!NAME_ANCHOR.test(lines[i])) continue;

    for (let distance = 1; distance <= 3; distance += 1) {
      const above = lines[i - distance];
      if (above) {
        const parsed = nameFromLine(above);
        if (parsed) return parsed;
      }
      const below = lines[i + distance];
      if (below) {
        const parsed = nameFromLine(below);
        if (parsed) return parsed;
      }
    }
  }
  return null;
}

/** Last resort: score every name-like line and keep the most likely one. */
function findLooseName(lines: string[]): ParsedName | null {
  let best: { parsed: ParsedName; score: number } | null = null;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (NAME_TITLE.test(line)) continue;

    const parsed = nameFromLine(line);
    if (!parsed) continue;

    const tokens = line.trim().split(/\s+/).length;
    let score = tokens >= 2 && tokens <= 4 ? 20 : 5;
    if (line === line.toUpperCase()) score += 10;

    const window = lines.slice(Math.max(0, i - 2), i + 3).join(" ");
    if (NAME_ANCHOR.test(window)) score += 15;

    if (!best || score > best.score) best = { parsed, score };
  }

  return best?.parsed ?? null;
}

function valueAfterLabel(lines: string[], label: RegExp, exclude?: RegExp): string | undefined {
  for (let i = 0; i < lines.length; i += 1) {
    if (exclude?.test(lines[i])) continue;
    const match = lines[i].match(label);
    if (!match) continue;

    const inline = stripLabelWords(lines[i].slice((match.index ?? 0) + match[0].length));
    if (inline && !isLabelLike(inline)) return inline;

    for (let j = i + 1; j <= Math.min(i + 2, lines.length - 1); j += 1) {
      const next = lines[j].trim();
      if (!next || isLabelLike(next)) break;
      const value = stripLabelWords(next);
      if (value && !isLabelLike(value)) return value;
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

  if (lines.some((line) => FULL_NAME_HEADER.test(line))) return null;

  const lastValue = valueAfterLabel(lines, SURNAME_LABEL, MIDDLE_LABEL);
  const givenValue = valueAfterLabel(lines, GIVEN_LABEL);
  if (!lastValue || !givenValue) return null;

  const lastTokens = splitNameTokens(lastValue);
  const givenTokens = splitNameTokens(givenValue);
  if (!isNamePart(lastTokens) || !isNamePart(givenTokens)) return null;

  const middleValue = valueAfterLabel(lines, MIDDLE_LABEL);
  if (middleValue) {
    const middleTokens = splitNameTokens(middleValue);
    if (middleTokens.length > 0 && middleTokens.length <= 4 && middleTokens.every((token, i) => isNameToken(token, i + 1))) {
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
  if (/professional\s+regulation\s+commission|\bprc\b|professional\s+identification\s+card/i.test(normalized)) {
    return "PRC";
  }
  if (/postal\s+id|postal\s+identification|philippine\s+postal|\bphlpost\b/i.test(normalized)) {
    return "POSTAL_ID";
  }
  if (/\bcompany\s+id\b|employee\s+(?:id|no\.?|number)|staff\s+(?:id|no\.?|number)|badge\s+(?:no\.?|number)/i.test(normalized)) {
    return "COMPANY_ID";
  }
  if (/social\s+security\s+system|\bsss\b/i.test(normalized)) return "SSS";
  if (/bureau\s+of\s+internal\s+revenue|\bbir\b|taxpayer\s+identification|\btin\b/i.test(normalized)) {
    return "TIN";
  }
  if (
    /\bstudent\b|\bevsu\b|eastern\s+visayas|\buniversity\b|\bcollege\b|\blrn\b|learner|national\s+high\s+school|junior\s+high|school\s+id|\bgrade\b/i.test(
      normalized
    )
  ) {
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

/** SSS number: XX-XXXXXXX-X. */
function parseSssNumber(text: string): string | undefined {
  const fixed = fixDigits(text);
  const labelled = fixed.match(
    /(?:social\s+security\s+system|\bsss\b)[^0-9]{0,24}(\d{2})[ -]?(\d{7})[ -]?(\d)(?![0-9])/i
  );
  if (labelled) return `${labelled[1]}-${labelled[2]}-${labelled[3]}`;

  const candidate = fixed.match(/(?:^|[^0-9])(\d{2})[ -]?(\d{7})[ -]?(\d)(?:$|[^0-9])/);
  return candidate ? `${candidate[1]}-${candidate[2]}-${candidate[3]}` : undefined;
}

/** TIN: XXX-XXX-XXX or XXX-XXX-XXX-XXXXX with a branch code. */
function parseTinNumber(text: string): string | undefined {
  const fixed = fixDigits(text);
  const labelled = fixed.match(
    /(?:bureau\s+of\s+internal\s+revenue|\bbir\b|taxpayer\s+identification|\btin\b)[^0-9]{0,24}(\d{3})[ -]?(\d{3})[ -]?(\d{3})(?:[ -]?(\d{3,5}))?/i
  );
  const match =
    labelled ??
    fixed.match(/(?:^|[^0-9])(\d{3})[ -]?(\d{3})[ -]?(\d{3})(?:[ -]?(\d{3,5}))?(?:$|[^0-9])/);
  if (!match) return undefined;
  return [match[1], match[2], match[3], match[4]].filter(Boolean).join("-");
}

/** PRC licence number: six or seven digits, usually labelled "PRC No.". */
function parsePrcNumber(text: string): string | undefined {
  const fixed = fixDigits(text);
  const labelled = fixed.match(
    /(?:professional\s+regulation\s+commission|\bprc\b|professional\s+identification|registration)[^0-9]{0,24}(\d{6,7})(?![0-9])/i
  );
  if (labelled) return labelled[1];

  const candidate = fixed.match(/(?:^|[^0-9])(\d{7})(?:$|[^0-9])/);
  return candidate ? candidate[1] : undefined;
}

/** Postal ID: 12-digit or alphanumeric number, usually prefixed with "P". */
function parsePostalNumber(text: string): string | undefined {
  const labelled = text.match(
    /(?:postal\s+id|postal\s+identification|philippine\s+postal|\bphlpost\b)[^A-Za-z0-9]{0,24}([A-Z]{0,3}[ -]?\d{6,14})(?![0-9])/i
  );
  if (labelled) return pickIdToken(labelled[1].replace(/\s+/g, ""));

  const candidate = text.match(/(?:^|[^A-Za-z0-9])([A-Z]{1,2}[ -]?\d{8,14})(?:$|[^A-Za-z0-9])/);
  if (candidate) return pickIdToken(candidate[1].replace(/\s+/g, ""));

  for (const numeric of fixDigits(text).matchAll(/(?:^|[^0-9])(\d{8,14})(?:$|[^0-9])/g)) {
    const token = pickIdToken(numeric[1]);
    if (token) return token;
  }
  return undefined;
}

const ID_NUMBER_LABEL =
  /\b(?:student\s*(?:id|no\.?|number)|employee\s*(?:id|no\.?|number)|company\s*(?:id|no\.?|number)|staff\s*(?:id|no\.?|number)|badge\s*(?:no\.?|number)|id\s*(?:no\.?|number|#)|identification\s*(?:no\.?|number)|control\s*(?:no\.?|number)|card\s*(?:no\.?|number)|sss\s*(?:no\.?|number)|tin\s*(?:no\.?|number)|prc\s*(?:no\.?|number)|registration\s*(?:no\.?|number)|postal\s*id|umid\s*(?:no\.?|number)|lrn)\b/i;
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
    if (/^(\d)\1+$/.test(compact)) continue;
    if (/^09\d{9}$/.test(compact)) continue;
    if (/^(?:19|20)\d{2}[- ](?:19|20)\d{2}$/.test(candidate)) continue;
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
  if (type === "SSS") {
    const sss = parseSssNumber(text);
    if (sss) return { value: sss, type: "SSS" };
  }

  if (type === "TIN") {
    const tin = parseTinNumber(text);
    if (tin) return { value: tin, type: "TIN" };
  }

  if (type === "PRC") {
    const prc = parsePrcNumber(text);
    if (prc) return { value: prc, type: "PRC" };
  }

  if (type === "POSTAL_ID") {
    const postal = parsePostalNumber(text);
    if (postal) return { value: postal, type: "POSTAL_ID" };
  }

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

  const lrn = fixDigits(text).match(
    /(?:LRN|learner\s+reference\s+(?:number|no\.?))[^0-9]{0,10}(\d{4})[ -]?(\d{4})[ -]?(\d{4})/i
  );
  if (lrn) return { value: `${lrn[1]} ${lrn[2]} ${lrn[3]}`, type: "STUDENT_ID" };

  if (type === "STUDENT_ID") {
    const studentNumber = fixDigits(text).match(
      /(?:^|[^0-9])(\d{4})[ -]?(\d{4})[ -]?(\d{4})(?:$|[^0-9])/
    );
    if (studentNumber) {
      return {
        value: `${studentNumber[1]} ${studentNumber[2]} ${studentNumber[3]}`,
        type: "STUDENT_ID",
      };
    }
  }

  const allowNational = type === undefined || type === "NATIONAL_ID" || type === "OTHER";
  if (allowNational) {
    const pcn = fixDigits(text).match(/(?:^|[^0-9])(\d{4})[ -]?(\d{4})[ -]?(\d{4})[ -]?(\d{4})(?:$|[^0-9])/);
    if (pcn) {
      return { value: `${pcn[1]} ${pcn[2]} ${pcn[3]} ${pcn[4]}`, type: "NATIONAL_ID" };
    }

    const philSys = fixDigits(text).match(/(?:^|[^0-9])(\d{4})[ -]?(\d{4})[ -]?(\d{4})(?:$|[^0-9])/);
    if (philSys) {
      return { value: `${philSys[1]} ${philSys[2]} ${philSys[3]}`, type: "NATIONAL_ID" };
    }
  }

  const license = parseLicenseNumber(text);
  if (license) return { value: license, type: "DRIVERS_LICENSE" };

  const labelled = pickIdToken(valueAfterLabel(lines, ID_NUMBER_LABEL));
  if (labelled) return { value: labelled, type: type ?? "OTHER" };

  for (const line of lines) {
    if (/\b(?:school\s*id|school\s*year|grade|section)\b/i.test(line)) continue;
    for (const match of line.matchAll(GENERIC_ID_RE)) {
      const generic = pickIdToken(match[1]);
      if (generic) return { value: generic, type: type ?? "OTHER" };
    }
  }

  return undefined;
}

type TsvWord = {
  line: string;
  text: string;
  left: number;
  top: number;
  width: number;
  height: number;
};

type NameColumn = { kind: "last" | "first" | "middle"; center: number };

const TSV_NAME_KEYWORDS: { kind: NameColumn["kind"]; pattern: RegExp }[] = [
  { kind: "last", pattern: /^(?:last|surname|apelyido)$/i },
  { kind: "first", pattern: /^(?:first|given|pangalan)$/i },
  { kind: "middle", pattern: /^(?:middle|gitnang)$/i },
];

function isNameLabelWord(text: string): boolean {
  const word = text.replace(/[^A-Za-zÑñ]/g, "").toLowerCase();
  return word === "name" || TSV_NAME_KEYWORDS.some((entry) => entry.pattern.test(word));
}

function tsvWords(tsv: string, minConfidence = 30): TsvWord[] {
  const words: TsvWord[] = [];
  for (const row of tsv.split(/\r?\n/)) {
    const cols = row.split("\t");
    if (cols[0] !== "5") continue;

    const text = cols[11]?.trim();
    const confidence = Number(cols[10]);
    const left = Number(cols[6]);
    const top = Number(cols[7]);
    const width = Number(cols[8]);
    const height = Number(cols[9]);
    if (!text || !Number.isFinite(confidence) || confidence < minConfidence) continue;
    if (![left, top, width, height].every(Number.isFinite)) continue;

    words.push({
      line: `${cols[1]}:${cols[2]}:${cols[3]}:${cols[4]}`,
      text,
      left,
      top,
      width,
      height,
    });
  }
  return words;
}

function nameColumns(line: TsvWord[]): NameColumn[] {
  const columns: NameColumn[] = [];
  for (const word of line) {
    const text = word.text.replace(/[^A-Za-zÑñ]/g, "").toLowerCase();
    const match = TSV_NAME_KEYWORDS.find((entry) => entry.pattern.test(text));
    if (match) columns.push({ kind: match.kind, center: word.left + word.width / 2 });
  }
  return columns;
}

function columnBuckets(
  line: TsvWord[],
  columns: NameColumn[]
): Record<NameColumn["kind"], string[]> {
  const buckets: Record<NameColumn["kind"], string[]> = { last: [], first: [], middle: [] };
  if (columns.length === 0) return buckets;

  for (const word of line) {
    if (isNameLabelWord(word.text)) continue;
    const center = word.left + word.width / 2;
    let nearest = columns[0];
    for (const column of columns) {
      if (Math.abs(column.center - center) < Math.abs(nearest.center - center)) nearest = column;
    }
    buckets[nearest.kind].push(word.text);
  }
  return buckets;
}

function nameFromBuckets(buckets: Record<NameColumn["kind"], string[]>): ParsedName | null {
  const lastTokens = splitNameTokens(buckets.last.join(" "));
  const firstTokens = splitNameTokens(buckets.first.join(" "));
  if (!isNamePart(lastTokens) || !isNamePart(firstTokens)) return null;

  const middleTokens = splitNameTokens(buckets.middle.join(" "));
  const middleOk =
    middleTokens.length > 0 &&
    middleTokens.length <= 4 &&
    middleTokens.every((token, index) => isNameToken(token, index + 1));

  return {
    lastName: titleCase(lastTokens.join(" ")),
    firstName: titleCase(firstTokens.join(" ")),
    ...(middleOk ? { middleName: titleCase(middleTokens.join(" ")) } : {}),
  };
}

/** Reads the cardholder name using Tesseract's word grid, so columns line up. */
function parseNameFromTsv(tsv: string): ParsedName | null {
  const words = tsvWords(tsv);
  if (words.length === 0) return null;

  const lineMap = new Map<string, TsvWord[]>();
  for (const word of words) {
    const line = lineMap.get(word.line) ?? [];
    line.push(word);
    lineMap.set(word.line, line);
  }

  const lines = [...lineMap.values()]
    .map((line) => line.sort((a, b) => a.left - b.left))
    .sort((a, b) => Math.min(...a.map((word) => word.top)) - Math.min(...b.map((word) => word.top)));

  for (let i = 0; i < lines.length; i += 1) {
    const columns = nameColumns(lines[i]);
    const hasLast = columns.some((column) => column.kind === "last");
    const hasFirst = columns.some((column) => column.kind === "first");
    if (!hasLast || !hasFirst) continue;

    for (let j = i; j <= Math.min(i + 3, lines.length - 1); j += 1) {
      const parsed = nameFromBuckets(columnBuckets(lines[j], columns));
      if (parsed) return parsed;
    }
  }
  return null;
}

/**
 * Best-effort OCR extraction from any ID (PhilSys, passport, UMID, driver's
 * licence, student/school/company cards). Anything uncertain is left blank so
 * the visitor types it. Pass the Tesseract TSV when available so name columns
 * can be aligned by position.
 */
export function parseIdCardText(raw: string, tsv?: string | null): OcrResult {
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

  const name =
    (tsv ? parseNameFromTsv(tsv) : null) ??
    parseLabelledName(lines) ??
    findCommaName(lines) ??
    findAnchoredName(lines) ??
    findLooseName(lines);
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
