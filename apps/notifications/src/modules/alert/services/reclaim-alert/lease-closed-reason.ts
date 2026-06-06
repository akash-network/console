import { LeaseClosedReason } from "@akashnetwork/chain-sdk/private-types/akash.v1";

/**
 * Normalizes a raw on-chain `reason` value into a {@link LeaseClosedReason}.
 *
 * The reason arrives from a Comet38 event attribute that is `JSON.parse`d, so it
 * may be the enum's numeric value (e.g. `10000`), its numeric string (`"10000"`),
 * or its proto name (`"lease_closed_reason_unstable"`). Anything unknown maps to
 * `UNRECOGNIZED`.
 */
export function toLeaseClosedReason(raw: string | number): LeaseClosedReason {
  // A proto name (e.g. "lease_closed_reason_unstable") resolves to its numeric
  // value via the enum's forward lookup. A numeric string reverse-maps to a name
  // (not a number) here, so it falls through to be parsed as a value below.
  if (typeof raw === "string") {
    const byName = LeaseClosedReason[raw as keyof typeof LeaseClosedReason];
    if (typeof byName === "number") {
      return byName;
    }
  }

  const numeric = Number(raw);
  return numeric in LeaseClosedReason ? (numeric as LeaseClosedReason) : LeaseClosedReason.UNRECOGNIZED;
}

const FALLBACK_REASON_TEXT = "an unspecified reason";

const REASON_TEXT: Record<number, string> = {
  [LeaseClosedReason.lease_closed_invalid]: FALLBACK_REASON_TEXT,
  [LeaseClosedReason.lease_closed_owner]: "the owner closed the lease",
  [LeaseClosedReason.lease_closed_reason_unstable]: "the workload has been unstable",
  [LeaseClosedReason.lease_closed_reason_decommission]: "the provider is being decommissioned",
  [LeaseClosedReason.lease_closed_reason_unspecified]: "the provider did not specify a reason",
  [LeaseClosedReason.lease_closed_reason_manifest_timeout]: "the manifest was not received in time",
  [LeaseClosedReason.lease_closed_reason_insufficient_funds]: "the deployment has insufficient funds"
};

/**
 * Returns human-readable text describing a {@link LeaseClosedReason}, with a
 * safe fallback for `UNRECOGNIZED` or any value not in the map.
 */
export function getLeaseClosedReasonText(reason: LeaseClosedReason): string {
  return REASON_TEXT[reason] ?? FALLBACK_REASON_TEXT;
}
