"use client";
import type { FC } from "react";
import { cn } from "@akashnetwork/ui/utils";

import type { LeaseDto } from "@src/types/deployment";
import { isLeaseLive } from "@src/utils/leaseUtils";
import { getClosedLeaseLabel } from "@src/utils/reclamationUtils";

type StatusTone = "running" | "pending" | "closed";

const STATUS_LABELS: Record<string, string> = {
  active: "Running",
  closed: "Closed"
};

const STATUS_TONES: Record<string, StatusTone> = {
  active: "running",
  closed: "closed"
};

const BADGE_TONE_CLASS: Record<StatusTone, string> = {
  running: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  pending: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  closed: "bg-destructive/10 text-destructive"
};

const DOT_TONE_CLASS: Record<StatusTone, string> = {
  running: "bg-emerald-500",
  pending: "bg-amber-500",
  closed: "bg-destructive"
};

export interface DeploymentStatusBadgeProps {
  state: string;
  leases?: LeaseDto[] | null;
  className?: string;
}

/**
 * A deployment stays `active` on chain after its last lease dies — closed by the provider, reclaimed, or out
 * of funds — so the chain state alone would keep claiming "Running" over a workload that is long gone. When
 * no lease is live, the badge speaks for the lease instead, reusing the same close-reason copy the
 * reclamation banner and deployment list show.
 */
export const DeploymentStatusBadge: FC<DeploymentStatusBadgeProps> = ({ state, leases, className }) => {
  const deadLease = leases?.length && !leases.some(isLeaseLive) ? leases[0] : undefined;
  const tone = deadLease ? "closed" : STATUS_TONES[state] ?? "pending";
  const label = deadLease ? getClosedLeaseLabel(deadLease) : STATUS_LABELS[state] ?? state;

  return (
    <span className={cn("inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-medium", BADGE_TONE_CLASS[tone], className)}>
      <span className="relative flex h-2 w-2">
        {tone === "running" && <span className={cn("absolute inline-flex h-full w-full animate-ping rounded-full opacity-75", DOT_TONE_CLASS[tone])} />}
        <span className={cn("relative inline-flex h-2 w-2 rounded-full", DOT_TONE_CLASS[tone])} />
      </span>
      {label}
    </span>
  );
};
