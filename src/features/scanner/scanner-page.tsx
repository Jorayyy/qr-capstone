import { requirePermission } from "@/lib/auth";
import type { Portal } from "@/lib/portal";
import ScannerClient from "./scanner-client";

export default async function ScannerPage({ portal = "staff" }: { portal?: Portal }) {
  await requirePermission("visit:transition");
  return <ScannerClient portal={portal} />;
}
