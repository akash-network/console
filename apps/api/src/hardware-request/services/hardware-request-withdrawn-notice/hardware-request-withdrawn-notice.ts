import escapeHtml from "lodash/escape";

import { hardwareRequestTitle } from "@src/hardware-request/lib/hardware-request-title/hardware-request-title";
import type { HardwareRequestOutput } from "@src/hardware-request/repositories/hardware-request/hardware-request.repository";
import type { CreateNotificationInput } from "@src/notifications/services/notification/notification.service";

export function hardwareRequestWithdrawnNotice(input: {
  hardwareRequest: HardwareRequestOutput;
  eventId: string;
  recipient: { id: string; email: string };
}): CreateNotificationInput {
  const { hardwareRequest, eventId, recipient } = input;
  const contactEmail = escapeHtml(hardwareRequest.contactEmail);

  return {
    notificationId: `hardwareRequestWithdrawn.${eventId}`,
    payload: {
      summary: `Withdrawn: ${hardwareRequestTitle(hardwareRequest)}`,
      description: [
        "<p>The tenant withdrew this request, so it needs no more sourcing or offers.</p>",
        `<p><strong>Request ID:</strong><br>${escapeHtml(hardwareRequest.id)}</p>`,
        `<p><strong>Contact:</strong> <a href="mailto:${contactEmail}">${contactEmail}</a></p>`
      ].join("")
    },
    user: recipient
  };
}
