import { generateMock } from '@anatine/zod-mock';
import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import type { MockProxy } from 'jest-mock-extended';

import { NotificationCommandDto } from '@src/notifications/dto/NotificationCommand.dto';
import { ContactPointRepository } from '@src/notifications/repositories/contact-point/contact-point.repository';
import { EmailSenderService } from '../email-sender/email-sender.service';
import { NotificationRouterService } from './notification-router.service';

import { MockProvider } from '@test/mocks/provider.mock';
import { generateContactPoint } from '@test/seeders/contact-point.seeder';

describe(NotificationRouterService.name, () => {
  describe('send', () => {
    it('should send an email', async () => {
      const { service, emailSenderService, contactPointRepository } =
        await setup();

      const notificationCommand = generateMock(NotificationCommandDto.schema);
      const contactPoint = generateContactPoint({
        id: notificationCommand.contactPointId,
      });
      contactPointRepository.findById.mockResolvedValue(contactPoint);
      await service.send(notificationCommand);

      expect(emailSenderService.send).toHaveBeenCalledWith({
        userId: contactPoint.userId,
        addresses: contactPoint.config.addresses,
        subject: notificationCommand.payload.summary,
        content: notificationCommand.payload.description,
      });
    });
  });

  async function setup(): Promise<{
    service: NotificationRouterService;
    emailSenderService: MockProxy<EmailSenderService>;
    contactPointRepository: MockProxy<ContactPointRepository>;
  }> {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationRouterService,
        MockProvider(EmailSenderService),
        MockProvider(ContactPointRepository),
      ],
    }).compile();

    return {
      service: module.get<NotificationRouterService>(NotificationRouterService),
      emailSenderService:
        module.get<MockProxy<EmailSenderService>>(EmailSenderService),
      contactPointRepository: module.get<MockProxy<ContactPointRepository>>(
        ContactPointRepository,
      ),
    };
  }
});
