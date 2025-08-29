import type { UserOutput } from "@src/user/repositories";
import type { CreateNotificationInput } from "../notification/notification.service";

export function startTrialNotification(user: UserOutput, vars: { trialEndsAt: string; deploymentLifetimeInHours: number }): CreateNotificationInput {
  return {
    notificationId: `startTrial.${user.id}`,
    payload: {
      summary: "Welcome to Your Free Trial!",
      description: `Your free trial with Akash Network has started! You now have access to all platform features. Trial deployments are limited to ${vars.deploymentLifetimeInHours} hours, and your trial will end on ${new Date(vars.trialEndsAt).toLocaleString()} by UTC. Explore and deploy on the decentralized cloud infrastructure.`
    },
    user: {
      id: user.id,
      email: user.email
    }
  };
}
