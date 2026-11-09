import { MsgCreateBid as MsgCreateBidV4 } from "@akashnetwork/akash-api/akash/market/v1beta4";
import { MsgCreateBid as MsgCreateBidV5 } from "@akashnetwork/chain-sdk/private-types/akash.v1beta5";

import type { Registry } from "@src/billing/providers/type-registry.provider";
import { resourceValToNumber } from "@src/deployment/utils/group-resources/group-resources";

export interface GpuBidMessage {
  type: string;
  data: Uint8Array;
}

export interface BidGpu {
  vendor: string | undefined;
  model: string | undefined;
  ram: string | undefined;
  interface: string | undefined;
}

export interface DecodedGpuBid {
  provider: string;
  gseq: number;
  oseq: number;
  denom: string | undefined;
  amountPerBlock: number;
  gpus: BidGpu[];
  /** Gpu units across every offered resource, counting each replica. */
  gpuUnits: number;
  cpuUnits: number;
  memoryUnits: number;
  storageUnits: number;
  /** JSON-encoded MsgCreateBid, kept JSON.stringify-safe for debug responses. */
  json: unknown;
}

type ResourceOffer = MsgCreateBidV4["resourcesOffer"][number] | MsgCreateBidV5["resourcesOffer"][number];

export function decodeGpuBid(typeRegistry: Registry, message: GpuBidMessage): DecodedGpuBid {
  if (message.type.includes("v1beta5")) {
    const bid = typeRegistry.decode({ typeUrl: `/${MsgCreateBidV5.$type}`, value: message.data }) as MsgCreateBidV5;
    return toDecodedGpuBid(bid, {
      provider: bid.id?.provider || "",
      gseq: bid.id?.gseq ?? 0,
      oseq: bid.id?.oseq ?? 0,
      json: MsgCreateBidV5.toJSON(bid)
    });
  }

  const bid = typeRegistry.decode({ typeUrl: `/${MsgCreateBidV4.$type}`, value: message.data }) as MsgCreateBidV4;
  return toDecodedGpuBid(bid, {
    provider: bid.provider || "",
    gseq: bid.order?.gseq ?? 0,
    oseq: bid.order?.oseq ?? 0,
    json: MsgCreateBidV4.toJSON(bid)
  });
}

function toDecodedGpuBid(bid: MsgCreateBidV4 | MsgCreateBidV5, identity: Pick<DecodedGpuBid, "provider" | "gseq" | "oseq" | "json">): DecodedGpuBid {
  const offers: ResourceOffer[] = bid.resourcesOffer;

  return {
    ...identity,
    denom: bid.price?.denom,
    amountPerBlock: parseFloat(bid.price?.amount ?? ""),
    gpus: offers
      .filter(offer => resourceValToNumber(offer.resources?.gpu?.units?.val) > 0)
      .flatMap(offer => (offer.resources?.gpu?.attributes ? getGpusFromAttributes(offer.resources.gpu.attributes) : [])),
    gpuUnits: sum(offers.map(offer => resourceValToNumber(offer.resources?.gpu?.units?.val) * offer.count)),
    cpuUnits: sum(offers.map(offer => resourceValToNumber(offer.resources?.cpu?.units?.val))),
    memoryUnits: sum(offers.map(offer => resourceValToNumber(offer.resources?.memory?.quantity?.val))),
    storageUnits: sum(offers.flatMap(offer => [...(offer.resources?.storage ?? [])]).map(storage => resourceValToNumber(storage.quantity?.val)))
  };
}

/** Reads `vendor/nvidia/model/h100/ram/80Gi/interface/pcie` attribute keys into their parts. */
export function getGpusFromAttributes(attributes: { key: string; value: string }[]): BidGpu[] {
  return attributes
    .filter(attr => attr.key.startsWith("vendor/") && attr.value === "true")
    .map(attr => ({
      vendor: /vendor\/([^/]+)/.exec(attr.key)?.[1],
      model: /model\/([^/]+)/.exec(attr.key)?.[1],
      ram: /ram\/([^/]+)/.exec(attr.key)?.[1],
      interface: /interface\/([^/]+)/.exec(attr.key)?.[1]
    }));
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}
