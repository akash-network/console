import { HTTPException } from "hono/http-exception";
import { inject, singleton } from "tsyringe";

import { memoizeAsync } from "@src/caching/helpers";
import { CHAIN_SDK, type ChainSDK } from "@src/chain/providers/chain-sdk.provider";
import { averageBlockTime } from "@src/utils/constants";

@singleton()
export class BlockHttpService {
  readonly #chainSdk: ChainSDK;
  readonly getCurrentHeight = memoizeAsync(this.getFreshCurrentHeight.bind(this), {
    ttl: averageBlockTime * 1000,
    cacheItemLimit: 1,
    name: "BlockHttpService#getCurrentHeight"
  });

  constructor(@inject(CHAIN_SDK) chainSdk: ChainSDK) {
    this.#chainSdk = chainSdk;
  }

  async getFreshCurrentHeight(): Promise<number> {
    const { sdkBlock, block } = await this.#chainSdk.cosmos.base.tendermint.v1beta1.getLatestBlock();
    const height = (sdkBlock ?? block)?.header?.height;

    if (!height) {
      throw new HTTPException(502, {
        message: "Latest block response carried no usable header height"
      });
    }

    return Number(height);
  }
}
