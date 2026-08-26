import type { GetNodeInfoResponse } from "@akashnetwork/chain-sdk/private-types/cosmos.v1beta1";
import { describe, expect, it, vi } from "vitest";
import { mock, mockDeep } from "vitest-mock-extended";

import type { ChainSDK } from "@src/chain/providers/chain-sdk.provider";
import type { CreateLogger } from "@src/core";
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

  it("creates the logger with the service context", () => {
    const { createLogger } = setup({ succeeds: true });

    expect(createLogger).toHaveBeenCalledWith({ context: BlockchainStatusService.name });
  });

  function setup(input: { succeeds: boolean }) {
    const chainSdk = mockDeep<ChainSDK>();
    chainSdk.cosmos.base.tendermint.v1beta1.getNodeInfo.mockImplementation(async () => {
      return input.succeeds ? Promise.resolve({} as GetNodeInfoResponse) : Promise.reject(new Error("Connection refused"));
    });

    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger = vi.fn<CreateLogger>(() => logger);
    const service = new BlockchainStatusService(chainSdk, createLogger);

    return { service, chainSdk, logger, createLogger };
  }
});
