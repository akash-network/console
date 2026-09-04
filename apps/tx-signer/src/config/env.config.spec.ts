import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";

import { envSchema } from "./env.config";

describe("envSchema", () => {
  it("accepts the shipped defaults", () => {
    const result = envSchema.safeParse(setup());

    expect(result.success).toBe(true);
  });

  it("rejects an rpc request timeout that outlives the tx window it carries", () => {
    const result = envSchema.safeParse(setup({ RPC_REQUEST_TIMEOUT_MS: 30_000, UNORDERED_TX_TTL_MS: 30_000 }));

    expect(result.success).toBe(false);
    expect(result.error!.issues).toContainEqual(expect.objectContaining({ path: ["RPC_REQUEST_TIMEOUT_MS"] }));
  });

  it("rejects a signing deadline that cannot fit one whole attempt", () => {
    const result = envSchema.safeParse(setup({ SIGN_AND_BROADCAST_DEADLINE_MS: 40_000 }));

    expect(result.success).toBe(false);
    expect(result.error!.issues).toContainEqual(expect.objectContaining({ path: ["SIGN_AND_BROADCAST_DEADLINE_MS"] }));
  });

  function setup(overrides: Record<string, unknown> = {}) {
    return {
      ACCESS_API_KEY: faker.string.alphanumeric(32),
      FUNDING_WALLET_MNEMONIC_V2: faker.lorem.words(12),
      DERIVATION_WALLET_MNEMONIC_V2: faker.lorem.words(12),
      RPC_NODE_ENDPOINT: faker.internet.url(),
      ...overrides
    };
  }
});
