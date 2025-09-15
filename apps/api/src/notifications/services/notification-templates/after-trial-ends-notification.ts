import type { UserOutput } from "@src/user/repositories";
import type { CreateNotificationInput } from "../notification/notification.service";

export function afterTrialEndsNotification(user: UserOutput): CreateNotificationInput {
  return {
    notificationId: `afterTrialEnds.${user.id}`,
    payload: {
      summary: "Add payment info to continue using Akash",
      description:
        "Your trial period with Akash Network has ended. To keep using the platform and access all features, please add a payment method and top up your account by visiting <insert link to payment page>."
    },
    user: {
      id: user.id,
      email: user.email
    }
  };
}
