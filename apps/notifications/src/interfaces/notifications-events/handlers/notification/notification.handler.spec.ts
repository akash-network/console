import { generateMock } from "@anatine/zod-mock";
import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";
import { describe, expect, it } from "vitest";
import type { MockProxy } from "vitest-mock-extended";

import { LoggerService } from "@src/common/services/logger/logger.service";
import { PG_BOSS_HANDLER } from "@src/infrastructure/broker/decorators/handler.decorator";
import type { HandlerConfig } from "@src/infrastructure/broker/services/pg-boss-handler/pg-boss-handler.service";
import { NotificationCommandDto } from "@src/modules/notifications/dto/NotificationCommand.dto";
import { NotificationRouterService } from "@src/modules/notifications/services/notification-router/notification-router.service";
import { NotificationHandler } from "./notification.handler";

import { MockProvider } from "@test/mocks/provider.mock";

describe(NotificationHandler.name, () => {
  it("should be defined", async () => {
    const { controller } = await setup();
    expect(controller).toBeDefined();
  });

  describe("send", () => {
    it("should send a notification", async () => {
      const { controller, notificationRouter } = await setup();

      const notificationCommand = generateMock(NotificationCommandDto.schema);
      await controller.send(notificationCommand);

      expect(notificationRouter.send).toHaveBeenCalledWith(notificationCommand);
    });

    it("keeps retrying a failed notification with doubling gaps for over an hour", () => {
      const { retry = {} } = Reflect.getMetadata(PG_BOSS_HANDLER, NotificationHandler.prototype.send) as HandlerConfig<unknown>;
      const { retryLimit = 0, retryDelay = 0, retryDelayMax = Infinity } = retry;
      const gapsInSeconds = Array.from({ length: retryLimit }, (_, attempt) => Math.min(retryDelay * 2 ** attempt, retryDelayMax));

      expect(retry.retryBackoff).toBe(true);
      expect(gapsInSeconds.reduce((total, gap) => total + gap, 0)).toBeGreaterThan(60 * 60);
    });
  });

  async function setup(): Promise<{
    controller: NotificationHandler;
    notificationRouter: MockProxy<NotificationRouterService>;
    loggerService: MockProxy<LoggerService>;
  }> {
    const module: TestingModule = await Test.createTestingModule({
      providers: [NotificationHandler, MockProvider(NotificationRouterService), MockProvider(LoggerService)]
    }).compile();

    return {
      controller: module.get<NotificationHandler>(NotificationHandler),
      notificationRouter: module.get<MockProxy<NotificationRouterService>>(NotificationRouterService),
      loggerService: module.get<MockProxy<LoggerService>>(LoggerService)
    };
  }
});
