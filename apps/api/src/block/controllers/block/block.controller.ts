import { singleton } from "tsyringe";

import { GetBlockByHeightResponse, ListBlocksResponse } from "@src/block/http-schemas/block.schema";
import { AkashBlockService } from "@src/block/services/akash-block/akash-block.service";

@singleton()
export class BlockController {
  constructor(private readonly akashBlocksService: AkashBlockService) {}

  async getBlocks(limit: number): Promise<ListBlocksResponse> {
    return await this.akashBlocksService.getBlocks(limit);
  }

  async getBlockByHeight(height: number): Promise<GetBlockByHeightResponse | null> {
    return await this.akashBlocksService.getBlockByHeight(height);
  }
}
