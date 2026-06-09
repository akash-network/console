import { LeaseClosedReason } from "@akashnetwork/chain-sdk/private-types/akash.v1";

/**
 * Viewer-neutral labels for a lease's close/reclaim reason, for the public transaction explorer.
 *
 * Unlike deploy-web's tenant-centric labels (e.g. "Closed by you"), these read correctly for any
 * third-party viewer of stats.akash.network.
 *
 * Source of truth for the values/names is `LeaseClosedReason` in @akashnetwork/chain-sdk
 * (akash.market.v1). The chain encodes who initiated the close in numeric ranges:
 *   1..9999      tenant-initiated
 *   10000..19999 provider-initiated
 *   20000..29999 network-initiated
 */
const REASON_LABELS: Partial<Record<LeaseClosedReason, string>> = {
  [LeaseClosedReason.lease_closed_owner]: "Closed by tenant",
  [LeaseClosedReason.lease_closed_reason_unstable]: "Workloads unstable (provider)",
  [LeaseClosedReason.lease_closed_reason_decommission]: "Provider decommissioned",
  [LeaseClosedReason.lease_closed_reason_manifest_timeout]: "Manifest timeout (provider)",
  [LeaseClosedReason.lease_closed_reason_unspecified]: "Unspecified (provider)",
  [LeaseClosedReason.lease_closed_reason_insufficient_funds]: "Insufficient funds"
};

function toNumericReason(reason: string): number | undefined {
  if (/^\d+$/.test(reason)) {
    return Number(reason);
  }

  // Numeric enums expose a name->value mapping, so a known enum name resolves to its number.
  const value = LeaseClosedReason[reason as keyof typeof LeaseClosedReason];
  return typeof value === "number" ? value : undefined;
}

function classifyByRange(value: number): string | undefined {
  if (value >= 1 && value <= 9999) return "Closed by tenant";
  if (value >= 10000 && value <= 19999) return "Closed by provider";
  if (value >= 20000 && value <= 29999) return "Closed by network";
  return undefined;
}

/**
 * Formats a lease close reason into a friendly, viewer-neutral label.
 *
 * The API serializes the reason as the enum *name* string (e.g. "lease_closed_reason_unstable"),
 * and omits it entirely for the zero value, so this accepts an optional string. A numeric string is
 * also accepted defensively. Unknown values fall back to a range-based label, then to the raw value.
 */
export function formatLeaseCloseReason(reason?: string): string {
  if (!reason) {
    return "Unspecified";
  }

  const value = toNumericReason(reason);
  if (value === undefined) {
    // Unknown enum name — surface the raw value rather than hide information.
    return reason;
  }
  if (value <= 0) {
    // lease_closed_invalid (0) or UNRECOGNIZED (-1)
    return "Unspecified";
  }

  return REASON_LABELS[value as LeaseClosedReason] ?? classifyByRange(value) ?? reason;
}
