import { differenceInHours, subHours } from "date-fns";
import { singleton } from "tsyringe";

import type { ApiKeyOutput } from "@src/auth/repositories/api-key/api-key.repository";
import { type EnqueueOptions, JOB_NAME, JobQueueService } from "@src/core";
import { ApiKeyExpiryReminderJob } from "./api-key-expiry-reminder.handler";

const API_KEY_EXPIRY_REMINDER_DAYS = [30, 7, 1] as const;

const HOURS_PER_DAY = 24;

const REMINDER_RETRY_OPTIONS = {
  retryLimit: 8,
  retryBackoff: true,
  retryDelay: 60,
  retryDelayMax: 60 * 60
} satisfies EnqueueOptions;

@singleton()
export class ApiKeyExpiryReminderScheduler {
  constructor(private readonly jobQueueService: JobQueueService) {}

  async findScheduledReminders(): Promise<ReadonlySet<string>> {
    return await this.jobQueueService.findPendingSingletonKeys(ApiKeyExpiryReminderJob[JOB_NAME]);
  }

  /** A reminder needs a day more than its lead time left, so a 30-day key is not told right away that it has 30 days. */
  async schedule(
    apiKey: Pick<ApiKeyOutput, "id" | "expiresAt">,
    { alreadyScheduled = new Set() }: { alreadyScheduled?: ReadonlySet<string> } = {}
  ): Promise<number> {
    if (!apiKey.expiresAt) return 0;

    const expiresAt = new Date(apiKey.expiresAt);
    const hoursLeft = differenceInHours(expiresAt, new Date());
    const reminders = API_KEY_EXPIRY_REMINDER_DAYS.filter(days => hoursLeft >= (days + 1) * HOURS_PER_DAY)
      .map(daysBeforeExpiry => ({ daysBeforeExpiry, singletonKey: `apiKeyExpiryReminder.${apiKey.id}.${apiKey.expiresAt}.${daysBeforeExpiry}` }))
      .filter(({ singletonKey }) => !alreadyScheduled.has(singletonKey));

    for (const { daysBeforeExpiry, singletonKey } of reminders) {
      await this.jobQueueService.enqueue(new ApiKeyExpiryReminderJob({ apiKeyId: apiKey.id, expiresAt: apiKey.expiresAt, daysBeforeExpiry }), {
        ...REMINDER_RETRY_OPTIONS,
        singletonKey,
        startAfter: subHours(expiresAt, daysBeforeExpiry * HOURS_PER_DAY)
      });
    }

    return reminders.length;
  }
}
