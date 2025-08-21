import type { UserOutput } from "@src/user/repositories";
import type { CreateNotificationInput } from "../notification/notification.service";

export function trialEndedNotification(user: UserOutput): CreateNotificationInput {
  return {
    notificationId: `trialEnded.${user.id}`,
    payload: {
      summary: "Trial Ended",
      description: "Your trial of Akash Network has ended"
    },
    user: {
      id: user.id,
      email: user.email
    }
  };
}
