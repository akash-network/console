import type { UserOutput } from "@src/user/repositories";
import type { CreateNotificationInput } from "../notification/notification.service";

export function reviewTrialRejectedNotification(user: UserOutput): CreateNotificationInput {
  return {
    notificationId: `reviewTrialRejected.${user.id}`,
    payload: {
      summary: "Trial review update",
      description:
        "Unfortunately, your trial could not be approved. Active deployments have been closed. " +
        'If you believe this is an error, please contact us at <a href="mailto:support@akash.network">support@akash.network</a>.'
    },
    user: {
      id: user.id,
      email: user.email
    }
  };
}
