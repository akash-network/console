import type { UserOutput } from "@src/user/repositories";
import type { CreateNotificationInput } from "../notification/notification.service";

export function trialDeploymentClosed(user: UserOutput, vars: { dseq: string; owner: string }): CreateNotificationInput {
  return {
    notificationId: `trialDeploymentClosed.${vars.dseq}.${vars.owner}`,
    payload: {
      summary: "Your trial deployment has been closed",
      description: `Your trial deployment with dseq "${vars.dseq}" has been closed`
    },
    user: {
      id: user.id,
      email: user.email
    }
  };
}
