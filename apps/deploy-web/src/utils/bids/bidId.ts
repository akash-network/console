/** A bid's on-chain composite key. `dseq` stays a string (chain ids overflow JS numbers); gseq/oseq are small ints. */
export interface BidId {
  provider: string;
  dseq: string;
  gseq: number;
  oseq: number;
}

/** Stable string identifier for a bid, used as the selection key and for React keys. */
export function formatBidId(id: BidId): string {
  return `${id.provider}/${id.dseq}/${id.gseq}/${id.oseq}`;
}

/** Inverse of {@link formatBidId}. Restores numeric gseq/oseq so the value can feed `createLease`. */
export function parseBidId(value: string): BidId {
  const [provider, dseq, gseq, oseq] = value.split("/");
  return { provider, dseq, gseq: Number(gseq), oseq: Number(oseq) };
}
