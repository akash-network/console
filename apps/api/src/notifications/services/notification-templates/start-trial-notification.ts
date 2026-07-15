import type { UserOutput } from "@src/user/repositories";
import type { CreateNotificationInput } from "../notification/notification.service";

export function startTrialNotification(user: UserOutput, vars: { trialEndsAt: string; deploymentLifetimeInHours: number }): CreateNotificationInput {
  const trialEndsAt = new Date(vars.trialEndsAt).toLocaleString("en-US", {
    timeZone: "UTC",
    hour12: false,
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
  return {
    notificationId: `startTrial.${user.id}`,
    payload: {
      summary: `Welcome to Akash! Your trial is ready`,
      description:
        `Welcome to the Akash Supercloud! We've added some trial credit to your account so you can take Akash for a spin and deploy your first app, no credit card required. ` +
        `Your trial ends at ${trialEndsAt} UTC, and to keep access fair for everyone, trial deployments are limited to ${vars.deploymentLifetimeInHours} hours. ` +
        `Deploy your first application today to get started.`
    },
    user: {
      id: user.id,
      email: user.email
    }
  };
}
