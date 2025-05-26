import { singleton } from "tsyringe";

import { AkashBlockService } from "@src/block/services/akash-block/akash-block.service";

@singleton()
export class BlockController {
  constructor(private readonly akashBlocksService: AkashBlockService) {}

  async getBlocks(limit: number) {
    return this.akashBlocksService.getBlocks(limit);
  }

  async getBlockByHeight(height: number) {
    return this.akashBlocksService.getBlockByHeight(height);
  }
}
