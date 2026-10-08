"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { formatCompactNumber, formatNumber } from "@/lib/format";
import type { TimelinePoint } from "@/lib/types";

const PADDING = { top: 18, right: 14, bottom: 28, left: 42 };

function niceScale(maxValue: number): { max: number; step: number } {
  const targetTicks = 4;
  const rawStep = Math.max(maxValue, 1) / targetTicks;
  const power = 10 ** Math.floor(Math.log10(rawStep));
  const step = [1, 2, 2.5, 5, 10].map((candidate) => candidate * power).find((candidate) => candidate >= rawStep) ?? 10 * power;
  return { max: step * targetTicks, step };
}

export function VisitsAreaChart({ points, height = 280 }: { points: TimelinePoint[]; height?: number }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  // 0 = not measured yet: the chart is only rendered once the container width
  // is known, so it can never overflow narrow (mobile) viewports.
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const update = (value: number) => setWidth(Math.max(200, Math.round(value)));
    update(element.clientWidth);
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) update(entry.contentRect.width);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const chart = useMemo(() => {
    const innerWidth = Math.max(1, width - PADDING.left - PADDING.right);
    const innerHeight = Math.max(1, height - PADDING.top - PADDING.bottom);
    const scale = niceScale(Math.max(...points.map((point) => point.visits), 1));
    const maxValue = scale.max;
    const stepX = points.length > 1 ? innerWidth / (points.length - 1) : 0;

    const x = (index: number) => PADDING.left + index * stepX;
    const y = (value: number) => PADDING.top + innerHeight - (value / maxValue) * innerHeight;

    const linePath = points
      .map((point, index) => `${index === 0 ? "M" : "L"}${x(index).toFixed(1)},${y(point.visits).toFixed(1)}`)
      .join(" ");

    const areaPath =
      points.length > 0
        ? `${linePath} L${x(points.length - 1).toFixed(1)},${PADDING.top + innerHeight} L${PADDING.left},${
            PADDING.top + innerHeight
          } Z`
        : "";

    const gridLines = [0, 1, 2, 3, 4].map((index) => {
      const value = index * scale.step;
      return { value, y: y(value) };
    });

    const labelStep = Math.max(1, Math.ceil(points.length / (width < 560 ? 4 : width < 900 ? 6 : 9)));
    const xLabels = points
      .map((point, index) => ({ point, index }))
      .filter(({ index }) => index % labelStep === 0 || index === points.length - 1);

    return { innerHeight, stepX, x, y, linePath, areaPath, gridLines, xLabels };
  }, [points, width, height]);

  const hoveredPoint = hover !== null ? points[hover] : null;
  const totalVisits = points.reduce((sum, point) => sum + point.visits, 0);

  return (
    <div ref={containerRef} className="relative w-full select-none" style={{ minHeight: height }}>
      {width === 0 ? null : (
        <>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="overflow-visible"
        role="img"
        aria-label="Visits over time"
      >
        <defs>
          <linearGradient id="visitas-area-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#6366F1" stopOpacity="0.42" />
            <stop offset="0.6" stopColor="#22D3EE" stopOpacity="0.12" />
            <stop offset="1" stopColor="#22D3EE" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="visitas-area-stroke" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#818CF8" />
            <stop offset="1" stopColor="#22D3EE" />
          </linearGradient>
        </defs>

        {chart.gridLines.map((line) => (
          <g key={line.value}>
            <line
              x1={PADDING.left}
              x2={width - PADDING.right}
              y1={line.y}
              y2={line.y}
              stroke="var(--line-strong)"
              strokeDasharray="3 5"
            />
            <text x={PADDING.left - 8} y={line.y + 3.5} textAnchor="end" className="fill-faint text-[10px]">
              {formatCompactNumber(line.value)}
            </text>
          </g>
        ))}

        {chart.areaPath ? <path d={chart.areaPath} fill="url(#visitas-area-fill)" /> : null}
        {chart.linePath ? (
          <path
            d={chart.linePath}
            fill="none"
            stroke="url(#visitas-area-stroke)"
            strokeWidth={2.2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : null}

        {chart.xLabels.map(({ point, index }) => (
          <text
            key={`${point.bucket}-${index}`}
            x={chart.x(index)}
            y={height - 8}
            textAnchor={index === 0 ? "start" : index === points.length - 1 ? "end" : "middle"}
            className="fill-faint text-[10px]"
          >
            {point.label}
          </text>
        ))}

        {hoveredPoint && hover !== null ? (
          <g>
            <line
              x1={chart.x(hover)}
              x2={chart.x(hover)}
              y1={PADDING.top}
              y2={PADDING.top + chart.innerHeight}
              stroke="var(--line-strong)"
              strokeDasharray="3 4"
            />
            <circle
              cx={chart.x(hover)}
              cy={chart.y(hoveredPoint.visits)}
              r={4.5}
              fill="var(--surface-2)"
              stroke="#22D3EE"
              strokeWidth={2.4}
            />
          </g>
        ) : null}

        <rect
          x={PADDING.left}
          y={PADDING.top}
          width={Math.max(1, width - PADDING.left - PADDING.right)}
          height={chart.innerHeight}
          fill="transparent"
          onMouseMove={(event) => {
            const bounds = event.currentTarget.getBoundingClientRect();
            const offsetX = event.clientX - bounds.left;
            const index = Math.round(offsetX / Math.max(chart.stepX, 1));
            setHover(Math.min(Math.max(index, 0), points.length - 1));
          }}
          onMouseLeave={() => setHover(null)}
        />
      </svg>

      {points.every((point) => point.visits === 0) ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="rounded-full border border-line bg-surface-2/85 px-3 py-1.5 text-xs text-muted backdrop-blur">
            No visits recorded in this period
          </span>
        </div>
      ) : null}

      {hoveredPoint && hover !== null ? (
        <div
          className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-lg border border-line-strong bg-surface-2/95 px-3 py-2 shadow-xl backdrop-blur"
          style={{ left: Math.min(Math.max(chart.x(hover), 70), width - 70) }}
        >
          <p className="text-[11px] font-medium text-muted">{hoveredPoint.label}</p>
          <p className="mt-0.5 text-sm font-semibold text-strong">
            {formatNumber(hoveredPoint.visits)} <span className="text-xs font-normal text-muted">visits</span>
          </p>
          <p className="text-[11px] text-accent-2">{formatNumber(hoveredPoint.visitors)} unique visitors</p>
        </div>
      ) : null}

      {totalVisits > 0 ? (
        <p className="mt-1 text-right text-[11px] text-faint">
          {formatNumber(totalVisits)} visits in view · times in UTC
        </p>
      ) : null}
        </>
      )}
    </div>
  );
}
