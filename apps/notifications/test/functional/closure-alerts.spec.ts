import { faker } from "@faker-js/faker";
import { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import { eq } from "drizzle-orm";
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
import * as schema from "@src/modules/alert/model-schemas";
import { CLOSURE_ALERT_CATEGORY, CLOSURE_DIGEST_CATEGORY } from "@src/modules/alert/services/closure-alert/closure-alert-email";
import type { FeedEntriesCommandDto } from "@src/modules/notifications/dto/FeedEntriesCommand.dto";
import type { NotificationCommandDto } from "@src/modules/notifications/dto/NotificationCommand.dto";
import { NotificationChannel } from "@src/modules/notifications/model-schemas";

import { mockAkashAddress } from "@test/seeders/akash-address.seeder";
import { generateGeneralAlert } from "@test/seeders/general-alert.seeder";
import { generateNotificationChannel } from "@test/seeders/notification-channel.seeder";
import { untilAQueryWaitsOnALock } from "@test/services/lock-waits";

const HOLD_SECONDS = 120;
const DIGEST_WINDOW_SECONDS = 3600;

describe("closure alerts", () => {
  it("sends a provider's close of a deployment as one email, after the hold, that names the provider and the reason and links the deployment", async () => {
    const { chainEvents, closureAlerts, emails, feedEntries, flushJobs, travel, givenDeploymentClosedAlert, providerHostUris, consoleWebUrl } = await setup();
    const deployment = generateDeployment();
    const provider = mockAkashAddress();
    providerHostUris.set(provider, "https://provider.hurricane.akash.pub:8443");
    const { alert, channel } = await givenDeploymentClosedAlert(deployment);

    await Promise.all([
      chainEvents.processLeaseClosed(generateLeaseClosedEvent({ ...deployment, provider, reason: "lease_closed_reason_insufficient_funds" })),
      chainEvents.processDeploymentClosed(generateDeploymentClosedEvent(deployment))
    ]);
    await closureAlerts.flush({ notificationChannelId: channel.id });

    expect(emails()).toEqual([]);
    expect(feedEntries()).toEqual([
      {
        type: "deployment_closed_alert",
        alertId: alert.id,
        userId: alert.userId,
        organizationId: null,
        projectId: null,
        dedupeKey: `deployment_close.${deployment.owner}.${deployment.dseq}`,
        dseq: deployment.dseq,
        summary: `Deployment ${deployment.dseq} is now closed`
      }
    ]);
    expect(flushJobs().at(-1)).toEqual({ notificationChannelId: channel.id, singletonKey: channel.id, startAfter: travel.at(HOLD_SECONDS) });

    travel.by(HOLD_SECONDS);
    await closureAlerts.flush({ notificationChannelId: channel.id });

    expect(emails()).toEqual([
      {
        notificationChannelId: channel.id,
        category: CLOSURE_ALERT_CATEGORY,
        payload: {
          summary: `Deployment ${deployment.dseq} is now closed`,
          description:
            `Deployment ${deployment.dseq} was closed after its lease with provider provider.hurricane.akash.pub was closed because the deployment has insufficient funds. ` +
            `Please visit <a href="https://${consoleWebUrl}/deployments/${deployment.dseq}?tab=SETTINGS">${consoleWebUrl}</a> to manage your deployment.`
        }
      }
    ]);
  });

  it("sends one email for a deployment whose several leases closed", async () => {
    const { chainEvents, closureAlerts, emails, travel, givenDeploymentClosedAlert } = await setup();
    const deployment = generateDeployment();
    const { channel } = await givenDeploymentClosedAlert(deployment);

    await chainEvents.processLeaseClosed(generateLeaseClosedEvent(deployment));
    await chainEvents.processLeaseClosed(generateLeaseClosedEvent(deployment));
    await chainEvents.processDeploymentClosed(generateDeploymentClosedEvent(deployment));
    travel.by(HOLD_SECONDS);
    await closureAlerts.flush({ notificationChannelId: channel.id });
    await closureAlerts.flush({ notificationChannelId: channel.id });

    expect(emails()).toHaveLength(1);
    expect(emails()[0].payload.description).toContain("was closed because the manifest was not received in time");
  });

  it("sends a deployment its owner closed as one email without a reason", async () => {
    const { chainEvents, closureAlerts, emails, travel, givenDeploymentClosedAlert } = await setup();
    const deployment = generateDeployment();
    const { channel } = await givenDeploymentClosedAlert(deployment);

    await chainEvents.processDeploymentClosed(generateDeploymentClosedEvent(deployment));
    await chainEvents.processLeaseClosed(generateLeaseClosedEvent({ ...deployment, reason: "lease_closed_owner" }));
    travel.by(HOLD_SECONDS);
    await closureAlerts.flush({ notificationChannelId: channel.id });

    expect(emails()).toEqual([expect.objectContaining({ payload: expect.objectContaining({ description: expect.stringMatching(/^Deployment \d+ was closed\. /) }) })]);
  });

  it("sends nothing more for a lease that closes after its deployment's closure was emailed", async () => {
    const { chainEvents, closureAlerts, emails, travel, givenDeploymentClosedAlert } = await setup();
    const deployment = generateDeployment();
    const { channel } = await givenDeploymentClosedAlert(deployment);

    await chainEvents.processDeploymentClosed(generateDeploymentClosedEvent(deployment));
    travel.by(HOLD_SECONDS);
    await closureAlerts.flush({ notificationChannelId: channel.id });
    await chainEvents.processLeaseClosed(generateLeaseClosedEvent(deployment));
    travel.by(DIGEST_WINDOW_SECONDS);
    await closureAlerts.flush({ notificationChannelId: channel.id });

    expect(emails()).toHaveLength(1);
  });

  it("sends nothing more for a lease that closes while its deployment's closure email is going out", async () => {
    const { chainEvents, closureAlerts, emails, holdNextPublish, db, travel, givenDeploymentClosedAlert } = await setup();
    const deployment = generateDeployment();
    const { channel } = await givenDeploymentClosedAlert(deployment);
    await chainEvents.processDeploymentClosed(generateDeploymentClosedEvent(deployment));
    travel.by(HOLD_SECONDS);

    const releaseEmail = holdNextPublish();
    const flushing = closureAlerts.flush({ notificationChannelId: channel.id });
    await vi.waitFor(() => expect(emails()).toHaveLength(1));
    const leaseClosing = chainEvents.processLeaseClosed(generateLeaseClosedEvent(deployment));
    await untilAQueryWaitsOnALock(db);
    releaseEmail();
    await Promise.all([flushing, leaseClosing]);
    travel.by(DIGEST_WINDOW_SECONDS);
    await closureAlerts.flush({ notificationChannelId: channel.id });

    expect(emails()).toHaveLength(1);
  });

  it("batches the closures a channel gets within an hour of its last closure email into one digest sent when the hour is up", async () => {
    const { chainEvents, closureAlerts, emails, flushJobs, travel, givenDeploymentClosedAlert } = await setup();
    const first = generateDeployment();
    const { channel } = await givenDeploymentClosedAlert(first);
    const second = generateDeployment();
    const third = generateDeployment();
    await givenDeploymentClosedAlert(second, channel.id);
    await givenDeploymentClosedAlert(third, channel.id);

    await chainEvents.processDeploymentClosed(generateDeploymentClosedEvent(first));
    travel.by(HOLD_SECONDS);
    await closureAlerts.flush({ notificationChannelId: channel.id });
    const firstSentAt = travel.at(0);
    travel.by(600);
    await chainEvents.processDeploymentClosed(generateDeploymentClosedEvent(second));
    travel.by(1);
    await chainEvents.processLeaseClosed(generateLeaseClosedEvent(third));
    travel.by(HOLD_SECONDS);
    await closureAlerts.flush({ notificationChannelId: channel.id });

    expect(emails()).toHaveLength(1);
    expect(flushJobs().at(-1)).toEqual({ notificationChannelId: channel.id, singletonKey: channel.id, startAfter: new Date(firstSentAt.getTime() + DIGEST_WINDOW_SECONDS * 1000) });

    travel.to(flushJobs().at(-1)!.startAfter);
    await closureAlerts.flush({ notificationChannelId: channel.id });

    expect(emails()).toHaveLength(2);
    expect(emails()[1]).toEqual(
      expect.objectContaining({
        category: CLOSURE_DIGEST_CATEGORY,
        payload: expect.objectContaining({
          summary: "2 deployments were closed or lost a lease",
          description: expect.stringMatching(new RegExp(`^<p>Deployment ${second.dseq} was closed\\..*</p><p>The lease for deployment ${third.dseq} with provider`))
        })
      })
    );
  });

  it("files a deployment closure in the feed as it happens while its email waits for the channel's digest window", async () => {
    const { chainEvents, closureAlerts, emails, feedEntries, travel, givenDeploymentClosedAlert } = await setup();
    const first = generateDeployment();
    const { channel } = await givenDeploymentClosedAlert(first);
    const second = generateDeployment();
    const { alert: secondAlert } = await givenDeploymentClosedAlert(second, channel.id);

    await chainEvents.processDeploymentClosed(generateDeploymentClosedEvent(first));
    travel.by(HOLD_SECONDS);
    await closureAlerts.flush({ notificationChannelId: channel.id });
    travel.by(600);
    await chainEvents.processDeploymentClosed(generateDeploymentClosedEvent(second));

    expect(emails()).toHaveLength(1);
    expect(feedEntries().map(({ alertId }) => alertId)).toEqual([expect.any(String), secondAlert.id]);
  });

  it("emails a channel's next closure on its own once an hour passed without one", async () => {
    const { chainEvents, closureAlerts, emails, travel, givenDeploymentClosedAlert } = await setup();
    const first = generateDeployment();
    const { channel } = await givenDeploymentClosedAlert(first);
    const second = generateDeployment();
    await givenDeploymentClosedAlert(second, channel.id);

    await chainEvents.processDeploymentClosed(generateDeploymentClosedEvent(first));
    travel.by(HOLD_SECONDS);
    await closureAlerts.flush({ notificationChannelId: channel.id });
    travel.by(DIGEST_WINDOW_SECONDS + 1);
    await chainEvents.processDeploymentClosed(generateDeploymentClosedEvent(second));
    travel.by(HOLD_SECONDS);
    await closureAlerts.flush({ notificationChannelId: channel.id });

    expect(emails().map(({ category }) => category)).toEqual([CLOSURE_ALERT_CATEGORY, CLOSURE_ALERT_CATEGORY]);
  });

  it("sends a channel's due closures once when two flushes run at the same time", async () => {
    const { chainEvents, closureAlerts, emails, travel, givenDeploymentClosedAlert } = await setup();
    const deployment = generateDeployment();
    const { channel } = await givenDeploymentClosedAlert(deployment);

    await chainEvents.processDeploymentClosed(generateDeploymentClosedEvent(deployment));
    travel.by(HOLD_SECONDS);
    await Promise.all([closureAlerts.flush({ notificationChannelId: channel.id }), closureAlerts.flush({ notificationChannelId: channel.id })]);

    expect(emails()).toHaveLength(1);
  });

  it("emails each alert of a deployment through its own channel", async () => {
    const { chainEvents, closureAlerts, emails, travel, givenDeploymentClosedAlert } = await setup();
    const deployment = generateDeployment();
    const { channel: firstChannel } = await givenDeploymentClosedAlert(deployment);
    const { channel: secondChannel } = await givenDeploymentClosedAlert(deployment);

    await chainEvents.processDeploymentClosed(generateDeploymentClosedEvent(deployment));
    travel.by(HOLD_SECONDS);
    await closureAlerts.flush({ notificationChannelId: firstChannel.id });
    await closureAlerts.flush({ notificationChannelId: secondChannel.id });

    expect(emails().map(({ notificationChannelId }) => notificationChannelId)).toEqual([firstChannel.id, secondChannel.id]);
  });

  it("keeps a pending closure through a restart and sends it from the new process", async () => {
    const { chainEvents, travel, givenDeploymentClosedAlert } = await setup();
    const deployment = generateDeployment();
    const { channel } = await givenDeploymentClosedAlert(deployment);
    await chainEvents.processDeploymentClosed(generateDeploymentClosedEvent(deployment));

    const restarted = await setup();
    travel.by(HOLD_SECONDS);
    await restarted.closureAlerts.flush({ notificationChannelId: channel.id });

    expect(restarted.emails()).toHaveLength(1);
  });

  function generateDeployment() {
    return { owner: mockAkashAddress(), dseq: String(faker.number.int({ min: 1, max: 999999 })) };
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

  async function setup() {
    vi.useFakeTimers({ toFake: ["Date"], now: vi.isFakeTimers() ? Date.now() : new Date("2026-11-16T12:00:00.000Z") });
    const module = await Test.createTestingModule({ imports: [AlertEventsModule] }).compile();
    const brokerService = module.get(BrokerService);
    const publish = vi.spyOn(brokerService, "publish").mockResolvedValue(undefined);
    const db = module.get(DRIZZLE_PROVIDER_TOKEN);
    const providerHostUris = new Map<string, string>();
    nock(module.get(ConfigService).getOrThrow("API_NODE_ENDPOINT"))
      .persist()
      .get(/\/akash\/provider\/v1beta4\/providers\/[^/]+$/)
      .reply(uri => {
        const hostUri = providerHostUris.get(uri.split("/").at(-1) ?? "");
        return hostUri ? [200, { provider: { host_uri: hostUri } }] : [404, { code: 5, message: "provider not found" }];
      });
    onTestFinished(async () => {
      nock.cleanAll();
      vi.useRealTimers();
      await module.close();
    });

    const travel = {
      at: (seconds: number) => new Date(Date.now() + seconds * 1000),
      by: (seconds: number) => vi.setSystemTime(Date.now() + seconds * 1000),
      to: (date: Date) => vi.setSystemTime(date)
    };

    async function givenDeploymentClosedAlert(deployment: { owner: string; dseq: string }, notificationChannelId?: string) {
      const [channel] = notificationChannelId
        ? await db.select().from(NotificationChannel).where(eq(NotificationChannel.id, notificationChannelId))
        : await db
            .insert(NotificationChannel)
            .values([generateNotificationChannel({})])
            .returning();
      const [alert] = await db
        .insert(schema.Alert)
        .values([
          generateGeneralAlert({
            type: "CHAIN_EVENT",
            notificationChannelId: channel.id,
            params: { dseq: deployment.dseq, type: "DEPLOYMENT_CLOSED" },
            conditions: {
              operator: "and",
              value: [
                { field: "action", value: "deployment-closed", operator: "eq" },
                { field: "owner", value: deployment.owner, operator: "eq" },
                { field: "dseq", value: deployment.dseq, operator: "eq" }
              ]
            },
            summary: "Deployment {{{deployment.label}}} is now closed",
            description: "Please visit {{{deployment.link}}} to manage your deployment and re-deploy if needed."
          })
        ])
        .returning();

      return { alert, channel };
    }

    return {
      chainEvents: module.get(ChainEventsHandler),
      closureAlerts: module.get(ClosureAlertsHandler),
      emails: () =>
        publish.mock.calls.filter(([eventName]) => eventName === eventKeyRegistry.createNotification).map(([, message]) => message as NotificationCommandDto),
      feedEntries: () =>
        publish.mock.calls
          .filter(([eventName]) => eventName === eventKeyRegistry.addFeedEntries)
          .flatMap(([, message]) => (message as FeedEntriesCommandDto).feedEntries),
      flushJobs: () =>
        publish.mock.calls
          .filter(([eventName]) => eventName === eventKeyRegistry.closureAlertsDue)
          .map(([, message, options]) => ({ ...(message as { notificationChannelId: string }), singletonKey: options?.singletonKey, startAfter: options?.startAfter as Date })),
      holdNextPublish: () => {
        let release = () => {};
        publish.mockImplementationOnce(() => new Promise<void>(resolve => (release = resolve)));
        onTestFinished(() => release());
        return () => release();
      },
      db,
      travel,
      givenDeploymentClosedAlert,
      providerHostUris,
      consoleWebUrl: module.get(ConfigService).getOrThrow("alert.CONSOLE_WEB_URL")
    };
  }
});
