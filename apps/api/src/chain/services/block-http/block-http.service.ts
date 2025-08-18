import { singleton } from "tsyringe";

import { Memoize } from "@src/caching/helpers";
import { BlockHttpServiceWrapper } from "@src/core/services/http-service-wrapper/http-service-wrapper";
import { averageBlockTime } from "@src/utils/constants";

@singleton()
export class BlockHttpService {
  constructor(private readonly blockHttpService: BlockHttpServiceWrapper) {}

  @Memoize({ ttlInSeconds: averageBlockTime })
  async getCurrentHeight() {
    return await this.blockHttpService.getCurrentHeight();
  }
}
