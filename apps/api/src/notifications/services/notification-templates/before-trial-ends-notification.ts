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
      description: `Your free trial with Akash Network will end in ${daysLeft} days. You still have <insert remaining credits left> in free credits available and, ` +
                   `<insert number of active deployments running> deployments that will be lost when your free trial ends. ` +
                   `To retain the remaining free credits and to ensure your deployments keep running when the trial ends, purchase some credits today by visiting <insert link to payments page>.`
    },
    user: {
      id: user.id,
      email: user.email
    }
  };
}
