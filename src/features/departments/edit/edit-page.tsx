import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import EditDepartmentForm from "./edit-form";

export default async function EditDepartmentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  await requirePermission("department:manage");

  const department = await db.department.findUnique({ where: { id } });
  if (!department) notFound();

  return <EditDepartmentForm department={department} />;
}
