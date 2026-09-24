import type { Bid, BidHttpService, LeaseHttpService, RpcLease } from "@akashnetwork/http-sdk";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { CreateLogger } from "@src/core";
import { LeaseGpuOfferService } from "./lease-gpu-offer.service";

import { createBid } from "@test/seeders/bid.seeder";
import { createLeaseApiResponse } from "@test/seeders/lease-api-response.seeder";

const OWNER = "akash1owner";
const DSEQ = "12345";
const A100_SXM = { key: "vendor/nvidia/model/a100/ram/80Gi/interface/sxm", value: "true" };

describe(LeaseGpuOfferService.name, () => {
  it("records the gpus offered by the bid each live lease was created from", async () => {
    const leased = gpuBid({ provider: "akash1provider", bseq: 0 });
    const { service } = setup({ active: [leaseOf(leased)], bids: [leased] });

    const read = await service.findOffers({ owner: OWNER, dseq: DSEQ });

    expect(read).toEqual({
      liveLeases: 1,
      offers: [
        {
          gseq: 1,
          oseq: 1,
          provider: "akash1provider",
          bseq: 0,
          resources: [{ resourceId: 1, replicas: 1, unitsPerReplica: 8, attributes: [A100_SXM] }],
          recordedAt: expect.any(String)
        }
      ]
    });
  });

  it("takes the offer of the leased bid rather than a sibling bid the same provider placed on the order", async () => {
    const sibling = gpuBid({ provider: "akash1provider", bseq: 0, attributes: [{ key: "vendor/nvidia/model/h100", value: "true" }] });
    const leased = gpuBid({ provider: "akash1provider", bseq: 1 });
    const { service } = setup({ active: [leaseOf(leased)], bids: [sibling, leased] });

    const { offers } = await service.findOffers({ owner: OWNER, dseq: DSEQ });

    expect(offers.map(offer => ({ bseq: offer.bseq, attributes: offer.resources[0].attributes }))).toEqual([{ bseq: 1, attributes: [A100_SXM] }]);
  });

  it("reads a lease under reclamation as live", async () => {
    const leased = gpuBid({ provider: "akash1provider" });
    const { service, leaseHttpService } = setup({ reclaiming: [leaseOf(leased)], bids: [leased] });

    await expect(service.findOffers({ owner: OWNER, dseq: DSEQ })).resolves.toMatchObject({ liveLeases: 1, offers: [{ provider: "akash1provider" }] });
    expect(leaseHttpService.list).toHaveBeenCalledWith({ owner: OWNER, dseq: DSEQ, state: "reclaiming" });
  });

  it("records nothing for a lease whose bid offered no gpu", async () => {
    const cpuOnly = createBid({ owner: OWNER, dseq: DSEQ, gseq: 1, oseq: 1, provider: "akash1provider", bseq: 0 });
    const { service } = setup({ active: [leaseOf(cpuOnly)], bids: [cpuOnly] });

    await expect(service.findOffers({ owner: OWNER, dseq: DSEQ })).resolves.toEqual({ liveLeases: 1, offers: [] });
  });

  it("skips a live lease whose bid the chain did not list, and says so", async () => {
    const leased = gpuBid({ provider: "akash1provider" });
    const { service, logger } = setup({ active: [leaseOf(leased)], bids: [] });

    await expect(service.findOffers({ owner: OWNER, dseq: DSEQ })).resolves.toEqual({ liveLeases: 1, offers: [] });
    expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({ event: "LEASE_GPU_OFFER_BID_NOT_FOUND", dseq: DSEQ, provider: "akash1provider" }));
  });

  it("reports no live lease when the chain shows none yet", async () => {
    const { service } = setup({ bids: [gpuBid({ provider: "akash1provider" })] });

    await expect(service.findOffers({ owner: OWNER, dseq: DSEQ })).resolves.toEqual({ liveLeases: 0, offers: [] });
  });

  it("fails when the chain cannot list the bids, so the job retries", async () => {
    const { service, bidHttpService } = setup({});
    bidHttpService.list.mockRejectedValue(new Error("chain node unreachable"));

    await expect(service.findOffers({ owner: OWNER, dseq: DSEQ })).rejects.toThrow("chain node unreachable");
  });

  function gpuBid(input: { provider: string; bseq?: number; attributes?: Array<{ key: string; value: string }> }): Bid {
    const bid = createBid({ owner: OWNER, dseq: DSEQ, gseq: 1, oseq: 1, provider: input.provider, bseq: input.bseq ?? 0 });
    bid.bid.resources_offer[0].resources.gpu = { units: { val: "8" }, attributes: input.attributes ?? [A100_SXM] };

    return bid;
  }

  function leaseOf(bid: Bid): RpcLease {
    const lease = createLeaseApiResponse({ state: "active" }) as RpcLease;
    lease.lease.id = { ...bid.bid.id };

    return lease;
  }

  function setup(input: { active?: RpcLease[]; reclaiming?: RpcLease[]; bids?: Bid[] }) {
    const leaseHttpService = mock<LeaseHttpService>();
    leaseHttpService.list.mockImplementation(async ({ state }) =>
      mock<Awaited<ReturnType<LeaseHttpService["list"]>>>({ leases: (state === "reclaiming" ? input.reclaiming : input.active) ?? [] })
    );
    const bidHttpService = mock<BidHttpService>();
    bidHttpService.list.mockResolvedValue(input.bids ?? []);
    const logger = mock<ReturnType<CreateLogger>>();
    const service = new LeaseGpuOfferService(
      leaseHttpService,
      bidHttpService,
      vi.fn<CreateLogger>(() => logger)
    );

    return { service, leaseHttpService, bidHttpService, logger };
  }
});
