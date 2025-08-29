import type { UserOutput } from "@src/user/repositories";
import type { CreateNotificationInput } from "../notification/notification.service";

export function afterTrialEndsNotification(user: UserOutput): CreateNotificationInput {
  return {
    notificationId: `afterTrialEnds.${user.id}`,
    payload: {
      summary: "Your Free Trial is Over",
      description:
        "Your trial period with Akash Network has ended. To keep using the platform and access all features, please add fund payment method and top up your account."
    },
    user: {
      id: user.id,
      email: user.email
    }
  };
}
