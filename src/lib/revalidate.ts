import { revalidatePath } from "next/cache";

/** Invalidates the three role portals after a visitor/visit mutation. */
export function revalidatePortals(): void {
  revalidatePath("/admin", "layout");
  revalidatePath("/staff", "layout");
  revalidatePath("/guard", "layout");
}
