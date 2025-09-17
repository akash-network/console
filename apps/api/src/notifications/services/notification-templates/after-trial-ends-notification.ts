import type { UserOutput } from "@src/user/repositories";
import type { CreateNotificationInput } from "../notification/notification.service";

export function afterTrialEndsNotification(user: UserOutput, vars: { paymentLink: string }): CreateNotificationInput {
  return {
    notificationId: `afterTrialEnds.${user.id}`,
    payload: {
      summary: "Add payment info to continue using Akash",
      description: `Your trial period with Akash Network has ended. To keep using the platform and access all features, please add a payment method and top up your account by visiting <a href="${vars.paymentLink}">Akash Console Payment Setup</a>`
    },
    user: {
      id: user.id,
      email: user.email
    }
  };
}
