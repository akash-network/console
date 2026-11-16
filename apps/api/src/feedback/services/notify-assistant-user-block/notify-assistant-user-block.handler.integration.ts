import nock from "nock";
import { container } from "tsyringe";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import { JOB_NAME } from "@src/core";
import { FEEDBACK_CONFIG } from "@src/feedback/providers/config.provider";
import { NotifyAssistantUserBlock, NotifyAssistantUserBlockHandler } from "./notify-assistant-user-block.handler";
import { USER_BLOCK_HEADLINE } from "./user-block-slack-message";

import { seedAssistantUserBlock } from "@test/seeders/db/feedback.seeder";
import { seedUser } from "@test/seeders/db/user-with-wallet.seeder";
import { expectJobCompleted, findJobRows, useJobWorkers } from "@test/services/job-queue-harness";

const SLACK_ORIGIN = "https://hooks.slack.test";
const SLACK_PATH = "/services/T000/B000/assistant";
const CONSOLE_ADMIN_URL = "https://console-admin.example.com";

const jobWorkers = useJobWorkers(() => [container.resolve(NotifyAssistantUserBlockHandler)]);

describe(NotifyAssistantUserBlockHandler.name, () => {
  const config = container.resolve(FEEDBACK_CONFIG);
  const configuredWebhookUrl = config.ASSISTANT_SLACK_WEBHOOK_URL;

  afterEach(() => {
    vi.restoreAllMocks();
    nock.cleanAll();
    config.ASSISTANT_SLACK_WEBHOOK_URL = configuredWebhookUrl;
  });

  it("posts the block with a link to the user's conversations in admin", async () => {
    const { user, notify, slackPosts } = await setup({});
    const block = await seedAssistantUserBlock({
      userId: user.id,
      source: "automatic",
      blockedUntil: new Date("2026-11-05T00:00:00.000Z"),
      flaggedTurnCount: 3
    });

    await notify(block.id);

    expect(slackPosts).toEqual([
      {
        text: [
          USER_BLOCK_HEADLINE,
          "automatic block · 3 flagged turns today · until 2026-11-05 00:00 UTC",
          `<${CONSOLE_ADMIN_URL}/assistant/conversations?userId=${user.id}|Open in admin>`
        ].join("\n")
      }
    ]);
  });

  it("posts nothing while the webhook is unset", async () => {
    const { user, notify, slackPosts } = await setup({ webhookUrl: undefined });
    const block = await seedAssistantUserBlock({ userId: user.id });

    await notify(block.id);

    expect(slackPosts).toEqual([]);
  });

  it("posts nothing for a block deleted before the job ran", async () => {
    const { notify, slackPosts } = await setup({});

    await notify("00000000-0000-0000-0000-000000000000");

    expect(slackPosts).toEqual([]);
  });

  it("leaves the job to be retried when Slack rejects the post", async () => {
    const { user, enqueueAndStart } = await setup({ slackStatus: 500 });
    const block = await seedAssistantUserBlock({ userId: user.id });

    await enqueueAndStart(block.id);

    await vi.waitFor(
      async () => {
        const [row] = await findJobRows(NotifyAssistantUserBlock[JOB_NAME], { data: { blockId: block.id } });
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

    async function enqueueAndStart(blockId: string) {
      await enqueue(new NotifyAssistantUserBlock({ blockId }));
      await startWorkers();
    }

    async function notify(blockId: string) {
      await enqueueAndStart(blockId);
      await expectJobCompleted(NotifyAssistantUserBlock[JOB_NAME], { data: { blockId } });
    }

    return { user, notify, enqueueAndStart, slackPosts };
  }
});
