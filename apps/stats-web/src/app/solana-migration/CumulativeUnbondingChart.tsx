"use client";
import { useEffect, useRef, useState } from "react";

import type { CumulativeSeriesKey, CumulativeUnbondingPoint, FittedCumulativePoint } from "./cumulativeUnbondingModel";
import { CUMULATIVE_SERIES, fitCumulativeLines } from "./cumulativeUnbondingModel";
import type { MigrationMilestoneMarker } from "./migrationMilestonesModel";
import { placeMilestoneMarkers, slotIndexAt } from "./unbondingMomentumModel";

import { labelIndexes } from "@/lib/series/series";
import { formatCompact, formatLongDate, formatNumber, formatShortDate } from "@/lib/statsFormat/statsFormat";
import { cn } from "@/lib/utils";

const CHART_HEIGHT = 260;
const CHART_PADDING = { top: 12, right: 56, bottom: 22, left: 4 };
const AXIS_LABEL_STYLE = { font: "400 10px var(--font-geist-mono), monospace" };
const MIN_DATE_LABEL_SPACING = 90;
const MAX_DATE_LABELS = 7;
const MIN_TOOLTIP_WIDTH = 236;
const TOOLTIP_GAP = 8;
const MARKER_LABEL_LINE_HEIGHT = 12;

export const CUMULATIVE_SERIES_STYLES: Record<CumulativeSeriesKey, { stroke: string; swatch: string }> = {
  startedAkt: { stroke: "stroke-[#2a78d6] dark:stroke-[#3987e5]", swatch: "bg-[#2a78d6] dark:bg-[#3987e5]" },
  liquidAkt: { stroke: "stroke-[#1baf7a] dark:stroke-[#199e70]", swatch: "bg-[#1baf7a] dark:bg-[#199e70]" },
  sentAkt: { stroke: "stroke-[#eb6834] dark:stroke-[#d95926]", swatch: "bg-[#eb6834] dark:bg-[#d95926]" },
  sentByUnstakersAkt: { stroke: "stroke-[#eda100] dark:stroke-[#c98500]", swatch: "bg-[#eda100] dark:bg-[#c98500]" }
};

export function CumulativeUnbondingChart({ points, markers }: { points: CumulativeUnbondingPoint[]; markers: MigrationMilestoneMarker[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  useEffect(function trackContainerWidth() {
    const container = containerRef.current;

    if (!container) return;

    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    observer.observe(container);

    return function stopTracking() {
      observer.disconnect();
    };
  }, []);

  const fitted = width > 0 ? fitCumulativeLines(points, width, CHART_HEIGHT, CHART_PADDING) : undefined;
  const hovered = fitted && hoverIndex !== null ? fitted.points[hoverIndex] : undefined;
  const firstUpcoming = fitted?.points.find((point, index) => point.isUpcoming && index > 0);
  const placedMarkers = fitted ? placeMilestoneMarkers(markers, fitted.points) : [];
  const gridRight = width - CHART_PADDING.right + 8;

  return (
    <div ref={containerRef} className="relative w-full" style={{ height: CHART_HEIGHT }}>
      {fitted && (
        <svg
          width={width}
          height={CHART_HEIGHT}
          className="absolute inset-0 block"
          aria-hidden
          onMouseMove={event => {
            const bounds = event.currentTarget.getBoundingClientRect();
            setHoverIndex(slotIndexAt(event.clientX - bounds.left, width, CHART_PADDING, points.length));
          }}
          onMouseLeave={() => setHoverIndex(null)}
        >
          {fitted.ticks.map(tick => (
            <g key={tick}>
              <line x1={0} x2={gridRight} y1={fitted.yOf(tick)} y2={fitted.yOf(tick)} className="stroke-muted" strokeWidth={1} />
              <text x={gridRight + 6} y={fitted.yOf(tick) + 3} className="fill-faint" style={AXIS_LABEL_STYLE}>
                {formatCompact(tick)}
              </text>
            </g>
          ))}

          {labelIndexes(points.length, Math.max(2, Math.min(MAX_DATE_LABELS, Math.floor(width / MIN_DATE_LABEL_SPACING)))).map(index => (
            <text
              key={index}
              x={fitted.points[index].x}
              y={CHART_HEIGHT - 5}
              textAnchor={index === 0 ? "start" : "middle"}
              className="fill-faint"
              style={AXIS_LABEL_STYLE}
            >
              {formatShortDate(points[index].time)}
            </text>
          ))}

          {firstUpcoming && (
            <g>
              <rect
                x={firstUpcoming.slotX}
                y={CHART_PADDING.top}
                width={gridRight - firstUpcoming.slotX}
                height={fitted.baseline - CHART_PADDING.top}
                className="fill-muted/40"
              />
              <text x={gridRight - 4} y={CHART_PADDING.top + 8} textAnchor="end" className="fill-faint" style={AXIS_LABEL_STYLE}>
                SCHEDULED
              </text>
            </g>
          )}

          {placedMarkers.map(marker => (
            <g key={marker.label}>
              <line
                x1={marker.x}
                x2={marker.x}
                y1={CHART_PADDING.top}
                y2={fitted.baseline}
                className="stroke-akash"
                strokeOpacity={0.7}
                strokeWidth={1}
                strokeDasharray="2 3"
              />
              <text
                x={marker.x + 4}
                y={CHART_PADDING.top + 8 + marker.row * MARKER_LABEL_LINE_HEIGHT}
                className="fill-muted-foreground"
                style={AXIS_LABEL_STYLE}
              >
                {marker.label.toUpperCase()}
              </text>
            </g>
          ))}

          {hovered && <line x1={hovered.x} x2={hovered.x} y1={CHART_PADDING.top} y2={fitted.baseline} className="stroke-border-strong" strokeWidth={1} />}

          <path d={fitted.paths.upcomingLiquidAkt} fill="none" className={CUMULATIVE_SERIES_STYLES.liquidAkt.stroke} strokeWidth={2} strokeDasharray="5 4" />
          {CUMULATIVE_SERIES.map(series => (
            <path
              key={series.key}
              d={fitted.paths[series.key]}
              fill="none"
              className={CUMULATIVE_SERIES_STYLES[series.key].stroke}
              strokeWidth={2}
              strokeLinejoin="round"
            />
          ))}
        </svg>
      )}

      {fitted && hovered && <CumulativeTooltip point={hovered} width={width} />}
      <CumulativeTable points={points} />
    </div>
  );
}

function CumulativeTooltip({ point, width }: { point: FittedCumulativePoint; width: number }) {
  const opensLeft = point.x > width / 2;

  return (
    <div
      className={cn(
        "pointer-events-none absolute top-3 w-max rounded-md border border-border-strong bg-popover px-2.5 py-2 shadow-[0_4px_32px_rgba(0,0,0,0.5)]",
        opensLeft && "-translate-x-full"
      )}
      style={{ left: opensLeft ? point.x - TOOLTIP_GAP : point.x + TOOLTIP_GAP, minWidth: MIN_TOOLTIP_WIDTH }}
    >
      <div className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.04em] text-muted-foreground">
        {formatLongDate(point.time)}
        {point.isUpcoming && " · scheduled"}
      </div>
      {CUMULATIVE_SERIES.filter(series => point[series.key] !== null).map(series => (
        <div key={series.key} className="flex items-center justify-between gap-3 text-xs">
          <span className="flex items-center gap-1.5 whitespace-nowrap text-muted-foreground">
            <span className={cn("h-2 w-2 rounded-sm", CUMULATIVE_SERIES_STYLES[series.key].swatch)} aria-hidden />
            {series.label}
          </span>
          <span className="whitespace-nowrap font-mono font-medium tabular-nums text-foreground">{formatNumber(point[series.key] ?? undefined)} AKT</span>
        </div>
      ))}
    </div>
  );
}

function CumulativeTable({ points }: { points: CumulativeUnbondingPoint[] }) {
  return (
    <div className="sr-only">
      <table>
        <caption>Cumulative AKT unbonding and sent to Solana</caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            {CUMULATIVE_SERIES.map(series => (
              <th key={series.key} scope="col">
                {series.label} (AKT)
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {points.map(point => (
            <tr key={point.date}>
              <th scope="row">{point.date}</th>
              {CUMULATIVE_SERIES.map(series => (
                <td key={series.key}>{formatNumber(point[series.key] ?? undefined)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
