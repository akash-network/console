import { differenceInDays } from "date-fns";

import type { UserOutput } from "@src/user/repositories";
import type { CreateNotificationInput } from "../notification/notification.service";

export function beforeTrialEndsNotification(user: UserOutput, vars: { trialEndsAt: string }): CreateNotificationInput {
  const trialEndsDate = new Date(vars.trialEndsAt);
  const daysLeft = trialEndsDate.getTime() < Date.now() ? 0 : differenceInDays(trialEndsDate, new Date());
  return {
    notificationId: `beforeTrialEnds.${daysLeft}.${user.id}`,
    payload: {
      summary: "Your Free Trial is Ending Soon",
      description: `Your free trial with Akash Network will end in ${daysLeft} days. To continue using the platform without interruption, please add a payment method and top up your account.`
    },
    user: {
      id: user.id,
      email: user.email
    }
  };
}
