import { singleton } from "tsyringe";

import { JobQueueService } from "@src/core";
import { type UserOutput, UserRepository } from "@src/user/repositories";
import { ReviewTrialSignup, reviewTrialSignupKeyFor } from "@src/workload-abuse/services/review-trial-signup/review-trial-signup.handler";
import { WorkloadAbuseConfigService } from "@src/workload-abuse/services/workload-abuse-config/workload-abuse-config.service";

@singleton()
export class TrialSignupReviewService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly jobQueueService: JobQueueService,
    private readonly config: WorkloadAbuseConfigService
  ) {}

  /** Checks for linked accounts before queueing, since the review is throttled per device and a device's first, unlinked sign-up would otherwise take the window's only slot. */
  async flagIfLinked(user: Pick<UserOutput, "id" | "lastFingerprint">): Promise<void> {
    const windowMinutes = this.config.get("WORKLOAD_ABUSE_SIGNUP_REVIEW_WINDOW_MINUTES");
    if (!windowMinutes || !user.lastFingerprint) return;

    const linkedAccounts = await this.userRepository.findRecentlyActiveByFingerprint(user.lastFingerprint, user.id, windowMinutes);
    if (!linkedAccounts.length) return;

    await this.jobQueueService.enqueue(new ReviewTrialSignup({ userId: user.id }), {
      singletonKey: reviewTrialSignupKeyFor(user.lastFingerprint),
      singletonSeconds: windowMinutes * 60
    });
  }
}
