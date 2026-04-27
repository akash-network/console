import { MsgCloseDeployment, MsgCreateDeployment } from "@akashnetwork/chain-sdk/private-types/akash.v1beta4";
import { ConfigModule, registerAs } from "@nestjs/config";
import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";
import { setTimeout as delay } from "timers/promises";
import { describe, expect, it } from "vitest";
import type { MockProxy } from "vitest-mock-extended";

import { eventKeyRegistry } from "@src/common/config/event-key-registry.config";
import { LoggerService } from "@src/common/services/logger/logger.service";
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
    const { service, blockMessageService, module, CURRENT_HEIGHT } = await setup();

    const createDeploymentMessage = generateMsgCreateDeployment();
    const closeDeploymentMessage = generateMsgCloseDeployment();

    const mockBlock: BlockData = generateMockBlockData({
      height: CURRENT_HEIGHT + 1,
      messages: [createDeploymentMessage, closeDeploymentMessage]
    });

    blockMessageService.getMessages.mockResolvedValueOnce(mockBlock);

    service.onApplicationBootstrap();
    await delay(500);
    service.onModuleDestroy();

    expect(blockMessageService.getMessages).toHaveBeenCalledWith(
      CURRENT_HEIGHT + 1,
      [MsgCloseDeployment["$type"], MsgCreateDeployment["$type"]],
      expect.any(AbortSignal)
    );

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

  it("retries instead of shutting down when block processing consistently fails", async () => {
    const { service, blockCursorRepository, blockMessageService, CURRENT_HEIGHT } = await setup();

    const successBlock = generateMockBlockData({ height: CURRENT_HEIGHT + 1, time: new Date().toISOString() });

    blockCursorRepository.getNextBlockForProcessing
      .mockRejectedValueOnce(new Error("fail"))
      .mockRejectedValueOnce(new Error("fail"))
      .mockRejectedValueOnce(new Error("fail"))
      .mockRejectedValueOnce(new Error("fail"))
      .mockRejectedValueOnce(new Error("fail"))
      .mockImplementationOnce(async cb => await cb(CURRENT_HEIGHT + 1));

    blockMessageService.getMessages.mockResolvedValueOnce(successBlock);

    service.onApplicationBootstrap();
    await delay(1000);
    await service.onModuleDestroy();

    expect(blockMessageService.getMessages).toHaveBeenCalled();
  });

  it("logs CHAIN_POLLER_STALE when blocks fall behind threshold", async () => {
    const { service, blockCursorRepository, blockMessageService, loggerService, CURRENT_HEIGHT } = await setup();

    const staleTime = new Date(Date.now() - 2000).toISOString();
    const staleBlock = generateMockBlockData({ height: CURRENT_HEIGHT + 1, time: staleTime });

    blockMessageService.getMessages.mockResolvedValueOnce(staleBlock);

    blockCursorRepository.getNextBlockForProcessing
      .mockImplementationOnce(async cb => await cb(CURRENT_HEIGHT + 1))
      .mockRejectedValueOnce(new Error("fail"))
      .mockRejectedValueOnce(new Error("fail"))
      .mockRejectedValueOnce(new Error("fail"))
      .mockRejectedValueOnce(new Error("fail"))
      .mockRejectedValueOnce(new Error("fail"));

    service.onApplicationBootstrap();
    await delay(1000);
    await service.onModuleDestroy();

    expect(loggerService.error).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "CHAIN_POLLER_STALE",
        lastBlockTime: staleTime
      })
    );
  });

  it("logs CHAIN_POLLER_RECOVERED when catching up after being stale", async () => {
    const { service, blockCursorRepository, blockMessageService, loggerService, CURRENT_HEIGHT } = await setup();

    const staleTime = new Date(Date.now() - 2000).toISOString();
    const staleBlock = generateMockBlockData({ height: CURRENT_HEIGHT + 1, time: staleTime });
    const freshBlock = generateMockBlockData({ height: CURRENT_HEIGHT + 2, time: new Date().toISOString() });

    blockMessageService.getMessages.mockResolvedValueOnce(staleBlock).mockResolvedValueOnce(freshBlock);

    blockCursorRepository.getNextBlockForProcessing
      .mockImplementationOnce(async cb => await cb(CURRENT_HEIGHT + 1))
      .mockRejectedValueOnce(new Error("fail"))
      .mockRejectedValueOnce(new Error("fail"))
      .mockRejectedValueOnce(new Error("fail"))
      .mockRejectedValueOnce(new Error("fail"))
      .mockRejectedValueOnce(new Error("fail"))
      .mockImplementationOnce(async cb => await cb(CURRENT_HEIGHT + 2));

    service.onApplicationBootstrap();
    await delay(1500);
    await service.onModuleDestroy();

    expect(loggerService.error).toHaveBeenCalledWith(expect.objectContaining({ event: "CHAIN_POLLER_STALE" }));
    expect(loggerService.log).toHaveBeenCalledWith(expect.objectContaining({ event: "CHAIN_POLLER_RECOVERED" }));
  });

  describe("getReadinessStatus", () => {
    it("returns ok before poller has started", async () => {
      const { service } = await setup();

      const result = await service.getReadinessStatus();

      expect(result).toEqual({ status: "ok", data: { poller: true } });
    });

    it("returns ok while poller is running", async () => {
      const { service, blockMessageService } = await setup();
      blockMessageService.getMessages.mockResolvedValue(generateMockBlockData({ time: new Date().toISOString() }));

      await service.onApplicationBootstrap();
      await delay(50);

      const result = await service.getReadinessStatus();

      expect(result).toEqual({ status: "ok", data: { poller: true } });

      await service.onModuleDestroy();
    });

    it("returns ok while poller retries after errors", async () => {
      const { service, blockCursorRepository } = await setup();
      blockCursorRepository.getNextBlockForProcessing.mockRejectedValue(new Error("fail"));

      service.onApplicationBootstrap();
      await delay(500);

      const result = await service.getReadinessStatus();

      expect(result).toEqual({ status: "ok", data: { poller: true } });

      await service.onModuleDestroy();
    });
  });

  describe("getLivenessStatus", () => {
    it("delegates to getReadinessStatus", async () => {
      const { service } = await setup();

      const readiness = await service.getReadinessStatus();
      const liveness = await service.getLivenessStatus();

      expect(liveness).toEqual(readiness);
    });
  });

  it("shuts down cleanly when poller is running", async () => {
    const { service, blockMessageService } = await setup();
    blockMessageService.getMessages.mockResolvedValue(generateMockBlockData({ time: new Date().toISOString() }));

    await service.onApplicationBootstrap();
    await delay(50);
    await service.onModuleDestroy();
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
            BLOCK_STALE_THRESHOLD_SEC: 0.3,
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
        MockProvider(LoggerService),
        MockProvider(TxEventsService)
      ]
    }).compile();

    const CURRENT_HEIGHT = 100;

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
