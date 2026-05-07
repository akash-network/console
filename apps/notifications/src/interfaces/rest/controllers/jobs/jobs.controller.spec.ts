import { generateMock } from "@anatine/zod-mock";
import { Test } from "@nestjs/testing";
import { hoursToMilliseconds } from "date-fns";
import { describe, expect, it, vi } from "vitest";

import { eventKeyRegistry } from "@src/common/config/event-key-registry.config";
import { BrokerService } from "@src/infrastructure/broker/services/broker/broker.service";
import { NotificationChannelRepository } from "@src/modules/notifications/repositories/notification-channel/notification-channel.repository";
import { AuthService } from "../../services/auth/auth.service";
import { notificationChannelOutputSchema } from "../notification-channel/notification-channel.controller";
import { JobsController } from "./jobs.controller";

import { MockProvider } from "@test/mocks/provider.mock";

describe(JobsController.name, () => {
  describe("createNotification", () => {
    it("returns 400 if notificationChannelId is not specified and no default notification channel exists", async () => {
      const findDefaultByUserId = vi.fn(async () => undefined);
      const module = await setup({
        findDefaultByUserId
      });

      const result = await module.get(JobsController).createNotification({
        notificationId: "notifyAboutStartTrial",
        payload: {
          description: "test",
          summary: "test"
        }
      });

      expect(findDefaultByUserId).toHaveBeenCalledWith(module.get(AuthService).userId);
      expect(result.mapErr(err => err.getStatus()).val).toEqual(400);
    });

    it("returns 400 if notificationChannelId is specified and no notification channel exists", async () => {
      const findById = vi.fn(async () => undefined);
      const module = await setup({
        findById
      });

      const result = await module.get(JobsController).createNotification({
        notificationChannelId: "notificationChannelId",
        notificationId: "notifyAboutStartTrial",
        payload: {
          description: "test",
          summary: "test"
        }
      });

      expect(findById).toHaveBeenCalledWith("notificationChannelId");
      expect(result.mapErr(err => err.getStatus()).val).toEqual(400);
    });

    it("creates a notification job if notificationChannelId is specified and notification channel exists", async () => {
      const channel = generateMock(notificationChannelOutputSchema);
      const findDefaultByUserId = vi.fn(async () => channel);
      const module = await setup({
        findDefaultByUserId
      });

      const result = await module.get(JobsController).createNotification({
        notificationId: "notifyAboutStartTrial",
        payload: {
          description: "test",
          summary: "test"
        }
      });

      expect(findDefaultByUserId).toHaveBeenCalledWith(module.get(AuthService).userId);
      expect(result.ok).toBe(true);
      expect(module.get(BrokerService).publish).toHaveBeenCalledWith(
        eventKeyRegistry.createNotification,
        {
          notificationChannelId: channel.id,
          payload: {
            description: "test",
            summary: "test"
          }
        },
        {
          singletonKey: "notifyAboutStartTrial"
        }
      );
    });

    it("creates a notification job if notificationChannelId is not specified and default notification channel exists", async () => {
      const channel = generateMock(notificationChannelOutputSchema);
      const findById = vi.fn(async () => channel);
      const module = await setup({
        findById
      });

      const result = await module.get(JobsController).createNotification({
        notificationChannelId: channel.id,
        notificationId: "notifyAboutStartTrial",
        payload: {
          description: "test",
          summary: "test"
        }
      });

      expect(findById).toHaveBeenCalledWith(channel.id);
      expect(result.ok).toBe(true);
      expect(module.get(BrokerService).publish).toHaveBeenCalledWith(
        eventKeyRegistry.createNotification,
        {
          notificationChannelId: channel.id,
          payload: {
            description: "test",
            summary: "test"
          }
        },
        {
          singletonKey: "notifyAboutStartTrial"
        }
      );
    });

    it("publishes a notification job which startsAfter specified time and expires in 24 hours", async () => {
      const channel = generateMock(notificationChannelOutputSchema);
      const findDefaultByUserId = vi.fn(async () => channel);
      const module = await setup({
        findDefaultByUserId
      });

      const startAfter = new Date(Date.now() + hoursToMilliseconds(1));
      await module.get(JobsController).createNotification({
        notificationId: "notifyAbout1WeekTrial",
        startAfter: startAfter.toISOString(),
        payload: {
          description: "test",
          summary: "test"
        }
      });

      expect(module.get(BrokerService).publish).toHaveBeenCalledWith(
        eventKeyRegistry.createNotification,
        {
          notificationChannelId: channel.id,
          payload: {
            description: "test",
            summary: "test"
          }
        },
        {
          singletonKey: "notifyAbout1WeekTrial",
          startAfter
        }
      );
    });
  });

  async function setup(input?: {
    findDefaultByUserId?: NotificationChannelRepository["findDefaultByUserId"];
    findById?: NotificationChannelRepository["findById"];
  }) {
    const module = await Test.createTestingModule({
      controllers: [JobsController],
      providers: [
        // keep new lines
        MockProvider(BrokerService),
        MockProvider(AuthService, {
          userId: "defaultUserId"
        }),
        MockProvider(NotificationChannelRepository, {
          accessibleBy() {
            return this;
          },
          findDefaultByUserId: input?.findDefaultByUserId,
          findById: input?.findById
        })
      ]
    }).compile();

    return module;
  }
});
