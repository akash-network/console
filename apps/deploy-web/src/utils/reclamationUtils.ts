import { LeaseClosedReason } from "@akashnetwork/chain-sdk/private-types/akash.v1";

import type { LeaseDto } from "@src/types/deployment";

export type LeaseCloseParty = "tenant" | "provider" | "network" | "unknown";

type ReclaimableLease = Pick<LeaseDto, "state" | "reason" | "reclamation" | "group">;

/**
 * The chain encodes *who* closed a lease in the numeric range of `LeaseClosedReason`:
 *   1..9999     owner / tenant
 *   10000..19999 provider
 *   20000..29999 network (insufficient funds)
 * REST serializes the reason as the enum *name* (e.g. "lease_closed_reason_unstable"), but we also
 * accept a numeric string for resilience. `LeaseClosedReason` is a reverse-mappable enum, so a name
 * resolves to its number without needing the (unexported) `leaseClosedReasonFromJSON`.
 */
function toNumericCloseReason(reason?: string): number | undefined {
  if (!reason) return undefined;

  const asNumber = Number(reason);
  if (reason.trim() !== "" && !Number.isNaN(asNumber)) return asNumber;

  const mapped = (LeaseClosedReason as Record<string, number | string>)[reason];
  return typeof mapped === "number" ? mapped : undefined;
}

export function classifyLeaseCloseReason(reason?: string): LeaseCloseParty {
  const value = toNumericCloseReason(reason);
  if (value === undefined) return "unknown";
  if (value >= 1 && value <= 9999) return "tenant";
  if (value >= 10000 && value <= 19999) return "provider";
  if (value >= 20000 && value <= 29999) return "network";
  return "unknown";
}

export function getLeaseCloseReasonLabel(reason?: string): string {
  switch (toNumericCloseReason(reason)) {
    case LeaseClosedReason.lease_closed_owner:
      return "Closed by you";
    case LeaseClosedReason.lease_closed_reason_unstable:
      return "Closed by provider (workloads unstable)";
    case LeaseClosedReason.lease_closed_reason_decommission:
      return "Closed by provider (decommissioned)";
    case LeaseClosedReason.lease_closed_reason_manifest_timeout:
      return "Closed by provider (manifest timeout)";
    case LeaseClosedReason.lease_closed_reason_insufficient_funds:
      return "Closed (insufficient funds)";
    default:
      // Covers the provider "unspecified" reason plus tenant/network buckets without a specific copy.
      switch (classifyLeaseCloseReason(reason)) {
        case "provider":
          return "Closed by provider";
        default:
          return "Closed";
      }
  }
}

/** Reclamation deadline as a Date, or null when absent/0/NaN. `deadline` is unix seconds. */
export function getReclamationDeadline(lease: Pick<LeaseDto, "reclamation">): Date | null {
  const deadline = lease.reclamation?.deadline;
  // `!deadline` rejects undefined/0/NaN; `!Number.isFinite` additionally rejects ±Infinity, any of
  // which would otherwise produce an Invalid Date and break the downstream countdown formatting.
  if (!deadline || !Number.isFinite(deadline)) return null;
  return new Date(deadline * 1000);
}

export function isReclaiming(lease: Pick<LeaseDto, "state">): boolean {
  return lease.state === "reclaiming";
}

/** A lease whose workload is still running — actively leased or in the reclamation grace period. */
export function isLeaseLive(lease: Pick<LeaseDto, "state">): boolean {
  return lease.state === "active" || lease.state === "reclaiming";
}

function hasReclamationStarted(lease: Pick<LeaseDto, "reclamation">): boolean {
  const startedAt = lease.reclamation?.startedAt;
  return startedAt !== undefined && Number(startedAt) > 0;
}

/**
 * Terminal reclamation: the provider has reclaimed the lease and it is no longer live.
 * "Reclaimed" requires reclamation *evidence* (reclamation started, or the group is paused) — a bare
 * provider-range close reason alone is NOT enough, since a provider can close a lease directly
 * without going through the AEP-82 reclamation grace period.
 */
export function isProviderReclaimed(lease: ReclaimableLease): boolean {
  if (isReclaiming(lease)) return false;
  return hasReclamationStarted(lease) || lease.group?.state === "paused";
}
