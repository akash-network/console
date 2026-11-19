import { inject, singleton } from "tsyringe";

import { type CreateLogger, LOGGER_FACTORY } from "@src/core";
import { GpuWaitlistEntryRepository } from "@src/gpu-waitlist/repositories/gpu-waitlist-entry/gpu-waitlist-entry.repository";
import { GpuWaitlistNetworkService } from "@src/gpu-waitlist/services/gpu-waitlist-network/gpu-waitlist-network.service";

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
    private readonly gpuWaitlistNetworkService: GpuWaitlistNetworkService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.#logger = createLogger({ context: GpuWaitlistFulfilmentService.name });
  }

  /** Users and organizations are shared across networks, so a lease on a network that does not serve waitlists must not end an entry. */
  async fulfilForOffers({ userId, organizationId, leaseCreatedAt, offers }: FulfilForOffersInput): Promise<void> {
    if (!this.gpuWaitlistNetworkService.servesGpuWaitlists()) return;

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
