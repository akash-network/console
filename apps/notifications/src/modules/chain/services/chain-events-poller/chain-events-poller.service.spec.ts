import { MsgCloseDeployment, MsgCreateDeployment } from "@akashnetwork/akash-api/v1beta3";
import { StargateClient } from "@cosmjs/stargate";
import { ConfigModule, registerAs } from "@nestjs/config";
import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";
import type { MockProxy } from "jest-mock-extended";
import { setTimeout as delay } from "timers/promises";

import { eventKeyRegistry } from "@src/common/config/event-key-registry.config";
import { LoggerService } from "@src/common/services/logger/logger.service";
import { ShutdownService } from "@src/common/services/shutdown/shutdown.service";
import { BrokerService } from "@src/infrastructure/broker";
import { NAMESPACE } from "@src/modules/chain/config";
import { BlockCursorRepository } from "@src/modules/chain/repositories/block-cursor/block-cursor.repository";
import { BlockMessageService } from "../block-message/block-message.service";
import type { BlockData } from "../block-message-parser/block-message-parser.service";
import { TxEventsService } from "../tx-events-service/tx-events.service";
import { ChainEventsPollerService } from "./chain-events-poller.service";

import { MockProvider } from "@test/mocks/provider.mock";
import { generateMockBlockData } from "@test/seeders/block.seeder";
import { generateMsgCloseDeployment, generateMsgCreateDeployment } from "@test/seeders/message.seeder";

describe(ChainEventsPollerService.name, () => {
  it("initializes poller, processes a new block and publishes related events", async () => {
    const { service, blockCursorRepository, blockMessageService, module, CURRENT_HEIGHT } = await setup();

    const createDeploymentMessage = generateMsgCreateDeployment();
    const closeDeploymentMessage = generateMsgCloseDeployment();

    const mockBlock: BlockData = generateMockBlockData({
      height: CURRENT_HEIGHT + 1,
      messages: [createDeploymentMessage, closeDeploymentMessage]
    });

    blockMessageService.getMessages.mockResolvedValueOnce(mockBlock);

    service.onModuleInit();
    await delay(500);
    service.onModuleDestroy();

    expect(blockCursorRepository.ensureInitialized).toHaveBeenCalledWith(CURRENT_HEIGHT);

    expect(blockMessageService.getMessages).toHaveBeenCalledWith(CURRENT_HEIGHT + 1, [MsgCloseDeployment["$type"], MsgCreateDeployment["$type"]]);

    expect(module.get(BrokerService).publishAll).toHaveBeenCalledWith([
      {
        eventName: eventKeyRegistry.blockCreated,
        event: { height: mockBlock.height }
      },
      {
        eventName: mockBlock.messages[0].type,
        event: mockBlock.messages[0]
      },
      {
        eventName: mockBlock.messages[1].type,
        event: mockBlock.messages[1]
      },
      {
        eventName: "akash.v1.deployment.deployment-closed",
        event: {
          type: "akash.v1",
          module: "deployment",
          action: "deployment-closed",
          owner: "akash1qh0f0h7jlq4x5gpxghrxvps5l09y7uuvcumcyd",
          dseq: "22350842"
        }
      }
    ]);
  });

  it("shuts down application when block processing consistently fails", async () => {
    const { service, module, blockCursorRepository, blockMessageService, CURRENT_HEIGHT } = await setup();

    blockCursorRepository.getNextBlockForProcessing.mockImplementation(async () => {
      throw new Error("Block Cursor lookup failed");
    });

    const mockBlock: BlockData = generateMockBlockData({
      height: CURRENT_HEIGHT + 1
    });

    blockMessageService.getMessages.mockResolvedValueOnce(mockBlock);

    service.onModuleInit();
    await delay(500);

    expect(module.get(ShutdownService).shutdown).toHaveBeenCalled();
  });

  it("completes currently processed block before shutdown is finalized", async () => {
    const { service, blockMessageService } = await setup();
    const controller = Promise.withResolvers<ReturnType<typeof generateMockBlockData>>();

    blockMessageService.getMessages.mockImplementation(() => controller.promise);

    await service.onModuleInit();
    await delay(10);
    const finalizeDestroy = jest.fn();
    service.onModuleDestroy().finally(finalizeDestroy);
    await delay(100);

    expect(blockMessageService.getMessages).toHaveBeenCalledTimes(1);
    expect(finalizeDestroy).not.toHaveBeenCalled();

    controller.resolve(generateMockBlockData({ time: new Date().toISOString() }));
    await delay(100);
    expect(finalizeDestroy).toHaveBeenCalled();
  });

  async function setup(): Promise<{
    module: TestingModule;
    service: ChainEventsPollerService;
    blockMessageService: MockProxy<BlockMessageService>;
    blockCursorRepository: MockProxy<BlockCursorRepository>;
    loggerService: MockProxy<LoggerService>;
    txEventsService: MockProxy<TxEventsService>;
    CURRENT_HEIGHT: number;
  }> {
    const module = await Test.createTestingModule({
      imports: [
        ConfigModule.forFeature(
          registerAs(NAMESPACE, () => ({
            BLOCK_TIME_SEC: 0.1,
            pollingConfig: {
              maxDelay: 30,
              startingDelay: 3,
              timeMultiple: 2,
              numOfAttempts: 5,
              jitter: "none"
            }
          }))
        )
      ],
      providers: [
        ChainEventsPollerService,
        MockProvider(BrokerService),
        MockProvider(BlockMessageService),
        MockProvider(BlockCursorRepository),
        MockProvider(StargateClient as any),
        MockProvider(ShutdownService),
        MockProvider(LoggerService),
        MockProvider(TxEventsService)
      ]
    }).compile();

    const CURRENT_HEIGHT = 100;

    const stargateClient = module.get<MockProxy<StargateClient>>(StargateClient);
    stargateClient.getHeight.mockResolvedValue(CURRENT_HEIGHT);

    const blockCursorRepository = module.get<MockProxy<BlockCursorRepository>>(BlockCursorRepository);
    blockCursorRepository.getNextBlockForProcessing.mockImplementation(async cb => {
      const height = CURRENT_HEIGHT + 1;
      return await cb(height);
    });

    const txEventsService = module.get<MockProxy<TxEventsService>>(TxEventsService);
    txEventsService.getBlockEvents.mockResolvedValue([
      {
        type: "akash.v1",
        module: "deployment",
        action: "deployment-closed",
        owner: "akash1qh0f0h7jlq4x5gpxghrxvps5l09y7uuvcumcyd",
        dseq: "22350842"
      }
    ]);

    return {
      module,
      service: module.get(ChainEventsPollerService),
      blockMessageService: module.get(BlockMessageService),
      blockCursorRepository,
      loggerService: module.get(LoggerService),
      txEventsService,
      CURRENT_HEIGHT
    };
  }
});
