import type { HttpClient } from "@akashnetwork/http-sdk";
import { inject, singleton } from "tsyringe";

import { CreditsAdded } from "@src/billing/events/credits-added";
import { SLACK_WEBHOOK_HTTP_CLIENT } from "@src/billing/providers/slack-webhook-client.provider";
import { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import { type CreateLogger, EventPayload, JobHandler, type JobPermissions, LOGGER_FACTORY } from "@src/core";
import { UserRepository } from "@src/user/repositories";
import { buildCreditsAddedSlackMessage } from "./credits-added-slack-message";

@singleton()
export class CreditsAddedSlackAlertHandler implements JobHandler<CreditsAdded> {
  public readonly accepts = CreditsAdded;

  public readonly concurrency = 2;

  private readonly logger: ReturnType<CreateLogger>;

  constructor(
    private readonly userRepository: UserRepository,
    private readonly billingConfig: BillingConfigService,
    @inject(SLACK_WEBHOOK_HTTP_CLIENT) private readonly slackWebhookClient: HttpClient,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.logger = createLogger({ context: CreditsAddedSlackAlertHandler.name });
  }

  requiresPermission(): JobPermissions {
    return [];
  }

  async handle(payload: EventPayload<CreditsAdded>): Promise<void> {
    const webhookUrl = this.billingConfig.get("CREDITS_ADDED_SLACK_WEBHOOK_URL");
    if (!webhookUrl) {
      this.logger.debug({
        event: "CREDITS_ADDED_SLACK_ALERT_SKIPPED",
        transactionId: payload.transactionId,
        reason: "Slack webhook URL not configured"
      });
      return;
    }

    const user = await this.userRepository.findById(payload.userId);
    const message = buildCreditsAddedSlackMessage({
      event: payload,
      email: user?.email,
      amplitudeProjectUrl: this.billingConfig.get("AMPLITUDE_PROJECT_URL"),
      adminUrl: this.billingConfig.get("CONSOLE_ADMIN_URL")
    });

    await this.slackWebhookClient.post(webhookUrl, message);
  }
}
