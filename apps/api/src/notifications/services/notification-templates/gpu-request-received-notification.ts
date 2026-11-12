import type { UserOutput } from "@src/user/repositories";
import type { CreateNotificationInput } from "../notification/notification.service";
import { linkedActions } from "./notification-actions";

export type GpuRequestReceivedVars = {
  hardwareRequestId: string;
  headline: string;
  detail: string;
  requestUrl: string | undefined;
};

export function gpuRequestReceivedNotification(user: Pick<UserOutput, "id" | "email">, vars: GpuRequestReceivedVars): CreateNotificationInput {
  return {
    notificationId: `gpuRequestReceived.${vars.hardwareRequestId}`,
    payload: {
      summary: vars.headline,
      description: vars.detail,
      actions: linkedActions({ label: "View request", url: vars.requestUrl })
    },
    user: { id: user.id, email: user.email }
  };
}
