import type { NextRequest } from "next/server";
import { getSessionUserFromRequest } from "@/lib/auth";
import { rotateTrackerKey } from "@/lib/keys";

export const dynamic = "force-dynamic";

/** POST /api/keys/rotate — retires the active tracker key and generates a new one (auth). */
export async function POST(request: NextRequest): Promise<Response> {
  const session = await getSessionUserFromRequest(request);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const key = await rotateTrackerKey({ force: true });
    return Response.json({
      ok: true,
      key: { id: key.id, createdAt: key.createdAt, expiresAt: key.expiresAt },
    });
  } catch (error) {
    console.error("[visitas] key rotation error:", error);
    return Response.json({ error: "Unable to rotate the tracker key" }, { status: 500 });
  }
}
