import {
  MsgCloseDeployment,
  MsgCreateDeployment,
} from '@akashnetwork/akash-api/v1beta3';
import { StargateClient } from '@cosmjs/stargate';
import { ConfigService } from '@nestjs/config';
import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import type { MockProxy } from 'jest-mock-extended';
import { setTimeout as delay } from 'timers/promises';

import { LoggerService } from '@src/common/services/logger/logger.service';
import { ShutdownService } from '@src/common/services/shutdown/shutdown.service';
import { BrokerService } from '@src/infrastructure/broker';
import type { ChainEventsConfig } from '@src/modules/chain/config';
import { BlockCursorRepository } from '@src/modules/chain/repositories/block-cursor/block-cursor.repository';
import { BlockMessageService } from '../block-message/block-message.service';
import type { BlockData } from '../block-message-parser/block-message-parser.service';
import { ChainEventsPollerService } from './chain-events-poller.service';

import { MockProvider } from '@test/mocks/provider.mock';
import { generateMockBlockData } from '@test/seeders/block.seeder';
import {
  generateMsgCloseDeployment,
  generateMsgCreateDeployment,
} from '@test/seeders/message.seeder';

describe(ChainEventsPollerService.name, () => {
  it('initializes poller, processes a new block and publishes related events', async () => {
    const {
      service,
      blockCursorRepository,
      blockMessageService,
      module,
      CURRENT_HEIGHT,
    } = await setup();

    const createDeploymentMessage = generateMsgCreateDeployment();
    const closeDeploymentMessage = generateMsgCloseDeployment();

    const mockBlock: BlockData = generateMockBlockData({
      height: CURRENT_HEIGHT + 1,
      messages: [createDeploymentMessage, closeDeploymentMessage],
    });

    blockMessageService.getMessages.mockResolvedValueOnce(mockBlock);

    service.onModuleInit();
    await delay(500);
    service.onModuleDestroy();

    expect(blockCursorRepository.ensureInitialized).toHaveBeenCalledWith(
      CURRENT_HEIGHT,
    );

    expect(blockMessageService.getMessages).toHaveBeenCalledWith(
      CURRENT_HEIGHT + 1,
      [MsgCloseDeployment['$type'], MsgCreateDeployment['$type']],
    );

    expect(module.get(BrokerService).publishAll).toHaveBeenCalledWith([
      {
        eventName: 'blockchain.v1.block.created',
        event: { height: mockBlock.height },
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

  it('shuts down application when block processing consistently fails', async () => {
    const {
      service,
      module,
      blockCursorRepository,
      blockMessageService,
      CURRENT_HEIGHT,
    } = await setup();

    blockCursorRepository.getNextBlockForProcessing.mockImplementation(
      async () => {
        throw new Error('Block Cursor lookup failed');
      },
    );

    const mockBlock: BlockData = generateMockBlockData({
      height: CURRENT_HEIGHT + 1,
    });

    blockMessageService.getMessages.mockResolvedValueOnce(mockBlock);

    service.onModuleInit();
    await delay(500);

    expect(module.get(ShutdownService).shutdown).toHaveBeenCalled();
  });

  it('completes currently processed block before shutdown is finalized', async () => {
    const { service, blockMessageService } = await setup();

    blockMessageService.getMessages.mockImplementation(async () =>
      generateMockBlockData({ time: new Date().toISOString() }),
    );

    service.onModuleInit();
    await delay(10);
    service.onModuleDestroy();

    expect(blockMessageService.getMessages).toHaveBeenCalledTimes(1);
  });

  async function setup(): Promise<{
    module: TestingModule;
    service: ChainEventsPollerService;
    blockMessageService: MockProxy<BlockMessageService>;
    blockCursorRepository: MockProxy<BlockCursorRepository>;
    loggerService: MockProxy<LoggerService>;
    CURRENT_HEIGHT: number;
  }> {
    const module = await Test.createTestingModule({
      providers: [
        ChainEventsPollerService,
        MockProvider(BrokerService),
        MockProvider(BlockMessageService),
        MockProvider(BlockCursorRepository),
        MockProvider(StargateClient as any),
        MockProvider(ShutdownService),
        MockProvider(LoggerService),
        MockProvider(ConfigService),
      ],
    }).compile();

    const CURRENT_HEIGHT = 100;
    const CONFIG: ChainEventsConfig = {
      BLOCK_TIME_SEC: 0.1,
      pollingConfig: {
        maxDelay: 30,
        startingDelay: 3,
        timeMultiple: 2,
        numOfAttempts: 5,
        jitter: 'none',
      },
    };

    const configService = module.get<MockProxy<ConfigService>>(ConfigService);
    configService.getOrThrow.mockImplementation((key: string) => {
      return CONFIG[
        key.replace('chain-events.', '') as keyof ChainEventsConfig
      ];
    });

    const stargateClient =
      module.get<MockProxy<StargateClient>>(StargateClient);
    stargateClient.getHeight.mockResolvedValue(CURRENT_HEIGHT);

    const blockCursorRepository = module.get<MockProxy<BlockCursorRepository>>(
      BlockCursorRepository,
    );
    blockCursorRepository.getNextBlockForProcessing.mockImplementation(
      async (cb) => {
        const height = CURRENT_HEIGHT + 1;
        return await cb(height);
      },
    );

    return {
      module,
      service: module.get(ChainEventsPollerService),
      blockMessageService: module.get(BlockMessageService),
      blockCursorRepository,
      loggerService: module.get(LoggerService),
      CURRENT_HEIGHT,
    };
  }
});
