import { differenceInDays } from "date-fns";

import type { UserOutput } from "@src/user/repositories";
import type { CreateNotificationInput } from "../notification/notification.service";

export function beforeTrialEndsNotification(user: UserOutput, vars: { trialEndsAt: string }): CreateNotificationInput {
  const trialEndsDate = new Date(vars.trialEndsAt);
  const daysLeft = trialEndsDate.getTime() < Date.now() ? 0 : differenceInDays(trialEndsDate, new Date());
  return {
    notificationId: `beforeTrialEnds.${daysLeft}.${user.id}`,
    payload: {
      summary: "Your Trial Ends Soon",
      description: `Your trial of Akash Network is ending in ${daysLeft} days`
    },
    user: {
      id: user.id,
      email: user.email
    }
  };
}
