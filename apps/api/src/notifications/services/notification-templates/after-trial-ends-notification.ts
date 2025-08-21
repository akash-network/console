import type { UserOutput } from "@src/user/repositories";
import type { CreateNotificationInput } from "../notification/notification.service";

export function afterTrialEndsNotification(user: UserOutput): CreateNotificationInput {
  return {
    notificationId: `afterTrialEnds.${user.id}`,
    payload: {
      summary: "Your Trial Has Ended",
      description: "Your trial of Akash Network has ended. Please upgrade to continue using the platform."
    },
    user: {
      id: user.id,
      email: user.email
    }
  };
}
