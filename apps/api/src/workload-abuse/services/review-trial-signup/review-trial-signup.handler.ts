import type { HttpClient } from "@akashnetwork/http-sdk";
import { inject, singleton } from "tsyringe";

import { SLACK_WEBHOOK_HTTP_CLIENT } from "@src/billing/providers/slack-webhook-client.provider";
import { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import { type CreateLogger, type Job, JOB_NAME, type JobHandler, type JobPayload, type JobPermissions, LOGGER_FACTORY } from "@src/core";
import { type UserOutput, UserRepository } from "@src/user/repositories";
import { WorkloadAbuseConfigService } from "@src/workload-abuse/services/workload-abuse-config/workload-abuse-config.service";
import { buildTrialSignupReviewMessage } from "./trial-signup-review-message";

export class ReviewTrialSignup implements Job {
  static readonly [JOB_NAME] = "ReviewTrialSignup";
  readonly name = ReviewTrialSignup[JOB_NAME];
  readonly version = 1;

  constructor(
    public readonly data: {
      userId: UserOutput["id"];
    }
  ) {}
}

export function reviewTrialSignupKeyFor(userId: UserOutput["id"]): string {
  return `reviewTrialSignup.${userId}`;
}

@singleton()
export class ReviewTrialSignupHandler implements JobHandler<ReviewTrialSignup> {
  public readonly accepts = ReviewTrialSignup;

  public readonly concurrency = 2;

  private readonly logger: ReturnType<CreateLogger>;

  constructor(
    private readonly userRepository: UserRepository,
    private readonly workloadAbuseConfig: WorkloadAbuseConfigService,
    private readonly billingConfig: BillingConfigService,
    @inject(SLACK_WEBHOOK_HTTP_CLIENT) private readonly slackWebhookClient: HttpClient,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.logger = createLogger({ context: ReviewTrialSignupHandler.name });
  }

  requiresPermission(): JobPermissions {
    return [];
  }

  async handle(payload: JobPayload<ReviewTrialSignup>): Promise<void> {
    const windowMinutes = this.workloadAbuseConfig.get("WORKLOAD_ABUSE_SIGNUP_REVIEW_WINDOW_MINUTES");
    if (!windowMinutes) return;

    const user = await this.userRepository.findById(payload.userId);
    if (!user?.lastFingerprint) return;

    const linkedAccounts = await this.userRepository.findRecentlyActiveByFingerprint(user.lastFingerprint, user.id, windowMinutes);
    if (!linkedAccounts.length) return;

    this.logger.warn({ event: "TRIAL_SIGNUP_FLAGGED_FOR_REVIEW", userId: user.id, linkedUserIds: linkedAccounts.map(account => account.id) });
    await this.#postForReview(user, linkedAccounts);
  }

  async #postForReview(user: UserOutput, linkedAccounts: Pick<UserOutput, "id" | "email">[]): Promise<void> {
    const webhookUrl = this.workloadAbuseConfig.get("WORKLOAD_ABUSE_SIGNUP_REVIEW_SLACK_WEBHOOK_URL");
    if (!webhookUrl) return;

    const message = buildTrialSignupReviewMessage({ account: user, linkedAccounts, adminUrl: this.billingConfig.get("CONSOLE_ADMIN_URL") });
    await this.slackWebhookClient.post(webhookUrl, message);
  }
}
