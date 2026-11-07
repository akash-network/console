import type { Bid, QueryBidsResponse } from "@akashnetwork/chain-sdk/private-types/akash.v1beta5";
import { describe, expect, it, vi } from "vitest";
import { mock, mockDeep } from "vitest-mock-extended";

import type { ChainSDK } from "@src/chain/providers/chain-sdk.provider";
import { MAX_ASKED_GPUS } from "@src/deployment/lib/unmet-gpu-ask/unmet-gpu-ask";
import type { GpuBidCheckRepository } from "@src/deployment/repositories/gpu-bid-check/gpu-bid-check.repository";
import type { UnmetGpuDemandService } from "@src/deployment/services/unmet-gpu-demand/unmet-gpu-demand.service";
import { RecordUserGpuBidsHandler, type ScreenedGpuGroup } from "./record-user-gpu-bids.handler";

const CHECKED_AT = new Date("2026-10-19T12:05:00Z");

describe(RecordUserGpuBidsHandler.name, () => {
  it("records, per group, every provider screening listed and every provider that bid, as a user deployment check", async () => {
    vi.useFakeTimers({ toFake: ["Date"], now: CHECKED_AT });
    try {
      const { handler, gpuBidCheckRepository } = setup({
        bids: [aBid(1, "akash1bidder"), aBid(1, "akash1unlisted"), aBid(2, "akash1other")]
      });

      await handler.handle({
        owner: "akash1owner",
        dseq: "123",
        groups: [aGroup({ gseq: 1, model: "h100", screened: ["akash1bidder", "akash1silent"] })],
        version: 1
      });

      const check = { vendor: "nvidia", model: "h100", source: "user-deployment", dseq: "123", checkedAt: CHECKED_AT };
      expect(gpuBidCheckRepository.insertMany).toHaveBeenCalledWith([
        { ...check, provider: "akash1bidder", screened: true, bid: true },
        { ...check, provider: "akash1silent", screened: true, bid: false },
        { ...check, provider: "akash1unlisted", screened: false, bid: true }
      ]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("counts no miss on a group leased before the wait ended, recording only the providers that bid on it", async () => {
    const { handler, gpuBidCheckRepository } = setup({ bids: [aBid(1, "akash1winner")] });

    await handler.handle({
      owner: "akash1owner",
      dseq: "123",
      groups: [aGroup({ gseq: 1, screened: ["akash1winner", "akash1slow"], wasOpenThroughWait: false })],
      version: 1
    });

    expect(gpuBidCheckRepository.insertMany).toHaveBeenCalledWith([expect.objectContaining({ provider: "akash1winner", screened: true, bid: true })]);
  });

  it("reads the bids of the deployment it checks", async () => {
    const { handler, chainSdk } = setup({ bids: [] });

    await handler.handle({ owner: "akash1owner", dseq: "123", groups: [], version: 1 });

    expect(chainSdk.akash.market.v1beta5.getBids).toHaveBeenCalledWith(expect.objectContaining({ filters: { owner: "akash1owner", dseq: "123" } }));
  });

  it("ignores a bid without an id", async () => {
    const { handler, gpuBidCheckRepository } = setup({ bids: [mock<Bid>({ id: undefined })] });

    await handler.handle({ owner: "akash1owner", dseq: "123", groups: [aGroup({ gseq: 1, screened: [] })], version: 1 });

    expect(gpuBidCheckRepository.insertMany).toHaveBeenCalledWith([]);
  });

  it("records a zero bid, as the owner's, for each group that stayed open through the wait and drew no bid", async () => {
    vi.useFakeTimers({ toFake: ["Date"], now: CHECKED_AT });
    try {
      const { handler, unmetGpuDemandService } = setup({ bids: [aBid(2, "akash1bidder")] });

      await handler.handle({
        owner: "akash1owner",
        dseq: "123",
        groups: [
          aGroup({ gseq: 1, model: "h100", gpuCount: 8, regionArea: "eu", screened: ["akash1silent"] }),
          aGroup({ gseq: 2, model: "a100", gpuCount: 1 }),
          aGroup({ gseq: 3, model: "h200", gpuCount: 4, wasOpenThroughWait: false }),
          aGroup({ gseq: 4, model: "b200", gpuCount: 2 })
        ],
        version: 1
      });

      expect(unmetGpuDemandService.recordZeroBids).toHaveBeenCalledWith({
        asks: [
          { vendor: "nvidia", model: "h100", gpuCount: 8, regionArea: "eu" },
          { vendor: "nvidia", model: "b200", gpuCount: 2, regionArea: null }
        ],
        actorId: "akash1owner",
        occurredAt: CHECKED_AT
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("records no zero bid for a group queued before its gpu count was carried", async () => {
    const { handler, unmetGpuDemandService } = setup({ bids: [] });

    await handler.handle({ owner: "akash1owner", dseq: "123", groups: [aGroup({ gseq: 1 })], version: 1 });

    expect(unmetGpuDemandService.recordZeroBids).toHaveBeenCalledWith(expect.objectContaining({ asks: [] }));
  });

  it("records no zero bid for an ask beyond real demand or the stored columns", async () => {
    const { handler, unmetGpuDemandService } = setup({ bids: [] });

    await handler.handle({
      owner: "akash1owner",
      dseq: "123",
      groups: [
        aGroup({ gseq: 1, model: "h100", gpuCount: MAX_ASKED_GPUS }),
        aGroup({ gseq: 2, model: "a100", gpuCount: MAX_ASKED_GPUS + 1 }),
        aGroup({ gseq: 3, model: "h200", gpuCount: 2 ** 53 }),
        aGroup({ gseq: 4, model: "b200", gpuCount: 0 }),
        aGroup({ gseq: 5, model: "m".repeat(256), gpuCount: 1 }),
        aGroup({ gseq: 6, vendor: "v".repeat(65), gpuCount: 1 })
      ],
      version: 1
    });

    expect(unmetGpuDemandService.recordZeroBids).toHaveBeenCalledWith(
      expect.objectContaining({ asks: [{ vendor: "nvidia", model: "h100", gpuCount: MAX_ASKED_GPUS, regionArea: null }] })
    );
  });

  it("declares no permissions, because a worker carries no user", () => {
    const { handler } = setup({ bids: [] });

    expect(handler.requiresPermission()).toEqual([]);
  });

  function aGroup(overrides: Partial<ScreenedGpuGroup>): ScreenedGpuGroup {
    return { gseq: 1, vendor: "nvidia", model: "h100", screened: [], wasOpenThroughWait: true, ...overrides };
  }

  function aBid(gseq: number, provider: string): Bid {
    return mock<Bid>({ id: { owner: "akash1owner", dseq: 123n, gseq, oseq: 1, provider, bseq: 0 } });
  }

  function setup(input: { bids: Bid[] }) {
    const chainSdk = mockDeep<ChainSDK>();
    const response: QueryBidsResponse = { bids: input.bids.map(bid => ({ bid, escrowAccount: undefined })), pagination: undefined };
    chainSdk.akash.market.v1beta5.getBids.mockResolvedValue(response);
    const gpuBidCheckRepository = mock<GpuBidCheckRepository>();
    const unmetGpuDemandService = mock<UnmetGpuDemandService>();

    return {
      handler: new RecordUserGpuBidsHandler(chainSdk, gpuBidCheckRepository, unmetGpuDemandService),
      chainSdk,
      gpuBidCheckRepository,
      unmetGpuDemandService
    };
  }
});
