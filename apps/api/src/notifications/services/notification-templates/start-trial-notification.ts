import type { UserOutput } from "@src/user/repositories";
import type { CreateNotificationInput } from "../notification/notification.service";

export function startTrialNotification(
  user: UserOutput,
  vars: { trialEndsAt: string; deploymentLifetimeInHours: number; initialCredits: number }
): CreateNotificationInput {
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
    notificationId: `startTrial.${user.id}`,
    payload: {
      summary: `Welcome - here's ${credits} on the house!`,
      description:
        `Welcome to the Akash Supercloud - to get you going, we have loaded your account with ${credits} in trial credits! ` +
        `Your trial will end at ${trialEndsAt} UTC. ` +
        `To ensure that all free trials get fair access to resources, trial deployments are limited to ${vars.deploymentLifetimeInHours} hours, ` +
        `Get started by deploying your first application today.`
    },
    user: {
      id: user.id,
      email: user.email
    }
  };
}
