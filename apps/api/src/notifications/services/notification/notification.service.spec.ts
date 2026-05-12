import { ApiError } from "@akashnetwork/openapi-sdk";
import { type DeepMockProxy, mock, mockDeep, type MockProxy } from "vitest-mock-extended";

import type { LoggerService } from "@src/core/providers/logging.provider";
import type { UserOutput, UserRepository } from "@src/user/repositories";
import type { NotificationsApiClient, NotificationsInternalApiClient } from "../../providers/notifications-api.provider";
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
      api.v1.createDefaultNotificationChannel.mockResolvedValue({} as never);

      await Promise.all([service.createDefaultChannel(user), jest.runAllTimersAsync()]);

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
      jest.useFakeTimers();
      const { service, api } = setup();

      const user = { id: "user-1", email: "user@example.com" };
      api.v1.createDefaultNotificationChannel.mockRejectedValueOnce(new ApiError(500, { message: "boom" }, "POST /v1/notification-channels/default → 500"));
      api.v1.createDefaultNotificationChannel.mockResolvedValueOnce({} as never);

      await Promise.all([service.createDefaultChannel(user), jest.runAllTimersAsync()]);

      expect(api.v1.createDefaultNotificationChannel).toHaveBeenCalledTimes(2);
    });
  });

  describe("createNotification", () => {
    it("sends notification via the internal client", async () => {
      jest.useFakeTimers();
      const { service, apiInternal } = setup();

      const input: CreateNotificationInput = {
        user: { id: "user-1", email: "user@example.com" },
        notificationId: "notif-1",
        payload: { summary: "s", description: "d" }
      };

      apiInternal.v1.createNotification.mockResolvedValueOnce(undefined as never);

      await Promise.all([service.createNotification(input), jest.runAllTimersAsync()]);

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
      jest.useFakeTimers();
      const { service, api, apiInternal } = setup();

      const input: CreateNotificationInput = {
        user: { id: "user-1", email: "user@example.com" },
        notificationId: "notif-1",
        payload: { summary: "s", description: "d" }
      };

      const channelMissing = new ApiError(400, { code: "NOTIFICATION_CHANNEL_NOT_FOUND" }, "POST /internal/v1/jobs/notification → 400");
      apiInternal.v1.createNotification.mockRejectedValueOnce(channelMissing).mockResolvedValueOnce(undefined as never);
      api.v1.createDefaultNotificationChannel.mockResolvedValueOnce({} as never);

      await Promise.all([service.createNotification(input), jest.runAllTimersAsync()]);

      expect(api.v1.createDefaultNotificationChannel).toHaveBeenCalledTimes(1);
      expect(apiInternal.v1.createNotification).toHaveBeenCalledTimes(2);

      expect(api.v1.createDefaultNotificationChannel).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ config: { addresses: [input.user.email!] } }) }),
        { headers: { "x-user-id": input.user.id } }
      );
    });

    it("creates the default channel only once across retries when NOTIFICATION_CHANNEL_NOT_FOUND keeps coming back", async () => {
      jest.useFakeTimers();
      const { service, api, apiInternal } = setup();

      const input: CreateNotificationInput = {
        user: { id: "user-1", email: "user@example.com" },
        notificationId: "notif-1",
        payload: { summary: "s", description: "d" }
      };

      const channelMissing = new ApiError(400, { code: "NOTIFICATION_CHANNEL_NOT_FOUND" }, "POST /internal/v1/jobs/notification → 400");
      apiInternal.v1.createNotification.mockRejectedValue(channelMissing);
      api.v1.createDefaultNotificationChannel.mockResolvedValue({} as never);

      const [result] = await Promise.allSettled([service.createNotification(input), jest.runAllTimersAsync()]);

      expect(result.status).toBe("rejected");
      expect(apiInternal.v1.createNotification).toHaveBeenCalledTimes(5);
      expect(api.v1.createDefaultNotificationChannel).toHaveBeenCalledTimes(1);
    });

    it("does not create default channel when user has no email and rejects after exhausting retries", async () => {
      jest.useFakeTimers();
      const { service, api, apiInternal } = setup();

      const input: CreateNotificationInput = {
        user: { id: "user-1", email: null },
        notificationId: "notif-1",
        payload: { summary: "s", description: "d" }
      };

      const channelMissing = new ApiError(400, { code: "NOTIFICATION_CHANNEL_NOT_FOUND" }, "POST /internal/v1/jobs/notification → 400");
      apiInternal.v1.createNotification.mockRejectedValue(channelMissing);

      const [result] = await Promise.allSettled([service.createNotification(input), jest.runAllTimersAsync()]);

      expect(result.status).toBe("rejected");
      expect((result as PromiseRejectedResult).reason.cause).toBe(channelMissing);
      expect(api.v1.createDefaultNotificationChannel).not.toHaveBeenCalled();
      expect(apiInternal.v1.createNotification).toHaveBeenCalledTimes(5);
    });

    it("fails after retries if notification service is not available", async () => {
      jest.useFakeTimers();
      const { service, apiInternal } = setup();

      const input: CreateNotificationInput = {
        user: { id: "user-1", email: null },
        notificationId: "notif-1",
        payload: { summary: "s", description: "d" }
      };

      const error = new Error("fetch failed");
      apiInternal.v1.createNotification.mockRejectedValue(error);

      const [result] = await Promise.allSettled([service.createNotification(input), jest.runAllTimersAsync()]);

      expect(result.status).toBe("rejected");
      expect((result as PromiseRejectedResult).reason.cause).toBe(error);
      expect(apiInternal.v1.createNotification).toHaveBeenCalledTimes(5);
    });
  });

  describe("autoEnableDeploymentAlert", () => {
    it("creates default channel when no channels exist, then upserts alert", async () => {
      const { service, api, userRepository } = setup();

      userRepository.findById.mockResolvedValue({ id: "user-1", email: "user@example.com" } as UserOutput);
      api.v1.listNotificationChannels.mockResolvedValueOnce({ data: [] } as never).mockResolvedValueOnce({ data: [{ id: "channel-1" }] } as never);
      api.v1.createDefaultNotificationChannel.mockResolvedValue({} as never);
      api.v1.upsertDeploymentAlert.mockResolvedValue({} as never);

      await service.autoEnableDeploymentAlert({ userId: "user-1", walletAddress: "akash1abc", dseq: "123", escrowBalance: 1000000 });

      expect(api.v1.listNotificationChannels).toHaveBeenCalledTimes(2);
      expect(api.v1.createDefaultNotificationChannel).toHaveBeenCalled();
      expect(api.v1.upsertDeploymentAlert).toHaveBeenCalledWith(
        {
          dseq: "123",
          data: {
            alerts: {
              deploymentBalance: { notificationChannelId: "channel-1", enabled: true, threshold: 300000 },
              deploymentClosed: { notificationChannelId: "channel-1", enabled: true }
            }
          }
        },
        { headers: { "x-owner-address": "akash1abc", "x-user-id": "user-1" } }
      );
    });

    it("tolerates createDefaultChannel rejection and re-fetches a channel created by a concurrent request", async () => {
      jest.useFakeTimers();
      const { service, api, userRepository, logger } = setup();

      userRepository.findById.mockResolvedValue({ id: "user-1", email: "user@example.com" } as UserOutput);
      api.v1.listNotificationChannels.mockResolvedValueOnce({ data: [] } as never).mockResolvedValueOnce({ data: [{ id: "channel-x" }] } as never);
      api.v1.createDefaultNotificationChannel.mockRejectedValue(new ApiError(409, { code: "ALREADY_EXISTS" }, "POST /v1/notification-channels/default → 409"));
      api.v1.upsertDeploymentAlert.mockResolvedValue({} as never);

      await Promise.all([
        service.autoEnableDeploymentAlert({ userId: "user-1", walletAddress: "akash1abc", dseq: "123", escrowBalance: 1000000 }),
        jest.runAllTimersAsync()
      ]);

      expect(api.v1.listNotificationChannels).toHaveBeenCalledTimes(2);
      expect(api.v1.upsertDeploymentAlert).toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalledWith(expect.objectContaining({ event: "AUTO_ENABLE_ALERT_CHANNEL_CREATE_FAILED" }));
      jest.useRealTimers();
    });

    it("uses existing channel without creating default channel", async () => {
      const { service, api, userRepository } = setup();

      userRepository.findById.mockResolvedValue({ id: "user-1", email: "user@example.com" } as UserOutput);
      api.v1.listNotificationChannels.mockResolvedValue({ data: [{ id: "channel-1" }] } as never);
      api.v1.upsertDeploymentAlert.mockResolvedValue({} as never);

      await service.autoEnableDeploymentAlert({ userId: "user-1", walletAddress: "akash1abc", dseq: "123", escrowBalance: 1000000 });

      expect(api.v1.listNotificationChannels).toHaveBeenCalledTimes(1);
      expect(api.v1.createDefaultNotificationChannel).not.toHaveBeenCalled();
      expect(api.v1.upsertDeploymentAlert).toHaveBeenCalled();
    });

    it("skips when user has no email", async () => {
      const { service, api, userRepository } = setup();

      userRepository.findById.mockResolvedValue({ id: "user-1", email: null } as UserOutput);

      await service.autoEnableDeploymentAlert({ userId: "user-1", walletAddress: "akash1abc", dseq: "123", escrowBalance: 1000000 });

      expect(api.v1.listNotificationChannels).not.toHaveBeenCalled();
      expect(api.v1.createDefaultNotificationChannel).not.toHaveBeenCalled();
      expect(api.v1.upsertDeploymentAlert).not.toHaveBeenCalled();
    });

    it("skips when user is not found", async () => {
      const { service, api, userRepository } = setup();

      userRepository.findById.mockResolvedValue(undefined);

      await service.autoEnableDeploymentAlert({ userId: "user-1", walletAddress: "akash1abc", dseq: "123", escrowBalance: 1000000 });

      expect(api.v1.listNotificationChannels).not.toHaveBeenCalled();
      expect(api.v1.createDefaultNotificationChannel).not.toHaveBeenCalled();
      expect(api.v1.upsertDeploymentAlert).not.toHaveBeenCalled();
    });

    it("skips when no channel found after creation", async () => {
      const { service, api, userRepository } = setup();

      userRepository.findById.mockResolvedValue({ id: "user-1", email: "user@example.com" } as UserOutput);
      api.v1.listNotificationChannels.mockResolvedValue({ data: [] } as never);
      api.v1.createDefaultNotificationChannel.mockResolvedValue({} as never);

      await service.autoEnableDeploymentAlert({ userId: "user-1", walletAddress: "akash1abc", dseq: "123", escrowBalance: 1000000 });

      expect(api.v1.createDefaultNotificationChannel).toHaveBeenCalled();
      expect(api.v1.upsertDeploymentAlert).not.toHaveBeenCalled();
    });

    it("skips when threshold would be 0", async () => {
      const { service, api, userRepository } = setup();

      userRepository.findById.mockResolvedValue({ id: "user-1", email: "user@example.com" } as UserOutput);
      api.v1.listNotificationChannels.mockResolvedValue({ data: [{ id: "channel-1" }] } as never);

      await service.autoEnableDeploymentAlert({ userId: "user-1", walletAddress: "akash1abc", dseq: "123", escrowBalance: 0 });

      expect(api.v1.createDefaultNotificationChannel).not.toHaveBeenCalled();
      expect(api.v1.upsertDeploymentAlert).not.toHaveBeenCalled();
    });

    it("skips when escrow balance is NaN", async () => {
      const { service, api, userRepository } = setup();

      userRepository.findById.mockResolvedValue({ id: "user-1", email: "user@example.com" } as UserOutput);
      api.v1.listNotificationChannels.mockResolvedValue({ data: [{ id: "channel-1" }] } as never);

      await service.autoEnableDeploymentAlert({ userId: "user-1", walletAddress: "akash1abc", dseq: "123", escrowBalance: NaN });

      expect(api.v1.upsertDeploymentAlert).not.toHaveBeenCalled();
    });
  });

  function setup(overrides?: {
    api?: DeepMockProxy<NotificationsApiClient>;
    apiInternal?: DeepMockProxy<NotificationsInternalApiClient>;
    userRepository?: MockProxy<UserRepository>;
    logger?: MockProxy<LoggerService>;
  }) {
    const api = overrides?.api ?? mockDeep<NotificationsApiClient>();
    const apiInternal = overrides?.apiInternal ?? mockDeep<NotificationsInternalApiClient>();
    const userRepository = overrides?.userRepository ?? mock<UserRepository>();
    const logger = overrides?.logger ?? mock<LoggerService>();
    const service = new NotificationService(api, apiInternal, userRepository, logger);

    return { service, api, apiInternal, userRepository, logger };
  }
});
