import { BlockHttpService as BlockHttpServiceCommon } from "@akashnetwork/http-sdk";
import { singleton } from "tsyringe";

import { Memoize } from "@src/caching/helpers";
import { averageBlockTime } from "@src/utils/constants";
import { BlockRepository } from "@src/chain/repositories/block.repository";

@singleton()
export class BlockHttpService {
  constructor(
    private readonly blockHttpService: BlockHttpServiceCommon,
    private readonly blockRepository: BlockRepository
  ) {}

  @Memoize({ ttlInSeconds: averageBlockTime })
  async getCurrentHeight() {
    return await this.blockHttpService.getCurrentHeight();
  }

  @Memoize({ ttlInSeconds: averageBlockTime })
  async getLatestProcessedHeight() {
    return await this.blockRepository.findLatestProcessedHeight();
  }
}
