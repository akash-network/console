import { BlockHttpService as BaseBlockHttpService } from "@akashnetwork/http-sdk";
import { singleton } from "tsyringe";

import { Memoize } from "@src/caching/helpers";
import { averageBlockTime } from "@src/utils/constants";

@singleton()
export class BlockHttpService {
  constructor(private readonly blockHttpService: BaseBlockHttpService) {}

  @Memoize({ ttlInSeconds: averageBlockTime })
  async getCurrentHeight(): Promise<number> {
    return await this.blockHttpService.getCurrentHeight();
  }
}
