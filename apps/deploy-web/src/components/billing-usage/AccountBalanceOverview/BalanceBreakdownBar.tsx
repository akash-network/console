"use client";
import React from "react";

import type { ReservedDeployment } from "./useAccountBalanceOverview";

export type BalanceSegment = {
  key: string;
  label: string;
  amountUsd: number;
  color: string;
};

const usdFormatter = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

/** Stepped opacity for the reserved ramp: largest deployment is the most opaque, tapering to 0.35. */
function reservedAlpha(index: number, count: number): number {
  if (count <= 1) return 0.9;
  return Number((0.9 - (index / (count - 1)) * 0.55).toFixed(3));
}

/**
 * Builds the ordered segments for the balance bar and its legend so both share identical colors.
 * Reserved deployments use a single-hue ramp (sorted largest-first); Available is the success green.
 */
export function buildBalanceSegments(deployments: ReservedDeployment[], available: number): BalanceSegment[] {
  const reservedSegments = deployments.map((deployment, index) => ({
    key: deployment.dseq,
    label: deployment.name,
    amountUsd: deployment.reservedUsd,
    color: `hsl(var(--primary) / ${reservedAlpha(index, deployments.length)})`
  }));

  return [...reservedSegments, { key: "available", label: "Available", amountUsd: available, color: "hsl(var(--success))" }].filter(
    segment => segment.amountUsd > 0
  );
}

export const BalanceBreakdownBar: React.FunctionComponent<{ segments: BalanceSegment[] }> = ({ segments }) => {
  const label = segments.map(segment => `${segment.label} ${usdFormatter.format(segment.amountUsd)}`).join(", ");

  return (
    <div className="flex h-3 w-full gap-[2px] overflow-hidden rounded-full" role="img" aria-label={`Balance breakdown: ${label}`}>
      {segments.map(segment => (
        <div
          key={segment.key}
          className="h-full min-w-[3px]"
          style={{ flexGrow: segment.amountUsd, flexBasis: 0, backgroundColor: segment.color }}
          title={`${segment.label}: ${usdFormatter.format(segment.amountUsd)}`}
        />
      ))}
    </div>
  );
};
