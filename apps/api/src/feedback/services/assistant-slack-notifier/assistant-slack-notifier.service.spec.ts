import type { HttpClient } from "@akashnetwork/http-sdk";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import type { CreateLogger } from "@src/core";
import { envSchema } from "@src/feedback/config/env.config";
import { AssistantSlackNotifier } from "./assistant-slack-notifier.service";

import { mockConfigService } from "@test/mocks/config-service.mock";

const WEBHOOK_URL = "https://hooks.slack.example.com/services/assistant";

describe(AssistantSlackNotifier.name, () => {
  describe("post", () => {
    it("posts the message to the assistant webhook", async () => {
      const { notifier, slackWebhookClient } = setup({ webhookUrl: WEBHOOK_URL });

      await notifier.post({ text: "Report" }, { problemReportId: "report-1" });

      expect(slackWebhookClient.post).toHaveBeenCalledWith(WEBHOOK_URL, { text: "Report" });
    });

    it("posts nothing and says why while the webhook is unset", async () => {
      const { notifier, slackWebhookClient, logger } = setup({});

      await notifier.post({ text: "Report" }, { problemReportId: "report-1" });

      expect(slackWebhookClient.post).not.toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalledWith({
        event: "ASSISTANT_SLACK_NOTICE_SKIPPED",
        reason: "Slack webhook URL not configured",
        problemReportId: "report-1"
      });
    });
  });

  describe("adminUrlOf", () => {
    it("builds a link under the admin app", () => {
      const { notifier } = setup({ adminUrl: "https://console-admin.example.com" });

      expect(notifier.adminUrlOf("/assistant/conversations/c-1")).toBe("https://console-admin.example.com/assistant/conversations/c-1");
    });

    it("answers no link while the admin URL is unset", () => {
      const { notifier } = setup({});

      expect(notifier.adminUrlOf("/assistant/conversations/c-1")).toBeUndefined();
    });
  });

  function setup(input: { webhookUrl?: string; adminUrl?: string }) {
    const config = envSchema.parse({ ASSISTANT_SLACK_WEBHOOK_URL: input.webhookUrl });
    const billingConfig = mockConfigService<BillingConfigService>({ CONSOLE_ADMIN_URL: input.adminUrl });
    const slackWebhookClient = mock<HttpClient>();
    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger = vi.fn<CreateLogger>(() => logger);
    const notifier = new AssistantSlackNotifier(config, billingConfig, slackWebhookClient, createLogger);

    return { notifier, slackWebhookClient, logger };
  }
});
