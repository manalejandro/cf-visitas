/** Shared types for the dashboard, the API routes and the tracker pipeline. */

export type RangeKey = "24h" | "7d" | "30d" | "90d" | "all";

export interface StatsBucket {
  label: string;
  value: number;
}

export interface TimelinePoint {
  /** Raw bucket key (e.g. `2026-10-07` or `2026-10-07T14:00`). */
  bucket: string;
  /** Human label rendered on the chart (e.g. `Oct 7` or `14:00`). */
  label: string;
  visits: number;
  visitors: number;
}

export interface StatsSummary {
  totalVisits: number;
  uniqueVisitors: number;
  uniqueIps: number;
  uniqueCountries: number;
  blockedFingerprints: number;
}

export interface DashboardStats {
  range: RangeKey;
  generatedAt: string;
  summary: StatsSummary;
  timeline: TimelinePoint[];
  breakdowns: Record<string, StatsBucket[]>;
}

export interface VisitRecord {
  id: number;
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
  country: string | null;
  region: string | null;
  city: string | null;
  org: string | null;
  latitude: number | null;
  longitude: number | null;
  properties: Record<string, unknown>;
  hardware: Record<string, unknown>;
  sensors: Record<string, unknown>;
  meta: Record<string, unknown>;
}

export interface BlockedFingerprint {
  id: number;
  fingerprint: string;
  reason: string;
  createdAt: string;
  hits: number;
  lastHitAt: string | null;
  /** Last IP seen for this fingerprint (visit or blocked hit). */
  ip: string | null;
  /** User-Agent of the latest visit / blocked hit. */
  userAgent: string | null;
  /** Every IP detected for this browser (visits + blocked hits). */
  ips: string[];
}

export interface VisitsPage {
  total: number;
  visits: VisitRecord[];
}

export interface TrackerKeyInfo {
  id: number;
  algorithm: string;
  createdAt: string;
  expiresAt: string;
  retiredAt: string | null;
  active: boolean;
}
