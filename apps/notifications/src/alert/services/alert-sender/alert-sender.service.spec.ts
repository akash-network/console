import { faker } from '@faker-js/faker';
import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import type { MockProxy } from 'jest-mock-extended';

import { TemplateService } from '@src/alert/services/template/template.service';
import { BrokerService } from '@src/broker';
import { AlertSenderService } from './alert-sender.service';

import { MockProvider } from '@test/mocks/provider.mock';

describe(AlertSenderService.name, () => {
  const vars = { usage: 90, server: 'node-1' };

  describe('send', () => {
    it('should send a notification with prefix', async () => {
      const { service, brokerService, contactPointId } = await setup();

      await service.send({
        alert: {
          summary: 'CPU usage: {{usage}}%',
          description: 'Server {{server}} has high CPU load.',
          contactPointId,
        },
        vars,
        summaryPrefix: 'FIRING',
      });

      expect(brokerService.publish).toHaveBeenCalledWith(
        'notification.v1.send',
        {
          payload: {
            summary: '[FIRING] CPU usage: 90%',
            description: 'Server node-1 has high CPU load.',
          },
          contactPointId,
        },
      );
    });

    it('should send a notification without prefix', async () => {
      const { service, brokerService, contactPointId } = await setup();

      await service.send({
        alert: {
          summary: 'CPU usage: {{usage}}%',
          description: 'Server {{server}} has high CPU load.',
          contactPointId,
        },
        vars,
      });

      expect(brokerService.publish).toHaveBeenCalledWith(
        'notification.v1.send',
        {
          payload: {
            summary: 'CPU usage: 90%',
            description: 'Server node-1 has high CPU load.',
          },
          contactPointId,
        },
      );
    });
  });

  async function setup(): Promise<{
    service: AlertSenderService;
    brokerService: MockProxy<BrokerService>;
    contactPointId: string;
  }> {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AlertSenderService,
        MockProvider(BrokerService),
        TemplateService,
      ],
    }).compile();
    const contactPointId = faker.string.uuid();

    return {
      service: module.get(AlertSenderService),
      brokerService: module.get(BrokerService),
      contactPointId,
    };
  }
});
