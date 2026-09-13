import { inject, singleton } from "tsyringe";

import { isWalletInitialized, UserWalletRepository } from "@src/billing/repositories";
import { type CreateLogger, type Job, JOB_NAME, type JobHandler, type JobPayload, type JobPermissions, LOGGER_FACTORY } from "@src/core";
import { EmailDomainBlockService } from "@src/workload-abuse/services/email-domain-block/email-domain-block.service";
import { WorkloadAbuseInstrumentationService } from "@src/workload-abuse/services/workload-abuse-instrumentation/workload-abuse-instrumentation.service";

export class BlockEmailDomainOfWallet implements Job {
  static readonly [JOB_NAME] = "BlockEmailDomainOfWallet";
  readonly name = BlockEmailDomainOfWallet[JOB_NAME];
  readonly version = 1;

  constructor(
    public readonly data: {
      walletId: number;
    }
  ) {}
}

/** Keyed by wallet: the domain is re-read on every run, so one pending evaluation per wiped wallet is all the queue needs to hold. */
export function blockEmailDomainOfWalletKeyFor(walletId: number): string {
  return `blockEmailDomainOfWallet.${walletId}`;
}

/**
 * Blocks the domain of a wallet the wipe has already locked. On the queue rather than inline, so a database
 * blip while the guardrails are being read costs a retry instead of the block for the whole incident.
 */
@singleton()
export class BlockEmailDomainOfWalletHandler implements JobHandler<BlockEmailDomainOfWallet> {
  public readonly accepts = BlockEmailDomainOfWallet;

  public readonly concurrency = 1;

  public readonly policy = "stately";

  private readonly logger: ReturnType<CreateLogger>;

  constructor(
    private readonly userWalletRepository: UserWalletRepository,
    private readonly emailDomainBlockService: EmailDomainBlockService,
    private readonly instrumentation: WorkloadAbuseInstrumentationService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.logger = createLogger({ context: BlockEmailDomainOfWalletHandler.name });
  }

  requiresPermission(): JobPermissions {
    return [];
  }

  async handle(payload: JobPayload<BlockEmailDomainOfWallet>): Promise<void> {
    const { walletId } = payload;
    const wallet = await this.userWalletRepository.findById(walletId);

    if (!wallet || !isWalletInitialized(wallet)) {
      this.instrumentation.recordDomainBlock("skipped", "wallet_not_found");
      this.logger.warn({ event: "EMAIL_DOMAIN_AUTO_BLOCK_SKIPPED", reason: "wallet_not_found", walletId });
      return;
    }

    try {
      await this.emailDomainBlockService.blockDomainOf(wallet);
    } catch (error) {
      this.instrumentation.recordDomainBlock("failed");
      this.logger.error({ event: "EMAIL_DOMAIN_AUTO_BLOCK_FAILED", walletId, userId: wallet.userId, error });
      throw error;
    }
  }
}
