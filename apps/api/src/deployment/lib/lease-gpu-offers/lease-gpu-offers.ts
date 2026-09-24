import type { Bid } from "@akashnetwork/http-sdk";

import type { GpuOfferAttribute, LeaseGpuOffer, OfferedGpuResource } from "@src/deployment/model-schemas";

type BidId = Bid["bid"]["id"];

export type OfferedGpuModel = {
  vendor: string;
  model: string;
  ram: string | null;
  interface: string | null;
  count: number;
};

type NamedGpuModel = Omit<OfferedGpuModel, "count">;

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

/** A resource unit naming more than one model cannot say how its cards split between them, so it is left out rather than miscounted. */
export function readOfferedGpus(offer: LeaseGpuOffer): OfferedGpuModel[] {
  const byModel = new Map<string, OfferedGpuModel>();

  for (const resource of offer.resources) {
    const named = resource.attributes.map(nameGpuModel).filter(model => model !== null);
    if (named.length !== 1) continue;

    const [model] = named;
    const key = [model.vendor, model.model, model.ram, model.interface].join("/");
    byModel.set(key, { ...model, count: (byModel.get(key)?.count ?? 0) + resource.replicas * resource.unitsPerReplica });
  }

  return [...byModel.values()];
}

/** Reads `vendor/nvidia/model/a100/ram/80Gi/interface/sxm`, the one shape a provider writes a concrete model in. */
function nameGpuModel({ key, value }: GpuOfferAttribute): NamedGpuModel | null {
  const vendor = segmentOf(key, "vendor");
  const model = segmentOf(key, "model");
  if (value !== "true" || !vendor || !model || model === "*") return null;

  return { vendor, model, ram: segmentOf(key, "ram"), interface: segmentOf(key, "interface") };
}

function segmentOf(key: string, name: string): string | null {
  return new RegExp(`(?:^|/)${name}/([^/]+)`).exec(key)?.[1] ?? null;
}
