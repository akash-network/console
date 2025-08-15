import { mock, mockDeep } from "jest-mock-extended";

import type { LoggerService } from "@src/core/providers/logging.provider";
import type { NotificationsApiClient } from "../../providers/notifications-api.provider";
import { type CreateNotificationInput, NotificationService } from "./notification.service";

describe(NotificationService.name, () => {
  describe("createDefaultChannel", () => {
    afterEach(() => {
      jest.useRealTimers();
    });

    it("calls API to create default email channel with user's email", async () => {
      jest.useFakeTimers();
      const { service, api } = setup();

      const user = { id: "user-1", email: "user@example.com" };
      api.v1.createDefaultChannel.mockResolvedValue({} as never);

      await Promise.all([service.createDefaultChannel(user), jest.runAllTimersAsync()]);

      expect(api.v1.createDefaultChannel).toHaveBeenCalledWith({
        parameters: {
          header: {
            "x-user-id": user.id
          }
        },
        body: {
          data: {
            name: "Default",
            type: "email",
            config: {
              addresses: [user.email!]
            }
          }
        }
      });
    });

    it("retries if notification service returns an error", async () => {
      jest.useFakeTimers();
      const { service, api } = setup();

      jest.useFakeTimers();
      const user = { id: "user-1", email: "user@example.com" };
      api.v1.createDefaultChannel.mockRejectedValueOnce({ error: { statusCode: 400 } });
      api.v1.createDefaultChannel.mockResolvedValueOnce({} as never);

      await Promise.all([service.createDefaultChannel(user), jest.runAllTimersAsync()]);

      expect(api.v1.createDefaultChannel).toHaveBeenCalledTimes(2);
      expect(api.v1.createDefaultChannel).toHaveBeenCalledWith({
        parameters: {
          header: {
            "x-user-id": user.id
          }
        },
        body: {
          data: {
            name: "Default",
            type: "email",
            config: {
              addresses: [user.email!]
            }
          }
        }
      });
    });
  });

  describe("createNotification", () => {
    it("sends notification", async () => {
      jest.useFakeTimers();
      const { service, api } = setup();

      const input: CreateNotificationInput = {
        user: { id: "user-1", email: "user@example.com" },
        notificationId: "notif-1",
        payload: { summary: "s", description: "d" }
      };

      api.v1.createNotification.mockResolvedValueOnce({} as never);

      await Promise.all([service.createNotification(input), jest.runAllTimersAsync()]);

      expect(api.v1.createNotification).toHaveBeenCalledTimes(1);
      const call = api.v1.createNotification.mock.calls[0]![0] as {
        parameters?: { header?: Record<string, unknown> };
        body: unknown;
      };
      expect(call.parameters?.header?.["x-user-id"]).toBe(input.user.id);
      expect(call.body).toEqual({
        notificationId: input.notificationId,
        payload: input.payload
      });

      expect(api.v1.createDefaultChannel).not.toHaveBeenCalled();
    });

    it("creates default channel and retries when channel not found and user has email", async () => {
      jest.useFakeTimers();
      const { service, api } = setup();

      const input: CreateNotificationInput = {
        user: { id: "user-1", email: "user@example.com" },
        notificationId: "notif-1",
        payload: { summary: "s", description: "d" }
      };

      api.v1.createNotification
        .mockResolvedValueOnce({ error: { code: "NOTIFICATION_CHANNEL_NOT_FOUND" }, response: new Response() })
        .mockResolvedValueOnce({} as never);

      api.v1.createDefaultChannel.mockResolvedValueOnce({} as never);

      await Promise.all([service.createNotification(input), jest.runAllTimersAsync()]);

      expect(api.v1.createDefaultChannel).toHaveBeenCalledTimes(1);
      expect(api.v1.createNotification).toHaveBeenCalledTimes(2);

      const defaultChannelCall = api.v1.createDefaultChannel.mock.calls[0]![0] as {
        parameters?: { header?: Record<string, unknown> };
        body: { data: { config: { addresses: string[] } } };
      };
      expect(defaultChannelCall.parameters?.header?.["x-user-id"]).toBe(input.user.id);
      expect(defaultChannelCall.body.data.config.addresses).toEqual([input.user.email!]);
    });

    it("does not create default channel when user has no email and logs an error", async () => {
      jest.useFakeTimers();
      const logger = mock<LoggerService>();
      const { service, api } = setup({ logger });

      const input: CreateNotificationInput = {
        user: { id: "user-1", email: null },
        notificationId: "notif-1",
        payload: { summary: "s", description: "d" }
      };

      api.v1.createNotification.mockResolvedValue({ error: { code: "NOTIFICATION_CHANNEL_NOT_FOUND" }, response: new Response() });

      await Promise.all([service.createNotification(input), jest.runAllTimersAsync()]);

      expect(logger.error).toHaveBeenCalledWith({
        event: "FAILED_TO_CREATE_NOTIFICATION",
        error: expect.any(Error),
        userId: input.user.id
      });
      expect(api.v1.createDefaultChannel).not.toHaveBeenCalled();
      expect(api.v1.createNotification).toHaveBeenCalledTimes(10);
    });

    it("fails after 10 attempts if notification service is not available and logs an error", async () => {
      jest.useFakeTimers();
      const logger = mock<LoggerService>();
      const { service, api } = setup({ logger });

      const input: CreateNotificationInput = {
        user: { id: "user-1", email: null },
        notificationId: "notif-1",
        payload: { summary: "s", description: "d" }
      };

      api.v1.createNotification.mockRejectedValue(new Error("fetch failed"));

      await Promise.all([service.createNotification(input), jest.runAllTimersAsync()]);

      expect(logger.error).toHaveBeenCalledWith({
        event: "FAILED_TO_CREATE_NOTIFICATION",
        error: expect.any(Error),
        userId: input.user.id
      });
      expect(api.v1.createNotification).toHaveBeenCalledTimes(10);
    });
  });

  function setup(input?: { logger?: LoggerService }) {
    const api = mockDeep<NotificationsApiClient>();
    const service = new NotificationService(api, input?.logger ?? mock<LoggerService>());

    return { service, api };
  }
});
