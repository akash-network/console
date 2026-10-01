import { describe, expect, it } from "vitest";

import { createNetworkSearchParamsSchema } from "./networkSearchParams";

describe(createNetworkSearchParamsSchema.name, () => {
  it("falls back to the default network when the url names none", () => {
    const schema = createNetworkSearchParamsSchema("sandbox");

    expect(schema.parse({})).toEqual({ network: "sandbox" });
  });

  it("keeps the network the url names", () => {
    const schema = createNetworkSearchParamsSchema("mainnet");

    expect(schema.parse({ network: "testnet" })).toEqual({ network: "testnet" });
  });

  it("rejects a network the app does not serve", () => {
    const schema = createNetworkSearchParamsSchema("mainnet");

    expect(() => schema.parse({ network: "devnet" })).toThrow();
  });
});
