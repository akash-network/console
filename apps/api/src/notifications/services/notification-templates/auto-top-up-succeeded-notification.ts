import type { UserOutput } from "@src/user/repositories";
import type { CreateNotificationInput } from "../notification/notification.service";

export function autoTopUpSucceededNotification(
  user: UserOutput,
  vars: { transactionId: string; amountCents: number; balanceUsd: number; billingUrl: string }
): CreateNotificationInput {
  const formatter = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
  const amount = formatter.format(vars.amountCents / 100);
  const balance = formatter.format(vars.balanceUsd);
  return {
    // Deterministic per settled transaction: the broker treats this as a singletonKey, so a job retry that
    // reaches the handler twice still yields a single notification.
    notificationId: `autoTopUpSucceeded.${vars.transactionId}`,
    payload: {
      summary: `Your Akash account was topped up ${amount}`,
      description:
        `We automatically charged your default payment method ${amount} to keep your Akash Network balance above your auto top-up threshold. ` +
        `Your available balance is now <strong>${balance}</strong>. ` +
        `<a href="${vars.billingUrl}">View your billing</a>.`
    },
    user: {
      id: user.id,
      email: user.email
    }
  };
}
