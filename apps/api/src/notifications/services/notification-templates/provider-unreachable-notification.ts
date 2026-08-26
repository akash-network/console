import { formatDistanceToNow } from "date-fns";

import type { UserOutput } from "@src/user/repositories";
import type { CreateNotificationInput } from "../notification/notification.service";

export function providerUnreachableNotification(
  user: UserOutput,
  vars: { dseq: string; owner: string; hostUri: string; downSince: string; deploymentUrl: string }
): CreateNotificationInput {
  const downSince = new Date(vars.downSince);

  return {
    notificationId: `providerUnreachable.${downSince.toISOString()}.${vars.dseq}.${vars.owner}`,
    payload: {
      summary: "Your Akash deployment's provider is unreachable",
      description:
        `The provider hosting deployment <strong>${vars.dseq}</strong>, <strong>${vars.hostUri}</strong>, ` +
        `has not responded for ${formatDistanceToNow(downSince)} and your workload is most likely down. ` +
        `You are still paying for it. <a href="${vars.deploymentUrl}">Close the deployment</a> to get the remaining ` +
        `funds back, then redeploy somewhere else.`
    },
    user: { id: user.id, email: user.email }
  };
}
