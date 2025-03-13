import { Block, StargateClient } from '@cosmjs/stargate';
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class BlockchainClientService {
  private readonly logger = new Logger(BlockchainClientService.name);

  constructor(private readonly stargateClient: StargateClient) {}

  /**
   * Fetches a block by its height
   * @param height The block height to fetch or 'latest' for the latest block
   * @returns The block data
   */
  async getBlock(height: number | 'latest'): Promise<Block> {
    const blockHeight = await this.toBlockHeight(height);
    this.logger.debug(`Fetching block at height: ${blockHeight}`);
    return await this.stargateClient.getBlock(blockHeight);
  }

  /**
   * Converts 'latest' to the current block height
   * @param height The block height or 'latest'
   * @returns The numeric block height
   */
  private async toBlockHeight(height: number | 'latest'): Promise<number> {
    return height === 'latest' ? this.stargateClient.getHeight() : height;
  }
}
