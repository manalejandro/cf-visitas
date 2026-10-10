/**
 * Cloudflare Rules Language expression builder.
 *
 * Cloudflare cannot compute browser fingerprints at the edge, so the exported
 * expressions mirror each blocked fingerprint with the request-visible data we
 * store: every detected IP address and the User-Agent. Paste them into
 * Security → WAF → Custom rules (action: Block).
 *
 * Rules can be exported combined (a single rule with every fingerprint) or
 * independent (one rule per fingerprint).
 *
 * Docs: https://developers.cloudflare.com/ruleset-engine/rules-language/
 */

import type { BlockedFingerprint } from "./types";

export type FirewallRuleVariant = "ip+user-agent" | "ip" | "user-agent";
export type FirewallRuleMode = "combined" | "independent";

/** Maximum IPs included per fingerprint (keeps expressions manageable). */
const MAX_IPS_PER_FINGERPRINT = 50;

export interface FirewallRuleSource {
  fingerprint: string;
  ips: string[];
  userAgent: string | null;
}

export interface FirewallRuleEntry {
  fingerprint: string;
  expression: string;
}

export interface FirewallRuleOutput {
  mode: FirewallRuleMode;
  variant: FirewallRuleVariant;
  /** Single expression covering every fingerprint (combined mode). */
  expression: string;
  /** One expression per fingerprint (independent mode). */
  entries: FirewallRuleEntry[];
  /** Number of fingerprints represented in the output. */
  fingerprints: number;
  /** Fingerprints without the data required by the selected variant. */
  skipped: number;
}

function isIpAddress(value: string): boolean {
  if (value.includes(":")) return /^[0-9a-f:]+$/i.test(value);
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(value);
}

function ruleString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export function toRuleSource(entry: BlockedFingerprint): FirewallRuleSource {
  const candidates = [...(entry.ips ?? []), ...(entry.ip ? [entry.ip] : [])];
  const ips = [...new Set(candidates.filter((ip) => ip && isIpAddress(ip)))].slice(0, MAX_IPS_PER_FINGERPRINT);

  return {
    fingerprint: entry.fingerprint,
    ips,
    userAgent: entry.userAgent && entry.userAgent.trim() ? entry.userAgent.trim() : null,
  };
}

function ipExpression(ips: string[]): string {
  if (ips.length === 0) return "";
  if (ips.length === 1) return `ip.src eq ${ips[0]}`;
  return `ip.src in {${ips.join(" ")}}`;
}

function userAgentExpression(userAgent: string | null): string {
  return userAgent ? `http.user_agent eq "${ruleString(userAgent)}"` : "";
}

/** Expression for a single fingerprint. Returns "" when there is no data. */
export function buildSingleFirewallRule(source: FirewallRuleSource, variant: FirewallRuleVariant): string {
  const ip = ipExpression(source.ips);
  const ua = userAgentExpression(source.userAgent);

  if (variant === "ip") return ip;
  if (variant === "user-agent") return ua;
  if (ip && ua) return `(${ip} and ${ua})`;
  return ip || ua;
}

export function buildFirewallRules(
  sources: FirewallRuleSource[],
  variant: FirewallRuleVariant,
  mode: FirewallRuleMode,
): FirewallRuleOutput {
  const perFingerprint = sources
    .map((source) => ({ fingerprint: source.fingerprint, expression: buildSingleFirewallRule(source, variant) }))
    .filter((entry) => entry.expression.length > 0);

  const skipped = sources.length - perFingerprint.length;

  if (mode === "independent") {
    return {
      mode,
      variant,
      expression: "",
      entries: perFingerprint,
      fingerprints: perFingerprint.length,
      skipped,
    };
  }

  let expression = "";

  if (variant === "ip") {
    const ips = [...new Set(sources.flatMap((source) => source.ips))];
    expression = ipExpression(ips);
  } else if (variant === "user-agent") {
    const agents = [...new Set(sources.map((source) => source.userAgent).filter((ua): ua is string => Boolean(ua)))];
    expression = agents.length ? `(${agents.map((ua) => userAgentExpression(ua)).join(" or ")})` : "";
  } else {
    const rules = [...new Set(perFingerprint.map((entry) => entry.expression))];
    expression = rules.length ? `(${rules.join(" or ")})` : "";
  }

  return {
    mode,
    variant,
    expression,
    entries: perFingerprint,
    fingerprints: perFingerprint.length,
    skipped,
  };
}
