import type { Bid, QueryBidsResponse } from "@akashnetwork/chain-sdk/private-types/akash.v1beta5";
import { describe, expect, it, vi } from "vitest";
import { mock, mockDeep } from "vitest-mock-extended";

import type { ChainSDK } from "@src/chain/providers/chain-sdk.provider";
import type { GpuBidCheckRepository } from "@src/deployment/repositories/gpu-bid-check/gpu-bid-check.repository";
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

    return { handler: new RecordUserGpuBidsHandler(chainSdk, gpuBidCheckRepository), chainSdk, gpuBidCheckRepository };
  }
});
