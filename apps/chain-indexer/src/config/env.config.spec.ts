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

  describe("when INDEXER_ROLE is backfill", () => {
    it("requires both backfill heights", () => {
      expect(() => setup({ INDEXER_ROLE: "backfill" })).toThrow(/BACKFILL_FROM_HEIGHT[\s\S]*BACKFILL_TO_HEIGHT/);
    });

    it("rejects a range where from is above to", () => {
      expect(() => setup({ INDEXER_ROLE: "backfill", BACKFILL_FROM_HEIGHT: "100", BACKFILL_TO_HEIGHT: "50" })).toThrow(
        "BACKFILL_FROM_HEIGHT must be <= BACKFILL_TO_HEIGHT"
      );
    });

    it("parses a valid range with concurrency and batch size defaults", () => {
      const config = setup({ INDEXER_ROLE: "backfill", BACKFILL_FROM_HEIGHT: "100", BACKFILL_TO_HEIGHT: "200" });

      expect(config.BACKFILL_FROM_HEIGHT).toBe(100);
      expect(config.BACKFILL_TO_HEIGHT).toBe(200);
      expect(config.BACKFILL_CONCURRENCY).toBe(10);
      expect(config.BACKFILL_BATCH_SIZE).toBe(200);
    });
  });

  it("treats an empty ARCHIVE_BUCKET as absent", () => {
    const config = setup({ ARCHIVE_BUCKET: "" });

    expect(config.ARCHIVE_BUCKET).toBeUndefined();
  });

  it("parses ARCHIVE_BUCKET when set", () => {
    const config = setup({ ARCHIVE_BUCKET: "raw-blocks" });

    expect(config.ARCHIVE_BUCKET).toBe("raw-blocks");
  });

  it("treats an empty ARCHIVE_STORAGE_API_ENDPOINT as absent", () => {
    const config = setup({ ARCHIVE_STORAGE_API_ENDPOINT: "" });

    expect(config.ARCHIVE_STORAGE_API_ENDPOINT).toBeUndefined();
  });

  it("does not require backfill heights for other roles", () => {
    const config = setup({ INDEXER_ROLE: "api", BACKFILL_FROM_HEIGHT: "", BACKFILL_TO_HEIGHT: "" });

    expect(config.BACKFILL_FROM_HEIGHT).toBeUndefined();
    expect(config.BACKFILL_TO_HEIGHT).toBeUndefined();
  });

  function setup(overrides?: Record<string, string>) {
    return envSchema.parse({ POSTGRES_DB_URI: "postgres://unit:unit@localhost:5432/unit", ...overrides });
  }
});
