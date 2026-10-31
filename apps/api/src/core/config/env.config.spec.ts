import { describe, expect, it } from "vitest";

import { envSchema } from "./env.config";

describe("envSchema", () => {
  it("leaves POSTGRES_PREPARE unset by default", () => {
    expect(envSchema.parse(setup()).POSTGRES_PREPARE).toBeUndefined();
  });

  it.each([
    ["true", true],
    ["false", false]
  ])("parses POSTGRES_PREPARE %s as %s", (raw, parsed) => {
    expect(envSchema.parse(setup({ POSTGRES_PREPARE: raw })).POSTGRES_PREPARE).toBe(parsed);
  });

  it("refuses a POSTGRES_PREPARE that is neither true nor false", () => {
    expect(() => envSchema.parse(setup({ POSTGRES_PREPARE: "no" }))).toThrow();
  });

  it("refuses an empty POSTGRES_MIGRATION_DB_URI", () => {
    expect(() => envSchema.parse(setup({ POSTGRES_MIGRATION_DB_URI: "" }))).toThrow();
  });

  function setup(input: { POSTGRES_PREPARE?: string; POSTGRES_MIGRATION_DB_URI?: string } = {}) {
    return {
      POSTGRES_DB_URI: "postgres://localhost/console-users",
      AMPLITUDE_API_KEY: "amplitude-key",
      FEATURE_FLAGS_ENABLE_ALL: "true",
      ...input
    };
  }
});
