import { describe, expect, it } from "vitest";

import { envSchema } from "./env.config";

describe("envSchema", () => {
  it("keeps prepared statements on by default", () => {
    expect(envSchema.parse(setup()).POSTGRES_PREPARE).toBe(true);
  });

  it("turns prepared statements off when POSTGRES_PREPARE is false", () => {
    expect(envSchema.parse(setup({ POSTGRES_PREPARE: "false" })).POSTGRES_PREPARE).toBe(false);
  });

  it("refuses a POSTGRES_PREPARE that is neither true nor false", () => {
    expect(() => envSchema.parse(setup({ POSTGRES_PREPARE: "no" }))).toThrow();
  });

  function setup(input: { POSTGRES_PREPARE?: string } = {}) {
    return {
      POSTGRES_DB_URI: "postgres://localhost/console-users",
      AMPLITUDE_API_KEY: "amplitude-key",
      FEATURE_FLAGS_ENABLE_ALL: "true",
      ...input
    };
  }
});
