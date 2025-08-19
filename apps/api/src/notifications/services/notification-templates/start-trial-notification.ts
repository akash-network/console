import type { UserOutput } from "@src/user/repositories";
import type { CreateNotificationInput } from "../notification/notification.service";

export function startTrialNotification(user: UserOutput): CreateNotificationInput {
  return {
    notificationId: `startTrial.${user.id}`,
    payload: {
      summary: "Start Trial",
      description: "You have started a trial of Akash Network"
    },
    user: {
      id: user.id,
      email: user.email
    }
  };
}
