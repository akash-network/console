import createError from "http-errors";
import { singleton } from "tsyringe";

import { TxService } from "@src/core/services/tx/tx.service";
import type { HardwareRequestOfferStatus, HardwareRequestOfferTerms } from "@src/hardware-request/model-schemas";
import { HardwareRequestRepository } from "@src/hardware-request/repositories/hardware-request/hardware-request.repository";
import {
  type HardwareRequestOfferOutput,
  HardwareRequestOfferRepository
} from "@src/hardware-request/repositories/hardware-request-offer/hardware-request-offer.repository";
import { ProviderRepository } from "@src/provider/repositories/provider/provider.repository";
import { AuditorService } from "@src/provider/services/auditors/auditors.service";

export type HardwareRequestOfferDraft = { providerAddress: string; usdPerGpuHour: number; terms: HardwareRequestOfferTerms; expiresAt: string };

const EDITABLE_STATUSES: HardwareRequestOfferStatus[] = ["draft", "published"];

/** Lets the team draft the offers a tenant compares, snapshotting the provider's audit and uptime when the offer is written. */
@singleton()
export class HardwareRequestOfferBrokerService {
  constructor(
    private readonly hardwareRequestRepository: HardwareRequestRepository,
    private readonly hardwareRequestOfferRepository: HardwareRequestOfferRepository,
    private readonly providerRepository: ProviderRepository,
    private readonly auditorService: AuditorService,
    private readonly txService: TxService
  ) {}

  async create(hardwareRequestId: string, draft: HardwareRequestOfferDraft): Promise<HardwareRequestOfferOutput> {
    const hardwareRequest = await this.hardwareRequestRepository.unscoped("gpu-request-broker").findById(hardwareRequestId);

    if (!hardwareRequest) throw createError(404, "Hardware request not found");

    return await this.hardwareRequestOfferRepository.create({ hardwareRequestId, ...(await this.#offerFields(draft)) });
  }

  async update(hardwareRequestId: string, offerId: string, draft: HardwareRequestOfferDraft): Promise<HardwareRequestOfferOutput> {
    const fields = await this.#offerFields(draft);

    return await this.txService.transaction(async () => {
      const offer = await this.hardwareRequestOfferRepository.findOneByAndLock({ id: offerId, hardwareRequestId });

      if (!offer) throw createError(404, "Offer not found");
      if (!EDITABLE_STATUSES.includes(offer.status)) throw createError(409, `A ${offer.status} offer can no longer change`);

      return await this.hardwareRequestOfferRepository.updateById(offerId, { ...fields, updatedAt: new Date() }, { returning: true });
    });
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
