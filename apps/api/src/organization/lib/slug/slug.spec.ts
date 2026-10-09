import { describe, expect, it } from "vitest";

import { toSlug } from "./slug";

describe(toSlug.name, () => {
  it("keeps a name that already is a slug", () => {
    expect(toSlug("checkout-api-2")).toBe("checkout-api-2");
  });

  it("lowercases the name and joins its words with a single hyphen", () => {
    expect(toSlug("  Checkout   API__v2 ")).toBe("checkout-api-v2");
  });

  it("drops the hyphens a name starts or ends with", () => {
    expect(toSlug("--Checkout API!!")).toBe("checkout-api");
  });

  it("caps the slug at 40 characters", () => {
    expect(toSlug("a".repeat(45))).toBe("a".repeat(40));
  });

  it("gives an empty slug to a name without a letter or number", () => {
    expect(toSlug("!!! ---")).toBe("");
  });
});
