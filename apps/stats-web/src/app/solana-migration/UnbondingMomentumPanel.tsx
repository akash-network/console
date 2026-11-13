"use client";
import { useEffect, useRef, useState } from "react";

import type { FittedUnbondingBar, UnbondingBar, UnbondingView } from "./unbondingMomentumModel";
import { fitUnbondingBars, slotIndexAt, toUnbondingBars, UNBONDING_VIEWS } from "./unbondingMomentumModel";

import { LoadError, Panel, PanelTitle } from "@/components/stats/Panel";
import { SegmentedTabs } from "@/components/stats/Toggles";
import { labelIndexes } from "@/lib/series/series";
import { formatCompact, formatLongDate, formatNumber, formatShortDate } from "@/lib/statsFormat/statsFormat";
import { cn } from "@/lib/utils";
import type { SinkUnbondings } from "@/types";

const CHART_HEIGHT = 260;
const CHART_PADDING = { top: 12, right: 56, bottom: 22, left: 4 };
const AXIS_LABEL_STYLE = { font: "400 10px var(--font-geist-mono), monospace" };
const TOOLTIP_WIDTH = 260;
const MIN_DATE_LABEL_SPACING = 90;
const MAX_DATE_LABELS = 7;
const MAX_BAR_RADIUS = 2;

const UNBONDING_FILL = "fill-[#2a78d6] dark:fill-[#3987e5]";
const UNBONDING_SWATCH = "bg-[#2a78d6] dark:bg-[#3987e5]";
const SENT_FILL = "fill-[#eb6834] dark:fill-[#d95926]";
const SENT_SWATCH = "bg-[#eb6834] dark:bg-[#d95926]";

export function UnbondingMomentumPanel({
  data,
  isError,
  onRetry,
  now,
  className
}: {
  data: SinkUnbondings | undefined;
  isError: boolean;
  onRetry: () => void;
  now: number;
  className?: string;
}) {
  const [view, setView] = useState<UnbondingView>("liquid");
  const bars = data && toUnbondingBars(data.daily, view, now);
  const seriesLabel = UNBONDING_VIEWS.find(option => option.value === view)?.seriesLabel ?? "";

  return (
    <Panel className={cn("flex flex-col gap-3 px-5 py-5 sm:px-6", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <PanelTitle>Unstaking vs AKT sent to Solana</PanelTitle>
          <span className="text-xs text-muted-foreground">Daily AKT, UTC. Unbonding takes 21 days before AKT can be sent.</span>
        </div>
        <SegmentedTabs<UnbondingView> options={UNBONDING_VIEWS} value={view} onChange={setView} label="Unbonding series" />
      </div>

      <div className="flex flex-wrap gap-4">
        <LegendItem swatchClassName={UNBONDING_SWATCH} label={seriesLabel} />
        <LegendItem swatchClassName={SENT_SWATCH} label="Sent to Solana" />
      </div>

      {!bars &&
        (isError ? (
          <LoadError subject="the unbondings" onRetry={onRetry} />
        ) : (
          <div className="animate-pulse rounded-md bg-nested" style={{ height: CHART_HEIGHT }} />
        ))}
      {bars?.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">No unbondings yet.</p>}
      {!!bars?.length && (
        <>
          <UnbondingBarChart bars={bars} seriesLabel={seriesLabel} now={now} />
          <UnbondingTable bars={bars} seriesLabel={seriesLabel} />
        </>
      )}
    </Panel>
  );
}

function LegendItem({ swatchClassName, label }: { swatchClassName: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className={cn("h-2.5 w-2.5 rounded-sm", swatchClassName)} aria-hidden />
      {label}
    </span>
  );
}

function UnbondingBarChart({ bars, seriesLabel, now }: { bars: UnbondingBar[]; seriesLabel: string; now: number }) {
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

  const fitted = width > 0 ? fitUnbondingBars(bars, width, CHART_HEIGHT, CHART_PADDING) : undefined;
  const hovered = fitted && hoverIndex !== null ? fitted.bars[hoverIndex] : undefined;
  const firstUpcomingBar = fitted?.bars.find((bar, index) => bar.isUpcoming && index > 0);
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
            setHoverIndex(slotIndexAt(event.clientX - bounds.left, width, CHART_PADDING, bars.length));
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

          {labelIndexes(bars.length, Math.max(2, Math.min(MAX_DATE_LABELS, Math.floor(width / MIN_DATE_LABEL_SPACING)))).map(index => (
            <text
              key={index}
              x={fitted.bars[index].slotX + fitted.bars[index].slotWidth / 2}
              y={CHART_HEIGHT - 5}
              textAnchor={index === 0 ? "start" : "middle"}
              className="fill-faint"
              style={AXIS_LABEL_STYLE}
            >
              {formatShortDate(bars[index].time)}
            </text>
          ))}

          {hovered && (
            <rect x={hovered.slotX} y={CHART_PADDING.top} width={hovered.slotWidth} height={fitted.baseline - CHART_PADDING.top} className="fill-muted/60" />
          )}

          {firstUpcomingBar && (
            <g>
              <line
                x1={firstUpcomingBar.slotX}
                x2={firstUpcomingBar.slotX}
                y1={CHART_PADDING.top}
                y2={fitted.baseline}
                className="stroke-border-strong"
                strokeWidth={1}
                strokeDasharray="3 3"
              />
              <text x={firstUpcomingBar.slotX + 4} y={CHART_PADDING.top + 8} className="fill-faint" style={AXIS_LABEL_STYLE}>
                UPCOMING
              </text>
            </g>
          )}

          {fitted.bars.map(bar => (
            <g key={bar.date}>
              <path d={topRoundedBar(bar.unbondingX, bar.unbondingY, bar.barWidth, fitted.baseline)} className={UNBONDING_FILL} />
              <path d={topRoundedBar(bar.sentX, bar.sentY, bar.barWidth, fitted.baseline)} className={SENT_FILL} />
            </g>
          ))}
        </svg>
      )}

      {fitted && hovered && <UnbondingTooltip bar={hovered} width={width} seriesLabel={seriesLabel} now={now} />}
    </div>
  );
}

function UnbondingTooltip({ bar, width, seriesLabel, now }: { bar: FittedUnbondingBar; width: number; seriesLabel: string; now: number }) {
  const anchorX = bar.slotX + bar.slotWidth;
  const isToday = !bar.isUpcoming && now - bar.time < 24 * 60 * 60 * 1000;

  return (
    <div
      className="pointer-events-none absolute top-3 rounded-md border border-border-strong bg-popover px-2.5 py-2 shadow-[0_4px_32px_rgba(0,0,0,0.5)]"
      style={{ left: anchorX > width - TOOLTIP_WIDTH - 20 ? bar.slotX - TOOLTIP_WIDTH + 12 : anchorX + 8, width: TOOLTIP_WIDTH - 24 }}
    >
      <div className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.04em] text-muted-foreground">
        {formatLongDate(bar.time)}
        {isToday && " · today"}
        {bar.isUpcoming && " · upcoming"}
      </div>
      <TooltipRow swatchClassName={UNBONDING_SWATCH} label={seriesLabel} akt={bar.unbondingAkt} />
      <TooltipRow swatchClassName={SENT_SWATCH} label="Sent to Solana" akt={bar.sentAkt} />
      {bar.sentAkt > 0 && <div className="pl-4 pt-0.5 text-[11px] text-muted-foreground">{formatNumber(bar.sentByUnstakersAkt)} AKT by unstakers</div>}
    </div>
  );
}

function TooltipRow({ swatchClassName, label, akt }: { swatchClassName: string; label: string; akt: number }) {
  return (
    <div className="flex items-center justify-between gap-3 text-xs">
      <span className="flex items-center gap-1.5 whitespace-nowrap text-muted-foreground">
        <span className={cn("h-2 w-2 rounded-sm", swatchClassName)} aria-hidden />
        {label}
      </span>
      <span className="whitespace-nowrap font-mono font-medium tabular-nums text-foreground">{formatNumber(akt)} AKT</span>
    </div>
  );
}

function UnbondingTable({ bars, seriesLabel }: { bars: UnbondingBar[]; seriesLabel: string }) {
  return (
    <table className="sr-only">
      <caption>Daily AKT unbonding and sent to Solana</caption>
      <thead>
        <tr>
          <th scope="col">Date</th>
          <th scope="col">{seriesLabel} (AKT)</th>
          <th scope="col">Sent to Solana (AKT)</th>
          <th scope="col">Sent by unstakers (AKT)</th>
        </tr>
      </thead>
      <tbody>
        {bars.map(bar => (
          <tr key={bar.date}>
            <th scope="row">{bar.date}</th>
            <td>{formatNumber(bar.unbondingAkt)}</td>
            <td>{formatNumber(bar.sentAkt)}</td>
            <td>{formatNumber(bar.sentByUnstakersAkt)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function topRoundedBar(x: number, y: number, width: number, baseline: number) {
  const height = baseline - y;
  if (height <= 0) return "";

  const radius = Math.min(MAX_BAR_RADIUS, width / 2, height);

  return `M${x} ${baseline}V${y + radius}Q${x} ${y} ${x + radius} ${y}H${x + width - radius}Q${x + width} ${y} ${x + width} ${y + radius}V${baseline}Z`;
}
