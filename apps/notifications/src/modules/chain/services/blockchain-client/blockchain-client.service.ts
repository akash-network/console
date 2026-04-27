import { Block, StargateClient } from "@cosmjs/stargate";
import { Injectable } from "@nestjs/common";
import { ExponentialBackoff, handleAll, retry } from "cockatiel";

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
  async getBlock(height: number | "latest", signal?: AbortSignal): Promise<Block> {
    const blockHeight = await this.toBlockHeight(height);
    this.loggerService.debug(`Fetching block at height: ${blockHeight}`);
    return await this.getBlockAwaited(blockHeight, signal);
  }

  /**
   * Converts 'latest' to the current block height
   * @param height The block height or 'latest'
   * @returns The numeric block height
   */
  private async toBlockHeight(height: number | "latest"): Promise<number> {
    return height === "latest" ? this.stargateClient.getHeight() : height;
  }

  private readonly retryExecutor = retry(handleAll, {
    maxAttempts: 5,
    backoff: new ExponentialBackoff({
      initialDelay: 500,
      maxDelay: 5_000,
      exponent: 2
    })
  });

  private async getBlockAwaited(height: number, signal?: AbortSignal): Promise<Block> {
    return await this.retryExecutor.execute(async ({ signal: retrySignal }) => {
      retrySignal.throwIfAborted();
      return await this.stargateClient.getBlock(height);
    }, signal);
  }
}
