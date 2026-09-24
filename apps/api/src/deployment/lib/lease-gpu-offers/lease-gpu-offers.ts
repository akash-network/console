import type { Bid } from "@akashnetwork/http-sdk";

import type { LeaseGpuOffer, OfferedGpuResource } from "@src/deployment/model-schemas";

type BidId = Bid["bid"]["id"];

/** Matched on every field of the id, bid sequence included, so a provider's sibling bids on one order can never stand in for the one that was leased. */
export function isBidOf(bid: Bid, leaseId: BidId): boolean {
  const { id } = bid.bid;

  return (
    id.owner === leaseId.owner &&
    id.dseq === leaseId.dseq &&
    id.gseq === leaseId.gseq &&
    id.oseq === leaseId.oseq &&
    id.provider === leaseId.provider &&
    id.bseq === leaseId.bseq
  );
}

export function toLeaseGpuOffer(bid: Bid, recordedAt: Date): LeaseGpuOffer {
  const { gseq, oseq, provider, bseq } = bid.bid.id;

  return { gseq, oseq, provider, bseq, resources: toGpuResources(bid), recordedAt: recordedAt.toISOString() };
}

function toGpuResources(bid: Bid): OfferedGpuResource[] {
  return (bid.bid.resources_offer ?? [])
    .map(({ resources, count }) => ({
      resourceId: resources.id,
      replicas: count,
      unitsPerReplica: Number(resources.gpu?.units?.val ?? 0),
      attributes: (resources.gpu?.attributes ?? []).map(({ key, value }) => ({ key, value }))
    }))
    .filter(resource => resource.unitsPerReplica > 0);
}

function leaseKeyOf({ gseq, oseq, provider, bseq }: LeaseGpuOffer): string {
  return `${gseq}/${oseq}/${provider}/${bseq}`;
}

export function mergeLeaseGpuOffers(current: LeaseGpuOffer[], incoming: LeaseGpuOffer[]): LeaseGpuOffer[] {
  const replaced = new Set(incoming.map(leaseKeyOf));

  return [...current.filter(offer => !replaced.has(leaseKeyOf(offer))), ...incoming];
}
