import "@test/mocks/logger-service.mock";

import type { GetNodeInfoResponse } from "@akashnetwork/chain-sdk/private-types/cosmos.v1beta1";
import { describe, expect, it, vi } from "vitest";
import { mockDeep } from "vitest-mock-extended";

import type { ChainSDK } from "@src/chain/providers/chain-sdk.provider";
import { BlockchainStatusService } from "./blockchain-status.service";

describe.concurrent(BlockchainStatusService.name, () => {
  it("returns isBlockchainReachable true when getNodeInfo succeeds", async () => {
    const { service } = setup({ succeeds: true });

    const result = await service.getStatus();

    expect(result).toEqual({ isBlockchainReachable: true });
  });

  it("returns isBlockchainReachable false when getNodeInfo fails", async () => {
    const { service } = setup({ succeeds: false });

    const result = await service.getStatus();

    expect(result).toEqual({ isBlockchainReachable: false });
  });

  function setup(input: { succeeds: boolean }) {
    const chainSdk = mockDeep<ChainSDK>();
    chainSdk.cosmos.base.tendermint.v1beta1.getNodeInfo.mockImplementation(async () => {
      return input.succeeds ? Promise.resolve({} as GetNodeInfoResponse) : Promise.reject(new Error("Connection refused"));
    });

    const service = new BlockchainStatusService(chainSdk, { setContext: vi.fn(), warn: vi.fn() } as any);

    return { service, chainSdk };
  }
});
