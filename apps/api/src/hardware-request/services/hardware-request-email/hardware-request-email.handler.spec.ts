import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { CreateLogger } from "@src/core";
import type { HardwareRequestRepository } from "@src/hardware-request/repositories/hardware-request/hardware-request.repository";
import type { NotificationService } from "@src/notifications/services/notification/notification.service";
import type { UserRepository } from "@src/user/repositories";
import { HardwareRequestEmailHandler } from "./hardware-request-email.handler";
import { hardwareRequestEmailNotification } from "./hardware-request-email-notification";

import { createHardwareRequest } from "@test/seeders/hardware-request.seeder";
import { createUser } from "@test/seeders/user.seeder";

describe(HardwareRequestEmailHandler.name, () => {
  it("emails the request to the configured mailbox", async () => {
    const { handler, notificationService, hardwareRequest, requester } = setup({ mailboxEmail: "sales@akash.network" });

    await handler.handle({ hardwareRequestId: hardwareRequest.id, version: 1 });

    expect(notificationService.createNotification).toHaveBeenCalledWith(
      hardwareRequestEmailNotification({
        hardwareRequest,
        requester,
        mailbox: { id: "6fa02748-b14a-81a1-8270-e378d834d408", email: "sales@akash.network" }
      })
    );
  });

  it("looks up the requester of the request", async () => {
    const { handler, userRepository, hardwareRequest } = setup();

    await handler.handle({ hardwareRequestId: hardwareRequest.id, version: 1 });

    expect(userRepository.findById).toHaveBeenCalledWith(hardwareRequest.userId);
  });

  it("skips and logs when the request no longer exists", async () => {
    const { handler, notificationService, hardwareRequestRepository, logger } = setup();
    hardwareRequestRepository.findById.mockResolvedValue(undefined);

    await handler.handle({ hardwareRequestId: "missing-id", version: 1 });

    expect(notificationService.createNotification).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith({
      event: "HARDWARE_REQUEST_EMAIL_SKIPPED",
      hardwareRequestId: "missing-id",
      reason: "Hardware request not found"
    });
  });

  it("needs no permissions", () => {
    const { handler } = setup();

    expect(handler.requiresPermission()).toEqual([]);
  });

  function setup(input: { mailboxEmail?: string } = {}) {
    const requester = createUser();
    const hardwareRequest = createHardwareRequest({ userId: requester.id });
    const hardwareRequestRepository = mock<HardwareRequestRepository>();
    hardwareRequestRepository.findById.mockResolvedValue(hardwareRequest);
    const userRepository = mock<UserRepository>();
    userRepository.findById.mockResolvedValue(requester);
    const notificationService = mock<NotificationService>();
    const logger = mock<ReturnType<CreateLogger>>();
    const config = {
      HARDWARE_REQUEST_EMAIL: input.mailboxEmail ?? "support@akash.network",
      HARDWARE_REQUEST_HOURLY_LIMIT: 3,
      HARDWARE_REQUEST_DAILY_LIMIT: 10
    };

    const handler = new HardwareRequestEmailHandler(
      hardwareRequestRepository,
      userRepository,
      notificationService,
      config,
      vi.fn<CreateLogger>(() => logger)
    );

    return { handler, hardwareRequestRepository, userRepository, notificationService, logger, hardwareRequest, requester };
  }
});
