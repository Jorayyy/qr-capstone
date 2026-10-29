import { legacyRedirectTo } from "@/lib/portal-server";
import { portalHomePath } from "@/lib/portal";

export default function LegacySecurityPage() {
  return legacyRedirectTo((portal) =>
    portal === "admin" ? "/admin/security" : portalHomePath(portal)
  );
}
