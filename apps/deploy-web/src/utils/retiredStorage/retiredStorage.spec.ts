import { describe, expect, it } from "vitest";

import { forgetRetiredStorage } from "./retiredStorage";

const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

describe(forgetRetiredStorage.name, () => {
  it("removes the managed-wallet cache of every network", () => {
    const storage = storageWith({ "mainnet/managed-wallets": "{}", "sandbox-2/managed-wallets": "{}" });

    forgetRetiredStorage(storage);

    expect(keysOf(storage)).toEqual([]);
  });

  it("leaves every other key alone, including ones that only resemble the cache", () => {
    const kept = ["managed-wallets", "mainnet/managed-wallets.bak", "mainnet/akash1abc/deployments/1.data", "my-configure-draft:abc"];
    const storage = storageWith(Object.fromEntries([...kept, "mainnet/managed-wallets"].map(key => [key, "{}"])));

    forgetRetiredStorage(storage);

    expect(keysOf(storage)).toEqual(kept);
  });

  it("forgets a configure draft this browser kept once the account would no longer keep it", () => {
    const now = Date.UTC(2026, 9, 6);
    const storage = storageWith({
      "configure-draft:recent": JSON.stringify({ sdl: "x", updatedAt: now - RETENTION_MS + 1 }),
      "configure-draft:expired": JSON.stringify({ sdl: "x", updatedAt: now - RETENTION_MS })
    });

    forgetRetiredStorage(storage, now);

    expect(keysOf(storage)).toEqual(["configure-draft:recent"]);
  });

  it.each([
    ["an undated", JSON.stringify({ sdl: "x" })],
    ["an unreadable", "{not json"],
    ["a null", "null"]
  ])("forgets %s configure draft this browser kept", (_case, raw) => {
    const storage = storageWith({ "configure-draft:odd": raw });

    forgetRetiredStorage(storage);

    expect(keysOf(storage)).toEqual([]);
  });

  function storageWith(entries: Record<string, string>): Storage {
    const values = new Map(Object.entries(entries));
    return {
      get length() {
        return values.size;
      },
      key: index => [...values.keys()][index] ?? null,
      getItem: key => values.get(key) ?? null,
      setItem: (key, value) => {
        values.set(key, value);
      },
      removeItem: key => {
        values.delete(key);
      },
      clear: () => values.clear()
    };
  }

  function keysOf(storage: Storage) {
    return Array.from({ length: storage.length }, (_, index) => storage.key(index));
  }
});
