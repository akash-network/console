import { describe, expect, it } from "vitest";

import { slugify } from "./slugify";

describe(slugify.name, () => {
  it("keeps a value that already is a slug", () => {
    expect(slugify("checkout-api", 40)).toBe("checkout-api");
  });

  it("lowercases and turns every run of other characters into one hyphen", () => {
    expect(slugify("  Checkout API  (v2) ", 40)).toBe("checkout-api-v2");
  });

  it("drops leading and trailing hyphens", () => {
    expect(slugify("--storefront--", 40)).toBe("storefront");
  });

  it("returns an empty slug when nothing usable is left", () => {
    expect(slugify("!!!", 40)).toBe("");
  });

  it("cuts the slug to the given length", () => {
    expect(slugify("a".repeat(50), 40)).toBe("a".repeat(40));
  });
});
