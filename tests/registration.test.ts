import { describe, expect, it } from "vitest";
import {
  formatReference,
  manilaDayBounds,
  maskIdNumber,
  officeSummary,
  parseIdCardText,
  passState,
  resolveVisitWindow,
  todayIso,
} from "@/lib/registration";
import { departmentSchema, publicRegistrationSchema } from "@/lib/validation";
import { departmentPhotoSrc } from "@/lib/photos";

describe("formatReference", () => {
  it("pads the sequence to five digits", () => {
    expect(formatReference(2026, 123)).toBe("EVSU-2026-00123");
    expect(formatReference(2026, 7)).toBe("EVSU-2026-00007");
    expect(formatReference(2026, 123456)).toBe("EVSU-2026-123456");
  });
});

describe("todayIso", () => {
  it("uses the Manila calendar date, not UTC", () => {
    expect(todayIso(new Date("2026-10-26T15:59:00Z"))).toBe("2026-10-26");
    expect(todayIso(new Date("2026-10-26T16:00:00Z"))).toBe("2026-10-27");
  });
});

describe("manilaDayBounds", () => {
  it("spans exactly one Manila day in UTC", () => {
    const { start, end } = manilaDayBounds("2026-10-26");
    expect(start.toISOString()).toBe("2026-10-25T16:00:00.000Z");
    expect(end.toISOString()).toBe("2026-10-26T15:59:59.999Z");
  });
});

describe("resolveVisitWindow", () => {
  const now = new Date("2026-10-26T02:00:00Z");

  it("gives a one-day pass the whole selected day", () => {
    const result = resolveVisitWindow({ visitType: "ONE_DAY", validFrom: "2026-10-26", now });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.window.validFrom.toISOString()).toBe("2026-10-25T16:00:00.000Z");
      expect(result.window.validUntil.toISOString()).toBe("2026-10-26T15:59:59.999Z");
    }
  });

  it("keeps a multiple-visit pass inside its date range", () => {
    const result = resolveVisitWindow({
      visitType: "MULTIPLE",
      validFrom: "2026-10-26",
      validUntil: "2026-10-30",
      now,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.window.validUntil.toISOString()).toBe("2026-10-30T15:59:59.999Z");
    }
  });

  it("rejects a past start date", () => {
    const result = resolveVisitWindow({ visitType: "ONE_DAY", validFrom: "2026-10-25", now });
    expect(result.ok).toBe(false);
  });

  it("requires an end date for multiple visits", () => {
    const result = resolveVisitWindow({ visitType: "MULTIPLE", validFrom: "2026-10-26", now });
    expect(result.ok).toBe(false);
  });

  it("rejects an end date before the start", () => {
    const result = resolveVisitWindow({
      visitType: "MULTIPLE",
      validFrom: "2026-10-27",
      validUntil: "2026-10-26",
      now,
    });
    expect(result.ok).toBe(false);
  });

  it("caps validity at 30 days", () => {
    const result = resolveVisitWindow({
      visitType: "MULTIPLE",
      validFrom: "2026-10-26",
      validUntil: "2026-11-25",
      now,
    });
    expect(result.ok).toBe(false);
  });
});

describe("parseIdCardText", () => {
  it("reads a PhilSys-style card", () => {
    const result = parseIdCardText(`
      REPUBLIKA NG PILIPINAS
      PHILIPPINE IDENTIFICATION CARD
      DELA CRUZ, MARIA SANTOS
      1234 5678 9012
      Date of Birth: Jan 15, 2000
    `);
    expect(result).toEqual({
      lastName: "Dela Cruz",
      firstName: "Maria",
      middleName: "Santos",
      idNumber: "1234 5678 9012",
      dateOfBirth: "2000-01-15",
    });
  });

  it("reads a labelled layout", () => {
    const result = parseIdCardText(`
      SURNAME
      DELA CRUZ
      GIVEN NAME
      MARIA
      Date of Birth: 15/01/2000
    `);
    expect(result.lastName).toBe("Dela Cruz");
    expect(result.firstName).toBe("Maria");
    expect(result.dateOfBirth).toBe("2000-01-15");
  });

  it("returns an empty result instead of guessing", () => {
    expect(parseIdCardText("no readable text")).toEqual({});
  });
});

describe("maskIdNumber / officeSummary", () => {
  it("shows only the last four characters of an ID", () => {
    expect(maskIdNumber("1234 5678 9012")).toBe("••••9012");
    expect(maskIdNumber(null)).toBe("—");
  });

  it("shortens long office lists", () => {
    expect(officeSummary(["Registrar", "Accounting"])).toBe("Registrar, Accounting");
    expect(officeSummary(["A", "B", "C", "D"])).toBe("A, B, C +1 more");
  });
});

describe("publicRegistrationSchema", () => {
  const base = {
    firstName: "Maria",
    lastName: "Dela Cruz",
    email: "maria@example.com",
    phone: "0917 123 4567",
    idType: "NATIONAL_ID",
    affiliation: "VISITOR",
    idPhotoUrl: "visitors/abc/ID.jpg",
    offices: [
      { departmentId: "3f1f6b0e-1c2d-4e5f-8a9b-0c1d2e3f4a5b", purpose: "MEETING", hostPreference: "ANY" },
    ],
    visitType: "ONE_DAY",
    validFrom: "2026-10-26",
    agree: "on",
  };

  it("accepts a complete pre-registration", () => {
    expect(publicRegistrationSchema.safeParse(base).success).toBe(true);
  });

  it("requires the ID photo", () => {
    const { idPhotoUrl: _id, ...withoutId } = base;
    expect(publicRegistrationSchema.safeParse(withoutId).success).toBe(false);
    expect(publicRegistrationSchema.safeParse({ ...base, idPhotoUrl: "other/x.jpg" }).success).toBe(false);
  });

  it("requires at least one office", () => {
    const result = publicRegistrationSchema.safeParse({ ...base, offices: [] });
    expect(result.success).toBe(false);
  });

  it("requires the confirmation checkbox", () => {
    const { agree: _agree, ...withoutAgree } = base;
    expect(publicRegistrationSchema.safeParse(withoutAgree).success).toBe(false);
  });

  it("rejects malformed emails and dates", () => {
    expect(publicRegistrationSchema.safeParse({ ...base, email: "nope" }).success).toBe(false);
    expect(publicRegistrationSchema.safeParse({ ...base, validFrom: "2026-02-31" }).success).toBe(false);
  });
});

describe("passState", () => {
  const now = Date.parse("2026-03-10T02:00:00Z");
  const base = { status: "PENDING", qrExpiresAt: new Date("2026-03-11T02:00:00Z"), qrRevokedAt: null };

  it("reports an active pass inside its window", () => {
    expect(passState(base, now)).toBe("ACTIVE");
    expect(passState({ ...base, status: "CHECKED_IN" }, now)).toBe("INSIDE");
  });

  it("treats expiry, revocation and cancellation as terminal", () => {
    expect(passState({ ...base, qrExpiresAt: new Date("2026-03-09T02:00:00Z") }, now)).toBe("EXPIRED");
    expect(passState({ ...base, qrRevokedAt: new Date(now) }, now)).toBe("REVOKED");
    expect(passState({ ...base, status: "CANCELLED" }, now)).toBe("CANCELLED");
  });
});

describe("departmentPhotoSrc", () => {
  it("serves blob uploads through the photo API", () => {
    expect(departmentPhotoSrc("departments/a1.jpg")).toBe(
      "/api/department-photo?path=departments%2Fa1.jpg"
    );
  });

  it("passes https links straight through and ignores empty values", () => {
    expect(departmentPhotoSrc("https://example.edu/building.jpg")).toBe(
      "https://example.edu/building.jpg"
    );
    expect(departmentPhotoSrc(null)).toBeNull();
  });
});

describe("departmentSchema photo link", () => {
  const base = { name: "Registrar" };

  it("accepts an https image link", () => {
    expect(departmentSchema.safeParse({ ...base, photoPath: "https://example.edu/a.jpg" }).success).toBe(true);
  });

  it("rejects non-https links", () => {
    expect(departmentSchema.safeParse({ ...base, photoPath: "http://example.edu/a.jpg" }).success).toBe(false);
  });
});