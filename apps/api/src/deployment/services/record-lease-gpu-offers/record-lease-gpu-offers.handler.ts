import { inject, singleton } from "tsyringe";

import { isWalletInitialized, UserWalletRepository } from "@src/billing/repositories";
import { type CreateLogger, JOB_NAME, type JobHandler, type JobPayload, type JobPermissions, LOGGER_FACTORY } from "@src/core";
import { DeploymentSettingRepository } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import { LeaseGpuOfferService } from "@src/deployment/services/lease-gpu-offer/lease-gpu-offer.service";
import { RecordLeaseGpuOffers } from "@src/deployment/services/lease-gpu-offer-job/lease-gpu-offer-job.service";

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
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.logger = createLogger({ context: RecordLeaseGpuOffersHandler.name });
  }

  requiresPermission(): JobPermissions {
    return [];
  }

  async handle(payload: JobPayload<RecordLeaseGpuOffers>): Promise<void> {
    const { walletId, dseq } = payload;
    const context = { job: RecordLeaseGpuOffers[JOB_NAME], walletId, dseq };
    const wallet = await this.userWalletRepository.findOneBy({ id: walletId });

    if (!wallet || !isWalletInitialized(wallet)) {
      this.logger.warn({ event: "LEASE_GPU_OFFERS_SKIPPED", reason: "wallet_uninitialized", ...context });
      return;
    }

    const { liveLeases, offers } = await this.offerService.findOffers({ owner: wallet.address, dseq });

    if (!liveLeases) throw new Error(`No live lease of deployment ${dseq} is visible on chain yet`);

    if (offers.length && !(await this.deploymentSettingRepository.mergeGpuOffers({ userId: wallet.userId, dseq, offers }))) {
      throw new Error(`Deployment ${dseq} has no settings row to hold its gpu offers yet`);
    }

    this.logger.info({ event: "LEASE_GPU_OFFERS_RECORDED", ...context, liveLeases, offers: offers.length });
  }
}
