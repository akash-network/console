import { BlockHttpService as BlockHttpServiceCommon } from "@akashnetwork/http-sdk";
import { singleton } from "tsyringe";

import { Memoize } from "@src/caching/helpers";
import { averageBlockTime } from "@src/utils/constants";

@singleton()
export class BlockHttpService {
  constructor(private readonly blockHttpService: BlockHttpServiceCommon) {}

  @Memoize({ ttlInSeconds: averageBlockTime })
  async getCurrentHeight() {
    return await this.blockHttpService.getCurrentHeight();
  }
}
