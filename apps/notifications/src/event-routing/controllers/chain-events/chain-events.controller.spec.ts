import { generateMock } from '@anatine/zod-mock';
import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import type { MockProxy } from 'jest-mock-extended';

import { BrokerService } from '@src/broker/services/broker/broker.service';
import { LoggerService } from '@src/common/services/logger.service';
import { MsgCloseDeploymentDto } from '@src/event-routing/dto/MsgCloseDeployment.dto';
import { EventMatchingService } from '@src/event-routing/services/event-matching/event-matching.service';
import { ChainEventsController } from './chain-events.controller';

import { MockProvider } from '@test/mocks/provider.mock';
import { generateMockNotificationsParams } from '@test/seeders/notification.seeder';
describe(ChainEventsController.name, () => {
  it('should be defined', async () => {
    const { controller } = await setup();
    expect(controller).toBeDefined();
  });

  describe('processDeploymentClosed', () => {
    it('should log the received event and publish notifications', async () => {
      const { controller, brokerService, eventMatchingService, loggerService } =
        await setup();

      const mockEvent = generateMock(MsgCloseDeploymentDto.schema);
      const dseq = mockEvent.value.id.dseq.low.toString();
      const owner = mockEvent.value.id.owner;

      const mockNotifications = generateMockNotificationsParams(2, {
        payload: {
          deploymentId: dseq,
          owner: owner,
        },
      });

      eventMatchingService.match.mockResolvedValue(mockNotifications);

      await controller.processDeploymentClosed(mockEvent);

      expect(loggerService.log).toHaveBeenCalledWith(
        'received MsgCloseDeployment',
        mockEvent,
      );
      expect(eventMatchingService.match).toHaveBeenCalledWith(mockEvent);
      expect(brokerService.publishAll).toHaveBeenCalledWith(
        mockNotifications.map((notification) => ({
          eventName: 'notification.v1.send',
          event: notification,
        })),
      );
    });

    it('should handle the case when no notifications are matched', async () => {
      const { controller, brokerService, eventMatchingService, loggerService } =
        await setup();

      const mockEvent = generateMock(MsgCloseDeploymentDto.schema);

      eventMatchingService.match.mockResolvedValue([]);

      await controller.processDeploymentClosed(mockEvent);

      expect(loggerService.log).toHaveBeenCalledWith(
        'received MsgCloseDeployment',
        mockEvent,
      );
      expect(eventMatchingService.match).toHaveBeenCalledWith(mockEvent);
      expect(brokerService.publishAll).not.toHaveBeenCalled();
    });
  });

  async function setup(): Promise<{
    controller: ChainEventsController;
    brokerService: MockProxy<BrokerService>;
    eventMatchingService: MockProxy<EventMatchingService>;
    loggerService: MockProxy<LoggerService>;
  }> {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChainEventsController,
        MockProvider(BrokerService),
        MockProvider(EventMatchingService),
        MockProvider(LoggerService),
      ],
    }).compile();

    return {
      controller: module.get<ChainEventsController>(ChainEventsController),
      brokerService: module.get<MockProxy<BrokerService>>(BrokerService),
      eventMatchingService:
        module.get<MockProxy<EventMatchingService>>(EventMatchingService),
      loggerService: module.get<MockProxy<LoggerService>>(LoggerService),
    };
  }
});
