import { inject, singleton } from "tsyringe";

import { type CreateLogger, LOGGER_FACTORY } from "@src/core";
import { GpuWaitlistEntryRepository } from "@src/gpu-waitlist/repositories/gpu-waitlist-entry/gpu-waitlist-entry.repository";

export type FulfilForOffersInput = {
  userId: string | null;
  organizationId: string | null;
  leaseCreatedAt: Date;
  offers: { vendor: string; model: string; count: number }[];
};

@singleton()
export class GpuWaitlistFulfilmentService {
  readonly #logger: ReturnType<CreateLogger>;

  constructor(
    private readonly gpuWaitlistEntryRepository: GpuWaitlistEntryRepository,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.#logger = createLogger({ context: GpuWaitlistFulfilmentService.name });
  }

  async fulfilForOffers({ userId, organizationId, leaseCreatedAt, offers }: FulfilForOffersInput): Promise<void> {
    const fulfilledIds = await this.gpuWaitlistEntryRepository.markWaitingFulfilledAcrossOrganizations({
      userId,
      organizationId,
      joinedBefore: leaseCreatedAt,
      gpus: offers
    });

    if (fulfilledIds.length > 0) {
      this.#logger.info({ event: "GPU_WAITLIST_ENTRIES_FULFILLED", userId, organizationId, entryIds: fulfilledIds });
    }
  }
}
