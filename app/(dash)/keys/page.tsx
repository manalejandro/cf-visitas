import type { Metadata } from "next";
import { ChartPanel } from "@/components/ChartPanel";
import { CopyButton } from "@/components/CopyButton";
import { RotateKeyButton } from "@/components/RotateKeyButton";
import { IconAlert, IconKey, IconLock } from "@/components/icons";
import { formatDateTime } from "@/lib/format";
import { ensureActiveTrackerKey, getRotationDays, KEY_GRACE_DAYS, listTrackerKeys } from "@/lib/keys";
import type { TrackerKeyInfo } from "@/lib/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Tracker keys",
  description: "Post-quantum encryption keys used by the tracker, their rotation policy and history.",
};

const ALGORITHM_DETAILS: Record<string, { standard: string; detail: string }> = {
  "ML-KEM-1024": { standard: "FIPS 203 (ML-KEM)", detail: "Post-quantum · NIST Level 5" },
  "RSA-OAEP-256": { standard: "RSA-OAEP · SHA-256", detail: "Legacy · 2048-bit" },
};

function daysUntil(iso: string): number {
  return Math.max(0, Math.ceil((Date.parse(iso) - Date.now()) / 86_400_000));
}

function keyBytes(publicKeyBase64Url: string): number {
  return Math.floor((publicKeyBase64Url.length * 3) / 4);
}

function KeyStatus({ entry }: { entry: TrackerKeyInfo }) {
  if (entry.active) return <span className="chip !text-success">Active</span>;
  if (!entry.retiredAt) return <span className="chip !text-warning">Expired</span>;
  return <span className="chip !text-muted">Retired</span>;
}

export default async function KeysPage() {
  let active: { id: number; algorithm: string; createdAt: string; expiresAt: string; publicKey: string } | null = null;
  let keys: TrackerKeyInfo[] = [];
  let error: string | null = null;

  try {
    const key = await ensureActiveTrackerKey();
    active = {
      id: key.id,
      algorithm: key.algorithm,
      createdAt: key.createdAt,
      expiresAt: key.expiresAt,
      publicKey: key.publicKey,
    };
    keys = await listTrackerKeys();
  } catch (caught) {
    error = caught instanceof Error ? caught.message : "Unable to load the tracker keys.";
  }

  const rotationDays = getRotationDays();
  const algorithmDetails = active ? ALGORITHM_DETAILS[active.algorithm] : undefined;

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-strong">Tracker keys</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted">
          Visit payloads are encrypted in the browser with hybrid post-quantum cryptography: ML-KEM-1024 (FIPS 203)
          encapsulates a shared secret that HKDF-SHA256 stretches into an AES-256-GCM key. The key pair is generated
          by the Worker itself, stored in D1 and rotated automatically.
        </p>
      </header>

      {error ? (
        <div className="panel flex items-start gap-3 p-5">
          <IconAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <div>
            <p className="text-sm font-medium text-strong">Tracker keys are unavailable</p>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              {error} — make sure the D1 database exists and the migrations have been applied
              (<code className="mono">npm run db:migrate</code> locally,{" "}
              <code className="mono">npm run db:migrate:remote</code> in production).
            </p>
          </div>
        </div>
      ) : (
        <>
          <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="panel p-5 lg:col-span-2">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-indigo-500/20 bg-indigo-500/10 text-indigo-600 dark:text-indigo-300">
                    <IconKey className="h-4 w-4" />
                  </span>
                  <div>
                    <h2 className="text-sm font-semibold text-strong">Active encryption key</h2>
                    <p className="text-xs text-muted">Embedded in every generated tracker</p>
                  </div>
                </div>
                {active ? <span className="chip !text-success">Key #{active.id}</span> : null}
              </div>

              {active ? (
                <dl className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <div className="rounded-lg border border-line bg-panel px-3 py-2">
                    <dt className="text-[10px] font-semibold uppercase tracking-wider text-faint">Algorithm</dt>
                    <dd className="mt-0.5 text-[13px] text-fg">{active.algorithm}</dd>
                  </div>
                  <div className="rounded-lg border border-line bg-panel px-3 py-2">
                    <dt className="text-[10px] font-semibold uppercase tracking-wider text-faint">Standard</dt>
                    <dd className="mt-0.5 text-[13px] text-fg">
                      {algorithmDetails?.standard ?? "—"}
                      <span className="block text-[11px] text-muted">{algorithmDetails?.detail}</span>
                    </dd>
                  </div>
                  <div className="rounded-lg border border-line bg-panel px-3 py-2">
                    <dt className="text-[10px] font-semibold uppercase tracking-wider text-faint">Created</dt>
                    <dd className="mt-0.5 text-[13px] text-fg">{formatDateTime(active.createdAt)}</dd>
                  </div>
                  <div className="rounded-lg border border-line bg-panel px-3 py-2">
                    <dt className="text-[10px] font-semibold uppercase tracking-wider text-faint">Expires</dt>
                    <dd className="mt-0.5 text-[13px] text-fg">
                      {formatDateTime(active.expiresAt)}{" "}
                      <span className="text-[11px] text-muted">({daysUntil(active.expiresAt)}d left)</span>
                    </dd>
                  </div>
                </dl>
              ) : null}

              {active ? (
                <div className="mt-4">
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-faint">
                      Public encapsulation key · {keyBytes(active.publicKey)} bytes (base64url)
                    </span>
                    <CopyButton value={active.publicKey} label="Copy key" />
                  </div>
                  <code className="mono block max-h-24 overflow-hidden break-all rounded-lg border border-line bg-surface-2 px-3 py-2 text-[11px] leading-relaxed text-muted">
                    {active.publicKey}
                  </code>
                </div>
              ) : null}
            </div>

            <ChartPanel title="Rotation policy" subtitle="Automatic and manual rotation">
              <div className="space-y-4">
                <ul className="space-y-2.5 text-[13px] leading-relaxed text-muted">
                  <li className="flex items-start gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-400" />
                    <span>
                      New key pair every <span className="font-medium text-fg">{rotationDays} days</span> (configurable
                      with <code className="mono text-[11px]">TRACKER_KEY_ROTATION_DAYS</code>).
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-400" />
                    <span>
                      Retired keys are kept for <span className="font-medium text-fg">{KEY_GRACE_DAYS} days</span> so
                      in-flight trackers can still be decrypted.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-rose-400" />
                    <span>Older keys are deleted automatically from D1.</span>
                  </li>
                </ul>
                <RotateKeyButton />
              </div>
            </ChartPanel>
          </section>

          <div className="panel overflow-hidden">
            <header className="panel-header">
              <div>
                <h2 className="panel-title">Key history</h2>
                <p className="panel-subtitle">Most recent keys first</p>
              </div>
            </header>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead>
                  <tr className="border-y border-line bg-subtle text-[11px] uppercase tracking-wider text-faint">
                    <th className="px-5 py-2.5 font-medium">Key</th>
                    <th className="px-3 py-2.5 font-medium">Algorithm</th>
                    <th className="px-3 py-2.5 font-medium">Created</th>
                    <th className="px-3 py-2.5 font-medium">Expires</th>
                    <th className="px-3 py-2.5 font-medium">Status</th>
                    <th className="px-5 py-2.5 font-medium">Retired</th>
                  </tr>
                </thead>
                <tbody>
                  {keys.map((key) => (
                    <tr key={key.id} className="border-b border-line hover:bg-subtle">
                      <td className="px-5 py-3">
                        <span className="mono text-[12px] text-fg">#{key.id}</span>
                      </td>
                      <td className="px-3 py-3">
                        <span className="text-[12px] text-fg">{key.algorithm}</span>
                        {key.algorithm !== "ML-KEM-1024" ? (
                          <span className="ml-2 chip !text-[10px] !text-warning">Legacy</span>
                        ) : null}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-[12px] text-muted">
                        {formatDateTime(key.createdAt)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-[12px] text-muted">
                        {formatDateTime(key.expiresAt)}
                      </td>
                      <td className="px-3 py-3">
                        <KeyStatus entry={key} />
                      </td>
                      <td className="whitespace-nowrap px-5 py-3 text-[12px] text-muted">
                        {key.retiredAt ? formatDateTime(key.retiredAt) : <span className="text-faint">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex items-start gap-2.5 rounded-xl border border-line bg-panel px-4 py-3 text-xs leading-relaxed text-muted">
            <IconLock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
            <p>
              Private keys never leave the Worker: they are stored in D1 and used only to decapsulate/decrypt visit
              payloads. The tracker only ever receives the public encapsulation key. Legacy RSA keys are kept only
              while in-flight trackers from before the post-quantum switch can still submit.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
