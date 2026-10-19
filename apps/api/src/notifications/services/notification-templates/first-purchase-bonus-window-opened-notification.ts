import type { EmailedBonusWindowReason } from "@src/billing/events/first-purchase-bonus-window-opened";
import type { UserOutput } from "@src/user/repositories";
import type { CreateNotificationInput } from "../notification/notification.service";
import { BONUS_TERMS, formatWindowClose, type WindowEmailCopy } from "./first-purchase-bonus-window-terms";

const { minPurchase, percent, maxBonus } = BONUS_TERMS;

const OPENED_COPY: Record<EmailedBonusWindowReason, (closesOn: string) => WindowEmailCopy> = {
  small_first_purchase: closesOn => ({
    summary: "Your first-purchase bonus is still available",
    description:
      `Thanks for your first purchase on Akash Console! Your first-purchase bonus is still open until ${closesOn}: ` +
      `buy ${minPurchase} or more by then and get ${percent} in bonus credits, up to ${maxBonus}.`
  })
};

export function firstPurchaseBonusWindowOpenedNotification(
  user: UserOutput,
  vars: { reason: EmailedBonusWindowReason; closesAt: string; paymentLink: string }
): CreateNotificationInput {
  return {
    notificationId: `firstPurchaseBonusWindowOpened.${vars.reason}.${user.id}`,
    payload: {
      ...OPENED_COPY[vars.reason](formatWindowClose(vars.closesAt)),
      actions: [{ label: "Buy credits", url: vars.paymentLink }]
    },
    user: {
      id: user.id,
      email: user.email
    }
  };
}
