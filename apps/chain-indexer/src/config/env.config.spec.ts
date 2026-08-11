import { describe, expect, it } from "vitest";

import { envSchema } from "@src/config/env.config";

describe("envSchema", () => {
  it("parses a minimal environment with defaults", () => {
    const config = setup();

    expect(config.INDEXER_ROLE).toBe("sync");
    expect(config.PORT).toBe(3092);
    expect(config.SYNC_START_HEIGHT).toBeUndefined();
  });

  it("treats an empty SYNC_START_HEIGHT as absent", () => {
    const config = setup({ SYNC_START_HEIGHT: "" });

    expect(config.SYNC_START_HEIGHT).toBeUndefined();
  });

  it("coerces a numeric SYNC_START_HEIGHT string", () => {
    const config = setup({ SYNC_START_HEIGHT: "12345" });

    expect(config.SYNC_START_HEIGHT).toBe(12345);
  });

  it("rejects a PORT above 65535", () => {
    expect(() => setup({ PORT: "65536" })).toThrow();
  });

  it("rejects a fractional PORT", () => {
    expect(() => setup({ PORT: "3092.5" })).toThrow();
  });

  function setup(overrides?: Record<string, string>) {
    return envSchema.parse({ POSTGRES_DB_URI: "postgres://unit:unit@localhost:5432/unit", ...overrides });
  }
});
