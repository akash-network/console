import { describe, expect, it } from "vitest";

import { useFriendlyMessageType } from "./useFriendlyMessageType";

describe("useFriendlyMessageType", () => {
  it("formats full message type URLs", () => {
    expect(useFriendlyMessageType("/akash.verification.v1.MsgSubmitAttestation")).toBe("Submit Attestation");
  });

  it("formats typed events without leaving the Event prefix behind", () => {
    expect(useFriendlyMessageType("akash.provider.v1beta4.EventProviderMaintenanceOpened")).toBe("Provider Maintenance Opened");
  });

  it("preserves existing unprefixed names", () => {
    expect(useFriendlyMessageType("akash.market.v1.LeaseClosed")).toBe("Lease Closed");
  });
});
