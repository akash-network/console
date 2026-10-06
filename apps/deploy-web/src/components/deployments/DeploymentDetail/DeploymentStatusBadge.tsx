"use client";
import type { FC } from "react";
import { CustomTooltip } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";

import type { LeaseDto } from "@src/types/deployment";
import { isLeaseLive } from "@src/utils/leaseUtils";
import { classifyLeaseCloseReason, getClosedLeaseLabel, getClosedLeaseSummaryLabel, isProviderReclaimed, isReclaiming } from "@src/utils/reclamationUtils";
import { ReclamationCountdown } from "./ReclamationCountdown";

export type StatusTone = "running" | "pending" | "loading" | "warning" | "closed";

export const DEPENDENCIES = {
  CustomTooltip,
  ReclamationCountdown
};

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
  loading: "bg-muted text-muted-foreground",
  warning: "bg-warning/10 text-warning",
  closed: "bg-muted text-muted-foreground"
};

const DOT_TONE_CLASS: Record<StatusTone, string> = {
  running: "bg-emerald-500",
  pending: "bg-amber-500",
  loading: "bg-muted-foreground",
  warning: "bg-warning",
  closed: "bg-muted-foreground"
};

export interface DeploymentStatusBadgeProps {
  state: string;
  leases?: LeaseDto[] | null;
  isSummarized?: boolean;
  isClosing?: boolean;
  className?: string;
  dependencies?: typeof DEPENDENCIES;
}

const CLOSING_STATUS = { label: "Closing", summaryLabel: "Closing", tone: "loading" } as const;

/**
 * A deployment stays `active` on chain after its last lease dies — closed by the provider, reclaimed, or out
 * of funds — so the chain state alone would keep claiming "Running" over a workload that is long gone. When
 * no lease is live, the badge speaks for the lease instead, reusing the same close-reason copy the
 * reclamation banner and deployment list show. A dead lease under a deployment that is still open reads as a
 * warning: the escrow is live and a redeploy brings the workload back, while a deployment that is itself
 * closed has nothing left to act on and reads as muted. A lease inside its reclamation grace period is live
 * but doomed, so it reads as "Reclaiming" rather than "Running". A close running in the background reads as
 * "Closing" until the chain reports the deployment closed, which can land a poll before the feed says so.
 */
export function getDeploymentStatus(state: string, leases?: LeaseDto[] | null, isClosing = false): { label: string; summaryLabel: string; tone: StatusTone } {
  if (isClosing && state === "active") return CLOSING_STATUS;

  const deploymentTone = STATUS_TONES[state] ?? "pending";
  const deadLease = leases?.length && !leases.some(isLeaseLive) ? selectLeaseToReportOn(leases) : undefined;

  if (!deadLease) {
    if (leases?.some(isReclaiming)) return { label: "Reclaiming", summaryLabel: "Reclaiming", tone: "warning" };
    const label = STATUS_LABELS[state] ?? state;
    return { label, summaryLabel: label, tone: deploymentTone };
  }

  return {
    label: getClosedLeaseLabel(deadLease),
    summaryLabel: getClosedLeaseSummaryLabel(deadLease),
    tone: deploymentTone === "closed" ? "closed" : "warning"
  };
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

export interface StatusBadgeProps {
  label: string;
  tone: StatusTone;
  className?: string;
}

export const StatusBadge: FC<StatusBadgeProps> = ({ label, tone, className }) => (
  <span className={cn("inline-flex items-center gap-2 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium", BADGE_TONE_CLASS[tone], className)}>
    {tone === "loading" ? (
      <span className="h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />
    ) : (
      <span className="relative flex h-2 w-2">
        {tone === "running" && <span className={cn("absolute inline-flex h-full w-full animate-ping rounded-full opacity-75", DOT_TONE_CLASS[tone])} />}
        <span className={cn("relative inline-flex h-2 w-2 rounded-full", DOT_TONE_CLASS[tone])} />
      </span>
    )}
    {label}
  </span>
);

export const DeploymentStatusBadge: FC<DeploymentStatusBadgeProps> = ({
  state,
  leases,
  isSummarized,
  isClosing,
  className,
  dependencies: d = DEPENDENCIES
}) => {
  const { label, summaryLabel, tone } = getDeploymentStatus(state, leases, isClosing);
  const isShortened = !!isSummarized && summaryLabel !== label;
  const isBeingReclaimed = !!leases?.some(isReclaiming);

  if (!isShortened && !isBeingReclaimed) return <StatusBadge label={label} tone={tone} className={className} />;

  return (
    <d.CustomTooltip
      title={
        <div className="space-y-1">
          {isShortened && <p>{label}</p>}
          <d.ReclamationCountdown leases={leases} />
        </div>
      }
    >
      <div className="inline-flex">
        <StatusBadge label={isShortened ? summaryLabel : label} tone={tone} className={cn("cursor-help", className)} />
      </div>
    </d.CustomTooltip>
  );
};
