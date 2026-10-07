import type { NextRequest } from "next/server";
import { getSessionUserFromRequest } from "@/lib/auth";
import { getVisits, parseRange } from "@/lib/db";

export const dynamic = "force-dynamic";

/** GET /api/visits?range=7d&limit=50&offset=0 — paginated visit feed (auth). */
export async function GET(request: NextRequest): Promise<Response> {
  const session = await getSessionUserFromRequest(request);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const params = new URL(request.url).searchParams;
  const range = parseRange(params.get("range"));
  const limit = Number.parseInt(params.get("limit") ?? "50", 10);
  const offset = Number.parseInt(params.get("offset") ?? "0", 10);

  try {
    const page = await getVisits(
      range,
      Number.isFinite(limit) ? limit : 50,
      Number.isFinite(offset) ? offset : 0,
    );
    return Response.json(page, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[visitas] visits query error:", error);
    return Response.json({ error: "Unable to load visits" }, { status: 500 });
  }
}
