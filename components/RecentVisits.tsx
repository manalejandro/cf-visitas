"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CopyButton } from "./CopyButton";
import {
  IconAlert,
  IconChevronDown,
  IconExternal,
  IconMonitor,
  IconSmartphone,
  IconTablet,
  IconShield,
  IconShieldCheck,
} from "./icons";
import {
  countryFlag,
  countryName,
  formatDateTime,
  formatNumber,
  formatRelativeTime,
  formatShortDateTime,
  prettyPath,
  prettyReferrer,
  stringifyValue,
  truncate,
} from "@/lib/format";
import type { RangeKey, VisitRecord } from "@/lib/types";

interface RecentVisitsProps {
  initialVisits: VisitRecord[];
  total: number;
  range: RangeKey;
  initialBlocked: string[];
  pageSize?: number;
}

function DeviceIcon({ type, className = "h-4 w-4" }: { type: string; className?: string }) {
  if (type === "Mobile") return <IconSmartphone className={className} />;
  if (type === "Tablet") return <IconTablet className={className} />;
  return <IconMonitor className={className} />;
}

export function RecentVisits({ initialVisits, total, range, initialBlocked, pageSize = 50 }: RecentVisitsProps) {
  const router = useRouter();
  const [visits, setVisits] = useState(initialVisits);
  const [count, setCount] = useState(total);
  const [loadingMore, setLoadingMore] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [blocking, setBlocking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState<number | null>(null);
  const [blocked, setBlocked] = useState<Set<string>>(() => new Set(initialBlocked));

  const visitsRef = useRef(initialVisits);
  const loadingRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setNow(Date.now());
  }, []);

  useEffect(() => {
    setBlocked(new Set(initialBlocked));
  }, [initialBlocked]);

  useEffect(() => {
    visitsRef.current = visits;
  }, [visits]);

  const loadMore = useCallback(async () => {
    if (loadingRef.current) return;
    const offset = visitsRef.current.length;
    if (offset === 0) return;

    loadingRef.current = true;
    setLoadingMore(true);
    setError(null);
    try {
      const response = await fetch(`/api/visits?range=${range}&limit=${pageSize}&offset=${offset}`, {
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`Request failed (${response.status})`);
      const data = (await response.json()) as { visits: VisitRecord[]; total: number };
      setVisits((current) => {
        const known = new Set(current.map((visit) => visit.id));
        const appended = data.visits.filter((visit) => !known.has(visit.id));
        return appended.length ? [...current, ...appended] : current;
      });
      setCount(data.total);
    } catch {
      setError("Could not load more visits.");
    } finally {
      loadingRef.current = false;
      setLoadingMore(false);
    }
  }, [range, pageSize]);

  // Infinite scroll: load the next page when the sentinel below the table
  // enters the viewport (prefetching one screen ahead).
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || error || loadingMore || visits.length >= count) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) void loadMore();
      },
      { rootMargin: "320px 0px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore, error, loadingMore, visits.length, count]);

  async function blockVisit(visit: VisitRecord) {
    setBlocking(visit.fingerprint);
    setError(null);
    try {
      const response = await fetch("/api/blocked", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fingerprint: visit.fingerprint, reason: "Blocked from visit feed" }),
      });
      if (!response.ok) throw new Error(`Request failed (${response.status})`);
      setBlocked((current) => new Set(current).add(visit.fingerprint));
      router.refresh();
    } catch {
      setError("Could not block this fingerprint. Try again.");
    } finally {
      setBlocking(null);
    }
  }

  if (!visits.length) {
    return (
      <div className="panel flex flex-col items-center gap-2 px-6 py-14 text-center">
        <IconAlert className="h-6 w-6 text-faint" />
        <p className="text-sm font-medium text-fg">No visits recorded yet</p>
        <p className="max-w-md text-xs leading-relaxed text-muted">
          Install the tracker on the sites you want to measure. Visits will appear here as soon as browsers start
          sending encrypted payloads.
        </p>
      </div>
    );
  }

  const allLoaded = visits.length >= count;

  return (
    <div className="panel overflow-hidden">
      <header className="panel-header">
        <div>
          <h2 className="panel-title">Recent visits</h2>
          <p className="panel-subtitle">
            Showing {formatNumber(visits.length)} of {formatNumber(count)} · click a row for the full payload
          </p>
        </div>
        <a className="btn !px-2.5 text-xs" href={`/api/export?range=${range}`}>
          Export CSV
        </a>
      </header>

      {error ? (
        <p className="mx-5 mb-3 flex items-center justify-between gap-3 rounded-lg border border-danger/25 bg-danger/10 px-3 py-2 text-xs text-danger">
          {error}
          {!allLoaded ? (
            <button type="button" className="btn !px-2 !py-1 text-xs" onClick={() => void loadMore()}>
              Retry
            </button>
          ) : null}
        </p>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[880px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-y border-line bg-subtle text-[11px] uppercase tracking-wider text-faint">
              <th className="px-5 py-2.5 font-medium">Time</th>
              <th className="px-3 py-2.5 font-medium">Location</th>
              <th className="px-3 py-2.5 font-medium">Browser</th>
              <th className="px-3 py-2.5 font-medium">Device</th>
              <th className="px-3 py-2.5 font-medium">Page</th>
              <th className="px-3 py-2.5 font-medium">Fingerprint</th>
              <th className="px-5 py-2.5 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {visits.map((visit) => {
              const isExpanded = expanded === visit.id;
              const isBlocked = blocked.has(visit.fingerprint);
              return (
                <FragmentRow
                  key={visit.id}
                  visit={visit}
                  isExpanded={isExpanded}
                  isBlocked={isBlocked}
                  isBlocking={blocking === visit.fingerprint}
                  now={now}
                  onToggle={() => setExpanded(isExpanded ? null : visit.id)}
                  onBlock={() => blockVisit(visit)}
                />
              );
            })}
            {loadingMore ? (
              <tr>
                <td colSpan={7} className="px-5 py-6 text-center">
                  <span className="inline-flex items-center gap-2 text-xs text-muted">
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-line border-t-accent" />
                    Loading more visits…
                  </span>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div ref={sentinelRef} aria-hidden="true" className="h-px w-full" />

      <div className="flex items-center justify-center border-t border-line px-5 py-3">
        {allLoaded ? (
          <p className="text-[11px] text-faint">All {formatNumber(count)} visits loaded</p>
        ) : (
          <p className="text-[11px] text-faint">Scroll to load more · {formatNumber(count - visits.length)} remaining</p>
        )}
      </div>
    </div>
  );
}

function FragmentRow({
  visit,
  isExpanded,
  isBlocked,
  isBlocking,
  now,
  onToggle,
  onBlock,
}: {
  visit: VisitRecord;
  isExpanded: boolean;
  isBlocked: boolean;
  isBlocking: boolean;
  now: number | null;
  onToggle: () => void;
  onBlock: () => void;
}) {
  return (
    <>
      <tr
        className={`cursor-pointer border-b border-line transition-colors hover:bg-subtle ${isExpanded ? "bg-subtle" : ""}`}
        onClick={onToggle}
      >
        <td className="whitespace-nowrap px-5 py-3">
          <span className="block text-[13px] text-fg">{formatShortDateTime(visit.ts)}</span>
          <span className="block text-[11px] text-muted">{now ? formatRelativeTime(visit.ts, now) : "UTC"}</span>
        </td>
        <td className="px-3 py-3">
          <span className="flex items-center gap-2">
            <span className="text-base leading-none">{countryFlag(visit.country)}</span>
            <span className="min-w-0">
              <span className="block truncate text-[13px] text-fg">
                {visit.city || visit.region || countryName(visit.country)}
              </span>
              <span className="block truncate text-[11px] text-muted">{countryName(visit.country)}</span>
            </span>
          </span>
        </td>
        <td className="px-3 py-3">
          <span className="block text-[13px] text-fg">
            {visit.browser}
            {visit.browserVersion ? ` ${visit.browserVersion}` : ""}
          </span>
          <span className="block text-[11px] text-muted">
            {visit.os}
            {visit.osVersion ? ` ${visit.osVersion}` : ""}
          </span>
        </td>
        <td className="px-3 py-3">
          <span className="flex items-center gap-2 text-[13px] text-fg">
            <DeviceIcon type={visit.deviceType} className="h-3.5 w-3.5 text-faint" />
            {visit.deviceType}
          </span>
          <span className="block text-[11px] text-muted">{visit.deviceVendor}</span>
        </td>
        <td className="max-w-[220px] px-3 py-3">
          <span className="block truncate text-[13px] text-fg">{prettyPath(visit.url)}</span>
          <span className="block truncate text-[11px] text-muted">{prettyReferrer(visit.referrer)}</span>
        </td>
        <td className="px-3 py-3">
          <span className="mono block text-[11px] text-muted">{truncate(visit.fingerprint, 12)}</span>
          {isBlocked ? (
            <span className="mt-0.5 inline-flex items-center gap-1 text-[10px] font-medium text-danger">
              <IconShield className="h-3 w-3" /> Blocked
            </span>
          ) : null}
        </td>
        <td className="px-5 py-3 text-right">
          <span className="inline-flex items-center gap-1.5">
            {!isBlocked ? (
              <button
                type="button"
                className="btn btn-danger !px-2 !py-1.5 text-xs"
                disabled={isBlocking}
                onClick={(event) => {
                  event.stopPropagation();
                  onBlock();
                }}
                title="Block this fingerprint"
              >
                <IconShield className="h-3.5 w-3.5" />
                {isBlocking ? "Blocking…" : "Block"}
              </button>
            ) : (
              <span className="chip !text-[10px] !text-danger">
                <IconShieldCheck className="h-3 w-3" /> Blocked
              </span>
            )}
            <IconChevronDown
              className={`h-4 w-4 text-faint transition-transform ${isExpanded ? "rotate-180" : ""}`}
            />
          </span>
        </td>
      </tr>
      {isExpanded ? (
        <tr className="border-b border-line bg-surface-2/60">
          <td colSpan={7} className="px-5 py-5">
            <VisitDetails visit={visit} />
          </td>
        </tr>
      ) : null}
    </>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line bg-panel px-3 py-2">
      <dt className="text-[10px] font-semibold uppercase tracking-wider text-faint">{label}</dt>
      <dd className="mt-0.5 break-words text-[13px] text-fg">{value}</dd>
    </div>
  );
}

function JsonBlock({ title, value }: { title: string; value: unknown }) {
  return (
    <details className="group rounded-xl border border-line bg-surface-2/70">
      <summary className="flex cursor-pointer items-center justify-between px-4 py-2.5 text-xs font-medium text-muted transition-colors hover:text-strong">
        {title}
        <IconChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
      </summary>
      <pre className="mono max-h-72 overflow-auto border-t border-line px-4 py-3 text-[11px] leading-relaxed text-muted">
        {JSON.stringify(value, null, 2)}
      </pre>
    </details>
  );
}

function VisitDetails({ visit }: { visit: VisitRecord }) {
  const hardware = visit.hardware as Record<string, unknown>;
  const properties = visit.properties as Record<string, unknown>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-faint">Page URL</p>
          <a
            href={visit.url}
            target="_blank"
            rel="noreferrer"
            className="mt-1 inline-flex max-w-full items-center gap-1.5 break-all text-[13px] text-accent hover:opacity-80"
          >
            <span className="break-all">{visit.url || "—"}</span>
            <IconExternal className="h-3.5 w-3.5 shrink-0" />
          </a>
          <p className="mt-1 text-xs text-muted">Referrer: {visit.referrer ? visit.referrer : "Direct"}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="mono text-[11px] text-muted">{visit.fingerprint}</span>
          <CopyButton value={visit.fingerprint} label="Copy" />
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        <DetailItem label="Timestamp (UTC)" value={formatDateTime(visit.ts)} />
        <DetailItem label="IP address" value={visit.ip || "—"} />
        <DetailItem
          label="Location"
          value={`${countryFlag(visit.country)} ${visit.city || visit.region || countryName(visit.country)}`}
        />
        <DetailItem label="Organization" value={visit.org || "—"} />
        <DetailItem label="Language" value={visit.language || "—"} />
        <DetailItem label="Browser" value={`${visit.browser} ${visit.browserVersion}`.trim() || "—"} />
        <DetailItem label="Engine" value={`${visit.engine} ${visit.engineVersion}`.trim() || "—"} />
        <DetailItem label="OS" value={`${visit.os} ${visit.osVersion}`.trim() || "—"} />
        <DetailItem label="Device" value={`${visit.device} (${visit.deviceType})`} />
        <DetailItem label="Vendor" value={visit.deviceVendor || "—"} />
        <DetailItem label="Timezone" value={visit.timezone || "—"} />
        <DetailItem label="Resolution" value={visit.resolution || "—"} />
        <DetailItem label="CPU cores" value={stringifyValue(hardware.concurrency)} />
        <DetailItem label="Device memory" value={hardware.memory ? `${hardware.memory} GB` : "—"} />
        <DetailItem
          label="Connection"
          value={stringifyValue((hardware.connection as Record<string, unknown> | null)?.effectiveType ?? "—")}
        />
      </dl>

      <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
        <JsonBlock title="Hardware & sensors" value={visit.hardware} />
        <JsonBlock title="Client properties" value={properties} />
        <JsonBlock title="Request metadata" value={visit.meta} />
        <JsonBlock title="Extras" value={{ sensors: visit.sensors }} />
      </div>
    </div>
  );
}
