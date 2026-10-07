import { IconActivity } from "./icons";

const ACCENTS = {
  indigo: {
    chip: "border-indigo-500/20 bg-indigo-500/10 text-indigo-600 dark:text-indigo-300",
    spark: "text-indigo-500 dark:text-indigo-300",
  },
  cyan: {
    chip: "border-cyan-500/20 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300",
    spark: "text-cyan-600 dark:text-cyan-300",
  },
  emerald: {
    chip: "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    spark: "text-emerald-600 dark:text-emerald-300",
  },
  amber: {
    chip: "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    spark: "text-amber-600 dark:text-amber-300",
  },
  rose: {
    chip: "border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-300",
    spark: "text-rose-500 dark:text-rose-300",
  },
} as const;

export type StatAccent = keyof typeof ACCENTS;

export function Sparkline({ data, className = "" }: { data: number[]; className?: string }) {
  if (data.length < 2) return null;
  const width = 100;
  const height = 30;
  const max = Math.max(...data, 1);
  const step = width / (data.length - 1);
  const points = data.map((value, index) => {
    const x = index * step;
    const y = height - 3 - (value / max) * (height - 6);
    return [x, y] as const;
  });
  const line = points.map(([x, y], index) => `${index === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
  const area = `${line} L${width},${height} L0,${height} Z`;

  return (
    <svg className={`h-8 w-full ${className}`} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
      <path d={area} fill="currentColor" fillOpacity={0.14} />
      <path d={line} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  accent = "indigo",
  spark,
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: React.ComponentType<{ className?: string }>;
  accent?: StatAccent;
  spark?: number[];
}) {
  const Icon = icon ?? IconActivity;
  const accentStyles = ACCENTS[accent];

  return (
    <div className="panel animate-fade-up p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-faint">{label}</p>
          <p className="mt-2 truncate text-3xl font-semibold tracking-tight text-strong">{value}</p>
          {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
        </div>
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${accentStyles.chip}`}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      {spark && spark.length > 1 ? (
        <div className={`mt-4 ${accentStyles.spark}`}>
          <Sparkline data={spark} />
        </div>
      ) : null}
    </div>
  );
}
