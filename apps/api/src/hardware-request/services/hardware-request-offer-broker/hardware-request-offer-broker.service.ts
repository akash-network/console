import createError from "http-errors";
import { singleton } from "tsyringe";

import { JobQueueService } from "@src/core/services/job-queue/job-queue.service";
import { TxService } from "@src/core/services/tx/tx.service";
import type { HardwareRequestOfferStatus, HardwareRequestOfferTerms, HardwareRequestStatus } from "@src/hardware-request/model-schemas";
import { HardwareRequestRepository } from "@src/hardware-request/repositories/hardware-request/hardware-request.repository";
import { HardwareRequestEventRepository } from "@src/hardware-request/repositories/hardware-request-event/hardware-request-event.repository";
import {
  type HardwareRequestOfferOutput,
  HardwareRequestOfferRepository
} from "@src/hardware-request/repositories/hardware-request-offer/hardware-request-offer.repository";
import { HardwareRequestBrokerService } from "@src/hardware-request/services/hardware-request-broker/hardware-request-broker.service";
import { HardwareRequestFunnelJob } from "@src/hardware-request/services/hardware-request-funnel/hardware-request-funnel.handler";
import { ProviderRepository } from "@src/provider/repositories/provider/provider.repository";
import { AuditorService } from "@src/provider/services/auditors/auditors.service";

export type HardwareRequestOfferDraft = { providerAddress: string; usdPerGpuHour: number; terms: HardwareRequestOfferTerms; expiresAt: string };

const EDITABLE_STATUSES: HardwareRequestOfferStatus[] = ["draft", "published"];

const SETTLED_REQUEST_STATUSES: HardwareRequestStatus[] = ["accepted", "fulfilled", "withdrawn", "closed"];

/** Lets the team draft the offers a tenant compares, snapshotting the provider's audit and uptime when the offer is written. */
@singleton()
export class HardwareRequestOfferBrokerService {
  constructor(
    private readonly hardwareRequestRepository: HardwareRequestRepository,
    private readonly hardwareRequestOfferRepository: HardwareRequestOfferRepository,
    private readonly providerRepository: ProviderRepository,
    private readonly auditorService: AuditorService,
    private readonly txService: TxService,
    private readonly hardwareRequestEventRepository: HardwareRequestEventRepository,
    private readonly hardwareRequestBrokerService: HardwareRequestBrokerService,
    private readonly jobQueueService: JobQueueService
  ) {}

  async create(hardwareRequestId: string, draft: HardwareRequestOfferDraft): Promise<HardwareRequestOfferOutput> {
    const hardwareRequest = await this.hardwareRequestRepository.unscoped("gpu-request-broker").findById(hardwareRequestId);

    if (!hardwareRequest) throw createError(404, "Hardware request not found");

    return await this.hardwareRequestOfferRepository.create({ hardwareRequestId, ...(await this.#offerFields(draft)) });
  }

  async update(hardwareRequestId: string, offerId: string, draft: HardwareRequestOfferDraft): Promise<HardwareRequestOfferOutput> {
    const fields = await this.#offerFields(draft);

    return await this.txService.transaction(async () => {
      const offer = await this.#lockOffer(hardwareRequestId, offerId);

      if (!EDITABLE_STATUSES.includes(offer.status)) throw createError(409, `A ${offer.status} offer can no longer change`);

      return await this.hardwareRequestOfferRepository.updateById(offerId, { ...fields, updatedAt: new Date() }, { returning: true });
    });
  }

  /** The first offer the tenant sees moves the request to offers, which is what notifies them. */
  async publish(hardwareRequestId: string, offerId: string, { actor }: { actor: string }): Promise<HardwareRequestOfferOutput> {
    return await this.txService.transaction(async () => {
      const hardwareRequest = await this.hardwareRequestRepository.unscoped("gpu-request-broker").findOneByAndLock({ id: hardwareRequestId });

      if (!hardwareRequest) throw createError(404, "Hardware request not found");
      if (SETTLED_REQUEST_STATUSES.includes(hardwareRequest.status)) throw createError(409, `A ${hardwareRequest.status} request takes no new offers`);

      const offer = await this.#lockOffer(hardwareRequestId, offerId);

      if (offer.status === "published") return offer;
      if (offer.status !== "draft") throw createError(409, `A ${offer.status} offer can't be published`);
      if (new Date(offer.expiresAt) <= new Date()) throw createError(409, "An expired offer can't be published");

      const now = new Date();
      const published = await this.hardwareRequestOfferRepository.updateById(
        offerId,
        { status: "published", publishedAt: now, updatedAt: now },
        { returning: true }
      );
      await this.hardwareRequestEventRepository.record({ hardwareRequestId, type: "offer_published", actor, payload: { offerId } });
      await this.jobQueueService.enqueue(
        new HardwareRequestFunnelJob({
          hardwareRequestId,
          step: "gpu_request_offer_published",
          stepKey: offerId,
          occurredAt: now.toISOString(),
          properties: { offerId, usdPerGpuHour: offer.usdPerGpuHour }
        })
      );
      await this.hardwareRequestBrokerService.moveLockedToStatus(hardwareRequest, { actor, status: "offers" });

      return published;
    });
  }

  async withdraw(hardwareRequestId: string, offerId: string, { actor }: { actor: string }): Promise<HardwareRequestOfferOutput> {
    return await this.txService.transaction(async () => {
      const offer = await this.#lockOffer(hardwareRequestId, offerId);

      if (offer.status === "withdrawn") return offer;
      if (!EDITABLE_STATUSES.includes(offer.status)) throw createError(409, `A ${offer.status} offer can't be withdrawn`);

      const withdrawn = await this.hardwareRequestOfferRepository.updateById(offerId, { status: "withdrawn", updatedAt: new Date() }, { returning: true });
      await this.hardwareRequestEventRepository.record({ hardwareRequestId, type: "offer_withdrawn", actor, payload: { offerId } });

      return withdrawn;
    });
  }

  async #lockOffer(hardwareRequestId: string, offerId: string): Promise<HardwareRequestOfferOutput> {
    const offer = await this.hardwareRequestOfferRepository.findOneByAndLock({ id: offerId, hardwareRequestId });

    if (!offer) throw createError(404, "Offer not found");

    return offer;
  }

  async #offerFields({ providerAddress, usdPerGpuHour, terms, expiresAt }: HardwareRequestOfferDraft) {
    const [provider] = await this.providerRepository.getWithAttributesAndAuditors({ addresses: [providerAddress] });

    if (!provider) throw createError(422, "No provider has this address");

    const auditors = new Set((await this.auditorService.getAuditors()).map(auditor => auditor.address));

    return {
      providerAddress,
      providerAudited: provider.providerAttributeSignatures.some(signature => auditors.has(signature.auditor)),
      providerUptime7d: provider.uptime7d ?? null,
      usdPerGpuHour,
      terms,
      expiresAt: new Date(expiresAt)
    };
  }
}
