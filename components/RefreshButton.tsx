"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { IconRefresh } from "./icons";

export function RefreshButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      className="btn !px-2.5"
      title="Refresh data"
      onClick={() => startTransition(() => router.refresh())}
      disabled={pending}
    >
      <IconRefresh className={`h-4 w-4 ${pending ? "animate-spin" : ""}`} />
      <span className="hidden sm:inline">Refresh</span>
    </button>
  );
}
