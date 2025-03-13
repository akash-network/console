import { Injectable } from '@nestjs/common';

import {
  BlockData,
  BlockMessageParserService,
  MessageTypeFilter,
} from '../block-message-parser/block-message-parser.service';
import { BlockchainClientService } from '../blockchain-client/blockchain-client.service';

@Injectable()
export class BlockMessageService {
  constructor(
    private readonly blockchainClient: BlockchainClientService,
    private readonly blockMessageParser: BlockMessageParserService,
  ) {}

  /**
   * Gets a block with its messages, optionally filtered by message types
   * @param height The block height to fetch, or 'latest' for the latest block
   * @param messageTypes Optional array of message types to filter for
   * @returns The block data with messages
   */
  async getMessages(
    height: number | 'latest',
    messageTypes?: MessageTypeFilter[],
  ): Promise<BlockData> {
    const block = await this.blockchainClient.getBlock(height);
    return this.blockMessageParser.parseBlockMessages(block, messageTypes);
  }
}
