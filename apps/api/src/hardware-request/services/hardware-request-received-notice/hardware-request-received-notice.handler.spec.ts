import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { CreateLogger } from "@src/core";
import type { DeploymentConfigService } from "@src/deployment/services/deployment-config/deployment-config.service";
import type { HardwareRequestRepository } from "@src/hardware-request/repositories/hardware-request/hardware-request.repository";
import { emailRecipientUserId } from "@src/notifications/lib/email-recipient-user-id/email-recipient-user-id";
import type { NotificationService } from "@src/notifications/services/notification/notification.service";
import type { UserRepository } from "@src/user/repositories";
import { HardwareRequestReceivedNoticeHandler } from "./hardware-request-received-notice.handler";

import { mockConfigService } from "@test/mocks/config-service.mock";
import { createHardwareRequest } from "@test/seeders/hardware-request.seeder";
import { createUser } from "@test/seeders/user.seeder";

describe(HardwareRequestReceivedNoticeHandler.name, () => {
  it("emails the requester a confirmation with a link to the request", async () => {
    const { handler, notificationService, hardwareRequest, requester } = setup({ email: "jane@example.com" });

    await handler.handle({ hardwareRequestId: hardwareRequest.id, version: 1 });

    expect(notificationService.createNotification).toHaveBeenCalledWith({
      notificationId: `gpuRequestReceived.${hardwareRequest.id}`,
      payload: {
        summary: expect.stringMatching(/ was received$/),
        description: "We're working on it and will let you know if we find capacity that matches your request.",
        actions: [{ label: "View request", url: `https://console.akash.network/gpu-requests/${hardwareRequest.id}` }]
      },
      user: { id: requester.id, email: "jane@example.com" }
    });
  });

  it("emails the contact address of a request filed for an email with no account", async () => {
    const { handler, notificationService, userRepository, hardwareRequestRepository } = setup({ email: null });
    const unclaimed = createHardwareRequest({ userId: null, contactEmail: "lead@example.com" });
    hardwareRequestRepository.findById.mockResolvedValue(unclaimed);

    await handler.handle({ hardwareRequestId: unclaimed.id, version: 1 });

    expect(userRepository.findById).not.toHaveBeenCalled();
    expect(notificationService.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({ user: { id: emailRecipientUserId("lead@example.com"), email: "lead@example.com" } })
    );
  });

  it("sends no email to a requester without one", async () => {
    const { handler, notificationService, hardwareRequest } = setup({ email: null });

    await handler.handle({ hardwareRequestId: hardwareRequest.id, version: 1 });

    expect(notificationService.createNotification).not.toHaveBeenCalled();
  });

  it.each([
    { case: "the request", missing: "request" },
    { case: "the requester", missing: "requester" }
  ] as const)("skips and logs when $case no longer exists", async ({ missing }) => {
    const { handler, notificationService, hardwareRequestRepository, userRepository, logger } = setup({ email: "jane@example.com" });
    if (missing === "request") hardwareRequestRepository.findById.mockResolvedValue(undefined);
    else userRepository.findById.mockResolvedValue(undefined);

    await handler.handle({ hardwareRequestId: "request-1", version: 1 });

    expect(notificationService.createNotification).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith({
      event: "HARDWARE_REQUEST_RECEIVED_NOTICE_SKIPPED",
      hardwareRequestId: "request-1",
      reason: "Request or requester not found"
    });
  });

  it("logs under its own name", () => {
    const { createLogger } = setup({ email: null });

    expect(createLogger).toHaveBeenCalledWith({ context: HardwareRequestReceivedNoticeHandler.name });
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
    const notificationService = mock<NotificationService>();
    const deploymentConfigService = mockConfigService<DeploymentConfigService>({ DEPLOY_WEB_BASE_URL: "https://console.akash.network" });
    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger = vi.fn<CreateLogger>(() => logger);
    const handler = new HardwareRequestReceivedNoticeHandler(
      hardwareRequestRepository,
      userRepository,
      notificationService,
      deploymentConfigService,
      createLogger
    );

    return { handler, hardwareRequestRepository, userRepository, notificationService, logger, createLogger, hardwareRequest, requester };
  }
});
