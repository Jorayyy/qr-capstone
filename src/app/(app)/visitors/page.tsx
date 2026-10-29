import { legacyRedirectTo } from "@/lib/portal-server";
import { portalHref } from "@/lib/portal";

export default function LegacyVisitorsPage() {
  return legacyRedirectTo((portal) => portalHref(portal, "/visitors"));
}
