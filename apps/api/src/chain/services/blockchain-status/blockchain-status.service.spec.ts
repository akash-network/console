import "@test/mocks/logger-service.mock";

import { describe, expect, it, vi } from "vitest";

import { BlockchainStatusService } from "./blockchain-status.service";

describe(BlockchainStatusService.name, () => {
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
    const getNodeInfo = input.succeeds
      ? vi.fn().mockResolvedValue(undefined)
      : vi.fn().mockRejectedValue(new Error("Connection refused"));

    const chainSdk = {
      cosmos: {
        base: {
          tendermint: {
            v1beta1: { getNodeInfo }
          }
        }
      }
    };

    const service = new BlockchainStatusService(chainSdk as any, { setContext: vi.fn(), warn: vi.fn() } as any);

    return { service, getNodeInfo };
  }
});
