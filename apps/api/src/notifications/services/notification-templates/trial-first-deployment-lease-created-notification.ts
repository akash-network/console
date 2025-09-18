import type { UserOutput } from "@src/user/repositories";
import type { CreateNotificationInput } from "../notification/notification.service";

export function trialFirstDeploymentLeaseCreatedNotification(user: UserOutput, vars: { dseq: string; owner: string }): CreateNotificationInput {
  return {
    notificationId: `trialFirstDeploymentLeaseCreated.${vars.owner}`,
    payload: {
      summary: "You deployed your first application!",
      description: `Congratulations on creating your first deployment (dseq: ${vars.dseq}) with Akash Console. If you have questions about anything you see, hit up our discord server <insert link to https://discord.com/invite/akash> `
    },
    user: {
      id: user.id,
      email: user.email
    }
  };
}

