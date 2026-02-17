import type { DeploymentHttpService, DeploymentInfo, RestAkashDeploymentInfoResponse } from "@akashnetwork/http-sdk";
import { type DeepMockProxy, mock, mockDeep, type MockProxy } from "vitest-mock-extended";

import type { LoggerService } from "@src/core/providers/logging.provider";
import type { UserOutput, UserRepository } from "@src/user/repositories";
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
      const { service, api } = setup();

      const input: CreateNotificationInput = {
        user: { id: "user-1", email: null },
        notificationId: "notif-1",
        payload: { summary: "s", description: "d" }
      };

      const error = { code: "NOTIFICATION_CHANNEL_NOT_FOUND" };
      api.v1.createNotification.mockResolvedValue({ error, response: new Response() });

      const [result] = await Promise.allSettled([service.createNotification(input), jest.runAllTimersAsync()]);

      expect(result.status).toBe("rejected");
      expect((result as PromiseRejectedResult).reason.cause).toBe(error);
      expect(api.v1.createDefaultChannel).not.toHaveBeenCalled();
      expect(api.v1.createNotification).toHaveBeenCalledTimes(5);
    });

    it("fails after 10 attempts if notification service is not available and logs an error", async () => {
      jest.useFakeTimers();
      const { service, api } = setup();

      const input: CreateNotificationInput = {
        user: { id: "user-1", email: null },
        notificationId: "notif-1",
        payload: { summary: "s", description: "d" }
      };

      const error = new Error("fetch failed");
      api.v1.createNotification.mockRejectedValue(error);

      const [result] = await Promise.allSettled([service.createNotification(input), jest.runAllTimersAsync()]);

      expect(result.status).toBe("rejected");
      expect((result as PromiseRejectedResult).reason.cause).toBe(error);
      expect(api.v1.createNotification).toHaveBeenCalledTimes(5);
    });
  });

  describe("autoEnableDeploymentAlert", () => {
    it("creates default channel when no channels exist, then upserts alert", async () => {
      const { service, api, userRepository, deploymentHttpService } = setup();

      userRepository.findById.mockResolvedValue({ id: "user-1", email: "user@example.com" } as UserOutput);
      api.v1.getNotificationChannels
        .mockResolvedValueOnce({ data: { data: [] } } as never)
        .mockResolvedValueOnce({ data: { data: [{ id: "channel-1" }] } } as never);
      api.v1.createDefaultChannel.mockResolvedValue({} as never);
      deploymentHttpService.findByOwnerAndDseq.mockResolvedValue({
        escrow_account: {
          state: {
            funds: [{ denom: "uakt", amount: "1000000" }]
          }
        }
      } as DeploymentInfo);
      api.v1.upsertDeploymentAlert.mockResolvedValue({} as never);

      await service.autoEnableDeploymentAlert({ userId: "user-1", walletAddress: "akash1abc", dseq: "123" });

      expect(api.v1.getNotificationChannels).toHaveBeenCalledTimes(2);
      expect(api.v1.createDefaultChannel).toHaveBeenCalled();
      expect(deploymentHttpService.findByOwnerAndDseq).toHaveBeenCalledWith("akash1abc", "123");
      expect(api.v1.upsertDeploymentAlert).toHaveBeenCalledWith({
        parameters: {
          path: { dseq: "123" },
          header: { "x-owner-address": "akash1abc", "x-user-id": "user-1" }
        },
        body: {
          data: {
            alerts: {
              deploymentBalance: { notificationChannelId: "channel-1", enabled: true, threshold: 300000 }
            }
          }
        }
      });
    });

    it("uses existing channel without creating default channel", async () => {
      const { service, api, userRepository, deploymentHttpService } = setup();

      userRepository.findById.mockResolvedValue({ id: "user-1", email: "user@example.com" } as UserOutput);
      api.v1.getNotificationChannels.mockResolvedValue({ data: { data: [{ id: "channel-1" }] } } as never);
      deploymentHttpService.findByOwnerAndDseq.mockResolvedValue({
        escrow_account: {
          state: {
            funds: [{ denom: "uakt", amount: "1000000" }]
          }
        }
      } as DeploymentInfo);
      api.v1.upsertDeploymentAlert.mockResolvedValue({} as never);

      await service.autoEnableDeploymentAlert({ userId: "user-1", walletAddress: "akash1abc", dseq: "123" });

      expect(api.v1.getNotificationChannels).toHaveBeenCalledTimes(1);
      expect(api.v1.createDefaultChannel).not.toHaveBeenCalled();
      expect(api.v1.upsertDeploymentAlert).toHaveBeenCalled();
    });

    it("skips when user has no email", async () => {
      const { service, api, userRepository } = setup();

      userRepository.findById.mockResolvedValue({ id: "user-1", email: null } as UserOutput);

      await service.autoEnableDeploymentAlert({ userId: "user-1", walletAddress: "akash1abc", dseq: "123" });

      expect(api.v1.getNotificationChannels).not.toHaveBeenCalled();
      expect(api.v1.createDefaultChannel).not.toHaveBeenCalled();
      expect(api.v1.upsertDeploymentAlert).not.toHaveBeenCalled();
    });

    it("skips when user is not found", async () => {
      const { service, api, userRepository } = setup();

      userRepository.findById.mockResolvedValue(undefined);

      await service.autoEnableDeploymentAlert({ userId: "user-1", walletAddress: "akash1abc", dseq: "123" });

      expect(api.v1.getNotificationChannels).not.toHaveBeenCalled();
      expect(api.v1.createDefaultChannel).not.toHaveBeenCalled();
      expect(api.v1.upsertDeploymentAlert).not.toHaveBeenCalled();
    });

    it("skips when no channel found after creation", async () => {
      const { service, api, userRepository } = setup();

      userRepository.findById.mockResolvedValue({ id: "user-1", email: "user@example.com" } as UserOutput);
      api.v1.getNotificationChannels.mockResolvedValue({ data: { data: [] } } as never);
      api.v1.createDefaultChannel.mockResolvedValue({} as never);

      await service.autoEnableDeploymentAlert({ userId: "user-1", walletAddress: "akash1abc", dseq: "123" });

      expect(api.v1.createDefaultChannel).toHaveBeenCalled();
      expect(api.v1.upsertDeploymentAlert).not.toHaveBeenCalled();
    });

    it("skips when deployment not found", async () => {
      const { service, api, userRepository, deploymentHttpService } = setup();

      userRepository.findById.mockResolvedValue({ id: "user-1", email: "user@example.com" } as UserOutput);
      api.v1.getNotificationChannels.mockResolvedValue({ data: { data: [{ id: "channel-1" }] } } as never);
      deploymentHttpService.findByOwnerAndDseq.mockResolvedValue({ code: 5, message: "not found", details: [] } satisfies RestAkashDeploymentInfoResponse);

      await service.autoEnableDeploymentAlert({ userId: "user-1", walletAddress: "akash1abc", dseq: "123" });

      expect(api.v1.createDefaultChannel).not.toHaveBeenCalled();
      expect(api.v1.upsertDeploymentAlert).not.toHaveBeenCalled();
    });

    it("skips when threshold would be 0", async () => {
      const { service, api, userRepository, deploymentHttpService } = setup();

      userRepository.findById.mockResolvedValue({ id: "user-1", email: "user@example.com" } as UserOutput);
      api.v1.getNotificationChannels.mockResolvedValue({ data: { data: [{ id: "channel-1" }] } } as never);
      deploymentHttpService.findByOwnerAndDseq.mockResolvedValue({
        escrow_account: {
          state: {
            funds: [{ denom: "uakt", amount: "0" }]
          }
        }
      } as DeploymentInfo);

      await service.autoEnableDeploymentAlert({ userId: "user-1", walletAddress: "akash1abc", dseq: "123" });

      expect(api.v1.createDefaultChannel).not.toHaveBeenCalled();
      expect(api.v1.upsertDeploymentAlert).not.toHaveBeenCalled();
    });

    it("skips when escrow balance is NaN", async () => {
      const { service, api, userRepository, deploymentHttpService } = setup();

      userRepository.findById.mockResolvedValue({ id: "user-1", email: "user@example.com" } as UserOutput);
      api.v1.getNotificationChannels.mockResolvedValue({ data: { data: [{ id: "channel-1" }] } } as never);
      deploymentHttpService.findByOwnerAndDseq.mockResolvedValue({
        escrow_account: {
          state: {
            funds: [{ denom: "uakt", amount: "invalid" }]
          }
        }
      } as DeploymentInfo);

      await service.autoEnableDeploymentAlert({ userId: "user-1", walletAddress: "akash1abc", dseq: "123" });

      expect(api.v1.upsertDeploymentAlert).not.toHaveBeenCalled();
    });
  });

  function setup(overrides?: {
    api?: DeepMockProxy<NotificationsApiClient>;
    userRepository?: MockProxy<UserRepository>;
    deploymentHttpService?: MockProxy<DeploymentHttpService>;
    logger?: MockProxy<LoggerService>;
  }) {
    const api = overrides?.api ?? mockDeep<NotificationsApiClient>();
    const userRepository = overrides?.userRepository ?? mock<UserRepository>();
    const deploymentHttpService = overrides?.deploymentHttpService ?? mock<DeploymentHttpService>();
    const logger = overrides?.logger ?? mock<LoggerService>();
    const service = new NotificationService(api, userRepository, deploymentHttpService, logger);

    return { service, api, userRepository, deploymentHttpService, logger };
  }
});
