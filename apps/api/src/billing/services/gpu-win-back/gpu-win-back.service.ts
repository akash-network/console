import { addDays, addHours, addMinutes, subDays } from "date-fns";
import { secondsInMinute } from "date-fns/constants";
import { inject, singleton } from "tsyringe";

import { FirstPurchaseBonusWindowOpened } from "@src/billing/events/first-purchase-bonus-window-opened";
import { getTrialStartedAt } from "@src/billing/lib/trial-window/trial-window";
import { StripeTransactionRepository, UserWalletRepository } from "@src/billing/repositories";
import { FirstPurchaseBonusWinBackRepository } from "@src/billing/repositories/first-purchase-bonus-win-back/first-purchase-bonus-win-back.repository";
import { UsageRepository } from "@src/billing/repositories/usage/usage.repository";
import { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import { MIN_QUALIFYING_AMOUNT_CENTS } from "@src/billing/services/first-purchase-bonus/first-purchase-bonus.service";
import { BlockRepository } from "@src/chain/repositories/block.repository";
import { BlockHttpService } from "@src/chain/services/block-http/block-http.service";
import { type CreateLogger, JobQueueService, LOGGER_FACTORY } from "@src/core";
import { TxService } from "@src/core/services/tx/tx.service";
import { DeploymentRepository } from "@src/deployment/repositories/deployment/deployment.repository";
import { UserRepository } from "@src/user/repositories";
import { averageBlockTime } from "@src/utils/constants";
import { GpuWinBackCheck, gpuWinBackCheckKeyFor } from "./gpu-win-back-check.job";

export const WIN_BACK_WINDOW_DAYS = 7;
export const WIN_BACK_GPU_IDLE_DAYS = 7;
export const WIN_BACK_RECHECK_MAX_AGE_DAYS = 60;

/** The trial's last email, `afterTrialEnds`, goes out this long after the trial ends, and the win-back must come after it. */
const LAST_TRIAL_EMAIL_DAYS_AFTER_TRIAL_END = 7;
const LAST_TRIAL_EMAIL_MARGIN_HOURS = 1;
const OPEN_DEPLOYMENT_RECHECK_DAYS = 1;
const INDEXER_LAG_RECHECK_MINUTES = 30;

/** A lagging indexer reads a deployment it has not caught up with as missing, so "nothing open" is trusted only within this lag. */
const MAX_INDEXER_LAG_IN_BLOCKS = Math.floor((10 * secondsInMinute) / averageBlockTime);

export type GpuWinBackCheckResult = { outcome: "opened" | "ineligible" } | { outcome: "rescheduled"; startAfter: Date };

const INELIGIBLE: GpuWinBackCheckResult = { outcome: "ineligible" };

@singleton()
export class GpuWinBackService {
  readonly #logger: ReturnType<CreateLogger>;

  constructor(
    private readonly stripeTransactionRepository: StripeTransactionRepository,
    private readonly winBackRepository: FirstPurchaseBonusWinBackRepository,
    private readonly userRepository: UserRepository,
    private readonly userWalletRepository: UserWalletRepository,
    private readonly usageRepository: UsageRepository,
    private readonly deploymentRepository: DeploymentRepository,
    private readonly blockHttpService: BlockHttpService,
    private readonly blockRepository: BlockRepository,
    private readonly jobQueueService: JobQueueService,
    private readonly txService: TxService,
    private readonly billingConfig: BillingConfigService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.#logger = createLogger({ context: GpuWinBackService.name });
  }

  /** Answers false when a check of the person is already waiting, which then decides for itself when to look again. */
  async scheduleCheck(userId: string, startAfter: Date): Promise<boolean> {
    return !!(await this.jobQueueService.enqueue(new GpuWinBackCheck({ userId }), { singletonKey: gpuWinBackCheckKeyFor(userId), startAfter }));
  }

  /** Any lease schedules a check, because only the check can tell whether the person's latest deployment was a gpu one. */
  async scheduleCheckAfterLease({ walletId, leaseCreatedAt }: { walletId: number; leaseCreatedAt: Date }): Promise<void> {
    const wallet = await this.userWalletRepository.findById(walletId);
    if (!wallet?.userId) return;

    await this.scheduleCheck(wallet.userId, addDays(leaseCreatedAt, WIN_BACK_GPU_IDLE_DAYS));
  }

  async check(userId: string, now: Date): Promise<GpuWinBackCheckResult> {
    if (await this.#isExcluded(userId)) return INELIGIBLE;

    const [user, wallet, hasPaid] = await Promise.all([
      this.userRepository.findById(userId),
      this.userWalletRepository.findOneByUserId(userId),
      this.#hasPaid(userId)
    ]);
    if (!user || !wallet?.address) return INELIGIBLE;

    const lastTrialEmailAt = this.#lastTrialEmailAt(getTrialStartedAt(wallet));
    if (!hasPaid && wallet.isTrialing && lastTrialEmailAt > now) return await this.#recheckAt(userId, lastTrialEmailAt);

    const owners = await this.usageRepository.resolveAddresses(wallet.address);
    const { latestGpuDeploymentCreatedAt, hasOpenDeployment } = await this.deploymentRepository.findGpuDeploymentActivity(owners);
    if (!latestGpuDeploymentCreatedAt) return INELIGIBLE;

    const idleLongEnoughAt = addDays(latestGpuDeploymentCreatedAt, WIN_BACK_GPU_IDLE_DAYS);
    if (idleLongEnoughAt > now) return await this.#recheckAt(userId, idleLongEnoughAt);

    if (hasOpenDeployment) {
      if (latestGpuDeploymentCreatedAt < subDays(now, WIN_BACK_RECHECK_MAX_AGE_DAYS)) return INELIGIBLE;

      return await this.#recheckAt(userId, addDays(now, OPEN_DEPLOYMENT_RECHECK_DAYS));
    }

    if (!(await this.#isIndexerFresh(userId))) return await this.#recheckAt(userId, addMinutes(now, INDEXER_LAG_RECHECK_MINUTES));

    return await this.#open(userId, now);
  }

  async #isExcluded(userId: string): Promise<boolean> {
    if (await this.stripeTransactionRepository.hasReceivedFirstPurchaseBonus(userId)) return true;
    if (await this.winBackRepository.findByUserId(userId)) return true;

    return await this.stripeTransactionRepository.hasCompletedPaidTransactionOfAtLeast({ userId }, MIN_QUALIFYING_AMOUNT_CENTS);
  }

  #lastTrialEmailAt(trialStartedAt: Date): Date {
    const trialEndsAt = addDays(trialStartedAt, this.billingConfig.get("TRIAL_ALLOWANCE_EXPIRATION_DAYS"));

    return addHours(addDays(trialEndsAt, LAST_TRIAL_EMAIL_DAYS_AFTER_TRIAL_END), LAST_TRIAL_EMAIL_MARGIN_HOURS);
  }

  async #recheckAt(userId: string, startAfter: Date): Promise<GpuWinBackCheckResult> {
    await this.scheduleCheck(userId, startAfter);

    return { outcome: "rescheduled", startAfter };
  }

  async #isIndexerFresh(userId: string): Promise<boolean> {
    const [chainHeight, indexedHeight] = await Promise.all([this.blockHttpService.getCurrentHeight(), this.blockRepository.getLatestProcessedHeight()]);
    if (chainHeight - indexedHeight <= MAX_INDEXER_LAG_IN_BLOCKS) return true;

    this.#logger.warn({ event: "GPU_WIN_BACK_INDEXER_LAGGING", userId, chainHeight, indexedHeight });

    return false;
  }

  /** The announcement is enqueued rather than published, so a failed enqueue rolls the row back and the check retries instead of opening a window nobody hears about. */
  async #open(userId: string, now: Date): Promise<GpuWinBackCheckResult> {
    const opened = await this.txService.transaction(async () => {
      if (!(await this.#lockPerson(userId)) || (await this.#isExcluded(userId))) return undefined;

      const closesAt = (await this.#hasPaid(userId)) ? addDays(now, WIN_BACK_WINDOW_DAYS) : null;
      if (!(await this.winBackRepository.create({ userId, openedAt: now, closesAt }))) return undefined;

      await this.jobQueueService.enqueue(new FirstPurchaseBonusWindowOpened({ userId, reason: "gpu_win_back", closesAt: closesAt?.toISOString() ?? null }));

      return { closesAt };
    });
    if (!opened) return INELIGIBLE;

    this.#logger.info({ event: "GPU_WIN_BACK_WINDOW_OPENED", userId, closesAt: opened.closesAt });

    return { outcome: "opened" };
  }

  /** Takes the lock a settling purchase takes on the person, so the purchase either sees the win-back or settles before the rechecks that follow read it. */
  async #lockPerson(userId: string): Promise<boolean> {
    return !!(await this.userRepository.findOneByAndLock({ id: userId }, { strength: "no key update" }));
  }

  async #hasPaid(userId: string): Promise<boolean> {
    return !!(await this.stripeTransactionRepository.findEarliestCompletedPaidTransaction({ userId }));
  }
}
