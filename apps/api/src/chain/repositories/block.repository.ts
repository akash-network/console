import { Block } from "@akashnetwork/database/dbSchemas";
import { singleton } from "tsyringe";

@singleton()
export class BlockRepository {
  async getLatestProcessedHeight(): Promise<number> {
    const height = await Block.max("height", { where: { isProcessed: true } });

    return (height as number) ?? 0;
  }
}
