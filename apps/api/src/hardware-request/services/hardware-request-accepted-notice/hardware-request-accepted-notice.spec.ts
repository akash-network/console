import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { HardwareRequestOfferOutput } from "@src/hardware-request/repositories/hardware-request-offer/hardware-request-offer.repository";
import { hardwareRequestAcceptedNotice } from "./hardware-request-accepted-notice";

import { createHardwareRequest } from "@test/seeders/hardware-request.seeder";

describe(hardwareRequestAcceptedNotice.name, () => {
  it("tells sales which offer to set up, keyed on the acceptance event, with everything escaped", () => {
    const hardwareRequest = createHardwareRequest({ category: "gpu_model", gpuModel: "H200", quantity: 16, spec: null, contactEmail: "j<a>ne@example.com" });
    const offer = mock<HardwareRequestOfferOutput>({
      providerAddress: "akash1provider",
      usdPerGpuHour: 2.4,
      terms: { gpu: { model: "H200", count: 16, interconnect: "cluster" }, location: "Frankfurt <DE>" }
    });
    const recipient = { id: "recipient-1", email: "remington@akash.network" };

    expect(hardwareRequestAcceptedNotice({ hardwareRequest, offer, acceptedBy: "o&o@example.com", eventId: "event-1", recipient })).toEqual({
      notificationId: "hardwareRequestAccepted.event-1",
      payload: {
        summary: expect.stringMatching(/^Offer accepted: .*H200/),
        description:
          "<p>The tenant accepted an offer. Set up the deployment with the provider.</p>" +
          "<p><strong>Provider:</strong><br>akash1provider</p>" +
          "<p><strong>Price:</strong><br>$2.4/GPU-hour for 16× H200 in Frankfurt &lt;DE&gt;</p>" +
          "<p><strong>Accepted by:</strong><br>o&amp;o@example.com</p>" +
          `<p><strong>Request ID:</strong><br>${hardwareRequest.id}</p>` +
          '<p><strong>Contact:</strong> <a href="mailto:j&lt;a&gt;ne@example.com">j&lt;a&gt;ne@example.com</a></p>'
      },
      user: recipient
    });
  });

  it("leaves out who accepted when their email is unknown", () => {
    const offer = mock<HardwareRequestOfferOutput>({ terms: { gpu: { model: "H200", count: 1, interconnect: "none" }, location: "Paris" } });

    const { payload } = hardwareRequestAcceptedNotice({
      hardwareRequest: createHardwareRequest(),
      offer,
      acceptedBy: undefined,
      eventId: "event-1",
      recipient: { id: "recipient-1", email: "remington@akash.network" }
    });

    expect(payload.description).toContain("in Paris</p><p><strong>Request ID:</strong>");
  });
});
