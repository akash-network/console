import { inject, singleton } from "tsyringe";

import { type CreateLogger, LOGGER_FACTORY } from "@src/core";
import { CHAIN_SDK, type ChainSDK } from "../../providers/chain-sdk.provider";

@singleton()
export class BlockchainStatusService {
  readonly #chainSdk: ChainSDK;
  readonly #logger: ReturnType<CreateLogger>;

  constructor(@inject(CHAIN_SDK) chainSdk: ChainSDK, @inject(LOGGER_FACTORY) createLogger: CreateLogger) {
    this.#logger = createLogger({ context: BlockchainStatusService.name });
    this.#chainSdk = chainSdk;
  }

  async getStatus(): Promise<{ isBlockchainReachable: boolean }> {
    try {
      await this.#chainSdk.cosmos.base.tendermint.v1beta1.getNodeInfo();
      return { isBlockchainReachable: true };
    } catch (error) {
      this.#logger.warn({ event: "BLOCKCHAIN_UNREACHABLE", error });
      return { isBlockchainReachable: false };
    }
  }
}
