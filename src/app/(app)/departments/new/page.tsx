import { legacyRedirectTo } from "@/lib/portal-server";
import { portalHomePath } from "@/lib/portal";

export default function LegacyNewDepartmentPage() {
  return legacyRedirectTo((portal) =>
    portal === "admin" ? "/admin/departments/new" : portalHomePath(portal)
  );
}
