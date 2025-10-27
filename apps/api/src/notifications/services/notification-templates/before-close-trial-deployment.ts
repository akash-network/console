import { formatDistanceToNow } from "date-fns";

import type { UserOutput } from "@src/user/repositories";
import type { CreateNotificationInput } from "../notification/notification.service";

export function beforeCloseTrialDeploymentNotification(
  user: UserOutput,
  vars: { deploymentClosedAt: string; dseq: string; owner: string }
): CreateNotificationInput {
  const deploymentClosedAt = new Date(vars.deploymentClosedAt);
  const timeLeft = deploymentClosedAt.getTime() < Date.now() ? "in a few seconds" : formatDistanceToNow(deploymentClosedAt, { addSuffix: true });
  return {
    notificationId: `beforeCloseTrialDeployment.${deploymentClosedAt.toISOString()}.${vars.dseq}.${vars.owner}`,
    payload: {
      summary: "Your Trial Deployment Ends Soon",
      description: `Your trial deployment will end ${timeLeft}. To keep your deployment running, please add a payment method and top up your account before then.`
    },
    user: {
      id: user.id,
      email: user.email
    }
  };
}
