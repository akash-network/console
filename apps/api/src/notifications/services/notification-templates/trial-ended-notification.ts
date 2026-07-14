import type { FirstPurchaseBonusOffer } from "@src/billing/services/first-purchase-bonus-offer/first-purchase-bonus-offer.service";
import type { ResolvedValue } from "@src/notifications/services/notification-data-resolver/notification-data-resolver.service";
import type { UserOutput } from "@src/user/repositories";
import type { CreateNotificationInput } from "../notification/notification.service";
import { firstPurchaseBonusSentence } from "./first-purchase-bonus-offer";

export function trialEndedNotification(
  user: UserOutput,
  vars: { paymentLink: string; firstPurchaseBonus: ResolvedValue<FirstPurchaseBonusOffer | null> }
): CreateNotificationInput {
  return {
    notificationId: `trialEnded.${user.id}`,
    payload: {
      summary: "Your Free Trial Has Ended",
      description:
        `Your free trial with Akash Network has ended. To continue using the platform and accessing all features, please add a payment method and purchase some credits by visiting <a href="${vars.paymentLink}">Akash Console Payment Setup</a>.` +
        firstPurchaseBonusSentence(vars.firstPurchaseBonus)
    },
    user: {
      id: user.id,
      email: user.email
    }
  };
}
