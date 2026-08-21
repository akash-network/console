import type { UserOutput } from "@src/user/repositories";
import type { CreateNotificationInput } from "../notification/notification.service";

export function creditsRunningLowNotification(
  user: UserOutput,
  vars: { balanceUsd: number; weeklyCostUsd: number; daysRemaining: number; paymentLink: string; billingUrl: string }
): CreateNotificationInput {
  const formatter = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
  const balance = formatter.format(vars.balanceUsd);
  const coverage = vars.daysRemaining < 1 ? "less than a day" : `${vars.daysRemaining} day${vars.daysRemaining === 1 ? "" : "s"}`;

  return {
    notificationId: `creditsRunningLow.${user.id}`,
    payload: {
      summary: "Your Akash credits are running low",
      description:
        `Your remaining credits are <strong>${balance}</strong>, about ${coverage} of current usage. ` +
        `Add credits or turn on Auto Recharge to keep your deployments running. ` +
        `<a href="${vars.paymentLink}">Add credits</a> or ` +
        `<a href="${vars.billingUrl}">enable Auto Recharge</a>.`
    },
    user: { id: user.id, email: user.email }
  };
}
