import { legacyRedirectTo } from "@/lib/portal-server";
import { portalHref } from "@/lib/portal";

export default async function LegacyVisitorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return legacyRedirectTo((portal) =>
    portal === "guard" ? "/guard/visitors" : portalHref(portal, `/visitors/${id}`)
  );
}
