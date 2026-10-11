/**
 * Cloudflare Rules Language expression builder.
 *
 * Cloudflare cannot compute browser fingerprints at the edge, so the exported
 * expressions mirror each blocked fingerprint with the request-visible data we
 * store: every detected IP address and the User-Agent. Paste them into
 * Security → WAF → Custom rules (action: Block).
 *
 * All detected IPs are included. Cloudflare limits a custom-rule expression to
 * 4 KB, so when the set does not fit, the builder automatically splits it into
 * several expressions (one rule each).
 *
 * Rules can be exported combined (a single rule set with every fingerprint) or
 * independent (one rule set per fingerprint).
 *
 * Docs: https://developers.cloudflare.com/ruleset-engine/rules-language/
 */

import type { BlockedFingerprint } from "./types";

export type FirewallRuleVariant = "ip+user-agent" | "ip" | "user-agent";
export type FirewallRuleMode = "combined" | "independent";

/** Cloudflare custom-rule expressions allow up to 4 KB; stay safely below. */
const MAX_EXPRESSION_LENGTH = 4000;

export interface FirewallRuleSource {
  fingerprint: string;
  ips: string[];
  userAgent: string | null;
}

export interface FirewallRuleEntry {
  fingerprint: string;
  /** One expression per rule (more than one when the data does not fit in 4 KB). */
  expressions: string[];
}

export interface FirewallRuleOutput {
  mode: FirewallRuleMode;
  variant: FirewallRuleVariant;
  /** Combined mode: one expression per rule (usually a single one). */
  expressions: string[];
  /** Independent mode: expressions grouped per fingerprint. */
  entries: FirewallRuleEntry[];
  /** Fingerprints represented in the output. */
  fingerprints: number;
  /** Fingerprints without the data required by the selected variant. */
  skipped: number;
  /** Distinct IP addresses included. */
  totalIps: number;
  /** True when the output had to be split into several rules. */
  split: boolean;
}

function isIpAddress(value: string): boolean {
  if (value.includes(":")) {
    // IPv6, including IPv4-mapped addresses (::ffff:192.0.2.1).
    return /^[0-9a-f:.]+$/i.test(value);
  }
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(value);
}

function normalizeIps(ips: string[]): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const raw of ips) {
    // Drop IPv6 zone identifiers (fe80::1%eth0) — Cloudflare does not accept them.
    const value = (raw || "").trim().split("%")[0];
    if (!value || !isIpAddress(value) || seen.has(value)) continue;
    seen.add(value);
    normalized.push(value);
  }

  return normalized;
}

function ruleString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function userAgentExpression(userAgent: string | null): string {
  return userAgent ? `http.user_agent eq "${ruleString(userAgent)}"` : "";
}

/** Splits an IP list into as many `ip.src in {…}` expressions as needed. */
function ipExpressions(ips: string[], reserve = 0): string[] {
  if (ips.length === 0) return [];

  const expressions: string[] = [];
  const overhead = "ip.src in {}".length + reserve;
  let current: string[] = [];
  let size = overhead;

  for (const ip of ips) {
    const added = ip.length + 1;
    if (current.length > 0 && size + added > MAX_EXPRESSION_LENGTH) {
      expressions.push(`ip.src in {${current.join(" ")}}`);
      current = [];
      size = overhead;
    }
    current.push(ip);
    size += added;
  }
  if (current.length > 0) expressions.push(`ip.src in {${current.join(" ")}}`);

  return expressions;
}

/** Expressions for a single fingerprint (usually one). */
export function sourceExpressions(source: FirewallRuleSource, variant: FirewallRuleVariant): string[] {
  const ips = normalizeIps(source.ips);
  const userAgent = userAgentExpression(source.userAgent);

  if (variant === "ip") return ipExpressions(ips);
  if (variant === "user-agent") return userAgent ? [userAgent] : [];

  // ip+user-agent: reserve room for the `(… and <ua>)` suffix in every chunk.
  const reserve = userAgent ? userAgent.length + 7 : 0;
  const chunks = ipExpressions(ips, reserve);
  if (chunks.length > 0 && userAgent) return chunks.map((chunk) => `(${chunk} and ${userAgent})`);
  if (chunks.length > 0) return chunks;
  return userAgent ? [userAgent] : [];
}

/** Joins sub-expressions with `or`, splitting again when the result is too long. */
function packExpressions(parts: string[]): string[] {
  const packed: string[] = [];
  let current: string[] = [];
  let size = 0;

  const flush = () => {
    if (current.length === 0) return;
    packed.push(current.length === 1 ? current[0] : `(${current.join(" or ")})`);
    current = [];
    size = 0;
  };

  for (const part of parts) {
    const added = current.length > 0 ? part.length + 4 : part.length;
    if (current.length > 0 && size + added + 2 > MAX_EXPRESSION_LENGTH) flush();
    current.push(part);
    size += current.length > 1 ? part.length + 4 : part.length;
  }
  flush();

  return packed;
}

export function toRuleSource(entry: BlockedFingerprint): FirewallRuleSource {
  return {
    fingerprint: entry.fingerprint,
    ips: [...(entry.ips ?? []), ...(entry.ip ? [entry.ip] : [])],
    userAgent: entry.userAgent && entry.userAgent.trim() ? entry.userAgent.trim() : null,
  };
}

export function buildFirewallRules(
  sources: FirewallRuleSource[],
  variant: FirewallRuleVariant,
  mode: FirewallRuleMode,
): FirewallRuleOutput {
  const entries: FirewallRuleEntry[] = [];
  const parts: string[] = [];
  const allIps = new Set<string>();
  let skipped = 0;

  for (const source of sources) {
    const expressions = sourceExpressions(source, variant);
    for (const ip of normalizeIps(source.ips)) allIps.add(ip);

    if (expressions.length === 0) {
      skipped += 1;
      continue;
    }

    entries.push({ fingerprint: source.fingerprint, expressions });
    parts.push(...expressions);
  }

  const expressions = mode === "combined" ? packExpressions(parts) : [];

  return {
    mode,
    variant,
    expressions,
    entries,
    fingerprints: entries.length,
    skipped,
    totalIps: allIps.size,
    split: mode === "combined" ? expressions.length > 1 : entries.some((entry) => entry.expressions.length > 1),
  };
}
