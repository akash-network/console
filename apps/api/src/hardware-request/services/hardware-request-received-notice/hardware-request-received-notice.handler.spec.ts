import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { CreateLogger } from "@src/core";
import type { DeploymentConfigService } from "@src/deployment/services/deployment-config/deployment-config.service";
import { DEFAULT_GPU_REQUEST_ROUTING_POLICY } from "@src/hardware-request/lib/gpu-request-routing-policy/gpu-request-routing-policy";
import type { HardwareRequestRepository } from "@src/hardware-request/repositories/hardware-request/hardware-request.repository";
import type { GpuRequestRoutingService } from "@src/hardware-request/services/gpu-request-routing/gpu-request-routing.service";
import { emailRecipientUserId } from "@src/notifications/lib/email-recipient-user-id/email-recipient-user-id";
import type { NotificationService } from "@src/notifications/services/notification/notification.service";
import type { UserRepository } from "@src/user/repositories";
import { HardwareRequestReceivedNoticeHandler } from "./hardware-request-received-notice.handler";

import { mockConfigService } from "@test/mocks/config-service.mock";
import { createHardwareRequest } from "@test/seeders/hardware-request.seeder";
import { createUser } from "@test/seeders/user.seeder";

describe(HardwareRequestReceivedNoticeHandler.name, () => {
  it("emails the requester the reply time in the business-hours zone and a link to the request", async () => {
    const { handler, notificationService, hardwareRequest, requester } = setup({ email: "jane@example.com" });

    await handler.handle({ hardwareRequestId: hardwareRequest.id, version: 1 });

    expect(notificationService.createNotification).toHaveBeenCalledWith({
      notificationId: `gpuRequestReceived.${hardwareRequest.id}`,
      payload: {
        summary: expect.stringMatching(/ was received$/),
        description: "Our team will reply by Thursday, November 12 at 7:00 PM GMT+1.",
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
    const hardwareRequest = createHardwareRequest({ userId: requester.id, lane: "sales", firstReplyDueAt: "2026-11-12T18:00:00.000Z" });
    const hardwareRequestRepository = mock<HardwareRequestRepository>();
    hardwareRequestRepository.findById.mockResolvedValue(hardwareRequest);
    const userRepository = mock<UserRepository>();
    userRepository.findById.mockResolvedValue(requester);
    const notificationService = mock<NotificationService>();
    const gpuRequestRoutingService = mock<GpuRequestRoutingService>();
    gpuRequestRoutingService.getPolicy.mockReturnValue({
      ...DEFAULT_GPU_REQUEST_ROUTING_POLICY,
      businessHours: { ...DEFAULT_GPU_REQUEST_ROUTING_POLICY.businessHours, timeZone: "Europe/Paris" }
    });
    const deploymentConfigService = mockConfigService<DeploymentConfigService>({ DEPLOY_WEB_BASE_URL: "https://console.akash.network" });
    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger = vi.fn<CreateLogger>(() => logger);
    const handler = new HardwareRequestReceivedNoticeHandler(
      hardwareRequestRepository,
      userRepository,
      notificationService,
      gpuRequestRoutingService,
      deploymentConfigService,
      createLogger
    );

    return { handler, hardwareRequestRepository, userRepository, notificationService, logger, createLogger, hardwareRequest, requester };
  }
});
