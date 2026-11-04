import createError from "http-errors";
import { singleton } from "tsyringe";

import { AuthService } from "@src/auth/services/auth.service";
import { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import { JobQueueService } from "@src/core/services/job-queue/job-queue.service";
import { TxService } from "@src/core/services/tx/tx.service";
import { isVisibleToTenant, type TenantVisibleOffer } from "@src/hardware-request/lib/hardware-request-tenant-offer/hardware-request-tenant-offer";
import type { HardwareRequestStatus } from "@src/hardware-request/model-schemas";
import { type HardwareRequestOutput, HardwareRequestRepository } from "@src/hardware-request/repositories/hardware-request/hardware-request.repository";
import { HardwareRequestEventRepository } from "@src/hardware-request/repositories/hardware-request-event/hardware-request-event.repository";
import { HardwareRequestOfferRepository } from "@src/hardware-request/repositories/hardware-request-offer/hardware-request-offer.repository";
import { HardwareRequestAcceptedNoticeJob } from "@src/hardware-request/services/hardware-request-accepted-notice/hardware-request-accepted-notice.handler";
import type { OrganizationRole } from "@src/organization/model-schemas/organization-member/organization-member.schema";

const COMMITTING_ROLES: OrganizationRole[] = ["owner", "admin"];

const SETTLED_REQUEST_STATUSES: HardwareRequestStatus[] = ["accepted", "fulfilled", "withdrawn", "closed"];

type Decider = "owners_and_admins" | "requester_owners_and_admins";

/** Only someone who can commit the organization accepts, while the requester may also turn an offer down. */
@singleton()
export class HardwareRequestOfferDecisionService {
  constructor(
    private readonly hardwareRequestRepository: HardwareRequestRepository,
    private readonly hardwareRequestOfferRepository: HardwareRequestOfferRepository,
    private readonly hardwareRequestEventRepository: HardwareRequestEventRepository,
    private readonly authService: AuthService,
    private readonly executionContextService: ExecutionContextService,
    private readonly txService: TxService,
    private readonly jobQueueService: JobQueueService
  ) {}

  async accept(hardwareRequestId: string, offerId: string): Promise<TenantVisibleOffer> {
    const userId = this.authService.currentUser.id;

    return await this.txService.transaction(async () => {
      const hardwareRequest = await this.#lockRequest(hardwareRequestId, "owners_and_admins");
      const offer = await this.#lockVisibleOffer(hardwareRequestId, offerId);

      if (offer.status !== "published") throw createError(409, `This offer is already ${offer.status}`);
      if (new Date(offer.expiresAt) <= new Date()) throw createError(409, "This offer has expired");

      const now = new Date();
      const accepted = await this.hardwareRequestOfferRepository.updateById(offerId, { status: "accepted", updatedAt: now }, { returning: true });
      await this.hardwareRequestOfferRepository.closeOthers(hardwareRequestId, offerId);
      await this.hardwareRequestRepository.updateById(hardwareRequestId, { status: "accepted", updatedAt: now });
      await this.hardwareRequestEventRepository.record({
        hardwareRequestId,
        type: "status_changed",
        actor: null,
        payload: { from: hardwareRequest.status, to: "accepted", userId }
      });
      const event = await this.hardwareRequestEventRepository.record({ hardwareRequestId, type: "offer_accepted", actor: null, payload: { offerId, userId } });
      await this.jobQueueService.enqueue(new HardwareRequestAcceptedNoticeJob({ hardwareRequestId, offerId, eventId: event.id, acceptedByUserId: userId }));

      return { ...accepted, status: "accepted" };
    });
  }

  async decline(hardwareRequestId: string, offerId: string): Promise<TenantVisibleOffer> {
    const userId = this.authService.currentUser.id;

    return await this.txService.transaction(async () => {
      await this.#lockRequest(hardwareRequestId, "requester_owners_and_admins");
      const offer = await this.#lockVisibleOffer(hardwareRequestId, offerId);

      if (offer.status === "declined") return offer;
      if (offer.status !== "published") throw createError(409, `This offer is already ${offer.status}`);

      const declined = await this.hardwareRequestOfferRepository.updateById(offerId, { status: "declined", updatedAt: new Date() }, { returning: true });
      await this.hardwareRequestEventRepository.record({ hardwareRequestId, type: "offer_declined", actor: null, payload: { offerId, userId } });

      return { ...declined, status: "declined" };
    });
  }

  async #lockRequest(hardwareRequestId: string, decider: Decider): Promise<HardwareRequestOutput> {
    const readable = await this.hardwareRequestRepository.accessibleBy(this.authService.ability, "read").findById(hardwareRequestId);

    if (!readable) throw createError(404, "Hardware request not found");

    const organizationContext = this.executionContextService.get("ORGANIZATION_CONTEXT");
    const actsForRequestOrganization = (organizationContext?.organizationId ?? null) === readable.organizationId;
    const role = actsForRequestOrganization ? organizationContext?.role : undefined;
    const isRequester = decider === "requester_owners_and_admins" && actsForRequestOrganization && readable.userId === this.authService.currentUser.id;

    if (!isRequester && !(role && COMMITTING_ROLES.includes(role))) {
      throw createError(
        403,
        decider === "owners_and_admins"
          ? "Only an owner or admin of the organization can accept an offer"
          : "Only the requester or an owner or admin of the organization can decline an offer"
      );
    }

    const hardwareRequest = await this.hardwareRequestRepository.findOneByAndLock({ id: hardwareRequestId });

    if (!hardwareRequest) throw createError(404, "Hardware request not found");
    if (SETTLED_REQUEST_STATUSES.includes(hardwareRequest.status)) throw createError(409, `This request is already ${hardwareRequest.status}`);

    return hardwareRequest;
  }

  async #lockVisibleOffer(hardwareRequestId: string, offerId: string): Promise<TenantVisibleOffer> {
    const offer = await this.hardwareRequestOfferRepository.findOneByAndLock({ id: offerId, hardwareRequestId });

    if (!offer || !isVisibleToTenant(offer)) throw createError(404, "Offer not found");

    return offer;
  }
}
