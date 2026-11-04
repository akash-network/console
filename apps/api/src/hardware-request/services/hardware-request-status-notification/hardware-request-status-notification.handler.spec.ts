import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { ActivityService } from "@src/activity/services/activity/activity.service";
import type { CreateLogger } from "@src/core";
import type { DeploymentConfigService } from "@src/deployment/services/deployment-config/deployment-config.service";
import type { HardwareRequestRepository } from "@src/hardware-request/repositories/hardware-request/hardware-request.repository";
import type { NotificationService } from "@src/notifications/services/notification/notification.service";
import type { UserRepository } from "@src/user/repositories";
import { HardwareRequestStatusNotificationHandler } from "./hardware-request-status-notification.handler";

import { createHardwareRequest } from "@test/seeders/hardware-request.seeder";
import { createUser } from "@test/seeders/user.seeder";

describe(HardwareRequestStatusNotificationHandler.name, () => {
  it("records the change in the requester's feed but sends no email to a requester without one", async () => {
    const { handler, activityService, notificationService, hardwareRequest } = setup({ email: null });

    await handler.handle({ hardwareRequestId: hardwareRequest.id, eventId: "event-1", status: "sourcing", version: 1 });

    expect(activityService.record).toHaveBeenCalledWith(expect.objectContaining({ type: "gpu_request_update", dedupeKey: "gpuRequestStatus:event-1" }));
    expect(notificationService.createNotification).not.toHaveBeenCalled();
  });

  it.each([
    { case: "the request", missing: "request" },
    { case: "the requester", missing: "requester" }
  ] as const)("skips and logs when $case no longer exists", async ({ missing }) => {
    const { handler, activityService, hardwareRequestRepository, userRepository, logger } = setup({ email: "jane@example.com" });
    if (missing === "request") hardwareRequestRepository.findById.mockResolvedValue(undefined);
    else userRepository.findById.mockResolvedValue(undefined);

    await handler.handle({ hardwareRequestId: "request-1", eventId: "event-1", status: "sourcing", version: 1 });

    expect(activityService.record).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith({
      event: "HARDWARE_REQUEST_STATUS_NOTIFICATION_SKIPPED",
      hardwareRequestId: "request-1",
      reason: "Request or requester not found"
    });
  });

  it("needs no permissions", () => {
    const { handler } = setup({ email: null });

    expect(handler.requiresPermission()).toEqual([]);
  });

  function setup(input: { email: string | null }) {
    const requester = createUser({ email: input.email });
    const hardwareRequest = createHardwareRequest({ userId: requester.id });
    const hardwareRequestRepository = mock<HardwareRequestRepository>();
    hardwareRequestRepository.findById.mockResolvedValue(hardwareRequest);
    const userRepository = mock<UserRepository>();
    userRepository.findById.mockResolvedValue(requester);
    const activityService = mock<ActivityService>();
    const notificationService = mock<NotificationService>();
    const deploymentConfigService = mock<DeploymentConfigService>();
    const logger = mock<ReturnType<CreateLogger>>();
    const handler = new HardwareRequestStatusNotificationHandler(
      hardwareRequestRepository,
      userRepository,
      activityService,
      notificationService,
      deploymentConfigService,
      vi.fn<CreateLogger>(() => logger)
    );

    return { handler, hardwareRequestRepository, userRepository, activityService, notificationService, logger, hardwareRequest };
  }
});
