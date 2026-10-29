import { requirePermission } from "@/lib/auth";
import { currentPortal } from "@/lib/portal-server";
import RegisterVisitorForm from "./register-form";

export default async function RegisterVisitorPage() {
  await requirePermission("visitor:write");
  const portal = await currentPortal();

  return <RegisterVisitorForm portal={portal} />;
}
