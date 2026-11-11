import { faker } from "@faker-js/faker";
import nock from "nock";
import { container } from "tsyringe";
import { afterEach, describe, expect, it, onTestFinished, vi } from "vitest";

import { JOB_NAME } from "@src/core";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import { HARDWARE_REQUEST_CONFIG } from "@src/hardware-request/providers/config.provider";
import { HardwareRequestEventRepository } from "@src/hardware-request/repositories/hardware-request-event/hardware-request-event.repository";
import { NOTIFICATIONS_CONFIG } from "@src/notifications/providers/notifications-config.provider";
import { HardwareRequestResponseTargetHandler, HardwareRequestResponseTargetJob } from "./hardware-request-response-target.handler";

import { seedHardwareRequest } from "@test/seeders/db/hardware-request.seeder";
import { seedUser } from "@test/seeders/db/user-with-wallet.seeder";
import { expectJobCompleted, useJobWorkers } from "@test/services/job-queue-harness";

const SLACK_ORIGIN = "https://hooks.slack.test";
const SLACK_PATH = "/services/T000/B000/hardware";
const NOTIFICATION_PATH = "/internal/v1/jobs/notification";

const jobWorkers = useJobWorkers(() => [container.resolve(HardwareRequestResponseTargetHandler)]);

describe(HardwareRequestResponseTargetHandler.name, () => {
  afterEach(() => {
    nock.cleanAll();
    vi.restoreAllMocks();
  });

  it("escalates a missed first offer to Slack and the mailbox and records it, run the way a worker runs it", async () => {
    const { runJob, notifications, slackPosts } = await setup();
    const hardwareRequest = await seedHardwareRequest({ userId: (await seedUser()).id, owner: null, status: "sourcing" });

    await runJob(hardwareRequest.id);

    expect(notifications).toMatchObject([
      {
        notificationId: `hardwareRequestResponseTarget.${hardwareRequest.id}.first_offer.escalation`,
        recipient: container.resolve(HARDWARE_REQUEST_CONFIG).HARDWARE_REQUEST_EMAIL
      }
    ]);
    expect(slackPosts).toEqual([{ text: expect.stringContaining(`*Missed first offer target*`) }]);
    expect(await container.resolve(HardwareRequestEventRepository).findOldestFirst(hardwareRequest.id)).toMatchObject([
      { type: "escalated", actor: null, payload: { target: "first_offer" } }
    ]);
  });

  it("escalates a missed first offer to Slack alone and records it while response target emails are off", async () => {
    const { runJob, notifications, slackPosts } = await setup();
    vi.spyOn(container.resolve(FeatureFlagsService), "isEnabled").mockImplementation(flag => flag !== FeatureFlags.GPU_REQUEST_RESPONSE_TARGET_EMAILS);
    const hardwareRequest = await seedHardwareRequest({ userId: (await seedUser()).id, owner: null, status: "sourcing" });

    await runJob(hardwareRequest.id);

    expect(notifications).toEqual([]);
    expect(slackPosts).toEqual([{ text: expect.stringContaining(`*Missed first offer target*`) }]);
    expect(await container.resolve(HardwareRequestEventRepository).findOldestFirst(hardwareRequest.id)).toMatchObject([
      { type: "escalated", actor: null, payload: { target: "first_offer" } }
    ]);
  });

  it("escalates a missed first offer to the mailbox alone and records it while response target Slack alerts are off", async () => {
    const { runJob, notifications, slackPosts } = await setup();
    vi.spyOn(container.resolve(FeatureFlagsService), "isEnabled").mockImplementation(flag => flag !== FeatureFlags.GPU_REQUEST_RESPONSE_TARGET_SLACK_ALERTS);
    const hardwareRequest = await seedHardwareRequest({ userId: (await seedUser()).id, owner: null, status: "sourcing" });

    await runJob(hardwareRequest.id);

    expect(notifications).toMatchObject([{ notificationId: `hardwareRequestResponseTarget.${hardwareRequest.id}.first_offer.escalation` }]);
    expect(slackPosts).toEqual([]);
    expect(await container.resolve(HardwareRequestEventRepository).findOldestFirst(hardwareRequest.id)).toMatchObject([
      { type: "escalated", actor: null, payload: { target: "first_offer" } }
    ]);
  });

  it("does nothing for a request that was withdrawn in the meantime", async () => {
    const { runJob, notifications, slackPosts } = await setup();
    const hardwareRequest = await seedHardwareRequest({ userId: (await seedUser()).id, status: "withdrawn" });

    await runJob(hardwareRequest.id);

    expect(notifications).toEqual([]);
    expect(slackPosts).toEqual([]);
    expect(await container.resolve(HardwareRequestEventRepository).findOldestFirst(hardwareRequest.id)).toEqual([]);
  });

  async function setup() {
    const { enqueue, startWorkers } = await jobWorkers();
    const config = container.resolve(HARDWARE_REQUEST_CONFIG);
    const originalWebhookUrl = config.HARDWARE_REQUEST_SLACK_WEBHOOK_URL;
    config.HARDWARE_REQUEST_SLACK_WEBHOOK_URL = `${SLACK_ORIGIN}${SLACK_PATH}`;
    onTestFinished(() => {
      config.HARDWARE_REQUEST_SLACK_WEBHOOK_URL = originalWebhookUrl;
    });
    const notifications: Record<string, unknown>[] = [];
    nock(container.resolve(NOTIFICATIONS_CONFIG).NOTIFICATIONS_API_BASE_URL as string)
      .persist()
      .post(NOTIFICATION_PATH)
      .reply(function reply(_uri, body) {
        notifications.push(body as Record<string, unknown>);
        return [204];
      });
    const slackPosts: unknown[] = [];
    nock(SLACK_ORIGIN)
      .persist()
      .post(SLACK_PATH, body => {
        slackPosts.push(body);
        return true;
      })
      .reply(200, "ok");

    async function runJob(hardwareRequestId: string) {
      const singletonKey = faker.string.uuid();
      await enqueue(
        new HardwareRequestResponseTargetJob({ hardwareRequestId, target: "first_offer", stage: "escalation", dueAt: "2026-11-12T15:00:00.000Z" }),
        { singletonKey }
      );
      await startWorkers();
      await expectJobCompleted(HardwareRequestResponseTargetJob[JOB_NAME], { singletonKey });
    }

    return { runJob, notifications, slackPosts };
  }
});
