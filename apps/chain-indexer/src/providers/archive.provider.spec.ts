import { Storage } from "@google-cloud/storage";
import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import { ARCHIVE_STORAGE } from "@src/providers/archive.provider";
import { RAW_APP_CONFIG } from "@src/providers/raw-app-config.provider";

describe("ARCHIVE_STORAGE", () => {
  it("resolves a Storage client when ARCHIVE_BUCKET is set", () => {
    const child = setup({ ARCHIVE_BUCKET: "raw-blocks" });

    expect(child.resolve(ARCHIVE_STORAGE)).toBeInstanceOf(Storage);
  });

  it("resolves null when ARCHIVE_BUCKET is unset", () => {
    const child = setup({});

    expect(child.resolve(ARCHIVE_STORAGE)).toBeNull();
  });

  it("caches the client per container", () => {
    const child = setup({ ARCHIVE_BUCKET: "raw-blocks" });

    expect(child.resolve(ARCHIVE_STORAGE)).toBe(child.resolve(ARCHIVE_STORAGE));
  });

  function setup(env: Record<string, string>) {
    const child = container.createChildContainer();
    child.register(RAW_APP_CONFIG, { useValue: { POSTGRES_DB_URI: "postgres://unit:unit@localhost:5432/unit", ...env } });
    return child;
  }
});
