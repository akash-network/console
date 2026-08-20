import { centsToUsd } from "@src/billing/lib/currency/currency";
import type { UserOutput } from "@src/user/repositories";
import type { CreateNotificationInput } from "../notification/notification.service";

/**
 * `notificationId` is deterministic per settled transaction, so the broker treats it as a singletonKey —
 * a job retry that reaches the handler twice still yields a single notification.
 */
export function autoRechargeSucceededNotification(
  user: UserOutput,
  vars: { transactionId: string; amountCents: number; balanceUsd: number; billingUrl: string }
): CreateNotificationInput {
  const formatter = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
  const amount = formatter.format(centsToUsd(vars.amountCents));
  const balance = formatter.format(vars.balanceUsd);
  return {
    notificationId: `autoRechargeSucceeded.${vars.transactionId}`,
    payload: {
      summary: `Your Akash account was recharged ${amount}`,
      description:
        `We automatically charged your default payment method ${amount} to keep your deployments running. ` +
        `Your available balance is now <strong>${balance}</strong>. ` +
        `<a href="${vars.billingUrl}">View your billing</a>.`
    },
    user: {
      id: user.id,
      email: user.email
    }
  };
}
