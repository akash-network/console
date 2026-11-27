import type { HttpClient } from "@akashnetwork/http-sdk";
import { inject, singleton } from "tsyringe";

import { SLACK_WEBHOOK_HTTP_CLIENT } from "@src/billing/providers/slack-webhook-client.provider";
import { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import { type Job, JOB_NAME, type JobHandler, type JobPayload, type JobPermissions } from "@src/core";
import { type UserOutput, UserRepository } from "@src/user/repositories";
import { buildNewEmailDomainReviewMessage } from "@src/workload-abuse/services/review-trial-signup/trial-signup-review-message";
import { WorkloadAbuseConfigService } from "@src/workload-abuse/services/workload-abuse-config/workload-abuse-config.service";

export class ReviewNewEmailDomainSignups implements Job {
  static readonly [JOB_NAME] = "ReviewNewEmailDomainSignups";
  readonly name = ReviewNewEmailDomainSignups[JOB_NAME];
  readonly version = 1;

  constructor(
    public readonly data: {
      userId: UserOutput["id"];
      domain: string;
      windowHours: number;
    }
  ) {}
}

export function reviewNewEmailDomainSignupsKeyFor(domain: string): string {
  return `reviewNewEmailDomainSignups.${domain}`;
}

@singleton()
export class ReviewNewEmailDomainSignupsHandler implements JobHandler<ReviewNewEmailDomainSignups> {
  public readonly accepts = ReviewNewEmailDomainSignups;

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

  async handle({ userId, domain, windowHours }: JobPayload<ReviewNewEmailDomainSignups>): Promise<void> {
    const webhookUrl = this.workloadAbuseConfig.get("WORKLOAD_ABUSE_SIGNUP_REVIEW_SLACK_WEBHOOK_URL");
    if (!webhookUrl) return;

    const user = await this.userRepository.findById(userId);
    if (!user) return;

    const message = buildNewEmailDomainReviewMessage({
      account: user,
      domain,
      windowHours,
      domainAccounts: await this.userRepository.findVerifiedCreatedWithEmailDomainSince(domain, windowHours),
      adminUrl: this.billingConfig.get("CONSOLE_ADMIN_URL")
    });
    await this.slackWebhookClient.post(webhookUrl, message);
  }
}
