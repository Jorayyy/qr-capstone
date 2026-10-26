import { z } from "zod";

export const ID_TYPES = [
  "NATIONAL_ID",
  "PASSPORT",
  "DRIVERS_LICENSE",
  "UMID",
  "PRC",
  "POSTAL_ID",
  "STUDENT_ID",
  "SSS",
  "TIN",
  "COMPANY_ID",
  "OTHER",
] as const;
export const PURPOSES = ["ATTENDANCE", "DELIVERY", "INTERVIEW", "MEETING", "SCHOOL_VISIT", "OTHER"] as const;
export const AFFILIATIONS = [
  "VISITOR",
  "STUDENT",
  "FACULTY",
  "STAFF",
  "ALUMNI",
  "PARENT",
  "SUPPLIER",
  "GOVERNMENT",
  "OTHER",
] as const;
export const VISIT_TYPES = ["ONE_DAY", "MULTIPLE"] as const;
export const HOST_PREFERENCES = ["SPECIFIC", "ANY"] as const;

const isoDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date.")
  .refine((value) => {
    const [y, m, d] = value.split("-").map(Number);
    const date = new Date(Date.UTC(y, m - 1, d));
    return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
  }, "Use a valid date.");

const optionalIsoDate = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value === "" ? undefined : value))
  .pipe(isoDate.optional());

/** Optional text field: trims, converts empty → undefined, enforces max length. */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Must be at most ${max} characters.`)
    .optional()
    .transform((value) => (value === "" ? undefined : value));

const requiredText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required.`)
    .max(max, `${label} must be at most ${max} characters.`);

/** Reference to a privately stored photo: a blob pathname under `visitors/`. */
const requiredPhotoPath = z
  .string()
  .trim()
  .min(1, "Upload the front of your ID.")
  .max(300)
  .refine(
    (value) => /^visitors\/[A-Za-z0-9._/-]+$/.test(value),
    "Invalid photo reference."
  );

const optionalPhotoPath = z
  .string()
  .trim()
  .max(300)
  .optional()
  .transform((value) => (value === "" ? undefined : value))
  .refine(
    (value) => value === undefined || /^visitors\/[A-Za-z0-9._/-]+$/.test(value),
    "Invalid photo reference."
  );

/** Department photos live in their own Blob prefix and are served publicly. */
const optionalDepartmentPhotoPath = z
  .string()
  .trim()
  .max(300)
  .optional()
  .transform((value) => (value === "" ? undefined : value))
  .refine(
    (value) => value === undefined || /^departments\/[A-Za-z0-9._-]+$/.test(value),
    "Invalid photo reference."
  );

export const emailField = z
  .string()
  .trim()
  .min(3)
  .max(254)
  .refine((value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), "Invalid email address.")
  .transform((value) => value.toLowerCase());

const optionalEmail = z
  .string()
  .trim()
  .max(254, "Email must be at most 254 characters.")
  .optional()
  .transform((value) => (value === "" || value === undefined ? undefined : value.toLowerCase()))
  .refine(
    (value) => value === undefined || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
    "Invalid email address."
  );

export const loginSchema = z
  .object({
    email: emailField,
    password: z.string().min(1).max(128),
  })
  .strict();

export const registerVisitorSchema = z
  .object({
    firstName: requiredText(100, "First name"),
    middleName: optionalText(100),
    lastName: requiredText(100, "Last name"),
    email: optionalEmail,
    phone: optionalText(32),
    company: optionalText(120),
    affiliation: z.enum(AFFILIATIONS).optional(),
    dateOfBirth: optionalIsoDate,
    idType: z.enum(ID_TYPES),
    idNumber: optionalText(64),
    photoUrl: optionalPhotoPath,
    idPhotoUrl: optionalPhotoPath,
    departmentId: z.string().uuid("Invalid department."),
    purpose: z.enum(PURPOSES),
    hostName: optionalText(120),
    hostDepartment: optionalText(120),
    vehicleType: optionalText(64),
    vehicleModel: optionalText(64),
    vehiclePlateNumber: optionalText(64),
    notes: optionalText(500),
  })
  .strict();

export type RegisterVisitorInput = z.infer<typeof registerVisitorSchema>;

export const officeStopSchema = z
  .object({
    departmentId: z.string().uuid("Invalid office."),
    purpose: z.enum(PURPOSES),
    hostName: optionalText(120),
    hostPreference: z.enum(HOST_PREFERENCES).default("ANY"),
    notes: optionalText(300),
  })
  .strict();

/**
 * Public pre-registration. Email and phone are required because the pass is
 * delivered by email and the guard needs a callback number.
 */
export const publicRegistrationSchema = z
  .object({
    firstName: requiredText(100, "First name"),
    middleName: optionalText(100),
    lastName: requiredText(100, "Last name"),
    dateOfBirth: optionalIsoDate,
    email: emailField,
    phone: requiredText(32, "Contact number"),
    idType: z.enum(ID_TYPES),
    idNumber: optionalText(64),
    affiliation: z.enum(AFFILIATIONS),
    photoUrl: optionalPhotoPath,
    idPhotoUrl: requiredPhotoPath,
    offices: z
      .array(officeStopSchema)
      .min(1, "Choose at least one office to visit.")
      .max(6, "Choose up to 6 offices."),
    vehicleType: optionalText(64),
    vehicleModel: optionalText(64),
    vehicleColor: optionalText(32),
    vehiclePlateNumber: optionalText(64),
    visitType: z.enum(VISIT_TYPES),
    validFrom: isoDate,
    validUntil: optionalIsoDate,
    agree: z.literal("on", { message: "Please confirm that the details are correct." }),
  })
  .strict();

export type PublicRegistrationInput = z.infer<typeof publicRegistrationSchema>;

export const departmentSchema = z
  .object({
    name: requiredText(100, "Department name"),
    building: optionalText(120),
    contactPerson: optionalText(120),
    contactEmail: optionalText(254),
    photoPath: optionalDepartmentPhotoPath,
  })
  .strict();

export const uuidSchema = z.string().uuid();

export const qrLookupSchema = z
  .string()
  .trim()
  .min(4)
  .max(64)
  .regex(/^[A-Za-z0-9-]+$/, "Invalid QR code format.");

export const checkinSchema = z
  .object({
    qr: qrLookupSchema.optional(),
    visitId: z.string().uuid().optional(),
    departmentId: z.string().uuid().optional(),
  })
  .strict()
  .refine((value) => Boolean(value.qr || value.visitId), {
    message: "qr or visitId is required",
  });

export const checkoutSchema = z
  .object({
    qr: qrLookupSchema.optional(),
    visitId: z.string().uuid().optional(),
  })
  .strict()
  .refine((value) => Boolean(value.qr || value.visitId), {
    message: "qr or visitId is required",
  });

export const selfCheckinSchema = z
  .object({
    qr: qrLookupSchema,
  })
  .strict();

export const mfaCodeSchema = z
  .object({
    code: z.string().trim().min(6).max(10),
  })
  .strict();

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1).max(128),
    newPassword: z.string(),
  })
  .strict();

export const searchQuerySchema = z
  .string()
  .trim()
  .max(100)
  .regex(/^[A-Za-z0-9@._+\- ]*$/, "Invalid search term.");

export const USER_ROLES = ["ADMIN", "STAFF", "SECURITY", "RECEPTIONIST"] as const;

export const createUserSchema = z
  .object({
    email: emailField,
    name: requiredText(120, "Name"),
    role: z.enum(USER_ROLES),
    password: z.string().optional(),
  })
  .strict();

export const userRoleSchema = z
  .object({
    userId: z.string().uuid(),
    role: z.enum(USER_ROLES),
  })
  .strict();

/** Reads a FormData entry as a trimmed string. */
export function formString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

/**
 * Validates a post-login redirect target. Only same-site absolute paths are
 * allowed (blocks open redirects like //evil.com or /\evil.com).
 */
export function safeCallbackUrl(value: string | undefined | null): string | null {
  if (!value) return null;
  if (!value.startsWith("/")) return null;
  if (value.startsWith("//") || value.startsWith("/\\")) return null;
  if (value.includes("\\") || value.includes("\n") || value.includes("\r")) return null;
  return value;
}
