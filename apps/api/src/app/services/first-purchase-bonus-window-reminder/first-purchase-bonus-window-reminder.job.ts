import { subDays } from "date-fns";

import type { EmailedBonusWindowReason } from "@src/billing/events/first-purchase-bonus-window-opened";
import { type EnqueueOptions, type Job, JOB_NAME } from "@src/core";

const REMINDER_DAYS_BEFORE_WINDOW_CLOSES: Record<EmailedBonusWindowReason, number> = {
  small_first_purchase: 2,
  gpu_win_back: 1
};

export class FirstPurchaseBonusWindowReminderJob implements Job {
  static readonly [JOB_NAME] = "FirstPurchaseBonusWindowReminderJob";
  readonly name = FirstPurchaseBonusWindowReminderJob[JOB_NAME];
  readonly version = 1;

  constructor(public readonly data: { userId: string; reason: EmailedBonusWindowReason; closesAt: string }) {}
}

export function firstPurchaseBonusWindowRemindAt(reason: EmailedBonusWindowReason, closesAt: Date): Date {
  return subDays(closesAt, REMINDER_DAYS_BEFORE_WINDOW_CLOSES[reason]);
}

export function firstPurchaseBonusWindowReminderOptionsFor({ userId, reason, closesAt }: FirstPurchaseBonusWindowReminderJob["data"]): EnqueueOptions {
  return {
    singletonKey: `firstPurchaseBonusWindowReminder.${reason}.${userId}`,
    startAfter: firstPurchaseBonusWindowRemindAt(reason, new Date(closesAt))
  };
}
