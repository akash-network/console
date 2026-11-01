import { inject, singleton } from "tsyringe";

import { BlockHttpService } from "@src/chain/services/block-http/block-http.service";
import { type CreateLogger, LOGGER_FACTORY } from "@src/core";

export interface BlockchainStatus {
  isBlockchainReachable: boolean;
  latestBlockHeight: number | null;
}

@singleton()
export class BlockchainStatusService {
  readonly #blockHttpService: BlockHttpService;
  readonly #logger: ReturnType<CreateLogger>;

  constructor(blockHttpService: BlockHttpService, @inject(LOGGER_FACTORY) createLogger: CreateLogger) {
    this.#logger = createLogger({ context: BlockchainStatusService.name });
    this.#blockHttpService = blockHttpService;
  }

  /** Every browser tab polls this, so it reads the height shared with the rest of the API instead of asking the chain per request. */
  async getStatus(): Promise<BlockchainStatus> {
    try {
      const latestBlockHeight = await this.#blockHttpService.getCurrentHeight();
      return { isBlockchainReachable: true, latestBlockHeight };
    } catch (error) {
      this.#logger.warn({ event: "BLOCKCHAIN_UNREACHABLE", error });
      return { isBlockchainReachable: false, latestBlockHeight: null };
    }
  }
}
