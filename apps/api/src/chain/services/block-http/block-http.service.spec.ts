import type { GetLatestBlockResponse } from "@akashnetwork/chain-sdk/private-types/cosmos.v1beta1";
import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";
import { mock, mockDeep } from "vitest-mock-extended";

import { cacheEngine } from "@src/caching/helpers";
import type { ChainSDK } from "@src/chain/providers/chain-sdk.provider";
import { BlockHttpService } from "./block-http.service";

describe(BlockHttpService.name, () => {
  it("narrows the chain's bigint height to a number", async () => {
    const height = faker.number.int({ min: 1000000, max: 10000000 });
    const { service } = setup({ sdkBlockHeight: BigInt(height) });

    const result = await service.getCurrentHeight();

    expect(result).toBe(height);
    expect(typeof result).toBe("number");
  });

  it("reads the height from the sdk block rather than the deprecated block", async () => {
    const { service } = setup({ sdkBlockHeight: 4200n, deprecatedBlockHeight: 1n });

    await expect(service.getCurrentHeight()).resolves.toBe(4200);
  });

  it("falls back to the deprecated block when the chain omits the sdk block", async () => {
    const { service } = setup({ deprecatedBlockHeight: 4200n });

    await expect(service.getCurrentHeight()).resolves.toBe(4200);
  });

  it("throws when the latest block carries no header at all", async () => {
    const { service } = setup({});

    await expect(service.getCurrentHeight()).rejects.toThrow("Latest block response carried no usable header height");
  });

  it("throws rather than reporting height zero, which is how an absent height decodes", async () => {
    const { service } = setup({ sdkBlockHeight: 0n });

    await expect(service.getCurrentHeight()).rejects.toThrow("Latest block response carried no usable header height");
  });

  function setup(input: { sdkBlockHeight?: bigint; deprecatedBlockHeight?: bigint }) {
    cacheEngine.clearAllKeyInCache();

    const chainSdk = mockDeep<ChainSDK>();
    chainSdk.cosmos.base.tendermint.v1beta1.getLatestBlock.mockResolvedValue(
      mock<GetLatestBlockResponse>({
        sdkBlock: input.sdkBlockHeight === undefined ? undefined : mock<GetLatestBlockResponse["sdkBlock"]>({ header: { height: input.sdkBlockHeight } }),
        block:
          input.deprecatedBlockHeight === undefined ? undefined : mock<GetLatestBlockResponse["block"]>({ header: { height: input.deprecatedBlockHeight } })
      })
    );

    return { service: new BlockHttpService(chainSdk), chainSdk };
  }
});
