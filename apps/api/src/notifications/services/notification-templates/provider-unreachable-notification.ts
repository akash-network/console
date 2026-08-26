import { formatDistanceToNow } from "date-fns";
import escapeHtml from "lodash/escape";

import type { UserOutput } from "@src/user/repositories";
import type { CreateNotificationInput } from "../notification/notification.service";

/**
 * A provider's host URI is whatever it declared on chain, so it reaches this email as untrusted text
 * and is escaped before going into the markup.
 */
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
        `The provider hosting deployment <strong>${vars.dseq}</strong>, <strong>${escapeHtml(vars.hostUri)}</strong>, ` +
        `has not responded for ${formatDistanceToNow(downSince)} and your workload is most likely down. ` +
        `You are still paying for it. <a href="${vars.deploymentUrl}">Close the deployment</a> to get the remaining ` +
        `funds back, then redeploy somewhere else.`
    },
    user: { id: user.id, email: user.email }
  };
}
