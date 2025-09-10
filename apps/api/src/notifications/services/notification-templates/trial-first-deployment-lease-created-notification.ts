import type { UserOutput } from "@src/user/repositories";
import type { CreateNotificationInput } from "../notification/notification.service";

export function trialFirstDeploymentLeaseCreatedNotification(user: UserOutput, vars: { dseq: string; owner: string }): CreateNotificationInput {
  return {
    notificationId: `trialFirstDeploymentLeaseCreated.${vars.owner}`,
    payload: {
      summary: "Your First Deployment Has Been Created",
      description: `Your first deployment (dseq: ${vars.dseq}) has been created.`
    },
    user: {
      id: user.id,
      email: user.email
    }
  };
}
