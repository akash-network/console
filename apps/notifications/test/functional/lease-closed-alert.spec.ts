import { faker } from "@faker-js/faker";
import { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import nock from "nock";
import { describe, expect, it, onTestFinished, vi } from "vitest";

import { eventKeyRegistry } from "@src/common/config/event-key-registry.config";
import { BrokerService } from "@src/infrastructure/broker";
import { DRIZZLE_PROVIDER_TOKEN } from "@src/infrastructure/db/config/db.config";
import AlertEventsModule from "@src/interfaces/alert-events/alert-events.module";
import { ChainEventsHandler } from "@src/interfaces/alert-events/handlers/chain-events/chain-events.handler";
import { ClosureAlertsHandler } from "@src/interfaces/alert-events/handlers/closure-alerts/closure-alerts.handler";
import type { EventClosedDeploymentDto } from "@src/modules/alert/dto/event-closed-deployment.dto";
import type { EventLeaseClosedDto } from "@src/modules/alert/dto/event-lease-closed.dto";
import type { EventLeaseReclaimStartedDto } from "@src/modules/alert/dto/event-lease-reclaim-started.dto";
import * as schema from "@src/modules/alert/model-schemas";
import type { NotificationCommandDto } from "@src/modules/notifications/dto/NotificationCommand.dto";
import { NotificationChannel } from "@src/modules/notifications/model-schemas";

import { mockAkashAddress } from "@test/seeders/akash-address.seeder";
import { generateGeneralAlert } from "@test/seeders/general-alert.seeder";
import { generateNotificationChannel } from "@test/seeders/notification-channel.seeder";

describe("lease closed alerts", () => {
  it("sends a single lease closed notification to the deployment-closed alert's channel and dedupes on replay", async () => {
    const { module, controller, emailsAfterHold, providerHostUris, db } = await setup();

    try {
      const owner = mockAkashAddress();
      const dseq = generateDseq();
      const provider = mockAkashAddress();
      providerHostUris.set(provider, "https://provider.hurricane.akash.pub:8443");
      const [ownerChannel, otherOwnerChannel] = await db
        .insert(NotificationChannel)
        .values([generateNotificationChannel({}), generateNotificationChannel({})])
        .returning();
      await db
        .insert(schema.Alert)
        .values([
          generateClosedAlert({ owner, dseq, notificationChannelId: ownerChannel.id }),
          generateClosedAlert({ owner: mockAkashAddress(), dseq, notificationChannelId: otherOwnerChannel.id })
        ]);
      const event = generateLeaseClosedEvent({ owner, dseq, provider });

      await controller.processLeaseClosed(event);
      await controller.processLeaseClosed(event);

      expect(await emailsAfterHold(ownerChannel.id, otherOwnerChannel.id)).toEqual([
        expect.objectContaining({
          notificationChannelId: ownerChannel.id,
          payload: expect.objectContaining({
            summary: `The lease for deployment ${dseq} was closed`,
            description: expect.stringContaining("with provider provider.hurricane.akash.pub was closed because the manifest was not received in time")
          })
        })
      ]);
    } finally {
      await module.close();
    }
  });

  it("names the provider by its address when the chain cannot tell its host", async () => {
    const { module, controller, emailsAfterHold, db } = await setup();

    try {
      const owner = mockAkashAddress();
      const dseq = generateDseq();
      const provider = mockAkashAddress();
      const [channel] = await db
        .insert(NotificationChannel)
        .values([generateNotificationChannel({})])
        .returning();
      await db.insert(schema.Alert).values([generateClosedAlert({ owner, dseq, notificationChannelId: channel.id })]);

      await controller.processLeaseClosed(generateLeaseClosedEvent({ owner, dseq, provider }));

      expect(await emailsAfterHold(channel.id)).toEqual([
        expect.objectContaining({ payload: expect.objectContaining({ description: expect.stringContaining(`with provider ${provider} was closed`) }) })
      ]);
    } finally {
      await module.close();
    }
  });

  it("sends the lease closed notification to the owner's alert when another user's alert for the same deployment was already notified", async () => {
    const { module, controller, emailsAfterHold, db } = await setup();

    try {
      const owner = mockAkashAddress();
      const dseq = generateDseq();
      const [otherUserChannel, ownerChannel] = await db
        .insert(NotificationChannel)
        .values([generateNotificationChannel({}), generateNotificationChannel({})])
        .returning();
      const otherUserAlert = generateClosedAlert({ owner, dseq, notificationChannelId: otherUserChannel.id });
      await db.insert(schema.Alert).values({ ...otherUserAlert, params: { dseq, type: "DEPLOYMENT_CLOSED", reclaimNotifiedAt: new Date().toISOString() } });
      await db.insert(schema.Alert).values(generateClosedAlert({ owner, dseq, notificationChannelId: ownerChannel.id }));

      await controller.processLeaseClosed(generateLeaseClosedEvent({ owner, dseq }));

      expect(await emailsAfterHold(otherUserChannel.id, ownerChannel.id)).toEqual([expect.objectContaining({ notificationChannelId: ownerChannel.id })]);
    } finally {
      await module.close();
    }
  });

  it("tells the lease's close reason in the deployment's one closure email when the deployment closed in the same block and its alert fired first", async () => {
    const { module, controller, emailsAfterHold, db } = await setup();

    try {
      const owner = mockAkashAddress();
      const dseq = generateDseq();
      const [channel] = await db
        .insert(NotificationChannel)
        .values([generateNotificationChannel({})])
        .returning();
      await db.insert(schema.Alert).values([generateClosedAlert({ owner, dseq, notificationChannelId: channel.id })]);

      await controller.processDeploymentClosed(generateDeploymentClosedEvent({ owner, dseq }));
      await controller.processLeaseClosed(generateLeaseClosedEvent({ owner, dseq, reason: "lease_closed_reason_insufficient_funds" }));

      expect(await emailsAfterHold(channel.id)).toEqual([
        expect.objectContaining({
          notificationChannelId: channel.id,
          payload: expect.objectContaining({
            summary: `Deployment ${dseq} is now closed`,
            description: expect.stringContaining("because the deployment has insufficient funds")
          })
        })
      ]);
    } finally {
      await module.close();
    }
  });

  it("does not send when a reclaim email already warned about the deployment", async () => {
    const { module, controller, emailsAfterHold, db } = await setup();

    try {
      const owner = mockAkashAddress();
      const dseq = generateDseq();
      const [channel] = await db
        .insert(NotificationChannel)
        .values([generateNotificationChannel({})])
        .returning();
      await db.insert(schema.Alert).values([generateClosedAlert({ owner, dseq, notificationChannelId: channel.id })]);

      await controller.processLeaseReclaimStarted(generateReclaimEvent({ owner, dseq }));
      await controller.processLeaseClosed(generateLeaseClosedEvent({ owner, dseq }));

      expect(await emailsAfterHold(channel.id)).toEqual([
        expect.objectContaining({ payload: expect.objectContaining({ summary: `Deployment ${dseq} is being reclaimed by the provider` }) })
      ]);
    } finally {
      await module.close();
    }
  });

  it("does not send a reclaim email after the lease closed email", async () => {
    const { module, controller, emailsAfterHold, db } = await setup();

    try {
      const owner = mockAkashAddress();
      const dseq = generateDseq();
      const [channel] = await db
        .insert(NotificationChannel)
        .values([generateNotificationChannel({})])
        .returning();
      await db.insert(schema.Alert).values([generateClosedAlert({ owner, dseq, notificationChannelId: channel.id })]);

      await controller.processLeaseClosed(generateLeaseClosedEvent({ owner, dseq }));
      await controller.processLeaseReclaimStarted(generateReclaimEvent({ owner, dseq }));

      expect(await emailsAfterHold(channel.id)).toEqual([
        expect.objectContaining({ payload: expect.objectContaining({ summary: `The lease for deployment ${dseq} was closed` }) })
      ]);
    } finally {
      await module.close();
    }
  });

  it("sends only one email when the reclaim and lease closed events are processed at once", async () => {
    const { module, controller, emailsAfterHold, db } = await setup();

    try {
      const owner = mockAkashAddress();
      const dseq = generateDseq();
      const [channel] = await db
        .insert(NotificationChannel)
        .values([generateNotificationChannel({})])
        .returning();
      await db.insert(schema.Alert).values([generateClosedAlert({ owner, dseq, notificationChannelId: channel.id })]);

      await Promise.all([
        controller.processLeaseReclaimStarted(generateReclaimEvent({ owner, dseq })),
        controller.processLeaseClosed(generateLeaseClosedEvent({ owner, dseq }))
      ]);

      expect(await emailsAfterHold(channel.id)).toHaveLength(1);
    } finally {
      await module.close();
    }
  });

  it("does not send when the user switched the deployment-closed alert off", async () => {
    const { module, controller, emailsAfterHold, db } = await setup();

    try {
      const owner = mockAkashAddress();
      const dseq = generateDseq();
      const [channel] = await db
        .insert(NotificationChannel)
        .values([generateNotificationChannel({})])
        .returning();
      await db.insert(schema.Alert).values([generateClosedAlert({ owner, dseq, notificationChannelId: channel.id, enabled: false })]);

      await controller.processLeaseClosed(generateLeaseClosedEvent({ owner, dseq }));

      expect(await emailsAfterHold(channel.id)).toEqual([]);
    } finally {
      await module.close();
    }
  });

  it("does not send when the owner closed the lease", async () => {
    const { module, controller, emailsAfterHold, db } = await setup();

    try {
      const owner = mockAkashAddress();
      const dseq = generateDseq();
      const [channel] = await db
        .insert(NotificationChannel)
        .values([generateNotificationChannel({})])
        .returning();
      await db.insert(schema.Alert).values([generateClosedAlert({ owner, dseq, notificationChannelId: channel.id })]);

      await controller.processLeaseClosed(generateLeaseClosedEvent({ owner, dseq, reason: "lease_closed_owner" }));

      expect(await emailsAfterHold(channel.id)).toEqual([]);
    } finally {
      await module.close();
    }
  });

  function generateDseq() {
    return String(faker.number.int({ min: 1, max: 999999 }));
  }

  function generateClosedAlert(input: { owner: string; dseq: string; notificationChannelId: string; enabled?: boolean }) {
    return generateGeneralAlert({
      type: "CHAIN_EVENT",
      notificationChannelId: input.notificationChannelId,
      enabled: input.enabled ?? true,
      params: { dseq: input.dseq, type: "DEPLOYMENT_CLOSED" },
      conditions: {
        operator: "and",
        value: [
          { field: "action", value: "deployment-closed", operator: "eq" },
          { field: "owner", value: input.owner, operator: "eq" },
          { field: "dseq", value: input.dseq, operator: "eq" }
        ]
      },
      summary: "Deployment closed",
      description: "Deployment closed"
    });
  }

  function generateLeaseClosedEvent(input: { owner: string; dseq: string; provider?: string; reason?: string }): EventLeaseClosedDto {
    return {
      module: "market",
      action: "lease-closed",
      owner: input.owner,
      dseq: input.dseq,
      provider: input.provider ?? mockAkashAddress(),
      reason: input.reason ?? "lease_closed_reason_manifest_timeout"
    };
  }

  function generateDeploymentClosedEvent(input: { owner: string; dseq: string }): EventClosedDeploymentDto {
    return { module: "deployment", action: "deployment-closed", owner: input.owner, dseq: input.dseq };
  }

  function generateReclaimEvent(input: { owner: string; dseq: string }): EventLeaseReclaimStartedDto {
    return {
      module: "market",
      action: "lease-reclaim-started",
      owner: input.owner,
      dseq: input.dseq,
      provider: mockAkashAddress(),
      reason: "lease_closed_reason_unstable",
      deadline: "1749398400"
    };
  }

  async function setup() {
    vi.useFakeTimers({ toFake: ["Date"] });
    const module = await Test.createTestingModule({
      imports: [AlertEventsModule]
    }).compile();
    const brokerService = module.get(BrokerService);
    const publish = vi.spyOn(brokerService, "publish").mockResolvedValue(undefined);
    const closureAlerts = module.get(ClosureAlertsHandler);
    const providerHostUris = new Map<string, string>();
    nock(module.get(ConfigService).getOrThrow("API_NODE_ENDPOINT"))
      .persist()
      .get(/\/akash\/provider\/v1beta4\/providers\/[^/]+$/)
      .reply(uri => {
        const hostUri = providerHostUris.get(uri.split("/").at(-1) ?? "");
        return hostUri ? [200, { provider: { host_uri: hostUri } }] : [404, { code: 5, message: "provider not found" }];
      });
    onTestFinished(() => {
      nock.cleanAll();
      vi.useRealTimers();
    });

    async function emailsAfterHold(...notificationChannelIds: string[]) {
      vi.setSystemTime(Date.now() + module.get(ConfigService).getOrThrow("alert.CLOSURE_ALERT_HOLD_SECONDS") * 1000);
      for (const notificationChannelId of notificationChannelIds) {
        await closureAlerts.flush({ notificationChannelId });
      }

      return publish.mock.calls.filter(([eventName]) => eventName === eventKeyRegistry.createNotification).map(([, message]) => message as NotificationCommandDto);
    }

    return {
      module,
      controller: module.get(ChainEventsHandler),
      brokerService,
      emailsAfterHold,
      providerHostUris,
      db: module.get(DRIZZLE_PROVIDER_TOKEN)
    };
  }
});
