import { inject, singleton } from "tsyringe";

import { Memoize } from "@src/caching/helpers";
import { CHAIN_SDK, type ChainSDK } from "@src/chain/providers/chain-sdk.provider";
import { averageBlockTime } from "@src/utils/constants";

@singleton()
export class BlockHttpService {
  readonly #chainSdk: ChainSDK;

  constructor(@inject(CHAIN_SDK) chainSdk: ChainSDK) {
    this.#chainSdk = chainSdk;
  }

  @Memoize({ ttlInSeconds: averageBlockTime })
  async getCurrentHeight(): Promise<number> {
    const { sdkBlock, block } = await this.#chainSdk.cosmos.base.tendermint.v1beta1.getLatestBlock();
    const height = (sdkBlock ?? block)?.header?.height;

    if (!height) throw new Error("Latest block response carried no usable header height");

    return Number(height);
  }
}
