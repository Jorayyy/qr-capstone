import { legacyRedirectTo } from "@/lib/portal-server";
import { portalHomePath } from "@/lib/portal";

export default function LegacyDashboardPage() {
  return legacyRedirectTo((portal) => portalHomePath(portal));
}
