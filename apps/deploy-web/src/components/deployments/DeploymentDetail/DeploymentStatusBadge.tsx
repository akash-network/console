"use client";
import type { FC } from "react";
import { cn } from "@akashnetwork/ui/utils";

import type { LeaseDto } from "@src/types/deployment";
import { isLeaseLive } from "@src/utils/leaseUtils";
import { classifyLeaseCloseReason, getClosedLeaseLabel, isProviderReclaimed } from "@src/utils/reclamationUtils";

type StatusTone = "running" | "pending" | "warning" | "closed";

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
  warning: "bg-warning/10 text-warning",
  closed: "bg-destructive/10 text-destructive"
};

const DOT_TONE_CLASS: Record<StatusTone, string> = {
  running: "bg-emerald-500",
  pending: "bg-amber-500",
  warning: "bg-warning",
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
 * reclamation banner and deployment list show. A dead lease under a deployment that is still open reads as a
 * warning rather than destructive: the escrow is live and a redeploy brings the workload back, so the red
 * tone is kept for a deployment that is itself closed.
 */
export function getDeploymentStatus(state: string, leases?: LeaseDto[] | null): { label: string; tone: StatusTone } {
  const deploymentTone = STATUS_TONES[state] ?? "pending";
  const deadLease = leases?.length && !leases.some(isLeaseLive) ? selectLeaseToReportOn(leases) : undefined;
  if (!deadLease) return { label: STATUS_LABELS[state] ?? state, tone: deploymentTone };

  return { label: getClosedLeaseLabel(deadLease), tone: deploymentTone === "closed" ? "closed" : "warning" };
}

/**
 * Which of several closed leases the badge speaks for. A provider close wins over a tenant close: it is the
 * one the owner did not ask for and can act on by redeploying, and picking it keeps the label stable instead
 * of following whatever order the lease list arrived in.
 */
function selectLeaseToReportOn(leases: LeaseDto[]): LeaseDto {
  const closedByProvider = leases.find(
    lease => classifyLeaseCloseReason(lease.reason ?? lease.reclamation?.reason) === "provider" || isProviderReclaimed(lease)
  );
  return closedByProvider ?? leases[0];
}

export const DeploymentStatusBadge: FC<DeploymentStatusBadgeProps> = ({ state, leases, className }) => {
  const { label, tone } = getDeploymentStatus(state, leases);

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
