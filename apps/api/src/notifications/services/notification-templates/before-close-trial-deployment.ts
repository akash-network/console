import { formatDistanceToNow } from "date-fns";

import type { FirstPurchaseBonusOffer } from "@src/billing/services/first-purchase-bonus-offer/first-purchase-bonus-offer.service";
import type { ResolvedValue } from "@src/notifications/services/notification-data-resolver/notification-data-resolver.service";
import type { UserOutput } from "@src/user/repositories";
import type { CreateNotificationInput } from "../notification/notification.service";
import { firstPurchaseBonusSentence } from "./first-purchase-bonus-offer";

export function beforeCloseTrialDeploymentNotification(
  user: UserOutput,
  vars: { deploymentClosedAt: string; dseq: string; owner: string; firstPurchaseBonus: ResolvedValue<FirstPurchaseBonusOffer | null> }
): CreateNotificationInput {
  const deploymentClosedAt = new Date(vars.deploymentClosedAt);
  const timeLeft = deploymentClosedAt.getTime() < Date.now() ? "in a few seconds" : formatDistanceToNow(deploymentClosedAt, { addSuffix: true });
  return {
    notificationId: `beforeCloseTrialDeployment.${deploymentClosedAt.toISOString()}.${vars.dseq}.${vars.owner}`,
    payload: {
      summary: "Your Trial Deployment Ends Soon",
      description:
        `Your trial deployment will end ${timeLeft}. To keep your deployment running, please add a payment method and top up your account before then.` +
        firstPurchaseBonusSentence(vars.firstPurchaseBonus)
    },
    user: {
      id: user.id,
      email: user.email
    }
  };
}
