import type { NextRequest } from "next/server";
import { isHex } from "@/lib/crypto";
import { insertVisit, isFingerprintBlocked, recordBlockedHit, type NewVisit } from "@/lib/db";
import { decryptTrackerPayload, isEncryptedPayload } from "@/lib/decrypt";
import { getRequestGeo, getRequestMeta } from "@/lib/geo";
import { rateLimit } from "@/lib/rate-limit";
import { verifyTrackerRequest } from "@/lib/signature";
import { parseUserAgent, type ClientHints } from "@/lib/ua";

export const dynamic = "force-dynamic";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

const MAX_BODY_BYTES = 512 * 1024;

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: CORS_HEADERS });
}

export function OPTIONS(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(request: NextRequest): Promise<Response> {
  const geo = getRequestGeo(request);

  if (!rateLimit("track", geo.ip || "unknown", 60, 60_000)) {
    return json({ error: "Too many requests" }, 429);
  }

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > MAX_BODY_BYTES) return json({ error: "Payload too large" }, 413);

  let envelope: Record<string, unknown>;
  try {
    envelope = (await request.json()) as Record<string, unknown>;
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const validSignature = await verifyTrackerRequest({
    kid: envelope.kid,
    signature: envelope.signature,
    issuedAt: envelope.issuedAt,
    expiresAt: envelope.expiresAt,
    blocklistHash: envelope.blocklistHash,
  });
  if (!validSignature) return json({ error: "Invalid tracker signature" }, 401);

  // Blocked browser beacon: only the fingerprint hash is reported.
  if (envelope.blocked === true) {
    const fingerprint = typeof envelope.fingerprint === "string" ? envelope.fingerprint.toLowerCase() : "";
    if (!isHex(fingerprint, 64)) return json({ error: "Invalid fingerprint" }, 400);
    if (!rateLimit("blocked", fingerprint, 20, 60_000)) return json({ ok: true });
    await recordBlockedHit(fingerprint, geo.ip, request.headers.get("user-agent") ?? "");
    return json({ ok: true });
  }

  if (!isEncryptedPayload(envelope.encrypted)) {
    return json({ error: "Missing encrypted payload" }, 400);
  }

  let decrypted: unknown;
  try {
    decrypted = await decryptTrackerPayload(envelope.encrypted, envelope.kid as number);
  } catch (error) {
    console.error("[visitas] decrypt error:", error);
    return json({ error: "Unable to decrypt payload" }, 400);
  }

  const visit = normalizeVisit(decrypted, request);
  if (!visit) return json({ error: "Invalid payload" }, 400);

  // The blocklist may have changed after the tracker was served.
  if (await isFingerprintBlocked(visit.fingerprint)) {
    await recordBlockedHit(visit.fingerprint, visit.ip, request.headers.get("user-agent") ?? "");
    return json({ ok: true, blocked: true });
  }

  try {
    await insertVisit(visit);
  } catch (error) {
    console.error("[visitas] insert error:", error);
    return json({ error: "Unable to store visit" }, 500);
  }

  return json({ ok: true });
}

function sanitizeText(value: unknown, maxLength: number): string {
  if (typeof value !== "string") return "";
  // eslint-disable-next-line no-control-regex
  return value.substring(0, maxLength).replace(/[\u0000-\u001f\u007f]/g, "");
}

function sanitizeUrl(value: unknown): string {
  return sanitizeText(value, 2048);
}

function numberOrNull(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value ?? ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeVisit(decrypted: unknown, request: NextRequest): NewVisit | null {
  if (!isPlainObject(decrypted)) return null;

  const fingerprint = typeof decrypted.id === "string" ? decrypted.id.toLowerCase() : "";
  if (!isHex(fingerprint, 64)) return null;

  const properties = isPlainObject(decrypted.properties) ? decrypted.properties : {};
  const hardware = isPlainObject(decrypted.hardware) ? decrypted.hardware : {};
  const screen = isPlainObject(decrypted.screen) ? decrypted.screen : {};
  const viewport = isPlainObject(decrypted.viewport) ? decrypted.viewport : {};

  const userAgent = request.headers.get("user-agent") ?? "";
  const hints = isPlainObject(properties.uaData) ? (properties.uaData as ClientHints) : null;
  const parsedUa = parseUserAgent(userAgent, hints);

  const languages = Array.isArray(decrypted.languages)
    ? decrypted.languages.filter((language): language is string => typeof language === "string").slice(0, 8)
    : [];
  const language = sanitizeText(decrypted.language, 35) || languages[0] || "";

  const width = numberOrNull(screen.width);
  const height = numberOrNull(screen.height);
  const geo = getRequestGeo(request);

  return {
    ts: new Date().toISOString(),
    fingerprint,
    ip: geo.ip,
    url: sanitizeUrl(decrypted.url),
    referrer: sanitizeUrl(decrypted.referrer),
    ...parsedUa,
    language,
    timezone: sanitizeText(decrypted.timezone, 64),
    resolution: width && height ? `${Math.round(width)}x${Math.round(height)}` : "",
    colorDepth: numberOrNull(screen.colorDepth),
    hardwareConcurrency: numberOrNull(hardware.concurrency),
    deviceMemory: numberOrNull(hardware.memory),
    country: geo.country,
    region: geo.region,
    city: geo.city,
    org: geo.org,
    latitude: geo.latitude,
    longitude: geo.longitude,
    properties: {
      title: sanitizeText(decrypted.title, 300),
      languages,
      timezoneOffset: numberOrNull(decrypted.timezoneOffset),
      screen,
      viewport,
      ...properties,
    },
    hardware,
    sensors: {},
    meta: getRequestMeta(request),
  };
}
