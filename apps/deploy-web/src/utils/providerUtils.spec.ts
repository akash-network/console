import { describe, expect, it } from "vitest";

import { describeGpuAvailability, describeNotBiddingProviders, formatProviderCount, providerDisplayName } from "./providerUtils";

describe(providerDisplayName.name, () => {
  it("prefers the organization when present", () => {
    expect(providerDisplayName({ organization: "Dune Networks", hostUri: "https://provider.example:8443", owner: "akash1a" })).toBe("Dune Networks");
  });

  it("falls back to the host name when there is no organization", () => {
    expect(providerDisplayName({ organization: null, hostUri: "https://provider.example:8443", owner: "akash1a" })).toBe("provider.example");
  });

  it("falls back to the owner address when there is no organization or host", () => {
    expect(providerDisplayName({ organization: null, hostUri: "", owner: "akash1a" })).toBe("akash1a");
  });

  it("falls back to the owner address when the host uri is malformed rather than throwing", () => {
    expect(providerDisplayName({ organization: null, hostUri: "not a url", owner: "akash1a" })).toBe("akash1a");
  });

  it("falls back to the owner address when the host uri is whitespace only", () => {
    expect(providerDisplayName({ organization: null, hostUri: "   ", owner: "akash1a" })).toBe("akash1a");
  });
});

describe(formatProviderCount.name, () => {
  it("counts a single provider in the singular", () => {
    expect(formatProviderCount(1)).toBe("1 provider");
  });

  it("counts several providers in the plural", () => {
    expect(formatProviderCount(3)).toBe("3 providers");
  });

  it("formats nothing when the count is unknown", () => {
    expect(formatProviderCount(undefined)).toBeUndefined();
  });
});

describe(describeGpuAvailability.name, () => {
  it("reads the free gpus on the providers", () => {
    expect(describeGpuAvailability(3, 14)).toBe("14 free GPUs on 3 providers");
  });

  it("counts a single gpu and a single provider in the singular", () => {
    expect(describeGpuAvailability(1, 1)).toBe("1 free GPU on 1 provider");
  });

  it("reads the providers alone while the gpu count is unknown", () => {
    expect(describeGpuAvailability(2, null)).toBe("2 providers");
  });
});

describe(describeNotBiddingProviders.name, () => {
  it("reads how many of the providers have not bid when only some have not", () => {
    expect(describeNotBiddingProviders(2, 4)).toBe("2 of 4 providers haven't bid on recent test deployments of this GPU");
  });

  it("reads a single provider that has not bid among several in the singular", () => {
    expect(describeNotBiddingProviders(1, 3)).toBe("1 of 3 providers hasn't bid on recent test deployments of this GPU");
  });

  it("reads that none of the providers bid when every one has not", () => {
    expect(describeNotBiddingProviders(3, 3)).toBe("None of the 3 providers bid on recent test deployments of this GPU");
  });

  it("reads that the only provider has not bid when it is alone", () => {
    expect(describeNotBiddingProviders(1, 1)).toBe("The only provider hasn't bid on recent test deployments of this GPU");
  });
});
