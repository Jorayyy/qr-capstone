import type { Metadata } from "next";
import { db } from "@/lib/db";
import { PublicShell } from "@/components/public-shell";
import { SITE } from "@/lib/site-info";
import RegisterWizard from "./register-wizard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `Register as a visitor · ${SITE.shortName} Visitor Management`,
  description:
    "Pre-register your campus visit, scan your ID, choose the offices to visit, and receive a QR visitor pass by email.",
};

export default async function RegisterPage() {
  const departments = await db.department.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, building: true },
  });

  return (
    <PublicShell>
      <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:py-14">
        <RegisterWizard departments={departments} />
      </div>
    </PublicShell>
  );
}
