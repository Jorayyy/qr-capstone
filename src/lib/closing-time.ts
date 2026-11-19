import { manilaMidnight, manilaParts } from "@/lib/ph-time";

export const CAMPUS_CLOSING_KEY = "campus_closing_minute";
export const DEFAULT_CLOSING_MINUTE = 19 * 60;

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** "19:30" -> 1170. Returns null for anything that is not a valid 24-hour time. */
export function parseClosingTime(value: string): number | null {
  const match = TIME_RE.exec(value.trim());
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

/** 1170 -> "19:30". */
export function formatClosingTime(minute: number): string {
  const hours = String(Math.floor(minute / 60)).padStart(2, "0");
  const minutes = String(minute % 60).padStart(2, "0");
  return `${hours}:${minutes}`;
}

/** Guards values from the database and forms. */
export function safeClosingMinute(value: number | null | undefined): number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value < 1440
    ? value
    : DEFAULT_CLOSING_MINUTE;
}

/**
 * First occurrence of this daily closing time at or after `from`.
 * Manila has no DST, so adding a day is exactly 24 hours.
 */
export function nextClosingAt(minute: number, from: Date): Date {
  const { year, month, day } = manilaParts(from);
  const today = new Date(manilaMidnight(year, month, day).getTime() + minute * 60_000);
  return today.getTime() < from.getTime() ? new Date(today.getTime() + 86_400_000) : today;
}
