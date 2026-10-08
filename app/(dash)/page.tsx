import type { Metadata } from "next";
import { EmptyDashboard } from "@/components/EmptyDashboard";
import { ChartPanel } from "@/components/ChartPanel";
import { RangeSwitcher } from "@/components/RangeSwitcher";
import { RecentVisits } from "@/components/RecentVisits";
import { RefreshButton } from "@/components/RefreshButton";
import { StatCard } from "@/components/StatCard";
import { BarList } from "@/components/charts/BarList";
import { DonutChart } from "@/components/charts/DonutChart";
import { VisitsAreaChart } from "@/components/charts/AreaChart";
import {
  IconActivity,
  IconChevronDown,
  IconGlobe,
  IconServer,
  IconShield,
  IconUser,
} from "@/components/icons";
import { getStats, getVisits, listBlockedFingerprints, parseRange } from "@/lib/db";
import { countryFlag, countryName, formatCompactNumber, formatNumber, formatTime, prettyPath, prettyReferrer } from "@/lib/format";
import { getRangeDefinition } from "@/lib/ranges";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Overview",
  description: "Traffic overview: visits, visitors, devices and locations.",
};

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const range = parseRange(typeof params.range === "string" ? params.range : undefined);
  const definition = getRangeDefinition(range);

  const [stats, visitsPage, blockedList] = await Promise.all([
    getStats(range),
    getVisits(range, 50, 0),
    listBlockedFingerprints(),
  ]);

  const blockedHashes = blockedList.map((entry) => entry.fingerprint);
  const blockedHits = blockedList.reduce((sum, entry) => sum + entry.hits, 0);
  const timelineVisits = stats.timeline.map((point) => point.visits);
  const breakdowns = stats.breakdowns;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-strong">Overview</h1>
          <p className="mt-1 text-sm text-muted">
            {definition.label} · updated {formatTime(stats.generatedAt)} UTC
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <RangeSwitcher current={range} />
          <RefreshButton />
        </div>
      </header>

      {stats.summary.totalVisits === 0 ? (
        <EmptyDashboard />
      ) : (
        <>
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <StatCard
              label="Total visits"
              value={formatCompactNumber(stats.summary.totalVisits)}
              hint={definition.label}
              icon={IconActivity}
              accent="indigo"
              spark={timelineVisits}
            />
            <StatCard
              label="Unique visitors"
              value={formatCompactNumber(stats.summary.uniqueVisitors)}
              hint="by fingerprint"
              icon={IconUser}
              accent="cyan"
              spark={stats.timeline.map((point) => point.visitors)}
            />
            <StatCard
              label="Unique IPs"
              value={formatCompactNumber(stats.summary.uniqueIps)}
              hint="CF-Connecting-IP"
              icon={IconServer}
              accent="emerald"
            />
            <StatCard
              label="Countries"
              value={formatCompactNumber(stats.summary.uniqueCountries)}
              hint="distinct origins"
              icon={IconGlobe}
              accent="amber"
            />
            <StatCard
              label="Blocked browsers"
              value={formatCompactNumber(stats.summary.blockedFingerprints)}
              hint={`${formatNumber(blockedHits)} blocked hits`}
              icon={IconShield}
              accent="rose"
            />
          </section>

          <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <ChartPanel
              title="Visits over time"
              subtitle={definition.bucket === "hour" ? "Hourly buckets · UTC" : "Daily buckets · UTC"}
              className="xl:col-span-2"
            >
              <VisitsAreaChart points={stats.timeline} />
            </ChartPanel>
            <ChartPanel title="Device types" subtitle="Desktop, mobile and tablet share">
              <DonutChart data={breakdowns.deviceTypes ?? []} centerLabel="Visits" />
            </ChartPanel>
          </section>

          <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            <ChartPanel title="Browsers" subtitle="Most used browsers">
              <DonutChart data={breakdowns.browsers ?? []} centerLabel="Visits" />
            </ChartPanel>
            <ChartPanel title="Operating systems" subtitle="Visitor platforms">
              <BarList data={breakdowns.operatingSystems ?? []} />
            </ChartPanel>
            <ChartPanel title="Countries" subtitle="Geographic origin (Cloudflare)">
              <BarList
                data={breakdowns.countries ?? []}
                formatLabel={(label) => `${countryFlag(label)} ${countryName(label)}`}
              />
            </ChartPanel>
            <ChartPanel title="Top pages" subtitle="Most visited URLs">
              <BarList data={breakdowns.pages ?? []} formatLabel={prettyPath} />
            </ChartPanel>
            <ChartPanel title="Referrers" subtitle="Where visits come from">
              <BarList data={breakdowns.referrers ?? []} formatLabel={prettyReferrer} />
            </ChartPanel>
            <ChartPanel title="Languages" subtitle="Browser language preference">
              <BarList data={breakdowns.languages ?? []} />
            </ChartPanel>
            <ChartPanel title="Screen resolutions" subtitle="Reported by the browser">
              <BarList data={breakdowns.resolutions ?? []} />
            </ChartPanel>
            <ChartPanel title="Platforms" subtitle="navigator.platform">
              <BarList data={breakdowns.platforms ?? []} />
            </ChartPanel>
            <ChartPanel title="Network types" subtitle="Effective connection type">
              <BarList data={breakdowns.networkTypes ?? []} />
            </ChartPanel>
          </section>

          <details className="group">
            <summary className="btn mx-auto flex w-fit cursor-pointer list-none items-center gap-2 [&::-webkit-details-marker]:hidden">
              More dimensions
              <IconChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
            </summary>
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              <ChartPanel title="Browser versions" subtitle="Detailed version breakdown">
                <BarList data={breakdowns.browserVersions ?? []} />
              </ChartPanel>
              <ChartPanel title="OS versions" subtitle="Detailed version breakdown">
                <BarList data={breakdowns.osVersions ?? []} />
              </ChartPanel>
              <ChartPanel title="Engines" subtitle="Rendering engines">
                <BarList data={breakdowns.engines ?? []} />
              </ChartPanel>
              <ChartPanel title="Device models" subtitle="Detected hardware">
                <BarList data={breakdowns.devices ?? []} />
              </ChartPanel>
              <ChartPanel title="Device vendors" subtitle="Manufacturer">
                <BarList data={breakdowns.deviceVendors ?? []} />
              </ChartPanel>
              <ChartPanel title="Cities" subtitle="City-level origin">
                <BarList data={breakdowns.cities ?? []} />
              </ChartPanel>
              <ChartPanel title="Timezones" subtitle="Browser timezone">
                <BarList data={breakdowns.timezones ?? []} />
              </ChartPanel>
              <ChartPanel title="CPU cores" subtitle="hardwareConcurrency">
                <BarList data={breakdowns.cpuCores ?? []} />
              </ChartPanel>
              <ChartPanel title="Device memory" subtitle="deviceMemory (GB)">
                <BarList data={breakdowns.deviceMemory ?? []} />
              </ChartPanel>
              <ChartPanel title="Color schemes" subtitle="Preferred color scheme">
                <BarList data={breakdowns.colorSchemes ?? []} />
              </ChartPanel>
              <ChartPanel title="WebGL renderers" subtitle="GPU fingerprint surface">
                <BarList data={breakdowns.webglRenderers ?? []} />
              </ChartPanel>
              <ChartPanel title="Organizations" subtitle="Network / ASN organization">
                <BarList data={breakdowns.organizations ?? []} />
              </ChartPanel>
            </div>
          </details>

          <RecentVisits
            key={range}
            initialVisits={visitsPage.visits}
            total={visitsPage.total}
            range={range}
            initialBlocked={blockedHashes}
          />
        </>
      )}
    </div>
  );
}
