/**
 * D1 data-access layer.
 *
 * Every query goes through `env.DB` (binding declared in `wrangler.jsonc`).
 * Aggregations are computed in SQL; the JSON columns keep the full payload for
 * the visit detail view and for dimensions that are not promoted to columns.
 */

import { env } from "cloudflare:workers";
import { getRangeDefinition } from "./ranges";
import type {
  BlockedFingerprint,
  DashboardStats,
  RangeKey,
  StatsBucket,
  TimelinePoint,
  VisitRecord,
  VisitsPage,
} from "./types";

export { DEFAULT_RANGE, getRangeDefinition, parseRange, RANGES } from "./ranges";

function rangeWindow(range: RangeKey) {
  const definition = getRangeDefinition(range);
  const now = new Date();
  const from = definition.days === null ? new Date(0) : new Date(now.getTime() - definition.days * 86_400_000);
  return { definition, now, fromIso: from.toISOString() };
}

interface BreakdownDefinition {
  key: string;
  expression: string;
  limit: number;
  /** The expression is a `json_extract(...)` call and needs null filtering. */
  json?: boolean;
}

const BREAKDOWNS: BreakdownDefinition[] = [
  { key: "browsers", expression: "browser", limit: 12 },
  {
    key: "browserVersions",
    expression: "CASE WHEN browser_version != '' THEN browser || ' ' || browser_version ELSE browser END",
    limit: 12,
  },
  { key: "operatingSystems", expression: "os", limit: 12 },
  {
    key: "osVersions",
    expression: "CASE WHEN os_version != '' THEN os || ' ' || os_version ELSE os END",
    limit: 12,
  },
  { key: "devices", expression: "device", limit: 12 },
  { key: "deviceTypes", expression: "device_type", limit: 8 },
  { key: "deviceVendors", expression: "device_vendor", limit: 12 },
  { key: "engines", expression: "engine", limit: 8 },
  { key: "languages", expression: "language", limit: 12 },
  { key: "timezones", expression: "timezone", limit: 12 },
  { key: "resolutions", expression: "resolution", limit: 12 },
  { key: "countries", expression: "country", limit: 15 },
  { key: "cities", expression: "city", limit: 12 },
  { key: "organizations", expression: "org", limit: 10 },
  { key: "pages", expression: "url", limit: 10 },
  { key: "referrers", expression: "referrer", limit: 10 },
  { key: "networkTypes", expression: "json_extract(hardware, '$.connection.effectiveType')", json: true, limit: 8 },
  { key: "colorSchemes", expression: "json_extract(hardware, '$.colorScheme')", json: true, limit: 4 },
  { key: "platforms", expression: "json_extract(hardware, '$.platform')", json: true, limit: 12 },
  { key: "cpuCores", expression: "CAST(hardware_concurrency AS TEXT)", limit: 10 },
  { key: "deviceMemory", expression: "CAST(device_memory AS TEXT)", limit: 10 },
  { key: "webglVendors", expression: "json_extract(properties, '$.webgl.vendor')", json: true, limit: 10 },
  { key: "webglRenderers", expression: "json_extract(properties, '$.webgl.renderer')", json: true, limit: 10 },
  { key: "doNotTrack", expression: "json_extract(hardware, '$.doNotTrack')", json: true, limit: 4 },
];

const SUMMARY_SQL = `SELECT
  COUNT(*)                       AS totalVisits,
  COUNT(DISTINCT fingerprint)    AS uniqueVisitors,
  COUNT(DISTINCT ip)             AS uniqueIps,
  COUNT(DISTINCT country)        AS uniqueCountries
FROM visits
WHERE ts >= ?1`;

export async function getStats(range: RangeKey): Promise<DashboardStats> {
  const { definition, now, fromIso } = rangeWindow(range);
  const db = env.DB;

  const bucketExpression = definition.bucket === "hour" ? "substr(ts, 1, 13) || ':00'" : "substr(ts, 1, 10)";

  const statements = [
    db.prepare(SUMMARY_SQL).bind(fromIso),
    db.prepare("SELECT COUNT(*) AS blocked FROM blocked_fingerprints"),
    db
      .prepare(
        `SELECT ${bucketExpression} AS bucket,
                COUNT(*) AS visits,
                COUNT(DISTINCT fingerprint) AS visitors
         FROM visits
         WHERE ts >= ?1
         GROUP BY bucket
         ORDER BY bucket ASC`,
      )
      .bind(fromIso),
    ...BREAKDOWNS.map((definitionItem) => {
      const filter = definitionItem.json
        ? `AND ${definitionItem.expression} IS NOT NULL AND ${definitionItem.expression} != ''`
        : `AND ${definitionItem.expression} != ''`;
      return db
        .prepare(
          `SELECT ${definitionItem.expression} AS label, COUNT(*) AS value
           FROM visits
           WHERE ts >= ?1 ${filter}
           GROUP BY label
           ORDER BY value DESC, label ASC
           LIMIT ${definitionItem.limit}`,
        )
        .bind(fromIso);
    }),
  ];

  const [summaryResult, blockedResult, timelineResult, ...breakdownResults] = await db.batch(statements);

  const summaryRow = (summaryResult.results?.[0] ?? {}) as Record<string, number>;
  const blockedRow = (blockedResult.results?.[0] ?? {}) as Record<string, number>;

  const timeline = fillTimeline(
    (timelineResult.results ?? []) as Array<{ bucket: string; visits: number; visitors: number }>,
    definition.bucket,
    fromIso,
    now,
  );

  const breakdowns: Record<string, StatsBucket[]> = {};
  BREAKDOWNS.forEach((definitionItem, index) => {
    const rows = (breakdownResults[index]?.results ?? []) as Array<{ label: unknown; value: number }>;
    breakdowns[definitionItem.key] = rows
      .filter((row) => row.label !== null && row.label !== undefined && String(row.label) !== "")
      .map((row) => ({ label: String(row.label), value: Number(row.value) || 0 }));
  });

  return {
    range,
    generatedAt: now.toISOString(),
    summary: {
      totalVisits: Number(summaryRow.totalVisits) || 0,
      uniqueVisitors: Number(summaryRow.uniqueVisitors) || 0,
      uniqueIps: Number(summaryRow.uniqueIps) || 0,
      uniqueCountries: Number(summaryRow.uniqueCountries) || 0,
      blockedFingerprints: Number(blockedRow.blocked) || 0,
    },
    timeline,
    breakdowns,
  };
}

function fillTimeline(
  rows: Array<{ bucket: string; visits: number; visitors: number }>,
  bucket: "hour" | "day",
  fromIso: string,
  now: Date,
): TimelinePoint[] {
  const values = new Map(rows.map((row) => [row.bucket, row]));
  const stepMs = bucket === "hour" ? 3_600_000 : 86_400_000;

  let cursor = new Date(fromIso);
  if (bucket === "hour") cursor = new Date(Math.floor(cursor.getTime() / stepMs) * stepMs);
  else cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), cursor.getUTCDate()));

  const points: TimelinePoint[] = [];
  const end = now.getTime();
  // Safety cap so an "all time" range with a very old first visit cannot
  // generate an unbounded number of buckets.
  const maxPoints = 400;

  while (cursor.getTime() <= end && points.length < maxPoints) {
    const bucketKey = bucket === "hour" ? `${cursor.toISOString().slice(0, 13)}:00` : cursor.toISOString().slice(0, 10);
    const row = values.get(bucketKey);
    points.push({
      bucket: bucketKey,
      label: formatBucketLabel(bucketKey, bucket),
      visits: row ? Number(row.visits) : 0,
      visitors: row ? Number(row.visitors) : 0,
    });
    cursor = new Date(cursor.getTime() + stepMs);
  }

  return points;
}

function formatBucketLabel(bucket: string, bucketSize: "hour" | "day"): string {
  if (bucketSize === "hour") return `${bucket.slice(11, 16)}`;
  const date = new Date(`${bucket}T00:00:00.000Z`);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

const VISIT_COLUMNS = `id, ts, fingerprint, ip, url, referrer, browser, browser_version, os, os_version,
  device, device_type, device_vendor, engine, engine_version, language, timezone, resolution,
  color_depth, hardware_concurrency, device_memory, country, region, city, org, latitude, longitude,
  properties, hardware, sensors, meta`;

export async function getVisits(range: RangeKey, limit = 50, offset = 0): Promise<VisitsPage> {
  const { fromIso } = rangeWindow(range);
  const safeLimit = Math.min(Math.max(limit, 1), 200);
  const safeOffset = Math.max(offset, 0);

  const [countResult, rowsResult] = await env.DB.batch([
    env.DB.prepare("SELECT COUNT(*) AS total FROM visits WHERE ts >= ?1").bind(fromIso),
    env.DB
      .prepare(
        `SELECT ${VISIT_COLUMNS}
         FROM visits
         WHERE ts >= ?1
         ORDER BY ts DESC, id DESC
         LIMIT ?2 OFFSET ?3`,
      )
      .bind(fromIso, safeLimit, safeOffset),
  ]);

  const total = Number(((countResult.results?.[0] ?? {}) as Record<string, number>).total) || 0;
  const rows = (rowsResult.results ?? []) as Array<Record<string, unknown>>;

  return { total, visits: rows.map(mapVisitRow) };
}

export async function getVisitsForExport(range: RangeKey, limit = 10_000): Promise<VisitRecord[]> {
  const { fromIso } = rangeWindow(range);
  const result = await env.DB.prepare(
    `SELECT ${VISIT_COLUMNS}
     FROM visits
     WHERE ts >= ?1
     ORDER BY ts DESC, id DESC
     LIMIT ?2`,
  )
    .bind(fromIso, Math.min(Math.max(limit, 1), 50_000))
    .all<Record<string, unknown>>();

  return (result.results ?? []).map(mapVisitRow);
}

function mapVisitRow(row: Record<string, unknown>): VisitRecord {
  return {
    id: Number(row.id),
    ts: String(row.ts ?? ""),
    fingerprint: String(row.fingerprint ?? ""),
    ip: String(row.ip ?? ""),
    url: String(row.url ?? ""),
    referrer: String(row.referrer ?? ""),
    browser: String(row.browser ?? ""),
    browserVersion: String(row.browser_version ?? ""),
    os: String(row.os ?? ""),
    osVersion: String(row.os_version ?? ""),
    device: String(row.device ?? ""),
    deviceType: String(row.device_type ?? ""),
    deviceVendor: String(row.device_vendor ?? ""),
    engine: String(row.engine ?? ""),
    engineVersion: String(row.engine_version ?? ""),
    language: String(row.language ?? ""),
    timezone: String(row.timezone ?? ""),
    resolution: String(row.resolution ?? ""),
    country: row.country === null || row.country === undefined ? null : String(row.country),
    region: row.region === null || row.region === undefined ? null : String(row.region),
    city: row.city === null || row.city === undefined ? null : String(row.city),
    org: row.org === null || row.org === undefined ? null : String(row.org),
    latitude: row.latitude === null || row.latitude === undefined ? null : Number(row.latitude),
    longitude: row.longitude === null || row.longitude === undefined ? null : Number(row.longitude),
    properties: parseJsonObject(row.properties),
    hardware: parseJsonObject(row.hardware),
    sensors: parseJsonObject(row.sensors),
    meta: parseJsonObject(row.meta),
  };
}

export function parseJsonObject(value: unknown): Record<string, unknown> {
  if (typeof value !== "string" || value.length === 0) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

// ── Visit ingestion ─────────────────────────────────────────────────────────

export interface NewVisit {
  ts: string;
  fingerprint: string;
  ip: string;
  url: string;
  referrer: string;
  browser: string;
  browserVersion: string;
  os: string;
  osVersion: string;
  device: string;
  deviceType: string;
  deviceVendor: string;
  engine: string;
  engineVersion: string;
  language: string;
  timezone: string;
  resolution: string;
  colorDepth: number | null;
  hardwareConcurrency: number | null;
  deviceMemory: number | null;
  country: string | null;
  region: string | null;
  city: string | null;
  org: string | null;
  latitude: number | null;
  longitude: number | null;
  properties: unknown;
  hardware: unknown;
  sensors: unknown;
  meta: unknown;
}

export async function insertVisit(visit: NewVisit): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO visits (
       ts, fingerprint, ip, url, referrer, browser, browser_version, os, os_version,
       device, device_type, device_vendor, engine, engine_version, language, timezone,
       resolution, color_depth, hardware_concurrency, device_memory,
       country, region, city, org, latitude, longitude,
       properties, hardware, sensors, meta
     ) VALUES (
       ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16,
       ?17, ?18, ?19, ?20, ?21, ?22, ?23, ?24, ?25, ?26, ?27, ?28, ?29, ?30
     )`,
  )
    .bind(
      visit.ts,
      visit.fingerprint,
      visit.ip,
      visit.url,
      visit.referrer,
      visit.browser,
      visit.browserVersion,
      visit.os,
      visit.osVersion,
      visit.device,
      visit.deviceType,
      visit.deviceVendor,
      visit.engine,
      visit.engineVersion,
      visit.language,
      visit.timezone,
      visit.resolution,
      visit.colorDepth,
      visit.hardwareConcurrency,
      visit.deviceMemory,
      visit.country,
      visit.region,
      visit.city,
      visit.org,
      visit.latitude,
      visit.longitude,
      JSON.stringify(visit.properties ?? {}),
      JSON.stringify(visit.hardware ?? {}),
      JSON.stringify(visit.sensors ?? {}),
      JSON.stringify(visit.meta ?? {}),
    )
    .run();
}

// ── Blocked fingerprints ────────────────────────────────────────────────────

const BLOCKED_CACHE_TTL_MS = 30_000;
let blockedCache: { at: number; hashes: string[] } | null = null;

export function invalidateBlockedCache(): void {
  blockedCache = null;
}

export async function getBlockedHashes(): Promise<string[]> {
  const now = Date.now();
  if (blockedCache && now - blockedCache.at < BLOCKED_CACHE_TTL_MS) return blockedCache.hashes;
  const result = await env.DB.prepare("SELECT fingerprint FROM blocked_fingerprints").all<{ fingerprint: string }>();
  const hashes = (result.results ?? []).map((row) => row.fingerprint).filter(Boolean);
  blockedCache = { at: now, hashes };
  return hashes;
}

export async function isFingerprintBlocked(fingerprint: string): Promise<boolean> {
  const row = await env.DB.prepare("SELECT 1 AS blocked FROM blocked_fingerprints WHERE fingerprint = ?1")
    .bind(fingerprint)
    .first<{ blocked: number }>();
  return Boolean(row);
}

export async function listBlockedFingerprints(): Promise<BlockedFingerprint[]> {
  const result = await env.DB.prepare(
    `SELECT b.id, b.fingerprint, b.reason, b.created_at, b.hits, b.last_hit_at,
            (SELECT v.ip FROM visits v WHERE v.fingerprint = b.fingerprint ORDER BY v.ts DESC LIMIT 1) AS ip,
            (SELECT json_extract(v.meta, '$.userAgent') FROM visits v
              WHERE v.fingerprint = b.fingerprint ORDER BY v.ts DESC LIMIT 1) AS user_agent
     FROM blocked_fingerprints b
     ORDER BY b.created_at DESC`,
  ).all<Record<string, unknown>>();

  return (result.results ?? []).map((row) => ({
    id: Number(row.id),
    fingerprint: String(row.fingerprint ?? ""),
    reason: String(row.reason ?? ""),
    createdAt: String(row.created_at ?? ""),
    hits: Number(row.hits) || 0,
    lastHitAt: row.last_hit_at === null || row.last_hit_at === undefined ? null : String(row.last_hit_at),
    ip: row.ip === null || row.ip === undefined ? null : String(row.ip),
    userAgent: row.user_agent === null || row.user_agent === undefined ? null : String(row.user_agent),
  }));
}

export async function addBlockedFingerprint(fingerprint: string, reason: string): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO blocked_fingerprints (fingerprint, reason, created_at)
     VALUES (?1, ?2, ?3)
     ON CONFLICT (fingerprint) DO UPDATE SET reason = excluded.reason`,
  )
    .bind(fingerprint, reason, new Date().toISOString())
    .run();
  invalidateBlockedCache();
}

export async function removeBlockedFingerprint(fingerprint: string): Promise<boolean> {
  const result = await env.DB.prepare("DELETE FROM blocked_fingerprints WHERE fingerprint = ?1").bind(fingerprint).run();
  invalidateBlockedCache();
  return (result.meta?.changes ?? 0) > 0;
}

export async function recordBlockedHit(fingerprint: string): Promise<void> {
  await env.DB.prepare(
    `UPDATE blocked_fingerprints
     SET hits = hits + 1, last_hit_at = ?1
     WHERE fingerprint = ?2`,
  )
    .bind(new Date().toISOString(), fingerprint)
    .run();
}
