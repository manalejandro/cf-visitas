import { formatNumber, formatPercent } from "@/lib/format";
import type { StatsBucket } from "@/lib/types";
import { EmptyHint } from "../ChartPanel";

const PALETTE = [
  "linear-gradient(90deg, #6366F1, #22D3EE)",
  "#818CF8",
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
];

export function BarList({
  data,
  emptyLabel,
  limit = 8,
  formatLabel,
}: {
  data: StatsBucket[];
  emptyLabel?: string;
  limit?: number;
  formatLabel?: (label: string) => string;
}) {
  if (!data.length) return <EmptyHint label={emptyLabel} />;

  const items = data.slice(0, limit);
  const max = Math.max(...items.map((item) => item.value), 1);
  const total = data.reduce((sum, item) => sum + item.value, 0);

  return (
    <ul className="space-y-3">
      {items.map((item, index) => (
        <li key={`${item.label}-${index}`}>
          <div className="flex items-baseline justify-between gap-3">
            <span className="truncate text-[13px] text-fg">{formatLabel ? formatLabel(item.label) : item.label}</span>
            <span className="shrink-0 text-[11px] tabular-nums text-muted">
              {formatNumber(item.value)} · {formatPercent(item.value, total)}
            </span>
          </div>
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-subtle">
            <div
              className="h-full rounded-full transition-[width] duration-500"
              style={{ width: `${Math.max((item.value / max) * 100, 2)}%`, background: PALETTE[index % PALETTE.length] }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
