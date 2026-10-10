/**
 * Cloudflare Rules Language expression builder.
 *
 * Cloudflare cannot compute browser fingerprints at the edge, so the exported
 * expressions mirror each blocked fingerprint with the request-visible data we
 * store: IP address and User-Agent. Paste them into
 * Security → WAF → Custom rules (action: Block).
 *
 * Docs: https://developers.cloudflare.com/ruleset-engine/rules-language/
 */

import type { BlockedFingerprint } from "./types";

export type FirewallRuleVariant = "ip+user-agent" | "ip" | "user-agent";

export interface FirewallRuleExpression {
  /** Ready-to-paste Cloudflare expression ("" when there is no usable data). */
  expression: string;
  /** Number of blocked entries represented in the expression. */
  entries: number;
  /** Entries without the data required by the selected variant. */
  skipped: number;
}

function isIpAddress(value: string): boolean {
  if (value.includes(":")) return /^[0-9a-f:]+$/i.test(value);
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(value);
}

function ruleString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function normalizeEntry(entry: BlockedFingerprint): { ip: string | null; userAgent: string | null } {
  return {
    ip: entry.ip && isIpAddress(entry.ip) ? entry.ip : null,
    userAgent: entry.userAgent && entry.userAgent.trim() ? entry.userAgent.trim() : null,
  };
}

export function buildSingleFirewallRule(entry: BlockedFingerprint, variant: FirewallRuleVariant): string {
  const { ip, userAgent } = normalizeEntry(entry);

  if (variant === "ip") return ip ? `ip.src eq ${ip}` : "";
  if (variant === "user-agent") return userAgent ? `http.user_agent eq "${ruleString(userAgent)}"` : "";
  if (ip && userAgent) return `(ip.src eq ${ip} and http.user_agent eq "${ruleString(userAgent)}")`;
  return ip ? `ip.src eq ${ip}` : userAgent ? `http.user_agent eq "${ruleString(userAgent)}"` : "";
}

export function buildFirewallRule(
  entries: BlockedFingerprint[],
  variant: FirewallRuleVariant,
): FirewallRuleExpression {
  if (variant === "ip") {
    const ips = [...new Set(entries.map((entry) => normalizeEntry(entry).ip).filter((ip): ip is string => Boolean(ip)))];
    return {
      expression: ips.length ? `ip.src in {${ips.join(" ")}}` : "",
      entries: ips.length,
      skipped: entries.length - ips.length,
    };
  }

  const rules = [
    ...new Set(
      entries.map((entry) => buildSingleFirewallRule(entry, variant)).filter((rule) => rule.length > 0),
    ),
  ];

  return {
    expression: rules.length ? `(${rules.join(" or ")})` : "",
    entries: rules.length,
    skipped: entries.length - rules.length,
  };
}
