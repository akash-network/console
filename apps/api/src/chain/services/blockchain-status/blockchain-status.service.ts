import { inject, singleton } from "tsyringe";

import { LoggerService } from "@src/core/providers/logging.provider";

import { CHAIN_SDK, type ChainSDK } from "../../providers/chain-sdk.provider";

@singleton()
export class BlockchainStatusService {
  readonly #chainSdk: ChainSDK;
  readonly #logger: LoggerService;

  constructor(@inject(CHAIN_SDK) chainSdk: ChainSDK, logger: LoggerService) {
    this.#chainSdk = chainSdk;
    this.#logger = logger;
    this.#logger.setContext(BlockchainStatusService.name);
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
