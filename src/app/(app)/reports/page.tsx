import { legacyRedirectTo } from "@/lib/portal-server";
import { portalHref } from "@/lib/portal";

export default function LegacyReportsPage() {
  return legacyRedirectTo((portal) =>
    portal === "guard" ? "/guard/visitors" : portalHref(portal, "/reports")
  );
}
