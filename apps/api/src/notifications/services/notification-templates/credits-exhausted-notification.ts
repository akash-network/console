import { formatDistanceToNow } from "date-fns";

import type { UserOutput } from "@src/user/repositories";
import type { CreateNotificationInput } from "../notification/notification.service";

export function creditsExhaustedNotification(
  user: UserOutput,
  vars: { firstClosingDseq: string; unfundedDeploymentCount: number; firstClosureAt: string; paymentLink: string; billingUrl: string }
): CreateNotificationInput {
  const firstClosureAt = new Date(vars.firstClosureAt);
  const timeLeft = firstClosureAt.getTime() > Date.now() ? formatDistanceToNow(firstClosureAt, { addSuffix: true }) : "shortly";
  const dseq = `<strong>${vars.firstClosingDseq}</strong>`;
  const closingDeployments =
    vars.unfundedDeploymentCount > 1
      ? `The credits left in your account are not enough to keep <strong>${vars.unfundedDeploymentCount} deployments</strong> running. The first one, ${dseq}, will close ${timeLeft}`
      : `The credits left in your account are not enough to keep deployment ${dseq} running. It will close ${timeLeft}`;

  return {
    notificationId: `creditsExhausted.${user.id}`,
    payload: {
      summary: vars.unfundedDeploymentCount > 1 ? "Your Akash deployments are about to close" : "Your Akash deployment is about to close",
      description: `${closingDeployments} unless you add credits or turn on Auto Recharge.`,
      actions: [
        { label: "Add credits", url: vars.paymentLink },
        { label: "Enable Auto Recharge", url: vars.billingUrl }
      ]
    },
    user: { id: user.id, email: user.email }
  };
}
