import type { UserOutput } from "@src/user/repositories";
import type { CreateNotificationInput } from "../notification/notification.service";

export function reviewTrialRejectedNotification(user: UserOutput): CreateNotificationInput {
  return {
    notificationId: `reviewTrialRejected.${user.id}`,
    payload: {
      summary: "Trial review update",
      description: "Unfortunately, your trial could not be approved. Active deployments have been closed. " + "Contact support if you believe this is an error."
    },
    user: {
      id: user.id,
      email: user.email
    }
  };
}
