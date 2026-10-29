import { legacyRedirectTo } from "@/lib/portal-server";
import { portalHomePath } from "@/lib/portal";

export default function LegacyDepartmentsPage() {
  return legacyRedirectTo((portal) =>
    portal === "admin" ? "/admin/departments" : portalHomePath(portal)
  );
}
