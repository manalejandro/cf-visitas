import type { Metadata } from "next";
import { BlockedManager } from "@/components/BlockedManager";
import { listBlockedFingerprints } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Blocked browsers",
  description: "Manage the fingerprints blocked by the tracker.",
};

export default async function BlockedPage() {
  const blocked = await listBlockedFingerprints();

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-strong">Blocked browsers</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted">
          Fingerprints listed here are embedded in every generated tracker. When a blocked browser loads a page with
          the tracker installed, the page load is cancelled and replaced with an &ldquo;Access blocked&rdquo; screen.
        </p>
      </header>
      <BlockedManager initialBlocked={blocked} />
    </div>
  );
}
