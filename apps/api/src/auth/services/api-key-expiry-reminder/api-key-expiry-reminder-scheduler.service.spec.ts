import { faker } from "@faker-js/faker";
import { describe, expect, it, onTestFinished, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { JobQueueService } from "@src/core";
import { ApiKeyExpiryReminderJob } from "./api-key-expiry-reminder.handler";
import { ApiKeyExpiryReminderScheduler } from "./api-key-expiry-reminder-scheduler.service";

const RETRY_OPTIONS = { retryLimit: 8, retryBackoff: true, retryDelay: 60, retryDelayMax: 3600 };

describe(ApiKeyExpiryReminderScheduler.name, () => {
  it("schedules reminders 30, 7 and 1 day before a one-year key expires", async () => {
    const { scheduler, jobQueueService } = setup();
    const apiKey = { id: faker.string.uuid(), expiresAt: "2027-10-18T12:00:00.000Z" };

    await scheduler.schedule(apiKey);

    expect(jobQueueService.enqueue.mock.calls).toEqual([
      [
        new ApiKeyExpiryReminderJob({ apiKeyId: apiKey.id, expiresAt: apiKey.expiresAt, daysBeforeExpiry: 30 }),
        { ...RETRY_OPTIONS, startAfter: new Date("2027-09-18T12:00:00.000Z") }
      ],
      [
        new ApiKeyExpiryReminderJob({ apiKeyId: apiKey.id, expiresAt: apiKey.expiresAt, daysBeforeExpiry: 7 }),
        { ...RETRY_OPTIONS, startAfter: new Date("2027-10-11T12:00:00.000Z") }
      ],
      [
        new ApiKeyExpiryReminderJob({ apiKeyId: apiKey.id, expiresAt: apiKey.expiresAt, daysBeforeExpiry: 1 }),
        { ...RETRY_OPTIONS, startAfter: new Date("2027-10-17T12:00:00.000Z") }
      ]
    ]);
  });

  it("skips the reminder whose lead time is the key's whole lifetime", async () => {
    const { scheduler, jobQueueService } = setup();

    await scheduler.schedule({ id: faker.string.uuid(), expiresAt: "2026-11-17T12:05:00.000Z" });

    expect(jobQueueService.enqueue.mock.calls.map(([job]) => job.data.daysBeforeExpiry)).toEqual([7, 1]);
  });

  it("schedules the reminder for a key with one day more than its lead time", async () => {
    const { scheduler, jobQueueService } = setup();

    await scheduler.schedule({ id: faker.string.uuid(), expiresAt: "2026-11-18T12:00:00.000Z" });

    expect(jobQueueService.enqueue.mock.calls.map(([job]) => job.data.daysBeforeExpiry)).toEqual([30, 7, 1]);
  });

  it("schedules nothing for a key without an expiry", async () => {
    const { scheduler, jobQueueService } = setup();

    await scheduler.schedule({ id: faker.string.uuid(), expiresAt: null });

    expect(jobQueueService.enqueue).not.toHaveBeenCalled();
  });

  function setup() {
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-10-18T12:00:00.000Z") });
    onTestFinished(() => {
      vi.useRealTimers();
    });
    const jobQueueService = mock<JobQueueService>();
    const scheduler = new ApiKeyExpiryReminderScheduler(jobQueueService);

    return { scheduler, jobQueueService };
  }
});
