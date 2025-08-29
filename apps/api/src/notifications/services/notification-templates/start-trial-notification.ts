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
      summary: "Welcome to Your Free Trial!",
      description:
        `Your free trial with Akash Network has started! You now have access to all platform features. ` +
        `Trial deployments are limited to ${vars.deploymentLifetimeInHours} hours, and your trial will end on ${trialEndsAt} by UTC. ` +
        `Explore and deploy on the decentralized cloud infrastructure.`
    },
    user: {
      id: user.id,
      email: user.email
    }
  };
}
