import { inject, singleton } from "tsyringe";

import { type CreateLogger, JobQueueService, LOGGER_FACTORY } from "@src/core";
import { TxService } from "@src/core/services/tx/tx.service";
import { type UserOutput, UserRepository } from "@src/user/repositories";
import { hasGeneratedPlusTag } from "@src/workload-abuse/lib/generated-email-tag/generated-email-tag";
import { reviewHeldTrialSignupKeyFor, ReviewTrialSignup } from "@src/workload-abuse/services/review-trial-signup/review-trial-signup.handler";
import { WorkloadAbuseConfigService } from "@src/workload-abuse/services/workload-abuse-config/workload-abuse-config.service";

type HeldUser = Pick<UserOutput, "id" | "email" | "lastFingerprint">;

/** Counts only accounts active within the review window, so a hold lifts by itself once they leave it. */
@singleton()
export class TrialSignupHoldService {
  private readonly logger: ReturnType<CreateLogger>;

  constructor(
    private readonly userRepository: UserRepository,
    private readonly jobQueueService: JobQueueService,
    private readonly txService: TxService,
    private readonly config: WorkloadAbuseConfigService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.logger = createLogger({ context: TrialSignupHoldService.name });
  }

  async isHeld(user: HeldUser): Promise<boolean> {
    if (await this.#isHeldForLinkedAccounts(user)) return true;

    return await this.#isHeldForGeneratedEmailTag(user);
  }

  async #isHeldForLinkedAccounts(user: HeldUser): Promise<boolean> {
    const mode = this.config.get("WORKLOAD_ABUSE_SIGNUP_HOLD_MODE");
    const windowMinutes = this.config.get("WORKLOAD_ABUSE_SIGNUP_REVIEW_WINDOW_MINUTES");
    if (mode === "off" || !windowMinutes || !user.lastFingerprint) return false;

    const linkedAccounts = await this.userRepository.findRecentlyActiveByFingerprint(user.lastFingerprint, user.id, windowMinutes);
    if (linkedAccounts.length < this.config.get("WORKLOAD_ABUSE_SIGNUP_HOLD_MIN_LINKED_ACCOUNTS")) return false;

    const context = { userId: user.id, linkedUserIds: linkedAccounts.map(account => account.id) };

    if (mode === "report") {
      this.logger.info({ event: "TRIAL_SIGNUP_HOLD_DRY_RUN", ...context });
      return false;
    }

    this.logger.warn({ event: "TRIAL_SIGNUP_HELD", ...context });
    await this.#reportHeld(user);

    return true;
  }

  async #isHeldForGeneratedEmailTag(user: HeldUser): Promise<boolean> {
    const mode = this.config.get("WORKLOAD_ABUSE_GENERATED_EMAIL_TAG_HOLD_MODE");
    if (mode === "off" || !hasGeneratedPlusTag(user.email)) return false;

    if (mode === "report") {
      this.logger.info({ event: "TRIAL_SIGNUP_GENERATED_EMAIL_TAG_HOLD_DRY_RUN", userId: user.id });
      return false;
    }

    this.logger.warn({ event: "TRIAL_SIGNUP_HELD_FOR_GENERATED_EMAIL_TAG", userId: user.id });
    await this.#reportHeld(user);

    return true;
  }

  /** Enqueued outside any surrounding transaction because the hold refuses by throwing; pg-boss throttles on fixed slots counted from the epoch, so attempts on either side of a slot boundary each report. */
  async #reportHeld(user: HeldUser): Promise<void> {
    const windowMinutes = this.config.get("WORKLOAD_ABUSE_SIGNUP_REVIEW_WINDOW_MINUTES");
    if (!windowMinutes || !user.lastFingerprint) return;

    const fingerprint = user.lastFingerprint;

    try {
      await this.txService.outsideTransaction(
        async () =>
          await this.jobQueueService.enqueue(new ReviewTrialSignup({ userId: user.id, held: true }), {
            singletonKey: reviewHeldTrialSignupKeyFor(fingerprint),
            singletonSeconds: windowMinutes * 60
          })
      );
    } catch (error) {
      this.logger.error({ event: "TRIAL_SIGNUP_HOLD_REPORT_FAILED", userId: user.id, error });
    }
  }
}
