import { NextResponse } from "next/server";
import { autoCheckOutOverdueVisits } from "@/lib/auto-checkout";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const closed = await autoCheckOutOverdueVisits();
  return NextResponse.json({ closed });
}
