import type { UserOutput } from "@src/user/repositories";
import type { CreateNotificationInput } from "../notification/notification.service";

export function trialEndedNotification(user: UserOutput, vars: { paymentLink: string }): CreateNotificationInput {
  return {
    notificationId: `trialEnded.${user.id}`,
    payload: {
      summary: "Your Free Trial Has Ended",
      description: `Your free trial with Akash Network has ended. To continue using the platform and accessing all features, please add a payment method and purchase some credits by visiting <a href="${vars.paymentLink}">Akash Console Payment Setup</a>.`
    },
    user: {
      id: user.id,
      email: user.email
    }
  };
}
