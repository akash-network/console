import { singleton } from "tsyringe";

import { AkashBlockRepository } from "@src/block/repositories/akash-block/akash-block.repository";

@singleton()
export class AkashBlockService {
  constructor(private readonly akashBlockRepository: AkashBlockRepository) {}

  async getBlocks(limit: number) {
    return this.akashBlockRepository.getBlocks(limit);
  }

  async getBlockByHeight(height: number) {
    return this.akashBlockRepository.getBlockByHeight(height);
  }
}
