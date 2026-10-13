import { describe, expect, it } from "vitest";

import { describeBidCollectingStep, expectedBidProgress } from "./bidCollectingStatus";

describe(describeBidCollectingStep.name, () => {
  it("posts the request while the deployment is being created", () => {
    expect(describeBidCollectingStep(input({ msSinceQuoting: null }))).toBe("Posting your request to the network");
  });

  it("counts the providers and regions it asked once quoting starts", () => {
    expect(describeBidCollectingStep(input({ msSinceQuoting: 0, providerCount: 24, regionCount: 5 }))).toBe("Sent to 24 providers across 5 regions");
    expect(describeBidCollectingStep(input({ msSinceQuoting: 1499, providerCount: 24, regionCount: 2 }))).toBe("Sent to 24 providers across 2 regions");
  });

  it("names the placement when every provider asked sits in one region", () => {
    expect(describeBidCollectingStep(input({ msSinceQuoting: 0, providerCount: 3, regionCount: 1, placementName: "dcloud" }))).toBe(
      "Sent to 3 providers that can run dcloud"
    );
    expect(describeBidCollectingStep(input({ msSinceQuoting: 0, providerCount: 1, regionCount: 0, placementName: "dcloud" }))).toBe(
      "Sent to 1 provider that can run dcloud"
    );
  });

  it.each([
    { msSinceQuoting: 1500, step: "Providers are pricing your spec" },
    { msSinceQuoting: 2999, step: "Providers are pricing your spec" },
    { msSinceQuoting: 3000, step: "Waiting for the first bid" },
    { msSinceQuoting: 8499, step: "Waiting for the first bid" },
    { msSinceQuoting: 8500, step: "Still waiting. Some providers take longer to respond." }
  ])("says '$step' $msSinceQuoting ms after quoting starts", ({ msSinceQuoting, step }) => {
    expect(describeBidCollectingStep(input({ msSinceQuoting }))).toBe(step);
  });

  function input(overrides: Partial<Parameters<typeof describeBidCollectingStep>[0]>): Parameters<typeof describeBidCollectingStep>[0] {
    return { msSinceQuoting: 0, providerCount: 10, regionCount: 3, placementName: "placement-1", ...overrides };
  }
});

describe(expectedBidProgress.name, () => {
  it("fills about four fifths of the bar by the time a first bid usually lands and never fills it before one does", () => {
    expect(expectedBidProgress(0)).toBe(0);
    expect(expectedBidProgress(3000)).toBeCloseTo(60.05, 2);
    expect(expectedBidProgress(6000)).toBeCloseTo(82.14, 2);
    expect(expectedBidProgress(600_000)).toBeCloseTo(95);
  });
});
