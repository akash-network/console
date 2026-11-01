import { describe, expect, it } from "vitest";

import { toStorableChainString } from "./chain-string";

describe(toStorableChainString.name, () => {
  it("removes every NUL character", () => {
    expect(toStorableChainString("\0us-\0west\0")).toBe("us-west");
  });

  it("removes lone high and low surrogates", () => {
    expect(toStorableChainString("a\uD800b\uDC00c")).toBe("abc");
  });

  it("keeps characters made of a surrogate pair", () => {
    expect(toStorableChainString("gpu 🚀")).toBe("gpu 🚀");
  });

  it("returns a well-formed string unchanged", () => {
    expect(toStorableChainString("https://provider.example.com:8443")).toBe("https://provider.example.com:8443");
  });
});
