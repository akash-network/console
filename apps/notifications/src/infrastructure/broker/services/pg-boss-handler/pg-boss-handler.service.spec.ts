import { generateMock } from "@anatine/zod-mock";
import { faker } from "@faker-js/faker";
import type { DiscoveredMethod } from "@golevelup/nestjs-discovery";
import { DiscoveryService } from "@golevelup/nestjs-discovery";
import { Test, type TestingModule } from "@nestjs/testing";
import { DrizzleQueryError } from "drizzle-orm";
import type { ZodDto } from "nestjs-zod";
import { createZodDto } from "nestjs-zod";
import type { Job } from "pg-boss";
import { describe, expect, it, type Mock, vi } from "vitest";
import type { MockProxy } from "vitest-mock-extended";
import { z } from "zod";

import { LoggerService } from "@src/common/services/logger/logger.service";
import { BrokerService } from "@src/infrastructure/broker/services/broker/broker.service";
import { PgBossHandlerService } from "./pg-boss-handler.service";

import { MockProvider } from "@test/mocks/provider.mock";

describe(PgBossHandlerService.name, () => {
  it("should set the logger context in the constructor", async () => {
    const { loggerService } = await setup();

    expect(loggerService.setContext).toHaveBeenCalledWith(PgBossHandlerService.name);
  });

  it("should subscribe to events with the correct parameters", async () => {
    const { service, brokerService, testKey } = await setup();
    await service.startAllHandlers();

    expect(brokerService.subscribe).toHaveBeenCalledWith(testKey, { prefetchCount: 10 }, expect.any(Function));
  });

  it("should process messages correctly when subscribed", async () => {
    const { service, brokerService, loggerService, dto, handlerMethod, testKey } = await setup();
    const mockMessage = generateMock(dto.schema);
    const mockJob = { data: mockMessage } as Job<any>;

    brokerService.subscribe.mockImplementation(async (key, options, callback) => {
      await callback(mockJob);
    });

    await service.startAllHandlers();

    expect(handlerMethod).toHaveBeenCalledWith(mockMessage);
    expect(loggerService.log).toHaveBeenCalledWith({
      event: "MESSAGE_WORKER_SUCCESS",
      key: testKey
    });
  });

  it("should handle errors from the message handler", async () => {
    const { service, brokerService, loggerService, dto, handlerMethod, testKey } = await setup();
    const mockError = new Error(faker.lorem.sentence());
    const mockMessage = generateMock(dto.schema);
    const mockJob = { data: mockMessage } as Job<any>;

    brokerService.subscribe.mockImplementation(async (key, options, callback) => {
      try {
        await callback(mockJob);
      } catch {
        return Promise.resolve();
      }
    });
    handlerMethod.mockRejectedValue(mockError);

    await service.startAllHandlers();

    expect(loggerService.error).toHaveBeenCalledWith({
      event: "MESSAGE_WORKER_FAILURE",
      key: testKey,
      job: mockJob,
      error: mockError
    });
  });

  it("logs and rethrows a failed query's error with its params redacted, so neither the log nor pg-boss gets them", async () => {
    const { service, brokerService, loggerService, dto, handlerMethod, testKey } = await setup();
    const insertChannel = 'insert into "notification_channels" ("config") values ($1)';
    let rethrown: unknown;

    brokerService.subscribe.mockImplementation(async (key, options, callback) => {
      try {
        await callback({ data: generateMock(dto.schema) } as Job<any>);
      } catch (error) {
        rethrown = error;
      }
    });
    handlerMethod.mockRejectedValue(new DrizzleQueryError(insertChannel, ['{"addresses":["user@example.com"]}'], new Error("connection terminated")));

    await service.startAllHandlers();

    expect((rethrown as DrizzleQueryError).message).toBe(`Failed query: ${insertChannel}\nparams: <redacted string>`);
    expect(loggerService.error).toHaveBeenCalledWith(expect.objectContaining({ event: "MESSAGE_WORKER_FAILURE", key: testKey, error: rethrown }));
  });

  async function setup(): Promise<{
    service: PgBossHandlerService;
    brokerService: MockProxy<BrokerService>;
    loggerService: MockProxy<LoggerService>;
    discoveryService: MockProxy<DiscoveryService>;
    handlerMethod: Mock;
    dto: ZodDto;
    testKey: string;
  }> {
    const TestMessageSchema = z.object({
      id: z.number()
    });

    class TestMessageDto extends createZodDto(TestMessageSchema) {}

    const key = faker.lorem.word();
    const handlerMethod = vi.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [PgBossHandlerService, MockProvider(DiscoveryService), MockProvider(BrokerService), MockProvider(LoggerService)]
    }).compile();

    const discoveryService = module.get<MockProxy<DiscoveryService>>(DiscoveryService);

    discoveryService.providerMethodsWithMetaAtKey.mockResolvedValue([
      {
        meta: {
          key,
          dto: TestMessageDto
        },
        discoveredMethod: {
          handler(message: TestMessageDto) {
            return handlerMethod(message);
          },
          parentClass: {
            instance: {}
          }
        } as unknown as DiscoveredMethod
      }
    ]);

    PgBossHandlerService.isInitialized = false;

    return {
      service: module.get<PgBossHandlerService>(PgBossHandlerService),
      brokerService: module.get<MockProxy<BrokerService>>(BrokerService),
      loggerService: module.get<MockProxy<LoggerService>>(LoggerService),
      dto: TestMessageDto,
      discoveryService,
      handlerMethod,
      testKey: key
    };
  }
});
