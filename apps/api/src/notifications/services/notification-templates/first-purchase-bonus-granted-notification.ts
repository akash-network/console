import type { UserOutput } from "@src/user/repositories";
import type { CreateNotificationInput } from "../notification/notification.service";

export function firstPurchaseBonusGrantedNotification(user: UserOutput, vars: { bonusAmountCents: number; paidAmountCents: number }): CreateNotificationInput {
  const formatter = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
  const bonus = formatter.format(vars.bonusAmountCents / 100);
  const paid = formatter.format(vars.paidAmountCents / 100);
  return {
    // Deterministic: the bonus is granted once per user, and the broker treats this as a singletonKey.
    notificationId: `firstPurchaseBonusGranted.${user.id}`,
    payload: {
      summary: `You earned ${bonus} in bonus credits`,
      description:
        `Thanks for your first purchase of ${paid} with Akash Network! ` +
        `We've added <strong>${bonus}</strong> in bonus credits to your account on top of the credits you purchased. ` +
        `They're already in your balance and ready to power your deployments.`
    },
    user: {
      id: user.id,
      email: user.email
    }
  };
}
