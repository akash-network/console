import type { Bid } from "@akashnetwork/http-sdk";
import { describe, expect, it } from "vitest";

import type { LeaseGpuOffer } from "@src/deployment/model-schemas";
import { isBidOf, mergeLeaseGpuOffers, readOfferedGpus, toLeaseGpuOffer } from "./lease-gpu-offers";

import { createBid } from "@test/seeders/bid.seeder";

const RECORDED_AT = new Date("2026-09-25T10:00:00.000Z");
const A100_SXM = { key: "vendor/nvidia/model/a100/ram/80Gi/interface/sxm", value: "true" };
const RTX_4060_TI = { key: "vendor/nvidia/model/rtx4060ti", value: "true" };

describe("lease gpu offers", () => {
  describe(isBidOf.name, () => {
    it("matches the bid carrying the lease's exact id", () => {
      const bid = createBid({ owner: "akash1owner", dseq: "100", gseq: 1, oseq: 1, provider: "akash1provider", bseq: 0 });

      expect(isBidOf(bid, { owner: "akash1owner", dseq: "100", gseq: 1, oseq: 1, provider: "akash1provider", bseq: 0 })).toBe(true);
    });

    it.each([
      { field: "owner", leaseId: { owner: "akash1other" } },
      { field: "dseq", leaseId: { dseq: "101" } },
      { field: "gseq", leaseId: { gseq: 2 } },
      { field: "oseq", leaseId: { oseq: 2 } },
      { field: "provider", leaseId: { provider: "akash1other" } },
      { field: "bseq", leaseId: { bseq: 1 } }
    ])("refuses a bid whose $field differs from the lease's", ({ leaseId }) => {
      const id = { owner: "akash1owner", dseq: "100", gseq: 1, oseq: 1, provider: "akash1provider", bseq: 0 };
      const bid = createBid(id);

      expect(isBidOf(bid, { ...id, ...leaseId })).toBe(false);
    });
  });

  describe(toLeaseGpuOffer.name, () => {
    it("keeps the id of the bid, the gpu resource units it offered and when it was read", () => {
      const bid = bidOffering([{ resourceId: 1, count: 2, gpuUnits: "8", attributes: [A100_SXM] }], { gseq: 1, oseq: 1, provider: "akash1provider", bseq: 0 });

      expect(toLeaseGpuOffer(bid, RECORDED_AT)).toEqual({
        gseq: 1,
        oseq: 1,
        provider: "akash1provider",
        bseq: 0,
        resources: [{ resourceId: 1, replicas: 2, unitsPerReplica: 8, attributes: [A100_SXM] }],
        recordedAt: "2026-09-25T10:00:00.000Z"
      });
    });

    it("leaves out the resource units that offer no gpu", () => {
      const bid = bidOffering([
        { resourceId: 1, count: 1, gpuUnits: "0", attributes: [] },
        { resourceId: 2, count: 1, gpuUnits: "1", attributes: [RTX_4060_TI] }
      ]);

      expect(toLeaseGpuOffer(bid, RECORDED_AT).resources.map(resource => resource.resourceId)).toEqual([2]);
    });

    it("keeps nothing of an attribute but its key and value", () => {
      const bid = bidOffering([{ resourceId: 1, count: 1, gpuUnits: "1", attributes: [{ ...RTX_4060_TI, extra: "ignored" } as typeof RTX_4060_TI] }]);

      expect(toLeaseGpuOffer(bid, RECORDED_AT).resources[0].attributes).toEqual([RTX_4060_TI]);
    });

    it("offers no resource unit for a bid from a provider that sent no offer", () => {
      const bid = createBid();
      bid.bid.resources_offer = undefined as unknown as Bid["bid"]["resources_offer"];

      expect(toLeaseGpuOffer(bid, RECORDED_AT).resources).toEqual([]);
    });

    it("reads a resource unit with no gpu section as offering none", () => {
      const bid = createBid();
      bid.bid.resources_offer[0].resources.gpu = undefined as unknown as Bid["bid"]["resources_offer"][number]["resources"]["gpu"];

      expect(toLeaseGpuOffer(bid, RECORDED_AT).resources).toEqual([]);
    });
  });

  describe("when a provider leaves part of the gpu section out", () => {
    it("reads a gpu section with no units as offering none", () => {
      const bid = createBid();
      bid.bid.resources_offer[0].resources.gpu = { attributes: [RTX_4060_TI] } as Bid["bid"]["resources_offer"][number]["resources"]["gpu"];

      expect(toLeaseGpuOffer(bid, RECORDED_AT).resources).toEqual([]);
    });

    it("reads a gpu section with no attributes as naming no model", () => {
      const bid = createBid();
      bid.bid.resources_offer[0].resources.gpu = { units: { val: "1" } } as Bid["bid"]["resources_offer"][number]["resources"]["gpu"];

      expect(toLeaseGpuOffer(bid, RECORDED_AT).resources[0].attributes).toEqual([]);
    });
  });

  describe(mergeLeaseGpuOffers.name, () => {
    it("replaces the stored offer of a lease recorded again", () => {
      const stored = offer({ recordedAt: "2026-09-24T10:00:00.000Z" });
      const recordedAgain = offer({ recordedAt: "2026-09-25T10:00:00.000Z" });

      expect(mergeLeaseGpuOffers([stored], [recordedAgain])).toEqual([recordedAgain]);
    });

    it("keeps the offer of every lease it was not given", () => {
      const stored = offer();
      const otherOrder = offer({ oseq: 2 });
      const otherGroup = offer({ gseq: 2 });
      const otherProvider = offer({ provider: "akash1other" });
      const siblingBid = offer({ bseq: 1 });
      const recordedAgain = offer({ recordedAt: "2026-09-25T10:00:00.000Z" });

      expect(mergeLeaseGpuOffers([stored, otherOrder, otherGroup, otherProvider, siblingBid], [recordedAgain])).toEqual([
        otherOrder,
        otherGroup,
        otherProvider,
        siblingBid,
        recordedAgain
      ]);
    });
  });

  describe(readOfferedGpus.name, () => {
    it("names the model, memory and interface an offer carries, counting every card of every replica", () => {
      const read = readOfferedGpus(offer({ resources: [{ resourceId: 1, replicas: 2, unitsPerReplica: 8, attributes: [A100_SXM] }] }));

      expect(read).toEqual([{ vendor: "nvidia", model: "a100", ram: "80Gi", interface: "sxm", count: 16 }]);
    });

    it("leaves memory and interface unknown when the provider named only the model", () => {
      const read = readOfferedGpus(offer({ resources: [{ resourceId: 1, replicas: 1, unitsPerReplica: 1, attributes: [RTX_4060_TI] }] }));

      expect(read).toEqual([{ vendor: "nvidia", model: "rtx4060ti", ram: null, interface: null, count: 1 }]);
    });

    it("folds services offered the same model into one entry", () => {
      const read = readOfferedGpus(
        offer({
          resources: [
            { resourceId: 1, replicas: 1, unitsPerReplica: 1, attributes: [RTX_4060_TI] },
            { resourceId: 2, replicas: 2, unitsPerReplica: 1, attributes: [RTX_4060_TI] }
          ]
        })
      );

      expect(read).toEqual([{ vendor: "nvidia", model: "rtx4060ti", ram: null, interface: null, count: 3 }]);
    });

    it("keeps services offered different models apart", () => {
      const read = readOfferedGpus(
        offer({
          resources: [
            { resourceId: 1, replicas: 1, unitsPerReplica: 8, attributes: [A100_SXM] },
            { resourceId: 2, replicas: 1, unitsPerReplica: 1, attributes: [RTX_4060_TI] }
          ]
        })
      );

      expect(read.map(gpu => [gpu.model, gpu.count])).toEqual([
        ["a100", 8],
        ["rtx4060ti", 1]
      ]);
    });

    it("keeps the same model on different memory or interfaces apart", () => {
      const read = readOfferedGpus(
        offer({
          resources: [
            { resourceId: 1, replicas: 1, unitsPerReplica: 1, attributes: [{ key: "vendor/nvidia/model/a100/ram/80Gi/interface/sxm", value: "true" }] },
            { resourceId: 2, replicas: 1, unitsPerReplica: 1, attributes: [{ key: "vendor/nvidia/model/a100/ram/40Gi/interface/sxm", value: "true" }] },
            { resourceId: 3, replicas: 1, unitsPerReplica: 1, attributes: [{ key: "vendor/nvidia/model/a100/ram/80Gi/interface/pcie", value: "true" }] }
          ]
        })
      );

      expect(read.map(gpu => `${gpu.ram}/${gpu.interface}`)).toEqual(["80Gi/sxm", "40Gi/sxm", "80Gi/pcie"]);
    });

    it("leaves out a service whose offer names several models, since it cannot say how the cards split between them", () => {
      const read = readOfferedGpus(offer({ resources: [{ resourceId: 1, replicas: 1, unitsPerReplica: 4, attributes: [A100_SXM, RTX_4060_TI] }] }));

      expect(read).toEqual([]);
    });

    it.each([
      { case: "an attribute not set to true", attribute: { key: "vendor/nvidia/model/a100", value: "false" } },
      { case: "a key naming no vendor", attribute: { key: "model/a100", value: "true" } },
      { case: "a key naming no model", attribute: { key: "vendor/nvidia", value: "true" } },
      { case: "a wildcard model", attribute: { key: "vendor/nvidia/model/*", value: "true" } }
    ])("names no model from $case", ({ attribute }) => {
      const read = readOfferedGpus(offer({ resources: [{ resourceId: 1, replicas: 1, unitsPerReplica: 1, attributes: [attribute] }] }));

      expect(read).toEqual([]);
    });
  });

  function bidOffering(
    resources: Array<{ resourceId: number; count: number; gpuUnits: string; attributes: Array<{ key: string; value: string }> }>,
    id: { gseq?: number; oseq?: number; provider?: string; bseq?: number } = {}
  ): Bid {
    const bid = createBid(id);
    const [template] = bid.bid.resources_offer;
    bid.bid.resources_offer = resources.map(({ resourceId, count, gpuUnits, attributes }) => ({
      resources: { ...template.resources, id: resourceId, gpu: { units: { val: gpuUnits }, attributes } },
      count
    }));

    return bid;
  }

  function offer(overrides: Partial<LeaseGpuOffer> = {}): LeaseGpuOffer {
    return {
      gseq: 1,
      oseq: 1,
      provider: "akash1provider",
      bseq: 0,
      resources: [{ resourceId: 1, replicas: 1, unitsPerReplica: 1, attributes: [RTX_4060_TI] }],
      recordedAt: "2026-09-24T10:00:00.000Z",
      ...overrides
    };
  }
});
