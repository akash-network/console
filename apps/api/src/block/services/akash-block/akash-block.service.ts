import { singleton } from "tsyringe";

import { GetBlockByHeightResponse, ListBlocksResponse } from "@src/block/http-schemas/block.schema";
import { AkashBlockRepository } from "@src/block/repositories/akash-block/akash-block.repository";
import { Memoize } from "@src/caching/helpers";
import { averageBlockTime } from "@src/utils/constants";

@singleton()
export class AkashBlockService {
  constructor(private readonly akashBlockRepository: AkashBlockRepository) {}

  @Memoize({ ttlInSeconds: averageBlockTime })
  async getBlocks(limit: number): Promise<ListBlocksResponse> {
    return await this.akashBlockRepository.getBlocks(limit);
  }

  @Memoize({ ttlInSeconds: 60 })
  async getBlockWithTransactionsByHeight(height: number): Promise<GetBlockByHeightResponse | null> {
    return await this.akashBlockRepository.getBlockWithTransactionsByHeight(height);
  }
}
