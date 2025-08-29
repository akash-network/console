import type { UserOutput } from "@src/user/repositories";
import type { CreateNotificationInput } from "../notification/notification.service";

export function trialEndedNotification(user: UserOutput): CreateNotificationInput {
  return {
    notificationId: `trialEnded.${user.id}`,
    payload: {
      summary: "Your Free Trial Has Ended",
      description:
        "Your free trial with Akash Network has ended. To continue using the platform and accessing all features, please add a payment method and upgrade your account."
    },
    user: {
      id: user.id,
      email: user.email
    }
  };
}
