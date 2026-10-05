import { describe, expect, it } from "vitest";

import { forgetRetiredStorage } from "./retiredStorage";

describe(forgetRetiredStorage.name, () => {
  it("removes the managed-wallet cache of every network", () => {
    const storage = storageWith({ "mainnet/managed-wallets": "{}", "sandbox-2/managed-wallets": "{}" });

    forgetRetiredStorage(storage);

    expect(keysOf(storage)).toEqual([]);
  });

  it("leaves every other key alone, including ones that only resemble the cache", () => {
    const kept = ["configure-draft:abc", "managed-wallets", "mainnet/managed-wallets.bak", "mainnet/akash1abc/deployments/1.data"];
    const storage = storageWith(Object.fromEntries([...kept, "mainnet/managed-wallets"].map(key => [key, "{}"])));

    forgetRetiredStorage(storage);

    expect(keysOf(storage)).toEqual(kept);
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
