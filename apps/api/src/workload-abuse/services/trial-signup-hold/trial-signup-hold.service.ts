import { inject, singleton } from "tsyringe";

import { type CreateLogger, JobQueueService, LOGGER_FACTORY } from "@src/core";
import { TxService } from "@src/core/services/tx/tx.service";
import { type UserOutput, UserRepository } from "@src/user/repositories";
import { BlockEmailDomainOfHeldSignup, blockEmailDomainOfHeldSignupKeyFor } from "@src/workload-abuse/events/block-email-domain-of-held-signup";
import { hasGeneratedPlusTag } from "@src/workload-abuse/lib/generated-email-tag/generated-email-tag";
import type { HeldSignupBlockEvidence } from "@src/workload-abuse/services/email-domain-block/email-domain-block.service";
import {
  type EmailDomainAssessment,
  EmailDomainReputationService,
  type EmailDomainSignal,
  type SignupBurst
} from "@src/workload-abuse/services/email-domain-reputation/email-domain-reputation.service";
import { RefusedSignupService } from "@src/workload-abuse/services/refused-signup/refused-signup.service";
import {
  ReviewNewEmailDomainSignups,
  reviewNewEmailDomainSignupsKeyFor
} from "@src/workload-abuse/services/review-new-email-domain-signups/review-new-email-domain-signups.handler";
import {
  ReviewTrialAfterRefusedSignup,
  reviewTrialAfterRefusedSignupKeyFor
} from "@src/workload-abuse/services/review-trial-after-refused-signup/review-trial-after-refused-signup.handler";
import { reviewHeldTrialSignupKeyFor, ReviewTrialSignup } from "@src/workload-abuse/services/review-trial-signup/review-trial-signup.handler";
import { WorkloadAbuseConfigService } from "@src/workload-abuse/services/workload-abuse-config/workload-abuse-config.service";

type HeldUser = Pick<UserOutput, "id" | "email" | "lastFingerprint" | "lastIp" | "lastUserAgent">;

function isTiedToBlockedDomain(signal: EmailDomainSignal): signal is HeldSignupBlockEvidence {
  return "blockedDomain" in signal;
}

/** Counts only accounts active within the review window, so a hold lifts by itself once they leave it. */
@singleton()
export class TrialSignupHoldService {
  private readonly logger: ReturnType<CreateLogger>;

  constructor(
    private readonly userRepository: UserRepository,
    private readonly jobQueueService: JobQueueService,
    private readonly txService: TxService,
    private readonly config: WorkloadAbuseConfigService,
    private readonly emailDomainReputationService: EmailDomainReputationService,
    private readonly refusedSignupService: RefusedSignupService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.logger = createLogger({ context: TrialSignupHoldService.name });
  }

  async isHeld(user: HeldUser): Promise<boolean> {
    if (await this.#isHeldForLinkedAccounts(user)) return true;
    if (await this.#isHeldForGeneratedEmailTag(user)) return true;
    if (await this.#isHeldForRefusedSignup(user)) return true;
    if (await this.#isHeldForEmailDomainReputation(user)) return true;

    return await this.#isHeldForNewEmailDomain(user);
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
    await this.#reportHeld(user.id, user.lastFingerprint, windowMinutes);

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
    await this.#reportHeldIfLinked(user);

    return true;
  }

  /** Matches on the address and user agent an account last signed in from, since a refused sign-up never becomes an account the device hold could count. */
  async #isHeldForRefusedSignup(user: HeldUser): Promise<boolean> {
    const mode = this.config.get("WORKLOAD_ABUSE_REFUSED_SIGNUP_HOLD_MODE");
    if (mode === "off" || !(await this.#wasRecentlyRefused(user))) return false;

    if (mode === "report") {
      this.logger.info({ event: "TRIAL_SIGNUP_REFUSED_SIGNUP_HOLD_DRY_RUN", userId: user.id });
      return false;
    }

    this.logger.warn({ event: "TRIAL_SIGNUP_HELD_FOR_REFUSED_SIGNUP", userId: user.id });
    await this.#reportRefusedSignup(user.id);

    return true;
  }

  /** Fails open, for the same reason as the email domain signals. */
  async #wasRecentlyRefused(user: HeldUser): Promise<boolean> {
    try {
      return await this.refusedSignupService.wasRecentlyRefused({ ip: user.lastIp, userAgent: user.lastUserAgent });
    } catch (error) {
      this.logger.error({ event: "TRIAL_SIGNUP_REFUSED_SIGNUP_CHECK_FAILED", userId: user.id, error });
      return false;
    }
  }

  /** Throttled per account on pg-boss's fixed slots, so an account held on every attempt is posted once per slot, and twice when its attempts straddle a slot boundary. */
  async #reportRefusedSignup(userId: UserOutput["id"]): Promise<void> {
    const windowMinutes = this.config.get("WORKLOAD_ABUSE_REFUSED_SIGNUP_HOLD_WINDOW_MINUTES");

    try {
      await this.txService.outsideTransaction(
        async () =>
          await this.jobQueueService.enqueue(new ReviewTrialAfterRefusedSignup({ userId, windowMinutes }), {
            singletonKey: reviewTrialAfterRefusedSignupKeyFor(userId),
            singletonSeconds: windowMinutes * 60
          })
      );
    } catch (error) {
      this.logger.error({ event: "TRIAL_SIGNUP_HOLD_REPORT_FAILED", userId, error });
    }
  }

  async #isHeldForEmailDomainReputation(user: HeldUser): Promise<boolean> {
    const mode = this.config.get("WORKLOAD_ABUSE_EMAIL_DOMAIN_HOLD_MODE");
    if (mode === "off") return false;

    const assessment = await this.#findEmailDomainSignals(user);
    if (!assessment?.signals.length) return false;

    const context = { userId: user.id, domain: assessment.domain, signals: assessment.signals };

    if (mode === "report") {
      this.logger.info({ event: "TRIAL_SIGNUP_EMAIL_DOMAIN_HOLD_DRY_RUN", ...context });
      return false;
    }

    this.logger.warn({ event: "TRIAL_SIGNUP_HELD_FOR_EMAIL_DOMAIN", ...context });
    await this.#reportHeldIfLinked(user);
    await this.#requestDomainBlock(user.id, assessment);

    return true;
  }

  /** Holds every sign-up after a domain's first inside the window, which the larger burst of the reputation rule lets through on domains rotated a few accounts at a time. */
  async #isHeldForNewEmailDomain(user: HeldUser): Promise<boolean> {
    const mode = this.config.get("WORKLOAD_ABUSE_NEW_EMAIL_DOMAIN_HOLD_MODE");
    if (mode === "off") return false;

    const windowHours = this.config.get("WORKLOAD_ABUSE_NEW_EMAIL_DOMAIN_WINDOW_HOURS");
    const burst = await this.#findNewEmailDomainBurst(user, windowHours);
    if (!burst) return false;

    const context = { userId: user.id, domain: burst.burstDomain, signups: burst.signups };

    if (mode === "report") {
      this.logger.info({ event: "TRIAL_SIGNUP_NEW_EMAIL_DOMAIN_HOLD_DRY_RUN", ...context });
      return false;
    }

    this.logger.warn({ event: "TRIAL_SIGNUP_HELD_FOR_NEW_EMAIL_DOMAIN", ...context });
    await this.#reportNewEmailDomain(user.id, burst.burstDomain, windowHours);

    return true;
  }

  /** Fails open, for the same reason as the email domain signals. */
  async #findNewEmailDomainBurst(user: HeldUser, windowHours: number): Promise<SignupBurst | null> {
    try {
      return await this.emailDomainReputationService.findSignupBurst(user, {
        minSignups: this.config.get("WORKLOAD_ABUSE_NEW_EMAIL_DOMAIN_MIN_SIGNUPS"),
        windowHours
      });
    } catch (error) {
      this.logger.error({ event: "TRIAL_SIGNUP_NEW_EMAIL_DOMAIN_CHECK_FAILED", userId: user.id, error });
      return null;
    }
  }

  /** Throttled per domain, so the review channel gets one post for a domain however many of its sign-ups are held inside the window. */
  async #reportNewEmailDomain(userId: UserOutput["id"], domain: string, windowHours: number): Promise<void> {
    try {
      await this.txService.outsideTransaction(
        async () =>
          await this.jobQueueService.enqueue(new ReviewNewEmailDomainSignups({ userId, domain, windowHours }), {
            singletonKey: reviewNewEmailDomainSignupsKeyFor(domain),
            singletonSeconds: windowHours * 60 * 60
          })
      );
    } catch (error) {
      this.logger.error({ event: "TRIAL_SIGNUP_HOLD_REPORT_FAILED", userId, error });
    }
  }

  /** Only a signal naming an already blocked domain blocks, since a burst or a forwarding-only domain can be a real company onboarding its staff. */
  async #requestDomainBlock(userId: UserOutput["id"], { domain: emailDomain, signals }: EmailDomainAssessment): Promise<void> {
    if (this.config.get("WORKLOAD_ABUSE_HELD_SIGNUP_DOMAIN_BLOCK_MODE") === "off") return;

    const evidence = signals.find(isTiedToBlockedDomain);
    if (!evidence || !emailDomain) return;

    try {
      await this.txService.outsideTransaction(
        async () =>
          await this.jobQueueService.enqueue(new BlockEmailDomainOfHeldSignup({ userId, emailDomain, evidence }), {
            singletonKey: blockEmailDomainOfHeldSignupKeyFor(userId)
          })
      );
    } catch (error) {
      this.logger.error({ event: "TRIAL_SIGNUP_DOMAIN_BLOCK_REQUEST_FAILED", userId, error });
    }
  }

  /** Fails open, since every signal is a heuristic and a database or DNS fault must not cost a real user their trial. */
  async #findEmailDomainSignals(user: HeldUser): Promise<EmailDomainAssessment | null> {
    try {
      return await this.emailDomainReputationService.findSignals(user);
    } catch (error) {
      this.logger.error({ event: "TRIAL_SIGNUP_EMAIL_DOMAIN_CHECK_FAILED", userId: user.id, error });
      return null;
    }
  }

  /** The review post lists linked accounts, so an unlinked hold stays unreported and leaves the device's report slot to a later hold. */
  async #reportHeldIfLinked(user: HeldUser): Promise<void> {
    const windowMinutes = this.config.get("WORKLOAD_ABUSE_SIGNUP_REVIEW_WINDOW_MINUTES");
    if (!windowMinutes || !user.lastFingerprint) return;

    try {
      const linkedAccounts = await this.userRepository.findRecentlyActiveByFingerprint(user.lastFingerprint, user.id, windowMinutes);
      if (linkedAccounts.length) await this.#reportHeld(user.id, user.lastFingerprint, windowMinutes);
    } catch (error) {
      this.logger.error({ event: "TRIAL_SIGNUP_HOLD_REPORT_FAILED", userId: user.id, error });
    }
  }

  /** Enqueued outside any surrounding transaction because the hold refuses by throwing; pg-boss throttles on fixed slots counted from the epoch, so attempts on either side of a slot boundary each report. */
  async #reportHeld(userId: UserOutput["id"], fingerprint: string, windowMinutes: number): Promise<void> {
    try {
      await this.txService.outsideTransaction(
        async () =>
          await this.jobQueueService.enqueue(new ReviewTrialSignup({ userId, held: true }), {
            singletonKey: reviewHeldTrialSignupKeyFor(fingerprint),
            singletonSeconds: windowMinutes * 60
          })
      );
    } catch (error) {
      this.logger.error({ event: "TRIAL_SIGNUP_HOLD_REPORT_FAILED", userId, error });
    }
  }
}
