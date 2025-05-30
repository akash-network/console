import { singleton } from "tsyringe";

import { GetBlockByHeightResponse, ListBlocksResponse } from "@src/block/http-schemas/block.schema";
import { AkashBlockRepository } from "@src/block/repositories/akash-block/akash-block.repository";

@singleton()
export class AkashBlockService {
  constructor(private readonly akashBlockRepository: AkashBlockRepository) {}

  async getBlocks(limit: number): Promise<ListBlocksResponse> {
    return await this.akashBlockRepository.getBlocks(limit);
  }

  async getBlockByHeight(height: number): Promise<GetBlockByHeightResponse> | null {
    return await this.akashBlockRepository.getBlockByHeight(height);
  }
}
