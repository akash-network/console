import type { CreateNotificationInput } from "../notification/notification.service";
import { SUPPORT_CONTACT_PARAGRAPH, userReasonParagraph } from "./account-status-email-parts";

export function accountSuspendedNotification(
  user: { id: string; email: string | null },
  vars: { eventId: string; userReason: string | null; closeDeployments: boolean }
): CreateNotificationInput {
  const closingNotice = vars.closeDeployments ? "<p>We're also closing the deployments that were running on it.</p>" : "";

  return {
    notificationId: `accountSuspended.${vars.eventId}`,
    payload: {
      summary: "Your Akash Console account is suspended",
      description:
        "<p>We've suspended your Akash Console account.</p>" +
        userReasonParagraph(vars.userReason) +
        closingNotice +
        "<p>While it's suspended, you can still sign in, check your balance and look through your deployments, billing history and invoices. " +
        "You can also close deployments. You can't deploy, add funds, buy credits or start a trial.</p>" +
        SUPPORT_CONTACT_PARAGRAPH
    },
    user: { id: user.id, email: user.email }
  };
}
