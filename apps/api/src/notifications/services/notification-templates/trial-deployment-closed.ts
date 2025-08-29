import type { UserOutput } from "@src/user/repositories";
import type { CreateNotificationInput } from "../notification/notification.service";

export function trialDeploymentClosedNotification(
  user: UserOutput,
  vars: { dseq: string; owner: string; deploymentLifetimeInHours: number }
): CreateNotificationInput {
  return {
    notificationId: `trialDeploymentClosed.${vars.dseq}.${vars.owner}`,
    payload: {
      summary: "Your Trial Deployment Has Been Closed",
      description: `Your trial deployment (dseq: ${vars.dseq}) has been closed by the system after reaching the ${vars.deploymentLifetimeInHours}-hour limit. To keep your deployment running, please add a payment method and top up your account.`
    },
    user: {
      id: user.id,
      email: user.email
    }
  };
}
