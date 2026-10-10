"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CopyButton } from "./CopyButton";
import { IconAlert, IconCloud, IconFingerprint, IconPlus, IconShield, IconTrash } from "./icons";
import { buildFirewallRule, buildSingleFirewallRule, type FirewallRuleVariant } from "@/lib/cf-rules";
import { formatDateTime, formatNumber, formatRelativeTime, truncate } from "@/lib/format";
import type { BlockedFingerprint } from "@/lib/types";

const RULE_VARIANTS: Array<{ key: FirewallRuleVariant; label: string; hint: string }> = [
  {
    key: "ip+user-agent",
    label: "IP + User-Agent",
    hint: "Most precise: only that browser from that IP address.",
  },
  { key: "ip", label: "IP only", hint: "Blocks every request coming from those IP addresses." },
  {
    key: "user-agent",
    label: "User-Agent only",
    hint: "Broad: may also match other visitors using the same browser version.",
  },
];

export function BlockedManager({ initialBlocked }: { initialBlocked: BlockedFingerprint[] }) {
  const router = useRouter();
  const [fingerprint, setFingerprint] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now] = useState(() => Date.now());
  const [ruleVariant, setRuleVariant] = useState<FirewallRuleVariant>("ip+user-agent");

  const firewallRule = buildFirewallRule(initialBlocked, ruleVariant);

  const validFingerprint = /^[0-9a-f]{64}$/i.test(fingerprint.trim());

  async function addBlock(event: React.FormEvent) {
    event.preventDefault();
    if (!validFingerprint) {
      setError("The fingerprint must be a 64-character hexadecimal SHA-256 hash.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/blocked", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fingerprint: fingerprint.trim().toLowerCase(), reason: reason.trim() }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `Request failed (${response.status})`);
      }
      setFingerprint("");
      setReason("");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not block this fingerprint.");
    } finally {
      setSaving(false);
    }
  }

  async function unblock(value: string) {
    setRemoving(value);
    setError(null);
    try {
      const response = await fetch(`/api/blocked?fingerprint=${encodeURIComponent(value)}`, { method: "DELETE" });
      if (!response.ok) throw new Error(`Request failed (${response.status})`);
      router.refresh();
    } catch {
      setError("Could not unblock this fingerprint.");
    } finally {
      setRemoving(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="panel p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-danger/25 bg-danger/10 text-danger">
            <IconShield className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-strong">How blocking works</h2>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              The generated tracker embeds the SHA-256 fingerprints below. When a blocked browser loads the tracker,
              the script stops the page load, discards the original DOM, replaces it with a fresh document showing the{" "}
              <span className="text-fg">Access blocked</span> screen and clears the browser&apos;s local storage and
              Cache Storage. The API still receives an anonymous beacon so hit counters stay accurate, but no visit
              data is stored.
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={addBlock} className="panel space-y-3 p-5">
        <h2 className="text-sm font-semibold text-strong">Block a fingerprint</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[2fr_1fr_auto]">
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-faint">
              SHA-256 fingerprint
            </span>
            <input
              className="input mono"
              placeholder="e3b0c44298fc1c149afbf4c8996fb924…"
              value={fingerprint}
              onChange={(event) => setFingerprint(event.target.value)}
              spellCheck={false}
              autoComplete="off"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-faint">
              Reason (optional)
            </span>
            <input
              className="input"
              placeholder="Scraper, spam, abuse…"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              maxLength={300}
            />
          </label>
          <div className="flex items-end">
            <button type="submit" className="btn btn-primary w-full sm:w-auto" disabled={saving || !validFingerprint}>
              <IconPlus className="h-4 w-4" />
              {saving ? "Saving…" : "Block"}
            </button>
          </div>
        </div>
        {error ? (
          <p className="rounded-lg border border-danger/25 bg-danger/10 px-3 py-2 text-xs text-danger">{error}</p>
        ) : null}
      </form>

      <div className="panel overflow-hidden">
        <header className="panel-header">
          <div>
            <h2 className="panel-title">Blocked fingerprints</h2>
            <p className="panel-subtitle">{formatNumber(initialBlocked.length)} entries</p>
          </div>
        </header>

        {initialBlocked.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
            <IconFingerprint className="h-6 w-6 text-faint" />
            <p className="text-sm text-fg">No fingerprints blocked</p>
            <p className="max-w-sm text-xs text-muted">
              You can also block a browser directly from the visit feed on the overview page.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-y border-line bg-subtle text-[11px] uppercase tracking-wider text-faint">
                  <th className="px-5 py-2.5 font-medium">Fingerprint</th>
                  <th className="px-3 py-2.5 font-medium">IP</th>
                  <th className="px-3 py-2.5 font-medium">Reason</th>
                  <th className="px-3 py-2.5 font-medium">Blocked at</th>
                  <th className="px-3 py-2.5 text-right font-medium">Hits</th>
                  <th className="px-3 py-2.5 font-medium">Last hit</th>
                  <th className="px-5 py-2.5 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {initialBlocked.map((entry) => (
                  <tr key={entry.id} className="border-b border-line hover:bg-subtle">
                    <td className="px-5 py-3">
                      <span className="flex items-center gap-2">
                        <span className="mono text-[11px] text-fg">{truncate(entry.fingerprint, 22)}</span>
                        <CopyButton value={entry.fingerprint} label="" />
                      </span>
                    </td>
                    <td className="px-3 py-3" title={entry.userAgent ?? undefined}>
                      <span className="mono text-[11px] text-muted">{entry.ip || "—"}</span>
                    </td>
                    <td className="max-w-[220px] px-3 py-3 text-[13px] text-muted">
                      {entry.reason || <span className="text-faint">—</span>}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-[12px] text-muted">
                      {formatDateTime(entry.createdAt)}
                    </td>
                    <td className="px-3 py-3 text-right text-[13px] tabular-nums text-fg">
                      {formatNumber(entry.hits)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-[12px] text-muted">
                      {entry.lastHitAt ? formatRelativeTime(entry.lastHitAt, now) : <span className="text-faint">—</span>}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <span className="inline-flex items-center gap-1.5">
                        {buildSingleFirewallRule(entry, ruleVariant) ? (
                          <CopyButton value={buildSingleFirewallRule(entry, ruleVariant)} label="Rule" />
                        ) : null}
                        <button
                          type="button"
                          className="btn !px-2 !py-1.5 text-xs"
                          disabled={removing === entry.fingerprint}
                          onClick={() => unblock(entry.fingerprint)}
                        >
                          <IconTrash className="h-3.5 w-3.5" />
                          {removing === entry.fingerprint ? "Removing…" : "Unblock"}
                        </button>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="panel p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-indigo-500/20 bg-indigo-500/10 text-indigo-600 dark:text-indigo-300">
            <IconCloud className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-strong">Cloudflare firewall export</h2>
            <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted">
              Cloudflare cannot compute browser fingerprints at the edge, so these expressions mirror the blocklist
              with the request data stored for each fingerprint (IP address and User-Agent). Paste them into{" "}
              <a
                href="https://developers.cloudflare.com/waf/custom-rules/"
                target="_blank"
                rel="noreferrer"
                className="text-accent hover:opacity-80"
              >
                Security → WAF → Custom rules
              </a>{" "}
              with the <span className="text-fg">Block</span> action. The tracker keeps enforcing the fingerprint
              block on its own; this just adds an edge layer.
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-1.5">
          {RULE_VARIANTS.map((variant) => {
            const active = variant.key === ruleVariant;
            return (
              <button
                key={variant.key}
                type="button"
                title={variant.hint}
                onClick={() => setRuleVariant(variant.key)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                  active
                    ? "border-transparent bg-gradient-to-r from-indigo-500/90 to-cyan-400/80 text-white"
                    : "border-line bg-subtle text-muted hover:bg-subtle-strong hover:text-strong"
                }`}
              >
                {variant.label}
              </button>
            );
          })}
        </div>

        {firewallRule.expression ? (
          <div className="mt-3">
            <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-faint">
                Expression · {firewallRule.entries} {firewallRule.entries === 1 ? "entry" : "entries"}
                {firewallRule.skipped > 0 ? ` · ${firewallRule.skipped} without data` : ""}
              </span>
              <CopyButton value={firewallRule.expression} label="Copy expression" />
            </div>
            <pre className="mono max-h-52 overflow-auto whitespace-pre-wrap break-all rounded-lg border border-line bg-surface-2 px-3 py-2 text-[11px] leading-relaxed text-fg">
              {firewallRule.expression}
            </pre>
          </div>
        ) : (
          <p className="mt-3 rounded-lg border border-warning/25 bg-warning/10 px-3 py-2 text-xs text-warning">
            No request data (IP / User-Agent) is available for the blocked fingerprints yet — the expression will
            appear once a blocked browser is seen by the tracker.
          </p>
        )}
      </div>

      <div className="flex items-start gap-2.5 rounded-xl border border-line bg-panel px-4 py-3 text-xs leading-relaxed text-muted">
        <IconAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
        <p>
          The blocklist is cached for 30 seconds in the Worker and up to 5 minutes at the edge, so new blocks can take
          a few minutes to reach every browser.
        </p>
      </div>
    </div>
  );
}
