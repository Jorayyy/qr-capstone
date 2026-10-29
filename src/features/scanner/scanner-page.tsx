import { requirePermission } from "@/lib/auth";
import ScannerClient from "./scanner-client";

export default async function ScannerPage() {
  await requirePermission("visit:transition");
  return <ScannerClient />;
}
