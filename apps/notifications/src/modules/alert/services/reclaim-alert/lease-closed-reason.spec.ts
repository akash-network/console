import { LeaseClosedReason } from "@akashnetwork/chain-sdk/private-types/akash.v1";
import { describe, expect, it } from "vitest";

import { getLeaseClosedReasonText, toLeaseClosedReason } from "./lease-closed-reason";

describe("toLeaseClosedReason", () => {
  it("maps a known numeric enum value to itself", () => {
    expect(toLeaseClosedReason(10000)).toBe(LeaseClosedReason.lease_closed_reason_unstable);
  });

  it("maps a known enum name to its numeric value", () => {
    expect(toLeaseClosedReason("lease_closed_reason_insufficient_funds")).toBe(LeaseClosedReason.lease_closed_reason_insufficient_funds);
  });

  it("maps a numeric string to its enum value", () => {
    expect(toLeaseClosedReason("10001")).toBe(LeaseClosedReason.lease_closed_reason_decommission);
  });

  it("returns UNRECOGNIZED for an unknown numeric value", () => {
    expect(toLeaseClosedReason(99999)).toBe(LeaseClosedReason.UNRECOGNIZED);
  });

  it("returns UNRECOGNIZED for an unknown string value", () => {
    expect(toLeaseClosedReason("not_a_real_reason")).toBe(LeaseClosedReason.UNRECOGNIZED);
  });
});

describe("getLeaseClosedReasonText", () => {
  it("returns readable text for a mapped reason", () => {
    expect(getLeaseClosedReasonText(LeaseClosedReason.lease_closed_reason_decommission)).toBe("the provider is being decommissioned");
  });

  it("returns the fallback text for UNRECOGNIZED", () => {
    expect(getLeaseClosedReasonText(LeaseClosedReason.UNRECOGNIZED)).toBe("an unspecified reason");
  });

  it("returns readable text for every known enum value", () => {
    const knownValues = Object.values(LeaseClosedReason).filter((value): value is LeaseClosedReason => typeof value === "number");

    for (const value of knownValues) {
      expect(getLeaseClosedReasonText(value)).toBeTruthy();
    }
  });
});
