import type { UserOutput } from "@src/user/repositories";
import type { CreateNotificationInput } from "../notification/notification.service";
import { linkedActions } from "./notification-actions";

export type GpuRequestStatusVars = {
  eventId: string;
  headline: string;
  detail: string;
  requestUrl: string | undefined;
};

/** Keyed on the timeline event, so a retried job sends one email while a later change to the same status sends another. */
export function gpuRequestStatusNotification(user: Pick<UserOutput, "id" | "email">, vars: GpuRequestStatusVars): CreateNotificationInput {
  return {
    notificationId: `gpuRequestStatus.${vars.eventId}`,
    payload: {
      summary: vars.headline,
      description: vars.detail,
      actions: linkedActions({ label: "View request", url: vars.requestUrl })
    },
    user: { id: user.id, email: user.email }
  };
}
