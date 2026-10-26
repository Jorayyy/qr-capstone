import { NextRequest, NextResponse } from "next/server";
import { get } from "@vercel/blob";
import { db } from "@/lib/db";
import { jsonError, withApiHandler } from "@/lib/http";

const PASS_CODE = /^VMS-[A-F0-9]{32}$/;

/**
 * Streams the visitor photo for a pass card. The pass code is 128-bit random,
 * so it acts as the capability; nothing else about the visitor is exposed.
 */
export async function GET(req: NextRequest) {
  return withApiHandler(req, async ({ requestId }) => {
    const code = req.nextUrl.searchParams.get("code") ?? "";
    if (!PASS_CODE.test(code)) return jsonError(400, "Invalid pass code.", requestId);

    const visit = await db.visit.findUnique({
      where: { qrCode: code },
      select: { visitor: { select: { photoUrl: true } } },
    });
    const path = visit?.visitor.photoUrl;
    if (!path || !/^visitors\/[A-Za-z0-9._/-]+$/.test(path)) {
      return jsonError(404, "Photo not found.", requestId);
    }

    const result = await get(path, { access: "private" });
    if (!result) return jsonError(404, "Photo not found.", requestId);

    return new NextResponse(result.stream, {
      headers: {
        "Content-Type": result.blob.contentType ?? "image/jpeg",
        "Cache-Control": "private, max-age=300",
        "X-Content-Type-Options": "nosniff",
      },
    });
  });
}
