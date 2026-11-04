import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { CreateLogger } from "@src/core";
import type { SalesOwner } from "@src/hardware-request/lib/gpu-request-routing-policy/gpu-request-routing-policy";
import type { HardwareRequestRepository } from "@src/hardware-request/repositories/hardware-request/hardware-request.repository";
import type {
  HardwareRequestOfferOutput,
  HardwareRequestOfferRepository
} from "@src/hardware-request/repositories/hardware-request-offer/hardware-request-offer.repository";
import type { HardwareRequestAlertContextService } from "@src/hardware-request/services/hardware-request-alert-context/hardware-request-alert-context.service";
import { emailRecipientUserId } from "@src/notifications/lib/email-recipient-user-id/email-recipient-user-id";
import type { NotificationService } from "@src/notifications/services/notification/notification.service";
import type { UserRepository } from "@src/user/repositories";
import { HardwareRequestAcceptedNoticeHandler } from "./hardware-request-accepted-notice.handler";

import { createHardwareRequest } from "@test/seeders/hardware-request.seeder";
import { createUser } from "@test/seeders/user.seeder";

describe(HardwareRequestAcceptedNoticeHandler.name, () => {
  it("emails the owner of the request which offer was accepted and by whom", async () => {
    const { handler, notificationService, hardwareRequestOfferRepository, userRepository, hardwareRequest } = setup({
      owner: { name: "Remington", email: "remington@akash.network" }
    });

    await handler.handle({ hardwareRequestId: hardwareRequest.id, offerId: "offer-1", eventId: "event-1", acceptedByUserId: "user-1", version: 1 });

    expect(hardwareRequestOfferRepository.findById).toHaveBeenCalledWith("offer-1");
    expect(userRepository.findById).toHaveBeenCalledWith("user-1");
    expect(notificationService.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        notificationId: "hardwareRequestAccepted.event-1",
        payload: expect.objectContaining({ description: expect.stringContaining("<strong>Accepted by:</strong><br>jane@example.com") }),
        user: { id: emailRecipientUserId("remington@akash.network"), email: "remington@akash.network" }
      })
    );
  });

  it.each([
    { case: "nobody owns the request", owner: undefined },
    { case: "its owner has no email", owner: { name: "Remington" } }
  ])("emails the shared mailbox when $case, even without knowing who accepted", async ({ owner }) => {
    const { handler, notificationService, userRepository, hardwareRequest } = setup({ owner });
    userRepository.findById.mockResolvedValue(undefined);

    await handler.handle({ hardwareRequestId: hardwareRequest.id, offerId: "offer-1", eventId: "event-1", acceptedByUserId: "user-1", version: 1 });

    expect(notificationService.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({ user: { id: emailRecipientUserId("support@akash.network"), email: "support@akash.network" } })
    );
  });

  it.each([
    { case: "the request", missing: "request" },
    { case: "the offer", missing: "offer" }
  ] as const)("skips and logs when $case no longer exists", async ({ missing }) => {
    const { handler, notificationService, hardwareRequestRepository, hardwareRequestOfferRepository, logger } = setup({});
    (missing === "request" ? hardwareRequestRepository : hardwareRequestOfferRepository).findById.mockResolvedValue(undefined);

    await handler.handle({ hardwareRequestId: "request-1", offerId: "offer-1", eventId: "event-1", acceptedByUserId: "user-1", version: 1 });

    expect(notificationService.createNotification).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith({
      event: "HARDWARE_REQUEST_ACCEPTED_NOTICE_SKIPPED",
      hardwareRequestId: "request-1",
      offerId: "offer-1",
      reason: "Request or offer not found"
    });
  });

  it("needs no permissions and logs under its own name", () => {
    const { handler, createLogger } = setup({});

    expect(handler.requiresPermission()).toEqual([]);
    expect(createLogger).toHaveBeenCalledWith({ context: HardwareRequestAcceptedNoticeHandler.name });
  });

  function setup(input: { owner?: SalesOwner }) {
    const hardwareRequest = createHardwareRequest();
    const hardwareRequestRepository = mock<HardwareRequestRepository>();
    hardwareRequestRepository.findById.mockResolvedValue(hardwareRequest);
    const hardwareRequestOfferRepository = mock<HardwareRequestOfferRepository>();
    hardwareRequestOfferRepository.findById.mockResolvedValue(
      mock<HardwareRequestOfferOutput>({ id: "offer-1", terms: { gpu: { model: "H200", count: 16, interconnect: "cluster" }, location: "Frankfurt" } })
    );
    const userRepository = mock<UserRepository>();
    userRepository.findById.mockResolvedValue(createUser({ email: "jane@example.com" }));
    const hardwareRequestAlertContextService = mock<HardwareRequestAlertContextService>();
    hardwareRequestAlertContextService.load.mockResolvedValue({ organizationName: undefined, accountType: "paying", owner: input.owner });
    const notificationService = mock<NotificationService>();
    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger = vi.fn<CreateLogger>(() => logger);
    const config = { HARDWARE_REQUEST_EMAIL: "support@akash.network", HARDWARE_REQUEST_HOURLY_LIMIT: 3, HARDWARE_REQUEST_DAILY_LIMIT: 10 };
    const handler = new HardwareRequestAcceptedNoticeHandler(
      hardwareRequestRepository,
      hardwareRequestOfferRepository,
      userRepository,
      hardwareRequestAlertContextService,
      notificationService,
      config,
      createLogger
    );

    return { handler, hardwareRequestRepository, hardwareRequestOfferRepository, userRepository, notificationService, logger, createLogger, hardwareRequest };
  }
});
