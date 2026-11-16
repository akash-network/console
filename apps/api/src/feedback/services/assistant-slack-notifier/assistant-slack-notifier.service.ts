import type { HttpClient } from "@akashnetwork/http-sdk";
import { inject, singleton } from "tsyringe";

import { SLACK_WEBHOOK_HTTP_CLIENT } from "@src/billing/providers/slack-webhook-client.provider";
import { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import { type CreateLogger, LOGGER_FACTORY } from "@src/core";
import { FEEDBACK_CONFIG, type FeedbackConfig } from "@src/feedback/providers/config.provider";

export interface AssistantSlackMessage {
  text: string;
}

/** Posts nothing while ASSISTANT_SLACK_WEBHOOK_URL is unset, and callers must keep user text out of every message. */
@singleton()
export class AssistantSlackNotifier {
  readonly #logger: ReturnType<CreateLogger>;

  constructor(
    @inject(FEEDBACK_CONFIG) private readonly config: FeedbackConfig,
    private readonly billingConfig: BillingConfigService,
    @inject(SLACK_WEBHOOK_HTTP_CLIENT) private readonly slackWebhookClient: HttpClient,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.#logger = createLogger({ context: AssistantSlackNotifier.name });
  }

  adminUrlOf(path: string): string | undefined {
    const adminUrl = this.billingConfig.get("CONSOLE_ADMIN_URL");

    return adminUrl ? `${adminUrl}${path}` : undefined;
  }

  async post(message: AssistantSlackMessage, logContext: Record<string, string>): Promise<void> {
    const webhookUrl = this.config.ASSISTANT_SLACK_WEBHOOK_URL;
    if (!webhookUrl) {
      this.#logger.debug({ event: "ASSISTANT_SLACK_NOTICE_SKIPPED", reason: "Slack webhook URL not configured", ...logContext });
      return;
    }

    await this.slackWebhookClient.post(webhookUrl, message);
  }
}
