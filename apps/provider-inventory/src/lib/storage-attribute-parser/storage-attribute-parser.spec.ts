import { describe, expect, it } from "vitest";

import { parseStorageAttributes } from "./storage-attribute-parser";

describe(parseStorageAttributes.name, () => {
  it("classifies storage with no attributes as ephemeral", () => {
    const { result } = setup({ attributes: [] });
    expect(result.classification).toBe("ephemeral");
    expect(result.persistent).toBe(false);
  });

  it("classifies storage with persistent=false as ephemeral", () => {
    const { result } = setup({
      attributes: [
        { key: "persistent", value: "false" },
        { key: "class", value: "ephemeral" }
      ]
    });
    expect(result.classification).toBe("ephemeral");
    expect(result.persistent).toBe(false);
  });

  it("classifies storage with class=ram as ram-backed", () => {
    const { result } = setup({
      attributes: [
        { key: "persistent", value: "false" },
        { key: "class", value: "ram" }
      ]
    });
    expect(result.classification).toBe("ram");
    expect(result.persistent).toBe(false);
  });

  it("classifies persistent storage with beta2 class", () => {
    const { result } = setup({
      attributes: [
        { key: "persistent", value: "true" },
        { key: "class", value: "beta2" }
      ]
    });
    expect(result.classification).toBe("persistent");
    expect(result.persistent).toBe(true);
    expect(result.class).toBe("beta2");
  });

  it("throws for invalid persistent+ram combination", () => {
    expect(() =>
      setup({
        attributes: [
          { key: "persistent", value: "true" },
          { key: "class", value: "ram" }
        ]
      })
    ).toThrow("persistent storage cannot use RAM class");
  });

  it("throws when persistent storage has no class", () => {
    expect(() =>
      setup({
        attributes: [{ key: "persistent", value: "true" }]
      })
    ).toThrow("Persistent storage must specify a valid storage class");
  });

  function setup(input: { attributes: { key: string; value: string }[] }) {
    const result = parseStorageAttributes(input.attributes);
    return { result };
  }
});
