import { requirePermission } from "@/lib/auth";
import NewDepartmentForm from "./new-form";

export default async function NewDepartmentPage() {
  await requirePermission("department:manage");
  return <NewDepartmentForm />;
}
