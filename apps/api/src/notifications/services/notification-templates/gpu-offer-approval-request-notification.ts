import escapeHtml from "lodash/escape";

import type { UserOutput } from "@src/user/repositories";
import type { CreateNotificationInput } from "../notification/notification.service";
import { linkedActions } from "./notification-actions";

export type GpuOfferApprovalRequestVars = {
  eventId: string;
  requestedBy: string;
  requestTitle: string;
  offerSummary: string;
  requestUrl: string | undefined;
};

/** Keyed on the timeline event and the approver, so a retried job emails each owner and admin once. */
export function gpuOfferApprovalRequestNotification(user: Pick<UserOutput, "id" | "email">, vars: GpuOfferApprovalRequestVars): CreateNotificationInput {
  return {
    notificationId: `gpuOfferApprovalRequest.${vars.eventId}.${user.id}`,
    payload: {
      summary: `${vars.requestedBy} asks you to accept a GPU offer`,
      description: [
        `<p><strong>${escapeHtml(vars.requestTitle)}</strong><br>${escapeHtml(vars.offerSummary)}</p>`,
        `<p>${escapeHtml(vars.requestedBy)} picked this offer. Only owners and admins of the organization can accept it.</p>`
      ].join(""),
      actions: linkedActions({ label: "Review offer", url: vars.requestUrl })
    },
    user: { id: user.id, email: user.email }
  };
}
