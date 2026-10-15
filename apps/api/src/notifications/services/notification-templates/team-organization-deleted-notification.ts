import escapeHtml from "lodash/escape";

import type { CreateNotificationInput } from "../notification/notification.service";

export function teamOrganizationDeletedNotification(
  user: { id: string; email: string | null },
  vars: { organizationId: string; organizationName: string; deletedByName: string | null | undefined }
): CreateNotificationInput {
  const deletedBy = vars.deletedByName ? escapeHtml(vars.deletedByName) : "An owner";

  return {
    notificationId: `teamOrganizationDeleted.${vars.organizationId}.${user.id}`,
    payload: {
      summary: `${vars.organizationName} was deleted on Akash Console`,
      description:
        `<p>${deletedBy} deleted the team <strong>${escapeHtml(vars.organizationName)}</strong> on Akash Console. ` +
        "You no longer have access to its projects, deployments, API keys or billing.</p>" +
        "<p>Any credits it had left were forfeited and its saved cards were removed. Its payment and deployment history is kept on record.</p>"
    },
    user: { id: user.id, email: user.email }
  };
}
