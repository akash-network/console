import { generateMock } from "@anatine/zod-mock";
import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";
import type { MockProxy } from "jest-mock-extended";

import { NotificationCommandDto } from "@src/modules/notifications/dto/NotificationCommand.dto";
import { NotificationChannelRepository } from "@src/modules/notifications/repositories/notification-channel/notification-channel.repository";
import { EmailSenderService } from "../email-sender/email-sender.service";
import { NotificationRouterService } from "./notification-router.service";

import { MockProvider } from "@test/mocks/provider.mock";
import { generateNotificationChannel } from "@test/seeders/notification-channel.seeder";

describe(NotificationRouterService.name, () => {
  describe("send", () => {
    it("should send an email", async () => {
      const { service, emailSenderService, notificationChannelRepository } = await setup();

      const notificationCommand = generateMock(NotificationCommandDto.schema);
      const notificationChannel = generateNotificationChannel({
        id: notificationCommand.notificationChannelId
      });
      notificationChannelRepository.findById.mockResolvedValue(notificationChannel);
      await service.send(notificationCommand);

      expect(emailSenderService.send).toHaveBeenCalledWith({
        userId: notificationChannel.userId,
        addresses: notificationChannel.config.addresses,
        subject: notificationCommand.payload.summary,
        content: notificationCommand.payload.description
      });
    });
  });

  async function setup(): Promise<{
    service: NotificationRouterService;
    emailSenderService: MockProxy<EmailSenderService>;
    notificationChannelRepository: MockProxy<NotificationChannelRepository>;
  }> {
    const module: TestingModule = await Test.createTestingModule({
      providers: [NotificationRouterService, MockProvider(EmailSenderService), MockProvider(NotificationChannelRepository)]
    }).compile();

    return {
      service: module.get<NotificationRouterService>(NotificationRouterService),
      emailSenderService: module.get<MockProxy<EmailSenderService>>(EmailSenderService),
      notificationChannelRepository: module.get<MockProxy<NotificationChannelRepository>>(NotificationChannelRepository)
    };
  }
});
