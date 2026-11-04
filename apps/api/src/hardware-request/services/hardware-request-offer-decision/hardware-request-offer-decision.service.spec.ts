import { afterEach, describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AuthService } from "@src/auth/services/auth.service";
import type { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import type { JobQueueService } from "@src/core/services/job-queue/job-queue.service";
import type { TxService } from "@src/core/services/tx/tx.service";
import type { HardwareRequestOfferStatus, HardwareRequestStatus } from "@src/hardware-request/model-schemas";
import type { HardwareRequestRepository } from "@src/hardware-request/repositories/hardware-request/hardware-request.repository";
import type {
  HardwareRequestEventOutput,
  HardwareRequestEventRepository
} from "@src/hardware-request/repositories/hardware-request-event/hardware-request-event.repository";
import type {
  HardwareRequestOfferOutput,
  HardwareRequestOfferRepository
} from "@src/hardware-request/repositories/hardware-request-offer/hardware-request-offer.repository";
import { HardwareRequestAcceptedNoticeJob } from "@src/hardware-request/services/hardware-request-accepted-notice/hardware-request-accepted-notice.handler";
import type { OrganizationRole } from "@src/organization/model-schemas/organization-member/organization-member.schema";
import type { OrganizationContext } from "@src/organization/types/organization-context";
import { HardwareRequestOfferDecisionService } from "./hardware-request-offer-decision.service";

import { createHardwareRequest } from "@test/seeders/hardware-request.seeder";
import { createUser } from "@test/seeders/user.seeder";

describe(HardwareRequestOfferDecisionService.name, () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  describe("accept", () => {
    it.each(["owner", "admin"] as const)("lets an organization %s accept, closes the other offers and tells sales", async role => {
      const {
        service,
        hardwareRequestRepository,
        hardwareRequestOfferRepository,
        hardwareRequestEventRepository,
        jobQueueService,
        txService,
        authService,
        hardwareRequest,
        user
      } = setup({ role });

      await expect(service.accept(hardwareRequest.id, "offer-1")).resolves.toMatchObject({ status: "accepted" });

      expect(txService.transaction).toHaveBeenCalledTimes(1);
      expect(hardwareRequestRepository.accessibleBy).toHaveBeenCalledWith(authService.ability, "read");
      expect(hardwareRequestRepository.findOneByAndLock).toHaveBeenCalledWith({ id: hardwareRequest.id });
      expect(hardwareRequestOfferRepository.findOneByAndLock).toHaveBeenCalledWith({ id: "offer-1", hardwareRequestId: hardwareRequest.id });
      expect(hardwareRequestOfferRepository.updateById).toHaveBeenCalledWith(
        "offer-1",
        { status: "accepted", updatedAt: expect.any(Date) },
        { returning: true }
      );
      expect(hardwareRequestOfferRepository.closeOthers).toHaveBeenCalledWith(hardwareRequest.id, "offer-1");
      expect(hardwareRequestRepository.updateById).toHaveBeenCalledWith(hardwareRequest.id, { status: "accepted", updatedAt: expect.any(Date) });
      expect(hardwareRequestEventRepository.record).toHaveBeenCalledWith({
        hardwareRequestId: hardwareRequest.id,
        type: "status_changed",
        actor: null,
        payload: { from: "offers", to: "accepted", userId: user.id }
      });
      expect(hardwareRequestEventRepository.record).toHaveBeenCalledWith({
        hardwareRequestId: hardwareRequest.id,
        type: "offer_accepted",
        actor: null,
        payload: { offerId: "offer-1", userId: user.id }
      });
      expect(jobQueueService.enqueue).toHaveBeenCalledWith(
        new HardwareRequestAcceptedNoticeJob({ hardwareRequestId: hardwareRequest.id, offerId: "offer-1", eventId: "event-1", acceptedByUserId: user.id })
      );
    });

    it.each([
      { case: "a member", role: "member", requester: false },
      { case: "the requester who is only a member", role: "member", requester: true },
      { case: "a caller outside any organization", role: undefined, requester: false },
      { case: "the requester acting as owner of another organization", role: "owner", requester: true, contextOrganizationId: "another-org" }
    ] as const)("answers 403 to $case", async ({ role, requester, ...input }) => {
      const { service, hardwareRequestOfferRepository, hardwareRequest } = setup({ role, requester, ...input });

      await expect(service.accept(hardwareRequest.id, "offer-1")).rejects.toMatchObject({
        status: 403,
        message: "Only an owner or admin of the organization can accept an offer"
      });
      expect(hardwareRequestOfferRepository.updateById).not.toHaveBeenCalled();
    });

    it.each(["accepted", "declined", "closed"] as const)("answers 409 for a %s offer", async offerStatus => {
      const { service, hardwareRequest } = setup({ role: "owner", offerStatus });

      await expect(service.accept(hardwareRequest.id, "offer-1")).rejects.toMatchObject({ status: 409, message: `This offer is already ${offerStatus}` });
    });

    it("answers 409 for an offer that expires at this very moment", async () => {
      vi.useFakeTimers({ now: new Date("2026-11-04T12:00:00.000Z"), toFake: ["Date"] });
      const { service, hardwareRequestOfferRepository, hardwareRequest } = setup({ role: "owner", expiresAt: "2026-11-04T12:00:00.000Z" });

      await expect(service.accept(hardwareRequest.id, "offer-1")).rejects.toMatchObject({ status: 409, message: "This offer has expired" });
      expect(hardwareRequestOfferRepository.updateById).not.toHaveBeenCalled();
    });

    it.each(["accepted", "fulfilled", "withdrawn", "closed"] as const)("answers 409 on a %s request", async requestStatus => {
      const { service, hardwareRequestOfferRepository, hardwareRequest } = setup({ role: "owner", requestStatus });

      await expect(service.accept(hardwareRequest.id, "offer-1")).rejects.toMatchObject({ status: 409, message: `This request is already ${requestStatus}` });
      expect(hardwareRequestOfferRepository.findOneByAndLock).not.toHaveBeenCalled();
    });

    it.each(["draft", "withdrawn"] as const)("answers 404 for a %s offer the tenant never saw", async offerStatus => {
      const { service, hardwareRequest } = setup({ role: "owner", offerStatus });

      await expect(service.accept(hardwareRequest.id, "offer-1")).rejects.toMatchObject({ status: 404, message: "Offer not found" });
    });

    it.each(["findById", "findOneByAndLock"] as const)("answers 404 when %s finds no request", async lookup => {
      const { service, hardwareRequestRepository, hardwareRequest } = setup({ role: "owner" });
      hardwareRequestRepository[lookup].mockResolvedValue(undefined);

      await expect(service.accept(hardwareRequest.id, "offer-1")).rejects.toMatchObject({ status: 404, message: "Hardware request not found" });
    });
  });

  describe("decline", () => {
    it("lets the requester decline an offer and records who did", async () => {
      const { service, hardwareRequestOfferRepository, hardwareRequestEventRepository, jobQueueService, hardwareRequest, user } = setup({
        role: "member",
        requester: true
      });

      await expect(service.decline(hardwareRequest.id, "offer-1")).resolves.toMatchObject({ status: "declined" });

      expect(hardwareRequestOfferRepository.updateById).toHaveBeenCalledWith(
        "offer-1",
        { status: "declined", updatedAt: expect.any(Date) },
        { returning: true }
      );
      expect(hardwareRequestEventRepository.record).toHaveBeenCalledWith({
        hardwareRequestId: hardwareRequest.id,
        type: "offer_declined",
        actor: null,
        payload: { offerId: "offer-1", userId: user.id }
      });
      expect(jobQueueService.enqueue).not.toHaveBeenCalled();
    });

    it("lets a requester outside any organization decline an offer on their request without one", async () => {
      const { service, hardwareRequest } = setup({ requester: true, requestOrganizationId: null });

      await expect(service.decline(hardwareRequest.id, "offer-1")).resolves.toMatchObject({ status: "declined" });
    });

    it.each([
      { case: "a member declining someone else's request's offer", requester: false },
      { case: "the requester acting for another organization", requester: true, contextOrganizationId: "another-org" }
    ])("answers 403 to $case", async input => {
      const { service, hardwareRequest } = setup({ role: "member", ...input });

      await expect(service.decline(hardwareRequest.id, "offer-1")).rejects.toMatchObject({
        status: 403,
        message: "Only the requester or an owner or admin of the organization can decline an offer"
      });
    });

    it("leaves an offer that is already declined as it is", async () => {
      const { service, hardwareRequestOfferRepository, hardwareRequestEventRepository, hardwareRequest } = setup({ role: "owner", offerStatus: "declined" });

      await expect(service.decline(hardwareRequest.id, "offer-1")).resolves.toMatchObject({ status: "declined" });
      expect(hardwareRequestOfferRepository.updateById).not.toHaveBeenCalled();
      expect(hardwareRequestEventRepository.record).not.toHaveBeenCalled();
    });

    it.each(["accepted", "closed"] as const)("answers 409 for a %s offer", async offerStatus => {
      const { service, hardwareRequest } = setup({ role: "owner", offerStatus });

      await expect(service.decline(hardwareRequest.id, "offer-1")).rejects.toMatchObject({ status: 409, message: `This offer is already ${offerStatus}` });
    });
  });

  function setup(
    input: {
      role?: OrganizationRole;
      requester?: boolean;
      offerStatus?: HardwareRequestOfferStatus;
      requestStatus?: HardwareRequestStatus;
      expiresAt?: string;
      contextOrganizationId?: string;
      requestOrganizationId?: null;
    } = {}
  ) {
    const user = createUser();
    const hardwareRequest = createHardwareRequest({
      status: input.requestStatus ?? "offers",
      ...(input.requester ? { userId: user.id } : {}),
      ...(input.requestOrganizationId === null ? { organizationId: null } : {})
    });
    const hardwareRequestRepository = mock<HardwareRequestRepository>();
    hardwareRequestRepository.accessibleBy.mockReturnValue(hardwareRequestRepository);
    hardwareRequestRepository.findById.mockResolvedValue(hardwareRequest);
    hardwareRequestRepository.findOneByAndLock.mockResolvedValue(hardwareRequest);
    const offer = mock<HardwareRequestOfferOutput>({
      id: "offer-1",
      status: input.offerStatus ?? "published",
      expiresAt: input.expiresAt ?? new Date(Date.now() + 60_000).toISOString()
    });
    const hardwareRequestOfferRepository = mock<HardwareRequestOfferRepository>();
    hardwareRequestOfferRepository.findOneByAndLock.mockResolvedValue(offer);
    const hardwareRequestEventRepository = mock<HardwareRequestEventRepository>();
    hardwareRequestEventRepository.record.mockResolvedValue(mock<HardwareRequestEventOutput>({ id: "event-1" }));
    const authService = mock<AuthService>({ currentUser: user });
    const executionContextService = mock<ExecutionContextService>();
    executionContextService.get.mockImplementation(key =>
      key === "ORGANIZATION_CONTEXT" && input.role
        ? mock<OrganizationContext>({ role: input.role, organizationId: input.contextOrganizationId ?? hardwareRequest.organizationId ?? undefined })
        : undefined
    );
    const txService = mock<TxService>();
    txService.transaction.mockImplementation(async cb => await cb());
    const jobQueueService = mock<JobQueueService>();
    const service = new HardwareRequestOfferDecisionService(
      hardwareRequestRepository,
      hardwareRequestOfferRepository,
      hardwareRequestEventRepository,
      authService,
      executionContextService,
      txService,
      jobQueueService
    );

    return {
      service,
      hardwareRequestRepository,
      hardwareRequestOfferRepository,
      hardwareRequestEventRepository,
      jobQueueService,
      txService,
      authService,
      hardwareRequest,
      user
    };
  }
});
