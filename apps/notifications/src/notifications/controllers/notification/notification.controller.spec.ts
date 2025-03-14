import { generateMock } from '@anatine/zod-mock';
import { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import { MockProxy } from 'jest-mock-extended';

import { LoggerService } from '@src/common/services/logger.service';
import { NotificationCommandDto } from '@src/notifications/dto/NotificationCommand.dto';
import { NotificationRouterService } from '@src/notifications/services/notification-router/notification-router.service';
import { NotificationController } from './notification.controller';

import { MockProvider } from '@test/mocks/provider.mock';

describe(NotificationController.name, () => {
  it('should be defined', async () => {
    const { controller } = await setup();
    expect(controller).toBeDefined();
  });

  describe('send', () => {
    it('should send a notification', async () => {
      const { controller, notificationRouter } = await setup();

      const notificationCommand = generateMock(NotificationCommandDto.schema);
      await controller.send(notificationCommand);

      expect(notificationRouter.send).toHaveBeenCalledWith(notificationCommand);
    });
  });

  async function setup(): Promise<{
    controller: NotificationController;
    notificationRouter: MockProxy<NotificationRouterService>;
    loggerService: MockProxy<LoggerService>;
  }> {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationController,
        MockProvider(NotificationRouterService),
        MockProvider(LoggerService),
      ],
    }).compile();

    return {
      controller: module.get<NotificationController>(NotificationController),
      notificationRouter: module.get<MockProxy<NotificationRouterService>>(
        NotificationRouterService,
      ),
      loggerService: module.get<MockProxy<LoggerService>>(LoggerService),
    };
  }
});
