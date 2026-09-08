import "@src/app/providers/jobs.provider";

import nock from "nock";
import { container } from "tsyringe";
import { afterEach, describe, expect, it } from "vitest";

import { EnableDeploymentAlertCommand } from "@src/billing/commands/enable-deployment-alert.command";
import { JOB_NAME } from "@src/core";
import { NOTIFICATIONS_CONFIG } from "@src/notifications/providers/notifications-config.provider";
import { EnableDeploymentAlertHandler } from "./enable-deployment-alert.handler";

import { createAkashAddress } from "@test/seeders/akash-address.seeder";
import { createDseq } from "@test/seeders/db/deployment-setting.seeder";
import { seedUser } from "@test/seeders/db/user-with-wallet.seeder";
import { expectJobCompleted, useJobWorkers } from "@test/services/job-queue-harness";

const CHANNELS_PATH = "/v1/notification-channels";
const CHANNEL_ID = "channel-1";

const jobWorkers = useJobWorkers(() => [container.resolve(EnableDeploymentAlertHandler)]);

describe(EnableDeploymentAlertHandler.name, () => {
  afterEach(() => {
    nock.cleanAll();
  });

  it("enables the closed alert on the owner's existing channel", async () => {
    const { userId, walletAddress, dseq, enableAlert, createdChannels, upsertedAlerts } = await setup();

    await enableAlert();

    expect(createdChannels()).toHaveLength(0);
    expect(upsertedAlerts()).toEqual([
      {
        dseq,
        userId,
        ownerAddress: walletAddress,
        body: { data: { alerts: { deploymentClosed: { notificationChannelId: CHANNEL_ID, enabled: true } } } }
      }
    ]);
  });

  it("creates a channel first for an owner who has none", async () => {
    const { enableAlert, createdChannels, upsertedAlerts } = await setup({ hasChannel: false });

    await enableAlert();

    expect(createdChannels()).toHaveLength(1);
    expect(upsertedAlerts()).toHaveLength(1);
  });

  it("enables nothing for a user with no email to notify", async () => {
    const { enableAlert, upsertedAlerts } = await setup({ email: null });

    await enableAlert();

    expect(upsertedAlerts()).toHaveLength(0);
  });

  async function setup(input: { email?: string | null; hasChannel?: boolean } = {}) {
    const { enqueue, startWorkers } = await jobWorkers();
    const baseUrl = container.resolve(NOTIFICATIONS_CONFIG).NOTIFICATIONS_API_BASE_URL as string;

    const email = input.email === undefined ? "alerts@example.com" : input.email;
    const user = await seedUser({ email });
    const walletAddress = createAkashAddress();
    const dseq = createDseq();

    const createdChannels: unknown[] = [];
    const upserted: { dseq: string; userId: string | undefined; ownerAddress: string | undefined; body: unknown }[] = [];
    let channels = input.hasChannel === false ? [] : [{ id: CHANNEL_ID }];

    nock(baseUrl)
      .persist()
      .get(CHANNELS_PATH)
      .query(true)
      .reply(() => [200, { data: channels }]);

    nock(baseUrl)
      .persist()
      .post(`${CHANNELS_PATH}/default`)
      .reply(function reply(this: nock.ReplyFnContext, _uri, body) {
        createdChannels.push(body);
        channels = [{ id: CHANNEL_ID }];

        return [201, { data: { id: CHANNEL_ID } }];
      });

    nock(baseUrl)
      .persist()
      .post(`/v1/deployment-alerts/${dseq}`)
      .reply(function reply(this: nock.ReplyFnContext, _uri, body) {
        upserted.push({
          dseq,
          userId: this.req.headers["x-user-id"] as string,
          ownerAddress: this.req.headers["x-owner-address"] as string,
          body
        });

        return [200, { data: {} }];
      });

    return {
      userId: user.id,
      walletAddress,
      dseq,
      createdChannels: () => createdChannels,
      upsertedAlerts: () => upserted,
      enableAlert: async () => {
        await enqueue(new EnableDeploymentAlertCommand({ userId: user.id, walletAddress, dseq }), {
          singletonKey: `enableDeploymentAlert.${user.id}.${dseq}`
        });
        await startWorkers();
        await expectJobCompleted(EnableDeploymentAlertCommand[JOB_NAME], { singletonKey: `enableDeploymentAlert.${user.id}.${dseq}` });
      }
    };
  }
});
