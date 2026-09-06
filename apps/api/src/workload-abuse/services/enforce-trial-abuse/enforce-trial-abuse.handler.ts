import { inject, singleton } from "tsyringe";

import { isWalletInitialized, UserWalletRepository } from "@src/billing/repositories";
import { type CreateLogger, type Job, JOB_NAME, type JobHandler, type JobPayload, type JobPermissions, LOGGER_FACTORY } from "@src/core";
import { WorkloadAbuseDetectionRepository } from "@src/workload-abuse/repositories/workload-abuse-detection/workload-abuse-detection.repository";
import { TrialAbuseEnforcementService } from "@src/workload-abuse/services/trial-abuse-enforcement/trial-abuse-enforcement.service";
import { WorkloadAbuseInstrumentationService } from "@src/workload-abuse/services/workload-abuse-instrumentation/workload-abuse-instrumentation.service";

export class EnforceTrialAbuse implements Job {
  static readonly [JOB_NAME] = "EnforceTrialAbuse";
  readonly name = EnforceTrialAbuse[JOB_NAME];
  readonly version = 1;

  constructor(
    public readonly data: {
      walletId: number;
      detectionId: string;
    }
  ) {}
}

/** Keyed by wallet, because the wipe covers every deployment the wallet owns whichever detection triggered it. */
export function enforceTrialAbuseKeyFor(walletId: number): string {
  return `enforceTrialAbuse.${walletId}`;
}

/** Re-reads the wallet so a wipe that already landed, or a user who paid in the meantime, is not wiped twice or at all. */
@singleton()
export class EnforceTrialAbuseHandler implements JobHandler<EnforceTrialAbuse> {
  public readonly accepts = EnforceTrialAbuse;

  public readonly concurrency = 1;

  public readonly policy = "stately";

  private readonly logger: ReturnType<CreateLogger>;

  constructor(
    private readonly userWalletRepository: UserWalletRepository,
    private readonly detectionRepository: WorkloadAbuseDetectionRepository,
    private readonly enforcementService: TrialAbuseEnforcementService,
    private readonly instrumentation: WorkloadAbuseInstrumentationService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.logger = createLogger({ context: EnforceTrialAbuseHandler.name });
  }

  requiresPermission(): JobPermissions {
    return [];
  }

  async handle(payload: JobPayload<EnforceTrialAbuse>): Promise<void> {
    const { walletId, detectionId } = payload;
    const context = { job: EnforceTrialAbuse[JOB_NAME], walletId, detectionId };
    const wallet = await this.userWalletRepository.findById(walletId);

    if (!wallet || !isWalletInitialized(wallet)) {
      this.logger.warn({ event: "TRIAL_WORKLOAD_ABUSE_ENFORCEMENT_SKIPPED", reason: "WALLET_NOT_FOUND", ...context });
      this.instrumentation.recordEnforcement("skipped");
      return;
    }

    if (wallet.abuseLockedAt) {
      this.logger.info({ event: "TRIAL_WORKLOAD_ABUSE_ENFORCEMENT_SKIPPED", reason: "ALREADY_LOCKED", ...context, userId: wallet.userId });
      await this.detectionRepository.updateById(detectionId, { action: "enforced", updatedAt: new Date() });
      this.instrumentation.recordEnforcement("skipped");
      return;
    }

    if (!wallet.isTrialing) {
      this.logger.info({ event: "TRIAL_WORKLOAD_ABUSE_ENFORCEMENT_SKIPPED", reason: "NOT_TRIALING", ...context, userId: wallet.userId });
      this.instrumentation.recordEnforcement("skipped");
      return;
    }

    await this.enforcementService.enforce({ wallet, detectionId });
  }
}
