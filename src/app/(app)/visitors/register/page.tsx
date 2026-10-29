import { legacyRedirectTo } from "@/lib/portal-server";
import { portalHref } from "@/lib/portal";

export default function LegacyRegisterVisitorPage() {
  return legacyRedirectTo((portal) => portalHref(portal, "/visitors/register"));
}
