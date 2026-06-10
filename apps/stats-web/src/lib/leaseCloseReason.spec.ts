import { describe, expect, it } from "vitest";

import { formatLeaseCloseReason } from "./leaseCloseReason";

describe(formatLeaseCloseReason.name, () => {
  it.each([
    ["lease_closed_owner", "Closed by tenant"],
    ["lease_closed_reason_unstable", "Workloads unstable (provider)"],
    ["lease_closed_reason_decommission", "Provider decommissioned"],
    ["lease_closed_reason_manifest_timeout", "Manifest timeout (provider)"],
    ["lease_closed_reason_unspecified", "Unspecified (provider)"],
    ["lease_closed_reason_insufficient_funds", "Insufficient funds"]
  ])("maps the enum name %s to its friendly label", (reason, expected) => {
    expect(formatLeaseCloseReason(reason)).toBe(expected);
  });

  it("resolves a numeric string that matches a known reason", () => {
    // The provider "unstable" reason is enum value 10000.
    expect(formatLeaseCloseReason("10000")).toBe("Workloads unstable (provider)");
  });

  it.each([
    ["500", "Closed by tenant"],
    ["15000", "Closed by provider"],
    ["25000", "Closed by network"]
  ])("falls back to a range-based label for unmapped value %s", (reason, expected) => {
    expect(formatLeaseCloseReason(reason)).toBe(expected);
  });

  it("returns 'Unspecified' when the reason is omitted", () => {
    expect(formatLeaseCloseReason()).toBe("Unspecified");
  });

  it.each(["0", "lease_closed_invalid", "UNRECOGNIZED"])("returns 'Unspecified' for the zero/invalid sentinel %s", reason => {
    expect(formatLeaseCloseReason(reason)).toBe("Unspecified");
  });

  it("returns the raw value for an unrecognized reason name", () => {
    expect(formatLeaseCloseReason("some_future_reason")).toBe("some_future_reason");
  });

  it("returns the raw value for an out-of-range numeric reason", () => {
    expect(formatLeaseCloseReason("30000")).toBe("30000");
  });
});
