"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { RANGES } from "@/lib/ranges";

export function RangeSwitcher({ current }: { current: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  function selectRange(key: string) {
    if (key === current) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("range", key);
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    });
  }

  return (
    <div
      className={`inline-flex items-center gap-0.5 rounded-xl border border-line bg-subtle p-1 transition-opacity ${
        pending ? "opacity-60" : ""
      }`}
      role="tablist"
      aria-label="Time range"
    >
      {RANGES.map((range) => {
        const active = range.key === current;
        return (
          <button
            key={range.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => selectRange(range.key)}
            title={range.label}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              active
                ? "bg-gradient-to-r from-indigo-500/90 to-cyan-400/80 text-white shadow-[0_6px_18px_-10px_rgba(99,102,241,0.9)]"
                : "text-muted hover:bg-subtle-strong hover:text-strong"
            }`}
          >
            {range.shortLabel}
          </button>
        );
      })}
    </div>
  );
}
