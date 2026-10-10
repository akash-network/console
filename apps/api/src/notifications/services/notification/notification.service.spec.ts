import { ApiError } from "@akashnetwork/openapi-sdk";
import { afterEach, describe, expect, it, vi } from "vitest";
import { type DeepMockProxy, mock, mockDeep, type MockProxy } from "vitest-mock-extended";

import type { CreateLogger } from "@src/core/providers/logging.provider";
import type { DeploymentSettingRepository } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import type { OrganizationOutput, OrganizationRepository } from "@src/organization/repositories/organization/organization.repository";
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

    it("attributes the default channel to the user's personal organization", async () => {
      const { service, api, organizationRepository } = setup();
      organizationRepository.findPersonalByUserId.mockResolvedValue(mock<OrganizationOutput>({ id: "personal-organization-1", type: "personal" }));
      api.v1.createDefaultNotificationChannel.mockResolvedValue({} as never);

      await service.createDefaultChannel({ id: "user-1", email: "user@example.com" });

      expect(api.v1.createDefaultNotificationChannel).toHaveBeenCalledWith(expect.anything(), {
        headers: { "x-user-id": "user-1", "x-organization-id": "personal-organization-1", "x-organization-type": "personal" }
      });
    });
  });

  describe("createNotification", () => {
    it("attributes the notification to the user's personal organization when they have one", async () => {
      const { service, apiInternal, organizationRepository } = setup();
      const personalOrganization = mock<OrganizationOutput>({ id: "personal-organization-1", type: "personal" });
      organizationRepository.findPersonalByUserId.mockResolvedValue(personalOrganization);
      apiInternal.v1.createNotification.mockResolvedValue({} as never);

      await service.createNotification({ notificationId: "n-1", payload: { summary: "s", description: "d" }, user: { id: "user-1" } });

      expect(organizationRepository.findPersonalByUserId).toHaveBeenCalledWith("user-1");
      expect(apiInternal.v1.createNotification).toHaveBeenCalledWith(expect.anything(), {
        headers: { "x-user-id": "user-1", "x-organization-id": "personal-organization-1", "x-organization-type": "personal" }
      });
    });

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

  describe("purgeUserData", () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it("asks the notifications service to purge the user's channels and alerts", async () => {
      const { service, apiInternal } = setup();
      apiInternal.v1.purge.mockResolvedValueOnce(undefined as never);

      await service.purgeUserData("user-1", "personal-organization-1");

      expect(apiInternal.v1.purge).toHaveBeenCalledWith({ userId: "user-1" }, { headers: { "x-organization-id": "personal-organization-1" } });
    });

    it("names no organization for a user who had no personal organization", async () => {
      const { service, apiInternal } = setup();
      apiInternal.v1.purge.mockResolvedValueOnce(undefined as never);

      await service.purgeUserData("user-1", null);

      expect(apiInternal.v1.purge).toHaveBeenCalledWith({ userId: "user-1" }, { headers: {} });
    });

    it("retries when the notifications service fails", async () => {
      vi.useFakeTimers();
      const { service, apiInternal } = setup();
      apiInternal.v1.purge.mockRejectedValueOnce(new ApiError(503, { message: "unavailable" }, "POST /internal/v1/users/user-1/purge → 503"));
      apiInternal.v1.purge.mockResolvedValueOnce(undefined as never);

      await Promise.all([service.purgeUserData("user-1", null), vi.runAllTimersAsync()]);

      expect(apiInternal.v1.purge).toHaveBeenCalledTimes(2);
    });
  });

  describe("autoEnableDeploymentAlert", () => {
    it("files the alert into the organization and project of the deployment", async () => {
      const { service, api, userRepository, deploymentSettingRepository } = setup();
      userRepository.findById.mockResolvedValue({ id: "user-1", email: "user@example.com" } as UserOutput);
      api.v1.listNotificationChannels.mockResolvedValue({ data: [{ id: "channel-1" }] } as never);
      deploymentSettingRepository.findTenancy.mockResolvedValue({ organizationId: "organization-1", organizationType: "team", projectId: "project-1" });

      await service.autoEnableDeploymentAlert({ userId: "user-1", walletAddress: "akash1abc", dseq: "123" });

      expect(deploymentSettingRepository.findTenancy).toHaveBeenCalledWith({ userId: "user-1", dseq: "123" });
      expect(api.v1.upsertDeploymentAlert).toHaveBeenCalledWith(expect.anything(), {
        headers: {
          "x-user-id": "user-1",
          "x-organization-id": "organization-1",
          "x-organization-type": "team",
          "x-project-id": "project-1",
          "x-owner-address": "akash1abc"
        }
      });
    });

    it("picks a channel among those of the deployment's organization, preferring the default one", async () => {
      const { service, api, userRepository, organizationRepository, deploymentSettingRepository } = setup();
      userRepository.findById.mockResolvedValue({ id: "user-1", email: "user@example.com" } as UserOutput);
      deploymentSettingRepository.findTenancy.mockResolvedValue({ organizationId: null, organizationType: null, projectId: null });
      organizationRepository.findPersonalByUserId.mockResolvedValue(mock<OrganizationOutput>({ id: "personal-organization-1", type: "personal" }));
      api.v1.listNotificationChannels.mockResolvedValue({ data: [{ id: "other-channel" }, { id: "default-channel", isDefault: true }] } as never);

      await service.autoEnableDeploymentAlert({ userId: "user-1", walletAddress: "akash1abc", dseq: "123" });

      expect(api.v1.listNotificationChannels).toHaveBeenCalledWith(
        { page: 1, limit: 100 },
        { headers: { "x-user-id": "user-1", "x-organization-id": "personal-organization-1", "x-organization-type": "personal" } }
      );
      expect(api.v1.upsertDeploymentAlert).toHaveBeenCalledWith(
        { dseq: "123", data: { alerts: { deploymentClosed: { notificationChannelId: "default-channel", enabled: true } } } },
        expect.anything()
      );
    });

    it("creates a channel for the deployer in a team deployment's organization when they have none there", async () => {
      const { service, api, userRepository, deploymentSettingRepository } = setup();
      const teamHeaders = { "x-user-id": "user-1", "x-organization-id": "organization-1", "x-organization-type": "team", "x-project-id": "project-1" };
      userRepository.findById.mockResolvedValue({ id: "user-1", email: "user@example.com" } as UserOutput);
      deploymentSettingRepository.findTenancy.mockResolvedValue({ organizationId: "organization-1", organizationType: "team", projectId: "project-1" });
      api.v1.listNotificationChannels.mockResolvedValue({ data: [] } as never);
      api.v1.createNotificationChannel.mockResolvedValue({ data: { id: "team-channel" } } as never);

      await service.autoEnableDeploymentAlert({ userId: "user-1", walletAddress: "akash1abc", dseq: "123" });

      expect(api.v1.listNotificationChannels).toHaveBeenCalledWith(expect.anything(), { headers: teamHeaders });
      expect(api.v1.createNotificationChannel).toHaveBeenCalledWith(
        { data: { name: "Deployment alerts", type: "email", config: { addresses: ["user@example.com"] }, isDefault: false } },
        { headers: teamHeaders }
      );
      expect(api.v1.createDefaultNotificationChannel).not.toHaveBeenCalled();
      expect(api.v1.upsertDeploymentAlert).toHaveBeenCalledWith(
        { dseq: "123", data: { alerts: { deploymentClosed: { notificationChannelId: "team-channel", enabled: true } } } },
        { headers: { ...teamHeaders, "x-owner-address": "akash1abc" } }
      );
    });

    it("uses the deployer's channel of a team deployment's organization when they have one", async () => {
      const { service, api, userRepository, deploymentSettingRepository } = setup();
      userRepository.findById.mockResolvedValue({ id: "user-1", email: "user@example.com" } as UserOutput);
      deploymentSettingRepository.findTenancy.mockResolvedValue({ organizationId: "organization-1", organizationType: "team", projectId: null });
      api.v1.listNotificationChannels.mockResolvedValue({ data: [{ id: "team-channel" }] } as never);

      await service.autoEnableDeploymentAlert({ userId: "user-1", walletAddress: "akash1abc", dseq: "123" });

      expect(api.v1.createNotificationChannel).not.toHaveBeenCalled();
      expect(api.v1.upsertDeploymentAlert).toHaveBeenCalledWith(
        { dseq: "123", data: { alerts: { deploymentClosed: { notificationChannelId: "team-channel", enabled: true } } } },
        expect.anything()
      );
    });

    it("files the alert into the organization of a deployment that has no project", async () => {
      const { service, api, userRepository, deploymentSettingRepository } = setup();
      userRepository.findById.mockResolvedValue({ id: "user-1", email: "user@example.com" } as UserOutput);
      api.v1.listNotificationChannels.mockResolvedValue({ data: [{ id: "channel-1" }] } as never);
      deploymentSettingRepository.findTenancy.mockResolvedValue({ organizationId: "organization-1", organizationType: "team", projectId: null });

      await service.autoEnableDeploymentAlert({ userId: "user-1", walletAddress: "akash1abc", dseq: "123" });

      expect(api.v1.upsertDeploymentAlert).toHaveBeenCalledWith(expect.anything(), {
        headers: { "x-user-id": "user-1", "x-organization-id": "organization-1", "x-organization-type": "team", "x-owner-address": "akash1abc" }
      });
    });

    it("files the alert into the user's personal organization when the deployment is not filed anywhere", async () => {
      const { service, api, userRepository, organizationRepository, deploymentSettingRepository } = setup();
      userRepository.findById.mockResolvedValue({ id: "user-1", email: "user@example.com" } as UserOutput);
      api.v1.listNotificationChannels.mockResolvedValue({ data: [{ id: "channel-1" }] } as never);
      deploymentSettingRepository.findTenancy.mockResolvedValue({ organizationId: null, organizationType: null, projectId: null });
      organizationRepository.findPersonalByUserId.mockResolvedValue(mock<OrganizationOutput>({ id: "personal-organization-1", type: "personal" }));

      await service.autoEnableDeploymentAlert({ userId: "user-1", walletAddress: "akash1abc", dseq: "123" });

      expect(api.v1.upsertDeploymentAlert).toHaveBeenCalledWith(expect.anything(), {
        headers: { "x-user-id": "user-1", "x-organization-id": "personal-organization-1", "x-organization-type": "personal", "x-owner-address": "akash1abc" }
      });
    });

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
    const organizationRepository = mock<OrganizationRepository>();
    const deploymentSettingRepository = mock<DeploymentSettingRepository>();
    const service = new NotificationService(api, apiInternal, userRepository, organizationRepository, deploymentSettingRepository, () => logger);

    return { service, api, apiInternal, userRepository, organizationRepository, deploymentSettingRepository, logger };
  }
});
