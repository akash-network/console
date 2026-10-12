import { generateMock } from "@anatine/zod-mock";
import { faker } from "@faker-js/faker";
import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";
import { describe, expect, it } from "vitest";
import type { MockProxy } from "vitest-mock-extended";

import { NotificationCommandDto } from "@src/modules/notifications/dto/NotificationCommand.dto";
import { NotificationChannelRepository } from "@src/modules/notifications/repositories/notification-channel/notification-channel.repository";
import { ActivityFeedService } from "../activity-feed/activity-feed.service";
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
        content: notificationCommand.payload.description,
        actions: notificationCommand.payload.actions,
        code: notificationCommand.payload.code,
        notificationId: notificationCommand.notificationId
      });
    });

    it("adds an alert that shows in the activity feed to the channel owner's feed once its email is sent", async () => {
      const { service, emailSenderService, notificationChannelRepository, activityFeedService } = await setup();
      const alertId = faker.string.uuid();
      const notificationCommand = createAlertCommand({ type: "deployment_reclaim_alert", alertId, dedupeKey: `deployment_reclaim_alert.${alertId}`, dseq: "4242" });
      const notificationChannel = generateNotificationChannel({ id: notificationCommand.notificationChannelId });
      notificationChannelRepository.findById.mockResolvedValue(notificationChannel);

      const result = await service.send(notificationCommand);

      expect(result.ok).toBe(true);
      expect(activityFeedService.addToFeed).toHaveBeenCalledWith({
        userId: notificationChannel.userId,
        type: "deployment_reclaim_alert",
        dedupeKey: `deployment_reclaim_alert.${alertId}`,
        meta: { alertId, summary: notificationCommand.payload.summary, dseq: "4242" }
      });
      expect(emailSenderService.send.mock.invocationCallOrder[0]).toBeLessThan(activityFeedService.addToFeed.mock.invocationCallOrder[0]);
    });

    it("leaves the activity feed alone for a notification without a feed entry", async () => {
      const { service, emailSenderService, notificationChannelRepository, activityFeedService } = await setup();
      const notificationCommand = createAlertCommand();
      notificationChannelRepository.findById.mockResolvedValue(generateNotificationChannel({ id: notificationCommand.notificationChannelId }));

      const result = await service.send(notificationCommand);

      expect(result.ok).toBe(true);
      expect(emailSenderService.send).toHaveBeenCalled();
      expect(activityFeedService.addToFeed).not.toHaveBeenCalled();
    });

    it("adds nothing to the activity feed when the email could not be sent", async () => {
      const { service, emailSenderService, notificationChannelRepository, activityFeedService } = await setup();
      const error = new Error("Novu is unavailable");
      const notificationCommand = createAlertCommand({ type: "wallet_balance_alert", alertId: faker.string.uuid(), dedupeKey: "wallet_balance_alert.1" });
      notificationChannelRepository.findById.mockResolvedValue(generateNotificationChannel({ id: notificationCommand.notificationChannelId }));
      emailSenderService.send.mockRejectedValue(error);

      await expect(service.send(notificationCommand)).rejects.toBe(error);

      expect(activityFeedService.addToFeed).not.toHaveBeenCalled();
    });
  });

  function createAlertCommand(feedEntry?: NonNullable<NotificationCommandDto["payload"]["feedEntry"]>): NotificationCommandDto {
    return {
      notificationChannelId: faker.string.uuid(),
      payload: {
        summary: "Deployment 4242 is being reclaimed by the provider",
        description: "The provider has started reclaiming deployment 4242.",
        feedEntry
      }
    };
  }

  async function setup() {
    const module: TestingModule = await Test.createTestingModule({
      providers: [NotificationRouterService, MockProvider(EmailSenderService), MockProvider(NotificationChannelRepository), MockProvider(ActivityFeedService)]
    }).compile();

    return {
      service: module.get<NotificationRouterService>(NotificationRouterService),
      emailSenderService: module.get<MockProxy<EmailSenderService>>(EmailSenderService),
      notificationChannelRepository: module.get<MockProxy<NotificationChannelRepository>>(NotificationChannelRepository),
      activityFeedService: module.get<MockProxy<ActivityFeedService>>(ActivityFeedService)
    };
  }
});
