import { CopyButton } from "./CopyButton";
import { IconActivity, IconShieldCheck, IconZap } from "./icons";
import { getSiteOrigin } from "@/lib/site";

export async function EmptyDashboard() {
  const origin = await getSiteOrigin();
  const trackerUrl = origin ? `${origin}/tracker.js` : "/tracker.js";
  const snippet = `<script src="${trackerUrl}" defer></script>`;

  return (
    <div className="panel overflow-hidden">
      <div className="relative border-b border-line px-6 py-10 text-center">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute left-1/2 top-[-140px] h-[280px] w-[520px] -translate-x-1/2 rounded-full bg-indigo-500/10 blur-[100px]" />
        </div>
        <div className="relative flex flex-col items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-indigo-500/20 bg-indigo-500/10 text-indigo-600 dark:text-indigo-300">
            <IconActivity className="h-5 w-5" />
          </span>
          <h2 className="text-lg font-semibold tracking-tight text-strong">No visits recorded yet</h2>
          <p className="max-w-xl text-sm leading-relaxed text-muted">
            Add the tracker to any website you want to measure. Visits are encrypted in the browser with the project
            public key before they ever leave the visitor&apos;s device.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 px-6 py-8 md:grid-cols-3">
        <div className="space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">Step 1 · Install</p>
          <p className="text-sm text-muted">
            Paste this snippet before <code className="mono text-[12px] text-fg">&lt;/head&gt;</code> on every page you
            want to track.
          </p>
          <div className="relative rounded-xl border border-line bg-surface-2 p-3">
            <code className="mono block break-all pr-16 text-[11px] leading-relaxed text-accent-2">{snippet}</code>
            <div className="absolute right-2 top-2">
              <CopyButton value={snippet} label="" />
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">Step 2 · Visit</p>
          <p className="text-sm text-muted">
            Open the site in a browser. The tracker computes a fingerprint, encrypts the payload (RSA-OAEP +
            AES-256-GCM) and posts it to <code className="mono text-[12px] text-fg">/api/track</code>.
          </p>
        </div>

        <div className="space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">Step 3 · Control</p>
          <p className="text-sm text-muted">
            Watch the dashboard fill up, then block unwanted browsers by fingerprint from the visit feed. Blocked
            devices never see the page again.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 border-t border-line px-6 py-4 text-xs text-muted">
        <span className="inline-flex items-center gap-2">
          <IconZap className="h-3.5 w-3.5 text-accent-2" /> Per-request tracker, signed with HMAC-SHA256
        </span>
        <span className="inline-flex items-center gap-2">
          <IconShieldCheck className="h-3.5 w-3.5 text-success" /> Blocklist embedded and enforced client-side
        </span>
      </div>
    </div>
  );
}
