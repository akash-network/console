"use client";
import React from "react";
import { Flash } from "iconoir-react";

import { useCurrencyFormatter } from "@src/hooks/useCurrencyFormatter/useCurrencyFormatter";
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

/** Diagonal hatch overlaid on the available bar to flag the auto-top-up trigger zone; theme-aware via the foreground token. */
const HATCH_BACKGROUND =
  "repeating-linear-gradient(45deg, transparent 0, transparent 3px, hsl(var(--foreground) / 0.28) 3px, hsl(var(--foreground) / 0.28) 6px)";

/** Positions the auto-top-up marker as the far-right slice of the bar: the dotted line is its left edge, the hatch is the slice itself. */
function buildThresholdMarker(threshold: number, available: number, total: number) {
  const markerAmount = Math.min(threshold, available);
  return {
    threshold,
    hatchWidthPct: (markerAmount / total) * 100,
    linePositionPct: ((total - markerAmount) / total) * 100
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
  const formatUsd = useCurrencyFormatter();
  const label = segments.map(segment => `${segment.label} ${formatUsd(segment.amountUsd)}`).join(", ");
  const total = segments.reduce((sum, segment) => sum + segment.amountUsd, 0);
  const available = segments.find(segment => segment.key === "available")?.amountUsd ?? 0;
  const marker = threshold !== null && threshold > 0 && available > 0 && total > 0 ? buildThresholdMarker(threshold, available, total) : null;

  return (
    <div className="space-y-1">
      <div className="relative">
        <div className="relative flex h-3 w-full gap-[2px] overflow-hidden rounded-full" role="img" aria-label={`Balance breakdown: ${label}`}>
          {segments.map(segment => (
            <div
              key={segment.key}
              className="h-full min-w-[3px] transition-opacity duration-150"
              style={{
                flexGrow: segment.amountUsd,
                flexBasis: 0,
                backgroundColor: segment.color,
                opacity: hoveredKey && hoveredKey !== segment.key ? 0.35 : 1
              }}
              title={`${segment.label}: ${formatUsd(segment.amountUsd)}`}
              onMouseEnter={() => onHover?.(segment.key)}
              onMouseLeave={() => onHover?.(null)}
            />
          ))}
          {marker && (
            <div
              className="pointer-events-none absolute inset-y-0 right-0"
              style={{ width: `${marker.hatchWidthPct}%`, backgroundImage: HATCH_BACKGROUND }}
              data-testid="balance-threshold-hatch"
              aria-hidden
            />
          )}
        </div>
        {marker && (
          <div
            className="pointer-events-none absolute inset-y-[-2px] border-l-2 border-dashed border-foreground"
            style={{ left: `${marker.linePositionPct}%` }}
            data-testid="balance-threshold-line"
            aria-hidden
          />
        )}
      </div>
      {marker && (
        <p className="flex items-center justify-end gap-1 text-xs text-muted-foreground">
          <Flash className="h-3 w-3" aria-hidden />
          <span>
            Tops up at <span className="font-medium text-foreground">{formatUsd(marker.threshold)}</span>
          </span>
        </p>
      )}
    </div>
  );
};
