import type { HttpClient } from "@akashnetwork/http-sdk";
import { inject, singleton } from "tsyringe";

import { SLACK_WEBHOOK_HTTP_CLIENT } from "@src/billing/providers/slack-webhook-client.provider";
import { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import { type Job, JOB_NAME, type JobHandler, type JobPayload, type JobPermissions } from "@src/core";
import { type UserOutput, UserRepository } from "@src/user/repositories";
import { buildTrialAfterRefusedSignupReviewMessage } from "@src/workload-abuse/services/review-trial-signup/trial-signup-review-message";
import { WorkloadAbuseConfigService } from "@src/workload-abuse/services/workload-abuse-config/workload-abuse-config.service";

export class ReviewTrialAfterRefusedSignup implements Job {
  static readonly [JOB_NAME] = "ReviewTrialAfterRefusedSignup";
  readonly name = ReviewTrialAfterRefusedSignup[JOB_NAME];
  readonly version = 1;

  constructor(
    public readonly data: {
      userId: UserOutput["id"];
      windowMinutes: number;
    }
  ) {}
}

export function reviewTrialAfterRefusedSignupKeyFor(userId: UserOutput["id"]): string {
  return `reviewTrialAfterRefusedSignup.${userId}`;
}

@singleton()
export class ReviewTrialAfterRefusedSignupHandler implements JobHandler<ReviewTrialAfterRefusedSignup> {
  public readonly accepts = ReviewTrialAfterRefusedSignup;

  public readonly concurrency = 2;

  public readonly policy = "stately";

  constructor(
    private readonly userRepository: UserRepository,
    private readonly workloadAbuseConfig: WorkloadAbuseConfigService,
    private readonly billingConfig: BillingConfigService,
    @inject(SLACK_WEBHOOK_HTTP_CLIENT) private readonly slackWebhookClient: HttpClient
  ) {}

  requiresPermission(): JobPermissions {
    return [];
  }

  async handle({ userId, windowMinutes }: JobPayload<ReviewTrialAfterRefusedSignup>): Promise<void> {
    const webhookUrl = this.workloadAbuseConfig.get("WORKLOAD_ABUSE_SIGNUP_REVIEW_SLACK_WEBHOOK_URL");
    if (!webhookUrl) return;

    const user = await this.userRepository.findById(userId);
    if (!user) return;

    const message = buildTrialAfterRefusedSignupReviewMessage({ account: user, windowMinutes, adminUrl: this.billingConfig.get("CONSOLE_ADMIN_URL") });
    await this.slackWebhookClient.post(webhookUrl, message);
  }
}
