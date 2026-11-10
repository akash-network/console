"use client";
import { useEffect, useRef, useState } from "react";

import type { SeriesPoint } from "@/lib/series/series";
import { axisTicks, fitSeries, labelIndexes, nearestIndex } from "@/lib/series/series";
import { formatLongDate, formatShortDate } from "@/lib/statsFormat/statsFormat";

const CHART_PADDING = { top: 10, right: 60, bottom: 22, left: 8 };
const AXIS_LABEL_STYLE = { font: "400 10px var(--font-geist-mono), monospace" };
const TOOLTIP_WIDTH = 170;
const MIN_DATE_LABEL_SPACING = 90;
const Y_TICK_COUNT = 4;
const MAX_DATE_LABELS = 6;

type LineChartProps = {
  series: SeriesPoint[];
  minHeight: number;
  formatAxisValue: (value: number) => string;
  formatValue: (value: number) => string;
  latestPointLabel?: string;
};

export function LineChart({ series, minHeight, formatAxisValue, formatValue, latestPointLabel }: LineChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [measuredHeight, setMeasuredHeight] = useState(0);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  useEffect(function trackContainerSize() {
    const container = containerRef.current;

    if (!container) return;

    const observer = new ResizeObserver(([entry]) => {
      setWidth(Math.round(entry.contentRect.width));
      setMeasuredHeight(Math.round(entry.contentRect.height));
    });
    observer.observe(container);

    return function stopTracking() {
      observer.disconnect();
    };
  }, []);

  useEffect(
    function resetHoverOnNewSeries() {
      setHoverIndex(null);
    },
    [series]
  );

  const height = Math.max(minHeight, measuredHeight);
  const canDraw = width > 0 && series.length > 1;
  const fitted = canDraw ? fitSeries(series, width, height, CHART_PADDING) : undefined;
  const activeIndex = hoverIndex ?? series.length - 1;
  const activePoint = series[activeIndex];
  const gridRight = width - CHART_PADDING.right + 8;

  return (
    <div ref={containerRef} className="relative h-full w-full" style={{ minHeight }}>
      {fitted && activePoint && (
        <svg
          width={width}
          height={height}
          className="absolute inset-0 block cursor-crosshair"
          role="img"
          aria-label={`Latest value ${formatValue(series[series.length - 1].value)}`}
          onMouseMove={event => {
            const bounds = event.currentTarget.getBoundingClientRect();
            setHoverIndex(nearestIndex(event.clientX - bounds.left, width, CHART_PADDING, series.length));
          }}
          onMouseLeave={() => setHoverIndex(null)}
        >
          {axisTicks(fitted.min, fitted.max, Y_TICK_COUNT).map(tick => (
            <g key={tick}>
              <line x1={0} x2={gridRight} y1={fitted.yOf(tick)} y2={fitted.yOf(tick)} className="stroke-muted" strokeWidth={1} />
              <text x={gridRight + 6} y={fitted.yOf(tick) + 3} className="fill-faint" style={AXIS_LABEL_STYLE}>
                {formatAxisValue(tick)}
              </text>
            </g>
          ))}

          {labelIndexes(series.length, Math.max(2, Math.min(MAX_DATE_LABELS, Math.floor(width / MIN_DATE_LABEL_SPACING)))).map(index => (
            <text
              key={index}
              x={fitted.xOf(index)}
              y={height - 5}
              textAnchor={index === 0 ? "start" : "middle"}
              className="fill-faint"
              style={AXIS_LABEL_STYLE}
            >
              {formatShortDate(series[index].time)}
            </text>
          ))}

          <path d={fitted.area} className="fill-foreground/5" />
          <path d={fitted.line} fill="none" className="stroke-foreground" strokeWidth={1.6} strokeLinejoin="round" />

          {hoverIndex !== null && (
            <line
              x1={fitted.xOf(hoverIndex)}
              x2={fitted.xOf(hoverIndex)}
              y1={4}
              y2={height - CHART_PADDING.bottom + 4}
              className="stroke-border-strong"
              strokeWidth={1}
            />
          )}
          <circle cx={fitted.xOf(activeIndex)} cy={fitted.yOf(activePoint.value)} r={3} className="fill-foreground stroke-card" strokeWidth={2} />
        </svg>
      )}

      {!canDraw && <div className="absolute inset-0 animate-pulse rounded-md bg-nested" />}

      {fitted && hoverIndex !== null && activePoint && (
        <div
          className="pointer-events-none absolute top-3 rounded-md border border-border-strong bg-popover px-2.5 py-2 shadow-[0_4px_32px_rgba(0,0,0,0.5)]"
          style={{
            left: fitted.xOf(hoverIndex) > width - TOOLTIP_WIDTH - 20 ? fitted.xOf(hoverIndex) - TOOLTIP_WIDTH + 12 : fitted.xOf(hoverIndex) + 12,
            minWidth: TOOLTIP_WIDTH - 24
          }}
        >
          <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.04em] text-muted-foreground">
            {hoverIndex === series.length - 1 && latestPointLabel ? latestPointLabel : formatLongDate(activePoint.time)}
          </div>
          <div className="font-mono text-sm font-medium text-foreground">{formatValue(activePoint.value)}</div>
        </div>
      )}
    </div>
  );
}
