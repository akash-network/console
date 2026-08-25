import { formatDistanceToNow } from "date-fns";

import type { UserOutput } from "@src/user/repositories";
import type { CreateNotificationInput } from "../notification/notification.service";

export function runtimeLimitEndingNotification(
  user: UserOutput,
  vars: { dseq: string; owner: string; runtimeEndsAt: string; deploymentSettingsUrl: string }
): CreateNotificationInput {
  const runtimeEndsAt = new Date(vars.runtimeEndsAt);
  const timeLeft = runtimeEndsAt.getTime() < Date.now() ? "in a few seconds" : formatDistanceToNow(runtimeEndsAt, { addSuffix: true });

  return {
    notificationId: `runtimeLimitEnding.${runtimeEndsAt.toISOString()}.${vars.dseq}.${vars.owner}`,
    payload: {
      summary: "Your Akash deployment stops soon",
      description:
        `Deployment <strong>${vars.dseq}</strong> reaches its runtime limit ${timeLeft} and will be closed. ` +
        `To keep it running, <a href="${vars.deploymentSettingsUrl}">extend the limit or switch it to always-on funding</a>.`
    },
    user: { id: user.id, email: user.email }
  };
}
