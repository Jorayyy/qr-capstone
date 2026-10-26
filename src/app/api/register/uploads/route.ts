import { NextRequest } from "next/server";
import { put } from "@vercel/blob";
import { recordAudit } from "@/lib/audit";
import { LIMITS, WINDOWS, rateLimit } from "@/lib/rate-limit";
import { isSameOrigin, jsonError, jsonOk, rateLimitResponse, withApiHandler } from "@/lib/http";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const KINDS = ["face", "id"] as const;

/**
 * Anonymous upload endpoint used by the public pre-registration wizard.
 * Files land in the private Blob store; the visitor photo is served back only
 * through the unguessable pass code, and the ID photo is staff-only.
 */
export async function POST(req: NextRequest) {
  return withApiHandler(req, async ({ requestId, ip }) => {
    if (!isSameOrigin(req)) return jsonError(403, "Cross-origin request blocked.", requestId);

    const limit = await rateLimit(
      `upload:ip:${ip ?? "unknown"}`,
      LIMITS.uploadPerIp(),
      WINDOWS.hour
    );
    if (!limit.ok) return rateLimitResponse(limit.retryAfterSeconds, requestId);

    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return jsonError(400, "Expected multipart form data.", requestId);
    }

    const file = form.get("file");
    const kind = form.get("kind");
    if (!(file instanceof File)) return jsonError(400, "Missing image file.", requestId);
    if (typeof kind !== "string" || !(KINDS as readonly string[]).includes(kind)) {
      return jsonError(400, "Invalid image kind.", requestId);
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return jsonError(415, "Only JPEG, PNG or WebP images are allowed.", requestId);
    }
    if (file.size > MAX_BYTES) {
      return jsonError(413, "Image must be 5 MB or smaller.", requestId);
    }

    const pathname = `visitors/${crypto.randomUUID()}/${kind}.jpg`;
    const { pathname: stored } = await put(pathname, file, {
      access: "private",
      contentType: file.type,
    });

    await recordAudit({
      action: "VISITOR_PHOTO_UPLOADED",
      result: "SUCCESS",
      targetType: "photo",
      ip,
      requestId,
      meta: { kind, channel: "public" },
    });

    return jsonOk({ pathname: stored });
  });
}
