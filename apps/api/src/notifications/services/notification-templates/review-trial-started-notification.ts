import type { UserOutput } from "@src/user/repositories";
import type { CreateNotificationInput } from "../notification/notification.service";

export function reviewTrialStartedNotification(user: UserOutput): CreateNotificationInput {
  return {
    notificationId: `reviewTrialStarted.${user.id}`,
    payload: {
      summary: "Welcome - your account is under review",
      description:
        "Your account is under review. You've been granted $10 in trial credits while we verify your payment. " +
        "You'll receive an email once the review is complete."
    },
    user: {
      id: user.id,
      email: user.email
    }
  };
}
