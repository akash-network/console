"use client";
import { useEffect, useRef, useState } from "react";
import type { IChartApi, ISeriesApi, Time, UTCTimestamp } from "lightweight-charts";
import { createChart } from "lightweight-charts";
import { useTheme } from "next-themes";

import type { SeriesPoint } from "@/lib/series/series";
import { formatLongDate, formatShortDate } from "@/lib/statsFormat/statsFormat";

const CHART_HEIGHT = 400;
const TOOLTIP_WIDTH = 140;
const TOOLTIP_OFFSET = 12;
const AXIS_FONT_FAMILY = "var(--font-geist-mono), monospace";

/** lightweight-charts paints on a canvas and cannot read the CSS color tokens, so these mirror them per theme. */
const CHART_COLORS = {
  dark: { text: "#666666", border: "#212121", crosshair: "#292929", line: "#f2f2f2", areaTop: "rgba(242, 242, 242, 0.08)" },
  light: { text: "#737373", border: "#e6e6e6", crosshair: "#d4d4d4", line: "#171717", areaTop: "rgba(23, 23, 23, 0.06)" }
};

type ActivePoint = { point: SeriesPoint; left: number };

export function ZoomableChart({
  series,
  rangedSeries,
  formatValue,
  formatAxisValue
}: {
  series: SeriesPoint[];
  rangedSeries: SeriesPoint[];
  formatValue: (value: number) => string;
  formatAxisValue: (value: number) => string;
}) {
  const { resolvedTheme } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const areaSeriesRef = useRef<ISeriesApi<"Area"> | null>(null);
  const formattersRef = useRef({ formatValue, formatAxisValue });
  const [activePoint, setActivePoint] = useState<ActivePoint | null>(null);
  formattersRef.current = { formatValue, formatAxisValue };

  useEffect(
    function createThemedChart() {
      if (!containerRef.current) return;

      const colors = resolvedTheme === "light" ? CHART_COLORS.light : CHART_COLORS.dark;
      const chart = createChart(containerRef.current, {
        autoSize: true,
        layout: { background: { color: "transparent" }, textColor: colors.text, fontFamily: AXIS_FONT_FAMILY, fontSize: 10, attributionLogo: false },
        grid: { vertLines: { visible: false }, horzLines: { color: colors.border } },
        rightPriceScale: { borderVisible: false, scaleMargins: { top: 0.08, bottom: 0.04 } },
        timeScale: { borderColor: colors.border, tickMarkFormatter: (time: Time) => formatShortDate(toMilliseconds(time)) },
        localization: { priceFormatter: (value: number) => formattersRef.current.formatAxisValue(value) },
        crosshair: {
          horzLine: { visible: false, labelVisible: false },
          vertLine: { color: colors.crosshair, width: 1, style: 0, labelVisible: false }
        }
      });
      const areaSeries = chart.addAreaSeries({
        lineColor: colors.line,
        lineWidth: 2,
        topColor: colors.areaTop,
        bottomColor: "transparent",
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerRadius: 3
      });

      chart.subscribeCrosshairMove(param => {
        const data = param.seriesData.get(areaSeries);

        if (!param.point || !param.time || !data || !("value" in data)) {
          setActivePoint(null);
          return;
        }

        setActivePoint({ point: { time: toMilliseconds(param.time), value: data.value }, left: tooltipLeft(param.point.x, chart.paneSize().width) });
      });

      chartRef.current = chart;
      areaSeriesRef.current = areaSeries;

      return function removeChart() {
        chartRef.current = null;
        areaSeriesRef.current = null;
        chart.remove();
      };
    },
    [resolvedTheme]
  );

  useEffect(
    function showSelectedRange() {
      const chart = chartRef.current;

      if (!chart || !areaSeriesRef.current) return;

      areaSeriesRef.current.setData(series.map(point => ({ time: toChartTime(point.time), value: point.value })));

      if (rangedSeries.length && rangedSeries.length < series.length) {
        chart.timeScale().setVisibleRange({ from: toChartTime(rangedSeries[0].time), to: toChartTime(rangedSeries[rangedSeries.length - 1].time) });
      } else {
        chart.timeScale().fitContent();
      }
    },
    [series, rangedSeries, resolvedTheme]
  );

  return (
    <div className="relative" style={{ height: CHART_HEIGHT }}>
      <span className="pointer-events-none absolute left-1/2 top-1 z-10 -translate-x-1/2 font-mono text-[11px] uppercase tracking-[0.08em] text-faint opacity-50">
        stats.akash.network
      </span>
      <div ref={containerRef} className="h-full w-full" />
      {series.length < 2 && <div className="absolute inset-0 animate-pulse rounded-md bg-nested" />}
      {activePoint && (
        <div
          className="pointer-events-none absolute top-3 z-20 whitespace-nowrap rounded-md border border-border-strong bg-popover px-2.5 py-2 shadow-[0_4px_32px_rgba(0,0,0,0.5)]"
          style={{ left: activePoint.left }}
        >
          <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.04em] text-muted-foreground">{formatLongDate(activePoint.point.time)}</div>
          <div className="font-mono text-sm font-medium text-foreground">{formatValue(activePoint.point.value)}</div>
        </div>
      )}
    </div>
  );
}

function tooltipLeft(x: number, paneWidth: number) {
  return x > paneWidth - TOOLTIP_WIDTH ? x - TOOLTIP_WIDTH : x + TOOLTIP_OFFSET;
}

function toChartTime(milliseconds: number) {
  return Math.floor(milliseconds / 1000) as UTCTimestamp;
}

function toMilliseconds(time: Time) {
  return (time as UTCTimestamp) * 1000;
}
