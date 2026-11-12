import { redirect } from "next/navigation";

/** Visitor registration was removed from the Admin portal. */
export default function AdminRegisterVisitorPage() {
  redirect("/admin/visitors");
}
