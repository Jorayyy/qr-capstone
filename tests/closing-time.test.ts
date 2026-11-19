import { describe, expect, it } from "vitest";
import {
  DEFAULT_CLOSING_MINUTE,
  formatClosingTime,
  nextClosingAt,
  parseClosingTime,
  safeClosingMinute,
} from "@/lib/closing-time";

const at = (iso: string) => new Date(iso);

describe("parseClosingTime", () => {
  it("accepts 24-hour times", () => {
    expect(parseClosingTime("19:00")).toBe(1140);
    expect(parseClosingTime("09:05")).toBe(545);
    expect(parseClosingTime("00:00")).toBe(0);
  });

  it("rejects invalid input", () => {
    expect(parseClosingTime("")).toBeNull();
    expect(parseClosingTime("24:00")).toBeNull();
    expect(parseClosingTime("9:00")).toBeNull();
    expect(parseClosingTime("19:60")).toBeNull();
  });
});

describe("formatClosingTime", () => {
  it("round-trips with parseClosingTime", () => {
    expect(formatClosingTime(1140)).toBe("19:00");
    expect(parseClosingTime(formatClosingTime(545))).toBe(545);
  });
});

describe("safeClosingMinute", () => {
  it("falls back to the 19:00 default for bad values", () => {
    expect(safeClosingMinute(null)).toBe(DEFAULT_CLOSING_MINUTE);
    expect(safeClosingMinute(-1)).toBe(DEFAULT_CLOSING_MINUTE);
    expect(safeClosingMinute(1440)).toBe(DEFAULT_CLOSING_MINUTE);
    expect(safeClosingMinute(1020)).toBe(1020);
  });
});

describe("nextClosingAt", () => {
  it("uses today's closing when the arrival is before it (Manila time)", () => {
    // 08:00 Manila, closes 19:00 -> 11:00Z same day
    expect(nextClosingAt(1140, at("2026-11-19T00:00:00Z")).toISOString()).toBe(
      "2026-11-19T11:00:00.000Z"
    );
  });

  it("rolls to tomorrow when the arrival is after closing", () => {
    // 20:00 Manila -> next closing is tomorrow 19:00 Manila
    expect(nextClosingAt(1140, at("2026-11-19T12:00:00Z")).toISOString()).toBe(
      "2026-11-20T11:00:00.000Z"
    );
  });

  it("treats an arrival at the exact closing instant as closing now", () => {
    expect(nextClosingAt(1140, at("2026-11-19T11:00:00Z")).toISOString()).toBe(
      "2026-11-19T11:00:00.000Z"
    );
  });

  it("crosses month boundaries", () => {
    expect(nextClosingAt(1140, at("2026-11-30T12:00:00Z")).toISOString()).toBe(
      "2026-12-01T11:00:00.000Z"
    );
  });
});
