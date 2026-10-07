import type { NextRequest } from "next/server";
import { getSessionUserFromRequest } from "@/lib/auth";
import { getVisitsForExport, parseRange } from "@/lib/db";
import type { VisitRecord } from "@/lib/types";

export const dynamic = "force-dynamic";

const COLUMNS: Array<{ header: string; value: (visit: VisitRecord) => string }> = [
  { header: "timestamp_utc", value: (visit) => visit.ts },
  { header: "fingerprint", value: (visit) => visit.fingerprint },
  { header: "ip", value: (visit) => visit.ip },
  { header: "country", value: (visit) => visit.country ?? "" },
  { header: "region", value: (visit) => visit.region ?? "" },
  { header: "city", value: (visit) => visit.city ?? "" },
  { header: "org", value: (visit) => visit.org ?? "" },
  { header: "browser", value: (visit) => visit.browser },
  { header: "browser_version", value: (visit) => visit.browserVersion },
  { header: "os", value: (visit) => visit.os },
  { header: "os_version", value: (visit) => visit.osVersion },
  { header: "device", value: (visit) => visit.device },
  { header: "device_type", value: (visit) => visit.deviceType },
  { header: "device_vendor", value: (visit) => visit.deviceVendor },
  { header: "engine", value: (visit) => visit.engine },
  { header: "language", value: (visit) => visit.language },
  { header: "timezone", value: (visit) => visit.timezone },
  { header: "resolution", value: (visit) => visit.resolution },
  { header: "url", value: (visit) => visit.url },
  { header: "referrer", value: (visit) => visit.referrer },
];

function csvCell(value: string): string {
  const normalized = value.replace(/\r?\n/g, " ");
  if (/[",;]/.test(normalized)) return `"${normalized.replace(/"/g, '""')}"`;
  return normalized;
}

/** GET /api/export?range=7d — CSV export of stored visits (auth). */
export async function GET(request: NextRequest): Promise<Response> {
  const session = await getSessionUserFromRequest(request);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const range = parseRange(new URL(request.url).searchParams.get("range"));

  try {
    const visits = await getVisitsForExport(range);
    const lines = [
      COLUMNS.map((column) => column.header).join(","),
      ...visits.map((visit) => COLUMNS.map((column) => csvCell(column.value(visit))).join(",")),
    ];
    const filename = `visitas-${range}-${new Date().toISOString().slice(0, 10)}.csv`;

    return new Response(`\uFEFF${lines.join("\n")}`, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[visitas] export error:", error);
    return Response.json({ error: "Unable to export visits" }, { status: 500 });
  }
}
