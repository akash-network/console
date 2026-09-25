import { BidHttpService, LeaseHttpService, LIVE_LEASE_STATES } from "@akashnetwork/http-sdk";
import { inject, singleton } from "tsyringe";

import { type CreateLogger, LOGGER_FACTORY } from "@src/core";
import { isBidOf, toLeaseGpuOffer } from "@src/deployment/lib/lease-gpu-offers/lease-gpu-offers";
import type { LeaseGpuOffer } from "@src/deployment/model-schemas";

/** A leased bid is the only one of its order left active, so filtering on it keeps a long-lived deployment's lost and closed bids from pushing it off the first page. */
const LEASED_BID_STATE = "active";

export type LeaseGpuOfferRead = {
  liveLeases: number;
  /** Only the leases whose bid offered a gpu, so a cpu deployment records nothing. */
  offers: LeaseGpuOffer[];
};

/** Reads which gpus the provider of each live lease offered, from the bid the lease was created from. */
@singleton()
export class LeaseGpuOfferService {
  private readonly logger: ReturnType<CreateLogger>;

  constructor(
    private readonly leaseHttpService: LeaseHttpService,
    private readonly bidHttpService: BidHttpService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.logger = createLogger({ context: LeaseGpuOfferService.name });
  }

  async findOffers({ owner, dseq }: { owner: string; dseq: string }): Promise<LeaseGpuOfferRead> {
    const [leaseResponses, bids] = await Promise.all([
      Promise.all(LIVE_LEASE_STATES.map(state => this.leaseHttpService.list({ owner, dseq, state }))),
      this.bidHttpService.list(owner, dseq, { state: LEASED_BID_STATE })
    ]);
    const leases = leaseResponses.flatMap(response => response.leases);
    const recordedAt = new Date();
    const offers: LeaseGpuOffer[] = [];

    for (const { lease } of leases) {
      const bid = bids.find(candidate => isBidOf(candidate, lease.id));

      if (!bid) {
        this.logger.warn({ event: "LEASE_GPU_OFFER_BID_NOT_FOUND", dseq, provider: lease.id.provider, gseq: lease.id.gseq, oseq: lease.id.oseq });
        continue;
      }

      const offer = toLeaseGpuOffer(bid, recordedAt);
      if (offer.resources.length) offers.push(offer);
    }

    return { liveLeases: leases.length, offers };
  }
}
