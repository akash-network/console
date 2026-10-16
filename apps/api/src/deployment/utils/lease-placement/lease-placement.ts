import type { RpcLease } from "@akashnetwork/http-sdk";

/** What a lease request names: no request carries a bid sequence, and every lease compared here is listed under the signer's own address. */
export type LeasePlacement = Pick<RpcLease["lease"]["id"], "dseq" | "gseq" | "oseq" | "provider">;

export function isLeaseOn(lease: LeasePlacement, placement: LeasePlacement): boolean {
  return lease.dseq === placement.dseq && lease.gseq === placement.gseq && lease.oseq === placement.oseq && lease.provider === placement.provider;
}

export function isSamePlacementSet(placements: LeasePlacement[], others: LeasePlacement[]): boolean {
  return placements.length === others.length && placements.every(placement => others.some(other => isLeaseOn(other, placement)));
}
