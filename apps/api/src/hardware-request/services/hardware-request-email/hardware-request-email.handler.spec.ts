import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { CreateLogger } from "@src/core";
import type { SalesOwner } from "@src/hardware-request/lib/gpu-request-routing-policy/gpu-request-routing-policy";
import type { HardwareRequestAlertContext } from "@src/hardware-request/lib/hardware-request-alert-summary/hardware-request-alert-summary";
import type { HardwareRequestLane } from "@src/hardware-request/model-schemas";
import type { HardwareRequestRepository } from "@src/hardware-request/repositories/hardware-request/hardware-request.repository";
import type { HardwareRequestAlertContextService } from "@src/hardware-request/services/hardware-request-alert-context/hardware-request-alert-context.service";
import { emailRecipientUserId } from "@src/notifications/lib/email-recipient-user-id/email-recipient-user-id";
import type { NotificationService } from "@src/notifications/services/notification/notification.service";
import type { UserRepository } from "@src/user/repositories";
import { HardwareRequestEmailHandler } from "./hardware-request-email.handler";
import { hardwareRequestEmailNotification } from "./hardware-request-email-notification";

import { createHardwareRequest } from "@test/seeders/hardware-request.seeder";
import { createUser } from "@test/seeders/user.seeder";

describe(HardwareRequestEmailHandler.name, () => {
  it("emails the request to the configured mailbox", async () => {
    const { handler, notificationService, hardwareRequest, requester, context, hardwareRequestAlertContextService } = setup({
      mailboxEmail: "sales@akash.network"
    });

    await handler.handle({ hardwareRequestId: hardwareRequest.id, version: 1 });

    expect(hardwareRequestAlertContextService.load).toHaveBeenCalledWith(hardwareRequest);
    expect(notificationService.createNotification.mock.calls).toEqual([
      [
        hardwareRequestEmailNotification({
          hardwareRequest,
          requester,
          context,
          mailbox: { id: "6fa02748-b14a-81a1-8270-e378d834d408", email: "sales@akash.network" }
        })
      ]
    ]);
  });

  it("also emails the owner of a sales-lane request", async () => {
    const owner = { name: "Remington", email: "remington@akash.network" };
    const { handler, notificationService, hardwareRequest, requester, context } = setup({ lane: "sales", owner });

    await handler.handle({ hardwareRequestId: hardwareRequest.id, version: 1 });

    expect(notificationService.createNotification).toHaveBeenCalledTimes(2);
    expect(notificationService.createNotification).toHaveBeenLastCalledWith(
      hardwareRequestEmailNotification({
        hardwareRequest,
        requester,
        context,
        mailbox: { id: emailRecipientUserId(owner.email), email: owner.email },
        notificationId: `hardwareRequest.${hardwareRequest.id}.owner`
      })
    );
  });

  it.each([
    { case: "an automated-lane request", lane: "automated", owner: { name: "Remington", email: "remington@akash.network" } },
    { case: "an owner without an email", lane: "sales", owner: { name: "Remington" } }
  ] as const)("emails only the mailbox for $case", async ({ lane, owner }) => {
    const { handler, notificationService, hardwareRequest } = setup({ lane, owner });

    await handler.handle({ hardwareRequestId: hardwareRequest.id, version: 1 });

    expect(notificationService.createNotification).toHaveBeenCalledTimes(1);
  });

  it("looks up the requester of the request", async () => {
    const { handler, userRepository, hardwareRequest } = setup();

    await handler.handle({ hardwareRequestId: hardwareRequest.id, version: 1 });

    expect(userRepository.findById).toHaveBeenCalledWith(hardwareRequest.userId);
  });

  it("emails the mailbox without looking up a requester for a request filed for an email with no account", async () => {
    const { handler, userRepository, notificationService, hardwareRequestRepository } = setup();
    const unclaimed = createHardwareRequest({ userId: null });
    hardwareRequestRepository.findById.mockResolvedValue(unclaimed);

    await handler.handle({ hardwareRequestId: unclaimed.id, version: 1 });

    expect(userRepository.findById).not.toHaveBeenCalled();
    expect(notificationService.createNotification).toHaveBeenCalledTimes(1);
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

  function setup(input: { mailboxEmail?: string; lane?: HardwareRequestLane; owner?: SalesOwner } = {}) {
    const requester = createUser();
    const hardwareRequest = createHardwareRequest({ userId: requester.id, lane: input.lane ?? "automated" });
    const context: HardwareRequestAlertContext = { organizationName: "Acme", accountType: "paying", owner: input.owner };
    const hardwareRequestAlertContextService = mock<HardwareRequestAlertContextService>();
    hardwareRequestAlertContextService.load.mockResolvedValue(context);
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
      hardwareRequestAlertContextService,
      config,
      vi.fn<CreateLogger>(() => logger)
    );

    return {
      handler,
      hardwareRequestRepository,
      userRepository,
      notificationService,
      hardwareRequestAlertContextService,
      logger,
      hardwareRequest,
      requester,
      context
    };
  }
});
