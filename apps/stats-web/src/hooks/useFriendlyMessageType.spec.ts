import { describe, expect, it } from "vitest";

import { getFriendlyMessageType } from "./useFriendlyMessageType";

describe("getFriendlyMessageType", () => {
  it("formats full message type URLs", () => {
    expect(getFriendlyMessageType("/akash.verification.v1.MsgSubmitAttestation")).toBe("Submit Attestation");
  });

  it("formats typed events without leaving the Event prefix behind", () => {
    expect(getFriendlyMessageType("akash.provider.v1beta4.EventProviderMaintenanceOpened")).toBe("Provider Maintenance Opened");
  });

  it("preserves existing unprefixed names", () => {
    expect(getFriendlyMessageType("akash.market.v1.LeaseClosed")).toBe("Lease Closed");
  });
});
