import { BONUS_PERCENT, MAX_BONUS_CENTS, MIN_QUALIFYING_AMOUNT_CENTS } from "@src/billing/services/first-purchase-bonus/first-purchase-bonus.service";
import type { CreateNotificationInput } from "../notification/notification.service";

export type WindowEmailCopy = Pick<CreateNotificationInput["payload"], "summary" | "description">;

export const BONUS_TERMS = {
  minPurchase: `$${MIN_QUALIFYING_AMOUNT_CENTS / 100}`,
  percent: `${BONUS_PERCENT}%`,
  maxBonus: `$${MAX_BONUS_CENTS / 100}`
};

const WINDOW_CLOSE_FORMAT = new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeStyle: "short", timeZone: "UTC", hourCycle: "h23" });

export function formatWindowClose(closesAt: string): string {
  return `${WINDOW_CLOSE_FORMAT.format(new Date(closesAt))} UTC`;
}
