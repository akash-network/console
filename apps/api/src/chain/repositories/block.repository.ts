import { Block } from "@akashnetwork/database/dbSchemas/base";
import { singleton } from "tsyringe";

@singleton()
export class BlockRepository {
  async findLatestProcessedHeight(): Promise<number> {
    const height = await Block.max("height", { where: { isProcessed: true } });

    return height as number;
  }
}
