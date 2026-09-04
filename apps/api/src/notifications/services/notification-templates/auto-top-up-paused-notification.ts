import type { UserOutput } from "@src/user/repositories";
import type { CreateNotificationInput } from "../notification/notification.service";

/**
 * `notificationId` carries the pause timestamp so the broker's singleton key dedupes retries within
 * one pause but still lets a wallet that pauses again later be told about it.
 */
export function autoTopUpPausedNotification(user: UserOutput, vars: { pausedAt: Date; billingUrl: string }): CreateNotificationInput {
  return {
    notificationId: `autoTopUpPaused.${user.id}.${vars.pausedAt.toISOString()}`,
    payload: {
      summary: "Auto top-up is paused",
      description:
        `Your card was declined several times, so we've stopped trying to charge it. ` +
        `Your deployments will keep running until your credits run out, but nothing will be added automatically. ` +
        `Once you update your payment method, auto top-up starts again on its own.`,
      actions: [{ label: "Update payment method", url: vars.billingUrl }]
    },
    user: {
      id: user.id,
      email: user.email
    }
  };
}
