import { describe, expect, it } from "vitest";
import { resolveDashboardRange, resolveReportRange } from "@/lib/reports";

const at = (iso: string) => new Date(iso);

describe("resolveReportRange", () => {
  it("starts the day at Manila midnight, not UTC midnight", () => {
    // 07:00 Monday in Manila (23:00 Sunday UTC) must belong to Monday's report.
    const { start, end } = resolveReportRange("day", at("2026-10-18T23:00:00Z"));
    expect(start.toISOString()).toBe("2026-10-18T16:00:00.000Z");
    expect(end.toISOString()).toBe("2026-10-19T16:00:00.000Z");
  });

  it("keeps a late-evening Manila visit in that same day", () => {
    const { start, end } = resolveReportRange("day", at("2026-10-18T15:30:00Z"));
    const visit = at("2026-10-18T15:30:00Z");
    expect(visit >= start && visit < end).toBe(true);
  });

  it("starts the week on Monday Manila time", () => {
    const { start, end } = resolveReportRange("week", at("2026-10-21T02:00:00Z"));
    expect(start.toISOString()).toBe("2026-10-18T16:00:00.000Z");
    expect(end.toISOString()).toBe("2026-10-25T16:00:00.000Z");
  });

  it("rolls month and year over to Manila boundaries", () => {
    expect(resolveReportRange("month", at("2026-10-18T12:00:00Z")).start.toISOString()).toBe(
      "2026-09-30T16:00:00.000Z"
    );
    expect(resolveReportRange("year", at("2026-10-18T12:00:00Z")).start.toISOString()).toBe(
      "2025-12-31T16:00:00.000Z"
    );
  });

  it("labels the period with Manila dates", () => {
    expect(resolveReportRange("day", at("2026-10-18T23:00:00Z")).label).toBe("Monday, October 19, 2026");
    expect(resolveReportRange("month", at("2026-10-18T12:00:00Z")).label).toBe("October 2026");
    expect(resolveReportRange("year", at("2026-10-18T12:00:00Z")).label).toBe("2026");
  });
});

describe("resolveDashboardRange", () => {
  it("covers all time up to the end of today in Manila", () => {
    const { start, end, label } = resolveDashboardRange("all", at("2026-10-18T15:30:00Z"));
    expect(start.getTime()).toBe(0);
    expect(end.toISOString()).toBe("2026-10-18T16:00:00.000Z");
    expect(label).toBe("All time");
  });

  it("defers to the report ranges otherwise", () => {
    expect(resolveDashboardRange("week", at("2026-10-21T02:00:00Z")).start.toISOString()).toBe(
      "2026-10-18T16:00:00.000Z"
    );
  });
});
