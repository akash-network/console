import type { FirstPurchaseBonusOffer } from "@src/billing/services/first-purchase-bonus-offer/first-purchase-bonus-offer.service";
import type { ResolvedValue } from "@src/notifications/services/notification-data-resolver/notification-data-resolver.service";
import type { UserOutput } from "@src/user/repositories";
import type { CreateNotificationInput } from "../notification/notification.service";
import { firstPurchaseBonusSentence } from "./first-purchase-bonus-offer";

export function afterTrialEndsNotification(
  user: UserOutput,
  vars: { paymentLink: string; firstPurchaseBonus: ResolvedValue<FirstPurchaseBonusOffer | null> }
): CreateNotificationInput {
  return {
    notificationId: `afterTrialEnds.${user.id}`,
    payload: {
      summary: "Add payment info to continue using Akash",
      description:
        `Your trial period with Akash Network has ended. To keep using the platform and access all features, please add a payment method and top up your account by visiting <a href="${vars.paymentLink}">Akash Console Payment Setup</a>` +
        firstPurchaseBonusSentence(vars.firstPurchaseBonus)
    },
    user: {
      id: user.id,
      email: user.email
    }
  };
}
