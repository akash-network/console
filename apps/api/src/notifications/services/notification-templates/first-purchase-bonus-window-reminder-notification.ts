import type { EmailedBonusWindowReason } from "@src/billing/events/first-purchase-bonus-window-opened";
import type { UserOutput } from "@src/user/repositories";
import type { CreateNotificationInput } from "../notification/notification.service";
import { BONUS_TERMS, formatWindowClose, type WindowEmailCopy } from "./first-purchase-bonus-window-terms";

const { minPurchase, percent, maxBonus } = BONUS_TERMS;

const REMINDER_COPY: Record<EmailedBonusWindowReason, (closesOn: string) => WindowEmailCopy> = {
  small_first_purchase: closesOn => ({
    summary: "2 days left to get your first-purchase bonus",
    description:
      `Your first-purchase bonus ends on ${closesOn}. ` +
      `Buy ${minPurchase} or more in credits before then and we'll add ${percent} in bonus credits, up to ${maxBonus}.`
  })
};

export function firstPurchaseBonusWindowReminderNotification(
  user: UserOutput,
  vars: { reason: EmailedBonusWindowReason; closesAt: string; paymentLink: string }
): CreateNotificationInput {
  return {
    notificationId: `firstPurchaseBonusWindowReminder.${vars.reason}.${user.id}`,
    payload: {
      ...REMINDER_COPY[vars.reason](formatWindowClose(vars.closesAt)),
      actions: [{ label: "Buy credits", url: vars.paymentLink }]
    },
    user: {
      id: user.id,
      email: user.email
    }
  };
}
