import { Block, StargateClient } from "@cosmjs/stargate";
import { Injectable } from "@nestjs/common";
import { backOff } from "exponential-backoff";

import { LoggerService } from "@src/common/services/logger/logger.service";

@Injectable()
export class BlockchainClientService {
  constructor(
    private readonly stargateClient: StargateClient,
    private readonly loggerService: LoggerService
  ) {
    loggerService.setContext(BlockchainClientService.name);
  }

  /**
   * Fetches a block by its height
   * @param height The block height to fetch or 'latest' for the latest block
   * @returns The block data
   */
  async getBlock(height: number | "latest"): Promise<Block> {
    const blockHeight = await this.toBlockHeight(height);
    this.loggerService.debug(`Fetching block at height: ${blockHeight}`);
    return await this.getBlockAwaited(blockHeight);
  }

  /**
   * Converts 'latest' to the current block height
   * @param height The block height or 'latest'
   * @returns The numeric block height
   */
  private async toBlockHeight(height: number | "latest"): Promise<number> {
    return height === "latest" ? this.stargateClient.getHeight() : height;
  }

  private async getBlockAwaited(height: number): Promise<Block> {
    return await backOff(() => this.stargateClient.getBlock(height), {
      maxDelay: 5_000,
      startingDelay: 500,
      timeMultiple: 2,
      numOfAttempts: 5,
      jitter: "none"
    });
  }
}
