import type { FirstPurchaseBonusOffer } from "@src/billing/services/first-purchase-bonus-offer/first-purchase-bonus-offer.service";
import type { ResolvedValue } from "@src/notifications/services/notification-data-resolver/notification-data-resolver.service";
import type { UserOutput } from "@src/user/repositories";
import type { CreateNotificationInput } from "../notification/notification.service";
import { firstPurchaseBonusSentence } from "./first-purchase-bonus-offer";

export function trialDeploymentClosedNotification(
  user: UserOutput,
  vars: { dseq: string; owner: string; deploymentLifetimeInHours: number; firstPurchaseBonus: ResolvedValue<FirstPurchaseBonusOffer | null> }
): CreateNotificationInput {
  return {
    notificationId: `trialDeploymentClosed.${vars.dseq}.${vars.owner}`,
    payload: {
      summary: "Your Trial Deployment Has Been Closed",
      description:
        `Your trial deployment (dseq: ${vars.dseq}) has been closed by the system after reaching the ${vars.deploymentLifetimeInHours}-hour limit. To keep your deployment running, please add a payment method and top up your account.` +
        firstPurchaseBonusSentence(vars.firstPurchaseBonus)
    },
    user: {
      id: user.id,
      email: user.email
    }
  };
}
