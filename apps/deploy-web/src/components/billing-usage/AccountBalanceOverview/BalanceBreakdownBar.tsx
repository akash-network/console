"use client";
import React from "react";
import { useIntl } from "react-intl";

import type { ReservedDeployment } from "./useAccountBalanceOverview";

export type BalanceSegment = {
  key: string;
  label: string;
  amountUsd: number;
  color: string;
  /** Hourly burn rate for this deployment; omitted for the Available segment. */
  perHourUsd?: number;
  /** Tinted pill background for the legend chip, following this segment's shade. */
  badgeBackground?: string;
  /** Readable solid text color for the legend chip. */
  badgeColor?: string;
};

/** Stepped opacity for the reserved ramp: largest deployment is the most opaque, tapering to 0.35. */
function reservedAlpha(index: number, count: number): number {
  if (count <= 1) return 0.9;
  return Number((0.9 - (index / (count - 1)) * 0.55).toFixed(3));
}

/** Legend chip background follows the segment's shade at a low, readable alpha (floored so faint steps stay visible). */
function badgeBackground(hue: string, alpha: number): string {
  return `hsl(${hue} / ${Number(Math.max(0.08, alpha * 0.2).toFixed(3))})`;
}

/**
 * Diagonal hatch overlaid on the Available segment to flag the auto-top-up trigger zone.
 * Stripes are the page background token at partial alpha, so the zone stays recognisably the Available
 * green, just lightened in light mode and darkened in dark mode. Full alpha reads as a separate white or
 * black band rather than a texture over the green.
 */
export const THRESHOLD_HATCH_BACKGROUND =
  "repeating-linear-gradient(45deg, transparent 0, transparent 3px, hsl(var(--background) / 0.62) 3px, hsl(var(--background) / 0.62) 6px)";

/** Miniature of the bar's top-up zone (background-colored hatch over the Available green) for legend use. */
export const ThresholdHatchSwatch: React.FunctionComponent = () => (
  <span
    className="h-3.5 w-3.5 shrink-0 rounded-[3px]"
    style={{ backgroundColor: "hsl(var(--success))", backgroundImage: THRESHOLD_HATCH_BACKGROUND }}
    aria-hidden
  />
);

/**
 * Positions the auto-top-up marker inside the Available segment: the hatch spans the first
 * min(threshold, available) dollars past the reserved/available boundary and the dashed line marks its
 * right edge. Percentages are relative to the segment so the marker stays glued to that boundary
 * regardless of the 2px gaps between segments.
 */
function buildThresholdMarker(threshold: number, available: number) {
  const markerAmount = Math.min(threshold, available);
  return {
    hatchWidthPct: (markerAmount / available) * 100,
    isClamped: available <= threshold
  };
}

/**
 * Builds the ordered segments for the balance bar and its legend so both share identical colors.
 * Reserved deployments use a single-hue ramp (sorted largest-first); Available is the success green.
 */
export function buildBalanceSegments(deployments: ReservedDeployment[], available: number): BalanceSegment[] {
  const fundedDeployments = deployments.filter(deployment => deployment.reservedUsd > 0);
  const reservedSegments = fundedDeployments.map((deployment, index) => {
    const alpha = reservedAlpha(index, fundedDeployments.length);
    return {
      key: deployment.dseq,
      label: deployment.name,
      amountUsd: deployment.reservedUsd,
      perHourUsd: deployment.perHourUsd,
      color: `hsl(var(--primary) / ${alpha})`,
      badgeBackground: badgeBackground("var(--primary)", alpha),
      badgeColor: "hsl(var(--primary))"
    };
  });

  const availableSegment = {
    key: "available",
    label: "Available",
    amountUsd: available,
    color: "hsl(var(--success))",
    badgeBackground: "hsl(var(--success) / 0.14)",
    badgeColor: "hsl(var(--success))"
  };

  return [...reservedSegments, availableSegment].filter(segment => segment.amountUsd > 0);
}

export const BalanceBreakdownBar: React.FunctionComponent<{
  segments: BalanceSegment[];
  hoveredKey?: string | null;
  onHover?: (key: string | null) => void;
  threshold?: number | null;
}> = ({ segments, hoveredKey = null, onHover, threshold = null }) => {
  const intl = useIntl();
  const formatUsd = (value: number) => intl.formatNumber(value, { style: "currency", currency: "USD" });
  const label = segments.map(segment => `${segment.label} ${formatUsd(segment.amountUsd)}`).join(", ");
  const available = segments.find(segment => segment.key === "available")?.amountUsd ?? 0;
  const marker = threshold !== null && threshold > 0 && available > 0 ? buildThresholdMarker(threshold, available) : null;

  return (
    <div className="flex h-3 w-full gap-[2px] overflow-hidden rounded-full" role="img" aria-label={`Balance breakdown: ${label}`}>
      {segments.map(segment => (
        <div
          key={segment.key}
          className="relative h-full min-w-[3px] transition-opacity duration-150"
          style={{
            flexGrow: segment.amountUsd,
            flexBasis: 0,
            backgroundColor: segment.color,
            opacity: hoveredKey && hoveredKey !== segment.key ? 0.35 : 1
          }}
          title={`${segment.label}: ${formatUsd(segment.amountUsd)}`}
          onMouseEnter={() => onHover?.(segment.key)}
          onMouseLeave={() => onHover?.(null)}
        >
          {segment.key === "available" && marker && (
            <>
              <div
                className="pointer-events-none absolute inset-y-0 left-0"
                style={{ width: `${marker.hatchWidthPct}%`, backgroundImage: THRESHOLD_HATCH_BACKGROUND }}
                data-testid="balance-threshold-hatch"
                aria-hidden
              />
              {!marker.isClamped && (
                <div
                  className="pointer-events-none absolute inset-y-0 border-l-2 border-dashed border-foreground"
                  style={{ left: `${marker.hatchWidthPct}%` }}
                  data-testid="balance-threshold-line"
                  aria-hidden
                />
              )}
            </>
          )}
        </div>
      ))}
    </div>
  );
};
