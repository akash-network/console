import { describe, expect, it } from "vitest";

import { describeStatusForTenant } from "./hardware-request-status-message";

describe(describeStatusForTenant.name, () => {
  it.each([
    { status: "submitted", headline: "is back in our queue", detail: "We'll pick it up again shortly." },
    { status: "in_review", headline: "is being reviewed", detail: "Our team is reviewing what you asked for." },
    { status: "sourcing", headline: "is being sourced", detail: "We're reaching out to providers for capacity that matches your request." },
    { status: "offers", headline: "has offers ready", detail: "Compare the offers and accept the one that suits you." },
    { status: "accepted", headline: "has an accepted offer", detail: "Our team is setting up your capacity." },
    { status: "fulfilled", headline: "is ready", detail: "Your capacity is set up." },
    { status: "withdrawn", headline: "was withdrawn", detail: "We've stopped working on it." },
    { status: "closed", headline: "was closed", detail: "We've stopped working on it." }
  ] as const)("words the $status status for the tenant", ({ status, headline, detail }) => {
    expect(describeStatusForTenant("Quote request: 16× H200 (2 nodes)", status)).toEqual({ headline: `Quote request: 16× H200 (2 nodes) ${headline}`, detail });
  });

  it.each([
    { closeReason: "no_supply", detail: "We couldn't find capacity that matches your request." },
    { closeReason: "price", detail: "We couldn't find capacity at your target price." },
    { closeReason: "went_silent", detail: "We didn't hear back from you." },
    { closeReason: "duplicate", detail: "It repeats another of your requests." },
    { closeReason: "other", detail: "We've stopped working on it." }
  ] as const)("explains a request closed for $closeReason", ({ closeReason, detail }) => {
    expect(describeStatusForTenant("GPU request: 1× A100", "closed", closeReason).detail).toBe(detail);
  });

  it("ignores a close reason on a request that is not closed", () => {
    expect(describeStatusForTenant("GPU request: 1× A100", "sourcing", "price").detail).toBe(
      "We're reaching out to providers for capacity that matches your request."
    );
  });
});
