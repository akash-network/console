import "@src/app/providers/jobs.provider";

import { faker } from "@faker-js/faker";
import { addDays } from "date-fns";
import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import { ApiKeyRepository } from "@src/auth/repositories/api-key/api-key.repository";
import { ApiKeyExpiryReminderHandler, ApiKeyExpiryReminderJob } from "@src/auth/services/api-key-expiry-reminder/api-key-expiry-reminder.handler";
import { JOB_NAME } from "@src/core";
import { DeploymentConfigService } from "@src/deployment/services/deployment-config/deployment-config.service";
import { NotificationHandler, NotificationJob } from "@src/notifications/services/notification-handler/notification.handler";
import { ApiKeyExpiryBackfillService } from "./api-key-expiry-backfill.service";

import { seedUser } from "@test/seeders/db/user-with-wallet.seeder";
import { findJobRows, useJobWorkers } from "@test/services/job-queue-harness";

const jobWorkers = useJobWorkers(() => [container.resolve(NotificationHandler), container.resolve(ApiKeyExpiryReminderHandler)]);

describe(ApiKeyExpiryBackfillService.name, () => {
  it("gives each key without an expiration one a year out, schedules its reminders and queues one email per owner", async () => {
    const { service, seedOwner, seedApiKey, findApiKey } = await setup();
    const owner = await seedOwner();
    const [ci, deploy] = [await seedApiKey(owner.id, { name: "ci" }), await seedApiKey(owner.id, { name: "deploy" })];
    const expiring = await seedApiKey(owner.id, { expiresAt: addDays(new Date(), 30) });
    const otherOwner = await seedOwner();
    const otherKey = await seedApiKey(otherOwner.id);

    const report = await service.backfill({ apply: true });

    expect(report).toMatchObject({ apply: true });
    expect(new Date(report.expiresAt).getTime()).toBeGreaterThan(addDays(new Date(), 364).getTime());
    expect(report.keysAssigned).toBe(report.keysWithoutExpiry);
    for (const key of [ci, deploy, otherKey]) {
      expect((await findApiKey(key.id))?.expiresAt).toBe(report.expiresAt);
      const reminders = await findJobRows<ApiKeyExpiryReminderJob["data"]>(ApiKeyExpiryReminderJob[JOB_NAME], { data: { apiKeyId: key.id } });
      expect(reminders.map(({ data }) => data.daysBeforeExpiry).sort((a, b) => b - a)).toEqual([30, 7, 1]);
    }
    expect((await findApiKey(expiring.id))?.expiresAt).toBe(expiring.expiresAt);
    const emails = await findJobRows<NotificationJob<"apiKeysExpiryAssigned">["data"]>(NotificationJob[JOB_NAME], { data: { userId: owner.id } });
    expect(emails.map(({ data }) => data)).toEqual([
      expect.objectContaining({
        template: "apiKeysExpiryAssigned",
        userId: owner.id,
        vars: {
          keys: expect.arrayContaining([
            { name: "ci", keyFormat: ci.keyFormat },
            { name: "deploy", keyFormat: deploy.keyFormat }
          ]),
          expiresAt: report.expiresAt,
          apiKeysUrl: `${container.resolve(DeploymentConfigService).get("DEPLOY_WEB_BASE_URL")}/user/api-keys`
        }
      })
    ]);
    expect(await findJobRows(NotificationJob[JOB_NAME], { data: { userId: otherOwner.id } })).toHaveLength(1);
  });

  it("only counts the keys without an expiration on a dry run", async () => {
    const { service, seedOwner, seedApiKey, findApiKey } = await setup();
    const owner = await seedOwner();
    const key = await seedApiKey(owner.id);

    const report = await service.backfill({ apply: false });

    expect(report).toMatchObject({ apply: false, keysAssigned: 0 });
    expect(report.keysWithoutExpiry).toBeGreaterThanOrEqual(1);
    expect((await findApiKey(key.id))?.expiresAt).toBeNull();
    expect(await findJobRows(NotificationJob[JOB_NAME], { data: { userId: owner.id } })).toEqual([]);
    expect(await findJobRows(ApiKeyExpiryReminderJob[JOB_NAME], { data: { apiKeyId: key.id } })).toEqual([]);
  });

  it("finds nothing left to assign on a second run", async () => {
    const { service, seedOwner, seedApiKey } = await setup();
    const owner = await seedOwner();
    await seedApiKey(owner.id);
    await service.backfill({ apply: true });

    const report = await service.backfill({ apply: true });

    expect(report).toMatchObject({ owners: 0, keysWithoutExpiry: 0, keysAssigned: 0 });
    expect(await findJobRows(NotificationJob[JOB_NAME], { data: { userId: owner.id } })).toHaveLength(1);
  });

  async function setup() {
    await jobWorkers();
    const apiKeyRepository = container.resolve(ApiKeyRepository);

    async function seedOwner() {
      return await seedUser({ userId: faker.string.uuid(), email: faker.internet.email() });
    }

    async function seedApiKey(userId: string, overrides: { name?: string; expiresAt?: Date } = {}) {
      return await apiKeyRepository.create({
        userId,
        name: overrides.name ?? faker.word.noun(),
        hashedKey: faker.string.alphanumeric(64),
        keyFormat: `ac.sk.test.${faker.string.alphanumeric(6)}***${faker.string.alphanumeric(6)}`,
        expiresAt: overrides.expiresAt ?? null
      });
    }

    async function findApiKey(id: string) {
      return await apiKeyRepository.findById(id);
    }

    return { service: container.resolve(ApiKeyExpiryBackfillService), seedOwner, seedApiKey, findApiKey };
  }
});
