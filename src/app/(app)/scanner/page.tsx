import { legacyRedirectTo } from "@/lib/portal-server";
import { portalHref } from "@/lib/portal";

export default function LegacyScannerPage() {
  return legacyRedirectTo((portal) =>
    portal === "guard" ? "/guard" : portalHref(portal, "/scanner")
  );
}
