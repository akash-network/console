import type { UserOutput } from "@src/user/repositories";
import type { CreateNotificationInput } from "../notification/notification.service";

/**
 * `notificationId` carries the charge marker the claim wrote, so the broker's singleton key dedupes
 * retries of one attempt but still lets a card that starts failing again later be reported.
 */
export function autoTopUpChargeFailedNotification(user: UserOutput, vars: { chargeAttemptedAt: string; billingUrl: string }): CreateNotificationInput {
  return {
    notificationId: `autoTopUpChargeFailed.${user.id}.${vars.chargeAttemptedAt}`,
    payload: {
      summary: "We couldn't charge your card",
      description:
        `Your card was declined, so we couldn't add credits to your account automatically. ` +
        `We'll try again a few more times over the next several hours. If it keeps failing we'll stop and send you another email. ` +
        `Your deployments keep running on the credits you already have. ` +
        `<a href="${vars.billingUrl}">Update your payment method</a> if the card needs fixing.`
    },
    user: {
      id: user.id,
      email: user.email
    }
  };
}
