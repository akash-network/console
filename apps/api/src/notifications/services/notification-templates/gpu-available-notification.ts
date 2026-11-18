import type { UserOutput } from "@src/user/repositories";
import type { CreateNotificationInput } from "../notification/notification.service";

export type GpuAvailableVars = {
  entryId: string;
  setupLabel: string;
  priceUsdPerHour: number;
  isTrial: boolean;
  deployUrl: string;
  leaveUrl: string;
  waveNumber: number;
};

export function gpuAvailableNotification(user: Pick<UserOutput, "id" | "email">, vars: GpuAvailableVars): CreateNotificationInput {
  const description = [
    `<p>${vars.setupLabel} is available on Akash from $${vars.priceUsdPerHour}/hr.</p>`,
    "<p>The first to deploy gets it, so we can't hold it for you.</p>",
    vars.isTrial ? "<p>Add a payment method to deploy GPUs.</p>" : ""
  ].join("");

  return {
    notificationId: `gpuAvailable.${vars.entryId}.${vars.waveNumber}`,
    payload: {
      summary: `${vars.setupLabel} is available on Akash`,
      description,
      actions: [
        { label: "Deploy now", url: vars.deployUrl },
        { label: "Stop these alerts", url: vars.leaveUrl }
      ]
    },
    user: { id: user.id, email: user.email }
  };
}
