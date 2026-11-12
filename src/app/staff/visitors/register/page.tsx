import { redirect } from "next/navigation";

/** Visitor registration was removed from the Staff portal. */
export default function StaffRegisterVisitorPage() {
  redirect("/staff/visitors");
}
