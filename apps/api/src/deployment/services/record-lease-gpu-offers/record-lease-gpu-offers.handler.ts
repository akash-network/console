import { inject, singleton } from "tsyringe";

import { isWalletInitialized, UserWalletRepository } from "@src/billing/repositories";
import { type CreateLogger, JOB_NAME, type JobHandler, type JobPayload, type JobPermissions, LOGGER_FACTORY } from "@src/core";
import { readOfferedGpus } from "@src/deployment/lib/lease-gpu-offers/lease-gpu-offers";
import type { LeaseGpuOffer } from "@src/deployment/model-schemas";
import { DeploymentSettingRepository, type DeploymentWallet } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import { LeaseGpuOfferService } from "@src/deployment/services/lease-gpu-offer/lease-gpu-offer.service";
import { RecordLeaseGpuOffers } from "@src/deployment/services/lease-gpu-offer-job/lease-gpu-offer-job.service";
import { GpuWaitlistFulfilmentService } from "@src/gpu-waitlist/services/gpu-waitlist-fulfilment/gpu-waitlist-fulfilment.service";

/** Throws rather than settles when there is nothing to record against yet, so pg-boss retries it. */
@singleton()
export class RecordLeaseGpuOffersHandler implements JobHandler<RecordLeaseGpuOffers> {
  public readonly accepts = RecordLeaseGpuOffers;

  public readonly concurrency = 2;

  /** One job per state per deployment, so a lease landing while a read runs is picked up by one more read rather than dropped. */
  public readonly policy = "stately";

  private readonly logger: ReturnType<CreateLogger>;

  constructor(
    private readonly userWalletRepository: UserWalletRepository,
    private readonly offerService: LeaseGpuOfferService,
    private readonly deploymentSettingRepository: DeploymentSettingRepository,
    private readonly gpuWaitlistFulfilmentService: GpuWaitlistFulfilmentService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.logger = createLogger({ context: RecordLeaseGpuOffersHandler.name });
  }

  requiresPermission(): JobPermissions {
    return [];
  }

  async handle(payload: JobPayload<RecordLeaseGpuOffers>): Promise<void> {
    const { walletId, dseq, leaseCreatedAt } = payload;
    const context = { job: RecordLeaseGpuOffers[JOB_NAME], walletId, dseq };
    const wallet = await this.userWalletRepository.findOneBy({ id: walletId });

    if (!wallet || !isWalletInitialized(wallet)) {
      this.logger.warn({ event: "LEASE_GPU_OFFERS_SKIPPED", reason: "wallet_uninitialized", ...context });
      return;
    }

    const { liveLeases, offers, leasesWithoutBid } = await this.offerService.findOffers({ owner: wallet.address, dseq });

    if (!liveLeases) throw new Error(`No live lease of deployment ${dseq} is visible on chain yet`);

    if (leaseCreatedAt && leasesWithoutBid) {
      throw new Error(`${leasesWithoutBid} live lease(s) of deployment ${dseq} have no leased bid visible on chain yet`);
    }

    if (offers.length && !(await this.deploymentSettingRepository.mergeGpuOffers({ wallet, dseq, offers }))) {
      throw new Error(`Deployment ${dseq} has no settings row to hold its gpu offers yet`);
    }

    if (offers.length && leaseCreatedAt) await this.#fulfilWaitlistEntries({ wallet, offers, leaseCreatedAt: new Date(leaseCreatedAt), context });

    this.logger.info({ event: "LEASE_GPU_OFFERS_RECORDED", ...context, liveLeases, offers: offers.length });
  }

  /** The lease is already recorded, so a waitlist failure is logged and never retried into a second read of the chain. */
  async #fulfilWaitlistEntries({
    wallet,
    offers,
    leaseCreatedAt,
    context
  }: {
    wallet: DeploymentWallet;
    offers: LeaseGpuOffer[];
    leaseCreatedAt: Date;
    context: object;
  }): Promise<void> {
    try {
      await this.gpuWaitlistFulfilmentService.fulfilForOffers({
        userId: wallet.userId,
        organizationId: wallet.organizationId,
        leaseCreatedAt,
        offers: offers.flatMap(totalGpusOfLease)
      });
    } catch (error) {
      this.logger.error({ event: "GPU_WAITLIST_FULFILMENT_FAILED", ...context, error });
    }
  }
}

function totalGpusOfLease(offer: LeaseGpuOffer): { vendor: string; model: string; count: number }[] {
  const totals = new Map<string, { vendor: string; model: string; count: number }>();

  for (const { vendor, model, count } of readOfferedGpus(offer)) {
    const key = `${vendor}/${model}`;
    totals.set(key, { vendor, model, count: (totals.get(key)?.count ?? 0) + count });
  }

  return [...totals.values()];
}
