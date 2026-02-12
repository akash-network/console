import type { UserOutput } from "@src/user/repositories";
import type { CreateNotificationInput } from "../notification/notification.service";

export function reviewTrialApprovedNotification(user: UserOutput, vars: { trialEndsAt: string; initialCredits: number }): CreateNotificationInput {
  const trialEndsAt = new Date(vars.trialEndsAt).toLocaleString("en-US", {
    timeZone: "UTC",
    hour12: false,
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
  const formatter = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
  const credits = formatter.format(vars.initialCredits / 1_000_000);
  return {
    notificationId: `reviewTrialApproved.${user.id}`,
    payload: {
      summary: "Your account has been approved!",
      description:
        `Your trial has been upgraded to ${credits} in credits. ` +
        `Your trial will end at ${trialEndsAt} UTC. ` +
        `Get started by deploying your first application today.`
    },
    user: {
      id: user.id,
      email: user.email
    }
  };
}
