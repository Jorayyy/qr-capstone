import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hash } from "@node-rs/argon2";
import { createHash, randomBytes } from "crypto";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

function qrHash(input: string): string {
  return createHash("sha256").update(input).digest("hex").slice(0, 32);
}

// @node-rs/argon2 defaults to Argon2id with these OWASP-recommended costs.
const ARGON2_OPTIONS = {
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
  outputLen: 32,
} as const;

function randomPassword(): string {
  return randomBytes(18).toString("base64url");
}

async function main() {
  // ── Users ────────────────────────────────────────────────────────────────
  // No hardcoded credentials: passwords come from the environment or are
  // generated randomly and printed ONCE to this terminal during initial setup.
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? randomPassword();
  const securityPassword = process.env.SEED_SECURITY_PASSWORD ?? randomPassword();
  const generated: string[] = [];

  const admin = await prisma.user.upsert({
    where: { email: "admin@university.edu" },
    update: {},
    create: {
      email: "admin@university.edu",
      passwordHash: await hash(adminPassword, ARGON2_OPTIONS),
      name: "System Administrator",
      role: "ADMIN",
      mustChangePassword: true,
    },
  });
  if (!process.env.SEED_ADMIN_PASSWORD) generated.push(`admin@university.edu — ${adminPassword}`);

  const security = await prisma.user.upsert({
    where: { email: "security@university.edu" },
    update: {},
    create: {
      email: "security@university.edu",
      passwordHash: await hash(securityPassword, ARGON2_OPTIONS),
      name: "Security Officer",
      role: "SECURITY",
      mustChangePassword: true,
    },
  });
  if (!process.env.SEED_SECURITY_PASSWORD) generated.push(`security@university.edu — ${securityPassword}`);
  void admin;
  void security;

  console.log("✓ Users created");
  if (generated.length > 0) {
    console.log("\n⚠ ONE-TIME INITIAL CREDENTIALS (copy now, shown only once):");
    for (const line of generated) console.log(`   ${line}`);
    console.log("   Users are forced to change their password at first sign-in.\n");
  }

  // ── Departments ──────────────────────────────────────────────────────────
  const departmentData = [
    { name: "Computer Science", building: "Tech Building" },
    { name: "Engineering", building: "Engineering Hall" },
    { name: "Business Admin", building: "Business Center" },
    { name: "Nursing", building: "Health Sciences" },
    { name: "Education", building: "Education Hall" },
  ];

  const departments: Record<string, string> = {};
  for (const d of departmentData) {
    const dept = await prisma.department.upsert({
      where: { name: d.name },
      update: {},
      create: { name: d.name, building: d.building },
    });
    departments[d.name] = dept.id;
  }

  console.log("✓ Departments created");

  // ── Visitors & Visits ────────────────────────────────────────────────────
  const visitorData = [
    {
      firstName: "Juan",
      lastName: "Dela Cruz",
      email: "juan.delacruz@email.com",
      phone: "09171234567",
      company: "Acme Corp",
      idType: "SSS" as const,
      idNumber: "SSS-123456789",
    },
    {
      firstName: "Maria",
      lastName: "Santos",
      email: "maria.santos@email.com",
      phone: "09181234567",
      company: "Tech Solutions",
      idType: "TIN" as const,
      idNumber: "TIN-987654321",
    },
    {
      firstName: "Jose",
      lastName: "Rizal",
      email: "jose.rizal@email.com",
      phone: "09191234567",
      company: "National University",
      idType: "PASSPORT" as const,
      idNumber: "P1234567A",
    },
    {
      firstName: "Ana",
      lastName: "Reyes",
      email: "ana.reyes@email.com",
      phone: "09201234567",
      company: "City Hospital",
      idType: "SSS" as const,
      idNumber: "SSS-112233445",
    },
    {
      firstName: "Pedro",
      lastName: "Garcia",
      email: "pedro.garcia@email.com",
      phone: "09211234567",
      company: "Metro Construction",
      idType: "TIN" as const,
      idNumber: "TIN-556677889",
    },
    {
      firstName: "Sofia",
      lastName: "Lopez",
      email: "sofia.lopez@email.com",
      phone: "09221234567",
      company: "EdTech PH",
      idType: "PASSPORT" as const,
      idNumber: "P9876543B",
    },
    {
      firstName: "Luis",
      lastName: "Mendoza",
      email: "luis.mendoza@email.com",
      phone: "09231234567",
      company: "Green Energy Inc",
      idType: "STUDENT_ID" as const,
      idNumber: "STU-2024-001",
    },
    {
      firstName: "Camille",
      lastName: "Torres",
      email: "camille.torres@email.com",
      phone: "09241234567",
      company: "Bright Minds Academy",
      idType: "SSS" as const,
      idNumber: "SSS-998877665",
    },
    {
      firstName: "Mark",
      lastName: "Cruz",
      email: "mark.cruz@email.com",
      phone: "09251234567",
      company: "Pacific Logistics",
      idType: "TIN" as const,
      idNumber: "TIN-443322110",
    },
    {
      firstName: "Isabelle",
      lastName: "Fernandez",
      email: "isabelle.fernandez@email.com",
      phone: "09261234567",
      company: "Creative Studio",
      idType: "OTHER" as const,
      idNumber: "OTHER-00123",
    },
  ];

  const purposeValues: Array<"ATTENDANCE" | "DELIVERY" | "INTERVIEW" | "MEETING" | "SCHOOL_VISIT" | "OTHER"> = [
    "ATTENDANCE",
    "DELIVERY",
    "INTERVIEW",
    "MEETING",
    "SCHOOL_VISIT",
    "OTHER",
  ];
  const statuses: Array<"PENDING" | "CHECKED_IN" | "CHECKED_OUT" | "CANCELLED"> = [
    "PENDING",
    "CHECKED_IN",
    "CHECKED_OUT",
    "CANCELLED",
  ];
  const deptNames = Object.keys(departments);

  for (let i = 0; i < visitorData.length; i++) {
    const v = visitorData[i];
    const visitor = await prisma.visitor.create({
      data: {
        ...v,
        visits: {
          create: {
            referenceCode: `EVSU-${new Date().getFullYear()}-${String(9000 + i).padStart(5, "0")}`,
            departmentId: departments[deptNames[i % deptNames.length]],
            purpose: purposeValues[i % purposeValues.length],
            status: statuses[i % statuses.length],
            visitType: i % 2 === 0 ? "ONE_DAY" : "MULTIPLE",
            expectedArrival: new Date(Date.now() + (i + 1) * 86400000),
            validFrom: new Date(Date.now() + (i + 1) * 86400000),
            actualArrival: i % 3 === 0 ? new Date() : null,
            hostName: `Host ${i + 1}`,
            hostDepartment: deptNames[i % deptNames.length],
            vehiclePlateNumber: i % 2 === 0 ? `ABC-${1000 + i}` : undefined,
            qrCode: qrHash(`visit-${Date.now()}-${i}`),
            notes: `Sample visit #${i + 1}`,
          },
        },
      },
    });
    console.log(`  visitor ${visitor.firstName} ${visitor.lastName} created`);
  }

  console.log("✓ Visitors & Visits created");
  console.log("\nSeed complete!");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
