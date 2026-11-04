import { describe, expect, it } from "vitest";

import { hardwareRequestWithdrawnNotice } from "./hardware-request-withdrawn-notice";

import { createHardwareRequest } from "@test/seeders/hardware-request.seeder";

describe(hardwareRequestWithdrawnNotice.name, () => {
  it("names the request, keyed on the withdrawal event, with an escaped contact link", () => {
    const hardwareRequest = createHardwareRequest({ category: "gpu_model", gpuModel: "H100", quantity: 8, spec: null, contactEmail: "j<a>ne@example.com" });
    const recipient = { id: "recipient-1", email: "remington@akash.network" };

    expect(hardwareRequestWithdrawnNotice({ hardwareRequest, eventId: "event-1", recipient })).toEqual({
      notificationId: "hardwareRequestWithdrawn.event-1",
      payload: {
        summary: expect.stringMatching(/^Withdrawn: .*H100/),
        description:
          "<p>The tenant withdrew this request, so it needs no more sourcing or offers.</p>" +
          `<p><strong>Request ID:</strong><br>${hardwareRequest.id}</p>` +
          '<p><strong>Contact:</strong> <a href="mailto:j&lt;a&gt;ne@example.com">j&lt;a&gt;ne@example.com</a></p>'
      },
      user: recipient
    });
  });
});
