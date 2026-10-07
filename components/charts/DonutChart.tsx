"use client";

import { useState } from "react";
import { formatCompactNumber, formatNumber, formatPercent } from "@/lib/format";
import type { StatsBucket } from "@/lib/types";

const PALETTE = [
  "#6366F1",
  "#22D3EE",
  "#34D399",
  "#FBBF24",
  "#F472B6",
  "#A78BFA",
  "#38BDF8",
  "#FB7185",
  "#4ADE80",
  "#F97316",
  "#2DD4BF",
  "#E879F9",
];

const RADIUS = 46;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function DonutChart({
  data,
  limit = 7,
  centerLabel = "Total",
  formatLabel,
}: {
  data: StatsBucket[];
  limit?: number;
  centerLabel?: string;
  formatLabel?: (label: string) => string;
}) {
  const [hover, setHover] = useState<number | null>(null);

  if (!data.length) {
    return (
      <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-line text-xs text-faint">
        No data for this period
      </div>
    );
  }

  const items = data.slice(0, limit);
  const total = data.reduce((sum, item) => sum + item.value, 0);

  let offset = 0;
  const slices = items.map((item, index) => {
    const fraction = total > 0 ? item.value / total : 0;
    const slice = { item, index, fraction, offset };
    offset += fraction;
    return slice;
  });

  const active = hover !== null ? slices[hover] : null;

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative shrink-0">
        <svg viewBox="0 0 120 120" className="h-[168px] w-[168px]">
          <circle cx="60" cy="60" r={RADIUS} fill="none" stroke="var(--subtle-strong)" strokeWidth="17" />
          <g transform="rotate(-90 60 60)">
            {slices.map((slice) => (
              <circle
                key={`${slice.item.label}-${slice.index}`}
                cx="60"
                cy="60"
                r={RADIUS}
                fill="none"
                stroke={PALETTE[slice.index % PALETTE.length]}
                strokeWidth={hover === slice.index ? 21 : 17}
                strokeDasharray={`${slice.fraction * CIRCUMFERENCE} ${CIRCUMFERENCE}`}
                strokeDashoffset={-slice.offset * CIRCUMFERENCE}
                opacity={hover === null || hover === slice.index ? 1 : 0.3}
                className="cursor-pointer transition-all duration-200"
                onMouseEnter={() => setHover(slice.index)}
                onMouseLeave={() => setHover(null)}
              />
            ))}
          </g>
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-xl font-semibold tabular-nums tracking-tight text-strong">
            {active ? formatPercent(active.item.value, total, 1) : formatCompactNumber(total)}
          </span>
          <span className="mt-0.5 max-w-[110px] truncate text-[10px] uppercase tracking-wider text-faint">
            {active ? active.item.label : centerLabel}
          </span>
        </div>
      </div>

      <ul className="w-full min-w-0 space-y-2">
        {slices.map((slice) => (
          <li
            key={`${slice.item.label}-legend-${slice.index}`}
            className={`flex items-center justify-between gap-3 rounded-lg px-2 py-1 transition-colors ${
              hover === slice.index ? "bg-subtle" : ""
            }`}
            onMouseEnter={() => setHover(slice.index)}
            onMouseLeave={() => setHover(null)}
          >
            <span className="flex min-w-0 items-center gap-2">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: PALETTE[slice.index % PALETTE.length] }}
              />
              <span className="truncate text-[13px] text-fg">
                {formatLabel ? formatLabel(slice.item.label) : slice.item.label}
              </span>
            </span>
            <span className="shrink-0 text-[11px] tabular-nums text-muted">
              {formatNumber(slice.item.value)} · {formatPercent(slice.item.value, total)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
