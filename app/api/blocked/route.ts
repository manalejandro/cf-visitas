import type { NextRequest } from "next/server";
import { getSessionUserFromRequest } from "@/lib/auth";
import { isHex } from "@/lib/crypto";
import { addBlockedFingerprint, listBlockedFingerprints, removeBlockedFingerprint } from "@/lib/db";

export const dynamic = "force-dynamic";

/** GET /api/blocked — list blocked fingerprints (auth). */
export async function GET(request: NextRequest): Promise<Response> {
  const session = await getSessionUserFromRequest(request);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const blocked = await listBlockedFingerprints();
  return Response.json({ blocked }, { headers: { "Cache-Control": "no-store" } });
}

/** POST /api/blocked — block a fingerprint: { fingerprint, reason? } (auth). */
export async function POST(request: NextRequest): Promise<Response> {
  const session = await getSessionUserFromRequest(request);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const fingerprint = typeof body.fingerprint === "string" ? body.fingerprint.trim().toLowerCase() : "";
  if (!isHex(fingerprint, 64)) {
    return Response.json({ error: "Fingerprint must be a 64-character hex string" }, { status: 400 });
  }
  const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 300) : "";

  await addBlockedFingerprint(fingerprint, reason);
  return Response.json({ ok: true, fingerprint });
}

/** DELETE /api/blocked?fingerprint=… — unblock a fingerprint (auth). */
export async function DELETE(request: NextRequest): Promise<Response> {
  const session = await getSessionUserFromRequest(request);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const fingerprint = (new URL(request.url).searchParams.get("fingerprint") ?? "").trim().toLowerCase();
  if (!isHex(fingerprint, 64)) {
    return Response.json({ error: "Fingerprint must be a 64-character hex string" }, { status: 400 });
  }

  const removed = await removeBlockedFingerprint(fingerprint);
  if (!removed) return Response.json({ error: "Fingerprint is not blocked" }, { status: 404 });
  return Response.json({ ok: true, fingerprint });
}
