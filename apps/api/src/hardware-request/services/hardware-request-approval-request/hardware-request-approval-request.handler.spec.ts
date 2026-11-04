import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { CreateLogger } from "@src/core";
import type { DeploymentConfigService } from "@src/deployment/services/deployment-config/deployment-config.service";
import type { HardwareRequestRepository } from "@src/hardware-request/repositories/hardware-request/hardware-request.repository";
import type {
  HardwareRequestOfferOutput,
  HardwareRequestOfferRepository
} from "@src/hardware-request/repositories/hardware-request-offer/hardware-request-offer.repository";
import type { NotificationService } from "@src/notifications/services/notification/notification.service";
import { gpuOfferApprovalRequestNotification } from "@src/notifications/services/notification-templates/gpu-offer-approval-request-notification";
import type {
  OrganizationMemberRepository,
  OrganizationMemberWithUser
} from "@src/organization/repositories/organization-member/organization-member.repository";
import type { UserOutput, UserRepository } from "@src/user/repositories";
import { HardwareRequestApprovalRequestHandler } from "./hardware-request-approval-request.handler";

import { mockConfigService } from "@test/mocks/config-service.mock";
import { createHardwareRequest } from "@test/seeders/hardware-request.seeder";
import { createUser } from "@test/seeders/user.seeder";

describe(HardwareRequestApprovalRequestHandler.name, () => {
  it("asks every owner and admin with an email to accept the offer the member picked", async () => {
    const { handler, notificationService, organizationMemberRepository, hardwareRequestOfferRepository, userRepository, hardwareRequest } = setup({
      members: [
        member({ userId: "owner-1", role: "owner", email: "owner@example.com" }),
        member({ userId: "admin-1", role: "admin", email: "admin@example.com" }),
        member({ userId: "admin-2", role: "admin", email: null }),
        member({ userId: "member-1", role: "member", email: "member@example.com" }),
        member({ userId: "billing-1", role: "billing", email: "billing@example.com" })
      ]
    });

    await handler.handle(aPayload(hardwareRequest.id));

    expect(hardwareRequestOfferRepository.findById).toHaveBeenCalledWith("offer-1");
    expect(userRepository.findById).toHaveBeenCalledWith("member-1");
    expect(organizationMemberRepository.findAllWithUsers).toHaveBeenCalledWith(hardwareRequest.organizationId);
    const vars = {
      eventId: "event-1",
      requestedBy: "jane",
      requestTitle: "GPU request: 8× H100",
      offerSummary: "8× H100 in Frankfurt, DE at $2.4/GPU-hour",
      requestUrl: `https://console.akash.network/gpu-requests/${hardwareRequest.id}`
    };
    expect(notificationService.createNotification.mock.calls).toEqual([
      [gpuOfferApprovalRequestNotification({ id: "owner-1", email: "owner@example.com" }, vars)],
      [gpuOfferApprovalRequestNotification({ id: "admin-1", email: "admin@example.com" }, vars)]
    ]);
  });

  it.each([
    { requestedBy: createUser({ username: null, email: "jane@example.com" }), name: "jane@example.com" },
    { requestedBy: createUser({ username: null, email: null }), name: "A member" }
  ])("names the member $name without a username", async ({ requestedBy, name }) => {
    const { handler, notificationService, hardwareRequest } = setup({ requestedBy });

    await handler.handle(aPayload(hardwareRequest.id));

    expect(notificationService.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({ payload: expect.objectContaining({ summary: `${name} asks you to accept a GPU offer` }) })
    );
  });

  it.each([
    { case: "the request is gone", hardwareRequest: null },
    { case: "the request has no organization", hardwareRequest: createHardwareRequest({ organizationId: null }) },
    { case: "the offer is gone", offer: null },
    { case: "the member is gone", requestedBy: null }
  ])("skips with a warning when $case", async input => {
    const { handler, notificationService, organizationMemberRepository, logger, createLogger } = setup(input);

    await handler.handle(aPayload("request-1"));

    expect(createLogger).toHaveBeenCalledWith({ context: HardwareRequestApprovalRequestHandler.name });

    expect(organizationMemberRepository.findAllWithUsers).not.toHaveBeenCalled();
    expect(notificationService.createNotification).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith({
      event: "HARDWARE_REQUEST_APPROVAL_REQUEST_SKIPPED",
      hardwareRequestId: "request-1",
      offerId: "offer-1",
      reason: "Request, offer or requester not found"
    });
  });

  function aPayload(hardwareRequestId: string) {
    return { hardwareRequestId, offerId: "offer-1", eventId: "event-1", requestedByUserId: "member-1", version: 1 as const };
  }

  function member(input: Pick<OrganizationMemberWithUser, "userId" | "role" | "email">) {
    return mock<OrganizationMemberWithUser>(input);
  }

  function setup(
    input: {
      hardwareRequest?: ReturnType<typeof createHardwareRequest> | null;
      offer?: null;
      requestedBy?: UserOutput | null;
      members?: OrganizationMemberWithUser[];
    } = {}
  ) {
    const hardwareRequest =
      input.hardwareRequest === undefined ? createHardwareRequest({ category: "gpu_model", gpuModel: "H100", quantity: 8 }) : input.hardwareRequest;
    const hardwareRequestRepository = mock<HardwareRequestRepository>();
    hardwareRequestRepository.findById.mockResolvedValue(hardwareRequest ?? undefined);
    const hardwareRequestOfferRepository = mock<HardwareRequestOfferRepository>();
    hardwareRequestOfferRepository.findById.mockResolvedValue(
      input.offer === null
        ? undefined
        : mock<HardwareRequestOfferOutput>({
            usdPerGpuHour: 2.4,
            terms: { gpu: { model: "H100", count: 8, interconnect: "server" }, location: "Frankfurt, DE" }
          })
    );
    const userRepository = mock<UserRepository>();
    userRepository.findById.mockResolvedValue(input.requestedBy === undefined ? createUser({ username: "jane" }) : input.requestedBy ?? undefined);
    const organizationMemberRepository = mock<OrganizationMemberRepository>();
    organizationMemberRepository.findAllWithUsers.mockResolvedValue(
      input.members ?? [member({ userId: "owner-1", role: "owner", email: "owner@example.com" })]
    );
    const notificationService = mock<NotificationService>();
    const deploymentConfigService = mockConfigService<DeploymentConfigService>({ DEPLOY_WEB_BASE_URL: "https://console.akash.network" });
    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger = vi.fn<CreateLogger>(() => logger);
    const handler = new HardwareRequestApprovalRequestHandler(
      hardwareRequestRepository,
      hardwareRequestOfferRepository,
      userRepository,
      organizationMemberRepository,
      notificationService,
      deploymentConfigService,
      createLogger
    );

    return {
      handler,
      hardwareRequest: hardwareRequest ?? createHardwareRequest(),
      hardwareRequestOfferRepository,
      userRepository,
      organizationMemberRepository,
      notificationService,
      logger,
      createLogger
    };
  }
});
