import { ApiError } from "@akashnetwork/openapi-sdk";
import { afterEach, describe, expect, it, vi } from "vitest";
import { type DeepMockProxy, mock, mockDeep, type MockProxy } from "vitest-mock-extended";

import type { CreateLogger } from "@src/core/providers/logging.provider";
import type { UserOutput, UserRepository } from "@src/user/repositories";
import type { NotificationsApiClient, NotificationsInternalApiClient } from "../../providers/notifications-api.provider";
import { type CreateNotificationInput, NotificationService } from "./notification.service";

describe(NotificationService.name, () => {
  describe("createDefaultChannel", () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it("calls API to create default email channel with user's email", async () => {
      vi.useFakeTimers();
      const { service, api } = setup();

      const user = { id: "user-1", email: "user@example.com" };
      api.v1.createDefaultNotificationChannel.mockResolvedValue({} as never);

      await Promise.all([service.createDefaultChannel(user), vi.runAllTimersAsync()]);

      expect(api.v1.createDefaultNotificationChannel).toHaveBeenCalledWith(
        {
          data: {
            name: "Default",
            type: "email",
            config: {
              addresses: [user.email!]
            }
          }
        },
        { headers: { "x-user-id": user.id } }
      );
    });

    it("retries if notification service returns an error", async () => {
      vi.useFakeTimers();
      const { service, api } = setup();

      const user = { id: "user-1", email: "user@example.com" };
      api.v1.createDefaultNotificationChannel.mockRejectedValueOnce(new ApiError(500, { message: "boom" }, "POST /v1/notification-channels/default → 500"));
      api.v1.createDefaultNotificationChannel.mockResolvedValueOnce({} as never);

      await Promise.all([service.createDefaultChannel(user), vi.runAllTimersAsync()]);

      expect(api.v1.createDefaultNotificationChannel).toHaveBeenCalledTimes(2);
    });
  });

  describe("createNotification", () => {
    it("sends notification via the internal client", async () => {
      vi.useFakeTimers();
      const { service, apiInternal } = setup();

      const input: CreateNotificationInput = {
        user: { id: "user-1", email: "user@example.com" },
        notificationId: "notif-1",
        payload: { summary: "s", description: "d" }
      };

      apiInternal.v1.createNotification.mockResolvedValueOnce(undefined as never);

      await Promise.all([service.createNotification(input), vi.runAllTimersAsync()]);

      expect(apiInternal.v1.createNotification).toHaveBeenCalledTimes(1);
      expect(apiInternal.v1.createNotification).toHaveBeenCalledWith(
        {
          notificationId: input.notificationId,
          payload: input.payload
        },
        { headers: { "x-user-id": input.user.id } }
      );
    });

    it("creates default channel and retries when channel not found and user has email", async () => {
      vi.useFakeTimers();
      const { service, api, apiInternal } = setup();

      const input: CreateNotificationInput = {
        user: { id: "user-1", email: "user@example.com" },
        notificationId: "notif-1",
        payload: { summary: "s", description: "d" }
      };

      const channelMissing = new ApiError(400, { code: "NOTIFICATION_CHANNEL_NOT_FOUND" }, "POST /internal/v1/jobs/notification → 400");
      apiInternal.v1.createNotification.mockRejectedValueOnce(channelMissing).mockResolvedValueOnce(undefined as never);
      api.v1.createDefaultNotificationChannel.mockResolvedValueOnce({} as never);

      await Promise.all([service.createNotification(input), vi.runAllTimersAsync()]);

      expect(api.v1.createDefaultNotificationChannel).toHaveBeenCalledTimes(1);
      expect(apiInternal.v1.createNotification).toHaveBeenCalledTimes(2);

      expect(api.v1.createDefaultNotificationChannel).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ config: { addresses: [input.user.email!] } }) }),
        { headers: { "x-user-id": input.user.id } }
      );
    });

    it("creates the default channel only once across retries when NOTIFICATION_CHANNEL_NOT_FOUND keeps coming back", async () => {
      vi.useFakeTimers();
      const { service, api, apiInternal } = setup();

      const input: CreateNotificationInput = {
        user: { id: "user-1", email: "user@example.com" },
        notificationId: "notif-1",
        payload: { summary: "s", description: "d" }
      };

      const channelMissing = new ApiError(400, { code: "NOTIFICATION_CHANNEL_NOT_FOUND" }, "POST /internal/v1/jobs/notification → 400");
      apiInternal.v1.createNotification.mockRejectedValue(channelMissing);
      api.v1.createDefaultNotificationChannel.mockResolvedValue({} as never);

      const [result] = await Promise.allSettled([service.createNotification(input), vi.runAllTimersAsync()]);

      expect(result.status).toBe("rejected");
      expect(apiInternal.v1.createNotification).toHaveBeenCalledTimes(5);
      expect(api.v1.createDefaultNotificationChannel).toHaveBeenCalledTimes(1);
    });

    it("does not create default channel when user has no email and rejects after exhausting retries", async () => {
      vi.useFakeTimers();
      const { service, api, apiInternal } = setup();

      const input: CreateNotificationInput = {
        user: { id: "user-1", email: null },
        notificationId: "notif-1",
        payload: { summary: "s", description: "d" }
      };

      const channelMissing = new ApiError(400, { code: "NOTIFICATION_CHANNEL_NOT_FOUND" }, "POST /internal/v1/jobs/notification → 400");
      apiInternal.v1.createNotification.mockRejectedValue(channelMissing);

      const [result] = await Promise.allSettled([service.createNotification(input), vi.runAllTimersAsync()]);

      expect(result.status).toBe("rejected");
      expect((result as PromiseRejectedResult).reason.cause).toBe(channelMissing);
      expect(api.v1.createDefaultNotificationChannel).not.toHaveBeenCalled();
      expect(apiInternal.v1.createNotification).toHaveBeenCalledTimes(5);
    });

    it("fails after retries if notification service is not available", async () => {
      vi.useFakeTimers();
      const { service, apiInternal } = setup();

      const input: CreateNotificationInput = {
        user: { id: "user-1", email: null },
        notificationId: "notif-1",
        payload: { summary: "s", description: "d" }
      };

      const error = new Error("fetch failed");
      apiInternal.v1.createNotification.mockRejectedValue(error);

      const [result] = await Promise.allSettled([service.createNotification(input), vi.runAllTimersAsync()]);

      expect(result.status).toBe("rejected");
      expect((result as PromiseRejectedResult).reason.cause).toBe(error);
      expect(apiInternal.v1.createNotification).toHaveBeenCalledTimes(5);
    });
  });

  describe("createNotificationOnce", () => {
    const input: CreateNotificationInput = {
      notificationId: "n-1",
      user: { id: "user-1", email: "user@example.com" },
      payload: { summary: "s", description: "d" }
    };
    const channelMissing = new ApiError(400, { code: "NOTIFICATION_CHANNEL_NOT_FOUND" }, "POST /internal/v1/jobs/notification → 400");

    it("sends the notification once on behalf of the user", async () => {
      const { service, apiInternal } = setup();
      apiInternal.v1.createNotification.mockResolvedValue(undefined as never);

      await service.createNotificationOnce(input);

      expect(apiInternal.v1.createNotification).toHaveBeenCalledTimes(1);
      expect(apiInternal.v1.createNotification).toHaveBeenCalledWith(
        { notificationId: "n-1", payload: { summary: "s", description: "d" } },
        { headers: { "x-user-id": "user-1" } }
      );
    });

    it("fails without retrying when the notification cannot be sent", async () => {
      const { service, apiInternal, api } = setup();
      const error = new Error("unavailable");
      apiInternal.v1.createNotification.mockRejectedValue(error);

      await expect(service.createNotificationOnce(input)).rejects.toMatchObject({ message: "Failed to create notification", cause: error });
      expect(apiInternal.v1.createNotification).toHaveBeenCalledTimes(1);
      expect(api.v1.createDefaultNotificationChannel).not.toHaveBeenCalled();
    });

    it("opens the user's default channel and sends again once when the channel is missing", async () => {
      const { service, api, apiInternal } = setup();
      apiInternal.v1.createNotification.mockRejectedValueOnce(channelMissing).mockResolvedValueOnce(undefined as never);
      api.v1.createDefaultNotificationChannel.mockResolvedValue({} as never);

      await service.createNotificationOnce(input);

      expect(api.v1.createDefaultNotificationChannel).toHaveBeenCalledWith(
        { data: { name: "Default", type: "email", config: { addresses: ["user@example.com"] } } },
        { headers: { "x-user-id": "user-1" } }
      );
      expect(apiInternal.v1.createNotification).toHaveBeenCalledTimes(2);
    });

    it("fails when the notification still cannot be sent after opening the channel", async () => {
      const { service, api, apiInternal } = setup();
      apiInternal.v1.createNotification.mockRejectedValue(channelMissing);
      api.v1.createDefaultNotificationChannel.mockResolvedValue({} as never);

      await expect(service.createNotificationOnce(input)).rejects.toMatchObject({ cause: channelMissing });
      expect(apiInternal.v1.createNotification).toHaveBeenCalledTimes(2);
      expect(api.v1.createDefaultNotificationChannel).toHaveBeenCalledTimes(1);
    });

    it("does not open a channel for a user without an email", async () => {
      const { service, api, apiInternal } = setup();
      apiInternal.v1.createNotification.mockRejectedValue(channelMissing);

      await expect(service.createNotificationOnce({ ...input, user: { id: "user-1", email: null } })).rejects.toMatchObject({ cause: channelMissing });
      expect(api.v1.createDefaultNotificationChannel).not.toHaveBeenCalled();
    });
  });

  describe("purgeUserData", () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it("asks the notifications service to purge the user's channels and alerts", async () => {
      const { service, apiInternal } = setup();
      apiInternal.v1.purge.mockResolvedValueOnce(undefined as never);

      await service.purgeUserData("user-1");

      expect(apiInternal.v1.purge).toHaveBeenCalledWith({ userId: "user-1" });
    });

    it("retries when the notifications service fails", async () => {
      vi.useFakeTimers();
      const { service, apiInternal } = setup();
      apiInternal.v1.purge.mockRejectedValueOnce(new ApiError(503, { message: "unavailable" }, "POST /internal/v1/users/user-1/purge → 503"));
      apiInternal.v1.purge.mockResolvedValueOnce(undefined as never);

      await Promise.all([service.purgeUserData("user-1"), vi.runAllTimersAsync()]);

      expect(apiInternal.v1.purge).toHaveBeenCalledTimes(2);
    });
  });

  describe("autoEnableDeploymentAlert", () => {
    it("creates default channel when no channels exist, then upserts only the deployment-closed alert", async () => {
      const { service, api, userRepository } = setup();

      userRepository.findById.mockResolvedValue({ id: "user-1", email: "user@example.com" } as UserOutput);
      api.v1.listNotificationChannels.mockResolvedValueOnce({ data: [] } as never).mockResolvedValueOnce({ data: [{ id: "channel-1" }] } as never);
      api.v1.createDefaultNotificationChannel.mockResolvedValue({} as never);
      api.v1.upsertDeploymentAlert.mockResolvedValue({} as never);

      await service.autoEnableDeploymentAlert({ userId: "user-1", walletAddress: "akash1abc", dseq: "123" });

      expect(api.v1.listNotificationChannels).toHaveBeenCalledTimes(2);
      expect(api.v1.createDefaultNotificationChannel).toHaveBeenCalled();
      expect(api.v1.upsertDeploymentAlert).toHaveBeenCalledWith(
        {
          dseq: "123",
          data: {
            alerts: {
              deploymentClosed: { notificationChannelId: "channel-1", enabled: true }
            }
          }
        },
        { headers: { "x-owner-address": "akash1abc", "x-user-id": "user-1" } }
      );
    });

    it("tolerates createDefaultChannel rejection and re-fetches a channel created by a concurrent request", async () => {
      vi.useFakeTimers();
      const { service, api, userRepository, logger } = setup();

      userRepository.findById.mockResolvedValue({ id: "user-1", email: "user@example.com" } as UserOutput);
      api.v1.listNotificationChannels.mockResolvedValueOnce({ data: [] } as never).mockResolvedValueOnce({ data: [{ id: "channel-x" }] } as never);
      api.v1.createDefaultNotificationChannel.mockRejectedValue(new ApiError(409, { code: "ALREADY_EXISTS" }, "POST /v1/notification-channels/default → 409"));
      api.v1.upsertDeploymentAlert.mockResolvedValue({} as never);

      await Promise.all([service.autoEnableDeploymentAlert({ userId: "user-1", walletAddress: "akash1abc", dseq: "123" }), vi.runAllTimersAsync()]);

      expect(api.v1.listNotificationChannels).toHaveBeenCalledTimes(2);
      expect(api.v1.upsertDeploymentAlert).toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalledWith(expect.objectContaining({ event: "AUTO_ENABLE_ALERT_CHANNEL_CREATE_FAILED" }));
      vi.useRealTimers();
    });

    it("uses existing channel without creating default channel", async () => {
      const { service, api, userRepository } = setup();

      userRepository.findById.mockResolvedValue({ id: "user-1", email: "user@example.com" } as UserOutput);
      api.v1.listNotificationChannels.mockResolvedValue({ data: [{ id: "channel-1" }] } as never);
      api.v1.upsertDeploymentAlert.mockResolvedValue({} as never);

      await service.autoEnableDeploymentAlert({ userId: "user-1", walletAddress: "akash1abc", dseq: "123" });

      expect(api.v1.listNotificationChannels).toHaveBeenCalledTimes(1);
      expect(api.v1.createDefaultNotificationChannel).not.toHaveBeenCalled();
      expect(api.v1.upsertDeploymentAlert).toHaveBeenCalled();
    });

    it("skips when user has no email", async () => {
      const { service, api, userRepository } = setup();

      userRepository.findById.mockResolvedValue({ id: "user-1", email: null } as UserOutput);

      await service.autoEnableDeploymentAlert({ userId: "user-1", walletAddress: "akash1abc", dseq: "123" });

      expect(api.v1.listNotificationChannels).not.toHaveBeenCalled();
      expect(api.v1.createDefaultNotificationChannel).not.toHaveBeenCalled();
      expect(api.v1.upsertDeploymentAlert).not.toHaveBeenCalled();
    });

    it("skips when user is not found", async () => {
      const { service, api, userRepository } = setup();

      userRepository.findById.mockResolvedValue(undefined);

      await service.autoEnableDeploymentAlert({ userId: "user-1", walletAddress: "akash1abc", dseq: "123" });

      expect(api.v1.listNotificationChannels).not.toHaveBeenCalled();
      expect(api.v1.createDefaultNotificationChannel).not.toHaveBeenCalled();
      expect(api.v1.upsertDeploymentAlert).not.toHaveBeenCalled();
    });

    it("skips when no channel found after creation", async () => {
      const { service, api, userRepository } = setup();

      userRepository.findById.mockResolvedValue({ id: "user-1", email: "user@example.com" } as UserOutput);
      api.v1.listNotificationChannels.mockResolvedValue({ data: [] } as never);
      api.v1.createDefaultNotificationChannel.mockResolvedValue({} as never);

      await service.autoEnableDeploymentAlert({ userId: "user-1", walletAddress: "akash1abc", dseq: "123" });

      expect(api.v1.createDefaultNotificationChannel).toHaveBeenCalled();
      expect(api.v1.upsertDeploymentAlert).not.toHaveBeenCalled();
    });
  });

  function setup(overrides?: {
    api?: DeepMockProxy<NotificationsApiClient>;
    apiInternal?: DeepMockProxy<NotificationsInternalApiClient>;
    userRepository?: MockProxy<UserRepository>;
    logger?: MockProxy<ReturnType<CreateLogger>>;
  }) {
    const api = overrides?.api ?? mockDeep<NotificationsApiClient>();
    const apiInternal = overrides?.apiInternal ?? mockDeep<NotificationsInternalApiClient>();
    const userRepository = overrides?.userRepository ?? mock<UserRepository>();
    const logger = overrides?.logger ?? mock<ReturnType<CreateLogger>>();
    const service = new NotificationService(api, apiInternal, userRepository, () => logger);

    return { service, api, apiInternal, userRepository, logger };
  }
});
