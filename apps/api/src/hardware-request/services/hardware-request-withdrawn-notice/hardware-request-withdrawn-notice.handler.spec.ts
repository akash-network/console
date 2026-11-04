import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { CreateLogger } from "@src/core";
import type { SalesOwner } from "@src/hardware-request/lib/gpu-request-routing-policy/gpu-request-routing-policy";
import type { HardwareRequestRepository } from "@src/hardware-request/repositories/hardware-request/hardware-request.repository";
import type { HardwareRequestAlertContextService } from "@src/hardware-request/services/hardware-request-alert-context/hardware-request-alert-context.service";
import { emailRecipientUserId } from "@src/notifications/lib/email-recipient-user-id/email-recipient-user-id";
import type { NotificationService } from "@src/notifications/services/notification/notification.service";
import { HardwareRequestWithdrawnNoticeHandler } from "./hardware-request-withdrawn-notice.handler";

import { createHardwareRequest } from "@test/seeders/hardware-request.seeder";

describe(HardwareRequestWithdrawnNoticeHandler.name, () => {
  it("tells the owner of the request, whatever its lane", async () => {
    const { handler, notificationService, hardwareRequestAlertContextService, hardwareRequest } = setup({
      owner: { name: "Remington", email: "remington@akash.network" }
    });

    await handler.handle({ hardwareRequestId: hardwareRequest.id, eventId: "event-1", version: 1 });

    expect(hardwareRequestAlertContextService.load).toHaveBeenCalledWith(hardwareRequest);
    expect(notificationService.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        notificationId: "hardwareRequestWithdrawn.event-1",
        user: { id: emailRecipientUserId("remington@akash.network"), email: "remington@akash.network" }
      })
    );
  });

  it.each([
    { case: "no owner", owner: undefined },
    { case: "an owner without an email", owner: { name: "Remington" } }
  ])("tells the shared mailbox when the request has $case", async ({ owner }) => {
    const { handler, notificationService, hardwareRequest } = setup({ owner });

    await handler.handle({ hardwareRequestId: hardwareRequest.id, eventId: "event-1", version: 1 });

    expect(notificationService.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({ user: { id: emailRecipientUserId("support@akash.network"), email: "support@akash.network" } })
    );
  });

  it("skips and logs when the request no longer exists", async () => {
    const { handler, notificationService, hardwareRequestRepository, logger } = setup({});
    hardwareRequestRepository.findById.mockResolvedValue(undefined);

    await handler.handle({ hardwareRequestId: "missing", eventId: "event-1", version: 1 });

    expect(notificationService.createNotification).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith({
      event: "HARDWARE_REQUEST_WITHDRAWN_NOTICE_SKIPPED",
      hardwareRequestId: "missing",
      reason: "Hardware request not found"
    });
  });

  it("needs no permissions and logs under its own name", () => {
    const { handler, createLogger } = setup({});

    expect(handler.requiresPermission()).toEqual([]);
    expect(createLogger).toHaveBeenCalledWith({ context: HardwareRequestWithdrawnNoticeHandler.name });
  });

  function setup(input: { owner?: SalesOwner }) {
    const hardwareRequest = createHardwareRequest({ lane: "automated" });
    const hardwareRequestRepository = mock<HardwareRequestRepository>();
    hardwareRequestRepository.findById.mockResolvedValue(hardwareRequest);
    const hardwareRequestAlertContextService = mock<HardwareRequestAlertContextService>();
    hardwareRequestAlertContextService.load.mockResolvedValue({ organizationName: undefined, accountType: "trial", owner: input.owner });
    const notificationService = mock<NotificationService>();
    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger = vi.fn<CreateLogger>(() => logger);
    const config = { HARDWARE_REQUEST_EMAIL: "support@akash.network", HARDWARE_REQUEST_HOURLY_LIMIT: 3, HARDWARE_REQUEST_DAILY_LIMIT: 10 };
    const handler = new HardwareRequestWithdrawnNoticeHandler(
      hardwareRequestRepository,
      hardwareRequestAlertContextService,
      notificationService,
      config,
      createLogger
    );

    return { handler, hardwareRequestRepository, hardwareRequestAlertContextService, notificationService, logger, createLogger, hardwareRequest };
  }
});
