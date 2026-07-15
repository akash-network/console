import { formatDistanceToNow } from "date-fns";

import type { FirstPurchaseBonusOffer } from "@src/billing/services/first-purchase-bonus-offer/first-purchase-bonus-offer.service";
import type { ResolvedValue } from "@src/notifications/services/notification-data-resolver/notification-data-resolver.service";
import type { UserOutput } from "@src/user/repositories";
import type { CreateNotificationInput } from "../notification/notification.service";
import { firstPurchaseBonusSentence } from "./first-purchase-bonus-offer";

export function beforeTrialEndsNotification(
  user: UserOutput,
  vars: {
    trialEndsAt: string;
    paymentLink: string;
    remainingCredits: ResolvedValue<number>;
    activeDeployments: ResolvedValue<number>;
    firstPurchaseBonus: ResolvedValue<FirstPurchaseBonusOffer | null>;
  }
): CreateNotificationInput {
  const trialEndsDate = new Date(vars.trialEndsAt);
  const timeLeft = trialEndsDate.getTime() < Date.now() ? "in a few seconds" : formatDistanceToNow(trialEndsDate, { addSuffix: true });
  return {
    notificationId: `beforeTrialEnds.${trialEndsDate.toISOString()}.${user.id}`,
    payload: {
      summary: "Your Free Trial is Ending Soon",
      description:
        `Your free trial with Akash Network will end ${timeLeft}. You still have $${vars.remainingCredits} in free credits available and, ` +
        `${vars.activeDeployments} deployments that will be lost when your free trial ends. ` +
        `To retain the remaining free credits and to ensure your deployments keep running when the trial ends, purchase some credits today by visiting <a href="${vars.paymentLink}">Akash Console Payment Setup</a>.` +
        firstPurchaseBonusSentence(vars.firstPurchaseBonus)
    },
    user: {
      id: user.id,
      email: user.email
    }
  };
}
