import { faker } from "@faker-js/faker";
import { addDays, subMinutes } from "date-fns";
import nock from "nock";
import { container } from "tsyringe";
import { afterEach, describe, expect, it } from "vitest";

import { ApiKeyRepository } from "@src/auth/repositories/api-key/api-key.repository";
import { JOB_NAME } from "@src/core";
import { DeploymentConfigService } from "@src/deployment/services/deployment-config/deployment-config.service";
import { NOTIFICATIONS_CONFIG } from "@src/notifications/providers/notifications-config.provider";
import { ApiKeyExpiryReminderHandler, ApiKeyExpiryReminderJob } from "./api-key-expiry-reminder.handler";

import { seedOrganization } from "@test/seeders/db/organization.seeder";
import { seedUser } from "@test/seeders/db/user-with-wallet.seeder";
import { expectJobCompleted, useJobWorkers } from "@test/services/job-queue-harness";

const NOTIFICATION_PATH = "/internal/v1/jobs/notification";
const REMINDER_JOB = ApiKeyExpiryReminderJob[JOB_NAME];

const jobWorkers = useJobWorkers(() => [container.resolve(ApiKeyExpiryReminderHandler)]);

type SentNotification = {
  userId: string | undefined;
  body: { notificationId: string; payload: { summary: string; description: string; actions: { label: string; url: string }[] } };
};

describe(ApiKeyExpiryReminderHandler.name, () => {
  afterEach(() => {
    nock.cleanAll();
  });

  it("emails the owner which key expires when, linking to the API keys page of the key's organization", async () => {
    const { owner, seedApiKey, answerNotifications, remind } = await setup();
    const organization = await seedOrganization();
    const apiKey = await seedApiKey({ organizationId: organization.id });
    const notifications = answerNotifications();

    await remind({ apiKeyId: apiKey.id, expiresAt: apiKey.expiresAt!, daysBeforeExpiry: 7 });

    expect(notifications).toEqual([
      {
        userId: owner.id,
        body: expect.objectContaining({
          notificationId: `apiKeyExpiryReminder.${apiKey.id}.${apiKey.expiresAt}.7`,
          payload: expect.objectContaining({
            summary: `Your Akash Console API key "${apiKey.name}" expires in 7 days`,
            actions: [
              { label: "Manage API keys", url: `${container.resolve(DeploymentConfigService).get("DEPLOY_WEB_BASE_URL")}/user/api-keys?org=${organization.id}` }
            ]
          })
        })
      }
    ]);
  });

  it("links a key created before organizations to the API keys page as is", async () => {
    const { seedApiKey, answerNotifications, remind } = await setup();
    const apiKey = await seedApiKey();
    const notifications = answerNotifications();

    await remind({ apiKeyId: apiKey.id, expiresAt: apiKey.expiresAt!, daysBeforeExpiry: 30 });

    expect(notifications.map(({ body }) => body.payload.actions[0].url)).toEqual([
      `${container.resolve(DeploymentConfigService).get("DEPLOY_WEB_BASE_URL")}/user/api-keys`
    ]);
  });

  it("emails one reminder listing the keys of an organization that expire at the same time", async () => {
    const { owner, seedApiKey, answerNotifications, remind } = await setup();
    const organization = await seedOrganization();
    const expiresAt = addDays(new Date(), 200);
    const keys = [await seedApiKey({ organizationId: organization.id, expiresAt }), await seedApiKey({ organizationId: organization.id, expiresAt })];
    const personalKey = await seedApiKey({ expiresAt });
    const notifications = answerNotifications();

    for (const key of [...keys, personalKey]) {
      await remind({ apiKeyId: key.id, expiresAt: key.expiresAt!, daysBeforeExpiry: 7 });
    }

    const apiKeysUrl = `${container.resolve(DeploymentConfigService).get("DEPLOY_WEB_BASE_URL")}/user/api-keys`;
    const [teamReminder, personalReminder] = [`${apiKeysUrl}?org=${organization.id}`, apiKeysUrl].map(url =>
      notifications.find(({ body }) => body.payload.actions[0].url === url)
    );
    expect(notifications).toHaveLength(2);
    expect(teamReminder?.body.payload.summary).toBe("2 of your Akash Console API keys expire in 7 days");
    expect(keys.map(key => teamReminder?.body.payload.description.includes(key.keyFormat))).toEqual([true, true]);
    expect(personalReminder?.body.payload.summary).toBe(`Your Akash Console API key "${personalKey.name}" expires in 7 days`);
    expect(notifications.map(({ userId }) => userId)).toEqual([owner.id, owner.id]);
  });

  it("emails nothing for a key revoked since the reminder was scheduled", async () => {
    const { answerNotifications, remind } = await setup();
    const notifications = answerNotifications();

    await remind({ apiKeyId: faker.string.uuid(), expiresAt: addDays(new Date(), 30).toISOString(), daysBeforeExpiry: 30 });

    expect(notifications).toEqual([]);
  });

  it("emails nothing for a key whose expiry changed since the reminder was scheduled", async () => {
    const { seedApiKey, answerNotifications, remind } = await setup();
    const apiKey = await seedApiKey();
    const notifications = answerNotifications();

    await remind({ apiKeyId: apiKey.id, expiresAt: addDays(new Date(apiKey.expiresAt!), -90).toISOString(), daysBeforeExpiry: 30 });

    expect(notifications).toEqual([]);
  });

  it("emails nothing for a key that already expired", async () => {
    const { seedApiKey, answerNotifications, remind } = await setup();
    const apiKey = await seedApiKey({ expiresAt: subMinutes(new Date(), 1) });
    const notifications = answerNotifications();

    await remind({ apiKeyId: apiKey.id, expiresAt: apiKey.expiresAt!, daysBeforeExpiry: 1 });

    expect(notifications).toEqual([]);
  });

  it("emails nothing to an owner without an email", async () => {
    const { seedApiKey, answerNotifications, remind } = await setup({ ownerEmail: null });
    const apiKey = await seedApiKey();
    const notifications = answerNotifications();

    await remind({ apiKeyId: apiKey.id, expiresAt: apiKey.expiresAt!, daysBeforeExpiry: 1 });

    expect(notifications).toEqual([]);
  });

  async function setup(input: { ownerEmail?: string | null } = {}) {
    const { enqueue, startWorkers } = await jobWorkers();
    const notificationsBaseUrl = container.resolve(NOTIFICATIONS_CONFIG).NOTIFICATIONS_API_BASE_URL as string;
    const owner = await seedUser({ userId: faker.string.uuid(), email: input.ownerEmail === undefined ? faker.internet.email() : input.ownerEmail });

    async function seedApiKey(overrides: { organizationId?: string; expiresAt?: Date } = {}) {
      return await container.resolve(ApiKeyRepository).create({
        userId: owner.id,
        name: faker.word.noun(),
        hashedKey: faker.string.alphanumeric(64),
        keyFormat: `ac.sk.test.${faker.string.alphanumeric(6)}***${faker.string.alphanumeric(6)}`,
        expiresAt: overrides.expiresAt ?? addDays(new Date(), 200),
        organizationId: overrides.organizationId
      });
    }

    function answerNotifications() {
      const sent: SentNotification[] = [];
      nock(notificationsBaseUrl)
        .persist()
        .post(NOTIFICATION_PATH)
        .reply(function reply(this: nock.ReplyFnContext, _uri, body) {
          sent.push({ userId: this.req.headers["x-user-id"] as string | undefined, body: body as SentNotification["body"] });
          return [204];
        });

      return sent;
    }

    async function remind(data: ApiKeyExpiryReminderJob["data"]) {
      await enqueue(new ApiKeyExpiryReminderJob(data));
      await startWorkers();
      await expectJobCompleted(REMINDER_JOB, { data: { apiKeyId: data.apiKeyId } });
    }

    return { owner, seedApiKey, answerNotifications, remind };
  }
});
