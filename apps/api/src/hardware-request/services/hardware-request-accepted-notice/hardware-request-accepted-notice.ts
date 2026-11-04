import escapeHtml from "lodash/escape";

import { hardwareRequestTitle } from "@src/hardware-request/lib/hardware-request-title/hardware-request-title";
import type { HardwareRequestOutput } from "@src/hardware-request/repositories/hardware-request/hardware-request.repository";
import type { HardwareRequestOfferOutput } from "@src/hardware-request/repositories/hardware-request-offer/hardware-request-offer.repository";
import type { CreateNotificationInput } from "@src/notifications/services/notification/notification.service";

export function hardwareRequestAcceptedNotice(input: {
  hardwareRequest: HardwareRequestOutput;
  offer: HardwareRequestOfferOutput;
  acceptedBy: string | undefined;
  eventId: string;
  recipient: { id: string; email: string };
}): CreateNotificationInput {
  const { hardwareRequest, offer, acceptedBy, eventId, recipient } = input;
  const contactEmail = escapeHtml(hardwareRequest.contactEmail);

  return {
    notificationId: `hardwareRequestAccepted.${eventId}`,
    payload: {
      summary: `Offer accepted: ${hardwareRequestTitle(hardwareRequest)}`,
      description: [
        "<p>The tenant accepted an offer. Set up the deployment with the provider.</p>",
        `<p><strong>Provider:</strong><br>${escapeHtml(offer.providerAddress)}</p>`,
        `<p><strong>Price:</strong><br>$${offer.usdPerGpuHour}/GPU-hour for ${offer.terms.gpu.count}× ${escapeHtml(offer.terms.gpu.model)} in ${escapeHtml(offer.terms.location)}</p>`,
        acceptedBy ? `<p><strong>Accepted by:</strong><br>${escapeHtml(acceptedBy)}</p>` : "",
        `<p><strong>Request ID:</strong><br>${escapeHtml(hardwareRequest.id)}</p>`,
        `<p><strong>Contact:</strong> <a href="mailto:${contactEmail}">${contactEmail}</a></p>`
      ].join("")
    },
    user: recipient
  };
}
