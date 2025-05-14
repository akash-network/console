import { generateMock } from "@anatine/zod-mock";
import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";
import type { MockProxy } from "jest-mock-extended";

import { LoggerService } from "@src/common/services/logger/logger.service";
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
