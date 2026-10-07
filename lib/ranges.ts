/** Range definitions shared by server and client components (no Worker imports). */

import type { RangeKey } from "./types";

export interface RangeDefinition {
  key: RangeKey;
  label: string;
  shortLabel: string;
  days: number | null;
  bucket: "hour" | "day";
}

export const DEFAULT_RANGE: RangeKey = "7d";

export const RANGES: RangeDefinition[] = [
  { key: "24h", label: "Last 24 hours", shortLabel: "24h", days: 1, bucket: "hour" },
  { key: "7d", label: "Last 7 days", shortLabel: "7d", days: 7, bucket: "day" },
  { key: "30d", label: "Last 30 days", shortLabel: "30d", days: 30, bucket: "day" },
  { key: "90d", label: "Last 90 days", shortLabel: "90d", days: 90, bucket: "day" },
  { key: "all", label: "All time", shortLabel: "All", days: null, bucket: "day" },
];

export function parseRange(value: string | null | undefined): RangeKey {
  const match = RANGES.find((range) => range.key === value);
  return match ? match.key : DEFAULT_RANGE;
}

export function getRangeDefinition(range: RangeKey): RangeDefinition {
  return RANGES.find((candidate) => candidate.key === range) ?? RANGES[1];
}
