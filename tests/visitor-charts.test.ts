import { describe, expect, it } from "vitest";
import { buildVisitorCharts } from "@/lib/visitor-charts";

const at = (iso: string) => new Date(iso);

describe("buildVisitorCharts", () => {
  const now = at("2026-11-17T04:00:00Z");

  const visits = [
    {
      createdAt: at("2026-11-16T16:30:00Z"),
      actualArrival: at("2026-11-16T23:00:00Z"),
      purpose: "MEETING",
      purposeOther: null,
    },
    {
      createdAt: at("2026-11-11T16:05:00Z"),
      actualArrival: null,
      purpose: "DELIVERY",
      purposeOther: null,
    },
    {
      createdAt: at("2026-11-16T15:59:00Z"),
      actualArrival: at("2026-11-16T16:30:00Z"),
      purpose: "ATTENDANCE",
      purposeOther: null,
    },
    {
      createdAt: at("2026-11-16T17:00:00Z"),
      actualArrival: null,
      purpose: "OTHER",
      purposeOther: "Enrollment",
    },
    {
      createdAt: at("2026-11-10T15:00:00Z"),
      actualArrival: null,
      purpose: "DELIVERY",
      purposeOther: null,
    },
  ];

  it("buckets the last seven Manila days", () => {
    const { days } = buildVisitorCharts(visits, now);
    expect(days).toHaveLength(7);
    expect(days[0]).toMatchObject({ key: "2026-11-11", label: "Wed", registered: 0, checkedIn: 0 });
    expect(days[1]).toMatchObject({ key: "2026-11-12", label: "Thu", registered: 1, checkedIn: 0 });
    expect(days[6]).toMatchObject({ key: "2026-11-17", label: "Tue", registered: 2, checkedIn: 2 });
  });

  it("counts today's purposes only and keeps free-text purposes", () => {
    const { todayTotal, purposes } = buildVisitorCharts(visits, now);
    expect(todayTotal).toBe(2);
    expect(purposes).toEqual([
      { name: "Meeting", count: 1, percent: 50 },
      { name: "Enrollment", count: 1, percent: 50 },
    ]);
  });

  it("ignores visits outside the window", () => {
    const { weekTotal } = buildVisitorCharts(visits, now);
    expect(weekTotal).toBe(4);
  });
});
