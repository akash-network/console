import "@src/app/providers/jobs.provider";

import { faker } from "@faker-js/faker";
import { addDays, subDays } from "date-fns";
import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import { ApiKeyRepository } from "@src/auth/repositories/api-key/api-key.repository";
import { ApiKeyExpiryReminderHandler, ApiKeyExpiryReminderJob } from "@src/auth/services/api-key-expiry-reminder/api-key-expiry-reminder.handler";
import { ApiKeyExpiryReminderScheduler } from "@src/auth/services/api-key-expiry-reminder/api-key-expiry-reminder-scheduler.service";
import { JOB_NAME } from "@src/core";
import { DeploymentConfigService } from "@src/deployment/services/deployment-config/deployment-config.service";
import { NotificationHandler, NotificationJob } from "@src/notifications/services/notification-handler/notification.handler";
import { ApiKeyExpiryBackfillService } from "./api-key-expiry-backfill.service";

import { seedOrganization } from "@test/seeders/db/organization.seeder";
import { seedUser } from "@test/seeders/db/user-with-wallet.seeder";
import { findJobRows, useJobWorkers } from "@test/services/job-queue-harness";

const jobWorkers = useJobWorkers(() => [container.resolve(NotificationHandler), container.resolve(ApiKeyExpiryReminderHandler)]);

describe(ApiKeyExpiryBackfillService.name, () => {
  it("gives each key without an expiration one a year out, schedules its reminders and queues one email per owner and organization", async () => {
    const { service, seedOwner, seedApiKey, findApiKey, findReminderDays } = await setup();
    const owner = await seedOwner();
    const organization = await seedOrganization();
    const [ci, deploy] = [await seedApiKey(owner.id, { name: "ci" }), await seedApiKey(owner.id, { name: "deploy" })];
    const teamKey = await seedApiKey(owner.id, { name: "team", organizationId: organization.id });
    const otherOwner = await seedOwner();
    const otherKey = await seedApiKey(otherOwner.id);

    const report = await service.backfill({ apply: true });

    expect(report).toMatchObject({ apply: true });
    expect(new Date(report.expiresAt).getTime()).toBeGreaterThan(addDays(new Date(), 364).getTime());
    expect(report.keysAssigned).toBe(report.keysWithoutExpiry);
    for (const key of [ci, deploy, teamKey, otherKey]) {
      const stored = await findApiKey(key.id);
      expect(stored?.expiresAt).toBe(report.expiresAt);
      expect(new Date(stored!.updatedAt).getTime()).toBeGreaterThan(new Date(key.updatedAt).getTime());
      expect(await findReminderDays(key.id)).toEqual([30, 7, 1]);
    }
    const apiKeysUrl = `${container.resolve(DeploymentConfigService).get("DEPLOY_WEB_BASE_URL")}/user/api-keys`;
    const emails = await findJobRows<NotificationJob<"apiKeysExpiryAssigned">["data"]>(NotificationJob[JOB_NAME], { data: { userId: owner.id } });
    expect(emails.map(({ data }) => data.vars)).toEqual(
      expect.arrayContaining([
        {
          organizationId: null,
          keys: expect.arrayContaining([
            { name: "ci", keyFormat: ci.keyFormat },
            { name: "deploy", keyFormat: deploy.keyFormat }
          ]),
          expiresAt: report.expiresAt,
          apiKeysUrl
        },
        {
          organizationId: organization.id,
          keys: [{ name: "team", keyFormat: teamKey.keyFormat }],
          expiresAt: report.expiresAt,
          apiKeysUrl: `${apiKeysUrl}?org=${organization.id}`
        }
      ])
    );
    expect(emails).toHaveLength(2);
    expect(await findJobRows(NotificationJob[JOB_NAME], { data: { userId: otherOwner.id } })).toHaveLength(1);
  });

  it("schedules the reminders missing from keys that already expire, leaving the queued ones alone", async () => {
    const { service, seedOwner, seedApiKey, findApiKey, findReminderDays } = await setup();
    const owner = await seedOwner();
    const unreminded = await seedApiKey(owner.id, { expiresAt: addDays(new Date(), 100) });
    const expiringSoon = await seedApiKey(owner.id, { expiresAt: addDays(new Date(), 20) });
    const reminded = await seedApiKey(owner.id, { expiresAt: addDays(new Date(), 100) });
    await container.resolve(ApiKeyExpiryReminderScheduler).schedule(reminded);

    const report = await service.backfill({ apply: true });

    expect(report.remindersScheduled).toBe(5);
    expect(await findReminderDays(unreminded.id)).toEqual([30, 7, 1]);
    expect(await findReminderDays(expiringSoon.id)).toEqual([7, 1]);
    expect(await findReminderDays(reminded.id)).toEqual([30, 7, 1]);
    expect((await findApiKey(unreminded.id))?.expiresAt).toBe(unreminded.expiresAt);
    expect(await findJobRows(NotificationJob[JOB_NAME], { data: { userId: owner.id } })).toEqual([]);
  });

  it("only counts the keys on a dry run", async () => {
    const { service, seedOwner, seedApiKey, findApiKey, findReminderDays } = await setup();
    const owner = await seedOwner();
    const key = await seedApiKey(owner.id);
    const expiringKey = await seedApiKey(owner.id, { expiresAt: addDays(new Date(), 100) });

    const report = await service.backfill({ apply: false });

    expect(report).toMatchObject({ apply: false, keysAssigned: 0, remindersScheduled: 0 });
    expect(report.keysWithoutExpiry).toBeGreaterThanOrEqual(1);
    expect(report.keysWithExpiry).toBeGreaterThanOrEqual(1);
    expect((await findApiKey(key.id))?.expiresAt).toBeNull();
    expect(await findJobRows(NotificationJob[JOB_NAME], { data: { userId: owner.id } })).toEqual([]);
    expect(await findReminderDays(key.id)).toEqual([]);
    expect(await findReminderDays(expiringKey.id)).toEqual([]);
  });

  it("finds nothing left to assign or remind on a second run", async () => {
    const { service, seedOwner, seedApiKey, findReminderDays } = await setup();
    const owner = await seedOwner();
    const key = await seedApiKey(owner.id);
    await service.backfill({ apply: true });

    const report = await service.backfill({ apply: true });

    expect(report).toMatchObject({ owners: 0, keysWithoutExpiry: 0, keysAssigned: 0, remindersScheduled: 0 });
    expect(await findReminderDays(key.id)).toEqual([30, 7, 1]);
    expect(await findJobRows(NotificationJob[JOB_NAME], { data: { userId: owner.id } })).toHaveLength(1);
  });

  async function setup() {
    await jobWorkers();
    const apiKeyRepository = container.resolve(ApiKeyRepository);

    async function seedOwner() {
      return await seedUser({ userId: faker.string.uuid(), email: faker.internet.email() });
    }

    async function seedApiKey(userId: string, overrides: { name?: string; expiresAt?: Date; organizationId?: string } = {}) {
      return await apiKeyRepository.create({
        userId,
        organizationId: overrides.organizationId,
        name: overrides.name ?? faker.word.noun(),
        hashedKey: faker.string.alphanumeric(64),
        keyFormat: `ac.sk.test.${faker.string.alphanumeric(6)}***${faker.string.alphanumeric(6)}`,
        expiresAt: overrides.expiresAt ?? null,
        updatedAt: subDays(new Date(), 30)
      });
    }

    async function findApiKey(id: string) {
      return await apiKeyRepository.findById(id);
    }

    async function findReminderDays(apiKeyId: string) {
      const reminders = await findJobRows<ApiKeyExpiryReminderJob["data"]>(ApiKeyExpiryReminderJob[JOB_NAME], { data: { apiKeyId } });

      return reminders.map(({ data }) => data.daysBeforeExpiry).sort((a, b) => b - a);
    }

    return { service: container.resolve(ApiKeyExpiryBackfillService), seedOwner, seedApiKey, findApiKey, findReminderDays };
  }
});
