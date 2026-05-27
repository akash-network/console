import { describe, expect, it } from "vitest";

import { findProviderForBidProvider } from "./providerUtils";

import { buildProvider } from "@tests/seeders/provider";

describe(findProviderForBidProvider.name, () => {
  it("finds the provider when the bid provider matches its owner", () => {
    const provider = buildProvider({ aliasOwners: [] });

    const result = findProviderForBidProvider([provider], provider.owner);

    expect(result).toBe(provider);
  });

  it("finds the canonical provider when the bid provider matches one of its aliasOwners", () => {
    const aliasOwner = "akash1alias000000000000000000000000000000000";
    const provider = buildProvider({ aliasOwners: [aliasOwner] });

    const result = findProviderForBidProvider([provider], aliasOwner);

    expect(result).toBe(provider);
  });

  it("returns undefined when no provider matches owner or aliasOwners", () => {
    const provider = buildProvider({ aliasOwners: [] });

    const result = findProviderForBidProvider([provider], "akash1notlisted");

    expect(result).toBeUndefined();
  });

  it("returns undefined when providers is undefined", () => {
    const result = findProviderForBidProvider(undefined, "akash1anything");

    expect(result).toBeUndefined();
  });
});
