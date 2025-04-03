import {
  MsgCloseDeployment,
  MsgCreateDeployment,
} from '@akashnetwork/akash-api/v1beta3';
import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import type { MockProxy } from 'jest-mock-extended';

import { BrokerService } from '@src/broker/services/broker/broker.service';
import { LoggerService } from '@src/common/services/logger.service';
import { BlockMessageService } from '../block-message/block-message.service';
import type { BlockData } from '../block-message-parser/block-message-parser.service';
import { ChainEventsService } from './chain-events.service';

import { MockProvider } from '@test/mocks/provider.mock';
import { generateMockBlockData } from '@test/seeders/block.seeder';
import {
  generateMsgCloseDeployment,
  generateMsgCreateDeployment,
} from '@test/seeders/message.seeder';

jest.useFakeTimers();

describe(ChainEventsService.name, () => {
  it('should be defined', async () => {
    const { service } = await setup();
    expect(service).toBeDefined();
  });

  it('should subscribe to chain events on module init', async () => {
    const { service, loggerService } = await setup();

    service.onModuleInit();

    expect(loggerService.setContext).toHaveBeenCalledWith('ChainEventsService');
    expect(loggerService.log).toHaveBeenCalledWith(
      'Subscribing to chain events...',
    );
  });

  it('should process new blocks and publish events', async () => {
    const { service, brokerService, blockMessageService } = await setup();

    const createDeploymentMessage = generateMsgCreateDeployment();
    const closeDeploymentMessage = generateMsgCloseDeployment();

    const mockBlock: BlockData = generateMockBlockData({
      messages: [createDeploymentMessage, closeDeploymentMessage],
    });

    blockMessageService.getMessages.mockResolvedValue(mockBlock);

    service.onModuleInit();

    jest.advanceTimersByTime(5000);
    await Promise.resolve();

    expect(blockMessageService.getMessages).toHaveBeenCalledWith('latest', [
      MsgCloseDeployment['$type'],
      MsgCreateDeployment['$type'],
    ]);

    expect(brokerService.publishAll).toHaveBeenCalledWith([
      {
        eventName: 'blockchain.v1.block.created',
        event: {
          height: mockBlock.height,
        },
      },
      {
        eventName: mockBlock.messages[0].type,
        event: mockBlock.messages[0],
      },
      {
        eventName: mockBlock.messages[1].type,
        event: mockBlock.messages[1],
      },
    ]);
  });

  it('should not process blocks with height less than or equal to the last processed height', async () => {
    const { service, brokerService, blockMessageService } = await setup();

    const mockBlock1: BlockData = generateMockBlockData({ height: 100 });
    const mockBlock2: BlockData = generateMockBlockData({ height: 100 });

    blockMessageService.getMessages
      .mockResolvedValueOnce(mockBlock1)
      .mockResolvedValueOnce(mockBlock2);

    service.onModuleInit();

    jest.advanceTimersByTime(5000);
    await Promise.resolve();

    jest.advanceTimersByTime(5000);
    await Promise.resolve();

    expect(brokerService.publishAll).toHaveBeenCalledTimes(1);
  });

  it('should handle errors when processing chain events', async () => {
    const { service, blockMessageService, loggerService } = await setup();

    const error = new Error('Test error');
    blockMessageService.getMessages.mockRejectedValue(error);

    service.onModuleInit();

    jest.advanceTimersByTime(5000);
    await Promise.resolve();

    expect(loggerService.error).toHaveBeenCalledWith(
      'Error processing chain events: Test error',
    );
  });

  async function setup(): Promise<{
    module: TestingModule;
    service: ChainEventsService;
    brokerService: MockProxy<BrokerService>;
    blockMessageService: MockProxy<BlockMessageService>;
    loggerService: MockProxy<LoggerService>;
  }> {
    const module = await Test.createTestingModule({
      providers: [
        ChainEventsService,
        MockProvider(BrokerService),
        MockProvider(BlockMessageService),
        MockProvider(LoggerService),
      ],
    }).compile();

    return {
      module,
      service: module.get<ChainEventsService>(ChainEventsService),
      brokerService: module.get<MockProxy<BrokerService>>(BrokerService),
      blockMessageService:
        module.get<MockProxy<BlockMessageService>>(BlockMessageService),
      loggerService: module.get<MockProxy<LoggerService>>(LoggerService),
    };
  }
});
