import nock from "nock";
import { container } from "tsyringe";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import { JOB_NAME } from "@src/core";
import { FEEDBACK_CONFIG } from "@src/feedback/providers/config.provider";
import { NotifyProblemReport, NotifyProblemReportHandler } from "./notify-problem-report.handler";
import { PROBLEM_REPORT_HEADLINE } from "./problem-report-slack-message";

import { seedAssistantProblemReport, seedAssistantTurnTrace } from "@test/seeders/db/feedback.seeder";
import { seedUser } from "@test/seeders/db/user-with-wallet.seeder";
import { expectJobCompleted, findJobRows, useJobWorkers } from "@test/services/job-queue-harness";

const SLACK_ORIGIN = "https://hooks.slack.test";
const SLACK_PATH = "/services/T000/B000/assistant";
const CONSOLE_ADMIN_URL = "https://console-admin.example.com";

const jobWorkers = useJobWorkers(() => [container.resolve(NotifyProblemReportHandler)]);

describe(NotifyProblemReportHandler.name, () => {
  const config = container.resolve(FEEDBACK_CONFIG);
  const configuredWebhookUrl = config.ASSISTANT_SLACK_WEBHOOK_URL;

  afterEach(() => {
    vi.restoreAllMocks();
    nock.cleanAll();
    config.ASSISTANT_SLACK_WEBHOOK_URL = configuredWebhookUrl;
  });

  it("posts the report without its note or transcript, with the reported turn and a link to the conversation in admin", async () => {
    const { user, notify, slackPosts } = await setup({});
    const trace = await seedAssistantTurnTrace({ userId: user.id, outcome: "fallback", model: "zai-org/GLM-5.3" });
    const report = await seedAssistantProblemReport({
      userId: user.id,
      conversationId: trace.conversationId,
      turnTraceId: trace.id,
      note: "private note",
      transcript: [{ role: "user", content: "private question" }]
    });

    await notify(report.id);

    expect(slackPosts).toEqual([
      {
        text: [
          PROBLEM_REPORT_HEADLINE,
          "Transcript: attached · Note: attached",
          "Reported turn: fallback · zai-org/GLM-5.3",
          `<${CONSOLE_ADMIN_URL}/assistant/conversations/${trace.conversationId}|Open in admin>`
        ].join("\n")
      }
    ]);
  });

  it("posts a stored conversation's report without a turn", async () => {
    const { user, notify, slackPosts } = await setup({});
    const report = await seedAssistantProblemReport({ userId: user.id, transcript: null });

    await notify(report.id);

    expect(slackPosts).toHaveLength(1);
    expect(slackPosts[0].text.split("\n").slice(1, 3)).toEqual(["Transcript: stored conversation · Note: none", "Reported turn: unknown"]);
  });

  it("posts nothing while the webhook is unset", async () => {
    const { user, notify, slackPosts } = await setup({ webhookUrl: undefined });
    const report = await seedAssistantProblemReport({ userId: user.id });

    await notify(report.id);

    expect(slackPosts).toEqual([]);
  });

  it("posts nothing for a report deleted before the job ran", async () => {
    const { notify, slackPosts } = await setup({});

    await notify("00000000-0000-0000-0000-000000000000");

    expect(slackPosts).toEqual([]);
  });

  it("leaves the job to be retried when Slack rejects the post", async () => {
    const { user, enqueueAndStart } = await setup({ slackStatus: 500 });
    const report = await seedAssistantProblemReport({ userId: user.id });

    await enqueueAndStart(report.id);

    await vi.waitFor(
      async () => {
        const [row] = await findJobRows(NotifyProblemReport[JOB_NAME], { data: { problemReportId: report.id } });
        expect(row?.state).toBe("retry");
      },
      { timeout: 20_000, interval: 250 }
    );
  });

  async function setup(input: { webhookUrl?: string; slackStatus?: number }) {
    const { enqueue, startWorkers } = await jobWorkers();
    const user = await seedUser();
    config.ASSISTANT_SLACK_WEBHOOK_URL = "webhookUrl" in input ? input.webhookUrl : `${SLACK_ORIGIN}${SLACK_PATH}`;

    const billingConfig = container.resolve(BillingConfigService);
    const readConfig = billingConfig.get.bind(billingConfig);
    vi.spyOn(billingConfig, "get").mockImplementation((key => (key === "CONSOLE_ADMIN_URL" ? CONSOLE_ADMIN_URL : readConfig(key))) as typeof billingConfig.get);

    const slackPosts: { text: string }[] = [];
    nock(SLACK_ORIGIN)
      .post(SLACK_PATH, body => {
        slackPosts.push(body);
        return true;
      })
      .reply(input.slackStatus ?? 200, "ok")
      .persist();

    async function enqueueAndStart(problemReportId: string) {
      await enqueue(new NotifyProblemReport({ problemReportId }));
      await startWorkers();
    }

    async function notify(problemReportId: string) {
      await enqueueAndStart(problemReportId);
      await expectJobCompleted(NotifyProblemReport[JOB_NAME], { data: { problemReportId } });
    }

    return { user, notify, enqueueAndStart, slackPosts };
  }
});
