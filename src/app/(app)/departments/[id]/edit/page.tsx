import { legacyRedirectTo } from "@/lib/portal-server";
import { portalHomePath } from "@/lib/portal";

export default async function LegacyEditDepartmentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return legacyRedirectTo((portal) =>
    portal === "admin" ? `/admin/departments/${id}/edit` : portalHomePath(portal)
  );
}
