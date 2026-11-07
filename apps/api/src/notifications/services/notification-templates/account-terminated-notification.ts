import type { CreateNotificationInput } from "../notification/notification.service";
import { SUPPORT_CONTACT_PARAGRAPH, userReasonParagraph } from "./account-status-email-parts";

export function accountTerminatedNotification(
  user: { id: string; email: string | null },
  vars: { eventId: string; userReason: string | null; creditsForfeited: boolean }
): CreateNotificationInput {
  const creditsNotice = vars.creditsForfeited
    ? "The credits left on the account are forfeited and won't be refunded."
    : "The credits left on the account stay there, but you can't spend them.";

  return {
    notificationId: `accountTerminated.${vars.eventId}`,
    payload: {
      summary: "Your Akash Console account has been terminated",
      description:
        "<p>We've terminated your Akash Console account. This decision is final.</p>" +
        userReasonParagraph(vars.userReason) +
        `<p>We're closing any deployments still running on it. ${creditsNotice}</p>` +
        "<p>You can still sign in to see your billing history and invoices.</p>" +
        SUPPORT_CONTACT_PARAGRAPH
    },
    user: { id: user.id, email: user.email }
  };
}
