import { faker } from '@faker-js/faker';
import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import type { MockProxy } from 'jest-mock-extended';

import { BlockMessageParserService } from '../block-message-parser/block-message-parser.service';
import { BlockchainClientService } from '../blockchain-client/blockchain-client.service';
import { BlockMessageService } from './block-message.service';

import { MockProvider } from '@test/mocks/provider.mock';
import {
  generateMessageTypeFilters,
  generateMockBlockData,
  generateMockMessages,
  generateSimpleMockBlock,
} from '@test/seeders';

describe(BlockMessageService.name, () => {
  it('should be defined', async () => {
    const { service } = await setup();

    expect(service).toBeDefined();
  });

  describe('getMessages', () => {
    it('should fetch a block and parse its messages', async () => {
      const { service, blockchainClientService, blockMessageParserService } =
        await setup();

      const height = faker.number.int({ min: 1, max: 1000000 });
      const mockBlock = generateSimpleMockBlock({ height });
      const messages = generateMockMessages({ count: 3 });
      const mockBlockData = generateMockBlockData({
        height,
        messages,
      });

      blockchainClientService.getBlock.mockResolvedValue(mockBlock);
      blockMessageParserService.parseBlockMessages.mockReturnValue(
        mockBlockData,
      );

      const result = await service.getMessages(height);

      expect(blockchainClientService.getBlock).toHaveBeenCalledWith(height);
      expect(blockMessageParserService.parseBlockMessages).toHaveBeenCalledWith(
        mockBlock,
        undefined,
      );
      expect(result).toEqual(mockBlockData);
    });

    it('should fetch the latest block when height is "latest"', async () => {
      const { service, blockchainClientService, blockMessageParserService } =
        await setup();

      const mockBlock = generateSimpleMockBlock();
      const messages = generateMockMessages({ count: 2 });
      const mockBlockData = generateMockBlockData({ messages });

      blockchainClientService.getBlock.mockResolvedValue(mockBlock);
      blockMessageParserService.parseBlockMessages.mockReturnValue(
        mockBlockData,
      );

      const result = await service.getMessages('latest');

      expect(blockchainClientService.getBlock).toHaveBeenCalledWith('latest');
      expect(blockMessageParserService.parseBlockMessages).toHaveBeenCalledWith(
        mockBlock,
        undefined,
      );
      expect(result).toEqual(mockBlockData);
    });

    it('should filter messages by type when messageTypes is provided', async () => {
      const { service, blockchainClientService, blockMessageParserService } =
        await setup();

      const height = faker.number.int({ min: 1, max: 1000000 });
      const messageCount = faker.number.int({ min: 1, max: 5 });
      const messageTypes = generateMessageTypeFilters(messageCount);
      const mockBlock = generateSimpleMockBlock({ height });
      const messages = generateMockMessages({ count: messageCount });
      const mockBlockData = generateMockBlockData({
        height,
        messages,
      });

      blockchainClientService.getBlock.mockResolvedValue(mockBlock);
      blockMessageParserService.parseBlockMessages.mockReturnValue(
        mockBlockData,
      );

      const result = await service.getMessages(height, messageTypes);

      expect(blockchainClientService.getBlock).toHaveBeenCalledWith(height);
      expect(blockMessageParserService.parseBlockMessages).toHaveBeenCalledWith(
        mockBlock,
        messageTypes,
      );
      expect(result).toEqual(mockBlockData);
    });

    it('should return empty messages array when block has no transactions', async () => {
      const { service, blockchainClientService, blockMessageParserService } =
        await setup();

      const height = faker.number.int({ min: 1, max: 1000000 });
      const mockBlock = generateSimpleMockBlock({ height, txCount: 0 });
      const mockBlockData = generateMockBlockData({
        height,
        messages: [],
      });

      blockchainClientService.getBlock.mockResolvedValue(mockBlock);
      blockMessageParserService.parseBlockMessages.mockReturnValue(
        mockBlockData,
      );

      const result = await service.getMessages(height);

      expect(result.messages).toHaveLength(0);
    });
  });

  async function setup(): Promise<{
    module: TestingModule;
    service: BlockMessageService;
    blockchainClientService: MockProxy<BlockchainClientService>;
    blockMessageParserService: MockProxy<BlockMessageParserService>;
  }> {
    const module = await Test.createTestingModule({
      providers: [
        BlockMessageService,
        MockProvider(BlockchainClientService),
        MockProvider(BlockMessageParserService),
      ],
    }).compile();

    return {
      module,
      service: module.get<BlockMessageService>(BlockMessageService),
      blockchainClientService: module.get<MockProxy<BlockchainClientService>>(
        BlockchainClientService,
      ),
      blockMessageParserService: module.get<
        MockProxy<BlockMessageParserService>
      >(BlockMessageParserService),
    };
  }
});
