import { generateMock } from '@anatine/zod-mock';
import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import type { MockProxy } from 'jest-mock-extended';
import type PgBoss from 'pg-boss';

import { BrokerService } from '@src/broker/services/broker/broker.service';
import { LoggerService } from '@src/common/services/logger.service';
import { NotificationController } from '@src/notifications/controllers/notification/notification.controller';
import { NotificationCommandDto } from '@src/notifications/dto/NotificationCommand.dto';
import { NotificationCommandHandler } from './notification-command.handler';

import { MockProvider } from '@test/mocks/provider.mock';

describe(NotificationCommandHandler.name, () => {
  it('should be defined', async () => {
    const { handler } = await setup();
    expect(handler).toBeDefined();
  });

  it('should set the logger context in the constructor', async () => {
    const { loggerService } = await setup();
    expect(loggerService.setContext).toHaveBeenCalledWith(
      NotificationCommandHandler.name,
    );
  });

  describe('onModuleInit', () => {
    it('should subscribe to notification command events with the correct parameters', async () => {
      const { handler, brokerService, notificationController } = await setup();

      const notificationData = generateMock(NotificationCommandDto.schema);

      brokerService.subscribe.mockImplementation(
        (eventName, options, callback) => {
          const typedCallback = callback as PgBoss.WorkHandler<any>;
          typedCallback([{ data: notificationData } as PgBoss.Job]);
          return Promise.resolve();
        },
      );

      await handler.onModuleInit();

      expect(brokerService.subscribe).toHaveBeenCalledWith(
        'notification.v1.send',
        { prefetchCount: 10 },
        expect.any(Function),
      );
      expect(notificationController.send).toHaveBeenCalledWith(
        notificationData,
      );
    });
  });

  async function setup(): Promise<{
    handler: NotificationCommandHandler;
    brokerService: MockProxy<BrokerService>;
    notificationController: MockProxy<NotificationController>;
    loggerService: MockProxy<LoggerService>;
  }> {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationCommandHandler,
        MockProvider(BrokerService),
        MockProvider(NotificationController),
        MockProvider(LoggerService),
      ],
    }).compile();

    return {
      handler: module.get<NotificationCommandHandler>(
        NotificationCommandHandler,
      ),
      brokerService: module.get<MockProxy<BrokerService>>(BrokerService),
      notificationController: module.get<MockProxy<NotificationController>>(
        NotificationController,
      ),
      loggerService: module.get<MockProxy<LoggerService>>(LoggerService),
    };
  }
});
