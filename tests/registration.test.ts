import { describe, expect, it } from "vitest";
import {
  filterOcrTextByConfidence,
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
      idType: "NATIONAL_ID",
      idNumber: "1234 5678 9012",
    });
  });

  it("reads a 16-digit PhilSys card number", () => {
    const result = parseIdCardText(`
      PHILIPPINE IDENTIFICATION CARD
      DELA CRUZ, MARIA SANTOS
      1234 5678 9012 3456
      Date of Birth: Jan 15, 2000
    `);
    expect(result.idType).toBe("NATIONAL_ID");
    expect(result.idNumber).toBe("1234 5678 9012 3456");
  });

  it("reads a driver's licence without picking up background clutter", () => {
    const result = parseIdCardText(`
      . «i . -,
      h Te HER ' ba , .
      REPUBLIC OF THE PHILIPPINES
      LAND TRANSPORTATION OFFICE
      DRIVER'S LICENSE
      Last Name. First Name. Middle Name
      ANDRADE, MARK JORY ABELLA ]
      Nationality Sex Date of Birth Weight (kg) Height(m)
      PHL M 2001/05/05 65 1.64
      Address
      PLEASANTVILLE, BARANGAY 63, TACLOBAN
      CITY (CAPITAL), LEYTE, 6500
      License No. Expiration Date Agency Code
      H02-26-00055¢ 2030/05/05 H02
    `);
    expect(result).toEqual({
      lastName: "Andrade",
      firstName: "Mark Jory",
      middleName: "Abella",
      idType: "DRIVERS_LICENSE",
      idNumber: "H02-26-000556",
    });
  });

  it("does not treat birth or expiration dates as the ID number", () => {
    const result = parseIdCardText(`
      DRIVER'S LICENSE
      Date of Birth 2001/05/05
      Expiration Date 2030/05/05
    `);
    expect(result.idNumber).toBeUndefined();
  });

  it("filters faint OCR lines before parsing", () => {
    const tsv = [
      "5\t1\t0\t0\t0\t0\t0\t0\t0\t0\t40\tJUNK",
      "5\t1\t0\t0\t0\t1\t0\t0\t0\t0\t45\tTEXT",
      "5\t1\t0\t0\t1\t0\t0\t0\t0\t0\t95\tANDRADE,",
      "5\t1\t0\t0\t1\t10\t0\t0\t0\t0\t96\tMARK",
      "5\t1\t0\t0\t1\t20\t0\t0\t0\t0\t91\tJORY",
      "5\t1\t0\t0\t1\t30\t0\t0\t0\t0\t96\tABELLA",
    ].join("\n");

    expect(filterOcrTextByConfidence(tsv)).toBe("ANDRADE, MARK JORY ABELLA");
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
  });

  it("reads the bilingual labels on a real PhilSys card", () => {
    const result = parseIdCardText(`
      REPUBLIKA NG PILIPINAS
      Republika ng Pilipinas
      PAMBANSANG PAGKAKAKILANLAN
      Philippine Identification Card
      2697-0257-2839-5293
      Apelyido/Last Name
      ANDRADE
      Mga Pangalan/Given Names
      MARK JORY
      Gitnang Apelyido/Middle Name
      ABELLA
      Petsa ng Kapanganakan/Date of Birth
      MAY 05, 2001
      Tirahan/Address
      MAHAYHAY SAGKAHAN, BARANGAY 63, CITY OF TACLOBAN
      LEYTE
    `);
    expect(result).toEqual({
      lastName: "Andrade",
      firstName: "Mark Jory",
      middleName: "Abella",
      idType: "NATIONAL_ID",
      idNumber: "2697 0257 2839 5293",
    });
  });

  it("ignores a misread English word in a bilingual middle label", () => {
    const result = parseIdCardText(`
      Apelyido/Last Name
      ANDRADE
      Mga Pangalan/Given Names
      MARK JORY
      Gitnang Apelyido/Middie Name
      ABELLA
    `);
    expect(result.lastName).toBe("Andrade");
    expect(result.firstName).toBe("Mark Jory");
    expect(result.middleName).toBe("Abella");
  });

  it("reads an EVSU student ID", () => {
    const result = parseIdCardText(`
      EASTERN VISAYAS STATE UNIVERSITY
      Tacloban City, Leyte
      DELA CRUZ, JUAN P.
      BS INFORMATION TECHNOLOGY
      STUDENT ID NO. 2023-00123
    `);
    expect(result).toEqual({
      lastName: "Dela Cruz",
      firstName: "Juan",
      middleName: "P",
      idType: "STUDENT_ID",
      idNumber: "2023-00123",
    });
  });

  it("fills a generic ID with a free-order name and labelled number", () => {
    const result = parseIdCardText(`
      NORTHWIND TRADING CORPORATION
      JUAN DELA CRUZ
      ID NUMBER: CT-45821
    `);
    expect(result.lastName).toBe("Dela Cruz");
    expect(result.firstName).toBe("Juan");
    expect(result.idNumber).toBe("CT-45821");
    expect(result.idType).toBe("OTHER");
  });

  it("does not mistake the school heading for the visitor name", () => {
    const result = parseIdCardText(`
      EASTERN VISAYAS STATE UNIVERSITY
      MARIA SANTOS
      ID NO. 2024-00987
    `);
    expect(result.firstName).toBe("Maria");
    expect(result.lastName).toBe("Santos");
  });

  it("reads a school ID and ignores the school's own details", () => {
    const result = parseIdCardText(`
      SNHS
      SAGKAHAN NATIONAL HIGH SCHOOL
      Brgy. 64 Bliss Sagkahan, Tacloban City
      School ID: 303528
      BAE ABELLA EE
      JUNIOR HIGH SCHOOL
      JIEZRELL C. ABELLA
      Student
      LRN: 124245160026
      Grade 10 - LUBI-LUBI
      SCHOOL YEAR 2026-2027
      MA. DELIA E. SORIA Dev. EdD
      School Principal IV
    `);
    expect(result).toEqual({
      firstName: "Jiezrell",
      middleName: "C",
      lastName: "Abella",
      idType: "STUDENT_ID",
      idNumber: "1242 4516 0026",
    });
  });

  it("reads a PRC ID", () => {
    const result = parseIdCardText(`
      PROFESSIONAL REGULATION COMMISSION
      PROFESSIONAL IDENTIFICATION CARD
      DELA CRUZ, JUAN P.
      PRC No. 0123456
    `);
    expect(result).toEqual({
      lastName: "Dela Cruz",
      firstName: "Juan",
      middleName: "P",
      idType: "PRC",
      idNumber: "0123456",
    });
  });

  it("reads a Postal ID", () => {
    const result = parseIdCardText(`
      PHILIPPINE POSTAL CORPORATION
      POSTAL ID
      DELA CRUZ, JUAN P.
      Postal ID No. P123456789012
    `);
    expect(result.idType).toBe("POSTAL_ID");
    expect(result.idNumber).toBe("P123456789012");
  });

  it("reads an SSS ID", () => {
    const result = parseIdCardText(`
      SOCIAL SECURITY SYSTEM
      DELA CRUZ, JUAN P.
      SSS No. 34-1234567-8
      Date of Birth 2001/05/05
    `);
    expect(result.idType).toBe("SSS");
    expect(result.idNumber).toBe("34-1234567-8");
  });

  it("reads a TIN ID with a branch code", () => {
    const result = parseIdCardText(`
      BUREAU OF INTERNAL REVENUE
      TIN: 123-456-789-00000
      DELA CRUZ, JUAN P.
    `);
    expect(result.idType).toBe("TIN");
    expect(result.idNumber).toBe("123-456-789-00000");
  });

  it("reads a company ID", () => {
    const result = parseIdCardText(`
      NORTHWIND TRADING CORPORATION
      DELA CRUZ, JUAN P.
      EMPLOYEE ID: EMP-00123
    `);
    expect(result.idType).toBe("COMPANY_ID");
    expect(result.idNumber).toBe("EMP-00123");
  });

  it("reads a three-part comma name and drops honorifics", () => {
    const result = parseIdCardText(`
      PHILIPPINE IDENTIFICATION CARD
      MR. DELA CRUZ, JUAN, SANTOS
      1234 5678 9012
    `);
    expect(result.firstName).toBe("Juan");
    expect(result.middleName).toBe("Santos");
    expect(result.lastName).toBe("Dela Cruz");
  });

  it("aligns PhilSys name columns using the OCR word grid", () => {
    const tsv = [
      "5\t1\t1\t1\t1\t0\t10\t100\t40\t20\t95\tLAST",
      "5\t1\t1\t1\t1\t1\t55\t100\t40\t20\t95\tNAME",
      "5\t1\t1\t1\t1\t2\t200\t100\t45\t20\t95\tFIRST",
      "5\t1\t1\t1\t1\t3\t250\t100\t40\t20\t95\tNAME",
      "5\t1\t1\t1\t1\t4\t400\t100\t55\t20\t95\tMIDDLE",
      "5\t1\t1\t1\t1\t5\t460\t100\t40\t20\t95\tNAME",
      "5\t1\t1\t1\t2\t0\t10\t130\t40\t20\t95\tMAY",
      "5\t1\t1\t1\t2\t1\t55\t130\t30\t20\t95\tOS",
      "5\t1\t1\t1\t2\t2\t200\t130\t30\t20\t95\tON",
      "5\t1\t1\t1\t2\t3\t400\t130\t60\t20\t95\tSANTOS",
    ].join("\n");

    const result = parseIdCardText(
      "LAST NAME FIRST NAME MIDDLE NAME\nMAY OS ON SANTOS\n2697 0257 2839 5293",
      tsv
    );

    expect(result.lastName).toBe("May Os");
    expect(result.firstName).toBe("On");
    expect(result.middleName).toBe("Santos");
    expect(result.idNumber).toBe("2697 0257 2839 5293");
  });

  it("reads a surname-first name without a comma", () => {
    const result = parseIdCardText(`
      DELA CRUZ JUAN P.
      ID NO. 2024-00987
    `);
    expect(result.lastName).toBe("Dela Cruz");
    expect(result.firstName).toBe("Juan");
    expect(result.middleName).toBe("P");
  });

  it("recovers a middle initial printed on the next line", () => {
    const result = parseIdCardText(`
      DELA CRUZ, JUAN
      P.
      PHILIPPINE IDENTIFICATION CARD
      1234 5678 9012
    `);
    expect(result.lastName).toBe("Dela Cruz");
    expect(result.firstName).toBe("Juan");
    expect(result.middleName).toBe("P");
    expect(result.idNumber).toBe("1234 5678 9012");
  });

  it("does not mistake a company heading for the visitor name", () => {
    const result = parseIdCardText(`
      NORTHWIND TRADING
      JUAN DELA CRUZ
      ID NO. CT-45821
    `);
    expect(result.firstName).toBe("Juan");
    expect(result.lastName).toBe("Dela Cruz");
    expect(result.idNumber).toBe("CT-45821");
  });

  it("reads a name printed under a longer label", () => {
    const result = parseIdCardText(`
      NAME OF STUDENT: JUAN DELA CRUZ
      STUDENT ID NO. 2023-00123
    `);
    expect(result.firstName).toBe("Juan");
    expect(result.lastName).toBe("Dela Cruz");
    expect(result.idType).toBe("STUDENT_ID");
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