import type { CreateNotificationInput } from "../notification/notification.service";
import { SUPPORT_CONTACT_PARAGRAPH } from "./account-status-email-parts";

export function accountReinstatedNotification(user: { id: string; email: string | null }, vars: { eventId: string }): CreateNotificationInput {
  return {
    notificationId: `accountReinstated.${vars.eventId}`,
    payload: {
      summary: "Your Akash Console account is active again",
      description:
        "<p>We've lifted the suspension on your Akash Console account. Everything works as it did before, so you can deploy, add funds and buy credits again.</p>" +
        SUPPORT_CONTACT_PARAGRAPH
    },
    user: { id: user.id, email: user.email }
  };
}
