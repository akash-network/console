import { generateMock } from '@anatine/zod-mock';
import { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import { MockProxy } from 'jest-mock-extended';

import { NotificationCommandDto } from '@src/notifications/dto/NotificationCommand.dto';
import { EmailSenderService } from '../email-sender/email-sender.service';
import { NotificationRouterService } from './notification-router.service';

import { MockProvider } from '@test/mocks/provider.mock';

describe(NotificationRouterService.name, () => {
  it('should be defined', async () => {
    const { service } = await setup();
    expect(service).toBeDefined();
  });

  describe('send', () => {
    it('should send an email', async () => {
      const { service, emailSenderService } = await setup();

      const notificationCommand = generateMock(NotificationCommandDto.schema);
      await service.send(notificationCommand);

      expect(emailSenderService.send).toHaveBeenCalledWith(
        notificationCommand.channel,
        notificationCommand.payload,
      );
    });
  });

  async function setup(): Promise<{
    service: NotificationRouterService;
    emailSenderService: MockProxy<EmailSenderService>;
  }> {
    const module: TestingModule = await Test.createTestingModule({
      providers: [NotificationRouterService, MockProvider(EmailSenderService)],
    }).compile();

    return {
      service: module.get<NotificationRouterService>(NotificationRouterService),
      emailSenderService:
        module.get<MockProxy<EmailSenderService>>(EmailSenderService),
    };
  }
});
