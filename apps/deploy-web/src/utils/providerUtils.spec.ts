import { describe, expect, it } from "vitest";

import { formatProviderCount, providerDisplayName } from "./providerUtils";

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
