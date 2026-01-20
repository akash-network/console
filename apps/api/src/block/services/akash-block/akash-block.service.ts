import { singleton } from "tsyringe";

import { GetBlockByHeightResponse, ListBlocksResponse } from "@src/block/http-schemas/block.schema";
import { AkashBlockRepository } from "@src/block/repositories/akash-block/akash-block.repository";
import { Memoize } from "@src/caching/helpers";

@singleton()
export class AkashBlockService {
  constructor(private readonly akashBlockRepository: AkashBlockRepository) {}

  @Memoize({ ttlInSeconds: 15 })
  async getBlocks(limit: number): Promise<ListBlocksResponse> {
    return await this.akashBlockRepository.getBlocks(limit);
  }

  @Memoize({ ttlInSeconds: 60 })
  async getBlockWithTransactionsByHeight(height: number): Promise<GetBlockByHeightResponse | null> {
    return await this.akashBlockRepository.getBlockWithTransactionsByHeight(height);
  }
}
