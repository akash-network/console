import { differenceInHours } from "date-fns";

import type { UserOutput } from "@src/user/repositories";
import type { CreateNotificationInput } from "../notification/notification.service";

export function beforeCloseTrialDeployment(user: UserOutput, vars: { deploymentClosedAt: string; dseq: string; owner: string }): CreateNotificationInput {
  const deploymentClosedAt = new Date(vars.deploymentClosedAt);
  const timeLeft = deploymentClosedAt.getTime() < Date.now() ? 0 : differenceInHours(deploymentClosedAt, new Date());
  return {
    notificationId: `beforeCloseTrialDeployment.${timeLeft}.${user.id}`,
    payload: {
      summary: "Your Trial Deployment is Closing Soon",
      description: `Your trial deployment of Akash Network is closing in ${timeLeft} hours`
    },
    user: {
      id: user.id,
      email: user.email
    }
  };
}
