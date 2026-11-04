import { LoggerService } from "@akashnetwork/logging";
import { faker } from "@faker-js/faker";
import nock from "nock";
import { container } from "tsyringe";
import { afterEach, describe, expect, it, onTestFinished, vi } from "vitest";

import { type ApiPgDatabase, JOB_NAME, POSTGRES_DB, resolveTable } from "@src/core";
import { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import { HARDWARE_REQUEST_CONFIG, type HardwareRequestConfig } from "@src/hardware-request/providers/config.provider";
import { HardwareRequestRepository } from "@src/hardware-request/repositories/hardware-request/hardware-request.repository";
import { UserRepository } from "@src/user/repositories";
import { HardwareRequestSlackAlertHandler, HardwareRequestSlackAlertJob } from "./hardware-request-slack-alert.handler";

import { seedOrganizationWithOwner } from "@test/seeders/db/organization.seeder";
import { expectJobCompleted, findJobRows, useJobWorkers } from "@test/services/job-queue-harness";

const SLACK_ORIGIN = "https://hooks.slack.test";
const SLACK_PATH = "/services/T000/B000/hardware";
const AMPLITUDE_PROJECT_URL = "https://app.amplitude.com/analytics/example-org/project/100001";
const CONSOLE_ADMIN_URL = "https://console-admin.example.com";

type SlackSettings = Pick<HardwareRequestConfig, "HARDWARE_REQUEST_SLACK_WEBHOOK_URL" | "AMPLITUDE_PROJECT_URL" | "CONSOLE_ADMIN_URL">;

const jobWorkers = useJobWorkers(() => [container.resolve(HardwareRequestSlackAlertHandler)]);

describe(HardwareRequestSlackAlertHandler.name, () => {
  afterEach(() => {
    nock.cleanAll();
    vi.restoreAllMocks();
  });

  it("posts the request, its requester and links to the user, run the way a worker runs it", async () => {
    const { user, hardwareRequest, slackPosts, alertFor } = await setup();

    await alertFor(hardwareRequest.id);

    expect(slackPosts).toEqual([
      {
        text: [
          ":inbox_tray: *GPU request: 8× B200*",
          "*Automated lane · value unknown*",
          "Trial · via the request form",
          `${user.email} · reply to ${hardwareRequest.contactEmail}`,
          "> Training run for 3 months",
          `<${AMPLITUDE_PROJECT_URL}/search/user_id%3D${user.id}|Amplitude sessions> · <${CONSOLE_ADMIN_URL}/users/${user.id}?tab=hardware-requests|Admin>`
        ].join("\n")
      }
    ]);
  });

  it("mentions the sales owner and shows the team's name and card on a sales-lane request", async () => {
    vi.spyOn(container.resolve(FeatureFlagsService), "getVariantPayload").mockReturnValue(
      JSON.stringify({ owners: [{ name: "Remington", slackUserId: "U0123", match: { gpuClass: "data_center" } }] })
    );
    const { slackPosts, alertFor } = await setup();
    const { organization, user } = await seedOrganizationWithOwner({ name: "Acme" });
    await seedCard({ userId: user.id, organizationId: organization.id });
    const hardwareRequest = await container.resolve(HardwareRequestRepository).create({
      userId: user.id,
      organizationId: organization.id,
      category: "gpu_model",
      gpuModel: "B200",
      quantity: 8,
      contactEmail: faker.internet.email(),
      source: "gpu_menu",
      lane: "sales",
      laneReason: "monthly_value",
      estimatedMonthlyUsd: 29_200,
      owner: "Remington"
    });

    await alertFor(hardwareRequest.id);

    expect(slackPosts[0].text.split("\n").slice(1, 3)).toEqual([
      "*Sales lane (monthly value) · est. $29,200/month* · <@U0123>",
      "Acme · Paying · via GPU menu"
    ]);
  });

  it("posts nothing when no Slack webhook is configured", async () => {
    const { hardwareRequest, slackPosts, alertFor } = await setup({ webhookUrl: undefined });

    await alertFor(hardwareRequest.id);

    expect(slackPosts).toEqual([]);
  });

  it("completes without posting when the request no longer exists", async () => {
    const { slackPosts, alertFor } = await setup();

    await alertFor(faker.string.uuid());

    expect(slackPosts).toEqual([]);
  });

  it("leaves the job to be retried when Slack rejects the post", async () => {
    const { hardwareRequest, enqueueAlertFor } = await setup({ slackStatus: 500 });

    await enqueueAlertFor(hardwareRequest.id);

    await vi.waitFor(
      async () => {
        const [row] = await findJobRows(HardwareRequestSlackAlertJob[JOB_NAME], { data: { hardwareRequestId: hardwareRequest.id } });
        expect(row?.state).toBe("retry");
      },
      { timeout: 20_000, interval: 250 }
    );
  });

  it("records a rejected post on the job and in the failure log without the webhook address", async () => {
    const logError = vi.spyOn(LoggerService.prototype, "error");
    onTestFinished(() => logError.mockRestore());
    const { hardwareRequest, enqueueAlertFor } = await setup({ slackStatus: 404 });

    await enqueueAlertFor(hardwareRequest.id);

    const row = await vi.waitFor(
      async () => {
        const [job] = await findJobRows(HardwareRequestSlackAlertJob[JOB_NAME], { data: { hardwareRequestId: hardwareRequest.id } });
        expect(job?.state).toBe("retry");
        return job;
      },
      { timeout: 20_000, interval: 250 }
    );
    expect(row.output).toMatchObject({ message: "Slack webhook answered 404: ok" });
    expect(JSON.stringify(row.output)).not.toContain(SLACK_PATH);
    const [jobFailed] = logError.mock.calls.map(([log]) => log as { event?: string; error?: object }).filter(log => log.event === "JOB_FAILED");
    expect(jobFailed.error).toEqual(new Error("Slack webhook answered 404: ok"));
    expect(jobFailed.error).not.toHaveProperty("config");
  });

  async function setup(input: { webhookUrl?: string; slackStatus?: number } = {}) {
    const { enqueue, startWorkers } = await jobWorkers();
    overrideSlackSettings({
      HARDWARE_REQUEST_SLACK_WEBHOOK_URL: "webhookUrl" in input ? input.webhookUrl : `${SLACK_ORIGIN}${SLACK_PATH}`,
      AMPLITUDE_PROJECT_URL,
      CONSOLE_ADMIN_URL
    });

    const user = await container.resolve(UserRepository).create({ email: faker.internet.email(), username: `user-${faker.string.alphanumeric(12)}` });
    const hardwareRequest = await container.resolve(HardwareRequestRepository).create({
      userId: user.id,
      category: "gpu_model",
      gpuModel: "B200",
      quantity: 8,
      details: "Training run for 3 months",
      contactEmail: `ops-${faker.string.alphanumeric(8)}@example.com`
    });

    const slackPosts: { text: string }[] = [];
    nock(SLACK_ORIGIN)
      .post(SLACK_PATH, body => {
        slackPosts.push(body);
        return true;
      })
      .reply(input.slackStatus ?? 200, "ok")
      .persist();

    async function enqueueAlertFor(hardwareRequestId: string) {
      await enqueue(new HardwareRequestSlackAlertJob({ hardwareRequestId }));
      await startWorkers();
    }

    async function alertFor(hardwareRequestId: string) {
      await enqueueAlertFor(hardwareRequestId);
      await expectJobCompleted(HardwareRequestSlackAlertJob[JOB_NAME], { data: { hardwareRequestId } });
    }

    return { user, hardwareRequest, slackPosts, enqueueAlertFor, alertFor };
  }

  async function seedCard(owner: { userId: string; organizationId: string }) {
    await container
      .resolve<ApiPgDatabase>(POSTGRES_DB)
      .insert(resolveTable("PaymentMethods"))
      .values({ ...owner, fingerprint: `fp_${faker.string.alphanumeric(16)}`, paymentMethodId: `pm_${faker.string.alphanumeric(24)}` });
  }

  function overrideSlackSettings(settings: SlackSettings) {
    const config = container.resolve(HARDWARE_REQUEST_CONFIG);
    const original: SlackSettings = {
      HARDWARE_REQUEST_SLACK_WEBHOOK_URL: config.HARDWARE_REQUEST_SLACK_WEBHOOK_URL,
      AMPLITUDE_PROJECT_URL: config.AMPLITUDE_PROJECT_URL,
      CONSOLE_ADMIN_URL: config.CONSOLE_ADMIN_URL
    };
    Object.assign(config, settings);
    onTestFinished(() => {
      Object.assign(config, original);
    });
  }
});
