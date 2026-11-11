import type { HttpClient } from "@akashnetwork/http-sdk";
import { inject, singleton } from "tsyringe";

import { SLACK_WEBHOOK_HTTP_CLIENT } from "@src/billing/providers/slack-webhook-client.provider";
import { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import { type Job, JOB_NAME, type JobHandler, type JobPayload, type JobPermissions } from "@src/core";
import { type UserOutput, UserRepository } from "@src/user/repositories";
import { buildRefusedTrialReviewMessage, type MatchedDeletedTrialAccount } from "@src/workload-abuse/services/review-trial-signup/trial-signup-review-message";
import { WorkloadAbuseConfigService } from "@src/workload-abuse/services/workload-abuse-config/workload-abuse-config.service";

export class ReviewRefusedTrial implements Job {
  static readonly [JOB_NAME] = "ReviewRefusedTrial";
  readonly name = ReviewRefusedTrial[JOB_NAME];
  readonly version = 1;

  constructor(
    public readonly data: {
      userId: UserOutput["id"];
      deletedAccount: MatchedDeletedTrialAccount;
    }
  ) {}
}

@singleton()
export class ReviewRefusedTrialHandler implements JobHandler<ReviewRefusedTrial> {
  public readonly accepts = ReviewRefusedTrial;

  public readonly concurrency = 2;

  constructor(
    private readonly userRepository: UserRepository,
    private readonly workloadAbuseConfig: WorkloadAbuseConfigService,
    private readonly billingConfig: BillingConfigService,
    @inject(SLACK_WEBHOOK_HTTP_CLIENT) private readonly slackWebhookClient: HttpClient
  ) {}

  requiresPermission(): JobPermissions {
    return [];
  }

  async handle(payload: JobPayload<ReviewRefusedTrial>): Promise<void> {
    const webhookUrl = this.workloadAbuseConfig.get("WORKLOAD_ABUSE_SIGNUP_REVIEW_SLACK_WEBHOOK_URL");
    if (!webhookUrl) return;

    const user = await this.userRepository.findById(payload.userId);
    if (!user) return;

    const message = buildRefusedTrialReviewMessage({
      account: user,
      deletedAccount: payload.deletedAccount,
      adminUrl: this.billingConfig.get("CONSOLE_ADMIN_URL")
    });
    await this.slackWebhookClient.post(webhookUrl, message);
  }
}
