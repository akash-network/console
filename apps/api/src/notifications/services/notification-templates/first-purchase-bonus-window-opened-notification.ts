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
  }),
  gpu_win_back: closesOn => ({
    summary: `${percent} bonus credits, this week only`,
    description:
      `Come back to Akash Console with a bonus: buy ${minPurchase} or more in credits before ${closesOn} ` +
      `and get ${percent} in bonus credits, up to ${maxBonus}.`
  })
};

/** Only a win-back to a person who never paid opens without a deadline, since they keep the bonus until their first purchase. */
const NO_DEADLINE_COPY: WindowEmailCopy = {
  summary: "Your first purchase comes with bonus credits",
  description:
    `Ready for your next GPU deployment? Your first purchase of ${minPurchase} or more on Akash Console ` +
    `comes with ${percent} in bonus credits, up to ${maxBonus}.`
};

export function firstPurchaseBonusWindowOpenedNotification(
  user: UserOutput,
  vars: { reason: EmailedBonusWindowReason; closesAt: string | null; paymentLink: string }
): CreateNotificationInput {
  return {
    notificationId: `firstPurchaseBonusWindowOpened.${vars.reason}.${user.id}`,
    payload: {
      ...(vars.closesAt === null ? NO_DEADLINE_COPY : OPENED_COPY[vars.reason](formatWindowClose(vars.closesAt))),
      actions: [{ label: "Buy credits", url: vars.paymentLink }]
    },
    user: {
      id: user.id,
      email: user.email
    }
  };
}
