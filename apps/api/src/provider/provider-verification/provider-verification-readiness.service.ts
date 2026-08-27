import type { LoggerService } from "@akashnetwork/logging";
import { inject, singleton } from "tsyringe";

import { BlockRepository } from "@src/chain/repositories/block.repository";
import { BlockHttpService } from "@src/chain/services/block-http/block-http.service";
import { type CreateLogger, LOGGER_FACTORY } from "@src/core/providers/logging.provider";
import { CoreConfigService } from "@src/core/services/core-config/core-config.service";

@singleton()
export class ProviderVerificationReadinessService {
  readonly #logger: LoggerService;

  constructor(
    private readonly blockRepository: BlockRepository,
    private readonly blockHttpService: BlockHttpService,
    private readonly coreConfig: CoreConfigService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.#logger = createLogger({ context: ProviderVerificationReadinessService.name });
  }

  async isReady(): Promise<boolean> {
    try {
      const [indexedHeight, chainHeight] = await Promise.all([this.blockRepository.getLatestProcessedHeight(), this.blockHttpService.getCurrentHeight()]);
      const maxLag = this.coreConfig.get("AEP86_PROVIDER_VERIFICATION_MAX_INDEXER_LAG_BLOCKS");
      const ready = indexedHeight > 0 && Math.abs(chainHeight - indexedHeight) <= maxLag;

      if (!ready) {
        this.#logger.warn({ event: "PROVIDER_VERIFICATION_INDEXER_NOT_READY", chainHeight, indexedHeight, maxLag });
      }

      return ready;
    } catch (error) {
      this.#logger.warn({ event: "PROVIDER_VERIFICATION_READINESS_CHECK_FAILED", error });
      return false;
    }
  }
}
