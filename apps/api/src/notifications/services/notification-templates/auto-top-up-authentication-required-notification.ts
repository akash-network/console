import type { UserOutput } from "@src/user/repositories";
import type { CreateNotificationInput } from "../notification/notification.service";

/** Links to Add Funds rather than payment methods: paying by hand is the one flow where the user is present to confirm with the bank. */
export function autoTopUpAuthenticationRequiredNotification(user: UserOutput, vars: { pausedAt: Date; paymentUrl: string }): CreateNotificationInput {
  return {
    notificationId: `autoTopUpAuthenticationRequired.${user.id}.${vars.pausedAt.toISOString()}`,
    payload: {
      summary: "Auto top-up needs a card we can charge without you",
      description:
        `Your bank wants you to confirm our last automatic charge, and we can't do that for you while you're away, so we've paused auto top-up rather than keep trying. ` +
        `Your deployments keep running on the credits you already have. ` +
        `To add credits now, add funds yourself and confirm the payment when your bank asks. ` +
        `Auto top-up starts again once you set a card that doesn't ask for confirmation as your default payment method.`,
      actions: [{ label: "Add funds", url: vars.paymentUrl }]
    },
    user: {
      id: user.id,
      email: user.email
    }
  };
}
