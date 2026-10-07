"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { IconRotate } from "./icons";

export function RotateKeyButton() {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function rotate() {
    setRotating(true);
    setError(null);
    try {
      const response = await fetch("/api/keys/rotate", { method: "POST" });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `Request failed (${response.status})`);
      }
      setConfirming(false);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not rotate the key.");
    } finally {
      setRotating(false);
    }
  }

  if (!confirming) {
    return (
      <div className="space-y-2">
        <button type="button" className="btn w-full" onClick={() => setConfirming(true)}>
          <IconRotate className="h-4 w-4" />
          Rotate key now
        </button>
        {error ? <p className="text-xs text-rose-300">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="rounded-lg border border-warning/25 bg-warning/10 px-3 py-2 text-xs leading-relaxed text-warning">
        The current key will be retired immediately. Trackers served in the last 24 hours keep working during the
        grace period.
      </p>
      <div className="flex gap-2">
        <button type="button" className="btn btn-primary flex-1" onClick={rotate} disabled={rotating}>
          {rotating ? "Rotating…" : "Confirm rotation"}
        </button>
        <button type="button" className="btn" onClick={() => setConfirming(false)} disabled={rotating}>
          Cancel
        </button>
      </div>
      {error ? <p className="text-xs text-rose-300">{error}</p> : null}
    </div>
  );
}
