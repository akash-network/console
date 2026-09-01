"use client";
import React from "react";
import { useIntl } from "react-intl";
import { Flash } from "iconoir-react";

import type { EscrowedDeployment } from "./useAccountBalanceOverview";

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

/** Stepped opacity for the escrow ramp: largest deployment is the most opaque, tapering to 0.35. */
function escrowAlpha(index: number, count: number): number {
  if (count <= 1) return 0.9;
  return Number((0.9 - (index / (count - 1)) * 0.55).toFixed(3));
}

/** Legend chip background follows the segment's shade at a low, readable alpha (floored so faint steps stay visible). */
function badgeBackground(hue: string, alpha: number): string {
  return `hsl(${hue} / ${Number(Math.max(0.08, alpha * 0.2).toFixed(3))})`;
}

/**
 * Vertical dashes for the threshold line: a 4px mark every 7px, so each mark stays taller than the line
 * is wide and reads as a dash rather than a dot. Drawn as a gradient because `border-dashed` hands the
 * dash length and spacing to the browser with no way to tune them.
 */
const THRESHOLD_LINE_DASHES = "repeating-linear-gradient(to bottom, hsl(var(--foreground)) 0 4px, transparent 4px 7px)";

/**
 * Where the auto-top-up marker sits inside the Available segment: the dashed line lands `threshold`
 * dollars past the escrow/available boundary, which is where the bar's right edge will be once the
 * balance has drained far enough to trigger a top-up. Expressed as a percentage of the segment so it
 * stays glued to that boundary regardless of the 2px gaps between segments. Null once available is at or
 * below the threshold, where the line would fall on the segment's own right edge and read as noise.
 */
function buildThresholdMarker(threshold: number, available: number) {
  if (available <= threshold) return null;
  return { positionPct: (threshold / available) * 100, amountUsd: threshold };
}

/**
 * Builds the ordered segments for the balance bar and its legend so both share identical colors.
 * Escrowed deployments use a single-hue ramp (sorted largest-first); Available is the success green.
 */
export function buildBalanceSegments(deployments: EscrowedDeployment[], available: number): BalanceSegment[] {
  const fundedDeployments = deployments.filter(deployment => deployment.escrowUsd > 0);
  const escrowSegments = fundedDeployments.map((deployment, index) => {
    const alpha = escrowAlpha(index, fundedDeployments.length);
    return {
      key: deployment.dseq,
      label: deployment.name,
      amountUsd: deployment.escrowUsd,
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

  return [...escrowSegments, availableSegment].filter(segment => segment.amountUsd > 0);
}

/**
 * The dashed threshold marker deliberately overflows the bar vertically and captions itself underneath,
 * so the bar cannot clip its own children: the rounded pill shape comes from rounding the end segments
 * rather than an `overflow-hidden` container, and the wrapper reserves the caption's height with padding
 * because the caption is positioned out of flow.
 */
export const BalanceBreakdownBar: React.FunctionComponent<{
  segments: BalanceSegment[];
  hoveredKey?: string | null;
  onHover?: (key: string | null) => void;
  threshold?: number | null;
  /** Hides the "Tops up at $X" caption for hosts that explain the threshold in their own copy. */
  hideThresholdCaption?: boolean;
}> = ({ segments, hoveredKey = null, onHover, threshold = null, hideThresholdCaption = false }) => {
  const intl = useIntl();
  const formatUsd = (value: number) => intl.formatNumber(value, { style: "currency", currency: "USD" });
  const label = segments.map(segment => `${segment.label} ${formatUsd(segment.amountUsd)}`).join(", ");
  const available = segments.find(segment => segment.key === "available")?.amountUsd ?? 0;
  const marker = threshold !== null && threshold > 0 && available > 0 ? buildThresholdMarker(threshold, available) : null;

  return (
    <div className={marker === null || hideThresholdCaption ? undefined : "pb-6"}>
      <div className="flex h-3 w-full gap-[2px]" role="img" aria-label={`Balance breakdown: ${label}`}>
        {segments.map(segment => (
          <div
            key={segment.key}
            className="relative h-full min-w-[3px] transition-opacity duration-150 first:rounded-l-full last:rounded-r-full"
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
                  className="pointer-events-none absolute -inset-y-1.5 w-[3px] -translate-x-1/2"
                  style={{ left: `${marker.positionPct}%`, backgroundImage: THRESHOLD_LINE_DASHES }}
                  data-testid="balance-threshold-line"
                  aria-hidden
                />
                {!hideThresholdCaption && (
                  <div
                    className="pointer-events-none absolute top-full mt-2 flex -translate-x-1/2 items-center gap-1 whitespace-nowrap text-xs text-muted-foreground"
                    style={{ left: `${marker.positionPct}%` }}
                    data-testid="balance-threshold-caption"
                  >
                    <Flash className="h-3 w-3 shrink-0" />
                    <span>
                      Tops up at <span className="font-medium text-foreground">{formatUsd(marker.amountUsd)}</span>
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
