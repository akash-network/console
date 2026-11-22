import escapeHtml from "lodash/escape";

import type { UserOutput } from "@src/user/repositories";
import type { CreateNotificationInput } from "../notification/notification.service";

export type GpuStillWantedVars = {
  entryId: string;
  askedAtEpochMs: number;
  setupLabel: string;
  graceDays: number;
  keepUrl: string;
  leaveUrl: string;
};

export function gpuStillWantedNotification(user: Pick<UserOutput, "id" | "email">, vars: GpuStillWantedVars): CreateNotificationInput {
  const description = [
    `<p>You're waiting for ${escapeHtml(vars.setupLabel)} on Akash. Do you still want it?</p>`,
    `<p>If you don't answer, this alert ends on its own in ${vars.graceDays} days.</p>`
  ].join("");

  return {
    notificationId: `gpuStillWanted.${vars.entryId}.${vars.askedAtEpochMs}`,
    payload: {
      summary: `Still want ${vars.setupLabel}?`,
      description,
      actions: [
        { label: "Keep this alert", url: vars.keepUrl },
        { label: "Stop these alerts", url: vars.leaveUrl }
      ]
    },
    user: { id: user.id, email: user.email }
  };
}
