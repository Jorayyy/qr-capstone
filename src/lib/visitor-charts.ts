import { manilaMidnight, manilaParts } from "@/lib/ph-time";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const PURPOSE_LABEL: Record<string, string> = {
  ATTENDANCE: "Attendance",
  DELIVERY: "Delivery",
  INTERVIEW: "Interview",
  MEETING: "Meeting",
  SCHOOL_VISIT: "School visit",
  OTHER: "Other",
};

export type VisitorChartVisit = {
  createdAt: Date;
  actualArrival: Date | null;
  purpose: string;
  purposeOther: string | null;
};

export function buildVisitorCharts(visits: VisitorChartVisit[], now = new Date()) {
  const stamp = manilaParts(now);
  const todayKey = `${stamp.year}-${stamp.month + 1}-${stamp.day}`;

  const days = Array.from({ length: 7 }, (_, i) => {
    const start = manilaMidnight(stamp.year, stamp.month, stamp.day - 6 + i);
    const parts = manilaParts(start);
    return {
      key: `${parts.year}-${parts.month + 1}-${parts.day}`,
      label: WEEKDAYS[parts.weekday],
      full: new Date(Date.UTC(parts.year, parts.month, parts.day)).toLocaleDateString("en-PH", {
        timeZone: "UTC",
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
      registered: 0,
      checkedIn: 0,
    };
  });
  const byDay = new Map(days.map((day) => [day.key, day]));
  const purposeCounts = new Map<string, number>();

  for (const visit of visits) {
    const created = manilaParts(visit.createdAt);
    const createdDay = byDay.get(`${created.year}-${created.month + 1}-${created.day}`);
    if (createdDay) {
      createdDay.registered += 1;
      if (createdDay.key === todayKey) {
        const purpose =
          visit.purpose === "OTHER" && visit.purposeOther ? visit.purposeOther : visit.purpose;
        purposeCounts.set(purpose, (purposeCounts.get(purpose) ?? 0) + 1);
      }
    }

    if (visit.actualArrival) {
      const arrived = manilaParts(visit.actualArrival);
      const arrivedDay = byDay.get(`${arrived.year}-${arrived.month + 1}-${arrived.day}`);
      if (arrivedDay) arrivedDay.checkedIn += 1;
    }
  }

  const todayTotal = byDay.get(todayKey)?.registered ?? 0;
  const purposes = [...purposeCounts.entries()]
    .map(([key, count]) => ({
      name: PURPOSE_LABEL[key] ?? key,
      count,
      percent: todayTotal ? Math.round((count / todayTotal) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count);

  return {
    days,
    purposes,
    todayTotal,
    weekTotal: days.reduce((sum, day) => sum + day.registered, 0),
    trendMax: Math.max(1, ...days.flatMap((day) => [day.registered, day.checkedIn])),
  };
}
