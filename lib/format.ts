/** Formatting helpers shared by server and client components (always UTC). */

const compactFormatter = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
const groupedFormatter = new Intl.NumberFormat("en-US");

export function formatNumber(value: number): string {
  return groupedFormatter.format(value);
}

export function formatCompactNumber(value: number): string {
  if (!Number.isFinite(value)) return "0";
  return value >= 10_000 ? compactFormatter.format(value) : groupedFormatter.format(value);
}

export function formatPercent(value: number, total: number, digits = 0): string {
  if (!total) return "0%";
  return `${((value / total) * 100).toFixed(digits)}%`;
}

export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  }).format(date);
}

export function formatShortDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  }).format(date);
}

export function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "UTC",
  }).format(date);
}

export function formatRelativeTime(iso: string, now: number = Date.now()): string {
  const date = new Date(iso).getTime();
  if (Number.isNaN(date)) return "—";
  const diff = Math.max(0, now - date);
  const seconds = Math.floor(diff / 1000);
  if (seconds < 45) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

export function countryFlag(code: string | null | undefined): string {
  if (!code || !/^[a-z]{2}$/i.test(code)) return "🌐";
  const points = code
    .toUpperCase()
    .split("")
    .map((letter) => 0x1f1e6 + letter.charCodeAt(0) - 65);
  return String.fromCodePoint(...points);
}

let regionNames: Intl.DisplayNames | null | undefined;
export function countryName(code: string | null | undefined): string {
  if (!code) return "Unknown";
  try {
    if (regionNames === undefined) regionNames = new Intl.DisplayNames(["en"], { type: "region" });
    return regionNames?.of(code.toUpperCase()) ?? code.toUpperCase();
  } catch {
    return code.toUpperCase();
  }
}

export function truncate(value: string, max: number): string {
  if (!value) return "";
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

export function prettyPath(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.pathname}${parsed.search}` || "/";
  } catch {
    return url;
  }
}

export function prettyReferrer(referrer: string): string {
  if (!referrer) return "Direct";
  try {
    return new URL(referrer).hostname;
  } catch {
    return truncate(referrer, 40);
  }
}

export function stringifyValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
